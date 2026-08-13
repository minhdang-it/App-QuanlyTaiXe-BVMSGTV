import { useMemo } from 'react'
import { useAuth } from '../context/AuthContext'
import { useData } from '../context/DataContext'
import { daysUntil, formatDateTime } from '../lib/utils'
import type { UserRole } from '../types/models'
import type { PageKey } from './AppShell'

type ActionItem = {
  key: string
  icon: string
  title: string
  detail: string
  count: number
  tone: 'normal' | 'warning' | 'danger' | 'success'
  page: PageKey
}

function actionItemsForRole(role: UserRole, data: ReturnType<typeof useData>['data'], userId: string): ActionItem[] {
  const now = Date.now()
  const items: ActionItem[] = []
  const add = (item: ActionItem) => { if (item.count > 0) items.push(item) }

  if (role === 'department_head') {
    const own = data.vehicleRequests.filter((item) => item.requester_id === userId)
    add({ key: 'request-pending', icon: '📄', title: 'Đề nghị đang chờ Hành chính', detail: 'Theo dõi trạng thái duyệt của khoa/phòng', count: own.filter((item) => item.status === 'pending_fleet').length, tone: 'warning', page: 'requests' })
    add({ key: 'request-approved', icon: '✅', title: 'Đề nghị đã được duyệt', detail: 'Đang chờ Điều phối tạo chuyến', count: own.filter((item) => item.status === 'fleet_approved').length, tone: 'success', page: 'requests' })
    add({ key: 'request-rejected', icon: '!', title: 'Đề nghị cần xem lại', detail: 'Có đề nghị không được duyệt', count: own.filter((item) => item.status === 'rejected').length, tone: 'danger', page: 'requests' })
    return items
  }

  if (role === 'dispatcher' || role === 'admin') {
    add({ key: 'approved-requests', icon: '📥', title: 'Đề nghị chờ tạo chuyến', detail: 'Đã được Hành chính duyệt', count: data.vehicleRequests.filter((item) => item.status === 'fleet_approved').length, tone: 'warning', page: 'dispatch' })
    add({ key: 'late-trips', icon: '⏰', title: 'Chuyến trễ giờ', detail: 'Đã đến giờ nhưng chưa bắt đầu', count: data.trips.filter((item) => ['assigned','accepted','ready'].includes(item.status) && new Date(item.scheduled_start).getTime() < now).length, tone: 'danger', page: 'dispatch' })
    add({ key: 'checklist-review', icon: '☑', title: 'Checklist cần xác nhận', detail: 'Tài xế có mục kiểm tra bất thường', count: data.trips.filter((item) => item.status === 'accepted' && item.checklist_completed).length, tone: 'warning', page: 'dispatch' })
  }

  if (role === 'fleet' || role === 'admin') {
    add({ key: 'fleet-requests', icon: '📄', title: 'Đề nghị xe cần duyệt', detail: 'Khoa/phòng đang chờ Hành chính', count: data.vehicleRequests.filter((item) => item.status === 'pending_fleet').length, tone: 'warning', page: 'requests' })
    add({ key: 'fleet-trips', icon: '🚐', title: 'Yêu cầu điều xe cần xử lý', detail: 'Điều phối đang chờ Hành chính', count: data.trips.filter((item) => item.status === 'pending_fleet').length, tone: 'warning', page: 'dispatch' })
    add({ key: 'fleet-incidents', icon: '⚠️', title: 'Sự cố cần tiếp nhận', detail: 'Đã qua bước phê duyệt và cần xử lý', count: data.incidents.filter((item) => ['reported','handling'].includes(item.status)).length, tone: 'danger', page: 'incidents' })
    add({ key: 'fleet-maintenance', icon: '🔧', title: 'Bảo dưỡng đang thực hiện', detail: 'Theo dõi lịch và tiến độ sửa chữa', count: data.maintenances.filter((item) => ['scheduled','in_progress'].includes(item.status)).length, tone: 'normal', page: 'maintenance' })
  }

  if (role === 'director' || role === 'admin') {
    add({ key: 'director-trips', icon: '🚐', title: 'Chuyến chờ BGĐ duyệt', detail: 'Yêu cầu điều xe đã qua Hành chính', count: data.trips.filter((item) => item.status === 'pending_director').length, tone: 'warning', page: 'dispatch' })
    add({ key: 'director-expenses', icon: '💵', title: 'Chi phí chờ BGĐ duyệt', detail: 'Khoản phát sinh cần phê duyệt', count: data.expenses.filter((item) => item.status === 'pending_director').length, tone: 'warning', page: 'expenses' })
    add({ key: 'director-incidents', icon: '⚠️', title: 'Sự cố chờ BGĐ duyệt', detail: 'Ưu tiên sự cố mức cao và khẩn cấp', count: data.incidents.filter((item) => item.status === 'pending_director').length, tone: 'danger', page: 'incidents' })
    add({ key: 'director-maintenance', icon: '🔧', title: 'Bảo dưỡng chờ BGĐ duyệt', detail: 'Đề nghị sửa chữa/bảo dưỡng mới', count: data.maintenances.filter((item) => item.status === 'pending_director').length, tone: 'warning', page: 'maintenance' })
  }

  if (role === 'accountant' || role === 'admin') {
    add({ key: 'accountant-review', icon: '🧾', title: 'Chi phí chờ Kế toán', detail: 'Đã được BGĐ duyệt, cần kiểm tra chứng từ', count: data.expenses.filter((item) => item.status === 'pending_accountant').length, tone: 'warning', page: 'expenses' })
    add({ key: 'accountant-pay', icon: '✓', title: 'Khoản chờ chi trả', detail: 'Đã duyệt kế toán, chưa xác nhận thanh toán', count: data.expenses.filter((item) => item.status === 'approved').length, tone: 'normal', page: 'expenses' })
  }

  return items
}

export function ActionCenter({ onNavigate, compact = false }: { onNavigate: (page: PageKey) => void; compact?: boolean }) {
  const { user } = useAuth()
  const { data } = useData()
  const role = user!.profile.role
  const items = useMemo(() => actionItemsForRole(role, data, user!.id), [data, role, user])
  const total = items.reduce((sum, item) => sum + item.count, 0)

  return <section className={`action-center ${compact ? 'compact' : ''}`}>
    <div className="action-center-heading">
      <div><span>VIỆC CẦN XỬ LÝ</span><h2>{total ? `${total} việc đang chờ` : 'Không có việc tồn'}</h2><p>{total ? 'Bấm vào từng nhóm để đi thẳng đến màn hình xử lý.' : `Cập nhật gần nhất ${formatDateTime(new Date().toISOString())}`}</p></div>
      <strong className={total ? 'has-work' : 'all-done'}>{total || '✓'}</strong>
    </div>
    {items.length ? <div className="action-center-grid">{items.map((item) => <button type="button" key={item.key} className={`action-center-card ${item.tone}`} onClick={() => onNavigate(item.page)}>
      <span className="action-center-icon">{item.icon}</span>
      <span className="action-center-copy"><strong>{item.title}</strong><small>{item.detail}</small></span>
      <b>{item.count}</b>
      <i aria-hidden="true">›</i>
    </button>)}</div> : <div className="action-center-empty"><span>✓</span><strong>Đã xử lý hết công việc hiện tại</strong><small>Thông báo mới sẽ xuất hiện tự động tại đây.</small></div>}
  </section>
}

export function VehicleDeadlineBadge({ value }: { value?: string | null }) {
  const days = daysUntil(value)
  if (days == null) return <span className="deadline-badge neutral">Chưa cập nhật</span>
  if (days < 0) return <span className="deadline-badge danger">Quá hạn {Math.abs(days)} ngày</span>
  if (days <= 7) return <span className="deadline-badge danger">Còn {days} ngày</span>
  if (days <= 30) return <span className="deadline-badge warning">Còn {days} ngày</span>
  return <span className="deadline-badge success">Còn {days} ngày</span>
}
