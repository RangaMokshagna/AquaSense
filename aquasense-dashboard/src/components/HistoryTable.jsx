import { useState } from 'react'
import { formatTime, formatDate, getQualityColor, getWqiColor } from '../utils/helpers'
import styles from './HistoryTable.module.css'

export default function HistoryTable({ readings, predictions }) {
  const [page, setPage]   = useState(1)
  const perPage = 10

  // Merge readings with their predictions by readingId
  const predMap = {}
  predictions.forEach(p => { predMap[p.readingId] = p })

  const rows  = readings.slice().sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
  const total = Math.ceil(rows.length / perPage)
  const slice = rows.slice((page - 1) * perPage, page * perPage)

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <span className={styles.title}>Reading History</span>
        <span className={styles.count}>{readings.length} total</span>
      </div>

      {readings.length === 0 ? (
        <div className={styles.empty}>No historical data yet</div>
      ) : (
        <>
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Time</th>
                  <th>Device</th>
                  <th>pH</th>
                  <th>Turbidity</th>
                  <th>Temp</th>
                  <th>WQI</th>
                  <th>Quality</th>
                </tr>
              </thead>
              <tbody>
                {slice.map((r, i) => {
                  const pred = predMap[r._id]
                  const qc   = pred?.qualityClass
                  const wqi  = pred?.wqiScore
                  return (
                    <tr key={r._id || i} className={styles.row}>
                      <td>
                        <div className={styles.timeCell}>
                          <span className={styles.time}>{formatTime(r.timestamp)}</span>
                          <span className={styles.date}>{formatDate(r.timestamp)}</span>
                        </div>
                      </td>
                      <td>
                        <span className={styles.device}>{r.deviceId}</span>
                      </td>
                      <td>
                        <span
                          className={styles.value}
                          style={{ color: (r.ph < 6.5 || r.ph > 8.5) ? 'var(--amber)' : 'var(--text-primary)' }}
                        >
                          {r.ph?.toFixed(2)}
                        </span>
                      </td>
                      <td>
                        <span
                          className={styles.value}
                          style={{ color: r.turbidity > 4 ? 'var(--amber)' : 'var(--text-primary)' }}
                        >
                          {r.turbidity?.toFixed(2)} <span className={styles.unit}>NTU</span>
                        </span>
                      </td>
                      <td>
                        <span
                          className={styles.value}
                          style={{ color: (r.temperature < 10 || r.temperature > 35) ? 'var(--amber)' : 'var(--text-primary)' }}
                        >
                          {r.temperature?.toFixed(1)}°
                        </span>
                      </td>
                      <td>
                        {wqi != null ? (
                          <span className={styles.wqi} style={{ color: getWqiColor(wqi) }}>
                            {Math.round(wqi)}
                          </span>
                        ) : '—'}
                      </td>
                      <td>
                        {qc ? (
                          <span
                            className={styles.qualityPill}
                            style={{ color: getQualityColor(qc) }}
                          >
                            {qc}
                          </span>
                        ) : '—'}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          {total > 1 && (
            <div className={styles.pagination}>
              <button
                className={styles.pgBtn}
                disabled={page === 1}
                onClick={() => setPage(p => p - 1)}
              >← Prev</button>
              <span className={styles.pgInfo}>{page} / {total}</span>
              <button
                className={styles.pgBtn}
                disabled={page === total}
                onClick={() => setPage(p => p + 1)}
              >Next →</button>
            </div>
          )}
        </>
      )}
    </div>
  )
}
