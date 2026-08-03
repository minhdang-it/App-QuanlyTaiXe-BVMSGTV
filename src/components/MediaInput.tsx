import { useEffect, useRef, useState } from 'react'
import { optimizeCapturedImage } from '../lib/image'

export function MediaInput({
  label,
  accept = 'image/*',
  capture = 'environment',
  onChange,
  optimizeImage = true,
}: {
  label: string
  accept?: string
  capture?: 'environment' | 'user' | undefined
  onChange: (file: File | null) => void | Promise<void>
  optimizeImage?: boolean
}) {
  const [preview, setPreview] = useState<string | null>(null)
  const [processing, setProcessing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [sizeText, setSizeText] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => () => { if (preview?.startsWith('blob:')) URL.revokeObjectURL(preview) }, [preview])

  async function handleFile(selected: File | null) {
    setError(null)
    if (!selected) {
      if (preview?.startsWith('blob:')) URL.revokeObjectURL(preview)
      setPreview(null)
      setSizeText(null)
      await onChange(null)
      return
    }

    setProcessing(true)
    try {
      const file = selected.type.startsWith('image/') && optimizeImage
        ? await optimizeCapturedImage(selected)
        : selected
      if (preview?.startsWith('blob:')) URL.revokeObjectURL(preview)
      setPreview(URL.createObjectURL(file))
      setSizeText(`${Math.max(1, Math.round(file.size / 1024))} KB`)
      await onChange(file)
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Không xử lý được ảnh. Vui lòng chụp lại.')
      await onChange(null)
    } finally {
      setProcessing(false)
      // Cho phép chọn lại đúng tệp vừa chọn nếu cần chụp/đọc lại.
      if (inputRef.current) inputRef.current.value = ''
    }
  }

  return (
    <label className={`media-input ${processing ? 'processing' : ''}`}>
      <span className="media-title">📷 {processing ? 'Đang xử lý ảnh...' : label}</span>
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        capture={accept.startsWith('image/') ? capture : undefined}
        disabled={processing}
        onChange={(event) => { void handleFile(event.target.files?.[0] ?? null) }}
      />
      {processing && <span className="media-processing"><span className="spinner-small" /> Vui lòng chờ</span>}
      {preview && accept.startsWith('image/') && <img src={preview} alt="Xem trước" className="media-preview" />}
      {preview && !accept.startsWith('image/') && <span className="file-selected">Đã chọn tệp</span>}
      {preview && sizeText && <span className="file-selected">Ảnh đã tối ưu · {sizeText} · Nhấn để chụp lại</span>}
      {error && <span className="media-error">{error}</span>}
    </label>
  )
}
