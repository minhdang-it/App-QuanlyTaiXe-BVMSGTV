import fs from 'node:fs'
import path from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'
import { createClient } from '@supabase/supabase-js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const projectRoot = path.resolve(__dirname, '..')

function readEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return {}

  const result = {}
  const lines = fs.readFileSync(filePath, 'utf8').split(/\r?\n/)

  for (const rawLine of lines) {
    const line = rawLine.trim()
    if (!line || line.startsWith('#')) continue

    const separator = line.indexOf('=')
    if (separator < 1) continue

    const key = line.slice(0, separator).trim()
    let value = line.slice(separator + 1).trim()

    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1)
    }

    result[key] = value
  }

  return result
}

function normalizeVietnamPhone(value) {
  const digits = String(value ?? '').replace(/\D/g, '')

  if (!digits) {
    throw new Error('Số điện thoại không được để trống.')
  }

  if (digits.startsWith('84')) {
    return `+${digits}`
  }

  if (digits.startsWith('0')) {
    return `+84${digits.slice(1)}`
  }

  return `+${digits}`
}

async function findUserByPhone(supabase, phone) {
  const perPage = 1000

  for (let page = 1; page <= 100; page += 1) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage })

    if (error) {
      throw new Error(`Không đọc được danh sách người dùng: ${error.message}`)
    }

    const user = data.users.find((item) => item.phone === phone)
    if (user) return user

    if (data.users.length < perPage) return null
  }

  return null
}

async function main() {
  const fileEnv = readEnvFile(path.join(projectRoot, '.env'))

  const supabaseUrl =
    process.env.SUPABASE_URL ||
    fileEnv.VITE_SUPABASE_URL ||
    fileEnv.SUPABASE_URL

  const adminKey =
    process.env.SUPABASE_ADMIN_KEY ||
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.SUPABASE_SECRET_KEY

  const fullName = String(process.env.ADMIN_FULL_NAME ?? '').trim()
  const phone = normalizeVietnamPhone(process.env.ADMIN_PHONE)
  const password = String(process.env.ADMIN_PASSWORD ?? '')

  if (!supabaseUrl) {
    throw new Error(
      'Không tìm thấy Supabase URL. Hãy kiểm tra VITE_SUPABASE_URL trong file .env.',
    )
  }

  if (!adminKey) {
    throw new Error('Thiếu Supabase Secret key hoặc service_role key.')
  }

  if (!fullName) {
    throw new Error('Họ tên quản trị viên không được để trống.')
  }

  if (password.length < 8) {
    throw new Error('Mật khẩu phải có ít nhất 8 ký tự.')
  }

  const supabase = createClient(supabaseUrl, adminKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
      detectSessionInUrl: false,
    },
  })

  let user = await findUserByPhone(supabase, phone)
  let createdNewUser = false

  if (user) {
    const { data, error } = await supabase.auth.admin.updateUserById(user.id, {
      phone,
      password,
      phone_confirm: true,
      user_metadata: {
        ...(user.user_metadata ?? {}),
        full_name: fullName,
        phone,
      },
    })

    if (error || !data.user) {
      throw new Error(`Không cập nhật được tài khoản Auth: ${error?.message ?? 'Lỗi không xác định'}`)
    }

    user = data.user
  } else {
    const { data, error } = await supabase.auth.admin.createUser({
      phone,
      password,
      phone_confirm: true,
      user_metadata: {
        full_name: fullName,
        phone,
      },
    })

    if (error || !data.user) {
      throw new Error(`Không tạo được tài khoản Auth: ${error?.message ?? 'Lỗi không xác định'}`)
    }

    user = data.user
    createdNewUser = true
  }

  const { error: profileError } = await supabase.from('profiles').upsert(
    {
      id: user.id,
      full_name: fullName,
      phone,
      role: 'admin',
      active: true,
    },
    { onConflict: 'id' },
  )

  if (profileError) {
    if (createdNewUser) {
      await supabase.auth.admin.deleteUser(user.id)
    }

    throw new Error(`Không cấp được quyền admin trong profiles: ${profileError.message}`)
  }

  console.log('')
  console.log('====================================================')
  console.log(createdNewUser ? 'ĐÃ TẠO TÀI KHOẢN ADMIN THÀNH CÔNG' : 'ĐÃ CẬP NHẬT TÀI KHOẢN THÀNH ADMIN')
  console.log('====================================================')
  console.log(`Họ tên       : ${fullName}`)
  console.log(`Số điện thoại: ${phone}`)
  console.log('Vai trò      : admin')
  console.log(`User ID      : ${user.id}`)
  console.log('')
  console.log('Có thể đăng nhập website bằng số điện thoại dạng 0xxxxxxxxx.')
}

main().catch((error) => {
  console.error('')
  console.error('TẠO ADMIN THẤT BẠI')
  console.error(error instanceof Error ? error.message : String(error))
  process.exitCode = 1
})
