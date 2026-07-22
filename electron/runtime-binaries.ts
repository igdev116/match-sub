import fs from 'node:fs'
import path from 'node:path'
import { app } from 'electron'

function firstExisting(candidates: string[]): string {
  return candidates.find((candidate) => fs.existsSync(candidate)) || ''
}

export function runtimeDirectory(): string {
  return path.join(process.resourcesPath, 'runtime')
}

export function isPackagedWindows(): boolean {
  return app.isPackaged && process.platform === 'win32'
}

export function ffmpegExecutable(): string {
  if (!app.isPackaged) return 'ffmpeg'

  const executable = process.platform === 'win32' ? 'ffmpeg.exe' : 'ffmpeg'
  return (
    firstExisting([
      path.join(runtimeDirectory(), executable),
      path.join(process.resourcesPath, 'ffmpeg-static', executable),
    ]) || path.join(runtimeDirectory(), executable)
  )
}

export function ffprobeExecutable(): string {
  if (!app.isPackaged) return 'ffprobe'

  const executable = process.platform === 'win32' ? 'ffprobe.exe' : 'ffprobe'
  const bundled = firstExisting([path.join(runtimeDirectory(), executable)])
  return bundled || (process.platform === 'win32' ? path.join(runtimeDirectory(), executable) : 'ffprobe')
}

export function bundledWhisperDirectory(): string {
  return path.join(runtimeDirectory(), 'whisper')
}

export function bundledWhisperExecutable(): string {
  if (!app.isPackaged) return ''
  const executable = process.platform === 'win32' ? 'whisper-cli.exe' : 'whisper-cli'
  return firstExisting([path.join(bundledWhisperDirectory(), executable)])
}

export function bundledWhisperModel(): string {
  if (!app.isPackaged) return ''
  return firstExisting([path.join(runtimeDirectory(), 'models', 'ggml-base.bin')])
}
