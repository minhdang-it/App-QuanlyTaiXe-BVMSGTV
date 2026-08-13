import { useEffect, useState } from 'react'
import { useAuth } from './context/AuthContext'
import { DataProvider, useData } from './context/DataContext'
import { AppShell, PAGE_PATHS, pageFromPath, type PageKey } from './components/AppShell'
import { Loading } from './components/Loading'
import { LoginPage } from './pages/LoginPage'
import { DriverPage } from './pages/DriverPage'
import { DashboardPage } from './pages/DashboardPage'
import { DispatchPage } from './pages/DispatchPage'
import { VehiclesPage } from './pages/VehiclesPage'
import { ExpensesPage } from './pages/ExpensesPage'
import { IncidentsPage } from './pages/IncidentsPage'
import { MaintenancePage } from './pages/MaintenancePage'
import { ReportsPage } from './pages/ReportsPage'
import { UsersPage } from './pages/UsersPage'
import { AccountPage } from './pages/AccountPage'
import { RequestsPage } from './pages/RequestsPage'
import { NotificationProvider } from './context/NotificationContext'

export default function App() {
  const { user, loading } = useAuth()
  const [page, setPageState] = useState<PageKey>(() => pageFromPath(window.location.pathname))

  useEffect(() => {
    const handlePopState = () => setPageState(pageFromPath(window.location.pathname))
    window.addEventListener('popstate', handlePopState)
    return () => window.removeEventListener('popstate', handlePopState)
  }, [])

  function setPage(nextPage: PageKey) {
    setPageState(nextPage)
    const nextPath = PAGE_PATHS[nextPage]
    if (window.location.pathname !== nextPath) window.history.pushState({ page: nextPage }, '', nextPath)
  }

  useEffect(() => {
    if (!user || user.profile.role === 'driver') return
    const expectedPath = PAGE_PATHS[page]
    if (window.location.pathname !== expectedPath) {
      window.history.replaceState({ page }, '', expectedPath)
    }
  }, [page, user])

  if (loading) return <Loading label="Đang kiểm tra phiên đăng nhập..." />
  if (!user) return <LoginPage />

  return <DataProvider><NotificationProvider><AuthenticatedArea role={user.profile.role} page={page} setPage={setPage} /></NotificationProvider></DataProvider>
}


const rolePages: Record<string, PageKey[]> = {
  department_head: ['requests', 'account'],
  dispatcher: ['dashboard', 'dispatch', 'vehicles', 'expenses', 'incidents', 'maintenance', 'reports', 'account'],
  accountant: ['dashboard', 'dispatch', 'expenses', 'reports', 'account'],
  fleet: ['dashboard', 'requests', 'dispatch', 'vehicles', 'incidents', 'maintenance', 'reports', 'account'],
  director: ['dashboard', 'dispatch', 'expenses', 'incidents', 'maintenance', 'reports', 'account'],
  admin: ['dashboard', 'requests', 'dispatch', 'vehicles', 'expenses', 'incidents', 'maintenance', 'reports', 'account', 'users'],
}

function AuthenticatedArea({ role, page, setPage }: { role: string; page: PageKey; setPage: (page: PageKey) => void }) {
  const { loading } = useData()
  const safePage = rolePages[role]?.includes(page) ? page : (rolePages[role]?.[0] ?? 'dashboard')

  useEffect(() => {
    if (role !== 'driver' && safePage !== page) setPage(safePage)
  }, [page, role, safePage, setPage])

  if (loading) return <Loading label="Đang tải dữ liệu đội xe..." />
  if (role === 'driver') return <DriverPage />
  return <AppShell page={safePage} onPage={setPage}><Page page={safePage} onPage={setPage} /></AppShell>
}

function Page({ page, onPage }: { page: PageKey; onPage: (page: PageKey) => void }) {
  switch (page) {
    case 'requests': return <RequestsPage />
    case 'dispatch': return <DispatchPage />
    case 'vehicles': return <VehiclesPage />
    case 'expenses': return <ExpensesPage />
    case 'incidents': return <IncidentsPage />
    case 'maintenance': return <MaintenancePage />
    case 'reports': return <ReportsPage />
    case 'account': return <AccountPage />
    case 'users': return <UsersPage />
    default: return <DashboardPage onNavigate={onPage} />
  }
}
