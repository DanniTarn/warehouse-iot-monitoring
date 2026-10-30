import { useEffect, useRef, useState } from 'react'
import {
  Bell,
  Cpu,
  History,
  LayoutDashboard,
  LogOut,
  Menu,
  Users,
} from 'lucide-react'
import { NavLink, Outlet, useLocation } from 'react-router-dom'
import { Brand } from '@/components/app/brand'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from '@/components/ui/sheet'
import { Skeleton } from '@/components/ui/skeleton'
import { dataSource } from '@/services/api'
import { connectRealtime } from '@/services/realtime'
import { useAuth } from '@/store/auth'
import { useDashboard } from '@/store/dashboard'
import { cn } from '@/lib/utils'

const items: { to: string; label: string; icon: typeof LayoutDashboard; admin?: boolean }[] = [
  { to: '/', label: 'Tổng quan', icon: LayoutDashboard },
  { to: '/devices', label: 'Thiết bị', icon: Cpu },
  { to: '/alerts', label: 'Cảnh báo', icon: Bell },
  { to: '/history', label: 'Lịch sử', icon: History },
  { to: '/users', label: 'Người dùng', icon: Users, admin: true },
]

function navClass({ isActive }: { isActive: boolean }) {
  return cn(
    'group flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
    isActive
      ? 'bg-accent text-accent-foreground'
      : 'text-muted-foreground hover:bg-muted hover:text-foreground',
  )
}

function Navigation({ onNavigate }: { onNavigate?: () => void }) {
  const user = useAuth((s) => s.user)
  const openAlerts = useDashboard((s) => s.data?.alerts.filter((a) => !a.is_acknowledged).length ?? 0)
  return (
    <nav aria-label="Điều hướng chính" className="flex flex-col gap-1">
      {items
        .filter((item) => !item.admin || user?.role === 'ADMIN')
        .map(({ to, label, icon: Icon }) => (
          <NavLink key={to} to={to} end={to === '/'} className={navClass} onClick={onNavigate}>
            <Icon className="size-4 shrink-0" />
            <span className="flex-1">{label}</span>
            {to === '/alerts' && openAlerts > 0 && (
              <Badge variant="secondary" className="h-5 min-w-5 justify-center px-1.5 tabular-nums">
                {openAlerts}
              </Badge>
            )}
          </NavLink>
        ))}
    </nav>
  )
}

function Account() {
  const { user, logout } = useAuth()
  const { reset } = useDashboard()
  const initials = (user?.username ?? '?').slice(0, 2).toUpperCase()
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
          {initials}
        </span>
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-medium">{user?.username}</div>
          <div className="text-xs text-muted-foreground">{user?.role}</div>
        </div>
      </div>
      <Button
        variant="outline"
        size="sm"
        className="w-full justify-start gap-2 text-muted-foreground"
        onClick={() => {
          reset()
          logout()
        }}
      >
        <LogOut className="size-4" />
        Đăng xuất
      </Button>
    </div>
  )
}

function Loading() {
  return (
    <div className="space-y-6" aria-busy="true" aria-label="Đang tải dữ liệu">
      <div className="space-y-2">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-4 w-72" />
      </div>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <Skeleton key={index} className="h-28 w-full" />
        ))}
      </div>
      <Skeleton className="h-64 w-full" />
    </div>
  )
}

export function AppShell() {
  const { user, token } = useAuth()
  const { data, loading, error, load, reset, applyEvent, setConnection } = useDashboard()
  const location = useLocation()
  const connected = useRef(false)
  const [menuOpen, setMenuOpen] = useState(false)

  useEffect(() => {
    if (token) void load(token)
    return reset
  }, [token, load, reset])

  useEffect(() => {
    if (dataSource !== 'api' || !token) return
    connected.current = false
    setConnection('reconnecting')
    return connectRealtime(token, {
      onEvent: applyEvent,
      onState: (state) => {
        setConnection(state)
        if (state !== 'live') return
        if (connected.current) void load(token)
        connected.current = true
      },
    })
  }, [token, load, applyEvent, setConnection])

  useEffect(() => {
    const titles: Record<string, string> = {
      '/': 'Tổng quan',
      '/devices': 'Thiết bị',
      '/devices/new': 'Thêm thiết bị',
      '/alerts': 'Cảnh báo',
      '/history': 'Lịch sử',
      '/users': 'Người dùng',
    }
    document.title = `${titles[location.pathname] || 'Chi tiết thiết bị'} · Giám sát kho`
  }, [location.pathname])

  return (
    <div className="min-h-svh">
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-64 flex-col border-r bg-card lg:flex">
        <div className="flex h-16 items-center px-5">
          <Brand />
        </div>
        <Separator />
        <div className="flex-1 overflow-y-auto px-3 py-4">
          <Navigation />
        </div>
        <div className="border-t p-4">
          <Account />
        </div>
      </aside>

      <div className="lg:pl-64">
        <header className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b bg-background/85 px-4 backdrop-blur lg:hidden">
          <Sheet open={menuOpen} onOpenChange={setMenuOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" aria-label="Mở điều hướng">
                <Menu className="size-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="flex w-72 flex-col p-0">
              <SheetTitle className="sr-only">Điều hướng</SheetTitle>
              <div className="flex h-16 items-center px-5">
                <Brand />
              </div>
              <Separator />
              <div className="flex-1 overflow-y-auto px-3 py-4">
                <Navigation onNavigate={() => setMenuOpen(false)} />
              </div>
              <div className="border-t p-4">
                <Account />
              </div>
            </SheetContent>
          </Sheet>
          <Brand />
          <span className="ml-auto text-sm font-medium">{user?.username}</span>
        </header>

        <main id="main" className="mx-auto w-full max-w-[1440px] px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
          {loading || (!data && !error) ? (
            <Loading />
          ) : error ? (
            <div className="space-y-4">
              <div
                role="alert"
                className="rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive"
              >
                {error}
              </div>
              <Button onClick={() => token && void load(token)}>Thử lại</Button>
            </div>
          ) : (
            <Outlet />
          )}
        </main>

        <footer className="mx-auto w-full max-w-[1440px] px-4 pb-6 text-xs text-muted-foreground sm:px-6 lg:px-8">
          {dataSource === 'api'
            ? 'Dữ liệu trực tiếp từ hệ thống.'
            : 'Bản giao diện · Dữ liệu mô phỏng'}
        </footer>
      </div>
    </div>
  )
}
