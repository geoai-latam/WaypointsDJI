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

const PATTERN_OPTIONS: { value: FlightPattern; label: string; icon: string }[] = [
  { value: 'grid', label: 'Grid', icon: '▤' },
  { value: 'double_grid', label: 'Doble', icon: '▦' },
  { value: 'corridor', label: 'Corredor', icon: '═' },
  { value: 'orbit', label: 'Orbita', icon: '◎' },
];

const FINISH_OPTIONS: { value: FinishAction; label: string }[] = [
  { value: 'goHome', label: 'Volver a Casa (RTH)' },
  { value: 'autoLand', label: 'Aterrizar' },
  { value: 'noAction', label: 'Hover' },
  { value: 'gotoFirstWaypoint', label: 'Ir al Inicio' },
];

function formatArea(area: number): string {
  if (area >= 10000) {
    return (area / 10000).toFixed(2);
  }
  return area.toLocaleString('es-CO', { maximumFractionDigits: 0 });
}

function getAreaUnit(area: number): string {
  return area >= 10000 ? 'ha' : 'm²';
}

export function ConfigPanel({
  config,
  onConfigChange,
  flightParams,
  waypointCount,
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

  const estimatedTime = waypointCount > 0 && flightParams
    ? Math.ceil((waypointCount * flightParams.photo_interval_s) / 60 + 2)
    : 0;

  const waypointExceeded = waypointCount > 99;

  return (
    <div className="config-panel">
      {/* Header */}
      <div className="panel-header">
        <h2>Configuracion</h2>
      </div>

      {/* Summary Card - Always visible when polygon exists */}
      {hasPolygon && (
        <div className="summary-card">
          <div className="summary-grid">
            <div className="summary-metric">
              <span className="value">
                {formatArea(areaSqM)}<span className="unit">{getAreaUnit(areaSqM)}</span>
              </span>
              <span className="label">Area</span>
            </div>
            <div className={`summary-metric ${waypointExceeded ? 'warning' : ''}`}>
              <span className="value">
                {waypointCount || '-'}<span className="unit">/99</span>
              </span>
              <span className="label">Waypoints</span>
            </div>
            <div className="summary-metric">
              <span className="value">
                ~{waypointCount || '-'}
              </span>
              <span className="label">Fotos</span>
            </div>
            <div className="summary-metric highlight">
              <span className="value">
                {estimatedTime || '-'}<span className="unit">min</span>
              </span>
              <span className="label">Tiempo</span>
            </div>
          </div>
        </div>
      )}

      {/* Alert for waypoint limit */}
      {waypointExceeded && (
        <div className="alert-callout warning">
          <span className="alert-icon">⚠</span>
          <div className="alert-content">
            <div className="alert-title">Limite excedido: {waypointCount}/99</div>
            <div className="alert-message">
              Sube el GSD a {(config.targetGsdCm * 1.5).toFixed(1)} cm/px o divide el poligono
            </div>
          </div>
        </div>
      )}

      {/* Validation Errors */}
      {validationErrors.map((err, i) => (
        <div key={i} className="alert-callout error">
          <span className="alert-icon">✕</span>
          <div className="alert-content">
            <div className="alert-message">{err}</div>
          </div>
        </div>
      ))}

      <div className="divider" />

      {/* Drone Selection */}
      <div className="config-section">
        <span className="section-label">Drone</span>
        <div className="select-wrapper">
          <select
            className="select-field"
            value={config.droneModel}
            onChange={(e) => onConfigChange({ droneModel: e.target.value as DroneModel })}
          >
            {DRONE_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Pattern Selection - Segmented Control */}
      <div className="config-section">
        <span className="section-label">Patron de Vuelo</span>
        <div className="segmented-control">
          {PATTERN_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              className={`segment-btn ${config.pattern === opt.value ? 'active' : ''}`}
              onClick={() => onConfigChange({ pattern: opt.value })}
            >
              <span className="segment-icon">{opt.icon}</span>
              <span className="segment-label">{opt.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* GSD Slider */}
      <div className="config-section">
        <div className="slider-field">
          <div className="slider-header">
            <span className="slider-label">GSD Objetivo</span>
            <span className={`slider-value ${config.useAltitudeOverride ? 'override' : ''}`}>
              {config.targetGsdCm.toFixed(1)} cm/px
            </span>
          </div>
          <input
            type="range"
            className="slider-track"
            min="0.5"
            max="5"
            step="0.1"
            value={config.targetGsdCm}
            onChange={(e) => onConfigChange({ targetGsdCm: parseFloat(e.target.value) })}
            disabled={config.useAltitudeOverride}
          />
          <div className="slider-hints">
            <span>0.5 (detalle)</span>
            <span>5.0 (cobertura)</span>
          </div>
        </div>
      </div>

      {/* Overlap Sliders */}
      <div className="slider-row">
        <div className="slider-field">
          <div className="slider-header">
            <span className="slider-label">Frontal</span>
            <span className="slider-value">{config.frontOverlapPct}%</span>
          </div>
          <input
            type="range"
            className="slider-track"
            min="50"
            max="90"
            step="5"
            value={config.frontOverlapPct}
            onChange={(e) => onConfigChange({ frontOverlapPct: parseInt(e.target.value) })}
          />
        </div>
        <div className="slider-field">
          <div className="slider-header">
            <span className="slider-label">Lateral</span>
            <span className="slider-value">{config.sideOverlapPct}%</span>
          </div>
          <input
            type="range"
            className="slider-track"
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
        <div className="slider-field">
          <div className="slider-header">
            <span className="slider-label">Angulo de Vuelo</span>
            <span className="slider-value">{config.flightAngleDeg}°</span>
          </div>
          <input
            type="range"
            className="slider-track"
            min="0"
            max="359"
            step="5"
            value={config.flightAngleDeg}
            onChange={(e) => onConfigChange({ flightAngleDeg: parseInt(e.target.value) })}
          />
          <div className="slider-hints">
            <span>N 0°</span>
            <span>E 90°</span>
            <span>S 180°</span>
            <span>O 270°</span>
          </div>
        </div>
      </div>

      {/* 48MP Toggle */}
      <label className="toggle-field">
        <input
          type="checkbox"
          checked={config.use48mp}
          onChange={(e) => onConfigChange({ use48mp: e.target.checked })}
        />
        <span className="toggle-label">Modo 48MP</span>
        <span className="toggle-hint">Mayor resolucion</span>
      </label>

      {/* Advanced Accordion */}
      <button
        className={`accordion-trigger ${showAdvanced ? 'open' : ''}`}
        onClick={() => setShowAdvanced(!showAdvanced)}
      >
        <span>Opciones Avanzadas</span>
        <span className="accordion-icon">▼</span>
      </button>

      {showAdvanced && (
        <div className="accordion-content">
          {/* Altitude Override */}
          <label className="toggle-field">
            <input
              type="checkbox"
              checked={config.useAltitudeOverride}
              onChange={(e) => onConfigChange({ useAltitudeOverride: e.target.checked })}
            />
            <span className="toggle-label">Altitud manual</span>
          </label>

          {config.useAltitudeOverride && (
            <div className="slider-field">
              <div className="slider-header">
                <span className="slider-label">Altitud</span>
                <span className="slider-value override">{config.altitudeOverrideM || 50} m</span>
              </div>
              <input
                type="range"
                className="slider-track"
                min="20"
                max="120"
                step="5"
                value={config.altitudeOverrideM || 50}
                onChange={(e) => onConfigChange({ altitudeOverrideM: parseInt(e.target.value) })}
              />
              <div className="slider-hints">
                <span>20m</span>
                <span>120m (limite legal)</span>
              </div>
            </div>
          )}

          {/* Speed Override */}
          <label className="toggle-field">
            <input
              type="checkbox"
              checked={config.useSpeedOverride}
              onChange={(e) => onConfigChange({ useSpeedOverride: e.target.checked })}
            />
            <span className="toggle-label">Velocidad manual</span>
          </label>

          {config.useSpeedOverride && (
            <div className="slider-field">
              <div className="slider-header">
                <span className="slider-label">Velocidad</span>
                <span className="slider-value override">{config.speedMs} m/s</span>
              </div>
              <input
                type="range"
                className="slider-track"
                min="1"
                max="15"
                step="0.5"
                value={config.speedMs}
                onChange={(e) => onConfigChange({ speedMs: parseFloat(e.target.value) })}
              />
              <div className="slider-hints">
                <span>1 m/s</span>
                <span>15 m/s</span>
              </div>
            </div>
          )}

          {/* Gimbal Pitch */}
          <div className="slider-field">
            <div className="slider-header">
              <span className="slider-label">Angulo Gimbal</span>
              <span className="slider-value">{config.gimbalPitchDeg}°</span>
            </div>
            <input
              type="range"
              className="slider-track"
              min="-90"
              max="0"
              step="5"
              value={config.gimbalPitchDeg}
              onChange={(e) => onConfigChange({ gimbalPitchDeg: parseInt(e.target.value) })}
            />
            <div className="slider-hints">
              <span>-90° Nadir</span>
              <span>0° Horizonte</span>
            </div>
          </div>

          {/* Finish Action */}
          <div className="config-section">
            <span className="section-label">Accion al Finalizar</span>
            <div className="select-wrapper">
              <select
                className="select-field"
                value={config.finishAction}
                onChange={(e) => onConfigChange({ finishAction: e.target.value as FinishAction })}
              >
                {FINISH_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </div>
          </div>
        </div>
      )}

      {/* Calculated Parameters */}
      {flightParams && (
        <div className="params-card">
          <div className="params-title">Parametros Calculados</div>
          <div className="params-grid">
            <div className="param-item">
              <span className="param-value">{effectiveAltitude.toFixed(0)}m</span>
              <span className="param-label">Altitud</span>
            </div>
            <div className="param-item">
              <span className="param-value">{effectiveSpeed.toFixed(1)}m/s</span>
              <span className="param-label">Velocidad</span>
            </div>
            <div className="param-item">
              <span className="param-value">{flightParams.gsd_cm_px.toFixed(2)}</span>
              <span className="param-label">GSD real</span>
            </div>
            <div className="param-item">
              <span className="param-value">{flightParams.footprint_width_m.toFixed(0)}x{flightParams.footprint_height_m.toFixed(0)}</span>
              <span className="param-label">Footprint</span>
            </div>
            <div className="param-item">
              <span className="param-value">{flightParams.line_spacing_m.toFixed(1)}m</span>
              <span className="param-label">Espaciado</span>
            </div>
            <div className="param-item">
              <span className="param-value">{flightParams.photo_interval_s.toFixed(1)}s</span>
              <span className="param-label">Intervalo</span>
            </div>
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="actions">
        <button
          className="btn btn-primary"
          onClick={onGenerate}
          disabled={!canGenerate}
        >
          {isLoading ? 'Generando...' : 'Generar Mision'}
        </button>
        <button
          className="btn btn-success"
          onClick={onDownload}
          disabled={!canDownload}
          title={!canDownload ? 'Genera la mision primero' : ''}
        >
          Descargar KMZ
        </button>
      </div>

      {/* Hints */}
      {!hasPolygon && (
        <p className="hint">Dibuja un poligono en el mapa para comenzar</p>
      )}
      {hasPolygon && waypointCount === 0 && (
        <p className="hint">Haz clic en Generar Mision para crear waypoints</p>
      )}
      {waypointCount > 0 && (
        <p className="hint success">Mision lista para descargar</p>
      )}

      {/* DJI Instructions */}
      {waypointCount > 0 && (
        <div className="instructions-card">
          <h4>Instrucciones DJI Fly</h4>
          <ol>
            <li>Descarga el archivo KMZ</li>
            <li>Copia a:<code>/Android/data/dji.go.v5/files/waypoint/</code></li>
            <li>DJI Fly → Waypoint → Importar</li>
          </ol>
        </div>
      )}
    </div>
  );
}
