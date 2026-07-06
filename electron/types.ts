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
  sourceFolderPath: string
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

export interface ProjectVideoSettings {
  sourceFolderPath: string
  imagesDirectory: string
  sceneListPath: string
  srtPath: string
  outputPath: string
  sampleImagePath: string
  sampleVideoPath: string
  mode: BuildConfig['mode']
  fps: number
  sceneConcurrency: number
  buildPerformance: NonNullable<BuildConfig['buildPerformance']>
  ffmpegThreads: number
  scenePauseMs: number
  resolution: string
  motionEffect: BuildConfig['motionEffect']
  motionSequence: MotionSequenceItem[]
  motionZoomPercent: number
  motionZoomOutStartPercent: number
  motionHoldMode: NonNullable<BuildConfig['motionHoldMode']>
  motionHoldPercent: number
  motionHoldSeconds: number
}

export interface ProjectAudioSettings {
  audioDirectory: string
  audioOutputDirectory: string
  outputPath: string
  srtOutputPath: string
  pauseSeconds: number
  createSrt: boolean
  language: string
  whisperThreads: number
  pageSize: number
}

export interface ProjectVideoShuffleSettings {
  videoDirectory: string
}

export interface AppProject {
  id: string
  name: string
  rootPath: string
  createdAt: string
  updatedAt: string
  videoSettings: ProjectVideoSettings
  audioSettings: ProjectAudioSettings
  videoShuffleSettings: ProjectVideoShuffleSettings
  lastSrtPath: string
}

export interface ProjectState {
  projects: AppProject[]
  activeProjectId: string
  activeProject: AppProject | null
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

export interface AlignmentPreviewResult {
  items: AlignmentItem[]
  warnings: string[]
}

export interface PreviewConfig {
  imagesDirectory: string
  sceneListPath: string
  srtPath: string
}

export interface MotionSequenceItem {
  id: string
  effect: BuildConfig['motionEffect']
}

export interface BuildConfig extends PreviewConfig {
  outputPath: string
  mode: 'full' | 'clips'
  fps: number
  sceneConcurrency?: number
  buildPerformance?: 'cool' | 'balanced' | 'quality'
  ffmpegThreads?: number
  scenePauseMs?: number
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
    | 'zoom-out-top-left'
    | 'zoom-out-top-right'
    | 'alternate-top-corners'
    | 'alternate-top-corners-reverse'
    | 'alternate-corner-in-out'
  motionSequence?: MotionSequenceItem[]
  motionZoomPercent: number
  motionZoomOutStartPercent?: number
  motionHoldMode?: 'percent' | 'seconds'
  motionHoldPercent: number
  motionHoldSeconds?: number
}

export interface SampleBuildConfig {
  imagePath: string
  outputPath: string
  fps: number
  resolution: string
  buildPerformance?: BuildConfig['buildPerformance']
  ffmpegThreads?: number
  motionEffect: BuildConfig['motionEffect']
  motionSequence?: MotionSequenceItem[]
  motionZoomPercent: number
  motionZoomOutStartPercent?: number
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
  srtOutputPath?: string
  createSrt: boolean
  language: string
  whisperThreads: number
}

export interface AudioFileItem {
  path: string
  name: string
  durationSeconds: number | null
}

export interface VideoShuffleFileItem {
  path: string
  name: string
  extension: string
  size: number
}

export interface VideoShuffleRenameItem {
  path: string
  newName: string
}

export interface VideoShuffleRenameResult {
  renamed: number
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
