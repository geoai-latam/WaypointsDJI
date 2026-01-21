"""Grid pattern generator for survey flights."""

import math
from shapely.geometry import Polygon, LineString, MultiLineString, box
from shapely.affinity import rotate
from shapely.ops import linemerge

from .base import PatternGenerator
from ..models import Waypoint, FlightParams, Coordinate


class GridPatternGenerator(PatternGenerator):
    """Generate grid (serpentine/lawnmower) pattern for photogrammetry."""

    def generate(self, polygon_coords: list[Coordinate], **kwargs) -> list[Waypoint]:
        """
        Generate grid pattern waypoints.

        Args:
            polygon_coords: List of polygon vertices in WGS84

        Returns:
            List of waypoints forming a serpentine grid pattern
        """
        if len(polygon_coords) < 3:
            return []

        # Setup coordinate transformation
        center_lon = sum(c.longitude for c in polygon_coords) / len(polygon_coords)
        center_lat = sum(c.latitude for c in polygon_coords) / len(polygon_coords)
        self._setup_transformers(center_lon, center_lat)

        # Convert to UTM
        utm_coords = self._to_utm_coords(polygon_coords)
        polygon = Polygon(utm_coords)

        if not polygon.is_valid:
            polygon = polygon.buffer(0)

        # Generate grid lines
        lines = self._generate_grid_lines(polygon)

        if not lines:
            return []

        # Convert to waypoints
        waypoints = self._lines_to_waypoints(lines)

        return waypoints

    def _generate_grid_lines(self, polygon: Polygon) -> list[LineString]:
        """Generate parallel grid lines covering the polygon."""
        # Get polygon bounds
        minx, miny, maxx, maxy = polygon.bounds
        center = polygon.centroid

        # Create extended bounding box for rotation
        diagonal = math.sqrt((maxx - minx) ** 2 + (maxy - miny) ** 2)
        extended_box = box(
            center.x - diagonal,
            center.y - diagonal,
            center.x + diagonal,
            center.y + diagonal,
        )

        # Generate lines at flight angle
        angle = self.flight_angle_deg
        line_spacing = self.flight_params.line_spacing_m

        # Create parallel lines
        lines = []
        y = center.y - diagonal

        while y <= center.y + diagonal:
            line = LineString([
                (center.x - diagonal, y),
                (center.x + diagonal, y),
            ])
            # Rotate line around center
            rotated_line = rotate(line, -angle, origin=center)
            lines.append(rotated_line)
            y += line_spacing

        # Clip lines to polygon
        clipped_lines = []
        for line in lines:
            intersection = line.intersection(polygon)
            if intersection.is_empty:
                continue
            if isinstance(intersection, LineString):
                clipped_lines.append(intersection)
            elif isinstance(intersection, MultiLineString):
                # Take only the longest segment
                longest = max(intersection.geoms, key=lambda g: g.length)
                clipped_lines.append(longest)

        # Sort lines and create serpentine pattern
        if not clipped_lines:
            return []

        # Sort by perpendicular distance from reference line
        ref_angle_rad = math.radians(self.flight_angle_deg)
        perpendicular_angle = ref_angle_rad + math.pi / 2

        def sort_key(line):
            mid = line.interpolate(0.5, normalized=True)
            # Project onto perpendicular axis
            return mid.x * math.cos(perpendicular_angle) + mid.y * math.sin(
                perpendicular_angle
            )

        clipped_lines.sort(key=sort_key)

        # Create serpentine by reversing every other line
        serpentine_lines = []
        for i, line in enumerate(clipped_lines):
            if i % 2 == 1:
                # Reverse line direction
                serpentine_lines.append(
                    LineString(list(line.coords)[::-1])
                )
            else:
                serpentine_lines.append(line)

        return serpentine_lines

    def _lines_to_waypoints(self, lines: list[LineString]) -> list[Waypoint]:
        """Convert grid lines to waypoints with photo points."""
        waypoints = []
        index = 0
        photo_spacing = self.flight_params.photo_spacing_m

        for i, line in enumerate(lines):
            # Calculate heading for this line
            coords = list(line.coords)
            if len(coords) < 2:
                continue

            heading = self._calculate_heading(coords[0], coords[-1])

            # Generate points along line at photo_spacing intervals
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
                        gimbal_pitch=-90,  # Nadir
                        take_photo=True,
                    )
                )
                index += 1

        return waypoints
