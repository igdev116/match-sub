import { useEffect, useMemo, useRef, useState } from 'react'
import { App } from 'antd'
import type { DragEndEvent } from '@dnd-kit/core'
import { arrayMove } from '@dnd-kit/sortable'
import type { AudioFileItem, WhisperProgress, WhisperStatus } from '../../electron/types'
import {
  isAudioMergeRunning,
  useAudioMergeStore,
  type AudioMergeItem,
} from '../stores/useAudioMergeStore'
import { useProjectStore } from '../stores/useProjectStore'
import { audioOutputPath, cleanError, srtOutputPathFromAudio, directoryFromPath } from '../utils/path'

const emptyItems: AudioMergeItem[] = []

export default function useAudioMergePage() {
  const { message } = App.useApp()
  const [outputPath, setOutputPath] = useState('')
  const [srtOutputPath, setSrtOutputPath] = useState('')
  const [directoryLoading, setDirectoryLoading] = useState(false)
  const durationRequestedPaths = useRef(new Set<string>())
  const activeProject = useProjectStore((state) => state.activeProject)
  const projectId = activeProject?.id ?? ''
  const audioSettings = activeProject?.audioSettings
  const updateAudioSettings = useProjectStore((state) => state.updateAudioSettings)
  const draft = useAudioMergeStore((state) => state.drafts[projectId])
  const job = useAudioMergeStore((state) => state.jobs[projectId])
  const mediaBusy = useAudioMergeStore((state) =>
    Object.values(state.jobs).some(isAudioMergeRunning),
  )
  const ensureDraft = useAudioMergeStore((state) => state.ensureDraft)
  const updateItems = useAudioMergeStore((state) => state.setItems)
  const updateCurrentPage = useAudioMergeStore((state) => state.setCurrentPage)
  const updateAudioDirectory = useAudioMergeStore((state) => state.setAudioDirectory)
  const startMerge = useAudioMergeStore((state) => state.startMerge)
  const dismissJob = useAudioMergeStore((state) => state.dismissJob)
  const items = draft?.items ?? emptyItems
  const currentPage = draft?.currentPage ?? 1
  const audioDirectory = draft?.audioDirectory ?? audioSettings?.audioDirectory ?? ''
  const processing = isAudioMergeRunning(job)
  const audioOutputDirectory = audioSettings?.audioOutputDirectory ?? ''
  const pageSize = audioSettings?.pageSize ?? 10
  const pauseSeconds = audioSettings?.pauseSeconds ?? 1
  const createSrt = audioSettings?.createSrt ?? true
  const language = audioSettings?.language ?? 'auto'
  const whisperThreads = audioSettings?.whisperThreads ?? 4
  const [whisperStatus, setWhisperStatus] = useState<WhisperStatus | null>(null)
  const [whisperSetupProgress, setWhisperSetupProgress] = useState<WhisperProgress | null>(null)
  const [whisperSetupBusy, setWhisperSetupBusy] = useState(false)

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void refreshWhisperStatus()
    }, 300)
    const unsubscribe = window.videoBuilder.onWhisperProgress(setWhisperSetupProgress)
    return () => {
      window.clearTimeout(timer)
      unsubscribe()
    }
  }, [])

  useEffect(() => {
    if (!audioSettings) return
    ensureDraft(projectId, audioSettings.audioDirectory)
    const nextOutputPath =
      audioSettings.outputPath || audioOutputPath(audioSettings.audioOutputDirectory)
    setOutputPath(nextOutputPath)
    setSrtOutputPath(audioSettings.srtOutputPath || srtOutputPathFromAudio(nextOutputPath))
    durationRequestedPaths.current.clear()
  }, [ensureDraft, projectId])

  function setItems(
    updater: AudioMergeItem[] | ((items: AudioMergeItem[]) => AudioMergeItem[]),
  ) {
    if (projectId) updateItems(projectId, updater)
  }

  function setCurrentPage(page: number) {
    if (projectId) updateCurrentPage(projectId, page)
  }

  function setAudioDirectory(directory: string) {
    if (projectId) updateAudioDirectory(projectId, directory)
  }

  function saveAudioSettings(patch: Parameters<typeof updateAudioSettings>[0]) {
    void updateAudioSettings(patch)
  }

  const pauseCount = Math.max(0, items.length - 1)
  const totalPause = useMemo(() => pauseCount * pauseSeconds, [pauseCount, pauseSeconds])
  const pageStart = (currentPage - 1) * pageSize
  const pagedItems = useMemo(
    () => items.slice(pageStart, pageStart + pageSize),
    [items, pageSize, pageStart],
  )
  const missingRequirements = [
    ...new Set(
      [
        items.length < 2 ? 'chọn ít nhất 2 file audio' : '',
        !outputPath ? 'chọn file MP3 output' : '',
        createSrt && !srtOutputPath ? 'chọn file SRT output' : '',
        createSrt && !whisperStatus?.available
          ? whisperStatus?.repairMessage
            ? 'cài lại ứng dụng'
            : 'cài whisper.cpp'
          : '',
        createSrt && !whisperStatus?.modelAvailable
          ? whisperStatus?.repairMessage
            ? 'cài lại ứng dụng'
            : 'tải model base'
          : '',
      ].filter(Boolean),
    ),
  ]

  useEffect(() => {
    const lastPage = Math.max(1, Math.ceil(items.length / pageSize))
    if (currentPage > lastPage) setCurrentPage(lastPage)
  }, [currentPage, items.length, pageSize])

  useEffect(() => {
    const paths = pagedItems
      .filter(
        (item) =>
          item.durationSeconds === null && !durationRequestedPaths.current.has(item.path),
      )
      .map((item) => item.path)
    if (paths.length === 0) return
    paths.forEach((path) => durationRequestedPaths.current.add(path))

    let cancelled = false
    void window.videoBuilder
      .getAudioDurations(paths)
      .then((durations) => {
        if (cancelled) return
        const durationByPath = new Map(
          durations.map((item) => [item.path, item.durationSeconds]),
        )
        setItems((current) =>
          current.map((item) =>
            durationByPath.has(item.path)
              ? { ...item, durationSeconds: durationByPath.get(item.path) ?? null }
              : item,
          ),
        )
      })
      .catch(() => {})

    return () => {
      cancelled = true
    }
  }, [currentPage, pageSize, pagedItems])

  async function refreshWhisperStatus() {
    setWhisperStatus(await window.videoBuilder.getWhisperStatus())
  }

  async function setupWhisper(action: 'install' | 'download') {
    setWhisperSetupBusy(true)
    setWhisperSetupProgress(null)
    try {
      if (action === 'install') await window.videoBuilder.installWhisper()
      else await window.videoBuilder.downloadWhisperModel()
      await refreshWhisperStatus()
      message.success(action === 'install' ? 'Đã cài whisper.cpp.' : 'Đã tải model base.')
    } catch (error) {
      message.error(cleanError(error), 8)
    } finally {
      setWhisperSetupBusy(false)
    }
  }

  async function addFiles() {
    const paths = await window.videoBuilder.openFiles([
      'mp3', 'wav', 'm4a', 'aac', 'flac', 'ogg', 'opus', 'wma',
    ])
    if (paths.length === 0) return
    const firstDirectory = paths[0]?.path.split(/[\\/]/).slice(0, -1).join(paths[0].path.includes('\\') ? '\\' : '/')
    if (firstDirectory) {
      setAudioDirectory(firstDirectory)
      saveAudioSettings({ audioDirectory: firstDirectory })
    }
    setItems((current) => {
      const existing = new Set(current.map((item) => item.path))
      const additions = paths
        .filter((item) => !existing.has(item.path))
        .map((item) => ({
          id: `${item.path}-${crypto.randomUUID()}`,
          path: item.path,
          name: item.name,
          durationSeconds: item.durationSeconds,
        }))
      return [...current, ...additions]
    })
  }

  function createAudioItems(fileItems: AudioFileItem[]): AudioMergeItem[] {
    return fileItems.map((item) => ({
      id: item.path,
      path: item.path,
      name: item.name,
      durationSeconds: item.durationSeconds,
    }))
  }

  async function selectAudioDirectory() {
    const result = await window.videoBuilder.selectAudioDirectory()
    if (!result) return
    setAudioDirectory(result.directory)
    saveAudioSettings({ audioDirectory: result.directory })
    durationRequestedPaths.current.clear()
    setItems([])
    setCurrentPage(1)
    message.info('Đã nhớ thư mục. Bấm "Tải danh sách" để đọc audio.')
  }

  async function refreshAudioDirectory() {
    if (!audioDirectory) return
    setDirectoryLoading(true)
    try {
      const result = await window.videoBuilder.refreshAudioDirectory(audioDirectory)
      durationRequestedPaths.current.clear()
      setItems(createAudioItems(result.files))
      setCurrentPage(1)
      message.success(`Đã đọc ${result.files.length} file audio.`)
    } catch (error) {
      message.error(cleanError(error), 8)
    } finally {
      setDirectoryLoading(false)
    }
  }

  async function chooseOutputPath() {
    const selected = await window.videoBuilder.saveAudio(outputPath || audioOutputPath(audioOutputDirectory))
    if (selected) {
      const nextSrtOutputPath = srtOutputPath || srtOutputPathFromAudio(selected)
      setOutputPath(selected)
      setSrtOutputPath(nextSrtOutputPath)
      saveAudioSettings({
        audioOutputDirectory: directoryFromPath(selected),
        outputPath: selected,
        srtOutputPath: nextSrtOutputPath,
      })
    }
  }

  async function showOutputFolder() {
    if (!outputPath) return
    const opened = await window.videoBuilder.showInFolder(outputPath)
    if (!opened) message.error('Không thể mở thư mục output.')
  }

  async function chooseSrtOutputPath() {
    const selected = await window.videoBuilder.saveSrt(srtOutputPath || srtOutputPathFromAudio(outputPath))
    if (selected) {
      setSrtOutputPath(selected)
      saveAudioSettings({ srtOutputPath: selected })
    }
  }

  async function showSrtOutputFolder() {
    if (!srtOutputPath) return
    const opened = await window.videoBuilder.showInFolder(srtOutputPath)
    if (!opened) message.error('Không thể mở thư mục SRT.')
  }

  function handleDragEnd(event: DragEndEvent) {
    if (!event.over || event.active.id === event.over.id) return
    setItems((current) => {
      const oldIndex = current.findIndex((item) => item.id === event.active.id)
      const newIndex = current.findIndex((item) => item.id === event.over?.id)
      return arrayMove(current, oldIndex, newIndex)
    })
  }

  async function merge() {
    if (items.length < 2) {
      message.warning('Vui lòng chọn ít nhất 2 file audio.')
      return
    }
    if (!outputPath) {
      message.warning('Vui lòng chọn file output.')
      return
    }

    try {
      await startMerge(projectId, {
        files: items.map((item) => item.path),
        pauseSeconds,
        outputPath,
        srtOutputPath,
        createSrt,
        language,
        whisperThreads,
      })
    } catch (error) {
      message.error(cleanError(error), 8)
    }
  }

  return {
    // Audio list
    items,
    pagedItems,
    currentPage,
    pageSize,
    pageStart,
    audioDirectory,
    directoryLoading,
    processing,
    mediaBusy,
    setItems,
    setCurrentPage,
    addFiles,
    selectAudioDirectory,
    refreshAudioDirectory,
    handleDragEnd,

    // Config
    outputPath,
    srtOutputPath,
    pauseSeconds,
    pauseCount,
    totalPause,
    createSrt,
    language,
    whisperThreads,
    whisperStatus,
    whisperSetupProgress,
    whisperSetupBusy,
    saveAudioSettings,
    chooseOutputPath,
    showOutputFolder,
    chooseSrtOutputPath,
    showSrtOutputFolder,
    setupWhisper,

    // Job
    job,
    projectId,
    dismissJob,
    missingRequirements,
    merge,
  }
}
