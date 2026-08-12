import { useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { useData } from '../context/DataContext'
import { formatCurrency, formatDate, formatDateTime } from '../lib/utils'
import { Modal } from '../components/Modal'
import { StatusBadge } from '../components/StatusBadge'
import { EmptyState } from '../components/EmptyState'

export function MaintenancePage() {
  const { user } = useAuth()
  const { data, updateMaintenance } = useData()
  const [creating, setCreating] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const role = user!.profile.role
  const canCreateOrExecute = role === 'fleet' || role === 'admin'
  const canDirectorReview = role === 'director' || role === 'admin'

  async function approve(id: string) {
    try {
      await updateMaintenance(id, {
        status: 'scheduled',
        director_reviewer_id: user!.id,
        director_reviewed_at: new Date().toISOString(),
        rejection_reason: null,
      })
      setMessage('Ban Giám đốc đã duyệt kế hoạch bảo dưỡng/sửa chữa.')
    } catch (error) { setMessage(error instanceof Error ? error.message : String(error)) }
  }

  async function reject(id: string) {
    const reason = window.prompt('Lý do không duyệt bảo dưỡng/sửa chữa:')?.trim()
    if (!reason) return
    try {
      await updateMaintenance(id, {
        status: 'rejected',
        director_reviewer_id: user!.id,
        director_reviewed_at: new Date().toISOString(),
        rejection_reason: reason,
      })
      setMessage('Ban Giám đốc đã từ chối đề nghị bảo dưỡng/sửa chữa.')
    } catch (error) { setMessage(error instanceof Error ? error.message : String(error)) }
  }

  return <>
    {message && <div className="inline-message">{message}<button onClick={() => setMessage(null)}>✕</button></div>}
    <section className="approval-workflow-banner"><div><span className="eyebrow">QUY TRÌNH BẢO DƯỠNG</span><h2>Hành chính đội xe đề nghị → Ban Giám đốc duyệt → Thực hiện</h2></div></section>
    <section className="toolbar"><div><strong>Lịch bảo dưỡng và sửa chữa</strong><p className="toolbar-note">Mọi đề nghị bảo dưỡng/sửa chữa mới phải được Ban Giám đốc duyệt trước khi triển khai.</p></div>{canCreateOrExecute && <button className="primary-button" onClick={() => setCreating(true)}>＋ ĐỀ NGHỊ BẢO DƯỠNG</button>}</section>
    <section className="panel">{data.maintenances.length ? <div className="table-wrap"><table><thead><tr><th>Xe</th><th>Nội dung</th><th>Lịch thực hiện</th><th>KM</th><th>Chi phí</th><th>Trạng thái</th><th>Thao tác</th></tr></thead><tbody>{data.maintenances.map((item) => {
      const vehicle = data.vehicles.find((v) => v.id === item.vehicle_id)
      const director = data.profiles.find((profile) => profile.id === item.director_reviewer_id)
      return <tr key={item.id}>
        <td><strong>{vehicle?.plate_number}</strong><small>{vehicle?.vehicle_name}</small></td>
        <td><strong>{item.type}</strong><small>{item.description}</small>{item.rejection_reason && <small className="danger-text">Lý do: {item.rejection_reason}</small>}</td>
        <td>{formatDate(item.scheduled_date)}{item.director_reviewed_at && <small>BGĐ: {formatDateTime(item.director_reviewed_at)}{director ? ` · ${director.full_name}` : ''}</small>}</td>
        <td>{item.odometer?.toLocaleString('vi-VN') ?? '—'}</td>
        <td>{item.cost ? formatCurrency(item.cost) : '—'}</td>
        <td><StatusBadge status={item.status} /></td>
        <td><div className="row-actions">
          {item.status === 'pending_director' && canDirectorReview && <><button className="approve-button" onClick={() => void approve(item.id)}>BGĐ duyệt</button><button className="reject-button" onClick={() => void reject(item.id)}>Từ chối</button></>}
          {item.status === 'scheduled' && canCreateOrExecute && <button className="primary-button compact" onClick={() => void updateMaintenance(item.id, { status: 'in_progress' })}>Bắt đầu</button>}
          {item.status === 'in_progress' && canCreateOrExecute && <button className="approve-button" onClick={() => { const cost = prompt('Chi phí thực tế (đồng):', String(item.cost ?? '')); void updateMaintenance(item.id, { status: 'completed', completed_date: new Date().toISOString().slice(0, 10), cost: cost ? Number(cost) : item.cost }) }}>Hoàn thành</button>}
        </div></td>
      </tr>
    })}</tbody></table></div> : <EmptyState icon="🔧" title="Chưa có đề nghị bảo dưỡng" />}</section>
    {creating && <MaintenanceModal requesterId={user!.id} onClose={() => setCreating(false)} />}
  </>
}

function MaintenanceModal({ requesterId, onClose }: { requesterId: string; onClose: () => void }) {
  const { data, createMaintenance } = useData()
  const [form, setForm] = useState({ vehicle_id: data.vehicles[0]?.id ?? '', type: 'Thay nhớt định kỳ', description: '', scheduled_date: new Date().toISOString().slice(0, 10), odometer: '', vendor: '', cost: '' })
  const [saving, setSaving] = useState(false)
  return <Modal title="Đề nghị bảo dưỡng / sửa chữa" onClose={onClose}><form className="form-stack" onSubmit={async (event) => {
    event.preventDefault(); setSaving(true)
    try {
      await createMaintenance({ vehicle_id: form.vehicle_id, type: form.type, description: form.description, scheduled_date: form.scheduled_date, odometer: form.odometer ? Number(form.odometer) : null, vendor: form.vendor, cost: form.cost ? Number(form.cost) : null, status: 'pending_director', requested_by: requesterId })
      onClose()
    } finally { setSaving(false) }
  }}>
    <label>Xe<select value={form.vehicle_id} onChange={(e) => setForm({ ...form, vehicle_id: e.target.value })}>{data.vehicles.map((v) => <option key={v.id} value={v.id}>{v.plate_number} — {v.vehicle_name}</option>)}</select></label>
    <label>Hạng mục<input value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })} required /></label>
    <label>Ngày dự kiến<input type="date" value={form.scheduled_date} onChange={(e) => setForm({ ...form, scheduled_date: e.target.value })} required /></label>
    <label>Mốc KM<input type="number" min="0" value={form.odometer} onChange={(e) => setForm({ ...form, odometer: e.target.value })} /></label>
    <label>Đơn vị thực hiện<input value={form.vendor} onChange={(e) => setForm({ ...form, vendor: e.target.value })} /></label>
    <label>Chi phí dự kiến<input type="number" min="0" value={form.cost} onChange={(e) => setForm({ ...form, cost: e.target.value })} /></label>
    <label>Mô tả<textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></label>
    <div className="approval-route-preview"><strong>Sau khi gửi:</strong> đề nghị sẽ chuyển Ban Giám đốc duyệt trước khi Hành chính đội xe được bắt đầu.</div>
    <button className="primary-button full" disabled={saving}>{saving ? 'Đang gửi...' : 'GỬI BGĐ DUYỆT'}</button>
  </form></Modal>
}
