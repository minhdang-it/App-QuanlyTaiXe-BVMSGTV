import { useEffect, useMemo, useRef, useState } from 'react'
import { Icon, iconFromEmoji } from '../components/Icon'
import { useAuth } from '../context/AuthContext'
import { useData } from '../context/DataContext'
import { ADHOC_REPORT_LABELS, EXPENSE_ICONS, EXPENSE_LABELS, INCIDENT_LABELS, PURPOSE_LABELS } from '../lib/constants'
import { daysUntil, formatCurrency, formatDate, formatDateTime, getSuggestedSecureUrl, googleMapsDirectionsUrl, googleMapsLocationUrl, isTrustedWebContext, requestCurrentLocation, safeNumber, toDateTimeLocal, todayKey, type ConfirmedLocation } from '../lib/utils'
import type { CreateAdhocTripInput, DriverVehicleTrackingUpdate, ExpenseType, IncidentType, Profile, Severity, Trip, TripPurpose, UpdateUserInput, Vehicle } from '../types/models'
import { Modal } from '../components/Modal'
import { MediaInput } from '../components/MediaInput'
import { StatusBadge } from '../components/StatusBadge'
import { NetworkBanner } from '../components/NetworkBanner'
import { EmptyState } from '../components/EmptyState'
import { AudioRecorder } from '../components/AudioRecorder'
import { readOdometerFromImage, type OdometerOcrResult } from '../lib/odometerOcr'
import { isGeminiOdometerAvailable, readOdometerWithGemini, type GeminiOdometerResult } from '../lib/odometerGemini'
import { NotificationCenter } from '../components/NotificationCenter'
import { useNotifications } from '../context/NotificationContext'
import { VietnamDateInput } from '../components/VietnamDateInput'
import { hasBlockingVehicleIssue, vehicleReadinessIssues } from '../lib/operationalInsights'

const coordinatorPhone = import.meta.env.VITE_COORDINATOR_PHONE || '0900000000'
const ODOMETER_AUTO_READ_KEY = 'bvmsgtv_odometer_auto_read'

function getSavedOdometerAutoRead() {
  try {
    return window.localStorage.getItem(ODOMETER_AUTO_READ_KEY) === 'true'
  } catch {
    return false
  }
}

type Dialog = 'checklist' | 'odometer' | 'startTrip' | 'expense' | 'incident' | 'trip' | 'profile' | 'vehicleTracking' | 'adhoc' | null
type DriverLocationPermission = 'checking' | 'granted' | 'prompt' | 'denied' | 'unsupported'

export function DriverPage() {
  const { user, logout, mode, refreshUser } = useAuth()
  const { data, loading, online, pending, syncNow, createChecklist, submitOdometer, createExpense, createIncident, createAdhocTrip, updateTrip, updateTripLocation, updateUser, changeOwnPassword, updateDriverVehicleTracking } = useData()
  const { browserPermission, requestBrowserPermission, refreshBrowserPermission } = useNotifications()
  const [dialog, setDialog] = useState<Dialog>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [locationPermission, setLocationPermission] = useState<DriverLocationPermission>('checking')
  const [permissionBusy, setPermissionBusy] = useState<'location' | 'notification' | null>(null)
  const secureContextReady = isTrustedWebContext()
  const driverSetupReady = secureContextReady && locationPermission === 'granted' && browserPermission === 'granted'

  async function checkLocationPermission() {
    if (!secureContextReady || !navigator.geolocation) {
      setLocationPermission(navigator.geolocation ? 'prompt' : 'unsupported')
      return
    }
    if (!navigator.permissions?.query) {
      setLocationPermission((current) => current === 'granted' ? 'granted' : 'prompt')
      return
    }
    try {
      const status = await navigator.permissions.query({ name: 'geolocation' })
      setLocationPermission(status.state as DriverLocationPermission)
      status.onchange = () => setLocationPermission(status.state as DriverLocationPermission)
    } catch {
      setLocationPermission('prompt')
    }
  }

  async function enableDriverLocation() {
    setPermissionBusy('location')
    setMessage(null)
    try {
      await requestCurrentLocation()
      setLocationPermission('granted')
      setMessage('Đã bật vị trí GPS cho ứng dụng tài xế.')
    } catch (error) {
      await checkLocationPermission()
      setMessage(error instanceof Error ? error.message : String(error))
    } finally {
      setPermissionBusy(null)
    }
  }

  async function enableDriverNotifications() {
    setPermissionBusy('notification')
    setMessage(null)
    try {
      const permission = await requestBrowserPermission()
      if (permission === 'granted') {
        if ('serviceWorker' in navigator) {
          try {
            const registration = await navigator.serviceWorker.ready
            await registration.showNotification('Thông báo tài xế đã được bật', {
              body: 'Ứng dụng sẽ cảnh báo khi có chuyến mới hoặc chuyến bị thay đổi.',
              icon: '/icons/icon-192.png',
              badge: '/icons/icon-192.png',
              tag: 'driver-notification-enabled',
              vibrate: [180, 80, 180],
            } as NotificationOptions & { vibrate?: number[] })
          } catch {
            // Quyền đã được cấp; thông báo thử có thể bị trình duyệt hạn chế.
          }
        }
        setMessage('Đã bật thông báo chuyến xe trên thiết bị.')
      } else if (permission === 'denied') {
        setMessage('Thông báo đang bị chặn. Hãy mở Cài đặt trang web → Thông báo → Cho phép, sau đó bấm Kiểm tra lại.')
      } else {
        setMessage('Trình duyệt hiện tại không hỗ trợ thông báo hoặc website chưa chạy bằng HTTPS.')
      }
    } finally {
      setPermissionBusy(null)
    }
  }

  async function recheckDriverPermissions() {
    refreshBrowserPermission()
    await checkLocationPermission()
  }

  useEffect(() => {
    void checkLocationPermission()
    const refresh = () => { void recheckDriverPermissions() }
    window.addEventListener('focus', refresh)
    document.addEventListener('visibilitychange', refresh)
    return () => {
      window.removeEventListener('focus', refresh)
      document.removeEventListener('visibilitychange', refresh)
    }
  }, [secureContextReady])

  const trips = useMemo(() => data.trips
    .filter((trip) => trip.driver_id === user!.id && trip.status !== 'cancelled')
    .sort((a, b) => new Date(a.scheduled_start).getTime() - new Date(b.scheduled_start).getTime()), [data.trips, user])

  // Ưu tiên chuyến đang chạy/sẵn sàng để không bị chuyến giao sau (hoặc chuyến đột xuất) che mất.
  const currentTrip = trips.find((trip) => trip.status === 'active')
    ?? trips.find((trip) => trip.status === 'ready')
    ?? trips.find((trip) => ['assigned', 'accepted'].includes(trip.status))
    ?? null
  const canCreateAdhoc = !currentTrip || !['ready', 'active'].includes(currentTrip.status)
  const recentAdhocTrips = trips.filter((trip) => trip.is_adhoc).sort((a, b) => new Date(b.scheduled_start).getTime() - new Date(a.scheduled_start).getTime()).slice(0, 5)
  const todayCompleted = trips.filter((trip) => trip.status === 'completed' && todayKey(new Date(trip.ended_at ?? trip.updated_at)) === todayKey())
  const vehicle = data.vehicles.find((item) => item.id === currentTrip?.vehicle_id) ?? data.vehicles.find((item) => item.regular_driver_id === user!.id) ?? null
  const readinessIssues = useMemo(() => vehicleReadinessIssues(vehicle), [vehicle])
  const blockingVehicleIssue = useMemo(() => hasBlockingVehicleIssue(vehicle), [vehicle])

  useEffect(() => {
    if (!driverSetupReady || !currentTrip || currentTrip.status !== 'assigned' || !('serviceWorker' in navigator)) return
    const alertKey = `driver-trip-alerted:${currentTrip.id}:${currentTrip.updated_at}`
    if (localStorage.getItem(alertKey)) return
    localStorage.setItem(alertKey, new Date().toISOString())
    void navigator.serviceWorker.ready.then((registration) => registration.showNotification('Bạn có chuyến xe mới cần xác nhận', {
      body: `${currentTrip.pickup} → ${currentTrip.destination}. Bấm vào ứng dụng để nhận chuyến.`,
      icon: '/icons/icon-192.png',
      badge: '/icons/icon-192.png',
      tag: `driver-trip-${currentTrip.id}`,
      requireInteraction: true,
      vibrate: [350, 120, 350, 120, 600],
      data: { url: window.location.href },
    } as NotificationOptions & { vibrate?: number[] })).catch(() => undefined)
    if ('vibrate' in navigator) navigator.vibrate([350, 120, 350, 120, 600])
  }, [currentTrip?.id, currentTrip?.status, currentTrip?.updated_at, currentTrip?.pickup, currentTrip?.destination, driverSetupReady])


  const lastLocationSentRef = useRef<{ lat: number; lng: number; time: number } | null>(null)

  useEffect(() => {
    if (!currentTrip || currentTrip.status !== 'active' || !navigator.geolocation || !secureContextReady) return
    let stopped = false
    let sending = false
    let fallbackTimer: number | undefined

    const distanceMeters = (aLat: number, aLng: number, bLat: number, bLng: number) => {
      const radius = 6_371_000
      const toRadians = (value: number) => value * Math.PI / 180
      const dLat = toRadians(bLat - aLat)
      const dLng = toRadians(bLng - aLng)
      const lat1 = toRadians(aLat)
      const lat2 = toRadians(bLat)
      const haversine = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2
      return 2 * radius * Math.asin(Math.sqrt(haversine))
    }

    const submitPosition = async (lat: number, lng: number, force = false) => {
      if (stopped || sending) return
      const now = Date.now()
      const previous = lastLocationSentRef.current
      const elapsed = previous ? now - previous.time : Number.POSITIVE_INFINITY
      const moved = previous ? distanceMeters(previous.lat, previous.lng, lat, lng) : Number.POSITIVE_INFINITY
      const shouldSend = force || !previous || (elapsed >= 12_000 && moved >= 8) || elapsed >= 45_000
      if (!shouldSend) return

      sending = true
      try {
        await updateTripLocation(currentTrip.id, lat, lng)
        lastLocationSentRef.current = { lat, lng, time: Date.now() }
      } catch {
        // Giữ ứng dụng hoạt động; lần cập nhật kế tiếp sẽ thử lại.
      } finally {
        sending = false
      }
    }

    const watchId = navigator.geolocation.watchPosition(
      (position) => void submitPosition(position.coords.latitude, position.coords.longitude),
      () => undefined,
      { enableHighAccuracy: true, maximumAge: 5_000, timeout: 20_000 },
    )

    void requestCurrentLocation()
      .then((position) => submitPosition(position.lat, position.lng, true))
      .catch(() => undefined)

    fallbackTimer = window.setInterval(() => {
      void requestCurrentLocation()
        .then((position) => submitPosition(position.lat, position.lng, true))
        .catch(() => undefined)
    }, 60_000)

    return () => {
      stopped = true
      navigator.geolocation.clearWatch(watchId)
      if (fallbackTimer) window.clearInterval(fallbackTimer)
    }
  }, [currentTrip?.id, currentTrip?.status, secureContextReady, updateTripLocation])

  async function guarded(work: () => Promise<void>, success: string) {
    setSaving(true)
    setMessage(null)
    try {
      await work()
      setMessage(success)
      setDialog(null)
    } catch (err) {
      setMessage(err instanceof Error ? err.message : String(err))
    } finally {
      setSaving(false)
    }
  }

  async function startTrip(location: ConfirmedLocation) {
    if (!currentTrip) return

    const navigationUrl = googleMapsDirectionsUrl(currentTrip.destination, location)
    const mapsWindow = window.open('', '_blank')
    if (mapsWindow) {
      mapsWindow.document.title = 'Đang mở Google Maps'
      mapsWindow.document.body.innerHTML = '<p style="font-family:system-ui;padding:24px">Đang bắt đầu chuyến và mở Google Maps...</p>'
    }

    setSaving(true)
    setMessage(null)
    try {
      await updateTrip(currentTrip.id, {
        status: 'active',
        started_at: new Date().toISOString(),
        start_lat: location.lat,
        start_lng: location.lng,
        current_lat: location.lat,
        current_lng: location.lng,
        location_updated_at: new Date().toISOString(),
      })
      setDialog(null)
      setMessage('Đã bắt đầu chuyến. Google Maps đang được mở để dẫn đường.')

      if (mapsWindow) mapsWindow.location.replace(navigationUrl)
      else window.location.assign(navigationUrl)
    } catch (err) {
      mapsWindow?.close()
      setMessage(err instanceof Error ? err.message : String(err))
    } finally {
      setSaving(false)
    }
  }

  async function primaryTripAction() {
    if (!driverSetupReady) return setMessage('Cần hoàn tất bật HTTPS, GPS và thông báo trước khi thao tác chuyến xe.')
    if (!currentTrip) return setMessage('Hiện chưa có chuyến được giao.')
    if (currentTrip.status === 'assigned') {
      await guarded(async () => { await updateTrip(currentTrip.id, { status: 'accepted' }) }, 'Đã xác nhận nhận chuyến.')
      return
    }
    if (!currentTrip.checklist_completed) return setDialog('checklist')
    if (currentTrip.status === 'accepted' && currentTrip.checklist_completed) return setMessage('Checklist có mục Không. Vui lòng chờ điều phối xác nhận trước khi xuất phát.')
    if (currentTrip.start_odometer == null) return setDialog('odometer')
    if (currentTrip.status !== 'active') {
      if (blockingVehicleIssue) setMessage('Xe có cảnh báo nghiêm trọng về trạng thái, đăng kiểm hoặc bảo hiểm. Vui lòng kiểm tra trước khi xuất phát.')
      return setDialog('startTrip')
    }
    if (currentTrip.end_odometer == null) return setDialog('odometer')
    await guarded(async () => { await updateTrip(currentTrip.id, { status: 'completed', ended_at: new Date().toISOString() }) }, 'Chuyến đi đã hoàn thành.')
  }

  function primaryLabel() {
    if (!currentTrip) return 'Chưa có chuyến'
    if (currentTrip.status === 'assigned') return 'Nhận chuyến'
    if (!currentTrip.checklist_completed) return 'Checklist trước khi đi'
    if (currentTrip.status === 'accepted' && currentTrip.checklist_completed) return 'Chờ Điều phối duyệt'
    if (currentTrip.start_odometer == null) return 'Chụp KM đầu'
    if (currentTrip.status !== 'active') return 'Bắt đầu chuyến'
    if (currentTrip.end_odometer == null) return 'Chụp KM cuối'
    return 'Kết thúc chuyến'
  }

  return (
    <main className={`driver-app ${currentTrip?.status === 'active' ? 'driver-active-mode' : ''}`}>
      <NetworkBanner />
      <header className="driver-header">
        <div className="driver-header-row">
          <span className="driver-header-logo"><img src="/logo-bvmsgtv-v201.png" alt="Bệnh viện Mắt Sài Gòn Trà Vinh" /></span>
          <div className="driver-header-greeting">
            <small>{new Intl.DateTimeFormat('vi-VN', { weekday: 'long', day: '2-digit', month: '2-digit' }).format(new Date())}</small>
            <strong>Xin chào, {user?.profile.full_name.split(' ').slice(-1)[0]}</strong>
          </div>
          <NotificationCenter compact />
          <button className="driver-account-button" onClick={() => setDialog('profile')} aria-label="Mở hồ sơ cá nhân">
            {user?.profile.avatar_url
              ? <img src={user.profile.avatar_url} alt="" />
              : user?.profile.full_name.slice(0, 1).toUpperCase()}
          </button>
        </div>
      </header>

      {!driverSetupReady ? <DriverPermissionGate
        secure={secureContextReady}
        secureUrl={getSuggestedSecureUrl()}
        locationPermission={locationPermission}
        notificationPermission={browserPermission}
        busy={permissionBusy}
        message={message}
        onEnableLocation={() => void enableDriverLocation()}
        onEnableNotifications={() => void enableDriverNotifications()}
        onRecheck={() => void recheckDriverPermissions()}
      /> : <section className="driver-content">

        {message && <button type="button" className="driver-toast" onClick={() => setMessage(null)}><span>{message}</span><strong><Icon name="x" size={16} /></strong></button>}

        {(!online || pending > 0) && <section className={`driver-sync-card ${online ? 'pending' : 'offline'}`}>
          <span><Icon name={online ? 'refresh' : 'cloud-off'} size={18} /></span>
          <div><strong>{online ? `${pending} thao tác chờ đồng bộ` : 'Đang làm việc ngoại tuyến'}</strong><small>{online ? 'Dữ liệu đã lưu tạm trên máy và sẵn sàng gửi lên server.' : 'KM, chi phí và sự cố sẽ được lưu tạm, tự đồng bộ khi có mạng.'}</small></div>
          {online && pending > 0 && <button type="button" onClick={() => void syncNow()}>Đồng bộ</button>}
        </section>}

        {currentTrip && <section className="driver-trip-progress">
          <div className={currentTrip.status === 'assigned' ? 'current' : 'done'}><span>1</span><small>Nhận chuyến</small></div>
          <i />
          <div className={['accepted','ready'].includes(currentTrip.status) ? 'current' : ['active','completed'].includes(currentTrip.status) ? 'done' : ''}><span>2</span><small>Chuẩn bị</small></div>
          <i />
          <div className={currentTrip.status === 'active' ? 'current' : currentTrip.status === 'completed' ? 'done' : ''}><span>3</span><small>Đang chạy</small></div>
          <i />
          <div className={currentTrip.status === 'completed' ? 'done' : ''}><span>4</span><small>Hoàn tất</small></div>
        </section>}

        {loading ? <div className="driver-trip-card skeleton-card" /> : currentTrip ? (
          <article className="driver-trip-card driver-trip-card-modern" onClick={() => setDialog('trip')}>
            <div className="trip-card-top"><span>{currentTrip.is_adhoc ? 'Chuyến đột xuất' : 'Chuyến đang phụ trách'}</span><StatusBadge status={currentTrip.status} /></div>
            <div className="driver-vehicle-line">
              <span><Icon name="bus" size={20} /></span>
              <div><strong>{vehicle?.plate_number ?? 'Chưa gán xe'}</strong><small>{vehicle?.vehicle_name || 'Chưa cập nhật tên xe'}</small></div>
            </div>
            <div className="driver-route-card">
              <div className="route-view"><div className="route-dot start" /><div><small>Điểm đón</small><strong>{currentTrip.pickup}</strong></div></div>
              <div className="route-line" />
              <div className="route-view"><div className="route-dot end" /><div><small>Điểm đến</small><strong>{currentTrip.destination}</strong></div></div>
            </div>
            <div className="trip-meta"><span><Icon name="clock" size={14} />{formatDateTime(currentTrip.scheduled_start)}</span><span><Icon name="hospital" size={14} />{PURPOSE_LABELS[currentTrip.purpose]}</span><span className="trip-meta-link">Chi tiết<Icon name="chevron-right" size={14} /></span></div>
          </article>
        ) : <EmptyState icon="bus" title="Chưa có chuyến được giao" description="Khi điều phối tạo chuyến, thông tin sẽ xuất hiện tại đây. Phát sinh việc gấp? Bấm “Tạo chuyến đột xuất” bên dưới." />}

        {currentTrip && vehicle && currentTrip.status !== 'completed' && <section className={`driver-readiness-card ${blockingVehicleIssue ? 'blocked' : readinessIssues.length ? 'warning' : 'ready'}`}>
          <div className="driver-readiness-head"><span><Icon name={blockingVehicleIssue ? 'alert' : readinessIssues.length ? 'incident' : 'shield'} size={18} /></span><div><strong>{blockingVehicleIssue ? 'Xe chưa đủ điều kiện xuất phát' : readinessIssues.length ? 'Có cảnh báo cần lưu ý' : 'Xe sẵn sàng cho chuyến đi'}</strong><small>{vehicle.plate_number} · kiểm tra giấy tờ và bảo dưỡng tự động</small></div></div>
          {readinessIssues.length > 0 && <div className="driver-readiness-list">{readinessIssues.slice(0,4).map((item) => <div key={item.id} className={item.level}><strong>{item.title}</strong><small>{item.detail}</small></div>)}</div>}
        </section>}

        {currentTrip?.status === 'active' && <section className="driver-driving-focus">
          <span className="driver-section-label">CHẾ ĐỘ ĐANG CHẠY</span><h2>{currentTrip.destination}</h2><p>{vehicle?.plate_number} · GPS đang cập nhật vị trí cho bộ phận theo dõi.</p>
          <div><a href={googleMapsDirectionsUrl(currentTrip.destination, currentTrip.current_lat != null && currentTrip.current_lng != null ? { lat: currentTrip.current_lat, lng: currentTrip.current_lng } : null)} target="_blank" rel="noreferrer"><Icon name="map" size={17} />Mở bản đồ</a><button type="button" onClick={() => setDialog('incident')}><Icon name="incident" size={17} />Báo sự cố</button></div>
        </section>}

        <button className="driver-primary-journey" onClick={() => void primaryTripAction()} disabled={saving || !currentTrip}>
          <span className="driver-primary-icon"><Icon name="play" size={18} /></span>
          <span><strong>{primaryLabel()}</strong><small>Thao tác tiếp theo của chuyến hiện tại</small></span>
          <span className="driver-primary-arrow"><Icon name="chevron-right" size={20} /></span>
        </button>

        <button type="button" className="driver-adhoc-button" onClick={() => canCreateAdhoc ? setDialog('adhoc') : setMessage('Bạn đang có chuyến sẵn sàng hoặc đang chạy. Hãy hoàn tất chuyến đó trước khi tạo chuyến đột xuất.')} disabled={saving}>
          <span className="driver-adhoc-icon" aria-hidden="true"><Icon name="zap" size={20} /></span>
          <span><strong>Tạo chuyến đột xuất</strong><small>Đi ngay, báo cáo lại Hành chính/Điều phối sau</small></span>
          <span className="driver-primary-arrow"><Icon name="chevron-right" size={20} /></span>
        </button>

        <div className="driver-section-heading"><div><strong>Thao tác nhanh</strong><span>Chọn đúng công việc cần thực hiện</span></div></div>
        <section className="driver-quick-actions" aria-label="Thao tác tài xế">
          <button className="driver-quick-action" onClick={() => setDialog('odometer')} disabled={!currentTrip || !['ready', 'active'].includes(currentTrip.status)}>
            <span className="driver-quick-icon camera"><Icon name="camera" size={20} /></span><span><strong>Chụp KM</strong><small>KM đầu hoặc cuối</small></span>
          </button>
          <button className="driver-quick-action" onClick={() => setDialog('expense')} disabled={!vehicle}>
            <span className="driver-quick-icon receipt"><Icon name="receipt" size={20} /></span><span><strong>Gửi chi phí</strong><small>Hóa đơn và số tiền</small></span>
          </button>
          <button className="driver-quick-action incident" onClick={() => setDialog('incident')} disabled={!vehicle}>
            <span className="driver-quick-icon warning"><Icon name="incident" size={20} /></span><span><strong>Báo sự cố</strong><small>Ảnh, ghi âm, vị trí</small></span>
          </button>
          <button className="driver-quick-action vehicle-tracking" onClick={() => setDialog('vehicleTracking')} disabled={!vehicle}>
            <span className="driver-quick-icon vehicle"><Icon name="vehicle" size={20} /></span><span><strong>Theo dõi xe</strong><small>Giấy tờ & bảo dưỡng</small></span>
          </button>
        </section>

        {currentTrip?.status === 'active' && <a className="maps-launch-button" href={googleMapsDirectionsUrl(currentTrip.destination, currentTrip.start_lat != null && currentTrip.start_lng != null ? { lat: currentTrip.start_lat, lng: currentTrip.start_lng } : null)} target="_blank" rel="noreferrer"><Icon name="navigation" size={17} />Tiếp tục dẫn đường Google Maps</a>}

        {recentAdhocTrips.length > 0 && <section className="driver-adhoc-history">
          <div className="driver-section-heading"><div><strong>Chuyến đột xuất gần đây</strong><span>Trạng thái xác nhận của Hành chính/Điều phối</span></div></div>
          {recentAdhocTrips.map((trip) => <article key={trip.id} className={`driver-adhoc-item ${trip.adhoc_report_status ?? ''}`}>
            <div><strong>{trip.destination}</strong><small>{formatDateTime(trip.scheduled_start)} · {trip.adhoc_reason || '—'}</small>{trip.adhoc_report_status === 'flagged' && trip.adhoc_review_note && <small className="driver-adhoc-note">Cần giải trình: {trip.adhoc_review_note}</small>}</div>
            <span className={`adhoc-chip ${trip.adhoc_report_status ?? ''}`}>{trip.status === 'cancelled' ? 'Đã hủy' : ADHOC_REPORT_LABELS[trip.adhoc_report_status ?? 'pending_review']}</span>
          </article>)}
        </section>}

        <section className="driver-day-summary">
          <div><span>Chuyến hoàn thành</span><strong>{todayCompleted.length}</strong></div>
          <div><span>Xe phụ trách</span><strong>{vehicle?.plate_number ?? '—'}</strong></div>
        </section>
      </section>}

      {driverSetupReady && <nav className="driver-bottom-nav" aria-label="Điều hướng tài xế">
        <button className="active"><span><Icon name="home" size={20} /></span><small>Trang chính</small></button>
        <button onClick={() => setDialog('profile')}><span><Icon name="user" size={20} /></span><small>Tài khoản</small></button>
        <a href={`tel:${coordinatorPhone}`}><span><Icon name="phone" size={20} /></span><small>Gọi Điều phối</small></a>
      </nav>}

      {dialog === 'profile' && user && <DriverProfileModal
        profile={user.profile}
        mode={mode}
        saving={saving}
        onClose={() => setDialog(null)}
        onLogout={async () => {
          if (!window.confirm('Đăng xuất khỏi hệ thống Điều phối xe?')) return
          await logout()
        }}
        onSubmit={(input, avatar) => guarded(async () => {
          const password = input.password?.trim() ?? ''
          const currentAvatarPath = user.profile.avatar_path ?? null
          const profileChanged = Boolean(avatar)
            || input.full_name !== user.profile.full_name
            || input.phone !== user.profile.phone
            || input.avatar_url !== currentAvatarPath

          if (profileChanged) {
            await updateUser({ ...input, password: undefined }, avatar)
          }
          if (password) {
            await changeOwnPassword(password)
          }
          await refreshUser()
        }, input.password ? 'Đã cập nhật hồ sơ và đổi mật khẩu.' : 'Đã cập nhật hồ sơ cá nhân.')}
      />}
      {dialog === 'trip' && currentTrip && <TripDetailModal trip={currentTrip} vehicleName={`${vehicle?.plate_number ?? ''} ${vehicle?.vehicle_name ?? ''}`} saving={saving} onClose={() => setDialog(null)} onCancelAdhoc={() => {
        if (!window.confirm('Hủy chuyến đột xuất này? Chỉ hủy được khi chưa ghi KM đầu và chưa xuất phát.')) return
        void guarded(async () => { await updateTrip(currentTrip.id, { status: 'cancelled' }) }, 'Đã hủy chuyến đột xuất.')
      }} />}
      {dialog === 'adhoc' && <AdhocTripModal
        vehicles={data.vehicles}
        defaultVehicleId={vehicle?.id ?? data.vehicles.find((item) => item.regular_driver_id === user!.id)?.id ?? null}
        ownTrips={trips}
        saving={saving}
        onClose={() => setDialog(null)}
        onSubmit={(input) => guarded(async () => { await createAdhocTrip(input) }, 'Đã tạo chuyến đột xuất. Hãy làm checklist, chụp KM đầu rồi bắt đầu chuyến. Hành chính/Điều phối sẽ xác nhận báo cáo sau.')}
      />}
      {dialog === 'checklist' && currentTrip && <ChecklistModal trip={currentTrip} saving={saving} onClose={() => setDialog(null)} onSubmit={(values) => guarded(async () => { await createChecklist({ ...values, trip_id: currentTrip.id, driver_id: user!.id }) }, 'Checklist đã được ghi nhận.')} />}
      {dialog === 'startTrip' && currentTrip && <StartTripModal trip={currentTrip} vehicle={vehicle} saving={saving} onClose={() => setDialog(null)} onSubmit={startTrip} />}
      {dialog === 'odometer' && currentTrip && <OdometerModal trip={currentTrip} vehicleOdometer={vehicle?.odometer ?? 0} saving={saving} onClose={() => setDialog(null)} onSubmit={(phase, odometer, file) => guarded(async () => {
        if (phase === 'start' && odometer < (vehicle?.odometer ?? 0) - 10) throw new Error('Kilomet đầu nhỏ bất thường so với hồ sơ xe.')
        if (phase === 'end' && odometer < (currentTrip.start_odometer ?? 0)) throw new Error('Kilomet cuối không được nhỏ hơn kilomet đầu.')
        await submitOdometer(currentTrip, phase, odometer, file)
      }, `Đã lưu kilomet ${phase === 'start' ? 'đầu' : 'cuối'} chuyến.`)} />}
      {dialog === 'expense' && vehicle && <ExpenseModal saving={saving} onClose={() => setDialog(null)} onSubmit={(type, amount, description, file, fuelLiters) => guarded(async () => {
        await createExpense({ trip_id: currentTrip?.id ?? null, vehicle_id: vehicle.id, driver_id: user!.id, type, amount, fuel_liters: fuelLiters || null, fuel_unit_price: fuelLiters ? amount / fuelLiters : null, description, status: 'pending_director', expense_date: todayKey() }, file)
      }, 'Chi phí đã gửi và đang chờ kế toán duyệt.')} />}
      {dialog === 'incident' && vehicle && <IncidentModal saving={saving} onClose={() => setDialog(null)} onSubmit={(type, severity, description, file, audio) => guarded(async () => {
        await createIncident({ trip_id: currentTrip?.id ?? null, vehicle_id: vehicle.id, driver_id: user!.id, type, severity, description, status: 'pending_director' }, { file, secondFile: audio })
      }, 'Đã gửi báo cáo sự cố đến điều phối.')} />}
      {dialog === 'vehicleTracking' && vehicle && <DriverVehicleTrackingModal vehicle={vehicle} saving={saving} onClose={() => setDialog(null)} onSubmit={(values) => guarded(async () => {
        await updateDriverVehicleTracking(vehicle.id, values)
      }, 'Đã cập nhật thông tin theo dõi xe.')} />}
    </main>
  )

}


function DriverVehicleTrackingModal({ vehicle, saving, onClose, onSubmit }: {
  vehicle: Vehicle
  saving: boolean
  onClose: () => void
  onSubmit: (values: DriverVehicleTrackingUpdate) => void
}) {
  const [form, setForm] = useState({
    registration_expiry: vehicle.registration_expiry ?? '',
    insurance_expiry: vehicle.insurance_expiry ?? '',
    road_fee_expiry: vehicle.road_fee_expiry ?? '',
    last_oil_change_date: vehicle.last_oil_change_date ?? '',
    last_oil_change_odometer: String(vehicle.last_oil_change_odometer ?? ''),
    next_oil_change_date: vehicle.next_oil_change_date ?? '',
    next_oil_change_odometer: String(vehicle.next_oil_change_odometer ?? ''),
    next_maintenance_date: vehicle.next_maintenance_date ?? '',
    next_maintenance_odometer: String(vehicle.next_maintenance_odometer ?? ''),
  })
  const registrationDays = daysUntil(form.registration_expiry)
  const insuranceDays = daysUntil(form.insurance_expiry)
  const roadFeeDays = daysUntil(form.road_fee_expiry)

  const dueLabel = (days: number | null) => days == null ? 'Chưa cập nhật' : days < 0 ? `Quá hạn ${Math.abs(days)} ngày` : days === 0 ? 'Hết hạn hôm nay' : `Còn ${days} ngày`
  const dueClass = (days: number | null) => days != null && days < 0 ? 'danger' : days != null && days <= 30 ? 'warning' : 'ok'

  return <Modal title={`Theo dõi xe ${vehicle.plate_number}`} onClose={onClose} wide>
    <div className="driver-vehicle-tracking-head">
      <div><span><Icon name="vehicle" size={22} /></span><div><strong className="plate">{vehicle.plate_number}</strong><small>{vehicle.vehicle_name} · {vehicle.odometer.toLocaleString('vi-VN')} km</small></div></div>
      <p>Tài xế được cập nhật các mốc giấy tờ và kỹ thuật của xe đang phụ trách. Mọi thay đổi đều được lưu lịch sử hệ thống.</p>
    </div>

    <div className="driver-vehicle-expiry-grid">
      <div className={dueClass(registrationDays)}><span>Đăng kiểm</span><strong>{formatDate(form.registration_expiry)}</strong><small>{dueLabel(registrationDays)}</small></div>
      <div className={dueClass(insuranceDays)}><span>Bảo hiểm TNDS</span><strong>{formatDate(form.insurance_expiry)}</strong><small>{dueLabel(insuranceDays)}</small></div>
      <div className={dueClass(roadFeeDays)}><span>Phí đường bộ</span><strong>{formatDate(form.road_fee_expiry)}</strong><small>{dueLabel(roadFeeDays)}</small></div>
    </div>

    <form className="driver-vehicle-tracking-form" onSubmit={(event) => {
      event.preventDefault()
      onSubmit({
        registration_expiry: form.registration_expiry || null,
        insurance_expiry: form.insurance_expiry || null,
        road_fee_expiry: form.road_fee_expiry || null,
        last_oil_change_date: form.last_oil_change_date || null,
        last_oil_change_odometer: form.last_oil_change_odometer ? Number(form.last_oil_change_odometer) : null,
        next_oil_change_date: form.next_oil_change_date || null,
        next_oil_change_odometer: form.next_oil_change_odometer ? Number(form.next_oil_change_odometer) : null,
        next_maintenance_date: form.next_maintenance_date || null,
        next_maintenance_odometer: form.next_maintenance_odometer ? Number(form.next_maintenance_odometer) : null,
      })
    }}>
      <fieldset><legend>Giấy tờ xe</legend>
        <label>Hạn bảo hiểm trách nhiệm dân sự<VietnamDateInput value={form.insurance_expiry} onChange={(value) => setForm({ ...form, insurance_expiry: value })} /></label>
        <label>Hạn đăng kiểm<VietnamDateInput value={form.registration_expiry} onChange={(value) => setForm({ ...form, registration_expiry: value })} /></label>
        <label>Hạn phí sử dụng đường bộ<VietnamDateInput value={form.road_fee_expiry} onChange={(value) => setForm({ ...form, road_fee_expiry: value })} /></label>
      </fieldset>
      <fieldset><legend>Thay nhớt</legend>
        <label>Lần thay nhớt gần nhất<VietnamDateInput value={form.last_oil_change_date} onChange={(value) => setForm({ ...form, last_oil_change_date: value })} /></label>
        <label>KM khi thay nhớt<input type="number" min="0" inputMode="numeric" value={form.last_oil_change_odometer} onChange={(e) => setForm({ ...form, last_oil_change_odometer: e.target.value })} /></label>
        <label>Thay nhớt kế tiếp<VietnamDateInput value={form.next_oil_change_date} onChange={(value) => setForm({ ...form, next_oil_change_date: value })} /></label>
        <label>Mốc KM thay nhớt kế tiếp<input type="number" min="0" inputMode="numeric" value={form.next_oil_change_odometer} onChange={(e) => setForm({ ...form, next_oil_change_odometer: e.target.value })} /></label>
      </fieldset>
      <fieldset><legend>Bảo dưỡng định kỳ</legend>
        <label>Ngày bảo dưỡng kế tiếp<VietnamDateInput value={form.next_maintenance_date} onChange={(value) => setForm({ ...form, next_maintenance_date: value })} /></label>
        <label>Mốc KM bảo dưỡng<input type="number" min="0" inputMode="numeric" value={form.next_maintenance_odometer} onChange={(e) => setForm({ ...form, next_maintenance_odometer: e.target.value })} /></label>
      </fieldset>
      <div className="form-help driver-date-format-note">Ngày tháng nhập theo định dạng <strong>DD/MM/YYYY</strong>.</div>
      <button className="primary-button full" disabled={saving}>{saving ? 'Đang lưu...' : 'Lưu theo dõi xe'}</button>
    </form>
  </Modal>
}

function DriverPermissionGate({
  secure,
  secureUrl,
  locationPermission,
  notificationPermission,
  busy,
  message,
  onEnableLocation,
  onEnableNotifications,
  onRecheck,
}: {
  secure: boolean
  secureUrl: string
  locationPermission: DriverLocationPermission
  notificationPermission: NotificationPermission | 'unsupported'
  busy: 'location' | 'notification' | null
  message: string | null
  onEnableLocation: () => void
  onEnableNotifications: () => void
  onRecheck: () => void
}) {
  const locationReady = locationPermission === 'granted'
  const notificationReady = notificationPermission === 'granted'

  return <section className="driver-permission-screen">
    <div className="driver-permission-card">
      <div className="driver-permission-hero">
        <span className="driver-permission-lock"><Icon name="shield" size={26} /></span>
        <div>
          <span className="driver-section-label">THIẾT LẬP BẮT BUỘC</span>
          <h1>Sẵn sàng nhận chuyến</h1>
          <p>Tài xế cần bật đủ kết nối bảo mật, GPS và thông báo để không bỏ lỡ chuyến xe.</p>
        </div>
      </div>

      <div className="driver-permission-steps">
        <article className={secure ? 'ready' : 'blocked'}>
          <span>{secure ? <Icon name="check" size={16} /> : '1'}</span>
          <div><strong>Kết nối HTTPS bảo mật</strong><small>{secure ? 'Địa chỉ hiện tại đã đủ điều kiện dùng GPS và thông báo.' : 'Địa chỉ HTTP hiện tại bị trình duyệt chặn GPS và thông báo.'}</small></div>
          {!secure && <button type="button" onClick={() => window.location.assign(secureUrl)}>Mở HTTPS</button>}
        </article>

        <article className={locationReady ? 'ready' : locationPermission === 'denied' ? 'blocked' : ''}>
          <span>{locationReady ? <Icon name="check" size={16} /> : '2'}</span>
          <div><strong>Quyền vị trí GPS</strong><small>{locationReady ? 'Đã cho phép lấy vị trí khi bắt đầu và trong chuyến.' : locationPermission === 'denied' ? 'Quyền đang bị chặn trong Cài đặt trang web.' : 'Bật GPS để xác nhận điểm xuất phát và cập nhật vị trí xe.'}</small></div>
          {!locationReady && <button type="button" disabled={!secure || busy === 'location'} onClick={onEnableLocation}>{busy === 'location' ? 'Đang lấy...' : 'Bật vị trí'}</button>}
        </article>

        <article className={notificationReady ? 'ready' : notificationPermission === 'denied' ? 'blocked' : ''}>
          <span>{notificationReady ? <Icon name="check" size={16} /> : '3'}</span>
          <div><strong>Thông báo chuyến xe</strong><small>{notificationReady ? 'Đã bật cảnh báo khi có chuyến mới hoặc thay đổi.' : notificationPermission === 'denied' ? 'Thông báo đang bị chặn trong Cài đặt trang web.' : 'Bắt buộc bật để tài xế không bỏ lỡ chuyến được giao.'}</small></div>
          {!notificationReady && <button type="button" disabled={!secure || busy === 'notification'} onClick={onEnableNotifications}>{busy === 'notification' ? 'Đang bật...' : 'Bật thông báo'}</button>}
        </article>
      </div>

      {message && <div className="driver-permission-message">{message}</div>}
      {!secure && <div className="driver-secure-url"><span>Địa chỉ cần mở trên điện thoại</span><code>{secureUrl}</code></div>}
      {(locationPermission === 'denied' || notificationPermission === 'denied') && <div className="driver-permission-help">
        <strong>Cách bật lại quyền đã chặn</strong>
        <p>Nhấn biểu tượng ổ khóa hoặc thông tin trang cạnh thanh địa chỉ → Quyền trang web → cho phép Vị trí và Thông báo. Sau đó quay lại ứng dụng và bấm kiểm tra.</p>
      </div>}
      <button type="button" className="driver-permission-recheck" onClick={onRecheck}><Icon name="refresh" size={16} />Kiểm tra lại quyền</button>
      <p className="driver-permission-footnote">Ứng dụng chỉ mở chức năng chuyến xe sau khi ba mục trên đều hoàn tất.</p>
    </div>
  </section>
}

function DriverProfileModal({
  profile,
  mode,
  saving,
  onClose,
  onLogout,
  onSubmit,
}: {
  profile: Profile
  mode: 'demo' | 'supabase'
  saving: boolean
  onClose: () => void
  onLogout: () => Promise<void>
  onSubmit: (input: UpdateUserInput, avatar: File | null) => void
}) {
  const [fullName, setFullName] = useState(profile.full_name)
  const [phone, setPhone] = useState(profile.phone)
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [avatar, setAvatar] = useState<File | null>(null)
  const [avatarRemoved, setAvatarRemoved] = useState(false)
  const [preview, setPreview] = useState<string | null>(profile.avatar_url ?? null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => () => {
    if (preview?.startsWith('blob:')) URL.revokeObjectURL(preview)
  }, [preview])

  function chooseAvatar(file: File | null) {
    if (preview?.startsWith('blob:')) URL.revokeObjectURL(preview)
    if (!file) return
    setAvatar(file)
    setAvatarRemoved(false)
    setPreview(URL.createObjectURL(file))
  }

  function removeAvatar() {
    if (preview?.startsWith('blob:')) URL.revokeObjectURL(preview)
    setAvatar(null)
    setAvatarRemoved(true)
    setPreview(null)
  }

  function submit(event: React.FormEvent) {
    event.preventDefault()
    setError(null)
    if (!fullName.trim()) return setError('Vui lòng nhập họ tên.')
    if (!phone.trim()) return setError('Vui lòng nhập số điện thoại.')
    if (password && password.length < 6) return setError('Mật khẩu mới cần ít nhất 6 ký tự.')
    if (password !== confirmPassword) return setError('Mật khẩu xác nhận chưa khớp.')

    onSubmit({
      id: profile.id,
      full_name: fullName.trim(),
      phone: phone.trim(),
      role: profile.role,
      active: profile.active,
      employee_code: profile.employee_code ?? '',
      department: profile.department ?? '',
      job_title: profile.job_title ?? '',
      notes: profile.notes ?? '',
      password: password.trim() || undefined,
      avatar_url: avatarRemoved ? null : profile.avatar_path ?? null,
      previous_avatar_url: profile.avatar_path ?? null,
    }, avatar)
  }

  return <Modal title="Tài khoản của tôi" onClose={onClose} wide>
    <form className="driver-profile-form" onSubmit={submit}>
      <section className="driver-profile-hero">
        <div className="driver-profile-avatar">
          {preview ? <img src={preview} alt={`Ảnh đại diện ${profile.full_name}`} /> : <span>{fullName.trim().slice(0, 1).toUpperCase() || '?'}</span>}
        </div>
        <div className="driver-profile-identity">
          <strong>{fullName || profile.full_name}</strong>
          <span>{profile.job_title || 'Tài xế'} · {profile.department || 'Chưa cập nhật phòng ban'}</span>
          <div className="driver-avatar-actions">
            <label className="secondary-button compact">
              <Icon name="camera" size={15} />Đổi ảnh
              <input type="file" accept="image/*" capture="user" hidden onChange={(event) => chooseAvatar(event.target.files?.[0] ?? null)} />
            </label>
            {preview && <button type="button" className="driver-avatar-remove" onClick={removeAvatar}>Xóa ảnh</button>}
          </div>
        </div>
      </section>

      <section className="driver-profile-work">
        <div><span>Mã nhân viên</span><strong>{profile.employee_code || 'Chưa cập nhật'}</strong></div>
        <div><span>Chức danh</span><strong>{profile.job_title || 'Tài xế'}</strong></div>
      </section>

      <div className="driver-profile-fields">
        <label>Họ và tên<input value={fullName} onChange={(event) => setFullName(event.target.value)} required /></label>
        <label>Số điện thoại đăng nhập<input inputMode="tel" value={phone} onChange={(event) => setPhone(event.target.value)} required /></label>
        <label>Mật khẩu mới<input type="password" autoComplete="new-password" value={password} onChange={(event) => setPassword(event.target.value)} placeholder="Để trống nếu không đổi" /></label>
        <label>Xác nhận mật khẩu<input type="password" autoComplete="new-password" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} placeholder="Nhập lại mật khẩu mới" /></label>
      </div>

      <div className="driver-profile-note">Vai trò, trạng thái, mã nhân viên, phòng ban và chức danh do quản trị viên cập nhật. Tài xế được tự đổi mật khẩu của chính mình.</div>
      {error && <div className="form-error">{error}</div>}

      <div className="driver-profile-actions">
        <button type="button" className="driver-profile-logout" onClick={() => void onLogout()}><Icon name="logout" size={16} />Đăng xuất</button>
        <button className="primary-button" disabled={saving}>{saving ? 'Đang lưu...' : 'Lưu thông tin'}</button>
      </div>
    </form>
  </Modal>
}

function TripDetailModal({ trip, vehicleName, saving, onClose, onCancelAdhoc }: { trip: Trip; vehicleName: string; saving: boolean; onClose: () => void; onCancelAdhoc: () => void }) {
  const origin = trip.start_lat != null && trip.start_lng != null ? { lat: trip.start_lat, lng: trip.start_lng } : null
  const canCancelAdhoc = Boolean(trip.is_adhoc) && ['accepted', 'ready'].includes(trip.status) && trip.start_odometer == null && !trip.started_at
  return <Modal title={trip.is_adhoc ? 'Chi tiết chuyến đột xuất' : 'Chi tiết chuyến'} onClose={onClose}>{trip.is_adhoc && <div className="adhoc-reason-box"><strong>Chuyến đột xuất:</strong> {trip.adhoc_reason || '—'}<br /><small>{ADHOC_REPORT_LABELS[trip.adhoc_report_status ?? 'pending_review']}</small></div>}<div className="detail-list"><div><span>Xe</span><strong>{vehicleName}</strong></div><div><span>Xuất phát</span><strong>{formatDateTime(trip.scheduled_start)}</strong></div><div><span>Dự kiến về</span><strong>{formatDateTime(trip.expected_end)}</strong></div><div><span>Điểm đón</span><strong>{trip.pickup}</strong></div><div><span>Điểm đến</span><strong>{trip.destination}</strong></div><div><span>Người liên hệ</span><strong>{trip.contact_name || '—'}</strong></div><div><span>Số điện thoại</span><strong>{trip.contact_phone ? <a href={`tel:${trip.contact_phone}`}>{trip.contact_phone}</a> : '—'}</strong></div><div><span>Loại chuyến</span><strong>{PURPOSE_LABELS[trip.purpose]}</strong></div><div><span>Ghi chú</span><strong>{trip.notes || '—'}</strong></div></div><a className="maps-launch-button" href={googleMapsDirectionsUrl(trip.destination, origin)} target="_blank" rel="noreferrer"><Icon name="map" size={17} />Mở tuyến đường Google Maps</a>{canCancelAdhoc && <button type="button" className="reject-button full" disabled={saving} onClick={onCancelAdhoc}>Hủy chuyến đột xuất</button>}</Modal>
}

const ADHOC_PURPOSES: TripPurpose[] = ['patient_pickup', 'patient_return', 'medicine_supply', 'staff_transport', 'board_business', 'administrative', 'community_exam', 'marketing_care', 'personal_other']

function AdhocTripModal({ vehicles, defaultVehicleId, ownTrips, saving, onClose, onSubmit }: {
  vehicles: Vehicle[]
  defaultVehicleId: string | null
  ownTrips: Trip[]
  saving: boolean
  onClose: () => void
  onSubmit: (input: CreateAdhocTripInput) => void
}) {
  const eligibleVehicles = vehicles.filter((item) => !['maintenance', 'out_of_service'].includes(item.status))
  const initialVehicle = eligibleVehicles.find((item) => item.id === defaultVehicleId)?.id ?? eligibleVehicles[0]?.id ?? ''
  const [form, setForm] = useState(() => {
    const start = new Date()
    start.setSeconds(0, 0)
    return {
      vehicle_id: initialVehicle,
      purpose: 'patient_pickup' as TripPurpose,
      pickup: 'Bệnh viện Mắt Sài Gòn Trà Vinh',
      destination: '',
      adhoc_reason: '',
      contact_name: '',
      contact_phone: '',
      passenger_count: '1',
      scheduled_start: toDateTimeLocal(start),
      expected_end: toDateTimeLocal(new Date(start.getTime() + 2 * 60 * 60 * 1000)),
      notes: '',
    }
  })
  const [error, setError] = useState<string | null>(null)
  const selectedVehicle = eligibleVehicles.find((item) => item.id === form.vehicle_id) ?? null

  function submit(event: React.FormEvent) {
    event.preventDefault()
    setError(null)
    const start = new Date(form.scheduled_start).getTime()
    const end = form.expected_end ? new Date(form.expected_end).getTime() : start + 60 * 60 * 1000
    const now = Date.now()
    if (!form.vehicle_id) return setError('Vui lòng chọn xe.')
    if (!form.destination.trim()) return setError('Vui lòng nhập điểm đến.')
    if (!form.adhoc_reason.trim()) return setError('Vui lòng nhập lý do phát sinh / người yêu cầu chuyến đột xuất.')
    if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) return setError('Thời gian dự kiến về phải sau giờ xuất phát.')
    if (start < now - 2 * 60 * 60 * 1000 || start > now + 12 * 60 * 60 * 1000) return setError('Giờ xuất phát chuyến đột xuất phải trong khoảng 2 giờ trước đến 12 giờ tới.')
    const conflict = ownTrips.some((item) => {
      if (['cancelled', 'completed'].includes(item.status)) return false
      const itemStart = new Date(item.scheduled_start).getTime()
      const itemEnd = item.expected_end ? new Date(item.expected_end).getTime() : itemStart + 60 * 60 * 1000
      return start < itemEnd && itemStart < end
    })
    if (conflict) return setError('Bạn đã có chuyến khác trùng khoảng thời gian này. Hãy kiểm tra lại giờ đi/về.')
    onSubmit({
      vehicle_id: form.vehicle_id,
      purpose: form.purpose,
      pickup: form.pickup.trim(),
      destination: form.destination.trim(),
      adhoc_reason: form.adhoc_reason.trim(),
      contact_name: form.contact_name.trim(),
      contact_phone: form.contact_phone.trim(),
      passenger_count: Number(form.passenger_count) || 0,
      scheduled_start: new Date(start).toISOString(),
      expected_end: new Date(end).toISOString(),
      notes: form.notes.trim(),
    })
  }

  return <Modal title="Tạo chuyến đột xuất" onClose={onClose}>
    <div className="adhoc-flow-note"><strong><Icon name="zap" size={15} />Đi ngay, báo cáo sau</strong><span>Chuyến được tạo ở trạng thái “Đã nhận”. Tài xế làm checklist → chụp KM đầu → bắt đầu → chụp KM cuối như chuyến thường. Hành chính/Điều phối sẽ nhận thông báo và xác nhận báo cáo sau.</span></div>
    <form className="adhoc-trip-form" onSubmit={submit}>
      <label>Xe sử dụng<select value={form.vehicle_id} onChange={(event) => setForm({ ...form, vehicle_id: event.target.value })} required>{eligibleVehicles.map((item) => <option key={item.id} value={item.id}>{item.plate_number} — {item.vehicle_name}{item.status === 'in_use' ? ' (đang chạy)' : ''}</option>)}</select></label>
      {selectedVehicle?.status === 'in_use' && <div className="form-warning">Xe này đang được ghi nhận là đang chạy. Kiểm tra lại trước khi tạo chuyến.</div>}
      <label>Loại chuyến<select value={form.purpose} onChange={(event) => setForm({ ...form, purpose: event.target.value as TripPurpose })}>{ADHOC_PURPOSES.map((key) => <option key={key} value={key}>{PURPOSE_LABELS[key]}</option>)}</select></label>
      <label>Lý do phát sinh / người yêu cầu *<textarea value={form.adhoc_reason} onChange={(event) => setForm({ ...form, adhoc_reason: event.target.value })} placeholder="Ví dụ: BS. An yêu cầu đón bệnh nhân cấp cứu tại xã Hòa Thuận" required /></label>
      <label>Điểm đón<input value={form.pickup} onChange={(event) => setForm({ ...form, pickup: event.target.value })} required /></label>
      <label>Điểm đến *<input value={form.destination} onChange={(event) => setForm({ ...form, destination: event.target.value })} placeholder="Xã, bệnh viện hoặc địa chỉ" required /></label>
      <div className="adhoc-form-row">
        <label>Giờ xuất phát<VietnamDateInput mode="datetime" value={form.scheduled_start} onChange={(value) => setForm({ ...form, scheduled_start: value })} required /></label>
        <label>Dự kiến về<VietnamDateInput mode="datetime" value={form.expected_end} onChange={(value) => setForm({ ...form, expected_end: value })} /></label>
      </div>
      <div className="adhoc-form-row">
        <label>Người liên hệ<input value={form.contact_name} onChange={(event) => setForm({ ...form, contact_name: event.target.value })} /></label>
        <label>Số điện thoại<input inputMode="tel" value={form.contact_phone} onChange={(event) => setForm({ ...form, contact_phone: event.target.value })} /></label>
      </div>
      <label>Số người đi cùng<input type="number" min="0" inputMode="numeric" value={form.passenger_count} onChange={(event) => setForm({ ...form, passenger_count: event.target.value })} /></label>
      <label>Ghi chú<textarea value={form.notes} onChange={(event) => setForm({ ...form, notes: event.target.value })} placeholder="Thông tin thêm cho Hành chính/Điều phối" /></label>
      {!eligibleVehicles.length && <div className="form-error">Không có xe đủ điều kiện sử dụng.</div>}
      {error && <div className="form-error">{error}</div>}
      <button className="primary-button full" disabled={saving || !eligibleVehicles.length}>{saving ? 'Đang tạo chuyến...' : 'Tạo chuyến & bắt đầu chuẩn bị'}</button>
    </form>
  </Modal>
}

function StartTripModal({ trip, vehicle, saving, onClose, onSubmit }: { trip: Trip; vehicle: Vehicle | null; saving: boolean; onClose: () => void; onSubmit: (location: ConfirmedLocation) => Promise<void> }) {
  const [location, setLocation] = useState<ConfirmedLocation | null>(null)
  const [locating, setLocating] = useState(false)
  const [locationError, setLocationError] = useState<string | null>(null)
  const [confirmed, setConfirmed] = useState(false)
  const readinessIssues = vehicleReadinessIssues(vehicle)
  const blocked = hasBlockingVehicleIssue(vehicle)

  async function locate() {
    setLocating(true)
    setLocationError(null)
    try {
      setLocation(await requestCurrentLocation())
    } catch (err) {
      setLocation(null)
      setLocationError(err instanceof Error ? err.message : String(err))
    } finally {
      setLocating(false)
    }
  }

  useEffect(() => {
    if (!isTrustedWebContext()) {
      setLocationError('Website hiện tại đang dùng HTTP nên trình duyệt không cho phép lấy GPS.')
      return
    }
    if (!navigator.permissions?.query) return
    void navigator.permissions.query({ name: 'geolocation' }).then((status) => {
      if (status.state === 'granted') void locate()
    }).catch(() => undefined)
  }, [])

  return <Modal title="Xác nhận địa điểm xuất phát" onClose={onClose}>
    <p className="form-help">Hệ thống sẽ lưu vị trí hiện tại làm điểm bắt đầu. Sau khi chuyến được kích hoạt, Google Maps tự mở để dẫn đường.</p>

    <div className="start-route-confirmation">
      <div><span><Icon name="pin" size={13} />Điểm đón</span><strong>{trip.pickup}</strong></div>
      <div className="route-confirm-arrow"><Icon name="arrow-right" size={16} /></div>
      <div><span><Icon name="flag" size={13} />Điểm đến</span><strong>{trip.destination}</strong></div>
    </div>

    <div className={`location-confirm-card ${location ? 'success' : locationError ? 'error' : ''}`}>
      <div className="location-confirm-head">
        <div><strong>{locating ? 'Đang lấy vị trí GPS...' : location ? 'Đã xác định vị trí hiện tại' : 'Chưa xác định vị trí'}</strong><span>{location ? `Độ chính xác khoảng ${Math.round(location.accuracy)} m` : isTrustedWebContext() ? 'Bấm Lấy vị trí và cho phép quyền GPS khi trình duyệt hỏi.' : 'Website HTTP không thể sử dụng GPS trên điện thoại.'}</span></div>
        <button type="button" className="secondary-button compact" disabled={locating || saving || !isTrustedWebContext()} onClick={() => void locate()}>{locating ? 'Đang lấy...' : location ? 'Lấy lại' : 'Lấy vị trí'}</button>
      </div>
      {location && <div className="location-coordinates"><code>{location.lat.toFixed(6)}, {location.lng.toFixed(6)}</code><a href={googleMapsLocationUrl(location)} target="_blank" rel="noreferrer">Xem vị trí hiện tại</a></div>}
      {location && location.accuracy > 200 && <div className="form-warning">GPS đang có sai số lớn. Nên ra khu vực thoáng và bấm “Lấy lại” trước khi bắt đầu.</div>}
      {locationError && <div className="form-error">{locationError}</div>}
      {!isTrustedWebContext() && <button type="button" className="secure-open-button" onClick={() => window.location.assign(getSuggestedSecureUrl())}>Mở địa chỉ HTTPS</button>}
    </div>

    <section className={`start-readiness-check ${blocked ? 'blocked' : readinessIssues.length ? 'warning' : 'ready'}`}>
      <div className="start-readiness-title"><span><Icon name={blocked ? 'alert' : readinessIssues.length ? 'incident' : 'shield'} size={17} /></span><div><strong>{blocked ? 'Chưa thể xuất phát' : readinessIssues.length ? 'Kiểm tra cảnh báo trước khi đi' : 'Xe đủ điều kiện xuất phát'}</strong><small>{vehicle?.plate_number ?? 'Chưa rõ xe'}</small></div></div>
      {readinessIssues.length > 0 && <div className="start-readiness-items">{readinessIssues.map((item) => <div key={item.id} className={item.level}><strong>{item.title}</strong><small>{item.detail}</small></div>)}</div>}
      {blocked && <div className="form-error">Cần Hành chính/Điều phối xử lý cảnh báo nghiêm trọng trước khi tài xế bắt đầu chuyến.</div>}
    </section>

    <label className="confirmation-check">
      <input type="checkbox" checked={confirmed} onChange={(event) => setConfirmed(event.target.checked)} />
      <span>Tôi xác nhận đang ở điểm đón <strong>{trip.pickup}</strong> và đồng ý bắt đầu chuyến.</span>
    </label>

    <button className="primary-button full start-navigation-button" disabled={saving || locating || !location || !confirmed || blocked} onClick={() => location && void onSubmit(location)}>
      {saving ? 'Đang bắt đầu chuyến...' : 'Bắt đầu & mở Google Maps'}
    </button>
  </Modal>
}

function ChecklistModal({ trip, saving, onClose, onSubmit }: { trip: Trip; saving: boolean; onClose: () => void; onSubmit: (values: { fuel_ok: boolean; tires_ok: boolean; lights_horn_ok: boolean; vehicle_clean: boolean; documents_ok: boolean; notes?: string }) => void }) {
  const [values, setValues] = useState({ fuel_ok: true, tires_ok: true, lights_horn_ok: true, vehicle_clean: true, documents_ok: true, notes: '' })
  const fields: Array<[keyof typeof values, string]> = [['fuel_ok', 'Nhiên liệu đủ'], ['tires_ok', 'Lốp xe bình thường'], ['lights_horn_ok', 'Đèn và còi hoạt động'], ['vehicle_clean', 'Xe sạch'], ['documents_ok', 'Giấy tờ xe đầy đủ']]
  const hasNo = fields.some(([key]) => values[key] === false)
  return <Modal title="Checklist trước chuyến" onClose={onClose}><p className="form-help">Chuyến đi {trip.destination}. Kiểm tra nhanh trong khoảng 30 giây.</p><div className="checklist-list">{fields.map(([key, label]) => <div className="check-row" key={key}><strong>{label}</strong><div className="yes-no"><button type="button" className={values[key] === true ? 'yes active' : 'yes'} onClick={() => setValues({ ...values, [key]: true })}>CÓ</button><button type="button" className={values[key] === false ? 'no active' : 'no'} onClick={() => setValues({ ...values, [key]: false })}>KHÔNG</button></div></div>)}</div><label>Ghi chú khi có mục “Không”<textarea value={values.notes} onChange={(e) => setValues({ ...values, notes: e.target.value })} placeholder="Mô tả ngắn tình trạng xe" /></label>{hasNo && !values.notes && <div className="form-warning">Cần ghi chú tình trạng bất thường trước khi gửi.</div>}<button className="primary-button full" disabled={saving || (hasNo && !values.notes.trim())} onClick={() => onSubmit(values)}>{saving ? 'Đang lưu...' : 'Xác nhận checklist'}</button></Modal>
}

function OdometerModal({ trip, vehicleOdometer, saving, onClose, onSubmit }: { trip: Trip; vehicleOdometer: number; saving: boolean; onClose: () => void; onSubmit: (phase: 'start' | 'end', odometer: number, file: File | null) => void }) {
  const suggestedPhase: 'start' | 'end' = trip.status === 'active' ? 'end' : 'start'
  const [phase, setPhase] = useState<'start' | 'end'>(suggestedPhase)
  const [odometer, setOdometer] = useState(String(phase === 'start' ? trip.start_odometer ?? '' : trip.end_odometer ?? ''))
  const [file, setFile] = useState<File | null>(null)
  const [ocrState, setOcrState] = useState<'idle' | 'reading' | 'success' | 'warning' | 'error'>('idle')
  const [ocrProgress, setOcrProgress] = useState(0)
  const [ocrMessage, setOcrMessage] = useState('')
  const [localResult, setLocalResult] = useState<OdometerOcrResult | null>(null)
  const [geminiResult, setGeminiResult] = useState<GeminiOdometerResult | null>(null)
  const [geminiState, setGeminiState] = useState<'idle' | 'reading' | 'success' | 'warning' | 'error'>('idle')
  const [geminiMessage, setGeminiMessage] = useState('')
  const [confirmed, setConfirmed] = useState(false)
  const [selectedSource, setSelectedSource] = useState<'local' | 'gemini' | 'verified' | 'manual' | null>(null)
  const [autoReadEnabled, setAutoReadEnabled] = useState(getSavedOdometerAutoRead)

  const baseline = phase === 'start' ? vehicleOdometer : (trip.start_odometer ?? vehicleOdometer)
  const geminiAvailable = isGeminiOdometerAvailable()
  const verifyEveryPhoto = String(import.meta.env.VITE_ODOMETER_GEMINI_VERIFY_ALL ?? 'true').toLowerCase() !== 'false'

  function resetRecognition() {
    setOcrState('idle')
    setOcrProgress(0)
    setOcrMessage('')
    setLocalResult(null)
    setGeminiResult(null)
    setGeminiState('idle')
    setGeminiMessage('')
    setConfirmed(false)
    setSelectedSource(null)
  }

  function selectPhase(next: 'start' | 'end') {
    setPhase(next)
    setOdometer(String(next === 'start' ? trip.start_odometer ?? '' : trip.end_odometer ?? ''))
    setFile(null)
    resetRecognition()
  }

  function isSuspicious(value: number | null) {
    return value != null && baseline > 0 && (value < baseline - 50 || value > baseline + 15_000)
  }

  function chooseValue(value: number | null, source: 'local' | 'gemini' | 'verified') {
    if (value == null) return
    setOdometer(String(value))
    setSelectedSource(source)
    setConfirmed(false)
  }

  async function runGemini(nextFile: File, local: OdometerOcrResult | null, manual = false) {
    if (!geminiAvailable) {
      if (manual) {
        setGeminiState('error')
        setGeminiMessage('Gemini chưa được triển khai trên Supabase. OCR cục bộ vẫn hoạt động.')
      }
      return
    }

    setGeminiState('reading')
    setGeminiMessage('Gemini đang phân biệt số ODO với Trip, giờ và các dãy số khác...')
    try {
      const result = await readOdometerWithGemini(nextFile, {
        baseline,
        phase,
        localValue: local?.value ?? null,
        localConfidence: local?.confidence ?? 0,
        localCandidates: local?.candidates ?? [],
      })
      setGeminiResult(result)

      const localValue = local?.value ?? null
      if (result.value != null && localValue != null && result.value === localValue) {
        chooseValue(result.value, 'verified')
        setGeminiState(result.needsReview ? 'warning' : 'success')
        setGeminiMessage(`OCR cục bộ và Gemini cùng đọc ${result.value.toLocaleString('vi-VN')} km. ${result.reason}`)
        setOcrState(result.needsReview ? 'warning' : 'success')
        setOcrMessage('Hai bộ nhận diện đã đối chiếu cùng một kết quả. Tài xế vẫn cần nhìn ảnh và xác nhận.')
        return
      }

      if (result.value != null && localValue == null) {
        chooseValue(result.value, 'gemini')
        setGeminiState(result.needsReview ? 'warning' : 'success')
        setGeminiMessage(`Gemini đọc ${result.value.toLocaleString('vi-VN')} km. ${result.reason}`)
        setOcrState(result.needsReview ? 'warning' : 'success')
        setOcrMessage('OCR cục bộ không đọc được; hệ thống đang đề xuất kết quả từ Gemini.')
        return
      }

      if (result.value == null) {
        setGeminiState('warning')
        setGeminiMessage(result.reason || 'Gemini chưa xác định được dãy số ODO.')
        if (localValue != null) {
          setOcrState('warning')
          setOcrMessage(`OCR cục bộ đọc ${localValue.toLocaleString('vi-VN')} km nhưng Gemini chưa xác nhận. Vui lòng kiểm tra ảnh kỹ.`)
        }
        return
      }

      setGeminiState('warning')
      setGeminiMessage(`Hai kết quả khác nhau: Gemini ${result.value.toLocaleString('vi-VN')} km, OCR cục bộ ${localValue?.toLocaleString('vi-VN') ?? 'không có'}. Hãy nhìn ảnh và chọn đúng số.`)
      setOcrState('warning')
      setOcrMessage('Hệ thống không tự quyết định khi hai bộ nhận diện không trùng nhau.')
      setConfirmed(false)
    } catch (reason) {
      setGeminiState('error')
      setGeminiMessage(reason instanceof Error ? reason.message : 'Không kết nối được Gemini. OCR cục bộ vẫn có thể sử dụng.')
    }
  }

  async function runRecognition(nextFile: File) {
    resetRecognition()
    setOcrState('reading')
    setOcrProgress(0.03)
    setOcrMessage('OCR cục bộ đang nhận diện số kilomet...')
    try {
      const result = await readOdometerFromImage(nextFile, baseline, (progress, status) => {
        setOcrProgress(Math.max(0.03, progress))
        setOcrMessage(status === 'recognizing text' ? 'Đang đọc dãy số trên cụm đồng hồ...' : 'Đang chuẩn bị bộ nhận diện trên thiết bị...')
      })
      setLocalResult(result)

      if (result.value != null) {
        chooseValue(result.value, 'local')
        const suspicious = isSuspicious(result.value)
        setOcrState(suspicious || result.confidence < 55 ? 'warning' : 'success')
        setOcrMessage(suspicious
          ? `OCR đọc ${result.value.toLocaleString('vi-VN')} km nhưng chênh lệch lớn so với hồ sơ xe.`
          : `OCR cục bộ đọc ${result.value.toLocaleString('vi-VN')} km.`)
      } else {
        setOcrState('warning')
        setOcrMessage('OCR cục bộ chưa đọc rõ số KM. Gemini sẽ thử phân tích ảnh.')
      }

      const shouldVerify = verifyEveryPhoto
        || result.value == null
        || result.confidence < 75
        || isSuspicious(result.value)
        || result.candidates.length > 1
      if (shouldVerify) await runGemini(nextFile, result)
    } catch (reason) {
      setOcrState('error')
      setOcrMessage(reason instanceof Error ? `OCR cục bộ thất bại: ${reason.message}` : 'OCR cục bộ không đọc được ảnh.')
      await runGemini(nextFile, null)
    }
  }

  async function processPhoto(nextFile: File | null) {
    setFile(nextFile)
    resetRecognition()
    if (!nextFile || !autoReadEnabled) return
    await runRecognition(nextFile)
  }

  function changeAutoRead(enabled: boolean) {
    setAutoReadEnabled(enabled)
    try {
      window.localStorage.setItem(ODOMETER_AUTO_READ_KEY, String(enabled))
    } catch {
      // Trình duyệt có thể chặn localStorage ở chế độ riêng tư.
    }
    if (enabled && file && ocrState === 'idle' && geminiState === 'idle') {
      void runRecognition(file)
    }
  }

  const numericOdometer = Number(odometer)
  const invalidValue = !odometer.trim() || !Number.isSafeInteger(numericOdometer) || numericOdometer < 0
  const invalidOrder = phase === 'end' && numericOdometer < (trip.start_odometer ?? 0)
  const aiBusy = ocrState === 'reading' || geminiState === 'reading'
  const mismatch = localResult?.value != null && geminiResult?.value != null && localResult.value !== geminiResult.value

  return <Modal title="Chụp đồng hồ kilomet" onClose={onClose}>
    <div className="segment-control">
      <button type="button" disabled={trip.status === 'active'} className={phase === 'start' ? 'active' : ''} onClick={() => selectPhase('start')}>KM đầu</button>
      <button type="button" disabled={trip.status !== 'active'} className={phase === 'end' ? 'active' : ''} onClick={() => selectPhase('end')}>KM cuối</button>
    </div>

    <div className="odometer-guide">
      <strong><Icon name="camera" size={15} />Chụp riêng vùng số ODO</strong>
      <span>Đưa dãy số ODO/TOTAL vào giữa ảnh, chụp gần và giữ máy thẳng. Ảnh vẫn được lưu dù tài xế tắt AI.</span>
    </div>

    <label className={`odometer-ai-toggle ${autoReadEnabled ? 'enabled' : ''}`}>
      <span className="odometer-ai-toggle-copy">
        <strong>Tự động đọc số KM bằng AI</strong>
        <small>{autoReadEnabled ? 'Sau khi chụp, OCR và Gemini tự chạy.' : 'Đang tắt để thao tác nhanh; tài xế nhập KM thủ công.'}</small>
      </span>
      <span className="odometer-ai-switch" aria-hidden="true"><i /></span>
      <input type="checkbox" checked={autoReadEnabled} disabled={aiBusy} onChange={(event) => changeAutoRead(event.target.checked)} />
    </label>

    <MediaInput label={autoReadEnabled ? 'Chụp cụm đồng hồ — AI sẽ tự đọc' : 'Chụp cụm đồng hồ — nhập KM thủ công'} onChange={processPhoto} />

    {file && !autoReadEnabled && ocrState === 'idle' && <div className="odometer-manual-mode">
      <div><strong>Ảnh đã sẵn sàng</strong><span>AI tự động đang tắt. Nhập số KM bên dưới để lưu ngay, hoặc dùng AI khi ảnh khó nhìn.</span></div>
      <button type="button" className="secondary-button compact" onClick={() => void runRecognition(file)}>AI đọc ảnh này</button>
    </div>}

    {ocrState !== 'idle' && <div className={`ocr-status ${ocrState}`}>
      {ocrState === 'reading' && <div className="ocr-progress"><span style={{ width: `${Math.round(ocrProgress * 100)}%` }} /></div>}
      <div><strong>{ocrState === 'reading' ? 'OCR cục bộ đang đọc ảnh' : ocrState === 'success' ? 'OCR cục bộ đã đọc KM' : ocrState === 'warning' ? 'OCR cần đối chiếu' : 'OCR cục bộ chưa thành công'}</strong><span>{ocrMessage}</span></div>
      {localResult && <small>Độ tin cậy OCR: {Math.round(localResult.confidence)}% · {localResult.candidates.length} dãy số tìm thấy</small>}
    </div>}

    {file && <div className={`gemini-verify-card ${geminiState}`}>
      <div className="gemini-verify-head">
        <div><strong><Icon name="sparkles" size={15} />Gemini kiểm tra lại ODO</strong><span>{geminiMessage || (geminiAvailable ? 'Gemini sẽ kiểm tra số ODO và loại bỏ Trip/giờ/nhiệt độ.' : 'Chưa triển khai Edge Function Gemini.')}</span></div>
        {geminiResult && <small>{Math.round(geminiResult.confidence)}%</small>}
      </div>
      {geminiState === 'reading' && <div className="ocr-progress"><span style={{ width: '72%' }} /></div>}
      {geminiResult && <div className="gemini-meta-row">
        <span>Loại: <strong>{geminiResult.displayType === 'odometer' ? 'ODO tổng' : geminiResult.displayType === 'trip' ? 'Trip' : 'Chưa rõ'}</strong></span>
        <span>Ảnh: <strong>{geminiResult.quality === 'clear' ? 'Rõ' : geminiResult.quality === 'glare' ? 'Bị lóa' : geminiResult.quality === 'blur' ? 'Bị mờ' : geminiResult.quality === 'cropped' ? 'Bị cắt' : geminiResult.quality === 'dark' ? 'Thiếu sáng' : 'Chưa rõ'}</strong></span>
      </div>}
      <button type="button" className="secondary-button compact gemini-retry-button" disabled={geminiState === 'reading'} onClick={() => file && void runGemini(file, localResult, true)}>{geminiState === 'reading' ? 'Gemini đang đọc...' : geminiResult ? 'Gemini đọc lại' : 'Dùng Gemini kiểm tra'}</button>
    </div>}

    {(localResult?.value != null || geminiResult?.value != null) && <div className="ocr-comparison-grid">
      {localResult?.value != null && <article className={selectedSource === 'local' ? 'selected' : selectedSource === 'verified' ? 'verified' : ''}>
        <span>OCR trên điện thoại</span>
        <strong>{localResult.value.toLocaleString('vi-VN')} km</strong>
        <small>Tin cậy {Math.round(localResult.confidence)}%</small>
        <button type="button" onClick={() => chooseValue(localResult.value, geminiResult?.value === localResult.value ? 'verified' : 'local')}>Chọn số này</button>
      </article>}
      {geminiResult?.value != null && <article className={selectedSource === 'gemini' ? 'selected' : selectedSource === 'verified' ? 'verified' : ''}>
        <span>Gemini Vision</span>
        <strong>{geminiResult.value.toLocaleString('vi-VN')} km</strong>
        <small>Tin cậy {Math.round(geminiResult.confidence)}%</small>
        <button type="button" onClick={() => chooseValue(geminiResult.value, localResult?.value === geminiResult.value ? 'verified' : 'gemini')}>Chọn số này</button>
      </article>}
    </div>}

    {mismatch && <div className="form-warning"><strong>Kết quả không trùng nhau.</strong> Không lưu theo AI một cách tự động. Tài xế phải nhìn trực tiếp dãy số ODO trong ảnh và chọn đúng kết quả.</div>}

    <label>Số kilomet xác nhận
      <input type="number" inputMode="numeric" min="0" step="1" value={odometer} onChange={(e) => { setOdometer(e.target.value.replace(/\D/g, '')); setSelectedSource('manual'); setConfirmed(false) }} placeholder="AI tự điền hoặc nhập thủ công" />
    </label>
    <label className="odometer-confirmation-check">
      <input type="checkbox" checked={confirmed} onChange={(event) => setConfirmed(event.target.checked)} />
      <span>Tôi đã nhìn ảnh đồng hồ và xác nhận <strong>{invalidValue ? 'số KM bên trên' : `${numericOdometer.toLocaleString('vi-VN')} km`}</strong> là số ODO chính xác.</span>
    </label>
    <p className="form-help">Chế độ AI được ghi nhớ trên điện thoại. Dù nhập thủ công hay dùng AI, tài xế vẫn phải xác nhận số ODO trước khi lưu.</p>
    {invalidOrder && <div className="form-error">Kilomet cuối không được nhỏ hơn kilomet đầu {Number(trip.start_odometer).toLocaleString('vi-VN')} km.</div>}
    <button className="primary-button full" disabled={saving || aiBusy || invalidValue || invalidOrder || !file || !confirmed} onClick={() => onSubmit(phase, numericOdometer, file)}>{saving ? 'Đang lưu ảnh và kilomet...' : `Lưu ${phase === 'start' ? 'KM đầu' : 'KM cuối'}`}</button>
  </Modal>
}

function ExpenseModal({ saving, onClose, onSubmit }: { saving: boolean; onClose: () => void; onSubmit: (type: ExpenseType, amount: number, description: string, file: File | null, fuelLiters: number) => void }) {
  const [type, setType] = useState<ExpenseType>('fuel')
  const [amount, setAmount] = useState('')
  const [description, setDescription] = useState('')
  const [fuelLiters, setFuelLiters] = useState('')
  const [file, setFile] = useState<File | null>(null)
  return <Modal title="Gửi chi phí" onClose={onClose}><div className="choice-grid">{(Object.keys(EXPENSE_LABELS) as ExpenseType[]).map((item) => <button type="button" className={type === item ? 'active' : ''} key={item} onClick={() => setType(item)}><span><Icon name={iconFromEmoji(EXPENSE_ICONS[item], 'receipt')} size={18} /></span>{EXPENSE_LABELS[item]}</button>)}</div><MediaInput label="Chụp hóa đơn hoặc phiếu thu" onChange={setFile} /><label>Số tiền<input type="number" inputMode="numeric" min="0" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="Ví dụ: 500000" /></label>{type === 'fuel' && <label>Số lít nhiên liệu<input type="number" inputMode="decimal" min="0" step="0.01" value={fuelLiters} onChange={(e) => setFuelLiters(e.target.value)} placeholder="Ví dụ: 22.5" /></label>}<label>Ghi chú<textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Nội dung chi phí" /></label>{amount && <div className="amount-preview">Số tiền: <strong>{formatCurrency(Number(amount))}</strong></div>}<button className="primary-button full" disabled={saving || safeNumber(amount) <= 0 || !file || (type === 'fuel' && safeNumber(fuelLiters) <= 0)} onClick={() => onSubmit(type, Number(amount), description, file, Number(fuelLiters))}>{saving ? 'Đang gửi...' : 'Gửi chi phí'}</button></Modal>
}

function IncidentModal({ saving, onClose, onSubmit }: { saving: boolean; onClose: () => void; onSubmit: (type: IncidentType, severity: Severity, description: string, file: File | null, audio: File | null) => void }) {
  const [type, setType] = useState<IncidentType>('breakdown')
  const [severity, setSeverity] = useState<Severity>('medium')
  const [description, setDescription] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [audio, setAudio] = useState<File | null>(null)
  return <Modal title="Báo sự cố" onClose={onClose}><div className="incident-choice">{(Object.keys(INCIDENT_LABELS) as IncidentType[]).map((item) => <button type="button" className={type === item ? 'active' : ''} key={item} onClick={() => setType(item)}>{INCIDENT_LABELS[item]}</button>)}</div><label>Mức độ<select value={severity} onChange={(e) => setSeverity(e.target.value as Severity)}><option value="low">Nhẹ — vẫn có thể di chuyển</option><option value="medium">Cần kiểm tra sớm</option><option value="high">Nghiêm trọng — nên dừng xe</option><option value="critical">Khẩn cấp / tai nạn</option></select></label><MediaInput label="Chụp ảnh tình trạng xe" onChange={setFile} /><AudioRecorder onChange={setAudio} /><label>Mô tả ngắn<textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Xe phát tiếng kêu, vị trí xảy ra..." /></label>{severity === 'critical' && <a className="emergency-call" href={`tel:${coordinatorPhone}`}>Gọi Điều phối ngay</a>}<button className="danger-button full" disabled={saving || !description.trim()} onClick={() => onSubmit(type, severity, description, file, audio)}>{saving ? 'Đang gửi...' : 'Gửi báo sự cố'}</button></Modal>
}
