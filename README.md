# AquaSense — Water Quality Prediction Using ML with IoT Integration

> Real-time water quality monitoring system using ESP32 IoT sensors, SVM machine learning model, and React live dashboard with Node.js backend and MongoDB.

---

## What is AquaSense?

AquaSense continuously monitors water quality using three physical sensors (pH, turbidity, temperature) connected to an ESP32 microcontroller. Sensor data is sent over WiFi to a Node.js backend, stored in MongoDB, analyzed by a trained SVM classifier, and displayed in real time on a React dashboard with live charts, alerts, and manual input support.

---

## System Architecture

```
┌─────────────────────────────────────────────────────┐
│                    IoT Layer                        │
│   pH Sensor ──┐                                     │
│   Turbidity ──┼── ESP32 WROOM-32 ── WiFi ──► API   │
│   DS18B20   ──┘                                     │
└──────────────────────────┬──────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────┐
│              Node.js Backend (Port 5000)            │
│  Save to MongoDB → Call ML Service → Check Alerts  │
│  Broadcast via Socket.io → React Dashboard         │
└──────────┬────────────────────────┬─────────────────┘
           │                        │
           ▼                        ▼
┌──────────────────┐    ┌──────────────────────────┐
│  MongoDB         │    │  Python ML Service        │
│  readings        │    │  FastAPI + SVM Model      │
│  predictions     │    │  F1 Score = 0.9227        │
│  alerts          │    │  5 Quality Classes        │
│  configs         │    │  WQI Score 0-100          │
└──────────────────┘    └──────────────────────────┘
```

---

## Features

- **Live Dashboard** — Real-time sensor cards, WQI ring gauge, rolling line chart
- **ML Prediction** — SVM classifier with 92.27% F1 score, 5 quality classes
- **Alert System** — Threshold violations with severity levels (warning / critical)
- **Manual Input** — Enter sensor values manually and get instant ML prediction
- **Dataset Predict** — Upload CSV file and get batch ML predictions with charts
- **History Table** — Paginated readings with quality overlays
- **WebSocket** — Socket.io live push, no page refresh needed
- **IoT Firmware** — ESP32 Arduino firmware for physical sensor integration
- **Docker Deploy** — Full stack runs with one command

---

## ML Model Results

| Model | CV F1 (5-fold) | Test F1 | Accuracy |
|---|---|---|---|
| **SVM (RBF) ← Winner** | **0.9310** | **0.9227** | **92.23%** |
| Random Forest | 0.9274 | 0.9209 | 92.07% |
| XGBoost | 0.9231 | 0.9163 | 91.60% |
| Gradient Boosting | 0.9240 | 0.9157 | 91.54% |
| Decision Tree (pruned) | — | 0.9036 | 90.37% |
| Decision Tree | — | 0.8816 | 88.19% |

### Quality Classes (WHO Standards)

| Class | WQI Score | pH Range | Turbidity |
|---|---|---|---|
| Excellent | 90–100 | 6.8–7.4 | < 1 NTU |
| Good | 70–89 | 6.5–8.5 | < 4 NTU |
| Poor | 50–69 | Outside 6.5–8.5 | 4–10 NTU |
| Very Poor | 25–49 | 5.0–6.0 or 9–10 | 10–20 NTU |
| Unsafe | 0–24 | < 5.0 or > 10.0 | > 20 NTU |

---

## Hardware

| Component | Model | GPIO Pin |
|---|---|---|
| Microcontroller | OceanLabz ESP32 WROOM-32 (C Type) | — |
| Temperature | amiciSense DS18B20 Waterproof | GPIO 4 |
| Turbidity | QBM Turbidity Sensor Module | GPIO 34 |
| pH Sensor | Analog pH Sensor (SEN0161 style) | GPIO 35 |
| Breadboard | OSFT 830 Point | — |
| Resistor | 4.7kΩ (DS18B20 pull-up) | DATA → 3.3V |

### Wiring Summary

```
DS18B20   → GPIO 4   (+ 4.7kΩ between DATA and 3.3V)
Turbidity → GPIO 34  (analog signal)
pH Sensor → GPIO 35  (analog signal)
All VCC   → 3.3V or VIN
All GND   → GND
```

---

## Tech Stack

| Layer | Technology |
|---|---|
| IoT Firmware | C++ / Arduino IDE / ESP32 |
| ML Training | Python, scikit-learn, XGBoost |
| ML Serving | Python FastAPI + uvicorn |
| Backend API | Node.js, Express, Socket.io |
| Database | MongoDB (Mongoose ODM) |
| Frontend | React 18, Vite, Recharts |
| Deployment | Docker, Docker Compose |

---

## Quick Start

### Option A — Docker (all 4 services with one command)

```bash
git clone https://github.com/YOUR_USERNAME/aquasense.git
cd aquasense/aquasense-deploy

cp .env.example .env
docker compose up --build -d
```

Open **http://localhost:3000**

### Option B — Run locally (development)

```bash
# Terminal 1 — ML Service
cd aquasense-ml
pip install -r requirements.txt
python train.py
uvicorn app:app --port 8000

# Terminal 2 — Backend
cd aquasense-backend
npm install
npm run dev

# Terminal 3 — Dashboard
cd aquasense-dashboard
npm install
npm run dev

# Terminal 4 — Sensor Simulator (no hardware needed)
cd aquasense-backend
node scripts/simulate.js
```

Open **http://localhost:3000**

---

## Project Structure

```
aquasense/
│
├── AquaSense_ESP32/
│   └── AquaSense_ESP32.ino       ESP32 firmware (single file)
│
├── aquasense-backend/
│   ├── server.js                 Entry point
│   └── src/
│       ├── models/               MongoDB schemas (Reading, Prediction, Alert)
│       ├── routes/               REST API routes
│       ├── services/             ML client, alert engine, MQTT, WebSocket
│       └── scripts/simulate.js  Sensor data simulator
│
├── aquasense-ml/
│   ├── app.py                    FastAPI prediction server
│   ├── train.py                  ML training pipeline (6 models)
│   ├── data/generate_dataset.py  Dataset generator (9,400 samples)
│   └── models/                   Trained model artefacts
│
├── aquasense-dashboard/
│   └── src/
│       ├── components/           SensorCard, WQIPanel, LiveChart, Alerts...
│       ├── hooks/useSocket.js    Real-time WebSocket hook
│       └── services/api.js       REST API client
│
└── aquasense-deploy/
    ├── docker-compose.yml        Full stack deployment
    ├── nginx.conf                Dashboard + API proxy
    └── START.bat                 Windows one-click launcher
```

---

## API Reference

```
POST /api/readings              Ingest sensor reading (runs ML + alerts)
GET  /api/readings              List readings (paginated)
GET  /api/readings/latest       Latest reading per device

GET  /api/predictions           ML predictions list
GET  /api/predictions/stats     Quality class breakdown
POST /api/predictions/batch-manual  Batch predict from CSV upload

GET  /api/alerts                Active alerts
PATCH /api/alerts/:id/resolve   Resolve single alert

GET  /api/devices               Device list
POST /api/devices               Register device + thresholds
```

### ML Service

```
POST http://localhost:8000/predict
{ "ph": 7.2, "turbidity": 1.5, "temperature": 24.0 }

Response:
{
  "quality_class": "Excellent",
  "wqi_score": 95.2,
  "confidence": 0.92,
  "model_version": "2.0.0",
  "latency_ms": 1.4
}
```

---

## Dashboard Tabs

| Tab | Description |
|---|---|
| Live Dashboard | Real-time IoT sensor data only — charts, WQI, alerts |
| Manual Input | Enter values manually, get instant ML prediction |
| Dataset Predict | Upload CSV, batch predict, visualize with 4 chart types |
| History | All readings table with quality overlays |
| Alerts | Threshold violations with resolve actions |

---

## Running Tests

```bash
# ML Service — 17 tests
cd aquasense-ml
pytest tests/ -v

# Backend — integration tests
cd aquasense-backend
npm test
```

---

## Service Ports

| Service | Port | URL |
|---|---|---|
| React Dashboard | 3000 | http://localhost:3000 |
| Node.js Backend | 5000 | http://localhost:5000/health |
| ML Service | 8000 | http://localhost:8000/docs |
| MongoDB | 27017 | mongodb://localhost:27017 |

---

## Screenshots

> Dashboard showing live sensor readings with WQI score of 95 (Excellent)

---

## License

MIT License — free to use for academic and personal projects.

---

## Author

**Jayav** — Final Year Project  
Water Quality Prediction Using ML with IoT Integration  
Department of Computer Science / Electronics  
2025–2026
