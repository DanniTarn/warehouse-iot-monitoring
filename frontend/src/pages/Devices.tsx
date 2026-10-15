import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../store/auth'
import { useDashboard } from '../store/dashboard'
import { LIFECYCLES } from '../services/config'
import type { LifecycleStatus } from '../services/types'
import {
  ActionLink,
  Badge,
  Connection,
  DeferredButton,
  EmptyRow,
  Field,
  Heartbeat,
  PageHeader,
  Table,
} from '../components/common/UI'
import styles from './Pages.module.css'
export default function Devices() {
  const data = useDashboard((s) => s.data)!
  const admin = useAuth((s) => s.user?.role === 'ADMIN')
  const [query, setQuery] = useState('')
  const [lifecycle, setLifecycle] = useState<LifecycleStatus | ''>('')
  const [warehouse, setWarehouse] = useState('')
  const rows = data.devices.filter(
    (d) =>
      (!lifecycle || lifecycle === d.lifecycle_status) &&
      (!warehouse || String(d.warehouse_id) === warehouse) &&
      `${d.device_name} ${d.device_code} ${d.mac_address}`
        .toLocaleLowerCase('vi')
        .includes(query.trim().toLocaleLowerCase('vi')),
  )
  return (
    <>
      <PageHeader
        title="Thiết bị"
        subtitle={`${data.devices.length} thiết bị · ${data.devices.filter((d) => d.online).length} đang online`}
      >
        {admin && (
          <ActionLink to="/devices/new" primary>
            Thêm thiết bị
          </ActionLink>
        )}
      </PageHeader>
      <section className={styles.lifecycle} aria-label="Vòng đời thiết bị">
        {Object.entries(LIFECYCLES).map(([key, description]) => (
          <button
            key={key}
            aria-pressed={key === lifecycle}
            onClick={() => setLifecycle(key === lifecycle ? '' : (key as LifecycleStatus))}
          >
            <Badge value={key} />
            <strong>{data.devices.filter((d) => d.lifecycle_status === key).length}</strong>
            <span className="small secondary">{description}</span>
          </button>
        ))}
      </section>
      <div className={styles.toolbar}>
        <Field id="device-search" label="Tìm thiết bị">
          <input
            id="device-search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Tên, mã thiết bị hoặc MAC…"
            type="search"
          />
        </Field>
        <Field id="warehouse" label="Kho">
          <select id="warehouse" value={warehouse} onChange={(e) => setWarehouse(e.target.value)}>
            <option value="">Tất cả kho</option>
            {data.warehouses.map((w) => (
              <option key={w.warehouse_id} value={w.warehouse_id}>
                {w.warehouse_name}
              </option>
            ))}
          </select>
        </Field>
        <span className="small secondary">
          Hiển thị {rows.length} / {data.devices.length}
        </span>
      </div>
      <Table
        label="Danh sách thiết bị"
        headers={[
          'Thiết bị',
          'Vòng đời',
          'Kết nối',
          'Kho',
          'Firmware',
          'IP / MAC',
          'Phụ trách',
          'Thao tác',
        ]}
      >
        {rows.map((device) => (
          <tr key={device.device_id}>
            <td>
              <div className={styles.deviceName}>
                <strong>{device.device_name}</strong>
                <span className="mono muted">{device.device_code}</span>
              </div>
            </td>
            <td>
              <Badge value={device.lifecycle_status} />
            </td>
            <td>
              <div className={styles.deviceName}>
                <Connection device={device} />
                <Heartbeat device={device} />
              </div>
            </td>
            <td>{device.warehouse_name || '—'}</td>
            <td className="mono">{device.firmware_version || '—'}</td>
            <td>
              <div className="mono">
                <div>{device.ip_address || '—'}</div>
                <div className="muted">{device.mac_address}</div>
              </div>
            </td>
            <td>{device.assigned_username || '—'}</td>
            <td>
              {admin && device.lifecycle_status === 'REGISTERED' ? (
                <DeferredButton>Kích hoạt</DeferredButton>
              ) : (
                <Link to={`/devices/${device.device_id}`}>Chi tiết</Link>
              )}
            </td>
          </tr>
        ))}
        {!rows.length && <EmptyRow columns={8} message="Không tìm thấy thiết bị phù hợp." />}
      </Table>
    </>
  )
}
