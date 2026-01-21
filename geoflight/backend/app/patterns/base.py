"""Base class for flight pattern generators."""

from abc import ABC, abstractmethod
from typing import Optional
import math

from shapely.geometry import Polygon, LineString, Point
from shapely.affinity import rotate
from pyproj import Transformer

from ..models import Waypoint, FlightParams, Coordinate


class PatternGenerator(ABC):
    """Abstract base class for flight pattern generators."""

    # WGS84 to UTM and back transformers (will be set per operation)
    _to_utm: Optional[Transformer] = None
    _to_wgs84: Optional[Transformer] = None
    _utm_zone: Optional[int] = None

    def __init__(self, flight_params: FlightParams, flight_angle_deg: float = 0):
        self.flight_params = flight_params
        self.flight_angle_deg = flight_angle_deg

    def _get_utm_zone(self, lon: float) -> int:
        """Get UTM zone for a longitude."""
        return int((lon + 180) / 6) + 1

    def _setup_transformers(self, center_lon: float, center_lat: float) -> None:
        """Setup coordinate transformers based on center point."""
        zone = self._get_utm_zone(center_lon)
        hemisphere = "north" if center_lat >= 0 else "south"
        epsg_utm = 32600 + zone if hemisphere == "north" else 32700 + zone

        self._to_utm = Transformer.from_crs(
            "EPSG:4326", f"EPSG:{epsg_utm}", always_xy=True
        )
        self._to_wgs84 = Transformer.from_crs(
            f"EPSG:{epsg_utm}", "EPSG:4326", always_xy=True
        )
        self._utm_zone = zone

    def _to_utm_coords(self, coords: list[Coordinate]) -> list[tuple[float, float]]:
        """Convert WGS84 coordinates to UTM."""
        if not self._to_utm:
            raise ValueError("Transformers not initialized")
        return [self._to_utm.transform(c.longitude, c.latitude) for c in coords]

    def _to_wgs84_coords(
        self, coords: list[tuple[float, float]]
    ) -> list[tuple[float, float]]:
        """Convert UTM coordinates to WGS84."""
        if not self._to_wgs84:
            raise ValueError("Transformers not initialized")
        return [self._to_wgs84.transform(x, y) for x, y in coords]

    def _calculate_heading(self, from_pt: tuple, to_pt: tuple) -> float:
        """Calculate heading between two points in degrees (0-360)."""
        dx = to_pt[0] - from_pt[0]
        dy = to_pt[1] - from_pt[1]
        heading = math.degrees(math.atan2(dx, dy))  # atan2(x,y) for heading from north
        return (heading + 360) % 360

    @abstractmethod
    def generate(self, **kwargs) -> list[Waypoint]:
        """Generate waypoints for this pattern."""
        pass

    def _create_waypoint(
        self,
        index: int,
        lon: float,
        lat: float,
        heading: float = 0,
        gimbal_pitch: float = -90,
        take_photo: bool = True,
    ) -> Waypoint:
        """Create a waypoint with standard parameters."""
        return Waypoint(
            index=index,
            longitude=lon,
            latitude=lat,
            altitude=self.flight_params.altitude_m,
            heading=heading,
            gimbal_pitch=gimbal_pitch,
            speed=self.flight_params.max_speed_ms,
            take_photo=take_photo,
        )
