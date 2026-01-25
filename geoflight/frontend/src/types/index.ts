// API Types matching backend models

export type DroneModel = 'mini_4_pro' | 'mini_5_pro';

export type FlightPattern = 'grid' | 'double_grid' | 'corridor' | 'orbit';

export type FinishAction = 'goHome' | 'noAction' | 'autoLand' | 'gotoFirstWaypoint';

export interface CameraSpec {
  name: string;
  sensor_width_mm: number;
  sensor_height_mm: number;
  focal_length_mm: number;
  image_width_px: number;
  image_height_px: number;
  drone_enum_value: number;
  payload_enum_value: number;
  min_interval_12mp: number;
  min_interval_48mp: number;
}

// Camera presets - static data (no need for API call)
export const CAMERA_PRESETS: Record<DroneModel, CameraSpec> = {
  mini_4_pro: {
    name: 'DJI Mini 4 Pro',
    sensor_width_mm: 9.59,
    sensor_height_mm: 7.19,
    focal_length_mm: 6.72,
    image_width_px: 8064,
    image_height_px: 6048,
    drone_enum_value: 68,
    payload_enum_value: 52,
    min_interval_12mp: 2.0,
    min_interval_48mp: 5.0,
  },
  mini_5_pro: {
    name: 'DJI Mini 5 Pro',
    sensor_width_mm: 9.59,
    sensor_height_mm: 7.19,
    focal_length_mm: 6.72,
    image_width_px: 8064,
    image_height_px: 6048,
    drone_enum_value: 91,
    payload_enum_value: 80,
    min_interval_12mp: 2.0,
    min_interval_48mp: 5.0,
  },
};

export interface Coordinate {
  longitude: number;
  latitude: number;
}

export interface Waypoint {
  index: number;
  longitude: number;
  latitude: number;
  altitude: number;
  heading: number;
  gimbal_pitch: number;
  speed: number;
  take_photo: boolean;
}

export interface FlightParams {
  altitude_m: number;
  gsd_cm_px: number;
  footprint_width_m: number;
  footprint_height_m: number;
  line_spacing_m: number;
  photo_spacing_m: number;  // Required spacing for desired overlap
  max_speed_ms: number;     // Speed needed for desired overlap with current interval
  photo_interval_s: number;
  estimated_photos: number;
  estimated_flight_time_min: number;
  // Timer mode calculations (when using timer with custom speed)
  actual_speed_ms?: number;           // User-configured speed
  actual_photo_spacing_m?: number;    // speed × interval
  actual_front_overlap_pct?: number;  // Resulting overlap with actual spacing
}

export interface PolygonArea {
  coordinates: Coordinate[];
}

export interface CorridorDefinition {
  centerline: Coordinate[];
  width_m: number;
  num_lines: number;
}

export interface OrbitDefinition {
  center: Coordinate;
  radius_m: number;
  num_orbits: number;
  altitude_step_m: number;
}

export interface SimplificationOptions {
  enabled: boolean;
  angle_threshold_deg: number;
  max_time_between_s?: number;
  max_distance_between_m?: number;
}

export interface SimplificationStats {
  original_count: number;
  simplified_count: number;
  reduction_percent: number;
  simplification_enabled: boolean;
}

export interface MissionRequest {
  polygon?: PolygonArea;
  corridor?: CorridorDefinition;
  orbit?: OrbitDefinition;
  drone_model: DroneModel;
  pattern: FlightPattern;
  target_gsd_cm: number;
  front_overlap_pct: number;
  side_overlap_pct: number;
  flight_angle_deg: number;
  use_48mp: boolean;
  speed_ms?: number;
  altitude_override_m?: number;
  gimbal_pitch_deg: number;
  finish_action: FinishAction;
  takeoff_altitude_m: number;
  simplify?: SimplificationOptions;
}

export interface MissionResponse {
  success: boolean;
  message: string;
  flight_params?: FlightParams;
  waypoints?: Waypoint[];
  warnings: string[];
  simplification_stats?: SimplificationStats;
}

export interface CalculateRequest {
  drone_model: DroneModel;
  target_gsd_cm: number;
  front_overlap_pct: number;
  side_overlap_pct: number;
  use_48mp: boolean;
  area_m2?: number;
  altitude_override_m?: number;
  speed_override_ms?: number;
}

export interface CameraListResponse {
  cameras: Record<string, CameraSpec>;
}

// UI State Types
export interface MissionConfig {
  droneModel: DroneModel;
  pattern: FlightPattern;
  targetGsdCm: number;
  frontOverlapPct: number;
  sideOverlapPct: number;
  flightAngleDeg: number;
  use48mp: boolean;
  finishAction: FinishAction;
  // Flight parameters
  speedMs: number;
  gimbalPitchDeg: number;
  altitudeOverrideM?: number;
  useAltitudeOverride: boolean;
  // Timer mode (for simplification with photo timer)
  useTimerMode: boolean;
  photoIntervalS: number;
  // Simplification parameters
  useSimplify: boolean;
  simplifyAngleThreshold: number;
  simplifyMaxTimeBetween: number;
  useSimplifyTimeConstraint: boolean;
}

export const DEFAULT_MISSION_CONFIG: MissionConfig = {
  droneModel: 'mini_5_pro',
  pattern: 'grid',
  targetGsdCm: 1.0,
  frontOverlapPct: 75,
  sideOverlapPct: 65,
  flightAngleDeg: 0,
  use48mp: false,
  finishAction: 'goHome',
  speedMs: 5.0,
  gimbalPitchDeg: -90,
  altitudeOverrideM: 50,
  useAltitudeOverride: false,
  // Timer mode defaults
  useTimerMode: false,
  photoIntervalS: 5.0,
  // Simplification defaults
  useSimplify: false,
  simplifyAngleThreshold: 15.0,
  simplifyMaxTimeBetween: 10.0,
  useSimplifyTimeConstraint: false,
};
