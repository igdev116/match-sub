import type { ReactNode } from 'react'
import {
  AudioOutlined,
  MenuFoldOutlined,
  MenuUnfoldOutlined,
  ProjectOutlined,
  VideoCameraOutlined,
} from '@ant-design/icons'
import { Button, Layout, Menu, Typography } from 'antd'
import type { MenuProps } from 'antd'
import type { AppProject } from '../../electron/types'
import { useSettingsStore } from '../stores/useSettingsStore'

const { Header, Content, Sider } = Layout

export type AppToolKey = 'video-builder' | 'audio-merge'
export type AppMenuKey = 'project-manager' | `project:${string}:${AppToolKey}`

interface AppShellProps {
  activeKey: AppMenuKey
  onNavigate: (key: AppMenuKey) => void | Promise<void>
  projects: AppProject[]
  activeProjectId: string
  children: ReactNode
}

export default function AppShell({
  activeKey,
  onNavigate,
  projects,
  activeProjectId,
  children,
}: AppShellProps) {
  const collapsed = useSettingsStore((state) => state.sidebarCollapsed)
  const setCollapsed = useSettingsStore((state) => state.setSidebarCollapsed)
  const menuItems: MenuProps['items'] = [
    {
      key: 'workspace',
      type: 'group',
      label: 'WORKSPACE',
      children: [
        {
          key: 'project-manager',
          icon: <ProjectOutlined />,
          label: 'Quản lý dự án',
        },
      ],
    },
    {
      key: 'projects',
      type: 'group',
      label: 'DỰ ÁN',
      children: projects.map((project) => ({
        key: `project:${project.id}`,
        icon: <ProjectOutlined />,
        label: project.name,
        children: [
          {
            key: `project:${project.id}:video-builder`,
            icon: <VideoCameraOutlined />,
            label: 'Video Builder',
          },
          {
            key: `project:${project.id}:audio-merge`,
            icon: <AudioOutlined />,
            label: 'Ghép audio',
          },
        ],
      })),
    },
  ]

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
          key={`${projects.length}-${activeProjectId}-${collapsed ? 'collapsed' : 'open'}`}
          className="app-menu"
          theme="dark"
          mode="inline"
          selectedKeys={[activeKey]}
          defaultOpenKeys={projects.map((project) => `project:${project.id}`)}
          items={menuItems}
          inlineCollapsed={collapsed}
          onClick={({ key }) => {
            void onNavigate(key as AppMenuKey)
          }}
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
          <Typography.Text type="secondary">
            {activeProjectId ? 'Project workspace' : 'Chọn hoặc tạo dự án để bắt đầu'}
          </Typography.Text>
        </Header>
        <Content className="app-content">{children}</Content>
      </Layout>
    </Layout>
  )
}
