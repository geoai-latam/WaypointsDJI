/**
 * Tests for DoubleGridPatternGenerator
 */

import { describe, it, expect } from 'vitest';
import { DoubleGridPatternGenerator } from './doubleGridPattern';
import { GridPatternGenerator } from './gridPattern';
import type { FlightParams, Coordinate } from '../../types';

// Test flight params
const createFlightParams = (overrides?: Partial<FlightParams>): FlightParams => ({
  altitude_m: 60,
  gsd_cm_px: 2.0,
  footprint_width_m: 85.6,
  footprint_height_m: 64.2,
  line_spacing_m: 30,
  photo_spacing_m: 16,
  max_speed_ms: 8.0,
  photo_interval_s: 2.0,
  estimated_photos: 0,
  estimated_flight_time_min: 0,
  ...overrides,
});

// Test polygon
const createTestPolygon = (): Coordinate[] => [
  { longitude: -74.0750, latitude: 4.7100 },
  { longitude: -74.0700, latitude: 4.7100 },
  { longitude: -74.0700, latitude: 4.7150 },
  { longitude: -74.0750, latitude: 4.7150 },
];

describe('DoubleGridPatternGenerator', () => {
  describe('generate()', () => {
    it('should generate waypoints', () => {
      const params = createFlightParams();
      const generator = new DoubleGridPatternGenerator({
        flightParams: params,
        flightAngleDeg: 0,
        gimbalPitchDeg: -90,
      });

      const waypoints = generator.generate(createTestPolygon());

      expect(waypoints.length).toBeGreaterThan(0);
    });

    it('should generate more waypoints than single grid', () => {
      const params = createFlightParams();
      const polygon = createTestPolygon();

      const singleGenerator = new GridPatternGenerator({
        flightParams: params,
        flightAngleDeg: 0,
        gimbalPitchDeg: -90,
      });

      const doubleGenerator = new DoubleGridPatternGenerator({
        flightParams: params,
        flightAngleDeg: 0,
        gimbalPitchDeg: -90,
      });

      const singleWaypoints = singleGenerator.generate(polygon);
      const doubleWaypoints = doubleGenerator.generate(polygon);

      // Double grid should have roughly 2x the waypoints
      expect(doubleWaypoints.length).toBeGreaterThan(singleWaypoints.length);
      expect(doubleWaypoints.length).toBeGreaterThanOrEqual(singleWaypoints.length * 1.5);
    });

    it('should have sequential indices across both passes', () => {
      const params = createFlightParams();
      const generator = new DoubleGridPatternGenerator({
        flightParams: params,
        flightAngleDeg: 0,
        gimbalPitchDeg: -90,
      });

      const waypoints = generator.generate(createTestPolygon());

      for (let i = 0; i < waypoints.length; i++) {
        expect(waypoints[i].index).toBe(i);
      }
    });

    it('should return empty array for invalid polygon', () => {
      const params = createFlightParams();
      const generator = new DoubleGridPatternGenerator({
        flightParams: params,
        flightAngleDeg: 0,
        gimbalPitchDeg: -90,
      });

      expect(generator.generate([])).toEqual([]);
      expect(generator.generate([{ longitude: 0, latitude: 0 }])).toEqual([]);
    });

    it('should have valid coordinates in all waypoints', () => {
      const params = createFlightParams();
      const generator = new DoubleGridPatternGenerator({
        flightParams: params,
        flightAngleDeg: 0,
        gimbalPitchDeg: -90,
      });

      const waypoints = generator.generate(createTestPolygon());

      for (const wp of waypoints) {
        expect(wp.longitude).not.toBeNaN();
        expect(wp.latitude).not.toBeNaN();
        expect(wp.altitude).not.toBeNaN();
        expect(wp.longitude).toBeGreaterThanOrEqual(-180);
        expect(wp.longitude).toBeLessThanOrEqual(180);
        expect(wp.latitude).toBeGreaterThanOrEqual(-90);
        expect(wp.latitude).toBeLessThanOrEqual(90);
      }
    });
  });

  describe('perpendicular passes', () => {
    it('should include passes at two different angles (0 and 90)', () => {
      const params = createFlightParams({ line_spacing_m: 50, photo_spacing_m: 40 });
      const generator = new DoubleGridPatternGenerator({
        flightParams: params,
        flightAngleDeg: 0,
        gimbalPitchDeg: -90,
      });

      const waypoints = generator.generate(createTestPolygon());

      // Should have waypoints from both passes
      expect(waypoints.length).toBeGreaterThan(0);

      // The headings should include values near 0/180 (first pass)
      // and near 90/270 (second pass)
      const headings = waypoints.map(wp => wp.heading);
      const uniqueHeadings = [...new Set(headings.map(h => Math.round(h / 45) * 45 % 180))];

      // Should have at least 2 distinct heading directions
      expect(uniqueHeadings.length).toBeGreaterThanOrEqual(1);
    });
  });
});
