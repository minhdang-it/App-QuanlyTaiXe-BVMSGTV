import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { useAuth } from '../context/AuthContext'
import { useData } from '../context/DataContext'
import { ROLE_LABELS } from '../lib/constants'
import type { Profile, UpdateUserInput } from '../types/models'

export function AccountPage() {
  const { user, mode, refreshUser, logout } = useAuth()
  const { data, updateUser, changeOwnPassword } = useData()
  const profile = useMemo(
    () => data.profiles.find((item) => item.id === user?.id) ?? user?.profile ?? null,
    [data.profiles, user],
  )

  if (!profile) return <div className="empty-state">Không tìm thấy hồ sơ tài khoản.</div>

  return (
    <SelfAccountForm
      key={`${profile.id}-${profile.updated_at ?? ''}-${profile.phone}`}
      profile={profile}
      mode={mode}
      onSubmit={async (input, avatar) => {
        const password = input.password?.trim() ?? ''
        const currentAvatarPath = profile.avatar_path ?? null
        const profileChanged = Boolean(avatar)
          || input.full_name !== profile.full_name
          || input.phone !== profile.phone
          || input.avatar_url !== currentAvatarPath

        // Đổi mật khẩu cá nhân không đi qua chức năng quản lý tài khoản của Quản trị viên.
        // Nhờ vậy mọi tài khoản đang hoạt động đều có thể tự đổi mật khẩu của chính mình.
        if (profileChanged) {
          await updateUser({ ...input, password: undefined }, avatar)
        }
        if (password) {
          await changeOwnPassword(password)
        }
        await refreshUser()
      }}
      onLogout={logout}
    />
  )
}

function SelfAccountForm({
  profile,
  mode,
  onSubmit,
  onLogout,
}: {
  profile: Profile
  mode: 'demo' | 'supabase'
  onSubmit: (input: UpdateUserInput, avatar: File | null) => Promise<void>
  onLogout: () => Promise<void>
}) {
  const [fullName, setFullName] = useState(profile.full_name)
  const [phone, setPhone] = useState(profile.phone)
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [avatar, setAvatar] = useState<File | null>(null)
  const [avatarRemoved, setAvatarRemoved] = useState(false)
  const [preview, setPreview] = useState<string | null>(profile.avatar_url ?? null)
  const [saving, setSaving] = useState(false)
  const [loggingOut, setLoggingOut] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  useEffect(() => () => {
    if (preview?.startsWith('blob:')) URL.revokeObjectURL(preview)
  }, [preview])

  function chooseAvatar(file: File | null) {
    if (!file) return
    if (preview?.startsWith('blob:')) URL.revokeObjectURL(preview)
    setAvatar(file)
    setAvatarRemoved(false)
    setPreview(URL.createObjectURL(file))
  }

  function removeAvatar() {
    if (preview?.startsWith('blob:')) URL.revokeObjectURL(preview)
    setAvatar(null)
    setAvatarRemoved(true)
    setPreview(null)
  }

  async function submit(event: FormEvent) {
    event.preventDefault()
    setError(null)
    setSuccess(null)

    if (!fullName.trim()) return setError('Vui lòng nhập họ tên.')
    if (!phone.trim()) return setError('Vui lòng nhập số điện thoại.')
    if (password && password.length < 6) return setError('Mật khẩu mới cần ít nhất 6 ký tự.')
    if (password !== confirmPassword) return setError('Mật khẩu xác nhận chưa khớp.')

    setSaving(true)
    try {
      const phoneChanged = phone.trim() !== profile.phone
      await onSubmit({
        id: profile.id,
        full_name: fullName.trim(),
        phone: phone.trim(),
        role: profile.role,
        active: profile.active,
        employee_code: profile.employee_code ?? '',
        department: profile.department ?? '',
        job_title: profile.job_title ?? '',
        notes: profile.notes ?? '',
        password: password.trim() || undefined,
        avatar_url: avatarRemoved ? null : profile.avatar_path ?? null,
        previous_avatar_url: profile.avatar_path ?? null,
      }, avatar)
      setAvatar(null)
      setAvatarRemoved(false)
      setPassword('')
      setConfirmPassword('')
      setSuccess(phoneChanged
        ? 'Đã cập nhật hồ sơ. Từ lần đăng nhập tiếp theo, hãy dùng số điện thoại mới.'
        : password
          ? 'Đã cập nhật hồ sơ và đổi mật khẩu.'
          : 'Đã cập nhật hồ sơ cá nhân.')
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setSaving(false)
    }
  }

  async function handleLogout() {
    if (!window.confirm('Đăng xuất khỏi hệ thống Điều phối xe?')) return
    setLoggingOut(true)
    try {
      await onLogout()
    } finally {
      setLoggingOut(false)
    }
  }

  return (
    <div className="self-account-layout">
      <section className="self-account-summary">
        <div className="self-account-avatar">
          {preview
            ? <img src={preview} alt={`Ảnh đại diện ${profile.full_name}`} />
            : <span>{fullName.trim().slice(0, 1).toUpperCase() || '?'}</span>}
        </div>
        <div className="self-account-name">
          <span>HỒ SƠ CÁ NHÂN</span>
          <h2>{fullName || profile.full_name}</h2>
          <p>{ROLE_LABELS[profile.role]}{profile.job_title ? ` · ${profile.job_title}` : ''}</p>
        </div>
        <div className="self-avatar-buttons">
          <label className="secondary-button compact self-avatar-upload">
            📷 Đổi ảnh đại diện
            <input type="file" accept="image/*" capture="user" hidden onChange={(event) => chooseAvatar(event.target.files?.[0] ?? null)} />
          </label>
          {preview && <button type="button" className="text-button danger-text" onClick={removeAvatar}>Xóa ảnh</button>}
        </div>
      </section>

      <section className="self-account-work-grid">
        <div><span>Mã nhân viên</span><strong>{profile.employee_code || 'Chưa cập nhật'}</strong></div>
        <div><span>Phòng ban</span><strong>{profile.department || 'Chưa cập nhật'}</strong></div>
        <div><span>Chức danh</span><strong>{profile.job_title || ROLE_LABELS[profile.role]}</strong></div>
        <div><span>Trạng thái</span><strong className={profile.active ? 'success-text' : 'danger-text'}>{profile.active ? 'Đang hoạt động' : 'Đã khóa'}</strong></div>
      </section>

      <form className="self-account-card" onSubmit={submit}>
        <div className="self-account-section-title">
          <div><strong>Thông tin đăng nhập</strong><span>Thông tin này chỉ áp dụng cho tài khoản của anh/chị.</span></div>
        </div>

        <div className="form-grid self-account-fields">
          <label>Họ và tên<input value={fullName} onChange={(event) => setFullName(event.target.value)} required /></label>
          <label>Số điện thoại đăng nhập<input inputMode="tel" value={phone} onChange={(event) => setPhone(event.target.value)} required /></label>
        </div>

        <div className="self-account-section-title password-title">
          <div><strong>Đổi mật khẩu</strong><span>Để trống cả hai ô nếu chưa cần đổi mật khẩu.</span></div>
        </div>

        <div className="form-grid self-account-fields">
          <label>Mật khẩu mới<input type="password" autoComplete="new-password" value={password} onChange={(event) => setPassword(event.target.value)} placeholder="Tối thiểu 6 ký tự" /></label>
          <label>Xác nhận mật khẩu<input type="password" autoComplete="new-password" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} placeholder="Nhập lại mật khẩu mới" /></label>
        </div>

        <div className="self-account-policy">
          Vai trò, trạng thái, mã nhân viên, phòng ban và chức danh do Quản trị viên cập nhật. Mọi tài khoản đang hoạt động đều được tự đổi mật khẩu của chính mình.
        </div>
        {error && <div className="form-error">{error}</div>}
        {success && <div className="form-success">{success}</div>}

        <div className="self-account-actions">
          <button type="button" className="self-account-logout" onClick={() => void handleLogout()} disabled={loggingOut}>
            {loggingOut ? 'ĐANG ĐĂNG XUẤT...' : '↪ ĐĂNG XUẤT'}
          </button>
          <button className="primary-button" disabled={saving}>{saving ? 'ĐANG LƯU...' : 'LƯU THAY ĐỔI'}</button>
        </div>
      </form>
    </div>
  )
}
