import type {
  TenantConfig,
  TenantProviderBinding,
  TenantProviderDispatchHealthState,
  TenantProviderRuntimeBinding,
  TenantProviderSecretSource
} from "../../../packages/core/src/index.js";

interface ProviderSystemDefaults {
  label: string;
  dispatchMode: TenantProviderBinding["dispatchMode"];
  webhookAuthMode: TenantProviderBinding["webhookAuthMode"];
  credentialHints: readonly string[];
}

export interface TenantProviderRuntimeSummary {
  overallState: TenantProviderDispatchHealthState;
  readyCount: number;
  degradedCount: number;
  blockedCount: number;
}

const providerSystemDefaults: Record<string, ProviderSystemDefaults> = {
  patient_messaging: {
    label: "Patient Messaging",
    dispatchMode: "relay",
    webhookAuthMode: "hmac_sha256",
    credentialHints: ["whatsapp", "sms", "email", "messaging"]
  },
  queue_console: {
    label: "Queue Console",
    dispatchMode: "relay",
    webhookAuthMode: "hmac_sha256",
    credentialHints: ["queue", "frontdesk", "ops"]
  },
  scheduling_workbench: {
    label: "Scheduling Workbench",
    dispatchMode: "relay",
    webhookAuthMode: "hmac_sha256",
    credentialHints: ["schedule", "calendar", "booking"]
  },
  payments_review_queue: {
    label: "Payments Review Queue",
    dispatchMode: "relay",
    webhookAuthMode: "hmac_sha256",
    credentialHints: ["payment", "billing", "stripe"]
  },
  ops_followup_queue: {
    label: "Ops Follow-up Queue",
    dispatchMode: "stub",
    webhookAuthMode: "hmac_sha256",
    credentialHints: ["follow", "ops", "email", "whatsapp"]
  },
  ops_handoff_queue: {
    label: "Ops Handoff Queue",
    dispatchMode: "stub",
    webhookAuthMode: "hmac_sha256",
    credentialHints: ["handoff", "ops"]
  }
};

function normalizeEnvKey(value: string): string {
  return value.replace(/[^a-zA-Z0-9]+/g, "_").replace(/^_+|_+$/g, "").toUpperCase();
}

function trimEnv(value: string | undefined): string | null {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
}

function defaultProviderKey(system: string): string {
  return `local_${system}`;
}

function defaultProviderLabel(system: string): string {
  return providerSystemDefaults[system]?.label ?? system.replace(/[_-]+/g, " ");
}

function escalateHealthState(
  current: TenantProviderDispatchHealthState,
  next: TenantProviderDispatchHealthState
): TenantProviderDispatchHealthState {
  if (current === "blocked" || next === "ready") {
    return current;
  }
  if (next === "blocked") {
    return "blocked";
  }
  if (current === "ready" && next === "degraded") {
    return "degraded";
  }
  return current;
}

function pickCredentialRef(tenant: TenantConfig, system: string): string | null {
  const refs = tenant.credentialRefs;
  if (refs.length === 0) {
    return null;
  }

  const hints = providerSystemDefaults[system]?.credentialHints ?? [];
  const match = refs.find((entry) => hints.some((hint) => entry.toLowerCase().includes(hint)));
  return match ?? refs[0] ?? null;
}

function buildFallbackBinding(tenant: TenantConfig, system: string): TenantProviderBinding {
  const credentialRef = pickCredentialRef(tenant, system);
  const defaults = providerSystemDefaults[system];

  return {
    system,
    providerKey: defaultProviderKey(system),
    label: defaultProviderLabel(system),
    credentialRef,
    dispatchMode: defaults?.dispatchMode ?? "stub",
    senderProfile: credentialRef,
    webhookAuthMode: defaults?.webhookAuthMode ?? "hmac_sha256",
    webhookSecretRef: null,
    webhookSecretEnvVar: null,
    webhookPath: "/v1/copilot/receipts/webhook",
    endpointBaseUrl: null,
    status: "active"
  };
}

function resolveSecretRefEnvName(secretRef: string): string {
  return `PATIENT_FLOW_SECRET_${normalizeEnvKey(secretRef)}`;
}

function resolveTenantSystemWebhookEnvName(tenant: TenantConfig, system: string): string {
  return `PATIENT_FLOW_WEBHOOK_SECRET_${normalizeEnvKey(tenant.slug)}_${normalizeEnvKey(system)}`;
}

export function resolveTenantProviderBinding(
  tenant: TenantConfig,
  system: string
): { binding: TenantProviderBinding; usesFallbackBinding: boolean } {
  const explicitBinding = tenant.providerBindings.find((candidate) => candidate.system === system);
  if (explicitBinding) {
    return {
      binding: explicitBinding,
      usesFallbackBinding: false
    };
  }

  return {
    binding: buildFallbackBinding(tenant, system),
    usesFallbackBinding: true
  };
}

export function listTenantProviderBindings(
  tenant: TenantConfig
): Array<{ binding: TenantProviderBinding; usesFallbackBinding: boolean }> {
  const systems = new Set<string>([
    ...Object.keys(providerSystemDefaults),
    ...tenant.providerBindings.map((binding) => binding.system)
  ]);

  return [...systems]
    .sort((left, right) => left.localeCompare(right))
    .map((system) => resolveTenantProviderBinding(tenant, system));
}

export function resolveTenantProviderRuntimeBinding(
  tenant: TenantConfig,
  system: string
): TenantProviderRuntimeBinding {
  const { binding, usesFallbackBinding } = resolveTenantProviderBinding(tenant, system);
  const tenantSystemOverride = trimEnv(process.env[resolveTenantSystemWebhookEnvName(tenant, system)]);
  const bindingEnvOverride = trimEnv(
    binding.webhookSecretEnvVar ? process.env[binding.webhookSecretEnvVar] : undefined
  );
  const secretRefOverride = trimEnv(
    binding.webhookSecretRef ? process.env[resolveSecretRefEnvName(binding.webhookSecretRef)] : undefined
  );

  let resolvedSecretSource: TenantProviderSecretSource = "derived_local_fallback";
  if (binding.webhookAuthMode === "none") {
    resolvedSecretSource = "disabled";
  } else if (tenantSystemOverride) {
    resolvedSecretSource = "tenant_system_env";
  } else if (bindingEnvOverride) {
    resolvedSecretSource = "binding_env_var";
  } else if (secretRefOverride) {
    resolvedSecretSource = "binding_secret_ref";
  }

  let dispatchHealthState: TenantProviderDispatchHealthState = "ready";
  const dispatchIssues: string[] = [];

  if (binding.status !== "active") {
    dispatchHealthState = "blocked";
    dispatchIssues.push("binding_disabled");
  }

  if (binding.dispatchMode === "stub") {
    dispatchHealthState = escalateHealthState(dispatchHealthState, "degraded");
    dispatchIssues.push("stub_dispatch_mode");
  }

  if (binding.dispatchMode === "relay" && (!binding.endpointBaseUrl || binding.endpointBaseUrl.trim().length === 0)) {
    dispatchHealthState = "blocked";
    dispatchIssues.push("missing_endpoint_base_url");
  }

  if (binding.dispatchMode === "relay" && binding.endpointBaseUrl?.includes("providers.local")) {
    dispatchHealthState = escalateHealthState(dispatchHealthState, "degraded");
    dispatchIssues.push("placeholder_endpoint_base_url");
  }

  if (binding.dispatchMode === "relay" && binding.webhookAuthMode === "none") {
    dispatchHealthState = "blocked";
    dispatchIssues.push("webhook_auth_disabled");
  }

  if (binding.dispatchMode === "relay" && binding.system === "patient_messaging" && !binding.credentialRef) {
    dispatchHealthState = "blocked";
    dispatchIssues.push("missing_credential_ref");
  }

  if (usesFallbackBinding) {
    dispatchHealthState = escalateHealthState(dispatchHealthState, "degraded");
    dispatchIssues.push("using_fallback_binding");
  }

  if (resolvedSecretSource === "derived_local_fallback") {
    dispatchHealthState = escalateHealthState(dispatchHealthState, "degraded");
    dispatchIssues.push("using_fallback_secret");
  }

  return {
    ...binding,
    usesFallbackBinding,
    usesFallbackSecret: resolvedSecretSource === "derived_local_fallback",
    resolvedSecretSource,
    isWebhookEnabled: binding.webhookAuthMode !== "none",
    dispatchHealthState,
    dispatchIssues,
    dispatchReady: dispatchHealthState !== "blocked"
  };
}

export function listTenantProviderRuntimeBindings(tenant: TenantConfig): TenantProviderRuntimeBinding[] {
  return listTenantProviderBindings(tenant).map(({ binding }) =>
    resolveTenantProviderRuntimeBinding(tenant, binding.system)
  );
}

export function resolveTenantWebhookSigningSecret(
  tenant: TenantConfig,
  system: string
): { binding: TenantProviderRuntimeBinding; secret: string | null } {
  const binding = resolveTenantProviderRuntimeBinding(tenant, system);
  if (!binding.isWebhookEnabled) {
    return {
      binding,
      secret: null
    };
  }

  const tenantSystemOverride = trimEnv(process.env[resolveTenantSystemWebhookEnvName(tenant, system)]);
  if (tenantSystemOverride) {
    return {
      binding,
      secret: tenantSystemOverride
    };
  }

  const bindingEnvOverride = trimEnv(
    binding.webhookSecretEnvVar ? process.env[binding.webhookSecretEnvVar] : undefined
  );
  if (bindingEnvOverride) {
    return {
      binding,
      secret: bindingEnvOverride
    };
  }

  const secretRefOverride = trimEnv(
    binding.webhookSecretRef ? process.env[resolveSecretRefEnvName(binding.webhookSecretRef)] : undefined
  );
  if (secretRefOverride) {
    return {
      binding,
      secret: secretRefOverride
    };
  }

  return {
    binding,
    secret: `pfos-local:${tenant.id}:${system}:${binding.providerKey}:${binding.credentialRef ?? "no-credential"}:${tenant.createdAt}`
  };
}

export function buildProviderReceiptMetadata(
  tenant: TenantConfig,
  system: string
): Record<string, unknown> {
  const binding = resolveTenantProviderRuntimeBinding(tenant, system);
  return {
    providerKey: binding.providerKey,
    providerLabel: binding.label,
    providerCredentialRef: binding.credentialRef,
    providerDispatchMode: binding.dispatchMode,
    providerSenderProfile: binding.senderProfile,
    providerWebhookAuthMode: binding.webhookAuthMode,
    providerWebhookPath: binding.webhookPath,
    providerEndpointBaseUrl: binding.endpointBaseUrl,
    providerBindingStatus: binding.status,
    providerUsesFallbackBinding: binding.usesFallbackBinding,
    providerUsesFallbackSecret: binding.usesFallbackSecret,
    providerSecretSource: binding.resolvedSecretSource,
    providerDispatchHealthState: binding.dispatchHealthState,
    providerDispatchIssues: binding.dispatchIssues,
    providerDispatchReady: binding.dispatchReady
  };
}

export function summarizeTenantProviderRuntimeBindings(
  bindings: readonly TenantProviderRuntimeBinding[]
): TenantProviderRuntimeSummary {
  const summary = {
    overallState: "ready" as TenantProviderDispatchHealthState,
    readyCount: 0,
    degradedCount: 0,
    blockedCount: 0
  };

  for (const binding of bindings) {
    if (binding.dispatchHealthState === "blocked") {
      summary.blockedCount += 1;
    } else if (binding.dispatchHealthState === "degraded") {
      summary.degradedCount += 1;
    } else {
      summary.readyCount += 1;
    }
    summary.overallState = escalateHealthState(summary.overallState, binding.dispatchHealthState);
  }

  return summary;
}
