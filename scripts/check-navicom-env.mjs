import fs from 'node:fs'
import path from 'node:path'
import process from 'node:process'

const file = path.join(process.cwd(), '.env.navicom.local')
if (!fs.existsSync(file)) {
  console.error('\n[LOI] Chua co .env.navicom.local. Hay chay SETUP-NAVICOM-LOCAL.cmd.\n')
  process.exit(1)
}
const values = {}
for (const raw of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
  const line = raw.trim()
  if (!line || line.startsWith('#')) continue
  const i = line.indexOf('=')
  if (i < 1) continue
  values[line.slice(0,i).trim()] = line.slice(i+1).trim().replace(/^['\"]|['\"]$/g,'')
}
const mode = values.NAVICOM_MODE || 'unconfigured'
const port = values.NAVICOM_GATEWAY_PORT || '3020'
if (!['mock','unconfigured','cmsv6','canonical-http'].includes(mode)) {
  console.error(`[LOI] NAVICOM_MODE=${mode} khong hop le.`)
  process.exit(1)
}
if (mode === 'cmsv6' && (!values.NAVICOM_BASE_URL || !values.NAVICOM_USERNAME || !values.NAVICOM_PASSWORD)) {
  console.error('[LOI] cmsv6 can NAVICOM_BASE_URL, NAVICOM_USERNAME va NAVICOM_PASSWORD.')
  process.exit(1)
}
if (mode === 'canonical-http' && !values.NAVICOM_STATUS_URL_TEMPLATE) {
  console.error('[LOI] canonical-http can NAVICOM_STATUS_URL_TEMPLATE.')
  process.exit(1)
}
console.log('===============================================')
console.log('KIEM TRA NAVICOM LOCAL: OK')
console.log('===============================================')
console.log(`Mode           : ${mode}`)
console.log(`Gateway        : http://127.0.0.1:${port}`)
console.log(`Bo qua auth    : ${String(values.NAVICOM_SKIP_AUTH).toLowerCase() === 'true' ? 'CO (chi local)' : 'KHONG'}`)
if (mode === 'mock') console.log('Trang thai     : San sang test giao dien, chua ket noi Navicom that.')
if (mode === 'unconfigured') console.log('Trang thai     : Gateway chay duoc, nhung chua map API Navicom that.')
if (mode === 'cmsv6') console.log('Trang thai     : Se ket noi CMSV6 Standard API that.')
if (mode === 'canonical-http') console.log('Trang thai     : Se goi endpoint API da cau hinh.')
console.log('')
