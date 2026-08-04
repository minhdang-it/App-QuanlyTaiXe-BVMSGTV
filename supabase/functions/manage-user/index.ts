import { createClient } from 'npm:@supabase/supabase-js@^2'
import { corsHeaders as sdkCorsHeaders } from 'npm:@supabase/supabase-js@^2/cors'

const FUNCTION_VERSION = '1.8.0'
const ROLES = ['driver', 'dispatcher', 'accountant', 'fleet', 'director', 'admin']
const corsHeaders = {
  ...sdkCorsHeaders,
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json; charset=utf-8' },
  })
}

function toE164(value: string) {
  const digits = String(value ?? '').replace(/\D/g, '')
  if (digits.startsWith('84')) return `+${digits}`
  if (digits.startsWith('0')) return `+84${digits.slice(1)}`
  return `+84${digits}`
}

function phoneToInternalEmail(phone: string) {
  return `${phone.replace('+', '')}@auth.bvmsgtv.internal`
}

function bearerToken(request: Request) {
  const authorization = request.headers.get('Authorization') ?? ''
  const match = authorization.match(/^Bearer\s+(.+)$/i)
  return match?.[1]?.trim() ?? ''
}

function optionalText(value: unknown, maxLength = 500) {
  const text = String(value ?? '').trim()
  return text ? text.slice(0, maxLength) : null
}

function validatedAvatar(value: unknown) {
  if (value === null || value === undefined || value === '') return null
  const path = String(value).trim()
  if (path.startsWith('http://') || path.startsWith('https://') || path.startsWith('data:')) {
    throw new Error('Đường dẫn ảnh đại diện không hợp lệ.')
  }
  if (!path.includes('/avatars/')) throw new Error('Ảnh đại diện phải được lưu trong thư mục avatars.')
  return path
}

async function findAuthUserByEmailOrPhone(
  adminClient: ReturnType<typeof createClient>,
  email: string,
  phone: string,
  excludeUserId?: string,
) {
  for (let page = 1; page <= 20; page += 1) {
    const { data, error } = await adminClient.auth.admin.listUsers({ page, perPage: 100 })
    if (error) throw error

    const found = data.users.find((user) =>
      user.id !== excludeUserId
      && (
        user.email?.toLowerCase() === email.toLowerCase()
        || user.phone === phone
        || user.user_metadata?.phone === phone
      ),
    )
    if (found) return found
    if (data.users.length < 100) break
  }
  return null
}

async function ensureNotLastAdmin(
  adminClient: ReturnType<typeof createClient>,
  targetId: string,
  nextRole: string,
  nextActive: boolean,
) {
  const { data: target, error: targetError } = await adminClient
    .from('profiles')
    .select('role, active')
    .eq('id', targetId)
    .single()
  if (targetError) throw targetError
  if (target.role !== 'admin' || !target.active || (nextRole === 'admin' && nextActive)) return

  const { count, error } = await adminClient
    .from('profiles')
    .select('id', { count: 'exact', head: true })
    .eq('role', 'admin')
    .eq('active', true)
  if (error) throw error
  if ((count ?? 0) <= 1) throw new Error('Không thể khóa hoặc hạ quyền quản trị viên cuối cùng của hệ thống.')
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { status: 200, headers: corsHeaders })
  if (request.method === 'GET') return json({ ok: true, function: 'manage-user', version: FUNCTION_VERSION })
  if (request.method !== 'POST') return json({ error: 'Method not allowed' }, 405)

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    const token = bearerToken(request)

    if (!supabaseUrl || !anonKey || !serviceRoleKey) return json({ error: 'Edge Function chưa có đủ cấu hình Supabase.' }, 500)
    if (!token) return json({ error: 'Thiếu phiên đăng nhập. Hãy đăng xuất và đăng nhập lại.' }, 401)

    const userClient = createClient(supabaseUrl, anonKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    })
    const { data: authData, error: authError } = await userClient.auth.getUser(token)
    if (authError || !authData.user) return json({ error: 'Phiên đăng nhập không hợp lệ hoặc đã hết hạn.' }, 401)

    const adminClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    })

    const { data: caller, error: callerError } = await adminClient
      .from('profiles')
      .select('role, active')
      .eq('id', authData.user.id)
      .maybeSingle()
    if (callerError) return json({ error: `Không kiểm tra được quyền tài khoản: ${callerError.message}` }, 500)
    if (!caller?.active) return json({ error: 'Tài khoản đã bị khóa hoặc không còn hoạt động.' }, 403)

    const body = await request.json()
    const action = String(body.action ?? '')
    if (!['create', 'update'].includes(action)) return json({ error: 'Thao tác không được hỗ trợ.' }, 400)

    const targetId = action === 'update' ? String(body.id ?? '') : ''
    const isSelfUpdate = action === 'update' && targetId === authData.user.id
    if (action === 'create' && caller.role !== 'admin') {
      return json({ error: 'Chỉ quản trị hệ thống mới được tạo tài khoản.' }, 403)
    }
    if (action === 'update' && !targetId) return json({ error: 'Thiếu ID tài khoản cần cập nhật.' }, 400)
    if (action === 'update' && caller.role !== 'admin' && !isSelfUpdate) {
      return json({ error: 'Anh/chị chỉ được cập nhật hồ sơ của chính mình.' }, 403)
    }

    const fullName = String(body.full_name ?? '').trim().slice(0, 160)
    const phone = toE164(String(body.phone ?? ''))
    const email = phoneToInternalEmail(phone)
    const password = String(body.password ?? '')
    let role = String(body.role ?? 'driver')
    let active = action === 'create' ? true : Boolean(body.active)
    let employeeCode = optionalText(body.employee_code, 80)
    let department = optionalText(body.department, 160)
    let jobTitle = optionalText(body.job_title, 160)
    let notes = optionalText(body.notes, 1000)
    const avatarUrl = validatedAvatar(body.avatar_url)

    if (!fullName) return json({ error: 'Vui lòng nhập họ tên.' }, 400)
    if (!/^\+84\d{9,10}$/.test(phone)) return json({ error: 'Số điện thoại Việt Nam không hợp lệ.' }, 400)
    if (!ROLES.includes(role)) return json({ error: 'Vai trò tài khoản không hợp lệ.' }, 400)
    if (action === 'create' && password.length < 6) return json({ error: 'Mật khẩu phải có ít nhất 6 ký tự.' }, 400)
    if (action === 'update' && password && password.length < 6) return json({ error: 'Mật khẩu mới phải có ít nhất 6 ký tự.' }, 400)

    if (action === 'create') {
      const { data: existingProfile, error: existingProfileError } = await adminClient
        .from('profiles')
        .select('*')
        .eq('phone', phone)
        .maybeSingle()
      if (existingProfileError) return json({ error: existingProfileError.message }, 400)

      let existingAuthUser: Awaited<ReturnType<typeof findAuthUserByEmailOrPhone>> = null
      if (existingProfile) {
        const { data, error } = await adminClient.auth.admin.getUserById(existingProfile.id)
        if (!error) existingAuthUser = data.user
      }
      if (!existingAuthUser) existingAuthUser = await findAuthUserByEmailOrPhone(adminClient, email, phone)

      let userId: string
      let createdNew = false
      if (existingAuthUser) {
        userId = existingAuthUser.id
        const { error } = await adminClient.auth.admin.updateUserById(userId, {
          email,
          email_confirm: true,
          password,
          user_metadata: { full_name: fullName, phone, login_method: 'internal_email' },
        })
        if (error) return json({ error: error.message }, 400)
      } else {
        const { data, error } = await adminClient.auth.admin.createUser({
          email,
          password,
          email_confirm: true,
          user_metadata: { full_name: fullName, phone, login_method: 'internal_email' },
        })
        if (error || !data.user) return json({ error: error?.message ?? 'Không tạo được người dùng.' }, 400)
        userId = data.user.id
        createdNew = true
      }

      if (existingProfile && existingProfile.id !== userId) {
        const { error } = await adminClient.from('profiles').delete().eq('id', existingProfile.id)
        if (error) {
          if (createdNew) await adminClient.auth.admin.deleteUser(userId)
          return json({ error: `Không xử lý được hồ sơ cũ: ${error.message}` }, 400)
        }
      }

      const { data: profile, error: profileError } = await adminClient
        .from('profiles')
        .upsert({
          id: userId,
          full_name: fullName,
          phone,
          role,
          active: true,
          avatar_url: avatarUrl,
          employee_code: employeeCode,
          department,
          job_title: jobTitle,
          notes,
        }, { onConflict: 'id' })
        .select('*')
        .single()
      if (profileError) {
        if (createdNew) await adminClient.auth.admin.deleteUser(userId)
        return json({ error: profileError.message }, 400)
      }

      return json({ profile, version: FUNCTION_VERSION })
    }

    const { data: currentProfile, error: currentProfileError } = await adminClient
      .from('profiles')
      .select('*')
      .eq('id', targetId)
      .maybeSingle()
    if (currentProfileError) return json({ error: currentProfileError.message }, 400)
    if (!currentProfile) return json({ error: 'Không tìm thấy hồ sơ tài khoản.' }, 404)

    // Người dùng thường chỉ được sửa thông tin cá nhân và mật khẩu của chính mình.
    // Vai trò, trạng thái, mã nhân viên và thông tin công việc vẫn do quản trị viên kiểm soát.
    if (isSelfUpdate && caller.role !== 'admin') {
      if (avatarUrl && !avatarUrl.startsWith(`${targetId}/avatars/`)) {
        return json({ error: 'Ảnh đại diện phải thuộc hồ sơ của chính anh/chị.' }, 403)
      }
      role = currentProfile.role
      active = currentProfile.active
      employeeCode = currentProfile.employee_code
      department = currentProfile.department
      jobTitle = currentProfile.job_title
      notes = currentProfile.notes
    }

    if (caller.role === 'admin' && targetId === authData.user.id && (role !== 'admin' || !active)) {
      return json({ error: 'Không thể tự khóa hoặc tự hạ quyền quản trị của chính mình.' }, 400)
    }
    if (caller.role === 'admin') await ensureNotLastAdmin(adminClient, targetId, role, active)

    const duplicateProfile = await adminClient
      .from('profiles')
      .select('id')
      .eq('phone', phone)
      .neq('id', targetId)
      .maybeSingle()
    if (duplicateProfile.error) return json({ error: duplicateProfile.error.message }, 400)
    if (duplicateProfile.data) return json({ error: 'Số điện thoại đã thuộc một tài khoản khác.' }, 409)

    const duplicateAuth = await findAuthUserByEmailOrPhone(adminClient, email, phone, targetId)
    if (duplicateAuth) return json({ error: 'Số điện thoại đã tồn tại trong hệ thống xác thực.' }, 409)

    const profileChanges = {
      full_name: fullName,
      phone,
      role,
      active,
      avatar_url: avatarUrl,
      employee_code: employeeCode,
      department,
      job_title: jobTitle,
      notes,
    }
    const { data: profile, error: profileError } = await adminClient
      .from('profiles')
      .update(profileChanges)
      .eq('id', targetId)
      .select('*')
      .single()
    if (profileError) return json({ error: profileError.message }, 400)

    const authChanges: Record<string, unknown> = {
      email,
      email_confirm: true,
      user_metadata: { full_name: fullName, phone, login_method: 'internal_email' },
    }
    if (password) authChanges.password = password
    const { error: authUpdateError } = await adminClient.auth.admin.updateUserById(targetId, authChanges)
    if (authUpdateError) {
      const rollback = {
        full_name: currentProfile.full_name,
        phone: currentProfile.phone,
        role: currentProfile.role,
        active: currentProfile.active,
        avatar_url: currentProfile.avatar_url,
        employee_code: currentProfile.employee_code,
        department: currentProfile.department,
        job_title: currentProfile.job_title,
        notes: currentProfile.notes,
      }
      await adminClient.from('profiles').update(rollback).eq('id', targetId)
      return json({ error: `Không cập nhật được thông tin đăng nhập: ${authUpdateError.message}` }, 400)
    }

    console.log(JSON.stringify({
      event: isSelfUpdate && caller.role !== 'admin' ? 'self_profile_update' : 'manage_user_update',
      actor_id: authData.user.id,
      target_id: targetId,
      role,
      active,
      password_reset: Boolean(password),
    }))

    return json({ profile, version: FUNCTION_VERSION })
  } catch (error) {
    console.error('manage-user unexpected error', error)
    return json({ error: error instanceof Error ? error.message : String(error) }, 500)
  }
})
