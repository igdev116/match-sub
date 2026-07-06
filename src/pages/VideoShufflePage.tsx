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
  Typography,
} from 'antd'
import type { ColumnsType } from 'antd/es/table'
import {
  DeleteOutlined,
  FolderOpenOutlined,
  PlayCircleOutlined,
  ReloadOutlined,
  SwapOutlined,
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
  if (!Number.isFinite(bytes) || bytes <= 0) return 'Không rõ'
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
      message.success(`Đã đọc ${result.files.length} video.`)
    } catch (error) {
      message.error(cleanError(error), 8)
    } finally {
      setLoading(false)
    }
  }

  async function scanDirectory() {
    if (!videoDirectory) {
      message.warning('Chưa chọn folder video.')
      return
    }
    setLoading(true)
    try {
      const result = await window.videoBuilder.scanVideoShuffleDirectory(videoDirectory)
      setRows(makeRows(result.files))
      setShortRows([])
      message.success(`Đã đọc ${result.files.length} video.`)
    } catch (error) {
      message.error(cleanError(error), 8)
    } finally {
      setLoading(false)
    }
  }

  function shuffleVideos() {
    if (rows.length === 0) {
      message.warning('Chưa có video để xáo.')
      return
    }
    setRows(withSequentialNames(shuffle(rows)))
  }

  async function confirmRename() {
    if (!rows.every((row) => row.newName)) {
      message.warning('Bấm "Xáo ngẫu nhiên" để tạo preview tên mới trước.')
      return
    }

    modal.confirm({
      title: 'Đổi tên video thật?',
      content: `App sẽ đổi tên ${rows.length} file video trong folder đã chọn. Thao tác này sẽ thay đổi tên file gốc.`,
      okText: 'Đổi tên video',
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
          message.success(`Đã đổi tên ${result.renamed} video.`)
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
      message.warning('Chưa chọn folder video.')
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
      message.success(`Tìm thấy ${result.files.length} video từ ${shortVideoThresholdSeconds}s trở xuống.`)
    } catch (error) {
      message.error(cleanError(error), 8)
    } finally {
      setScanningShortVideos(false)
    }
  }

  async function confirmDeleteShortVideos() {
    if (shortRows.length === 0) {
      message.warning('Chưa có video ngắn để xoá. Bấm "Tìm video ngắn" trước.')
      return
    }

    modal.confirm({
      title: `Xoá ${shortRows.length} video ngắn?`,
      content: `App sẽ đưa ${shortRows.length} video có thời lượng từ ${shortVideoThresholdSeconds}s trở xuống vào Thùng rác.`,
      okText: 'Xoá video ngắn',
      cancelText: 'Hủy',
      okButtonProps: { danger: true },
      onOk: async () => {
        setDeletingShortVideos(true)
        try {
          const result = await window.videoBuilder.deleteVideoShuffleFiles(
            shortRows.map((row) => row.path),
          )
          message.success(`Đã đưa ${result.deleted} video vào Thùng rác.`)
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
        width: 72,
        render: (_, __, index) => <Typography.Text strong>{index + 1}</Typography.Text>,
      },
      {
        title: 'Tên hiện tại',
        dataIndex: 'name',
        render: (name: string, row) => (
          <div>
            <Typography.Text>{name}</Typography.Text>
            <div className="mt-1 flex gap-2">
              <Tag>{row.extension.replace('.', '').toUpperCase()}</Tag>
              <Tag>{formatSize(row.size)}</Tag>
            </div>
          </div>
        ),
      },
      {
        title: 'Tên mới',
        dataIndex: 'newName',
        render: (newName: string) =>
          newName ? (
            <Typography.Text strong>{newName}</Typography.Text>
          ) : (
            <Typography.Text type="secondary">Chưa xáo</Typography.Text>
          ),
      },
    ],
    [],
  )
  const shortColumns = useMemo<ColumnsType<ShortVideoRow>>(
    () => [
      {
        title: '#',
        width: 72,
        render: (_, __, index) => <Typography.Text strong>{index + 1}</Typography.Text>,
      },
      {
        title: 'Tên video',
        dataIndex: 'name',
        render: (name: string, row) => (
          <div>
            <Typography.Text>{name}</Typography.Text>
            <div className="mt-1 flex gap-2">
              <Tag>{row.extension.replace('.', '').toUpperCase()}</Tag>
              <Tag>{formatSize(row.size)}</Tag>
            </div>
          </div>
        ),
      },
      {
        title: 'Thời lượng',
        dataIndex: 'durationSeconds',
        width: 160,
        render: (durationSeconds: number) => (
          <Tag color="red">{formatDuration(durationSeconds)}</Tag>
        ),
      },
    ],
    [],
  )

  return (
    <main className="mx-auto max-w-5xl space-y-5 pb-10">
      <header className="rounded-3xl bg-gradient-to-r from-slate-900 to-indigo-700 p-8 shadow-lg">
        <Typography.Title className="!mb-1 !text-white" level={2}>
          <SwapOutlined /> Xáo video
        </Typography.Title>
        <Typography.Text className="!text-white/70">
          Xáo ngẫu nhiên danh sách video và đổi tên thành số tăng dần
        </Typography.Text>
      </header>

      <Alert
        type="warning"
        showIcon
        message="Lưu ý"
        description="Chức năng này đổi tên file video thật trong folder đã chọn. Hãy kiểm tra bảng preview trước khi bấm đổi tên."
      />

      <Card
        title="Nguồn video"
        extra={
          <Space>
            {videoDirectory && (
              <Button
                icon={<ReloadOutlined />}
                loading={loading}
                disabled={busy}
                onClick={() => void scanDirectory()}
              >
                Tải danh sách
              </Button>
            )}
            <Button
              type="primary"
              icon={<FolderOpenOutlined />}
              loading={loading}
              disabled={busy}
              onClick={() => void selectDirectory()}
            >
              Chọn folder video
            </Button>
          </Space>
        }
      >
        <Space.Compact className="w-full">
          <Input value={videoDirectory} readOnly placeholder="Chọn folder chứa video" />
          <Button
            icon={<FolderOpenOutlined />}
            loading={loading}
            disabled={busy}
            onClick={() => void selectDirectory()}
          >
            Chọn folder
          </Button>
        </Space.Compact>
      </Card>

      <Card
        title="Xoá video ngắn"
        extra={
          <Space>
            <Button
              icon={<ReloadOutlined />}
              loading={scanningShortVideos}
              disabled={!videoDirectory || busy}
              onClick={() => void scanShortVideos()}
            >
              Tìm video ngắn
            </Button>
            <Button
              danger
              icon={<DeleteOutlined />}
              loading={deletingShortVideos}
              disabled={shortRows.length === 0 || busy}
              onClick={() => void confirmDeleteShortVideos()}
            >
              Xoá video ngắn
            </Button>
          </Space>
        }
      >
        <Alert
          className="mb-4"
          type="warning"
          showIcon
          message="Xoá theo thời lượng"
          description="Nhập số giây, bấm tìm để preview danh sách video sẽ bị xoá. Khi xác nhận, file được đưa vào Thùng rác."
        />
        <div className="mb-4 grid gap-4 md:grid-cols-[260px_1fr]">
          <div>
            <Typography.Text strong>Xoá video từ bao nhiêu giây trở xuống</Typography.Text>
            <InputNumber
              className="mt-2 !w-full"
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
          <div className="rounded-lg bg-slate-50 px-4 py-3">
            <Typography.Text type="secondary">
              Ví dụ nhập <strong>5s</strong> thì app sẽ tìm video có thời lượng ≤ 5 giây.
              Video không đọc được duration sẽ được bỏ qua để tránh xoá nhầm.
            </Typography.Text>
          </div>
        </div>
        {shortRows.length === 0 ? (
          <Empty
            description="Chưa có video ngắn trong preview"
            image={Empty.PRESENTED_IMAGE_SIMPLE}
          />
        ) : (
          <Table
            rowKey="key"
            columns={shortColumns}
            dataSource={shortRows}
            loading={scanningShortVideos}
            pagination={{ pageSize: 10, showSizeChanger: false }}
          />
        )}
      </Card>

      <Card
        title={`Danh sách video (${rows.length})`}
        extra={
          <Space>
            <Button
              icon={<SwapOutlined />}
              disabled={rows.length === 0 || busy}
              onClick={shuffleVideos}
            >
              Xáo ngẫu nhiên
            </Button>
            <Button
              type="primary"
              danger
              icon={<PlayCircleOutlined />}
              loading={renaming}
              disabled={!canRename || busy}
              onClick={() => void confirmRename()}
            >
              Đổi tên video
            </Button>
          </Space>
        }
      >
        {rows.length === 0 ? (
          <Empty description="Chưa có video" image={Empty.PRESENTED_IMAGE_SIMPLE}>
            <Space>
              {videoDirectory && (
                <Button
                  icon={<ReloadOutlined />}
                  loading={loading}
                  disabled={busy}
                  onClick={() => void scanDirectory()}
                >
                  Tải danh sách
                </Button>
              )}
              <Button
                type="primary"
                icon={<FolderOpenOutlined />}
                disabled={busy}
                onClick={() => void selectDirectory()}
              >
                Chọn folder video
              </Button>
            </Space>
          </Empty>
        ) : (
          <Table
            rowKey="key"
            columns={columns}
            dataSource={rows}
            loading={loading}
            pagination={{ pageSize: 20, showSizeChanger: false }}
          />
        )}
      </Card>
    </main>
  )
}
