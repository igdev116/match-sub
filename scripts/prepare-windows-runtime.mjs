import fs from 'node:fs'
import { mkdir, copyFile, rename, rm, stat } from 'node:fs/promises'
import { createHash } from 'node:crypto'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { Readable } from 'node:stream'
import { pipeline } from 'node:stream/promises'
import extract from 'extract-zip'

const WHISPER_VERSION = '1.8.6'
const MODEL_SIZE = 147951465
const WHISPER_SHA256 = 'b07ea0b1b4115a38e1a7b07debf581f0b77d999925f8acb8f39d322b0ba0a822'
const MODEL_SHA1 = '465707469ff3a37a2b9b8d8f89f2f99de7299dac'
const WHISPER_URL = `https://github.com/ggml-org/whisper.cpp/releases/download/v${WHISPER_VERSION}/whisper-bin-x64.zip`
const MODEL_URL = 'https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-base.bin'
const scriptDirectory = path.dirname(fileURLToPath(import.meta.url))
const projectDirectory = path.resolve(scriptDirectory, '..')
const cacheDirectory = path.join(projectDirectory, '.runtime-cache')
const runtimeDirectory = path.join(projectDirectory, 'runtime', 'win32-x64')
const windowsDirectory = process.env.WINDIR || process.env.SystemRoot || 'C:\\Windows'
const windowsSystemDirectory = path.join(windowsDirectory, 'System32')
const visualCppRuntimeFiles = [
  'msvcp140.dll',
  'vcruntime140.dll',
  'vcruntime140_1.dll',
  'vcomp140.dll',
]

async function fileHasMinimumSize(filePath, minimumSize) {
  try {
    return (await stat(filePath)).size >= minimumSize
  } catch {
    return false
  }
}

async function fileDigest(filePath, algorithm) {
  const hash = createHash(algorithm)
  for await (const chunk of fs.createReadStream(filePath)) hash.update(chunk)
  return hash.digest('hex')
}

async function isValidDownload(filePath, minimumSize, algorithm, digest) {
  return (
    (await fileHasMinimumSize(filePath, minimumSize)) &&
    (await fileDigest(filePath, algorithm)) === digest
  )
}

async function download(url, targetPath, minimumSize, algorithm, digest) {
  if (await isValidDownload(targetPath, minimumSize, algorithm, digest)) return

  await mkdir(path.dirname(targetPath), { recursive: true })
  await rm(targetPath, { force: true })
  const temporaryPath = `${targetPath}.download`
  await rm(temporaryPath, { force: true })
  const response = await fetch(url, { redirect: 'follow' })
  if (!response.ok || !response.body) {
    throw new Error(`Không thể tải ${url}: HTTP ${response.status}`)
  }
  await pipeline(Readable.fromWeb(response.body), fs.createWriteStream(temporaryPath))
  if (!(await isValidDownload(temporaryPath, minimumSize, algorithm, digest))) {
    await rm(temporaryPath, { force: true })
    throw new Error(`File tải về không hợp lệ: ${url}`)
  }
  await rename(temporaryPath, targetPath)
}

async function requireFile(filePath, label) {
  if (!(await fileHasMinimumSize(filePath, 1))) {
    throw new Error(`Thiếu ${label}: ${filePath}`)
  }
}

if (process.platform !== 'win32' || process.arch !== 'x64') {
  throw new Error(
    'prepare:win-runtime chỉ chạy trên Windows x64. Hãy tạo installer Windows bằng GitHub Actions windows-latest.',
  )
}

const ffmpegSource = path.join(projectDirectory, 'node_modules', 'ffmpeg-static', 'ffmpeg.exe')
const ffprobeSource = path.join(
  projectDirectory,
  'node_modules',
  'ffprobe-static',
  'bin',
  'win32',
  'x64',
  'ffprobe.exe',
)
await requireFile(ffmpegSource, 'ffmpeg.exe')
await requireFile(ffprobeSource, 'ffprobe.exe')

await rm(runtimeDirectory, { recursive: true, force: true })
await mkdir(path.join(runtimeDirectory, 'whisper'), { recursive: true })
await mkdir(path.join(runtimeDirectory, 'models'), { recursive: true })
await copyFile(ffmpegSource, path.join(runtimeDirectory, 'ffmpeg.exe'))
await copyFile(ffprobeSource, path.join(runtimeDirectory, 'ffprobe.exe'))

const whisperArchive = path.join(cacheDirectory, `whisper-${WHISPER_VERSION}-win-x64.zip`)
await download(WHISPER_URL, whisperArchive, 1_000_000, 'sha256', WHISPER_SHA256)
const extractionDirectory = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'tao-sub-whisper-'))
try {
  await extract(whisperArchive, { dir: extractionDirectory })
  const whisperFiles = [
    'whisper-cli.exe',
    'whisper.dll',
    'ggml.dll',
    'ggml-base.dll',
    'ggml-cpu.dll',
  ]
  for (const fileName of whisperFiles) {
    const source = path.join(extractionDirectory, 'Release', fileName)
    await requireFile(source, fileName)
    await copyFile(source, path.join(runtimeDirectory, 'whisper', fileName))
  }
  for (const fileName of visualCppRuntimeFiles) {
    const source = path.join(windowsSystemDirectory, fileName)
    await requireFile(source, fileName)
    await copyFile(source, path.join(runtimeDirectory, 'whisper', fileName))
  }
} finally {
  await rm(extractionDirectory, { recursive: true, force: true })
}

const cachedModel = path.join(cacheDirectory, 'ggml-base.bin')
await download(MODEL_URL, cachedModel, MODEL_SIZE, 'sha1', MODEL_SHA1)
await copyFile(cachedModel, path.join(runtimeDirectory, 'models', 'ggml-base.bin'))

const requiredRuntimeFiles = [
  'ffmpeg.exe',
  'ffprobe.exe',
  'whisper/whisper-cli.exe',
  'whisper/whisper.dll',
  'whisper/ggml.dll',
  'whisper/ggml-base.dll',
  'whisper/ggml-cpu.dll',
  ...visualCppRuntimeFiles.map((fileName) => `whisper/${fileName}`),
  'models/ggml-base.bin',
]
for (const relativePath of requiredRuntimeFiles) {
  await requireFile(path.join(runtimeDirectory, relativePath), relativePath)
}

console.log(`Windows runtime sẵn sàng tại: ${runtimeDirectory}`)
