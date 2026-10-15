export type Role = 'ADMIN' | 'OPERATOR' | 'VIEWER'
export type LifecycleStatus = 'REGISTERED' | 'ACTIVE' | 'OFFLINE' | 'MAINTENANCE' | 'DECOMMISSIONED'
export type CommandType = 'FAN_ON' | 'FAN_OFF' | 'FAN_AUTO' | 'BUZZER_OFF' // FAN_AUTO: proposed, §11
export type CommandStatus = 'PENDING' | 'SENT' | 'ACKNOWLEDGED' | 'FAILED'
export type Severity = 'INFO' | 'WARNING' | 'CRITICAL'
export type AlertType =
  | 'SMOKE_CRITICAL'
  | 'DOOR_BREACH'
  | 'MOTION_INTRUSION'
  | 'HUMIDITY_HIGH'
  | 'DEVICE_OFFLINE' // last two: proposed, §11
export type AuditAction = 'LOGIN' | 'UPDATE_CONFIG' | 'MANUAL_CONTROL' | 'DECOMMISSION' | string

export interface User {
  user_id: number
  username: string
  full_name: string
  email: string | null
  role: Role
  is_active: boolean
  created_at: string
  last_login: string | null
}
export interface Warehouse {
  warehouse_id: number
  warehouse_name: string
  location_address: string | null
}
export interface Device {
  device_id: number
  device_code: string
  device_name: string
  warehouse_id: number | null
  warehouse_name?: string
  assigned_user_id: number | null
  assigned_username?: string
  mac_address: string
  firmware_version: string | null
  ip_address: string | null
  lifecycle_status: LifecycleStatus
  last_heartbeat: string | null // ISO 8601
  online: boolean // computed by backend from last_heartbeat
  created_at: string
}
export interface DeviceConfig {
  device_id: number
  humidity_threshold: number | null // %
  smoke_gas_threshold: number | null // unit unconfirmed, §11
  telemetry_interval: number // seconds
  night_mode_enabled: boolean
  updated_at: string
}
export interface Telemetry {
  telemetry_id: number
  device_id: number
  device_code: string
  temperature: number | null
  humidity: number | null
  smoke_gas_level: number | null
  door_status: boolean | null // true = open
  motion_detected: boolean | null
  recorded_at: string
}
export interface DeviceCommand {
  command_id: number
  device_id: number
  device_code: string
  user_id: number
  username: string
  command_type: CommandType
  parameters: Record<string, unknown> | null
  status: CommandStatus
  sent_at: string
  acknowledged_at: string | null
}
export interface Alert {
  alert_id: number
  device_id: number
  device_code: string
  alert_type: AlertType
  severity: Severity
  alert_message: string
  is_acknowledged: boolean
  resolved_by_user_id: number | null
  resolved_by_username: string | null
  created_at: string
  resolved_at: string | null
}
export interface AuditLog {
  log_id: number
  user_id: number
  username: string
  action: AuditAction
  ip_client: string | null
  details: string | null
  created_at: string
}
