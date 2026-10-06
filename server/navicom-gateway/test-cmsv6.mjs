import { cmsv6Diagnostic, cmsv6ListVehicles } from './cmsv6.mjs'

const deviceId = String(process.argv[2] || process.env.NAVICOM_TEST_DEVICE_ID || '').trim()
console.log('===============================================')
console.log('BVMSGTV - KIỂM TRA CMSV6 API THẬT')
console.log('===============================================')
console.log(`Domain    : ${process.env.NAVICOM_BASE_URL || '(chưa cấu hình)'}`)
console.log(`Tài khoản : ${process.env.NAVICOM_USERNAME ? '(đã cấu hình)' : '(thiếu)'}`)
console.log(`Thiết bị  : ${deviceId || '(chỉ test đăng nhập)'}`)
console.log('')
try {
  const account = await cmsv6ListVehicles()
  console.log('[DANH SÁCH XE TRÊN TÀI KHOẢN NAVICOM]')
  console.log(JSON.stringify(account, null, 2))
  console.log('')
  const result = await cmsv6Diagnostic(deviceId)
  console.log('[CHẨN ĐOÁN THIẾT BỊ]')
  console.log(JSON.stringify(result, null, 2))
  console.log('\n[KẾT QUẢ] Kết nối CMSV6 Standard API thành công.')
} catch (error) {
  console.error('\n[LỖI]', error instanceof Error ? error.message : String(error))
  process.exit(1)
}
