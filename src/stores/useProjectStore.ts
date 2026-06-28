import { create } from 'zustand'
import type {
  AppProject,
  ProjectAudioSettings,
  ProjectState,
  ProjectVideoSettings,
} from '../../electron/types'

interface ProjectStoreState {
  projects: AppProject[]
  activeProjectId: string
  activeProject: AppProject | null
  loading: boolean
  setProjectState: (state: ProjectState) => void
  loadProjects: () => Promise<ProjectState>
  createProject: (name: string) => Promise<ProjectState>
  createProjectFromSourceFolder: () => Promise<ProjectState>
  selectProject: (projectId: string) => Promise<ProjectState>
  renameProject: (projectId: string, name: string) => Promise<ProjectState>
  deleteProject: (projectId: string) => Promise<ProjectState>
  updateVideoSettings: (patch: Partial<ProjectVideoSettings>) => Promise<ProjectState>
  updateAudioSettings: (patch: Partial<ProjectAudioSettings>) => Promise<ProjectState>
}

export const useProjectStore = create<ProjectStoreState>((set) => {
  function apply(state: ProjectState): ProjectState {
    set({
      projects: state.projects,
      activeProjectId: state.activeProjectId,
      activeProject: state.activeProject,
      loading: false,
    })
    return state
  }

  return {
    projects: [],
    activeProjectId: '',
    activeProject: null,
    loading: true,
    setProjectState: apply,
    loadProjects: async () => {
      set({ loading: true })
      return apply(await window.videoBuilder.getProjectState())
    },
    createProject: async (name) => apply(await window.videoBuilder.createProject(name)),
    createProjectFromSourceFolder: async () =>
      apply(await window.videoBuilder.createProjectFromSourceFolder()),
    selectProject: async (projectId) => apply(await window.videoBuilder.selectProject(projectId)),
    renameProject: async (projectId, name) =>
      apply(await window.videoBuilder.renameProject(projectId, name)),
    deleteProject: async (projectId) => apply(await window.videoBuilder.deleteProject(projectId)),
    updateVideoSettings: async (patch) =>
      apply(await window.videoBuilder.updateVideoProjectSettings(patch)),
    updateAudioSettings: async (patch) =>
      apply(await window.videoBuilder.updateAudioProjectSettings(patch)),
  }
})
