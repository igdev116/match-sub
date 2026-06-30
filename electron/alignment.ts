import fs from 'node:fs'
import path from 'node:path'
import { alignScenesToSrt } from './dp-align'
import { parseSrt, timeToSeconds } from './srt-parser'
import type { AlignmentItem, AlignmentPreviewResult, PreviewConfig, Scene, SrtEntry } from './types'
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

function listImageSceneNumbers(directory: string): number[] {
  if (!fs.existsSync(directory)) return []
  return fs
    .readdirSync(directory)
    .map((name) => {
      if (!IMAGE_EXTENSIONS.has(path.extname(name).toLowerCase())) return null
      const match = path.basename(name, path.extname(name)).match(/^(\d+)/)
      return match ? Number(match[1]) : null
    })
    .filter((sceneNumber): sceneNumber is number => Number.isFinite(sceneNumber))
}

function createAlignmentItems(
  scenes: Scene[],
  srtEntries: SrtEntry[],
  config: PreviewConfig,
): AlignmentItem[] {
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

function compactSceneList(sceneNumbers: number[]): string {
  const firstNumbers = sceneNumbers.slice(0, 12).map((number) => `#${number}`).join(', ')
  return sceneNumbers.length > 12 ? `${firstNumbers}, ...` : firstNumbers
}

export function createAlignment(config: PreviewConfig): AlignmentItem[] {
  const scenes = readScenes(config.sceneListPath)
  const srtEntries = parseSrt(config.srtPath)
  return createAlignmentItems(scenes, srtEntries, config)
}

export function previewAlignment(config: PreviewConfig): AlignmentPreviewResult {
  const scenes = readScenes(config.sceneListPath)
  const srtEntries = parseSrt(config.srtPath)
  const items = createAlignmentItems(scenes, srtEntries, config)
  const assignments = alignScenesToSrt(
    scenes.map((scene) => scene.content),
    srtEntries,
  )
  const warnings: string[] = []
  const missingImageScenes = items
    .filter((item) => !item.imagePath)
    .map((item) => item.sceneNumber)

  if (missingImageScenes.length > 0) {
    warnings.push(
      `Thiếu ảnh cho ${missingImageScenes.length}/${items.length} scene: ${compactSceneList(missingImageScenes)}.`,
    )
  }

  const imageSceneNumbers = listImageSceneNumbers(config.imagesDirectory)
  if (imageSceneNumbers.length > 0 && imageSceneNumbers.length < scenes.length) {
    warnings.push(`Thư mục ảnh có ${imageSceneNumbers.length} ảnh đánh số, ít hơn ${scenes.length} scene.`)
  }
  if (imageSceneNumbers.length > scenes.length) {
    warnings.push(`Thư mục ảnh có ${imageSceneNumbers.length} ảnh đánh số, nhiều hơn ${scenes.length} scene.`)
  }

  const emptySrtScenes = items
    .filter((item) => item.srtEntries.length === 0)
    .map((item) => item.sceneNumber)
  if (emptySrtScenes.length > 0) {
    warnings.push(`Có ${emptySrtScenes.length} scene chưa map được SRT: ${compactSceneList(emptySrtScenes)}.`)
  }

  const lowConfidenceScenes = assignments
    .filter((assignment) => assignment.score < 0.18)
    .map((assignment) => scenes[assignment.sceneIndex]?.number)
    .filter((sceneNumber): sceneNumber is number => Number.isFinite(sceneNumber))
  if (lowConfidenceScenes.length > 0) {
    warnings.push(
      `Có ${lowConfidenceScenes.length} scene có SRT tương ứng độ khớp thấp: ${compactSceneList(lowConfidenceScenes)}.`,
    )
  }

  if (srtEntries.length >= scenes.length * 3) {
    warnings.push(`SRT có ${srtEntries.length} entries cho ${scenes.length} scene. Hãy kiểm tra nếu timing bị chia quá nhỏ.`)
  }

  return { items, warnings }
}
