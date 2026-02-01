/**
 * Corridor pattern generator for linear features.
 * Port of backend/app/patterns/corridor.py
 */

import type { Waypoint, Coordinate } from '../../types';
import { PatternGenerator, type PatternGeneratorConfig } from './basePattern';

export interface CorridorOptions {
  centerlineCoords?: Coordinate[];
  corridorWidthM?: number;
  numLines?: number;
}

export class CorridorPatternGenerator extends PatternGenerator {
  constructor(config: PatternGeneratorConfig) {
    super(config);
  }

  /**
   * Generate corridor pattern waypoints.
   */
  generate(
    polygonCoords: Coordinate[],
    options: CorridorOptions = {}
  ): Waypoint[] {
    const {
      centerlineCoords,
      corridorWidthM,
      numLines = 3,
    } = options;

    console.log('[CorridorPattern] Starting generation with', polygonCoords.length, 'coords, numLines:', numLines);

    // If polygon provided, extract centerline from it
    if (polygonCoords && polygonCoords.length >= 3) {
      return this.generateFromPolygon(polygonCoords, numLines);
    }

    // Otherwise use explicit centerline
    if (centerlineCoords && centerlineCoords.length >= 2) {
      return this.generateFromCenterline(
        centerlineCoords,
        corridorWidthM ?? 50,
        numLines
      );
    }

    console.warn('CorridorPattern: No valid input provided');
    return [];
  }

  private generateFromPolygon(
    polygonCoords: Coordinate[],
    numLines: number
  ): Waypoint[] {
    // Setup coordinate transformation
    this.setupTransformers(polygonCoords);

    // Convert to UTM
    const utmCoords = this.toUtmCoords(polygonCoords);
    console.log('[CorridorPattern] UTM coords:', utmCoords.slice(0, 3), '...');

    // Close the polygon if not closed
    if (utmCoords.length > 0) {
      const first = utmCoords[0];
      const last = utmCoords[utmCoords.length - 1];
      if (first[0] !== last[0] || first[1] !== last[1]) {
        utmCoords.push([...first]);
      }
    }

    // Find minimum rotated rectangle to determine main axis
    const { centerline, width } = this.findPolygonCenterlineAndWidth(utmCoords);
    console.log('[CorridorPattern] Centerline:', centerline, 'Width:', width);

    if (!centerline || centerline.length < 2) {
      console.warn('CorridorPattern: Could not find centerline');
      return [];
    }

    // Extend centerline beyond polygon
    const extension = this.flightParams.line_spacing_m * 2;
    const extendedCenterline = this.extendLine(centerline, extension);

    // Generate parallel lines
    const lines = this.generateParallelLines(extendedCenterline, width, numLines);
    console.log('[CorridorPattern] Generated', lines.length, 'lines');

    // Convert to waypoints
    const waypoints = this.linesToWaypoints(lines);
    console.log('[CorridorPattern] Generated', waypoints.length, 'waypoints');

    return waypoints;
  }

  private findPolygonCenterlineAndWidth(
    utmCoords: [number, number][]
  ): { centerline: [number, number][]; width: number } {
    if (utmCoords.length < 3) {
      return { centerline: [], width: 0 };
    }

    // Calculate bounding box
    let minX = Infinity, maxX = -Infinity;
    let minY = Infinity, maxY = -Infinity;

    for (const [x, y] of utmCoords) {
      minX = Math.min(minX, x);
      maxX = Math.max(maxX, x);
      minY = Math.min(minY, y);
      maxY = Math.max(maxY, y);
    }

    const bboxWidth = maxX - minX;
    const bboxHeight = maxY - minY;
    const centerX = (minX + maxX) / 2;
    const centerY = (minY + maxY) / 2;

    // Use bounding box to determine orientation
    if (bboxWidth > bboxHeight) {
      // Horizontal corridor
      return {
        centerline: [[minX, centerY], [maxX, centerY]],
        width: bboxHeight,
      };
    } else {
      // Vertical corridor
      return {
        centerline: [[centerX, minY], [centerX, maxY]],
        width: bboxWidth,
      };
    }
  }

  private generateFromCenterline(
    centerlineCoords: Coordinate[],
    corridorWidthM: number,
    numLines: number
  ): Waypoint[] {
    const clampedNumLines = Math.max(1, Math.min(5, numLines));

    // Setup coordinate transformation
    this.setupTransformers(centerlineCoords);

    // Convert to UTM
    const utmCoords = this.toUtmCoords(centerlineCoords);
    const centerline: [number, number][] = utmCoords;

    // Extend centerline
    const extension = this.flightParams.line_spacing_m * 2;
    const extendedCenterline = this.extendLine(centerline, extension);

    // Generate parallel lines
    const lines = this.generateParallelLines(extendedCenterline, corridorWidthM, clampedNumLines);

    // Convert to waypoints
    return this.linesToWaypoints(lines);
  }

  private extendLine(line: [number, number][], distance: number): [number, number][] {
    if (line.length < 2) {
      return line;
    }

    const coords = line.map(c => [...c] as [number, number]);

    // Extend start
    const dx0 = coords[0][0] - coords[1][0];
    const dy0 = coords[0][1] - coords[1][1];
    const length0 = Math.sqrt(dx0 * dx0 + dy0 * dy0);
    if (length0 > 0) {
      coords[0] = [
        coords[0][0] + (dx0 / length0) * distance,
        coords[0][1] + (dy0 / length0) * distance,
      ];
    }

    // Extend end
    const lastIdx = coords.length - 1;
    const dx1 = coords[lastIdx][0] - coords[lastIdx - 1][0];
    const dy1 = coords[lastIdx][1] - coords[lastIdx - 1][1];
    const length1 = Math.sqrt(dx1 * dx1 + dy1 * dy1);
    if (length1 > 0) {
      coords[lastIdx] = [
        coords[lastIdx][0] + (dx1 / length1) * distance,
        coords[lastIdx][1] + (dy1 / length1) * distance,
      ];
    }

    return coords;
  }

  private generateParallelLines(
    centerline: [number, number][],
    width: number,
    numLines: number
  ): [number, number][][] {
    const lines: [number, number][][] = [];
    const clampedNumLines = Math.max(1, Math.min(5, numLines));

    if (centerline.length < 2) return [];

    // Calculate offsets
    let offsets: number[];
    if (clampedNumLines === 1) {
      offsets = [0];
    } else {
      const halfWidth = width / 2;
      offsets = [];
      for (let i = 0; i < clampedNumLines; i++) {
        offsets.push(-halfWidth + (i * width) / (clampedNumLines - 1));
      }
    }

    // Calculate direction of centerline
    const start = centerline[0];
    const end = centerline[centerline.length - 1];
    const dx = end[0] - start[0];
    const dy = end[1] - start[1];
    const length = Math.sqrt(dx * dx + dy * dy);

    if (length === 0) return [];

    // Perpendicular direction (left)
    const px = -dy / length;
    const py = dx / length;

    for (let i = 0; i < offsets.length; i++) {
      const offset = offsets[i];

      // Create offset line
      const offsetLine: [number, number][] = centerline.map(([x, y]) => [
        x + px * offset,
        y + py * offset,
      ]);

      // Alternate direction for serpentine pattern
      if (i % 2 === 1) {
        lines.push([...offsetLine].reverse());
      } else {
        lines.push(offsetLine);
      }
    }

    return lines;
  }

  private linesToWaypoints(lines: [number, number][][]): Waypoint[] {
    const waypoints: Waypoint[] = [];
    let index = 0;
    const photoSpacing = this.flightParams.photo_spacing_m;

    for (const line of lines) {
      if (line.length < 2) continue;

      // Calculate heading for this line
      const start = line[0];
      const end = line[line.length - 1];
      const heading = this.calculateHeading(start, end);

      // Calculate line length
      let lineLength = 0;
      for (let i = 1; i < line.length; i++) {
        const dx = line[i][0] - line[i - 1][0];
        const dy = line[i][1] - line[i - 1][1];
        lineLength += Math.sqrt(dx * dx + dy * dy);
      }

      if (lineLength < photoSpacing / 2) continue;

      const numPhotos = Math.max(2, Math.floor(lineLength / photoSpacing) + 1);

      for (let j = 0; j < numPhotos; j++) {
        const fraction = numPhotos > 1 ? j / (numPhotos - 1) : 0;
        const targetDist = fraction * lineLength;

        // Find point at targetDist along the line
        let accDist = 0;
        let point: [number, number] = line[0];

        for (let i = 1; i < line.length; i++) {
          const dx = line[i][0] - line[i - 1][0];
          const dy = line[i][1] - line[i - 1][1];
          const segLength = Math.sqrt(dx * dx + dy * dy);

          if (accDist + segLength >= targetDist) {
            const t = segLength > 0 ? (targetDist - accDist) / segLength : 0;
            point = [
              line[i - 1][0] + dx * t,
              line[i - 1][1] + dy * t,
            ];
            break;
          }
          accDist += segLength;
          point = line[i];
        }

        // Convert to WGS84
        const [lon, lat] = this.transformer!.toWgs84(point[0], point[1]);

        waypoints.push(
          this.createWaypoint(index, lon, lat, heading, undefined, true)
        );
        index++;
      }
    }

    return waypoints;
  }
}
