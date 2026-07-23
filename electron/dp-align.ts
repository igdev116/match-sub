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

interface BigramProfile {
  counts: Map<string, number>
  size: number
}

function createBigramProfile(value: string): BigramProfile {
  const counts = new Map<string, number>()
  if (value.length < 2) {
    if (value) counts.set(value, 1)
    return { counts, size: value ? 1 : 0 }
  }

  for (let index = 0; index < value.length - 1; index += 1) {
    const bigram = value.slice(index, index + 2)
    counts.set(bigram, (counts.get(bigram) ?? 0) + 1)
  }
  return { counts, size: value.length - 1 }
}

function fastSimilarity(a: BigramProfile, b: BigramProfile): number {
  if (a.size === 0 || b.size === 0) return 0
  const smaller = a.counts.size <= b.counts.size ? a : b
  const larger = smaller === a ? b : a
  let overlap = 0
  for (const [bigram, count] of smaller.counts) {
    overlap += Math.min(count, larger.counts.get(bigram) ?? 0)
  }
  return (2 * overlap) / (a.size + b.size)
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

  // Candidate groups are reused for every scene. Precomputing these lightweight
  // profiles avoids running the expensive exact matcher tens of thousands of
  // times on the Electron main thread. Exact scores are still calculated for
  // the final assignments below.
  const normalizedScenes = voTexts.map((text) => normalize(text))
  const normalizedEntries = srtEntries.map((entry) => normalize(entry.text))
  const sceneProfiles = normalizedScenes.map(createBigramProfile)
  const candidateProfiles = new Map<string, BigramProfile>()

  function candidateProfile(start: number, end: number): BigramProfile {
    const key = `${start}:${end}`
    const cached = candidateProfiles.get(key)
    if (cached) return cached
    const profile = createBigramProfile(normalizedEntries.slice(start, end).join(' '))
    candidateProfiles.set(key, profile)
    return profile
  }

  for (let i = 1; i <= sceneCount; i += 1) {
    const remainingScenes = sceneCount - i
    const minJ = Math.max(i, srtCount - remainingScenes * maxPerScene)
    const maxJ = Math.min(i * maxPerScene, srtCount - remainingScenes)
    for (let j = minJ; j <= maxJ; j += 1) {
      const maxK = Math.min(maxPerScene, j - (i - 1))
      for (let k = 1; k <= maxK; k += 1) {
        const previousJ = j - k
        if (!Number.isFinite(dp[i - 1][previousJ])) continue
        const score = dp[i - 1][previousJ] + fastSimilarity(
          sceneProfiles[i - 1],
          candidateProfile(previousJ, j),
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
