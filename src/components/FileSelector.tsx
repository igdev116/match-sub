import type { ReactNode } from 'react'
import { Button, Input, Tooltip, Typography } from 'antd'
import { CheckCircleFilled, ExclamationCircleFilled, EyeOutlined, FolderOpenOutlined, InfoCircleOutlined, QuestionCircleOutlined } from '@ant-design/icons'

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
  tooltipTitle?: string
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
  tooltipTitle,
}: FileSelectorProps) {
  const hasValue = Boolean(value)
  const isValid = hasValue && !error

  return (
    <div className="grid gap-3 md:grid-cols-[180px_1fr_auto] md:items-center py-1.5">
      <div className="flex items-center gap-1.5 whitespace-nowrap shrink-0">
        <span className="text-base flex items-center justify-center">{icon}</span>
        <Typography.Text strong className="text-slate-700 text-sm whitespace-nowrap">
          {label}
        </Typography.Text>
        {tooltipTitle && (
          <Tooltip title={tooltipTitle}>
            <QuestionCircleOutlined className="text-slate-400 cursor-help text-xs hover:text-brand-500" />
          </Tooltip>
        )}
        {isValid && (
          <CheckCircleFilled className="text-emerald-500 text-xs shrink-0" title="Đã kết nối" />
        )}
      </div>

      <div className="min-w-0">
        <Input
          className="path-field !bg-slate-50/70 hover:!bg-white focus:!bg-white font-mono text-xs text-slate-700 transition-colors"
          value={value}
          placeholder={placeholder}
          readOnly
          title={value}
          status={status}
          suffix={
            metaText && !error ? (
              <Tooltip title={metaText}>
                <InfoCircleOutlined className="text-slate-400 cursor-help" />
              </Tooltip>
            ) : null
          }
        />
        {error && (
          <div className="mt-1 flex items-center gap-1 text-xs text-red-500">
            <ExclamationCircleFilled className="text-[10px]" />
            <span>{error}</span>
          </div>
        )}
        {!error && helperText && (
          <Typography.Text className="mt-1 block text-xs" type="secondary">
            {helperText}
          </Typography.Text>
        )}
      </div>

      <div className="flex items-center gap-2 shrink-0">
        {onPreview && (
          <Button
            icon={<EyeOutlined />}
            onClick={onPreview}
            disabled={disabled || !value}
            title={`Preview ${label}`}
            className="!rounded-md"
          />
        )}
        <Button
          icon={<FolderOpenOutlined />}
          onClick={onSelect}
          disabled={disabled}
          className="!rounded-md !px-4 min-w-[136px] font-medium"
        >
          {buttonLabel}
        </Button>
      </div>
    </div>
  )
}

