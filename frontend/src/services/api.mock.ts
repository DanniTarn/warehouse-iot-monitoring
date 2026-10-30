import type { ApiClient, DashboardData } from './api'
import { derivePresentation } from './dashboardView'
import { ForbiddenError, HttpError } from './http'
import type {
  Actuator,
  Alert,
  ConfigPatch,
  Device,
  DeviceCommand,
  DeviceConfig,
  Role,
  Telemetry,
  User,
} from './types'
import { MONITORING } from './config'

// Development fixtures only. This password and these tokens are not real credentials.
const MOCK_PASSWORD = 'demo123'
const snapshot = '2026-10-13T21:42:08+07:00'
const stamp = (day: string, clock: string) => `2026-10-${day}T${clock}+07:00`
const users: User[] = [
  ['admin', 'Quản trị viên', 'ADMIN', true],
  ['operator01', 'Thủ kho ca ngày', 'OPERATOR', true],
  ['operator02', 'Thủ kho ca đêm', 'OPERATOR', true],
  ['viewer01', 'Tài khoản xem', 'VIEWER', true],
  ['test01', 'Tài khoản thử nghiệm', 'VIEWER', false],
].map(([username, full_name, role, active], index) => ({
  user_id: index + 1,
  username: String(username),
  full_name: String(full_name),
  email: `${username}@kho.example`,
  role: role as Role,
  is_active: Boolean(active),
  created_at: stamp('06', '09:00:00'),
  last_login: stamp('13', ['21:40:00', '18:04:00', '06:12:00', '16:11:00', '10:02:00'][index]),
}))
const devices: Device[] = [
  {
    device_id: 1,
    device_code: MONITORING.environmentCode,
    device_name: 'Node 1 · Môi trường',
    lifecycle_status: 'ACTIVE',
    online: true,
    mac_address: '24:6F:28:A1:3C:90',
    firmware_version: '1.0.3',
    ip_address: '192.168.1.41',
    last_heartbeat: new Date(Date.now() - 4000).toISOString(),
  },
  {
    device_id: 2,
    device_code: MONITORING.securityCode,
    device_name: 'Node 2 · An ninh',
    lifecycle_status: 'ACTIVE',
    online: true,
    mac_address: '24:6F:28:A1:4E:12',
    firmware_version: '1.0.3',
    ip_address: '192.168.1.42',
    last_heartbeat: new Date(Date.now() - 7000).toISOString(),
  },
  {
    device_id: 3,
    device_code: 'NODE3_ENV',
    device_name: 'Node 3 · Môi trường',
    lifecycle_status: 'REGISTERED',
    online: false,
    mac_address: '24:6F:28:B0:77:5A',
    firmware_version: null,
    ip_address: null,
    last_heartbeat: null,
  },
  {
    device_id: 4,
    device_code: 'NODE4_SEC',
    device_name: 'Node 4 · An ninh',
    lifecycle_status: 'MAINTENANCE',
    online: false,
    mac_address: '24:6F:28:B0:91:C4',
    firmware_version: '1.0.2',
    ip_address: '192.168.1.44',
    last_heartbeat: new Date(Date.now() - 7200000).toISOString(),
  },
  {
    device_id: 5,
    device_code: 'NODE0_TEST',
    device_name: 'Node thử nghiệm',
    lifecycle_status: 'DECOMMISSIONED',
    online: false,
    mac_address: '24:6F:28:9C:02:1D',
    firmware_version: '0.9.1',
    ip_address: null,
    last_heartbeat: null,
  },
].map((device) => ({
  ...device,
  lifecycle_status: device.lifecycle_status as Device['lifecycle_status'],
  warehouse_id: device.device_id === 5 ? null : 1,
  warehouse_name: device.device_id === 5 ? undefined : 'Kho chính',
  assigned_user_id: device.device_id === 3 ? null : 2,
  assigned_username: device.device_id === 3 ? undefined : 'operator01',
  created_at: stamp('06', '09:20:00'),
}))
const alertSeeds: [
  number,
  Alert['severity'],
  Alert['alert_type'],
  number,
  string,
  string,
  string | null,
][] = [
  [
    5,
    'CRITICAL',
    'DOOR_BREACH',
    2,
    stamp('13', '21:37:12'),
    'Cửa kho bị mở ngoài giờ giới nghiêm',
    null,
  ],
  [
    4,
    'WARNING',
    'HUMIDITY_HIGH',
    1,
    stamp('13', '21:31:40'),
    'Độ ẩm 67,2 % vượt ngưỡng 65 %, quạt đã tự bật',
    null,
  ],
  [
    3,
    'CRITICAL',
    'MOTION_INTRUSION',
    2,
    stamp('12', '23:14:05'),
    'Phát hiện chuyển động trong kho ngoài giờ',
    'operator01',
  ],
  [
    2,
    'CRITICAL',
    'SMOKE_CRITICAL',
    1,
    stamp('11', '14:02:33'),
    `Nồng độ khói 412 ${MONITORING.smoke.unit} vượt ngưỡng 300 ${MONITORING.smoke.unit}`,
    'admin',
  ],
  [
    1,
    'INFO',
    'DEVICE_OFFLINE',
    1,
    stamp('10', '09:26:18'),
    'Mất kết nối 45 giây, thiết bị đã tự kết nối lại',
    'admin',
  ],
]
const alerts: Alert[] = alertSeeds.map(
  ([
    alert_id,
    severity,
    alert_type,
    device_id,
    created_at,
    alert_message,
    resolved_by_username,
  ]) => ({
    alert_id,
    severity,
    alert_type,
    device_id,
    device_code: devices[device_id - 1].device_code,
    created_at,
    alert_message,
    is_acknowledged: !!resolved_by_username,
    resolved_by_username,
    resolved_by_user_id: resolved_by_username ? (resolved_by_username === 'admin' ? 1 : 2) : null,
    resolved_at: resolved_by_username
      ? new Date(new Date(created_at).getTime() + 300000).toISOString()
      : null,
  }),
)
const commandSeeds: [number, DeviceCommand['command_type'], string, DeviceCommand['status']][] = [
  [2, 'BUZZER_ON', stamp('13', '21:37:14'), 'ACKNOWLEDGED'],
  [1, 'FAN_AUTO', stamp('13', '21:31:45'), 'ACKNOWLEDGED'],
  [1, 'FAN_OFF', stamp('13', '18:05:22'), 'ACKNOWLEDGED'],
  [1, 'FAN_ON', stamp('13', '14:47:10'), 'ACKNOWLEDGED'],
  [2, 'BUZZER_OFF', stamp('12', '23:19:52'), 'ACKNOWLEDGED'],
  [1, 'FAN_ON', stamp('12', '23:19:48'), 'FAILED'],
  [1, 'FAN_OFF', stamp('12', '09:30:02'), 'ACKNOWLEDGED'],
  [2, 'BUZZER_OFF', stamp('11', '14:10:41'), 'ACKNOWLEDGED'],
]
const commands: DeviceCommand[] = commandSeeds.map(
  ([device_id, command_type, sent_at, status], index) => ({
    command_id: index + 1,
    device_id,
    device_code: devices[device_id - 1].device_code,
    command_type,
    sent_at,
    status,
    user_id: 2,
    username: 'operator01',
    parameters: null,
    acknowledged_at:
      status === 'FAILED' ? null : new Date(new Date(sent_at).getTime() + 1000).toISOString(),
  }),
)
const telemetry: Telemetry[] = Array.from({ length: 120 }, (_, index) => {
  const environment = index % 2 === 0
  const age = Math.floor(index / 2)
  return {
    telemetry_id: 120 - index,
    device_id: environment ? 1 : 2,
    device_code: environment ? MONITORING.environmentCode : MONITORING.securityCode,
    temperature: environment ? Number((28.4 + Math.sin(age / 5) * 0.7).toFixed(1)) : null,
    humidity: environment ? Number((67.2 + Math.sin(age / 7) * 3).toFixed(1)) : null,
    smoke_gas_level: environment ? Math.round(142 + Math.sin(age / 3) * 24) : null,
    door_status: environment ? null : true,
    motion_detected: environment ? null : false,
    recorded_at: new Date(new Date(snapshot).getTime() - index * 2500).toISOString(),
  }
})
const warehouses = [{ warehouse_id: 1, warehouse_name: 'Kho chính', location_address: null }]
const configs: DeviceConfig[] = devices.map((device) => ({
  device_id: device.device_id,
  humidity_threshold: device.device_code.endsWith('_ENV') ? MONITORING.humidityThreshold : null,
  smoke_gas_threshold: device.device_code.endsWith('_ENV') ? MONITORING.smoke.threshold : null,
  temperature_threshold: 50,
  telemetry_interval: 5,
  night_mode_enabled: true,
  fan_mode: 'AUTO',
  updated_at: snapshot,
}))
const actuators: Actuator[] = [
  {
    device_id: 1,
    device_code: MONITORING.environmentCode,
    actuator_type: 'FAN',
    state: true,
    updated_at: snapshot,
  },
  {
    device_id: 2,
    device_code: MONITORING.securityCode,
    actuator_type: 'BUZZER',
    state: true,
    updated_at: snapshot,
  },
  {
    device_id: 2,
    device_code: MONITORING.securityCode,
    actuator_type: 'LED_RED',
    state: true,
    updated_at: snapshot,
  },
]
const data: DashboardData = {
  devices,
  users,
  alerts,
  commands,
  actuators,
  system: {
    night: false,
    night_start_hour: 20,
    night_end_hour: 6,
    timezone: 'Asia/Ho_Chi_Minh',
    server_time: snapshot,
  },
  telemetry,
  snapshot_at: snapshot,
  configs,
  warehouses,
  audit: [
    {
      log_id: 1,
      user_id: 1,
      username: 'admin',
      action: 'LOGIN',
      ip_client: '192.168.1.20',
      details: 'Đăng nhập thành công',
      created_at: stamp('13', '21:40:15'),
    },
    {
      log_id: 2,
      user_id: 2,
      username: 'operator01',
      action: 'MANUAL_CONTROL',
      ip_client: '192.168.1.23',
      details: 'FAN_OFF gửi tới NODE1_ENV',
      created_at: stamp('13', '18:05:22'),
    },
    {
      log_id: 3,
      user_id: 4,
      username: 'viewer01',
      action: 'MANUAL_CONTROL',
      ip_client: '192.168.1.31',
      details: 'Bị từ chối (403): FAN_ON gửi tới NODE1_ENV',
      created_at: stamp('13', '16:12:09'),
    },
    {
      log_id: 4,
      user_id: 1,
      username: 'admin',
      action: 'UPDATE_CONFIG',
      ip_client: '192.168.1.20',
      details: 'NODE1_ENV: telemetry_interval 30 thành 5',
      created_at: stamp('13', '09:02:44'),
    },
    {
      log_id: 5,
      user_id: 1,
      username: 'admin',
      action: 'DECOMMISSION',
      ip_client: '192.168.1.20',
      details: 'NODE0_TEST: thu hồi token, chặn kết nối',
      created_at: stamp('10', '15:30:00'),
    },
  ],
  presentation: derivePresentation({ devices, configs, telemetry, alerts, commands }),
}
const MANUAL_COMMANDS: string[] = ['FAN_ON', 'FAN_OFF', 'FAN_AUTO', 'BUZZER_OFF']
const CONFIG_RANGES = {
  temperature_threshold: ['Ngưỡng nhiệt độ', 0, 125],
  humidity_threshold: ['Ngưỡng độ ẩm', 0, 100],
  smoke_gas_threshold: ['Ngưỡng khói', 0, 100000],
  telemetry_interval: ['Chu kỳ dữ liệu', 1, 3600],
} as const
const wait = () => new Promise((resolve) => setTimeout(resolve, 180))
function sessionUser(token: string) {
  const user = users.find((item) => `mock-session-${item.username}` === token && item.is_active)
  if (!user) throw new Error('Phiên đăng nhập đã hết hạn.')
  return user
}
function requireRole(user: User, roles: Role[]) {
  if (!roles.includes(user.role)) throw new ForbiddenError()
}
function findDevice(deviceId: number) {
  const device = devices.find((item) => item.device_id === deviceId)
  if (!device) throw new HttpError(404, 'Không tìm thấy thiết bị.')
  return device
}
function findConfig(deviceId: number) {
  const config = configs.find((item) => item.device_id === deviceId)
  if (!config) throw new HttpError(404, 'Không tìm thấy cấu hình thiết bị.')
  return config
}
function defaultConfig(deviceId: number, code: string): DeviceConfig {
  return {
    device_id: deviceId,
    humidity_threshold: code.endsWith('_ENV') ? MONITORING.humidityThreshold : null,
    smoke_gas_threshold: code.endsWith('_ENV') ? MONITORING.smoke.threshold : null,
    temperature_threshold: 50,
    telemetry_interval: 5,
    night_mode_enabled: true,
    fan_mode: 'AUTO',
    updated_at: new Date().toISOString(),
  }
}
const passwords = new Map<string, string>()
function record(user: User, action: string, details: string) {
  data.audit.unshift({
    log_id: Math.max(0, ...data.audit.map((item) => item.log_id)) + 1,
    user_id: user.user_id,
    username: user.username,
    action,
    ip_client: '127.0.0.1',
    details,
    created_at: new Date().toISOString(),
  })
}
export const mockApi: ApiClient = {
  async login(username, password) {
    await wait()
    const user = users.find((item) => item.username === username && item.is_active)
    if (!user || password !== (passwords.get(username) ?? MOCK_PASSWORD))
      throw new Error('Sai tên đăng nhập hoặc mật khẩu.')
    return { token: `mock-session-${user.username}`, user: { ...user } }
  },
  async me(token) {
    await wait()
    return { ...sessionUser(token) }
  },
  async dashboard(token) {
    await wait()
    const user = sessionUser(token)
    return structuredClone({
      ...data,
      users: user.role === 'ADMIN' ? users : [],
      audit: user.role === 'ADMIN' ? data.audit : [],
      presentation: derivePresentation(data),
    })
  },
  async history(token, query) {
    await wait()
    sessionUser(token)
    const start = Date.parse(`${query.from}T00:00:00+07:00`)
    const end = Date.parse(`${query.to}T23:59:59.999+07:00`)
    const inRange = (value: string) => Date.parse(value) >= start && Date.parse(value) <= end
    const byDevice = (deviceId: number) =>
      query.deviceId === undefined || query.deviceId === deviceId
    if (query.tab === 'telemetry')
      return {
        tab: 'telemetry',
        rows: data.telemetry
          .filter((row) => inRange(row.recorded_at) && byDevice(row.device_id))
          .slice(0, 5000),
      }
    if (query.tab === 'commands')
      return {
        tab: 'commands',
        rows: data.commands
          .filter((row) => inRange(row.sent_at) && byDevice(row.device_id))
          .slice(0, 500),
      }
    return { tab: 'audit', rows: data.audit.filter((row) => inRange(row.created_at)).slice(0, 500) }
  },
  async audit(token) {
    await wait()
    requireRole(sessionUser(token), ['ADMIN'])
    return structuredClone(data.audit)
  },
  async acknowledgeAlert(token, alertId) {
    await wait()
    const user = sessionUser(token)
    requireRole(user, ['ADMIN', 'OPERATOR'])
    const alert = alerts.find((item) => item.alert_id === alertId)
    if (!alert || alert.is_acknowledged) {
      throw new HttpError(409, 'Cảnh báo không tồn tại hoặc đã được xử lý.')
    }
    alert.is_acknowledged = true
    alert.resolved_by_user_id = user.user_id
    alert.resolved_by_username = user.username
    alert.resolved_at = new Date().toISOString()
    record(user, 'ACKNOWLEDGE_ALERT', `alert_id ${alertId}`)
    return structuredClone(alert)
  },
  async sendCommand(token, deviceId, type) {
    await wait()
    const user = sessionUser(token)
    requireRole(user, ['ADMIN', 'OPERATOR'])
    if (!MANUAL_COMMANDS.includes(type)) throw new HttpError(400, 'Loại lệnh không hợp lệ.')
    const device = findDevice(deviceId)
    if (device.lifecycle_status !== 'ACTIVE') {
      throw new HttpError(409, 'Thiết bị chưa kích hoạt hoặc đang bị khóa.')
    }
    if (type.startsWith('FAN_') && !device.device_code.endsWith('_ENV')) {
      throw new HttpError(400, 'Chỉ có thể điều khiển quạt ở Node môi trường.')
    }
    if (type.startsWith('BUZZER_') && !device.device_code.endsWith('_SEC')) {
      throw new HttpError(400, 'Chỉ có thể điều khiển còi ở Node an ninh.')
    }
    const sentAt = new Date().toISOString()
    const command: DeviceCommand = {
      command_id: Math.max(0, ...commands.map((item) => item.command_id)) + 1,
      device_id: deviceId,
      device_code: device.device_code,
      user_id: user.user_id,
      username: user.username,
      command_type: type,
      parameters: null,
      status: 'ACKNOWLEDGED',
      sent_at: sentAt,
      acknowledged_at: sentAt,
    }
    commands.unshift(command)
    if (type === 'FAN_ON' || type === 'FAN_OFF' || type === 'FAN_AUTO') {
      const config = findConfig(deviceId)
      config.fan_mode = type === 'FAN_ON' ? 'ON' : type === 'FAN_OFF' ? 'OFF' : 'AUTO'
      config.updated_at = sentAt
    }
    function setActuator(actuatorType: string, state: boolean) {
      const existing = actuators.find(
        (item) => item.device_id === deviceId && item.actuator_type === actuatorType,
      )
      if (existing) {
        existing.state = state
        existing.updated_at = sentAt
        return
      }
      actuators.push({
        device_id: deviceId,
        device_code: device.device_code,
        actuator_type: actuatorType,
        state,
        updated_at: sentAt,
      })
    }
    if (type === 'FAN_ON') setActuator('FAN', true)
    if (type === 'FAN_OFF') setActuator('FAN', false)
    if (type === 'BUZZER_OFF') {
      setActuator('BUZZER', false)
      setActuator('LED_RED', false)
    }
    record(user, 'MANUAL_CONTROL', `${type} gửi tới ${device.device_code}`)
    return structuredClone(command)
  },
  async registerDevice(token, input) {
    await wait()
    const user = sessionUser(token)
    requireRole(user, ['ADMIN'])
    if (!/^NODE[0-9]+_(ENV|SEC)$/.test(input.device_code)) {
      throw new HttpError(400, 'Mã thiết bị cần có dạng NODE1_ENV hoặc NODE2_SEC.')
    }
    const mac = input.mac_address.toUpperCase()
    if (!/^([0-9A-F]{2}:){5}[0-9A-F]{2}$/.test(mac)) {
      throw new HttpError(400, 'Địa chỉ MAC không hợp lệ.')
    }
    if (devices.some((item) => item.device_code === input.device_code || item.mac_address === mac)) {
      throw new HttpError(409, 'Dữ liệu đã tồn tại.')
    }
    const deviceId = Math.max(0, ...devices.map((item) => item.device_id)) + 1
    const warehouse = warehouses.find((item) => item.warehouse_id === input.warehouse_id)
    const owner = users.find((item) => item.user_id === input.assigned_user_id)
    const device: Device = {
      device_id: deviceId,
      device_code: input.device_code,
      device_name: input.device_name,
      warehouse_id: input.warehouse_id,
      warehouse_name: warehouse?.warehouse_name,
      assigned_user_id: input.assigned_user_id,
      assigned_username: owner?.username,
      mac_address: mac,
      firmware_version: null,
      ip_address: null,
      lifecycle_status: 'REGISTERED',
      last_heartbeat: null,
      online: false,
      created_at: new Date().toISOString(),
    }
    const config = defaultConfig(deviceId, device.device_code)
    devices.push(device)
    configs.push(config)
    record(user, 'REGISTER_DEVICE', device.device_code)
    return {
      device: structuredClone(device),
      config: structuredClone(config),
      auth_token: `mock-token-${device.device_code}-${deviceId}`,
    }
  },
  async activateDevice(token, deviceId) {
    await wait()
    const user = sessionUser(token)
    requireRole(user, ['ADMIN'])
    const device = findDevice(deviceId)
    if (device.lifecycle_status !== 'REGISTERED') {
      throw new HttpError(409, 'Thiết bị không ở trạng thái chờ kích hoạt hoặc thiếu token.')
    }
    device.lifecycle_status = 'ACTIVE'
    record(user, 'ACTIVATE_DEVICE', device.device_code)
    return structuredClone(device)
  },
  async setLifecycle(token, deviceId, status) {
    await wait()
    const user = sessionUser(token)
    requireRole(user, ['ADMIN'])
    const device = findDevice(deviceId)
    if (device.lifecycle_status === 'DECOMMISSIONED') {
      throw new HttpError(409, 'Thiết bị đã thu hồi không thể kích hoạt lại.')
    }
    if (device.lifecycle_status === 'REGISTERED') {
      throw new HttpError(409, 'Hãy kích hoạt thiết bị trước khi thay đổi vòng đời.')
    }
    device.lifecycle_status = status
    device.online = false
    if (status === 'ACTIVE') device.last_heartbeat = null
    record(user, status === 'DECOMMISSIONED' ? 'DECOMMISSION' : 'UPDATE_LIFECYCLE', `${device.device_code} → ${status}`)
    return structuredClone(device)
  },
  async rotateDeviceToken(token, deviceId) {
    await wait()
    const user = sessionUser(token)
    requireRole(user, ['ADMIN'])
    const device = findDevice(deviceId)
    if (device.lifecycle_status === 'DECOMMISSIONED') {
      throw new HttpError(404, 'Không tìm thấy thiết bị có thể cấp lại token.')
    }
    record(user, 'ROTATE_DEVICE_TOKEN', device.device_code)
    return `mock-token-${device.device_code}-${Date.now()}`
  },
  async updateConfig(token, deviceId, patch) {
    await wait()
    const user = sessionUser(token)
    requireRole(user, ['ADMIN', 'OPERATOR'])
    const config = findConfig(deviceId)
    const fields: (keyof ConfigPatch)[] = [
      'temperature_threshold',
      'humidity_threshold',
      'smoke_gas_threshold',
      'telemetry_interval',
      'night_mode_enabled',
    ]
    if (!fields.some((field) => patch[field] !== undefined)) {
      throw new HttpError(400, 'Chưa có cấu hình cần thay đổi.')
    }
    for (const [field, [label, min, max]] of Object.entries(CONFIG_RANGES)) {
      const value = patch[field as keyof typeof CONFIG_RANGES]
      if (value === undefined || value === null) continue
      if (!Number.isFinite(value) || value < min || value > max)
        throw new HttpError(400, `${label} không hợp lệ.`)
    }
    if (patch.telemetry_interval !== undefined && !Number.isInteger(patch.telemetry_interval)) {
      throw new HttpError(400, 'Chu kỳ dữ liệu phải là số nguyên dương.')
    }
    if (patch.temperature_threshold !== undefined) {
      config.temperature_threshold = patch.temperature_threshold
    }
    if (patch.humidity_threshold !== undefined) config.humidity_threshold = patch.humidity_threshold
    if (patch.smoke_gas_threshold !== undefined) {
      config.smoke_gas_threshold = patch.smoke_gas_threshold
    }
    if (patch.telemetry_interval !== undefined) config.telemetry_interval = patch.telemetry_interval
    if (patch.night_mode_enabled !== undefined) {
      config.night_mode_enabled = patch.night_mode_enabled
    }
    config.updated_at = new Date().toISOString()
    record(user, 'UPDATE_CONFIG', `device_id ${deviceId}`)
    return structuredClone(config)
  },
  async createUser(token, input) {
    await wait()
    const user = sessionUser(token)
    requireRole(user, ['ADMIN'])
    if (!/^[a-zA-Z0-9_.-]+$/.test(input.username)) {
      throw new HttpError(
        400,
        'Tên đăng nhập chỉ gồm chữ, số, dấu chấm, gạch ngang hoặc gạch dưới.',
      )
    }
    if (input.password.length < 8) {
      throw new HttpError(400, 'Mật khẩu cần ít nhất 8 ký tự.')
    }
    if (input.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.email)) {
      throw new HttpError(400, 'Email không hợp lệ.')
    }
    if (users.some((item) => item.username === input.username)) {
      throw new HttpError(409, 'Tên đăng nhập đã tồn tại.')
    }
    const account: User = {
      user_id: Math.max(0, ...users.map((item) => item.user_id)) + 1,
      username: input.username,
      full_name: input.full_name,
      email: input.email || null,
      role: input.role,
      is_active: true,
      created_at: new Date().toISOString(),
      last_login: null,
    }
    users.push(account)
    passwords.set(account.username, input.password)
    record(user, 'CREATE_USER', `${account.username} · ${account.role}`)
    return structuredClone(account)
  },
  async updateUser(token, userId, patch) {
    await wait()
    const user = sessionUser(token)
    requireRole(user, ['ADMIN'])
    if (patch.role === undefined && patch.is_active === undefined) {
      throw new HttpError(400, 'Chưa có dữ liệu cập nhật.')
    }
    const account = users.find((item) => item.user_id === userId)
    if (!account) throw new HttpError(404, 'Không tìm thấy tài khoản.')
    const losesAdmin =
      patch.is_active === false || (patch.role !== undefined && patch.role !== 'ADMIN')
    if (userId === user.user_id && losesAdmin) {
      throw new ForbiddenError('Không thể tự khóa hoặc hạ quyền tài khoản đang đăng nhập.')
    }
    if (
      account.role === 'ADMIN' &&
      losesAdmin &&
      users.filter((item) => item.role === 'ADMIN' && item.is_active).length < 2
    ) {
      throw new HttpError(409, 'Không thể khóa hoặc hạ quyền quản trị viên cuối cùng.')
    }
    if (patch.role !== undefined) account.role = patch.role
    if (patch.is_active !== undefined) account.is_active = patch.is_active
    record(user, 'UPDATE_USER', account.username)
    return structuredClone(account)
  },
}
