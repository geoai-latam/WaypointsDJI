"""Photogrammetric calculations for flight planning."""

import math
from typing import Optional

from .models import (
    CameraSpec,
    DroneModel,
    FlightParams,
    CAMERA_PRESETS,
)


class PhotogrammetryCalculator:
    """Calculator for photogrammetric flight parameters."""

    def __init__(self, camera: CameraSpec):
        self.camera = camera

    @classmethod
    def for_drone(cls, drone_model: DroneModel) -> "PhotogrammetryCalculator":
        """Create calculator for specific drone model."""
        return cls(CAMERA_PRESETS[drone_model])

    def gsd_to_altitude(self, gsd_cm: float) -> float:
        """
        Calculate flight altitude from target GSD.

        GSD = (sensor_width * altitude * 100) / (focal_length * image_width)
        altitude = (GSD * focal_length * image_width) / (sensor_width * 100)

        Args:
            gsd_cm: Target Ground Sample Distance in cm/pixel

        Returns:
            Flight altitude in meters
        """
        altitude = (
            gsd_cm
            * self.camera.focal_length_mm
            * self.camera.image_width_px
        ) / (self.camera.sensor_width_mm * 100)
        return altitude

    def altitude_to_gsd(self, altitude_m: float) -> float:
        """
        Calculate GSD from flight altitude.

        Args:
            altitude_m: Flight altitude in meters

        Returns:
            GSD in cm/pixel
        """
        gsd = (
            self.camera.sensor_width_mm
            * altitude_m
            * 100
        ) / (self.camera.focal_length_mm * self.camera.image_width_px)
        return gsd

    def calculate_footprint(self, altitude_m: float) -> tuple[float, float]:
        """
        Calculate ground footprint dimensions.

        Args:
            altitude_m: Flight altitude in meters

        Returns:
            Tuple of (width_m, height_m)
        """
        # Footprint = (sensor_size / focal_length) * altitude
        width = (self.camera.sensor_width_mm / self.camera.focal_length_mm) * altitude_m
        height = (self.camera.sensor_height_mm / self.camera.focal_length_mm) * altitude_m
        return width, height

    def calculate_spacing(
        self,
        altitude_m: float,
        front_overlap_pct: float,
        side_overlap_pct: float,
    ) -> tuple[float, float]:
        """
        Calculate photo and line spacing from overlap requirements.

        Args:
            altitude_m: Flight altitude in meters
            front_overlap_pct: Forward overlap percentage (0-100)
            side_overlap_pct: Side overlap percentage (0-100)

        Returns:
            Tuple of (photo_spacing_m, line_spacing_m)
        """
        footprint_w, footprint_h = self.calculate_footprint(altitude_m)

        # Photo spacing (along flight direction) based on front overlap
        photo_spacing = footprint_h * (1 - front_overlap_pct / 100)

        # Line spacing (perpendicular to flight) based on side overlap
        line_spacing = footprint_w * (1 - side_overlap_pct / 100)

        return photo_spacing, line_spacing

    def calculate_max_speed(
        self,
        photo_spacing_m: float,
        use_48mp: bool,
    ) -> float:
        """
        Calculate maximum flight speed to maintain photo interval.

        Args:
            photo_spacing_m: Distance between photos in meters
            use_48mp: Whether using 48MP mode

        Returns:
            Maximum speed in m/s
        """
        interval = (
            self.camera.min_interval_48mp if use_48mp
            else self.camera.min_interval_12mp
        )
        return photo_spacing_m / interval

    def calculate_flight_params(
        self,
        target_gsd_cm: float,
        front_overlap_pct: float,
        side_overlap_pct: float,
        use_48mp: bool,
        area_m2: Optional[float] = None,
    ) -> FlightParams:
        """
        Calculate all flight parameters.

        Args:
            target_gsd_cm: Target GSD in cm/pixel
            front_overlap_pct: Forward overlap percentage
            side_overlap_pct: Side overlap percentage
            use_48mp: Whether using 48MP mode
            area_m2: Optional area for photo estimates

        Returns:
            FlightParams with all calculated values
        """
        altitude = self.gsd_to_altitude(target_gsd_cm)
        actual_gsd = self.altitude_to_gsd(altitude)
        footprint_w, footprint_h = self.calculate_footprint(altitude)
        photo_spacing, line_spacing = self.calculate_spacing(
            altitude, front_overlap_pct, side_overlap_pct
        )
        max_speed = self.calculate_max_speed(photo_spacing, use_48mp)

        # Photo interval
        interval = (
            self.camera.min_interval_48mp if use_48mp
            else self.camera.min_interval_12mp
        )

        # Estimate photos and flight time if area is provided
        if area_m2 and area_m2 > 0:
            # Rough estimate: area / (photo_spacing * line_spacing)
            effective_coverage = photo_spacing * line_spacing
            estimated_photos = int(area_m2 / effective_coverage * 1.2)  # 20% margin

            # Estimate flight distance
            side_length = math.sqrt(area_m2)
            num_lines = side_length / line_spacing
            flight_distance = side_length * num_lines * 1.1  # 10% for turns

            # Flight time
            flight_time = (flight_distance / max_speed) / 60  # minutes
        else:
            estimated_photos = 0
            flight_time = 0

        return FlightParams(
            altitude_m=round(altitude, 1),
            gsd_cm_px=round(actual_gsd, 3),
            footprint_width_m=round(footprint_w, 2),
            footprint_height_m=round(footprint_h, 2),
            line_spacing_m=round(line_spacing, 2),
            photo_spacing_m=round(photo_spacing, 2),
            max_speed_ms=round(max_speed, 2),
            photo_interval_s=interval,
            estimated_photos=estimated_photos,
            estimated_flight_time_min=round(flight_time, 1),
        )
