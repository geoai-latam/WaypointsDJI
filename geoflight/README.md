# GeoFlight Planner

Sistema de planificación de vuelos fotogramétricos para drones DJI Mini 4 Pro y Mini 5 Pro.

## Descripción

GeoFlight Planner es una aplicación web full-stack que permite:

1. **Dibujar un área** (polígono) en un mapa interactivo con ArcGIS
2. **Configurar parámetros**: GSD objetivo, overlap, ángulo de vuelo, modelo de dron
3. **Calcular automáticamente**: altura de vuelo, espaciado entre fotos/líneas, velocidad máxima
4. **Override manual**: Sobrescribir altitud o velocidad con recálculo automático de parámetros dependientes
5. **Ver preview de la ruta** con diferentes patrones (Grid, Double Grid, Corredor, Órbita)
6. **Descargar archivo KMZ** compatible con DJI Fly

## Características

- **Mapa interactivo** con ArcGIS JS API 4.34
- **Widgets incluidos**: Localización GPS, galería de mapas base, barra de escala
- **Patrones de vuelo** generados desde polígono dibujado
- **Coherencia de parámetros**: GSD ↔ Altitud bidireccional
- **Validaciones** en tiempo real con advertencias
- **Resumen de misión** con tiempo estimado total

## Stack Tecnológico

- **Backend**: Python 3.10+ / FastAPI
- **Frontend**: React 18 + TypeScript + Vite
- **Mapas**: ArcGIS JavaScript API 4.34
- **Geometría**: Shapely / PyProj

## Estructura del Proyecto

```
geoflight/
├── backend/              # FastAPI backend
│   ├── app/
│   │   ├── main.py       # API endpoints
│   │   ├── models.py     # Pydantic models
│   │   ├── calculator.py # Cálculos fotogramétricos
│   │   ├── config.py     # Configuración
│   │   ├── patterns/     # Generadores de patrones
│   │   │   ├── base.py       # Clase base con transformaciones UTM
│   │   │   ├── grid.py       # Patrón serpentín
│   │   │   ├── double_grid.py # Doble pasada perpendicular
│   │   │   ├── corridor.py   # Corredor lineal
│   │   │   └── orbit.py      # Órbita circular
│   │   ├── wpml_builder.py   # Generador XML WPML
│   │   └── kmz_packager.py   # Empaquetador KMZ
│   ├── tests/
│   └── requirements.txt
│
├── frontend/             # React frontend
│   ├── src/
│   │   ├── components/
│   │   │   ├── Map/          # Mapa ArcGIS con widgets
│   │   │   └── ConfigPanel/  # Panel de configuración
│   │   ├── hooks/
│   │   │   └── useMission.ts # Estado central de la misión
│   │   ├── services/
│   │   │   └── api.ts        # Cliente API
│   │   └── types/
│   │       └── index.ts      # Tipos TypeScript
│   ├── package.json
│   └── vite.config.ts
│
└── README.md
```

## Inicio Rápido

### Backend

```bash
cd geoflight/backend
python -m venv venv
venv\Scripts\activate      # Windows
source venv/bin/activate   # Linux/Mac
pip install -r requirements.txt
uvicorn app.main:app --reload
```

El backend estará disponible en `http://localhost:8000`

### Frontend

```bash
cd geoflight/frontend
npm install
npm run dev
```

El frontend estará disponible en `http://localhost:5173`

## Patrones de Vuelo

| Patrón | Icono | Descripción | Uso Típico |
|--------|-------|-------------|------------|
| Grid | ▤ | Líneas paralelas en serpentín | Ortofotomosaico |
| Double Grid | ▦ | Dos pasadas perpendiculares | Modelos 3D |
| Corredor | ═ | Líneas paralelas al eje largo | Carreteras, ríos, líneas eléctricas |
| Órbita | ◎ | Círculos concéntricos | Torres, edificios, estructuras verticales |

### Generación desde Polígono

Todos los patrones se generan automáticamente desde el polígono dibujado:

- **Grid/Double Grid**: Extiende líneas 15% más allá del polígono para cobertura completa
- **Corredor**: Extrae la línea central del eje más largo del polígono
- **Órbita**: Usa el centroide como centro y calcula el radio desde los vértices (+20% margen)

## Parámetros de Vuelo

### Parámetros Principales

| Parámetro | Rango | Descripción |
|-----------|-------|-------------|
| GSD Objetivo | 0.5 - 5.0 cm/px | Resolución de píxel en terreno |
| Overlap Frontal | 50% - 90% | Superposición entre fotos consecutivas |
| Overlap Lateral | 50% - 90% | Superposición entre líneas de vuelo |
| Ángulo de Vuelo | 0° - 359° | Dirección de las líneas de vuelo |

### Parámetros Avanzados

| Parámetro | Descripción |
|-----------|-------------|
| Override Altitud | Fija la altitud manualmente (recalcula GSD) |
| Override Velocidad | Fija la velocidad manualmente |
| Ángulo Gimbal | Inclinación de la cámara (-90° nadir a 0° horizonte) |
| Acción Final | RTH, Aterrizar, Hover, o Ir al primer waypoint |

### Coherencia de Parámetros

El sistema mantiene coherencia bidireccional:

- **Sin override**: GSD → Altitud (calculada automáticamente)
- **Con override de altitud**: Altitud manual → GSD recalculado
- **Con override de velocidad**: Velocidad limitada por intervalo de foto

## API Endpoints

| Método | Endpoint | Descripción |
|--------|----------|-------------|
| GET | `/api/cameras` | Lista de drones/cámaras disponibles |
| POST | `/api/calculate` | Calcula parámetros (soporta overrides) |
| POST | `/api/generate-waypoints` | Genera waypoints según patrón |
| POST | `/api/generate-kmz` | Genera y descarga archivo KMZ |
| GET | `/health` | Health check |

### Ejemplo de Request

```json
POST /api/generate-waypoints
{
  "polygon": {
    "coordinates": [
      {"longitude": -74.0721, "latitude": 4.7110},
      {"longitude": -74.0715, "latitude": 4.7110},
      {"longitude": -74.0715, "latitude": 4.7105},
      {"longitude": -74.0721, "latitude": 4.7105}
    ]
  },
  "drone_model": "mini_4_pro",
  "pattern": "grid",
  "target_gsd_cm": 2.0,
  "front_overlap_pct": 75,
  "side_overlap_pct": 65,
  "flight_angle_deg": 0,
  "use_48mp": false,
  "altitude_override_m": null,
  "speed_ms": null,
  "finish_action": "goHome"
}
```

## Formato KMZ

El archivo KMZ generado es compatible con DJI Fly y contiene:

```
mission.kmz
└── wpmz/
    ├── template.kml   # Metadatos de la misión
    └── waylines.wpml  # Waypoints ejecutables
```

### Instalación en el Drone

1. Descarga el archivo `.kmz`
2. Conecta el dispositivo móvil al computador
3. Copia el archivo a:
   ```
   /Android/data/dji.go.v5/files/waypoint/
   ```
4. Abre DJI Fly → Waypoint → Importar

## Limitaciones DJI Fly

- **Máximo ~99 waypoints** por misión
- **Intervalo mínimo de fotos**: 2s (12MP), 5s (48MP)
- **Altitud máxima recomendada**: 120m (regulaciones locales)

## Drones Soportados

| Modelo | droneEnumValue | payloadEnumValue |
|--------|----------------|------------------|
| DJI Mini 4 Pro | 68 | 52 |
| DJI Mini 5 Pro | 91 | 80 |

## Desarrollo

### Tests Backend

```bash
cd geoflight/backend
pytest                     # Todos los tests
pytest tests/test_api.py   # Tests de API
pytest -k "test_calculate" # Tests específicos
```

### Build Frontend

```bash
cd geoflight/frontend
npm run build    # Build de producción
npm run lint     # ESLint
```

## Licencia

MIT
