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

  it('revives only a decommissioned device and returns a fresh token', async () => {
    await expect(mockApi.reviveDevice(admin, 2)).rejects.toThrow(
      'Chỉ có thể kích hoạt lại thiết bị đã thu hồi.',
    )
    const result = await mockApi.reviveDevice(admin, 5)
    expect(result.device).toMatchObject({
      lifecycle_status: 'ACTIVE',
      online: false,
      last_heartbeat: null,
    })
    expect(result.auth_token).toBe('mock-token-NODE0_TEST-5-revive')
  })

  it('deletes only a decommissioned device and clears its rows', async () => {
    const created = await mockApi.registerDevice(admin, {
      device_name: 'Node xóa thử',
      device_code: 'NODE88_SEC',
      mac_address: '24:6F:28:88:88:88',
      warehouse_id: null,
      assigned_user_id: null,
    })
    const id = created.device.device_id
    await expect(mockApi.deleteDevice(admin, id)).rejects.toThrow(
      'Chỉ có thể xóa thiết bị đã thu hồi.',
    )
    await mockApi.activateDevice(admin, id)
    await mockApi.setLifecycle(admin, id, 'DECOMMISSIONED')
    await expect(mockApi.deleteDevice(admin, id)).resolves.toEqual({
      device_id: id,
      device_code: 'NODE88_SEC',
    })
    const dashboard = await mockApi.dashboard(admin)
    expect(dashboard.devices.some((device) => device.device_id === id)).toBe(false)
    expect(dashboard.configs.some((config) => config.device_id === id)).toBe(false)
  })

  it('signs a new account in with its own password only', async () => {
    await mockApi.createUser(admin, {
      username: 'mat.khau',
      full_name: 'Mật Khẩu',
      email: null,
      role: 'VIEWER',
      password: 'Rieng@12345',
    })
    await expect(mockApi.login('mat.khau', 'Rieng@12345')).resolves.toMatchObject({
      user: { username: 'mat.khau' },
    })
    await expect(mockApi.login('mat.khau', 'demo123')).rejects.toThrow(
      'Sai tên đăng nhập hoặc mật khẩu.',
    )
  })
})
