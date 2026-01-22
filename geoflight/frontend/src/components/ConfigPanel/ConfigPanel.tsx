import { useState } from 'react';
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

function formatArea(area: number): string {
  if (area === 0) return '-';
  return `${area.toLocaleString('es-CO', { maximumFractionDigits: 0 })} m²`;
}

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
  const [showAdvanced, setShowAdvanced] = useState(false);

  const canGenerate = hasPolygon && backendStatus === 'online' && !isLoading;
  const canDownload = canGenerate && waypointCount > 0;

  const effectiveAltitude = config.useAltitudeOverride && config.altitudeOverrideM
    ? config.altitudeOverrideM
    : flightParams?.altitude_m || 0;

  const effectiveSpeed = config.useSpeedOverride
    ? config.speedMs
    : flightParams?.max_speed_ms || 5;

  return (
    <div className="config-panel">
      <h2>Configuracion de Mision</h2>

      {areaSqM > 0 && (
        <div className="area-info">
          <span className="area-label">Area:</span>
          <span className="area-value">{formatArea(areaSqM)}</span>
        </div>
      )}

      {/* Drone Selection */}
      <div className="config-section">
        <label htmlFor="drone">Drone</label>
        <select
          id="drone"
          value={config.droneModel}
          onChange={(e) => onConfigChange({ droneModel: e.target.value as DroneModel })}
        >
          {DRONE_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>
      </div>

      {/* Pattern Selection */}
      <div className="config-section">
        <label>Patron de Vuelo</label>
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
      </div>

      {/* GSD */}
      <div className="config-section">
        <label htmlFor="gsd">
          GSD Objetivo: <strong>{config.targetGsdCm.toFixed(1)} cm/px</strong>
          {config.useAltitudeOverride && flightParams && (
            <span className="override-note"> (Real: {flightParams.gsd_cm_px.toFixed(2)} cm/px)</span>
          )}
        </label>
        <input
          id="gsd"
          type="range"
          min="0.5"
          max="5"
          step="0.1"
          value={config.targetGsdCm}
          onChange={(e) => onConfigChange({ targetGsdCm: parseFloat(e.target.value) })}
          disabled={config.useAltitudeOverride}
        />
        <div className="range-labels">
          <span>0.5 cm</span>
          <span>5.0 cm</span>
        </div>
        {config.useAltitudeOverride && (
          <p className="override-hint">GSD se calcula desde la altitud manual</p>
        )}
      </div>

      {/* Overlap */}
      <div className="config-row">
        <div className="config-section half">
          <label htmlFor="front-overlap">
            Frontal: <strong>{config.frontOverlapPct}%</strong>
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
            Lateral: <strong>{config.sideOverlapPct}%</strong>
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
          Angulo de Vuelo: <strong>{config.flightAngleDeg}°</strong>
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
          <span>N</span>
          <span>E</span>
          <span>S</span>
          <span>O</span>
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
          Modo 48MP (mayor resolucion)
        </label>
      </div>

      {/* Advanced Toggle */}
      <button
        className="btn btn-link"
        onClick={() => setShowAdvanced(!showAdvanced)}
      >
        {showAdvanced ? '▼ Ocultar Avanzado' : '▶ Mostrar Avanzado'}
      </button>

      {/* Advanced Options */}
      {showAdvanced && (
        <div className="advanced-section">
          {/* Altitude Override */}
          <div className="config-section checkbox">
            <label>
              <input
                type="checkbox"
                checked={config.useAltitudeOverride}
                onChange={(e) => onConfigChange({ useAltitudeOverride: e.target.checked })}
              />
              Override Altitud Manual
            </label>
          </div>
          {config.useAltitudeOverride && (
            <div className="config-section">
              <label htmlFor="altitude">
                Altitud: <strong>{config.altitudeOverrideM} m</strong>
              </label>
              <input
                id="altitude"
                type="range"
                min="20"
                max="120"
                step="5"
                value={config.altitudeOverrideM || 50}
                onChange={(e) => onConfigChange({ altitudeOverrideM: parseInt(e.target.value) })}
              />
              <div className="range-labels">
                <span>20m</span>
                <span>120m</span>
              </div>
            </div>
          )}

          {/* Speed Override */}
          <div className="config-section checkbox">
            <label>
              <input
                type="checkbox"
                checked={config.useSpeedOverride}
                onChange={(e) => onConfigChange({ useSpeedOverride: e.target.checked })}
              />
              Override Velocidad Manual
            </label>
          </div>
          {config.useSpeedOverride && (
            <div className="config-section">
              <label htmlFor="speed">
                Velocidad: <strong>{config.speedMs} m/s</strong>
              </label>
              <input
                id="speed"
                type="range"
                min="1"
                max="15"
                step="0.5"
                value={config.speedMs}
                onChange={(e) => onConfigChange({ speedMs: parseFloat(e.target.value) })}
              />
              <div className="range-labels">
                <span>1 m/s</span>
                <span>15 m/s</span>
              </div>
            </div>
          )}

          {/* Gimbal Pitch */}
          <div className="config-section">
            <label htmlFor="gimbal">
              Angulo Gimbal: <strong>{config.gimbalPitchDeg}°</strong>
            </label>
            <input
              id="gimbal"
              type="range"
              min="-90"
              max="0"
              step="5"
              value={config.gimbalPitchDeg}
              onChange={(e) => onConfigChange({ gimbalPitchDeg: parseInt(e.target.value) })}
            />
            <div className="range-labels">
              <span>-90° (Nadir)</span>
              <span>0° (Horizonte)</span>
            </div>
          </div>

          {/* Finish Action */}
          <div className="config-section">
            <label htmlFor="finish">Accion al Finalizar</label>
            <select
              id="finish"
              value={config.finishAction}
              onChange={(e) => onConfigChange({ finishAction: e.target.value as FinishAction })}
            >
              {FINISH_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </div>
        </div>
      )}

      {/* Calculated Parameters */}
      {flightParams && (
        <div className="flight-params">
          <h3>Parametros Calculados</h3>
          <div className="params-grid">
            <div className="param">
              <span className="param-label">Altitud</span>
              <span className="param-value">{effectiveAltitude.toFixed(1)} m</span>
            </div>
            <div className="param">
              <span className="param-label">Velocidad</span>
              <span className="param-value">{effectiveSpeed.toFixed(1)} m/s</span>
            </div>
            <div className="param">
              <span className="param-label">GSD Real</span>
              <span className="param-value">{flightParams.gsd_cm_px.toFixed(2)} cm/px</span>
            </div>
            <div className="param">
              <span className="param-label">Footprint</span>
              <span className="param-value">
                {flightParams.footprint_width_m.toFixed(0)}x{flightParams.footprint_height_m.toFixed(0)}m
              </span>
            </div>
            <div className="param">
              <span className="param-label">Espaciado</span>
              <span className="param-value">{flightParams.line_spacing_m.toFixed(1)} m</span>
            </div>
            <div className="param">
              <span className="param-label">Intervalo</span>
              <span className="param-value">{flightParams.photo_interval_s.toFixed(1)} s</span>
            </div>
            {flightParams.estimated_photos > 0 && (
              <>
                <div className="param">
                  <span className="param-label">Fotos</span>
                  <span className="param-value">~{flightParams.estimated_photos}</span>
                </div>
                <div className="param">
                  <span className="param-label">Tiempo</span>
                  <span className="param-value">~{flightParams.estimated_flight_time_min.toFixed(0)} min</span>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* Mission Summary */}
      {waypointCount > 0 && flightParams && (
        <div className="mission-summary">
          <h3>Resumen de Mision</h3>
          <div className="summary-grid">
            <div className={`summary-item ${waypointCount > 99 ? 'warning' : ''}`}>
              <span className="summary-label">Waypoints</span>
              <span className="summary-value">
                {waypointCount}
                {waypointCount > 99 && <span className="count-warning"> (Excede 99)</span>}
              </span>
            </div>
            <div className="summary-item">
              <span className="summary-label">Fotos Estimadas</span>
              <span className="summary-value">~{waypointCount}</span>
            </div>
            <div className="summary-item highlight">
              <span className="summary-label">Tiempo Total Estimado</span>
              <span className="summary-value">
                ~{Math.ceil((waypointCount * flightParams.photo_interval_s) / 60 + 2)} min
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Validation Errors */}
      {validationErrors.length > 0 && (
        <div className="validation-errors">
          {validationErrors.map((err, i) => (
            <div key={i} className="validation-error">{err}</div>
          ))}
        </div>
      )}

      {/* Warnings */}
      {warnings.length > 0 && (
        <div className="warnings">
          {warnings.map((w, i) => (
            <div key={i} className="warning">{w}</div>
          ))}
        </div>
      )}

      {/* Actions */}
      <div className="actions">
        <button className="btn btn-primary" onClick={onGenerate} disabled={!canGenerate}>
          {isLoading ? 'Generando...' : 'Generar Mision'}
        </button>
        <button className="btn btn-success" onClick={onDownload} disabled={!canDownload}>
          Descargar KMZ
        </button>
      </div>

      {/* Hints */}
      {!hasPolygon && <p className="hint">Dibuja un poligono en el mapa para comenzar</p>}
      {hasPolygon && waypointCount === 0 && <p className="hint">Clic en "Generar Mision" para crear waypoints</p>}
      {waypointCount > 0 && <p className="hint success">Mision lista. Descarga el KMZ</p>}

      {/* DJI Instructions */}
      {waypointCount > 0 && (
        <div className="dji-instructions">
          <h4>Instrucciones DJI Fly</h4>
          <ol>
            <li>Descarga el KMZ</li>
            <li>Copia a: <code>/Android/data/dji.go.v5/files/waypoint/</code></li>
            <li>DJI Fly → Waypoint → Importar</li>
          </ol>
        </div>
      )}
    </div>
  );
}
