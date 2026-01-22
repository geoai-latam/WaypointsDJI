"""Double grid pattern generator (crosshatch) for 3D mapping."""

from .grid import GridPatternGenerator
from ..models import Waypoint, FlightParams, Coordinate


class DoubleGridPatternGenerator(GridPatternGenerator):
    """Generate double grid (crosshatch) pattern for better 3D reconstruction."""

    def generate(self, polygon_coords: list[Coordinate], buffer_percent: float = 15, **kwargs) -> list[Waypoint]:
        """
        Generate double grid pattern with two perpendicular passes.

        Args:
            polygon_coords: List of polygon vertices in WGS84
            buffer_percent: Percentage to extend beyond polygon (default 15%)

        Returns:
            List of waypoints forming a crosshatch pattern
        """
        if len(polygon_coords) < 3:
            return []

        # First pass at original angle
        first_pass = super().generate(polygon_coords, buffer_percent=buffer_percent)

        # Second pass at perpendicular angle (+90 degrees)
        original_angle = self.flight_angle_deg
        self.flight_angle_deg = (original_angle + 90) % 360

        second_pass = super().generate(polygon_coords, buffer_percent=buffer_percent)

        # Re-index second pass waypoints
        offset = len(first_pass)
        for wp in second_pass:
            wp.index += offset

        # Restore original angle
        self.flight_angle_deg = original_angle

        # Combine passes
        return first_pass + second_pass
