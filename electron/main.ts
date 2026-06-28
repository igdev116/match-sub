import { app, BrowserWindow, dialog, ipcMain, shell } from 'electron'
import { spawn } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import Store from 'electron-store'
import sharp from 'sharp'
import { createAlignment } from './alignment'
import {
  buildSampleVideo,
  buildVideo,
  checkFFmpeg,
  mergeAudio,
  stopBuild,
} from './ffmpeg'
import { parseSrt } from './srt-parser'
import type {
  AudioMergeConfig,
  AudioFileItem,
  BuildConfig,
  ImagePreviewItem,
  PreviewConfig,
  ProjectDefaults,
  SampleBuildConfig,
  PathInfo,
  SourceFolderInspection,
  AppProject,
  ProjectState,
  ProjectVideoSettings,
  ProjectAudioSettings,
} from './types'
import { readScenes } from './xlsx-reader'
import {
  downloadBaseModel,
  getWhisperStatus,
  installWhisper,
  transcribeToSrt,
} from './whisper'

const currentDirectory = path.dirname(fileURLToPath(import.meta.url))
let mainWindow: BrowserWindow | null = null
let building = false
interface AppPreferences {
  lastSourceFolder: string
  lastAudioDirectory: string
  lastSrtPath: string
  sampleImagePath: string
  activeProjectId: string
  projects: AppProject[]
}
const preferences = new Store<AppPreferences>({
  name: 'preferences',
  defaults: {
    lastSourceFolder: '',
    lastAudioDirectory: '',
    lastSrtPath: '',
    sampleImagePath: '',
    activeProjectId: '',
    projects: [],
  },
})
const imageExtensions = new Set(['.png', '.jpg', '.jpeg', '.webp', '.bmp'])
const thumbnailCache = new Map<string, string>()
const pendingThumbnails = new Map<string, Promise<string>>()
const thumbnailCacheLimit = 300
const audioExtensions = new Set([
  '.mp3',
  '.wav',
  '.m4a',
  '.aac',
  '.flac',
  '.ogg',
  '.opus',
  '.wma',
])

function projectRoot(): string {
  return process.env.VITE_DEV_SERVER_URL ? process.cwd() : app.getAppPath()
}

function nowIso(): string {
  return new Date().toISOString()
}

function makeId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
}

function existingPath(candidate: string): string {
  return fs.existsSync(candidate) ? candidate : ''
}

function fileName(filePath: string): string {
  return path.basename(filePath)
}

function sortByName(a: string, b: string): number {
  return path.basename(a).localeCompare(path.basename(b), undefined, {
    numeric: true,
    sensitivity: 'base',
  })
}

function pathInfo(targetPath: string): PathInfo {
  if (!targetPath) {
    return {
      path: '',
      exists: false,
      kind: 'missing',
      createdAt: null,
      modifiedAt: null,
      error: 'Chưa chọn đường dẫn.',
    }
  }

  try {
    if (!fs.existsSync(targetPath)) {
      return {
        path: targetPath,
        exists: false,
        kind: 'missing',
        createdAt: null,
        modifiedAt: null,
        error: 'Đường dẫn không tồn tại.',
      }
    }
    const stat = fs.statSync(targetPath)
    const createdAt =
      stat.birthtimeMs > 0
        ? stat.birthtime.toISOString()
        : stat.mtime.toISOString()
    return {
      path: targetPath,
      exists: true,
      kind: stat.isDirectory() ? 'directory' : 'file',
      createdAt,
      modifiedAt: stat.mtime.toISOString(),
    }
  } catch (error) {
    return {
      path: targetPath,
      exists: false,
      kind: 'missing',
      createdAt: null,
      modifiedAt: null,
      error: error instanceof Error ? error.message : String(error),
    }
  }
}

function hasImages(directory: string): boolean {
  if (!directory || !fs.existsSync(directory)) return false
  try {
    return fs
      .readdirSync(directory, { withFileTypes: true })
      .some(
        (entry) =>
          entry.isFile() && imageExtensions.has(path.extname(entry.name).toLowerCase()),
      )
  } catch {
    return false
  }
}

function firstExistingPath(candidates: string[]): string {
  return candidates.find((candidate) => fs.existsSync(candidate)) ?? ''
}

function inspectSourceFolder(folderPath: string): SourceFolderInspection {
  const rootInfo = pathInfo(folderPath)
  const errors: SourceFolderInspection['errors'] = {}

  if (!rootInfo.exists || rootInfo.kind !== 'directory') {
    const outputPath = folderPath ? path.join(folderPath, 'output.mp4') : ''
    errors.imagesDirectory = 'Folder nguồn không tồn tại.'
    errors.sceneListPath = 'Folder nguồn không tồn tại.'
    errors.srtPath = 'Folder nguồn không tồn tại.'
    errors.outputPath = 'Folder nguồn không tồn tại.'
    return {
      folderPath,
      imagesDirectory: '',
      sceneListPath: '',
      srtPath: '',
      outputPath,
      infos: {
        imagesDirectory: pathInfo(''),
        sceneListPath: pathInfo(''),
        srtPath: pathInfo(''),
        outputPath: pathInfo(outputPath),
      },
      errors,
    }
  }

  const entries = fs.readdirSync(folderPath, { withFileTypes: true })
  const childDirectories = entries
    .filter((entry) => entry.isDirectory())
    .map((entry) => path.join(folderPath, entry.name))
    .sort(sortByName)
  const files = entries
    .filter((entry) => entry.isFile())
    .map((entry) => path.join(folderPath, entry.name))
    .sort(sortByName)

  const preferredImagesDirectory = firstExistingPath([
    path.join(folderPath, 'grok-images'),
    path.join(folderPath, 'images'),
  ])
  const imagesDirectory =
    preferredImagesDirectory && hasImages(preferredImagesDirectory)
      ? preferredImagesDirectory
      : hasImages(folderPath)
        ? folderPath
        : childDirectories.find(hasImages) ?? ''

  const exactExcel = firstExistingPath([
    path.join(folderPath, 'noi-dung-cac-canh.xlsx'),
    path.join(folderPath, 'noi-dung-cac-canh.xls'),
  ])
  const sceneListPath =
    exactExcel ||
    files.find((filePath) =>
      ['.xlsx', '.xls'].includes(path.extname(filePath).toLowerCase()),
    ) ||
    ''

  const exactSrt = firstExistingPath([path.join(folderPath, 'sub.srt')])
  const srtPath =
    exactSrt ||
    files.find((filePath) => path.extname(filePath).toLowerCase() === '.srt') ||
    ''

  const outputPath = path.join(folderPath, 'output.mp4')
  const outputParentInfo = pathInfo(path.dirname(outputPath))

  if (!imagesDirectory) errors.imagesDirectory = 'Thiếu thư mục ảnh hoặc thư mục không có ảnh.'
  if (!sceneListPath) errors.sceneListPath = 'Thiếu file Excel .xlsx/.xls.'
  if (!srtPath) errors.srtPath = 'Thiếu file SRT.'
  if (!outputParentInfo.exists || outputParentInfo.kind !== 'directory') {
    errors.outputPath = 'Folder cha của output không tồn tại.'
  }

  return {
    folderPath,
    imagesDirectory,
    sceneListPath,
    srtPath,
    outputPath,
    infos: {
      imagesDirectory: pathInfo(imagesDirectory),
      sceneListPath: pathInfo(sceneListPath),
      srtPath: pathInfo(srtPath),
      outputPath: pathInfo(outputPath),
    },
    errors,
  }
}

function defaultVideoSettings(
  rootPath: string,
  inspection?: SourceFolderInspection,
  emptySource = false,
): ProjectVideoSettings {
  const sourceFolderPath = emptySource ? '' : inspection?.folderPath || rootPath
  return {
    sourceFolderPath,
    imagesDirectory: emptySource
      ? ''
      : inspection?.imagesDirectory || existingPath(path.join(rootPath, 'grok-images')),
    sceneListPath: emptySource
      ? ''
      : inspection?.sceneListPath || existingPath(path.join(rootPath, 'noi-dung-cac-canh.xlsx')),
    srtPath: emptySource
      ? ''
      : inspection?.srtPath || existingPath(path.join(rootPath, 'sub.srt')),
    outputPath: inspection?.outputPath || path.join(rootPath, 'output.mp4'),
    sampleImagePath: existingPath(preferences.get('sampleImagePath')),
    sampleVideoPath: path.join(rootPath, 'motion-preview.mp4'),
    mode: 'clips',
    fps: 30,
    sceneConcurrency: 1,
    buildPerformance: 'cool',
    ffmpegThreads: 1,
    scenePauseMs: 250,
    resolution: '1920x1080',
    motionEffect: 'zoom-right',
    motionZoomPercent: 8,
    motionHoldMode: 'percent',
    motionHoldPercent: 20,
    motionHoldSeconds: 2,
  }
}

function defaultAudioSettings(rootPath: string): ProjectAudioSettings {
  return {
    audioDirectory: existingPath(preferences.get('lastAudioDirectory')),
    outputPath: path.join(rootPath, 'merged-audio.mp3'),
    pauseSeconds: 1,
    createSrt: true,
    language: 'auto',
    whisperThreads: 4,
    pageSize: 10,
  }
}

function createProjectFromFolder(folderPath: string, activate = true): AppProject {
  const inspection = inspectSourceFolder(folderPath)
  const timestamp = nowIso()
  const project: AppProject = {
    id: makeId(),
    name: path.basename(folderPath) || 'Dự án mới',
    rootPath: folderPath,
    createdAt: timestamp,
    updatedAt: timestamp,
    videoSettings: defaultVideoSettings(folderPath, inspection),
    audioSettings: defaultAudioSettings(folderPath),
    lastSrtPath: inspection.srtPath,
  }
  const projects = [project, ...preferences.get('projects')]
  preferences.set('projects', projects)
  if (activate) preferences.set('activeProjectId', project.id)
  return project
}

function createEmptyProject(name: string, activate = true): AppProject {
  const root = projectRoot()
  const timestamp = nowIso()
  const project: AppProject = {
    id: makeId(),
    name: name.trim() || 'Dự án mới',
    rootPath: root,
    createdAt: timestamp,
    updatedAt: timestamp,
    videoSettings: defaultVideoSettings(root, undefined, true),
    audioSettings: defaultAudioSettings(root),
    lastSrtPath: '',
  }
  const projects = [project, ...preferences.get('projects')]
  preferences.set('projects', projects)
  if (activate) preferences.set('activeProjectId', project.id)
  return project
}

function ensureProjectsMigrated(): void {
  const projects = preferences.get('projects')
  if (projects.length > 0) return

  const rememberedSourceFolder = existingPath(preferences.get('lastSourceFolder'))
  if (rememberedSourceFolder) {
    createProjectFromFolder(rememberedSourceFolder, true)
    return
  }

  const root = projectRoot()
  const inspection = inspectSourceFolder(root)
  const timestamp = nowIso()
  const project: AppProject = {
    id: makeId(),
    name: path.basename(root) || 'Dự án mặc định',
    rootPath: root,
    createdAt: timestamp,
    updatedAt: timestamp,
    videoSettings: defaultVideoSettings(root, inspection),
    audioSettings: defaultAudioSettings(root),
    lastSrtPath: inspection.srtPath || existingPath(preferences.get('lastSrtPath')),
  }
  preferences.set('projects', [project])
  preferences.set('activeProjectId', project.id)
}

function getProjectState(): ProjectState {
  ensureProjectsMigrated()
  const projects = preferences.get('projects')
  const activeProjectId = preferences.get('activeProjectId')
  const activeProject = projects.find((project) => project.id === activeProjectId) ?? projects[0] ?? null
  if (activeProject && activeProject.id !== activeProjectId) {
    preferences.set('activeProjectId', activeProject.id)
  }
  return {
    projects,
    activeProjectId: activeProject?.id ?? '',
    activeProject,
  }
}

function updateProject(projectId: string, updater: (project: AppProject) => AppProject): AppProject {
  const projects = preferences.get('projects')
  let updatedProject: AppProject | null = null
  const nextProjects = projects.map((project) => {
    if (project.id !== projectId) return project
    updatedProject = updater({ ...project, updatedAt: nowIso() })
    return updatedProject
  })
  if (!updatedProject) throw new Error('Không tìm thấy dự án.')
  preferences.set('projects', nextProjects)
  return updatedProject
}

function updateActiveProject(updater: (project: AppProject) => AppProject): AppProject {
  const state = getProjectState()
  if (!state.activeProject) throw new Error('Chưa chọn dự án.')
  return updateProject(state.activeProject.id, updater)
}

function runCommand(command: string, args: string[]): Promise<{ stdout: string; stderr: string }> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { stdio: ['ignore', 'pipe', 'pipe'] })
    let stdout = ''
    let stderr = ''

    child.stdout.on('data', (chunk: Buffer) => {
      stdout += chunk.toString()
    })
    child.stderr.on('data', (chunk: Buffer) => {
      stderr += chunk.toString()
    })
    child.on('error', reject)
    child.on('close', (code) => {
      if (code === 0) resolve({ stdout, stderr })
      else reject(new Error(stderr.trim() || `Command exited with code ${code}.`))
    })
  })
}

async function getAudioDurationSeconds(filePath: string): Promise<number | null> {
  try {
    const { stdout } = await runCommand('ffprobe', [
      '-v',
      'error',
      '-show_entries',
      'format=duration',
      '-of',
      'default=noprint_wrappers=1:nokey=1',
      filePath,
    ])
    const duration = Number.parseFloat(stdout.trim())
    return Number.isFinite(duration) ? duration : null
  } catch {
    return null
  }
}

async function listAudioFiles(directory: string): Promise<AudioFileItem[]> {
  if (!directory || !fs.existsSync(directory)) return []
  const entries = await fs.promises.readdir(directory, { withFileTypes: true })
  const files = entries
    .filter(
      (entry) =>
        entry.isFile() && audioExtensions.has(path.extname(entry.name).toLowerCase()),
    )
    .map((entry) => path.join(directory, entry.name))
    .sort(sortByName)

  return files.map((filePath) => ({
    path: filePath,
    name: fileName(filePath),
    durationSeconds: null,
  }))
}

function getProjectDefaults(): ProjectDefaults {
  const root = projectRoot()
  const activeProject = getProjectState().activeProject
  if (activeProject) {
    return {
      sourceFolderPath: activeProject.videoSettings.sourceFolderPath,
      imagesDirectory: activeProject.videoSettings.imagesDirectory,
      sceneListPath: activeProject.videoSettings.sceneListPath,
      srtPath: activeProject.videoSettings.srtPath,
      outputPath: activeProject.videoSettings.outputPath,
      sampleImagePath: activeProject.videoSettings.sampleImagePath,
      sampleVideoPath: activeProject.videoSettings.sampleVideoPath,
    }
  }
  const rememberedSourceFolder = existingPath(preferences.get('lastSourceFolder'))
  const rememberedSrtPath = existingPath(preferences.get('lastSrtPath'))
  return {
    sourceFolderPath: rememberedSourceFolder,
    imagesDirectory: rememberedSourceFolder
      ? ''
      : existingPath(path.join(root, 'grok-images')),
    sceneListPath: rememberedSourceFolder
      ? ''
      : existingPath(path.join(root, 'noi-dung-cac-canh.xlsx')),
    srtPath: rememberedSourceFolder
      ? ''
      : rememberedSrtPath || existingPath(path.join(root, 'sub.srt')),
    outputPath: rememberedSourceFolder
      ? path.join(rememberedSourceFolder, 'output.mp4')
      : path.join(root, 'output.mp4'),
    sampleImagePath: existingPath(preferences.get('sampleImagePath')),
    sampleVideoPath: path.join(root, 'motion-preview.mp4'),
  }
}

function previewImages(directory: string): ImagePreviewItem[] {
  if (!fs.existsSync(directory)) throw new Error('Thư mục ảnh không tồn tại.')
  return fs
    .readdirSync(directory)
    .filter((name) => imageExtensions.has(path.extname(name).toLowerCase()))
    .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }))
    .map((name) => {
      const filePath = path.join(directory, name)
      const sceneMatch = path.basename(name, path.extname(name)).match(/^(\d+)/)
      return {
        name,
        path: filePath,
        sceneNumber: sceneMatch ? Number(sceneMatch[1]) : null,
      }
    })
}

async function createThumbnail(filePath: string): Promise<string> {
  try {
    const buffer = await sharp(filePath, { failOn: 'none' })
      .rotate()
      .resize(320, 180, {
        fit: 'cover',
        position: 'attention',
        withoutEnlargement: true,
      })
      .webp({ quality: 72, effort: 2 })
      .toBuffer()
    return `data:image/webp;base64,${buffer.toString('base64')}`
  } catch {
    return ''
  }
}

async function getThumbnail(filePath: string): Promise<string> {
  const cached = thumbnailCache.get(filePath)
  if (cached !== undefined) return cached
  if (!imageExtensions.has(path.extname(filePath).toLowerCase()) || !fs.existsSync(filePath)) {
    return ''
  }

  const pending = pendingThumbnails.get(filePath)
  if (pending) return pending

  const promise = createThumbnail(filePath).then((thumbnail) => {
    if (thumbnailCache.size >= thumbnailCacheLimit) {
      const oldestKey = thumbnailCache.keys().next().value
      if (oldestKey) thumbnailCache.delete(oldestKey)
    }
    thumbnailCache.set(filePath, thumbnail)
    pendingThumbnails.delete(filePath)
    return thumbnail
  })
  pendingThumbnails.set(filePath, promise)
  return promise
}

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1180,
    height: 820,
    minWidth: 920,
    minHeight: 680,
    title: 'Video Builder',
    webPreferences: {
      preload: path.join(currentDirectory, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  })

  if (process.env.VITE_DEV_SERVER_URL) {
    void mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL)
  } else {
    void mainWindow.loadFile(path.join(currentDirectory, '../dist/index.html'))
  }
}

app.whenReady().then(() => {
  ipcMain.handle('project:list', () => getProjectState())

  ipcMain.handle('project:create', (_event, name: string) => {
    createEmptyProject(name, true)
    return getProjectState()
  })

  ipcMain.handle('project:createFromSourceFolder', async () => {
    if (!mainWindow) return getProjectState()
    const result = await dialog.showOpenDialog(mainWindow, { properties: ['openDirectory'] })
    if (!result.canceled && result.filePaths[0]) {
      createProjectFromFolder(result.filePaths[0], true)
    }
    return getProjectState()
  })

  ipcMain.handle('project:select', (_event, projectId: string) => {
    const projects = preferences.get('projects')
    if (!projects.some((project) => project.id === projectId)) {
      throw new Error('Không tìm thấy dự án.')
    }
    preferences.set('activeProjectId', projectId)
    return getProjectState()
  })

  ipcMain.handle('project:rename', (_event, projectId: string, name: string) => {
    updateProject(projectId, (project) => ({ ...project, name: name.trim() || project.name }))
    return getProjectState()
  })

  ipcMain.handle('project:delete', (_event, projectId: string) => {
    const projects = preferences.get('projects').filter((project) => project.id !== projectId)
    preferences.set('projects', projects)
    if (preferences.get('activeProjectId') === projectId) {
      preferences.set('activeProjectId', projects[0]?.id ?? '')
    }
    return getProjectState()
  })

  ipcMain.handle('project:updateVideoSettings', (_event, patch: Partial<ProjectVideoSettings>) => {
    updateActiveProject((project) => ({
      ...project,
      videoSettings: { ...project.videoSettings, ...patch },
      lastSrtPath: patch.srtPath ?? project.lastSrtPath,
    }))
    return getProjectState()
  })

  ipcMain.handle('project:updateAudioSettings', (_event, patch: Partial<ProjectAudioSettings>) => {
    updateActiveProject((project) => ({
      ...project,
      audioSettings: { ...project.audioSettings, ...patch },
    }))
    return getProjectState()
  })

  ipcMain.handle('dialog:openDirectory', async () => {
    if (!mainWindow) return null
    const result = await dialog.showOpenDialog(mainWindow, { properties: ['openDirectory'] })
    return result.canceled ? null : result.filePaths[0]
  })

  ipcMain.handle('source:selectFolder', async () => {
    if (!mainWindow) return null
    const result = await dialog.showOpenDialog(mainWindow, { properties: ['openDirectory'] })
    if (result.canceled || !result.filePaths[0]) return null
    const folderPath = result.filePaths[0]
    preferences.set('lastSourceFolder', folderPath)
    const inspection = inspectSourceFolder(folderPath)
    try {
      updateActiveProject((project) => ({
        ...project,
        rootPath: folderPath,
        videoSettings: {
          ...project.videoSettings,
          sourceFolderPath: inspection.folderPath,
          imagesDirectory: inspection.imagesDirectory,
          sceneListPath: inspection.sceneListPath,
          srtPath: inspection.srtPath,
          outputPath: inspection.outputPath,
        },
        lastSrtPath: inspection.srtPath || project.lastSrtPath,
      }))
    } catch {
      // Source folder can still be inspected before a project exists.
    }
    return inspection
  })

  ipcMain.handle('source:inspectFolder', (_event, folderPath: string) => {
    if (folderPath) preferences.set('lastSourceFolder', folderPath)
    return inspectSourceFolder(folderPath)
  })

  ipcMain.handle('source:getPathInfo', (_event, targetPath: string) => pathInfo(targetPath))

  ipcMain.handle('dialog:openFile', async (_event, extensions: string[]) => {
    if (!mainWindow) return null
    const isSrtPicker = extensions.length === 1 && extensions[0].toLowerCase() === 'srt'
    const result = await dialog.showOpenDialog(mainWindow, {
      defaultPath: isSrtPicker
        ? preferences.get('lastSrtPath') || undefined
        : undefined,
      properties: ['openFile'],
      filters: [{ name: 'Supported files', extensions }],
    })
    if (result.canceled || !result.filePaths[0]) return null
    const filePath = result.filePaths[0]
    if (isSrtPicker) preferences.set('lastSrtPath', filePath)
    if (isSrtPicker) {
      try {
        updateActiveProject((project) => ({
          ...project,
          lastSrtPath: filePath,
          videoSettings: { ...project.videoSettings, srtPath: filePath },
        }))
      } catch {
        // Legacy preference already persisted above.
      }
    }
    return filePath
  })

  ipcMain.handle('dialog:openFiles', async (_event, extensions: string[]) => {
    if (!mainWindow) return []
    const result = await dialog.showOpenDialog(mainWindow, {
      defaultPath: preferences.get('lastAudioDirectory') || undefined,
      properties: ['openFile', 'multiSelections'],
      filters: [{ name: 'Supported files', extensions }],
    })
    if (result.canceled || result.filePaths.length === 0) return []
    preferences.set('lastAudioDirectory', path.dirname(result.filePaths[0]))
    try {
      updateActiveProject((project) => ({
        ...project,
        audioSettings: {
          ...project.audioSettings,
          audioDirectory: path.dirname(result.filePaths[0]),
        },
      }))
    } catch {
      // Legacy preference already persisted above.
    }
    return result.filePaths.map((filePath) => ({
      path: filePath,
      name: fileName(filePath),
      durationSeconds: null,
    }))
  })

  ipcMain.handle('dialog:selectSampleImage', async () => {
    if (!mainWindow) return null
    const rememberedPath = preferences.get('sampleImagePath')
    const result = await dialog.showOpenDialog(mainWindow, {
      defaultPath: rememberedPath || undefined,
      properties: ['openFile'],
      filters: [{ name: 'Image', extensions: ['png', 'jpg', 'jpeg', 'webp', 'bmp'] }],
    })
    if (result.canceled || !result.filePaths[0]) return null
    const filePath = result.filePaths[0]
    preferences.set('sampleImagePath', filePath)
    try {
      updateActiveProject((project) => ({
        ...project,
        videoSettings: { ...project.videoSettings, sampleImagePath: filePath },
      }))
    } catch {
      // Legacy preference already persisted above.
    }
    return filePath
  })

  ipcMain.handle('audio:getDirectory', async () => {
    const directory = getProjectState().activeProject?.audioSettings.audioDirectory ?? preferences.get('lastAudioDirectory')
    return {
      directory,
      files: [],
    }
  })

  ipcMain.handle('audio:selectDirectory', async () => {
    if (!mainWindow) return null
    const result = await dialog.showOpenDialog(mainWindow, {
      defaultPath: preferences.get('lastAudioDirectory') || undefined,
      properties: ['openDirectory'],
    })
    if (result.canceled || !result.filePaths[0]) return null
    const directory = result.filePaths[0]
    preferences.set('lastAudioDirectory', directory)
    try {
      updateActiveProject((project) => ({
        ...project,
        audioSettings: { ...project.audioSettings, audioDirectory: directory },
      }))
    } catch {
      // Legacy preference already persisted above.
    }
    return {
      directory,
      files: [],
    }
  })

  ipcMain.handle('audio:refreshDirectory', async (_event, directory: string) => ({
    directory,
    files: await listAudioFiles(directory),
  }))

  ipcMain.handle('audio:getDurations', async (_event, paths: string[]) =>
    Promise.all(
      paths.map(async (filePath) => ({
        path: filePath,
        durationSeconds: await getAudioDurationSeconds(filePath),
      })),
    ),
  )

  ipcMain.handle('dialog:saveFile', async (_event, defaultPath?: string) => {
    if (!mainWindow) return null
    const result = await dialog.showSaveDialog(mainWindow, {
      defaultPath: defaultPath || getProjectDefaults().outputPath,
      filters: [{ name: 'MP4 video', extensions: ['mp4'] }],
    })
    return result.canceled ? null : result.filePath
  })

  ipcMain.handle('dialog:saveAudio', async (_event, defaultPath?: string) => {
    if (!mainWindow) return null
    const result = await dialog.showSaveDialog(mainWindow, {
      defaultPath: defaultPath || path.join(projectRoot(), 'merged-audio.mp3'),
      filters: [
        { name: 'MP3 audio', extensions: ['mp3'] },
        { name: 'M4A audio', extensions: ['m4a'] },
        { name: 'WAV audio', extensions: ['wav'] },
        { name: 'FLAC audio', extensions: ['flac'] },
      ],
    })
    return result.canceled ? null : result.filePath
  })

  ipcMain.handle('shell:showInFolder', async (_event, targetPath: string) => {
    if (!targetPath) return false
    if (fs.existsSync(targetPath)) {
      shell.showItemInFolder(targetPath)
      return true
    }
    const directory = path.dirname(targetPath)
    if (!fs.existsSync(directory)) return false
    return (await shell.openPath(directory)) === ''
  })

  ipcMain.handle('app:defaults', getProjectDefaults)
  ipcMain.handle('ffmpeg:check', checkFFmpeg)
  ipcMain.handle('preview:excel', (_event, filePath: string) => readScenes(filePath))
  ipcMain.handle('preview:srt', (_event, filePath: string) => parseSrt(filePath))
  ipcMain.handle('preview:images', (_event, directory: string) => previewImages(directory))
  ipcMain.handle('preview:thumbnail', (_event, filePath: string) => getThumbnail(filePath))
  ipcMain.handle('preview:alignment', (_event, config: PreviewConfig) => createAlignment(config))
  ipcMain.handle('build:stop', () => stopBuild())
  ipcMain.handle('build:sample', async (_event, config: SampleBuildConfig) => {
    if (building) throw new Error('Một tiến trình build khác đang chạy.')
    building = true
    try {
      return await buildSampleVideo(config)
    } finally {
      building = false
    }
  })
  ipcMain.handle('whisper:status', getWhisperStatus)
  ipcMain.handle('whisper:install', () =>
    installWhisper((progress) => mainWindow?.webContents.send('whisper:progress', progress)),
  )
  ipcMain.handle('whisper:downloadModel', () =>
    downloadBaseModel((progress) => mainWindow?.webContents.send('whisper:progress', progress)),
  )
  ipcMain.handle('audio:merge', async (_event, config: AudioMergeConfig) => {
    await mergeAudio(config)
    if (config.createSrt) {
      await transcribeToSrt(config, (progress) =>
        mainWindow?.webContents.send('whisper:progress', progress),
      )
    }
  })
  ipcMain.handle('build:start', async (_event, config: BuildConfig) => {
    if (building) throw new Error('Một tiến trình build khác đang chạy.')
    building = true
    try {
      const alignment = createAlignment(config)
      await buildVideo(config, alignment, (progress) => {
        mainWindow?.webContents.send('build:progress', progress)
      })
      return { success: true }
    } finally {
      building = false
    }
  })

  createWindow()
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
