/**
 * Tests for KMZ Packager
 */

import { describe, it, expect } from 'vitest';
import { KMZPackager } from './kmzPackager';
import type { Waypoint } from '../../types';
import JSZip from 'jszip';

// Helper to create a waypoint
const createWaypoint = (
  index: number,
  longitude: number,
  latitude: number,
  gimbal_pitch: number = -90
): Waypoint => ({
  index,
  longitude,
  latitude,
  altitude: 60,
  heading: 0,
  gimbal_pitch,
  speed: 8,
  take_photo: true,
});

// Helper to convert Blob to ArrayBuffer for JSZip in Node environment
async function blobToArrayBuffer(blob: Blob): Promise<ArrayBuffer> {
  return await blob.arrayBuffer();
}

describe('KMZPackager', () => {
  describe('createKmz', () => {
    it('should create a valid KMZ blob', async () => {
      const waypoints = [
        createWaypoint(0, -74.07, 4.71),
        createWaypoint(1, -74.07, 4.72),
      ];

      const packager = new KMZPackager('mini_4_pro', waypoints);
      const blob = await packager.createKmz('goHome');

      expect(blob).toBeInstanceOf(Blob);
      expect(blob.size).toBeGreaterThan(0);
    });

    it('should contain template.kml and waylines.wpml', async () => {
      const waypoints = [
        createWaypoint(0, -74.07, 4.71),
        createWaypoint(1, -74.07, 4.72),
      ];

      const packager = new KMZPackager('mini_4_pro', waypoints);
      const blob = await packager.createKmz();

      // Convert Blob to ArrayBuffer for JSZip in Node
      const arrayBuffer = await blobToArrayBuffer(blob);
      const zip = await JSZip.loadAsync(arrayBuffer);
      const files = Object.keys(zip.files);

      expect(files).toContain('wpmz/template.kml');
      expect(files).toContain('wpmz/waylines.wpml');
    });

    it('should have valid XML in template.kml', async () => {
      const waypoints = [createWaypoint(0, -74.07, 4.71)];

      const packager = new KMZPackager('mini_4_pro', waypoints);
      const blob = await packager.createKmz();

      const arrayBuffer = await blobToArrayBuffer(blob);
      const zip = await JSZip.loadAsync(arrayBuffer);
      const templateKml = await zip.file('wpmz/template.kml')?.async('string');

      expect(templateKml).toContain('<?xml version="1.0"');
      expect(templateKml).toContain('GeoFlight Planner');
    });

    it('should have valid XML in waylines.wpml', async () => {
      const waypoints = [
        createWaypoint(0, -74.07, 4.71),
        createWaypoint(1, -74.07, 4.72),
      ];

      const packager = new KMZPackager('mini_4_pro', waypoints);
      const blob = await packager.createKmz();

      const arrayBuffer = await blobToArrayBuffer(blob);
      const zip = await JSZip.loadAsync(arrayBuffer);
      const waylinesWpml = await zip.file('wpmz/waylines.wpml')?.async('string');

      expect(waylinesWpml).toContain('<Placemark>');
      expect(waylinesWpml).toContain('<wpml:index>0</wpml:index>');
      expect(waylinesWpml).toContain('<wpml:index>1</wpml:index>');
    });

    it('should respect finish action parameter', async () => {
      const waypoints = [createWaypoint(0, -74.07, 4.71)];

      const packager = new KMZPackager('mini_4_pro', waypoints);

      // Test different finish actions
      const blobGoHome = await packager.createKmz('goHome');
      const blobAutoLand = await packager.createKmz('autoLand');

      const abGoHome = await blobToArrayBuffer(blobGoHome);
      const abAutoLand = await blobToArrayBuffer(blobAutoLand);

      const zipGoHome = await JSZip.loadAsync(abGoHome);
      const zipAutoLand = await JSZip.loadAsync(abAutoLand);

      const kmlGoHome = await zipGoHome.file('wpmz/template.kml')?.async('string');
      const kmlAutoLand = await zipAutoLand.file('wpmz/template.kml')?.async('string');

      expect(kmlGoHome).toContain('goHome');
      expect(kmlAutoLand).toContain('autoLand');
    });
  });

  describe('getMissionStats', () => {
    it('should return correct waypoint count', () => {
      const waypoints = [
        createWaypoint(0, -74.07, 4.71),
        createWaypoint(1, -74.07, 4.72),
        createWaypoint(2, -74.07, 4.73),
      ];

      const packager = new KMZPackager('mini_4_pro', waypoints);
      const stats = packager.getMissionStats();

      expect(stats.waypointCount).toBe(3);
    });

    it('should return correct photo count based on take_photo flag', () => {
      const waypoints = [
        createWaypoint(0, -74.07, 4.71),
        createWaypoint(1, -74.07, 4.72),
        createWaypoint(2, -74.07, 4.73),
      ];
      waypoints[1].take_photo = false; // Middle waypoint no photo

      const packager = new KMZPackager('mini_4_pro', waypoints);
      const stats = packager.getMissionStats();

      expect(stats.estimatedPhotos).toBe(2);
    });

    it('should calculate estimated distance', () => {
      const waypoints = [
        createWaypoint(0, -74.07, 4.71),
        createWaypoint(1, -74.07, 4.72), // ~1km north
      ];

      const packager = new KMZPackager('mini_4_pro', waypoints);
      const stats = packager.getMissionStats();

      // Distance should be approximately 1km (0.01 degrees ≈ 1.1km)
      expect(stats.estimatedDistanceM).toBeGreaterThan(1000);
      expect(stats.estimatedDistanceM).toBeLessThan(1200);
    });

    it('should return zeros for empty waypoints', () => {
      const packager = new KMZPackager('mini_4_pro', []);
      const stats = packager.getMissionStats();

      expect(stats.waypointCount).toBe(0);
      expect(stats.estimatedDistanceM).toBe(0);
      expect(stats.estimatedPhotos).toBe(0);
    });
  });
});
