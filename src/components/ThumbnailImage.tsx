import { useEffect, useRef, useState } from 'react'
import { Image, Skeleton, Typography } from 'antd'

const thumbnailCache = new Map<string, string>()
const pendingThumbnailRequests = new Map<string, Promise<string>>()
const thumbnailCacheLimit = 200

function cachedThumbnail(path: string): string | undefined {
  const cached = thumbnailCache.get(path)
  if (cached === undefined) return undefined
  thumbnailCache.delete(path)
  thumbnailCache.set(path, cached)
  return cached
}

function requestThumbnail(path: string): Promise<string> {
  const pending = pendingThumbnailRequests.get(path)
  if (pending) return pending

  const request = window.videoBuilder
    .getThumbnail(path)
    .catch(() => '')
    .then((thumbnail) => {
      if (thumbnailCache.size >= thumbnailCacheLimit) {
        const oldestKey = thumbnailCache.keys().next().value
        if (oldestKey) thumbnailCache.delete(oldestKey)
      }
      thumbnailCache.set(path, thumbnail)
      return thumbnail
    })
    .finally(() => pendingThumbnailRequests.delete(path))
  pendingThumbnailRequests.set(path, request)
  return request
}

interface ThumbnailImageProps {
  path: string
  alt: string
  className?: string
  preview?: boolean
}

export default function ThumbnailImage({
  path,
  alt,
  className = '!h-32 !w-full object-cover',
  preview = true,
}: ThumbnailImageProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [thumbnail, setThumbnail] = useState(() => cachedThumbnail(path) ?? '')
  const [loaded, setLoaded] = useState(() => thumbnailCache.has(path))
  const [shouldLoad, setShouldLoad] = useState(() => thumbnailCache.has(path))

  useEffect(() => {
    if (thumbnailCache.has(path)) {
      setShouldLoad(true)
      return
    }

    const element = containerRef.current
    if (!element || typeof IntersectionObserver === 'undefined') {
      setShouldLoad(true)
      return
    }

    setShouldLoad(false)
    const observer = new IntersectionObserver(
      (entries) => {
        if (!entries[0]?.isIntersecting) return
        setShouldLoad(true)
        observer.disconnect()
      },
      { rootMargin: '160px' },
    )
    observer.observe(element)
    return () => observer.disconnect()
  }, [path])

  useEffect(() => {
    if (!shouldLoad) return
    const cached = cachedThumbnail(path)
    if (cached !== undefined) {
      setThumbnail(cached)
      setLoaded(true)
      return
    }

    setThumbnail('')
    setLoaded(false)
    let active = true
    void requestThumbnail(path).then((dataUrl) => {
      if (active) {
        setThumbnail(dataUrl)
        setLoaded(true)
      }
    })
    return () => {
      active = false
    }
  }, [path, shouldLoad])

  if (!shouldLoad || !loaded) {
    return (
      <div ref={containerRef} className={className}>
        <Skeleton.Image active className="!w-full !h-full" />
      </div>
    )
  }
  if (!thumbnail) {
    return (
      <div ref={containerRef} className={`flex items-center justify-center bg-slate-100 ${className}`}>
        <Typography.Text type="secondary">Không đọc được ảnh</Typography.Text>
      </div>
    )
  }
  return (
    <div ref={containerRef} className={className}>
      <Image
        src={thumbnail}
        alt={alt}
        loading="lazy"
        className="w-full h-full object-cover rounded"
        preview={preview ? { src: thumbnail } : false}
      />
    </div>
  )
}
