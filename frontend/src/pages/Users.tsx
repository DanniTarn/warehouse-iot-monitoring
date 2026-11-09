import { useState, type FormEvent } from 'react'
import { UserPlus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { PageHeader } from '@/components/app/page-header'
import { ActionButton, Field, Notice, ToneBadge } from '@/components/app/kit'
import { NativeSelect } from '@/components/app/native-select'
import { dateTime } from '@/services/format'
import type { Role } from '@/services/types'
import { useActions } from '@/store/actions'
import { useAuth } from '@/store/auth'
import { useDashboard } from '@/store/dashboard'

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
    <div className="space-y-4">
      <PageHeader
        title="Người dùng"
        subtitle={`${data.users.length} tài khoản · Quản lý vai trò và quyền truy cập`}
      />
      {message && <Notice>{message}</Notice>}
      {error && <Notice error>{error}</Notice>}

      <div className="grid items-start gap-4 xl:grid-cols-[1fr_320px]">
        <div className="overflow-x-auto rounded-xl border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Tài khoản</TableHead>
                <TableHead>Vai trò</TableHead>
                <TableHead>Trạng thái</TableHead>
                <TableHead>Đăng nhập gần nhất</TableHead>
                <TableHead className="text-right">Thao tác</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.users.map((user) => (
                <TableRow key={user.user_id}>
                  <TableCell>
                    <div className="flex flex-col">
                      <span className="font-medium">{user.full_name}</span>
                      <span className="font-mono text-[11px] text-muted-foreground">
                        {user.username} · {user.email || '—'}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <NativeSelect
                      aria-label={`Vai trò của ${user.username}`}
                      value={user.role}
                      disabled={user.user_id === self}
                      onChange={(e) =>
                        void run(
                          () => actions.updateUser(user.user_id, { role: e.target.value as Role }),
                          `Đã đổi vai trò của ${user.username}.`,
                        )
                      }
                      wrapperClassName="w-auto"
                      iconClassName="right-2 size-3.5"
                      className="h-8 w-auto pl-2 pr-7 font-mono text-xs"
                    >
                      {['ADMIN', 'OPERATOR', 'VIEWER'].map((role) => (
                        <option key={role}>{role}</option>
                      ))}
                    </NativeSelect>
                  </TableCell>
                  <TableCell>
                    <ToneBadge tone={user.is_active ? 'good' : 'muted'}>
                      {user.is_active ? 'Hoạt động' : 'Đã khóa'}
                    </ToneBadge>
                  </TableCell>
                  <TableCell className="font-mono text-xs">{dateTime(user.last_login)}</TableCell>
                  <TableCell className="text-right">
                    <ActionButton
                      size="sm"
                      variant="outline"
                      disabled={user.user_id === self}
                      action={() =>
                        actions.updateUser(user.user_id, { is_active: !user.is_active })
                      }
                      success={user.is_active ? 'Đã khóa tài khoản.' : 'Đã mở khóa tài khoản.'}
                    >
                      {user.user_id === self ? 'Bạn' : user.is_active ? 'Khóa' : 'Mở khóa'}
                    </ActionButton>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>

        <form onSubmit={submit}>
          <Card className="shadow-none">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <UserPlus className="size-4 text-muted-foreground" />
                Tạo tài khoản
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <Field label="Tên đăng nhập" id="new-username">
                <Input id="new-username" name="username" autoComplete="off" required />
              </Field>
              <Field label="Họ và tên" id="new-fullname">
                <Input id="new-fullname" name="full_name" autoComplete="off" required />
              </Field>
              <Field label="Email (không bắt buộc)" id="new-email">
                <Input id="new-email" name="email" type="email" autoComplete="off" />
              </Field>
              <Field label="Vai trò" id="new-role">
                <NativeSelect id="new-role" name="role" defaultValue="VIEWER">
                  <option value="VIEWER">VIEWER · chỉ xem</option>
                  <option value="OPERATOR">OPERATOR · xử lý cảnh báo, điều khiển</option>
                  <option value="ADMIN">ADMIN · toàn quyền</option>
                </NativeSelect>
              </Field>
              <Field label="Mật khẩu tạm" id="new-password" hint="ít nhất 8 ký tự">
                <Input
                  id="new-password"
                  name="password"
                  type="password"
                  autoComplete="new-password"
                  minLength={8}
                  required
                />
              </Field>
              <Button type="submit" className="w-full" disabled={pending}>
                {pending ? 'Đang tạo…' : 'Tạo tài khoản'}
              </Button>
            </CardContent>
          </Card>
        </form>
      </div>
    </div>
  )
}
