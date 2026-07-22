import { useEffect, useMemo, useRef, useState } from 'react'
import {
  DndContext,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core'
import {
  SortableContext,
  arrayMove,
  verticalListSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import {
  Alert,
  App,
  Button,
  Card,
  Empty,
  Input,
  InputNumber,
  List,
  Pagination,
  Progress,
  Select,
  Space,
  Switch,
  Tag,
  Tooltip,
  Typography,
} from 'antd'
import {
  AudioOutlined,
  ClockCircleOutlined,
  CloudDownloadOutlined,
  DeleteOutlined,
  FileTextOutlined,
  FolderOpenOutlined,
  FolderViewOutlined,
  HolderOutlined,
  InfoCircleOutlined,
  PlusOutlined,
  QuestionCircleOutlined,
  ReloadOutlined,
  SettingOutlined,
  SoundOutlined,
  WarningOutlined,
} from '@ant-design/icons'
import type { AudioFileItem, WhisperProgress, WhisperStatus } from '../../electron/types'
import ActionBar from '../components/ActionBar'
import {
  isAudioMergeRunning,
  useAudioMergeStore,
  type AudioMergeItem,
} from '../stores/useAudioMergeStore'
import { useProjectStore } from '../stores/useProjectStore'

const emptyItems: AudioMergeItem[] = []

function formatDuration(seconds: number | null): string {
  if (seconds === null || !Number.isFinite(seconds)) return 'Không rõ thời lượng'
  if (seconds < 60) return `${seconds.toFixed(1)}s`
  const minutes = Math.floor(seconds / 60)
  const remainder = seconds % 60
  return `${minutes}m ${remainder.toFixed(1).padStart(4, '0')}s`
}

function cleanError(error: unknown): string {
  const text = error instanceof Error ? error.message : String(error)
  return text.replace(/^Error invoking remote method '[^']+': Error: /, '')
}

function audioOutputPath(directory: string): string {
  if (!directory) return ''
  const separator = directory.includes('\\') ? '\\' : '/'
  return `${directory.replace(/[\\/]+$/, '')}${separator}merged-audio.mp3`
}

function srtOutputPathFromAudio(audioPath: string): string {
  if (!audioPath) return ''
  const withoutExtension = audioPath.replace(/\.[^/.\\]+$/, '')
  return `${withoutExtension}.srt`
}

function directoryFromPath(filePath: string): string {
  return filePath.split(/[\\/]/).slice(0, -1).join(filePath.includes('\\') ? '\\' : '/')
}

function SortableAudioItem({
  item,
  index,
  disabled,
  onRemove,
}: {
  item: AudioMergeItem
  index: number
  disabled: boolean
  onRemove: () => void
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: item.id,
    disabled,
  })

  return (
    <List.Item
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.55 : 1,
        background: isDragging ? '#fff5f4' : undefined,
      }}
      className="!py-2.5 !px-3.5 hover:bg-slate-50/80 transition-colors"
      actions={[
        <Button
          key="remove"
          type="text"
          danger
          size="small"
          icon={<DeleteOutlined />}
          disabled={disabled}
          onClick={onRemove}
          title="Xóa tệp này"
        />,
      ]}
    >
      <div className="flex min-w-0 flex-1 items-center gap-3">
        <Button
          type="text"
          size="small"
          icon={<HolderOutlined className="text-slate-400" />}
          className="cursor-grab shrink-0"
          disabled={disabled}
          {...attributes}
          {...listeners}
        />
        <Tag color="volcano" className="shrink-0 font-mono text-xs font-semibold !mr-0 px-2 py-0.5">
          #{index + 1}
        </Tag>
        <SoundOutlined className="shrink-0 text-brand-500 text-base" />
        <div className="min-w-0 flex-1">
          <Typography.Text strong className="block text-xs text-slate-800" ellipsis={{ tooltip: item.name }}>
            {item.name}
          </Typography.Text>
          <div className="flex items-center gap-2 text-[11px] text-slate-500">
            <span className="flex items-center gap-1 font-mono">
              <ClockCircleOutlined className="text-slate-400" /> {formatDuration(item.durationSeconds)}
            </span>
          </div>
        </div>
      </div>
    </List.Item>
  )
}

export default function AudioMergePage() {
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
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }))

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
      .catch(() => {
        // Duration chỉ là thông tin phụ; lỗi probe không chặn workflow ghép audio.
      })

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
      'mp3',
      'wav',
      'm4a',
      'aac',
      'flac',
      'ogg',
      'opus',
      'wma',
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

  function createAudioItems(items: AudioFileItem[]): AudioMergeItem[] {
    return items.map((item) => ({
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

  return (
    <main className="mx-auto max-w-5xl space-y-5 pb-28">
      {/* Card 1: Danh sách Audio */}
      <Card
        className="!rounded-lg border border-slate-200/80 shadow-sm"
        title={
          <div className="flex items-center gap-2">
            <SoundOutlined className="text-brand-500 text-base" />
            <span className="font-semibold text-slate-800">Danh sách tệp audio ghép ({items.length})</span>
            <Tooltip title="Nạp các tệp MP3/WAV. Bạn có thể kéo thả biểu tượng ⠿ để sắp xếp thứ tự phát nối.">
              <QuestionCircleOutlined className="text-slate-400 cursor-help text-xs hover:text-brand-500" />
            </Tooltip>
          </div>
        }
        extra={
          <Space>
            {items.length > 0 && (
              <Button
                disabled={processing}
                danger
                icon={<DeleteOutlined />}
                onClick={() => setItems([])}
                className="!rounded-md"
              >
                Xóa tất cả
              </Button>
            )}
            <Button
              icon={<PlusOutlined />}
              disabled={processing}
              onClick={addFiles}
              className="!rounded-md"
            >
              Thêm tệp lẻ
            </Button>
            <Button
              type="primary"
              icon={<FolderOpenOutlined />}
              disabled={processing}
              onClick={() => void selectAudioDirectory()}
              className="!rounded-md"
            >
              Chọn thư mục audio
            </Button>
          </Space>
        }
      >
        {audioDirectory && (
          <div className="mb-3.5 flex items-center justify-between gap-3 rounded-md bg-slate-50 border border-slate-200/80 px-3.5 py-2 text-xs">
            <div className="min-w-0 flex-1 flex items-center gap-2">
              <span className="text-slate-500 font-medium shrink-0">Thư mục theo dõi:</span>
              <Typography.Text copyable ellipsis={{ tooltip: audioDirectory }} className="font-mono text-slate-700">
                {audioDirectory}
              </Typography.Text>
            </div>
            <Button
              size="small"
              icon={<ReloadOutlined />}
              loading={directoryLoading}
              disabled={processing}
              onClick={() => void refreshAudioDirectory()}
              className="!rounded-md shrink-0"
            >
              Nạp lại tệp
            </Button>
          </div>
        )}

        {items.length === 0 ? (
          <div className="py-8 text-center bg-slate-50/50 rounded-md border border-dashed border-slate-200 space-y-3">
            <SoundOutlined className="text-3xl text-slate-300" />
            <div>
              <Typography.Text strong className="block text-slate-700 text-sm">
                Chưa có tệp audio nào trong danh sách
              </Typography.Text>
              <Typography.Text className="text-slate-500 text-xs">
                Vui lòng chọn 1 Thư mục audio hoặc Thêm tệp MP3/WAV lẻ để bắt đầu ghép.
              </Typography.Text>
            </div>
            <div className="flex justify-center gap-2.5 pt-1">
              <Button icon={<PlusOutlined />} onClick={addFiles} className="!rounded-md">
                Thêm tệp lẻ
              </Button>
              <Button
                type="primary"
                icon={<FolderOpenOutlined />}
                onClick={() => void selectAudioDirectory()}
                className="!rounded-md"
              >
                Chọn thư mục audio
              </Button>
            </div>
          </div>
        ) : (
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
            <SortableContext items={pagedItems.map((item) => item.id)} strategy={verticalListSortingStrategy}>
              <List
                bordered
                className="!rounded-md overflow-hidden border-slate-200 bg-white"
                dataSource={pagedItems}
                renderItem={(item, index) => (
                  <SortableAudioItem
                    item={item}
                    index={pageStart + index}
                    disabled={processing}
                    onRemove={() => setItems((current) => current.filter((entry) => entry.id !== item.id))}
                  />
                )}
              />
            </SortableContext>

            {items.length > pageSize && (
              <div className="mt-3.5 flex justify-end">
                <Pagination
                  current={currentPage}
                  pageSize={pageSize}
                  total={items.length}
                  showSizeChanger
                  pageSizeOptions={[10, 20, 50]}
                  showTotal={(total, range) => `${range[0]}-${range[1]} / ${total} audio`}
                  onChange={(page, size) => {
                    if (size !== pageSize) {
                      saveAudioSettings({ pageSize: size })
                      setCurrentPage(1)
                    } else {
                      setCurrentPage(page)
                    }
                  }}
                />
              </div>
            )}
          </DndContext>
        )}
      </Card>

      {/* Card 2: Thiết lập Ghép nối & Output MP3 */}
      <Card
        className="!rounded-lg border border-slate-200/80 shadow-sm"
        title={
          <div className="flex items-center gap-2">
            <SettingOutlined className="text-brand-500 text-base" />
            <span className="font-semibold text-slate-800">Cấu hình ghép nối & Output MP3</span>
          </div>
        }
      >
        <div className="grid gap-4 md:grid-cols-2">
          {/* Khoảng nghỉ giữa các audio */}
          <div className="bg-slate-50/70 p-3.5 rounded-md border border-slate-200/80 space-y-2">
            <div className="flex items-center gap-1.5">
              <Typography.Text strong className="text-xs text-slate-700">
                Khoảng nghỉ giữa các tệp audio (Pause Gap)
              </Typography.Text>
              <Tooltip title="Tự động chèn khoảng tĩnh không tiếng (tính theo giây) ở điểm nối giữa từng tệp audio.">
                <QuestionCircleOutlined className="text-brand-500 cursor-help text-xs" />
              </Tooltip>
            </div>
            <InputNumber
              className="!w-full"
              min={0}
              max={60}
              step={0.5}
              precision={1}
              addonAfter="giây"
              value={pauseSeconds}
              disabled={processing}
              onChange={(value) => saveAudioSettings({ pauseSeconds: value ?? 1 })}
            />
            <Typography.Text className="block text-[11px] text-slate-500">
              Tạo {pauseCount} điểm nối (tổng chèn thêm <strong className="text-slate-700">+{totalPause.toFixed(1)}s</strong> thời lượng tĩnh).
            </Typography.Text>
          </div>

          {/* File MP3 output */}
          <div className="bg-slate-50/70 p-3.5 rounded-md border border-slate-200/80 space-y-2">
            <div className="flex items-center gap-1.5">
              <Typography.Text strong className="text-xs text-slate-700">
                Đường dẫn File MP3 thành phẩm
              </Typography.Text>
              <Tooltip title="Nơi lưu trữ file MP3 đã được nối hoàn chỉnh.">
                <QuestionCircleOutlined className="text-brand-500 cursor-help text-xs" />
              </Tooltip>
            </div>
            <Space.Compact className="w-full">
              <Input className="font-mono text-xs" value={outputPath} readOnly placeholder="Chưa có đường dẫn output" />
              <Button
                icon={<FolderViewOutlined />}
                disabled={!outputPath}
                onClick={() => void showOutputFolder()}
                title="Mở thư mục chứa file"
                className="!rounded-none"
              >
                Mở thư mục
              </Button>
              <Button
                type="primary"
                icon={<FolderOpenOutlined />}
                disabled={processing}
                onClick={() => void chooseOutputPath()}
                className="!rounded-r-md"
              >
                Chọn vị trí
              </Button>
            </Space.Compact>
            <Typography.Text className="block text-[11px] text-slate-500">
              Mặc định xuất file tên: <code className="font-mono text-slate-600">merged-audio.mp3</code>
            </Typography.Text>
          </div>
        </div>
      </Card>

      {/* Card 3: Phụ đề SRT (Whisper AI) */}
      <Card
        className="!rounded-lg border border-slate-200/80 shadow-sm"
        title={
          <div className="flex items-center gap-2">
            <FileTextOutlined className="text-brand-500 text-base" />
            <span className="font-semibold text-slate-800">Trích xuất Phụ đề SRT (Whisper AI)</span>
          </div>
        }
        extra={
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium text-slate-600">Bật nhận dạng SRT</span>
            <Switch
              checked={createSrt}
              disabled={processing || whisperSetupBusy}
              onChange={(value) => saveAudioSettings({ createSrt: value })}
            />
          </div>
        }
      >
        {!createSrt ? (
          <div className="p-3 bg-slate-50 rounded-md border border-slate-200 text-xs text-slate-500">
            Gạt công tắc <strong className="text-slate-700">"Bật nhận dạng SRT"</strong> ở góc trên nếu bạn muốn AI tự động lắng nghe và xuất file phụ đề .srt tương ứng với file MP3 nối.
          </div>
        ) : (
          <div className="space-y-4">
            {/* Status Badges & Setup */}
            <div className="flex flex-wrap items-center gap-2.5 bg-slate-50/70 p-3 rounded-md border border-slate-200/80">
              <Tag color={whisperStatus?.available ? 'success' : 'error'} className="!mr-0 font-medium text-xs">
                {whisperStatus?.available
                  ? whisperStatus.executableSource === 'bundled'
                    ? 'Whisper AI (Bundled): Sẵn sàng'
                    : 'Whisper.cpp: Sẵn sàng'
                  : 'Chưa cài Whisper.cpp'}
              </Tag>
              <Tag color={whisperStatus?.modelAvailable ? 'success' : 'warning'} className="!mr-0 font-medium text-xs">
                {whisperStatus?.modelAvailable
                  ? whisperStatus.modelSource === 'bundled'
                    ? 'Model Base AI (Bundled): Sẵn sàng'
                    : 'Model Base: Sẵn sàng'
                  : 'Chưa nạp Model Base'}
              </Tag>

              {!whisperStatus?.available && whisperStatus?.installSupported && (
                <Button
                  type="primary"
                  size="small"
                  icon={<CloudDownloadOutlined />}
                  loading={whisperSetupBusy}
                  disabled={processing}
                  onClick={() => void setupWhisper('install')}
                  className="!rounded-md"
                >
                  Cài bằng Homebrew
                </Button>
              )}
              {!whisperStatus?.modelAvailable && whisperStatus?.downloadSupported && (
                <Button
                  size="small"
                  icon={<CloudDownloadOutlined />}
                  loading={whisperSetupBusy}
                  disabled={processing}
                  onClick={() => void setupWhisper('download')}
                  className="!rounded-md"
                >
                  Tải Model Base (~148 MB)
                </Button>
              )}
            </div>

            {whisperStatus?.repairMessage && (
              <Alert
                type="error"
                showIcon
                className="!rounded-md"
                message="Bộ cài không đầy đủ"
                description={whisperStatus.repairMessage}
              />
            )}

            {whisperSetupProgress && (
              <div className="bg-slate-50 p-3 rounded-md border border-slate-200 space-y-1.5">
                <Typography.Text className="text-xs font-medium text-slate-700">
                  {whisperSetupProgress.message}
                </Typography.Text>
                <Progress
                  className="!mb-0"
                  percent={whisperSetupProgress.percent}
                  status={whisperSetupProgress.phase === 'error' ? 'exception' : 'active'}
                />
              </div>
            )}

            {/* File SRT output Path */}
            <div className="bg-slate-50/70 p-3.5 rounded-md border border-slate-200/80 space-y-2">
              <div className="flex items-center gap-1.5">
                <Typography.Text strong className="text-xs text-slate-700">
                  Đường dẫn File SRT output
                </Typography.Text>
                <Tooltip title="Vị trí lưu file phụ đề chuẩn .srt sau khi Whisper AI nhận dạng xong.">
                  <QuestionCircleOutlined className="text-brand-500 cursor-help text-xs" />
                </Tooltip>
              </div>
              <Space.Compact className="w-full">
                <Input className="font-mono text-xs" value={srtOutputPath} readOnly placeholder="Chưa có đường dẫn file SRT" />
                <Button
                  icon={<FolderViewOutlined />}
                  disabled={!srtOutputPath}
                  onClick={() => void showSrtOutputFolder()}
                  title="Mở thư mục chứa file SRT"
                  className="!rounded-none"
                >
                  Mở thư mục
                </Button>
                <Button
                  icon={<FolderOpenOutlined />}
                  disabled={processing || whisperSetupBusy}
                  onClick={() => void chooseSrtOutputPath()}
                  className="!rounded-r-md"
                >
                  Chọn file SRT
                </Button>
              </Space.Compact>
              <Typography.Text className="block text-[11px] text-slate-500">
                Tự động gợi ý lưu cùng tên với file MP3 output.
              </Typography.Text>
            </div>

            {/* Settings Grid */}
            <div className="grid gap-4 md:grid-cols-2">
              <div className="bg-slate-50/70 p-3.5 rounded-md border border-slate-200/80 space-y-2">
                <div className="flex items-center gap-1.5">
                  <Typography.Text strong className="text-xs text-slate-700">Ngôn ngữ audio</Typography.Text>
                  <Tooltip title="Ngôn ngữ chính trong các bài audio để Whisper AI nhận dạng chính xác hơn.">
                    <QuestionCircleOutlined className="text-brand-500 cursor-help text-xs" />
                  </Tooltip>
                </div>
                <Select
                  className="!w-full"
                  value={language}
                  disabled={processing || whisperSetupBusy}
                  onChange={(value) => saveAudioSettings({ language: value })}
                  options={[
                    { value: 'auto', label: 'Tự động nhận diện' },
                    { value: 'vi', label: 'Tiếng Việt' },
                    { value: 'ja', label: 'Tiếng Nhật' },
                    { value: 'en', label: 'Tiếng Anh' },
                    { value: 'zh', label: 'Tiếng Trung' },
                    { value: 'ko', label: 'Tiếng Hàn' },
                  ]}
                />
              </div>

              <div className="bg-slate-50/70 p-3.5 rounded-md border border-slate-200/80 space-y-2">
                <div className="flex items-center gap-1.5">
                  <Typography.Text strong className="text-xs text-slate-700">Số CPU thread</Typography.Text>
                  <Tooltip title="Số nhân CPU xử lý song song. Mặc định 4 threads giúp nhận dạng nhanh mà không làm giật đơ ứng dụng.">
                    <QuestionCircleOutlined className="text-brand-500 cursor-help text-xs" />
                  </Tooltip>
                </div>
                <InputNumber
                  className="!w-full"
                  min={1}
                  max={8}
                  value={whisperThreads}
                  disabled={processing || whisperSetupBusy}
                  onChange={(value) => saveAudioSettings({ whisperThreads: value ?? 4 })}
                />
                <Typography.Text className="block text-[11px] text-slate-500">
                  Mặc định 4 threads giúp hệ thống luôn mượt mà.
                </Typography.Text>
              </div>
            </div>
          </div>
        )}
      </Card>

      {/* Job Running Progress Banner */}
      {job && (
        <Alert
          className="!rounded-lg shadow-sm border border-slate-200"
          type={job.phase === 'error' ? 'error' : job.phase === 'complete' ? 'success' : 'info'}
          showIcon
          message={<span className="font-semibold text-xs">{job.message}</span>}
          description={
            <div className="space-y-2 pt-1">
              {job.error && <Typography.Text type="danger" className="text-xs block">{job.error}</Typography.Text>}
              <Progress
                percent={job.percent}
                status={
                  job.phase === 'error'
                    ? 'exception'
                    : job.phase === 'complete'
                      ? 'success'
                      : 'active'
                }
              />
              {!processing && (
                <Button size="small" onClick={() => dismissJob(projectId)} className="!rounded-md">
                  Đóng thông báo
                </Button>
              )}
            </div>
          }
        />
      )}

      {/* Floating Bottom Action Bar */}
      <ActionBar
        leftContent={
          missingRequirements.length > 0 ? (
            <div className="flex items-center gap-1.5 text-amber-700 text-xs font-medium">
              <WarningOutlined className="text-amber-500 text-sm shrink-0" />
              <span>Chưa thể ghép: Cần {missingRequirements.join(', ')}.</span>
            </div>
          ) : (
            <div className="flex items-center gap-2 text-xs text-slate-600 font-medium">
              <Tag color="volcano" className="!mr-0 font-mono font-semibold">
                {items.length} audio
              </Tag>
              <span>+ {pauseSeconds}s khoảng nghỉ</span>
              <span className="text-slate-300">|</span>
              <span className="text-slate-500 font-mono truncate max-w-[300px]">
                Output: {outputPath.split(/[\\/]/).pop() || 'merged-audio.mp3'}
              </span>
            </div>
          )
        }
        rightContent={
          <Button
            type="primary"
            icon={<AudioOutlined />}
            loading={processing}
            disabled={missingRequirements.length > 0 || whisperSetupBusy || mediaBusy}
            onClick={merge}
            className="!rounded-md font-medium px-5 shadow-sm"
          >
            {createSrt ? 'Ghép audio & Xuất SRT' : 'Ghép audio ngay'}
          </Button>
        }
      />
    </main>
  )
}
