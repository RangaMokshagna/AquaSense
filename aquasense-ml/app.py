"""
app.py — AquaSense ML Prediction Service
FastAPI server that loads the trained model and serves predictions.

Endpoints:
  GET  /health         — liveness + model info
  POST /predict        — single prediction
  POST /predict/batch  — batch predictions (up to 100)
  GET  /model/info     — model metadata
"""

import json
import time
import logging
from pathlib import Path
from typing import Optional
from contextlib import asynccontextmanager

import joblib
import numpy as np
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, ConfigDict, Field, field_validator

# ── Logging ────────────────────────────────────────────────────────────────
logging.basicConfig(
    level=logging.INFO,
    format="[%(asctime)s] %(levelname)s: %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
)
log = logging.getLogger("aquasense-ml")

# ── Paths ──────────────────────────────────────────────────────────────────
MODELS_DIR  = Path("models")
META_PATH   = MODELS_DIR / "model_meta.json"

# ── Global model state ─────────────────────────────────────────────────────
_model   = None
_scaler  = None
_le      = None
_meta    = {}

WQI_MAP = {
    "Excellent": (90, 100),
    "Good":      (70,  89),
    "Poor":      (50,  69),
    "Very Poor": (25,  49),
    "Unsafe":    (0,   24),
}

def load_artefacts():
    global _model, _scaler, _le, _meta
    log.info("Loading model artefacts...")
    _model  = joblib.load(MODELS_DIR / "best_model.joblib")
    _scaler = joblib.load(MODELS_DIR / "scaler.joblib")
    _le     = joblib.load(MODELS_DIR / "label_encoder.joblib")
    _meta   = json.loads(META_PATH.read_text())
    log.info(f"Model loaded: {_meta['model_name']}  v{_meta['model_version']}  "
             f"F1={_meta['test_f1']}")


def engineer_features(ph: float, turbidity: float, temperature: float) -> np.ndarray:
    """Apply the same feature engineering used during training."""
    ph_dev   = abs(ph - 7.0)
    ph_sq    = ph ** 2
    turb_log = np.log1p(turbidity)
    temp_dev = abs(temperature - 22.0)
    ph_x_t   = ph_dev * turb_log
    return np.array([[ph, turbidity, temperature, ph_dev, ph_sq, turb_log, temp_dev, ph_x_t]])


def compute_wqi(quality_class: str, ph: float, turbidity: float, temperature: float) -> float:
    low, high = WQI_MAP[quality_class]
    base = (low + high) / 2.0
    ph_penalty   = abs(ph - 7.0) * 1.5
    turb_penalty = min(turbidity, 50) * 0.3
    temp_penalty = max(0, abs(temperature - 22) - 5) * 0.4
    return round(float(np.clip(base - ph_penalty - turb_penalty - temp_penalty, low, high)), 2)


def _predict_one(ph: float, turbidity: float, temperature: float) -> dict:
    X = engineer_features(ph, turbidity, temperature)

    if _meta.get("uses_scaling", False):
        X = _scaler.transform(X)

    label_idx   = int(_model.predict(X)[0])
    quality     = _le.inverse_transform([label_idx])[0]
    wqi         = compute_wqi(quality, ph, turbidity, temperature)

    confidence = None
    if hasattr(_model, "predict_proba"):
        proba      = _model.predict_proba(X)[0]
        confidence = round(float(proba[label_idx]), 4)

    return {
        "quality_class":  quality,
        "wqi_score":      wqi,
        "confidence":     confidence,
        "model_name":     _meta.get("model_name"),
        "model_version":  _meta.get("model_version", "2.0.0"),
    }


# ── Lifespan ───────────────────────────────────────────────────────────────
@asynccontextmanager
async def lifespan(app: FastAPI):
    load_artefacts()
    yield
    log.info("Shutting down ML service")


# ── App ────────────────────────────────────────────────────────────────────
app = FastAPI(
    title="AquaSense ML Service",
    description="Water quality prediction via trained ML model",
    version="2.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


# ── Schemas ────────────────────────────────────────────────────────────────
class SensorInput(BaseModel):
    ph:          float = Field(..., ge=0.0, le=14.0,  description="pH value (0–14)")
    turbidity:   float = Field(..., ge=0.0, le=1000.0, description="Turbidity in NTU")
    temperature: float = Field(..., ge=-10.0, le=100.0, description="Temperature in °C")

    @field_validator("ph")
    @classmethod
    def ph_range(cls, v):
        if not (0 <= v <= 14):
            raise ValueError("pH must be between 0 and 14")
        return round(v, 4)

    @field_validator("turbidity")
    @classmethod
    def turbidity_range(cls, v):
        if v < 0:
            raise ValueError("turbidity must be >= 0")
        return round(v, 4)


class PredictionResponse(BaseModel):
    model_config = ConfigDict(protected_namespaces=())
    
    quality_class:  str
    wqi_score:      float
    confidence:     Optional[float]
    model_name:     str
    model_version:  str
    latency_ms:     float


class BatchRequest(BaseModel):
    readings: list[SensorInput] = Field(..., max_length=100)


class BatchResponse(BaseModel):
    predictions: list[PredictionResponse]
    count:       int
    latency_ms:  float


# ── Routes ─────────────────────────────────────────────────────────────────
@app.get("/health")
def health():
    if _model is None:
        raise HTTPException(status_code=503, detail="Model not loaded")
    return {
        "status":        "ok",
        "service":       "AquaSense ML Service",
        "model_name":    _meta.get("model_name"),
        "model_version": _meta.get("model_version"),
        "test_f1":       _meta.get("test_f1"),
    }


@app.post("/predict", response_model=PredictionResponse)
def predict(data: SensorInput):
    if _model is None:
        raise HTTPException(status_code=503, detail="Model not loaded")
    t0 = time.perf_counter()
    result = _predict_one(data.ph, data.turbidity, data.temperature)
    ms = round((time.perf_counter() - t0) * 1000, 2)
    log.info(
        f"Predict: pH={data.ph} turb={data.turbidity} temp={data.temperature} "
        f"→ {result['quality_class']} (WQI {result['wqi_score']}) [{ms}ms]"
    )
    return {**result, "latency_ms": ms}


@app.post("/predict/batch", response_model=BatchResponse)
def predict_batch(body: BatchRequest):
    if _model is None:
        raise HTTPException(status_code=503, detail="Model not loaded")
    t0 = time.perf_counter()
    predictions = []
    for r in body.readings:
        result = _predict_one(r.ph, r.turbidity, r.temperature)
        predictions.append({**result, "latency_ms": 0.0})
    total_ms = round((time.perf_counter() - t0) * 1000, 2)
    return {"predictions": predictions, "count": len(predictions), "latency_ms": total_ms}


@app.get("/model/info")
def model_info():
    if not _meta:
        raise HTTPException(status_code=503, detail="Model not loaded")
    return _meta
