import { useEffect, useState } from 'react'
import { App as AntApp, ConfigProvider } from 'antd'
import viVN from 'antd/locale/vi_VN'
import AppShell, { type AppMenuKey } from './layouts/AppShell'
import AudioMergePage from './pages/AudioMergePage'
import BuildPage from './pages/BuildPage'
import ProjectPage from './pages/ProjectPage'
import { useProjectStore } from './stores/useProjectStore'
import type { AppToolKey } from './layouts/AppShell'

function projectMenuKey(projectId: string, tool: AppToolKey): AppMenuKey {
  return `project:${projectId}:${tool}`
}

function parseProjectMenuKey(key: AppMenuKey): { projectId: string; tool: AppToolKey } | null {
  const match = key.match(/^project:(.+):(video-builder|audio-merge)$/)
  if (!match) return null
  return { projectId: match[1], tool: match[2] as AppToolKey }
}

export default function App() {
  const loadProjects = useProjectStore((state) => state.loadProjects)
  const activeProject = useProjectStore((state) => state.activeProject)
  const projects = useProjectStore((state) => state.projects)
  const activeProjectId = useProjectStore((state) => state.activeProjectId)
  const selectProject = useProjectStore((state) => state.selectProject)
  const loadingProjects = useProjectStore((state) => state.loading)
  const [activeMenu, setActiveMenu] = useState<AppMenuKey>('project-manager')
  const [visitedMenus, setVisitedMenus] = useState<Set<AppMenuKey>>(
    () => new Set<AppMenuKey>(['project-manager']),
  )

  useEffect(() => {
    void loadProjects().then((state) => {
      if (state.activeProject) navigate(projectMenuKey(state.activeProject.id, 'video-builder'))
    })
  }, [loadProjects])

  function navigate(key: AppMenuKey) {
    setActiveMenu(key)
    setVisitedMenus((current) => {
      if (current.has(key)) return current
      const next = new Set(current)
      next.add(key)
      return next
    })
  }

  async function handleNavigate(key: AppMenuKey) {
    if (key === 'project-manager') {
      navigate(key)
      return
    }
    const parsed = parseProjectMenuKey(key)
    if (!parsed) return
    if (parsed.projectId !== activeProjectId) {
      await selectProject(parsed.projectId)
    }
    navigate(key)
  }

  const activeProjectMenu = parseProjectMenuKey(activeMenu)
  const activeTool = activeProjectMenu?.tool

  return (
    <ConfigProvider
      locale={viVN}
      theme={{
        token: {
          colorPrimary: '#6d5dfc',
          borderRadius: 10,
          fontFamily: 'Inter, ui-sans-serif, system-ui, -apple-system, sans-serif',
        },
      }}
    >
      <AntApp>
        <AppShell
          activeKey={activeMenu}
          onNavigate={handleNavigate}
          projects={projects}
          activeProjectId={activeProjectId}
        >
          <div className={activeMenu === 'project-manager' ? 'block' : 'hidden'}>
            <ProjectPage
              onOpenProject={(projectId) => navigate(projectMenuKey(projectId, 'video-builder'))}
            />
          </div>
          {activeProject && visitedMenus.has(activeMenu) && activeTool === 'video-builder' && (
            <div className="block">
              <BuildPage key={activeProject.id} />
            </div>
          )}
          {activeProject && visitedMenus.has(activeMenu) && activeTool === 'audio-merge' && (
            <div className="block">
              <AudioMergePage key={activeProject.id} />
            </div>
          )}
          {loadingProjects && null}
        </AppShell>
      </AntApp>
    </ConfigProvider>
  )
}
