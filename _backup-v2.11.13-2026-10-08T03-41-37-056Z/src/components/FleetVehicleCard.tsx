import { useCallback, useEffect, useRef, useState, type CSSProperties } from 'react'
import { createPortal } from 'react-dom'
import { Icon } from './Icon'
import { formatDateTime } from '../lib/utils'

type FleetStatus = 'moving' | 'stopped' | 'stale' | 'offline' | 'unknown'

type DriverInfo = {
  full_name: string
  phone?: string | null
  department?: string | null
  job_title?: string | null
  employee_code?: string | null
  avatar_url?: string | null
  active?: boolean
}

type FleetItem = {
  vehicle: { id: string; plate_number: string; vehicle_name: string }
  state?: {
    gps: {
      speed_kph?: number | null
      lat?: number | null
      lng?: number | null
      address?: string | null
      updated_at?: string | null
    }
    updated_at?: string | null
  } | null
  status: FleetStatus
  driver?: DriverInfo | null
  error?: string | null
  effectiveSpeedKph?: number | null
  warnings?: string[]
}

type Props = { item: FleetItem; selected: boolean; onSelect: () => void }
type Viewer = 'speed' | 'driver' | null

const statusConfig: Record<FleetStatus, { label: string; tone: string }> = {
  moving: { label: 'Đang chạy', tone: 'moving' },
  stopped: { label: 'Đang dừng', tone: 'stopped' },
  stale: { label: 'Chậm cập nhật', tone: 'stale' },
  offline: { label: 'Offline', tone: 'offline' },
  unknown: { label: 'Chưa có dữ liệu', tone: 'unknown' },
}

function validCoordinate(value: unknown, maxAbs: number): value is number {
  return typeof value === 'number' && Number.isFinite(value) && Math.abs(value) <= maxAbs
}

function gpsMapsLink(lat: number, lng: number): string {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${lat.toFixed(6)},${lng.toFixed(6)}`)}`
}

function displayDate(value?: string | null): string {
  if (!value) return 'Chưa có dữ liệu'
  const date = new Date(value)
  if (!Number.isFinite(date.getTime())) return 'Chưa có dữ liệu'
  return formatDateTime(value)
}

function formatPhone(value?: string | null): string {
  return value?.trim() || 'Chưa cập nhật'
}

function ViewerDialog({
  item,
  type,
  onClose,
}: {
  item: FleetItem
  type: Exclude<Viewer, null>
  onClose: () => void
}) {
  const closeButton = useRef<HTMLButtonElement | null>(null)
  const headingId = `fleet-viewer-${item.vehicle.id}-${type}`
  const gps = item.state?.gps
  const currentSpeed = Number(item.effectiveSpeedKph ?? gps?.speed_kph)
  const speedKnown = Number.isFinite(currentSpeed) && (item.effectiveSpeedKph != null || gps?.speed_kph != null)
  const speed = speedKnown ? Math.max(0, currentSpeed) : null
  const isLive = item.status === 'moving' || item.status === 'stopped'
  const driver = item.driver
  const markerValue = speed == null ? 0 : Math.min(100, speed / 140 * 100)

  useEffect(() => {
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null
    closeButton.current?.focus()
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('keydown', onKeyDown)
      document.body.style.overflow = previousOverflow
      previousFocus?.focus()
    }
  }, [onClose])

  return createPortal(
    <div className="fleet-card-dialog-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose() }}>
      <section className="fleet-card-dialog" role="dialog" aria-modal="true" aria-labelledby={headingId}>
        <header className="fleet-card-dialog-head">
          <div>
            <small>{type === 'speed' ? 'GIÁM SÁT TỐC ĐỘ NAVICOM' : 'HỒ SƠ TÀI XẾ'}</small>
            <h2 id={headingId}>{type === 'speed' ? `Xe ${item.vehicle.plate_number}` : (driver?.full_name || 'Chưa phân công tài xế')}</h2>
          </div>
          <button ref={closeButton} type="button" className="fleet-card-dialog-close" onClick={onClose} aria-label="Đóng cửa sổ"><Icon name="x" size={20} /></button>
        </header>
        {type === 'speed' ? <>
          <div className={`fleet-speed-status ${isLive ? 'is-live' : 'is-stale'}`}>
            <span className="fleet-live-indicator" />
            {isLive ? 'Đang nhận GPS Navicom' : 'Xe offline / GPS chưa cập nhật – dữ liệu cuối cùng'}
          </div>
          <div className="fleet-speed-dial" style={{ '--fleet-speed-fill': `${markerValue}%` } as CSSProperties}>
            <div className="fleet-speed-dial-inner">
              <strong>{speed == null ? '—' : Math.round(speed)}</strong>
              <span>km/h</span>
            </div>
          </div>
          <div className="fleet-speed-details">
            <div><span>Trạng thái xe</span><strong>{statusConfig[item.status].label}</strong></div>
            <div><span>GPS cập nhật</span><strong>{displayDate(gps?.updated_at || item.state?.updated_at)}</strong></div>
          </div>
          <p className="fleet-speed-footnote">Số liệu lấy từ Navicom và tự cập nhật theo chu kỳ làm mới của trang Theo dõi xe (khoảng 5 giây). Khi xe offline, giá trị hiển thị là lần ghi nhận gần nhất.</p>
        </> : <>
          <div className="fleet-driver-top">
            {driver?.avatar_url ? <img src={driver.avatar_url} alt="Ảnh tài xế" /> : <div className="fleet-driver-avatar"><Icon name="user" size={28} /></div>}
            <div><strong>{driver?.full_name || 'Chưa phân công tài xế'}</strong><span>{driver?.job_title || 'Tài xế'}</span></div>
          </div>
          <dl className="fleet-driver-fields">
            <div><dt>Xe phụ trách</dt><dd>{item.vehicle.plate_number} · {item.vehicle.vehicle_name}</dd></div>
            <div><dt>Bộ phận</dt><dd>{driver?.department || 'Chưa cập nhật'}</dd></div>
            <div><dt>Mã nhân viên</dt><dd>{driver?.employee_code || 'Chưa cập nhật'}</dd></div>
            <div><dt>Số điện thoại</dt><dd>{formatPhone(driver?.phone)}</dd></div>
          </dl>
          {driver?.phone && <a className="fleet-driver-call" href={`tel:${driver.phone.replace(/[^0-9+]/g, '')}`}><Icon name="phone" size={17} /> Gọi tài xế</a>}
          {!driver && <p className="fleet-speed-footnote">Chưa có tài xế được phân công cho xe này hoặc hồ sơ chưa được đồng bộ.</p>}
        </>}
      </section>
    </div>, document.body,
  )
}

export function FleetVehicleCard({ item, selected, onSelect }: Props) {
  const [viewer, setViewer] = useState<Viewer>(null)
  const closeViewer = useCallback(() => setViewer(null), [])
  const status = statusConfig[item.status]
  const gps = item.state?.gps
  const speed = item.effectiveSpeedKph ?? gps?.speed_kph
  const hasValidSpeed = typeof speed === 'number' && Number.isFinite(speed)
  const latitude = gps?.lat
  const longitude = gps?.lng
  const hasLocation = validCoordinate(latitude, 90) && validCoordinate(longitude, 180)
  const location = hasLocation ? `${latitude.toFixed(6)}, ${longitude.toFixed(6)}` : ''
  const mapsUrl = hasLocation ? gpsMapsLink(latitude, longitude) : ''
  const address = gps?.address?.trim()
  const updatedAt = gps?.updated_at || item.state?.updated_at
  const lastSeen = displayDate(updatedAt)

  return <>
    <article className={`fleet-vehicle-card fleet-action-vehicle-card ${selected ? 'selected' : ''}`} role="group" tabIndex={0} onClick={onSelect} onKeyDown={(event) => { if (event.target === event.currentTarget && (event.key === 'Enter' || event.key === ' ')) { event.preventDefault(); onSelect() } }}>
      <div className="fleet-card-head">
        <div><strong>{item.vehicle.plate_number}</strong><small>{item.vehicle.vehicle_name}</small></div>
        <span className={`fleet-status-badge ${status.tone}`}><i />{status.label}</span>
      </div>
      <div className="fleet-card-data fleet-card-action-grid">
        <button type="button" className="fleet-data-action" onClick={(event) => { event.stopPropagation(); setViewer('speed') }} title="Mở đồng hồ tốc độ lớn" aria-label={`Xem tốc độ xe ${item.vehicle.plate_number}`}>
          <Icon name="gauge" size={15} /> <b>{hasValidSpeed ? `${Math.round(speed)} km/h` : '— km/h'}</b>
          <Icon name="arrow-right" size={12} />
        </button>
        <button type="button" className="fleet-data-action" onClick={(event) => { event.stopPropagation(); setViewer('driver') }} title="Xem thông tin tài xế" aria-label={`Xem thông tin tài xế xe ${item.vehicle.plate_number}`}>
          <Icon name="user" size={15} /><b>{item.driver?.full_name || 'Chưa phân công'}</b>
          <Icon name="chevron-right" size={12} />
        </button>
        {hasLocation ? <a className="fleet-data-action fleet-data-location wide" href={mapsUrl} target="_blank" rel="noopener noreferrer" onClick={(event) => event.stopPropagation()} title={`Mở ${address || location} trên Google Maps`} aria-label={`Mở vị trí xe ${item.vehicle.plate_number} trên Google Maps`}>
          <Icon name="pin" size={15} /><b>{location}</b><Icon name="arrow-right" size={12} />
        </a> : <span className="fleet-data-action fleet-data-disabled wide"><Icon name="pin" size={15} /><b>Chưa có tọa độ</b></span>}
      </div>
      <div className="fleet-card-foot">
        <span>{updatedAt ? `Cập nhật ${lastSeen}` : (item.error || 'Chưa có dữ liệu mới')}</span>
        {(item.warnings?.length || 0) > 0 && <b className="fleet-card-warning"><Icon name="alert" size={12} /> {item.warnings?.length}</b>}
      </div>
    </article>
    {viewer && <ViewerDialog item={item} type={viewer} onClose={closeViewer} />}
  </>
}
