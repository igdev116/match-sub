import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { BuildConfig } from '../../electron/types'

interface SettingsState {
  videoMode: BuildConfig['mode']
  videoFps: number
  videoSceneConcurrency: number
  videoResolution: string
  motionEffect: BuildConfig['motionEffect']
  motionZoomPercent: number
  motionHoldMode: NonNullable<BuildConfig['motionHoldMode']>
  motionHoldPercent: number
  motionHoldSeconds: number
  audioPauseSeconds: number
  audioCreateSrt: boolean
  audioLanguage: string
  audioWhisperThreads: number
  audioPageSize: number
  sidebarCollapsed: boolean
  setVideoMode: (value: BuildConfig['mode']) => void
  setVideoFps: (value: number) => void
  setVideoSceneConcurrency: (value: number) => void
  setVideoResolution: (value: string) => void
  setMotionEffect: (value: BuildConfig['motionEffect']) => void
  setMotionZoomPercent: (value: number) => void
  setMotionHoldMode: (value: NonNullable<BuildConfig['motionHoldMode']>) => void
  setMotionHoldPercent: (value: number) => void
  setMotionHoldSeconds: (value: number) => void
  setAudioPauseSeconds: (value: number) => void
  setAudioCreateSrt: (value: boolean) => void
  setAudioLanguage: (value: string) => void
  setAudioWhisperThreads: (value: number) => void
  setAudioPageSize: (value: number) => void
  setSidebarCollapsed: (value: boolean) => void
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      videoMode: 'clips',
      videoFps: 30,
      videoSceneConcurrency: 2,
      videoResolution: '1920x1080',
      motionEffect: 'zoom-right',
      motionZoomPercent: 8,
      motionHoldMode: 'percent',
      motionHoldPercent: 20,
      motionHoldSeconds: 2,
      audioPauseSeconds: 1,
      audioCreateSrt: true,
      audioLanguage: 'auto',
      audioWhisperThreads: 4,
      audioPageSize: 10,
      sidebarCollapsed: false,
      setVideoMode: (videoMode) => set({ videoMode }),
      setVideoFps: (videoFps) => set({ videoFps }),
      setVideoSceneConcurrency: (videoSceneConcurrency) => set({ videoSceneConcurrency }),
      setVideoResolution: (videoResolution) => set({ videoResolution }),
      setMotionEffect: (motionEffect) => set({ motionEffect }),
      setMotionZoomPercent: (motionZoomPercent) => set({ motionZoomPercent }),
      setMotionHoldMode: (motionHoldMode) => set({ motionHoldMode }),
      setMotionHoldPercent: (motionHoldPercent) => set({ motionHoldPercent }),
      setMotionHoldSeconds: (motionHoldSeconds) => set({ motionHoldSeconds }),
      setAudioPauseSeconds: (audioPauseSeconds) => set({ audioPauseSeconds }),
      setAudioCreateSrt: (audioCreateSrt) => set({ audioCreateSrt }),
      setAudioLanguage: (audioLanguage) => set({ audioLanguage }),
      setAudioWhisperThreads: (audioWhisperThreads) => set({ audioWhisperThreads }),
      setAudioPageSize: (audioPageSize) => set({ audioPageSize }),
      setSidebarCollapsed: (sidebarCollapsed) => set({ sidebarCollapsed }),
    }),
    {
      name: 'tao-sub-settings',
      version: 1,
    },
  ),
)
