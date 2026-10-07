import type { NavicomVehicleState } from './navicom'
import type { Vehicle } from '../types/models'

export const NAVICOM_ONLINE_MINUTES = 2
export const NAVICOM_OFFLINE_MINUTES = 10
export const NAVICOM_FLEET_EVENT = 'bvmsgtv-navicom-fleet-event'
export const NAVICOM_EVENT_STORAGE_KEY = 'bvmsgtv-navicom-fleet-events-v2'

export type FleetStatus = 'moving' | 'stopped' | 'stale' | 'offline' | 'unknown'
export type FleetEvent = {
  id: string
  vehicleId: string
  plateNumber: string
  type: 'online' | 'offline' | 'moving' | 'stopped' | 'warning'
  title: string
  detail: string
  createdAt: string
}

export function classifyNavicomState(state: NavicomVehicleState | null | undefined, previousState?: NavicomVehicleState | null): FleetStatus {
  const updatedAt = state?.gps.updated_at || state?.updated_at
  if (!updatedAt) return 'unknown'
  const time = new Date(updatedAt).getTime()
  if (!Number.isFinite(time)) return 'unknown'
  const ageMinutes = Math.max(0, (Date.now() - time) / 60_000)
  if (ageMinutes > NAVICOM_OFFLINE_MINUTES) return 'offline'
  if (ageMinutes > NAVICOM_ONLINE_MINUTES) return 'stale'

  const speed = Number(state?.gps.speed_kph ?? 0)
  if (Number.isFinite(speed) && speed > 2) return 'moving'

  const currentLat = state?.gps.lat
  const currentLng = state?.gps.lng
  const previousLat = previousState?.gps.lat
  const previousLng = previousState?.gps.lng
  const previousAt = previousState?.gps.updated_at || previousState?.updated_at
  if (currentLat != null && currentLng != null && previousLat != null && previousLng != null && previousAt) {
    const previousTime = new Date(previousAt).getTime()
    const seconds = Math.abs(time - previousTime) / 1000
    if (Number.isFinite(previousTime) && seconds > 0 && seconds <= 180) {
      const distance = haversineMeters(previousLat, previousLng, currentLat, currentLng)
      // GPS CMSV6 đôi khi trả tốc độ 0 dù tọa độ đã thay đổi. Trên 18m/3 phút được xem là xe đang di chuyển.
      if (distance >= 18) return 'moving'
    }
  }

  if (state?.gps.ignition === true && speed > 0.5) return 'moving'
  return 'stopped'
}

function haversineMeters(lat1: number, lng1: number, lat2: number, lng2: number) {
  const rad = Math.PI / 180
  const dLat = (lat2 - lat1) * rad
  const dLng = (lng2 - lng1) * rad
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * rad) * Math.cos(lat2 * rad) * Math.sin(dLng / 2) ** 2
  return 6_371_000 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

export function coordinateLabel(state: NavicomVehicleState | null | undefined) {
  if (state?.gps.lat == null || state.gps.lng == null) return ''
  return `${state.gps.lat.toFixed(6)}, ${state.gps.lng.toFixed(6)}`
}

export function buildNavicomFleetEvent(vehicle: Vehicle, previous: FleetStatus, next: FleetStatus, state: NavicomVehicleState | null): FleetEvent | null {
  const now = new Date().toISOString()
  const detailBase = state?.gps.address || coordinateLabel(state) || 'Không có vị trí mới'
  if (previous === 'offline' && ['moving', 'stopped'].includes(next)) {
    return { id: `navicom-${vehicle.id}-online-${now}`, vehicleId: vehicle.id, plateNumber: vehicle.plate_number, type: 'online', title: `${vehicle.plate_number} vừa online`, detail: `${detailBase} · ${state?.gps.speed_kph != null ? `${Math.round(state.gps.speed_kph)} km/h` : 'đã có GPS mới'}`, createdAt: now }
  }
  if (['moving', 'stopped'].includes(previous) && ['offline', 'unknown'].includes(next)) {
    return { id: `navicom-${vehicle.id}-offline-${now}`, vehicleId: vehicle.id, plateNumber: vehicle.plate_number, type: 'offline', title: `${vehicle.plate_number} mất tín hiệu`, detail: `Không có GPS mới trong hơn ${NAVICOM_OFFLINE_MINUTES} phút. Vị trí gần nhất: ${detailBase}`, createdAt: now }
  }
  if (previous === 'stopped' && next === 'moving') {
    return { id: `navicom-${vehicle.id}-moving-${now}`, vehicleId: vehicle.id, plateNumber: vehicle.plate_number, type: 'moving', title: `${vehicle.plate_number} bắt đầu di chuyển`, detail: `${detailBase} · ${Math.round(state?.gps.speed_kph ?? 0)} km/h`, createdAt: now }
  }
  if (previous === 'moving' && next === 'stopped') {
    return { id: `navicom-${vehicle.id}-stopped-${now}`, vehicleId: vehicle.id, plateNumber: vehicle.plate_number, type: 'stopped', title: `${vehicle.plate_number} đã dừng`, detail: detailBase, createdAt: now }
  }
  return null
}

export function loadNavicomEvents(): FleetEvent[] {
  try {
    const value = JSON.parse(localStorage.getItem(NAVICOM_EVENT_STORAGE_KEY) ?? '[]')
    return Array.isArray(value) ? value.slice(0, 40) : []
  } catch { return [] }
}

export function storeNavicomEvent(event: FleetEvent) {
  const current = loadNavicomEvents()
  const next = [event, ...current.filter((item) => item.id !== event.id)].slice(0, 40)
  try { localStorage.setItem(NAVICOM_EVENT_STORAGE_KEY, JSON.stringify(next)) } catch { /* ignore */ }
  try { window.dispatchEvent(new CustomEvent(NAVICOM_FLEET_EVENT, { detail: event })) } catch { /* ignore */ }
  return next
}
