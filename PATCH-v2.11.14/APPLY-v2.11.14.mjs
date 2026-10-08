import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = process.cwd()
const patchDir = path.dirname(fileURLToPath(import.meta.url))
const trackingFile = path.join(root, 'src/pages/TrackingPage.tsx')
const cssFile = path.join(root, 'src/styles/tracking.css')
const manifestFile = path.join(root, 'package.json')
const swFile = path.join(root, 'public/sw.js')
const panelFile = path.join(patchDir, 'CameraPanel-v2.11.14.txt')
const panelCssFile = path.join(patchDir, 'tracking-camera-v2.11.14.css')

if (root === patchDir) throw new Error('Mở CMD tại thư mục FULL SOURCE (có package.json), không chạy trong thư mục PATCH.')
for (const file of [trackingFile,cssFile,manifestFile,panelFile,panelCssFile]) {
  if (!fs.existsSync(file)) throw new Error(`Thiếu file ${file}. Chưa thay đổi gì.`)
}
let tracking = fs.readFileSync(trackingFile,'utf8')
let css = fs.readFileSync(cssFile,'utf8')
const panelStart = tracking.indexOf('function CameraPanel(')
const panelEnd = tracking.indexOf('\nfunction FleetRealtimeMap(', panelStart)
if (panelStart === -1 || panelEnd === -1) throw new Error('Không tìm thấy CameraPanel + FleetRealtimeMap đúng cấu trúc. CHƯA sửa file. Hãy gửi source hiện tại.')
if (!tracking.includes('function VehicleCommandDetail(')) throw new Error('Không tìm thấy VehicleCommandDetail.')
if (tracking.includes('tracking-camera-v2.11.14') || tracking.includes('manualRequested') && tracking.includes('cameraTitle')) {
  console.log('Bản vá camera v2.11.14 đã có. Không áp dụng lại.')
  process.exit(0)
}
let detailStart = tracking.indexOf('function VehicleCommandDetail(')
let detail = tracking.slice(detailStart,panelStart)
let replacements = 0
for (const [which,title] of [['front','Camera trước'],['cabin','Camera cabin']]) {
  const re = new RegExp(`<CameraPanel\\s+channel=\\{${which}\\}\\s+title="${title}"\\s+deviceOnline=\\{[^}]*\\}\\s*/>`)
  const next = `<CameraPanel key={\`\${item.vehicle.id}:${which}\`} channel={${which}} title="${title}" gpsStatus={item.status} stateOnline={item.state?.online === true} gatewayError={item.error ?? null} />`
  if (re.test(detail)) {
    detail = detail.replace(re,next)
    replacements += 1
  }
}
if (replacements !== 2) throw new Error(`Chỉ tìm thấy ${replacements}/2 CameraPanel cũ. CHƯA thay file. Hãy gửi TrackingPage.tsx để sửa đúng bản.`)
tracking = tracking.slice(0, detailStart) + detail + tracking.slice(panelStart)
const panelStart2 = tracking.indexOf('function CameraPanel(')
const panelEnd2 = tracking.indexOf('\nfunction FleetRealtimeMap(', panelStart2)
tracking = tracking.slice(0,panelStart2) + fs.readFileSync(panelFile,'utf8').trimEnd() + '\n' + tracking.slice(panelEnd2)
if (!css.includes('v2.11.14: camera và GPS')) css += '\n' + fs.readFileSync(panelCssFile,'utf8')

const stamp = new Date().toISOString().replaceAll(':','-').replaceAll('.','-')
const backupDir = path.join(root,`_backup-v2.11.14-${stamp}`)
const backupFiles = ['src/pages/TrackingPage.tsx','src/styles/tracking.css','package.json','package-lock.json','public/sw.js']
for (const relative of backupFiles) {
  const file = path.join(root,relative)
  if (!fs.existsSync(file)) continue
  const target = path.join(backupDir,relative)
  fs.mkdirSync(path.dirname(target),{recursive:true})
  fs.copyFileSync(file,target)
}
fs.writeFileSync(trackingFile,tracking,'utf8')
fs.writeFileSync(cssFile,css,'utf8')
for (const relative of ['package.json','package-lock.json']) {
  const file = path.join(root,relative)
  if (!fs.existsSync(file)) continue
  const value=JSON.parse(fs.readFileSync(file,'utf8'))
  value.version='2.11.14'
  if(relative==='package-lock.json' && value.packages?.['']) value.packages[''].version='2.11.14'
  fs.writeFileSync(file,JSON.stringify(value,null,2)+'\n')
}
if(fs.existsSync(swFile)){
  const sw=fs.readFileSync(swFile,'utf8')
  fs.writeFileSync(swFile,sw.replace(/dieu-phoi-xe-bvmsgtv-shell-v\d+[\w-]*/g,'dieu-phoi-xe-bvmsgtv-shell-v21114-gps-camera-separated'))
}
console.log('OK: Tách trạng thái GPS và khả năng mở camera cho màn Theo dõi xe.')
console.log('OK: GPS chậm cập nhật không tự kết luận camera Offline.')
console.log('OK: Khi chưa thể xác minh camera, người dùng có thể chủ động thử mở luồng trong web.')
console.log('Backup:',path.relative(root,backupDir))
console.log('Chạy: npm.cmd run verify:source && npm.cmd run check && npm.cmd run build')
