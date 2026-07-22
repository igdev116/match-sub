import { useMemo } from 'react'
import {
  Button,
  Card,
  Empty,
  List,
  Pagination,
  Space,
  Tooltip,
  Typography,
} from 'antd'
import {
  DeleteOutlined,
  FolderOpenOutlined,
  PlusOutlined,
  QuestionCircleOutlined,
  ReloadOutlined,
  SoundOutlined,
} from '@ant-design/icons'
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
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import type { AudioMergeItem } from '../../stores/useAudioMergeStore'
import SortableAudioItem from './SortableAudioItem'

interface AudioListCardProps {
  items: AudioMergeItem[]
  pagedItems: AudioMergeItem[]
  currentPage: number
  pageSize: number
  pageStart: number
  audioDirectory: string
  directoryLoading: boolean
  processing: boolean
  setItems: (updater: AudioMergeItem[] | ((items: AudioMergeItem[]) => AudioMergeItem[])) => void
  setCurrentPage: (page: number) => void
  addFiles: () => void
  selectAudioDirectory: () => void
  refreshAudioDirectory: () => void
  handleDragEnd: (event: DragEndEvent) => void
  saveAudioSettings: (patch: { pageSize?: number }) => void
}

export default function AudioListCard({
  items,
  pagedItems,
  currentPage,
  pageSize,
  pageStart,
  audioDirectory,
  directoryLoading,
  processing,
  setItems,
  setCurrentPage,
  addFiles,
  selectAudioDirectory,
  refreshAudioDirectory,
  handleDragEnd,
  saveAudioSettings,
}: AudioListCardProps) {
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }))

  return (
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
  )
}
