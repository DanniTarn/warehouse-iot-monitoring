import { describe, expect, it } from 'vitest'
import { bucketTelemetry } from './telemetryBuckets'
import type { Telemetry } from './types'

const START = Date.parse('2026-11-09T00:00:00Z')
const MINUTE = 60000
const TEN_MINUTES = { start: START, end: START + 10 * MINUTE }

function reading(offset: number, humidity: number | null): Telemetry {
  return {
    telemetry_id: offset,
    device_id: 1,
    device_code: 'NODE1_ENV',
    temperature: null,
    humidity,
    smoke_gas_level: null,
    door_status: null,
    motion_detected: null,
    recorded_at: new Date(START + offset).toISOString(),
  }
}

describe('bucketTelemetry', () => {
  it('summarises an alternating signal as its average and range', () => {
    const rows = [0, 5000, 10000, 15000].map((offset, index) =>
      reading(offset, index % 2 ? 70 : 60),
    )
    expect(bucketTelemetry(rows, 'humidity', TEN_MINUTES, 10)).toEqual([
      { at: START, avg: 65, min: 60, max: 70 },
    ])
  })

  it('puts the window edges in the first and last buckets and drops rows outside it', () => {
    const rows = [
      reading(-1, 1),
      reading(0, 10),
      reading(MINUTE - 1, 20),
      reading(MINUTE, 30),
      reading(10 * MINUTE, 40),
      reading(10 * MINUTE + 1, 50),
    ]
    expect(bucketTelemetry(rows, 'humidity', TEN_MINUTES, 10)).toEqual([
      { at: START, avg: 15, min: 10, max: 20 },
      { at: START + MINUTE, avg: 30, min: 30, max: 30 },
      { at: START + 9 * MINUTE, avg: 40, min: 40, max: 40 },
    ])
  })

  it('skips buckets with no readings', () => {
    const rows = [reading(0, 60), reading(5 * MINUTE + 1, 70)]
    expect(bucketTelemetry(rows, 'humidity', TEN_MINUTES, 10).map((bucket) => bucket.at)).toEqual([
      START,
      START + 5 * MINUTE,
    ])
    expect(bucketTelemetry([], 'humidity', TEN_MINUTES, 10)).toEqual([])
  })

  it('keeps a single reading, including in a zero-length window', () => {
    const only = { at: START, avg: 66.4, min: 66.4, max: 66.4 }
    expect(bucketTelemetry([reading(0, 66.4)], 'humidity', TEN_MINUTES)).toEqual([only])
    expect(bucketTelemetry([reading(0, 66.4)], 'humidity', { start: START, end: START })).toEqual([
      only,
    ])
  })

  it('ignores missing values instead of counting them as zero', () => {
    const rows = [reading(0, null), reading(1000, 64), reading(2000, null), reading(MINUTE, null)]
    expect(bucketTelemetry(rows, 'humidity', TEN_MINUTES, 10)).toEqual([
      { at: START, avg: 64, min: 64, max: 64 },
    ])
    expect(bucketTelemetry(rows, 'temperature', TEN_MINUTES, 10)).toEqual([])
  })
})
