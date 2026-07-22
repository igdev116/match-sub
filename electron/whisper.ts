import { spawn } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { app } from 'electron'
import { convertAudioForWhisper } from './ffmpeg'
import {
  bundledWhisperDirectory,
  bundledWhisperExecutable,
  bundledWhisperModel,
  isPackagedWindows,
} from './runtime-binaries'
import type { AudioMergeConfig, WhisperProgress, WhisperStatus } from './types'

const MODEL_URL =
  'https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-base.bin'
const MODEL_SIZE = 147951465
const systemExecutableCandidates = [
  'whisper-cli',
  '/opt/homebrew/bin/whisper-cli',
  '/usr/local/bin/whisper-cli',
  '/opt/homebrew/opt/whisper-cpp/bin/whisper-cli',
  '/usr/local/opt/whisper-cpp/bin/whisper-cli',
]

type ProgressListener = (progress: WhisperProgress) => void

function userModelPath(): string {
  return path.join(app.getPath('userData'), 'models', 'ggml-base.bin')
}

function runCapture(
  command: string,
  args: string[],
  onOutput?: (chunk: string) => void,
): Promise<string> {
  return new Promise((resolve, reject) => {
    const bundledDirectory = bundledWhisperDirectory()
    const usesBundledExecutable = path.isAbsolute(command) && path.dirname(command) === bundledDirectory
    const child = spawn(command, args, {
      stdio: ['ignore', 'pipe', 'pipe'],
      cwd: usesBundledExecutable ? bundledDirectory : undefined,
      env: usesBundledExecutable
        ? {
            ...process.env,
            PATH: `${bundledDirectory}${path.delimiter}${process.env.PATH || ''}`,
          }
        : process.env,
    })
    let output = ''
    const appendOutput = (chunk: Buffer) => {
      const text = chunk.toString()
      onOutput?.(text)
      output = `${output}${text}`.slice(-20_000)
    }
    child.stdout.on('data', (chunk: Buffer) => {
      appendOutput(chunk)
    })
    child.stderr.on('data', (chunk: Buffer) => {
      appendOutput(chunk)
    })
    child.on('error', reject)
    child.on('close', (code) => {
      if (code === 0) resolve(output)
      else reject(new Error(output.trim() || `${command} thoát với mã ${code}.`))
    })
  })
}

async function findExecutable(): Promise<{
  path: string
  source: WhisperStatus['executableSource']
}> {
  const bundled = bundledWhisperExecutable()
  const candidates = bundled
    ? [{ path: bundled, source: 'bundled' as const }]
    : isPackagedWindows()
      ? []
      : systemExecutableCandidates.map((candidate) => ({ path: candidate, source: 'system' as const }))

  for (const candidate of candidates) {
    try {
      await runCapture(candidate.path, ['--help'])
      return candidate
    } catch {
      // Check the next common installation path.
    }
  }
  return { path: '', source: 'missing' }
}

export async function getWhisperStatus(): Promise<WhisperStatus> {
  const executable = await findExecutable()
  const packagedWindows = isPackagedWindows()
  const bundledModel = bundledWhisperModel()
  const downloadedModel = userModelPath()
  const targetModel = bundledModel || (packagedWindows ? '' : downloadedModel)
  const modelAvailable = fs.existsSync(targetModel) && fs.statSync(targetModel).size > 100_000_000
  const repairMessage = packagedWindows && (!executable.path || !modelAvailable)
    ? 'Bộ cài đang thiếu thành phần xử lý phụ đề. Hãy cài lại ứng dụng bằng installer đầy đủ.'
    : undefined
  return {
    available: Boolean(executable.path),
    executablePath: executable.path,
    executableSource: executable.source,
    modelAvailable,
    modelPath: targetModel,
    modelSource: bundledModel ? 'bundled' : modelAvailable ? 'userData' : 'missing',
    modelSize: MODEL_SIZE,
    platform: process.platform,
    packaged: app.isPackaged,
    installSupported: process.platform === 'darwin',
    downloadSupported: !packagedWindows,
    repairMessage,
  }
}

export async function installWhisper(onProgress: ProgressListener): Promise<void> {
  if (isPackagedWindows()) {
    throw new Error('Bộ cài đang thiếu whisper.cpp. Hãy cài lại ứng dụng bằng installer đầy đủ.')
  }
  if (process.platform !== 'darwin') {
    throw new Error('Tự động cài hiện chỉ hỗ trợ macOS.')
  }
  const brewPath = ['/opt/homebrew/bin/brew', '/usr/local/bin/brew', 'brew'].find(
    (candidate) => candidate === 'brew' || fs.existsSync(candidate),
  )
  if (!brewPath) throw new Error('Không tìm thấy Homebrew trên máy.')
  onProgress({ phase: 'installing', percent: 10, message: 'Đang cài whisper.cpp bằng Homebrew...' })
  await runCapture(brewPath, ['install', 'whisper-cpp'])
  onProgress({ phase: 'complete', percent: 100, message: 'Đã cài whisper.cpp.' })
}

export async function downloadBaseModel(onProgress: ProgressListener): Promise<void> {
  if (isPackagedWindows()) {
    throw new Error('Bộ cài đang thiếu model Whisper. Hãy cài lại ứng dụng bằng installer đầy đủ.')
  }
  const target = userModelPath()
  const temporary = `${target}.download`
  fs.mkdirSync(path.dirname(target), { recursive: true })
  fs.rmSync(temporary, { force: true })

  const response = await fetch(MODEL_URL, { redirect: 'follow' })
  if (!response.ok || !response.body) {
    throw new Error(`Không thể tải model Whisper: HTTP ${response.status}.`)
  }

  const total = Number(response.headers.get('content-length')) || MODEL_SIZE
  const file = fs.createWriteStream(temporary)
  const reader = response.body.getReader()
  let received = 0

  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      received += value.byteLength
      if (!file.write(Buffer.from(value))) {
        await new Promise<void>((resolve) => file.once('drain', resolve))
      }
      onProgress({
        phase: 'downloading',
        percent: Math.min(99, Math.round((received / total) * 100)),
        message: `Đang tải model base (${Math.round(received / 1024 / 1024)}/${Math.round(total / 1024 / 1024)} MB)...`,
      })
    }
    await new Promise<void>((resolve, reject) => {
      file.end(resolve)
      file.on('error', reject)
    })
    fs.renameSync(temporary, target)
    onProgress({ phase: 'complete', percent: 100, message: 'Đã tải model Whisper base.' })
  } catch (error) {
    file.destroy()
    fs.rmSync(temporary, { force: true })
    throw error
  }
}

export async function transcribeToSrt(
  config: AudioMergeConfig,
  onProgress: ProgressListener,
): Promise<string> {
  const status = await getWhisperStatus()
  if (!status.available || !status.modelAvailable) {
    throw new Error(
      status.repairMessage ||
        (!status.available ? 'Chưa cài whisper.cpp.' : 'Chưa tải model Whisper base.'),
    )
  }

  const temporaryDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'tao-sub-whisper-'))
  const wavPath = path.join(temporaryDirectory, 'audio.wav')
  const srtPath =
    config.srtOutputPath && config.srtOutputPath.trim()
      ? config.srtOutputPath.replace(/\.srt$/i, '') + '.srt'
      : config.outputPath.replace(/\.[^.]+$/, '.srt')
  const outputBase = srtPath.replace(/\.srt$/i, '')

  try {
    fs.mkdirSync(path.dirname(srtPath), { recursive: true })
    onProgress({ phase: 'transcribing', percent: 10, message: 'Đang chuẩn hóa audio...' })
    await convertAudioForWhisper(config.outputPath, wavPath)
    onProgress({ phase: 'transcribing', percent: 15, message: 'Whisper đang nhận dạng lời thoại...' })

    const args = [
      '-m',
      status.modelPath,
      '-f',
      wavPath,
      '-l',
      config.language || 'auto',
      '-t',
      String(Math.max(1, Math.min(8, config.whisperThreads))),
      '-osrt',
      '-of',
      outputBase,
      '-pp',
    ]
    let lastWhisperPercent = -1
    let progressBuffer = ''
    await runCapture(status.executablePath, args, (chunk) => {
      progressBuffer = `${progressBuffer}${chunk}`.slice(-512)
      const matches = [...progressBuffer.matchAll(/progress\s*=\s*(\d+)%/g)]
      const rawPercent = Number(matches.at(-1)?.[1] ?? -1)
      if (rawPercent <= lastWhisperPercent || rawPercent < 0) return
      lastWhisperPercent = rawPercent
      onProgress({
        phase: 'transcribing',
        percent: Math.min(99, 15 + Math.round(rawPercent * 0.84)),
        message: `Whisper đang nhận dạng lời thoại... ${rawPercent}%`,
      })
    })
    if (!fs.existsSync(srtPath)) throw new Error('Whisper không tạo được file SRT.')
    onProgress({ phase: 'complete', percent: 100, message: `Đã xuất SRT: ${srtPath}` })
    return srtPath
  } finally {
    fs.rmSync(temporaryDirectory, { recursive: true, force: true })
  }
}
