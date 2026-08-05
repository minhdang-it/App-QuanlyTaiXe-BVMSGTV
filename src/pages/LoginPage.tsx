import { useEffect, useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { BrandLogo } from '../components/BrandLogo'

const REMEMBER_PHONE_KEY = 'bvmsgtv_login_phone'

function PhoneIcon() {
  return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6.6 10.8a15.7 15.7 0 0 0 6.6 6.6l2.2-2.2a1 1 0 0 1 1-.24c1.1.37 2.25.56 3.45.56A1.15 1.15 0 0 1 21 16.67v3.18A1.15 1.15 0 0 1 19.85 21C10.55 21 3 13.45 3 4.15A1.15 1.15 0 0 1 4.15 3h3.18A1.15 1.15 0 0 1 8.48 4.15c0 1.2.19 2.35.56 3.45a1 1 0 0 1-.24 1l-2.2 2.2Z"/></svg>
}

function LockIcon() {
  return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 10V7a5 5 0 0 1 10 0v3m-9 0h8a2 2 0 0 1 2 2v7H6v-7a2 2 0 0 1 2-2Zm4 4v2"/></svg>
}

function EyeIcon({ hidden }: { hidden: boolean }) {
  return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M2.5 12s3.5-5 9.5-5 9.5 5 9.5 5-3.5 5-9.5 5-9.5-5-9.5-5Z"/><circle cx="12" cy="12" r="2.5"/>{hidden && <path d="m4 4 16 16"/>}</svg>
}

function ShieldIcon() {
  return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3 5 6v5c0 4.8 2.9 8.2 7 10 4.1-1.8 7-5.2 7-10V6l-7-3Z"/><path d="m9 12 2 2 4-4"/></svg>
}

function ClockIcon() {
  return <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="8"/><path d="M12 7v5l3 2"/></svg>
}

function ChartIcon() {
  return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 20V10h4v10H5Zm5 0V5h4v15h-4Zm5 0v-7h4v7h-4Z"/></svg>
}

function RouteIcon() {
  return <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="6" cy="18" r="2"/><circle cx="18" cy="6" r="2"/><path d="M8 18h2.5a3.5 3.5 0 0 0 0-7H9a3 3 0 0 1 0-6h7"/></svg>
}

function VehicleIcon() {
  return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 16h14l-1.4-5.3A2.3 2.3 0 0 0 15.4 9H8.6a2.3 2.3 0 0 0-2.2 1.7L5 16Z"/><path d="M4 16v3m16-3v3M7 19h10M7.5 13h.01M16.5 13h.01"/></svg>
}

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
    <main className="login-page login-v8">
      <section className="login-panel-v8" aria-label="Đăng nhập hệ thống điều phối xe">
        <div className="login-card-v8">
          <div className="login-brand-row-v8">
            <BrandLogo className="login-brand-v8" />
            <span className="login-online-v8"><i /> Trực tuyến</span>
          </div>

          <div className="login-mobile-command-v8">
            <span><VehicleIcon /></span>
            <div><strong>Trung tâm vận hành đội xe</strong><small>Giám sát tập trung · Hoạt động 24/7</small></div>
          </div>

          <header className="login-heading-v8">
            <span>CỔNG ĐĂNG NHẬP HỆ THỐNG</span>
            <h1>Đăng nhập vận hành</h1>
            <p>Dành cho tài xế, điều phối viên và quản trị viên hệ thống điều xe.</p>
          </header>

          <form onSubmit={submit} className="login-form-v8">
            <label className="login-field-v8">
              <span>Số điện thoại</span>
              <div className="login-input-v8">
                <i><PhoneIcon /></i>
                <input
                  inputMode="tel"
                  autoComplete="username"
                  value={phone}
                  onChange={(event) => setPhone(event.target.value)}
                  placeholder="Nhập số điện thoại"
                  required
                />
              </div>
            </label>

            <label className="login-field-v8">
              <span>Mật khẩu</span>
              <div className="login-input-v8">
                <i><LockIcon /></i>
                <input
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  placeholder="Nhập mật khẩu"
                  required
                />
                <button type="button" onClick={() => setShowPassword((value) => !value)} aria-label={showPassword ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}>
                  <EyeIcon hidden={!showPassword} />
                </button>
              </div>
            </label>

            <div className="login-options-v8">
              <label>
                <input type="checkbox" checked={rememberMe} onChange={(event) => setRememberMe(event.target.checked)} />
                <span>Ghi nhớ đăng nhập</span>
              </label>
              <button type="button" onClick={handleForgotPassword}>Quên mật khẩu?</button>
            </div>

            {error && <div className="login-error-v8" role="alert"><strong>Không thể đăng nhập</strong><span>{error}</span></div>}

            <button type="submit" className="login-submit-v8" disabled={loading}>
              {loading ? <><i className="login-spinner" /> ĐANG XÁC THỰC...</> : <><span>ĐĂNG NHẬP HỆ THỐNG</span><b>→</b></>}
            </button>
          </form>

          <div className="login-trust-v8" aria-label="Tiêu chuẩn vận hành">
            <span><ShieldIcon /> Phân quyền bảo mật</span>
            <span><ClockIcon /> Nhật ký thời gian thực</span>
          </div>

          <aside className="login-security-v8">
            <i><ShieldIcon /></i>
            <div>
              <strong>Kết nối an toàn</strong>
              <span>Mọi phiên đăng nhập và thao tác đều được kiểm soát theo tài khoản.</span>
            </div>
          </aside>

          <footer className="login-footer-v8">© 2026 Bệnh viện mắt Sài Gòn Trà Vinh</footer>
        </div>
      </section>

      <section className="login-hero-v8" aria-label="Trung tâm vận hành đội xe Bệnh viện mắt Sài Gòn Trà Vinh">
        <div className="login-hero-bg-v8" />
        <div className="login-hero-content-v8">
          <header className="login-hero-top-v8">
            <span className="login-command-label-v8">TRUNG TÂM ĐIỀU HÀNH ĐỘI XE</span>
            <span className="login-live-v8"><i /> Hệ thống đang hoạt động</span>
          </header>

          <div className="login-hero-copy-v8">
            <span>HỆ THỐNG QUẢN LÝ ĐIỀU XE</span>
            <h2>Điều hành tập trung.<br /><em>Chuẩn xác từng hành trình.</em></h2>
            <p>Từ giao chuyến, số km, chi phí đến sự cố và bảo trì — toàn bộ hoạt động đội xe được quản lý trên một nền tảng thống nhất.</p>
          </div>

          <section className="login-kpis-v8" aria-label="Năng lực hệ thống">
            <article><i><RouteIcon /></i><div><strong>Kiểm soát hành trình</strong><span>Theo dõi trạng thái từng chuyến</span></div></article>
            <article><i><ClockIcon /></i><div><strong>Vận hành thời gian thực</strong><span>Cập nhật xuyên suốt 24/7</span></div></article>
            <article><i><ChartIcon /></i><div><strong>Dữ liệu minh bạch</strong><span>Chi phí và hiệu suất tập trung</span></div></article>
          </section>

          <section className="login-console-v8" aria-hidden="true">
            <header><span>ĐIỀU HÀNH TRỰC TUYẾN</span><b><i /> ĐANG GIÁM SÁT</b></header>
            <div className="login-console-route-v8">
              <span className="start" />
              <div><small>Điểm xuất phát</small><strong>Bệnh viện mắt Sài Gòn Trà Vinh</strong></div>
              <em />
              <span className="end" />
              <div><small>Điểm đến</small><strong>Điểm công tác theo kế hoạch</strong></div>
            </div>
            <footer><span>🚐 Xe sẵn sàng</span><span>🛡 Bảo mật phân quyền</span><span>📊 Báo cáo tức thời</span></footer>
          </section>

          <div className="login-vehicles-v8" aria-hidden="true">
            <div className="login-road-v8" />
            <figure className="login-hiace-v8"><img src="/hiace-user-v201.png" alt="" /><figcaption>HIACE 16 CHỖ</figcaption></figure>
            <figure className="login-fortuner-v8"><img src="/fortuner-user-v201.png" alt="" /><figcaption>FORTUNER 7 CHỖ</figcaption></figure>
          </div>
        </div>
      </section>
    </main>
  )
}
