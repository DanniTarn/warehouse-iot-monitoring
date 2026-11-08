import { useState } from 'react'
import { CheckCircle2 } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { PageHeader } from '@/components/app/page-header'
import { ActionButton, SeverityBadge, ToneBadge } from '@/components/app/kit'
import { dateTime } from '@/services/format'
import { useActions } from '@/store/actions'
import { useAuth } from '@/store/auth'
import { useDashboard } from '@/store/dashboard'
import { cn } from '@/lib/utils'

const selectClass =
  'h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs outline-none transition-colors focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50'

export default function Alerts() {
  const data = useDashboard((s) => s.data)!
  const viewer = useAuth((s) => s.user?.role === 'VIEWER')
  const actions = useActions()
  const [tab, setTab] = useState('open')
  const [severity, setSeverity] = useState('')
  const [device, setDevice] = useState('')
  const open = data.alerts.filter((a) => !a.is_acknowledged).length
  const rows = data.alerts.filter(
    (a) =>
      (tab === 'all' || (tab === 'open' ? !a.is_acknowledged : a.is_acknowledged)) &&
      (!severity || severity === a.severity) &&
      (!device || device === String(a.device_id)),
  )
  return (
    <div className="space-y-4">
      <PageHeader title="Cảnh báo" subtitle="Theo dõi và xử lý các sự kiện bất thường trong kho" />

      <div
        className="inline-flex flex-wrap gap-1 rounded-lg border bg-muted/40 p-1"
        role="group"
        aria-label="Trạng thái cảnh báo"
      >
        {(
          [
            ['open', 'Đang mở', open],
            ['resolved', 'Đã xử lý', data.alerts.length - open],
            ['all', 'Tất cả', data.alerts.length],
          ] as [string, string, number][]
        ).map(([key, title, count]) => (
          <button
            key={key}
            aria-pressed={tab === key}
            onClick={() => setTab(key)}
            className={cn(
              'inline-flex items-center gap-2 rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
              tab === key
                ? 'bg-card text-foreground shadow-xs'
                : 'text-muted-foreground hover:text-foreground',
            )}
          >
            {title}
            <span className="font-mono text-xs text-muted-foreground">{count}</span>
          </button>
        ))}
      </div>

      <div className="grid gap-3 rounded-xl border bg-card p-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="severity">Mức độ</Label>
          <select
            id="severity"
            className={selectClass}
            value={severity}
            onChange={(e) => setSeverity(e.target.value)}
          >
            <option value="">Tất cả mức độ</option>
            {['CRITICAL', 'WARNING', 'INFO'].map((value) => (
              <option key={value}>{value}</option>
            ))}
          </select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="alert-device">Thiết bị</Label>
          <select
            id="alert-device"
            className={selectClass}
            value={device}
            onChange={(e) => setDevice(e.target.value)}
          >
            <option value="">Tất cả thiết bị</option>
            {data.devices.map((d) => (
              <option value={d.device_id} key={d.device_id}>
                {d.device_code}
              </option>
            ))}
          </select>
        </div>
      </div>

      <Card className="gap-0 py-0 shadow-none">
        <CardContent className="divide-y p-0">
          {rows.map((alert) => (
            <article
              key={alert.alert_id}
              className="flex flex-col gap-3 p-4 sm:flex-row sm:items-start"
            >
              <SeverityBadge severity={alert.severity} />
              <div className="min-w-0 flex-1 space-y-1">
                <p className="font-medium">{alert.alert_message}</p>
                <p className="font-mono text-[11px] text-muted-foreground">
                  {alert.alert_type} · {alert.device_code} · {dateTime(alert.created_at, true)}
                </p>
              </div>
              <div className="shrink-0">
                {alert.is_acknowledged ? (
                  <ToneBadge tone="good">
                    <CheckCircle2 className="size-3" />
                    Đã xử lý bởi {alert.resolved_by_username} · {dateTime(alert.resolved_at)}
                  </ToneBadge>
                ) : viewer ? (
                  <span className="text-xs text-muted-foreground">Chưa xử lý</span>
                ) : (
                  <ActionButton
                    size="sm"
                    variant="outline"
                    action={() => actions.acknowledgeAlert(alert.alert_id)}
                    success="Đã xác nhận cảnh báo."
                  >
                    Xác nhận đã xử lý
                  </ActionButton>
                )}
              </div>
            </article>
          ))}
          {!rows.length && (
            <p className="px-4 py-12 text-center text-sm text-muted-foreground">
              Không có cảnh báo phù hợp.
            </p>
          )}
        </CardContent>
      </Card>
      <p className="text-xs text-muted-foreground">
        Hiển thị {rows.length} / {data.alerts.length} cảnh báo
      </p>
    </div>
  )
}
