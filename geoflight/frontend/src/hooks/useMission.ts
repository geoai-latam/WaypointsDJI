import { useState, useCallback, useEffect } from 'react';
import type {
  MissionConfig,
  FlightParams,
  Waypoint,
  Coordinate,
  MissionRequest,
} from '../types';
import { DEFAULT_MISSION_CONFIG } from '../types';
import * as api from '../services/api';

interface UseMissionReturn {
  config: MissionConfig;
  updateConfig: (updates: Partial<MissionConfig>) => void;
  flightParams: FlightParams | null;
  waypoints: Waypoint[];
  warnings: string[];
  isLoading: boolean;
  error: string | null;
  clearError: () => void;
  polygonCoords: Coordinate[];
  setPolygonCoords: (coords: Coordinate[]) => void;
  areaSqM: number;
  setAreaSqM: (area: number) => void;
  calculateParams: () => Promise<void>;
  generateMission: () => Promise<void>;
  downloadKmz: () => Promise<void>;
  backendStatus: 'checking' | 'online' | 'offline';
  validationErrors: string[];
}

export function useMission(): UseMissionReturn {
  const [config, setConfig] = useState<MissionConfig>(DEFAULT_MISSION_CONFIG);
  const [flightParams, setFlightParams] = useState<FlightParams | null>(null);
  const [waypoints, setWaypoints] = useState<Waypoint[]>([]);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [polygonCoords, setPolygonCoords] = useState<Coordinate[]>([]);
  const [areaSqM, setAreaSqM] = useState(0);
  const [backendStatus, setBackendStatus] = useState<'checking' | 'online' | 'offline'>('checking');
  const [validationErrors, setValidationErrors] = useState<string[]>([]);

  // Check backend connectivity on mount
  useEffect(() => {
    const checkBackend = async () => {
      try {
        const response = await fetch('/api/cameras');
        if (response.ok) {
          setBackendStatus('online');
        } else {
          setBackendStatus('offline');
        }
      } catch {
        setBackendStatus('offline');
      }
    };

    checkBackend();

    // Retry every 10 seconds if offline
    const interval = setInterval(() => {
      if (backendStatus === 'offline') {
        checkBackend();
      }
    }, 10000);

    return () => clearInterval(interval);
  }, [backendStatus]);

  // Validate configuration
  useEffect(() => {
    const errors: string[] = [];

    if (config.targetGsdCm < 0.5) {
      errors.push('GSD muy bajo. Mínimo recomendado: 0.5 cm/px');
    }
    if (config.targetGsdCm > 5) {
      errors.push('GSD muy alto. Máximo recomendado: 5 cm/px');
    }
    if (config.frontOverlapPct < 60) {
      errors.push('Overlap frontal bajo. Mínimo recomendado: 60%');
    }
    if (config.sideOverlapPct < 50) {
      errors.push('Overlap lateral bajo. Mínimo recomendado: 50%');
    }
    if (areaSqM > 0 && areaSqM > 500000) {
      errors.push('Área muy grande (> 50 ha). Considera dividir en varias misiones');
    }
    if (config.useAltitudeOverride && config.altitudeOverrideM && config.altitudeOverrideM > 120) {
      errors.push('Altitud mayor a 120m. Verifica regulaciones locales.');
    }

    setValidationErrors(errors);
  }, [config, areaSqM]);

  // Auto-calculate params when config or area changes
  useEffect(() => {
    if (backendStatus === 'online' && areaSqM > 0) {
      calculateParams();
    }
  }, [
    config.targetGsdCm,
    config.frontOverlapPct,
    config.sideOverlapPct,
    config.use48mp,
    config.useAltitudeOverride,
    config.altitudeOverrideM,
    config.useSpeedOverride,
    config.speedMs,
    areaSqM,
    backendStatus,
  ]);

  const updateConfig = useCallback((updates: Partial<MissionConfig>) => {
    setConfig((prev) => ({ ...prev, ...updates }));
    // Clear waypoints when config changes
    setWaypoints([]);
  }, []);

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  const calculateParams = useCallback(async () => {
    if (backendStatus !== 'online') {
      setError('El servidor no está disponible. Verifica que el backend esté corriendo.');
      return;
    }

    try {
      const params = await api.calculateParams({
        drone_model: config.droneModel,
        target_gsd_cm: config.targetGsdCm,
        front_overlap_pct: config.frontOverlapPct,
        side_overlap_pct: config.sideOverlapPct,
        use_48mp: config.use48mp,
        area_m2: areaSqM > 0 ? areaSqM : undefined,
        altitude_override_m: config.useAltitudeOverride ? config.altitudeOverrideM : undefined,
        speed_override_ms: config.useSpeedOverride ? config.speedMs : undefined,
      });
      setFlightParams(params);
    } catch (err) {
      console.error('Calculate error:', err);
      // Don't show error for calculate, just log it
    }
  }, [config, areaSqM, backendStatus]);

  const generateMission = useCallback(async () => {
    // Validations
    if (backendStatus !== 'online') {
      setError('El servidor no está disponible. Verifica que el backend esté corriendo en http://localhost:8000');
      return;
    }

    if (polygonCoords.length < 3) {
      setError('Dibuja un polígono en el mapa primero (mínimo 3 puntos)');
      return;
    }

    if (areaSqM < 100) {
      setError('El área es muy pequeña. Dibuja un área mayor a 100 m²');
      return;
    }

    setIsLoading(true);
    setError(null);
    setWarnings([]);

    try {
      const request: MissionRequest = {
        polygon: { coordinates: polygonCoords },
        drone_model: config.droneModel,
        pattern: config.pattern,
        target_gsd_cm: config.targetGsdCm,
        front_overlap_pct: config.frontOverlapPct,
        side_overlap_pct: config.sideOverlapPct,
        flight_angle_deg: config.flightAngleDeg,
        use_48mp: config.use48mp,
        speed_ms: config.useSpeedOverride ? config.speedMs : undefined,
        altitude_override_m: config.useAltitudeOverride ? config.altitudeOverrideM : undefined,
        finish_action: config.finishAction,
        takeoff_altitude_m: 30,
      };

      const response = await api.generateWaypoints(request);

      if (response.success && response.waypoints) {
        setWaypoints(response.waypoints);
        if (response.flight_params) {
          setFlightParams(response.flight_params);
        }

        // Add custom warnings
        const allWarnings = [...response.warnings];

        if (response.waypoints.length > 99) {
          allWarnings.push(`La misión tiene ${response.waypoints.length} waypoints. DJI Fly soporta máximo 99. Considera reducir el área o aumentar el GSD.`);
        }

        if (response.flight_params && response.flight_params.altitude_m > 120) {
          allWarnings.push(`Altitud de ${response.flight_params.altitude_m}m excede el límite legal de 120m en muchos países.`);
        }

        setWarnings(allWarnings);
      } else {
        setError(response.message || 'Error al generar la misión');
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Error de conexión con el servidor';
      setError(`Error: ${message}`);
    } finally {
      setIsLoading(false);
    }
  }, [polygonCoords, config, areaSqM, backendStatus]);

  const downloadKmz = useCallback(async () => {
    // Validations
    if (backendStatus !== 'online') {
      setError('El servidor no está disponible');
      return;
    }

    if (polygonCoords.length < 3) {
      setError('Dibuja un polígono en el mapa primero');
      return;
    }

    if (waypoints.length === 0) {
      setError('Genera la misión primero antes de descargar');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const request: MissionRequest = {
        polygon: { coordinates: polygonCoords },
        drone_model: config.droneModel,
        pattern: config.pattern,
        target_gsd_cm: config.targetGsdCm,
        front_overlap_pct: config.frontOverlapPct,
        side_overlap_pct: config.sideOverlapPct,
        flight_angle_deg: config.flightAngleDeg,
        use_48mp: config.use48mp,
        speed_ms: config.useSpeedOverride ? config.speedMs : undefined,
        altitude_override_m: config.useAltitudeOverride ? config.altitudeOverrideM : undefined,
        finish_action: config.finishAction,
        takeoff_altitude_m: 30,
      };

      const blob = await api.downloadKmz(request);
      const filename = `mission_${config.pattern}_${waypoints.length}wp_${new Date().toISOString().slice(0, 10)}.kmz`;
      api.triggerDownload(blob, filename);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Error al descargar';
      setError(`Error: ${message}`);
    } finally {
      setIsLoading(false);
    }
  }, [polygonCoords, config, waypoints, backendStatus]);

  return {
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
    calculateParams,
    generateMission,
    downloadKmz,
    backendStatus,
    validationErrors,
  };
}
