/**
 * Waypoint simplifier for reducing mission complexity.
 * Port of backend/app/waypoint_simplifier.py
 *
 * Useful because:
 * - DJI Fly has a limit of 99 waypoints per mission
 * - Drones can follow a heading with a timer (e.g., every 5 seconds)
 * - Only waypoints at direction changes are strictly necessary
 */

import type { Waypoint, SimplificationStats } from '../../types';

export interface SimplificationOptions {
  enabled: boolean;
  angleThresholdDeg: number;
  maxDistanceBetweenM?: number;
  maxTimeBetweenS?: number;
  speedMs?: number;
}

/**
 * Haversine distance between two points in meters.
 */
function haversineDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371000; // Earth's radius in meters

  const lat1Rad = lat1 * (Math.PI / 180);
  const lat2Rad = lat2 * (Math.PI / 180);
  const deltaLat = (lat2 - lat1) * (Math.PI / 180);
  const deltaLon = (lon2 - lon1) * (Math.PI / 180);

  const a =
    Math.sin(deltaLat / 2) ** 2 +
    Math.cos(lat1Rad) * Math.cos(lat2Rad) * Math.sin(deltaLon / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c;
}

/**
 * Find indices of critical waypoints (turns and endpoints).
 * A waypoint is critical if:
 * - It's the first or last waypoint
 * - Its heading differs significantly from the previous waypoint
 */
function findCriticalWaypoints(waypoints: Waypoint[], angleThresholdDeg: number): Set<number> {
  const critical = new Set<number>([0, waypoints.length - 1]); // Always keep first and last

  for (let i = 1; i < waypoints.length; i++) {
    const prevHeading = waypoints[i - 1].heading;
    const currHeading = waypoints[i].heading;

    // Calculate heading difference (handle 360/0 wrap-around)
    let diff = Math.abs(currHeading - prevHeading);
    if (diff > 180) {
      diff = 360 - diff;
    }

    if (diff >= angleThresholdDeg) {
      // Keep both the waypoint before the turn and the turn waypoint
      critical.add(i - 1);
      critical.add(i);
    }
  }

  return critical;
}

/**
 * Add intermediate waypoints to maintain spacing constraints.
 */
function addIntermediateWaypoints(
  waypoints: Waypoint[],
  criticalIndices: Set<number>,
  maxDistanceM: number | undefined,
  maxTimeS: number | undefined,
  defaultSpeedMs: number
): Set<number> {
  const result = new Set(criticalIndices);
  const sortedCritical = Array.from(criticalIndices).sort((a, b) => a - b);

  for (let i = 0; i < sortedCritical.length - 1; i++) {
    const startIdx = sortedCritical[i];
    const endIdx = sortedCritical[i + 1];

    // No intermediate waypoints to consider
    if (endIdx - startIdx <= 1) {
      continue;
    }

    // Calculate max allowed distance
    let maxDist = maxDistanceM;
    if (maxTimeS !== undefined) {
      // Use the speed from the start waypoint for time-based calculation
      const speed = waypoints[startIdx].speed || defaultSpeedMs;
      maxDist = maxTimeS * speed;
    }

    if (!maxDist) {
      continue;
    }

    // Add intermediate waypoints as needed
    let lastAddedIdx = startIdx;

    for (let j = startIdx + 1; j < endIdx; j++) {
      const dist = haversineDistance(
        waypoints[lastAddedIdx].latitude,
        waypoints[lastAddedIdx].longitude,
        waypoints[j].latitude,
        waypoints[j].longitude
      );

      // If we've exceeded max distance, add this waypoint
      if (dist >= maxDist) {
        result.add(j);
        lastAddedIdx = j;
      }
    }
  }

  return result;
}

/**
 * Simplify a list of waypoints.
 *
 * The algorithm:
 * 1. Always keep first and last waypoints
 * 2. Detect heading changes >= angle_threshold and keep those waypoints
 * 3. If max_distance or max_time is set, add intermediate waypoints
 */
export function simplifyWaypoints(
  waypoints: Waypoint[],
  options: SimplificationOptions
): { waypoints: Waypoint[]; stats: SimplificationStats } {
  const defaultStats: SimplificationStats = {
    original_count: waypoints.length,
    simplified_count: waypoints.length,
    reduction_percent: 0,
    simplification_enabled: false,
  };

  if (!options.enabled || waypoints.length <= 2) {
    return { waypoints, stats: defaultStats };
  }

  // Step 1: Find critical waypoints (turns and endpoints)
  let criticalIndices = findCriticalWaypoints(waypoints, options.angleThresholdDeg);

  // Step 2: Add intermediate waypoints if spacing constraints are set
  if (options.maxDistanceBetweenM !== undefined || options.maxTimeBetweenS !== undefined) {
    criticalIndices = addIntermediateWaypoints(
      waypoints,
      criticalIndices,
      options.maxDistanceBetweenM,
      options.maxTimeBetweenS,
      options.speedMs ?? 5.0
    );
  }

  // Step 3: Build simplified list
  const sortedIndices = Array.from(criticalIndices).sort((a, b) => a - b);
  const simplified: Waypoint[] = sortedIndices.map((originalIdx, newIdx) => {
    const wp = waypoints[originalIdx];
    return {
      ...wp,
      index: newIdx,
    };
  });

  const originalCount = waypoints.length;
  const simplifiedCount = simplified.length;
  const reduction = originalCount > 0
    ? ((originalCount - simplifiedCount) / originalCount) * 100
    : 0;

  return {
    waypoints: simplified,
    stats: {
      original_count: originalCount,
      simplified_count: simplifiedCount,
      reduction_percent: Math.round(reduction * 10) / 10,
      simplification_enabled: true,
    },
  };
}
