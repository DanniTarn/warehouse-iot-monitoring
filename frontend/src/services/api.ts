import type {
  Actuator,
  SystemState,
  Alert,
  AuditLog,
  ConfigPatch,
  Device,
  DeviceCommand,
  DeviceConfig,
  ManualCommandType,
  NewDevice,
  NewUser,
  Role,
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
  actuators: Actuator[]
  system: SystemState
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
export type HistoryTab = 'telemetry' | 'commands' | 'audit'
export interface HistoryQuery {
  tab: HistoryTab
  from: string
  to: string
  deviceId?: number
  offset?: number
}
export type HistoryRows =
  | { tab: 'telemetry'; rows: Telemetry[] }
  | { tab: 'commands'; rows: DeviceCommand[] }
  | { tab: 'audit'; rows: AuditLog[] }

export interface ApiClient {
  login(username: string, password: string): Promise<{ token: string; user: User }>
  me(token: string): Promise<User>
  dashboard(token: string): Promise<DashboardData>
  history(token: string, query: HistoryQuery): Promise<HistoryRows>
  audit(token: string): Promise<AuditLog[]>
  acknowledgeAlert(token: string, alertId: number): Promise<Alert>
  sendCommand(
    token: string,
    deviceId: number,
    type: ManualCommandType,
  ): Promise<DeviceCommand>
  registerDevice(
    token: string,
    input: NewDevice,
  ): Promise<{ device: Device; config: DeviceConfig; auth_token: string }>
  activateDevice(token: string, deviceId: number): Promise<Device>
  setLifecycle(
    token: string,
    deviceId: number,
    status: 'ACTIVE' | 'MAINTENANCE' | 'DECOMMISSIONED',
  ): Promise<Device>
  rotateDeviceToken(token: string, deviceId: number): Promise<string>
  updateConfig(token: string, deviceId: number, patch: ConfigPatch): Promise<DeviceConfig>
  createUser(token: string, input: NewUser): Promise<User>
  updateUser(
    token: string,
    userId: number,
    patch: { role?: Role; is_active?: boolean },
  ): Promise<User>
}

export const dataSource: string = import.meta.env.VITE_DATA_SOURCE || 'mock'
const unavailable = async (): Promise<never> => {
  throw new Error(
    `Nguồn dữ liệu “${dataSource}” không được hỗ trợ. Đặt VITE_DATA_SOURCE=mock hoặc api.`,
  )
}
const unavailableApi = new Proxy({} as ApiClient, { get: () => unavailable })
export const api: ApiClient =
  dataSource === 'mock' ? mockApi : dataSource === 'api' ? realApi : unavailableApi
