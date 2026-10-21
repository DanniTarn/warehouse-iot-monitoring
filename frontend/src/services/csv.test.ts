import { describe, expect, it } from 'vitest'
import { csvCell, toCsv } from './csv'

describe('csv serialization', () => {
  it('quotes commas, quotes and line breaks per RFC 4180', () => {
    expect(csvCell('a,b')).toBe('"a,b"')
    expect(csvCell('say "hi"')).toBe('"say ""hi"""')
    expect(csvCell('line\nbreak')).toBe('"line\nbreak"')
    expect(csvCell('line\r\nbreak')).toBe('"line\r\nbreak"')
    expect(csvCell('plain')).toBe('plain')
    expect(csvCell(null)).toBe('')
  })

  it('writes a UTF-8 BOM, the header and CRLF rows', () => {
    const csv = toCsv(
      ['Thời gian', 'Thiết bị'],
      [
        ['08/11/2026 10:00:00', 'NODE1_ENV'],
        ['08/11/2026 10:00:05', 'NODE2_SEC, cửa mở'],
      ],
    )
    expect(csv).toBe(
      '\uFEFFThời gian,Thiết bị\r\n08/11/2026 10:00:00,NODE1_ENV\r\n08/11/2026 10:00:05,"NODE2_SEC, cửa mở"',
    )
  })
})
