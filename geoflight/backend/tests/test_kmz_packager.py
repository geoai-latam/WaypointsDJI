"""Tests for KMZ packager."""

import pytest
import zipfile
import io
from app.kmz_packager import KMZPackager
from app.models import Waypoint, DroneModel


class TestKMZPackager:
    """Test suite for KMZPackager."""

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
        ]
        self.packager = KMZPackager(
            drone_model=DroneModel.MINI_4_PRO,
            waypoints=self.waypoints,
        )

    def test_create_kmz_returns_bytes(self):
        """Test that create_kmz returns bytes."""
        kmz = self.packager.create_kmz()
        assert isinstance(kmz, bytes)
        assert len(kmz) > 0

    def test_kmz_is_valid_zip(self):
        """Test that KMZ is a valid ZIP file."""
        kmz = self.packager.create_kmz()
        buffer = io.BytesIO(kmz)

        with zipfile.ZipFile(buffer, "r") as zf:
            assert zf.testzip() is None  # No corruption

    def test_kmz_structure(self):
        """Test KMZ contains correct file structure."""
        kmz = self.packager.create_kmz()
        buffer = io.BytesIO(kmz)

        with zipfile.ZipFile(buffer, "r") as zf:
            names = zf.namelist()
            assert "wpmz/template.kml" in names
            assert "wpmz/waylines.wpml" in names

    def test_template_kml_content(self):
        """Test template.kml has valid content."""
        kmz = self.packager.create_kmz()
        buffer = io.BytesIO(kmz)

        with zipfile.ZipFile(buffer, "r") as zf:
            content = zf.read("wpmz/template.kml").decode("utf-8")
            assert "<?xml" in content
            assert "missionConfig" in content

    def test_waylines_wpml_content(self):
        """Test waylines.wpml has valid content."""
        kmz = self.packager.create_kmz()
        buffer = io.BytesIO(kmz)

        with zipfile.ZipFile(buffer, "r") as zf:
            content = zf.read("wpmz/waylines.wpml").decode("utf-8")
            assert "<?xml" in content
            assert "waylineId" in content

    def test_get_mission_stats(self):
        """Test mission statistics calculation."""
        stats = self.packager.get_mission_stats()

        assert stats["waypoint_count"] == 2
        assert stats["estimated_photos"] == 2
        assert stats["estimated_distance_m"] > 0

    def test_empty_waypoints_stats(self):
        """Test stats with no waypoints."""
        packager = KMZPackager(
            drone_model=DroneModel.MINI_4_PRO,
            waypoints=[],
        )
        stats = packager.get_mission_stats()

        assert stats["waypoint_count"] == 0
        assert stats["estimated_photos"] == 0
        assert stats["estimated_distance_m"] == 0
