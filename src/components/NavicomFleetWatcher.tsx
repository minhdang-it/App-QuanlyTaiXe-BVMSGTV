import { useEffect, useMemo } from 'react'
import { useAuth } from '../context/AuthContext'
import { useData } from '../context/DataContext'
import { useNotifications } from '../context/NotificationContext'
import { fetchNavicomVehicleState } from '../lib/navicom'
import { buildNavicomFleetEvent, classifyNavicomState, storeNavicomEvent, type FleetStatus } from '../lib/navicomFleet'

const WATCH_INTERVAL_MS = 10_000
const ALLOWED_ROLES = ['director', 'fleet', 'dispatcher', 'admin']

export function NavicomFleetWatcher() {
  const { user } = useAuth()
  const { data } = useData()
  const { pushNotification } = useNotifications()
  const role = data.profiles.find((profile) => profile.id === user?.id)?.role ?? user?.profile.role
  const vehicles = useMemo(() => data.vehicles.filter((vehicle) => vehicle.navicom_enabled && vehicle.navicom_device_id?.trim()), [data.vehicles])

  useEffect(() => {
    if (!user || !role || !ALLOWED_ROLES.includes(role) || !vehicles.length) return
    const statusKey = `bvmsgtv-navicom-status:${user.id}`
    let stopped = false
    let timer = 0

    const loadStatuses = () => {
      try { return JSON.parse(localStorage.getItem(statusKey) ?? '{}') as Record<string, FleetStatus> } catch { return {} }
    }
    const saveStatuses = (statuses: Record<string, FleetStatus>) => {
      try { localStorage.setItem(statusKey, JSON.stringify(statuses)) } catch { /* ignore */ }
    }

    async function watch() {
      const previous = loadStatuses()
      const nextStatuses = { ...previous }
      const results = await Promise.all(vehicles.map(async (vehicle) => {
        try {
          const state = await fetchNavicomVehicleState(vehicle.navicom_device_id!.trim(), 2)
          return { vehicle, state, status: classifyNavicomState(state) }
        } catch {
          // Lỗi Gateway/mạng không đồng nghĩa xe mất tín hiệu. Giữ trạng thái trước đó để tránh cảnh báo giả.
          return { vehicle, state: null, status: previous[vehicle.id] ?? 'unknown' as FleetStatus }
        }
      }))
      if (stopped) return

      for (const result of results) {
        const before = previous[result.vehicle.id]
        nextStatuses[result.vehicle.id] = result.status
        if (!before || before === result.status) continue
        const event = buildNavicomFleetEvent(result.vehicle, before, result.status, result.state)
        if (!event) continue
        storeNavicomEvent(event)
        pushNotification({
          id: event.id,
          kind: 'system',
          priority: event.type === 'offline' ? 'urgent' : event.type === 'online' ? 'important' : 'normal',
          title: event.title,
          message: event.detail,
          createdAt: event.createdAt,
          read: false,
          target: 'tracking',
          recordId: result.vehicle.id,
        })
      }
      saveStatuses(nextStatuses)
    }

    void watch()
    timer = window.setInterval(() => void watch(), WATCH_INTERVAL_MS)
    return () => { stopped = true; window.clearInterval(timer) }
  }, [pushNotification, role, user, vehicles])

  return null
}
