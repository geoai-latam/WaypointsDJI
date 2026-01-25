/**
 * Photogrammetric calculations for flight planning.
 * Migrated from backend to run entirely in the browser.
 */

import type { CameraSpec, DroneModel, FlightParams } from '../types';
import { CAMERA_PRESETS } from '../types';

export interface CalculateParams {
  droneModel: DroneModel;
  targetGsdCm: number;
  frontOverlapPct: number;
  sideOverlapPct: number;
  use48mp: boolean;
  areaSqM?: number;
  altitudeOverrideM?: number;
  // Timer mode parameters
  useTimerMode?: boolean;
  photoIntervalS?: number;
  speedMs?: number;
}

/**
 * Calculate flight altitude from target GSD.
 * Formula: altitude = (GSD * focal_length * image_width) / (sensor_width * 100)
 */
function gsdToAltitude(gsdCm: number, camera: CameraSpec): number {
  return (gsdCm * camera.focal_length_mm * camera.image_width_px) / (camera.sensor_width_mm * 100);
}

/**
 * Calculate GSD from flight altitude.
 * Formula: GSD = (sensor_width * altitude * 100) / (focal_length * image_width)
 */
function altitudeToGsd(altitudeM: number, camera: CameraSpec): number {
  return (camera.sensor_width_mm * altitudeM * 100) / (camera.focal_length_mm * camera.image_width_px);
}

/**
 * Calculate ground footprint dimensions.
 * Formula: dimension = (sensor_size / focal_length) * altitude
 */
function calculateFootprint(altitudeM: number, camera: CameraSpec): { width: number; height: number } {
  return {
    width: (camera.sensor_width_mm / camera.focal_length_mm) * altitudeM,
    height: (camera.sensor_height_mm / camera.focal_length_mm) * altitudeM,
  };
}

/**
 * Calculate photo and line spacing from overlap requirements.
 */
function calculateSpacing(
  altitudeM: number,
  frontOverlapPct: number,
  sideOverlapPct: number,
  camera: CameraSpec
): { photoSpacing: number; lineSpacing: number } {
  const footprint = calculateFootprint(altitudeM, camera);
  return {
    photoSpacing: footprint.height * (1 - frontOverlapPct / 100),
    lineSpacing: footprint.width * (1 - sideOverlapPct / 100),
  };
}

/**
 * Calculate all flight parameters.
 * This replaces the /api/calculate endpoint.
 */
export function calculateFlightParams(params: CalculateParams): FlightParams {
  const camera = CAMERA_PRESETS[params.droneModel];

  // Calculate altitude (use override if provided)
  let altitude: number;
  let actualGsd: number;

  if (params.altitudeOverrideM !== undefined) {
    altitude = params.altitudeOverrideM;
    actualGsd = altitudeToGsd(altitude, camera);
  } else {
    altitude = gsdToAltitude(params.targetGsdCm, camera);
    actualGsd = altitudeToGsd(altitude, camera);
  }

  // Calculate footprint and spacing for desired overlap
  const footprint = calculateFootprint(altitude, camera);
  const spacing = calculateSpacing(altitude, params.frontOverlapPct, params.sideOverlapPct, camera);

  // Photo interval: use custom if in timer mode, otherwise use camera default
  const defaultInterval = params.use48mp ? camera.min_interval_48mp : camera.min_interval_12mp;
  const interval = (params.useTimerMode && params.photoIntervalS)
    ? params.photoIntervalS
    : defaultInterval;

  // Speed needed to achieve desired overlap with current interval
  const speedForDesiredOverlap = spacing.photoSpacing / interval;

  // Timer mode: calculate actual values based on user's speed setting
  let actualSpeed: number | undefined;
  let actualPhotoSpacing: number | undefined;
  let actualFrontOverlap: number | undefined;

  if (params.useTimerMode && params.speedMs !== undefined) {
    actualSpeed = params.speedMs;
    actualPhotoSpacing = actualSpeed * interval;
    // Calculate actual overlap: overlap = 1 - (spacing / footprint_height)
    actualFrontOverlap = Math.round((1 - actualPhotoSpacing / footprint.height) * 100);
    // Clamp to valid range
    actualFrontOverlap = Math.max(0, Math.min(99, actualFrontOverlap));
  }

  // Effective speed for estimates
  const effectiveSpeed = actualSpeed ?? speedForDesiredOverlap;

  // Estimate photos and flight time if area is provided
  let estimatedPhotos = 0;
  let flightTime = 0;

  if (params.areaSqM && params.areaSqM > 0) {
    const effectivePhotoSpacing = actualPhotoSpacing ?? spacing.photoSpacing;
    const effectiveCoverage = effectivePhotoSpacing * spacing.lineSpacing;
    estimatedPhotos = Math.floor((params.areaSqM / effectiveCoverage) * 1.2); // 20% margin

    const sideLength = Math.sqrt(params.areaSqM);
    const numLines = sideLength / spacing.lineSpacing;
    const flightDistance = sideLength * numLines * 1.1; // 10% for turns
    flightTime = (flightDistance / effectiveSpeed) / 60; // minutes
  }

  return {
    altitude_m: Math.round(altitude * 10) / 10,
    gsd_cm_px: Math.round(actualGsd * 1000) / 1000,
    footprint_width_m: Math.round(footprint.width * 100) / 100,
    footprint_height_m: Math.round(footprint.height * 100) / 100,
    line_spacing_m: Math.round(spacing.lineSpacing * 100) / 100,
    photo_spacing_m: Math.round(spacing.photoSpacing * 100) / 100,
    max_speed_ms: Math.round(speedForDesiredOverlap * 100) / 100,
    photo_interval_s: interval,
    estimated_photos: estimatedPhotos,
    estimated_flight_time_min: Math.round(flightTime * 10) / 10,
    // Timer mode values
    actual_speed_ms: actualSpeed !== undefined ? Math.round(actualSpeed * 100) / 100 : undefined,
    actual_photo_spacing_m: actualPhotoSpacing !== undefined ? Math.round(actualPhotoSpacing * 100) / 100 : undefined,
    actual_front_overlap_pct: actualFrontOverlap,
  };
}
