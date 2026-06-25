import { Empty, Modal, Table, Tag, Typography } from 'antd'
import type { ColumnsType } from 'antd/es/table'
import { Grid, type CellComponentProps } from 'react-window'
import type { ImagePreviewItem, Scene, SrtEntry } from '../../electron/types'
import ThumbnailImage from './ThumbnailImage'

export type SourcePreviewData =
  | { kind: 'images'; title: string; items: ImagePreviewItem[] }
  | { kind: 'excel'; title: string; items: Scene[] }
  | { kind: 'srt'; title: string; items: SrtEntry[] }

interface SourcePreviewProps {
  data: SourcePreviewData | null
  loading: boolean
  onClose: () => void
}

interface ImageCellProps {
  items: ImagePreviewItem[]
  columnCount: number
}

function ImageCell({
  columnIndex,
  rowIndex,
  style,
  items,
  columnCount,
}: CellComponentProps<ImageCellProps>) {
  const item = items[rowIndex * columnCount + columnIndex]
  if (!item) return null
  return (
    <div style={{ ...style, padding: 8 }}>
      <div className="h-full overflow-hidden rounded-xl border border-slate-200 bg-white">
        <ThumbnailImage path={item.path} alt={item.name} />
        <div className="space-y-1 p-3">
          {item.sceneNumber !== null && <Tag color="purple">Scene {item.sceneNumber}</Tag>}
          <Typography.Paragraph
            className="!mb-0 text-xs"
            ellipsis={{ rows: 2, tooltip: item.name }}
          >
            {item.name}
          </Typography.Paragraph>
        </div>
      </div>
    </div>
  )
}

export default function SourcePreview({ data, loading, onClose }: SourcePreviewProps) {
  if (!data) {
    return <Modal open={false} onCancel={onClose} />
  }

  if (data.kind === 'images') {
    const columnCount = 4
    return (
      <Modal
        title={`${data.title} — ${data.items.length} ảnh`}
        open
        footer={null}
        width={1040}
        loading={loading}
        onCancel={onClose}
      >
        {data.items.length === 0 ? (
          <Empty description="Thư mục không có ảnh được hỗ trợ" />
        ) : (
          <Grid
            cellComponent={ImageCell}
            cellProps={{ items: data.items, columnCount }}
            columnCount={columnCount}
            columnWidth="25%"
            rowCount={Math.ceil(data.items.length / columnCount)}
            rowHeight={214}
            overscanCount={1}
            style={{ height: '68vh', width: '100%' }}
          />
        )}
      </Modal>
    )
  }

  const srtColumns: ColumnsType<SrtEntry> = [
    { title: '#', width: 64, render: (_, __, index) => index + 1 },
    { title: 'Bắt đầu', dataIndex: 'start', width: 130 },
    { title: 'Kết thúc', dataIndex: 'end', width: 130 },
    { title: 'Nội dung', dataIndex: 'text' },
  ]

  if (data.kind === 'excel') {
    const excelColumns: ColumnsType<Scene> = [
      { title: 'STT', dataIndex: 'number', width: 90 },
      { title: 'Nội dung', dataIndex: 'content' },
    ]
    return (
      <Modal
        title={`${data.title} — ${data.items.length} mục`}
        open
        footer={null}
        width={960}
        loading={loading}
        onCancel={onClose}
      >
        <Table
          rowKey="number"
          columns={excelColumns}
          dataSource={data.items}
          pagination={{ pageSize: 12, showSizeChanger: false }}
          scroll={{ y: '55vh' }}
        />
      </Modal>
    )
  }

  return (
    <Modal
      title={`${data.title} — ${data.items.length} mục`}
      open
      footer={null}
      width={960}
      loading={loading}
      onCancel={onClose}
    >
      <Table
        rowKey={(_, index) => String(index)}
        columns={srtColumns}
        dataSource={data.items}
        pagination={{ pageSize: 12, showSizeChanger: false }}
        scroll={{ y: '55vh' }}
      />
    </Modal>
  )
}
