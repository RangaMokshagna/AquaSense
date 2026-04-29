import { useState, useEffect, useCallback } from 'react'
import Header         from './components/Header'
import SensorCard     from './components/SensorCard'
import WQIPanel       from './components/WQIPanel'
import LiveChart      from './components/LiveChart'
import AlertPanel     from './components/AlertPanel'
import HistoryTable   from './components/HistoryTable'
import StatsBar       from './components/StatsBar'
import ManualInput    from './components/ManualInput'
import DatasetPredict from './components/DatasetPredict'
import { useSocket } from './hooks/useSocket'
import {
  getReadings, getPredictions, getAlerts,
  resolveAlert, resolveAllAlerts, getDevices,
} from './services/api'
import styles from './App.module.css'

const MAX_CHART_POINTS = 60
const IOT_SOURCES = ['esp32', 'mqtt', 'simulated', 'http']
const isIoT = (reading) => IOT_SOURCES.includes(reading?.source || 'http')

export default function App() {
  const [deviceId, setDeviceId]             = useState(null)
  const [devices,  setDevices]              = useState([])
  const [sensorReadings, setSensorReadings] = useState([])
  const [sensorPreds,    setSensorPreds]    = useState([])
  const [allReadings,    setAllReadings]    = useState([])
  const [allPredictions, setAllPredictions] = useState([])
  const [alerts,     setAlerts]     = useState([])
  const [chartData,  setChartData]  = useState([])
  const [activeKeys, setActiveKeys] = useState(['ph', 'turbidity', 'temperature'])
  const [prevReading, setPrevReading] = useState(null)
  const [flashKey,   setFlashKey]   = useState(null)
  const [loading,    setLoading]    = useState(true)
  const [activeTab,  setActiveTab]  = useState('dashboard')

  const { connected, lastUpdate, liveReading, liveAlerts } = useSocket(deviceId)

  const fetchInitial = useCallback(async () => {
    try {
      const params = deviceId ? { deviceId, limit: 200 } : { limit: 200 }
      const [iotData, allData, pData, aData, dData] = await Promise.all([
        getReadings(params),
        getReadings({ ...params, iotOnly: 'false' }),
        getPredictions(params),
        getAlerts({ ...params, resolved: false }),
        getDevices(),
      ])
      const iotReadings = (iotData.data || []).filter(r => isIoT(r))
      const allRdgs     = allData.data || []
      const predictions = pData.data  || []
      setSensorReadings(iotReadings)
      setSensorPreds(predictions.filter(p =>
        iotReadings.some(r => String(r._id) === String(p.readingId))
      ))
      setChartData([...iotReadings].reverse().slice(-MAX_CHART_POINTS))
      setAllReadings(allRdgs)
      setAllPredictions(predictions)
      setAlerts(aData.data || [])
      setDevices(dData.data || [])
    } catch (err) { console.error('Failed to load:', err) }
    finally { setLoading(false) }
  }, [deviceId])

  useEffect(() => { fetchInitial() }, [fetchInitial])

  useEffect(() => {
    if (!liveReading) return
    const { reading, prediction } = liveReading
    if (!isIoT(reading)) return
    setPrevReading(prev => {
      const last = prev || sensorReadings[0]
      return last ? { ph: last.ph, turbidity: last.turbidity, temperature: last.temperature } : null
    })
    setFlashKey(Date.now())
    setSensorReadings(prev => [reading, ...prev].slice(0, 200))
    setAllReadings(prev => [reading, ...prev].slice(0, 200))
    if (prediction) {
      setSensorPreds(prev => [{ ...prediction, readingId: reading._id }, ...prev].slice(0, 200))
      setAllPredictions(prev => [{ ...prediction, readingId: reading._id }, ...prev].slice(0, 200))
    }
    setChartData(prev => [
      ...prev,
      { ph: reading.ph, turbidity: reading.turbidity,
        temperature: reading.temperature,
        timestamp: reading.timestamp || new Date().toISOString() },
    ].slice(-MAX_CHART_POINTS))
  }, [liveReading])

  useEffect(() => {
    if (!liveAlerts.length) return
    setAlerts(prev => {
      const ids = new Set(prev.map(a => a._id))
      return [...liveAlerts.filter(a => !ids.has(a._id)), ...prev].slice(0, 100)
    })
  }, [liveAlerts])

  const handleManualReading = ({ reading, prediction, alerts: newAlerts }) => {
    setAllReadings(prev => [reading, ...prev].slice(0, 200))
    if (prediction) setAllPredictions(prev => [{ ...prediction, readingId: reading._id }, ...prev].slice(0, 200))
    if (newAlerts?.length) setAlerts(prev => [...newAlerts, ...prev].slice(0, 100))
  }

  const latestSensor = sensorReadings[0]
  const latestPred   = sensorPreds[0]

  const handleToggleKey  = key => setActiveKeys(prev =>
    prev.includes(key) ? prev.length > 1 ? prev.filter(k => k !== key) : prev : [...prev, key]
  )
  const handleResolve    = async id => { await resolveAlert(id); setAlerts(prev => prev.map(a => a._id === id ? { ...a, resolved: true } : a)) }
  const handleResolveAll = async dId => { await resolveAllAlerts(dId); setAlerts(prev => prev.map(a => ({ ...a, resolved: true }))) }
  const handleDeviceChange = id => {
    setDeviceId(id); setLoading(true)
    setSensorReadings([]); setSensorPreds([])
    setAllReadings([]); setAllPredictions([])
    setAlerts([]); setChartData([])
  }

  const activeAlertCount = alerts.filter(a => !a.resolved).length

  if (loading) return (
    <div className={styles.loading}>
      <div className={styles.loadingInner}>
        <span className={styles.loadingMark}>◈</span>
        <p className={styles.loadingText}>Connecting to AquaSense…</p>
      </div>
    </div>
  )

  return (
    <div className={styles.app}>
      <Header connected={connected} lastUpdate={lastUpdate}
        deviceId={deviceId} onDeviceChange={handleDeviceChange} devices={devices} />

      <div className={styles.tabs}>
        {[
          { id: 'dashboard', label: 'Live Dashboard',  badge: 0 },
          { id: 'manual',    label: 'Manual Input',    badge: 0 },
          { id: 'dataset',   label: 'Dataset Predict', badge: 0 },
          { id: 'history',   label: 'History',         badge: 0 },
          { id: 'alerts',    label: 'Alerts',          badge: activeAlertCount },
        ].map(t => (
          <button key={t.id}
            className={`${styles.tab} ${activeTab === t.id ? styles.tabActive : ''} ${t.badge > 0 ? styles.tabAlert : ''}`}
            onClick={() => setActiveTab(t.id)}
          >
            {t.label}
            {t.badge > 0 && <span className={styles.alertBadge}>{t.badge}</span>}
          </button>
        ))}
      </div>

      <main className={styles.main}>
        {activeTab === 'dashboard' && (
          <div className={styles.dashboard}>
            <div className={styles.sourceTag}>
              <span className={styles.sourceDot} />
              IoT sensors &amp; simulator only — manual input excluded
            </div>
            {sensorReadings.length === 0 ? (
              <div className={styles.noData}>
                <span className={styles.noDataIcon}>◌</span>
                <p>No sensor data yet</p>
                <p className={styles.noDataHint}>
                  Start simulator: <code>node scripts\simulate.js</code>
                  <br/>or connect your ESP32
                </p>
              </div>
            ) : (
              <>
                <StatsBar readings={sensorReadings} predictions={sensorPreds} />
                <div className={styles.sensorRow}>
                  {['ph', 'turbidity', 'temperature'].map((key, i) => (
                    <SensorCard key={key} sensorKey={key}
                      value={latestSensor?.[key]}
                      prevValue={prevReading?.[key]}
                      animate={flashKey != null && i === 0}
                    />
                  ))}
                </div>
                <div className={styles.midRow}>
                  <WQIPanel prediction={latestPred} readingCount={sensorReadings.length} />
                  <div className={styles.chartWrap}>
                    <LiveChart data={chartData} activeKeys={activeKeys} onToggle={handleToggleKey} />
                  </div>
                </div>
                {activeAlertCount > 0 && (
                  <AlertPanel
                    alerts={alerts.filter(a => !a.resolved).slice(0, 4)}
                    onResolve={handleResolve} onResolveAll={handleResolveAll}
                    deviceId={deviceId}
                  />
                )}
              </>
            )}
          </div>
        )}

        {activeTab === 'manual'  && <ManualInput    onNewReading={handleManualReading} />}
        {activeTab === 'dataset' && <DatasetPredict />}
        {activeTab === 'history' && <HistoryTable readings={allReadings} predictions={allPredictions} />}
        {activeTab === 'alerts'  && (
          <AlertPanel alerts={alerts} onResolve={handleResolve}
            onResolveAll={handleResolveAll} deviceId={deviceId} />
        )}
      </main>
    </div>
  )
}
