# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

GeoFlight Planner is a full-stack web application for photogrammetric flight planning with DJI Mini 4 Pro and Mini 5 Pro drones. Users draw survey areas on a map, configure parameters, and export KMZ mission files compatible with DJI Fly.

## Commands

### Backend (FastAPI)

```bash
cd geoflight/backend
python -m venv venv
venv\Scripts\activate          # Windows
source venv/bin/activate       # Linux/Mac
pip install -r requirements.txt
uvicorn app.main:app --reload  # Runs on http://localhost:8000
```

**Run tests:**
```bash
cd geoflight/backend
pytest                    # All tests
pytest tests/test_api.py  # Single test file
pytest -k "test_calculate"  # Tests matching pattern
```

### Frontend (React + TypeScript + Vite)

```bash
cd geoflight/frontend
npm install
npm run dev      # Dev server on http://localhost:5173
npm run build    # TypeScript compile + Vite build
npm run lint     # ESLint (0 warnings policy)
```

## Architecture

```
geoflight/
├── backend/app/
│   ├── main.py           # FastAPI endpoints
│   ├── models.py         # Pydantic request/response models
│   ├── calculator.py     # PhotogrammetryCalculator - GSD, altitude, spacing math
│   ├── config.py         # Settings (max_waypoints=99, photo intervals)
│   ├── wpml_builder.py   # Generates DJI WPML XML (template.kml + waylines.wpml)
│   ├── kmz_packager.py   # Packages XML into KMZ (ZIP with wpmz/ folder)
│   └── patterns/         # Flight pattern generators
│       ├── base.py       # Abstract PatternGenerator with coordinate transforms
│       ├── grid.py       # Serpentine/lawnmower pattern
│       ├── double_grid.py # Two orthogonal passes for 3D models
│       ├── corridor.py   # Linear pattern for roads/rivers
│       └── orbit.py      # Circular pattern for structures
│
└── frontend/src/
    ├── components/
    │   ├── Map/MapView.tsx      # ArcGIS map with Sketch widget
    │   ├── ConfigPanel/         # Mission parameter inputs
    │   ├── Preview/             # Flight statistics display
    │   └── Export/              # KMZ download button
    ├── hooks/useMission.ts      # Central state management hook
    ├── services/api.ts          # Backend API client
    └── types/index.ts           # TypeScript interfaces
```

## Key Technical Details

**Coordinate Systems:**
- User I/O: WGS84 (lat/lon)
- Internal calculations: UTM (meters) - transformed per-operation based on center point

**DJI Drone Values (for WPML):**
- Mini 4 Pro: droneEnumValue=68, payloadEnumValue=52
- Mini 5 Pro: droneEnumValue=91, payloadEnumValue=80

**Constraints:**
- Max ~99 waypoints per mission (DJI Fly limit)
- Photo interval: 2s (12MP) or 5s (48MP mode)

## API Endpoints

| Method | Endpoint | Purpose |
|--------|----------|---------|
| GET | `/api/cameras` | List drone presets |
| POST | `/api/calculate` | Calculate flight params (no waypoints) |
| POST | `/api/generate-waypoints` | Generate waypoints for preview |
| POST | `/api/generate-kmz` | Generate and download KMZ |
| GET | `/health` | Health check |

## Workflow

1. User draws polygon on ArcGIS map
2. User sets: target GSD, overlaps, drone model, 48MP mode, flight angle
3. Backend calculates: altitude, footprint, spacing, max speed, photo count
4. Pattern generator creates waypoints (WGS84 → UTM → calculate → WGS84)
5. WPMLBuilder generates XML, KMZPackager creates ZIP
6. User downloads KMZ, copies to DJI Fly folder on device
