import { act, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { api } from './services/api'
import App from './App'
import { useAuth } from './store/auth'
import { useDashboard } from './store/dashboard'
import type { Alert, Severity, Telemetry } from './services/types'

beforeEach(() => {
  sessionStorage.clear()
  useAuth.setState({ user: null, token: null, ready: false })
  useDashboard.getState().reset()
})
async function open(path: string, username = 'admin') {
  await act(async () => {
    await useAuth.getState().login(username, 'demo123')
  })
  render(
    <MemoryRouter
      initialEntries={[path]}
      future={{ v7_startTransition: true, v7_relativeSplatPath: true }}
    >
      <App />
    </MemoryRouter>,
  )
}
describe('AC-2 and AC-4: routes and role boundaries', () => {
  it.each([
    ['/devices', 'Thiết bị'],
    ['/devices/new', 'Thêm thiết bị'],
    ['/devices/1', 'Node 1 · Môi trường'],
    ['/devices/2', 'Node 2 · An ninh'],
    ['/alerts', 'Cảnh báo'],
    ['/history?tab=commands', 'Lịch sử'],
    ['/users', 'Người dùng'],
  ])('renders %s with its page title', async (path, title) => {
    await open(path)
    expect(await screen.findByRole('heading', { name: title, level: 1 })).toBeVisible()
  })
  it.each(['viewer01', 'operator01'])(
    'hides Admin navigation and denies direct Admin routes to %s',
    async (username) => {
      await open('/users', username)
      expect(
        await screen.findByRole('heading', { name: 'Bạn không có quyền xem trang này' }),
      ).toBeVisible()
      const nav = screen.getByRole('navigation', { name: 'Điều hướng chính' })
      expect(within(nav).queryByRole('link', { name: 'Người dùng' })).not.toBeInTheDocument()
    },
  )
  it('denies device registration to an operator', async () => {
    await open('/devices/new', 'operator01')
    expect(
      await screen.findByRole('heading', { name: 'Bạn không có quyền xem trang này' }),
    ).toBeVisible()
  })
  it('redirects a viewer away from the audit query', async () => {
    await open('/history?tab=audit', 'viewer01')
    expect(await screen.findByRole('region', { name: 'Dữ liệu cảm biến' })).toBeVisible()
    expect(screen.queryByRole('link', { name: 'Nhật ký thao tác' })).not.toBeInTheDocument()
    expect(screen.queryByText('IP')).not.toBeInTheDocument()
  })
  it('disables viewer fan and configuration controls and hides lifecycle actions', async () => {
    await open('/devices/1', 'viewer01')
    expect(await screen.findByRole('button', { name: 'Bật cưỡng chế' })).toBeDisabled()
    expect(screen.getByLabelText('Ngưỡng độ ẩm (%)')).toBeDisabled()
    expect(screen.queryByRole('button', { name: 'Chuyển bảo trì' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Cấp lại token' })).not.toBeInTheDocument()
  })
  it('keeps operator controls enabled and hides Admin lifecycle controls', async () => {
    await open('/devices/1', 'operator01')
    expect(await screen.findByRole('button', { name: 'Bật cưỡng chế' })).toBeEnabled()
    expect(screen.getByLabelText('Ngưỡng độ ẩm (%)')).toBeEnabled()
    expect(screen.queryByRole('button', { name: 'Thu hồi thiết bị' })).not.toBeInTheDocument()
  })
  it('protects the Admin own role and lock controls', async () => {
    await open('/users')
    expect(await screen.findByLabelText('Vai trò của admin')).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Bạn' })).toBeDisabled()
  })
})
describe('AC-3 and AC-6: login and live actions', () => {
  it('redirects an unauthenticated route to the labelled login form', async () => {
    render(
      <MemoryRouter
        initialEntries={['/devices']}
        future={{ v7_startTransition: true, v7_relativeSplatPath: true }}
      >
        <App />
      </MemoryRouter>,
    )
    expect(await screen.findByLabelText('Tên đăng nhập')).toBeVisible()
    expect(screen.queryByRole('navigation')).not.toBeInTheDocument()
  })
  it('shows a generic error after a wrong password', async () => {
    const user = userEvent.setup()
    render(
      <MemoryRouter
        initialEntries={['/login']}
        future={{ v7_startTransition: true, v7_relativeSplatPath: true }}
      >
        <App />
      </MemoryRouter>,
    )
    await user.type(await screen.findByLabelText('Tên đăng nhập'), 'admin')
    await user.type(screen.getByLabelText('Mật khẩu'), 'wrong')
    await user.click(screen.getByRole('button', { name: 'Đăng nhập' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Sai tên đăng nhập hoặc mật khẩu.')
  })
  it('shows an empty state when device search has no matches', async () => {
    const user = userEvent.setup()
    await open('/devices')
    await user.type(await screen.findByLabelText('Tìm thiết bị'), 'missing-device')
    expect(screen.getByText('Không tìm thấy thiết bị phù hợp.')).toBeVisible()
  })
  it('stops the buzzer after a BUZZER_OFF command', async () => {
    const user = userEvent.setup()
    await open('/devices/2')
    expect((await screen.findAllByText('Đang kêu')).length).toBeGreaterThan(0)
    await user.click(screen.getByRole('button', { name: 'Tắt còi' }))
    await waitFor(() => expect(screen.queryByText('Đang kêu')).not.toBeInTheDocument())
    expect(screen.getByRole('button', { name: 'Tắt còi' })).toBeDisabled()
  })
  it('logs out and removes authenticated content', async () => {
    const user = userEvent.setup()
    await open('/devices')
    await screen.findByRole('heading', { name: 'Thiết bị', level: 1 })
    await user.click(screen.getByRole('button', { name: 'Đăng xuất' }))
    await waitFor(() => expect(screen.getByLabelText('Tên đăng nhập')).toBeVisible())
    expect(sessionStorage.getItem('warehouse.session')).toBeNull()
    expect(screen.queryByRole('navigation')).not.toBeInTheDocument()
  })
})

describe('real actions against the store', () => {
  it('moves an acknowledged alert out of the open tab', async () => {
    const user = userEvent.setup()
    await open('/alerts')
    const message = await screen.findByText('Cửa kho bị mở ngoài giờ giới nghiêm')
    const row = message.closest('article')!
    expect(screen.getByRole('button', { name: /Đã xử lý/ })).toHaveTextContent('3')
    await user.click(within(row).getByRole('button', { name: 'Xác nhận đã xử lý' }))
    await waitFor(() =>
      expect(screen.queryByText('Cửa kho bị mở ngoài giờ giới nghiêm')).not.toBeInTheDocument(),
    )
    expect(screen.getByRole('button', { name: /Đã xử lý/ })).toHaveTextContent('4')
  })

  it('shows the fan mode acknowledged by a FAN_ON command', async () => {
    const user = userEvent.setup()
    await open('/devices/1')
    const forced = await screen.findByRole('button', { name: 'Bật cưỡng chế' })
    expect(forced).toHaveAttribute('aria-pressed', 'false')
    await user.click(forced)
    await waitFor(() => expect(forced).toHaveAttribute('aria-pressed', 'true'))
  })

  it('saves configuration and keeps it after reopening the device', async () => {
    const user = userEvent.setup()
    await open('/devices/1')
    const humidity = await screen.findByLabelText('Ngưỡng độ ẩm (%)')
    await user.clear(humidity)
    await user.type(humidity, '70')
    await user.click(screen.getByRole('button', { name: 'Lưu cấu hình' }))
    expect(await screen.findByText('Đã lưu cấu hình.')).toBeVisible()

    const nav = screen.getByRole('navigation', { name: 'Điều hướng chính' })
    await user.click(within(nav).getByRole('link', { name: 'Thiết bị' }))
    const row = (await screen.findByText('Node 1 · Môi trường')).closest('tr')!
    await user.click(within(row).getByRole('link', { name: 'Chi tiết' }))
    expect(await screen.findByLabelText('Ngưỡng độ ẩm (%)')).toHaveValue(70)
  })

  it('creates a user and shows it in the list', async () => {
    const user = userEvent.setup()
    await open('/users')
    await user.type(await screen.findByLabelText('Tên đăng nhập'), 'thu.nghiem')
    await user.type(screen.getByLabelText('Họ và tên'), 'Nguyễn Văn Thử')
    await user.type(screen.getByLabelText('Mật khẩu tạm'), 'Thu@12345')
    await user.click(screen.getByRole('button', { name: 'Tạo tài khoản' }))
    expect(await screen.findByText('Nguyễn Văn Thử')).toBeVisible()
    expect(screen.getByLabelText('Tên đăng nhập')).toHaveValue('')
  })

  it('shows a new account in the audit history without reloading', async () => {
    const user = userEvent.setup()
    await open('/users')
    await user.type(await screen.findByLabelText('Tên đăng nhập'), 'kiem.toan')
    await user.type(screen.getByLabelText('Họ và tên'), 'Kiểm Toán')
    await user.type(screen.getByLabelText('Mật khẩu tạm'), 'Kiem@12345')
    await user.click(screen.getByRole('button', { name: 'Tạo tài khoản' }))
    await screen.findByText('Kiểm Toán')
    await user.click(screen.getByRole('link', { name: /Lịch sử/ }))
    await user.click(await screen.findByRole('link', { name: 'Nhật ký thao tác' }))
    expect(await screen.findByText('kiem.toan · VIEWER')).toBeVisible()
  })

  it('registers a device, shows its token once and links to its page', async () => {
    const user = userEvent.setup()
    await open('/devices/new')
    await user.type(await screen.findByLabelText('Tên hiển thị'), 'Node 9 · Kiểm thử')
    await user.type(screen.getByLabelText('Mã thiết bị'), 'NODE9_ENV')
    await user.type(screen.getByLabelText('Địa chỉ MAC của ESP32'), '24:6F:28:AA:BB:CC')
    await user.click(screen.getByRole('button', { name: 'Đăng ký thiết bị' }))
    expect(await screen.findByLabelText('Token xác thực')).toHaveTextContent(
      /^mock-token-NODE9_ENV-\d+$/,
    )
    await user.click(screen.getByRole('link', { name: 'Mở trang thiết bị' }))
    expect(
      await screen.findByRole('heading', { name: 'Node 9 · Kiểm thử', level: 1 }),
    ).toBeVisible()
    expect(screen.getByRole('button', { name: 'Kích hoạt' })).toBeVisible()
  })

  it('drops stale lifecycle messages and the revoked token after decommissioning', async () => {
    const user = userEvent.setup()
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    await open('/devices/4')
    await user.click(await screen.findByRole('button', { name: 'Kích hoạt lại' }))
    await screen.findByRole('button', { name: 'Chuyển bảo trì' })
    expect(screen.queryByText('Đã kích hoạt lại thiết bị.')).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Cấp lại token' }))
    expect(await screen.findByLabelText('Token xác thực')).toBeVisible()
    await user.click(screen.getByRole('button', { name: 'Thu hồi thiết bị' }))
    expect(await screen.findByText('Đã thu hồi thiết bị.')).toBeVisible()
    expect(screen.queryByLabelText('Token xác thực')).not.toBeInTheDocument()
  })
  it('revives a decommissioned device with a fresh token', async () => {
    const user = userEvent.setup()
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    await open('/devices/5')
    await user.click(
      await screen.findByRole('button', { name: 'Cấp lại token và kích hoạt' }),
    )
    expect(await screen.findByLabelText('Token xác thực')).toHaveTextContent(
      'mock-token-NODE0_TEST-5-revive',
    )
    expect(screen.getByText('Đang hoạt động')).toBeVisible()
    expect(
      screen.queryByRole('button', { name: 'Cấp lại token và kích hoạt' }),
    ).not.toBeInTheDocument()
  })

  it('keeps Save disabled when only the fan mode changed', async () => {
    const user = userEvent.setup()
    await open('/devices/1')
    const forceOn = await screen.findByRole('button', { name: 'Bật cưỡng chế' })
    const target =
      forceOn.getAttribute('aria-pressed') === 'true'
        ? screen.getByRole('button', { name: 'Tắt cưỡng chế' })
        : forceOn
    await user.click(target)
    await waitFor(() => expect(target).toHaveAttribute('aria-pressed', 'true'))
    expect(screen.getByRole('button', { name: 'Lưu cấu hình' })).toBeDisabled()
  })

  it('does not offer decommissioning before a device is activated', async () => {
    await open('/devices/3')
    expect(await screen.findByRole('button', { name: 'Thu hồi thiết bị' })).toBeDisabled()
  })

  it('does not carry an acknowledgement over to the next critical alert', async () => {
    const user = userEvent.setup()
    await open('/')
    await screen.findByRole('heading', { name: 'Tổng quan', level: 1 })
    await waitFor(() => expect(useDashboard.getState().loading).toBe(false))
    const base = useDashboard.getState().data!.alerts[0]
    const critical = (alert_id: number, alert_message: string) => ({
      ...base,
      alert_id,
      alert_message,
      severity: 'CRITICAL' as const,
      is_acknowledged: false,
      created_at: new Date().toISOString(),
    })
    const current = critical(98, 'Cảnh báo cũ hơn')
    act(() => {
      useDashboard.getState().applyEvent({ type: 'alert_created', data: current })
      useDashboard
        .getState()
        .applyEvent({ type: 'alert_created', data: critical(99, 'Cảnh báo mới nhất') })
    })
    vi.spyOn(api, 'acknowledgeAlert').mockImplementation(async (_token, alertId) => ({
      ...useDashboard.getState().data!.alerts.find((item) => item.alert_id === alertId)!,
      is_acknowledged: true,
    }))
    const banner = () =>
      screen.getAllByRole('alert').find((node) => node.textContent?.includes('CRITICAL ·'))!
    await waitFor(() => expect(banner()).toHaveTextContent('Cảnh báo mới nhất'))
    await user.click(within(banner()).getByRole('button', { name: 'Xác nhận đã xử lý' }))
    await waitFor(() => expect(banner()).toHaveTextContent(current.alert_message))
    expect(banner()).not.toHaveTextContent('Đã xác nhận cảnh báo.')
  })

  it('hides alert action buttons from a viewer', async () => {
    await open('/alerts', 'viewer01')
    expect((await screen.findAllByText('Chưa xử lý')).length).toBeGreaterThan(0)
    expect(screen.queryByRole('button', { name: 'Xác nhận đã xử lý' })).not.toBeInTheDocument()
  })
})

describe('overview alerts', () => {
  const door = 'Cửa kho bị mở ngoài giờ giới nghiêm'
  function alert(alert_id: number, severity: Severity, alert_message: string): Alert {
    return {
      alert_id,
      device_id: 2,
      device_code: 'NODE2_SEC',
      alert_type: severity === 'CRITICAL' ? 'DOOR_BREACH' : 'MOTION_INTRUSION',
      severity,
      alert_message,
      is_acknowledged: false,
      resolved_by_user_id: null,
      resolved_by_username: null,
      created_at: '2026-10-13T21:40:00+07:00',
      resolved_at: null,
    }
  }
  async function openOverview(alerts: Alert[]) {
    const load = api.dashboard
    vi.spyOn(api, 'dashboard').mockImplementation(async (token) => ({
      ...(await load.call(api, token)),
      alerts,
    }))
    await open('/')
    await screen.findByRole('heading', { name: 'Tổng quan', level: 1 })
    const banner = screen
      .getAllByRole('alert')
      .find((node) => node.textContent?.includes('CRITICAL ·'))!
    const list = screen.getByRole('heading', { name: 'Cảnh báo đang mở' }).closest('section')!
    return { banner, list }
  }

  it('lists only the alerts the banner does not show and counts them in the banner', async () => {
    const { banner, list } = await openOverview([
      alert(10, 'CRITICAL', door),
      alert(9, 'WARNING', 'Chuyển động lúc 21:39'),
      alert(8, 'WARNING', 'Chuyển động lúc 21:38'),
      { ...alert(7, 'WARNING', 'Chuyển động đã xử lý'), is_acknowledged: true },
    ])
    expect(banner).toHaveTextContent(door)
    expect(banner).toHaveTextContent('Còn 2 cảnh báo đang mở khác.')
    expect(within(banner).getByRole('link', { name: 'Xem tất cả cảnh báo' })).toHaveAttribute(
      'href',
      '/alerts',
    )
    expect(within(list).queryByText(door)).not.toBeInTheDocument()
    expect(within(list).getByText('Chuyển động lúc 21:39')).toBeVisible()
    expect(within(list).getByText('Chuyển động lúc 21:38')).toBeVisible()
    expect(within(list).queryByText('Chuyển động đã xử lý')).not.toBeInTheDocument()
  })

  it('drops the count and says so in the list when the banner holds the only open alert', async () => {
    const { banner, list } = await openOverview([alert(10, 'CRITICAL', door)])
    expect(banner).toHaveTextContent(door)
    expect(banner).not.toHaveTextContent('cảnh báo đang mở khác')
    expect(within(banner).queryByRole('link')).not.toBeInTheDocument()
    expect(within(list).queryByText(door)).not.toBeInTheDocument()
    expect(within(list).getByText('Không có cảnh báo nào khác.')).toBeVisible()
  })
})

describe('overview device scope', () => {
  it('follows the device picker of each kind', async () => {
    const user = userEvent.setup()
    await open('/')
    const env = await screen.findByLabelText('Thiết bị môi trường')
    const sec = screen.getByLabelText('Thiết bị an ninh')
    expect(env).toHaveDisplayValue(/NODE1_ENV/)
    expect(sec).toHaveDisplayValue(/NODE2_SEC/)

    await user.selectOptions(env, '3')
    expect((await screen.findAllByText('Chưa có dữ liệu')).length).toBeGreaterThan(0)

    await user.selectOptions(sec, '4')
    expect(screen.getByText('BUZZER_OFF · NODE4_SEC')).toBeVisible()
    expect(screen.getByRole('button', { name: 'Tắt còi' })).toBeDisabled()
  })
})

describe('device commands and their history', () => {
  it('shows the ten newest commands on a device page and links to the filtered history', async () => {
    const user = userEvent.setup()
    await open('/devices/1')
    await screen.findByRole('heading', { name: 'Node 1 · Môi trường', level: 1 })
    const base = useDashboard.getState().data!.commands.find((item) => item.device_id === 1)!
    act(() => {
      for (let minute = 1; minute <= 12; minute++)
        useDashboard.getState().applyEvent({
          type: 'command_status',
          data: {
            ...base,
            command_id: 1000 + minute,
            command_type: 'FAN_ON',
            status: 'ACKNOWLEDGED',
            user_id: null,
            username: null,
            sent_at: `2026-11-09T07:${String(minute).padStart(2, '0')}:00+07:00`,
          },
        })
    })
    const table = screen.getByRole('region', { name: 'Lệnh điều khiển' })
    expect(within(table).getAllByRole('row')).toHaveLength(11)
    expect(within(table).getByText(/07:12:00/)).toBeVisible()
    expect(within(table).getByText(/07:03:00/)).toBeVisible()
    expect(within(table).queryByText(/07:02:00/)).not.toBeInTheDocument()

    const history = vi.spyOn(api, 'history')
    await user.click(screen.getByRole('link', { name: 'Xem tất cả trong Lịch sử' }))
    expect(await screen.findByRole('heading', { name: 'Lịch sử', level: 1 })).toBeVisible()
    expect(screen.getByRole('link', { name: 'Lệnh điều khiển' })).toHaveAttribute(
      'aria-current',
      'page',
    )
    expect(screen.getByLabelText('Thiết bị')).toHaveDisplayValue('NODE1_ENV')
    expect(history).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ tab: 'commands', deviceId: 1 }),
    )
  })

  it('ignores a device in the history link that does not exist', async () => {
    const history = vi.spyOn(api, 'history')
    await open('/history?tab=commands&device=999')
    expect(await screen.findByLabelText('Thiết bị')).toHaveDisplayValue('Tất cả thiết bị')
    await waitFor(() =>
      expect(history).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({ tab: 'commands', deviceId: undefined }),
      ),
    )
  })
})

describe('history sensor table', () => {
  function reading(telemetry_id: number, device_id: number, values: Partial<Telemetry>): Telemetry {
    return {
      telemetry_id,
      device_id,
      device_code: device_id === 1 ? 'NODE1_ENV' : 'NODE2_SEC',
      temperature: null,
      humidity: null,
      smoke_gas_level: null,
      door_status: null,
      motion_detected: null,
      recorded_at: '2026-11-09T07:00:00+07:00',
      ...values,
    }
  }
  const rows = [
    reading(2, 2, { door_status: true, motion_detected: true }),
    reading(1, 1, { temperature: 32, humidity: 70, smoke_gas_level: 350 }),
  ]
  const headers = () =>
    within(screen.getByRole('region', { name: 'Dữ liệu cảm biến' }))
      .getAllByRole('columnheader')
      .map((header) => header.textContent)

  it('shows each row its own readings in one column across devices', async () => {
    vi.spyOn(api, 'history').mockResolvedValue({ tab: 'telemetry', rows })
    await open('/history')
    const table = await screen.findByRole('region', { name: 'Dữ liệu cảm biến' })
    expect(await within(table).findByText('NODE1_ENV')).toBeVisible()
    expect(headers()).toEqual(['Thời gian', 'Thiết bị', 'Giá trị'])
    const [, security, environment] = within(table).getAllByRole('row')
    expect(environment).toHaveTextContent('32,0 °C · 70,0 % · 350 ppm')
    expect(security).toHaveTextContent('Cửa mở · Có chuyển động')
    expect(within(environment).getByText('70,0 %')).toHaveClass('warning')
    expect(within(security).getByText('Cửa mở')).toHaveClass('critical')
  })

  it('shows only the columns the selected device reports', async () => {
    const user = userEvent.setup()
    vi.spyOn(api, 'history').mockImplementation(async (_token, query) => ({
      tab: 'telemetry',
      rows: rows.filter((row) => row.device_id === query.deviceId),
    }))
    await open('/history')
    const select = await screen.findByLabelText('Thiết bị')
    await user.selectOptions(select, 'NODE1_ENV')
    expect(await screen.findByText('32,0')).toBeVisible()
    expect(headers()).toEqual(['Thời gian', 'Thiết bị', 'Nhiệt độ (°C)', 'Độ ẩm (%)', 'Khói (ppm)'])
    await user.selectOptions(select, 'NODE2_SEC')
    expect(await screen.findByText('Mở')).toBeVisible()
    expect(headers()).toEqual(['Thời gian', 'Thiết bị', 'Cửa', 'Chuyển động'])
  })
})

// AC-6: failure is visible and retry uses the same typed API boundary.
it('recovers a failed dashboard read when the user retries', async () => {
  const user = userEvent.setup()
  vi.spyOn(api, 'dashboard').mockRejectedValueOnce(new Error('Không kết nối được máy chủ.'))
  await open('/devices')
  expect(await screen.findByRole('alert')).toHaveTextContent('Không kết nối được máy chủ.')
  await user.click(screen.getByRole('button', { name: 'Thử lại' }))
  expect(await screen.findByRole('heading', { name: 'Thiết bị', level: 1 })).toBeVisible()
})
