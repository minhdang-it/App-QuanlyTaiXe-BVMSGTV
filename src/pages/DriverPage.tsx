import { useEffect, useMemo, useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { useData } from '../context/DataContext'
import { EXPENSE_ICONS, EXPENSE_LABELS, INCIDENT_LABELS, PURPOSE_LABELS } from '../lib/constants'
import { formatCurrency, formatDateTime, googleMapsDirectionsUrl, googleMapsLocationUrl, requestCurrentLocation, safeNumber, todayKey, type ConfirmedLocation } from '../lib/utils'
import type { ExpenseType, IncidentType, Severity, Trip } from '../types/models'
import { Modal } from '../components/Modal'
import { MediaInput } from '../components/MediaInput'
import { StatusBadge } from '../components/StatusBadge'
import { NetworkBanner } from '../components/NetworkBanner'
import { EmptyState } from '../components/EmptyState'
import { AudioRecorder } from '../components/AudioRecorder'
import { BrandLogo } from '../components/BrandLogo'
import { readOdometerFromImage } from '../lib/odometerOcr'

const coordinatorPhone = import.meta.env.VITE_COORDINATOR_PHONE || '0900000000'

type Dialog = 'checklist' | 'odometer' | 'startTrip' | 'expense' | 'incident' | 'trip' | null

export function DriverPage() {
  const { user, logout, mode } = useAuth()
  const { data, loading, createChecklist, submitOdometer, createExpense, createIncident, updateTrip } = useData()
  const [dialog, setDialog] = useState<Dialog>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const trips = useMemo(() => data.trips
    .filter((trip) => trip.driver_id === user!.id && trip.status !== 'cancelled')
    .sort((a, b) => new Date(a.scheduled_start).getTime() - new Date(b.scheduled_start).getTime()), [data.trips, user])

  const currentTrip = trips.find((trip) => ['assigned', 'accepted', 'ready', 'active'].includes(trip.status)) ?? null
  const todayCompleted = trips.filter((trip) => trip.status === 'completed' && todayKey(new Date(trip.ended_at ?? trip.updated_at)) === todayKey())
  const vehicle = data.vehicles.find((item) => item.id === currentTrip?.vehicle_id) ?? data.vehicles.find((item) => item.regular_driver_id === user!.id) ?? null

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
    <main className="driver-app">
      <NetworkBanner />
      <header className="driver-header">
        <BrandLogo className="driver-brand" compact />
        <button className="driver-user" onClick={() => void logout()}><span>{user?.profile.full_name}</span><small>{mode === 'demo' ? 'Demo · Đăng xuất' : 'Tài xế · Đăng xuất'}</small></button>
      </header>

      <section className="driver-content">
        <div className="welcome-row"><div><p>Xin chào</p><h1>{user?.profile.full_name}</h1></div><div className="date-chip">{new Intl.DateTimeFormat('vi-VN', { weekday: 'long', day: '2-digit', month: '2-digit' }).format(new Date())}</div></div>

        {message && <button type="button" className="driver-toast" onClick={() => setMessage(null)}><span>{message}</span><strong>✕</strong></button>}

        {loading ? <div className="driver-trip-card skeleton-card" /> : currentTrip ? (
          <article className="driver-trip-card" onClick={() => setDialog('trip')}>
            <div className="trip-card-top"><span>CHUYẾN HIỆN TẠI</span><StatusBadge status={currentTrip.status} /></div>
            <h2>{vehicle?.plate_number ?? 'Chưa gán xe'} · {vehicle?.vehicle_name}</h2>
            <div className="route-view"><div className="route-dot start" /><div><small>Điểm đón</small><strong>{currentTrip.pickup}</strong></div></div>
            <div className="route-line" />
            <div className="route-view"><div className="route-dot end" /><div><small>Điểm đến</small><strong>{currentTrip.destination}</strong></div></div>
            <div className="trip-meta"><span>🕒 {formatDateTime(currentTrip.scheduled_start)}</span><span>🏥 {PURPOSE_LABELS[currentTrip.purpose]}</span></div>
          </article>
        ) : <EmptyState icon="🚐" title="Chưa có chuyến được giao" description="Khi điều phối tạo chuyến, thông tin sẽ xuất hiện tại đây." />}

        <section className="driver-actions" aria-label="Thao tác tài xế">
          <button className="driver-action primary" onClick={() => void primaryTripAction()} disabled={saving || !currentTrip}><span className="action-icon">▶</span><strong>{primaryLabel()}</strong><small>Thao tác theo tiến độ chuyến</small></button>
          <button className="driver-action" onClick={() => setDialog('odometer')} disabled={!currentTrip || !['ready', 'active'].includes(currentTrip.status)}><span className="action-icon">📷</span><strong>CHỤP ĐỒNG HỒ KM</strong><small>Km đầu hoặc cuối chuyến</small></button>
          <button className="driver-action" onClick={() => setDialog('expense')} disabled={!vehicle}><span className="action-icon">🧾</span><strong>GỬI CHI PHÍ</strong><small>Hóa đơn và số tiền</small></button>
          <button className="driver-action danger" onClick={() => setDialog('incident')} disabled={!vehicle}><span className="action-icon">⚠️</span><strong>BÁO SỰ CỐ</strong><small>Ảnh, ghi âm và vị trí</small></button>
        </section>

        {currentTrip?.status === 'active' && <a className="maps-launch-button" href={googleMapsDirectionsUrl(currentTrip.destination, currentTrip.start_lat != null && currentTrip.start_lng != null ? { lat: currentTrip.start_lat, lng: currentTrip.start_lng } : null)} target="_blank" rel="noreferrer">🗺 TIẾP TỤC DẪN ĐƯỜNG GOOGLE MAPS</a>}

        <div className="driver-summary"><span>Chuyến hoàn thành hôm nay</span><strong>{todayCompleted.length}</strong></div>
      </section>

      <a className="call-coordinator" href={`tel:${coordinatorPhone}`}>☎ GỌI ĐIỀU PHỐI</a>

      {dialog === 'trip' && currentTrip && <TripDetailModal trip={currentTrip} vehicleName={`${vehicle?.plate_number ?? ''} ${vehicle?.vehicle_name ?? ''}`} onClose={() => setDialog(null)} />}
      {dialog === 'checklist' && currentTrip && <ChecklistModal trip={currentTrip} saving={saving} onClose={() => setDialog(null)} onSubmit={(values) => guarded(async () => { await createChecklist({ ...values, trip_id: currentTrip.id, driver_id: user!.id }) }, 'Checklist đã được ghi nhận.')} />}
      {dialog === 'startTrip' && currentTrip && <StartTripModal trip={currentTrip} saving={saving} onClose={() => setDialog(null)} onSubmit={startTrip} />}
      {dialog === 'odometer' && currentTrip && <OdometerModal trip={currentTrip} vehicleOdometer={vehicle?.odometer ?? 0} saving={saving} onClose={() => setDialog(null)} onSubmit={(phase, odometer, file) => guarded(async () => {
        if (phase === 'start' && odometer < (vehicle?.odometer ?? 0) - 10) throw new Error('Kilomet đầu nhỏ bất thường so với hồ sơ xe.')
        if (phase === 'end' && odometer < (currentTrip.start_odometer ?? 0)) throw new Error('Kilomet cuối không được nhỏ hơn kilomet đầu.')
        await submitOdometer(currentTrip, phase, odometer, file)
      }, `Đã lưu kilomet ${phase === 'start' ? 'đầu' : 'cuối'} chuyến.`)} />}
      {dialog === 'expense' && vehicle && <ExpenseModal saving={saving} onClose={() => setDialog(null)} onSubmit={(type, amount, description, file, fuelLiters) => guarded(async () => {
        await createExpense({ trip_id: currentTrip?.id ?? null, vehicle_id: vehicle.id, driver_id: user!.id, type, amount, fuel_liters: fuelLiters || null, fuel_unit_price: fuelLiters ? amount / fuelLiters : null, description, status: 'pending', expense_date: todayKey() }, file)
      }, 'Chi phí đã gửi và đang chờ kế toán duyệt.')} />}
      {dialog === 'incident' && vehicle && <IncidentModal saving={saving} onClose={() => setDialog(null)} onSubmit={(type, severity, description, file, audio) => guarded(async () => {
        await createIncident({ trip_id: currentTrip?.id ?? null, vehicle_id: vehicle.id, driver_id: user!.id, type, severity, description, status: 'reported' }, { file, secondFile: audio })
      }, 'Đã gửi báo cáo sự cố đến điều phối.')} />}
    </main>
  )
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
    void locate()
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
        <div><strong>{locating ? 'Đang lấy vị trí GPS...' : location ? 'Đã xác định vị trí hiện tại' : 'Chưa xác định vị trí'}</strong><span>{location ? `Độ chính xác khoảng ${Math.round(location.accuracy)} m` : 'Cần bật GPS và cấp quyền Vị trí cho trình duyệt.'}</span></div>
        <button type="button" className="secondary-button compact" disabled={locating || saving} onClick={() => void locate()}>{locating ? 'ĐANG LẤY...' : location ? 'LẤY LẠI' : 'LẤY VỊ TRÍ'}</button>
      </div>
      {location && <div className="location-coordinates"><code>{location.lat.toFixed(6)}, {location.lng.toFixed(6)}</code><a href={googleMapsLocationUrl(location)} target="_blank" rel="noreferrer">Xem vị trí hiện tại</a></div>}
      {location && location.accuracy > 200 && <div className="form-warning">GPS đang có sai số lớn. Nên ra khu vực thoáng và bấm “Lấy lại” trước khi bắt đầu.</div>}
      {locationError && <div className="form-error">{locationError}</div>}
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
  const [ocrConfidence, setOcrConfidence] = useState<number | null>(null)

  const baseline = phase === 'start' ? vehicleOdometer : (trip.start_odometer ?? vehicleOdometer)

  function selectPhase(next: 'start' | 'end') {
    setPhase(next)
    setOdometer(String(next === 'start' ? trip.start_odometer ?? '' : trip.end_odometer ?? ''))
    setOcrState('idle')
    setOcrMessage('')
    setOcrConfidence(null)
  }

  async function processPhoto(nextFile: File | null) {
    setFile(nextFile)
    setOcrConfidence(null)
    if (!nextFile) {
      setOcrState('idle')
      setOcrProgress(0)
      setOcrMessage('')
      return
    }

    setOcrState('reading')
    setOcrProgress(0.03)
    setOcrMessage('Đang nhận diện số kilomet...')
    try {
      const result = await readOdometerFromImage(nextFile, baseline, (progress, status) => {
        setOcrProgress(Math.max(0.03, progress))
        setOcrMessage(status === 'recognizing text' ? 'Đang đọc dãy số trên cụm đồng hồ...' : 'Đang chuẩn bị bộ nhận diện...')
      })
      setOcrConfidence(result.confidence)
      if (result.value != null) {
        setOdometer(String(result.value))
        const suspicious = baseline > 0 && (result.value < baseline - 50 || result.value > baseline + 15_000)
        setOcrState(suspicious || result.confidence < 45 ? 'warning' : 'success')
        setOcrMessage(suspicious
          ? `Đã đọc ${result.value.toLocaleString('vi-VN')} km nhưng chênh lệch lớn so với hồ sơ xe. Vui lòng kiểm tra lại.`
          : `Đã tự điền ${result.value.toLocaleString('vi-VN')} km. Vui lòng nhìn ảnh và xác nhận trước khi lưu.`)
      } else {
        setOcrState('warning')
        setOcrMessage('Chưa đọc rõ số KM. Hãy chụp gần hơn, tránh phản sáng hoặc nhập số thủ công.')
      }
    } catch (reason) {
      setOcrState('error')
      setOcrMessage(reason instanceof Error ? `Không đọc được tự động: ${reason.message}` : 'Không đọc được tự động. Vui lòng nhập số KM thủ công.')
    }
  }

  const numericOdometer = Number(odometer)
  const invalidValue = !odometer.trim() || !Number.isSafeInteger(numericOdometer) || numericOdometer < 0
  const invalidOrder = phase === 'end' && numericOdometer < (trip.start_odometer ?? 0)

  return <Modal title="Chụp đồng hồ kilomet" onClose={onClose}>
    <div className="segment-control">
      <button type="button" disabled={trip.status === 'active'} className={phase === 'start' ? 'active' : ''} onClick={() => selectPhase('start')}>KM ĐẦU</button>
      <button type="button" disabled={trip.status !== 'active'} className={phase === 'end' ? 'active' : ''} onClick={() => selectPhase('end')}>KM CUỐI</button>
    </div>

    <div className="odometer-guide">
      <strong>📸 Cách chụp để tự đọc chính xác</strong>
      <span>Đưa dãy số ODO/KM vào giữa ảnh, chụp gần, giữ máy thẳng và tránh ánh sáng phản chiếu.</span>
    </div>

    <MediaInput label="Chụp cụm đồng hồ — hệ thống sẽ tự đọc KM" onChange={processPhoto} />

    {ocrState !== 'idle' && <div className={`ocr-status ${ocrState}`}>
      {ocrState === 'reading' && <div className="ocr-progress"><span style={{ width: `${Math.round(ocrProgress * 100)}%` }} /></div>}
      <div><strong>{ocrState === 'reading' ? 'AI OCR đang đọc ảnh' : ocrState === 'success' ? 'Đã nhận diện KM' : ocrState === 'warning' ? 'Cần kiểm tra lại' : 'OCR chưa thành công'}</strong><span>{ocrMessage}</span></div>
      {ocrConfidence != null && <small>Độ tin cậy tham khảo: {Math.round(ocrConfidence)}%</small>}
    </div>}

    <label>Số kilomet xác nhận
      <input type="number" inputMode="numeric" min="0" step="1" value={odometer} onChange={(e) => setOdometer(e.target.value.replace(/\D/g, ''))} placeholder="Hệ thống tự điền hoặc nhập thủ công" />
    </label>
    <p className="form-help">Số KM được OCR tự điền từ ảnh. Tài xế cần kiểm tra lại vì màn hình bị lóa hoặc ảnh rung có thể làm nhận diện sai.</p>
    {invalidOrder && <div className="form-error">Kilomet cuối không được nhỏ hơn kilomet đầu {Number(trip.start_odometer).toLocaleString('vi-VN')} km.</div>}
    <button className="primary-button full" disabled={saving || ocrState === 'reading' || invalidValue || invalidOrder || !file} onClick={() => onSubmit(phase, numericOdometer, file)}>{saving ? 'Đang lưu ảnh và kilomet...' : `LƯU ${phase === 'start' ? 'KM ĐẦU' : 'KM CUỐI'}`}</button>
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
