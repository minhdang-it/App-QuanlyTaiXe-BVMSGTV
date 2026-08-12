import { useEffect, useMemo, useState } from 'react'
import { Modal } from '../components/Modal'
import { useAuth } from '../context/AuthContext'
import { useData } from '../context/DataContext'
import { ROLE_LABELS } from '../lib/constants'
import type { CreateUserInput, Profile, UpdateUserInput, UserRole } from '../types/models'

const EMPTY_CREATE: CreateUserInput = {
  full_name: '',
  phone: '',
  password: '',
  role: 'driver',
  employee_code: '',
  department: '',
  job_title: '',
  notes: '',
}

export function UsersPage() {
  const { user, mode } = useAuth()
  const { data, createUser, updateUser, deleteUser } = useData()
  const [creating, setCreating] = useState(false)
  const [editing, setEditing] = useState<Profile | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [query, setQuery] = useState('')
  const [roleFilter, setRoleFilter] = useState<'all' | UserRole>('all')

  const profiles = useMemo(() => {
    const needle = query.trim().toLowerCase()
    return data.profiles.filter((profile) => {
      if (profile.deleted_at) return false
      if (roleFilter !== 'all' && profile.role !== roleFilter) return false
      if (!needle) return true
      return [
        profile.full_name,
        profile.phone,
        profile.employee_code,
        profile.department,
        profile.job_title,
        ROLE_LABELS[profile.role],
      ].some((value) => String(value ?? '').toLowerCase().includes(needle))
    })
  }, [data.profiles, query, roleFilter])


  async function removeAccount(profile: Profile) {
    if (profile.id === user!.id) return
    const accepted = window.confirm(`Xóa tài khoản ${profile.full_name}?

Tài khoản sẽ bị vô hiệu hóa đăng nhập và ẩn khỏi danh sách. Dữ liệu chuyến/chi phí cũ vẫn được giữ để đối chiếu.`)
    if (!accepted) return
    try {
      await deleteUser(profile.id)
      setMessage('Đã xóa tài khoản. Lịch sử nghiệp vụ liên quan vẫn được bảo toàn.')
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Không thể xóa tài khoản.')
    }
  }

  async function toggleAccount(profile: Profile) {
    if (profile.id === user!.id) return
    await updateUser({
      id: profile.id,
      full_name: profile.full_name,
      phone: profile.phone,
      role: profile.role,
      active: !profile.active,
      employee_code: profile.employee_code ?? '',
      department: profile.department ?? '',
      job_title: profile.job_title ?? '',
      notes: profile.notes ?? '',
      avatar_url: profile.avatar_path ?? profile.avatar_url ?? null,
      previous_avatar_url: profile.avatar_path ?? null,
    })
    setMessage(profile.active ? 'Đã khóa tài khoản.' : 'Đã mở lại tài khoản.')
  }

  return (
    <>
      {message && <div className="inline-message">{message}<button onClick={() => setMessage(null)}>✕</button></div>}

      <section className="toolbar account-toolbar">
        <div>
          <strong>{data.profiles.filter((profile) => !profile.deleted_at).length} tài khoản nhân viên</strong>
          <p className="toolbar-note">Quản trị viên có thể cập nhật hồ sơ, ảnh đại diện, quyền truy cập và đặt lại mật khẩu.</p>
        </div>
        <button className="primary-button" onClick={() => setCreating(true)}>＋ THÊM TÀI KHOẢN</button>
      </section>

      <section className="account-filters">
        <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Tìm theo tên, số điện thoại, mã nhân viên, phòng ban..." />
        <select value={roleFilter} onChange={(event) => setRoleFilter(event.target.value as 'all' | UserRole)}>
          <option value="all">Tất cả vai trò</option>
          {(Object.keys(ROLE_LABELS) as UserRole[]).map((role) => <option key={role} value={role}>{ROLE_LABELS[role]}</option>)}
        </select>
      </section>

      <section className="panel">
        <div className="table-wrap">
          <table className="account-table">
            <thead>
              <tr>
                <th>Nhân viên</th>
                <th>Thông tin công việc</th>
                <th>Vai trò</th>
                <th>Trạng thái</th>
                <th>Thao tác</th>
              </tr>
            </thead>
            <tbody>
              {profiles.map((profile) => (
                <tr key={profile.id}>
                  <td>
                    <div className="profile-cell account-profile-cell">
                      <ProfileAvatar profile={profile} />
                      <div>
                        <strong>{profile.full_name}</strong>
                        <small>{profile.phone || 'Chưa có số điện thoại'}</small>
                      </div>
                    </div>
                  </td>
                  <td>
                    <div className="account-work-info">
                      <strong>{profile.job_title || 'Chưa cập nhật chức danh'}</strong>
                      <span>{profile.department || 'Chưa cập nhật phòng ban'}</span>
                      {profile.employee_code && <small>Mã NV: {profile.employee_code}</small>}
                    </div>
                  </td>
                  <td><span className="role-badge">{ROLE_LABELS[profile.role]}</span></td>
                  <td><span className={`account-state ${profile.active ? 'active' : 'locked'}`}>{profile.active ? 'Đang hoạt động' : 'Đã khóa'}</span></td>
                  <td>
                    <div className="account-row-actions">
                      <button className="secondary-button compact" onClick={() => setEditing(profile)}>Chỉnh sửa</button>
                      <button
                        className={`compact ${profile.active ? 'reject-button' : 'approve-button'}`}
                        disabled={profile.id === user!.id}
                        onClick={() => void toggleAccount(profile)}
                      >
                        {profile.active ? 'Khóa' : 'Mở khóa'}
                      </button>
                      <button
                        className="reject-button compact"
                        disabled={profile.id === user!.id}
                        onClick={() => void removeAccount(profile)}
                        title="Xóa quyền đăng nhập nhưng giữ lịch sử nghiệp vụ"
                      >
                        Xóa
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {profiles.length === 0 && <tr><td colSpan={5}><div className="empty-state">Không tìm thấy tài khoản phù hợp.</div></td></tr>}
            </tbody>
          </table>
        </div>
      </section>

      {creating && (
        <CreateUserModal
          mode={mode}
          onClose={() => setCreating(false)}
          onSubmit={async (input, avatar) => {
            await createUser(input, avatar)
            setCreating(false)
            setMessage('Đã tạo tài khoản và hồ sơ nhân viên.')
          }}
        />
      )}

      {editing && (
        <EditUserModal
          profile={editing}
          currentUserId={user!.id}
          mode={mode}
          onClose={() => setEditing(null)}
          onSubmit={async (input, avatar) => {
            await updateUser(input, avatar)
            setEditing(null)
            setMessage(input.password ? 'Đã cập nhật hồ sơ và đặt lại mật khẩu.' : 'Đã cập nhật hồ sơ tài khoản.')
          }}
        />
      )}
    </>
  )
}

function ProfileAvatar({ profile, large = false }: { profile: Profile; large?: boolean }) {
  const initials = profile.full_name.trim().slice(0, 1).toUpperCase() || '?'
  return (
    <span className={`profile-avatar ${large ? 'large' : ''}`}>
      {profile.avatar_url ? <img src={profile.avatar_url} alt={`Ảnh đại diện ${profile.full_name}`} /> : initials}
    </span>
  )
}

function AvatarPicker({ currentUrl, onFile, onRemove }: { currentUrl?: string | null; onFile: (file: File | null) => void; onRemove?: () => void }) {
  const [preview, setPreview] = useState<string | null>(currentUrl ?? null)

  useEffect(() => {
    setPreview(currentUrl ?? null)
  }, [currentUrl])

  useEffect(() => () => {
    if (preview?.startsWith('blob:')) URL.revokeObjectURL(preview)
  }, [preview])

  function selectFile(file: File | null) {
    if (preview?.startsWith('blob:')) URL.revokeObjectURL(preview)
    if (!file) {
      setPreview(currentUrl ?? null)
      onFile(null)
      return
    }
    setPreview(URL.createObjectURL(file))
    onFile(file)
  }

  return (
    <div className="avatar-picker">
      <div className="avatar-preview">{preview ? <img src={preview} alt="Xem trước ảnh đại diện" /> : <span>AVT</span>}</div>
      <div>
        <label className="secondary-button compact avatar-upload-button">
          Chọn ảnh đại diện
          <input type="file" accept="image/*" hidden onChange={(event) => selectFile(event.target.files?.[0] ?? null)} />
        </label>
        {currentUrl && onRemove && <button type="button" className="avatar-remove-button" onClick={() => { setPreview(null); onFile(null); onRemove() }}>Xóa ảnh hiện tại</button>}
        <small>Ảnh sẽ được tự thu nhỏ và nén trước khi tải lên.</small>
      </div>
    </div>
  )
}

function CreateUserModal({
  mode,
  onClose,
  onSubmit,
}: {
  mode: 'demo' | 'supabase'
  onClose: () => void
  onSubmit: (input: CreateUserInput, avatar: File | null) => Promise<void>
}) {
  const [form, setForm] = useState<CreateUserInput>({ ...EMPTY_CREATE })
  const [avatar, setAvatar] = useState<File | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  return (
    <Modal title="Thêm tài khoản nhân viên" onClose={onClose} wide>
      <form className="form-stack" onSubmit={async (event) => {
        event.preventDefault()
        setSaving(true)
        setError(null)
        try {
          if (form.password.length < 6) throw new Error('Mật khẩu cần ít nhất 6 ký tự.')
          await onSubmit(form, avatar)
        } catch (err) {
          setError(err instanceof Error ? err.message : String(err))
        } finally {
          setSaving(false)
        }
      }}>
        <AvatarPicker onFile={setAvatar} />
        <div className="form-grid account-form-grid">
          <label>Họ tên<input value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} required /></label>
          <label>Số điện thoại<input inputMode="tel" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="0901 234 567" required /></label>
          <label>Mã nhân viên<input value={form.employee_code ?? ''} onChange={(e) => setForm({ ...form, employee_code: e.target.value })} placeholder="VD: TX-001" /></label>
          <label>Vai trò<select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value as UserRole })}>{(Object.keys(ROLE_LABELS) as UserRole[]).map((role) => <option key={role} value={role}>{ROLE_LABELS[role]}</option>)}</select></label>
          <label>Phòng ban<input value={form.department ?? ''} onChange={(e) => setForm({ ...form, department: e.target.value })} placeholder="VD: Phòng Hành chính" /></label>
          <label>Chức danh<input value={form.job_title ?? ''} onChange={(e) => setForm({ ...form, job_title: e.target.value })} placeholder="VD: Tài xế" /></label>
          <label className="span-2">Mật khẩu ban đầu<input type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} required /></label>
          <label className="span-2">Ghi chú<textarea value={form.notes ?? ''} onChange={(e) => setForm({ ...form, notes: e.target.value })} placeholder="Thông tin liên hệ, tuyến xe phụ trách hoặc ghi chú nội bộ..." /></label>
        </div>
        {error && <div className="form-error">{error}</div>}
        <button className="primary-button full" disabled={saving}>{saving ? 'Đang tạo...' : 'TẠO TÀI KHOẢN'}</button>
      </form>
    </Modal>
  )
}

function EditUserModal({
  profile,
  currentUserId,
  mode,
  onClose,
  onSubmit,
}: {
  profile: Profile
  currentUserId: string
  mode: 'demo' | 'supabase'
  onClose: () => void
  onSubmit: (input: UpdateUserInput, avatar: File | null) => Promise<void>
}) {
  const [form, setForm] = useState<UpdateUserInput>({
    id: profile.id,
    full_name: profile.full_name,
    phone: profile.phone,
    role: profile.role,
    active: profile.active,
    employee_code: profile.employee_code ?? '',
    department: profile.department ?? '',
    job_title: profile.job_title ?? '',
    notes: profile.notes ?? '',
    password: '',
    avatar_url: profile.avatar_path ?? profile.avatar_url ?? null,
    previous_avatar_url: profile.avatar_path ?? null,
  })
  const [avatar, setAvatar] = useState<File | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const isSelf = profile.id === currentUserId

  return (
    <Modal title={`Chỉnh sửa tài khoản: ${profile.full_name}`} onClose={onClose} wide>
      <form className="form-stack" onSubmit={async (event) => {
        event.preventDefault()
        setSaving(true)
        setError(null)
        try {
          if (form.password && form.password.length < 6) throw new Error('Mật khẩu mới cần ít nhất 6 ký tự.')
          await onSubmit({ ...form, password: form.password?.trim() || undefined }, avatar)
        } catch (err) {
          setError(err instanceof Error ? err.message : String(err))
        } finally {
          setSaving(false)
        }
      }}>
        <AvatarPicker
          currentUrl={profile.avatar_url}
          onFile={setAvatar}
          onRemove={() => setForm((value) => ({ ...value, avatar_url: null }))}
        />
        <div className="form-grid account-form-grid">
          <label>Họ tên<input value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} required /></label>
          <label>Số điện thoại<input inputMode="tel" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} required /></label>
          <label>Mã nhân viên<input value={form.employee_code ?? ''} onChange={(e) => setForm({ ...form, employee_code: e.target.value })} /></label>
          <label>Vai trò<select value={form.role} disabled={isSelf} onChange={(e) => setForm({ ...form, role: e.target.value as UserRole })}>{(Object.keys(ROLE_LABELS) as UserRole[]).map((role) => <option key={role} value={role}>{ROLE_LABELS[role]}</option>)}</select></label>
          <label>Phòng ban<input value={form.department ?? ''} onChange={(e) => setForm({ ...form, department: e.target.value })} /></label>
          <label>Chức danh<input value={form.job_title ?? ''} onChange={(e) => setForm({ ...form, job_title: e.target.value })} /></label>
          <label className="span-2">Đặt lại mật khẩu<input type="password" value={form.password ?? ''} onChange={(e) => setForm({ ...form, password: e.target.value })} placeholder="Để trống nếu không đổi mật khẩu" /></label>
          <label className="span-2 account-active-toggle">
            <input type="checkbox" checked={form.active} disabled={isSelf} onChange={(e) => setForm({ ...form, active: e.target.checked })} />
            <span>Cho phép tài khoản đăng nhập và sử dụng hệ thống</span>
          </label>
          <label className="span-2">Ghi chú<textarea value={form.notes ?? ''} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></label>
        </div>
        {isSelf && <div className="demo-notice">Để tránh mất quyền quản trị, anh không thể tự khóa tài khoản hoặc tự đổi vai trò của chính mình.</div>}
        {error && <div className="form-error">{error}</div>}
        <button className="primary-button full" disabled={saving}>{saving ? 'Đang lưu...' : 'LƯU THAY ĐỔI'}</button>
      </form>
    </Modal>
  )
}
