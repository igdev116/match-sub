import {
  Alert,
  Button,
  Card,
  Input,
  InputNumber,
  Progress,
  Select,
  Space,
  Switch,
  Tag,
  Tooltip,
  Typography,
} from 'antd'
import {
  CloudDownloadOutlined,
  FileTextOutlined,
  FolderOpenOutlined,
  FolderViewOutlined,
  QuestionCircleOutlined,
} from '@ant-design/icons'
import type { WhisperProgress, WhisperStatus } from '../../../electron/types'

interface WhisperSrtCardProps {
  createSrt: boolean
  srtOutputPath: string
  language: string
  whisperThreads: number
  whisperStatus: WhisperStatus | null
  whisperSetupProgress: WhisperProgress | null
  whisperSetupBusy: boolean
  processing: boolean
  saveAudioSettings: (patch: {
    createSrt?: boolean
    srtOutputPath?: string
    language?: string
    whisperThreads?: number
  }) => void
  chooseSrtOutputPath: () => void
  showSrtOutputFolder: () => void
  setupWhisper: (action: 'install' | 'download') => void
}

export default function WhisperSrtCard({
  createSrt,
  srtOutputPath,
  language,
  whisperThreads,
  whisperStatus,
  whisperSetupProgress,
  whisperSetupBusy,
  processing,
  saveAudioSettings,
  chooseSrtOutputPath,
  showSrtOutputFolder,
  setupWhisper,
}: WhisperSrtCardProps) {
  return (
    <Card
      className="!rounded-lg border border-slate-200/80 shadow-sm"
      title={
        <div className="flex items-center gap-2">
          <FileTextOutlined className="text-brand-500 text-base" />
          <span className="font-semibold text-slate-800">Trích xuất Phụ đề SRT (Whisper AI)</span>
        </div>
      }
      extra={
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium text-slate-600">Bật nhận dạng SRT</span>
          <Switch
            checked={createSrt}
            disabled={processing || whisperSetupBusy}
            onChange={(value) => saveAudioSettings({ createSrt: value })}
          />
        </div>
      }
    >
      {!createSrt ? (
        <div className="p-3 bg-slate-50 rounded-md border border-slate-200 text-xs text-slate-500">
          Gạt công tắc <strong className="text-slate-700">"Bật nhận dạng SRT"</strong> ở góc trên nếu bạn muốn AI tự động lắng nghe và xuất file phụ đề .srt tương ứng với file MP3 nối.
        </div>
      ) : (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-2.5 bg-slate-50/70 p-3 rounded-md border border-slate-200/80">
            <Tag color={whisperStatus?.available ? 'success' : 'error'} className="!mr-0 font-medium text-xs">
              {whisperStatus?.available
                ? whisperStatus.executableSource === 'bundled'
                  ? 'Whisper AI (Bundled): Sẵn sàng'
                  : 'Whisper.cpp: Sẵn sàng'
                : 'Chưa cài Whisper.cpp'}
            </Tag>
            <Tag color={whisperStatus?.modelAvailable ? 'success' : 'warning'} className="!mr-0 font-medium text-xs">
              {whisperStatus?.modelAvailable
                ? whisperStatus.modelSource === 'bundled'
                  ? 'Model Base AI (Bundled): Sẵn sàng'
                  : 'Model Base: Sẵn sàng'
                : 'Chưa nạp Model Base'}
            </Tag>

            {!whisperStatus?.available && whisperStatus?.installSupported && (
              <Button
                type="primary"
                size="small"
                icon={<CloudDownloadOutlined />}
                loading={whisperSetupBusy}
                disabled={processing}
                onClick={() => void setupWhisper('install')}
                className="!rounded-md"
              >
                Cài bằng Homebrew
              </Button>
            )}
            {!whisperStatus?.modelAvailable && whisperStatus?.downloadSupported && (
              <Button
                size="small"
                icon={<CloudDownloadOutlined />}
                loading={whisperSetupBusy}
                disabled={processing}
                onClick={() => void setupWhisper('download')}
                className="!rounded-md"
              >
                Tải Model Base (~148 MB)
              </Button>
            )}
          </div>

          {whisperStatus?.repairMessage && (
            <Alert
              type="error"
              showIcon
              className="!rounded-md"
              message="Bộ cài không đầy đủ"
              description={whisperStatus.repairMessage}
            />
          )}

          {whisperSetupProgress && (
            <div className="bg-slate-50 p-3 rounded-md border border-slate-200 space-y-1.5">
              <Typography.Text className="text-xs font-medium text-slate-700">
                {whisperSetupProgress.message}
              </Typography.Text>
              <Progress
                className="!mb-0"
                percent={whisperSetupProgress.percent}
                status={whisperSetupProgress.phase === 'error' ? 'exception' : 'active'}
              />
            </div>
          )}

          <div className="bg-slate-50/70 p-3.5 rounded-md border border-slate-200/80 space-y-2">
            <div className="flex items-center gap-1.5">
              <Typography.Text strong className="text-xs text-slate-700">
                Đường dẫn File SRT output
              </Typography.Text>
              <Tooltip title="Vị trí lưu file phụ đề chuẩn .srt sau khi Whisper AI nhận dạng xong.">
                <QuestionCircleOutlined className="text-brand-500 cursor-help text-xs" />
              </Tooltip>
            </div>
            <Space.Compact className="w-full">
              <Input className="font-mono text-xs" value={srtOutputPath} readOnly placeholder="Chưa có đường dẫn file SRT" />
              <Button
                icon={<FolderViewOutlined />}
                disabled={!srtOutputPath}
                onClick={() => void showSrtOutputFolder()}
                title="Mở thư mục chứa file SRT"
                className="!rounded-none"
              >
                Mở thư mục
              </Button>
              <Button
                icon={<FolderOpenOutlined />}
                disabled={processing || whisperSetupBusy}
                onClick={() => void chooseSrtOutputPath()}
                className="!rounded-r-md"
              >
                Chọn file SRT
              </Button>
            </Space.Compact>
            <Typography.Text className="block text-[11px] text-slate-500">
              Tự động gợi ý lưu cùng tên với file MP3 output.
            </Typography.Text>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="bg-slate-50/70 p-3.5 rounded-md border border-slate-200/80 space-y-2">
              <div className="flex items-center gap-1.5">
                <Typography.Text strong className="text-xs text-slate-700">Ngôn ngữ audio</Typography.Text>
                <Tooltip title="Ngôn ngữ chính trong các bài audio để Whisper AI nhận dạng chính xác hơn.">
                  <QuestionCircleOutlined className="text-brand-500 cursor-help text-xs" />
                </Tooltip>
              </div>
              <Select
                className="!w-full"
                value={language}
                disabled={processing || whisperSetupBusy}
                onChange={(value) => saveAudioSettings({ language: value })}
                options={[
                  { value: 'auto', label: 'Tự động nhận diện' },
                  { value: 'vi', label: 'Tiếng Việt' },
                  { value: 'ja', label: 'Tiếng Nhật' },
                  { value: 'en', label: 'Tiếng Anh' },
                  { value: 'zh', label: 'Tiếng Trung' },
                  { value: 'ko', label: 'Tiếng Hàn' },
                ]}
              />
            </div>

            <div className="bg-slate-50/70 p-3.5 rounded-md border border-slate-200/80 space-y-2">
              <div className="flex items-center gap-1.5">
                <Typography.Text strong className="text-xs text-slate-700">Số CPU thread</Typography.Text>
                <Tooltip title="Số nhân CPU xử lý song song. Mặc định 4 threads giúp nhận dạng nhanh mà không làm giật đơ ứng dụng.">
                  <QuestionCircleOutlined className="text-brand-500 cursor-help text-xs" />
                </Tooltip>
              </div>
              <InputNumber
                className="!w-full"
                min={1}
                max={8}
                value={whisperThreads}
                disabled={processing || whisperSetupBusy}
                onChange={(value) => saveAudioSettings({ whisperThreads: value ?? 4 })}
              />
              <Typography.Text className="block text-[11px] text-slate-500">
                Mặc định 4 threads giúp hệ thống luôn mượt mà.
              </Typography.Text>
            </div>
          </div>
        </div>
      )}
    </Card>
  )
}
