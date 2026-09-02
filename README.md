# WattWise

A full-stack appliance energy forecasting application that predicts the next 10-minute energy usage for a building using a trained machine learning model. The project is split into a FastAPI backend and a React frontend, with both deployed separately for production use.

## Overview

- Backend: FastAPI service for manual and batch forecasting
- Frontend: React + Vite dashboard for interacting with the model
- Model: trained artifact-only forecasting pipeline loaded at runtime
- Deployment: Render for the API and Vercel for the frontend

## Features

- Manual prediction input form
- CSV-based batch forecasting
- Forecast confidence interval and cost estimate
- High-use signal detection based on anomaly thresholds
- API health monitoring and interactive docs

## Repository Structure

```text
.
├── backend/             # FastAPI application
├── src/                 # React frontend and inference helpers
├── models/              # Trained ML model artifact
├── tests/               # API testing suite
├── Dockerfile           # Render backend container config
├── render.yaml          # Render deployment configuration
├── vercel.json          # Vercel frontend routing config
├── package.json         # Frontend scripts and dependencies
├── requirements.txt     # Python dependency list
├── index.html           # Vite entry page
├── README.md            # Project overview and setup guide
├── .gitignore           # Git ignore rules
└── .env.example         # Sample environment variables
```

## Local Development

### Backend

```powershell
python -m venv .venv
.venv\Scripts\Activate.ps1
pip install -r requirements.txt
uvicorn backend.main:app --reload
```

The API will be available at:

- http://localhost:8000
- http://localhost:8000/docs
- http://localhost:8000/health

### Frontend

```powershell
npm install
npm run dev
```

The frontend runs at:

- http://localhost:5173

## Environment Variables

### Backend

- `WATTWISE_MODEL_PATH` — optional override for the model artifact path
- `WATTWISE_CORS_ORIGINS` — allowed frontend origins for CORS

### Frontend

- `VITE_API_URL` — backend base URL used by the React app

## Deployment

This project is configured for deployment in two parts:

- Render hosts the FastAPI backend using the Docker configuration in `Dockerfile`
- Vercel hosts the frontend using the Vite build setup in `package.json` and `vercel.json`

After deployment:

1. Set the deployed Render API URL in the Vercel frontend environment as `VITE_API_URL`
2. Set the deployed Vercel frontend URL in the Render backend environment as `WATTWISE_CORS_ORIGINS`
3. Verify the backend health endpoint at `/health`

## Notes

This application is designed as an artifact-only forecasting system. The model is loaded from the trained `.joblib` bundle and used for inference without retraining in the application runtime.

The repo is kept intentionally lean and production-oriented so it is suitable for a professional submission and review.
