import type { MissionConfig, FlightParams, DroneModel, FlightPattern, FinishAction } from '../../types';
import './ConfigPanel.css';

interface ConfigPanelProps {
  config: MissionConfig;
  onConfigChange: (updates: Partial<MissionConfig>) => void;
  flightParams: FlightParams | null;
  waypointCount: number;
  warnings: string[];
  validationErrors: string[];
  isLoading: boolean;
  onGenerate: () => void;
  onDownload: () => void;
  hasPolygon: boolean;
  areaSqM: number;
  backendStatus: 'checking' | 'online' | 'offline';
}

const DRONE_OPTIONS: { value: DroneModel; label: string }[] = [
  { value: 'mini_4_pro', label: 'DJI Mini 4 Pro' },
  { value: 'mini_5_pro', label: 'DJI Mini 5 Pro' },
];

const PATTERN_OPTIONS: { value: FlightPattern; label: string; description: string; icon: string }[] = [
  { value: 'grid', label: 'Grid', description: 'Patrón serpentín para ortofoto', icon: '▤' },
  { value: 'double_grid', label: 'Doble Grid', description: 'Dos pasadas perpendiculares para 3D', icon: '▦' },
  { value: 'corridor', label: 'Corredor', description: 'Líneas paralelas (carreteras)', icon: '═' },
  { value: 'orbit', label: 'Órbita', description: 'Circular alrededor de POI', icon: '◎' },
];

const FINISH_OPTIONS: { value: FinishAction; label: string }[] = [
  { value: 'goHome', label: 'Volver a Casa (RTH)' },
  { value: 'autoLand', label: 'Aterrizar Automáticamente' },
  { value: 'noAction', label: 'Mantenerse en Hover' },
  { value: 'gotoFirstWaypoint', label: 'Ir al Primer Waypoint' },
];

export function ConfigPanel({
  config,
  onConfigChange,
  flightParams,
  waypointCount,
  warnings,
  validationErrors,
  isLoading,
  onGenerate,
  onDownload,
  hasPolygon,
  areaSqM,
  backendStatus,
}: ConfigPanelProps) {
  const formatArea = (area: number): string => {
    if (area === 0) return '-';
    if (area < 10000) return `${area.toFixed(0)} m²`;
    return `${(area / 10000).toFixed(2)} ha`;
  };

  const canGenerate = hasPolygon && backendStatus === 'online' && !isLoading;
  const canDownload = canGenerate && waypointCount > 0;

  return (
    <div className="config-panel">
      <h2>⚙️ Configuración de Misión</h2>

      {/* Area Info */}
      {areaSqM > 0 && (
        <div className="area-info">
          <span className="area-label">Área dibujada:</span>
          <span className="area-value">{formatArea(areaSqM)}</span>
        </div>
      )}

      {/* Drone Selection */}
      <div className="config-section">
        <label htmlFor="drone">🚁 Modelo de Drone</label>
        <select
          id="drone"
          value={config.droneModel}
          onChange={(e) => onConfigChange({ droneModel: e.target.value as DroneModel })}
        >
          {DRONE_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </div>

      {/* Pattern Selection */}
      <div className="config-section">
        <label>📐 Patrón de Vuelo</label>
        <div className="pattern-grid">
          {PATTERN_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              className={`pattern-btn ${config.pattern === opt.value ? 'active' : ''}`}
              onClick={() => onConfigChange({ pattern: opt.value })}
              title={opt.description}
            >
              <span className="pattern-icon">{opt.icon}</span>
              <span className="pattern-label">{opt.label}</span>
            </button>
          ))}
        </div>
        <p className="pattern-description">
          {PATTERN_OPTIONS.find(p => p.value === config.pattern)?.description}
        </p>
      </div>

      {/* GSD */}
      <div className="config-section">
        <label htmlFor="gsd">
          📏 GSD Objetivo: <strong>{config.targetGsdCm.toFixed(1)} cm/px</strong>
        </label>
        <input
          id="gsd"
          type="range"
          min="0.5"
          max="5"
          step="0.1"
          value={config.targetGsdCm}
          onChange={(e) => onConfigChange({ targetGsdCm: parseFloat(e.target.value) })}
        />
        <div className="range-labels">
          <span>0.5 cm (Alto detalle)</span>
          <span>5.0 cm (Mayor cobertura)</span>
        </div>
      </div>

      {/* Overlap */}
      <div className="config-row">
        <div className="config-section half">
          <label htmlFor="front-overlap">
            Overlap Frontal: <strong>{config.frontOverlapPct}%</strong>
          </label>
          <input
            id="front-overlap"
            type="range"
            min="50"
            max="90"
            step="5"
            value={config.frontOverlapPct}
            onChange={(e) => onConfigChange({ frontOverlapPct: parseInt(e.target.value) })}
          />
        </div>
        <div className="config-section half">
          <label htmlFor="side-overlap">
            Overlap Lateral: <strong>{config.sideOverlapPct}%</strong>
          </label>
          <input
            id="side-overlap"
            type="range"
            min="50"
            max="90"
            step="5"
            value={config.sideOverlapPct}
            onChange={(e) => onConfigChange({ sideOverlapPct: parseInt(e.target.value) })}
          />
        </div>
      </div>

      {/* Flight Angle */}
      <div className="config-section">
        <label htmlFor="angle">
          🧭 Ángulo de Vuelo: <strong>{config.flightAngleDeg}°</strong>
        </label>
        <input
          id="angle"
          type="range"
          min="0"
          max="359"
          step="5"
          value={config.flightAngleDeg}
          onChange={(e) => onConfigChange({ flightAngleDeg: parseInt(e.target.value) })}
        />
        <div className="range-labels">
          <span>0° (Norte)</span>
          <span>90° (Este)</span>
          <span>180° (Sur)</span>
          <span>270° (Oeste)</span>
        </div>
      </div>

      {/* 48MP Toggle */}
      <div className="config-section checkbox">
        <label>
          <input
            type="checkbox"
            checked={config.use48mp}
            onChange={(e) => onConfigChange({ use48mp: e.target.checked })}
          />
          📸 Usar modo 48MP (mayor resolución, captura más lenta)
        </label>
      </div>

      {/* Finish Action */}
      <div className="config-section">
        <label htmlFor="finish">🏁 Acción al Finalizar</label>
        <select
          id="finish"
          value={config.finishAction}
          onChange={(e) => onConfigChange({ finishAction: e.target.value as FinishAction })}
        >
          {FINISH_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </div>

      {/* Calculated Parameters */}
      {flightParams && (
        <div className="flight-params">
          <h3>📊 Parámetros Calculados</h3>
          <div className="params-grid">
            <div className="param">
              <span className="param-label">Altitud</span>
              <span className="param-value">{flightParams.altitude_m.toFixed(1)} m</span>
            </div>
            <div className="param">
              <span className="param-label">GSD Real</span>
              <span className="param-value">{flightParams.gsd_cm_px.toFixed(2)} cm/px</span>
            </div>
            <div className="param">
              <span className="param-label">Footprint</span>
              <span className="param-value">
                {flightParams.footprint_width_m.toFixed(0)} × {flightParams.footprint_height_m.toFixed(0)} m
              </span>
            </div>
            <div className="param">
              <span className="param-label">Espaciado Líneas</span>
              <span className="param-value">{flightParams.line_spacing_m.toFixed(1)} m</span>
            </div>
            <div className="param">
              <span className="param-label">Espaciado Fotos</span>
              <span className="param-value">{flightParams.photo_spacing_m.toFixed(1)} m</span>
            </div>
            <div className="param">
              <span className="param-label">Vel. Máx</span>
              <span className="param-value">{flightParams.max_speed_ms.toFixed(1)} m/s</span>
            </div>
            {flightParams.estimated_photos > 0 && (
              <>
                <div className="param">
                  <span className="param-label">Fotos Est.</span>
                  <span className="param-value">~{flightParams.estimated_photos}</span>
                </div>
                <div className="param">
                  <span className="param-label">Tiempo Est.</span>
                  <span className="param-value">~{flightParams.estimated_flight_time_min.toFixed(0)} min</span>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* Waypoint Count */}
      {waypointCount > 0 && (
        <div className={`waypoint-count ${waypointCount > 99 ? 'warning' : ''}`}>
          <strong>📍 {waypointCount}</strong> waypoints generados
          {waypointCount > 99 && <span className="count-warning"> (Excede límite DJI: 99)</span>}
        </div>
      )}

      {/* Validation Errors */}
      {validationErrors.length > 0 && (
        <div className="validation-errors">
          {validationErrors.map((err, i) => (
            <div key={i} className="validation-error">
              ⚠️ {err}
            </div>
          ))}
        </div>
      )}

      {/* Warnings */}
      {warnings.length > 0 && (
        <div className="warnings">
          {warnings.map((w, i) => (
            <div key={i} className="warning">
              ⚠️ {w}
            </div>
          ))}
        </div>
      )}

      {/* Actions */}
      <div className="actions">
        <button
          className="btn btn-primary"
          onClick={onGenerate}
          disabled={!canGenerate}
        >
          {isLoading ? '⏳ Generando...' : '🚀 Generar Misión'}
        </button>
        <button
          className="btn btn-success"
          onClick={onDownload}
          disabled={!canDownload}
        >
          📥 Descargar KMZ
        </button>
      </div>

      {/* Hints */}
      {!hasPolygon && (
        <p className="hint">👆 Dibuja un polígono en el mapa para comenzar</p>
      )}

      {hasPolygon && waypointCount === 0 && (
        <p className="hint">👆 Haz clic en "Generar Misión" para crear los waypoints</p>
      )}

      {waypointCount > 0 && (
        <p className="hint success">✅ Misión lista. Descarga el KMZ y cópialo a tu dispositivo</p>
      )}

      {/* DJI Instructions */}
      {waypointCount > 0 && (
        <div className="dji-instructions">
          <h4>📱 Instrucciones para DJI Fly</h4>
          <ol>
            <li>Descarga el archivo KMZ</li>
            <li>Conecta tu dispositivo al computador</li>
            <li>Copia el archivo a: <code>/Android/data/dji.go.v5/files/waypoint/</code></li>
            <li>Abre DJI Fly → Fly → Waypoint → Importar</li>
          </ol>
        </div>
      )}
    </div>
  );
}
