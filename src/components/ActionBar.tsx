import type { ReactNode } from 'react'
import { useSettingsStore } from '../stores/useSettingsStore'

interface ActionBarProps {
  children?: ReactNode
  leftContent?: ReactNode
  rightContent?: ReactNode
  className?: string
}

export default function ActionBar({
  children,
  leftContent,
  rightContent,
  className = '',
}: ActionBarProps) {
  const sidebarCollapsed = useSettingsStore((state) => state.sidebarCollapsed)

  return (
    <div
      className={`fixed bottom-0 right-0 z-40 bg-white/95 backdrop-blur border-t border-slate-200/80 px-6 py-2.5 shadow-lg transition-[left] duration-200 ease-in-out ${
        sidebarCollapsed ? 'left-[76px]' : 'left-[248px]'
      } ${className}`}
    >
      <div className="mx-auto flex max-w-5xl items-center justify-between gap-4">
        {children || (
          <>
            <div className="flex items-center gap-3 min-w-0">{leftContent}</div>
            <div className="flex items-center gap-2.5 shrink-0">{rightContent}</div>
          </>
        )}
      </div>
    </div>
  )
}
