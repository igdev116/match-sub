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
      <Card
        title={`Danh sách dự án (${projects.length})`}
        className="!rounded-lg border border-slate-200/80 shadow-sm"
        extra={
          <Button
            type="primary"
            icon={<PlusOutlined />}
            loading={busy}
            onClick={() => setCreateOpen(true)}
            className="!rounded-md shadow-sm"
          >
            Tạo dự án mới
          </Button>
        }
      >
        {projects.length === 0 ? (
          <Empty description="Chưa có dự án nào được khởi tạo">
            <Button
              type="primary"
              icon={<PlusOutlined />}
              loading={busy}
              onClick={() => setCreateOpen(true)}
              className="!rounded-md"
            >
              Tạo dự án đầu tiên
            </Button>
          </Empty>
        ) : (
          <List
            grid={{ gutter: 16, xs: 1, sm: 1, md: 2, lg: 2, xl: 2, xxl: 2 }}
            dataSource={projects}
            renderItem={(project) => {
              const isActive = project.id === activeProjectId
              return (
                <List.Item>
                  <div
                    className={`group relative rounded-lg border p-4 transition-all ${
                      isActive
                        ? 'border-brand-500 bg-brand-50/20 shadow-sm'
                        : 'border-slate-200 bg-white hover:border-slate-300 hover:shadow-sm'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3 mb-2">
                      <div className="min-w-0 flex-1">
                        {editingId === project.id ? (
                          <Input
                            className="w-full !rounded-md"
                            value={editingName}
                            onChange={(event) => setEditingName(event.target.value)}
                            onPressEnter={() => void saveName(project.id)}
                            autoFocus
                          />
                        ) : (
                          <div className="flex items-center gap-2">
                            <Typography.Text strong className="text-base text-slate-800 truncate">
                              {project.name}
                            </Typography.Text>
                            {isActive && (
                              <Tag color="error" className="!rounded !mr-0 font-medium">
                                Đang mở
                              </Tag>
                            )}
                          </div>
                        )}
                      </div>

                      <div className="flex items-center gap-1.5 shrink-0">
                        {editingId === project.id ? (
                          <Button
                            size="small"
                            type="primary"
                            disabled={busy}
                            onClick={() => void saveName(project.id)}
                            className="!rounded-md"
                          >
                            Lưu
                          </Button>
                        ) : (
                          <Button
                            size="small"
                            type="text"
                            icon={<EditOutlined />}
                            disabled={busy}
                            onClick={() => {
                              setEditingId(project.id)
                              setEditingName(project.name)
                            }}
                            className="!rounded-md text-slate-400 hover:text-slate-600"
                          />
                        )}
                        <Popconfirm
                          title="Xóa khỏi danh sách app?"
                          description="Folder thật sẽ không bị xóa."
                          okText="Xóa"
                          cancelText="Hủy"
                          onConfirm={() => void removeProject(project.id)}
                        >
                          <Button
                            size="small"
                            type="text"
                            danger
                            icon={<DeleteOutlined />}
                            disabled={busy}
                            className="!rounded-md"
                          />
                        </Popconfirm>
                      </div>
                    </div>

                    <div className="mb-3 font-mono text-xs text-slate-500 bg-slate-50 rounded px-2.5 py-1.5 border border-slate-100 flex items-center justify-between gap-2 overflow-hidden">
                      <span className="truncate">{project.rootPath}</span>
                      <Typography.Text copyable={{ text: project.rootPath }} className="shrink-0" />
                    </div>

                    <div className="flex items-center justify-between pt-2 border-t border-slate-100 text-xs text-slate-400">
                      <span>Cập nhật: {dayjs(project.updatedAt).format('DD/MM/YYYY HH:mm')}</span>
                      <Button
                        type={isActive ? 'primary' : 'default'}
                        size="small"
                        icon={<FolderOpenOutlined />}
                        disabled={busy}
                        onClick={() => void openProject(project.id)}
                        className="!rounded-md font-medium"
                      >
                        {isActive ? 'Đang mở' : 'Mở dự án'}
                      </Button>
                    </div>
                  </div>
                </List.Item>
              )
            }}
          />
        )}
      </Card>

      <Modal
        title="Tạo dự án mới"
        open={createOpen}
        okText="Tạo dự án"
        cancelText="Hủy"
        confirmLoading={busy}
        onOk={() => void submitCreateProject()}
        onCancel={() => {
          if (busy) return
          setCreateOpen(false)
          setNewProjectName('')
        }}
        className="!rounded-lg"
      >
        <Typography.Text strong className="text-slate-700">Tên dự án</Typography.Text>
        <Input
          className="mt-2 !rounded-md"
          autoFocus
          placeholder="Ví dụ: Review sản phẩm 01"
          value={newProjectName}
          onChange={(event) => setNewProjectName(event.target.value)}
          onPressEnter={() => void submitCreateProject()}
        />
        <Typography.Text className="mt-2 block text-xs" type="secondary">
          Sau khi tạo, hệ thống sẽ tự động chuyển sang trang Video Builder để cấu hình nguồn dữ liệu.
        </Typography.Text>
      </Modal>
    </main>
  )
}
