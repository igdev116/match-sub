export function cleanError(error: unknown): string {
  const text = error instanceof Error ? error.message : String(error)
  return text.replace(/^Error invoking remote method '[^']+': Error: /, '')
}

export function dirname(filePath: string): string {
  const normalized = filePath.replace(/[\\/]+$/, '')
  const separatorIndex = Math.max(normalized.lastIndexOf('/'), normalized.lastIndexOf('\\'))
  return separatorIndex >= 0 ? normalized.slice(0, separatorIndex) : ''
}

export function joinPath(directory: string, filename: string): string {
  if (!directory) return filename
  const separator = directory.includes('\\') ? '\\' : '/'
  return `${directory.replace(/[\\/]+$/, '')}${separator}${filename}`
}

export function directoryFromPath(filePath: string): string {
  return filePath.split(/[\\/]/).slice(0, -1).join(filePath.includes('\\') ? '\\' : '/')
}

export function audioOutputPath(directory: string): string {
  if (!directory) return ''
  const separator = directory.includes('\\') ? '\\' : '/'
  return `${directory.replace(/[\\/]+$/, '')}${separator}merged-audio.mp3`
}

export function srtOutputPathFromAudio(audioPath: string): string {
  if (!audioPath) return ''
  const withoutExtension = audioPath.replace(/\.[^/.\\/]+$/, '')
  return `${withoutExtension}.srt`
}

export function formatDuration(seconds: number | null): string {
  if (seconds === null || !Number.isFinite(seconds)) return 'Không rõ thời lượng'
  if (seconds < 60) return `${seconds.toFixed(1)}s`
  const minutes = Math.floor(seconds / 60)
  const remainder = seconds % 60
  return `${minutes}m ${remainder.toFixed(1).padStart(4, '0')}s`
}
