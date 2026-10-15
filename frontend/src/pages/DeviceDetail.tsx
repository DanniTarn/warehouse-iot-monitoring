import { Link, useParams } from 'react-router-dom'
import { useAuth } from '../store/auth'
import { useDashboard } from '../store/dashboard'
import { getDeviceKind, MONITORING } from '../services/config'
import { dateTime, number } from '../services/format'
import {
  BackLink,
  Badge,
  Card,
  Connection,
  DeferredButton,
  Heartbeat,
  InfoList,
  Notice,
  PageHeader,
  Stat,
  Table,
} from '../components/common/UI'
import { CommandTable } from '../components/common/CommandTable'
import { FanControl } from '../components/control/FanControl'
import { ConfigForm } from '../components/control/ConfigForm'
import ui from '../components/common/UI.module.css'
import styles from './Pages.module.css'
export default function DeviceDetail() {
  const { deviceId } = useParams()
  const data = useDashboard((s) => s.data)!
  const role = useAuth((s) => s.user?.role)
  const device = data.devices.find((d) => String(d.device_id) === deviceId)
  if (!device)
    return (
      <>
        <BackLink />
        <PageHeader title="Không tìm thấy thiết bị" />
        <Notice error>Thiết bị không tồn tại hoặc đã bị xóa.</Notice>
      </>
    )
  const kind = getDeviceKind(device)
  const config = data.configs.find((c) => c.device_id === device.device_id)
  const reading = data.telemetry.find((row) => row.device_id === device.device_id)
  const environment = kind === 'environment'
  const commands = data.commands.filter((command) => command.device_id === device.device_id)
  const sensors: [string, string][] = environment
    ? [
        ['DHT22', 'Nhiệt độ và độ ẩm'],
        ['MQ-2', 'Khói / khí gas'],
        ['Relay 5V', 'Quạt hút mini'],
      ]
    : kind === 'security'
      ? [
          ['MC-38', 'Trạng thái cửa kho'],
          ['HC-SR501', 'Chuyển động (PIR)'],
          ['Buzzer 5V', 'Còi báo động tại chỗ'],
          ['LED', 'Đèn trạng thái nhiều màu'],
        ]
      : []
  return (
    <>
      <div>
        <BackLink />
        <PageHeader
          title={device.device_name}
          subtitle={
            <div className="row">
              <span className="mono">{device.device_code}</span>
              <Badge value={device.lifecycle_status} />
              <Connection device={device} />
              <Heartbeat device={device} />
            </div>
          }
        >
          {role === 'ADMIN' && (
            <div className="row">
              {device.lifecycle_status === 'REGISTERED' ? (
                <DeferredButton>Kích hoạt</DeferredButton>
              ) : (
                <DeferredButton disabled={device.lifecycle_status === 'DECOMMISSIONED'}>
                  Chuyển bảo trì
                </DeferredButton>
              )}
              <DeferredButton
                variant="danger"
                disabled={device.lifecycle_status === 'DECOMMISSIONED'}
              >
                Thu hồi thiết bị
              </DeferredButton>
            </div>
          )}
        </PageHeader>
      </div>
      <div className={styles.columns}>
        <aside className={styles.sideColumn}>
          <Card title="Thông tin">
            <InfoList
              rows={[
                ['Kho', device.warehouse_name || '—'],
                ['Phụ trách', device.assigned_username || '—'],
                ['Địa chỉ MAC', <span className="mono small">{device.mac_address}</span>],
                ['Địa chỉ IP', <span className="mono small">{device.ip_address || '—'}</span>],
                ['Firmware', <span className="mono small">{device.firmware_version || '—'}</span>],
                ['Đăng ký lúc', <span className="mono small">{dateTime(device.created_at)}</span>],
                [
                  'Heartbeat gần nhất',
                  <span className="mono small">{dateTime(device.last_heartbeat)}</span>,
                ],
                ['Token xác thực', <span className="mono small">••••••••</span>],
              ]}
            />
            {role === 'ADMIN' && (
              <DeferredButton disabled={device.lifecycle_status === 'DECOMMISSIONED'}>
                Cấp lại token
              </DeferredButton>
            )}
          </Card>
          <Card title="Cảm biến và cơ cấu chấp hành">
            {sensors.length ? (
              <InfoList rows={sensors} />
            ) : (
              <p className="muted">Chưa xác định loại thiết bị.</p>
            )}
          </Card>
        </aside>
        <div className={styles.mainColumn}>
          {!reading ? (
            <Notice>Chưa có dữ liệu cảm biến cho thiết bị này.</Notice>
          ) : environment ? (
            <section className={styles.detailStats} aria-label="Chỉ số hiện tại">
              <Stat
                label="Nhiệt độ"
                value={number(reading.temperature)}
                unit="°C"
                status="Bình thường"
              />
              <Stat
                label="Độ ẩm"
                value={number(reading.humidity)}
                unit="%"
                status="Vượt ngưỡng 65 %"
                tone="warning"
              />
              <Stat
                label="Khói / khí gas"
                value={number(reading.smoke_gas_level, 0)}
                unit={MONITORING.smoke.unit}
                status="Bình thường"
              />
            </section>
          ) : (
            <section className={styles.detailStats} aria-label="Trạng thái hiện tại">
              <Stat
                label="Cửa kho"
                value={reading.door_status ? 'Mở' : 'Đóng'}
                status="Ngoài giờ giới nghiêm"
                tone="critical"
              />
              <Stat
                label="Chuyển động"
                value={reading.motion_detected ? 'Có' : 'Không'}
                status="Lần cuối 18:52"
                tone="muted"
              />
              <Stat
                label="Còi báo động"
                value="Đang kêu"
                status="Báo động tại chỗ"
                tone="critical"
              />
              <Stat label="Đèn LED" value="Đỏ" status="Nhấp nháy" tone="critical" />
            </section>
          )}
          {reading &&
            (environment ? (
              <Card title="Điều khiển quạt">
                <FanControl detailed />
              </Card>
            ) : (
              <Card title="Điều khiển còi báo động">
                <div className="row between">
                  <p>Cửa kho bị mở ngoài giờ giới nghiêm</p>
                  <Badge tone="critical">Đang kêu</Badge>
                </div>
                <DeferredButton milestone="24/10" disabled={role === 'VIEWER'}>
                  Tắt còi
                </DeferredButton>
                <Link to="/alerts" className={ui.link}>
                  Xem cảnh báo
                </Link>
                {role === 'VIEWER' && (
                  <p className={styles.viewerNote}>
                    Tài khoản Viewer chỉ có quyền xem. Không thể điều khiển thiết bị.
                  </p>
                )}
              </Card>
            ))}
          {config && kind !== 'unknown' && (
            <ConfigForm key={device.device_id} config={config} environment={environment} />
          )}
          {kind === 'security' && reading && (
            <Card title="Sự kiện an ninh gần đây">
              <Table
                label="Sự kiện an ninh"
                headers={['Thời gian', 'Cảm biến', 'Sự kiện', 'Cảnh báo']}
              >
                {data.presentation.security_events.map((event) => (
                  <tr key={event.recorded_at}>
                    <td className="mono">{dateTime(event.recorded_at, true)}</td>
                    <td className="mono">{event.sensor}</td>
                    <td>{event.description}</td>
                    <td>
                      {event.alert_type ? <Badge value="CRITICAL">{event.alert_type}</Badge> : '—'}
                    </td>
                  </tr>
                ))}
              </Table>
            </Card>
          )}
          <Card title="Lệnh gần đây">
            <CommandTable commands={commands} />
          </Card>
        </div>
      </div>
    </>
  )
}
