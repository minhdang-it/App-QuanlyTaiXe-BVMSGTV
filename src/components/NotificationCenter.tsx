import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useNotifications, type AppNotification, type NotificationTarget } from '../context/NotificationContext'

const kindIcons: Record<AppNotification['kind'], string> = {
  request: '📄',
  trip: '🚐',
  incident: '⚠️',
  expense: '🧾',
  maintenance: '🔧',
  system: '🔔',
}

function relativeTime(value: string) {
  const diff = Date.now() - new Date(value).getTime()
  const minutes = Math.max(0, Math.floor(diff / 60000))
  if (minutes < 1) return 'Vừa xong'
  if (minutes < 60) return `${minutes} phút trước`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours} giờ trước`
  const days = Math.floor(hours / 24)
  return `${days} ngày trước`
}

export function NotificationCenter({ onNavigate, compact = false }: { onNavigate?: (target: NotificationTarget, recordId?: string) => void; compact?: boolean }) {
  const {
    notifications,
    unreadCount,
    toastNotifications,
    browserPermission,
    markRead,
    markAllRead,
    clearAll,
    dismissToast,
    requestBrowserPermission,
  } = useNotifications()
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false)
    }
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    document.addEventListener('keydown', closeOnEscape)
    return () => {
      document.body.style.overflow = previousOverflow
      document.removeEventListener('keydown', closeOnEscape)
    }
  }, [open])

  function openItem(item: AppNotification) {
    markRead(item.id)
    setOpen(false)
    if (item.target) onNavigate?.(item.target, item.recordId)
  }

  return <>
    <div className={`notification-center ${compact ? 'compact' : ''}`} ref={rootRef}>
      <button className="notification-bell" onClick={() => setOpen((value) => !value)} aria-label={`Thông báo${unreadCount ? `, ${unreadCount} chưa đọc` : ''}`}>
        <span aria-hidden="true">🔔</span>
        {unreadCount > 0 && <strong>{unreadCount > 99 ? '99+' : unreadCount}</strong>}
      </button>

      {open && typeof document !== 'undefined' && createPortal(<>
        <button type="button" className="notification-overlay" onClick={() => setOpen(false)} aria-label="Đóng trung tâm thông báo" />
<section className={`notification-popover notification-popover-portal ${compact ? 'compact' : ''}`} aria-label="Trung tâm thông báo">
        <header className="notification-popover-header">
          <div><span>TRUNG TÂM THÔNG BÁO</span><h2>Thông báo</h2></div>
          <button className="icon-button" onClick={() => setOpen(false)} aria-label="Đóng">✕</button>
        </header>

        <div className="notification-tools">
          <button onClick={markAllRead} disabled={!unreadCount}>Đánh dấu đã đọc</button>
          <button onClick={clearAll} disabled={!notifications.length}>Xóa tất cả</button>
        </div>

        {browserPermission !== 'unsupported' && browserPermission !== 'granted' && <button className="notification-permission-card" onClick={() => void requestBrowserPermission()}>
          <span>📲</span>
          <div><strong>Bật thông báo trên thiết bị</strong><small>Nhận cảnh báo khi tab đang ở nền.</small></div>
          <b> Bật →</b>
        </button>}

        <div className="notification-list">
          {notifications.length ? notifications.map((item) => <button key={item.id} className={`notification-item ${item.read ? '' : 'unread'} priority-${item.priority}`} onClick={() => openItem(item)}>
            <span className="notification-item-icon">{kindIcons[item.kind]}</span>
            <span className="notification-item-copy"><strong>{item.title}</strong><small>{item.message}</small><time>{relativeTime(item.createdAt)}</time></span>
            {!item.read && <i />}
          </button>) : <div className="notification-empty"><span>🔕</span><strong>Chưa có thông báo</strong><p>Các chuyến mới, sự cố và thay đổi quan trọng sẽ xuất hiện tại đây.</p></div>}
        </div>
      </section>
      </>, document.body)}
    </div>

    <div className="notification-toast-stack" aria-live="polite">
      {toastNotifications.map((item) => <button key={item.id} className={`notification-toast priority-${item.priority}`} onClick={() => { openItem(item); dismissToast(item.id) }}>
        <span>{kindIcons[item.kind]}</span>
        <div><strong>{item.title}</strong><small>{item.message}</small></div>
        <i onClick={(event) => { event.stopPropagation(); dismissToast(item.id) }}>✕</i>
      </button>)}
    </div>
  </>
}
