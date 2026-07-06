import { useEffect, useMemo, useState } from 'react'
import dayjs from 'dayjs'
import relativeTime from 'dayjs/plugin/relativeTime'
import 'dayjs/locale/vi'
import {
  App,
  Button,
  Card,
  InputNumber,
  Radio,
  Select,
  Space,
  Typography,
} from 'antd'
import {
  DeleteOutlined,
  FileExcelOutlined,
  FileTextOutlined,
  FolderOpenOutlined,
  PictureOutlined,
  PlayCircleOutlined,
  PlusOutlined,
  ReloadOutlined,
  SaveOutlined,
  ScanOutlined,
  VideoCameraAddOutlined,
} from '@ant-design/icons'
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
import AlignmentPreview from '../components/AlignmentPreview'
import BuildProgress from '../components/BuildProgress'
import FileSelector from '../components/FileSelector'
import SourcePreview, {
  type SourcePreviewData,
} from '../components/SourcePreview'
import { useProjectStore } from '../stores/useProjectStore'

const RESOLUTIONS = ['1920x1080', '1280x720', '1080x1920', '3840x2160']
const MOTION_EFFECTS_WITH_ZOOM_OUT: BuildConfig['motionEffect'][] = [
  'auto',
  'zoom-out',
  'zoom-out-top-left',
  'zoom-out-top-right',
  'alternate-corner-in-out',
]
const LEGACY_AUTOMATIC_MOTION_EFFECTS: BuildConfig['motionEffect'][] = [
  'zoom-right',
  'zoom-left',
  'zoom-center',
  'zoom-up',
  'zoom-down',
  'zoom-out',
]
const LEGACY_ALTERNATE_TOP_CORNER_EFFECTS: BuildConfig['motionEffect'][] = [
  'zoom-top-right',
  'zoom-top-left',
]
const LEGACY_ALTERNATE_TOP_CORNER_REVERSE_EFFECTS: BuildConfig['motionEffect'][] = [
  'zoom-top-left',
  'zoom-top-right',
]
const LEGACY_ALTERNATE_CORNER_IN_OUT_EFFECTS: BuildConfig['motionEffect'][] = [
  'zoom-top-left',
  'zoom-out-top-left',
  'zoom-top-right',
  'zoom-out-top-right',
]
const MOTION_EFFECT_OPTIONS: { value: BuildConfig['motionEffect']; label: string }[] = [
  { value: 'zoom-top-left', label: 'Zoom vào góc trái trên' },
  { value: 'zoom-top-right', label: 'Zoom vào góc phải trên' },
  { value: 'zoom-out-top-left', label: 'Zoom từ trong ra — góc trái trên' },
  { value: 'zoom-out-top-right', label: 'Zoom từ trong ra — góc phải trên' },
  { value: 'zoom-right', label: 'Zoom vào bên phải' },
  { value: 'zoom-left', label: 'Zoom vào bên trái' },
  { value: 'zoom-center', label: 'Zoom vào chính giữa' },
  { value: 'zoom-up', label: 'Zoom lên phía trên' },
  { value: 'zoom-down', label: 'Zoom xuống phía dưới' },
  { value: 'zoom-out', label: 'Thu nhỏ dần từ giữa' },
  { value: 'none', label: 'Đứng yên' },
]

dayjs.extend(relativeTime)
dayjs.locale('vi')

type SourceKey = 'imagesDirectory' | 'sceneListPath' | 'srtPath' | 'outputPath'

const emptyPathInfo: PathInfo = {
  path: '',
  exists: false,
  kind: 'missing',
  createdAt: null,
  modifiedAt: null,
}

function formatPathMeta(info?: PathInfo): string {
  if (!info?.exists) return ''
  const timestamp = info.modifiedAt || info.createdAt
  if (!timestamp) return ''
  return `Cập nhật: ${dayjs(timestamp).format('DD/MM/YYYY HH:mm')} (${dayjs(timestamp).fromNow()})`
}

function dirname(filePath: string): string {
  const normalized = filePath.replace(/[\\/]+$/, '')
  const separatorIndex = Math.max(normalized.lastIndexOf('/'), normalized.lastIndexOf('\\'))
  return separatorIndex >= 0 ? normalized.slice(0, separatorIndex) : ''
}

function joinPath(directory: string, filename: string): string {
  if (!directory) return filename
  const separator = directory.includes('\\') ? '\\' : '/'
  return `${directory.replace(/[\\/]+$/, '')}${separator}${filename}`
}

function hasZoomOutMotion(effect: BuildConfig['motionEffect']): boolean {
  return MOTION_EFFECTS_WITH_ZOOM_OUT.includes(effect)
}

function newMotionSequenceItem(effect: BuildConfig['motionEffect']): MotionSequenceItem {
  return {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    effect,
  }
}

function expandLegacyMotionSequenceItem(item: MotionSequenceItem): MotionSequenceItem[] {
  const effectGroups: Partial<Record<BuildConfig['motionEffect'], BuildConfig['motionEffect'][]>> = {
    auto: LEGACY_AUTOMATIC_MOTION_EFFECTS,
    'alternate-top-corners': LEGACY_ALTERNATE_TOP_CORNER_EFFECTS,
    'alternate-top-corners-reverse': LEGACY_ALTERNATE_TOP_CORNER_REVERSE_EFFECTS,
    'alternate-corner-in-out': LEGACY_ALTERNATE_CORNER_IN_OUT_EFFECTS,
  }
  const effects = effectGroups[item.effect]
  if (!effects) return [item]
  return effects.map((effect, index) => ({
    id: `${item.id}-${index}`,
    effect,
  }))
}

export default function BuildPage() {
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
  const [ffmpeg, setFfmpeg] = useState<{ checking: boolean; available: boolean | null }>({
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

  useEffect(() => {
    void window.videoBuilder.checkFFmpeg()
      .then((ffmpegResult) => setFfmpeg({ checking: false, available: ffmpegResult.available }))
      .catch(() => setFfmpeg({ checking: false, available: false }))
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

  function cleanError(error: unknown): string {
    const text = error instanceof Error ? error.message : String(error)
    return text.replace(/^Error invoking remote method '[^']+': Error: /, '')
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

  return (
    <>
      <main className="mx-auto max-w-5xl space-y-5 pb-10">
        <div className="space-y-5">
          <Card
            className="shadow-sm"
            title="Nguồn dữ liệu"
            extra={
              <Space>
                <Button
                  icon={<ReloadOutlined />}
                  loading={sourceInspecting}
                  disabled={busy || !sourceFolder}
                  onClick={() => void refreshSourceFolder()}
                >
                  Làm mới
                </Button>
                <Button
                  icon={<FolderOpenOutlined />}
                  loading={sourceInspecting}
                  disabled={busy}
                  onClick={() => void chooseSourceFolder()}
                >
                  Chọn folder nguồn
                </Button>
              </Space>
            }
          >
            <div className="space-y-4">
              {sourceFolder && (
                <div className="rounded-lg bg-slate-50 px-4 py-3">
                  <Typography.Text type="secondary">Folder nguồn:</Typography.Text>{' '}
                  <Typography.Text copyable>{sourceFolder}</Typography.Text>
                </div>
              )}
              <FileSelector
                label="Thư mục ảnh"
                value={imagesDirectory}
                placeholder="Chọn thư mục chứa ảnh scene"
                icon={<FolderOpenOutlined className="text-violet-600" />}
                buttonLabel="Chọn thư mục"
                onSelect={chooseDirectory}
                onPreview={() => void loadSourcePreview('images')}
                disabled={busy}
                status={sourceErrors.imagesDirectory ? 'error' : undefined}
                error={sourceErrors.imagesDirectory}
                metaText={formatPathMeta(sourceInfos.imagesDirectory)}
              />
              <FileSelector
                label="Scene list"
                value={sceneListPath}
                placeholder="Chọn file Excel có cột STT và Nội dung"
                icon={<FileExcelOutlined className="text-emerald-600" />}
                buttonLabel="Chọn file"
                onSelect={() => chooseFile(['xlsx', 'xls'], setSceneListPath, 'sceneListPath')}
                onPreview={() => void loadSourcePreview('excel')}
                disabled={busy}
                status={sourceErrors.sceneListPath ? 'error' : undefined}
                error={sourceErrors.sceneListPath}
                metaText={formatPathMeta(sourceInfos.sceneListPath)}
              />
              <FileSelector
                label="File SRT"
                value={srtPath}
                placeholder="Chọn file phụ đề .srt"
                icon={<FileTextOutlined className="text-blue-600" />}
                buttonLabel="Chọn file"
                onSelect={() => chooseFile(['srt'], setSrtPath, 'srtPath')}
                onPreview={() => void loadSourcePreview('srt')}
                disabled={busy}
                status={sourceErrors.srtPath ? 'error' : undefined}
                error={sourceErrors.srtPath}
                metaText={formatPathMeta(sourceInfos.srtPath)}
              />
              <FileSelector
                label={mode === 'clips' ? 'Thư mục lưu clips' : 'Output'}
                value={outputDisplayPath}
                placeholder={mode === 'clips' ? 'Chọn folder để lưu nhiều video' : 'Chọn nơi lưu output.mp4'}
                icon={
                  mode === 'clips'
                    ? <FolderOpenOutlined className="text-amber-600" />
                    : <SaveOutlined className="text-amber-600" />
                }
                buttonLabel={mode === 'clips' ? 'Chọn folder' : 'Chọn nơi lưu'}
                onSelect={chooseOutput}
                disabled={busy}
                status={sourceErrors.outputPath ? 'error' : undefined}
                error={sourceErrors.outputPath}
                metaText={formatPathMeta(sourceInfos.outputPath)}
              />
            </div>
          </Card>

          <Card className="shadow-sm" title="Thiết lập video">
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              <div>
                <Typography.Text strong>Chế độ</Typography.Text>
                <Radio.Group
                  className="mt-3 block"
                  value={mode}
                  onChange={(event) => saveVideoSettings({ mode: event.target.value })}
                  disabled={busy}
                >
                  <Space direction="vertical">
                    <Radio value="full">Full video</Radio>
                    <Radio value="clips">Clips riêng</Radio>
                  </Space>
                </Radio.Group>
              </div>
              <div>
                <Typography.Text strong>FPS</Typography.Text>
                <InputNumber
                  className="mt-3 !w-full"
                  min={1}
                  max={120}
                  value={fps}
                  onChange={(value) => saveVideoSettings({ fps: value ?? 30 })}
                  disabled={busy}
                />
              </div>
              <div>
                <Typography.Text strong>Scene build song song</Typography.Text>
                <InputNumber
                  className="mt-3 !w-full"
                  min={1}
                  max={8}
                  step={1}
                  precision={0}
                  value={sceneConcurrency}
                  onChange={(value) => saveVideoSettings({ sceneConcurrency: value ?? 1 })}
                  disabled={busy}
                />
                <Typography.Text className="mt-2 block" type="secondary">
                  Mặc định 2. Tăng lên 3–4 nếu máy khỏe; quá cao dễ làm lag.
                </Typography.Text>
              </div>
              <div>
                <Typography.Text strong>Chế độ hiệu năng</Typography.Text>
                <Select
                  className="mt-3 w-full"
                  value={buildPerformance}
                  options={[
                    { value: 'cool', label: 'Mát máy / ít lag' },
                    { value: 'balanced', label: 'Cân bằng' },
                    { value: 'quality', label: 'Chất lượng cao' },
                  ]}
                  onChange={changeBuildPerformance}
                  disabled={busy}
                />
                <Typography.Text className="mt-2 block" type="secondary">
                  Mát máy sẽ giảm oversample, không nhân đôi render FPS và encode nhẹ hơn.
                </Typography.Text>
              </div>
              <div>
                <Typography.Text strong>FFmpeg threads</Typography.Text>
                <InputNumber
                  className="mt-3 !w-full"
                  min={1}
                  max={16}
                  step={1}
                  precision={0}
                  value={ffmpegThreads}
                  onChange={(value) => saveVideoSettings({ ffmpegThreads: value ?? 1 })}
                  disabled={busy}
                />
                <Typography.Text className="mt-2 block" type="secondary">
                  Giữ 1–2 để đỡ nóng máy. Đây là thread bên trong mỗi FFmpeg.
                </Typography.Text>
              </div>
              <div>
                <Typography.Text strong>Nghỉ giữa scene</Typography.Text>
                <InputNumber
                  className="mt-3 !w-full"
                  min={0}
                  max={5000}
                  step={100}
                  precision={0}
                  addonAfter="ms"
                  value={scenePauseMs}
                  onChange={(value) => saveVideoSettings({ scenePauseMs: value ?? 0 })}
                  disabled={busy}
                />
                <Typography.Text className="mt-2 block" type="secondary">
                  250–500ms giúp máy có nhịp hạ tải, đổi lại build lâu hơn.
                </Typography.Text>
              </div>
              <div>
                <Typography.Text strong>Resolution</Typography.Text>
                <Select
                  className="mt-3 w-full"
                  value={resolution}
                  options={RESOLUTIONS.map((value) => ({ value, label: value }))}
                  onChange={(value) => saveVideoSettings({ resolution: value })}
                  disabled={busy}
                />
              </div>
            </div>
            <div className="mt-6 rounded-2xl border border-slate-200 bg-slate-50/70 p-5">
              <div className="mb-4">
                <Typography.Text strong>Chuyển động ảnh</Typography.Text>
                <Typography.Text className="mt-1 block" type="secondary">
                  Chọn preset chuyển động, rồi chỉnh riêng mức zoom vào và mức bắt đầu khi zoom từ trong ra.
                </Typography.Text>
              </div>
              <div className="grid gap-5 md:grid-cols-2">
                <div className="md:col-span-2">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <Typography.Text strong>Danh sách chuyển động</Typography.Text>
                      <Typography.Text className="mt-1 block" type="secondary">
                        Nếu có 2 chuyển động thì video 1 dùng dòng 1, video 2 dùng dòng 2, video 3 quay lại dòng 1.
                      </Typography.Text>
                    </div>
                    <Button
                      icon={<PlusOutlined />}
                      disabled={busy}
                      onClick={addMotionSequenceItem}
                    >
                      Thêm chuyển động
                    </Button>
                  </div>
                  <div className="mt-3 space-y-3">
                    {motionSequence.map((item, index) => (
                      <div
                        key={item.id}
                        className="grid gap-3 rounded-xl border border-slate-200 bg-white p-3 md:grid-cols-[100px_1fr_auto]"
                      >
                        <div className="flex items-center">
                          <Typography.Text strong>Video {index + 1}</Typography.Text>
                        </div>
                        <Select
                          className="w-full"
                          value={item.effect}
                          options={MOTION_EFFECT_OPTIONS}
                          onChange={(value) => updateMotionSequenceItem(item.id, value)}
                          disabled={busy}
                        />
                        <Button
                          danger
                          icon={<DeleteOutlined />}
                          disabled={busy || motionSequence.length <= 1}
                          onClick={() => removeMotionSequenceItem(item.id)}
                        >
                          Xoá
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>
                <div>
                  <Typography.Text strong>Zoom vào tối đa</Typography.Text>
                  <InputNumber
                    className="mt-3 !w-full"
                    min={0}
                    max={50}
                    step={1}
                    precision={1}
                    addonAfter="%"
                    value={motionZoomPercent}
                    onChange={(value) => saveVideoSettings({ motionZoomPercent: value ?? 8 })}
                    disabled={busy || motionSequenceAllStill}
                  />
                  <Typography.Text className="mt-2 block" type="secondary">
                    Dùng cho các preset zoom vào: 100% → {(100 + motionZoomPercent).toFixed(1)}%.
                  </Typography.Text>
                </div>
                <div>
                  <Typography.Text strong>Zoom từ trong ra - mức bắt đầu</Typography.Text>
                  <InputNumber
                    className="mt-3 !w-full"
                    min={0}
                    max={50}
                    step={1}
                    precision={1}
                    addonAfter="%"
                    value={motionZoomOutStartPercent}
                    onChange={(value) => saveVideoSettings({ motionZoomOutStartPercent: value ?? 12 })}
                    disabled={busy || !motionSequenceHasZoomOut}
                  />
                  <Typography.Text className="mt-2 block" type="secondary">
                    Dùng cho zoom từ trong ra: {(100 + motionZoomOutStartPercent).toFixed(1)}% → 100%.
                  </Typography.Text>
                </div>
                <div className="md:col-span-2">
                  <Typography.Text strong>Giữ khung hình cuối</Typography.Text>
                  <div>
                    <Radio.Group
                      className="mt-3"
                      value={motionHoldMode}
                      onChange={(event) => saveVideoSettings({ motionHoldMode: event.target.value })}
                      disabled={busy || motionSequenceAllStill}
                    >
                      <Radio value="percent">Theo % scene</Radio>
                      <Radio value="seconds">Số giây cố định</Radio>
                    </Radio.Group>
                  </div>
                  {motionHoldMode === 'seconds' ? (
                    <InputNumber
                      className="mt-3 !w-full"
                      min={0}
                      max={300}
                      step={0.5}
                      precision={2}
                      addonAfter="giây"
                      value={motionHoldSeconds}
                      onChange={(value) => saveVideoSettings({ motionHoldSeconds: value ?? 2 })}
                      disabled={busy || motionSequenceAllStill}
                    />
                  ) : (
                    <InputNumber
                      className="mt-3 !w-full"
                      min={0}
                      max={90}
                      step={5}
                      precision={1}
                      addonAfter="%"
                      value={motionHoldPercent}
                      onChange={(value) => saveVideoSettings({ motionHoldPercent: value ?? 20 })}
                      disabled={busy || motionSequenceAllStill}
                    />
                  )}
                  <Typography.Text className="mt-2 block" type="secondary">
                    {motionHoldMode === 'seconds'
                      ? `Giữ cố định ${motionHoldSeconds}s cuối scene. Nếu scene ngắn hơn thì tự clamp theo duration scene.`
                      : `${motionHoldPercent}% cuối scene đứng yên; scene 10 giây tương đương ${(10 * motionHoldPercent / 100).toFixed(1)} giây.`}
                  </Typography.Text>
                </div>
              </div>
            </div>
            <div className="mt-6 border-t border-slate-200 pt-5">
              <FileSelector
                label="Ảnh test hiệu ứng"
                value={sampleImagePath}
                placeholder="Chọn một ảnh để build thử clip 10 giây"
                icon={<PictureOutlined className="text-fuchsia-600" />}
                buttonLabel="Chọn ảnh"
                onSelect={chooseSampleImage}
                disabled={busy}
              />
              <div className="mt-4 flex flex-wrap items-center justify-end gap-3">
                {sampleVideoPath && (
                  <Button
                    icon={<FolderOpenOutlined />}
                    onClick={() => void window.videoBuilder.showInFolder(sampleVideoPath)}
                    disabled={sampleBuilding}
                  >
                    Mở file test
                  </Button>
                )}
                <Button
                  type="dashed"
                  icon={<VideoCameraAddOutlined />}
                  loading={sampleBuilding}
                  onClick={startSampleBuild}
                  disabled={!canBuildSample}
                >
                  Build thử 10 giây
                </Button>
              </div>
            </div>
          </Card>

          {!ffmpeg.checking && !ffmpeg.available && (
            <Card className="border-red-200 bg-red-50">
              <Typography.Text type="danger">
                Không tìm thấy FFmpeg trong PATH. Trên macOS, cài bằng lệnh: brew install ffmpeg
              </Typography.Text>
            </Card>
          )}

          <div className="flex flex-col justify-center gap-3 sm:flex-row">
            <Button
              size="large"
              icon={<ScanOutlined />}
              onClick={preview}
              disabled={!inputsReady || busy}
            >
              Preview Alignment
            </Button>
            <Button
              size="large"
              type="primary"
              icon={<PlayCircleOutlined />}
              onClick={startBuild}
              disabled={!canBuild}
            >
              Build Video
            </Button>
          </div>
        </div>
      </main>

      <AlignmentPreview
        open={previewOpen}
        loading={previewLoading}
        items={alignment}
        warnings={alignmentWarnings}
        motionEffect={motionEffect}
        motionSequence={motionSequence}
        motionZoomPercent={motionZoomPercent}
        motionZoomOutStartPercent={motionZoomOutStartPercent}
        motionHoldMode={motionHoldMode}
        motionHoldPercent={motionHoldPercent}
        motionHoldSeconds={motionHoldSeconds}
        onClose={() => setPreviewOpen(false)}
      />
      <SourcePreview
        data={sourcePreview}
        loading={sourcePreviewLoading}
        onClose={() => setSourcePreview(null)}
      />
      <BuildProgress
        open={progressOpen}
        progress={progress}
        onStop={() => void window.videoBuilder.stopBuild()}
        onClose={() => !building && setProgressOpen(false)}
      />
    </>
  )
}
