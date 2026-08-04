import { createClient } from '@supabase/supabase-js'
import { readFile } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { createInterface } from 'node:readline/promises'
import { stdin as input, stdout as output } from 'node:process'

function parseEnv(text) {
  const values = {}
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim()
    if (!line || line.startsWith('#')) continue
    const index = line.indexOf('=')
    if (index < 1) continue
    const key = line.slice(0, index).trim()
    let value = line.slice(index + 1).trim()
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1)
    }
    values[key] = value
  }
  return values
}

function toE164(value) {
  const digits = String(value).replace(/\D/g, '')
  if (digits.startsWith('84')) return `+${digits}`
  if (digits.startsWith('0')) return `+84${digits.slice(1)}`
  return `+84${digits}`
}

function phoneToInternalEmail(phone) {
  return `${phone.replace('+', '')}@auth.bvmsgtv.internal`
}

async function findUserByEmail(client, email) {
  let page = 1
  while (page <= 20) {
    const { data, error } = await client.auth.admin.listUsers({ page, perPage: 1000 })
    if (error) throw error
    const matched = data.users.find((user) => user.email?.toLowerCase() === email.toLowerCase())
    if (matched) return matched
    if (data.users.length < 1000) return null
    page += 1
  }
  return null
}

async function main() {
  const env = existsSync('.env') ? parseEnv(await readFile('.env', 'utf8')) : {}
  const rl = createInterface({ input, output })

  console.log('======================================================')
  console.log('TAO HOAC CHUYEN TAI KHOAN ADMIN - BVMSGTV v1.4.0')
  console.log('Dang nhap van dung so dien thoai, khong can Twilio.')
  console.log('======================================================')

  const defaultUrl = process.env.SUPABASE_URL || env.VITE_SUPABASE_URL || ''
  const urlInput = await rl.question(`Supabase URL${defaultUrl ? ' [Enter de dung .env]' : ''}: `)
  const supabaseUrl = urlInput.trim() || defaultUrl
  const serviceRoleKey = (await rl.question('Supabase Secret/service_role key: ')).trim()
  const fullName = (await rl.question('Ho ten quan tri vien: ')).trim()
  const inputPhone = (await rl.question('So dien thoai (VD 0901234567): ')).trim()
  const password = await rl.question('Mat khau moi (toi thieu 8 ky tu): ')
  rl.close()

  if (!supabaseUrl || !serviceRoleKey || !fullName || !inputPhone || password.length < 8) {
    throw new Error('Thong tin chua day du hoac mat khau ngan hon 8 ky tu.')
  }
  if (!/^https:\/\/.+\.supabase\.co\/?$/i.test(supabaseUrl)) {
    throw new Error('Supabase URL khong hop le.')
  }
  if (!serviceRoleKey.startsWith('sb_secret_') && !serviceRoleKey.startsWith('eyJ')) {
    throw new Error('Can dung Secret key hoac service_role key, khong dung publishable/anon key.')
  }

  const phone = toE164(inputPhone)
  const email = phoneToInternalEmail(phone)
  const client = createClient(supabaseUrl.replace(/\/$/, ''), serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  })

  const { data: existingProfile, error: profileLookupError } = await client
    .from('profiles')
    .select('*')
    .eq('phone', phone)
    .maybeSingle()
  if (profileLookupError) throw profileLookupError

  let userId = existingProfile?.id
  let action = 'TAO MOI'

  if (!userId) {
    const existingAuthUser = await findUserByEmail(client, email)
    userId = existingAuthUser?.id
  }

  if (userId) {
    const { error } = await client.auth.admin.updateUserById(userId, {
      email,
      email_confirm: true,
      password,
      user_metadata: { full_name: fullName, phone, login_method: 'internal_email' },
    })
    if (error) throw error
    action = 'CHUYEN DOI/CAP NHAT'
  } else {
    const { data, error } = await client.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name: fullName, phone, login_method: 'internal_email' },
    })
    if (error || !data.user) throw error ?? new Error('Khong tao duoc Auth user.')
    userId = data.user.id
  }

  const { error: upsertError } = await client.from('profiles').upsert({
    id: userId,
    full_name: fullName,
    phone,
    role: 'admin',
    active: true,
  }, { onConflict: 'id' })
  if (upsertError) throw upsertError

  console.log('')
  console.log('======================================================')
  console.log(`THANH CONG: ${action} TAI KHOAN ADMIN`)
  console.log(`Ho ten       : ${fullName}`)
  console.log(`So dien thoai: ${phone}`)
  console.log(`Email noi bo : ${email}`)
  console.log(`User ID      : ${userId}`)
  console.log('======================================================')
  console.log('Dang nhap website bang so dien thoai va mat khau vua dat.')
}

main().catch((error) => {
  console.error('')
  console.error('THAT BAI:', error instanceof Error ? error.message : String(error))
  process.exitCode = 1
})
