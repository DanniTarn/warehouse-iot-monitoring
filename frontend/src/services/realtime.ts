import type { Alert, DeviceCommand, LifecycleStatus, Telemetry } from './types'

export interface DeviceStatusEvent {
  device_id: number
  online: boolean
  last_heartbeat: string | null
  lifecycle_status: LifecycleStatus
}

export type RealtimeEvent =
  | { type: 'telemetry'; data: Telemetry | null }
  | { type: 'device_status'; data: DeviceStatusEvent | null }
  | { type: 'alert_created'; data: Alert | null }
  | { type: 'alert_updated'; data: Alert | null }
  | { type: 'command_status'; data: DeviceCommand | null }

export type RealtimeState = 'live' | 'reconnecting'

export interface RealtimeHandlers {
  onEvent: (event: RealtimeEvent) => void
  onState: (state: RealtimeState) => void
}

const baseUrl = import.meta.env.VITE_WS_URL || 'ws://localhost:3000/ws'
const backoff = [1000, 2000, 4000]
const retryAfter = 10000
const eventTypes = [
  'telemetry',
  'device_status',
  'alert_created',
  'alert_updated',
  'command_status',
]

function isEventType(value: unknown): value is RealtimeEvent['type'] {
  return typeof value === 'string' && eventTypes.includes(value)
}

function parseFrame(raw: string): RealtimeEvent | null {
  try {
    const frame = JSON.parse(raw) as { type?: unknown; data?: unknown }
    if (!isEventType(frame.type)) return null
    const data =
      frame.data && typeof frame.data === 'object' && !Array.isArray(frame.data)
        ? frame.data
        : null
    return { type: frame.type, data } as RealtimeEvent
  } catch {
    return null
  }
}

export function connectRealtime(token: string, { onEvent, onState }: RealtimeHandlers) {
  let socket: WebSocket | null = null
  let timer: ReturnType<typeof setTimeout> | undefined
  let closed = false
  let attempt = 0
  function connect() {
    if (closed) return
    const url = new URL(baseUrl)
    url.searchParams.set('token', token)
    socket = new WebSocket(url)
    socket.onopen = () => {
      attempt = 0
      onState('live')
    }
    socket.onmessage = (message) => {
      const event = parseFrame(String(message.data))
      if (event) onEvent(event)
    }
    socket.onclose = () => {
      socket = null
      if (closed) return
      onState('reconnecting')
      if (closed) return
      timer = setTimeout(connect, backoff[attempt] ?? retryAfter)
      attempt += 1
    }
  }
  connect()
  return () => {
    closed = true
    if (timer) clearTimeout(timer)
    socket?.close()
  }
}
