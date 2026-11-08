import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { CommandStatusBadge } from '@/components/app/kit'
import { dateTime } from '@/services/format'
import type { DeviceCommand } from '@/services/types'

export function CommandTable({ commands }: { commands: DeviceCommand[] }) {
  return (
    <div role="region" aria-label="Lệnh điều khiển" className="overflow-x-auto rounded-lg border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Thời gian gửi</TableHead>
            <TableHead>Thiết bị</TableHead>
            <TableHead>Lệnh</TableHead>
            <TableHead>Người gửi</TableHead>
            <TableHead>Trạng thái</TableHead>
            <TableHead>Phản hồi</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {commands.map((command) => (
            <TableRow key={command.command_id}>
              <TableCell className="font-mono text-xs">
                {dateTime(command.sent_at, true)}
              </TableCell>
              <TableCell className="font-mono text-xs">{command.device_code}</TableCell>
              <TableCell className="font-mono text-xs">{command.command_type}</TableCell>
              <TableCell>{command.username ?? 'Tự động'}</TableCell>
              <TableCell>
                <CommandStatusBadge status={command.status} />
              </TableCell>
              <TableCell className="font-mono text-xs">
                {dateTime(command.acknowledged_at, true)}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      {!commands.length && (
        <p className="px-4 py-8 text-center text-sm text-muted-foreground">
          Chưa có lệnh điều khiển.
        </p>
      )}
    </div>
  )
}
