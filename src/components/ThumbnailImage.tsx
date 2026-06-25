import { useEffect, useState } from 'react'
import { Image, Skeleton, Typography } from 'antd'

const thumbnailCache = new Map<string, string>()

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
  const [thumbnail, setThumbnail] = useState(() => thumbnailCache.get(path) ?? '')
  const [loaded, setLoaded] = useState(() => thumbnailCache.has(path))

  useEffect(() => {
    const cached = thumbnailCache.get(path)
    if (cached !== undefined) {
      setThumbnail(cached)
      setLoaded(true)
      return
    }

    setThumbnail('')
    setLoaded(false)
    let active = true
    void window.videoBuilder.getThumbnail(path).then((dataUrl) => {
      thumbnailCache.set(path, dataUrl)
      if (active) {
        setThumbnail(dataUrl)
        setLoaded(true)
      }
    })
    return () => {
      active = false
    }
  }, [path])

  if (!loaded) return <Skeleton.Image active className={className} />
  if (!thumbnail) {
    return (
      <div className={`flex items-center justify-center bg-slate-100 ${className}`}>
        <Typography.Text type="secondary">Không đọc được ảnh</Typography.Text>
      </div>
    )
  }
  return (
    <Image
      src={thumbnail}
      alt={alt}
      className={className}
      preview={preview ? { src: thumbnail } : false}
    />
  )
}
