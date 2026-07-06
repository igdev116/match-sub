import { spawn, type ChildProcess } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import type {
  AlignmentItem,
  AudioMergeConfig,
  BuildConfig,
  BuildProgress,
  SampleBuildConfig,
} from './types'

type ProgressListener = (progress: BuildProgress) => void
type PerformanceSettings = {
  preset: string
  crf: string
  renderFpsMultiplier: 1 | 2
  oversample: number
  scaleFlags: 'bilinear' | 'bicubic' | 'lanczos'
  threads: number
}
type MotionEffect = BuildConfig['motionEffect']

const activeProcesses = new Set<ChildProcess>()
let stopRequested = false

const automaticEffects: MotionEffect[] = [
  'zoom-right',
  'zoom-left',
  'zoom-center',
  'zoom-up',
  'zoom-down',
  'zoom-out',
]
const alternatingTopCornerEffects: MotionEffect[] = ['zoom-top-right', 'zoom-top-left']
const reversedAlternatingTopCornerEffects: MotionEffect[] = ['zoom-top-left', 'zoom-top-right']
const alternatingCornerInOutEffects: MotionEffect[] = [
  'zoom-top-left',
  'zoom-out-top-left',
  'zoom-top-right',
  'zoom-out-top-right',
]

function resolveMotionEffect(config: Pick<BuildConfig, 'motionEffect' | 'motionSequence'>, index: number): MotionEffect {
  const sequence = config.motionSequence?.filter((item) => item.effect)
  const effect = sequence?.length
    ? sequence[index % sequence.length].effect
    : config.motionEffect ?? 'zoom-right'

  if (effect === 'auto') return automaticEffects[index % automaticEffects.length]
  if (effect === 'alternate-top-corners') {
    return alternatingTopCornerEffects[index % alternatingTopCornerEffects.length]
  }
  if (effect === 'alternate-top-corners-reverse') {
    return reversedAlternatingTopCornerEffects[index % reversedAlternatingTopCornerEffects.length]
  }
  if (effect === 'alternate-corner-in-out') {
    return alternatingCornerInOutEffects[index % alternatingCornerInOutEffects.length]
  }
  return effect
}

function run(command: string, args: string[], onLog?: (line: string) => void): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { stdio: ['ignore', 'pipe', 'pipe'] })
    activeProcesses.add(child)
    let stderr = ''

    child.stderr.on('data', (chunk: Buffer) => {
      const text = chunk.toString()
      stderr = `${stderr}${text}`.slice(-12000)
      text
        .split(/\r?\n/)
        .filter(Boolean)
        .forEach((line) => onLog?.(line))
    })
    child.on('error', (error) => {
      activeProcesses.delete(child)
      reject(error)
    })
    child.on('close', (code, signal) => {
      activeProcesses.delete(child)
      if (stopRequested || signal === 'SIGTERM') {
        reject(new Error('BUILD_STOPPED'))
      } else if (code === 0) {
        resolve()
      } else {
        reject(new Error(stderr.trim() || `FFmpeg thoát với mã ${code}.`))
      }
    })
  })
}

export async function checkFFmpeg(): Promise<{ available: boolean; version?: string }> {
  try {
    let version = ''
    await run('ffmpeg', ['-version'], (line) => {
      if (!version) version = line
    })
    return { available: true, version }
  } catch {
    return { available: false }
  }
}

function parseResolution(value: string): [number, number] {
  const match = value.match(/^(\d{2,5})x(\d{2,5})$/)
  if (!match) throw new Error('Resolution phải có định dạng WIDTHxHEIGHT.')
  const width = Number(match[1])
  const height = Number(match[2])
  if (width % 2 !== 0 || height % 2 !== 0) {
    throw new Error('Chiều rộng và chiều cao phải là số chẵn.')
  }
  return [width, height]
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms)
  })
}

function resolvePerformanceSettings(
  width: number,
  height: number,
  performance: BuildConfig['buildPerformance'],
  requestedThreads: number | undefined,
): PerformanceSettings {
  const mode = performance ?? 'cool'
  const threads = Math.max(1, Math.min(16, Math.floor(requestedThreads ?? (mode === 'cool' ? 1 : 2))))
  if (mode === 'quality') {
    return {
      preset: 'fast',
      crf: '20',
      renderFpsMultiplier: 2,
      oversample: Math.max(2, Math.min(4, Math.floor(7680 / Math.max(width, height)))),
      scaleFlags: 'lanczos',
      threads,
    }
  }
  if (mode === 'balanced') {
    return {
      preset: 'veryfast',
      crf: '22',
      renderFpsMultiplier: 2,
      oversample: Math.max(2, Math.min(3, Math.floor(5760 / Math.max(width, height)))),
      scaleFlags: 'bicubic',
      threads,
    }
  }
  return {
    preset: 'veryfast',
    crf: '23',
    renderFpsMultiplier: 2,
    oversample: 2,
    scaleFlags: 'bicubic',
    threads,
  }
}

function sceneArgs(
  item: AlignmentItem,
  output: string,
  width: number,
  height: number,
  fps: number,
  motionEffect: BuildConfig['motionEffect'],
  motionZoomPercent: number,
  motionZoomOutStartPercent: number,
  motionHoldMode: BuildConfig['motionHoldMode'],
  motionHoldPercent: number,
  motionHoldSeconds: number,
  performanceSettings: PerformanceSettings,
): string[] {
  const common = [
    '-t',
    item.duration.toFixed(3),
    '-r',
    String(fps),
    '-c:v',
    'libx264',
    '-preset',
    performanceSettings.preset,
    '-crf',
    performanceSettings.crf,
    '-threads',
    String(performanceSettings.threads),
    '-pix_fmt',
    'yuv420p',
    '-an',
    output,
  ]
  if (!item.imagePath) {
    return [
      '-y',
      '-f',
      'lavfi',
      '-i',
      `color=black:size=${width}x${height}:rate=${fps}`,
      ...common,
    ]
  }
  const staticFilter =
    `scale=${width}:${height}:force_original_aspect_ratio=decrease:flags=${performanceSettings.scaleFlags},` +
    `pad=${width}:${height}:(ow-iw)/2:(oh-ih)/2:black`
  const renderFps = performanceSettings.renderFpsMultiplier === 2 && fps <= 60 ? fps * 2 : fps
  const requestedHoldSeconds =
    motionHoldMode === 'seconds'
      ? motionHoldSeconds
      : item.duration * (motionHoldPercent / 100)
  const effectiveHoldSeconds = Math.max(0, Math.min(item.duration, requestedHoldSeconds))
  const motionFrames = Math.max(
    1,
    Math.round((item.duration - effectiveHoldSeconds) * renderFps),
  )
  const linearProgress = `min(on/${motionFrames}\\,1)`
  const progress =
    `(${linearProgress})*(${linearProgress})*` +
    `(3-2*(${linearProgress}))`
  const zoomAmount = motionZoomPercent / 100
  const zoomOutAmount = motionZoomOutStartPercent / 100
  const zoomIn = `1+${zoomAmount}*${progress}`
  const zoomOut = `${1 + zoomOutAmount}-${zoomOutAmount}*${progress}`

  const motionExpressions: Partial<
    Record<BuildConfig['motionEffect'], { z: string; x: string; y: string }>
  > = {
    'zoom-center': {
      z: zoomIn,
      x: '(iw-iw/zoom)/2',
      y: '(ih-ih/zoom)/2',
    },
    'zoom-right': {
      z: zoomIn,
      x: 'iw-iw/zoom',
      y: '(ih-ih/zoom)/2',
    },
    'zoom-left': {
      z: zoomIn,
      x: '0',
      y: '(ih-ih/zoom)/2',
    },
    'zoom-top-right': {
      z: zoomIn,
      x: 'iw-iw/zoom',
      y: '0',
    },
    'zoom-top-left': {
      z: zoomIn,
      x: '0',
      y: '0',
    },
    'zoom-up': {
      z: zoomIn,
      x: '(iw-iw/zoom)/2',
      y: '0',
    },
    'zoom-down': {
      z: zoomIn,
      x: '(iw-iw/zoom)/2',
      y: 'ih-ih/zoom',
    },
    'zoom-out': {
      z: zoomOut,
      x: '(iw-iw/zoom)/2',
      y: '(ih-ih/zoom)/2',
    },
    'zoom-out-top-left': {
      z: zoomOut,
      x: '0',
      y: '0',
    },
    'zoom-out-top-right': {
      z: zoomOut,
      x: 'iw-iw/zoom',
      y: '0',
    },
  }
  const motion = motionExpressions[motionEffect]
  const oversample = performanceSettings.oversample
  const motionWidth = width * oversample
  const motionHeight = height * oversample
  const motionBaseFilter =
    `scale=${motionWidth}:${motionHeight}:force_original_aspect_ratio=decrease:flags=${performanceSettings.scaleFlags},` +
    `pad=${motionWidth}:${motionHeight}:(ow-iw)/2:(oh-ih)/2:black`
  const videoFilter = motion
    ? `${motionBaseFilter},zoompan=` +
      `z='${motion.z}':x='${motion.x}':y='${motion.y}':` +
      `d=1:s=${width}x${height}:fps=${renderFps},` +
      `${renderFps > fps ? `tmix=frames=2:weights='1 1',fps=${fps},` : ''}` +
      `setsar=1`
    : staticFilter

  return [
    '-y',
    '-loop',
    '1',
    '-i',
    item.imagePath,
    '-vf',
    videoFilter,
    ...common,
  ]
}

export async function buildVideo(
  config: BuildConfig,
  alignment: AlignmentItem[],
  onProgress: ProgressListener,
): Promise<void> {
  if (activeProcesses.size > 0) throw new Error('Một tiến trình build khác đang chạy.')
  stopRequested = false
  const [width, height] = parseResolution(config.resolution)
  if (!Number.isInteger(config.fps) || config.fps < 1 || config.fps > 120) {
    throw new Error('FPS phải là số nguyên từ 1 đến 120.')
  }
  const motionZoomPercent = config.motionZoomPercent ?? 8
  if (
    !Number.isFinite(motionZoomPercent) ||
    motionZoomPercent < 0 ||
    motionZoomPercent > 50
  ) {
    throw new Error('Mức zoom phải từ 0% đến 50%.')
  }
  const motionZoomOutStartPercent = config.motionZoomOutStartPercent ?? 12
  if (
    !Number.isFinite(motionZoomOutStartPercent) ||
    motionZoomOutStartPercent < 0 ||
    motionZoomOutStartPercent > 50
  ) {
    throw new Error('Mức zoom khởi tạo khi thu nhỏ phải từ 0% đến 50%.')
  }
  const motionHoldPercent = config.motionHoldPercent ?? 20
  const motionHoldMode = config.motionHoldMode ?? 'percent'
  if (
    !Number.isFinite(motionHoldPercent) ||
    motionHoldPercent < 0 ||
    motionHoldPercent > 90
  ) {
    throw new Error('Tỷ lệ giữ khung hình cuối phải từ 0% đến 90%.')
  }
  const motionHoldSeconds = config.motionHoldSeconds ?? 2
  if (
    motionHoldMode !== 'percent' &&
    motionHoldMode !== 'seconds'
  ) {
    throw new Error('Kiểu giữ khung hình cuối không hợp lệ.')
  }
  if (
    !Number.isFinite(motionHoldSeconds) ||
    motionHoldSeconds < 0 ||
    motionHoldSeconds > 300
  ) {
    throw new Error('Số giây giữ khung hình cuối phải từ 0 đến 300 giây.')
  }
  const sceneConcurrency = Math.max(1, Math.min(8, Math.floor(config.sceneConcurrency ?? 2)))
  if (!Number.isFinite(sceneConcurrency)) {
    throw new Error('Số scene build song song không hợp lệ.')
  }
  const buildPerformance = config.buildPerformance ?? 'cool'
  if (!['cool', 'balanced', 'quality'].includes(buildPerformance)) {
    throw new Error('Chế độ hiệu năng không hợp lệ.')
  }
  const ffmpegThreads = Math.floor(config.ffmpegThreads ?? (buildPerformance === 'cool' ? 1 : 2))
  if (!Number.isFinite(ffmpegThreads) || ffmpegThreads < 1 || ffmpegThreads > 16) {
    throw new Error('FFmpeg threads phải từ 1 đến 16.')
  }
  const scenePauseMs = Math.floor(config.scenePauseMs ?? (buildPerformance === 'cool' ? 250 : 0))
  if (!Number.isFinite(scenePauseMs) || scenePauseMs < 0 || scenePauseMs > 5000) {
    throw new Error('Thời gian nghỉ giữa scene phải từ 0 đến 5000ms.')
  }
  const performanceSettings = resolvePerformanceSettings(
    width,
    height,
    buildPerformance,
    ffmpegThreads,
  )

  const outputDirectory = path.dirname(config.outputPath)
  fs.mkdirSync(outputDirectory, { recursive: true })
  const clipsDirectory =
    config.mode === 'clips'
      ? path.join(outputDirectory, 'clips')
      : fs.mkdtempSync(path.join(os.tmpdir(), 'video-builder-'))
  fs.mkdirSync(clipsDirectory, { recursive: true })

  try {
    onProgress({
      phase: 'preparing',
      percent: 0,
      completedScenes: 0,
      totalScenes: alignment.length,
      message: 'Đang chuẩn bị dữ liệu...',
    })

    const clipPaths = alignment.map((item) =>
      path.join(clipsDirectory, `${String(item.sceneNumber).padStart(3, '0')}.mp4`),
    )
    let nextIndex = 0
    let completedScenes = 0
    const maxEncodePercent = config.mode === 'full' ? 90 : 100

    async function encodeNextScene(): Promise<void> {
      while (!stopRequested) {
        const index = nextIndex
        nextIndex += 1
        if (index >= alignment.length) return

        const item = alignment[index]
        onProgress({
          phase: 'encoding',
          percent: Math.round((completedScenes / alignment.length) * maxEncodePercent),
          currentScene: item.sceneNumber,
          completedScenes,
          totalScenes: alignment.length,
          message: `Đang xử lý scene ${index + 1}/${alignment.length} (song song ${sceneConcurrency})...`,
        })
        try {
          await run(
            'ffmpeg',
            sceneArgs(
              item,
              clipPaths[index],
              width,
              height,
              config.fps,
              resolveMotionEffect(config, index),
              motionZoomPercent,
              motionZoomOutStartPercent,
              motionHoldMode,
              motionHoldPercent,
              motionHoldSeconds,
              performanceSettings,
            ),
          )
          completedScenes += 1
          if (scenePauseMs > 0 && !stopRequested) {
            await sleep(scenePauseMs)
          }
          onProgress({
            phase: 'encoding',
            percent: Math.round((completedScenes / alignment.length) * maxEncodePercent),
            currentScene: item.sceneNumber,
            completedScenes,
            totalScenes: alignment.length,
            message: `Đã xử lý ${completedScenes}/${alignment.length} scene...`,
          })
        } catch (error) {
          stopRequested = true
          activeProcesses.forEach((process) => process.kill('SIGTERM'))
          throw error
        }
      }
    }
    await Promise.all(
      Array.from({ length: Math.min(sceneConcurrency, alignment.length) }, () => encodeNextScene()),
    )
    if (stopRequested) throw new Error('BUILD_STOPPED')

    if (config.mode === 'full') {
      onProgress({
        phase: 'joining',
        percent: 92,
        completedScenes: alignment.length,
        totalScenes: alignment.length,
        message: 'Đang nối các scene thành video...',
      })
      const concatPath = path.join(clipsDirectory, 'concat.txt')
      const concatContent = clipPaths
        .map((clipPath) => `file '${clipPath.replaceAll("'", "'\\''")}'`)
        .join('\n')
      fs.writeFileSync(concatPath, concatContent, 'utf8')
      await run('ffmpeg', [
        '-y',
        '-f',
        'concat',
        '-safe',
        '0',
        '-i',
        concatPath,
        '-c',
        'copy',
        '-movflags',
        '+faststart',
        config.outputPath,
      ])
    }

    const finalOutput = config.mode === 'full' ? config.outputPath : clipsDirectory
    onProgress({
      phase: 'complete',
      percent: 100,
      completedScenes: alignment.length,
      totalScenes: alignment.length,
      message: 'Build hoàn tất.',
      outputPath: finalOutput,
    })
  } catch (error) {
    const stopped = error instanceof Error && error.message === 'BUILD_STOPPED'
    onProgress({
      phase: stopped ? 'stopped' : 'error',
      percent: 0,
      completedScenes: 0,
      totalScenes: alignment.length,
      message: stopped ? 'Đã dừng build.' : error instanceof Error ? error.message : String(error),
    })
    if (!stopped) throw error
  } finally {
    if (config.mode === 'full') {
      fs.rmSync(clipsDirectory, { recursive: true, force: true })
    }
  }
}

export async function buildSampleVideo(config: SampleBuildConfig): Promise<string> {
  if (activeProcesses.size > 0) throw new Error('Một tiến trình FFmpeg khác đang chạy.')
  if (!config.imagePath || !fs.existsSync(config.imagePath)) {
    throw new Error('Ảnh test không tồn tại.')
  }
  const [width, height] = parseResolution(config.resolution)
  if (!Number.isInteger(config.fps) || config.fps < 1 || config.fps > 120) {
    throw new Error('FPS phải là số nguyên từ 1 đến 120.')
  }
  if (
    !Number.isFinite(config.motionZoomPercent) ||
    config.motionZoomPercent < 0 ||
    config.motionZoomPercent > 50
  ) {
    throw new Error('Mức zoom phải từ 0% đến 50%.')
  }
  const motionZoomOutStartPercent = config.motionZoomOutStartPercent ?? 12
  if (
    !Number.isFinite(motionZoomOutStartPercent) ||
    motionZoomOutStartPercent < 0 ||
    motionZoomOutStartPercent > 50
  ) {
    throw new Error('Mức zoom khởi tạo khi thu nhỏ phải từ 0% đến 50%.')
  }
  if (
    !Number.isFinite(config.motionHoldPercent) ||
    config.motionHoldPercent < 0 ||
    config.motionHoldPercent > 90
  ) {
    throw new Error('Tỷ lệ giữ khung hình cuối phải từ 0% đến 90%.')
  }
  const motionHoldMode = config.motionHoldMode ?? 'percent'
  const motionHoldSeconds = config.motionHoldSeconds ?? 2
  if (
    motionHoldMode !== 'percent' &&
    motionHoldMode !== 'seconds'
  ) {
    throw new Error('Kiểu giữ khung hình cuối không hợp lệ.')
  }
  if (
    !Number.isFinite(motionHoldSeconds) ||
    motionHoldSeconds < 0 ||
    motionHoldSeconds > 300
  ) {
    throw new Error('Số giây giữ khung hình cuối phải từ 0 đến 300 giây.')
  }
  const buildPerformance = config.buildPerformance ?? 'cool'
  if (!['cool', 'balanced', 'quality'].includes(buildPerformance)) {
    throw new Error('Chế độ hiệu năng không hợp lệ.')
  }
  const ffmpegThreads = Math.floor(config.ffmpegThreads ?? (buildPerformance === 'cool' ? 1 : 2))
  if (!Number.isFinite(ffmpegThreads) || ffmpegThreads < 1 || ffmpegThreads > 16) {
    throw new Error('FFmpeg threads phải từ 1 đến 16.')
  }
  const performanceSettings = resolvePerformanceSettings(
    width,
    height,
    buildPerformance,
    ffmpegThreads,
  )

  stopRequested = false
  fs.mkdirSync(path.dirname(config.outputPath), { recursive: true })
  const effect = resolveMotionEffect(config, 0)
  const item: AlignmentItem = {
    sceneNumber: 1,
    sceneContent: 'Motion preview',
    imagePath: config.imagePath,
    start: '00:00:00,000',
    startSeconds: 0,
    duration: 10,
    srtEntries: [],
  }
  await run(
    'ffmpeg',
    sceneArgs(
      item,
      config.outputPath,
      width,
      height,
      config.fps,
      effect,
      config.motionZoomPercent,
      motionZoomOutStartPercent,
      motionHoldMode,
      config.motionHoldPercent,
      motionHoldSeconds,
      performanceSettings,
    ),
  )
  return config.outputPath
}

export function stopBuild(): boolean {
  stopRequested = true
  if (activeProcesses.size === 0) return false
  activeProcesses.forEach((process) => process.kill('SIGTERM'))
  return true
}

export async function mergeAudio(config: AudioMergeConfig): Promise<void> {
  if (activeProcesses.size > 0) throw new Error('Một tiến trình FFmpeg khác đang chạy.')
  if (config.files.length < 2) throw new Error('Cần chọn ít nhất 2 file audio.')
  if (!Number.isFinite(config.pauseSeconds) || config.pauseSeconds < 0 || config.pauseSeconds > 60) {
    throw new Error('Khoảng nghỉ phải từ 0 đến 60 giây.')
  }

  stopRequested = false
  fs.mkdirSync(path.dirname(config.outputPath), { recursive: true })

  const args = ['-y']
  for (const file of config.files) args.push('-i', file)

  const filters: string[] = config.files.map(
    (_, index) =>
      `[${index}:a]aformat=sample_rates=44100:channel_layouts=stereo,aresample=44100[a${index}]`,
  )
  const concatInputs: string[] = []

  if (config.pauseSeconds > 0 && config.files.length > 1) {
    const silenceCount = config.files.length - 1
    const silenceLabel = silenceCount === 1 ? '[s0]' : '[silence]'
    filters.push(
      `anullsrc=r=44100:cl=stereo,atrim=duration=${config.pauseSeconds.toFixed(3)}${silenceLabel}`,
    )
    if (silenceCount > 1) {
      filters.push(`[silence]asplit=${silenceCount}${config.files
        .slice(0, -1)
        .map((_, index) => `[s${index}]`)
        .join('')}`)
    }
  }

  config.files.forEach((_, index) => {
    concatInputs.push(`[a${index}]`)
    if (config.pauseSeconds > 0 && index < config.files.length - 1) {
      concatInputs.push(`[s${index}]`)
    }
  })
  filters.push(`${concatInputs.join('')}concat=n=${concatInputs.length}:v=0:a=1[out]`)

  const extension = path.extname(config.outputPath).toLowerCase()
  const codecArgs =
    extension === '.wav'
      ? ['-c:a', 'pcm_s16le']
      : extension === '.flac'
        ? ['-c:a', 'flac']
        : extension === '.m4a'
          ? ['-c:a', 'aac', '-b:a', '256k']
          : ['-c:a', 'libmp3lame', '-b:a', '256k']

  await run('ffmpeg', [
    ...args,
    '-filter_complex',
    filters.join(';'),
    '-map',
    '[out]',
    ...codecArgs,
    config.outputPath,
  ])
}

export async function convertAudioForWhisper(inputPath: string, outputPath: string): Promise<void> {
  await run('ffmpeg', [
    '-y',
    '-i',
    inputPath,
    '-ar',
    '16000',
    '-ac',
    '1',
    '-c:a',
    'pcm_s16le',
    outputPath,
  ])
}
