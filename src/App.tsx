import { useState } from 'react'
import { useAuth } from './context/AuthContext'
import { DataProvider, useData } from './context/DataContext'
import { AppShell, type PageKey } from './components/AppShell'
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

export default function App() {
  const { user, loading } = useAuth()
  const [page, setPage] = useState<PageKey>('dashboard')

  if (loading) return <Loading label="Đang kiểm tra phiên đăng nhập..." />
  if (!user) return <LoginPage />

  return <DataProvider><AuthenticatedArea role={user.profile.role} page={page} setPage={setPage} /></DataProvider>
}


const rolePages: Record<string, PageKey[]> = {
  dispatcher: ['dashboard', 'dispatch', 'vehicles', 'expenses', 'incidents', 'maintenance', 'reports'],
  accountant: ['dashboard', 'expenses', 'reports'],
  fleet: ['dashboard', 'vehicles', 'incidents', 'maintenance', 'reports'],
  director: ['dashboard', 'expenses', 'incidents', 'reports'],
  admin: ['dashboard', 'dispatch', 'vehicles', 'expenses', 'incidents', 'maintenance', 'reports', 'users'],
}

function AuthenticatedArea({ role, page, setPage }: { role: string; page: PageKey; setPage: (page: PageKey) => void }) {
  const { loading } = useData()
  if (loading) return <Loading label="Đang tải dữ liệu đội xe..." />
  if (role === 'driver') return <DriverPage />
  const safePage = rolePages[role]?.includes(page) ? page : 'dashboard'
  return <AppShell page={safePage} onPage={setPage}><Page page={safePage} /></AppShell>
}

function Page({ page }: { page: PageKey }) {
  switch (page) {
    case 'dispatch': return <DispatchPage />
    case 'vehicles': return <VehiclesPage />
    case 'expenses': return <ExpensesPage />
    case 'incidents': return <IncidentsPage />
    case 'maintenance': return <MaintenancePage />
    case 'reports': return <ReportsPage />
    case 'users': return <UsersPage />
    default: return <DashboardPage />
  }
}
