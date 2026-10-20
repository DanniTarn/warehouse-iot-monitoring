import { useMemo } from 'react'
import { api } from '../services/api'
import type {
  ConfigPatch,
  ManualCommandType,
  NewDevice,
  NewUser,
  Role,
} from '../services/types'
import { useAuth } from './auth'
import { useDashboard } from './dashboard'

export function useActions() {
  const token = useAuth((state) => state.token)
  const applyEvent = useDashboard((state) => state.applyEvent)
  return useMemo(() => {
    function session() {
      if (!token) throw new Error('Phiên đăng nhập đã hết hạn.')
      return token
    }
    return {
      async acknowledgeAlert(alertId: number) {
        const alert = await api.acknowledgeAlert(session(), alertId)
        applyEvent({ type: 'alert_updated', data: alert })
        return alert
      },
      async sendCommand(deviceId: number, type: ManualCommandType) {
        const command = await api.sendCommand(session(), deviceId, type)
        applyEvent({ type: 'command_status', data: command })
        return command
      },
      async registerDevice(input: NewDevice) {
        const result = await api.registerDevice(session(), input)
        applyEvent({ type: 'device_saved', data: result.device })
        applyEvent({ type: 'config_saved', data: result.config })
        return result
      },
      async activateDevice(deviceId: number) {
        const device = await api.activateDevice(session(), deviceId)
        applyEvent({ type: 'device_saved', data: device })
        return device
      },
      async setLifecycle(
        deviceId: number,
        status: 'ACTIVE' | 'MAINTENANCE' | 'DECOMMISSIONED',
      ) {
        const device = await api.setLifecycle(session(), deviceId, status)
        applyEvent({ type: 'device_saved', data: device })
        return device
      },
      rotateDeviceToken(deviceId: number) {
        return api.rotateDeviceToken(session(), deviceId)
      },
      async updateConfig(deviceId: number, patch: ConfigPatch) {
        const config = await api.updateConfig(session(), deviceId, patch)
        applyEvent({ type: 'config_saved', data: config })
        return config
      },
      async createUser(input: NewUser) {
        const user = await api.createUser(session(), input)
        applyEvent({ type: 'user_saved', data: user })
        return user
      },
      async updateUser(
        userId: number,
        patch: { role?: Role; is_active?: boolean },
      ) {
        const user = await api.updateUser(session(), userId, patch)
        applyEvent({ type: 'user_saved', data: user })
        return user
      },
    }
  }, [token, applyEvent])
}
