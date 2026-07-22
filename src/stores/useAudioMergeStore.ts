import { create } from 'zustand'
import type { AudioMergeConfig, AudioMergeProgress } from '../../electron/types'

export interface AudioMergeItem {
  id: string
  path: string
  name: string
  durationSeconds: number | null
}

export interface AudioMergeDraft {
  items: AudioMergeItem[]
  currentPage: number
  audioDirectory: string
}

type ItemsUpdater = AudioMergeItem[] | ((items: AudioMergeItem[]) => AudioMergeItem[])
type MergeConfigInput = Omit<AudioMergeConfig, 'jobId' | 'projectId'>

interface AudioMergeStoreState {
  drafts: Record<string, AudioMergeDraft>
  jobs: Record<string, AudioMergeProgress>
  ensureDraft: (projectId: string, audioDirectory?: string) => void
  setItems: (projectId: string, updater: ItemsUpdater) => void
  setCurrentPage: (projectId: string, page: number) => void
  setAudioDirectory: (projectId: string, directory: string) => void
  applyProgress: (progress: AudioMergeProgress) => void
  startMerge: (projectId: string, config: MergeConfigInput) => Promise<void>
  dismissJob: (projectId: string) => void
}

const runningPhases = new Set<AudioMergeProgress['phase']>([
  'merging',
  'normalizing',
  'transcribing',
])

export function isAudioMergeRunning(job?: AudioMergeProgress): boolean {
  return Boolean(job && runningPhases.has(job.phase))
}

function emptyDraft(audioDirectory = ''): AudioMergeDraft {
  return { items: [], currentPage: 1, audioDirectory }
}

function cleanError(error: unknown): string {
  const text = error instanceof Error ? error.message : String(error)
  return text.replace(/^Error invoking remote method '[^']+': Error: /, '')
}

export const useAudioMergeStore = create<AudioMergeStoreState>((set, get) => ({
  drafts: {},
  jobs: {},
  ensureDraft: (projectId, audioDirectory = '') => {
    if (!projectId || get().drafts[projectId]) return
    set((state) => ({
      drafts: { ...state.drafts, [projectId]: emptyDraft(audioDirectory) },
    }))
  },
  setItems: (projectId, updater) => {
    set((state) => {
      const draft = state.drafts[projectId] ?? emptyDraft()
      const items = typeof updater === 'function' ? updater(draft.items) : updater
      return { drafts: { ...state.drafts, [projectId]: { ...draft, items } } }
    })
  },
  setCurrentPage: (projectId, currentPage) => {
    set((state) => {
      const draft = state.drafts[projectId] ?? emptyDraft()
      return { drafts: { ...state.drafts, [projectId]: { ...draft, currentPage } } }
    })
  },
  setAudioDirectory: (projectId, audioDirectory) => {
    set((state) => {
      const draft = state.drafts[projectId] ?? emptyDraft()
      return { drafts: { ...state.drafts, [projectId]: { ...draft, audioDirectory } } }
    })
  },
  applyProgress: (progress) => {
    set((state) => ({ jobs: { ...state.jobs, [progress.projectId]: progress } }))
  },
  startMerge: async (projectId, config) => {
    const runningJob = Object.values(get().jobs).find(isAudioMergeRunning)
    if (runningJob) {
      throw new Error(
        runningJob.projectId === projectId
          ? 'Tiến trình ghép audio của dự án này đang chạy.'
          : 'Một dự án khác đang ghép audio. Vui lòng đợi tiến trình đó hoàn thành.',
      )
    }

    const jobId = crypto.randomUUID()
    const initialProgress: AudioMergeProgress = {
      jobId,
      projectId,
      phase: 'merging',
      percent: 1,
      message: 'Đang chuẩn bị ghép audio...',
      outputPath: config.outputPath,
      srtOutputPath: config.createSrt ? config.srtOutputPath : undefined,
    }
    get().applyProgress(initialProgress)

    try {
      await window.videoBuilder.mergeAudio({ ...config, jobId, projectId })
    } catch (error) {
      const current = get().jobs[projectId]
      if (current?.jobId === jobId && isAudioMergeRunning(current)) {
        get().applyProgress({
          ...current,
          phase: 'error',
          percent: 0,
          message: 'Ghép audio thất bại.',
          error: cleanError(error),
        })
      }
    }
  },
  dismissJob: (projectId) => {
    if (isAudioMergeRunning(get().jobs[projectId])) return
    set((state) => {
      const jobs = { ...state.jobs }
      delete jobs[projectId]
      return { jobs }
    })
  },
}))
