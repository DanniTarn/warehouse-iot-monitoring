import { useState } from 'react'
import { Link } from 'react-router-dom'
import { BellRing, CircleAlert, TriangleAlert } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { PageHeader } from '@/components/app/page-header'
import { NativeSelect } from '@/components/app/native-select'
import {
  ActionButton,
  Connection,
  Heartbeat,
  StatCard,
  ToneBadge,
} from '@/components/app/kit'
import { FanControl } from '@/components/control/FanControl'
import { SensorChart } from '@/components/charts/SensorChart'
import { getDeviceKind, MONITORING } from '@/services/config'
import { buzzerSounding, newestTelemetry } from '@/services/dashboardView'
import { dateTime, isNight, number } from '@/services/format'
import type { Device } from '@/services/types'
import { useActions } from '@/store/actions'
import { useAuth } from '@/store/auth'
import { useDashboard } from '@/store/dashboard'
import { cn } from '@/lib/utils'

export default function Overview() {
  const data = useDashboard((s) => s.data)!
  const connection = useDashboard((s) => s.connection)
  const viewer = useAuth((s) => s.user?.role === 'VIEWER')
  const actions = useActions()
  const [range, setRange] = useState(1)
  const [envId, setEnvId] = useState<number | null>(null)
  const [secId, setSecId] = useState<number | null>(null)
  const envDevices = data.devices.filter((device) => getDeviceKind(device) === 'environment')
  const secDevices = data.devices.filter((device) => getDeviceKind(device) === 'security')
  const envDevice = envDevices.find((device) => device.device_id === envId) ?? envDevices[0]
  const secDevice = secDevices.find((device) => device.device_id === secId) ?? secDevices[0]
  const envConfig = data.configs.find((config) => config.device_id === envDevice?.device_id)
  const secConfig = data.configs.find((config) => config.device_id === secDevice?.device_id)
  const night = isNight(
    secConfig?.curfew_start_hour ?? 20,
    secConfig?.curfew_start_minute ?? 0,
    secConfig?.curfew_end_hour ?? 6,
    secConfig?.curfew_end_minute ?? 0,
    data.system.timezone,
  )
  const env = newestTelemetry(data.telemetry, envDevice?.device_id)
  const sec = newestTelemetry(data.telemetry, secDevice?.device_id)
  const open = data.alerts.filter((alert) => !alert.is_acknowledged)
  const critical = open.find((alert) => alert.severity === 'CRITICAL')
  const others = open.filter((alert) => alert !== critical)
  const envRows = data.telemetry.filter((row) => row.device_id === envDevice?.device_id)
  const newest = envRows.reduce((latest, row) => Math.max(latest, Date.parse(row.recorded_at)), 0)
  const series = envRows
    .filter((row) => Date.parse(row.recorded_at) >= newest - range * 3600000)
    .toReversed()
  const period = {
    start: series.reduce((oldest, row) => Math.min(oldest, Date.parse(row.recorded_at)), newest),
    end: newest,
  }
  const humidityThreshold = envConfig?.humidity_threshold ?? MONITORING.humidityThreshold
  const temperatureThreshold = envConfig?.temperature_threshold ?? 50
  const smokeThreshold = envConfig?.smoke_gas_threshold ?? MONITORING.smoke.threshold
  const humidityHigh = env?.humidity != null && env.humidity > humidityThreshold
  const temperatureHigh = env?.temperature != null && env.temperature > temperatureThreshold
  const smokeHigh = env?.smoke_gas_level != null && env.smoke_gas_level > smokeThreshold
  const buzzer = buzzerSounding(data.commands, secDevice?.device_id, data.actuators)
  const criticalDevice = critical
    ? data.devices.find((device) => device.device_code === critical.device_code)
    : undefined
  const soundingSecurity = secDevices.filter((device) =>
    buzzerSounding(data.commands, device.device_id, data.actuators),
  )
  const criticalBuzzerDevice =
    soundingSecurity.find(
      (device) => device.warehouse_id === criticalDevice?.warehouse_id,
    ) ?? soundingSecurity[0]
  function silence(device: Device | undefined) {
    if (!device) return Promise.reject(new Error('Không tìm thấy thiết bị an ninh.'))
    return actions.sendCommand(device.device_id, 'BUZZER_OFF')
  }
  return (
    <div className="space-y-4">
      <PageHeader
        title="Tổng quan"
        subtitle={
          <div className="flex flex-wrap items-center gap-2">
            <span>Kho chính</span>
            {connection === 'live' ? (
              <ToneBadge tone="good">Trực tiếp</ToneBadge>
            ) : (
              <ToneBadge tone="warning">Mất kết nối, đang thử lại…</ToneBadge>
            )}
            <span className="font-mono text-xs text-muted-foreground">
              Cập nhật {dateTime(data.snapshot_at, true)}
            </span>
          </div>
        }
        actions={
          <div
            className="inline-flex rounded-lg border bg-card p-1"
            role="group"
            aria-label="Khoảng thời gian biểu đồ"
          >
            {[1, 6, 24].map((hours) => (
              <Button
                key={hours}
                size="sm"
                variant={range === hours ? 'secondary' : 'ghost'}
                aria-pressed={range === hours}
                className={cn('h-7 px-3', range === hours && 'shadow-xs')}
                onClick={() => setRange(hours)}
              >
                {hours} giờ
              </Button>
            ))}
          </div>
        }
      />

      {critical && (
        <div
          role="alert"
          className="flex flex-col gap-4 rounded-xl border border-red-200 bg-red-50 p-4 sm:flex-row sm:items-start"
        >
          <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-red-100 text-red-700">
            <CircleAlert className="size-5" />
          </span>
          <div className="min-w-0 flex-1 space-y-1">
            <span className="font-mono text-[11px] uppercase tracking-wide text-red-700">
              CRITICAL · {critical.alert_type} · {critical.device_code} ·{' '}
              {dateTime(critical.created_at, true)}
            </span>
            <p className="font-semibold text-red-950">{critical.alert_message}</p>
            {criticalBuzzerDevice && (
              <p className="text-sm text-red-900">Còi và đèn LED đỏ đang báo động tại chỗ.</p>
            )}
            {others.length > 0 && (
              <p className="text-sm text-red-900">
                Còn {others.length} cảnh báo đang mở khác.{' '}
                <Link to="/alerts" className="font-medium underline underline-offset-4">
                  Xem tất cả cảnh báo
                </Link>
              </p>
            )}
          </div>
          {viewer ? (
            <p className="text-sm text-red-900">Tài khoản Viewer chỉ có quyền xem.</p>
          ) : (
            <div className="flex shrink-0 flex-wrap gap-2" key={critical.alert_id}>
              <ActionButton
                variant="outline"
                size="sm"
                disabled={!criticalBuzzerDevice}
                action={() => silence(criticalBuzzerDevice)}
                success="Đã gửi lệnh tắt còi."
              >
                Tắt còi
              </ActionButton>
              <ActionButton
                size="sm"
                action={() => actions.acknowledgeAlert(critical.alert_id)}
                success="Đã xác nhận cảnh báo."
              >
                Xác nhận đã xử lý
              </ActionButton>
            </div>
          )}
        </div>
      )}

      {(envDevices.length > 1 || secDevices.length > 1) && (
        <div className="flex flex-wrap items-end gap-3 rounded-xl border bg-card p-3">
          {envDevices.length > 1 && (
            <label className="space-y-1 text-xs font-medium text-muted-foreground">
              Thiết bị môi trường
              <NativeSelect
                aria-label="Thiết bị môi trường"
                value={envDevice?.device_id ?? ''}
                onChange={(event) => setEnvId(Number(event.target.value))}
                wrapperClassName="w-64"
              >
                {envDevices.map((device) => (
                  <option key={device.device_id} value={device.device_id}>
                    {device.device_name} · {device.device_code}
                  </option>
                ))}
              </NativeSelect>
            </label>
          )}
          {secDevices.length > 1 && (
            <label className="space-y-1 text-xs font-medium text-muted-foreground">
              Thiết bị an ninh
              <NativeSelect
                aria-label="Thiết bị an ninh"
                value={secDevice?.device_id ?? ''}
                onChange={(event) => setSecId(Number(event.target.value))}
                wrapperClassName="w-64"
              >
                {secDevices.map((device) => (
                  <option key={device.device_id} value={device.device_id}>
                    {device.device_name} · {device.device_code}
                  </option>
                ))}
              </NativeSelect>
            </label>
          )}
        </div>
      )}

      <section
        aria-label="Chỉ số hiện tại"
        className="grid grid-cols-2 gap-3 xl:grid-cols-5"
      >
        <StatCard
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
        <StatCard
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
        <StatCard
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
        <StatCard
          label="Cửa kho"
          sensor="MC-38"
          value={sec?.door_status == null ? '—' : sec.door_status ? 'Mở' : 'Đóng'}
          status={
            sec?.door_status == null
              ? 'Chưa có dữ liệu'
              : sec.door_status
                ? night
                  ? 'Ngoài giờ giới nghiêm'
                  : 'Cửa mở trong giờ làm việc'
                : 'Đóng'
          }
          tone={sec?.door_status ? (night ? 'critical' : 'warning') : 'good'}
        />
        <StatCard
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

      <div className="grid gap-4 lg:grid-cols-3">
        <section
          aria-label="Biểu đồ cảm biến"
          className="order-5 grid gap-4 md:grid-cols-3 lg:order-1 lg:col-span-3"
        >
          <SensorChart
            title="Nhiệt độ"
            unit="°C"
            sensor="DHT22"
            field="temperature"
            color="var(--chart-temp)"
            domain={[24, 32]}
            data={series}
            period={period}
          />
          <SensorChart
            title="Độ ẩm"
            unit="%"
            sensor="DHT22"
            field="humidity"
            color="var(--chart-humidity)"
            domain={[50, 80]}
            threshold={humidityThreshold}
            data={series}
            period={period}
          />
          <SensorChart
            title="Khói / khí gas"
            unit={MONITORING.smoke.unit}
            sensor="MQ-2"
            field="smoke_gas_level"
            color="var(--chart-smoke)"
            domain={MONITORING.smoke.domain}
            threshold={smokeThreshold}
            data={series}
            period={period}
          />
        </section>

        <Card className="order-2 lg:order-2">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <TriangleAlert className="size-4 text-muted-foreground" />
              Cảnh báo đang mở
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {others.slice(0, 5).map((alert) => (
              <div key={alert.alert_id} className="space-y-1 rounded-lg border p-3">
                <div className="flex items-center justify-between gap-2">
                  <ToneBadge tone={alert.severity === 'CRITICAL' ? 'critical' : 'warning'}>
                    {alert.severity}
                  </ToneBadge>
                  <span className="font-mono text-[11px] text-muted-foreground">
                    {dateTime(alert.created_at)}
                  </span>
                </div>
                <p className="text-sm font-medium">{alert.alert_message}</p>
                <p className="font-mono text-[11px] text-muted-foreground">
                  {alert.alert_type} · {alert.device_code}
                </p>
              </div>
            ))}
            {!others.length && (
              <p className="py-6 text-center text-sm text-muted-foreground">
                {critical ? 'Không có cảnh báo nào khác.' : 'Không có cảnh báo đang mở.'}
              </p>
            )}
            <Button asChild variant="link" className="h-auto p-0">
              <Link to="/alerts">Xem tất cả</Link>
            </Button>
          </CardContent>
        </Card>

        <Card className="order-3 lg:order-3">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <BellRing className="size-4 text-muted-foreground" />
              Điều khiển nhanh
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <FanControl deviceId={envDevice?.device_id} />
            <div className="flex items-center justify-between gap-2">
              <div className="min-w-0">
                <strong className="text-sm">Còi báo động</strong>
                {secDevice && (
                  <p className="font-mono text-[11px] text-muted-foreground">
                    {secDevice.device_code}
                  </p>
                )}
              </div>
              <Badge variant={buzzer ? 'destructive' : 'secondary'}>
                {buzzer ? 'Đang kêu' : 'Tắt'}
              </Badge>
            </div>
            <ActionButton
              variant="outline"
              disabled={viewer || !buzzer || !secDevice}
              action={() => silence(secDevice)}
              success="Đã gửi lệnh tắt còi."
            >
              Tắt còi
            </ActionButton>
            <p className="font-mono text-[11px] text-muted-foreground">
              BUZZER_OFF · {secDevice?.device_code ?? '—'}
            </p>
          </CardContent>
        </Card>

        <Card className="order-4 lg:order-4">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Thiết bị</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {data.devices.map((device) => (
              <div key={device.device_id} className="space-y-1">
                <div className="flex items-center justify-between gap-2">
                  <Link
                    to={`/devices/${device.device_id}`}
                    className="text-sm font-medium text-primary hover:underline"
                  >
                    {device.device_name}
                  </Link>
                  <Connection device={device} />
                </div>
                <p className="font-mono text-[11px] text-muted-foreground">{device.device_code}</p>
                <Heartbeat device={device} />
              </div>
            ))}
            <div className="space-y-2 border-t pt-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Đèn LED</span>
                <span className="text-sm font-medium text-destructive">
                  {data.presentation.led}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
