import axios from 'axios'

const api = axios.create({
  baseURL: '/api',
  headers: { 'x-api-key': import.meta.env.VITE_API_KEY || 'changeme' },
  timeout: 8000,
})

// IoT only — used by Live Dashboard (backend filters source automatically)
export const getReadings = (params = {}) =>
  api.get('/readings', { params }).then(r => r.data)

// ALL readings including manual — used by History tab
export const getAllReadings = (params = {}) =>
  api.get('/readings', { params: { ...params, iotOnly: 'false' } }).then(r => r.data)

export const getHourlyAverages = (deviceId, from, to) =>
  api.get('/readings/averages', { params: { deviceId, from, to } }).then(r => r.data)

export const getPredictions = (params = {}) =>
  api.get('/predictions', { params }).then(r => r.data)

export const getPredictionStats = (deviceId) =>
  api.get('/predictions/stats', { params: deviceId ? { deviceId } : {} }).then(r => r.data)

export const getAlerts = (params = {}) =>
  api.get('/alerts', { params }).then(r => r.data)

export const resolveAlert = (id) =>
  api.patch(`/alerts/${id}/resolve`).then(r => r.data)

export const resolveAllAlerts = (deviceId) =>
  api.post('/alerts/resolve-all', { deviceId }).then(r => r.data)

export const getDevices = () =>
  api.get('/devices').then(r => r.data)

export default api
