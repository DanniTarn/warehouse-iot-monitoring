import { Fragment, useEffect, useState } from 'react'
import { Link, Navigate, useSearchParams } from 'react-router-dom'
import { Download } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { PageHeader } from '@/components/app/page-header'
import { Notice } from '@/components/app/kit'
import { NativeSelect } from '@/components/app/native-select'
import { Pagination } from '@/components/app/pagination'
import { CommandTable } from '@/components/common/CommandTable'
import { api, type HistoryRows } from '@/services/api'
import { dateTime, number, TIME_ZONE } from '@/services/format'
import { getDeviceKind, MONITORING } from '@/services/config'
import type { Telemetry } from '@/services/types'
import { toCsv } from '@/services/csv'
import { useAuth } from '@/store/auth'
import { useDashboard } from '@/store/dashboard'
import { cn } from '@/lib/utils'

type ReadingKey = 'temperature' | 'humidity' | 'smoke' | 'door' | 'motion'

interface Reading {
  header: string
  numeric: boolean
  cell: (row: Telemetry) => string
  inline: (row: Telemetry) => string | null
  highlight: (row: Telemetry) => '' | 'warning' | 'critical'
}

const READINGS: Record<ReadingKey, Reading> = {
  temperature: {
    header: 'Nhiệt độ (°C)',
    numeric: true,
    cell: (row) => number(row.temperature),
    inline: (row) => (row.temperature === null ? null : `${number(row.temperature)} °C`),
    highlight: () => '',
  },
  humidity: {
    header: 'Độ ẩm (%)',
    numeric: true,
    cell: (row) => number(row.humidity),
    inline: (row) => (row.humidity === null ? null : `${number(row.humidity)} %`),
    highlight: (row) => ((row.humidity ?? 0) > MONITORING.humidityThreshold ? 'warning' : ''),
  },
  smoke: {
    header: `Khói (${MONITORING.smoke.unit})`,
    numeric: true,
    cell: (row) => number(row.smoke_gas_level, 0),
    inline: (row) =>
      row.smoke_gas_level === null
        ? null
        : `${number(row.smoke_gas_level, 0)} ${MONITORING.smoke.unit}`,
    highlight: () => '',
  },
  door: {
    header: 'Cửa',
    numeric: false,
    cell: (row) => (row.door_status === null ? '—' : row.door_status ? 'Mở' : 'Đóng'),
    inline: (row) => (row.door_status === null ? null : row.door_status ? 'Cửa mở' : 'Cửa đóng'),
    highlight: (row) => (row.door_status ? 'critical' : ''),
  },
  motion: {
    header: 'Chuyển động',
    numeric: false,
    cell: (row) => (row.motion_detected === null ? '—' : row.motion_detected ? 'Có' : 'Không'),
    inline: (row) =>
      row.motion_detected === null
        ? null
        : row.motion_detected
          ? 'Có chuyển động'
          : 'Không chuyển động',
    highlight: () => '',
  },
}

const ALL_READINGS = Object.keys(READINGS) as ReadingKey[]

const KIND_READINGS: Record<ReturnType<typeof getDeviceKind>, ReadingKey[]> = {
  environment: ['temperature', 'humidity', 'smoke'],
  security: ['door', 'motion'],
  unknown: ALL_READINGS,
}

const cellClass = (level: '' | 'warning' | 'critical') =>
  cn(
    'font-mono text-xs',
    level === 'warning' && 'text-amber-700',
    level === 'critical' && 'text-red-700',
  )

function ReadingSummary({ row }: { row: Telemetry }) {
  const present = ALL_READINGS.flatMap((key) => {
    const text = READINGS[key].inline(row)
    return text === null ? [] : [{ key, text }]
  })
  if (!present.length) return '—'
  return present.map(({ key, text }, index) => (
    <Fragment key={key}>
      {index > 0 && ' · '}
      <span className={cn(READINGS[key].highlight(row), cellClass(READINGS[key].highlight(row)))}>{text}</span>
    </Fragment>
  ))
}

function todayInVietnam() {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date())
  const value = (type: string) => parts.find((part) => part.type === type)?.value
  return `${value('year')}-${value('month')}-${value('day')}`
}

export default function History() {
  const data = useDashboard((s) => s.data)!
  const token = useAuth((s) => s.token)
  const admin = useAuth((s) => s.user?.role === 'ADMIN')
  const [params] = useSearchParams()
  const tab = params.get('tab') || 'telemetry'
  const [device, setDevice] = useState(() => {
    const requested = params.get('device') ?? ''
    return data.devices.some((item) => String(item.device_id) === requested) ? requested : ''
  })
  const [from, setFrom] = useState(todayInVietnam)
  const [to, setTo] = useState(todayInVietnam)
  const [page, setPage] = useState(0)
  const [size, setSize] = useState(50)
  const [rows, setRows] = useState<HistoryRows | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const invalid = !!from && !!to && from > to
  const allowed = ['telemetry', 'commands', 'audit'].includes(tab) && (tab !== 'audit' || admin)

  useEffect(() => {
    if (!token || !allowed || invalid) {
      setRows(null)
      setLoading(false)
      return
    }
    let active = true
    setLoading(true)
    setError('')
    api
      .history(token, {
        tab: tab as 'telemetry' | 'commands' | 'audit',
        from,
        to,
        deviceId: device ? Number(device) : undefined,
      })
      .then((result) => {
        if (active) {
          setRows(result)
          setLoading(false)
        }
      })
      .catch((reason: unknown) => {
        if (active) {
          setRows(null)
          setError(reason instanceof Error ? reason.message : 'Không tải được lịch sử.')
          setLoading(false)
        }
      })
    return () => {
      active = false
    }
  }, [token, allowed, invalid, tab, from, to, device])

  if (!allowed) return <Navigate to="/history?tab=telemetry" replace />

  const telemetry = rows?.tab === 'telemetry' ? rows.rows : []
  const commands = rows?.tab === 'commands' ? rows.rows : []
  const audit = rows?.tab === 'audit' ? rows.rows : []
  const total =
    tab === 'telemetry' ? telemetry.length : tab === 'commands' ? commands.length : audit.length
  const current = Math.min(page, Math.max(0, Math.ceil(total / size) - 1))
  const slice = <T,>(items: T[]) => items.slice(current * size, (current + 1) * size)
  const cap = tab === 'telemetry' ? 5000 : 500
  const selected = data.devices.find((item) => String(item.device_id) === device)
  const columns = selected ? KIND_READINGS[getDeviceKind(selected)] : null
  const tabs = [
    ['telemetry', 'Dữ liệu cảm biến'],
    ['commands', 'Lệnh điều khiển'],
    ...(admin ? [['audit', 'Nhật ký thao tác']] : []),
  ]

  function exportCsv() {
    const name =
      tab === 'telemetry'
        ? 'du-lieu-cam-bien'
        : tab === 'commands'
          ? 'lenh-dieu-khien'
          : 'nhat-ky-thao-tac'
    const headers =
      tab === 'telemetry'
        ? [
            'Thời gian',
            'Thiết bị',
            'Nhiệt độ (°C)',
            'Độ ẩm (%)',
            `Khói (${MONITORING.smoke.unit})`,
            'Cửa',
            'Chuyển động',
          ]
        : tab === 'commands'
          ? ['Thời gian gửi', 'Thiết bị', 'Lệnh', 'Người gửi', 'Trạng thái', 'Phản hồi']
          : ['Thời gian', 'Người dùng', 'Hành động', 'IP', 'Chi tiết']
    const rowsToWrite =
      tab === 'telemetry'
        ? telemetry.map((row) => [
            dateTime(row.recorded_at, true),
            row.device_code,
            row.temperature,
            row.humidity,
            row.smoke_gas_level,
            row.door_status === null ? '' : row.door_status ? 'Mở' : 'Đóng',
            row.motion_detected === null ? '' : row.motion_detected ? 'Có' : 'Không',
          ])
        : tab === 'commands'
          ? commands.map((row) => [
              dateTime(row.sent_at, true),
              row.device_code,
              row.command_type,
              row.username,
              row.status,
              dateTime(row.acknowledged_at, true),
            ])
          : audit.map((row) => [
              dateTime(row.created_at, true),
              row.username,
              row.action,
              row.ip_client,
              row.details,
            ])
    const blob = new Blob([toCsv(headers, rowsToWrite)], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `${name}-${todayInVietnam()}.csv`
    link.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="space-y-4">
      <PageHeader
        title="Lịch sử"
        subtitle="Dữ liệu cảm biến, lệnh điều khiển và nhật ký thao tác"
        actions={
          <Button variant="outline" onClick={exportCsv} disabled={loading || !total}>
            <Download className="size-4" />
            Xuất CSV
          </Button>
        }
      />

      <nav
        className="flex flex-wrap gap-1 rounded-lg border bg-muted/40 p-1"
        aria-label="Loại lịch sử"
      >
        {tabs.map(([key, title]) => (
          <Link
            key={key}
            to={`/history?tab=${key}`}
            aria-current={tab === key ? 'page' : undefined}
            onClick={() => setPage(0)}
            className={cn(
              'rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
              tab === key
                ? 'bg-card text-foreground shadow-xs'
                : 'text-muted-foreground hover:text-foreground',
            )}
          >
            {title}
          </Link>
        ))}
      </nav>

      <div className="grid gap-3 rounded-xl border bg-card p-3 sm:grid-cols-2 lg:grid-cols-4">
        {tab !== 'audit' && (
          <div className="space-y-1.5">
            <Label htmlFor="history-device">Thiết bị</Label>
            <NativeSelect
              id="history-device"
              value={device}
              onChange={(e) => {
                setDevice(e.target.value)
                setPage(0)
              }}
            >
              <option value="">Tất cả thiết bị</option>
              {data.devices.map((d) => (
                <option key={d.device_id} value={d.device_id}>
                  {d.device_code}
                </option>
              ))}
            </NativeSelect>
          </div>
        )}
        <div className="space-y-1.5">
          <Label htmlFor="from">Từ ngày</Label>
          <Input
            type="date"
            id="from"
            value={from}
            onChange={(e) => {
              setFrom(e.target.value)
              setPage(0)
            }}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="to">Đến ngày</Label>
          <Input
            type="date"
            id="to"
            value={to}
            onChange={(e) => {
              setTo(e.target.value)
              setPage(0)
            }}
          />
        </div>
      </div>

      {invalid && <Notice error>Từ ngày phải trước hoặc bằng Đến ngày.</Notice>}
      {error && <Notice error>{error}</Notice>}
      {loading && <Notice>Đang tải lịch sử…</Notice>}
      {!loading && total === cap && (
        <Notice>
          Đã đạt giới hạn {cap} bản ghi. Thu hẹp khoảng ngày hoặc chọn một thiết bị để xem phần còn
          lại.
        </Notice>
      )}

      {tab === 'telemetry' && (
        <section aria-label="Dữ liệu cảm biến" className="overflow-x-auto rounded-xl border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Thời gian</TableHead>
                <TableHead>Thiết bị</TableHead>
                {columns ? (
                  columns.map((key) => (
                    <TableHead key={key} className={READINGS[key].numeric ? 'text-right' : ''}>
                      {READINGS[key].header}
                    </TableHead>
                  ))
                ) : (
                  <TableHead>Giá trị</TableHead>
                )}
              </TableRow>
            </TableHeader>
            <TableBody>
              {slice(telemetry).map((row) => (
                <TableRow key={row.telemetry_id}>
                  <TableCell className="font-mono text-xs">
                    {dateTime(row.recorded_at, true)}
                  </TableCell>
                  <TableCell className="font-mono text-xs">{row.device_code}</TableCell>
                  {columns ? (
                    columns.map((key) => (
                      <TableCell
                        key={key}
                        data-numeric={READINGS[key].numeric || undefined}
                        className={cn(
                          cellClass(READINGS[key].highlight(row)),
                          READINGS[key].numeric && 'text-right',
                        )}
                      >
                        {READINGS[key].cell(row)}
                      </TableCell>
                    ))
                  ) : (
                    <TableCell>
                      <ReadingSummary row={row} />
                    </TableCell>
                  )}
                </TableRow>
              ))}
            </TableBody>
          </Table>
          {!telemetry.length && (
            <p className="px-4 py-12 text-center text-sm text-muted-foreground">
              Không có dữ liệu trong khoảng đã chọn.
            </p>
          )}
        </section>
      )}

      {tab === 'commands' && (
        <section aria-label="Lệnh điều khiển">
          <CommandTable commands={slice(commands)} />
        </section>
      )}

      {tab === 'audit' && (
        <section aria-label="Nhật ký thao tác" className="overflow-x-auto rounded-xl border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Thời gian</TableHead>
                <TableHead>Người dùng</TableHead>
                <TableHead>Hành động</TableHead>
                <TableHead>IP</TableHead>
                <TableHead>Chi tiết</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {slice(audit).map((row) => (
                <TableRow key={row.log_id}>
                  <TableCell className="font-mono text-xs">
                    {dateTime(row.created_at, true)}
                  </TableCell>
                  <TableCell>{row.username}</TableCell>
                  <TableCell className="font-mono text-xs">{row.action}</TableCell>
                  <TableCell className="font-mono text-xs">{row.ip_client}</TableCell>
                  <TableCell className={row.details?.includes('(403)') ? 'text-red-700' : ''}>
                    {row.details}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          {!audit.length && (
            <p className="px-4 py-12 text-center text-sm text-muted-foreground">
              Không có bản ghi trong khoảng đã chọn.
            </p>
          )}
        </section>
      )}

      <Pagination
        page={current}
        pageSize={size}
        total={total}
        onPageChange={(next) => {
          setPage(next)
          window.scrollTo({ top: 0, behavior: 'smooth' })
        }}
        onPageSizeChange={(next) => {
          setSize(next)
          setPage(0)
        }}
      />
    </div>
  )
}
