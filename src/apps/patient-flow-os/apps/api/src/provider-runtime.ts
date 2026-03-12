import { createHmac, timingSafeEqual } from "node:crypto";

import type { TenantConfig } from "../../../packages/core/src/index.js";
import { resolveTenantWebhookSigningSecret } from "./provider-registry.js";

export const PROVIDER_WEBHOOK_SIGNATURE_HEADER = "x-patient-flow-signature";
export const PROVIDER_WEBHOOK_TIMESTAMP_HEADER = "x-patient-flow-timestamp";

const DEFAULT_WEBHOOK_TOLERANCE_MS = 10 * 60 * 1000;

const permanentDispatchErrorPatterns = [
  /not found/i,
  /does not belong/i,
  /no longer pending/i,
  /must be claimed/i,
  /stale/i,
  /message draft not available/i,
  /provider remediation cannot replay/i,
  /incompatible with/i
];

export interface DispatchRetryPolicy {
  destinationSystem: string;
  maxAttempts: number;
  baseDelayMs: number;
  maxDelayMs: number;
}

export interface DispatchFailureAssessment {
  retryable: boolean;
  retryAfterMs: number | null;
  policy: DispatchRetryPolicy;
}

export interface SignedProviderWebhookPayload {
  receiptRecordId?: string;
  preparedActionId?: string;
  dispatchJobId?: string;
  system: string;
  eventType: string;
  idempotencyKey?: string;
  externalRef?: string | null;
  payload?: Record<string, unknown>;
  occurredAt?: string | null;
  error?: string | null;
}

export class RetryableDispatchError extends Error {
  readonly retryAfterMs: number | null;

  constructor(message: string, options: { retryAfterMs?: number | null } = {}) {
    super(message);
    this.name = "RetryableDispatchError";
    this.retryAfterMs = options.retryAfterMs ?? null;
  }
}

export class PermanentDispatchError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PermanentDispatchError";
  }
}

export class ProviderWebhookAuthError extends Error {
  readonly statusCode = 401;
  readonly code = "invalid_webhook_signature";

  constructor(message: string) {
    super(message);
    this.name = "ProviderWebhookAuthError";
  }
}

const destinationRetryPolicies: Record<string, DispatchRetryPolicy> = {
  queue_console: {
    destinationSystem: "queue_console",
    maxAttempts: 3,
    baseDelayMs: 5_000,
    maxDelayMs: 60_000
  },
  scheduling_workbench: {
    destinationSystem: "scheduling_workbench",
    maxAttempts: 4,
    baseDelayMs: 15_000,
    maxDelayMs: 120_000
  },
  payments_review_queue: {
    destinationSystem: "payments_review_queue",
    maxAttempts: 4,
    baseDelayMs: 20_000,
    maxDelayMs: 180_000
  },
  ops_followup_queue: {
    destinationSystem: "ops_followup_queue",
    maxAttempts: 4,
    baseDelayMs: 10_000,
    maxDelayMs: 120_000
  },
  ops_handoff_queue: {
    destinationSystem: "ops_handoff_queue",
    maxAttempts: 2,
    baseDelayMs: 5_000,
    maxDelayMs: 30_000
  }
};

const defaultRetryPolicy: DispatchRetryPolicy = {
  destinationSystem: "unknown_destination",
  maxAttempts: 3,
  baseDelayMs: 15_000,
  maxDelayMs: 120_000
};

function addMilliseconds(isoTimestamp: string, delayMs: number): string {
  return new Date(new Date(isoTimestamp).getTime() + delayMs).toISOString();
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function stableStringify(value: unknown): string {
  if (value === null || typeof value !== "object") {
    return JSON.stringify(value);
  }

  if (Array.isArray(value)) {
    return `[${value.map((entry) => stableStringify(entry)).join(",")}]`;
  }

  const entries = Object.entries(value)
    .filter(([, entryValue]) => entryValue !== undefined)
    .sort(([leftKey], [rightKey]) => leftKey.localeCompare(rightKey));
  return `{${entries
    .map(([key, entryValue]) => `${JSON.stringify(key)}:${stableStringify(entryValue)}`)
    .join(",")}}`;
}

function normalizeWebhookPayload(payload: SignedProviderWebhookPayload) {
  return {
    receiptRecordId: payload.receiptRecordId ?? null,
    preparedActionId: payload.preparedActionId ?? null,
    dispatchJobId: payload.dispatchJobId ?? null,
    system: payload.system,
    eventType: payload.eventType,
    idempotencyKey: payload.idempotencyKey ?? null,
    externalRef: payload.externalRef ?? null,
    payload: isPlainObject(payload.payload) ? payload.payload : {},
    occurredAt: payload.occurredAt ?? null,
    error: payload.error ?? null
  };
}

function normalizeHeaderValue(value: string | string[] | undefined): string | null {
  if (Array.isArray(value)) {
    return value[0] ?? null;
  }
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
}

function readHeader(
  headers: Record<string, string | string[] | undefined>,
  headerName: string
): string | null {
  const exact = normalizeHeaderValue(headers[headerName]);
  if (exact) {
    return exact;
  }

  const match = Object.entries(headers).find(
    ([key]) => key.toLowerCase() === headerName.toLowerCase()
  );
  return match ? normalizeHeaderValue(match[1]) : null;
}

function buildWebhookSignatureBase(input: {
  tenantId: string;
  timestamp: string;
  payload: SignedProviderWebhookPayload;
}): string {
  return stableStringify({
    tenantId: input.tenantId,
    timestamp: input.timestamp,
    webhook: normalizeWebhookPayload(input.payload)
  });
}

function signWebhook(secret: string, message: string): string {
  return createHmac("sha256", secret).update(message).digest("hex");
}

export function resolveDispatchRetryPolicy(destinationSystem: string): DispatchRetryPolicy {
  return destinationRetryPolicies[destinationSystem] ?? {
    ...defaultRetryPolicy,
    destinationSystem
  };
}

export function assessDispatchFailure(input: {
  destinationSystem: string;
  error: unknown;
}): DispatchFailureAssessment {
  const policy = resolveDispatchRetryPolicy(input.destinationSystem);

  if (input.error instanceof PermanentDispatchError) {
    return {
      retryable: false,
      retryAfterMs: null,
      policy
    };
  }

  if (input.error instanceof RetryableDispatchError) {
    return {
      retryable: true,
      retryAfterMs: input.error.retryAfterMs,
      policy
    };
  }

  const message = input.error instanceof Error ? input.error.message : String(input.error ?? "");
  if (permanentDispatchErrorPatterns.some((pattern) => pattern.test(message))) {
    return {
      retryable: false,
      retryAfterMs: null,
      policy
    };
  }

  return {
    retryable: true,
    retryAfterMs: null,
    policy
  };
}

export function buildDispatchRetryAvailableAt(input: {
  destinationSystem: string;
  nextAttempt: number;
  now?: string;
  retryAfterMs?: number | null;
}): string {
  const policy = resolveDispatchRetryPolicy(input.destinationSystem);
  const now = input.now ?? new Date().toISOString();
  const retryAfterMs =
    input.retryAfterMs ??
    Math.min(
      policy.maxDelayMs,
      policy.baseDelayMs * 2 ** Math.max(0, input.nextAttempt - 2)
    );
  return addMilliseconds(now, retryAfterMs);
}

export function buildSignedProviderWebhookHeaders(input: {
  tenant: TenantConfig;
  payload: SignedProviderWebhookPayload;
  timestamp?: string;
}): Record<string, string> {
  const resolved = resolveTenantWebhookSigningSecret(input.tenant, input.payload.system);
  if (!resolved.binding.isWebhookEnabled || !resolved.secret) {
    return {};
  }

  const timestamp = input.timestamp ?? new Date().toISOString();
  const signature = signWebhook(
    resolved.secret,
    buildWebhookSignatureBase({
      tenantId: input.tenant.id,
      timestamp,
      payload: input.payload
    })
  );

  return {
    [PROVIDER_WEBHOOK_TIMESTAMP_HEADER]: timestamp,
    [PROVIDER_WEBHOOK_SIGNATURE_HEADER]: signature
  };
}

export function assertSignedProviderWebhook(input: {
  tenant: TenantConfig;
  payload: SignedProviderWebhookPayload;
  headers: Record<string, string | string[] | undefined>;
  now?: string;
  toleranceMs?: number;
}): void {
  const resolved = resolveTenantWebhookSigningSecret(input.tenant, input.payload.system);
  if (!resolved.binding.isWebhookEnabled || !resolved.secret) {
    return;
  }

  const timestamp = readHeader(input.headers, PROVIDER_WEBHOOK_TIMESTAMP_HEADER);
  const signature = readHeader(input.headers, PROVIDER_WEBHOOK_SIGNATURE_HEADER);

  if (!timestamp || !signature) {
    throw new ProviderWebhookAuthError("missing provider webhook signature");
  }

  const parsedTimestamp = new Date(timestamp);
  if (Number.isNaN(parsedTimestamp.getTime())) {
    throw new ProviderWebhookAuthError("invalid provider webhook timestamp");
  }

  const now = input.now ? new Date(input.now) : new Date();
  const toleranceMs = input.toleranceMs ?? DEFAULT_WEBHOOK_TOLERANCE_MS;
  if (Math.abs(now.getTime() - parsedTimestamp.getTime()) > toleranceMs) {
    throw new ProviderWebhookAuthError("provider webhook timestamp expired");
  }

  const expectedSignature = signWebhook(
    resolved.secret,
    buildWebhookSignatureBase({
      tenantId: input.tenant.id,
      timestamp,
      payload: input.payload
    })
  );

  const signatureBuffer = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expectedSignature);
  if (
    signatureBuffer.length !== expectedBuffer.length ||
    !timingSafeEqual(signatureBuffer, expectedBuffer)
  ) {
    throw new ProviderWebhookAuthError("invalid provider webhook signature");
  }
}
