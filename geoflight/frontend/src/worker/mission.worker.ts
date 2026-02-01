/**
 * Mission Worker - handles waypoint generation and KMZ creation off the main thread.
 */

import type {
  WorkerRequest,
  WorkerSuccessResponse,
  WorkerErrorResponse,
} from './types';
import type {
  MissionRequest,
  Waypoint,
  FlightParams,
  Coordinate,
  SimplificationStats,
} from '../types';
import { CAMERA_PRESETS } from '../types';

// Services
import { simplifyWaypoints } from './services/waypointSimplifier';
import { KMZPackager } from './services/kmzPackager';

// Patterns
import { GridPatternGenerator } from './patterns/gridPattern';
import { DoubleGridPatternGenerator } from './patterns/doubleGridPattern';
import { CorridorPatternGenerator } from './patterns/corridorPattern';
import { OrbitPatternGenerator } from './patterns/orbitPattern';
import type { PatternGeneratorConfig } from './patterns/basePattern';

/**
 * Calculate flight parameters from mission request.
 * Mirrors the logic from services/calculator.ts - INCLUDING TIMER MODE
 */
function calculateFlightParams(request: MissionRequest): FlightParams {
  const camera = CAMERA_PRESETS[request.drone_model];

  // Calculate altitude from GSD or use override
  let altitude: number;

  if (request.altitude_override_m !== undefined) {
    altitude = request.altitude_override_m;
  } else {
    altitude = (request.target_gsd_cm * camera.focal_length_mm * camera.image_width_px) /
      (camera.sensor_width_mm * 100);
  }

  // ALWAYS recalculate actual GSD from the final altitude (matches Python backend)
  const actualGsd = (camera.sensor_width_mm * altitude * 100) /
    (camera.focal_length_mm * camera.image_width_px);

  // Calculate footprint
  const footprintWidth = (camera.sensor_width_mm / camera.focal_length_mm) * altitude;
  const footprintHeight = (camera.sensor_height_mm / camera.focal_length_mm) * altitude;

  // Calculate spacing for desired overlap
  const photoSpacing = footprintHeight * (1 - request.front_overlap_pct / 100);
  const lineSpacing = footprintWidth * (1 - request.side_overlap_pct / 100);

  // Photo interval: use custom if in timer mode, otherwise use camera default
  const defaultInterval = request.use_48mp
    ? camera.min_interval_48mp
    : camera.min_interval_12mp;
  const interval = (request.use_timer_mode && request.photo_interval_s)
    ? request.photo_interval_s
    : defaultInterval;

  // Speed needed to achieve desired overlap with current interval
  const speedForDesiredOverlap = photoSpacing / interval;

  // Timer mode: calculate actual values based on user's speed setting
  let actualSpeed: number | undefined;
  let actualPhotoSpacing: number | undefined;
  let actualFrontOverlap: number | undefined;

  if (request.use_timer_mode && request.speed_ms !== undefined) {
    actualSpeed = request.speed_ms;
    actualPhotoSpacing = actualSpeed * interval;
    // Calculate actual overlap: overlap = 1 - (spacing / footprint_height)
    actualFrontOverlap = Math.round((1 - actualPhotoSpacing / footprintHeight) * 100);
    // Clamp to valid range
    actualFrontOverlap = Math.max(0, Math.min(99, actualFrontOverlap));
  }

  // Effective speed: use actual speed if in timer mode, otherwise calculated speed
  const effectiveSpeed = actualSpeed ?? speedForDesiredOverlap;

  return {
    altitude_m: Math.round(altitude * 10) / 10,
    gsd_cm_px: Math.round(actualGsd * 1000) / 1000,
    footprint_width_m: Math.round(footprintWidth * 100) / 100,
    footprint_height_m: Math.round(footprintHeight * 100) / 100,
    line_spacing_m: Math.round(lineSpacing * 100) / 100,
    photo_spacing_m: Math.round(photoSpacing * 100) / 100,
    max_speed_ms: Math.round(effectiveSpeed * 100) / 100,
    photo_interval_s: interval,
    estimated_photos: 0,
    estimated_flight_time_min: 0,
    // Timer mode values
    actual_speed_ms: actualSpeed !== undefined ? Math.round(actualSpeed * 100) / 100 : undefined,
    actual_photo_spacing_m: actualPhotoSpacing !== undefined ? Math.round(actualPhotoSpacing * 100) / 100 : undefined,
    actual_front_overlap_pct: actualFrontOverlap,
  };
}

/**
 * Validate mission request parameters
 */
function validateRequest(request: MissionRequest): string[] {
  const errors: string[] = [];

  // Validate polygon
  if (!request.polygon?.coordinates || request.polygon.coordinates.length < 3) {
    errors.push('El polígono debe tener al menos 3 vértices');
  }

  // Validate coordinates are in valid range
  if (request.polygon?.coordinates) {
    for (const coord of request.polygon.coordinates) {
      if (coord.longitude < -180 || coord.longitude > 180) {
        errors.push(`Longitud inválida: ${coord.longitude}`);
      }
      if (coord.latitude < -90 || coord.latitude > 90) {
        errors.push(`Latitud inválida: ${coord.latitude}`);
      }
    }
  }

  // Validate GSD
  if (request.target_gsd_cm <= 0 || request.target_gsd_cm > 20) {
    errors.push(`GSD inválido: ${request.target_gsd_cm} cm/px`);
  }

  // Validate overlap
  if (request.front_overlap_pct < 0 || request.front_overlap_pct > 99) {
    errors.push(`Overlap frontal inválido: ${request.front_overlap_pct}%`);
  }
  if (request.side_overlap_pct < 0 || request.side_overlap_pct > 99) {
    errors.push(`Overlap lateral inválido: ${request.side_overlap_pct}%`);
  }

  // Validate drone model
  if (!CAMERA_PRESETS[request.drone_model]) {
    errors.push(`Modelo de drone desconocido: ${request.drone_model}`);
  }

  return errors;
}

/**
 * Generate waypoints based on the mission request.
 */
function generateWaypoints(
  request: MissionRequest,
  flightParams: FlightParams
): { waypoints: Waypoint[]; warnings: string[] } {
  const warnings: string[] = [];

  // Get polygon coordinates
  const polygonCoords: Coordinate[] = request.polygon?.coordinates ?? [];

  if (polygonCoords.length < 3) {
    throw new Error('El polígono debe tener al menos 3 vértices');
  }

  // Validate flight params
  if (flightParams.line_spacing_m <= 0) {
    throw new Error(`Espaciado de líneas inválido: ${flightParams.line_spacing_m}m`);
  }
  if (flightParams.photo_spacing_m <= 0) {
    throw new Error(`Espaciado de fotos inválido: ${flightParams.photo_spacing_m}m`);
  }

  // Apply speed override if provided
  const effectiveFlightParams = { ...flightParams };
  if (request.speed_ms !== undefined && request.speed_ms > 0) {
    effectiveFlightParams.max_speed_ms = request.speed_ms;
  }

  // Create pattern generator config
  const config: PatternGeneratorConfig = {
    flightParams: effectiveFlightParams,
    flightAngleDeg: request.flight_angle_deg,
    gimbalPitchDeg: request.gimbal_pitch_deg,
  };

  let waypoints: Waypoint[] = [];

  console.log(`[Worker] Generating ${request.pattern} pattern with ${polygonCoords.length} vertices`);
  console.log(`[Worker] Flight params: altitude=${flightParams.altitude_m}m, lineSpacing=${flightParams.line_spacing_m}m, photoSpacing=${flightParams.photo_spacing_m}m`);

  // Select and run pattern generator
  switch (request.pattern) {
    case 'grid': {
      const generator = new GridPatternGenerator(config);
      waypoints = generator.generate(polygonCoords);
      break;
    }
    case 'double_grid': {
      const generator = new DoubleGridPatternGenerator(config);
      waypoints = generator.generate(polygonCoords);
      break;
    }
    case 'corridor': {
      const generator = new CorridorPatternGenerator(config);
      waypoints = generator.generate(polygonCoords, {
        numLines: request.corridor?.num_lines ?? 3,
      });
      break;
    }
    case 'orbit': {
      const generator = new OrbitPatternGenerator(config);
      waypoints = generator.generate(polygonCoords, {
        center: request.orbit?.center,
        radiusM: request.orbit?.radius_m,
        numOrbits: request.orbit?.num_orbits ?? 1,
        altitudeStepM: request.orbit?.altitude_step_m ?? 10,
      });
      break;
    }
    default:
      throw new Error(`Patrón desconocido: ${request.pattern}`);
  }

  console.log(`[Worker] Generated ${waypoints.length} waypoints`);

  // Warn if no waypoints generated
  if (waypoints.length === 0) {
    warnings.push('No se generaron waypoints. El área puede ser muy pequeña para los parámetros configurados.');
  }

  // Validate generated waypoints
  for (const wp of waypoints) {
    if (isNaN(wp.longitude) || isNaN(wp.latitude)) {
      throw new Error(`Waypoint ${wp.index} tiene coordenadas inválidas`);
    }
  }

  return { waypoints, warnings };
}

/**
 * Handle GENERATE_WAYPOINTS request.
 */
async function handleGenerateWaypoints(
  request: MissionRequest
): Promise<{
  waypoints: Waypoint[];
  flightParams: FlightParams;
  warnings: string[];
  simplificationStats?: SimplificationStats;
}> {
  const warnings: string[] = [];

  // Validate request
  const validationErrors = validateRequest(request);
  if (validationErrors.length > 0) {
    throw new Error(validationErrors.join('. '));
  }

  // Calculate flight parameters
  const flightParams = calculateFlightParams(request);

  // Validate calculated params
  if (flightParams.altitude_m <= 0) {
    throw new Error(`Altitud calculada inválida: ${flightParams.altitude_m}m`);
  }

  // Generate waypoints
  const result = generateWaypoints(request, flightParams);
  let waypoints = result.waypoints;
  warnings.push(...result.warnings);

  // Apply simplification if enabled
  let simplificationStats: SimplificationStats | undefined;
  if (request.simplify?.enabled) {
    const simplified = simplifyWaypoints(waypoints, {
      enabled: true,
      angleThresholdDeg: request.simplify.angle_threshold_deg,
      maxTimeBetweenS: request.simplify.max_time_between_s,
      maxDistanceBetweenM: request.simplify.max_distance_between_m,
      speedMs: flightParams.max_speed_ms,
    });
    waypoints = simplified.waypoints;
    simplificationStats = simplified.stats;
  }

  // Check waypoint limit
  if (waypoints.length > 99) {
    warnings.push(
      `La misión tiene ${waypoints.length} waypoints. DJI Fly soporta máximo 99. ` +
      `Considera reducir el área, aumentar el GSD o habilitar simplificación.`
    );
  }

  // Check altitude limit
  if (flightParams.altitude_m > 120) {
    warnings.push(
      `Altitud de ${flightParams.altitude_m}m excede el límite legal de 120m en muchos países.`
    );
  }

  return {
    waypoints,
    flightParams,
    warnings,
    simplificationStats,
  };
}

/**
 * Handle GENERATE_KMZ request.
 */
async function handleGenerateKmz(
  request: MissionRequest
): Promise<{
  kmzBlob: Blob;
  waypoints: Waypoint[];
  flightParams: FlightParams;
  warnings: string[];
  simplificationStats?: SimplificationStats;
}> {
  // First generate waypoints
  const result = await handleGenerateWaypoints(request);

  // Create KMZ
  const packager = new KMZPackager(
    request.drone_model,
    result.waypoints
  );

  const kmzBlob = await packager.createKmz(request.finish_action);

  return {
    kmzBlob,
    waypoints: result.waypoints,
    flightParams: result.flightParams,
    warnings: result.warnings,
    simplificationStats: result.simplificationStats,
  };
}

/**
 * Worker message handler.
 */
self.onmessage = async (event: MessageEvent<WorkerRequest>) => {
  const { id, type, payload } = event.data;

  try {
    let response: WorkerSuccessResponse;

    switch (type) {
      case 'GENERATE_WAYPOINTS': {
        const result = await handleGenerateWaypoints(payload);
        response = {
          id,
          type,
          success: true,
          data: {
            waypoints: result.waypoints,
            flightParams: result.flightParams,
            warnings: result.warnings,
            simplificationStats: result.simplificationStats,
          },
        };
        break;
      }

      case 'GENERATE_KMZ': {
        const result = await handleGenerateKmz(payload);
        response = {
          id,
          type,
          success: true,
          data: {
            waypoints: result.waypoints,
            flightParams: result.flightParams,
            warnings: result.warnings,
            simplificationStats: result.simplificationStats,
            kmzBlob: result.kmzBlob,
          },
        };
        break;
      }

      default:
        throw new Error(`Unknown request type: ${type}`);
    }

    self.postMessage(response);
  } catch (error) {
    const errorResponse: WorkerErrorResponse = {
      id,
      type,
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
    self.postMessage(errorResponse);
  }
};
