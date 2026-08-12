export const currency = new Intl.NumberFormat('vi-VN', {
  style: 'currency',
  currency: 'VND',
  maximumFractionDigits: 0,
})

export function formatCurrency(value: number | null | undefined) {
  return currency.format(value ?? 0)
}

export function formatDateTime(value: string | null | undefined) {
  if (!value) return '—'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return new Intl.DateTimeFormat('vi-VN', {
    hour: '2-digit',
    minute: '2-digit',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(date)
}

export function formatDate(value: string | null | undefined) {
  if (!value) return '—'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return new Intl.DateTimeFormat('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(date)
}

export function toDateTimeLocal(date: Date) {
  const offset = date.getTimezoneOffset()
  return new Date(date.getTime() - offset * 60_000).toISOString().slice(0, 16)
}

export function todayKey(date = new Date()) {
  const offset = date.getTimezoneOffset()
  return new Date(date.getTime() - offset * 60_000).toISOString().slice(0, 10)
}

export function isSameLocalDay(value: string, date = new Date()) {
  return todayKey(new Date(value)) === todayKey(date)
}

export function daysUntil(value?: string | null) {
  if (!value) return null
  const target = new Date(`${value}T00:00:00`)
  const now = new Date()
  target.setHours(0, 0, 0, 0)
  now.setHours(0, 0, 0, 0)
  return Math.ceil((target.getTime() - now.getTime()) / 86_400_000)
}

export function uid(_prefix = 'id') {
  if (crypto.randomUUID) return crypto.randomUUID()
  const bytes = new Uint8Array(16)
  crypto.getRandomValues(bytes)
  bytes[6] = (bytes[6] & 0x0f) | 0x40
  bytes[8] = (bytes[8] & 0x3f) | 0x80
  const hex = Array.from(bytes, (value) => value.toString(16).padStart(2, '0')).join('')
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`
}

export function normalizePhone(value: string) {
  return value.replace(/\D/g, '').replace(/^84/, '0')
}

export async function fileToDataUrl(file?: Blob | null) {
  if (!file) return null
  return await new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onerror = () => reject(reader.error)
    reader.onload = () => resolve(String(reader.result))
    reader.readAsDataURL(file)
  })
}


export function getErrorMessage(error: unknown, fallback = 'Có lỗi xảy ra. Vui lòng thử lại.') {
  if (error instanceof Error && error.message.trim()) return error.message
  if (typeof error === 'string' && error.trim()) return error
  if (error && typeof error === 'object') {
    const value = error as Record<string, unknown>
    const message = typeof value.message === 'string' ? value.message.trim() : ''
    const details = typeof value.details === 'string' ? value.details.trim() : ''
    const hint = typeof value.hint === 'string' ? value.hint.trim() : ''
    const code = typeof value.code === 'string' ? value.code.trim() : ''
    const combined = [message, details, hint].filter(Boolean).join(' · ')

    if (/vehicle_request_time_order|expected_end.*scheduled_start|check constraint/i.test(combined)) {
      return 'Thời gian dự kiến về phải sau thời gian khởi hành.'
    }
    if (/duplicate key|unique constraint/i.test(combined)) {
      return 'Dữ liệu này đã tồn tại. Vui lòng kiểm tra lại trước khi gửi.'
    }
    if (/row-level security|permission denied|not authorized/i.test(combined)) {
      return 'Tài khoản hiện tại chưa có quyền thực hiện thao tác này.'
    }
    if (combined) return code ? `${combined} (mã ${code})` : combined
  }
  return fallback
}

export interface ConfirmedLocation {
  lat: number
  lng: number
  accuracy: number
}

export function isTrustedWebContext() {
  return window.isSecureContext || ['localhost', '127.0.0.1'].includes(window.location.hostname)
}

export function getSuggestedSecureUrl() {
  const configured = String(import.meta.env.VITE_PUBLIC_HTTPS_URL || '').trim()
  if (configured) return configured
  const hostname = window.location.hostname || 'localhost'
  const pathname = window.location.pathname || '/'
  return `https://${hostname}:8443${pathname}`
}

function getPosition(options: PositionOptions): Promise<ConfirmedLocation> {
  return new Promise((resolve, reject) => {
    navigator.geolocation.getCurrentPosition(
      (position) => resolve({
        lat: position.coords.latitude,
        lng: position.coords.longitude,
        accuracy: position.coords.accuracy,
      }),
      reject,
      options,
    )
  })
}

export async function requestCurrentLocation(): Promise<ConfirmedLocation> {
  if (!navigator.geolocation) throw new Error('Thiết bị hoặc trình duyệt không hỗ trợ định vị GPS.')
  if (!isTrustedWebContext()) {
    throw new Error(`GPS bị trình duyệt chặn vì website đang dùng HTTP. Hãy mở địa chỉ HTTPS: ${getSuggestedSecureUrl()}`)
  }

  try {
    return await getPosition({ enableHighAccuracy: true, timeout: 20_000, maximumAge: 0 })
  } catch (firstError) {
    const error = firstError as GeolocationPositionError
    if (error.code === error.PERMISSION_DENIED) {
      throw new Error('Quyền Vị trí đang bị chặn. Hãy mở Cài đặt trang web của trình duyệt, chọn Vị trí → Cho phép rồi thử lại.')
    }

    try {
      return await getPosition({ enableHighAccuracy: false, timeout: 12_000, maximumAge: 60_000 })
    } catch (secondError) {
      const fallbackError = secondError as GeolocationPositionError
      if (fallbackError.code === fallbackError.PERMISSION_DENIED) {
        throw new Error('Quyền Vị trí đang bị chặn. Hãy mở Cài đặt trang web của trình duyệt, chọn Vị trí → Cho phép rồi thử lại.')
      }
      if (fallbackError.code === fallbackError.TIMEOUT) {
        throw new Error('Không lấy được GPS trong thời gian cho phép. Hãy bật Độ chính xác cao, ra nơi thoáng hơn rồi bấm Lấy lại vị trí.')
      }
      throw new Error('Không xác định được vị trí hiện tại. Hãy kiểm tra GPS, chế độ tiết kiệm pin và kết nối mạng.')
    }
  }
}

export async function getCurrentLocation(): Promise<{ lat: number; lng: number } | null> {
  try {
    const location = await requestCurrentLocation()
    return { lat: location.lat, lng: location.lng }
  } catch {
    return null
  }
}

export function googleMapsDirectionsUrl(destination: string, origin?: { lat: number; lng: number } | null) {
  const url = new URL('https://www.google.com/maps/dir/')
  url.searchParams.set('api', '1')
  if (origin) url.searchParams.set('origin', `${origin.lat},${origin.lng}`)
  url.searchParams.set('destination', destination)
  url.searchParams.set('travelmode', 'driving')
  url.searchParams.set('dir_action', 'navigate')
  return url.toString()
}

export function googleMapsLocationUrl(location: { lat: number; lng: number }) {
  const url = new URL('https://www.google.com/maps/search/')
  url.searchParams.set('api', '1')
  url.searchParams.set('query', `${location.lat},${location.lng}`)
  return url.toString()
}

export function safeNumber(value: FormDataEntryValue | null, fallback = 0) {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : fallback
}
