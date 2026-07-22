import {
  Button,
  Card,
  InputNumber,
  Radio,
  Select,
  Space,
  Switch,
  Tag,
  Tooltip,
  Typography,
} from 'antd'
import {
  DeleteOutlined,
  EyeOutlined,
  FolderOpenOutlined,
  InfoCircleOutlined,
  PictureOutlined,
  PlusOutlined,
  QuestionCircleOutlined,
  VideoCameraAddOutlined,
  WarningOutlined,
} from '@ant-design/icons'
import type { BuildConfig, MotionSequenceItem } from '../../../electron/types'
import { MOTION_EFFECT_OPTIONS, RESOLUTIONS } from './constants'
import FileSelector from '../FileSelector'

interface VideoSettingsCardProps {
  mode: string
  fps: number
  sceneConcurrency: number
  buildPerformance: NonNullable<BuildConfig['buildPerformance']>
  ffmpegThreads: number
  resolution: string
  motionEnabled: boolean
  motionSequence: MotionSequenceItem[]
  motionZoomPercent: number
  motionZoomOutStartPercent: number
  motionHoldMode: string
  motionHoldPercent: number
  motionHoldSeconds: number
  motionSequenceHasZoomIn: boolean
  motionSequenceHasZoomOut: boolean
  motionSequenceAllStill: boolean
  sampleImagePath: string
  sampleVideoPath: string
  sampleBuilding: boolean
  canBuildSample: boolean
  busy: boolean
  saveVideoSettings: (patch: Partial<BuildConfig>) => void
  addMotionSequenceItem: () => void
  updateMotionSequenceItem: (id: string, effect: BuildConfig['motionEffect']) => void
  removeMotionSequenceItem: (id: string) => void
  openMotionPreview: (effect?: BuildConfig['motionEffect']) => void
  changeBuildPerformance: (value: NonNullable<BuildConfig['buildPerformance']>) => void
  chooseSampleImage: () => void
  startSampleBuild: () => void
}

export default function VideoSettingsCard({
  mode,
  fps,
  sceneConcurrency,
  buildPerformance,
  ffmpegThreads,
  resolution,
  motionEnabled,
  motionSequence,
  motionZoomPercent,
  motionZoomOutStartPercent,
  motionHoldMode,
  motionHoldPercent,
  motionHoldSeconds,
  motionSequenceHasZoomIn,
  motionSequenceHasZoomOut,
  motionSequenceAllStill,
  sampleImagePath,
  sampleVideoPath,
  sampleBuilding,
  canBuildSample,
  busy,
  saveVideoSettings,
  addMotionSequenceItem,
  updateMotionSequenceItem,
  removeMotionSequenceItem,
  openMotionPreview,
  changeBuildPerformance,
  chooseSampleImage,
  startSampleBuild,
}: VideoSettingsCardProps) {
  return (
    <Card className="!rounded-lg border border-slate-200/80 shadow-sm" title="Thiết lập video & Hiệu năng">
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        <div>
          <Typography.Text strong className="text-slate-700">Chế độ xuất</Typography.Text>
          <Radio.Group
            className="mt-2 block"
            value={mode}
            onChange={(event) => saveVideoSettings({ mode: event.target.value })}
            disabled={busy}
          >
            <Space direction="vertical">
              <Radio value="full">Full video (1 file ghép duy nhất)</Radio>
              <Radio value="clips">Clips riêng (xuất lẻ từng scene)</Radio>
            </Space>
          </Radio.Group>
        </div>
        <div>
          <Typography.Text strong className="text-slate-700">Tốc độ khung hình (FPS)</Typography.Text>
          <InputNumber
            className="mt-2 !w-full !rounded-md"
            min={1}
            max={120}
            value={fps}
            onChange={(value) => saveVideoSettings({ fps: value ?? 30 })}
            disabled={busy}
          />
        </div>
        <div>
          <Typography.Text strong className="text-slate-700">Độ phân giải (Resolution)</Typography.Text>
          <Select
            className="mt-2 w-full !rounded-md"
            value={resolution}
            options={RESOLUTIONS.map((value) => ({ value, label: value }))}
            onChange={(value) => saveVideoSettings({ resolution: value })}
            disabled={busy}
          />
        </div>
        <div>
          <Typography.Text strong className="text-slate-700">Chế độ hiệu năng</Typography.Text>
          <Select
            className="mt-2 w-full !rounded-md"
            value={buildPerformance}
            options={[
              { value: 'cool', label: 'Mát máy / ít lag (Khuyên dùng)' },
              { value: 'balanced', label: 'Cân bằng' },
              { value: 'quality', label: 'Chất lượng cao' },
            ]}
            onChange={changeBuildPerformance}
            disabled={busy}
          />
          <Typography.Text className="mt-1 block text-xs" type="secondary">
            Mát máy giúp giảm nổ quạt và quá nhiệt CPU khi render.
          </Typography.Text>
        </div>
        <div>
          <Typography.Text strong className="text-slate-700">FFmpeg threads</Typography.Text>
          <InputNumber
            className="mt-2 !w-full !rounded-md"
            min={1}
            max={16}
            step={1}
            precision={0}
            value={ffmpegThreads}
            onChange={(value) => saveVideoSettings({ ffmpegThreads: value ?? 1 })}
            disabled={busy}
          />
          <Typography.Text className="mt-1 block text-xs" type="secondary">
            Giữ 1–2 thread để máy hoạt động êm ái.
          </Typography.Text>
        </div>
        <div>
          <Typography.Text strong className="text-slate-700">Scene build song song</Typography.Text>
          <InputNumber
            className="mt-2 !w-full !rounded-md"
            min={1}
            max={8}
            step={1}
            precision={0}
            value={sceneConcurrency}
            onChange={(value) => saveVideoSettings({ sceneConcurrency: value ?? 1 })}
            disabled={busy}
          />
          <Typography.Text className="mt-1 block text-xs" type="secondary">
            Số scene xử lý đồng thời.
          </Typography.Text>
        </div>
      </div>

      {/* Motion Section */}
      <div className="mt-5 rounded-lg border border-slate-200 bg-slate-50/70 p-4 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-slate-200">
          <div>
            <div className="flex items-center gap-2">
              <Typography.Text strong className="text-slate-800 text-sm">Chuyển động camera (Motion)</Typography.Text>
              <Tooltip title="Tự động phóng to / thu nhỏ ảnh trong quá trình chạy clip giúp video sinh động và cuốn hút hơn.">
                <InfoCircleOutlined className="text-slate-400 cursor-help text-xs" />
              </Tooltip>
            </div>
            <Typography.Text className="block text-xs" type="secondary">
              {motionEnabled
                ? 'Áp dụng hiệu ứng zoom mượt cho từng hình ảnh scene.'
                : 'Hình ảnh giữ nguyên khung hình tĩnh.'}
            </Typography.Text>
          </div>
          <div className="flex items-center gap-3">
            <Button
              size="small"
              icon={<EyeOutlined />}
              onClick={() => openMotionPreview()}
              className="!rounded-md border-brand-200 text-brand-600 hover:text-brand-700 bg-white font-medium text-xs shadow-sm"
            >
              Xem minh họa chuyển động
            </Button>
            <div className="flex items-center gap-2 bg-white px-3 py-1 rounded-md border border-slate-200">
              <Typography.Text strong className="text-xs text-slate-600">Bật hiệu ứng</Typography.Text>
              <Switch
                size="small"
                checked={motionEnabled}
                disabled={busy}
                onChange={(checked) => saveVideoSettings({ motionEnabled: checked })}
              />
            </div>
          </div>
        </div>

        {motionEnabled ? (
          <div className="space-y-4">
            {/* Sequence List */}
            <div className="bg-white rounded-md border border-slate-200 p-3.5 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <Typography.Text strong className="text-xs text-slate-700">Chuỗi chuyển động video</Typography.Text>
                  <Tooltip title="Các kiểu zoom trong danh sách sẽ lần lượt được áp dụng cho từng clip trong video theo thứ tự (Clip 1 -> Clip 2 -> Clip 3 -> xoay vòng lại).">
                    <QuestionCircleOutlined className="text-slate-400 cursor-help text-xs" />
                  </Tooltip>
                </div>
                <Button
                  size="small"
                  icon={<PlusOutlined />}
                  disabled={busy}
                  onClick={addMotionSequenceItem}
                  className="!rounded-md"
                >
                  Thêm kiểu zoom
                </Button>
              </div>

              <div className="space-y-2.5">
                {motionSequence.map((item, index) => (
                  <div
                    key={item.id}
                    className="flex items-center gap-3 rounded-md border border-slate-200 bg-slate-50/60 p-2.5 hover:bg-slate-50 transition-colors"
                  >
                    <Tag color="default" className="!mr-0 font-mono text-xs font-semibold text-slate-700 shrink-0 px-2.5 py-0.5">
                      Clip {index + 1}
                    </Tag>
                    <Select
                      className="flex-1 !rounded-md font-medium text-slate-700"
                      value={item.effect}
                      options={MOTION_EFFECT_OPTIONS}
                      onChange={(value) => updateMotionSequenceItem(item.id, value)}
                      disabled={busy}
                    />
                    <Button
                      icon={<EyeOutlined />}
                      onClick={() => openMotionPreview(item.effect)}
                      title="Xem minh họa chuyển động này"
                      className="!rounded-md text-slate-600 hover:text-brand-600 font-medium shrink-0"
                    >
                      Mô phỏng
                    </Button>
                    <Button
                      danger
                      icon={<DeleteOutlined />}
                      disabled={busy || motionSequence.length <= 1}
                      onClick={() => removeMotionSequenceItem(item.id)}
                      className="!rounded-md shrink-0"
                    />
                  </div>
                ))}
              </div>
            </div>

            {/* Advanced Tuning */}
            <div className="bg-white rounded-md border border-slate-200 p-3.5 space-y-3">
              <div className="flex items-center gap-2 pb-2 border-b border-slate-100">
                <Typography.Text strong className="text-xs text-slate-700">Cấu hình thông số Zoom & Giữ khung hình</Typography.Text>
                <Tooltip title="Tùy chỉnh độ phóng to/thu nhỏ tối đa và thời gian ảnh đứng yên ở cuối mỗi clip.">
                  <InfoCircleOutlined className="text-slate-400 cursor-help text-xs" />
                </Tooltip>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                {/* Zoom In Max */}
                <div className="bg-slate-50/60 p-3 rounded-md border border-slate-200/80 space-y-1.5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <Typography.Text strong className="text-xs text-slate-700">Zoom vào tối đa (%)</Typography.Text>
                      <Tooltip
                        title={
                          <span>
                            Tỷ lệ phóng to tối đa khi dùng các kiểu Zoom Vào. Hiện bạn đang cài <strong>{motionZoomPercent}%</strong>, hình ảnh sẽ phóng to từ <strong>100%</strong> đến <strong>{(100 + motionZoomPercent).toFixed(1)}%</strong>.
                          </span>
                        }
                      >
                        <QuestionCircleOutlined className="text-brand-500 cursor-help text-xs" />
                      </Tooltip>
                    </div>
                    <Tag color={busy || motionSequenceAllStill || !motionSequenceHasZoomIn ? 'default' : 'red'} className="!mr-0 text-[10px] font-mono">
                      100% → {(100 + motionZoomPercent).toFixed(0)}%
                    </Tag>
                  </div>
                  <InputNumber
                    className="!w-full"
                    min={0}
                    max={50}
                    step={1}
                    precision={1}
                    addonAfter="%"
                    value={motionZoomPercent}
                    onChange={(value) => saveVideoSettings({ motionZoomPercent: value ?? 8 })}
                    disabled={busy || motionSequenceAllStill || !motionSequenceHasZoomIn}
                  />
                  {motionSequenceAllStill ? (
                    <Typography.Text className="block text-[11px] text-amber-600 font-medium flex items-center gap-1">
                      <WarningOutlined /> Khóa: Tất cả clip trong danh sách đều đang chọn Đứng yên (Tĩnh).
                    </Typography.Text>
                  ) : !motionSequenceHasZoomIn ? (
                    <Typography.Text className="block text-[11px] text-amber-600 font-medium flex items-center gap-1">
                      <WarningOutlined /> Khóa: Chuỗi chuyển động chưa có kiểu Zoom Vào nào.
                    </Typography.Text>
                  ) : (
                    <Typography.Text className="block text-[11px] text-slate-500">
                      Biên độ phóng đại cho tất cả kiểu Zoom Vào.
                    </Typography.Text>
                  )}
                </div>

                {/* Zoom Out Start */}
                <div className="bg-slate-50/60 p-3 rounded-md border border-slate-200/80 space-y-1.5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <Typography.Text strong className="text-xs text-slate-700">Zoom ra - bắt đầu (%)</Typography.Text>
                      <Tooltip
                        title={
                          <span>
                            Tỷ lệ phóng to ban đầu khi dùng các kiểu Zoom Ra. Hiện bạn đang cài <strong>{motionZoomOutStartPercent}%</strong>, hình ảnh sẽ bắt đầu từ <strong>{(100 + motionZoomOutStartPercent).toFixed(1)}%</strong> và thu nhỏ về <strong>100%</strong>.
                          </span>
                        }
                      >
                        <QuestionCircleOutlined className="text-brand-500 cursor-help text-xs" />
                      </Tooltip>
                    </div>
                    <Tag color={busy || !motionSequenceHasZoomOut ? 'default' : 'cyan'} className="!mr-0 text-[10px] font-mono">
                      {(100 + motionZoomOutStartPercent).toFixed(0)}% → 100%
                    </Tag>
                  </div>
                  <InputNumber
                    className="!w-full"
                    min={0}
                    max={50}
                    step={1}
                    precision={1}
                    addonAfter="%"
                    value={motionZoomOutStartPercent}
                    onChange={(value) => saveVideoSettings({ motionZoomOutStartPercent: value ?? 12 })}
                    disabled={busy || !motionSequenceHasZoomOut}
                  />
                  {!motionSequenceHasZoomOut ? (
                    <Typography.Text className="block text-[11px] text-amber-600 font-medium flex items-start gap-1">
                      <WarningOutlined className="shrink-0 mt-0.5" />
                      <span>Khóa: Danh sách chuỗi chuyển động chưa có kiểu Zoom Ra nào. (Hãy chọn một kiểu Zoom từ trong ra như "Zoom từ trong ra — góc trái trên" ở trên để kích hoạt).</span>
                    </Typography.Text>
                  ) : (
                    <Typography.Text className="block text-[11px] text-slate-500">
                      Mức thu nhỏ khởi đầu cho kiểu Zoom Ra.
                    </Typography.Text>
                  )}
                </div>

                {/* Hold Phase */}
                <div className="md:col-span-2 bg-slate-50/60 p-3 rounded-md border border-slate-200/80 space-y-2">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5">
                      <Typography.Text strong className="text-xs text-slate-700">Giữ khung hình cuối scene (Hold Phase)</Typography.Text>
                      <Tooltip
                        title={
                          <span>
                            Khoảng thời gian ảnh đứng yên cố định ở cuối clip trước khi chuyển sang cảnh mới. {motionHoldMode === 'seconds' ? (
                              <>Hiện tại cài <strong>{motionHoldSeconds}s</strong> cuối mỗi clip sẽ giữ hình ảnh tĩnh.</>
                            ) : (
                              <>Hiện tại cài <strong>{motionHoldPercent}%</strong> thời lượng cuối clip sẽ giữ hình ảnh tĩnh.</>
                            )}
                          </span>
                        }
                      >
                        <QuestionCircleOutlined className="text-brand-500 cursor-help text-xs" />
                      </Tooltip>
                    </div>
                    <Radio.Group
                      size="small"
                      value={motionHoldMode}
                      onChange={(event) => saveVideoSettings({ motionHoldMode: event.target.value })}
                      disabled={busy || motionSequenceAllStill}
                    >
                      <Radio value="percent">Theo % scene</Radio>
                      <Radio value="seconds">Số giây cố định</Radio>
                    </Radio.Group>
                  </div>

                  {motionHoldMode === 'seconds' ? (
                    <InputNumber
                      className="!w-full"
                      min={0}
                      max={300}
                      step={0.5}
                      precision={2}
                      addonAfter="giây"
                      value={motionHoldSeconds}
                      onChange={(value) => saveVideoSettings({ motionHoldSeconds: value ?? 2 })}
                      disabled={busy || motionSequenceAllStill}
                    />
                  ) : (
                    <InputNumber
                      className="!w-full"
                      min={0}
                      max={90}
                      step={5}
                      precision={1}
                      addonAfter="%"
                      value={motionHoldPercent}
                      onChange={(value) => saveVideoSettings({ motionHoldPercent: value ?? 20 })}
                      disabled={busy || motionSequenceAllStill}
                    />
                  )}

                  {motionSequenceAllStill ? (
                    <Typography.Text className="block text-[11px] text-amber-600 font-medium flex items-center gap-1">
                      <WarningOutlined /> Khóa: Tất cả clip đều Đứng yên nên không cần phân đoạn giữ khung hình.
                    </Typography.Text>
                  ) : (
                    <Typography.Text className="block text-[11px] text-slate-500">
                      {motionHoldMode === 'seconds'
                        ? `Giữ tĩnh ${motionHoldSeconds}s cuối mỗi clip. (Tự điều chỉnh nếu clip ngắn hơn).`
                        : `${motionHoldPercent}% thời lượng cuối clip đứng yên (ví dụ: clip 10s sẽ đứng yên ${((10 * motionHoldPercent) / 100).toFixed(1)}s cuối).`}
                    </Typography.Text>
                  )}
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="rounded-md border border-dashed border-slate-300 bg-white p-3 text-center text-xs text-slate-500">
            Ảnh sẽ đứng yên trong suốt thời lượng scene để tiết kiệm tài nguyên.
          </div>
        )}
      </div>

      {/* Sample Build */}
      <div className="mt-4 border-t border-slate-200/80 pt-4">
        <FileSelector
          label="Ảnh test hiệu ứng"
          value={sampleImagePath}
          placeholder="Chọn một ảnh để render clip test 10s"
          icon={<PictureOutlined className="text-fuchsia-500" />}
          buttonLabel="Chọn ảnh"
          onSelect={chooseSampleImage}
          disabled={busy}
        />
        <div className="mt-2 flex items-center justify-end gap-2">
          {sampleVideoPath && (
            <Button
              size="small"
              icon={<FolderOpenOutlined />}
              onClick={() => void window.videoBuilder.showInFolder(sampleVideoPath)}
              disabled={sampleBuilding}
              className="!rounded-md"
            >
              Xem clip test
            </Button>
          )}
          <Button
            size="small"
            type="dashed"
            icon={<VideoCameraAddOutlined />}
            loading={sampleBuilding}
            onClick={startSampleBuild}
            disabled={!canBuildSample}
            className="!rounded-md"
          >
            Build thử 10 giây
          </Button>
        </div>
      </div>
    </Card>
  )
}
