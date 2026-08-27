"""Leakage-safe features for next-interval appliance-energy forecasting."""

from __future__ import annotations

import numpy as np
import pandas as pd

TARGET_COLUMN = "target_next_wh"
LAGS = (1, 2, 3, 6, 144)
ROLLING_WINDOWS = (3, 6, 12, 36, 144)

SENSOR_COLUMNS = [
    "lights", "T1", "RH_1", "T2", "RH_2", "T3", "RH_3", "T4", "RH_4",
    "T5", "RH_5", "T6", "RH_6", "T7", "RH_7", "T8", "RH_8", "T9",
    "RH_9", "T_out", "Press_mm_hg", "RH_out", "Windspeed", "Visibility",
    "Tdewpoint",
]
CALENDAR_COLUMNS = [
    "hour_sin", "hour_cos", "dow_sin", "dow_cos", "month_sin", "month_cos",
    "is_weekend",
]
LAG_COLUMNS = [f"appliances_lag_{lag}" for lag in LAGS]
ROLLING_COLUMNS = [
    name for window in ROLLING_WINDOWS
    for name in (f"appliances_roll_mean_{window}", f"appliances_roll_std_{window}")
]
FULL_FEATURES = ["Appliances", *SENSOR_COLUMNS, *CALENDAR_COLUMNS, *LAG_COLUMNS, *ROLLING_COLUMNS]
MANUAL_RAW_COLUMNS = ["date", "Appliances", "T1", "RH_1", "T2", "RH_2", "T_out", "RH_out"]
MANUAL_FEATURES = ["Appliances", "T1", "RH_1", "T2", "RH_2", "T_out", "RH_out", *CALENDAR_COLUMNS]


def _calendar(frame: pd.DataFrame) -> pd.DataFrame:
    result = frame.copy()
    dates = pd.to_datetime(result["date"])
    minute_of_day = dates.dt.hour * 60 + dates.dt.minute
    result["hour_sin"] = np.sin(2 * np.pi * minute_of_day / 1440)
    result["hour_cos"] = np.cos(2 * np.pi * minute_of_day / 1440)
    result["dow_sin"] = np.sin(2 * np.pi * dates.dt.dayofweek / 7)
    result["dow_cos"] = np.cos(2 * np.pi * dates.dt.dayofweek / 7)
    result["month_sin"] = np.sin(2 * np.pi * (dates.dt.month - 1) / 12)
    result["month_cos"] = np.cos(2 * np.pi * (dates.dt.month - 1) / 12)
    result["is_weekend"] = (dates.dt.dayofweek >= 5).astype(int)
    return result


def build_features(frame: pd.DataFrame, include_target: bool = True) -> pd.DataFrame:
    result = frame.sort_values("date", kind="stable").reset_index(drop=True).copy()
    result = _calendar(result)
    appliances = pd.to_numeric(result["Appliances"], errors="coerce")
    if include_target:
        result[TARGET_COLUMN] = appliances.shift(-1)
    for lag in LAGS:
        result[f"appliances_lag_{lag}"] = appliances.shift(lag)
    past_only = appliances.shift(1)
    for window in ROLLING_WINDOWS:
        rolling = past_only.rolling(window=window, min_periods=1)
        result[f"appliances_roll_mean_{window}"] = rolling.mean()
        result[f"appliances_roll_std_{window}"] = rolling.std().fillna(0.0)
    return result


def build_manual_features(frame: pd.DataFrame) -> pd.DataFrame:
    return _calendar(frame.copy())[MANUAL_FEATURES]
