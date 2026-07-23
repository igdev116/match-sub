import fs from 'node:fs'
import type { SrtEntry } from './types'

const TIMESTAMP_PATTERN =
  /(\d{2}:\d{2}:\d{2}[,.]\d{3})\s*-->\s*(\d{2}:\d{2}:\d{2}[,.]\d{3})/

export function parseSrtContent(content: string): SrtEntry[] {
  const normalized = content.replace(/^\uFEFF/, '').replace(/\r\n?/g, '\n').trim()
  if (!normalized) return []

  return normalized
    .split(/\n\s*\n/)
    .map((block) => {
      const lines = block.trim().split('\n')
      const timeLineIndex = lines.findIndex((line) => TIMESTAMP_PATTERN.test(line.trim()))
      if (timeLineIndex < 0) return null

      const match = lines[timeLineIndex].trim().match(TIMESTAMP_PATTERN)
      if (!match) return null

      const text = lines
        .slice(timeLineIndex + 1)
        .map((line) => line.trim())
        .filter(Boolean)
        .join(' ')

      if (!text) return null
      return {
        start: match[1].replace('.', ','),
        end: match[2].replace('.', ','),
        text,
      }
    })
    .filter((entry): entry is SrtEntry => entry !== null)
}

export function parseSrt(path: string): SrtEntry[] {
  return parseSrtContent(fs.readFileSync(path, 'utf8'))
}

export function timeToSeconds(timestamp: string): number {
  const match = timestamp.match(/^(\d{2}):(\d{2}):(\d{2})[,.](\d{3})$/)
  if (!match) throw new Error(`Thời gian SRT không hợp lệ: ${timestamp}`)
  return (
    Number(match[1]) * 3600 +
    Number(match[2]) * 60 +
    Number(match[3]) +
    Number(match[4]) / 1000
  )
}

export function secondsToSrtTime(totalSeconds: number): string {
  const totalMilliseconds = Math.max(0, Math.round(totalSeconds * 1000))
  const hours = Math.floor(totalMilliseconds / 3_600_000)
  const minutes = Math.floor((totalMilliseconds % 3_600_000) / 60_000)
  const seconds = Math.floor((totalMilliseconds % 60_000) / 1000)
  const milliseconds = totalMilliseconds % 1000
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')},${String(milliseconds).padStart(3, '0')}`
}
