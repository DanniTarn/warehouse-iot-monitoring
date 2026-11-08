import { useEffect, useState, type ButtonHTMLAttributes, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { Icon } from './Icon'
import { heartbeat } from '../../services/format'
import type { Device } from '../../services/types'
import styles from './UI.module.css'

type Tone = 'good' | 'warning' | 'critical' | 'info' | 'neutral'
export function Card({
  title,
  children,
  className = '',
}: {
  title?: string
  children: ReactNode
  className?: string
}) {
  return (
    <section className={`${styles.card} ${className}`}>
      {title && <h2>{title}</h2>}
      {children}
    </section>
  )
}
export function PageHeader({
  title,
  subtitle,
  children,
}: {
  title: string
  subtitle?: ReactNode
  children?: ReactNode
}) {
  return (
    <header className={styles.header}>
      <div className={styles.heading}>
        <h1>{title}</h1>
        {subtitle && <div className="secondary">{subtitle}</div>}
      </div>
      {children}
    </header>
  )
}
export function Button({
  variant,
  className = '',
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'danger' }) {
  return (
    <button
      type="button"
      className={`${styles.button} ${variant ? styles[variant] : ''} ${className}`}
      {...props}
    />
  )
}
export function ActionLink({
  to,
  children,
  primary = false,
}: {
  to: string
  children: ReactNode
  primary?: boolean
}) {
  return (
    <Link className={`${styles.button} ${primary ? styles.primary : ''}`} to={to}>
      {children}
    </Link>
  )
}
export function ActionButton({
  action,
  confirm,
  success,
  variant,
  disabled,
  children,
}: {
  action: () => Promise<unknown>
  confirm?: string
  success?: string
  variant?: 'primary' | 'danger'
  disabled?: boolean
  children: ReactNode
}) {
  const [pending, setPending] = useState(false)
  const [error, setError] = useState('')
  const [done, setDone] = useState('')
  async function run() {
    if (confirm && !window.confirm(confirm)) return
    setPending(true)
    setError('')
    setDone('')
    try {
      await action()
      if (success) setDone(success)
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Không thực hiện được thao tác.')
    } finally {
      setPending(false)
    }
  }
  return (
    <span className={styles.action}>
      <Button variant={variant} disabled={disabled || pending} aria-busy={pending} onClick={run}>
        {children}
      </Button>
      {error ? <Notice error>{error}</Notice> : done ? <Notice>{done}</Notice> : null}
    </span>
  )
}
export function Badge({
  children,
  tone,
  value,
}: {
  children?: ReactNode
  tone?: Tone
  value?: string
}) {
  const map: Record<string, Tone> = {
    ACTIVE: 'good',
    REGISTERED: 'info',
    OFFLINE: 'critical',
    MAINTENANCE: 'warning',
    DECOMMISSIONED: 'neutral',
    CRITICAL: 'critical',
    WARNING: 'warning',
    INFO: 'info',
    ACKNOWLEDGED: 'good',
    FAILED: 'critical',
    PENDING: 'warning',
    SENT: 'info',
  }
  return (
    <span className={`${styles.badge} ${styles[tone || map[value || ''] || 'neutral']}`}>
      {value === 'CRITICAL' && <Icon name="critical" size={14} />}
      {value === 'WARNING' && <Icon name="warning" size={14} />}
      {value === 'INFO' && <Icon name="info" size={14} />}
      {children || value}
    </span>
  )
}
export function Field({
  label,
  id,
  hint,
  children,
}: {
  label: string
  id: string
  hint?: string
  children: ReactNode
}) {
  return (
    <div className={styles.field}>
      <label htmlFor={id}>{label}</label>
      {children}
      {hint && <span className="mono muted small">{hint}</span>}
    </div>
  )
}
export function Table({
  headers,
  children,
  label,
}: {
  headers: string[]
  children: ReactNode
  label: string
}) {
  return (
    <div className={styles.tableBox} role="region" aria-label={label} tabIndex={0}>
      <table>
        <caption className="sr-only">{label}</caption>
        <thead>
          <tr>
            {headers.map((header) => (
              <th key={header} scope="col">
                {header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>{children}</tbody>
      </table>
    </div>
  )
}
export function EmptyRow({
  columns,
  message = 'Không có dữ liệu phù hợp.',
}: {
  columns: number
  message?: string
}) {
  return (
    <tr>
      <td colSpan={columns} className={styles.empty}>
        {message}
      </td>
    </tr>
  )
}
export function Notice({ children, error = false }: { children: ReactNode; error?: boolean }) {
  return (
    <div
      role={error ? 'alert' : 'status'}
      className={`${styles.notice} ${error ? styles.error : ''}`}
    >
      {children}
    </div>
  )
}
export function SecretToken({ token }: { token: string }) {
  return (
    <code className={styles.secret} aria-label="Token xác thực">
      {token}
    </code>
  )
}
export function BackLink() {
  return (
    <Link to="/devices" className={styles.link}>
      <Icon name="back" size={16} />
      Thiết bị
    </Link>
  )
}
export function Heartbeat({ device }: { device: Device }) {
  const [now, setNow] = useState(Date.now())
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(timer)
  }, [])
  return (
    <span className="muted small">
      {device.lifecycle_status === 'DECOMMISSIONED'
        ? 'Token đã thu hồi'
        : heartbeat(device.last_heartbeat, now)}
    </span>
  )
}
export function Connection({ device }: { device: Device }) {
  const label = device.online
    ? 'Online'
    : device.lifecycle_status === 'REGISTERED'
      ? 'Chưa kết nối'
      : device.lifecycle_status === 'DECOMMISSIONED'
        ? 'Bị chặn'
        : 'Offline'
  return (
    <span className={`${styles.status} ${device.online ? 'good' : 'muted'}`}>
      <span className={styles.dot} />
      {label}
    </span>
  )
}
type StatTone = 'good' | 'warning' | 'critical' | 'muted'
const STAT_TONE_CLASS: Record<StatTone, string> = {
  good: '',
  muted: '',
  warning: styles.statWarning,
  critical: styles.statCritical,
}
export function Stat({
  label,
  sensor,
  value,
  unit,
  status,
  tone = 'good',
}: {
  label: string
  sensor?: string
  value: string
  unit?: string
  status: string
  tone?: StatTone
}) {
  return (
    <Card className={`${styles.stat} ${STAT_TONE_CLASS[tone]}`}>
      <div className={styles.statLabel}>
        <span>{label}</span>
        <span className="mono small muted">{sensor}</span>
      </div>
      <div className="row">
        <span className={styles.reading}>{value}</span>
        <span className="secondary">{unit}</span>
      </div>
      <div className={`${styles.status} ${tone}`}>
        <span className={styles.dot} />
        {status}
      </div>
    </Card>
  )
}
export function InfoList({ rows }: { rows: [string, ReactNode][] }) {
  return (
    <dl className={styles.infoList}>
      {rows.map(([label, value]) => (
        <div key={label}>
          <dt>{label}</dt>
          <dd>{value}</dd>
        </div>
      ))}
    </dl>
  )
}
