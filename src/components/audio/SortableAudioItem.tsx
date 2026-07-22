import { Button, List, Tag, Typography } from 'antd'
import {
  ClockCircleOutlined,
  DeleteOutlined,
  HolderOutlined,
  SoundOutlined,
} from '@ant-design/icons'
import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import type { AudioMergeItem } from '../../stores/useAudioMergeStore'
import { formatDuration } from '../../utils/path'

interface SortableAudioItemProps {
  item: AudioMergeItem
  index: number
  disabled: boolean
  onRemove: () => void
}

export default function SortableAudioItem({
  item,
  index,
  disabled,
  onRemove,
}: SortableAudioItemProps) {
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
