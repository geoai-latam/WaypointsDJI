"""Tests for WPML builder."""

import pytest
from xml.etree import ElementTree as ET
from app.wpml_builder import WPMLBuilder
from app.models import Waypoint, DroneModel


class TestWPMLBuilder:
    """Test suite for WPMLBuilder."""

    def setup_method(self):
        """Setup test fixtures."""
        self.waypoints = [
            Waypoint(
                index=0,
                longitude=-74.006,
                latitude=40.7128,
                altitude=60,
                heading=45,
                gimbal_pitch=-90,
                speed=5.0,
                take_photo=True,
            ),
            Waypoint(
                index=1,
                longitude=-74.005,
                latitude=40.7128,
                altitude=60,
                heading=45,
                gimbal_pitch=-90,
                speed=5.0,
                take_photo=True,
            ),
            Waypoint(
                index=2,
                longitude=-74.005,
                latitude=40.7138,
                altitude=60,
                heading=135,
                gimbal_pitch=-90,
                speed=5.0,
                take_photo=True,
            ),
        ]
        self.builder = WPMLBuilder(
            drone_model=DroneModel.MINI_4_PRO,
            waypoints=self.waypoints,
            mission_name="Test Mission",
        )

    def test_build_template_kml(self):
        """Test template.kml generation."""
        kml = self.builder.build_template_kml()

        assert "<?xml" in kml
        assert "kml" in kml
        assert "wpml" in kml
        assert "missionConfig" in kml
        assert "droneEnumValue" in kml
        assert "68" in kml  # Mini 4 Pro drone enum

    def test_template_kml_has_waypoints(self):
        """Test that template.kml contains waypoint placemarks."""
        kml = self.builder.build_template_kml()

        # Should have 3 placemarks
        assert kml.count("<Placemark>") == 3
        assert kml.count("</Placemark>") == 3

    def test_build_waylines_wpml(self):
        """Test waylines.wpml generation."""
        wpml = self.builder.build_waylines_wpml()

        assert "<?xml" in wpml
        assert "kml" in wpml
        assert "wpml" in wpml
        assert "waylineId" in wpml

    def test_wpml_has_actions(self):
        """Test that WPML contains gimbal and photo actions."""
        wpml = self.builder.build_waylines_wpml()

        assert "gimbalRotate" in wpml
        assert "takePhoto" in wpml
        assert "actionGroup" in wpml

    def test_coordinates_in_output(self):
        """Test that waypoint coordinates are in the output."""
        kml = self.builder.build_template_kml()

        assert "-74.006" in kml
        assert "40.7128" in kml

    def test_altitude_in_output(self):
        """Test that altitude is correctly set."""
        kml = self.builder.build_template_kml()

        # executeHeight should be 60
        assert ">60<" in kml or ">60.0<" in kml
