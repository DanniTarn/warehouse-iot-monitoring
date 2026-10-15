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
describe('AC-3 and AC-6: login and honest prototype interactions', () => {
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
  it('does not claim to send a hardware command from this milestone', async () => {
    const user = userEvent.setup()
    await open('/devices/2')
    await user.click(await screen.findByRole('button', { name: 'Tắt còi' }))
    expect(screen.getByRole('status')).toHaveTextContent('Chưa gửi hoặc lưu thay đổi.')
    expect(screen.getAllByText('Đang kêu').length).toBeGreaterThan(0)
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

// AC-6: failure is visible and retry uses the same typed API boundary.
it('recovers a failed dashboard read when the user retries', async () => {
  const user = userEvent.setup()
  vi.spyOn(api, 'dashboard').mockRejectedValueOnce(new Error('Không kết nối được máy chủ.'))
  await open('/devices')
  expect(await screen.findByRole('alert')).toHaveTextContent('Không kết nối được máy chủ.')
  await user.click(screen.getByRole('button', { name: 'Thử lại' }))
  expect(await screen.findByRole('heading', { name: 'Thiết bị', level: 1 })).toBeVisible()
})
