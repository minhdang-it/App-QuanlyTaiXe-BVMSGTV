import { useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { BrandLogo } from '../components/BrandLogo'

export function LoginPage() {
  const { login, mode } = useAuth()
  const [phone, setPhone] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function submit(event: React.FormEvent) {
    event.preventDefault()
    setLoading(true)
    setError(null)
    try {
      await login(phone, password)
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="login-page">
      <section className="login-hero">
        <div className="hospital-label">BỆNH VIỆN MẮT SÀI GÒN TRÀ VINH</div>
        <h1>Điều phối xe rõ ràng.<br />Tài xế thao tác dễ dàng.</h1>
        <p>Quản lý chuyến đi, kilomet, chi phí, sự cố, đăng kiểm, bảo hiểm và bảo dưỡng trên một hệ thống dùng chung.</p>
        <div className="hero-points">
          <span>✓ Cài như ứng dụng điện thoại</span>
          <span>✓ Mạng yếu vẫn lưu thao tác</span>
          <span>✓ Phân quyền theo công việc</span>
        </div>
      </section>
      <section className="login-panel">
        <div className="login-card">
          <BrandLogo className="login-brand" />
          <h2>Đăng nhập hệ thống</h2>
          <p>Dùng số điện thoại và mật khẩu được cấp.</p>
          {mode === 'demo' && <div className="demo-notice">Đang chạy Demo. Mật khẩu dùng thử: <strong>123456</strong></div>}
          <form onSubmit={submit} className="form-stack">
            <label>Số điện thoại<input inputMode="tel" autoComplete="username" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="0901 000 001" required /></label>
            <label>Mật khẩu<input type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••" required /></label>
            {error && <div className="form-error">{error}</div>}
            <button className="primary-button large" disabled={loading}>{loading ? 'Đang đăng nhập...' : 'ĐĂNG NHẬP'}</button>
          </form>
        </div>
      </section>
    </main>
  )
}
