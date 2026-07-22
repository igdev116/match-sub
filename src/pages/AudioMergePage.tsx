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
  Typography,
} from 'antd'
import {
  AudioOutlined,
  DeleteOutlined,
  FolderOpenOutlined,
  FolderViewOutlined,
  HolderOutlined,
  PlusOutlined,
  ReloadOutlined,
} from '@ant-design/icons'
import type { AudioFileItem, WhisperProgress, WhisperStatus } from '../../electron/types'
import { useProjectStore } from '../stores/useProjectStore'

interface AudioItem {
  id: string
  path: string
  name: string
  durationSeconds: number | null
}

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
  item: AudioItem
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
        background: isDragging ? '#f5f3ff' : undefined,
      }}
      actions={[
        <Button
          key="remove"
          type="text"
          danger
          icon={<DeleteOutlined />}
          disabled={disabled}
          onClick={onRemove}
        />,
      ]}
    >
      <div className="flex min-w-0 flex-1 items-center gap-3">
        <Button
          type="text"
          icon={<HolderOutlined />}
          className="cursor-grab"
          disabled={disabled}
          {...attributes}
          {...listeners}
        />
        <Tag className="shrink-0">{index + 1}</Tag>
        <AudioOutlined className="shrink-0 text-lg text-violet-600" />
        <div className="min-w-0 flex-1">
          <Typography.Text className="block" ellipsis={{ tooltip: item.name }}>
            {item.name}
          </Typography.Text>
          <Typography.Text type="secondary" className="block text-xs">
            {formatDuration(item.durationSeconds)}
          </Typography.Text>
        </div>
      </div>
    </List.Item>
  )
}

export default function AudioMergePage() {
  const { message } = App.useApp()
  const [items, setItems] = useState<AudioItem[]>([])
  const [currentPage, setCurrentPage] = useState(1)
  const [audioDirectory, setAudioDirectory] = useState('')
  const [outputPath, setOutputPath] = useState('')
  const [srtOutputPath, setSrtOutputPath] = useState('')
  const [processing, setProcessing] = useState(false)
  const [directoryLoading, setDirectoryLoading] = useState(false)
  const durationRequestedPaths = useRef(new Set<string>())
  const activeProject = useProjectStore((state) => state.activeProject)
  const updateAudioSettings = useProjectStore((state) => state.updateAudioSettings)
  const audioSettings = activeProject?.audioSettings
  const audioOutputDirectory = audioSettings?.audioOutputDirectory ?? ''
  const pageSize = audioSettings?.pageSize ?? 10
  const pauseSeconds = audioSettings?.pauseSeconds ?? 1
  const createSrt = audioSettings?.createSrt ?? true
  const language = audioSettings?.language ?? 'auto'
  const whisperThreads = audioSettings?.whisperThreads ?? 4
  const [whisperStatus, setWhisperStatus] = useState<WhisperStatus | null>(null)
  const [whisperProgress, setWhisperProgress] = useState<WhisperProgress | null>(null)
  const [whisperSetupBusy, setWhisperSetupBusy] = useState(false)
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }))

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void refreshWhisperStatus()
    }, 300)
    const unsubscribe = window.videoBuilder.onWhisperProgress(setWhisperProgress)
    return () => {
      window.clearTimeout(timer)
      unsubscribe()
    }
  }, [])

  useEffect(() => {
    if (!audioSettings) return
    setAudioDirectory(audioSettings.audioDirectory)
    const nextOutputPath =
      audioSettings.outputPath || audioOutputPath(audioSettings.audioOutputDirectory)
    setOutputPath(nextOutputPath)
    setSrtOutputPath(audioSettings.srtOutputPath || srtOutputPathFromAudio(nextOutputPath))
    setItems([])
    setCurrentPage(1)
    durationRequestedPaths.current.clear()
  }, [activeProject?.id])

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
    setWhisperProgress(null)
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

  function createAudioItems(items: AudioFileItem[]): AudioItem[] {
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

    setProcessing(true)
    try {
      await window.videoBuilder.mergeAudio({
        files: items.map((item) => item.path),
        pauseSeconds,
        outputPath,
        srtOutputPath,
        createSrt,
        language,
        whisperThreads,
      })
      message.success(
        createSrt
          ? `Đã ghép audio: ${outputPath} và xuất SRT: ${srtOutputPath}`
          : `Đã ghép audio: ${outputPath}`,
        6,
      )
    } catch (error) {
      message.error(cleanError(error), 8)
    } finally {
      setProcessing(false)
    }
  }

  return (
    <main className="mx-auto max-w-5xl space-y-5 pb-10">
      <header className="page-hero">
        <Typography.Title className="!mb-1 !text-white" level={2}>
          <AudioOutlined /> Ghép audio
        </Typography.Title>
        <Typography.Text className="!text-white/70">
          Ghép nhiều audio thành một file và tự chèn khoảng nghỉ giữa các đoạn
        </Typography.Text>
      </header>

      <Card
        title={`Danh sách audio (${items.length})`}
        extra={
          <Space>
            {audioDirectory && (
              <Button
                icon={<ReloadOutlined />}
                loading={directoryLoading}
                disabled={processing}
                onClick={() => void refreshAudioDirectory()}
              >
                Tải danh sách
              </Button>
            )}
            {items.length > 0 && (
              <Button disabled={processing} onClick={() => setItems([])}>
                Xóa tất cả
              </Button>
            )}
            <Button
              icon={<PlusOutlined />}
              disabled={processing}
              onClick={addFiles}
            >
              Thêm audio
            </Button>
            <Button
              type="primary"
              icon={<FolderOpenOutlined />}
              disabled={processing}
              onClick={() => void selectAudioDirectory()}
            >
              Chọn thư mục
            </Button>
          </Space>
        }
      >
        {audioDirectory && (
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-lg bg-slate-50 px-4 py-3">
            <div className="min-w-0">
              <Typography.Text type="secondary">Thư mục đang theo dõi:</Typography.Text>{' '}
              <Typography.Text copyable ellipsis={{ tooltip: audioDirectory }}>
                {audioDirectory}
              </Typography.Text>
              {items.length === 0 && (
                <Typography.Text className="mt-1 block text-xs" type="secondary">
                  App không tự đọc folder khi mở trang để tránh lag. Bấm tải danh sách khi cần.
                </Typography.Text>
              )}
            </div>
            <Button
              icon={<ReloadOutlined />}
              loading={directoryLoading}
              disabled={processing}
              onClick={() => void refreshAudioDirectory()}
            >
              Tải danh sách
            </Button>
          </div>
        )}
        {items.length === 0 ? (
          <Empty description="Chưa có audio" image={Empty.PRESENTED_IMAGE_SIMPLE}>
            <Space>
              {audioDirectory && (
                <Button
                  icon={<ReloadOutlined />}
                  loading={directoryLoading}
                  disabled={processing}
                  onClick={() => void refreshAudioDirectory()}
                >
                  Tải danh sách từ thư mục đã nhớ
                </Button>
              )}
              <Button icon={<PlusOutlined />} onClick={addFiles}>
                Chọn nhiều file
              </Button>
              <Button
                type="primary"
                icon={<FolderOpenOutlined />}
                onClick={() => void selectAudioDirectory()}
              >
                Chọn thư mục
              </Button>
            </Space>
          </Empty>
        ) : (
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
            <SortableContext
              items={pagedItems.map((item) => item.id)}
              strategy={verticalListSortingStrategy}
            >
              <List
                bordered
                dataSource={pagedItems}
                renderItem={(item, index) => (
                  <SortableAudioItem
                    item={item}
                    index={pageStart + index}
                    disabled={processing}
                    onRemove={() =>
                      setItems((current) => current.filter((entry) => entry.id !== item.id))
                    }
                  />
                )}
              />
            </SortableContext>
            <div className="mt-4 flex justify-end">
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
          </DndContext>
        )}
      </Card>

      <Card title="Thiết lập output">
        <div className="grid gap-5 md:grid-cols-[220px_1fr]">
          <div>
            <Typography.Text strong>Khoảng nghỉ giữa các audio</Typography.Text>
            <InputNumber
              className="mt-2 !w-full"
              min={0}
              max={60}
              step={0.5}
              precision={1}
              addonAfter="giây"
              value={pauseSeconds}
              disabled={processing}
              onChange={(value) => saveAudioSettings({ pauseSeconds: value ?? 1 })}
            />
            <Typography.Text type="secondary" className="mt-2 block text-xs">
              {pauseCount} khoảng nghỉ, tổng cộng {totalPause.toFixed(1)} giây
            </Typography.Text>
          </div>
          <div>
            <Typography.Text strong>File MP3 output</Typography.Text>
            <Space.Compact className="mt-2 w-full">
              <Input value={outputPath} readOnly />
              <Button
                icon={<FolderViewOutlined />}
                disabled={!outputPath}
                onClick={() => void showOutputFolder()}
                title="Mở thư mục chứa"
              >
                Mở thư mục
              </Button>
              <Button
                icon={<FolderOpenOutlined />}
                disabled={processing}
                onClick={() => void chooseOutputPath()}
              >
                Chọn file MP3
              </Button>
            </Space.Compact>
            <Typography.Text type="secondary" className="mt-2 block text-xs">
              Có thể chọn file MP3 ở folder riêng, ví dụ output/audio/merged-audio.mp3.
            </Typography.Text>
          </div>
        </div>
      </Card>

      <Card
        title="Phụ đề SRT"
        extra={
          <Switch
            checked={createSrt}
            disabled={processing || whisperSetupBusy}
            onChange={(value) => saveAudioSettings({ createSrt: value })}
          />
        }
      >
        {!createSrt ? (
          <Typography.Text type="secondary">
            Bật để dùng Whisper nhận dạng lời nói và xuất file SRT cạnh audio.
          </Typography.Text>
        ) : (
          <div className="space-y-5">
            <div className="flex flex-wrap items-center gap-3">
              <Tag color={whisperStatus?.available ? 'success' : 'error'}>
                {whisperStatus?.available
                  ? whisperStatus.executableSource === 'bundled'
                    ? 'Whisper đi kèm app sẵn sàng'
                    : 'whisper.cpp sẵn sàng'
                  : 'Thiếu whisper.cpp'}
              </Tag>
              <Tag color={whisperStatus?.modelAvailable ? 'success' : 'warning'}>
                {whisperStatus?.modelAvailable
                  ? whisperStatus.modelSource === 'bundled'
                    ? 'Model base đi kèm app sẵn sàng'
                    : 'Model base sẵn sàng'
                  : 'Thiếu model base'}
              </Tag>
              {!whisperStatus?.available && whisperStatus?.installSupported && (
                <Button
                  type="primary"
                  loading={whisperSetupBusy}
                  disabled={processing}
                  onClick={() => void setupWhisper('install')}
                >
                  Cài bằng Homebrew
                </Button>
              )}
              {!whisperStatus?.modelAvailable && whisperStatus?.downloadSupported && (
                <Button
                  loading={whisperSetupBusy}
                  disabled={processing}
                  onClick={() => void setupWhisper('download')}
                >
                  Tải model base (~148 MB)
                </Button>
              )}
            </div>

            {whisperStatus?.repairMessage && (
              <Alert
                type="error"
                showIcon
                message="Bộ cài không đầy đủ"
                description={whisperStatus.repairMessage}
              />
            )}

            {whisperProgress && (
              <div>
                <Typography.Text>{whisperProgress.message}</Typography.Text>
                <Progress
                  className="!mb-0 mt-2"
                  percent={whisperProgress.percent}
                  status={whisperProgress.phase === 'error' ? 'exception' : 'active'}
                />
              </div>
            )}

            <div>
              <Typography.Text strong>File SRT output</Typography.Text>
              <Space.Compact className="mt-2 w-full">
                <Input value={srtOutputPath} readOnly />
                <Button
                  icon={<FolderViewOutlined />}
                  disabled={!srtOutputPath}
                  onClick={() => void showSrtOutputFolder()}
                  title="Mở thư mục chứa SRT"
                >
                  Mở thư mục
                </Button>
                <Button
                  icon={<FolderOpenOutlined />}
                  disabled={processing || whisperSetupBusy}
                  onClick={() => void chooseSrtOutputPath()}
                >
                  Chọn file SRT
                </Button>
              </Space.Compact>
              <Typography.Text type="secondary" className="mt-2 block text-xs">
                SRT có thể lưu khác folder với MP3. Nếu chưa chọn, app tự gợi ý cùng tên với MP3.
              </Typography.Text>
            </div>

            <div className="grid gap-5 md:grid-cols-2">
              <div>
                <Typography.Text strong>Ngôn ngữ audio</Typography.Text>
                <Select
                  className="mt-2 w-full"
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
              <div>
                <Typography.Text strong>Số CPU thread</Typography.Text>
                <InputNumber
                  className="mt-2 !w-full"
                  min={1}
                  max={8}
                  value={whisperThreads}
                  disabled={processing || whisperSetupBusy}
                  onChange={(value) => saveAudioSettings({ whisperThreads: value ?? 4 })}
                />
                <Typography.Text type="secondary" className="mt-2 block text-xs">
                  Mặc định 4 để app vẫn mượt khi Whisper chạy.
                </Typography.Text>
              </div>
            </div>
          </div>
        )}
      </Card>

      <div className="flex justify-center">
        <div className="flex w-full max-w-xl flex-col items-center gap-3">
          {missingRequirements.length > 0 && (
            <Alert
              className="w-full"
              type="warning"
              showIcon
              message="Chưa thể bắt đầu"
              description={`Cần ${missingRequirements.join(', ')}.`}
            />
          )}
          <Button
            type="primary"
            size="large"
            icon={<AudioOutlined />}
            loading={processing}
            disabled={missingRequirements.length > 0 || whisperSetupBusy}
            onClick={merge}
          >
            {createSrt ? 'Ghép audio và xuất SRT' : 'Ghép audio'}
          </Button>
        </div>
      </div>
    </main>
  )
}
