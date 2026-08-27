"""Artifact-only manual and batch inference with actionable validation."""

from __future__ import annotations

import os
from pathlib import Path

os.environ.setdefault("LOKY_MAX_CPU_COUNT", "1")

import joblib
import numpy as np
import pandas as pd

from src.features import FULL_FEATURES, MANUAL_RAW_COLUMNS, build_features, build_manual_features
from src.preprocess import MODEL_RAW_COLUMNS


class InputValidationError(ValueError):
    pass


def load_bundle(path: str | Path = "models/energy_forecaster.joblib") -> dict:
    path = Path(path)
    if not path.exists():
        raise FileNotFoundError(f"Model artifact not found at {path}. Run `python -m src.train` first.")
    return joblib.load(path)


def _interval(prediction: np.ndarray, config: dict) -> tuple[np.ndarray, np.ndarray]:
    low = np.clip(prediction + config["lower_residual_q05_wh"], 0, None)
    high = np.clip(prediction + config["upper_residual_q95_wh"], 0, None)
    return low, high


def _threshold(prediction: float, config: dict) -> float:
    for item in config["bins"]:
        if item["min_forecast"] <= prediction < item["max_forecast"]:
            return float(item["positive_residual_q95_wh"])
    return float(config["bins"][-1]["positive_residual_q95_wh"])


def validate_manual(values: dict) -> pd.DataFrame:
    missing = [column for column in MANUAL_RAW_COLUMNS if column not in values]
    if missing:
        raise InputValidationError(f"Manual input is missing: {', '.join(missing)}")
    frame = pd.DataFrame([{column: values[column] for column in MANUAL_RAW_COLUMNS}])
    frame["date"] = pd.to_datetime(frame["date"], errors="coerce")
    if frame["date"].isna().any():
        raise InputValidationError("Timestamp must be a valid date and time")
    numeric_columns = MANUAL_RAW_COLUMNS[1:]
    frame[numeric_columns] = frame[numeric_columns].apply(pd.to_numeric, errors="coerce")
    if frame[numeric_columns].isna().any().any():
        bad = frame[numeric_columns].columns[frame[numeric_columns].isna().any()].tolist()
        raise InputValidationError(f"These fields must be numeric: {', '.join(bad)}")
    if frame.at[0, "Appliances"] < 0:
        raise InputValidationError("Current appliance use cannot be negative")
    for column in ["RH_1", "RH_2", "RH_out"]:
        if not 0 <= frame.at[0, column] <= 100:
            raise InputValidationError(f"{column} must be between 0% and 100%")
    return frame


def predict_manual(values: dict, tariff_per_kwh: float, observed_next_wh: float | None = None, bundle: dict | None = None) -> dict:
    if tariff_per_kwh < 0:
        raise InputValidationError("Tariff cannot be negative")
    bundle = bundle or load_bundle()
    frame = validate_manual(values)
    prediction = float(max(0, bundle["manual_model"].predict(build_manual_features(frame))[0]))
    low, high = _interval(np.array([prediction]), bundle["manual_uncertainty"])
    threshold = _threshold(prediction, bundle["manual_anomaly"])
    anomaly = None
    if observed_next_wh is not None:
        if observed_next_wh < 0:
            raise InputValidationError("Observed next use cannot be negative")
        anomaly = bool(observed_next_wh - prediction > threshold)
    return {
        "prediction_wh": prediction,
        "lower_wh": float(low[0]), "upper_wh": float(high[0]),
        "estimated_cost": prediction / 1000 * tariff_per_kwh,
        "anomaly_threshold_wh": prediction + threshold,
        "observed_next_wh": observed_next_wh, "high_use_indicator": anomaly,
    }


def validate_batch(frame: pd.DataFrame) -> pd.DataFrame:
    required = MODEL_RAW_COLUMNS
    missing = sorted(set(required) - set(frame.columns))
    if missing:
        raise InputValidationError(
            "CSV is missing required columns: " + ", ".join(missing) +
            ". Download the example CSV to match the expected schema."
        )
    cleaned = frame[required].copy()
    cleaned["date"] = pd.to_datetime(cleaned["date"], errors="coerce")
    if cleaned["date"].isna().any():
        rows = (cleaned.index[cleaned["date"].isna()] + 2).tolist()[:5]
        raise InputValidationError(f"Invalid timestamps in CSV rows: {rows}")
    numeric = [column for column in required if column != "date"]
    cleaned[numeric] = cleaned[numeric].apply(pd.to_numeric, errors="coerce")
    bad = cleaned[numeric].columns[cleaned[numeric].isna().any()].tolist()
    if bad:
        raise InputValidationError(f"Non-numeric or missing values found in: {', '.join(bad)}")
    if cleaned["date"].duplicated().any():
        raise InputValidationError("CSV contains duplicate timestamps; keep one row per 10-minute interval")
    if (cleaned["Appliances"] < 0).any():
        raise InputValidationError("Appliances values cannot be negative")
    return cleaned.sort_values("date", kind="stable").reset_index(drop=True)


def predict_batch(frame: pd.DataFrame, tariff_per_kwh: float, bundle: dict | None = None) -> pd.DataFrame:
    if tariff_per_kwh < 0:
        raise InputValidationError("Tariff cannot be negative")
    bundle = bundle or load_bundle()
    cleaned = validate_batch(frame)
    features = build_features(cleaned, include_target=False)
    prediction = np.clip(bundle["full_model"].predict(features[FULL_FEATURES]), 0, None)
    low, high = _interval(prediction, bundle["uncertainty"])
    observed = cleaned["Appliances"].shift(-1)
    thresholds = np.array([_threshold(float(value), bundle["anomaly"]) for value in prediction])
    result = pd.DataFrame({
        "forecast_for": cleaned["date"] + pd.Timedelta(minutes=10),
        "prediction_wh": prediction,
        "lower_90_wh": low, "upper_90_wh": high,
        "estimated_cost": prediction / 1000 * tariff_per_kwh,
        "observed_next_wh": observed,
    })
    result["high_use_indicator"] = np.where(
        result["observed_next_wh"].notna(),
        result["observed_next_wh"] - result["prediction_wh"] > thresholds,
        pd.NA,
    )
    return result
