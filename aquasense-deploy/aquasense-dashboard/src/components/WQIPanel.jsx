import { getWqiColor, getQualityColor, QUALITY_CONFIG } from '../utils/helpers'
import styles from './WQIPanel.module.css'

function RingGauge({ score, qualityClass }) {
  const r = 54
  const circ = 2 * Math.PI * r
  const pct  = (score || 0) / 100
  const dash = pct * circ
  const color = getWqiColor(score || 0)

  return (
    <svg viewBox="0 0 128 128" className={styles.ring}>
      {/* Track */}
      <circle cx="64" cy="64" r={r} fill="none" stroke="var(--bg-deep)" strokeWidth="10" />
      {/* Colored arc */}
      <circle
        cx="64" cy="64" r={r}
        fill="none"
        stroke={color}
        strokeWidth="10"
        strokeLinecap="round"
        strokeDasharray={`${dash} ${circ}`}
        strokeDashoffset={circ * 0.25}
        style={{
          filter: `drop-shadow(0 0 6px ${color})`,
          transition: 'stroke-dasharray 1s cubic-bezier(0.4,0,0.2,1)',
        }}
        transform="rotate(-90 64 64)"
      />
      {/* Score text */}
      <text x="64" y="60" textAnchor="middle" className={styles.scoreText} fill={color}>
        {score != null ? Math.round(score) : '--'}
      </text>
      <text x="64" y="76" textAnchor="middle" className={styles.scoreLabel} fill="var(--text-muted)">
        WQI
      </text>
    </svg>
  )
}

export default function WQIPanel({ prediction, readingCount }) {
  const cls   = prediction?.qualityClass
  const score = prediction?.wqiScore
  const cfg   = QUALITY_CONFIG[cls]

  return (
    <div className={styles.panel} style={cfg ? { borderColor: cfg.border } : {}}>
      <div className={styles.header}>
        <span className={styles.title}>Water Quality Index</span>
        {prediction?.modelVersion && (
          <span className={styles.modelBadge}>
            {prediction.modelVersion === 'fallback' ? '⚠ fallback' : `ML v${prediction.modelVersion}`}
          </span>
        )}
      </div>

      <div className={styles.body}>
        <div className={styles.gaugeWrap}>
          <RingGauge score={score} qualityClass={cls} />
        </div>

        <div className={styles.info}>
          {cls ? (
            <>
              <div
                className={styles.qualityBadge}
                style={cfg ? { color: cfg.color, background: cfg.bg, borderColor: cfg.border } : {}}
              >
                {cls}
              </div>
              {prediction?.confidence != null && (
                <div className={styles.confidence}>
                  <span className={styles.confLabel}>Confidence</span>
                  <span className={styles.confValue}>
                    {(prediction.confidence * 100).toFixed(1)}%
                  </span>
                </div>
              )}
            </>
          ) : (
            <div className={styles.noData}>Waiting for data…</div>
          )}

          <div className={styles.stats}>
            <div className={styles.stat}>
              <span className={styles.statValue}>{readingCount ?? '—'}</span>
              <span className={styles.statLabel}>readings</span>
            </div>
          </div>
        </div>
      </div>

      {/* Quality scale */}
      <div className={styles.scale}>
        {Object.entries(QUALITY_CONFIG).reverse().map(([name, c]) => (
          <div
            key={name}
            className={`${styles.scaleItem} ${cls === name ? styles.scaleActive : ''}`}
            style={{ '--c': c.color }}
          >
            <div className={styles.scaleDot} style={{ background: c.color }} />
            <span>{name}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
