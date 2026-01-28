# GeoFlight Planner

## Planificador de Vuelos Fotogramétricos para DJI Mini 4 Pro y Mini 5 Pro

---

## ¿Qué es GeoFlight Planner?

**GeoFlight Planner** es una aplicación web gratuita diseñada específicamente para pilotos de **DJI Mini 4 Pro** y **Mini 5 Pro** que desean realizar vuelos de **fotogrametría** de forma profesional, sin depender de aplicaciones de pago como DJI Pilot 2 o Pix4Dcapture (que no soportan los Mini).

---

## El Problema que Resuelve

Los drones de la serie Mini de DJI son increíblemente populares por su tamaño, precio y calidad de cámara. Sin embargo, tienen una limitación importante: **DJI Fly no incluye planificación de misiones fotogramétricas**.

Esto obliga a los usuarios a:

- Volar manualmente intentando mantener solapamiento consistente
- Adivinar la altura correcta para su GSD deseado
- Hacer fotos "a ojo" sin garantía de cobertura completa
- Procesar datos con huecos y resultados inconsistentes

---

## La Solución

GeoFlight Planner aplica **matemáticas reales de fotogrametría** para generar misiones perfectas.

### Cálculos Automáticos

| Cálculo | Descripción |
|---------|-------------|
| **GSD → Altura** | Introduce tu resolución deseada (ej: 2 cm/pixel) y calcula la altura exacta de vuelo |
| **Solapamiento** | Configura frontal (70-90%) y lateral (60-80%) para reconstrucción 3D óptima |
| **Espaciado de fotos** | Calcula distancia entre capturas según velocidad e intervalo |
| **Separación de líneas** | Determina el ancho entre pasadas paralelas |

### Fórmulas Implementadas

```
Altura = (GSD × Focal × Ancho_Imagen) / (Ancho_Sensor × 100)

Huella_Foto = (Ancho_Sensor / Focal) × Altura

Espaciado_Fotos = Huella_Altura × (1 - Solapamiento_Frontal%)

Espaciado_Líneas = Huella_Ancho × (1 - Solapamiento_Lateral%)

Velocidad_Máxima = Espaciado_Fotos / Intervalo_Foto
```

---

## Patrones de Vuelo Disponibles

| Patrón | Icono | Uso Recomendado |
|--------|-------|-----------------|
| **Grid (Serpentina)** | ⬛ | Mapeo de terreno plano, ortomosaicos 2D |
| **Double Grid** | ⬛⬛ | Reconstrucción 3D, modelos con volumen |
| **Corridor** | ➡️ | Carreteras, ríos, líneas de transmisión |
| **Orbit** | ⭕ | Edificios, torres, estructuras verticales |

---

## Flujo de Trabajo

```
1. Dibuja tu área de interés en el mapa
          ↓
2. Selecciona tu drone (Mini 4 Pro o Mini 5 Pro)
          ↓
3. Configura GSD y solapamiento deseados
          ↓
4. La app calcula altura, velocidad y separación
          ↓
5. Descarga el archivo KMZ
          ↓
6. Importa en DJI Fly y vuela la misión
```

---

## Especificaciones de Cámara Integradas

La aplicación conoce las especificaciones exactas de cada drone soportado:

| Drone | Sensor | Distancia Focal | Resolución | Intervalo Mínimo |
|-------|--------|-----------------|------------|------------------|
| **Mini 4 Pro** | 9.59 × 7.19 mm (1/1.3") | 6.72 mm | 8064 × 6048 (48MP) | 2s (12MP) / 5s (48MP) |
| **Mini 5 Pro** | 13.20 × 8.80 mm (1") | 8.82 mm | 8192 × 6144 (50MP) | 2s (12MP) / 5s (50MP) |

---

## Modo Timer (Para Áreas Grandes)

DJI Fly tiene un límite de **99 waypoints por misión**. Para áreas extensas que superan este límite, el **Modo Timer** ofrece una solución:

### ¿Cómo funciona?

1. Activa "Modo Timer" en las opciones avanzadas
2. Configura el intervalo de fotos (2-10 segundos)
3. Configura la velocidad de vuelo (1-15 m/s)
4. El sistema simplifica la ruta eliminando waypoints intermedios
5. Durante el vuelo, activa el timer de fotos en DJI Fly

### Ventajas y Consideraciones

| Ventaja | Consideración |
|---------|---------------|
| Permite cubrir áreas mucho más grandes | Requiere configuración manual del timer en DJI Fly |
| Menos waypoints = misión más fluida | El solapamiento depende de mantener velocidad constante |
| Funciona con el límite de 99 waypoints | Menos precisión en el disparo comparado con waypoints individuales |

---

## ¿Para Quién es Esta Aplicación?

| Profesión/Uso | Aplicación |
|---------------|------------|
| **Agrimensores** | Ortomosaicos precisos para levantamientos topográficos |
| **Agricultores** | Mapeo de cultivos, análisis NDVI, detección de estrés hídrico |
| **Arquitectos** | Documentación de obras, mediciones de terreno |
| **Arqueólogos** | Registro de sitios de excavación, modelos 3D de ruinas |
| **Inspectores** | Revisión de techos, paneles solares, infraestructura |
| **Constructores** | Seguimiento de avance de obra, cálculo de volumetrías |
| **Entusiastas** | Fotogrametría con calidad profesional usando equipo accesible |

---

## Stack Tecnológico

### Frontend (Aplicación Web)

| Tecnología | Versión | Propósito |
|------------|---------|-----------|
| **React** | 18.x | Framework de interfaz de usuario |
| **TypeScript** | 5.x | Tipado estático para código más robusto |
| **Vite** | 5.x | Herramienta de build ultrarrápida |
| **ArcGIS Maps SDK** | 4.x | Mapa interactivo con herramientas de dibujo |
| **Tailwind CSS** | 3.x | Framework de estilos utility-first |

### Backend (Servidor API)

| Tecnología | Versión | Propósito |
|------------|---------|-----------|
| **Python** | 3.11+ | Lenguaje del servidor |
| **FastAPI** | 0.100+ | Framework API REST de alto rendimiento |
| **Pydantic** | 2.x | Validación y serialización de datos |
| **pyproj** | 3.x | Transformaciones de coordenadas (WGS84 ↔ UTM) |
| **lxml** | 4.x | Generación de archivos XML |

### Arquitectura

```
┌─────────────────────────────────────────────────────────┐
│                      FRONTEND                           │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐     │
│  │   React     │  │  ArcGIS     │  │ Calculator  │     │
│  │   + Vite    │  │    Map      │  │  (client)   │     │
│  └─────────────┘  └─────────────┘  └─────────────┘     │
└────────────────────────┬────────────────────────────────┘
                         │ HTTP/REST
                         ▼
┌─────────────────────────────────────────────────────────┐
│                      BACKEND                            │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐     │
│  │  FastAPI    │  │  Patterns   │  │    KMZ      │     │
│  │  Endpoints  │  │  Generator  │  │  Packager   │     │
│  └─────────────┘  └─────────────┘  └─────────────┘     │
└─────────────────────────────────────────────────────────┘
                         │
                         ▼
                    ┌─────────┐
                    │   KMZ   │ → DJI Fly
                    │  File   │
                    └─────────┘
```

---

## Formato de Salida: KMZ

El archivo generado es un **KMZ** (Keyhole Markup Language Zipped) compatible con DJI Fly:

```
mission.kmz
└── wpmz/
    ├── template.kml    # Metadatos de la misión
    └── waylines.wpml   # Waypoints en formato DJI WPML
```

### Contenido del WPML

- Coordenadas de cada waypoint (lat, lon, alt)
- Acciones en cada punto (tomar foto, girar gimbal, etc.)
- Velocidad de vuelo entre waypoints
- Configuración de cámara
- Acción al finalizar (RTH, hover, aterrizar)

---

## Ventajas Clave

| Característica | Beneficio |
|----------------|-----------|
| **100% Gratuito** | Sin suscripciones, sin pagos, sin límites artificiales |
| **Basado en Web** | Funciona en cualquier dispositivo con navegador moderno |
| **Cálculos Locales** | Las matemáticas corren en tu navegador, respuesta instantánea |
| **Código Abierto** | Transparente, auditable, mejorable por la comunidad |
| **Compatible DJI Fly** | Archivo KMZ listo para importar directamente |
| **Sin Registro** | No necesitas crear cuenta ni proporcionar datos personales |

---

## Limitaciones Conocidas

| Limitación | Causa | Solución Alternativa |
|------------|-------|---------------------|
| Máximo 99 waypoints | Restricción de DJI Fly | Usar Modo Timer o dividir en múltiples misiones |
| Solo Mini 4/5 Pro | App diseñada para estos modelos | Otros drones tienen apps oficiales de planificación |
| Requiere internet para el mapa | ArcGIS necesita conexión | Planifica con conexión, vuela offline |

---

## Glosario de Términos

| Término | Definición |
|---------|------------|
| **GSD** | Ground Sample Distance - Tamaño del pixel en el terreno (cm/pixel) |
| **Solapamiento Frontal** | Porcentaje de imagen compartida entre fotos consecutivas |
| **Solapamiento Lateral** | Porcentaje de imagen compartida entre líneas de vuelo |
| **Ortomosaico** | Imagen aérea georreferenciada corregida ortográficamente |
| **WPML** | Waypoint Markup Language - Formato XML de DJI para misiones |
| **KMZ** | Formato comprimido de Google Earth, usado por DJI Fly |
| **UTM** | Sistema de coordenadas proyectadas para cálculos de distancia |
| **WGS84** | Sistema de coordenadas geográficas (latitud/longitud) |

---

## Contribuir al Proyecto

Este es un proyecto de código abierto. Si deseas contribuir:

1. Reporta bugs o sugiere mejoras en los Issues
2. Propón nuevas funcionalidades
3. Mejora la documentación
4. Añade soporte para nuevos drones

---

## Resumen

> **GeoFlight Planner convierte tu DJI Mini en una herramienta profesional de fotogrametría, calculando automáticamente todos los parámetros de vuelo y generando misiones optimizadas que puedes ejecutar directamente desde DJI Fly.**

---

*Desarrollado para la comunidad de pilotos de drones que buscan resultados profesionales con equipos accesibles.*
