import fs from 'node:fs'
import path from 'node:path'
import { alignScenesToSrt } from './dp-align'
import { readAudioTimeline } from './audio-timeline'
import { parseSrt, secondsToSrtTime, timeToSeconds } from './srt-parser'
import type { AlignmentItem, AlignmentPreviewResult, PreviewConfig, Scene, SrtEntry } from './types'
import { readScenes } from './xlsx-reader'

const IMAGE_EXTENSIONS = new Set(['.png', '.jpg', '.jpeg', '.webp', '.bmp'])

function indexImagesByScene(directory: string): Map<number, string> {
  const imagesByScene = new Map<number, string>()
  if (!fs.existsSync(directory)) return imagesByScene

  const names = fs
    .readdirSync(directory)
    .filter((name) => IMAGE_EXTENSIONS.has(path.extname(name).toLowerCase()))
    .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }))

  for (const name of names) {
    const extension = path.extname(name)
    const match = path.basename(name, extension).match(/^(\d+)/)
    const sceneNumber = match ? Number(match[1]) : Number.NaN
    if (Number.isFinite(sceneNumber) && !imagesByScene.has(sceneNumber)) {
      imagesByScene.set(sceneNumber, path.join(directory, name))
    }
  }

  return imagesByScene
}

export function findImage(directory: string, sceneNumber: number): string | null {
  return indexImagesByScene(directory).get(sceneNumber) ?? null
}

function createAlignmentItems(
  scenes: Scene[],
  srtEntries: SrtEntry[] | null,
  config: PreviewConfig,
  imagesByScene = indexImagesByScene(config.imagesDirectory),
): AlignmentItem[] {
  if (config.timelinePath?.trim()) {
    const timeline = readAudioTimeline(config.timelinePath, scenes)

    return scenes.map((scene, index) => {
      const timelineItem = timeline.items[index]
      const subtitleEnd = timelineItem.startSeconds + timelineItem.audioDurationSeconds
      return {
        sceneNumber: scene.number,
        sceneContent: scene.content,
        imagePath: imagesByScene.get(scene.number) ?? null,
        start: secondsToSrtTime(timelineItem.startSeconds),
        startSeconds: timelineItem.startSeconds,
        duration: timelineItem.endSeconds - timelineItem.startSeconds,
        srtEntries: [{
          start: secondsToSrtTime(timelineItem.startSeconds),
          end: secondsToSrtTime(subtitleEnd),
          text: scene.content,
        }],
        timingSource: 'timeline',
        audioDurationSeconds: timelineItem.audioDurationSeconds,
        pauseAfterSeconds: timelineItem.pauseAfterSeconds,
      }
    })
  }

  if (!srtEntries?.length) throw new Error('Chưa có Timeline audio và không đọc được file SRT fallback.')

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
      imagePath: imagesByScene.get(scene.number) ?? null,
      start: entries[0].start,
      startSeconds,
      duration: Math.max(0.04, endSeconds - startSeconds),
      srtEntries: entries,
      timingSource: 'srt',
    }
  })
}

function compactSceneList(sceneNumbers: number[]): string {
  const firstNumbers = sceneNumbers.slice(0, 12).map((number) => `#${number}`).join(', ')
  return sceneNumbers.length > 12 ? `${firstNumbers}, ...` : firstNumbers
}

export function createAlignment(config: PreviewConfig): AlignmentItem[] {
  const scenes = readScenes(config.sceneListPath)
  const imagesByScene = indexImagesByScene(config.imagesDirectory)
  const srtEntries = config.timelinePath?.trim()
    ? null
    : config.srtPath?.trim()
      ? parseSrt(config.srtPath)
      : null
  return createAlignmentItems(scenes, srtEntries, config, imagesByScene)
}

export function previewAlignment(config: PreviewConfig): AlignmentPreviewResult {
  const scenes = readScenes(config.sceneListPath)
  const imagesByScene = indexImagesByScene(config.imagesDirectory)
  const srtEntries = config.timelinePath?.trim()
    ? null
    : config.srtPath?.trim()
      ? parseSrt(config.srtPath)
      : null
  const items = createAlignmentItems(scenes, srtEntries, config, imagesByScene)
  const assignments = config.timelinePath?.trim()
    ? []
    : alignScenesToSrt(
        scenes.map((scene) => scene.content),
        srtEntries ?? [],
      )
  const warnings: string[] = []
  if (!config.timelinePath?.trim()) {
    warnings.push(
      'Chưa có Timeline audio; duration đang fallback theo ranh giới SRT và có thể lệch khi Whisper gộp hai scene.',
    )
  }
  const missingImageScenes = items
    .filter((item) => !item.imagePath)
    .map((item) => item.sceneNumber)

  if (missingImageScenes.length > 0) {
    warnings.push(
      `Thiếu ảnh cho ${missingImageScenes.length}/${items.length} scene: ${compactSceneList(missingImageScenes)}.`,
    )
  }

  const imageSceneNumbers = [...imagesByScene.keys()]
  if (imageSceneNumbers.length > 0 && imageSceneNumbers.length < scenes.length) {
    warnings.push(`Thư mục ảnh có ${imageSceneNumbers.length} ảnh đánh số, ít hơn ${scenes.length} scene.`)
  }
  if (imageSceneNumbers.length > scenes.length) {
    warnings.push(`Thư mục ảnh có ${imageSceneNumbers.length} ảnh đánh số, nhiều hơn ${scenes.length} scene.`)
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

  if (srtEntries && srtEntries.length >= scenes.length * 3) {
    warnings.push(`SRT có ${srtEntries.length} entries cho ${scenes.length} scene. Hãy kiểm tra nếu timing bị chia quá nhỏ.`)
  }

  return { items, warnings }
}
