import type { DeviceCommand } from '../../services/types'
import { dateTime } from '../../services/format'
import { Badge, EmptyRow, Table } from './UI'
export function CommandTable({ commands }: { commands: DeviceCommand[] }) {
  return (
    <Table
      label="Lệnh điều khiển"
      headers={['Thời gian gửi', 'Thiết bị', 'Lệnh', 'Người gửi', 'Trạng thái', 'Phản hồi']}
    >
      {commands.map((command) => (
        <tr key={command.command_id}>
          <td className="mono">{dateTime(command.sent_at, true)}</td>
          <td className="mono">{command.device_code}</td>
          <td className="mono">{command.command_type}</td>
          <td>{command.username}</td>
          <td>
            <Badge value={command.status} />
          </td>
          <td className="mono">{dateTime(command.acknowledged_at, true)}</td>
        </tr>
      ))}
      {!commands.length && <EmptyRow columns={6} message="Chưa có lệnh điều khiển." />}
    </Table>
  )
}
