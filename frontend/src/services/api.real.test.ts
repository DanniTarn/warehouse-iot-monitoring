import { afterEach, describe, expect, it, vi } from 'vitest'
import { realApi } from './api.real'

function page(count: number, offset: number) {
  return Array.from({ length: count }, (_, index) => ({ telemetry_id: offset + index + 1 }))
}

function stubFetch(pages: unknown[][]) {
  const urls: string[] = []
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string) => {
      urls.push(url)
      const body = pages[urls.length - 1] ?? []
      return new Response(JSON.stringify(body), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    }),
  )
  return urls
}

describe('realApi.history', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('reads the whole selected telemetry range, not one page', async () => {
    const urls = stubFetch([page(500, 0), page(500, 500), page(120, 1000)])
    const result = await realApi.history('token', {
      tab: 'telemetry',
      from: '2026-11-01',
      to: '2026-11-09',
      deviceId: 1,
    })
    expect(result.tab).toBe('telemetry')
    expect(result.rows).toHaveLength(1120)
    expect(urls).toHaveLength(3)
    expect(urls[0]).toContain('/telemetry?')
    expect(urls[0]).toContain('from=2026-11-01')
    expect(urls[0]).toContain('to=2026-11-09')
    expect(urls[0]).toContain('device_id=1')
    expect(urls[2]).toContain('offset=1000')
  })

  it('stops at the first short telemetry page', async () => {
    const urls = stubFetch([page(500, 0), page(37, 500)])
    const result = await realApi.history('token', {
      tab: 'telemetry',
      from: '2026-11-08',
      to: '2026-11-08',
    })
    expect(result.rows).toHaveLength(537)
    expect(urls).toHaveLength(2)
  })

  it('asks for the date range when reading command history', async () => {
    const urls = stubFetch([[]])
    const result = await realApi.history('token', {
      tab: 'commands',
      from: '2026-11-01',
      to: '2026-11-09',
    })
    expect(result.tab).toBe('commands')
    expect(urls[0]).toContain('/commands?')
    expect(urls[0]).toContain('from=2026-11-01')
    expect(urls[0]).toContain('to=2026-11-09')
  })
})
