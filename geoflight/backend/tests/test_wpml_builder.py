"""Tests for WPML builder."""

import pytest
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

    def test_template_kml_no_waypoints(self):
        """Test that template.kml does NOT contain waypoints (per DJI WPML spec)."""
        kml = self.builder.build_template_kml()

        # template.kml should NOT have Placemarks - those go only in waylines.wpml
        assert "<Placemark>" not in kml
        assert "</Placemark>" not in kml

    def test_template_kml_correct_namespace(self):
        """Test that template.kml uses correct WPML namespace."""
        kml = self.builder.build_template_kml()

        # Must use uav.com namespace, not dji.com
        assert "http://www.uav.com/wpmz/1.0.2" in kml
        assert "http://www.dji.com" not in kml

    def test_build_waylines_wpml(self):
        """Test waylines.wpml generation."""
        wpml = self.builder.build_waylines_wpml()

        assert "<?xml" in wpml
        assert "kml" in wpml
        assert "wpml" in wpml
        assert "waylineId" in wpml

    def test_waylines_wpml_has_placemarks(self):
        """Test that waylines.wpml contains waypoint placemarks."""
        wpml = self.builder.build_waylines_wpml()

        # Should have 3 placemarks
        assert wpml.count("<Placemark>") == 3
        assert wpml.count("</Placemark>") == 3

    def test_wpml_has_actions(self):
        """Test that WPML contains gimbal and photo actions."""
        wpml = self.builder.build_waylines_wpml()

        assert "gimbalRotate" in wpml
        assert "takePhoto" in wpml
        assert "actionGroup" in wpml

    def test_wpml_has_gimbal_evenly_rotate(self):
        """Test that WPML contains gimbalEvenlyRotate action."""
        wpml = self.builder.build_waylines_wpml()

        assert "gimbalEvenlyRotate" in wpml

    def test_coordinates_in_wpml(self):
        """Test that waypoint coordinates are in waylines.wpml."""
        wpml = self.builder.build_waylines_wpml()

        assert "-74.006" in wpml
        assert "40.7128" in wpml

    def test_altitude_in_wpml(self):
        """Test that altitude is correctly set in waylines.wpml."""
        wpml = self.builder.build_waylines_wpml()

        # executeHeight should be 60 (may include decimal like 60.0)
        assert "<wpml:executeHeight>60" in wpml or "<wpml:executeHeight>60.0" in wpml

    def test_first_waypoint_turn_mode(self):
        """Test that first waypoint has correct turn mode."""
        wpml = self.builder.build_waylines_wpml()

        # First waypoint should stop
        assert "toPointAndStopWithContinuityCurvature" in wpml

    def test_intermediate_waypoint_turn_mode(self):
        """Test that intermediate waypoints have correct turn mode."""
        wpml = self.builder.build_waylines_wpml()

        # Intermediate waypoints should pass through
        assert "toPointAndPassWithContinuityCurvature" in wpml

    def test_waypoint_gimbal_heading_param(self):
        """Test that each placemark has waypointGimbalHeadingParam."""
        wpml = self.builder.build_waylines_wpml()

        # Should have 3 waypointGimbalHeadingParam (one per waypoint)
        assert wpml.count("<wpml:waypointGimbalHeadingParam>") == 3

    def test_action_ids_sequential(self):
        """Test that action IDs are sequential starting from 1."""
        wpml = self.builder.build_waylines_wpml()

        # Action IDs should start at 1 and be sequential
        assert "<wpml:actionId>1</wpml:actionId>" in wpml
        assert "<wpml:actionId>2</wpml:actionId>" in wpml

    def test_waylines_wpml_no_author(self):
        """Test that waylines.wpml does NOT have author/createTime/updateTime."""
        wpml = self.builder.build_waylines_wpml()

        # waylines.wpml should not have these fields (per DJI WPML spec)
        assert "<wpml:author>" not in wpml
        assert "<wpml:createTime>" not in wpml
        assert "<wpml:updateTime>" not in wpml

    def test_template_kml_has_author(self):
        """Test that template.kml HAS author/createTime/updateTime."""
        kml = self.builder.build_template_kml()

        # template.kml should have these fields
        assert "<wpml:author>" in kml
        assert "<wpml:createTime>" in kml
        assert "<wpml:updateTime>" in kml
