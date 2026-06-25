import { useState } from 'react'
import { App as AntApp, ConfigProvider } from 'antd'
import viVN from 'antd/locale/vi_VN'
import AppShell, { type AppMenuKey } from './layouts/AppShell'
import AudioMergePage from './pages/AudioMergePage'
import BuildPage from './pages/BuildPage'

export default function App() {
  const [activeMenu, setActiveMenu] = useState<AppMenuKey>('video-builder')
  const [visitedMenus, setVisitedMenus] = useState<Set<AppMenuKey>>(
    () => new Set<AppMenuKey>(['video-builder']),
  )

  function navigate(key: AppMenuKey) {
    setActiveMenu(key)
    setVisitedMenus((current) => {
      if (current.has(key)) return current
      const next = new Set(current)
      next.add(key)
      return next
    })
  }

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
        <AppShell activeKey={activeMenu} onNavigate={navigate}>
          <div className={activeMenu === 'video-builder' ? 'block' : 'hidden'}>
            <BuildPage />
          </div>
          {visitedMenus.has('audio-merge') && (
            <div className={activeMenu === 'audio-merge' ? 'block' : 'hidden'}>
              <AudioMergePage />
            </div>
          )}
        </AppShell>
      </AntApp>
    </ConfigProvider>
  )
}
