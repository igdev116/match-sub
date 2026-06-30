import { useEffect, useMemo, useState } from 'react'
import {
  Alert,
  App,
  Button,
  Card,
  Empty,
  Input,
  Space,
  Table,
  Tag,
  Typography,
} from 'antd'
import type { ColumnsType } from 'antd/es/table'
import {
  FolderOpenOutlined,
  PlayCircleOutlined,
  ReloadOutlined,
  SwapOutlined,
} from '@ant-design/icons'
import type { VideoShuffleFileItem } from '../../electron/types'
import { useProjectStore } from '../stores/useProjectStore'

interface VideoShuffleRow extends VideoShuffleFileItem {
  key: string
  newName: string
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
  const [loading, setLoading] = useState(false)
  const [renaming, setRenaming] = useState(false)

  useEffect(() => {
    setVideoDirectory(activeProject?.videoShuffleSettings.videoDirectory ?? '')
    setRows([])
  }, [activeProject?.id])

  function saveSettings(videoDirectory: string) {
    void updateVideoShuffleSettings({ videoDirectory })
  }

  async function selectDirectory() {
    setLoading(true)
    try {
      const result = await window.videoBuilder.selectVideoShuffleDirectory()
      if (!result) return
      setVideoDirectory(result.directory)
      setRows(makeRows(result.files))
      saveSettings(result.directory)
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

  const canRename = rows.length > 0 && rows.every((row) => row.newName)
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
                disabled={renaming}
                onClick={() => void scanDirectory()}
              >
                Tải danh sách
              </Button>
            )}
            <Button
              type="primary"
              icon={<FolderOpenOutlined />}
              loading={loading}
              disabled={renaming}
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
            disabled={renaming}
            onClick={() => void selectDirectory()}
          >
            Chọn folder
          </Button>
        </Space.Compact>
      </Card>

      <Card
        title={`Danh sách video (${rows.length})`}
        extra={
          <Space>
            <Button
              icon={<SwapOutlined />}
              disabled={rows.length === 0 || loading || renaming}
              onClick={shuffleVideos}
            >
              Xáo ngẫu nhiên
            </Button>
            <Button
              type="primary"
              danger
              icon={<PlayCircleOutlined />}
              loading={renaming}
              disabled={!canRename || loading}
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
                  onClick={() => void scanDirectory()}
                >
                  Tải danh sách
                </Button>
              )}
              <Button
                type="primary"
                icon={<FolderOpenOutlined />}
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
