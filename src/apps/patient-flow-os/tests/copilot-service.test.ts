import assert from "node:assert/strict";
import test from "node:test";

import { PatientCaseCopilotService } from "../apps/api/src/copilot.js";
import { createLocalDestinationDispatchPorts } from "../apps/api/src/destination-ports.js";
import { createBootstrapState, InMemoryPlatformRepository } from "../apps/api/src/state.js";

test("inspectCase construye snapshot, recomendacion, prepared action y case card", async () => {
  const repository = new InMemoryPlatformRepository(createBootstrapState());
  const service = new PatientCaseCopilotService(repository);

  const inspection = await service.inspectCase({
    tenantId: "tnt_river",
    caseId: "case_river_001"
  });

  assert.equal(inspection.snapshot.case.id, "case_river_001");
  assert.equal(inspection.recommendation.recommendedAction, "call_next_patient");
  assert.equal(inspection.card.blocks.now.title, "Ahora");
  assert.equal(inspection.card.blocks.whyNow.title, "Por qué");
  assert.equal(inspection.card.blocks.riskIfIgnored.title, "Riesgo si no");
  assert.equal(inspection.card.blocks.preparedAction.title, "Qué te dejo listo");
  assert.equal(inspection.card.blocks.humanApproval.title, "Aprobación humana");
  assert.equal(inspection.preparedAction.version, 1);
  assert.equal(inspection.snapshot.preparedActions.length, 1);
  assert.equal(inspection.snapshot.preparedActions[0]?.id, inspection.preparedAction.id);
});

test("materializeRecommendationTask persiste el task del copilot", async () => {
  const repository = new InMemoryPlatformRepository(createBootstrapState());
  const service = new PatientCaseCopilotService(repository);
  const before = repository.listAgentTasks("tnt_river").length;

  const task = await service.materializeRecommendationTask({
    tenantId: "tnt_river",
    caseId: "case_river_001"
  });

  const after = repository.listAgentTasks("tnt_river").length;
  assert.equal(after, before + 1);
  assert.equal(task.recommendation.recommendedAction, "call_next_patient");
});

test("recordReviewDecision deja rastro en snapshot y timeline", () => {
  const repository = new InMemoryPlatformRepository(createBootstrapState());
  const service = new PatientCaseCopilotService(repository);

  const review = service.recordReviewDecision("tnt_green", "case_green_001", {
    recommendationAction: "request_payment_followup",
    decision: "approve",
    actor: "sara.frontdesk",
    note: "Payment proof looks good."
  });

  const snapshot = repository.getPatientCaseSnapshot("tnt_green", "case_green_001");
  assert.ok(snapshot);
  assert.equal(review.decision, "approve");
  assert.equal(snapshot.copilotReviewDecisions.length, 1);
  assert.equal(snapshot.copilotReviewDecisions[0]?.decision, "approve");
  assert.equal(snapshot.timeline.at(-1)?.type, "copilot_reviewed");
});

test("reviewCase encola la accion preparada y el worker la ejecuta despues", async () => {
  const repository = new InMemoryPlatformRepository(createBootstrapState());
  const service = new PatientCaseCopilotService(repository);

  const result = await service.reviewCase("tnt_river", "case_river_001", {
    recommendationAction: "call_next_patient",
    decision: "approve",
    actor: "leo.manager",
    executeNow: true
  });

  assert.equal(result.review.decision, "approve");
  assert.equal(result.execution, null);
  assert.equal(result.dispatchJob?.status, "queued");
  assert.equal(result.snapshot.queueTickets[0]?.status, "waiting");
  assert.equal(result.snapshot.copilotReviewDecisions.at(-1)?.decision, "approve");

  const drain = await service.drainDispatchQueue({
    tenantId: "tnt_river",
    workerId: "worker_river"
  });

  assert.equal(drain.successCount, 1);
  assert.equal(drain.failureCount, 0);
  assert.equal(drain.items[0]?.dispatchJob.status, "succeeded");
  assert.equal(drain.items[0]?.execution?.recommendationAction, "call_next_patient");
  assert.equal(drain.items[0]?.execution?.destinationSystem, "queue_console");
  assert.equal(drain.items[0]?.execution?.adapterKey, "queue_console_adapter");
  assert.equal(drain.items[0]?.execution?.dedupeKey, `queue_console:${result.preparedAction.id}`);
  assert.equal(drain.items[0]?.execution?.deduped, false);
  assert.equal(drain.items[0]?.execution?.receipts.length, 1);
  assert.equal(drain.items[0]?.execution?.receipts[0]?.system, "queue_console");
  assert.equal(drain.items[0]?.execution?.receipts[0]?.operation, "call_next_patient");
  assert.equal(
    drain.items[0]?.execution?.receipts[0]?.idempotencyKey,
    `queue_console:${result.preparedAction.id}:call_next_patient`
  );
  assert.ok(drain.items[0]?.execution?.applied.some((item) => item.kind === "queue_ticket"));
  assert.ok(drain.items[0]?.execution?.applied.some((item) => item.kind === "prepared_action"));
  const snapshot = repository.getPatientCaseSnapshot("tnt_river", "case_river_001");
  const receiptLedger = repository.listCopilotExecutionReceipts("tnt_river", "case_river_001", {
    preparedActionId: result.preparedAction.id
  });
  assert.equal(snapshot?.queueTickets[0]?.status, "called");
  assert.equal(snapshot?.copilotExecutionReceipts.length, 1);
  assert.equal(receiptLedger.length, 1);
  assert.equal(receiptLedger[0]?.dispatchJobId, drain.items[0]?.dispatchJob.id);
  assert.equal(receiptLedger[0]?.receipt.system, "queue_console");
});

test("dispatch worker dedupes duplicate jobs for the same prepared action", async () => {
  const repository = new InMemoryPlatformRepository(createBootstrapState());
  const service = new PatientCaseCopilotService(repository);
  const inspection = await service.inspectCase({
    tenantId: "tnt_river",
    caseId: "case_river_001"
  });

  const reviewResult = await service.reviewCase("tnt_river", "case_river_001", {
    recommendationAction: inspection.recommendation.recommendedAction,
    decision: "approve",
    actor: "leo.manager",
    preparedActionId: inspection.preparedAction.id,
    executeNow: true
  });
  assert.equal(reviewResult.dispatchJob?.attempt, 1);

  const retryResult = await service.retryPreparedActionExecution("tnt_river", "case_river_001", {
    preparedActionId: inspection.preparedAction.id,
    actor: "leo.manager"
  });
  assert.equal(retryResult.dispatchJob.attempt, 2);

  const drain = await service.drainDispatchQueue({
    tenantId: "tnt_river",
    workerId: "worker_river"
  });

  assert.equal(drain.successCount, 2);
  assert.equal(drain.failureCount, 0);

  const originalExecution = drain.items.find((item) => item.dispatchJob.attempt === 1)?.execution;
  const dedupedExecution = drain.items.find((item) => item.dispatchJob.attempt === 2)?.execution;
  assert.ok(originalExecution);
  assert.ok(dedupedExecution);
  assert.equal(originalExecution?.deduped, false);
  assert.equal(dedupedExecution?.deduped, true);
  assert.equal(originalExecution?.destinationSystem, "queue_console");
  assert.equal(dedupedExecution?.destinationSystem, "queue_console");
  assert.equal(originalExecution?.adapterKey, "queue_console_adapter");
  assert.equal(dedupedExecution?.adapterKey, "queue_console_adapter");
  assert.equal(originalExecution?.dedupeKey, `queue_console:${inspection.preparedAction.id}`);
  assert.equal(dedupedExecution?.dedupeKey, `queue_console:${inspection.preparedAction.id}`);
  assert.equal(originalExecution?.receipts[0]?.idempotencyKey, `queue_console:${inspection.preparedAction.id}:call_next_patient`);
  assert.equal(dedupedExecution?.receipts[0]?.idempotencyKey, `queue_console:${inspection.preparedAction.id}:call_next_patient`);

  const dispatchHistory = repository.listPreparedActionDispatchJobs(
    "tnt_river",
    "case_river_001",
    inspection.preparedAction.id
  );
  assert.equal(dispatchHistory.length, 2);
  assert.ok(dispatchHistory.every((dispatchJob) => dispatchJob.status === "succeeded"));
  assert.equal(repository.getPreparedAction("tnt_river", inspection.preparedAction.id)?.status, "executed");
  assert.equal(repository.getPatientCaseSnapshot("tnt_river", "case_river_001")?.queueTickets[0]?.status, "called");
});

test("receipt webhook confirms provider delivery and appends an event ledger", async () => {
  const repository = new InMemoryPlatformRepository(createBootstrapState());
  const service = new PatientCaseCopilotService(repository);

  const review = await service.reviewCase("tnt_river", "case_river_001", {
    recommendationAction: "call_next_patient",
    decision: "approve",
    actor: "leo.manager",
    executeNow: true
  });

  await service.drainDispatchQueue({
    tenantId: "tnt_river",
    workerId: "worker_river"
  });

  const receiptRecord = repository.listCopilotExecutionReceipts("tnt_river", "case_river_001", {
    preparedActionId: review.preparedAction.id
  })[0];
  assert.ok(receiptRecord);
  assert.equal(receiptRecord?.providerStatus, "pending");

  const webhook = service.recordReceiptWebhook("tnt_river", {
    system: "queue_console",
    eventType: "delivered",
    idempotencyKey: receiptRecord?.receipt.idempotencyKey,
    externalRef: receiptRecord?.receipt.externalRef,
    payload: {
      provider: "local_queue_console"
    }
  });

  assert.equal(webhook.receipt.providerStatus, "delivered");
  assert.equal(webhook.event.eventType, "delivered");
  assert.equal(webhook.snapshot.copilotExecutionReceiptEvents.length, 1);
  assert.equal(webhook.snapshot.copilotExecutionReceiptEvents[0]?.system, "queue_console");
  assert.equal(webhook.snapshot.timeline.at(-1)?.type, "copilot_receipt_updated");
});

test("provider failure escalates the case and a later delivery clears the escalation", async () => {
  const repository = new InMemoryPlatformRepository(createBootstrapState());
  const service = new PatientCaseCopilotService(repository);

  const review = await service.reviewCase("tnt_river", "case_river_001", {
    recommendationAction: "call_next_patient",
    decision: "approve",
    actor: "leo.manager",
    executeNow: true
  });

  await service.drainDispatchQueue({
    tenantId: "tnt_river",
    workerId: "worker_river"
  });

  const receiptRecord = repository.listCopilotExecutionReceipts("tnt_river", "case_river_001", {
    preparedActionId: review.preparedAction.id
  })[0];
  assert.ok(receiptRecord);

  const failedWebhook = service.recordReceiptWebhook("tnt_river", {
    system: "queue_console",
    eventType: "failed",
    idempotencyKey: receiptRecord?.receipt.idempotencyKey,
    externalRef: receiptRecord?.receipt.externalRef,
    error: "queue console outage"
  });

  assert.equal(failedWebhook.receipt.providerStatus, "failed");
  assert.equal(failedWebhook.snapshot.case.status, "exception");
  assert.ok(
    failedWebhook.snapshot.actions.some(
      (action) => action.action === "handoff_to_staff" && action.status === "pending"
    )
  );
  assert.ok(
    failedWebhook.snapshot.agentTasks.some(
      (task) => task.type === "handoff" && task.status === "pending"
    )
  );

  const deliveredWebhook = service.recordReceiptWebhook("tnt_river", {
    system: "queue_console",
    eventType: "delivered",
    idempotencyKey: receiptRecord?.receipt.idempotencyKey,
    externalRef: receiptRecord?.receipt.externalRef
  });

  assert.equal(deliveredWebhook.receipt.providerStatus, "delivered");
  assert.equal(deliveredWebhook.snapshot.case.status, "queued");
  assert.ok(
    deliveredWebhook.snapshot.actions.every(
      (action) => !(action.action === "handoff_to_staff" && action.status === "pending")
    )
  );
  assert.ok(
    deliveredWebhook.snapshot.agentTasks.every(
      (task) => !(task.type === "handoff" && task.status === "pending")
    )
  );
});

test("patient messaging failure reopens delivery work on the case", async () => {
  const repository = new InMemoryPlatformRepository(createBootstrapState());
  const service = new PatientCaseCopilotService(repository);
  const inspection = await service.inspectCase({
    tenantId: "tnt_green",
    caseId: "case_green_001"
  });

  await service.reviewCase("tnt_green", "case_green_001", {
    recommendationAction: inspection.recommendation.recommendedAction,
    decision: "approve",
    actor: "sara.frontdesk",
    preparedActionId: inspection.preparedAction.id,
    executeNow: true
  });

  await service.drainDispatchQueue({
    tenantId: "tnt_green",
    workerId: "worker_green"
  });

  const messageReceipt = repository
    .listCopilotExecutionReceipts("tnt_green", "case_green_001", {
      preparedActionId: inspection.preparedAction.id,
      system: "patient_messaging"
    })[0];
  assert.ok(messageReceipt);

  const failedWebhook = service.recordReceiptWebhook("tnt_green", {
    system: "patient_messaging",
    eventType: "failed",
    idempotencyKey: messageReceipt?.receipt.idempotencyKey,
    externalRef: messageReceipt?.receipt.externalRef,
    error: "whatsapp delivery rejected"
  });

  assert.equal(failedWebhook.receipt.providerStatus, "failed");
  assert.ok(
    failedWebhook.snapshot.actions.some(
      (action) => action.action === "request_payment_followup" && action.status === "pending"
    )
  );
});

test("provider exception remediation can retry messaging on a fallback channel and resolves after delivery", async () => {
  const repository = new InMemoryPlatformRepository(createBootstrapState());
  const service = new PatientCaseCopilotService(repository);
  const inspection = await service.inspectCase({
    tenantId: "tnt_green",
    caseId: "case_green_001"
  });

  await service.reviewCase("tnt_green", "case_green_001", {
    recommendationAction: inspection.recommendation.recommendedAction,
    decision: "approve",
    actor: "sara.frontdesk",
    preparedActionId: inspection.preparedAction.id,
    executeNow: true
  });

  await service.drainDispatchQueue({
    tenantId: "tnt_green",
    workerId: "worker_green"
  });

  const originalMessageReceipt = repository
    .listCopilotExecutionReceipts("tnt_green", "case_green_001", {
      preparedActionId: inspection.preparedAction.id,
      system: "patient_messaging"
    })[0];
  assert.ok(originalMessageReceipt);

  service.recordReceiptWebhook("tnt_green", {
    system: "patient_messaging",
    eventType: "failed",
    idempotencyKey: originalMessageReceipt?.receipt.idempotencyKey,
    externalRef: originalMessageReceipt?.receipt.externalRef,
    error: "whatsapp delivery rejected"
  });

  const failedException = service.listProviderExceptions({
    tenantId: "tnt_green"
  })[0];
  assert.ok(failedException);
  assert.equal(failedException?.remediationStatus, "escalated");
  assert.equal(failedException?.canFallback, true);

  const remediation = service.remediateProviderException("tnt_green", originalMessageReceipt?.id ?? "", {
    actor: "sara.frontdesk",
    decision: "fallback_channel_retry",
    fallbackChannel: "email"
  });
  assert.equal(remediation.dispatchJob?.status, "queued");
  assert.equal(remediation.remediationPreparedAction?.payloadDraft.channelOverride, "email");
  assert.equal(remediation.item?.remediationStatus, "retry_queued");

  const retryDrain = await service.drainDispatchQueue({
    tenantId: "tnt_green",
    workerId: "worker_green_retry"
  });
  assert.equal(retryDrain.successCount, 1);
  assert.equal(retryDrain.items[0]?.execution?.receipts.length, 1);
  assert.equal(retryDrain.items[0]?.execution?.receipts[0]?.system, "patient_messaging");

  const retrySnapshot = repository.getPatientCaseSnapshot("tnt_green", "case_green_001");
  assert.ok(
    retrySnapshot?.conversationThreads.some((thread) => thread.channel === "email")
  );

  const retryMessageReceipt = repository
    .listCopilotExecutionReceipts("tnt_green", "case_green_001", {
      preparedActionId: remediation.remediationPreparedAction?.id,
      system: "patient_messaging"
    })[0];
  assert.ok(retryMessageReceipt);

  const pendingException = service.listProviderExceptions({
    tenantId: "tnt_green"
  })[0];
  assert.equal(pendingException?.remediationStatus, "awaiting_provider_confirmation");

  service.recordReceiptWebhook("tnt_green", {
    system: "patient_messaging",
    eventType: "delivered",
    idempotencyKey: retryMessageReceipt?.receipt.idempotencyKey,
    externalRef: retryMessageReceipt?.receipt.externalRef
  });

  const remainingExceptions = service.listProviderExceptions({
    tenantId: "tnt_green"
  });
  assert.equal(remainingExceptions.length, 0);
});

test("copilot accepts injectable destination ports and surfaces external receipts", async () => {
  const repository = new InMemoryPlatformRepository(createBootstrapState());
  const basePorts = createLocalDestinationDispatchPorts(repository);
  const idempotencyKeys: string[] = [];
  const service = new PatientCaseCopilotService(repository, undefined, {
    ...basePorts,
    queue: {
      ...basePorts.queue,
      callNextPatient(input) {
        const result = basePorts.queue.callNextPatient(input);
        idempotencyKeys.push(result.receipt.idempotencyKey);
        return {
          ...result,
          receipt: {
            ...result.receipt,
            externalRef: `queue-provider:${result.ticket.id}`,
            metadata: {
              ...result.receipt.metadata,
              provider: "stub_queue"
            }
          }
        };
      }
    }
  });

  const inspection = await service.inspectCase({
    tenantId: "tnt_river",
    caseId: "case_river_001"
  });

  await service.reviewCase("tnt_river", "case_river_001", {
    recommendationAction: inspection.recommendation.recommendedAction,
    decision: "approve",
    actor: "leo.manager",
    preparedActionId: inspection.preparedAction.id,
    executeNow: true
  });

  const drain = await service.drainDispatchQueue({
    tenantId: "tnt_river",
    workerId: "worker_river"
  });

  assert.deepEqual(idempotencyKeys, [`queue_console:${inspection.preparedAction.id}:call_next_patient`]);
  assert.equal(
    drain.items[0]?.execution?.receipts[0]?.externalRef,
    "queue-provider:ticket_river_001"
  );
  assert.equal(drain.items[0]?.execution?.receipts[0]?.metadata.provider, "stub_queue");
});

test("reviewCase rechaza un prepared action stale y lo marca como stale", async () => {
  const repository = new InMemoryPlatformRepository(createBootstrapState());
  const service = new PatientCaseCopilotService(repository);

  const firstInspection = await service.inspectCase({
    tenantId: "tnt_river",
    caseId: "case_river_001"
  });
  repository.callQueueTicket("tnt_river", "ticket_river_001", "staff", "staff_river_manager");

  await assert.rejects(
    () =>
      service.reviewCase("tnt_river", "case_river_001", {
        recommendationAction: "call_next_patient",
        decision: "approve",
        actor: "staff_river_manager",
        preparedActionId: firstInspection.preparedAction.id,
        executeNow: true
      }),
    /prepared action is stale/
  );

  const stalePreparedAction = repository.getPreparedAction("tnt_river", firstInspection.preparedAction.id);
  assert.equal(stalePreparedAction?.status, "stale");
  assert.equal(stalePreparedAction?.staleReason, "case_changed_before_review");
});

test("retryPreparedActionExecution conserva historial de fallas y completa un retry exitoso", async () => {
  const repository = new InMemoryPlatformRepository(createBootstrapState());
  const service = new PatientCaseCopilotService(repository);
  const inspection = await service.inspectCase({
    tenantId: "tnt_green",
    caseId: "case_green_001"
  });

  const originalAppendConversationMessage = repository.appendConversationMessage.bind(repository);
  Object.assign(repository, {
    appendConversationMessage: () => {
      throw new Error("simulated message gateway outage");
    }
  });

  const queuedReview = await service.reviewCase("tnt_green", "case_green_001", {
    recommendationAction: inspection.recommendation.recommendedAction,
    decision: "approve",
    actor: "sara.frontdesk",
    preparedActionId: inspection.preparedAction.id,
    executeNow: true
  });

  assert.equal(queuedReview.dispatchJob?.status, "queued");
  const failedDrain = await service.drainDispatchQueue({
    tenantId: "tnt_green",
    workerId: "worker_green"
  });
  assert.equal(failedDrain.failureCount, 1);
  assert.match(failedDrain.items[0]?.error ?? "", /simulated message gateway outage/);

  const failedDispatch = repository.listPreparedActionDispatchJobs(
    "tnt_green",
    "case_green_001",
    inspection.preparedAction.id
  )[0];
  assert.equal(failedDispatch?.status, "failed");
  assert.match(failedDispatch?.lastError ?? "", /simulated message gateway outage/);
  assert.equal(repository.getPreparedAction("tnt_green", inspection.preparedAction.id)?.status, "pending");

  Object.assign(repository, {
    appendConversationMessage: originalAppendConversationMessage
  });

  const retryResult = await service.retryPreparedActionExecution("tnt_green", "case_green_001", {
    preparedActionId: inspection.preparedAction.id,
    actor: "sara.frontdesk"
  });

  assert.equal(retryResult.dispatchJob.status, "queued");
  assert.equal(retryResult.dispatchJob.trigger, "retry");
  assert.equal(retryResult.execution, null);
  const retryDrain = await service.drainDispatchQueue({
    tenantId: "tnt_green",
    workerId: "worker_green"
  });
  assert.equal(retryDrain.successCount, 1);
  assert.ok(retryDrain.items[0]?.execution?.applied.some((item) => item.kind === "prepared_action"));
  assert.equal(retryDrain.items[0]?.execution?.receipts.length, 2);
  assert.equal(retryDrain.items[0]?.execution?.receipts[0]?.system, "patient_messaging");
  assert.equal(retryDrain.items[0]?.execution?.receipts[1]?.system, "payments_review_queue");
  const dispatchHistory = repository.listPreparedActionDispatchJobs(
    "tnt_green",
    "case_green_001",
    inspection.preparedAction.id
  );
  assert.equal(dispatchHistory.length, 2);
  assert.equal(dispatchHistory[0]?.attempt, 2);
  assert.equal(dispatchHistory[0]?.status, "succeeded");
  assert.equal(dispatchHistory[1]?.status, "failed");
});
