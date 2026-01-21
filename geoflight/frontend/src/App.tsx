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
    backendStatus,
    validationErrors,
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
          <span className="subtitle">Planificación de Vuelos Fotogramétricos para DJI</span>
        </div>
        <div className="header-status">
          <span className={`status-badge ${backendStatus}`}>
            {backendStatus === 'checking' && '⏳ Conectando...'}
            {backendStatus === 'online' && '🟢 Servidor Conectado'}
            {backendStatus === 'offline' && '🔴 Servidor Desconectado'}
          </span>
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
            waypointCount={waypoints.length}
            warnings={warnings}
            validationErrors={validationErrors}
            isLoading={isLoading}
            onGenerate={generateMission}
            onDownload={downloadKmz}
            hasPolygon={polygonCoords.length >= 3}
            areaSqM={areaSqM}
            backendStatus={backendStatus}
          />
        </aside>
      </main>

      {error && (
        <div className="error-toast">
          <span>{error}</span>
          <button onClick={clearError}>×</button>
        </div>
      )}

      {backendStatus === 'offline' && (
        <div className="offline-banner">
          <span>⚠️ No se puede conectar al servidor. Asegúrate de que el backend esté corriendo en http://localhost:8000</span>
          <code>cd backend && uvicorn app.main:app --reload</code>
        </div>
      )}
    </div>
  );
}

export default App;
