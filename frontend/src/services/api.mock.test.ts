import { describe, expect, it } from 'vitest'
import { mockApi } from './api.mock'

const admin = 'mock-session-admin'

describe('mock API mirrors backend validation', () => {
  it('reports a device moved to maintenance as offline', async () => {
    const device = await mockApi.setLifecycle(admin, 1, 'MAINTENANCE')
    expect(device.online).toBe(false)
  })

  it('rejects an out-of-range humidity threshold', async () => {
    await expect(mockApi.updateConfig(admin, 2, { humidity_threshold: 150 })).rejects.toThrow(
      'Ngưỡng độ ẩm không hợp lệ.',
    )
  })

  it('rejects a fractional telemetry interval', async () => {
    await expect(mockApi.updateConfig(admin, 2, { telemetry_interval: 2.5 })).rejects.toThrow()
  })

  it('rejects a duplicate MAC address', async () => {
    await expect(
      mockApi.registerDevice(admin, {
        device_name: 'Trùng MAC',
        device_code: 'NODE77_SEC',
        mac_address: '24:6f:28:a1:3c:90',
        warehouse_id: null,
        assigned_user_id: null,
      }),
    ).rejects.toThrow('Dữ liệu đã tồn tại.')
  })

  it('rejects BUZZER_ON as a manual command', async () => {
    await expect(
      mockApi.sendCommand(admin, 2, 'BUZZER_ON' as Parameters<typeof mockApi.sendCommand>[2]),
    ).rejects.toThrow('Loại lệnh không hợp lệ.')
  })
})
