import { act, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { api } from './services/api'
import App from './App'
import { useAuth } from './store/auth'
import { useDashboard } from './store/dashboard'

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

// AC-6: failure is visible and retry uses the same typed API boundary.
it('recovers a failed dashboard read when the user retries', async () => {
  const user = userEvent.setup()
  vi.spyOn(api, 'dashboard').mockRejectedValueOnce(new Error('Không kết nối được máy chủ.'))
  await open('/devices')
  expect(await screen.findByRole('alert')).toHaveTextContent('Không kết nối được máy chủ.')
  await user.click(screen.getByRole('button', { name: 'Thử lại' }))
  expect(await screen.findByRole('heading', { name: 'Thiết bị', level: 1 })).toBeVisible()
})
