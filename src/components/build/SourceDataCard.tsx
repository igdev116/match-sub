import {
  Button,
  Card,
  Space,
  Tooltip,
  Typography,
} from 'antd'
import {
  FileExcelOutlined,
  FileTextOutlined,
  FieldTimeOutlined,
  FolderOpenOutlined,
  InfoCircleOutlined,
  QuestionCircleOutlined,
  ReloadOutlined,
  SaveOutlined,
} from '@ant-design/icons'
import type { PathInfo } from '../../../electron/types'
import type { SourceKey } from './constants'
import { formatPathMeta } from './constants'
import FileSelector from '../FileSelector'

interface SourceDataCardProps {
  imagesDirectory: string
  sceneListPath: string
  srtPath: string
  timelinePath: string
  outputDisplayPath: string
  sourceFolder: string
  sourceInfos: Record<SourceKey, PathInfo>
  sourceErrors: Partial<Record<SourceKey, string>>
  sourceInspecting: boolean
  mode: string
  busy: boolean
  setSceneListPath: (path: string) => void
  setSrtPath: (path: string) => void
  setTimelinePath: (path: string) => void
  clearTimeline: () => void
  chooseDirectory: () => void
  chooseFile: (extensions: string[], setter: (path: string) => void, key: SourceKey) => void
  chooseOutput: () => void
  chooseSourceFolder: () => void
  refreshSourceFolder: () => void
  loadSourcePreview: (kind: 'images' | 'excel' | 'srt') => void
}

export default function SourceDataCard({
  imagesDirectory,
  sceneListPath,
  srtPath,
  timelinePath,
  outputDisplayPath,
  sourceFolder,
  sourceInfos,
  sourceErrors,
  sourceInspecting,
  mode,
  busy,
  setSceneListPath,
  setSrtPath,
  setTimelinePath,
  clearTimeline,
  chooseDirectory,
  chooseFile,
  chooseOutput,
  chooseSourceFolder,
  refreshSourceFolder,
  loadSourcePreview,
}: SourceDataCardProps) {
  return (
    <Card
      className="!rounded-lg border border-slate-200/80 shadow-sm"
      title={
        <div className="flex items-center gap-2">
          <span>Nguồn dữ liệu dự án</span>
          <Tooltip title="Tự động quét Thư mục ảnh, Excel kịch bản, Timeline audio và SRT fallback trong folder nguồn.">
            <QuestionCircleOutlined className="text-brand-500 cursor-help text-xs" />
          </Tooltip>
        </div>
      }
      extra={
        <Space>
          <Button
            icon={<ReloadOutlined />}
            loading={sourceInspecting}
            disabled={busy || !sourceFolder}
            onClick={() => void refreshSourceFolder()}
            className="!rounded-md"
          >
            Làm mới
          </Button>
          <Tooltip title="Chọn folder chứa ảnh, Excel và Timeline audio. SRT chỉ cần cho project cũ chưa có Timeline.">
            <Button
              type="primary"
              icon={<FolderOpenOutlined />}
              loading={sourceInspecting}
              disabled={busy}
              onClick={() => void chooseSourceFolder()}
              className="!rounded-md"
            >
              Chọn folder nguồn tự động
            </Button>
          </Tooltip>
        </Space>
      }
    >
      <div className="space-y-3">
        <div className="flex items-start gap-2.5 rounded-md bg-blue-50/70 border border-blue-200/80 p-3 text-xs text-blue-900">
          <InfoCircleOutlined className="text-blue-600 text-sm shrink-0 mt-0.5" />
          <div className="leading-relaxed">
            <strong className="font-semibold text-blue-950 block mb-0.5">Tự động nạp dữ liệu từ Folder nguồn:</strong>
            Khi chọn một <strong>Folder nguồn</strong>, hệ thống tự tìm ảnh scene,
            Excel kịch bản và Timeline audio. Nếu có Timeline, app dùng nội dung Excel
            làm subtitle nên không cần Whisper SRT.
          </div>
        </div>

        {sourceFolder && (
          <div className="flex items-center justify-between gap-3 rounded-md bg-slate-50 border border-slate-200/70 px-4 py-2 text-xs">
            <span className="text-slate-500 font-medium shrink-0">Folder nguồn đã nạp:</span>
            <Typography.Text copyable ellipsis className="font-mono text-slate-700">
              {sourceFolder}
            </Typography.Text>
          </div>
        )}
        <FileSelector
          label="Thư mục ảnh"
          value={imagesDirectory}
          placeholder="Chọn thư mục chứa ảnh scene"
          icon={<FolderOpenOutlined className="text-brand-500" />}
          buttonLabel="Chọn thư mục"
          onSelect={chooseDirectory}
          onPreview={() => void loadSourcePreview('images')}
          disabled={busy}
          status={sourceErrors.imagesDirectory ? 'error' : undefined}
          error={sourceErrors.imagesDirectory}
          metaText={formatPathMeta(sourceInfos.imagesDirectory)}
          tooltipTitle="Thư mục chứa danh sách hình ảnh minh họa cho các cảnh (scene) trong video."
        />
        <FileSelector
          label="Scene list (Excel)"
          value={sceneListPath}
          placeholder="Chọn file Excel có cột STT và Nội dung"
          icon={<FileExcelOutlined className="text-emerald-500" />}
          buttonLabel="Chọn file"
          onSelect={() => chooseFile(['xlsx', 'xls'], setSceneListPath, 'sceneListPath')}
          onPreview={() => void loadSourcePreview('excel')}
          disabled={busy}
          status={sourceErrors.sceneListPath ? 'error' : undefined}
          error={sourceErrors.sceneListPath}
          metaText={formatPathMeta(sourceInfos.sceneListPath)}
          tooltipTitle="File bảng tính Excel (.xlsx/.xls) quy định thứ tự hiển thị cảnh và lời thoại tương ứng."
        />
        <FileSelector
          label="File phụ đề (SRT fallback — không bắt buộc)"
          value={srtPath}
          placeholder="Chọn file phụ đề .srt"
          icon={<FileTextOutlined className="text-blue-500" />}
          buttonLabel="Chọn file"
          onSelect={() => chooseFile(['srt'], setSrtPath, 'srtPath')}
          onPreview={() => void loadSourcePreview('srt')}
          disabled={busy}
          status={sourceErrors.srtPath ? 'error' : undefined}
          error={sourceErrors.srtPath}
          helperText={
            timelinePath
              ? 'Không dùng khi có Timeline: subtitle lấy chính xác từ nội dung Excel.'
              : 'Chỉ bắt buộc với project cũ chưa có Timeline audio.'
          }
          metaText={formatPathMeta(sourceInfos.srtPath)}
          tooltipTitle="Chỉ dùng làm nguồn timing fallback khi project chưa có Timeline audio."
        />
        <FileSelector
          label="Timeline audio"
          value={timelinePath}
          placeholder="Tự động tạo khi ghép audio (không bắt buộc)"
          icon={<FieldTimeOutlined className="text-cyan-600" />}
          buttonLabel="Chọn timeline"
          onSelect={() => chooseFile(['json'], setTimelinePath, 'timelinePath')}
          onClear={clearTimeline}
          disabled={busy}
          status={sourceErrors.timelinePath ? 'error' : undefined}
          error={sourceErrors.timelinePath}
          helperText={
            timelinePath
              ? 'Duration lấy từ audio nguồn; subtitle lấy trực tiếp từ nội dung Excel.'
              : 'Chưa có timeline: app sẽ fallback timing theo SRT và có thể lệch khi Whisper gộp scene.'
          }
          metaText={formatPathMeta(sourceInfos.timelinePath)}
          tooltipTitle="File nhỏ do app tự tạo khi ghép audio, lưu ranh giới chính xác của từng scene."
        />
        <FileSelector
          label={mode === 'clips' ? 'Thư mục lưu clips' : 'Output video'}
          value={outputDisplayPath}
          placeholder={mode === 'clips' ? 'Chọn folder để lưu nhiều video' : 'Chọn nơi lưu output.mp4'}
          icon={
            mode === 'clips'
              ? <FolderOpenOutlined className="text-amber-500" />
              : <SaveOutlined className="text-amber-500" />
          }
          buttonLabel={mode === 'clips' ? 'Chọn folder' : 'Chọn nơi lưu'}
          onSelect={chooseOutput}
          disabled={busy}
          status={sourceErrors.outputPath ? 'error' : undefined}
          error={sourceErrors.outputPath}
          metaText={formatPathMeta(sourceInfos.outputPath)}
          tooltipTitle={mode === 'clips' ? 'Thư mục đich để lưu danh sách các clips video được tạo ra.' : 'Đường dẫn vị trí lưu file video hoàn chỉnh sau khi xuất.'}
        />
      </div>
    </Card>
  )
}
