"""Orbit pattern generator for vertical structures."""

import math
from shapely.geometry import Point, Polygon

from .base import PatternGenerator
from ..models import Waypoint, FlightParams, Coordinate


class OrbitPatternGenerator(PatternGenerator):
    """Generate orbit pattern for vertical structures (towers, buildings)."""

    def generate(
        self,
        polygon_coords: list[Coordinate] = None,
        center: Coordinate = None,
        radius_m: float = None,
        num_orbits: int = 1,
        altitude_step_m: float = 10.0,
        photos_per_orbit: int = 24,
        start_gimbal_pitch: float = None,
        **kwargs,
    ) -> list[Waypoint]:
        """
        Generate orbit pattern waypoints.

        Can work with either:
        - A polygon (will use centroid as center and calculate radius)
        - Explicit center point and radius

        Args:
            polygon_coords: List of polygon vertices in WGS84 (optional)
            center: Center point (POI) in WGS84 (optional)
            radius_m: Orbit radius in meters (optional)
            num_orbits: Number of concentric orbits at different altitudes
            altitude_step_m: Altitude increase between orbits
            photos_per_orbit: Number of photos per orbit
            start_gimbal_pitch: Starting gimbal pitch angle (uses instance value if None)

        Returns:
            List of waypoints forming concentric orbits
        """
        # Use instance gimbal_pitch if not explicitly provided
        gimbal_pitch = start_gimbal_pitch if start_gimbal_pitch is not None else self.gimbal_pitch_deg

        # If polygon provided, calculate center and radius from it
        if polygon_coords and len(polygon_coords) >= 3:
            return self._generate_from_polygon(
                polygon_coords, num_orbits, altitude_step_m,
                photos_per_orbit, gimbal_pitch
            )

        # Otherwise use explicit center and radius
        if center and radius_m:
            return self._generate_from_center(
                center, radius_m, num_orbits, altitude_step_m,
                photos_per_orbit, gimbal_pitch
            )

        return []

    def _generate_from_polygon(
        self,
        polygon_coords: list[Coordinate],
        num_orbits: int,
        altitude_step_m: float,
        photos_per_orbit: int,
        start_gimbal_pitch: float,
    ) -> list[Waypoint]:
        """Generate orbit from polygon centroid."""
        # Setup coordinate transformation
        center_lon = sum(c.longitude for c in polygon_coords) / len(polygon_coords)
        center_lat = sum(c.latitude for c in polygon_coords) / len(polygon_coords)
        self._setup_transformers(center_lon, center_lat)

        # Convert to UTM
        utm_coords = self._to_utm_coords(polygon_coords)
        polygon = Polygon(utm_coords)

        if not polygon.is_valid:
            polygon = polygon.buffer(0)

        # Get centroid as orbit center
        centroid = polygon.centroid
        center_utm = (centroid.x, centroid.y)

        # Calculate radius as distance to farthest vertex + margin
        max_dist = 0
        for coord in utm_coords:
            dist = math.sqrt(
                (coord[0] - center_utm[0]) ** 2 +
                (coord[1] - center_utm[1]) ** 2
            )
            max_dist = max(max_dist, dist)

        # Add 20% margin for safety
        radius = max_dist * 1.2

        # Generate orbit waypoints
        return self._generate_orbit(
            center_utm, radius, num_orbits, altitude_step_m,
            photos_per_orbit, start_gimbal_pitch
        )

    def _generate_from_center(
        self,
        center: Coordinate,
        radius_m: float,
        num_orbits: int,
        altitude_step_m: float,
        photos_per_orbit: int,
        start_gimbal_pitch: float,
    ) -> list[Waypoint]:
        """Generate orbit from explicit center and radius."""
        # Setup coordinate transformation
        self._setup_transformers(center.longitude, center.latitude)

        # Convert center to UTM
        center_utm = self._to_utm.transform(center.longitude, center.latitude)

        return self._generate_orbit(
            center_utm, radius_m, num_orbits, altitude_step_m,
            photos_per_orbit, start_gimbal_pitch
        )

    def _generate_orbit(
        self,
        center_utm: tuple,
        radius: float,
        num_orbits: int,
        altitude_step_m: float,
        photos_per_orbit: int,
        start_gimbal_pitch: float,
    ) -> list[Waypoint]:
        """Generate orbit waypoints around a center point."""
        waypoints = []
        index = 0
        base_altitude = self.flight_params.altitude_m

        for orbit_num in range(num_orbits):
            # Altitude for this orbit
            altitude = base_altitude + (orbit_num * altitude_step_m)

            # Gimbal pitch (gradually level out at higher altitudes)
            gimbal_pitch = start_gimbal_pitch + (orbit_num * 10)
            gimbal_pitch = min(-15, gimbal_pitch)

            # Generate points around the orbit
            angle_step = 360.0 / photos_per_orbit

            for i in range(photos_per_orbit):
                angle_deg = i * angle_step
                angle_rad = math.radians(angle_deg)

                # Calculate position on orbit
                x = center_utm[0] + radius * math.sin(angle_rad)
                y = center_utm[1] + radius * math.cos(angle_rad)

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
