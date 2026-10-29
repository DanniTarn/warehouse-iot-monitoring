import { Link } from 'react-router-dom'
import { ShieldX } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { PageHeader } from '@/components/app/page-header'

export default function Forbidden() {
  return (
    <div className="space-y-4">
      <PageHeader title="Quyền truy cập" />
      <Card className="shadow-none">
        <CardContent className="flex flex-col items-start gap-3 pt-6">
          <span className="flex size-11 items-center justify-center rounded-full bg-destructive/10 text-destructive">
            <ShieldX className="size-5" />
          </span>
          <h2 className="text-xl font-semibold">Bạn không có quyền xem trang này</h2>
          <p className="text-sm text-muted-foreground">Trang này chỉ dành cho vai trò Admin.</p>
          <Button asChild variant="outline">
            <Link to="/">Về Tổng quan</Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}
