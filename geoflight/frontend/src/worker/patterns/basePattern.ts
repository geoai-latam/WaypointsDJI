/**
 * Base class for flight pattern generators.
 * Port of backend/app/patterns/base.py
 */

import type { Waypoint, FlightParams, Coordinate } from '../../types';
import {
  createTransformer,
  calculateCenter,
  calculateHeading,
  type CoordinateTransformer,
} from '../services/coordinateTransformer';

export interface PatternGeneratorConfig {
  flightParams: FlightParams;
  flightAngleDeg: number;
  gimbalPitchDeg: number;
}

export abstract class PatternGenerator {
  protected flightParams: FlightParams;
  protected flightAngleDeg: number;
  protected gimbalPitchDeg: number;
  protected transformer: CoordinateTransformer | null = null;

  constructor(config: PatternGeneratorConfig) {
    this.flightParams = config.flightParams;
    this.flightAngleDeg = config.flightAngleDeg;
    this.gimbalPitchDeg = config.gimbalPitchDeg;
  }

  /**
   * Setup coordinate transformers based on center point.
   */
  protected setupTransformers(coords: Coordinate[]): void {
    const center = calculateCenter(coords);
    this.transformer = createTransformer(center.lon, center.lat);
  }

  /**
   * Convert WGS84 coordinates to UTM.
   */
  protected toUtmCoords(coords: Coordinate[]): [number, number][] {
    if (!this.transformer) {
      throw new Error('Transformers not initialized');
    }
    return coords.map(c => this.transformer!.toUtm(c.longitude, c.latitude));
  }

  /**
   * Convert UTM coordinates to WGS84.
   */
  protected toWgs84Coords(coords: [number, number][]): [number, number][] {
    if (!this.transformer) {
      throw new Error('Transformers not initialized');
    }
    return coords.map(([x, y]) => this.transformer!.toWgs84(x, y));
  }

  /**
   * Calculate heading between two UTM points in degrees (0-360).
   */
  protected calculateHeading(from: [number, number], to: [number, number]): number {
    return calculateHeading(from, to);
  }

  /**
   * Create a waypoint with standard parameters.
   */
  protected createWaypoint(
    index: number,
    lon: number,
    lat: number,
    heading: number = 0,
    gimbalPitch?: number,
    takePhoto: boolean = true
  ): Waypoint {
    const pitch = gimbalPitch ?? this.gimbalPitchDeg;
    return {
      index,
      longitude: lon,
      latitude: lat,
      altitude: this.flightParams.altitude_m,
      heading,
      gimbal_pitch: pitch,
      speed: this.flightParams.max_speed_ms,
      take_photo: takePhoto,
    };
  }

  /**
   * Generate waypoints for this pattern.
   * Abstract method to be implemented by subclasses.
   */
  abstract generate(polygonCoords: Coordinate[], options?: Record<string, unknown>): Waypoint[];
}
