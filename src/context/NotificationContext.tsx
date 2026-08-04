import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { useAuth } from './AuthContext'
import { useData } from './DataContext'
import { EXPENSE_LABELS, INCIDENT_LABELS, PURPOSE_LABELS } from '../lib/constants'
import type { AppData, Expense, Incident, Maintenance, Trip, UserRole } from '../types/models'

export type NotificationKind = 'trip' | 'incident' | 'expense' | 'maintenance' | 'system'
export type NotificationPriority = 'normal' | 'important' | 'urgent'
export type NotificationTarget = 'dashboard' | 'dispatch' | 'expenses' | 'incidents' | 'maintenance'

export interface AppNotification {
  id: string
  kind: NotificationKind
  priority: NotificationPriority
  title: string
  message: string
  createdAt: string
  read: boolean
  target?: NotificationTarget
}

interface NotificationContextValue {
  notifications: AppNotification[]
  unreadCount: number
  toastNotifications: AppNotification[]
  browserPermission: NotificationPermission | 'unsupported'
  markRead(id: string): void
  markAllRead(): void
  clearAll(): void
  dismissToast(id: string): void
  requestBrowserPermission(): Promise<NotificationPermission | 'unsupported'>
}

interface EventSnapshot {
  trips: Record<string, Pick<Trip, 'id' | 'driver_id' | 'vehicle_id' | 'status' | 'pickup' | 'destination' | 'scheduled_start' | 'updated_at' | 'created_by' | 'purpose'>>
  incidents: Record<string, Pick<Incident, 'id' | 'driver_id' | 'vehicle_id' | 'type' | 'severity' | 'status' | 'created_at' | 'resolved_at'>>
  expenses: Record<string, Pick<Expense, 'id' | 'driver_id' | 'vehicle_id' | 'type' | 'amount' | 'status' | 'created_at' | 'updated_at'>>
  maintenances: Record<string, Pick<Maintenance, 'id' | 'vehicle_id' | 'type' | 'status' | 'scheduled_date' | 'updated_at'>>
}

const NotificationContext = createContext<NotificationContextValue | null>(null)
const MAX_NOTIFICATIONS = 80

const tripStatusLabels: Record<Trip['status'], string> = {
  assigned: 'Đã giao',
  accepted: 'Đã nhận',
  ready: 'Sẵn sàng',
  active: 'Đang chạy',
  completed: 'Hoàn thành',
  cancelled: 'Đã hủy',
}

const maintenanceStatusLabels: Record<Maintenance['status'], string> = {
  scheduled: 'Đã lên lịch',
  in_progress: 'Đang thực hiện',
  completed: 'Hoàn thành',
  cancelled: 'Đã hủy',
}

function snapshotOf(data: AppData): EventSnapshot {
  return {
    trips: Object.fromEntries(data.trips.map((item) => [item.id, {
      id: item.id,
      driver_id: item.driver_id,
      vehicle_id: item.vehicle_id,
      status: item.status,
      pickup: item.pickup,
      destination: item.destination,
      scheduled_start: item.scheduled_start,
      updated_at: item.updated_at,
      created_by: item.created_by,
      purpose: item.purpose,
    }])),
    incidents: Object.fromEntries(data.incidents.map((item) => [item.id, {
      id: item.id,
      driver_id: item.driver_id,
      vehicle_id: item.vehicle_id,
      type: item.type,
      severity: item.severity,
      status: item.status,
      created_at: item.created_at,
      resolved_at: item.resolved_at,
    }])),
    expenses: Object.fromEntries(data.expenses.map((item) => [item.id, {
      id: item.id,
      driver_id: item.driver_id,
      vehicle_id: item.vehicle_id,
      type: item.type,
      amount: item.amount,
      status: item.status,
      created_at: item.created_at,
      updated_at: item.updated_at,
    }])),
    maintenances: Object.fromEntries(data.maintenances.map((item) => [item.id, {
      id: item.id,
      vehicle_id: item.vehicle_id,
      type: item.type,
      status: item.status,
      scheduled_date: item.scheduled_date,
      updated_at: item.updated_at,
    }])),
  }
}

function roleCanSeeTripEvents(role: UserRole) {
  return ['dispatcher', 'director', 'admin'].includes(role)
}

function roleCanSeeIncidentEvents(role: UserRole) {
  return ['dispatcher', 'fleet', 'director', 'admin'].includes(role)
}

function roleCanSeeExpenseEvents(role: UserRole) {
  return ['accountant', 'admin'].includes(role)
}

function roleCanSeeMaintenanceEvents(role: UserRole) {
  return ['dispatcher', 'fleet', 'admin'].includes(role)
}

function buildNotifications(previous: EventSnapshot, current: EventSnapshot, role: UserRole, userId: string): AppNotification[] {
  const now = new Date().toISOString()
  const results: AppNotification[] = []

  for (const trip of Object.values(current.trips)) {
    const before = previous.trips[trip.id]

    if (!before) {
      if (role === 'driver' && trip.driver_id === userId) {
        results.push({
          id: `trip-new-driver-${trip.id}`,
          kind: 'trip',
          priority: 'important',
          title: 'Bạn có chuyến xe mới',
          message: `${PURPOSE_LABELS[trip.purpose]} · ${trip.pickup} → ${trip.destination}`,
          createdAt: now,
          read: false,
          target: 'dispatch',
        })
      } else if (roleCanSeeTripEvents(role) && trip.created_by !== userId) {
        results.push({
          id: `trip-new-manager-${trip.id}`,
          kind: 'trip',
          priority: 'normal',
          title: 'Có chuyến xe mới',
          message: `${PURPOSE_LABELS[trip.purpose]} · ${trip.pickup} → ${trip.destination}`,
          createdAt: now,
          read: false,
          target: 'dispatch',
        })
      }
      continue
    }

    if (role === 'driver') {
      const newlyAssigned = before.driver_id !== userId && trip.driver_id === userId
      if (newlyAssigned) {
        results.push({
          id: `trip-reassigned-${trip.id}-${trip.updated_at}`,
          kind: 'trip',
          priority: 'important',
          title: 'Bạn vừa được giao chuyến',
          message: `${trip.pickup} → ${trip.destination}`,
          createdAt: now,
          read: false,
          target: 'dispatch',
        })
      }

      if (trip.driver_id === userId) {
        const routeChanged = before.pickup !== trip.pickup || before.destination !== trip.destination || before.scheduled_start !== trip.scheduled_start || before.vehicle_id !== trip.vehicle_id
        if (routeChanged) {
          results.push({
            id: `trip-updated-${trip.id}-${trip.updated_at}`,
            kind: 'trip',
            priority: 'important',
            title: 'Chuyến đi đã được cập nhật',
            message: `${trip.pickup} → ${trip.destination}. Vui lòng kiểm tra lại thời gian và xe.`,
            createdAt: now,
            read: false,
            target: 'dispatch',
          })
        }
        if (before.status !== trip.status && trip.status === 'cancelled') {
          results.push({
            id: `trip-cancelled-${trip.id}-${trip.updated_at}`,
            kind: 'trip',
            priority: 'urgent',
            title: 'Chuyến đi đã bị hủy',
            message: `${trip.pickup} → ${trip.destination}`,
            createdAt: now,
            read: false,
            target: 'dispatch',
          })
        }
      }
    } else if (roleCanSeeTripEvents(role) && before.status !== trip.status) {
      results.push({
        id: `trip-status-${trip.id}-${trip.status}-${trip.updated_at}`,
        kind: 'trip',
        priority: trip.status === 'cancelled' ? 'important' : 'normal',
        title: `Chuyến xe: ${tripStatusLabels[trip.status]}`,
        message: `${trip.pickup} → ${trip.destination}`,
        createdAt: now,
        read: false,
        target: 'dispatch',
      })
    }
  }

  for (const incident of Object.values(current.incidents)) {
    const before = previous.incidents[incident.id]
    if (!before && roleCanSeeIncidentEvents(role)) {
      results.push({
        id: `incident-new-${incident.id}`,
        kind: 'incident',
        priority: ['high', 'critical'].includes(incident.severity) ? 'urgent' : 'important',
        title: incident.severity === 'critical' ? 'Sự cố khẩn cấp' : 'Có sự cố xe mới',
        message: `${INCIDENT_LABELS[incident.type]} · Mức độ ${incident.severity}`,
        createdAt: now,
        read: false,
        target: 'incidents',
      })
      continue
    }

    if (before && role === 'driver' && incident.driver_id === userId && before.status !== incident.status) {
      results.push({
        id: `incident-status-${incident.id}-${incident.status}`,
        kind: 'incident',
        priority: 'normal',
        title: 'Sự cố đã được cập nhật',
        message: incident.status === 'resolved' ? 'Sự cố của bạn đã được xử lý.' : 'Người phụ trách đang tiếp nhận sự cố của bạn.',
        createdAt: now,
        read: false,
        target: 'incidents',
      })
    }
  }

  for (const expense of Object.values(current.expenses)) {
    const before = previous.expenses[expense.id]
    if (!before && expense.status === 'pending' && roleCanSeeExpenseEvents(role) && expense.driver_id !== userId) {
      results.push({
        id: `expense-new-${expense.id}`,
        kind: 'expense',
        priority: 'normal',
        title: 'Có chi phí chờ duyệt',
        message: `${EXPENSE_LABELS[expense.type]} · ${expense.amount.toLocaleString('vi-VN')}đ`,
        createdAt: now,
        read: false,
        target: 'expenses',
      })
      continue
    }

    if (before && role === 'driver' && expense.driver_id === userId && before.status !== expense.status) {
      results.push({
        id: `expense-status-${expense.id}-${expense.status}`,
        kind: 'expense',
        priority: expense.status === 'rejected' ? 'important' : 'normal',
        title: expense.status === 'approved' ? 'Chi phí đã được duyệt' : expense.status === 'paid' ? 'Chi phí đã thanh toán' : 'Chi phí bị từ chối',
        message: `${EXPENSE_LABELS[expense.type]} · ${expense.amount.toLocaleString('vi-VN')}đ`,
        createdAt: now,
        read: false,
        target: 'expenses',
      })
    }
  }

  for (const maintenance of Object.values(current.maintenances)) {
    const before = previous.maintenances[maintenance.id]
    if (!before && roleCanSeeMaintenanceEvents(role)) {
      results.push({
        id: `maintenance-new-${maintenance.id}`,
        kind: 'maintenance',
        priority: 'normal',
        title: 'Có lịch bảo dưỡng mới',
        message: `${maintenance.type}${maintenance.scheduled_date ? ` · ${new Date(maintenance.scheduled_date).toLocaleDateString('vi-VN')}` : ''}`,
        createdAt: now,
        read: false,
        target: 'maintenance',
      })
    } else if (before && roleCanSeeMaintenanceEvents(role) && before.status !== maintenance.status) {
      results.push({
        id: `maintenance-status-${maintenance.id}-${maintenance.status}-${maintenance.updated_at}`,
        kind: 'maintenance',
        priority: 'normal',
        title: `Bảo dưỡng: ${maintenanceStatusLabels[maintenance.status]}`,
        message: maintenance.type,
        createdAt: now,
        read: false,
        target: 'maintenance',
      })
    }
  }

  return results
}

function loadStoredNotifications(key: string): AppNotification[] {
  try {
    const parsed = JSON.parse(localStorage.getItem(key) ?? '[]') as AppNotification[]
    return Array.isArray(parsed) ? parsed.slice(0, MAX_NOTIFICATIONS) : []
  } catch {
    return []
  }
}

function loadStoredSnapshot(key: string): EventSnapshot | null {
  try {
    const value = localStorage.getItem(key)
    return value ? JSON.parse(value) as EventSnapshot : null
  } catch {
    return null
  }
}

export function NotificationProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth()
  const { data, loading } = useData()
  const notificationKey = `msg-car-notifications:${user?.id ?? 'guest'}`
  const snapshotKey = `msg-car-event-snapshot:${user?.id ?? 'guest'}`
  const [notifications, setNotifications] = useState<AppNotification[]>(() => loadStoredNotifications(notificationKey))
  const [toastNotifications, setToastNotifications] = useState<AppNotification[]>([])
  const [browserPermission, setBrowserPermission] = useState<NotificationPermission | 'unsupported'>(() => 'Notification' in window ? Notification.permission : 'unsupported')
  const previousRef = useRef<EventSnapshot | null>(loadStoredSnapshot(snapshotKey))

  useEffect(() => {
    setNotifications(loadStoredNotifications(notificationKey))
    previousRef.current = loadStoredSnapshot(snapshotKey)
    setToastNotifications([])
  }, [notificationKey, snapshotKey])

  const persistNotifications = useCallback((next: AppNotification[]) => {
    localStorage.setItem(notificationKey, JSON.stringify(next.slice(0, MAX_NOTIFICATIONS)))
  }, [notificationKey])

  const showBrowserNotification = useCallback((item: AppNotification) => {
    if (!('Notification' in window) || Notification.permission !== 'granted') return
    if (!document.hidden && item.priority !== 'urgent') return
    try {
      const popup = new Notification(item.title, {
        body: item.message,
        icon: '/logo-bvmsgtv.png',
        badge: '/logo-bvmsgtv.png',
        tag: item.id,
      })
      window.setTimeout(() => popup.close(), 9000)
    } catch {
      // Một số trình duyệt chỉ cho hiển thị thông báo qua Service Worker.
    }
  }, [])

  useEffect(() => {
    if (!user || loading) return
    const nextSnapshot = snapshotOf(data)
    const previous = previousRef.current

    if (!previous) {
      previousRef.current = nextSnapshot
      localStorage.setItem(snapshotKey, JSON.stringify(nextSnapshot))
      return
    }

    const currentProfile = data.profiles.find((profile) => profile.id === user.id) ?? user.profile
    const generated = buildNotifications(previous, nextSnapshot, currentProfile.role, user.id)

    if (generated.length) {
      setNotifications((current) => {
        const existingIds = new Set(current.map((item) => item.id))
        const unique = generated.filter((item) => !existingIds.has(item.id))
        if (!unique.length) return current
        const next = [...unique, ...current].slice(0, MAX_NOTIFICATIONS)
        persistNotifications(next)
        setToastNotifications((toasts) => [...unique, ...toasts].slice(0, 3))
        unique.forEach(showBrowserNotification)
        return next
      })
    }

    previousRef.current = nextSnapshot
    localStorage.setItem(snapshotKey, JSON.stringify(nextSnapshot))
  }, [data, loading, persistNotifications, showBrowserNotification, snapshotKey, user])

  useEffect(() => {
    if (!toastNotifications.length) return
    const timer = window.setTimeout(() => setToastNotifications((items) => items.slice(0, -1)), 6500)
    return () => window.clearTimeout(timer)
  }, [toastNotifications])

  const markRead = useCallback((id: string) => {
    setNotifications((items) => {
      const next = items.map((item) => item.id === id ? { ...item, read: true } : item)
      persistNotifications(next)
      return next
    })
  }, [persistNotifications])

  const markAllRead = useCallback(() => {
    setNotifications((items) => {
      const next = items.map((item) => ({ ...item, read: true }))
      persistNotifications(next)
      return next
    })
  }, [persistNotifications])

  const clearAll = useCallback(() => {
    setNotifications([])
    setToastNotifications([])
    persistNotifications([])
  }, [persistNotifications])

  const dismissToast = useCallback((id: string) => {
    setToastNotifications((items) => items.filter((item) => item.id !== id))
  }, [])

  const requestBrowserPermission = useCallback(async () => {
    if (!('Notification' in window)) {
      setBrowserPermission('unsupported')
      return 'unsupported' as const
    }
    const permission = await Notification.requestPermission()
    setBrowserPermission(permission)
    return permission
  }, [])

  const value = useMemo<NotificationContextValue>(() => ({
    notifications,
    unreadCount: notifications.filter((item) => !item.read).length,
    toastNotifications,
    browserPermission,
    markRead,
    markAllRead,
    clearAll,
    dismissToast,
    requestBrowserPermission,
  }), [browserPermission, clearAll, dismissToast, markAllRead, markRead, notifications, requestBrowserPermission, toastNotifications])

  return <NotificationContext.Provider value={value}>{children}</NotificationContext.Provider>
}

export function useNotifications() {
  const value = useContext(NotificationContext)
  if (!value) throw new Error('useNotifications must be used inside NotificationProvider')
  return value
}
