"""Orbit pattern generator for vertical structures."""

import math
from shapely.geometry import Point

from .base import PatternGenerator
from ..models import Waypoint, FlightParams, Coordinate


class OrbitPatternGenerator(PatternGenerator):
    """Generate orbit pattern for vertical structures (towers, buildings)."""

    def generate(
        self,
        center: Coordinate,
        radius_m: float,
        num_orbits: int = 1,
        altitude_step_m: float = 10.0,
        photos_per_orbit: int = 36,
        start_gimbal_pitch: float = -45,
        **kwargs,
    ) -> list[Waypoint]:
        """
        Generate orbit pattern waypoints.

        Args:
            center: Center point (POI) in WGS84
            radius_m: Orbit radius in meters
            num_orbits: Number of concentric orbits at different altitudes
            altitude_step_m: Altitude increase between orbits
            photos_per_orbit: Number of photos per orbit (determines angular spacing)
            start_gimbal_pitch: Starting gimbal pitch angle

        Returns:
            List of waypoints forming concentric orbits
        """
        # Setup coordinate transformation
        self._setup_transformers(center.longitude, center.latitude)

        # Convert center to UTM
        center_utm = self._to_utm.transform(center.longitude, center.latitude)
        center_point = Point(center_utm)

        waypoints = []
        index = 0
        base_altitude = self.flight_params.altitude_m

        for orbit_num in range(num_orbits):
            # Altitude for this orbit
            altitude = base_altitude + (orbit_num * altitude_step_m)

            # Gimbal pitch (gradually level out at higher altitudes)
            gimbal_pitch = start_gimbal_pitch + (orbit_num * 10)
            gimbal_pitch = min(-15, gimbal_pitch)  # Don't go above -15 degrees

            # Generate points around the orbit
            angle_step = 360.0 / photos_per_orbit

            for i in range(photos_per_orbit):
                angle_deg = i * angle_step
                angle_rad = math.radians(angle_deg)

                # Calculate position on orbit
                x = center_utm[0] + radius_m * math.sin(angle_rad)
                y = center_utm[1] + radius_m * math.cos(angle_rad)

                # Convert back to WGS84
                lon, lat = self._to_wgs84.transform(x, y)

                # Heading points toward center
                heading = (angle_deg + 180) % 360

                waypoint = Waypoint(
                    index=index,
                    longitude=lon,
                    latitude=lat,
                    altitude=altitude,
                    heading=heading,
                    gimbal_pitch=gimbal_pitch,
                    speed=self.flight_params.max_speed_ms,
                    take_photo=True,
                )
                waypoints.append(waypoint)
                index += 1

        return waypoints
