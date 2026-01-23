"""Tests for pattern generators."""

import pytest
from app.patterns import GridPatternGenerator, DoubleGridPatternGenerator
from app.models import FlightParams, Coordinate


class TestGridPatternGenerator:
    """Test suite for GridPatternGenerator."""

    def setup_method(self):
        """Setup test fixtures."""
        self.params = FlightParams(
            altitude_m=60,
            gsd_cm_px=2.0,
            footprint_width_m=85.6,
            footprint_height_m=64.2,
            line_spacing_m=30,
            photo_spacing_m=16,
            max_speed_ms=8.0,
            photo_interval_s=2.0,
            estimated_photos=0,
            estimated_flight_time_min=0,
        )

    def test_generate_simple_polygon(self):
        """Test waypoint generation for a simple square polygon."""
        generator = GridPatternGenerator(self.params, flight_angle_deg=0)

        # Simple 100x100m square (roughly)
        polygon = [
            Coordinate(longitude=-74.0060, latitude=40.7128),
            Coordinate(longitude=-74.0050, latitude=40.7128),
            Coordinate(longitude=-74.0050, latitude=40.7138),
            Coordinate(longitude=-74.0060, latitude=40.7138),
        ]

        waypoints = generator.generate(polygon)

        assert len(waypoints) > 0
        assert all(wp.altitude == self.params.altitude_m for wp in waypoints)
        assert all(wp.gimbal_pitch == -90 for wp in waypoints)  # Default gimbal pitch

    def test_generate_with_custom_gimbal_pitch(self):
        """Test waypoint generation with custom gimbal pitch."""
        generator = GridPatternGenerator(self.params, flight_angle_deg=0, gimbal_pitch_deg=-45)

        polygon = [
            Coordinate(longitude=-74.0060, latitude=40.7128),
            Coordinate(longitude=-74.0050, latitude=40.7128),
            Coordinate(longitude=-74.0050, latitude=40.7138),
            Coordinate(longitude=-74.0060, latitude=40.7138),
        ]

        waypoints = generator.generate(polygon)

        assert len(waypoints) > 0
        assert all(wp.gimbal_pitch == -45 for wp in waypoints)

    def test_generate_with_angle(self):
        """Test waypoint generation with flight angle."""
        generator = GridPatternGenerator(self.params, flight_angle_deg=45)

        polygon = [
            Coordinate(longitude=-74.0060, latitude=40.7128),
            Coordinate(longitude=-74.0050, latitude=40.7128),
            Coordinate(longitude=-74.0050, latitude=40.7138),
            Coordinate(longitude=-74.0060, latitude=40.7138),
        ]

        waypoints = generator.generate(polygon)

        assert len(waypoints) > 0

    def test_empty_polygon(self):
        """Test with too few points."""
        generator = GridPatternGenerator(self.params)
        waypoints = generator.generate([])
        assert waypoints == []

    def test_two_point_polygon(self):
        """Test with only two points (invalid polygon)."""
        generator = GridPatternGenerator(self.params)
        polygon = [
            Coordinate(longitude=-74.0060, latitude=40.7128),
            Coordinate(longitude=-74.0050, latitude=40.7128),
        ]
        waypoints = generator.generate(polygon)
        assert waypoints == []


class TestDoubleGridPatternGenerator:
    """Test suite for DoubleGridPatternGenerator."""

    def setup_method(self):
        """Setup test fixtures."""
        self.params = FlightParams(
            altitude_m=60,
            gsd_cm_px=2.0,
            footprint_width_m=85.6,
            footprint_height_m=64.2,
            line_spacing_m=30,
            photo_spacing_m=16,
            max_speed_ms=8.0,
            photo_interval_s=2.0,
            estimated_photos=0,
            estimated_flight_time_min=0,
        )

    def test_double_grid_has_more_waypoints(self):
        """Test that double grid generates more waypoints than single grid."""
        polygon = [
            Coordinate(longitude=-74.0060, latitude=40.7128),
            Coordinate(longitude=-74.0050, latitude=40.7128),
            Coordinate(longitude=-74.0050, latitude=40.7138),
            Coordinate(longitude=-74.0060, latitude=40.7138),
        ]

        single_gen = GridPatternGenerator(self.params)
        double_gen = DoubleGridPatternGenerator(self.params)

        single_waypoints = single_gen.generate(polygon)
        double_waypoints = double_gen.generate(polygon)

        # Double grid should have roughly 2x the waypoints
        assert len(double_waypoints) > len(single_waypoints)
        assert len(double_waypoints) >= len(single_waypoints) * 1.5
