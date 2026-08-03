import { createClient } from 'npm:@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
}

function toE164(value: string) {
  const digits = value.replace(/\D/g, '')
  if (digits.startsWith('84')) return `+${digits}`
  if (digits.startsWith('0')) return `+84${digits.slice(1)}`
  return `+${digits}`
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (request.method !== 'POST') return json({ error: 'Method not allowed' }, 405)

  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY')
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  const authorization = request.headers.get('Authorization')
  if (!supabaseUrl || !anonKey || !serviceRoleKey || !authorization) return json({ error: 'Thiếu cấu hình hoặc phiên đăng nhập.' }, 401)

  const userClient = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: authorization } } })
  const { data: authData, error: authError } = await userClient.auth.getUser()
  if (authError || !authData.user) return json({ error: 'Phiên đăng nhập không hợp lệ.' }, 401)

  const adminClient = createClient(supabaseUrl, serviceRoleKey, { auth: { autoRefreshToken: false, persistSession: false } })
  const { data: caller } = await adminClient.from('profiles').select('role, active').eq('id', authData.user.id).single()
  if (!caller?.active || caller.role !== 'admin') return json({ error: 'Chỉ quản trị hệ thống được tạo tài khoản.' }, 403)

  try {
    const body = await request.json()
    if (body.action !== 'create') return json({ error: 'Thao tác không được hỗ trợ.' }, 400)
    const fullName = String(body.full_name ?? '').trim()
    const phone = toE164(String(body.phone ?? ''))
    const password = String(body.password ?? '')
    const role = String(body.role ?? 'driver')
    const roles = ['driver', 'dispatcher', 'accountant', 'fleet', 'director', 'admin']
    if (!fullName || phone.length < 10 || password.length < 6 || !roles.includes(role)) return json({ error: 'Thông tin tài khoản không hợp lệ.' }, 400)

    const { data: created, error: createError } = await adminClient.auth.admin.createUser({
      phone,
      password,
      phone_confirm: true,
      user_metadata: { full_name: fullName, phone },
    })
    if (createError || !created.user) return json({ error: createError?.message ?? 'Không tạo được người dùng.' }, 400)

    const { data: profile, error: profileError } = await adminClient
      .from('profiles')
      .update({ full_name: fullName, phone, role, active: true })
      .eq('id', created.user.id)
      .select('*')
      .single()

    if (profileError) {
      await adminClient.auth.admin.deleteUser(created.user.id)
      return json({ error: profileError.message }, 400)
    }
    return json({ profile })
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : String(error) }, 500)
  }
})
