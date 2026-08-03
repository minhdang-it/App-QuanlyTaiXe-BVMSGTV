import type { AppData } from '../types/models'
import { ADMIN_DEMO_PHONE, ACCOUNTANT_DEMO_PHONE, DIRECTOR_DEMO_PHONE, DRIVER_DEMO_PHONE } from './constants'
import { toDateTimeLocal } from './utils'

const now = new Date()
const start = new Date(now)
start.setHours(13, 30, 0, 0)
const end = new Date(now)
end.setHours(17, 30, 0, 0)

const plusDays = (days: number) => {
  const d = new Date(now)
  d.setDate(d.getDate() + days)
  return d.toISOString().slice(0, 10)
}

export const demoData: AppData = {
  profiles: [
    { id: 'driver-1', full_name: 'Nguyễn Văn Nam', phone: DRIVER_DEMO_PHONE, role: 'driver', active: true, created_at: now.toISOString() },
    { id: 'dispatcher-1', full_name: 'Lê Minh Đăng', phone: ADMIN_DEMO_PHONE, role: 'dispatcher', active: true, created_at: now.toISOString() },
    { id: 'accountant-1', full_name: 'Trần Thị Kế Toán', phone: ACCOUNTANT_DEMO_PHONE, role: 'accountant', active: true, created_at: now.toISOString() },
    { id: 'director-1', full_name: 'Ban Giám đốc', phone: DIRECTOR_DEMO_PHONE, role: 'director', active: true, created_at: now.toISOString() },
    { id: 'fleet-1', full_name: 'Phòng Hành chính', phone: '0901000005', role: 'fleet', active: true, created_at: now.toISOString() },
  ],
  vehicles: [
    {
      id: 'vehicle-1', plate_number: '84A-123.45', vehicle_name: 'Toyota Innova', vehicle_type: 'Xe 7 chỗ', seats: 7,
      status: 'available', odometer: 128450, regular_driver_id: 'driver-1', registration_expiry: plusDays(22), insurance_expiry: plusDays(46),
      next_maintenance_date: plusDays(15), next_maintenance_odometer: 130000, fuel_norm_l_per_100km: 9.2,
      image_url: null, notes: 'Xe phục vụ đoàn khám cộng đồng', created_at: now.toISOString(), updated_at: now.toISOString(),
    },
    {
      id: 'vehicle-2', plate_number: '84B-678.90', vehicle_name: 'Ford Transit', vehicle_type: 'Xe 16 chỗ', seats: 16,
      status: 'maintenance', odometer: 201240, registration_expiry: plusDays(120), insurance_expiry: plusDays(18),
      next_maintenance_date: plusDays(-1), next_maintenance_odometer: 201000, fuel_norm_l_per_100km: 12.5,
      image_url: null, notes: 'Đang kiểm tra hệ thống điều hòa', created_at: now.toISOString(), updated_at: now.toISOString(),
    },
    {
      id: 'vehicle-3', plate_number: '84A-456.78', vehicle_name: 'Hyundai Accent', vehicle_type: 'Xe 5 chỗ', seats: 5,
      status: 'available', odometer: 76420, registration_expiry: plusDays(210), insurance_expiry: plusDays(190),
      next_maintenance_date: plusDays(60), next_maintenance_odometer: 80000, fuel_norm_l_per_100km: 6.8,
      image_url: null, notes: null, created_at: now.toISOString(), updated_at: now.toISOString(),
    },
  ],
  trips: [
    {
      id: 'trip-1', vehicle_id: 'vehicle-1', driver_id: 'driver-1', purpose: 'community_exam', pickup: 'Bệnh viện Mắt Sài Gòn Trà Vinh',
      destination: 'Xã Đông Hải', contact_name: 'Điều phối đoàn khám', contact_phone: '0909000000', passenger_count: 6,
      scheduled_start: new Date(start).toISOString(), expected_end: new Date(end).toISOString(), status: 'assigned',
      notes: 'Mang theo vật tư khám cộng đồng', checklist_completed: false, created_by: 'dispatcher-1', created_at: now.toISOString(), updated_at: now.toISOString(),
    },
    {
      id: 'trip-2', vehicle_id: 'vehicle-3', driver_id: 'driver-1', purpose: 'patient_pickup', pickup: 'Bệnh viện', destination: 'Càng Long',
      contact_name: 'CSKH', contact_phone: '0911222333', passenger_count: 2, scheduled_start: new Date(now.getTime() - 86_400_000).toISOString(),
      expected_end: new Date(now.getTime() - 82_800_000).toISOString(), started_at: new Date(now.getTime() - 86_100_000).toISOString(),
      ended_at: new Date(now.getTime() - 82_900_000).toISOString(), status: 'completed', checklist_completed: true,
      start_odometer: 76340, end_odometer: 76420, created_by: 'dispatcher-1', created_at: now.toISOString(), updated_at: now.toISOString(),
    },
  ],
  checklists: [],
  expenses: [
    {
      id: 'expense-1', trip_id: 'trip-2', vehicle_id: 'vehicle-3', driver_id: 'driver-1', type: 'fuel', amount: 550000, fuel_liters: 22, fuel_unit_price: 25000,
      description: 'Đổ xăng chuyến đón bệnh nhân', receipt_url: null, status: 'pending', expense_date: now.toISOString().slice(0, 10),
      created_at: now.toISOString(), updated_at: now.toISOString(),
    },
  ],
  incidents: [
    {
      id: 'incident-1', trip_id: null, vehicle_id: 'vehicle-2', driver_id: 'driver-1', type: 'abnormal_noise', severity: 'medium',
      description: 'Điều hòa phát tiếng kêu bất thường', status: 'handling', created_at: now.toISOString(),
    },
  ],
  maintenances: [
    {
      id: 'maintenance-1', vehicle_id: 'vehicle-2', type: 'Kiểm tra điều hòa', description: 'Kiểm tra quạt gió và máy nén',
      scheduled_date: plusDays(0), status: 'in_progress', created_at: now.toISOString(), updated_at: now.toISOString(),
    },
  ],
}

export const demoCredentials = [
  { label: 'Tài xế Nam', phone: DRIVER_DEMO_PHONE, password: '123456' },
  { label: 'Điều phối', phone: ADMIN_DEMO_PHONE, password: '123456' },
  { label: 'Kế toán', phone: ACCOUNTANT_DEMO_PHONE, password: '123456' },
  { label: 'Ban Giám đốc', phone: DIRECTOR_DEMO_PHONE, password: '123456' },
]

export const defaultTripDateTime = toDateTimeLocal(start)
