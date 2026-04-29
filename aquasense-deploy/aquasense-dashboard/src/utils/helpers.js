export const QUALITY_CONFIG = {
  Excellent:  { color: '#00e8c8', bg: 'rgba(0,232,200,0.1)',  border: 'rgba(0,232,200,0.3)',  rank: 5 },
  Good:       { color: '#39d98a', bg: 'rgba(57,217,138,0.1)', border: 'rgba(57,217,138,0.3)', rank: 4 },
  Poor:       { color: '#f5a623', bg: 'rgba(245,166,35,0.1)', border: 'rgba(245,166,35,0.3)', rank: 3 },
  'Very Poor':{ color: '#ff8c42', bg: 'rgba(255,140,66,0.1)', border: 'rgba(255,140,66,0.3)', rank: 2 },
  Unsafe:     { color: '#ff4d6d', bg: 'rgba(255,77,109,0.1)', border: 'rgba(255,77,109,0.3)', rank: 1 },
}

export const SENSOR_CONFIG = {
  ph: {
    label: 'pH Level',
    unit: '',
    min: 0, max: 14,
    safeMin: 6.5, safeMax: 8.5,
    decimals: 2,
    color: '#00e8c8',
    description: 'Acidity / alkalinity',
  },
  turbidity: {
    label: 'Turbidity',
    unit: 'NTU',
    min: 0, max: 50,
    safeMin: 0, safeMax: 4,
    decimals: 2,
    color: '#7c9ef5',
    description: 'Water clarity',
  },
  temperature: {
    label: 'Temperature',
    unit: '°C',
    min: 0, max: 50,
    safeMin: 10, safeMax: 35,
    decimals: 1,
    color: '#f5a623',
    description: 'Water temperature',
  },
}

export const getQualityColor = (cls) =>
  QUALITY_CONFIG[cls]?.color || '#7a9bb5'

export const getWqiColor = (score) => {
  if (score >= 90) return '#00e8c8'
  if (score >= 70) return '#39d98a'
  if (score >= 50) return '#f5a623'
  if (score >= 25) return '#ff8c42'
  return '#ff4d6d'
}

export const getSensorStatus = (key, value) => {
  const cfg = SENSOR_CONFIG[key]
  if (!cfg) return 'normal'
  if (value < cfg.safeMin || value > cfg.safeMax) return 'warning'
  return 'normal'
}

export const formatTime = (ts) => {
  const d = new Date(ts)
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
}

export const formatDate = (ts) => {
  const d = new Date(ts)
  return d.toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })
}

export const formatRelative = (ts) => {
  const diff = (Date.now() - new Date(ts)) / 1000
  if (diff < 10)  return 'just now'
  if (diff < 60)  return `${Math.floor(diff)}s ago`
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`
  return `${Math.floor(diff / 3600)}h ago`
}
