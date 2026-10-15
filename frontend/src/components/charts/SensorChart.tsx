import {
  Area,
  AreaChart,
  CartesianGrid,
  ReferenceDot,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import type { Telemetry } from '../../services/types'
import { number, time } from '../../services/format'
import { Card } from '../common/UI'
import styles from './SensorChart.module.css'
interface Props {
  title: string
  unit: string
  sensor: string
  field: 'temperature' | 'humidity' | 'smoke_gas_level'
  color: string
  domain: [number, number]
  threshold?: number
  data: Telemetry[]
}
export function SensorChart({ title, unit, sensor, field, color, domain, threshold, data }: Props) {
  const values = data.flatMap((row) => (row[field] == null ? [] : [row[field]]))
  const min = Math.min(domain[0], ...values)
  const max = Math.max(domain[1], ...values)
  const end = data.at(-1)
  const colorVar = `var(--${color})`
  return (
    <Card>
      <div className="row between">
        <div className={styles.legend}>
          <span className={styles.line} style={{ background: colorVar }} />
          <h2>{title}</h2>
          <span className="small muted">{unit}</span>
        </div>
        <span className="mono small muted">{sensor}</span>
      </div>
      <div className={styles.chart}>
        <ResponsiveContainer width="100%" height="100%" minWidth={0}>
          <AreaChart
            data={data}
            syncId="sensors"
            margin={{ top: 18, right: 8, bottom: 0, left: -20 }}
            role="img"
            aria-label={`${title}: ${number(end?.[field], field === 'smoke_gas_level' ? 0 : 1)} ${unit}`}
            accessibilityLayer={false}
          >
            <CartesianGrid vertical={false} stroke="var(--grid)" />
            <XAxis
              dataKey="recorded_at"
              tickFormatter={time}
              ticks={[
                data[0]?.recorded_at,
                data[Math.floor(data.length / 2)]?.recorded_at,
                end?.recorded_at,
              ].filter((item): item is string => !!item)}
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
              labelFormatter={(label) => time(String(label))}
              formatter={(value) => [
                `${number(Number(value), field === 'smoke_gas_level' ? 0 : 1)} ${unit}`,
                title,
              ]}
              contentStyle={{
                background: 'var(--ink)',
                color: 'var(--surface)',
                border: 0,
                borderRadius: 'var(--r-badge)',
                fontFamily: 'var(--font-mono)',
                fontSize: 12,
              }}
              itemStyle={{ color: 'var(--surface)' }}
              cursor={{ stroke: 'var(--ink-3)' }}
            />
            {threshold !== undefined && (
              <ReferenceLine
                y={threshold}
                stroke="var(--warn-text)"
                strokeDasharray="4 4"
                label={{
                  value: `Ngưỡng ${threshold} ${unit}`,
                  position: 'insideTopLeft',
                  fill: 'var(--warn-text)',
                  fontSize: 11,
                }}
              />
            )}
            <Area
              dataKey={field}
              type="linear"
              stroke={colorVar}
              fill={colorVar}
              fillOpacity={0.1}
              strokeWidth={2}
              isAnimationActive={false}
              activeDot={{ r: 4, stroke: 'var(--surface)', strokeWidth: 2 }}
            />
            {end && end[field] != null && (
              <ReferenceDot
                x={end.recorded_at}
                y={end[field]}
                r={4}
                fill={colorVar}
                stroke="var(--surface)"
                strokeWidth={2}
              />
            )}
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </Card>
  )
}
