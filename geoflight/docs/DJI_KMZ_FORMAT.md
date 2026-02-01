# Formato KMZ para DJI Fly - Documentacion Tecnica

Este documento describe en detalle el formato KMZ utilizado por DJI Fly para misiones de waypoints, incluyendo la estructura de archivos, todos los tags XML y sus significados.

---

## Estructura del Archivo KMZ

El archivo KMZ es un archivo ZIP con extension `.kmz` que contiene:

```
mission.kmz (ZIP)
└── wpmz/
    ├── template.kml    # Metadatos y configuracion de la mision
    └── waylines.wpml   # Waypoints ejecutables con acciones
```

### Proceso de Creacion

```
1. Generar template.kml (configuracion)
2. Generar waylines.wpml (waypoints)
3. Empaquetar ambos en carpeta wpmz/
4. Comprimir como ZIP con extension .kmz
```

---

## Namespaces XML

Ambos archivos usan estos namespaces:

```xml
xmlns="http://www.opengis.net/kml/2.2"
xmlns:wpml="http://www.uav.com/wpmz/1.0.2"
```

| Namespace | Prefijo | Uso |
|-----------|---------|-----|
| KML | (default) | Elementos estandar KML (Document, Folder, Placemark, Point) |
| WPML | wpml: | Elementos especificos de DJI (waypoints, acciones, configuracion) |

---

## template.kml - Metadatos de Mision

Este archivo contiene SOLO la configuracion global de la mision, NO incluye waypoints.

### Estructura Completa

```xml
<?xml version="1.0" encoding="UTF-8"?>
<kml xmlns="http://www.opengis.net/kml/2.2"
     xmlns:wpml="http://www.uav.com/wpmz/1.0.2">
  <Document>
    <wpml:author>GeoFlight Planner</wpml:author>
    <wpml:createTime>1706745600000</wpml:createTime>
    <wpml:updateTime>1706745600000</wpml:updateTime>
    <wpml:missionConfig>
      <wpml:flyToWaylineMode>safely</wpml:flyToWaylineMode>
      <wpml:finishAction>goHome</wpml:finishAction>
      <wpml:exitOnRCLost>executeLostAction</wpml:exitOnRCLost>
      <wpml:executeRCLostAction>goBack</wpml:executeRCLostAction>
      <wpml:globalTransitionalSpeed>5</wpml:globalTransitionalSpeed>
      <wpml:droneInfo>
        <wpml:droneEnumValue>91</wpml:droneEnumValue>
        <wpml:droneSubEnumValue>0</wpml:droneSubEnumValue>
      </wpml:droneInfo>
    </wpml:missionConfig>
  </Document>
</kml>
```

### Tags de template.kml

| Tag | Tipo | Descripcion | Valores |
|-----|------|-------------|---------|
| `<wpml:author>` | string | Nombre de la aplicacion que genero la mision | Cualquier texto |
| `<wpml:createTime>` | long | Timestamp de creacion en milisegundos | Unix timestamp × 1000 |
| `<wpml:updateTime>` | long | Timestamp de actualizacion en milisegundos | Unix timestamp × 1000 |

#### missionConfig

| Tag | Tipo | Descripcion | Valores |
|-----|------|-------------|---------|
| `<wpml:flyToWaylineMode>` | enum | Como vuela al primer waypoint | `safely` (ascender primero), `pointToPoint` (directo) |
| `<wpml:finishAction>` | enum | Accion al terminar mision | `goHome`, `noAction`, `autoLand`, `gotoFirstWaypoint` |
| `<wpml:exitOnRCLost>` | enum | Que hacer si pierde senal RC | `executeLostAction`, `continue` |
| `<wpml:executeRCLostAction>` | enum | Accion si pierde RC | `goBack`, `hover`, `land` |
| `<wpml:globalTransitionalSpeed>` | float | Velocidad de transicion global (m/s) | 1.0 - 15.0 |

#### droneInfo

| Tag | Tipo | Descripcion | Valores |
|-----|------|-------------|---------|
| `<wpml:droneEnumValue>` | int | ID interno del modelo de drone | Mini 4 Pro: `91`, Mini 5 Pro: `100` |
| `<wpml:droneSubEnumValue>` | int | Sub-variante del drone | Generalmente `0` |

---

## waylines.wpml - Waypoints Ejecutables

Este archivo contiene todos los waypoints y sus acciones asociadas.

### Estructura General

```xml
<?xml version="1.0" encoding="UTF-8"?>
<kml xmlns="http://www.opengis.net/kml/2.2"
     xmlns:wpml="http://www.uav.com/wpmz/1.0.2">
  <Document>
    <wpml:missionConfig>
      <!-- Misma configuracion que template.kml -->
    </wpml:missionConfig>
    <Folder>
      <wpml:templateId>0</wpml:templateId>
      <wpml:executeHeightMode>relativeToStartPoint</wpml:executeHeightMode>
      <wpml:waylineId>0</wpml:waylineId>
      <wpml:distance>0</wpml:distance>
      <wpml:duration>0</wpml:duration>
      <wpml:autoFlightSpeed>5</wpml:autoFlightSpeed>

      <!-- Waypoints (Placemarks) -->
      <Placemark>...</Placemark>
      <Placemark>...</Placemark>
      ...
    </Folder>
  </Document>
</kml>
```

### Tags del Folder

| Tag | Tipo | Descripcion | Valores |
|-----|------|-------------|---------|
| `<wpml:templateId>` | int | ID de la plantilla | `0` |
| `<wpml:executeHeightMode>` | enum | Referencia de altitud | `relativeToStartPoint`, `relativeToGround`, `WGS84` |
| `<wpml:waylineId>` | int | ID de la ruta | `0` |
| `<wpml:distance>` | float | Distancia total (calculada por DJI) | `0` (se recalcula) |
| `<wpml:duration>` | float | Duracion estimada (calculada por DJI) | `0` (se recalcula) |
| `<wpml:autoFlightSpeed>` | float | Velocidad automatica (m/s) | 1.0 - 15.0 |

---

## Placemark - Estructura de Waypoint

Cada waypoint es un elemento `<Placemark>` dentro del `<Folder>`.

### Estructura Completa de Placemark

```xml
<Placemark>
  <Point>
    <coordinates>-74.0075,4.7110</coordinates>
  </Point>
  <wpml:index>0</wpml:index>
  <wpml:executeHeight>60</wpml:executeHeight>
  <wpml:waypointSpeed>8</wpml:waypointSpeed>
  <wpml:waypointHeadingParam>
    <wpml:waypointHeadingMode>followWayline</wpml:waypointHeadingMode>
    <wpml:waypointHeadingAngle>0</wpml:waypointHeadingAngle>
    <wpml:waypointPoiPoint>0.000000,0.000000,0.000000</wpml:waypointPoiPoint>
    <wpml:waypointHeadingAngleEnable>1</wpml:waypointHeadingAngleEnable>
    <wpml:waypointHeadingPathMode>followBadArc</wpml:waypointHeadingPathMode>
    <wpml:waypointHeadingPoiIndex>0</wpml:waypointHeadingPoiIndex>
  </wpml:waypointHeadingParam>
  <wpml:waypointTurnParam>
    <wpml:waypointTurnMode>toPointAndStopWithContinuityCurvature</wpml:waypointTurnMode>
    <wpml:waypointTurnDampingDist>0</wpml:waypointTurnDampingDist>
  </wpml:waypointTurnParam>
  <wpml:useStraightLine>0</wpml:useStraightLine>

  <!-- Action Groups (opcional) -->
  <wpml:actionGroup>...</wpml:actionGroup>

  <wpml:waypointGimbalHeadingParam>
    <wpml:waypointGimbalPitchAngle>0</wpml:waypointGimbalPitchAngle>
    <wpml:waypointGimbalYawAngle>0</wpml:waypointGimbalYawAngle>
  </wpml:waypointGimbalHeadingParam>
</Placemark>
```

### Tags del Placemark

#### Posicion y Basicos

| Tag | Tipo | Descripcion | Valores |
|-----|------|-------------|---------|
| `<coordinates>` | string | Coordenadas WGS84 | `longitud,latitud` |
| `<wpml:index>` | int | Indice del waypoint (0-based) | 0, 1, 2, ... |
| `<wpml:executeHeight>` | int | Altitud de vuelo en metros | **DEBE SER ENTERO** |
| `<wpml:waypointSpeed>` | float | Velocidad en este waypoint (m/s) | 1.0 - 15.0 |
| `<wpml:useStraightLine>` | int | Usar linea recta | `0` (curvas suaves), `1` (linea recta) |

#### waypointHeadingParam - Control de Heading

| Tag | Tipo | Descripcion | Valores |
|-----|------|-------------|---------|
| `<wpml:waypointHeadingMode>` | enum | Modo de orientacion | Ver tabla abajo |
| `<wpml:waypointHeadingAngle>` | float | Angulo fijo (solo en modo `smoothTransition`) | 0-359 |
| `<wpml:waypointPoiPoint>` | string | Punto de interes | `lon,lat,alt` |
| `<wpml:waypointHeadingAngleEnable>` | int | Habilitar angulo | `0` o `1` |
| `<wpml:waypointHeadingPathMode>` | enum | Modo de trayectoria | `followBadArc`, `clockwise`, `counterClockwise` |
| `<wpml:waypointHeadingPoiIndex>` | int | Indice POI | `0` |

**Modos de Heading:**

| Valor | Descripcion |
|-------|-------------|
| `followWayline` | Orientacion sigue la direccion del vuelo |
| `manually` | Angulo fijo definido por usuario |
| `smoothTransition` | Transicion suave entre angulos |
| `towardPOI` | Apunta hacia un punto de interes |

#### waypointTurnParam - Control de Giros

| Tag | Tipo | Descripcion | Valores |
|-----|------|-------------|---------|
| `<wpml:waypointTurnMode>` | enum | Modo de giro | Ver tabla abajo |
| `<wpml:waypointTurnDampingDist>` | float | Radio de suavizado (metros) | 0 - 50 |

**Modos de Giro:**

| Valor | Uso | Descripcion |
|-------|-----|-------------|
| `toPointAndStopWithContinuityCurvature` | Primer/Ultimo WP | Para en el waypoint, luego continua |
| `toPointAndPassWithContinuityCurvature` | Intermedios | Pasa suavemente sin detenerse |

#### waypointGimbalHeadingParam

| Tag | Tipo | Descripcion | Valores |
|-----|------|-------------|---------|
| `<wpml:waypointGimbalPitchAngle>` | float | Pitch del gimbal | **DEBE SER 0** para DJI Fly RC2 |
| `<wpml:waypointGimbalYawAngle>` | float | Yaw del gimbal | Generalmente `0` |

> **IMPORTANTE:** El pitch real del gimbal se controla via acciones `gimbalRotate`, NO via este tag.

---

## Action Groups - Acciones en Waypoints

Las acciones definen que hace el drone al llegar a cada waypoint.

### Estructura de Action Group

```xml
<wpml:actionGroup>
  <wpml:actionGroupId>1</wpml:actionGroupId>
  <wpml:actionGroupStartIndex>0</wpml:actionGroupStartIndex>
  <wpml:actionGroupEndIndex>0</wpml:actionGroupEndIndex>
  <wpml:actionGroupMode>parallel</wpml:actionGroupMode>
  <wpml:actionTrigger>
    <wpml:actionTriggerType>reachPoint</wpml:actionTriggerType>
  </wpml:actionTrigger>
  <wpml:action>
    <!-- Acciones individuales -->
  </wpml:action>
</wpml:actionGroup>
```

### Tags del Action Group

| Tag | Tipo | Descripcion | Valores |
|-----|------|-------------|---------|
| `<wpml:actionGroupId>` | int | ID unico del grupo | 1, 2, 3, ... |
| `<wpml:actionGroupStartIndex>` | int | Waypoint inicial | Indice del WP |
| `<wpml:actionGroupEndIndex>` | int | Waypoint final | Indice del WP |
| `<wpml:actionGroupMode>` | enum | Modo de ejecucion | `parallel` (simultaneo), `sequence` (secuencial) |
| `<wpml:actionTriggerType>` | enum | Cuando ejecutar | `reachPoint` (al llegar), `betweenAdjacentPoints` (entre WPs) |

---

## Tipos de Acciones

### 1. takePhoto - Tomar Foto

```xml
<wpml:action>
  <wpml:actionId>1</wpml:actionId>
  <wpml:actionActuatorFunc>takePhoto</wpml:actionActuatorFunc>
  <wpml:actionActuatorFuncParam>
    <wpml:payloadPositionIndex>0</wpml:payloadPositionIndex>
    <wpml:useGlobalPayloadLensIndex>0</wpml:useGlobalPayloadLensIndex>
  </wpml:actionActuatorFuncParam>
</wpml:action>
```

| Tag | Descripcion |
|-----|-------------|
| `payloadPositionIndex` | Indice de la camara (0 = principal) |
| `useGlobalPayloadLensIndex` | Usar configuracion global de lente |

### 2. gimbalRotate - Rotar Gimbal (Posicion Inicial)

```xml
<wpml:action>
  <wpml:actionId>2</wpml:actionId>
  <wpml:actionActuatorFunc>gimbalRotate</wpml:actionActuatorFunc>
  <wpml:actionActuatorFuncParam>
    <wpml:gimbalHeadingYawBase>aircraft</wpml:gimbalHeadingYawBase>
    <wpml:gimbalRotateMode>absoluteAngle</wpml:gimbalRotateMode>
    <wpml:gimbalPitchRotateEnable>1</wpml:gimbalPitchRotateEnable>
    <wpml:gimbalPitchRotateAngle>-90</wpml:gimbalPitchRotateAngle>
    <wpml:gimbalRollRotateEnable>1</wpml:gimbalRollRotateEnable>
    <wpml:gimbalRollRotateAngle>0</wpml:gimbalRollRotateAngle>
    <wpml:gimbalYawRotateEnable>0</wpml:gimbalYawRotateEnable>
    <wpml:gimbalYawRotateAngle>0</wpml:gimbalYawRotateAngle>
    <wpml:gimbalRotateTimeEnable>0</wpml:gimbalRotateTimeEnable>
    <wpml:gimbalRotateTime>0</wpml:gimbalRotateTime>
    <wpml:payloadPositionIndex>0</wpml:payloadPositionIndex>
  </wpml:actionActuatorFuncParam>
</wpml:action>
```

| Tag | Descripcion | Valores |
|-----|-------------|---------|
| `gimbalHeadingYawBase` | Referencia del yaw | `aircraft` (relativo al drone), `north` (absoluto) |
| `gimbalRotateMode` | Modo de rotacion | `absoluteAngle` (angulo fijo), `relativeAngle` (incremento) |
| `gimbalPitchRotateEnable` | Habilitar pitch | `0` o `1` |
| `gimbalPitchRotateAngle` | Angulo pitch | -90 (nadir) a 0 (horizonte) |
| `gimbalRollRotateEnable` | Habilitar roll | **DEBE SER 1** para compatibilidad |
| `gimbalRollRotateAngle` | Angulo roll | Generalmente `0` |
| `gimbalYawRotateEnable` | Habilitar yaw | `0` o `1` |
| `gimbalYawRotateAngle` | Angulo yaw | -180 a 180 |
| `gimbalRotateTimeEnable` | Usar tiempo | `0` |
| `gimbalRotateTime` | Duracion rotacion | `0` |

### 3. gimbalEvenlyRotate - Transicion Suave de Gimbal

```xml
<wpml:action>
  <wpml:actionId>3</wpml:actionId>
  <wpml:actionActuatorFunc>gimbalEvenlyRotate</wpml:actionActuatorFunc>
  <wpml:actionActuatorFuncParam>
    <wpml:gimbalPitchRotateAngle>-90</wpml:gimbalPitchRotateAngle>
    <wpml:gimbalRollRotateAngle>0</wpml:gimbalRollRotateAngle>
    <wpml:payloadPositionIndex>0</wpml:payloadPositionIndex>
  </wpml:actionActuatorFuncParam>
</wpml:action>
```

Esta accion hace una transicion suave del gimbal entre dos waypoints. El angulo especificado es el **angulo destino** al llegar al siguiente waypoint.

---

## Logica de Acciones por Waypoint

La distribucion de acciones sigue un patron especifico:

```
Waypoint 0 (Primero):
├── ActionGroup 1: takePhoto + gimbalRotate (posicion inicial)
└── ActionGroup 2: gimbalEvenlyRotate (transicion a WP1)

Waypoint 1..N-2 (Intermedios):
└── ActionGroup 2: gimbalEvenlyRotate (transicion al siguiente)

Waypoint N-1 (Ultimo):
└── (Sin acciones)
```

### Diagrama de Flujo

```
WP0 ──────────────────► WP1 ──────────────────► WP2 ──────────────────► WP3
 │                        │                        │                      │
 ├─ takePhoto            │                        │                      │
 ├─ gimbalRotate(-90)    │                        │                      │
 └─ gimbalEvenlyRotate ──┘                        │                      │
           (-90)          └─ gimbalEvenlyRotate ──┘                      │
                                    (-80)          └─ (sin acciones) ────┘
```

### Por que este patron?

1. **takePhoto solo en WP0**: DJI Fly usa el timer de fotos internamente, no necesita accion por waypoint
2. **gimbalRotate solo en WP0**: Establece la posicion inicial del gimbal
3. **gimbalEvenlyRotate en intermedios**: Permite transiciones suaves entre diferentes angulos de gimbal (ej: orbitas con pitch variable)
4. **Sin acciones en ultimo WP**: Ya no hay transicion, el drone termina la mision

---

## Valores Criticos para Compatibilidad

### Requisitos de DJI Fly RC2

| Campo | Requisito | Razon |
|-------|-----------|-------|
| `executeHeight` | **ENTERO** | DJI Fly falla con decimales |
| `waypointHeadingAngle` | `0` en modo `followWayline` | Valor ignorado pero debe ser 0 |
| `waypointGimbalPitchAngle` | `0` | El pitch real se controla via acciones |
| `useStraightLine` | `0` | Permite curvas suaves |
| `gimbalRollRotateEnable` | `1` | Requerido para compatibilidad |

---

## Identificadores de Drones (droneEnumValue)

| Drone | droneEnumValue | payloadEnumValue |
|-------|----------------|------------------|
| DJI Mini 4 Pro | 91 | 68 |
| DJI Mini 5 Pro | 100 | 80 |

---

## Ejemplo Completo Minimo

### template.kml

```xml
<?xml version="1.0" encoding="UTF-8"?>
<kml xmlns="http://www.opengis.net/kml/2.2" xmlns:wpml="http://www.uav.com/wpmz/1.0.2">
  <Document>
    <wpml:author>GeoFlight Planner</wpml:author>
    <wpml:createTime>1706745600000</wpml:createTime>
    <wpml:updateTime>1706745600000</wpml:updateTime>
    <wpml:missionConfig>
      <wpml:flyToWaylineMode>safely</wpml:flyToWaylineMode>
      <wpml:finishAction>goHome</wpml:finishAction>
      <wpml:exitOnRCLost>executeLostAction</wpml:exitOnRCLost>
      <wpml:executeRCLostAction>goBack</wpml:executeRCLostAction>
      <wpml:globalTransitionalSpeed>5</wpml:globalTransitionalSpeed>
      <wpml:droneInfo>
        <wpml:droneEnumValue>100</wpml:droneEnumValue>
        <wpml:droneSubEnumValue>0</wpml:droneSubEnumValue>
      </wpml:droneInfo>
    </wpml:missionConfig>
  </Document>
</kml>
```

### waylines.wpml (2 waypoints)

```xml
<?xml version="1.0" encoding="UTF-8"?>
<kml xmlns="http://www.opengis.net/kml/2.2" xmlns:wpml="http://www.uav.com/wpmz/1.0.2">
  <Document>
    <wpml:missionConfig>
      <wpml:flyToWaylineMode>safely</wpml:flyToWaylineMode>
      <wpml:finishAction>goHome</wpml:finishAction>
      <wpml:exitOnRCLost>executeLostAction</wpml:exitOnRCLost>
      <wpml:executeRCLostAction>goBack</wpml:executeRCLostAction>
      <wpml:globalTransitionalSpeed>5</wpml:globalTransitionalSpeed>
      <wpml:droneInfo>
        <wpml:droneEnumValue>100</wpml:droneEnumValue>
        <wpml:droneSubEnumValue>0</wpml:droneSubEnumValue>
      </wpml:droneInfo>
    </wpml:missionConfig>
    <Folder>
      <wpml:templateId>0</wpml:templateId>
      <wpml:executeHeightMode>relativeToStartPoint</wpml:executeHeightMode>
      <wpml:waylineId>0</wpml:waylineId>
      <wpml:distance>0</wpml:distance>
      <wpml:duration>0</wpml:duration>
      <wpml:autoFlightSpeed>5</wpml:autoFlightSpeed>

      <!-- Waypoint 0 (Primero) -->
      <Placemark>
        <Point>
          <coordinates>-74.0075,4.7110</coordinates>
        </Point>
        <wpml:index>0</wpml:index>
        <wpml:executeHeight>60</wpml:executeHeight>
        <wpml:waypointSpeed>5</wpml:waypointSpeed>
        <wpml:waypointHeadingParam>
          <wpml:waypointHeadingMode>followWayline</wpml:waypointHeadingMode>
          <wpml:waypointHeadingAngle>0</wpml:waypointHeadingAngle>
          <wpml:waypointPoiPoint>0.000000,0.000000,0.000000</wpml:waypointPoiPoint>
          <wpml:waypointHeadingAngleEnable>1</wpml:waypointHeadingAngleEnable>
          <wpml:waypointHeadingPathMode>followBadArc</wpml:waypointHeadingPathMode>
          <wpml:waypointHeadingPoiIndex>0</wpml:waypointHeadingPoiIndex>
        </wpml:waypointHeadingParam>
        <wpml:waypointTurnParam>
          <wpml:waypointTurnMode>toPointAndStopWithContinuityCurvature</wpml:waypointTurnMode>
          <wpml:waypointTurnDampingDist>0</wpml:waypointTurnDampingDist>
        </wpml:waypointTurnParam>
        <wpml:useStraightLine>0</wpml:useStraightLine>
        <wpml:actionGroup>
          <wpml:actionGroupId>1</wpml:actionGroupId>
          <wpml:actionGroupStartIndex>0</wpml:actionGroupStartIndex>
          <wpml:actionGroupEndIndex>0</wpml:actionGroupEndIndex>
          <wpml:actionGroupMode>parallel</wpml:actionGroupMode>
          <wpml:actionTrigger>
            <wpml:actionTriggerType>reachPoint</wpml:actionTriggerType>
          </wpml:actionTrigger>
          <wpml:action>
            <wpml:actionId>1</wpml:actionId>
            <wpml:actionActuatorFunc>takePhoto</wpml:actionActuatorFunc>
            <wpml:actionActuatorFuncParam>
              <wpml:payloadPositionIndex>0</wpml:payloadPositionIndex>
              <wpml:useGlobalPayloadLensIndex>0</wpml:useGlobalPayloadLensIndex>
            </wpml:actionActuatorFuncParam>
          </wpml:action>
          <wpml:action>
            <wpml:actionId>2</wpml:actionId>
            <wpml:actionActuatorFunc>gimbalRotate</wpml:actionActuatorFunc>
            <wpml:actionActuatorFuncParam>
              <wpml:gimbalHeadingYawBase>aircraft</wpml:gimbalHeadingYawBase>
              <wpml:gimbalRotateMode>absoluteAngle</wpml:gimbalRotateMode>
              <wpml:gimbalPitchRotateEnable>1</wpml:gimbalPitchRotateEnable>
              <wpml:gimbalPitchRotateAngle>-90</wpml:gimbalPitchRotateAngle>
              <wpml:gimbalRollRotateEnable>1</wpml:gimbalRollRotateEnable>
              <wpml:gimbalRollRotateAngle>0</wpml:gimbalRollRotateAngle>
              <wpml:gimbalYawRotateEnable>0</wpml:gimbalYawRotateEnable>
              <wpml:gimbalYawRotateAngle>0</wpml:gimbalYawRotateAngle>
              <wpml:gimbalRotateTimeEnable>0</wpml:gimbalRotateTimeEnable>
              <wpml:gimbalRotateTime>0</wpml:gimbalRotateTime>
              <wpml:payloadPositionIndex>0</wpml:payloadPositionIndex>
            </wpml:actionActuatorFuncParam>
          </wpml:action>
        </wpml:actionGroup>
        <wpml:actionGroup>
          <wpml:actionGroupId>2</wpml:actionGroupId>
          <wpml:actionGroupStartIndex>0</wpml:actionGroupStartIndex>
          <wpml:actionGroupEndIndex>1</wpml:actionGroupEndIndex>
          <wpml:actionGroupMode>parallel</wpml:actionGroupMode>
          <wpml:actionTrigger>
            <wpml:actionTriggerType>reachPoint</wpml:actionTriggerType>
          </wpml:actionTrigger>
          <wpml:action>
            <wpml:actionId>3</wpml:actionId>
            <wpml:actionActuatorFunc>gimbalEvenlyRotate</wpml:actionActuatorFunc>
            <wpml:actionActuatorFuncParam>
              <wpml:gimbalPitchRotateAngle>-90</wpml:gimbalPitchRotateAngle>
              <wpml:gimbalRollRotateAngle>0</wpml:gimbalRollRotateAngle>
              <wpml:payloadPositionIndex>0</wpml:payloadPositionIndex>
            </wpml:actionActuatorFuncParam>
          </wpml:action>
        </wpml:actionGroup>
        <wpml:waypointGimbalHeadingParam>
          <wpml:waypointGimbalPitchAngle>0</wpml:waypointGimbalPitchAngle>
          <wpml:waypointGimbalYawAngle>0</wpml:waypointGimbalYawAngle>
        </wpml:waypointGimbalHeadingParam>
      </Placemark>

      <!-- Waypoint 1 (Ultimo) -->
      <Placemark>
        <Point>
          <coordinates>-74.0070,4.7120</coordinates>
        </Point>
        <wpml:index>1</wpml:index>
        <wpml:executeHeight>60</wpml:executeHeight>
        <wpml:waypointSpeed>5</wpml:waypointSpeed>
        <wpml:waypointHeadingParam>
          <wpml:waypointHeadingMode>followWayline</wpml:waypointHeadingMode>
          <wpml:waypointHeadingAngle>0</wpml:waypointHeadingAngle>
          <wpml:waypointPoiPoint>0.000000,0.000000,0.000000</wpml:waypointPoiPoint>
          <wpml:waypointHeadingAngleEnable>1</wpml:waypointHeadingAngleEnable>
          <wpml:waypointHeadingPathMode>followBadArc</wpml:waypointHeadingPathMode>
          <wpml:waypointHeadingPoiIndex>0</wpml:waypointHeadingPoiIndex>
        </wpml:waypointHeadingParam>
        <wpml:waypointTurnParam>
          <wpml:waypointTurnMode>toPointAndStopWithContinuityCurvature</wpml:waypointTurnMode>
          <wpml:waypointTurnDampingDist>0</wpml:waypointTurnDampingDist>
        </wpml:waypointTurnParam>
        <wpml:useStraightLine>0</wpml:useStraightLine>
        <!-- Sin acciones en el ultimo waypoint -->
        <wpml:waypointGimbalHeadingParam>
          <wpml:waypointGimbalPitchAngle>0</wpml:waypointGimbalPitchAngle>
          <wpml:waypointGimbalYawAngle>0</wpml:waypointGimbalYawAngle>
        </wpml:waypointGimbalHeadingParam>
      </Placemark>

    </Folder>
  </Document>
</kml>
```

---

## Implementacion en Codigo

### Archivos Relevantes

| Archivo | Descripcion |
|---------|-------------|
| `src/worker/services/wpmlBuilder.ts` | Genera template.kml y waylines.wpml |
| `src/worker/services/kmzPackager.ts` | Empaqueta archivos en ZIP (.kmz) |

### Flujo de Generacion

```typescript
// 1. Crear builder con modelo de drone y waypoints
const builder = new WPMLBuilder('mini_5_pro', waypoints);

// 2. Generar contenido XML
const templateKml = builder.buildTemplateKml('goHome');
const waylinesWpml = builder.buildWaylinesWpml(-90);

// 3. Empaquetar en KMZ
const zip = new JSZip();
zip.file('wpmz/template.kml', templateKml);
zip.file('wpmz/waylines.wpml', waylinesWpml);

// 4. Generar blob
const kmzBlob = await zip.generateAsync({
  type: 'blob',
  compression: 'DEFLATE',
  compressionOptions: { level: 6 }
});
```

---

*Documentacion generada para GeoFlight Planner v2.0*
