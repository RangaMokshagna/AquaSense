import { formatRelative } from '../utils/helpers'
import styles from './AlertPanel.module.css'

const ICONS = {
  ph_low: '⬇', ph_high: '⬆',
  turbidity_high: '💧', temp_high: '🌡', temp_low: '❄',
  quality_poor: '⚠', quality_unsafe: '☣',
}

export default function AlertPanel({ alerts, onResolve, onResolveAll, deviceId }) {
  const active = alerts.filter(a => !a.resolved)

  return (
    <div className={`${styles.panel} ${active.length > 0 ? styles.hasAlerts : ''}`}>
      <div className={styles.header}>
        <div className={styles.titleRow}>
          <span className={styles.title}>Alerts</span>
          {active.length > 0 && (
            <span className={styles.count}>{active.length}</span>
          )}
        </div>
        {active.length > 0 && deviceId && (
          <button className={styles.resolveAll} onClick={() => onResolveAll(deviceId)}>
            Clear all
          </button>
        )}
      </div>

      <div className={styles.list}>
        {alerts.length === 0 && (
          <div className={styles.empty}>
            <span className={styles.emptyIcon}>✓</span>
            <p>All clear — no active alerts</p>
          </div>
        )}
        {alerts.slice(0, 8).map((alert, i) => (
          <div
            key={alert._id || i}
            className={`${styles.alert} ${styles[alert.severity]} ${alert.resolved ? styles.resolved : ''}`}
          >
            <span className={styles.alertIcon}>
              {ICONS[alert.type] || '⚠'}
            </span>
            <div className={styles.alertBody}>
              <p className={styles.alertMsg}>{alert.message}</p>
              <div className={styles.alertMeta}>
                <span className={styles.alertDevice}>{alert.deviceId}</span>
                <span className={styles.alertTime}>{formatRelative(alert.timestamp)}</span>
              </div>
            </div>
            {!alert.resolved && onResolve && (
              <button
                className={styles.resolve}
                onClick={() => onResolve(alert._id)}
                title="Resolve"
              >
                ✕
              </button>
            )}
            {alert.resolved && (
              <span className={styles.resolvedBadge}>resolved</span>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
