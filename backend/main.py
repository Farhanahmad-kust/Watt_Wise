from __future__ import annotations

import importlib
import io
import logging
import os
from functools import lru_cache
from pathlib import Path
from typing import Any

import pandas as pd
import numpy as np
from fastapi import FastAPI, File, HTTPException, Query, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import Response

from .schemas import (
    BatchPredictionResponse,
    ManualPredictionRequest,
    ManualPredictionResponse,
)

ROOT = Path(__file__).resolve().parent.parent
MODEL_PATH = Path(os.getenv("WATTWISE_MODEL_PATH", ROOT / "models" / "energy_forecaster.joblib"))
logger = logging.getLogger("wattwise.api")

app = FastAPI(
    title="WattWise Energy Forecast API",
    version="1.0.0",
    description="Artifact-only next-10-minute appliance energy forecasting.",
)
app.add_middleware(
    CORSMiddleware,
    allow_origins=os.getenv("WATTWISE_CORS_ORIGINS", "http://localhost:5173").split(","),
    allow_credentials=True,
    allow_methods=["GET", "POST"],
    allow_headers=["*"],
)


@lru_cache(maxsize=1)
def _inference_module() -> Any:
    try:
        return importlib.import_module("src.inference")
    except ModuleNotFoundError as exc:
        raise RuntimeError(
            "The model inference package is missing. Add the supplied src package to the project."
        ) from exc


def _service_error(exc: Exception) -> HTTPException:
    if isinstance(exc, ValueError):
        return HTTPException(status_code=422, detail=str(exc))
    if isinstance(exc, FileNotFoundError):
        return HTTPException(status_code=503, detail=str(exc))
    if isinstance(exc, RuntimeError):
        return HTTPException(status_code=503, detail=str(exc))
    return HTTPException(status_code=500, detail="Inference failed")


@app.get("/", tags=["system"])
def root() -> dict[str, str]:
    return {"name": "WattWise Energy Forecast API", "docs": "/docs", "health": "/health"}


@app.get("/health", tags=["system"])
def health() -> dict[str, Any]:
    artifact_exists = MODEL_PATH.exists()
    inference_available = False
    if artifact_exists:
        try:
            _inference_module()
            inference_available = True
        except RuntimeError:
            pass
    return {
        "status": "ok" if artifact_exists and inference_available else "degraded",
        "artifact_exists": artifact_exists,
        "inference_available": inference_available,
        "model_path": str(MODEL_PATH),
    }


@app.post("/api/v1/predict/manual", response_model=ManualPredictionResponse, tags=["forecast"])
def predict_manual(request: ManualPredictionRequest) -> dict[str, Any]:
    try:
        inference = _inference_module()
        values = request.model_dump(mode="json", exclude={"tariff_per_kwh", "observed_next_wh"})
        return inference.predict_manual(
            values,
            tariff_per_kwh=request.tariff_per_kwh,
            observed_next_wh=request.observed_next_wh,
            bundle=inference.load_bundle(MODEL_PATH),
        )
    except Exception as exc:
        logger.exception("Manual inference failed")
        raise _service_error(exc) from exc


@app.post("/api/v1/predict/batch", response_model=BatchPredictionResponse, tags=["forecast"])
async def predict_batch(
    file: UploadFile = File(..., description="Full-schema CSV sequence"),
    tariff_per_kwh: float = Query(default=0.25, ge=0),
) -> dict[str, Any]:
    if not file.filename or not file.filename.lower().endswith(".csv"):
        raise HTTPException(status_code=422, detail="Upload a CSV file")
    try:
        frame = pd.read_csv(io.BytesIO(await file.read()))
        inference = _inference_module()
        predictions = inference.predict_batch(
            frame,
            tariff_per_kwh=tariff_per_kwh,
            bundle=inference.load_bundle(MODEL_PATH),
        )
        rows = predictions.where(pd.notna(predictions), None).to_dict(orient="records")
        for row in rows:
            if hasattr(row.get("forecast_for"), "isoformat"):
                row["forecast_for"] = row["forecast_for"].isoformat()
        return {"rows": rows, "row_count": len(rows), "tariff_per_kwh": tariff_per_kwh}
    except Exception as exc:
        logger.exception("Batch inference failed")
        raise _service_error(exc) from exc


@app.get("/api/v1/batch/example", tags=["batch"])
def batch_example(
    variant: str = Query(default="typical", pattern="^(typical|weekend|high-use)$"),
) -> Response:
    """Return a deterministic full-schema sequence users can download and edit."""
    inference = _inference_module()
    dates = pd.date_range("2016-05-01 00:00:00", periods=145, freq="10min")
    frame = pd.DataFrame({"date": dates})
    minute_of_day = dates.hour * 60 + dates.minute
    baseline = 65 + 22 * np.sin(2 * np.pi * minute_of_day / 1440) ** 2
    if variant == "weekend":
        baseline = baseline * 0.85 + 12
    elif variant == "high-use":
        baseline = baseline * 1.65 + 35
    frame["Appliances"] = np.round(baseline, 2)
    frame["lights"] = np.round(8 + 7 * (dates.hour >= 18), 2)
    for column, value in {
        "T1": 21.5, "RH_1": 40, "T2": 20.5, "RH_2": 42,
        "T3": 21, "RH_3": 40, "T4": 20, "RH_4": 40,
        "T5": 19.5, "RH_5": 45, "T6": 16, "RH_6": 55,
        "T7": 20, "RH_7": 40, "T8": 21, "RH_8": 45,
        "T9": 19, "RH_9": 42, "T_out": 14, "Press_mm_hg": 733,
        "RH_out": 60, "Windspeed": 3.5, "Visibility": 40, "Tdewpoint": 7,
    }.items():
        frame[column] = value
    output = io.StringIO()
    frame[inference.MODEL_RAW_COLUMNS].to_csv(output, index=False)
    return Response(
        content=output.getvalue(),
        media_type="text/csv",
        headers={"Content-Disposition": f'attachment; filename="wattwise-{variant}-example.csv"'},
    )
