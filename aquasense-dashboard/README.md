# AquaSense Dashboard

React 18 + Vite dashboard for real-time water quality monitoring.

## Features

- **Live sensor cards** — pH, turbidity, temperature with inline gauges and trend arrows
- **WQI ring gauge** — animated Water Quality Index with confidence score
- **Real-time chart** — 60-point rolling line chart, toggleable per sensor, WHO threshold lines
- **Alert panel** — live alerts with severity badges, one-click resolve
- **History table** — paginated readings with quality overlays
- **Stats bar** — averages, out-of-range count, dominant quality class
- **WebSocket** — Socket.io live updates from Node.js backend
- **Device selector** — filter by sensor device ID
- **Dark bioluminescent theme** — Syne + IBM Plex Mono typography

## Quick Start

```bash
npm install
npm run dev
# → http://localhost:3000
```

Requires the backend running on `http://localhost:5000`.

## Environment

| Variable        | Default      | Description             |
|-----------------|--------------|-------------------------|
| `VITE_API_KEY`  | `changeme`   | Must match backend `.env` API_KEY |

## Full Stack Startup (all 3 services)

```powershell
# Terminal 1 — ML service
cd aquasense-ml
uvicorn app:app --port 8000

# Terminal 2 — Node.js backend
cd aquasense-backend
npm run dev

# Terminal 3 — React dashboard
cd aquasense-dashboard
npm run dev

# Terminal 4 — Sensor simulator (optional)
cd aquasense-backend
node scripts/simulate.js
```

Then open http://localhost:3000

## Project Structure

```
src/
├── main.jsx
├── App.jsx              # Root — state, tabs, layout
├── App.module.css
├── index.css            # Design system tokens
├── components/
│   ├── Header.jsx       # Nav bar + connection status
│   ├── SensorCard.jsx   # pH / turbidity / temperature card
│   ├── WQIPanel.jsx     # WQI ring gauge + quality class
│   ├── LiveChart.jsx    # Recharts rolling line chart
│   ├── AlertPanel.jsx   # Alert list with resolve actions
│   ├── HistoryTable.jsx # Paginated reading history
│   └── StatsBar.jsx     # Summary metrics strip
├── hooks/
│   └── useSocket.js     # Socket.io real-time hook
├── services/
│   └── api.js           # Axios REST client
└── utils/
    └── helpers.js       # Formatting, color, config
```
