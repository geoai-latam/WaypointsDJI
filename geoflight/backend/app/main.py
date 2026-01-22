"""FastAPI application for GeoFlight Planner."""

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import Response

from .config import settings
from .models import (
    DroneModel,
    FlightPattern,
    MissionRequest,
    MissionResponse,
    CalculateRequest,
    FlightParams,
    CameraListResponse,
    Waypoint,
    CAMERA_PRESETS,
)
from .calculator import PhotogrammetryCalculator
from .patterns import (
    GridPatternGenerator,
    DoubleGridPatternGenerator,
    CorridorPatternGenerator,
    OrbitPatternGenerator,
)
from .kmz_packager import KMZPackager


app = FastAPI(
    title=settings.app_name,
    version=settings.version,
    description="Flight planning API for photogrammetry missions with DJI drones",
)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/")
async def root():
    """Root endpoint with API info."""
    return {
        "name": settings.app_name,
        "version": settings.version,
        "endpoints": {
            "cameras": "/api/cameras",
            "calculate": "/api/calculate",
            "generate_waypoints": "/api/generate-waypoints",
            "generate_kmz": "/api/generate-kmz",
        },
    }


@app.get("/api/cameras", response_model=CameraListResponse)
async def get_cameras():
    """Get list of available camera/drone presets."""
    return CameraListResponse(
        cameras={model.value: spec for model, spec in CAMERA_PRESETS.items()}
    )


@app.post("/api/calculate", response_model=FlightParams)
async def calculate_params(request: CalculateRequest):
    """Calculate flight parameters without generating waypoints."""
    calculator = PhotogrammetryCalculator.for_drone(request.drone_model)

    params = calculator.calculate_flight_params(
        target_gsd_cm=request.target_gsd_cm,
        front_overlap_pct=request.front_overlap_pct,
        side_overlap_pct=request.side_overlap_pct,
        use_48mp=request.use_48mp,
        area_m2=request.area_m2,
        altitude_override_m=request.altitude_override_m,
        speed_override_ms=request.speed_override_ms,
    )

    return params


@app.post("/api/generate-waypoints", response_model=MissionResponse)
async def generate_waypoints(request: MissionRequest):
    """Generate waypoints for a mission."""
    # Validate that we have area definition
    if not request.polygon and not request.corridor and not request.orbit:
        raise HTTPException(
            status_code=400,
            detail="Must provide one of: polygon, corridor, or orbit definition",
        )

    # Calculate flight parameters (with optional overrides)
    calculator = PhotogrammetryCalculator.for_drone(request.drone_model)
    flight_params = calculator.calculate_flight_params(
        target_gsd_cm=request.target_gsd_cm,
        front_overlap_pct=request.front_overlap_pct,
        side_overlap_pct=request.side_overlap_pct,
        use_48mp=request.use_48mp,
        altitude_override_m=request.altitude_override_m,
        speed_override_ms=request.speed_ms,
    )

    warnings = []
    waypoints = []

    try:
        if request.pattern == FlightPattern.ORBIT:
            generator = OrbitPatternGenerator(flight_params, request.flight_angle_deg)
            # Support both explicit orbit definition and polygon-based generation
            if request.orbit:
                waypoints = generator.generate(
                    center=request.orbit.center,
                    radius_m=request.orbit.radius_m,
                    num_orbits=request.orbit.num_orbits,
                    altitude_step_m=request.orbit.altitude_step_m,
                )
            elif request.polygon:
                # Generate orbit from polygon (uses centroid and calculates radius)
                waypoints = generator.generate(
                    polygon_coords=request.polygon.coordinates,
                    num_orbits=3,  # Default orbits at different altitudes
                    altitude_step_m=10.0,
                    photos_per_orbit=24,
                )
            else:
                raise HTTPException(
                    status_code=400,
                    detail="Orbit pattern requires polygon or orbit definition",
                )

        elif request.pattern == FlightPattern.CORRIDOR:
            generator = CorridorPatternGenerator(flight_params, request.flight_angle_deg)
            # Support both explicit corridor definition and polygon-based generation
            if request.corridor:
                waypoints = generator.generate(
                    centerline_coords=request.corridor.centerline,
                    corridor_width_m=request.corridor.width_m,
                    num_lines=request.corridor.num_lines,
                )
            elif request.polygon:
                # Generate corridor from polygon (extracts centerline from longest axis)
                waypoints = generator.generate(
                    polygon_coords=request.polygon.coordinates,
                    num_lines=3,  # Default parallel lines
                )
            else:
                raise HTTPException(
                    status_code=400,
                    detail="Corridor pattern requires polygon or corridor definition",
                )

        elif request.pattern == FlightPattern.DOUBLE_GRID:
            if not request.polygon:
                raise HTTPException(
                    status_code=400,
                    detail="Double grid pattern requires polygon definition",
                )
            generator = DoubleGridPatternGenerator(flight_params, request.flight_angle_deg)
            waypoints = generator.generate(polygon_coords=request.polygon.coordinates)

        else:  # GRID
            if not request.polygon:
                raise HTTPException(
                    status_code=400,
                    detail="Grid pattern requires polygon definition",
                )
            generator = GridPatternGenerator(flight_params, request.flight_angle_deg)
            waypoints = generator.generate(polygon_coords=request.polygon.coordinates)

        # Check waypoint limit
        if len(waypoints) > settings.max_waypoints_per_mission:
            warnings.append(
                f"Mission has {len(waypoints)} waypoints, which exceeds the "
                f"DJI Fly limit of {settings.max_waypoints_per_mission}. "
                "Consider splitting into multiple missions."
            )

        return MissionResponse(
            success=True,
            message=f"Generated {len(waypoints)} waypoints",
            flight_params=flight_params,
            waypoints=waypoints,
            warnings=warnings,
        )

    except Exception as e:
        return MissionResponse(
            success=False,
            message=f"Error generating waypoints: {str(e)}",
            warnings=warnings,
        )


@app.post("/api/generate-kmz")
async def generate_kmz(request: MissionRequest):
    """Generate and download KMZ file for mission."""
    # First generate waypoints
    response = await generate_waypoints(request)

    if not response.success or not response.waypoints:
        raise HTTPException(
            status_code=400,
            detail=response.message,
        )

    # Create KMZ
    packager = KMZPackager(
        drone_model=request.drone_model,
        waypoints=response.waypoints,
    )

    kmz_bytes = packager.create_kmz(request.finish_action)
    stats = packager.get_mission_stats()

    # Return as downloadable file
    filename = f"mission_{request.pattern.value}_{stats['waypoint_count']}wp.kmz"

    return Response(
        content=kmz_bytes,
        media_type="application/vnd.google-earth.kmz",
        headers={
            "Content-Disposition": f'attachment; filename="{filename}"',
            "X-Waypoint-Count": str(stats["waypoint_count"]),
            "X-Estimated-Distance": str(stats["estimated_distance_m"]),
            "X-Estimated-Photos": str(stats["estimated_photos"]),
        },
    )


@app.get("/health")
async def health_check():
    """Health check endpoint."""
    return {"status": "healthy"}
