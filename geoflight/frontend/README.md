# GeoFlight Planner - Frontend

Interfaz web React + TypeScript con mapas ArcGIS para planificacion de vuelos fotogrametricos.

**Arquitectura**: 100% client-side con Web Worker para computacion pesada.

---

## Arquitectura

```
src/
├── Main Thread
│   ├── App.tsx              # Componente principal
│   ├── components/
│   │   ├── Map/MapView.tsx  # Mapa ArcGIS + widgets
│   │   └── ConfigPanel/     # Panel de configuracion
│   ├── hooks/
│   │   └── useMission.ts    # Estado central
│   ├── services/
│   │   ├── calculator.ts    # Calculos UI (tiempo real)
│   │   └── workerClient.ts  # Cliente Web Worker
│   └── types/
│       └── index.ts         # Tipos + CAMERA_PRESETS
│
└── Web Worker (src/worker/)
    ├── mission.worker.ts    # Entry point
    ├── types.ts             # Tipos de mensajes
    ├── patterns/            # Generadores de patrones
    │   ├── basePattern.ts
    │   ├── gridPattern.ts
    │   ├── doubleGridPattern.ts
    │   ├── corridorPattern.ts
    │   └── orbitPattern.ts
    └── services/            # Servicios del Worker
        ├── coordinateTransformer.ts
        ├── waypointSimplifier.ts
        ├── wpmlBuilder.ts
        └── kmzPackager.ts
```

---

## Instalacion

```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # Produccion
npm run test     # Tests
npm run lint     # Lint
```

---

## Flujo de Datos

```
Usuario ──► MapView (dibuja poligono)
              │
              ▼
         useMission.ts
              │
     ┌────────┴────────┐
     │                 │
     ▼                 ▼
calculator.ts    workerClient.ts
(UI tiempo real)      │
                      ▼
              Web Worker
                      │
                      ▼
              Waypoints / KMZ
```

**calculator.ts**: Calculos rapidos para mostrar en UI (se ejecutan en cada cambio de config)

**Web Worker**: Generacion de waypoints y KMZ (operaciones pesadas, no bloquean UI)

---

## Componentes

### MapView.tsx

Mapa interactivo con ArcGIS JS API 4.34.

**Widgets:**
| Widget | Funcion |
|--------|---------|
| Sketch | Dibujar poligono/rectangulo |
| Home | Volver a vista inicial |
| Locate | GPS del usuario |
| BasemapGallery | Cambiar mapa base |
| ScaleBar | Escala metrica |

**Capas graficas:**
- `sketchLayer`: Poligono dibujado
- `routeLayer`: Linea de ruta
- `waypointsLayer`: Marcadores de waypoints
- `labelsLayer`: Etiquetas INICIO/FIN

### ConfigPanel.tsx

Panel de configuracion de mision.

**Secciones:**
1. **Summary**: Area, waypoints, distancia, tiempo estimado
2. **Configuracion basica**: Drone, patron, GSD, overlaps, angulo
3. **Opciones avanzadas**: Altitud manual, gimbal, modo timer
4. **Parametros calculados**: Altitud, velocidad, footprint, espaciados
5. **Acciones**: Generar mision, descargar KMZ

---

## Hook useMission

Estado central de la aplicacion.

```typescript
// Estados
config          // MissionConfig - parametros del usuario
flightParams    // FlightParams - calculados localmente
waypoints       // Waypoint[] - generados por Worker
polygonCoords   // Coordinate[] - vertices del poligono
areaSqM         // number - area en m2
validationErrors // string[] - errores de validacion
simplificationStats // Estadisticas de simplificacion

// Funciones
updateConfig()      // Actualiza configuracion
generateMission()   // Genera waypoints (via Worker)
downloadKmz()       // Descarga archivo KMZ (via Worker)
```

---

## Tipos TypeScript

```typescript
// Enums
type DroneModel = 'mini_4_pro' | 'mini_5_pro'
type FlightPattern = 'grid' | 'double_grid' | 'corridor' | 'orbit'

// Especificaciones de camara (constante local)
const CAMERA_PRESETS: Record<DroneModel, CameraSpec> = {
  mini_4_pro: { sensor_width_mm: 9.59, ... },
  mini_5_pro: { sensor_width_mm: 13.20, ... },
}

// Interfaces principales
interface MissionConfig {
  droneModel: DroneModel
  pattern: FlightPattern
  targetGsdCm: number
  frontOverlapPct: number
  sideOverlapPct: number
  flightAngleDeg: number
  gimbalPitchDeg: number
  // Timer mode
  useTimerMode: boolean
  photoIntervalS: number
  speedMs: number
}

interface Waypoint {
  index: number
  longitude: number
  latitude: number
  altitude: number
  heading: number
  gimbal_pitch: number
  speed: number
  take_photo: boolean
}
```

---

## Web Worker

El Worker maneja las operaciones pesadas:

**Mensajes soportados:**
- `GENERATE_WAYPOINTS`: Genera waypoints segun patron
- `GENERATE_KMZ`: Genera y empaqueta archivo KMZ

**Servicios del Worker:**
- `coordinateTransformer`: WGS84 ↔ UTM (proj4)
- `waypointSimplifier`: Reduce waypoints fusionando segmentos colineales
- `wpmlBuilder`: Genera XML en formato DJI WPML
- `kmzPackager`: Empaqueta KML + WPML en ZIP

---

## Dependencias

| Paquete | Uso |
|---------|-----|
| react | UI framework |
| typescript | Tipado estatico |
| vite | Build tool |
| @arcgis/core | Mapas interactivos |
| proj4 | Transformacion coordenadas |
| @turf/turf | Operaciones geoespaciales |
| jszip | Creacion KMZ |
| vitest | Testing |

---

## Estilos

**Paleta de colores (CSS Variables):**

```css
--bg: #0B0F14           /* Fondo */
--surface: #111827      /* Paneles */
--primary: #F97316      /* Naranja DJI */
--success: #22C55E      /* Verde */
--warning: #F59E0B      /* Amarillo */
--error: #EF4444        /* Rojo */
```

---

## Agregar Nuevas Funcionalidades

### Nuevo Modelo de Drone

1. Agregar a `DroneModel` en `types/index.ts`
2. Agregar specs a `CAMERA_PRESETS`

### Nuevo Patron de Vuelo

1. Crear `src/worker/patterns/nuevoPattern.ts` extendiendo `PatternGenerator`
2. Implementar `generate()` retornando `Waypoint[]`
3. Agregar a `FlightPattern` en `types/index.ts`
4. Agregar case en `mission.worker.ts`
5. Agregar boton en `ConfigPanel.tsx`

### Nuevo Widget en Mapa

```tsx
// En MapView.tsx
import NuevoWidget from '@arcgis/core/widgets/NuevoWidget'

// En useEffect de inicializacion
const widget = new NuevoWidget({ view })
view.ui.add(widget, 'top-right')
```
