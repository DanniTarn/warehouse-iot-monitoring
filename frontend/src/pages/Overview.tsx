import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../store/auth'
import { useDashboard } from '../store/dashboard'
import { useActions } from '../store/actions'
import { MONITORING } from '../services/config'
import { dateTime, number } from '../services/format'
import {
  ActionButton,
  Badge,
  Card,
  Connection,
  Heartbeat,
  PageHeader,
  Stat,
} from '../components/common/UI'
import { Icon } from '../components/common/Icon'
import { FanControl } from '../components/control/FanControl'
import { SensorChart } from '../components/charts/SensorChart'
import ui from '../components/common/UI.module.css'
import styles from './Pages.module.css'
export default function Overview() {
  const data = useDashboard((s) => s.data)!
  const connection = useDashboard((s) => s.connection)
  const viewer = useAuth((s) => s.user?.role === 'VIEWER')
  const actions = useActions()
  const [range, setRange] = useState(1)
  const envDevice = data.devices.find(
    (device) => device.device_code === MONITORING.environmentCode,
  )
  const secDevice = data.devices.find(
    (device) => device.device_code === MONITORING.securityCode,
  )
  const envConfig = data.configs.find((config) => config.device_id === envDevice?.device_id)
  const env = data.telemetry.find((row) => row.device_code === MONITORING.environmentCode)
  const sec = data.telemetry.find((row) => row.device_code === MONITORING.securityCode)
  const open = data.alerts.filter((alert) => !alert.is_acknowledged)
  const critical = open.find((alert) => alert.severity === 'CRITICAL')
  const envRows = data.telemetry.filter((row) => row.device_id === envDevice?.device_id)
  const newest = envRows.reduce((latest, row) => Math.max(latest, Date.parse(row.recorded_at)), 0)
  const series = envRows
    .filter((row) => Date.parse(row.recorded_at) >= newest - range * 3600000)
    .toReversed()
  const humidityThreshold = envConfig?.humidity_threshold ?? MONITORING.humidityThreshold
  const temperatureThreshold = envConfig?.temperature_threshold ?? 50
  const smokeThreshold = envConfig?.smoke_gas_threshold ?? MONITORING.smoke.threshold
  const humidityHigh = env?.humidity != null && env.humidity > humidityThreshold
  const temperatureHigh = env?.temperature != null && env.temperature > temperatureThreshold
  const smokeHigh = env?.smoke_gas_level != null && env.smoke_gas_level > smokeThreshold
  const silenceBuzzer = () => {
    if (!secDevice) return Promise.reject(new Error('Không tìm thấy thiết bị an ninh.'))
    return actions.sendCommand(secDevice.device_id, 'BUZZER_OFF')
  }
  return (
    <>
      <PageHeader
        title="Tổng quan"
        subtitle={
          <div className="row">
            <span>Kho chính</span>
            {connection === 'live' ? (
              <Badge tone="good">Trực tiếp</Badge>
            ) : (
              <Badge tone="neutral">Mất kết nối, đang thử lại…</Badge>
            )}
            <span className="mono small">Cập nhật {dateTime(data.snapshot_at, true)}</span>
          </div>
        }
      >
        <div className={ui.segmented} role="group" aria-label="Khoảng thời gian biểu đồ">
          {[1, 6, 24].map((hours) => (
            <button key={hours} aria-pressed={range === hours} onClick={() => setRange(hours)}>
              {hours} giờ
            </button>
          ))}
        </div>
      </PageHeader>
      {critical && (
        <div className={styles.banner} role="alert">
          <Icon name="critical" size={26} />
          <div className={styles.bannerText}>
            <span className="mono small">
              CRITICAL · {critical.alert_type} · {critical.device_code} ·{' '}
              {dateTime(critical.created_at, true)}
            </span>
            <strong>{critical.alert_message}</strong>
            {data.presentation.buzzer_sounding && (
              <span>Còi và đèn LED đỏ đang báo động tại chỗ.</span>
            )}
          </div>
          {viewer ? (
            <span>Tài khoản Viewer chỉ có quyền xem.</span>
          ) : (
            <div className="row">
              <ActionButton
                disabled={!data.presentation.buzzer_sounding || !secDevice}
                action={silenceBuzzer}
                success="Đã gửi lệnh tắt còi."
              >
                Tắt còi
              </ActionButton>
              <ActionButton
                action={() => actions.acknowledgeAlert(critical.alert_id)}
                success="Đã xác nhận cảnh báo."
              >
                Xác nhận đã xử lý
              </ActionButton>
            </div>
          )}
        </div>
      )}
      <section aria-label="Chỉ số hiện tại" className={styles.stats}>
        <Stat
          label="Nhiệt độ"
          sensor="DHT22"
          value={number(env?.temperature)}
          unit="°C"
          status={
            env?.temperature == null
              ? 'Chưa có dữ liệu'
              : temperatureHigh
                ? `Vượt ngưỡng ${temperatureThreshold} °C`
                : 'Bình thường'
          }
          tone={env?.temperature == null ? 'muted' : temperatureHigh ? 'warning' : 'good'}
        />
        <Stat
          label="Độ ẩm"
          sensor="DHT22"
          value={number(env?.humidity)}
          unit="%"
          status={
            env?.humidity == null
              ? 'Chưa có dữ liệu'
              : humidityHigh
                ? `Vượt ngưỡng ${humidityThreshold} %`
                : 'Bình thường'
          }
          tone={env?.humidity == null ? 'muted' : humidityHigh ? 'warning' : 'good'}
        />
        <Stat
          label="Khói / khí gas"
          sensor="MQ-2"
          value={number(env?.smoke_gas_level, 0)}
          unit={MONITORING.smoke.unit}
          status={
            env?.smoke_gas_level == null
              ? 'Chưa có dữ liệu'
              : smokeHigh
                ? `Vượt ngưỡng ${smokeThreshold} ${MONITORING.smoke.unit}`
                : 'Bình thường'
          }
          tone={env?.smoke_gas_level == null ? 'muted' : smokeHigh ? 'warning' : 'good'}
        />
        <Stat
          label="Cửa kho"
          sensor="MC-38"
          value={sec?.door_status == null ? '—' : sec.door_status ? 'Mở' : 'Đóng'}
          status={
            sec?.door_status == null
              ? 'Chưa có dữ liệu'
              : sec.door_status
                ? 'Ngoài giờ giới nghiêm'
                : 'Đóng'
          }
          tone={sec?.door_status ? 'critical' : 'good'}
        />
        <Stat
          label="Chuyển động"
          sensor="HC-SR501"
          value={sec?.motion_detected == null ? '—' : sec.motion_detected ? 'Có' : 'Không'}
          status={
            sec?.motion_detected == null
              ? 'Chưa có dữ liệu'
              : sec.motion_detected
                ? 'Có chuyển động'
                : 'Không có chuyển động'
          }
          tone={sec?.motion_detected ? 'critical' : 'muted'}
        />
      </section>
      <section aria-label="Biểu đồ cảm biến" className={styles.grid}>
        <SensorChart
          title="Nhiệt độ"
          unit="°C"
          sensor="DHT22"
          field="temperature"
          color="series-temp"
          domain={[24, 32]}
          data={series}
        />
        <SensorChart
          title="Độ ẩm"
          unit="%"
          sensor="DHT22"
          field="humidity"
          color="series-humidity"
          domain={[50, 80]}
          threshold={MONITORING.humidityThreshold}
          data={series}
        />
        <SensorChart
          title="Khói / khí gas"
          unit={MONITORING.smoke.unit}
          sensor="MQ-2"
          field="smoke_gas_level"
          color="series-smoke"
          domain={MONITORING.smoke.domain}
          threshold={MONITORING.smoke.threshold}
          data={series}
        />
      </section>
      <section className={styles.grid}>
        <Card title="Điều khiển nhanh">
          <FanControl />
          <div className="row between">
            <strong>Còi báo động</strong>
            <Badge tone={data.presentation.buzzer_sounding ? 'critical' : 'neutral'}>
              {data.presentation.buzzer_sounding ? 'Đang kêu' : 'Tắt'}
            </Badge>
          </div>
          <ActionButton
            disabled={viewer || !data.presentation.buzzer_sounding || !secDevice}
            action={silenceBuzzer}
            success="Đã gửi lệnh tắt còi."
          >
            Tắt còi
          </ActionButton>
          <span className="mono small muted">BUZZER_OFF · {MONITORING.securityCode}</span>
        </Card>
        <Card title="Thiết bị">
          {data.devices.slice(0, 2).map((device) => (
            <div className={styles.deviceRow} key={device.device_id}>
              <div className="row between">
                <Link to={`/devices/${device.device_id}`}>{device.device_name}</Link>
                <Connection device={device} />
              </div>
              <span className="mono small muted">{device.device_code}</span>
              <Heartbeat device={device} />
            </div>
          ))}
          <div className="row between">
            <span>Chế độ ban đêm</span>
            <Badge tone={envConfig?.night_mode_enabled ? 'info' : 'neutral'}>
              {envConfig?.night_mode_enabled ? 'Đang bật' : 'Đang tắt'}
            </Badge>
          </div>
          <div className="row between">
            <span>Đèn LED</span>
            <span className="critical">{data.presentation.led}</span>
          </div>
        </Card>
        <Card title="Cảnh báo đang mở">
          {open.slice(0, 5).map((alert) => (
            <div className={styles.smallAlert} key={alert.alert_id}>
              <div className="row between">
                <Badge value={alert.severity} />
                <span className="mono small muted">{dateTime(alert.created_at)}</span>
              </div>
              <p>{alert.alert_message}</p>
              <span className="mono small muted">
                {alert.alert_type} · {alert.device_code}
              </span>
            </div>
          ))}
          {!open.length && <p className="muted">Không có cảnh báo đang mở.</p>}
          <Link className={ui.link} to="/alerts">
            Xem tất cả
          </Link>
        </Card>
      </section>
    </>
  )
}
