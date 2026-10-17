import { lazy, Suspense, useEffect } from 'react'
import { Navigate, Outlet, Route, Routes } from 'react-router-dom'
import { useAuth } from './store/auth'
import { AppShell } from './components/common/AppShell'
import { ActionLink, Card, Notice, PageHeader } from './components/common/UI'
import Login from './pages/Login'
import Devices from './pages/Devices'
import DeviceAdd from './pages/DeviceAdd'
import DeviceDetail from './pages/DeviceDetail'
import Alerts from './pages/Alerts'
import History from './pages/History'
import Users from './pages/Users'
import Forbidden from './pages/Forbidden'
const Overview = lazy(() => import('./pages/Overview'))
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
  if (!ready) return <Notice>Đang kiểm tra phiên đăng nhập…</Notice>
  return (
    <Suspense fallback={<Notice>Đang tải giao diện…</Notice>}>
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
                    <p>Đường dẫn không tồn tại.</p>
                    <div>
                      <ActionLink to="/">Về Tổng quan</ActionLink>
                    </div>
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
