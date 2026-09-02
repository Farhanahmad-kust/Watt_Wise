import { useEffect, useState } from 'react'
import {
  Activity, AlertTriangle, ArrowUpRight, BarChart3, Bell, Bolt,
  Check, ChevronDown, CircleHelp, CloudSun, Database, FileUp, Gauge,
  LayoutDashboard, Menu, RotateCcw, Settings2, ShieldCheck, Sparkles,
  Upload, X,
} from 'lucide-react'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000'

const initialForm = {
  date: '2016-05-27T17:50', Appliances: 120, T1: 21.5, RH_1: 40,
  T2: 20.5, RH_2: 40, T_out: 15, RH_out: 60, tariff_per_kwh: 0.25,
}

const fields = [
  ['Appliances', 'Current use', 'Wh', 'number'],
  ['T1', 'Kitchen temperature', '°C', 'number'],
  ['RH_1', 'Kitchen humidity', '%', 'number'],
  ['T2', 'Living room temperature', '°C', 'number'],
  ['RH_2', 'Living room humidity', '%', 'number'],
  ['T_out', 'Outdoor temperature', '°C', 'number'],
  ['RH_out', 'Outdoor humidity', '%', 'number'],
]

function formatNumber(value, digits = 0) {
  return value == null ? '—' : Number(value).toLocaleString(undefined, { maximumFractionDigits: digits, minimumFractionDigits: digits })
}

function App() {
  const [mode, setMode] = useState('manual')
  const [form, setForm] = useState(initialForm)
  const [result, setResult] = useState(null)
  const [history, setHistory] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [apiOnline, setApiOnline] = useState(false)
  const [batchFile, setBatchFile] = useState(null)
  const [batchResult, setBatchResult] = useState(null)
  const [mobileNav, setMobileNav] = useState(false)
  const [activeView, setActiveView] = useState('overview')

  useEffect(() => {
    fetch(`${API_URL}/health`).then((response) => response.json()).then((data) => setApiOnline(data.status === 'ok')).catch(() => setApiOnline(false))
  }, [])

  function updateField(key, value) {
    setForm((current) => ({ ...current, [key]: key === 'date' ? value : Number(value) }))
  }

  async function submitManual(event) {
    event.preventDefault()
    setLoading(true); setError(''); setBatchResult(null)
    try {
      const response = await fetch(`${API_URL}/api/v1/predict/manual`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form),
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.detail || 'Unable to generate forecast')
      setResult(data)
      setHistory((items) => [{ ...data, time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) }, ...items].slice(0, 4))
    } catch (submitError) { setError(submitError.message) } finally { setLoading(false) }
  }

  async function submitBatch(event) {
    event.preventDefault()
    if (!batchFile) return
    setLoading(true); setError('')
    const body = new FormData(); body.append('file', batchFile)
    try {
      const response = await fetch(`${API_URL}/api/v1/predict/batch?tariff_per_kwh=${form.tariff_per_kwh}`, { method: 'POST', body })
      const data = await response.json()
      if (!response.ok) throw new Error(data.detail || 'Unable to analyze CSV')
      setBatchResult(data)
      const firstRow = data?.rows?.[0] ?? null
      setResult(firstRow ? {
        prediction_wh: firstRow.prediction_wh,
        lower_wh: firstRow.lower_90_wh,
        upper_wh: firstRow.upper_90_wh,
        estimated_cost: firstRow.estimated_cost,
        anomaly_threshold_wh: firstRow.prediction_wh || 0,
        observed_next_wh: firstRow.observed_next_wh ?? null,
        high_use_indicator: firstRow.high_use_indicator ?? null,
      } : null)
    } catch (submitError) { setError(submitError.message) } finally { setLoading(false) }
  }

  const displayResult = result || (batchResult?.rows?.[0] ? {
    prediction_wh: batchResult.rows[0].prediction_wh,
    lower_wh: batchResult.rows[0].lower_90_wh,
    upper_wh: batchResult.rows[0].upper_90_wh,
    estimated_cost: batchResult.rows[0].estimated_cost,
    anomaly_threshold_wh: batchResult.rows[0].prediction_wh || 0,
    observed_next_wh: batchResult.rows[0].observed_next_wh ?? null,
    high_use_indicator: batchResult.rows[0].high_use_indicator ?? null,
  } : null)
  const forecast = displayResult?.prediction_wh || 0
  const confidenceWidth = displayResult ? Math.min(100, ((displayResult.upper_wh - displayResult.lower_wh) / Math.max(displayResult.upper_wh, 1)) * 100) : 0
  const viewMeta = {
    overview: ['MONITORING / HOUSE 01', 'Energy overview', 'A clear view of what your building will use next.'],
    forecasts: ['WORKSPACE / FORECASTS', 'Forecast history', 'Review the predictions generated for your building.'],
    signals: ['WORKSPACE / SIGNALS', 'Operational signals', 'Understand what the model can and cannot tell you.'],
    sources: ['WORKSPACE / DATA SOURCES', 'Data sources', 'See what information powers each forecast.'],
  }[activeView]

  function navigate(view) {
    setActiveView(view)
    setMobileNav(false)
  }

  return <div className="app-shell">
    <aside className={`sidebar ${mobileNav ? 'open' : ''}`}>
      <div className="brand"><span className="brand-mark"><Bolt size={18} fill="currentColor" /></span><span>WattWise</span><span className="brand-dot" /></div>
      <div className="workspace-label">WORKSPACE</div>
      <nav>
        <button className={`nav-item ${activeView === 'overview' ? 'active' : ''}`} onClick={() => navigate('overview')}><LayoutDashboard size={18} /> Overview</button>
        <button className={`nav-item ${activeView === 'forecasts' ? 'active' : ''}`} onClick={() => navigate('forecasts')}><BarChart3 size={18} /> Forecasts {history.length > 0 && <span className="nav-count">{history.length}</span>}</button>
        <button className={`nav-item ${activeView === 'signals' ? 'active' : ''}`} onClick={() => navigate('signals')}><Activity size={18} /> Signals</button>
        <button className={`nav-item ${activeView === 'sources' ? 'active' : ''}`} onClick={() => navigate('sources')}><Database size={18} /> Data sources</button>
      </nav>
      <div className="sidebar-bottom">
        <div className="model-status"><span className={`status-dot ${apiOnline ? 'online' : ''}`} /><div><strong>Forecast engine</strong><span>{apiOnline ? 'Live and ready' : 'Connecting to API'}</span></div></div>
        <button className={`nav-item ${activeView === 'settings' ? 'active' : ''}`} onClick={() => navigate('settings')}><Settings2 size={18} /> Settings</button>
        <div className="user"><div className="avatar">FA</div><div><strong>Farhan Ahmad</strong><span>Building operator</span></div><ChevronDown size={15} /></div>
      </div>
    </aside>

    {mobileNav && <button className="nav-scrim" onClick={() => setMobileNav(false)} aria-label="Close navigation" />}
    <main className="main-content">
      <header className="topbar"><button className="icon-button menu-button" onClick={() => setMobileNav(true)} aria-label="Open navigation"><Menu size={20} /></button><div className="breadcrumb"><span>Workspace</span><span>/</span><strong>Energy overview</strong></div><div className="top-actions"><span className="last-sync"><span className={`status-dot ${apiOnline ? 'online' : ''}`} /> {apiOnline ? 'Live connection' : 'Offline'}</span><button className="icon-button" aria-label="Notifications"><Bell size={19} /><i /></button><button className="help-button"><CircleHelp size={17} /> Help</button></div></header>
      <div className="page">
        <section className="page-heading"><div><p className="eyebrow">{viewMeta?.[0] || 'WORKSPACE / SETTINGS'}</p><h1>{viewMeta?.[1] || 'Settings'}</h1><p className="subhead">{viewMeta?.[2] || 'Configure your WattWise workspace.'}</p></div><div className="heading-date"><span className="live-pulse" /> {apiOnline ? 'Data updated just now' : 'Waiting for API'}</div></section>

        {activeView !== 'overview' ? <WorkspaceView view={activeView} result={result} history={history} batchResult={batchResult} navigate={navigate} /> : <>

        <section className="hero-grid">
          <div className="forecast-card">
            <div className="card-heading"><div><span className="section-kicker"><Sparkles size={15} /> NEXT INTERVAL</span><h2>What will the building use?</h2></div><button className="more-button" aria-label="More forecast options">•••</button></div>
            <div className="forecast-main"><div className="forecast-value">{displayResult ? formatNumber(forecast, 1) : '—'}<span>Wh</span></div><div className="forecast-meta"><span className="forecast-arrow"><ArrowUpRight size={15} /> +10 min</span><span>Forecast horizon</span></div></div>
            <div className="range-wrap"><div className="range-label"><span>Expected range</span><strong>{displayResult ? `${formatNumber(displayResult.lower_wh)}–${formatNumber(displayResult.upper_wh)} Wh` : 'Run a forecast to see the range'}</strong></div><div className="range-track"><span className="range-fill" style={{ width: displayResult ? `${Math.max(18, confidenceWidth)}%` : '0%' }} /><span className="range-marker" style={{ left: displayResult ? '47%' : '0%' }} /></div><div className="range-foot"><span>Lower estimate</span><span>90% empirical interval</span><span>Upper estimate</span></div></div>
            <div className="forecast-foot"><span><ShieldCheck size={16} /> Validation-backed confidence</span><span className="muted">Model v1.0.0</span></div>
          </div>
          <div className="metric-stack"><MetricCard icon={<Gauge size={19} />} label="Estimated cost" value={displayResult ? `$${formatNumber(displayResult.estimated_cost, 3)}` : '—'} note="at current tariff" accent="amber" /><MetricCard icon={<AlertTriangle size={19} />} label="High-use signal" value={displayResult?.high_use_indicator === true ? 'Review now' : displayResult?.high_use_indicator === false ? 'Within range' : 'Awaiting data'} note={displayResult ? (displayResult.observed_next_wh != null ? `Observed ${formatNumber(displayResult.observed_next_wh)} Wh` : 'No observed value') : 'Observed value needed'} accent={displayResult?.high_use_indicator ? 'red' : 'mint'} /></div>
        </section>

        <section className="work-grid">
          <div className="panel input-panel">
            <div className="panel-header"><div><p className="eyebrow">FORECAST INPUT</p><h2>Build a forecast</h2></div><div className="segmented"><button className={mode === 'manual' ? 'selected' : ''} onClick={() => setMode('manual')}>Manual</button><button className={mode === 'batch' ? 'selected' : ''} onClick={() => setMode('batch')}>Batch CSV</button></div></div>
            {mode === 'manual' ? <form onSubmit={submitManual}><div className="date-row"><label>Date and time<input type="datetime-local" value={form.date} onChange={(event) => updateField('date', event.target.value)} /></label><label>Tariff <span className="unit">$/kWh</span><input type="number" step="0.01" min="0" value={form.tariff_per_kwh} onChange={(event) => updateField('tariff_per_kwh', event.target.value)} /></label></div><div className="form-divider"><span>Current sensor readings</span><span>7 signals</span></div><div className="field-grid">{fields.map(([key, label, unit, type]) => <label key={key}>{label}<span className="input-wrap"><input type={type} step="any" value={form[key]} onChange={(event) => updateField(key, event.target.value)} required /><em>{unit}</em></span></label>)}</div><div className="form-note"><CloudSun size={17} /><span>Weather readings and calendar features are derived automatically from the timestamp.</span></div><button className="primary-button" disabled={loading || !apiOnline}>{loading ? <RotateCcw className="spin" size={17} /> : <Sparkles size={17} />}{loading ? 'Calculating...' : 'Generate forecast'}<span className="button-shortcut">↵</span></button></form> : <form className="batch-form" onSubmit={submitBatch}><label className="dropzone"><input type="file" accept=".csv,text/csv" onChange={(event) => setBatchFile(event.target.files?.[0] || null)} /><span className="upload-icon"><Upload size={20} /></span><strong>{batchFile ? batchFile.name : 'Drop your sequence CSV here'}</strong><span>{batchFile ? `${(batchFile.size / 1024).toFixed(1)} KB ready` : 'Full schema · 145+ consecutive rows recommended'}</span><span className="browse-link">Browse files</span></label><div className="example-links"><span>Download examples:</span><a href={`${API_URL}/api/v1/batch/example?variant=typical`}>Typical day</a><a href={`${API_URL}/api/v1/batch/example?variant=weekend`}>Weekend</a><a href={`${API_URL}/api/v1/batch/example?variant=high-use`}>High-use</a></div><div className="form-note"><Database size={17} /><span>Batch mode returns a forecast for every row and flags unusually high observed use.</span></div><button className="primary-button" disabled={loading || !batchFile || !apiOnline}>{loading ? 'Analyzing...' : 'Analyze sequence'}<span className="button-shortcut">↵</span></button></form>}
            {error && <div className="error-banner"><X size={16} /> {error}</div>}
          </div>
          <div className="panel activity-panel"><div className="panel-header"><div><p className="eyebrow">RECENT ACTIVITY</p><h2>Forecast history</h2></div><button className="text-button">View all <ArrowUpRight size={14} /></button></div>{history.length === 0 ? <div className="empty-state"><div className="empty-icon"><Activity size={20} /></div><strong>No forecasts yet</strong><span>Your latest calculations will appear here.</span></div> : <div className="history-list">{history.map((item, index) => <div className="history-row" key={`${item.time}-${index}`}><div className="history-icon"><Bolt size={15} /></div><div className="history-detail"><strong>Manual forecast</strong><span>{item.time} · next 10 min</span></div><div className="history-value"><strong>{formatNumber(item.prediction_wh, 1)} Wh</strong><span>{item.high_use_indicator ? 'Review signal' : 'Within range'}</span></div><Check size={15} className="history-check" /></div>)}</div>}
            {batchResult && <div className="batch-summary"><div><strong>Batch analyzed</strong><span>{batchResult.row_count} rows returned</span></div><span className="batch-badge"><Check size={13} /> Complete</span></div>}
          </div>
        </section>
        </>}
        <footer className="page-footer"><span><ShieldCheck size={14} /> Signals are operational indicators, not proof of equipment faults.</span><span>WattWise · House 01</span></footer>
      </div>
    </main>
  </div>
}

function WorkspaceView({ view, result, history, batchResult, navigate }) {
  if (view === 'forecasts') return <section className="workspace-view"><div className="view-intro"><div className="view-icon"><BarChart3 size={21} /></div><div><h2>Forecast history</h2><p>Every manual forecast stays in this session so you can compare your latest readings and expected use.</p></div><button className="primary-button compact" onClick={() => navigate('overview')}><Sparkles size={16} /> New forecast</button></div>{history.length === 0 ? <div className="view-empty"><Activity size={22} /><strong>No forecasts generated yet</strong><span>Use the Overview workspace to create your first next-interval prediction.</span></div> : <div className="wide-history">{history.map((item, index) => <div className="wide-history-row" key={`${item.time}-${index}`}><div className="history-icon"><Bolt size={15} /></div><div className="history-detail"><strong>Manual forecast</strong><span>{item.time} · next 10 minutes</span></div><strong>{formatNumber(item.prediction_wh, 1)} Wh</strong><span className={item.high_use_indicator ? 'signal-text alert' : 'signal-text'}>{item.high_use_indicator ? 'Review signal' : 'Within expected range'}</span></div>)}</div>}</section>
  if (view === 'signals') return <section className="workspace-view"><div className="signal-hero"><div className="view-icon"><AlertTriangle size={21} /></div><div><h2>Signals are for attention, not diagnosis</h2><p>WattWise compares observed use with the model's expected use. A high-use signal means the reading is unusually above that expectation relative to validation residuals.</p></div></div><div className="info-grid"><InfoBlock title="What the model predicts" icon={<Sparkles size={18} />} text="Appliance energy consumption for the next 10-minute interval, measured in watt-hours (Wh). It is a short-horizon demand forecast, not an appliance-fault detector." /><InfoBlock title="What the user receives" icon={<Gauge size={18} />} text="A forecast value, empirical 90% range, estimated tariff cost, and an operational high-use indicator when the next observed reading is available." /><InfoBlock title="What a signal means" icon={<ShieldCheck size={18} />} text="The reading is higher than the validation-backed threshold for its forecast level. Review the building or sensor context before taking action." /></div></section>
  if (view === 'sources') return <section className="workspace-view"><div className="source-list"><SourceRow icon={<Activity size={19} />} title="Manual sensor readings" detail="Current appliance use, two indoor temperature/humidity pairs, and outdoor temperature/humidity." tag="7 signals" /><SourceRow icon={<Database size={19} />} title="Full-schema CSV" detail="A compatible ten-minute sequence with the source dataset's sensor names, units, and timestamps." tag={batchResult ? `${batchResult.row_count} rows analyzed` : '145+ rows recommended'} /><SourceRow icon={<CloudSun size={19} />} title="Derived context" detail="Calendar features such as time of day, weekday, month, and weekend status are calculated from the timestamp." tag="Automatic" /></div><div className="source-note"><ShieldCheck size={18} /><span>Raw input is validated before inference. The model artifact is loaded as-is and never retrained by the app.</span></div></section>
  return <section className="workspace-view"><div className="settings-row"><div className="view-icon"><Settings2 size={21} /></div><div><h2>Workspace settings</h2><p>WattWise is currently configured for House 01 and the trained v1.0.0 energy forecaster.</p></div></div><div className="info-grid"><InfoBlock title="Tariff" icon={<Gauge size={18} />} text="Set your local electricity price in dollars per kilowatt-hour on the Overview forecast form." /><InfoBlock title="Model scope" icon={<Database size={18} />} text="This prototype was trained on one sensor-equipped house covering January through May 2016." /><InfoBlock title="Connection" icon={<Activity size={18} />} text="The dashboard reads live status from the FastAPI inference backend at the configured API URL." /></div></section>
}

function InfoBlock({ icon, title, text }) { return <div className="info-block"><div className="info-icon">{icon}</div><h3>{title}</h3><p>{text}</p></div> }

function SourceRow({ icon, title, detail, tag }) { return <div className="source-row"><div className="source-icon">{icon}</div><div><strong>{title}</strong><p>{detail}</p></div><span>{tag}</span></div> }

function MetricCard({ icon, label, value, note, accent }) { return <div className={`metric-card ${accent}`}><div className="metric-icon">{icon}</div><span className="metric-label">{label}</span><strong>{value}</strong><span className="metric-note">{note}</span></div> }

export { App }
