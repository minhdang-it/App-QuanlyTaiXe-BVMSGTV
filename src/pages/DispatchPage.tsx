import { useEffect, useMemo, useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { useData } from '../context/DataContext'
import { EXPENSE_LABELS, INCIDENT_LABELS, PURPOSE_LABELS } from '../lib/constants'
import { formatCurrency, formatDate, formatDateTime, googleMapsLocationUrl, toDateTimeLocal, todayKey } from '../lib/utils'
import type { AppData, CreateTripInput, Trip, TripPurpose, TripStatus } from '../types/models'
import { Modal } from '../components/Modal'
import { StatusBadge } from '../components/StatusBadge'
import { EmptyState } from '../components/EmptyState'
import { VietnamDateInput } from '../components/VietnamDateInput'
import { mergeSelectedPlanFiles, PlanAttachmentsViewer, SelectedPlanFiles } from '../components/PlanAttachments'
import { consumeNavigationFocus } from '../lib/focusNavigation'


function nextDefaultTripDateTime() {
  const date = new Date(Date.now() + 30 * 60 * 1000)
  date.setMinutes(Math.ceil(date.getMinutes() / 15) * 15, 0, 0)
  return toDateTimeLocal(date)
}

const statusFilters: Array<{ value: 'all' | TripStatus; label: string }> = [
  { value: 'all', label: 'Tất cả' },
  { value: 'pending_fleet', label: 'Chờ Hành chính' },
  { value: 'pending_director', label: 'Chờ BGĐ' },
  { value: 'assigned', label: 'Đã giao' },
  { value: 'accepted', label: 'Đã nhận' },
  { value: 'ready', label: 'Sẵn sàng' },
  { value: 'active', label: 'Đang chạy' },
  { value: 'completed', label: 'Hoàn thành' },
  { value: 'cancelled', label: 'Đã hủy' },
]

export function DispatchPage() {
  const { user } = useAuth()
  const { data, createTrip, updateTrip, deleteTrip } = useData()
  const role = user!.profile.role
  const canManage = role === 'dispatcher' || role === 'admin'
  const canFleetReview = role === 'fleet' || role === 'admin'
  const canDirectorReview = role === 'director' || role === 'admin'
  const [showCreate, setShowCreate] = useState(false)
  const [createRequestId, setCreateRequestId] = useState<string | null>(null)
  const [selectedTrip, setSelectedTrip] = useState<Trip | null>(null)
  const [editingTrip, setEditingTrip] = useState<Trip | null>(null)
  const [filter, setFilter] = useState<'all' | TripStatus>('all')
  const [purpose, setPurpose] = useState<'all' | TripPurpose>('all')
  const [query, setQuery] = useState('')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [viewMode, setViewMode] = useState<'list' | 'day' | 'week' | 'month'>('list')
  const [calendarDate, setCalendarDate] = useState(todayKey())
  const [message, setMessage] = useState<{ text: string; error?: boolean } | null>(null)
  const [focusedRequestId, setFocusedRequestId] = useState<string | null>(null)

  const trips = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase('vi-VN')
    const fromTime = dateFrom ? new Date(`${dateFrom}T00:00:00`).getTime() : null
    const toTime = dateTo ? new Date(`${dateTo}T23:59:59`).getTime() : null

    return data.trips
      .filter((trip) => filter === 'all' || trip.status === filter)
      .filter((trip) => purpose === 'all' || trip.purpose === purpose)
      .filter((trip) => {
        const time = new Date(trip.scheduled_start).getTime()
        return (fromTime === null || time >= fromTime) && (toTime === null || time <= toTime)
      })
      .filter((trip) => {
        if (!normalizedQuery) return true
        const vehicle = data.vehicles.find((item) => item.id === trip.vehicle_id)
        const driver = data.profiles.find((item) => item.id === trip.driver_id)
        return [
          vehicle?.plate_number,
          vehicle?.vehicle_name,
          driver?.full_name,
          driver?.phone,
          trip.pickup,
          trip.destination,
          trip.contact_name,
          trip.contact_phone,
          trip.notes,
          PURPOSE_LABELS[trip.purpose],
        ].some((value) => value?.toLocaleLowerCase('vi-VN').includes(normalizedQuery))
      })
      .sort((a, b) => new Date(b.scheduled_start).getTime() - new Date(a.scheduled_start).getTime())
  }, [data.profiles, data.trips, data.vehicles, dateFrom, dateTo, filter, purpose, query])

  const approvedDepartmentRequests = useMemo(() => data.vehicleRequests
    .filter((request) => request.status === 'fleet_approved')
    .sort((a, b) => new Date(a.scheduled_start).getTime() - new Date(b.scheduled_start).getTime()), [data.vehicleRequests])

  useEffect(() => {
    const focusId = consumeNavigationFocus('dispatch')
    if (!focusId) return
    const trip = data.trips.find((item) => item.id === focusId)
    if (trip) {
      setFilter('all'); setPurpose('all'); setQuery(''); setDateFrom(''); setDateTo(''); setViewMode('list'); setSelectedTrip(trip)
      return
    }
    const request = data.vehicleRequests.find((item) => item.id === focusId && item.status === 'fleet_approved')
    if (request) {
      setFocusedRequestId(request.id)
      window.setTimeout(() => document.getElementById(`approved-request-${request.id}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 80)
      window.setTimeout(() => setFocusedRequestId((current) => current === request.id ? null : current), 4000)
    }
  }, [data.trips, data.vehicleRequests])

  async function cancelTrip(trip: Trip) {
    if (!window.confirm(`Hủy chuyến đi đến “${trip.destination}”?`)) return
    try {
      await updateTrip(trip.id, { status: 'cancelled' })
      setSelectedTrip(null)
      setMessage({ text: 'Đã hủy chuyến đi.' })
    } catch (error) {
      setMessage({ text: error instanceof Error ? error.message : String(error), error: true })
    }
  }

  async function removeTrip(trip: Trip) {
    const linkedExpenses = data.expenses.some((item) => item.trip_id === trip.id)
    const linkedIncidents = data.incidents.some((item) => item.trip_id === trip.id)
    if (trip.status === 'active' || trip.status === 'completed' || trip.start_odometer != null || trip.end_odometer != null || trip.start_odometer_image_url || trip.end_odometer_image_url) {
      setMessage({ text: 'Không thể xóa chuyến đã phát sinh kilomet hoặc hành trình thực tế. Hãy hủy chuyến để giữ dữ liệu đối soát.', error: true })
      return
    }
    if (linkedExpenses || linkedIncidents) {
      setMessage({ text: 'Chuyến đã có chi phí hoặc sự cố liên quan nên không thể xóa. Hãy hủy chuyến để giữ lịch sử.', error: true })
      return
    }
    const vehicle = data.vehicles.find((item) => item.id === trip.vehicle_id)
    const confirmed = window.confirm(
      `XÓA VĨNH VIỄN chuyến ${vehicle?.plate_number ?? ''} đi “${trip.destination}” lúc ${formatDateTime(trip.scheduled_start)}?\n\nThao tác này không thể hoàn tác.`,
    )
    if (!confirmed) return
    try {
      await deleteTrip(trip.id)
      setSelectedTrip(null)
      setMessage({ text: 'Đã xóa chuyến đi.' })
    } catch (error) {
      setMessage({ text: error instanceof Error ? error.message : String(error), error: true })
    }
  }

  async function fleetApproveTrip(trip: Trip) {
    try {
      const bypassDirector = trip.approval_mode === 'fleet_only' && trip.approved_plan && Boolean(trip.plan_document_path || trip.plan_document_url)
      await updateTrip(trip.id, {
        status: bypassDirector ? 'assigned' : 'pending_director',
        fleet_reviewer_id: user!.id,
        fleet_reviewed_at: new Date().toISOString(),
        approval_rejection_reason: null,
      })
      setMessage({ text: bypassDirector ? 'Hành chính đã duyệt. Chuyến có văn bản kế hoạch hợp lệ nên được giao thẳng cho tài xế.' : 'Hành chính đã duyệt và chuyển Ban Giám đốc phê duyệt.' })
    } catch (error) {
      setMessage({ text: error instanceof Error ? error.message : String(error), error: true })
    }
  }

  async function directorApproveTrip(trip: Trip) {
    try {
      await updateTrip(trip.id, {
        status: 'assigned',
        director_reviewer_id: user!.id,
        director_reviewed_at: new Date().toISOString(),
        approval_rejection_reason: null,
      })
      setMessage({ text: 'Ban Giám đốc đã duyệt. Tài xế đã nhận được chuyến để tiếp nhận.' })
    } catch (error) {
      setMessage({ text: error instanceof Error ? error.message : String(error), error: true })
    }
  }

  async function rejectApproval(trip: Trip) {
    const reason = window.prompt('Lý do không duyệt chuyến xe:')?.trim()
    if (!reason) return
    try {
      await updateTrip(trip.id, { status: 'cancelled', approval_rejection_reason: reason })
      setMessage({ text: 'Đã từ chối yêu cầu điều xe.' })
    } catch (error) {
      setMessage({ text: error instanceof Error ? error.message : String(error), error: true })
    }
  }

  return <>
    {message && <div className={`inline-message ${message.error ? 'error' : ''}`}>{message.text}<button onClick={() => setMessage(null)}>✕</button></div>}

    <section className="toolbar trip-toolbar">
      <div>
        <h2 className="toolbar-title">Quản lý và lịch sử chuyến đi</h2>
        <p className="toolbar-note">Xem lại hành trình, kilomet, chi phí và sự cố của từng chuyến.</p>
      </div>
      {canManage && <button className="primary-button" onClick={() => { setCreateRequestId(null); setShowCreate(true) }}>＋ TẠO CHUYẾN</button>}
    </section>

    {canManage && approvedDepartmentRequests.length > 0 && <section className="approved-request-queue">
      <div className="panel-header">
        <div><span className="eyebrow">ĐỀ NGHỊ ĐÃ ĐƯỢC HÀNH CHÍNH DUYỆT</span><h2>Chờ Điều phối tạo chuyến</h2><p>Bấm “Tạo chuyến” để lấy sẵn thông tin từ đề nghị của khoa/phòng.</p></div>
        <span className="count-pill">{approvedDepartmentRequests.length} đề nghị</span>
      </div>
      <div className="approved-request-list">{approvedDepartmentRequests.map((request) => {
        const requester = data.profiles.find((profile) => profile.id === request.requester_id)
        return <article id={`approved-request-${request.id}`} key={request.id} className={`approved-request-row ${focusedRequestId === request.id ? 'record-focus-pulse' : ''}`}>
          <div className="approved-request-main"><strong>{PURPOSE_LABELS[request.purpose]} · {request.destination}</strong><span>{request.department || requester?.department || 'Chưa rõ khoa/đơn vị'} · {formatDateTime(request.scheduled_start)}</span></div>
          <div className="approved-request-actions"><span className="approval-route-chip">Hành chính đã duyệt</span><PlanAttachmentsViewer attachments={request.plan_attachments} legacyUrl={request.plan_document_url} legacyPath={request.plan_document_path} compact /><button type="button" className="primary-button compact" onClick={() => { setCreateRequestId(request.id); setShowCreate(true) }}>＋ Tạo chuyến</button></div>
        </article>
      })}</div>
    </section>}

    {!canManage && <div className="readonly-notice">Bạn đang xem dữ liệu ở chế độ chỉ đọc. Điều phối tạo yêu cầu chuyến; Hành chính và Ban Giám đốc duyệt theo đúng quy trình phân quyền.</div>}

    <section className="trip-filter-panel">
      <div className="filter-tabs trip-status-tabs">
        {statusFilters.map((item) => <button key={item.value} className={filter === item.value ? 'active' : ''} onClick={() => setFilter(item.value)}>{item.label}</button>)}
      </div>
      <div className="trip-filter-grid">
        <label>Tìm chuyến
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Biển số, tài xế, địa điểm, SĐT..." />
        </label>
        <label>Loại chuyến
          <select value={purpose} onChange={(event) => setPurpose(event.target.value as 'all' | TripPurpose)}>
            <option value="all">Tất cả loại chuyến</option>
            {(Object.keys(PURPOSE_LABELS) as TripPurpose[]).map((key) => <option key={key} value={key}>{PURPOSE_LABELS[key]}</option>)}
          </select>
        </label>
        <label>Từ ngày<VietnamDateInput value={dateFrom} onChange={setDateFrom} /></label>
        <label>Đến ngày<VietnamDateInput value={dateTo} onChange={setDateTo} /></label>
        <button type="button" className="secondary-button trip-clear-filter" onClick={() => { setQuery(''); setPurpose('all'); setDateFrom(''); setDateTo(''); setFilter('all') }}>Xóa bộ lọc</button>
      </div>
    </section>

    <section className="dispatch-view-switch">
      <div className="dispatch-view-tabs">
        <button type="button" className={viewMode === 'list' ? 'active' : ''} onClick={() => setViewMode('list')}>☰ Danh sách</button>
        <button type="button" className={viewMode === 'day' ? 'active' : ''} onClick={() => setViewMode('day')}>Ngày</button>
        <button type="button" className={viewMode === 'week' ? 'active' : ''} onClick={() => setViewMode('week')}>Tuần</button>
        <button type="button" className={viewMode === 'month' ? 'active' : ''} onClick={() => setViewMode('month')}>Tháng</button>
      </div>
      {viewMode !== 'list' && <div className="calendar-nav-controls">
        <button type="button" className="secondary-button compact" onClick={() => setCalendarDate(moveCalendarDate(calendarDate, viewMode, -1))}>‹</button>
        <button type="button" className="secondary-button compact" onClick={() => setCalendarDate(todayKey())}>Hôm nay</button>
        <strong>{calendarPeriodLabel(calendarDate, viewMode)}</strong>
        <button type="button" className="secondary-button compact" onClick={() => setCalendarDate(moveCalendarDate(calendarDate, viewMode, 1))}>›</button>
      </div>}
    </section>

    {viewMode !== 'list' && <TripCalendar mode={viewMode} anchor={calendarDate} trips={trips} data={data} onOpen={(trip) => setSelectedTrip(trip)} onSelectDate={(date) => { setCalendarDate(date); setViewMode('day') }} />}

    {viewMode === 'list' && <section className="panel">
      <div className="panel-header"><div><h2>Danh sách chuyến đi</h2><p>Bấm “Xem chi tiết” để kiểm tra đầy đủ dữ liệu chuyến.</p></div><span className="count-pill">{trips.length} chuyến</span></div>
      {trips.length ? <div className="trip-list">{trips.map((trip) => {
        const vehicle = data.vehicles.find((item) => item.id === trip.vehicle_id)
        const driver = data.profiles.find((item) => item.id === trip.driver_id)
        const checklist = data.checklists.find((item) => item.trip_id === trip.id)
        const checklistHasIssue = checklist && !(checklist.fuel_ok && checklist.tires_ok && checklist.lights_horn_ok && checklist.vehicle_clean && checklist.documents_ok)
        const canEditTrip = canManage && trip.status === 'pending_fleet'
        const canDeleteTrip = canManage
          && ['pending_fleet', 'cancelled'].includes(trip.status)
          && trip.start_odometer == null
          && trip.end_odometer == null
          && !trip.start_odometer_image_url
          && !trip.end_odometer_image_url
          && !data.expenses.some((item) => item.trip_id === trip.id)
          && !data.incidents.some((item) => item.trip_id === trip.id)

        return <article id={`trip-${trip.id}`} className="dispatch-card" key={trip.id}>
          <div className="dispatch-time"><strong>{new Intl.DateTimeFormat('vi-VN', { hour: '2-digit', minute: '2-digit' }).format(new Date(trip.scheduled_start))}</strong><small>{formatDate(trip.scheduled_start)}</small></div>
          <div className="dispatch-main">
            <div className="dispatch-title"><h3>{vehicle?.plate_number ?? 'Chưa rõ xe'} · {driver?.full_name ?? 'Chưa rõ tài xế'}</h3><StatusBadge status={trip.status} /></div>
            <p><strong>{trip.pickup}</strong> → <strong>{trip.destination}</strong></p>
            {checklistHasIssue && <div className="checklist-alert">⚠ Checklist có mục Không: {checklist?.notes || 'Chưa có ghi chú'}</div>}
            <div className="dispatch-meta"><span>🏥 {PURPOSE_LABELS[trip.purpose]}</span><span>⏱ Về: {formatDateTime(trip.expected_end)}</span>{trip.contact_phone && <a href={`tel:${trip.contact_phone}`}>☎ {trip.contact_phone}</a>}</div>
            {trip.approval_mode === 'fleet_only' && <span className="approval-route-chip">Văn bản đã duyệt · Hành chính duyệt là giao tài xế</span>}
          </div>
          <div className="dispatch-actions">
            <button className="secondary-button compact" onClick={() => setSelectedTrip(trip)}>Xem chi tiết</button>
            {canEditTrip && <button className="secondary-button compact" onClick={() => setEditingTrip(trip)}>Sửa</button>}
            {trip.status === 'pending_fleet' && canFleetReview && <button className="approve-button" onClick={() => void fleetApproveTrip(trip)}>{trip.approval_mode === 'fleet_only' ? 'Hành chính duyệt & giao tài xế' : 'Hành chính trình BGĐ'}</button>}
            {trip.status === 'pending_fleet' && canFleetReview && <button className="reject-button" onClick={() => void rejectApproval(trip)}>Không duyệt</button>}
            {trip.status === 'pending_director' && canDirectorReview && <button className="approve-button" onClick={() => void directorApproveTrip(trip)}>BGĐ duyệt</button>}
            {trip.status === 'pending_director' && canDirectorReview && <button className="reject-button" onClick={() => void rejectApproval(trip)}>Không duyệt</button>}
            {trip.status === 'accepted' && trip.checklist_completed && canManage && <button className="approve-button" onClick={async () => { await updateTrip(trip.id, { status: 'ready' }); setMessage({ text: 'Đã duyệt ngoại lệ, tài xế có thể tiếp tục.' }) }}>Duyệt xuất phát</button>}
            {canManage && !['pending_fleet', 'pending_director', 'completed', 'cancelled'].includes(trip.status) && <button className="reject-button" onClick={() => void cancelTrip(trip)}>Hủy chuyến</button>}
            {canDeleteTrip && <button className="text-button danger-text" onClick={() => void removeTrip(trip)}>Xóa</button>}
          </div>
        </article>
      })}</div> : <EmptyState icon="🚐" title="Không có chuyến phù hợp" />}
    </section>}

    {showCreate && <TripFormModal initialRequestId={createRequestId ?? undefined} onClose={() => { setShowCreate(false); setCreateRequestId(null) }} onSubmit={async (input, planFiles) => {
      await createTrip(input, planFiles)
      setShowCreate(false)
      setCreateRequestId(null)
      setMessage({ text: input.vehicle_request_id
        ? 'Đã tạo chuyến từ đề nghị đã được Hành chính duyệt. Tài xế đã nhận được chuyến.'
        : 'Đã tạo yêu cầu điều xe. Chuyến đang chờ Hành chính đội xe duyệt.' })
    }} />}

    {editingTrip && <TripFormModal trip={editingTrip} onClose={() => setEditingTrip(null)} onSubmit={async (input) => {
      await updateTrip(editingTrip.id, input)
      setEditingTrip(null)
      setSelectedTrip(null)
      setMessage({ text: 'Đã cập nhật thông tin chuyến đi.' })
    }} />}

    {selectedTrip && <TripDetailModal
      trip={data.trips.find((item) => item.id === selectedTrip.id) ?? selectedTrip}
      canManage={canManage}
      onClose={() => setSelectedTrip(null)}
      onEdit={(trip) => { setSelectedTrip(null); setEditingTrip(trip) }}
      onCancel={(trip) => void cancelTrip(trip)}
      onDelete={(trip) => void removeTrip(trip)}
    />}
  </>
}


type CalendarMode = 'day' | 'week' | 'month'

function dateKey(value: Date) {
  return todayKey(value)
}

function startOfWeek(value: Date) {
  const date = new Date(value)
  date.setHours(0, 0, 0, 0)
  const day = date.getDay() || 7
  date.setDate(date.getDate() - day + 1)
  return date
}

function calendarPeriodLabel(anchor: string, mode: 'list' | CalendarMode) {
  const date = new Date(`${anchor}T00:00:00`)
  if (mode === 'day') return formatDate(anchor)
  if (mode === 'week') {
    const start = startOfWeek(date)
    const end = new Date(start); end.setDate(end.getDate() + 6)
    return `${formatDate(dateKey(start))} – ${formatDate(dateKey(end))}`
  }
  if (mode === 'month') { const first = new Date(date.getFullYear(), date.getMonth(), 1); const last = new Date(date.getFullYear(), date.getMonth() + 1, 0); return `${formatDate(dateKey(first))} – ${formatDate(dateKey(last))}` }
  return 'Danh sách'
}

function moveCalendarDate(anchor: string, mode: 'list' | CalendarMode, direction: number) {
  const date = new Date(`${anchor}T00:00:00`)
  if (mode === 'day') date.setDate(date.getDate() + direction)
  else if (mode === 'week') date.setDate(date.getDate() + direction * 7)
  else if (mode === 'month') date.setMonth(date.getMonth() + direction)
  return dateKey(date)
}

function TripCalendar({ mode, anchor, trips, data, onOpen, onSelectDate }: {
  mode: CalendarMode
  anchor: string
  trips: Trip[]
  data: AppData
  onOpen: (trip: Trip) => void
  onSelectDate: (date: string) => void
}) {
  const anchorDate = new Date(`${anchor}T00:00:00`)
  if (mode === 'day') {
    const items = trips.filter((trip) => dateKey(new Date(trip.scheduled_start)) === anchor)
    return <section className="panel trip-calendar-panel">
      <div className="panel-header"><div><h2>Lịch ngày {formatDate(anchor)}</h2><p>{items.length} chuyến trong ngày đã chọn</p></div><span className="count-pill">{items.length}</span></div>
      {items.length ? <div className="calendar-day-list">{items.sort((a,b) => new Date(a.scheduled_start).getTime() - new Date(b.scheduled_start).getTime()).map((trip) => <CalendarTripCard key={trip.id} trip={trip} data={data} onOpen={onOpen} />)}</div> : <EmptyState icon="📅" title="Ngày này chưa có chuyến" />}
    </section>
  }

  if (mode === 'week') {
    const start = startOfWeek(anchorDate)
    const days = Array.from({ length: 7 }, (_, index) => { const d = new Date(start); d.setDate(start.getDate() + index); return d })
    return <section className="trip-calendar-week">{days.map((date) => {
      const key = dateKey(date)
      const items = trips.filter((trip) => dateKey(new Date(trip.scheduled_start)) === key).sort((a,b) => new Date(a.scheduled_start).getTime() - new Date(b.scheduled_start).getTime())
      const isToday = key === todayKey()
      return <article key={key} className={`calendar-week-day ${isToday ? 'today' : ''}`}>
        <button type="button" className="calendar-day-heading" onClick={() => onSelectDate(key)}><span>{new Intl.DateTimeFormat('vi-VN', { weekday: 'short' }).format(date)}</span><strong>{date.getDate().toString().padStart(2,'0')}</strong><small>{(date.getMonth()+1).toString().padStart(2,'0')}/{date.getFullYear()}</small></button>
        <div className="calendar-week-trips">{items.length ? items.map((trip) => <CalendarTripCard key={trip.id} trip={trip} data={data} onOpen={onOpen} compact />) : <span className="calendar-no-trip">Trống</span>}</div>
      </article>
    })}</section>
  }

  const first = new Date(anchorDate.getFullYear(), anchorDate.getMonth(), 1)
  const gridStart = startOfWeek(first)
  const cells = Array.from({ length: 42 }, (_, index) => { const d = new Date(gridStart); d.setDate(gridStart.getDate() + index); return d })
  return <section className="panel trip-calendar-panel month-view">
    <div className="calendar-month-weekdays">{['T2','T3','T4','T5','T6','T7','CN'].map((label) => <span key={label}>{label}</span>)}</div>
    <div className="calendar-month-grid">{cells.map((date) => {
      const key = dateKey(date)
      const items = trips.filter((trip) => dateKey(new Date(trip.scheduled_start)) === key)
      const outside = date.getMonth() !== anchorDate.getMonth()
      const today = key === todayKey()
      return <button type="button" key={key} className={`${outside ? 'outside' : ''} ${today ? 'today' : ''} ${items.length ? 'has-trip' : ''}`} onClick={() => onSelectDate(key)}>
        <span>{date.getDate()}</span>{items.length > 0 && <strong>{items.length}</strong>}<small>{items.slice(0,2).map((trip) => new Intl.DateTimeFormat('vi-VN', { hour: '2-digit', minute: '2-digit' }).format(new Date(trip.scheduled_start))).join(' · ')}</small>
      </button>
    })}</div>
  </section>
}

function CalendarTripCard({ trip, data, onOpen, compact = false }: { trip: Trip; data: AppData; onOpen: (trip: Trip) => void; compact?: boolean }) {
  const vehicle = data.vehicles.find((item) => item.id === trip.vehicle_id)
  const driver = data.profiles.find((item) => item.id === trip.driver_id)
  return <button type="button" className={`calendar-trip-card ${compact ? 'compact' : ''}`} onClick={() => onOpen(trip)}>
    <time>{new Intl.DateTimeFormat('vi-VN', { hour: '2-digit', minute: '2-digit' }).format(new Date(trip.scheduled_start))}</time>
    <div><strong>{vehicle?.plate_number ?? 'Chưa gán xe'} · {trip.destination}</strong><small>{driver?.full_name ?? 'Chưa gán tài xế'} · {PURPOSE_LABELS[trip.purpose]}</small></div>
    <StatusBadge status={trip.status} />
  </button>
}


function buildTripTimeline(trip: Trip, data: AppData) {
  const events: Array<{ time: string; title: string; detail: string; tone: 'normal' | 'success' | 'warning' | 'danger' }> = []
  const name = (id?: string | null) => data.profiles.find((item) => item.id === id)?.full_name ?? ''
  const checklist = data.checklists.find((item) => item.trip_id === trip.id)
  const vehicle = data.vehicles.find((item) => item.id === trip.vehicle_id)
  const driver = name(trip.driver_id) || 'Tài xế'
  const creator = name(trip.created_by) || 'Điều phối'
  const push = (time: string | null | undefined, title: string, detail: string, tone: 'normal' | 'success' | 'warning' | 'danger' = 'normal') => { if (time) events.push({ time, title, detail, tone }) }

  push(trip.created_at, 'Tạo yêu cầu/chuyến', `${creator} · ${trip.pickup} → ${trip.destination}`)
  push(trip.fleet_reviewed_at, 'Hành chính đã duyệt', name(trip.fleet_reviewer_id) || 'Hành chính đội xe', 'success')
  push(trip.director_reviewed_at, 'Ban Giám đốc đã duyệt', name(trip.director_reviewer_id) || 'Ban Giám đốc', 'success')
  if (trip.approval_rejection_reason) push(trip.updated_at, 'Yêu cầu không được duyệt', trip.approval_rejection_reason, 'danger')
  push(checklist?.created_at, 'Tài xế hoàn tất checklist', `${driver}${checklist?.notes ? ` · ${checklist.notes}` : ''}`, checklist && !(checklist.fuel_ok && checklist.tires_ok && checklist.lights_horn_ok && checklist.vehicle_clean && checklist.documents_ok) ? 'warning' : 'success')
  if (trip.start_odometer != null) push(trip.started_at ?? trip.updated_at, 'Ghi nhận KM đầu', `${trip.start_odometer.toLocaleString('vi-VN')} km · ${vehicle?.plate_number ?? ''}`, 'normal')
  push(trip.started_at, 'Bắt đầu chuyến', `${driver} bắt đầu hành trình`, 'success')
  data.expenses.filter((item) => item.trip_id === trip.id).forEach((item) => push(item.created_at, `Gửi chi phí ${formatCurrency(item.amount)}`, EXPENSE_LABELS[item.type], 'normal'))
  data.incidents.filter((item) => item.trip_id === trip.id).forEach((item) => push(item.created_at, 'Báo sự cố', `${INCIDENT_LABELS[item.type]} · ${item.description || 'Không có mô tả'}`, ['high','critical'].includes(item.severity) ? 'danger' : 'warning'))
  if (trip.end_odometer != null) push(trip.ended_at ?? trip.updated_at, 'Ghi nhận KM cuối', `${trip.end_odometer.toLocaleString('vi-VN')} km`, 'normal')
  push(trip.ended_at, 'Kết thúc chuyến', `${driver} hoàn thành chuyến`, 'success')

  return events.sort((a, b) => new Date(a.time).getTime() - new Date(b.time).getTime())
}

export function TripDetailModal({ trip, canManage, onClose, onEdit, onCancel, onDelete }: {
  trip: Trip
  canManage: boolean
  onClose: () => void
  onEdit: (trip: Trip) => void
  onCancel: (trip: Trip) => void
  onDelete: (trip: Trip) => void
}) {
  const { data } = useData()
  const vehicle = data.vehicles.find((item) => item.id === trip.vehicle_id)
  const driver = data.profiles.find((item) => item.id === trip.driver_id)
  const creator = data.profiles.find((item) => item.id === trip.created_by)
  const checklist = data.checklists.find((item) => item.trip_id === trip.id)
  const expenses = data.expenses.filter((item) => item.trip_id === trip.id)
  const incidents = data.incidents.filter((item) => item.trip_id === trip.id)
  const timelineEvents = buildTripTimeline(trip, data)
  const distance = trip.start_odometer != null && trip.end_odometer != null ? Math.max(0, trip.end_odometer - trip.start_odometer) : null
  const liveLat = trip.current_lat ?? trip.start_lat
  const liveLng = trip.current_lng ?? trip.start_lng
  const hasLiveLocation = liveLat != null && liveLng != null
  const canEdit = canManage && trip.status === 'pending_fleet'
  const canDelete = canManage
    && ['pending_fleet', 'cancelled'].includes(trip.status)
    && trip.start_odometer == null
    && trip.end_odometer == null
    && !trip.start_odometer_image_url
    && !trip.end_odometer_image_url
    && expenses.length === 0
    && incidents.length === 0

  return <Modal title={`Chi tiết chuyến ${vehicle?.plate_number ?? ''}`} onClose={onClose} wide>
    <div className="trip-detail-heading">
      <div><span className="eyebrow">{PURPOSE_LABELS[trip.purpose]}</span><h2>{trip.pickup} → {trip.destination}</h2><p>{driver?.full_name ?? 'Chưa rõ tài xế'} · {vehicle?.vehicle_name ?? 'Chưa rõ xe'}</p></div>
      <StatusBadge status={trip.status} />
    </div>

    {trip.status === 'active' && <section className="active-trip-live-card">
      <div className="active-trip-live-head">
        <div>
          <span className="live-pulse-dot" aria-hidden="true" />
          <div><strong>Vị trí xe đang chạy</strong><small>{trip.location_updated_at ? `GPS cập nhật: ${formatDateTime(trip.location_updated_at)}` : 'Đang chờ dữ liệu GPS từ điện thoại tài xế'}</small></div>
        </div>
        <StatusBadge status={trip.status} />
      </div>
      {hasLiveLocation ? <>
        <div className="trip-detail-live-map">
          <iframe
            title={`Vị trí hiện tại xe ${vehicle?.plate_number ?? ''}`}
            src={`https://maps.google.com/maps?q=${liveLat},${liveLng}&z=16&output=embed`}
            loading="lazy"
            referrerPolicy="no-referrer-when-downgrade"
          />
          <div className="trip-detail-logo-marker" aria-label="Vị trí xe">
            <img src="/logo-bvmsgtv-v201.png" alt="Logo Bệnh viện Mắt Sài Gòn Trà Vinh" />
            <span>{vehicle?.plate_number ?? 'Xe BV'}</span>
          </div>
        </div>
        <div className="active-trip-live-actions">
          <code>{liveLat!.toFixed(6)}, {liveLng!.toFixed(6)}</code>
          <a className="primary-button compact" target="_blank" rel="noreferrer" href={googleMapsLocationUrl({ lat: liveLat!, lng: liveLng! })}>Mở vị trí trên Google Maps</a>
        </div>
      </> : <div className="active-trip-no-location">Chưa nhận được vị trí. Hãy kiểm tra GPS, HTTPS và quyền vị trí trên điện thoại tài xế.</div>}
    </section>}

    <section className="trip-detail-section trip-approval-section">
      <div className="section-title-row"><h3>Quy trình phê duyệt điều xe</h3><StatusBadge status={trip.status} /></div>
      <div className="approval-timeline compact">
        <span className={trip.fleet_reviewed_at ? 'done' : ''}>1. Điều phối yêu cầu</span>
        <span className={trip.fleet_reviewed_at ? 'done' : ''}>2. Hành chính duyệt</span>
        {trip.approval_mode !== 'fleet_only' && <span className={trip.director_reviewed_at ? 'done' : ''}>3. Ban Giám đốc duyệt</span>}
        <span className={['assigned','accepted','ready','active','completed'].includes(trip.status) ? 'done' : ''}>{trip.approval_mode === 'fleet_only' ? '3' : '4'}. Tài xế nhận chuyến</span>
      </div>
      {(trip.plan_attachments?.length || trip.plan_document_url) && <PlanAttachmentsViewer attachments={trip.plan_attachments} legacyUrl={trip.plan_document_url} legacyPath={trip.plan_document_path} compact />}
      {trip.approval_mode === 'fleet_only' && <p className="approval-explain">Chuyến có kèm văn bản/kế hoạch: Hành chính đội xe duyệt trực tiếp và bỏ qua bước BGĐ duyệt chuyến.</p>}
      {trip.approval_rejection_reason && <div className="rejection-box"><strong>Lý do không duyệt:</strong> {trip.approval_rejection_reason}</div>}
    </section>

    <div className="detail-grid trip-detail-grid">
      <div><span>Giờ dự kiến xuất phát</span><strong>{formatDateTime(trip.scheduled_start)}</strong></div>
      <div><span>Dự kiến về</span><strong>{formatDateTime(trip.expected_end)}</strong></div>
      <div><span>Bắt đầu thực tế</span><strong>{formatDateTime(trip.started_at)}</strong></div>
      <div><span>Kết thúc thực tế</span><strong>{formatDateTime(trip.ended_at)}</strong></div>
      <div><span>KM đầu</span><strong>{trip.start_odometer != null ? `${trip.start_odometer.toLocaleString('vi-VN')} km` : '—'}</strong></div>
      <div><span>KM cuối / Quãng đường</span><strong>{trip.end_odometer != null ? `${trip.end_odometer.toLocaleString('vi-VN')} km${distance != null ? ` · ${distance.toLocaleString('vi-VN')} km` : ''}` : '—'}</strong></div>
      <div><span>Người liên hệ</span><strong>{trip.contact_name || '—'}</strong></div>
      <div><span>Số điện thoại</span><strong>{trip.contact_phone ? <a href={`tel:${trip.contact_phone}`}>{trip.contact_phone}</a> : '—'}</strong></div>
      <div><span>Số người</span><strong>{trip.passenger_count ?? '—'}</strong></div>
      <div><span>Người tạo chuyến</span><strong>{creator?.full_name ?? '—'}</strong></div>
      <div><span>Ngày tạo</span><strong>{formatDateTime(trip.created_at)}</strong></div>
      <div><span>Cập nhật cuối</span><strong>{formatDateTime(trip.updated_at)}</strong></div>
    </div>

    {(trip.start_lat != null || trip.current_lat != null || trip.end_lat != null) && <section className="trip-detail-section"><h3>Vị trí ghi nhận</h3><div className="location-actions">{trip.start_lat != null && trip.start_lng != null && <a className="secondary-button compact" target="_blank" rel="noreferrer" href={googleMapsLocationUrl({ lat: trip.start_lat, lng: trip.start_lng })}>📍 Điểm bắt đầu</a>}{trip.status === 'active' && (trip.current_lat ?? trip.start_lat) != null && (trip.current_lng ?? trip.start_lng) != null && <a className="primary-button compact" target="_blank" rel="noreferrer" href={googleMapsLocationUrl({ lat: (trip.current_lat ?? trip.start_lat)!, lng: (trip.current_lng ?? trip.start_lng)! })}>⌖ Vị trí hiện tại</a>}{trip.end_lat != null && trip.end_lng != null && <a className="secondary-button compact" target="_blank" rel="noreferrer" href={googleMapsLocationUrl({ lat: trip.end_lat, lng: trip.end_lng })}>🏁 Điểm kết thúc</a>}</div>{trip.location_updated_at && <small className="location-updated-label">Cập nhật GPS gần nhất: {formatDateTime(trip.location_updated_at)}</small>}</section>}

    {(trip.start_odometer_image_url || trip.end_odometer_image_url) && <section className="trip-detail-section"><h3>Ảnh đồng hồ kilomet</h3><div className="trip-media-grid">{trip.start_odometer_image_url && <a target="_blank" rel="noreferrer" href={trip.start_odometer_image_url}><img src={trip.start_odometer_image_url} alt="Đồng hồ KM đầu" /><span>Ảnh KM đầu</span></a>}{trip.end_odometer_image_url && <a target="_blank" rel="noreferrer" href={trip.end_odometer_image_url}><img src={trip.end_odometer_image_url} alt="Đồng hồ KM cuối" /><span>Ảnh KM cuối</span></a>}</div></section>}

    <section className="trip-detail-section trip-history-section"><div className="section-title-row"><h3>Dòng thời gian chuyến đi</h3><strong>{timelineEvents.length} mốc</strong></div>
      <div className="trip-history-timeline">{timelineEvents.map((event, index) => <div className={`trip-history-event ${event.tone}`} key={`${event.time}-${event.title}-${index}`}><span className="trip-history-dot" /><div><time>{formatDateTime(event.time)}</time><strong>{event.title}</strong><small>{event.detail}</small></div></div>)}</div>
    </section>

    <section className="trip-detail-section"><h3>Checklist trước chuyến</h3>{checklist ? <div className="checklist-summary"><span className={checklist.fuel_ok ? 'ok' : 'bad'}>Nhiên liệu</span><span className={checklist.tires_ok ? 'ok' : 'bad'}>Lốp xe</span><span className={checklist.lights_horn_ok ? 'ok' : 'bad'}>Đèn, còi</span><span className={checklist.vehicle_clean ? 'ok' : 'bad'}>Xe sạch</span><span className={checklist.documents_ok ? 'ok' : 'bad'}>Giấy tờ</span>{checklist.notes && <p>{checklist.notes}</p>}</div> : <p className="muted-copy">Chưa có checklist.</p>}</section>

    <section className="trip-detail-section"><div className="section-title-row"><h3>Chi phí chuyến đi</h3><strong>{formatCurrency(expenses.reduce((sum, item) => sum + item.amount, 0))}</strong></div>{expenses.length ? <div className="compact-record-list">{expenses.map((item) => <div key={item.id}><span>{EXPENSE_LABELS[item.type]}</span><strong>{formatCurrency(item.amount)}</strong><small>{item.description || formatDateTime(item.created_at)}</small></div>)}</div> : <p className="muted-copy">Chưa có chi phí gắn với chuyến.</p>}</section>

    <section className="trip-detail-section"><div className="section-title-row"><h3>Sự cố phát sinh</h3><strong>{incidents.length}</strong></div>{incidents.length ? <div className="compact-record-list">{incidents.map((item) => <div key={item.id}><span>{INCIDENT_LABELS[item.type]}</span><StatusBadge status={item.status} /><small>{item.description || 'Không có mô tả'}</small></div>)}</div> : <p className="muted-copy">Không ghi nhận sự cố.</p>}</section>

    {trip.notes && <div className="note-box"><strong>Ghi chú chuyến đi</strong><p>{trip.notes}</p></div>}

    <div className="form-actions trip-detail-actions">
      <button type="button" className="secondary-button" onClick={onClose}>Đóng</button>
      {canEdit && <button type="button" className="secondary-button" onClick={() => onEdit(trip)}>Sửa chuyến</button>}
      {canManage && trip.status !== 'completed' && trip.status !== 'cancelled' && <button type="button" className="reject-button" onClick={() => onCancel(trip)}>Hủy chuyến</button>}
      {canDelete && <button type="button" className="danger-button" onClick={() => onDelete(trip)}>Xóa vĩnh viễn</button>}
    </div>
  </Modal>
}

function TripFormModal({ trip, initialRequestId, onClose, onSubmit }: { trip?: Trip; initialRequestId?: string; onClose: () => void; onSubmit: (input: CreateTripInput, planFiles?: File[]) => Promise<void> }) {
  const { data } = useData()
  const eligibleVehicles = data.vehicles.filter((vehicle) => vehicle.id === trip?.vehicle_id || !['maintenance', 'out_of_service'].includes(vehicle.status))
  const drivers = data.profiles.filter((profile) => profile.role === 'driver' && !profile.deleted_at && (profile.active || profile.id === trip?.driver_id))
  const approvedRequests = data.vehicleRequests.filter((request) => request.status === 'fleet_approved')
  const initialRequest = !trip && initialRequestId ? approvedRequests.find((request) => request.id === initialRequestId) : undefined
  const initialStart = trip?.scheduled_start ? toDateTimeLocal(new Date(trip.scheduled_start)) : initialRequest?.scheduled_start ? toDateTimeLocal(new Date(initialRequest.scheduled_start)) : nextDefaultTripDateTime()
  const defaultEndDate = trip?.expected_end ? new Date(trip.expected_end) : initialRequest?.expected_end ? new Date(initialRequest.expected_end) : new Date(new Date(initialStart).getTime() + 4 * 60 * 60 * 1000)
  const [form, setForm] = useState({
    vehicle_id: trip?.vehicle_id ?? eligibleVehicles[0]?.id ?? '',
    driver_id: trip?.driver_id ?? drivers[0]?.id ?? '',
    purpose: trip?.purpose ?? initialRequest?.purpose ?? 'community_exam' as TripPurpose,
    pickup: trip?.pickup ?? initialRequest?.pickup ?? 'Bệnh viện Mắt Sài Gòn Trà Vinh',
    destination: trip?.destination ?? initialRequest?.destination ?? '',
    contact_name: trip?.contact_name ?? initialRequest?.contact_name ?? '',
    contact_phone: trip?.contact_phone ?? initialRequest?.contact_phone ?? '',
    passenger_count: String(trip?.passenger_count ?? initialRequest?.passenger_count ?? 1),
    scheduled_start: initialStart,
    expected_end: toDateTimeLocal(defaultEndDate),
    notes: trip?.notes ?? initialRequest?.notes ?? '',
    vehicle_request_id: trip?.vehicle_request_id ?? initialRequest?.id ?? '',
    existing_plan_path: trip?.plan_document_path ?? initialRequest?.plan_document_path ?? '',
    approved_plan: Boolean(trip?.approved_plan || initialRequest?.plan_document_path),
  })
  const [planFiles, setPlanFiles] = useState<File[]>([])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function submit(event: React.FormEvent) {
    event.preventDefault()
    setSaving(true)
    setError(null)
    try {
      const newStart = new Date(form.scheduled_start).getTime()
      const newEnd = form.expected_end ? new Date(form.expected_end).getTime() : newStart + 60 * 60 * 1000
      if (!Number.isFinite(newStart) || !Number.isFinite(newEnd) || newEnd <= newStart) throw new Error('Thời gian dự kiến về phải sau giờ xuất phát.')
      const conflict = data.trips.some((item) => {
        if (item.id === trip?.id || item.status === 'cancelled' || item.status === 'completed') return false
        if (item.vehicle_id !== form.vehicle_id && item.driver_id !== form.driver_id) return false
        const existingStart = new Date(item.scheduled_start).getTime()
        const existingEnd = item.expected_end ? new Date(item.expected_end).getTime() : existingStart + 60 * 60 * 1000
        return newStart < existingEnd && existingStart < newEnd
      })
      if (conflict) throw new Error('Xe hoặc tài xế đã có chuyến trùng khoảng thời gian này.')
      await onSubmit({
        vehicle_id: form.vehicle_id,
        driver_id: form.driver_id,
        purpose: form.purpose,
        pickup: form.pickup.trim(),
        destination: form.destination.trim(),
        contact_name: form.contact_name.trim(),
        contact_phone: form.contact_phone.trim(),
        passenger_count: Number(form.passenger_count),
        scheduled_start: new Date(newStart).toISOString(),
        expected_end: new Date(newEnd).toISOString(),
        notes: form.notes.trim(),
        vehicle_request_id: form.vehicle_request_id || undefined,
        existing_plan_path: form.existing_plan_path || undefined,
        approved_plan: Boolean(form.existing_plan_path || planFiles.length),
      }, planFiles)
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setSaving(false)
    }
  }

  function applyApprovedRequest(requestId: string) {
    const request = approvedRequests.find((item) => item.id === requestId)
    setPlanFiles([])
    if (!request) { setForm({ ...form, vehicle_request_id: '', existing_plan_path: '', approved_plan: false }); return }
    setForm({
      ...form,
      vehicle_request_id: request.id,
      existing_plan_path: request.plan_document_path ?? '',
      approved_plan: Boolean(request.plan_document_path),
      purpose: request.purpose,
      pickup: request.pickup,
      destination: request.destination,
      contact_name: request.contact_name ?? '',
      contact_phone: request.contact_phone ?? '',
      passenger_count: String(request.passenger_count ?? 1),
      scheduled_start: toDateTimeLocal(new Date(request.scheduled_start)),
      expected_end: request.expected_end ? toDateTimeLocal(new Date(request.expected_end)) : form.expected_end,
      notes: request.notes ?? '',
    })
  }

  const fromApprovedDepartmentRequest = Boolean(form.vehicle_request_id)
  const canUseFleetOnlyApproval = Boolean(form.existing_plan_path || planFiles.length)

  return <Modal title={trip ? 'Sửa thông tin chuyến đi' : fromApprovedDepartmentRequest ? 'Tạo chuyến từ đề nghị đã duyệt' : 'Tạo yêu cầu điều xe'} onClose={onClose} wide><form className="form-grid" onSubmit={submit}>
    {!trip && <label className="span-2">Tạo từ đề nghị đã được Hành chính duyệt<select value={form.vehicle_request_id} onChange={(event) => applyApprovedRequest(event.target.value)}><option value="">Không chọn đề nghị</option>{approvedRequests.map((request) => <option key={request.id} value={request.id}>{PURPOSE_LABELS[request.purpose]} · {request.destination} · {formatDateTime(request.scheduled_start)}</option>)}</select></label>}
    <label>Chọn xe<select value={form.vehicle_id} onChange={(event) => setForm({ ...form, vehicle_id: event.target.value })} required>{eligibleVehicles.map((vehicle) => <option key={vehicle.id} value={vehicle.id}>{vehicle.plate_number} — {vehicle.vehicle_name}</option>)}</select></label>
    <label>Tài xế<select value={form.driver_id} onChange={(event) => setForm({ ...form, driver_id: event.target.value })} required>{drivers.map((profile) => <option key={profile.id} value={profile.id}>{profile.full_name}</option>)}</select></label>
    <label>Loại chuyến<select value={form.purpose} onChange={(event) => setForm({ ...form, purpose: event.target.value as TripPurpose })}>{(Object.keys(PURPOSE_LABELS) as TripPurpose[]).map((key) => <option key={key} value={key}>{PURPOSE_LABELS[key]}</option>)}</select></label>
    <label>Số người<input type="number" min="0" value={form.passenger_count} onChange={(event) => setForm({ ...form, passenger_count: event.target.value })} /></label>
    <label>Giờ xuất phát<VietnamDateInput mode="datetime" value={form.scheduled_start} onChange={(value) => setForm({ ...form, scheduled_start: value })} required /></label>
    <label>Dự kiến về<VietnamDateInput mode="datetime" value={form.expected_end} onChange={(value) => setForm({ ...form, expected_end: value })} /></label>
    <label className="span-2">Điểm đón<input value={form.pickup} onChange={(event) => setForm({ ...form, pickup: event.target.value })} required /></label>
    <label className="span-2">Điểm đến<input value={form.destination} onChange={(event) => setForm({ ...form, destination: event.target.value })} placeholder="Xã, bệnh viện hoặc địa chỉ" required /></label>
    <label>Người liên hệ<input value={form.contact_name} onChange={(event) => setForm({ ...form, contact_name: event.target.value })} /></label>
    <label>Số điện thoại<input inputMode="tel" value={form.contact_phone} onChange={(event) => setForm({ ...form, contact_phone: event.target.value })} /></label>
    {!trip && <label className="span-2 plan-multi-upload-field">{fromApprovedDepartmentRequest ? 'Tệp bổ sung cho chuyến (không bắt buộc)' : 'Văn bản / kế hoạch / hình ảnh'}
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
          setForm({ ...form, approved_plan: Boolean(merged.length || form.existing_plan_path) })
          setError(null)
          event.currentTarget.value = ''
        }} />
      </div>
      <small>{fromApprovedDepartmentRequest ? 'Các tệp đã được Hành chính duyệt từ đề nghị sẽ tự đi theo chuyến. Có thể bấm thêm nhiều lần để bổ sung hình ảnh hoặc tài liệu.' : 'Hỗ trợ nhiều tệp. Nếu có ít nhất một văn bản/kế hoạch, Hành chính đội xe sẽ duyệt trực tiếp và giao chuyến cho tài xế.'}</small>
      <SelectedPlanFiles files={planFiles} onRemove={(index) => { const next = planFiles.filter((_, itemIndex) => itemIndex !== index); setPlanFiles(next); setForm({ ...form, approved_plan: Boolean(next.length || form.existing_plan_path) }) }} />
    </label>}
    {!trip && fromApprovedDepartmentRequest && <div className="approved-request-confirmation span-2"><strong>✓ Đề nghị đã được Hành chính duyệt</strong><span>Kế hoạch và nội dung đề nghị đã được duyệt trước. Điều phối chỉ cần chọn xe, tài xế và tạo chuyến; hệ thống sẽ giao chuyến trực tiếp cho tài xế, không yêu cầu Hành chính duyệt lại.</span></div>}
    {!trip && <div className={`approval-route-preview span-2 ${(fromApprovedDepartmentRequest || canUseFleetOnlyApproval) ? 'bypass' : ''}`}><strong>Luồng xử lý:</strong> {fromApprovedDepartmentRequest ? 'Trưởng khoa → Hành chính đã duyệt → Điều phối tạo chuyến → Tài xế' : canUseFleetOnlyApproval ? 'Điều phối → Hành chính đội xe → Tài xế' : 'Điều phối → Hành chính đội xe → Ban Giám đốc → Tài xế'}</div>}
    <label className="span-2">Ghi chú<textarea value={form.notes} onChange={(event) => setForm({ ...form, notes: event.target.value })} placeholder="Vật tư cần mang, yêu cầu đón bệnh nhân..." /></label>
    {!eligibleVehicles.length && <div className="form-error span-2">Không có xe đủ điều kiện để xếp lịch.</div>}
    {!drivers.length && <div className="form-error span-2">Chưa có tài khoản tài xế đang hoạt động.</div>}
    {error && <div className="form-error span-2">{error}</div>}
    <div className="form-actions span-2"><button type="button" className="secondary-button" onClick={onClose}>Hủy</button><button className="primary-button" disabled={saving || !eligibleVehicles.length || !drivers.length}>{saving ? 'Đang lưu...' : trip ? 'LƯU THAY ĐỔI' : fromApprovedDepartmentRequest ? 'TẠO CHUYẾN & GIAO TÀI XẾ' : 'GỬI HÀNH CHÍNH DUYỆT'}</button></div>
  </form></Modal>
}
