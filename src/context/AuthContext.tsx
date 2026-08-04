import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import type { AuthUser } from '../types/models'
import { backend } from '../lib/backend'

interface AuthContextValue {
  user: AuthUser | null
  loading: boolean
  mode: 'demo' | 'supabase'
  login(phone: string, password: string): Promise<void>
  logout(): Promise<void>
  refreshUser(): Promise<AuthUser | null>
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let mounted = true
    backend.session().then((session) => {
      if (mounted) setUser(session)
    }).finally(() => {
      if (mounted) setLoading(false)
    })
    return () => { mounted = false }
  }, [])

  const value = useMemo<AuthContextValue>(() => ({
    user,
    loading,
    mode: backend.mode,
    async login(phone, password) {
      const session = await backend.login(phone, password)
      setUser(session)
    },
    async logout() {
      await backend.logout()
      setUser(null)
    },
    async refreshUser() {
      const session = await backend.session()
      setUser(session)
      return session
    },
  }), [loading, user])

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const value = useContext(AuthContext)
  if (!value) throw new Error('useAuth must be used inside AuthProvider')
  return value
}
