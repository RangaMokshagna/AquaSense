"""
train.py
────────────────────────────────────────────────────────────────
AquaSense ML Training Pipeline

Trains and evaluates multiple classifiers:
  - Random Forest
  - Gradient Boosting
  - XGBoost
  - Support Vector Machine (RBF)

Selects the best model by weighted F1-score, saves it to models/
along with the scaler and label encoder.

Run: python train.py
"""

import json
import time
import warnings
from pathlib import Path

import joblib
import numpy as np
import pandas as pd
import matplotlib
matplotlib.use("Agg")          # headless — no display needed
import matplotlib.pyplot as plt
import seaborn as sns

from sklearn.ensemble import RandomForestClassifier, GradientBoostingClassifier
from sklearn.tree import DecisionTreeClassifier, export_text
from sklearn.svm import SVC
from sklearn.preprocessing import StandardScaler, LabelEncoder
from sklearn.model_selection import train_test_split, StratifiedKFold, cross_val_score
from sklearn.metrics import (
    classification_report,
    confusion_matrix,
    accuracy_score,
    f1_score,
)
from xgboost import XGBClassifier

warnings.filterwarnings("ignore")

# ── Paths ──────────────────────────────────────────────────────────────────
DATA_PATH   = Path("data/water_quality.csv")
MODELS_DIR  = Path("models")
MODELS_DIR.mkdir(exist_ok=True)
REPORTS_DIR = Path("reports")
REPORTS_DIR.mkdir(exist_ok=True)

# ── Label ordering (used for WQI mapping) ─────────────────────────────────
QUALITY_ORDER = ["Excellent", "Good", "Poor", "Very Poor", "Unsafe"]
WQI_MAP = {
    "Excellent": (90, 100),
    "Good":      (70,  89),
    "Poor":      (50,  69),
    "Very Poor": (25,  49),
    "Unsafe":    (0,   24),
}

FEATURES = ["ph", "turbidity", "temperature"]

# ── Helper: WQI score from class + raw sensor values ──────────────────────
def compute_wqi(quality_class: str, ph: float, turbidity: float, temperature: float) -> float:
    """
    Deterministic WQI score within the class band, refined by sensor values.
    Score range per class:
        Excellent: 90–100  | Good: 70–89 | Poor: 50–69
        Very Poor: 25–49   | Unsafe: 0–24
    """
    low, high = WQI_MAP[quality_class]
    base = (low + high) / 2.0

    # Fine-tune within the band based on how good the readings are
    ph_penalty    = abs(ph - 7.0) * 1.5          # ideal pH = 7.0
    turb_penalty  = min(turbidity, 50) * 0.3
    temp_penalty  = max(0, abs(temperature - 22) - 5) * 0.4

    score = base - ph_penalty - turb_penalty - temp_penalty
    return round(float(np.clip(score, low, high)), 2)


# ── 1. Load & inspect data ─────────────────────────────────────────────────
print("=" * 60)
print("  AquaSense ML Training Pipeline")
print("=" * 60)

if not DATA_PATH.exists():
    print("Dataset not found — generating...")
    from data.generate_dataset import generate
    generate(str(DATA_PATH))

df = pd.read_csv(DATA_PATH)
print(f"\n[Data] {len(df)} samples | {df['quality'].nunique()} classes")
print(df["quality"].value_counts().to_string())
print(f"\n[Stats]\n{df[FEATURES].describe().round(3).to_string()}")

# ── 2. Feature engineering ────────────────────────────────────────────────
print("\n[Features] Engineering additional features...")

df["ph_deviation"]   = (df["ph"] - 7.0).abs()           # distance from neutral pH
df["ph_sq"]          = df["ph"] ** 2                     # non-linear pH response
df["turb_log"]       = np.log1p(df["turbidity"])         # log-transform skewed turbidity
df["temp_deviation"] = (df["temperature"] - 22.0).abs() # distance from ideal temp
df["ph_x_turb"]      = df["ph_deviation"] * df["turb_log"]  # interaction feature

ENGINEERED = ["ph_deviation", "ph_sq", "turb_log", "temp_deviation", "ph_x_turb"]
ALL_FEATURES = FEATURES + ENGINEERED

print(f"  Raw features:      {FEATURES}")
print(f"  Engineered:        {ENGINEERED}")
print(f"  Total features:    {len(ALL_FEATURES)}")

# ── 3. Encode labels ───────────────────────────────────────────────────────
le = LabelEncoder()
le.fit(QUALITY_ORDER)
df["label"] = le.transform(df["quality"])

X = df[ALL_FEATURES].values
y = df["label"].values

# ── 4. Train / test split ──────────────────────────────────────────────────
X_train, X_test, y_train, y_test = train_test_split(
    X, y, test_size=0.20, random_state=42, stratify=y
)
print(f"\n[Split] Train: {len(X_train)} | Test: {len(X_test)}")

# ── 5. Scale features ──────────────────────────────────────────────────────
scaler = StandardScaler()
X_train_s = scaler.fit_transform(X_train)
X_test_s  = scaler.transform(X_test)

# ── 6. Define candidate models ────────────────────────────────────────────
models = {
    "Random Forest": RandomForestClassifier(
        n_estimators=200,
        max_depth=12,
        min_samples_leaf=2,
        class_weight="balanced",
        random_state=42,
        n_jobs=-1,
    ),
    "Gradient Boosting": GradientBoostingClassifier(
        n_estimators=150,
        learning_rate=0.1,
        max_depth=5,
        subsample=0.8,
        random_state=42,
    ),
    "XGBoost": XGBClassifier(
        n_estimators=200,
        learning_rate=0.08,
        max_depth=6,
        subsample=0.8,
        colsample_bytree=0.8,
        use_label_encoder=False,
        eval_metric="mlogloss",
        random_state=42,
        n_jobs=-1,
        verbosity=0,
    ),
    "Decision Tree": DecisionTreeClassifier(
        max_depth=None,
        class_weight="balanced",
        random_state=42,
    ),
    "Decision Tree (pruned)": DecisionTreeClassifier(
        max_depth=8,
        min_samples_leaf=5,
        min_samples_split=10,
        class_weight="balanced",
        random_state=42,
    ),
    "SVM (RBF)": SVC(
        C=10.0,
        kernel="rbf",
        gamma="scale",
        class_weight="balanced",
        probability=True,
        random_state=42,
    ),
}

# ── 7. Train, cross-validate and evaluate ────────────────────────────────
cv      = StratifiedKFold(n_splits=5, shuffle=True, random_state=42)
results = {}

print("\n[Training] Comparing models...\n")
print(f"  {'Model':<22} {'CV F1 (mean±std)':<22} {'Test Acc':<12} {'Test F1':<12} {'Time'}")
print("  " + "-" * 75)

for name, model in models.items():
    t0 = time.time()

    # Use scaled data for SVM, raw for tree-based
    use_X_train = X_train_s if "SVM" in name else X_train
    use_X_test  = X_test_s  if "SVM" in name else X_test
    use_X       = scaler.transform(X) if "SVM" in name else X

    # 5-fold CV on full data
    cv_scores = cross_val_score(model, use_X, y, cv=cv, scoring="f1_weighted", n_jobs=-1)
    model.fit(use_X_train, y_train)
    y_pred = model.predict(use_X_test)

    acc = accuracy_score(y_test, y_pred)
    f1  = f1_score(y_test, y_pred, average="weighted")
    elapsed = time.time() - t0

    results[name] = {
        "model":   model,
        "cv_mean": cv_scores.mean(),
        "cv_std":  cv_scores.std(),
        "test_acc": acc,
        "test_f1":  f1,
        "y_pred":   y_pred,
        "scaled":   "SVM" in name,
    }

    print(f"  {name:<22} {cv_scores.mean():.4f} ± {cv_scores.std():.4f}    "
          f"{acc:.4f}       {f1:.4f}       {elapsed:.1f}s")

# ── 8. Pick the best model ─────────────────────────────────────────────────
best_name = max(results, key=lambda k: results[k]["test_f1"])
best      = results[best_name]
print(f"\n[Winner] {best_name}  (Test F1 = {best['test_f1']:.4f})")

# ── 9. Full classification report ────────────────────────────────────────
print(f"\n[Report] {best_name} — detailed metrics:\n")
report = classification_report(
    y_test, best["y_pred"],
    target_names=le.classes_,
    digits=4,
)
print(report)

# Save report
report_path = REPORTS_DIR / "classification_report.txt"
report_path.write_text(f"Best model: {best_name}\n\n{report}")

# ── 10. Confusion matrix plot ─────────────────────────────────────────────
cm = confusion_matrix(y_test, best["y_pred"])
fig, ax = plt.subplots(figsize=(8, 6))
sns.heatmap(
    cm, annot=True, fmt="d", cmap="Blues",
    xticklabels=le.classes_,
    yticklabels=le.classes_,
    ax=ax,
)
ax.set_xlabel("Predicted", fontsize=12)
ax.set_ylabel("Actual", fontsize=12)
ax.set_title(f"Confusion Matrix — {best_name}", fontsize=13)
plt.tight_layout()
cm_path = REPORTS_DIR / "confusion_matrix.png"
fig.savefig(cm_path, dpi=120)
plt.close()
print(f"[Plot] Confusion matrix saved → {cm_path}")

# ── 11. Feature importance (tree-based only) ──────────────────────────────
best_model = best["model"]
if hasattr(best_model, "feature_importances_"):
    importances = pd.Series(best_model.feature_importances_, index=ALL_FEATURES)
    importances = importances.sort_values(ascending=False)

    fig, ax = plt.subplots(figsize=(9, 5))
    importances.plot(kind="bar", ax=ax, color="steelblue", edgecolor="white")
    ax.set_title(f"Feature Importance — {best_name}", fontsize=13)
    ax.set_ylabel("Importance")
    ax.set_xlabel("")
    plt.xticks(rotation=35, ha="right")
    plt.tight_layout()
    fi_path = REPORTS_DIR / "feature_importance.png"
    fig.savefig(fi_path, dpi=120)
    plt.close()
    print(f"[Plot] Feature importance saved → {fi_path}")
    print(f"\n[Importance]\n{importances.round(4).to_string()}")


# ── 11b. Decision Tree specific reports ──────────────────────────────────────
# Always generate DT reports regardless of which model won
for dt_name in ["Decision Tree", "Decision Tree (pruned)"]:
    if dt_name not in results:
        continue
    dt_result = results[dt_name]
    dt_model  = dt_result["model"]

    # Decision Tree rules (text)
    rules = export_text(dt_model, feature_names=ALL_FEATURES, max_depth=5)
    rules_path = REPORTS_DIR / f"decision_tree_rules_{'pruned' if 'pruned' in dt_name else 'full'}.txt"
    header = (
        f"Decision Tree Rules — {dt_name}\n"
        f"Test F1: {dt_result['test_f1']:.4f}  |  "
        f"Accuracy: {dt_result['test_acc']*100:.2f}%  |  "
        f"CV F1: {dt_result['cv_mean']:.4f} ± {dt_result['cv_std']:.4f}\n"
        f"Max depth: {dt_model.max_depth}  |  "
        f"Nodes: {dt_model.tree_.node_count}  |  "
        f"Leaves: {dt_model.tree_.n_leaves}\n"
        f"{'='*60}\n\n"
    )
    rules_path.write_text(header + rules)
    print(f"[DT]  Rules saved → {rules_path}")

    # Decision Tree feature importance bar chart
    imp = pd.Series(dt_model.feature_importances_, index=ALL_FEATURES).sort_values(ascending=False)
    fig, ax = plt.subplots(figsize=(9, 5))
    colors = ["#2196F3" if i < 3 else "#90CAF9" for i in range(len(imp))]
    imp.plot(kind="bar", ax=ax, color=colors, edgecolor="white")
    ax.set_title(f"Feature Importance — {dt_name}", fontsize=13)
    ax.set_ylabel("Gini Importance")
    ax.set_xlabel("")
    plt.xticks(rotation=35, ha="right")
    plt.tight_layout()
    tag = "pruned" if "pruned" in dt_name else "full"
    fig.savefig(REPORTS_DIR / f"dt_feature_importance_{tag}.png", dpi=120)
    plt.close()
    print(f"[DT]  Feature importance saved → reports/dt_feature_importance_{tag}.png")

    # Confusion matrix for this DT
    dt_cm = confusion_matrix(y_test, dt_result["y_pred"])
    fig, ax = plt.subplots(figsize=(8, 6))
    sns.heatmap(dt_cm, annot=True, fmt="d", cmap="Greens",
                xticklabels=le.classes_, yticklabels=le.classes_, ax=ax)
    ax.set_xlabel("Predicted", fontsize=12)
    ax.set_ylabel("Actual", fontsize=12)
    ax.set_title(f"Confusion Matrix — {dt_name}", fontsize=13)
    plt.tight_layout()
    fig.savefig(REPORTS_DIR / f"dt_confusion_matrix_{tag}.png", dpi=120)
    plt.close()
    print(f"[DT]  Confusion matrix saved → reports/dt_confusion_matrix_{tag}.png")

    print(f"[DT]  {dt_name}: F1={dt_result['test_f1']:.4f} | "
          f"Accuracy={dt_result['test_acc']*100:.2f}% | "
          f"Depth={dt_model.get_depth()} | Leaves={dt_model.get_n_leaves()}")

# Comparison summary of all models
print(f"\n[Comparison] All models ranked by Test F1:")
ranked = sorted(results.items(), key=lambda x: x[1]["test_f1"], reverse=True)
for i, (name, r) in enumerate(ranked):
    marker = " ← WINNER" if i == 0 else ""
    print(f"  {i+1}. {name:<28} F1={r['test_f1']:.4f}  Acc={r['test_acc']*100:.2f}%{marker}")


# ── 12. Save artefacts ────────────────────────────────────────────────────
model_path  = MODELS_DIR / "best_model.joblib"
scaler_path = MODELS_DIR / "scaler.joblib"
le_path     = MODELS_DIR / "label_encoder.joblib"
meta_path   = MODELS_DIR / "model_meta.json"

# If best model is tree-based, it was trained on un-scaled data.
# We save the scaler anyway so the API can use it for SVM fallback or future use.
joblib.dump(best_model, model_path)
joblib.dump(scaler,     scaler_path)
joblib.dump(le,         le_path)

meta = {
    "model_name":    best_name,
    "model_version": "2.0.0",
    "features":      ALL_FEATURES,
    "raw_features":  FEATURES,
    "classes":       list(le.classes_),
    "wqi_map":       WQI_MAP,
    "uses_scaling":  best["scaled"],
    "cv_f1_mean":    round(best["cv_mean"], 4),
    "cv_f1_std":     round(best["cv_std"],  4),
    "test_accuracy": round(best["test_acc"], 4),
    "test_f1":       round(best["test_f1"],  4),
    "n_train":       len(X_train),
    "n_test":        len(X_test),
    "trained_at":    pd.Timestamp.now().isoformat(),
}
meta_path.write_text(json.dumps(meta, indent=2))

print(f"\n[Saved]")
print(f"  Model   → {model_path}")
print(f"  Scaler  → {scaler_path}")
print(f"  Encoder → {le_path}")
print(f"  Meta    → {meta_path}")
print(f"\n{'=' * 60}")
print(f"  Training complete! Best: {best_name}  F1={best['test_f1']:.4f}")
print(f"{'=' * 60}\n")
