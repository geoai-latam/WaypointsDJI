"""KMZ packager for DJI missions."""

import io
import zipfile
from typing import Optional

from .models import Waypoint, DroneModel, FinishAction
from .wpml_builder import WPMLBuilder


class KMZPackager:
    """Package WPML files into KMZ format for DJI drones."""

    def __init__(
        self,
        drone_model: DroneModel,
        waypoints: list[Waypoint],
        mission_name: Optional[str] = None,
    ):
        self.drone_model = drone_model
        self.waypoints = waypoints
        self.mission_name = mission_name
        self.builder = WPMLBuilder(drone_model, waypoints, mission_name)

    def create_kmz(self, finish_action: FinishAction = FinishAction.GO_HOME) -> bytes:
        """
        Create KMZ file with proper DJI folder structure.

        Structure:
        - wpmz/
          - template.kml
          - waylines.wpml

        Returns:
            KMZ file as bytes
        """
        # Get gimbal pitch from first waypoint (default -90 for nadir/photogrammetry)
        gimbal_pitch = self.waypoints[0].gimbal_pitch if self.waypoints else -90

        # Generate XML content
        template_kml = self.builder.build_template_kml(finish_action)
        waylines_wpml = self.builder.build_waylines_wpml(gimbal_pitch=gimbal_pitch)

        # Create ZIP in memory
        buffer = io.BytesIO()

        with zipfile.ZipFile(buffer, "w", zipfile.ZIP_DEFLATED) as zf:
            # Add template.kml in wpmz folder
            zf.writestr("wpmz/template.kml", template_kml)

            # Add waylines.wpml in wpmz folder
            zf.writestr("wpmz/waylines.wpml", waylines_wpml)

        buffer.seek(0)
        return buffer.getvalue()

    def get_mission_stats(self) -> dict:
        """Get statistics about the mission."""
        if not self.waypoints:
            return {
                "waypoint_count": 0,
                "estimated_distance_m": 0,
                "estimated_photos": 0,
            }

        # Calculate total distance
        total_distance = 0
        photo_count = sum(1 for wp in self.waypoints if wp.take_photo)

        for i in range(1, len(self.waypoints)):
            prev = self.waypoints[i - 1]
            curr = self.waypoints[i]

            # Simple distance calculation (Euclidean approximation for small areas)
            # For more accuracy, use haversine formula
            import math

            lat_diff = (curr.latitude - prev.latitude) * 111320  # meters per degree lat
            lon_diff = (curr.longitude - prev.longitude) * 111320 * math.cos(
                math.radians((curr.latitude + prev.latitude) / 2)
            )
            alt_diff = curr.altitude - prev.altitude

            distance = math.sqrt(lat_diff ** 2 + lon_diff ** 2 + alt_diff ** 2)
            total_distance += distance

        return {
            "waypoint_count": len(self.waypoints),
            "estimated_distance_m": round(total_distance, 1),
            "estimated_photos": photo_count,
        }
