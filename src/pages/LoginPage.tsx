import { useEffect, useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { Icon } from '../components/Icon'

const REMEMBER_PHONE_KEY = 'bvmsgtv_login_phone'

export function LoginPage() {
  const { login } = useAuth()
  const [phone, setPhone] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [rememberMe, setRememberMe] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    const savedPhone = window.localStorage.getItem(REMEMBER_PHONE_KEY)
    if (savedPhone) {
      setPhone(savedPhone)
      setRememberMe(true)
    }
  }, [])

  async function submit(event: React.FormEvent) {
    event.preventDefault()
    setLoading(true)
    setError(null)

    if (rememberMe) window.localStorage.setItem(REMEMBER_PHONE_KEY, phone)
    else window.localStorage.removeItem(REMEMBER_PHONE_KEY)

    try {
      await login(phone, password)
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setLoading(false)
    }
  }

  function handleForgotPassword() {
    setError('Vui lòng liên hệ Điều phối hoặc Quản trị viên để được cấp lại mật khẩu.')
  }

  return (
    <main className="login-page">
      <section className="login-hero" aria-label="Trung tâm điều hành đội xe Bệnh viện Mắt Sài Gòn Trà Vinh">
        <div className="login-hero-bg" aria-hidden="true" />
        <header className="login-hero-brand">
          <span className="login-logo"><img src="/logo-bvmsgtv-v201.png" alt="" /></span>
          <div><strong>Điều phối xe</strong><small>Bệnh viện Mắt Sài Gòn Trà Vinh</small></div>
        </header>

        <div className="login-hero-copy">
          <span className="login-kicker"><i /> Hệ thống đang hoạt động</span>
          <h2>Điều hành đội xe tập trung, minh bạch từng hành trình.</h2>
          <p>Giao chuyến, duyệt chuyến, kilomet, chi phí, sự cố và bảo dưỡng trên một nền tảng thống nhất cho toàn bệnh viện.</p>
        </div>

        <ul className="login-capabilities">
          <li><span><Icon name="route" size={18} /></span><div><strong>Điều phối → Hành chính → Tài xế</strong><small>Hành chính duyệt là xe đi, không chờ đợi</small></div></li>
          <li><span><Icon name="navigation" size={18} /></span><div><strong>Theo dõi GPS thời gian thực</strong><small>Vị trí xe đang chạy và trạng thái trực tuyến</small></div></li>
          <li><span><Icon name="chart" size={18} /></span><div><strong>Báo cáo tháng cho Ban Giám đốc</strong><small>Chi phí vận hành, chuyến đột xuất, dự báo</small></div></li>
        </ul>

        <footer className="login-hero-footer">© {new Date().getFullYear()} Bệnh viện Mắt Sài Gòn Trà Vinh · Phòng Hành chính</footer>
      </section>

      <section className="login-panel" aria-label="Đăng nhập hệ thống điều phối xe">
        <div className="login-card">
          <div className="login-mobile-brand">
            <span className="login-logo"><img src="/logo-bvmsgtv-v201.png" alt="" /></span>
            <div><strong>Điều phối xe</strong><small>Bệnh viện Mắt Sài Gòn Trà Vinh</small></div>
          </div>

          <header className="login-heading">
            <h1>Đăng nhập</h1>
            <p>Dùng số điện thoại đã được Quản trị cấp tài khoản.</p>
          </header>

          <form onSubmit={submit} className="login-form">
            <label className="login-field">
              <span>Số điện thoại</span>
              <div className="login-input">
                <Icon name="phone" size={17} />
                <input
                  inputMode="tel"
                  autoComplete="username"
                  value={phone}
                  onChange={(event) => setPhone(event.target.value)}
                  placeholder="VD: 0901 234 567"
                  required
                />
              </div>
            </label>

            <label className="login-field">
              <span>Mật khẩu</span>
              <div className="login-input">
                <Icon name="lock" size={17} />
                <input
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  placeholder="Nhập mật khẩu"
                  required
                />
                <button type="button" onClick={() => setShowPassword((value) => !value)} aria-label={showPassword ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}>
                  <Icon name="eye" size={17} />
                </button>
              </div>
            </label>

            <div className="login-options">
              <label>
                <input type="checkbox" checked={rememberMe} onChange={(event) => setRememberMe(event.target.checked)} />
                <span>Ghi nhớ số điện thoại</span>
              </label>
              <button type="button" onClick={handleForgotPassword}>Quên mật khẩu?</button>
            </div>

            {error && <div className="form-error" role="alert"><Icon name="alert" size={16} /><span><strong>Không thể đăng nhập.</strong> {error}</span></div>}

            <button type="submit" className="primary-button login-submit" disabled={loading}>
              {loading ? <><i className="login-spinner" />Đang xác thực...</> : <>Đăng nhập<Icon name="arrow-right" size={17} /></>}
            </button>
          </form>

          <aside className="login-security">
            <Icon name="shield" size={18} />
            <span>Mọi phiên đăng nhập và thao tác đều được ghi nhận theo tài khoản và phân quyền theo vai trò.</span>
          </aside>
        </div>
      </section>
    </main>
  )
}
