import { useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { ArrowRight, CheckCircle2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { PageHeader } from '@/components/app/page-header'
import { BackLink, Field, Notice, SecretToken, ToneBadge } from '@/components/app/kit'
import { NativeSelect } from '@/components/app/native-select'
import { LIFECYCLES } from '@/services/config'
import { useActions } from '@/store/actions'
import { useDashboard } from '@/store/dashboard'
import { cn } from '@/lib/utils'

const steps = [
  ['Đăng ký', 'Nhập thông tin thiết bị'],
  ['Nạp token vào firmware', 'Sao chép token một lần'],
  ['Kích hoạt', 'Cho phép thiết bị kết nối'],
]

export default function DeviceAdd() {
  const data = useDashboard((s) => s.data)!
  const actions = useActions()
  const [created, setCreated] = useState<{ id: number; name: string; code: string; token: string }>()
  const [pending, setPending] = useState(false)
  const [error, setError] = useState('')
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = event.currentTarget
    const values = new FormData(form)
    const warehouse = String(values.get('warehouse_id') || '')
    const owner = String(values.get('assigned_user_id') || '')
    setPending(true)
    setError('')
    try {
      const result = await actions.registerDevice({
        device_name: String(values.get('device_name') || '').trim(),
        device_code: String(values.get('device_code') || '')
          .trim()
          .toUpperCase(),
        mac_address: String(values.get('mac_address') || '').trim(),
        warehouse_id: warehouse ? Number(warehouse) : null,
        assigned_user_id: owner ? Number(owner) : null,
      })
      setCreated({
        id: result.device.device_id,
        name: result.device.device_name,
        code: result.device.device_code,
        token: result.auth_token,
      })
      form.reset()
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Không đăng ký được thiết bị.')
    } finally {
      setPending(false)
    }
  }
  return (
    <div className="space-y-4">
      <BackLink />
      <PageHeader title="Thêm thiết bị" />

      <ol className="grid gap-2 sm:grid-cols-3" aria-label="Các bước">
        {steps.map(([label, description], index) => (
          <li
            key={label}
            aria-current={index === 0 ? 'step' : undefined}
            className={cn(
              'flex items-start gap-3 rounded-xl border bg-card p-3',
              index === 0 && 'border-primary/40 bg-accent/40',
            )}
          >
            <span
              className={cn(
                'flex size-7 shrink-0 items-center justify-center rounded-full border text-xs font-semibold',
                index === 0
                  ? 'border-primary bg-primary text-primary-foreground'
                  : 'text-muted-foreground',
              )}
            >
              {index + 1}
            </span>
            <div className="min-w-0">
              <p className="text-sm font-medium">{label}</p>
              <p className="text-xs text-muted-foreground">{description}</p>
            </div>
          </li>
        ))}
      </ol>

      <div className="grid items-start gap-4 lg:grid-cols-[1fr_320px]">
        <form onSubmit={submit}>
          <Card className="shadow-none">
            <CardHeader>
              <CardTitle className="text-base">Thông tin đăng ký</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Tên hiển thị" id="add-name" hint="device_name">
                  <Input id="add-name" name="device_name" required />
                </Field>
                <Field label="Mã thiết bị" id="add-code" hint="device_code · duy nhất">
                  <Input
                    id="add-code"
                    name="device_code"
                    pattern="NODE[0-9]+_(ENV|SEC)"
                    title="Ví dụ: NODE3_ENV hoặc NODE4_SEC"
                    required
                    className="font-mono"
                  />
                </Field>
                <Field label="Địa chỉ MAC của ESP32" id="add-mac" hint="mac_address">
                  <Input
                    id="add-mac"
                    name="mac_address"
                    pattern="([0-9A-Fa-f]{2}:){5}[0-9A-Fa-f]{2}"
                    title="Ví dụ: 24:6F:28:B0:77:5A"
                    required
                    className="font-mono"
                  />
                </Field>
                <Field label="Kho" id="add-warehouse" hint="warehouse_id">
                  <NativeSelect id="add-warehouse" name="warehouse_id" defaultValue="">
                    <option value="">Chưa chọn kho</option>
                    {data.warehouses.map((w) => (
                      <option value={w.warehouse_id} key={w.warehouse_id}>
                        {w.warehouse_name}
                      </option>
                    ))}
                  </NativeSelect>
                </Field>
                <Field label="Người phụ trách" id="add-owner" hint="assigned_user_id">
                  <NativeSelect id="add-owner" name="assigned_user_id" defaultValue="">
                    <option value="">Chưa phân công</option>
                    {data.users
                      .filter((user) => user.is_active)
                      .map((user) => (
                        <option key={user.user_id} value={user.user_id}>
                          {user.username}
                        </option>
                      ))}
                  </NativeSelect>
                </Field>
              </div>
              <p className="text-xs text-muted-foreground">
                Thiết bị mới có trạng thái REGISTERED. Token xác thực sẽ được tạo sau khi đăng ký.
              </p>
              <Button type="submit" disabled={pending}>
                {pending ? 'Đang đăng ký…' : 'Đăng ký thiết bị'}
              </Button>
              {error && <Notice error>{error}</Notice>}
              {created && (
                <Notice>
                  Đã đăng ký {created.name} · <span className="font-mono">{created.code}</span>. Token
                  chỉ hiển thị một lần, sao chép ngay và không đưa lên GitHub.
                  <SecretToken token={created.token} />
                  <Button asChild variant="link" className="mt-2 h-auto p-0">
                    <Link to={`/devices/${created.id}`}>
                      Mở trang thiết bị
                      <ArrowRight className="size-4" />
                    </Link>
                  </Button>
                </Notice>
              )}
            </CardContent>
          </Card>
        </form>

        <div className="space-y-4">
          <Card className="shadow-none">
            <CardHeader>
              <CardTitle className="text-base">Vòng đời thiết bị</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {Object.entries(LIFECYCLES).map(([key, label]) => (
                <div key={key} className="space-y-1">
                  <ToneBadge
                    tone={
                      key === 'ACTIVE'
                        ? 'good'
                        : key === 'OFFLINE'
                          ? 'warning'
                          : key === 'DECOMMISSIONED'
                            ? 'critical'
                            : 'muted'
                    }
                  >
                    {key}
                  </ToneBadge>
                  <p className="text-xs text-muted-foreground">{label}</p>
                </div>
              ))}
            </CardContent>
          </Card>
          <div className="flex items-start gap-2 rounded-xl border bg-card p-3 text-sm text-muted-foreground">
            <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-emerald-600" />
            Token chỉ hiển thị một lần. Sao chép ngay và không đưa lên GitHub.
          </div>
        </div>
      </div>
    </div>
  )
}
