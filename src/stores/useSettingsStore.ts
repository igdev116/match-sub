import { create } from 'zustand'
import { persist } from 'zustand/middleware'

interface SettingsState {
  sidebarCollapsed: boolean
  setSidebarCollapsed: (value: boolean) => void
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      sidebarCollapsed: false,
      setSidebarCollapsed: (sidebarCollapsed) => set({ sidebarCollapsed }),
    }),
    {
      name: 'tao-sub-settings',
      version: 2,
      partialize: (state) => ({ sidebarCollapsed: state.sidebarCollapsed }),
    },
  ),
)
