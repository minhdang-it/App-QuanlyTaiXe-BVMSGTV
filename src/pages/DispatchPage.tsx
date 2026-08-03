import { useMemo, useState } from 'react'
import { useData } from '../context/DataContext'
import { defaultTripDateTime } from '../lib/demoData'
import { PURPOSE_LABELS } from '../lib/constants'
import { formatDateTime, toDateTimeLocal } from '../lib/utils'
import type { CreateTripInput, TripPurpose } from '../types/models'
import { Modal } from '../components/Modal'
import { StatusBadge } from '../components/StatusBadge'
import { EmptyState } from '../components/EmptyState'

export function DispatchPage() {
  const { data, createTrip, updateTrip } = useData()
  const [showCreate, setShowCreate] = useState(false)
  const [filter, setFilter] = useState('all')
  const [message, setMessage] = useState<string | null>(null)

  const trips = useMemo(() => data.trips
    .filter((trip) => filter === 'all' || trip.status === filter)
    .sort((a, b) => new Date(b.scheduled_start).getTime() - new Date(a.scheduled_start).getTime()), [data.trips, filter])

  return <>
    {message && <div className="inline-message">{message}<button onClick={() => setMessage(null)}>✕</button></div>}
    <section className="toolbar"><div className="filter-tabs"><button className={filter === 'all' ? 'active' : ''} onClick={() => setFilter('all')}>Tất cả</button><button className={filter === 'assigned' ? 'active' : ''} onClick={() => setFilter('assigned')}>Đã giao</button><button className={filter === 'active' ? 'active' : ''} onClick={() => setFilter('active')}>Đang chạy</button><button className={filter === 'completed' ? 'active' : ''} onClick={() => setFilter('completed')}>Hoàn thành</button></div><button className="primary-button" onClick={() => setShowCreate(true)}>＋ TẠO CHUYẾN</button></section>
    <section className="panel">
      <div className="panel-header"><div><h2>Danh sách điều xe</h2><p>Mỗi chuyến chỉ được bắt đầu sau checklist và kilomet đầu.</p></div><span className="count-pill">{trips.length}</span></div>
      {trips.length ? <div className="trip-list">{trips.map((trip) => {
        const vehicle = data.vehicles.find((v) => v.id === trip.vehicle_id)
        const driver = data.profiles.find((p) => p.id === trip.driver_id)
        const checklist = data.checklists.find((item) => item.trip_id === trip.id)
        const checklistHasIssue = checklist && !(checklist.fuel_ok && checklist.tires_ok && checklist.lights_horn_ok && checklist.vehicle_clean && checklist.documents_ok)
        return <article className="dispatch-card" key={trip.id}><div className="dispatch-time"><strong>{new Intl.DateTimeFormat('vi-VN', { hour: '2-digit', minute: '2-digit' }).format(new Date(trip.scheduled_start))}</strong><small>{new Intl.DateTimeFormat('vi-VN', { day: '2-digit', month: '2-digit' }).format(new Date(trip.scheduled_start))}</small></div><div className="dispatch-main"><div className="dispatch-title"><h3>{vehicle?.plate_number} · {driver?.full_name}</h3><StatusBadge status={trip.status} /></div><p><strong>{trip.pickup}</strong> → <strong>{trip.destination}</strong></p>{checklistHasIssue && <div className="checklist-alert">⚠ Checklist có mục Không: {checklist?.notes || 'Chưa có ghi chú'}</div>}<div className="dispatch-meta"><span>🏥 {PURPOSE_LABELS[trip.purpose]}</span><span>⏱ Về: {formatDateTime(trip.expected_end)}</span>{trip.contact_phone && <a href={`tel:${trip.contact_phone}`}>☎ {trip.contact_phone}</a>}</div></div><div className="dispatch-actions">{trip.status === 'accepted' && trip.checklist_completed && <button className="approve-button" onClick={async () => { await updateTrip(trip.id, { status: 'ready' }); setMessage('Đã duyệt ngoại lệ, tài xế có thể tiếp tục.') }}>Duyệt xuất phát</button>}{trip.status !== 'completed' && trip.status !== 'cancelled' && <button className="text-button danger-text" onClick={async () => { if (confirm('Hủy chuyến này?')) { await updateTrip(trip.id, { status: 'cancelled' }); setMessage('Đã hủy chuyến.') } }}>Hủy chuyến</button>}</div></article>
      })}</div> : <EmptyState icon="🚐" title="Không có chuyến phù hợp" />}
    </section>
    {showCreate && <CreateTripModal onClose={() => setShowCreate(false)} onSubmit={async (input) => { await createTrip(input); setShowCreate(false); setMessage('Đã điều xe và giao chuyến cho tài xế.') }} />}
  </>
}

function CreateTripModal({ onClose, onSubmit }: { onClose: () => void; onSubmit: (input: CreateTripInput) => Promise<void> }) {
  const { data } = useData()
  const eligibleVehicles = data.vehicles.filter((v) => !['maintenance', 'out_of_service'].includes(v.status))
  const drivers = data.profiles.filter((p) => p.role === 'driver' && p.active)
  const initialStart = defaultTripDateTime || toDateTimeLocal(new Date())
  const defaultEndDate = new Date(new Date(initialStart).getTime() + 4 * 60 * 60 * 1000)
  const [form, setForm] = useState({
    vehicle_id: eligibleVehicles[0]?.id ?? '', driver_id: drivers[0]?.id ?? '', purpose: 'community_exam' as TripPurpose,
    pickup: 'Bệnh viện Mắt Sài Gòn Trà Vinh', destination: '', contact_name: '', contact_phone: '', passenger_count: '1',
    scheduled_start: initialStart, expected_end: toDateTimeLocal(defaultEndDate), notes: '',
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function submit(event: React.FormEvent) {
    event.preventDefault(); setSaving(true); setError(null)
    try {
      const newStart = new Date(form.scheduled_start).getTime()
      const newEnd = form.expected_end ? new Date(form.expected_end).getTime() : newStart + 60 * 60 * 1000
      if (!Number.isFinite(newStart) || !Number.isFinite(newEnd) || newEnd <= newStart) throw new Error('Thời gian dự kiến về phải sau giờ xuất phát.')
      const conflict = data.trips.some((trip) => {
        if (trip.status === 'cancelled' || trip.status === 'completed') return false
        if (trip.vehicle_id !== form.vehicle_id && trip.driver_id !== form.driver_id) return false
        const existingStart = new Date(trip.scheduled_start).getTime()
        const existingEnd = trip.expected_end ? new Date(trip.expected_end).getTime() : existingStart + 60 * 60 * 1000
        return newStart < existingEnd && existingStart < newEnd
      })
      if (conflict) throw new Error('Xe hoặc tài xế đã có chuyến trùng khoảng thời gian này.')
      await onSubmit({ ...form, passenger_count: Number(form.passenger_count), scheduled_start: new Date(newStart).toISOString(), expected_end: new Date(newEnd).toISOString() })
    } catch (err) { setError(err instanceof Error ? err.message : String(err)) } finally { setSaving(false) }
  }

  return <Modal title="Tạo lịch điều xe" onClose={onClose} wide><form className="form-grid" onSubmit={submit}><label>Chọn xe<select value={form.vehicle_id} onChange={(e) => setForm({ ...form, vehicle_id: e.target.value })} required>{eligibleVehicles.map((v) => <option key={v.id} value={v.id}>{v.plate_number} — {v.vehicle_name}</option>)}</select></label><label>Tài xế<select value={form.driver_id} onChange={(e) => setForm({ ...form, driver_id: e.target.value })} required>{drivers.map((p) => <option key={p.id} value={p.id}>{p.full_name}</option>)}</select></label><label>Loại chuyến<select value={form.purpose} onChange={(e) => setForm({ ...form, purpose: e.target.value as TripPurpose })}>{(Object.keys(PURPOSE_LABELS) as TripPurpose[]).map((key) => <option key={key} value={key}>{PURPOSE_LABELS[key]}</option>)}</select></label><label>Số người<input type="number" min="0" value={form.passenger_count} onChange={(e) => setForm({ ...form, passenger_count: e.target.value })} /></label><label>Giờ xuất phát<input type="datetime-local" value={form.scheduled_start} onChange={(e) => setForm({ ...form, scheduled_start: e.target.value })} required /></label><label>Dự kiến về<input type="datetime-local" value={form.expected_end} onChange={(e) => setForm({ ...form, expected_end: e.target.value })} /></label><label className="span-2">Điểm đón<input value={form.pickup} onChange={(e) => setForm({ ...form, pickup: e.target.value })} required /></label><label className="span-2">Điểm đến<input value={form.destination} onChange={(e) => setForm({ ...form, destination: e.target.value })} placeholder="Xã, bệnh viện hoặc địa chỉ" required /></label><label>Người liên hệ<input value={form.contact_name} onChange={(e) => setForm({ ...form, contact_name: e.target.value })} /></label><label>Số điện thoại<input inputMode="tel" value={form.contact_phone} onChange={(e) => setForm({ ...form, contact_phone: e.target.value })} /></label><label className="span-2">Ghi chú<textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} placeholder="Vật tư cần mang, yêu cầu đón bệnh nhân..." /></label>{!eligibleVehicles.length && <div className="form-error span-2">Không có xe đủ điều kiện để xếp lịch. Hãy kiểm tra xe đang sửa hoặc ngừng sử dụng.</div>}{!drivers.length && <div className="form-error span-2">Chưa có tài khoản tài xế đang hoạt động.</div>}{error && <div className="form-error span-2">{error}</div>}<div className="form-actions span-2"><button type="button" className="secondary-button" onClick={onClose}>Hủy</button><button className="primary-button" disabled={saving || !eligibleVehicles.length || !drivers.length}>{saving ? 'Đang tạo...' : 'GIAO CHUYẾN'}</button></div></form></Modal>
}
