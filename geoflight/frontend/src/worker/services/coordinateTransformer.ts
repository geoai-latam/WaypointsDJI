/**
 * Coordinate transformation utilities using proj4.
 * Port of backend/app/patterns/base.py coordinate transformation logic.
 */

import proj4 from 'proj4';
import type { Coordinate } from '../../types';

export interface CoordinateTransformer {
  toUtm: (lon: number, lat: number) => [number, number];
  toWgs84: (x: number, y: number) => [number, number];
  utmZone: number;
}

/**
 * Get UTM zone for a longitude value.
 */
export function getUtmZone(lon: number): number {
  return Math.floor((lon + 180) / 6) + 1;
}

/**
 * Create coordinate transformers for a given center point.
 * Returns functions to convert between WGS84 and UTM.
 */
export function createTransformer(centerLon: number, centerLat: number): CoordinateTransformer {
  const zone = getUtmZone(centerLon);
  const hemisphere = centerLat >= 0 ? 'north' : 'south';

  // Define the projections
  const wgs84 = 'EPSG:4326';
  const southParam = hemisphere === 'south' ? '+south ' : '';
  const utmProj = `+proj=utm +zone=${zone} ${southParam}+datum=WGS84 +units=m +no_defs`;

  console.log('[CoordTransformer] Creating transformer for zone', zone, hemisphere);
  console.log('[CoordTransformer] UTM proj:', utmProj);

  return {
    toUtm: (lon: number, lat: number): [number, number] => {
      if (isNaN(lon) || isNaN(lat)) {
        console.error('[CoordTransformer] Invalid input to toUtm:', lon, lat);
        throw new Error(`Invalid coordinates: lon=${lon}, lat=${lat}`);
      }
      const result = proj4(wgs84, utmProj, [lon, lat]);
      if (isNaN(result[0]) || isNaN(result[1])) {
        console.error('[CoordTransformer] proj4 returned NaN for:', lon, lat, '-> result:', result);
        throw new Error(`Coordinate transformation failed for lon=${lon}, lat=${lat}`);
      }
      return [result[0], result[1]];
    },
    toWgs84: (x: number, y: number): [number, number] => {
      if (isNaN(x) || isNaN(y)) {
        console.error('[CoordTransformer] Invalid input to toWgs84:', x, y);
        throw new Error(`Invalid UTM coordinates: x=${x}, y=${y}`);
      }
      const result = proj4(utmProj, wgs84, [x, y]);
      if (isNaN(result[0]) || isNaN(result[1])) {
        console.error('[CoordTransformer] proj4 returned NaN for UTM:', x, y, '-> result:', result);
        throw new Error(`Coordinate transformation failed for x=${x}, y=${y}`);
      }
      return [result[0], result[1]];
    },
    utmZone: zone,
  };
}

/**
 * Convert an array of WGS84 coordinates to UTM.
 */
export function coordsToUtm(
  coords: Coordinate[],
  transformer: CoordinateTransformer
): [number, number][] {
  return coords.map(c => transformer.toUtm(c.longitude, c.latitude));
}

/**
 * Convert an array of UTM coordinates to WGS84.
 */
export function coordsToWgs84(
  coords: [number, number][],
  transformer: CoordinateTransformer
): [number, number][] {
  return coords.map(([x, y]) => transformer.toWgs84(x, y));
}

/**
 * Calculate the center point of a set of coordinates.
 */
export function calculateCenter(coords: Coordinate[]): { lon: number; lat: number } {
  const sumLon = coords.reduce((sum, c) => sum + c.longitude, 0);
  const sumLat = coords.reduce((sum, c) => sum + c.latitude, 0);
  return {
    lon: sumLon / coords.length,
    lat: sumLat / coords.length,
  };
}

/**
 * Calculate heading between two points in degrees (0-360).
 * Uses atan2(dx, dy) for heading from north.
 */
export function calculateHeading(from: [number, number], to: [number, number]): number {
  const dx = to[0] - from[0];
  const dy = to[1] - from[1];
  const headingRad = Math.atan2(dx, dy); // atan2(x,y) for heading from north
  let heading = headingRad * (180 / Math.PI);
  return ((heading % 360) + 360) % 360;
}
