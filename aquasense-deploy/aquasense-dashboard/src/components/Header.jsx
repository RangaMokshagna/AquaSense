import { formatRelative } from '../utils/helpers'
import styles from './Header.module.css'

export default function Header({ connected, lastUpdate, deviceId, onDeviceChange, devices }) {
  return (
    <header className={styles.header}>
      <div className={styles.brand}>
        <div className={styles.logo}>
          <span className={styles.logoMark}>◈</span>
          <div>
            <h1 className={styles.title}>AquaSense</h1>
            <p className={styles.subtitle}>Water Quality Monitor</p>
          </div>
        </div>
      </div>

      <div className={styles.center}>
        {devices?.length > 0 && (
          <div className={styles.deviceSelect}>
            <span className={styles.deviceLabel}>Device</span>
            <select
              value={deviceId || ''}
              onChange={e => onDeviceChange(e.target.value || null)}
              className={styles.select}
            >
              <option value="">All devices</option>
              {devices.map(d => (
                <option key={d.deviceId} value={d.deviceId}>
                  {d.label || d.deviceId}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      <div className={styles.status}>
        <div className={styles.lastUpdate}>
          {lastUpdate && (
            <span className={styles.updateTime}>
              Updated {formatRelative(lastUpdate)}
            </span>
          )}
        </div>
        <div className={`${styles.connection} ${connected ? styles.connected : styles.disconnected}`}>
          <span className={styles.dot} />
          {connected ? 'Live' : 'Offline'}
        </div>
      </div>
    </header>
  )
}
