"""Corridor pattern generator for linear features."""

import math
from shapely.geometry import LineString, Point, Polygon
from shapely.ops import unary_union
from shapely.affinity import rotate

from .base import PatternGenerator
from ..models import Waypoint, FlightParams, Coordinate


class CorridorPatternGenerator(PatternGenerator):
    """Generate corridor pattern for linear features (roads, rivers, pipelines)."""

    def generate(
        self,
        polygon_coords: list[Coordinate] = None,
        centerline_coords: list[Coordinate] = None,
        corridor_width_m: float = None,
        num_lines: int = 3,
        **kwargs,
    ) -> list[Waypoint]:
        """
        Generate corridor pattern waypoints.

        Can work with either:
        - A polygon (will extract centerline from longest axis)
        - Explicit centerline coordinates

        Args:
            polygon_coords: List of polygon vertices in WGS84 (optional)
            centerline_coords: List of centerline vertices in WGS84 (optional)
            corridor_width_m: Width of corridor in meters (auto-calculated if polygon)
            num_lines: Number of parallel lines (1-5)

        Returns:
            List of waypoints forming parallel lines along corridor
        """
        # If polygon provided, extract centerline from it
        if polygon_coords and len(polygon_coords) >= 3:
            return self._generate_from_polygon(polygon_coords, num_lines)

        # Otherwise use explicit centerline
        if centerline_coords and len(centerline_coords) >= 2:
            return self._generate_from_centerline(
                centerline_coords, corridor_width_m or 50, num_lines
            )

        return []

    def _generate_from_polygon(
        self, polygon_coords: list[Coordinate], num_lines: int
    ) -> list[Waypoint]:
        """Generate corridor from polygon by finding its longest axis."""
        # Setup coordinate transformation
        center_lon = sum(c.longitude for c in polygon_coords) / len(polygon_coords)
        center_lat = sum(c.latitude for c in polygon_coords) / len(polygon_coords)
        self._setup_transformers(center_lon, center_lat)

        # Convert to UTM
        utm_coords = self._to_utm_coords(polygon_coords)
        polygon = Polygon(utm_coords)

        if not polygon.is_valid:
            polygon = polygon.buffer(0)

        # Get minimum rotated rectangle to find main axis
        min_rect = polygon.minimum_rotated_rectangle
        rect_coords = list(min_rect.exterior.coords)

        # Find the two longest edges (they define the main axis)
        edges = []
        for i in range(4):
            p1 = rect_coords[i]
            p2 = rect_coords[(i + 1) % 4]
            length = math.sqrt((p2[0] - p1[0]) ** 2 + (p2[1] - p1[1]) ** 2)
            edges.append((length, p1, p2))

        edges.sort(key=lambda x: x[0], reverse=True)

        # Use the midpoints of the two short edges as centerline endpoints
        long_edge1 = edges[0]
        long_edge2 = edges[1]

        # Calculate midpoints of long edges
        mid1 = ((long_edge1[1][0] + long_edge1[2][0]) / 2,
                (long_edge1[1][1] + long_edge1[2][1]) / 2)
        mid2 = ((long_edge2[1][0] + long_edge2[2][0]) / 2,
                (long_edge2[1][1] + long_edge2[2][1]) / 2)

        centerline = LineString([mid1, mid2])

        # Corridor width is the short edge length
        corridor_width = edges[2][0]

        # Extend centerline beyond polygon
        extension = self.flight_params.line_spacing_m * 2
        centerline = self._extend_line(centerline, extension)

        # Generate parallel lines
        lines = self._generate_parallel_lines(centerline, corridor_width, num_lines)

        # Convert to waypoints
        return self._lines_to_waypoints(lines)

    def _generate_from_centerline(
        self,
        centerline_coords: list[Coordinate],
        corridor_width_m: float,
        num_lines: int,
    ) -> list[Waypoint]:
        """Generate corridor from explicit centerline."""
        num_lines = max(1, min(5, num_lines))

        # Setup coordinate transformation
        center_lon = sum(c.longitude for c in centerline_coords) / len(centerline_coords)
        center_lat = sum(c.latitude for c in centerline_coords) / len(centerline_coords)
        self._setup_transformers(center_lon, center_lat)

        # Convert to UTM
        utm_coords = self._to_utm_coords(centerline_coords)
        centerline = LineString(utm_coords)

        # Extend centerline
        extension = self.flight_params.line_spacing_m * 2
        centerline = self._extend_line(centerline, extension)

        # Generate parallel lines
        lines = self._generate_parallel_lines(centerline, corridor_width_m, num_lines)

        # Convert to waypoints
        return self._lines_to_waypoints(lines)

    def _extend_line(self, line: LineString, distance: float) -> LineString:
        """Extend a line by distance at both ends."""
        coords = list(line.coords)
        if len(coords) < 2:
            return line

        # Extend start
        dx = coords[0][0] - coords[1][0]
        dy = coords[0][1] - coords[1][1]
        length = math.sqrt(dx * dx + dy * dy)
        if length > 0:
            new_start = (
                coords[0][0] + dx / length * distance,
                coords[0][1] + dy / length * distance,
            )
            coords[0] = new_start

        # Extend end
        dx = coords[-1][0] - coords[-2][0]
        dy = coords[-1][1] - coords[-2][1]
        length = math.sqrt(dx * dx + dy * dy)
        if length > 0:
            new_end = (
                coords[-1][0] + dx / length * distance,
                coords[-1][1] + dy / length * distance,
            )
            coords[-1] = new_end

        return LineString(coords)

    def _generate_parallel_lines(
        self,
        centerline: LineString,
        width: float,
        num_lines: int,
    ) -> list[LineString]:
        """Generate parallel lines along centerline."""
        lines = []
        num_lines = max(1, min(5, num_lines))

        if num_lines == 1:
            offsets = [0]
        else:
            half_width = width / 2
            offsets = [
                -half_width + i * width / (num_lines - 1)
                for i in range(num_lines)
            ]

        for i, offset in enumerate(offsets):
            if offset == 0:
                line = centerline
            else:
                try:
                    line = centerline.parallel_offset(
                        abs(offset), "left" if offset > 0 else "right"
                    )
                    if not isinstance(line, LineString) or not line.is_valid:
                        continue
                    if offset < 0:
                        line = LineString(list(line.coords)[::-1])
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

            heading = self._calculate_heading(coords[0], coords[-1])
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
                        take_photo=True,
                    )
                )
                index += 1

        return waypoints
