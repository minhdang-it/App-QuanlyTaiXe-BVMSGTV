import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

// Hotfix chỉ đổi dữ liệu MOCK của bài kiểm thử. Không giảm mức bảo vệ của verify-source.
const root = process.cwd()
const dir = path.dirname(fileURLToPath(import.meta.url))
const testName = 'collector-mock-test.mjs'
const safeFixture = path.join(dir, 'tests', testName)
const packageFile = path.join(root, 'package.json')
const required = [packageFile, path.join(root, 'scripts', 'verify-source.mjs')]
if (!required.every((f) => fs.existsSync(f))) {
  throw new Error('Phải chạy trong FULL SOURCE có package.json và scripts/verify-source.mjs, không chạy từ Downloads hay thư mục patch.')
}
if (!fs.existsSync(safeFixture)) throw new Error('Thiếu tệp mock-test đã sửa. Hãy giải nén đủ ZIP.')
const replacement = fs.readFileSync(safeFixture, 'utf8')
if (!replacement.includes('MOCK COLLECTOR TEST PASSED') || !replacement.includes('demoServiceKey')) {
  throw new Error('Tệp mock-test trong patch không hợp lệ; không chỉnh source.')
}
const skipped = new Set(['node_modules', 'dist', '.git', 'build', '.next'])
const found = []
function scan(directory, depth = 0) {
  if (depth > 7) return
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    if (entry.isSymbolicLink()) continue
    const full = path.join(directory, entry.name)
    if (entry.isDirectory()) {
      if (!skipped.has(entry.name) && !entry.name.startsWith('_backup-')) scan(full, depth + 1)
    } else if (entry.isFile() && entry.name === testName) {
      found.push(full)
    }
  }
}
scan(root)
const targets = found.filter((file) => path.resolve(file) !== path.resolve(safeFixture))
if (!targets.length) throw new Error('Không tìm thấy tests/collector-mock-test.mjs trong FULL SOURCE. Kiểm tra đã áp dụng v2.11.13 chưa.')
const stamp = new Date().toISOString().replace(/[:.]/g, '-')
const backup = path.resolve(root, '..', `BVMSGTV-backup-mock-test-${stamp}`)
let modified = 0
for (const target of targets) {
  const current = fs.readFileSync(target, 'utf8')
  if (!current.includes('MOCK COLLECTOR TEST PASSED')) {
    console.warn('Bỏ qua file không đúng bài test:', path.relative(root, target))
    continue
  }
  if (current === replacement) {
    console.log('Đã sạch:', path.relative(root, target))
    continue
  }
  const rel = path.relative(root, target)
  const previous = path.join(backup, rel)
  fs.mkdirSync(path.dirname(previous), { recursive: true })
  fs.copyFileSync(target, previous)
  fs.writeFileSync(target, replacement, 'utf8')
  modified++
  console.log('Đã sửa:', rel)
}
console.log('Tổng số file được chỉnh:', modified)
if (modified) console.log('Backup ở ngoài full source:', backup)
console.log('Tiếp theo: npm.cmd run verify:source')
