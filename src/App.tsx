import { lazy, Suspense, useEffect, useRef, useState, useTransition } from 'react'
import { App as AntApp, ConfigProvider, Spin } from 'antd'
import viVN from 'antd/locale/vi_VN'
import AppShell, { type AppMenuKey } from './layouts/AppShell'
import TopProgressBar from './components/TopProgressBar'
import ProjectPage from './pages/ProjectPage'
import { useProjectStore } from './stores/useProjectStore'
import { useAudioMergeStore } from './stores/useAudioMergeStore'
import type { AppToolKey } from './layouts/AppShell'

const BuildPage = lazy(() => import('./pages/BuildPage'))
const AudioMergePage = lazy(() => import('./pages/AudioMergePage'))
const VideoShufflePage = lazy(() => import('./pages/VideoShufflePage'))

function projectMenuKey(projectId: string, tool: AppToolKey): AppMenuKey {
  return `project:${projectId}:${tool}`
}

function parseProjectMenuKey(key: AppMenuKey): { projectId: string; tool: AppToolKey } | null {
  const match = key.match(/^project:(.+):(video-builder|audio-merge|video-shuffle)$/)
  if (!match) return null
  return { projectId: match[1], tool: match[2] as AppToolKey }
}

function AudioMergeRuntimeBridge() {
  const { notification } = AntApp.useApp()
  const applyProgress = useAudioMergeStore((state) => state.applyProgress)
  const notifiedEvents = useRef(new Set<string>())

  useEffect(
    () =>
      window.videoBuilder.onAudioMergeProgress((progress) => {
        applyProgress(progress)
        if (progress.phase !== 'complete' && progress.phase !== 'error') return
        const eventKey = `${progress.jobId}:${progress.phase}`
        if (notifiedEvents.current.has(eventKey)) return
        notifiedEvents.current.add(eventKey)
        if (progress.phase === 'complete') {
          notification.success({
            message: 'Ghép audio hoàn tất',
            description: progress.message,
            duration: 6,
          })
        } else {
          notification.error({
            message: 'Ghép audio thất bại',
            description: progress.error || progress.message,
            duration: 8,
          })
        }
      }),
    [applyProgress, notification],
  )

  return null
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
  const [isPending, startTransition] = useTransition()

  useEffect(() => {
    void loadProjects().then((state) => {
      if (state.activeProject) navigate(projectMenuKey(state.activeProject.id, 'video-builder'))
    })
  }, [loadProjects])

  function navigate(key: AppMenuKey) {
    startTransition(() => {
      setActiveMenu(key)
      setVisitedMenus((current) => {
        if (current.has(key)) return current
        const next = new Set(current)
        next.add(key)
        return next
      })
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
          colorPrimary: '#eb4e43',
          colorLink: '#eb4e43',
          colorSuccess: '#10b981',
          colorWarning: '#f59e0b',
          colorError: '#ef4444',
          colorInfo: '#3b82f6',
          borderRadius: 6,
          fontFamily: 'Inter, ui-sans-serif, system-ui, -apple-system, sans-serif',
          colorBgContainer: '#ffffff',
          colorBgLayout: '#f8fafc',
        },
        components: {
          Button: {
            borderRadius: 6,
            controlHeight: 36,
            controlHeightLG: 42,
            fontWeight: 500,
          },
          Card: {
            borderRadiusLG: 8,
            boxShadowSecondary: '0 1px 3px 0 rgba(0, 0, 0, 0.05), 0 1px 2px -1px rgba(0, 0, 0, 0.05)',
          },
          Input: {
            borderRadius: 6,
            controlHeight: 36,
          },
          InputNumber: {
            borderRadius: 6,
            controlHeight: 36,
          },
          Select: {
            borderRadius: 6,
            controlHeight: 36,
          },
          Modal: {
            borderRadiusLG: 8,
          },
        },
      }}
    >
      <AntApp>
        <TopProgressBar active={isPending} />
        <AudioMergeRuntimeBridge />
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
          <Suspense
            fallback={
              <div className="flex h-full items-center justify-center">
                <Spin size="large" />
              </div>
            }
          >
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
            {activeProject && visitedMenus.has(activeMenu) && activeTool === 'video-shuffle' && (
              <div className="block">
                <VideoShufflePage key={activeProject.id} />
              </div>
            )}
          </Suspense>
          {loadingProjects && null}
        </AppShell>
      </AntApp>
    </ConfigProvider>
  )
}
