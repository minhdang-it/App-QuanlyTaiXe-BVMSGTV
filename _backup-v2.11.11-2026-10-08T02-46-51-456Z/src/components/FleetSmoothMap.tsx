import { useEffect, useMemo, useRef, useState } from 'react'

/**
 * Bản đồ đội xe dùng engine Leaflet thay cho lưới <img> tự dựng.
 * Vẽ bản đồ đúng một lần, sau đó cập nhật tọa độ marker tại chỗ mỗi lần GPS thay đổi.
 * Không sửa logic GPS/Navicom, camera, quyền hạn hay thông báo.
 */
type FleetStatus = 'moving' | 'stopped' | 'stale' | 'offline' | 'unknown'
type FleetSmoothMapItem = {
  vehicle: { id: string; plate_number: string }
  state: { gps: { lat?: number | null; lng?: number | null; speed_kph?: number | null; updated_at?: string | null } } | null
  status: FleetStatus
}

type Props = {
  items: FleetSmoothMapItem[]
  selectedVehicleId: string
  onSelect: (vehicleId: string) => void
}

type LeafletApi = any

type LeafletWindow = Window & {
  L?: LeafletApi
  __bvmsgtvLeafletLoader?: Promise<LeafletApi>
}

const STYLE_ID = 'bvmsgtv-leaflet-v119-style'
const SCRIPT_ID = 'bvmsgtv-leaflet-v119-script'
const LIBRARY_CDN = [
  'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.js',
  'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js',
]
const LIBRARY_CSS = 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.css'
const OSM_TILE = 'https://tile.openstreetmap.org/{z}/{x}/{y}.png'
const OSM_ATTRIBUTION = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
const STATUS: Record<FleetStatus, { label: string; color: string }> = {
  moving: { label: 'Đang chạy', color: '#2168bb' },
  stopped: { label: 'Đang dừng', color: '#11946d' },
  stale: { label: 'Chậm cập nhật', color: '#af7c12' },
  offline: { label: 'Offline', color: '#bb4f49' },
  unknown: { label: 'Chưa có dữ liệu', color: '#6b7975' },
}

function loadRemoteScript(src: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const script = document.createElement('script')
    script.src = src
    script.async = true
    script.id = SCRIPT_ID
    let done = false
    const timeout = window.setTimeout(() => {
      if (done) return
      done = true
      script.remove()
      reject(new Error('Tải thư viện bản đồ quá thời gian cho phép'))
    }, 12_000)
    script.onload = () => {
      if (done) return
      done = true
      clearTimeout(timeout)
      resolve()
    }
    script.onerror = () => {
      if (done) return
      done = true
      clearTimeout(timeout)
      script.remove()
      reject(new Error('Không thể tải thư viện bản đồ'))
    }
    document.head.appendChild(script)
  })
}

function loadLeaflet(): Promise<LeafletApi> {
  const w = window as LeafletWindow
  if (w.L?.map) return Promise.resolve(w.L)
  if (w.__bvmsgtvLeafletLoader) return w.__bvmsgtvLeafletLoader

  w.__bvmsgtvLeafletLoader = (async () => {
    if (!document.getElementById(STYLE_ID)) {
      const css = document.createElement('link')
      css.rel = 'stylesheet'
      css.id = STYLE_ID
      css.href = LIBRARY_CSS
      document.head.appendChild(css)
    }
    let lastError: unknown
    for (const src of LIBRARY_CDN) {
      try {
        await loadRemoteScript(src)
        if (w.L?.map) return w.L
      } catch (error) {
        lastError = error
      }
    }
    throw lastError instanceof Error ? lastError : new Error('Không tải được Leaflet')
  })().catch((error) => {
    // Cho phép người dùng bấm Thử lại khi mạng trở lại, không cache promise lỗi mãi mãi.
    delete w.__bvmsgtvLeafletLoader
    throw error
  })
  return w.__bvmsgtvLeafletLoader
}

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char] || char)
}

function markerIcon(L: LeafletApi, plate: string, status: FleetStatus, selected: boolean) {
  const color = STATUS[status].color
  return L.divIcon({
    className: 'bvmsgtv-leaflet-marker-host',
    html: `<div class="bvmsgtv-leaflet-marker ${selected ? 'is-selected' : ''}" style="--marker-color:${color}">
      <div class="bvmsgtv-leaflet-car">🚐</div>
      <span class="bvmsgtv-leaflet-plate">${escapeHtml(plate)}</span>
    </div>`,
    iconSize: [100, 57],
    iconAnchor: [50, 55],
  })
}

function validPosition(item: FleetSmoothMapItem): item is FleetSmoothMapItem & { state: { gps: { lat: number; lng: number } } } {
  const lat = item.state?.gps.lat
  const lng = item.state?.gps.lng
  return typeof lat === 'number' && Number.isFinite(lat) && Math.abs(lat) <= 90 &&
    typeof lng === 'number' && Number.isFinite(lng) && Math.abs(lng) <= 180
}

export function FleetSmoothMap({ items, selectedVehicleId, onSelect }: Props) {
  const rootRef = useRef<HTMLDivElement | null>(null)
  const mapRef = useRef<any>(null)
  const layersRef = useRef<Map<string, { marker: any; plate: string; status: FleetStatus; selected: boolean }>>(new Map())
  const onSelectRef = useRef(onSelect)
  const selectedRef = useRef(selectedVehicleId)
  const previousSelectionRef = useRef<string>('')
  const [ready, setReady] = useState(false)
  const [error, setError] = useState('')
  const [tileError, setTileError] = useState('')
  const [retryCount, setRetryCount] = useState(0)
  const [follow, setFollow] = useState(false)
  const located = useMemo(() => items.filter(validPosition), [items])
  onSelectRef.current = onSelect
  selectedRef.current = selectedVehicleId

  // Khởi tạo duy nhất khi mount. Không tạo lại bản đồ khi GPS cập nhật mỗi 5 giây.
  useEffect(() => {
    let disposed = false
    let observer: ResizeObserver | undefined
    let wheelHandler: ((event: WheelEvent) => void) | undefined

    void loadLeaflet().then((L) => {
      if (disposed || !rootRef.current) return
      const root = rootRef.current
      if (mapRef.current) return
      const map = L.map(root, {
        center: [9.934, 106.32],
        zoom: 14,
        zoomControl: false,
        scrollWheelZoom: false,
        touchZoom: true,
        dragging: true,
        inertia: true,
        zoomAnimation: true,
        fadeAnimation: true,
        markerZoomAnimation: true,
        zoomSnap: 0.5,
        attributionControl: true,
        preferCanvas: true,
      })
      mapRef.current = map
      // Dùng nguồn chính thức OpenStreetMap ngay từ đầu, không cần API key.
      // Không dùng CARTO: server có thể trả ảnh chứa chữ "API KEY REQUIRED" với HTTP 200,
      // khiến sự kiện tileerror không kích hoạt và cơ chế fallback cũ bị vô hiệu.
      const tileLayer = L.tileLayer(OSM_TILE, {
        attribution: OSM_ATTRIBUTION,
        maxZoom: 19,
        minZoom: 3,
        updateWhenIdle: true,
        keepBuffer: 2,
        detectRetina: false,
      }).addTo(map)
      let consecutiveTileErrors = 0
      tileLayer.on('tileload', () => {
        consecutiveTileErrors = 0
        if (!disposed) setTileError('')
      })
      tileLayer.on('tileerror', () => {
        consecutiveTileErrors += 1
        if (consecutiveTileErrors >= 3 && !disposed) {
          setTileError('Không tải được ảnh bản đồ từ OpenStreetMap. Kiểm tra kết nối Internet hoặc chính sách mạng nội bộ.')
        }
      })
      L.control.zoom({ position: 'topright' }).addTo(map)
      L.control.scale({ metric: true, imperial: false, position: 'bottomleft' }).addTo(map)
      wheelHandler = (event: WheelEvent) => {
        // Giữ Ctrl + lăn chuột mới zoom, lăn thường cuộn trang.
        if (!event.ctrlKey) return
        event.preventDefault()
        const nextZoom = map.getZoom() + (event.deltaY < 0 ? 0.5 : -0.5)
        map.setZoomAround(map.mouseEventToContainerPoint(event), Math.max(3, Math.min(19, nextZoom)), { animate: true })
      }
      root.addEventListener('wheel', wheelHandler, { passive: false })
      if (typeof ResizeObserver !== 'undefined') {
        observer = new ResizeObserver(() => map.invalidateSize({ pan: false }))
        observer.observe(root)
      }
      setReady(true)
      setError('')
      setTileError('')
      window.setTimeout(() => { if (!disposed && mapRef.current === map) map.invalidateSize({ pan: false }) }, 80)
    }).catch((cause) => {
      if (!disposed) setError(cause instanceof Error ? cause.message : 'Không tải được thư viện bản đồ')
    })

    return () => {
      disposed = true
      observer?.disconnect()
      if (wheelHandler && rootRef.current) rootRef.current.removeEventListener('wheel', wheelHandler)
      for (const entry of layersRef.current.values()) entry.marker.off()
      layersRef.current.clear()
      if (mapRef.current) {
        mapRef.current.remove()
        mapRef.current = null
      }
    }
  }, [retryCount])

  // Cập nhật marker KHÔNG dựng lại tile/background và KHÔNG zoom về mặc định mỗi 5 giây.
  useEffect(() => {
    if (!ready || !mapRef.current) return
    const map = mapRef.current
    const L = (window as LeafletWindow).L
    if (!L) return
    const nextIds = new Set<string>()

    for (const item of located) {
      const id = item.vehicle.id
      const latLng: [number, number] = [item.state.gps.lat, item.state.gps.lng]
      nextIds.add(id)
      const selected = selectedVehicleId === id
      const old = layersRef.current.get(id)
      if (old) {
        old.marker.setLatLng(latLng)
        if (old.status !== item.status || old.selected !== selected || old.plate !== item.vehicle.plate_number) {
          old.marker.setIcon(markerIcon(L, item.vehicle.plate_number, item.status, selected))
          old.status = item.status
          old.selected = selected
          old.plate = item.vehicle.plate_number
        }
      } else {
        const marker = L.marker(latLng, {
          icon: markerIcon(L, item.vehicle.plate_number, item.status, selected),
          keyboard: true,
          riseOnHover: true,
          title: `${item.vehicle.plate_number} · ${STATUS[item.status].label}`,
        }).addTo(map)
        marker.on('click', () => onSelectRef.current(id))
        layersRef.current.set(id, { marker, status: item.status, plate: item.vehicle.plate_number, selected })
      }
    }

    for (const [id, entry] of layersRef.current.entries()) {
      if (!nextIds.has(id)) {
        map.removeLayer(entry.marker)
        layersRef.current.delete(id)
      }
    }

    // Fit toàn đội xe MỘT lần, tránh kéo bản đồ về giữa liên tục khi nhận GPS.
    if (!(map as any).__bvmsgtvInitialFitDone && located.length) {
      ;(map as any).__bvmsgtvInitialFitDone = true
      if (located.length === 1) map.setView([located[0].state.gps.lat, located[0].state.gps.lng], 15, { animate: false })
      else {
        const bounds = L.latLngBounds(located.map((item) => [item.state.gps.lat, item.state.gps.lng]))
        map.fitBounds(bounds, { padding: [38, 38], maxZoom: 15, animate: false })
      }
    }

    if (selectedVehicleId && selectedVehicleId !== previousSelectionRef.current) {
      const selected = located.find((item) => item.vehicle.id === selectedVehicleId)
      if (selected) map.panTo([selected.state.gps.lat, selected.state.gps.lng], { animate: true, duration: 0.6 })
    } else if (follow) {
      const selected = located.find((item) => item.vehicle.id === selectedRef.current)
      if (selected) {
        map.panTo([selected.state.gps.lat, selected.state.gps.lng], { animate: true, duration: 0.6 })
      }
    }
    previousSelectionRef.current = selectedVehicleId
  }, [ready, located, selectedVehicleId, follow])

  function resetView() {
    const map = mapRef.current
    const L = (window as LeafletWindow).L
    if (!map || !L || !located.length) return
    if (located.length === 1) map.flyTo([located[0].state.gps.lat, located[0].state.gps.lng], 15, { duration: 0.7 })
    else map.flyToBounds(L.latLngBounds(located.map((item) => [item.state.gps.lat, item.state.gps.lng])), { padding: [35, 35], maxZoom: 15, duration: 0.7 })
  }

  async function toggleFullscreen() {
    const node = rootRef.current?.parentElement
    if (!node) return
    try {
      if (document.fullscreenElement) await document.exitFullscreen()
      else await node.requestFullscreen()
    } catch { /* iOS Safari không bắt buộc hỗ trợ Fullscreen API trên div */ }
    window.setTimeout(() => mapRef.current?.invalidateSize({ pan: false }), 150)
  }

  return <div className="fleet-map-shell fleet-smooth-map-shell">
    <div className="fleet-smooth-map-frame">
      <div className="fleet-smooth-map-surface" ref={rootRef} aria-label="Bản đồ xe realtime sử dụng dữ liệu OpenStreetMap" />
      {(!ready || error) && <div className="fleet-map-progress">
        {error ? <><strong>Chưa tải được bản đồ tương tác</strong><span>{error}</span><button type="button" onClick={() => { setReady(false); setError(''); setRetryCount((v) => v + 1) }}>Thử lại</button></>
          : <><span className="fleet-smooth-map-spinner" /><strong>Đang tải bản đồ...</strong></>}
      </div>}
      {ready && tileError && <div role="status" className="fleet-smooth-tile-error">{tileError}</div>}
      {ready && <div className="fleet-smooth-map-toolbar">
        <button type="button" onClick={resetView} title="Căn lại bản đồ đội xe">⌖</button>
        <button type="button" onClick={() => setFollow((current) => !current)} title="Theo vị trí xe đang chọn" className={follow ? 'is-following' : ''}>◎</button>
        <button type="button" onClick={() => void toggleFullscreen()} title="Toàn màn hình bản đồ">⛶</button>
      </div>}
      {ready && <div className="fleet-smooth-map-tip"><span className="desktop">Ctrl + lăn chuột để zoom</span><span className="mobile">Chụm 2 ngón tay để zoom</span></div>}
      {ready && <div className="fleet-map-legend fleet-smooth-map-legend">
        <span><i className="moving" /> Đang chạy</span><span><i className="stopped" /> Đang dừng</span><span><i className="offline" /> Offline</span>
      </div>}
    </div>
  </div>
}
