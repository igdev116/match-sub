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
  FileExcelOutlined,
  FileTextOutlined,
  FolderOpenOutlined,
  PictureOutlined,
  PlayCircleOutlined,
  SaveOutlined,
  ScanOutlined,
  VideoCameraAddOutlined,
} from '@ant-design/icons'
import type {
  AlignmentItem,
  BuildConfig,
  BuildProgress as BuildProgressState,
  ImagePreviewItem,
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
  const motionZoomPercent = videoSettings?.motionZoomPercent ?? 8
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

  function applySourceInspection(inspection: SourceFolderInspection) {
    setSourceFolder(inspection.folderPath)
    setImagesDirectory(inspection.imagesDirectory)
    setSceneListPath(inspection.sceneListPath)
    setSrtPath(inspection.srtPath)
    setOutputPath(inspection.outputPath)
    setSourceInfos(inspection.infos)
    setSourceErrors(inspection.errors)
  }

  function saveVideoSettings(patch: Parameters<typeof updateVideoSettings>[0]) {
    void updateVideoSettings(patch)
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
      setAlignment(await window.videoBuilder.previewAlignment(previewConfig))
    } catch (error) {
      setPreviewOpen(false)
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
      motionZoomPercent,
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
        motionZoomPercent,
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
              <Button
                icon={<FolderOpenOutlined />}
                loading={sourceInspecting}
                disabled={busy}
                onClick={() => void chooseSourceFolder()}
              >
                Chọn folder nguồn
              </Button>
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
                label="Output"
                value={outputPath}
                placeholder="Chọn nơi lưu output.mp4"
                icon={<SaveOutlined className="text-amber-600" />}
                buttonLabel="Chọn nơi lưu"
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
              <div>
                <Typography.Text strong>Chuyển động ảnh</Typography.Text>
                <Select
                  className="mt-3 w-full"
                  value={motionEffect}
                  options={[
                    { value: 'auto', label: 'Tự động luân phiên' },
                    { value: 'alternate-top-corners', label: 'Xen kẽ: lẻ phải trên, chẵn trái trên' },
                    { value: 'alternate-top-corners-reverse', label: 'Xen kẽ: lẻ trái trên, chẵn phải trên' },
                    { value: 'zoom-right', label: 'Zoom vào bên phải' },
                    { value: 'zoom-left', label: 'Zoom vào bên trái' },
                    { value: 'zoom-top-right', label: 'Zoom lên góc phải trên' },
                    { value: 'zoom-top-left', label: 'Zoom lên góc trái trên' },
                    { value: 'zoom-center', label: 'Zoom vào chính giữa' },
                    { value: 'zoom-up', label: 'Zoom lên phía trên' },
                    { value: 'zoom-down', label: 'Zoom xuống phía dưới' },
                    { value: 'zoom-out', label: 'Thu nhỏ dần' },
                    { value: 'none', label: 'Đứng yên' },
                  ]}
                  onChange={(value) => saveVideoSettings({ motionEffect: value })}
                  disabled={busy}
                />
                <Typography.Text className="mt-2 block" type="secondary">
                  Chọn hướng chuyển động cho từng scene.
                </Typography.Text>
              </div>
              <div>
                <Typography.Text strong>Mức zoom</Typography.Text>
                <InputNumber
                  className="mt-3 !w-full"
                  min={0}
                  max={50}
                  step={1}
                  precision={1}
                  addonAfter="%"
                  value={motionZoomPercent}
                  onChange={(value) => saveVideoSettings({ motionZoomPercent: value ?? 8 })}
                  disabled={busy || motionEffect === 'none'}
                />
                <Typography.Text className="mt-2 block" type="secondary">
                  8% nhẹ; 15–20% rõ hơn.
                </Typography.Text>
              </div>
              <div>
                <Typography.Text strong>Giữ khung hình cuối</Typography.Text>
                <Radio.Group
                  className="mt-3"
                  value={motionHoldMode}
                  onChange={(event) => saveVideoSettings({ motionHoldMode: event.target.value })}
                  disabled={busy || motionEffect === 'none'}
                >
                  <Radio value="percent">Theo % scene</Radio>
                  <Radio value="seconds">Số giây cố định</Radio>
                </Radio.Group>
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
                    disabled={busy || motionEffect === 'none'}
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
                    disabled={busy || motionEffect === 'none'}
                  />
                )}
                <Typography.Text className="mt-2 block" type="secondary">
                  {motionHoldMode === 'seconds'
                    ? `Giữ cố định ${motionHoldSeconds}s cuối scene. Nếu scene ngắn hơn thì tự clamp theo duration scene.`
                    : `${motionHoldPercent}% cuối scene đứng yên; scene 10 giây tương đương ${(10 * motionHoldPercent / 100).toFixed(1)} giây.`}
                </Typography.Text>
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
        motionEffect={motionEffect}
        motionZoomPercent={motionZoomPercent}
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
