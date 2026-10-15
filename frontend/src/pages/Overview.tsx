import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../store/auth'
import { useDashboard } from '../store/dashboard'
import { MONITORING } from '../services/config'
import { dateTime, number } from '../services/format'
import {
  Badge,
  Card,
  Connection,
  DeferredButton,
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
  const viewer = useAuth((s) => s.user?.role === 'VIEWER')
  const [range, setRange] = useState(1)
  const env = data.telemetry.find((row) => row.device_code === MONITORING.environmentCode)
  const sec = data.telemetry.find((row) => row.device_code === MONITORING.securityCode)
  const open = data.alerts.filter((alert) => !alert.is_acknowledged)
  const critical = open.find((alert) => alert.severity === 'CRITICAL')
  const series = data.telemetry
    .filter((row) => row.device_id === 1)
    .toReversed()
    .map((row, index, rows) => ({
      ...row,
      recorded_at: new Date(
        new Date(data.snapshot_at).getTime() - (rows.length - 1 - index) * range * 60000,
      ).toISOString(),
    }))
  return (
    <>
      <PageHeader
        title="Tổng quan"
        subtitle={
          <div className="row">
            <span>Kho chính</span>
            <Badge tone="good">Trực tiếp</Badge>
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
            <span>Còi và đèn LED đỏ đang báo động tại chỗ.</span>
          </div>
          {viewer ? (
            <span>Tài khoản Viewer chỉ có quyền xem.</span>
          ) : (
            <div className="row">
              <DeferredButton milestone="24/10" disabled={!data.presentation.buzzer_sounding}>
                Tắt còi
              </DeferredButton>
              <DeferredButton milestone="24/10">Xác nhận đã xử lý</DeferredButton>
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
          status="Bình thường"
        />
        <Stat
          label="Độ ẩm"
          sensor="DHT22"
          value={number(env?.humidity)}
          unit="%"
          status="Vượt ngưỡng 65 %"
          tone="warning"
        />
        <Stat
          label="Khói / khí gas"
          sensor="MQ-2"
          value={number(env?.smoke_gas_level, 0)}
          unit={MONITORING.smoke.unit}
          status="Bình thường"
        />
        <Stat
          label="Cửa kho"
          sensor="MC-38"
          value={sec?.door_status ? 'Mở' : 'Đóng'}
          status="Ngoài giờ giới nghiêm"
          tone="critical"
        />
        <Stat
          label="Chuyển động"
          sensor="HC-SR501"
          value={sec?.motion_detected ? 'Có' : 'Không'}
          status="Lần cuối 18:52"
          tone="muted"
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
            <Badge tone="critical">Đang kêu</Badge>
          </div>
          <DeferredButton milestone="24/10" disabled={viewer}>
            Tắt còi
          </DeferredButton>
          <span className="mono small muted">BUZZER_OFF · NODE2_SEC</span>
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
            <Badge tone="info">Đang bật</Badge>
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
