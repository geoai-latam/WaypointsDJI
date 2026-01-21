# Estructura Completa del Formato KMZ/WPML para DJI Waypoints

## 📁 Estructura del Archivo KMZ

El archivo `.kmz` es un archivo ZIP que contiene:

```
mission.kmz
├── wpmz/
│   ├── template.kml      # Plantilla de misión (opcional para DJI Fly)
│   └── waylines.wpml     # Archivo ejecutable con waypoints
```

**Namespace XML:**
```xml
xmlns="http://www.opengis.net/kml/2.2"
xmlns:wpml="http://www.dji.com/wpmz/1.0.2"
```

> **Nota:** La versión del namespace puede variar (1.0.2, 1.0.5, 1.0.6). El Mini 4 Pro y Mini 5 Pro usan típicamente `1.0.2`.

---

## 📋 Archivo template.kml

El `template.kml` es la plantilla que define parámetros globales. DJI Pilot 2 puede generar el `waylines.wpml` a partir de este archivo.

```xml
<?xml version="1.0" encoding="UTF-8"?>
<kml xmlns="http://www.opengis.net/kml/2.2" xmlns:wpml="http://www.dji.com/wpmz/1.0.2">
  <Document>
    <!-- Información de creación -->
    <wpml:author>fly</wpml:author>
    <wpml:createTime>1702051864938</wpml:createTime>
    <wpml:updateTime>1702051864938</wpml:updateTime>
    
    <!-- Configuración de la misión -->
    <wpml:missionConfig>
      <!-- Ver sección missionConfig -->
    </wpml:missionConfig>
  </Document>
</kml>
```

---

## 📋 Archivo waylines.wpml

El `waylines.wpml` es el archivo ejecutable que el dron interpreta directamente.

```xml
<?xml version="1.0" encoding="UTF-8"?>
<kml xmlns="http://www.opengis.net/kml/2.2" xmlns:wpml="http://www.dji.com/wpmz/1.0.2">
  <Document>
    <wpml:missionConfig>
      <!-- Configuración global de la misión -->
    </wpml:missionConfig>
    
    <Folder>
      <!-- Definición de la ruta con waypoints -->
    </Folder>
  </Document>
</kml>
```

---

## ⚙️ Elemento: missionConfig

Define los parámetros globales de la misión.

```xml
<wpml:missionConfig>
  <wpml:flyToWaylineMode>safely</wpml:flyToWaylineMode>
  <wpml:finishAction>noAction</wpml:finishAction>
  <wpml:exitOnRCLost>executeLostAction</wpml:exitOnRCLost>
  <wpml:executeRCLostAction>hover</wpml:executeRCLostAction>
  <wpml:takeOffSecurityHeight>20</wpml:takeOffSecurityHeight>
  <wpml:globalTransitionalSpeed>2.5</wpml:globalTransitionalSpeed>
  <wpml:globalRTHHeight>100</wpml:globalRTHHeight>
  
  <!-- Información del dron -->
  <wpml:droneInfo>
    <wpml:droneEnumValue>68</wpml:droneEnumValue>
    <wpml:droneSubEnumValue>0</wpml:droneSubEnumValue>
  </wpml:droneInfo>
  
  <!-- Información del payload/cámara (opcional para consumer drones) -->
  <wpml:payloadInfo>
    <wpml:payloadEnumValue>66</wpml:payloadEnumValue>
    <wpml:payloadPositionIndex>0</wpml:payloadPositionIndex>
  </wpml:payloadInfo>
</wpml:missionConfig>
```

### Parámetros de missionConfig

| Elemento | Descripción | Valores |
|----------|-------------|---------|
| `flyToWaylineMode` | Modo de vuelo al primer waypoint | `safely`: Asciende primero, luego vuela horizontal. `pointToPoint`: Vuela en línea recta |
| `finishAction` | Acción al terminar la misión | `goHome`, `noAction`, `autoLand`, `gotoFirstWaypoint` |
| `exitOnRCLost` | Comportamiento si se pierde señal RC | `goContinue`: Continúa la misión. `executeLostAction`: Ejecuta la acción definida |
| `executeRCLostAction` | Acción específica al perder señal | `goBack`, `landing`, `hover` |
| `takeOffSecurityHeight` | Altura segura de despegue (m) | Rango: 1.2-1500 (RC), 8-1500 (Dock) |
| `globalTransitionalSpeed` | Velocidad de transición global (m/s) | Rango: 0-15 |
| `globalRTHHeight` | Altura de retorno a casa (m) | Depende del modelo |

---

## 🚁 Códigos de Drones (droneEnumValue)

| droneEnumValue | droneSubEnumValue | Modelo |
|----------------|-------------------|--------|
| 60 | 0 | M300 RTK |
| 67 | 0 | M30 |
| 67 | 1 | M30T |
| 68 | 0 | **DJI Mini 4 Pro** |
| 68 | 0 | **DJI Mini 5 Pro** (probable) |
| 77 | 0 | Mavic 3E |
| 77 | 1 | Mavic 3T |
| 77 | 2 | Mavic 3M |
| 89 | 0 | M350 RTK |
| 91 | 0 | Matrice 3D |
| 91 | 1 | Matrice 3TD |

> **Nota:** El Mini 5 Pro probablemente usa `droneEnumValue=68` ya que es el sucesor del Mini 4 Pro.

---

## 📷 Códigos de Payload/Cámara (payloadEnumValue)

| payloadEnumValue | Descripción |
|------------------|-------------|
| 42 | H20 |
| 43 | H20T |
| 52 | M30 Camera |
| 53 | M30T Camera |
| 61 | H20N |
| 66 | Mavic 3E Camera |
| 67 | Mavic 3T Camera |
| 68 | Mavic 3M Camera |
| 80 | Matrice 3D Camera |
| 81 | Matrice 3TD Camera |
| 82 | H30 |
| 83 | H30T |
| 65534 | PSDK Payload Device |

---

## 📁 Elemento: Folder (Wayline)

Define una ruta de vuelo completa.

```xml
<Folder>
  <wpml:templateId>0</wpml:templateId>
  <wpml:executeHeightMode>relativeToStartPoint</wpml:executeHeightMode>
  <wpml:waylineId>0</wpml:waylineId>
  <wpml:distance>1234.5</wpml:distance>
  <wpml:duration>300</wpml:duration>
  <wpml:autoFlightSpeed>2.5</wpml:autoFlightSpeed>
  
  <!-- Waypoints (Placemarks) -->
  <Placemark>...</Placemark>
  <Placemark>...</Placemark>
</Folder>
```

### Parámetros del Folder

| Elemento | Descripción | Valores |
|----------|-------------|---------|
| `templateId` | ID único de plantilla | Entero incremental desde 0 |
| `executeHeightMode` | Modo de referencia de altura | `relativeToStartPoint`, `WGS84`, `aboveGroundLevel` |
| `waylineId` | ID único de la ruta | Entero incremental desde 0 |
| `distance` | Distancia total (m) | Calculado automáticamente |
| `duration` | Duración estimada (s) | Calculado automáticamente |
| `autoFlightSpeed` | Velocidad de vuelo automático (m/s) | Rango: 0 - velocidad máxima del dron |

---

## 📍 Elemento: Placemark (Waypoint)

Define un waypoint individual con todas sus propiedades.

```xml
<Placemark>
  <Point>
    <coordinates>-72.9487645,5.956344190,0</coordinates>
  </Point>
  
  <wpml:index>0</wpml:index>
  <wpml:executeHeight>50</wpml:executeHeight>
  <wpml:waypointSpeed>2.5</wpml:waypointSpeed>
  <wpml:ellipsoidHeight>100</wpml:ellipsoidHeight>
  <wpml:height>50</wpml:height>
  <wpml:useGlobalHeight>1</wpml:useGlobalHeight>
  <wpml:useGlobalSpeed>1</wpml:useGlobalSpeed>
  <wpml:useGlobalHeadingParam>0</wpml:useGlobalHeadingParam>
  <wpml:useGlobalTurnParam>0</wpml:useGlobalTurnParam>
  <wpml:useStraightLine>0</wpml:useStraightLine>
  
  <!-- Parámetros de orientación -->
  <wpml:waypointHeadingParam>
    ...
  </wpml:waypointHeadingParam>
  
  <!-- Parámetros de giro -->
  <wpml:waypointTurnParam>
    ...
  </wpml:waypointTurnParam>
  
  <!-- Grupos de acciones -->
  <wpml:actionGroup>
    ...
  </wpml:actionGroup>
</Placemark>
```

### Parámetros del Waypoint

| Elemento | Descripción | Valores |
|----------|-------------|---------|
| `coordinates` | Coordenadas (lon,lat,alt) | Formato: `longitud,latitud,altitud` |
| `index` | Índice del waypoint | Entero desde 0 |
| `executeHeight` | Altura de ejecución (m) | Relativo al modo de altura |
| `waypointSpeed` | Velocidad en este waypoint (m/s) | 0 - velocidad máxima |
| `ellipsoidHeight` | Altura elipsoidal WGS84 (m) | Usado con executeHeightMode=WGS84 |
| `useGlobalHeight` | Usar altura global | 0=usar local, 1=usar global |
| `useGlobalSpeed` | Usar velocidad global | 0=usar local, 1=usar global |
| `useStraightLine` | Trayectoria en línea recta | 0=curva, 1=línea recta |

---

## 🧭 Parámetros de Orientación (waypointHeadingParam)

Controla la orientación del dron durante el vuelo.

```xml
<wpml:waypointHeadingParam>
  <wpml:waypointHeadingMode>smoothTransition</wpml:waypointHeadingMode>
  <wpml:waypointHeadingAngle>0</wpml:waypointHeadingAngle>
  <wpml:waypointPoiPoint>0.000000,0.000000,0.000000</wpml:waypointPoiPoint>
  <wpml:waypointHeadingAngleEnable>1</wpml:waypointHeadingAngleEnable>
  <wpml:waypointHeadingPathMode>followBadArc</wpml:waypointHeadingPathMode>
  <wpml:waypointHeadingPoiIndex>0</wpml:waypointHeadingPoiIndex>
</wpml:waypointHeadingParam>
```

### Modos de Orientación (waypointHeadingMode)

| Valor | Descripción |
|-------|-------------|
| `followWayline` | El dron sigue la dirección del curso |
| `manually` | Control manual durante el vuelo |
| `fixed` | Mantiene el ángulo yaw actual |
| `smoothTransition` | Transición suave al ángulo objetivo |
| `towardPOI` | Orientado hacia un punto de interés |

### Parámetros de Orientación

| Elemento | Descripción | Valores |
|----------|-------------|---------|
| `waypointHeadingAngle` | Ángulo de orientación (°) | -180 a 180 |
| `waypointHeadingAngleEnable` | Habilitar ángulo específico | 0=no, 1=sí |
| `waypointHeadingPathMode` | Dirección de rotación | `clockwise`, `counterClockwise`, `followBadArc` |
| `waypointPoiPoint` | Punto de interés (lat,lon,alt) | Solo para towardPOI |

---

## 🔄 Parámetros de Giro (waypointTurnParam)

Controla cómo el dron realiza los giros entre waypoints.

```xml
<wpml:waypointTurnParam>
  <wpml:waypointTurnMode>toPointAndStopWithContinuityCurvature</wpml:waypointTurnMode>
  <wpml:waypointTurnDampingDist>0</wpml:waypointTurnDampingDist>
</wpml:waypointTurnParam>
```

### Modos de Giro (waypointTurnMode)

| Valor | Descripción |
|-------|-------------|
| `coordinateTurn` | Giro coordinado, sin detenerse, gira antes |
| `toPointAndStopWithDiscontinuityCurvature` | Línea recta, el dron se detiene en el punto |
| `toPointAndStopWithContinuityCurvature` | **Curva, el dron se detiene en el punto** |
| `toPointAndPassWithContinuityCurvature` | **Curva, el dron NO se detiene en el punto** |

| Elemento | Descripción |
|----------|-------------|
| `waypointTurnDampingDist` | Distancia de amortiguación del giro (m) |

---

## 🎬 Grupos de Acciones (actionGroup)

Define acciones a ejecutar en los waypoints.

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
    <wpml:actionId>1</wpml:actionId>
    <wpml:actionActuatorFunc>takePhoto</wpml:actionActuatorFunc>
    <wpml:actionActuatorFuncParam>
      <!-- Parámetros específicos de la acción -->
    </wpml:actionActuatorFuncParam>
  </wpml:action>
</wpml:actionGroup>
```

### Parámetros del actionGroup

| Elemento | Descripción | Valores |
|----------|-------------|---------|
| `actionGroupId` | ID único del grupo | Entero incremental |
| `actionGroupStartIndex` | Waypoint inicial | Índice del waypoint |
| `actionGroupEndIndex` | Waypoint final | Índice del waypoint |
| `actionGroupMode` | Modo de ejecución | `sequence`: secuencial, `parallel`: paralelo |

### Tipos de Trigger (actionTriggerType)

| Valor | Descripción |
|-------|-------------|
| `reachPoint` | Se ejecuta al llegar al waypoint |
| `betweenAdjacentPoints` | Durante el segmento de vuelo |
| `multipleTiming` | Intervalo de tiempo |
| `multipleDistance` | Intervalo de distancia |

---

## 📸 Tipos de Acciones (actionActuatorFunc)

### takePhoto - Tomar Foto

```xml
<wpml:action>
  <wpml:actionId>1</wpml:actionId>
  <wpml:actionActuatorFunc>takePhoto</wpml:actionActuatorFunc>
  <wpml:actionActuatorFuncParam>
    <wpml:payloadPositionIndex>0</wpml:payloadPositionIndex>
    <wpml:fileSuffix>point1</wpml:fileSuffix>
    <wpml:payloadLensIndex>wide</wpml:payloadLensIndex>
    <wpml:useGlobalPayloadLensIndex>0</wpml:useGlobalPayloadLensIndex>
  </wpml:actionActuatorFuncParam>
</wpml:action>
```

### startRecord / stopRecord - Grabar Video

```xml
<wpml:action>
  <wpml:actionId>2</wpml:actionId>
  <wpml:actionActuatorFunc>startRecord</wpml:actionActuatorFunc>
  <wpml:actionActuatorFuncParam>
    <wpml:payloadPositionIndex>0</wpml:payloadPositionIndex>
    <wpml:payloadLensIndex>wide</wpml:payloadLensIndex>
  </wpml:actionActuatorFuncParam>
</wpml:action>
```

### gimbalRotate - Rotar Gimbal

```xml
<wpml:action>
  <wpml:actionId>3</wpml:actionId>
  <wpml:actionActuatorFunc>gimbalRotate</wpml:actionActuatorFunc>
  <wpml:actionActuatorFuncParam>
    <wpml:gimbalHeadingYawBase>aircraft</wpml:gimbalHeadingYawBase>
    <wpml:gimbalRotateMode>absoluteAngle</wpml:gimbalRotateMode>
    <wpml:gimbalPitchRotateEnable>1</wpml:gimbalPitchRotateEnable>
    <wpml:gimbalPitchRotateAngle>-90</wpml:gimbalPitchRotateAngle>
    <wpml:gimbalRollRotateEnable>0</wpml:gimbalRollRotateEnable>
    <wpml:gimbalRollRotateAngle>0</wpml:gimbalRollRotateAngle>
    <wpml:gimbalYawRotateEnable>0</wpml:gimbalYawRotateEnable>
    <wpml:gimbalYawRotateAngle>0</wpml:gimbalYawRotateAngle>
    <wpml:gimbalRotateTimeEnable>0</wpml:gimbalRotateTimeEnable>
    <wpml:gimbalRotateTime>0</wpml:gimbalRotateTime>
    <wpml:payloadPositionIndex>0</wpml:payloadPositionIndex>
  </wpml:actionActuatorFuncParam>
</wpml:action>
```

### gimbalEvenlyRotate - Rotación Suave del Gimbal

Para rotar el pitch del gimbal uniformemente durante el segmento de vuelo.

```xml
<wpml:action>
  <wpml:actionId>4</wpml:actionId>
  <wpml:actionActuatorFunc>gimbalEvenlyRotate</wpml:actionActuatorFunc>
  <wpml:actionActuatorFuncParam>
    <wpml:gimbalPitchRotateAngle>-90</wpml:gimbalPitchRotateAngle>
    <wpml:payloadPositionIndex>0</wpml:payloadPositionIndex>
  </wpml:actionActuatorFuncParam>
</wpml:action>
```

### rotateYaw - Rotar Yaw del Dron

```xml
<wpml:action>
  <wpml:actionId>5</wpml:actionId>
  <wpml:actionActuatorFunc>rotateYaw</wpml:actionActuatorFunc>
  <wpml:actionActuatorFuncParam>
    <wpml:aircraftYawRotateMode>absoluteAngle</wpml:aircraftYawRotateMode>
    <wpml:aircraftYawRotateAngle>90</wpml:aircraftYawRotateAngle>
    <wpml:aircraftYawPathMode>clockwise</wpml:aircraftYawPathMode>
  </wpml:actionActuatorFuncParam>
</wpml:action>
```

### hover - Hover/Pausar

```xml
<wpml:action>
  <wpml:actionId>6</wpml:actionId>
  <wpml:actionActuatorFunc>hover</wpml:actionActuatorFunc>
  <wpml:actionActuatorFuncParam>
    <wpml:hoverTime>5</wpml:hoverTime>
  </wpml:actionActuatorFuncParam>
</wpml:action>
```

### focus - Enfocar

```xml
<wpml:action>
  <wpml:actionId>7</wpml:actionId>
  <wpml:actionActuatorFunc>focus</wpml:actionActuatorFunc>
  <wpml:actionActuatorFuncParam>
    <wpml:payloadPositionIndex>0</wpml:payloadPositionIndex>
    <wpml:focusMode>1</wpml:focusMode>
    <wpml:focusX>0.5</wpml:focusX>
    <wpml:focusY>0.5</wpml:focusY>
  </wpml:actionActuatorFuncParam>
</wpml:action>
```

### zoom - Zoom

```xml
<wpml:action>
  <wpml:actionId>8</wpml:actionId>
  <wpml:actionActuatorFunc>zoom</wpml:actionActuatorFunc>
  <wpml:actionActuatorFuncParam>
    <wpml:payloadPositionIndex>0</wpml:payloadPositionIndex>
    <wpml:focalLength>24</wpml:focalLength>
  </wpml:actionActuatorFuncParam>
</wpml:action>
```

### customDirName - Crear Carpeta

```xml
<wpml:action>
  <wpml:actionId>9</wpml:actionId>
  <wpml:actionActuatorFunc>customDirName</wpml:actionActuatorFunc>
  <wpml:actionActuatorFuncParam>
    <wpml:directoryName>MiCarpeta</wpml:directoryName>
  </wpml:actionActuatorFuncParam>
</wpml:action>
```

### panoShot - Panorama (M30/M3D)

```xml
<wpml:action>
  <wpml:actionId>10</wpml:actionId>
  <wpml:actionActuatorFunc>panoShot</wpml:actionActuatorFunc>
  <wpml:actionActuatorFuncParam>
    <wpml:payloadPositionIndex>0</wpml:payloadPositionIndex>
  </wpml:actionActuatorFuncParam>
</wpml:action>
```

---

## 📋 Resumen de Todas las Acciones

| actionActuatorFunc | Descripción | Uso Principal |
|--------------------|-------------|---------------|
| `takePhoto` | Tomar una foto | Fotogrametría, captura |
| `startRecord` | Iniciar grabación de video | Video continuo |
| `stopRecord` | Detener grabación de video | Fin de grabación |
| `focus` | Enfocar la cámara | Ajuste de enfoque |
| `zoom` | Ajustar zoom | Zoom digital/óptico |
| `customDirName` | Crear carpeta nueva | Organización de archivos |
| `gimbalRotate` | Rotar gimbal | Control de cámara |
| `rotateYaw` | Rotar dron en yaw | Orientación del dron |
| `hover` | Hover y esperar | Pausas, estabilización |
| `gimbalEvenlyRotate` | Rotación suave del gimbal | Transiciones suaves |
| `accurateShoot` | AI Spot-Check (deprecado) | Inspección AI |
| `orientedShoot` | Foto en ángulo fijo | Inspección |
| `panoShot` | Panorama | Fotografía panorámica |

---

## 📐 Parámetros del Gimbal

| Parámetro | Descripción | Valores |
|-----------|-------------|---------|
| `gimbalHeadingYawBase` | Base de referencia yaw | `aircraft`, `north` |
| `gimbalRotateMode` | Modo de rotación | `absoluteAngle`, `relativeAngle` |
| `gimbalPitchRotateEnable` | Habilitar rotación pitch | 0=no, 1=sí |
| `gimbalPitchRotateAngle` | Ángulo pitch (°) | -90 a 30 (típico) |
| `gimbalRollRotateEnable` | Habilitar rotación roll | 0=no, 1=sí |
| `gimbalRollRotateAngle` | Ángulo roll (°) | Depende del modelo |
| `gimbalYawRotateEnable` | Habilitar rotación yaw | 0=no, 1=sí |
| `gimbalYawRotateAngle` | Ángulo yaw (°) | -180 a 180 |
| `gimbalRotateTimeEnable` | Habilitar tiempo de rotación | 0=no, 1=sí |
| `gimbalRotateTime` | Tiempo de rotación (s) | > 0 |

---

## 🔧 Ejemplo Completo: Misión de Mapeo

```xml
<?xml version="1.0" encoding="UTF-8"?>
<kml xmlns="http://www.opengis.net/kml/2.2" xmlns:wpml="http://www.dji.com/wpmz/1.0.2">
  <Document>
    <wpml:missionConfig>
      <wpml:flyToWaylineMode>safely</wpml:flyToWaylineMode>
      <wpml:finishAction>goHome</wpml:finishAction>
      <wpml:exitOnRCLost>executeLostAction</wpml:exitOnRCLost>
      <wpml:executeRCLostAction>hover</wpml:executeRCLostAction>
      <wpml:takeOffSecurityHeight>20</wpml:takeOffSecurityHeight>
      <wpml:globalTransitionalSpeed>5</wpml:globalTransitionalSpeed>
      <wpml:droneInfo>
        <wpml:droneEnumValue>68</wpml:droneEnumValue>
        <wpml:droneSubEnumValue>0</wpml:droneSubEnumValue>
      </wpml:droneInfo>
    </wpml:missionConfig>
    
    <Folder>
      <wpml:templateId>0</wpml:templateId>
      <wpml:executeHeightMode>relativeToStartPoint</wpml:executeHeightMode>
      <wpml:waylineId>0</wpml:waylineId>
      <wpml:autoFlightSpeed>3</wpml:autoFlightSpeed>
      
      <!-- Waypoint 1: Inicio con foto -->
      <Placemark>
        <Point>
          <coordinates>-72.9487645,5.9563441,0</coordinates>
        </Point>
        <wpml:index>0</wpml:index>
        <wpml:executeHeight>50</wpml:executeHeight>
        <wpml:waypointSpeed>3</wpml:waypointSpeed>
        <wpml:waypointHeadingParam>
          <wpml:waypointHeadingMode>followWayline</wpml:waypointHeadingMode>
        </wpml:waypointHeadingParam>
        <wpml:waypointTurnParam>
          <wpml:waypointTurnMode>toPointAndStopWithContinuityCurvature</wpml:waypointTurnMode>
          <wpml:waypointTurnDampingDist>0</wpml:waypointTurnDampingDist>
        </wpml:waypointTurnParam>
        <wpml:useStraightLine>0</wpml:useStraightLine>
        
        <!-- Acción: Gimbal a -90° -->
        <wpml:actionGroup>
          <wpml:actionGroupId>1</wpml:actionGroupId>
          <wpml:actionGroupStartIndex>0</wpml:actionGroupStartIndex>
          <wpml:actionGroupEndIndex>0</wpml:actionGroupEndIndex>
          <wpml:actionGroupMode>sequence</wpml:actionGroupMode>
          <wpml:actionTrigger>
            <wpml:actionTriggerType>reachPoint</wpml:actionTriggerType>
          </wpml:actionTrigger>
          <wpml:action>
            <wpml:actionId>1</wpml:actionId>
            <wpml:actionActuatorFunc>gimbalRotate</wpml:actionActuatorFunc>
            <wpml:actionActuatorFuncParam>
              <wpml:gimbalHeadingYawBase>aircraft</wpml:gimbalHeadingYawBase>
              <wpml:gimbalRotateMode>absoluteAngle</wpml:gimbalRotateMode>
              <wpml:gimbalPitchRotateEnable>1</wpml:gimbalPitchRotateEnable>
              <wpml:gimbalPitchRotateAngle>-90</wpml:gimbalPitchRotateAngle>
              <wpml:gimbalRollRotateEnable>0</wpml:gimbalRollRotateEnable>
              <wpml:gimbalRollRotateAngle>0</wpml:gimbalRollRotateAngle>
              <wpml:gimbalYawRotateEnable>0</wpml:gimbalYawRotateEnable>
              <wpml:gimbalYawRotateAngle>0</wpml:gimbalYawRotateAngle>
              <wpml:gimbalRotateTimeEnable>0</wpml:gimbalRotateTimeEnable>
              <wpml:gimbalRotateTime>0</wpml:gimbalRotateTime>
              <wpml:payloadPositionIndex>0</wpml:payloadPositionIndex>
            </wpml:actionActuatorFuncParam>
          </wpml:action>
        </wpml:actionGroup>
        
        <!-- Acción: Tomar foto -->
        <wpml:actionGroup>
          <wpml:actionGroupId>2</wpml:actionGroupId>
          <wpml:actionGroupStartIndex>0</wpml:actionGroupStartIndex>
          <wpml:actionGroupEndIndex>0</wpml:actionGroupEndIndex>
          <wpml:actionGroupMode>sequence</wpml:actionGroupMode>
          <wpml:actionTrigger>
            <wpml:actionTriggerType>reachPoint</wpml:actionTriggerType>
          </wpml:actionTrigger>
          <wpml:action>
            <wpml:actionId>2</wpml:actionId>
            <wpml:actionActuatorFunc>takePhoto</wpml:actionActuatorFunc>
            <wpml:actionActuatorFuncParam>
              <wpml:payloadPositionIndex>0</wpml:payloadPositionIndex>
            </wpml:actionActuatorFuncParam>
          </wpml:action>
        </wpml:actionGroup>
      </Placemark>
      
      <!-- Waypoint 2: Continuación -->
      <Placemark>
        <Point>
          <coordinates>-72.9486645,5.9567601,0</coordinates>
        </Point>
        <wpml:index>1</wpml:index>
        <wpml:executeHeight>50</wpml:executeHeight>
        <wpml:waypointSpeed>3</wpml:waypointSpeed>
        <wpml:waypointHeadingParam>
          <wpml:waypointHeadingMode>followWayline</wpml:waypointHeadingMode>
        </wpml:waypointHeadingParam>
        <wpml:waypointTurnParam>
          <wpml:waypointTurnMode>toPointAndPassWithContinuityCurvature</wpml:waypointTurnMode>
          <wpml:waypointTurnDampingDist>0</wpml:waypointTurnDampingDist>
        </wpml:waypointTurnParam>
        <wpml:useStraightLine>0</wpml:useStraightLine>
      </Placemark>
    </Folder>
  </Document>
</kml>
```

---

## ⚠️ Notas Importantes para Mini 4 Pro / Mini 5 Pro

1. **DJI Fly vs Pilot 2:** El DJI Fly (usado con Mini 4/5 Pro) NO soporta importación directa de KMZ. Debes usar el workaround de reemplazar archivos.

2. **Ruta de archivos:**
   - Android: `/Android/data/dji.go.v5/files/waypoint/`
   - iOS: `FILES/DJI Fly/wayline_mission/`

3. **Captura de fotos:** El DJI Fly no dispara fotos automáticamente con triggers de distancia/tiempo. Debes usar "Timed Shot" manual en modo cámara.

4. **Limitaciones:**
   - No soporta breakpoint resume
   - No soporta importación KML directa
   - Las misiones se guardan localmente en el dispositivo

5. **Velocidades recomendadas:**
   - Fotogrametría: 2-7 m/s
   - Video: 1-3 m/s
   - Intervalo de fotos: mínimo 2s (JPEG), 10s (RAW)

6. **Gimbal Mini 5 Pro:** Soporta rotación de 225° para tomas verticales

---

## 🔗 Referencias

- [DJI Cloud API - WPML Reference](https://developer.dji.com/doc/cloud-api-tutorial/en/api-reference/dji-wpml/)
- [GitHub: dji-sdk/Cloud-API-Doc](https://github.com/dji-sdk/Cloud-API-Doc)
- [DJI Fly Waypoint Support](https://support.dji.com/)

---

*Documento generado: Enero 2026*
*Versión WPML: 1.0.2*
