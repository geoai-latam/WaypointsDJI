"""Tests for FastAPI endpoints."""

import pytest
from fastapi.testclient import TestClient
from app.main import app


@pytest.fixture
def client():
    """Create test client."""
    return TestClient(app)


class TestRootEndpoint:
    """Tests for root endpoint."""

    def test_root(self, client):
        """Test root endpoint returns API info."""
        response = client.get("/")
        assert response.status_code == 200
        data = response.json()
        assert "name" in data
        assert "version" in data
        assert "endpoints" in data
        # Cameras and calculate endpoints are now client-side
        assert "note" in data


class TestGenerateWaypointsEndpoint:
    """Tests for waypoint generation endpoint."""

    def test_generate_grid_waypoints(self, client):
        """Test grid waypoint generation."""
        response = client.post(
            "/api/generate-waypoints",
            json={
                "polygon": {
                    "coordinates": [
                        {"longitude": -74.006, "latitude": 40.7128},
                        {"longitude": -74.005, "latitude": 40.7128},
                        {"longitude": -74.005, "latitude": 40.7138},
                        {"longitude": -74.006, "latitude": 40.7138},
                    ]
                },
                "drone_model": "mini_4_pro",
                "pattern": "grid",
                "target_gsd_cm": 2.0,
                "front_overlap_pct": 75,
                "side_overlap_pct": 65,
                "flight_angle_deg": 0,
                "use_48mp": False,
                "finish_action": "goHome",
                "takeoff_altitude_m": 30,
            },
        )
        assert response.status_code == 200
        data = response.json()
        assert data["success"] is True
        assert "waypoints" in data
        assert len(data["waypoints"]) > 0

    def test_generate_without_polygon(self, client):
        """Test error when no area is provided."""
        response = client.post(
            "/api/generate-waypoints",
            json={
                "drone_model": "mini_4_pro",
                "pattern": "grid",
                "target_gsd_cm": 2.0,
                "front_overlap_pct": 75,
                "side_overlap_pct": 65,
                "flight_angle_deg": 0,
                "use_48mp": False,
                "finish_action": "goHome",
                "takeoff_altitude_m": 30,
            },
        )
        assert response.status_code == 400

    def test_generate_with_custom_gimbal_pitch(self, client):
        """Test waypoint generation with custom gimbal pitch."""
        response = client.post(
            "/api/generate-waypoints",
            json={
                "polygon": {
                    "coordinates": [
                        {"longitude": -74.006, "latitude": 40.7128},
                        {"longitude": -74.005, "latitude": 40.7128},
                        {"longitude": -74.005, "latitude": 40.7138},
                        {"longitude": -74.006, "latitude": 40.7138},
                    ]
                },
                "drone_model": "mini_4_pro",
                "pattern": "grid",
                "target_gsd_cm": 2.0,
                "front_overlap_pct": 75,
                "side_overlap_pct": 65,
                "flight_angle_deg": 0,
                "use_48mp": False,
                "gimbal_pitch_deg": -45,
                "finish_action": "goHome",
                "takeoff_altitude_m": 30,
            },
        )
        assert response.status_code == 200
        data = response.json()
        assert data["success"] is True
        # Verify all waypoints have the custom gimbal pitch
        for wp in data["waypoints"]:
            assert wp["gimbal_pitch"] == -45


class TestGenerateKMZEndpoint:
    """Tests for KMZ generation endpoint."""

    def test_generate_kmz(self, client):
        """Test KMZ file generation."""
        response = client.post(
            "/api/generate-kmz",
            json={
                "polygon": {
                    "coordinates": [
                        {"longitude": -74.006, "latitude": 40.7128},
                        {"longitude": -74.005, "latitude": 40.7128},
                        {"longitude": -74.005, "latitude": 40.7138},
                        {"longitude": -74.006, "latitude": 40.7138},
                    ]
                },
                "drone_model": "mini_4_pro",
                "pattern": "grid",
                "target_gsd_cm": 2.0,
                "front_overlap_pct": 75,
                "side_overlap_pct": 65,
                "flight_angle_deg": 0,
                "use_48mp": False,
                "finish_action": "goHome",
                "takeoff_altitude_m": 30,
            },
        )
        assert response.status_code == 200
        assert response.headers["content-type"] == "application/vnd.google-earth.kmz"
        assert "Content-Disposition" in response.headers


class TestWaypointSimplification:
    """Tests for waypoint simplification feature."""

    def test_generate_with_simplification_disabled(self, client):
        """Test that simplification disabled returns all waypoints."""
        response = client.post(
            "/api/generate-waypoints",
            json={
                "polygon": {
                    "coordinates": [
                        {"longitude": -74.006, "latitude": 40.7128},
                        {"longitude": -74.005, "latitude": 40.7128},
                        {"longitude": -74.005, "latitude": 40.7138},
                        {"longitude": -74.006, "latitude": 40.7138},
                    ]
                },
                "drone_model": "mini_4_pro",
                "pattern": "grid",
                "target_gsd_cm": 2.0,
                "front_overlap_pct": 75,
                "side_overlap_pct": 65,
                "flight_angle_deg": 0,
                "use_48mp": False,
                "finish_action": "goHome",
                "takeoff_altitude_m": 30,
                "simplify": {
                    "enabled": False,
                },
            },
        )
        assert response.status_code == 200
        data = response.json()
        assert data["success"] is True
        # No simplification stats when disabled
        assert data.get("simplification_stats") is None

    def test_generate_with_simplification_enabled(self, client):
        """Test that simplification enabled reduces waypoints."""
        response = client.post(
            "/api/generate-waypoints",
            json={
                "polygon": {
                    "coordinates": [
                        {"longitude": -74.006, "latitude": 40.7128},
                        {"longitude": -74.005, "latitude": 40.7128},
                        {"longitude": -74.005, "latitude": 40.7138},
                        {"longitude": -74.006, "latitude": 40.7138},
                    ]
                },
                "drone_model": "mini_4_pro",
                "pattern": "grid",
                "target_gsd_cm": 2.0,
                "front_overlap_pct": 75,
                "side_overlap_pct": 65,
                "flight_angle_deg": 0,
                "use_48mp": False,
                "finish_action": "goHome",
                "takeoff_altitude_m": 30,
                "simplify": {
                    "enabled": True,
                    "angle_threshold_deg": 5.0,
                },
            },
        )
        assert response.status_code == 200
        data = response.json()
        assert data["success"] is True
        assert "simplification_stats" in data
        assert data["simplification_stats"] is not None
        stats = data["simplification_stats"]
        assert stats["simplification_enabled"] is True
        assert stats["original_count"] >= stats["simplified_count"]
        assert stats["reduction_percent"] >= 0

    def test_generate_with_time_constraint(self, client):
        """Test simplification with time constraint."""
        response = client.post(
            "/api/generate-waypoints",
            json={
                "polygon": {
                    "coordinates": [
                        {"longitude": -74.006, "latitude": 40.7128},
                        {"longitude": -74.005, "latitude": 40.7128},
                        {"longitude": -74.005, "latitude": 40.7138},
                        {"longitude": -74.006, "latitude": 40.7138},
                    ]
                },
                "drone_model": "mini_4_pro",
                "pattern": "grid",
                "target_gsd_cm": 2.0,
                "front_overlap_pct": 75,
                "side_overlap_pct": 65,
                "flight_angle_deg": 0,
                "use_48mp": False,
                "finish_action": "goHome",
                "takeoff_altitude_m": 30,
                "simplify": {
                    "enabled": True,
                    "angle_threshold_deg": 5.0,
                    "max_time_between_s": 5.0,
                },
            },
        )
        assert response.status_code == 200
        data = response.json()
        assert data["success"] is True
        assert data["simplification_stats"]["simplification_enabled"] is True

    def test_generate_kmz_with_simplification(self, client):
        """Test KMZ generation with simplification."""
        response = client.post(
            "/api/generate-kmz",
            json={
                "polygon": {
                    "coordinates": [
                        {"longitude": -74.006, "latitude": 40.7128},
                        {"longitude": -74.005, "latitude": 40.7128},
                        {"longitude": -74.005, "latitude": 40.7138},
                        {"longitude": -74.006, "latitude": 40.7138},
                    ]
                },
                "drone_model": "mini_4_pro",
                "pattern": "grid",
                "target_gsd_cm": 2.0,
                "front_overlap_pct": 75,
                "side_overlap_pct": 65,
                "flight_angle_deg": 0,
                "use_48mp": False,
                "finish_action": "goHome",
                "takeoff_altitude_m": 30,
                "simplify": {
                    "enabled": True,
                    "angle_threshold_deg": 5.0,
                },
            },
        )
        assert response.status_code == 200
        assert response.headers["content-type"] == "application/vnd.google-earth.kmz"


class TestHealthEndpoint:
    """Tests for health check endpoint."""

    def test_health(self, client):
        """Test health check returns healthy status."""
        response = client.get("/health")
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "healthy"
