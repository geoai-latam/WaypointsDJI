/**
 * Tests for coordinate transformation utilities
 */

import { describe, it, expect } from 'vitest';
import {
  getUtmZone,
  createTransformer,
  calculateCenter,
  calculateHeading,
} from './coordinateTransformer';

describe('getUtmZone', () => {
  it('should return correct UTM zone for various longitudes', () => {
    // Zone 1: -180 to -174
    expect(getUtmZone(-177)).toBe(1);

    // Zone 18: -78 to -72 (includes Bogota, Colombia)
    expect(getUtmZone(-74)).toBe(18);

    // Zone 30: -6 to 0 (Western Europe)
    expect(getUtmZone(-3)).toBe(30);

    // Zone 31: 0 to 6
    expect(getUtmZone(3)).toBe(31);

    // Zone 60: 174 to 180
    expect(getUtmZone(177)).toBe(60);
  });

  it('should handle edge cases at zone boundaries', () => {
    expect(getUtmZone(-180)).toBe(1);
    expect(getUtmZone(-174)).toBe(2);
    expect(getUtmZone(0)).toBe(31);
    expect(getUtmZone(180)).toBe(61); // Edge case
  });
});

describe('createTransformer', () => {
  it('should create a valid transformer', () => {
    const transformer = createTransformer(-74.0721, 4.7110);

    expect(transformer).toHaveProperty('toUtm');
    expect(transformer).toHaveProperty('toWgs84');
    expect(transformer).toHaveProperty('utmZone');
    expect(typeof transformer.toUtm).toBe('function');
    expect(typeof transformer.toWgs84).toBe('function');
  });

  it('should set correct UTM zone', () => {
    const transformer = createTransformer(-74.0721, 4.7110);
    expect(transformer.utmZone).toBe(18);
  });

  describe('toUtm', () => {
    it('should convert WGS84 to UTM correctly', () => {
      // Bogota, Colombia
      const transformer = createTransformer(-74.0721, 4.7110);
      const [x, y] = transformer.toUtm(-74.0721, 4.7110);

      // UTM coordinates should be reasonable values
      // Zone 18N, near Bogota: X around 500000-600000, Y around 500000-600000
      expect(x).toBeGreaterThan(400000);
      expect(x).toBeLessThan(700000);
      expect(y).toBeGreaterThan(400000);
      expect(y).toBeLessThan(700000);
    });

    it('should not return NaN values', () => {
      const transformer = createTransformer(-74.0721, 4.7110);
      const [x, y] = transformer.toUtm(-74.0721, 4.7110);

      expect(x).not.toBeNaN();
      expect(y).not.toBeNaN();
    });

    it('should throw for invalid coordinates', () => {
      const transformer = createTransformer(-74.0721, 4.7110);

      expect(() => transformer.toUtm(NaN, 4.7110)).toThrow();
      expect(() => transformer.toUtm(-74.0721, NaN)).toThrow();
    });
  });

  describe('toWgs84', () => {
    it('should convert UTM back to WGS84 correctly (round-trip)', () => {
      const originalLon = -74.0721;
      const originalLat = 4.7110;

      const transformer = createTransformer(originalLon, originalLat);
      const [x, y] = transformer.toUtm(originalLon, originalLat);
      const [lon, lat] = transformer.toWgs84(x, y);

      // Should be very close to original (within ~0.00001 degrees ≈ 1m)
      expect(lon).toBeCloseTo(originalLon, 4);
      expect(lat).toBeCloseTo(originalLat, 4);
    });

    it('should not return NaN values', () => {
      const transformer = createTransformer(-74.0721, 4.7110);
      const [x, y] = transformer.toUtm(-74.0721, 4.7110);
      const [lon, lat] = transformer.toWgs84(x, y);

      expect(lon).not.toBeNaN();
      expect(lat).not.toBeNaN();
    });

    it('should throw for invalid UTM coordinates', () => {
      const transformer = createTransformer(-74.0721, 4.7110);

      expect(() => transformer.toWgs84(NaN, 500000)).toThrow();
      expect(() => transformer.toWgs84(500000, NaN)).toThrow();
    });
  });

  describe('northern vs southern hemisphere', () => {
    it('should handle northern hemisphere correctly', () => {
      const transformer = createTransformer(-74.0721, 4.7110); // Bogota (north)
      const [x, y] = transformer.toUtm(-74.0721, 4.7110);

      expect(x).not.toBeNaN();
      expect(y).not.toBeNaN();
      expect(y).toBeGreaterThan(0);
    });

    it('should handle southern hemisphere correctly', () => {
      const transformer = createTransformer(-43.1729, -22.9068); // Rio de Janeiro (south)
      const [x, y] = transformer.toUtm(-43.1729, -22.9068);

      expect(x).not.toBeNaN();
      expect(y).not.toBeNaN();
    });
  });
});

describe('calculateCenter', () => {
  it('should calculate center of a square polygon', () => {
    const coords = [
      { longitude: 0, latitude: 0 },
      { longitude: 2, latitude: 0 },
      { longitude: 2, latitude: 2 },
      { longitude: 0, latitude: 2 },
    ];

    const center = calculateCenter(coords);

    expect(center.lon).toBe(1);
    expect(center.lat).toBe(1);
  });

  it('should calculate center of an irregular polygon', () => {
    const coords = [
      { longitude: -74.0750, latitude: 4.7100 },
      { longitude: -74.0700, latitude: 4.7100 },
      { longitude: -74.0700, latitude: 4.7150 },
      { longitude: -74.0750, latitude: 4.7150 },
    ];

    const center = calculateCenter(coords);

    expect(center.lon).toBeCloseTo(-74.0725, 4);
    expect(center.lat).toBeCloseTo(4.7125, 4);
  });
});

describe('calculateHeading', () => {
  it('should return 0 for due north', () => {
    const from: [number, number] = [0, 0];
    const to: [number, number] = [0, 100];

    const heading = calculateHeading(from, to);

    expect(heading).toBeCloseTo(0, 1);
  });

  it('should return 90 for due east', () => {
    const from: [number, number] = [0, 0];
    const to: [number, number] = [100, 0];

    const heading = calculateHeading(from, to);

    expect(heading).toBeCloseTo(90, 1);
  });

  it('should return 180 for due south', () => {
    const from: [number, number] = [0, 0];
    const to: [number, number] = [0, -100];

    const heading = calculateHeading(from, to);

    expect(heading).toBeCloseTo(180, 1);
  });

  it('should return 270 for due west', () => {
    const from: [number, number] = [0, 0];
    const to: [number, number] = [-100, 0];

    const heading = calculateHeading(from, to);

    expect(heading).toBeCloseTo(270, 1);
  });

  it('should return 45 for northeast', () => {
    const from: [number, number] = [0, 0];
    const to: [number, number] = [100, 100];

    const heading = calculateHeading(from, to);

    expect(heading).toBeCloseTo(45, 1);
  });

  it('should always return value between 0 and 360', () => {
    const testCases: [number, number][] = [
      [100, 0], [100, 100], [0, 100], [-100, 100],
      [-100, 0], [-100, -100], [0, -100], [100, -100],
    ];

    const from: [number, number] = [0, 0];

    for (const to of testCases) {
      const heading = calculateHeading(from, to);
      expect(heading).toBeGreaterThanOrEqual(0);
      expect(heading).toBeLessThan(360);
    }
  });
});
