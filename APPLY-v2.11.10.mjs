import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

/** Chạy trong thư mục FULL SOURCE hiện tại: node APPLY-v2.11.10.mjs */
const patchDir = path.dirname(fileURLToPath(import.meta.url))
const root = process.cwd()
const files = {
  tracking: path.join(root, 'src/pages/TrackingPage.tsx'),
  smooth: path.join(root, 'src/components/FleetSmoothMap.tsx'),
  styles: path.join(root, 'src/styles.css'),
  smoothCss: path.join(root, 'src/styles/fleet-smooth-map.css'),
  package: path.join(root, 'package.json'),
  lock: path.join(root, 'package-lock.json'),
  sw: path.join(root, 'public/sw.js'),
}
const sourceComponent = path.join(patchDir, 'src/components/FleetSmoothMap.tsx')
const sourceCss = path.join(patchDir, 'src/styles/fleet-smooth-map.css')

for (const file of [files.tracking, files.styles, files.package, sourceComponent, sourceCss]) {
  if (!fs.existsSync(file)) {
    console.error(`Không tìm thấy ${file}`)
    console.error('Hãy chạy script trong thư mục FULL SOURCE (có src, public, package.json).')
    process.exit(1)
  }
}

let tracking = fs.readFileSync(files.tracking, 'utf8')
const mapStart = tracking.indexOf('function FleetTileMap(')
const projectStart = tracking.indexOf('\nfunction project(', mapStart)
const tailStart = projectStart < 0 ? -1 : tracking.slice(projectStart).search(/\nfunction (?:fleetListPriority|vehicleWarnings)\(/)
if (mapStart >= 0 && projectStart < 0 && !tracking.includes('<FleetSmoothMap')) {
  throw new Error('Không tìm thấy project() sau FleetTileMap(). Hãy gửi TrackingPage.tsx mới nhất để vá đúng version.')
}
if (mapStart < 0 && !tracking.includes('<FleetSmoothMap')) {
  throw new Error('Không nhận diện được FleetTileMap() của v2.11.6–v2.11.9. Không thay file để tránh lỗi.')
}
if (mapStart >= 0 && projectStart >= 0 && tailStart < 0) {
  throw new Error('Không tìm thấy hàm kế tiếp sau project(). Không thay file để tránh làm mất logic khác.')
}

// Luôn kiểm tra đầy đủ TRƯỚC khi backup/ghi file.
let updated = tracking
if (mapStart >= 0 && projectStart >= 0) {
  const projectEnd = projectStart + tailStart
  const wrapper = `function FleetTileMap({ items, selectedVehicleId, onSelect }: { items: Array<ReturnType<typeof makeItemShape>>; selectedVehicleId: string; onSelect: (id: string) => void }) {\n  return <FleetSmoothMap items={items} selectedVehicleId={selectedVehicleId} onSelect={onSelect} />\n}\n`
  updated = updated.slice(0, mapStart) + wrapper + updated.slice(projectEnd)
}
if (!updated.includes("import { FleetSmoothMap } from '../components/FleetSmoothMap'")) {
  updated = "import { FleetSmoothMap } from '../components/FleetSmoothMap'\n" + updated
}
let styles = fs.readFileSync(files.styles, 'utf8')
const importCss = "@import './styles/fleet-smooth-map.css';"
if (!styles.includes(importCss)) {
  styles = styles.replace(/(@import[^\n]+;\s*)+/, (imports) => imports.trimEnd() + '\n' + importCss + '\n')
  if (!styles.includes(importCss)) styles = importCss + '\n' + styles
}

const stamp = new Date().toISOString().replace(/[:.]/g, '-').replace('T', '_')
const backupDir = path.join(root, `_backup-v2.11.10-${stamp}`)
for (const file of [files.tracking, files.smooth, files.styles, files.smoothCss, files.package, files.lock, files.sw]) {
  if (!fs.existsSync(file)) continue
  const target = path.join(backupDir, path.relative(root, file))
  fs.mkdirSync(path.dirname(target), { recursive: true })
  fs.copyFileSync(file, target)
}
fs.mkdirSync(path.dirname(files.smooth), { recursive: true })
fs.mkdirSync(path.dirname(files.smoothCss), { recursive: true })
fs.writeFileSync(files.tracking, updated, 'utf8')
fs.writeFileSync(files.styles, styles, 'utf8')
fs.copyFileSync(sourceComponent, files.smooth)
fs.copyFileSync(sourceCss, files.smoothCss)

const pkg = JSON.parse(fs.readFileSync(files.package, 'utf8'))
pkg.version = '2.11.10'
fs.writeFileSync(files.package, JSON.stringify(pkg, null, 2) + '\n')
if (fs.existsSync(files.lock)) {
  const lock = JSON.parse(fs.readFileSync(files.lock, 'utf8'))
  lock.version = '2.11.10'
  if (lock.packages?.['']) lock.packages[''].version = '2.11.10'
  fs.writeFileSync(files.lock, JSON.stringify(lock, null, 2) + '\n')
}
if (fs.existsSync(files.sw)) {
  const sw = fs.readFileSync(files.sw, 'utf8')
  fs.writeFileSync(files.sw, sw.replace(/dieu-phoi-xe-bvmsgtv-shell-v\d+[\w-]*/g, 'dieu-phoi-xe-bvmsgtv-shell-v21110-smooth-osm-map'))
}

console.log('✅ Đã nâng cấp bản đồ đội xe sang Leaflet tương tác mượt.')
console.log('✅ GPS Navicom, camera, thông báo, đăng nhập và phân quyền không thay đổi.')
console.log('✅ Đã tạo backup: ' + path.relative(root, backupDir))
console.log('✅ Không cần SQL migration và không cần update Navicom Gateway.')
console.log('Chạy: npm.cmd run verify:source && npm.cmd run check && npm.cmd run build')
