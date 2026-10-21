const BOM = '\uFEFF'
export function csvCell(value: string | number | boolean | null | undefined) {
  if (value === null || value === undefined) return ''
  const text = String(value)
  return /[",\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text
}
export function toCsv(
  headers: string[],
  rows: (string | number | boolean | null | undefined)[][],
) {
  return (
    BOM +
    [headers, ...rows]
      .map((row) => row.map(csvCell).join(','))
      .join('\r\n')
  )
}
