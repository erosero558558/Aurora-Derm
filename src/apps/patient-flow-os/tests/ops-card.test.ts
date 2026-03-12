import assert from "node:assert/strict";
import test from "node:test";

import { buildOpsCopilotCaseCard } from "../apps/ops-console/src/index.js";
import { AgentRuntime } from "../packages/agent-runtime/src/index.js";
import { createBootstrapState, InMemoryPlatformRepository } from "../apps/api/src/state.js";

test("la case card expone los cuatro review options canonicos en orden", async () => {
  const repository = new InMemoryPlatformRepository(createBootstrapState());
  const tenant = repository.getTenantById("tnt_green");
  const snapshot = repository.getPatientCaseSnapshot("tnt_green", "case_green_001");
  assert.ok(tenant);
  assert.ok(snapshot);

  const runtime = new AgentRuntime({
    name: "test_provider",
    async decide() {
      return {
        recommendedAction: "request_payment_followup",
        intent: "unknown",
        summary: "Payment needs follow-up.",
        whyNow: "A payment approval is still pending.",
        riskIfIgnored: "The case remains blocked.",
        confidence: 0.9,
        blockedBy: ["approval:approval_green_001"],
        requiresHumanApproval: true,
        degraded: false,
        providerName: "test_provider",
        evidenceRefs: [
          { kind: "approval", entityId: "approval_green_001", label: "approval:payment_review:pending" }
        ]
      };
    }
  });

  const recommendation = await runtime.decide({
    mode: "ops",
    tenant,
    input: "next",
    patientCase: snapshot
  });
  const preparedAction = await runtime.prepare({
    mode: "ops",
    tenant,
    input: "next",
    patientCase: snapshot
  }, recommendation);
  const card = buildOpsCopilotCaseCard(snapshot, recommendation, preparedAction);

  assert.deepEqual(
    card.reviewOptions.map((option) => option.id),
    ["approve", "edit_and_run", "reject", "snooze"]
  );
  assert.equal(card.blocks.humanApproval.body.includes("requiere revisión humana"), true);
});
