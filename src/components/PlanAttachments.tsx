import { useMemo, useState } from 'react'
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
          <img src={activeImageUrl} alt={activeImage.name || 'Ảnh đính kèm'} />
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
