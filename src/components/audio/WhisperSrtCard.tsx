import { Button, Card, Input, Space, Switch, Typography } from 'antd'
import {
  CheckCircleOutlined,
  FileExcelOutlined,
  FileTextOutlined,
  FolderOpenOutlined,
  FolderViewOutlined,
} from '@ant-design/icons'

interface SceneSrtCardProps {
  createSrt: boolean
  srtOutputPath: string
  sceneListPath: string
  processing: boolean
  saveAudioSettings: (patch: {
    createSrt?: boolean
    srtOutputPath?: string
  }) => void
  chooseSrtOutputPath: () => void
  showSrtOutputFolder: () => void
}

export default function SceneSrtCard({
  createSrt,
  srtOutputPath,
  sceneListPath,
  processing,
  saveAudioSettings,
  chooseSrtOutputPath,
  showSrtOutputFolder,
}: SceneSrtCardProps) {
  return (
    <Card
      className="!rounded-lg border border-slate-200/80 shadow-sm"
      title={
        <div className="flex items-center gap-2">
          <FileTextOutlined className="text-brand-500 text-base" />
          <span className="font-semibold text-slate-800">Phụ đề SRT chính xác theo scene</span>
        </div>
      }
      extra={
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium text-slate-600">Xuất SRT</span>
          <Switch
            checked={createSrt}
            disabled={processing}
            onChange={(value) => saveAudioSettings({ createSrt: value })}
          />
        </div>
      }
    >
      {!createSrt ? (
        <div className="rounded-md border border-slate-200 bg-slate-50 p-3 text-xs text-slate-500">
          Bật <strong className="text-slate-700">Xuất SRT</strong> nếu bạn muốn app tạo
          phụ đề từ nội dung Excel và timing audio nguồn.
        </div>
      ) : (
        <div className="space-y-4">
          <div className="flex items-start gap-2.5 rounded-md border border-emerald-200 bg-emerald-50/70 p-3 text-xs text-emerald-900">
            <CheckCircleOutlined className="mt-0.5 shrink-0 text-emerald-600" />
            <div className="leading-relaxed">
              <strong className="block text-emerald-950">Không cần Whisper AI</strong>
              Nội dung lấy chính xác từ Excel; thời điểm bắt đầu và kết thúc lấy từ
              Timeline của từng audio. Khoảng nghỉ giữa hai audio không hiển thị subtitle.
            </div>
          </div>

          <div className="space-y-2 rounded-md border border-slate-200 bg-slate-50/70 p-3.5">
            <Typography.Text strong className="text-xs text-slate-700">
              <FileExcelOutlined className="mr-1.5 text-emerald-500" />
              Excel kịch bản
            </Typography.Text>
            <Input
              className="font-mono text-xs"
              value={sceneListPath}
              readOnly
              status={sceneListPath ? undefined : 'error'}
              placeholder="Chọn Excel ở Nguồn dữ liệu của Video Builder"
            />
            <Typography.Text className="block text-[11px] text-slate-500">
              Thứ tự dòng Excel phải tương ứng với thứ tự audio đang ghép.
            </Typography.Text>
          </div>

          <div className="space-y-2 rounded-md border border-slate-200 bg-slate-50/70 p-3.5">
            <Typography.Text strong className="text-xs text-slate-700">
              Đường dẫn file SRT output
            </Typography.Text>
            <Space.Compact className="w-full">
              <Input
                className="font-mono text-xs"
                value={srtOutputPath}
                readOnly
                placeholder="Chưa có đường dẫn file SRT"
              />
              <Button
                icon={<FolderViewOutlined />}
                disabled={!srtOutputPath}
                onClick={() => void showSrtOutputFolder()}
                className="!rounded-none"
              >
                Mở thư mục
              </Button>
              <Button
                icon={<FolderOpenOutlined />}
                disabled={processing}
                onClick={() => void chooseSrtOutputPath()}
                className="!rounded-r-md"
              >
                Chọn file SRT
              </Button>
            </Space.Compact>
          </div>
        </div>
      )}
    </Card>
  )
}
