import { ChevronLeft, ChevronRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { NativeSelect } from '@/components/app/native-select'
import { cn } from '@/lib/utils'

function pageItems(current: number, count: number): (number | 'gap')[] {
  if (count <= 7) return Array.from({ length: count }, (_, index) => index)
  const wanted = new Set([0, 1, current - 1, current, current + 1, count - 2, count - 1])
  const numbers = [...wanted].filter((item) => item >= 0 && item < count).sort((a, b) => a - b)
  const items: (number | 'gap')[] = []
  numbers.forEach((item, index) => {
    if (index > 0 && item - numbers[index - 1] > 1) items.push('gap')
    items.push(item)
  })
  return items
}

export function Pagination({
  page,
  pageSize,
  total,
  onPageChange,
  onPageSizeChange,
}: {
  page: number
  pageSize: number
  total: number
  onPageChange: (page: number) => void
  onPageSizeChange?: (size: number) => void
}) {
  const count = Math.max(1, Math.ceil(total / pageSize))
  const current = Math.min(page, count - 1)
  const from = total ? current * pageSize + 1 : 0
  const to = Math.min((current + 1) * pageSize, total)
  return (
    <div
      role="navigation"
      aria-label="Phân trang"
      className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"
    >
      <div className="flex flex-wrap items-center gap-3">
        <span className="text-xs text-muted-foreground">
          Hiển thị {from}–{to} / {total.toLocaleString('vi-VN')} bản ghi
        </span>
        {onPageSizeChange && (
          <label className="flex items-center gap-2 text-xs text-muted-foreground">
            Số dòng
            <NativeSelect
              aria-label="Số dòng mỗi trang"
              wrapperClassName="w-max"
              iconClassName="right-2 size-3.5"
              className="h-8 pl-2 pr-7 text-xs"
              value={pageSize}
              onChange={(event) => onPageSizeChange(Number(event.target.value))}
            >
              {[25, 50, 100].map((size) => (
                <option key={size} value={size}>
                  {size}
                </option>
              ))}
            </NativeSelect>
          </label>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-1">
        <Button
          variant="outline"
          size="sm"
          disabled={current === 0}
          onClick={() => onPageChange(current - 1)}
        >
          <ChevronLeft className="size-4" />
          Trước
        </Button>
        {pageItems(current, count).map((item, index) =>
          item === 'gap' ? (
            <span key={`gap-${index}`} className="px-1 text-xs text-muted-foreground">
              …
            </span>
          ) : (
            <Button
              key={item}
              size="sm"
              variant={item === current ? 'secondary' : 'ghost'}
              aria-label={`Trang ${item + 1}`}
              aria-current={item === current ? 'page' : undefined}
              className={cn('min-w-8 px-2 tabular-nums', item === current && 'font-semibold')}
              onClick={() => onPageChange(item)}
            >
              {item + 1}
            </Button>
          ),
        )}
        <Button
          variant="outline"
          size="sm"
          disabled={current >= count - 1}
          onClick={() => onPageChange(current + 1)}
        >
          Sau
          <ChevronRight className="size-4" />
        </Button>
      </div>
    </div>
  )
}
