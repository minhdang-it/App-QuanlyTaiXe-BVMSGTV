export type FocusTarget = 'requests' | 'dispatch' | 'expenses' | 'incidents' | 'maintenance'

const FOCUS_KEY = 'msg-car-navigation-focus'

export function queueNavigationFocus(target: FocusTarget, recordId?: string | null) {
  if (!recordId) return
  try {
    sessionStorage.setItem(FOCUS_KEY, JSON.stringify({ target, recordId, createdAt: Date.now() }))
  } catch {
    // sessionStorage may be unavailable in restricted browser modes.
  }
}

export function consumeNavigationFocus(target: FocusTarget): string | null {
  const url = new URL(window.location.href)
  const queryFocus = url.searchParams.get('focus')
  if (queryFocus) {
    url.searchParams.delete('focus')
    window.history.replaceState(window.history.state, '', `${url.pathname}${url.search}${url.hash}`)
    return queryFocus
  }

  try {
    const raw = sessionStorage.getItem(FOCUS_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as { target?: string; recordId?: string; createdAt?: number }
    if (parsed.target !== target) return null
    sessionStorage.removeItem(FOCUS_KEY)
    if (!parsed.recordId) return null
    if (parsed.createdAt && Date.now() - parsed.createdAt > 5 * 60 * 1000) return null
    return parsed.recordId
  } catch {
    return null
  }
}
