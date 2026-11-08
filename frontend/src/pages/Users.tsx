import { useState, type FormEvent } from 'react'
import { useAuth } from '../store/auth'
import { useDashboard } from '../store/dashboard'
import { useActions } from '../store/actions'
import { dateTime } from '../services/format'
import type { Role } from '../services/types'
import {
  ActionButton,
  Badge,
  Button,
  Card,
  Field,
  Notice,
  PageHeader,
  Table,
} from '../components/common/UI'
import styles from './Pages.module.css'
export default function Users() {
  const data = useDashboard((s) => s.data)!
  const self = useAuth((s) => s.user?.user_id)
  const actions = useActions()
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [pending, setPending] = useState(false)
  async function run(action: () => Promise<unknown>, success: string) {
    setError('')
    setMessage('')
    try {
      await action()
      setMessage(success)
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Không thực hiện được thao tác.')
    }
  }
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = event.currentTarget
    const values = new FormData(form)
    const email = String(values.get('email') || '').trim()
    setPending(true)
    setError('')
    setMessage('')
    try {
      const user = await actions.createUser({
        username: String(values.get('username') || '').trim(),
        full_name: String(values.get('full_name') || '').trim(),
        email: email || null,
        role: String(values.get('role')) as Role,
        password: String(values.get('password') || ''),
      })
      form.reset()
      setMessage(`Đã tạo tài khoản ${user.username}.`)
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Không tạo được tài khoản.')
    } finally {
      setPending(false)
    }
  }
  return (
    <>
      <PageHeader
        title="Người dùng"
        subtitle={`${data.users.length} tài khoản · Quản lý vai trò và quyền truy cập`}
      />
      {message && <Notice>{message}</Notice>}
      {error && <Notice error>{error}</Notice>}
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
                    onChange={(e) =>
                      void run(
                        () => actions.updateUser(user.user_id, { role: e.target.value as Role }),
                        `Đã đổi vai trò của ${user.username}.`,
                      )
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
                  <ActionButton
                    disabled={user.user_id === self}
                    action={() =>
                      actions.updateUser(user.user_id, { is_active: !user.is_active })
                    }
                    success={user.is_active ? 'Đã khóa tài khoản.' : 'Đã mở khóa tài khoản.'}
                  >
                    {user.user_id === self ? 'Bạn' : user.is_active ? 'Khóa' : 'Mở khóa'}
                  </ActionButton>
                </td>
              </tr>
            ))}
          </Table>
        </div>
        <form className={styles.sideColumn} onSubmit={submit}>
          <Card title="Tạo tài khoản">
            <Field label="Tên đăng nhập" id="new-username">
              <input id="new-username" name="username" autoComplete="off" required />
            </Field>
            <Field label="Họ và tên" id="new-fullname">
              <input id="new-fullname" name="full_name" autoComplete="off" required />
            </Field>
            <Field label="Email (không bắt buộc)" id="new-email">
              <input id="new-email" name="email" type="email" autoComplete="off" />
            </Field>
            <Field label="Vai trò" id="new-role">
              <select id="new-role" name="role" defaultValue="VIEWER">
                <option value="VIEWER">VIEWER · chỉ xem</option>
                <option value="OPERATOR">OPERATOR · xử lý cảnh báo, điều khiển</option>
                <option value="ADMIN">ADMIN · toàn quyền</option>
              </select>
            </Field>
            <Field label="Mật khẩu tạm" id="new-password" hint="ít nhất 8 ký tự">
              <input
                id="new-password"
                name="password"
                type="password"
                autoComplete="new-password"
                minLength={8}
                required
              />
            </Field>
            <Button variant="primary" type="submit" disabled={pending}>
              {pending ? 'Đang tạo…' : 'Tạo tài khoản'}
            </Button>
          </Card>
        </form>
      </div>
    </>
  )
}
