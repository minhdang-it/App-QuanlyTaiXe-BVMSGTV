import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

// Chạy trong thư mục FULL SOURCE: node APPLY-v2.11.11.mjs
const patchDir = path.dirname(fileURLToPath(import.meta.url))
const root = process.cwd()
const paths = [
  ['src/components/FleetSmoothMap.tsx', true],
  ['src/styles/fleet-smooth-map.css', true],
  ['public/sw.js', false],
  ['package.json', false],
  ['package-lock.json', false],
]
const mapPath = path.join(root, 'src/components/FleetSmoothMap.tsx')
const trackingPath = path.join(root, 'src/pages/TrackingPage.tsx')
const patchSource = path.join(patchDir, 'src/components/FleetSmoothMap.tsx')

if (root === patchDir) {
  console.error('Hãy chạy script trong FULL SOURCE, không chạy trong thư mục PATCH.')
  process.exit(1)
}
for (const file of [mapPath, trackingPath, patchSource, path.join(root, 'package.json')]) {
  if (!fs.existsSync(file)) {
    console.error(`Thiếu ${file}. Hãy sử dụng full source đã cập nhật v2.11.10.`)
    process.exit(1)
  }
}
const mapText = fs.readFileSync(mapPath, 'utf8')
const tracking = fs.readFileSync(trackingPath, 'utf8')
if (!mapText.includes('export function FleetSmoothMap') || !tracking.includes('FleetSmoothMap')) {
  console.error('Source chưa khớp v2.11.10. Chưa thay file nào; hãy gửi TrackingPage.tsx và FleetSmoothMap.tsx hiện tại.')
  process.exit(1)
}
if (!mapText.includes('basemaps.cartocdn.com') && mapText.includes("tile.openstreetmap.org")) {
  console.log('Bản đồ đã được chuyển sang OpenStreetMap; vẫn áp dụng file sửa cảm ứng và cache mới.')
}
const stamp = new Date().toISOString().replace(/[:.]/g, '-')
const backup = path.join(root, `_backup-v2.11.11-${stamp}`)
for (const [rel, required] of paths) {
  const from = path.join(root, rel)
  if (required && !fs.existsSync(from)) {
    console.error(`Thiếu file bắt buộc ${from}. Không áp dụng bản vá.`)
    process.exit(1)
  }
}
for (const [rel] of paths) {
  const current = path.join(root, rel)
  if (!fs.existsSync(current)) continue
  const copied = path.join(backup, rel)
  fs.mkdirSync(path.dirname(copied), { recursive: true })
  fs.copyFileSync(current, copied)
}
for (const rel of ['src/components/FleetSmoothMap.tsx', 'src/styles/fleet-smooth-map.css']) {
  const target = path.join(root, rel)
  fs.mkdirSync(path.dirname(target), { recursive: true })
  fs.copyFileSync(path.join(patchDir, rel), target)
}
for (const rel of ['package.json', 'package-lock.json']) {
  const target = path.join(root, rel)
  if (!fs.existsSync(target)) continue
  const obj = JSON.parse(fs.readFileSync(target, 'utf8'))
  obj.version = '2.11.11'
  if (rel === 'package-lock.json' && obj.packages?.['']) obj.packages[''].version = '2.11.11'
  fs.writeFileSync(target, `${JSON.stringify(obj, null, 2)}\n`)
}
const sw = path.join(root, 'public/sw.js')
if (fs.existsSync(sw)) {
  let content = fs.readFileSync(sw, 'utf8')
  const changed = content.replace(/dieu-phoi-xe-bvmsgtv-shell-v\d+[\w-]*/g, 'dieu-phoi-xe-bvmsgtv-shell-v21111-osm-tile-fixed')
  if (changed === content) console.warn('Chú ý: không tìm thấy tên cache chuẩn trong sw.js; vui lòng kiểm tra SW sau build.')
  else fs.writeFileSync(sw, changed, 'utf8')
}
console.log('✓ Đã thay CARTO bằng OpenStreetMap chính thức (không API key).')
console.log('✓ Leaflet giữ nguyên marker GPS, Ctrl + lăn chuột và zoom hai ngón tay.')
console.log(`✓ Đã sao lưu vào: ${path.relative(root, backup)}`)
console.log('✓ Không cần SQL và không cần cập nhật Navicom Gateway.')
console.log('Tiếp theo: npm.cmd run verify:source && npm.cmd run check && npm.cmd run build')
