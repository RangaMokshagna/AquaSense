import { useState, useRef } from 'react'
import {
  PieChart, Pie, Cell, Tooltip, ResponsiveContainer,
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  ScatterChart, Scatter, Legend,
} from 'recharts'
import { getQualityColor, getWqiColor, QUALITY_CONFIG } from '../utils/helpers'
import api from '../services/api'
import styles from './DatasetPredict.module.css'

const SAMPLE_CSV = `ph,turbidity,temperature
7.2,1.5,24.0
6.8,8.5,28.0
5.2,22.0,34.0
7.0,0.3,22.0
9.1,15.0,31.0
4.5,35.0,38.0
7.4,2.1,25.0
6.2,6.8,30.0
8.1,1.2,23.0
5.8,12.0,32.0
7.6,0.8,21.0
4.2,28.0,37.0
7.1,1.9,24.5
6.5,4.5,27.0
8.8,9.0,29.0
3.9,42.0,40.0
7.3,0.5,22.5
6.9,3.2,26.0
8.5,2.8,23.5
5.5,18.0,33.0`

const CLASS_COLORS = {
  Excellent: '#00e8c8', Good: '#39d98a',
  Poor: '#f5a623', 'Very Poor': '#ff8c42', Unsafe: '#ff4d6d',
}
const CLASS_ORDER = ['Excellent', 'Good', 'Poor', 'Very Poor', 'Unsafe']

// ── Custom tooltip for charts ──────────────────────────
const ChartTooltip = ({ active, payload }) => {
  if (!active || !payload?.length) return null
  return (
    <div style={{
      background: 'var(--bg-panel)', border: '1px solid var(--border-hover)',
      borderRadius: '8px', padding: '10px 14px',
      fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--text-primary)'
    }}>
      {payload.map((p, i) => (
        <div key={i} style={{ color: p.color || p.fill, marginBottom: 2 }}>
          {p.name}: <strong>{typeof p.value === 'number' ? p.value.toFixed(2) : p.value}</strong>
        </div>
      ))}
    </div>
  )
}

// ── Visualization section ──────────────────────────────
function Visualizations({ results }) {
  const [activeViz, setActiveViz] = useState('pie')

  // Pie — quality distribution
  const classCounts = CLASS_ORDER.map(cls => ({
    name: cls,
    value: results.filter(r => r.prediction?.qualityClass === cls).length,
    color: CLASS_COLORS[cls],
  })).filter(d => d.value > 0)

  // Bar — WQI distribution in buckets
  const wqiBuckets = [
    { range: '0–24',   label: 'Unsafe',    count: 0, color: '#ff4d6d' },
    { range: '25–49',  label: 'Very Poor', count: 0, color: '#ff8c42' },
    { range: '50–69',  label: 'Poor',      count: 0, color: '#f5a623' },
    { range: '70–89',  label: 'Good',      count: 0, color: '#39d98a' },
    { range: '90–100', label: 'Excellent', count: 0, color: '#00e8c8' },
  ]
  results.forEach(r => {
    const w = r.prediction?.wqiScore || 0
    if (w <= 24)      wqiBuckets[0].count++
    else if (w <= 49) wqiBuckets[1].count++
    else if (w <= 69) wqiBuckets[2].count++
    else if (w <= 89) wqiBuckets[3].count++
    else              wqiBuckets[4].count++
  })

  // Scatter — pH vs Turbidity colored by quality
  const scatterData = results.map(r => ({
    ph: r.ph, turbidity: r.turbidity, temperature: r.temperature,
    quality: r.prediction?.qualityClass || 'Unknown',
    wqi: r.prediction?.wqiScore || 0,
  }))

  // Bar — avg WQI per quality class
  const avgWqiByClass = CLASS_ORDER.map(cls => {
    const matching = results.filter(r => r.prediction?.qualityClass === cls)
    const avg = matching.length ? matching.reduce((s, r) => s + (r.prediction?.wqiScore || 0), 0) / matching.length : 0
    return { name: cls, avgWqi: parseFloat(avg.toFixed(1)), count: matching.length, color: CLASS_COLORS[cls] }
  }).filter(d => d.count > 0)

  const vizTabs = [
    { id: 'pie',     label: 'Quality Distribution' },
    { id: 'wqi',     label: 'WQI Spread' },
    { id: 'scatter', label: 'pH vs Turbidity' },
    { id: 'avg',     label: 'Avg WQI by Class' },
  ]

  return (
    <div className={styles.vizSection}>
      <div className={styles.vizHeader}>
        <span className={styles.vizTitle}>Dataset Visualizations</span>
        <div className={styles.vizTabs}>
          {vizTabs.map(t => (
            <button
              key={t.id}
              className={`${styles.vizTab} ${activeViz === t.id ? styles.vizTabActive : ''}`}
              onClick={() => setActiveViz(t.id)}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      <div className={styles.vizChart}>
        {/* Pie chart */}
        {activeViz === 'pie' && (
          <div className={styles.pieWrap}>
            <ResponsiveContainer width="60%" height={240}>
              <PieChart>
                <Pie data={classCounts} cx="50%" cy="50%" outerRadius={90}
                  dataKey="value" nameKey="name" label={({ name, percent }) =>
                    `${name} ${(percent * 100).toFixed(0)}%`}
                  labelLine={false}
                >
                  {classCounts.map((d, i) => <Cell key={i} fill={d.color} />)}
                </Pie>
                <Tooltip content={<ChartTooltip />} />
              </PieChart>
            </ResponsiveContainer>
            <div className={styles.pieLegend}>
              {classCounts.map(d => (
                <div key={d.name} className={styles.legendItem}>
                  <span className={styles.legendDot} style={{ background: d.color }} />
                  <span className={styles.legendName}>{d.name}</span>
                  <span className={styles.legendVal}>{d.value}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* WQI bar chart */}
        {activeViz === 'wqi' && (
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={wqiBuckets} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,232,200,0.06)" />
              <XAxis dataKey="range" tick={{ fill: 'var(--text-muted)', fontSize: 10, fontFamily: 'var(--font-mono)' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: 'var(--text-muted)', fontSize: 10, fontFamily: 'var(--font-mono)' }} axisLine={false} tickLine={false} />
              <Tooltip content={<ChartTooltip />} />
              <Bar dataKey="count" name="Rows" radius={[4, 4, 0, 0]}>
                {wqiBuckets.map((d, i) => <Cell key={i} fill={d.color} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        )}

        {/* Scatter pH vs turbidity */}
        {activeViz === 'scatter' && (
          <div>
            <ResponsiveContainer width="100%" height={240}>
              <ScatterChart margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,232,200,0.06)" />
                <XAxis dataKey="ph" name="pH" type="number" domain={[0, 14]}
                  tick={{ fill: 'var(--text-muted)', fontSize: 10, fontFamily: 'var(--font-mono)' }}
                  axisLine={false} tickLine={false} label={{ value: 'pH', position: 'insideBottom', offset: -2, fill: 'var(--text-muted)', fontSize: 10 }}
                />
                <YAxis dataKey="turbidity" name="Turbidity"
                  tick={{ fill: 'var(--text-muted)', fontSize: 10, fontFamily: 'var(--font-mono)' }}
                  axisLine={false} tickLine={false}
                />
                <Tooltip content={({ active, payload }) => {
                  if (!active || !payload?.length) return null
                  const d = payload[0]?.payload
                  return (
                    <div style={{ background: 'var(--bg-panel)', border: '1px solid var(--border-hover)', borderRadius: 8, padding: '10px 14px', fontFamily: 'var(--font-mono)', fontSize: 11 }}>
                      <div style={{ color: CLASS_COLORS[d?.quality] || 'var(--text-primary)', fontWeight: 600, marginBottom: 4 }}>{d?.quality}</div>
                      <div style={{ color: 'var(--text-secondary)' }}>pH: {d?.ph}</div>
                      <div style={{ color: 'var(--text-secondary)' }}>Turbidity: {d?.turbidity} NTU</div>
                      <div style={{ color: 'var(--text-secondary)' }}>Temp: {d?.temperature}°C</div>
                      <div style={{ color: getWqiColor(d?.wqi) }}>WQI: {Math.round(d?.wqi)}</div>
                    </div>
                  )
                }} />
                {CLASS_ORDER.map(cls => {
                  const pts = scatterData.filter(d => d.quality === cls)
                  return pts.length > 0 ? (
                    <Scatter key={cls} name={cls} data={pts}
                      fill={CLASS_COLORS[cls]} opacity={0.8} />
                  ) : null
                })}
                <Legend formatter={v => <span style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: CLASS_COLORS[v] }}>{v}</span>} />
              </ScatterChart>
            </ResponsiveContainer>
            <p style={{ textAlign: 'center', fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--text-muted)', marginTop: 4 }}>
              Each dot = one row — color shows predicted quality class
            </p>
          </div>
        )}

        {/* Avg WQI by class */}
        {activeViz === 'avg' && (
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={avgWqiByClass} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,232,200,0.06)" />
              <XAxis dataKey="name" tick={{ fill: 'var(--text-muted)', fontSize: 10, fontFamily: 'var(--font-mono)' }} axisLine={false} tickLine={false} />
              <YAxis domain={[0, 100]} tick={{ fill: 'var(--text-muted)', fontSize: 10, fontFamily: 'var(--font-mono)' }} axisLine={false} tickLine={false} />
              <Tooltip content={<ChartTooltip />} />
              <Bar dataKey="avgWqi" name="Avg WQI" radius={[4, 4, 0, 0]}>
                {avgWqiByClass.map((d, i) => <Cell key={i} fill={d.color} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  )
}

// ── Main component ─────────────────────────────────────
export default function DatasetPredict() {
  const [rows,     setRows]     = useState([])
  const [results,  setResults]  = useState([])
  const [loading,  setLoading]  = useState(false)
  const [error,    setError]    = useState(null)
  const [fileName, setFileName] = useState(null)
  const [stats,    setStats]    = useState(null)
  const fileRef = useRef()

  const round = (n, d) => parseFloat(n.toFixed(d))

  const parseCSV = (text) => {
    const lines = text.trim().split('\n').filter(l => l.trim())
    if (lines.length < 2) throw new Error('CSV needs a header + at least 1 data row')
    const headers = lines[0].split(',').map(h => h.trim().toLowerCase())
    const phIdx   = headers.findIndex(h => h === 'ph')
    const turbIdx = headers.findIndex(h => h.includes('turb'))
    const tempIdx = headers.findIndex(h => h.includes('temp'))
    if (phIdx < 0 || turbIdx < 0 || tempIdx < 0)
      throw new Error(`Required columns: ph, turbidity, temperature\nFound: ${headers.join(', ')}`)
    const parsed = []
    for (let i = 1; i < lines.length; i++) {
      const cols = lines[i].split(',').map(c => c.trim())
      const ph   = parseFloat(cols[phIdx])
      const turb = parseFloat(cols[turbIdx])
      const temp = parseFloat(cols[tempIdx])
      if (isNaN(ph) || isNaN(turb) || isNaN(temp)) continue
      parsed.push({ ph: round(ph,2), turbidity: round(turb,2), temperature: round(temp,1) })
    }
    if (!parsed.length) throw new Error('No valid rows found in CSV')
    return parsed
  }

  const handleFile = (e) => {
    const file = e.target.files[0]
    if (!file) return
    setFileName(file.name); setResults([]); setError(null); setStats(null)
    const reader = new FileReader()
    reader.onload = ev => { try { setRows(parseCSV(ev.target.result)) } catch(err) { setError(err.message); setRows([]) } }
    reader.readAsText(file)
  }

  const handleDrop = (e) => {
    e.preventDefault()
    const file = e.dataTransfer.files[0]
    if (file?.name.endsWith('.csv')) handleFile({ target: { files: [file] } })
  }

  const loadSample = () => {
    try { setRows(parseCSV(SAMPLE_CSV)); setFileName('sample_data.csv'); setResults([]); setError(null); setStats(null) }
    catch(e) { setError(e.message) }
  }

  const handlePredict = async () => {
    if (!rows.length) return
    setLoading(true); setError(null)
    try {
      const BATCH = 50
      const allPreds = []
      for (let i = 0; i < rows.length; i += BATCH) {
        const batch = rows.slice(i, i + BATCH)
        const { data } = await api.post('/predictions/batch-manual', {
          readings: batch.map(r => ({ ph: r.ph, turbidity: r.turbidity, temperature: r.temperature }))
        }).catch(async () => {
          const preds = []
          for (const r of batch) {
            const res = await api.post('/readings', { deviceId: 'dataset-upload', ph: r.ph, turbidity: r.turbidity, temperature: r.temperature, source: 'manual' })
            preds.push(res.data.prediction)
          }
          return { data: { predictions: preds } }
        })
        allPreds.push(...(data.predictions || []))
      }
      const combined = rows.map((r, i) => ({ ...r, prediction: allPreds[i] || null }))
      setResults(combined)
      const classCounts = {}
      let totalWqi = 0
      combined.forEach(r => {
        const cls = r.prediction?.qualityClass || 'Unknown'
        classCounts[cls] = (classCounts[cls] || 0) + 1
        totalWqi += r.prediction?.wqiScore || 0
      })
      setStats({ total: combined.length, avgWqi: (totalWqi / combined.length).toFixed(1), classes: classCounts })
    } catch(err) { setError(err.response?.data?.message || err.message || 'Prediction failed') }
    finally { setLoading(false) }
  }

  const downloadResults = () => {
    if (!results.length) return
    const csv = ['row,ph,turbidity,temperature,quality_class,wqi_score,confidence',
      ...results.map((r,i) => `${i+1},${r.ph},${r.turbidity},${r.temperature},${r.prediction?.qualityClass||''},${r.prediction?.wqiScore||''},${r.prediction?.confidence!=null?(r.prediction.confidence*100).toFixed(1)+'%':''}`)
    ].join('\n')
    const a = document.createElement('a')
    a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }))
    a.download = 'aquasense_predictions.csv'; a.click()
  }

  return (
    <div className={styles.page}>
      {/* ── Top: Upload + Stats ───────────────────────── */}
      <div className={styles.topRow}>
        {/* Upload card */}
        <div className={styles.card}>
          <div className={styles.cardTitle}>Upload Dataset</div>
          <p className={styles.cardSub}>CSV with ph, turbidity, temperature columns</p>

          <div className={styles.dropzone} onDrop={handleDrop}
            onDragOver={e => e.preventDefault()} onClick={() => fileRef.current.click()}>
            <input ref={fileRef} type="file" accept=".csv" onChange={handleFile} style={{ display:'none' }} />
            <div className={styles.dropIcon}>📂</div>
            <div className={styles.dropText}>{fileName || 'Drop CSV here or click to browse'}</div>
            <div className={styles.dropHint}>Required: <code>ph</code>, <code>turbidity</code>, <code>temperature</code></div>
          </div>

          <div className={styles.actionRow}>
            <button className={styles.sampleBtn} onClick={loadSample}>Load sample (20 rows)</button>
            {rows.length > 0 && <span className={styles.rowBadge}>{rows.length} rows loaded</span>}
          </div>

          {error && <div className={styles.error}>{error}</div>}

          <div className={styles.formatBox}>
            <div className={styles.formatTitle}>CSV format:</div>
            <pre className={styles.formatCode}>{`ph,turbidity,temperature\n7.2,1.5,24.0\n6.8,8.5,28.0`}</pre>
          </div>

          {rows.length > 0 && (
            <button className={styles.predictBtn} onClick={handlePredict} disabled={loading}>
              {loading ? `Processing ${rows.length} rows...` : `⚡ Run ML on ${rows.length} rows`}
            </button>
          )}
        </div>

        {/* Stats card */}
        {stats && (
          <div className={styles.card}>
            <div className={styles.cardTitle}>Summary</div>
            <p className={styles.cardSub}>Prediction results overview</p>
            <div className={styles.statGrid}>
              <div className={styles.statBox}>
                <span className={styles.statBig}>{stats.total}</span>
                <span className={styles.statLbl}>Total rows</span>
              </div>
              <div className={styles.statBox}>
                <span className={styles.statBig} style={{ color: getWqiColor(parseFloat(stats.avgWqi)) }}>
                  {stats.avgWqi}
                </span>
                <span className={styles.statLbl}>Avg WQI</span>
              </div>
              {CLASS_ORDER.filter(c => stats.classes[c]).map(cls => (
                <div key={cls} className={styles.statBox}>
                  <span className={styles.statBig} style={{ color: CLASS_COLORS[cls], fontSize: '20px' }}>
                    {stats.classes[cls]}
                  </span>
                  <span className={styles.statLbl}>{cls}</span>
                </div>
              ))}
            </div>
            <button className={styles.downloadBtn} onClick={downloadResults}>↓ Download results CSV</button>
          </div>
        )}
      </div>

      {/* ── Visualizations ────────────────────────────── */}
      {results.length > 0 && <Visualizations results={results} />}

      {/* ── Results table ─────────────────────────────── */}
      {(results.length > 0 || loading) && (
        <div className={styles.card}>
          <div className={styles.tableHeader}>
            <div className={styles.cardTitle}>Prediction Results</div>
            <span className={styles.cardSub}>ML output for each row</span>
          </div>

          {loading && (
            <div className={styles.empty}>
              <div className={styles.spinner} />
              <p style={{ fontFamily:'var(--font-mono)', fontSize:12, color:'var(--text-muted)' }}>Running model...</p>
            </div>
          )}

          {!loading && results.length > 0 && (
            <div className={styles.tableWrap}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th>#</th><th>pH</th><th>Turbidity</th><th>Temp</th>
                    <th>Quality Class</th><th>WQI Score</th><th>Confidence</th>
                  </tr>
                </thead>
                <tbody>
                  {results.map((r, i) => {
                    const cls  = r.prediction?.qualityClass
                    const wqi  = r.prediction?.wqiScore
                    const conf = r.prediction?.confidence
                    return (
                      <tr key={i} className={styles.row}>
                        <td className={styles.rowNum}>{i+1}</td>
                        <td style={{ color:(r.ph<6.5||r.ph>8.5)?'var(--amber)':'var(--text-primary)', fontFamily:'var(--font-mono)', fontSize:12 }}>{r.ph}</td>
                        <td style={{ color:r.turbidity>4?'var(--amber)':'var(--text-primary)', fontFamily:'var(--font-mono)', fontSize:12 }}>{r.turbidity} <span style={{color:'var(--text-muted)',fontSize:10}}>NTU</span></td>
                        <td style={{ color:(r.temperature<10||r.temperature>35)?'var(--amber)':'var(--text-primary)', fontFamily:'var(--font-mono)', fontSize:12 }}>{r.temperature}°</td>
                        <td><span style={{ fontFamily:'var(--font-mono)', fontSize:11, fontWeight:600, color:getQualityColor(cls) }}>{cls||'—'}</span></td>
                        <td><span style={{ fontFamily:'var(--font-mono)', fontSize:13, fontWeight:600, color:getWqiColor(wqi||0) }}>{wqi!=null?Math.round(wqi):'—'}</span></td>
                        <td style={{ fontFamily:'var(--font-mono)', fontSize:11, color: conf!=null?'var(--teal)':'var(--text-muted)' }}>
                          {conf!=null ? `${(conf*100).toFixed(1)}%` : '— (start ML service)'}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
