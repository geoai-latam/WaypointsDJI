# GeoFlight Planner - Documentación Técnica Completa

Sistema de planificación de vuelos fotogramétricos para drones DJI Mini 4 Pro y Mini 5 Pro. Genera misiones exportables en formato KMZ compatible con DJI Fly.

---

## Tabla de Contenidos

- [Arquitectura General](#arquitectura-general)
- [Flujo de Datos Completo](#flujo-de-datos-completo)
- [Backend (FastAPI)](#backend-fastapi)
  - [API Endpoints](#api-endpoints)
  - [Modelos de Datos](#modelos-de-datos)
  - [Calculador Fotogramétrico](#calculador-fotogramétrico)
  - [Generador WPML](#generador-wpml)
  - [Empaquetador KMZ](#empaquetador-kmz)
- [Patrones de Vuelo](#patrones-de-vuelo)
  - [Grid (Serpentín)](#1-grid-serpentín)
  - [Double Grid (Cuadrícula Doble)](#2-double-grid-cuadrícula-doble)
  - [Corridor (Corredor)](#3-corridor-corredor)
  - [Orbit (Órbita)](#4-orbit-órbita)
- [Frontend (React + TypeScript)](#frontend-react--typescript)
  - [Componentes](#componentes)
  - [Hook useMission](#hook-usemission)
  - [Servicios API](#servicios-api)
- [Parámetros Fotogramétricos](#parámetros-fotogramétricos)
- [Formato DJI WPML](#formato-dji-wpml)
- [Instalación y Configuración](#instalación-y-configuración)

---

## Arquitectura General

```mermaid
flowchart TB
    subgraph Frontend["Frontend (React + Vite)"]
        App[App.tsx]
        MapView[MapView.tsx<br/>ArcGIS 4.34]
        ConfigPanel[ConfigPanel.tsx]
        useMission[useMission Hook]
        ApiService[api.ts]
    end

    subgraph Backend["Backend (FastAPI)"]
        Main[main.py<br/>API Endpoints]
        Calculator[calculator.py<br/>PhotogrammetryCalculator]
        Models[models.py<br/>Pydantic Models]

        subgraph Patterns["Patrones de Vuelo"]
            Base[base.py]
            Grid[grid.py]
            DoubleGrid[double_grid.py]
            Corridor[corridor.py]
            Orbit[orbit.py]
        end

        WPMLBuilder[wpml_builder.py]
        KMZPackager[kmz_packager.py]
    end

    subgraph External["Sistemas Externos"]
        DJIFly[DJI Fly App]
        Drone[DJI Mini 4/5 Pro]
    end

    App --> MapView
    App --> ConfigPanel
    App --> useMission
    useMission --> ApiService
    ApiService -->|HTTP/JSON| Main

    Main --> Calculator
    Main --> Models
    Main --> Patterns
    Main --> KMZPackager

    KMZPackager --> WPMLBuilder

    Grid --> Base
    DoubleGrid --> Grid
    Corridor --> Base
    Orbit --> Base

    KMZPackager -->|KMZ File| DJIFly
    DJIFly -->|Misión| Drone
```

---

## Flujo de Datos Completo

```mermaid
sequenceDiagram
    participant U as Usuario
    participant M as MapView
    participant C as ConfigPanel
    participant H as useMission Hook
    participant API as Backend API
    participant Calc as Calculator
    participant Pat as Pattern Generator
    participant KMZ as KMZ Packager

    Note over U,KMZ: 1. INICIALIZACIÓN
    H->>API: GET /api/cameras
    API-->>H: Lista de drones soportados
    H->>H: setBackendStatus('online')

    Note over U,KMZ: 2. DIBUJO DEL POLÍGONO
    U->>M: Dibuja polígono en mapa
    M->>M: Convierte Web Mercator → WGS84
    M->>M: Calcula área geodésica
    M->>H: onPolygonComplete(coords)
    M->>H: onAreaCalculated(area_m2)

    Note over U,KMZ: 3. CÁLCULO AUTOMÁTICO DE PARÁMETROS
    H->>API: POST /api/calculate
    API->>Calc: calculate_flight_params()
    Calc->>Calc: GSD → Altitud<br/>Footprint<br/>Espaciados
    Calc-->>API: FlightParams
    API-->>H: Parámetros calculados
    H->>C: Actualiza UI

    Note over U,KMZ: 4. AJUSTE DE PARÁMETROS (OPCIONAL)
    U->>C: Modifica GSD/Overlap/Ángulo
    C->>H: updateConfig()
    H->>API: POST /api/calculate
    API-->>H: Nuevos parámetros

    Note over U,KMZ: 5. GENERACIÓN DE MISIÓN
    U->>C: Click "Generar Misión"
    C->>H: generateMission()
    H->>API: POST /api/generate-waypoints
    API->>Calc: calculate_flight_params()
    API->>Pat: generate(polygon)
    Pat->>Pat: WGS84 → UTM<br/>Genera líneas/órbitas<br/>Interpola waypoints<br/>UTM → WGS84
    Pat-->>API: Waypoints[]
    API-->>H: MissionResponse
    H->>M: Renderiza waypoints en mapa

    Note over U,KMZ: 6. DESCARGA KMZ
    U->>C: Click "Descargar KMZ"
    C->>H: downloadKmz()
    H->>API: POST /api/generate-kmz
    API->>KMZ: create_kmz()
    KMZ->>KMZ: Genera template.kml<br/>Genera waylines.wpml<br/>Comprime ZIP
    KMZ-->>API: Bytes KMZ
    API-->>H: Blob
    H->>U: Descarga archivo .kmz
```

---

## Backend (FastAPI)

### API Endpoints

```mermaid
flowchart LR
    subgraph Endpoints
        E1["GET /api/cameras"]
        E2["POST /api/calculate"]
        E3["POST /api/generate-waypoints"]
        E4["POST /api/generate-kmz"]
        E5["GET /health"]
    end

    E1 -->|"Lista drones"| R1[CameraListResponse]
    E2 -->|"Solo cálculos"| R2[FlightParams]
    E3 -->|"Waypoints"| R3[MissionResponse]
    E4 -->|"Archivo"| R4[Binary KMZ]
    E5 -->|"Estado"| R5[{"status": "healthy"}]
```

| Endpoint | Método | Descripción | Request | Response |
|----------|--------|-------------|---------|----------|
| `/api/cameras` | GET | Lista drones soportados | - | `CameraListResponse` |
| `/api/calculate` | POST | Calcula parámetros sin waypoints | `CalculateRequest` | `FlightParams` |
| `/api/generate-waypoints` | POST | Genera waypoints completos | `MissionRequest` | `MissionResponse` |
| `/api/generate-kmz` | POST | Genera y descarga KMZ | `MissionRequest` | `Binary` |
| `/health` | GET | Health check | - | `{"status": "healthy"}` |

---

### Modelos de Datos

```mermaid
classDiagram
    class DroneModel {
        <<enumeration>>
        MINI_4_PRO
        MINI_5_PRO
    }

    class FlightPattern {
        <<enumeration>>
        GRID
        DOUBLE_GRID
        CORRIDOR
        ORBIT
    }

    class CameraSpec {
        +str name
        +float sensor_width_mm
        +float sensor_height_mm
        +float focal_length_mm
        +int image_width_px
        +int image_height_px
        +int drone_enum_value
        +int payload_enum_value
    }

    class Coordinate {
        +float longitude
        +float latitude
    }

    class Waypoint {
        +int index
        +float longitude
        +float latitude
        +float altitude
        +float heading
        +float gimbal_pitch
        +float speed
        +bool take_photo
    }

    class FlightParams {
        +float altitude_m
        +float gsd_cm_px
        +float footprint_width_m
        +float footprint_height_m
        +float line_spacing_m
        +float photo_spacing_m
        +float max_speed_ms
        +float photo_interval_s
        +int estimated_photos
        +float estimated_flight_time_min
    }

    class MissionRequest {
        +PolygonArea polygon
        +DroneModel drone_model
        +FlightPattern pattern
        +float target_gsd_cm
        +float front_overlap_pct
        +float side_overlap_pct
        +float flight_angle_deg
        +bool use_48mp
        +float altitude_override_m
        +float speed_override_ms
    }

    class MissionResponse {
        +bool success
        +str message
        +FlightParams flight_params
        +list~Waypoint~ waypoints
        +list~str~ warnings
    }

    MissionRequest --> DroneModel
    MissionRequest --> FlightPattern
    MissionRequest --> Coordinate
    MissionResponse --> FlightParams
    MissionResponse --> Waypoint
```

#### Especificaciones de Cámaras

| Drone | Sensor | Focal | Resolución | Enum DJI | Intervalo |
|-------|--------|-------|------------|----------|-----------|
| Mini 4 Pro | 9.59 × 7.19 mm | 6.72 mm | 8064 × 6048 px | 68/52 | 2s (12MP), 5s (48MP) |
| Mini 5 Pro | 9.59 × 7.19 mm | 6.72 mm | 8064 × 6048 px | 91/80 | 2s (12MP), 5s (48MP) |

---

### Calculador Fotogramétrico

```mermaid
flowchart TD
    subgraph Entrada
        GSD[Target GSD<br/>cm/px]
        FO[Front Overlap %]
        SO[Side Overlap %]
        MODE[48MP Mode]
        AREA[Área m²]
    end

    subgraph Cálculos
        ALT[/"Altitud = (GSD × focal × img_width) ÷ (sensor_width × 100)"/]
        FOOT[/"Footprint = (sensor ÷ focal) × altitude"/]
        SPACING[/"Photo Spacing = footprint_h × (1 - front_overlap)"/]
        LINE[/"Line Spacing = footprint_w × (1 - side_overlap)"/]
        SPEED[/"Max Speed = photo_spacing ÷ interval"/]
    end

    subgraph Salida
        FP[FlightParams]
    end

    GSD --> ALT
    ALT --> FOOT
    FOOT --> SPACING
    FOOT --> LINE
    FO --> SPACING
    SO --> LINE
    SPACING --> SPEED
    MODE --> SPEED

    ALT --> FP
    FOOT --> FP
    SPACING --> FP
    LINE --> FP
    SPEED --> FP
```

#### Fórmulas Principales

| Parámetro | Fórmula |
|-----------|---------|
| **Altitud** | `(GSD × focal_mm × image_width_px) / (sensor_width_mm × 100)` |
| **GSD** | `(sensor_width_mm × altitude_m × 100) / (focal_mm × image_width_px)` |
| **Footprint Width** | `(sensor_width_mm / focal_mm) × altitude_m` |
| **Footprint Height** | `(sensor_height_mm / focal_mm) × altitude_m` |
| **Photo Spacing** | `footprint_height × (1 - front_overlap / 100)` |
| **Line Spacing** | `footprint_width × (1 - side_overlap / 100)` |
| **Max Speed** | `photo_spacing / photo_interval` |

#### Ejemplo de Cálculo (GSD 2 cm/px, Mini 4 Pro)

```
Altitud    = (2 × 6.72 × 8064) / (9.59 × 100) = 112.8 m
Footprint  = (9.59/6.72) × 112.8 = 161.0 m ancho × 120.7 m alto
Photo Spacing (75% overlap) = 120.7 × 0.25 = 30.2 m
Line Spacing (65% overlap)  = 161.0 × 0.35 = 56.4 m
Max Speed (12MP, 2s)        = 30.2 / 2 = 15.1 m/s
```

---

### Generador WPML

```mermaid
flowchart TB
    subgraph Input
        WP[Waypoints]
        DM[DroneModel]
        FA[FinishAction]
    end

    subgraph WPMLBuilder
        TC[build_template_kml]
        WL[build_waylines_wpml]
    end

    subgraph TemplateKML["template.kml"]
        META[Metadatos Misión]
        DRONE[droneEnumValue]
        CONFIG[flyToWaylineMode<br/>finishAction<br/>exitOnRCLost]
    end

    subgraph WaylinesWPML["waylines.wpml"]
        PLACEMARKS[Placemarks por Waypoint]
        ACTIONS[ActionGroups<br/>takePhoto<br/>gimbalRotate]
    end

    WP --> WPMLBuilder
    DM --> WPMLBuilder
    FA --> WPMLBuilder

    TC --> TemplateKML
    WL --> WaylinesWPML

    WPMLBuilder --> KMZ[KMZ Package]
```

#### Estructura del Waypoint en WPML

```xml
<Placemark>
  <Point>
    <coordinates>-74.0075,4.7110</coordinates>
  </Point>
  <wpml:index>0</wpml:index>
  <wpml:executeHeight>112.8</wpml:executeHeight>
  <wpml:waypointSpeed>10.0</wpml:waypointSpeed>
  <wpml:waypointHeadingParam>
    <wpml:waypointHeadingMode>followWaylineDirection</wpml:waypointHeadingMode>
  </wpml:waypointHeadingParam>
  <wpml:actionGroup>
    <wpml:action>
      <wpml:actionActuatorFunc>takePhoto</wpml:actionActuatorFunc>
    </wpml:action>
    <wpml:action>
      <wpml:actionActuatorFunc>gimbalRotate</wpml:actionActuatorFunc>
      <wpml:gimbalPitchRotateAngle>-90</wpml:gimbalPitchRotateAngle>
    </wpml:action>
  </wpml:actionGroup>
</Placemark>
```

---

### Empaquetador KMZ

```mermaid
flowchart LR
    subgraph Input
        WP[Waypoints]
        DM[DroneModel]
        MN[Mission Name]
    end

    subgraph Process
        BUILD[WPMLBuilder]
        ZIP[ZIP Compression]
    end

    subgraph Output
        KMZ["mission.kmz"]
    end

    subgraph KMZStructure["Estructura KMZ"]
        WPMZ["wpmz/"]
        TK["template.kml"]
        WL["waylines.wpml"]
    end

    Input --> BUILD
    BUILD --> ZIP
    ZIP --> KMZ

    KMZ --> WPMZ
    WPMZ --> TK
    WPMZ --> WL
```

---

## Patrones de Vuelo

### 1. Grid (Serpentín)

Patrón de barrido en líneas paralelas con giros alternados. Ideal para fotogrametría general de áreas.

```mermaid
flowchart TB
    subgraph GridPattern["Patrón Grid"]
        direction LR
        P1((1)) --> P2((2))
        P2 --> P3((3))
        P3 --> P4((4))
        P4 --> P5((5))
        P5 --> P6((6))
        P6 --> P7((7))
        P7 --> P8((8))
        P8 --> P9((9))
    end

    style P1 fill:#22C55E
    style P9 fill:#EF4444
```

```
   ┌─────────────────────────────────┐
   │  1 ──→ 2 ──→ 3 ──→ 4 ──→ 5    │  Línea 1 →
   │                          │      │
   │                          ↓      │
   │  10 ←── 9 ←── 8 ←── 7 ←── 6    │  Línea 2 ←
   │   │                             │
   │   ↓                             │
   │  11 ──→ 12 ──→ 13 ──→ 14 ──→ 15│  Línea 3 →
   └─────────────────────────────────┘
```

**Algoritmo:**
1. Convierte polígono WGS84 → UTM
2. Aplica buffer (15%) para extender líneas
3. Genera líneas paralelas separadas por `line_spacing`
4. Rota líneas según `flight_angle`
5. Recorta al polígono
6. Alterna dirección (serpentín)
7. Interpola waypoints cada `photo_spacing`

**Parámetros:**
- `buffer_percent`: 15% (extensión del área)
- `flight_angle_deg`: 0-359° (dirección de vuelo)

---

### 2. Double Grid (Cuadrícula Doble)

Dos pasadas perpendiculares para mejor reconstrucción 3D.

```mermaid
flowchart TB
    subgraph Pass1["Primera Pasada (0°)"]
        A1[1] --> A2[2] --> A3[3]
        A4[6] --> A5[5] --> A6[4]
        A3 --> A6
    end

    subgraph Pass2["Segunda Pasada (90°)"]
        B1[7] --> B2[8]
        B3[10] --> B4[9]
        B2 --> B4
        B5[11] --> B6[12]
        B4 --> B6
    end

    Pass1 --> Pass2
```

```
   Primera Pasada (0°)           Segunda Pasada (90°)
   ┌──────────────────┐          ┌──────────────────┐
   │  →  →  →  →  →   │          │  ↓     ↓     ↓   │
   │  ←  ←  ←  ←  ←   │    +     │  ↓     ↓     ↓   │
   │  →  →  →  →  →   │          │  ↓     ↓     ↓   │
   └──────────────────┘          └──────────────────┘
```

**Ventajas:**
- Cobertura en dos direcciones
- Mejor texturizado 3D
- ~2× waypoints que grid simple

---

### 3. Corridor (Corredor)

Líneas paralelas siguiendo una característica lineal (carreteras, ríos, tuberías).

```mermaid
flowchart TB
    subgraph CorridorPattern["Patrón Corridor (3 líneas)"]
        direction LR

        subgraph Line1["Línea Izquierda"]
            L1((1)) --> L2((2)) --> L3((3))
        end

        subgraph Line2["Línea Central"]
            C3((6)) --> C2((5)) --> C1((4))
        end

        subgraph Line3["Línea Derecha"]
            R1((7)) --> R2((8)) --> R3((9))
        end

        L3 --> C3
        C1 --> R1
    end

    style L1 fill:#22C55E
    style R3 fill:#EF4444
```

```
          Corredor de 3 líneas
   ┌─────────────────────────────────┐
   │   ← ← ← ← ← ← ← Línea Izq      │
   │                                 │
   │   → → → → → → → Línea Central  │
   │                                 │
   │   ← ← ← ← ← ← ← Línea Der      │
   └─────────────────────────────────┘
```

**Modos de entrada:**
1. **Desde polígono:** Extrae línea central del rectángulo mínimo
2. **Desde centerline:** Usa línea central explícita + ancho

**Parámetros:**
- `num_lines`: 1-5 líneas paralelas
- `corridor_width_m`: Ancho del corredor

---

### 4. Orbit (Órbita)

Círculos concéntricos alrededor de una estructura. Ideal para torres, edificios, monumentos.

```mermaid
flowchart TB
    subgraph OrbitPattern["Patrón Orbit"]
        subgraph Orbit1["Órbita 1 (113m, -45°)"]
            O1((1)) --> O2((2)) --> O3((3)) --> O4((4))
            O4 --> O5((5)) --> O6((6)) --> O7((7)) --> O8((8))
            O8 --> O1
        end

        subgraph Orbit2["Órbita 2 (123m, -35°)"]
            P1((9)) --> P2((10)) --> P3((11)) --> P4((12))
        end

        O8 --> P1
    end

    CENTER[("🏛️<br/>Centro")]

    style CENTER fill:#F97316
    style O1 fill:#22C55E
```

```
            Vista Superior
        ┌─────────────────────┐
        │     . . . . .       │
        │   .    ___    .     │
        │  .   /     \   .    │
        │ .   |   X   |   .   │  X = Centro
        │  .   \ ___ /   .    │      (estructura)
        │   .           .     │
        │     . . . . .       │
        └─────────────────────┘

        Vista Lateral (3 órbitas)
        ┌─────────────────────┐
        │  Órbita 3 ──────────│  133m, pitch -25°
        │  Órbita 2 ──────────│  123m, pitch -35°
        │  Órbita 1 ──────────│  113m, pitch -45°
        │        ▲            │
        │        │            │
        │    [Estructura]     │
        └─────────────────────┘
```

**Parámetros:**
- `num_orbits`: 1-5 órbitas concéntricas
- `photos_per_orbit`: 24 (default = 15° entre fotos)
- `altitude_step_m`: 10m incremento entre órbitas
- `start_gimbal_pitch`: -45° inicial
- Gimbal aumenta 10° por órbita

**Cálculo de posición:**
```
x = center_x + radius × sin(angle)
y = center_y + radius × cos(angle)
heading = (angle + 180) % 360  // Apunta al centro
```

---

## Diagrama de Patrones Comparativo

```mermaid
flowchart TB
    subgraph Patterns["Patrones de Vuelo"]
        GRID["🔲 Grid<br/>Áreas generales<br/>Terreno plano"]
        DGRID["🔳 Double Grid<br/>Modelos 3D<br/>Alta precisión"]
        CORR["═ Corridor<br/>Carreteras/Ríos<br/>Lineas de transmisión"]
        ORB["◎ Orbit<br/>Estructuras<br/>Torres/Edificios"]
    end

    subgraph UseCase["Caso de Uso"]
        UC1["Agricultura<br/>Topografía"]
        UC2["Fotogrametría 3D<br/>Reconstrucción"]
        UC3["Infraestructura<br/>Inspección lineal"]
        UC4["Inspección<br/>Vertical"]
    end

    GRID --> UC1
    DGRID --> UC2
    CORR --> UC3
    ORB --> UC4
```

---

## Frontend (React + TypeScript)

### Componentes

```mermaid
flowchart TB
    subgraph App["App.tsx"]
        HEADER[Header]
        MAIN[Main Container]
        ERROR[Error Toast]
    end

    subgraph MapSection["Map Section"]
        MAPVIEW[MapView.tsx]
        SKETCH[Sketch Widget]
        BASEMAP[BasemapGallery]
        LOCATE[Locate Widget]
        HOME[Home Widget]
        SCALE[ScaleBar]
    end

    subgraph Sidebar["Sidebar"]
        CONFIG[ConfigPanel.tsx]
        SUMMARY[Summary Card]
        BASIC[Basic Config]
        ADVANCED[Advanced Options]
        ACTIONS[Action Buttons]
    end

    subgraph Hooks["Hooks"]
        MISSION[useMission.ts]
    end

    App --> HEADER
    App --> MAIN
    App --> ERROR

    MAIN --> MAPVIEW
    MAIN --> CONFIG

    MAPVIEW --> SKETCH
    MAPVIEW --> BASEMAP
    MAPVIEW --> LOCATE
    MAPVIEW --> HOME
    MAPVIEW --> SCALE

    CONFIG --> SUMMARY
    CONFIG --> BASIC
    CONFIG --> ADVANCED
    CONFIG --> ACTIONS

    App --> MISSION
    MAPVIEW -.-> MISSION
    CONFIG -.-> MISSION
```

### Estados del Hook useMission

```mermaid
stateDiagram-v2
    [*] --> Checking: App Mount
    Checking --> Online: Backend OK
    Checking --> Offline: Backend Error

    Offline --> Checking: Retry (10s)

    Online --> DrawingPolygon: Usuario dibuja
    DrawingPolygon --> PolygonReady: Polígono completo

    PolygonReady --> Calculating: Auto-cálculo
    Calculating --> ConfigReady: Parámetros listos

    ConfigReady --> Generating: Click "Generar"
    Generating --> MissionReady: Waypoints generados

    MissionReady --> Downloading: Click "Descargar"
    Downloading --> MissionReady: KMZ descargado

    ConfigReady --> Calculating: Config cambia
    MissionReady --> Calculating: Config cambia
```

### Flujo de Estado

```mermaid
flowchart TB
    subgraph State["Estado Central (useMission)"]
        CONFIG[config: MissionConfig]
        PARAMS[flightParams: FlightParams]
        WP[waypoints: Waypoint[]]
        POLY[polygonCoords: Coordinate[]]
        AREA[areaSqM: number]
        STATUS[backendStatus]
        ERRORS[validationErrors]
    end

    subgraph Effects["Effects Automáticos"]
        E1["Effect: Health Check"]
        E2["Effect: Validación"]
        E3["Effect: Auto-cálculo"]
    end

    subgraph Actions["Acciones Usuario"]
        A1[updateConfig]
        A2[generateMission]
        A3[downloadKmz]
    end

    E1 -->|mount| STATUS
    E2 -->|config change| ERRORS
    E3 -->|params change| PARAMS

    A1 -->|actualiza| CONFIG
    A1 -->|limpia| WP

    A2 -->|genera| WP
    A2 -->|actualiza| PARAMS

    A3 -->|descarga| KMZ[Archivo KMZ]
```

---

### Servicios API

```mermaid
flowchart LR
    subgraph Frontend
        HOOK[useMission]
        API[api.ts]
    end

    subgraph Backend
        EP1["/api/cameras"]
        EP2["/api/calculate"]
        EP3["/api/generate-waypoints"]
        EP4["/api/generate-kmz"]
    end

    HOOK --> API
    API -->|GET| EP1
    API -->|POST| EP2
    API -->|POST| EP3
    API -->|POST| EP4

    EP1 -->|JSON| API
    EP2 -->|JSON| API
    EP3 -->|JSON| API
    EP4 -->|Blob| API
```

---

## Parámetros Fotogramétricos

### Relaciones entre Parámetros

```mermaid
flowchart TD
    GSD[GSD Objetivo<br/>cm/px] --> ALT[Altitud<br/>metros]
    ALT --> FOOT[Footprint<br/>ancho × alto]

    FOOT --> PS[Photo Spacing]
    FOOT --> LS[Line Spacing]

    FO[Front Overlap %] --> PS
    SO[Side Overlap %] --> LS

    PS --> SPEED[Max Speed<br/>m/s]
    MODE[48MP Mode] --> INT[Photo Interval<br/>2s / 5s]
    INT --> SPEED

    subgraph Override["Overrides Manuales"]
        ALT_O[Altitude Override] -.->|recalcula| GSD_R[GSD Real]
        SPEED_O[Speed Override] -.->|cap max| SPEED
    end

    ALT_O --> ALT

    style Override fill:#1a2332
```

### Tabla de Parámetros

| Parámetro | Rango | Default | Descripción |
|-----------|-------|---------|-------------|
| **GSD** | 0.5 - 5.0 cm/px | 2.0 | Resolución del terreno |
| **Front Overlap** | 50 - 90% | 75% | Solapamiento entre fotos consecutivas |
| **Side Overlap** | 50 - 90% | 65% | Solapamiento entre líneas |
| **Flight Angle** | 0 - 359° | 0° | Dirección del patrón (N=0°) |
| **48MP Mode** | on/off | off | Modo alta resolución (intervalo 5s) |
| **Altitude Override** | 20 - 120 m | - | Altitud manual (recalcula GSD) |
| **Speed Override** | 1 - 15 m/s | - | Velocidad manual (cap por intervalo) |
| **Gimbal Pitch** | -90° a 0° | -90° | Ángulo de cámara (nadir a horizonte) |

---

## Formato DJI WPML

### Estructura del Archivo KMZ

```mermaid
flowchart TB
    KMZ["mission.kmz<br/>(ZIP)"]

    subgraph WPMZ["wpmz/"]
        TEMPLATE["template.kml"]
        WAYLINES["waylines.wpml"]
    end

    KMZ --> WPMZ
    WPMZ --> TEMPLATE
    WPMZ --> WAYLINES

    subgraph TemplateContent["template.kml"]
        T1[author: GeoFlight Planner]
        T2[createTime/updateTime]
        T3[flyToWaylineMode: safely]
        T4[finishAction: goHome]
        T5[droneEnumValue: 68/91]
    end

    subgraph WaylinesContent["waylines.wpml"]
        W1[executeHeightMode: relativeToStartPoint]
        W2[Placemark por waypoint]
        W3[ActionGroups]
    end

    TEMPLATE --> TemplateContent
    WAYLINES --> WaylinesContent
```

### Acciones por Waypoint

```mermaid
flowchart LR
    subgraph FirstWP["Primer Waypoint"]
        F1[takePhoto]
        F2[gimbalRotate -90°]
        F3[gimbalEvenlyRotate]
    end

    subgraph MiddleWP["Waypoints Intermedios"]
        M1[takePhoto]
        M2[gimbalEvenlyRotate]
    end

    subgraph LastWP["Último Waypoint"]
        L1[takePhoto]
    end

    FirstWP -->|siguiente| MiddleWP
    MiddleWP -->|...| MiddleWP
    MiddleWP -->|final| LastWP
```

---

## Instalación y Configuración

### Requisitos

```mermaid
flowchart LR
    subgraph Backend
        PY[Python 3.10+]
        FAST[FastAPI]
        PROJ[pyproj]
        SHAP[Shapely]
    end

    subgraph Frontend
        NODE[Node.js 18+]
        REACT[React 18]
        VITE[Vite 5]
        ARC[ArcGIS JS 4.34]
    end

    subgraph Deploy
        UVICORN[Uvicorn]
        NGINX[Nginx/Proxy]
    end
```

### Comandos

**Backend:**
```bash
cd geoflight/backend
python -m venv venv
venv\Scripts\activate          # Windows
pip install -r requirements.txt
uvicorn app.main:app --reload  # http://localhost:8000
```

**Frontend:**
```bash
cd geoflight/frontend
npm install
npm run dev                    # http://localhost:5173
```

### Variables de Entorno

| Variable | Default | Descripción |
|----------|---------|-------------|
| `DEBUG` | true | Modo debug |
| `CORS_ORIGINS` | localhost:5173 | Orígenes permitidos |

---

## Límites y Restricciones

| Restricción | Valor | Nota |
|-------------|-------|------|
| Max waypoints | **99** | Límite DJI Fly |
| GSD mínimo | 0.5 cm/px | Alta resolución |
| GSD máximo | 5.0 cm/px | Baja resolución |
| Overlaps | 50-90% | Rango válido |
| Intervalo 12MP | 2.0 s | Fijo |
| Intervalo 48MP | 5.0 s | Fijo |
| Altitud recomendada | ≤ 120 m | Regulaciones |

---

## Licencia

MIT License

---

*Documentación generada automáticamente - GeoFlight Planner v1.0.0*
