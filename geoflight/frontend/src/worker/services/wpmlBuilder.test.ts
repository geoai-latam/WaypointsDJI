/**
 * Tests for WPML Builder
 */

import { describe, it, expect } from 'vitest';
import { WPMLBuilder } from './wpmlBuilder';
import type { Waypoint } from '../../types';

// Helper to create a waypoint
const createWaypoint = (
  index: number,
  longitude: number,
  latitude: number,
  heading: number = 0,
  gimbal_pitch: number = -90
): Waypoint => ({
  index,
  longitude,
  latitude,
  altitude: 60,
  heading,
  gimbal_pitch,
  speed: 8,
  take_photo: true,
});

describe('WPMLBuilder', () => {
  describe('buildTemplateKml', () => {
    it('should generate valid template KML', () => {
      const waypoints = [
        createWaypoint(0, -74.07, 4.71),
        createWaypoint(1, -74.07, 4.72),
      ];

      const builder = new WPMLBuilder('mini_4_pro', waypoints);
      const kml = builder.buildTemplateKml('goHome');

      expect(kml).toContain('<?xml version="1.0" encoding="UTF-8"?>');
      expect(kml).toContain('<kml');
      expect(kml).toContain('xmlns:wpml');
      expect(kml).toContain('GeoFlight Planner');
      expect(kml).toContain('<wpml:finishAction>goHome</wpml:finishAction>');
      expect(kml).toContain('<wpml:droneEnumValue>91</wpml:droneEnumValue>');
    });

    it('should use correct drone enum for different models', () => {
      const waypoints = [createWaypoint(0, -74.07, 4.71)];

      const builder4Pro = new WPMLBuilder('mini_4_pro', waypoints);
      const builder5Pro = new WPMLBuilder('mini_5_pro', waypoints);

      expect(builder4Pro.buildTemplateKml()).toContain('<wpml:droneEnumValue>91</wpml:droneEnumValue>');
      expect(builder5Pro.buildTemplateKml()).toContain('<wpml:droneEnumValue>100</wpml:droneEnumValue>');
    });
  });

  describe('buildWaylinesWpml', () => {
    it('should generate valid waylines WPML', () => {
      const waypoints = [
        createWaypoint(0, -74.07, 4.71),
        createWaypoint(1, -74.07, 4.72),
        createWaypoint(2, -74.07, 4.73),
      ];

      const builder = new WPMLBuilder('mini_4_pro', waypoints);
      const wpml = builder.buildWaylinesWpml();

      expect(wpml).toContain('<?xml version="1.0" encoding="UTF-8"?>');
      expect(wpml).toContain('<Placemark>');
      expect(wpml).toContain('<wpml:index>0</wpml:index>');
      expect(wpml).toContain('<wpml:index>1</wpml:index>');
      expect(wpml).toContain('<wpml:index>2</wpml:index>');
    });

    it('should have takePhoto action only on first waypoint', () => {
      const waypoints = [
        createWaypoint(0, -74.07, 4.71),
        createWaypoint(1, -74.07, 4.72),
        createWaypoint(2, -74.07, 4.73),
      ];

      const builder = new WPMLBuilder('mini_4_pro', waypoints);
      const wpml = builder.buildWaylinesWpml();

      // Count takePhoto occurrences
      const takePhotoCount = (wpml.match(/takePhoto/g) || []).length;
      expect(takePhotoCount).toBe(1);
    });

    it('should set gimbalRotate pitch on first waypoint', () => {
      const waypoints = [
        createWaypoint(0, -74.07, 4.71, 0, -45),
        createWaypoint(1, -74.07, 4.72, 0, -45),
      ];

      const builder = new WPMLBuilder('mini_4_pro', waypoints);
      const wpml = builder.buildWaylinesWpml();

      // First waypoint should have gimbalRotate with -45 pitch
      expect(wpml).toContain('<wpml:actionActuatorFunc>gimbalRotate</wpml:actionActuatorFunc>');
      expect(wpml).toContain('<wpml:gimbalPitchRotateAngle>-45</wpml:gimbalPitchRotateAngle>');
    });

    it('should set correct altitude on waypoints', () => {
      const waypoints = [
        createWaypoint(0, -74.07, 4.71),
      ];
      waypoints[0].altitude = 80;

      const builder = new WPMLBuilder('mini_4_pro', waypoints);
      const wpml = builder.buildWaylinesWpml();

      expect(wpml).toContain('<wpml:executeHeight>80</wpml:executeHeight>');
    });

    it('should set correct speed on waypoints', () => {
      const waypoints = [createWaypoint(0, -74.07, 4.71)];
      waypoints[0].speed = 10;

      const builder = new WPMLBuilder('mini_4_pro', waypoints);
      const wpml = builder.buildWaylinesWpml();

      expect(wpml).toContain('<wpml:waypointSpeed>10</wpml:waypointSpeed>');
    });

    it('should have correct turn modes for first and last waypoints', () => {
      const waypoints = [
        createWaypoint(0, -74.07, 4.71),
        createWaypoint(1, -74.07, 4.72),
        createWaypoint(2, -74.07, 4.73),
      ];

      const builder = new WPMLBuilder('mini_4_pro', waypoints);
      const wpml = builder.buildWaylinesWpml();

      // First and last should have stop mode
      const stopModeCount = (wpml.match(/toPointAndStopWithContinuityCurvature/g) || []).length;
      expect(stopModeCount).toBe(2);

      // Middle should have pass mode
      const passModeCount = (wpml.match(/toPointAndPassWithContinuityCurvature/g) || []).length;
      expect(passModeCount).toBe(1);
    });
  });

  describe('per-waypoint gimbal pitch', () => {
    it('should use individual gimbal pitch per waypoint for orbit patterns', () => {
      // Simulate orbit pattern with varying gimbal pitches
      const waypoints = [
        createWaypoint(0, -74.07, 4.71, 0, -90), // Orbit 1: -90
        createWaypoint(1, -74.06, 4.71, 90, -90),
        createWaypoint(2, -74.06, 4.72, 180, -90),
        createWaypoint(3, -74.07, 4.72, 270, -90),
        createWaypoint(4, -74.07, 4.71, 0, -80), // Orbit 2: -80
        createWaypoint(5, -74.06, 4.71, 90, -80),
        createWaypoint(6, -74.06, 4.72, 180, -80),
        createWaypoint(7, -74.07, 4.72, 270, -80),
      ];

      const builder = new WPMLBuilder('mini_4_pro', waypoints);
      const wpml = builder.buildWaylinesWpml();

      // Should have gimbalEvenlyRotate actions with different pitches
      expect(wpml).toContain('<wpml:gimbalPitchRotateAngle>-90</wpml:gimbalPitchRotateAngle>');
      expect(wpml).toContain('<wpml:gimbalPitchRotateAngle>-80</wpml:gimbalPitchRotateAngle>');
    });

    it('should use next waypoint pitch for gimbalEvenlyRotate transition', () => {
      // When transitioning from WP3 (-90) to WP4 (-80), the gimbalEvenlyRotate should use -80
      const waypoints = [
        createWaypoint(0, -74.07, 4.71, 0, -90),
        createWaypoint(1, -74.06, 4.71, 90, -80), // Next WP has -80
      ];

      const builder = new WPMLBuilder('mini_4_pro', waypoints);
      const wpml = builder.buildWaylinesWpml();

      // The gimbalEvenlyRotate from WP0 to WP1 should use WP1's pitch (-80)
      const gimbalRotateMatch = wpml.match(/<wpml:actionActuatorFunc>gimbalRotate[\s\S]*?<wpml:gimbalPitchRotateAngle>(-?\d+)/);
      const evenlyRotateMatch = wpml.match(/<wpml:actionActuatorFunc>gimbalEvenlyRotate[\s\S]*?<wpml:gimbalPitchRotateAngle>(-?\d+)/);

      // First waypoint's gimbalRotate should be -90 (initial position)
      expect(gimbalRotateMatch?.[1]).toBe('-90');
      // gimbalEvenlyRotate should be -80 (transition target)
      expect(evenlyRotateMatch?.[1]).toBe('-80');
    });
  });

  describe('edge cases', () => {
    it('should throw error for empty waypoints', () => {
      const builder = new WPMLBuilder('mini_4_pro', []);
      expect(() => builder.buildWaylinesWpml()).toThrow('No waypoints provided');
    });

    it('should handle single waypoint', () => {
      const waypoints = [createWaypoint(0, -74.07, 4.71)];

      const builder = new WPMLBuilder('mini_4_pro', waypoints);
      const wpml = builder.buildWaylinesWpml();

      expect(wpml).toContain('<wpml:index>0</wpml:index>');
      // Should not have gimbalEvenlyRotate (no next waypoint)
      expect(wpml).not.toContain('gimbalEvenlyRotate');
    });
  });
});
