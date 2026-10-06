import fs from 'node:fs'
import path from 'node:path'
import process from 'node:process'

const root = process.cwd()
const envFiles = ['.env.local', '.env']
const values = {}

for (const name of envFiles) {
  const file = path.join(root, name)
  if (!fs.existsSync(file)) continue
  for (const rawLine of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
    const line = rawLine.trim()
    if (!line || line.startsWith('#')) continue
    const index = line.indexOf('=')
    if (index < 1) continue
    const key = line.slice(0, index).trim()
    let value = line.slice(index + 1).trim()
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) value = value.slice(1, -1)
    if (!(key in values)) values[key] = value
  }
}

function fail(message) {
  console.error(`\n[LOI] ${message}\n`)
  process.exit(1)
}

const major = Number(process.versions.node.split('.')[0])
if (!Number.isFinite(major) || major < 22) fail(`Node.js hiện tại là ${process.version}. Cần Node.js 22 trở lên.`)

const url = values.VITE_SUPABASE_URL?.trim()
const key = values.VITE_SUPABASE_ANON_KEY?.trim()
if (!url || /YOUR-PROJECT-REF/i.test(url)) fail('Chưa điền VITE_SUPABASE_URL trong .env.local.')
if (!/^https:\/\//i.test(url)) fail('VITE_SUPABASE_URL phải bắt đầu bằng https://')
if (!key || /YOUR_ANON|YOUR-PUBLISHABLE/i.test(key)) fail('Chưa điền VITE_SUPABASE_ANON_KEY trong .env.local.')

console.log('===============================================')
console.log('KIEM TRA LOCAL BVMSGTV: OK')
console.log('===============================================')
console.log(`Node.js       : ${process.version}`)
console.log(`Supabase URL  : ${url}`)
console.log('Supabase key  : da cau hinh')
console.log('Local desktop : http://localhost:5173')
if (values.VITE_PUBLIC_HTTPS_URL) console.log(`Mobile HTTPS  : ${values.VITE_PUBLIC_HTTPS_URL}`)
else console.log('Mobile HTTPS  : chua cau hinh (khong anh huong GPS Navicom; chi can khi test tinh nang trinh duyet can HTTPS)')
console.log('')
