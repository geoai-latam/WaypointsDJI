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


class TestCamerasEndpoint:
    """Tests for cameras endpoint."""

    def test_get_cameras(self, client):
        """Test cameras endpoint returns camera list."""
        response = client.get("/api/cameras")
        assert response.status_code == 200
        data = response.json()
        assert "cameras" in data
        assert "mini_4_pro" in data["cameras"]
        assert "mini_5_pro" in data["cameras"]


class TestCalculateEndpoint:
    """Tests for calculate endpoint."""

    def test_calculate_params(self, client):
        """Test flight parameter calculation."""
        response = client.post(
            "/api/calculate",
            json={
                "drone_model": "mini_4_pro",
                "target_gsd_cm": 2.0,
                "front_overlap_pct": 75,
                "side_overlap_pct": 65,
                "use_48mp": False,
            },
        )
        assert response.status_code == 200
        data = response.json()
        assert "altitude_m" in data
        assert "gsd_cm_px" in data
        assert "max_speed_ms" in data

    def test_calculate_with_area(self, client):
        """Test calculation with area estimate."""
        response = client.post(
            "/api/calculate",
            json={
                "drone_model": "mini_4_pro",
                "target_gsd_cm": 2.0,
                "front_overlap_pct": 75,
                "side_overlap_pct": 65,
                "use_48mp": False,
                "area_m2": 10000,
            },
        )
        assert response.status_code == 200
        data = response.json()
        assert data["estimated_photos"] > 0


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


class TestHealthEndpoint:
    """Tests for health check endpoint."""

    def test_health(self, client):
        """Test health check returns healthy status."""
        response = client.get("/health")
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "healthy"
