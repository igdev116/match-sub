import { useEffect, useRef, useState } from 'react'
import { Button, InputNumber, Modal, Progress, Radio, Select, Switch, Tag, Typography } from 'antd'
import {
  AimOutlined,
  CaretRightOutlined,
  CheckOutlined,
  EyeOutlined,
  LockOutlined,
  PauseOutlined,
  ReloadOutlined,
  SaveOutlined,
  SettingOutlined,
  ThunderboltOutlined,
} from '@ant-design/icons'
import type { BuildConfig } from '../../electron/types'

export interface MotionPreviewModalProps {
  open: boolean
  effect: BuildConfig['motionEffect']
  motionZoomPercent?: number
  motionZoomOutStartPercent?: number
  motionHoldMode?: 'percent' | 'seconds'
  motionHoldPercent?: number
  motionHoldSeconds?: number
  sampleImagePath?: string
  customDuration?: number
  titleText?: string
  onEffectChange?: (effect: BuildConfig['motionEffect']) => void
  onSettingsChange?: (settings: {
    motionZoomPercent?: number
    motionZoomOutStartPercent?: number
    motionHoldMode?: 'percent' | 'seconds'
    motionHoldPercent?: number
    motionHoldSeconds?: number
  }) => void
  onClose: () => void
}

interface MotionMeta {
  effect: BuildConfig['motionEffect']
  label: string
  type: 'in' | 'out' | 'none'
  originX: number
  originY: number
  originLabel: string
  description: string
}

const MOTION_METAS: Partial<Record<BuildConfig['motionEffect'], MotionMeta>> = {
  'zoom-top-left': {
    effect: 'zoom-top-left',
    label: 'Zoom vào góc trái trên',
    type: 'in',
    originX: 0,
    originY: 0,
    originLabel: 'Góc trái trên (0%, 0%)',
    description: 'Phóng to dần về phía góc trên bên trái của hình ảnh.',
  },
  'zoom-top-right': {
    effect: 'zoom-top-right',
    label: 'Zoom vào góc phải trên',
    type: 'in',
    originX: 100,
    originY: 0,
    originLabel: 'Góc phải trên (100%, 0%)',
    description: 'Phóng to dần về phía góc trên bên phải của hình ảnh.',
  },
  'zoom-out-top-left': {
    effect: 'zoom-out-top-left',
    label: 'Zoom từ trong ra — góc trái trên',
    type: 'out',
    originX: 0,
    originY: 0,
    originLabel: 'Góc trái trên (0%, 0%)',
    description: 'Bắt đầu từ mức phóng to ở góc trái trên, thu nhỏ dần về kích thước gốc.',
  },
  'zoom-out-top-right': {
    effect: 'zoom-out-top-right',
    label: 'Zoom từ trong ra — góc phải trên',
    type: 'out',
    originX: 100,
    originY: 0,
    originLabel: 'Góc phải trên (100%, 0%)',
    description: 'Bắt đầu từ mức phóng to ở góc phải trên, thu nhỏ dần về kích thước gốc.',
  },
  'zoom-right': {
    effect: 'zoom-right',
    label: 'Zoom vào bên phải',
    type: 'in',
    originX: 100,
    originY: 50,
    originLabel: 'Trung tâm bên phải (100%, 50%)',
    description: 'Phóng to dần tập trung vào cạnh bên phải hình ảnh.',
  },
  'zoom-left': {
    effect: 'zoom-left',
    label: 'Zoom vào bên trái',
    type: 'in',
    originX: 0,
    originY: 50,
    originLabel: 'Trung tâm bên trái (0%, 50%)',
    description: 'Phóng to dần tập trung vào cạnh bên trái hình ảnh.',
  },
  'zoom-center': {
    effect: 'zoom-center',
    label: 'Zoom vào chính giữa',
    type: 'in',
    originX: 50,
    originY: 50,
    originLabel: 'Chính giữa (50%, 50%)',
    description: 'Phóng to đồng đều vào tâm chính giữa của hình ảnh.',
  },
  'zoom-up': {
    effect: 'zoom-up',
    label: 'Zoom lên phía trên',
    type: 'in',
    originX: 50,
    originY: 0,
    originLabel: 'Trung tâm phía trên (50%, 0%)',
    description: 'Phóng to tập trung lên mép trên hình ảnh.',
  },
  'zoom-down': {
    effect: 'zoom-down',
    label: 'Zoom xuống phía dưới',
    type: 'in',
    originX: 50,
    originY: 100,
    originLabel: 'Trung tâm phía dưới (50%, 100%)',
    description: 'Phóng to tập trung xuống mép dưới hình ảnh.',
  },
  'zoom-out': {
    effect: 'zoom-out',
    label: 'Thu nhỏ dần từ giữa',
    type: 'out',
    originX: 50,
    originY: 50,
    originLabel: 'Chính giữa (50%, 50%)',
    description: 'Bắt đầu từ mức zoom lớn tại tâm, thu nhỏ dần về toàn cảnh.',
  },
  none: {
    effect: 'none',
    label: 'Đứng yên (Tĩnh)',
    type: 'none',
    originX: 50,
    originY: 50,
    originLabel: 'Chính giữa (50%, 50%)',
    description: 'Khung hình tĩnh, không có chuyển động zoom.',
  },
}

const DEFAULT_MOTION_META: MotionMeta = {
  effect: 'zoom-center',
  label: 'Zoom vào chính giữa',
  type: 'in',
  originX: 50,
  originY: 50,
  originLabel: 'Chính giữa (50%, 50%)',
  description: 'Phóng to đồng đều vào tâm chính giữa của hình ảnh.',
}

const MOTION_OPTIONS = Object.values(MOTION_METAS).map((meta) => ({
  value: meta.effect,
  label: meta.label,
}))

const DEFAULT_DEMO_IMAGE =
  'https://images.unsplash.com/photo-1506744038136-46273834b3fb?auto=format&fit=crop&w=1200&q=80'

export default function MotionPreviewModal({
  open,
  effect,
  motionZoomPercent = 8,
  motionZoomOutStartPercent = 12,
  motionHoldMode = 'percent',
  motionHoldPercent = 20,
  motionHoldSeconds = 2,
  sampleImagePath,
  customDuration,
  titleText,
  onEffectChange,
  onSettingsChange,
  onClose,
}: MotionPreviewModalProps) {
  const [currentEffect, setCurrentEffect] = useState<BuildConfig['motionEffect']>(effect)

  // Interactive motion parameters (editable inside modal)
  const [sceneDuration, setSceneDuration] = useState(() => customDuration ?? 5)
  const [zoomPercent, setZoomPercent] = useState(motionZoomPercent)
  const [zoomOutStartPercent, setZoomOutStartPercent] = useState(motionZoomOutStartPercent)
  const [holdMode, setHoldMode] = useState<'percent' | 'seconds'>(motionHoldMode)
  const [holdPercent, setHoldPercent] = useState(motionHoldPercent)
  const [holdSeconds, setHoldSeconds] = useState(motionHoldSeconds)

  const [playing, setPlaying] = useState(true)
  const [speed, setSpeed] = useState(1)
  const [showGrid, setShowGrid] = useState(true)
  const [showTarget, setShowTarget] = useState(true)
  const [appliedNotice, setAppliedNotice] = useState(false)
  const [resolvedImageSrc, setResolvedImageSrc] = useState<string>(DEFAULT_DEMO_IMAGE)

  const [progressPercent, setProgressPercent] = useState(0)
  const [currentScalePercent, setCurrentScalePercent] = useState(100)
  const [currentPhase, setCurrentPhase] = useState<'zooming' | 'holding'>('zooming')

  const requestRef = useRef<number | null>(null)
  const startTimeRef = useRef<number | null>(null)

  // Resolve local image path or fallback
  useEffect(() => {
    if (!sampleImagePath) {
      setResolvedImageSrc(DEFAULT_DEMO_IMAGE)
      return
    }
    if (sampleImagePath.startsWith('http') || sampleImagePath.startsWith('data:')) {
      setResolvedImageSrc(sampleImagePath)
      return
    }
    let active = true
    if (window.videoBuilder?.getThumbnail) {
      window.videoBuilder
        .getThumbnail(sampleImagePath)
        .then((dataUrl) => {
          if (active && dataUrl) setResolvedImageSrc(dataUrl)
          else if (active) setResolvedImageSrc(`file://${sampleImagePath}`)
        })
        .catch(() => {
          if (active) setResolvedImageSrc(`file://${sampleImagePath}`)
        })
    } else {
      setResolvedImageSrc(`file://${sampleImagePath}`)
    }
    return () => {
      active = false
    }
  }, [sampleImagePath])

  // Reset local state when modal opens or props change
  useEffect(() => {
    if (open) {
      setCurrentEffect(effect)
      setZoomPercent(motionZoomPercent)
      setZoomOutStartPercent(motionZoomOutStartPercent)
      setHoldMode(motionHoldMode)
      setHoldPercent(motionHoldPercent)
      setHoldSeconds(motionHoldSeconds)
      if (customDuration) setSceneDuration(Math.max(1, Math.round(customDuration * 10) / 10))
      setAppliedNotice(false)
      startTimeRef.current = null
      setProgressPercent(0)
      setPlaying(true)
    }
  }, [
    open,
    effect,
    motionZoomPercent,
    motionZoomOutStartPercent,
    motionHoldMode,
    motionHoldPercent,
    motionHoldSeconds,
    customDuration,
  ])

  const meta = MOTION_METAS[currentEffect] || DEFAULT_MOTION_META

  const isZoomOut = meta.type === 'out'
  const isNone = meta.type === 'none'

  const startScale = isNone ? 1.0 : isZoomOut ? 1 + zoomOutStartPercent / 100 : 1.0
  const endScale = isNone ? 1.0 : isZoomOut ? 1.0 : 1 + zoomPercent / 100

  // Calculate dynamic hold duration fraction
  const holdFraction = isNone
    ? 0
    : holdMode === 'seconds'
      ? Math.min(0.9, holdSeconds / sceneDuration)
      : holdPercent / 100
  const zoomFraction = Math.max(0.1, 1 - holdFraction)

  const durationMs = sceneDuration * 1000

  useEffect(() => {
    if (!open) {
      if (requestRef.current) cancelAnimationFrame(requestRef.current)
      return
    }

    startTimeRef.current = null

    const animate = (timestamp: number) => {
      if (!startTimeRef.current) startTimeRef.current = timestamp
      const elapsed = (timestamp - startTimeRef.current) * speed
      const totalProgress = (elapsed % durationMs) / durationMs
      const rawProgressPercent = totalProgress * 100

      setProgressPercent(rawProgressPercent)

      let scaleVal = startScale
      if (totalProgress <= zoomFraction) {
        setCurrentPhase('zooming')
        const zoomT = totalProgress / (zoomFraction || 1)
        scaleVal = startScale + (endScale - startScale) * zoomT
      } else {
        setCurrentPhase('holding')
        scaleVal = endScale
      }

      setCurrentScalePercent(scaleVal * 100)

      if (playing) {
        requestRef.current = requestAnimationFrame(animate)
      }
    }

    if (playing) {
      requestRef.current = requestAnimationFrame(animate)
    }

    return () => {
      if (requestRef.current) cancelAnimationFrame(requestRef.current)
    }
  }, [open, playing, speed, currentEffect, startScale, endScale, zoomFraction, durationMs])

  function handleSelectEffect(newEffect: BuildConfig['motionEffect']) {
    setCurrentEffect(newEffect)
    if (onEffectChange) onEffectChange(newEffect)
    startTimeRef.current = null
  }

  function resetAnimation() {
    startTimeRef.current = null
    setProgressPercent(0)
    setCurrentScalePercent(startScale * 100)
    setCurrentPhase('zooming')
  }

  function handleApplyToProject() {
    if (onSettingsChange) {
      onSettingsChange({
        motionZoomPercent: zoomPercent,
        motionZoomOutStartPercent: zoomOutStartPercent,
        motionHoldMode: holdMode,
        motionHoldPercent: holdPercent,
        motionHoldSeconds: holdSeconds,
      })
    }
    setAppliedNotice(true)
    setTimeout(() => setAppliedNotice(false), 2500)
  }

  const previewImageSrc = sampleImagePath
    ? sampleImagePath.startsWith('http') || sampleImagePath.startsWith('file://')
      ? sampleImagePath
      : `file://${sampleImagePath}`
    : DEFAULT_DEMO_IMAGE

  return (
    <Modal
      open={open}
      onCancel={onClose}
      footer={null}
      width={920}
      title={
        <div className="flex items-center justify-between pr-6">
          <div className="flex items-center gap-2.5">
            <EyeOutlined className="text-brand-500 text-lg" />
            <span className="text-base font-semibold text-slate-800">
              {titleText || 'Minh họa chuyển động camera (Motion Simulation)'}
            </span>
          </div>

          {onSettingsChange && (
            <Button
              type="primary"
              size="small"
              icon={appliedNotice ? <CheckOutlined /> : <SaveOutlined />}
              onClick={handleApplyToProject}
              className="!rounded-md font-medium"
            >
              {appliedNotice ? 'Đã áp dụng!' : 'Áp dụng thông số này vào dự án'}
            </Button>
          )}
        </div>
      }
      className="!rounded-lg overflow-hidden"
    >
      <div className="space-y-4 pt-2">
        {/* Controls Bar & Selector */}
        <div className="flex flex-wrap items-center justify-between gap-3 bg-slate-50 border border-slate-200/80 p-3 rounded-md">
          <div className="flex items-center gap-2 flex-1 min-w-[280px]">
            <span className="text-xs font-semibold text-slate-600 shrink-0">Kiểu chuyển động:</span>
            <Select
              className="flex-1 !rounded-md"
              value={currentEffect}
              options={MOTION_OPTIONS}
              onChange={handleSelectEffect}
            />
          </div>

          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5">
              <span className="text-xs text-slate-500">Grid</span>
              <Switch size="small" checked={showGrid} onChange={setShowGrid} />
            </div>
            <div className="flex items-center gap-1.5">
              <span className="text-xs text-slate-500 font-medium">Tâm ngắm</span>
              <Switch size="small" checked={showTarget} onChange={setShowTarget} />
            </div>
            <div className="h-4 w-[1px] bg-slate-200" />
            <Button
              size="small"
              icon={playing ? <PauseOutlined /> : <CaretRightOutlined />}
              onClick={() => setPlaying(!playing)}
              className="!rounded-md"
            >
              {playing ? 'Tạm dừng' : 'Phát'}
            </Button>
            <Button size="small" icon={<ReloadOutlined />} onClick={resetAnimation} className="!rounded-md" />
          </div>
        </div>

        {/* Viewport & Interactive Parameters Panel */}
        <div className="grid gap-4 md:grid-cols-[1fr_300px]">
          {/* Main Visual Stage */}
          <div className="relative aspect-video w-full overflow-hidden rounded-md border border-slate-900/10 bg-slate-950 shadow-inner group">
            {/* Animated Image Container */}
            <div
              className="absolute inset-0 w-full h-full transition-transform duration-75 ease-linear"
              style={{
                transform: `scale(${currentScalePercent / 100})`,
                transformOrigin: `${meta.originX}% ${meta.originY}%`,
              }}
            >
              <img
                src={resolvedImageSrc}
                alt="Motion Preview"
                className="w-full h-full object-cover select-none"
                onError={(e) => {
                  ;(e.target as HTMLImageElement).src = DEFAULT_DEMO_IMAGE
                }}
              />
            </div>

            {/* Grid Overlay */}
            {showGrid && (
              <div className="pointer-events-none absolute inset-0 grid grid-cols-3 grid-rows-3 border border-white/20">
                {Array.from({ length: 9 }).map((_, index) => (
                  <div key={index} className="border border-white/10" />
                ))}
              </div>
            )}

            {/* Target Anchor Icon Overlay */}
            {showTarget && (
              <div
                className="pointer-events-none absolute z-20 -translate-x-1/2 -translate-y-1/2 flex items-center justify-center transition-all duration-75"
                style={{
                  left: `${meta.originX}%`,
                  top: `${meta.originY}%`,
                }}
              >
                <div className="relative flex items-center justify-center w-8 h-8">
                  <span className="absolute inset-0 rounded-full bg-brand-500/40 animate-ping" />
                  <AimOutlined className="text-brand-500 text-xl font-bold drop-shadow-md" />
                </div>
              </div>
            )}

            {/* Live Camera Badge */}
            <div className="absolute top-2.5 left-2.5 z-20 flex items-center gap-2 px-2.5 py-1 rounded bg-black/60 backdrop-blur border border-white/10 text-[11px] text-white font-mono">
              <span className={`w-2 h-2 rounded-full ${playing ? 'bg-red-500 animate-pulse' : 'bg-amber-400'}`} />
              <span>REC {sceneDuration}S</span>
              <span className="text-white/40">|</span>
              <span>{speed}x</span>
            </div>

            {/* Realtime Scale Overlay */}
            <div className="absolute bottom-2.5 left-2.5 z-20 px-2.5 py-1 rounded bg-black/60 backdrop-blur border border-white/10 text-xs font-mono text-emerald-400 font-semibold">
              Scale: {currentScalePercent.toFixed(1)}%
            </div>

            {/* Current Phase Tag */}
            <div className="absolute bottom-2.5 right-2.5 z-20">
              <Tag color={currentPhase === 'zooming' ? 'blue' : 'orange'} className="!mr-0 font-medium text-xs flex items-center gap-1">
                {currentPhase === 'zooming' ? (
                  <>
                    <ThunderboltOutlined /> Phân đoạn Zoom
                  </>
                ) : (
                  <>
                    <LockOutlined /> Pha Giữ khung hình
                  </>
                )}
              </Tag>
            </div>
          </div>

          {/* Interactive Parameters & Stats Editor Panel */}
          <div className="flex flex-col justify-between space-y-3 rounded-md border border-slate-200/80 bg-slate-50/70 p-3.5">
            <div className="space-y-3">
              <div className="flex items-center justify-between pb-2 border-b border-slate-200">
                <div className="flex items-center gap-1.5">
                  <SettingOutlined className="text-brand-500" />
                  <span className="text-xs font-semibold text-slate-700 uppercase tracking-wider">
                    Tùy chỉnh thông số
                  </span>
                </div>
                <Tag color={meta.type === 'in' ? 'red' : meta.type === 'out' ? 'cyan' : 'default'} className="!mr-0 text-[11px]">
                  {meta.type === 'in' ? 'Zoom Vào' : meta.type === 'out' ? 'Zoom Ra' : 'Tĩnh'}
                </Tag>
              </div>

              {/* Scene duration in seconds */}
              <div>
                <div className="flex justify-between items-center text-xs mb-1">
                  <span className="text-slate-600 font-medium">Thời lượng Video mô phỏng:</span>
                  <span className="font-mono text-slate-400">{sceneDuration}s</span>
                </div>
                <InputNumber
                  className="!w-full"
                  size="small"
                  min={1}
                  max={60}
                  step={1}
                  addonAfter="giây"
                  value={sceneDuration}
                  onChange={(val) => setSceneDuration(val ?? 5)}
                />
              </div>

              {/* Zoom In & Zoom Out Max Percent Editor */}
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <span className="text-[11px] text-slate-500 block mb-1">Zoom vào tối đa:</span>
                  <InputNumber
                    className="!w-full"
                    size="small"
                    min={0}
                    max={50}
                    addonAfter="%"
                    value={zoomPercent}
                    onChange={(val) => setZoomPercent(val ?? 8)}
                  />
                </div>
                <div>
                  <span className="text-[11px] text-slate-500 block mb-1">Zoom ra bắt đầu:</span>
                  <InputNumber
                    className="!w-full"
                    size="small"
                    min={0}
                    max={50}
                    addonAfter="%"
                    value={zoomOutStartPercent}
                    onChange={(val) => setZoomOutStartPercent(val ?? 12)}
                  />
                </div>
              </div>

              {/* Hold Phase Mode & Value Editor */}
              <div className="bg-white p-2.5 rounded border border-slate-200 space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-600 font-medium">Giữ khung hình (Hold):</span>
                  <Radio.Group
                    size="small"
                    value={holdMode}
                    onChange={(e) => setHoldMode(e.target.value)}
                    className="text-[11px]"
                  >
                    <Radio value="seconds">Giây</Radio>
                    <Radio value="percent">%</Radio>
                  </Radio.Group>
                </div>
                {holdMode === 'seconds' ? (
                  <InputNumber
                    className="!w-full"
                    size="small"
                    min={0}
                    max={sceneDuration}
                    step={0.5}
                    addonAfter="giây cuối"
                    value={holdSeconds}
                    onChange={(val) => setHoldSeconds(val ?? 2)}
                  />
                ) : (
                  <InputNumber
                    className="!w-full"
                    size="small"
                    min={0}
                    max={90}
                    step={5}
                    addonAfter="% scene"
                    value={holdPercent}
                    onChange={(val) => setHoldPercent(val ?? 20)}
                  />
                )}
              </div>

              {/* Calculated Realtime Summary */}
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="bg-white p-2 rounded border border-slate-200">
                  <span className="text-[10px] text-slate-400 block">Tọa độ tâm:</span>
                  <span className="font-mono text-slate-700 font-semibold text-[11px]">{meta.originLabel}</span>
                </div>
                <div className="bg-white p-2 rounded border border-slate-200">
                  <span className="text-[10px] text-slate-400 block">Tỷ lệ zoom:</span>
                  <span className="font-mono text-brand-600 font-semibold text-[11px]">
                    {(startScale * 100).toFixed(0)}% → {(endScale * 100).toFixed(0)}%
                  </span>
                </div>
              </div>
            </div>

            {/* Playback speed selector */}
            <div className="pt-2 border-t border-slate-200">
              <span className="text-[11px] text-slate-500 block mb-1">Tốc độ xem lại:</span>
              <div className="flex items-center gap-1">
                {[0.5, 1, 2].map((s) => (
                  <Button
                    key={s}
                    size="small"
                    type={speed === s ? 'primary' : 'default'}
                    onClick={() => setSpeed(s)}
                    className="flex-1 !rounded text-xs"
                  >
                    {s}x
                  </Button>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Bottom Timeline Bar */}
        <div className="rounded-md border border-slate-200 bg-white p-3 space-y-1.5">
          <div className="flex justify-between items-center text-xs">
            <span className="text-slate-600 font-medium">Tiến trình Render Timeline ({sceneDuration}s)</span>
            <span className="font-mono text-slate-500">
              {((progressPercent * sceneDuration) / 100).toFixed(1)}s / {sceneDuration}.0s
            </span>
          </div>
          <Progress
            percent={progressPercent}
            showInfo={false}
            strokeColor={{
              '0%': '#eb4e43',
              '80%': '#eb4e43',
              '100%': '#f59e0b',
            }}
            size="small"
          />
        </div>

        {/* Quick Effect Preset Buttons */}
        <div className="flex flex-wrap items-center gap-1.5 pt-1">
          <span className="text-xs font-semibold text-slate-500 shrink-0 mr-1">Thử nhanh:</span>
          {Object.values(MOTION_METAS).slice(0, 6).map((item) => (
            <Button
              key={item?.effect}
              size="small"
              type={currentEffect === item?.effect ? 'primary' : 'default'}
              onClick={() => item && handleSelectEffect(item.effect)}
              className="!rounded text-xs"
            >
              {item?.label}
            </Button>
          ))}
        </div>
      </div>
    </Modal>
  )
}
