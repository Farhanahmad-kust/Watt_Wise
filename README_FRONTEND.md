# WattWise frontend

React + Vite client for the WattWise FastAPI backend.

## Run locally

```powershell
npm install
npm run dev
```

The Vite client runs at `http://localhost:5173` and expects the API at `http://localhost:8000`. Override the API URL with `VITE_API_URL` when deploying.

Production build:

```powershell
npm run build
```

## Deploy the frontend

Import the repository into Vercel. It detects Vite automatically; use `npm run build` as the build command and `dist` as the output directory. Add the environment variable `VITE_API_URL` with the deployed Render backend URL, then redeploy. After the frontend URL is known, set that URL in the backend's `WATTWISE_CORS_ORIGINS` environment variable and redeploy the backend.
