import { create } from 'zustand'
import { api, dataSource, type DashboardData } from '../services/api'
import { derivePresentation } from '../services/dashboardView'
import type { RealtimeEvent, RealtimeState } from '../services/realtime'

const TELEMETRY_LIMIT = 1500
const initialConnection: RealtimeState = dataSource === 'api' ? 'reconnecting' : 'live'

interface DashboardState {
  data: DashboardData | null
  loading: boolean
  error: string
  connection: RealtimeState
  load: (token: string) => Promise<void>
  applyEvent: (event: RealtimeEvent) => void
  setConnection: (connection: RealtimeState) => void
  reset: () => void
}

function withPresentation(data: DashboardData): DashboardData {
  return { ...data, presentation: derivePresentation(data) }
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
  applyEvent(event) {
    set((state) => {
      const data = state.data
      if (!data) return state
      switch (event.type) {
        case 'telemetry': {
          const row = event.data
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
          const status = event.data
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
          const alert = event.data
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
          const alert = event.data
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
          const command = event.data
          if (!command) return state
          const known = data.commands.some((item) => item.command_id === command.command_id)
          return {
            data: withPresentation({
              ...data,
              commands: known
                ? data.commands.map((item) =>
                    item.command_id === command.command_id ? command : item,
                  )
                : [command, ...data.commands],
            }),
          }
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
