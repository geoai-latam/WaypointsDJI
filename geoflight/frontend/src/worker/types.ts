/**
 * Types for Web Worker message protocol
 */

import type {
  Waypoint,
  FlightParams,
  MissionRequest,
  SimplificationStats,
} from '../types';

export type WorkerRequestType = 'GENERATE_WAYPOINTS' | 'GENERATE_KMZ';

export interface WorkerRequest {
  id: string;
  type: WorkerRequestType;
  payload: MissionRequest;
}

export interface WorkerSuccessResponse {
  id: string;
  type: WorkerRequestType;
  success: true;
  data: {
    waypoints?: Waypoint[];
    flightParams?: FlightParams;
    warnings: string[];
    simplificationStats?: SimplificationStats;
    kmzBlob?: Blob;
  };
}

export interface WorkerErrorResponse {
  id: string;
  type: WorkerRequestType;
  success: false;
  error: string;
}

export type WorkerResponse = WorkerSuccessResponse | WorkerErrorResponse;

/**
 * Internal types used within the worker
 */

export interface PatternGeneratorParams {
  flightParams: FlightParams;
  flightAngleDeg: number;
  gimbalPitchDeg: number;
}

export interface GenerationResult {
  waypoints: Waypoint[];
  warnings: string[];
  simplificationStats?: SimplificationStats;
}
