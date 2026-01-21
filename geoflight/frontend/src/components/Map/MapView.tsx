import { useEffect, useRef, useState } from 'react';
import Map from '@arcgis/core/Map';
import MapView from '@arcgis/core/views/MapView';
import GraphicsLayer from '@arcgis/core/layers/GraphicsLayer';
import Graphic from '@arcgis/core/Graphic';
import Sketch from '@arcgis/core/widgets/Sketch';
import BasemapGallery from '@arcgis/core/widgets/BasemapGallery';
import ScaleBar from '@arcgis/core/widgets/ScaleBar';
import Home from '@arcgis/core/widgets/Home';
import Locate from '@arcgis/core/widgets/Locate';
import Compass from '@arcgis/core/widgets/Compass';
import Expand from '@arcgis/core/widgets/Expand';
import CoordinateConversion from '@arcgis/core/widgets/CoordinateConversion';
import Point from '@arcgis/core/geometry/Point';
import Polyline from '@arcgis/core/geometry/Polyline';
import Polygon from '@arcgis/core/geometry/Polygon';
import SimpleMarkerSymbol from '@arcgis/core/symbols/SimpleMarkerSymbol';
import SimpleLineSymbol from '@arcgis/core/symbols/SimpleLineSymbol';
import SimpleFillSymbol from '@arcgis/core/symbols/SimpleFillSymbol';
import TextSymbol from '@arcgis/core/symbols/TextSymbol';
import * as geometryEngine from '@arcgis/core/geometry/geometryEngine';
import type { Coordinate, Waypoint } from '../../types';
import './MapView.css';

interface MapComponentProps {
  onPolygonComplete: (coords: Coordinate[]) => void;
  onAreaCalculated: (areaSqM: number) => void;
  waypoints: Waypoint[];
}

export function MapComponent({ onPolygonComplete, onAreaCalculated, waypoints }: MapComponentProps) {
  const mapDiv = useRef<HTMLDivElement>(null);
  const viewRef = useRef<MapView | null>(null);
  const sketchRef = useRef<Sketch | null>(null);
  const sketchLayerRef = useRef<GraphicsLayer | null>(null);
  const waypointLayerRef = useRef<GraphicsLayer | null>(null);
  const routeLayerRef = useRef<GraphicsLayer | null>(null);
  const labelsLayerRef = useRef<GraphicsLayer | null>(null);

  const [isLoading, setIsLoading] = useState(true);
  const [mapError, setMapError] = useState<string | null>(null);
  const [hasPolygon, setHasPolygon] = useState(false);
  const [areaInfo, setAreaInfo] = useState<string>('');

  // Initialize map
  useEffect(() => {
    if (!mapDiv.current) return;

    try {
      // Create layers
      const sketchLayer = new GraphicsLayer({ id: 'sketch', title: 'Área de Vuelo' });
      const routeLayer = new GraphicsLayer({ id: 'route', title: 'Ruta de Vuelo' });
      const waypointLayer = new GraphicsLayer({ id: 'waypoints', title: 'Waypoints' });
      const labelsLayer = new GraphicsLayer({ id: 'labels', title: 'Etiquetas' });

      sketchLayerRef.current = sketchLayer;
      waypointLayerRef.current = waypointLayer;
      routeLayerRef.current = routeLayer;
      labelsLayerRef.current = labelsLayer;

      // Create map with satellite basemap
      const map = new Map({
        basemap: 'satellite',
        layers: [sketchLayer, routeLayer, waypointLayer, labelsLayer],
      });

      // Create view - default to a location (can be changed)
      const view = new MapView({
        container: mapDiv.current,
        map: map,
        center: [-74.0060, 40.7128], // Default NYC
        zoom: 16,
        constraints: {
          minZoom: 10,
          maxZoom: 22,
        },
        popup: {
          defaultPopupTemplateEnabled: true,
        },
      });

      viewRef.current = view;

      view.when(() => {
        setIsLoading(false);

        // === WIDGETS ===

        // 1. Sketch Widget - for drawing polygons
        const sketch = new Sketch({
          layer: sketchLayer,
          view: view,
          creationMode: 'single',
          availableCreateTools: ['polygon', 'rectangle'],
          defaultCreateOptions: {
            mode: 'click',
          },
          defaultUpdateOptions: {
            tool: 'reshape',
            enableRotation: true,
            enableScaling: true,
            toggleToolOnClick: true,
          },
          visibleElements: {
            createTools: {
              point: false,
              polyline: false,
              polygon: true,
              rectangle: true,
              circle: false,
            },
            selectionTools: {
              'lasso-selection': false,
              'rectangle-selection': false,
            },
            settingsMenu: true,
            undoRedoMenu: true,
          },
          tooltipOptions: {
            enabled: true,
          },
        });

        sketchRef.current = sketch;

        // Wrap sketch in expand for cleaner UI
        const sketchExpand = new Expand({
          view: view,
          content: sketch,
          expanded: true,
          expandIcon: 'polygon',
          expandTooltip: 'Herramientas de Dibujo',
          group: 'top-right',
        });

        view.ui.add(sketchExpand, 'top-right');

        // 2. Basemap Gallery
        const basemapGallery = new BasemapGallery({
          view: view,
        });

        const basemapExpand = new Expand({
          view: view,
          content: basemapGallery,
          expandIcon: 'basemap',
          expandTooltip: 'Cambiar Mapa Base',
          group: 'top-right',
        });

        view.ui.add(basemapExpand, 'top-right');

        // 3. Home button
        const homeWidget = new Home({
          view: view,
        });
        view.ui.add(homeWidget, 'top-left');

        // 4. Locate (GPS)
        const locateWidget = new Locate({
          view: view,
          goToOverride: (view, options) => {
            options.target.scale = 1500;
            return view.goTo(options.target);
          },
        });
        view.ui.add(locateWidget, 'top-left');

        // 5. Compass
        const compass = new Compass({
          view: view,
        });
        view.ui.add(compass, 'top-left');

        // 6. Scale Bar
        const scaleBar = new ScaleBar({
          view: view,
          unit: 'metric',
          style: 'ruler',
        });
        view.ui.add(scaleBar, 'bottom-left');

        // 7. Coordinate Conversion
        const coordConversion = new CoordinateConversion({
          view: view,
        });

        const coordExpand = new Expand({
          view: view,
          content: coordConversion,
          expandIcon: 'gps-on',
          expandTooltip: 'Coordenadas',
          group: 'bottom-right',
        });

        view.ui.add(coordExpand, 'bottom-right');

        // === SKETCH EVENTS ===

        // Handle polygon creation complete
        sketch.on('create', (event) => {
          if (event.state === 'complete' && event.graphic.geometry) {
            const geom = event.graphic.geometry;

            if (geom.type === 'polygon') {
              const polygon = geom as Polygon;
              const rings = polygon.rings[0];

              // Calculate area
              const areaSqM = Math.abs(geometryEngine.geodesicArea(polygon, 'square-meters'));
              const areaHa = areaSqM / 10000;

              setAreaInfo(`Área: ${areaSqM.toFixed(0)} m² (${areaHa.toFixed(2)} ha)`);
              onAreaCalculated(areaSqM);

              // Update polygon style
              event.graphic.symbol = new SimpleFillSymbol({
                color: [0, 122, 255, 0.2],
                outline: {
                  color: [0, 122, 255, 1],
                  width: 2,
                },
              });

              // Convert to Coordinate array
              const coords: Coordinate[] = rings.map((ring) => ({
                longitude: ring[0],
                latitude: ring[1],
              }));

              // Remove last point if it's the same as first
              if (
                coords.length > 1 &&
                coords[0].longitude === coords[coords.length - 1].longitude &&
                coords[0].latitude === coords[coords.length - 1].latitude
              ) {
                coords.pop();
              }

              setHasPolygon(true);
              onPolygonComplete(coords);
            }
          }
        });

        // Handle polygon update (reshape/move)
        sketch.on('update', (event) => {
          if (event.state === 'complete' && event.graphics.length > 0) {
            const graphic = event.graphics[0];
            if (graphic.geometry?.type === 'polygon') {
              const polygon = graphic.geometry as Polygon;
              const rings = polygon.rings[0];

              // Recalculate area
              const areaSqM = Math.abs(geometryEngine.geodesicArea(polygon, 'square-meters'));
              const areaHa = areaSqM / 10000;

              setAreaInfo(`Área: ${areaSqM.toFixed(0)} m² (${areaHa.toFixed(2)} ha)`);
              onAreaCalculated(areaSqM);

              // Update coordinates
              const coords: Coordinate[] = rings.map((ring) => ({
                longitude: ring[0],
                latitude: ring[1],
              }));

              if (
                coords.length > 1 &&
                coords[0].longitude === coords[coords.length - 1].longitude &&
                coords[0].latitude === coords[coords.length - 1].latitude
              ) {
                coords.pop();
              }

              onPolygonComplete(coords);
            }
          }
        });

        // Handle delete
        sketch.on('delete', () => {
          setHasPolygon(false);
          setAreaInfo('');
          onPolygonComplete([]);
          onAreaCalculated(0);
          // Clear waypoints and route
          waypointLayerRef.current?.removeAll();
          routeLayerRef.current?.removeAll();
          labelsLayerRef.current?.removeAll();
        });

      }).catch((error: Error) => {
        console.error('Map initialization error:', error);
        setMapError(`Error al inicializar el mapa: ${error.message}`);
        setIsLoading(false);
      });

      // Cleanup
      return () => {
        view.destroy();
      };
    } catch (error) {
      console.error('Map setup error:', error);
      setMapError(`Error de configuración: ${error instanceof Error ? error.message : 'Unknown'}`);
      setIsLoading(false);
    }
  }, [onPolygonComplete, onAreaCalculated]);

  // Update waypoints display
  useEffect(() => {
    if (!waypointLayerRef.current || !routeLayerRef.current || !labelsLayerRef.current) return;

    // Clear existing graphics
    waypointLayerRef.current.removeAll();
    routeLayerRef.current.removeAll();
    labelsLayerRef.current.removeAll();

    if (waypoints.length === 0) return;

    // Add route line
    const routeCoords = waypoints.map((wp) => [wp.longitude, wp.latitude]);

    const routeLine = new Graphic({
      geometry: new Polyline({
        paths: [routeCoords],
        spatialReference: { wkid: 4326 },
      }),
      symbol: new SimpleLineSymbol({
        color: [255, 165, 0, 0.9],
        width: 2,
        style: 'solid',
      }),
    });

    routeLayerRef.current.add(routeLine);

    // Add waypoint markers
    waypoints.forEach((wp, index) => {
      const isFirst = index === 0;
      const isLast = index === waypoints.length - 1;

      const color = isFirst
        ? [0, 200, 0]  // Green for start
        : isLast
        ? [255, 0, 0]  // Red for end
        : [255, 255, 255];  // White for middle

      const marker = new Graphic({
        geometry: new Point({
          longitude: wp.longitude,
          latitude: wp.latitude,
          spatialReference: { wkid: 4326 },
        }),
        symbol: new SimpleMarkerSymbol({
          color: color,
          size: isFirst || isLast ? 12 : 5,
          style: 'circle',
          outline: {
            color: isFirst ? [0, 150, 0] : isLast ? [180, 0, 0] : [100, 100, 100],
            width: 1,
          },
        }),
        attributes: {
          index: wp.index,
          altitude: wp.altitude,
          heading: wp.heading,
        },
        popupTemplate: {
          title: `Waypoint ${wp.index + 1}`,
          content: `
            <b>Altitud:</b> ${wp.altitude} m<br>
            <b>Rumbo:</b> ${wp.heading.toFixed(0)}°<br>
            <b>Velocidad:</b> ${wp.speed} m/s<br>
            <b>Gimbal:</b> ${wp.gimbal_pitch}°
          `,
        },
      });

      waypointLayerRef.current!.add(marker);

      // Add labels for first and last
      if (isFirst || isLast) {
        const label = new Graphic({
          geometry: new Point({
            longitude: wp.longitude,
            latitude: wp.latitude,
            spatialReference: { wkid: 4326 },
          }),
          symbol: new TextSymbol({
            text: isFirst ? 'INICIO' : 'FIN',
            color: 'white',
            haloColor: isFirst ? 'green' : 'red',
            haloSize: 2,
            font: {
              size: 10,
              weight: 'bold',
            },
            yoffset: 15,
          }),
        });
        labelsLayerRef.current!.add(label);
      }
    });

    // Zoom to waypoints
    if (viewRef.current && waypoints.length > 0) {
      const extent = {
        xmin: Math.min(...waypoints.map((w) => w.longitude)) - 0.001,
        xmax: Math.max(...waypoints.map((w) => w.longitude)) + 0.001,
        ymin: Math.min(...waypoints.map((w) => w.latitude)) - 0.001,
        ymax: Math.max(...waypoints.map((w) => w.latitude)) + 0.001,
        spatialReference: { wkid: 4326 },
      };

      viewRef.current.goTo(extent, { duration: 500 });
    }
  }, [waypoints]);

  return (
    <div className="map-wrapper">
      {/* Instructions overlay */}
      {!hasPolygon && !isLoading && (
        <div className="map-instructions">
          <div className="instructions-content">
            <h3>📍 Dibuja el Área de Vuelo</h3>
            <ol>
              <li>Usa las herramientas <strong>Polígono</strong> o <strong>Rectángulo</strong> del panel superior derecho</li>
              <li>Haz clic en el mapa para crear vértices</li>
              <li>Doble clic para terminar el polígono</li>
            </ol>
            <p className="tip">💡 Usa el botón de ubicación (GPS) para ir a tu posición actual</p>
          </div>
        </div>
      )}

      {/* Area info badge */}
      {areaInfo && (
        <div className="area-badge">
          {areaInfo}
        </div>
      )}

      {/* Waypoint count badge */}
      {waypoints.length > 0 && (
        <div className="waypoint-badge">
          📍 {waypoints.length} waypoints
        </div>
      )}

      {/* Loading overlay */}
      {isLoading && (
        <div className="map-loading">
          <div className="spinner"></div>
          <p>Cargando mapa...</p>
        </div>
      )}

      {/* Error overlay */}
      {mapError && (
        <div className="map-error">
          <p>❌ {mapError}</p>
          <button onClick={() => window.location.reload()}>Reintentar</button>
        </div>
      )}

      {/* Map container */}
      <div ref={mapDiv} className="map-container-inner" />
    </div>
  );
}
