import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const packageMode = process.argv.includes('--package')

const requiredFiles = [
  'package.json',
  'package-lock.json',
  'index.html',
  'vite.config.ts',
  '.env.example',
  '.gitignore',
  'public/manifest.webmanifest',
  'public/sw.js',
  'public/icons/icon-192.png',
  'public/icons/icon-512.png',
  'src/main.tsx',
  'src/App.tsx',
  'supabase/schema.sql',
  'supabase/functions/manage-user/index.ts',
  'supabase/functions/analyze-odometer/index.ts',
]

function assert(condition, message) {
  if (!condition) throw new Error(message)
}

for (const relative of requiredFiles) {
  assert(fs.existsSync(path.join(root, relative)), `Thiếu tệp bắt buộc: ${relative}`)
}

for (const relative of ['package.json', 'package-lock.json', 'public/manifest.webmanifest', 'tsconfig.json', 'tsconfig.app.json', 'tsconfig.node.json']) {
  JSON.parse(fs.readFileSync(path.join(root, relative), 'utf8'))
}

const manifest = JSON.parse(fs.readFileSync(path.join(root, 'public/manifest.webmanifest'), 'utf8'))
assert(manifest.display === 'standalone', 'PWA manifest phải dùng display=standalone')
assert(Array.isArray(manifest.icons) && manifest.icons.length >= 2, 'PWA manifest cần đủ icon')

const ignoredDirectories = new Set(['node_modules', 'dist', '.git', '.certs', '.service', '.temp'])
function walk(directory) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    if (entry.isDirectory() && ignoredDirectories.has(entry.name)) return []
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

// Khi kiểm tra gói ZIP/chia sẻ, tuyệt đối không cho đóng gói dữ liệu cục bộ hoặc bí mật.
if (packageMode) {
  const forbiddenInPackage = [
    '.env',
    '.env.local',
    '.env.production',
    'node_modules',
    'dist',
    '.git',
    '.certs',
    '.service',
    'create-website-user.mjs',
  ]
  for (const relative of forbiddenInPackage) {
    assert(!fs.existsSync(path.join(root, relative)), `Không được đóng gói: ${relative}`)
  }
}

// Trên máy phát triển được phép có .env và node_modules, nhưng .gitignore phải chặn chúng.
const gitignore = fs.readFileSync(path.join(root, '.gitignore'), 'utf8')
for (const expected of ['node_modules', 'dist', '.env']) {
  assert(gitignore.includes(expected), `.gitignore chưa chặn: ${expected}`)
}

const textExtensions = new Set(['.ts', '.tsx', '.js', '.mjs', '.json', '.md', '.txt', '.sql', '.toml', '.yml', '.yaml'])
const secretPatterns = [
  /sb_secret_[A-Za-z0-9_-]+/,
  /eyJ[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{10,}/,
  /(?:password|service[_-]?role|api[_-]?key)\s*[:=]\s*['"][^'"]{6,}['"]/i,
]
for (const file of walk(root)) {
  const relative = path.relative(root, file)
  if (relative === '.env.example' || relative.startsWith('.env')) continue
  if (!textExtensions.has(path.extname(file).toLowerCase())) continue
  const content = fs.readFileSync(file, 'utf8')
  assert(!secretPatterns.some((pattern) => pattern.test(content)), `Phát hiện chuỗi có thể là bí mật trong: ${relative}`)
}

const backendSource = fs.readFileSync(path.join(root, 'src/lib/backend.ts'), 'utf8')
assert(!backendSource.includes('demoBackend'), 'Production source không được chứa backend demo')
assert(backendSource.includes('phoneToInternalEmail'), 'Thiếu chuyển số điện thoại thành email nội bộ')
assert(backendSource.includes('signInWithPassword({ email, password })'), 'Supabase login phải dùng email nội bộ')

const manageUserSource = fs.readFileSync(path.join(root, 'supabase/functions/manage-user/index.ts'), 'utf8')
assert(manageUserSource.includes('email_confirm: true'), 'Edge Function phải xác nhận email nội bộ')
assert(manageUserSource.includes("login_method: 'internal_email'"), 'Edge Function thiếu metadata cơ chế đăng nhập')

const driverSource = fs.readFileSync(path.join(root, 'src/pages/DriverPage.tsx'), 'utf8')
assert(driverSource.includes('Xác nhận địa điểm xuất phát'), 'Thiếu bước xác nhận địa điểm trước chuyến')
assert(driverSource.includes('googleMapsDirectionsUrl'), 'Thiếu tích hợp Google Maps dẫn đường')

const odometerGeminiSource = fs.readFileSync(path.join(root, 'src/lib/odometerGemini.ts'), 'utf8')
assert(odometerGeminiSource.includes("functions.invoke('analyze-odometer'"), 'Thiếu gọi Edge Function Gemini OCR')
assert(!odometerGeminiSource.includes('GEMINI_API_KEY'), 'Frontend không được chứa Gemini API key')

const modeLabel = packageMode ? 'package verification' : 'source verification'
console.log(`Điều phối xe BVMSGTV ${modeLabel}: OK (${sourceFiles.length} tệp TypeScript)`)
