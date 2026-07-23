import { useMemo, useState } from 'react'
import { Button, Empty, Input, Modal, Table, Tag, Tooltip, Typography } from 'antd'
import type { ColumnsType } from 'antd/es/table'
import {
  AppstoreOutlined,
  ClockCircleOutlined,
  CompassOutlined,
  EyeOutlined,
  FileTextOutlined,
  FilterOutlined,
  InfoCircleOutlined,
  LockOutlined,
  PictureOutlined,
  PlayCircleOutlined,
  RiseOutlined,
  SearchOutlined,
  ThunderboltOutlined,
  VideoCameraOutlined,
} from '@ant-design/icons'
import type { AlignmentItem, BuildConfig, MotionSequenceItem } from '../../electron/types'
import MotionPreviewModal from './MotionPreviewModal'
import ThumbnailImage from './ThumbnailImage'

interface AlignmentPreviewProps {
  open: boolean
  loading: boolean
  items: AlignmentItem[]
  warnings: string[]
  motionEnabled: boolean
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
  none: 'Đứng yên (Tĩnh)',
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
  'alternate-top-corners': 'Xen kẽ góc trên',
  'alternate-top-corners-reverse': 'Xen kẽ góc trên (ngược)',
  'alternate-corner-in-out': 'Luân phiên 4 góc vào/ra',
}

function warningActionText(warnings: string[]): string {
  const combined = warnings.join(' ').toLowerCase()
  if (combined.includes('timeline')) {
    return 'Cách xử lý: vào Ghép audio và ghép lại để app tạo file timeline, hoặc chọn thủ công file .timeline.json ở ô Timeline audio.'
  }
  if (combined.includes('ảnh') || combined.includes('image')) {
    return 'Cách xử lý: kiểm tra thư mục ảnh, bấm Làm mới ở Nguồn dữ liệu, rồi mở preview lại.'
  }
  if (combined.includes('srt') || combined.includes('subtitle') || combined.includes('phụ đề')) {
    return 'Cách xử lý: kiểm tra file SRT đang chọn, đảm bảo đúng nội dung/audio của project, rồi mở preview lại.'
  }
  return 'Cách xử lý: kiểm tra lại các file nguồn trong Nguồn dữ liệu, bấm Làm mới, rồi preview lại.'
}

export default function AlignmentPreview({
  open,
  loading,
  items,
  warnings,
  motionEnabled,
  motionEffect,
  motionSequence,
  motionZoomPercent,
  motionZoomOutStartPercent,
  motionHoldMode,
  motionHoldPercent,
  motionHoldSeconds,
  onClose,
}: AlignmentPreviewProps) {
  const [searchText, setSearchText] = useState('')
  const [scenePreview, setScenePreview] = useState<{
    sceneNumber: number
    imagePath: string | null
    duration: number
    effect: BuildConfig['motionEffect']
  } | null>(null)

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
    if (!motionEnabled) return { effect: 'none', sequenceIndex: 0 }
    const sequenceIndex = index % effectiveMotionSequence.length
    const configuredEffect = effectiveMotionSequence[sequenceIndex].effect
    return {
      effect: resolveMotionEffect(configuredEffect, index),
      sequenceIndex,
    }
  }

  // Calculate total estimated video length
  const totalDurationSeconds = useMemo(() => {
    return items.reduce((sum, item) => sum + item.duration, 0)
  }, [items])

  function formatTime(totalSeconds: number): string {
    const mins = Math.floor(totalSeconds / 60)
    const secs = (totalSeconds % 60).toFixed(1)
    if (mins > 0) return `${mins}m ${secs}s`
    return `${secs}s`
  }

  // Filtered items based on search text
  const filteredItems = useMemo(() => {
    if (!searchText.trim()) return items
    const query = searchText.toLowerCase().trim()
    return items.filter((item) => {
      const sceneStr = `#${String(item.sceneNumber).padStart(3, '0')}`
      if (sceneStr.toLowerCase().includes(query)) return true
      if (item.imagePath && item.imagePath.toLowerCase().includes(query)) return true
      return item.srtEntries.some((entry) => entry.text.toLowerCase().includes(query))
    })
  }, [items, searchText])

  const columns: ColumnsType<AlignmentItem> = [
    {
      title: 'Scene & Ảnh',
      width: 170,
      render: (_, item) => (
        <div className="space-y-2">
          <div className="flex items-center gap-1.5">
            <Tag color="volcano" className="!mr-0 font-mono font-semibold text-xs">
              #{String(item.sceneNumber).padStart(3, '0')}
            </Tag>
          </div>
          {item.imagePath ? (
            <ThumbnailImage
              path={item.imagePath}
              alt={`Scene ${item.sceneNumber}`}
              className="preview-image rounded border border-slate-200 shadow-sm"
            />
          ) : (
            <div className="w-[120px] h-[68px] rounded border border-dashed border-red-300 bg-red-50 flex items-center justify-center text-xs text-red-500 font-medium">
              Thiếu file ảnh
            </div>
          )}
        </div>
      ),
    },
    {
      title: 'Kịch bản & Phụ đề được khớp (SRT Entries)',
      render: (_, item) => (
        <div className="space-y-2">
          <div className="space-y-1.5 bg-slate-50/70 p-2.5 rounded-md border border-slate-200/80">
            {item.srtEntries.map((entry, idx) => (
              <div key={`${entry.start}-${entry.text}-${idx}`} className="flex items-start gap-2.5 text-xs">
                <span className="font-mono text-[11px] text-slate-500 bg-white px-1.5 py-0.5 rounded border border-slate-200 shrink-0">
                  {entry.start.slice(0, 8)}
                </span>
                <span className="text-slate-800 leading-relaxed">{entry.text}</span>
              </div>
            ))}
          </div>

          <div className="flex flex-wrap items-center gap-2 pt-0.5">
            <Tag color="purple" className="!mr-0 font-medium text-xs flex items-center gap-1">
              <ClockCircleOutlined /> Thời lượng scene: {item.duration.toFixed(2)}s
            </Tag>
            <Tag color="default" className="!mr-0 text-xs text-slate-600">
              {item.srtEntries.length} câu phụ đề
            </Tag>
            {item.timingSource === 'timeline' && (
              <>
                <Tag color="cyan" className="!mr-0 text-xs">
                  Audio: {(item.audioDurationSeconds ?? 0).toFixed(3)}s
                </Tag>
                <Tag color="blue" className="!mr-0 text-xs">
                  Nghỉ cuối: {(item.pauseAfterSeconds ?? 0).toFixed(3)}s
                </Tag>
              </>
            )}
          </div>
        </div>
      ),
    },
    {
      title: 'Tính toán Chuyển động (Motion Calculated)',
      width: 320,
      render: (_, item) => {
        const index = items.indexOf(item)
        const { effect, sequenceIndex } = resolvedMotion(index)

        if (effect === 'none') {
          return (
            <div className="bg-slate-50 p-2.5 rounded-md border border-slate-200 space-y-1.5 text-xs">
              <div className="flex items-center justify-between gap-1.5">
                <div className="flex items-center gap-1.5">
                  <Tag color="default" className="!mr-0 font-semibold">Tĩnh</Tag>
                  <span className="text-slate-500">Khung hình tĩnh</span>
                </div>
                <Button
                  size="small"
                  icon={<EyeOutlined />}
                  onClick={() =>
                    setScenePreview({
                      sceneNumber: item.sceneNumber,
                      imagePath: item.imagePath,
                      duration: item.duration,
                      effect,
                    })
                  }
                  className="!rounded-md text-[11px] text-slate-600 hover:text-brand-600 !px-2 shrink-0"
                >
                  Mô phỏng
                </Button>
              </div>
              <span className="text-slate-500 block text-[11px]">
                {item.duration.toFixed(2)}s không có hiệu ứng zoom.
              </span>
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
          <div className="bg-slate-50/80 p-2.5 rounded-md border border-slate-200 space-y-2 text-xs">
            <div className="flex items-center justify-between gap-1.5">
              <div className="flex items-center gap-1 min-w-0">
                <Tag color="volcano" className="!mr-0 font-mono text-[10px] font-semibold shrink-0">
                  Step #{sequenceIndex + 1}
                </Tag>
                <Tag
                  color={isZoomOut ? 'cyan' : 'red'}
                  className="!mr-0 font-medium text-[11px] max-w-[135px] truncate inline-block align-bottom"
                  title={motionLabels[effect]}
                >
                  {motionLabels[effect]}
                </Tag>
              </div>
              <Button
                size="small"
                icon={<EyeOutlined />}
                onClick={() =>
                  setScenePreview({
                    sceneNumber: item.sceneNumber,
                    imagePath: item.imagePath,
                    duration: item.duration,
                    effect,
                  })
                }
                title="Xem mô phỏng chuyển động thực tế cho cảnh này"
                className="!rounded-md text-[11px] text-slate-700 hover:text-brand-600 font-medium !px-2 shrink-0 border-slate-300"
              >
                Mô phỏng
              </Button>
            </div>

            <div className="space-y-1 text-[11px] bg-white p-2 rounded border border-slate-200 font-mono">
              <div className="flex justify-between items-center">
                <span className="text-slate-500 flex items-center gap-1">
                  <ThunderboltOutlined className="text-brand-500" /> Zoom chạy:
                </span>
                <span className="font-semibold text-slate-800">{motionSeconds.toFixed(2)}s</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-500 flex items-center gap-1">
                  <LockOutlined className="text-amber-500" /> Giữ tĩnh cuối:
                </span>
                <span className="font-semibold text-amber-600">{holdSeconds.toFixed(2)}s</span>
              </div>
              <div className="flex justify-between items-center border-t border-slate-100 pt-1 mt-1">
                <span className="text-slate-500 flex items-center gap-1">
                  <RiseOutlined className="text-blue-500" /> Tỷ lệ Zoom:
                </span>
                <span className="font-semibold text-brand-600">{zoomStart.toFixed(0)}% → {zoomEnd.toFixed(0)}%</span>
              </div>
            </div>
          </div>
        )
      },
    },
  ]

  return (
    <Modal
      rootClassName="alignment-preview-modal-root"
      className="alignment-preview-modal"
      title={
        <div className="flex items-center gap-2.5">
          <PlayCircleOutlined className="text-brand-500 text-lg" />
          <span className="text-base font-semibold text-slate-800">
            Xem trước Alignment kịch bản ({items.length} scenes)
          </span>
        </div>
      }
      open={open}
      onCancel={onClose}
      footer={null}
      width="min(1240px, calc(100vw - 48px))"
      centered
      style={{ paddingBottom: 0 }}
      styles={{
        container: {
          height: 'calc(100vh - 48px)',
          maxHeight: 'calc(100vh - 48px)',
        },
        root: {
          height: '100vh',
        },
        body: {
          display: 'flex',
          flex: 1,
          minHeight: 0,
          overflow: 'hidden',
        },
      }}
      classNames={{
        container: 'alignment-preview-modal-container',
        body: 'alignment-preview-modal-body',
      }}
      modalRender={(modal) => (
        <div className="alignment-preview-modal-frame">
          {modal}
        </div>
      )}
      destroyOnHidden
    >
      <div className="alignment-preview-content pt-1">
        <div className="alignment-preview-header space-y-4">
          {/* Visual Summary Metric Cards */}
          <div className="grid gap-3 grid-cols-2 md:grid-cols-4">
          <div className="bg-slate-50 border border-slate-200/80 p-3 rounded-md">
            <span className="text-xs text-slate-500 block mb-0.5">Tổng số cảnh (Scenes)</span>
            <span className="text-base font-bold text-slate-800 font-mono">{items.length} scenes</span>
          </div>
          <div className="bg-slate-50 border border-slate-200/80 p-3 rounded-md">
            <span className="text-xs text-slate-500 block mb-0.5">Thời lượng tổng dự kiến</span>
            <span className="text-base font-bold text-brand-600 font-mono">{formatTime(totalDurationSeconds)}</span>
            <span className="mt-0.5 block text-[11px] font-medium text-slate-500">
              {items[0]?.timingSource === 'timeline'
                ? 'Nguồn: Timeline audio chính xác'
                : 'Nguồn: SRT fallback'}
            </span>
          </div>
          <div className="bg-slate-50 border border-slate-200/80 p-3 rounded-md">
            <span className="text-xs text-slate-500 block mb-0.5">Chuỗi Zoom Camera</span>
            <span className="text-sm font-semibold text-slate-800">
              {motionEnabled ? `${effectiveMotionSequence.length} kiểu lặp lại` : 'Đứng yên (Tĩnh)'}
            </span>
          </div>
          <div className="bg-slate-50 border border-slate-200/80 p-3 rounded-md">
            <span className="text-xs text-slate-500 block mb-0.5">Thời gian Đứng yên (Hold)</span>
            <span className="text-sm font-semibold text-slate-800">
              {!motionEnabled
                ? 'Toàn bộ scene'
                : motionHoldMode === 'seconds'
                  ? `${motionHoldSeconds}s cố định cuối scene`
                  : `${motionHoldPercent}% cuối scene`}
            </span>
          </div>
          </div>

          {/* Search & Warnings Toolbar */}
          <div className="flex flex-wrap items-center justify-between gap-3 bg-white p-2.5 rounded-md border border-slate-200">
            <div className="flex items-center gap-2 flex-1 min-w-[280px]">
              <Input
                prefix={<SearchOutlined className="text-slate-400" />}
                placeholder="Tìm theo mã Scene (#001), tên ảnh, hoặc từ khóa phụ đề..."
                value={searchText}
                onChange={(e) => setSearchText(e.target.value)}
                allowClear
                className="!rounded-md text-xs"
              />
            </div>

            <div className="text-xs text-slate-500 font-medium">
              Hiển thị <span className="text-brand-600 font-bold">{filteredItems.length}</span> / {items.length} cảnh
            </div>
          </div>

          {/* Warning Callouts */}
          {warnings.length > 0 && (
            <div className="alignment-preview-warning">
              <InfoCircleOutlined className="alignment-preview-warning-icon" />
              <div className="min-w-0">
                <div className="alignment-preview-warning-title">Cảnh báo Alignment dữ liệu</div>
                <div className="alignment-preview-warning-text">{warnings.join(' ')}</div>
                <div className="alignment-preview-warning-action">{warningActionText(warnings)}</div>
              </div>
            </div>
          )}
        </div>

        {/* Scenes Table */}
        <div className="alignment-preview-table-scroll">
          <Table
            className="alignment-preview-table rounded-md border border-slate-200 overflow-hidden"
            rowKey="sceneNumber"
            columns={columns}
            dataSource={filteredItems}
            loading={loading}
            pagination={{ pageSize: 10, showSizeChanger: false }}
            scroll={{ y: 'calc(100vh - 560px)' }}
            locale={{ emptyText: <Empty description="Không tìm thấy scene phù hợp" /> }}
          />
        </div>
      </div>

      {scenePreview && (
        <MotionPreviewModal
          open={Boolean(scenePreview)}
          effect={scenePreview.effect}
          sampleImagePath={scenePreview.imagePath ?? undefined}
          customDuration={scenePreview.duration}
          titleText={`Mô phỏng chuyển động — Scene #${String(scenePreview.sceneNumber).padStart(3, '0')} (${scenePreview.duration.toFixed(2)}s)`}
          motionZoomPercent={motionZoomPercent}
          motionZoomOutStartPercent={motionZoomOutStartPercent}
          motionHoldMode={motionHoldMode}
          motionHoldPercent={motionHoldPercent}
          motionHoldSeconds={motionHoldSeconds}
          onClose={() => setScenePreview(null)}
        />
      )}
    </Modal>
  )
}
