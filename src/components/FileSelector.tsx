import type { ReactNode } from 'react'
import { Button, Input, Typography } from 'antd'
import { EyeOutlined, FolderOpenOutlined } from '@ant-design/icons'

interface FileSelectorProps {
  label: string
  value: string
  placeholder: string
  icon: ReactNode
  buttonLabel: string
  onSelect: () => void
  onPreview?: () => void
  disabled?: boolean
  status?: 'error' | 'warning'
  error?: string
  helperText?: string
  metaText?: string
}

export default function FileSelector({
  label,
  value,
  placeholder,
  icon,
  buttonLabel,
  onSelect,
  onPreview,
  disabled,
  status,
  error,
  helperText,
  metaText,
}: FileSelectorProps) {
  const detailText = error || metaText || helperText
  return (
    <div className="grid gap-2 md:grid-cols-[170px_1fr_auto] md:items-start">
      <Typography.Text strong className="flex items-center gap-2">
        {icon}
        {label}
      </Typography.Text>
      <div>
        <Input
          className="path-field"
          value={value}
          placeholder={placeholder}
          readOnly
          title={value}
          status={status}
        />
        {detailText && (
          <Typography.Text
            className="mt-1 block text-xs"
            type={error ? 'danger' : 'secondary'}
          >
            {detailText}
          </Typography.Text>
        )}
      </div>
      <div className="flex gap-2">
        {onPreview && (
          <Button
            icon={<EyeOutlined />}
            onClick={onPreview}
            disabled={disabled || !value}
            title={`Preview ${label}`}
          />
        )}
        <Button
          icon={<FolderOpenOutlined />}
          onClick={onSelect}
          disabled={disabled}
          className="flex-1 md:w-32"
        >
          {buttonLabel}
        </Button>
      </div>
    </div>
  )
}
