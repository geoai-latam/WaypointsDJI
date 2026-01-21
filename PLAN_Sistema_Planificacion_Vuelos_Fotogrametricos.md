# 🛩️ Plan de Desarrollo: Sistema de Planificación de Vuelos Fotogramétricos

## Sistema de Generación de KMZ para Levantamiento Topográfico con Drones DJI

---

## 📋 Resumen Ejecutivo

Este documento define la arquitectura y fases de desarrollo para un sistema que genere archivos KMZ compatibles con DJI Fly, específicamente optimizado para misiones de levantamiento topográfico y fotogrametría con drones DJI Mini 4 Pro y Mini 5 Pro.

---

## 🎯 Objetivos del Sistema

1. Calcular parámetros de vuelo basados en especificaciones técnicas de la cámara
2. Generar patrones de vuelo optimizados para fotogrametría
3. Exportar archivos KMZ compatibles con el formato WPML de DJI
4. Permitir configuración completa de todos los parámetros relevantes

---

## 📊 MÓDULO 1: Parámetros de Entrada

### 1.1 Especificaciones de Cámara (Presets)

```yaml
# DJI Mini 4 Pro
mini4pro:
  sensor_width_mm: 9.59
  sensor_height_mm: 7.19
  focal_length_mm: 6.72
  image_width_px: 8064    # 48MP mode
  image_height_px: 6048
  image_width_12mp: 4032  # 12MP mode
  image_height_12mp: 3024
  min_interval_48mp: 5    # segundos
  min_interval_12mp: 2    # segundos
  aperture: 1.7
  fov_diagonal: 82.1      # grados
  droneEnumValue: 68
  droneSubEnumValue: 0
  max_speed_ms: 16        # m/s modo Sport

# DJI Mini 5 Pro
mini5pro:
  sensor_width_mm: 12.8   # 1" sensor (estimado)
  sensor_height_mm: 9.6
  focal_length_mm: 8.8    # estimado para 24mm equiv
  image_width_px: 8192    # 50MP mode
  image_height_px: 6144
  min_interval_50mp: 5
  min_interval_12mp: 2
  aperture: 1.8
  fov_diagonal: 82.1
  droneEnumValue: 68      # probablemente mismo que Mini 4
  droneSubEnumValue: 0
  max_speed_ms: 16
```

### 1.2 Parámetros de Calidad/GSD

| Parámetro | Descripción | Tipo | Rango | Default |
|-----------|-------------|------|-------|---------|
| `target_gsd_cm` | GSD objetivo (cm/pixel) | float | 0.5 - 10 | 2.0 |
| `overlap_frontal_pct` | Overlap frontal (%) | int | 60 - 90 | 80 |
| `overlap_lateral_pct` | Overlap lateral (%) | int | 50 - 85 | 70 |
| `photo_mode` | Modo de foto | enum | 12MP, 48MP, 50MP | 48MP |

### 1.3 Parámetros de Patrón de Vuelo

| Parámetro | Descripción | Tipo | Valores | Default |
|-----------|-------------|------|---------|---------|
| `flight_pattern` | Tipo de patrón | enum | `grid`, `double_grid`, `corridor`, `circular` | grid |
| `flight_angle_deg` | Ángulo de vuelo (azimut) | float | 0 - 360 | 0 (N-S) |
| `start_corner` | Esquina de inicio | enum | `NW`, `NE`, `SW`, `SE` | SW |
| `direction` | Dirección de avance | enum | `normal`, `reverse` | normal |
| `alternating_direction` | Líneas en serpentín | bool | true/false | true |

### 1.4 Parámetros de Cámara/Gimbal

| Parámetro | Descripción | Tipo | Rango | Default |
|-----------|-------------|------|-------|---------|
| `gimbal_pitch_deg` | Ángulo pitch del gimbal | float | -90 a 30 | -90 (nadir) |
| `gimbal_pitch_oblique` | Pitch para doble grid oblicuo | float | -45 a -70 | -45 |
| `camera_trigger_mode` | Modo de disparo | enum | `at_waypoint`, `timed`, `distance` | at_waypoint |
| `photo_interval_s` | Intervalo de tiempo (si timed) | float | 2 - 60 | 3 |
| `photo_distance_m` | Intervalo de distancia (si distance) | float | 5 - 100 | - |

### 1.5 Parámetros de Vuelo

| Parámetro | Descripción | Tipo | Rango | Default |
|-----------|-------------|------|-------|---------|
| `flight_height_m` | Altura de vuelo (m) | float | 10 - 500 | calculado |
| `flight_speed_ms` | Velocidad de vuelo (m/s) | float | 1 - 15 | calculado |
| `takeoff_height_m` | Altura segura despegue | float | 10 - 50 | 20 |
| `rth_height_m` | Altura RTH | float | 30 - 120 | 50 |

### 1.6 Parámetros de Misión

| Parámetro | Descripción | Tipo | Valores | Default |
|-----------|-------------|------|---------|---------|
| `finish_action` | Acción al terminar | enum | `goHome`, `hover`, `land`, `gotoFirstWaypoint` | goHome |
| `rc_lost_action` | Acción si pierde señal | enum | `goBack`, `hover`, `land`, `continue` | hover |
| `fly_to_first_mode` | Modo vuelo a primer WP | enum | `safely`, `pointToPoint` | safely |
| `height_mode` | Referencia de altura | enum | `relativeToStartPoint`, `WGS84`, `AGL` | relativeToStartPoint |

### 1.7 Área de Vuelo (Polígono)

```yaml
area_definition:
  type: "polygon"  # o "rectangle"
  coordinates:     # Lista de [lon, lat]
    - [-72.9490, 5.9560]
    - [-72.9480, 5.9560]
    - [-72.9480, 5.9575]
    - [-72.9490, 5.9575]
  
  # O definir como rectángulo
  rectangle:
    center: [-72.9485, 5.9567]
    width_m: 100
    height_m: 150
    rotation_deg: 0
```

---

## 📐 MÓDULO 2: Motor de Cálculos Fotogramétricos

### 2.1 Fórmulas Fundamentales

```python
# ============================================
# CÁLCULOS DE GSD Y FOOTPRINT
# ============================================

def calculate_gsd(height_m, sensor_width_mm, focal_length_mm, image_width_px):
    """
    Calcula el Ground Sampling Distance (GSD)
    
    GSD = (Altura × Ancho_Sensor) / (Focal × Ancho_Imagen)
    
    Returns: GSD en cm/pixel
    """
    gsd_m = (height_m * sensor_width_mm) / (focal_length_mm * image_width_px)
    return gsd_m * 100  # convertir a cm

def calculate_height_for_gsd(target_gsd_cm, sensor_width_mm, focal_length_mm, image_width_px):
    """
    Calcula la altura necesaria para un GSD objetivo
    
    Altura = (GSD × Focal × Ancho_Imagen) / Ancho_Sensor
    """
    gsd_m = target_gsd_cm / 100
    height_m = (gsd_m * focal_length_mm * image_width_px) / sensor_width_mm
    return height_m

def calculate_footprint(height_m, sensor_width_mm, sensor_height_mm, focal_length_mm):
    """
    Calcula el footprint (cobertura en tierra) de una imagen
    
    Returns: (width_m, height_m) - dimensiones de la imagen en tierra
    """
    footprint_width = (height_m * sensor_width_mm) / focal_length_mm
    footprint_height = (height_m * sensor_height_mm) / focal_length_mm
    return footprint_width, footprint_height

# ============================================
# CÁLCULOS DE ESPACIADO
# ============================================

def calculate_line_spacing(footprint_width_m, overlap_lateral_pct):
    """
    Calcula la distancia entre líneas de vuelo (lateral)
    
    Distancia = Footprint_W × (1 - Overlap%)
    """
    return footprint_width_m * (1 - overlap_lateral_pct / 100)

def calculate_photo_spacing(footprint_height_m, overlap_frontal_pct):
    """
    Calcula la distancia entre fotos (frontal)
    
    Distancia = Footprint_H × (1 - Overlap%)
    """
    return footprint_height_m * (1 - overlap_frontal_pct / 100)

# ============================================
# CÁLCULOS DE VELOCIDAD Y TIEMPO
# ============================================

def calculate_max_speed(photo_spacing_m, min_interval_s):
    """
    Calcula la velocidad máxima para mantener el overlap
    
    Velocidad = Distancia_entre_fotos / Intervalo_mínimo
    """
    return photo_spacing_m / min_interval_s

def calculate_photo_interval(photo_spacing_m, flight_speed_ms):
    """
    Calcula el intervalo de fotos necesario para una velocidad dada
    
    Intervalo = Distancia / Velocidad
    """
    return photo_spacing_m / flight_speed_ms

def estimate_flight_time(total_distance_m, flight_speed_ms, num_waypoints, time_per_wp_s=2):
    """
    Estima el tiempo total de vuelo
    """
    flight_time = total_distance_m / flight_speed_ms
    wp_time = num_waypoints * time_per_wp_s
    return flight_time + wp_time

def estimate_photo_count(num_lines, photos_per_line):
    """
    Estima el número total de fotos
    """
    return num_lines * photos_per_line
```

### 2.2 Tabla de Referencia Rápida

| GSD (cm/px) | Altura Mini 4 Pro (m) | Altura Mini 5 Pro (m) | Uso Típico |
|-------------|----------------------|----------------------|------------|
| 0.5 | 20 | 17 | Ultra detalle, grietas |
| 1.0 | 40 | 34 | Alta precisión |
| 1.5 | 60 | 51 | Levantamiento estándar |
| 2.0 | 80 | 68 | Topografía general |
| 2.5 | 100 | 85 | Áreas grandes |
| 3.0 | 120 | 102 | Reconocimiento |
| 5.0 | 200 | 170 | Vista general |

---

## 🗺️ MÓDULO 3: Generador de Patrones de Vuelo

### 3.1 Patrón Grid Simple (Nadir)

```
Configuración estándar para ortofotomosaico:
- Líneas paralelas en dirección configurada
- Gimbal a -90° (nadir)
- Overlap típico: 80% frontal, 70% lateral

    ←────────────────
    ────────────────→
    ←────────────────
    ────────────────→

Parámetros específicos:
- flight_angle_deg: 0-360 (0=N-S, 90=E-O)
- alternating_direction: true (serpentín)
```

### 3.2 Patrón Double Grid (Cruzado)

```
Para modelos 3D y mejor precisión vertical:
- Dos pasadas perpendiculares
- Primera pasada: ángulo X
- Segunda pasada: ángulo X+90

Primera pasada (0°):     Segunda pasada (90°):
    ←────────────             ↑ ↓ ↑ ↓
    ────────────→             ↑ ↓ ↑ ↓
    ←────────────             ↑ ↓ ↑ ↓
    ────────────→             ↑ ↓ ↑ ↓

Parámetros específicos:
- second_pass_angle: flight_angle + 90
- same_height: true/false (misma altura para ambas)
```

### 3.3 Patrón Oblicuo (para 3D)

```
Para reconstrucción 3D de edificios/terreno:
- Pasada nadir (-90°)
- 4 pasadas oblicuas (-45° a -60°) en 4 direcciones

        ↗ (NE oblicuo)
         \
    ←─────────────────  (Nadir)
         /
        ↙ (SW oblicuo)

Parámetros específicos:
- oblique_angle: -45 a -60
- include_nadir: true
- oblique_directions: [0, 90, 180, 270] o [45, 135, 225, 315]
```

### 3.4 Patrón Corredor (Linear)

```
Para carreteras, ríos, líneas de transmisión:
- Línea central con buffer
- 1-3 líneas paralelas

    ────────────────────────────→
    ────────────────────────────→
    ────────────────────────────→

Parámetros específicos:
- corridor_width_m: ancho del corredor
- num_lines: 1-5
- follow_terrain: true/false
```

### 3.5 Patrón Circular/Órbita (POI)

```
Para objetos verticales (torres, edificios):
- Órbitas concéntricas a diferentes alturas
- Cámara apuntando al centro

         ___
        /   \
       |  *  |  ← POI
        \___/

Parámetros específicos:
- poi_lat, poi_lon: punto de interés
- orbit_radius_m: radio de órbita
- orbit_heights: [30, 50, 70] metros
- photos_per_orbit: 36 (cada 10°)
```

---

## 🔧 MÓDULO 4: Generador de KMZ

### 4.1 Estructura de Salida

```
output_mission.kmz
├── wpmz/
│   ├── template.kml
│   └── waylines.wpml
```

### 4.2 Mapeo de Parámetros a WPML

| Parámetro del Sistema | Elemento WPML |
|----------------------|---------------|
| `flight_speed_ms` | `wpml:waypointSpeed`, `wpml:autoFlightSpeed` |
| `flight_height_m` | `wpml:executeHeight` |
| `gimbal_pitch_deg` | `wpml:gimbalPitchRotateAngle` |
| `finish_action` | `wpml:finishAction` |
| `rc_lost_action` | `wpml:executeRCLostAction` |
| `height_mode` | `wpml:executeHeightMode` |
| `takeoff_height_m` | `wpml:takeOffSecurityHeight` |
| `heading_mode` | `wpml:waypointHeadingMode` |
| `turn_mode` | `wpml:waypointTurnMode` |

### 4.3 Generación de Acciones

```xml
<!-- Para cada waypoint con captura de foto -->
<wpml:actionGroup>
  <wpml:actionGroupId>{id}</wpml:actionGroupId>
  <wpml:actionGroupStartIndex>{wp_index}</wpml:actionGroupStartIndex>
  <wpml:actionGroupEndIndex>{wp_index}</wpml:actionGroupEndIndex>
  <wpml:actionGroupMode>sequence</wpml:actionGroupMode>
  <wpml:actionTrigger>
    <wpml:actionTriggerType>reachPoint</wpml:actionTriggerType>
  </wpml:actionTrigger>
  
  <!-- Acción 1: Posicionar gimbal -->
  <wpml:action>
    <wpml:actionId>{action_id}</wpml:actionId>
    <wpml:actionActuatorFunc>gimbalRotate</wpml:actionActuatorFunc>
    <wpml:actionActuatorFuncParam>
      <wpml:gimbalHeadingYawBase>aircraft</wpml:gimbalHeadingYawBase>
      <wpml:gimbalRotateMode>absoluteAngle</wpml:gimbalRotateMode>
      <wpml:gimbalPitchRotateEnable>1</wpml:gimbalPitchRotateEnable>
      <wpml:gimbalPitchRotateAngle>{gimbal_pitch}</wpml:gimbalPitchRotateAngle>
      <wpml:payloadPositionIndex>0</wpml:payloadPositionIndex>
    </wpml:actionActuatorFuncParam>
  </wpml:action>
  
  <!-- Acción 2: Tomar foto (si camera_trigger_mode == at_waypoint) -->
  <wpml:action>
    <wpml:actionId>{action_id+1}</wpml:actionId>
    <wpml:actionActuatorFunc>takePhoto</wpml:actionActuatorFunc>
    <wpml:actionActuatorFuncParam>
      <wpml:payloadPositionIndex>0</wpml:payloadPositionIndex>
    </wpml:actionActuatorFuncParam>
  </wpml:action>
</wpml:actionGroup>
```

---

## 📅 FASES DE DESARROLLO

### FASE 1: Core Engine (Semana 1-2)
**Objetivo:** Implementar cálculos matemáticos fundamentales

```
□ 1.1 Definir estructuras de datos para parámetros de entrada
□ 1.2 Implementar cálculos de GSD/altura/footprint
□ 1.3 Implementar cálculos de espaciado (líneas y fotos)
□ 1.4 Implementar cálculos de velocidad y tiempo
□ 1.5 Crear presets de cámaras (Mini 4 Pro, Mini 5 Pro)
□ 1.6 Unit tests para todas las fórmulas
```

**Entregables:**
- Módulo `photogrammetry_calculator.py`
- Tests unitarios
- Documentación de fórmulas

---

### FASE 2: Generador de Patrones (Semana 3-4)
**Objetivo:** Generar waypoints para diferentes patrones de vuelo

```
□ 2.1 Implementar transformación de coordenadas (rotación por azimut)
□ 2.2 Generador de patrón Grid simple
□ 2.3 Generador de patrón Double Grid
□ 2.4 Generador de patrón Corredor
□ 2.5 Generador de patrón Circular/Órbita
□ 2.6 Soporte para polígonos arbitrarios (clipping)
□ 2.7 Optimización de ruta (minimizar distancia/tiempo)
```

**Entregables:**
- Módulo `flight_pattern_generator.py`
- Soporte para GeoJSON como entrada
- Visualización preliminar (matplotlib/folium)

---

### FASE 3: Generador de WPML/KMZ (Semana 5-6)
**Objetivo:** Generar archivos KMZ válidos para DJI Fly

```
□ 3.1 Template XML para template.kml
□ 3.2 Template XML para waylines.wpml
□ 3.3 Generador de elementos Placemark (waypoints)
□ 3.4 Generador de actionGroups (acciones en waypoints)
□ 3.5 Empaquetador KMZ (ZIP con estructura correcta)
□ 3.6 Validador de estructura WPML
□ 3.7 Tests con DJI Fly (importación real)
```

**Entregables:**
- Módulo `wpml_generator.py`
- Módulo `kmz_packager.py`
- Archivos KMZ de prueba validados

---

### FASE 4: Interfaz de Usuario (Semana 7-8)
**Objetivo:** Crear interfaz para configurar y generar misiones

```
□ 4.1 CLI básica con argparse
□ 4.2 Archivo de configuración YAML/JSON
□ 4.3 Interfaz web con Streamlit o Gradio
□ 4.4 Mapa interactivo para definir área (Folium/Leaflet)
□ 4.5 Preview de ruta antes de generar
□ 4.6 Exportación de estadísticas de misión
□ 4.7 Integración con ArcGIS (opcional para ti)
```

**Entregables:**
- CLI funcional
- Web app básica
- Documentación de uso

---

### FASE 5: Optimización y Features Avanzados (Semana 9-10)
**Objetivo:** Funcionalidades avanzadas y optimización

```
□ 5.1 Terrain following (AGL con DEM)
□ 5.2 Optimización de baterías (dividir misión)
□ 5.3 Zonas de exclusión (no-fly zones)
□ 5.4 Cálculo automático de número de baterías
□ 5.5 Exportación a otros formatos (Litchi CSV, etc.)
□ 5.6 Importación de misiones existentes
□ 5.7 Templates predefinidos por tipo de proyecto
```

**Entregables:**
- Módulo `terrain_following.py`
- Módulo `mission_optimizer.py`
- Templates de proyecto

---

## 🗂️ Estructura del Proyecto

```
geoai_flight_planner/
├── src/
│   ├── __init__.py
│   ├── core/
│   │   ├── __init__.py
│   │   ├── camera_specs.py        # Specs de cámaras
│   │   ├── calculations.py        # Cálculos fotogramétricos
│   │   └── coordinate_utils.py    # Transformaciones geográficas
│   ├── patterns/
│   │   ├── __init__.py
│   │   ├── base_pattern.py        # Clase base
│   │   ├── grid_pattern.py        # Patrón grid
│   │   ├── double_grid.py         # Patrón doble grid
│   │   ├── corridor_pattern.py    # Patrón corredor
│   │   └── orbit_pattern.py       # Patrón circular
│   ├── wpml/
│   │   ├── __init__.py
│   │   ├── elements.py            # Elementos WPML
│   │   ├── actions.py             # Acciones (takePhoto, gimbalRotate)
│   │   ├── generator.py           # Generador de XML
│   │   └── packager.py            # Empaquetador KMZ
│   └── interface/
│       ├── __init__.py
│       ├── cli.py                 # Interfaz CLI
│       └── web_app.py             # Interfaz web
├── config/
│   ├── cameras.yaml               # Presets de cámaras
│   └── defaults.yaml              # Valores por defecto
├── templates/
│   ├── template.kml.j2            # Template Jinja2
│   └── waylines.wpml.j2           # Template Jinja2
├── tests/
│   ├── test_calculations.py
│   ├── test_patterns.py
│   └── test_wpml.py
├── examples/
│   ├── simple_grid.yaml           # Ejemplo de config
│   └── output/                    # KMZ generados
├── docs/
│   ├── formulas.md
│   ├── wpml_reference.md
│   └── user_guide.md
├── requirements.txt
├── setup.py
└── README.md
```

---

## 📊 Diagrama de Flujo del Sistema

```
┌─────────────────────────────────────────────────────────────────┐
│                      ENTRADA DE USUARIO                         │
├─────────────────────────────────────────────────────────────────┤
│  • Área (polígono/rectángulo)                                   │
│  • GSD deseado o Altura                                         │
│  • Overlap (frontal/lateral)                                    │
│  • Patrón de vuelo                                              │
│  • Ángulo de vuelo                                              │
│  • Configuración de cámara/gimbal                               │
│  • Parámetros de misión                                         │
└───────────────────────────┬─────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│                    MOTOR DE CÁLCULOS                            │
├─────────────────────────────────────────────────────────────────┤
│  1. Calcular altura de vuelo (si se dio GSD)                    │
│  2. Calcular GSD real (si se dio altura)                        │
│  3. Calcular footprint de imagen                                │
│  4. Calcular espaciado entre líneas                             │
│  5. Calcular espaciado entre fotos                              │
│  6. Calcular velocidad máxima                                   │
│  7. Calcular intervalo de fotos                                 │
└───────────────────────────┬─────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│                  GENERADOR DE PATRONES                          │
├─────────────────────────────────────────────────────────────────┤
│  1. Obtener bounding box del área                               │
│  2. Rotar según ángulo de vuelo                                 │
│  3. Generar líneas de vuelo                                     │
│  4. Generar waypoints en cada línea                             │
│  5. Aplicar clipping al polígono original                       │
│  6. Optimizar orden de waypoints                                │
│  7. Asignar acciones a cada waypoint                            │
└───────────────────────────┬─────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│                    GENERADOR WPML                               │
├─────────────────────────────────────────────────────────────────┤
│  1. Crear estructura template.kml                               │
│  2. Crear estructura waylines.wpml                              │
│  3. Generar missionConfig                                       │
│  4. Generar Folder con waylineId                                │
│  5. Generar Placemarks (waypoints)                              │
│  6. Generar actionGroups para cada waypoint                     │
│  7. Validar estructura XML                                      │
└───────────────────────────┬─────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│                    EMPAQUETADOR KMZ                             │
├─────────────────────────────────────────────────────────────────┤
│  1. Crear directorio temporal wpmz/                             │
│  2. Guardar template.kml                                        │
│  3. Guardar waylines.wpml                                       │
│  4. Comprimir en archivo .kmz (ZIP)                             │
│  5. Generar reporte de misión                                   │
└───────────────────────────┬─────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│                         SALIDA                                  │
├─────────────────────────────────────────────────────────────────┤
│  • mission_YYYYMMDD_HHMMSS.kmz                                  │
│  • mission_report.json (estadísticas)                           │
│  • mission_preview.html (mapa de visualización)                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## 📋 Reporte de Misión (Ejemplo de Salida)

```json
{
  "mission_name": "Levantamiento_Finca_001",
  "created": "2026-01-18T10:30:00",
  "drone_model": "DJI Mini 4 Pro",
  
  "area": {
    "polygon_area_ha": 2.5,
    "bounding_box_m": [150, 180]
  },
  
  "flight_parameters": {
    "gsd_cm_px": 2.0,
    "height_m": 80,
    "overlap_frontal_pct": 80,
    "overlap_lateral_pct": 70,
    "flight_angle_deg": 45,
    "pattern": "grid"
  },
  
  "calculated_values": {
    "footprint_m": [95.2, 71.4],
    "line_spacing_m": 28.6,
    "photo_spacing_m": 14.3,
    "max_speed_ms": 7.1,
    "actual_speed_ms": 5.0,
    "photo_interval_s": 2.86
  },
  
  "mission_stats": {
    "num_flight_lines": 6,
    "num_waypoints": 72,
    "total_photos_estimated": 72,
    "total_distance_m": 1850,
    "estimated_flight_time_min": 8.5,
    "batteries_required": 1
  },
  
  "camera_settings": {
    "gimbal_pitch_deg": -90,
    "photo_mode": "48MP",
    "trigger_mode": "at_waypoint"
  },
  
  "output_files": {
    "kmz": "Levantamiento_Finca_001.kmz",
    "preview": "Levantamiento_Finca_001_preview.html"
  }
}
```

---

## ⚠️ Consideraciones Importantes

### Limitaciones de DJI Fly
1. **No importa KMZ directamente** - Requiere workaround de reemplazo de archivos
2. **No dispara fotos automáticamente** por distancia/tiempo - Usar Timed Shot manual
3. **Máximo de waypoints** - Verificar límite del dron (~99)
4. **Velocidad vs Intervalo** - Calcular correctamente para mantener overlap

### Recomendaciones de Vuelo
1. **Velocidad**: 2-7 m/s para fotogrametría
2. **Intervalo mínimo**: 2s (12MP), 5s (48MP/50MP)
3. **Overlap mínimo**: 75% frontal, 60% lateral
4. **Condiciones**: Evitar viento >10 m/s, sombras fuertes
5. **Batería**: Planificar con 20% de reserva

### Precisiones Esperadas
| Tipo de Producto | Precisión Horizontal | Precisión Vertical |
|------------------|---------------------|-------------------|
| Ortomosaico | 1-2× GSD | N/A |
| MDE/MDS | 1-2× GSD | 2-3× GSD |
| Modelo 3D | 1-2× GSD | 2-3× GSD |

---

## 🔗 Referencias Técnicas

- [DJI WPML Documentation](https://developer.dji.com/doc/cloud-api-tutorial/en/api-reference/dji-wpml/)
- [Pix4D Best Practices](https://support.pix4d.com/hc/best-practices-for-image-acquisition-and-photogrammetry)
- [GSD Calculator - Carrot](https://www.carrot.co.uk/drone-gsd-overlap-calculator/)
- [GEOG 892 - Flight Planning](https://www.e-education.psu.edu/geog892/node/658)

---

*Documento creado: Enero 2026*
*Versión: 1.0*
*Autor: Sebastian / GeoAI LATAM*
