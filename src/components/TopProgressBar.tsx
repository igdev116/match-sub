import { useEffect, useRef, useState } from 'react'

interface TopProgressBarProps {
  active: boolean
}

export default function TopProgressBar({ active }: TopProgressBarProps) {
  const [visible, setVisible] = useState(false)
  const [progress, setProgress] = useState(0)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (active) {
      setVisible(true)
      setProgress(0)

      let current = 0
      intervalRef.current = setInterval(() => {
        current += (90 - current) * 0.08
        setProgress(Math.min(current, 90))
      }, 50)
    } else if (visible) {
      if (intervalRef.current) clearInterval(intervalRef.current)
      setProgress(100)

      timeoutRef.current = setTimeout(() => {
        setVisible(false)
        setProgress(0)
      }, 300)
    }

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current)
      if (timeoutRef.current) clearTimeout(timeoutRef.current)
    }
  }, [active])

  if (!visible) return null

  return (
    <div className="top-progress-bar" style={{ transform: `scaleX(${progress / 100})` }} />
  )
}
