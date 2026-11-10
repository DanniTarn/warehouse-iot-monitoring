import type { DashboardData } from './api'
import { MONITORING } from './config'
import type { Actuator, DeviceCommand, DeviceConfig, Telemetry } from './types'

type Presentation = DashboardData['presentation']
type FanMode = 'auto' | 'on' | 'off'
export type PresentationInput = Pick<
  DashboardData,
  'devices' | 'alerts' | 'commands'
> & { actuators?: Actuator[] }
export type SecurityEvent = {
  recorded_at: string
  sensor: string
  description: string
  alert_type: string | null
}

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

export function newestTelemetry(telemetry: Telemetry[], deviceId: number | undefined) {
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
  mode: FanMode,
) {
  if (latest?.command_type === 'FAN_ON') return true
  if (latest?.command_type === 'FAN_OFF') return false
  if (mode === 'on') return true
  if (mode === 'off') return false
  return humidity !== null && humidity > humidityThreshold
}

function fanMode(config: DeviceConfig | undefined): FanMode {
  if (config?.fan_mode === 'ON') return 'on'
  if (config?.fan_mode === 'OFF') return 'off'
  return 'auto'
}

type FanInput = Pick<DashboardData, 'configs' | 'telemetry' | 'commands'> & {
  actuators?: Actuator[]
}

export function fanState(
  { configs, telemetry, commands, actuators = [] }: FanInput,
  deviceId: number | undefined,
) {
  const config = configs.find((item) => item.device_id === deviceId)
  const latest = latestAcknowledged(commands, deviceId, ['FAN_ON', 'FAN_OFF', 'FAN_AUTO'])
  const humidity = newestTelemetry(telemetry, deviceId)?.humidity ?? null
  const mode = fanMode(config)
  const actuator = actuators.find(
    (item) => item.device_id === deviceId && item.actuator_type === 'FAN',
  )
  return {
    mode,
    running: actuator
      ? actuator.state
      : fanRunning(
          latest,
          humidity,
          config?.humidity_threshold ?? MONITORING.humidityThreshold,
          mode,
        ),
  }
}

export function buzzerSounding(
  commands: DeviceCommand[],
  deviceId: number | undefined,
  actuators: Actuator[] = [],
) {
  const actuator = actuators.find(
    (item) => item.device_id === deviceId && item.actuator_type === 'BUZZER',
  )
  if (actuator) return actuator.state
  return (
    latestAcknowledged(commands, deviceId, ['BUZZER_ON', 'BUZZER_OFF'])?.command_type ===
    'BUZZER_ON'
  )
}

export function securityEvents(
  telemetry: Telemetry[],
  deviceId: number | undefined,
): SecurityEvent[] {
  if (deviceId === undefined) return []
  return telemetry
    .filter(
      (row) =>
        row.device_id === deviceId && (row.door_status === true || row.motion_detected === true),
    )
    .sort(
      (a, b) =>
        Date.parse(b.recorded_at) - Date.parse(a.recorded_at) || b.telemetry_id - a.telemetry_id,
    )
    .flatMap((row) => {
      const events: SecurityEvent[] = []
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
}

export function derivePresentation({
  devices,
  alerts,
  commands,
  actuators = [],
}: PresentationInput): Presentation {
  const buzzerSoundingAnywhere = devices
    .filter((device) => device.device_code.endsWith('_SEC'))
    .some((device) => buzzerSounding(commands, device.device_id, actuators))
  return {
    buzzer_sounding: buzzerSoundingAnywhere,
    led: alerts.some((alert) => alert.severity === 'CRITICAL' && !alert.is_acknowledged)
      ? 'Đỏ nhấp nháy'
      : 'Tắt',
  }
}
