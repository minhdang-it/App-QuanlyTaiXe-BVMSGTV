import { useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { useAuth } from '../context/AuthContext'
import { useData } from '../context/DataContext'
import { EXPENSE_LABELS, INCIDENT_LABELS, PURPOSE_LABELS } from '../lib/constants'
import { formatCurrency, formatDateTime } from '../lib/utils'
import type { PageKey } from './AppShell'

type SearchResult = { id: string; page: PageKey; icon: string; title: string; detail: string; meta: string }

const rolePages: Record<string, Set<PageKey>> = {
  department_head: new Set(['requests','account']),
  dispatcher: new Set(['dashboard','dispatch','vehicles','expenses','incidents','maintenance','reports','account']),
  accountant: new Set(['dashboard','dispatch','expenses','reports','account']),
  fleet: new Set(['dashboard','requests','dispatch','vehicles','incidents','maintenance','reports','account']),
  director: new Set(['dashboard','dispatch','expenses','incidents','maintenance','reports','account']),
  admin: new Set(['dashboard','requests','dispatch','vehicles','expenses','incidents','maintenance','reports','account','users']),
}

export function GlobalSearch({ onNavigate }: { onNavigate: (page: PageKey) => void }) {
  const { user } = useAuth()
  const { data } = useData()
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const allowed = rolePages[user!.profile.role] ?? new Set<PageKey>()
  const normalized = query.trim().toLocaleLowerCase('vi-VN')

  const results = useMemo<SearchResult[]>(() => {
    if (!normalized) return []
    const list: SearchResult[] = []
    const match = (...values: Array<string | number | null | undefined>) => values.some((value) => String(value ?? '').toLocaleLowerCase('vi-VN').includes(normalized))

    if (allowed.has('requests')) data.vehicleRequests.filter((item) => user!.profile.role !== 'department_head' || item.requester_id === user!.id).forEach((item) => {
      const requester = data.profiles.find((profile) => profile.id === item.requester_id)
      if (match(item.pickup,item.destination,item.department,item.contact_name,item.contact_phone,requester?.full_name,PURPOSE_LABELS[item.purpose])) list.push({ id:`request-${item.id}`, page:'requests', icon:'📄', title:`${item.pickup} → ${item.destination}`, detail:`${item.department || requester?.department || 'Đề nghị xe'} · ${PURPOSE_LABELS[item.purpose]}`, meta:formatDateTime(item.scheduled_start) })
    })

    if (allowed.has('dispatch')) data.trips.forEach((item) => {
      const vehicle = data.vehicles.find((v) => v.id === item.vehicle_id)
      const driver = data.profiles.find((p) => p.id === item.driver_id)
      if (match(item.pickup,item.destination,item.contact_name,item.contact_phone,item.notes,vehicle?.plate_number,vehicle?.vehicle_name,driver?.full_name,PURPOSE_LABELS[item.purpose])) list.push({ id:`trip-${item.id}`, page:'dispatch', icon:'🚐', title:`${vehicle?.plate_number ?? 'Chuyến xe'} · ${item.destination}`, detail:`${driver?.full_name ?? 'Chưa gán tài xế'} · ${PURPOSE_LABELS[item.purpose]}`, meta:formatDateTime(item.scheduled_start) })
    })

    if (allowed.has('vehicles')) data.vehicles.forEach((item) => {
      const driver = data.profiles.find((profile) => profile.id === item.regular_driver_id)
      if (match(item.plate_number,item.vehicle_name,item.vehicle_type,driver?.full_name,item.notes)) list.push({ id:`vehicle-${item.id}`, page:'vehicles', icon:'🚘', title:item.plate_number, detail:`${item.vehicle_name} · ${driver?.full_name ?? 'Chưa phân tài xế'}`, meta:`${item.odometer.toLocaleString('vi-VN')} km` })
    })

    if (allowed.has('expenses')) data.expenses.forEach((item) => {
      const vehicle = data.vehicles.find((v) => v.id === item.vehicle_id)
      if (match(item.description,item.amount,EXPENSE_LABELS[item.type],vehicle?.plate_number)) list.push({ id:`expense-${item.id}`, page:'expenses', icon:'🧾', title:`${EXPENSE_LABELS[item.type]} · ${formatCurrency(item.amount)}`, detail:`${vehicle?.plate_number ?? 'Chưa rõ xe'} · ${item.description || 'Không có mô tả'}`, meta:formatDateTime(item.created_at) })
    })

    if (allowed.has('incidents')) data.incidents.forEach((item) => {
      const vehicle = data.vehicles.find((v) => v.id === item.vehicle_id)
      if (match(item.description,INCIDENT_LABELS[item.type],vehicle?.plate_number,item.severity)) list.push({ id:`incident-${item.id}`, page:'incidents', icon:'⚠️', title:`${INCIDENT_LABELS[item.type]} · ${vehicle?.plate_number ?? ''}`, detail:item.description || `Mức độ ${item.severity}`, meta:formatDateTime(item.created_at) })
    })

    if (allowed.has('users')) data.profiles.filter((item) => !item.deleted_at).forEach((item) => {
      if (match(item.full_name,item.phone,item.department,item.employee_code,item.job_title)) list.push({ id:`user-${item.id}`, page:'users', icon:'👤', title:item.full_name, detail:`${item.department || 'Chưa có bộ phận'} · ${item.phone}`, meta:item.job_title || 'Tài khoản hệ thống' })
    })

    return list.slice(0, 30)
  }, [allowed, data, normalized, user])

  function openResult(item: SearchResult) {
    setOpen(false)
    setQuery('')
    onNavigate(item.page)
  }

  return <>
    <button type="button" className="global-search-trigger" onClick={() => setOpen(true)} aria-label="Tìm kiếm toàn hệ thống"><span>⌕</span><strong>Tìm kiếm</strong></button>
    {open && createPortal(<><button type="button" className="global-search-overlay" onClick={() => setOpen(false)} aria-label="Đóng tìm kiếm" /><section className="global-search-panel">
      <header><div><span>TÌM KIẾM NHANH</span><h2>Tìm trong hệ thống</h2></div><button type="button" className="icon-button" onClick={() => setOpen(false)}>✕</button></header>
      <div className="global-search-input"><span>⌕</span><input autoFocus value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Biển số, tài xế, địa điểm, SĐT, chi phí..." /></div>
      <div className="global-search-results">{normalized ? results.length ? results.map((item) => <button type="button" key={item.id} onClick={() => openResult(item)}><span>{item.icon}</span><div><strong>{item.title}</strong><small>{item.detail}</small><time>{item.meta}</time></div><i>›</i></button>) : <div className="global-search-empty"><span>⌕</span><strong>Không tìm thấy dữ liệu phù hợp</strong><small>Thử biển số, tên người, địa điểm hoặc số điện thoại khác.</small></div> : <div className="global-search-empty"><span>⌕</span><strong>Tìm mọi dữ liệu từ một chỗ</strong><small>Kết quả được giới hạn theo quyền của tài khoản hiện tại.</small></div>}</div>
    </section></>, document.body)}
  </>
}
