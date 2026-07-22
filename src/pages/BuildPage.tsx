import { Button, Card, Typography } from 'antd'
import { PlayCircleOutlined, ScanOutlined } from '@ant-design/icons'
import ActionBar from '../components/ActionBar'
import AlignmentPreview from '../components/AlignmentPreview'
import BuildProgress from '../components/BuildProgress'
import MotionPreviewModal from '../components/MotionPreviewModal'
import SourcePreview from '../components/SourcePreview'
import SourceDataCard from '../components/build/SourceDataCard'
import VideoSettingsCard from '../components/build/VideoSettingsCard'
import useBuildPage from '../hooks/useBuildPage'

export default function BuildPage() {
  const state = useBuildPage()

  return (
    <>
      <main className="mx-auto max-w-5xl space-y-5 pb-24">
        <div className="space-y-5">
          <SourceDataCard
            imagesDirectory={state.imagesDirectory}
            sceneListPath={state.sceneListPath}
            srtPath={state.srtPath}
            outputDisplayPath={state.outputDisplayPath}
            sourceFolder={state.sourceFolder}
            sourceInfos={state.sourceInfos}
            sourceErrors={state.sourceErrors}
            sourceInspecting={state.sourceInspecting}
            mode={state.mode}
            busy={state.busy}
            setSceneListPath={state.setSceneListPath}
            setSrtPath={state.setSrtPath}
            chooseDirectory={state.chooseDirectory}
            chooseFile={state.chooseFile}
            chooseOutput={state.chooseOutput}
            chooseSourceFolder={state.chooseSourceFolder}
            refreshSourceFolder={state.refreshSourceFolder}
            loadSourcePreview={state.loadSourcePreview}
          />

          <VideoSettingsCard
            mode={state.mode}
            fps={state.fps}
            sceneConcurrency={state.sceneConcurrency}
            buildPerformance={state.buildPerformance}
            ffmpegThreads={state.ffmpegThreads}
            resolution={state.resolution}
            motionEnabled={state.motionEnabled}
            motionSequence={state.motionSequence}
            motionZoomPercent={state.motionZoomPercent}
            motionZoomOutStartPercent={state.motionZoomOutStartPercent}
            motionHoldMode={state.motionHoldMode}
            motionHoldPercent={state.motionHoldPercent}
            motionHoldSeconds={state.motionHoldSeconds}
            motionSequenceHasZoomIn={state.motionSequenceHasZoomIn}
            motionSequenceHasZoomOut={state.motionSequenceHasZoomOut}
            motionSequenceAllStill={state.motionSequenceAllStill}
            sampleImagePath={state.sampleImagePath}
            sampleVideoPath={state.sampleVideoPath}
            sampleBuilding={state.sampleBuilding}
            canBuildSample={state.canBuildSample}
            busy={state.busy}
            saveVideoSettings={state.saveVideoSettings}
            addMotionSequenceItem={state.addMotionSequenceItem}
            updateMotionSequenceItem={state.updateMotionSequenceItem}
            removeMotionSequenceItem={state.removeMotionSequenceItem}
            openMotionPreview={state.openMotionPreview}
            changeBuildPerformance={state.changeBuildPerformance}
            chooseSampleImage={state.chooseSampleImage}
            startSampleBuild={state.startSampleBuild}
          />

          {!state.ffmpeg.checking && !state.ffmpeg.available && (
            <Card className="!rounded-lg border-red-200 bg-red-50">
              <Typography.Text type="danger">
                {state.ffmpeg.repairMessage || 'Không tìm thấy bộ xử lý FFmpeg.'}
              </Typography.Text>
            </Card>
          )}
        </div>
      </main>

      <ActionBar
        leftContent={
          <div className="flex items-center gap-2.5 text-xs">
            <span className={`inline-block w-2 h-2 rounded-full ${state.inputsReady ? 'bg-emerald-500' : 'bg-amber-400'}`} />
            <span className="text-slate-600 font-medium">
              {state.inputsReady ? 'Nguồn dữ liệu hợp lệ' : 'Đang chờ chọn đủ tệp nguồn'}
            </span>
          </div>
        }
        rightContent={
          <>
            <Button
              icon={<ScanOutlined />}
              onClick={state.preview}
              disabled={!state.inputsReady || state.busy}
              className="!rounded-md font-medium"
            >
              Preview Alignment
            </Button>
            <Button
              type="primary"
              icon={<PlayCircleOutlined />}
              onClick={state.startBuild}
              disabled={!state.canBuild}
              className="!rounded-md font-medium px-5 shadow-sm"
            >
              Build Video
            </Button>
          </>
        }
      />

      <AlignmentPreview
        open={state.previewOpen}
        loading={state.previewLoading}
        items={state.alignment}
        warnings={state.alignmentWarnings}
        motionEnabled={state.motionEnabled}
        motionEffect={state.motionEffect}
        motionSequence={state.motionSequence}
        motionZoomPercent={state.motionZoomPercent}
        motionZoomOutStartPercent={state.motionZoomOutStartPercent}
        motionHoldMode={state.motionHoldMode}
        motionHoldPercent={state.motionHoldPercent}
        motionHoldSeconds={state.motionHoldSeconds}
        onClose={() => state.setPreviewOpen(false)}
      />
      <SourcePreview
        data={state.sourcePreview}
        loading={state.sourcePreviewLoading}
        onClose={() => state.setSourcePreview(null)}
      />
      <BuildProgress
        open={state.progressOpen}
        progress={state.progress}
        onStop={() => void window.videoBuilder.stopBuild()}
        onClose={() => !state.building && state.setProgressOpen(false)}
      />
      <MotionPreviewModal
        open={state.motionModalOpen}
        effect={state.previewMotionEffect}
        motionZoomPercent={state.motionZoomPercent}
        motionZoomOutStartPercent={state.motionZoomOutStartPercent}
        motionHoldMode={state.motionHoldMode}
        motionHoldPercent={state.motionHoldPercent}
        motionHoldSeconds={state.motionHoldSeconds}
        sampleImagePath={state.sampleImagePath}
        onEffectChange={(eff) => state.setPreviewMotionEffect(eff)}
        onSettingsChange={(newSettings) => state.saveVideoSettings(newSettings)}
        onClose={() => state.setMotionModalOpen(false)}
      />
    </>
  )
}
