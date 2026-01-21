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
  photo_spacing_m: number;
  max_speed_ms: number;
  photo_interval_s: number;
  estimated_photos: number;
  estimated_flight_time_min: number;
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
  finish_action: FinishAction;
  takeoff_altitude_m: number;
}

export interface MissionResponse {
  success: boolean;
  message: string;
  flight_params?: FlightParams;
  waypoints?: Waypoint[];
  warnings: string[];
}

export interface CalculateRequest {
  drone_model: DroneModel;
  target_gsd_cm: number;
  front_overlap_pct: number;
  side_overlap_pct: number;
  use_48mp: boolean;
  area_m2?: number;
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
  speedMs?: number;
  finishAction: FinishAction;
}

export const DEFAULT_MISSION_CONFIG: MissionConfig = {
  droneModel: 'mini_4_pro',
  pattern: 'grid',
  targetGsdCm: 2.0,
  frontOverlapPct: 75,
  sideOverlapPct: 65,
  flightAngleDeg: 0,
  use48mp: false,
  finishAction: 'goHome',
};
