import { useEffect, useMemo, useState } from 'react'
import {
  Alert,
  App,
  Button,
  Card,
  Empty,
  Input,
  InputNumber,
  Space,
  Table,
  Tag,
  Tooltip,
  Typography,
} from 'antd'
import type { ColumnsType } from 'antd/es/table'
import {
  CheckOutlined,
  DeleteOutlined,
  FilterOutlined,
  FolderOpenOutlined,
  FolderViewOutlined,
  InfoCircleOutlined,
  PlayCircleOutlined,
  QuestionCircleOutlined,
  ReloadOutlined,
  SearchOutlined,
  SwapOutlined,
  VideoCameraOutlined,
  WarningOutlined,
} from '@ant-design/icons'
import type { VideoShuffleFileItem, VideoShuffleShortFileItem } from '../../electron/types'
import { useProjectStore } from '../stores/useProjectStore'

interface VideoShuffleRow extends VideoShuffleFileItem {
  key: string
  newName: string
}

interface ShortVideoRow extends VideoShuffleShortFileItem {
  key: string
}

function cleanError(error: unknown): string {
  const text = error instanceof Error ? error.message : String(error)
  return text.replace(/^Error invoking remote method '[^']+': Error: /, '')
}

function formatSize(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return 'Chưa rõ'
  const units = ['B', 'KB', 'MB', 'GB']
  let value = bytes
  let index = 0
  while (value >= 1024 && index < units.length - 1) {
    value /= 1024
    index += 1
  }
  return `${value.toFixed(index === 0 ? 0 : 1)} ${units[index]}`
}

function formatDuration(seconds: number): string {
  if (seconds < 60) return `${seconds.toFixed(2)}s`
  const minutes = Math.floor(seconds / 60)
  const remainder = seconds % 60
  return `${minutes}m ${remainder.toFixed(1).padStart(4, '0')}s`
}

function makeRows(files: VideoShuffleFileItem[]): VideoShuffleRow[] {
  return files.map((file) => ({
    ...file,
    key: file.path,
    newName: '',
  }))
}

function shuffle<T>(items: T[]): T[] {
  const next = [...items]
  for (let index = next.length - 1; index > 0; index -= 1) {
    const randomIndex = Math.floor(Math.random() * (index + 1))
    ;[next[index], next[randomIndex]] = [next[randomIndex], next[index]]
  }
  return next
}

function withSequentialNames(rows: VideoShuffleRow[]): VideoShuffleRow[] {
  const width = Math.max(3, String(rows.length).length)
  return rows.map((row, index) => ({
    ...row,
    newName: `${String(index + 1).padStart(width, '0')}${row.extension}`,
  }))
}

export default function VideoShufflePage() {
  const { message, modal } = App.useApp()
  const activeProject = useProjectStore((state) => state.activeProject)
  const updateVideoShuffleSettings = useProjectStore((state) => state.updateVideoShuffleSettings)
  const [videoDirectory, setVideoDirectory] = useState('')
  const [rows, setRows] = useState<VideoShuffleRow[]>([])
  const [shortRows, setShortRows] = useState<ShortVideoRow[]>([])
  const [shortVideoThresholdSeconds, setShortVideoThresholdSeconds] = useState(5)
  const [loading, setLoading] = useState(false)
  const [renaming, setRenaming] = useState(false)
  const [scanningShortVideos, setScanningShortVideos] = useState(false)
  const [deletingShortVideos, setDeletingShortVideos] = useState(false)

  useEffect(() => {
    setVideoDirectory(activeProject?.videoShuffleSettings.videoDirectory ?? '')
    setShortVideoThresholdSeconds(
      activeProject?.videoShuffleSettings.shortVideoThresholdSeconds ?? 5,
    )
    setRows([])
    setShortRows([])
  }, [activeProject?.id])

  function saveSettings(patch: Partial<NonNullable<typeof activeProject>['videoShuffleSettings']>) {
    void updateVideoShuffleSettings(patch)
  }

  async function selectDirectory() {
    setLoading(true)
    try {
      const result = await window.videoBuilder.selectVideoShuffleDirectory()
      if (!result) return
      setVideoDirectory(result.directory)
      setRows(makeRows(result.files))
      setShortRows([])
      saveSettings({ videoDirectory: result.directory })
      message.success(`Đã đọc ${result.files.length} tệp video.`)
    } catch (error) {
      message.error(cleanError(error), 8)
    } finally {
      setLoading(false)
    }
  }

  async function scanDirectory() {
    if (!videoDirectory) {
      message.warning('Vui lòng chọn thư mục chứa video trước.')
      return
    }
    setLoading(true)
    try {
      const result = await window.videoBuilder.scanVideoShuffleDirectory(videoDirectory)
      setRows(makeRows(result.files))
      setShortRows([])
      message.success(`Đã cập nhật lại ${result.files.length} tệp video.`)
    } catch (error) {
      message.error(cleanError(error), 8)
    } finally {
      setLoading(false)
    }
  }

  function shuffleVideos() {
    if (rows.length === 0) {
      message.warning('Chưa có video để xáo tên.')
      return
    }
    setRows(withSequentialNames(shuffle(rows)))
    message.info('Đã tạo tên mới ngẫu nhiên. Bấm "Đổi tên video thực tế" để áp dụng.')
  }

  async function confirmRename() {
    if (!rows.every((row) => row.newName)) {
      message.warning('Vui lòng bấm "Xáo ngẫu nhiên" để xem trước tên mới trước.')
      return
    }

    modal.confirm({
      title: 'Đổi tên các tệp video gốc?',
      content: `Ứng dụng sẽ tiến hành đổi tên trực tiếp ${rows.length} file video trong thư mục gốc. Bạn có chắc chắn muốn thực hiện?`,
      okText: 'Đổi tên thực tế',
      cancelText: 'Hủy',
      okButtonProps: { danger: true },
      onOk: async () => {
        setRenaming(true)
        try {
          const result = await window.videoBuilder.renameVideoShuffleFiles(
            rows.map((row) => ({
              path: row.path,
              newName: row.newName,
            })),
          )
          message.success(`Đã đổi tên thành công ${result.renamed} video.`)
          await scanDirectory()
        } catch (error) {
          message.error(cleanError(error), 8)
        } finally {
          setRenaming(false)
        }
      },
    })
  }

  async function scanShortVideos() {
    if (!videoDirectory) {
      message.warning('Vui lòng chọn thư mục chứa video trước.')
      return
    }
    setScanningShortVideos(true)
    try {
      const result = await window.videoBuilder.scanShortVideoShuffleFiles(
        videoDirectory,
        shortVideoThresholdSeconds,
      )
      setShortRows(result.files.map((file) => ({ ...file, key: file.path })))
      saveSettings({ shortVideoThresholdSeconds })
      message.success(`Tìm thấy ${result.files.length} video ngắn từ ${shortVideoThresholdSeconds}s trở xuống.`)
    } catch (error) {
      message.error(cleanError(error), 8)
    } finally {
      setScanningShortVideos(false)
    }
  }

  async function confirmDeleteShortVideos() {
    if (shortRows.length === 0) {
      message.warning('Chưa có video ngắn để xóa. Vui lòng bấm "Quét tìm video ngắn" trước.')
      return
    }

    modal.confirm({
      title: `Xóa ${shortRows.length} video ngắn vào Thùng rác?`,
      content: `Ứng dụng sẽ chuyển ${shortRows.length} video có thời lượng từ ${shortVideoThresholdSeconds}s trở xuống vào Thùng rác hệ thống (Trash).`,
      okText: 'Xóa vào Thùng rác',
      cancelText: 'Hủy',
      okButtonProps: { danger: true },
      onOk: async () => {
        setDeletingShortVideos(true)
        try {
          const result = await window.videoBuilder.deleteVideoShuffleFiles(
            shortRows.map((row) => row.path),
          )
          message.success(`Đã chuyển ${result.deleted} video vào Thùng rác thành công.`)
          setShortRows([])
          await scanDirectory()
        } catch (error) {
          message.error(cleanError(error), 8)
        } finally {
          setDeletingShortVideos(false)
        }
      },
    })
  }

  const canRename = rows.length > 0 && rows.every((row) => row.newName)
  const busy = loading || renaming || scanningShortVideos || deletingShortVideos

  const columns = useMemo<ColumnsType<VideoShuffleRow>>(
    () => [
      {
        title: '#',
        width: 70,
        render: (_, __, index) => (
          <Tag color="volcano" className="font-mono text-xs font-semibold !mr-0">
            #{String(index + 1).padStart(3, '0')}
          </Tag>
        ),
      },
      {
        title: 'Tên video hiện tại',
        dataIndex: 'name',
        render: (name: string, row) => (
          <div className="space-y-1">
            <Typography.Text strong className="text-xs text-slate-800 block">
              {name}
            </Typography.Text>
            <div className="flex items-center gap-1.5 text-[11px]">
              <Tag color="blue" className="!mr-0 font-mono text-[10px]">
                {row.extension.replace('.', '').toUpperCase()}
              </Tag>

              <Tag color="default" className="!mr-0 text-[10px]">
                {formatSize(row.size)}
              </Tag>
            </div>
          </div>
        ),
      },
      {
        title: 'Tên mới sẽ đổi (Preview)',
        dataIndex: 'newName',
        width: 220,
        render: (newName: string) =>
          newName ? (
            <Tag color="green" className="font-mono text-xs font-bold px-2 py-0.5 !mr-0">
              {newName}
            </Tag>
          ) : (
            <span className="text-xs text-slate-400 italic">Chưa xáo tên</span>
          ),
      },
    ],
    [],
  )

  const shortColumns = useMemo<ColumnsType<ShortVideoRow>>(
    () => [
      {
        title: '#',
        width: 70,
        render: (_, __, index) => (
          <Tag color="default" className="font-mono text-xs font-semibold !mr-0">
            #{String(index + 1).padStart(3, '0')}
          </Tag>
        ),
      },
      {
        title: 'Tên video ngắn',
        dataIndex: 'name',
        render: (name: string, row) => (
          <div className="space-y-1">
            <Typography.Text strong className="text-xs text-slate-800 block">
              {name}
            </Typography.Text>
            <div className="flex items-center gap-1.5">
              <Tag color="default" className="!mr-0 text-[10px]">
                {row.extension.replace('.', '').toUpperCase()}
              </Tag>
              <Tag color="default" className="!mr-0 text-[10px]">
                {formatSize(row.size)}
              </Tag>
            </div>
          </div>
        ),
      },
      {
        title: 'Thời lượng',
        dataIndex: 'durationSeconds',
        width: 140,
        render: (durationSeconds: number) => (
          <Tag color="red" className="font-mono font-semibold text-xs !mr-0">
            {formatDuration(durationSeconds)}
          </Tag>
        ),
      },
    ],
    [],
  )

  return (
    <main className="mx-auto max-w-5xl space-y-5 pb-12">
      {/* Top Banner Notice */}
      <Alert
        type="warning"
        showIcon
        className="!rounded-md border-amber-200 bg-amber-50/70"
        message={<span className="font-semibold text-xs text-amber-900">Lưu ý khi sử dụng</span>}
        description={
          <span className="text-xs text-amber-800">
            Công cụ này sẽ thao tác trực tiếp trên các tệp video trong thư mục gốc. Khi đổi tên hoặc xóa video ngắn vào Thùng rác, hãy kiểm tra kỹ danh sách trước khi bấm xác nhận.
          </span>
        }
      />

      {/* Card 1: Nguồn tệp video */}
      <Card
        className="!rounded-lg border border-slate-200/80 shadow-sm"
        title={
          <div className="flex items-center gap-2">
            <VideoCameraOutlined className="text-brand-500 text-base" />
            <span className="font-semibold text-slate-800">Nguồn tệp video gốc</span>
            <Tooltip title="Chọn thư mục chứa danh sách các bài video gốc (MP4, MOV...).">
              <QuestionCircleOutlined className="text-slate-400 cursor-help text-xs hover:text-brand-500" />
            </Tooltip>
          </div>
        }
        extra={
          videoDirectory && (
            <Button
              size="small"
              icon={<ReloadOutlined />}
              loading={loading}
              disabled={busy}
              onClick={() => void scanDirectory()}
              className="!rounded-md"
            >
              Nạp lại danh sách
            </Button>
          )
        }
      >
        <Space.Compact className="w-full">
          <Input
            value={videoDirectory}
            readOnly
            placeholder="Chưa chọn thư mục video gốc"
            className="!rounded-l-md font-mono text-xs"
          />
          <Button
            type="primary"
            icon={<FolderOpenOutlined />}
            loading={loading}
            disabled={busy}
            onClick={() => void selectDirectory()}
            className="!rounded-r-md"
          >
            Chọn thư mục video
          </Button>
        </Space.Compact>
      </Card>

      {/* Card 2: Lọc & Xóa video rác ngắn */}
      <Card
        className="!rounded-lg border border-slate-200/80 shadow-sm"
        title={
          <div className="flex items-center gap-2">
            <FilterOutlined className="text-brand-500 text-base" />
            <span className="font-semibold text-slate-800">Lọc & Xóa video rác ngắn</span>
            <Tooltip title="Tìm và loại bỏ các video ngắn không đủ thời lượng để tránh đưa vào dựng phim.">
              <QuestionCircleOutlined className="text-slate-400 cursor-help text-xs hover:text-brand-500" />
            </Tooltip>
          </div>
        }
        extra={
          <Space>
            <Button
              icon={<SearchOutlined />}
              loading={scanningShortVideos}
              disabled={!videoDirectory || busy}
              onClick={() => void scanShortVideos()}
              className="!rounded-md text-xs"
            >
              Quét tìm video ngắn
            </Button>
            <Button
              danger
              icon={<DeleteOutlined />}
              loading={deletingShortVideos}
              disabled={shortRows.length === 0 || busy}
              onClick={() => void confirmDeleteShortVideos()}
              className="!rounded-md text-xs"
            >
              Xóa vào Thùng rác ({shortRows.length})
            </Button>
          </Space>
        }
      >
        <div className="space-y-4">
          <div className="bg-slate-50/70 p-3.5 rounded-md border border-slate-200/80 grid gap-4 md:grid-cols-[240px_1fr] items-center">
            <div className="space-y-1.5">
              <Typography.Text strong className="text-xs text-slate-700 block">
                Ngưỡng thời lượng tối đa
              </Typography.Text>
              <InputNumber
                className="!w-full"
                min={0.1}
                max={3600}
                step={0.5}
                precision={1}
                addonAfter="giây"
                value={shortVideoThresholdSeconds}
                disabled={busy}
                onChange={(value) => {
                  const nextValue = value ?? 5
                  setShortVideoThresholdSeconds(nextValue)
                  setShortRows([])
                  saveSettings({ shortVideoThresholdSeconds: nextValue })
                }}
              />
            </div>

            <div className="text-xs text-slate-500 leading-relaxed border-l border-slate-200/80 pl-4 hidden md:block">
              Tìm tất cả tệp video có thời lượng <strong className="text-slate-700">≤ {shortVideoThresholdSeconds}s</strong>. Các video ngắn tìm thấy sẽ được liệt kê bên dưới để bạn kiểm tra trước khi bấm xóa vào Thùng rác.
            </div>
          </div>

          {shortRows.length === 0 ? (
            <div className="py-6 text-center bg-slate-50/40 rounded-md border border-dashed border-slate-200">
              <Typography.Text className="text-xs text-slate-400">
                Chưa có video ngắn nào được nạp. Bấm "Quét tìm video ngắn" ở trên để lọc.
              </Typography.Text>
            </div>
          ) : (
            <Table
              className="rounded-md border border-slate-200 overflow-hidden"
              rowKey="key"
              columns={shortColumns}
              dataSource={shortRows}
              loading={scanningShortVideos}
              pagination={{ pageSize: 5, showSizeChanger: false }}
            />
          )}
        </div>
      </Card>

      {/* Card 3: Danh sách video & Xáo tên ngẫu nhiên */}
      <Card
        className="!rounded-lg border border-slate-200/80 shadow-sm"
        title={
          <div className="flex items-center gap-2">
            <SwapOutlined className="text-brand-500 text-base" />
            <span className="font-semibold text-slate-800">
              Danh sách video ({rows.length})
            </span>
          </div>
        }
        extra={
          <Space>
            <Button
              icon={<SwapOutlined />}
              disabled={rows.length === 0 || busy}
              onClick={shuffleVideos}
              className="!rounded-md font-medium"
            >
              Xáo ngẫu nhiên tên
            </Button>
            <Button
              type="primary"
              danger
              icon={<CheckOutlined />}
              loading={renaming}
              disabled={!canRename || busy}
              onClick={() => void confirmRename()}
              className="!rounded-md font-semibold"
            >
              Đổi tên video thực tế
            </Button>
          </Space>
        }
      >
        {rows.length === 0 ? (
          <div className="py-10 text-center bg-slate-50/40 rounded-md border border-dashed border-slate-200 space-y-3">
            <VideoCameraOutlined className="text-3xl text-slate-300" />
            <div>
              <Typography.Text strong className="block text-slate-700 text-sm">
                Chưa có video nào trong danh sách
              </Typography.Text>
              <Typography.Text className="text-slate-500 text-xs">
                Vui lòng chọn Thư mục video ở trên để hiển thị danh sách bài video.
              </Typography.Text>
            </div>
            <Button
              type="primary"
              icon={<FolderOpenOutlined />}
              disabled={busy}
              onClick={() => void selectDirectory()}
              className="!rounded-md"
            >
              Chọn thư mục video
            </Button>
          </div>
        ) : (
          <Table
            className="rounded-md border border-slate-200 overflow-hidden"
            rowKey="key"
            columns={columns}
            dataSource={rows}
            loading={loading}
            pagination={{ pageSize: 15, showSizeChanger: false }}
          />
        )}
      </Card>
    </main>
  )
}
