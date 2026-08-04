import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.SUPABASE_URL
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !serviceRoleKey) {
  console.error('Thiếu SUPABASE_URL hoặc SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}

/* ===== THÔNG TIN TÀI KHOẢN MỚI ===== */

const fullName = 'Lê Minh Đăng'
const inputPhone = '0357552773'
const password = 'Dang503464'
const role = 'admin'

/*
Các quyền hợp lệ:
driver      = Tài xế
dispatcher  = Điều phối
accountant  = Kế toán
fleet       = Hành chính đội xe
director    = Ban Giám đốc
admin       = Quản trị viên
*/

const allowedRoles = [
  'driver',
  'dispatcher',
  'accountant',
  'fleet',
  'director',
  'admin',
]

function toVietnamE164(value) {
  const digits = String(value).replace(/\D/g, '')

  if (digits.startsWith('84')) {
    return `+${digits}`
  }

  if (digits.startsWith('0')) {
    return `+84${digits.slice(1)}`
  }

  return `+${digits}`
}

if (!allowedRoles.includes(role)) {
  console.error(`Vai trò không hợp lệ: ${role}`)
  process.exit(1)
}

if (password.length < 6) {
  console.error('Mật khẩu phải có ít nhất 6 ký tự')
  process.exit(1)
}

const phone = toVietnamE164(inputPhone)

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
    detectSessionInUrl: false,
  },
})

const { data, error: createError } =
  await supabase.auth.admin.createUser({
    phone,
    password,
    phone_confirm: true,
    user_metadata: {
      full_name: fullName,
      phone,
    },
  })

if (createError || !data.user) {
  console.error(
    'Không tạo được tài khoản:',
    createError?.message ?? 'Không nhận được User ID',
  )
  process.exit(1)
}

const userId = data.user.id

const { error: profileError } = await supabase
  .from('profiles')
  .upsert(
    {
      id: userId,
      full_name: fullName,
      phone,
      role,
      active: true,
    },
    {
      onConflict: 'id',
    },
  )

if (profileError) {
  console.error('Không tạo được hồ sơ:', profileError.message)

  // Xóa Auth user để tránh tài khoản bị thiếu profile
  await supabase.auth.admin.deleteUser(userId)

  process.exit(1)
}

console.log('====================================')
console.log('ĐÃ TẠO TÀI KHOẢN THÀNH CÔNG')
console.log('====================================')
console.log('Họ tên:', fullName)
console.log('Điện thoại:', phone)
console.log('Vai trò:', role)
console.log('User ID:', userId)