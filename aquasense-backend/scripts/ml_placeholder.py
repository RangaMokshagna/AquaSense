"""
AquaSense — Placeholder ML Service
This is a simple rule-based scorer used until the real ML model (Phase 2) is built.
Replace this file with your trained model + FastAPI app in Phase 2.

Run standalone: pip install fastapi uvicorn && uvicorn ml_placeholder:app --port 8000
"""

from fastapi import FastAPI
from pydantic import BaseModel

app = FastAPI(title="AquaSense ML Service (Placeholder)")


class SensorInput(BaseModel):
    ph: float
    turbidity: float
    temperature: float


@app.get("/health")
def health():
    return {"status": "ok", "note": "placeholder — replace with real ML model in Phase 2"}


@app.post("/predict")
def predict(data: SensorInput):
    score = 100

    # pH penalty (WHO: 6.5–8.5)
    if data.ph < 6.5 or data.ph > 8.5:
        score -= 20
    if data.ph < 6.0 or data.ph > 9.0:
        score -= 20

    # Turbidity penalty (WHO: <1 NTU ideal, <4 NTU acceptable)
    if data.turbidity > 1:
        score -= 10
    if data.turbidity > 4:
        score -= 20
    if data.turbidity > 10:
        score -= 20

    # Temperature penalty
    if data.temperature < 10 or data.temperature > 35:
        score -= 10
    if data.temperature < 5 or data.temperature > 40:
        score -= 15

    score = max(0, score)

    if score >= 90:
        quality_class = "Excellent"
    elif score >= 70:
        quality_class = "Good"
    elif score >= 50:
        quality_class = "Poor"
    elif score >= 25:
        quality_class = "Very Poor"
    else:
        quality_class = "Unsafe"

    return {
        "quality_class": quality_class,
        "wqi_score": score,
        "confidence": 0.85,
        "model_version": "placeholder-1.0",
    }
