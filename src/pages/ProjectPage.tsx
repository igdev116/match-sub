import { useState } from 'react'
import { App, Button, Card, Empty, Input, List, Modal, Popconfirm, Space, Tag, Typography } from 'antd'
import {
  DeleteOutlined,
  EditOutlined,
  FolderOpenOutlined,
  ProjectOutlined,
  PlusOutlined,
} from '@ant-design/icons'
import dayjs from 'dayjs'
import { useProjectStore } from '../stores/useProjectStore'

interface ProjectPageProps {
  onOpenProject: (projectId: string) => void
}

function cleanError(error: unknown): string {
  const text = error instanceof Error ? error.message : String(error)
  return text.replace(/^Error invoking remote method '[^']+': Error: /, '')
}

export default function ProjectPage({ onOpenProject }: ProjectPageProps) {
  const { message } = App.useApp()
  const projects = useProjectStore((state) => state.projects)
  const activeProjectId = useProjectStore((state) => state.activeProjectId)
  const createProject = useProjectStore((state) => state.createProject)
  const selectProject = useProjectStore((state) => state.selectProject)
  const renameProject = useProjectStore((state) => state.renameProject)
  const deleteProject = useProjectStore((state) => state.deleteProject)
  const [busy, setBusy] = useState(false)
  const [createOpen, setCreateOpen] = useState(false)
  const [newProjectName, setNewProjectName] = useState('')
  const [editingId, setEditingId] = useState('')
  const [editingName, setEditingName] = useState('')

  async function submitCreateProject() {
    if (!newProjectName.trim()) {
      message.warning('Vui lòng nhập tên dự án.')
      return
    }
    setBusy(true)
    try {
      const state = await createProject(newProjectName)
      if (state.activeProject) {
        message.success('Đã tạo dự án.')
        setCreateOpen(false)
        setNewProjectName('')
        onOpenProject(state.activeProject.id)
      }
    } catch (error) {
      message.error(cleanError(error), 8)
    } finally {
      setBusy(false)
    }
  }

  async function openProject(projectId: string) {
    setBusy(true)
    try {
      await selectProject(projectId)
      onOpenProject(projectId)
    } catch (error) {
      message.error(cleanError(error), 8)
    } finally {
      setBusy(false)
    }
  }

  async function saveName(projectId: string) {
    setBusy(true)
    try {
      await renameProject(projectId, editingName)
      setEditingId('')
      setEditingName('')
    } catch (error) {
      message.error(cleanError(error), 8)
    } finally {
      setBusy(false)
    }
  }

  async function removeProject(projectId: string) {
    setBusy(true)
    try {
      await deleteProject(projectId)
      message.success('Đã xóa dự án khỏi danh sách app. Folder thật không bị xóa.')
    } catch (error) {
      message.error(cleanError(error), 8)
    } finally {
      setBusy(false)
    }
  }

  return (
    <main className="mx-auto max-w-5xl space-y-5 pb-10">
      <header className="page-hero">
        <Typography.Title className="!mb-1 !text-white" level={2}>
          <ProjectOutlined /> Quản lý dự án
        </Typography.Title>
        <Typography.Text className="!text-white/70">
          Tạo và quản lý các dự án riêng biệt cho Video Builder / Ghép audio
        </Typography.Text>
      </header>

      <Card
        title="Dự án"
        extra={
          <Button
            type="primary"
            icon={<PlusOutlined />}
            loading={busy}
            onClick={() => setCreateOpen(true)}
          >
            Tạo dự án mới
          </Button>
        }
      >
        {projects.length === 0 ? (
          <Empty description="Chưa có dự án">
            <Button
              type="primary"
              icon={<PlusOutlined />}
              loading={busy}
              onClick={() => setCreateOpen(true)}
            >
              Tạo dự án mới
            </Button>
          </Empty>
        ) : (
          <List
            bordered
            dataSource={projects}
            renderItem={(project) => (
              <List.Item
                actions={[
                  editingId === project.id ? (
                    <Button
                      key="save"
                      type="primary"
                      disabled={busy}
                      onClick={() => void saveName(project.id)}
                    >
                      Lưu
                    </Button>
                  ) : (
                    <Button
                      key="edit"
                      icon={<EditOutlined />}
                      disabled={busy}
                      onClick={() => {
                        setEditingId(project.id)
                        setEditingName(project.name)
                      }}
                    />
                  ),
                  <Button
                    key="open"
                    type="primary"
                    icon={<FolderOpenOutlined />}
                    disabled={busy}
                    onClick={() => void openProject(project.id)}
                  >
                    Mở
                  </Button>,
                  <Popconfirm
                    key="delete"
                    title="Xóa khỏi danh sách app?"
                    description="Folder thật sẽ không bị xóa."
                    okText="Xóa"
                    cancelText="Hủy"
                    onConfirm={() => void removeProject(project.id)}
                  >
                    <Button danger icon={<DeleteOutlined />} disabled={busy} />
                  </Popconfirm>,
                ]}
              >
                <div className="min-w-0 flex-1">
                  <Space className="mb-1" wrap>
                    {editingId === project.id ? (
                      <Input
                        className="w-72"
                        value={editingName}
                        onChange={(event) => setEditingName(event.target.value)}
                        onPressEnter={() => void saveName(project.id)}
                      />
                    ) : (
                      <Typography.Text strong>{project.name}</Typography.Text>
                    )}
                    {project.id === activeProjectId && <Tag color="success">Đang mở</Tag>}
                  </Space>
                  <Typography.Text className="block" type="secondary" copyable>
                    {project.rootPath}
                  </Typography.Text>
                  <Typography.Text className="block text-xs" type="secondary">
                    Cập nhật {dayjs(project.updatedAt).format('DD/MM/YYYY HH:mm')}
                  </Typography.Text>
                </div>
              </List.Item>
            )}
          />
        )}
      </Card>
      <Modal
        title="Tạo dự án mới"
        open={createOpen}
        okText="Tạo"
        cancelText="Hủy"
        confirmLoading={busy}
        onOk={() => void submitCreateProject()}
        onCancel={() => {
          if (busy) return
          setCreateOpen(false)
          setNewProjectName('')
        }}
      >
        <Typography.Text strong>Tên dự án</Typography.Text>
        <Input
          className="mt-2"
          autoFocus
          placeholder="Ví dụ: Dự án review sản phẩm 01"
          value={newProjectName}
          onChange={(event) => setNewProjectName(event.target.value)}
          onPressEnter={() => void submitCreateProject()}
        />
        <Typography.Text className="mt-2 block text-xs" type="secondary">
          Sau khi tạo, vào Video Builder của dự án để chọn folder nguồn.
        </Typography.Text>
      </Modal>
    </main>
  )
}
