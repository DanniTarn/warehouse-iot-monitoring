import { create } from 'zustand'
import { api, dataSource, type DashboardData } from '../services/api'
import { derivePresentation } from '../services/dashboardView'
import type { RealtimeEvent, RealtimeState } from '../services/realtime'
import type { Device, DeviceCommand, DeviceConfig, User } from '../services/types'

const TELEMETRY_LIMIT = 1500
const initialConnection: RealtimeState = dataSource === 'api' ? 'reconnecting' : 'live'

export type DashboardChange =
  | RealtimeEvent
  | { type: 'device_saved'; data: Device }
  | { type: 'config_saved'; data: DeviceConfig }
  | { type: 'user_saved'; data: User }

interface DashboardState {
  data: DashboardData | null
  loading: boolean
  error: string
  connection: RealtimeState
  load: (token: string) => Promise<void>
  applyEvent: (change: DashboardChange) => void
  setConnection: (connection: RealtimeState) => void
  reset: () => void
}

function withPresentation(data: DashboardData): DashboardData {
  return { ...data, presentation: derivePresentation(data) }
}

function upsert<T>(items: T[], saved: T, key: (item: T) => number) {
  return items.some((item) => key(item) === key(saved))
    ? items.map((item) => (key(item) === key(saved) ? saved : item))
    : [...items, saved]
}

function fanModeOf(command: DeviceCommand): DeviceConfig['fan_mode'] | null {
  if (command.status !== 'ACKNOWLEDGED') return null
  if (command.command_type === 'FAN_ON') return 'ON'
  if (command.command_type === 'FAN_OFF') return 'OFF'
  if (command.command_type === 'FAN_AUTO') return 'AUTO'
  return null
}

let request = 0
export const useDashboard = create<DashboardState>((set) => ({
  data: null,
  loading: false,
  error: '',
  connection: initialConnection,
  async load(token) {
    const current = ++request
    set({ loading: true, error: '', data: null })
    try {
      const data = await api.dashboard(token)
      if (current === request) set({ data, loading: false })
    } catch (error) {
      if (current === request)
        set({
          error: error instanceof Error ? error.message : 'Không kết nối được máy chủ.',
          loading: false,
        })
    }
  },
  applyEvent(change) {
    set((state) => {
      const data = state.data
      if (!data) return state
      switch (change.type) {
        case 'telemetry': {
          const row = change.data
          if (!row) return state
          const telemetry = [
            row,
            ...data.telemetry.filter((item) => item.telemetry_id !== row.telemetry_id),
          ].slice(0, TELEMETRY_LIMIT)
          return {
            data: withPresentation({
              ...data,
              telemetry,
              snapshot_at:
                Date.parse(row.recorded_at) > Date.parse(data.snapshot_at)
                  ? row.recorded_at
                  : data.snapshot_at,
            }),
          }
        }
        case 'device_status': {
          const status = change.data
          if (!status) return state
          return {
            data: {
              ...data,
              devices: data.devices.map((device) =>
                device.device_id === status.device_id
                  ? {
                      ...device,
                      online: status.online,
                      last_heartbeat: status.last_heartbeat,
                      lifecycle_status: status.lifecycle_status,
                    }
                  : device,
              ),
            },
          }
        }
        case 'alert_created': {
          const alert = change.data
          if (!alert) return state
          return {
            data: withPresentation({
              ...data,
              alerts: [
                alert,
                ...data.alerts.filter((item) => item.alert_id !== alert.alert_id),
              ],
            }),
          }
        }
        case 'alert_updated': {
          const alert = change.data
          if (!alert) return state
          return {
            data: withPresentation({
              ...data,
              alerts: data.alerts.map((item) =>
                item.alert_id === alert.alert_id ? alert : item,
              ),
            }),
          }
        }
        case 'command_status': {
          const command = change.data
          if (!command) return state
          const known = data.commands.some((item) => item.command_id === command.command_id)
          const commands = known
            ? data.commands.map((item) =>
                item.command_id === command.command_id ? command : item,
              )
            : [command, ...data.commands]
          const fanMode = fanModeOf(command)
          const configs = fanMode
            ? data.configs.map((config) =>
                config.device_id === command.device_id
                  ? { ...config, fan_mode: fanMode }
                  : config,
              )
            : data.configs
          return { data: withPresentation({ ...data, commands, configs }) }
        }
        case 'device_saved':
          return {
            data: withPresentation({
              ...data,
              devices: upsert(data.devices, change.data, (device) => device.device_id),
            }),
          }
        case 'config_saved':
          return {
            data: withPresentation({
              ...data,
              configs: upsert(data.configs, change.data, (config) => config.device_id),
            }),
          }
        case 'user_saved':
          return {
            data: {
              ...data,
              users: upsert(data.users, change.data, (user) => user.user_id),
            },
          }
      }
    })
  },
  setConnection(connection) {
    set({ connection })
  },
  reset() {
    request++
    set({ data: null, loading: false, error: '', connection: initialConnection })
  },
}))
