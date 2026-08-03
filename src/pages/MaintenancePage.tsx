import { useState } from 'react'
import { useData } from '../context/DataContext'
import { formatCurrency, formatDate } from '../lib/utils'
import type { Maintenance } from '../types/models'
import { Modal } from '../components/Modal'
import { StatusBadge } from '../components/StatusBadge'
import { EmptyState } from '../components/EmptyState'

export function MaintenancePage() {
  const { data, updateMaintenance } = useData()
  const [creating, setCreating] = useState(false)
  return <>
    <section className="toolbar"><div><strong>Lịch bảo dưỡng và sửa chữa</strong><p className="toolbar-note">Tạo lịch trước khi xe đến hạn theo ngày hoặc kilomet.</p></div><button className="primary-button" onClick={() => setCreating(true)}>＋ TẠO LỊCH</button></section>
    <section className="panel">{data.maintenances.length ? <div className="table-wrap"><table><thead><tr><th>Xe</th><th>Nội dung</th><th>Lịch thực hiện</th><th>KM</th><th>Chi phí</th><th>Trạng thái</th><th></th></tr></thead><tbody>{data.maintenances.map((item) => {
      const vehicle = data.vehicles.find((v) => v.id === item.vehicle_id)
      return <tr key={item.id}><td><strong>{vehicle?.plate_number}</strong><small>{vehicle?.vehicle_name}</small></td><td><strong>{item.type}</strong><small>{item.description}</small></td><td>{formatDate(item.scheduled_date)}</td><td>{item.odometer?.toLocaleString('vi-VN') ?? '—'}</td><td>{item.cost ? formatCurrency(item.cost) : '—'}</td><td><StatusBadge status={item.status} /></td><td><div className="row-actions">{item.status === 'scheduled' && <button className="primary-button compact" onClick={() => void updateMaintenance(item.id, { status: 'in_progress' })}>Bắt đầu</button>}{item.status === 'in_progress' && <button className="approve-button" onClick={() => { const cost = prompt('Chi phí thực tế (đồng):', String(item.cost ?? '')); void updateMaintenance(item.id, { status: 'completed', completed_date: new Date().toISOString().slice(0, 10), cost: cost ? Number(cost) : item.cost }) }}>Hoàn thành</button>}</div></td></tr>
    })}</tbody></table></div> : <EmptyState icon="🔧" title="Chưa có lịch bảo dưỡng" />}</section>
    {creating && <MaintenanceModal onClose={() => setCreating(false)} />}
  </>
}

function MaintenanceModal({ onClose }: { onClose: () => void }) {
  const { data, createMaintenance, updateVehicle } = useData()
  const [form, setForm] = useState({ vehicle_id: data.vehicles[0]?.id ?? '', type: 'Thay nhớt định kỳ', description: '', scheduled_date: new Date().toISOString().slice(0, 10), odometer: '', vendor: '', cost: '' })
  const [saving, setSaving] = useState(false)
  return <Modal title="Tạo lịch bảo dưỡng" onClose={onClose}><form className="form-stack" onSubmit={async (event) => { event.preventDefault(); setSaving(true); try { await createMaintenance({ vehicle_id: form.vehicle_id, type: form.type, description: form.description, scheduled_date: form.scheduled_date, odometer: form.odometer ? Number(form.odometer) : null, vendor: form.vendor, cost: form.cost ? Number(form.cost) : null, status: 'scheduled' }); await updateVehicle(form.vehicle_id, { next_maintenance_date: form.scheduled_date, next_maintenance_odometer: form.odometer ? Number(form.odometer) : null }); onClose() } finally { setSaving(false) } }}><label>Xe<select value={form.vehicle_id} onChange={(e) => setForm({ ...form, vehicle_id: e.target.value })}>{data.vehicles.map((v) => <option key={v.id} value={v.id}>{v.plate_number} — {v.vehicle_name}</option>)}</select></label><label>Hạng mục<input value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })} required /></label><label>Ngày dự kiến<input type="date" value={form.scheduled_date} onChange={(e) => setForm({ ...form, scheduled_date: e.target.value })} required /></label><label>Mốc KM<input type="number" min="0" value={form.odometer} onChange={(e) => setForm({ ...form, odometer: e.target.value })} /></label><label>Đơn vị thực hiện<input value={form.vendor} onChange={(e) => setForm({ ...form, vendor: e.target.value })} /></label><label>Chi phí dự kiến<input type="number" min="0" value={form.cost} onChange={(e) => setForm({ ...form, cost: e.target.value })} /></label><label>Mô tả<textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></label><button className="primary-button full" disabled={saving}>{saving ? 'Đang lưu...' : 'TẠO LỊCH'}</button></form></Modal>
}
