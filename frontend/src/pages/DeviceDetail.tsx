import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { KeyRound, Wrench } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { PageHeader } from '@/components/app/page-header'
import {
  ActionButton,
  BackLink,
  Connection,
  Heartbeat,
  InfoList,
  LifecycleBadge,
  Notice,
  SecretToken,
  StatCard,
  ToneBadge,
} from '@/components/app/kit'
import { CommandTable } from '@/components/common/CommandTable'
import { FanControl } from '@/components/control/FanControl'
import { ConfigForm } from '@/components/control/ConfigForm'
import { getDeviceKind, MONITORING } from '@/services/config'
import { dateTime, isNight, number } from '@/services/format'
import { buzzerSounding } from '@/services/dashboardView'
import { useActions } from '@/store/actions'
import { useAuth } from '@/store/auth'
import { useDashboard } from '@/store/dashboard'

const RECENT_COMMANDS = 10

export default function DeviceDetail() {
  const { deviceId } = useParams()
  const data = useDashboard((s) => s.data)!
  const role = useAuth((s) => s.user?.role)
  const actions = useActions()
  const [issued, setIssued] = useState<{ deviceId: number; token: string } | null>(null)
  const device = data.devices.find((d) => String(d.device_id) === deviceId)
  if (!device)
    return (
      <div className="space-y-4">
        <BackLink />
        <PageHeader title="Không tìm thấy thiết bị" />
        <Notice error>Thiết bị không tồn tại hoặc đã bị xóa.</Notice>
      </div>
    )
  const kind = getDeviceKind(device)
  const config = data.configs.find((c) => c.device_id === device.device_id)
  const reading = data.telemetry.find((row) => row.device_id === device.device_id)
  const environment = kind === 'environment'
  const night = isNight(
    config?.curfew_start_hour ?? 20,
    config?.curfew_end_hour ?? 6,
    data.system.timezone,
  )
  const humidityThreshold = config?.humidity_threshold ?? MONITORING.humidityThreshold
  const temperatureThreshold = config?.temperature_threshold ?? 50
  const humidityHigh = reading?.humidity != null && reading.humidity > humidityThreshold
  const temperatureHigh = reading?.temperature != null && reading.temperature > temperatureThreshold
  const smokeThreshold = config?.smoke_gas_threshold ?? MONITORING.smoke.threshold
  const smokeHigh = reading?.smoke_gas_level != null && reading.smoke_gas_level > smokeThreshold
  const buzzer = buzzerSounding(data.commands, device.device_id, data.actuators)
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
    <div className="space-y-4">
      <BackLink />
      <PageHeader
        title={device.device_name}
        subtitle={
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-mono text-xs">{device.device_code}</span>
            <LifecycleBadge status={device.lifecycle_status} />
            <Connection device={device} />
            <Heartbeat device={device} />
          </div>
        }
        actions={
          role === 'ADMIN' && (
            <div className="flex flex-wrap gap-2">
              {device.lifecycle_status === 'REGISTERED' ? (
                <ActionButton
                  key="activate"
                  action={() => actions.activateDevice(device.device_id)}
                  success="Đã kích hoạt thiết bị."
                >
                  Kích hoạt
                </ActionButton>
              ) : device.lifecycle_status === 'MAINTENANCE' ? (
                <ActionButton
                  key="reactivate"
                  action={() => actions.setLifecycle(device.device_id, 'ACTIVE')}
                  success="Đã kích hoạt lại thiết bị."
                >
                  Kích hoạt lại
                </ActionButton>
              ) : (
                <ActionButton
                  key="maintenance"
                  variant="outline"
                  disabled={device.lifecycle_status === 'DECOMMISSIONED'}
                  action={() => actions.setLifecycle(device.device_id, 'MAINTENANCE')}
                  success="Đã chuyển thiết bị sang bảo trì."
                >
                  <Wrench className="size-4" />
                  Chuyển bảo trì
                </ActionButton>
              )}
              <ActionButton
                variant="destructive"
                disabled={
                  device.lifecycle_status === 'DECOMMISSIONED' ||
                  device.lifecycle_status === 'REGISTERED'
                }
                confirm="Thu hồi thiết bị sẽ xóa token và chặn kết nối. Tiếp tục?"
                action={() => actions.setLifecycle(device.device_id, 'DECOMMISSIONED')}
                success="Đã thu hồi thiết bị."
              >
                Thu hồi thiết bị
              </ActionButton>
            </div>
          )
        }
      />

      <div className="grid items-start gap-4 lg:grid-cols-3">
        <div className="space-y-4">
          <Card className="shadow-none">
            <CardHeader>
              <CardTitle className="text-base">Thông tin</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <InfoList
                rows={[
                  ['Kho', device.warehouse_name || '—'],
                  ['Phụ trách', device.assigned_username || '—'],
                  ['Địa chỉ MAC', <span className="font-mono text-xs">{device.mac_address}</span>],
                  ['Địa chỉ IP', <span className="font-mono text-xs">{device.ip_address || '—'}</span>],
                  ['Firmware', <span className="font-mono text-xs">{device.firmware_version || '—'}</span>],
                  ['Đăng ký lúc', <span className="font-mono text-xs">{dateTime(device.created_at)}</span>],
                  [
                    'Heartbeat gần nhất',
                    <span className="font-mono text-xs">{dateTime(device.last_heartbeat)}</span>,
                  ],
                  ['Token xác thực', <span className="font-mono text-xs">••••••••</span>],
                ]}
              />
              {role === 'ADMIN' && (
                <div className="space-y-2 border-t pt-3">
                  <ActionButton
                    variant="outline"
                    size="sm"
                    disabled={device.lifecycle_status === 'DECOMMISSIONED'}
                    confirm="Cấp lại token sẽ khiến thiết bị dùng token cũ mất kết nối. Tiếp tục?"
                    action={async () =>
                      setIssued({
                        deviceId: device.device_id,
                        token: await actions.rotateDeviceToken(device.device_id),
                      })
                    }
                    success="Đã cấp token mới."
                  >
                    <KeyRound className="size-4" />
                    Cấp lại token
                  </ActionButton>
                  {issued?.deviceId === device.device_id &&
                    device.lifecycle_status !== 'DECOMMISSIONED' && (
                    <Notice>
                      Token mới chỉ hiển thị một lần. Sao chép ngay và không đưa lên GitHub.
                      <SecretToken token={issued.token} />
                    </Notice>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="shadow-none">
            <CardHeader>
              <CardTitle className="text-base">Cảm biến và cơ cấu chấp hành</CardTitle>
            </CardHeader>
            <CardContent>
              {sensors.length ? (
                <InfoList rows={sensors} />
              ) : (
                <p className="text-sm text-muted-foreground">Chưa xác định loại thiết bị.</p>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="space-y-4 lg:col-span-2">
          {!reading ? (
            <Notice>Chưa có dữ liệu cảm biến cho thiết bị này.</Notice>
          ) : environment ? (
            <section
              aria-label="Chỉ số hiện tại"
              className="grid grid-cols-2 gap-3 sm:grid-cols-3"
            >
              <StatCard
                label="Nhiệt độ"
                value={number(reading.temperature)}
                unit="°C"
                status={
                  temperatureHigh ? `Vượt ngưỡng ${temperatureThreshold} °C` : 'Bình thường'
                }
                tone={temperatureHigh ? 'warning' : 'good'}
              />
              <StatCard
                label="Độ ẩm"
                value={number(reading.humidity)}
                unit="%"
                status={humidityHigh ? `Vượt ngưỡng ${humidityThreshold} %` : 'Bình thường'}
                tone={humidityHigh ? 'warning' : 'good'}
              />
              <StatCard
                label="Khói / khí gas"
                value={number(reading.smoke_gas_level, 0)}
                unit={MONITORING.smoke.unit}
                status={smokeHigh ? `Vượt ngưỡng ${smokeThreshold}` : 'Bình thường'}
                tone={smokeHigh ? 'warning' : 'good'}
              />
            </section>
          ) : (
            <section
              aria-label="Trạng thái hiện tại"
              className="grid grid-cols-2 gap-3 xl:grid-cols-4"
            >
              <StatCard
                label="Cửa kho"
                value={reading.door_status ? 'Mở' : 'Đóng'}
                status={
                  reading.door_status
                    ? night
                      ? 'Ngoài giờ giới nghiêm'
                      : 'Cửa mở trong giờ làm việc'
                    : 'Đóng'
                }
                tone={reading.door_status ? (night ? 'critical' : 'warning') : 'good'}
              />
              <StatCard
                label="Chuyển động"
                value={reading.motion_detected ? 'Có' : 'Không'}
                status={reading.motion_detected ? 'Có chuyển động' : 'Không có chuyển động'}
                tone={reading.motion_detected ? 'critical' : 'muted'}
              />
              <StatCard
                label="Còi báo động"
                value={buzzer ? 'Đang kêu' : 'Tắt'}
                status="Báo động tại chỗ"
                tone={buzzer ? 'critical' : 'muted'}
              />
              <StatCard
                label="Đèn LED"
                value={data.presentation.led}
                status="Đèn trạng thái"
                tone={data.presentation.led === 'Tắt' ? 'muted' : 'critical'}
              />
            </section>
          )}

          {reading &&
            (environment ? (
              <Card className="shadow-none">
                <CardHeader>
                  <CardTitle className="text-base">Điều khiển quạt</CardTitle>
                </CardHeader>
                <CardContent>
                  <FanControl detailed deviceId={device.device_id} />
                </CardContent>
              </Card>
            ) : (
              <Card className="shadow-none">
                <CardHeader>
                  <CardTitle className="text-base">Điều khiển còi báo động</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm text-muted-foreground">
                      {reading.door_status
                        ? 'Cửa kho bị mở ngoài giờ giới nghiêm'
                        : 'Còi báo động tại chỗ'}
                    </p>
                    <Badge variant={buzzer ? 'destructive' : 'secondary'}>
                      {buzzer ? 'Đang kêu' : 'Tắt'}
                    </Badge>
                  </div>
                  <div className="flex flex-wrap items-center gap-3">
                    <ActionButton
                      variant="outline"
                      disabled={role === 'VIEWER' || !buzzer}
                      action={() => actions.sendCommand(device.device_id, 'BUZZER_OFF')}
                      success="Đã gửi lệnh tắt còi."
                    >
                      Tắt còi
                    </ActionButton>
                    <Button asChild variant="link" className="h-auto p-0">
                      <Link to="/alerts">Xem cảnh báo</Link>
                    </Button>
                  </div>
                  {role === 'VIEWER' && (
                    <p className="text-xs text-muted-foreground">
                      Tài khoản Viewer chỉ có quyền xem. Không thể điều khiển thiết bị.
                    </p>
                  )}
                </CardContent>
              </Card>
            ))}

          {config && kind !== 'unknown' && (
            <ConfigForm key={device.device_id} config={config} environment={environment} />
          )}

          {kind === 'security' && reading && (
            <Card className="shadow-none">
              <CardHeader>
                <CardTitle className="text-base">Sự kiện an ninh gần đây</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto rounded-lg border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Thời gian</TableHead>
                        <TableHead>Cảm biến</TableHead>
                        <TableHead>Sự kiện</TableHead>
                        <TableHead>Cảnh báo</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {data.presentation.security_events.map((event) => (
                        <TableRow key={`${event.recorded_at}-${event.sensor}`}>
                          <TableCell className="font-mono text-xs">
                            {dateTime(event.recorded_at, true)}
                          </TableCell>
                          <TableCell className="font-mono text-xs">{event.sensor}</TableCell>
                          <TableCell>{event.description}</TableCell>
                          <TableCell>
                            {event.alert_type ? (
                              <ToneBadge tone="critical">{event.alert_type}</ToneBadge>
                            ) : (
                              '—'
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                  {!data.presentation.security_events.length && (
                    <p className="px-4 py-8 text-center text-sm text-muted-foreground">
                      Chưa có sự kiện an ninh.
                    </p>
                  )}
                </div>
              </CardContent>
            </Card>
          )}

          <Card className="shadow-none">
            <CardHeader>
              <CardTitle className="text-base">Lệnh gần đây</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <CommandTable commands={commands.slice(0, RECENT_COMMANDS)} />
              <Button asChild variant="link" className="h-auto p-0">
                <Link to={`/history?tab=commands&device=${device.device_id}`}>
                  Xem tất cả trong Lịch sử
                </Link>
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
