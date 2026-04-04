import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, ReferenceLine, Legend
} from 'recharts'
import { formatTime } from '../utils/helpers'
import styles from './LiveChart.module.css'

const SENSORS = [
  { key: 'ph',          color: '#00e8c8', label: 'pH',          yAxisId: 'ph'   },
  { key: 'turbidity',   color: '#7c9ef5', label: 'Turbidity',   yAxisId: 'turb' },
  { key: 'temperature', color: '#f5a623', label: 'Temp (°C)',   yAxisId: 'temp' },
]

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null
  return (
    <div className={styles.tooltip}>
      <div className={styles.tooltipTime}>{label}</div>
      {payload.map(p => (
        <div key={p.dataKey} className={styles.tooltipRow}>
          <span className={styles.tooltipDot} style={{ background: p.color }} />
          <span className={styles.tooltipLabel}>{p.name}</span>
          <span className={styles.tooltipValue} style={{ color: p.color }}>
            {typeof p.value === 'number' ? p.value.toFixed(2) : p.value}
          </span>
        </div>
      ))}
    </div>
  )
}

export default function LiveChart({ data, activeKeys, onToggle }) {
  const chartData = data.map(d => ({
    time:        formatTime(d.timestamp),
    ph:          d.ph,
    turbidity:   d.turbidity,
    temperature: d.temperature,
  }))

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <span className={styles.title}>Live Sensor Readings</span>
        <div className={styles.toggles}>
          {SENSORS.map(s => (
            <button
              key={s.key}
              className={`${styles.toggle} ${activeKeys.includes(s.key) ? styles.toggleActive : ''}`}
              style={activeKeys.includes(s.key) ? { '--c': s.color } : {}}
              onClick={() => onToggle(s.key)}
            >
              <span className={styles.toggleDot} style={{ background: activeKeys.includes(s.key) ? s.color : 'var(--text-muted)' }} />
              {s.label}
            </button>
          ))}
        </div>
      </div>

      {data.length === 0 ? (
        <div className={styles.empty}>
          <span className={styles.emptyIcon}>◌</span>
          <p>Waiting for sensor data…</p>
          <p className={styles.emptyHint}>Start the simulator or connect IoT sensors</p>
        </div>
      ) : (
        <ResponsiveContainer width="100%" height={240}>
          <LineChart data={chartData} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,232,200,0.06)" />
            <XAxis
              dataKey="time"
              tick={{ fill: 'var(--text-muted)', fontSize: 10, fontFamily: 'IBM Plex Mono' }}
              tickLine={false}
              axisLine={{ stroke: 'var(--border)' }}
              interval="preserveStartEnd"
            />
            {/* pH axis */}
            <YAxis
              yAxisId="ph" domain={[0, 14]}
              tick={{ fill: '#00e8c8', fontSize: 9, fontFamily: 'IBM Plex Mono' }}
              tickLine={false} axisLine={false} width={28}
            />
            {/* Turbidity axis */}
            <YAxis
              yAxisId="turb" orientation="right" domain={[0, 20]}
              tick={{ fill: '#7c9ef5', fontSize: 9, fontFamily: 'IBM Plex Mono' }}
              tickLine={false} axisLine={false} width={28}
            />
            {/* Temperature axis (hidden, shares right side) */}
            <YAxis yAxisId="temp" hide domain={[0, 50]} />

            <Tooltip content={<CustomTooltip />} />

            {/* WHO safe band for pH */}
            {activeKeys.includes('ph') && (
              <>
                <ReferenceLine yAxisId="ph" y={6.5} stroke="#00e8c8" strokeDasharray="4 4" strokeOpacity={0.3} />
                <ReferenceLine yAxisId="ph" y={8.5} stroke="#00e8c8" strokeDasharray="4 4" strokeOpacity={0.3} />
              </>
            )}
            {/* WHO max turbidity */}
            {activeKeys.includes('turbidity') && (
              <ReferenceLine yAxisId="turb" y={4} stroke="#7c9ef5" strokeDasharray="4 4" strokeOpacity={0.3} />
            )}

            {SENSORS.map(s => activeKeys.includes(s.key) && (
              <Line
                key={s.key}
                type="monotone"
                dataKey={s.key}
                name={s.label}
                yAxisId={s.yAxisId}
                stroke={s.color}
                strokeWidth={2}
                dot={false}
                activeDot={{ r: 4, fill: s.color, stroke: 'var(--bg-card)', strokeWidth: 2 }}
                animationDuration={400}
                style={{ filter: `drop-shadow(0 0 4px ${s.color}40)` }}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      )}

      <div className={styles.footer}>
        <span className={styles.hint}>Dashed lines = WHO safe thresholds</span>
        <span className={styles.count}>{data.length} points</span>
      </div>
    </div>
  )
}
