import { useState, type FormEvent } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Field, Notice } from '@/components/app/kit'
import type { GuardMode } from '@/services/types'
import type { ConfigPatch, DeviceConfig } from '@/services/types'
import { useActions } from '@/store/actions'
import { useAuth } from '@/store/auth'
import { cn } from '@/lib/utils'

export function ConfigForm({
  config,
  environment,
}: {
  config: DeviceConfig
  environment: boolean
}) {
  const viewer = useAuth((s) => s.user?.role === 'VIEWER')
  const actions = useActions()
  const [form, setForm] = useState(config)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState('')
  const [saved, setSaved] = useState(false)
  function changes(): ConfigPatch {
    const patch: ConfigPatch = {}
    if (form.temperature_threshold !== config.temperature_threshold)
      patch.temperature_threshold = form.temperature_threshold
    if (form.humidity_threshold !== config.humidity_threshold)
      patch.humidity_threshold = form.humidity_threshold
    if (form.smoke_gas_threshold !== config.smoke_gas_threshold)
      patch.smoke_gas_threshold = form.smoke_gas_threshold
    if (form.telemetry_interval !== config.telemetry_interval)
      patch.telemetry_interval = form.telemetry_interval
    if (form.night_mode_enabled !== config.night_mode_enabled)
      patch.night_mode_enabled = form.night_mode_enabled
    if (form.curfew_start_hour !== config.curfew_start_hour)
      patch.curfew_start_hour = form.curfew_start_hour
    if (form.curfew_end_hour !== config.curfew_end_hour)
      patch.curfew_end_hour = form.curfew_end_hour
    if (form.guard_mode !== config.guard_mode) patch.guard_mode = form.guard_mode
    return patch
  }
  const dirty = Object.keys(changes()).length > 0
  async function submit(event: FormEvent) {
    event.preventDefault()
    if (!dirty || pending) return
    setPending(true)
    setError('')
    setSaved(false)
    try {
      setForm(await actions.updateConfig(config.device_id, changes()))
      setSaved(true)
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Không lưu được cấu hình.')
    } finally {
      setPending(false)
    }
  }
  return (
    <Card className="shadow-none">
      <CardHeader>
        <CardTitle className="text-base">Cấu hình thiết bị</CardTitle>
      </CardHeader>
      <CardContent>
        <form className="space-y-4" onSubmit={submit}>
          <div className="grid gap-4 sm:grid-cols-2">
            {environment && (
              <>
                <Field label="Ngưỡng độ ẩm (%)" id="humidity" hint="humidity_threshold">
                  <Input
                    type="number"
                    id="humidity"
                    min="0"
                    max="100"
                    step="any"
                    value={form.humidity_threshold ?? ''}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        humidity_threshold: e.target.value === '' ? null : Number(e.target.value),
                      })
                    }
                    disabled={viewer}
                    required
                  />
                </Field>
                <Field label="Ngưỡng khói / khí gas" id="smoke" hint="smoke_gas_threshold">
                  <Input
                    type="number"
                    id="smoke"
                    min="0"
                    max="100000"
                    step="any"
                    value={form.smoke_gas_threshold ?? ''}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        smoke_gas_threshold: e.target.value === '' ? null : Number(e.target.value),
                      })
                    }
                    disabled={viewer}
                    required
                  />
                </Field>
              </>
            )}
            {!environment && (
              <>
                <Field label="Giờ bắt đầu giới nghiêm" id="curfew-start" hint="curfew_start_hour">
                  <Input
                    type="number"
                    id="curfew-start"
                    min="0"
                    max="23"
                    step="1"
                    value={form.curfew_start_hour}
                    onChange={(e) =>
                      setForm({ ...form, curfew_start_hour: Number(e.target.value) })
                    }
                    disabled={viewer}
                    required
                  />
                </Field>
                <Field label="Giờ kết thúc giới nghiêm" id="curfew-end" hint="curfew_end_hour">
                  <Input
                    type="number"
                    id="curfew-end"
                    min="0"
                    max="23"
                    step="1"
                    value={form.curfew_end_hour}
                    onChange={(e) => setForm({ ...form, curfew_end_hour: Number(e.target.value) })}
                    disabled={viewer}
                    required
                  />
                </Field>
              </>
            )}
            <Field label="Chu kỳ gửi dữ liệu (giây)" id="interval" hint="telemetry_interval">
              <Input
                type="number"
                id="interval"
                min="1"
                max="3600"
                step="1"
                value={form.telemetry_interval || ''}
                onChange={(e) => setForm({ ...form, telemetry_interval: Number(e.target.value) })}
                disabled={viewer}
                required
              />
            </Field>
          </div>
          {!environment && (
            <div className="space-y-1.5">
              <span className="text-sm font-medium">Chế độ cảnh giới</span>
              <div
                className="grid grid-cols-3 gap-1 rounded-lg border bg-muted/40 p-1"
                role="group"
                aria-label="Chế độ cảnh giới"
              >
                {(
                  [
                    ['AUTO', 'Tự động'],
                    ['ON', 'Bật'],
                    ['OFF', 'Tắt'],
                  ] as [GuardMode, string][]
                ).map(([value, label]) => (
                  <Button
                    key={value}
                    type="button"
                    size="sm"
                    variant="ghost"
                    aria-pressed={form.guard_mode === value}
                    disabled={viewer}
                    onClick={() => setForm({ ...form, guard_mode: value })}
                    className={cn(
                      'h-8',
                      form.guard_mode === value &&
                        'bg-card text-foreground shadow-xs hover:bg-card',
                    )}
                  >
                    {label}
                  </Button>
                ))}
              </div>
              <p className="text-xs text-muted-foreground">
                Tự động bật trong giờ giới nghiêm. Bật hoặc Tắt ghi đè lịch.
              </p>
            </div>
          )}
          {viewer ? (
            <p className="text-xs text-muted-foreground">
              Tài khoản Viewer chỉ có quyền xem, không thể thay đổi cấu hình.
            </p>
          ) : (
            <div className="flex flex-wrap items-center gap-2">
              <Button type="submit" disabled={!dirty || pending}>
                {pending ? 'Đang lưu…' : 'Lưu cấu hình'}
              </Button>
              <Button
                type="button"
                variant="outline"
                disabled={!dirty || pending}
                onClick={() => {
                  setForm(config)
                  setError('')
                  setSaved(false)
                }}
              >
                Hoàn tác
              </Button>
            </div>
          )}
          {error && <Notice error>{error}</Notice>}
          {saved && <Notice>Đã lưu cấu hình.</Notice>}
        </form>
      </CardContent>
    </Card>
  )
}
