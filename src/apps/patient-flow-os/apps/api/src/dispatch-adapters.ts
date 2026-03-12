import type {
  AgentAction,
  AgentTask,
  CopilotExecutionMutation,
  CopilotExecutionReceipt,
  CopilotExecutionResult,
  ConversationThread,
  PatientCaseAction,
  PatientCaseSnapshot,
  PersistedPreparedAction
} from "../../../packages/core/src/index.js";
import type { DestinationDispatchPorts, DispatchPortContext } from "./destination-ports.js";
import { assertTenantProviderDispatchReady } from "./provider-clients.js";
import type { PlatformRepository } from "./state.js";

function nowIso(): string {
  return new Date().toISOString();
}

function latestPendingTask(snapshot: PatientCaseSnapshot, recommendationAction: AgentAction): AgentTask | undefined {
  return snapshot.agentTasks
    .filter((task) => task.status === "pending" && task.recommendation.recommendedAction === recommendationAction)
    .sort((left, right) => right.createdAt.localeCompare(left.createdAt))[0];
}

function latestPendingAction(
  snapshot: PatientCaseSnapshot,
  candidates: readonly AgentAction[]
): PatientCaseAction | undefined {
  return snapshot.actions
    .filter((action) => action.status === "pending" && candidates.includes(action.action))
    .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))[0];
}

function mutation(
  kind: CopilotExecutionMutation["kind"],
  entityId: string,
  label: string,
  status?: string | null
): CopilotExecutionMutation {
  return {
    kind,
    entityId,
    label,
    status: status ?? null
  };
}

function preparedActionRationale(preparedAction: PersistedPreparedAction): string {
  const payloadRationale = preparedAction.payloadDraft.rationale;
  if (typeof payloadRationale === "string" && payloadRationale.trim().length > 0) {
    return payloadRationale;
  }

  const preconditions = preparedAction.preconditions
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0);
  if (preconditions.length > 0) {
    return preconditions.join(" ");
  }

  return preparedAction.title;
}

function resolveMessageUsed(
  preparedAction: PersistedPreparedAction,
  messageOverride: string | null
): string | null {
  return messageOverride?.trim() || preparedAction.messageDraft || null;
}

function resolveRemediationReceiptSystem(preparedAction: PersistedPreparedAction): string | null {
  const value = preparedAction.payloadDraft.remediationReceiptSystem;
  return typeof value === "string" && value.trim().length > 0
    ? value.trim()
    : null;
}

function shouldExecuteReceiptSystem(
  preparedAction: PersistedPreparedAction,
  system: string
): boolean {
  const remediationReceiptSystem = resolveRemediationReceiptSystem(preparedAction);
  return remediationReceiptSystem === null || remediationReceiptSystem === system;
}

function resolveChannelOverride(
  preparedAction: PersistedPreparedAction
): ConversationThread["channel"] | undefined {
  const value = preparedAction.payloadDraft.channelOverride;
  return value === "sms" || value === "whatsapp" || value === "email" || value === "web"
    ? value
    : undefined;
}

function toPortContext(input: PreparedActionDispatchExecutionInput): DispatchPortContext {
  return {
    tenantId: input.tenantId,
    caseId: input.caseId,
    snapshot: input.snapshot,
    preparedAction: input.preparedAction,
    actorId: input.actorId
  };
}

function assertProviderSystemsReady(
  input: PreparedActionDispatchExecutionInput,
  systems: readonly string[]
): void {
  const tenant = input.repository.getTenantById(input.tenantId);
  if (!tenant) {
    throw new Error("tenant not found for provider dispatch");
  }

  for (const system of new Set(systems)) {
    assertTenantProviderDispatchReady(tenant, system);
  }
}

export interface PreparedActionDispatchExecutionInput {
  tenantId: string;
  caseId: string;
  snapshot: PatientCaseSnapshot;
  preparedAction: PersistedPreparedAction;
  actorId: string;
  messageOverride: string | null;
  repository: PlatformRepository;
  ports: DestinationDispatchPorts;
}

interface PreparedActionDispatchAdapterResult {
  messageUsed: string | null;
  applied: CopilotExecutionMutation[];
  receipts: CopilotExecutionReceipt[];
}

interface PreparedActionDispatchAdapter {
  key: string;
  destinationSystem: string;
  execute(input: PreparedActionDispatchExecutionInput): PreparedActionDispatchAdapterResult;
}

function executeQueueConsoleAdapter(input: PreparedActionDispatchExecutionInput): PreparedActionDispatchAdapterResult {
  const portContext = toPortContext(input);
  const messageUsed = resolveMessageUsed(input.preparedAction, input.messageOverride);
  const channelOverride = resolveChannelOverride(input.preparedAction);
  const applied: CopilotExecutionMutation[] = [];
  const receipts: CopilotExecutionReceipt[] = [];

  switch (input.preparedAction.recommendedAction) {
    case "call_next_patient": {
      if (!shouldExecuteReceiptSystem(input.preparedAction, "queue_console")) {
        throw new Error("provider remediation cannot replay call_next_patient for a non-queue receipt");
      }
      assertProviderSystemsReady(input, ["queue_console"]);
      const { ticket, receipt } = input.ports.queue.callNextPatient(portContext);
      applied.push(mutation("queue_ticket", ticket.id, `queue:${ticket.ticketNumber}`, ticket.status));
      receipts.push(receipt);
      return { messageUsed, applied, receipts };
    }
    case "start_check_in": {
      if (!shouldExecuteReceiptSystem(input.preparedAction, "queue_console")) {
        throw new Error("provider remediation cannot replay start_check_in for a non-queue receipt");
      }
      assertProviderSystemsReady(input, ["queue_console"]);
      const { appointment, receipt } = input.ports.queue.startCheckIn(portContext);
      applied.push(
        mutation("appointment", appointment.id, `appointment:${appointment.providerName}`, appointment.status)
      );
      receipts.push(receipt);
      return { messageUsed, applied, receipts };
    }
    case "show_queue_status": {
      if (!shouldExecuteReceiptSystem(input.preparedAction, "patient_messaging")) {
        throw new Error("provider remediation cannot replay show_queue_status for a non-messaging receipt");
      }
      if (!messageUsed) {
        throw new Error("message draft not available for copilot execution");
      }
      assertProviderSystemsReady(input, ["patient_messaging"]);
      const { thread, receipt } = input.ports.messaging.sendOpsMessage({
        ...portContext,
        body: messageUsed,
        channelOverride
      });
      applied.push(mutation("conversation_thread", thread.id, `thread:${thread.channel}:${thread.status}`, thread.status));
      receipts.push(receipt);
      return { messageUsed, applied, receipts };
    }
    default:
      throw new Error(`queue_console cannot execute action ${input.preparedAction.recommendedAction}`);
  }
}

function executeSchedulingWorkbenchAdapter(
  input: PreparedActionDispatchExecutionInput
): PreparedActionDispatchAdapterResult {
  const portContext = toPortContext(input);
  const messageUsed = resolveMessageUsed(input.preparedAction, input.messageOverride);
  const channelOverride = resolveChannelOverride(input.preparedAction);
  const applied: CopilotExecutionMutation[] = [];
  const receipts: CopilotExecutionReceipt[] = [];
  const rationale = preparedActionRationale(input.preparedAction);

  switch (input.preparedAction.recommendedAction) {
    case "confirm_appointment": {
      if (!shouldExecuteReceiptSystem(input.preparedAction, "scheduling_workbench")) {
        throw new Error("provider remediation cannot replay confirm_appointment for a non-scheduling receipt");
      }
      assertProviderSystemsReady(input, ["scheduling_workbench"]);
      const { appointment, receipt } = input.ports.scheduling.confirmAppointment(portContext);
      applied.push(
        mutation("appointment", appointment.id, `appointment:${appointment.providerName}`, appointment.status)
      );
      receipts.push(receipt);
      return { messageUsed, applied, receipts };
    }
    case "request_reschedule":
    case "propose_reschedule": {
      const includeScheduling = shouldExecuteReceiptSystem(input.preparedAction, "scheduling_workbench");
      const includeMessaging = shouldExecuteReceiptSystem(input.preparedAction, "patient_messaging");
      if (!includeScheduling && !includeMessaging) {
        throw new Error("provider remediation target is incompatible with reschedule execution");
      }
      assertProviderSystemsReady(
        input,
        [
          ...(includeScheduling ? ["scheduling_workbench"] : []),
          ...(includeMessaging ? ["patient_messaging"] : [])
        ]
      );

      if (includeScheduling) {
        const { appointment, receipt } = input.ports.scheduling.requestReschedule(portContext);
        applied.push(
          mutation("appointment", appointment.id, `appointment:${appointment.providerName}`, appointment.status)
        );
        receipts.push(receipt);
      }

      if (includeMessaging) {
        if (!messageUsed) {
          throw new Error("message draft not available for copilot execution");
        }
        const messageDispatch = input.ports.messaging.sendOpsMessage({
          ...portContext,
          body: messageUsed,
          channelOverride
        });
        applied.push(
          mutation(
            "conversation_thread",
            messageDispatch.thread.id,
            `thread:${messageDispatch.thread.channel}:${messageDispatch.thread.status}`,
            messageDispatch.thread.status
          )
        );
        receipts.push(messageDispatch.receipt);
      }

      if (includeScheduling) {
        const pendingActionForReschedule = latestPendingAction(input.snapshot, ["request_reschedule", "propose_reschedule"]);
        if (pendingActionForReschedule) {
          const updatedAction = input.repository.updateCaseActionStatus(
            input.tenantId,
            input.caseId,
            pendingActionForReschedule.id,
            "completed",
            input.actorId
          );
          applied.push(
            mutation("patient_case_action", updatedAction.id, `action:${updatedAction.action}`, updatedAction.status)
          );
        }
      }

      return { messageUsed, applied, receipts };
    }
    case "send_booking_options": {
      const includeScheduling = shouldExecuteReceiptSystem(input.preparedAction, "scheduling_workbench");
      const includeMessaging = shouldExecuteReceiptSystem(input.preparedAction, "patient_messaging");
      if (!includeScheduling && !includeMessaging) {
        throw new Error("provider remediation target is incompatible with booking options execution");
      }
      assertProviderSystemsReady(
        input,
        [
          ...(includeScheduling ? ["scheduling_workbench"] : []),
          ...(includeMessaging ? ["patient_messaging"] : [])
        ]
      );

      if (includeMessaging) {
        if (!messageUsed) {
          throw new Error("message draft not available for copilot execution");
        }
        const messageDispatch = input.ports.messaging.sendOpsMessage({
          ...portContext,
          body: messageUsed,
          channelOverride
        });
        applied.push(
          mutation(
            "conversation_thread",
            messageDispatch.thread.id,
            `thread:${messageDispatch.thread.channel}:${messageDispatch.thread.status}`,
            messageDispatch.thread.status
          )
        );
        receipts.push(messageDispatch.receipt);
      }

      if (includeScheduling) {
        const bookingOptions = input.ports.scheduling.recordBookingOptions({
          ...portContext,
          rationale: messageUsed ?? rationale
        });
        applied.push(
          mutation("patient_case_action", bookingOptions.action.id, `action:${bookingOptions.action.action}`, bookingOptions.action.status)
        );
        receipts.push(bookingOptions.receipt);
      }
      return { messageUsed, applied, receipts };
    }
    default:
      throw new Error(`scheduling_workbench cannot execute action ${input.preparedAction.recommendedAction}`);
  }
}

function executePaymentsReviewAdapter(input: PreparedActionDispatchExecutionInput): PreparedActionDispatchAdapterResult {
  const portContext = toPortContext(input);
  const messageUsed = resolveMessageUsed(input.preparedAction, input.messageOverride);
  const channelOverride = resolveChannelOverride(input.preparedAction);
  const applied: CopilotExecutionMutation[] = [];
  const receipts: CopilotExecutionReceipt[] = [];
  const rationale = preparedActionRationale(input.preparedAction);
  const includeMessaging = shouldExecuteReceiptSystem(input.preparedAction, "patient_messaging");
  const includePayments = shouldExecuteReceiptSystem(input.preparedAction, "payments_review_queue");

  if (!includeMessaging && !includePayments) {
    throw new Error("provider remediation target is incompatible with payments execution");
  }
  assertProviderSystemsReady(
    input,
    [
      ...(includeMessaging ? ["patient_messaging"] : []),
      ...(includePayments ? ["payments_review_queue"] : [])
    ]
  );

  if (includeMessaging) {
    if (!messageUsed) {
      throw new Error("message draft not available for copilot execution");
    }
    const messageDispatch = input.ports.messaging.sendOpsMessage({
      ...portContext,
      body: messageUsed,
      channelOverride
    });
    applied.push(
      mutation(
        "conversation_thread",
        messageDispatch.thread.id,
        `thread:${messageDispatch.thread.channel}:${messageDispatch.thread.status}`,
        messageDispatch.thread.status
      )
    );
    receipts.push(messageDispatch.receipt);
  }

  if (includePayments) {
    const followUp = input.ports.payments.recordApprovalFollowUp({
      ...portContext,
      rationale,
      messageUsed
    });
    applied.push(
      mutation("patient_case_action", followUp.action.id, `action:${followUp.action.action}`, followUp.action.status)
    );
    applied.push(
      mutation("patient_case_approval", followUp.approval.id, `approval:${followUp.approval.type}`, followUp.approval.status)
    );
    receipts.push(followUp.receipt);
  }

  return { messageUsed, applied, receipts };
}

function executeFollowUpQueueAdapter(input: PreparedActionDispatchExecutionInput): PreparedActionDispatchAdapterResult {
  const portContext = toPortContext(input);
  const messageUsed = resolveMessageUsed(input.preparedAction, input.messageOverride);
  const channelOverride = resolveChannelOverride(input.preparedAction);
  const applied: CopilotExecutionMutation[] = [];
  const receipts: CopilotExecutionReceipt[] = [];
  const rationale = preparedActionRationale(input.preparedAction);
  const includeMessaging = shouldExecuteReceiptSystem(input.preparedAction, "patient_messaging");
  const includeFollowUp = shouldExecuteReceiptSystem(input.preparedAction, "ops_followup_queue");

  if (!includeMessaging && !includeFollowUp) {
    throw new Error("provider remediation target is incompatible with follow-up execution");
  }
  assertProviderSystemsReady(
    input,
    [
      ...(includeMessaging ? ["patient_messaging"] : []),
      ...(includeFollowUp ? ["ops_followup_queue"] : [])
    ]
  );

  if (includeMessaging) {
    if (!messageUsed) {
      throw new Error("message draft not available for copilot execution");
    }
    const messageDispatch = input.ports.messaging.sendOpsMessage({
      ...portContext,
      body: messageUsed,
      channelOverride
    });
    applied.push(
      mutation(
        "conversation_thread",
        messageDispatch.thread.id,
        `thread:${messageDispatch.thread.channel}:${messageDispatch.thread.status}`,
        messageDispatch.thread.status
      )
    );
    receipts.push(messageDispatch.receipt);
  }

  if (includeFollowUp) {
    const followUp = input.ports.followUp.recordFollowUp({
      ...portContext,
      rationale,
      messageUsed
    });
    applied.push(
      mutation("patient_case_action", followUp.action.id, `action:${followUp.action.action}`, followUp.action.status)
    );
    receipts.push(followUp.receipt);
  }

  return { messageUsed, applied, receipts };
}

function executeOpsHandoffAdapter(input: PreparedActionDispatchExecutionInput): PreparedActionDispatchAdapterResult {
  const portContext = toPortContext(input);
  const messageUsed = resolveMessageUsed(input.preparedAction, input.messageOverride);
  const channelOverride = resolveChannelOverride(input.preparedAction);
  const applied: CopilotExecutionMutation[] = [];
  const receipts: CopilotExecutionReceipt[] = [];
  const rationale = preparedActionRationale(input.preparedAction);

  switch (input.preparedAction.recommendedAction) {
    case "answer_operational_faq": {
      if (!shouldExecuteReceiptSystem(input.preparedAction, "patient_messaging")) {
        throw new Error("provider remediation cannot replay FAQ messaging for a non-messaging receipt");
      }
      if (!messageUsed) {
        throw new Error("message draft not available for copilot execution");
      }
      assertProviderSystemsReady(input, ["patient_messaging"]);
      const messageDispatch = input.ports.messaging.sendOpsMessage({
        ...portContext,
        body: messageUsed,
        channelOverride
      });
      applied.push(
        mutation(
          "conversation_thread",
          messageDispatch.thread.id,
          `thread:${messageDispatch.thread.channel}:${messageDispatch.thread.status}`,
          messageDispatch.thread.status
        )
      );
      receipts.push(messageDispatch.receipt);
      return { messageUsed, applied, receipts };
    }
    case "handoff_to_staff": {
      if (!shouldExecuteReceiptSystem(input.preparedAction, "ops_handoff_queue")) {
        throw new Error("provider remediation cannot replay handoff for a non-handoff receipt");
      }
      assertProviderSystemsReady(input, ["ops_handoff_queue"]);
      const handoff = input.ports.handoff.createHandoff({
        ...portContext,
        rationale
      });
      applied.push(mutation("patient_case_action", handoff.action.id, `action:${handoff.action.action}`, handoff.action.status));
      receipts.push(handoff.receipt);
      return { messageUsed, applied, receipts };
    }
    default:
      throw new Error(`ops_handoff_queue cannot execute action ${input.preparedAction.recommendedAction}`);
  }
}

const dispatchAdapters: PreparedActionDispatchAdapter[] = [
  {
    key: "queue_console_adapter",
    destinationSystem: "queue_console",
    execute: executeQueueConsoleAdapter
  },
  {
    key: "scheduling_workbench_adapter",
    destinationSystem: "scheduling_workbench",
    execute: executeSchedulingWorkbenchAdapter
  },
  {
    key: "payments_review_adapter",
    destinationSystem: "payments_review_queue",
    execute: executePaymentsReviewAdapter
  },
  {
    key: "followup_queue_adapter",
    destinationSystem: "ops_followup_queue",
    execute: executeFollowUpQueueAdapter
  },
  {
    key: "ops_handoff_adapter",
    destinationSystem: "ops_handoff_queue",
    execute: executeOpsHandoffAdapter
  }
];

export function buildPreparedActionDispatchDedupeKey(preparedAction: PersistedPreparedAction): string {
  return `${preparedAction.destinationSystem}:${preparedAction.id}`;
}

export function resolvePreparedActionDispatchAdapterKey(preparedAction: PersistedPreparedAction): string {
  const adapter = dispatchAdapters.find((candidate) => candidate.destinationSystem === preparedAction.destinationSystem);
  if (!adapter) {
    throw new Error(`no dispatch adapter registered for destination ${preparedAction.destinationSystem}`);
  }
  return adapter.key;
}

function resolvePreparedActionDispatchAdapter(preparedAction: PersistedPreparedAction): PreparedActionDispatchAdapter {
  const adapter = dispatchAdapters.find((candidate) => candidate.destinationSystem === preparedAction.destinationSystem);
  if (!adapter) {
    throw new Error(`no dispatch adapter registered for destination ${preparedAction.destinationSystem}`);
  }
  return adapter;
}

export function buildDedupedCopilotExecutionResult(
  previousExecution: CopilotExecutionResult,
  preparedAction: PersistedPreparedAction
): CopilotExecutionResult {
  return {
    ...previousExecution,
    destinationSystem: preparedAction.destinationSystem,
    adapterKey: previousExecution.adapterKey || resolvePreparedActionDispatchAdapterKey(preparedAction),
    dedupeKey: buildPreparedActionDispatchDedupeKey(preparedAction),
    deduped: true
  };
}

export function executePreparedActionWithAdapters(
  input: PreparedActionDispatchExecutionInput
): CopilotExecutionResult {
  const adapter = resolvePreparedActionDispatchAdapter(input.preparedAction);
  const adapterResult = adapter.execute(input);
  const applied = [...adapterResult.applied];

  const task = latestPendingTask(input.snapshot, input.preparedAction.recommendedAction);
  if (task) {
    const updatedTask = input.repository.updateAgentTaskStatus(input.tenantId, task.id, "completed", input.actorId);
    applied.push(mutation("agent_task", updatedTask.id, `task:${updatedTask.type}`, updatedTask.status));
  }

  const updatedPreparedAction = input.repository.updatePreparedActionStatus(input.tenantId, input.preparedAction.id, {
    status: "executed",
    actorId: input.actorId,
    executed: true
  });
  applied.push(
    mutation("prepared_action", updatedPreparedAction.id, `prepared_action:v${updatedPreparedAction.version}`, updatedPreparedAction.status)
  );

  return {
    executed: true,
    recommendationAction: input.preparedAction.recommendedAction,
    destinationSystem: input.preparedAction.destinationSystem,
    adapterKey: adapter.key,
    dedupeKey: buildPreparedActionDispatchDedupeKey(input.preparedAction),
    deduped: false,
    messageUsed: adapterResult.messageUsed,
    applied,
    receipts: adapterResult.receipts,
    executedAt: nowIso()
  };
}
