import type { TenantConfig, TenantProviderRuntimeBinding } from "../../../packages/core/src/index.js";
import { resolveTenantProviderRuntimeBinding } from "./provider-registry.js";
import { PermanentDispatchError } from "./provider-runtime.js";

export interface ProviderDispatchEnvelopeInput {
  tenant: TenantConfig;
  system: string;
  operation: string;
  idempotencyKey: string;
  localExternalRef: string | null;
}

export interface ProviderDispatchEnvelope {
  binding: TenantProviderRuntimeBinding;
  externalRef: string | null;
  metadata: Record<string, unknown>;
}

function buildOperationRef(input: ProviderDispatchEnvelopeInput, binding: TenantProviderRuntimeBinding): string {
  const anchor = input.localExternalRef ?? input.idempotencyKey;
  return `${binding.providerKey}:${input.operation}:${anchor}`;
}

function buildBlockedDispatchMessage(binding: TenantProviderRuntimeBinding): string {
  const issues = binding.dispatchIssues.join(", ");
  return `provider binding ${binding.providerKey} is blocked for ${binding.system}: ${issues}`;
}

export function assertTenantProviderDispatchReady(
  tenant: TenantConfig,
  system: string
): TenantProviderRuntimeBinding {
  const binding = resolveTenantProviderRuntimeBinding(tenant, system);
  if (!binding.dispatchReady) {
    throw new PermanentDispatchError(buildBlockedDispatchMessage(binding));
  }
  return binding;
}

export function dispatchThroughTenantProviderClient(
  input: ProviderDispatchEnvelopeInput
): ProviderDispatchEnvelope {
  const binding = assertTenantProviderDispatchReady(input.tenant, input.system);

  const operationRef = buildOperationRef(input, binding);
  return {
    binding,
    externalRef: binding.dispatchMode === "relay" ? operationRef : input.localExternalRef,
    metadata: {
      providerDeliveryMode: binding.dispatchMode === "relay" ? "provider_relay" : "local_stub",
      providerOperationRef: operationRef,
      providerLocalExternalRef: input.localExternalRef,
      providerTransportEndpoint: binding.endpointBaseUrl
    }
  };
}
