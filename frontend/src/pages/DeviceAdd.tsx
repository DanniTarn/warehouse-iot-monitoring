import { useState, type FormEvent } from 'react'
import { useDashboard } from '../store/dashboard'
import { useActions } from '../store/actions'
import { LIFECYCLES } from '../services/config'
import {
  ActionLink,
  BackLink,
  Badge,
  Button,
  Card,
  Field,
  Notice,
  PageHeader,
  SecretToken,
} from '../components/common/UI'
import styles from './Pages.module.css'
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
    <>
      <div>
        <BackLink />
        <PageHeader title="Thêm thiết bị" />
      </div>
      <ol className={styles.steps} aria-label="Các bước">
        {['Đăng ký', 'Nạp token vào firmware', 'Kích hoạt'].map((label, index) => (
          <li key={label} aria-current={index === 0 ? 'step' : undefined}>
            <span>{index + 1}</span>
            <div>
              <strong>{label}</strong>
              <div className="small secondary">
                {index === 0
                  ? 'Nhập thông tin thiết bị'
                  : index === 1
                    ? 'Sao chép token một lần'
                    : 'Cho phép thiết bị kết nối'}
              </div>
            </div>
          </li>
        ))}
      </ol>
      <div className={styles.columns}>
        <form className={styles.formMain} onSubmit={submit}>
          <Card title="Thông tin đăng ký">
            <div className={styles.fields}>
              <Field id="add-name" label="Tên hiển thị" hint="device_name">
                <input id="add-name" name="device_name" required />
              </Field>
              <Field id="add-code" label="Mã thiết bị" hint="device_code · duy nhất">
                <input
                  id="add-code"
                  name="device_code"
                  pattern="NODE[0-9]+_(ENV|SEC)"
                  title="Ví dụ: NODE3_ENV hoặc NODE4_SEC"
                  required
                  className="mono"
                />
              </Field>
              <Field id="add-mac" label="Địa chỉ MAC của ESP32" hint="mac_address">
                <input
                  id="add-mac"
                  name="mac_address"
                  pattern="([0-9A-Fa-f]{2}:){5}[0-9A-Fa-f]{2}"
                  title="Ví dụ: 24:6F:28:B0:77:5A"
                  required
                  className="mono"
                />
              </Field>
              <Field id="add-warehouse" label="Kho" hint="warehouse_id">
                <select id="add-warehouse" name="warehouse_id" defaultValue="">
                  <option value="">Chưa chọn kho</option>
                  {data.warehouses.map((w) => (
                    <option value={w.warehouse_id} key={w.warehouse_id}>
                      {w.warehouse_name}
                    </option>
                  ))}
                </select>
              </Field>
              <Field id="add-owner" label="Người phụ trách" hint="assigned_user_id">
                <select id="add-owner" name="assigned_user_id" defaultValue="">
                  <option value="">Chưa phân công</option>
                  {data.users
                    .filter((user) => user.is_active)
                    .map((user) => (
                      <option key={user.user_id} value={user.user_id}>
                        {user.username}
                      </option>
                    ))}
                </select>
              </Field>
            </div>
            <p className="small secondary">
              Thiết bị mới có trạng thái REGISTERED. Token xác thực sẽ được tạo sau khi đăng ký.
            </p>
            <Button type="submit" variant="primary" disabled={pending}>
              {pending ? 'Đang đăng ký…' : 'Đăng ký thiết bị'}
            </Button>
            {error && <Notice error>{error}</Notice>}
            {created && (
              <Notice>
                Đã đăng ký {created.name} · <span className="mono">{created.code}</span>. Token chỉ
                hiển thị một lần, sao chép ngay và không đưa lên GitHub.
                <SecretToken token={created.token} />
                <ActionLink to={`/devices/${created.id}`} primary>
                  Mở trang thiết bị
                </ActionLink>
              </Notice>
            )}
          </Card>
        </form>
        <div className={styles.sideColumn}>
          <Card title="Vòng đời thiết bị">
            {Object.entries(LIFECYCLES).map(([key, label]) => (
              <div key={key} className="stack">
                <Badge value={key} />
                <p className="small secondary">{label}</p>
              </div>
            ))}
          </Card>
          <Notice>Token chỉ hiển thị một lần. Sao chép ngay và không đưa lên GitHub.</Notice>
        </div>
      </div>
    </>
  )
}
