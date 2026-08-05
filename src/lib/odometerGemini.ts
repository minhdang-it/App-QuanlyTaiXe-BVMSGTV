import { isSupabaseConfigured, supabase } from './supabase'

export interface GeminiOdometerResult {
  detected: boolean
  value: number | null
  visibleDigits: string
  confidence: number
  needsReview: boolean
  reason: string
  displayType: 'odometer' | 'trip' | 'unknown'
  quality: 'clear' | 'glare' | 'blur' | 'cropped' | 'dark' | 'unknown'
  model: string
}

export interface GeminiOdometerContext {
  baseline: number
  phase: 'start' | 'end'
  localValue: number | null
  localConfidence: number
  localCandidates: number[]
}

function fileToBase64(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onerror = () => reject(new Error('Không đọc được ảnh để gửi AI Gemini.'))
    reader.onload = () => {
      const result = String(reader.result ?? '')
      const base64 = result.includes(',') ? result.slice(result.indexOf(',') + 1) : result
      if (!base64) reject(new Error('Ảnh chụp không có dữ liệu.'))
      else resolve(base64)
    }
    reader.readAsDataURL(file)
  })
}

export function isGeminiOdometerAvailable() {
  return isSupabaseConfigured && Boolean(supabase)
}

export async function readOdometerWithGemini(file: File, context: GeminiOdometerContext): Promise<GeminiOdometerResult> {
  if (!supabase || !isSupabaseConfigured) throw new Error('Ứng dụng chưa kết nối Supabase nên chưa thể gọi Gemini an toàn.')
  if (!navigator.onLine) throw new Error('Thiết bị đang ngoại tuyến. OCR cục bộ vẫn có thể sử dụng.')
  if (file.size > 1_800_000) throw new Error('Ảnh còn quá lớn để gửi AI. Hãy chụp lại gần dãy số ODO.')

  const imageBase64 = await fileToBase64(file)
  const { data, error } = await supabase.functions.invoke('analyze-odometer', {
    body: {
      image_base64: imageBase64,
      mime_type: file.type || 'image/jpeg',
      baseline: context.baseline,
      phase: context.phase,
      local_ocr: {
        value: context.localValue,
        confidence: context.localConfidence,
        candidates: context.localCandidates,
      },
    },
  })

  if (error) {
    const contextMessage = typeof error.context === 'object' && error.context && 'json' in error.context
      ? await (error.context as Response).json().catch(() => null)
      : null
    throw new Error(String(contextMessage?.error ?? error.message ?? 'Không gọi được Gemini.'))
  }
  if (!data?.ok || !data.result) throw new Error(String(data?.error ?? 'Gemini không trả về kết quả hợp lệ.'))

  const result = data.result as Record<string, unknown>
  const value = result.value === null || result.value === undefined ? null : Number(result.value)
  return {
    detected: Boolean(result.detected),
    value: Number.isSafeInteger(value) && Number(value) >= 0 ? Number(value) : null,
    visibleDigits: String(result.visible_digits ?? '').replace(/\D/g, ''),
    confidence: Math.max(0, Math.min(100, Number(result.confidence ?? 0))),
    needsReview: Boolean(result.needs_review),
    reason: String(result.reason ?? ''),
    displayType: ['odometer', 'trip', 'unknown'].includes(String(result.display_type)) ? result.display_type as GeminiOdometerResult['displayType'] : 'unknown',
    quality: ['clear', 'glare', 'blur', 'cropped', 'dark', 'unknown'].includes(String(result.quality)) ? result.quality as GeminiOdometerResult['quality'] : 'unknown',
    model: String(result.model ?? 'Gemini'),
  }
}
