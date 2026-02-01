/**
 * Orbit pattern generator for vertical structures.
 * Port of backend/app/patterns/orbit.py
 */

import type { Waypoint, Coordinate } from '../../types';
import { PatternGenerator, type PatternGeneratorConfig } from './basePattern';

export interface OrbitOptions {
  center?: Coordinate;
  radiusM?: number;
  numOrbits?: number;
  altitudeStepM?: number;
  photosPerOrbit?: number;
  startGimbalPitch?: number;
}

export class OrbitPatternGenerator extends PatternGenerator {
  constructor(config: PatternGeneratorConfig) {
    super(config);
  }

  /**
   * Generate orbit pattern waypoints.
   *
   * Can work with either:
   * - A polygon (will use centroid as center and calculate radius)
   * - Explicit center point and radius
   */
  generate(
    polygonCoords: Coordinate[],
    options: OrbitOptions = {}
  ): Waypoint[] {
    console.log('[OrbitPattern] Starting generation with', polygonCoords.length, 'coords');

    const {
      center,
      radiusM,
      numOrbits = 1,
      altitudeStepM = 10.0,
      photosPerOrbit = 24,
      startGimbalPitch,
    } = options;

    console.log('[OrbitPattern] Options: numOrbits=', numOrbits, 'altitudeStep=', altitudeStepM);

    // Use instance gimbal_pitch if not explicitly provided
    const gimbalPitch = startGimbalPitch ?? this.gimbalPitchDeg;

    // If polygon provided, calculate center and radius from it
    if (polygonCoords && polygonCoords.length >= 3) {
      return this.generateFromPolygon(
        polygonCoords,
        numOrbits,
        altitudeStepM,
        photosPerOrbit,
        gimbalPitch
      );
    }

    // Otherwise use explicit center and radius
    if (center && radiusM) {
      return this.generateFromCenter(
        center,
        radiusM,
        numOrbits,
        altitudeStepM,
        photosPerOrbit,
        gimbalPitch
      );
    }

    return [];
  }

  private generateFromPolygon(
    polygonCoords: Coordinate[],
    numOrbits: number,
    altitudeStepM: number,
    photosPerOrbit: number,
    startGimbalPitch: number
  ): Waypoint[] {
    // Setup coordinate transformation
    this.setupTransformers(polygonCoords);

    // Convert to UTM
    const utmCoords = this.toUtmCoords(polygonCoords);

    // Calculate centroid
    const centerX = utmCoords.reduce((sum, c) => sum + c[0], 0) / utmCoords.length;
    const centerY = utmCoords.reduce((sum, c) => sum + c[1], 0) / utmCoords.length;
    const centerUtm: [number, number] = [centerX, centerY];

    // Calculate radius as distance to farthest vertex + margin
    let maxDist = 0;
    for (const coord of utmCoords) {
      const dist = Math.sqrt(
        (coord[0] - centerUtm[0]) ** 2 +
        (coord[1] - centerUtm[1]) ** 2
      );
      maxDist = Math.max(maxDist, dist);
    }

    // Add 20% margin for safety
    const radius = maxDist * 1.2;

    // Generate orbit waypoints
    return this.generateOrbit(
      centerUtm,
      radius,
      numOrbits,
      altitudeStepM,
      photosPerOrbit,
      startGimbalPitch
    );
  }

  private generateFromCenter(
    center: Coordinate,
    radiusM: number,
    numOrbits: number,
    altitudeStepM: number,
    photosPerOrbit: number,
    startGimbalPitch: number
  ): Waypoint[] {
    // Setup coordinate transformation
    this.setupTransformers([center]);

    // Convert center to UTM
    const centerUtm = this.transformer!.toUtm(center.longitude, center.latitude);

    return this.generateOrbit(
      centerUtm,
      radiusM,
      numOrbits,
      altitudeStepM,
      photosPerOrbit,
      startGimbalPitch
    );
  }

  private generateOrbit(
    centerUtm: [number, number],
    radius: number,
    numOrbits: number,
    altitudeStepM: number,
    photosPerOrbit: number,
    startGimbalPitch: number
  ): Waypoint[] {
    const waypoints: Waypoint[] = [];
    let index = 0;
    const baseAltitude = this.flightParams.altitude_m;

    for (let orbitNum = 0; orbitNum < numOrbits; orbitNum++) {
      // Altitude for this orbit
      const altitude = baseAltitude + (orbitNum * altitudeStepM);

      // Gimbal pitch (gradually level out at higher altitudes)
      // Clamp between -90 (nadir) and -15 (nearly horizontal)
      let gimbalPitch = startGimbalPitch + (orbitNum * 10);
      gimbalPitch = Math.max(-90, Math.min(-15, gimbalPitch));

      // Generate points around the orbit
      const angleStep = 360.0 / photosPerOrbit;

      for (let i = 0; i < photosPerOrbit; i++) {
        const angleDeg = i * angleStep;
        const angleRad = angleDeg * (Math.PI / 180);

        // Calculate position on orbit
        const x = centerUtm[0] + radius * Math.sin(angleRad);
        const y = centerUtm[1] + radius * Math.cos(angleRad);

        // Convert back to WGS84
        const [lon, lat] = this.transformer!.toWgs84(x, y);

        // Heading points toward center
        const heading = (angleDeg + 180) % 360;

        const waypoint: Waypoint = {
          index,
          longitude: lon,
          latitude: lat,
          altitude,
          heading,
          gimbal_pitch: gimbalPitch,
          speed: this.flightParams.max_speed_ms,
          take_photo: true,
        };
        waypoints.push(waypoint);
        index++;
      }
    }

    return waypoints;
  }
}
