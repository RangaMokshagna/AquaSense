"""
prepare_dataset.py
════════════════════════════════════════════════════════════════
AquaSense — Dataset Preparation

Use this ONLY if you want to rebuild water_quality.csv manually.
For normal use, just run:  python data/clean_dataset.py

Modes:
  kaggle   → use only the Brisbane/Kaggle CSV
  combined → Brisbane CSV + synthetic data merged

Examples:
  python data/prepare_dataset.py --mode kaggle   --input data/brisbane_water_quality.csv
  python data/prepare_dataset.py --mode combined --input data/brisbane_water_quality.csv
"""

from __future__ import annotations
import argparse
from pathlib import Path
import numpy as np
import pandas as pd
from data.clean_dataset import (
    load_raw, extract_columns, to_numeric,
    remove_missing, remove_impossible,
    remove_outliers, remove_duplicates, assign_labels, save_clean
)
from data.generate_dataset import generate as gen_synthetic


DEFAULT_OUTPUT = Path("data/water_quality.csv")


def prepare(mode: str, input_csv: Path, output: Path,
            synthetic_samples: int = 9400) -> None:

    if mode == "kaggle":
        # Clean the real CSV and save
        df = load_raw(input_csv)
        df = extract_columns(df)
        df = to_numeric(df)
        df = remove_missing(df)
        df = remove_impossible(df)
        df = remove_outliers(df)
        df = remove_duplicates(df)
        df = assign_labels(df)
        save_clean(df, output)

    elif mode == "combined":
        # Clean real CSV
        df_real = load_raw(input_csv)
        df_real = extract_columns(df_real)
        df_real = to_numeric(df_real)
        df_real = remove_missing(df_real)
        df_real = remove_impossible(df_real)
        df_real = remove_outliers(df_real)
        df_real = remove_duplicates(df_real)
        df_real = assign_labels(df_real)

        # Generate synthetic
        syn_path = Path("data/_synthetic_temp.csv")
        gen_synthetic(syn_path, sample_count=synthetic_samples)
        df_syn = pd.read_csv(syn_path)
        syn_path.unlink()

        # Combine and shuffle
        combined = pd.concat([df_real, df_syn], ignore_index=True)
        combined = combined.sample(frac=1, random_state=42).reset_index(drop=True)
        save_clean(combined, output)

    else:
        raise ValueError(f"Unknown mode: {mode}")


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--mode",   choices=["kaggle", "combined"], default="kaggle")
    parser.add_argument("--input",  type=Path, default=Path("data/brisbane_water_quality.csv"))
    parser.add_argument("--output", type=Path, default=DEFAULT_OUTPUT)
    parser.add_argument("--synthetic-samples", type=int, default=9400)
    args = parser.parse_args()

    prepare(args.mode, args.input, args.output, args.synthetic_samples)


if __name__ == "__main__":
    main()
