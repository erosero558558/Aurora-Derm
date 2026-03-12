import assert from "node:assert/strict";
import test from "node:test";
import { newDb } from "pg-mem";
import { createApp } from "../src/app.js";
import {
  createMirroredPostgresRepository,
  loadBootstrapStateFromPostgres,
} from "../src/postgres-runtime.js";
import { createBootstrapState } from "../src/state.js";

function createPgPool() {
  const db = newDb();
  const { Pool } = db.adapters.createPg();
  return new Pool();
}

test("mirrored postgres repository seeds an empty database and flushes canonical mutations", async () => {
  const pool = createPgPool();
  const repository = await createMirroredPostgresRepository({
    pool,
    seedState: createBootstrapState()
  });

  assert.equal(repository.listTenants().length, 2);
  repository.confirmAppointment("tnt_green", "appt_green_001", "patient", "pat_green_001");
  repository.recordCopilotReviewDecision("tnt_green", "case_green_001", {
    recommendationAction: "request_payment_followup",
    decision: "approve",
    actor: "staff_green_front",
    note: "Persist to postgres mirror",
    preparedActionId: "prepared_mirror_001"
  });
  const preparedAction = repository.savePreparedAction(
    "tnt_river",
    "case_river_001",
    {
      id: "prepared_mirror_001",
      patientCaseId: "case_river_001",
      type: "queue",
      recommendedAction: "call_next_patient",
      title: "Call next patient",
      payloadDraft: { ticketId: "ticket_river_001" },
      messageDraft: null,
      destinationSystem: "queue_runtime",
      preconditions: ["Queue ticket must still be waiting."],
      requiresHumanApproval: true,
      generatedAt: "2026-03-11T15:00:00.000Z"
    },
    "2026-03-11T13:20:00.000Z",
    "fingerprint_dispatch_mirror"
  );
  const dispatchJob = repository.createPreparedActionDispatchJob(
    "tnt_river",
    "case_river_001",
    preparedAction.id,
    {
      trigger: "approve",
      actorId: "staff_river_manager"
    }
  );
  repository.claimPreparedActionDispatchJobs({
    tenantId: "tnt_river",
    workerId: "worker_pg",
    limit: 1
  });
  repository.updatePreparedActionDispatchJob("tnt_river", dispatchJob.id, {
    status: "failed",
    actorId: "worker_pg",
    lastError: "simulated_pg_failure",
    leaseOwner: null,
    leaseExpiresAt: null
  });

  await repository.flush();
  const persistedState = await loadBootstrapStateFromPostgres(pool);

  assert.equal(
    persistedState.appointments.find((appointment) => appointment.id === "appt_green_001")?.status,
    "confirmed"
  );
  assert.ok(
    persistedState.copilotReviewDecisions.some(
      (decision) => decision.patientCaseId === "case_green_001" && decision.decision === "approve"
    )
  );
  const persistedDispatch = persistedState.preparedActionDispatchJobs.find(
    (candidate) => candidate.id === dispatchJob.id
  );
  assert.ok(persistedDispatch);
  assert.equal(persistedDispatch?.status, "failed");
  assert.equal(persistedDispatch?.lastError, "simulated_pg_failure");
  assert.equal(persistedDispatch?.leaseOwner, null);
  assert.ok(typeof persistedDispatch?.availableAt === "string");

  await repository.close();
});

test("health exposes postgres persistence when the app runs on mirrored postgres storage", async () => {
  const pool = createPgPool();
  const repository = await createMirroredPostgresRepository({
    pool,
    seedState: createBootstrapState()
  });
  const app = await createApp({ repository });

  try {
    const response = await app.inject({
      method: "GET",
      url: "/health"
    });

    assert.equal(response.statusCode, 200);
    const payload = JSON.parse(response.body) as {
      persistence: string;
      persistenceError: string | null;
      tenants: number;
    };
    assert.equal(payload.persistence, "postgres");
    assert.equal(payload.persistenceError, null);
    assert.equal(payload.tenants, 2);
  } finally {
    await app.close();
  }
});
