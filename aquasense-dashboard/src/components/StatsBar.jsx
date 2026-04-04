import styles from './StatsBar.module.css'

export default function StatsBar({ readings, predictions }) {
  if (!readings.length) return null

  const recent = readings.slice(0, 20)

  const avgPh   = (recent.reduce((s, r) => s + r.ph, 0) / recent.length).toFixed(2)
  const avgTurb = (recent.reduce((s, r) => s + r.turbidity, 0) / recent.length).toFixed(2)
  const avgTemp = (recent.reduce((s, r) => s + r.temperature, 0) / recent.length).toFixed(1)

  const warnCount = readings.filter(
    r => r.ph < 6.5 || r.ph > 8.5 || r.turbidity > 4 || r.temperature < 10 || r.temperature > 35
  ).length

  const qualityDist = {}
  predictions.forEach(p => {
    qualityDist[p.qualityClass] = (qualityDist[p.qualityClass] || 0) + 1
  })
  const topQuality = Object.entries(qualityDist).sort((a, b) => b[1] - a[1])[0]?.[0]

  const stats = [
    { label: 'Avg pH',        value: avgPh,          unit: '',    color: 'var(--teal)'  },
    { label: 'Avg Turbidity', value: avgTurb,         unit: 'NTU', color: '#7c9ef5'     },
    { label: 'Avg Temp',      value: avgTemp,         unit: '°C',  color: 'var(--amber)' },
    { label: 'Out of Range',  value: warnCount,        unit: 'pts', color: warnCount > 0 ? 'var(--red)' : 'var(--green)' },
    { label: 'Dominant Class',value: topQuality || '—', unit: '', color: 'var(--text-primary)' },
  ]

  return (
    <div className={styles.bar}>
      {stats.map(s => (
        <div key={s.label} className={styles.stat}>
          <span className={styles.label}>{s.label}</span>
          <span className={styles.value} style={{ color: s.color }}>
            {s.value}
            {s.unit && <span className={styles.unit}> {s.unit}</span>}
          </span>
        </div>
      ))}
    </div>
  )
}
