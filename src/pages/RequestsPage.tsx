import { useMemo, useState } from 'react'
import { Modal } from '../components/Modal'
import { StatusBadge } from '../components/StatusBadge'
import { VietnamDateInput } from '../components/VietnamDateInput'
import { mergeSelectedPlanFiles, PlanAttachmentsViewer, SelectedPlanFiles } from '../components/PlanAttachments'
import { useAuth } from '../context/AuthContext'
import { useData } from '../context/DataContext'
import { PURPOSE_LABELS } from '../lib/constants'
import { formatDateTime, getErrorMessage } from '../lib/utils'
import type { CreateVehicleRequestInput, TripPurpose, VehicleRequest } from '../types/models'

const EMPTY_REQUEST: CreateVehicleRequestInput = {
  purpose: 'patient_pickup',
  pickup: 'Bệnh viện mắt Sài Gòn Trà Vinh',
  destination: '',
  contact_name: '',
  contact_phone: '',
  passenger_count: 1,
  scheduled_start: '',
  expected_end: '',
  notes: '',
  department: '',
}

export function RequestsPage() {
  const { user } = useAuth()
  const { data, createVehicleRequest, updateVehicleRequest } = useData()
  const [creating, setCreating] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [filter, setFilter] = useState<'all' | VehicleRequest['status']>('all')
  const role = user!.profile.role
  const canCreate = role === 'department_head' || role === 'admin'
  const canReview = role === 'fleet' || role === 'admin'

  const requests = useMemo(() => data.vehicleRequests
    .filter((item) => role !== 'department_head' || item.requester_id === user!.id)
    .filter((item) => filter === 'all' || item.status === filter)
    .sort((a, b) => b.created_at.localeCompare(a.created_at)), [data.vehicleRequests, filter, role, user])

  async function approve(item: VehicleRequest) {
    try {
      await updateVehicleRequest(item.id, {
        status: 'fleet_approved',
        fleet_reviewer_id: user!.id,
        fleet_reviewed_at: new Date().toISOString(),
        rejection_reason: null,
      })
      setMessage('Hành chính đội xe đã duyệt đề nghị. Điều phối có thể tạo chuyến từ đề nghị này.')
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Không thể duyệt đề nghị.')
    }
  }

  async function reject(item: VehicleRequest) {
    const reason = window.prompt('Lý do từ chối đề nghị điều xe:')?.trim()
    if (!reason) return
    try {
      await updateVehicleRequest(item.id, {
        status: 'rejected',
        fleet_reviewer_id: user!.id,
        fleet_reviewed_at: new Date().toISOString(),
        rejection_reason: reason,
      })
      setMessage('Đã từ chối đề nghị điều xe.')
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Không thể từ chối đề nghị.')
    }
  }

  return <>
    {message && <div className="inline-message">{message}<button onClick={() => setMessage(null)}>✕</button></div>}

    {role === 'department_head' ? <section className="request-hero-card request-hero-compact">
      <div>
        <span className="eyebrow">ĐỀ NGHỊ TỪ KHOA / PHÒNG</span>
        <h2>Gửi đề nghị sử dụng xe</h2>
        <p>Trưởng khoa gửi nhu cầu xe kèm văn bản/kế hoạch. Hành chính đội xe sẽ kiểm tra và duyệt trước khi Điều phối tạo chuyến.</p>
      </div>
      {canCreate && <button className="primary-button" onClick={() => setCreating(true)}>＋ GỬI ĐỀ NGHỊ XE</button>}
    </section> : <section className="toolbar request-review-heading">
      <div>
        <span className="eyebrow">ĐỀ NGHỊ TỪ KHOA / PHÒNG</span>
        <h2 className="toolbar-title">{role === 'fleet' ? 'Hành chính duyệt đề nghị xe' : 'Theo dõi đề nghị xe'}</h2>
        <p className="toolbar-note">{role === 'fleet' ? 'Các đề nghị do Trưởng khoa/đơn vị gửi sẽ xuất hiện tại đây để Hành chính duyệt hoặc từ chối.' : 'Quản trị theo dõi toàn bộ đề nghị; Điều phối nhận các đề nghị đã duyệt trực tiếp trong trang Điều xe.'}</p>
      </div>
      <span className="count-pill">{requests.length} đề nghị</span>
    </section>}

    <section className="toolbar request-toolbar">
      <div className="filter-tabs">
        {([
          ['all', 'Tất cả'],
          ['pending_fleet', 'Chờ Hành chính'],
          ['fleet_approved', 'Đã duyệt'],
          ['converted', 'Đã tạo chuyến'],
          ['rejected', 'Từ chối'],
        ] as const).map(([value, label]) => <button key={value} className={filter === value ? 'active' : ''} onClick={() => setFilter(value)}>{label}</button>)}
      </div>
    </section>

    <section className="request-grid">
      {requests.map((item) => {
        const requester = data.profiles.find((profile) => profile.id === item.requester_id)
        const reviewer = data.profiles.find((profile) => profile.id === item.fleet_reviewer_id)
        const canBypassDirector = Boolean(item.plan_document_url || item.plan_attachments?.length)
        return <article key={item.id} className="request-card">
          <div className="request-card-head">
            <div><span className="eyebrow">{PURPOSE_LABELS[item.purpose]}</span><h3>{item.pickup} → {item.destination}</h3></div>
            <StatusBadge status={item.status} />
          </div>
          <div className="request-meta-grid">
            <div><span>Người đề nghị</span><strong>{requester?.full_name ?? 'Không rõ'}</strong></div>
            <div><span>Khoa/đơn vị</span><strong>{item.department || requester?.department || 'Chưa cập nhật'}</strong></div>
            <div><span>Khởi hành</span><strong>{formatDateTime(item.scheduled_start)}</strong></div>
            <div><span>Số người</span><strong>{item.passenger_count ?? '—'}</strong></div>
          </div>
          {item.notes && <p className="request-note">{item.notes}</p>}
          <div className="request-document-row">
            {(item.plan_attachments?.length || item.plan_document_url)
              ? <PlanAttachmentsViewer attachments={item.plan_attachments} legacyUrl={item.plan_document_url} legacyPath={item.plan_document_path} compact />
              : <span className="request-no-document">Chưa đính kèm văn bản</span>}
            {canBypassDirector && <span className="approval-route-chip">Có kế hoạch · Hành chính duyệt trực tiếp, không qua BGĐ</span>}
          </div>
          {item.fleet_reviewed_at && <small>Hành chính xử lý: {formatDateTime(item.fleet_reviewed_at)}{reviewer ? ` · ${reviewer.full_name}` : ''}</small>}
          {item.rejection_reason && <div className="rejection-box"><strong>Lý do từ chối:</strong> {item.rejection_reason}</div>}
          {canReview && item.status === 'pending_fleet' && <div className="request-actions">
            <button className="approve-button" onClick={() => void approve(item)}>Hành chính duyệt</button>
            <button className="reject-button" onClick={() => void reject(item)}>Từ chối</button>
          </div>}
        </article>
      })}
      {!requests.length && <div className="empty-state request-empty">{role === 'department_head' ? 'Bạn chưa gửi đề nghị xe nào.' : role === 'fleet' ? 'Chưa có đề nghị nào từ khoa/phòng gửi đến Hành chính.' : 'Chưa có đề nghị xe từ khoa/phòng.'}</div>}
    </section>

    {creating && <CreateRequestModal
      profileDepartment={user!.profile.department ?? ''}
      onClose={() => setCreating(false)}
      onSubmit={async (input, planFiles) => {
        await createVehicleRequest(input, planFiles)
        setCreating(false)
        setMessage('Đã gửi đề nghị điều hành xe đến Hành chính đội xe.')
      }}
    />}
  </>
}

function CreateRequestModal({
  profileDepartment,
  onClose,
  onSubmit,
}: {
  profileDepartment: string
  onClose: () => void
  onSubmit: (input: CreateVehicleRequestInput, planFiles: File[]) => Promise<void>
}) {
  const [form, setForm] = useState<CreateVehicleRequestInput>({ ...EMPTY_REQUEST, department: profileDepartment })
  const [planFiles, setPlanFiles] = useState<File[]>([])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  return <Modal title="Gửi đề nghị điều hành xe" onClose={onClose} wide>
    <form className="form-stack" onSubmit={async (event) => {
      event.preventDefault()
      if (!planFiles.length) { setError('Vui lòng đính kèm ít nhất một văn bản, hình ảnh hoặc kế hoạch để Hành chính đội xe kiểm tra.'); return }
      if (!form.scheduled_start) { setError('Vui lòng chọn thời gian khởi hành.'); return }
      if (form.expected_end && form.expected_end <= form.scheduled_start) {
        setError('Thời gian dự kiến về phải sau thời gian khởi hành. Vui lòng kiểm tra lại ngày và giờ.')
        return
      }
      setSaving(true); setError(null)
      try { await onSubmit(form, planFiles) } catch (err) { setError(getErrorMessage(err, 'Không thể gửi đề nghị điều hành xe.')) } finally { setSaving(false) }
    }}>
      <div className="form-grid">
        <label>Khoa / đơn vị<input value={form.department ?? ''} onChange={(event) => setForm({ ...form, department: event.target.value })} required /></label>
        <label>Mục đích<select value={form.purpose} onChange={(event) => setForm({ ...form, purpose: event.target.value as TripPurpose })}>{(Object.keys(PURPOSE_LABELS) as TripPurpose[]).map((key) => <option key={key} value={key}>{PURPOSE_LABELS[key]}</option>)}</select></label>
        <label>Điểm đón<input value={form.pickup} onChange={(event) => setForm({ ...form, pickup: event.target.value })} required /></label>
        <label>Điểm đến<input value={form.destination} onChange={(event) => setForm({ ...form, destination: event.target.value })} required /></label>
        <label>Thời gian khởi hành<VietnamDateInput mode="datetime" value={form.scheduled_start} showHint onChange={(scheduledStart) => {
          const expectedEnd = form.expected_end && form.expected_end <= scheduledStart ? '' : form.expected_end
          setForm({ ...form, scheduled_start: scheduledStart, expected_end: expectedEnd })
          setError(null)
        }} required /></label>
        <label>Thời gian dự kiến về<VietnamDateInput mode="datetime" value={form.expected_end ?? ''} min={form.scheduled_start} showHint onChange={(value) => { setForm({ ...form, expected_end: value }); setError(null) }} /></label>
        <label>Người liên hệ<input value={form.contact_name ?? ''} onChange={(event) => setForm({ ...form, contact_name: event.target.value })} /></label>
        <label>Số điện thoại<input inputMode="tel" value={form.contact_phone ?? ''} onChange={(event) => setForm({ ...form, contact_phone: event.target.value })} /></label>
        <label>Số người<input type="number" min="0" value={form.passenger_count ?? 0} onChange={(event) => setForm({ ...form, passenger_count: Number(event.target.value) })} /></label>
        <label className="span-2 plan-multi-upload-field">Văn bản / kế hoạch / hình ảnh
          <div className="plan-multi-upload-box">
            <span className="plan-multi-upload-icon" aria-hidden="true">📎</span>
            <div className="plan-multi-upload-copy"><strong>Thêm nhiều tệp hoặc hình ảnh</strong><small>Chọn nhiều tệp cùng lúc hoặc bấm lại nhiều lần để bổ sung.</small></div>
            <input type="file" multiple accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,image/*" onChange={(event) => {
              const incoming = Array.from(event.currentTarget.files ?? [])
              const merged = mergeSelectedPlanFiles(planFiles, incoming)
              if (merged.length > 10) {
                setError('Chỉ được đính kèm tối đa 10 tệp. Hãy xóa bớt tệp trước khi thêm.')
                event.currentTarget.value = ''
                return
              }
              setPlanFiles(merged)
              setError(null)
              event.currentTarget.value = ''
            }} required={planFiles.length === 0} />
          </div>
          <small>Hỗ trợ PDF, Word, Excel, PowerPoint, TXT và hình ảnh. Tối đa 10 tệp, 10 MB/tệp, tổng 50 MB.</small>
          <SelectedPlanFiles files={planFiles} onRemove={(index) => setPlanFiles((current) => current.filter((_, itemIndex) => itemIndex !== index))} />
        </label>
        <label className="span-2">Ghi chú<textarea value={form.notes ?? ''} onChange={(event) => setForm({ ...form, notes: event.target.value })} /></label>
      </div>
      {error && <div className="form-error">{error}</div>}
      <div className="form-actions"><button type="button" className="secondary-button" onClick={onClose}>Hủy</button><button className="primary-button" disabled={saving}>{saving ? 'Đang gửi...' : 'GỬI ĐỀ NGHỊ'}</button></div>
    </form>
  </Modal>
}
