import { FunctionsFetchError, FunctionsHttpError, FunctionsRelayError } from '@supabase/supabase-js'

import type {
  AppData,
  AuthUser,
  Checklist,
  CreateTripInput,
  CreateUserInput,
  Expense,
  ExpenseReviewAction,
  Incident,
  Maintenance,
  Profile,
  Trip,
  UpdateUserInput,
  UserRole,
  Vehicle,
} from '../types/models'
import { addPending, listPending, pendingCount, removePending, updatePending, type PendingAction } from './offline'
import { supabase } from './supabase'
import { getCurrentLocation, normalizePhone, uid } from './utils'
import { optimizeCapturedImage } from './image'

const LIVE_CACHE_KEY = 'msg-car-live-cache-v1'

export interface MediaPayload {
  file?: File | null
  secondFile?: File | null
}

export interface BackendApi {
  mode: 'supabase'
  login(phone: string, password: string): Promise<AuthUser>
  logout(): Promise<void>
  session(): Promise<AuthUser | null>
  loadData(): Promise<AppData>
  createUser(input: CreateUserInput, avatarFile?: File | null): Promise<Profile>
  updateUser(input: UpdateUserInput, avatarFile?: File | null): Promise<Profile>
  updateProfile(id: string, changes: Partial<Profile>): Promise<Profile>
  subscribe(onChange: () => void): () => void
  createTrip(input: CreateTripInput, creatorId: string): Promise<Trip>
  updateTrip(id: string, changes: Partial<Trip>): Promise<Trip>
  updateTripLocation(id: string, lat: number, lng: number): Promise<Trip>
  deleteTrip(id: string): Promise<void>
  createChecklist(input: Omit<Checklist, 'id' | 'created_at'>): Promise<Checklist>
  submitOdometer(trip: Trip, phase: 'start' | 'end', odometer: number, file?: File | null): Promise<Trip>
  createExpense(input: Omit<Expense, 'id' | 'created_at' | 'updated_at' | 'receipt_url'>, file?: File | null): Promise<Expense>
  reviewExpense(id: string, action: ExpenseReviewAction, reviewerId: string, reviewerRole: UserRole, reason?: string): Promise<Expense>
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


function expenseReviewTransition(expense: Expense, action: ExpenseReviewAction, reviewerId: string, reviewerRole: UserRole, reason?: string) {
  const now = new Date().toISOString()
  const isAdmin = reviewerRole === 'admin'

  if (action === 'director_approve') {
    if (!isAdmin && reviewerRole !== 'director') throw new Error('Chỉ Ban Giám đốc được duyệt bước đầu.')
    if (expense.status !== 'pending_director') throw new Error('Chi phí không còn ở bước chờ Ban Giám đốc duyệt.')
    return {
      expectedStatus: 'pending_director' as const,
      changes: {
        status: 'pending_accountant' as const,
        director_reviewer_id: reviewerId,
        director_reviewed_at: now,
        reviewer_id: reviewerId,
        reviewed_at: now,
        rejection_reason: null,
        updated_at: now,
      },
    }
  }

  if (action === 'accountant_approve') {
    if (!isAdmin && reviewerRole !== 'accountant') throw new Error('Chỉ Kế toán được duyệt bước thanh toán.')
    if (expense.status !== 'pending_accountant') throw new Error('Chi phí chưa được Ban Giám đốc duyệt hoặc đã được xử lý.')
    return {
      expectedStatus: 'pending_accountant' as const,
      changes: {
        status: 'approved' as const,
        accountant_reviewer_id: reviewerId,
        accountant_reviewed_at: now,
        reviewer_id: reviewerId,
        reviewed_at: now,
        rejection_reason: null,
        updated_at: now,
      },
    }
  }

  if (action === 'mark_paid') {
    if (!isAdmin && reviewerRole !== 'accountant') throw new Error('Chỉ Kế toán được xác nhận chi trả.')
    if (expense.status !== 'approved') throw new Error('Chi phí chưa hoàn tất hai bước duyệt.')
    return {
      expectedStatus: 'approved' as const,
      changes: {
        status: 'paid' as const,
        paid_by: reviewerId,
        paid_at: now,
        reviewer_id: reviewerId,
        reviewed_at: now,
        updated_at: now,
      },
    }
  }

  if (!reason?.trim()) throw new Error('Cần nhập lý do từ chối.')
  const canReject = isAdmin
    || (reviewerRole === 'director' && expense.status === 'pending_director')
    || (reviewerRole === 'accountant' && expense.status === 'pending_accountant')
  if (!canReject) throw new Error('Bạn không có quyền từ chối chi phí ở bước hiện tại.')

  return {
    expectedStatus: expense.status,
    changes: {
      status: 'rejected' as const,
      reviewer_id: reviewerId,
      reviewed_at: now,
      rejection_reason: reason.trim(),
      updated_at: now,
    },
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

function phoneToE164(phone: string) {
  const digits = normalizePhone(phone).replace(/\D/g, '')
  if (digits.startsWith('84')) return `+${digits}`
  if (digits.startsWith('0')) return `+84${digits.slice(1)}`
  return `+84${digits}`
}

function phoneToInternalEmail(phone: string) {
  const e164 = phoneToE164(phone)
  return `${e164.slice(1)}@auth.bvmsgtv.internal`
}

function friendlyLoginError(message: string) {
  if (/invalid login credentials/i.test(message)) return 'Số điện thoại hoặc mật khẩu không đúng.'
  if (/email logins are disabled/i.test(message)) return 'Supabase chưa bật đăng nhập Email. Hãy bật Authentication → Providers → Email.'
  return message
}

async function friendlyFunctionError(error: unknown) {
  if (error instanceof FunctionsHttpError) {
    try {
      const payload = await error.context.clone().json() as { error?: string; message?: string }
      return payload.error ?? payload.message ?? `Edge Function trả lỗi HTTP ${error.context.status}.`
    } catch {
      return `Edge Function trả lỗi HTTP ${error.context.status}. Hãy xem Supabase → Edge Functions → manage-user → Logs.`
    }
  }
  if (error instanceof FunctionsFetchError) {
    return 'Không kết nối được Edge Function manage-user. Hãy deploy lại Edge Function manage-user và kiểm tra đúng Supabase Project.'
  }
  if (error instanceof FunctionsRelayError) {
    return `Supabase Edge Relay gặp lỗi: ${error.message}`
  }
  return error instanceof Error ? error.message : String(error)
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

async function uploadAccountAvatar(file: File, targetUserId: string) {
  const optimized = await optimizeCapturedImage(file, { maxDimension: 720, quality: 0.82, maxBytes: 650_000 })
  return await uploadMedia(optimized, `${targetUserId}/avatars`, 'profile')
}

async function removeStoredMedia(path?: string | null) {
  if (!path || path.startsWith('data:') || path.startsWith('http')) return
  const client = await requireSupabase()
  await client.storage.from('vehicle-media').remove([path])
}

async function signMedia(path?: string | null) {
  if (!path || path.startsWith('data:') || path.startsWith('http')) return path
  const client = await requireSupabase()
  const { data } = await client.storage.from('vehicle-media').createSignedUrl(path, 60 * 60)
  return data?.signedUrl ?? path
}

async function hydrateProfile(profile: Profile): Promise<Profile> {
  const avatarPath = profile.avatar_path ?? profile.avatar_url ?? null
  return {
    ...profile,
    avatar_path: avatarPath,
    avatar_url: await signMedia(avatarPath),
  }
}

async function hydrateData(data: AppData): Promise<AppData> {
  const profiles = await Promise.all(data.profiles.map(hydrateProfile))
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
  return { ...data, profiles, trips, expenses, incidents }
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
    const email = phoneToInternalEmail(phone)
    const { data, error } = await client.auth.signInWithPassword({ email, password })
    if (error) throw new Error(friendlyLoginError(error.message))
    if (!data.user) throw new Error('Không đăng nhập được.')
    const { data: profile, error: profileError } = await client.from('profiles').select('*').eq('id', data.user.id).single()
    if (profileError) throw profileError
    if (!profile.active) { await client.auth.signOut(); throw new Error('Tài khoản đã bị khóa.') }
    return { id: data.user.id, profile: await hydrateProfile(profile as Profile) }
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
    return { id: data.session.user.id, profile: await hydrateProfile(profile as Profile) }
  },
  loadData: supabaseLoadData,
  async createUser(input, avatarFile) {
    const client = await requireSupabase()
    const { data, error } = await client.functions.invoke('manage-user', {
      body: { action: 'create', ...input, avatar_url: null },
    })
    if (error) throw new Error(await friendlyFunctionError(error))
    if (data?.error) throw new Error(data.error)
    if (!data?.profile) throw new Error('Edge Function không trả về hồ sơ tài khoản mới.')

    let profile = data.profile as Profile
    if (avatarFile) {
      const avatarPath = await uploadAccountAvatar(avatarFile, profile.id)
      const updateResult = await client.functions.invoke('manage-user', {
        body: {
          action: 'update',
          id: profile.id,
          full_name: input.full_name,
          phone: input.phone,
          role: input.role,
          active: true,
          employee_code: input.employee_code,
          department: input.department,
          job_title: input.job_title,
          notes: input.notes,
          avatar_url: avatarPath,
        },
      })
      if (updateResult.error) {
        await removeStoredMedia(avatarPath)
        throw new Error(await friendlyFunctionError(updateResult.error))
      }
      if (updateResult.data?.error) {
        await removeStoredMedia(avatarPath)
        throw new Error(updateResult.data.error)
      }
      if (updateResult.data?.profile) profile = updateResult.data.profile as Profile
    }
    return await hydrateProfile(profile)
  },
  async updateUser(input, avatarFile) {
    const client = await requireSupabase()
    const oldAvatarPath = input.previous_avatar_url ?? null
    const avatarPath = avatarFile
      ? await uploadAccountAvatar(avatarFile, input.id)
      : input.avatar_url === null
        ? null
        : input.avatar_url ?? oldAvatarPath
    const { data, error } = await client.functions.invoke('manage-user', {
      body: { action: 'update', ...input, avatar_url: avatarPath },
    })
    if (error) {
      if (avatarFile) await removeStoredMedia(avatarPath)
      throw new Error(await friendlyFunctionError(error))
    }
    if (data?.error) {
      if (avatarFile) await removeStoredMedia(avatarPath)
      throw new Error(data.error)
    }
    if (!data?.profile) throw new Error('Edge Function không trả về hồ sơ đã cập nhật.')
    if (oldAvatarPath && oldAvatarPath !== avatarPath) await removeStoredMedia(oldAvatarPath)
    return await hydrateProfile(data.profile as Profile)
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
    for (const table of ['profiles', 'trips', 'vehicles', 'expenses', 'incidents', 'maintenances', 'checklists']) {
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
  async updateTripLocation(id, lat, lng) {
    const client = await requireSupabase()
    const payload = {
      current_lat: lat,
      current_lng: lng,
      location_updated_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }
    const { data, error } = await client
      .from('trips')
      .update(payload)
      .eq('id', id)
      .eq('status', 'active')
      .select()
      .single()
    if (error) throw error
    return data as Trip
  },
  async deleteTrip(id) {
    if (!navigator.onLine) throw new Error('Cần kết nối mạng để xóa chuyến đi.')
    const client = await requireSupabase()
    const { error } = await client.from('trips').delete().eq('id', id)
    if (error) throw error
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
  async reviewExpense(id, action, reviewerId, reviewerRole, reason) {
    const client = await requireSupabase()
    let current = readLiveCache()?.expenses.find((expense) => expense.id === id) ?? null
    if (navigator.onLine) {
      const { data, error } = await client.from('expenses').select('*').eq('id', id).single()
      if (error) throw error
      current = data as Expense
    }
    if (!current) throw new Error('Không tìm thấy chi phí trong dữ liệu hiện tại.')

    const transition = expenseReviewTransition(current, action, reviewerId, reviewerRole, reason)
    const optimistic = { ...current, ...transition.changes } as Expense
    return await performOrQueue('expenses.update', { id, ...transition.changes }, async () => {
      const { data, error } = await client
        .from('expenses')
        .update(transition.changes)
        .eq('id', id)
        .eq('status', transition.expectedStatus)
        .select()
        .single()
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

// Production-only mode: never fall back to sample/demo data.
// If Supabase configuration is missing, requireSupabase() returns a clear configuration error.
export const backend: BackendApi = supabaseBackend
