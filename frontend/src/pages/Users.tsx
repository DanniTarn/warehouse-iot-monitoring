import { useState, type FormEvent } from 'react'
import { useAuth } from '../store/auth'
import { useDashboard } from '../store/dashboard'
import { dateTime } from '../services/format'
import {
  Badge,
  Button,
  Card,
  DeferredButton,
  Field,
  Notice,
  PageHeader,
  Table,
} from '../components/common/UI'
import styles from './Pages.module.css'
export default function Users() {
  const data = useDashboard((s) => s.data)!
  const self = useAuth((s) => s.user?.user_id)
  const [notice, setNotice] = useState('')
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setNotice('Tạo tài khoản được triển khai ở mốc 29/10. Chưa tạo tài khoản.')
  }
  return (
    <>
      <PageHeader
        title="Người dùng"
        subtitle={`${data.users.length} tài khoản · Quản lý vai trò và quyền truy cập`}
      />
      {notice && <Notice>{notice}</Notice>}
      <div className={styles.columns}>
        <div className={styles.usersMain}>
          <Table
            label="Danh sách người dùng"
            headers={['Tài khoản', 'Vai trò', 'Trạng thái', 'Đăng nhập gần nhất', 'Thao tác']}
          >
            {data.users.map((user) => (
              <tr key={user.user_id}>
                <td>
                  <div className={styles.deviceName}>
                    <strong>{user.full_name}</strong>
                    <span className="mono small muted">
                      {user.username} · {user.email || '—'}
                    </span>
                  </div>
                </td>
                <td>
                  <select
                    aria-label={`Vai trò của ${user.username}`}
                    value={user.role}
                    disabled={user.user_id === self}
                    onChange={() =>
                      setNotice('Thay đổi vai trò được triển khai ở mốc 29/10. Chưa lưu thay đổi.')
                    }
                    className="mono small"
                  >
                    {['ADMIN', 'OPERATOR', 'VIEWER'].map((role) => (
                      <option key={role}>{role}</option>
                    ))}
                  </select>
                </td>
                <td>
                  <Badge tone={user.is_active ? 'good' : 'neutral'}>
                    {user.is_active ? 'Hoạt động' : 'Đã khóa'}
                  </Badge>
                </td>
                <td className="mono">{dateTime(user.last_login)}</td>
                <td>
                  <DeferredButton disabled={user.user_id === self}>
                    {user.user_id === self ? 'Bạn' : user.is_active ? 'Khóa' : 'Mở khóa'}
                  </DeferredButton>
                </td>
              </tr>
            ))}
          </Table>
        </div>
        <form className={styles.sideColumn} onSubmit={submit}>
          <Card title="Tạo tài khoản">
            <Field label="Tên đăng nhập" id="new-username">
              <input id="new-username" autoComplete="off" required />
            </Field>
            <Field label="Họ và tên" id="new-fullname">
              <input id="new-fullname" autoComplete="off" required />
            </Field>
            <Field label="Email (không bắt buộc)" id="new-email">
              <input id="new-email" type="email" autoComplete="off" />
            </Field>
            <Field label="Vai trò" id="new-role">
              <select id="new-role" defaultValue="VIEWER">
                <option value="VIEWER">VIEWER · chỉ xem</option>
                <option value="OPERATOR">OPERATOR · xử lý cảnh báo, điều khiển</option>
                <option value="ADMIN">ADMIN · toàn quyền</option>
              </select>
            </Field>
            <Field label="Mật khẩu tạm" id="new-password">
              <input id="new-password" type="password" autoComplete="new-password" required />
            </Field>
            <Button variant="primary" type="submit">
              Tạo tài khoản
            </Button>
          </Card>
        </form>
      </div>
    </>
  )
}
