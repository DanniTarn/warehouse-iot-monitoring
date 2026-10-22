import { beforeEach, describe, expect, it } from 'vitest'
import type { DashboardData } from '../services/api'
import type { RealtimeEvent } from '../services/realtime'
import type { Alert, Device, DeviceCommand, DeviceConfig, Telemetry, User } from '../services/types'
import { useDashboard } from './dashboard'

const at = (minute: number) => `2026-11-08T10:${String(minute).padStart(2, '0')}:00+07:00`

function device(device_id: number): Device {
  return {
    device_id,
    device_code: device_id === 1 ? 'NODE1_ENV' : 'NODE2_SEC',
    device_name: `Node ${device_id}`,
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

function config(device_id: number): DeviceConfig {
  return {
    device_id,
    humidity_threshold: 65,
    smoke_gas_threshold: 300,
    temperature_threshold: 50,
    telemetry_interval: 5,
    night_mode_enabled: true,
    fan_mode: 'AUTO',
    updated_at: at(0),
  }
}

function reading(telemetry_id: number, device_id: number, recorded_at: string): Telemetry {
  return {
    telemetry_id,
    device_id,
    device_code: device_id === 1 ? 'NODE1_ENV' : 'NODE2_SEC',
    temperature: null,
    humidity: null,
    smoke_gas_level: null,
    door_status: null,
    motion_detected: null,
    recorded_at,
  }
}

function command(command_id: number, overrides: Partial<DeviceCommand> = {}): DeviceCommand {
  return {
    command_id,
    device_id: 2,
    device_code: 'NODE2_SEC',
    user_id: 2,
    username: 'operator01',
    command_type: 'BUZZER_OFF',
    parameters: null,
    status: 'PENDING',
    sent_at: at(10),
    acknowledged_at: null,
    ...overrides,
  }
}

function alert(alert_id: number, overrides: Partial<Alert> = {}): Alert {
  return {
    alert_id,
    device_id: 2,
    device_code: 'NODE2_SEC',
    alert_type: 'MOTION_INTRUSION',
    severity: 'CRITICAL',
    alert_message: 'Cũ',
    is_acknowledged: false,
    resolved_by_user_id: null,
    resolved_by_username: null,
    created_at: at(10),
    resolved_at: null,
    ...overrides,
  }
}

function user(user_id: number): User {
  return {
    user_id,
    username: `user${user_id}`,
    full_name: `Người dùng ${user_id}`,
    email: null,
    role: 'VIEWER',
    is_active: true,
    created_at: at(0),
    last_login: null,
  }
}

function dashboard(overrides: Partial<DashboardData> = {}): DashboardData {
  return {
    devices: [device(1), device(2)],
    configs: [config(1), config(2)],
    telemetry: [reading(2, 2, at(20)), reading(1, 1, at(10))],
    alerts: [alert(1)],
    commands: [command(1)],
    audit: [],
    users: [],
    warehouses: [],
    snapshot_at: at(20),
    presentation: {
      fan_mode: 'auto',
      fan_running: false,
      buzzer_sounding: false,
      led: 'Tắt',
      security_events: [],
    },
    ...overrides,
  }
}

beforeEach(() => {
  useDashboard.getState().reset()
})

function load(data = dashboard()) {
  useDashboard.setState({ data, loading: false, error: '' })
}

describe('dashboard applyEvent telemetry', () => {
  it('prepends a reading, de-dupes it and advances the snapshot without mutating old data', () => {
    load()
    const before = useDashboard.getState().data!
    const event: RealtimeEvent = {
      type: 'telemetry',
      data: reading(99, 2, at(30)),
    }
    useDashboard.getState().applyEvent(event)
    const data = useDashboard.getState().data!
    expect(data.telemetry.map((row) => row.telemetry_id)).toEqual([99, 2, 1])
    expect(data.snapshot_at).toBe(at(30))
    expect(before.telemetry.map((row) => row.telemetry_id)).toEqual([2, 1])
    useDashboard.getState().applyEvent(event)
    expect(data.telemetry.map((row) => row.telemetry_id)).toEqual([99, 2, 1])
    expect(useDashboard.getState().data!.telemetry).toHaveLength(3)
  })

  it('caps the buffer at 1500 rows', () => {
    const rows = Array.from({ length: 1500 }, (_, index) =>
      reading(1000 + index, 2, new Date(Date.parse(at(0)) - index * 1000).toISOString()),
    )
    load(dashboard({ telemetry: rows }))
    useDashboard.getState().applyEvent({
      type: 'telemetry',
      data: reading(9000, 2, at(30)),
    })
    const data = useDashboard.getState().data!
    expect(data.telemetry).toHaveLength(1500)
    expect(data.telemetry[0].telemetry_id).toBe(9000)
    expect(data.telemetry.some((row) => row.telemetry_id === 2499)).toBe(false)
  })
})

describe('dashboard applyEvent device and alert updates', () => {
  it('patches only the device named by a device_status event', () => {
    load()
    useDashboard.getState().applyEvent({
      type: 'device_status',
      data: {
        device_id: 2,
        online: false,
        last_heartbeat: at(40),
        lifecycle_status: 'OFFLINE',
      },
    })
    const devices = useDashboard.getState().data!.devices
    expect(devices[1]).toMatchObject({
      online: false,
      last_heartbeat: at(40),
      lifecycle_status: 'OFFLINE',
    })
    expect(devices[0]).toMatchObject({ online: true, lifecycle_status: 'ACTIVE' })
  })

  it('prepends and de-dupes alert_created, then recomputes the LED', () => {
    load(dashboard({ alerts: [] }))
    useDashboard.getState().applyEvent({
      type: 'alert_created',
      data: alert(2, { alert_message: 'Mới' }),
    })
    useDashboard.getState().applyEvent({
      type: 'alert_created',
      data: alert(2, { alert_message: 'Mới hơn' }),
    })
    const data = useDashboard.getState().data!
    expect(data.alerts).toHaveLength(1)
    expect(data.alerts[0].alert_message).toBe('Mới hơn')
    expect(data.presentation.led).toBe('Đỏ nhấp nháy')
  })

  it('replaces an alert in place by alert_id', () => {
    load()
    useDashboard.getState().applyEvent({
      type: 'alert_updated',
      data: alert(1, {
        alert_message: 'Đã xử lý',
        is_acknowledged: true,
        resolved_by_username: 'operator01',
      }),
    })
    const data = useDashboard.getState().data!
    expect(data.alerts).toHaveLength(1)
    expect(data.alerts[0]).toMatchObject({
      alert_id: 1,
      alert_message: 'Đã xử lý',
      is_acknowledged: true,
      resolved_by_username: 'operator01',
    })
    expect(data.presentation.led).toBe('Tắt')
  })
})

describe('dashboard applyEvent command status', () => {
  it('replaces a known command and prepends a new one', () => {
    load()
    useDashboard.getState().applyEvent({
      type: 'command_status',
      data: command(1, { status: 'ACKNOWLEDGED', acknowledged_at: at(11) }),
    })
    let commands = useDashboard.getState().data!.commands
    expect(commands).toHaveLength(1)
    expect(commands[0]).toMatchObject({ command_id: 1, status: 'ACKNOWLEDGED' })

    useDashboard.getState().applyEvent({
      type: 'command_status',
      data: command(2, {
        command_type: 'BUZZER_ON',
        status: 'ACKNOWLEDGED',
        sent_at: at(30),
      }),
    })
    commands = useDashboard.getState().data!.commands
    expect(commands.map((item) => item.command_id)).toEqual([2, 1])
    expect(useDashboard.getState().data!.presentation.buzzer_sounding).toBe(true)
  })
})

describe('dashboard applyEvent fan mode', () => {
  it('keeps AUTO when the rule engine acknowledges an automatic fan command', () => {
    load()
    useDashboard.getState().applyEvent({
      type: 'command_status',
      data: command(3, {
        device_id: 1,
        device_code: 'NODE1_ENV',
        user_id: null,
        username: null,
        command_type: 'FAN_OFF',
        status: 'ACKNOWLEDGED',
      }),
    })
    expect(useDashboard.getState().data!.presentation.fan_mode).toBe('auto')
  })

  it('switches to the forced mode when a user fan command is acknowledged', () => {
    load()
    useDashboard.getState().applyEvent({
      type: 'command_status',
      data: command(4, {
        device_id: 1,
        device_code: 'NODE1_ENV',
        command_type: 'FAN_OFF',
        status: 'ACKNOWLEDGED',
      }),
    })
    expect(useDashboard.getState().data!.presentation.fan_mode).toBe('off')
  })
})

describe('dashboard local upserts', () => {
  it('inserts a newly registered device and replaces a saved one', () => {
    load()
    useDashboard.getState().applyEvent({
      type: 'device_saved',
      data: { ...device(3), device_code: 'NODE3_ENV', device_name: 'Node 3 mới' },
    })
    let devices = useDashboard.getState().data!.devices
    expect(devices.map((item) => item.device_id)).toEqual([1, 2, 3])

    useDashboard.getState().applyEvent({
      type: 'device_saved',
      data: { ...device(1), lifecycle_status: 'MAINTENANCE' },
    })
    devices = useDashboard.getState().data!.devices
    expect(devices).toHaveLength(3)
    expect(devices[0].lifecycle_status).toBe('MAINTENANCE')
  })

  it('upserts a saved config and recomputes the fan mode', () => {
    load()
    useDashboard.getState().applyEvent({
      type: 'config_saved',
      data: { ...config(1), fan_mode: 'OFF' },
    })
    let data = useDashboard.getState().data!
    expect(data.configs).toHaveLength(2)
    expect(data.configs[0].fan_mode).toBe('OFF')
    expect(data.presentation.fan_mode).toBe('off')

    useDashboard.getState().applyEvent({
      type: 'config_saved',
      data: { ...config(1), fan_mode: 'ON', telemetry_interval: 30 },
    })
    data = useDashboard.getState().data!
    expect(data.configs).toHaveLength(2)
    expect(data.configs[0]).toMatchObject({ fan_mode: 'ON', telemetry_interval: 30 })
    expect(data.presentation.fan_mode).toBe('on')
  })

  it('inserts and replaces users by user_id', () => {
    load(dashboard({ users: [user(1)] }))
    useDashboard.getState().applyEvent({ type: 'user_saved', data: user(2) })
    expect(useDashboard.getState().data!.users.map((item) => item.user_id)).toEqual([1, 2])

    useDashboard.getState().applyEvent({
      type: 'user_saved',
      data: { ...user(2), full_name: 'Tên đã đổi', is_active: false },
    })
    const users = useDashboard.getState().data!.users
    expect(users).toHaveLength(2)
    expect(users[1]).toMatchObject({ full_name: 'Tên đã đổi', is_active: false })
  })
})

describe('dashboard applyEvent guards', () => {
  it('ignores events while no dashboard is loaded', () => {
    useDashboard.getState().applyEvent({
      type: 'telemetry',
      data: reading(99, 2, at(30)),
    })
    expect(useDashboard.getState().data).toBeNull()
  })

  it('ignores events whose data is null', () => {
    load()
    const before = useDashboard.getState().data
    useDashboard.getState().applyEvent({ type: 'telemetry', data: null })
    useDashboard.getState().applyEvent({ type: 'alert_created', data: null })
    expect(useDashboard.getState().data).toBe(before)
  })
})
