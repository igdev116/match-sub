import {
  Button,
  Card,
  Input,
  InputNumber,
  Space,
  Tooltip,
  Typography,
} from 'antd'
import {
  FolderOpenOutlined,
  FolderViewOutlined,
  QuestionCircleOutlined,
  SettingOutlined,
} from '@ant-design/icons'

interface AudioConfigCardProps {
  pauseSeconds: number
  pauseCount: number
  totalPause: number
  outputPath: string
  processing: boolean
  saveAudioSettings: (patch: { pauseSeconds?: number }) => void
  chooseOutputPath: () => void
  showOutputFolder: () => void
}

export default function AudioConfigCard({
  pauseSeconds,
  pauseCount,
  totalPause,
  outputPath,
  processing,
  saveAudioSettings,
  chooseOutputPath,
  showOutputFolder,
}: AudioConfigCardProps) {
  return (
    <Card
      className="!rounded-lg border border-slate-200/80 shadow-sm"
      title={
        <div className="flex items-center gap-2">
          <SettingOutlined className="text-brand-500 text-base" />
          <span className="font-semibold text-slate-800">Cấu hình ghép nối & Output MP3</span>
        </div>
      }
    >
      <div className="grid gap-4 md:grid-cols-2">
        <div className="bg-slate-50/70 p-3.5 rounded-md border border-slate-200/80 space-y-2">
          <div className="flex items-center gap-1.5">
            <Typography.Text strong className="text-xs text-slate-700">
              Khoảng nghỉ giữa các tệp audio (Pause Gap)
            </Typography.Text>
            <Tooltip title="Tự động chèn khoảng tĩnh không tiếng (tính theo giây) ở điểm nối giữa từng tệp audio.">
              <QuestionCircleOutlined className="text-brand-500 cursor-help text-xs" />
            </Tooltip>
          </div>
          <InputNumber
            className="!w-full"
            min={0}
            max={60}
            step={0.5}
            precision={1}
            addonAfter="giây"
            value={pauseSeconds}
            disabled={processing}
            onChange={(value) => saveAudioSettings({ pauseSeconds: value ?? 1 })}
          />
          <Typography.Text className="block text-[11px] text-slate-500">
            Tạo {pauseCount} điểm nối (tổng chèn thêm <strong className="text-slate-700">+{totalPause.toFixed(1)}s</strong> thời lượng tĩnh).
          </Typography.Text>
        </div>

        <div className="bg-slate-50/70 p-3.5 rounded-md border border-slate-200/80 space-y-2">
          <div className="flex items-center gap-1.5">
            <Typography.Text strong className="text-xs text-slate-700">
              Đường dẫn File MP3 thành phẩm
            </Typography.Text>
            <Tooltip title="Nơi lưu trữ file MP3 đã được nối hoàn chỉnh.">
              <QuestionCircleOutlined className="text-brand-500 cursor-help text-xs" />
            </Tooltip>
          </div>
          <Space.Compact className="w-full">
            <Input className="font-mono text-xs" value={outputPath} readOnly placeholder="Chưa có đường dẫn output" />
            <Button
              icon={<FolderViewOutlined />}
              disabled={!outputPath}
              onClick={() => void showOutputFolder()}
              title="Mở thư mục chứa file"
              className="!rounded-none"
            >
              Mở thư mục
            </Button>
            <Button
              type="primary"
              icon={<FolderOpenOutlined />}
              disabled={processing}
              onClick={() => void chooseOutputPath()}
              className="!rounded-r-md"
            >
              Chọn vị trí
            </Button>
          </Space.Compact>
          <Typography.Text className="block text-[11px] text-slate-500">
            Mặc định xuất file tên: <code className="font-mono text-slate-600">merged-audio.mp3</code>
          </Typography.Text>
        </div>
      </div>
    </Card>
  )
}
