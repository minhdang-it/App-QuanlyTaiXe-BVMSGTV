import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = process.cwd()
const patchDir = path.dirname(fileURLToPath(import.meta.url))
const trackingFile = path.join(root, 'src/pages/TrackingPage.tsx')
const versionFile = path.join(root, 'package.json')
const lockFile = path.join(root, 'package-lock.json')
const swFile = path.join(root, 'public/sw.js')
const componentFile = path.join(patchDir, 'CameraPanel-auto-v2.11.14.2.txt')

if (root === patchDir) throw new Error('Chạy ở FULL SOURCE (có src/pages/TrackingPage.tsx và package.json), không chạy trong PATCH.')
for (const file of [trackingFile, versionFile, componentFile]) {
  if (!fs.existsSync(file)) throw new Error(`Thiếu file: ${file}. CHƯA thay đổi gì.`)
}

const tracking = fs.readFileSync(trackingFile, 'utf8')
const panelStart = tracking.indexOf('function CameraPanel(')
const panelEnd = tracking.indexOf('\nfunction FleetRealtimeMap(', panelStart)
if (panelStart < 0 || panelEnd < 0) throw new Error('Không nhận dạng CameraPanel / FleetRealtimeMap. CHƯA thay file. Gửi TrackingPage.tsx hiện tại.')
const oldPanel = tracking.slice(panelStart, panelEnd)
if (tracking.includes('// CameraPanel-auto-v2.11.14.2')) {
  console.log('Đã cài v2.11.14.2 trước đó. Không cập nhật lại.'); process.exit(0)
}
if (!(oldPanel.includes('gpsStatus: FleetStatus') && oldPanel.includes('gatewayError: string | null'))) {
  throw new Error('CameraPanel không phải dạng của v2.11.14.1. CHƯA thay file. Hãy cập nhật v2.11.14.1 trước hoặc gửi TrackingPage.tsx.')
}
const replacement = fs.readFileSync(componentFile, 'utf8').trimEnd()
if (!replacement.includes('sandbox="allow-scripts') || replacement.includes('Thử mở camera')) {
  throw new Error('Component mới không hợp lệ. CHƯA thay file.')
}
const nextTracking = tracking.slice(0, panelStart) + '// CameraPanel-auto-v2.11.14.2\n' + replacement + '\n' + tracking.slice(panelEnd)
// Chỉ backup rồi ghi khi tất cả kiểm tra cấu trúc đã hoàn tất.
const stamp = new Date().toISOString().replace(/[:.]/g, '-')
const backupDir = path.join(root, `_backup-v2.11.14.2-${stamp}`)
for (const rel of ['src/pages/TrackingPage.tsx', 'package.json', 'package-lock.json', 'public/sw.js']) {
  const src = path.join(root, rel)
  if (!fs.existsSync(src)) continue
  const dst = path.join(backupDir, rel)
  fs.mkdirSync(path.dirname(dst), { recursive: true })
  fs.copyFileSync(src, dst)
}
fs.writeFileSync(trackingFile, nextTracking, 'utf8')
for (const file of [versionFile, lockFile]) {
  if (!fs.existsSync(file)) continue
  const data = JSON.parse(fs.readFileSync(file, 'utf8'))
  data.version = '2.11.14.2'
  if (file === lockFile && data.packages?.['']) data.packages[''].version = '2.11.14.2'
  fs.writeFileSync(file, JSON.stringify(data, null, 2) + '\n')
}
if (fs.existsSync(swFile)) {
  const old = fs.readFileSync(swFile, 'utf8')
  fs.writeFileSync(swFile, old.replace(/dieu-phoi-xe-bvmsgtv-shell-v\d+[\w-]*/g, 'dieu-phoi-xe-bvmsgtv-shell-v211142-camera-auto'))
}
console.log('✅ Camera trước và camera cabin tự tải khi có URL, Gateway phản hồi và kênh không được báo offline.')
console.log('✅ Bỏ nút Thử mở camera / Tắt xem. GPS chậm không khóa camera.')
console.log('✅ Sandbox chặn JS modals trong iframe (có thể hạn chế một số chức năng CMSV6, cần thử thực tế).')
console.log('✅ Backup:', path.relative(root, backupDir))
console.log('Chạy: npm.cmd run verify:source && npm.cmd run check && npm.cmd run build')
