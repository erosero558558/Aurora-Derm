import assert from "node:assert/strict";
import test from "node:test";
import { createApp } from "../src/app.js";
import { InMemoryPlatformRepository, createBootstrapState } from "../src/state.js";

function readJson(response: { body: string }) {
  return JSON.parse(response.body) as Record<string, unknown>;
}

async function createTestApp() {
  const repository = new InMemoryPlatformRepository(createBootstrapState());
  const app = await createApp({ repository });
  return { app, repository };
}

test("GET /v1/patient-cases lists case snapshots by tenant", async () => {
  const { app } = await createTestApp();

  try {
    const response = await app.inject({
      method: "GET",
      url: "/v1/patient-cases?tenantSlug=green-valley"
    });

    assert.equal(response.statusCode, 200);
    const payload = readJson(response) as {
      tenantId: string;
      items: Array<{ case: { tenantId: string } }>;
    };
    assert.equal(payload.tenantId, "tnt_green");
    assert.equal(payload.items.length, 2);
    assert.ok(payload.items.every((item) => item.case.tenantId === "tnt_green"));
  } finally {
    await app.close();
  }
});

test("GET /ops/:tenantSlug serves the api-driven ops console shell", async () => {
  const { app } = await createTestApp();

  try {
    const response = await app.inject({
      method: "GET",
      url: "/ops/green-valley"
    });

    assert.equal(response.statusCode, 200);
    assert.match(response.body, /data-copilot-ready="true"/);
    assert.match(response.body, /\/v1\/agent-tasks\/ops-next-best-action/);
    assert.match(response.body, /\/v1\/reports\/kpi\?tenantId=tnt_green/);
  } finally {
    await app.close();
  }
});

test("POST /v1/messages/patient-flow confirms the canonical case appointment", async () => {
  const { app } = await createTestApp();

  try {
    const response = await app.inject({
      method: "POST",
      url: "/v1/messages/patient-flow",
      payload: {
        tenantSlug: "green-valley",
        caseId: "case_green_001",
        actorId: "pat_green_001",
        message: "Please confirm my appointment"
      }
    });

    assert.equal(response.statusCode, 200);
    const payload = readJson(response) as {
      patientCaseId: string;
      recommendation: { recommendedAction: string };
      applied: { appointment: { status: string; patientCaseId: string } };
      snapshot: { case: { id: string } };
    };
    assert.equal(payload.patientCaseId, "case_green_001");
    assert.equal(payload.recommendation.recommendedAction, "confirm_appointment");
    assert.equal(payload.applied.appointment.status, "confirmed");
    assert.equal(payload.applied.appointment.patientCaseId, "case_green_001");
    assert.equal(payload.snapshot.case.id, "case_green_001");
  } finally {
    await app.close();
  }
});

test("ambiguous patient message creates handoff action and task on the same case", async () => {
  const { app } = await createTestApp();

  try {
    const response = await app.inject({
      method: "POST",
      url: "/v1/messages/patient-flow",
      payload: {
        tenantSlug: "green-valley",
        caseId: "case_green_001",
        actorId: "pat_green_001",
        message: "Cancel everything and change my doctor"
      }
    });

    assert.equal(response.statusCode, 200);
    const payload = readJson(response) as {
      recommendation: { recommendedAction: string; requiresHumanApproval: boolean };
      snapshot: {
        actions: Array<{ action: string }>;
        agentTasks: Array<{ type: string }>;
      };
    };
    assert.equal(payload.recommendation.recommendedAction, "handoff_to_staff");
    assert.equal(payload.recommendation.requiresHumanApproval, true);
    assert.ok(payload.snapshot.actions.some((action) => action.action === "handoff_to_staff"));
    assert.ok(payload.snapshot.agentTasks.some((task) => task.type === "handoff"));
  } finally {
    await app.close();
  }
});

test("closing a case and creating a callback opens a new active patient case", async () => {
  const { app } = await createTestApp();

  try {
    const closeResponse = await app.inject({
      method: "PATCH",
      url: "/v1/patient-cases/case_green_002/status",
      payload: {
        tenantSlug: "green-valley",
        actorId: "staff_green_front",
        status: "closed"
      }
    });

    assert.equal(closeResponse.statusCode, 200);

    const callbackResponse = await app.inject({
      method: "POST",
      url: "/v1/callbacks",
      payload: {
        tenantSlug: "green-valley",
        patientId: "pat_green_002",
        notes: "Need to call back after the missed visit.",
        channel: "whatsapp"
      }
    });

    assert.equal(callbackResponse.statusCode, 200);
    const payload = readJson(callbackResponse) as {
      patientCaseId: string;
      snapshot: { case: { id: string; status: string } };
    };
    assert.notEqual(payload.patientCaseId, "case_green_002");
    assert.equal(payload.snapshot.case.id, payload.patientCaseId);
    assert.equal(payload.snapshot.case.status, "qualified");
  } finally {
    await app.close();
  }
});

test("approval resolve and queue completion keep responses case-first", async () => {
  const { app } = await createTestApp();

  try {
    const approvalResponse = await app.inject({
      method: "POST",
      url: "/v1/patient-cases/case_green_001/approvals/approval_green_001/resolve",
      payload: {
        tenantSlug: "green-valley",
        actorId: "staff_green_front",
        decision: "approved",
        notes: "Transfer proof validated."
      }
    });

    assert.equal(approvalResponse.statusCode, 200);
    const approvalPayload = readJson(approvalResponse) as {
      item: { status: string };
      snapshot: { case: { summary: { pendingApprovalCount: number } } };
    };
    assert.equal(approvalPayload.item.status, "approved");
    assert.equal(approvalPayload.snapshot.case.summary.pendingApprovalCount, 0);

    const completeResponse = await app.inject({
      method: "POST",
      url: "/v1/queue/ticket_river_001/complete",
      payload: {
        tenantSlug: "river-point",
        actorId: "staff_river_manager"
      }
    });

    assert.equal(completeResponse.statusCode, 200);
    const completePayload = readJson(completeResponse) as {
      patientCaseId: string;
      item: { patientCaseId: string; status: string };
      snapshot: {
        case: { status: string };
        actions: Array<{ action: string; status: string }>;
      };
    };
    assert.equal(completePayload.patientCaseId, "case_river_001");
    assert.equal(completePayload.item.patientCaseId, "case_river_001");
    assert.equal(completePayload.item.status, "completed");
    assert.equal(completePayload.snapshot.case.status, "follow_up_pending");
    assert.ok(
      completePayload.snapshot.actions.some(
        (action) => action.action === "send_follow_up" && action.status === "pending"
      )
    );
  } finally {
    await app.close();
  }
});

test("support surfaces expose messages, audit and KPI through canonical routes", async () => {
  const { app } = await createTestApp();

  try {
    const messageResponse = await app.inject({
      method: "GET",
      url: "/v1/messages/threads?tenantSlug=green-valley&caseId=case_green_001"
    });
    assert.equal(messageResponse.statusCode, 200);
    const messagePayload = readJson(messageResponse) as {
      tenantId: string;
      items: Array<{ patientCaseId: string; messages: Array<{ role: string }> }>;
    };
    assert.equal(messagePayload.tenantId, "tnt_green");
    assert.equal(messagePayload.items.length, 1);
    assert.equal(messagePayload.items[0]?.patientCaseId, "case_green_001");
    assert.equal(messagePayload.items[0]?.messages[0]?.role, "patient");

    const auditResponse = await app.inject({
      method: "GET",
      url: "/v1/audit?tenantSlug=green-valley"
    });
    assert.equal(auditResponse.statusCode, 200);
    const auditPayload = readJson(auditResponse) as {
      tenantId: string;
      items: Array<{ action: string }>;
    };
    assert.equal(auditPayload.tenantId, "tnt_green");
    assert.ok(auditPayload.items.some((entry) => entry.action === "seeded_bootstrap_state"));

    const kpiResponse = await app.inject({
      method: "GET",
      url: "/v1/reports/kpi?tenantSlug=green-valley"
    });
    assert.equal(kpiResponse.statusCode, 200);
    const kpiPayload = readJson(kpiResponse) as {
      tenantId: string;
      activeCases: number;
      casesRequiringApproval: number;
    };
    assert.equal(kpiPayload.tenantId, "tnt_green");
    assert.equal(kpiPayload.activeCases, 2);
    assert.equal(kpiPayload.casesRequiringApproval, 1);
  } finally {
    await app.close();
  }
});

test("surface projection endpoints expose patient-flow, wait-room and dashboard views", async () => {
  const { app } = await createTestApp();

  try {
    const patientFlowResponse = await app.inject({
      method: "GET",
      url: "/v1/surfaces/patient-flow?tenantSlug=green-valley&caseId=case_green_001"
    });
    assert.equal(patientFlowResponse.statusCode, 200);
    const patientFlowPayload = readJson(patientFlowResponse) as {
      tenantId: string;
      caseId: string;
      item: {
        patientName: string;
        caseStatus: string;
        pendingApprovals: Array<{ type: string }>;
      };
    };
    assert.equal(patientFlowPayload.tenantId, "tnt_green");
    assert.equal(patientFlowPayload.caseId, "case_green_001");
    assert.equal(patientFlowPayload.item.patientName, "Eva Perez");
    assert.equal(patientFlowPayload.item.caseStatus, "exception");
    assert.ok(patientFlowPayload.item.pendingApprovals.some((approval) => approval.type === "payment_review"));

    const waitRoomResponse = await app.inject({
      method: "GET",
      url: "/v1/surfaces/wait-room?tenantSlug=river-point&locationSlug=river-main"
    });
    assert.equal(waitRoomResponse.statusCode, 200);
    const waitRoomPayload = readJson(waitRoomResponse) as {
      tenantId: string;
      locationId: string;
      item: {
        waitingRoomName: string;
        queueDepth: number;
        waiting: Array<{ ticketNumber: string }>;
      };
    };
    assert.equal(waitRoomPayload.tenantId, "tnt_river");
    assert.equal(waitRoomPayload.locationId, "loc_river_main");
    assert.equal(waitRoomPayload.item.waitingRoomName, "Lobby Principal");
    assert.equal(waitRoomPayload.item.queueDepth, 1);
    assert.ok(waitRoomPayload.item.waiting.some((item) => item.ticketNumber === "R-014"));

    const dashboardResponse = await app.inject({
      method: "GET",
      url: "/v1/surfaces/dashboard?tenantSlug=green-valley"
    });
    assert.equal(dashboardResponse.statusCode, 200);
    const dashboardPayload = readJson(dashboardResponse) as {
      tenantId: string;
      item: {
        kpi: { activeCases: number };
        recentCases: Array<{ caseId: string }>;
        attentionCases: Array<{ reason: string }>;
      };
    };
    assert.equal(dashboardPayload.tenantId, "tnt_green");
    assert.equal(dashboardPayload.item.kpi.activeCases, 2);
    assert.ok(dashboardPayload.item.recentCases.some((item) => item.caseId === "case_green_001"));
    assert.ok(dashboardPayload.item.attentionCases.some((item) => item.reason.length > 0));
  } finally {
    await app.close();
  }
});

test("POST /v1/agent-tasks/ops-next-best-action prioritizes the approval-blocked case and persists the task", async () => {
  const { app } = await createTestApp();

  try {
    const response = await app.inject({
      method: "POST",
      url: "/v1/agent-tasks/ops-next-best-action",
      payload: {
        tenantSlug: "green-valley"
      }
    });

    assert.equal(response.statusCode, 200);
    const payload = readJson(response) as {
      patientCaseId: string;
      recommendation: { recommendedAction: string };
      preparedAction: { type: string };
      task: { type: string; patientCaseId: string };
      snapshot: { agentTasks: Array<{ type: string }> };
    };
    assert.equal(payload.patientCaseId, "case_green_001");
    assert.equal(payload.recommendation.recommendedAction, "request_payment_followup");
    assert.equal(payload.preparedAction.type, "payment");
    assert.equal(payload.task.patientCaseId, "case_green_001");
    assert.equal(payload.task.type, "approval_follow_up");
    assert.ok(payload.snapshot.agentTasks.some((task) => task.type === "approval_follow_up"));
  } finally {
    await app.close();
  }
});

test("canonical reschedule-request route updates the case and audit trail", async () => {
  const { app } = await createTestApp();

  try {
    const rescheduleResponse = await app.inject({
      method: "POST",
      url: "/v1/appointments/appt_green_002/reschedule-request",
      payload: {
        tenantSlug: "green-valley",
        actorId: "staff_green_front"
      }
    });

    assert.equal(rescheduleResponse.statusCode, 200);
    const reschedulePayload = readJson(rescheduleResponse) as {
      patientCaseId: string;
      item: { status: string };
      snapshot: {
        case: { status: string };
        actions: Array<{ action: string }>;
        agentTasks: Array<{ type: string }>;
      };
    };
    assert.equal(reschedulePayload.patientCaseId, "case_green_002");
    assert.equal(reschedulePayload.item.status, "reschedule_requested");
    assert.equal(reschedulePayload.snapshot.case.status, "awaiting_booking");
    assert.ok(reschedulePayload.snapshot.actions.some((action) => action.action === "request_reschedule"));
    assert.ok(
      reschedulePayload.snapshot.agentTasks.some((task) => task.type === "reschedule_suggestion")
    );

    const auditResponse = await app.inject({
      method: "GET",
      url: "/v1/audit?tenantSlug=green-valley&caseId=case_green_002"
    });

    assert.equal(auditResponse.statusCode, 200);
    const auditPayload = readJson(auditResponse) as {
      items: Array<{ action: string }>;
    };
    assert.ok(
      auditPayload.items.some((entry) => entry.action === "appointment_reschedule_requested")
    );
  } finally {
    await app.close();
  }
});

test("copilot review endpoint queues the prepared action and the dispatch worker drains it", async () => {
  const { app } = await createTestApp();

  try {
    const response = await app.inject({
      method: "POST",
      url: "/v1/patient-cases/tnt_river/case_river_001/copilot/review",
      payload: {
        recommendationAction: "call_next_patient",
        decision: "approve",
        actor: "staff_river_manager",
        executeNow: true
      }
    });

    assert.equal(response.statusCode, 200);
    const payload = readJson(response) as {
      ok: boolean;
      data: {
        decision: string;
        execution: {
          recommendationAction: string;
          destinationSystem: string;
          adapterKey: string;
          dedupeKey: string;
          deduped: boolean;
          receipts: Array<{ system: string; operation: string; idempotencyKey: string }>;
          applied: Array<{ kind: string }>;
        } | null;
        dispatchJob?: { status: string; preparedActionId: string };
        snapshot: { queueTickets: Array<{ status: string }> };
      };
    };
    assert.equal(payload.ok, true);
    assert.equal(payload.data.decision, "approve");
    assert.equal(payload.data.execution, null);
    assert.equal(payload.data.dispatchJob?.status, "queued");
    assert.equal(payload.data.snapshot.queueTickets[0]?.status, "waiting");

    const drainResponse = await app.inject({
      method: "POST",
      url: "/v1/copilot/dispatch-worker/drain",
      payload: {
        tenantId: "tnt_river",
        workerId: "test_worker"
      }
    });
    assert.equal(drainResponse.statusCode, 200);
    const drainPayload = readJson(drainResponse) as {
      ok: boolean;
      data: {
        successCount: number;
        failureCount: number;
        items: Array<{
          dispatchJob: { status: string };
          execution: {
            recommendationAction: string;
            destinationSystem: string;
            adapterKey: string;
            dedupeKey: string;
            deduped: boolean;
            receipts: Array<{ system: string; operation: string; idempotencyKey: string }>;
            applied: Array<{ kind: string }>;
          } | null;
        }>;
      };
    };
    assert.equal(drainPayload.ok, true);
    assert.equal(drainPayload.data.successCount, 1);
    assert.equal(drainPayload.data.failureCount, 0);
    assert.equal(drainPayload.data.items[0]?.dispatchJob.status, "succeeded");
    assert.equal(drainPayload.data.items[0]?.execution?.recommendationAction, "call_next_patient");
    assert.equal(drainPayload.data.items[0]?.execution?.destinationSystem, "queue_console");
    assert.equal(drainPayload.data.items[0]?.execution?.adapterKey, "queue_console_adapter");
    assert.equal(
      drainPayload.data.items[0]?.execution?.dedupeKey,
      `queue_console:${payload.data.dispatchJob?.preparedActionId}`
    );
    assert.equal(drainPayload.data.items[0]?.execution?.deduped, false);
    assert.equal(drainPayload.data.items[0]?.execution?.receipts.length, 1);
    assert.equal(drainPayload.data.items[0]?.execution?.receipts[0]?.system, "queue_console");
    assert.equal(drainPayload.data.items[0]?.execution?.receipts[0]?.operation, "call_next_patient");
    assert.equal(
      drainPayload.data.items[0]?.execution?.receipts[0]?.idempotencyKey,
      `queue_console:${payload.data.dispatchJob?.preparedActionId}:call_next_patient`
    );
    assert.ok(drainPayload.data.items[0]?.execution?.applied.some((item) => item.kind === "queue_ticket"));

    const caseResponse = await app.inject({
      method: "GET",
      url: "/v1/patient-cases/case_river_001?tenantId=tnt_river"
    });
    assert.equal(caseResponse.statusCode, 200);
    const casePayload = readJson(caseResponse) as {
      item: { queueTickets: Array<{ status: string }> };
    };
    assert.equal(casePayload.item.queueTickets[0]?.status, "called");
  } finally {
    await app.close();
  }
});

test("prepared action history routes expose versions and dispatch attempts for a case", async () => {
  const { app } = await createTestApp();

  try {
    const inspectResponse = await app.inject({
      method: "GET",
      url: "/v1/patient-cases/tnt_green/case_green_001/copilot"
    });
    assert.equal(inspectResponse.statusCode, 200);
    const inspectPayload = readJson(inspectResponse) as {
      data: {
        recommendation: { recommendedAction: string };
        preparedAction: { id: string };
      };
    };
    const preparedActionId = inspectPayload.data.preparedAction.id;

    const reviewResponse = await app.inject({
      method: "POST",
      url: "/v1/patient-cases/tnt_green/case_green_001/copilot/review",
      payload: {
        recommendationAction: inspectPayload.data.recommendation.recommendedAction,
        decision: "approve",
        actor: "staff_green_front",
        preparedActionId,
        executeNow: true
      }
    });
    assert.equal(reviewResponse.statusCode, 200);

    const queuedDispatchResponse = await app.inject({
      method: "GET",
      url: `/v1/patient-cases/case_green_001/prepared-action-dispatches?tenantSlug=green-valley&preparedActionId=${encodeURIComponent(preparedActionId)}`
    });
    assert.equal(queuedDispatchResponse.statusCode, 200);
    const queuedDispatchPayload = readJson(queuedDispatchResponse) as {
      items: Array<{ status: string; attempt: number; preparedActionId: string }>;
    };
    assert.equal(queuedDispatchPayload.items.length, 1);
    assert.equal(queuedDispatchPayload.items[0]?.status, "queued");

    const drainResponse = await app.inject({
      method: "POST",
      url: "/v1/copilot/dispatch-worker/drain",
      payload: {
        tenantSlug: "green-valley",
        workerId: "test_worker"
      }
    });
    assert.equal(drainResponse.statusCode, 200);

    const preparedActionsResponse = await app.inject({
      method: "GET",
      url: "/v1/patient-cases/case_green_001/prepared-actions?tenantSlug=green-valley"
    });
    assert.equal(preparedActionsResponse.statusCode, 200);
    const preparedActionsPayload = readJson(preparedActionsResponse) as {
      items: Array<{ id: string; status: string; version: number }>;
    };
    assert.ok(preparedActionsPayload.items.some((item) => item.id === preparedActionId));
    assert.ok(preparedActionsPayload.items.some((item) => item.status === "executed"));

    const dispatchResponse = await app.inject({
      method: "GET",
      url: `/v1/patient-cases/case_green_001/prepared-action-dispatches?tenantSlug=green-valley&preparedActionId=${encodeURIComponent(preparedActionId)}`
    });
    assert.equal(dispatchResponse.statusCode, 200);
    const dispatchPayload = readJson(dispatchResponse) as {
      items: Array<{ status: string; attempt: number; preparedActionId: string }>;
    };
    assert.equal(dispatchPayload.items.length, 1);
    assert.equal(dispatchPayload.items[0]?.preparedActionId, preparedActionId);
    assert.equal(dispatchPayload.items[0]?.status, "succeeded");
    assert.equal(dispatchPayload.items[0]?.attempt, 1);

    const receiptsResponse = await app.inject({
      method: "GET",
      url: `/v1/patient-cases/case_green_001/copilot-receipts?tenantSlug=green-valley&preparedActionId=${encodeURIComponent(preparedActionId)}`
    });
    assert.equal(receiptsResponse.statusCode, 200);
    const receiptsPayload = readJson(receiptsResponse) as {
      items: Array<{
        dispatchJobId: string;
        attempt: number;
        receipt: { system: string; operation: string };
      }>;
    };
    assert.equal(receiptsPayload.items.length, 2);
    assert.equal(receiptsPayload.items[0]?.attempt, 1);
    assert.ok(receiptsPayload.items.every((item) => item.dispatchJobId.length > 0));
    assert.ok(receiptsPayload.items.some((item) => item.receipt.system === "patient_messaging"));
    assert.ok(
      receiptsPayload.items.some((item) => item.receipt.operation === "request_payment_followup")
    );
  } finally {
    await app.close();
  }
});

test("prepared action retry endpoint preserves failed attempts and succeeds on retry", async () => {
  const { app, repository } = await createTestApp();

  try {
    const inspectResponse = await app.inject({
      method: "GET",
      url: "/v1/patient-cases/tnt_green/case_green_001/copilot"
    });
    assert.equal(inspectResponse.statusCode, 200);
    const inspectPayload = readJson(inspectResponse) as {
      data: {
        recommendation: { recommendedAction: string };
        preparedAction: { id: string };
      };
    };
    const preparedActionId = inspectPayload.data.preparedAction.id;
    const originalAppendConversationMessage = repository.appendConversationMessage.bind(repository);
    Object.assign(repository, {
      appendConversationMessage: () => {
        throw new Error("simulated message gateway outage");
      }
    });

    const failedReviewResponse = await app.inject({
      method: "POST",
      url: "/v1/patient-cases/tnt_green/case_green_001/copilot/review",
      payload: {
        recommendationAction: inspectPayload.data.recommendation.recommendedAction,
        decision: "approve",
        actor: "staff_green_front",
        preparedActionId,
        executeNow: true
      }
    });
    assert.equal(failedReviewResponse.statusCode, 200);

    const failedDrainResponse = await app.inject({
      method: "POST",
      url: "/v1/copilot/dispatch-worker/drain",
      payload: {
        tenantId: "tnt_green",
        workerId: "test_worker"
      }
    });
    assert.equal(failedDrainResponse.statusCode, 200);
    const failedDrainPayload = readJson(failedDrainResponse) as {
      ok: boolean;
      data: {
        failureCount: number;
        items: Array<{ error: string | null; dispatchJob: { status: string } }>;
      };
    };
    assert.equal(failedDrainPayload.ok, true);
    assert.equal(failedDrainPayload.data.failureCount, 1);
    assert.match(failedDrainPayload.data.items[0]?.error ?? "", /simulated message gateway outage/);
    assert.equal(failedDrainPayload.data.items[0]?.dispatchJob.status, "failed");

    Object.assign(repository, {
      appendConversationMessage: originalAppendConversationMessage
    });

    const retryResponse = await app.inject({
      method: "POST",
      url: `/v1/patient-cases/tnt_green/case_green_001/prepared-actions/${encodeURIComponent(preparedActionId)}/retry`,
      payload: {
        actor: "staff_green_front"
      }
    });
    assert.equal(retryResponse.statusCode, 200);
    const retryPayload = readJson(retryResponse) as {
      ok: boolean;
      data: {
        dispatchJob: { status: string; attempt: number; trigger: string };
        execution: { recommendationAction: string } | null;
      };
    };
    assert.equal(retryPayload.ok, true);
    assert.equal(retryPayload.data.dispatchJob.status, "queued");
    assert.equal(retryPayload.data.dispatchJob.attempt, 2);
    assert.equal(retryPayload.data.dispatchJob.trigger, "retry");
    assert.equal(retryPayload.data.execution, null);

    const successDrainResponse = await app.inject({
      method: "POST",
      url: "/v1/copilot/dispatch-worker/drain",
      payload: {
        tenantId: "tnt_green",
        workerId: "test_worker"
      }
    });
    assert.equal(successDrainResponse.statusCode, 200);
    const successDrainPayload = readJson(successDrainResponse) as {
      ok: boolean;
      data: {
        successCount: number;
        items: Array<{ execution: { recommendationAction: string } | null }>;
      };
    };
    assert.equal(successDrainPayload.ok, true);
    assert.equal(successDrainPayload.data.successCount, 1);
    assert.equal(successDrainPayload.data.items[0]?.execution?.recommendationAction, "request_payment_followup");

    const dispatchResponse = await app.inject({
      method: "GET",
      url: `/v1/patient-cases/case_green_001/prepared-action-dispatches?tenantSlug=green-valley&preparedActionId=${encodeURIComponent(preparedActionId)}`
    });
    assert.equal(dispatchResponse.statusCode, 200);
    const dispatchPayload = readJson(dispatchResponse) as {
      items: Array<{ status: string; attempt: number }>;
    };
    assert.equal(dispatchPayload.items.length, 2);
    assert.equal(dispatchPayload.items[0]?.status, "succeeded");
    assert.equal(dispatchPayload.items[0]?.attempt, 2);
    assert.equal(dispatchPayload.items[1]?.status, "failed");
    assert.equal(dispatchPayload.items[1]?.attempt, 1);
  } finally {
    await app.close();
  }
});

test("receipt webhook route updates provider status and exposes the event ledger", async () => {
  const { app } = await createTestApp();

  try {
    const inspectResponse = await app.inject({
      method: "GET",
      url: "/v1/patient-cases/tnt_river/case_river_001/copilot"
    });
    assert.equal(inspectResponse.statusCode, 200);
    const inspectPayload = readJson(inspectResponse) as {
      data: {
        recommendation: { recommendedAction: string };
        preparedAction: { id: string };
      };
    };

    const reviewResponse = await app.inject({
      method: "POST",
      url: "/v1/patient-cases/tnt_river/case_river_001/copilot/review",
      payload: {
        recommendationAction: inspectPayload.data.recommendation.recommendedAction,
        decision: "approve",
        actor: "staff_river_manager",
        preparedActionId: inspectPayload.data.preparedAction.id,
        executeNow: true
      }
    });
    assert.equal(reviewResponse.statusCode, 200);

    const drainResponse = await app.inject({
      method: "POST",
      url: "/v1/copilot/dispatch-worker/drain",
      payload: {
        tenantId: "tnt_river",
        workerId: "test_worker"
      }
    });
    assert.equal(drainResponse.statusCode, 200);

    const receiptsResponse = await app.inject({
      method: "GET",
      url: `/v1/patient-cases/case_river_001/copilot-receipts?tenantSlug=river-point&preparedActionId=${encodeURIComponent(inspectPayload.data.preparedAction.id)}`
    });
    assert.equal(receiptsResponse.statusCode, 200);
    const receiptsPayload = readJson(receiptsResponse) as {
      items: Array<{
        providerStatus: string;
        receipt: { system: string; idempotencyKey: string; externalRef: string | null };
      }>;
    };
    assert.equal(receiptsPayload.items[0]?.providerStatus, "pending");

    const webhookResponse = await app.inject({
      method: "POST",
      url: "/v1/copilot/receipts/webhook",
      payload: {
        tenantSlug: "river-point",
        system: "queue_console",
        eventType: "delivered",
        idempotencyKey: receiptsPayload.items[0]?.receipt.idempotencyKey,
        externalRef: receiptsPayload.items[0]?.receipt.externalRef,
        payload: {
          provider: "local_queue_console"
        }
      }
    });
    assert.equal(webhookResponse.statusCode, 200);
    const webhookPayload = readJson(webhookResponse) as {
      ok: boolean;
      data: {
        receipt: { providerStatus: string };
        event: { eventType: string; system: string };
      };
    };
    assert.equal(webhookPayload.ok, true);
    assert.equal(webhookPayload.data.receipt.providerStatus, "delivered");
    assert.equal(webhookPayload.data.event.eventType, "delivered");

    const updatedReceiptsResponse = await app.inject({
      method: "GET",
      url: `/v1/patient-cases/case_river_001/copilot-receipts?tenantSlug=river-point&preparedActionId=${encodeURIComponent(inspectPayload.data.preparedAction.id)}`
    });
    assert.equal(updatedReceiptsResponse.statusCode, 200);
    const updatedReceiptsPayload = readJson(updatedReceiptsResponse) as {
      items: Array<{ providerStatus: string }>;
    };
    assert.equal(updatedReceiptsPayload.items[0]?.providerStatus, "delivered");

    const eventsResponse = await app.inject({
      method: "GET",
      url: `/v1/patient-cases/case_river_001/copilot-receipt-events?tenantSlug=river-point&preparedActionId=${encodeURIComponent(inspectPayload.data.preparedAction.id)}`
    });
    assert.equal(eventsResponse.statusCode, 200);
    const eventsPayload = readJson(eventsResponse) as {
      items: Array<{ eventType: string; system: string }>;
    };
    assert.equal(eventsPayload.items.length, 1);
    assert.equal(eventsPayload.items[0]?.eventType, "delivered");
    assert.equal(eventsPayload.items[0]?.system, "queue_console");
  } finally {
    await app.close();
  }
});

test("provider exceptions route lists failed receipts for ops follow-up", async () => {
  const { app } = await createTestApp();

  try {
    const inspectResponse = await app.inject({
      method: "GET",
      url: "/v1/patient-cases/tnt_river/case_river_001/copilot"
    });
    assert.equal(inspectResponse.statusCode, 200);
    const inspectPayload = readJson(inspectResponse) as {
      data: {
        recommendation: { recommendedAction: string };
        preparedAction: { id: string };
      };
    };

    const reviewResponse = await app.inject({
      method: "POST",
      url: "/v1/patient-cases/tnt_river/case_river_001/copilot/review",
      payload: {
        recommendationAction: inspectPayload.data.recommendation.recommendedAction,
        decision: "approve",
        actor: "staff_river_manager",
        preparedActionId: inspectPayload.data.preparedAction.id,
        executeNow: true
      }
    });
    assert.equal(reviewResponse.statusCode, 200);

    const drainResponse = await app.inject({
      method: "POST",
      url: "/v1/copilot/dispatch-worker/drain",
      payload: {
        tenantId: "tnt_river",
        workerId: "test_worker"
      }
    });
    assert.equal(drainResponse.statusCode, 200);

    const receiptsResponse = await app.inject({
      method: "GET",
      url: `/v1/patient-cases/case_river_001/copilot-receipts?tenantSlug=river-point&preparedActionId=${encodeURIComponent(inspectPayload.data.preparedAction.id)}`
    });
    assert.equal(receiptsResponse.statusCode, 200);
    const receiptsPayload = readJson(receiptsResponse) as {
      items: Array<{ receipt: { idempotencyKey: string; externalRef: string | null } }>;
    };

    const failedWebhookResponse = await app.inject({
      method: "POST",
      url: "/v1/copilot/receipts/webhook",
      payload: {
        tenantSlug: "river-point",
        system: "queue_console",
        eventType: "failed",
        idempotencyKey: receiptsPayload.items[0]?.receipt.idempotencyKey,
        externalRef: receiptsPayload.items[0]?.receipt.externalRef,
        error: "queue console outage"
      }
    });
    assert.equal(failedWebhookResponse.statusCode, 200);

    const exceptionsResponse = await app.inject({
      method: "GET",
      url: "/v1/copilot/provider-exceptions?tenantSlug=river-point"
    });
    assert.equal(exceptionsResponse.statusCode, 200);
    const exceptionsPayload = readJson(exceptionsResponse) as {
      items: Array<{
        patientCaseId: string;
        system: string;
        providerStatus: string;
        remediationStatus: string;
      }>;
    };
    assert.equal(exceptionsPayload.items.length, 1);
    assert.equal(exceptionsPayload.items[0]?.patientCaseId, "case_river_001");
    assert.equal(exceptionsPayload.items[0]?.system, "queue_console");
    assert.equal(exceptionsPayload.items[0]?.providerStatus, "failed");
    assert.equal(exceptionsPayload.items[0]?.remediationStatus, "escalated");
  } finally {
    await app.close();
  }
});

test("provider exception remediation endpoint queues a fallback retry and clears the queue after delivery", async () => {
  const { app } = await createTestApp();

  try {
    const inspectResponse = await app.inject({
      method: "GET",
      url: "/v1/patient-cases/tnt_green/case_green_001/copilot"
    });
    assert.equal(inspectResponse.statusCode, 200);
    const inspectPayload = readJson(inspectResponse) as {
      data: {
        recommendation: { recommendedAction: string };
        preparedAction: { id: string };
      };
    };

    const reviewResponse = await app.inject({
      method: "POST",
      url: "/v1/patient-cases/tnt_green/case_green_001/copilot/review",
      payload: {
        recommendationAction: inspectPayload.data.recommendation.recommendedAction,
        decision: "approve",
        actor: "staff_green_front",
        preparedActionId: inspectPayload.data.preparedAction.id,
        executeNow: true
      }
    });
    assert.equal(reviewResponse.statusCode, 200);

    const drainResponse = await app.inject({
      method: "POST",
      url: "/v1/copilot/dispatch-worker/drain",
      payload: {
        tenantId: "tnt_green",
        workerId: "test_worker"
      }
    });
    assert.equal(drainResponse.statusCode, 200);

    const originalReceiptsResponse = await app.inject({
      method: "GET",
      url: `/v1/patient-cases/case_green_001/copilot-receipts?tenantSlug=green-valley&preparedActionId=${encodeURIComponent(inspectPayload.data.preparedAction.id)}&system=patient_messaging`
    });
    assert.equal(originalReceiptsResponse.statusCode, 200);
    const originalReceiptsPayload = readJson(originalReceiptsResponse) as {
      items: Array<{ id: string; receipt: { idempotencyKey: string; externalRef: string | null } }>;
    };

    const failedWebhookResponse = await app.inject({
      method: "POST",
      url: "/v1/copilot/receipts/webhook",
      payload: {
        tenantSlug: "green-valley",
        system: "patient_messaging",
        eventType: "failed",
        idempotencyKey: originalReceiptsPayload.items[0]?.receipt.idempotencyKey,
        externalRef: originalReceiptsPayload.items[0]?.receipt.externalRef,
        error: "gateway rejected whatsapp"
      }
    });
    assert.equal(failedWebhookResponse.statusCode, 200);

    const remediationResponse = await app.inject({
      method: "POST",
      url: `/v1/copilot/provider-exceptions/${encodeURIComponent(originalReceiptsPayload.items[0]?.id ?? "")}/remediate`,
      payload: {
        tenantSlug: "green-valley",
        actor: "staff_green_front",
        decision: "fallback_channel_retry",
        fallbackChannel: "email"
      }
    });
    assert.equal(remediationResponse.statusCode, 200);
    const remediationPayload = readJson(remediationResponse) as {
      ok: boolean;
      data: {
        dispatchJob: { status: string };
        remediationPreparedAction: { id: string; payloadDraft: { channelOverride: string } };
        item: { remediationStatus: string };
      };
    };
    assert.equal(remediationPayload.ok, true);
    assert.equal(remediationPayload.data.dispatchJob.status, "queued");
    assert.equal(remediationPayload.data.remediationPreparedAction.payloadDraft.channelOverride, "email");
    assert.equal(remediationPayload.data.item.remediationStatus, "retry_queued");

    const retryDrainResponse = await app.inject({
      method: "POST",
      url: "/v1/copilot/dispatch-worker/drain",
      payload: {
        tenantId: "tnt_green",
        workerId: "test_worker_retry"
      }
    });
    assert.equal(retryDrainResponse.statusCode, 200);

    const retryReceiptsResponse = await app.inject({
      method: "GET",
      url: `/v1/patient-cases/case_green_001/copilot-receipts?tenantSlug=green-valley&preparedActionId=${encodeURIComponent(remediationPayload.data.remediationPreparedAction.id)}&system=patient_messaging`
    });
    assert.equal(retryReceiptsResponse.statusCode, 200);
    const retryReceiptsPayload = readJson(retryReceiptsResponse) as {
      items: Array<{ receipt: { idempotencyKey: string; externalRef: string | null } }>;
    };
    assert.equal(retryReceiptsPayload.items.length, 1);

    const pendingExceptionsResponse = await app.inject({
      method: "GET",
      url: "/v1/copilot/provider-exceptions?tenantSlug=green-valley"
    });
    assert.equal(pendingExceptionsResponse.statusCode, 200);
    const pendingExceptionsPayload = readJson(pendingExceptionsResponse) as {
      items: Array<{ remediationStatus: string }>;
    };
    assert.equal(pendingExceptionsPayload.items[0]?.remediationStatus, "awaiting_provider_confirmation");

    const deliveredWebhookResponse = await app.inject({
      method: "POST",
      url: "/v1/copilot/receipts/webhook",
      payload: {
        tenantSlug: "green-valley",
        system: "patient_messaging",
        eventType: "delivered",
        idempotencyKey: retryReceiptsPayload.items[0]?.receipt.idempotencyKey,
        externalRef: retryReceiptsPayload.items[0]?.receipt.externalRef
      }
    });
    assert.equal(deliveredWebhookResponse.statusCode, 200);

    const resolvedExceptionsResponse = await app.inject({
      method: "GET",
      url: "/v1/copilot/provider-exceptions?tenantSlug=green-valley"
    });
    assert.equal(resolvedExceptionsResponse.statusCode, 200);
    const resolvedExceptionsPayload = readJson(resolvedExceptionsResponse) as {
      items: Array<unknown>;
    };
    assert.equal(resolvedExceptionsPayload.items.length, 0);
  } finally {
    await app.close();
  }
});
