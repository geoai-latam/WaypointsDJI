import { useState, useCallback, useEffect } from 'react';
import type {
  MissionConfig,
  FlightParams,
  Waypoint,
  Coordinate,
  MissionRequest,
  SimplificationStats,
} from '../types';
import { DEFAULT_MISSION_CONFIG } from '../types';
import * as api from '../services/api';
import { calculateFlightParams } from '../services/calculator';

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
  generateMission: () => Promise<void>;
  downloadKmz: () => Promise<void>;
  backendStatus: 'checking' | 'online' | 'offline';
  validationErrors: string[];
  simplificationStats: SimplificationStats | null;
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
  const [simplificationStats, setSimplificationStats] = useState<SimplificationStats | null>(null);

  // Check backend connectivity on mount (needed for waypoint generation)
  useEffect(() => {
    const checkBackend = async () => {
      try {
        const response = await fetch('/health');
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

    // Timer mode: warn if actual overlap is too low for photogrammetry
    if (config.useTimerMode && flightParams?.actual_front_overlap_pct !== undefined) {
      if (flightParams.actual_front_overlap_pct < 50) {
        errors.push(
          `Overlap real (${flightParams.actual_front_overlap_pct}%) es muy bajo para fotogrametría. ` +
          `Reduce velocidad o intervalo.`
        );
      }
    }

    setValidationErrors(errors);
  }, [config, areaSqM, flightParams]);

  // Auto-calculate params when config or area changes (runs locally, no backend needed)
  useEffect(() => {
    const params = calculateFlightParams({
      droneModel: config.droneModel,
      targetGsdCm: config.targetGsdCm,
      frontOverlapPct: config.frontOverlapPct,
      sideOverlapPct: config.sideOverlapPct,
      use48mp: config.use48mp,
      areaSqM: areaSqM > 0 ? areaSqM : undefined,
      altitudeOverrideM: config.useAltitudeOverride ? config.altitudeOverrideM : undefined,
      // Timer mode parameters
      useTimerMode: config.useTimerMode,
      photoIntervalS: config.photoIntervalS,
      speedMs: config.speedMs,
    });
    setFlightParams(params);
  }, [
    config.droneModel,
    config.targetGsdCm,
    config.frontOverlapPct,
    config.sideOverlapPct,
    config.use48mp,
    config.useAltitudeOverride,
    config.altitudeOverrideM,
    config.useTimerMode,
    config.photoIntervalS,
    config.speedMs,
    areaSqM,
  ]);

  const updateConfig = useCallback((updates: Partial<MissionConfig>) => {
    setConfig((prev) => ({ ...prev, ...updates }));
    // Clear waypoints when config changes
    setWaypoints([]);
  }, []);

  const clearError = useCallback(() => {
    setError(null);
  }, []);

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
    setSimplificationStats(null);

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
        speed_ms: config.useTimerMode ? config.speedMs : undefined,
        altitude_override_m: config.useAltitudeOverride ? config.altitudeOverrideM : undefined,
        gimbal_pitch_deg: config.gimbalPitchDeg,
        finish_action: config.finishAction,
        takeoff_altitude_m: 30,
        simplify: config.useSimplify ? {
          enabled: true,
          angle_threshold_deg: config.simplifyAngleThreshold,
          max_time_between_s: config.useSimplifyTimeConstraint ? config.simplifyMaxTimeBetween : undefined,
        } : undefined,
      };

      const response = await api.generateWaypoints(request);

      if (response.success && response.waypoints) {
        setWaypoints(response.waypoints);
        if (response.flight_params) {
          // Merge backend params with timer mode calculations
          const backendParams = response.flight_params;

          if (config.useTimerMode) {
            const interval = config.photoIntervalS;
            const speed = config.speedMs;
            const actualPhotoSpacing = speed * interval;
            const actualFrontOverlap = Math.round((1 - actualPhotoSpacing / backendParams.footprint_height_m) * 100);

            // Recalculate optimal speed for desired overlap with custom interval
            // Formula: optimal_speed = photo_spacing_for_desired_overlap / interval
            const optimalSpeed = backendParams.photo_spacing_m / interval;

            setFlightParams({
              ...backendParams,
              photo_interval_s: interval,
              max_speed_ms: Math.round(optimalSpeed * 100) / 100, // Optimal speed for custom interval
              actual_speed_ms: speed,
              actual_photo_spacing_m: actualPhotoSpacing,
              actual_front_overlap_pct: Math.max(0, Math.min(99, actualFrontOverlap)),
            });
          } else {
            setFlightParams(backendParams);
          }
        }
        if (response.simplification_stats) {
          setSimplificationStats(response.simplification_stats);
        }

        // Add custom warnings
        const allWarnings = [...response.warnings];

        if (response.waypoints.length > 99) {
          allWarnings.push(`La misión tiene ${response.waypoints.length} waypoints. DJI Fly soporta máximo 99. Considera reducir el área, aumentar el GSD o habilitar simplificación.`);
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
        speed_ms: config.useTimerMode ? config.speedMs : undefined,
        altitude_override_m: config.useAltitudeOverride ? config.altitudeOverrideM : undefined,
        gimbal_pitch_deg: config.gimbalPitchDeg,
        finish_action: config.finishAction,
        takeoff_altitude_m: 30,
        simplify: config.useSimplify ? {
          enabled: true,
          angle_threshold_deg: config.simplifyAngleThreshold,
          max_time_between_s: config.useSimplifyTimeConstraint ? config.simplifyMaxTimeBetween : undefined,
        } : undefined,
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
    generateMission,
    downloadKmz,
    backendStatus,
    validationErrors,
    simplificationStats,
  };
}
