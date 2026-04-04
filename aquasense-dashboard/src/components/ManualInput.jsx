import { useState } from 'react'
import { getQualityColor, getWqiColor, QUALITY_CONFIG } from '../utils/helpers'
import api from '../services/api'
import styles from './ManualInput.module.css'

const PRESETS = [
  { label: 'Tap water',   ph: 7.2,  turbidity: 0.8,  temperature: 24 },
  { label: 'River water', ph: 6.8,  turbidity: 8.5,  temperature: 28 },
  { label: 'Polluted',    ph: 5.2,  turbidity: 22.0, temperature: 34 },
  { label: 'Ideal',       ph: 7.0,  turbidity: 0.3,  temperature: 22 },
]

function ResultCard({ result }) {
  const cfg = QUALITY_CONFIG[result.prediction?.qualityClass]
  return (
    <div className={styles.resultCard}>
      <div className={styles.resultHeader}>ML Prediction Result</div>

      <div className={styles.qualityBadge}
        style={cfg ? { color: cfg.color, background: cfg.bg, borderColor: cfg.border } : {}}>
        {result.prediction?.qualityClass || '—'}
      </div>

      <div className={styles.scoreRow}>
        <div className={styles.scoreBox}>
          <span className={styles.scoreVal}
            style={{ color: getWqiColor(result.prediction?.wqiScore || 0) }}>
            {Math.round(result.prediction?.wqiScore || 0)}
          </span>
          <span className={styles.scoreLabel}>WQI Score</span>
        </div>
        {result.prediction?.confidence != null && (
          <div className={styles.scoreBox}>
            <span className={styles.scoreVal} style={{ color: 'var(--teal)' }}>
              {(result.prediction.confidence * 100).toFixed(1)}%
            </span>
            <span className={styles.scoreLabel}>Confidence</span>
          </div>
        )}
        <div className={styles.scoreBox}>
          <span className={styles.scoreVal} style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
            v{result.prediction?.modelVersion || '2.0'}
          </span>
          <span className={styles.scoreLabel}>Model</span>
        </div>
      </div>

      <div className={styles.summaryGrid}>
        {[
          { label: 'pH', value: result.reading.ph, warn: result.reading.ph < 6.5 || result.reading.ph > 8.5 },
          { label: 'Turbidity', value: `${result.reading.turbidity} NTU`, warn: result.reading.turbidity > 4 },
          { label: 'Temperature', value: `${result.reading.temperature}°C`, warn: result.reading.temperature < 10 || result.reading.temperature > 35 },
        ].map(s => (
          <div key={s.label} className={styles.summaryItem}>
            <span className={styles.summaryLabel}>{s.label}</span>
            <span className={styles.summaryVal} style={{ color: s.warn ? 'var(--amber)' : 'var(--teal)' }}>
              {s.value}
            </span>
          </div>
        ))}
      </div>

      {result.alerts?.length > 0 && (
        <div className={styles.alertBox}>
          <span className={styles.alertTitle}>⚠ {result.alerts.length} threshold violation(s)</span>
          {result.alerts.map((a, i) => (
            <div key={i} className={styles.alertMsg}>{a.message}</div>
          ))}
        </div>
      )}
    </div>
  )
}

export default function ManualInput({ onNewReading }) {
  const [form,    setForm]    = useState({ ph: '', turbidity: '', temperature: '', deviceId: 'manual-input' })
  const [result,  setResult]  = useState(null)
  const [loading, setLoading] = useState(false)
  const [error,   setError]   = useState(null)
  const [history, setHistory] = useState([])

  const handleChange = e => {
    setForm(f => ({ ...f, [e.target.name]: e.target.value }))
    setError(null)
  }

  const validate = () => {
    const ph   = parseFloat(form.ph)
    const turb = parseFloat(form.turbidity)
    const temp = parseFloat(form.temperature)
    if (isNaN(ph)   || ph < 0 || ph > 14)      return 'pH must be 0–14'
    if (isNaN(turb) || turb < 0)               return 'Turbidity must be ≥ 0'
    if (isNaN(temp) || temp < -10 || temp > 100) return 'Temperature must be -10 to 100°C'
    return null
  }

  const handleSubmit = async () => {
    const err = validate()
    if (err) { setError(err); return }
    setLoading(true); setError(null)
    try {
      const payload = {
        deviceId:    form.deviceId || 'manual-input',
        ph:          parseFloat(parseFloat(form.ph).toFixed(2)),
        turbidity:   parseFloat(parseFloat(form.turbidity).toFixed(2)),
        temperature: parseFloat(parseFloat(form.temperature).toFixed(1)),
        source:      'manual',
      }
      const { data } = await api.post('/readings', payload)
      const r = { ...payload, _id: data.reading?._id, timestamp: new Date().toISOString() }
      const p = data.prediction
      const newResult = { reading: r, prediction: p, alerts: data.alerts || [] }
      setResult(newResult)
      setHistory(prev => [{ reading: r, prediction: p }, ...prev].slice(0, 8))
      if (onNewReading) onNewReading(newResult)
    } catch (e) {
      setError(e.response?.data?.message || 'Failed — is backend running?')
    } finally {
      setLoading(false)
    }
  }

  const applyPreset = p => {
    setForm(f => ({ ...f, ph: String(p.ph), turbidity: String(p.turbidity), temperature: String(p.temperature) }))
    setResult(null); setError(null)
  }

  return (
    <div className={styles.page}>
      {/* ── Left: form ──────────────────────────────────── */}
      <div className={styles.formCol}>
        <div className={styles.sectionTitle}>Manual Sensor Input</div>
        <p className={styles.sectionSub}>Enter values manually and get an instant ML prediction</p>

        <div className={styles.presetRow}>
          {PRESETS.map(p => (
            <button key={p.label} className={styles.presetBtn} onClick={() => applyPreset(p)}>
              {p.label}
            </button>
          ))}
        </div>

        {[
          { key: 'ph',          label: 'pH Level',     unit: 'pH',  min: 0,   max: 14,   step: 0.01, safe: '6.5 – 8.5',  ph: 'e.g. 7.2' },
          { key: 'turbidity',   label: 'Turbidity',    unit: 'NTU', min: 0,   max: 1000, step: 0.01, safe: '0 – 4 NTU',  ph: 'e.g. 1.5' },
          { key: 'temperature', label: 'Temperature',  unit: '°C',  min: -10, max: 100,  step: 0.1,  safe: '10 – 35°C',  ph: 'e.g. 24' },
        ].map(f => (
          <div key={f.key} className={styles.field}>
            <div className={styles.fieldHeader}>
              <label className={styles.fieldLabel}>{f.label}</label>
              <span className={styles.fieldSafe}>Safe: {f.safe}</span>
            </div>
            <div className={styles.inputRow}>
              <input
                type="number" name={f.key} value={form[f.key]}
                onChange={handleChange} placeholder={f.ph}
                min={f.min} max={f.max} step={f.step}
                className={styles.input}
              />
              <span className={styles.unit}>{f.unit}</span>
            </div>
          </div>
        ))}

        {error && <div className={styles.error}>{error}</div>}

        <div className={styles.btnRow}>
          <button className={styles.submitBtn} onClick={handleSubmit} disabled={loading}>
            {loading ? 'Running model...' : '⚡ Get Prediction'}
          </button>
          <button className={styles.resetBtn} onClick={() => { setForm({ ph:'', turbidity:'', temperature:'', deviceId:'manual-input' }); setResult(null); setError(null) }}>
            Reset
          </button>
        </div>

        {/* History */}
        {history.length > 0 && (
          <div className={styles.history}>
            <div className={styles.historyTitle}>Recent inputs</div>
            {history.map((h, i) => (
              <div key={i} className={styles.historyRow}>
                <span className={styles.historyVals}>pH {h.reading.ph} · {h.reading.turbidity} NTU · {h.reading.temperature}°C</span>
                <span className={styles.historyClass} style={{ color: getQualityColor(h.prediction?.qualityClass) }}>
                  {h.prediction?.qualityClass}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Right: result ────────────────────────────────── */}
      <div className={styles.resultCol}>
        <div className={styles.sectionTitle}>Prediction Output</div>
        <p className={styles.sectionSub}>ML model output appears here instantly</p>

        {!result && !loading && (
          <div className={styles.empty}>
            <div className={styles.emptyIcon}>◌</div>
            <p>Fill in the form and click</p>
            <p className={styles.emptyHint}>⚡ Get Prediction</p>
          </div>
        )}

        {loading && (
          <div className={styles.empty}>
            <div className={styles.spinner} />
            <p style={{ fontSize: '13px', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>Running SVM model...</p>
          </div>
        )}

        {result && !loading && <ResultCard result={result} />}
      </div>
    </div>
  )
}
