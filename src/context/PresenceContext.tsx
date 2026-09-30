import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { useAuth } from './AuthContext'
import { backend } from '../lib/backend'
import { supabase } from '../lib/supabase'
import { PRESENCE_ONLINE_WINDOW_MS } from '../lib/constants'
import type { UserPresence } from '../types/models'

/**
 * Trạng thái trực tuyến của tài khoản.
 * - Tức thời: Supabase Realtime Presence (mỗi phiên đăng nhập tự "track" khi mở ứng dụng).
 * - Dự phòng + "hoạt động gần nhất": bảng user_presence, ghi qua RPC touch_presence() mỗi phút.
 */

export type PresencePlatform = 'mobile' | 'app' | 'web'

export interface PresenceInfo {
  online: boolean
  lastSeenAt: string | null
  platform: PresencePlatform | null
}

interface LivePresence {
  user_id: string
  platform?: PresencePlatform
  online_at?: string
}

interface PresenceContextValue {
  onlineIds: Set<string>
  onlineCount: number
  realtimeConnected: boolean
  presenceOf(userId: string | null | undefined): PresenceInfo
}

const HEARTBEAT_MS = 60_000
const RELOAD_MS = 60_000
const PresenceContext = createContext<PresenceContextValue | null>(null)

function detectPlatform(): PresencePlatform {
  const standalone = window.matchMedia?.('(display-mode: standalone)').matches
    || (navigator as Navigator & { standalone?: boolean }).standalone === true
  if (standalone) return 'app'
  return /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent) ? 'mobile' : 'web'
}

export function PresenceProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth()
  const [live, setLive] = useState<Record<string, LivePresence>>({})
  const [rows, setRows] = useState<Record<string, UserPresence>>({})
  const [realtimeConnected, setRealtimeConnected] = useState(false)
  const [now, setNow] = useState(() => Date.now())
  const userId = user?.id ?? null
  const role = user?.profile.role ?? null

  const reloadRows = useCallback(async () => {
    if (!userId) return
    const items = await backend.loadPresence()
    setRows(Object.fromEntries(items.map((item) => [item.user_id, item])))
  }, [userId])

  // Nhịp hoạt động: ghi "hoạt động gần nhất" khi ứng dụng đang mở.
  useEffect(() => {
    if (!userId) return
    const platform = detectPlatform()
    const beat = () => {
      if (document.hidden) return
      void backend.touchPresence(platform).catch(() => undefined)
      setNow(Date.now())
    }
    beat()
    void reloadRows()
    const heartbeat = window.setInterval(beat, HEARTBEAT_MS)
    const reload = window.setInterval(() => { if (!document.hidden) void reloadRows() }, RELOAD_MS)
    const tick = window.setInterval(() => setNow(Date.now()), 30_000)
    const onVisible = () => { if (!document.hidden) { beat(); void reloadRows() } }
    document.addEventListener('visibilitychange', onVisible)
    window.addEventListener('online', onVisible)
    return () => {
      window.clearInterval(heartbeat)
      window.clearInterval(reload)
      window.clearInterval(tick)
      document.removeEventListener('visibilitychange', onVisible)
      window.removeEventListener('online', onVisible)
    }
  }, [reloadRows, userId])

  // Trạng thái tức thời qua Realtime Presence.
  useEffect(() => {
    const client = supabase
    if (!client || !userId) return
    const platform = detectPlatform()
    const channel = client.channel('bvmsgtv-online-presence', { config: { presence: { key: userId } } })

    const syncState = () => {
      const state = channel.presenceState() as Record<string, LivePresence[]>
      const next: Record<string, LivePresence> = {}
      for (const [key, entries] of Object.entries(state)) {
        const latest = entries[entries.length - 1]
        next[key] = { user_id: latest?.user_id ?? key, platform: latest?.platform, online_at: latest?.online_at }
      }
      setLive(next)
    }

    channel
      .on('presence', { event: 'sync' }, syncState)
      .on('presence', { event: 'join' }, syncState)
      .on('presence', { event: 'leave' }, syncState)
      .subscribe(async (status: string) => {
        if (status === 'SUBSCRIBED') {
          setRealtimeConnected(true)
          try {
            await channel.track({ user_id: userId, role, platform, online_at: new Date().toISOString() })
          } catch {
            // Không track được thì vẫn dùng nhịp hoạt động trong bảng user_presence.
          }
        } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
          setRealtimeConnected(false)
        }
      })

    return () => {
      setRealtimeConnected(false)
      setLive({})
      void channel.untrack().catch(() => undefined)
      void client.removeChannel(channel)
    }
  }, [role, userId])

  const presenceOf = useCallback((id: string | null | undefined): PresenceInfo => {
    if (!id) return { online: false, lastSeenAt: null, platform: null }
    const liveEntry = live[id]
    const row = rows[id]
    const lastSeenAt = liveEntry ? new Date(now).toISOString() : row?.last_seen_at ?? null
    const recent = row ? now - new Date(row.last_seen_at).getTime() <= PRESENCE_ONLINE_WINDOW_MS : false
    const online = id === userId || Boolean(liveEntry) || recent
    const platform = (liveEntry?.platform ?? (row?.last_platform as PresencePlatform | null | undefined) ?? null)
    return { online, lastSeenAt: id === userId ? new Date(now).toISOString() : lastSeenAt, platform }
  }, [live, now, rows, userId])

  const onlineIds = useMemo(() => {
    const ids = new Set<string>(Object.keys(live))
    for (const row of Object.values(rows)) {
      if (now - new Date(row.last_seen_at).getTime() <= PRESENCE_ONLINE_WINDOW_MS) ids.add(row.user_id)
    }
    if (userId) ids.add(userId)
    return ids
  }, [live, now, rows, userId])

  const value = useMemo<PresenceContextValue>(() => ({
    onlineIds,
    onlineCount: onlineIds.size,
    realtimeConnected,
    presenceOf,
  }), [onlineIds, presenceOf, realtimeConnected])

  return <PresenceContext.Provider value={value}>{children}</PresenceContext.Provider>
}

export function usePresence() {
  const value = useContext(PresenceContext)
  if (!value) throw new Error('usePresence must be used inside PresenceProvider')
  return value
}
