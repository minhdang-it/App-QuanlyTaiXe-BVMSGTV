import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { useAuth } from '../context/AuthContext'
import { ROLE_LABELS } from '../lib/constants'
import { NetworkBanner } from './NetworkBanner'
import { useData } from '../context/DataContext'
import { BrandLogo } from './BrandLogo'
import { NotificationCenter } from './NotificationCenter'

export type PageKey = 'dashboard' | 'dispatch' | 'vehicles' | 'expenses' | 'incidents' | 'maintenance' | 'reports' | 'account' | 'users'

export const PAGE_PATHS: Record<PageKey, string> = {
  dashboard: '/tong-quan',
  dispatch: '/dieu-xe',
  vehicles: '/ho-so-xe',
  expenses: '/chi-phi',
  incidents: '/su-co',
  maintenance: '/bao-duong',
  reports: '/bao-cao',
  account: '/ho-so',
  users: '/tai-khoan',
}

export function pageFromPath(pathname: string): PageKey {
  const normalized = pathname.replace(/\/+$/, '') || '/'
  if (normalized === '/') return 'dashboard'
  const match = (Object.entries(PAGE_PATHS) as Array<[PageKey, string]>).find(([, path]) => path === normalized)
  return match?.[0] ?? 'dashboard'
}

type RoleKey = 'dispatcher' | 'accountant' | 'fleet' | 'director' | 'admin'
type NavIconName = 'dashboard' | 'dispatch' | 'vehicles' | 'expenses' | 'incidents' | 'maintenance' | 'reports' | 'account' | 'users' | 'menu' | 'logout'

const navigation: Array<{ key: PageKey; label: string; icon: NavIconName; hint: string; roles: string[] }> = [
  { key: 'dashboard', label: 'Tổng quan', icon: 'dashboard', hint: 'Điều hành theo vai trò', roles: ['dispatcher', 'accountant', 'fleet', 'director', 'admin'] },
  { key: 'dispatch', label: 'Điều xe', icon: 'dispatch', hint: 'Theo dõi chuyến đi', roles: ['dispatcher', 'accountant', 'fleet', 'director', 'admin'] },
  { key: 'vehicles', label: 'Hồ sơ xe', icon: 'vehicles', hint: 'Danh mục & trạng thái xe', roles: ['dispatcher', 'fleet', 'admin'] },
  { key: 'expenses', label: 'Chi phí', icon: 'expenses', hint: 'Xăng dầu & chứng từ', roles: ['dispatcher', 'accountant', 'director', 'admin'] },
  { key: 'incidents', label: 'Sự cố', icon: 'incidents', hint: 'Xử lý cảnh báo', roles: ['dispatcher', 'fleet', 'director', 'admin'] },
  { key: 'maintenance', label: 'Bảo dưỡng', icon: 'maintenance', hint: 'Lịch sửa chữa', roles: ['dispatcher', 'fleet', 'admin'] },
  { key: 'reports', label: 'Báo cáo', icon: 'reports', hint: 'Thống kê tức thời', roles: ['dispatcher', 'accountant', 'fleet', 'director', 'admin'] },
  { key: 'account', label: 'Hồ sơ', icon: 'account', hint: 'Thông tin tài khoản', roles: ['dispatcher', 'accountant', 'fleet', 'director', 'admin'] },
  { key: 'users', label: 'Tài khoản', icon: 'users', hint: 'Phân quyền hệ thống', roles: ['admin'] },
]

const pageDescriptions: Record<PageKey, string> = {
  dashboard: 'Màn hình điều hành trung tâm, hiển thị các chỉ số và cảnh báo quan trọng.',
  dispatch: 'Theo dõi toàn bộ chuyến xe, vị trí xe hoạt động và lịch điều xe theo thời gian thực.',
  vehicles: 'Quản lý hồ sơ xe, tình trạng xe, đăng kiểm, bảo hiểm và phân công tài xế.',
  expenses: 'Quản lý chi phí phát sinh, hóa đơn, duyệt thanh toán và theo dõi nhiên liệu.',
  incidents: 'Ghi nhận sự cố, mức độ nghiêm trọng và trạng thái xử lý của từng xe.',
  maintenance: 'Lên kế hoạch bảo dưỡng, sửa chữa và kiểm soát các mốc kỹ thuật.',
  reports: 'Tổng hợp số liệu nhanh giúp ban lãnh đạo nắm bắt hiệu quả vận hành.',
  account: 'Xem và cập nhật hồ sơ cá nhân trong hệ thống.',
  users: 'Tạo, chỉnh sửa và phân quyền tài khoản sử dụng hệ thống.',
}

const roleMeta: Record<RoleKey, { title: string; subtitle: string; security: string }> = {
  dispatcher: {
    title: 'Trung tâm điều phối xe',
    subtitle: 'Tập trung điều chuyến, theo dõi tiến độ và xử lý yêu cầu phát sinh theo thời gian thực.',
    security: 'Điều phối được xem, điều chỉnh chuyến và giám sát trạng thái xe đang hoạt động.',
  },
  accountant: {
    title: 'Trung tâm kiểm soát chi phí',
    subtitle: 'Theo dõi nhiên liệu, cầu đường, chi phí sửa chữa và hồ sơ quyết toán rõ ràng.',
    security: 'Kế toán chỉ thao tác trên chi phí, báo cáo và vị trí chuyến đang phát sinh chứng từ.',
  },
  fleet: {
    title: 'Trung tâm vận hành đội xe',
    subtitle: 'Quản lý bảo dưỡng, sự cố, hồ sơ xe và giám sát khả năng sẵn sàng của từng xe.',
    security: 'Bộ phận đội xe được theo dõi xe đang hoạt động, tình trạng kỹ thuật và cảnh báo bảo dưỡng.',
  },
  director: {
    title: 'Trung tâm điều hành Ban lãnh đạo',
    subtitle: 'Tập trung chỉ số điều hành, vị trí xe đang chạy và cảnh báo quan trọng cho lãnh đạo.',
    security: 'Ban lãnh đạo chỉ xem dữ liệu tổng hợp, cảnh báo nhanh và vị trí xe đang vận hành.',
  },
  admin: {
    title: 'Trung tâm quản trị hệ thống',
    subtitle: 'Kiểm soát người dùng, phân quyền, đồng bộ dữ liệu và toàn bộ các module hệ thống.',
    security: 'Quản trị viên có đầy đủ quyền cấu hình, nhưng mọi module đều nhấn mạnh kiểm soát bảo mật.',
  },
}

function AppIcon({ name, className = '' }: { name: NavIconName; className?: string }) {
  const common = { width: 20, height: 20, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 1.9, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const, className }
  switch (name) {
    case 'dashboard':
      return <svg {...common}><rect x="3" y="4" width="7" height="7" rx="1.5" /><rect x="14" y="4" width="7" height="5" rx="1.5" /><rect x="14" y="12" width="7" height="8" rx="1.5" /><rect x="3" y="14" width="7" height="6" rx="1.5" /></svg>
    case 'dispatch':
      return <svg {...common}><path d="M5 19 19 5" /><path d="M9 5h10v10" /></svg>
    case 'vehicles':
      return <svg {...common}><rect x="4" y="5" width="16" height="14" rx="2" /><path d="M9 5v14" /></svg>
    case 'expenses':
      return <svg {...common}><circle cx="12" cy="12" r="8.5" /><path d="M12 6.5v11" /><path d="M15.5 9.25c0-1.38-1.57-2.5-3.5-2.5s-3.5 1.12-3.5 2.5 1.57 2.5 3.5 2.5 3.5 1.12 3.5 2.5-1.57 2.5-3.5 2.5-3.5-1.12-3.5-2.5" /></svg>
    case 'incidents':
      return <svg {...common}><path d="M12 5v8" /><path d="M12 17h.01" /><path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0Z" /></svg>
    case 'maintenance':
      return <svg {...common}><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09a1.65 1.65 0 0 0-1-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09a1.65 1.65 0 0 0 1.51-1 1.65 1.65 0 0 0-.33-1.82L4.21 7.2a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33h.01a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51h.01a1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82v.01a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" /></svg>
    case 'reports':
      return <svg {...common}><path d="M4 19V5" /><path d="M10 19V9" /><path d="M16 19V13" /><path d="M22 19H2" /></svg>
    case 'account':
      return <svg {...common}><circle cx="12" cy="8" r="4" /><path d="M5 20a7 7 0 0 1 14 0" /></svg>
    case 'users':
      return <svg {...common}><path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="8.5" cy="7" r="4" /><path d="M20 8v6" /><path d="M23 11h-6" /></svg>
    case 'logout':
      return <svg {...common}><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" /><path d="M16 17l5-5-5-5" /><path d="M21 12H9" /></svg>
    case 'menu':
    default:
      return <svg {...common}><path d="M4 7h16" /><path d="M4 12h16" /><path d="M4 17h16" /></svg>
  }
}

export function AppShell({ page, onPage, children }: { page: PageKey; onPage: (page: PageKey) => void; children: ReactNode }) {
  const { user, logout, mode } = useAuth()
  const { error, data, refresh, online } = useData()
  const [loggingOut, setLoggingOut] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const [hoverTooltip, setHoverTooltip] = useState<{ label: string; top: number; left: number } | null>(null)
  const currentProfile = data.profiles.find((profile) => profile.id === user?.id) ?? user?.profile
  const visible = navigation.filter((item) => item.roles.includes(currentProfile?.role ?? ''))
  const currentRole = (currentProfile?.role ?? 'dispatcher') as RoleKey
  const activeTrips = useMemo(() => data.trips.filter((trip) => trip.status === 'active').length, [data.trips])

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' })
    setHoverTooltip(null)
    const currentLabel = navigation.find((item) => item.key === page)?.label ?? 'Điều phối xe'
    document.title = `${currentLabel} | Bệnh viện mắt Sài Gòn Trà Vinh`
  }, [page])

  useEffect(() => {
    if (!sidebarCollapsed) setHoverTooltip(null)
  }, [sidebarCollapsed])

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

  async function handleRefresh() {
    if (refreshing) return
    setRefreshing(true)
    try {
      await refresh()
    } finally {
      setRefreshing(false)
    }
  }

  return (
    <div className={`app-shell role-${currentRole} ${sidebarCollapsed ? 'sidebar-collapsed' : ''}`}>
      <aside className="sidebar sidebar-modern">
        <div className="brand">
          <button type="button" className="brand-home-button" onClick={() => onPage('dashboard')} aria-label="Về trang chủ">
            <BrandLogo compact />
          </button>
        </div>

        <div className="sidebar-controls desktop-only">
          <span className="sidebar-role-pill">{ROLE_LABELS[currentRole]}</span>
          <button
            type="button"
            className="sidebar-collapse-control"
            onClick={() => setSidebarCollapsed((value) => !value)}
            aria-label={sidebarCollapsed ? 'Hiện thanh menu' : 'Thu gọn thanh menu'}
            title={sidebarCollapsed ? 'Hiện menu' : 'Thu gọn menu'}
          >
            <AppIcon name="menu" />
            <strong>{sidebarCollapsed ? '' : 'Thu gọn menu'}</strong>
          </button>
        </div>

        <nav className="side-nav side-nav-modern">
          {visible.map((item) => (
            <button
              type="button"
              key={item.key}
              title={item.label}
              className={page === item.key ? 'active' : ''}
              onMouseEnter={(event) => {
                if (!sidebarCollapsed) return
                const rect = event.currentTarget.getBoundingClientRect()
                setHoverTooltip({ label: item.label, top: rect.top + rect.height / 2, left: rect.right + 12 })
              }}
              onMouseLeave={() => setHoverTooltip(null)}
              onFocus={(event) => {
                if (!sidebarCollapsed) return
                const rect = event.currentTarget.getBoundingClientRect()
                setHoverTooltip({ label: item.label, top: rect.top + rect.height / 2, left: rect.right + 12 })
              }}
              onBlur={() => setHoverTooltip(null)}
              onClick={() => onPage(item.key)}
            >
              <span className="nav-icon-badge" aria-hidden="true"><AppIcon name={item.icon} /></span>
              <span className="nav-copy"><strong>{item.label}</strong><small>{item.hint}</small></span>
            </button>
          ))}
        </nav>

        <div className="sidebar-account">
          <button className="sidebar-user sidebar-user-button" onClick={() => onPage('account')} aria-label="Mở hồ sơ cá nhân">
            <div className="avatar">{currentProfile?.avatar_url ? <img src={currentProfile.avatar_url} alt="Ảnh đại diện" /> : currentProfile?.full_name.slice(0, 1).toUpperCase()}</div>
            <div className="user-copy"><strong>{currentProfile?.full_name}</strong><span>{currentProfile ? ROLE_LABELS[currentProfile.role] : ''}</span></div>
            <span className="sidebar-user-arrow">›</span>
          </button>
          <button className="sidebar-logout" onClick={() => void handleLogout()} disabled={loggingOut}>
            <span aria-hidden="true"><AppIcon name="logout" /></span>
            <strong>{loggingOut ? 'Đang đăng xuất...' : 'Đăng xuất'}</strong>
          </button>
        </div>
      </aside>
      {hoverTooltip && (
        <div className="sidebar-floating-tooltip" style={{ top: hoverTooltip.top, left: hoverTooltip.left }} role="tooltip">
          {hoverTooltip.label}
        </div>
      )}
      <main className="main-area">
        <NetworkBanner />
        {error && <div className="data-error-banner">Không tải được dữ liệu mới: {error}</div>}
        <header className="topbar topbar-modern">
          <div className="topbar-heading-block">
            <div className="mobile-topbar-brand">
              <button type="button" className="brand-home-button" onClick={() => onPage('dashboard')} aria-label="Về trang chủ">
                <BrandLogo compact />
              </button>
              <span className={`sidebar-online-pill ${online ? 'is-online' : 'is-offline'}`}>{online ? 'Trực tuyến' : 'Ngoại tuyến'}</span>
            </div>
            <div>
              <nav className="page-breadcrumb" aria-label="Đường dẫn trang">
                <button type="button" onClick={() => onPage('dashboard')}>Trang chủ</button>
                <span aria-hidden="true">/</span>
                <strong>{navigation.find((item) => item.key === page)?.label}</strong>
              </nav>
              <h1>{navigation.find((item) => item.key === page)?.label}</h1>
              <p>{pageDescriptions[page]}</p>
            </div>
          </div>
          <div className="topbar-actions">
            <button className="refresh-data-button" onClick={() => void handleRefresh()} disabled={refreshing} aria-label="Làm mới dữ liệu">
              <span aria-hidden="true">↻</span>
              <strong className="refresh-label-full">{refreshing ? 'Đang làm mới...' : 'Làm mới dữ liệu'}</strong>
              <strong className="refresh-label-short">{refreshing ? 'Đang tải' : 'Làm mới'}</strong>
            </button>
            <NotificationCenter onNavigate={(target) => onPage(target as PageKey)} />
            <button className="topbar-profile-button" onClick={() => onPage('account')} aria-label="Mở hồ sơ cá nhân">
              <span className="topbar-profile-avatar">{currentProfile?.avatar_url ? <img src={currentProfile.avatar_url} alt="Ảnh đại diện" /> : currentProfile?.full_name.slice(0, 1).toUpperCase()}</span>
              <span>Hồ sơ</span>
            </button>
            <span className={`mode-pill ${mode}`}>Trực tuyến</span>
            <button className="mobile-logout" onClick={() => void handleLogout()} disabled={loggingOut} aria-label="Đăng xuất">
              <span aria-hidden="true">⎋</span>
              <strong>{loggingOut ? 'Đang thoát...' : 'Đăng xuất'}</strong>
            </button>
          </div>
        </header>
        <div className="page-content">{children}</div>
      </main>
      <nav className="mobile-nav mobile-nav-modern">
        {visible.map((item) => (
          <button type="button" key={item.key} className={page === item.key ? 'active' : ''} onClick={() => onPage(item.key)}>
            <span className="mobile-nav-icon"><AppIcon name={item.icon} /></span><small>{item.label}</small>
          </button>
        ))}
      </nav>
    </div>
  )
}
