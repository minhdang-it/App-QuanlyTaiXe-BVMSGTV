import { useEffect, useMemo, useRef, useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { useData } from '../context/DataContext'
import { EXPENSE_ICONS, EXPENSE_LABELS, INCIDENT_LABELS, PURPOSE_LABELS } from '../lib/constants'
import { formatCurrency, formatDateTime, getSuggestedSecureUrl, googleMapsDirectionsUrl, googleMapsLocationUrl, isTrustedWebContext, requestCurrentLocation, safeNumber, todayKey, type ConfirmedLocation } from '../lib/utils'
import type { ExpenseType, IncidentType, Profile, Severity, Trip, UpdateUserInput } from '../types/models'
import { Modal } from '../components/Modal'
import { MediaInput } from '../components/MediaInput'
import { StatusBadge } from '../components/StatusBadge'
import { NetworkBanner } from '../components/NetworkBanner'
import { EmptyState } from '../components/EmptyState'
import { AudioRecorder } from '../components/AudioRecorder'
import { BrandLogo } from '../components/BrandLogo'
import { readOdometerFromImage, type OdometerOcrResult } from '../lib/odometerOcr'
import { isGeminiOdometerAvailable, readOdometerWithGemini, type GeminiOdometerResult } from '../lib/odometerGemini'
import { NotificationCenter } from '../components/NotificationCenter'
import { useNotifications } from '../context/NotificationContext'

const coordinatorPhone = import.meta.env.VITE_COORDINATOR_PHONE || '0900000000'
const ODOMETER_AUTO_READ_KEY = 'bvmsgtv_odometer_auto_read'

function getSavedOdometerAutoRead() {
  try {
    return window.localStorage.getItem(ODOMETER_AUTO_READ_KEY) === 'true'
  } catch {
    return false
  }
}

type Dialog = 'checklist' | 'odometer' | 'startTrip' | 'expense' | 'incident' | 'trip' | 'profile' | null
type DriverLocationPermission = 'checking' | 'granted' | 'prompt' | 'denied' | 'unsupported'

export function DriverPage() {
  const { user, logout, mode, refreshUser } = useAuth()
  const { data, loading, createChecklist, submitOdometer, createExpense, createIncident, updateTrip, updateTripLocation, updateUser, changeOwnPassword } = useData()
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

  const currentTrip = trips.find((trip) => ['assigned', 'accepted', 'ready', 'active'].includes(trip.status)) ?? null
  const todayCompleted = trips.filter((trip) => trip.status === 'completed' && todayKey(new Date(trip.ended_at ?? trip.updated_at)) === todayKey())
  const vehicle = data.vehicles.find((item) => item.id === currentTrip?.vehicle_id) ?? data.vehicles.find((item) => item.regular_driver_id === user!.id) ?? null

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
    if (currentTrip.status !== 'active') return setDialog('startTrip')
    if (currentTrip.end_odometer == null) return setDialog('odometer')
    await guarded(async () => { await updateTrip(currentTrip.id, { status: 'completed', ended_at: new Date().toISOString() }) }, 'Chuyến đi đã hoàn thành.')
  }

  function primaryLabel() {
    if (!currentTrip) return 'CHƯA CÓ CHUYẾN'
    if (currentTrip.status === 'assigned') return 'NHẬN CHUYẾN'
    if (!currentTrip.checklist_completed) return 'CHECKLIST TRƯỚC KHI ĐI'
    if (currentTrip.status === 'accepted' && currentTrip.checklist_completed) return 'CHỜ ĐIỀU PHỐI DUYỆT'
    if (currentTrip.start_odometer == null) return 'CHỤP KM ĐẦU'
    if (currentTrip.status !== 'active') return 'BẮT ĐẦU CHUYẾN'
    if (currentTrip.end_odometer == null) return 'CHỤP KM CUỐI'
    return 'KẾT THÚC CHUYẾN'
  }

  return (
    <main className="driver-app driver-app-modern">
      <NetworkBanner />
      <header className="driver-header driver-header-modern">
        <BrandLogo className="driver-brand" compact />
        <NotificationCenter compact />
        <button className="driver-account-button" onClick={() => setDialog('profile')} aria-label="Mở hồ sơ cá nhân">
          <span className="driver-header-avatar">
            {user?.profile.avatar_url
              ? <img src={user.profile.avatar_url} alt={`Ảnh đại diện ${user.profile.full_name}`} />
              : user?.profile.full_name.slice(0, 1).toUpperCase()}
          </span>
          <span className="driver-account-copy">
            <strong>{user?.profile.full_name}</strong>
            <small>Hồ sơ cá nhân</small>
          </span>
          <span className="driver-account-arrow">›</span>
        </button>
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
      /> : <section className="driver-content driver-content-modern">
        <section className="driver-welcome-card">
          <div>
            <span className="driver-section-label">CA LÀM VIỆC HÔM NAY</span>
            <h1>Xin chào, {user?.profile.full_name.split(' ').slice(-1)[0]}</h1>
            <p>{new Intl.DateTimeFormat('vi-VN', { weekday: 'long', day: '2-digit', month: '2-digit', year: 'numeric' }).format(new Date())}</p>
          </div>
          <button className="driver-profile-shortcut" onClick={() => setDialog('profile')}>👤 Tài khoản</button>
        </section>

        {message && <button type="button" className="driver-toast" onClick={() => setMessage(null)}><span>{message}</span><strong>✕</strong></button>}

        {loading ? <div className="driver-trip-card skeleton-card" /> : currentTrip ? (
          <article className="driver-trip-card driver-trip-card-modern" onClick={() => setDialog('trip')}>
            <div className="trip-card-top"><span>CHUYẾN ĐANG PHỤ TRÁCH</span><StatusBadge status={currentTrip.status} /></div>
            <div className="driver-vehicle-line">
              <span>🚐</span>
              <div><strong>{vehicle?.plate_number ?? 'Chưa gán xe'}</strong><small>{vehicle?.vehicle_name || 'Chưa cập nhật tên xe'}</small></div>
            </div>
            <div className="driver-route-card">
              <div className="route-view"><div className="route-dot start" /><div><small>Điểm đón</small><strong>{currentTrip.pickup}</strong></div></div>
              <div className="route-line" />
              <div className="route-view"><div className="route-dot end" /><div><small>Điểm đến</small><strong>{currentTrip.destination}</strong></div></div>
            </div>
            <div className="trip-meta"><span>🕒 {formatDateTime(currentTrip.scheduled_start)}</span><span>🏥 {PURPOSE_LABELS[currentTrip.purpose]}</span><span>Xem chi tiết →</span></div>
          </article>
        ) : <EmptyState icon="🚐" title="Chưa có chuyến được giao" description="Khi điều phối tạo chuyến, thông tin sẽ xuất hiện tại đây." />}

        <button className="driver-primary-journey" onClick={() => void primaryTripAction()} disabled={saving || !currentTrip}>
          <span className="driver-primary-icon">▶</span>
          <span><strong>{primaryLabel()}</strong><small>Thao tác tiếp theo của chuyến hiện tại</small></span>
          <span className="driver-primary-arrow">›</span>
        </button>

        <div className="driver-section-heading"><div><strong>Thao tác nhanh</strong><span>Chọn đúng công việc cần thực hiện</span></div></div>
        <section className="driver-quick-actions" aria-label="Thao tác tài xế">
          <button className="driver-quick-action" onClick={() => setDialog('odometer')} disabled={!currentTrip || !['ready', 'active'].includes(currentTrip.status)}>
            <span className="driver-quick-icon camera">📷</span><span><strong>Chụp KM</strong><small>KM đầu hoặc cuối</small></span>
          </button>
          <button className="driver-quick-action" onClick={() => setDialog('expense')} disabled={!vehicle}>
            <span className="driver-quick-icon receipt">🧾</span><span><strong>Gửi chi phí</strong><small>Hóa đơn và số tiền</small></span>
          </button>
          <button className="driver-quick-action incident" onClick={() => setDialog('incident')} disabled={!vehicle}>
            <span className="driver-quick-icon warning">⚠️</span><span><strong>Báo sự cố</strong><small>Ảnh, ghi âm, vị trí</small></span>
          </button>
        </section>

        {currentTrip?.status === 'active' && <a className="maps-launch-button" href={googleMapsDirectionsUrl(currentTrip.destination, currentTrip.start_lat != null && currentTrip.start_lng != null ? { lat: currentTrip.start_lat, lng: currentTrip.start_lng } : null)} target="_blank" rel="noreferrer">🗺 TIẾP TỤC DẪN ĐƯỜNG GOOGLE MAPS</a>}

        <section className="driver-day-summary">
          <div><span>Chuyến hoàn thành</span><strong>{todayCompleted.length}</strong></div>
          <div><span>Xe phụ trách</span><strong>{vehicle?.plate_number ?? '—'}</strong></div>
        </section>
      </section>}

      {driverSetupReady && <nav className="driver-bottom-nav" aria-label="Điều hướng tài xế">
        <button className="active"><span>⌂</span><small>Trang chính</small></button>
        <button onClick={() => setDialog('profile')}><span>👤</span><small>Tài khoản</small></button>
        <a href={`tel:${coordinatorPhone}`}><span>☎</span><small>Điều phối</small></a>
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
      {dialog === 'trip' && currentTrip && <TripDetailModal trip={currentTrip} vehicleName={`${vehicle?.plate_number ?? ''} ${vehicle?.vehicle_name ?? ''}`} onClose={() => setDialog(null)} />}
      {dialog === 'checklist' && currentTrip && <ChecklistModal trip={currentTrip} saving={saving} onClose={() => setDialog(null)} onSubmit={(values) => guarded(async () => { await createChecklist({ ...values, trip_id: currentTrip.id, driver_id: user!.id }) }, 'Checklist đã được ghi nhận.')} />}
      {dialog === 'startTrip' && currentTrip && <StartTripModal trip={currentTrip} saving={saving} onClose={() => setDialog(null)} onSubmit={startTrip} />}
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
    </main>
  )

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
        <span className="driver-permission-lock">🛡</span>
        <div>
          <span className="driver-section-label">THIẾT LẬP BẮT BUỘC</span>
          <h1>Sẵn sàng nhận chuyến</h1>
          <p>Tài xế cần bật đủ kết nối bảo mật, GPS và thông báo để không bỏ lỡ chuyến xe.</p>
        </div>
      </div>

      <div className="driver-permission-steps">
        <article className={secure ? 'ready' : 'blocked'}>
          <span>{secure ? '✓' : '1'}</span>
          <div><strong>Kết nối HTTPS bảo mật</strong><small>{secure ? 'Địa chỉ hiện tại đã đủ điều kiện dùng GPS và thông báo.' : 'Địa chỉ HTTP hiện tại bị trình duyệt chặn GPS và thông báo.'}</small></div>
          {!secure && <button type="button" onClick={() => window.location.assign(secureUrl)}>MỞ HTTPS</button>}
        </article>

        <article className={locationReady ? 'ready' : locationPermission === 'denied' ? 'blocked' : ''}>
          <span>{locationReady ? '✓' : '2'}</span>
          <div><strong>Quyền vị trí GPS</strong><small>{locationReady ? 'Đã cho phép lấy vị trí khi bắt đầu và trong chuyến.' : locationPermission === 'denied' ? 'Quyền đang bị chặn trong Cài đặt trang web.' : 'Bật GPS để xác nhận điểm xuất phát và cập nhật vị trí xe.'}</small></div>
          {!locationReady && <button type="button" disabled={!secure || busy === 'location'} onClick={onEnableLocation}>{busy === 'location' ? 'ĐANG LẤY...' : 'BẬT VỊ TRÍ'}</button>}
        </article>

        <article className={notificationReady ? 'ready' : notificationPermission === 'denied' ? 'blocked' : ''}>
          <span>{notificationReady ? '✓' : '3'}</span>
          <div><strong>Thông báo chuyến xe</strong><small>{notificationReady ? 'Đã bật cảnh báo khi có chuyến mới hoặc thay đổi.' : notificationPermission === 'denied' ? 'Thông báo đang bị chặn trong Cài đặt trang web.' : 'Bắt buộc bật để tài xế không bỏ lỡ chuyến được giao.'}</small></div>
          {!notificationReady && <button type="button" disabled={!secure || busy === 'notification'} onClick={onEnableNotifications}>{busy === 'notification' ? 'ĐANG BẬT...' : 'BẬT THÔNG BÁO'}</button>}
        </article>
      </div>

      {message && <div className="driver-permission-message">{message}</div>}
      {!secure && <div className="driver-secure-url"><span>Địa chỉ cần mở trên điện thoại</span><code>{secureUrl}</code></div>}
      {(locationPermission === 'denied' || notificationPermission === 'denied') && <div className="driver-permission-help">
        <strong>Cách bật lại quyền đã chặn</strong>
        <p>Nhấn biểu tượng ổ khóa hoặc thông tin trang cạnh thanh địa chỉ → Quyền trang web → cho phép Vị trí và Thông báo. Sau đó quay lại ứng dụng và bấm kiểm tra.</p>
      </div>}
      <button type="button" className="driver-permission-recheck" onClick={onRecheck}>↻ KIỂM TRA LẠI QUYỀN</button>
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
              📷 Đổi ảnh
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
        <button type="button" className="driver-profile-logout" onClick={() => void onLogout()}>↪ ĐĂNG XUẤT</button>
        <button className="primary-button" disabled={saving}>{saving ? 'ĐANG LƯU...' : 'LƯU THÔNG TIN'}</button>
      </div>
    </form>
  </Modal>
}

function TripDetailModal({ trip, vehicleName, onClose }: { trip: Trip; vehicleName: string; onClose: () => void }) {
  const origin = trip.start_lat != null && trip.start_lng != null ? { lat: trip.start_lat, lng: trip.start_lng } : null
  return <Modal title="Chi tiết chuyến" onClose={onClose}><div className="detail-list"><div><span>Xe</span><strong>{vehicleName}</strong></div><div><span>Xuất phát</span><strong>{formatDateTime(trip.scheduled_start)}</strong></div><div><span>Dự kiến về</span><strong>{formatDateTime(trip.expected_end)}</strong></div><div><span>Điểm đón</span><strong>{trip.pickup}</strong></div><div><span>Điểm đến</span><strong>{trip.destination}</strong></div><div><span>Người liên hệ</span><strong>{trip.contact_name || '—'}</strong></div><div><span>Số điện thoại</span><strong>{trip.contact_phone ? <a href={`tel:${trip.contact_phone}`}>{trip.contact_phone}</a> : '—'}</strong></div><div><span>Loại chuyến</span><strong>{PURPOSE_LABELS[trip.purpose]}</strong></div><div><span>Ghi chú</span><strong>{trip.notes || '—'}</strong></div></div><a className="maps-launch-button" href={googleMapsDirectionsUrl(trip.destination, origin)} target="_blank" rel="noreferrer">🗺 MỞ TUYẾN ĐƯỜNG GOOGLE MAPS</a></Modal>
}

function StartTripModal({ trip, saving, onClose, onSubmit }: { trip: Trip; saving: boolean; onClose: () => void; onSubmit: (location: ConfirmedLocation) => Promise<void> }) {
  const [location, setLocation] = useState<ConfirmedLocation | null>(null)
  const [locating, setLocating] = useState(false)
  const [locationError, setLocationError] = useState<string | null>(null)
  const [confirmed, setConfirmed] = useState(false)

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
      <div><span>📍 ĐIỂM ĐÓN</span><strong>{trip.pickup}</strong></div>
      <div className="route-confirm-arrow">↓</div>
      <div><span>🏁 ĐIỂM ĐẾN</span><strong>{trip.destination}</strong></div>
    </div>

    <div className={`location-confirm-card ${location ? 'success' : locationError ? 'error' : ''}`}>
      <div className="location-confirm-head">
        <div><strong>{locating ? 'Đang lấy vị trí GPS...' : location ? 'Đã xác định vị trí hiện tại' : 'Chưa xác định vị trí'}</strong><span>{location ? `Độ chính xác khoảng ${Math.round(location.accuracy)} m` : isTrustedWebContext() ? 'Bấm Lấy vị trí và cho phép quyền GPS khi trình duyệt hỏi.' : 'Website HTTP không thể sử dụng GPS trên điện thoại.'}</span></div>
        <button type="button" className="secondary-button compact" disabled={locating || saving || !isTrustedWebContext()} onClick={() => void locate()}>{locating ? 'ĐANG LẤY...' : location ? 'LẤY LẠI' : 'LẤY VỊ TRÍ'}</button>
      </div>
      {location && <div className="location-coordinates"><code>{location.lat.toFixed(6)}, {location.lng.toFixed(6)}</code><a href={googleMapsLocationUrl(location)} target="_blank" rel="noreferrer">Xem vị trí hiện tại</a></div>}
      {location && location.accuracy > 200 && <div className="form-warning">GPS đang có sai số lớn. Nên ra khu vực thoáng và bấm “Lấy lại” trước khi bắt đầu.</div>}
      {locationError && <div className="form-error">{locationError}</div>}
      {!isTrustedWebContext() && <button type="button" className="secure-open-button" onClick={() => window.location.assign(getSuggestedSecureUrl())}>MỞ ĐỊA CHỈ HTTPS</button>}
    </div>

    <label className="confirmation-check">
      <input type="checkbox" checked={confirmed} onChange={(event) => setConfirmed(event.target.checked)} />
      <span>Tôi xác nhận đang ở điểm đón <strong>{trip.pickup}</strong> và đồng ý bắt đầu chuyến.</span>
    </label>

    <button className="primary-button full start-navigation-button" disabled={saving || locating || !location || !confirmed} onClick={() => location && void onSubmit(location)}>
      {saving ? 'ĐANG BẮT ĐẦU CHUYẾN...' : 'BẮT ĐẦU & MỞ GOOGLE MAPS'}
    </button>
  </Modal>
}

function ChecklistModal({ trip, saving, onClose, onSubmit }: { trip: Trip; saving: boolean; onClose: () => void; onSubmit: (values: { fuel_ok: boolean; tires_ok: boolean; lights_horn_ok: boolean; vehicle_clean: boolean; documents_ok: boolean; notes?: string }) => void }) {
  const [values, setValues] = useState({ fuel_ok: true, tires_ok: true, lights_horn_ok: true, vehicle_clean: true, documents_ok: true, notes: '' })
  const fields: Array<[keyof typeof values, string]> = [['fuel_ok', 'Nhiên liệu đủ'], ['tires_ok', 'Lốp xe bình thường'], ['lights_horn_ok', 'Đèn và còi hoạt động'], ['vehicle_clean', 'Xe sạch'], ['documents_ok', 'Giấy tờ xe đầy đủ']]
  const hasNo = fields.some(([key]) => values[key] === false)
  return <Modal title="Checklist trước chuyến" onClose={onClose}><p className="form-help">Chuyến đi {trip.destination}. Kiểm tra nhanh trong khoảng 30 giây.</p><div className="checklist-list">{fields.map(([key, label]) => <div className="check-row" key={key}><strong>{label}</strong><div className="yes-no"><button type="button" className={values[key] === true ? 'yes active' : 'yes'} onClick={() => setValues({ ...values, [key]: true })}>CÓ</button><button type="button" className={values[key] === false ? 'no active' : 'no'} onClick={() => setValues({ ...values, [key]: false })}>KHÔNG</button></div></div>)}</div><label>Ghi chú khi có mục “Không”<textarea value={values.notes} onChange={(e) => setValues({ ...values, notes: e.target.value })} placeholder="Mô tả ngắn tình trạng xe" /></label>{hasNo && !values.notes && <div className="form-warning">Cần ghi chú tình trạng bất thường trước khi gửi.</div>}<button className="primary-button full" disabled={saving || (hasNo && !values.notes.trim())} onClick={() => onSubmit(values)}>{saving ? 'Đang lưu...' : 'XÁC NHẬN CHECKLIST'}</button></Modal>
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
      <button type="button" disabled={trip.status === 'active'} className={phase === 'start' ? 'active' : ''} onClick={() => selectPhase('start')}>KM ĐẦU</button>
      <button type="button" disabled={trip.status !== 'active'} className={phase === 'end' ? 'active' : ''} onClick={() => selectPhase('end')}>KM CUỐI</button>
    </div>

    <div className="odometer-guide">
      <strong>📸 Chụp riêng vùng số ODO</strong>
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
      <button type="button" className="secondary-button compact" onClick={() => void runRecognition(file)}>AI ĐỌC ẢNH NÀY</button>
    </div>}

    {ocrState !== 'idle' && <div className={`ocr-status ${ocrState}`}>
      {ocrState === 'reading' && <div className="ocr-progress"><span style={{ width: `${Math.round(ocrProgress * 100)}%` }} /></div>}
      <div><strong>{ocrState === 'reading' ? 'OCR cục bộ đang đọc ảnh' : ocrState === 'success' ? 'OCR cục bộ đã đọc KM' : ocrState === 'warning' ? 'OCR cần đối chiếu' : 'OCR cục bộ chưa thành công'}</strong><span>{ocrMessage}</span></div>
      {localResult && <small>Độ tin cậy OCR: {Math.round(localResult.confidence)}% · {localResult.candidates.length} dãy số tìm thấy</small>}
    </div>}

    {file && <div className={`gemini-verify-card ${geminiState}`}>
      <div className="gemini-verify-head">
        <div><strong>✦ Gemini kiểm tra lại ODO</strong><span>{geminiMessage || (geminiAvailable ? 'Gemini sẽ kiểm tra số ODO và loại bỏ Trip/giờ/nhiệt độ.' : 'Chưa triển khai Edge Function Gemini.')}</span></div>
        {geminiResult && <small>{Math.round(geminiResult.confidence)}%</small>}
      </div>
      {geminiState === 'reading' && <div className="ocr-progress"><span style={{ width: '72%' }} /></div>}
      {geminiResult && <div className="gemini-meta-row">
        <span>Loại: <strong>{geminiResult.displayType === 'odometer' ? 'ODO tổng' : geminiResult.displayType === 'trip' ? 'Trip' : 'Chưa rõ'}</strong></span>
        <span>Ảnh: <strong>{geminiResult.quality === 'clear' ? 'Rõ' : geminiResult.quality === 'glare' ? 'Bị lóa' : geminiResult.quality === 'blur' ? 'Bị mờ' : geminiResult.quality === 'cropped' ? 'Bị cắt' : geminiResult.quality === 'dark' ? 'Thiếu sáng' : 'Chưa rõ'}</strong></span>
      </div>}
      <button type="button" className="secondary-button compact gemini-retry-button" disabled={geminiState === 'reading'} onClick={() => file && void runGemini(file, localResult, true)}>{geminiState === 'reading' ? 'Gemini đang đọc...' : geminiResult ? 'GEMINI ĐỌC LẠI' : 'DÙNG GEMINI KIỂM TRA'}</button>
    </div>}

    {(localResult?.value != null || geminiResult?.value != null) && <div className="ocr-comparison-grid">
      {localResult?.value != null && <article className={selectedSource === 'local' ? 'selected' : selectedSource === 'verified' ? 'verified' : ''}>
        <span>OCR trên điện thoại</span>
        <strong>{localResult.value.toLocaleString('vi-VN')} km</strong>
        <small>Tin cậy {Math.round(localResult.confidence)}%</small>
        <button type="button" onClick={() => chooseValue(localResult.value, geminiResult?.value === localResult.value ? 'verified' : 'local')}>CHỌN SỐ NÀY</button>
      </article>}
      {geminiResult?.value != null && <article className={selectedSource === 'gemini' ? 'selected' : selectedSource === 'verified' ? 'verified' : ''}>
        <span>Gemini Vision</span>
        <strong>{geminiResult.value.toLocaleString('vi-VN')} km</strong>
        <small>Tin cậy {Math.round(geminiResult.confidence)}%</small>
        <button type="button" onClick={() => chooseValue(geminiResult.value, localResult?.value === geminiResult.value ? 'verified' : 'gemini')}>CHỌN SỐ NÀY</button>
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
    <button className="primary-button full" disabled={saving || aiBusy || invalidValue || invalidOrder || !file || !confirmed} onClick={() => onSubmit(phase, numericOdometer, file)}>{saving ? 'Đang lưu ảnh và kilomet...' : `LƯU ${phase === 'start' ? 'KM ĐẦU' : 'KM CUỐI'}`}</button>
  </Modal>
}

function ExpenseModal({ saving, onClose, onSubmit }: { saving: boolean; onClose: () => void; onSubmit: (type: ExpenseType, amount: number, description: string, file: File | null, fuelLiters: number) => void }) {
  const [type, setType] = useState<ExpenseType>('fuel')
  const [amount, setAmount] = useState('')
  const [description, setDescription] = useState('')
  const [fuelLiters, setFuelLiters] = useState('')
  const [file, setFile] = useState<File | null>(null)
  return <Modal title="Gửi chi phí" onClose={onClose}><div className="choice-grid">{(Object.keys(EXPENSE_LABELS) as ExpenseType[]).map((item) => <button type="button" className={type === item ? 'active' : ''} key={item} onClick={() => setType(item)}><span>{EXPENSE_ICONS[item]}</span>{EXPENSE_LABELS[item]}</button>)}</div><MediaInput label="Chụp hóa đơn hoặc phiếu thu" onChange={setFile} /><label>Số tiền<input type="number" inputMode="numeric" min="0" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="Ví dụ: 500000" /></label>{type === 'fuel' && <label>Số lít nhiên liệu<input type="number" inputMode="decimal" min="0" step="0.01" value={fuelLiters} onChange={(e) => setFuelLiters(e.target.value)} placeholder="Ví dụ: 22.5" /></label>}<label>Ghi chú<textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Nội dung chi phí" /></label>{amount && <div className="amount-preview">Số tiền: <strong>{formatCurrency(Number(amount))}</strong></div>}<button className="primary-button full" disabled={saving || safeNumber(amount) <= 0 || !file || (type === 'fuel' && safeNumber(fuelLiters) <= 0)} onClick={() => onSubmit(type, Number(amount), description, file, Number(fuelLiters))}>{saving ? 'Đang gửi...' : 'GỬI CHI PHÍ'}</button></Modal>
}

function IncidentModal({ saving, onClose, onSubmit }: { saving: boolean; onClose: () => void; onSubmit: (type: IncidentType, severity: Severity, description: string, file: File | null, audio: File | null) => void }) {
  const [type, setType] = useState<IncidentType>('breakdown')
  const [severity, setSeverity] = useState<Severity>('medium')
  const [description, setDescription] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [audio, setAudio] = useState<File | null>(null)
  return <Modal title="Báo sự cố" onClose={onClose}><div className="incident-choice">{(Object.keys(INCIDENT_LABELS) as IncidentType[]).map((item) => <button type="button" className={type === item ? 'active' : ''} key={item} onClick={() => setType(item)}>{INCIDENT_LABELS[item]}</button>)}</div><label>Mức độ<select value={severity} onChange={(e) => setSeverity(e.target.value as Severity)}><option value="low">Nhẹ — vẫn có thể di chuyển</option><option value="medium">Cần kiểm tra sớm</option><option value="high">Nghiêm trọng — nên dừng xe</option><option value="critical">Khẩn cấp / tai nạn</option></select></label><MediaInput label="Chụp ảnh tình trạng xe" onChange={setFile} /><AudioRecorder onChange={setAudio} /><label>Mô tả ngắn<textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Xe phát tiếng kêu, vị trí xảy ra..." /></label>{severity === 'critical' && <a className="emergency-call" href={`tel:${coordinatorPhone}`}>☎ GỌI ĐIỀU PHỐI NGAY</a>}<button className="danger-button full" disabled={saving || !description.trim()} onClick={() => onSubmit(type, severity, description, file, audio)}>{saving ? 'Đang gửi...' : 'GỬI BÁO SỰ CỐ'}</button></Modal>
}
