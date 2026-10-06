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

export function classifyNavicomState(state: NavicomVehicleState | null | undefined): FleetStatus {
  const updatedAt = state?.gps.updated_at || state?.updated_at
  if (!updatedAt) return 'unknown'
  const time = new Date(updatedAt).getTime()
  if (!Number.isFinite(time)) return 'unknown'
  const ageMinutes = Math.max(0, (Date.now() - time) / 60_000)
  if (ageMinutes > NAVICOM_OFFLINE_MINUTES) return 'offline'
  if (ageMinutes > NAVICOM_ONLINE_MINUTES) return 'stale'
  return Number(state?.gps.speed_kph ?? 0) > 3 ? 'moving' : 'stopped'
}

export function coordinateLabel(state: NavicomVehicleState | null | undefined) {
  if (state?.gps.lat == null || state.gps.lng == null) return ''
  return `${state.gps.lat.toFixed(6)}, ${state.gps.lng.toFixed(6)}`
}

export function buildNavicomFleetEvent(vehicle: Vehicle, previous: FleetStatus, next: FleetStatus, state: NavicomVehicleState | null): FleetEvent | null {
  const now = new Date().toISOString()
  const detailBase = state?.gps.address || coordinateLabel(state) || 'Không có vị trí mới'
  if (['offline', 'unknown', 'stale'].includes(previous) && ['moving', 'stopped'].includes(next)) {
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
