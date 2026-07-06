import { Alert, Descriptions, Empty, Modal, Table, Tag, Typography } from 'antd'
import type { ColumnsType } from 'antd/es/table'
import type { AlignmentItem, BuildConfig, MotionSequenceItem } from '../../electron/types'
import ThumbnailImage from './ThumbnailImage'

interface AlignmentPreviewProps {
  open: boolean
  loading: boolean
  items: AlignmentItem[]
  warnings: string[]
  motionEffect: BuildConfig['motionEffect']
  motionSequence: MotionSequenceItem[]
  motionZoomPercent: number
  motionZoomOutStartPercent: number
  motionHoldMode: NonNullable<BuildConfig['motionHoldMode']>
  motionHoldPercent: number
  motionHoldSeconds: number
  onClose: () => void
}

const automaticEffects: BuildConfig['motionEffect'][] = [
  'zoom-right',
  'zoom-left',
  'zoom-center',
  'zoom-up',
  'zoom-down',
  'zoom-out',
]
const alternatingTopCornerEffects: BuildConfig['motionEffect'][] = [
  'zoom-top-right',
  'zoom-top-left',
]
const reversedAlternatingTopCornerEffects: BuildConfig['motionEffect'][] = [
  'zoom-top-left',
  'zoom-top-right',
]
const alternatingCornerInOutEffects: BuildConfig['motionEffect'][] = [
  'zoom-top-left',
  'zoom-out-top-left',
  'zoom-top-right',
  'zoom-out-top-right',
]

const motionLabels: Record<BuildConfig['motionEffect'], string> = {
  auto: 'Tự động luân phiên',
  none: 'Đứng yên',
  'zoom-center': 'Zoom vào chính giữa',
  'zoom-right': 'Zoom vào bên phải',
  'zoom-left': 'Zoom vào bên trái',
  'zoom-top-right': 'Zoom lên góc phải trên',
  'zoom-top-left': 'Zoom lên góc trái trên',
  'zoom-up': 'Zoom lên phía trên',
  'zoom-down': 'Zoom xuống phía dưới',
  'zoom-out': 'Thu nhỏ dần từ giữa',
  'zoom-out-top-left': 'Zoom từ trong ra — góc trái trên',
  'zoom-out-top-right': 'Zoom từ trong ra — góc phải trên',
  'alternate-top-corners': 'Xen kẽ: lẻ phải trên, chẵn trái trên',
  'alternate-top-corners-reverse': 'Xen kẽ: lẻ trái trên, chẵn phải trên',
  'alternate-corner-in-out': 'Luân phiên 4 cảnh: vào/ra trái-phải',
}

export default function AlignmentPreview({
  open,
  loading,
  items,
  warnings,
  motionEffect,
  motionSequence,
  motionZoomPercent,
  motionZoomOutStartPercent,
  motionHoldMode,
  motionHoldPercent,
  motionHoldSeconds,
  onClose,
}: AlignmentPreviewProps) {
  const effectiveMotionSequence = motionSequence.length
    ? motionSequence
    : [{ id: 'motion-1', effect: motionEffect }]

  function resolveMotionEffect(effect: BuildConfig['motionEffect'], index: number): BuildConfig['motionEffect'] {
    if (effect === 'auto') return automaticEffects[index % automaticEffects.length]
    if (effect === 'alternate-top-corners') {
      return alternatingTopCornerEffects[index % alternatingTopCornerEffects.length]
    }
    if (effect === 'alternate-top-corners-reverse') {
      return reversedAlternatingTopCornerEffects[
        index % reversedAlternatingTopCornerEffects.length
      ]
    }
    if (effect === 'alternate-corner-in-out') {
      return alternatingCornerInOutEffects[index % alternatingCornerInOutEffects.length]
    }
    return effect
  }

  function resolvedMotion(index: number): {
    effect: BuildConfig['motionEffect']
    sequenceIndex: number
  } {
    const sequenceIndex = index % effectiveMotionSequence.length
    const configuredEffect = effectiveMotionSequence[sequenceIndex].effect
    return {
      effect: resolveMotionEffect(configuredEffect, index),
      sequenceIndex,
    }
  }

  const columns: ColumnsType<AlignmentItem> = [
    {
      title: 'Scene',
      dataIndex: 'sceneNumber',
      width: 94,
      render: (sceneNumber: number) => (
        <Typography.Text strong>#{String(sceneNumber).padStart(3, '0')}</Typography.Text>
      ),
    },
    {
      title: 'Ảnh',
      dataIndex: 'imagePath',
      width: 132,
      render: (imagePath: string | null, item) =>
        imagePath ? (
          <ThumbnailImage
            path={imagePath}
            alt={`Scene ${item.sceneNumber}`}
            className="preview-image"
          />
        ) : (
          <Tag color="warning">Thiếu ảnh</Tag>
        ),
    },
    {
      title: 'SRT entries được map',
      render: (_, item) => (
        <div className="space-y-2">
          {item.srtEntries.map((entry) => (
            <div key={`${entry.start}-${entry.text}`} className="flex gap-3">
              <Typography.Text type="secondary" className="shrink-0 text-xs">
                {entry.start.slice(0, 8)}
              </Typography.Text>
              <Typography.Text>{entry.text}</Typography.Text>
            </div>
          ))}
          <div className="flex flex-wrap gap-2 pt-1">
            <Tag color="purple">{item.duration.toFixed(2)} giây</Tag>
            <Tag>{item.srtEntries.length} subtitle</Tag>
          </div>
        </div>
      ),
    },
    {
      title: 'Tính toán chuyển động',
      width: 250,
      render: (_, item) => {
        const index = items.indexOf(item)
        const { effect, sequenceIndex } = resolvedMotion(index)
        if (effect === 'none') {
          return (
            <div className="space-y-2">
              <Tag color="gold">Motion #{sequenceIndex + 1}</Tag>
              <Tag>Đứng yên toàn bộ scene</Tag>
              <Typography.Text type="secondary" className="block text-xs">
                {item.duration.toFixed(2)} giây, không zoom
              </Typography.Text>
            </div>
          )
        }

        const holdSeconds =
          motionHoldMode === 'seconds'
            ? Math.min(item.duration, motionHoldSeconds)
            : item.duration * (motionHoldPercent / 100)
        const motionSeconds = item.duration - holdSeconds
        const isZoomOut =
          effect === 'zoom-out' ||
          effect === 'zoom-out-top-left' ||
          effect === 'zoom-out-top-right'
        const zoomStart = isZoomOut ? 100 + motionZoomOutStartPercent : 100
        const zoomEnd = isZoomOut ? 100 : 100 + motionZoomPercent

        return (
          <div className="space-y-1">
            <div className="flex flex-wrap gap-1">
              <Tag color="gold">Motion #{sequenceIndex + 1}</Tag>
              <Tag color="blue">{motionLabels[effect]}</Tag>
            </div>
            <Typography.Text className="block text-xs">
              Chạy: <strong>{motionSeconds.toFixed(2)} giây</strong>
            </Typography.Text>
            <Typography.Text className="block text-xs">
              Giữ cuối: <strong>{holdSeconds.toFixed(2)} giây</strong>{' '}
              {motionHoldMode === 'seconds' ? `(cố định ${motionHoldSeconds}s)` : `(${motionHoldPercent}%)`}
            </Typography.Text>
            <Typography.Text className="block text-xs">
              Zoom: <strong>{zoomStart.toFixed(1)}% → {zoomEnd.toFixed(1)}%</strong>
            </Typography.Text>
          </div>
        )
      },
    },
  ]

  return (
    <Modal
      className="alignment-preview-modal"
      title={`Preview Alignment${items.length ? ` — ${items.length} scenes` : ''}`}
      open={open}
      onCancel={onClose}
      footer={null}
      width="min(1220px, calc(100vw - 48px))"
      style={{ top: 16 }}
      destroyOnHidden
    >
      <div className="alignment-preview-content">
        <Descriptions
          className="alignment-preview-summary mb-4"
          size="small"
          bordered
          column={{ xs: 1, sm: 2, md: 4 }}
          items={[
            {
              key: 'effect',
              label: 'Sequence',
              children: `${effectiveMotionSequence.length} chuyển động`,
            },
            {
              key: 'formula',
              label: 'Công thức lặp',
              children: `scene index % ${effectiveMotionSequence.length}`,
            },
            {
              key: 'zoom',
              label: 'Zoom vào',
              children: `${motionZoomPercent}%`,
            },
            {
              key: 'zoomOut',
              label: 'Zoom từ trong ra',
              children: `${motionZoomOutStartPercent}%`,
            },
            {
              key: 'hold',
              label: 'Giữ cuối',
              children:
                motionHoldMode === 'seconds'
                  ? `${motionHoldSeconds}s cố định mỗi scene`
                  : `${motionHoldPercent}% mỗi scene`,
            },
          ]}
        />
        {warnings.length > 0 && (
          <Alert
            className="alignment-preview-warning mb-4"
            type="warning"
            showIcon
            message="Cảnh báo alignment"
            description={
              <ul className="m-0 pl-5">
                {warnings.map((warning) => (
                  <li key={warning}>{warning}</li>
                ))}
              </ul>
            }
          />
        )}
        <Table
          className="alignment-preview-table"
          rowKey="sceneNumber"
          columns={columns}
          dataSource={items}
          loading={loading}
          pagination={{ pageSize: 10, showSizeChanger: false }}
          locale={{ emptyText: <Empty description="Chưa có dữ liệu alignment" /> }}
          scroll={{ y: 'max(320px, calc(100vh - 430px))' }}
        />
      </div>
    </Modal>
  )
}
