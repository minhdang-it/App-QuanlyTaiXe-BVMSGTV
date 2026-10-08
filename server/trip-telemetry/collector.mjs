// BVMSGTV v2.11.13 — Collector GPS Navicom, chạy trên Ubuntu (KHÔNG chạy trong trình duyệt).
// Chỉ yêu cầu Node.js >=18, không cần thư viện npm bên ngoài.
const env = (name) => (process.env[name] || '').trim()
const SUPABASE_URL = env('SUPABASE_URL').replace(/\/$/, '')
const SERVICE_ROLE_KEY = env('SUPABASE_SERVICE_ROLE_KEY')
const SUPABASE_ANON_KEY = env('SUPABASE_ANON_KEY')
const COLLECTOR_EMAIL = env('COLLECTOR_EMAIL')
const COLLECTOR_PASSWORD = env('COLLECTOR_PASSWORD')
const GATEWAY_URL = (env('NAVICOM_GATEWAY_URL') || 'http://127.0.0.1:3020').replace(/\/$/, '')
const INTERVAL_MS = Math.max(5000, Number(env('SAMPLE_INTERVAL_MS') || '10000'))
const FRESHNESS_SECONDS = 90
const args = new Set(process.argv.slice(2))

function parseGpsDate(input) {
  if (input == null || input === '') return null
  if (typeof input === 'number' || /^\d{10,13}$/.test(String(input))) {
    const n = Number(input)
    return Number.isFinite(n) ? new Date(n < 1e12 ? n * 1000 : n) : null
  }
  const value = String(input).trim()
  // CMSV6 đôi khi trả giờ địa phương không có múi giờ (Việt Nam +07:00).
  const normalized = /^\d{4}-\d\d-\d\d[T ]\d\d:\d\d(?::\d\d)?$/.test(value)
    ? value.replace(' ', 'T') + '+07:00' : value
  const dt = new Date(normalized)
  return Number.isNaN(dt.getTime()) ? null : dt
}

function normalizeNavicom(payload) {
  const root = payload?.data?.vehicle || payload?.data?.state || payload?.data || payload?.state || payload
  const gps = root?.gps || root?.location || root || {}
  const lat = Number(gps.lat ?? gps.latitude)
  const lng = Number(gps.lng ?? gps.lon ?? gps.longitude)
  const time = parseGpsDate(gps.updated_at ?? gps.gps_time ?? gps.time ?? root?.updated_at ?? root?.gps_time)
  const rawSpeed = gps.speed_kph ?? gps.speedKph ?? gps.speed ?? root?.speed_kph
  const speed = rawSpeed == null || rawSpeed === '' ? null : Number(rawSpeed)
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180 || (lat === 0 && lng === 0)) return null
  if (!time || !Number.isFinite(time.getTime())) return null
  if (speed != null && (!Number.isFinite(speed) || speed < 0 || speed > 240)) return null
  return { latitude: lat, longitude: lng, gps_at: time.toISOString(), speed_kph: speed == null ? null : Math.round(speed * 100) / 100 }
}

function checkFreshSample(sample, now = Date.now()) {
  const diff = now - Date.parse(sample.gps_at)
  return diff >= -30000 && diff <= FRESHNESS_SECONDS * 1000
}

function assertConfig() {
  const missing = ['SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY', 'SUPABASE_ANON_KEY', 'COLLECTOR_EMAIL', 'COLLECTOR_PASSWORD']
    .filter((key) => !env(key))
  if (missing.length) throw new Error('Thiếu cấu hình ' + missing.join(', '))
  if (!(SUPABASE_URL.startsWith('https://') || SUPABASE_URL.startsWith('http://127.0.0.1:') || SUPABASE_URL.startsWith('http://localhost:'))) {
    throw new Error('SUPABASE_URL phải là HTTPS (ngoại trừ localhost khi kiểm thử).')
  }
  if (!GATEWAY_URL.startsWith('http://127.0.0.1:') && !GATEWAY_URL.startsWith('http://localhost:')) {
    throw new Error('NAVICOM_GATEWAY_URL phải trỏ đến localhost để hạn chế rủi ro rò rỉ JWT.')
  }
}

async function requestJson(url, opts = {}) {
  const ctrl = new AbortController()
  const timeout = setTimeout(() => ctrl.abort(), 10000)
  try {
    const response = await fetch(url, { ...opts, signal: ctrl.signal })
    const text = await response.text()
    let data
    try { data = text ? JSON.parse(text) : null } catch { throw new Error(`Phản hồi không phải JSON: HTTP ${response.status}`) }
    if (!response.ok) throw new Error(`HTTP ${response.status}: ${String(data?.message || data?.error || 'Yêu cầu lỗi').slice(0,160)}`)
    return data
  } finally { clearTimeout(timeout) }
}

const restHeaders = () => ({ apikey: SERVICE_ROLE_KEY, Authorization: `Bearer ${SERVICE_ROLE_KEY}`, 'Content-Type': 'application/json' })
async function query(tableAndParams) { return requestJson(`${SUPABASE_URL}/rest/v1/${tableAndParams}`, { headers: restHeaders() }) }
async function submitSample(sample) {
  return requestJson(`${SUPABASE_URL}/rest/v1/trip_gps_samples?on_conflict=trip_id,gps_at,latitude,longitude`, {
    method: 'POST', headers: { ...restHeaders(), Prefer: 'resolution=ignore-duplicates,return=minimal' }, body: JSON.stringify(sample),
  })
}
async function refreshSummary(id) {
  await requestJson(`${SUPABASE_URL}/rest/v1/rpc/refresh_trip_gps_summary`, {
    method: 'POST', headers: restHeaders(), body: JSON.stringify({ p_trip_id: id }),
  })
}

let session = { access_token: '', expires_at: 0 }
async function gatewayToken() {
  if (session.access_token && Date.now() < session.expires_at - 60_000) return session.access_token
  const response = await requestJson(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
    method: 'POST', headers: { apikey: SUPABASE_ANON_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: COLLECTOR_EMAIL, password: COLLECTOR_PASSWORD }),
  })
  if (!response?.access_token) throw new Error('Không đăng nhập được tài khoản collector vào Supabase Auth')
  session = { access_token: response.access_token, expires_at: Date.now() + (Number(response.expires_in) || 3600) * 1000 }
  return session.access_token
}

async function getState(deviceId) {
  const token = await gatewayToken()
  const url = `${GATEWAY_URL}/vehicle/${encodeURIComponent(deviceId)}`
  return requestJson(url, { headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' } })
}

function recentCompletedCutoff() { return new Date(Date.now() - 2 * 60_000).toISOString() }

async function cycle() {
  const [active, completed, vehicles] = await Promise.all([
    query('trips?select=id,vehicle_id,status,started_at,ended_at&status=eq.active&started_at=not.is.null'),
    query(`trips?select=id,vehicle_id,status,started_at,ended_at&status=eq.completed&ended_at=gte.${encodeURIComponent(recentCompletedCutoff())}`),
    query('vehicles?select=id,plate_number,navicom_enabled,navicom_device_id&navicom_enabled=eq.true'),
  ])
  const matches = [...active, ...completed]
  const vehicleMap = new Map(vehicles.filter(v => v.navicom_device_id).map(v => [v.id, v]))
  let stored = 0
  for (const trip of matches) {
    const vehicle = vehicleMap.get(trip.vehicle_id)
    if (!vehicle) { console.warn('Bỏ qua chuyến thiếu cấu hình Navicom:', trip.id); continue }
    try {
      const data = await getState(vehicle.navicom_device_id)
      const sample = normalizeNavicom(data)
      if (!sample || !checkFreshSample(sample)) { console.warn('GPS thiếu hoặc cũ, không ghi:', vehicle.plate_number); continue }
      const gpsTime = Date.parse(sample.gps_at)
      const start = Date.parse(trip.started_at)
      const end = trip.ended_at ? Date.parse(trip.ended_at) : Date.now()
      if (gpsTime < start || gpsTime > end) continue
      // Nếu thiết bị trả vị trí cách xa thời điểm thực tế, không tự gán vào chuyến.
      await submitSample({ trip_id: trip.id, vehicle_id: trip.vehicle_id, ...sample, source: 'navicom' })
      await refreshSummary(trip.id)
      stored++
    } catch (error) {
      console.error('Không ghi được GPS xe', vehicle.plate_number, '-', error instanceof Error ? error.message : String(error))
    }
  }
  console.log(new Date().toISOString(), `chuyến=${matches.length} mẫu_xử_lý=${stored}`)
}

if (args.has('--self-test')) {
  const a = normalizeNavicom({ gps: { lat: 9.934, lng: 106.32, speed_kph: 71, updated_at: '2026-10-08T03:00:00Z' } })
  const b = normalizeNavicom({ data: { gps: { lat: 9.934, lng: 106.32, speed_kph: 71, updated_at: '2026-10-08 10:00:00' } } })
  const bad = normalizeNavicom({ gps: { lat: 0, lng: 0, updated_at: '2026-10-08T03:00:00Z' } })
  if (!a || a.gps_at !== b.gps_at || a.speed_kph !== 71 || bad !== null) process.exitCode = 1
  else console.log('SELF-TEST OK: tọa độ / tốc độ / múi giờ / loại bỏ GPS không hợp lệ')
} else {
  try {
    assertConfig()
    let running = false
    const run = async () => {
      if (running) return
      running = true
      try { await cycle() } catch (error) { console.error('Collector:', error instanceof Error ? error.message : String(error)) }
      finally { running = false }
    }
    await run()
    if (!args.has('--once')) setInterval(run, INTERVAL_MS)
  } catch (error) { console.error(error instanceof Error ? error.message : String(error)); process.exitCode = 1 }
}
