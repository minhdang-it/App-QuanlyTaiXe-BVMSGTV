import type {
  AppData,
  AuthUser,
  Checklist,
  CreateTripInput,
  CreateUserInput,
  Expense,
  Incident,
  Maintenance,
  Profile,
  Trip,
  Vehicle,
} from '../types/models'
import { demoData } from './demoData'
import { addPending, listPending, loadMediaBlob, pendingCount, removePending, saveMediaBlob, updatePending, type PendingAction } from './offline'
import { isSupabaseConfigured, supabase } from './supabase'
import { fileToDataUrl, getCurrentLocation, normalizePhone, uid } from './utils'

const DEMO_DATA_KEY = 'msg-car-demo-data-v1'
const DEMO_SESSION_KEY = 'msg-car-demo-session-v1'
const LIVE_CACHE_KEY = 'msg-car-live-cache-v1'

export interface MediaPayload {
  file?: File | null
  secondFile?: File | null
}

export interface BackendApi {
  mode: 'demo' | 'supabase'
  login(phone: string, password: string): Promise<AuthUser>
  logout(): Promise<void>
  session(): Promise<AuthUser | null>
  loadData(): Promise<AppData>
  createUser(input: CreateUserInput): Promise<Profile>
  updateProfile(id: string, changes: Partial<Profile>): Promise<Profile>
  subscribe(onChange: () => void): () => void
  createTrip(input: CreateTripInput, creatorId: string): Promise<Trip>
  updateTrip(id: string, changes: Partial<Trip>): Promise<Trip>
  createChecklist(input: Omit<Checklist, 'id' | 'created_at'>): Promise<Checklist>
  submitOdometer(trip: Trip, phase: 'start' | 'end', odometer: number, file?: File | null): Promise<Trip>
  createExpense(input: Omit<Expense, 'id' | 'created_at' | 'updated_at' | 'receipt_url'>, file?: File | null): Promise<Expense>
  reviewExpense(id: string, status: 'approved' | 'rejected' | 'paid', reviewerId: string, reason?: string): Promise<Expense>
  createIncident(input: Omit<Incident, 'id' | 'created_at' | 'image_url' | 'audio_url'>, media?: MediaPayload): Promise<Incident>
  updateIncident(id: string, changes: Partial<Incident>): Promise<Incident>
  createVehicle(input: Omit<Vehicle, 'id' | 'created_at' | 'updated_at'>): Promise<Vehicle>
  updateVehicle(id: string, changes: Partial<Vehicle>): Promise<Vehicle>
  createMaintenance(input: Omit<Maintenance, 'id' | 'created_at' | 'updated_at'>): Promise<Maintenance>
  updateMaintenance(id: string, changes: Partial<Maintenance>): Promise<Maintenance>
  syncPending(): Promise<number>
  getPendingCount(): Promise<number>
}


function readLiveCache(): AppData | null {
  const raw = localStorage.getItem(LIVE_CACHE_KEY)
  if (!raw) return null
  try { return JSON.parse(raw) as AppData } catch { return null }
}

function writeLiveCache(data: AppData) {
  try { localStorage.setItem(LIVE_CACHE_KEY, JSON.stringify(data)) } catch {
    // Local storage may be full if the browser has a very small quota.
  }
}

function applyOptimisticToLiveCache(operation: string, optimistic: unknown) {
  const cache = readLiveCache()
  if (!cache || !optimistic || typeof optimistic !== 'object') return
  const tableMap: Record<string, keyof AppData> = {
    'expense.create': 'expenses',
    'incident.create': 'incidents',
    'odometer.update': 'trips',
  }
  const tableName = operation.split('.')[0]
  const key = tableMap[operation] ?? (tableName in cache ? tableName as keyof AppData : null)
  if (!key) return
  const record = optimistic as { id?: string }
  if (!record.id) return
  const items = cache[key] as unknown as Array<Record<string, unknown>>
  const index = items.findIndex((item) => item.id === record.id)
  if (index >= 0) items[index] = { ...items[index], ...record }
  else items.unshift(record as Record<string, unknown>)
  writeLiveCache(cache)
}

function readDemoData(): AppData {
  const raw = localStorage.getItem(DEMO_DATA_KEY)
  if (!raw) {
    localStorage.setItem(DEMO_DATA_KEY, JSON.stringify(demoData))
    return structuredClone(demoData)
  }
  try {
    return JSON.parse(raw) as AppData
  } catch {
    localStorage.setItem(DEMO_DATA_KEY, JSON.stringify(demoData))
    return structuredClone(demoData)
  }
}

function writeDemoData(data: AppData) {
  localStorage.setItem(DEMO_DATA_KEY, JSON.stringify(data))
  window.dispatchEvent(new CustomEvent('msg-car-demo-change'))
}

function demoUpdate<K extends keyof AppData>(key: K, updater: (items: AppData[K]) => AppData[K]) {
  const data = readDemoData()
  data[key] = updater(data[key])
  writeDemoData(data)
  return data
}

function phoneToE164(phone: string) {
  const normalized = normalizePhone(phone)
  if (normalized.startsWith('0')) return `+84${normalized.slice(1)}`
  return normalized.startsWith('+') ? normalized : `+${normalized}`
}

async function mediaToDemo(file?: File | null) {
  if (!file) return null
  const key = uid('demo-media')
  await saveMediaBlob(key, file)
  return `idb-media:${key}`
}

async function resolveDemoMedia(path?: string | null) {
  if (!path?.startsWith('idb-media:')) return path ?? null
  const blob = await loadMediaBlob(path.slice('idb-media:'.length))
  return blob ? await fileToDataUrl(blob) : null
}

async function hydrateDemoData(data: AppData): Promise<AppData> {
  const trips = await Promise.all(data.trips.map(async (trip) => ({
    ...trip,
    start_odometer_image_url: await resolveDemoMedia(trip.start_odometer_image_url),
    end_odometer_image_url: await resolveDemoMedia(trip.end_odometer_image_url),
  })))
  const expenses = await Promise.all(data.expenses.map(async (expense) => ({ ...expense, receipt_url: await resolveDemoMedia(expense.receipt_url) })))
  const incidents = await Promise.all(data.incidents.map(async (incident) => ({
    ...incident,
    image_url: await resolveDemoMedia(incident.image_url),
    audio_url: await resolveDemoMedia(incident.audio_url),
  })))
  return { ...data, trips, expenses, incidents }
}

const demoBackend: BackendApi = {
  mode: 'demo',
  async login(phone, password) {
    if (password !== '123456') throw new Error('Mật khẩu demo là 123456.')
    const profile = readDemoData().profiles.find((item) => normalizePhone(item.phone) === normalizePhone(phone) && item.active)
    if (!profile) throw new Error('Không tìm thấy tài khoản demo.')
    const user = { id: profile.id, profile }
    localStorage.setItem(DEMO_SESSION_KEY, JSON.stringify(user))
    return user
  },
  async logout() {
    localStorage.removeItem(DEMO_SESSION_KEY)
  },
  async session() {
    const raw = localStorage.getItem(DEMO_SESSION_KEY)
    return raw ? (JSON.parse(raw) as AuthUser) : null
  },
  async loadData() {
    return await hydrateDemoData(readDemoData())
  },
  async createUser(input) {
    const record: Profile = { id: uid('profile'), full_name: input.full_name, phone: input.phone, role: input.role, active: true, created_at: new Date().toISOString() }
    demoUpdate('profiles', (items) => [record, ...items])
    return record
  },
  async updateProfile(id, changes) {
    let record: Profile | undefined
    demoUpdate('profiles', (items) => items.map((item) => {
      if (item.id !== id) return item
      record = { ...item, ...changes }
      return record
    }))
    if (!record) throw new Error('Không tìm thấy tài khoản.')
    return record
  },
  subscribe(onChange) {
    const custom = () => onChange()
    const storage = (event: StorageEvent) => {
      if (event.key === DEMO_DATA_KEY) onChange()
    }
    window.addEventListener('msg-car-demo-change', custom)
    window.addEventListener('storage', storage)
    return () => {
      window.removeEventListener('msg-car-demo-change', custom)
      window.removeEventListener('storage', storage)
    }
  },
  async createTrip(input, creatorId) {
    const now = new Date().toISOString()
    const trip: Trip = {
      ...input,
      id: uid('trip'),
      status: 'assigned',
      checklist_completed: false,
      created_by: creatorId,
      created_at: now,
      updated_at: now,
    }
    demoUpdate('trips', (items) => [trip, ...items])
    return trip
  },
  async updateTrip(id, changes) {
    let updated: Trip | undefined
    demoUpdate('trips', (items) => items.map((item) => {
      if (item.id !== id) return item
      updated = { ...item, ...changes, updated_at: new Date().toISOString() }
      return updated
    }))
    if (!updated) throw new Error('Không tìm thấy chuyến xe.')
    if (changes.status === 'active') {
      demoUpdate('vehicles', (items) => items.map((v) => v.id === updated?.vehicle_id ? { ...v, status: 'in_use' as const, updated_at: new Date().toISOString() } : v))
    }
    if (changes.status === 'completed') {
      demoUpdate('vehicles', (items) => items.map((v) => v.id === updated?.vehicle_id ? { ...v, status: 'available' as const, odometer: updated?.end_odometer ?? v.odometer, updated_at: new Date().toISOString() } : v))
    }
    return updated
  },
  async createChecklist(input) {
    const record: Checklist = { ...input, id: uid('checklist'), created_at: new Date().toISOString() }
    demoUpdate('checklists', (items) => [record, ...items])
    const allOk = input.fuel_ok && input.tires_ok && input.lights_horn_ok && input.vehicle_clean && input.documents_ok
    await this.updateTrip(input.trip_id, { checklist_completed: true, status: allOk ? 'ready' : 'accepted' })
    return record
  },
  async submitOdometer(trip, phase, odometer, file) {
    const location = await getCurrentLocation()
    const image = await mediaToDemo(file)
    const changes: Partial<Trip> = phase === 'start'
      ? { start_odometer: odometer, start_odometer_image_url: image, start_lat: location?.lat, start_lng: location?.lng }
      : { end_odometer: odometer, end_odometer_image_url: image, end_lat: location?.lat, end_lng: location?.lng }
    return await this.updateTrip(trip.id, changes)
  },
  async createExpense(input, file) {
    const now = new Date().toISOString()
    const record: Expense = { ...input, id: uid('expense'), receipt_url: await mediaToDemo(file), created_at: now, updated_at: now }
    demoUpdate('expenses', (items) => [record, ...items])
    return record
  },
  async reviewExpense(id, status, reviewerId, reason) {
    let record: Expense | undefined
    demoUpdate('expenses', (items) => items.map((item) => {
      if (item.id !== id) return item
      record = { ...item, status, reviewer_id: reviewerId, reviewed_at: new Date().toISOString(), rejection_reason: reason, updated_at: new Date().toISOString() }
      return record
    }))
    if (!record) throw new Error('Không tìm thấy chi phí.')
    return record
  },
  async createIncident(input, media) {
    const location = await getCurrentLocation()
    const record: Incident = {
      ...input,
      id: uid('incident'),
      image_url: await mediaToDemo(media?.file),
      audio_url: await mediaToDemo(media?.secondFile),
      lat: input.lat ?? location?.lat,
      lng: input.lng ?? location?.lng,
      created_at: new Date().toISOString(),
    }
    demoUpdate('incidents', (items) => [record, ...items])
    if (record.severity === 'critical' || record.severity === 'high') {
      demoUpdate('vehicles', (items) => items.map((v) => v.id === record.vehicle_id ? { ...v, status: 'maintenance' as const, updated_at: new Date().toISOString() } : v))
    }
    return record
  },
  async updateIncident(id, changes) {
    let record: Incident | undefined
    demoUpdate('incidents', (items) => items.map((item) => {
      if (item.id !== id) return item
      record = { ...item, ...changes }
      return record
    }))
    if (!record) throw new Error('Không tìm thấy sự cố.')
    return record
  },
  async createVehicle(input) {
    const now = new Date().toISOString()
    const record: Vehicle = { ...input, id: uid('vehicle'), created_at: now, updated_at: now }
    demoUpdate('vehicles', (items) => [record, ...items])
    return record
  },
  async updateVehicle(id, changes) {
    let record: Vehicle | undefined
    demoUpdate('vehicles', (items) => items.map((item) => {
      if (item.id !== id) return item
      record = { ...item, ...changes, updated_at: new Date().toISOString() }
      return record
    }))
    if (!record) throw new Error('Không tìm thấy xe.')
    return record
  },
  async createMaintenance(input) {
    const now = new Date().toISOString()
    const record: Maintenance = { ...input, id: uid('maintenance'), created_at: now, updated_at: now }
    demoUpdate('maintenances', (items) => [record, ...items])
    if (input.status === 'in_progress') await this.updateVehicle(input.vehicle_id, { status: 'maintenance' })
    return record
  },
  async updateMaintenance(id, changes) {
    let record: Maintenance | undefined
    demoUpdate('maintenances', (items) => items.map((item) => {
      if (item.id !== id) return item
      record = { ...item, ...changes, updated_at: new Date().toISOString() }
      return record
    }))
    if (!record) throw new Error('Không tìm thấy lịch bảo dưỡng.')
    if (record.status === 'completed') await this.updateVehicle(record.vehicle_id, { status: 'available' })
    return record
  },
  async syncPending() { return 0 },
  async getPendingCount() { return 0 },
}

async function requireSupabase() {
  if (!supabase) throw new Error('Supabase chưa được cấu hình.')
  return supabase
}

async function uploadMedia(file: Blob, folder: string, fileKey?: string) {
  const client = await requireSupabase()
  const mime = file.type.split(';')[0] || 'application/octet-stream'
  const rawExt = mime.split('/')[1] || 'bin'
  const ext = rawExt.replace('jpeg', 'jpg').replace('mpeg', 'mp3').replace('mp4', 'm4a')
  const basename = fileKey ?? `${Date.now()}-${uid('media')}`
  const path = `${folder}/${basename}.${ext}`
  const { error } = await client.storage.from('vehicle-media').upload(path, file, { contentType: mime, upsert: Boolean(fileKey) })
  if (error) {
    const message = error.message || String(error)
    if (/bucket.*not found|not found.*bucket/i.test(message)) throw new Error('Chưa có kho ảnh vehicle-media. Quản trị cần chạy lại supabase/schema.sql.')
    if (/row-level security|policy|not authorized|permission/i.test(message)) throw new Error('Tài khoản không có quyền tải ảnh. Kiểm tra Storage Policy và tài khoản tài xế.')
    if (/too large|maximum|payload|size/i.test(message)) throw new Error('Ảnh vượt dung lượng cho phép. Vui lòng chụp lại ở độ phân giải thấp hơn.')
    throw new Error(`Không tải được ảnh: ${message}`)
  }
  return path
}

async function signMedia(path?: string | null) {
  if (!path || path.startsWith('data:') || path.startsWith('http')) return path
  const client = await requireSupabase()
  const { data } = await client.storage.from('vehicle-media').createSignedUrl(path, 60 * 60)
  return data?.signedUrl ?? path
}

async function hydrateData(data: AppData): Promise<AppData> {
  const trips = await Promise.all(data.trips.map(async (trip) => ({
    ...trip,
    start_odometer_image_url: await signMedia(trip.start_odometer_image_url),
    end_odometer_image_url: await signMedia(trip.end_odometer_image_url),
  })))
  const expenses = await Promise.all(data.expenses.map(async (expense) => ({ ...expense, receipt_url: await signMedia(expense.receipt_url) })))
  const incidents = await Promise.all(data.incidents.map(async (incident) => ({
    ...incident,
    image_url: await signMedia(incident.image_url),
    audio_url: await signMedia(incident.audio_url),
  })))
  return { ...data, trips, expenses, incidents }
}

async function supabaseLoadData(): Promise<AppData> {
  const cache = readLiveCache()
  if (!navigator.onLine && cache) return cache
  try {
    const client = await requireSupabase()
    const tables = ['profiles', 'vehicles', 'trips', 'checklists', 'expenses', 'incidents', 'maintenances'] as const
    const results = await Promise.all(tables.map((table) => client.from(table).select('*').order('created_at', { ascending: false })))
    results.forEach((result) => { if (result.error) throw result.error })
    const hydrated = await hydrateData({
      profiles: (results[0].data ?? []) as Profile[],
      vehicles: (results[1].data ?? []) as Vehicle[],
      trips: (results[2].data ?? []) as Trip[],
      checklists: (results[3].data ?? []) as Checklist[],
      expenses: (results[4].data ?? []) as Expense[],
      incidents: (results[5].data ?? []) as Incident[],
      maintenances: (results[6].data ?? []) as Maintenance[],
    })
    writeLiveCache(hydrated)
    return hydrated
  } catch (error) {
    if (cache) return cache
    throw error
  }
}

async function queue(operation: string, payload: Record<string, unknown>, file?: Blob | null, secondFile?: Blob | null) {
  const action: PendingAction = { id: uid('pending'), operation, payload, file, secondFile, createdAt: new Date().toISOString(), attempts: 0 }
  await addPending(action)
}

async function executeAction(action: PendingAction) {
  const client = await requireSupabase()
  const payload = { ...action.payload }
  if (action.operation === 'expense.create') {
    const recordId = String(payload.id)
    if (action.file) payload.receipt_url = await uploadMedia(action.file, `${payload.driver_id}/receipts`, `expense-${recordId}`)
    const { error } = await client.from('expenses').upsert(payload, { onConflict: 'id', ignoreDuplicates: true })
    if (error) throw error
    return
  }
  if (action.operation === 'incident.create') {
    const recordId = String(payload.id)
    if (action.file) payload.image_url = await uploadMedia(action.file, `${payload.driver_id}/incidents`, `incident-${recordId}`)
    if (action.secondFile) payload.audio_url = await uploadMedia(action.secondFile, `${payload.driver_id}/incident-audio`, `incident-audio-${recordId}`)
    const { error } = await client.from('incidents').upsert(payload, { onConflict: 'id', ignoreDuplicates: true })
    if (error) throw error
    return
  }
  if (action.operation === 'odometer.update') {
    const phase = String(payload.phase)
    const field = phase === 'start' ? 'start_odometer_image_url' : 'end_odometer_image_url'
    const tripId = String(payload.trip_id)
    if (action.file) payload[field] = await uploadMedia(action.file, `${payload.driver_id}/odometer`, `${tripId}-${phase}`)
    delete payload.phase
    delete payload.driver_id
    delete payload.trip_id
    const { error } = await client.from('trips').update(payload).eq('id', tripId)
    if (error) throw error
    return
  }
  const [table, method] = action.operation.split('.')
  const id = payload.id ? String(payload.id) : null
  if (method === 'insert') {
    const { error } = await client.from(table).upsert(payload, { onConflict: 'id', ignoreDuplicates: true })
    if (error) throw error
  } else if (method === 'update' && id) {
    delete payload.id
    const { error } = await client.from(table).update(payload).eq('id', id)
    if (error) throw error
  }
}

async function performOrQueue<T>(operation: string, payload: Record<string, unknown>, work: () => Promise<T>, optimistic: T, file?: Blob | null, secondFile?: Blob | null) {
  if (!navigator.onLine) {
    await queue(operation, payload, file, secondFile)
    applyOptimisticToLiveCache(operation, optimistic)
    return optimistic
  }
  try {
    return await work()
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    if (/fetch|network|offline|failed to fetch/i.test(message)) {
      await queue(operation, payload, file, secondFile)
      applyOptimisticToLiveCache(operation, optimistic)
      return optimistic
    }
    throw error
  }
}

const supabaseBackend: BackendApi = {
  mode: 'supabase',
  async login(phone, password) {
    const client = await requireSupabase()
    const { data, error } = await client.auth.signInWithPassword({ phone: phoneToE164(phone), password })
    if (error) throw error
    if (!data.user) throw new Error('Không đăng nhập được.')
    const { data: profile, error: profileError } = await client.from('profiles').select('*').eq('id', data.user.id).single()
    if (profileError) throw profileError
    if (!profile.active) { await client.auth.signOut(); throw new Error('Tài khoản đã bị khóa.') }
    return { id: data.user.id, profile: profile as Profile }
  },
  async logout() {
    const client = await requireSupabase()
    await client.auth.signOut()
  },
  async session() {
    const client = await requireSupabase()
    const { data } = await client.auth.getSession()
    if (!data.session?.user) return null
    const { data: profile } = await client.from('profiles').select('*').eq('id', data.session.user.id).maybeSingle()
    if (!profile || !profile.active) { await client.auth.signOut(); return null }
    return { id: data.session.user.id, profile: profile as Profile }
  },
  loadData: supabaseLoadData,
  async createUser(input) {
    const client = await requireSupabase()
    const { data, error } = await client.functions.invoke('manage-user', { body: { action: 'create', ...input } })
    if (error) throw error
    if (data?.error) throw new Error(data.error)
    return data.profile as Profile
  },
  async updateProfile(id, changes) {
    const client = await requireSupabase()
    const { data, error } = await client.from('profiles').update(changes).eq('id', id).select().single()
    if (error) throw error
    return data as Profile
  },
  subscribe(onChange) {
    const client = supabase
    if (!client) return () => undefined

    const channel = client.channel('msg-car-changes')
    for (const table of ['trips', 'vehicles', 'expenses', 'incidents', 'maintenances', 'checklists']) {
      channel.on('postgres_changes', { event: '*', schema: 'public', table }, onChange)
    }
    channel.subscribe()

    return () => {
      void client.removeChannel(channel)
    }
  },
  async createTrip(input, creatorId) {
    const client = await requireSupabase()
    const now = new Date().toISOString()
    const id = uid('trip')
    const optimistic: Trip = { ...input, id, status: 'assigned', checklist_completed: false, created_by: creatorId, created_at: now, updated_at: now }
    const payload = { ...input, id, created_by: creatorId, status: 'assigned', checklist_completed: false }
    return await performOrQueue('trips.insert', payload, async () => {
      const { data, error } = await client.from('trips').insert(payload).select().single()
      if (error) throw error
      return data as Trip
    }, optimistic)
  },
  async updateTrip(id, changes) {
    const client = await requireSupabase()
    const payload = { ...changes, updated_at: new Date().toISOString() }
    const optimistic = { id, ...payload } as Trip
    return await performOrQueue('trips.update', { id, ...payload }, async () => {
      const { data, error } = await client.from('trips').update(payload).eq('id', id).select().single()
      if (error) throw error
      return data as Trip
    }, optimistic)
  },
  async createChecklist(input) {
    const client = await requireSupabase()
    const id = uid('checklist')
    const payload = { ...input, id }
    const record: Checklist = { ...input, id, created_at: new Date().toISOString() }
    const result = await performOrQueue('checklists.insert', payload, async () => {
      const { data, error } = await client.from('checklists').insert(payload).select().single()
      if (error) throw error
      return data as Checklist
    }, record)
    const allOk = input.fuel_ok && input.tires_ok && input.lights_horn_ok && input.vehicle_clean && input.documents_ok
    await this.updateTrip(input.trip_id, { checklist_completed: true, status: allOk ? 'ready' : 'accepted' })
    return result
  },
  async submitOdometer(trip, phase, odometer, file) {
    const client = await requireSupabase()
    const location = await getCurrentLocation()
    const changes: Record<string, unknown> = phase === 'start'
      ? { start_odometer: odometer, start_lat: location?.lat, start_lng: location?.lng }
      : { end_odometer: odometer, end_lat: location?.lat, end_lng: location?.lng }
    const optimistic = { ...trip, ...changes, updated_at: new Date().toISOString() } as Trip
    const queuePayload = { trip_id: trip.id, driver_id: trip.driver_id, phase, ...changes }
    return await performOrQueue('odometer.update', queuePayload, async () => {
      if (file) changes[phase === 'start' ? 'start_odometer_image_url' : 'end_odometer_image_url'] = await uploadMedia(file, `${trip.driver_id}/odometer`, `${trip.id}-${phase}`)
      const { data, error } = await client.from('trips').update(changes).eq('id', trip.id).select().single()
      if (error) throw error
      return data as Trip
    }, optimistic, file)
  },
  async createExpense(input, file) {
    const client = await requireSupabase()
    const now = new Date().toISOString()
    const id = uid('local-expense')
    const optimistic: Expense = { ...input, id, receipt_url: null, created_at: now, updated_at: now }
    const payload: Record<string, unknown> = { ...input, id }
    return await performOrQueue('expense.create', payload, async () => {
      if (file) payload.receipt_url = await uploadMedia(file, `${input.driver_id}/receipts`, `expense-${id}`)
      const { data, error } = await client.from('expenses').insert(payload).select().single()
      if (error) throw error
      return data as Expense
    }, optimistic, file)
  },
  async reviewExpense(id, status, reviewerId, reason) {
    const client = await requireSupabase()
    const changes = { status, reviewer_id: reviewerId, reviewed_at: new Date().toISOString(), rejection_reason: reason ?? null, updated_at: new Date().toISOString() }
    const optimistic = { id, ...changes } as Expense
    return await performOrQueue('expenses.update', { id, ...changes }, async () => {
      const { data, error } = await client.from('expenses').update(changes).eq('id', id).select().single()
      if (error) throw error
      return data as Expense
    }, optimistic)
  },
  async createIncident(input, media) {
    const client = await requireSupabase()
    const location = await getCurrentLocation()
    const id = uid('incident')
    const payload: Record<string, unknown> = { ...input, id, lat: input.lat ?? location?.lat, lng: input.lng ?? location?.lng }
    const now = new Date().toISOString()
    const optimistic: Incident = {
      ...input,
      id,
      image_url: null,
      audio_url: null,
      lat: Number(payload.lat) || null,
      lng: Number(payload.lng) || null,
      created_at: now,
    }
    return await performOrQueue('incident.create', payload, async () => {
      if (media?.file) payload.image_url = await uploadMedia(media.file, `${input.driver_id}/incidents`, `incident-${id}`)
      if (media?.secondFile) payload.audio_url = await uploadMedia(media.secondFile, `${input.driver_id}/incident-audio`, `incident-audio-${id}`)
      const { data, error } = await client.from('incidents').insert(payload).select().single()
      if (error) throw error
      return data as Incident
    }, optimistic, media?.file, media?.secondFile)
  },
  async updateIncident(id, changes) {
    const client = await requireSupabase()
    const optimistic = { id, ...changes } as Incident
    return await performOrQueue('incidents.update', { id, ...changes }, async () => {
      const { data, error } = await client.from('incidents').update(changes).eq('id', id).select().single()
      if (error) throw error
      return data as Incident
    }, optimistic)
  },
  async createVehicle(input) {
    const client = await requireSupabase()
    const now = new Date().toISOString()
    const id = uid('vehicle')
    const payload = { ...input, id }
    const optimistic: Vehicle = { ...input, id, created_at: now, updated_at: now }
    return await performOrQueue('vehicles.insert', payload, async () => {
      const { data, error } = await client.from('vehicles').insert(payload).select().single()
      if (error) throw error
      return data as Vehicle
    }, optimistic)
  },
  async updateVehicle(id, changes) {
    const client = await requireSupabase()
    const payload = { ...changes, updated_at: new Date().toISOString() }
    const optimistic = { id, ...payload } as Vehicle
    return await performOrQueue('vehicles.update', { id, ...payload }, async () => {
      const { data, error } = await client.from('vehicles').update(payload).eq('id', id).select().single()
      if (error) throw error
      return data as Vehicle
    }, optimistic)
  },
  async createMaintenance(input) {
    const client = await requireSupabase()
    const now = new Date().toISOString()
    const id = uid('maintenance')
    const payload = { ...input, id }
    const optimistic: Maintenance = { ...input, id, created_at: now, updated_at: now }
    return await performOrQueue('maintenances.insert', payload, async () => {
      const { data, error } = await client.from('maintenances').insert(payload).select().single()
      if (error) throw error
      return data as Maintenance
    }, optimistic)
  },
  async updateMaintenance(id, changes) {
    const client = await requireSupabase()
    const payload = { ...changes, updated_at: new Date().toISOString() }
    const optimistic = { id, ...payload } as Maintenance
    return await performOrQueue('maintenances.update', { id, ...payload }, async () => {
      const { data, error } = await client.from('maintenances').update(payload).eq('id', id).select().single()
      if (error) throw error
      return data as Maintenance
    }, optimistic)
  },
  async syncPending() {
    if (!navigator.onLine) return await pendingCount()
    const actions = (await listPending()).sort((a, b) => a.createdAt.localeCompare(b.createdAt))
    for (const action of actions) {
      try {
        await executeAction(action)
        await removePending(action.id)
      } catch {
        await updatePending({ ...action, attempts: action.attempts + 1 })
      }
    }
    return await pendingCount()
  },
  async getPendingCount() { return await pendingCount() },
}

export const backend: BackendApi = isSupabaseConfigured ? supabaseBackend : demoBackend
