import { useEffect, useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import {
  ArrowLeft,
  CircleCheck,
  CircleDot,
  Copy,
  TriangleAlert,
} from 'lucide-react'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { heartbeat } from '@/services/format'
import type { Device } from '@/services/types'
import { cn } from '@/lib/utils'

export function Field({
  id,
  label,
  hint,
  children,
}: {
  id: string
  label: string
  hint?: string
  children: ReactNode
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      {children}
      {hint && <p className="font-mono text-[11px] text-muted-foreground">{hint}</p>}
    </div>
  )
}

export function Notice({ children, error = false }: { children: ReactNode; error?: boolean }) {
  return (
    <Alert variant={error ? 'destructive' : 'default'} className="py-2">
      {error ? (
        <TriangleAlert className="size-4" />
      ) : (
        <CircleCheck className="size-4" />
      )}
      <AlertDescription>{children}</AlertDescription>
    </Alert>
  )
}

export function ActionButton({
  action,
  confirm,
  success,
  variant,
  size,
  disabled,
  className,
  children,
}: {
  action: () => Promise<unknown>
  confirm?: string
  success?: string
  variant?: 'default' | 'outline' | 'secondary' | 'ghost' | 'destructive'
  size?: 'default' | 'sm' | 'icon'
  disabled?: boolean
  className?: string
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
    <span className={cn('inline-flex flex-col items-start gap-1', className)}>
      <Button
        variant={variant}
        size={size}
        disabled={disabled || pending}
        aria-busy={pending}
        onClick={() => void run()}
      >
        {children}
      </Button>
      {error ? (
        <span className="text-xs text-destructive">{error}</span>
      ) : done ? (
        <span className="text-xs font-medium text-emerald-700">{done}</span>
      ) : null}
    </span>
  )
}

type Tone = 'good' | 'warning' | 'critical' | 'muted' | 'info'

const toneClass: Record<Tone, string> = {
  good: 'border-emerald-200 bg-emerald-50 text-emerald-700',
  warning: 'border-amber-200 bg-amber-50 text-amber-800',
  critical: 'border-red-200 bg-red-50 text-red-700',
  muted: 'border-border bg-muted text-muted-foreground',
  info: 'border-blue-200 bg-blue-50 text-blue-700',
}

export function ToneBadge({ tone, children }: { tone: Tone; children: ReactNode }) {
  return (
    <Badge variant="outline" className={cn('gap-1 font-medium', toneClass[tone])}>
      <CircleDot className="size-2.5 fill-current" />
      {children}
    </Badge>
  )
}

const lifecycleTone: Record<string, Tone> = {
  ACTIVE: 'good',
  OFFLINE: 'warning',
  MAINTENANCE: 'info',
  REGISTERED: 'muted',
  DECOMMISSIONED: 'critical',
}

const lifecycleLabel: Record<string, string> = {
  ACTIVE: 'Đang hoạt động',
  OFFLINE: 'Mất kết nối hoặc lỗi',
  MAINTENANCE: 'Đang bảo trì',
  REGISTERED: 'Đã đăng ký, chờ kích hoạt',
  DECOMMISSIONED: 'Đã thu hồi, bị chặn kết nối',
}

export function LifecycleBadge({ status }: { status: string }) {
  return (
    <ToneBadge tone={lifecycleTone[status] ?? 'muted'}>
      {lifecycleLabel[status] ?? status}
    </ToneBadge>
  )
}

export function SeverityBadge({ severity }: { severity: 'INFO' | 'WARNING' | 'CRITICAL' }) {
  const tone: Tone = severity === 'CRITICAL' ? 'critical' : severity === 'WARNING' ? 'warning' : 'info'
  return <ToneBadge tone={tone}>{severity}</ToneBadge>
}

export function CommandStatusBadge({ status }: { status: string }) {
  const tone: Tone =
    status === 'ACKNOWLEDGED' ? 'good' : status === 'FAILED' ? 'critical' : 'muted'
  return (
    <Badge variant="outline" className={cn('font-mono text-[11px]', toneClass[tone])}>
      {status}
    </Badge>
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
    <span
      className={cn(
        'inline-flex items-center gap-1.5 text-xs font-medium',
        device.online ? 'text-emerald-700' : 'text-muted-foreground',
      )}
    >
      <span
        className={cn(
          'size-2 rounded-full',
          device.online ? 'bg-emerald-500' : 'bg-muted-foreground/40',
        )}
      />
      {label}
    </span>
  )
}

export function Heartbeat({ device }: { device: Device }) {
  const [now, setNow] = useState(Date.now())
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(timer)
  }, [])
  return (
    <span className="text-xs text-muted-foreground">
      {device.lifecycle_status === 'DECOMMISSIONED'
        ? 'Token đã thu hồi'
        : heartbeat(device.last_heartbeat, now)}
    </span>
  )
}

type StatTone = 'good' | 'warning' | 'critical' | 'muted'

const statSurface: Record<StatTone, string> = {
  good: '',
  muted: 'bg-muted/40',
  warning: 'border-amber-200 bg-amber-50/70',
  critical: 'border-red-200 bg-red-50/70',
}

const statDot: Record<StatTone, string> = {
  good: 'bg-emerald-500',
  muted: 'bg-muted-foreground/40',
  warning: 'bg-amber-500',
  critical: 'bg-red-500',
}

const statText: Record<StatTone, string> = {
  good: 'text-muted-foreground',
  muted: 'text-muted-foreground',
  warning: 'text-amber-800',
  critical: 'text-red-700',
}

export function StatCard({
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
    <Card className={cn('gap-0 p-4 shadow-none', statSurface[tone])}>
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-sm font-medium">{label}</span>
        {sensor && <span className="font-mono text-[11px] text-muted-foreground">{sensor}</span>}
      </div>
      <div className="mt-2 flex items-baseline gap-1.5">
        <span className="text-3xl font-semibold tracking-tight tabular-nums">{value}</span>
        {unit && <span className="text-sm text-muted-foreground">{unit}</span>}
      </div>
      <div className={cn('mt-2 flex items-center gap-1.5 text-xs', statText[tone])}>
        <span className={cn('size-1.5 rounded-full', statDot[tone])} />
        {status}
      </div>
    </Card>
  )
}

export function InfoList({ rows }: { rows: [string, ReactNode][] }) {
  return (
    <dl className="divide-y text-sm">
      {rows.map(([term, description]) => (
        <div key={term} className="flex items-start justify-between gap-4 py-2 first:pt-0 last:pb-0">
          <dt className="text-muted-foreground">{term}</dt>
          <dd className="min-w-0 max-w-[62%] text-right font-medium">{description}</dd>
        </div>
      ))}
    </dl>
  )
}

export function SecretToken({ token }: { token: string }) {
  const [copied, setCopied] = useState(false)
  return (
    <div className="mt-2 flex items-center gap-2">
      <code
        aria-label="Token xác thực"
        className="min-w-0 flex-1 overflow-x-auto rounded-md bg-muted px-3 py-2 font-mono text-xs"
      >
        {token}
      </code>
      <Button
        type="button"
        variant="outline"
        size="icon"
        aria-label="Sao chép token"
        onClick={() => {
          void navigator.clipboard?.writeText(token).then(() => {
            setCopied(true)
            setTimeout(() => setCopied(false), 1500)
          })
        }}
      >
        {copied ? <CircleCheck className="size-4" /> : <Copy className="size-4" />}
      </Button>
    </div>
  )
}

export function BackLink() {
  return (
    <Link
      to="/devices"
      className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
    >
      <ArrowLeft className="size-4" />
      Thiết bị
    </Link>
  )
}

export function EmptyState({ children }: { children: ReactNode }) {
  return (
    <div className="rounded-lg border border-dashed px-4 py-10 text-center text-sm text-muted-foreground">
      {children}
    </div>
  )
}

export { Input }
