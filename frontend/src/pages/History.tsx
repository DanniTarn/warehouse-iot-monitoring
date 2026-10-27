import { useEffect, useState } from 'react'
import { Link, Navigate, useSearchParams } from 'react-router-dom'
import { useAuth } from '../store/auth'
import { useDashboard } from '../store/dashboard'
import { api, type HistoryRows } from '../services/api'
import { dateTime, number, TIME_ZONE } from '../services/format'
import { MONITORING } from '../services/config'
import { toCsv } from '../services/csv'
import { Button, EmptyRow, Field, Notice, PageHeader, Table } from '../components/common/UI'
import { CommandTable } from '../components/common/CommandTable'
import ui from '../components/common/UI.module.css'
import styles from './Pages.module.css'
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
  const current = Math.min(page, Math.max(0, Math.ceil(total / 50) - 1))
  const slice = <T,>(items: T[]) => items.slice(current * 50, (current + 1) * 50)
  const cap = tab === 'telemetry' ? 5000 : 500
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
    <>
      <PageHeader title="Lịch sử" subtitle="Dữ liệu cảm biến, lệnh điều khiển và nhật ký thao tác">
        <Button onClick={exportCsv} disabled={loading || !total}>
          Xuất CSV
        </Button>
      </PageHeader>
      <nav className={ui.tabs} aria-label="Loại lịch sử">
        {tabs.map(([key, title]) => (
          <Link
            key={key}
            to={`/history?tab=${key}`}
            aria-current={tab === key ? 'page' : undefined}
            onClick={() => setPage(0)}
          >
            {title}
          </Link>
        ))}
      </nav>
      <div className={styles.toolbar}>
        {tab !== 'audit' && (
          <Field id="history-device" label="Thiết bị">
            <select
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
            </select>
          </Field>
        )}
        <Field id="from" label="Từ ngày">
          <input
            type="date"
            id="from"
            value={from}
            onChange={(e) => {
              setFrom(e.target.value)
              setPage(0)
            }}
          />
        </Field>
        <Field id="to" label="Đến ngày">
          <input
            type="date"
            id="to"
            value={to}
            onChange={(e) => {
              setTo(e.target.value)
              setPage(0)
            }}
          />
        </Field>
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
        <Table
          label="Dữ liệu cảm biến"
          headers={[
            'Thời gian',
            'Thiết bị',
            'Nhiệt độ (°C)',
            'Độ ẩm (%)',
            `Khói (${MONITORING.smoke.unit})`,
            'Cửa',
            'Chuyển động',
          ]}
        >
          {slice(telemetry).map((r) => (
            <tr key={r.telemetry_id}>
              <td className="mono">{dateTime(r.recorded_at, true)}</td>
              <td className="mono">{r.device_code}</td>
              <td className="mono" data-numeric>
                {number(r.temperature)}
              </td>
              <td
                className={`mono ${(r.humidity ?? 0) > MONITORING.humidityThreshold ? 'warning' : ''}`}
                data-numeric
              >
                {number(r.humidity)}
              </td>
              <td className="mono" data-numeric>
                {number(r.smoke_gas_level, 0)}
              </td>
              <td className={r.door_status ? 'critical' : ''}>
                {r.door_status === null ? '—' : r.door_status ? 'Mở' : 'Đóng'}
              </td>
              <td>{r.motion_detected === null ? '—' : r.motion_detected ? 'Có' : 'Không'}</td>
            </tr>
          ))}
          {!telemetry.length && <EmptyRow columns={7} />}
        </Table>
      )}
      {tab === 'commands' && <CommandTable commands={slice(commands)} />}
      {tab === 'audit' && (
        <Table
          label="Nhật ký thao tác"
          headers={['Thời gian', 'Người dùng', 'Hành động', 'IP', 'Chi tiết']}
        >
          {slice(audit).map((r) => (
            <tr key={r.log_id}>
              <td className="mono">{dateTime(r.created_at, true)}</td>
              <td>{r.username}</td>
              <td className="mono">{r.action}</td>
              <td className="mono">{r.ip_client}</td>
              <td className={r.details?.includes('(403)') ? 'critical' : ''}>{r.details}</td>
            </tr>
          ))}
          {!audit.length && <EmptyRow columns={5} />}
        </Table>
      )}
      <div className="row between">
        <span className="small secondary">
          Hiển thị {total ? current * 50 + 1 : 0}–{Math.min((current + 1) * 50, total)} / {total}{' '}
          bản ghi
        </span>
        <div className="row">
          <Button disabled={!current} onClick={() => setPage(current - 1)}>
            Mới hơn
          </Button>
          <Button disabled={(current + 1) * 50 >= total} onClick={() => setPage(current + 1)}>
            Cũ hơn
          </Button>
        </div>
      </div>
    </>
  )
}
