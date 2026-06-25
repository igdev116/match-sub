/// <reference types="vite/client" />

import type {
  AudioFileItem,
  AlignmentItem,
  AudioMergeConfig,
  BuildConfig,
  BuildProgress,
  ImagePreviewItem,
  PreviewConfig,
  ProjectDefaults,
  SampleBuildConfig,
  Scene,
  SourceFolderInspection,
  SrtEntry,
  PathInfo,
  WhisperProgress,
  WhisperStatus,
} from '../electron/types'

declare global {
  interface Window {
    videoBuilder: {
      openDirectory: () => Promise<string | null>
      openFile: (extensions: string[]) => Promise<string | null>
      openFiles: (extensions: string[]) => Promise<AudioFileItem[]>
      selectSourceFolder: () => Promise<SourceFolderInspection | null>
      inspectSourceFolder: (folderPath: string) => Promise<SourceFolderInspection>
      getPathInfo: (path: string) => Promise<PathInfo>
      selectSampleImage: () => Promise<string | null>
      getAudioDirectory: () => Promise<{ directory: string; files: AudioFileItem[] }>
      selectAudioDirectory: () => Promise<{ directory: string; files: AudioFileItem[] } | null>
      refreshAudioDirectory: (
        directory: string,
      ) => Promise<{ directory: string; files: AudioFileItem[] }>
      getAudioDurations: (
        paths: string[],
      ) => Promise<{ path: string; durationSeconds: number | null }[]>
      saveFile: (defaultPath?: string) => Promise<string | null>
      saveAudio: (defaultPath?: string) => Promise<string | null>
      showInFolder: (path: string) => Promise<boolean>
      getDefaults: () => Promise<ProjectDefaults>
      checkFFmpeg: () => Promise<{ available: boolean; version?: string }>
      previewExcel: (path: string) => Promise<Scene[]>
      previewSrt: (path: string) => Promise<SrtEntry[]>
      previewImages: (path: string) => Promise<ImagePreviewItem[]>
      getThumbnail: (path: string) => Promise<string>
      previewAlignment: (config: PreviewConfig) => Promise<AlignmentItem[]>
      startBuild: (config: BuildConfig) => Promise<{ success: boolean }>
      buildSampleVideo: (config: SampleBuildConfig) => Promise<string>
      stopBuild: () => Promise<boolean>
      mergeAudio: (config: AudioMergeConfig) => Promise<void>
      getWhisperStatus: () => Promise<WhisperStatus>
      installWhisper: () => Promise<void>
      downloadWhisperModel: () => Promise<void>
      onWhisperProgress: (listener: (progress: WhisperProgress) => void) => () => void
      onBuildProgress: (listener: (progress: BuildProgress) => void) => () => void
    }
  }
}

export {}
