import { useEffect, useMemo, useState } from 'react'
import { useData } from '../context/DataContext'
import { Icon } from '../components/Icon'
import { fetchNavicomVehicleState, type NavicomVehicleState } from '../lib/navicom'
import { NAVICOM_FLEET_EVENT, classifyNavicomState, coordinateLabel, loadNavicomEvents, type FleetEvent, type FleetStatus } from '../lib/navicomFleet'
import { formatDateTime } from '../lib/utils'
import { consumeNavigationFocus, NAVIGATION_FOCUS_EVENT } from '../lib/focusNavigation'
import type { Trip, Vehicle } from '../types/models'

const POLL_MS = 5_000
type FilterKey = 'all' | 'online' | 'moving' | 'stopped' | 'offline' | 'warning'
type VehicleStateMap = Record<string, NavicomVehicleState | null>

const STATUS_META: Record<FleetStatus, { label: string; tone: string }> = {
  moving: { label: 'Đang chạy', tone: 'moving' },
  stopped: { label: 'Đang dừng', tone: 'stopped' },
  stale: { label: 'Chậm cập nhật', tone: 'stale' },
  offline: { label: 'Mất tín hiệu', tone: 'offline' },
  unknown: { label: 'Chưa có dữ liệu', tone: 'unknown' },
}

export function TrackingPage() {
  const { data } = useData()
  const vehicles = useMemo(() => data.vehicles.filter((vehicle) => vehicle.navicom_enabled && vehicle.navicom_device_id?.trim()), [data.vehicles])
  const [states, setStates] = useState<VehicleStateMap>({})
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [filter, setFilter] = useState<FilterKey>('all')
  const [search, setSearch] = useState('')
  const [selectedVehicleId, setSelectedVehicleId] = useState<string>(() => vehicles[0]?.id ?? '')
  const [events, setEvents] = useState<FleetEvent[]>(() => loadNavicomEvents())
  const [refreshing, setRefreshing] = useState(false)
  const [refreshNonce, setRefreshNonce] = useState(0)

  useEffect(() => {
    const openFocusedVehicle = (recordId?: string | null) => {
      if (recordId && vehicles.some((vehicle) => vehicle.id === recordId)) setSelectedVehicleId(recordId)
    }
    openFocusedVehicle(consumeNavigationFocus('tracking'))
    const handleFocus = (event: Event) => {
      const detail = (event as CustomEvent<{ target?: string; recordId?: string }>).detail
      if (detail?.target === 'tracking') openFocusedVehicle(detail.recordId)
    }
    window.addEventListener(NAVIGATION_FOCUS_EVENT, handleFocus)
    return () => window.removeEventListener(NAVIGATION_FOCUS_EVENT, handleFocus)
  }, [vehicles])

  useEffect(() => {
    const handleFleetEvent = () => setEvents(loadNavicomEvents())
    window.addEventListener(NAVICOM_FLEET_EVENT, handleFleetEvent)
    return () => window.removeEventListener(NAVICOM_FLEET_EVENT, handleFleetEvent)
  }, [])

  useEffect(() => {
    if (!vehicles.length) {
      setSelectedVehicleId('')
      return
    }
    if (!vehicles.some((vehicle) => vehicle.id === selectedVehicleId)) setSelectedVehicleId(vehicles[0].id)
  }, [selectedVehicleId, vehicles])

  useEffect(() => {
    let stopped = false
    let controllers: AbortController[] = []

    async function poll(showLoading = false) {
      controllers.forEach((controller) => controller.abort())
      controllers = []
      if (showLoading) setRefreshing(true)

      const entries = await Promise.all(vehicles.map(async (vehicle) => {
        const controller = new AbortController()
        controllers.push(controller)
        const deviceId = vehicle.navicom_device_id?.trim() ?? ''
        try {
          const state = await fetchNavicomVehicleState(deviceId, 2, controller.signal)
          return { vehicle, state, error: null as string | null }
        } catch (error) {
          if (error instanceof DOMException && error.name === 'AbortError') return { vehicle, state: null, error: null }
          return { vehicle, state: null, error: error instanceof Error ? error.message : String(error) }
        }
      }))

      if (stopped) return
      setStates((current) => {
        const next = { ...current }
        for (const entry of entries) if (entry.state) next[entry.vehicle.id] = entry.state
        return next
      })
      setErrors((current) => {
        const next = { ...current }
        for (const entry of entries) {
          if (entry.error) next[entry.vehicle.id] = entry.error
          else delete next[entry.vehicle.id]
        }
        return next
      })

      if (showLoading) setRefreshing(false)
    }

    void poll(true)
    const timer = window.setInterval(() => void poll(false), POLL_MS)
    return () => {
      stopped = true
      controllers.forEach((controller) => controller.abort())
      window.clearInterval(timer)
    }
  }, [refreshNonce, vehicles])

  const fleetItems = useMemo(() => vehicles.map((vehicle) => {
    const state = states[vehicle.id] ?? null
    const status = errors[vehicle.id] ? 'offline' as FleetStatus : classifyNavicomState(state)
    const activeTrip = data.trips.find((trip) => trip.vehicle_id === vehicle.id && ['assigned', 'accepted', 'ready', 'active'].includes(trip.status)) ?? null
    const driverId = activeTrip?.driver_id || vehicle.regular_driver_id
    const driver = data.profiles.find((profile) => profile.id === driverId)
    const warnings = vehicleWarnings(vehicle, status)
    return { vehicle, state, status, activeTrip, driver, warnings, error: errors[vehicle.id] }
  }), [data.profiles, data.trips, errors, states, vehicles])

  const metrics = useMemo(() => ({
    total: fleetItems.length,
    online: fleetItems.filter((item) => ['moving', 'stopped'].includes(item.status)).length,
    moving: fleetItems.filter((item) => item.status === 'moving').length,
    stopped: fleetItems.filter((item) => item.status === 'stopped').length,
    offline: fleetItems.filter((item) => ['offline', 'unknown'].includes(item.status)).length,
    warnings: fleetItems.reduce((sum, item) => sum + item.warnings.length + (item.status === 'stale' ? 1 : 0), 0),
  }), [fleetItems])

  const filteredItems = useMemo(() => {
    const keyword = search.trim().toLocaleLowerCase('vi')
    return fleetItems.filter((item) => {
      const matchesSearch = !keyword || [item.vehicle.plate_number, item.vehicle.vehicle_name, item.driver?.full_name, item.state?.gps.address]
        .filter(Boolean).some((value) => String(value).toLocaleLowerCase('vi').includes(keyword))
      if (!matchesSearch) return false
      if (filter === 'all') return true
      if (filter === 'online') return ['moving', 'stopped'].includes(item.status)
      if (filter === 'moving') return item.status === 'moving'
      if (filter === 'stopped') return item.status === 'stopped'
      if (filter === 'offline') return ['offline', 'unknown', 'stale'].includes(item.status)
      return item.warnings.length > 0 || item.status === 'stale'
    })
  }, [filter, fleetItems, search])

  const selected = fleetItems.find((item) => item.vehicle.id === selectedVehicleId) ?? filteredItems[0] ?? fleetItems[0] ?? null

  return <div className="fleet-command-page">
    <section className="fleet-command-hero">
      <div>
        <span>TRUNG TÂM ĐIỀU HÀNH ĐỘI XE</span>
        <h2>Theo dõi xe realtime</h2>
        <p>GPS và camera lấy trực tiếp từ Navicom. Không sử dụng GPS điện thoại tài xế.</p>
      </div>
      <button type="button" className="secondary-button compact fleet-refresh" onClick={() => setRefreshNonce((value) => value + 1)} disabled={refreshing}>
        <Icon name="refresh" size={15} /> {refreshing ? 'Đang cập nhật' : 'Làm mới'}
      </button>
    </section>

    <section className="fleet-metric-grid">
      <FleetMetric icon="vehicle" label="Tổng số xe" value={metrics.total} tone="neutral" />
      <FleetMetric icon="activity" label="Xe online" value={metrics.online} tone="online" />
      <FleetMetric icon="navigation" label="Đang chạy" value={metrics.moving} tone="moving" />
      <FleetMetric icon="parking" label="Đang dừng" value={metrics.stopped} tone="stopped" />
      <FleetMetric icon="cloud-off" label="Mất tín hiệu" value={metrics.offline} tone="offline" />
      <FleetMetric icon="alert" label="Cảnh báo" value={metrics.warnings} tone="warning" />
    </section>

    {!vehicles.length ? <section className="panel fleet-empty-state">
      <Icon name="navigation" size={30} />
      <h3>Chưa có xe được liên kết Navicom</h3>
      <p>Vào Hồ sơ xe → Chỉnh sửa → bật Kích hoạt Navicom và chọn đúng Device ID của xe.</p>
    </section> : <>
      <section className="fleet-toolbar panel">
        <div className="fleet-filter-tabs">
          {([
            ['all', 'Tất cả', metrics.total], ['online', 'Online', metrics.online], ['moving', 'Đang chạy', metrics.moving],
            ['stopped', 'Đang dừng', metrics.stopped], ['offline', 'Mất tín hiệu', metrics.offline], ['warning', 'Cảnh báo', metrics.warnings],
          ] as Array<[FilterKey, string, number]>).map(([key, label, count]) => <button type="button" key={key} className={filter === key ? 'active' : ''} onClick={() => setFilter(key)}>{label}<b>{count}</b></button>)}
        </div>
        <label className="fleet-search"><Icon name="search" size={15} /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Tìm biển số, tài xế, vị trí..." /></label>
      </section>

      <div className="fleet-command-layout">
        <section className="fleet-vehicle-list panel">
          <div className="panel-header"><div><h2>Danh sách xe</h2><p>{filteredItems.length} xe phù hợp bộ lọc</p></div><span className="count-pill">{filteredItems.length}</span></div>
          <div className="fleet-card-list">
            {filteredItems.map((item) => <VehicleLiveCard key={item.vehicle.id} item={item} selected={selected?.vehicle.id === item.vehicle.id} onSelect={() => setSelectedVehicleId(item.vehicle.id)} />)}
          </div>
        </section>

        <main className="fleet-live-workspace">
          <section className="panel fleet-map-panel">
            <div className="panel-header"><div><h2>Bản đồ đội xe</h2><p>Marker tự cập nhật theo GPS Navicom mỗi 5 giây.</p></div><span className="fleet-live-pill"><i /> Realtime</span></div>
            <FleetRealtimeMap items={fleetItems} selectedVehicleId={selected?.vehicle.id ?? ''} onSelect={setSelectedVehicleId} />
          </section>

          {selected && <VehicleCommandDetail item={selected} />}
        </main>
      </div>

      <section className="panel fleet-event-panel">
        <div className="panel-header"><div><h2>Hoạt động gần đây</h2><p>Chỉ ghi khi trạng thái xe thực sự thay đổi để tránh spam.</p></div><span className="count-pill">{events.length}</span></div>
        <div className="fleet-event-list">
          {events.length ? events.slice(0, 12).map((event) => <article key={event.id} className={`fleet-event fleet-event-${event.type}`}>
            <span><Icon name={event.type === 'online' ? 'activity' : event.type === 'offline' ? 'cloud-off' : event.type === 'moving' ? 'navigation' : event.type === 'warning' ? 'alert' : 'parking'} size={16} /></span>
            <div><strong>{event.title}</strong><small>{event.detail}</small></div>
            <time>{formatDateTime(event.createdAt)}</time>
          </article>) : <div className="fleet-no-events"><Icon name="activity" size={20} /><span>Chưa có thay đổi trạng thái mới trong phiên theo dõi.</span></div>}
        </div>
      </section>
    </>}
  </div>
}

function FleetMetric({ icon, label, value, tone }: { icon: Parameters<typeof Icon>[0]['name']; label: string; value: number; tone: string }) {
  return <article className={`fleet-metric tone-${tone}`}><span><Icon name={icon} size={18} /></span><div><strong>{value}</strong><small>{label}</small></div></article>
}

function VehicleLiveCard({ item, selected, onSelect }: { item: ReturnType<typeof makeItemShape>; selected: boolean; onSelect: () => void }) {
  const status = STATUS_META[item.status]
  return <button type="button" className={`fleet-vehicle-card ${selected ? 'selected' : ''}`} onClick={onSelect}>
    <div className="fleet-card-head">
      <div><strong>{item.vehicle.plate_number}</strong><small>{item.vehicle.vehicle_name}</small></div>
      <span className={`fleet-status-badge ${status.tone}`}><i />{status.label}</span>
    </div>
    <div className="fleet-card-data">
      <span><Icon name="gauge" size={13} /><b>{item.state?.gps.speed_kph != null ? `${Math.round(item.state.gps.speed_kph)} km/h` : '—'}</b></span>
      <span><Icon name="user" size={13} /><b>{item.driver?.full_name || 'Chưa phân công'}</b></span>
      <span className="wide"><Icon name="pin" size={13} /><b>{item.state?.gps.address || coordinateLabel(item.state) || 'Chưa có vị trí'}</b></span>
    </div>
    <div className="fleet-card-foot">
      <span>{item.state?.gps.updated_at ? `Cập nhật ${formatDateTime(item.state.gps.updated_at)}` : item.error || 'Chưa có dữ liệu mới'}</span>
      {item.warnings.length > 0 && <b><Icon name="alert" size={12} /> {item.warnings.length}</b>}
    </div>
  </button>
}

// Helper chỉ để TypeScript suy ra cùng cấu trúc với fleetItems.
function makeItemShape(item: {
  vehicle: Vehicle
  state: NavicomVehicleState | null
  status: FleetStatus
  activeTrip: Trip | null
  driver?: { full_name: string } | null
  warnings: string[]
  error?: string
}) { return item }

function VehicleCommandDetail({ item }: { item: ReturnType<typeof makeItemShape> }) {
  const [cameraMode, setCameraMode] = useState<'both' | 'front' | 'cabin'>('both')
  const status = STATUS_META[item.status]
  const channels = (item.state?.channels ?? []).slice(0, 2)
  const front = channels[0] ?? null
  const cabin = channels[1] ?? null

  return <section className="panel fleet-detail-panel">
    <div className="fleet-detail-head">
      <div className="fleet-detail-identity">
        {item.vehicle.image_url ? <img src={item.vehicle.image_url} alt="" /> : <span><Icon name="bus" size={24} /></span>}
        <div><span>XE ĐANG THEO DÕI</span><h2>{item.vehicle.plate_number}</h2><p>{item.vehicle.vehicle_name} · {item.vehicle.vehicle_type}</p></div>
      </div>
      <span className={`fleet-status-badge large ${status.tone}`}><i />{status.label}</span>
    </div>

    <div className="fleet-detail-summary">
      <div><span>Tài xế</span><strong>{item.driver?.full_name || 'Chưa phân công'}</strong></div>
      <div><span>Tốc độ</span><strong>{item.state?.gps.speed_kph != null ? `${Math.round(item.state.gps.speed_kph)} km/h` : '—'}</strong></div>
      <div><span>Trạng thái máy</span><strong>{item.state?.gps.ignition == null ? '—' : item.state.gps.ignition ? 'Đang bật máy' : 'Đã tắt máy'}</strong></div>
      <div><span>Cập nhật</span><strong>{item.state?.gps.updated_at ? formatDateTime(item.state.gps.updated_at) : '—'}</strong></div>
    </div>

    {item.activeTrip && <div className="fleet-trip-strip"><Icon name="route" size={16} /><div><span>Chuyến hiện tại</span><strong>{item.activeTrip.pickup} → {item.activeTrip.destination}</strong></div></div>}

    {item.warnings.length > 0 && <div className="fleet-warning-strip"><Icon name="alert" size={16} /><div><strong>Cần chú ý</strong><span>{item.warnings.join(' · ')}</span></div></div>}

    <div className="fleet-camera-section">
      <div className="fleet-camera-heading">
        <div><span>CAMERA TRỰC TIẾP</span><h3>Camera trước & Camera cabin</h3><p>Có thể xem đồng thời cả 2 kênh.</p></div>
        <div className="fleet-camera-switch">
          <button type="button" className={cameraMode === 'both' ? 'active' : ''} onClick={() => setCameraMode('both')}>Cả 2</button>
          <button type="button" className={cameraMode === 'front' ? 'active' : ''} onClick={() => setCameraMode('front')}>Camera trước</button>
          <button type="button" className={cameraMode === 'cabin' ? 'active' : ''} onClick={() => setCameraMode('cabin')}>Camera cabin</button>
        </div>
      </div>
      <div className={`fleet-dual-camera mode-${cameraMode}`}>
        {(cameraMode === 'both' || cameraMode === 'front') && <CameraPanel channel={front} title="Camera trước" />}
        {(cameraMode === 'both' || cameraMode === 'cabin') && <CameraPanel channel={cabin} title="Camera cabin" />}
      </div>
    </div>
  </section>
}

function CameraPanel({ channel, title }: { channel: NavicomVehicleState['channels'][number] | null; title: string }) {
  return <article className="fleet-camera-card">
    <header><div><span className={`fleet-camera-dot ${channel?.online === false ? 'offline' : 'unknown'}`} /><strong>{title}</strong></div>{channel?.external_url && <a href={channel.external_url} target="_blank" rel="noreferrer">Mở riêng</a>}</header>
    <div className="fleet-camera-frame">
      {channel?.player_url ? <iframe title={title} src={channel.player_url} allow="autoplay; fullscreen" />
        : channel?.hls_url ? <video src={channel.hls_url} controls autoPlay muted playsInline />
          : channel?.snapshot_url ? <img src={channel.snapshot_url} alt={title} />
            : <div className="fleet-camera-unavailable"><Icon name="camera" size={24} /><strong>{title} chưa khả dụng</strong><span>Thiết bị có thể đang ngoại tuyến hoặc Gateway chưa trả URL video.</span></div>}
    </div>
  </article>
}

function FleetRealtimeMap({ items, selectedVehicleId, onSelect }: { items: Array<ReturnType<typeof makeItemShape>>; selectedVehicleId: string; onSelect: (id: string) => void }) {
  const located = items.filter((item) => item.state?.gps.lat != null && item.state?.gps.lng != null)
  if (!located.length) return <div className="fleet-map-empty"><Icon name="map" size={28} /><strong>Chưa có tọa độ GPS Navicom</strong><span>Khi thiết bị gửi GPS, xe sẽ xuất hiện trên bản đồ này.</span></div>

  const centerLat = located.reduce((sum, item) => sum + Number(item.state!.gps.lat), 0) / located.length
  const centerLng = located.reduce((sum, item) => sum + Number(item.state!.gps.lng), 0) / located.length
  const spread = Math.max(...located.map((item) => Math.max(Math.abs(Number(item.state!.gps.lat) - centerLat), Math.abs(Number(item.state!.gps.lng) - centerLng))))
  const zoom = spread > 0.08 ? 11 : spread > 0.03 ? 12 : spread > 0.012 ? 13 : 14
  const tileSize = 256
  const planeTiles = 5
  const planeSize = planeTiles * tileSize
  const centerWorld = project(centerLat, centerLng, zoom)
  const centerTileX = Math.floor(centerWorld.x / tileSize)
  const centerTileY = Math.floor(centerWorld.y / tileSize)
  const originTileX = centerTileX - 2
  const originTileY = centerTileY - 2
  const originWorldX = originTileX * tileSize
  const originWorldY = originTileY * tileSize
  const centerLocalX = centerWorld.x - originWorldX
  const centerLocalY = centerWorld.y - originWorldY

  return <div className="fleet-map-shell">
    <div className="fleet-map-viewport">
      <div className="fleet-map-plane" style={{ width: planeSize, height: planeSize, left: `calc(50% - ${centerLocalX}px)`, top: `calc(50% - ${centerLocalY}px)` }}>
        {Array.from({ length: planeTiles * planeTiles }, (_, index) => {
          const x = index % planeTiles
          const y = Math.floor(index / planeTiles)
          const tileX = originTileX + x
          const tileY = originTileY + y
          return <img key={`${tileX}-${tileY}`} className="fleet-map-tile" src={`https://tile.openstreetmap.org/${zoom}/${tileX}/${tileY}.png`} alt="" draggable={false} style={{ left: x * tileSize, top: y * tileSize }} />
        })}
        {located.map((item) => {
          const world = project(Number(item.state!.gps.lat), Number(item.state!.gps.lng), zoom)
          const left = world.x - originWorldX
          const top = world.y - originWorldY
          const status = STATUS_META[item.status]
          return <button type="button" key={item.vehicle.id} className={`fleet-map-marker ${status.tone} ${selectedVehicleId === item.vehicle.id ? 'selected' : ''}`} style={{ left, top }} onClick={() => onSelect(item.vehicle.id)} title={`${item.vehicle.plate_number} · ${status.label}`}>
            <span><Icon name="vehicle" size={15} /></span><b>{item.vehicle.plate_number}</b>
          </button>
        })}
      </div>
      <div className="fleet-map-legend"><span><i className="moving" /> Đang chạy</span><span><i className="stopped" /> Đang dừng</span><span><i className="offline" /> Mất tín hiệu</span></div>
      <small className="fleet-map-credit">© OpenStreetMap contributors</small>
    </div>
  </div>
}

function project(lat: number, lng: number, zoom: number) {
  const scale = 256 * Math.pow(2, zoom)
  const sin = Math.sin(lat * Math.PI / 180)
  return {
    x: (lng + 180) / 360 * scale,
    y: (0.5 - Math.log((1 + sin) / (1 - sin)) / (4 * Math.PI)) * scale,
  }
}

function vehicleWarnings(vehicle: Vehicle, status: FleetStatus) {
  const warnings: string[] = []
  const dates: Array<[string, string | null | undefined]> = [
    ['Đăng kiểm', vehicle.registration_expiry],
    ['Bảo hiểm TNDS', vehicle.insurance_expiry],
    ['Phí đường bộ', vehicle.road_fee_expiry],
    ['Bảo dưỡng', vehicle.next_maintenance_date],
  ]
  for (const [label, value] of dates) {
    if (!value) continue
    const days = Math.ceil((new Date(`${value}T23:59:59`).getTime() - Date.now()) / 86_400_000)
    if (days < 0) warnings.push(`${label} đã quá hạn`)
    else if (days <= 30) warnings.push(`${label} còn ${days} ngày`)
  }
  if (status === 'stale') warnings.push('GPS cập nhật chậm')
  return warnings
}
