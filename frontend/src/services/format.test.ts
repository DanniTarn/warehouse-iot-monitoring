import { describe, expect, it } from 'vitest'
import { dateTime, heartbeat, number } from './format'
import { getDeviceKind } from './config'
import type { Device } from './types'

describe('AC-5: Vietnamese formatting and hardware naming', () => {
  it('uses a decimal comma and preserves zero and missing readings', () => {
    expect(number(28.4)).toBe('28,4')
    expect(number(0)).toBe('0,0')
    expect(number(null)).toBe('—')
  })
  it('formats timestamps in Vietnam even when the input is UTC', () => {
    expect(dateTime('2026-10-13T14:42:08Z', true)).toContain('21:42:08')
    expect(dateTime('2026-10-13T18:00:00Z')).toContain('14/10/2026')
  })
  it.each([
    [0, '0 giây'],
    [59000, '59 giây'],
    [60000, '1 phút'],
    [3599000, '59 phút'],
    [3600000, '1 giờ'],
  ])('handles heartbeat age %i', (age, expected) => {
    const now = new Date('2026-10-14T10:00:00Z').getTime()
    expect(heartbeat(new Date(now - age).toISOString(), now)).toBe(`Heartbeat ${expected} trước`)
  })
  it('handles no heartbeat and future clock drift', () => {
    expect(heartbeat(null)).toBe('Chưa có heartbeat')
    expect(heartbeat('2026-10-14T10:00:01Z', new Date('2026-10-14T10:00:00Z').getTime())).toBe(
      'Heartbeat 0 giây trước',
    )
  })
  it.each([
    ['NODE1_ENV', 'environment'],
    ['NODE2_SEC', 'security'],
    ['NODE0_TEST', 'unknown'],
  ])('derives %s by suffix only', (code, kind) => {
    expect(getDeviceKind({ device_code: code } as Device)).toBe(kind)
  })
})
