import { describe, expect, it } from 'vitest'
import {
  buzzerSounding,
  derivePresentation,
  fanState,
  newestTelemetry,
  securityEvents,
  type PresentationInput,
} from './dashboardView'
import type { Actuator, Alert, Device, DeviceCommand, DeviceConfig, Telemetry } from './types'

const at = (minute: number) => `2026-11-08T10:${String(minute).padStart(2, '0')}:00+07:00`

function device(device_id: number, device_code: string): Device {
  return {
    device_id,
    device_code,
    device_name: device_code,
    warehouse_id: 1,
    assigned_user_id: null,
    mac_address: '02:00:00:00:00:01',
    firmware_version: null,
    ip_address: null,
    lifecycle_status: 'ACTIVE',
    last_heartbeat: at(0),
    online: true,
    created_at: at(0),
  }
}

function config(device_id: number, overrides: Partial<DeviceConfig> = {}): DeviceConfig {
  return {
    device_id,
    humidity_threshold: 65,
    smoke_gas_threshold: 300,
    temperature_threshold: 50,
    telemetry_interval: 5,
    night_mode_enabled: true,
    curfew_start_hour: 20,
    curfew_start_minute: 0,
    curfew_end_hour: 6,
    curfew_end_minute: 0,
    guard_mode: 'AUTO',
    fan_mode: 'AUTO',
    updated_at: at(0),
    ...overrides,
  }
}

function reading(
  overrides: Pick<Telemetry, 'telemetry_id' | 'device_id' | 'device_code' | 'recorded_at'> &
    Partial<Telemetry>,
): Telemetry {
  return {
    temperature: null,
    humidity: null,
    smoke_gas_level: null,
    door_status: null,
    motion_detected: null,
    ...overrides,
  }
}

function command(
  overrides: Pick<
    DeviceCommand,
    'command_id' | 'device_id' | 'command_type' | 'status' | 'sent_at'
  >,
): DeviceCommand {
  return {
    device_code: overrides.device_id === 1 ? 'NODE1_ENV' : 'NODE2_SEC',
    user_id: 2,
    username: 'operator01',
    parameters: null,
    acknowledged_at: null,
    ...overrides,
  }
}

function actuator(overrides: Pick<Actuator, 'device_id' | 'device_code' | 'actuator_type' | 'state'>): Actuator {
  return { updated_at: at(11), ...overrides }
}

function alert(
  overrides: Pick<Alert, 'alert_id' | 'severity' | 'is_acknowledged'> & Partial<Alert>,
): Alert {
  return {
    device_id: 2,
    device_code: 'NODE2_SEC',
    alert_type: 'MOTION_INTRUSION',
    alert_message: 'Phát hiện chuyển động',
    resolved_by_user_id: null,
    resolved_by_username: null,
    created_at: at(0),
    resolved_at: null,
    ...overrides,
  }
}

function fanData(
  overrides: Partial<{
    configs: DeviceConfig[]
    telemetry: Telemetry[]
    commands: DeviceCommand[]
    actuators: Actuator[]
  }> = {},
) {
  return {
    configs: [config(1), config(2)],
    telemetry: [],
    commands: [],
    ...overrides,
  }
}

function input(overrides: Partial<PresentationInput> = {}): PresentationInput {
  return {
    devices: [device(1, 'NODE1_ENV'), device(2, 'NODE2_SEC')],
    alerts: [],
    commands: [],
    ...overrides,
  }
}

describe('fan state', () => {
  it('reads the requested environment device instead of the first one', () => {
    const configs = [config(1), config(2), config(3, { fan_mode: 'OFF' })]
    expect(fanState(fanData({ configs }), 3).mode).toBe('off')
    expect(fanState(fanData({ configs }), 1).mode).toBe('auto')
    expect(fanState(fanData({ configs: [] }), 9).mode).toBe('auto')
  })

  it('lets the latest acknowledged fan command decide and ignores pending ones', () => {
    const commands = [
      command({
        command_id: 1,
        device_id: 1,
        command_type: 'FAN_ON',
        status: 'ACKNOWLEDGED',
        sent_at: at(10),
      }),
      command({
        command_id: 2,
        device_id: 1,
        command_type: 'FAN_OFF',
        status: 'ACKNOWLEDGED',
        sent_at: at(20),
      }),
      command({
        command_id: 3,
        device_id: 1,
        command_type: 'FAN_ON',
        status: 'PENDING',
        sent_at: at(30),
      }),
    ]
    expect(fanState(fanData({ commands }), 1).running).toBe(false)
    commands.push(
      command({
        command_id: 4,
        device_id: 1,
        command_type: 'FAN_ON',
        status: 'ACKNOWLEDGED',
        sent_at: at(40),
      }),
    )
    expect(fanState(fanData({ commands }), 1).running).toBe(true)
  })

  it('falls back to humidity against the environment threshold after FAN_AUTO', () => {
    const telemetry = [
      reading({
        telemetry_id: 1,
        device_id: 1,
        device_code: 'NODE1_ENV',
        recorded_at: at(10),
        humidity: 70,
      }),
    ]
    const commands = [
      command({
        command_id: 1,
        device_id: 1,
        command_type: 'FAN_AUTO',
        status: 'ACKNOWLEDGED',
        sent_at: at(20),
      }),
    ]
    expect(fanState(fanData({ telemetry, commands }), 1).running).toBe(true)
    expect(
      fanState(
        fanData({ configs: [config(1, { humidity_threshold: 75 })], telemetry, commands }),
        1,
      ).running,
    ).toBe(false)
  })

  it('keeps a forced mode from the saved config when no command is in the window', () => {
    const cool = [
      reading({
        telemetry_id: 1,
        device_id: 1,
        device_code: 'NODE1_ENV',
        recorded_at: at(5),
        humidity: 40,
      }),
    ]
    const humid = [
      reading({
        telemetry_id: 1,
        device_id: 1,
        device_code: 'NODE1_ENV',
        recorded_at: at(5),
        humidity: 90,
      }),
    ]
    const forcedOn = fanState(
      fanData({ configs: [config(1, { fan_mode: 'ON' })], telemetry: cool }),
      1,
    )
    expect(forcedOn.mode).toBe('on')
    expect(forcedOn.running).toBe(true)
    expect(
      fanState(fanData({ configs: [config(1, { fan_mode: 'OFF' })], telemetry: humid }), 1)
        .running,
    ).toBe(false)
  })

  it('uses the fan relay state over remembered commands', () => {
    const commands = [
      command({
        command_id: 1,
        device_id: 1,
        command_type: 'FAN_OFF',
        status: 'ACKNOWLEDGED',
        sent_at: at(10),
      }),
    ]
    const actuators = [
      actuator({ device_id: 1, device_code: 'NODE1_ENV', actuator_type: 'FAN', state: true }),
    ]
    expect(
      fanState(
        fanData({ configs: [config(1, { fan_mode: 'OFF' })], commands, actuators }),
        1,
      ).running,
    ).toBe(true)
  })
})

describe('buzzer state', () => {
  it('follows the latest acknowledged buzzer command of the requested device', () => {
    const commands = [
      command({
        command_id: 1,
        device_id: 2,
        command_type: 'BUZZER_ON',
        status: 'ACKNOWLEDGED',
        sent_at: at(10),
      }),
      command({
        command_id: 2,
        device_id: 2,
        command_type: 'BUZZER_OFF',
        status: 'ACKNOWLEDGED',
        sent_at: at(20),
      }),
      command({
        command_id: 3,
        device_id: 2,
        command_type: 'BUZZER_ON',
        status: 'SENT',
        sent_at: at(30),
      }),
      command({
        command_id: 4,
        device_id: 4,
        command_type: 'BUZZER_ON',
        status: 'ACKNOWLEDGED',
        sent_at: at(40),
      }),
    ]
    expect(buzzerSounding(commands, 2)).toBe(false)
    expect(buzzerSounding(commands, 4)).toBe(true)
    expect(buzzerSounding(commands, 5)).toBe(false)
  })

  it('uses the reported buzzer state over remembered commands', () => {
    const commands = [
      command({
        command_id: 1,
        device_id: 2,
        command_type: 'BUZZER_ON',
        status: 'ACKNOWLEDGED',
        sent_at: at(10),
      }),
    ]
    const actuators = [
      actuator({ device_id: 2, device_code: 'NODE2_SEC', actuator_type: 'BUZZER', state: false }),
    ]
    expect(buzzerSounding(commands, 2, actuators)).toBe(false)
  })

  it('reports the dashboard buzzer as sounding when any security device sounds', () => {
    const devices = [
      device(1, 'NODE1_ENV'),
      device(2, 'NODE2_SEC'),
      device(4, 'NODE4_SEC'),
    ]
    const quiet = [
      command({
        command_id: 1,
        device_id: 2,
        command_type: 'BUZZER_OFF',
        status: 'ACKNOWLEDGED',
        sent_at: at(10),
      }),
    ]
    expect(derivePresentation(input({ devices, commands: quiet })).buzzer_sounding).toBe(false)
    const sounding = [
      ...quiet,
      command({
        command_id: 2,
        device_id: 4,
        command_type: 'BUZZER_ON',
        status: 'ACKNOWLEDGED',
        sent_at: at(20),
      }),
    ]
    expect(derivePresentation(input({ devices, commands: sounding })).buzzer_sounding).toBe(true)
  })
})

describe('dashboard LED', () => {
  it('lights the LED only while an unacknowledged critical alert exists', () => {
    expect(
      derivePresentation(
        input({ alerts: [alert({ alert_id: 1, severity: 'CRITICAL', is_acknowledged: false })] }),
      ).led,
    ).toBe('Đỏ nhấp nháy')
    expect(
      derivePresentation(
        input({
          alerts: [
            alert({ alert_id: 1, severity: 'CRITICAL', is_acknowledged: true }),
            alert({
              alert_id: 2,
              severity: 'WARNING',
              alert_type: 'HUMIDITY_HIGH',
              is_acknowledged: false,
            }),
          ],
        }),
      ).led,
    ).toBe('Tắt')
  })
})

describe('security events', () => {
  it('maps door and motion telemetry of the requested device, newest first', () => {
    const telemetry = [
      reading({
        telemetry_id: 1,
        device_id: 2,
        device_code: 'NODE2_SEC',
        recorded_at: at(10),
        door_status: true,
      }),
      reading({
        telemetry_id: 2,
        device_id: 2,
        device_code: 'NODE2_SEC',
        recorded_at: at(20),
        motion_detected: true,
      }),
      reading({
        telemetry_id: 3,
        device_id: 2,
        device_code: 'NODE2_SEC',
        recorded_at: at(30),
        door_status: false,
        motion_detected: false,
      }),
      reading({
        telemetry_id: 4,
        device_id: 4,
        device_code: 'NODE4_SEC',
        recorded_at: at(40),
        door_status: true,
      }),
    ]
    expect(securityEvents(telemetry, 2)).toEqual([
      {
        recorded_at: at(20),
        sensor: 'HC-SR501',
        description: 'Phát hiện chuyển động',
        alert_type: 'MOTION_INTRUSION',
      },
      {
        recorded_at: at(10),
        sensor: 'MC-38',
        description: 'Cửa mở ngoài giờ',
        alert_type: 'DOOR_BREACH',
      },
    ])
    expect(securityEvents(telemetry, 4)).toHaveLength(1)
    expect(securityEvents(telemetry, 9)).toEqual([])
  })

  it('keeps only the five newest events', () => {
    const telemetry = [10, 20, 30, 40, 50, 55].map((minute, index) =>
      reading({
        telemetry_id: index + 1,
        device_id: 2,
        device_code: 'NODE2_SEC',
        recorded_at: at(minute),
        door_status: true,
      }),
    )
    const events = securityEvents(telemetry, 2)
    expect(events).toHaveLength(5)
    expect(events[0].recorded_at).toBe(at(55))
    expect(events.at(-1)?.recorded_at).toBe(at(20))
  })
})

describe('newest telemetry', () => {
  it('picks the latest reading of a device regardless of array order', () => {
    const telemetry = [
      reading({
        telemetry_id: 1,
        device_id: 3,
        device_code: 'NODE3_ENV',
        recorded_at: at(30),
        temperature: 31,
      }),
      reading({
        telemetry_id: 2,
        device_id: 3,
        device_code: 'NODE3_ENV',
        recorded_at: at(10),
        temperature: 26,
      }),
      reading({
        telemetry_id: 3,
        device_id: 1,
        device_code: 'NODE1_ENV',
        recorded_at: at(40),
        temperature: 28,
      }),
    ]
    expect(newestTelemetry(telemetry, 3)?.temperature).toBe(31)
    expect(newestTelemetry(telemetry, 1)?.temperature).toBe(28)
    expect(newestTelemetry(telemetry, 9)).toBeUndefined()
  })
})
