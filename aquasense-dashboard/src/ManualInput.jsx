import { useState } from 'react'
import { getQualityColor, getWqiColor, QUALITY_CONFIG } from '../utils/helpers'
import api from '../services/api'
import styles from './ManualInput.module.css'

const DEFAULT_FORM = { ph: '', turbidity: '', temperature: '', deviceId: 'manual-input' }

const PRESETS = [
  { label: 'Tap water',     ph: 7.2,  turbidity: 0.8,  temperature: 24 },
  { label: 'River water',   ph: 6.8,  turbidity: 8.5,  temperature: 28 },
  { label: 'Polluted',      ph: 5.2,  turbidity: 22.0, temperature: 34 },
  { label: 'Ideal',         ph: 7.0,  turbidity: 0.3,  temperature: 22 },
]

export default function ManualInput({ onNewReading }) {
  const [form,    setForm]    = useState(DEFAULT_FORM)
  const [result,  setResult]  = useState(null)
  const [loading, setLoading] = useState(false)
  const [error,   setError]   = useState(null)
  const [history, setHistory] = useState([])

  const handleChange = (e) => {
    setForm(f => ({ ...f, [e.target.name]: e.target.value }))
    setError(null)
  }

  const validate = () => {
    const ph   = parseFloat(form.ph)
    const turb = parseFloat(form.turbidity)
    const temp = parseFloat(form.temperature)
    if (isNaN(ph)   || ph   < 0  || ph   > 14)   return 'pH must be between 0 and 14'
    if (isNaN(turb) || turb < 0  || turb > 1000) return 'Turbidity must be 0–1000 NTU'
    if (isNaN(temp) || temp < -10 || temp > 100)  return 'Temperature must be -10 to 100°C'
    return null
  }

  const handleSubmit = async () => {
    const err = validate()
    if (err) { setError(err); return }

    setLoading(true)
    setError(null)

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

      setResult({ reading: r, prediction: p, alerts: data.alerts || [] })
      setHistory(prev => [{ reading: r, prediction: p }, ...prev].slice(0, 10))

      if (onNewReading) onNewReading({ reading: r, prediction: p, alerts: data.alerts || [] })
    } catch (e) {
      setError(e.response?.data?.message || 'Failed to send — is backend running?')
    } finally {
      setLoading(false)
    }
  }

  const applyPreset = (preset) => {
    setForm(f => ({
      ...f,
      ph:          String(preset.ph),
      turbidity:   String(preset.turbidity),
      temperature: String(preset.temperature),
    }))
    setResult(null)
    setError(null)
  }

  const handleReset = () => {
    setForm(DEFAULT_FORM)
    setResult(null)
    setError(null)
  }

  const cfg = result ? QUALITY_CONFIG[result.prediction?.qualityClass] : null

  return (
    <div className={styles.container}>
      {/* Left: Input form */}
      <div className={styles.formPanel}>
        <div className={styles.panelHeader}>
          <span className={styles.panelTitle}>Manual Input</span>
          <span className={styles.panelSub}>Enter sensor values manually</span>
        </div>

        {/* Presets */}
        <div className={styles.presets}>
          <span className={styles.presetsLabel}>Quick presets:</span>
          <div className={styles.presetBtns}>
            {PRESETS.map(p => (
              <button key={p.label} className={styles.presetBtn} onClick={() => applyPreset(p)}>
                {p.label}
              </button>
            ))}
          </div>
        </div>

        {/* Form fields */}
        <div className={styles.fields}>
          <div className={styles.field}>
            <label className={styles.label}>
              pH Level
              <span className={styles.range}>0 – 14</span>
            </label>
            <div className={styles.inputWrap}>
              <input
                type="number" name="ph" value={form.ph}
                onChange={handleChange}
                placeholder="e.g. 7.2"
                min="0" max="14" step="0.01"
                className={styles.input}
              />
              <span className={styles.inputUnit}>pH</span>
            </div>
            <div className={styles.safeRange}>Safe: 6.5 – 8.5</div>
          </div>

          <div className={styles.field}>
            <label className={styles.label}>
              Turbidity
              <span className={styles.range}>0 – 1000 NTU</span>
            </label>
            <div className={styles.inputWrap}>
              <input
                type="number" name="turbidity" value={form.turbidity}
                onChange={handleChange}
                placeholder="e.g. 1.5"
                min="0" step="0.01"
                className={styles.input}
              />
              <span className={styles.inputUnit}>NTU</span>
            </div>
            <div className={styles.safeRange}>Safe: 0 – 4 NTU (WHO)</div>
          </div>

          <div className={styles.field}>
            <label className={styles.label}>
              Temperature
              <span className={styles.range}>-10 – 100°C</span>
            </label>
            <div className={styles.inputWrap}>
              <input
                type="number" name="temperature" value={form.temperature}
                onChange={handleChange}
                placeholder="e.g. 24.0"
                min="-10" max="100" step="0.1"
                className={styles.input}
              />
              <span className={styles.inputUnit}>°C</span>
            </div>
            <div className={styles.safeRange}>Safe: 10 – 35°C</div>
          </div>

          <div className={styles.field}>
            <label className={styles.label}>
              Device ID
              <span className={styles.range}>optional</span>
            </label>
            <div className={styles.inputWrap}>
              <input
                type="text" name="deviceId" value={form.deviceId}
                onChange={handleChange}
                placeholder="manual-input"
                className={styles.input}
              />
            </div>
          </div>
        </div>

        {error && <div className={styles.error}>{error}</div>}

        <div className={styles.btnRow}>
          <button
            className={styles.submitBtn}
            onClick={handleSubmit}
            disabled={loading}
          >
            {loading ? 'Predicting...' : 'Get ML Prediction'}
          </button>
          <button className={styles.resetBtn} onClick={handleReset}>
            Reset
          </button>
        </div>
      </div>

      {/* Right: Result */}
      <div className={styles.resultPanel}>
        <div className={styles.panelHeader}>
          <span className={styles.panelTitle}>Prediction Result</span>
          <span className={styles.panelSub}>ML model output</span>
        </div>

        {!result && !loading && (
          <div className={styles.empty}>
            <div className={styles.emptyIcon}>◌</div>
            <p>Enter values and click</p>
            <p className={styles.emptyHint}>Get ML Prediction</p>
          </div>
        )}

        {loading && (
          <div className={styles.empty}>
            <div className={styles.spinner} />
            <p>Running SVM model...</p>
          </div>
        )}

        {result && !loading && (
          <div className={styles.result}>
            {/* Quality badge */}
            <div
              className={styles.qualityBadge}
              style={cfg ? { color: cfg.color, background: cfg.bg, borderColor: cfg.border } : {}}
            >
              {result.prediction?.qualityClass || '—'}
            </div>

            {/* WQI score */}
            <div className={styles.wqiRow}>
              <div className={styles.wqiBlock}>
                <span
                  className={styles.wqiScore}
                  style={{ color: getWqiColor(result.prediction?.wqiScore || 0) }}
                >
                  {Math.round(result.prediction?.wqiScore || 0)}
                </span>
                <span className={styles.wqiLabel}>WQI Score</span>
              </div>
              {result.prediction?.confidence != null && (
                <div className={styles.wqiBlock}>
                  <span className={styles.wqiScore} style={{ color: 'var(--teal)' }}>
                    {(result.prediction.confidence * 100).toFixed(1)}%
                  </span>
                  <span className={styles.wqiLabel}>Confidence</span>
                </div>
              )}
            </div>

            {/* Input summary */}
            <div className={styles.inputSummary}>
              <div className={styles.summaryRow}>
                <span className={styles.summaryLabel}>pH</span>
                <span className={styles.summaryValue}
                  style={{ color: (result.reading.ph < 6.5 || result.reading.ph > 8.5) ? 'var(--amber)' : 'var(--teal)' }}>
                  {result.reading.ph}
                </span>
              </div>
              <div className={styles.summaryRow}>
                <span className={styles.summaryLabel}>Turbidity</span>
                <span className={styles.summaryValue}
                  style={{ color: result.reading.turbidity > 4 ? 'var(--amber)' : 'var(--teal)' }}>
                  {result.reading.turbidity} NTU
                </span>
              </div>
              <div className={styles.summaryRow}>
                <span className={styles.summaryLabel}>Temperature</span>
                <span className={styles.summaryValue}
                  style={{ color: (result.reading.temperature < 10 || result.reading.temperature > 35) ? 'var(--amber)' : 'var(--teal)' }}>
                  {result.reading.temperature}°C
                </span>
              </div>
              <div className={styles.summaryRow}>
                <span className={styles.summaryLabel}>Model</span>
                <span className={styles.summaryValue} style={{ color: 'var(--text-secondary)', fontSize: '11px' }}>
                  {result.prediction?.modelName || 'SVM'} v{result.prediction?.modelVersion}
                </span>
              </div>
            </div>

            {/* Alerts */}
            {result.alerts?.length > 0 && (
              <div className={styles.alertsBox}>
                <span className={styles.alertsTitle}>⚠ {result.alerts.length} alert(s)</span>
                {result.alerts.map((a, i) => (
                  <div key={i} className={styles.alertItem}>{a.message}</div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Recent history */}
        {history.length > 0 && (
          <div className={styles.history}>
            <div className={styles.historyTitle}>Recent manual inputs</div>
            {history.map((h, i) => (
              <div key={i} className={styles.historyRow}>
                <span className={styles.historyVals}>
                  pH {h.reading.ph} · {h.reading.turbidity} NTU · {h.reading.temperature}°C
                </span>
                <span
                  className={styles.historyClass}
                  style={{ color: getQualityColor(h.prediction?.qualityClass) }}
                >
                  {h.prediction?.qualityClass}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
