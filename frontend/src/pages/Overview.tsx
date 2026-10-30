import { useState } from 'react'
import { Link } from 'react-router-dom'
import { BellRing, CircleAlert, TriangleAlert } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { PageHeader } from '@/components/app/page-header'
import {
  ActionButton,
  Connection,
  Heartbeat,
  StatCard,
  ToneBadge,
} from '@/components/app/kit'
import { FanControl } from '@/components/control/FanControl'
import { SensorChart } from '@/components/charts/SensorChart'
import { MONITORING } from '@/services/config'
import { dateTime, number } from '@/services/format'
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
  const silenceBuzzer = () => {
    if (!secDevice) return Promise.reject(new Error('Không tìm thấy thiết bị an ninh.'))
    return actions.sendCommand(secDevice.device_id, 'BUZZER_OFF')
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
            {data.presentation.buzzer_sounding && (
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
                disabled={!data.presentation.buzzer_sounding || !secDevice}
                action={silenceBuzzer}
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
                ? data.system.night
                  ? 'Ngoài giờ giới nghiêm'
                  : 'Cửa mở trong giờ làm việc'
                : 'Đóng'
          }
          tone={sec?.door_status ? (data.system.night ? 'critical' : 'warning') : 'good'}
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
            <FanControl />
            <div className="flex items-center justify-between gap-2">
              <strong className="text-sm">Còi báo động</strong>
              <Badge variant={data.presentation.buzzer_sounding ? 'destructive' : 'secondary'}>
                {data.presentation.buzzer_sounding ? 'Đang kêu' : 'Tắt'}
              </Badge>
            </div>
            <ActionButton
              variant="outline"
              disabled={viewer || !data.presentation.buzzer_sounding || !secDevice}
              action={silenceBuzzer}
              success="Đã gửi lệnh tắt còi."
            >
              Tắt còi
            </ActionButton>
            <p className="font-mono text-[11px] text-muted-foreground">
              BUZZER_OFF · {MONITORING.securityCode}
            </p>
          </CardContent>
        </Card>

        <Card className="order-4 lg:order-4">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Thiết bị</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {data.devices.slice(0, 2).map((device) => (
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
                <span className="text-sm text-muted-foreground">Chế độ ban đêm</span>
                <Badge variant={envConfig?.night_mode_enabled ? 'default' : 'secondary'}>
                  {envConfig?.night_mode_enabled ? 'Đang bật' : 'Đang tắt'}
                </Badge>
              </div>
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
