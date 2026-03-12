import assert from "node:assert/strict";
import test from "node:test";

import {
  AgentRuntime,
  FailingProvider,
  HeuristicFallbackProvider
} from "../packages/agent-runtime/src/index.js";
import { createBootstrapState, InMemoryPlatformRepository } from "../apps/api/src/state.js";
import type { CopilotRecommendation } from "../packages/core/src/index.js";

test("queue activa recomienda call_next_patient y prepara paquete de cola", async () => {
  const repository = new InMemoryPlatformRepository(createBootstrapState());
  const tenant = repository.getTenantById("tnt_river");
  const snapshot = repository.getPatientCaseSnapshot("tnt_river", "case_river_001");
  assert.ok(tenant);
  assert.ok(snapshot);

  const runtime = new AgentRuntime(new HeuristicFallbackProvider());
  const result = await runtime.run({
    mode: "ops",
    tenant,
    input: "what should ops do next?",
    patientCase: snapshot
  });

  assert.equal(result.recommendation.recommendedAction, "call_next_patient");
  assert.equal(result.preparedAction.type, "queue");
  assert.equal(result.preparedAction.destinationSystem, "queue_console");
});

test("approval pendiente no financiera recomienda review_approval", async () => {
  const state = createBootstrapState();
  state.patientCaseApprovals[0] = {
    ...state.patientCaseApprovals[0],
    type: "clinical_review"
  };
  const repository = new InMemoryPlatformRepository(state);
  const tenant = repository.getTenantById("tnt_green");
  const snapshot = repository.getPatientCaseSnapshot("tnt_green", "case_green_001");
  assert.ok(tenant);
  assert.ok(snapshot);

  const runtime = new AgentRuntime(new HeuristicFallbackProvider());
  const result = await runtime.run({
    mode: "ops",
    tenant,
    input: "what is blocked?",
    patientCase: snapshot
  });

  assert.equal(result.recommendation.recommendedAction, "review_approval");
  assert.equal(result.recommendation.requiresHumanApproval, true);
  assert.equal(result.preparedAction.type, "handoff");
});

test("pago bloqueando avance recomienda request_payment_followup", async () => {
  const repository = new InMemoryPlatformRepository(createBootstrapState());
  const tenant = repository.getTenantById("tnt_green");
  const snapshot = repository.getPatientCaseSnapshot("tnt_green", "case_green_001");
  assert.ok(tenant);
  assert.ok(snapshot);

  const runtime = new AgentRuntime(new HeuristicFallbackProvider());
  const result = await runtime.run({
    mode: "ops",
    tenant,
    input: "what should ops do next?",
    patientCase: snapshot
  });

  assert.equal(result.recommendation.recommendedAction, "request_payment_followup");
  assert.equal(result.preparedAction.type, "payment");
});

test("solicitud de reprogramacion recomienda propose_reschedule", async () => {
  const state = createBootstrapState();
  state.patientCaseApprovals = [];
  const repository = new InMemoryPlatformRepository(state);
  repository.requestReschedule("tnt_green", "appt_green_001", "patient", "pat_green_001");
  const tenant = repository.getTenantById("tnt_green");
  const snapshot = repository.getPatientCaseSnapshot("tnt_green", "case_green_001");
  assert.ok(tenant);
  assert.ok(snapshot);

  const runtime = new AgentRuntime(new HeuristicFallbackProvider());
  const result = await runtime.run({
    mode: "ops",
    tenant,
    input: "reschedule requested",
    patientCase: snapshot
  });

  assert.equal(result.recommendation.recommendedAction, "propose_reschedule");
  assert.equal(result.preparedAction.type, "schedule");
});

test("no-show recomienda recover_no_show", async () => {
  const repository = new InMemoryPlatformRepository(createBootstrapState());
  const tenant = repository.getTenantById("tnt_green");
  const snapshot = repository.getPatientCaseSnapshot("tnt_green", "case_green_002");
  assert.ok(tenant);
  assert.ok(snapshot);

  const runtime = new AgentRuntime(new HeuristicFallbackProvider());
  const result = await runtime.run({
    mode: "ops",
    tenant,
    input: "what should ops do next?",
    patientCase: snapshot
  });

  assert.equal(result.recommendation.recommendedAction, "recover_no_show");
  assert.equal(result.preparedAction.type, "follow_up");
});

test("falla del provider cae al fallback sin romper el schema", async () => {
  const repository = new InMemoryPlatformRepository(createBootstrapState());
  const tenant = repository.getTenantById("tnt_river");
  const snapshot = repository.getPatientCaseSnapshot("tnt_river", "case_river_001");
  assert.ok(tenant);
  assert.ok(snapshot);

  const runtime = new AgentRuntime(new FailingProvider(), new HeuristicFallbackProvider());
  const recommendation = await runtime.decide({
    mode: "ops",
    tenant,
    input: "next best action",
    patientCase: snapshot
  });

  assert.equal(recommendation.degraded, true);
  assert.equal(recommendation.recommendedAction, "call_next_patient");
  assert.ok(recommendation.evidenceRefs.length > 0);
});

test("en modo patient una accion insegura se convierte en handoff", async () => {
  const repository = new InMemoryPlatformRepository(createBootstrapState());
  const tenant = repository.getTenantById("tnt_green");
  const snapshot = repository.getPatientCaseSnapshot("tnt_green", "case_green_001");
  assert.ok(tenant);
  assert.ok(snapshot);

  const unsafeProvider = {
    name: "unsafe_provider",
    async decide(): Promise<CopilotRecommendation> {
      return {
        recommendedAction: "mass_reschedule",
        intent: "unknown",
        summary: "Mass reschedule the day.",
        whyNow: "Synthetic unsafe recommendation.",
        riskIfIgnored: "Synthetic risk.",
        confidence: 0.75,
        blockedBy: [],
        requiresHumanApproval: true,
        degraded: false,
        providerName: "unsafe_provider",
        evidenceRefs: []
      };
    }
  };

  const runtime = new AgentRuntime(unsafeProvider);
  const recommendation = await runtime.decide({
    mode: "patient",
    tenant,
    input: "please move everything",
    patientCase: snapshot
  });

  assert.equal(recommendation.recommendedAction, "handoff_to_staff");
  assert.equal(recommendation.requiresHumanApproval, true);
});
