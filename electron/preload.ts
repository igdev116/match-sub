import { contextBridge, ipcRenderer } from 'electron'
import type {
  AudioFileItem,
  AudioMergeConfig,
  BuildConfig,
  BuildProgress,
  PreviewConfig,
  SampleBuildConfig,
  SourceFolderInspection,
  PathInfo,
  WhisperProgress,
} from './types'

contextBridge.exposeInMainWorld('videoBuilder', {
  openDirectory: (): Promise<string | null> => ipcRenderer.invoke('dialog:openDirectory'),
  openFile: (extensions: string[]): Promise<string | null> =>
    ipcRenderer.invoke('dialog:openFile', extensions),
  openFiles: (extensions: string[]): Promise<AudioFileItem[]> =>
    ipcRenderer.invoke('dialog:openFiles', extensions),
  selectSourceFolder: (): Promise<SourceFolderInspection | null> =>
    ipcRenderer.invoke('source:selectFolder'),
  inspectSourceFolder: (folderPath: string): Promise<SourceFolderInspection> =>
    ipcRenderer.invoke('source:inspectFolder', folderPath),
  getPathInfo: (path: string): Promise<PathInfo> =>
    ipcRenderer.invoke('source:getPathInfo', path),
  selectSampleImage: (): Promise<string | null> =>
    ipcRenderer.invoke('dialog:selectSampleImage'),
  getAudioDirectory: () =>
    ipcRenderer.invoke('audio:getDirectory') as Promise<{
      directory: string
      files: AudioFileItem[]
    }>,
  selectAudioDirectory: () =>
    ipcRenderer.invoke('audio:selectDirectory') as Promise<{
      directory: string
      files: AudioFileItem[]
    } | null>,
  refreshAudioDirectory: (directory: string) =>
    ipcRenderer.invoke('audio:refreshDirectory', directory),
  getAudioDurations: (paths: string[]) =>
    ipcRenderer.invoke('audio:getDurations', paths) as Promise<
      { path: string; durationSeconds: number | null }[]
    >,
  saveFile: (defaultPath?: string): Promise<string | null> =>
    ipcRenderer.invoke('dialog:saveFile', defaultPath),
  saveAudio: (defaultPath?: string): Promise<string | null> =>
    ipcRenderer.invoke('dialog:saveAudio', defaultPath),
  showInFolder: (path: string): Promise<boolean> =>
    ipcRenderer.invoke('shell:showInFolder', path),
  getDefaults: () => ipcRenderer.invoke('app:defaults'),
  checkFFmpeg: () => ipcRenderer.invoke('ffmpeg:check'),
  previewExcel: (path: string) => ipcRenderer.invoke('preview:excel', path),
  previewSrt: (path: string) => ipcRenderer.invoke('preview:srt', path),
  previewImages: (path: string) => ipcRenderer.invoke('preview:images', path),
  getThumbnail: (path: string) => ipcRenderer.invoke('preview:thumbnail', path),
  previewAlignment: (config: PreviewConfig) => ipcRenderer.invoke('preview:alignment', config),
  startBuild: (config: BuildConfig) => ipcRenderer.invoke('build:start', config),
  buildSampleVideo: (config: SampleBuildConfig): Promise<string> =>
    ipcRenderer.invoke('build:sample', config),
  stopBuild: () => ipcRenderer.invoke('build:stop'),
  mergeAudio: (config: AudioMergeConfig) => ipcRenderer.invoke('audio:merge', config),
  getWhisperStatus: () => ipcRenderer.invoke('whisper:status'),
  installWhisper: () => ipcRenderer.invoke('whisper:install'),
  downloadWhisperModel: () => ipcRenderer.invoke('whisper:downloadModel'),
  onWhisperProgress: (listener: (progress: WhisperProgress) => void) => {
    const handler = (_event: Electron.IpcRendererEvent, progress: WhisperProgress) =>
      listener(progress)
    ipcRenderer.on('whisper:progress', handler)
    return () => ipcRenderer.removeListener('whisper:progress', handler)
  },
  onBuildProgress: (listener: (progress: BuildProgress) => void) => {
    const handler = (_event: Electron.IpcRendererEvent, progress: BuildProgress) => listener(progress)
    ipcRenderer.on('build:progress', handler)
    return () => ipcRenderer.removeListener('build:progress', handler)
  },
})
