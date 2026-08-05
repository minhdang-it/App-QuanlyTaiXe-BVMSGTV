import { createClient } from 'npm:@supabase/supabase-js@^2'

const FUNCTION_VERSION = '2.5.0'
const MAX_BASE64_LENGTH = 3_000_000
const SUPPORTED_MIME_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp'])
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
}

type OdometerRequest = {
  image_base64?: unknown
  mime_type?: unknown
  baseline?: unknown
  phase?: unknown
  local_ocr?: {
    value?: unknown
    confidence?: unknown
    candidates?: unknown
  }
}

type GeminiPayload = {
  detected?: unknown
  odometer?: unknown
  visible_digits?: unknown
  confidence?: unknown
  needs_review?: unknown
  reason?: unknown
  display_type?: unknown
  quality?: unknown
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json; charset=utf-8' },
  })
}

function bearerToken(request: Request) {
  const authorization = request.headers.get('Authorization') ?? ''
  return authorization.match(/^Bearer\s+(.+)$/i)?.[1]?.trim() ?? ''
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value))
}

function toSafeInteger(value: unknown, fallback = 0) {
  const parsed = Number(value)
  return Number.isSafeInteger(parsed) && parsed >= 0 ? parsed : fallback
}

function toConfidence(value: unknown) {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? clamp(Math.round(parsed), 0, 100) : 0
}

function getOutputText(payload: Record<string, unknown>) {
  if (typeof payload.output_text === 'string') return payload.output_text
  const steps = Array.isArray(payload.steps) ? payload.steps : []
  for (let index = steps.length - 1; index >= 0; index -= 1) {
    const step = steps[index] as Record<string, unknown>
    if (step.type !== 'model_output' || !Array.isArray(step.content)) continue
    const text = step.content
      .map((item) => item as Record<string, unknown>)
      .filter((item) => item.type === 'text' && typeof item.text === 'string')
      .map((item) => String(item.text))
      .join('')
    if (text) return text
  }
  return ''
}

function parseGeminiJson(text: string): GeminiPayload {
  const cleaned = text.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '')
  return JSON.parse(cleaned) as GeminiPayload
}

function buildPrompt(input: {
  baseline: number
  phase: 'start' | 'end'
  localValue: number | null
  localConfidence: number
  localCandidates: number[]
}) {
  const phaseLabel = input.phase === 'start' ? 'KM đầu chuyến' : 'KM cuối chuyến'
  return `Bạn là hệ thống kiểm tra ảnh đồng hồ kilomet của xe bệnh viện.

Nhiệm vụ duy nhất: đọc TỔNG SỐ KILOMET ODO trên cụm đồng hồ trong ảnh. Không lấy Trip A, Trip B, quãng đường hành trình, giờ, nhiệt độ, mức nhiên liệu, tốc độ hoặc số trên màn hình giải trí.

Ngữ cảnh tham khảo, không được dùng để bịa số:
- Loại ảnh: ${phaseLabel}
- KM gần nhất trong hồ sơ: ${input.baseline || 'chưa có'}
- OCR cục bộ đọc: ${input.localValue ?? 'không đọc được'}
- Độ tin cậy OCR cục bộ: ${input.localConfidence}%
- Các dãy số OCR tìm thấy: ${input.localCandidates.length ? input.localCandidates.join(', ') : 'không có'}

Quy tắc:
1. Ưu tiên nhãn ODO/ODO TOTAL hoặc dãy số tổng kilomet chính.
2. Nếu chỉ nhìn thấy Trip A/Trip B hoặc không đủ rõ, detected=false, odometer=0 và needs_review=true.
3. Không tự suy diễn từ KM hồ sơ. Chỉ trả số thực sự nhìn thấy trong ảnh.
4. visible_digits chỉ chứa dãy số nhìn thấy, không dấu chấm/phẩy và không chữ.
5. confidence là mức chắc chắn 0-100.
6. needs_review=true nếu ảnh lóa, mờ, cắt mất số, có nhiều màn hình số cạnh tranh hoặc không chắc đó là ODO.
7. reason viết tiếng Việt ngắn gọn, nêu rõ vì sao chọn hoặc không chọn số.

Trả đúng JSON theo schema.`
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { status: 200, headers: corsHeaders })
  if (request.method === 'GET') return json({ ok: true, function: 'analyze-odometer', version: FUNCTION_VERSION })
  if (request.method !== 'POST') return json({ error: 'Method not allowed' }, 405)

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    const geminiApiKey = Deno.env.get('GEMINI_API_KEY')
    const model = Deno.env.get('GEMINI_ODOMETER_MODEL')?.trim() || 'gemini-3.6-flash'
    const token = bearerToken(request)

    if (!supabaseUrl || !anonKey || !serviceRoleKey) return json({ error: 'Edge Function chưa có đủ cấu hình Supabase.' }, 500)
    if (!geminiApiKey) return json({ error: 'Chưa cấu hình GEMINI_API_KEY cho Edge Function.' }, 503)
    if (!token) return json({ error: 'Thiếu phiên đăng nhập.' }, 401)

    const authClient = createClient(supabaseUrl, anonKey, { auth: { persistSession: false, autoRefreshToken: false } })
    const { data: authData, error: authError } = await authClient.auth.getUser(token)
    if (authError || !authData.user) return json({ error: 'Phiên đăng nhập không hợp lệ hoặc đã hết hạn.' }, 401)

    const adminClient = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false, autoRefreshToken: false } })
    const { data: profile, error: profileError } = await adminClient
      .from('profiles')
      .select('role, active')
      .eq('id', authData.user.id)
      .maybeSingle()
    if (profileError) return json({ error: `Không kiểm tra được tài khoản: ${profileError.message}` }, 500)
    if (!profile?.active) return json({ error: 'Tài khoản đã bị khóa hoặc không còn hoạt động.' }, 403)

    const body = await request.json() as OdometerRequest
    const imageBase64 = String(body.image_base64 ?? '').replace(/^data:[^;]+;base64,/, '')
    const mimeType = String(body.mime_type ?? 'image/jpeg').toLowerCase()
    const baseline = toSafeInteger(body.baseline)
    const phase = body.phase === 'end' ? 'end' : 'start'
    const localValueRaw = body.local_ocr?.value
    const localValue = localValueRaw === null || localValueRaw === undefined ? null : toSafeInteger(localValueRaw)
    const localConfidence = toConfidence(body.local_ocr?.confidence)
    const rawCandidates = body.local_ocr?.candidates
    const localCandidates = Array.isArray(rawCandidates)
      ? rawCandidates.map((item) => toSafeInteger(item, -1)).filter((item) => item >= 0).slice(0, 10)
      : []

    if (!imageBase64 || imageBase64.length > MAX_BASE64_LENGTH) return json({ error: 'Ảnh không hợp lệ hoặc dung lượng quá lớn. Hãy chụp lại gần hơn.' }, 400)
    if (!SUPPORTED_MIME_TYPES.has(mimeType)) return json({ error: 'Định dạng ảnh chưa được hỗ trợ. Vui lòng dùng JPG, PNG hoặc WEBP.' }, 400)

    const responseSchema = {
      type: 'object',
      additionalProperties: false,
      properties: {
        detected: { type: 'boolean', description: 'Có nhìn thấy rõ tổng số ODO hay không.' },
        odometer: { type: 'integer', minimum: 0, description: 'Tổng số kilomet ODO; dùng 0 nếu không đọc được.' },
        visible_digits: { type: 'string', description: 'Dãy chữ số ODO nhìn thấy, không dấu phân cách.' },
        confidence: { type: 'integer', minimum: 0, maximum: 100 },
        needs_review: { type: 'boolean' },
        reason: { type: 'string' },
        display_type: { type: 'string', enum: ['odometer', 'trip', 'unknown'] },
        quality: { type: 'string', enum: ['clear', 'glare', 'blur', 'cropped', 'dark', 'unknown'] },
      },
      required: ['detected', 'odometer', 'visible_digits', 'confidence', 'needs_review', 'reason', 'display_type', 'quality'],
    }

    const geminiResponse = await fetch('https://generativelanguage.googleapis.com/v1beta/interactions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': geminiApiKey,
      },
      body: JSON.stringify({
        model,
        input: [
          { type: 'text', text: buildPrompt({ baseline, phase, localValue, localConfidence, localCandidates }) },
          { type: 'image', data: imageBase64, mime_type: mimeType },
        ],
        response_format: {
          type: 'text',
          mime_type: 'application/json',
          schema: responseSchema,
        },
      }),
    })

    const geminiPayload = await geminiResponse.json() as Record<string, unknown>
    if (!geminiResponse.ok) {
      const message = (geminiPayload.error as Record<string, unknown> | undefined)?.message
      return json({ error: `Gemini không xử lý được ảnh: ${String(message ?? geminiResponse.statusText)}` }, geminiResponse.status)
    }

    const outputText = getOutputText(geminiPayload)
    if (!outputText) return json({ error: 'Gemini không trả về kết quả đọc ảnh.' }, 502)
    const parsed = parseGeminiJson(outputText)
    const detected = Boolean(parsed.detected)
    const odometer = detected ? toSafeInteger(parsed.odometer) : null
    const confidence = toConfidence(parsed.confidence)
    const visibleDigits = String(parsed.visible_digits ?? '').replace(/\D/g, '').slice(0, 10)
    const displayType = ['odometer', 'trip', 'unknown'].includes(String(parsed.display_type)) ? String(parsed.display_type) : 'unknown'
    const quality = ['clear', 'glare', 'blur', 'cropped', 'dark', 'unknown'].includes(String(parsed.quality)) ? String(parsed.quality) : 'unknown'
    const impossibleAgainstBaseline = odometer != null && baseline > 0 && (odometer < baseline - 100 || odometer > baseline + 100_000)
    const needsReview = Boolean(parsed.needs_review) || !detected || displayType !== 'odometer' || confidence < 75 || impossibleAgainstBaseline

    return json({
      ok: true,
      result: {
        detected,
        value: odometer,
        visible_digits: visibleDigits,
        confidence,
        needs_review: needsReview,
        reason: String(parsed.reason ?? '').trim().slice(0, 500),
        display_type: displayType,
        quality,
        model,
      },
    })
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : 'Không phân tích được ảnh đồng hồ kilomet.' }, 500)
  }
})
