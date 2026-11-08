import { useState, type FormEvent } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Checkbox } from '@/components/ui/checkbox'
import { Field, Notice } from '@/components/app/kit'
import type { ConfigPatch, DeviceConfig } from '@/services/types'
import { useActions } from '@/store/actions'
import { useAuth } from '@/store/auth'

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
          <label className="flex items-center gap-2 text-sm">
            <Checkbox
              checked={form.night_mode_enabled}
              onCheckedChange={(checked) =>
                setForm({ ...form, night_mode_enabled: checked === true })
              }
              disabled={viewer}
            />
            Bật chế độ ban đêm
          </label>
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
