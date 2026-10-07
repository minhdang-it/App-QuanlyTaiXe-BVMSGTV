export type CameraFullscreenResult = {
  nativeFullscreen: boolean
  orientationLocked: boolean
}

type FullscreenElementCompat = HTMLElement & {
  webkitRequestFullscreen?: () => Promise<void> | void
}

type FullscreenDocumentCompat = Document & {
  webkitFullscreenElement?: Element | null
  webkitExitFullscreen?: () => Promise<void> | void
}

type OrientationCompat = ScreenOrientation & {
  lock?: (orientation: 'landscape') => Promise<void>
  unlock?: () => void
}

export function fullscreenElement() {
  const doc = document as FullscreenDocumentCompat
  return document.fullscreenElement ?? doc.webkitFullscreenElement ?? null
}

export async function enterLandscapeFullscreen(element: HTMLElement): Promise<CameraFullscreenResult> {
  let nativeFullscreen = false
  try {
    const compat = element as FullscreenElementCompat
    if (element.requestFullscreen) {
      await element.requestFullscreen({ navigationUI: 'hide' })
      nativeFullscreen = true
    } else if (compat.webkitRequestFullscreen) {
      await compat.webkitRequestFullscreen()
      nativeFullscreen = true
    }
  } catch {
    nativeFullscreen = false
  }

  let orientationLocked = false
  try {
    const orientation = screen.orientation as OrientationCompat | undefined
    if (orientation?.lock) {
      await orientation.lock('landscape')
      orientationLocked = true
    }
  } catch {
    orientationLocked = false
  }

  return { nativeFullscreen, orientationLocked }
}

export async function exitLandscapeFullscreen() {
  try {
    const orientation = screen.orientation as OrientationCompat | undefined
    orientation?.unlock?.()
  } catch { /* Safari/iOS có thể không hỗ trợ */ }

  try {
    const doc = document as FullscreenDocumentCompat
    if (document.fullscreenElement && document.exitFullscreen) await document.exitFullscreen()
    else if (doc.webkitFullscreenElement && doc.webkitExitFullscreen) await doc.webkitExitFullscreen()
  } catch { /* bỏ qua để vẫn thoát lớp fullscreen CSS */ }
}
