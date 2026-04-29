"""
clean_dataset.py  —  AquaSense Data Cleaning Pipeline
Run:  python data/clean_dataset.py
"""
import argparse, sys
from pathlib import Path
import numpy as np
import pandas as pd

INPUT_CSV  = Path("data/brisbane_water_quality.csv")
OUTPUT_CSV = Path("data/water_quality.csv")

LIMITS = {"ph":(0,14), "turbidity":(0,500), "temperature":(0,50)}

def classify_quality(ph, turbidity):
    if 6.8 <= ph <= 7.4 and turbidity < 1:   return "Excellent"
    if 6.5 <= ph <= 8.5 and turbidity < 4:   return "Good"
    if ph < 5 or ph > 10 or turbidity > 20:  return "Unsafe"
    if (5<=ph<=6 or 9<=ph<=10) or turbidity > 10: return "Very Poor"
    return "Poor"

def load_raw(path):
    print(f"\n[Load] {path}")
    df = pd.read_csv(path, low_memory=False)
    print(f"  {df.shape[0]} rows × {df.shape[1]} columns")
    return df

def extract_columns(df):
    """
    Finds the correct pH, turbidity, temperature columns by checking
    which columns have values in the expected physical ranges.
    Brisbane CSV: pH should be 6-10, turbidity 0-20, temperature 10-40
    """
    print("\n[Extract] Detecting columns by value range ...")

    best = {}

    # For each needed parameter, score all candidate columns
    for param, kws, lo, hi in [
        ("ph",          ["ph"],                    6.0, 10.0),
        ("turbidity",   ["turb","ntu"],             0.0,  20.0),
        ("temperature", ["temp"],                  10.0,  40.0),
    ]:
        candidates = []
        for col in df.columns:
            nm = col.strip().lower()
            if any(k in nm for k in kws) and "quality" not in nm and "[" not in nm and nm.strip():
                vals = pd.to_numeric(df[col], errors="coerce").dropna()
                if len(vals) == 0: continue
                pct_in_range = ((vals >= lo) & (vals <= hi)).mean() * 100
                candidates.append((col, pct_in_range, vals.mean()))
                print(f"  {param} candidate '{col}': mean={vals.mean():.3f}, in range={pct_in_range:.1f}%")

        if not candidates:
            sys.exit(f"[ERROR] No {param} column found")

        # Pick column with highest % of values in expected range
        best[param] = max(candidates, key=lambda x: x[1])[0]
        print(f"  → Selected '{best[param]}'\n")

    out = df[[best["ph"], best["turbidity"], best["temperature"]]].copy()
    out.columns = ["ph", "turbidity", "temperature"]
    return out

def to_numeric(df):
    for col in df.columns:
        df[col] = pd.to_numeric(df[col], errors="coerce")
    return df

def remove_missing(df):
    b = len(df)
    df = df.dropna()
    print(f"[Missing]    removed {b-len(df)} → {len(df)} rows")
    return df

def remove_impossible(df):
    b = len(df)
    for col,(lo,hi) in LIMITS.items():
        df = df[(df[col]>=lo)&(df[col]<=hi)]
    print(f"[Impossible] removed {b-len(df)} → {len(df)} rows")
    return df

def remove_outliers(df, factor=3.0):
    b = len(df)
    for col in ["ph","turbidity","temperature"]:
        Q1,Q3 = df[col].quantile(0.25), df[col].quantile(0.75)
        IQR = Q3-Q1
        df = df[(df[col]>=Q1-factor*IQR)&(df[col]<=Q3+factor*IQR)]
    print(f"[Outliers]   removed {b-len(df)} → {len(df)} rows")
    return df

def remove_duplicates(df):
    b = len(df)
    df = df.drop_duplicates()
    print(f"[Duplicates] removed {b-len(df)} → {len(df)} rows")
    return df

def assign_labels(df):
    print("\n[Labels] WHO quality classification:")
    df = df.copy()
    df["quality"] = [classify_quality(r.ph, r.turbidity) for r in df.itertuples()]
    dist = df["quality"].value_counts()
    for cls,cnt in dist.items():
        print(f"  {cls:<12}: {cnt:>6} ({cnt/len(df)*100:.1f}%)")
    return df

def save_clean(df, output):
    for col in ["ph","turbidity","temperature"]:
        df[col] = df[col].round(3)
    output.parent.mkdir(parents=True, exist_ok=True)
    df[["ph","turbidity","temperature","quality"]].to_csv(output, index=False)
    print(f"\n[Saved] {output}  ({len(df)} rows)")

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--input",  type=Path, default=INPUT_CSV)
    parser.add_argument("--output", type=Path, default=OUTPUT_CSV)
    args = parser.parse_args()

    print("="*55)
    print("  AquaSense — Data Cleaning Pipeline")
    print("="*55)

    df = load_raw(args.input)
    df = extract_columns(df)
    df = to_numeric(df)
    df = remove_missing(df)
    df = remove_impossible(df)
    df = remove_outliers(df)
    df = remove_duplicates(df)
    df = assign_labels(df)
    save_clean(df, args.output)

    print("\n[Final Stats]")
    print(df[["ph","turbidity","temperature"]].describe().round(3).to_string())
    print("\n[Done] Run: python train.py")
    print("="*55)

if __name__ == "__main__":
    main()
