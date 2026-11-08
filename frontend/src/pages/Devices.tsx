import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Plus, Search } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { PageHeader } from '@/components/app/page-header'
import {
  ActionButton,
  Connection,
  EmptyState,
  Heartbeat,
  LifecycleBadge,
} from '@/components/app/kit'
import { LIFECYCLES } from '@/services/config'
import type { LifecycleStatus } from '@/services/types'
import { useActions } from '@/store/actions'
import { useAuth } from '@/store/auth'
import { useDashboard } from '@/store/dashboard'
import { cn } from '@/lib/utils'

export default function Devices() {
  const data = useDashboard((s) => s.data)!
  const admin = useAuth((s) => s.user?.role === 'ADMIN')
  const actions = useActions()
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
    <div className="space-y-4">
      <PageHeader
        title="Thiết bị"
        subtitle={`${data.devices.length} thiết bị · ${data.devices.filter((d) => d.online).length} đang online`}
        actions={
          admin && (
            <Button asChild>
              <Link to="/devices/new">
                <Plus className="size-4" />
                Thêm thiết bị
              </Link>
            </Button>
          )
        }
      />

      <section aria-label="Vòng đời thiết bị" className="grid gap-2 sm:grid-cols-3 xl:grid-cols-5">
        {Object.entries(LIFECYCLES).map(([key, description]) => {
          const count = data.devices.filter((d) => d.lifecycle_status === key).length
          const active = key === lifecycle
          return (
            <button
              key={key}
              aria-pressed={active}
              onClick={() => setLifecycle(active ? '' : (key as LifecycleStatus))}
              className={cn(
                'rounded-xl border bg-card p-3 text-left transition-colors hover:border-primary/40',
                active && 'border-primary bg-accent/60 ring-1 ring-primary/30',
              )}
            >
              <div className="flex items-baseline justify-between gap-2">
                <span className="text-2xl font-semibold tabular-nums">{count}</span>
                <span className="font-mono text-[10px] uppercase tracking-wide text-muted-foreground">
                  {key}
                </span>
              </div>
              <p className="mt-1 text-xs leading-snug text-muted-foreground">{description}</p>
            </button>
          )
        })}
      </section>

      <div className="flex flex-col gap-3 rounded-xl border bg-card p-3 sm:flex-row sm:items-end">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            aria-label="Tìm thiết bị"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Tên, mã thiết bị hoặc MAC…"
            type="search"
            className="pl-9"
          />
        </div>
        <Select
          value={warehouse || 'all'}
          onValueChange={(value) => setWarehouse(value === 'all' ? '' : value)}
        >
          <SelectTrigger className="w-full sm:w-52" aria-label="Kho">
            <SelectValue placeholder="Tất cả kho" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tất cả kho</SelectItem>
            {data.warehouses.map((w) => (
              <SelectItem key={w.warehouse_id} value={String(w.warehouse_id)}>
                {w.warehouse_name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <span className="pb-2 text-xs text-muted-foreground sm:pb-0">
          Hiển thị {rows.length} / {data.devices.length}
        </span>
      </div>

      <div className="rounded-xl border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Thiết bị</TableHead>
              <TableHead>Vòng đời</TableHead>
              <TableHead>Kết nối</TableHead>
              <TableHead>Kho</TableHead>
              <TableHead>Firmware</TableHead>
              <TableHead>IP / MAC</TableHead>
              <TableHead>Phụ trách</TableHead>
              <TableHead className="text-right">Thao tác</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((device) => (
              <TableRow key={device.device_id}>
                <TableCell>
                  <div className="flex flex-col">
                    <span className="font-medium">{device.device_name}</span>
                    <span className="font-mono text-[11px] text-muted-foreground">
                      {device.device_code}
                    </span>
                  </div>
                </TableCell>
                <TableCell>
                  <LifecycleBadge status={device.lifecycle_status} />
                </TableCell>
                <TableCell>
                  <div className="flex flex-col gap-0.5">
                    <Connection device={device} />
                    <Heartbeat device={device} />
                  </div>
                </TableCell>
                <TableCell>{device.warehouse_name || '—'}</TableCell>
                <TableCell className="font-mono text-xs">
                  {device.firmware_version || '—'}
                </TableCell>
                <TableCell>
                  <div className="font-mono text-xs">
                    <div>{device.ip_address || '—'}</div>
                    <div className="text-muted-foreground">{device.mac_address}</div>
                  </div>
                </TableCell>
                <TableCell>{device.assigned_username || '—'}</TableCell>
                <TableCell className="text-right">
                  {admin && device.lifecycle_status === 'REGISTERED' ? (
                    <ActionButton
                      size="sm"
                      variant="outline"
                      action={() => actions.activateDevice(device.device_id)}
                      success="Đã kích hoạt thiết bị."
                    >
                      Kích hoạt
                    </ActionButton>
                  ) : (
                    <Button asChild variant="link" size="sm" className="h-auto p-0">
                      <Link to={`/devices/${device.device_id}`}>Chi tiết</Link>
                    </Button>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        {!rows.length && (
          <div className="p-3">
            <EmptyState>Không tìm thấy thiết bị phù hợp.</EmptyState>
          </div>
        )}
      </div>
    </div>
  )
}
