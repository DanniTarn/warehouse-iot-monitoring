import type { ApiClient, DashboardData } from './api'
import type { Alert, Device, DeviceCommand, Role, Telemetry, User } from './types'
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
const data: DashboardData = {
  devices,
  users,
  alerts,
  commands,
  telemetry,
  snapshot_at: snapshot,
  configs: devices.map((device) => ({
    device_id: device.device_id,
    humidity_threshold: device.device_code.endsWith('_ENV') ? MONITORING.humidityThreshold : null,
    smoke_gas_threshold: device.device_code.endsWith('_ENV') ? MONITORING.smoke.threshold : null,
    telemetry_interval: 5,
    night_mode_enabled: true,
    updated_at: snapshot,
  })),
  warehouses: [{ warehouse_id: 1, warehouse_name: 'Kho chính', location_address: null }],
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
  presentation: {
    fan_mode: 'auto',
    fan_running: true,
    buzzer_sounding: true,
    led: 'Đỏ nhấp nháy',
    security_events: [
      {
        recorded_at: stamp('13', '21:37:12'),
        sensor: 'MC-38',
        description: 'Cửa mở ngoài giờ',
        alert_type: 'DOOR_BREACH',
      },
      {
        recorded_at: stamp('13', '18:52:10'),
        sensor: 'HC-SR501',
        description: 'Phát hiện chuyển động',
        alert_type: null,
      },
    ],
  },
}
const wait = () => new Promise((resolve) => setTimeout(resolve, 180))
function sessionUser(token: string) {
  const user = users.find((item) => `mock-session-${item.username}` === token && item.is_active)
  if (!user) throw new Error('Phiên đăng nhập đã hết hạn.')
  return user
}
export const mockApi: ApiClient = {
  async login(username, password) {
    await wait()
    const user = users.find((item) => item.username === username && item.is_active)
    if (!user || password !== MOCK_PASSWORD) throw new Error('Sai tên đăng nhập hoặc mật khẩu.')
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
    })
  },
}
