"""
tests/test_api.py — AquaSense ML Service Tests
Run: pytest tests/ -v
"""

import pytest
from fastapi.testclient import TestClient

# Patch model loading before importing app
import sys
import json
import numpy as np
from pathlib import Path
from unittest.mock import MagicMock, patch

# ── Build mock artefacts ───────────────────────────────────────────────────
mock_model = MagicMock()
mock_model.predict.return_value = np.array([0])          # "Excellent"
mock_model.predict_proba.return_value = np.array([[0.95, 0.03, 0.01, 0.005, 0.005]])

mock_scaler = MagicMock()
mock_scaler.transform.side_effect = lambda x: x

mock_le = MagicMock()
mock_le.inverse_transform.return_value = ["Excellent"]

mock_meta = {
    "model_name":    "SVM (RBF)",
    "model_version": "2.0.0",
    "features":      ["ph", "turbidity", "temperature",
                      "ph_deviation", "ph_sq", "turb_log", "temp_deviation", "ph_x_turb"],
    "raw_features":  ["ph", "turbidity", "temperature"],
    "classes":       ["Excellent", "Good", "Poor", "Very Poor", "Unsafe"],
    "wqi_map":       {"Excellent": [90, 100], "Good": [70, 89],
                      "Poor": [50, 69], "Very Poor": [25, 49], "Unsafe": [0, 24]},
    "uses_scaling":  True,
    "test_f1":       0.9227,
}

# Patch joblib.load and Path.read_text before importing app
with patch("joblib.load", side_effect=[mock_model, mock_scaler, mock_le]), \
     patch.object(Path, "read_text", return_value=json.dumps(mock_meta)):
    import app as ml_app

client = TestClient(ml_app.app)

# Inject mocks directly
ml_app._model  = mock_model
ml_app._scaler = mock_scaler
ml_app._le     = mock_le
ml_app._meta   = mock_meta


# ── Tests ──────────────────────────────────────────────────────────────────

class TestHealth:
    def test_health_ok(self):
        r = client.get("/health")
        assert r.status_code == 200
        body = r.json()
        assert body["status"] == "ok"
        assert body["model_name"] == "SVM (RBF)"
        assert body["model_version"] == "2.0.0"


class TestPredict:
    def test_valid_reading(self):
        r = client.post("/predict", json={"ph": 7.2, "turbidity": 1.5, "temperature": 24.0})
        assert r.status_code == 200
        body = r.json()
        assert body["quality_class"] == "Excellent"
        assert 0 <= body["wqi_score"] <= 100
        assert body["confidence"] is not None
        assert body["latency_ms"] >= 0

    def test_ph_boundary_low(self):
        r = client.post("/predict", json={"ph": 0.0, "turbidity": 1.0, "temperature": 20.0})
        assert r.status_code == 200

    def test_ph_boundary_high(self):
        r = client.post("/predict", json={"ph": 14.0, "turbidity": 1.0, "temperature": 20.0})
        assert r.status_code == 200

    def test_invalid_ph_too_high(self):
        r = client.post("/predict", json={"ph": 15.0, "turbidity": 1.0, "temperature": 20.0})
        assert r.status_code == 422

    def test_invalid_ph_negative(self):
        r = client.post("/predict", json={"ph": -1.0, "turbidity": 1.0, "temperature": 20.0})
        assert r.status_code == 422

    def test_negative_turbidity(self):
        r = client.post("/predict", json={"ph": 7.0, "turbidity": -0.1, "temperature": 20.0})
        assert r.status_code == 422

    def test_missing_field(self):
        r = client.post("/predict", json={"ph": 7.0, "turbidity": 1.5})
        assert r.status_code == 422

    def test_empty_body(self):
        r = client.post("/predict", json={})
        assert r.status_code == 422


class TestBatchPredict:
    def test_batch_valid(self):
        readings = [
            {"ph": 7.2, "turbidity": 1.0, "temperature": 22.0},
            {"ph": 6.8, "turbidity": 2.5, "temperature": 25.0},
            {"ph": 5.5, "turbidity": 8.0, "temperature": 30.0},
        ]
        r = client.post("/predict/batch", json={"readings": readings})
        assert r.status_code == 200
        body = r.json()
        assert body["count"] == 3
        assert len(body["predictions"]) == 3
        assert body["latency_ms"] >= 0

    def test_batch_single(self):
        r = client.post("/predict/batch", json={
            "readings": [{"ph": 7.0, "turbidity": 1.0, "temperature": 22.0}]
        })
        assert r.status_code == 200
        assert r.json()["count"] == 1

    def test_batch_empty_list(self):
        r = client.post("/predict/batch", json={"readings": []})
        assert r.status_code in (200, 422)

    def test_batch_invalid_item(self):
        r = client.post("/predict/batch", json={
            "readings": [{"ph": 99.0, "turbidity": 1.0, "temperature": 22.0}]
        })
        assert r.status_code == 422


class TestModelInfo:
    def test_model_info(self):
        r = client.get("/model/info")
        assert r.status_code == 200
        body = r.json()
        assert "model_name" in body
        assert "test_f1" in body
        assert "features" in body
        assert body["test_f1"] > 0.85


class TestWQI:
    def test_wqi_in_band(self):
        """WQI score should always fall within the class's band."""
        from app import compute_wqi, WQI_MAP
        for cls, (low, high) in WQI_MAP.items():
            score = compute_wqi(cls, 7.0, 1.0, 22.0)
            assert low <= score <= high, f"{cls}: WQI {score} outside [{low},{high}]"

    def test_wqi_excellent_range(self):
        from app import compute_wqi
        score = compute_wqi("Excellent", 7.0, 0.5, 22.0)
        assert 90 <= score <= 100

    def test_wqi_unsafe_range(self):
        from app import compute_wqi
        score = compute_wqi("Unsafe", 3.0, 30.0, 40.0)
        assert 0 <= score <= 24
