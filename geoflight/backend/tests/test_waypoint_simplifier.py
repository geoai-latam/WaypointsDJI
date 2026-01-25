"""Tests for waypoint simplifier."""

import pytest
from app.models import Waypoint
from app.waypoint_simplifier import WaypointSimplifier, simplify_waypoints


def create_waypoint(index: int, lon: float, lat: float, heading: float = 0) -> Waypoint:
    """Helper to create test waypoints."""
    return Waypoint(
        index=index,
        longitude=lon,
        latitude=lat,
        altitude=50.0,
        heading=heading,
        gimbal_pitch=-90,
        speed=5.0,
        take_photo=True,
    )


class TestWaypointSimplifier:
    """Tests for WaypointSimplifier class."""

    def test_simplify_empty_list(self):
        """Test simplifying empty waypoint list."""
        simplifier = WaypointSimplifier()
        result = simplifier.simplify([])
        assert result == []

    def test_simplify_single_waypoint(self):
        """Test simplifying list with single waypoint."""
        simplifier = WaypointSimplifier()
        waypoints = [create_waypoint(0, -74.0, 40.0)]
        result = simplifier.simplify(waypoints)
        assert len(result) == 1

    def test_simplify_two_waypoints(self):
        """Test simplifying list with two waypoints keeps both."""
        simplifier = WaypointSimplifier()
        waypoints = [
            create_waypoint(0, -74.0, 40.0),
            create_waypoint(1, -74.001, 40.001),
        ]
        result = simplifier.simplify(waypoints)
        assert len(result) == 2

    def test_simplify_keeps_first_and_last(self):
        """Test that first and last waypoints are always kept."""
        simplifier = WaypointSimplifier(angle_threshold_deg=1.0)
        # All waypoints have same heading, so only first and last should be kept
        waypoints = [
            create_waypoint(0, -74.0, 40.0, heading=0),
            create_waypoint(1, -74.0, 40.001, heading=0),
            create_waypoint(2, -74.0, 40.002, heading=0),
            create_waypoint(3, -74.0, 40.003, heading=0),
            create_waypoint(4, -74.0, 40.004, heading=0),
        ]
        result = simplifier.simplify(waypoints)
        assert len(result) == 2
        assert result[0].index == 0
        assert result[1].index == 1
        # Verify coordinates match first and last
        assert result[0].latitude == 40.0
        assert result[1].latitude == 40.004

    def test_simplify_keeps_turns(self):
        """Test that waypoints at heading changes are kept."""
        simplifier = WaypointSimplifier(angle_threshold_deg=5.0)
        # Create a path with a 90-degree turn
        waypoints = [
            create_waypoint(0, -74.0, 40.0, heading=0),
            create_waypoint(1, -74.0, 40.001, heading=0),
            create_waypoint(2, -74.0, 40.002, heading=0),  # End of straight segment
            create_waypoint(3, -74.001, 40.002, heading=90),  # Turn point
            create_waypoint(4, -74.002, 40.002, heading=90),
            create_waypoint(5, -74.003, 40.002, heading=90),
        ]
        result = simplifier.simplify(waypoints)
        # Should keep: first (0), before turn (2), after turn (3), last (5)
        assert len(result) == 4

    def test_simplify_with_multiple_turns(self):
        """Test simplifying path with multiple turns."""
        simplifier = WaypointSimplifier(angle_threshold_deg=5.0)
        # Serpentine pattern (like a grid flight)
        waypoints = [
            create_waypoint(0, -74.0, 40.0, heading=0),
            create_waypoint(1, -74.0, 40.001, heading=0),
            create_waypoint(2, -74.0, 40.002, heading=0),
            create_waypoint(3, -74.001, 40.002, heading=90),  # Turn 1
            create_waypoint(4, -74.001, 40.001, heading=180),  # Turn 2
            create_waypoint(5, -74.001, 40.0, heading=180),
            create_waypoint(6, -74.002, 40.0, heading=270),  # Turn 3
            create_waypoint(7, -74.002, 40.001, heading=0),  # Turn 4
            create_waypoint(8, -74.002, 40.002, heading=0),
        ]
        result = simplifier.simplify(waypoints)
        # Each turn keeps the point before and after, plus first and last
        assert len(result) >= 6

    def test_simplify_reindexes_waypoints(self):
        """Test that simplified waypoints are re-indexed correctly."""
        simplifier = WaypointSimplifier(angle_threshold_deg=5.0)
        waypoints = [
            create_waypoint(0, -74.0, 40.0, heading=0),
            create_waypoint(1, -74.0, 40.001, heading=0),
            create_waypoint(2, -74.0, 40.002, heading=0),
            create_waypoint(3, -74.0, 40.003, heading=90),  # Turn
            create_waypoint(4, -74.001, 40.003, heading=90),
        ]
        result = simplifier.simplify(waypoints)
        # Check that indices are sequential starting from 0
        for i, wp in enumerate(result):
            assert wp.index == i


class TestSimplifyWithDistanceConstraint:
    """Tests for simplification with maximum distance constraint."""

    def test_adds_intermediate_waypoints_for_distance(self):
        """Test that intermediate waypoints are added to maintain max distance."""
        simplifier = WaypointSimplifier(
            angle_threshold_deg=5.0,
            max_distance_between_m=50.0,
        )
        # Create a straight path about 200m long (no turns)
        # At ~40.0 latitude, 0.001 degree longitude ≈ 85m
        waypoints = [
            create_waypoint(0, -74.0, 40.0, heading=90),
            create_waypoint(1, -74.0005, 40.0, heading=90),
            create_waypoint(2, -74.001, 40.0, heading=90),
            create_waypoint(3, -74.0015, 40.0, heading=90),
            create_waypoint(4, -74.002, 40.0, heading=90),
            create_waypoint(5, -74.0025, 40.0, heading=90),
        ]
        result = simplifier.simplify(waypoints)
        # Should have more than just first/last due to distance constraint
        assert len(result) >= 3


class TestSimplifyWithTimeConstraint:
    """Tests for simplification with maximum time constraint."""

    def test_adds_intermediate_waypoints_for_time(self):
        """Test that intermediate waypoints are added based on time."""
        # At 5 m/s, 5 seconds = 25 meters
        simplifier = WaypointSimplifier(
            angle_threshold_deg=5.0,
            max_time_between_s=5.0,
            speed_ms=5.0,
        )
        # Create a straight path about 200m long (no turns)
        waypoints = [
            create_waypoint(0, -74.0, 40.0, heading=90),
            create_waypoint(1, -74.0005, 40.0, heading=90),
            create_waypoint(2, -74.001, 40.0, heading=90),
            create_waypoint(3, -74.0015, 40.0, heading=90),
            create_waypoint(4, -74.002, 40.0, heading=90),
            create_waypoint(5, -74.0025, 40.0, heading=90),
        ]
        result = simplifier.simplify(waypoints)
        # Should have more waypoints due to time constraint
        assert len(result) >= 3


class TestSimplifyWaypointsFunction:
    """Tests for the convenience function."""

    def test_disabled_returns_original(self):
        """Test that disabled simplification returns original waypoints."""
        waypoints = [
            create_waypoint(0, -74.0, 40.0, heading=0),
            create_waypoint(1, -74.0, 40.001, heading=0),
            create_waypoint(2, -74.0, 40.002, heading=0),
        ]
        result, stats = simplify_waypoints(waypoints, enabled=False)
        assert len(result) == 3
        assert stats["simplification_enabled"] is False
        assert stats["original_count"] == 3
        assert stats["simplified_count"] == 3
        assert stats["reduction_percent"] == 0.0

    def test_enabled_returns_simplified(self):
        """Test that enabled simplification works."""
        waypoints = [
            create_waypoint(0, -74.0, 40.0, heading=0),
            create_waypoint(1, -74.0, 40.001, heading=0),
            create_waypoint(2, -74.0, 40.002, heading=0),
            create_waypoint(3, -74.0, 40.003, heading=0),
        ]
        result, stats = simplify_waypoints(
            waypoints,
            enabled=True,
            angle_threshold_deg=5.0,
        )
        assert len(result) == 2  # Only first and last
        assert stats["simplification_enabled"] is True
        assert stats["original_count"] == 4
        assert stats["simplified_count"] == 2
        assert stats["reduction_percent"] == 50.0

    def test_stats_calculation(self):
        """Test that reduction statistics are calculated correctly."""
        waypoints = [
            create_waypoint(i, -74.0, 40.0 + i * 0.001, heading=0)
            for i in range(10)
        ]
        result, stats = simplify_waypoints(
            waypoints,
            enabled=True,
            angle_threshold_deg=5.0,
        )
        assert stats["original_count"] == 10
        assert stats["simplified_count"] == 2
        assert stats["reduction_percent"] == 80.0


class TestAngleThreshold:
    """Tests for different angle threshold values."""

    def test_high_threshold_keeps_fewer_points(self):
        """Test that higher threshold keeps fewer points."""
        # Create path with 10-degree turns
        waypoints = [
            create_waypoint(0, -74.0, 40.0, heading=0),
            create_waypoint(1, -74.0, 40.001, heading=0),
            create_waypoint(2, -74.0, 40.002, heading=10),  # 10 degree turn
            create_waypoint(3, -74.0, 40.003, heading=10),
        ]

        # With 5-degree threshold, should keep the turn
        simplifier_low = WaypointSimplifier(angle_threshold_deg=5.0)
        result_low = simplifier_low.simplify(waypoints)

        # With 15-degree threshold, should skip the turn
        simplifier_high = WaypointSimplifier(angle_threshold_deg=15.0)
        result_high = simplifier_high.simplify(waypoints)

        assert len(result_high) <= len(result_low)

    def test_heading_wraparound(self):
        """Test that heading change handles 360/0 wraparound."""
        simplifier = WaypointSimplifier(angle_threshold_deg=5.0)
        # Create a turn from 355 to 5 degrees (only 10 degrees, not 350)
        waypoints = [
            create_waypoint(0, -74.0, 40.0, heading=355),
            create_waypoint(1, -74.0, 40.001, heading=355),
            create_waypoint(2, -74.0, 40.002, heading=5),  # 10 degree turn
            create_waypoint(3, -74.0, 40.003, heading=5),
        ]
        result = simplifier.simplify(waypoints)
        # Should detect the turn (10 degrees > 5 degree threshold)
        assert len(result) == 4
