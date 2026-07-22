import { useEffect, useMemo, useState } from 'react'
import { App } from 'antd'
import type {
  AlignmentItem,
  BuildConfig,
  BuildProgress as BuildProgressState,
  ImagePreviewItem,
  MotionSequenceItem,
  PathInfo,
  Scene,
  SourceFolderInspection,
  SrtEntry,
} from '../../electron/types'
import type { SourcePreviewData } from '../components/SourcePreview'
import {
  type SourceKey,
  emptyPathInfo,
  expandLegacyMotionSequenceItem,
  hasZoomInMotion,
  hasZoomOutMotion,
  newMotionSequenceItem,
} from '../components/build/constants'
import { useProjectStore } from '../stores/useProjectStore'
import { cleanError, dirname, joinPath } from '../utils/path'

export default function useBuildPage() {
  const { message } = App.useApp()
  const [imagesDirectory, setImagesDirectory] = useState('')
  const [sceneListPath, setSceneListPath] = useState('')
  const [srtPath, setSrtPath] = useState('')
  const [outputPath, setOutputPath] = useState('')
  const [sourceFolder, setSourceFolder] = useState('')
  const [sourceInfos, setSourceInfos] = useState<Record<SourceKey, PathInfo>>({
    imagesDirectory: emptyPathInfo,
    sceneListPath: emptyPathInfo,
    srtPath: emptyPathInfo,
    outputPath: emptyPathInfo,
  })
  const [sourceErrors, setSourceErrors] = useState<Partial<Record<SourceKey, string>>>({})
  const [sourceInspecting, setSourceInspecting] = useState(false)
  const activeProject = useProjectStore((state) => state.activeProject)
  const updateVideoSettings = useProjectStore((state) => state.updateVideoSettings)
  const videoSettings = activeProject?.videoSettings
  const mode = videoSettings?.mode ?? 'clips'
  const fps = videoSettings?.fps ?? 30
  const sceneConcurrency = videoSettings?.sceneConcurrency ?? 1
  const buildPerformance = videoSettings?.buildPerformance ?? 'cool'
  const ffmpegThreads = videoSettings?.ffmpegThreads ?? 1
  const scenePauseMs = videoSettings?.scenePauseMs ?? 250
  const resolution = videoSettings?.resolution ?? '1920x1080'
  const motionEnabled = videoSettings?.motionEnabled ?? true
  const motionEffect = videoSettings?.motionEffect ?? 'zoom-right'
  const motionSequence = useMemo<MotionSequenceItem[]>(
    () => {
      const source = videoSettings?.motionSequence?.length
        ? videoSettings.motionSequence
        : [{ id: 'motion-1', effect: motionEffect }]
      return source.flatMap(expandLegacyMotionSequenceItem)
    },
    [motionEffect, videoSettings?.motionSequence],
  )
  const motionZoomPercent = videoSettings?.motionZoomPercent ?? 8
  const motionZoomOutStartPercent = videoSettings?.motionZoomOutStartPercent ?? 12
  const motionHoldMode = videoSettings?.motionHoldMode ?? 'percent'
  const motionHoldPercent = videoSettings?.motionHoldPercent ?? 20
  const motionHoldSeconds = videoSettings?.motionHoldSeconds ?? 2
  const [sampleImagePath, setSampleImagePath] = useState('')
  const [sampleVideoPath, setSampleVideoPath] = useState('')
  const [sampleBuilding, setSampleBuilding] = useState(false)
  const [ffmpeg, setFfmpeg] = useState<{
    checking: boolean
    available: boolean | null
    repairMessage?: string
  }>({
    checking: true,
    available: null,
  })
  const [previewOpen, setPreviewOpen] = useState(false)
  const [previewLoading, setPreviewLoading] = useState(false)
  const [alignment, setAlignment] = useState<AlignmentItem[]>([])
  const [alignmentWarnings, setAlignmentWarnings] = useState<string[]>([])
  const [progressOpen, setProgressOpen] = useState(false)
  const [progress, setProgress] = useState<BuildProgressState | null>(null)
  const [building, setBuilding] = useState(false)
  const [sourcePreview, setSourcePreview] = useState<SourcePreviewData | null>(null)
  const [sourcePreviewLoading, setSourcePreviewLoading] = useState(false)
  const [motionModalOpen, setMotionModalOpen] = useState(false)
  const [previewMotionEffect, setPreviewMotionEffect] = useState<BuildConfig['motionEffect']>('zoom-top-left')

  function openMotionPreview(eff?: BuildConfig['motionEffect']) {
    setPreviewMotionEffect(eff || motionSequence[0]?.effect || 'zoom-top-left')
    setMotionModalOpen(true)
  }

  useEffect(() => {
    void window.videoBuilder.checkFFmpeg()
      .then((ffmpegResult) =>
        setFfmpeg({
          checking: false,
          available: ffmpegResult.available,
          repairMessage: ffmpegResult.repairMessage,
        }),
      )
      .catch(() =>
        setFfmpeg({
          checking: false,
          available: false,
          repairMessage: 'Không thể kiểm tra FFmpeg.',
        }),
      )
    return window.videoBuilder.onBuildProgress((nextProgress) => {
      setProgress(nextProgress)
      if (['complete', 'stopped', 'error'].includes(nextProgress.phase)) {
        setBuilding(false)
      }
    })
  }, [])

  useEffect(() => {
    if (!videoSettings) return
    setSourceFolder(videoSettings.sourceFolderPath)
    setImagesDirectory(videoSettings.imagesDirectory)
    setSceneListPath(videoSettings.sceneListPath)
    setSrtPath(videoSettings.srtPath)
    setOutputPath(videoSettings.outputPath)
    setSampleImagePath(videoSettings.sampleImagePath)
    setSampleVideoPath(videoSettings.sampleVideoPath)
    void Promise.all([
      window.videoBuilder.getPathInfo(videoSettings.imagesDirectory),
      window.videoBuilder.getPathInfo(videoSettings.sceneListPath),
      window.videoBuilder.getPathInfo(videoSettings.srtPath),
      window.videoBuilder.getPathInfo(videoSettings.outputPath),
    ]).then(([imagesInfo, sceneInfo, srtInfo, outputInfo]) => {
      setSourceInfos({
        imagesDirectory: imagesInfo,
        sceneListPath: sceneInfo,
        srtPath: srtInfo,
        outputPath: outputInfo,
      })
      const nextErrors: Partial<Record<SourceKey, string>> = {}
      const imagesError = validatePath('imagesDirectory', videoSettings.imagesDirectory, imagesInfo)
      const sceneError = validatePath('sceneListPath', videoSettings.sceneListPath, sceneInfo)
      const srtError = validatePath('srtPath', videoSettings.srtPath, srtInfo)
      if (imagesError) nextErrors.imagesDirectory = imagesError
      if (sceneError) nextErrors.sceneListPath = sceneError
      if (srtError) nextErrors.srtPath = srtError
      setSourceErrors(nextErrors)
    })
  }, [activeProject?.id])

  const inputsReady = Boolean(imagesDirectory && sceneListPath && srtPath) &&
    !sourceErrors.imagesDirectory &&
    !sourceErrors.sceneListPath &&
    !sourceErrors.srtPath
  const busy = building || sampleBuilding
  const canBuild =
    inputsReady &&
    Boolean(outputPath) &&
    !sourceErrors.outputPath &&
    ffmpeg.available === true &&
    !busy
  const canBuildSample = Boolean(sampleImagePath) && ffmpeg.available === true && !busy
  const previewConfig = useMemo(
    () => ({ imagesDirectory, sceneListPath, srtPath }),
    [imagesDirectory, sceneListPath, srtPath],
  )
  const outputDisplayPath = mode === 'clips' ? dirname(outputPath) : outputPath
  const motionSequenceHasZoomIn = motionSequence.some((item) => hasZoomInMotion(item.effect))
  const motionSequenceHasZoomOut = motionSequence.some((item) => hasZoomOutMotion(item.effect))
  const motionSequenceAllStill = motionSequence.every((item) => item.effect === 'none')

  function applySourceInspection(
    inspection: SourceFolderInspection,
    options: { preserveOutput?: boolean } = {},
  ) {
    setSourceFolder(inspection.folderPath)
    setImagesDirectory(inspection.imagesDirectory)
    setSceneListPath(inspection.sceneListPath)
    setSrtPath(inspection.srtPath)
    if (!options.preserveOutput) setOutputPath(inspection.outputPath)
    setSourceInfos((current) => ({
      ...inspection.infos,
      outputPath: options.preserveOutput ? current.outputPath : inspection.infos.outputPath,
    }))
    setSourceErrors((current) => {
      if (!options.preserveOutput) return inspection.errors
      const next = { ...inspection.errors }
      if (current.outputPath) next.outputPath = current.outputPath
      return next
    })
  }

  function saveVideoSettings(patch: Parameters<typeof updateVideoSettings>[0]) {
    void updateVideoSettings(patch)
  }

  function saveMotionSequence(nextSequence: MotionSequenceItem[]) {
    const normalized = nextSequence.length > 0 ? nextSequence : [newMotionSequenceItem('zoom-right')]
    saveVideoSettings({
      motionSequence: normalized,
      motionEffect: normalized[0].effect,
    })
  }

  function addMotionSequenceItem() {
    saveMotionSequence([...motionSequence, newMotionSequenceItem(motionSequence.at(-1)?.effect ?? 'zoom-right')])
  }

  function updateMotionSequenceItem(id: string, effect: BuildConfig['motionEffect']) {
    saveMotionSequence(
      motionSequence.map((item) => (item.id === id ? { ...item, effect } : item)),
    )
  }

  function removeMotionSequenceItem(id: string) {
    if (motionSequence.length <= 1) return
    saveMotionSequence(motionSequence.filter((item) => item.id !== id))
  }

  function validatePath(key: SourceKey, value: string, info: PathInfo): string | undefined {
    if (key === 'imagesDirectory') {
      if (!value) return 'Thiếu thư mục ảnh.'
      if (!info.exists || info.kind !== 'directory') return 'Thư mục ảnh không tồn tại.'
      return undefined
    }
    if (key === 'sceneListPath') {
      if (!value) return 'Thiếu file Excel .xlsx/.xls.'
      if (!info.exists || info.kind !== 'file') return 'File Excel không tồn tại.'
      if (!['.xlsx', '.xls'].some((ext) => value.toLowerCase().endsWith(ext))) {
        return 'Scene list phải là file .xlsx/.xls.'
      }
      return undefined
    }
    if (key === 'srtPath') {
      if (!value) return 'Thiếu file SRT.'
      if (!info.exists || info.kind !== 'file') return 'File SRT không tồn tại.'
      if (!value.toLowerCase().endsWith('.srt')) return 'File phụ đề phải là .srt.'
      return undefined
    }
    if (!value) return 'Thiếu đường dẫn output.'
    return undefined
  }

  async function updatePathInfo(key: SourceKey, value: string) {
    const info = await window.videoBuilder.getPathInfo(value)
    setSourceInfos((current) => ({ ...current, [key]: info }))
    setSourceErrors((current) => {
      const next = { ...current }
      const error = validatePath(key, value, info)
      if (error) next[key] = error
      else delete next[key]
      return next
    })
  }

  async function chooseDirectory() {
    const result = await window.videoBuilder.openDirectory()
    if (result) {
      setImagesDirectory(result)
      await updatePathInfo('imagesDirectory', result)
      saveVideoSettings({ imagesDirectory: result })
    }
  }

  async function chooseFile(
    extensions: string[],
    setter: (path: string) => void,
    key: SourceKey,
  ) {
    const result = await window.videoBuilder.openFile(extensions)
    if (result) {
      setter(result)
      await updatePathInfo(key, result)
      saveVideoSettings({ [key]: result })
    }
  }

  async function chooseOutput() {
    if (mode === 'clips') {
      const result = await window.videoBuilder.openDirectory()
      if (result) {
        const nextOutputPath = joinPath(result, 'output.mp4')
        setOutputPath(nextOutputPath)
        await updatePathInfo('outputPath', result)
        saveVideoSettings({ outputPath: nextOutputPath })
      }
      return
    }

    const result = await window.videoBuilder.saveFile(outputPath)
    if (result) {
      setOutputPath(result)
      await updatePathInfo('outputPath', result)
      saveVideoSettings({ outputPath: result })
    }
  }

  async function chooseSourceFolder() {
    setSourceInspecting(true)
    try {
      const result = await window.videoBuilder.selectSourceFolder()
      if (!result) return
      applySourceInspection(result)
      saveVideoSettings({
        sourceFolderPath: result.folderPath,
        imagesDirectory: result.imagesDirectory,
        sceneListPath: result.sceneListPath,
        srtPath: result.srtPath,
        outputPath: result.outputPath,
      })
      const missingCount = Object.keys(result.errors).length
      if (missingCount > 0) {
        message.warning(`Đã đọc folder nguồn, còn thiếu ${missingCount} mục.`)
      } else {
        message.success('Đã tự nhận diện đủ nguồn dữ liệu.')
      }
    } catch (error) {
      message.error(cleanError(error), 6)
    } finally {
      setSourceInspecting(false)
    }
  }

  async function refreshSourceFolder() {
    if (!sourceFolder) {
      message.warning('Chưa chọn folder nguồn.')
      return
    }
    setSourceInspecting(true)
    try {
      const result = await window.videoBuilder.inspectSourceFolder(sourceFolder)
      applySourceInspection(result, { preserveOutput: true })
      saveVideoSettings({
        sourceFolderPath: result.folderPath,
        imagesDirectory: result.imagesDirectory,
        sceneListPath: result.sceneListPath,
        srtPath: result.srtPath,
      })
      const missingCount = Object.keys(result.errors).length
      if (missingCount > 0) {
        message.warning(`Đã làm mới folder nguồn, còn thiếu ${missingCount} mục.`)
      } else {
        message.success('Đã làm mới folder nguồn.')
      }
    } catch (error) {
      message.error(cleanError(error), 6)
    } finally {
      setSourceInspecting(false)
    }
  }

  async function chooseSampleImage() {
    const result = await window.videoBuilder.selectSampleImage()
    if (result) {
      setSampleImagePath(result)
      saveVideoSettings({ sampleImagePath: result })
    }
  }

  function changeBuildPerformance(value: NonNullable<BuildConfig['buildPerformance']>) {
    if (value === 'cool') {
      saveVideoSettings({
        buildPerformance: value,
        ffmpegThreads: 1,
        scenePauseMs: 250,
        sceneConcurrency: 1,
      })
    } else if (value === 'balanced') {
      saveVideoSettings({ buildPerformance: value, ffmpegThreads: 2, scenePauseMs: 100 })
    } else {
      saveVideoSettings({ buildPerformance: value, ffmpegThreads: 2, scenePauseMs: 0 })
    }
  }

  async function loadSourcePreview(kind: 'images' | 'excel' | 'srt') {
    const titles = {
      images: 'Preview thư mục ảnh',
      excel: 'Preview Scene list',
      srt: 'Preview file SRT',
    }
    setSourcePreview({ kind, title: titles[kind], items: [] } as SourcePreviewData)
    setSourcePreviewLoading(true)
    try {
      if (kind === 'images') {
        const items: ImagePreviewItem[] = await window.videoBuilder.previewImages(imagesDirectory)
        setSourcePreview({ kind, title: titles[kind], items })
      } else if (kind === 'excel') {
        const items: Scene[] = await window.videoBuilder.previewExcel(sceneListPath)
        setSourcePreview({ kind, title: titles[kind], items })
      } else {
        const items: SrtEntry[] = await window.videoBuilder.previewSrt(srtPath)
        setSourcePreview({ kind, title: titles[kind], items })
      }
    } catch (error) {
      setSourcePreview(null)
      message.error(cleanError(error), 6)
    } finally {
      setSourcePreviewLoading(false)
    }
  }

  async function preview() {
    if (!inputsReady) {
      message.warning('Vui lòng chọn thư mục ảnh, file Excel và file SRT.')
      return
    }
    setPreviewOpen(true)
    setPreviewLoading(true)
    try {
      const result = await window.videoBuilder.previewAlignment(previewConfig)
      setAlignment(result.items)
      setAlignmentWarnings(result.warnings)
    } catch (error) {
      setPreviewOpen(false)
      setAlignmentWarnings([])
      message.error(cleanError(error), 6)
    } finally {
      setPreviewLoading(false)
    }
  }

  async function startBuild() {
    if (!canBuild) return
    const config: BuildConfig = {
      ...previewConfig,
      outputPath,
      mode,
      fps,
      sceneConcurrency,
      buildPerformance,
      ffmpegThreads,
      scenePauseMs,
      resolution,
      motionEnabled,
      motionEffect,
      motionSequence,
      motionZoomPercent,
      motionZoomOutStartPercent,
      motionHoldMode,
      motionHoldPercent,
      motionHoldSeconds,
    }
    setBuilding(true)
    setProgress(null)
    setProgressOpen(true)
    try {
      await window.videoBuilder.startBuild(config)
    } catch (error) {
      setBuilding(false)
      setProgress({
        phase: 'error',
        percent: 0,
        completedScenes: 0,
        totalScenes: 0,
        message: cleanError(error),
      })
    }
  }

  async function startSampleBuild() {
    if (!canBuildSample) return
    setSampleBuilding(true)
    try {
      const result = await window.videoBuilder.buildSampleVideo({
        imagePath: sampleImagePath,
        outputPath: sampleVideoPath,
        fps,
        resolution,
        buildPerformance,
        ffmpegThreads,
        motionEnabled,
        motionEffect,
        motionSequence,
        motionZoomPercent,
        motionZoomOutStartPercent,
        motionHoldMode,
        motionHoldPercent,
        motionHoldSeconds,
      })
      setSampleVideoPath(result)
      saveVideoSettings({ sampleVideoPath: result })
      message.success('Đã build video test 10 giây.')
      await window.videoBuilder.showInFolder(result)
    } catch (error) {
      message.error(cleanError(error), 6)
    } finally {
      setSampleBuilding(false)
    }
  }

  return {
    // Source data
    imagesDirectory,
    sceneListPath,
    srtPath,
    outputPath,
    outputDisplayPath,
    sourceFolder,
    sourceInfos,
    sourceErrors,
    sourceInspecting,
    mode,
    busy,
    inputsReady,
    canBuild,
    canBuildSample,
    setSceneListPath,
    setSrtPath,
    chooseDirectory,
    chooseFile,
    chooseOutput,
    chooseSourceFolder,
    refreshSourceFolder,
    loadSourcePreview,

    // Video settings
    fps,
    sceneConcurrency,
    buildPerformance,
    ffmpegThreads,
    resolution,
    motionEnabled,
    motionEffect,
    motionSequence,
    motionZoomPercent,
    motionZoomOutStartPercent,
    motionHoldMode,
    motionHoldPercent,
    motionHoldSeconds,
    motionSequenceHasZoomIn,
    motionSequenceHasZoomOut,
    motionSequenceAllStill,
    sampleImagePath,
    sampleVideoPath,
    sampleBuilding,
    saveVideoSettings,
    addMotionSequenceItem,
    updateMotionSequenceItem,
    removeMotionSequenceItem,
    openMotionPreview,
    changeBuildPerformance,
    chooseSampleImage,
    startSampleBuild,

    // FFmpeg
    ffmpeg,

    // Preview & Build
    previewOpen,
    setPreviewOpen,
    previewLoading,
    alignment,
    alignmentWarnings,
    progressOpen,
    setProgressOpen,
    progress,
    building,
    sourcePreview,
    setSourcePreview,
    sourcePreviewLoading,
    motionModalOpen,
    setMotionModalOpen,
    previewMotionEffect,
    setPreviewMotionEffect,
    preview,
    startBuild,
  }
}
