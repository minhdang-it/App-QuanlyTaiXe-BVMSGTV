import { useEffect, useMemo, useState } from 'react'
import type { Vehicle } from '../types/models'
import { Icon } from './Icon'
import { formatDateTime } from '../lib/utils'
import { fetchNavicomVehicleState, type NavicomCameraChannel, type NavicomVehicleState } from '../lib/navicom'

const NAVICOM_POLL_MS = 5_000

export function NavicomMonitor({ vehicle, compact = false }: { vehicle: Vehicle | null | undefined; compact?: boolean }) {
  const [state, setState] = useState<NavicomVehicleState | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [selectedChannel, setSelectedChannel] = useState<string | null>(null)
  const [refreshKey, setRefreshKey] = useState(0)

  const deviceId = vehicle?.navicom_device_id?.trim() ?? ''
  const navicomEnabled = Boolean(vehicle?.navicom_enabled)
  const enabled = Boolean(navicomEnabled && deviceId)

  useEffect(() => {
    if (!enabled) {
      setState(null)
      setError(null)
      return
    }
    let stopped = false
    let controller: AbortController | null = null

    async function load(showLoading = false) {
      controller?.abort()
      controller = new AbortController()
      if (showLoading) setLoading(true)
      try {
        const next = await fetchNavicomVehicleState(deviceId, vehicle?.navicom_channel_count, controller.signal)
        if (stopped) return
        setState(next)
        setError(null)
        if (!selectedChannel && next.channels?.length) setSelectedChannel(next.channels[0].id)
      } catch (err) {
        if (stopped || (err instanceof DOMException && err.name === 'AbortError')) return
        setError(err instanceof Error ? err.message : String(err))
      } finally {
        if (!stopped) setLoading(false)
      }
    }

    void load(true)
    const timer = window.setInterval(() => void load(false), NAVICOM_POLL_MS)
    return () => {
      stopped = true
      controller?.abort()
      window.clearInterval(timer)
    }
  }, [deviceId, enabled, refreshKey, vehicle?.navicom_channel_count])

  const channel = useMemo(() => state?.channels?.find((item) => item.id === selectedChannel) ?? state?.channels?.[0] ?? null, [selectedChannel, state])

  if (!vehicle) return null
  if (!navicomEnabled) return <section className={`navicom-monitor ${compact ? 'compact' : ''} unconfigured`}>
    <div className="navicom-monitor-head"><div><span className="navicom-brand-dot" /><div><strong>Xe chưa bật tích hợp Navicom</strong><small>Vào Quản lý xe → Chỉnh sửa → bật “Kích hoạt Navicom”.</small></div></div></div>
  </section>
  if (!deviceId) return <section className={`navicom-monitor ${compact ? 'compact' : ''} unconfigured`}>
    <div className="navicom-monitor-head"><div><span className="navicom-brand-dot" /><div><strong>Thiếu mã thiết bị Navicom</strong><small>{vehicle.plate_number}: chọn xe từ tài khoản Navicom hoặc nhập Device ID / IMEI rồi lưu lại.</small></div></div></div>
  </section>

  const hasCoordinates = state?.gps?.lat != null && state?.gps?.lng != null

  return <section className={`navicom-monitor ${compact ? 'compact' : ''}`}>
    <div className="navicom-monitor-head">
      <div><span className={`navicom-brand-dot ${state?.online ? 'online' : ''}`} /><div><strong>Navicom · {vehicle.plate_number}</strong><small>{loading && !state ? 'Đang kết nối thiết bị...' : state?.online ? 'GPS Navicom đang cập nhật trực tiếp' : state?.gps?.updated_at ? 'Có vị trí GPS gần nhất · camera có thể đang ngoại tuyến' : 'Chưa có dữ liệu GPS mới'}</small></div></div>
      <button type="button" className="navicom-refresh-button" onClick={() => setRefreshKey((value) => value + 1)} aria-label="Làm mới Navicom"><Icon name="refresh" size={15} /></button>
    </div>

    {error && <div className="navicom-error"><Icon name="alert" size={15} /><span>{error}</span></div>}
    {state?.message && <div className="navicom-mode-note"><Icon name="alert" size={15} /><span>{state.message}</span></div>}

    {state && <>
      <div className="navicom-status-grid">
        <div><span>Vị trí GPS Navicom</span><strong>{state.gps.address || (hasCoordinates ? `${state.gps.lat!.toFixed(6)}, ${state.gps.lng!.toFixed(6)}` : 'Chưa có tọa độ')}</strong></div>
        <div><span>Tốc độ</span><strong>{state.gps.speed_kph != null ? `${Math.round(state.gps.speed_kph)} km/h` : '—'}</strong></div>
        <div><span>Trạng thái xe</span><strong>{state.gps.ignition == null ? '—' : state.gps.ignition ? 'Đang bật máy' : 'Đã tắt máy'}</strong></div>
        <div><span>Cập nhật gần nhất</span><strong>{state.gps.updated_at ? formatDateTime(state.gps.updated_at) : state.updated_at ? formatDateTime(state.updated_at) : '—'}</strong></div>
      </div>

      {hasCoordinates && <NavicomRealtimeMap
        lat={state.gps.lat!}
        lng={state.gps.lng!}
        plateNumber={vehicle.plate_number}
        speedKph={state.gps.speed_kph}
        updatedAt={state.gps.updated_at ?? state.updated_at}
        address={state.gps.address}
        compact={compact}
      />}

      {!compact && <CameraViewer channels={state.channels ?? []} selected={channel} onSelect={setSelectedChannel} />}
    </>}
  </section>
}

function NavicomRealtimeMap({ lat, lng, plateNumber, speedKph, updatedAt, address, compact }: {
  lat: number
  lng: number
  plateNumber: string
  speedKph?: number | null
  updatedAt?: string | null
  address?: string | null
  compact?: boolean
}) {
  const deltaLat = compact ? 0.006 : 0.012
  const deltaLng = compact ? 0.009 : 0.018
  const bbox = `${lng - deltaLng},${lat - deltaLat},${lng + deltaLng},${lat + deltaLat}`
  const mapUrl = `https://www.openstreetmap.org/export/embed.html?bbox=${encodeURIComponent(bbox)}&layer=mapnik&marker=${encodeURIComponent(`${lat},${lng}`)}`
  const externalUrl = `https://www.openstreetmap.org/?mlat=${encodeURIComponent(String(lat))}&mlon=${encodeURIComponent(String(lng))}#map=17/${encodeURIComponent(String(lat))}/${encodeURIComponent(String(lng))}`

  return <section className={`navicom-realtime-map ${compact ? 'compact' : ''}`}>
    <div className="navicom-map-head">
      <div>
        <span className="navicom-map-live-dot" />
        <div><strong>Vị trí xe realtime</strong><small>Tự cập nhật từ GPS Navicom mỗi 5 giây</small></div>
      </div>
      <a href={externalUrl} target="_blank" rel="noreferrer" className="navicom-map-external" aria-label="Mở bản đồ lớn">Mở rộng</a>
    </div>
    <div className="navicom-map-canvas">
      <iframe
        key={`${lat.toFixed(6)}-${lng.toFixed(6)}`}
        title={`Vị trí realtime ${plateNumber}`}
        src={mapUrl}
        loading="lazy"
        referrerPolicy="no-referrer-when-downgrade"
      />
      <div className="navicom-map-floating-card">
        <strong>{plateNumber}</strong>
        <span>{speedKph != null ? `${Math.round(speedKph)} km/h` : 'Chưa có tốc độ'}</span>
      </div>
    </div>
    <div className="navicom-map-footer">
      <div><span>Tọa độ</span><strong>{lat.toFixed(6)}, {lng.toFixed(6)}</strong></div>
      <div><span>Vị trí</span><strong>{address || 'Theo tọa độ GPS Navicom'}</strong></div>
      <div><span>Cập nhật</span><strong>{updatedAt ? formatDateTime(updatedAt) : '—'}</strong></div>
    </div>
  </section>
}

function CameraViewer({ channels, selected, onSelect }: { channels: NavicomCameraChannel[]; selected: NavicomCameraChannel | null; onSelect: (id: string) => void }) {
  if (!channels.length) return <div className="navicom-camera-empty"><Icon name="camera" size={18} /><span>Thiết bị chưa trả về kênh camera.</span></div>

  return <div className="navicom-camera-block">
    <div className="navicom-camera-tabs" role="tablist">
      {channels.map((item) => <button type="button" key={item.id} className={selected?.id === item.id ? 'active' : ''} onClick={() => onSelect(item.id)}><span className={item.online === false ? 'offline' : item.online === true ? 'online' : 'unknown'} />{item.label}</button>)}
    </div>
    {selected && <div className="navicom-player">
      {selected.player_url ? <><iframe title={`Camera ${selected.label}`} src={selected.player_url} allow="autoplay; fullscreen" />{(selected.external_url || selected.player_url) && <a className="navicom-open-external" href={selected.external_url || selected.player_url || '#'} target="_blank" rel="noreferrer">Mở camera Navicom trong cửa sổ mới</a>}</>
        : selected.hls_url ? <video src={selected.hls_url} controls autoPlay muted playsInline />
          : selected.snapshot_url ? <img src={selected.snapshot_url} alt={`Camera ${selected.label}`} />
            : <div className="navicom-camera-empty"><Icon name="camera" size={18} /><span>Gateway chưa cung cấp URL xem trực tiếp cho kênh này.</span></div>}
    </div>}
  </div>
}
