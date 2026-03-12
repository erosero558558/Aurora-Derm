import assert from "node:assert/strict";
import test from "node:test";
import {
  PostgresPlatformRepository,
  createBootstrapState,
  createPgMemSqlExecutor,
  createPlatformRepository,
  loadBootstrapState
} from "../src/state.js";

test("createPlatformRepository defaults to the postgres-backed adapter", () => {
  const repository = createPlatformRepository({ seedState: createBootstrapState() });

  assert.ok(repository instanceof PostgresPlatformRepository);
  assert.equal(repository.listPatientCaseSnapshots("tnt_green").length, 2);
});

test("postgres repository persists canonical patient-case mutations across reloads", () => {
  const executor = createPgMemSqlExecutor(createBootstrapState());
  const repository = new PostgresPlatformRepository(executor);

  const confirmed = repository.confirmAppointment(
    "tnt_green",
    "appt_green_001",
    "patient",
    "pat_green_001"
  );
  const approval = repository.resolveApproval("tnt_green", "case_green_001", "approval_green_001", {
    decision: "approved",
    actorId: "staff_green_front",
    notes: "Validated in SQL-backed repo."
  });
  const review = repository.recordCopilotReviewDecision("tnt_green", "case_green_001", {
    recommendationAction: "request_payment_followup",
    decision: "approve",
    actor: "staff_green_front",
    note: "Proceed",
    preparedActionId: "prepared_001"
  });

  assert.equal(confirmed.status, "confirmed");
  assert.equal(approval.status, "approved");
  assert.equal(review.decision, "approve");

  const reloaded = new PostgresPlatformRepository(executor);
  const firstSnapshot = reloaded.getPatientCaseSnapshot("tnt_green", "case_green_001");
  assert.equal(reloaded.getAppointment("tnt_green", "appt_green_001")?.status, "confirmed");
  assert.equal(
    firstSnapshot?.approvals.find((item) => item.id === "approval_green_001")?.status,
    "approved"
  );
  assert.ok(firstSnapshot?.copilotReviewDecisions.some((item) => item.id === review.id));

  reloaded.updateCaseStatus("tnt_green", "case_green_002", "closed", "staff_green_front");
  const callback = reloaded.createCallback("tnt_green", {
    patientId: "pat_green_002",
    notes: "Follow up after closure.",
    channel: "whatsapp"
  });

  const persistedState = loadBootstrapState(executor);
  const reopened = new PostgresPlatformRepository(executor);
  const reopenedSnapshot = reopened.getPatientCaseSnapshot("tnt_green", callback.patientCaseId);

  assert.notEqual(callback.patientCaseId, "case_green_002");
  assert.equal(
    persistedState.patientCases.filter(
      (item) => item.tenantId === "tnt_green" && item.patientId === "pat_green_002"
    ).length,
    2
  );
  assert.equal(reopenedSnapshot?.case.id, callback.patientCaseId);
  assert.equal(reopenedSnapshot?.case.status, "qualified");
  assert.equal(
    reopened
      .listPatientCases("tnt_green")
      .filter((item) => item.patientId === "pat_green_002" && item.status !== "closed").length,
    1
  );
});

test("postgres repository persists task and action status transitions used by copilot execution", () => {
  const executor = createPgMemSqlExecutor(createBootstrapState());
  const repository = new PostgresPlatformRepository(executor);

  const task = repository.createAgentTask(
    "tnt_river",
    "case_river_001",
    "ops_next_best_action",
    {
      recommendedAction: "call_next_patient",
      intent: "unknown",
      summary: "Call the patient from queue.",
      whyNow: "Queue is waiting.",
      riskIfIgnored: "Waiting time increases.",
      confidence: 0.9,
      blockedBy: [],
      requiresHumanApproval: false,
      degraded: true,
      providerName: "test",
      evidenceRefs: []
    }
  );
  const action = repository.createCaseAction("tnt_green", "case_green_002", {
    action: "send_follow_up",
    title: "Follow up",
    rationale: "Close the loop with the patient."
  });

  repository.updateAgentTaskStatus("tnt_river", task.id, "completed", "staff_river_manager");
  repository.updateCaseActionStatus(
    "tnt_green",
    "case_green_002",
    action.id,
    "completed",
    "staff_green_front"
  );

  const reloaded = new PostgresPlatformRepository(executor);
  const riverTask = reloaded.listAgentTasks("tnt_river").find((item) => item.id === task.id);
  const greenSnapshot = reloaded.getPatientCaseSnapshot("tnt_green", "case_green_002");
  const greenAction = greenSnapshot?.actions.find((item) => item.id === action.id);

  assert.equal(riverTask?.status, "completed");
  assert.equal(greenAction?.status, "completed");
  assert.ok(greenAction?.completedAt);
});

test("postgres repository persists prepared action dispatch history across reloads", () => {
  const executor = createPgMemSqlExecutor(createBootstrapState());
  const repository = new PostgresPlatformRepository(executor);

  const preparedAction = repository.savePreparedAction(
    "tnt_green",
    "case_green_001",
    {
      id: "prepared_green_001",
      patientCaseId: "case_green_001",
      type: "payment",
      recommendedAction: "request_payment_followup",
      title: "Request payment follow-up",
      payloadDraft: {
        approvalId: "approval_green_001"
      },
      messageDraft: "Please send the transfer proof so we can unlock your visit.",
      destinationSystem: "openclaw.ops",
      preconditions: ["approval_pending"],
      requiresHumanApproval: true,
      generatedAt: "2026-03-11T14:00:00.000Z"
    },
    "2026-03-11T13:00:00.000Z",
    "fingerprint-payment-follow-up"
  );

  const dispatchJob = repository.createPreparedActionDispatchJob(
    "tnt_green",
    "case_green_001",
    preparedAction.id,
    {
      trigger: "approve",
      actorId: "staff_green_front"
    }
  );
  repository.updatePreparedActionDispatchJob("tnt_green", dispatchJob.id, {
    status: "running",
    actorId: "staff_green_front"
  });
  repository.updatePreparedActionDispatchJob("tnt_green", dispatchJob.id, {
    status: "succeeded",
    actorId: "staff_green_front",
    execution: {
      executed: true,
      recommendationAction: "request_payment_followup",
      destinationSystem: "patient_messaging",
      adapterKey: "patient_messaging_adapter",
      dedupeKey: `patient_messaging:${preparedAction.id}`,
      deduped: false,
      messageUsed: "Please send the transfer proof so we can unlock your visit.",
      applied: [],
      receipts: [
        {
          system: "patient_messaging",
          operation: "request_payment_followup",
          status: "accepted",
          idempotencyKey: `patient_messaging:${preparedAction.id}:request_payment_followup`,
          externalRef: "msg_green_001",
          recordedAt: "2026-03-11T14:02:00.000Z",
          metadata: {
            channel: "whatsapp"
          }
        }
      ],
      executedAt: "2026-03-11T14:02:00.000Z"
    }
  });

  const reloaded = new PostgresPlatformRepository(executor);
  const snapshot = reloaded.getPatientCaseSnapshot("tnt_green", "case_green_001");
  const persistedDispatch = reloaded.listPreparedActionDispatchJobs(
    "tnt_green",
    "case_green_001",
    preparedAction.id
  )[0];
  const persistedReceipts = reloaded.listCopilotExecutionReceipts("tnt_green", "case_green_001", {
    preparedActionId: preparedAction.id
  });
  const webhook = reloaded.recordCopilotExecutionReceiptEvent("tnt_green", {
    system: "patient_messaging",
    eventType: "delivered",
    idempotencyKey: persistedReceipts[0]?.receipt.idempotencyKey,
    externalRef: persistedReceipts[0]?.receipt.externalRef,
    payload: {
      provider: "stub_messaging"
    }
  });
  const reopened = new PostgresPlatformRepository(executor);
  const reopenedSnapshot = reopened.getPatientCaseSnapshot("tnt_green", "case_green_001");
  const reopenedReceipts = reopened.listCopilotExecutionReceipts("tnt_green", "case_green_001", {
    preparedActionId: preparedAction.id
  });
  const reopenedEvents = reopened.listCopilotExecutionReceiptEvents("tnt_green", "case_green_001", {
    preparedActionId: preparedAction.id
  });

  assert.equal(persistedDispatch?.status, "succeeded");
  assert.equal(persistedDispatch?.attempt, 1);
  assert.equal(persistedDispatch?.execution?.recommendationAction, "request_payment_followup");
  assert.ok(snapshot?.preparedActionDispatchJobs.some((item) => item.id === dispatchJob.id));
  assert.equal(snapshot?.copilotExecutionReceipts.length, 1);
  assert.equal(snapshot?.copilotExecutionReceipts[0]?.receipt.system, "patient_messaging");
  assert.equal(persistedReceipts.length, 1);
  assert.equal(persistedReceipts[0]?.dispatchJobId, dispatchJob.id);
  assert.equal(persistedReceipts[0]?.receipt.externalRef, "msg_green_001");
  assert.equal(webhook.receipt.providerStatus, "delivered");
  assert.equal(reopenedSnapshot?.copilotExecutionReceiptEvents.length, 1);
  assert.equal(reopenedReceipts[0]?.providerStatus, "delivered");
  assert.equal(reopenedEvents[0]?.eventType, "delivered");
  assert.ok(snapshot?.links.some((item) => item.entityType === "prepared_action_dispatch"));
});
