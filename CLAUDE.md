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
│       ├── grid.py       # Serpentine/lawnmower pattern (buffer_percent for extension)
│       ├── double_grid.py # Two orthogonal passes for 3D models
│       ├── corridor.py   # Linear pattern for roads/rivers (polygon or centerline)
│       └── orbit.py      # Circular pattern for structures (polygon or center+radius)
│
└── frontend/src/
    ├── components/
    │   ├── Map/MapView.tsx      # ArcGIS 4.34 map with Sketch, Locate, BasemapGallery
    │   └── ConfigPanel/         # Mission parameter inputs with advanced options
    ├── hooks/useMission.ts      # Central state management hook with auto-recalculation
    ├── services/api.ts          # Backend API client
    └── types/index.ts           # TypeScript interfaces
```

## Key Technical Details

**Coordinate Systems:**
- User I/O: WGS84 (lat/lon)
- Map display: Web Mercator (auto-converted via webMercatorUtils)
- Internal calculations: UTM (meters) - transformed per-operation based on center point

**DJI Drone Values (for WPML):**
- Mini 4 Pro: droneEnumValue=68, payloadEnumValue=52
- Mini 5 Pro: droneEnumValue=91, payloadEnumValue=80

**Constraints:**
- Max ~99 waypoints per mission (DJI Fly limit)
- Photo interval: 2s (12MP) or 5s (48MP mode)
- Altitude max recommended: 120m (legal limit in most countries)

**Parameter Coherence:**
- GSD → Altitude: calculated automatically from target GSD
- Altitude Override → GSD: when altitude is manually set, GSD is recalculated
- Speed Override: capped by max speed allowed for photo interval

## API Endpoints

| Method | Endpoint | Purpose |
|--------|----------|---------|
| GET | `/api/cameras` | List drone presets |
| POST | `/api/calculate` | Calculate flight params (supports altitude_override_m, speed_override_ms) |
| POST | `/api/generate-waypoints` | Generate waypoints for preview |
| POST | `/api/generate-kmz` | Generate and download KMZ |
| GET | `/health` | Health check |

## Flight Patterns

All patterns support polygon input:

| Pattern | Input | Description |
|---------|-------|-------------|
| grid | polygon | Serpentine lines with 15% buffer beyond polygon |
| double_grid | polygon | Two perpendicular grid passes |
| corridor | polygon OR centerline | Extracts centerline from polygon's longest axis |
| orbit | polygon OR center+radius | Uses polygon centroid, radius from vertices +20% |

## Workflow

1. User draws polygon on ArcGIS map (centered on Bogotá by default)
2. User sets: target GSD, overlaps, drone model, 48MP mode, flight angle
3. User can override: altitude (recalculates GSD), speed
4. Backend calculates: altitude, footprint, spacing, max speed, photo count
5. Pattern generator creates waypoints (WGS84 → UTM → calculate → WGS84)
6. Frontend shows mission summary with waypoints count and estimated time
7. WPMLBuilder generates XML, KMZPackager creates ZIP
8. User downloads KMZ, copies to DJI Fly folder on device

## Frontend Widgets

- **Sketch**: Draw polygon/rectangle for survey area
- **Home**: Return to initial map view
- **Locate**: GPS location button
- **BasemapGallery**: Switch between satellite, topo, streets, etc.
- **ScaleBar**: Metric scale reference

## Important Files

- `calculator.py:125-197` - Main calculation logic with override support
- `useMission.ts:94-131` - Auto-recalculation on config changes
- `ConfigPanel.tsx:63-69` - Effective altitude/speed calculation
- `MapView.tsx:67-91` - Polygon processing with Web Mercator conversion
