# 🎯 GEOFLIGHT PLANNER - ROADMAP PARA CLAUDE CODE

## Sistema de Planificación de Vuelos Fotogramétricos con Interfaz Web

---

# 📋 ESPECIFICACIONES DEL PROYECTO

## Objetivo
Crear una aplicación web que genere archivos KMZ para misiones de levantamiento topográfico con drones DJI Mini 4 Pro / Mini 5 Pro.

## Stack Tecnológico
- **Backend:** Python 3.10+
- **Frontend:** Streamlit (interfaz web simple y rápida)
- **Mapas:** Folium (integrado en Streamlit)
- **Sin base de datos** (stateless, genera archivos on-demand)

## Resultado Final
Una aplicación web donde el usuario:
1. Dibuja un área en un mapa
2. Configura parámetros (GSD, overlap, ángulo, etc.)
3. Ve preview de la ruta de vuelo
4. Descarga el archivo KMZ

---

# 🏗️ ARQUITECTURA

```
geoflight/
├── app.py                    # Aplicación Streamlit (entrada principal)
├── config.py                 # Configuración y constantes
├── models.py                 # Dataclasses (Camera, Waypoint, Mission)
├── calculator.py             # Cálculos fotogramétricos
├── grid_generator.py         # Generador de patrón grid
├── wpml_builder.py           # Generador de XML WPML
├── kmz_packager.py           # Empaquetador KMZ
├── map_utils.py              # Utilidades para mapas Folium
├── requirements.txt
└── README.md
```

**Total: 9 archivos**

---

# 📊 PARÁMETROS DE ENTRADA (UI)

## Sección 1: Área de Vuelo
```yaml
area:
  method: "draw" | "coordinates"    # Dibujar en mapa o ingresar coords
  coordinates: [[lon, lat], ...]    # Lista de vértices del polígono
```

## Sección 2: Calidad de Imagen
```yaml
quality:
  target_gsd_cm: 2.0          # Slider: 0.5 - 10.0
  overlap_frontal: 80         # Slider: 60 - 90
  overlap_lateral: 70         # Slider: 50 - 85
```

## Sección 3: Patrón de Vuelo
```yaml
flight:
  pattern: "grid"             # Select: grid | double_grid
  angle_deg: 0                # Slider: 0 - 360 (con presets N-S, E-O)
  start_corner: "SW"          # Select: SW | SE | NW | NE
```

## Sección 4: Cámara
```yaml
camera:
  model: "mini4pro"           # Select: mini4pro | mini5pro
  gimbal_pitch: -90           # Slider: -90 a 0
  photo_mode: "48MP"          # Select: 12MP | 48MP
```

## Sección 5: Misión
```yaml
mission:
  name: "Mi_Mision"           # Text input
  finish_action: "goHome"     # Select: goHome | hover | land
  rc_lost_action: "hover"     # Select: goBack | hover | land
  takeoff_height: 20          # Number: 10-50
```

---

# 🚀 FASES DE DESARROLLO

Cada fase es un prompt independiente para Claude Code.

---

## 📦 FASE 0: Setup del Proyecto

### Prompt para Claude Code:

```
Crea la estructura inicial del proyecto GeoFlight Planner.

ESTRUCTURA:
geoflight/
├── app.py                    # Placeholder con "Hello World" Streamlit
├── config.py                 # Constantes y configuración
├── models.py                 # Dataclasses vacías
├── calculator.py             # Placeholder
├── grid_generator.py         # Placeholder
├── wpml_builder.py           # Placeholder
├── kmz_packager.py           # Placeholder
├── map_utils.py              # Placeholder
├── requirements.txt
└── README.md

REQUIREMENTS.TXT:
streamlit>=1.28.0
folium>=0.14.0
streamlit-folium>=0.15.0
shapely>=2.0.0
pyproj>=3.5.0
pyyaml>=6.0

CONFIG.PY debe contener:
- APP_NAME = "GeoFlight Planner"
- APP_VERSION = "1.0.0"
- DEFAULT_MAP_CENTER = [4.6097, -74.0817]  # Bogotá
- DEFAULT_MAP_ZOOM = 13

APP.PY debe mostrar:
- Título "GeoFlight Planner v1.0"
- Texto "Sistema de planificación de vuelos fotogramétricos"

CRITERIO DE ÉXITO:
- `streamlit run app.py` ejecuta sin errores
- Se muestra la página con el título
```

### Entregables:
- [ ] Estructura de carpetas creada
- [ ] requirements.txt funcional
- [ ] app.py muestra página básica

---

## 📦 FASE 1: Modelos de Datos

### Prompt para Claude Code:

```
Implementa los modelos de datos en models.py para GeoFlight Planner.

ARCHIVO: models.py

IMPLEMENTAR:

1. CameraSpec (dataclass):
   - name: str
   - sensor_width_mm: float
   - sensor_height_mm: float
   - focal_length_mm: float
   - image_width_px: int
   - image_height_px: int
   - min_interval_s: float
   - drone_enum_value: int
   - drone_sub_enum_value: int = 0

2. CAMERAS (dict) con presets:
   "mini4pro":
     - name: "DJI Mini 4 Pro"
     - sensor_width_mm: 9.59
     - sensor_height_mm: 7.19
     - focal_length_mm: 6.72
     - image_width_px: 8064
     - image_height_px: 6048
     - min_interval_s: 2.0
     - drone_enum_value: 68
   
   "mini5pro":
     - name: "DJI Mini 5 Pro"
     - sensor_width_mm: 12.8
     - sensor_height_mm: 9.6
     - focal_length_mm: 8.8
     - image_width_px: 8192
     - image_height_px: 6144
     - min_interval_s: 2.0
     - drone_enum_value: 68

3. Waypoint (dataclass):
   - index: int
   - lat: float
   - lon: float
   - height_m: float
   - speed_ms: float
   - heading_deg: float
   - gimbal_pitch_deg: float
   - actions: List[str]

4. FlightParams (dataclass):
   - height_m: float
   - gsd_cm: float
   - footprint_width_m: float
   - footprint_height_m: float
   - line_spacing_m: float
   - photo_spacing_m: float
   - max_speed_ms: float
   - recommended_speed_ms: float
   - photo_interval_s: float

5. MissionConfig (dataclass):
   - name: str
   - camera: CameraSpec
   - target_gsd_cm: float
   - overlap_frontal: int
   - overlap_lateral: int
   - flight_angle_deg: float
   - start_corner: str
   - gimbal_pitch_deg: float
   - finish_action: str
   - rc_lost_action: str
   - takeoff_height_m: float

6. Función get_camera(name: str) -> CameraSpec

CRITERIO DE ÉXITO:
- from models import CameraSpec, Waypoint, get_camera funciona
- get_camera("mini4pro") retorna specs correctas
- get_camera("invalid") lanza ValueError con mensaje claro
```

### Entregables:
- [ ] models.py completo
- [ ] Todos los dataclasses definidos
- [ ] get_camera() funcional

---

## 📦 FASE 2: Calculadora Fotogramétrica

### Prompt para Claude Code:

```
Implementa la calculadora fotogramétrica en calculator.py

ARCHIVO: calculator.py

IMPORTAR: from models import CameraSpec, FlightParams

IMPLEMENTAR FUNCIONES:

1. calculate_gsd(height_m: float, camera: CameraSpec) -> float
   """
   Calcula GSD en cm/pixel
   Fórmula: GSD = (height * sensor_width) / (focal * image_width) * 100
   """

2. calculate_height(gsd_cm: float, camera: CameraSpec) -> float
   """
   Calcula altura en metros para un GSD objetivo
   Fórmula: height = (gsd/100 * focal * image_width) / sensor_width
   """

3. calculate_footprint(height_m: float, camera: CameraSpec) -> tuple[float, float]
   """
   Calcula footprint (cobertura) en metros
   Returns: (width_m, height_m)
   Fórmula: 
     width = height * sensor_width / focal
     height = height * sensor_height / focal
   """

4. calculate_line_spacing(footprint_width: float, overlap_lateral: int) -> float
   """
   Distancia entre líneas de vuelo
   Fórmula: spacing = footprint_width * (1 - overlap/100)
   """

5. calculate_photo_spacing(footprint_height: float, overlap_frontal: int) -> float
   """
   Distancia entre fotos consecutivas
   Fórmula: spacing = footprint_height * (1 - overlap/100)
   """

6. calculate_max_speed(photo_spacing: float, min_interval: float) -> float
   """
   Velocidad máxima para mantener overlap
   Fórmula: speed = photo_spacing / min_interval
   """

7. calculate_flight_params(
       camera: CameraSpec,
       target_gsd_cm: float,
       overlap_frontal: int,
       overlap_lateral: int
   ) -> FlightParams
   """
   Calcula todos los parámetros de vuelo.
   - Calcula altura desde GSD
   - Calcula footprint
   - Calcula espaciados
   - Calcula velocidades
   - recommended_speed = max_speed * 0.7 (margen de seguridad)
   - photo_interval = photo_spacing / recommended_speed
   Returns: FlightParams con todos los valores
   """

VALORES DE REFERENCIA PARA TESTING (Mini 4 Pro):
| GSD (cm) | Altura (m) | Footprint W (m) | Footprint H (m) |
|----------|------------|-----------------|-----------------|
| 1.0      | 40.0       | 57.1            | 42.8            |
| 2.0      | 80.0       | 114.2           | 85.6            |
| 3.0      | 120.0      | 171.3           | 128.4           |

CRITERIO DE ÉXITO:
- calculate_gsd(80, mini4pro) ≈ 2.0 (±0.1)
- calculate_height(2.0, mini4pro) ≈ 80 (±2)
- calculate_flight_params() retorna FlightParams válido
```

### Entregables:
- [ ] calculator.py completo
- [ ] Todas las funciones implementadas
- [ ] Valores coinciden con referencia (±5%)

---

## 📦 FASE 3: Generador de Grid

### Prompt para Claude Code:

```
Implementa el generador de patrón grid en grid_generator.py

ARCHIVO: grid_generator.py

IMPORTAR:
from models import Waypoint, FlightParams, MissionConfig
from typing import List, Tuple
import math

IMPLEMENTAR:

1. calculate_distance_m(lat1, lon1, lat2, lon2) -> float
   """Distancia en metros entre dos coordenadas (Haversine)"""

2. offset_coordinate(lat, lon, distance_m, bearing_deg) -> tuple[float, float]
   """
   Desplaza una coordenada una distancia en una dirección
   bearing_deg: 0=Norte, 90=Este, 180=Sur, 270=Oeste
   Returns: (new_lat, new_lon)
   """

3. get_polygon_bounds(coordinates: List[Tuple[float, float]]) -> dict
   """
   Obtiene bounds del polígono
   coordinates: lista de (lon, lat)
   Returns: {
     'min_lon': float, 'max_lon': float,
     'min_lat': float, 'max_lat': float,
     'center_lon': float, 'center_lat': float,
     'width_m': float, 'height_m': float
   }
   """

4. generate_grid_waypoints(
       coordinates: List[Tuple[float, float]],
       flight_params: FlightParams,
       config: MissionConfig
   ) -> List[Waypoint]
   """
   Genera waypoints en patrón grid.
   
   ALGORITMO:
   1. Obtener bounds del polígono
   2. Calcular número de líneas = ceil(width / line_spacing)
   3. Calcular puntos por línea = ceil(height / photo_spacing)
   4. Para cada línea:
      a. Calcular posición de la línea (offset desde borde)
      b. Rotar según flight_angle_deg
      c. Generar puntos a lo largo de la línea
      d. Alternar dirección (serpentín)
   5. Asignar índices, headings, acciones
   
   PATRÓN SERPENTÍN:
   Línea 0: →→→→→ (izq a der)
   Línea 1: ←←←←← (der a izq)
   Línea 2: →→→→→
   ...
   
   HEADING:
   - Líneas pares: flight_angle_deg
   - Líneas impares: (flight_angle_deg + 180) % 360
   
   ACCIONES para cada waypoint:
   ["gimbalRotate", "takePhoto"]
   
   Returns: Lista de Waypoint ordenados por secuencia de vuelo
   """

5. calculate_mission_stats(waypoints: List[Waypoint]) -> dict
   """
   Calcula estadísticas de la misión
   Returns: {
     'num_waypoints': int,
     'num_lines': int,
     'total_distance_m': float,
     'estimated_time_min': float,
     'estimated_photos': int
   }
   """

EJEMPLO DE SALIDA (área 100x100m, line_spacing=25m, photo_spacing=15m):
- Número de líneas: 4
- Waypoints por línea: 7
- Total waypoints: 28
- Patrón:
  WP0 → WP1 → WP2 → WP3 → WP4 → WP5 → WP6
                                        ↓
  WP13 ← WP12 ← WP11 ← WP10 ← WP9 ← WP8 ← WP7
  ↓
  WP14 → WP15 → ...

CRITERIO DE ÉXITO:
- Genera waypoints dentro del área definida
- Patrón serpentín correcto
- Headings alternados correctamente
- Distancia entre waypoints ≈ photo_spacing
- Distancia entre líneas ≈ line_spacing
```

### Entregables:
- [ ] grid_generator.py completo
- [ ] Waypoints generados correctamente
- [ ] Patrón serpentín funciona
- [ ] Rotación por ángulo funciona

---

## 📦 FASE 4: Generador WPML

### Prompt para Claude Code:

```
Implementa el generador de WPML en wpml_builder.py

ARCHIVO: wpml_builder.py

IMPORTAR:
from models import Waypoint, MissionConfig, CameraSpec
from typing import List
from datetime import datetime

IMPLEMENTAR:

1. build_mission_config_xml(config: MissionConfig) -> str
   """
   Genera el bloque <wpml:missionConfig>
   
   TEMPLATE:
   <wpml:missionConfig>
     <wpml:flyToWaylineMode>safely</wpml:flyToWaylineMode>
     <wpml:finishAction>{config.finish_action}</wpml:finishAction>
     <wpml:exitOnRCLost>executeLostAction</wpml:exitOnRCLost>
     <wpml:executeRCLostAction>{config.rc_lost_action}</wpml:executeRCLostAction>
     <wpml:takeOffSecurityHeight>{config.takeoff_height_m}</wpml:takeOffSecurityHeight>
     <wpml:globalTransitionalSpeed>5</wpml:globalTransitionalSpeed>
     <wpml:droneInfo>
       <wpml:droneEnumValue>{config.camera.drone_enum_value}</wpml:droneEnumValue>
       <wpml:droneSubEnumValue>0</wpml:droneSubEnumValue>
     </wpml:droneInfo>
   </wpml:missionConfig>
   """

2. build_placemark_xml(waypoint: Waypoint, config: MissionConfig) -> str
   """
   Genera un elemento <Placemark> para un waypoint
   
   TEMPLATE:
   <Placemark>
     <Point>
       <coordinates>{waypoint.lon},{waypoint.lat}</coordinates>
     </Point>
     <wpml:index>{waypoint.index}</wpml:index>
     <wpml:executeHeight>{waypoint.height_m}</wpml:executeHeight>
     <wpml:waypointSpeed>{waypoint.speed_ms}</wpml:waypointSpeed>
     <wpml:waypointHeadingParam>
       <wpml:waypointHeadingMode>followWayline</wpml:waypointHeadingMode>
     </wpml:waypointHeadingParam>
     <wpml:waypointTurnParam>
       <wpml:waypointTurnMode>toPointAndStopWithDiscontinuityCurvature</wpml:waypointTurnMode>
       <wpml:waypointTurnDampingDist>0</wpml:waypointTurnDampingDist>
     </wpml:waypointTurnParam>
     <wpml:useStraightLine>1</wpml:useStraightLine>
     {action_group_xml}
   </Placemark>
   """

3. build_action_group_xml(waypoint: Waypoint, config: MissionConfig) -> str
   """
   Genera el <wpml:actionGroup> para un waypoint
   
   TEMPLATE:
   <wpml:actionGroup>
     <wpml:actionGroupId>{waypoint.index}</wpml:actionGroupId>
     <wpml:actionGroupStartIndex>{waypoint.index}</wpml:actionGroupStartIndex>
     <wpml:actionGroupEndIndex>{waypoint.index}</wpml:actionGroupEndIndex>
     <wpml:actionGroupMode>sequence</wpml:actionGroupMode>
     <wpml:actionTrigger>
       <wpml:actionTriggerType>reachPoint</wpml:actionTriggerType>
     </wpml:actionTrigger>
     
     <!-- Acción 1: Gimbal -->
     <wpml:action>
       <wpml:actionId>{waypoint.index * 2}</wpml:actionId>
       <wpml:actionActuatorFunc>gimbalRotate</wpml:actionActuatorFunc>
       <wpml:actionActuatorFuncParam>
         <wpml:gimbalHeadingYawBase>aircraft</wpml:gimbalHeadingYawBase>
         <wpml:gimbalRotateMode>absoluteAngle</wpml:gimbalRotateMode>
         <wpml:gimbalPitchRotateEnable>1</wpml:gimbalPitchRotateEnable>
         <wpml:gimbalPitchRotateAngle>{config.gimbal_pitch_deg}</wpml:gimbalPitchRotateAngle>
         <wpml:gimbalRollRotateEnable>0</wpml:gimbalRollRotateEnable>
         <wpml:gimbalYawRotateEnable>0</wpml:gimbalYawRotateEnable>
         <wpml:gimbalRotateTimeEnable>0</wpml:gimbalRotateTimeEnable>
         <wpml:payloadPositionIndex>0</wpml:payloadPositionIndex>
       </wpml:actionActuatorFuncParam>
     </wpml:action>
     
     <!-- Acción 2: Tomar Foto -->
     <wpml:action>
       <wpml:actionId>{waypoint.index * 2 + 1}</wpml:actionId>
       <wpml:actionActuatorFunc>takePhoto</wpml:actionActuatorFunc>
       <wpml:actionActuatorFuncParam>
         <wpml:payloadPositionIndex>0</wpml:payloadPositionIndex>
       </wpml:actionActuatorFuncParam>
     </wpml:action>
   </wpml:actionGroup>
   """

4. build_template_kml(config: MissionConfig) -> str
   """
   Genera el archivo template.kml completo
   
   ESTRUCTURA:
   <?xml version="1.0" encoding="UTF-8"?>
   <kml xmlns="http://www.opengis.net/kml/2.2" xmlns:wpml="http://www.dji.com/wpmz/1.0.2">
     <Document>
       <wpml:author>GeoFlight Planner</wpml:author>
       <wpml:createTime>{timestamp}</wpml:createTime>
       <wpml:updateTime>{timestamp}</wpml:updateTime>
       {mission_config_xml}
     </Document>
   </kml>
   
   timestamp formato: Unix milliseconds (int(datetime.now().timestamp() * 1000))
   """

5. build_waylines_wpml(waypoints: List[Waypoint], config: MissionConfig, flight_params) -> str
   """
   Genera el archivo waylines.wpml completo
   
   ESTRUCTURA:
   <?xml version="1.0" encoding="UTF-8"?>
   <kml xmlns="http://www.opengis.net/kml/2.2" xmlns:wpml="http://www.dji.com/wpmz/1.0.2">
     <Document>
       {mission_config_xml}
       <Folder>
         <wpml:templateId>0</wpml:templateId>
         <wpml:executeHeightMode>relativeToStartPoint</wpml:executeHeightMode>
         <wpml:waylineId>0</wpml:waylineId>
         <wpml:distance>{total_distance}</wpml:distance>
         <wpml:duration>{estimated_duration}</wpml:duration>
         <wpml:autoFlightSpeed>{flight_params.recommended_speed_ms}</wpml:autoFlightSpeed>
         
         {all_placemarks}
       </Folder>
     </Document>
   </kml>
   """

CRITERIO DE ÉXITO:
- XML generado es válido (sin errores de parseo)
- Estructura coincide con formato DJI WPML
- Todos los waypoints incluidos con acciones
```

### Entregables:
- [ ] wpml_builder.py completo
- [ ] XML válido generado
- [ ] Estructura WPML correcta

---

## 📦 FASE 5: Empaquetador KMZ

### Prompt para Claude Code:

```
Implementa el empaquetador KMZ en kmz_packager.py

ARCHIVO: kmz_packager.py

IMPORTAR:
import zipfile
import os
import tempfile
from typing import Optional

IMPLEMENTAR:

1. create_kmz(
       template_kml: str,
       waylines_wpml: str,
       output_path: str
   ) -> str
   """
   Crea el archivo KMZ con la estructura correcta.
   
   ESTRUCTURA DEL KMZ (es un archivo ZIP):
   mission.kmz
   └── wpmz/
       ├── template.kml
       └── waylines.wpml
   
   ALGORITMO:
   1. Crear directorio temporal
   2. Crear subdirectorio wpmz/
   3. Escribir template.kml en wpmz/
   4. Escribir waylines.wpml en wpmz/
   5. Crear archivo ZIP con extensión .kmz
   6. Agregar archivos manteniendo estructura wpmz/
   7. Retornar path del archivo creado
   
   IMPORTANTE:
   - El ZIP debe usar compresión ZIP_DEFLATED
   - Los paths dentro del ZIP deben ser: wpmz/template.kml y wpmz/waylines.wpml
   
   Returns: Path absoluto del archivo .kmz creado
   """

2. create_kmz_bytes(template_kml: str, waylines_wpml: str) -> bytes
   """
   Crea el KMZ y retorna los bytes (para descarga en Streamlit).
   
   Returns: bytes del archivo KMZ
   """

3. validate_kmz(kmz_path: str) -> dict
   """
   Valida que el KMZ tenga la estructura correcta.
   
   Returns: {
     'valid': bool,
     'has_template': bool,
     'has_waylines': bool,
     'errors': List[str]
   }
   """

EJEMPLO DE USO:
```python
template = build_template_kml(config)
waylines = build_waylines_wpml(waypoints, config, params)
kmz_bytes = create_kmz_bytes(template, waylines)

# En Streamlit:
st.download_button(
    label="Descargar KMZ",
    data=kmz_bytes,
    file_name="mission.kmz",
    mime="application/vnd.google-earth.kmz"
)
```

CRITERIO DE ÉXITO:
- KMZ se crea sin errores
- Estructura interna correcta (wpmz/template.kml, wpmz/waylines.wpml)
- Archivo se puede abrir con cualquier lector ZIP
- Tamaño razonable (< 1MB para misiones normales)
```

### Entregables:
- [ ] kmz_packager.py completo
- [ ] KMZ con estructura correcta
- [ ] Función de validación funciona

---

## 📦 FASE 6: Utilidades de Mapa

### Prompt para Claude Code:

```
Implementa las utilidades de mapa en map_utils.py

ARCHIVO: map_utils.py

IMPORTAR:
import folium
from folium.plugins import Draw
from typing import List, Tuple, Optional
from models import Waypoint

IMPLEMENTAR:

1. create_base_map(
       center: Tuple[float, float] = (4.6097, -74.0817),
       zoom: int = 15
   ) -> folium.Map
   """
   Crea mapa base con controles de dibujo.
   
   CONFIGURACIÓN:
   - Tiles: OpenStreetMap
   - Agregar plugin Draw para dibujar polígonos
   - Solo permitir dibujar polígonos y rectángulos
   
   Returns: folium.Map configurado
   """

2. add_polygon_to_map(
       m: folium.Map,
       coordinates: List[Tuple[float, float]],
       color: str = "blue",
       fill: bool = True,
       popup: str = None
   ) -> folium.Map
   """
   Agrega un polígono al mapa.
   coordinates: lista de (lon, lat)
   """

3. add_waypoints_to_map(
       m: folium.Map,
       waypoints: List[Waypoint],
       show_lines: bool = True,
       show_markers: bool = True,
       show_direction: bool = True
   ) -> folium.Map
   """
   Agrega waypoints y ruta de vuelo al mapa.
   
   VISUALIZACIÓN:
   - Línea conectando waypoints (roja, grosor 2)
   - Marcadores numerados en cada waypoint (círculos pequeños)
   - Flechas indicando dirección de vuelo
   - Marcador especial para inicio (verde) y fin (rojo)
   
   Returns: folium.Map con waypoints agregados
   """

4. add_flight_stats_popup(
       m: folium.Map,
       stats: dict,
       position: Tuple[float, float]
   ) -> folium.Map
   """
   Agrega popup con estadísticas de vuelo.
   """

5. parse_drawn_polygon(geojson_data: dict) -> List[Tuple[float, float]]:
   """
   Parsea el GeoJSON del plugin Draw para obtener coordenadas.
   
   Input: GeoJSON del evento de dibujo
   Returns: Lista de (lon, lat)
   """

COLORES SUGERIDOS:
- Área de vuelo: azul semitransparente (#3388ff, opacity 0.3)
- Ruta de vuelo: rojo (#ff0000)
- Waypoint normal: azul pequeño
- Waypoint inicio: verde
- Waypoint fin: rojo

CRITERIO DE ÉXITO:
- Mapa se renderiza correctamente
- Plugin de dibujo funciona
- Waypoints se visualizan con línea de conexión
- Dirección de vuelo clara
```

### Entregables:
- [ ] map_utils.py completo
- [ ] Mapa interactivo funciona
- [ ] Visualización de waypoints clara

---

## 📦 FASE 7: Aplicación Web Streamlit

### Prompt para Claude Code:

```
Implementa la aplicación web completa en app.py

ARCHIVO: app.py

IMPORTAR todos los módulos creados:
- config
- models
- calculator
- grid_generator
- wpml_builder
- kmz_packager
- map_utils

ESTRUCTURA DE LA UI:

## SIDEBAR (Configuración)

### Sección: Cámara
- Selectbox: Modelo de dron (mini4pro, mini5pro)
- Selectbox: Modo de foto (12MP, 48MP)

### Sección: Calidad
- Slider: GSD objetivo (0.5 - 10.0 cm, default 2.0)
- Slider: Overlap frontal (60 - 90%, default 80)
- Slider: Overlap lateral (50 - 85%, default 70)

### Sección: Patrón de Vuelo
- Slider: Ángulo de vuelo (0 - 360°, default 0)
  - Botones rápidos: N-S (0°), E-O (90°), NE-SO (45°)
- Selectbox: Esquina de inicio (SW, SE, NW, NE)
- Slider: Ángulo gimbal (-90 a 0, default -90)

### Sección: Misión
- Text input: Nombre de misión
- Selectbox: Acción al finalizar (goHome, hover, land)
- Selectbox: Acción RC perdido (goBack, hover, land)
- Number input: Altura despegue (10-50m, default 20)

### Sección: Área de Vuelo
- Radio: Método de entrada (Dibujar en mapa / Coordenadas manuales)
- Si coordenadas manuales: Text area para JSON

## ÁREA PRINCIPAL

### Tab 1: Mapa
- Mapa Folium con plugin Draw
- Instrucciones: "Dibuja un polígono para definir el área de vuelo"
- Mostrar área dibujada

### Tab 2: Parámetros Calculados
Tabla con:
- Altura de vuelo (m)
- GSD real (cm/px)
- Footprint (m × m)
- Espaciado entre líneas (m)
- Espaciado entre fotos (m)
- Velocidad recomendada (m/s)
- Intervalo de fotos (s)

### Tab 3: Preview de Ruta
- Mapa con waypoints y ruta de vuelo
- Estadísticas:
  - Total waypoints
  - Distancia total (m)
  - Tiempo estimado (min)
  - Fotos estimadas

### Tab 4: Generar KMZ
- Botón "Generar Misión"
- Mostrar resumen de configuración
- Botón de descarga del KMZ
- Mostrar JSON del reporte

## LÓGICA PRINCIPAL

```python
def main():
    st.set_page_config(
        page_title="GeoFlight Planner",
        page_icon="🛩️",
        layout="wide"
    )
    
    st.title("🛩️ GeoFlight Planner")
    st.markdown("Sistema de planificación de vuelos fotogramétricos para DJI")
    
    # Sidebar con configuración
    with st.sidebar:
        # ... todos los controles ...
    
    # Área principal con tabs
    tab1, tab2, tab3, tab4 = st.tabs([
        "🗺️ Área de Vuelo",
        "📊 Parámetros",
        "👁️ Preview",
        "📥 Generar"
    ])
    
    # Lógica de cada tab...
    
    # Session state para guardar:
    # - area_coordinates
    # - waypoints
    # - flight_params
    # - mission_config

if __name__ == "__main__":
    main()
```

CONSIDERACIONES UX:
- Usar st.session_state para persistir datos entre interacciones
- Mostrar warnings si falta configuración
- Validar que haya área definida antes de generar
- Mostrar spinner durante cálculos
- Mensajes de éxito/error claros

CRITERIO DE ÉXITO:
- Aplicación se ejecuta sin errores
- Flujo completo funciona: dibujar → configurar → preview → descargar
- UI responsiva y clara
- KMZ descargable
```

### Entregables:
- [ ] app.py completo
- [ ] UI funcional con todas las secciones
- [ ] Flujo completo de trabajo
- [ ] KMZ descargable

---

## 📦 FASE 8: Testing y Validación

### Prompt para Claude Code:

```
Crea pruebas de validación para GeoFlight Planner.

CREAR ARCHIVO: test_geoflight.py

TESTS A IMPLEMENTAR:

1. test_camera_specs():
   - Verificar que get_camera("mini4pro") retorna valores correctos
   - Verificar que get_camera("mini5pro") retorna valores correctos
   - Verificar que get_camera("invalid") lanza ValueError

2. test_gsd_calculation():
   - Mini 4 Pro a 80m debe dar GSD ≈ 2.0 cm (±0.1)
   - Mini 4 Pro a 40m debe dar GSD ≈ 1.0 cm (±0.1)
   - Mini 4 Pro a 120m debe dar GSD ≈ 3.0 cm (±0.1)

3. test_height_calculation():
   - GSD 2.0 cm con Mini 4 Pro debe dar altura ≈ 80m (±2)
   - GSD 1.0 cm con Mini 4 Pro debe dar altura ≈ 40m (±2)

4. test_footprint_calculation():
   - Mini 4 Pro a 80m: footprint ≈ 114 x 86 m (±5)

5. test_spacing_calculations():
   - Overlap 80% frontal con footprint 86m → spacing ≈ 17.2m
   - Overlap 70% lateral con footprint 114m → spacing ≈ 34.2m

6. test_grid_generation():
   - Área 100x100m genera número esperado de waypoints
   - Waypoints están dentro del área
   - Patrón serpentín correcto

7. test_wpml_generation():
   - XML generado es válido (no errores de parseo)
   - Contiene todos los elementos requeridos

8. test_kmz_structure():
   - KMZ contiene wpmz/template.kml
   - KMZ contiene wpmz/waylines.wpml

EJECUTAR:
pytest test_geoflight.py -v

CRITERIO DE ÉXITO:
- Todos los tests pasan
- Cobertura de funciones críticas
```

### Entregables:
- [ ] test_geoflight.py completo
- [ ] Todos los tests pasan
- [ ] Valores de referencia validados

---

# 📅 RESUMEN DE FASES

| Fase | Nombre | Archivos | Estimado |
|------|--------|----------|----------|
| 0 | Setup | estructura, requirements | 30 min |
| 1 | Modelos | models.py | 1 hora |
| 2 | Calculadora | calculator.py | 1-2 horas |
| 3 | Grid Generator | grid_generator.py | 2-3 horas |
| 4 | WPML Builder | wpml_builder.py | 2-3 horas |
| 5 | KMZ Packager | kmz_packager.py | 1 hora |
| 6 | Map Utils | map_utils.py | 1-2 horas |
| 7 | App Web | app.py | 3-4 horas |
| 8 | Testing | test_geoflight.py | 1-2 horas |
| **TOTAL** | | **9 archivos** | **~15 horas** |

---

# 📝 NOTAS PARA CLAUDE CODE

1. **KISS**: Mantener código simple y directo
2. **Un archivo = Una responsabilidad**
3. **Sin sobre-ingeniería**: No crear abstracciones innecesarias
4. **Documentar**: Docstrings claros en cada función
5. **Validar**: Verificar que cada fase funciona antes de pasar a la siguiente

---

# ⚠️ LIMITACIONES CONOCIDAS

1. **DJI Fly no importa KMZ directamente**
   - Workaround: Copiar a `/Android/data/dji.go.v5/files/waypoint/`
   
2. **Fotos no se disparan automáticamente**
   - Usar "Timed Shot" en modo cámara
   
3. **Límite de ~99 waypoints por misión**
   - Validar y advertir al usuario

---

*Roadmap v2.0 para Claude Code*
*GeoFlight Planner - Interfaz Web*
*GeoAI LATAM - Enero 2026*
