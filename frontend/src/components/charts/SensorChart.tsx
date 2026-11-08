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
import type { Telemetry } from '../../services/types'
import {
  bucketTelemetry,
  type Bucket,
  type SensorField,
  type TimeWindow,
} from '../../services/telemetryBuckets'
import { number, time } from '../../services/format'
import { Card } from '../common/UI'
import styles from './SensorChart.module.css'
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
  const colorVar = `var(--${color})`
  return (
    <Card>
      <div className="row between">
        <div className={styles.legend}>
          <span className={styles.line} style={{ background: colorVar }} />
          <h2>{title}</h2>
          <span className="small muted">{unit}</span>
          {threshold !== undefined && (
            <span className={styles.threshold}>
              Ngưỡng {threshold} {unit}
            </span>
          )}
        </div>
        <span className="mono small muted">{sensor}</span>
      </div>
      <div className={styles.chart}>
        <ResponsiveContainer width="100%" height="100%" minWidth={0}>
          <ComposedChart
            data={buckets}
            syncId="sensors"
            syncMethod="value"
            margin={{ top: 18, right: 8, bottom: 0, left: -20 }}
            role="img"
            aria-label={`${title}: ${number(data.at(-1)?.[field], digits)} ${unit}`}
            accessibilityLayer={false}
          >
            <CartesianGrid vertical={false} stroke="var(--grid)" />
            <XAxis
              dataKey="at"
              type="number"
              domain={[period.start, period.end]}
              ticks={[period.start, (period.start + period.end) / 2, period.end]}
              tickFormatter={time}
              tickLine={false}
              axisLine={{ stroke: 'var(--axis)' }}
              stroke="var(--ink-3)"
              minTickGap={0}
            />
            <YAxis
              domain={[min, max]}
              ticks={[min, (min + max) / 2, max]}
              tickLine={false}
              axisLine={false}
              stroke="var(--ink-3)"
            />
            <Tooltip
              cursor={{ stroke: 'var(--ink-3)' }}
              content={({ active, payload }) => {
                const bucket = payload?.[0]?.payload as Bucket | undefined
                if (!active || !bucket) return null
                const low = number(bucket.min, digits)
                const high = number(bucket.max, digits)
                return (
                  <div className={styles.tooltip}>
                    <span>{time(bucket.at)}</span>
                    <strong>
                      Trung bình {number(bucket.avg, digits)} {unit}
                    </strong>
                    {low !== high && (
                      <span>
                        Dao động {low}–{high} {unit}
                      </span>
                    )}
                  </div>
                )
              }}
            />
            {threshold !== undefined && (
              <ReferenceLine y={threshold} stroke="var(--warn-text)" strokeDasharray="4 4" />
            )}
            <Area
              dataKey={(bucket: Bucket) => [bucket.min, bucket.max]}
              type="linear"
              stroke="none"
              fill={colorVar}
              fillOpacity={0.18}
              isAnimationActive={false}
              activeDot={false}
            />
            <Line
              dataKey="avg"
              type="linear"
              stroke={colorVar}
              strokeWidth={2}
              dot={false}
              isAnimationActive={false}
              activeDot={{ r: 4, stroke: 'var(--surface)', strokeWidth: 2 }}
            />
            {last && (
              <ReferenceDot
                x={last.at}
                y={last.avg}
                r={4}
                fill={colorVar}
                stroke="var(--surface)"
                strokeWidth={2}
              />
            )}
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </Card>
  )
}
