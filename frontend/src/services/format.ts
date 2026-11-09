export const TIME_ZONE = 'Asia/Ho_Chi_Minh'
export function number(value: number | null | undefined, digits = 1) {
  return value == null
    ? '—'
    : new Intl.NumberFormat('vi-VN', {
        minimumFractionDigits: digits,
        maximumFractionDigits: digits,
      }).format(value)
}
export function dateTime(value: string | null, seconds = false) {
  if (!value) return '—'
  return new Intl.DateTimeFormat('vi-VN', {
    timeZone: TIME_ZONE,
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    ...(seconds ? { second: '2-digit' } : {}),
    hour12: false,
  }).format(new Date(value))
}
export function time(value: string | number) {
  return new Intl.DateTimeFormat('vi-VN', {
    timeZone: TIME_ZONE,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(new Date(value))
}
export function heartbeat(value: string | null, now = Date.now()) {
  if (!value) return 'Chưa có heartbeat'
  const seconds = Math.max(0, Math.floor((now - new Date(value).getTime()) / 1000))
  if (seconds < 60) return `Heartbeat ${seconds} giây trước`
  if (seconds < 3600) return `Heartbeat ${Math.floor(seconds / 60)} phút trước`
  return `Heartbeat ${Math.floor(seconds / 3600)} giờ trước`
}

export function isNight(
  startHour: number,
  startMinute: number,
  endHour: number,
  endMinute: number,
  timezone: string,
  now = new Date(),
) {
  const parts = new Intl.DateTimeFormat('en-GB', {
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
    timeZone: timezone,
  }).formatToParts(now)
  const value = (type: string) => Number(parts.find((part) => part.type === type)?.value ?? 0)
  const current = value('hour') * 60 + value('minute')
  const start = startHour * 60 + startMinute
  const end = endHour * 60 + endMinute
  return start === end || (start > end ? current >= start || current < end : current >= start && current < end)
}
