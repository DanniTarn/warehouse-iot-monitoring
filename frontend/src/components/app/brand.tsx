import { Warehouse } from 'lucide-react'
import { cn } from '@/lib/utils'

export function Brand({
  compact = false,
  onDark = false,
  className,
}: {
  compact?: boolean
  onDark?: boolean
  className?: string
}) {
  return (
    <div className={cn('flex items-center gap-2.5', className)}>
      <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground shadow-sm">
        <Warehouse className="size-5" />
      </span>
      {!compact && (
        <div className="min-w-0">
          <div className={cn('truncate text-sm font-semibold leading-tight', onDark && 'text-white')}>
            Giám sát kho
          </div>
          <div className={cn('truncate text-xs', onDark ? 'text-slate-400' : 'text-muted-foreground')}>
            Môi trường &amp; an ninh
          </div>
        </div>
      )}
    </div>
  )
}
