import type { ExpenseType, IncidentType, TripPurpose, UserRole, VehicleStatus } from '../types/models'

export const ROLE_LABELS: Record<UserRole, string> = {
  driver: 'Tài xế',
  department_head: 'Trưởng khoa',
  dispatcher: 'Điều phối xe',
  accountant: 'Kế toán',
  fleet: 'Hành chính đội xe',
  director: 'Ban Giám đốc',
  admin: 'Quản trị hệ thống',
}

export const PURPOSE_LABELS: Record<TripPurpose, string> = {
  patient_pickup: 'Đón bệnh nhân mổ',
  patient_return: 'Đưa bệnh nhân về',
  community_exam: 'Khám cộng đồng',
  board_business: 'Đi công tác',
  staff_transport: 'Vận chuyển nhân sự',
  medicine_supply: 'Vận chuyển thuốc, vật tư',
  marketing_care: 'Marketing và CSKH',
  administrative: 'Công việc hành chính',
  personal_other: 'Chuyến cá nhân/phát sinh',
}

export const EXPENSE_LABELS: Record<ExpenseType, string> = {
  fuel: 'Xăng dầu',
  toll: 'Cầu đường',
  parking: 'Gửi xe',
  washing: 'Rửa xe',
  repair: 'Sửa chữa',
  other: 'Chi phí khác',
}

export const EXPENSE_ICONS: Record<ExpenseType, string> = {
  fuel: '⛽',
  toll: '🛣️',
  parking: '🅿️',
  washing: '🧽',
  repair: '🔧',
  other: '🧾',
}

export const INCIDENT_LABELS: Record<IncidentType, string> = {
  breakdown: 'Xe hư',
  collision: 'Va quẹt hoặc tai nạn',
  flat_tire: 'Thủng lốp',
  dashboard_warning: 'Cảnh báo bảng đồng hồ',
  abnormal_noise: 'Tiếng kêu bất thường',
  other: 'Khác',
}

export const VEHICLE_STATUS_LABELS: Record<VehicleStatus, string> = {
  available: 'Đang trống',
  in_use: 'Đang chạy',
  maintenance: 'Đang sửa chữa',
  out_of_service: 'Ngừng sử dụng',
}

