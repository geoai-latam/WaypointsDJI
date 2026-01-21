# GeoFlight Planner

Sistema de planificación de vuelos fotogramétricos para drones DJI Mini 4 Pro y Mini 5 Pro.

## Descripción

GeoFlight Planner es una aplicación web full-stack que permite:

1. **Dibujar un área** (polígono) en un mapa interactivo con ArcGIS
2. **Configurar parámetros**: GSD objetivo, overlap, ángulo de vuelo, modelo de cámara
3. **Calcular automáticamente**: altura de vuelo, espaciado entre fotos/líneas, velocidad
4. **Ver preview de la ruta** con diferentes patrones (grid, double grid, corredor, circular)
5. **Descargar archivo KMZ** compatible con DJI Fly

## Stack Tecnológico

- **Backend**: Python 3.10+ / FastAPI
- **Frontend**: React + TypeScript + Vite
- **Mapas**: ArcGIS JavaScript API
- **Geometría**: Shapely / pyproj

## Estructura del Proyecto

```
geoflight/
├── backend/              # FastAPI backend
│   ├── app/
│   │   ├── main.py       # API endpoints
│   │   ├── models.py     # Pydantic models
│   │   ├── calculator.py # Photogrammetric calculations
│   │   ├── patterns/     # Flight pattern generators
│   │   ├── wpml_builder.py
│   │   └── kmz_packager.py
│   └── tests/
│
├── frontend/             # React frontend
│   ├── src/
│   │   ├── components/   # React components
│   │   ├── hooks/        # Custom hooks
│   │   ├── services/     # API client
│   │   └── types/        # TypeScript types
│   └── package.json
│
└── README.md
```

## Inicio Rápido

### Backend

```bash
cd backend
python -m venv venv
venv\Scripts\activate  # Windows
pip install -r requirements.txt
uvicorn app.main:app --reload
```

### Frontend

```bash
cd frontend
npm install
npm run dev
```

## Patrones de Vuelo

| Patrón | Descripción | Uso |
|--------|-------------|-----|
| Grid | Líneas paralelas en serpentín | Ortofotomosaico |
| Double Grid | Dos pasadas perpendiculares | Modelos 3D |
| Corredor | Líneas paralelas a un eje | Carreteras, ríos |
| Órbita | Círculos concéntricos | Torres, edificios |

## Formato KMZ

El archivo KMZ generado es compatible con DJI Fly y contiene:

- `wpmz/template.kml` - Metadatos de la misión
- `wpmz/waylines.wpml` - Waypoints ejecutables

### Instalación en el drone

Copiar el archivo `.kmz` a:
```
/Android/data/dji.go.v5/files/waypoint/
```

## Limitaciones DJI Fly

- Máximo ~99 waypoints por misión
- Intervalo mínimo de fotos: 2s (12MP), 5s (48MP)

## API Endpoints

| Método | Endpoint | Descripción |
|--------|----------|-------------|
| GET | `/api/cameras` | Lista de cámaras disponibles |
| POST | `/api/calculate` | Calcula parámetros de vuelo |
| POST | `/api/generate-waypoints` | Genera waypoints según patrón |
| POST | `/api/generate-kmz` | Genera y retorna archivo KMZ |

## Licencia

MIT
