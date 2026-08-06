import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'

interface ImagePreviewProps {
  src: string
  alt: string
  compact?: boolean
  label?: string
}

export function ImagePreview({ src, alt, compact = false, label = 'Bấm vào ảnh để phóng to' }: ImagePreviewProps) {
  const [open, setOpen] = useState(false)

  useEffect(() => {
    if (!open) return
    const previousOverflow = document.body.style.overflow
    const closeByKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false)
    }
    document.body.style.overflow = 'hidden'
    window.addEventListener('keydown', closeByKey)
    return () => {
      document.body.style.overflow = previousOverflow
      window.removeEventListener('keydown', closeByKey)
    }
  }, [open])

  return <>
    <button
      type="button"
      className={`inline-image-preview ${compact ? 'compact' : ''}`}
      onClick={() => setOpen(true)}
      aria-label={`Phóng to ${alt}`}
    >
      <img src={src} alt={alt} loading="lazy" />
      <span>{compact ? 'Phóng to' : label}</span>
    </button>

    {open && createPortal(
      <div className="image-lightbox" role="dialog" aria-modal="true" aria-label={alt} onMouseDown={(event) => event.target === event.currentTarget && setOpen(false)}>
        <button type="button" className="image-lightbox-close" onClick={() => setOpen(false)} aria-label="Đóng ảnh">✕</button>
        <div className="image-lightbox-content">
          <img src={src} alt={alt} />
          <p>{alt}</p>
        </div>
      </div>,
      document.body,
    )}
  </>
}
