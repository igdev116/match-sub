export interface SrtEntry {
  start: string
  end: string
  text: string
}

export interface Scene {
  number: number
  content: string
}

export interface ImagePreviewItem {
  name: string
  path: string
  sceneNumber: number | null
}

export interface ProjectDefaults {
  imagesDirectory: string
  sceneListPath: string
  srtPath: string
  outputPath: string
  sampleImagePath: string
  sampleVideoPath: string
}

export interface PathInfo {
  path: string
  exists: boolean
  kind: 'file' | 'directory' | 'missing'
  createdAt: string | null
  modifiedAt: string | null
  error?: string
}

export interface SourceFolderInspection {
  folderPath: string
  imagesDirectory: string
  sceneListPath: string
  srtPath: string
  outputPath: string
  infos: {
    imagesDirectory: PathInfo
    sceneListPath: PathInfo
    srtPath: PathInfo
    outputPath: PathInfo
  }
  errors: {
    imagesDirectory?: string
    sceneListPath?: string
    srtPath?: string
    outputPath?: string
  }
}

export interface AlignmentItem {
  sceneNumber: number
  sceneContent: string
  imagePath: string | null
  start: string
  startSeconds: number
  duration: number
  srtEntries: SrtEntry[]
}

export interface PreviewConfig {
  imagesDirectory: string
  sceneListPath: string
  srtPath: string
}

export interface BuildConfig extends PreviewConfig {
  outputPath: string
  mode: 'full' | 'clips'
  fps: number
  sceneConcurrency?: number
  resolution: string
  motionEffect:
    | 'auto'
    | 'none'
    | 'zoom-center'
    | 'zoom-right'
    | 'zoom-left'
    | 'zoom-top-right'
    | 'zoom-top-left'
    | 'zoom-up'
    | 'zoom-down'
    | 'zoom-out'
    | 'alternate-top-corners'
    | 'alternate-top-corners-reverse'
  motionZoomPercent: number
  motionHoldMode?: 'percent' | 'seconds'
  motionHoldPercent: number
  motionHoldSeconds?: number
}

export interface SampleBuildConfig {
  imagePath: string
  outputPath: string
  fps: number
  resolution: string
  motionEffect: BuildConfig['motionEffect']
  motionZoomPercent: number
  motionHoldMode?: BuildConfig['motionHoldMode']
  motionHoldPercent: number
  motionHoldSeconds?: number
}

export interface BuildProgress {
  phase: 'preparing' | 'encoding' | 'joining' | 'complete' | 'stopped' | 'error'
  percent: number
  currentScene?: number
  completedScenes: number
  totalScenes: number
  message: string
  outputPath?: string
}

export interface AudioMergeConfig {
  files: string[]
  pauseSeconds: number
  outputPath: string
  createSrt: boolean
  language: string
  whisperThreads: number
}

export interface AudioFileItem {
  path: string
  name: string
  durationSeconds: number | null
}

export interface WhisperStatus {
  available: boolean
  executablePath: string
  modelAvailable: boolean
  modelPath: string
  modelSize: number
}

export interface WhisperProgress {
  phase: 'installing' | 'downloading' | 'transcribing' | 'complete' | 'error'
  percent: number
  message: string
}
