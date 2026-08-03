import { useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { useData } from '../context/DataContext'
import { ROLE_LABELS } from '../lib/constants'
import type { CreateUserInput, UserRole } from '../types/models'
import { Modal } from '../components/Modal'

export function UsersPage() {
  const { user, mode } = useAuth()
  const { data, createUser, updateProfile } = useData()
  const [creating, setCreating] = useState(false)
  const [message, setMessage] = useState<string | null>(null)

  return <>
    {message && <div className="inline-message">{message}<button onClick={() => setMessage(null)}>✕</button></div>}
    <section className="toolbar"><div><strong>{data.profiles.length} tài khoản nhân viên</strong><p className="toolbar-note">Quyền truy cập được kiểm tra tại cơ sở dữ liệu, không dựa vào giao diện.</p></div><button className="primary-button" onClick={() => setCreating(true)}>＋ THÊM TÀI KHOẢN</button></section>
    <section className="panel"><div className="table-wrap"><table><thead><tr><th>Nhân viên</th><th>Số điện thoại</th><th>Vai trò</th><th>Trạng thái</th><th>Thao tác</th></tr></thead><tbody>{data.profiles.map((profile) => <tr key={profile.id}><td><div className="profile-cell"><span>{profile.full_name.slice(0, 1).toUpperCase()}</span><strong>{profile.full_name}</strong></div></td><td>{profile.phone}</td><td><select className="role-select" value={profile.role} disabled={profile.id === user!.id} onChange={async (e) => { await updateProfile(profile.id, { role: e.target.value as UserRole }); setMessage('Đã cập nhật vai trò.') }}>{(Object.keys(ROLE_LABELS) as UserRole[]).map((role) => <option key={role} value={role}>{ROLE_LABELS[role]}</option>)}</select></td><td><span className={`account-state ${profile.active ? 'active' : 'locked'}`}>{profile.active ? 'Đang hoạt động' : 'Đã khóa'}</span></td><td><button className="secondary-button compact" disabled={profile.id === user!.id} onClick={async () => { await updateProfile(profile.id, { active: !profile.active }); setMessage(profile.active ? 'Đã khóa tài khoản.' : 'Đã mở lại tài khoản.') }}>{profile.active ? 'Khóa' : 'Mở khóa'}</button></td></tr>)}</tbody></table></div></section>
    {creating && <CreateUserModal mode={mode} onClose={() => setCreating(false)} onSubmit={async (input) => { await createUser(input); setCreating(false); setMessage('Đã tạo tài khoản nhân viên.') }} />}
  </>
}

function CreateUserModal({ mode, onClose, onSubmit }: { mode: 'demo' | 'supabase'; onClose: () => void; onSubmit: (input: CreateUserInput) => Promise<void> }) {
  const [form, setForm] = useState<CreateUserInput>({ full_name: '', phone: '', password: '123456', role: 'driver' })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  return <Modal title="Thêm tài khoản nhân viên" onClose={onClose}><form className="form-stack" onSubmit={async (event) => { event.preventDefault(); setSaving(true); setError(null); try { if (form.password.length < 6) throw new Error('Mật khẩu cần ít nhất 6 ký tự.'); await onSubmit(form) } catch (err) { setError(err instanceof Error ? err.message : String(err)) } finally { setSaving(false) } }}><label>Họ tên<input value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} required /></label><label>Số điện thoại<input inputMode="tel" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="0901 234 567" required /></label><label>Vai trò<select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value as UserRole })}>{(Object.keys(ROLE_LABELS) as UserRole[]).map((role) => <option key={role} value={role}>{ROLE_LABELS[role]}</option>)}</select></label><label>Mật khẩu ban đầu<input type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} required /></label>{mode === 'demo' && <div className="demo-notice">Chế độ Demo luôn đăng nhập bằng mật khẩu 123456. Mật khẩu nhập tại đây chỉ mô phỏng biểu mẫu.</div>}{error && <div className="form-error">{error}</div>}<button className="primary-button full" disabled={saving}>{saving ? 'Đang tạo...' : 'TẠO TÀI KHOẢN'}</button></form></Modal>
}
