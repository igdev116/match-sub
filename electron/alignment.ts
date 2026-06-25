import fs from 'node:fs'
import path from 'node:path'
import { alignScenesToSrt } from './dp-align'
import { parseSrt, timeToSeconds } from './srt-parser'
import type { AlignmentItem, PreviewConfig } from './types'
import { readScenes } from './xlsx-reader'

const IMAGE_EXTENSIONS = new Set(['.png', '.jpg', '.jpeg', '.webp', '.bmp'])

export function findImage(directory: string, sceneNumber: number): string | null {
  if (!fs.existsSync(directory)) return null
  const candidates = fs
    .readdirSync(directory)
    .filter((name) => {
      const extension = path.extname(name).toLowerCase()
      const match = path.basename(name, extension).match(/^(\d+)/)
      return IMAGE_EXTENSIONS.has(extension) && Number(match?.[1]) === sceneNumber
    })
    .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }))
  return candidates[0] ? path.join(directory, candidates[0]) : null
}

export function createAlignment(config: PreviewConfig): AlignmentItem[] {
  const scenes = readScenes(config.sceneListPath)
  const srtEntries = parseSrt(config.srtPath)
  if (srtEntries.length === 0) throw new Error('Không đọc được entry nào từ file SRT.')

  const assignments = alignScenesToSrt(
    scenes.map((scene) => scene.content),
    srtEntries,
  )

  return assignments.map((assignment, index) => {
    const scene = scenes[assignment.sceneIndex]
    const entries = srtEntries.slice(assignment.srtStart, assignment.srtEnd)
    const startSeconds = timeToSeconds(entries[0].start)
    const endSeconds =
      index + 1 < assignments.length
        ? timeToSeconds(srtEntries[assignments[index + 1].srtStart].start)
        : timeToSeconds(entries[entries.length - 1].end)

    return {
      sceneNumber: scene.number,
      sceneContent: scene.content,
      imagePath: findImage(config.imagesDirectory, scene.number),
      start: entries[0].start,
      startSeconds,
      duration: Math.max(0.04, endSeconds - startSeconds),
      srtEntries: entries,
    }
  })
}
