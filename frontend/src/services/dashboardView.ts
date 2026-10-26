import type { DashboardData } from './api'
import { MONITORING } from './config'
import type { DeviceCommand, DeviceConfig, Telemetry } from './types'

type Presentation = DashboardData['presentation']
export type PresentationInput = Pick<
  DashboardData,
  'devices' | 'configs' | 'telemetry' | 'alerts' | 'commands'
>

function isNewer(command: DeviceCommand, than: DeviceCommand) {
  const at = Date.parse(command.sent_at)
  const before = Date.parse(than.sent_at)
  return at > before || (at === before && command.command_id > than.command_id)
}

function latestAcknowledged(
  commands: DeviceCommand[],
  deviceId: number | undefined,
  types: DeviceCommand['command_type'][],
) {
  if (deviceId === undefined) return undefined
  return commands
    .filter(
      (command) =>
        command.device_id === deviceId &&
        command.status === 'ACKNOWLEDGED' &&
        types.includes(command.command_type),
    )
    .reduce<DeviceCommand | undefined>(
      (latest, command) => (!latest || isNewer(command, latest) ? command : latest),
      undefined,
    )
}

function newestTelemetry(telemetry: Telemetry[], deviceId: number | undefined) {
  if (deviceId === undefined) return undefined
  return telemetry
    .filter((row) => row.device_id === deviceId)
    .reduce<Telemetry | undefined>(
      (latest, row) =>
        !latest ||
        Date.parse(row.recorded_at) > Date.parse(latest.recorded_at) ||
        (row.recorded_at === latest.recorded_at && row.telemetry_id > latest.telemetry_id)
          ? row
          : latest,
      undefined,
    )
}

function fanRunning(
  latest: DeviceCommand | undefined,
  humidity: number | null,
  humidityThreshold: number,
  mode: Presentation['fan_mode'],
) {
  if (latest?.command_type === 'FAN_ON') return true
  if (latest?.command_type === 'FAN_OFF') return false
  if (mode === 'on') return true
  if (mode === 'off') return false
  return humidity !== null && humidity > humidityThreshold
}

function fanMode(config: DeviceConfig | undefined): Presentation['fan_mode'] {
  if (config?.fan_mode === 'ON') return 'on'
  if (config?.fan_mode === 'OFF') return 'off'
  return 'auto'
}

type FanInput = Pick<DashboardData, 'configs' | 'telemetry' | 'commands'>

export function fanState({ configs, telemetry, commands }: FanInput, deviceId: number | undefined) {
  const config = configs.find((item) => item.device_id === deviceId)
  const latest = latestAcknowledged(commands, deviceId, ['FAN_ON', 'FAN_OFF', 'FAN_AUTO'])
  const humidity = newestTelemetry(telemetry, deviceId)?.humidity ?? null
  const mode = fanMode(config)
  return {
    mode,
    running: fanRunning(
      latest,
      humidity,
      config?.humidity_threshold ?? MONITORING.humidityThreshold,
      mode,
    ),
  }
}

export function buzzerSounding(commands: DeviceCommand[], deviceId: number | undefined) {
  return (
    latestAcknowledged(commands, deviceId, ['BUZZER_ON', 'BUZZER_OFF'])?.command_type ===
    'BUZZER_ON'
  )
}

export function derivePresentation({
  devices,
  configs,
  telemetry,
  alerts,
  commands,
}: PresentationInput): Presentation {
  const envDevice = devices.find((device) => device.device_code.endsWith('_ENV'))
  const secDevice = devices.find((device) => device.device_code.endsWith('_SEC'))
  const fan = fanState({ configs, telemetry, commands }, envDevice?.device_id)
  const securityEvents = (
    secDevice
      ? telemetry.filter(
          (row) =>
            row.device_id === secDevice.device_id &&
            (row.door_status === true || row.motion_detected === true),
        )
      : []
  )
    .sort(
      (a, b) =>
        Date.parse(b.recorded_at) - Date.parse(a.recorded_at) || b.telemetry_id - a.telemetry_id,
    )
    .flatMap((row) => {
      const events: Presentation['security_events'] = []
      if (row.door_status === true)
        events.push({
          recorded_at: row.recorded_at,
          sensor: 'MC-38',
          description: 'Cửa mở ngoài giờ',
          alert_type: 'DOOR_BREACH',
        })
      if (row.motion_detected === true)
        events.push({
          recorded_at: row.recorded_at,
          sensor: 'HC-SR501',
          description: 'Phát hiện chuyển động',
          alert_type: 'MOTION_INTRUSION',
        })
      return events
    })
    .slice(0, 5)
  return {
    fan_mode: fan.mode,
    fan_running: fan.running,
    buzzer_sounding: buzzerSounding(commands, secDevice?.device_id),
    led: alerts.some((alert) => alert.severity === 'CRITICAL' && !alert.is_acknowledged)
      ? 'Đỏ nhấp nháy'
      : 'Tắt',
    security_events: securityEvents,
  }
}
