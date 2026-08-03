import { useMemo } from 'react'
import { useData } from '../context/DataContext'
import { daysUntil, formatCurrency, formatDateTime, isSameLocalDay } from '../lib/utils'
import { PURPOSE_LABELS } from '../lib/constants'
import { StatusBadge } from '../components/StatusBadge'
import { EmptyState } from '../components/EmptyState'

export function DashboardPage() {
  const { data } = useData()

  const metrics = useMemo(() => {
    const todayTrips = data.trips.filter((trip) => isSameLocalDay(trip.scheduled_start))
    const todayExpenses = data.expenses.filter((item) => isSameLocalDay(item.expense_date))
    const now = Date.now()
    return {
      totalVehicles: data.vehicles.length,
      running: data.vehicles.filter((v) => v.status === 'in_use').length,
      available: data.vehicles.filter((v) => v.status === 'available').length,
      maintenance: data.vehicles.filter((v) => v.status === 'maintenance').length,
      completed: todayTrips.filter((t) => t.status === 'completed').length,
      delayed: todayTrips.filter((t) => ['assigned', 'accepted', 'ready'].includes(t.status) && new Date(t.scheduled_start).getTime() < now).length,
      expense: todayExpenses.reduce((sum, item) => sum + item.amount, 0),
      pendingExpenses: data.expenses.filter((e) => e.status === 'pending').length,
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
      const from = Date.now() - 30 * 86_400_000
      const recentTrips = data.trips.filter((trip) => trip.vehicle_id === vehicle.id && trip.status === 'completed' && new Date(trip.ended_at ?? trip.scheduled_start).getTime() >= from)
      const recentDistance = recentTrips.reduce((sum, trip) => sum + Math.max(0, (trip.end_odometer ?? 0) - (trip.start_odometer ?? 0)), 0)
      const recentFuel = data.expenses.filter((expense) => expense.vehicle_id === vehicle.id && expense.type === 'fuel' && new Date(expense.expense_date).getTime() >= from && expense.status !== 'rejected').reduce((sum, expense) => sum + (expense.fuel_liters ?? 0), 0)
      const actualRate = recentDistance > 0 ? recentFuel / recentDistance * 100 : 0
      if (recentDistance >= 100 && vehicle.fuel_norm_l_per_100km && actualRate > vehicle.fuel_norm_l_per_100km * 1.2) items.push({ level: 'warning', title: `${vehicle.plate_number} tiêu hao nhiên liệu cao`, detail: `${actualRate.toFixed(1)} L/100km, định mức ${vehicle.fuel_norm_l_per_100km} L/100km` })
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

  const todayTrips = data.trips.filter((trip) => isSameLocalDay(trip.scheduled_start)).sort((a, b) => new Date(a.scheduled_start).getTime() - new Date(b.scheduled_start).getTime())

  return (
    <div className="dashboard-grid">
      <section className="metric-grid">
        <Metric icon="🚘" label="Tổng số xe" value={metrics.totalVehicles} />
        <Metric icon="🟢" label="Xe đang chạy" value={metrics.running} tone="success" />
        <Metric icon="🅿️" label="Xe đang trống" value={metrics.available} />
        <Metric icon="🔧" label="Xe đang sửa" value={metrics.maintenance} tone="warning" />
        <Metric icon="✓" label="Chuyến hoàn thành" value={metrics.completed} tone="success" />
        <Metric icon="⏰" label="Chuyến trễ giờ" value={metrics.delayed} tone={metrics.delayed ? 'danger' : undefined} />
        <Metric icon="💵" label="Chi phí hôm nay" value={formatCurrency(metrics.expense)} wide />
        <Metric icon="🧾" label="Chi phí chờ duyệt" value={metrics.pendingExpenses} tone={metrics.pendingExpenses ? 'warning' : undefined} />
      </section>

      <section className="panel trip-panel">
        <div className="panel-header"><div><h2>Lịch xe hôm nay</h2><p>Theo dõi tiến độ các chuyến đã điều</p></div><span className="count-pill">{todayTrips.length} chuyến</span></div>
        {todayTrips.length ? <div className="table-wrap"><table><thead><tr><th>Giờ</th><th>Xe / Tài xế</th><th>Hành trình</th><th>Loại chuyến</th><th>Trạng thái</th></tr></thead><tbody>{todayTrips.map((trip) => {
          const vehicle = data.vehicles.find((v) => v.id === trip.vehicle_id)
          const driver = data.profiles.find((p) => p.id === trip.driver_id)
          return <tr key={trip.id}><td><strong>{new Intl.DateTimeFormat('vi-VN', { hour: '2-digit', minute: '2-digit' }).format(new Date(trip.scheduled_start))}</strong></td><td><strong>{vehicle?.plate_number}</strong><small>{driver?.full_name}</small></td><td><strong>{trip.destination}</strong><small>{trip.pickup}</small></td><td>{PURPOSE_LABELS[trip.purpose]}</td><td><StatusBadge status={trip.status} /></td></tr>
        })}</tbody></table></div> : <EmptyState icon="📅" title="Hôm nay chưa có lịch xe" />}
      </section>

      <section className="panel alert-panel">
        <div className="panel-header"><div><h2>Cảnh báo cần chú ý</h2><p>Giấy tờ, bảo dưỡng và sự cố</p></div></div>
        {alerts.length ? <div className="alert-list">{alerts.map((item, index) => <div className={`alert-item ${item.level}`} key={`${item.title}-${index}`}><span>{item.level === 'danger' ? '!' : item.level === 'warning' ? '⚠' : 'i'}</span><div><strong>{item.title}</strong><small>{item.detail}</small></div></div>)}</div> : <EmptyState icon="✅" title="Không có cảnh báo khẩn" description="Hệ thống chưa phát hiện giấy tờ hoặc xe cần xử lý ngay." />}
      </section>

      <section className="panel activity-panel">
        <div className="panel-header"><div><h2>Hoạt động gần đây</h2><p>Cập nhật mới nhất từ đội xe</p></div></div>
        <div className="timeline">
          {data.incidents.slice(0, 3).map((item) => <div className="timeline-item" key={item.id}><span className="timeline-dot danger" /><div><strong>Báo sự cố</strong><p>{item.description || item.type}</p><small>{formatDateTime(item.created_at)}</small></div></div>)}
          {data.expenses.slice(0, 3).map((item) => <div className="timeline-item" key={item.id}><span className="timeline-dot" /><div><strong>Chi phí {formatCurrency(item.amount)}</strong><p>{item.description || item.type}</p><small>{formatDateTime(item.created_at)}</small></div></div>)}
          {!data.incidents.length && !data.expenses.length && <EmptyState title="Chưa có hoạt động" />}
        </div>
      </section>
    </div>
  )
}

function Metric({ icon, label, value, tone, wide }: { icon: string; label: string; value: string | number; tone?: string; wide?: boolean }) {
  return <article className={`metric-card ${tone ?? ''} ${wide ? 'wide' : ''}`}><span className="metric-icon">{icon}</span><div><p>{label}</p><strong>{value}</strong></div></article>
}
