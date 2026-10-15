import { useState, type FormEvent } from 'react'
import type { DeviceConfig } from '../../services/types'
import { useAuth } from '../../store/auth'
import { Button, Card, Field, Notice } from '../common/UI'
import styles from '../../pages/Pages.module.css'
export function ConfigForm({
  config,
  environment,
}: {
  config: DeviceConfig
  environment: boolean
}) {
  const viewer = useAuth((s) => s.user?.role === 'VIEWER')
  const [form, setForm] = useState(config)
  const [notice, setNotice] = useState(false)
  const dirty = JSON.stringify(form) !== JSON.stringify(config)
  function submit(event: FormEvent) {
    event.preventDefault()
    setNotice(true)
  }
  return (
    <Card title="Cấu hình thiết bị">
      <form className="stack" onSubmit={submit}>
        <div className={styles.fields}>
          {environment && (
            <>
              <Field label="Ngưỡng độ ẩm (%)" id="humidity" hint="humidity_threshold">
                <input
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
                <input
                  type="number"
                  id="smoke"
                  min="0"
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
            <input
              type="number"
              id="interval"
              min="1"
              value={form.telemetry_interval || ''}
              onChange={(e) => setForm({ ...form, telemetry_interval: Number(e.target.value) })}
              disabled={viewer}
              required
            />
          </Field>
        </div>
        <div>
          <label className={styles.radio}>
            <input
              type="checkbox"
              checked={form.night_mode_enabled}
              onChange={(e) => setForm({ ...form, night_mode_enabled: e.target.checked })}
              disabled={viewer}
            />
            Bật chế độ ban đêm
          </label>
          <p className="mono small muted">night_mode_enabled</p>
        </div>
        {viewer ? (
          <p className={styles.viewerNote}>
            Tài khoản Viewer chỉ có quyền xem, không thể thay đổi cấu hình.
          </p>
        ) : (
          <div className="row">
            <Button type="submit" variant="primary" disabled={!dirty}>
              Lưu cấu hình
            </Button>
            <Button
              disabled={!dirty}
              onClick={() => {
                setForm(config)
                setNotice(false)
              }}
            >
              Hoàn tác
            </Button>
          </div>
        )}
        {notice && (
          <Notice>
            Lưu cấu hình và nhật ký UPDATE_CONFIG được triển khai ở mốc 29/10. Chưa lưu thay đổi.
          </Notice>
        )}
      </form>
    </Card>
  )
}
