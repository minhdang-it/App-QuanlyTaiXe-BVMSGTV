import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { useAuth } from './AuthContext'
import { useData } from './DataContext'
import { EXPENSE_LABELS, INCIDENT_LABELS, PURPOSE_LABELS } from '../lib/constants'
import type { AppData, Expense, Incident, Maintenance, Trip, UserRole, VehicleRequest } from '../types/models'

export type NotificationKind = 'request' | 'trip' | 'incident' | 'expense' | 'maintenance' | 'system'
export type NotificationPriority = 'normal' | 'important' | 'urgent'
export type NotificationTarget = 'dashboard' | 'requests' | 'dispatch' | 'expenses' | 'incidents' | 'maintenance'

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
  refreshBrowserPermission(): NotificationPermission | 'unsupported'
}

interface EventSnapshot {
  requests: Record<string, Pick<VehicleRequest, 'id' | 'requester_id' | 'status' | 'purpose' | 'pickup' | 'destination' | 'updated_at'>>
  trips: Record<string, Pick<Trip, 'id' | 'driver_id' | 'vehicle_id' | 'status' | 'pickup' | 'destination' | 'scheduled_start' | 'updated_at' | 'created_by' | 'purpose'>>
  incidents: Record<string, Pick<Incident, 'id' | 'driver_id' | 'vehicle_id' | 'type' | 'severity' | 'status' | 'created_at' | 'resolved_at'>>
  expenses: Record<string, Pick<Expense, 'id' | 'driver_id' | 'vehicle_id' | 'type' | 'amount' | 'status' | 'created_at' | 'updated_at'>>
  maintenances: Record<string, Pick<Maintenance, 'id' | 'vehicle_id' | 'type' | 'status' | 'scheduled_date' | 'updated_at'>>
}

const NotificationContext = createContext<NotificationContextValue | null>(null)
const MAX_NOTIFICATIONS = 80

const tripStatusLabels: Record<Trip['status'], string> = {
  pending_fleet: 'Chờ Hành chính duyệt',
  pending_director: 'Chờ Ban Giám đốc duyệt',
  assigned: 'Đã giao',
  accepted: 'Đã nhận',
  ready: 'Sẵn sàng',
  active: 'Đang chạy',
  completed: 'Hoàn thành',
  cancelled: 'Đã hủy',
}

const maintenanceStatusLabels: Record<Maintenance['status'], string> = {
  pending_director: 'Chờ Ban Giám đốc duyệt',
  rejected: 'Không duyệt',
  scheduled: 'Đã lên lịch',
  in_progress: 'Đang thực hiện',
  completed: 'Hoàn thành',
  cancelled: 'Đã hủy',
}

function snapshotOf(data: AppData): EventSnapshot {
  return {
    requests: Object.fromEntries(data.vehicleRequests.map((item) => [item.id, {
      id: item.id, requester_id: item.requester_id, status: item.status, purpose: item.purpose, pickup: item.pickup, destination: item.destination, updated_at: item.updated_at,
    }])),
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
  return ['dispatcher', 'fleet', 'director', 'admin'].includes(role)
}

function roleCanSeeIncidentEvents(role: UserRole) {
  return ['dispatcher', 'fleet', 'director', 'admin'].includes(role)
}

function roleCanSeeExpenseEvents(role: UserRole) {
  return ['director', 'accountant', 'admin'].includes(role)
}

function roleCanSeeMaintenanceEvents(role: UserRole) {
  return ['dispatcher', 'fleet', 'director', 'admin'].includes(role)
}

function buildNotifications(previous: EventSnapshot, current: EventSnapshot, role: UserRole, userId: string): AppNotification[] {
  const now = new Date().toISOString()
  const results: AppNotification[] = []

  for (const request of Object.values(current.requests)) {
    const before = previous.requests?.[request.id]
    const route = `${PURPOSE_LABELS[request.purpose]} · ${request.pickup} → ${request.destination}`
    if (!before) {
      if (request.status === 'pending_fleet' && ['fleet', 'admin'].includes(role)) {
        results.push({ id: `request-new-${request.id}`, kind: 'request', priority: 'important', title: 'Có đề nghị điều hành xe mới', message: route, createdAt: now, read: false, target: 'requests' })
      }
      continue
    }
    if (before.status !== request.status) {
      if (request.requester_id === userId && role === 'department_head') {
        const title = request.status === 'fleet_approved' ? 'Hành chính đã duyệt đề nghị xe' : request.status === 'converted' ? 'Đề nghị đã được tạo thành chuyến' : request.status === 'rejected' ? 'Đề nghị xe không được duyệt' : 'Đề nghị xe đã được cập nhật'
        results.push({ id: `request-owner-${request.id}-${request.status}`, kind: 'request', priority: request.status === 'rejected' ? 'important' : 'normal', title, message: route, createdAt: now, read: false, target: 'requests' })
      }
      if (request.status === 'fleet_approved' && ['dispatcher', 'admin'].includes(role)) {
        results.push({ id: `request-dispatch-${request.id}`, kind: 'request', priority: 'important', title: 'Đề nghị xe đã được Hành chính duyệt', message: `${route} · Có thể tạo chuyến`, createdAt: now, read: false, target: 'requests' })
      }
    }
  }

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
    const amountText = `${EXPENSE_LABELS[expense.type]} · ${expense.amount.toLocaleString('vi-VN')}đ`

    if (!before && expense.status === 'pending_director' && ['director', 'admin'].includes(role) && expense.driver_id !== userId) {
      results.push({
        id: `expense-new-${expense.id}`,
        kind: 'expense',
        priority: 'important',
        title: 'Chi phí chờ Ban Giám đốc duyệt',
        message: amountText,
        createdAt: now,
        read: false,
        target: 'expenses',
      })
      continue
    }

    if (before && before.status !== expense.status) {
      if (expense.status === 'pending_accountant' && ['accountant', 'admin'].includes(role)) {
        results.push({
          id: `expense-accountant-${expense.id}`,
          kind: 'expense',
          priority: 'important',
          title: 'Chi phí đã được Ban Giám đốc duyệt',
          message: `${amountText} · Chờ Kế toán kiểm tra`,
          createdAt: now,
          read: false,
          target: 'expenses',
        })
      }

      if (role === 'driver' && expense.driver_id === userId) {
        const title = expense.status === 'pending_accountant'
          ? 'Ban Giám đốc đã duyệt chi phí'
          : expense.status === 'approved'
            ? 'Kế toán đã duyệt chi phí'
            : expense.status === 'paid'
              ? 'Chi phí đã được chi trả'
              : 'Chi phí bị từ chối'
        results.push({
          id: `expense-status-${expense.id}-${expense.status}`,
          kind: 'expense',
          priority: expense.status === 'rejected' ? 'important' : 'normal',
          title,
          message: amountText,
          createdAt: now,
          read: false,
          target: 'expenses',
        })
      }
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

  const showBrowserNotification = useCallback(async (item: AppNotification) => {
    if (!('Notification' in window) || Notification.permission !== 'granted' || !window.isSecureContext) return
    if (!document.hidden && item.priority !== 'urgent') return

    const vibrationPattern = item.priority === 'urgent' ? [300, 120, 300, 120, 500] : [220, 100, 220]
    const options = {
      body: item.message,
      icon: '/icons/icon-192.png',
      badge: '/icons/icon-192.png',
      tag: item.id,
      data: { target: item.target ?? 'dashboard' },
      requireInteraction: item.priority === 'urgent',
      vibrate: vibrationPattern,
    } as NotificationOptions & { vibrate?: number[] }

    try {
      if ('serviceWorker' in navigator) {
        const registration = await navigator.serviceWorker.ready
        await registration.showNotification(item.title, options)
      } else {
        const popup = new Notification(item.title, options)
        window.setTimeout(() => popup.close(), 10_000)
      }
      if (item.priority !== 'normal' && 'vibrate' in navigator) navigator.vibrate(vibrationPattern)
    } catch {
      try {
        const popup = new Notification(item.title, options)
        window.setTimeout(() => popup.close(), 10_000)
      } catch {
        // Trình duyệt không cho phép hiển thị thông báo ở chế độ hiện tại.
      }
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
        unique.forEach((item) => { void showBrowserNotification(item) })
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

  const refreshBrowserPermission = useCallback(() => {
    const permission = 'Notification' in window ? Notification.permission : 'unsupported' as const
    setBrowserPermission(permission)
    return permission
  }, [])

  const requestBrowserPermission = useCallback(async () => {
    if (!('Notification' in window) || !window.isSecureContext) {
      setBrowserPermission('unsupported')
      return 'unsupported' as const
    }
    try {
      const permission = await Notification.requestPermission()
      setBrowserPermission(permission)
      return permission
    } catch {
      return refreshBrowserPermission()
    }
  }, [refreshBrowserPermission])

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
    refreshBrowserPermission,
  }), [browserPermission, clearAll, dismissToast, markAllRead, markRead, notifications, refreshBrowserPermission, requestBrowserPermission, toastNotifications])

  return <NotificationContext.Provider value={value}>{children}</NotificationContext.Provider>
}

export function useNotifications() {
  const value = useContext(NotificationContext)
  if (!value) throw new Error('useNotifications must be used inside NotificationProvider')
  return value
}
