"""Pydantic models for GeoFlight Planner."""

from enum import Enum
from typing import Optional
from pydantic import BaseModel, Field


class DroneModel(str, Enum):
    """Supported DJI drone models."""

    MINI_4_PRO = "mini_4_pro"
    MINI_5_PRO = "mini_5_pro"


class FlightPattern(str, Enum):
    """Available flight patterns."""

    GRID = "grid"
    DOUBLE_GRID = "double_grid"
    CORRIDOR = "corridor"
    ORBIT = "orbit"


class FinishAction(str, Enum):
    """Action to perform at end of mission."""

    GO_HOME = "goHome"
    NO_ACTION = "noAction"
    AUTO_LAND = "autoLand"
    GO_TO_FIRST_WAYPOINT = "gotoFirstWaypoint"


class CameraSpec(BaseModel):
    """Camera specifications for a drone."""

    name: str
    sensor_width_mm: float = Field(..., description="Sensor width in mm")
    sensor_height_mm: float = Field(..., description="Sensor height in mm")
    focal_length_mm: float = Field(..., description="Focal length in mm")
    image_width_px: int = Field(..., description="Image width in pixels")
    image_height_px: int = Field(..., description="Image height in pixels")
    drone_enum_value: int = Field(..., description="DJI drone enum value for WPML")
    payload_enum_value: int = Field(..., description="DJI payload enum value for WPML")
    min_interval_12mp: float = Field(2.0, description="Min photo interval at 12MP (seconds)")
    min_interval_48mp: float = Field(5.0, description="Min photo interval at 48MP (seconds)")


# Camera presets
CAMERA_PRESETS: dict[DroneModel, CameraSpec] = {
    DroneModel.MINI_4_PRO: CameraSpec(
        name="DJI Mini 4 Pro",
        sensor_width_mm=9.59,
        sensor_height_mm=7.19,
        focal_length_mm=6.72,
        image_width_px=8064,
        image_height_px=6048,
        drone_enum_value=68,
        payload_enum_value=52,
        min_interval_12mp=2.0,
        min_interval_48mp=5.0,
    ),
    DroneModel.MINI_5_PRO: CameraSpec(
        name="DJI Mini 5 Pro",
        sensor_width_mm=9.59,
        sensor_height_mm=7.19,
        focal_length_mm=6.72,
        image_width_px=8064,
        image_height_px=6048,
        drone_enum_value=91,
        payload_enum_value=80,
        min_interval_12mp=2.0,
        min_interval_48mp=5.0,
    ),
}


class Coordinate(BaseModel):
    """Geographic coordinate."""

    longitude: float = Field(..., ge=-180, le=180)
    latitude: float = Field(..., ge=-90, le=90)


class Waypoint(BaseModel):
    """A single waypoint in the flight path."""

    index: int
    longitude: float
    latitude: float
    altitude: float = Field(..., description="Relative altitude in meters (AGL)")
    heading: float = Field(0, ge=0, lt=360, description="Heading in degrees")
    gimbal_pitch: float = Field(-90, ge=-90, le=0, description="Gimbal pitch angle")
    speed: float = Field(5.0, gt=0, description="Speed in m/s")
    take_photo: bool = Field(True, description="Whether to take photo at this waypoint")


class FlightParams(BaseModel):
    """Calculated flight parameters."""

    altitude_m: float = Field(..., description="Flight altitude in meters AGL")
    gsd_cm_px: float = Field(..., description="Ground Sample Distance in cm/pixel")
    footprint_width_m: float = Field(..., description="Image footprint width in meters")
    footprint_height_m: float = Field(..., description="Image footprint height in meters")
    line_spacing_m: float = Field(..., description="Spacing between flight lines in meters")
    photo_spacing_m: float = Field(..., description="Spacing between photos in meters")
    max_speed_ms: float = Field(..., description="Maximum speed to maintain photo interval")
    photo_interval_s: float = Field(..., description="Photo interval in seconds")
    estimated_photos: int = Field(..., description="Estimated number of photos")
    estimated_flight_time_min: float = Field(..., description="Estimated flight time in minutes")


class PolygonArea(BaseModel):
    """Polygon area definition."""

    coordinates: list[Coordinate] = Field(..., min_length=3, description="Polygon vertices")


class CorridorDefinition(BaseModel):
    """Corridor (linear) area definition."""

    centerline: list[Coordinate] = Field(..., min_length=2, description="Centerline points")
    width_m: float = Field(..., gt=0, description="Corridor width in meters")
    num_lines: int = Field(3, ge=1, le=5, description="Number of parallel lines")


class OrbitDefinition(BaseModel):
    """Orbit/circular pattern definition."""

    center: Coordinate
    radius_m: float = Field(..., gt=0, description="Orbit radius in meters")
    num_orbits: int = Field(1, ge=1, le=5, description="Number of concentric orbits")
    altitude_step_m: float = Field(10, description="Altitude step between orbits")


class MissionRequest(BaseModel):
    """Request to generate a flight mission."""

    # Area definition (one of these must be provided)
    polygon: Optional[PolygonArea] = None
    corridor: Optional[CorridorDefinition] = None
    orbit: Optional[OrbitDefinition] = None

    # Flight parameters
    drone_model: DroneModel = DroneModel.MINI_4_PRO
    pattern: FlightPattern = FlightPattern.GRID
    target_gsd_cm: float = Field(2.0, gt=0, le=10, description="Target GSD in cm/pixel")
    front_overlap_pct: float = Field(75, ge=50, le=95, description="Front overlap percentage")
    side_overlap_pct: float = Field(65, ge=50, le=95, description="Side overlap percentage")
    flight_angle_deg: float = Field(0, ge=0, lt=360, description="Flight direction angle")
    use_48mp: bool = Field(False, description="Use 48MP mode (longer interval)")
    speed_ms: Optional[float] = Field(None, gt=0, le=15, description="Override speed (m/s)")

    # Mission settings
    finish_action: FinishAction = FinishAction.GO_HOME
    takeoff_altitude_m: float = Field(30, gt=0, description="Initial takeoff altitude")


class CalculateRequest(BaseModel):
    """Request to calculate flight parameters only."""

    drone_model: DroneModel = DroneModel.MINI_4_PRO
    target_gsd_cm: float = Field(2.0, gt=0, le=10)
    front_overlap_pct: float = Field(75, ge=50, le=95)
    side_overlap_pct: float = Field(65, ge=50, le=95)
    use_48mp: bool = Field(False)
    area_m2: Optional[float] = Field(None, gt=0, description="Optional area for estimates")


class MissionResponse(BaseModel):
    """Response with generated mission."""

    success: bool
    message: str
    flight_params: Optional[FlightParams] = None
    waypoints: Optional[list[Waypoint]] = None
    warnings: list[str] = Field(default_factory=list)


class CameraListResponse(BaseModel):
    """Response with available cameras."""

    cameras: dict[str, CameraSpec]
