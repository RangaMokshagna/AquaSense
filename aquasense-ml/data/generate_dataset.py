"""
generate_dataset.py
════════════════════════════════════════════════════════════════
Compatibility wrapper for train.py.
Generates the default AquaSense training dataset when no CSV exists.
"""

from __future__ import annotations
from pathlib import Path
import numpy as np
import pandas as pd

SEED = 42

def classify_quality(ph: float, turbidity: float) -> str:
    if 6.8 <= ph <= 7.4 and turbidity < 1.0:
        return "Excellent"
    if 6.5 <= ph <= 8.5 and turbidity < 4.0:
        return "Good"
    if ph < 5.0 or ph > 10.0 or turbidity > 20.0:
        return "Unsafe"
    if (5.0 <= ph <= 6.0 or 9.0 <= ph <= 10.0) or (10.0 < turbidity <= 20.0):
        return "Very Poor"
    return "Poor"


def generate(output_path: str | Path = "data/water_quality.csv",
             sample_count: int = 9400) -> Path:
    rng    = np.random.default_rng(SEED)
    output = Path(output_path)
    output.parent.mkdir(parents=True, exist_ok=True)

    rows = []
    bands = [
        ("Excellent", int(sample_count * 0.20), (6.8, 7.4),  (0.05, 0.95), (20.0, 24.0)),
        ("Good",      int(sample_count * 0.28), (6.5, 8.5),  (0.60, 3.90), (18.0, 29.0)),
        ("Poor",      int(sample_count * 0.22), (5.8, 9.2),  (4.00, 10.0), (18.0, 32.0)),
        ("Very Poor", int(sample_count * 0.18), (5.0, 10.0), (10.1, 20.0), (16.0, 34.0)),
    ]

    produced = 0
    for label, count, ph_r, turb_r, temp_r in bands:
        produced += count
        ph   = rng.uniform(ph_r[0],   ph_r[1],   count)
        turb = rng.uniform(turb_r[0], turb_r[1], count)
        temp = rng.uniform(temp_r[0], temp_r[1], count)
        for i in range(count):
            rows.append({"ph": round(float(ph[i]), 3),
                         "turbidity": round(float(turb[i]), 3),
                         "temperature": round(float(temp[i]), 3),
                         "quality": label})

    remaining = max(sample_count - produced, 0)
    for _ in range(remaining):
        ph   = rng.uniform(0.5, 4.9) if rng.random() < 0.5 else rng.uniform(10.1, 13.5)
        turb = rng.uniform(20.1, 60.0)
        temp = rng.uniform(10.0, 38.0)
        rows.append({"ph": round(float(ph), 3),
                     "turbidity": round(float(turb), 3),
                     "temperature": round(float(temp), 3),
                     "quality": "Unsafe"})

    df = pd.DataFrame(rows).sample(frac=1, random_state=SEED).reset_index(drop=True)
    df.to_csv(output, index=False)
    print(f"Generated dataset at {output}  ({len(df)} rows)")
    return output


if __name__ == "__main__":
    generate()
