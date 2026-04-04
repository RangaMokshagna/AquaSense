# AquaSense ML Service

Python FastAPI service that predicts water quality from IoT sensor readings (pH, turbidity, temperature).

## Model Performance

| Model             | CV F1 (5-fold) | Test F1 | Test Accuracy |
|-------------------|---------------|---------|---------------|
| SVM (RBF) ✓ best  | 0.9310        | 0.9227  | 92.23%        |
| Random Forest     | 0.9274        | 0.9209  | 92.07%        |
| XGBoost           | 0.9232        | 0.9190  | 91.86%        |
| Gradient Boosting | 0.9230        | 0.9189  | 91.86%        |

### Per-class metrics (SVM)
| Class     | Precision | Recall | F1    |
|-----------|-----------|--------|-------|
| Excellent | 0.905     | 0.975  | 0.939 |
| Good      | 0.964     | 0.908  | 0.935 |
| Poor      | 0.911     | 0.918  | 0.914 |
| Unsafe    | 0.989     | 0.918  | 0.952 |
| Very Poor | 0.844     | 0.887  | 0.865 |

## Quality Classes & WQI Bands

| Class     | WQI Score | WHO / Standard Thresholds                        |
|-----------|-----------|--------------------------------------------------|
| Excellent | 90–100    | pH 6.8–7.4, turbidity <1 NTU, temp 20–25°C      |
| Good      | 70–89     | pH 6.5–8.5, turbidity <4 NTU (WHO drinking limit)|
| Poor      | 50–69     | pH outside 6.5–8.5 or turbidity 4–10 NTU        |
| Very Poor | 25–49     | pH 5–6 or 9–10, turbidity 10–20 NTU             |
| Unsafe    | 0–24      | pH <5 or >10, turbidity >20 NTU                  |

## Quick Start

### Option A — Run with Docker

```bash
# Retrain and build
python train.py
docker compose up -d

# Test
curl http://localhost:8000/health
curl -X POST http://localhost:8000/predict \
  -H "Content-Type: application/json" \
  -d '{"ph": 7.2, "turbidity": 1.5, "temperature": 24.0}'
```

### Option B — Run locally

```bash
pip install -r requirements.txt
python train.py          # train model → saves to models/
uvicorn app:app --reload --port 8000
```

### Run tests

```bash
pytest tests/ -v
```

## API Reference

### POST /predict

```json
// Request
{ "ph": 7.2, "turbidity": 1.5, "temperature": 24.0 }

// Response
{
  "quality_class":  "Excellent",
  "wqi_score":      92.5,
  "confidence":     0.9612,
  "model_name":     "SVM (RBF)",
  "model_version":  "2.0.0",
  "latency_ms":     1.24
}
```

### POST /predict/batch

```json
// Request — up to 100 readings
{ "readings": [
    { "ph": 7.2, "turbidity": 1.5, "temperature": 24.0 },
    { "ph": 5.8, "turbidity": 9.0, "temperature": 31.0 }
]}

// Response
{
  "predictions": [ ... ],
  "count": 2,
  "latency_ms": 3.1
}
```

### GET /model/info
Returns training metadata: model name, version, F1 score, features, class list.

## Feature Engineering

The model uses 8 features derived from the 3 sensor inputs:

| Feature        | Description                            |
|----------------|----------------------------------------|
| ph             | Raw pH value                           |
| turbidity      | Raw NTU value                          |
| temperature    | Raw °C value                           |
| ph_deviation   | `|ph - 7.0|` — distance from neutral   |
| ph_sq          | `ph²` — non-linear pH response         |
| turb_log       | `log(1 + turbidity)` — de-skewed       |
| temp_deviation | `|temp - 22|` — distance from ideal    |
| ph_x_turb      | `ph_deviation × turb_log` — interaction|

## Project Structure

```
aquasense-ml/
├── app.py                   # FastAPI service
├── train.py                 # Full training pipeline
├── requirements.txt
├── Dockerfile
├── docker-compose.yml
├── data/
│   ├── generate_dataset.py  # Synthetic dataset generator
│   └── water_quality.csv    # Generated training data (9,400 rows)
├── models/
│   ├── best_model.joblib    # Trained SVM
│   ├── scaler.joblib        # StandardScaler
│   ├── label_encoder.joblib # LabelEncoder
│   └── model_meta.json      # Training metadata
├── reports/
│   ├── classification_report.txt
│   └── confusion_matrix.png
└── tests/
    └── test_api.py          # 17 pytest tests
```

## Integration with AquaSense Backend

The Node.js backend calls this service automatically on every sensor reading.
Ensure `ML_SERVICE_URL=http://localhost:8000` is set in the backend `.env`.
If this service is unreachable, the backend falls back to a rule-based scorer.
