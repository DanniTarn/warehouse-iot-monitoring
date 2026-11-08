import type { ApiClient, DashboardData } from './api'
import { derivePresentation } from './dashboardView'
import { HttpError, request } from './http'
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

// The backend caps list queries at 500 rows, so two pages fill the 1000-row telemetry window.
const TELEMETRY_LIMIT = 1000
const TELEMETRY_PAGE = 500

async function loadTelemetry(token: string) {
  const pages = await Promise.all(
    [0, TELEMETRY_PAGE].map((offset) =>
      request<Telemetry[]>(`/telemetry?limit=${TELEMETRY_PAGE}&offset=${offset}`, { token }),
    ),
  )
  return pages.flat().slice(0, TELEMETRY_LIMIT)
}

async function loadConfigs(devices: Device[], token: string) {
  const results = await Promise.allSettled(
    devices.map((device) =>
      request<DeviceConfig>(`/devices/${device.device_id}/config`, { token }),
    ),
  )
  const configs: DeviceConfig[] = []
  for (const result of results) {
    if (result.status === 'fulfilled') configs.push(result.value)
    else if (!(result.reason instanceof HttpError && result.reason.status === 404)) {
      throw result.reason
    }
  }
  return configs
}

function newest(values: (string | null)[]) {
  return values.reduce<string | undefined>(
    (latest, value) =>
      value && (!latest || Date.parse(value) > Date.parse(latest)) ? value : latest,
    undefined,
  )
}

export const realApi: ApiClient = {
  login(username, password) {
    return request<{ token: string; user: User }>('/auth/login', {
      method: 'POST',
      body: { username, password },
    })
  },
  me(token) {
    return request<User>('/auth/me', { token })
  },
  audit(token) {
    return request<AuditLog[]>('/audit-logs?limit=200', { token })
  },
  async dashboard(token) {
    const user = await realApi.me(token)
    const admin = user.role === 'ADMIN'
    const [devices, telemetry, alerts, commands, warehouses, users, audit] = await Promise.all([
      request<Device[]>('/devices', { token }),
      loadTelemetry(token),
      request<Alert[]>('/alerts?limit=200', { token }),
      request<DeviceCommand[]>('/commands?limit=200', { token }),
      request<Warehouse[]>('/warehouses', { token }),
      admin ? request<User[]>('/users', { token }) : Promise.resolve<User[]>([]),
      admin ? realApi.audit(token) : Promise.resolve<AuditLog[]>([]),
    ])
    const configs = await loadConfigs(devices, token)
    const data: DashboardData = {
      devices,
      configs,
      telemetry,
      alerts,
      commands,
      warehouses,
      users,
      audit,
      snapshot_at:
        newest(telemetry.map((row) => row.recorded_at)) ??
        newest(devices.map((device) => device.last_heartbeat)) ??
        new Date().toISOString(),
      presentation: derivePresentation({ devices, configs, telemetry, alerts, commands }),
    }
    return data
  },
  acknowledgeAlert(token, alertId) {
    return request<Alert>(`/alerts/${alertId}/acknowledge`, { token, method: 'POST' })
  },
  sendCommand(token, deviceId, type) {
    return request<DeviceCommand>(`/commands/device/${deviceId}`, {
      token,
      method: 'POST',
      body: { command_type: type },
    })
  },
  async registerDevice(token, input) {
    const created = await request<{ device: Device; auth_token: string }>('/devices', {
      token,
      method: 'POST',
      body: input,
    })
    const config = await request<DeviceConfig>(`/devices/${created.device.device_id}/config`, {
      token,
    })
    return { ...created, config }
  },
  activateDevice(token, deviceId) {
    return request<Device>(`/devices/${deviceId}/activate`, { token, method: 'POST' })
  },
  setLifecycle(token, deviceId, status) {
    return request<Device>(`/devices/${deviceId}/lifecycle`, {
      token,
      method: 'PATCH',
      body: { status },
    })
  },
  async rotateDeviceToken(token, deviceId) {
    const result = await request<{ auth_token: string }>(`/devices/${deviceId}/token`, {
      token,
      method: 'POST',
    })
    return result.auth_token
  },
  updateConfig(token, deviceId, patch) {
    return request<DeviceConfig>(`/devices/${deviceId}/config`, {
      token,
      method: 'PUT',
      body: patch,
    })
  },
  createUser(token, input) {
    return request<User>('/users', { token, method: 'POST', body: input })
  },
  updateUser(token, userId, patch) {
    return request<User>(`/users/${userId}`, { token, method: 'PATCH', body: patch })
  },
}
