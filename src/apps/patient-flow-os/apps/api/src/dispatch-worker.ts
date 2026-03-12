import {
  PatientCaseCopilotDispatchDrainResult,
  PatientCaseCopilotService
} from "./copilot.js";

export interface CopilotDispatchWorkerOptions {
  autoStart?: boolean;
  tenantId?: string;
  workerId?: string;
  intervalMs?: number;
  limit?: number;
  leaseTtlMs?: number;
}

export interface CopilotDispatchWorkerController {
  readonly workerId: string;
  isRunning(): boolean;
  start(): void;
  stop(): void;
  drainNow(): Promise<PatientCaseCopilotDispatchDrainResult>;
}

export function createCopilotDispatchWorker(
  service: PatientCaseCopilotService,
  options: CopilotDispatchWorkerOptions = {}
): CopilotDispatchWorkerController {
  const workerId = options.workerId?.trim() || "patient_flow_dispatch_worker";
  const intervalMs = options.intervalMs ?? 1_500;
  let timer: ReturnType<typeof setInterval> | null = null;
  let inFlight: Promise<PatientCaseCopilotDispatchDrainResult> | null = null;

  const drainNow = (): Promise<PatientCaseCopilotDispatchDrainResult> => {
    if (inFlight) {
      return inFlight;
    }

    inFlight = service
      .drainDispatchQueue({
        tenantId: options.tenantId,
        workerId,
        limit: options.limit,
        leaseTtlMs: options.leaseTtlMs
      })
      .finally(() => {
        inFlight = null;
      });

    return inFlight;
  };

  const start = (): void => {
    if (timer) {
      return;
    }

    timer = setInterval(() => {
      void drainNow().catch(() => undefined);
    }, intervalMs);
    void drainNow().catch(() => undefined);
  };

  const stop = (): void => {
    if (!timer) {
      return;
    }
    clearInterval(timer);
    timer = null;
  };

  if (options.autoStart) {
    start();
  }

  return {
    workerId,
    isRunning: () => timer !== null,
    start,
    stop,
    drainNow
  };
}
