import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

// Chạy từ FULL SOURCE đã có v2.11.12. Không bao giờ chạy trong thư mục patch.
const root = process.cwd()
const patchDir = path.dirname(fileURLToPath(import.meta.url))
const cardRel = 'src/components/FleetVehicleCard.tsx'
const panelRel = 'src/components/TripGpsHistory.tsx'
const cssRel = 'src/styles/trip-gps-history.css'
const styleRel = 'src/styles.css'
const pkgRel = 'package.json'
const lockRel = 'package-lock.json'
const swRel = 'public/sw.js'
const at = (rel) => path.join(root, rel)

for (const file of [cardRel, styleRel, pkgRel, 'src/lib/supabase.ts', 'src/lib/utils.ts']) {
  if (!fs.existsSync(at(file))) throw new Error(`Thiếu ${file}. Chạy CMD tại FULL SOURCE đã áp dụng v2.11.12, không phải thư mục patch.`)
}
for (const file of [panelRel, cssRel]) {
  if (!fs.existsSync(path.join(patchDir, file))) throw new Error(`File patch không đầy đủ: ${file}. Hãy giải nén toàn bộ ZIP.`)
}
let card = fs.readFileSync(at(cardRel), 'utf8')
let styles = fs.readFileSync(at(styleRel), 'utf8')
const alreadyApplied = card.includes("import { TripGpsHistory } from './TripGpsHistory'")
if (!alreadyApplied) {
  const required = [
    "type Viewer = 'speed' | 'driver' | null",
    "{type === 'speed' ? 'GIÁM SÁT TỐC ĐỘ NAVICOM' : 'HỒ SƠ TÀI XẾ'}",
    "{type === 'speed' ? `Xe ${item.vehicle.plate_number}` : (driver?.full_name || 'Chưa phân công tài xế')}",
    "{type === 'speed' ? <>",
    "<div className=\"fleet-card-foot\">",
  ]
  for (const token of required) if (!card.includes(token)) {
    throw new Error('Không nhận diện được FleetVehicleCard v2.11.12 tại đoạn ' + token.slice(0, 55) + '. CHƯA thay đổi file nào; hãy gửi full source mới nhất để tích hợp an toàn.')
  }
  card = "import { TripGpsHistory } from './TripGpsHistory'\n" + card
  card = card.replace("type Viewer = 'speed' | 'driver' | null", "type Viewer = 'speed' | 'driver' | 'gps' | null")
  card = card.replace("{type === 'speed' ? 'GIÁM SÁT TỐC ĐỘ NAVICOM' : 'HỒ SƠ TÀI XẾ'}", "{type === 'speed' ? 'GIÁM SÁT TỐC ĐỘ NAVICOM' : type === 'gps' ? 'NHẬT KÝ HÀNH TRÌNH GPS' : 'HỒ SƠ TÀI XẾ'}")
  card = card.replace("{type === 'speed' ? `Xe ${item.vehicle.plate_number}` : (driver?.full_name || 'Chưa phân công tài xế')}", "{type === 'speed' || type === 'gps' ? `Xe ${item.vehicle.plate_number}` : (driver?.full_name || 'Chưa phân công tài xế')}")
  card = card.replace("{type === 'speed' ? <>", "{type === 'gps' ? <TripGpsHistory vehicleId={item.vehicle.id} plateNumber={item.vehicle.plate_number} /> : type === 'speed' ? <>")
  card = card.replace('<div className="fleet-card-foot">', '<button type="button" className="fleet-data-action fleet-gps-history-action" onClick={(event) => { event.stopPropagation(); setViewer(\'gps\') }}>Nhật ký GPS · Đầu chuyến / Cuối chuyến / Tốc độ cao nhất ↗</button>\n      <div className="fleet-card-foot">')
}
const importCss = "@import './styles/trip-gps-history.css';"
if (!styles.includes(importCss)) styles = importCss + '\n' + styles

const stamp = new Date().toISOString().replace(/[:.]/g, '-')
const backupDir = path.join(root, '_backup-v2.11.13-' + stamp)
for (const rel of [cardRel, panelRel, cssRel, styleRel, pkgRel, lockRel, swRel]) {
  if (!fs.existsSync(at(rel))) continue
  const to = path.join(backupDir, rel)
  fs.mkdirSync(path.dirname(to), { recursive: true })
  fs.copyFileSync(at(rel), to)
}
for (const rel of [panelRel, cssRel]) {
  fs.mkdirSync(path.dirname(at(rel)), { recursive: true })
  fs.copyFileSync(path.join(patchDir, rel), at(rel))
}
fs.writeFileSync(at(cardRel), card, 'utf8')
fs.writeFileSync(at(styleRel), styles, 'utf8')
for (const rel of [pkgRel, lockRel]) {
  if (!fs.existsSync(at(rel))) continue
  const data = JSON.parse(fs.readFileSync(at(rel), 'utf8'))
  data.version = '2.11.13'
  if (rel === lockRel && data.packages?.['']) data.packages[''].version = '2.11.13'
  fs.writeFileSync(at(rel), JSON.stringify(data, null, 2) + '\n')
}
if (fs.existsSync(at(swRel))) {
  const text = fs.readFileSync(at(swRel), 'utf8')
  fs.writeFileSync(at(swRel), text.replace(/dieu-phoi-xe-bvmsgtv-shell-v\d+[\w-]*/g, 'dieu-phoi-xe-bvmsgtv-shell-v21113-trip-gps-audit'))
}
console.log('✅ Đã tích hợp Nhật ký GPS theo xe trong thẻ xe, backup tại:', path.relative(root, backupDir))
console.log('⚠️ Phải chạy SQL migration và cài collector Ubuntu mới có dữ liệu thật (hướng dẫn trong README).')
console.log('npm.cmd run verify:source && npm.cmd run check && npm.cmd run build')
