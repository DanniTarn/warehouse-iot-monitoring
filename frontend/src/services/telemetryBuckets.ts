import type { Telemetry } from './types'

export type SensorField = 'temperature' | 'humidity' | 'smoke_gas_level'
export interface TimeWindow {
  start: number
  end: number
}
export interface Bucket {
  at: number
  avg: number
  min: number
  max: number
}
interface Accumulator {
  sum: number
  count: number
  min: number
  max: number
}

export function bucketTelemetry(
  rows: Telemetry[],
  field: SensorField,
  { start, end }: TimeWindow,
  count = 60,
): Bucket[] {
  const width = (end - start) / count
  const slots: (Accumulator | undefined)[] = Array.from({ length: count }, () => undefined)
  for (const row of rows) {
    const value = row[field]
    const at = Date.parse(row.recorded_at)
    if (value == null || at < start || at > end) continue
    const index = width > 0 ? Math.min(count - 1, Math.floor((at - start) / width)) : 0
    const slot = slots[index]
    if (slot) {
      slot.sum += value
      slot.count += 1
      slot.min = Math.min(slot.min, value)
      slot.max = Math.max(slot.max, value)
    } else {
      slots[index] = { sum: value, count: 1, min: value, max: value }
    }
  }
  return slots.flatMap((slot, index) =>
    slot
      ? [{ at: start + index * width, avg: slot.sum / slot.count, min: slot.min, max: slot.max }]
      : [],
  )
}
