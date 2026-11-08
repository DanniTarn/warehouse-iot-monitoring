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
import { realApi } from './api.real'

export { ForbiddenError } from './http'

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

export const dataSource: string = import.meta.env.VITE_DATA_SOURCE || 'mock'
const unavailable = async (): Promise<never> => {
  throw new Error(
    `Nguồn dữ liệu “${dataSource}” không được hỗ trợ. Đặt VITE_DATA_SOURCE=mock hoặc api.`,
  )
}
export const api: ApiClient =
  dataSource === 'mock'
    ? mockApi
    : dataSource === 'api'
      ? realApi
      : {
          login: unavailable,
          me: unavailable,
          dashboard: unavailable,
        }
