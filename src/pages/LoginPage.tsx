import { useEffect, useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { BrandLogo } from '../components/BrandLogo'

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

    if (rememberMe) {
      window.localStorage.setItem(REMEMBER_PHONE_KEY, phone)
    } else {
      window.localStorage.removeItem(REMEMBER_PHONE_KEY)
    }

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
    <main className="login-page login-v5">
      <section className="login-panel login-panel-v5">
        <div className="login-card login-card-v5">
          <div className="login-card-v5-topline" />

          <div className="login-brand-row login-brand-row-v5">
            <BrandLogo className="login-brand login-brand-v5" />
            <span className="login-online-chip login-online-chip-v5"><i /> Hệ thống trực tuyến</span>
          </div>

          <div className="login-heading login-heading-v5">
            <span className="login-eyebrow">CỔNG VẬN HÀNH ĐỘI XE</span>
            <h1>Đăng nhập hệ thống</h1>
            <p>Truy cập nhanh, bảo mật và đúng phân quyền dành cho nhân sự bệnh viện.</p>
          </div>

          <form onSubmit={submit} className="form-stack login-form-v5">
            <label className="login-field login-field-v5">
              <span>Số điện thoại</span>
              <div className="login-input-shell login-input-shell-v5">
                <i aria-hidden="true">☎</i>
                <input
                  inputMode="tel"
                  autoComplete="username"
                  value={phone}
                  onChange={(event) => setPhone(event.target.value)}
                  placeholder="Nhập số điện thoại"
                  required
                  autoFocus
                />
              </div>
            </label>

            <label className="login-field login-field-v5">
              <span>Mật khẩu</span>
              <div className="login-input-shell login-input-shell-v5">
                <i aria-hidden="true">🔒</i>
                <input
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  placeholder="Nhập mật khẩu"
                  required
                />
                <button
                  type="button"
                  className="password-visibility password-visibility-v5"
                  onClick={() => setShowPassword((value) => !value)}
                  aria-label={showPassword ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
                >
                  {showPassword ? 'Ẩn' : 'Hiện'}
                </button>
              </div>
            </label>

            <div className="login-options-row">
              <label className="remember-toggle">
                <input type="checkbox" checked={rememberMe} onChange={(event) => setRememberMe(event.target.checked)} />
                <span>Ghi nhớ đăng nhập</span>
              </label>
              <button type="button" className="forgot-password-link" onClick={handleForgotPassword}>Quên mật khẩu?</button>
            </div>

            {error && (
              <div className="form-error login-error-v5">
                <span>!</span>
                <div>
                  <strong>Không thể đăng nhập</strong>
                  <small>{error}</small>
                </div>
              </div>
            )}

            <button className="primary-button large login-submit-v5" disabled={loading}>
              {loading ? <><span className="login-spinner" /> ĐANG XÁC THỰC...</> : <>🔒 Đăng nhập</>}
            </button>
          </form>

          <div className="login-security-note">Dữ liệu được mã hóa và bảo vệ tuyệt đối</div>

          <div className="login-help-card login-help-card-v5">
            <span>i</span>
            <div>
              <strong>Thông tin tài khoản</strong>
              <small>Tài khoản do Quản trị viên cấp. Liên hệ Điều phối nếu quên mật khẩu hoặc bị khóa tài khoản.</small>
            </div>
          </div>
        </div>
      </section>

      <section className="login-hero login-hero-v5">
        <div className="login-hero-overlay" />
        <div className="login-hero-card-v5">
          <div className="login-hero-badge"><i /> Hệ thống trực tuyến</div>
          <div className="login-hero-copy-v5">
            <h2>Mỗi chuyến xe đều được kiểm soát.</h2>
            <p>Từ lúc giao chuyến, xuất phát, ghi nhận kilomet đến chi phí và sự cố — tất cả được cập nhật trên một hệ thống thống nhất.</p>
          </div>

          <div className="login-feature-row-v5">
            <article>
              <strong>An toàn & minh bạch</strong>
              <small>Kiểm soát chặt chẽ mọi hoạt động.</small>
            </article>
            <article>
              <strong>Realtime</strong>
              <small>Cập nhật tức thời 24/7.</small>
            </article>
            <article>
              <strong>Hiệu quả</strong>
              <small>Tối ưu chi phí, nâng cao hiệu suất.</small>
            </article>
          </div>

          <div className="hero-vehicle-stage" aria-hidden="true">
            <figure className="hero-vehicle hero-vehicle-hiace">
              <img src="/hiace-real.png" alt="" />
              <figcaption>Hiace 16 chỗ</figcaption>
            </figure>
            <figure className="hero-vehicle hero-vehicle-fortuner">
              <img src="/fortuner-real.png" alt="" />
              <figcaption>Fortuner 7 chỗ</figcaption>
            </figure>
          </div>

          <div className="hospital-photo-caption">
            <strong>Bệnh viện Mắt Sài Gòn Trà Vinh</strong>
            <small>Điều phối xe nội bộ cho khám, công tác và hỗ trợ tuyến</small>
          </div>
        </div>
      </section>
    </main>
  )
}
