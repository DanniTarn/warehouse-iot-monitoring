import { ActionLink, Badge, Card, PageHeader } from '../components/common/UI'
export default function Forbidden() {
  return (
    <>
      <PageHeader title="Quyền truy cập" />
      <Card>
        <Badge tone="critical">403</Badge>
        <h2>Bạn không có quyền xem trang này</h2>
        <p className="secondary">Trang này chỉ dành cho vai trò Admin.</p>
        <div>
          <ActionLink to="/">Về Tổng quan</ActionLink>
        </div>
      </Card>
    </>
  )
}
