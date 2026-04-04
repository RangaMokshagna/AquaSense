/**
 * AquaSense Sensor Simulator
 * Sends realistic fake sensor readings to the backend via HTTP POST.
 * Run: node scripts/simulate.js
 */

require('dotenv').config();
const axios = require('axios');

const BASE_URL  = process.env.BACKEND_URL || 'http://localhost:5000';
const API_KEY   = process.env.API_KEY || '';
const INTERVAL  = parseInt(process.env.SIM_INTERVAL_MS || '3000');
const DEVICE_ID = process.env.SIM_DEVICE_ID || 'sim-sensor-01';

const headers = { 'Content-Type': 'application/json' };
if (API_KEY) headers['x-api-key'] = API_KEY;

// ── Realistic value generators ─────────────────────────────────────────────
let state = {
  ph:          7.2,
  turbidity:   1.2,
  temperature: 24.0,
  scenario:    'normal',
  tick:        0,
};

const nextState = (s) => {
  s.tick++;
  if (s.tick % 80 === 0) {
    const scenarios = ['normal', 'normal', 'contamination', 'heatwave'];
    s.scenario = scenarios[Math.floor(Math.random() * scenarios.length)];
    console.log(`\n[Simulator] Switching to scenario: ${s.scenario.toUpperCase()}\n`);
  }

  const drift = (val, target, speed, noise) =>
    val + (target - val) * speed + (Math.random() - 0.5) * noise;

  switch (s.scenario) {
    case 'contamination':
      s.ph          = drift(s.ph, 5.8, 0.05, 0.1);
      s.turbidity   = drift(s.turbidity, 12.0, 0.08, 0.5);
      s.temperature = drift(s.temperature, 26.0, 0.02, 0.3);
      break;
    case 'heatwave':
      s.ph          = drift(s.ph, 7.8, 0.03, 0.05);
      s.turbidity   = drift(s.turbidity, 2.5, 0.03, 0.2);
      s.temperature = drift(s.temperature, 38.5, 0.05, 0.4);
      break;
    case 'recovery':
      s.ph          = drift(s.ph, 7.2, 0.08, 0.04);
      s.turbidity   = drift(s.turbidity, 1.0, 0.08, 0.1);
      s.temperature = drift(s.temperature, 24.0, 0.05, 0.2);
      break;
    default:
      s.ph          = drift(s.ph, 7.2, 0.02, 0.05);
      s.turbidity   = drift(s.turbidity, 1.0, 0.02, 0.15);
      s.temperature = drift(s.temperature, 24.0, 0.02, 0.2);
  }

  s.ph          = Math.max(0, Math.min(14, s.ph));
  s.turbidity   = Math.max(0, s.turbidity);
  s.temperature = Math.max(-5, Math.min(60, s.temperature));
  return s;
};

const round = (n, d = 2) => parseFloat(n.toFixed(d));

// ── Main loop ──────────────────────────────────────────────────────────────
let successCount = 0;
let errorCount   = 0;

const sendReading = async () => {
  state = nextState(state);

  const payload = {
    deviceId:    DEVICE_ID,
    ph:          round(state.ph),
    turbidity:   round(state.turbidity),
    temperature: round(state.temperature, 1),
    source:      'simulated',
  };

  try {
    const { data } = await axios.post(`${BASE_URL}/api/readings`, payload, { headers, timeout: 5000 });
    successCount++;
    const p = data.prediction;
    const alertCount = data.alerts?.length || 0;
    console.log(
      `[${new Date().toISOString()}] OK ` +
      `pH: ${payload.ph.toFixed(2)}  ` +
      `Turbidity: ${payload.turbidity.toFixed(2)} NTU  ` +
      `Temp: ${payload.temperature.toFixed(1)}C  ` +
      `=> ${p.qualityClass} (WQI ${p.wqiScore})` +
      (alertCount > 0 ? `  !! ${alertCount} alert(s)` : '')
    );
  } catch (err) {
    errorCount++;
    let msg;
    if (err.response) {
      // Server replied with non-2xx (e.g. 401 Unauthorized, 400 Bad Request)
      msg = `HTTP ${err.response.status} - ${JSON.stringify(err.response.data)}`;
    } else if (err.request) {
      // No response received - server is down or wrong port
      msg = `Cannot reach ${BASE_URL}/api/readings (${err.code || 'ECONNREFUSED'})`;
      msg += '\n  -> Is the backend running? Try: docker compose ps';
      msg += '\n  -> Or check if port 5000 is in use: netstat -ano | findstr :5000';
    } else {
      msg = err.message;
    }
    console.error(`[${new Date().toISOString()}] FAIL ${msg}`);
  }
};

console.log(`
+---------------------------------------------------+
|         AquaSense Sensor Simulator                |
+---------------------------------------------------+
  Device  : ${DEVICE_ID}
  Backend : ${BASE_URL}
  Interval: ${INTERVAL}ms
  API Key : ${API_KEY ? '(set)' : '(not set - OK for dev)'}
+---------------------------------------------------+
Press Ctrl+C to stop.
`);

// Quick connectivity check before starting loop
axios.get(`${BASE_URL}/health`, { timeout: 3000 })
  .then(r => {
    console.log(`[OK] Backend reachable - status: ${r.data.status}\n`);
    sendReading();
    setInterval(sendReading, INTERVAL);
  })
  .catch(err => {
    const code = err.code || (err.response ? `HTTP ${err.response.status}` : 'unknown');
    console.error(`
[ERROR] Cannot reach backend at ${BASE_URL}/health (${code})

Possible fixes:
  1. Start Docker containers:    docker compose up -d
  2. Check containers are up:   docker compose ps
  3. Check backend logs:        docker compose logs backend
  4. If running locally:        npm run dev  (in aquasense-backend folder)
  5. Wrong port? Check .env or docker-compose.yml for PORT setting
`);
    process.exit(1);
  });

process.on('SIGINT', () => {
  console.log(`\nSimulator stopped. Sent: ${successCount} | Errors: ${errorCount}`);
  process.exit(0);
});
