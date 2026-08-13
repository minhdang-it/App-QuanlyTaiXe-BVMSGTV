import { useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react'
import type { PlanAttachment } from '../types/models'
import { Modal } from './Modal'

function fileSize(bytes?: number | null) {
  if (!bytes) return ''
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(bytes >= 10 * 1024 * 1024 ? 0 : 1)} MB`
}

function extensionOf(item: PlanAttachment) {
  const source = `${item.name || ''} ${item.path || ''}`.toLocaleLowerCase('vi-VN')
  const match = source.match(/\.([a-z0-9]+)(?:\?|\s|$)/)
  return match?.[1] ?? ''
}

function isImage(item: PlanAttachment) {
  return Boolean(item.mime_type?.startsWith('image/')) || ['jpg', 'jpeg', 'png', 'webp', 'heic', 'heif', 'gif', 'bmp', 'svg'].includes(extensionOf(item))
}

function fileIcon(item: PlanAttachment) {
  if (isImage(item)) return '🖼️'
  const ext = extensionOf(item)
  if (item.mime_type === 'application/pdf' || ext === 'pdf') return '📕'
  if (['doc', 'docx'].includes(ext)) return '📘'
  if (['xls', 'xlsx'].includes(ext)) return '📗'
  if (['ppt', 'pptx'].includes(ext)) return '📙'
  if (ext === 'txt') return '📄'
  return '📎'
}



type Point = { x: number; y: number }

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value))
}

function ZoomableAttachmentImage({ src, alt }: { src: string; alt: string }) {
  const [scale, setScale] = useState(1)
  const [offset, setOffset] = useState<Point>({ x: 0, y: 0 })
  const pointers = useRef(new Map<number, Point>())
  const dragStart = useRef<{ pointer: Point; offset: Point } | null>(null)
  const pinchStart = useRef<{ distance: number; scale: number; center: Point; offset: Point } | null>(null)

  function resetZoom() {
    setScale(1)
    setOffset({ x: 0, y: 0 })
    dragStart.current = null
    pinchStart.current = null
    pointers.current.clear()
  }

  function zoomTo(nextScale: number) {
    const bounded = clamp(nextScale, 1, 4)
    setScale(bounded)
    if (bounded === 1) setOffset({ x: 0, y: 0 })
  }

  function distance(a: Point, b: Point) {
    return Math.hypot(b.x - a.x, b.y - a.y)
  }

  function center(a: Point, b: Point): Point {
    return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }
  }

  function pointerPoint(event: ReactPointerEvent<HTMLDivElement>): Point {
    return { x: event.clientX, y: event.clientY }
  }

  function handlePointerDown(event: ReactPointerEvent<HTMLDivElement>) {
    if (event.pointerType === 'mouse' && event.button !== 0) return
    event.currentTarget.setPointerCapture?.(event.pointerId)
    pointers.current.set(event.pointerId, pointerPoint(event))

    const active = [...pointers.current.values()]
    if (active.length === 1 && scale > 1) {
      dragStart.current = { pointer: active[0], offset }
    } else if (active.length >= 2) {
      pinchStart.current = {
        distance: Math.max(1, distance(active[0], active[1])),
        scale,
        center: center(active[0], active[1]),
        offset,
      }
      dragStart.current = null
    }
  }

  function handlePointerMove(event: ReactPointerEvent<HTMLDivElement>) {
    if (!pointers.current.has(event.pointerId)) return
    const nextPoint = pointerPoint(event)
    pointers.current.set(event.pointerId, nextPoint)
    const active = [...pointers.current.values()]

    if (active.length >= 2 && pinchStart.current) {
      const start = pinchStart.current
      const currentDistance = Math.max(1, distance(active[0], active[1]))
      const nextScale = clamp(start.scale * (currentDistance / start.distance), 1, 4)
      const currentCenter = center(active[0], active[1])
      setScale(nextScale)
      setOffset({
        x: start.offset.x + (currentCenter.x - start.center.x),
        y: start.offset.y + (currentCenter.y - start.center.y),
      })
      return
    }

    if (active.length === 1 && scale > 1 && dragStart.current) {
      const start = dragStart.current
      setOffset({
        x: start.offset.x + (nextPoint.x - start.pointer.x),
        y: start.offset.y + (nextPoint.y - start.pointer.y),
      })
    }
  }

  function handlePointerEnd(event: ReactPointerEvent<HTMLDivElement>) {
    pointers.current.delete(event.pointerId)
    const active = [...pointers.current.values()]
    if (scale <= 1.02) {
      setScale(1)
      setOffset({ x: 0, y: 0 })
    }
    if (active.length === 1 && scale > 1) {
      dragStart.current = { pointer: active[0], offset }
    } else {
      dragStart.current = null
    }
    pinchStart.current = null
  }

  return <div
    className={`attachment-zoom-stage ${scale > 1 ? 'is-zoomed' : ''}`}
    onPointerDown={handlePointerDown}
    onPointerMove={handlePointerMove}
    onPointerUp={handlePointerEnd}
    onPointerCancel={handlePointerEnd}
    onDoubleClick={() => scale > 1 ? resetZoom() : zoomTo(2)}
  >
    <img
      src={src}
      alt={alt}
      draggable={false}
      style={{ transform: `translate3d(${offset.x}px, ${offset.y}px, 0) scale(${scale})` }}
    />
    <div className="attachment-zoom-controls" aria-label="Điều khiển phóng to ảnh">
      <button type="button" onClick={(event) => { event.stopPropagation(); zoomTo(scale - .5) }} disabled={scale <= 1} aria-label="Thu nhỏ ảnh">−</button>
      <button type="button" className="zoom-value" onClick={(event) => { event.stopPropagation(); resetZoom() }} aria-label="Khôi phục kích thước ảnh">{Math.round(scale * 100)}%</button>
      <button type="button" onClick={(event) => { event.stopPropagation(); zoomTo(scale + .5) }} disabled={scale >= 4} aria-label="Phóng to ảnh">＋</button>
    </div>
    <small className="attachment-zoom-hint">Chụm 2 ngón để phóng to · kéo ảnh khi đã phóng · bấm 100% để đặt lại</small>
  </div>
}

function attachmentUrl(item: PlanAttachment) {
  return item.url ?? (item.path.startsWith('http') ? item.path : null)
}

function openInNewTab(item: PlanAttachment) {
  const url = attachmentUrl(item)
  if (!url) return
  const opened = window.open(url, '_blank', 'noopener,noreferrer')
  if (opened) opened.opener = null
}

export function PlanAttachmentsViewer({
  attachments,
  legacyUrl,
  legacyPath,
  compact = false,
}: {
  attachments?: PlanAttachment[] | null
  legacyUrl?: string | null
  legacyPath?: string | null
  compact?: boolean
}) {
  const files = useMemo<PlanAttachment[]>(() => {
    if (attachments?.length) return attachments
    if (legacyUrl || legacyPath) return [{ path: legacyPath ?? legacyUrl ?? '', url: legacyUrl, name: 'Văn bản kế hoạch' }]
    return []
  }, [attachments, legacyPath, legacyUrl])

  const imageItems = useMemo(() => files.map((item, index) => ({ item, index })).filter(({ item }) => isImage(item)), [files])
  const documentItems = useMemo(() => files.map((item, index) => ({ item, index })).filter(({ item }) => !isImage(item)), [files])
  const [open, setOpen] = useState(false)
  const [activeImagePosition, setActiveImagePosition] = useState(0)

  if (!files.length) return null

  const single = files[0]
  const singleUrl = attachmentUrl(single)

  if (files.length === 1 && !isImage(single) && singleUrl) {
    return <a
      className={`secondary-button ${compact ? 'compact' : ''} attachment-open-button attachment-document-link`}
      href={singleUrl}
      target="_blank"
      rel="noreferrer"
      title="Mở văn bản ở tab mới"
    >
      📎 Mở văn bản kế hoạch <span aria-hidden="true">↗</span>
    </a>
  }

  function showViewer() {
    setActiveImagePosition(0)
    setOpen(true)
  }

  const activeImageEntry = imageItems[Math.min(activeImagePosition, Math.max(0, imageItems.length - 1))]
  const activeImage = activeImageEntry?.item
  const activeImageUrl = activeImage ? attachmentUrl(activeImage) : null

  return <>
    <button type="button" className={`secondary-button ${compact ? 'compact' : ''} attachment-open-button`} onClick={showViewer}>
      {files.length === 1 && imageItems.length === 1 ? '🖼️ Xem ảnh đính kèm' : `📎 Xem ${files.length} tệp đính kèm`}
    </button>

    {open && <Modal
      title={files.length === 1 && imageItems.length === 1 ? 'Ảnh đính kèm' : `Ảnh / tệp đính kèm (${files.length})`}
      onClose={() => setOpen(false)}
      wide={files.length > 1 || imageItems.length > 1}
    >
      <div className={`attachment-simple-viewer ${files.length === 1 && imageItems.length === 1 ? 'single-image' : ''}`}>
        {activeImage && activeImageUrl && <div className="attachment-simple-image-stage">
          <ZoomableAttachmentImage key={`${activeImage.path}-${activeImagePosition}`} src={activeImageUrl} alt={activeImage.name || 'Ảnh đính kèm'} />
        </div>}

        {activeImage && !activeImageUrl && <div className="attachment-simple-empty">
          <span aria-hidden="true">🖼️</span>
          <strong>Không tải được ảnh</strong>
          <small>Hãy làm mới dữ liệu và thử lại.</small>
        </div>}

        {imageItems.length > 1 && <div className="attachment-thumbnail-strip" aria-label="Danh sách ảnh đính kèm">
          {imageItems.map(({ item }, imagePosition) => {
            const url = attachmentUrl(item)
            return <button
              type="button"
              key={`${item.path}-${imagePosition}`}
              className={imagePosition === activeImagePosition ? 'active' : ''}
              onClick={() => setActiveImagePosition(imagePosition)}
              title={item.name || `Ảnh ${imagePosition + 1}`}
            >
              {url ? <img src={url} alt={item.name || `Ảnh ${imagePosition + 1}`} /> : <span>🖼️</span>}
            </button>
          })}
        </div>}

        {documentItems.length > 0 && <div className="attachment-document-links">
          <strong>{imageItems.length ? 'Tệp / văn bản khác' : 'Tệp đính kèm'}</strong>
          <div>
            {documentItems.map(({ item }, index) => {
              const url = attachmentUrl(item)
              const label = item.name || `Tệp ${index + 1}`
              return url ? <a
                key={`${item.path}-${index}`}
                href={url}
                target="_blank"
                rel="noreferrer"
                title="Mở tệp ở tab mới"
              >
                <span aria-hidden="true">{fileIcon(item)}</span>
                <span><b>{label}</b><small>{item.size_bytes ? fileSize(item.size_bytes) : 'Mở tab mới'}</small></span>
                <em aria-hidden="true">↗</em>
              </a> : <div key={`${item.path}-${index}`} className="unavailable">
                <span aria-hidden="true">{fileIcon(item)}</span>
                <span><b>{label}</b><small>Không lấy được đường dẫn tệp</small></span>
              </div>
            })}
          </div>
        </div>}
      </div>
    </Modal>}
  </>
}

export function mergeSelectedPlanFiles(current: File[], incoming: File[]) {
  const merged: File[] = []
  const seen = new Set<string>()
  for (const file of [...current, ...incoming]) {
    const key = `${file.name}|${file.size}|${file.lastModified}`
    if (seen.has(key)) continue
    seen.add(key)
    merged.push(file)
  }
  return merged
}

export function SelectedPlanFiles({ files, onRemove }: { files: File[]; onRemove: (index: number) => void }) {
  if (!files.length) return null
  return <div className="selected-plan-files">
    <div className="selected-plan-files-head">
      <strong>{files.length} tệp đã chọn</strong>
      <small>Có thể bấm “Thêm tệp / hình ảnh” nhiều lần · tối đa 10 tệp · 10 MB/tệp · tổng 50 MB</small>
    </div>
    <div className="selected-plan-file-list">{files.map((file, index) => <div key={`${file.name}-${file.lastModified}-${index}`}>
      <span>{fileIcon({ path: file.name, name: file.name, mime_type: file.type })}</span>
      <div><strong>{file.name}</strong><small>{fileSize(file.size)}{file.type.startsWith('image/') ? ' · Ảnh' : ' · Tệp'}</small></div>
      <button type="button" onClick={() => onRemove(index)} aria-label={`Bỏ tệp ${file.name}`}>✕</button>
    </div>)}</div>
  </div>
}
