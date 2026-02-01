/**
 * Grid pattern generator for survey flights.
 * Port of backend/app/patterns/grid.py
 */

import type { Waypoint, Coordinate } from '../../types';
import { PatternGenerator, type PatternGeneratorConfig } from './basePattern';

export interface GridOptions {
  bufferPercent?: number;
}

export class GridPatternGenerator extends PatternGenerator {
  constructor(config: PatternGeneratorConfig) {
    super(config);
  }

  /**
   * Generate grid pattern waypoints.
   */
  generate(
    polygonCoords: Coordinate[],
    options: GridOptions = {}
  ): Waypoint[] {
    const { bufferPercent = 15 } = options;

    console.log('[GridPattern] Starting generation with', polygonCoords.length, 'coords');
    console.log('[GridPattern] First coord:', polygonCoords[0]);
    console.log('[GridPattern] FlightParams:', this.flightParams);

    if (polygonCoords.length < 3) {
      console.warn('GridPattern: Not enough coordinates');
      return [];
    }

    // Setup coordinate transformation
    this.setupTransformers(polygonCoords);

    // Convert to UTM
    const utmCoords = this.toUtmCoords(polygonCoords);
    console.log('[GridPattern] UTM coords:', utmCoords.slice(0, 3), '...');

    // Close the polygon ring if not already closed
    const firstCoord = utmCoords[0];
    const lastCoord = utmCoords[utmCoords.length - 1];
    if (firstCoord[0] !== lastCoord[0] || firstCoord[1] !== lastCoord[1]) {
      utmCoords.push([...firstCoord]);
    }

    // Calculate buffer distance
    const bufferDistance = this.flightParams.line_spacing_m * (bufferPercent / 100) * 3;
    console.log('[GridPattern] Buffer distance:', bufferDistance, 'm');

    // Apply buffer to polygon (expand it OUTWARD)
    const bufferedCoords = this.bufferPolygon(utmCoords, bufferDistance);

    // Log buffer expansion check
    const origArea = Math.abs(this.polygonArea(utmCoords));
    const buffArea = Math.abs(this.polygonArea(bufferedCoords));
    console.log('[GridPattern] Original area:', origArea, 'Buffered area:', buffArea,
                'Expanded:', buffArea > origArea ? 'YES (correct)' : 'NO (wrong!)');

    // Generate grid lines on buffered polygon
    console.log('[GridPattern] Buffered coords:', bufferedCoords.slice(0, 3), '...');
    const lines = this.generateGridLines(bufferedCoords);

    console.log('[GridPattern] Generated', lines.length, 'lines');
    if (lines.length > 0) {
      console.log('[GridPattern] First line:', lines[0]);
    }

    if (lines.length === 0) {
      console.warn('GridPattern: No lines generated');
      return [];
    }

    // Convert to waypoints
    const waypoints = this.linesToWaypoints(lines);

    console.log('[GridPattern] Generated', waypoints.length, 'waypoints');
    if (waypoints.length > 0) {
      console.log('[GridPattern] First waypoint:', waypoints[0]);
      console.log('[GridPattern] Last waypoint:', waypoints[waypoints.length - 1]);
    }

    if (waypoints.length === 0) {
      console.warn('GridPattern: No waypoints generated from lines');
    }

    return waypoints;
  }

  /**
   * Simple polygon buffer using offset normals
   */
  private bufferPolygon(coords: [number, number][], distance: number): [number, number][] {
    if (coords.length < 3) return coords;

    const result: [number, number][] = [];
    const n = coords.length - 1; // Exclude closing point

    for (let i = 0; i < n; i++) {
      const prev = coords[(i - 1 + n) % n];
      const curr = coords[i];
      const next = coords[(i + 1) % n];

      // Calculate edge vectors
      const dx1 = curr[0] - prev[0];
      const dy1 = curr[1] - prev[1];
      const dx2 = next[0] - curr[0];
      const dy2 = next[1] - curr[1];

      // Normalize
      const len1 = Math.sqrt(dx1 * dx1 + dy1 * dy1);
      const len2 = Math.sqrt(dx2 * dx2 + dy2 * dy2);

      if (len1 === 0 || len2 === 0) {
        result.push([...curr]);
        continue;
      }

      // Perpendicular normals (pointing outward for CCW polygon)
      const nx1 = -dy1 / len1;
      const ny1 = dx1 / len1;
      const nx2 = -dy2 / len2;
      const ny2 = dx2 / len2;

      // Average normal
      let nx = (nx1 + nx2) / 2;
      let ny = (ny1 + ny2) / 2;
      const nLen = Math.sqrt(nx * nx + ny * ny);

      if (nLen > 0.001) {
        nx /= nLen;
        ny /= nLen;
      }

      // For polygon buffer, we want to expand outward
      // The left perpendicular (-dy, dx) points:
      // - INWARD for CCW polygons (interior is on the left of edges)
      // - OUTWARD for CW polygons (interior is on the right of edges)
      // So we need to NEGATE for CCW to go outward
      const area = this.polygonArea(coords);
      // For CCW (area > 0): negate to go outward (sign = -1)
      // For CW (area < 0): keep positive to go outward (sign = 1)
      const sign = area > 0 ? -1 : 1;

      result.push([
        curr[0] + sign * nx * distance,
        curr[1] + sign * ny * distance,
      ]);
    }

    // Close the polygon
    if (result.length > 0) {
      result.push([...result[0]]);
    }

    return result;
  }

  /**
   * Calculate signed polygon area (positive = CCW, negative = CW)
   */
  private polygonArea(coords: [number, number][]): number {
    let area = 0;
    const n = coords.length - 1;
    for (let i = 0; i < n; i++) {
      const j = (i + 1) % n;
      area += coords[i][0] * coords[j][1];
      area -= coords[j][0] * coords[i][1];
    }
    return area / 2;
  }

  protected generateGridLines(polygonCoords: [number, number][]): [number, number][][] {
    if (polygonCoords.length < 3) return [];

    // Calculate polygon bounding box
    let minX = Infinity, maxX = -Infinity;
    let minY = Infinity, maxY = -Infinity;

    for (const [x, y] of polygonCoords) {
      minX = Math.min(minX, x);
      maxX = Math.max(maxX, x);
      minY = Math.min(minY, y);
      maxY = Math.max(maxY, y);
    }

    const centerX = (minX + maxX) / 2;
    const centerY = (minY + maxY) / 2;
    const diagonal = Math.sqrt((maxX - minX) ** 2 + (maxY - minY) ** 2);

    console.log('[GridPattern] BBox:', { minX, maxX, minY, maxY });
    console.log('[GridPattern] Center:', { centerX, centerY }, 'Diagonal:', diagonal);

    const angle = this.flightAngleDeg;
    const lineSpacing = this.flightParams.line_spacing_m;
    console.log('[GridPattern] Angle:', angle, 'Line spacing:', lineSpacing);
    const angleRad = angle * (Math.PI / 180);

    // Flight direction: for angle measured from north clockwise
    // Direction vector is (sin(angle), cos(angle)) in (X=East, Y=North) coordinates
    // - angle=0 -> (0, 1) = north
    // - angle=90 -> (1, 0) = east
    const flightDirX = Math.sin(angleRad);
    const flightDirY = Math.cos(angleRad);

    // Perpendicular direction (90° clockwise from flight direction)
    // Rotate (x, y) by 90° clockwise -> (y, -x)
    // So perpendicular to (sin(θ), cos(θ)) is (cos(θ), -sin(θ))
    const cosPerp = Math.cos(angleRad);
    const sinPerp = -Math.sin(angleRad);

    console.log('[GridPattern] Flight dir:', { x: flightDirX, y: flightDirY });
    console.log('[GridPattern] Perp dir:', { x: cosPerp, y: sinPerp });

    // Generate parallel lines
    const lines: [number, number][][] = [];
    const numLines = Math.ceil((diagonal * 2) / lineSpacing) + 1;
    const startOffset = -numLines / 2 * lineSpacing;

    let clippedCount = 0;
    for (let i = 0; i <= numLines; i++) {
      const offset = startOffset + i * lineSpacing;

      // Line endpoints extending from center
      // Offset perpendicular to flight direction, extend along flight direction
      const lineStartX = centerX + offset * cosPerp - diagonal * flightDirX;
      const lineStartY = centerY + offset * sinPerp - diagonal * flightDirY;
      const lineEndX = centerX + offset * cosPerp + diagonal * flightDirX;
      const lineEndY = centerY + offset * sinPerp + diagonal * flightDirY;

      // Clip line to polygon
      const clipped = this.clipLineToPolygon(
        [lineStartX, lineStartY],
        [lineEndX, lineEndY],
        polygonCoords
      );

      if (clipped) {
        lines.push(clipped);
        clippedCount++;
      }
    }
    console.log('[GridPattern] Attempted', numLines + 1, 'lines, clipped', clippedCount);

    if (lines.length === 0) return [];

    // Sort lines by perpendicular distance
    lines.sort((a, b) => {
      const midA = [(a[0][0] + a[1][0]) / 2, (a[0][1] + a[1][1]) / 2];
      const midB = [(b[0][0] + b[1][0]) / 2, (b[0][1] + b[1][1]) / 2];
      const projA = midA[0] * cosPerp + midA[1] * sinPerp;
      const projB = midB[0] * cosPerp + midB[1] * sinPerp;
      return projA - projB;
    });

    // Create serpentine pattern
    const serpentineLines: [number, number][][] = [];
    for (let i = 0; i < lines.length; i++) {
      if (i % 2 === 1) {
        serpentineLines.push([lines[i][1], lines[i][0]]); // Reverse
      } else {
        serpentineLines.push(lines[i]);
      }
    }

    return serpentineLines;
  }

  /**
   * Clip a line segment to a polygon using ray-polygon intersection
   */
  private clipLineToPolygon(
    start: [number, number],
    end: [number, number],
    polygon: [number, number][]
  ): [number, number][] | null {
    const intersections: [number, number][] = [];

    const dx = end[0] - start[0];
    const dy = end[1] - start[1];
    const lineLen = Math.sqrt(dx * dx + dy * dy);

    if (lineLen === 0) return null;

    // Use all polygon vertices for intersection (polygon should be closed)
    const n = polygon.length;

    for (let i = 0; i < n - 1; i++) {
      const p1 = polygon[i];
      const p2 = polygon[i + 1];

      const intersection = this.lineSegmentIntersection(
        start, end, p1, p2
      );

      if (intersection) {
        intersections.push(intersection);
      }
    }

    if (intersections.length < 2) return null;

    // Sort intersections along the line
    intersections.sort((a, b) => {
      const tA = (a[0] - start[0]) * dx + (a[1] - start[1]) * dy;
      const tB = (b[0] - start[0]) * dx + (b[1] - start[1]) * dy;
      return tA - tB;
    });

    // Return first and last intersection (entry and exit)
    return [intersections[0], intersections[intersections.length - 1]];
  }

  /**
   * Calculate intersection point of two line segments
   */
  private lineSegmentIntersection(
    p1: [number, number],
    p2: [number, number],
    p3: [number, number],
    p4: [number, number]
  ): [number, number] | null {
    const x1 = p1[0], y1 = p1[1];
    const x2 = p2[0], y2 = p2[1];
    const x3 = p3[0], y3 = p3[1];
    const x4 = p4[0], y4 = p4[1];

    const denom = (x1 - x2) * (y3 - y4) - (y1 - y2) * (x3 - x4);

    if (Math.abs(denom) < 1e-10) return null; // Parallel lines

    const t = ((x1 - x3) * (y3 - y4) - (y1 - y3) * (x3 - x4)) / denom;
    const u = -((x1 - x2) * (y1 - y3) - (y1 - y2) * (x1 - x3)) / denom;

    // Check if intersection is within both segments
    if (t >= 0 && t <= 1 && u >= 0 && u <= 1) {
      return [
        x1 + t * (x2 - x1),
        y1 + t * (y2 - y1),
      ];
    }

    return null;
  }

  protected linesToWaypoints(lines: [number, number][][]): Waypoint[] {
    const waypoints: Waypoint[] = [];
    let index = 0;
    const photoSpacing = this.flightParams.photo_spacing_m;

    for (const line of lines) {
      if (line.length < 2) continue;

      const [startPt, endPt] = line;
      const heading = this.calculateHeading(startPt, endPt);

      const dx = endPt[0] - startPt[0];
      const dy = endPt[1] - startPt[1];
      const lineLength = Math.sqrt(dx * dx + dy * dy);

      if (lineLength < photoSpacing / 2) continue;

      const numPhotos = Math.max(2, Math.floor(lineLength / photoSpacing) + 1);

      for (let j = 0; j < numPhotos; j++) {
        const fraction = numPhotos > 1 ? j / (numPhotos - 1) : 0;

        const x = startPt[0] + dx * fraction;
        const y = startPt[1] + dy * fraction;

        const [lon, lat] = this.transformer!.toWgs84(x, y);

        waypoints.push(
          this.createWaypoint(index, lon, lat, heading, undefined, true)
        );
        index++;
      }
    }

    return waypoints;
  }
}
