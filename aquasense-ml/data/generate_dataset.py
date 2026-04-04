"""
generate_dataset.py
────────────────────────────────────────────────────────────────
Generates a realistic labelled water quality dataset using:
  - WHO drinking-water guidelines
  - Environmental sensor noise models
  - 5 quality classes: Excellent / Good / Poor / Very Poor / Unsafe

Features produced (matching AquaSense IoT sensors):
  ph, turbidity (NTU), temperature (°C)

Run: python data/generate_dataset.py
"""

import numpy as np
import pandas as pd
from pathlib import Path

SEED = 42
rng  = np.random.default_rng(SEED)

# ── Class definitions ──────────────────────────────────────────────────────
# Each class is defined as a set of parameter ranges.
# Ranges are (mean, std) pairs — sampled from truncated normals.
CLASSES = {
    "Excellent": {
        "n":           2000,
        "ph":          (7.2,  0.20),   # WHO ideal: 6.5-8.5
        "turbidity":   (0.5,  0.25),   # NTU — very clear
        "temperature": (22.0, 2.0),    # °C — comfortable
    },
    "Good": {
        "n":           2500,
        "ph":          (7.4,  0.45),
        "turbidity":   (1.8,  0.70),
        "temperature": (24.0, 4.0),
    },
    "Poor": {
        "n":           2000,
        "ph":          (6.1,  0.55),   # drifting toward acidic
        "turbidity":   (5.5,  1.80),   # above WHO 4 NTU
        "temperature": (28.0, 5.0),
    },
    "Very Poor": {
        "n":           1500,
        "ph":          (5.4,  0.70),
        "turbidity":   (12.0, 3.50),
        "temperature": (32.0, 6.0),
    },
    "Unsafe": {
        "n":           1000,
        "ph":          (4.2,  0.90),   # severely acidic or alkaline
        "turbidity":   (28.0, 8.00),   # very high contamination
        "temperature": (38.0, 7.0),
    },
}

# Add some alkaline "Unsafe" samples (pH > 9.5)
EXTRA_ALKALINE = {
    "n":           400,
    "ph":          (10.2, 0.60),
    "turbidity":   (18.0, 6.0),
    "temperature": (30.0, 5.0),
    "label":       "Unsafe",
}

def _sample(mean, std, low, high, n):
    """Sample from a clipped normal distribution."""
    vals = rng.normal(mean, std, n * 3)
    vals = vals[(vals >= low) & (vals <= high)][:n]
    # If clipping removed too many, pad with uniform
    if len(vals) < n:
        pad = rng.uniform(low, high, n - len(vals))
        vals = np.concatenate([vals, pad])
    return vals[:n]


def generate(output_path: str = "data/water_quality.csv") -> pd.DataFrame:
    rows = []

    for label, cfg in CLASSES.items():
        n = cfg["n"]
        ph    = _sample(*cfg["ph"],    0.0, 14.0, n)
        turb  = _sample(*cfg["turbidity"],  0.0, 100.0, n)
        temp  = _sample(*cfg["temperature"], -5.0, 55.0, n)

        for i in range(n):
            rows.append({
                "ph":          round(float(ph[i]),   3),
                "turbidity":   round(float(turb[i]), 3),
                "temperature": round(float(temp[i]), 3),
                "quality":     label,
            })

    # Extra alkaline unsafe samples
    n = EXTRA_ALKALINE["n"]
    ph   = _sample(*EXTRA_ALKALINE["ph"],    0.0, 14.0, n)
    turb = _sample(*EXTRA_ALKALINE["turbidity"],  0.0, 100.0, n)
    temp = _sample(*EXTRA_ALKALINE["temperature"], -5.0, 55.0, n)
    for i in range(n):
        rows.append({
            "ph":          round(float(ph[i]),   3),
            "turbidity":   round(float(turb[i]), 3),
            "temperature": round(float(temp[i]), 3),
            "quality":     EXTRA_ALKALINE["label"],
        })

    df = pd.DataFrame(rows).sample(frac=1, random_state=SEED).reset_index(drop=True)

    Path(output_path).parent.mkdir(parents=True, exist_ok=True)
    df.to_csv(output_path, index=False)

    print(f"Dataset saved → {output_path}  ({len(df)} rows)")
    print(df["quality"].value_counts().to_string())
    return df


if __name__ == "__main__":
    generate()
