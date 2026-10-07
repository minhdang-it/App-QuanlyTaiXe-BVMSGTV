import { useEffect, useMemo, useRef, useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { useData } from '../context/DataContext'
import { usePresence, type PresencePlatform } from '../context/PresenceContext'
import { ROLE_LABELS } from '../lib/constants'
import { formatLastSeen } from '../lib/utils'
import type { UserRole } from '../types/models'

const PLATFORM_LABELS: Record<PresencePlatform, string> = {
  app: 'Ứng dụng',
  mobile: 'Điện thoại',
  web: 'Máy tính',
}

export function presenceText(online: boolean, lastSeenAt: string | null) {
  if (online) return 'Đang trực tuyến'
  if (!lastSeenAt) return 'Chưa từng trực tuyến'
  return `Hoạt động ${formatLastSeen(lastSeenAt).toLocaleLowerCase('vi-VN')}`
}

/** Chấm xanh/xám thể hiện tài khoản có đang trực tuyến. */
export function OnlineDot({ userId, overlay = false }: { userId: string | null | undefined; overlay?: boolean }) {
  const { presenceOf } = usePresence()
  const info = presenceOf(userId)
  const label = info.online ? 'Đang trực tuyến' : formatLastSeen(info.lastSeenAt)
  return <span
    className={`presence-dot ${info.online ? 'online' : 'offline'} ${overlay ? 'overlay' : ''}`}
    title={label}
    aria-label={label}
    role="img"
  />
}

/** Chấm trạng thái kèm dòng chữ "Đang trực tuyến" / "Hoạt động 5 phút trước". */
export function PresenceLabel({ userId, showPlatform = false }: { userId: string | null | undefined; showPlatform?: boolean }) {
  const { presenceOf } = usePresence()
  const info = presenceOf(userId)
  return <span className={`presence-label ${info.online ? 'online' : 'offline'}`}>
    <span className={`presence-dot ${info.online ? 'online' : 'offline'}`} aria-hidden="true" />
    <span>{presenceText(info.online, info.lastSeenAt)}{showPlatform && info.online && info.platform ? ` · ${PLATFORM_LABELS[info.platform]}` : ''}</span>
  </span>
}

const ROLE_ORDER: UserRole[] = ['driver', 'dispatcher', 'fleet', 'accountant', 'director', 'department_head', 'admin']

/** Nút trên thanh công cụ: số tài khoản đang trực tuyến và danh sách chi tiết. */
export function OnlineUsersButton() {
  const { user } = useAuth()
  const { data } = useData()
  const { onlineIds, presenceOf, realtimeConnected } = usePresence()
  const [open, setOpen] = useState(false)
  const wrapperRef = useRef<HTMLDivElement | null>(null)

  const onlineProfiles = useMemo(() => data.profiles
    .filter((profile) => !profile.deleted_at && profile.active && onlineIds.has(profile.id))
    .sort((a, b) => ROLE_ORDER.indexOf(a.role) - ROLE_ORDER.indexOf(b.role) || a.full_name.localeCompare(b.full_name, 'vi')), [data.profiles, onlineIds])

  const onlineDrivers = onlineProfiles.filter((profile) => profile.role === 'driver').length

  useEffect(() => {
    if (!open) return
    const close = (event: MouseEvent | TouchEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) setOpen(false)
    }
    const onKey = (event: KeyboardEvent) => { if (event.key === 'Escape') setOpen(false) }
    document.addEventListener('mousedown', close)
    document.addEventListener('touchstart', close)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', close)
      document.removeEventListener('touchstart', close)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  return <div className="online-users" ref={wrapperRef}>
    <button type="button" className="online-users-button" onClick={() => setOpen((value) => !value)} aria-expanded={open} aria-label={`${onlineProfiles.length} tài khoản đang trực tuyến`}>
      <span className="presence-dot online" aria-hidden="true" />
      <strong>{onlineProfiles.length}</strong>
      <span className="online-users-label">trực tuyến</span>
    </button>
    {open && <div className="online-users-popover" role="dialog" aria-label="Tài khoản đang trực tuyến">
      <div className="online-users-head">
        <div><strong>Đang trực tuyến</strong><small>{onlineProfiles.length} tài khoản · {onlineDrivers} tài xế</small></div>
        <span className={`online-users-mode ${realtimeConnected ? 'live' : ''}`}>{realtimeConnected ? 'Thời gian thực' : 'Theo nhịp 1 phút'}</span>
      </div>
      {onlineProfiles.length ? <ul className="online-users-list">{onlineProfiles.map((profile) => {
        const info = presenceOf(profile.id)
        return <li key={profile.id}>
          <span className="online-users-avatar">{profile.avatar_url ? <img src={profile.avatar_url} alt="" /> : profile.full_name.slice(0, 1).toUpperCase()}<OnlineDot userId={profile.id} overlay /></span>
          <div><strong>{profile.full_name}{profile.id === user?.id ? ' (bạn)' : ''}</strong><small>{ROLE_LABELS[profile.role]}{info.platform ? ` · ${PLATFORM_LABELS[info.platform]}` : ''}</small></div>
        </li>
      })}</ul> : <p className="online-users-empty">Chưa có tài khoản nào khác đang trực tuyến.</p>}
    </div>}
  </div>
}

/** Bảng tổng hợp trên trang Tổng quan: ai đang trực tuyến, ưu tiên tài xế. */
export function OnlineUsersPanel() {
  const { data } = useData()
  const { onlineIds, presenceOf } = usePresence()
  const accounts = data.profiles.filter((profile) => !profile.deleted_at && profile.active)
  const online = accounts
    .filter((profile) => onlineIds.has(profile.id))
    .sort((a, b) => ROLE_ORDER.indexOf(a.role) - ROLE_ORDER.indexOf(b.role) || a.full_name.localeCompare(b.full_name, 'vi'))
  const drivers = accounts.filter((profile) => profile.role === 'driver')
  const onlineDrivers = drivers.filter((profile) => onlineIds.has(profile.id)).length
  const offlineDrivers = drivers
    .filter((profile) => !onlineIds.has(profile.id))
    .sort((a, b) => new Date(presenceOf(b.id).lastSeenAt ?? 0).getTime() - new Date(presenceOf(a.id).lastSeenAt ?? 0).getTime())

  return <section className="panel online-users-panel modern-panel-span-2">
    <div className="panel-header">
      <div><h2>Tài khoản đang trực tuyến</h2><p>{online.length}/{accounts.length} tài khoản · {onlineDrivers}/{drivers.length} tài xế đang mở ứng dụng</p></div>
      <span className="count-pill"><span className="presence-dot online" aria-hidden="true" /> {online.length}</span>
    </div>
    <div className="online-users-chips">
      {online.map((profile) => <span key={profile.id} className={`online-user-chip role-${profile.role}`}>
        <OnlineDot userId={profile.id} />
        <strong>{profile.full_name}</strong>
        <small>{ROLE_LABELS[profile.role]}</small>
      </span>)}
      {!online.length && <p className="muted">Chưa có tài khoản nào đang trực tuyến.</p>}
    </div>
    {offlineDrivers.length > 0 && <details className="online-users-offline">
      <summary>{offlineDrivers.length} tài xế đang ngoại tuyến</summary>
      <ul>{offlineDrivers.map((profile) => <li key={profile.id}><OnlineDot userId={profile.id} /><strong>{profile.full_name}</strong><small>{formatLastSeen(presenceOf(profile.id).lastSeenAt)}</small></li>)}</ul>
    </details>}
  </section>
}
