import {
  Area,
  CartesianGrid,
  ComposedChart,
  Line,
  ReferenceDot,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { number, time } from '@/services/format'
import {
  bucketTelemetry,
  type Bucket,
  type SensorField,
  type TimeWindow,
} from '@/services/telemetryBuckets'
import type { Telemetry } from '@/services/types'

interface Props {
  title: string
  unit: string
  sensor: string
  field: SensorField
  color: string
  domain: [number, number]
  threshold?: number
  data: Telemetry[]
  period: TimeWindow
}

export function SensorChart({
  title,
  unit,
  sensor,
  field,
  color,
  domain,
  threshold,
  data,
  period,
}: Props) {
  const digits = field === 'smoke_gas_level' ? 0 : 1
  const buckets = bucketTelemetry(data, field, period)
  const min = Math.min(domain[0], ...buckets.map((bucket) => bucket.min))
  const max = Math.max(domain[1], ...buckets.map((bucket) => bucket.max))
  const last = buckets.at(-1)
  return (
    <Card className="gap-3 py-4 shadow-none">
      <CardHeader className="px-4">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <span className="h-0.5 w-3 rounded-full" style={{ background: color }} />
          <h2 className="text-sm font-semibold">{title}</h2>
          <span className="text-xs text-muted-foreground">{unit}</span>
          {threshold !== undefined && (
            <span className="rounded-full border border-dashed border-amber-300 bg-amber-50 px-2 py-0.5 font-mono text-[10px] text-amber-800">
              Ngưỡng {threshold} {unit}
            </span>
          )}
          <span className="ml-auto font-mono text-[11px] text-muted-foreground">{sensor}</span>
        </div>
      </CardHeader>
      <CardContent className="px-2">
        <div className="h-52 w-full">
          <ResponsiveContainer width="100%" height="100%" minWidth={0}>
            <ComposedChart
              data={buckets}
              syncId="sensors"
              syncMethod="value"
              margin={{ top: 12, right: 12, bottom: 0, left: -18 }}
              role="img"
              aria-label={`${title}: ${number(data.at(-1)?.[field], digits)} ${unit}`}
              accessibilityLayer={false}
            >
              <CartesianGrid vertical={false} stroke="var(--color-border)" />
              <XAxis
                dataKey="at"
                type="number"
                domain={[period.start, period.end]}
                ticks={[period.start, (period.start + period.end) / 2, period.end]}
                tickFormatter={time}
                tickLine={false}
                axisLine={{ stroke: 'var(--color-border)' }}
                stroke="var(--color-muted-foreground)"
                tick={{ fontSize: 11 }}
                minTickGap={0}
              />
              <YAxis
                domain={[min, max]}
                ticks={[min, (min + max) / 2, max]}
                tickLine={false}
                axisLine={false}
                stroke="var(--color-muted-foreground)"
                tick={{ fontSize: 11 }}
                width={48}
              />
              <Tooltip
                cursor={{ stroke: 'var(--color-border)' }}
                content={({ active, payload }) => {
                  const bucket = payload?.[0]?.payload as Bucket | undefined
                  if (!active || !bucket) return null
                  const low = number(bucket.min, digits)
                  const high = number(bucket.max, digits)
                  return (
                    <div className="space-y-0.5 rounded-lg bg-foreground px-3 py-2 font-mono text-[11px] text-background shadow-md">
                      <div className="opacity-70">{time(bucket.at)}</div>
                      <div className="font-semibold">
                        Trung bình {number(bucket.avg, digits)} {unit}
                      </div>
                      {low !== high && (
                        <div className="opacity-80">
                          Dao động {low}–{high} {unit}
                        </div>
                      )}
                    </div>
                  )
                }}
              />
              {threshold !== undefined && (
                <ReferenceLine
                  y={threshold}
                  stroke="var(--color-warning-foreground)"
                  strokeDasharray="4 4"
                />
              )}
              <Area
                dataKey={(bucket: Bucket) => [bucket.min, bucket.max]}
                type="linear"
                stroke="none"
                fill={color}
                fillOpacity={0.18}
                isAnimationActive={false}
                activeDot={false}
              />
              <Line
                dataKey="avg"
                type="linear"
                stroke={color}
                strokeWidth={2}
                dot={false}
                isAnimationActive={false}
                activeDot={{ r: 4, stroke: 'var(--color-card)', strokeWidth: 2 }}
              />
              {last && (
                <ReferenceDot
                  x={last.at}
                  y={last.avg}
                  r={4}
                  fill={color}
                  stroke="var(--color-card)"
                  strokeWidth={2}
                />
              )}
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  )
}
