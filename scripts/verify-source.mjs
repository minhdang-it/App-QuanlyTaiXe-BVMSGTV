import fs from 'node:fs'
import path from 'node:path'

const root = path.resolve(new URL('..', import.meta.url).pathname)
const requiredFiles = [
  'package.json',
  'index.html',
  'vite.config.ts',
  'public/manifest.webmanifest',
  'public/sw.js',
  'public/icons/icon-192.png',
  'public/icons/icon-512.png',
  'src/main.tsx',
  'src/App.tsx',
  'supabase/schema.sql',
  'supabase/functions/manage-user/index.ts',
]

function assert(condition, message) {
  if (!condition) throw new Error(message)
}

for (const relative of requiredFiles) {
  assert(fs.existsSync(path.join(root, relative)), `Thiếu tệp bắt buộc: ${relative}`)
}

for (const relative of ['package.json', 'public/manifest.webmanifest', 'vercel.json', 'tsconfig.json', 'tsconfig.app.json', 'tsconfig.node.json']) {
  JSON.parse(fs.readFileSync(path.join(root, relative), 'utf8'))
}

const manifest = JSON.parse(fs.readFileSync(path.join(root, 'public/manifest.webmanifest'), 'utf8'))
assert(manifest.display === 'standalone', 'PWA manifest phải dùng display=standalone')
assert(Array.isArray(manifest.icons) && manifest.icons.length >= 2, 'PWA manifest cần đủ icon')

function walk(directory) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(directory, entry.name)
    return entry.isDirectory() ? walk(full) : [full]
  })
}

const sourceFiles = walk(path.join(root, 'src')).filter((file) => /\.(ts|tsx)$/.test(file))
const importPattern = /(?:from\s+|import\s*\()(['"])(\.[^'"]+)\1/g
for (const file of sourceFiles) {
  const content = fs.readFileSync(file, 'utf8')
  let match
  while ((match = importPattern.exec(content))) {
    const target = path.resolve(path.dirname(file), match[2])
    const candidates = [target, `${target}.ts`, `${target}.tsx`, `${target}.js`, `${target}.jsx`, path.join(target, 'index.ts'), path.join(target, 'index.tsx')]
    assert(candidates.some((candidate) => fs.existsSync(candidate)), `Import không tồn tại trong ${path.relative(root, file)}: ${match[2]}`)
  }
}

const pngSignature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
for (const relative of ['public/icons/icon-192.png', 'public/icons/icon-512.png']) {
  const header = fs.readFileSync(path.join(root, relative)).subarray(0, 8)
  assert(header.equals(pngSignature), `Icon không phải PNG hợp lệ: ${relative}`)
}

assert(!fs.existsSync(path.join(root, '.env')), 'Không được đóng gói tệp .env thật')
assert(!fs.existsSync(path.join(root, 'node_modules')), 'Không đóng gói node_modules')

const loginSource = fs.readFileSync(path.join(root, 'src/pages/LoginPage.tsx'), 'utf8')
assert(!loginSource.includes('Chọn nhanh tài khoản'), 'Màn hình đăng nhập không được chứa đăng nhập nhanh')
assert(!loginSource.includes('demoCredentials'), 'Màn hình đăng nhập không được tự điền tài khoản Demo')

const driverSource = fs.readFileSync(path.join(root, 'src/pages/DriverPage.tsx'), 'utf8')
assert(driverSource.includes('Xác nhận địa điểm xuất phát'), 'Thiếu bước xác nhận địa điểm trước chuyến')
assert(driverSource.includes('googleMapsDirectionsUrl'), 'Thiếu tích hợp Google Maps dẫn đường')
assert(driverSource.includes('start_lat: location.lat'), 'Thiếu lưu vĩ độ khi bắt đầu chuyến')
assert(driverSource.includes('start_lng: location.lng'), 'Thiếu lưu kinh độ khi bắt đầu chuyến')

console.log(`Điều phối xe BVMSGTV source verification: OK (${sourceFiles.length} tệp TypeScript)`)
