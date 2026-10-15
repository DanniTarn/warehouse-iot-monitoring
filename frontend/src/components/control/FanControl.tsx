import { useState } from 'react'
import { useAuth } from '../../store/auth'
import { useDashboard } from '../../store/dashboard'
import { Badge, Notice } from '../common/UI'
import styles from '../common/UI.module.css'
export function FanControl({ detailed = false }: { detailed?: boolean }) {
  const viewer = useAuth((s) => s.user?.role === 'VIEWER')
  const mode = useDashboard((s) => s.data?.presentation.fan_mode)
  const [notice, setNotice] = useState(false)
  return (
    <div className="stack">
      <div className="row between">
        <strong>Quạt hút · Relay 5V</strong>
        <Badge tone="good">Đang chạy</Badge>
      </div>
      <div className={styles.segmented} role="group" aria-label="Chế độ quạt">
        {[
          ['auto', 'Tự động'],
          ['on', detailed ? 'Bật cưỡng chế' : 'Bật'],
          ['off', detailed ? 'Tắt cưỡng chế' : 'Tắt'],
        ].map(([key, label]) => (
          <button
            key={key}
            aria-pressed={mode === key}
            disabled={viewer}
            onClick={() => setNotice(true)}
          >
            {label}
          </button>
        ))}
      </div>
      <p className="small secondary">Quy tắc: độ ẩm &gt; 65 % thì bật quạt.</p>
      {notice && <Notice>Điều khiển thiết bị được triển khai ở mốc 24/10. Chưa gửi lệnh.</Notice>}
      {viewer && (
        <p className="small secondary">
          Tài khoản Viewer chỉ có quyền xem. Không thể điều khiển thiết bị.
        </p>
      )}
    </div>
  )
}
