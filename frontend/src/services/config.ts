import type { Device, LifecycleStatus } from './types'

// Defaults pending team confirmation, handoff section 11.
export const MONITORING = {
  environmentCode: 'NODE1_ENV',
  securityCode: 'NODE2_SEC',
  smoke: { unit: 'ppm', domain: [0, 400] as [number, number], threshold: 300 },
  humidityThreshold: 65,
  offlineTimeoutSeconds: 90,
}
export const LIFECYCLES: Record<LifecycleStatus, string> = {
  REGISTERED: 'Đã đăng ký, chờ kích hoạt',
  ACTIVE: 'Đang hoạt động',
  OFFLINE: 'Mất kết nối hoặc lỗi',
  MAINTENANCE: 'Đang bảo trì',
  DECOMMISSIONED: 'Đã thu hồi, bị chặn kết nối',
}
export function getDeviceKind(device: Device) {
  if (device.device_code.endsWith('_ENV')) return 'environment'
  if (device.device_code.endsWith('_SEC')) return 'security'
  return 'unknown'
}
