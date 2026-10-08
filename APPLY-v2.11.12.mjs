import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

// LƯU Ý: thực thi tại THƯ MỤC FULL SOURCE, không chạy ở thư mục bản vá.
const root = process.cwd()
const patchDir = path.dirname(fileURLToPath(import.meta.url))
const trackingRel = 'src/pages/TrackingPage.tsx'
const componentRel = 'src/components/FleetVehicleCard.tsx'
const stylesRel = 'src/styles.css'
const cssRel = 'src/styles/fleet-card-interactions.css'
const pkgRel = 'package.json'
const lockRel = 'package-lock.json'
const swRel = 'public/sw.js'
const sourcePaths = [componentRel, cssRel].map((rel) => path.join(patchDir, rel))
const p = (rel) => path.join(root, rel)

for (const rel of [trackingRel, stylesRel, pkgRel]) {
  if (!fs.existsSync(p(rel))) throw new Error(`Đang ở sai thư mục source hoặc thiếu: ${p(rel)}. Chạy CMD trong thư mục FULL SOURCE có package.json.`)
}
for (const file of sourcePaths) {
  if (!fs.existsSync(file)) throw new Error(`Thiếu file patch: ${file}. Hãy giải nén trọn bộ ZIP trước khi chạy.`)
}

const rawTracking = fs.readFileSync(p(trackingRel), 'utf8')
if (rawTracking.includes("import { FleetVehicleCard } from '../components/FleetVehicleCard'")) {
  console.log('Đã áp dụng v2.11.12 từ trước; không chỉnh lại TrackingPage.')
} else {
  const start = rawTracking.indexOf('function VehicleLiveCard(')
  const candidates = [rawTracking.indexOf('\n// Helper', start), rawTracking.indexOf('\nfunction makeItemShape(', start)].filter((n) => n > start)
  const end = candidates.length ? Math.min(...candidates) : -1
  if (start < 0 || end < 0 || !rawTracking.slice(start, end).includes('fleet-vehicle-card')) {
    throw new Error('Không nhận diện được cấu trúc VehicleLiveCard của source hiện tại. CHƯA sửa file nào. Hãy gửi TrackingPage.tsx đang dùng để tích hợp đúng.')
  }
}

// Chuẩn bị dữ liệu trước khi ghi. Nếu cấu trúc không tương thích sẽ dừng mà không sửa source.
let nextTracking = rawTracking
if (!nextTracking.includes("import { FleetVehicleCard } from '../components/FleetVehicleCard'")) {
  const start = nextTracking.indexOf('function VehicleLiveCard(')
  const candidates = [nextTracking.indexOf('\n// Helper', start), nextTracking.indexOf('\nfunction makeItemShape(', start)].filter((n) => n > start)
  const end = Math.min(...candidates)
  const replace = `function VehicleLiveCard({ item, selected, onSelect }: { item: ReturnType<typeof makeItemShape>; selected: boolean; onSelect: () => void }) {
  return <FleetVehicleCard item={item} selected={selected} onSelect={onSelect} />
}
`
  nextTracking = nextTracking.slice(0, start) + replace + nextTracking.slice(end)
  nextTracking = "import { FleetVehicleCard } from '../components/FleetVehicleCard'\n" + nextTracking
}
let nextStyles = fs.readFileSync(p(stylesRel), 'utf8')
const importCss = "@import './styles/fleet-card-interactions.css';"
if (!nextStyles.includes(importCss)) {
  nextStyles = importCss + '\n' + nextStyles
}

// Backup: tạo trước khi thay đổi.
const stamp = new Date().toISOString().replace(/[:.]/g, '-')
const backupRoot = path.join(root, `_backup-v2.11.12-${stamp}`)
for (const rel of [trackingRel, componentRel, stylesRel, cssRel, pkgRel, lockRel, swRel]) {
  if (!fs.existsSync(p(rel))) continue
  const dest = path.join(backupRoot, rel)
  fs.mkdirSync(path.dirname(dest), { recursive: true })
  fs.copyFileSync(p(rel), dest)
}
fs.writeFileSync(p(trackingRel), nextTracking, 'utf8')
fs.writeFileSync(p(stylesRel), nextStyles, 'utf8')
for (const rel of [componentRel, cssRel]) {
  fs.mkdirSync(path.dirname(p(rel)), { recursive: true })
  fs.copyFileSync(path.join(patchDir, rel), p(rel))
}
for (const rel of [pkgRel,lockRel]) {
  if (!fs.existsSync(p(rel))) continue
  const data = JSON.parse(fs.readFileSync(p(rel), 'utf8'))
  data.version = '2.11.12'
  if (rel === lockRel && data.packages?.['']) data.packages[''].version = '2.11.12'
  fs.writeFileSync(p(rel), JSON.stringify(data, null, 2) + '\n')
}
if (fs.existsSync(p(swRel))) {
  const sw = fs.readFileSync(p(swRel), 'utf8')
  const next = sw.replace(/dieu-phoi-xe-bvmsgtv-shell-v\d+[\w-]*/g, 'dieu-phoi-xe-bvmsgtv-shell-v21112-fleet-card-interactions')
  fs.writeFileSync(p(swRel), next, 'utf8')
}
console.log('✅ v2.11.12: Tốc độ mở đồng hồ lớn, tài xế mở hồ sơ, tọa độ mở Google Maps.')
console.log('✅ Không sửa Navicom Gateway, database và bản đồ OpenStreetMap.')
console.log('✅ Backup:', path.relative(root, backupRoot))
console.log('Chạy: npm.cmd run verify:source && npm.cmd run check && npm.cmd run build')
