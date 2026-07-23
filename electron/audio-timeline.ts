import fs from 'node:fs'
import type { AudioTimeline, AudioTimelineItem, Scene } from './types'

const TIMELINE_EPSILON_SECONDS = 0.05

function finiteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value)
}

function validateItem(item: AudioTimelineItem, index: number, scenes: Scene[]): void {
  const position = index + 1
  if (!item || typeof item !== 'object') {
    throw new Error(`Timeline audio thiếu dữ liệu tại vị trí ${position}.`)
  }
  if (item.sceneNumber !== scenes[index].number) {
    throw new Error(
      `Timeline vị trí ${position} là scene ${item.sceneNumber}, nhưng Excel là scene ${scenes[index].number}.`,
    )
  }
  if (typeof item.sourceName !== 'string' || !item.sourceName.trim()) {
    throw new Error(`Timeline scene ${item.sceneNumber} thiếu tên audio nguồn.`)
  }
  const numericFields: Array<[string, unknown]> = [
    ['startSeconds', item.startSeconds],
    ['audioDurationSeconds', item.audioDurationSeconds],
    ['pauseAfterSeconds', item.pauseAfterSeconds],
    ['endSeconds', item.endSeconds],
  ]
  const invalidField = numericFields.find(([, value]) => !finiteNumber(value))
  if (invalidField) {
    throw new Error(`Timeline scene ${item.sceneNumber} có ${invalidField[0]} không hợp lệ.`)
  }
  if (item.startSeconds < 0 || item.audioDurationSeconds <= 0 || item.pauseAfterSeconds < 0) {
    throw new Error(`Timeline scene ${item.sceneNumber} có thời lượng âm hoặc bằng 0.`)
  }
  if (item.endSeconds <= item.startSeconds) {
    throw new Error(`Timeline scene ${item.sceneNumber} có mốc kết thúc không hợp lệ.`)
  }
}

export function readAudioTimeline(filePath: string, scenes: Scene[]): AudioTimeline {
  let parsed: unknown
  try {
    parsed = JSON.parse(fs.readFileSync(filePath, 'utf8'))
  } catch (error) {
    throw new Error(
      `Không đọc được Timeline audio: ${error instanceof Error ? error.message : String(error)}`,
    )
  }

  const timeline = parsed as AudioTimeline
  if (!timeline || timeline.version !== 1 || !Array.isArray(timeline.items)) {
    throw new Error('Timeline audio không đúng định dạng hoặc không hỗ trợ version này.')
  }
  if (timeline.items.length !== scenes.length) {
    throw new Error(
      `Timeline có ${timeline.items.length} audio nhưng Excel có ${scenes.length} scene. Hãy ghép lại đúng danh sách audio.`,
    )
  }
  if (!finiteNumber(timeline.totalDurationSeconds) || timeline.totalDurationSeconds <= 0) {
    throw new Error('Tổng thời lượng trong Timeline audio không hợp lệ.')
  }
  if (!finiteNumber(timeline.pauseSeconds) || timeline.pauseSeconds < 0) {
    throw new Error('Khoảng nghỉ trong Timeline audio không hợp lệ.')
  }

  timeline.items.forEach((item, index) => validateItem(item, index, scenes))
  if (Math.abs(timeline.items[0].startSeconds) > TIMELINE_EPSILON_SECONDS) {
    throw new Error('Timeline audio phải bắt đầu từ 0 giây.')
  }

  for (let index = 1; index < timeline.items.length; index += 1) {
    const previous = timeline.items[index - 1]
    const current = timeline.items[index]
    if (Math.abs(current.startSeconds - previous.endSeconds) > TIMELINE_EPSILON_SECONDS) {
      throw new Error(
        `Timeline bị hở hoặc chồng lấn giữa scene ${previous.sceneNumber} và ${current.sceneNumber}.`,
      )
    }
  }

  timeline.items.forEach((item, index) => {
    const isLast = index === timeline.items.length - 1
    const expectedPause = isLast ? 0 : timeline.pauseSeconds
    if (Math.abs(item.pauseAfterSeconds - expectedPause) > TIMELINE_EPSILON_SECONDS) {
      throw new Error(`Khoảng nghỉ của timeline scene ${item.sceneNumber} không nhất quán.`)
    }
    const actualDuration = item.endSeconds - item.startSeconds
    const expectedDuration = item.audioDurationSeconds + item.pauseAfterSeconds
    const allowedDifference = isLast ? 1 : TIMELINE_EPSILON_SECONDS
    if (Math.abs(actualDuration - expectedDuration) > allowedDifference) {
      throw new Error(`Duration của timeline scene ${item.sceneNumber} không khớp audio nguồn.`)
    }
  })

  const lastItem = timeline.items.at(-1)!
  if (
    Math.abs(lastItem.endSeconds - timeline.totalDurationSeconds) >
    TIMELINE_EPSILON_SECONDS
  ) {
    throw new Error('Mốc cuối Timeline không khớp tổng thời lượng merged audio.')
  }
  return timeline
}
