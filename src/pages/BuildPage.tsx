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
  Switch,
  Tag,
  Tooltip,
  Typography,
} from 'antd'
import {
  DeleteOutlined,
  EyeOutlined,
  FileExcelOutlined,
  FileTextOutlined,
  FolderOpenOutlined,
  InfoCircleOutlined,
  PictureOutlined,
  PlayCircleOutlined,
  PlusOutlined,
  QuestionCircleOutlined,
  ReloadOutlined,
  SaveOutlined,
  ScanOutlined,
  VideoCameraAddOutlined,
  WarningOutlined,
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
import ActionBar from '../components/ActionBar'
import BuildProgress from '../components/BuildProgress'
import FileSelector from '../components/FileSelector'
import MotionPreviewModal from '../components/MotionPreviewModal'
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

function hasZoomInMotion(effect: BuildConfig['motionEffect']): boolean {
  return effect !== 'none' && !hasZoomOutMotion(effect)
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

  return (
    <>
      <main className="mx-auto max-w-5xl space-y-5 pb-24">
        <div className="space-y-5">
          <Card
            className="!rounded-lg border border-slate-200/80 shadow-sm"
            title={
              <div className="flex items-center gap-2">
                <span>Nguồn dữ liệu dự án</span>
                <Tooltip title="Tự động quét và tự động nạp Thư mục ảnh, File Excel kịch bản và File phụ đề SRT chỉ với 1 thao tác chọn folder tổng.">
                  <QuestionCircleOutlined className="text-brand-500 cursor-help text-xs" />
                </Tooltip>
              </div>
            }
            extra={
              <Space>
                <Button
                  icon={<ReloadOutlined />}
                  loading={sourceInspecting}
                  disabled={busy || !sourceFolder}
                  onClick={() => void refreshSourceFolder()}
                  className="!rounded-md"
                >
                  Làm mới
                </Button>
                <Tooltip title="Nhấp để chọn 1 thư mục chứa sẵn ảnh, file excel và srt. Hệ thống sẽ tự động nhận diện và điền đầy đủ các ô bên dưới.">
                  <Button
                    type="primary"
                    icon={<FolderOpenOutlined />}
                    loading={sourceInspecting}
                    disabled={busy}
                    onClick={() => void chooseSourceFolder()}
                    className="!rounded-md"
                  >
                    Chọn folder nguồn tự động
                  </Button>
                </Tooltip>
              </Space>
            }
          >
            <div className="space-y-3">
              {/* Explanatory Guide Box */}
              <div className="flex items-start gap-2.5 rounded-md bg-blue-50/70 border border-blue-200/80 p-3 text-xs text-blue-900">
                <InfoCircleOutlined className="text-blue-600 text-sm shrink-0 mt-0.5" />
                <div className="leading-relaxed">
                  <strong className="font-semibold text-blue-950 block mb-0.5">Tự động nạp dữ liệu từ Folder nguồn:</strong>
                  Khi chọn một <strong>Folder nguồn</strong> tổng (bằng nút phía trên), hệ thống sẽ tự động tìm kiếm và nạp các tệp ảnh scene, file Excel kịch bản và phụ đề SRT tương ứng bên dưới mà bạn không cần chọn từng tệp thủ công.
                </div>
              </div>

              {sourceFolder && (
                <div className="flex items-center justify-between gap-3 rounded-md bg-slate-50 border border-slate-200/70 px-4 py-2 text-xs">
                  <span className="text-slate-500 font-medium shrink-0">Folder nguồn đã nạp:</span>
                  <Typography.Text copyable ellipsis className="font-mono text-slate-700">
                    {sourceFolder}
                  </Typography.Text>
                </div>
              )}
              <FileSelector
                label="Thư mục ảnh"
                value={imagesDirectory}
                placeholder="Chọn thư mục chứa ảnh scene"
                icon={<FolderOpenOutlined className="text-brand-500" />}
                buttonLabel="Chọn thư mục"
                onSelect={chooseDirectory}
                onPreview={() => void loadSourcePreview('images')}
                disabled={busy}
                status={sourceErrors.imagesDirectory ? 'error' : undefined}
                error={sourceErrors.imagesDirectory}
                metaText={formatPathMeta(sourceInfos.imagesDirectory)}
                tooltipTitle="Thư mục chứa danh sách hình ảnh minh họa cho các cảnh (scene) trong video."
              />
              <FileSelector
                label="Scene list (Excel)"
                value={sceneListPath}
                placeholder="Chọn file Excel có cột STT và Nội dung"
                icon={<FileExcelOutlined className="text-emerald-500" />}
                buttonLabel="Chọn file"
                onSelect={() => chooseFile(['xlsx', 'xls'], setSceneListPath, 'sceneListPath')}
                onPreview={() => void loadSourcePreview('excel')}
                disabled={busy}
                status={sourceErrors.sceneListPath ? 'error' : undefined}
                error={sourceErrors.sceneListPath}
                metaText={formatPathMeta(sourceInfos.sceneListPath)}
                tooltipTitle="File bảng tính Excel (.xlsx/.xls) quy định thứ tự hiển thị cảnh và lời thoại tương ứng."
              />
              <FileSelector
                label="File phụ đề (SRT)"
                value={srtPath}
                placeholder="Chọn file phụ đề .srt"
                icon={<FileTextOutlined className="text-blue-500" />}
                buttonLabel="Chọn file"
                onSelect={() => chooseFile(['srt'], setSrtPath, 'srtPath')}
                onPreview={() => void loadSourcePreview('srt')}
                disabled={busy}
                status={sourceErrors.srtPath ? 'error' : undefined}
                error={sourceErrors.srtPath}
                metaText={formatPathMeta(sourceInfos.srtPath)}
                tooltipTitle="File phụ đề chuẩn (.srt) chứa các mốc thời gian hiển thị câu thoại chi tiết."
              />
              <FileSelector
                label={mode === 'clips' ? 'Thư mục lưu clips' : 'Output video'}
                value={outputDisplayPath}
                placeholder={mode === 'clips' ? 'Chọn folder để lưu nhiều video' : 'Chọn nơi lưu output.mp4'}
                icon={
                  mode === 'clips'
                    ? <FolderOpenOutlined className="text-amber-500" />
                    : <SaveOutlined className="text-amber-500" />
                }
                buttonLabel={mode === 'clips' ? 'Chọn folder' : 'Chọn nơi lưu'}
                onSelect={chooseOutput}
                disabled={busy}
                status={sourceErrors.outputPath ? 'error' : undefined}
                error={sourceErrors.outputPath}
                metaText={formatPathMeta(sourceInfos.outputPath)}
                tooltipTitle={mode === 'clips' ? 'Thư mục đich để lưu danh sách các clips video được tạo ra.' : 'Đường dẫn vị trí lưu file video hoàn chỉnh sau khi xuất.'}
              />
            </div>
          </Card>

          <Card className="!rounded-lg border border-slate-200/80 shadow-sm" title="Thiết lập video & Hiệu năng">
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              <div>
                <Typography.Text strong className="text-slate-700">Chế độ xuất</Typography.Text>
                <Radio.Group
                  className="mt-2 block"
                  value={mode}
                  onChange={(event) => saveVideoSettings({ mode: event.target.value })}
                  disabled={busy}
                >
                  <Space direction="vertical">
                    <Radio value="full">Full video (1 file ghép duy nhất)</Radio>
                    <Radio value="clips">Clips riêng (xuất lẻ từng scene)</Radio>
                  </Space>
                </Radio.Group>
              </div>
              <div>
                <Typography.Text strong className="text-slate-700">Tốc độ khung hình (FPS)</Typography.Text>
                <InputNumber
                  className="mt-2 !w-full !rounded-md"
                  min={1}
                  max={120}
                  value={fps}
                  onChange={(value) => saveVideoSettings({ fps: value ?? 30 })}
                  disabled={busy}
                />
              </div>
              <div>
                <Typography.Text strong className="text-slate-700">Độ phân giải (Resolution)</Typography.Text>
                <Select
                  className="mt-2 w-full !rounded-md"
                  value={resolution}
                  options={RESOLUTIONS.map((value) => ({ value, label: value }))}
                  onChange={(value) => saveVideoSettings({ resolution: value })}
                  disabled={busy}
                />
              </div>
              <div>
                <Typography.Text strong className="text-slate-700">Chế độ hiệu năng</Typography.Text>
                <Select
                  className="mt-2 w-full !rounded-md"
                  value={buildPerformance}
                  options={[
                    { value: 'cool', label: 'Mát máy / ít lag (Khuyên dùng)' },
                    { value: 'balanced', label: 'Cân bằng' },
                    { value: 'quality', label: 'Chất lượng cao' },
                  ]}
                  onChange={changeBuildPerformance}
                  disabled={busy}
                />
                <Typography.Text className="mt-1 block text-xs" type="secondary">
                  Mát máy giúp giảm nổ quạt và quá nhiệt CPU khi render.
                </Typography.Text>
              </div>
              <div>
                <Typography.Text strong className="text-slate-700">FFmpeg threads</Typography.Text>
                <InputNumber
                  className="mt-2 !w-full !rounded-md"
                  min={1}
                  max={16}
                  step={1}
                  precision={0}
                  value={ffmpegThreads}
                  onChange={(value) => saveVideoSettings({ ffmpegThreads: value ?? 1 })}
                  disabled={busy}
                />
                <Typography.Text className="mt-1 block text-xs" type="secondary">
                  Giữ 1–2 thread để máy hoạt động êm ái.
                </Typography.Text>
              </div>
              <div>
                <Typography.Text strong className="text-slate-700">Scene build song song</Typography.Text>
                <InputNumber
                  className="mt-2 !w-full !rounded-md"
                  min={1}
                  max={8}
                  step={1}
                  precision={0}
                  value={sceneConcurrency}
                  onChange={(value) => saveVideoSettings({ sceneConcurrency: value ?? 1 })}
                  disabled={busy}
                />
                <Typography.Text className="mt-1 block text-xs" type="secondary">
                  Số scene xử lý đồng thời.
                </Typography.Text>
              </div>
            </div>

            <div className="mt-5 rounded-lg border border-slate-200 bg-slate-50/70 p-4 space-y-4">
              {/* Header bar */}
              <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-slate-200">
                <div>
                  <div className="flex items-center gap-2">
                    <Typography.Text strong className="text-slate-800 text-sm">Chuyển động camera (Motion)</Typography.Text>
                    <Tooltip title="Tự động phóng to / thu nhỏ ảnh trong quá trình chạy clip giúp video sinh động và cuốn hút hơn.">
                      <InfoCircleOutlined className="text-slate-400 cursor-help text-xs" />
                    </Tooltip>
                  </div>
                  <Typography.Text className="block text-xs" type="secondary">
                    {motionEnabled
                      ? 'Áp dụng hiệu ứng zoom mượt cho từng hình ảnh scene.'
                      : 'Hình ảnh giữ nguyên khung hình tĩnh.'}
                  </Typography.Text>
                </div>
                <div className="flex items-center gap-3">
                  <Button
                    size="small"
                    icon={<EyeOutlined />}
                    onClick={() => openMotionPreview()}
                    className="!rounded-md border-brand-200 text-brand-600 hover:text-brand-700 bg-white font-medium text-xs shadow-sm"
                  >
                    Xem minh họa chuyển động
                  </Button>
                  <div className="flex items-center gap-2 bg-white px-3 py-1 rounded-md border border-slate-200">
                    <Typography.Text strong className="text-xs text-slate-600">Bật hiệu ứng</Typography.Text>
                    <Switch
                      size="small"
                      checked={motionEnabled}
                      disabled={busy}
                      onChange={(checked) => saveVideoSettings({ motionEnabled: checked })}
                    />
                  </div>
                </div>
              </div>

              {motionEnabled ? (
                <div className="space-y-4">
                  {/* 1. Sequence List */}
                  <div className="bg-white rounded-md border border-slate-200 p-3.5 space-y-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <Typography.Text strong className="text-xs text-slate-700">Chuỗi chuyển động video</Typography.Text>
                        <Tooltip title="Các kiểu zoom trong danh sách sẽ lần lượt được áp dụng cho từng clip trong video theo thứ tự (Clip 1 -> Clip 2 -> Clip 3 -> xoay vòng lại).">
                          <QuestionCircleOutlined className="text-slate-400 cursor-help text-xs" />
                        </Tooltip>
                      </div>
                      <Button
                        size="small"
                        icon={<PlusOutlined />}
                        disabled={busy}
                        onClick={addMotionSequenceItem}
                        className="!rounded-md"
                      >
                        Thêm kiểu zoom
                      </Button>
                    </div>

                    <div className="space-y-2.5">
                      {motionSequence.map((item, index) => (
                        <div
                          key={item.id}
                          className="flex items-center gap-3 rounded-md border border-slate-200 bg-slate-50/60 p-2.5 hover:bg-slate-50 transition-colors"
                        >
                          <Tag color="default" className="!mr-0 font-mono text-xs font-semibold text-slate-700 shrink-0 px-2.5 py-0.5">
                            Clip {index + 1}
                          </Tag>
                          <Select
                            className="flex-1 !rounded-md font-medium text-slate-700"
                            value={item.effect}
                            options={MOTION_EFFECT_OPTIONS}
                            onChange={(value) => updateMotionSequenceItem(item.id, value)}
                            disabled={busy}
                          />
                          <Button
                            icon={<EyeOutlined />}
                            onClick={() => openMotionPreview(item.effect)}
                            title="Xem minh họa chuyển động này"
                            className="!rounded-md text-slate-600 hover:text-brand-600 font-medium shrink-0"
                          >
                            Mô phỏng
                          </Button>
                          <Button
                            danger
                            icon={<DeleteOutlined />}
                            disabled={busy || motionSequence.length <= 1}
                            onClick={() => removeMotionSequenceItem(item.id)}
                            className="!rounded-md shrink-0"
                          />
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* 2. Advanced Tuning Parameters Grid */}
                  <div className="bg-white rounded-md border border-slate-200 p-3.5 space-y-3">
                    <div className="flex items-center gap-2 pb-2 border-b border-slate-100">
                      <Typography.Text strong className="text-xs text-slate-700">Cấu hình thông số Zoom & Giữ khung hình</Typography.Text>
                      <Tooltip title="Tùy chỉnh độ phóng to/thu nhỏ tối đa và thời gian ảnh đứng yên ở cuối mỗi clip.">
                        <InfoCircleOutlined className="text-slate-400 cursor-help text-xs" />
                      </Tooltip>
                    </div>

                    <div className="grid gap-4 md:grid-cols-2">
                      {/* Zoom In Max */}
                      <div className="bg-slate-50/60 p-3 rounded-md border border-slate-200/80 space-y-1.5">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-1.5">
                            <Typography.Text strong className="text-xs text-slate-700">Zoom vào tối đa (%)</Typography.Text>
                            <Tooltip
                              title={
                                <span>
                                  Tỷ lệ phóng to tối đa khi dùng các kiểu Zoom Vào. Hiện bạn đang cài <strong>{motionZoomPercent}%</strong>, hình ảnh sẽ phóng to từ <strong>100%</strong> đến <strong>{(100 + motionZoomPercent).toFixed(1)}%</strong>.
                                </span>
                              }
                            >
                              <QuestionCircleOutlined className="text-brand-500 cursor-help text-xs" />
                            </Tooltip>
                          </div>
                          <Tag color={busy || motionSequenceAllStill || !motionSequenceHasZoomIn ? 'default' : 'red'} className="!mr-0 text-[10px] font-mono">
                            100% → {(100 + motionZoomPercent).toFixed(0)}%
                          </Tag>
                        </div>
                        <InputNumber
                          className="!w-full"
                          min={0}
                          max={50}
                          step={1}
                          precision={1}
                          addonAfter="%"
                          value={motionZoomPercent}
                          onChange={(value) => saveVideoSettings({ motionZoomPercent: value ?? 8 })}
                          disabled={busy || motionSequenceAllStill || !motionSequenceHasZoomIn}
                        />
                        {motionSequenceAllStill ? (
                          <Typography.Text className="block text-[11px] text-amber-600 font-medium flex items-center gap-1">
                            <WarningOutlined /> Khóa: Tất cả clip trong danh sách đều đang chọn Đứng yên (Tĩnh).
                          </Typography.Text>
                        ) : !motionSequenceHasZoomIn ? (
                          <Typography.Text className="block text-[11px] text-amber-600 font-medium flex items-center gap-1">
                            <WarningOutlined /> Khóa: Chuỗi chuyển động chưa có kiểu Zoom Vào nào.
                          </Typography.Text>
                        ) : (
                          <Typography.Text className="block text-[11px] text-slate-500">
                            Biên độ phóng đại cho tất cả kiểu Zoom Vào.
                          </Typography.Text>
                        )}
                      </div>

                      {/* Zoom Out Start */}
                      <div className="bg-slate-50/60 p-3 rounded-md border border-slate-200/80 space-y-1.5">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-1.5">
                            <Typography.Text strong className="text-xs text-slate-700">Zoom ra - bắt đầu (%)</Typography.Text>
                            <Tooltip
                              title={
                                <span>
                                  Tỷ lệ phóng to ban đầu khi dùng các kiểu Zoom Ra. Hiện bạn đang cài <strong>{motionZoomOutStartPercent}%</strong>, hình ảnh sẽ bắt đầu từ <strong>{(100 + motionZoomOutStartPercent).toFixed(1)}%</strong> và thu nhỏ về <strong>100%</strong>.
                                </span>
                              }
                            >
                              <QuestionCircleOutlined className="text-brand-500 cursor-help text-xs" />
                            </Tooltip>
                          </div>
                          <Tag color={busy || !motionSequenceHasZoomOut ? 'default' : 'cyan'} className="!mr-0 text-[10px] font-mono">
                            {(100 + motionZoomOutStartPercent).toFixed(0)}% → 100%
                          </Tag>
                        </div>
                        <InputNumber
                          className="!w-full"
                          min={0}
                          max={50}
                          step={1}
                          precision={1}
                          addonAfter="%"
                          value={motionZoomOutStartPercent}
                          onChange={(value) => saveVideoSettings({ motionZoomOutStartPercent: value ?? 12 })}
                          disabled={busy || !motionSequenceHasZoomOut}
                        />
                        {!motionSequenceHasZoomOut ? (
                          <Typography.Text className="block text-[11px] text-amber-600 font-medium flex items-start gap-1">
                            <WarningOutlined className="shrink-0 mt-0.5" />
                            <span>Khóa: Danh sách chuỗi chuyển động chưa có kiểu Zoom Ra nào. (Hãy chọn một kiểu Zoom từ trong ra như "Zoom từ trong ra — góc trái trên" ở trên để kích hoạt).</span>
                          </Typography.Text>
                        ) : (
                          <Typography.Text className="block text-[11px] text-slate-500">
                            Mức thu nhỏ khởi đầu cho kiểu Zoom Ra.
                          </Typography.Text>
                        )}
                      </div>

                      {/* Hold Phase */}
                      <div className="md:col-span-2 bg-slate-50/60 p-3 rounded-md border border-slate-200/80 space-y-2">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div className="flex items-center gap-1.5">
                            <Typography.Text strong className="text-xs text-slate-700">Giữ khung hình cuối scene (Hold Phase)</Typography.Text>
                            <Tooltip
                              title={
                                <span>
                                  Khoảng thời gian ảnh đứng yên cố định ở cuối clip trước khi chuyển sang cảnh mới. {motionHoldMode === 'seconds' ? (
                                    <>Hiện tại cài <strong>{motionHoldSeconds}s</strong> cuối mỗi clip sẽ giữ hình ảnh tĩnh.</>
                                  ) : (
                                    <>Hiện tại cài <strong>{motionHoldPercent}%</strong> thời lượng cuối clip sẽ giữ hình ảnh tĩnh.</>
                                  )}
                                </span>
                              }
                            >
                              <QuestionCircleOutlined className="text-brand-500 cursor-help text-xs" />
                            </Tooltip>
                          </div>
                          <Radio.Group
                            size="small"
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
                            className="!w-full"
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
                            className="!w-full"
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

                        {motionSequenceAllStill ? (
                          <Typography.Text className="block text-[11px] text-amber-600 font-medium flex items-center gap-1">
                            <WarningOutlined /> Khóa: Tất cả clip đều Đứng yên nên không cần phân đoạn giữ khung hình.
                          </Typography.Text>
                        ) : (
                          <Typography.Text className="block text-[11px] text-slate-500">
                            {motionHoldMode === 'seconds'
                              ? `Giữ tĩnh ${motionHoldSeconds}s cuối mỗi clip. (Tự điều chỉnh nếu clip ngắn hơn).`
                              : `${motionHoldPercent}% thời lượng cuối clip đứng yên (ví dụ: clip 10s sẽ đứng yên ${((10 * motionHoldPercent) / 100).toFixed(1)}s cuối).`}
                          </Typography.Text>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="rounded-md border border-dashed border-slate-300 bg-white p-3 text-center text-xs text-slate-500">
                  Ảnh sẽ đứng yên trong suốt thời lượng scene để tiết kiệm tài nguyên.
                </div>
              )}
            </div>

            <div className="mt-4 border-t border-slate-200/80 pt-4">
              <FileSelector
                label="Ảnh test hiệu ứng"
                value={sampleImagePath}
                placeholder="Chọn một ảnh để render clip test 10s"
                icon={<PictureOutlined className="text-fuchsia-500" />}
                buttonLabel="Chọn ảnh"
                onSelect={chooseSampleImage}
                disabled={busy}
              />
              <div className="mt-2 flex items-center justify-end gap-2">
                {sampleVideoPath && (
                  <Button
                    size="small"
                    icon={<FolderOpenOutlined />}
                    onClick={() => void window.videoBuilder.showInFolder(sampleVideoPath)}
                    disabled={sampleBuilding}
                    className="!rounded-md"
                  >
                    Xem clip test
                  </Button>
                )}
                <Button
                  size="small"
                  type="dashed"
                  icon={<VideoCameraAddOutlined />}
                  loading={sampleBuilding}
                  onClick={startSampleBuild}
                  disabled={!canBuildSample}
                  className="!rounded-md"
                >
                  Build thử 10 giây
                </Button>
              </div>
            </div>
          </Card>

          {!ffmpeg.checking && !ffmpeg.available && (
            <Card className="!rounded-lg border-red-200 bg-red-50">
              <Typography.Text type="danger">
                {ffmpeg.repairMessage || 'Không tìm thấy bộ xử lý FFmpeg.'}
              </Typography.Text>
            </Card>
          )}
        </div>
      </main>

      {/* Floating Bottom Bar */}
      <ActionBar
        leftContent={
          <div className="flex items-center gap-2.5 text-xs">
            <span className={`inline-block w-2 h-2 rounded-full ${inputsReady ? 'bg-emerald-500' : 'bg-amber-400'}`} />
            <span className="text-slate-600 font-medium">
              {inputsReady ? 'Nguồn dữ liệu hợp lệ' : 'Đang chờ chọn đủ tệp nguồn'}
            </span>
          </div>
        }
        rightContent={
          <>
            <Button
              icon={<ScanOutlined />}
              onClick={preview}
              disabled={!inputsReady || busy}
              className="!rounded-md font-medium"
            >
              Preview Alignment
            </Button>
            <Button
              type="primary"
              icon={<PlayCircleOutlined />}
              onClick={startBuild}
              disabled={!canBuild}
              className="!rounded-md font-medium px-5 shadow-sm"
            >
              Build Video
            </Button>
          </>
        }
      />

      <AlignmentPreview
        open={previewOpen}
        loading={previewLoading}
        items={alignment}
        warnings={alignmentWarnings}
        motionEnabled={motionEnabled}
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
      <MotionPreviewModal
        open={motionModalOpen}
        effect={previewMotionEffect}
        motionZoomPercent={motionZoomPercent}
        motionZoomOutStartPercent={motionZoomOutStartPercent}
        motionHoldMode={motionHoldMode}
        motionHoldPercent={motionHoldPercent}
        motionHoldSeconds={motionHoldSeconds}
        sampleImagePath={sampleImagePath}
        onEffectChange={(eff) => setPreviewMotionEffect(eff)}
        onSettingsChange={(newSettings) => saveVideoSettings(newSettings)}
        onClose={() => setMotionModalOpen(false)}
      />
    </>
  )
}
