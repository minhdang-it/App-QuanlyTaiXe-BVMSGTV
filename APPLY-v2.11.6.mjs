import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const patchDir = path.dirname(fileURLToPath(import.meta.url))
const root = process.cwd()
const files = {
  tracking: path.join(root, 'src/pages/TrackingPage.tsx'),
  watcher: path.join(root, 'src/components/NavicomFleetWatcher.tsx'),
  css: path.join(root, 'src/styles/tracking.css'),
  pkg: path.join(root, 'package.json'),
  lock: path.join(root, 'package-lock.json'),
  sw: path.join(root, 'public/sw.js'),
}

for (const file of [files.tracking, files.watcher, files.css, files.pkg]) {
  if (!fs.existsSync(file)) throw new Error(`Không tìm thấy file bắt buộc: ${path.relative(root, file)}`)
}

const stamp = new Date().toISOString().replace(/[:.]/g, '-').replace('T', '_').replace('Z', '')
const backupDir = path.join(root, `_backup-v2.11.6-${stamp}`)
for (const file of Object.values(files)) {
  if (!fs.existsSync(file)) continue
  const rel = path.relative(root, file)
  const target = path.join(backupDir, rel)
  fs.mkdirSync(path.dirname(target), { recursive: true })
  fs.copyFileSync(file, target)
}

const write = (file, text) => fs.writeFileSync(file, text.replace(/\r?\n/g, '\n'), 'utf8')

// 1. Tắt notification khi offline.
let watcher = fs.readFileSync(files.watcher, 'utf8')
if (!watcher.includes("event.type === 'offline'")) {
  const candidates = [
    [
      "          storeNavicomEvent(event)\n          pushNotification({",
      "          // v2.11.6: Offline chỉ hiển thị trên màn Theo dõi xe; không phát toast/chuông.\n          if (event.type === 'offline') continue\n          storeNavicomEvent(event)\n          pushNotification({"
    ],
    [
      "        storeNavicomEvent(event)\n        pushNotification({",
      "        // v2.11.6: Offline chỉ hiển thị trên màn Theo dõi xe; không phát toast/chuông.\n        if (event.type === 'offline') continue\n        storeNavicomEvent(event)\n        pushNotification({"
    ]
  ]
  let done = false
  for (const [needle, replacement] of candidates) {
    if (watcher.includes(needle)) {
      watcher = watcher.replace(needle, replacement)
      done = true
      break
    }
  }
  if (!done) throw new Error('Không nhận diện được khối phát notification trong NavicomFleetWatcher.tsx.')
  write(files.watcher, watcher)
}

// 2. Online lên đầu danh sách.
let tracking = fs.readFileSync(files.tracking, 'utf8')
if (!tracking.includes('fleetListPriority(')) {
  const close = "    })\n  }, [filter, fleetItems, search])"
  const sorted = `    }).sort((a, b) => {\n      const priority = fleetListPriority(a.status) - fleetListPriority(b.status)\n      if (priority !== 0) return priority\n      const aTime = new Date(a.state?.gps.updated_at || a.state?.updated_at || 0).getTime() || 0\n      const bTime = new Date(b.state?.gps.updated_at || b.state?.updated_at || 0).getTime() || 0\n      if (aTime !== bTime) return bTime - aTime\n      return a.vehicle.plate_number.localeCompare(b.vehicle.plate_number, 'vi')\n    })\n  }, [filter, fleetItems, search])`
  if (!tracking.includes(close)) throw new Error('Không nhận diện được khối lọc danh sách xe trong TrackingPage.tsx.')
  tracking = tracking.replace(close, sorted)
  const anchor = '\nfunction vehicleWarnings('
  const helper = `\nfunction fleetListPriority(status: FleetStatus) {\n  if (status === 'moving') return 0\n  if (status === 'stopped') return 1\n  if (status === 'stale') return 2\n  if (status === 'offline') return 3\n  return 4\n}\n`
  if (!tracking.includes(anchor)) throw new Error('Không tìm thấy vị trí chèn fleetListPriority().')
  tracking = tracking.replace(anchor, helper + anchor)
}

// 2b. Ẩn luôn các bản ghi offline cũ khỏi khối Hoạt động gần đây.
tracking = tracking.replace("useState<FleetEvent[]>(() => loadNavicomEvents())", "useState<FleetEvent[]>(() => loadNavicomEvents().filter((event) => event.type !== 'offline'))")
tracking = tracking.replace("setEvents(loadNavicomEvents())", "setEvents(loadNavicomEvents().filter((event) => event.type !== 'offline'))")

// 3. Map Ctrl+wheel + pinch 2 ngón.
const mapStart = tracking.indexOf('function FleetTileMap(')
const mapEnd = tracking.indexOf('\nfunction project(', mapStart)
if (mapStart < 0 || mapEnd < 0) throw new Error('Không tìm thấy FleetTileMap() của v2.11.5.')
const mapText = fs.readFileSync(path.join(patchDir, 'TrackingMap-v2.11.6.txt'), 'utf8').trimEnd()
tracking = tracking.slice(0, mapStart) + mapText + tracking.slice(mapEnd)
write(files.tracking, tracking)

let css = fs.readFileSync(files.css, 'utf8')
if (!css.includes('v2.11.6 tracking gestures')) {
  css += fs.readFileSync(path.join(patchDir, 'tracking-v2.11.6.css.txt'), 'utf8')
  write(files.css, css)
}

// 4. Version/cache.
const pkg = JSON.parse(fs.readFileSync(files.pkg, 'utf8'))
pkg.version = '2.11.6'
write(files.pkg, JSON.stringify(pkg, null, 2) + '\n')
if (fs.existsSync(files.lock)) {
  const lock = JSON.parse(fs.readFileSync(files.lock, 'utf8'))
  lock.version = '2.11.6'
  if (lock.packages?.['']) lock.packages[''].version = '2.11.6'
  write(files.lock, JSON.stringify(lock, null, 2) + '\n')
}
if (fs.existsSync(files.sw)) {
  let sw = fs.readFileSync(files.sw, 'utf8')
  sw = sw.replace(/dieu-phoi-xe-bvmsgtv-shell-v\d+[\w-]*/g, 'dieu-phoi-xe-bvmsgtv-shell-v2116-tracking-ux')
  write(files.sw, sw)
}

console.log('✅ Áp dụng v2.11.6 thành công.')
console.log(`✅ Backup: ${path.relative(root, backupDir)}`)
console.log('Chạy tiếp:')
console.log('npm.cmd run verify:source')
console.log('npm.cmd run check')
console.log('npm.cmd run build')
