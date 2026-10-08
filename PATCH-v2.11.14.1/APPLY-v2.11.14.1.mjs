import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

/** v2.11.14.1 — Khắc phục lỗi script 0/2 CameraPanel do JSX có thuộc tính key */
const root = process.cwd()
const patchDir = path.dirname(fileURLToPath(import.meta.url))
const trackingFile = path.join(root, 'src/pages/TrackingPage.tsx')
const cssFile = path.join(root, 'src/styles/tracking.css')
const manifestFile = path.join(root, 'package.json')
const swFile = path.join(root, 'public/sw.js')
const panelFile = path.join(patchDir, 'CameraPanel-v2.11.14.txt')
const panelCssFile = path.join(patchDir, 'tracking-camera-v2.11.14.css')

if (root === patchDir) throw new Error('Hãy mở CMD trong FULL SOURCE có src/ và package.json, không chạy trực tiếp tại PATCH.')
for (const file of [trackingFile, cssFile, manifestFile, panelFile, panelCssFile]) {
  if (!fs.existsSync(file)) throw new Error(`Thiếu file ${file}. Chưa thay đổi gì.`)
}

let tracking = fs.readFileSync(trackingFile, 'utf8')
let css = fs.readFileSync(cssFile, 'utf8')

const detailStart = tracking.indexOf('function VehicleCommandDetail(')
const panelStart = tracking.indexOf('function CameraPanel(', detailStart)
const panelEnd = tracking.indexOf('\nfunction FleetRealtimeMap(', panelStart)
if (detailStart < 0 || panelStart < 0 || panelEnd < 0 || !(detailStart < panelStart && panelStart < panelEnd)) {
  throw new Error('Không nhận diện được VehicleCommandDetail / CameraPanel / FleetRealtimeMap. CHƯA sửa file. Hãy gửi TrackingPage.tsx đang sử dụng.')
}

let detail = tracking.slice(detailStart, panelStart)
const cards = Array.from(detail.matchAll(/<CameraPanel\b[^>]*\/>/g)).map((m) => m[0])
const priorPanel = tracking.slice(panelStart, panelEnd)
const alreadyUpgraded = cards.length === 2 && cards.every((tag) => tag.includes('gpsStatus=') && tag.includes('gatewayError=')) && priorPanel.includes('manualRequested')
if (alreadyUpgraded) {
  console.log('Camera v2.11.14 đã được nâng cấp trước đó. Không cần áp dụng lại.')
  process.exit(0)
}

// Phân tích thuộc tính ĐỘC LẬP vị trí: chấp nhận <CameraPanel key={...} channel={...} ... deviceOnline={...}/>
// lẫn cú pháp không có key. Kiểm tra trước, KHÔNG tìm/thay nhầm thẻ camera khác.
const foundByChannel = new Map()
for (const tag of cards) {
  const channel = tag.match(/\bchannel=\{(front|cabin)\}/)?.[1]
  if (!channel || foundByChannel.has(channel)) {
    throw new Error(`Tìm thấy ${cards.length} thẻ CameraPanel nhưng không đủ hai kênh front/cabin duy nhất. CHƯA sửa file.`)
  }
  const label = channel === 'front' ? 'Camera trước' : 'Camera cabin'
  if (!tag.includes(`title="${label}"`)) {
    throw new Error(`Thẻ ${channel} có tên khác dự kiến. CHƯA sửa file.`)
  }
  if (!/\b(?:deviceOnline|vehicleOnline)=\{/.test(tag)) {
    throw new Error(`Thẻ ${channel} không có prop deviceOnline/vehicleOnline của phiên bản cũ. CHƯA sửa file.`)
  }
  foundByChannel.set(channel, tag)
}
if (cards.length !== 2 || !foundByChannel.has('front') || !foundByChannel.has('cabin')) {
  throw new Error(`Chỉ nhận diện ${foundByChannel.size}/2 thẻ CameraPanel đúng cấu trúc. CHƯA sửa file. Hãy gửi src/pages/TrackingPage.tsx.`)
}
if (!/\b(?:deviceOnline|vehicleOnline)\s*:\s*boolean\b/.test(priorPanel) && !priorPanel.includes('cameraCanPlay')) {
  throw new Error('Hàm CameraPanel khác phiên bản hỗ trợ. CHƯA sửa file. Hãy gửi src/pages/TrackingPage.tsx.')
}

for (const channel of ['front', 'cabin']) {
  const tag = foundByChannel.get(channel)
  const label = channel === 'front' ? 'Camera trước' : 'Camera cabin'
  const newTag = `<CameraPanel key={\`\${item.vehicle.id}:${channel}\`} channel={${channel}} title="${label}" gpsStatus={item.status} stateOnline={item.state?.online === true} gatewayError={item.error ?? null} />`
  detail = detail.replace(tag, newTag)
}

const cameraComponent = fs.readFileSync(panelFile, 'utf8').trimEnd()
let nextTracking = tracking.slice(0, detailStart) + detail + tracking.slice(panelStart)
const nextStart = nextTracking.indexOf('function CameraPanel(', detailStart)
const nextEnd = nextTracking.indexOf('\nfunction FleetRealtimeMap(', nextStart)
nextTracking = nextTracking.slice(0, nextStart) + cameraComponent + '\n' + nextTracking.slice(nextEnd)
if (!css.includes('v2.11.14: camera và GPS')) css += '\n' + fs.readFileSync(panelCssFile, 'utf8')

// Tất cả xác thực hoàn tất, bắt đầu sao lưu trước khi ghi file.
const stamp = new Date().toISOString().replace(/[:.]/g, '-')
const backupDir = path.join(root, `_backup-v2.11.14.1-${stamp}`)
for (const rel of ['src/pages/TrackingPage.tsx', 'src/styles/tracking.css', 'package.json', 'package-lock.json', 'public/sw.js']) {
  const file = path.join(root, rel)
  if (!fs.existsSync(file)) continue
  const backupFile = path.join(backupDir, rel)
  fs.mkdirSync(path.dirname(backupFile), {recursive: true})
  fs.copyFileSync(file, backupFile)
}

fs.writeFileSync(trackingFile, nextTracking, 'utf8')
fs.writeFileSync(cssFile, css, 'utf8')
for (const rel of ['package.json','package-lock.json']) {
  const file = path.join(root, rel)
  if (!fs.existsSync(file)) continue
  const obj = JSON.parse(fs.readFileSync(file, 'utf8'))
  obj.version = '2.11.14'
  if (rel === 'package-lock.json' && obj.packages?.['']) obj.packages[''].version = '2.11.14'
  fs.writeFileSync(file, JSON.stringify(obj,null,2)+'\n')
}
if (fs.existsSync(swFile)) {
  const sw = fs.readFileSync(swFile, 'utf8')
  fs.writeFileSync(swFile, sw.replace(/dieu-phoi-xe-bvmsgtv-shell-v\d+[\w-]*/g, 'dieu-phoi-xe-bvmsgtv-shell-v21114-gps-camera-separated'))
}
console.log('✅ Áp dụng thành công: nhận diện cả 2 CameraPanel (có/không có key).')
console.log('✅ GPS chậm không tự gắn nhãn Camera offline. Có thể thử phát camera thủ công khi Gateway phản hồi.')
console.log('✅ Backup:', path.relative(root, backupDir))
console.log('Chạy tiếp: npm.cmd run verify:source | npm.cmd run check | npm.cmd run build')
