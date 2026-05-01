# AquaSense 💧
### Real-Time Water Quality Monitoring and Prediction Using Decision Tree Machine Learning with IoT Sensor Integration

> Continuously monitors water quality using ESP32 IoT sensors, classifies it into 5 WHO-standard quality classes using a trained Decision Tree ML model (99.79% accuracy), and displays results live on a React dashboard with WebSocket updates, threshold alerts, and Docker deployment.

---

## Project Demo

![AquaSense Dashboard](https://raw.githubusercontent.com/RangaMokshagna/AquaSense/main/dashboard.png)

> Live Dashboard showing real-time sensor readings, WQI score, and quality classification

---

## What is AquaSense?

AquaSense is a complete end-to-end IoT and Machine Learning system for water quality monitoring. Three physical sensors — pH, turbidity, and temperature — are connected to an ESP32 microcontroller that reads and transmits data every 5 seconds over WiFi. A Node.js backend receives the data, a Python FastAPI ML service classifies the water quality, and a React dashboard shows everything live.

The system classifies water into five WHO-standard quality classes — Excellent, Good, Poor, Very Poor, and Unsafe — using a pruned Decision Tree model with depth 8 and 17 leaves, achieving 99.79% F1 score on 31,103 real water quality samples.

---

## System Architecture

```
┌─────────────────────────────────────────────────────────┐
│                     IoT Layer                           │
│   pH Sensor (GPIO35) ──┐                                │
│   Turbidity (GPIO34)  ──┼── ESP32 WROOM-32 ──WiFi──►API│
│   DS18B20   (GPIO4)  ──┘                                │
└───────────────────────────┬─────────────────────────────┘
                            │ HTTP POST every 5s
                            ▼
┌─────────────────────────────────────────────────────────┐
│           Node.js Backend — Port 5000                   │
│   Save to MongoDB → Call ML Service → Check Alerts      │
│   Broadcast via Socket.io → React Dashboard             │
└──────────┬──────────────────────────┬───────────────────┘
           │                          │
           ▼                          ▼
┌──────────────────┐    ┌─────────────────────────────┐
│   MongoDB        │    │  Python ML Service Port 8000 │
│   readings       │    │  Decision Tree (pruned)      │
│   predictions    │    │  Depth=8  Leaves=17          │
│   alerts         │    │  F1=0.9979  Acc=99.79%       │
│   configs        │    │  5 WHO Quality Classes       │
└──────────────────┘    └─────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────┐
│           React Dashboard — Port 3000                   │
│   Live Dashboard │ Manual Input │ Dataset Predict       │
│   History        │ Alerts                               │
│   WebSocket live updates — latency < 100ms              │
└─────────────────────────────────────────────────────────┘
```

---

## ML Model Results

| Model | CV F1 (5-fold) | Test F1 | Accuracy | Train Time |
|---|---|---|---|---|
| Random Forest | 0.9989±0.0005 | 0.9982 | 99.82% | 17.3s |
| Gradient Boosting | 0.9988±0.0006 | 0.9979 | 99.79% | 244.7s |
| **Decision Tree (pruned) ✓** | **0.9987±0.0005** | **0.9979** | **99.79%** | **0.4s** |
| Decision Tree (full) | 0.9973±0.0008 | 0.9969 | 99.69% | 0.4s |
| XGBoost | 0.9963±0.0010 | 0.9955 | 99.55% | 14.1s |
| SVM (RBF) | 0.9863±0.0017 | 0.9867 | 98.67% | 30.8s |

**Why Decision Tree over Random Forest?**
- Only 0.032% accuracy difference
- 43× faster training (0.4s vs 17.3s)
- Fully explainable — 7 human-readable rules aligned with WHO standards
- With only 3 sensor inputs, 200-tree ensemble adds no real benefit

### Feature Importance

| Feature | Importance | Description |
|---|---|---|
| turbidity | 76.27% | Raw turbidity reading |
| ph_x_turb | 23.44% | pH deviation × log(turbidity) interaction |
| temp_deviation | 0.22% | \|temperature − 22\| |
| Others | 0.07% | ph, ph_sq, turb_log, ph_deviation |

### Water Quality Classes (WHO Standards)

| Class | WQI Score | pH Range | Turbidity |
|---|---|---|---|
| Excellent | 90–100 | 6.8–7.4 | < 1 NTU |
| Good | 70–89 | 6.5–8.5 | < 4 NTU |
| Poor | 50–69 | Outside 6.5–8.5 | 4–10 NTU |
| Very Poor | 25–49 | 5.0–6.0 or 9.0–10.0 | 10–20 NTU |
| Unsafe | 0–24 | < 5.0 or > 10.0 | > 20 NTU |

### Per-Class Performance

| Class | Precision | Recall | F1 | Support |
|---|---|---|---|---|
| Excellent | 0.9716 | 1.0000 | 0.9856 | 376 |
| Good | 1.0000 | 0.9972 | 0.9986 | 3,889 |
| Poor | 1.0000 | 1.0000 | 1.0000 | 1,392 |
| Unsafe | 1.0000 | 0.9912 | 0.9956 | 226 |
| Very Poor | 0.9941 | 1.0000 | 0.9971 | 338 |

---

## Dataset

| Property | Details |
|---|---|
| Total samples | 31,103 |
| Real data | 21,703 Brisbane river monitoring measurements |
| Synthetic data | 9,400 WHO-threshold based generated samples |
| Parameters | pH, Turbidity (NTU), Temperature (°C) |
| Train split | 80% — 24,882 samples |
| Test split | 20% — 6,221 samples |
| Split method | Stratified by quality class |

---

## Hardware

| Component | Model | Pin | Notes |
|---|---|---|---|
| Microcontroller | OceanLabz ESP32 WROOM-32 | — | WiFi + 12-bit ADC |
| Temperature | amiciSense DS18B20 Waterproof | GPIO 4 | Needs 4.7kΩ pull-up resistor |
| Turbidity | QBM Turbidity Sensor Module | GPIO 34 | Power with 5V (VIN pin) |
| pH Sensor | Analog pH Sensor Module | GPIO 35 | Power with 3.3V only |

### Wiring Summary

```
DS18B20:
  RED   → 3.3V
  BLACK → GND
  YELLOW→ GPIO 4
  4.7kΩ resistor between GPIO4 and 3.3V (mandatory)

Turbidity:
  VCC  → VIN (5V)
  GND  → GND
  AOUT → GPIO 34

pH Sensor:
  VCC  → 3.3V
  GND  → GND
  AOUT → GPIO 35
```

---

## Tech Stack

| Layer | Technology |
|---|---|
| IoT Firmware | C++ / Arduino IDE / ESP32 |
| ML Training | Python, scikit-learn, XGBoost, pandas |
| ML Serving | Python FastAPI + uvicorn |
| Backend API | Node.js 20, Express.js, Socket.io |
| Database | MongoDB 6.0 (Mongoose ODM) |
| Frontend | React 18, Vite, Recharts |
| Deployment | Docker, Docker Compose, nginx |

---

## Project Structure

```
aquasense/
│
├── AquaSense_ESP32/
│   └── AquaSense_ESP32.ino      ESP32 sensor firmware (single file)
│
├── aquasense-backend/
│   ├── server.js                Entry point
│   ├── src/
│   │   ├── models/              MongoDB schemas
│   │   │   ├── Reading.js
│   │   │   ├── Prediction.js
│   │   │   ├── Alert.js
│   │   │   └── Config.js
│   │   ├── routes/              REST API endpoints
│   │   │   ├── readings.js
│   │   │   ├── analytics.js
│   │   │   └── devices.js
│   │   └── services/            Core business logic
│   │       ├── readingService.js
│   │       ├── mlService.js
│   │       ├── alertService.js
│   │       └── mqttService.js
│   └── scripts/
│       └── simulate.js          Sensor data simulator
│
├── aquasense-ml/
│   ├── app.py                   FastAPI prediction server
│   ├── train.py                 ML training pipeline (6 models)
│   ├── data/
│   │   ├── clean_dataset.py     Data cleaning pipeline
│   │   ├── generate_dataset.py  Synthetic data generator
│   │   └── water_quality.csv    Training dataset (31,103 rows)
│   ├── models/                  Trained model artefacts
│   │   ├── best_model.joblib
│   │   ├── scaler.joblib
│   │   ├── label_encoder.joblib
│   │   └── model_meta.json
│   └── reports/                 Training reports and charts
│       ├── confusion_matrix.png
│       ├── feature_importance.png
│       └── decision_tree_rules_pruned.txt
│
├── aquasense-dashboard/
│   └── src/
│       ├── App.jsx              Main app with 5 tabs
│       ├── components/
│       │   ├── Header.jsx
│       │   ├── SensorCard.jsx
│       │   ├── WQIPanel.jsx
│       │   ├── LiveChart.jsx
│       │   ├── AlertPanel.jsx
│       │   ├── HistoryTable.jsx
│       │   ├── StatsBar.jsx
│       │   ├── ManualInput.jsx
│       │   └── DatasetPredict.jsx
│       ├── hooks/
│       │   └── useSocket.js     WebSocket live data hook
│       └── services/
│           └── api.js           REST API client
│
├── aquasense-deploy/
│   ├── docker-compose.yml       Full stack deployment
│   ├── nginx.conf               Dashboard + API proxy config
│   ├── dashboard.Dockerfile     React build → nginx container
│   ├── START.bat                Windows one-click launcher
│   └── .env.example             Environment variables template
│
├── .gitignore
└── README.md
```

---

## Quick Start

### Option A — Docker (Recommended — All 4 services with one command)

```bash
git clone https://github.com/RangaMokshagna/AquaSense.git
cd AquaSense/aquasense-deploy

cp .env.example .env
docker compose up --build -d
```

Open **http://localhost:3000**

### Option B — Run Locally (Development)

**Terminal 1 — ML Service**
```powershell
cd aquasense-ml
pip install -r requirements.txt
python train.py
uvicorn app:app --host 0.0.0.0 --port 8000
```

**Terminal 2 — Backend**
```powershell
cd aquasense-backend
npm install
npm run dev
```

**Terminal 3 — Dashboard**
```powershell
cd aquasense-dashboard
npm install
npm run dev
```

**Terminal 4 — Simulator (no hardware needed)**
```powershell
cd aquasense-backend
node scripts\simulate.js
```

Open **http://localhost:3000**

---

## ESP32 Setup

### Step 1 — Install Libraries in Arduino IDE

```
Tools → Manage Libraries → Install:
  1. OneWire           by Paul Stoffregen
  2. DallasTemperature by Miles Burton
  3. ArduinoJson       by Benoit Blanchon  ← v6.x only NOT v7
```

### Step 2 — Install ESP32 Board

```
File → Preferences → Additional boards manager URLs:
https://raw.githubusercontent.com/espressif/arduino-esp32/gh-pages/package_esp32_index.json

Tools → Board → Boards Manager → Search esp32 → Install
Tools → Board → esp32 → ESP32 Dev Module
```

### Step 3 — Configure Firmware

Open `AquaSense_ESP32/AquaSense_ESP32.ino`

Update these lines:
```cpp
#define WIFI_SSID      "Your WiFi Name"
#define WIFI_PASSWORD  "Your WiFi Password"
#define BACKEND_IP     "192.168.x.x"   // run ipconfig → IPv4 Address
```

### Step 4 — Upload

```
1. Select correct COM port: Tools → Port → COMx
2. Click Upload (→ arrow button)
3. Hold BOOT button during upload if needed
4. Open Serial Monitor at 115200 baud
```

### Step 5 — Expected Serial Monitor Output

```
================================
  AquaSense ESP32  v1.0
================================
  Device  : esp32-sensor-01
  Backend : http://192.168.43.1:5000

[WiFi]  Connecting to YourWiFi...... OK
[WiFi]  IP: 192.168.43.105  RSSI: -45 dBm
[Warmup] Stabilising sensors (3 readings)...
[Ready] Sending every 5s

─────────────────────────────────
[#1] pH:          7.24
[#1] Turbidity:   1.52 NTU
[#1] Temperature: 24.3 C
[HTTP]  POST http://192.168.43.1:5000/api/readings
[OK]   Quality=Good  WQI=85  Alerts=0
```

---

## Dashboard Features

| Tab | Description |
|---|---|
| **Live Dashboard** | Real-time IoT sensor data only — sensor cards, WQI ring gauge, 60-point rolling chart, WHO reference lines, alert panel |
| **Manual Input** | Enter pH, turbidity, temperature manually — instant ML prediction on right side |
| **Dataset Predict** | Upload CSV — batch ML predictions for all rows with 4 chart visualizations |
| **History** | Paginated table of all readings with quality overlays |
| **Alerts** | WHO threshold violations with resolve actions |

---

## API Reference

```
POST   /api/readings                    Ingest sensor reading
GET    /api/readings                    List readings (IoT only by default)
GET    /api/readings?iotOnly=false      All readings including manual
GET    /api/readings/latest             Latest per device

GET    /api/predictions                 ML predictions list
GET    /api/predictions/stats           Quality class breakdown
POST   /api/predictions/batch-manual   Batch predict from CSV upload

GET    /api/alerts                      Active alerts
PATCH  /api/alerts/:id/resolve          Resolve single alert
POST   /api/alerts/resolve-all          Resolve all alerts

GET    /api/devices                     Device list
GET    /health                          System health check
```

### ML Service API

```
POST http://localhost:8000/predict
Body: { "ph": 7.2, "turbidity": 1.5, "temperature": 24.0 }

Response:
{
  "quality_class": "Good",
  "wqi_score": 85.2,
  "confidence": 0.97,
  "model_version": "2.0.0",
  "model_name": "Decision Tree (pruned)"
}

GET http://localhost:8000/health
GET http://localhost:8000/model/info
```

---

## Service Ports

| Service | Port | URL |
|---|---|---|
| React Dashboard | 3000 | http://localhost:3000 |
| Node.js Backend | 5000 | http://localhost:5000/health |
| Python ML Service | 8000 | http://localhost:8000/docs |
| MongoDB | 27017 | mongodb://localhost:27017 |

---

## Docker Commands

```powershell
# Start all services
docker compose up -d

# Start with rebuild
docker compose up --build -d

# Rebuild with no cache (use when code changes not picked up)
docker compose build --no-cache
docker compose up -d

# Stop all services
docker compose down

# View logs
docker compose logs -f

# Check container status
docker compose ps

# Clear all data and restart fresh
docker compose down --volumes
docker compose up --build -d
```

---

## ML Training

```powershell
cd aquasense-ml

# Clean the dataset first
python data/clean_dataset.py

# Train all 6 models and compare
python train.py

# Results saved to:
# models/best_model.joblib
# models/scaler.joblib
# models/label_encoder.joblib
# models/model_meta.json
# reports/confusion_matrix.png
# reports/feature_importance.png
# reports/decision_tree_rules_pruned.txt
```

---

## Environment Variables

Copy `.env.example` to `.env` and fill in:

```env
PORT=5000
MONGODB_URI=mongodb://localhost:27017/aquasense
ML_SERVICE_URL=http://localhost:8000
API_KEY=changeme
FRONTEND_URL=http://localhost:3000
```

---

## Common Issues

| Issue | Cause | Fix |
|---|---|---|
| ESP32 brownout reset loop | USB cable not providing enough current | Use different USB cable or add brownout disable code |
| WiFi not connecting | Wrong SSID or password | Check exact hotspot name and password |
| No response from backend | Wrong BACKEND_IP | Run ipconfig and update IP in firmware |
| DS18B20 shows -999 | Missing 4.7kΩ resistor | Add resistor between GPIO4 and 3.3V |
| pH shows 14.00, ADC=0 | pH sensor not connected | Check GPIO35 wire connection |
| Turbidity shows 2300 NTU | Turbidity not connected | Check GPIO34 wire connection |
| Docker shows old 3 tabs | Old image cached | Run docker compose build --no-cache |
| Confidence shows dash | ML service not running | Start uvicorn app:app --port 8000 |
| ECONNABORTED in Vite | Browser WebSocket reconnect | Normal — ignore this error |

---

## Troubleshooting ESP32

```
Garbage in Serial Monitor  → Change baud rate to 115200
Upload fails (Connecting…) → Hold BOOT button during upload
COM port not found         → Install CP2102 driver
ArduinoJson errors         → Must use version 6.x not 7.x
Board not found            → Select ESP32 Dev Module in Tools → Board
```

---

## Sustainable Development Goals

This project contributes to:

**SDG 6 — Clean Water and Sanitation:** Provides affordable, continuous water quality monitoring for communities without access to laboratory testing.

**SDG 3 — Good Health and Well-Being:** Early detection of water contamination reduces risk of waterborne diseases.

**SDG 9 — Industry, Innovation and Infrastructure:** Demonstrates IoT and AI technology applied to a real-world public health challenge.

---

## 👥 Team Contributions

| Name |
|---|
| K. Darshan Sai | 
| J. Ranga Mokshagna | 
| P. Bharat Sai | 

**Institution:** SRM Institute of Science and Technology, Kattankulathur

**Department:** Department of Data Science And Business Systems

**Academic Year:** 2025–2026

---

*AquaSense — Making water safety visible, understandable, and actionable.* 💧
