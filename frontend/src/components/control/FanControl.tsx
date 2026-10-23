import { useState } from 'react'
import { useAuth } from '../../store/auth'
import { useDashboard } from '../../store/dashboard'
import { useActions } from '../../store/actions'
import { MONITORING } from '../../services/config'
import { fanState } from '../../services/dashboardView'
import type { ManualCommandType } from '../../services/types'
import { Badge, Notice } from '../common/UI'
import styles from '../common/UI.module.css'
export function FanControl({
  detailed = false,
  deviceId,
}: {
  detailed?: boolean
  deviceId?: number
}) {
  const viewer = useAuth((s) => s.user?.role === 'VIEWER')
  const data = useDashboard((s) => s.data)
  const actions = useActions()
  const [pending, setPending] = useState<ManualCommandType | ''>('')
  const [error, setError] = useState('')
  const target =
    deviceId ??
    data?.devices.find((device) => device.device_code === MONITORING.environmentCode)?.device_id
  const { mode, running } = data
    ? fanState(data, target)
    : { mode: undefined, running: undefined }
  const options: [ManualCommandType, 'auto' | 'on' | 'off', string][] = [
    ['FAN_AUTO', 'auto', 'Tự động'],
    ['FAN_ON', 'on', detailed ? 'Bật cưỡng chế' : 'Bật'],
    ['FAN_OFF', 'off', detailed ? 'Tắt cưỡng chế' : 'Tắt'],
  ]
  async function send(command: ManualCommandType) {
    if (target === undefined) {
      setError('Không tìm thấy thiết bị môi trường.')
      return
    }
    setPending(command)
    setError('')
    try {
      await actions.sendCommand(target, command)
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Không gửi được lệnh điều khiển.')
    } finally {
      setPending('')
    }
  }
  return (
    <div className="stack">
      <div className="row between">
        <strong>Quạt hút · Relay 5V</strong>
        <Badge tone={running ? 'good' : 'neutral'}>{running ? 'Đang chạy' : 'Đang tắt'}</Badge>
      </div>
      <div className={styles.segmented} role="group" aria-label="Chế độ quạt">
        {options.map(([command, key, label]) => (
          <button
            key={command}
            aria-pressed={mode === key}
            aria-busy={pending === command}
            disabled={viewer || pending !== ''}
            onClick={() => void send(command)}
          >
            {label}
          </button>
        ))}
      </div>
      <p className="small secondary">Quy tắc: độ ẩm &gt; 65 % thì bật quạt.</p>
      {error && <Notice error>{error}</Notice>}
      {pending && <Notice>Đang gửi lệnh {pending}…</Notice>}
      {viewer && (
        <p className="small secondary">
          Tài khoản Viewer chỉ có quyền xem. Không thể điều khiển thiết bị.
        </p>
      )}
    </div>
  )
}
