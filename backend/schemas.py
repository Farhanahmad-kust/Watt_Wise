from __future__ import annotations

from datetime import datetime
from typing import Any

from pydantic import BaseModel, ConfigDict, Field


class ManualPredictionRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    date: datetime
    Appliances: float = Field(ge=0)
    T1: float
    RH_1: float = Field(ge=0, le=100)
    T2: float
    RH_2: float
    T_out: float
    RH_out: float = Field(ge=0, le=100)
    tariff_per_kwh: float = Field(default=0.25, ge=0)
    observed_next_wh: float | None = Field(default=None, ge=0)


class ManualPredictionResponse(BaseModel):
    prediction_wh: float
    lower_wh: float
    upper_wh: float
    estimated_cost: float
    anomaly_threshold_wh: float
    observed_next_wh: float | None
    high_use_indicator: bool | None


class BatchPredictionResponse(BaseModel):
    rows: list[dict[str, Any]]
    row_count: int
    tariff_per_kwh: float
