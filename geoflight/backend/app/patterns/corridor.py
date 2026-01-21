"""Corridor pattern generator for linear features."""

import math
from shapely.geometry import LineString, Point
from shapely.ops import unary_union

from .base import PatternGenerator
from ..models import Waypoint, FlightParams, Coordinate


class CorridorPatternGenerator(PatternGenerator):
    """Generate corridor pattern for linear features (roads, rivers, pipelines)."""

    def generate(
        self,
        centerline_coords: list[Coordinate],
        corridor_width_m: float,
        num_lines: int = 3,
        **kwargs,
    ) -> list[Waypoint]:
        """
        Generate corridor pattern waypoints.

        Args:
            centerline_coords: List of centerline vertices in WGS84
            corridor_width_m: Width of corridor in meters
            num_lines: Number of parallel lines (1-5)

        Returns:
            List of waypoints forming parallel lines along corridor
        """
        if len(centerline_coords) < 2:
            return []

        num_lines = max(1, min(5, num_lines))

        # Setup coordinate transformation
        center_lon = sum(c.longitude for c in centerline_coords) / len(centerline_coords)
        center_lat = sum(c.latitude for c in centerline_coords) / len(centerline_coords)
        self._setup_transformers(center_lon, center_lat)

        # Convert to UTM
        utm_coords = self._to_utm_coords(centerline_coords)
        centerline = LineString(utm_coords)

        # Generate parallel lines
        lines = self._generate_parallel_lines(centerline, corridor_width_m, num_lines)

        # Convert to waypoints
        waypoints = self._lines_to_waypoints(lines)

        return waypoints

    def _generate_parallel_lines(
        self,
        centerline: LineString,
        width: float,
        num_lines: int,
    ) -> list[LineString]:
        """Generate parallel lines along centerline."""
        lines = []

        if num_lines == 1:
            offsets = [0]
        else:
            # Distribute lines across width
            half_width = width / 2
            offsets = [
                -half_width + i * width / (num_lines - 1)
                for i in range(num_lines)
            ]

        for i, offset in enumerate(offsets):
            if offset == 0:
                line = centerline
            else:
                # Create offset line
                try:
                    line = centerline.parallel_offset(abs(offset), "left" if offset > 0 else "right")
                    if isinstance(line, LineString) and line.is_valid:
                        # parallel_offset can reverse direction, fix if needed
                        if offset < 0:
                            line = LineString(list(line.coords)[::-1])
                    else:
                        continue
                except Exception:
                    continue

            # Alternate direction for serpentine pattern
            if i % 2 == 1:
                line = LineString(list(line.coords)[::-1])

            lines.append(line)

        return lines

    def _lines_to_waypoints(self, lines: list[LineString]) -> list[Waypoint]:
        """Convert corridor lines to waypoints."""
        waypoints = []
        index = 0
        photo_spacing = self.flight_params.photo_spacing_m

        for line in lines:
            coords = list(line.coords)
            if len(coords) < 2:
                continue

            # Calculate heading for this line
            heading = self._calculate_heading(coords[0], coords[-1])

            # Generate points along line
            line_length = line.length
            num_photos = max(2, int(line_length / photo_spacing) + 1)

            for j in range(num_photos):
                fraction = j / (num_photos - 1) if num_photos > 1 else 0
                point = line.interpolate(fraction, normalized=True)
                lon, lat = self._to_wgs84.transform(point.x, point.y)

                waypoints.append(
                    self._create_waypoint(
                        index=index,
                        lon=lon,
                        lat=lat,
                        heading=heading,
                        gimbal_pitch=-90,
                        take_photo=True,
                    )
                )
                index += 1

        return waypoints
