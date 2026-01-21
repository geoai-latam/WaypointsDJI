"""Tests for photogrammetric calculator."""

import pytest
from app.calculator import PhotogrammetryCalculator
from app.models import DroneModel, CAMERA_PRESETS


class TestPhotogrammetryCalculator:
    """Test suite for PhotogrammetryCalculator."""

    def setup_method(self):
        """Setup test fixtures."""
        self.calc = PhotogrammetryCalculator.for_drone(DroneModel.MINI_4_PRO)

    def test_gsd_to_altitude(self):
        """Test GSD to altitude conversion."""
        # 2 cm/px GSD should give ~57m altitude for Mini 4 Pro
        altitude = self.calc.gsd_to_altitude(2.0)
        assert 50 < altitude < 65

    def test_altitude_to_gsd(self):
        """Test altitude to GSD conversion."""
        # At 50m, GSD should be around 1.7-1.8 cm/px
        gsd = self.calc.altitude_to_gsd(50)
        assert 1.5 < gsd < 2.0

    def test_gsd_altitude_roundtrip(self):
        """Test that GSD->altitude->GSD is consistent."""
        original_gsd = 2.5
        altitude = self.calc.gsd_to_altitude(original_gsd)
        computed_gsd = self.calc.altitude_to_gsd(altitude)
        assert abs(computed_gsd - original_gsd) < 0.01

    def test_calculate_footprint(self):
        """Test footprint calculation."""
        width, height = self.calc.calculate_footprint(60)
        # At 60m, footprint should be roughly 85x64m
        assert 70 < width < 100
        assert 50 < height < 80

    def test_calculate_spacing_75_65_overlap(self):
        """Test spacing calculation with standard overlap."""
        altitude = 60
        photo_spacing, line_spacing = self.calc.calculate_spacing(
            altitude, front_overlap_pct=75, side_overlap_pct=65
        )
        # 75% front overlap means 25% of footprint height
        # 65% side overlap means 35% of footprint width
        width, height = self.calc.calculate_footprint(altitude)
        expected_photo = height * 0.25
        expected_line = width * 0.35
        assert abs(photo_spacing - expected_photo) < 0.1
        assert abs(line_spacing - expected_line) < 0.1

    def test_calculate_max_speed_12mp(self):
        """Test max speed calculation for 12MP mode."""
        speed = self.calc.calculate_max_speed(photo_spacing_m=10, use_48mp=False)
        # At 10m spacing with 2s interval, max speed = 5 m/s
        assert speed == 5.0

    def test_calculate_max_speed_48mp(self):
        """Test max speed calculation for 48MP mode."""
        speed = self.calc.calculate_max_speed(photo_spacing_m=10, use_48mp=True)
        # At 10m spacing with 5s interval, max speed = 2 m/s
        assert speed == 2.0

    def test_calculate_flight_params(self):
        """Test full flight params calculation."""
        params = self.calc.calculate_flight_params(
            target_gsd_cm=2.0,
            front_overlap_pct=75,
            side_overlap_pct=65,
            use_48mp=False,
            area_m2=10000,  # 100x100m area
        )

        assert params.altitude_m > 0
        assert params.gsd_cm_px > 0
        assert params.footprint_width_m > params.footprint_height_m
        assert params.line_spacing_m > 0
        assert params.photo_spacing_m > 0
        assert params.max_speed_ms > 0
        assert params.photo_interval_s == 2.0


class TestCameraPresets:
    """Test camera preset data."""

    def test_mini_4_pro_preset_exists(self):
        """Test Mini 4 Pro preset exists."""
        assert DroneModel.MINI_4_PRO in CAMERA_PRESETS
        camera = CAMERA_PRESETS[DroneModel.MINI_4_PRO]
        assert camera.name == "DJI Mini 4 Pro"
        assert camera.drone_enum_value == 68

    def test_mini_5_pro_preset_exists(self):
        """Test Mini 5 Pro preset exists."""
        assert DroneModel.MINI_5_PRO in CAMERA_PRESETS
        camera = CAMERA_PRESETS[DroneModel.MINI_5_PRO]
        assert camera.name == "DJI Mini 5 Pro"
        assert camera.drone_enum_value == 91
