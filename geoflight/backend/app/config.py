"""Application configuration."""

from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    """Application settings."""

    app_name: str = "GeoFlight Planner"
    version: str = "1.0.0"
    debug: bool = True

    # CORS settings
    cors_origins: list[str] = ["http://localhost:5173", "http://127.0.0.1:5173"]

    # DJI constraints
    min_photo_interval_12mp: float = 2.0  # seconds
    min_photo_interval_48mp: float = 5.0  # seconds
    max_waypoints_per_mission: int = 99

    class Config:
        env_file = ".env"


settings = Settings()
