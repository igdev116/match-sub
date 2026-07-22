import {
  Alert,
  Button,
  Progress,
  Tag,
  Typography,
} from 'antd'
import { AudioOutlined, WarningOutlined } from '@ant-design/icons'
import ActionBar from '../components/ActionBar'
import AudioListCard from '../components/audio/AudioListCard'
import AudioConfigCard from '../components/audio/AudioConfigCard'
import WhisperSrtCard from '../components/audio/WhisperSrtCard'
import useAudioMergePage from '../hooks/useAudioMergePage'

export default function AudioMergePage() {
  const state = useAudioMergePage()

  return (
    <main className="mx-auto max-w-5xl space-y-5 pb-28">
      <AudioListCard
        items={state.items}
        pagedItems={state.pagedItems}
        currentPage={state.currentPage}
        pageSize={state.pageSize}
        pageStart={state.pageStart}
        audioDirectory={state.audioDirectory}
        directoryLoading={state.directoryLoading}
        processing={state.processing}
        setItems={state.setItems}
        setCurrentPage={state.setCurrentPage}
        addFiles={state.addFiles}
        selectAudioDirectory={state.selectAudioDirectory}
        refreshAudioDirectory={state.refreshAudioDirectory}
        handleDragEnd={state.handleDragEnd}
        saveAudioSettings={state.saveAudioSettings}
      />

      <AudioConfigCard
        pauseSeconds={state.pauseSeconds}
        pauseCount={state.pauseCount}
        totalPause={state.totalPause}
        outputPath={state.outputPath}
        processing={state.processing}
        saveAudioSettings={state.saveAudioSettings}
        chooseOutputPath={state.chooseOutputPath}
        showOutputFolder={state.showOutputFolder}
      />

      <WhisperSrtCard
        createSrt={state.createSrt}
        srtOutputPath={state.srtOutputPath}
        language={state.language}
        whisperThreads={state.whisperThreads}
        whisperStatus={state.whisperStatus}
        whisperSetupProgress={state.whisperSetupProgress}
        whisperSetupBusy={state.whisperSetupBusy}
        processing={state.processing}
        saveAudioSettings={state.saveAudioSettings}
        chooseSrtOutputPath={state.chooseSrtOutputPath}
        showSrtOutputFolder={state.showSrtOutputFolder}
        setupWhisper={state.setupWhisper}
      />

      {state.job && (
        <Alert
          className="!rounded-lg shadow-sm border border-slate-200"
          type={state.job.phase === 'error' ? 'error' : state.job.phase === 'complete' ? 'success' : 'info'}
          showIcon
          message={<span className="font-semibold text-xs">{state.job.message}</span>}
          description={
            <div className="space-y-2 pt-1">
              {state.job.error && <Typography.Text type="danger" className="text-xs block">{state.job.error}</Typography.Text>}
              <Progress
                percent={state.job.percent}
                status={
                  state.job.phase === 'error'
                    ? 'exception'
                    : state.job.phase === 'complete'
                      ? 'success'
                      : 'active'
                }
              />
              {!state.processing && (
                <Button size="small" onClick={() => state.dismissJob(state.projectId)} className="!rounded-md">
                  Đóng thông báo
                </Button>
              )}
            </div>
          }
        />
      )}

      <ActionBar
        leftContent={
          state.missingRequirements.length > 0 ? (
            <div className="flex items-center gap-1.5 text-amber-700 text-xs font-medium">
              <WarningOutlined className="text-amber-500 text-sm shrink-0" />
              <span>Chưa thể ghép: Cần {state.missingRequirements.join(', ')}.</span>
            </div>
          ) : (
            <div className="flex items-center gap-2 text-xs text-slate-600 font-medium">
              <Tag color="volcano" className="!mr-0 font-mono font-semibold">
                {state.items.length} audio
              </Tag>
              <span>+ {state.pauseSeconds}s khoảng nghỉ</span>
              <span className="text-slate-300">|</span>
              <span className="text-slate-500 font-mono truncate max-w-[300px]">
                Output: {state.outputPath.split(/[\\/]/).pop() || 'merged-audio.mp3'}
              </span>
            </div>
          )
        }
        rightContent={
          <Button
            type="primary"
            icon={<AudioOutlined />}
            loading={state.processing}
            disabled={state.missingRequirements.length > 0 || state.whisperSetupBusy || state.mediaBusy}
            onClick={state.merge}
            className="!rounded-md font-medium px-5 shadow-sm"
          >
            {state.createSrt ? 'Ghép audio & Xuất SRT' : 'Ghép audio ngay'}
          </Button>
        }
      />
    </main>
  )
}
