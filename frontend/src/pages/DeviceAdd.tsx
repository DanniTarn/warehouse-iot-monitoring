import { useState, type FormEvent } from 'react'
import { useDashboard } from '../store/dashboard'
import { LIFECYCLES } from '../services/config'
import { BackLink, Badge, Button, Card, Field, Notice, PageHeader } from '../components/common/UI'
import styles from './Pages.module.css'
export default function DeviceAdd() {
  const data = useDashboard((s) => s.data)!
  const [kind, setKind] = useState('environment')
  const [notice, setNotice] = useState(false)
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setNotice(true)
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
                <input id="add-name" defaultValue="Node 3 · Môi trường" required />
              </Field>
              <Field id="add-code" label="Mã thiết bị" hint="device_code · duy nhất">
                <input
                  id="add-code"
                  defaultValue="NODE3_ENV"
                  pattern="[A-Z0-9_]+"
                  title="Chữ in hoa, số và dấu gạch dưới"
                  required
                  className="mono"
                />
              </Field>
              <Field id="add-mac" label="Địa chỉ MAC của ESP32" hint="mac_address">
                <input
                  id="add-mac"
                  defaultValue="24:6F:28:B0:77:5A"
                  pattern="([0-9A-Fa-f]{2}:){5}[0-9A-Fa-f]{2}"
                  title="Ví dụ: 24:6F:28:B0:77:5A"
                  required
                  className="mono"
                />
              </Field>
              <Field id="add-warehouse" label="Kho" hint="warehouse_id">
                <select id="add-warehouse">
                  {data.warehouses.map((w) => (
                    <option value={w.warehouse_id} key={w.warehouse_id}>
                      {w.warehouse_name}
                    </option>
                  ))}
                </select>
              </Field>
              <Field id="add-owner" label="Người phụ trách" hint="assigned_user_id">
                <select id="add-owner" defaultValue="2">
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
            <fieldset>
              <legend>Loại node</legend>
              <div className={styles.fields}>
                <label className={styles.radio}>
                  <input
                    type="radio"
                    name="kind"
                    checked={kind === 'environment'}
                    onChange={() => setKind('environment')}
                  />
                  Môi trường · DHT22, MQ-2, Relay
                </label>
                <label className={styles.radio}>
                  <input
                    type="radio"
                    name="kind"
                    checked={kind === 'security'}
                    onChange={() => setKind('security')}
                  />
                  An ninh · MC-38, PIR, Buzzer, LED
                </label>
              </div>
            </fieldset>
            <p className="small secondary">
              Thiết bị mới có trạng thái REGISTERED. Token xác thực sẽ được tạo sau khi đăng ký.
            </p>
            <Button type="submit" variant="primary">
              Đăng ký thiết bị
            </Button>
            {notice && (
              <Notice>
                Đăng ký và cấp token được triển khai ở mốc 29/10. Chưa tạo thiết bị hoặc token.
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
