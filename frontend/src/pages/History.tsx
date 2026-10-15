import { useState } from 'react'
import { Link, Navigate, useSearchParams } from 'react-router-dom'
import { useAuth } from '../store/auth'
import { useDashboard } from '../store/dashboard'
import { dateTime, number } from '../services/format'
import { MONITORING } from '../services/config'
import {
  Button,
  DeferredButton,
  EmptyRow,
  Field,
  Notice,
  PageHeader,
  Table,
} from '../components/common/UI'
import { CommandTable } from '../components/common/CommandTable'
import ui from '../components/common/UI.module.css'
import styles from './Pages.module.css'
export default function History() {
  const data = useDashboard((s) => s.data)!
  const admin = useAuth((s) => s.user?.role === 'ADMIN')
  const [params] = useSearchParams()
  const tab = params.get('tab') || 'telemetry'
  const [device, setDevice] = useState('')
  const [from, setFrom] = useState('2026-10-07')
  const [to, setTo] = useState('2026-10-13')
  const [page, setPage] = useState(0)
  if (!['telemetry', 'commands', 'audit'].includes(tab) || (tab === 'audit' && !admin))
    return <Navigate to="/history?tab=telemetry" replace />
  const invalid = !!from && !!to && from > to
  function inRange(timestamp: string) {
    const instant = new Date(timestamp).getTime()
    return (
      !invalid &&
      (!from || instant >= new Date(`${from}T00:00:00+07:00`).getTime()) &&
      (!to || instant <= new Date(`${to}T23:59:59.999+07:00`).getTime())
    )
  }
  const telemetry = data.telemetry.filter(
    (r) => (!device || device === String(r.device_id)) && inRange(r.recorded_at),
  )
  const commands = data.commands.filter(
    (r) => (!device || device === String(r.device_id)) && inRange(r.sent_at),
  )
  const audit = data.audit.filter((r) => inRange(r.created_at))
  const total =
    tab === 'telemetry' ? telemetry.length : tab === 'commands' ? commands.length : audit.length
  const current = Math.min(page, Math.max(0, Math.ceil(total / 50) - 1))
  const slice = <T,>(rows: T[]) => rows.slice(current * 50, (current + 1) * 50)
  const tabs = [
    ['telemetry', 'Dữ liệu cảm biến'],
    ['commands', 'Lệnh điều khiển'],
    ...(admin ? [['audit', 'Nhật ký thao tác']] : []),
  ]
  return (
    <>
      <PageHeader title="Lịch sử" subtitle="Dữ liệu cảm biến, lệnh điều khiển và nhật ký thao tác">
        <DeferredButton>Xuất CSV</DeferredButton>
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
