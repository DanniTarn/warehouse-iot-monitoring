import { useEffect } from 'react'
import { NavLink, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from '../../store/auth'
import { useDashboard } from '../../store/dashboard'
import { Icon, type IconName } from './Icon'
import { Button, Notice } from './UI'
import styles from './AppShell.module.css'

export function Brand({ subtitle = true }: { subtitle?: boolean }) {
  return (
    <div className={styles.brand}>
      <span className={styles.mark}>
        <Icon name="warehouse" size={20} />
      </span>
      <div>
        <strong>Giám sát kho</strong>
        {subtitle && <small>Môi trường &amp; an ninh</small>}
      </div>
    </div>
  )
}
export function AppShell() {
  const { user, token, logout } = useAuth()
  const { data, loading, error, load, reset } = useDashboard()
  const location = useLocation()
  useEffect(() => {
    if (token) void load(token)
    return reset
  }, [token, load, reset])
  useEffect(() => {
    const titles: Record<string, string> = {
      '/': 'Tổng quan',
      '/devices': 'Thiết bị',
      '/devices/new': 'Thêm thiết bị',
      '/alerts': 'Cảnh báo',
      '/history': 'Lịch sử',
      '/users': 'Người dùng',
    }
    document.title = `${titles[location.pathname] || 'Chi tiết thiết bị'} · Giám sát kho`
  }, [location.pathname])
  const nav: [string, string, IconName][] = [
    ['/', 'Tổng quan', 'overview'],
    ['/devices', 'Thiết bị', 'devices'],
    ['/alerts', 'Cảnh báo', 'bell'],
    ['/history', 'Lịch sử', 'clock'],
  ]
  if (user?.role === 'ADMIN') nav.push(['/users', 'Người dùng', 'users'])
  return (
    <div className={styles.shell}>
      <a className={styles.skip} href="#main">
        Đến nội dung chính
      </a>
      <aside className={styles.sidebar}>
        <Brand />
        <nav className={styles.nav} aria-label="Điều hướng chính">
          {nav.map(([to, title, icon]) => (
            <NavLink key={to} to={to} end={to === '/'}>
              <Icon name={icon} />
              <span>{title}</span>
              {to === '/alerts' && (
                <span className={styles.count}>
                  {data?.alerts.filter((a) => !a.is_acknowledged).length ?? 0}
                </span>
              )}
            </NavLink>
          ))}
        </nav>
        <div className={styles.account}>
          <div className="row between">
            <span className={styles.username}>{user?.username}</span>
            <span className={styles.role}>{user?.role}</span>
          </div>
          <button
            onClick={() => {
              reset()
              logout()
            }}
          >
            Đăng xuất
          </button>
        </div>
      </aside>
      <main id="main" className={styles.main}>
        {loading || (!data && !error) ? (
          <Notice>Đang tải dữ liệu…</Notice>
        ) : error ? (
          <>
            <Notice error>{error}</Notice>
            <Button onClick={() => token && void load(token)}>Thử lại</Button>
          </>
        ) : (
          <Outlet />
        )}
        <footer className={styles.preview}>
          Bản giao diện 15/10 · Dữ liệu mô phỏng, chưa kết nối thiết bị thực.
        </footer>
      </main>
    </div>
  )
}
