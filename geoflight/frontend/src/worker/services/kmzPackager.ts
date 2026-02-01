/**
 * KMZ packager for DJI missions using JSZip.
 * Port of backend/app/kmz_packager.py
 */

import JSZip from 'jszip';
import type { Waypoint, DroneModel, FinishAction } from '../../types';
import { WPMLBuilder } from './wpmlBuilder';

export class KMZPackager {
  private waypoints: Waypoint[];
  private builder: WPMLBuilder;

  constructor(
    droneModel: DroneModel,
    waypoints: Waypoint[],
    missionName?: string
  ) {
    this.waypoints = waypoints;
    this.builder = new WPMLBuilder(droneModel, waypoints, missionName);
  }

  /**
   * Create KMZ file with proper DJI folder structure.
   *
   * Structure:
   * - wpmz/
   *   - template.kml
   *   - waylines.wpml
   *
   * Returns: KMZ file as Blob
   */
  async createKmz(finishAction: FinishAction = 'goHome'): Promise<Blob> {
    // Get gimbal pitch from first waypoint (default -90 for nadir/photogrammetry)
    const gimbalPitch = this.waypoints[0]?.gimbal_pitch ?? -90;

    // Generate XML content
    const templateKml = this.builder.buildTemplateKml(finishAction);
    const waylinesWpml = this.builder.buildWaylinesWpml(gimbalPitch);

    // Create ZIP in memory
    const zip = new JSZip();

    // Add template.kml in wpmz folder
    zip.file('wpmz/template.kml', templateKml);

    // Add waylines.wpml in wpmz folder
    zip.file('wpmz/waylines.wpml', waylinesWpml);

    // Generate the ZIP file as a Blob
    const blob = await zip.generateAsync({
      type: 'blob',
      compression: 'DEFLATE',
      compressionOptions: { level: 6 },
    });

    return blob;
  }

  /**
   * Get statistics about the mission.
   */
  getMissionStats(): {
    waypointCount: number;
    estimatedDistanceM: number;
    estimatedPhotos: number;
  } {
    if (this.waypoints.length === 0) {
      return {
        waypointCount: 0,
        estimatedDistanceM: 0,
        estimatedPhotos: 0,
      };
    }

    // Calculate total distance
    let totalDistance = 0;
    const photoCount = this.waypoints.filter(wp => wp.take_photo).length;

    for (let i = 1; i < this.waypoints.length; i++) {
      const prev = this.waypoints[i - 1];
      const curr = this.waypoints[i];

      // Simple distance calculation (Euclidean approximation for small areas)
      const latDiff = (curr.latitude - prev.latitude) * 111320; // meters per degree lat
      const lonDiff = (curr.longitude - prev.longitude) * 111320 *
        Math.cos(((curr.latitude + prev.latitude) / 2) * (Math.PI / 180));
      const altDiff = curr.altitude - prev.altitude;

      const distance = Math.sqrt(latDiff ** 2 + lonDiff ** 2 + altDiff ** 2);
      totalDistance += distance;
    }

    return {
      waypointCount: this.waypoints.length,
      estimatedDistanceM: Math.round(totalDistance * 10) / 10,
      estimatedPhotos: photoCount,
    };
  }
}
