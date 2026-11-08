import { useEffect, useState, type FormEvent } from 'react'
import { Navigate } from 'react-router-dom'
import { ArrowRight, BellRing, Gauge, ShieldCheck } from 'lucide-react'
import { Brand } from '@/components/app/brand'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Notice } from '@/components/app/kit'
import { dataSource } from '@/services/api'
import { useAuth } from '@/store/auth'

const roles = [
  { role: 'VIEWER', text: 'Xem thiết bị, dữ liệu cảm biến, biểu đồ và lịch sử', icon: Gauge },
  { role: 'OPERATOR', text: 'Xử lý cảnh báo, điều khiển và cấu hình thiết bị', icon: BellRing },
  { role: 'ADMIN', text: 'Toàn quyền, gồm quản lý người dùng và thiết bị', icon: ShieldCheck },
]

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
    <div className="grid min-h-svh lg:grid-cols-[1.1fr_1fr]">
      <section className="relative hidden flex-col justify-between overflow-hidden bg-[#0b1524] p-10 text-slate-200 lg:flex">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(60%_50%_at_20%_10%,rgba(59,130,246,0.28),transparent),radial-gradient(50%_40%_at_90%_80%,rgba(16,185,129,0.16),transparent)]"
        />
        <div className="relative">
          <Brand onDark />
        </div>
        <div className="relative max-w-lg space-y-6">
          <h1 className="text-3xl font-semibold leading-tight text-white text-balance">
            Giám sát môi trường và an ninh kho hàng theo thời gian thực
          </h1>
          <p className="text-sm leading-relaxed text-slate-400">
            Nhiệt độ, độ ẩm, khói, cửa kho và chuyển động trên một màn hình. Điều khiển quạt và còi
            báo động từ xa.
          </p>
          <ul className="space-y-3">
            {roles.map(({ role, text, icon: Icon }) => (
              <li key={role} className="flex items-start gap-3 text-sm">
                <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg border border-white/10 bg-white/5">
                  <Icon className="size-4 text-slate-300" />
                </span>
                <span>
                  <strong className="font-mono text-xs tracking-wide text-white">{role}</strong>
                  <span className="block text-slate-400">{text}</span>
                </span>
              </li>
            ))}
          </ul>
        </div>
        <p className="relative font-mono text-[11px] text-slate-500">
          {dataSource === 'api'
            ? 'Kết nối trực tiếp tới hệ thống đang chạy.'
            : 'Bản giao diện · Dữ liệu mô phỏng'}
        </p>
      </section>

      <main className="flex items-center justify-center px-4 py-10">
        <div className="w-full max-w-sm space-y-6">
          <div className="lg:hidden">
            <Brand />
          </div>
          <div className="space-y-1">
            <h2 className="text-2xl font-semibold tracking-tight">Đăng nhập</h2>
            <p className="text-sm text-muted-foreground">Dùng tài khoản do quản trị viên cấp.</p>
          </div>
          <Card className="shadow-sm">
            <CardContent className="pt-6">
              <form className="space-y-4" onSubmit={submit}>
                {error && <Notice error>{error}</Notice>}
                <div className="space-y-1.5">
                  <Label htmlFor="username">Tên đăng nhập</Label>
                  <Input
                    id="username"
                    name="username"
                    autoComplete="username"
                    placeholder="operator01"
                    required
                    disabled={busy}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="password">Mật khẩu</Label>
                  <Input
                    id="password"
                    name="password"
                    type="password"
                    autoComplete="current-password"
                    required
                    disabled={busy}
                  />
                </div>
                <Button type="submit" className="w-full" disabled={busy}>
                  {busy ? 'Đang đăng nhập…' : 'Đăng nhập'}
                  {!busy && <ArrowRight className="size-4" />}
                </Button>
              </form>
            </CardContent>
          </Card>
          <p className="text-xs text-muted-foreground">
            Quên mật khẩu hoặc tài khoản bị khóa? Liên hệ quản trị viên để được cấp lại.
          </p>
        </div>
      </main>
    </div>
  )
}
