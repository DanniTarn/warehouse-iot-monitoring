import { useState } from 'react'
import { useAuth } from '../store/auth'
import { useDashboard } from '../store/dashboard'
import { dateTime } from '../services/format'
import { Badge, Card, DeferredButton, Field, PageHeader } from '../components/common/UI'
import { Icon } from '../components/common/Icon'
import ui from '../components/common/UI.module.css'
import styles from './Pages.module.css'
export default function Alerts() {
  const data = useDashboard((s) => s.data)!
  const viewer = useAuth((s) => s.user?.role === 'VIEWER')
  const [tab, setTab] = useState('open')
  const [severity, setSeverity] = useState('')
  const [device, setDevice] = useState('')
  const open = data.alerts.filter((a) => !a.is_acknowledged).length
  const rows = data.alerts.filter(
    (a) =>
      (tab === 'all' || (tab === 'open' ? !a.is_acknowledged : a.is_acknowledged)) &&
      (!severity || severity === a.severity) &&
      (!device || device === String(a.device_id)),
  )
  return (
    <>
      <PageHeader title="Cảnh báo" subtitle="Theo dõi và xử lý các sự kiện bất thường trong kho" />
      <div className={ui.tabs} role="group" aria-label="Trạng thái cảnh báo">
        {[
          ['open', 'Đang mở', open],
          ['resolved', 'Đã xử lý', data.alerts.length - open],
          ['all', 'Tất cả', data.alerts.length],
        ].map(([key, title, count]) => (
          <button key={key} aria-pressed={tab === key} onClick={() => setTab(String(key))}>
            {title}
            <span className="mono small">{count}</span>
          </button>
        ))}
      </div>
      <div className={styles.toolbar}>
        <Field id="severity" label="Mức độ">
          <select id="severity" value={severity} onChange={(e) => setSeverity(e.target.value)}>
            <option value="">Tất cả mức độ</option>
            {['CRITICAL', 'WARNING', 'INFO'].map((value) => (
              <option key={value}>{value}</option>
            ))}
          </select>
        </Field>
        <Field id="alert-device" label="Thiết bị">
          <select id="alert-device" value={device} onChange={(e) => setDevice(e.target.value)}>
            <option value="">Tất cả thiết bị</option>
            {data.devices.map((d) => (
              <option value={d.device_id} key={d.device_id}>
                {d.device_code}
              </option>
            ))}
          </select>
        </Field>
      </div>
      <Card>
        {rows.map((alert) => (
          <article className={styles.alertRow} key={alert.alert_id}>
            <Badge value={alert.severity} />
            <div className={styles.alertText}>
              <strong>{alert.alert_message}</strong>
              <span className="mono small muted">
                {alert.alert_type} · {alert.device_code} · {dateTime(alert.created_at, true)}
              </span>
            </div>
            <div className={styles.alertActions}>
              {alert.is_acknowledged ? (
                <span className="good small">
                  <Icon name="check" size={14} /> Đã xử lý bởi {alert.resolved_by_username} ·{' '}
                  {dateTime(alert.resolved_at)}
                </span>
              ) : viewer ? (
                <span className="muted small">Chưa xử lý</span>
              ) : (
                <DeferredButton milestone="24/10">Xác nhận đã xử lý</DeferredButton>
              )}
            </div>
          </article>
        ))}
        {!rows.length && <p className={ui.empty}>Không có cảnh báo phù hợp.</p>}
      </Card>
      <p className="small secondary">
        Hiển thị {rows.length} / {data.alerts.length} cảnh báo
      </p>
    </>
  )
}
