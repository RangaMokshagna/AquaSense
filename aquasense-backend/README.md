# AquaSense — Water Quality Monitoring Backend

Node.js + MongoDB backend for the AquaSense IoT water quality monitoring system. Handles sensor ingestion (MQTT & HTTP), ML prediction requests, alert evaluation, and real-time WebSocket broadcasting.

---

## Architecture

```
IoT Sensors (ESP32)
    │  MQTT / HTTP POST
    ▼
Node.js + Express (this service)   ←── React Dashboard (WebSocket + REST)
    │  saves to                              ▲
    ▼                                        │ Socket.io live updates
  MongoDB ─── collections ────────────────────
    │  readings · predictions · alerts · config
    │
    ▼  HTTP POST /predict
Python FastAPI (ML Service)
```

---

## Quick Start

### 1. Clone and install
```bash
git clone <repo>
cd aquasense-backend
npm install
```

### 2. Configure environment
```bash
cp .env.example .env
# Edit .env — set MONGODB_URI, API_KEY, etc.
```

### 3. Start with Docker Compose (recommended)
```bash
docker-compose up -d
```
This starts MongoDB, the Node.js backend, and a placeholder ML service.

### 4. Or run locally
```bash
# Requires MongoDB running locally on port 27017
npm run dev
```

### 5. Test the setup
```bash
# Health check
curl http://localhost:5000/health

# Send a test reading
curl -X POST http://localhost:5000/api/readings \
  -H "Content-Type: application/json" \
  -d '{"deviceId":"sensor-01","ph":7.2,"turbidity":1.5,"temperature":24.0}'

# Run simulator (no hardware needed)
node scripts/simulate.js
```

### 6. Run tests
```bash
npm test
```

---

## REST API

All routes (except `/health`) require the `x-api-key` header in production.

### Readings

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/readings` | Ingest a sensor reading (runs ML + alert check) |
| `GET`  | `/api/readings` | List readings (`?deviceId=&from=&to=&limit=&page=`) |
| `GET`  | `/api/readings/latest` | Latest reading per device |
| `GET`  | `/api/readings/averages` | Hourly averages (`?deviceId=&from=&to=`) |
| `GET`  | `/api/readings/:id` | Single reading by ID |

### Predictions

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET`  | `/api/predictions` | List predictions with filters |
| `GET`  | `/api/predictions/stats` | Quality class breakdown |

### Alerts

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET`  | `/api/alerts` | List alerts (`?resolved=false&severity=critical`) |
| `PATCH`| `/api/alerts/:id/resolve` | Resolve single alert |
| `POST` | `/api/alerts/resolve-all` | Bulk resolve `{ deviceId }` |

### Devices

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET`  | `/api/devices` | List all device configs |
| `GET`  | `/api/devices/:deviceId` | Single device config |
| `POST` | `/api/devices` | Register device |
| `PATCH`| `/api/devices/:deviceId/thresholds` | Update alert thresholds |

---

## POST /api/readings — Payload

```json
{
  "deviceId":    "sensor-01",
  "ph":          7.2,
  "turbidity":   1.5,
  "temperature": 24.0,
  "timestamp":   "2024-01-15T10:30:00Z"  // optional, defaults to now
}
```

**Response:**
```json
{
  "success": true,
  "reading":    { "_id": "...", "deviceId": "sensor-01", "ph": 7.2, ... },
  "prediction": { "qualityClass": "Good", "wqiScore": 78, "confidence": 0.92 },
  "alerts":     []
}
```

---

## WebSocket Events

Connect with Socket.io from the React dashboard:

```js
import { io } from 'socket.io-client';
const socket = io('http://localhost:5000');

// All sensor updates (all devices)
socket.on('sensor_update', ({ reading, prediction, alerts }) => { ... });

// Subscribe to a specific device only
socket.emit('subscribe_device', 'sensor-01');
socket.on('device_update', ({ reading, prediction, alerts }) => { ... });

// Real-time alerts
socket.on('alert', (alert) => { ... });
```

---

## MongoDB Collections

| Collection    | Purpose |
|---------------|---------|
| `readings`    | Raw sensor values (pH, turbidity, temperature) |
| `predictions` | ML quality class + WQI score per reading |
| `alerts`      | Threshold violations with severity |
| `configs`     | Per-device settings and alert thresholds |

---

## MQTT Sensor Format

Publish to topic: `aquasense/sensors/<deviceId>`

```json
{
  "deviceId":    "sensor-01",
  "ph":          7.2,
  "turbidity":   1.5,
  "temperature": 24.0
}
```

---

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `5000` | Server port |
| `MONGODB_URI` | `mongodb://localhost:27017/aquasense` | MongoDB connection string |
| `ML_SERVICE_URL` | `http://localhost:8000` | Python FastAPI ML service |
| `MQTT_BROKER_URL` | *(unset)* | MQTT broker (leave unset to disable) |
| `API_KEY` | *(unset)* | Auth key for all `/api/*` routes |
| `FRONTEND_URL` | `*` | CORS origin for React dashboard |
| `DEFAULT_PH_MIN/MAX` | `6.5 / 8.5` | Fallback alert thresholds |
| `DEFAULT_TURBIDITY_MAX` | `4.0` | NTU — WHO drinking water standard |

---

## Project Structure

```
aquasense-backend/
├── server.js                   # Entry point
├── docker-compose.yml
├── Dockerfile
├── .env.example
├── scripts/
│   ├── simulate.js             # Sensor data simulator
│   └── mongo-init.js           # DB bootstrap
├── src/
│   ├── config/db.js            # MongoDB connection
│   ├── models/
│   │   ├── Reading.js
│   │   ├── Prediction.js
│   │   ├── Alert.js
│   │   └── Config.js
│   ├── routes/
│   │   ├── readings.js
│   │   ├── analytics.js        # /predictions + /alerts
│   │   └── devices.js
│   ├── services/
│   │   ├── readingService.js   # Core ingestion pipeline
│   │   ├── mlService.js        # FastAPI client + fallback scorer
│   │   ├── alertService.js     # Threshold evaluation
│   │   └── mqttService.js      # MQTT subscriber
│   ├── middleware/auth.js
│   ├── socket/socketHandler.js
│   └── utils/logger.js
└── server.test.js              # Jest integration tests
```

---

## Next Steps

| Phase | What to build next |
|-------|--------------------|
| Phase 2 | Python FastAPI ML service — train Random Forest / XGBoost model |
| Phase 3 | React dashboard — live charts, WQI gauge, alert panel |
| Phase 4 | ESP32 firmware — pH + turbidity + temperature → MQTT |
| Phase 5 | Docker deploy to Railway / Render / AWS |
