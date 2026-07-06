/// <reference types="vite/client" />

import type {
  AudioFileItem,
  AlignmentPreviewResult,
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
  ProjectState,
  ProjectVideoSettings,
  ProjectAudioSettings,
  ProjectVideoShuffleSettings,
  WhisperProgress,
  WhisperStatus,
  VideoShuffleDeleteResult,
  VideoShuffleFileItem,
  VideoShuffleRenameItem,
  VideoShuffleRenameResult,
  VideoShuffleShortFileItem,
} from '../electron/types'

declare global {
  interface Window {
    videoBuilder: {
      getProjectState: () => Promise<ProjectState>
      createProject: (name: string) => Promise<ProjectState>
      createProjectFromSourceFolder: () => Promise<ProjectState>
      selectProject: (projectId: string) => Promise<ProjectState>
      renameProject: (projectId: string, name: string) => Promise<ProjectState>
      deleteProject: (projectId: string) => Promise<ProjectState>
      updateVideoProjectSettings: (patch: Partial<ProjectVideoSettings>) => Promise<ProjectState>
      updateAudioProjectSettings: (patch: Partial<ProjectAudioSettings>) => Promise<ProjectState>
      updateVideoShuffleProjectSettings: (
        patch: Partial<ProjectVideoShuffleSettings>,
      ) => Promise<ProjectState>
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
      saveSrt: (defaultPath?: string) => Promise<string | null>
      selectAudioOutputDirectory: (defaultPath?: string) => Promise<string | null>
      showInFolder: (path: string) => Promise<boolean>
      getDefaults: () => Promise<ProjectDefaults>
      checkFFmpeg: () => Promise<{ available: boolean; version?: string }>
      previewExcel: (path: string) => Promise<Scene[]>
      previewSrt: (path: string) => Promise<SrtEntry[]>
      previewImages: (path: string) => Promise<ImagePreviewItem[]>
      getThumbnail: (path: string) => Promise<string>
      previewAlignment: (config: PreviewConfig) => Promise<AlignmentPreviewResult>
      startBuild: (config: BuildConfig) => Promise<{ success: boolean }>
      buildSampleVideo: (config: SampleBuildConfig) => Promise<string>
      stopBuild: () => Promise<boolean>
      mergeAudio: (config: AudioMergeConfig) => Promise<void>
      selectVideoShuffleDirectory: () => Promise<{
        directory: string
        files: VideoShuffleFileItem[]
      } | null>
      scanVideoShuffleDirectory: (
        directory: string,
      ) => Promise<{ directory: string; files: VideoShuffleFileItem[] }>
      renameVideoShuffleFiles: (
        items: VideoShuffleRenameItem[],
      ) => Promise<VideoShuffleRenameResult>
      scanShortVideoShuffleFiles: (
        directory: string,
        thresholdSeconds: number,
      ) => Promise<{ directory: string; files: VideoShuffleShortFileItem[] }>
      deleteVideoShuffleFiles: (paths: string[]) => Promise<VideoShuffleDeleteResult>
      getWhisperStatus: () => Promise<WhisperStatus>
      installWhisper: () => Promise<void>
      downloadWhisperModel: () => Promise<void>
      onWhisperProgress: (listener: (progress: WhisperProgress) => void) => () => void
      onBuildProgress: (listener: (progress: BuildProgress) => void) => () => void
    }
  }
}

export {}
