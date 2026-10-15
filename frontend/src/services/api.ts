import type {
  Alert,
  AuditLog,
  Device,
  DeviceCommand,
  DeviceConfig,
  Telemetry,
  User,
  Warehouse,
} from './types'
import { mockApi } from './api.mock'

export interface DashboardData {
  devices: Device[]
  configs: DeviceConfig[]
  telemetry: Telemetry[]
  alerts: Alert[]
  commands: DeviceCommand[]
  audit: AuditLog[]
  users: User[]
  warehouses: Warehouse[]
  snapshot_at: string
  presentation: {
    fan_mode: 'auto' | 'on' | 'off'
    fan_running: boolean
    buzzer_sounding: boolean
    led: string
    security_events: {
      recorded_at: string
      sensor: string
      description: string
      alert_type: string | null
    }[]
  }
}
export interface ApiClient {
  login(username: string, password: string): Promise<{ token: string; user: User }>
  me(token: string): Promise<User>
  dashboard(token: string): Promise<DashboardData>
}
export class ForbiddenError extends Error {
  constructor() {
    super('Bạn không có quyền thực hiện thao tác này.')
  }
}
// The real REST adapter belongs to 20/10. Never silently present mock data as live API data.
const source = import.meta.env.VITE_DATA_SOURCE || 'mock'
const unavailable = async (): Promise<never> => {
  throw new Error(`Nguồn dữ liệu “${source}” chưa có trong mốc 15/10. Đặt VITE_DATA_SOURCE=mock.`)
}
export const api: ApiClient =
  source === 'mock'
    ? mockApi
    : {
        login: unavailable,
        me: unavailable,
        dashboard: unavailable,
      }
