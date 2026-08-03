import { useState, type ReactNode } from 'react'
import { useAuth } from '../context/AuthContext'
import { ROLE_LABELS } from '../lib/constants'
import { NetworkBanner } from './NetworkBanner'
import { useData } from '../context/DataContext'
import { BrandLogo } from './BrandLogo'

export type PageKey = 'dashboard' | 'dispatch' | 'vehicles' | 'expenses' | 'incidents' | 'maintenance' | 'reports' | 'users'

const navigation: Array<{ key: PageKey; label: string; icon: string; roles: string[] }> = [
  { key: 'dashboard', label: 'Tổng quan', icon: '▦', roles: ['dispatcher', 'accountant', 'fleet', 'director', 'admin'] },
  { key: 'dispatch', label: 'Điều xe', icon: '🚐', roles: ['dispatcher', 'admin'] },
  { key: 'vehicles', label: 'Hồ sơ xe', icon: '🚘', roles: ['dispatcher', 'fleet', 'admin'] },
  { key: 'expenses', label: 'Chi phí', icon: '🧾', roles: ['dispatcher', 'accountant', 'director', 'admin'] },
  { key: 'incidents', label: 'Sự cố', icon: '⚠️', roles: ['dispatcher', 'fleet', 'director', 'admin'] },
  { key: 'maintenance', label: 'Bảo dưỡng', icon: '🔧', roles: ['dispatcher', 'fleet', 'admin'] },
  { key: 'reports', label: 'Báo cáo', icon: '📊', roles: ['dispatcher', 'accountant', 'fleet', 'director', 'admin'] },
  { key: 'users', label: 'Tài khoản', icon: '👥', roles: ['admin'] },
]

export function AppShell({ page, onPage, children }: { page: PageKey; onPage: (page: PageKey) => void; children: ReactNode }) {
  const { user, logout, mode } = useAuth()
  const { error } = useData()
  const [loggingOut, setLoggingOut] = useState(false)
  const visible = navigation.filter((item) => item.roles.includes(user?.profile.role ?? ''))

  async function handleLogout() {
    if (loggingOut) return
    const accepted = window.confirm('Đăng xuất khỏi hệ thống Điều phối xe?')
    if (!accepted) return

    setLoggingOut(true)
    try {
      await logout()
    } finally {
      setLoggingOut(false)
    }
  }

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <BrandLogo compact />
        </div>
        <nav className="side-nav">
          {visible.map((item) => (
            <button key={item.key} className={page === item.key ? 'active' : ''} onClick={() => onPage(item.key)}>
              <span>{item.icon}</span>{item.label}
            </button>
          ))}
        </nav>
        <div className="sidebar-account">
          <div className="sidebar-user">
            <div className="avatar">{user?.profile.full_name.slice(0, 1).toUpperCase()}</div>
            <div className="user-copy"><strong>{user?.profile.full_name}</strong><span>{ROLE_LABELS[user!.profile.role]}</span></div>
          </div>
          <button className="sidebar-logout" onClick={() => void handleLogout()} disabled={loggingOut}>
            <span aria-hidden="true">⎋</span>
            {loggingOut ? 'Đang đăng xuất...' : 'Đăng xuất'}
          </button>
        </div>
      </aside>
      <main className="main-area">
        <NetworkBanner />
        {error && <div className="data-error-banner">Không tải được dữ liệu mới: {error}</div>}
        <header className="topbar">
          <div>
            <h1>{navigation.find((item) => item.key === page)?.label}</h1>
            <p>Bệnh viện Mắt Sài Gòn Trà Vinh</p>
          </div>
          <div className="topbar-actions">
            <span className={`mode-pill ${mode}`}>{mode === 'demo' ? 'Chế độ Demo' : 'Dữ liệu trực tuyến'}</span>
            <button className="mobile-logout" onClick={() => void handleLogout()} disabled={loggingOut} aria-label="Đăng xuất">
              <span aria-hidden="true">⎋</span>
              <strong>{loggingOut ? 'Đang thoát...' : 'Đăng xuất'}</strong>
            </button>
          </div>
        </header>
        <div className="page-content">{children}</div>
      </main>
      <nav className="mobile-nav">
        {visible.map((item) => (
          <button key={item.key} className={page === item.key ? 'active' : ''} onClick={() => onPage(item.key)}>
            <span>{item.icon}</span><small>{item.label}</small>
          </button>
        ))}
      </nav>
    </div>
  )
}
