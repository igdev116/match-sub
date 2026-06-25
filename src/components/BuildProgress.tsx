import { CheckCircleFilled, CloseCircleFilled, LoadingOutlined } from '@ant-design/icons'
import { Button, Modal, Progress, Space, Tag, Typography } from 'antd'
import type { BuildProgress as BuildProgressState } from '../../electron/types'

interface BuildProgressProps {
  open: boolean
  progress: BuildProgressState | null
  onStop: () => void
  onClose: () => void
}

export default function BuildProgress({
  open,
  progress,
  onStop,
  onClose,
}: BuildProgressProps) {
  const finished = progress?.phase === 'complete'
  const stopped = progress?.phase === 'stopped'
  const failed = progress?.phase === 'error'
  const active = open && !finished && !stopped && !failed
  const status = failed ? 'exception' : finished ? 'success' : 'active'

  return (
    <Modal
      title="Tiến trình build"
      open={open}
      closable={!active}
      maskClosable={!active}
      onCancel={onClose}
      footer={
        active ? (
          <Button danger onClick={onStop}>
            Dừng
          </Button>
        ) : (
          <Button type="primary" onClick={onClose}>
            Đóng
          </Button>
        )
      }
    >
      <div className="space-y-5 py-4">
        <Space align="start">
          {finished ? (
            <CheckCircleFilled className="mt-1 text-xl text-emerald-500" />
          ) : failed || stopped ? (
            <CloseCircleFilled className="mt-1 text-xl text-red-500" />
          ) : (
            <LoadingOutlined className="mt-1 text-xl text-violet-600" />
          )}
          <div>
            <Typography.Title level={5} className="!mb-1">
              {progress?.message ?? 'Đang khởi tạo...'}
            </Typography.Title>
            {progress?.outputPath && (
              <Typography.Text type="secondary" copyable>
                {progress.outputPath}
              </Typography.Text>
            )}
          </div>
        </Space>

        <Progress percent={progress?.percent ?? 0} status={status} />

        {progress && progress.totalScenes > 0 && (
          <div className="flex flex-wrap gap-2">
            <Tag color="blue">
              Hoàn thành {progress.completedScenes}/{progress.totalScenes}
            </Tag>
            {progress.currentScene && (
              <Tag color="processing">
                Scene {String(progress.currentScene).padStart(3, '0')}
              </Tag>
            )}
          </div>
        )}
      </div>
    </Modal>
  )
}
