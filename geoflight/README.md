# GeoFlight Planner - Documentacion Tecnica

Sistema de planificacion de vuelos fotogrametricos para drones DJI Mini 4 Pro y Mini 5 Pro. Genera misiones exportables en formato KMZ compatible con DJI Fly.

**Arquitectura**: 100% client-side. Toda la computacion corre en un Web Worker para rendimiento optimo. No requiere backend.

---

## Arquitectura General

```
Frontend (React + Vite)
├── Main Thread
│   ├── App.tsx
│   ├── MapView.tsx (ArcGIS 4.34)
│   ├── ConfigPanel.tsx
│   ├── useMission.ts (Estado central)
│   ├── calculator.ts (Calculos UI)
│   └── workerClient.ts (Cliente Worker)
│
└── Web Worker
    ├── mission.worker.ts (Entry point)
    ├── patterns/
    │   ├── gridPattern.ts
    │   ├── doubleGridPattern.ts
    │   ├── corridorPattern.ts
    │   └── orbitPattern.ts
    └── services/
        ├── coordinateTransformer.ts (proj4)
        ├── waypointSimplifier.ts
        ├── wpmlBuilder.ts
        └── kmzPackager.ts (JSZip)
```

---

## Flujo de Datos

```
Usuario dibuja poligono
       │
       ▼
MapView.tsx (ArcGIS)
       │ Coordenadas WGS84
       ▼
useMission.ts
       │ MissionRequest
       ▼
workerClient.ts ──────────────────► Web Worker
       │                                  │
       │                                  ├─ Calcular FlightParams
       │                                  ├─ Generar Waypoints
       │                                  ├─ Simplificar (opcional)
       │                                  └─ Crear KMZ
       │                                  │
       ◄──────────────────────────────────┘
       │ MissionResponse / Blob
       ▼
MapView renderiza waypoints
ConfigPanel muestra parametros
Usuario descarga KMZ
```

---

## Patrones de Vuelo

### 1. Grid (Serpentin)

Barrido en lineas paralelas con giros alternados. Ideal para fotogrametria de areas.

```
   1 ──► 2 ──► 3 ──► 4 ──► 5
                           │
                           ▼
   10 ◄── 9 ◄── 8 ◄── 7 ◄── 6
   │
   ▼
   11 ──► 12 ──► 13 ──► 14 ──► 15
```

### 2. Double Grid (Cuadricula Doble)

Dos pasadas perpendiculares para mejor reconstruccion 3D.

```
Primera Pasada (0°)       Segunda Pasada (90°)
    →  →  →  →                 ↓  ↓  ↓
    ←  ←  ←  ←      +          ↓  ↓  ↓
    →  →  →  →                 ↓  ↓  ↓
```

### 3. Corridor (Corredor)

Lineas paralelas para estructuras lineales (carreteras, rios, lineas de transmision).

```
   ← ← ← ← ← ← ← Linea Izq
   → → → → → → → Linea Central
   ← ← ← ← ← ← ← Linea Der
```

### 4. Orbit (Orbita)

Circulos concentricos para estructuras verticales (torres, edificios).

```
Vista Superior           Vista Lateral
    . . . . .           Orbita 3 ──── 133m
  .           .         Orbita 2 ──── 123m
 .      X      .        Orbita 1 ──── 113m
  .           .             ▲
    . . . . .          [Estructura]
```

---

## Formulas Fotogrametricas

| Parametro | Formula |
|-----------|---------|
| **Altitud** | `(GSD × focal_mm × image_width_px) / (sensor_width_mm × 100)` |
| **GSD** | `(sensor_width_mm × altitude_m × 100) / (focal_mm × image_width_px)` |
| **Footprint Width** | `(sensor_width_mm / focal_mm) × altitude_m` |
| **Footprint Height** | `(sensor_height_mm / focal_mm) × altitude_m` |
| **Photo Spacing** | `footprint_height × (1 - front_overlap / 100)` |
| **Line Spacing** | `footprint_width × (1 - side_overlap / 100)` |
| **Max Speed** | `photo_spacing / photo_interval` |

---

## Especificaciones de Camaras

| Drone | Sensor | Focal | Resolucion | Enum DJI | Intervalo |
|-------|--------|-------|------------|----------|-----------|
| Mini 4 Pro | 9.59 × 7.19 mm (1/1.3") | 6.72 mm | 8064 × 6048 px (48MP) | 91/68 | 2s (12MP), 5s (48MP) |
| Mini 5 Pro | 13.20 × 8.80 mm (1") | 8.82 mm | 8192 × 6144 px (50MP) | 100/80 | 2s (12MP), 5s (50MP) |

---

## Formato DJI KMZ

```
mission.kmz (ZIP)
└── wpmz/
    ├── template.kml    # Metadatos mision
    └── waylines.wpml   # Waypoints ejecutables
```

### Acciones por Waypoint

- **Primer Waypoint**: takePhoto + gimbalRotate + gimbalEvenlyRotate
- **Intermedios**: gimbalEvenlyRotate (transicion)
- **Ultimo Waypoint**: Sin acciones

---

## Modo Timer (Simplificacion)

Para areas grandes que exceden el limite de 99 waypoints:

1. Habilitar "Modo Timer" en opciones avanzadas
2. Configurar intervalo de foto (2-10s) y velocidad (1-15 m/s)
3. El sistema calcula el overlap real: `overlap = 1 - (speed × interval) / footprint_height`
4. El simplificador fusiona segmentos colineales
5. Usar el timer de fotos de DJI Fly durante el vuelo

---

## Comandos

```bash
cd geoflight/frontend

# Instalar dependencias
npm install

# Servidor de desarrollo
npm run dev

# Build produccion
npm run build

# Tests
npm run test

# Lint
npm run lint
```

---

## Dependencias Clave

| Paquete | Funcion |
|---------|---------|
| proj4 | Transformacion coordenadas WGS84 ↔ UTM |
| @turf/turf | Operaciones geoespaciales (buffer, intersect, rotate) |
| jszip | Creacion archivos KMZ (formato ZIP) |
| @arcgis/core | Mapa interactivo y dibujo de poligonos |

---

## Limites y Restricciones

| Restriccion | Valor | Nota |
|-------------|-------|------|
| Max waypoints | **99** | Limite DJI Fly |
| GSD minimo | 0.5 cm/px | Alta resolucion |
| GSD maximo | 5.0 cm/px | Baja resolucion |
| Overlaps | 50-90% | Rango valido |
| Altitud recomendada | ≤ 120 m | Regulaciones |

---

*GeoFlight Planner v2.0 - 100% Client-Side*
