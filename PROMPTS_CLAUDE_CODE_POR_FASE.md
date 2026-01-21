# 📋 PROMPTS POR FASE PARA CLAUDE CODE

## GeoFlight Planner - Sistema de Planificación de Vuelos Fotogramétricos

---

# ═══════════════════════════════════════════════════════════════
# FASE 0: SETUP DEL PROYECTO
# ═══════════════════════════════════════════════════════════════

```
Crea la estructura inicial del proyecto GeoFlight Planner - un sistema web para planificar vuelos fotogramétricos con drones DJI.

## Estructura de archivos a crear:

geoflight/
├── app.py
├── config.py
├── models.py
├── calculator.py
├── grid_generator.py
├── wpml_builder.py
├── kmz_packager.py
├── map_utils.py
├── requirements.txt
└── README.md

## Contenido de requirements.txt:
streamlit>=1.28.0
folium>=0.14.0
streamlit-folium>=0.15.0
shapely>=2.0.0
pyproj>=3.5.0
pyyaml>=6.0

## Contenido de config.py:
APP_NAME = "GeoFlight Planner"
APP_VERSION = "1.0.0"
DEFAULT_MAP_CENTER = [4.6097, -74.0817]  # Bogotá
DEFAULT_MAP_ZOOM = 15

## Contenido de app.py (placeholder inicial):
import streamlit as st
from config import APP_NAME, APP_VERSION

st.set_page_config(page_title=APP_NAME, page_icon="🛩️", layout="wide")
st.title(f"🛩️ {APP_NAME} v{APP_VERSION}")
st.markdown("Sistema de planificación de vuelos fotogramétricos para DJI Mini 4 Pro / Mini 5 Pro")
st.info("Aplicación en desarrollo - Fase 0 completada")

## Los demás archivos .py crear como placeholders con:
# [nombre_archivo].py - GeoFlight Planner
# TODO: Implementar en Fase X

## README.md con descripción básica del proyecto

Verifica que `streamlit run app.py` ejecute sin errores.
```

---

# ═══════════════════════════════════════════════════════════════
# FASE 1: MODELOS DE DATOS
# ═══════════════════════════════════════════════════════════════

```
Implementa los modelos de datos en models.py para GeoFlight Planner.

## Dataclasses a crear:

### 1. CameraSpec
```python
@dataclass
class CameraSpec:
    name: str
    sensor_width_mm: float
    sensor_height_mm: float
    focal_length_mm: float
    image_width_px: int
    image_height_px: int
    min_interval_s: float
    drone_enum_value: int
    drone_sub_enum_value: int = 0
```

### 2. CAMERAS (diccionario con presets):
- "mini4pro": DJI Mini 4 Pro
  - sensor: 9.59 x 7.19 mm
  - focal: 6.72 mm
  - imagen: 8064 x 6048 px
  - intervalo mínimo: 2.0 s
  - drone_enum: 68

- "mini5pro": DJI Mini 5 Pro
  - sensor: 12.8 x 9.6 mm
  - focal: 8.8 mm
  - imagen: 8192 x 6144 px
  - intervalo mínimo: 2.0 s
  - drone_enum: 68

### 3. Waypoint
```python
@dataclass
class Waypoint:
    index: int
    lat: float
    lon: float
    height_m: float
    speed_ms: float
    heading_deg: float
    gimbal_pitch_deg: float
    actions: List[str]
```

### 4. FlightParams
```python
@dataclass
class FlightParams:
    height_m: float
    gsd_cm: float
    footprint_width_m: float
    footprint_height_m: float
    line_spacing_m: float
    photo_spacing_m: float
    max_speed_ms: float
    recommended_speed_ms: float
    photo_interval_s: float
```

### 5. MissionConfig
```python
@dataclass
class MissionConfig:
    name: str
    camera: CameraSpec
    target_gsd_cm: float
    overlap_frontal: int
    overlap_lateral: int
    flight_angle_deg: float
    start_corner: str
    gimbal_pitch_deg: float
    finish_action: str
    rc_lost_action: str
    takeoff_height_m: float
```

### 6. Función get_camera(name: str) -> CameraSpec
- Retorna el preset si existe
- Lanza ValueError si no existe con mensaje: "Camera 'X' not found. Available: [lista]"

## Verificación:
```python
from models import get_camera, CameraSpec
cam = get_camera("mini4pro")
assert cam.sensor_width_mm == 9.59
assert cam.focal_length_mm == 6.72
```
```

---

# ═══════════════════════════════════════════════════════════════
# FASE 2: CALCULADORA FOTOGRAMÉTRICA
# ═══════════════════════════════════════════════════════════════

```
Implementa la calculadora fotogramétrica en calculator.py

## Importaciones necesarias:
from models import CameraSpec, FlightParams

## Funciones a implementar:

### 1. calculate_gsd(height_m: float, camera: CameraSpec) -> float
Calcula GSD en cm/pixel.
Fórmula: GSD = (height × sensor_width) / (focal × image_width) × 100

### 2. calculate_height(gsd_cm: float, camera: CameraSpec) -> float
Calcula altura en metros para un GSD objetivo.
Fórmula: height = (gsd/100 × focal × image_width) / sensor_width

### 3. calculate_footprint(height_m: float, camera: CameraSpec) -> tuple[float, float]
Calcula cobertura de imagen en tierra (metros).
Fórmulas:
- width = height × sensor_width / focal
- height_fp = height × sensor_height / focal
Returns: (footprint_width_m, footprint_height_m)

### 4. calculate_line_spacing(footprint_width: float, overlap_lateral: int) -> float
Distancia entre líneas de vuelo.
Fórmula: spacing = footprint_width × (1 - overlap/100)

### 5. calculate_photo_spacing(footprint_height: float, overlap_frontal: int) -> float
Distancia entre fotos consecutivas.
Fórmula: spacing = footprint_height × (1 - overlap/100)

### 6. calculate_max_speed(photo_spacing: float, min_interval: float) -> float
Velocidad máxima para mantener overlap.
Fórmula: speed = photo_spacing / min_interval

### 7. calculate_flight_params(...) -> FlightParams
Función principal que calcula todos los parámetros.

Parámetros:
- camera: CameraSpec
- target_gsd_cm: float
- overlap_frontal: int
- overlap_lateral: int

Lógica:
1. Calcular altura desde GSD objetivo
2. Calcular footprint a esa altura
3. Calcular espaciado entre líneas (lateral)
4. Calcular espaciado entre fotos (frontal)
5. Calcular velocidad máxima
6. recommended_speed = max_speed × 0.7 (margen seguridad)
7. photo_interval = photo_spacing / recommended_speed

Returns: FlightParams con todos los valores

## Valores de referencia para verificar (Mini 4 Pro):
| GSD (cm) | Altura (m) | Footprint W×H (m) |
|----------|------------|-------------------|
| 1.0      | ~40        | ~57 × ~43         |
| 2.0      | ~80        | ~114 × ~86        |
| 3.0      | ~120       | ~171 × ~128       |

## Verificación:
```python
from models import get_camera
from calculator import calculate_gsd, calculate_height, calculate_flight_params

cam = get_camera("mini4pro")
assert abs(calculate_gsd(80, cam) - 2.0) < 0.2
assert abs(calculate_height(2.0, cam) - 80) < 5

params = calculate_flight_params(cam, 2.0, 80, 70)
assert params.height_m > 0
assert params.line_spacing_m > 0
```
```

---

# ═══════════════════════════════════════════════════════════════
# FASE 3: GENERADOR DE GRID
# ═══════════════════════════════════════════════════════════════

```
Implementa el generador de patrón grid en grid_generator.py

## Importaciones:
from models import Waypoint, FlightParams, MissionConfig
from typing import List, Tuple
import math

## Funciones a implementar:

### 1. haversine_distance(lat1, lon1, lat2, lon2) -> float
Distancia en metros entre dos coordenadas usando fórmula Haversine.
Radio de la Tierra: 6371000 metros

### 2. offset_coordinate(lat, lon, distance_m, bearing_deg) -> tuple[float, float]
Desplaza una coordenada una distancia en una dirección.
- bearing_deg: 0=Norte, 90=Este, 180=Sur, 270=Oeste
Returns: (new_lat, new_lon)

### 3. get_polygon_bounds(coordinates: List[Tuple[float, float]]) -> dict
Obtiene bounds del polígono.
- coordinates: lista de (lon, lat)
Returns: {
    'min_lon', 'max_lon', 'min_lat', 'max_lat',
    'center_lon', 'center_lat',
    'width_m', 'height_m'
}

### 4. generate_grid_waypoints(
    coordinates: List[Tuple[float, float]],
    flight_params: FlightParams,
    config: MissionConfig
) -> List[Waypoint]

ALGORITMO DETALLADO:

1. Obtener bounds del área
2. Calcular dimensiones en metros
3. Determinar número de líneas = ceil(width_m / line_spacing)
4. Determinar puntos por línea = ceil(height_m / photo_spacing)

5. Para cada línea i:
   a. Calcular offset lateral desde el borde según start_corner
   b. Calcular posición inicial de la línea
   c. Aplicar rotación según flight_angle_deg

6. Para cada punto j en la línea:
   a. Calcular posición del waypoint
   b. Si línea es par: de inicio a fin
   c. Si línea es impar: de fin a inicio (SERPENTÍN)

7. Para cada waypoint crear:
   - index: secuencial
   - lat, lon: coordenadas calculadas
   - height_m: desde flight_params
   - speed_ms: desde flight_params.recommended_speed_ms
   - heading_deg: dirección de la línea (0 o 180 según serpentín)
   - gimbal_pitch_deg: desde config
   - actions: ["gimbalRotate", "takePhoto"]

PATRÓN SERPENTÍN VISUAL:
```
Línea 0: WP0 → WP1 → WP2 → WP3  (izq a der)
                            ↓
Línea 1: WP7 ← WP6 ← WP5 ← WP4  (der a izq)
         ↓
Línea 2: WP8 → WP9 → WP10 → WP11 (izq a der)
```

### 5. calculate_mission_stats(waypoints: List[Waypoint]) -> dict
Calcula estadísticas de la misión.
Returns: {
    'num_waypoints': int,
    'num_lines': int (aproximado),
    'total_distance_m': float (suma de distancias entre WPs),
    'estimated_time_min': float (distancia / velocidad + tiempo en WPs),
    'estimated_photos': int (igual a num_waypoints)
}

## Verificación:
```python
# Área de prueba: rectángulo 100m x 100m
coords = [
    (-74.08, 4.60),   # SW
    (-74.079, 4.60),  # SE
    (-74.079, 4.601), # NE
    (-74.08, 4.601)   # NW
]

waypoints = generate_grid_waypoints(coords, flight_params, config)
assert len(waypoints) > 0
assert all(isinstance(wp, Waypoint) for wp in waypoints)

# Verificar patrón serpentín
# WP0 y WP de siguiente línea deben tener headings opuestos
```
```

---

# ═══════════════════════════════════════════════════════════════
# FASE 4: GENERADOR WPML
# ═══════════════════════════════════════════════════════════════

```
Implementa el generador de WPML en wpml_builder.py

## Importaciones:
from models import Waypoint, MissionConfig, FlightParams
from typing import List
from datetime import datetime

## Funciones a implementar:

### 1. build_mission_config_xml(config: MissionConfig) -> str
Genera el bloque XML <wpml:missionConfig>

TEMPLATE:
```xml
<wpml:missionConfig>
  <wpml:flyToWaylineMode>safely</wpml:flyToWaylineMode>
  <wpml:finishAction>{finish_action}</wpml:finishAction>
  <wpml:exitOnRCLost>executeLostAction</wpml:exitOnRCLost>
  <wpml:executeRCLostAction>{rc_lost_action}</wpml:executeRCLostAction>
  <wpml:takeOffSecurityHeight>{takeoff_height_m}</wpml:takeOffSecurityHeight>
  <wpml:globalTransitionalSpeed>5</wpml:globalTransitionalSpeed>
  <wpml:droneInfo>
    <wpml:droneEnumValue>{drone_enum_value}</wpml:droneEnumValue>
    <wpml:droneSubEnumValue>0</wpml:droneSubEnumValue>
  </wpml:droneInfo>
</wpml:missionConfig>
```

### 2. build_action_group_xml(waypoint: Waypoint, config: MissionConfig) -> str
Genera <wpml:actionGroup> con acciones de gimbal y foto.

TEMPLATE:
```xml
<wpml:actionGroup>
  <wpml:actionGroupId>{index}</wpml:actionGroupId>
  <wpml:actionGroupStartIndex>{index}</wpml:actionGroupStartIndex>
  <wpml:actionGroupEndIndex>{index}</wpml:actionGroupEndIndex>
  <wpml:actionGroupMode>sequence</wpml:actionGroupMode>
  <wpml:actionTrigger>
    <wpml:actionTriggerType>reachPoint</wpml:actionTriggerType>
  </wpml:actionTrigger>
  <wpml:action>
    <wpml:actionId>{index*2}</wpml:actionId>
    <wpml:actionActuatorFunc>gimbalRotate</wpml:actionActuatorFunc>
    <wpml:actionActuatorFuncParam>
      <wpml:gimbalHeadingYawBase>aircraft</wpml:gimbalHeadingYawBase>
      <wpml:gimbalRotateMode>absoluteAngle</wpml:gimbalRotateMode>
      <wpml:gimbalPitchRotateEnable>1</wpml:gimbalPitchRotateEnable>
      <wpml:gimbalPitchRotateAngle>{gimbal_pitch}</wpml:gimbalPitchRotateAngle>
      <wpml:gimbalRollRotateEnable>0</wpml:gimbalRollRotateEnable>
      <wpml:gimbalYawRotateEnable>0</wpml:gimbalYawRotateEnable>
      <wpml:gimbalRotateTimeEnable>0</wpml:gimbalRotateTimeEnable>
      <wpml:payloadPositionIndex>0</wpml:payloadPositionIndex>
    </wpml:actionActuatorFuncParam>
  </wpml:action>
  <wpml:action>
    <wpml:actionId>{index*2+1}</wpml:actionId>
    <wpml:actionActuatorFunc>takePhoto</wpml:actionActuatorFunc>
    <wpml:actionActuatorFuncParam>
      <wpml:payloadPositionIndex>0</wpml:payloadPositionIndex>
    </wpml:actionActuatorFuncParam>
  </wpml:action>
</wpml:actionGroup>
```

### 3. build_placemark_xml(waypoint: Waypoint, config: MissionConfig) -> str
Genera un <Placemark> completo para un waypoint.

TEMPLATE:
```xml
<Placemark>
  <Point>
    <coordinates>{lon},{lat}</coordinates>
  </Point>
  <wpml:index>{index}</wpml:index>
  <wpml:executeHeight>{height_m}</wpml:executeHeight>
  <wpml:waypointSpeed>{speed_ms}</wpml:waypointSpeed>
  <wpml:waypointHeadingParam>
    <wpml:waypointHeadingMode>followWayline</wpml:waypointHeadingMode>
  </wpml:waypointHeadingParam>
  <wpml:waypointTurnParam>
    <wpml:waypointTurnMode>toPointAndStopWithDiscontinuityCurvature</wpml:waypointTurnMode>
    <wpml:waypointTurnDampingDist>0</wpml:waypointTurnDampingDist>
  </wpml:waypointTurnParam>
  <wpml:useStraightLine>1</wpml:useStraightLine>
  {action_group}
</Placemark>
```

### 4. build_template_kml(config: MissionConfig) -> str
Genera template.kml completo.

```xml
<?xml version="1.0" encoding="UTF-8"?>
<kml xmlns="http://www.opengis.net/kml/2.2" xmlns:wpml="http://www.dji.com/wpmz/1.0.2">
  <Document>
    <wpml:author>GeoFlight Planner</wpml:author>
    <wpml:createTime>{timestamp_ms}</wpml:createTime>
    <wpml:updateTime>{timestamp_ms}</wpml:updateTime>
    {mission_config}
  </Document>
</kml>
```
timestamp_ms = int(datetime.now().timestamp() * 1000)

### 5. build_waylines_wpml(waypoints, config, flight_params, stats) -> str
Genera waylines.wpml completo.

```xml
<?xml version="1.0" encoding="UTF-8"?>
<kml xmlns="http://www.opengis.net/kml/2.2" xmlns:wpml="http://www.dji.com/wpmz/1.0.2">
  <Document>
    {mission_config}
    <Folder>
      <wpml:templateId>0</wpml:templateId>
      <wpml:executeHeightMode>relativeToStartPoint</wpml:executeHeightMode>
      <wpml:waylineId>0</wpml:waylineId>
      <wpml:distance>{total_distance}</wpml:distance>
      <wpml:duration>{duration_seconds}</wpml:duration>
      <wpml:autoFlightSpeed>{recommended_speed}</wpml:autoFlightSpeed>
      {all_placemarks}
    </Folder>
  </Document>
</kml>
```

## Verificación:
- XML generado debe ser válido (usar xml.etree.ElementTree para parsear)
- No debe haber errores de sintaxis XML
```

---

# ═══════════════════════════════════════════════════════════════
# FASE 5: EMPAQUETADOR KMZ
# ═══════════════════════════════════════════════════════════════

```
Implementa el empaquetador KMZ en kmz_packager.py

## Importaciones:
import zipfile
import io
from typing import Tuple

## Funciones a implementar:

### 1. create_kmz_bytes(template_kml: str, waylines_wpml: str) -> bytes
Crea el KMZ en memoria y retorna los bytes.

ESTRUCTURA DEL KMZ (archivo ZIP):
```
mission.kmz
└── wpmz/
    ├── template.kml
    └── waylines.wpml
```

IMPLEMENTACIÓN:
```python
def create_kmz_bytes(template_kml: str, waylines_wpml: str) -> bytes:
    buffer = io.BytesIO()
    
    with zipfile.ZipFile(buffer, 'w', zipfile.ZIP_DEFLATED) as zf:
        zf.writestr('wpmz/template.kml', template_kml)
        zf.writestr('wpmz/waylines.wpml', waylines_wpml)
    
    buffer.seek(0)
    return buffer.getvalue()
```

### 2. validate_kmz_bytes(kmz_bytes: bytes) -> dict
Valida que el KMZ tenga la estructura correcta.

Returns: {
    'valid': bool,
    'has_template': bool,
    'has_waylines': bool,
    'file_sizes': {'template.kml': int, 'waylines.wpml': int},
    'errors': List[str]
}

IMPLEMENTACIÓN:
```python
def validate_kmz_bytes(kmz_bytes: bytes) -> dict:
    result = {
        'valid': False,
        'has_template': False,
        'has_waylines': False,
        'file_sizes': {},
        'errors': []
    }
    
    try:
        buffer = io.BytesIO(kmz_bytes)
        with zipfile.ZipFile(buffer, 'r') as zf:
            names = zf.namelist()
            
            if 'wpmz/template.kml' in names:
                result['has_template'] = True
                result['file_sizes']['template.kml'] = zf.getinfo('wpmz/template.kml').file_size
            else:
                result['errors'].append('Missing wpmz/template.kml')
            
            if 'wpmz/waylines.wpml' in names:
                result['has_waylines'] = True
                result['file_sizes']['waylines.wpml'] = zf.getinfo('wpmz/waylines.wpml').file_size
            else:
                result['errors'].append('Missing wpmz/waylines.wpml')
            
            result['valid'] = result['has_template'] and result['has_waylines']
    
    except Exception as e:
        result['errors'].append(f'Error reading KMZ: {str(e)}')
    
    return result
```

## Verificación:
```python
template = "<kml>...</kml>"
waylines = "<kml>...</kml>"
kmz_bytes = create_kmz_bytes(template, waylines)

validation = validate_kmz_bytes(kmz_bytes)
assert validation['valid'] == True
assert validation['has_template'] == True
assert validation['has_waylines'] == True
```
```

---

# ═══════════════════════════════════════════════════════════════
# FASE 6: UTILIDADES DE MAPA
# ═══════════════════════════════════════════════════════════════

```
Implementa las utilidades de mapa en map_utils.py

## Importaciones:
import folium
from folium.plugins import Draw
from typing import List, Tuple
from models import Waypoint

## Funciones a implementar:

### 1. create_base_map(center: Tuple[float, float], zoom: int = 15) -> folium.Map
Crea mapa base con herramientas de dibujo.

```python
def create_base_map(center=(4.6097, -74.0817), zoom=15):
    m = folium.Map(location=center, zoom_start=zoom, tiles='OpenStreetMap')
    
    draw = Draw(
        draw_options={
            'polyline': False,
            'rectangle': True,
            'polygon': True,
            'circle': False,
            'marker': False,
            'circlemarker': False,
        },
        edit_options={'edit': False}
    )
    draw.add_to(m)
    
    return m
```

### 2. add_polygon_to_map(m, coordinates, color='blue', fill_opacity=0.3) -> folium.Map
Agrega polígono del área de vuelo.
coordinates: lista de (lon, lat) - CONVERTIR a (lat, lon) para Folium

### 3. add_waypoints_to_map(m, waypoints: List[Waypoint]) -> folium.Map
Agrega waypoints y ruta de vuelo al mapa.

VISUALIZACIÓN:
- Línea roja conectando todos los waypoints (PolyLine)
- Círculos pequeños azules para cada waypoint
- Marcador verde para WP0 (inicio)
- Marcador rojo para último WP (fin)
- Popup en cada waypoint con: "WP{index}\nH: {height}m"

```python
def add_waypoints_to_map(m, waypoints):
    if not waypoints:
        return m
    
    # Línea de ruta
    points = [(wp.lat, wp.lon) for wp in waypoints]
    folium.PolyLine(points, color='red', weight=2, opacity=0.8).add_to(m)
    
    # Waypoints
    for wp in waypoints:
        color = 'green' if wp.index == 0 else ('red' if wp.index == len(waypoints)-1 else 'blue')
        folium.CircleMarker(
            location=(wp.lat, wp.lon),
            radius=5,
            color=color,
            fill=True,
            popup=f"WP{wp.index}<br>H: {wp.height_m}m"
        ).add_to(m)
    
    return m
```

### 4. create_preview_map(coordinates, waypoints) -> folium.Map
Crea mapa completo con área y waypoints para preview.

```python
def create_preview_map(coordinates, waypoints):
    # Calcular centro
    lats = [c[1] for c in coordinates]
    lons = [c[0] for c in coordinates]
    center = (sum(lats)/len(lats), sum(lons)/len(lons))
    
    m = folium.Map(location=center, zoom_start=17)
    
    # Agregar área
    polygon_coords = [(c[1], c[0]) for c in coordinates]  # (lat, lon)
    folium.Polygon(polygon_coords, color='blue', fill=True, fill_opacity=0.2).add_to(m)
    
    # Agregar waypoints
    add_waypoints_to_map(m, waypoints)
    
    # Ajustar zoom para ver todo
    m.fit_bounds([(min(lats), min(lons)), (max(lats), max(lons))])
    
    return m
```

## Verificación:
- Los mapas se renderizan sin errores
- Los polígonos se muestran correctamente
- Los waypoints se conectan en orden
```

---

# ═══════════════════════════════════════════════════════════════
# FASE 7: APLICACIÓN WEB STREAMLIT
# ═══════════════════════════════════════════════════════════════

```
Implementa la aplicación web completa en app.py

## Importaciones:
import streamlit as st
from streamlit_folium import st_folium
import json

from config import APP_NAME, APP_VERSION, DEFAULT_MAP_CENTER
from models import get_camera, MissionConfig, CAMERAS
from calculator import calculate_flight_params
from grid_generator import generate_grid_waypoints, calculate_mission_stats
from wpml_builder import build_template_kml, build_waylines_wpml
from kmz_packager import create_kmz_bytes, validate_kmz_bytes
from map_utils import create_base_map, create_preview_map

## Estructura de la UI:

### Configuración de página
st.set_page_config(page_title=APP_NAME, page_icon="🛩️", layout="wide")

### Título
st.title(f"🛩️ {APP_NAME}")
st.markdown("Planificación de vuelos fotogramétricos para DJI Mini 4 Pro / Mini 5 Pro")

### SIDEBAR - Configuración

with st.sidebar:
    st.header("⚙️ Configuración")
    
    # Sección: Cámara
    st.subheader("📷 Cámara")
    camera_model = st.selectbox("Modelo", list(CAMERAS.keys()), format_func=lambda x: CAMERAS[x].name)
    
    # Sección: Calidad
    st.subheader("🎯 Calidad")
    target_gsd = st.slider("GSD objetivo (cm/px)", 0.5, 10.0, 2.0, 0.1)
    overlap_frontal = st.slider("Overlap frontal (%)", 60, 90, 80)
    overlap_lateral = st.slider("Overlap lateral (%)", 50, 85, 70)
    
    # Sección: Patrón de vuelo
    st.subheader("✈️ Patrón de vuelo")
    
    col1, col2, col3 = st.columns(3)
    with col1:
        if st.button("N-S"):
            st.session_state.flight_angle = 0
    with col2:
        if st.button("E-O"):
            st.session_state.flight_angle = 90
    with col3:
        if st.button("NE-SO"):
            st.session_state.flight_angle = 45
    
    flight_angle = st.slider("Ángulo de vuelo (°)", 0, 360, 
                             st.session_state.get('flight_angle', 0))
    start_corner = st.selectbox("Esquina de inicio", ["SW", "SE", "NW", "NE"])
    gimbal_pitch = st.slider("Ángulo gimbal (°)", -90, 0, -90)
    
    # Sección: Misión
    st.subheader("📋 Misión")
    mission_name = st.text_input("Nombre de misión", "Mi_Mision")
    finish_action = st.selectbox("Acción al finalizar", ["goHome", "hover", "land"])
    rc_lost_action = st.selectbox("Acción RC perdido", ["hover", "goBack", "land"])
    takeoff_height = st.number_input("Altura despegue (m)", 10, 50, 20)

### ÁREA PRINCIPAL - Tabs

tab1, tab2, tab3, tab4 = st.tabs(["🗺️ Área", "📊 Parámetros", "👁️ Preview", "📥 Generar"])

### Tab 1: Área de vuelo
with tab1:
    st.subheader("Define el área de vuelo")
    
    input_method = st.radio("Método de entrada", ["Dibujar en mapa", "Coordenadas JSON"])
    
    if input_method == "Dibujar en mapa":
        st.info("Usa las herramientas del mapa para dibujar un polígono o rectángulo")
        m = create_base_map(DEFAULT_MAP_CENTER)
        map_data = st_folium(m, height=500, width=None)
        
        # Procesar datos dibujados
        if map_data and map_data.get('all_drawings'):
            drawings = map_data['all_drawings']
            if drawings:
                geom = drawings[-1]['geometry']
                if geom['type'] == 'Polygon':
                    coords = geom['coordinates'][0]
                    st.session_state.area_coordinates = [(c[0], c[1]) for c in coords]
                    st.success(f"Área definida con {len(coords)} vértices")
    else:
        coords_json = st.text_area(
            "Coordenadas (JSON)",
            '[[-74.08, 4.60], [-74.079, 4.60], [-74.079, 4.601], [-74.08, 4.601]]'
        )
        if st.button("Cargar coordenadas"):
            try:
                coords = json.loads(coords_json)
                st.session_state.area_coordinates = [(c[0], c[1]) for c in coords]
                st.success("Coordenadas cargadas")
            except:
                st.error("JSON inválido")

### Tab 2: Parámetros calculados
with tab2:
    st.subheader("Parámetros de vuelo calculados")
    
    camera = get_camera(camera_model)
    params = calculate_flight_params(camera, target_gsd, overlap_frontal, overlap_lateral)
    
    col1, col2 = st.columns(2)
    
    with col1:
        st.metric("Altura de vuelo", f"{params.height_m:.1f} m")
        st.metric("GSD real", f"{params.gsd_cm:.2f} cm/px")
        st.metric("Footprint", f"{params.footprint_width_m:.1f} × {params.footprint_height_m:.1f} m")
    
    with col2:
        st.metric("Espaciado líneas", f"{params.line_spacing_m:.1f} m")
        st.metric("Espaciado fotos", f"{params.photo_spacing_m:.1f} m")
        st.metric("Velocidad", f"{params.recommended_speed_ms:.1f} m/s")
        st.metric("Intervalo fotos", f"{params.photo_interval_s:.1f} s")

### Tab 3: Preview
with tab3:
    st.subheader("Preview de la ruta de vuelo")
    
    if 'area_coordinates' not in st.session_state:
        st.warning("Primero define el área de vuelo en la pestaña 'Área'")
    else:
        # Crear configuración
        config = MissionConfig(
            name=mission_name,
            camera=camera,
            target_gsd_cm=target_gsd,
            overlap_frontal=overlap_frontal,
            overlap_lateral=overlap_lateral,
            flight_angle_deg=flight_angle,
            start_corner=start_corner,
            gimbal_pitch_deg=gimbal_pitch,
            finish_action=finish_action,
            rc_lost_action=rc_lost_action,
            takeoff_height_m=takeoff_height
        )
        
        # Generar waypoints
        waypoints = generate_grid_waypoints(
            st.session_state.area_coordinates,
            params,
            config
        )
        
        st.session_state.waypoints = waypoints
        st.session_state.config = config
        st.session_state.params = params
        
        # Estadísticas
        stats = calculate_mission_stats(waypoints)
        
        col1, col2, col3, col4 = st.columns(4)
        col1.metric("Waypoints", stats['num_waypoints'])
        col2.metric("Distancia", f"{stats['total_distance_m']:.0f} m")
        col3.metric("Tiempo est.", f"{stats['estimated_time_min']:.1f} min")
        col4.metric("Fotos", stats['estimated_photos'])
        
        # Mapa preview
        preview_map = create_preview_map(st.session_state.area_coordinates, waypoints)
        st_folium(preview_map, height=500, width=None)

### Tab 4: Generar KMZ
with tab4:
    st.subheader("Generar archivo KMZ")
    
    if 'waypoints' not in st.session_state:
        st.warning("Primero genera el preview en la pestaña 'Preview'")
    else:
        st.write("**Resumen de la misión:**")
        st.json({
            "nombre": st.session_state.config.name,
            "drone": st.session_state.config.camera.name,
            "gsd_cm": st.session_state.params.gsd_cm,
            "altura_m": st.session_state.params.height_m,
            "waypoints": len(st.session_state.waypoints),
            "overlap": f"{overlap_frontal}% / {overlap_lateral}%"
        })
        
        if st.button("🚀 Generar KMZ", type="primary"):
            with st.spinner("Generando..."):
                # Generar XMLs
                stats = calculate_mission_stats(st.session_state.waypoints)
                template = build_template_kml(st.session_state.config)
                waylines = build_waylines_wpml(
                    st.session_state.waypoints,
                    st.session_state.config,
                    st.session_state.params,
                    stats
                )
                
                # Crear KMZ
                kmz_bytes = create_kmz_bytes(template, waylines)
                
                # Validar
                validation = validate_kmz_bytes(kmz_bytes)
                
                if validation['valid']:
                    st.success("✅ KMZ generado correctamente!")
                    
                    st.download_button(
                        label="📥 Descargar KMZ",
                        data=kmz_bytes,
                        file_name=f"{mission_name}.kmz",
                        mime="application/vnd.google-earth.kmz"
                    )
                    
                    st.info("""
                    **Para usar en DJI Fly:**
                    1. Conecta tu dispositivo Android al PC
                    2. Copia el archivo a: `/Android/data/dji.go.v5/files/waypoint/`
                    3. Abre DJI Fly y selecciona la misión
                    """)
                else:
                    st.error(f"Error: {validation['errors']}")

## Session state inicial
if 'flight_angle' not in st.session_state:
    st.session_state.flight_angle = 0

## Verificación:
- `streamlit run app.py` ejecuta sin errores
- Flujo completo funciona: dibujar → configurar → preview → descargar
- KMZ se descarga correctamente
```

---

# ═══════════════════════════════════════════════════════════════
# FASE 8: TESTING
# ═══════════════════════════════════════════════════════════════

```
Crea archivo de pruebas test_geoflight.py

## Importaciones:
import pytest
from models import get_camera, CameraSpec, CAMERAS
from calculator import (
    calculate_gsd, calculate_height, calculate_footprint,
    calculate_line_spacing, calculate_photo_spacing, calculate_flight_params
)
from grid_generator import generate_grid_waypoints, calculate_mission_stats, haversine_distance
from wpml_builder import build_template_kml, build_waylines_wpml
from kmz_packager import create_kmz_bytes, validate_kmz_bytes

## Tests:

### Test de modelos
def test_get_camera_valid():
    cam = get_camera("mini4pro")
    assert cam.name == "DJI Mini 4 Pro"
    assert cam.sensor_width_mm == 9.59

def test_get_camera_invalid():
    with pytest.raises(ValueError):
        get_camera("invalid_camera")

### Test de calculadora
def test_gsd_at_80m():
    cam = get_camera("mini4pro")
    gsd = calculate_gsd(80, cam)
    assert 1.8 < gsd < 2.2, f"GSD esperado ~2.0, obtenido {gsd}"

def test_height_for_2cm_gsd():
    cam = get_camera("mini4pro")
    height = calculate_height(2.0, cam)
    assert 75 < height < 85, f"Altura esperada ~80, obtenida {height}"

def test_footprint_at_80m():
    cam = get_camera("mini4pro")
    w, h = calculate_footprint(80, cam)
    assert 100 < w < 130, f"Footprint width esperado ~114, obtenido {w}"
    assert 70 < h < 100, f"Footprint height esperado ~86, obtenido {h}"

def test_line_spacing():
    spacing = calculate_line_spacing(100, 70)  # 100m footprint, 70% overlap
    assert abs(spacing - 30) < 1, f"Spacing esperado 30, obtenido {spacing}"

def test_photo_spacing():
    spacing = calculate_photo_spacing(80, 80)  # 80m footprint, 80% overlap
    assert abs(spacing - 16) < 1, f"Spacing esperado 16, obtenido {spacing}"

def test_flight_params_complete():
    cam = get_camera("mini4pro")
    params = calculate_flight_params(cam, 2.0, 80, 70)
    assert params.height_m > 0
    assert params.gsd_cm > 0
    assert params.line_spacing_m > 0
    assert params.photo_spacing_m > 0
    assert params.recommended_speed_ms > 0

### Test de grid
def test_haversine_distance():
    # ~111m para 0.001 grados de latitud
    d = haversine_distance(4.60, -74.08, 4.601, -74.08)
    assert 100 < d < 120

def test_grid_generation():
    from models import MissionConfig
    
    cam = get_camera("mini4pro")
    params = calculate_flight_params(cam, 2.0, 80, 70)
    
    config = MissionConfig(
        name="Test",
        camera=cam,
        target_gsd_cm=2.0,
        overlap_frontal=80,
        overlap_lateral=70,
        flight_angle_deg=0,
        start_corner="SW",
        gimbal_pitch_deg=-90,
        finish_action="goHome",
        rc_lost_action="hover",
        takeoff_height_m=20
    )
    
    coords = [
        (-74.08, 4.60),
        (-74.079, 4.60),
        (-74.079, 4.601),
        (-74.08, 4.601)
    ]
    
    waypoints = generate_grid_waypoints(coords, params, config)
    assert len(waypoints) > 0
    assert waypoints[0].index == 0

### Test de WPML
def test_wpml_generation():
    # Usar datos de prueba mínimos
    # Verificar que XML es parseable
    pass

### Test de KMZ
def test_kmz_creation():
    template = '<?xml version="1.0"?><kml></kml>'
    waylines = '<?xml version="1.0"?><kml></kml>'
    
    kmz_bytes = create_kmz_bytes(template, waylines)
    assert len(kmz_bytes) > 0
    
    validation = validate_kmz_bytes(kmz_bytes)
    assert validation['valid'] == True

## Ejecutar:
pytest test_geoflight.py -v
```

---

# ═══════════════════════════════════════════════════════════════
# RESUMEN DE PROMPTS
# ═══════════════════════════════════════════════════════════════

| Fase | Archivo Principal | Descripción |
|------|-------------------|-------------|
| 0 | estructura/ | Setup del proyecto |
| 1 | models.py | Dataclasses y presets |
| 2 | calculator.py | Cálculos fotogramétricos |
| 3 | grid_generator.py | Generador de waypoints |
| 4 | wpml_builder.py | Generador de XML |
| 5 | kmz_packager.py | Empaquetador KMZ |
| 6 | map_utils.py | Utilidades de mapa |
| 7 | app.py | Aplicación Streamlit |
| 8 | test_geoflight.py | Tests |

---

*Prompts para Claude Code v1.0*
*GeoFlight Planner*
*GeoAI LATAM - Enero 2026*
