export type UserRole = 'driver' | 'dispatcher' | 'accountant' | 'fleet' | 'director' | 'admin'

export type VehicleStatus = 'available' | 'in_use' | 'maintenance' | 'out_of_service'
export type TripStatus = 'assigned' | 'accepted' | 'ready' | 'active' | 'completed' | 'cancelled'
export type ExpenseStatus = 'pending' | 'approved' | 'rejected' | 'paid'
export type IncidentStatus = 'reported' | 'handling' | 'resolved'
export type Severity = 'low' | 'medium' | 'high' | 'critical'

export type TripPurpose =
  | 'patient_pickup'
  | 'patient_return'
  | 'community_exam'
  | 'board_business'
  | 'staff_transport'
  | 'medicine_supply'
  | 'marketing_care'
  | 'administrative'
  | 'personal_other'

export type ExpenseType = 'fuel' | 'toll' | 'parking' | 'washing' | 'repair' | 'other'
export type IncidentType = 'breakdown' | 'collision' | 'flat_tire' | 'dashboard_warning' | 'abnormal_noise' | 'other'

export interface Profile {
  id: string
  full_name: string
  phone: string
  role: UserRole
  active: boolean
  avatar_url?: string | null
  avatar_path?: string | null
  employee_code?: string | null
  department?: string | null
  job_title?: string | null
  notes?: string | null
  created_at: string
  updated_at?: string | null
}

export interface Vehicle {
  id: string
  plate_number: string
  vehicle_name: string
  vehicle_type: string
  seats: number
  status: VehicleStatus
  odometer: number
  image_url?: string | null
  regular_driver_id?: string | null
  registration_expiry?: string | null
  insurance_expiry?: string | null
  next_maintenance_date?: string | null
  next_maintenance_odometer?: number | null
  fuel_norm_l_per_100km?: number | null
  notes?: string | null
  created_at: string
  updated_at: string
}

export interface Trip {
  id: string
  vehicle_id: string
  driver_id: string
  purpose: TripPurpose
  pickup: string
  destination: string
  contact_name?: string | null
  contact_phone?: string | null
  passenger_count?: number | null
  scheduled_start: string
  expected_end?: string | null
  started_at?: string | null
  ended_at?: string | null
  status: TripStatus
  notes?: string | null
  checklist_completed: boolean
  start_odometer?: number | null
  end_odometer?: number | null
  start_odometer_image_url?: string | null
  end_odometer_image_url?: string | null
  start_lat?: number | null
  start_lng?: number | null
  end_lat?: number | null
  end_lng?: number | null
  created_by?: string | null
  created_at: string
  updated_at: string
}

export interface Checklist {
  id: string
  trip_id: string
  driver_id: string
  fuel_ok: boolean
  tires_ok: boolean
  lights_horn_ok: boolean
  vehicle_clean: boolean
  documents_ok: boolean
  notes?: string | null
  created_at: string
}

export interface Expense {
  id: string
  trip_id?: string | null
  vehicle_id: string
  driver_id: string
  type: ExpenseType
  amount: number
  fuel_liters?: number | null
  fuel_unit_price?: number | null
  description?: string | null
  receipt_url?: string | null
  status: ExpenseStatus
  reviewer_id?: string | null
  reviewed_at?: string | null
  rejection_reason?: string | null
  expense_date: string
  created_at: string
  updated_at: string
}

export interface Incident {
  id: string
  trip_id?: string | null
  vehicle_id: string
  driver_id: string
  type: IncidentType
  severity: Severity
  description?: string | null
  image_url?: string | null
  audio_url?: string | null
  lat?: number | null
  lng?: number | null
  status: IncidentStatus
  handler_id?: string | null
  resolution?: string | null
  created_at: string
  resolved_at?: string | null
}

export interface Maintenance {
  id: string
  vehicle_id: string
  type: string
  description?: string | null
  scheduled_date?: string | null
  completed_date?: string | null
  odometer?: number | null
  cost?: number | null
  vendor?: string | null
  status: 'scheduled' | 'in_progress' | 'completed' | 'cancelled'
  created_at: string
  updated_at: string
}

export interface AppData {
  profiles: Profile[]
  vehicles: Vehicle[]
  trips: Trip[]
  checklists: Checklist[]
  expenses: Expense[]
  incidents: Incident[]
  maintenances: Maintenance[]
}

export interface AuthUser {
  id: string
  profile: Profile
}


export interface CreateUserInput {
  full_name: string
  phone: string
  password: string
  role: UserRole
  employee_code?: string
  department?: string
  job_title?: string
  notes?: string
}

export interface UpdateUserInput {
  id: string
  full_name: string
  phone: string
  role: UserRole
  active: boolean
  employee_code?: string
  department?: string
  job_title?: string
  notes?: string
  password?: string
  avatar_url?: string | null
  previous_avatar_url?: string | null
}

export interface CreateTripInput {
  vehicle_id: string
  driver_id: string
  purpose: TripPurpose
  pickup: string
  destination: string
  contact_name?: string
  contact_phone?: string
  passenger_count?: number
  scheduled_start: string
  expected_end?: string
  notes?: string
}
