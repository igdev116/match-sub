import type { ReactNode } from 'react'
import {
  AudioOutlined,
  MenuFoldOutlined,
  MenuUnfoldOutlined,
  VideoCameraOutlined,
} from '@ant-design/icons'
import { Button, Layout, Menu, Typography } from 'antd'
import type { MenuProps } from 'antd'
import { useSettingsStore } from '../stores/useSettingsStore'

const { Header, Content, Sider } = Layout

export type AppMenuKey = 'video-builder' | 'audio-merge'

interface AppShellProps {
  activeKey: AppMenuKey
  onNavigate: (key: AppMenuKey) => void
  children: ReactNode
}

const menuItems: MenuProps['items'] = [
  {
    key: 'tools',
    type: 'group',
    label: 'CÔNG CỤ',
    children: [
      {
        key: 'video-builder',
        icon: <VideoCameraOutlined />,
        label: 'Video Builder',
      },
      {
        key: 'audio-merge',
        icon: <AudioOutlined />,
        label: 'Ghép audio',
      },
    ],
  },
]

export default function AppShell({ activeKey, onNavigate, children }: AppShellProps) {
  const collapsed = useSettingsStore((state) => state.sidebarCollapsed)
  const setCollapsed = useSettingsStore((state) => state.setSidebarCollapsed)

  return (
    <Layout className="h-screen overflow-hidden">
      <Sider
        className="app-sidebar"
        width={248}
        collapsedWidth={76}
        collapsed={collapsed}
        trigger={null}
        theme="dark"
      >
        <div className={`app-brand ${collapsed ? 'justify-center px-0' : ''}`}>
          <div className="app-brand-icon">
            <VideoCameraOutlined />
          </div>
          {!collapsed && (
            <div className="min-w-0">
              <Typography.Text className="block !text-base !font-semibold !text-white">
                Tạo Sub
              </Typography.Text>
              <Typography.Text className="block !text-xs !text-white/50">
                Media Toolkit
              </Typography.Text>
            </div>
          )}
        </div>

        <Menu
          className="app-menu"
          theme="dark"
          mode="inline"
          selectedKeys={[activeKey]}
          items={menuItems}
          inlineCollapsed={collapsed}
          onClick={({ key }) => onNavigate(key as AppMenuKey)}
        />

        {!collapsed && (
          <Typography.Text className="app-sidebar-version">Version 1.0.0</Typography.Text>
        )}
      </Sider>

      <Layout className="min-w-0">
        <Header className="app-header">
          <Button
            type="text"
            icon={collapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />}
            onClick={() => setCollapsed(!collapsed)}
            aria-label={collapsed ? 'Mở sidebar' : 'Thu gọn sidebar'}
          />
          <Typography.Text type="secondary">Video production workspace</Typography.Text>
        </Header>
        <Content className="app-content">{children}</Content>
      </Layout>
    </Layout>
  )
}
