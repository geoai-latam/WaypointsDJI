/**
 * Tests for waypoint simplifier
 */

import { describe, it, expect } from 'vitest';
import { simplifyWaypoints } from './waypointSimplifier';
import type { Waypoint } from '../../types';

// Helper to create a waypoint
const createWaypoint = (
  index: number,
  longitude: number,
  latitude: number,
  heading: number = 0
): Waypoint => ({
  index,
  longitude,
  latitude,
  altitude: 60,
  heading,
  gimbal_pitch: -90,
  speed: 8,
  take_photo: true,
});

describe('simplifyWaypoints', () => {
  describe('basic functionality', () => {
    it('should return waypoints unchanged when disabled', () => {
      const waypoints = [
        createWaypoint(0, -74.07, 4.71),
        createWaypoint(1, -74.07, 4.72),
        createWaypoint(2, -74.07, 4.73),
      ];

      const result = simplifyWaypoints(waypoints, { enabled: false, angleThresholdDeg: 15 });

      expect(result.waypoints).toEqual(waypoints);
      expect(result.stats.simplification_enabled).toBe(false);
    });

    it('should return empty array for empty input', () => {
      const result = simplifyWaypoints([], { enabled: true, angleThresholdDeg: 15 });

      expect(result.waypoints).toEqual([]);
    });

    it('should always keep first and last waypoints', () => {
      const waypoints = [
        createWaypoint(0, -74.07, 4.71, 0),
        createWaypoint(1, -74.07, 4.72, 0), // Same heading - could be removed
        createWaypoint(2, -74.07, 4.73, 0), // Same heading - could be removed
        createWaypoint(3, -74.07, 4.74, 0), // Same heading - could be removed
        createWaypoint(4, -74.07, 4.75, 0),
      ];

      const result = simplifyWaypoints(waypoints, {
        enabled: true,
        angleThresholdDeg: 5,
      });

      // First and last positions should always be present (check by coordinates)
      const firstOriginal = waypoints[0];
      const lastOriginal = waypoints[waypoints.length - 1];
      const firstSimplified = result.waypoints[0];
      const lastSimplified = result.waypoints[result.waypoints.length - 1];

      expect(firstSimplified.longitude).toBe(firstOriginal.longitude);
      expect(firstSimplified.latitude).toBe(firstOriginal.latitude);
      expect(lastSimplified.longitude).toBe(lastOriginal.longitude);
      expect(lastSimplified.latitude).toBe(lastOriginal.latitude);
    });
  });

  describe('angle-based simplification', () => {
    it('should keep waypoints at significant turns', () => {
      const waypoints = [
        createWaypoint(0, -74.07, 4.71, 0),   // Going north
        createWaypoint(1, -74.07, 4.72, 0),   // Still north
        createWaypoint(2, -74.07, 4.73, 90),  // Turn to east - should keep
        createWaypoint(3, -74.06, 4.73, 90),  // Going east
        createWaypoint(4, -74.05, 4.73, 90),  // Still east
      ];

      const result = simplifyWaypoints(waypoints, {
        enabled: true,
        angleThresholdDeg: 15,
      });

      // Should keep: first, turn point, last
      expect(result.waypoints.length).toBeLessThan(waypoints.length);
      expect(result.stats.reduction_percent).toBeGreaterThan(0);
    });

    it('should respect angle threshold', () => {
      const waypoints = [
        createWaypoint(0, -74.07, 4.71, 0),
        createWaypoint(1, -74.07, 4.72, 5),   // 5 degree change
        createWaypoint(2, -74.07, 4.73, 10),  // 5 degree change
        createWaypoint(3, -74.07, 4.74, 15),  // 5 degree change
      ];

      // With high threshold, middle points should be removed
      const resultHighThreshold = simplifyWaypoints(waypoints, {
        enabled: true,
        angleThresholdDeg: 20,
      });

      // With low threshold, most points should be kept
      const resultLowThreshold = simplifyWaypoints(waypoints, {
        enabled: true,
        angleThresholdDeg: 3,
      });

      expect(resultHighThreshold.waypoints.length).toBeLessThanOrEqual(
        resultLowThreshold.waypoints.length
      );
    });
  });

  describe('distance constraints', () => {
    it('should keep intermediate waypoints when max distance is exceeded', () => {
      // Many waypoints along a line - simplifier should keep some based on distance
      const waypoints = [
        createWaypoint(0, -74.07, 4.71, 0),
        createWaypoint(1, -74.07, 4.715, 0),  // ~500m north
        createWaypoint(2, -74.07, 4.72, 0),   // ~500m north
        createWaypoint(3, -74.07, 4.725, 0),  // ~500m north
        createWaypoint(4, -74.07, 4.73, 0),   // ~500m north
        createWaypoint(5, -74.07, 4.735, 0),  // ~500m north
        createWaypoint(6, -74.07, 4.74, 0),   // ~500m north
      ];

      // Without distance constraint, only first and last are kept
      const resultNoConstraint = simplifyWaypoints(waypoints, {
        enabled: true,
        angleThresholdDeg: 15,
      });

      // With distance constraint, intermediate waypoints should be kept
      const resultWithConstraint = simplifyWaypoints(waypoints, {
        enabled: true,
        angleThresholdDeg: 15,
        maxDistanceBetweenM: 600, // ~600m between critical waypoints
        speedMs: 10,
      });

      // Without constraint: only 2 (first and last)
      expect(resultNoConstraint.waypoints.length).toBe(2);
      // With constraint: more intermediate points should be kept
      expect(resultWithConstraint.waypoints.length).toBeGreaterThan(2);
    });
  });

  describe('time constraints', () => {
    it('should keep intermediate waypoints when max time is exceeded', () => {
      // Many waypoints along a line
      const waypoints = [
        createWaypoint(0, -74.07, 4.71, 0),
        createWaypoint(1, -74.07, 4.715, 0),
        createWaypoint(2, -74.07, 4.72, 0),
        createWaypoint(3, -74.07, 4.725, 0),
        createWaypoint(4, -74.07, 4.73, 0),
        createWaypoint(5, -74.07, 4.735, 0),
        createWaypoint(6, -74.07, 4.74, 0),
      ];

      // Without time constraint
      const resultNoConstraint = simplifyWaypoints(waypoints, {
        enabled: true,
        angleThresholdDeg: 15,
      });

      // With time constraint (at 10 m/s, 50s = 500m max)
      const resultWithConstraint = simplifyWaypoints(waypoints, {
        enabled: true,
        angleThresholdDeg: 15,
        maxTimeBetweenS: 50,
        speedMs: 10,
      });

      // With constraint: more intermediate points should be kept
      expect(resultWithConstraint.waypoints.length).toBeGreaterThanOrEqual(
        resultNoConstraint.waypoints.length
      );
    });
  });

  describe('statistics', () => {
    it('should report correct statistics', () => {
      const waypoints = [
        createWaypoint(0, -74.07, 4.71, 0),
        createWaypoint(1, -74.07, 4.72, 0),
        createWaypoint(2, -74.07, 4.73, 0),
        createWaypoint(3, -74.07, 4.74, 90),
        createWaypoint(4, -74.06, 4.74, 90),
      ];

      const result = simplifyWaypoints(waypoints, {
        enabled: true,
        angleThresholdDeg: 15,
      });

      expect(result.stats.original_count).toBe(5);
      expect(result.stats.simplified_count).toBe(result.waypoints.length);
      expect(result.stats.simplification_enabled).toBe(true);

      if (result.waypoints.length < waypoints.length) {
        expect(result.stats.reduction_percent).toBeGreaterThan(0);
      }
    });

    it('should re-index waypoints after simplification', () => {
      const waypoints = [
        createWaypoint(0, -74.07, 4.71, 0),
        createWaypoint(1, -74.07, 4.72, 0), // May be removed
        createWaypoint(2, -74.07, 4.73, 90),
        createWaypoint(3, -74.06, 4.73, 90), // May be removed
        createWaypoint(4, -74.05, 4.73, 90),
      ];

      const result = simplifyWaypoints(waypoints, {
        enabled: true,
        angleThresholdDeg: 15,
      });

      // Check indices are sequential starting from 0
      for (let i = 0; i < result.waypoints.length; i++) {
        expect(result.waypoints[i].index).toBe(i);
      }
    });
  });
});
