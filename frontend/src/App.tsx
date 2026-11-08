import { lazy, Suspense, useEffect } from 'react'
import { Navigate, Outlet, Route, Routes } from 'react-router-dom'
import { AppShell } from '@/components/app/app-shell'
import { PageHeader } from '@/components/app/page-header'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import Login from '@/pages/Login'
import Devices from '@/pages/Devices'
import DeviceAdd from '@/pages/DeviceAdd'
import DeviceDetail from '@/pages/DeviceDetail'
import Alerts from '@/pages/Alerts'
import History from '@/pages/History'
import Users from '@/pages/Users'
import Forbidden from '@/pages/Forbidden'
import { useAuth } from '@/store/auth'
import { Link } from 'react-router-dom'

const Overview = lazy(() => import('@/pages/Overview'))

function ProtectedRoute() {
  const user = useAuth((s) => s.user)
  return user ? <Outlet /> : <Navigate to="/login" replace />
}

function AdminRoute() {
  const admin = useAuth((s) => s.user?.role === 'ADMIN')
  return admin ? <Outlet /> : <Forbidden />
}

export default function App() {
  const { ready, initialize } = useAuth()
  useEffect(() => {
    void initialize()
  }, [initialize])
  if (!ready)
    return (
      <div className="flex min-h-svh items-center justify-center text-sm text-muted-foreground">
        Đang kiểm tra phiên đăng nhập…
      </div>
    )
  return (
    <Suspense
      fallback={
        <div className="flex min-h-svh items-center justify-center text-sm text-muted-foreground">
          Đang tải giao diện…
        </div>
      }
    >
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route element={<ProtectedRoute />}>
          <Route element={<AppShell />}>
            <Route index element={<Overview />} />
            <Route path="devices" element={<Devices />} />
            <Route path="devices/:deviceId" element={<DeviceDetail />} />
            <Route path="alerts" element={<Alerts />} />
            <Route path="history" element={<History />} />
            <Route element={<AdminRoute />}>
              <Route path="devices/new" element={<DeviceAdd />} />
              <Route path="users" element={<Users />} />
            </Route>
            <Route
              path="*"
              element={
                <>
                  <PageHeader title="Không tìm thấy trang" />
                  <Card>
                    <CardContent className="space-y-4 pt-6">
                      <p className="text-sm text-muted-foreground">Đường dẫn không tồn tại.</p>
                      <Button asChild variant="outline">
                        <Link to="/">Về Tổng quan</Link>
                      </Button>
                    </CardContent>
                  </Card>
                </>
              }
            />
          </Route>
        </Route>
      </Routes>
    </Suspense>
  )
}
