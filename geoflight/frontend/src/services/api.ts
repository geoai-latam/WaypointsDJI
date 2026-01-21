// API service for GeoFlight backend

import type {
  CameraListResponse,
  CalculateRequest,
  FlightParams,
  MissionRequest,
  MissionResponse,
} from '../types';

const API_BASE = '/api';

async function handleResponse<T>(response: Response): Promise<T> {
  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: 'Request failed' }));
    throw new Error(error.detail || `HTTP error ${response.status}`);
  }
  return response.json();
}

export async function getCameras(): Promise<CameraListResponse> {
  const response = await fetch(`${API_BASE}/cameras`);
  return handleResponse<CameraListResponse>(response);
}

export async function calculateParams(
  request: CalculateRequest
): Promise<FlightParams> {
  const response = await fetch(`${API_BASE}/calculate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(request),
  });
  return handleResponse<FlightParams>(response);
}

export async function generateWaypoints(
  request: MissionRequest
): Promise<MissionResponse> {
  const response = await fetch(`${API_BASE}/generate-waypoints`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(request),
  });
  return handleResponse<MissionResponse>(response);
}

export async function downloadKmz(request: MissionRequest): Promise<Blob> {
  const response = await fetch(`${API_BASE}/generate-kmz`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(request),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: 'Request failed' }));
    throw new Error(error.detail || `HTTP error ${response.status}`);
  }

  return response.blob();
}

export function triggerDownload(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
