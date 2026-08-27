# WattWise backend

FastAPI wrapper for the trained, artifact-only WattWise inference layer.

## Run

```powershell
python -m venv .venv
.venv\Scripts\Activate.ps1
pip install -r requirements.txt
uvicorn backend.main:app --reload
```

Open `http://localhost:8000/docs` for the interactive API.

## Endpoints

- `GET /health` reports whether the inference package and model artifact are available.
- `POST /api/v1/predict/manual` accepts the reduced manual schema as JSON.
- `POST /api/v1/predict/batch?tariff_per_kwh=0.25` accepts the full-schema CSV as multipart field `file`.

The API does not retrain. Put `models/energy_forecaster.joblib` at the documented path, and add the supplied `src/features.py`, `src/preprocess.py`, and `src/inference.py` modules. Set `WATTWISE_MODEL_PATH` to override the artifact location.

## Deploy the backend

The included `Dockerfile` and `render.yaml` are ready for Render. Create a new Blueprint from the GitHub repository, choose `render.yaml`, and set `WATTWISE_CORS_ORIGINS` to the final frontend URL, for example `https://wattwise.vercel.app`. Render provides the backend URL after the first deploy; verify it at `/health`.
