# AquaSense — Real-Time Water Quality Monitoring System

> IoT + Machine Learning system for continuous water quality prediction using ESP32 sensors, a trained SVM classifier, and a live React dashboard.

---

## System Architecture

```
pH Sensor ──┐
Turbidity ──┼── ESP32 WROOM-32 ── WiFi ──► Node.js API ──► MongoDB
DS18B20   ──┘                                   │
                                                 ├──► ML Service (SVM F1=0.923)
                                                 └──► React Dashboard (WebSocket)
```

---

## Tech Stack

| Layer | Technology |
|---|---|
| IoT Firmware | C++ / Arduino / ESP32 |
| ML Training | Python, scikit-learn, XGBoost |
| ML Serving | Python FastAPI |
| Backend API | Node.js, Express, Socket.io |
| Database | MongoDB |
| Frontend | React 18, Vite, Recharts |
| Deploy | Docker Compose |

---

## ML Model Results

| Model | Test F1 | Accuracy |
|---|---|---|
| SVM RBF (winner) | 0.9227 | 92.23% |
| Random Forest | 0.9209 | 92.07% |
| XGBoost | 0.9190 | 91.86% |

### Quality Classes (WHO Standards)
| Class | WQI | pH | Turbidity |
|---|---|---|---|
| Excellent | 90-100 | 6.8-7.4 | <1 NTU |
| Good | 70-89 | 6.5-8.5 | <4 NTU |
| Poor | 50-69 | outside 6.5-8.5 | 4-10 NTU |
| Very Poor | 25-49 | 5.0-6.0 | 10-20 NTU |
| Unsafe | 0-24 | <5 or >10 | >20 NTU |

---

## Quick Start

### Docker (recommended)
```bash
cp .env.example .env
docker compose up --build -d
# Open http://localhost:3000
```

### Local development
```bash
# Terminal 1
cd aquasense-ml && pip install -r requirements.txt && python train.py && uvicorn app:app --port 8000

# Terminal 2
cd aquasense-backend && npm install && npm run dev

# Terminal 3
cd aquasense-dashboard && npm install && npm run dev

# Terminal 4 (simulator)
cd aquasense-backend && node scripts/simulate.js
```

---

## Hardware

| Component | Model | GPIO |
|---|---|---|
| Microcontroller | ESP32 WROOM-32 | — |
| Temperature | DS18B20 Waterproof | GPIO 4 |
| Turbidity | QBM Analog Module | GPIO 34 |
| pH | Analog pH Sensor | GPIO 35 |

---

## API Reference

```
POST /api/readings          Ingest sensor data
GET  /api/readings          List readings
GET  /api/predictions       ML predictions
GET  /api/alerts            Active alerts
POST /api/alerts/resolve-all Bulk resolve

ML Service:
POST /predict               {ph, turbidity, temperature}
GET  /model/info            Model metadata
```

---

## Project Structure
```
aquasense/
├── aquasense-backend/     Node.js API + MongoDB
├── aquasense-ml/          Python ML service
├── aquasense-dashboard/   React dashboard
├── aquasense-esp32/       ESP32 firmware
├── docker-compose.yml     Full stack deploy
└── START.bat              One-click Windows launcher
```

---

## Tests
```bash
cd aquasense-ml      && pytest tests/ -v    # 17 tests
cd aquasense-backend && npm test            # integration tests
```

*Final year project — IoT + ML + Full Stack integration.*
