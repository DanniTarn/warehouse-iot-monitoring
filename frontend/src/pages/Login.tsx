import { useEffect, useState, type FormEvent } from 'react'
import { Navigate } from 'react-router-dom'
import { useAuth } from '../store/auth'
import { Brand } from '../components/common/AppShell'
import { Button, Field, Notice } from '../components/common/UI'
import styles from './Login.module.css'
export default function Login() {
  const { user, login } = useAuth()
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  useEffect(() => {
    document.title = 'Đăng nhập · Giám sát kho'
  }, [])
  if (user) return <Navigate to="/" replace />
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const fields = new FormData(event.currentTarget)
    setBusy(true)
    setError('')
    try {
      await login(String(fields.get('username')).trim(), String(fields.get('password')))
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Sai tên đăng nhập hoặc mật khẩu.')
    } finally {
      setBusy(false)
    }
  }
  return (
    <div className={styles.page}>
      <section className={styles.intro}>
        <Brand subtitle={false} />
        <div className={styles.statement}>
          <h1>Hệ thống giám sát môi trường và an ninh kho hàng</h1>
          <p>
            Theo dõi nhiệt độ, độ ẩm, khói, cửa kho và chuyển động theo thời gian thực. Điều khiển
            quạt và còi báo động từ xa.
          </p>
        </div>
        <div className={styles.roles}>
          <div>
            <strong>VIEWER</strong>
            <span>Xem thiết bị, dữ liệu cảm biến, biểu đồ và lịch sử</span>
          </div>
          <div>
            <strong>OPERATOR</strong>
            <span>Thêm quyền xử lý cảnh báo, điều khiển và cấu hình thiết bị</span>
          </div>
          <div>
            <strong>ADMIN</strong>
            <span>Toàn quyền, gồm quản lý người dùng và danh sách thiết bị</span>
          </div>
        </div>
      </section>
      <main className={styles.main}>
        <form onSubmit={submit} className={styles.form}>
          <div className="stack">
            <h2>Đăng nhập</h2>
            <p>Dùng tài khoản do quản trị viên cấp.</p>
          </div>
          {error && <Notice error>{error}</Notice>}
          <Field id="username" label="Tên đăng nhập">
            <input
              id="username"
              name="username"
              autoComplete="username"
              placeholder="operator01"
              required
              disabled={busy}
            />
          </Field>
          <Field id="password" label="Mật khẩu">
            <input
              id="password"
              name="password"
              type="password"
              autoComplete="current-password"
              required
              disabled={busy}
            />
          </Field>
          <Button variant="primary" type="submit" disabled={busy}>
            {busy ? 'Đang đăng nhập…' : 'Đăng nhập'}
          </Button>
          <p className="small">
            Quên mật khẩu hoặc tài khoản bị khóa? Liên hệ quản trị viên để được cấp lại.
          </p>
          <p className="small">Bản giao diện · Dữ liệu mô phỏng</p>
        </form>
      </main>
    </div>
  )
}
