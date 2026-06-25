import { spawn } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { app } from 'electron'
import { convertAudioForWhisper } from './ffmpeg'
import type { AudioMergeConfig, WhisperProgress, WhisperStatus } from './types'

const MODEL_URL =
  'https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-base.bin'
const MODEL_SIZE = 147951465
const executableCandidates = [
  'whisper-cli',
  '/opt/homebrew/bin/whisper-cli',
  '/usr/local/bin/whisper-cli',
  '/opt/homebrew/opt/whisper-cpp/bin/whisper-cli',
  '/usr/local/opt/whisper-cpp/bin/whisper-cli',
]

type ProgressListener = (progress: WhisperProgress) => void

function modelPath(): string {
  return path.join(app.getPath('userData'), 'models', 'ggml-base.bin')
}

function runCapture(command: string, args: string[]): Promise<string> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { stdio: ['ignore', 'pipe', 'pipe'] })
    let output = ''
    child.stdout.on('data', (chunk: Buffer) => {
      output += chunk.toString()
    })
    child.stderr.on('data', (chunk: Buffer) => {
      output += chunk.toString()
    })
    child.on('error', reject)
    child.on('close', (code) => {
      if (code === 0) resolve(output)
      else reject(new Error(output.trim() || `${command} thoát với mã ${code}.`))
    })
  })
}

async function findExecutable(): Promise<string> {
  for (const candidate of executableCandidates) {
    try {
      await runCapture(candidate, ['--help'])
      return candidate
    } catch {
      // Check the next common installation path.
    }
  }
  return ''
}

export async function getWhisperStatus(): Promise<WhisperStatus> {
  const executablePath = await findExecutable()
  const targetModel = modelPath()
  const modelAvailable = fs.existsSync(targetModel) && fs.statSync(targetModel).size > 100_000_000
  return {
    available: Boolean(executablePath),
    executablePath,
    modelAvailable,
    modelPath: targetModel,
    modelSize: MODEL_SIZE,
  }
}

export async function installWhisper(onProgress: ProgressListener): Promise<void> {
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
  const target = modelPath()
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
  if (!status.available) throw new Error('Chưa cài whisper.cpp.')
  if (!status.modelAvailable) throw new Error('Chưa tải model Whisper base.')

  const temporaryDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'tao-sub-whisper-'))
  const wavPath = path.join(temporaryDirectory, 'audio.wav')
  const outputBase = config.outputPath.replace(/\.[^.]+$/, '')
  const srtPath = `${outputBase}.srt`

  try {
    onProgress({ phase: 'transcribing', percent: 5, message: 'Đang chuẩn hóa audio...' })
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
      '-np',
    ]
    await runCapture(status.executablePath, args)
    if (!fs.existsSync(srtPath)) throw new Error('Whisper không tạo được file SRT.')
    onProgress({ phase: 'complete', percent: 100, message: `Đã xuất SRT: ${srtPath}` })
    return srtPath
  } finally {
    fs.rmSync(temporaryDirectory, { recursive: true, force: true })
  }
}
