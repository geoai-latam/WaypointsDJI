/**
 * Worker client for mission generation.
 * Provides a Promise-based API to communicate with the Web Worker.
 */

import type {
  WorkerRequest,
  WorkerResponse,
  WorkerRequestType,
} from '../worker/types';
import type {
  MissionRequest,
  MissionResponse,
} from '../types';

type PendingRequest = {
  resolve: (value: WorkerResponse) => void;
  reject: (error: Error) => void;
};

class MissionWorkerClient {
  private worker: Worker | null = null;
  private pendingRequests: Map<string, PendingRequest> = new Map();
  private requestIdCounter = 0;

  /**
   * Get or create the worker instance.
   */
  private getWorker(): Worker {
    if (!this.worker) {
      console.log('[WorkerClient] Creating new worker instance');

      try {
        this.worker = new Worker(
          new URL('../worker/mission.worker.ts', import.meta.url),
          { type: 'module' }
        );
      } catch (err) {
        console.error('[WorkerClient] Failed to create worker:', err);
        throw new Error('No se pudo inicializar el worker de misión');
      }

      this.worker.onmessage = (event: MessageEvent<WorkerResponse>) => {
        const response = event.data;
        console.log('[WorkerClient] Received response:', response.id, response.success);

        const pending = this.pendingRequests.get(response.id);

        if (pending) {
          this.pendingRequests.delete(response.id);
          pending.resolve(response);
        } else {
          console.warn('[WorkerClient] No pending request for id:', response.id);
        }
      };

      this.worker.onerror = (error) => {
        console.error('[WorkerClient] Worker error:', error);
        // Reject all pending requests
        for (const [id, pending] of this.pendingRequests) {
          pending.reject(new Error(`Error del worker: ${error.message || 'Error desconocido'}`));
          this.pendingRequests.delete(id);
        }
      };

      this.worker.onmessageerror = (event) => {
        console.error('[WorkerClient] Message error:', event);
      };
    }

    return this.worker;
  }

  /**
   * Generate a unique request ID.
   */
  private generateRequestId(): string {
    this.requestIdCounter++;
    return `req_${this.requestIdCounter}_${Date.now()}`;
  }

  /**
   * Send a request to the worker and wait for response.
   */
  private async sendRequest(
    type: WorkerRequestType,
    payload: MissionRequest
  ): Promise<WorkerResponse> {
    const worker = this.getWorker();
    const id = this.generateRequestId();

    console.log(`[WorkerClient] Sending request ${id} type=${type}`);
    console.log(`[WorkerClient] Payload: pattern=${payload.pattern}, coords=${payload.polygon?.coordinates?.length || 0}`);

    return new Promise((resolve, reject) => {
      this.pendingRequests.set(id, { resolve, reject });

      const request: WorkerRequest = { id, type, payload };

      try {
        worker.postMessage(request);
      } catch (err) {
        console.error('[WorkerClient] Failed to post message:', err);
        this.pendingRequests.delete(id);
        reject(new Error('Error al enviar mensaje al worker'));
        return;
      }

      // Timeout after 60 seconds
      setTimeout(() => {
        if (this.pendingRequests.has(id)) {
          console.warn(`[WorkerClient] Request ${id} timed out`);
          this.pendingRequests.delete(id);
          reject(new Error('Tiempo de espera agotado'));
        }
      }, 60000);
    });
  }

  /**
   * Generate waypoints for a mission.
   */
  async generateWaypoints(request: MissionRequest): Promise<MissionResponse> {
    const response = await this.sendRequest('GENERATE_WAYPOINTS', request);

    console.log('[WorkerClient] Raw response:', response);

    if (!response.success) {
      console.error('[WorkerClient] Generation failed:', response.error);
      return {
        success: false,
        message: response.error,
        warnings: [],
      };
    }

    const waypoints = response.data?.waypoints || [];
    const flightParams = response.data?.flightParams;
    const warnings = response.data?.warnings || [];

    console.log('[WorkerClient] Parsed waypoints:', waypoints.length);
    if (waypoints.length > 0) {
      console.log('[WorkerClient] First waypoint:', waypoints[0]);
      console.log('[WorkerClient] Last waypoint:', waypoints[waypoints.length - 1]);
    }
    console.log('[WorkerClient] Flight params:', flightParams);

    return {
      success: true,
      message: 'Mission generated successfully',
      waypoints,
      flight_params: flightParams,
      warnings,
      simplification_stats: response.data?.simplificationStats,
    };
  }

  /**
   * Generate KMZ file for a mission.
   */
  async generateKmz(request: MissionRequest): Promise<Blob> {
    const response = await this.sendRequest('GENERATE_KMZ', request);

    if (!response.success) {
      throw new Error(response.error);
    }

    if (!response.data.kmzBlob) {
      throw new Error('No KMZ blob in response');
    }

    return response.data.kmzBlob;
  }

  /**
   * Terminate the worker.
   */
  terminate(): void {
    if (this.worker) {
      this.worker.terminate();
      this.worker = null;
    }
    this.pendingRequests.clear();
  }
}

// Singleton instance
let workerClient: MissionWorkerClient | null = null;

/**
 * Get the singleton worker client instance.
 */
export function getWorkerClient(): MissionWorkerClient {
  if (!workerClient) {
    workerClient = new MissionWorkerClient();
  }
  return workerClient;
}

/**
 * Trigger a file download in the browser.
 */
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
