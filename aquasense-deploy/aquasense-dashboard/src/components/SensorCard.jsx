import { SENSOR_CONFIG, getSensorStatus } from '../utils/helpers'
import styles from './SensorCard.module.css'

function MiniGauge({ value, min, max, safeMin, safeMax, color }) {
  const pct = Math.max(0, Math.min(100, ((value - min) / (max - min)) * 100))
  const safeL = ((safeMin - min) / (max - min)) * 100
  const safeR = ((safeMax - min) / (max - min)) * 100

  return (
    <div className={styles.gauge}>
      <div className={styles.gaugeTrack}>
        <div
          className={styles.safeBand}
          style={{ left: `${safeL}%`, width: `${safeR - safeL}%` }}
        />
        <div
          className={styles.gaugeFill}
          style={{ width: `${pct}%`, background: color }}
        />
        <div
          className={styles.gaugeThumb}
          style={{ left: `${pct}%`, background: color, boxShadow: `0 0 8px ${color}` }}
        />
      </div>
      <div className={styles.gaugeLabels}>
        <span>{min}</span>
        <span>Safe: {safeMin}–{safeMax}</span>
        <span>{max}</span>
      </div>
    </div>
  )
}

export default function SensorCard({ sensorKey, value, prevValue, animate }) {
  const cfg    = SENSOR_CONFIG[sensorKey]
  const status = getSensorStatus(sensorKey, value)
  const isWarn = status === 'warning'
  const trend  = prevValue != null
    ? value > prevValue ? '↑' : value < prevValue ? '↓' : '→'
    : null

  return (
    <div className={`${styles.card} ${isWarn ? styles.warn : ''} ${animate ? styles.pulse : ''}`}>
      <div className={styles.topRow}>
        <div className={styles.label}>
          <span className={styles.labelText}>{cfg.label}</span>
          <span className={styles.desc}>{cfg.description}</span>
        </div>
        <div className={`${styles.badge} ${isWarn ? styles.badgeWarn : styles.badgeOk}`}>
          {isWarn ? '⚠ Out of range' : '✓ Normal'}
        </div>
      </div>

      <div className={styles.valueRow}>
        <span
          className={styles.value}
          style={{ color: isWarn ? 'var(--amber)' : cfg.color }}
        >
          {value != null ? value.toFixed(cfg.decimals) : '---'}
        </span>
        <span className={styles.unit}>{cfg.unit}</span>
        {trend && (
          <span
            className={styles.trend}
            style={{ color: trend === '↑' ? 'var(--amber)' : trend === '↓' ? 'var(--teal)' : 'var(--text-muted)' }}
          >
            {trend}
          </span>
        )}
      </div>

      {value != null && (
        <MiniGauge
          value={value}
          min={cfg.min}
          max={cfg.max}
          safeMin={cfg.safeMin}
          safeMax={cfg.safeMax}
          color={isWarn ? 'var(--amber)' : cfg.color}
        />
      )}
    </div>
  )
}
