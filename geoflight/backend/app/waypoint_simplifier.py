"""Waypoint simplifier for reducing mission complexity.

This module provides functionality to reduce the number of waypoints in a mission
while maintaining the essential flight path. This is useful because:
- DJI Fly has a limit of 99 waypoints per mission
- Drones can follow a heading with a timer (e.g., every 5 seconds)
- Only waypoints at direction changes are strictly necessary

The simplifier keeps:
- First and last waypoints
- Waypoints where heading changes significantly (turns/direction changes)
- Optional intermediate waypoints at specified intervals
"""

import math
from typing import Optional
from .models import Waypoint


class WaypointSimplifier:
    """Simplify waypoint lists by removing unnecessary intermediate points."""

    def __init__(
        self,
        angle_threshold_deg: float = 5.0,
        max_distance_between_m: Optional[float] = None,
        max_time_between_s: Optional[float] = None,
        speed_ms: float = 5.0,
    ):
        """
        Initialize the waypoint simplifier.

        Args:
            angle_threshold_deg: Minimum heading change to consider as a turn (degrees).
                                 Waypoints with heading changes >= this value will be kept.
            max_distance_between_m: Maximum distance between kept waypoints (meters).
                                    If set, intermediate waypoints will be added to maintain
                                    this maximum spacing. Set to None to disable.
            max_time_between_s: Maximum time between kept waypoints (seconds).
                               Calculated using the waypoint speed. Overrides max_distance
                               if both are set. Common values: 5, 10, 15 seconds.
            speed_ms: Default speed in m/s for time calculations (used if waypoint has no speed).
        """
        self.angle_threshold_deg = angle_threshold_deg
        self.max_distance_between_m = max_distance_between_m
        self.max_time_between_s = max_time_between_s
        self.speed_ms = speed_ms

    def simplify(self, waypoints: list[Waypoint]) -> list[Waypoint]:
        """
        Simplify a list of waypoints.

        The algorithm:
        1. Always keep first and last waypoints
        2. Detect heading changes >= angle_threshold and keep those waypoints
        3. If max_distance or max_time is set, add intermediate waypoints

        Args:
            waypoints: Original list of waypoints

        Returns:
            Simplified list of waypoints with re-indexed indices
        """
        if len(waypoints) <= 2:
            return waypoints

        # Step 1: Find critical waypoints (turns and endpoints)
        critical_indices = self._find_critical_waypoints(waypoints)

        # Step 2: Add intermediate waypoints if spacing constraints are set
        if self.max_distance_between_m or self.max_time_between_s:
            critical_indices = self._add_intermediate_waypoints(
                waypoints, critical_indices
            )

        # Step 3: Build simplified list
        simplified = []
        for i, original_idx in enumerate(sorted(critical_indices)):
            wp = waypoints[original_idx]
            # Create new waypoint with updated index
            simplified.append(
                Waypoint(
                    index=i,
                    longitude=wp.longitude,
                    latitude=wp.latitude,
                    altitude=wp.altitude,
                    heading=wp.heading,
                    gimbal_pitch=wp.gimbal_pitch,
                    speed=wp.speed,
                    take_photo=wp.take_photo,
                )
            )

        return simplified

    def _find_critical_waypoints(self, waypoints: list[Waypoint]) -> set[int]:
        """
        Find indices of critical waypoints (turns and endpoints).

        A waypoint is critical if:
        - It's the first or last waypoint
        - Its heading differs significantly from the previous waypoint

        Args:
            waypoints: List of waypoints

        Returns:
            Set of critical waypoint indices
        """
        critical = {0, len(waypoints) - 1}  # Always keep first and last

        for i in range(1, len(waypoints)):
            prev_heading = waypoints[i - 1].heading
            curr_heading = waypoints[i].heading

            # Calculate heading difference (handle 360/0 wrap-around)
            diff = abs(curr_heading - prev_heading)
            if diff > 180:
                diff = 360 - diff

            if diff >= self.angle_threshold_deg:
                # Keep both the waypoint before the turn and the turn waypoint
                critical.add(i - 1)
                critical.add(i)

        return critical

    def _add_intermediate_waypoints(
        self, waypoints: list[Waypoint], critical_indices: set[int]
    ) -> set[int]:
        """
        Add intermediate waypoints to maintain spacing constraints.

        Args:
            waypoints: Original list of waypoints
            critical_indices: Set of already critical waypoint indices

        Returns:
            Updated set of indices including intermediates
        """
        result = critical_indices.copy()
        sorted_critical = sorted(critical_indices)

        for i in range(len(sorted_critical) - 1):
            start_idx = sorted_critical[i]
            end_idx = sorted_critical[i + 1]

            # Get waypoints between these critical points
            if end_idx - start_idx <= 1:
                continue  # No intermediate waypoints to consider

            # Calculate max allowed distance
            max_dist = self.max_distance_between_m
            if self.max_time_between_s:
                # Use the speed from the start waypoint for time-based calculation
                speed = waypoints[start_idx].speed or self.speed_ms
                max_dist = self.max_time_between_s * speed

            if not max_dist:
                continue

            # Add intermediate waypoints as needed
            accumulated_distance = 0.0
            last_added_idx = start_idx

            for j in range(start_idx + 1, end_idx):
                dist = self._haversine_distance(
                    waypoints[last_added_idx].latitude,
                    waypoints[last_added_idx].longitude,
                    waypoints[j].latitude,
                    waypoints[j].longitude,
                )
                accumulated_distance += self._haversine_distance(
                    waypoints[j - 1].latitude,
                    waypoints[j - 1].longitude,
                    waypoints[j].latitude,
                    waypoints[j].longitude,
                )

                # If we've exceeded max distance, add the previous waypoint
                if accumulated_distance >= max_dist:
                    result.add(j)
                    last_added_idx = j
                    accumulated_distance = 0.0

        return result

    @staticmethod
    def _haversine_distance(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
        """
        Calculate the great-circle distance between two points (meters).

        Uses the Haversine formula.

        Args:
            lat1, lon1: First point coordinates (degrees)
            lat2, lon2: Second point coordinates (degrees)

        Returns:
            Distance in meters
        """
        R = 6371000  # Earth's radius in meters

        lat1_rad = math.radians(lat1)
        lat2_rad = math.radians(lat2)
        delta_lat = math.radians(lat2 - lat1)
        delta_lon = math.radians(lon2 - lon1)

        a = (
            math.sin(delta_lat / 2) ** 2
            + math.cos(lat1_rad) * math.cos(lat2_rad) * math.sin(delta_lon / 2) ** 2
        )
        c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))

        return R * c


def simplify_waypoints(
    waypoints: list[Waypoint],
    enabled: bool = False,
    angle_threshold_deg: float = 5.0,
    max_time_between_s: Optional[float] = None,
    max_distance_between_m: Optional[float] = None,
) -> tuple[list[Waypoint], dict]:
    """
    Convenience function to simplify waypoints.

    Args:
        waypoints: Original list of waypoints
        enabled: Whether simplification is enabled
        angle_threshold_deg: Minimum heading change to keep a waypoint (degrees)
        max_time_between_s: Maximum time between waypoints (seconds)
        max_distance_between_m: Maximum distance between waypoints (meters)

    Returns:
        Tuple of (simplified waypoints, statistics dict)
    """
    if not enabled or len(waypoints) <= 2:
        return waypoints, {
            "original_count": len(waypoints),
            "simplified_count": len(waypoints),
            "reduction_percent": 0.0,
            "simplification_enabled": False,
        }

    # Determine speed from first waypoint
    speed_ms = waypoints[0].speed if waypoints else 5.0

    simplifier = WaypointSimplifier(
        angle_threshold_deg=angle_threshold_deg,
        max_distance_between_m=max_distance_between_m,
        max_time_between_s=max_time_between_s,
        speed_ms=speed_ms,
    )

    simplified = simplifier.simplify(waypoints)

    original_count = len(waypoints)
    simplified_count = len(simplified)
    reduction = ((original_count - simplified_count) / original_count * 100) if original_count > 0 else 0

    return simplified, {
        "original_count": original_count,
        "simplified_count": simplified_count,
        "reduction_percent": round(reduction, 1),
        "simplification_enabled": True,
    }
