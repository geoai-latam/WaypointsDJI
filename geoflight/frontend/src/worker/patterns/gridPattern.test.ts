/**
 * Tests for GridPatternGenerator
 */

import { describe, it, expect } from 'vitest';
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

// Test polygon - simple 100m x 100m square in Bogota area
const createTestPolygon = (): Coordinate[] => [
  { longitude: -74.0721, latitude: 4.7110 },
  { longitude: -74.0711, latitude: 4.7110 },  // ~100m east
  { longitude: -74.0711, latitude: 4.7120 },  // ~100m north
  { longitude: -74.0721, latitude: 4.7120 },
];

describe('GridPatternGenerator', () => {
  describe('generate()', () => {
    it('should generate waypoints for a simple polygon', () => {
      const params = createFlightParams();
      const generator = new GridPatternGenerator({
        flightParams: params,
        flightAngleDeg: 0,
        gimbalPitchDeg: -90,
      });

      const polygon = createTestPolygon();
      const waypoints = generator.generate(polygon);

      expect(waypoints.length).toBeGreaterThan(0);
      expect(waypoints[0]).toHaveProperty('longitude');
      expect(waypoints[0]).toHaveProperty('latitude');
      expect(waypoints[0]).toHaveProperty('altitude');
    });

    it('should set correct altitude on all waypoints', () => {
      const params = createFlightParams({ altitude_m: 80 });
      const generator = new GridPatternGenerator({
        flightParams: params,
        flightAngleDeg: 0,
        gimbalPitchDeg: -90,
      });

      const waypoints = generator.generate(createTestPolygon());

      expect(waypoints.every(wp => wp.altitude === 80)).toBe(true);
    });

    it('should set correct gimbal pitch on all waypoints', () => {
      const params = createFlightParams();
      const generator = new GridPatternGenerator({
        flightParams: params,
        flightAngleDeg: 0,
        gimbalPitchDeg: -45,
      });

      const waypoints = generator.generate(createTestPolygon());

      expect(waypoints.every(wp => wp.gimbal_pitch === -45)).toBe(true);
    });

    it('should return empty array for empty polygon', () => {
      const params = createFlightParams();
      const generator = new GridPatternGenerator({
        flightParams: params,
        flightAngleDeg: 0,
        gimbalPitchDeg: -90,
      });

      const waypoints = generator.generate([]);

      expect(waypoints).toEqual([]);
    });

    it('should return empty array for polygon with less than 3 points', () => {
      const params = createFlightParams();
      const generator = new GridPatternGenerator({
        flightParams: params,
        flightAngleDeg: 0,
        gimbalPitchDeg: -90,
      });

      const waypoints = generator.generate([
        { longitude: -74.0721, latitude: 4.7110 },
        { longitude: -74.0711, latitude: 4.7110 },
      ]);

      expect(waypoints).toEqual([]);
    });

    it('should generate different patterns for different flight angles', () => {
      const params = createFlightParams();
      const polygon = createTestPolygon();

      const generator0 = new GridPatternGenerator({
        flightParams: params,
        flightAngleDeg: 0,
        gimbalPitchDeg: -90,
      });

      const generator45 = new GridPatternGenerator({
        flightParams: params,
        flightAngleDeg: 45,
        gimbalPitchDeg: -90,
      });

      const generator90 = new GridPatternGenerator({
        flightParams: params,
        flightAngleDeg: 90,
        gimbalPitchDeg: -90,
      });

      const waypoints0 = generator0.generate(polygon);
      const waypoints45 = generator45.generate(polygon);
      const waypoints90 = generator90.generate(polygon);

      // All should generate waypoints
      expect(waypoints0.length).toBeGreaterThan(0);
      expect(waypoints45.length).toBeGreaterThan(0);
      expect(waypoints90.length).toBeGreaterThan(0);

      // First waypoints should be different (different starting positions)
      expect(waypoints0[0].longitude).not.toBe(waypoints45[0].longitude);
    });

    it('should have valid coordinates in all waypoints', () => {
      const params = createFlightParams();
      const generator = new GridPatternGenerator({
        flightParams: params,
        flightAngleDeg: 0,
        gimbalPitchDeg: -90,
      });

      const waypoints = generator.generate(createTestPolygon());

      for (const wp of waypoints) {
        expect(wp.longitude).not.toBeNaN();
        expect(wp.latitude).not.toBeNaN();
        expect(wp.longitude).toBeGreaterThanOrEqual(-180);
        expect(wp.longitude).toBeLessThanOrEqual(180);
        expect(wp.latitude).toBeGreaterThanOrEqual(-90);
        expect(wp.latitude).toBeLessThanOrEqual(90);
      }
    });

    it('should have sequential indices', () => {
      const params = createFlightParams();
      const generator = new GridPatternGenerator({
        flightParams: params,
        flightAngleDeg: 0,
        gimbalPitchDeg: -90,
      });

      const waypoints = generator.generate(createTestPolygon());

      for (let i = 0; i < waypoints.length; i++) {
        expect(waypoints[i].index).toBe(i);
      }
    });
  });

  describe('buffer polygon', () => {
    it('should generate waypoints that cover the polygon area', () => {
      const params = createFlightParams({ line_spacing_m: 20 });
      const generator = new GridPatternGenerator({
        flightParams: params,
        flightAngleDeg: 0,
        gimbalPitchDeg: -90,
      });

      const polygon = createTestPolygon();
      const waypoints = generator.generate(polygon);

      // Find min/max of polygon
      const polyMinLon = Math.min(...polygon.map(c => c.longitude));
      const polyMaxLon = Math.max(...polygon.map(c => c.longitude));
      const polyMinLat = Math.min(...polygon.map(c => c.latitude));
      const polyMaxLat = Math.max(...polygon.map(c => c.latitude));

      // Find min/max of waypoints
      const wpMinLon = Math.min(...waypoints.map(wp => wp.longitude));
      const wpMaxLon = Math.max(...waypoints.map(wp => wp.longitude));
      const wpMinLat = Math.min(...waypoints.map(wp => wp.latitude));
      const wpMaxLat = Math.max(...waypoints.map(wp => wp.latitude));

      // Waypoints should cover most of the polygon area
      // Allow some tolerance as lines are clipped to polygon
      const tolerance = 0.0003; // ~30m tolerance for edge effects

      // Waypoints should be within a reasonable margin of the polygon
      expect(wpMinLon).toBeGreaterThan(polyMinLon - tolerance);
      expect(wpMaxLon).toBeLessThan(polyMaxLon + tolerance);
      expect(wpMinLat).toBeGreaterThan(polyMinLat - tolerance);
      expect(wpMaxLat).toBeLessThan(polyMaxLat + tolerance);

      // And waypoints should reach close to all edges
      // At least 50% coverage of polygon dimensions
      expect(wpMaxLon - wpMinLon).toBeGreaterThan((polyMaxLon - polyMinLon) * 0.5);
      expect(wpMaxLat - wpMinLat).toBeGreaterThan((polyMaxLat - polyMinLat) * 0.5);
    });
  });

  describe('serpentine pattern', () => {
    it('should create alternating line directions (serpentine)', () => {
      const params = createFlightParams({ line_spacing_m: 50, photo_spacing_m: 40 });
      const generator = new GridPatternGenerator({
        flightParams: params,
        flightAngleDeg: 0,
        gimbalPitchDeg: -90,
      });

      // Larger polygon to ensure multiple lines
      const polygon: Coordinate[] = [
        { longitude: -74.0750, latitude: 4.7100 },
        { longitude: -74.0700, latitude: 4.7100 },
        { longitude: -74.0700, latitude: 4.7150 },
        { longitude: -74.0750, latitude: 4.7150 },
      ];

      const waypoints = generator.generate(polygon);

      // Should have enough waypoints for multiple lines
      expect(waypoints.length).toBeGreaterThan(10);

      // Check that consecutive waypoints form a reasonable path
      // (no huge jumps that would indicate non-serpentine pattern)
      for (let i = 1; i < waypoints.length; i++) {
        const prev = waypoints[i - 1];
        const curr = waypoints[i];

        // Distance between consecutive waypoints should be reasonable
        // (either along the line or transitioning to next line)
        const dLon = Math.abs(curr.longitude - prev.longitude);
        const dLat = Math.abs(curr.latitude - prev.latitude);

        // In degrees, 0.001 ≈ 100m. Max reasonable jump should be less than ~200m
        expect(dLon).toBeLessThan(0.002);
        expect(dLat).toBeLessThan(0.002);
      }
    });
  });

  describe('line spacing', () => {
    it('should respect line spacing parameter', () => {
      const polygon: Coordinate[] = [
        { longitude: -74.0750, latitude: 4.7100 },
        { longitude: -74.0700, latitude: 4.7100 },
        { longitude: -74.0700, latitude: 4.7150 },
        { longitude: -74.0750, latitude: 4.7150 },
      ];

      // Test with different line spacings
      const params20 = createFlightParams({ line_spacing_m: 20, photo_spacing_m: 10 });
      const params50 = createFlightParams({ line_spacing_m: 50, photo_spacing_m: 10 });

      const generator20 = new GridPatternGenerator({
        flightParams: params20,
        flightAngleDeg: 0,
        gimbalPitchDeg: -90,
      });

      const generator50 = new GridPatternGenerator({
        flightParams: params50,
        flightAngleDeg: 0,
        gimbalPitchDeg: -90,
      });

      const waypoints20 = generator20.generate(polygon);
      const waypoints50 = generator50.generate(polygon);

      // Smaller line spacing should result in more waypoints
      expect(waypoints20.length).toBeGreaterThan(waypoints50.length);
    });
  });
});
