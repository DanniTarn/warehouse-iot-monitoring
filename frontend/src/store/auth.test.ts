import { beforeEach, describe, expect, it } from 'vitest'
import { useAuth } from './auth'
import { api } from '../services/api'
beforeEach(() => {
  sessionStorage.clear()
  useAuth.setState({ user: null, token: null, ready: false })
})
describe('AC-3: demonstration sessions', () => {
  it('survives initialization after a refresh and clears on logout', async () => {
    await useAuth.getState().login('operator01', 'demo123')
    useAuth.setState({ user: null, token: null, ready: false })
    await useAuth.getState().initialize()
    expect(useAuth.getState().user?.role).toBe('OPERATOR')
    useAuth.getState().logout()
    expect(sessionStorage.getItem('warehouse.session')).toBeNull()
    expect(useAuth.getState().user).toBeNull()
  })
  it('discards an invalid stored session', async () => {
    sessionStorage.setItem('warehouse.session', 'invalid')
    await useAuth.getState().initialize()
    expect(useAuth.getState().user).toBeNull()
    expect(useAuth.getState().ready).toBe(true)
    expect(sessionStorage.getItem('warehouse.session')).toBeNull()
  })
  it.each([
    ['admin', 'wrong'],
    ['missing', 'demo123'],
    ['test01', 'demo123'],
  ])(
    'rejects invalid or locked login %s without disclosing its cause',
    async (username, password) => {
      await expect(api.login(username, password)).rejects.toThrow(
        'Sai tên đăng nhập hoặc mật khẩu.',
      )
      expect(useAuth.getState().user).toBeNull()
    },
  )
  it('does not give a viewer user management or audit fixtures', async () => {
    const { token } = await api.login('viewer01', 'demo123')
    const data = await api.dashboard(token)
    expect(data.users).toEqual([])
    expect(data.audit).toEqual([])
    expect(data.devices).toHaveLength(5)
  })
})
