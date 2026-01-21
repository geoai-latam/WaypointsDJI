# GeoFlight Planner - Frontend

React + TypeScript + ArcGIS frontend for photogrammetric flight planning.

## Setup

1. Install dependencies:
```bash
npm install
```

2. Start development server:
```bash
npm run dev
```

The app will be available at http://localhost:5173

## Features

- Interactive map with ArcGIS JS API
- Draw polygons to define survey areas
- Configure flight parameters (GSD, overlap, pattern)
- Preview generated waypoints on map
- Download KMZ files compatible with DJI Fly

## Project Structure

```
frontend/
├── src/
│   ├── App.tsx            # Main application
│   ├── components/
│   │   ├── Map/           # ArcGIS map component
│   │   └── ConfigPanel/   # Configuration panel
│   ├── hooks/             # Custom React hooks
│   ├── services/          # API service layer
│   └── types/             # TypeScript types
├── package.json
└── vite.config.ts
```

## Build

```bash
npm run build
```

Built files will be in `dist/` folder.
