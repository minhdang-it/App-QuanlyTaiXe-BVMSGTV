import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import type {
  AppData,
  Checklist,
  CreateTripInput,
  CreateUserInput,
  Expense,
  Incident,
  Maintenance,
  Trip,
  UpdateUserInput,
  Vehicle,
} from '../types/models'
import { backend, type MediaPayload } from '../lib/backend'
import { useAuth } from './AuthContext'

interface DataContextValue {
  data: AppData
  loading: boolean
  error: string | null
  online: boolean
  pending: number
  refresh(): Promise<void>
  createUser(input: CreateUserInput, avatarFile?: File | null): Promise<import('../types/models').Profile>
  updateUser(input: UpdateUserInput, avatarFile?: File | null): Promise<import('../types/models').Profile>
  updateProfile(id: string, changes: Partial<import('../types/models').Profile>): Promise<import('../types/models').Profile>
  createTrip(input: CreateTripInput): Promise<Trip>
  updateTrip(id: string, changes: Partial<Trip>): Promise<Trip>
  deleteTrip(id: string): Promise<void>
  createChecklist(input: Omit<Checklist, 'id' | 'created_at'>): Promise<Checklist>
  submitOdometer(trip: Trip, phase: 'start' | 'end', odometer: number, file?: File | null): Promise<Trip>
  createExpense(input: Omit<Expense, 'id' | 'created_at' | 'updated_at' | 'receipt_url'>, file?: File | null): Promise<Expense>
  reviewExpense(id: string, status: 'approved' | 'rejected' | 'paid', reason?: string): Promise<Expense>
  createIncident(input: Omit<Incident, 'id' | 'created_at' | 'image_url' | 'audio_url'>, media?: MediaPayload): Promise<Incident>
  updateIncident(id: string, changes: Partial<Incident>): Promise<Incident>
  createVehicle(input: Omit<Vehicle, 'id' | 'created_at' | 'updated_at'>): Promise<Vehicle>
  updateVehicle(id: string, changes: Partial<Vehicle>): Promise<Vehicle>
  createMaintenance(input: Omit<Maintenance, 'id' | 'created_at' | 'updated_at'>): Promise<Maintenance>
  updateMaintenance(id: string, changes: Partial<Maintenance>): Promise<Maintenance>
}

const emptyData: AppData = {
  profiles: [], vehicles: [], trips: [], checklists: [], expenses: [], incidents: [], maintenances: [],
}

const DataContext = createContext<DataContextValue | null>(null)

export function DataProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth()
  const [data, setData] = useState<AppData>(emptyData)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [online, setOnline] = useState(navigator.onLine)
  const [pending, setPending] = useState(0)

  const refresh = useCallback(async () => {
    if (!user) return
    try {
      setError(null)
      const [nextData, nextPending] = await Promise.all([backend.loadData(), backend.getPendingCount()])
      setData(nextData)
      setPending(nextPending)
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setLoading(false)
    }
  }, [user])

  useEffect(() => {
    if (!user) {
      setData(emptyData)
      setLoading(false)
      return
    }
    setLoading(true)
    void refresh()
    const unsubscribe = backend.subscribe(() => void refresh())
    return unsubscribe
  }, [refresh, user])

  useEffect(() => {
    const onOnline = async () => {
      setOnline(true)
      setPending(await backend.syncPending())
      await refresh()
    }
    const onOffline = () => setOnline(false)
    window.addEventListener('online', onOnline)
    window.addEventListener('offline', onOffline)
    return () => {
      window.removeEventListener('online', onOnline)
      window.removeEventListener('offline', onOffline)
    }
  }, [refresh])

  const run = useCallback(async <T,>(work: () => Promise<T>) => {
    const result = await work()
    await refresh()
    return result
  }, [refresh])

  const value = useMemo<DataContextValue>(() => ({
    data,
    loading,
    error,
    online,
    pending,
    refresh,
    createUser: (input, avatarFile) => run(() => backend.createUser(input, avatarFile)),
    updateUser: (input, avatarFile) => run(() => backend.updateUser(input, avatarFile)),
    updateProfile: (id, changes) => run(() => backend.updateProfile(id, changes)),
    createTrip: (input) => run(() => backend.createTrip(input, user!.id)),
    updateTrip: (id, changes) => run(() => backend.updateTrip(id, changes)),
    deleteTrip: (id) => run(() => backend.deleteTrip(id)),
    createChecklist: (input) => run(() => backend.createChecklist(input)),
    submitOdometer: (trip, phase, odometer, file) => run(() => backend.submitOdometer(trip, phase, odometer, file)),
    createExpense: (input, file) => run(() => backend.createExpense(input, file)),
    reviewExpense: (id, status, reason) => run(() => backend.reviewExpense(id, status, user!.id, reason)),
    createIncident: (input, media) => run(() => backend.createIncident(input, media)),
    updateIncident: (id, changes) => run(() => backend.updateIncident(id, changes)),
    createVehicle: (input) => run(() => backend.createVehicle(input)),
    updateVehicle: (id, changes) => run(() => backend.updateVehicle(id, changes)),
    createMaintenance: (input) => run(() => backend.createMaintenance(input)),
    updateMaintenance: (id, changes) => run(() => backend.updateMaintenance(id, changes)),
  }), [data, error, loading, online, pending, refresh, run, user])

  return <DataContext.Provider value={value}>{children}</DataContext.Provider>
}

export function useData() {
  const value = useContext(DataContext)
  if (!value) throw new Error('useData must be used inside DataProvider')
  return value
}
