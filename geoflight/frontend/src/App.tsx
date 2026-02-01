import { useCallback } from 'react';
import { MapComponent } from './components/Map';
import { ConfigPanel } from './components/ConfigPanel';
import { useMission } from './hooks/useMission';
import type { Coordinate } from './types';
import './App.css';

function App() {
  const {
    config,
    updateConfig,
    flightParams,
    waypoints,
    warnings,
    isLoading,
    error,
    clearError,
    polygonCoords,
    setPolygonCoords,
    areaSqM,
    setAreaSqM,
    generateMission,
    downloadKmz,
    validationErrors,
    simplificationStats,
  } = useMission();

  const handlePolygonComplete = useCallback(
    (coords: Coordinate[]) => {
      setPolygonCoords(coords);
    },
    [setPolygonCoords]
  );

  const handleAreaCalculated = useCallback(
    (area: number) => {
      setAreaSqM(area);
    },
    [setAreaSqM]
  );

  return (
    <div className="app">
      <header className="app-header">
        <div className="header-title">
          <h1>GeoFlight Planner</h1>
          <span className="subtitle">Planificación de Vuelos Fotogramétricos</span>
        </div>
      </header>

      <main className="app-main">
        <div className="map-container">
          <MapComponent
            onPolygonComplete={handlePolygonComplete}
            onAreaCalculated={handleAreaCalculated}
            waypoints={waypoints}
          />
        </div>

        <aside className="sidebar">
          <ConfigPanel
            config={config}
            onConfigChange={updateConfig}
            flightParams={flightParams}
            waypoints={waypoints}
            warnings={warnings}
            validationErrors={validationErrors}
            isLoading={isLoading}
            onGenerate={generateMission}
            onDownload={downloadKmz}
            hasPolygon={polygonCoords.length >= 3}
            areaSqM={areaSqM}
            simplificationStats={simplificationStats}
          />
        </aside>
      </main>

      {error && (
        <div className="error-toast">
          <span>{error}</span>
          <button onClick={clearError}>×</button>
        </div>
      )}

    </div>
  );
}

export default App;
