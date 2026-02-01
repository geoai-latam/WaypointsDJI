/**
 * Double grid pattern generator (crosshatch) for 3D mapping.
 * Port of backend/app/patterns/double_grid.py
 */

import type { Waypoint, Coordinate } from '../../types';
import { GridPatternGenerator, type GridOptions } from './gridPattern';
import type { PatternGeneratorConfig } from './basePattern';

export class DoubleGridPatternGenerator extends GridPatternGenerator {
  constructor(config: PatternGeneratorConfig) {
    super(config);
  }

  /**
   * Generate double grid pattern with two perpendicular passes.
   *
   * Args:
   *   polygonCoords: List of polygon vertices in WGS84
   *   options.bufferPercent: Percentage to extend beyond polygon (default 15%)
   *
   * Returns: List of waypoints forming a crosshatch pattern
   */
  generate(
    polygonCoords: Coordinate[],
    options: GridOptions = {}
  ): Waypoint[] {
    console.log('[DoubleGridPattern] Starting generation with', polygonCoords.length, 'coords');

    if (polygonCoords.length < 3) {
      return [];
    }

    // First pass at original angle
    console.log('[DoubleGridPattern] First pass at angle', this.flightAngleDeg);
    const firstPass = super.generate(polygonCoords, options);
    console.log('[DoubleGridPattern] First pass generated', firstPass.length, 'waypoints');

    // Second pass at perpendicular angle (+90 degrees)
    const originalAngle = this.flightAngleDeg;
    this.flightAngleDeg = (originalAngle + 90) % 360;
    console.log('[DoubleGridPattern] Second pass at angle', this.flightAngleDeg);

    const secondPass = super.generate(polygonCoords, options);
    console.log('[DoubleGridPattern] Second pass generated', secondPass.length, 'waypoints');

    // Re-index second pass waypoints (immutable - create new objects)
    const offset = firstPass.length;
    const reindexedSecondPass = secondPass.map(wp => ({
      ...wp,
      index: wp.index + offset,
    }));

    // Restore original angle
    this.flightAngleDeg = originalAngle;

    // Combine passes
    const total = [...firstPass, ...reindexedSecondPass];
    console.log('[DoubleGridPattern] Total waypoints:', total.length);
    return total;
  }
}
