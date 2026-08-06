import { useMemo, useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { useData } from '../context/DataContext'
import { EXPENSE_LABELS, INCIDENT_LABELS, ROLE_LABELS, PURPOSE_LABELS, VEHICLE_STATUS_LABELS } from '../lib/constants'
import { daysUntil, formatCurrency, formatDateTime, googleMapsLocationUrl, isSameLocalDay } from '../lib/utils'
import { StatusBadge } from '../components/StatusBadge'
import { EmptyState } from '../components/EmptyState'
import { Modal } from '../components/Modal'
import { TripDetailModal } from './DispatchPage'
import { ImagePreview } from '../components/ImagePreview'
import type { AppData, Expense, Incident, Trip, UserRole } from '../types/models'

type OfficeRole = Exclude<UserRole, 'driver'>

type DashboardMetrics = {
  totalVehicles: number
  running: number
  available: number
  maintenance: number
  completed: number
  delayed: number
  expense: number
  pendingExpenses: number
}

function localizedExpenseDescription(item: Expense) {
  const description = item.description?.trim()
  if (!description) return EXPENSE_LABELS[item.type]
  const normalized = description.toLocaleLowerCase('vi-VN')
  const englishLabels: Record<string, string> = { fuel: 'Xăng dầu', washing: 'Rửa xe', toll: 'Cầu đường', parking: 'Gửi xe', repair: 'Sửa chữa', other: 'Chi phí khác' }
  return englishLabels[normalized] ?? description
}

export function DashboardPage() {
  const { data } = useData()
  const { user } = useAuth()
  const role = (user?.profile.role ?? 'dispatcher') as OfficeRole
  const [selectedTrip, setSelectedTrip] = useState<Trip | null>(null)
  const [selectedActivity, setSelectedActivity] = useState<{ kind: 'expense'; item: Expense } | { kind: 'incident'; item: Incident } | null>(null)

  const metrics = useMemo<DashboardMetrics>(() => {
    const todayTrips = data.trips.filter((trip) => isSameLocalDay(trip.scheduled_start))
    const todayExpenses = data.expenses.filter((item) => isSameLocalDay(item.expense_date) && (item.status === 'approved' || item.status === 'paid'))
    const now = Date.now()
    return {
      totalVehicles: data.vehicles.length,
      running: data.vehicles.filter((v) => v.status === 'in_use').length,
      available: data.vehicles.filter((v) => v.status === 'available').length,
      maintenance: data.vehicles.filter((v) => v.status === 'maintenance').length,
      completed: todayTrips.filter((t) => t.status === 'completed').length,
      delayed: todayTrips.filter((t) => ['assigned', 'accepted', 'ready'].includes(t.status) && new Date(t.scheduled_start).getTime() < now).length,
      expense: todayExpenses.reduce((sum, item) => sum + item.amount, 0),
      pendingExpenses: data.expenses.filter((e) => e.status === 'pending_director' || e.status === 'pending_accountant').length,
    }
  }, [data])

  const alerts = useMemo(() => {
    const items: Array<{ level: 'danger' | 'warning' | 'info'; title: string; detail: string }> = []
    for (const vehicle of data.vehicles) {
      const registration = daysUntil(vehicle.registration_expiry)
      const insurance = daysUntil(vehicle.insurance_expiry)
      if (registration !== null && registration <= 30) items.push({ level: registration < 0 ? 'danger' : 'warning', title: `${vehicle.plate_number} sắp hết đăng kiểm`, detail: registration < 0 ? `Đã quá hạn ${Math.abs(registration)} ngày` : `Còn ${registration} ngày` })
      if (insurance !== null && insurance <= 30) items.push({ level: insurance < 0 ? 'danger' : 'warning', title: `${vehicle.plate_number} sắp hết bảo hiểm`, detail: insurance < 0 ? `Đã quá hạn ${Math.abs(insurance)} ngày` : `Còn ${insurance} ngày` })
      if (vehicle.next_maintenance_odometer && vehicle.odometer >= vehicle.next_maintenance_odometer) items.push({ level: 'warning', title: `${vehicle.plate_number} đến mốc bảo dưỡng`, detail: `KM hiện tại ${vehicle.odometer.toLocaleString('vi-VN')}` })
    }
    for (const trip of data.trips.filter((item) => item.status === 'active' && item.expected_end && new Date(item.expected_end).getTime() < Date.now())) {
      const vehicle = data.vehicles.find((item) => item.id === trip.vehicle_id)
      items.push({ level: 'warning', title: `${vehicle?.plate_number ?? 'Xe'} chưa kết thúc chuyến`, detail: `Dự kiến về ${formatDateTime(trip.expected_end)}` })
    }
    for (const incident of data.incidents.filter((item) => item.status !== 'resolved')) {
      if (incident.severity === 'critical' || incident.severity === 'high') items.push({ level: 'danger', title: 'Sự cố xe cần xử lý ngay', detail: incident.description || incident.type })
    }
    return items.slice(0, 8)
  }, [data])

  const todayTrips = data.trips
    .filter((trip) => isSameLocalDay(trip.scheduled_start))
    .sort((a, b) => new Date(a.scheduled_start).getTime() - new Date(b.scheduled_start).getTime())

  const activeTrips = useMemo(() => data.trips
    .filter((trip) => trip.status === 'active')
    .sort((a, b) => new Date(b.location_updated_at ?? b.started_at ?? b.updated_at).getTime() - new Date(a.location_updated_at ?? a.started_at ?? a.updated_at).getTime()), [data.trips])

  const recentActivities = useMemo(() => [
    ...data.incidents.map((item) => ({ kind: 'incident' as const, item, time: item.created_at })),
    ...data.expenses.map((item) => ({ kind: 'expense' as const, item, time: item.created_at })),
  ].sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime()).slice(0, 6), [data.expenses, data.incidents])

  return (
    <div className="dashboard-grid executive-dashboard-grid">

      <section className="metric-grid compact-metric-grid">
        <Metric icon="🚘" label="Tổng số xe" value={metrics.totalVehicles} />
        <Metric icon="🟢" label="Xe đang chạy" value={metrics.running} tone="success" />
        <Metric icon="🅿️" label="Xe đang trống" value={metrics.available} />
        <Metric icon="🔧" label="Xe đang sửa" value={metrics.maintenance} tone="warning" />
        <Metric icon="✓" label="Chuyến hoàn thành" value={metrics.completed} tone="success" />
        <Metric icon="⏰" label="Chuyến trễ giờ" value={metrics.delayed} tone={metrics.delayed ? 'danger' : undefined} />
        <Metric icon="💵" label="Chi phí đã duyệt hôm nay" value={formatCurrency(metrics.expense)} wide />
        <Metric icon="🧾" label="Chi phí chờ duyệt" value={metrics.pendingExpenses} tone={metrics.pendingExpenses ? 'warning' : undefined} wide />
      </section>

      <DepartmentWorkspace role={role} data={data} metrics={metrics} activeTrips={activeTrips} />

      <section className="panel trip-panel modern-panel-span-2">
        <div className="panel-header"><div><h2>Lịch xe hôm nay</h2><p>Toàn bộ hành trình đã điều trong ngày</p></div><span className="count-pill">{todayTrips.length} chuyến</span></div>
        {todayTrips.length ? <div className="table-wrap"><table><thead><tr><th>Giờ</th><th>Xe / Tài xế</th><th>Hành trình</th><th>Loại chuyến</th><th>Trạng thái</th></tr></thead><tbody>{todayTrips.map((trip) => {
          const vehicle = data.vehicles.find((v) => v.id === trip.vehicle_id)
          const driver = data.profiles.find((p) => p.id === trip.driver_id)
          return <tr className="clickable-table-row" tabIndex={0} role="button" aria-label={`Xem chi tiết chuyến ${vehicle?.plate_number ?? ''}`} onClick={() => setSelectedTrip(trip)} onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') setSelectedTrip(trip) }} key={trip.id}><td><strong>{new Intl.DateTimeFormat('vi-VN', { hour: '2-digit', minute: '2-digit' }).format(new Date(trip.scheduled_start))}</strong></td><td><strong>{vehicle?.plate_number}</strong><small>{driver?.full_name}</small></td><td><strong>{trip.destination}</strong><small>{trip.pickup}</small></td><td>{PURPOSE_LABELS[trip.purpose]}</td><td><StatusBadge status={trip.status} /></td></tr>
        })}</tbody></table></div> : <EmptyState icon="📅" title="Hôm nay chưa có lịch xe" />}
      </section>

      <LiveTrackingPanel data={data} trips={activeTrips} />

      <section className="panel alert-panel">
        <div className="panel-header"><div><h2>Cảnh báo cần chú ý</h2><p>Giấy tờ, bảo dưỡng, sự cố và chậm chuyến</p></div></div>
        {alerts.length ? <div className="alert-list">{alerts.map((item, index) => <div className={`alert-item ${item.level}`} key={`${item.title}-${index}`}><span>{item.level === 'danger' ? '!' : item.level === 'warning' ? '⚠' : 'i'}</span><div><strong>{item.title}</strong><small>{item.detail}</small></div></div>)}</div> : <EmptyState icon="✅" title="Không có cảnh báo khẩn" description="Hệ thống chưa phát hiện giấy tờ hoặc xe cần xử lý ngay." />}
      </section>

      <section className="panel activity-panel">
        <div className="panel-header"><div><h2>Hoạt động gần đây</h2><p>Bấm vào từng hoạt động để xem đầy đủ thông tin</p></div></div>
        <div className="timeline interactive-timeline">
          {recentActivities.map((activity) => activity.kind === 'incident'
            ? <button type="button" className="timeline-item timeline-action" onClick={() => setSelectedActivity(activity)} key={`incident-${activity.item.id}`}><span className="timeline-dot danger" /><div><strong>{INCIDENT_LABELS[activity.item.type]}</strong><p>{activity.item.description || 'Không có mô tả'}</p><small>{formatDateTime(activity.item.created_at)}</small></div><span className="timeline-chevron">›</span></button>
            : <button type="button" className="timeline-item timeline-action" onClick={() => setSelectedActivity(activity)} key={`expense-${activity.item.id}`}><span className="timeline-dot" /><div><strong>{EXPENSE_LABELS[activity.item.type]} · {formatCurrency(activity.item.amount)}</strong><p>{localizedExpenseDescription(activity.item)}</p><small>{formatDateTime(activity.item.created_at)}</small></div><span className="timeline-chevron">›</span></button>)}
          {!recentActivities.length && <EmptyState title="Chưa có hoạt động" />}
        </div>
      </section>

      {selectedTrip && <TripDetailModal trip={data.trips.find((item) => item.id === selectedTrip.id) ?? selectedTrip} canManage={false} onClose={() => setSelectedTrip(null)} onEdit={() => undefined} onCancel={() => undefined} onDelete={() => undefined} />}
      {selectedActivity && <ActivityDetailModal activity={selectedActivity} data={data} onClose={() => setSelectedActivity(null)} onOpenTrip={(tripId) => { const trip = data.trips.find((item) => item.id === tripId); if (trip) { setSelectedActivity(null); setSelectedTrip(trip) } }} />}
    </div>
  )
}


function ActivityDetailModal({ activity, data, onClose, onOpenTrip }: {
  activity: { kind: 'expense'; item: Expense } | { kind: 'incident'; item: Incident }
  data: AppData
  onClose: () => void
  onOpenTrip: (tripId: string) => void
}) {
  const item = activity.item
  const vehicle = data.vehicles.find((entry) => entry.id === item.vehicle_id)
  const driver = data.profiles.find((entry) => entry.id === item.driver_id)
  const trip = item.trip_id ? data.trips.find((entry) => entry.id === item.trip_id) : undefined

  if (activity.kind === 'expense') {
    const expense = activity.item
    return <Modal title={`Chi tiết chi phí · ${EXPENSE_LABELS[expense.type]}`} onClose={onClose}>
      <div className="activity-detail-summary expense-detail-summary"><span>{EXPENSE_LABELS[expense.type]}</span><strong>{formatCurrency(expense.amount)}</strong><StatusBadge status={expense.status} /></div>
      <div className="detail-grid compact-detail-grid">
        <div><span>Xe</span><strong>{vehicle?.plate_number || '—'}</strong></div>
        <div><span>Tài xế</span><strong>{driver?.full_name || '—'}</strong></div>
        <div><span>Ngày chi phí</span><strong>{formatDateTime(expense.expense_date)}</strong></div>
        <div><span>Ngày gửi</span><strong>{formatDateTime(expense.created_at)}</strong></div>
        {expense.type === 'fuel' && <><div><span>Số lít</span><strong>{expense.fuel_liters ? `${expense.fuel_liters} lít` : '—'}</strong></div><div><span>Đơn giá</span><strong>{expense.fuel_unit_price ? formatCurrency(expense.fuel_unit_price) : '—'}</strong></div></>}
        <div className="detail-grid-wide"><span>Nội dung</span><strong>{localizedExpenseDescription(expense)}</strong></div>
      </div>
      {expense.receipt_url && <section className="activity-receipt-section">
        <div className="activity-receipt-heading"><h3>Ảnh hóa đơn</h3><span>Bấm vào ảnh để xem toàn màn hình</span></div>
        <ImagePreview src={expense.receipt_url} alt={`Hóa đơn ${EXPENSE_LABELS[expense.type]} ${formatCurrency(expense.amount)}`} />
      </section>}
      <div className="activity-detail-actions">
        {trip && <button type="button" className="primary-button" onClick={() => onOpenTrip(trip.id)}>Xem chuyến liên quan</button>}
      </div>
    </Modal>
  }

  const incident = activity.item
  return <Modal title={`Chi tiết sự cố · ${INCIDENT_LABELS[incident.type]}`} onClose={onClose}>
    <div className="activity-detail-summary incident-detail-summary"><span>{INCIDENT_LABELS[incident.type]}</span><strong>{incident.severity === 'critical' ? 'Khẩn cấp' : incident.severity === 'high' ? 'Nghiêm trọng' : incident.severity === 'medium' ? 'Cần kiểm tra' : 'Mức nhẹ'}</strong><StatusBadge status={incident.status} /></div>
    <div className="detail-grid compact-detail-grid">
      <div><span>Xe</span><strong>{vehicle?.plate_number || '—'}</strong></div>
      <div><span>Tài xế</span><strong>{driver?.full_name || '—'}</strong></div>
      <div><span>Thời gian báo</span><strong>{formatDateTime(incident.created_at)}</strong></div>
      <div><span>Đã xử lý</span><strong>{formatDateTime(incident.resolved_at)}</strong></div>
      <div className="detail-grid-wide"><span>Mô tả</span><strong>{incident.description || 'Không có mô tả'}</strong></div>
      {incident.resolution && <div className="detail-grid-wide"><span>Kết quả xử lý</span><strong>{incident.resolution}</strong></div>}
    </div>
    <div className="activity-detail-actions">
      {incident.image_url && <a className="secondary-button" href={incident.image_url} target="_blank" rel="noreferrer">Xem ảnh</a>}
      {incident.audio_url && <a className="secondary-button" href={incident.audio_url} target="_blank" rel="noreferrer">Nghe ghi âm</a>}
      {incident.lat != null && incident.lng != null && <a className="secondary-button" href={googleMapsLocationUrl({ lat: incident.lat, lng: incident.lng })} target="_blank" rel="noreferrer">Xem vị trí</a>}
      {trip && <button type="button" className="primary-button" onClick={() => onOpenTrip(trip.id)}>Xem chuyến liên quan</button>}
    </div>
  </Modal>
}

function DepartmentWorkspace({ role, data, metrics, activeTrips }: { role: OfficeRole; data: AppData; metrics: DashboardMetrics; activeTrips: Trip[] }) {
  if (role === 'accountant') return <AccountantWorkspace data={data} />
  if (role === 'fleet') return <FleetWorkspace data={data} />
  if (role === 'director') return <DirectorWorkspace data={data} metrics={metrics} activeTrips={activeTrips} />
  if (role === 'admin') return <AdminWorkspace data={data} />
  return <DispatcherWorkspace data={data} activeTrips={activeTrips} />
}

function DispatcherWorkspace({ data, activeTrips }: { data: AppData; activeTrips: Trip[] }) {
  const now = Date.now()
  const delayed = data.trips.filter((trip) => ['assigned', 'accepted', 'ready'].includes(trip.status) && new Date(trip.scheduled_start).getTime() < now).slice(0, 5)
  const upcoming = data.trips.filter((trip) => ['assigned', 'accepted', 'ready'].includes(trip.status) && new Date(trip.scheduled_start).getTime() >= now).sort((a, b) => new Date(a.scheduled_start).getTime() - new Date(b.scheduled_start).getTime()).slice(0, 5)
  return <section className="role-workspace role-workspace-dispatcher">
    <div className="role-workspace-heading"><div><span>KHÔNG GIAN ĐIỀU PHỐI</span><h3>Điều hành chuyến theo thời gian thực</h3><p>Ưu tiên xe đang chạy, chuyến sắp khởi hành và chuyến trễ cần xử lý.</p></div><strong>{activeTrips.length} xe đang chạy</strong></div>
    <div className="workspace-columns">
      <WorkspaceList title="Chuyến cần xử lý" tone="danger" empty="Không có chuyến trễ" items={delayed.map((trip) => ({ title: trip.destination, detail: `${formatDateTime(trip.scheduled_start)} · ${vehiclePlate(data, trip)}`, status: 'Trễ giờ' }))} />
      <WorkspaceList title="Chuyến sắp khởi hành" tone="success" empty="Chưa có chuyến sắp đi" items={upcoming.map((trip) => ({ title: trip.destination, detail: `${formatDateTime(trip.scheduled_start)} · ${driverName(data, trip)}`, status: PURPOSE_LABELS[trip.purpose] }))} />
    </div>
  </section>
}

function AccountantWorkspace({ data }: { data: AppData }) {
  const pending = data.expenses.filter((item) => item.status === 'pending_accountant').sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
  const pendingAmount = pending.reduce((sum, item) => sum + item.amount, 0)
  const monthStart = new Date(); monthStart.setDate(1); monthStart.setHours(0, 0, 0, 0)
  const monthExpenses = data.expenses.filter((item) => new Date(item.expense_date).getTime() >= monthStart.getTime() && (item.status === 'approved' || item.status === 'paid'))
  const monthAmount = monthExpenses.reduce((sum, item) => sum + item.amount, 0)
  const topTypes = Object.entries(EXPENSE_LABELS).map(([key, label]) => ({ label, value: monthExpenses.filter((item) => item.type === key).reduce((sum, item) => sum + item.amount, 0) })).sort((a, b) => b.value - a.value).slice(0, 4)
  return <section className="role-workspace role-workspace-accountant">
    <div className="role-workspace-heading"><div><span>KHÔNG GIAN KẾ TOÁN</span><h3>Kiểm soát chi phí và chứng từ</h3><p>Chỉ xử lý các khoản đã được Ban Giám đốc duyệt, sau đó xác nhận chi trả.</p></div><strong>{formatCurrency(pendingAmount)} chờ xử lý</strong></div>
    <div className="finance-overview-grid">
      <article><span>Chi phí tháng này</span><strong>{formatCurrency(monthAmount)}</strong><small>{monthExpenses.length} chứng từ hợp lệ</small></article>
      <article><span>Chờ Kế toán duyệt</span><strong>{formatCurrency(pendingAmount)}</strong><small>{pending.length} khoản đã qua Ban Giám đốc</small></article>
      <article><span>Đã thanh toán</span><strong>{data.expenses.filter((item) => item.status === 'paid').length}</strong><small>Khoản đã hoàn tất</small></article>
    </div>
    <div className="workspace-columns">
      <WorkspaceList title="Chứng từ chờ Kế toán duyệt" tone="warning" empty="Không có khoản chờ duyệt" items={pending.slice(0, 5).map((item) => ({ title: formatCurrency(item.amount), detail: `${EXPENSE_LABELS[item.type]} · ${formatDateTime(item.created_at)}`, status: item.receipt_url ? 'Có hóa đơn' : 'Chưa có hóa đơn' }))} />
      <div className="workspace-breakdown"><h4>Nhóm chi phí lớn trong tháng</h4>{topTypes.map((item) => <div key={item.label}><span>{item.label}</span><strong>{formatCurrency(item.value)}</strong></div>)}</div>
    </div>
  </section>
}

function FleetWorkspace({ data }: { data: AppData }) {
  const openIncidents = data.incidents.filter((item) => item.status !== 'resolved')
  return <section className="role-workspace role-workspace-fleet">
    <div className="role-workspace-heading"><div><span>KHÔNG GIAN ĐỘI XE</span><h3>Sức khỏe phương tiện và bảo dưỡng</h3><p>Hiển thị trạng thái xe, giấy tờ, mốc bảo dưỡng và sự cố chưa hoàn tất.</p></div><strong>{openIncidents.length} sự cố đang mở</strong></div>
    <div className="vehicle-health-grid">{data.vehicles.map((vehicle) => {
      const registration = daysUntil(vehicle.registration_expiry)
      const insurance = daysUntil(vehicle.insurance_expiry)
      const incidents = openIncidents.filter((item) => item.vehicle_id === vehicle.id).length
      const maintenanceDue = vehicle.next_maintenance_odometer != null && vehicle.odometer >= vehicle.next_maintenance_odometer
      return <article className={`vehicle-health-card ${incidents || maintenanceDue ? 'needs-attention' : ''}`} key={vehicle.id}>
        <div><strong>{vehicle.plate_number}</strong><span>{vehicle.vehicle_name}</span></div>
        <em>{VEHICLE_STATUS_LABELS[vehicle.status]}</em>
        <ul>
          <li>Đăng kiểm: <strong>{registration == null ? 'Chưa cập nhật' : registration < 0 ? `Quá hạn ${Math.abs(registration)} ngày` : `Còn ${registration} ngày`}</strong></li>
          <li>Bảo hiểm: <strong>{insurance == null ? 'Chưa cập nhật' : insurance < 0 ? `Quá hạn ${Math.abs(insurance)} ngày` : `Còn ${insurance} ngày`}</strong></li>
          <li>Sự cố mở: <strong>{incidents}</strong></li>
        </ul>
      </article>
    })}</div>
  </section>
}

function DirectorWorkspace({ data, metrics, activeTrips }: { data: AppData; metrics: DashboardMetrics; activeTrips: Trip[] }) {
  const monthStart = new Date(); monthStart.setDate(1); monthStart.setHours(0, 0, 0, 0)
  const monthExpense = data.expenses.filter((item) => new Date(item.expense_date).getTime() >= monthStart.getTime() && (item.status === 'approved' || item.status === 'paid')).reduce((sum, item) => sum + item.amount, 0)
  const urgent = data.incidents.filter((item) => item.status !== 'resolved' && ['high', 'critical'].includes(item.severity)).length
  const readiness = metrics.totalVehicles ? Math.round((metrics.available / metrics.totalVehicles) * 100) : 0
  return <section className="role-workspace role-workspace-director">
    <div className="role-workspace-heading"><div><span>TRUNG TÂM QUYẾT ĐỊNH</span><h3>Tổng hợp điều hành dành cho lãnh đạo</h3><p>Các con số quan trọng được cô đọng để cập nhật và ra quyết định nhanh.</p></div><strong>Cập nhật tức thời</strong></div>
    <div className="director-kpi-grid">
      <article><span>Xe đang vận hành</span><strong>{activeTrips.length}</strong><small>trên {metrics.totalVehicles} xe</small></article>
      <article><span>Mức sẵn sàng</span><strong>{readiness}%</strong><small>{metrics.available} xe có thể điều ngay</small></article>
      <article><span>Chi phí tháng</span><strong>{formatCurrency(monthExpense)}</strong><small>Không tính khoản bị từ chối</small></article>
      <article className={urgent ? 'urgent' : ''}><span>Cảnh báo nghiêm trọng</span><strong>{urgent}</strong><small>Sự cố cần chỉ đạo</small></article>
    </div>
  </section>
}

function AdminWorkspace({ data }: { data: AppData }) {
  const active = data.profiles.filter((item) => item.active).length
  const inactive = data.profiles.length - active
  const missingDepartment = data.profiles.filter((item) => !item.department?.trim()).length
  const roles = (Object.keys(ROLE_LABELS) as UserRole[]).map((role) => ({ role, count: data.profiles.filter((item) => item.role === role).length }))
  return <section className="role-workspace role-workspace-admin">
    <div className="role-workspace-heading"><div><span>TRUNG TÂM BẢO MẬT & PHÂN QUYỀN</span><h3>Quản trị người dùng và tính toàn vẹn dữ liệu</h3><p>Kiểm soát tài khoản, bộ phận, vai trò và các điểm cần hoàn thiện hồ sơ.</p></div><strong>{active} tài khoản hoạt động</strong></div>
    <div className="admin-security-grid">
      <article><span>Tài khoản hoạt động</span><strong>{active}</strong><small>{inactive} tài khoản đang khóa</small></article>
      <article className={missingDepartment ? 'warning' : ''}><span>Thiếu thông tin bộ phận</span><strong>{missingDepartment}</strong><small>Cần cập nhật để phân quyền rõ hơn</small></article>
      <article><span>Dữ liệu nghiệp vụ</span><strong>{data.trips.length + data.expenses.length + data.incidents.length}</strong><small>Bản ghi chuyến, chi phí và sự cố</small></article>
    </div>
    <div className="role-distribution-grid">{roles.map((item) => <div key={item.role}><span>{ROLE_LABELS[item.role]}</span><strong>{item.count}</strong></div>)}</div>
  </section>
}

function WorkspaceList({ title, items, empty, tone }: { title: string; items: Array<{ title: string; detail: string; status: string }>; empty: string; tone: string }) {
  return <div className={`workspace-list ${tone}`}><h4>{title}</h4>{items.length ? items.map((item, index) => <article key={`${item.title}-${index}`}><div><strong>{item.title}</strong><small>{item.detail}</small></div><span>{item.status}</span></article>) : <p className="workspace-empty">{empty}</p>}</div>
}

function LiveTrackingPanel({ data, trips }: { data: AppData; trips: Trip[] }) {
  return <section className="panel tracking-panel modern-panel-span-2">
    <div className="panel-header"><div><h2>Giám sát vị trí xe đang chạy</h2><p>Các bộ phận được phân quyền có thể theo dõi ngay khi tài xế bắt đầu chuyến.</p></div><span className="count-pill">{trips.length} xe hoạt động</span></div>
    {trips.length ? <div className="live-trip-grid">{trips.map((trip) => {
      const vehicle = data.vehicles.find((v) => v.id === trip.vehicle_id)
      const driver = data.profiles.find((p) => p.id === trip.driver_id)
      const liveLat = trip.current_lat ?? trip.start_lat
      const liveLng = trip.current_lng ?? trip.start_lng
      const hasLocation = liveLat != null && liveLng != null
      return <article className="live-trip-card" key={trip.id}>
        <div className="live-trip-top"><div><strong>{vehicle?.plate_number ?? 'Chưa gán xe'}</strong><small>{vehicle?.vehicle_name || 'Phương tiện đang vận hành'}</small></div><StatusBadge status={trip.status} /></div>
        <div className="live-trip-route"><div><span>Điểm đón</span><strong>{trip.pickup}</strong></div><div><span>Điểm đến</span><strong>{trip.destination}</strong></div></div>
        <div className="live-trip-meta"><span>Tài xế: <strong>{driver?.full_name || 'Chưa rõ'}</strong></span><span>Loại chuyến: <strong>{PURPOSE_LABELS[trip.purpose]}</strong></span><span>Bắt đầu: <strong>{formatDateTime(trip.started_at ?? trip.updated_at)}</strong></span><span>Cập nhật GPS: <strong>{formatDateTime(trip.location_updated_at ?? trip.updated_at)}</strong></span></div>
        {hasLocation ? <>
          <div className="live-trip-map">
            <iframe
              title={`Vị trí xe ${vehicle?.plate_number ?? ''}`}
              src={`https://maps.google.com/maps?q=${liveLat},${liveLng}&z=16&output=embed`}
              loading="lazy"
              referrerPolicy="no-referrer-when-downgrade"
            />
            <div className="live-map-logo-marker" aria-label="Vị trí xe">
              <img src="/logo-bvmsgtv-v201.png" alt="Logo Bệnh viện Mắt Sài Gòn Trà Vinh" />
              <span>{vehicle?.plate_number ?? 'Xe BV'}</span>
            </div>
            <span className={`live-location-freshness ${locationFreshnessClass(trip.location_updated_at)}`}>{locationFreshnessLabel(trip.location_updated_at)}</span>
          </div>
          <div className="live-trip-location"><code>{liveLat!.toFixed(6)}, {liveLng!.toFixed(6)}</code><a href={googleMapsLocationUrl({ lat: liveLat!, lng: liveLng! })} target="_blank" rel="noreferrer">Mở Google Maps</a></div>
        </> : <div className="live-trip-location empty">Tài xế chưa cấp quyền vị trí hoặc GPS chưa sẵn sàng.</div>}
      </article>
    })}</div> : <EmptyState icon="📍" title="Chưa có xe đang chạy" description="Khi tài xế bắt đầu chuyến, vị trí xe sẽ xuất hiện tại đây." />}
  </section>
}

function locationAgeSeconds(value?: string | null) {
  if (!value) return Number.POSITIVE_INFINITY
  return Math.max(0, Math.round((Date.now() - new Date(value).getTime()) / 1000))
}

function locationFreshnessClass(value?: string | null) {
  const age = locationAgeSeconds(value)
  if (age <= 30) return 'live'
  if (age <= 120) return 'delayed'
  return 'stale'
}

function locationFreshnessLabel(value?: string | null) {
  const age = locationAgeSeconds(value)
  if (!Number.isFinite(age)) return 'Chưa có GPS'
  if (age <= 15) return 'Đang trực tiếp'
  if (age < 60) return `Cập nhật ${age} giây trước`
  const minutes = Math.floor(age / 60)
  return `Cập nhật ${minutes} phút trước`
}

function vehiclePlate(data: AppData, trip: Trip) {
  return data.vehicles.find((item) => item.id === trip.vehicle_id)?.plate_number ?? 'Chưa gán xe'
}

function driverName(data: AppData, trip: Trip) {
  return data.profiles.find((item) => item.id === trip.driver_id)?.full_name ?? 'Chưa gán tài xế'
}

function Metric({ icon, label, value, tone, wide }: { icon: string; label: string; value: string | number; tone?: string; wide?: boolean }) {
  return <article className={`metric-card ${tone ?? ''} ${wide ? 'wide' : ''}`}><span className="metric-icon">{icon}</span><div><p>{label}</p><strong>{value}</strong></div></article>
}
