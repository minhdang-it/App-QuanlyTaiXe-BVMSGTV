import type { AppData, Trip, Vehicle } from '../types/models'
import { daysUntil, formatDateTime } from './utils'

export type OperationalInsight = {
  id: string
  level: 'danger' | 'warning' | 'info'
  title: string
  detail: string
  entity: 'vehicle' | 'trip' | 'expense' | 'incident'
  entityId: string
}

export function vehicleReadinessIssues(vehicle: Vehicle | null | undefined) {
  if (!vehicle) return [] as OperationalInsight[]
  const items: OperationalInsight[] = []
  const add = (id: string, level: OperationalInsight['level'], title: string, detail: string) => items.push({ id, level, title, detail, entity: 'vehicle', entityId: vehicle.id })
  const registration = daysUntil(vehicle.registration_expiry)
  const insurance = daysUntil(vehicle.insurance_expiry)
  const roadFee = daysUntil(vehicle.road_fee_expiry)
  const oilDate = daysUntil(vehicle.next_oil_change_date)
  const maintenanceDate = daysUntil(vehicle.next_maintenance_date)

  if (vehicle.status === 'maintenance' || vehicle.status === 'out_of_service') add(`vehicle-status-${vehicle.id}`, 'danger', `${vehicle.plate_number} chưa sẵn sàng`, vehicle.status === 'maintenance' ? 'Xe đang ở trạng thái bảo dưỡng.' : 'Xe đang ngưng sử dụng.')
  if (registration != null && registration < 0) add(`registration-${vehicle.id}`, 'danger', `${vehicle.plate_number} đã quá hạn đăng kiểm`, `Quá hạn ${Math.abs(registration)} ngày.`)
  else if (registration != null && registration <= 7) add(`registration-${vehicle.id}`, 'warning', `${vehicle.plate_number} sắp hết đăng kiểm`, `Còn ${registration} ngày.`)
  if (insurance != null && insurance < 0) add(`insurance-${vehicle.id}`, 'danger', `${vehicle.plate_number} đã quá hạn bảo hiểm TNDS`, `Quá hạn ${Math.abs(insurance)} ngày.`)
  else if (insurance != null && insurance <= 7) add(`insurance-${vehicle.id}`, 'warning', `${vehicle.plate_number} sắp hết bảo hiểm TNDS`, `Còn ${insurance} ngày.`)
  if (roadFee != null && roadFee < 0) add(`roadfee-${vehicle.id}`, 'warning', `${vehicle.plate_number} đã quá hạn phí đường bộ`, `Quá hạn ${Math.abs(roadFee)} ngày.`)
  else if (roadFee != null && roadFee <= 7) add(`roadfee-${vehicle.id}`, 'warning', `${vehicle.plate_number} sắp hết phí đường bộ`, `Còn ${roadFee} ngày.`)
  if (oilDate != null && oilDate < 0) add(`oil-date-${vehicle.id}`, 'warning', `${vehicle.plate_number} quá lịch thay nhớt`, `Quá lịch ${Math.abs(oilDate)} ngày.`)
  if (vehicle.next_oil_change_odometer != null && vehicle.odometer >= vehicle.next_oil_change_odometer) add(`oil-km-${vehicle.id}`, 'warning', `${vehicle.plate_number} đã đến mốc thay nhớt`, `KM hiện tại ${vehicle.odometer.toLocaleString('vi-VN')} km.`)
  if (maintenanceDate != null && maintenanceDate < 0) add(`maint-date-${vehicle.id}`, 'warning', `${vehicle.plate_number} quá lịch bảo dưỡng`, `Quá lịch ${Math.abs(maintenanceDate)} ngày.`)
  if (vehicle.next_maintenance_odometer != null && vehicle.odometer >= vehicle.next_maintenance_odometer) add(`maint-km-${vehicle.id}`, 'warning', `${vehicle.plate_number} đã đến mốc bảo dưỡng`, `KM hiện tại ${vehicle.odometer.toLocaleString('vi-VN')} km.`)
  return items
}

export function tripOperationalIssues(trip: Trip, data: AppData) {
  const items: OperationalInsight[] = []
  const vehicle = data.vehicles.find((item) => item.id === trip.vehicle_id)
  const add = (id: string, level: OperationalInsight['level'], title: string, detail: string) => items.push({ id, level, title, detail, entity: 'trip', entityId: trip.id })
  const start = new Date(trip.scheduled_start).getTime()
  const expected = trip.expected_end ? new Date(trip.expected_end).getTime() : null

  if (expected != null && expected <= start) add(`trip-time-${trip.id}`, 'danger', 'Thời gian chuyến không hợp lệ', `${vehicle?.plate_number ?? 'Chuyến xe'} có thời gian dự kiến về trước hoặc bằng giờ xuất phát.`)
  if (trip.start_odometer != null && trip.end_odometer != null && trip.end_odometer < trip.start_odometer) add(`trip-km-${trip.id}`, 'danger', 'KM cuối nhỏ hơn KM đầu', `${vehicle?.plate_number ?? 'Chuyến xe'} cần kiểm tra lại số kilomet.`)
  if (trip.status === 'completed' && trip.end_odometer == null) add(`trip-endkm-${trip.id}`, 'warning', 'Chuyến hoàn thành nhưng thiếu KM cuối', `${vehicle?.plate_number ?? 'Chuyến xe'} · kết thúc ${formatDateTime(trip.ended_at ?? trip.updated_at)}`)
  if (trip.status === 'active' && expected != null && expected < Date.now()) add(`trip-overdue-${trip.id}`, 'warning', 'Chuyến đang chạy quá thời gian dự kiến', `${vehicle?.plate_number ?? 'Chuyến xe'} · dự kiến về ${formatDateTime(trip.expected_end)}`)
  return items
}

export function detectOperationalInsights(data: AppData) {
  const items: OperationalInsight[] = []
  data.vehicles.forEach((vehicle) => items.push(...vehicleReadinessIssues(vehicle)))
  data.trips.forEach((trip) => items.push(...tripOperationalIssues(trip, data)))

  const receiptGroups = new Map<string, string[]>()
  data.expenses.forEach((item) => {
    if (!item.receipt_url) return
    const ids = receiptGroups.get(item.receipt_url) ?? []
    ids.push(item.id)
    receiptGroups.set(item.receipt_url, ids)
  })
  for (const [receiptUrl, ids] of receiptGroups) {
    if (ids.length < 2) continue
    items.push({ id: `receipt-${receiptUrl}`, level: 'warning', title: 'Một hóa đơn xuất hiện ở nhiều khoản chi', detail: `${ids.length} khoản chi đang dùng cùng một ảnh/chứng từ.`, entity: 'expense', entityId: ids[0] })
  }

  return items.sort((a, b) => {
    const rank = { danger: 0, warning: 1, info: 2 }
    return rank[a.level] - rank[b.level]
  })
}

export function hasBlockingVehicleIssue(vehicle: Vehicle | null | undefined) {
  return vehicleReadinessIssues(vehicle).some((item) => item.level === 'danger')
}
