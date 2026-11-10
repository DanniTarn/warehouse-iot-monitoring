import { useState } from 'react'
import { Fan } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Notice } from '@/components/app/kit'
import { getDeviceKind } from '@/services/config'
import { fanState } from '@/services/dashboardView'
import type { ManualCommandType } from '@/services/types'
import { useActions } from '@/store/actions'
import { useAuth } from '@/store/auth'
import { useDashboard } from '@/store/dashboard'
import { cn } from '@/lib/utils'

export function FanControl({
  detailed = false,
  deviceId,
}: {
  detailed?: boolean
  deviceId?: number
}) {
  const viewer = useAuth((s) => s.user?.role === 'VIEWER')
  const data = useDashboard((s) => s.data)
  const actions = useActions()
  const [pending, setPending] = useState<ManualCommandType | ''>('')
  const [error, setError] = useState('')
  const target =
    deviceId ??
    data?.devices.find((device) => getDeviceKind(device) === 'environment')?.device_id
  const { mode, running } = data
    ? fanState(data, target)
    : { mode: undefined, running: undefined }
  const options: [ManualCommandType, 'auto' | 'on' | 'off', string][] = [
    ['FAN_AUTO', 'auto', 'Tự động'],
    ['FAN_ON', 'on', detailed ? 'Bật cưỡng chế' : 'Bật'],
    ['FAN_OFF', 'off', detailed ? 'Tắt cưỡng chế' : 'Tắt'],
  ]
  async function send(command: ManualCommandType) {
    if (target === undefined) {
      setError('Không tìm thấy thiết bị môi trường.')
      return
    }
    setPending(command)
    setError('')
    try {
      await actions.sendCommand(target, command)
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Không gửi được lệnh điều khiển.')
    } finally {
      setPending('')
    }
  }
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <span className="inline-flex items-center gap-2 text-sm font-medium">
          <Fan className="size-4 text-muted-foreground" />
          Quạt hút · Relay 5V
        </span>
        <Badge variant={running ? 'default' : 'secondary'}>
          {running ? 'Đang chạy' : 'Đang tắt'}
        </Badge>
      </div>
      <div
        className="grid grid-cols-3 gap-1 rounded-lg border bg-muted/40 p-1"
        role="group"
        aria-label="Chế độ quạt"
      >
        {options.map(([command, key, label]) => (
          <Button
            key={command}
            size="sm"
            variant="ghost"
            aria-pressed={mode === key}
            aria-busy={pending === command}
            disabled={viewer || pending !== ''}
            onClick={() => void send(command)}
            className={cn(
              'h-8',
              mode === key && 'bg-card text-foreground shadow-xs hover:bg-card',
            )}
          >
            {label}
          </Button>
        ))}
      </div>
      <p className="text-xs text-muted-foreground">Quy tắc: độ ẩm &gt; 65 % thì bật quạt.</p>
      {error && <Notice error>{error}</Notice>}
      {pending && <Notice>Đang gửi lệnh {pending}…</Notice>}
      {viewer && (
        <p className="text-xs text-muted-foreground">
          Tài khoản Viewer chỉ có quyền xem. Không thể điều khiển thiết bị.
        </p>
      )}
    </div>
  )
}
