import { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import Map from '@arcgis/core/Map';
import MapView from '@arcgis/core/views/MapView';
import GraphicsLayer from '@arcgis/core/layers/GraphicsLayer';
import Graphic from '@arcgis/core/Graphic';
import Sketch from '@arcgis/core/widgets/Sketch';
import Home from '@arcgis/core/widgets/Home';
import Locate from '@arcgis/core/widgets/Locate';
import BasemapGallery from '@arcgis/core/widgets/BasemapGallery';
import Expand from '@arcgis/core/widgets/Expand';
import ScaleBar from '@arcgis/core/widgets/ScaleBar';
import Point from '@arcgis/core/geometry/Point';
import Polyline from '@arcgis/core/geometry/Polyline';
import Polygon from '@arcgis/core/geometry/Polygon';
import SimpleMarkerSymbol from '@arcgis/core/symbols/SimpleMarkerSymbol';
import SimpleLineSymbol from '@arcgis/core/symbols/SimpleLineSymbol';
import SimpleFillSymbol from '@arcgis/core/symbols/SimpleFillSymbol';
import TextSymbol from '@arcgis/core/symbols/TextSymbol';
import * as geometryEngine from '@arcgis/core/geometry/geometryEngine';
import * as webMercatorUtils from '@arcgis/core/geometry/support/webMercatorUtils';
import type { Coordinate, Waypoint } from '../../types';
import './MapView.css';

interface MapComponentProps {
  onPolygonComplete: (coords: Coordinate[]) => void;
  onAreaCalculated: (areaSqM: number) => void;
  waypoints: Waypoint[];
}

// Bogota coordinates
const BOGOTA_CENTER = [-74.0721, 4.7110];

const POLYGON_SYMBOL = new SimpleFillSymbol({
  color: [59, 130, 246, 0.2],
  outline: { color: [59, 130, 246, 1], width: 2 },
});

const ROUTE_SYMBOL = new SimpleLineSymbol({
  color: [249, 115, 22, 0.9],
  width: 2,
  style: 'solid',
});

function formatArea(areaSqM: number): string {
  return `${areaSqM.toLocaleString('es-CO', { maximumFractionDigits: 0 })} m²`;
}

export function MapComponent({ onPolygonComplete, onAreaCalculated, waypoints }: MapComponentProps) {
  const mapDiv = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<{ view: MapView; layers: Record<string, GraphicsLayer> } | null>(null);
  const initializingRef = useRef(false);

  const [isLoading, setIsLoading] = useState(true);
  const [mapError, setMapError] = useState<string | null>(null);
  const [hasPolygon, setHasPolygon] = useState(false);
  const [areaInfo, setAreaInfo] = useState<string>('');

  const callbacksRef = useRef({ onPolygonComplete, onAreaCalculated });
  callbacksRef.current = { onPolygonComplete, onAreaCalculated };

  const processPolygon = useCallback((polygon: Polygon) => {
    let wgs84Polygon = polygon;
    if (polygon.spatialReference?.isWebMercator) {
      wgs84Polygon = webMercatorUtils.webMercatorToGeographic(polygon) as Polygon;
    }

    const rings = wgs84Polygon.rings[0];
    const areaSqM = Math.abs(geometryEngine.geodesicArea(polygon, 'square-meters'));

    setAreaInfo(`Area: ${formatArea(areaSqM)}`);
    callbacksRef.current.onAreaCalculated(areaSqM);

    const coords: Coordinate[] = rings.map((ring) => ({
      longitude: ring[0],
      latitude: ring[1],
    }));

    if (coords.length > 1 && coords[0].longitude === coords[coords.length - 1].longitude &&
        coords[0].latitude === coords[coords.length - 1].latitude) {
      coords.pop();
    }

    setHasPolygon(true);
    callbacksRef.current.onPolygonComplete(coords);
  }, []);

  useEffect(() => {
    if (!mapDiv.current || mapInstanceRef.current || initializingRef.current) return;
    initializingRef.current = true;

    const sketchLayer = new GraphicsLayer({ id: 'sketch' });
    const routeLayer = new GraphicsLayer({ id: 'route' });
    const waypointLayer = new GraphicsLayer({ id: 'waypoints' });
    const labelsLayer = new GraphicsLayer({ id: 'labels' });

    const map = new Map({
      basemap: 'satellite',
      layers: [sketchLayer, routeLayer, waypointLayer, labelsLayer],
    });

    const view = new MapView({
      container: mapDiv.current,
      map,
      center: BOGOTA_CENTER,
      zoom: 15,
      constraints: { minZoom: 10, maxZoom: 22 },
      popupEnabled: false,
    });

    mapInstanceRef.current = {
      view,
      layers: { sketch: sketchLayer, route: routeLayer, waypoints: waypointLayer, labels: labelsLayer },
    };

    view.when(() => {
      setIsLoading(false);

      // Sketch widget
      const sketch = new Sketch({
        layer: sketchLayer,
        view,
        creationMode: 'single',
        availableCreateTools: ['polygon', 'rectangle'],
        visibleElements: {
          selectionTools: { 'lasso-selection': false, 'rectangle-selection': false },
          settingsMenu: false,
          undoRedoMenu: false,
        },
        defaultCreateOptions: {
          hasZ: false,
        },
      });
      view.ui.add(sketch, 'top-right');

      // Basemap Gallery in Expand
      const basemapGallery = new BasemapGallery({ view });
      const bgExpand = new Expand({
        view,
        content: basemapGallery,
        expandIcon: 'basemap',
        expandTooltip: 'Cambiar mapa base',
      });
      view.ui.add(bgExpand, 'top-right');

      // Home widget
      view.ui.add(new Home({ view }), 'top-left');

      // Locate widget (GPS)
      const locate = new Locate({
        view,
        goToOverride: (view, options) => {
          options.target.scale = 2500;
          return view.goTo(options.target);
        },
      });
      view.ui.add(locate, 'top-left');

      // Scale bar
      view.ui.add(new ScaleBar({ view, unit: 'metric' }), 'bottom-left');

      // Sketch events
      sketch.on('create', (event) => {
        if (event.state === 'complete' && event.graphic.geometry?.type === 'polygon') {
          event.graphic.symbol = POLYGON_SYMBOL;
          processPolygon(event.graphic.geometry as Polygon);
        }
      });

      sketch.on('update', (event) => {
        if (event.state === 'complete' && event.graphics[0]?.geometry?.type === 'polygon') {
          processPolygon(event.graphics[0].geometry as Polygon);
        }
      });

      sketch.on('delete', () => {
        setHasPolygon(false);
        setAreaInfo('');
        callbacksRef.current.onPolygonComplete([]);
        callbacksRef.current.onAreaCalculated(0);
        mapInstanceRef.current?.layers.waypoints.removeAll();
        mapInstanceRef.current?.layers.route.removeAll();
        mapInstanceRef.current?.layers.labels.removeAll();
      });
    }).catch((error: Error) => {
      if (error.name !== 'AbortError') {
        console.error('Map error:', error);
        setMapError(`Error: ${error.message}`);
      }
      setIsLoading(false);
    });

    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.view.destroy();
        mapInstanceRef.current = null;
      }
      initializingRef.current = false;
    };
  }, [processPolygon]);

  const waypointGraphics = useMemo(() => {
    console.log('[MapView] waypointGraphics memo, waypoints:', waypoints.length);
    if (waypoints.length === 0) return { route: null, markers: [], labels: [] };

    console.log('[MapView] First waypoint:', waypoints[0]);
    console.log('[MapView] Last waypoint:', waypoints[waypoints.length - 1]);

    const routeCoords = waypoints.map((wp) => [wp.longitude, wp.latitude]);
    console.log('[MapView] Route coords sample:', routeCoords.slice(0, 3));
    const route = new Graphic({
      geometry: new Polyline({ paths: [routeCoords], spatialReference: { wkid: 4326 } }),
      symbol: ROUTE_SYMBOL,
    });

    const markers: Graphic[] = [];
    const labels: Graphic[] = [];

    waypoints.forEach((wp, index) => {
      const isFirst = index === 0;
      const isLast = index === waypoints.length - 1;
      const color = isFirst ? [34, 197, 94] : isLast ? [239, 68, 68] : [255, 255, 255];

      markers.push(new Graphic({
        geometry: new Point({ longitude: wp.longitude, latitude: wp.latitude, spatialReference: { wkid: 4326 } }),
        symbol: new SimpleMarkerSymbol({
          color,
          size: isFirst || isLast ? 10 : 4,
          style: 'circle',
          outline: { color: isFirst ? [22, 163, 74] : isLast ? [220, 38, 38] : [80, 80, 80], width: 1 },
        }),
      }));

      if (isFirst || isLast) {
        labels.push(new Graphic({
          geometry: new Point({ longitude: wp.longitude, latitude: wp.latitude, spatialReference: { wkid: 4326 } }),
          symbol: new TextSymbol({
            text: isFirst ? 'INICIO' : 'FIN',
            color: 'white',
            haloColor: isFirst ? '#16a34a' : '#dc2626',
            haloSize: 2,
            font: { size: 10, weight: 'bold' },
            yoffset: 15,
          }),
        }));
      }
    });

    return { route, markers, labels };
  }, [waypoints]);

  useEffect(() => {
    console.log('[MapView] useEffect for graphics, mapInstance:', !!mapInstanceRef.current);
    const instance = mapInstanceRef.current;
    if (!instance) {
      console.warn('[MapView] No map instance yet');
      return;
    }

    const { route: routeLayer, waypoints: wpLayer, labels: labelsLayer } = instance.layers;

    routeLayer.removeAll();
    wpLayer.removeAll();
    labelsLayer.removeAll();

    console.log('[MapView] waypointGraphics.route:', !!waypointGraphics.route);
    console.log('[MapView] waypointGraphics.markers:', waypointGraphics.markers.length);

    if (waypointGraphics.route) {
      console.log('[MapView] Adding route and markers to map');
      routeLayer.add(waypointGraphics.route);
      wpLayer.addMany(waypointGraphics.markers);
      labelsLayer.addMany(waypointGraphics.labels);

      if (waypoints.length > 0) {
        const extent = {
          xmin: Math.min(...waypoints.map((w) => w.longitude)) - 0.001,
          xmax: Math.max(...waypoints.map((w) => w.longitude)) + 0.001,
          ymin: Math.min(...waypoints.map((w) => w.latitude)) - 0.001,
          ymax: Math.max(...waypoints.map((w) => w.latitude)) + 0.001,
          spatialReference: { wkid: 4326 },
        };
        instance.view.goTo(extent, { duration: 500 });
      }
    }
  }, [waypointGraphics, waypoints]);

  return (
    <div className="map-wrapper">
      {!hasPolygon && !isLoading && (
        <div className="map-instructions">
          <div className="instructions-content">
            <h3>Dibuja el Area de Vuelo</h3>
            <ol>
              <li>Usa <strong>Polygon</strong> o <strong>Rectangle</strong> del panel</li>
              <li>Clic para vertices, doble clic para terminar</li>
            </ol>
          </div>
        </div>
      )}

      {areaInfo && <div className="area-badge">{areaInfo}</div>}
      {waypoints.length > 0 && <div className="waypoint-badge">{waypoints.length} waypoints</div>}

      {isLoading && (
        <div className="map-loading">
          <div className="spinner"></div>
          <p>Cargando mapa...</p>
        </div>
      )}

      {mapError && (
        <div className="map-error">
          <p>{mapError}</p>
          <button onClick={() => window.location.reload()}>Reintentar</button>
        </div>
      )}

      <div ref={mapDiv} className="map-container-inner" />
    </div>
  );
}
