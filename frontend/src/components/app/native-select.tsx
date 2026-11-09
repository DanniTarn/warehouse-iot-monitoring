import type { ComponentProps } from 'react'
import { ChevronDown } from 'lucide-react'
import { cn } from '@/lib/utils'

export function NativeSelect({
  className,
  wrapperClassName,
  iconClassName,
  children,
  ...props
}: ComponentProps<'select'> & { wrapperClassName?: string; iconClassName?: string }) {
  return (
    <div className={cn('relative w-full', wrapperClassName)}>
      <select
        className={cn(
          'h-9 w-full appearance-none rounded-md border border-input bg-transparent px-3 pr-9 text-sm shadow-xs outline-none transition-colors focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50',
          className,
        )}
        {...props}
      >
        {children}
      </select>
      <ChevronDown
        aria-hidden
        className={cn(
          'pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground',
          iconClassName,
        )}
      />
    </div>
  )
}
