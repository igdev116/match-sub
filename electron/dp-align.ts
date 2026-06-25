import type { SrtEntry } from './types'

export interface Assignment {
  sceneIndex: number
  srtStart: number
  srtEnd: number
  score: number
}

export function normalize(text: unknown): string {
  return String(text)
    .toLocaleLowerCase()
    .replace(/[.,;:!?\-–—[\](){}"“”'‘’「」『』【】、。！？…\d]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function longestMatch(
  a: string,
  alo: number,
  ahi: number,
  b: string,
  blo: number,
  bhi: number,
): [number, number, number] {
  const indexes = new Map<string, number[]>()
  for (let j = blo; j < bhi; j += 1) {
    const values = indexes.get(b[j]) ?? []
    values.push(j)
    indexes.set(b[j], values)
  }

  let bestI = alo
  let bestJ = blo
  let bestSize = 0
  let previous = new Map<number, number>()

  for (let i = alo; i < ahi; i += 1) {
    const current = new Map<number, number>()
    for (const j of indexes.get(a[i]) ?? []) {
      const size = (previous.get(j - 1) ?? 0) + 1
      current.set(j, size)
      if (size > bestSize) {
        bestI = i - size + 1
        bestJ = j - size + 1
        bestSize = size
      }
    }
    previous = current
  }
  return [bestI, bestJ, bestSize]
}

function matchingCharacters(a: string, b: string): number {
  const queue: Array<[number, number, number, number]> = [[0, a.length, 0, b.length]]
  let total = 0
  while (queue.length > 0) {
    const [alo, ahi, blo, bhi] = queue.pop()!
    const [i, j, size] = longestMatch(a, alo, ahi, b, blo, bhi)
    if (size === 0) continue
    total += size
    if (alo < i && blo < j) queue.push([alo, i, blo, j])
    if (i + size < ahi && j + size < bhi) {
      queue.push([i + size, ahi, j + size, bhi])
    }
  }
  return total
}

export function similarity(voText: string, srtTexts: string[]): number {
  const vo = normalize(voText)
  const srt = normalize(srtTexts.join(' '))
  if (!vo || !srt) return 0
  return (2 * matchingCharacters(vo, srt)) / (vo.length + srt.length)
}

export function alignScenesToSrt(
  voTexts: string[],
  srtEntries: SrtEntry[],
  maxPerScene = 5,
): Assignment[] {
  const sceneCount = voTexts.length
  const srtCount = srtEntries.length
  if (sceneCount === 0) throw new Error('Không có scene để alignment.')
  if (srtCount < sceneCount) {
    throw new Error(`SRT chỉ có ${srtCount} entries nhưng có ${sceneCount} scenes.`)
  }
  if (srtCount > sceneCount * maxPerScene) {
    throw new Error(
      `${srtCount} SRT entries vượt giới hạn ${maxPerScene} entries/scene. Hãy kiểm tra lại dữ liệu.`,
    )
  }

  const dp = Array.from({ length: sceneCount + 1 }, () =>
    Array<number>(srtCount + 1).fill(Number.NEGATIVE_INFINITY),
  )
  const backtrack = Array.from({ length: sceneCount + 1 }, () =>
    Array<number>(srtCount + 1).fill(0),
  )
  dp[0][0] = 0

  for (let i = 1; i <= sceneCount; i += 1) {
    const minJ = i
    const maxJ = srtCount - (sceneCount - i)
    for (let j = minJ; j <= maxJ; j += 1) {
      const maxK = Math.min(maxPerScene, j - (i - 1))
      for (let k = 1; k <= maxK; k += 1) {
        const previousJ = j - k
        if (!Number.isFinite(dp[i - 1][previousJ])) continue
        const score =
          dp[i - 1][previousJ] +
          similarity(
            voTexts[i - 1],
            srtEntries.slice(previousJ, j).map((entry) => entry.text),
          )
        if (score > dp[i][j]) {
          dp[i][j] = score
          backtrack[i][j] = k
        }
      }
    }
  }

  if (!Number.isFinite(dp[sceneCount][srtCount])) {
    throw new Error('Không tìm được phương án alignment hợp lệ.')
  }

  const result: Assignment[] = []
  let j = srtCount
  for (let i = sceneCount; i > 0; i -= 1) {
    const count = backtrack[i][j]
    const start = j - count
    result.push({
      sceneIndex: i - 1,
      srtStart: start,
      srtEnd: j,
      score: similarity(
        voTexts[i - 1],
        srtEntries.slice(start, j).map((entry) => entry.text),
      ),
    })
    j = start
  }
  return result.reverse()
}
