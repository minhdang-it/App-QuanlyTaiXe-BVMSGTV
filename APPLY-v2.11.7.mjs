import fs from 'node:fs'
import path from 'node:path'

const root = process.cwd()
const files = {
  tracking: path.join(root, 'src/pages/TrackingPage.tsx'),
  monitor: path.join(root, 'src/components/NavicomMonitor.tsx'),
  presence: path.join(root, 'src/components/Presence.tsx'),
  trackingCss: path.join(root, 'src/styles/tracking.css'),
  baseCss: path.join(root, 'src/styles/base.css'),
  shellCss: path.join(root, 'src/styles/shell.css'),
  pkg: path.join(root, 'package.json'),
  lock: path.join(root, 'package-lock.json'),
  sw: path.join(root, 'public/sw.js'),
}

for (const file of [files.tracking, files.monitor, files.trackingCss, files.pkg]) {
  if (!fs.existsSync(file)) throw new Error(`Không tìm thấy file bắt buộc: ${path.relative(root, file)}`)
}

const stamp = new Date().toISOString().replace(/[:.]/g, '-').replace('T', '_').replace('Z', '')
const backupDir = path.join(root, `_backup-v2.11.7-${stamp}`)
for (const file of Object.values(files)) {
  if (!fs.existsSync(file)) continue
  const rel = path.relative(root, file)
  const dest = path.join(backupDir, rel)
  fs.mkdirSync(path.dirname(dest), { recursive: true })
  fs.copyFileSync(file, dest)
}
const write = (file, text) => fs.writeFileSync(file, text.replace(/\r?\n/g, '\n'), 'utf8')

// -----------------------------------------------------------------------------
// 1) TrackingPage: không load iframe Navicom khi xe offline.
//    Đây là cách xử lý đúng vì alert "The Device Isn't Online!" phát ra từ iframe
//    cross-origin của Navicom; app không thể chặn alert đó sau khi iframe đã chạy.
// -----------------------------------------------------------------------------
let tracking = fs.readFileSync(files.tracking, 'utf8')

// Nhãn rõ ràng hơn: "Offline" thay cho "Mất tín hiệu" ở UI theo dõi.
tracking = tracking.replace("offline: { label: 'Mất tín hiệu'", "offline: { label: 'Offline'")
tracking = tracking.replace(/label="Mất tín hiệu"/g, 'label="Xe offline"')
tracking = tracking.replace(/\['offline', 'Mất tín hiệu'/g, "['offline', 'Offline'")
tracking = tracking.replace(/<i className="offline" \/> Mất tín hiệu/g, '<i className="offline" /> Offline')

const detailStart = tracking.indexOf('function VehicleCommandDetail(')
const cameraStart = tracking.indexOf('function CameraPanel(', detailStart)
if (detailStart < 0 || cameraStart < 0) throw new Error('Không tìm thấy VehicleCommandDetail/CameraPanel trong TrackingPage.tsx.')
let detail = tracking.slice(detailStart, cameraStart)
if (!detail.includes('cameraDeviceOnline')) {
  if (!detail.includes('const status = STATUS_META[item.status]')) throw new Error('Không tìm thấy STATUS_META trong VehicleCommandDetail.')
  detail = detail.replace(
    '  const status = STATUS_META[item.status]\n',
    "  const status = STATUS_META[item.status]\n  const cameraDeviceOnline = (item.status === 'moving' || item.status === 'stopped') && !item.error\n"
  )
}
detail = detail.replace(/<CameraPanel channel=\{front\} title="Camera trước" \/>/g, '<CameraPanel channel={front} title="Camera trước" vehicleOnline={cameraDeviceOnline} />')
detail = detail.replace(/<CameraPanel channel=\{cabin\} title="Camera cabin" \/>/g, '<CameraPanel channel={cabin} title="Camera cabin" vehicleOnline={cameraDeviceOnline} />')
tracking = tracking.slice(0, detailStart) + detail + tracking.slice(cameraStart)

// CameraPanel signature.
tracking = tracking.replace(
  "function CameraPanel({ channel, title }: { channel: NavicomVehicleState['channels'][number] | null; title: string }) {",
  "function CameraPanel({ channel, title, vehicleOnline }: { channel: NavicomVehicleState['channels'][number] | null; title: string; vehicleOnline: boolean }) {"
)
if (!tracking.includes('vehicleOnline: boolean')) throw new Error('Không cập nhật được signature CameraPanel().')

// Không hiển thị link Navicom khi offline.
tracking = tracking.replace(
  '{channel?.external_url && <a href={channel.external_url} target="_blank" rel="noreferrer">Mở riêng</a>}',
  '{vehicleOnline && channel?.online !== false && channel?.external_url && <a href={channel.external_url} target="_blank" rel="noreferrer">Mở riêng</a>}'
)

// Thay toàn bộ frame player bằng bản có gate offline. Không mount iframe => không còn popup từ camnd10.navicom.vn.
const panelStart = tracking.indexOf('function CameraPanel(')
const panelEnd = tracking.indexOf('\nfunction FleetRealtimeMap', panelStart) > 0
  ? tracking.indexOf('\nfunction FleetRealtimeMap', panelStart)
  : tracking.indexOf('\nfunction FleetTileMap', panelStart)
if (panelEnd < 0) throw new Error('Không xác định được điểm kết thúc CameraPanel().')
let panel = tracking.slice(panelStart, panelEnd)
const frameStart = panel.indexOf('    <div className="fleet-camera-frame">')
let frameEnd = panel.indexOf('\n    {expanded && forceLandscape', frameStart)
if (frameEnd < 0) frameEnd = panel.indexOf('\n  </article>', frameStart)
if (frameStart < 0 || frameEnd < 0) throw new Error('Không nhận diện được fleet-camera-frame trong CameraPanel().')
const newFrame = `    <div className={\`fleet-camera-frame \${!vehicleOnline || channel?.online === false ? 'is-offline' : ''}\`}>
      {!vehicleOnline ? <div className="fleet-camera-offline"><span><Icon name="cloud-off" size={26} /></span><strong>Xe đang offline</strong><small>Camera tạm ngưng để tránh mở trang Navicom khi thiết bị ngoại tuyến.</small></div>
        : channel?.online === false ? <div className="fleet-camera-offline"><span><Icon name="cloud-off" size={26} /></span><strong>Kênh camera ngoại tuyến</strong><small>GPS xe vẫn có thể hoạt động nhưng kênh camera này chưa sẵn sàng.</small></div>
          : channel?.player_url ? <iframe title={title} src={channel.player_url} allow="autoplay; fullscreen; picture-in-picture" />
            : channel?.hls_url ? <video src={channel.hls_url} controls autoPlay muted playsInline />
              : channel?.snapshot_url ? <img src={channel.snapshot_url} alt={title} />
                : <div className="fleet-camera-unavailable"><Icon name="camera" size={24} /><strong>{title} chưa khả dụng</strong><span>Gateway chưa cung cấp URL video.</span></div>}
    </div>`
panel = panel.slice(0, frameStart) + newFrame + panel.slice(frameEnd)
tracking = tracking.slice(0, panelStart) + panel + tracking.slice(panelEnd)
write(files.tracking, tracking)

// -----------------------------------------------------------------------------
// 2) NavicomMonitor (Hồ sơ xe): cùng nguyên tắc, chỉ load camera khi GPS Navicom
//    còn mới hoặc channel xác nhận online. Tránh popup cross-origin ở mọi màn.
// -----------------------------------------------------------------------------
let monitor = fs.readFileSync(files.monitor, 'utf8')
if (!monitor.includes('navicomStateIsFresh(')) {
  const viewerMarker = '\nfunction CameraViewer('
  if (!monitor.includes(viewerMarker)) throw new Error('Không tìm thấy CameraViewer trong NavicomMonitor.tsx.')
  const helper = `\nfunction navicomStateIsFresh(state: NavicomVehicleState | null | undefined) {\n  const value = state?.gps.updated_at || state?.updated_at\n  if (!value) return false\n  const stamp = new Date(value).getTime()\n  return Number.isFinite(stamp) && Date.now() - stamp <= 2 * 60_000\n}\n`
  monitor = monitor.replace(viewerMarker, helper + viewerMarker)
}
if (!/<CameraViewer[^>]*deviceOnline=/.test(monitor)) {
  const tagMatch = monitor.match(/<CameraViewer\s+channels=\{state\??\.channels \?\? \[\]\}\s+mode=\{cameraMode\}\s+onMode=\{setCameraMode\}\s*\/>/)
  if (!tagMatch) throw new Error('Không nhận diện được thẻ CameraViewer trong NavicomMonitor.tsx.')
  monitor = monitor.replace(tagMatch[0], tagMatch[0].replace(' />', ' deviceOnline={navicomStateIsFresh(state)} />'))
}
monitor = monitor.replace(
  "function CameraViewer({ channels, mode, onMode }: { channels: NavicomCameraChannel[]; mode: 'both' | 'front' | 'cabin'; onMode: (mode: 'both' | 'front' | 'cabin') => void }) {",
  "function CameraViewer({ channels, mode, onMode, deviceOnline }: { channels: NavicomCameraChannel[]; mode: 'both' | 'front' | 'cabin'; onMode: (mode: 'both' | 'front' | 'cabin') => void; deviceOnline: boolean }) {"
)
monitor = monitor.replace(/<NavicomCameraPane channel=\{front\} fallbackLabel="Camera trước" \/>/g, '<NavicomCameraPane channel={front} fallbackLabel="Camera trước" deviceOnline={deviceOnline} />')
monitor = monitor.replace(/<NavicomCameraPane channel=\{cabin\} fallbackLabel="Camera cabin" \/>/g, '<NavicomCameraPane channel={cabin} fallbackLabel="Camera cabin" deviceOnline={deviceOnline} />')
monitor = monitor.replace(
  'function NavicomCameraPane({ channel, fallbackLabel }: { channel: NavicomCameraChannel | null; fallbackLabel: string }) {',
  'function NavicomCameraPane({ channel, fallbackLabel, deviceOnline }: { channel: NavicomCameraChannel | null; fallbackLabel: string; deviceOnline: boolean }) {'
)
monitor = monitor.replace(
  '{channel?.external_url && <a href={channel.external_url} target="_blank" rel="noreferrer">Mở riêng</a>}',
  '{deviceOnline && channel?.online !== false && channel?.external_url && <a href={channel.external_url} target="_blank" rel="noreferrer">Mở riêng</a>}'
)
const paneStart = monitor.indexOf('function NavicomCameraPane(')
if (paneStart >= 0) {
  const playerStart = monitor.indexOf('    <div className="navicom-player">', paneStart)
  let playerEnd = monitor.indexOf('\n    {expanded && forceLandscape', playerStart)
  if (playerEnd < 0) playerEnd = monitor.indexOf('\n  </article>', playerStart)
  if (playerStart >= 0 && playerEnd >= 0) {
    const player = `    <div className={\`navicom-player \${!deviceOnline || channel?.online === false ? 'is-offline' : ''}\`}>
      {!deviceOnline ? <div className="navicom-camera-offline"><Icon name="cloud-off" size={22} /><strong>Xe đang offline</strong><span>Không mở luồng camera Navicom khi thiết bị ngoại tuyến.</span></div>
        : channel?.online === false ? <div className="navicom-camera-offline"><Icon name="cloud-off" size={22} /><strong>Kênh camera ngoại tuyến</strong><span>Vui lòng thử lại khi thiết bị có tín hiệu.</span></div>
          : channel?.player_url ? <iframe title={\`Camera \${label}\`} src={channel.player_url} allow="autoplay; fullscreen; picture-in-picture" />
            : channel?.hls_url ? <video src={channel.hls_url} controls autoPlay muted playsInline />
              : channel?.snapshot_url ? <img src={channel.snapshot_url} alt={\`Camera \${label}\`} />
                : <div className="navicom-camera-empty"><Icon name="camera" size={18} /><strong>{label} chưa khả dụng</strong><span>Gateway chưa cung cấp URL video.</span></div>}
    </div>`
    monitor = monitor.slice(0, playerStart) + player + monitor.slice(playerEnd)
  }
}
write(files.monitor, monitor)

// -----------------------------------------------------------------------------
// 3) Làm rõ "x tài khoản" ở topbar, tránh nhầm với số xe online.
// -----------------------------------------------------------------------------
if (fs.existsSync(files.presence)) {
  let presence = fs.readFileSync(files.presence, 'utf8')
  presence = presence.replace('<span className="online-users-label">trực tuyến</span>', '<span className="online-users-label">tài khoản</span>')
  write(files.presence, presence)
}

// -----------------------------------------------------------------------------
// 4) UI mobile: typography, touch target, camera offline state, tracking layout.
// -----------------------------------------------------------------------------
const trackingCssAppend = `

/* ==== v2.11.7 mobile-first tracking + offline camera ==== */
.fleet-camera-frame.is-offline,.navicom-player.is-offline{background:#f4f7f6!important}
.fleet-camera-offline,.navicom-camera-offline{min-height:190px;display:grid;place-items:center;align-content:center;gap:6px;padding:22px;text-align:center;color:var(--muted);background:linear-gradient(180deg,#f8fbfa,#eef4f2)}
.fleet-camera-offline>span{width:46px;height:46px;display:grid;place-items:center;border-radius:14px;background:#fff0ef;color:#bd4237;border:1px solid #f0d0cc}
.fleet-camera-offline strong,.navicom-camera-offline strong{font-size:13px;color:var(--text)}
.fleet-camera-offline small,.navicom-camera-offline span{max-width:330px;font-size:11px;line-height:1.5;color:var(--muted)}

@media(max-width:820px){
  .fleet-command-page{gap:10px}
  .fleet-command-hero{padding:12px 14px;border-radius:14px}
  .fleet-command-hero>div>span{font-size:9.5px}
  .fleet-command-hero h2{font-size:19px;line-height:1.2}
  .fleet-command-hero p{font-size:12px;line-height:1.45}
  .fleet-metric-grid{grid-template-columns:repeat(2,minmax(0,1fr));gap:8px}
  .fleet-metric{min-height:72px;padding:10px 11px}
  .fleet-metric strong{font-size:20px}
  .fleet-metric small{font-size:10.5px;line-height:1.3}
  .fleet-toolbar{padding:9px;border-radius:14px;gap:9px}
  .fleet-filter-tabs{gap:6px;padding-bottom:2px}
  .fleet-filter-tabs button{min-height:40px;padding:8px 11px;font-size:11px}
  .fleet-search{min-height:44px;border-radius:12px}
  .fleet-search input{font-size:16px!important}
  .fleet-command-layout{grid-template-columns:1fr;gap:10px}
  .fleet-card-list{display:flex;overflow-x:auto;max-height:none;padding:9px;scroll-snap-type:x mandatory;gap:8px}
  .fleet-vehicle-card{flex:0 0 min(86vw,340px);scroll-snap-align:start;padding:12px}
  .fleet-card-head>div strong{font-size:14px}
  .fleet-card-head>div small,.fleet-card-data b{font-size:11px}
  .fleet-map-viewport{height:310px;border-radius:14px}
  .fleet-map-zoom button{width:42px;height:40px}
  .fleet-map-gesture-hint{font-size:10px;max-width:70%;overflow:hidden;text-overflow:ellipsis}
  .fleet-detail-panel{padding:11px;border-radius:14px}
  .fleet-detail-summary{grid-template-columns:repeat(2,minmax(0,1fr));gap:7px}
  .fleet-detail-summary span{font-size:9.5px}
  .fleet-detail-summary strong{font-size:12px}
  .fleet-camera-heading{display:grid;gap:9px}
  .fleet-camera-switch{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));width:100%}
  .fleet-camera-switch button{min-height:42px;font-size:10.5px;padding:6px}
  .fleet-dual-camera{grid-template-columns:1fr;gap:9px}
  .fleet-camera-card header{min-height:44px;padding:8px 10px}
  .fleet-camera-actions button,.navicom-camera-actions button{min-height:38px;font-size:10.5px}
  .fleet-camera-frame{min-height:205px}
  .fleet-event strong{font-size:12px}.fleet-event small{font-size:11px;line-height:1.45}.fleet-event time{font-size:10px}
}
@media(max-width:430px){
  .fleet-command-hero p{display:none}
  .fleet-metric-grid{gap:6px}
  .fleet-metric{min-height:66px}
  .fleet-map-viewport{height:285px}
  .fleet-vehicle-card{flex-basis:88vw}
  .fleet-camera-frame{min-height:185px}
}
`
let trackingCss = fs.readFileSync(files.trackingCss, 'utf8')
if (!trackingCss.includes('v2.11.7 mobile-first tracking')) trackingCss += trackingCssAppend
write(files.trackingCss, trackingCss)

if (fs.existsSync(files.baseCss)) {
  let base = fs.readFileSync(files.baseCss, 'utf8')
  if (!base.includes('v2.11.7 mobile readability')) base += `

/* ==== v2.11.7 mobile readability ==== */
@media(max-width:820px){
  .page-content{padding-left:10px;padding-right:10px;gap:12px}
  .panel-header{padding:13px 14px;gap:10px}
  .panel-header h2{font-size:15px;line-height:1.3}
  .panel-header p{font-size:12px;line-height:1.45}
  input,select,textarea{font-size:16px}
  .form-grid{gap:12px}
  .form-actions{gap:8px}
  .form-actions button{min-height:44px}
}
`
  write(files.baseCss, base)
}
if (fs.existsSync(files.shellCss)) {
  let shell = fs.readFileSync(files.shellCss, 'utf8')
  if (!shell.includes('v2.11.7 mobile navigation')) shell += `

/* ==== v2.11.7 mobile navigation ==== */
@media(max-width:820px){
  .mobile-nav button{min-height:54px;padding-top:6px;padding-bottom:6px}
  .mobile-nav button small{font-size:11px;line-height:1.15}
  .mobile-nav-icon{width:46px;height:30px}
  .mobile-more-grid button{min-height:84px}
  .mobile-more-grid button strong{font-size:12.5px}
}
`
  write(files.shellCss, shell)
}

// -----------------------------------------------------------------------------
// 5) Version + service worker cache.
// -----------------------------------------------------------------------------
const pkg = JSON.parse(fs.readFileSync(files.pkg, 'utf8'))
pkg.version = '2.11.7'
write(files.pkg, JSON.stringify(pkg, null, 2) + '\n')
if (fs.existsSync(files.lock)) {
  const lock = JSON.parse(fs.readFileSync(files.lock, 'utf8'))
  lock.version = '2.11.7'
  if (lock.packages?.['']) lock.packages[''].version = '2.11.7'
  write(files.lock, JSON.stringify(lock, null, 2) + '\n')
}
if (fs.existsSync(files.sw)) {
  let sw = fs.readFileSync(files.sw, 'utf8')
  sw = sw.replace(/dieu-phoi-xe-bvmsgtv-shell-v\d+[\w-]*/g, 'dieu-phoi-xe-bvmsgtv-shell-v2117-mobile-offline-camera')
  write(files.sw, sw)
}

console.log('✅ Áp dụng v2.11.7 thành công.')
console.log('✅ Sửa popup Navicom khi xe offline bằng cách không mount iframe offline.')
console.log('✅ Nâng readability/touch target cho mobile.')
console.log(`✅ Backup: ${path.relative(root, backupDir)}`)
console.log('Chạy tiếp:')
console.log('npm.cmd run verify:source')
console.log('npm.cmd run check')
console.log('npm.cmd run build')
