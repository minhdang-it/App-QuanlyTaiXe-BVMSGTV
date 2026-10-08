import { FleetVehicleCard } from '../components/FleetVehicleCard'
import { FleetSmoothMap } from '../components/FleetSmoothMap'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useData } from '../context/DataContext'
import { Icon } from '../components/Icon'
import { fetchNavicomVehicleState, type NavicomVehicleState } from '../lib/navicom'
import { NAVICOM_FLEET_EVENT, classifyNavicomState, coordinateLabel, loadNavicomEvents, type FleetEvent, type FleetStatus } from '../lib/navicomFleet'
import { formatDateTime } from '../lib/utils'
import { consumeNavigationFocus, NAVIGATION_FOCUS_EVENT } from '../lib/focusNavigation'
import { enterLandscapeFullscreen, exitLandscapeFullscreen, fullscreenElement } from '../lib/cameraFullscreen'
import type { Trip, Vehicle } from '../types/models'

const POLL_MS = 5_000
type FilterKey = 'all' | 'online' | 'moving' | 'stopped' | 'offline' | 'warning'
type VehicleStateMap = Record<string, NavicomVehicleState | null>

const STATUS_META: Record<FleetStatus, { label: string; tone: string }> = {
  moving: { label: 'Đang chạy', tone: 'moving' },
  stopped: { label: 'Đang dừng', tone: 'stopped' },
  stale: { label: 'Chậm cập nhật', tone: 'stale' },
  offline: { label: 'Offline', tone: 'offline' },
  unknown: { label: 'Chưa có dữ liệu', tone: 'unknown' },
}

export function TrackingPage() {
  const { data } = useData()
  const vehicles = useMemo(() => data.vehicles.filter((vehicle) => vehicle.navicom_enabled && vehicle.navicom_device_id?.trim()), [data.vehicles])
  const [states, setStates] = useState<VehicleStateMap>({})
  const previousStatesRef = useRef<VehicleStateMap>({})
  const [liveStatuses, setLiveStatuses] = useState<Record<string, FleetStatus>>({})
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [filter, setFilter] = useState<FilterKey>('all')
  const [search, setSearch] = useState('')
  const [selectedVehicleId, setSelectedVehicleId] = useState<string>(() => vehicles[0]?.id ?? '')
  const [events, setEvents] = useState<FleetEvent[]>(() => loadNavicomEvents().filter((event) => event.type !== 'offline'))
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
    const handleFleetEvent = () => setEvents(loadNavicomEvents().filter((event) => event.type !== 'offline'))
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
      const priorStates = previousStatesRef.current
      setLiveStatuses((current) => {
        const next = { ...current }
        for (const entry of entries) {
          if (entry.state) next[entry.vehicle.id] = classifyNavicomState(entry.state, priorStates[entry.vehicle.id] ?? null)
          else if (entry.error) next[entry.vehicle.id] = current[entry.vehicle.id] ?? 'offline'
        }
        return next
      })
      const nextPrevious = { ...priorStates }
      for (const entry of entries) if (entry.state) nextPrevious[entry.vehicle.id] = entry.state
      previousStatesRef.current = nextPrevious
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
    const status = errors[vehicle.id] ? (liveStatuses[vehicle.id] ?? 'offline') as FleetStatus : (liveStatuses[vehicle.id] ?? classifyNavicomState(state))
    const activeTrip = data.trips.find((trip) => trip.vehicle_id === vehicle.id && ['assigned', 'accepted', 'ready', 'active'].includes(trip.status)) ?? null
    const driverId = activeTrip?.driver_id || vehicle.regular_driver_id
    const driver = data.profiles.find((profile) => profile.id === driverId)
    const warnings = vehicleWarnings(vehicle, status)
    return { vehicle, state, status, activeTrip, driver, warnings, error: errors[vehicle.id] }
  }), [data.profiles, data.trips, errors, liveStatuses, states, vehicles])

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
    }).sort((a, b) => {
      const priority = fleetListPriority(a.status) - fleetListPriority(b.status)
      if (priority !== 0) return priority
      const aTime = new Date(a.state?.gps.updated_at || a.state?.updated_at || 0).getTime() || 0
      const bTime = new Date(b.state?.gps.updated_at || b.state?.updated_at || 0).getTime() || 0
      if (aTime !== bTime) return bTime - aTime
      return a.vehicle.plate_number.localeCompare(b.vehicle.plate_number, 'vi')
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
      <FleetMetric icon="cloud-off" label="Xe offline" value={metrics.offline} tone="offline" />
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
            ['stopped', 'Đang dừng', metrics.stopped], ['offline', 'Offline', metrics.offline], ['warning', 'Cảnh báo', metrics.warnings],
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
  return <FleetVehicleCard item={item} selected={selected} onSelect={onSelect} />
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
  const cameraDeviceOnline = (item.status === 'moving' || item.status === 'stopped') && !item.error
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
        {(cameraMode === 'both' || cameraMode === 'front') && <CameraPanel channel={front} title="Camera trước" vehicleOnline={cameraDeviceOnline} />}
        {(cameraMode === 'both' || cameraMode === 'cabin') && <CameraPanel channel={cabin} title="Camera cabin" vehicleOnline={cameraDeviceOnline} />}
      </div>
    </div>
  </section>
}

function CameraPanel({ channel, title, vehicleOnline }: { channel: NavicomVehicleState['channels'][number] | null; title: string; vehicleOnline: boolean }) {
  const cardRef = useRef<HTMLElement | null>(null)
  const [expanded, setExpanded] = useState(false)
  const [forceLandscape, setForceLandscape] = useState(false)

  useEffect(() => {
    if (!expanded) return
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const handleFullscreen = () => {
      if (!fullscreenElement()) {
        setExpanded(false)
        setForceLandscape(false)
      }
    }
    document.addEventListener('fullscreenchange', handleFullscreen)
    document.addEventListener('webkitfullscreenchange', handleFullscreen as EventListener)
    return () => {
      document.body.style.overflow = previousOverflow
      document.removeEventListener('fullscreenchange', handleFullscreen)
      document.removeEventListener('webkitfullscreenchange', handleFullscreen as EventListener)
    }
  }, [expanded])

  const toggleFullscreen = async () => {
    if (expanded) {
      await exitLandscapeFullscreen()
      setExpanded(false)
      setForceLandscape(false)
      return
    }
    setExpanded(true)
    const element = cardRef.current
    if (!element) return
    const result = await enterLandscapeFullscreen(element)
    // Chrome/Android thường khóa ngang được. Safari/iPhone dùng lớp xoay giao diện dự phòng.
    setForceLandscape(!result.orientationLocked)
  }

  return <article ref={cardRef} className={`fleet-camera-card ${expanded ? 'camera-landscape-expanded' : ''} ${forceLandscape ? 'camera-force-landscape' : ''}`}>
    <header>
      <div><span className={`fleet-camera-dot ${channel?.online === false ? 'offline' : channel?.online === true ? 'online' : 'unknown'}`} /><strong>{title}</strong></div>
      <div className="fleet-camera-actions">
        {vehicleOnline && channel?.online !== false && channel?.external_url && <a href={channel.external_url} target="_blank" rel="noreferrer">Mở riêng</a>}
        <button type="button" onClick={() => void toggleFullscreen()}>{expanded ? 'Thoát' : 'Phóng to ngang'}</button>
      </div>
    </header>
    <div className={`fleet-camera-frame ${!vehicleOnline || channel?.online === false ? 'is-offline' : ''}`}>
      {!vehicleOnline ? <div className="fleet-camera-offline"><span><Icon name="cloud-off" size={26} /></span><strong>Xe đang offline</strong><small>Camera tạm ngưng để tránh mở trang Navicom khi thiết bị ngoại tuyến.</small></div>
        : channel?.online === false ? <div className="fleet-camera-offline"><span><Icon name="cloud-off" size={26} /></span><strong>Kênh camera ngoại tuyến</strong><small>GPS xe vẫn có thể hoạt động nhưng kênh camera này chưa sẵn sàng.</small></div>
          : channel?.player_url ? <iframe title={title} src={channel.player_url} allow="autoplay; fullscreen; picture-in-picture" />
            : channel?.hls_url ? <video src={channel.hls_url} controls autoPlay muted playsInline />
              : channel?.snapshot_url ? <img src={channel.snapshot_url} alt={title} />
                : <div className="fleet-camera-unavailable"><Icon name="camera" size={24} /><strong>{title} chưa khả dụng</strong><span>Gateway chưa cung cấp URL video.</span></div>}
    </div>
    {expanded && forceLandscape && <div className="camera-rotate-hint">Đang hiển thị ngang để xem camera rõ hơn</div>}
  </article>
}

function FleetRealtimeMap({ items, selectedVehicleId, onSelect }: { items: Array<ReturnType<typeof makeItemShape>>; selectedVehicleId: string; onSelect: (id: string) => void }) {
  return <FleetTileMap items={items} selectedVehicleId={selectedVehicleId} onSelect={onSelect} />
}

function FleetTileMap({ items, selectedVehicleId, onSelect }: { items: Array<ReturnType<typeof makeItemShape>>; selectedVehicleId: string; onSelect: (id: string) => void }) {
  return <FleetSmoothMap items={items} selectedVehicleId={selectedVehicleId} onSelect={onSelect} />
}

function fleetListPriority(status: FleetStatus) {
  if (status === 'moving') return 0
  if (status === 'stopped') return 1
  if (status === 'stale') return 2
  if (status === 'offline') return 3
  return 4
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
