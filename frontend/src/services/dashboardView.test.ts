import { describe, expect, it } from 'vitest'
import {
  buzzerSounding,
  derivePresentation,
  fanState,
  type PresentationInput,
} from './dashboardView'
import type { Alert, Device, DeviceCommand, DeviceConfig, Telemetry } from './types'

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
    curfew_end_hour: 6,
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

function input(overrides: Partial<PresentationInput> = {}): PresentationInput {
  return {
    devices: [device(1, 'NODE1_ENV'), device(2, 'NODE2_SEC')],
    configs: [config(1), config(2)],
    telemetry: [],
    alerts: [],
    commands: [],
    ...overrides,
  }
}

describe('derivePresentation fan state', () => {
  it('lowercases the fan mode of the environment config and defaults to auto', () => {
    expect(derivePresentation(input({ configs: [config(1, { fan_mode: 'ON' })] })).fan_mode).toBe(
      'on',
    )
    expect(derivePresentation(input({ configs: [config(1, { fan_mode: 'OFF' })] })).fan_mode).toBe(
      'off',
    )
    expect(derivePresentation(input({ configs: [] })).fan_mode).toBe('auto')
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
    expect(derivePresentation(input({ commands })).fan_running).toBe(false)
    commands.push(
      command({
        command_id: 4,
        device_id: 1,
        command_type: 'FAN_ON',
        status: 'ACKNOWLEDGED',
        sent_at: at(40),
      }),
    )
    expect(derivePresentation(input({ commands })).fan_running).toBe(true)
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
    expect(derivePresentation(input({ telemetry, commands })).fan_running).toBe(true)
    expect(
      derivePresentation(
        input({
          configs: [config(1, { humidity_threshold: 75 })],
          telemetry,
          commands,
        }),
      ).fan_running,
    ).toBe(false)
  })
})

describe('derivePresentation alarm state', () => {
  it('sounds the buzzer only for the latest acknowledged security command', () => {
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
    ]
    expect(derivePresentation(input({ commands })).buzzer_sounding).toBe(false)
    commands.push(
      command({
        command_id: 4,
        device_id: 2,
        command_type: 'BUZZER_ON',
        status: 'ACKNOWLEDGED',
        sent_at: at(40),
      }),
    )
    expect(derivePresentation(input({ commands })).buzzer_sounding).toBe(true)
  })

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

describe('derivePresentation security events', () => {
  it('maps door and motion telemetry to sensor events, newest first', () => {
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
        device_id: 1,
        device_code: 'NODE1_ENV',
        recorded_at: at(40),
        door_status: true,
      }),
    ]
    expect(derivePresentation(input({ telemetry })).security_events).toEqual([
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
    const events = derivePresentation(input({ telemetry })).security_events
    expect(events).toHaveLength(5)
    expect(events[0].recorded_at).toBe(at(55))
    expect(events.at(-1)?.recorded_at).toBe(at(20))
  })
})

describe('per-device fan and buzzer state', () => {
  it('reads the fan mode of the requested environment device, not the first one', () => {
    const data = input({
      devices: [device(1, 'NODE1_ENV'), device(2, 'NODE2_SEC'), device(3, 'NODE3_ENV')],
      configs: [config(1), config(2), config(3, { fan_mode: 'OFF' })],
    })
    expect(fanState(data, 3).mode).toBe('off')
    expect(derivePresentation(data).fan_mode).toBe('auto')
  })

  it('reads the buzzer of the requested security device', () => {
    const commands = [
      command({
        command_id: 1,
        device_id: 4,
        command_type: 'BUZZER_ON',
        status: 'ACKNOWLEDGED',
        sent_at: at(5),
      }),
    ]
    expect(buzzerSounding(commands, 4)).toBe(true)
    expect(buzzerSounding(commands, 2)).toBe(false)
  })
})

describe('derivePresentation fan state when a command left the window', () => {
  it('keeps a forced-on fan running from the saved mode alone', () => {
    const telemetry = [
      reading({
        telemetry_id: 1,
        device_id: 1,
        device_code: 'NODE1_ENV',
        recorded_at: at(5),
        humidity: 40,
      }),
    ]
    const state = derivePresentation(
      input({ configs: [config(1, { fan_mode: 'ON' })], telemetry, commands: [] }),
    )
    expect(state.fan_mode).toBe('on')
    expect(state.fan_running).toBe(true)
  })

  it('keeps a forced-off fan stopped even above the humidity threshold', () => {
    const telemetry = [
      reading({
        telemetry_id: 1,
        device_id: 1,
        device_code: 'NODE1_ENV',
        recorded_at: at(5),
        humidity: 90,
      }),
    ]
    const state = derivePresentation(
      input({ configs: [config(1, { fan_mode: 'OFF' })], telemetry, commands: [] }),
    )
    expect(state.fan_running).toBe(false)
  })
})

describe('reported actuator state', () => {
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
      {
        device_id: 1,
        device_code: 'NODE1_ENV',
        actuator_type: 'FAN',
        state: true,
        updated_at: at(11),
      },
    ]
    expect(
      fanState(
        { configs: [config(1, { fan_mode: 'OFF' })], telemetry: [], commands, actuators },
        1,
      ).running,
    ).toBe(true)
  })

  it('uses the buzzer state over remembered commands', () => {
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
      {
        device_id: 2,
        device_code: 'NODE2_SEC',
        actuator_type: 'BUZZER',
        state: false,
        updated_at: at(11),
      },
    ]
    expect(buzzerSounding(commands, 2, actuators)).toBe(false)
  })
})
