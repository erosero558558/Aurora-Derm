import { buildOpsCopilotCaseCard } from "../../ops-console/src/index.js";
import { AgentRuntime, createDefaultAgentRuntime } from "../../../packages/agent-runtime/src/index.js";
import type { OpsCopilotCaseCard } from "../../ops-console/src/index.js";
import type { AgentRuntimeRequest, AgentRuntimeResult } from "../../../packages/agent-runtime/src/index.js";
import type {
  AgentAction,
  AgentTask,
  CopilotExecutionReceiptEvent,
  CopilotExecutionReceiptEventType,
  CopilotExecutionReceiptRecord,
  CopilotEvidenceRef,
  CopilotRecommendation,
  CopilotExecutionResult,
  CopilotReviewDecision,
  Patient,
  PatientCaseSnapshot,
  PreparedActionDispatchJob,
  PersistedPreparedAction,
  PreparedActionPacket
} from "../../../packages/core/src/index.js";
import {
  buildDedupedCopilotExecutionResult,
  buildPreparedActionDispatchDedupeKey,
  executePreparedActionWithAdapters
} from "./dispatch-adapters.js";
import {
  createLocalDestinationDispatchPorts,
  type DestinationDispatchPorts
} from "./destination-ports.js";
import {
  assessDispatchFailure,
  buildDispatchRetryAvailableAt
} from "./provider-runtime.js";
import type { PlatformRepository } from "./state.js";

export interface InspectCaseInput {
  tenantId: string;
  caseId: string;
  input?: string;
}

export interface PatientCaseCopilotInspection extends Omit<AgentRuntimeResult, "preparedAction"> {
  snapshot: PatientCaseSnapshot;
  preparedAction: PersistedPreparedAction;
  card: OpsCopilotCaseCard;
}

export interface PatientCaseCopilotReviewResult extends PatientCaseCopilotInspection {
  review: CopilotReviewDecision;
  execution: CopilotExecutionResult | null;
  dispatchJob: PreparedActionDispatchJob | null;
}

export interface PatientCaseCopilotExecutionDispatchResult extends PatientCaseCopilotInspection {
  execution: CopilotExecutionResult | null;
  dispatchJob: PreparedActionDispatchJob;
}

export interface PatientCaseCopilotReceiptWebhookResult {
  receipt: CopilotExecutionReceiptRecord;
  event: CopilotExecutionReceiptEvent;
  snapshot: PatientCaseSnapshot;
}

export interface PatientCaseProviderExceptionItem {
  tenantId: string;
  patientCaseId: string;
  patientName: string;
  caseStatus: string;
  receiptRecordId: string;
  preparedActionId: string;
  dispatchJobId: string;
  recommendedAction: AgentAction;
  system: string;
  operation: string;
  providerStatus: string;
  lastProviderEventAt: string | null;
  lastProviderError: string | null;
  externalRef: string | null;
  currentChannel: Patient["preferredChannel"] | null;
  suggestedFallbackChannel: Patient["preferredChannel"] | null;
  remediationStatus: ProviderExceptionRemediationStatus;
  remediationPreparedActionId: string | null;
  remediationDispatchJobId: string | null;
  remediationChannelOverride: Patient["preferredChannel"] | null;
  canRetry: boolean;
  canFallback: boolean;
  canEscalate: boolean;
}

export type ProviderExceptionRemediationDecision =
  | "retry_dispatch"
  | "fallback_channel_retry"
  | "escalate_handoff";

export type ProviderExceptionRemediationStatus =
  | "open"
  | "escalated"
  | "retry_queued"
  | "retry_running"
  | "retry_failed"
  | "awaiting_provider_confirmation";

export interface PatientCaseProviderExceptionRemediationResult {
  tenantId: string;
  patientCaseId: string;
  receiptRecordId: string;
  decision: ProviderExceptionRemediationDecision;
  snapshot: PatientCaseSnapshot;
  item: PatientCaseProviderExceptionItem | null;
  remediationPreparedAction: PersistedPreparedAction | null;
  dispatchJob: PreparedActionDispatchJob | null;
}

export interface PatientCaseCopilotDispatchWorkResult {
  tenantId: string;
  patientCaseId: string;
  preparedActionId: string;
  dispatchJob: PreparedActionDispatchJob;
  retryDispatchJob: PreparedActionDispatchJob | null;
  execution: CopilotExecutionResult | null;
  error: string | null;
}

export interface PatientCaseCopilotDispatchDrainResult {
  workerId: string;
  tenantId: string | null;
  claimedCount: number;
  processedCount: number;
  successCount: number;
  failureCount: number;
  items: PatientCaseCopilotDispatchWorkResult[];
}

function recommendationToTaskType(recommendedAction: AgentAction): AgentTask["type"] {
  switch (recommendedAction) {
    case "call_next_patient":
      return "ops_next_best_action";
    case "review_approval":
    case "request_payment_followup":
      return "approval_follow_up";
    case "propose_reschedule":
    case "review_reschedule_queue":
    case "send_booking_options":
      return "reschedule_suggestion";
    case "recover_no_show":
    case "send_follow_up":
      return "no_show_recovery";
    case "handoff_to_staff":
      return "handoff";
    default:
      return "patient_message_draft";
  }
}

const fallbackChannelOrder: readonly Patient["preferredChannel"][] = [
  "whatsapp",
  "sms",
  "email",
  "web"
];

function makeCopilotId(prefix: string): string {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}`;
}

function parseChannel(value: unknown): Patient["preferredChannel"] | null {
  return value === "sms" || value === "whatsapp" || value === "email" || value === "web"
    ? value
    : null;
}

function nextFallbackChannel(
  currentChannel: Patient["preferredChannel"] | null
): Patient["preferredChannel"] | null {
  return fallbackChannelOrder.find((candidate) => candidate !== currentChannel) ?? null;
}

function providerFailureMarker(receiptRecordId: string): string {
  return `[provider_receipt:${receiptRecordId}]`;
}

function hasProviderFailureMarker(
  receiptRecordId: string,
  value: string | null | undefined
): boolean {
  return (value ?? "").includes(providerFailureMarker(receiptRecordId));
}

function actionForProviderFailureEscalation(receipt: CopilotExecutionReceiptRecord): AgentAction {
  switch (receipt.recommendedAction) {
    case "request_payment_followup":
    case "review_approval":
      return "request_payment_followup";
    case "propose_reschedule":
    case "request_reschedule":
    case "send_booking_options":
      return "propose_reschedule";
    case "recover_no_show":
    case "send_follow_up":
      return "send_follow_up";
    default:
      return "handoff_to_staff";
  }
}

function buildProviderFailureEvidence(receipt: CopilotExecutionReceiptRecord): CopilotEvidenceRef[] {
  return [
    {
      kind: "patient_case",
      entityId: receipt.patientCaseId,
      label: `case:${receipt.patientCaseId}`
    },
    {
      kind: "policy",
      entityId: receipt.id,
      label: "provider_receipt_failure"
    }
  ];
}

function buildProviderFailureRecommendation(
  receipt: CopilotExecutionReceiptRecord
): CopilotRecommendation {
  return {
    recommendedAction: "handoff_to_staff",
    intent: "unknown",
    summary: `El provider ${receipt.receipt.system} fallo al confirmar ${receipt.receipt.operation}.`,
    whyNow: `El receipt ${receipt.id} quedo en failed y el case necesita contencion operativa humana.`,
    riskIfIgnored: "El paciente puede quedar sin respuesta o con un flujo operativo inconsistente.",
    confidence: 0.95,
    blockedBy: [`provider:${receipt.receipt.system}`],
    requiresHumanApproval: true,
    degraded: false,
    providerName: `${receipt.receipt.system}_webhook`,
    evidenceRefs: buildProviderFailureEvidence(receipt)
  };
}

function latestAppointmentStatus(snapshot: PatientCaseSnapshot): string | null {
  return snapshot.appointments
    .slice()
    .sort((left, right) => right.createdAt.localeCompare(left.createdAt))[0]?.status ?? null;
}

function hasPendingApproval(snapshot: PatientCaseSnapshot): boolean {
  return snapshot.approvals.some((approval) => approval.status === "pending");
}

function hasPendingPaymentApproval(snapshot: PatientCaseSnapshot): boolean {
  return snapshot.approvals.some(
    (approval) => approval.status === "pending" && approval.type === "payment_review"
  );
}

function hasLiveQueue(snapshot: PatientCaseSnapshot): boolean {
  return snapshot.queueTickets.some((ticket) => ticket.status === "waiting" || ticket.status === "called");
}

function hasPendingAction(snapshot: PatientCaseSnapshot, action: AgentAction): boolean {
  return snapshot.actions.some((candidate) => candidate.action === action && candidate.status === "pending");
}

function priorityForOps(snapshot: PatientCaseSnapshot): number {
  if (snapshot.case.status === "closed") {
    return 0;
  }

  if (hasPendingPaymentApproval(snapshot)) {
    return 100;
  }

  if (hasPendingApproval(snapshot)) {
    return 90;
  }

  if (hasLiveQueue(snapshot) || snapshot.case.status === "queued" || snapshot.case.status === "arrived") {
    return 80;
  }

  if (
    latestAppointmentStatus(snapshot) === "reschedule_requested" ||
    hasPendingAction(snapshot, "request_reschedule")
  ) {
    return 70;
  }

  if (
    latestAppointmentStatus(snapshot) === "no_show" ||
    snapshot.case.status === "follow_up_pending" ||
    hasPendingAction(snapshot, "send_follow_up")
  ) {
    return 60;
  }

  if (snapshot.case.status === "awaiting_booking" || snapshot.case.status === "qualified") {
    return 50;
  }

  if (snapshot.case.status === "booked" || snapshot.case.status === "pre_visit_ready") {
    return 40;
  }

  return 10;
}

function preparedActionFingerprint(
  snapshot: PatientCaseSnapshot,
  recommendation: CopilotRecommendation,
  preparedAction: PreparedActionPacket
): string {
  return JSON.stringify({
    caseId: snapshot.case.id,
    status: snapshot.case.status,
    recommendedAction: recommendation.recommendedAction,
    whyNow: recommendation.whyNow,
    riskIfIgnored: recommendation.riskIfIgnored,
    blockedBy: recommendation.blockedBy,
    evidenceRefs: recommendation.evidenceRefs.map((ref) => `${ref.kind}:${ref.entityId}:${ref.label}`),
    preparedAction: {
      type: preparedAction.type,
      title: preparedAction.title,
      payloadDraft: preparedAction.payloadDraft,
      messageDraft: preparedAction.messageDraft,
      destinationSystem: preparedAction.destinationSystem,
      preconditions: preparedAction.preconditions,
      requiresHumanApproval: preparedAction.requiresHumanApproval
    }
  });
}

function remediationSourceReceiptId(
  preparedAction: PersistedPreparedAction
): string | null {
  const value = preparedAction.payloadDraft.remediatesReceiptRecordId;
  return typeof value === "string" && value.trim().length > 0
    ? value
    : null;
}

function remediationChannelOverride(
  preparedAction: PersistedPreparedAction
): Patient["preferredChannel"] | null {
  return parseChannel(preparedAction.payloadDraft.channelOverride);
}

function stripRemediationPayload(payloadDraft: PersistedPreparedAction["payloadDraft"]): Record<string, unknown> {
  const clone = { ...payloadDraft };
  delete clone.remediatesReceiptRecordId;
  delete clone.remediationDecision;
  delete clone.remediationReceiptSystem;
  delete clone.remediationSourcePreparedActionId;
  delete clone.remediationSourceDispatchJobId;
  delete clone.remediationSourceExternalRef;
  delete clone.channelOverride;
  return clone;
}

function providerExceptionRemediationFingerprint(input: {
  snapshot: PatientCaseSnapshot;
  receipt: CopilotExecutionReceiptRecord;
  packet: PreparedActionPacket;
  decision: ProviderExceptionRemediationDecision;
  fallbackChannel: Patient["preferredChannel"] | null;
}): string {
  return JSON.stringify({
    caseId: input.snapshot.case.id,
    latestActivityAt: input.snapshot.case.latestActivityAt,
    receiptRecordId: input.receipt.id,
    providerSystem: input.receipt.receipt.system,
    decision: input.decision,
    fallbackChannel: input.fallbackChannel,
    recommendedAction: input.packet.recommendedAction,
    destinationSystem: input.packet.destinationSystem,
    payloadDraft: input.packet.payloadDraft,
    messageDraft: input.packet.messageDraft
  });
}

export class PatientCaseCopilotService {
  constructor(
    private readonly repository: PlatformRepository,
    private readonly runtime: AgentRuntime = createDefaultAgentRuntime(),
    private readonly ports: DestinationDispatchPorts = createLocalDestinationDispatchPorts(repository)
  ) {}

  async inspectCase(input: InspectCaseInput): Promise<PatientCaseCopilotInspection> {
    const tenant = this.repository.getTenantById(input.tenantId);
    if (!tenant) {
      throw new Error("tenant not found");
    }

    const snapshot = this.repository.getPatientCaseSnapshot(input.tenantId, input.caseId);
    if (!snapshot) {
      throw new Error("patient case not found");
    }

    const request: AgentRuntimeRequest = {
      mode: "ops",
      tenant,
      input: input.input ?? "What is the next best action for this patient case right now?",
      patientCase: snapshot,
      cases: this.repository.listPatientCaseSnapshots(input.tenantId)
    };
    const result = await this.runtime.run(request);
    const preparedAction = this.repository.savePreparedAction(
      input.tenantId,
      input.caseId,
      result.preparedAction,
      snapshot.case.latestActivityAt,
      preparedActionFingerprint(snapshot, result.recommendation, result.preparedAction)
    );
    const refreshedSnapshot = this.repository.getPatientCaseSnapshot(input.tenantId, input.caseId);
    if (!refreshedSnapshot) {
      throw new Error("patient case not found");
    }
    return {
      snapshot: refreshedSnapshot,
      recommendation: result.recommendation,
      preparedAction,
      card: buildOpsCopilotCaseCard(refreshedSnapshot, result.recommendation, preparedAction)
    };
  }

  inspectOpsFocusCase(input: { tenantId: string; caseId?: string; input?: string }): Promise<PatientCaseCopilotInspection> {
    const snapshot = this.selectOpsFocusCase(input.tenantId, input.caseId);
    return this.inspectCase({
      tenantId: input.tenantId,
      caseId: snapshot.case.id,
      input: input.input
    });
  }

  async materializeRecommendationTask(input: InspectCaseInput): Promise<AgentTask> {
    const inspection = await this.inspectCase(input);
    return this.createRecommendationTask(input.tenantId, input.caseId, inspection);
  }

  async materializeOpsNextBestAction(input: {
    tenantId: string;
    caseId?: string;
    input?: string;
  }): Promise<PatientCaseCopilotInspection & { task: AgentTask }> {
    const inspection = await this.inspectOpsFocusCase(input);
    const task = this.createRecommendationTask(input.tenantId, inspection.snapshot.case.id, inspection);
    const snapshot = this.repository.getPatientCaseSnapshot(input.tenantId, inspection.snapshot.case.id);
    if (!snapshot) {
      throw new Error("patient case not found");
    }

    return {
      snapshot,
      recommendation: inspection.recommendation,
      preparedAction: inspection.preparedAction,
      card: buildOpsCopilotCaseCard(snapshot, inspection.recommendation, inspection.preparedAction),
      task
    };
  }

  recordReviewDecision(
    tenantId: string,
    caseId: string,
    payload: {
      recommendationAction: AgentAction;
      decision: CopilotReviewDecision["decision"];
      actor: string;
      note?: string | null;
      preparedActionId?: string | null;
    }
  ): CopilotReviewDecision {
    return this.repository.recordCopilotReviewDecision(tenantId, caseId, payload);
  }

  async reviewCase(
    tenantId: string,
    caseId: string,
    payload: {
      recommendationAction: AgentAction;
      decision: CopilotReviewDecision["decision"];
      actor: string;
      note?: string | null;
      preparedActionId?: string | null;
      executeNow?: boolean;
      messageOverride?: string | null;
    }
  ): Promise<PatientCaseCopilotReviewResult> {
    const { inspection, preparedAction } = await this.resolveCurrentPreparedAction({
      tenantId,
      caseId,
      preparedActionId: payload.preparedActionId ?? null,
      actorId: payload.actor
    });

    if (inspection.recommendation.recommendedAction !== payload.recommendationAction) {
      throw new Error("stale copilot recommendation for case");
    }

    const review = this.repository.recordCopilotReviewDecision(tenantId, caseId, {
      recommendationAction: payload.recommendationAction,
      decision: payload.decision,
      actor: payload.actor,
      note: payload.note ?? null,
      preparedActionId: preparedAction.id
    });

    const dispatchTrigger =
      payload.decision === "approve" || payload.decision === "edit_and_run"
        ? payload.decision
        : null;
    if (payload.decision === "reject") {
      this.repository.updatePreparedActionStatus(tenantId, preparedAction.id, {
        status: "cancelled",
        actorId: payload.actor,
        staleReason: payload.note ?? "rejected_by_human_review"
      });
    }

    const dispatch = payload.executeNow && dispatchTrigger
      ? this.enqueuePreparedActionDispatch({
          tenantId,
          caseId,
          preparedAction,
          actorId: payload.actor,
          trigger: dispatchTrigger,
          messageOverride: payload.messageOverride ?? null
        })
      : null;

    const refreshed = this.buildInspectionFromCurrentState(
      tenantId,
      caseId,
      inspection.recommendation,
      preparedAction.id
    );
    return {
      snapshot: refreshed.snapshot,
      recommendation: refreshed.recommendation,
      preparedAction: refreshed.preparedAction,
      card: refreshed.card,
      review,
      execution: null,
      dispatchJob:
        dispatch
          ? this.repository.getPreparedActionDispatchJob(tenantId, dispatch.dispatchJob.id) ?? dispatch.dispatchJob
          : null
    };
  }

  async retryPreparedActionExecution(
    tenantId: string,
    caseId: string,
    payload: {
      preparedActionId: string;
      actor: string;
      messageOverride?: string | null;
    }
  ): Promise<PatientCaseCopilotExecutionDispatchResult> {
    const { inspection, preparedAction } = await this.resolveCurrentPreparedAction({
      tenantId,
      caseId,
      preparedActionId: payload.preparedActionId,
      actorId: payload.actor
    });
    const dispatch = this.enqueuePreparedActionDispatch({
      tenantId,
      caseId,
      preparedAction,
      actorId: payload.actor,
      trigger: "retry",
      messageOverride: payload.messageOverride ?? null
    });
    const refreshed = this.buildInspectionFromCurrentState(
      tenantId,
      caseId,
      inspection.recommendation,
      preparedAction.id
    );
    return {
      snapshot: refreshed.snapshot,
      recommendation: refreshed.recommendation,
      preparedAction: refreshed.preparedAction,
      card: refreshed.card,
      execution: null,
      dispatchJob: this.repository.getPreparedActionDispatchJob(tenantId, dispatch.dispatchJob.id) ?? dispatch.dispatchJob
    };
  }

  listProviderExceptions(input: {
    tenantId: string;
    system?: string;
  }): PatientCaseProviderExceptionItem[] {
    return this.repository
      .listCopilotExecutionReceipts(input.tenantId, undefined, {
        system: input.system
      })
      .filter((receipt) => receipt.providerStatus === "failed")
      .map((receipt) => this.buildProviderExceptionItem(receipt))
      .filter((item): item is PatientCaseProviderExceptionItem => item !== null)
      .sort((left, right) => (right.lastProviderEventAt ?? "").localeCompare(left.lastProviderEventAt ?? ""));
  }

  remediateProviderException(
    tenantId: string,
    receiptRecordId: string,
    payload: {
      actor: string;
      decision: ProviderExceptionRemediationDecision;
      fallbackChannel?: Patient["preferredChannel"] | null;
      messageOverride?: string | null;
      note?: string | null;
    }
  ): PatientCaseProviderExceptionRemediationResult {
    const context = this.resolveProviderExceptionContext(tenantId, receiptRecordId);

    if (context.supersededByRemediationOutcome) {
      throw new Error("provider exception has already been superseded by a newer remediation outcome");
    }

    if (
      payload.decision !== "escalate_handoff" &&
      (
        context.remediationStatus === "retry_queued" ||
        context.remediationStatus === "retry_running" ||
        context.remediationStatus === "awaiting_provider_confirmation"
      )
    ) {
      throw new Error("provider exception already has an active remediation in progress");
    }

    if (payload.decision === "fallback_channel_retry") {
      if (context.receipt.receipt.system !== "patient_messaging") {
        throw new Error("fallback channel retry is only available for messaging provider failures");
      }
      if (!payload.fallbackChannel) {
        throw new Error("fallback channel is required for fallback channel retry");
      }
    }

    let remediationPreparedAction: PersistedPreparedAction | null = null;
    let dispatchJob: PreparedActionDispatchJob | null = null;

    if (payload.decision === "escalate_handoff") {
      this.ensureProviderFailureEscalation(context.receipt);
    } else {
      const packet = this.buildProviderExceptionRemediationPreparedAction({
        snapshot: context.snapshot,
        receipt: context.receipt,
        sourcePreparedAction: context.originalPreparedAction,
        decision: payload.decision,
        fallbackChannel: payload.fallbackChannel ?? null,
        messageOverride: payload.messageOverride ?? null
      });
      remediationPreparedAction = this.repository.savePreparedAction(
        tenantId,
        context.receipt.patientCaseId,
        packet,
        context.snapshot.case.latestActivityAt,
        providerExceptionRemediationFingerprint({
          snapshot: context.snapshot,
          receipt: context.receipt,
          packet,
          decision: payload.decision,
          fallbackChannel: payload.fallbackChannel ?? null
        })
      );
      dispatchJob = this.enqueuePreparedActionDispatch({
        tenantId,
        caseId: context.receipt.patientCaseId,
        preparedAction: remediationPreparedAction,
        actorId: payload.actor,
        trigger: "retry",
        messageOverride: payload.messageOverride ?? null
      }).dispatchJob;
    }

    const snapshot = this.repository.getPatientCaseSnapshot(tenantId, context.receipt.patientCaseId);
    if (!snapshot) {
      throw new Error("patient case not found");
    }

    return {
      tenantId,
      patientCaseId: context.receipt.patientCaseId,
      receiptRecordId,
      decision: payload.decision,
      snapshot,
      item: this.buildProviderExceptionItem(context.receipt),
      remediationPreparedAction,
      dispatchJob
    };
  }

  recordReceiptWebhook(
    tenantId: string,
    payload: {
      receiptRecordId?: string;
      preparedActionId?: string;
      dispatchJobId?: string;
      system: string;
      eventType: CopilotExecutionReceiptEventType;
      idempotencyKey?: string;
      externalRef?: string | null;
      payload?: Record<string, unknown>;
      occurredAt?: string | null;
      error?: string | null;
    }
  ): PatientCaseCopilotReceiptWebhookResult {
    const result = this.repository.recordCopilotExecutionReceiptEvent(tenantId, payload);
    this.reconcileReceiptEvent(result.receipt, result.event);
    const snapshot = this.repository.getPatientCaseSnapshot(tenantId, result.receipt.patientCaseId);
    if (!snapshot) {
      throw new Error("patient case not found");
    }
    return {
      receipt: result.receipt,
      event: result.event,
      snapshot
    };
  }

  async drainDispatchQueue(input: {
    tenantId?: string;
    workerId?: string;
    limit?: number;
    leaseTtlMs?: number;
    now?: string;
  }): Promise<PatientCaseCopilotDispatchDrainResult> {
    const workerId = input.workerId?.trim() || "copilot_dispatch_worker";
    const claimedJobs = this.repository.claimPreparedActionDispatchJobs({
      tenantId: input.tenantId,
      workerId,
      limit: input.limit ?? 10,
      leaseTtlMs: input.leaseTtlMs ?? 60_000,
      now: input.now
    });

    const items = claimedJobs.map((dispatchJob) =>
      this.processPreparedActionDispatchJob({
        tenantId: dispatchJob.tenantId,
        dispatchJobId: dispatchJob.id,
        workerId
      })
    );

    return {
      workerId,
      tenantId: input.tenantId ?? null,
      claimedCount: claimedJobs.length,
      processedCount: items.length,
      successCount: items.filter((item) => item.dispatchJob.status === "succeeded").length,
      failureCount: items.filter((item) => item.dispatchJob.status === "failed").length,
      items
    };
  }

  private createRecommendationTask(
    tenantId: string,
    caseId: string,
    inspection: PatientCaseCopilotInspection
  ): AgentTask {
    return this.repository.createAgentTask(
      tenantId,
      caseId,
      recommendationToTaskType(inspection.recommendation.recommendedAction),
      inspection.recommendation,
      inspection.snapshot.case.summary.latestAppointmentId
    );
  }

  private reconcileReceiptEvent(
    receipt: CopilotExecutionReceiptRecord,
    event: CopilotExecutionReceiptEvent
  ): void {
    if (event.providerStatus === "failed") {
      this.ensureProviderFailureEscalation(receipt);
      return;
    }

    if (event.providerStatus === "acknowledged" || event.providerStatus === "delivered") {
      this.resolveProviderFailureEscalation(receipt);
    }
  }

  private ensureProviderFailureEscalation(receipt: CopilotExecutionReceiptRecord): void {
    const snapshot = this.repository.getPatientCaseSnapshot(receipt.tenantId, receipt.patientCaseId);
    if (!snapshot) {
      throw new Error("patient case not found");
    }

    const marker = providerFailureMarker(receipt.id);
    const handoffAction = snapshot.actions.find(
      (action) =>
        action.status === "pending" &&
        action.action === "handoff_to_staff" &&
        hasProviderFailureMarker(receipt.id, action.rationale)
    );

    if (!handoffAction) {
      this.repository.createCaseAction(receipt.tenantId, receipt.patientCaseId, {
        action: "handoff_to_staff",
        title: `Review provider failure from ${receipt.receipt.system}`,
        rationale:
          `Provider ${receipt.receipt.system} failed to confirm ${receipt.receipt.operation}. ${marker}`,
        channel: "ops",
        requiresHumanApproval: true,
        source: "system",
        status: "pending"
      });
    }

    const followUpActionType = actionForProviderFailureEscalation(receipt);
    if (followUpActionType !== "handoff_to_staff") {
      const existingFollowUp = snapshot.actions.find(
        (action) => action.status === "pending" && action.action === followUpActionType
      );
      if (!existingFollowUp) {
        this.repository.createCaseAction(receipt.tenantId, receipt.patientCaseId, {
          action: followUpActionType,
          title: `Retry delivery after ${receipt.receipt.system} failure`,
          rationale:
            `Retry is required because ${receipt.receipt.system} reported a failed delivery for ${receipt.receipt.operation}. ${marker}`,
          channel: "ops",
          requiresHumanApproval: true,
          source: "system",
          status: "pending"
        });
      }
    }

    const handoffTask = snapshot.agentTasks.find(
      (task) =>
        task.status === "pending" &&
        task.type === "handoff" &&
        task.recommendation.evidenceRefs.some(
          (ref) => ref.entityId === receipt.id && ref.label === "provider_receipt_failure"
        )
    );
    if (!handoffTask) {
      this.repository.createAgentTask(
        receipt.tenantId,
        receipt.patientCaseId,
        "handoff",
        buildProviderFailureRecommendation(receipt),
        snapshot.case.summary.latestAppointmentId
      );
    }
  }

  private resolveProviderFailureEscalation(receipt: CopilotExecutionReceiptRecord): void {
    const snapshot = this.repository.getPatientCaseSnapshot(receipt.tenantId, receipt.patientCaseId);
    if (!snapshot) {
      throw new Error("patient case not found");
    }

    const providerFailureActions = snapshot.actions.filter(
      (action) =>
        action.status === "pending" &&
        hasProviderFailureMarker(receipt.id, action.rationale)
    );
    for (const action of providerFailureActions) {
      this.repository.updateCaseActionStatus(
        receipt.tenantId,
        receipt.patientCaseId,
        action.id,
        "completed",
        `${receipt.receipt.system}_webhook`
      );
    }

    const handoffTasks = snapshot.agentTasks.filter(
      (task) =>
        task.status === "pending" &&
        task.type === "handoff" &&
        task.recommendation.evidenceRefs.some(
          (ref) => ref.entityId === receipt.id && ref.label === "provider_receipt_failure"
        )
    );
    for (const task of handoffTasks) {
      this.repository.updateAgentTaskStatus(
        receipt.tenantId,
        task.id,
        "completed",
        `${receipt.receipt.system}_webhook`
      );
    }
  }

  private buildProviderExceptionItem(
    receipt: CopilotExecutionReceiptRecord
  ): PatientCaseProviderExceptionItem | null {
    const lifecycle = this.resolveProviderExceptionLifecycle(receipt);
    if (lifecycle.supersededByRemediationOutcome) {
      return null;
    }

    return {
      tenantId: receipt.tenantId,
      patientCaseId: receipt.patientCaseId,
      patientName: lifecycle.snapshot.patient.displayName,
      caseStatus: lifecycle.snapshot.case.status,
      receiptRecordId: receipt.id,
      preparedActionId: receipt.preparedActionId,
      dispatchJobId: receipt.dispatchJobId,
      recommendedAction: receipt.recommendedAction,
      system: receipt.receipt.system,
      operation: receipt.receipt.operation,
      providerStatus: receipt.providerStatus,
      lastProviderEventAt: receipt.lastProviderEventAt,
      lastProviderError: receipt.lastProviderError,
      externalRef: receipt.receipt.externalRef,
      currentChannel: lifecycle.currentChannel,
      suggestedFallbackChannel: lifecycle.suggestedFallbackChannel,
      remediationStatus: lifecycle.remediationStatus,
      remediationPreparedActionId: lifecycle.remediationPreparedAction?.id ?? null,
      remediationDispatchJobId: lifecycle.remediationDispatchJob?.id ?? null,
      remediationChannelOverride:
        lifecycle.remediationPreparedAction
          ? remediationChannelOverride(lifecycle.remediationPreparedAction)
          : null,
      canRetry:
        lifecycle.remediationStatus === "open" ||
        lifecycle.remediationStatus === "escalated" ||
        lifecycle.remediationStatus === "retry_failed",
      canFallback:
        receipt.receipt.system === "patient_messaging" &&
        (
          lifecycle.remediationStatus === "open" ||
          lifecycle.remediationStatus === "escalated" ||
          lifecycle.remediationStatus === "retry_failed"
        ),
      canEscalate: lifecycle.remediationStatus !== "awaiting_provider_confirmation"
    };
  }

  private resolveProviderExceptionContext(
    tenantId: string,
    receiptRecordId: string
  ): {
    receipt: CopilotExecutionReceiptRecord;
    snapshot: PatientCaseSnapshot;
    originalPreparedAction: PersistedPreparedAction;
    remediationStatus: ProviderExceptionRemediationStatus;
    supersededByRemediationOutcome: boolean;
  } {
    const receipt = this.repository
      .listCopilotExecutionReceipts(tenantId)
      .find((candidate) => candidate.id === receiptRecordId);
    if (!receipt) {
      throw new Error("provider exception receipt not found");
    }
    if (receipt.providerStatus !== "failed") {
      throw new Error("provider exception is no longer failed");
    }

    const originalPreparedAction = this.repository.getPreparedAction(tenantId, receipt.preparedActionId);
    if (!originalPreparedAction) {
      throw new Error("prepared action not found");
    }

    const lifecycle = this.resolveProviderExceptionLifecycle(receipt);
    return {
      receipt,
      snapshot: lifecycle.snapshot,
      originalPreparedAction,
      remediationStatus: lifecycle.remediationStatus,
      supersededByRemediationOutcome: lifecycle.supersededByRemediationOutcome
    };
  }

  private resolveProviderExceptionLifecycle(receipt: CopilotExecutionReceiptRecord): {
    snapshot: PatientCaseSnapshot;
    currentChannel: Patient["preferredChannel"] | null;
    suggestedFallbackChannel: Patient["preferredChannel"] | null;
    remediationStatus: ProviderExceptionRemediationStatus;
    remediationPreparedAction: PersistedPreparedAction | null;
    remediationDispatchJob: PreparedActionDispatchJob | null;
    supersededByRemediationOutcome: boolean;
  } {
    const snapshot = this.repository.getPatientCaseSnapshot(receipt.tenantId, receipt.patientCaseId);
    if (!snapshot) {
      throw new Error("patient case not found");
    }

    const remediationPreparedAction = this.repository
      .listPreparedActions(receipt.tenantId, receipt.patientCaseId)
      .filter((preparedAction) => remediationSourceReceiptId(preparedAction) === receipt.id)
      .sort((left, right) => right.version - left.version)[0] ?? null;
    const remediationDispatchJob = remediationPreparedAction
      ? this.repository
          .listPreparedActionDispatchJobs(receipt.tenantId, receipt.patientCaseId, remediationPreparedAction.id)
          .sort((left, right) => right.requestedAt.localeCompare(left.requestedAt))[0] ?? null
      : null;
    const remediationReceipts = remediationPreparedAction
      ? this.repository
          .listCopilotExecutionReceipts(receipt.tenantId, receipt.patientCaseId, {
            preparedActionId: remediationPreparedAction.id
          })
          .sort((left, right) => (right.lastProviderEventAt ?? right.recordedAt).localeCompare(left.lastProviderEventAt ?? left.recordedAt))
      : [];

    const currentChannel =
      parseChannel(receipt.receipt.metadata.channel) ??
      parseChannel(snapshot.case.summary.lastChannel) ??
      snapshot.patient.preferredChannel;
    const suggestedFallbackChannel = nextFallbackChannel(currentChannel);
    const hasEscalation =
      snapshot.actions.some(
        (action) =>
          action.status === "pending" &&
          action.action === "handoff_to_staff" &&
          hasProviderFailureMarker(receipt.id, action.rationale)
      ) ||
      snapshot.agentTasks.some(
        (task) =>
          task.status === "pending" &&
          task.type === "handoff" &&
          task.recommendation.evidenceRefs.some(
            (ref) => ref.entityId === receipt.id && ref.label === "provider_receipt_failure"
          )
      );
    const latestRemediationReceipt = remediationReceipts[0] ?? null;
    const supersededByRemediationOutcome = remediationReceipts.some(
      (candidate) => candidate.providerStatus !== "pending"
    );

    let remediationStatus: ProviderExceptionRemediationStatus = hasEscalation ? "escalated" : "open";
    if (latestRemediationReceipt?.providerStatus === "pending") {
      remediationStatus = "awaiting_provider_confirmation";
    } else if (!latestRemediationReceipt && remediationDispatchJob?.status === "queued") {
      remediationStatus = "retry_queued";
    } else if (!latestRemediationReceipt && remediationDispatchJob?.status === "running") {
      remediationStatus = "retry_running";
    } else if (!latestRemediationReceipt && remediationDispatchJob?.status === "failed") {
      remediationStatus = "retry_failed";
    }

    return {
      snapshot,
      currentChannel,
      suggestedFallbackChannel,
      remediationStatus,
      remediationPreparedAction,
      remediationDispatchJob,
      supersededByRemediationOutcome
    };
  }

  private buildProviderExceptionRemediationPreparedAction(input: {
    snapshot: PatientCaseSnapshot;
    receipt: CopilotExecutionReceiptRecord;
    sourcePreparedAction: PersistedPreparedAction;
    decision: ProviderExceptionRemediationDecision;
    fallbackChannel: Patient["preferredChannel"] | null;
    messageOverride: string | null;
  }): PreparedActionPacket {
    const payloadDraft: Record<string, unknown> = {
      ...stripRemediationPayload(input.sourcePreparedAction.payloadDraft),
      remediatesReceiptRecordId: input.receipt.id,
      remediationDecision: input.decision,
      remediationReceiptSystem: input.receipt.receipt.system,
      remediationSourcePreparedActionId: input.sourcePreparedAction.id,
      remediationSourceDispatchJobId: input.receipt.dispatchJobId,
      remediationSourceExternalRef: input.receipt.receipt.externalRef
    };
    if (input.decision === "fallback_channel_retry" && input.fallbackChannel) {
      payloadDraft.channelOverride = input.fallbackChannel;
    }

    const retryLabel = input.decision === "fallback_channel_retry" && input.fallbackChannel
      ? `Fallback via ${input.fallbackChannel}`
      : "Provider retry";

    return {
      id: makeCopilotId("prepared"),
      patientCaseId: input.snapshot.case.id,
      type: input.sourcePreparedAction.type,
      recommendedAction: input.sourcePreparedAction.recommendedAction,
      title: `${input.sourcePreparedAction.title} (${retryLabel})`,
      payloadDraft,
      messageDraft: input.messageOverride?.trim() || input.sourcePreparedAction.messageDraft,
      destinationSystem: input.sourcePreparedAction.destinationSystem,
      preconditions: [
        ...input.sourcePreparedAction.preconditions,
        `Retry provider receipt ${input.receipt.id} on ${input.receipt.receipt.system}`
      ],
      requiresHumanApproval: input.sourcePreparedAction.requiresHumanApproval,
      generatedAt: new Date().toISOString()
    };
  }

  private selectOpsFocusCase(tenantId: string, caseId?: string): PatientCaseSnapshot {
    if (caseId) {
      const snapshot = this.repository.getPatientCaseSnapshot(tenantId, caseId);
      if (!snapshot) {
        throw new Error("patient case not found");
      }
      return snapshot;
    }

    const snapshots = this.repository
      .listPatientCaseSnapshots(tenantId)
      .filter((snapshot) => snapshot.case.status !== "closed")
      .sort((left, right) => {
        const priorityDelta = priorityForOps(right) - priorityForOps(left);
        if (priorityDelta !== 0) {
          return priorityDelta;
        }
        return right.case.latestActivityAt.localeCompare(left.case.latestActivityAt);
      });

    const snapshot = snapshots[0];
    if (!snapshot) {
      throw new Error("no active patient cases found");
    }
    return snapshot;
  }

  private async resolveCurrentPreparedAction(input: {
    tenantId: string;
    caseId: string;
    preparedActionId?: string | null;
    actorId: string;
  }): Promise<{
    inspection: PatientCaseCopilotInspection;
    preparedAction: PersistedPreparedAction;
  }> {
    if (!input.preparedActionId) {
      const inspection = await this.inspectCase({
        tenantId: input.tenantId,
        caseId: input.caseId
      });
      return {
        inspection,
        preparedAction: inspection.preparedAction
      };
    }

    const requestedPreparedAction = this.repository.getPreparedAction(input.tenantId, input.preparedActionId);
    if (!requestedPreparedAction) {
      throw new Error("prepared action not found");
    }

    const snapshot = this.repository.getPatientCaseSnapshot(input.tenantId, input.caseId);
    if (!snapshot) {
      throw new Error("patient case not found");
    }

    if (requestedPreparedAction.patientCaseId !== input.caseId) {
      throw new Error("prepared action does not belong to patient case");
    }

    if (snapshot.case.latestActivityAt !== requestedPreparedAction.basisLatestActivityAt) {
      const inspection = await this.inspectCase({
        tenantId: input.tenantId,
        caseId: input.caseId
      });
      if (
        requestedPreparedAction.status === "pending" ||
        (requestedPreparedAction.status === "superseded" &&
          requestedPreparedAction.staleReason === "superseded_by_newer_prepared_action")
      ) {
        this.repository.updatePreparedActionStatus(input.tenantId, requestedPreparedAction.id, {
          status: "stale",
          actorId: input.actorId,
          staleReason: "case_changed_before_review"
        });
      }
      throw new Error("prepared action is stale for the current case state");
    }

    if (requestedPreparedAction.status !== "pending") {
      throw new Error("prepared action is no longer pending");
    }

    const tenant = this.repository.getTenantById(input.tenantId);
    if (!tenant) {
      throw new Error("tenant not found");
    }

    const runtimeResult = await this.runtime.run({
      mode: "ops",
      tenant,
      input: "What is the next best action for this patient case right now?",
      patientCase: snapshot,
      cases: this.repository.listPatientCaseSnapshots(input.tenantId)
    });

    return {
      inspection: {
        snapshot,
        recommendation: runtimeResult.recommendation,
        preparedAction: requestedPreparedAction,
        card: buildOpsCopilotCaseCard(snapshot, runtimeResult.recommendation, requestedPreparedAction)
      },
      preparedAction: requestedPreparedAction
    };
  }

  private buildInspectionFromCurrentState(
    tenantId: string,
    caseId: string,
    recommendation: CopilotRecommendation,
    preparedActionId: string
  ): PatientCaseCopilotInspection {
    const snapshot = this.repository.getPatientCaseSnapshot(tenantId, caseId);
    if (!snapshot) {
      throw new Error("patient case not found");
    }

    const preparedAction = this.repository.getPreparedAction(tenantId, preparedActionId);
    if (!preparedAction) {
      throw new Error("prepared action not found");
    }

    return {
      snapshot,
      recommendation,
      preparedAction,
      card: buildOpsCopilotCaseCard(snapshot, recommendation, preparedAction)
    };
  }

  private enqueuePreparedActionDispatch(input: {
    tenantId: string;
    caseId: string;
    preparedAction: PersistedPreparedAction;
    actorId: string;
    trigger: "approve" | "edit_and_run" | "retry";
    messageOverride: string | null;
  }): {
    dispatchJob: PreparedActionDispatchJob;
  } {
    return {
      dispatchJob: this.repository.createPreparedActionDispatchJob(
        input.tenantId,
        input.caseId,
        input.preparedAction.id,
        {
          trigger: input.trigger,
          actorId: input.actorId,
          messageOverride: input.messageOverride
        }
      )
    };
  }

  private processPreparedActionDispatchJob(input: {
    tenantId: string;
    dispatchJobId: string;
    workerId: string;
  }): PatientCaseCopilotDispatchWorkResult {
    const queuedDispatch = this.repository.getPreparedActionDispatchJob(input.tenantId, input.dispatchJobId);
    if (!queuedDispatch) {
      throw new Error("prepared action dispatch job not found");
    }
    if (queuedDispatch.status !== "running") {
      throw new Error("prepared action dispatch job must be claimed before execution");
    }

    const queuedPreparedAction = this.repository.getPreparedAction(
      input.tenantId,
      queuedDispatch.preparedActionId
    );
    if (!queuedPreparedAction) {
      throw new Error("prepared action not found");
    }

    try {
      // Duplicate jobs for the same prepared action should resolve to the same audited execution.
      const priorExecution = this.findPriorSuccessfulDispatchExecution({
        tenantId: input.tenantId,
        caseId: queuedDispatch.patientCaseId,
        preparedAction: queuedPreparedAction,
        excludeDispatchJobId: queuedDispatch.id
      });
      if (priorExecution) {
        const execution = buildDedupedCopilotExecutionResult(priorExecution, queuedPreparedAction);
        const dispatchJob = this.repository.updatePreparedActionDispatchJob(input.tenantId, queuedDispatch.id, {
          status: "succeeded",
          actorId: input.workerId,
          execution,
          leaseOwner: null,
          leaseExpiresAt: null
        });
        return {
          tenantId: input.tenantId,
          patientCaseId: queuedDispatch.patientCaseId,
          preparedActionId: queuedDispatch.preparedActionId,
          dispatchJob,
          retryDispatchJob: null,
          execution,
          error: null
        };
      }

      const { snapshot, preparedAction } = this.resolvePreparedActionExecutionContext({
        tenantId: input.tenantId,
        caseId: queuedDispatch.patientCaseId,
        preparedActionId: queuedDispatch.preparedActionId,
        actorId: input.workerId
      });
      const execution = executePreparedActionWithAdapters({
        tenantId: input.tenantId,
        caseId: queuedDispatch.patientCaseId,
        snapshot,
        preparedAction,
        actorId: input.workerId,
        messageOverride: queuedDispatch.messageOverride,
        repository: this.repository,
        ports: this.ports
      });
      const dispatchJob = this.repository.updatePreparedActionDispatchJob(input.tenantId, queuedDispatch.id, {
        status: "succeeded",
        actorId: input.workerId,
        execution,
        leaseOwner: null,
        leaseExpiresAt: null
      });
      return {
        tenantId: input.tenantId,
        patientCaseId: queuedDispatch.patientCaseId,
        preparedActionId: queuedDispatch.preparedActionId,
        dispatchJob,
        retryDispatchJob: null,
        execution,
        error: null
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : "prepared action execution failed";
      const retryDispatchJob = this.scheduleRetryDispatchJobOnFailure({
        dispatchJob: queuedDispatch,
        preparedAction: queuedPreparedAction,
        workerId: input.workerId,
        error
      });
      const dispatchJob = this.repository.updatePreparedActionDispatchJob(input.tenantId, queuedDispatch.id, {
        status: "failed",
        actorId: input.workerId,
        lastError: message,
        leaseOwner: null,
        leaseExpiresAt: null
      });
      return {
        tenantId: input.tenantId,
        patientCaseId: queuedDispatch.patientCaseId,
        preparedActionId: queuedDispatch.preparedActionId,
        dispatchJob,
        retryDispatchJob,
        execution: null,
        error: message
      };
    }
  }

  private scheduleRetryDispatchJobOnFailure(input: {
    dispatchJob: PreparedActionDispatchJob;
    preparedAction: PersistedPreparedAction;
    workerId: string;
    error: unknown;
  }): PreparedActionDispatchJob | null {
    const failure = assessDispatchFailure({
      destinationSystem: input.preparedAction.destinationSystem,
      error: input.error
    });
    if (!failure.retryable) {
      return null;
    }

    const nextAttempt = input.dispatchJob.attempt + 1;
    if (nextAttempt > failure.policy.maxAttempts) {
      return null;
    }

    return this.repository.createPreparedActionDispatchJob(
      input.dispatchJob.tenantId,
      input.dispatchJob.patientCaseId,
      input.dispatchJob.preparedActionId,
      {
        trigger: "retry",
        actorId: input.workerId,
        messageOverride: input.dispatchJob.messageOverride,
        availableAt: buildDispatchRetryAvailableAt({
          destinationSystem: input.preparedAction.destinationSystem,
          nextAttempt,
          retryAfterMs: failure.retryAfterMs
        })
      }
    );
  }

  private resolvePreparedActionExecutionContext(input: {
    tenantId: string;
    caseId: string;
    preparedActionId: string;
    actorId: string;
  }): {
    snapshot: PatientCaseSnapshot;
    preparedAction: PersistedPreparedAction;
  } {
    const preparedAction = this.repository.getPreparedAction(input.tenantId, input.preparedActionId);
    if (!preparedAction) {
      throw new Error("prepared action not found");
    }

    const snapshot = this.repository.getPatientCaseSnapshot(input.tenantId, input.caseId);
    if (!snapshot) {
      throw new Error("patient case not found");
    }

    if (preparedAction.patientCaseId !== input.caseId) {
      throw new Error("prepared action does not belong to patient case");
    }

    if (snapshot.case.latestActivityAt !== preparedAction.basisLatestActivityAt) {
      if (
        preparedAction.status === "pending" ||
        (preparedAction.status === "superseded" &&
          preparedAction.staleReason === "superseded_by_newer_prepared_action")
      ) {
        this.repository.updatePreparedActionStatus(input.tenantId, preparedAction.id, {
          status: "stale",
          actorId: input.actorId,
          staleReason: "case_changed_before_execution"
        });
      }
      throw new Error("prepared action is stale for the current case state");
    }

    if (preparedAction.status !== "pending") {
      throw new Error("prepared action is no longer pending");
    }

    return {
      snapshot,
      preparedAction
    };
  }

  private findPriorSuccessfulDispatchExecution(input: {
    tenantId: string;
    caseId: string;
    preparedAction: PersistedPreparedAction;
    excludeDispatchJobId: string;
  }): CopilotExecutionResult | null {
    const dedupeKey = buildPreparedActionDispatchDedupeKey(input.preparedAction);
    const priorDispatches = this.repository
      .listPreparedActionDispatchJobs(input.tenantId, input.caseId, input.preparedAction.id)
      .filter((dispatchJob) => dispatchJob.id !== input.excludeDispatchJobId)
      .filter((dispatchJob) => dispatchJob.status === "succeeded" && dispatchJob.execution !== null)
      .filter((dispatchJob) => {
        const execution = dispatchJob.execution;
        return execution !== null
          && (execution.dedupeKey === dedupeKey
            || execution.dedupeKey === "legacy_execution"
            || execution.destinationSystem === input.preparedAction.destinationSystem);
      })
      .sort((left, right) => {
        const leftOrderKey = left.finishedAt ?? left.startedAt ?? left.requestedAt;
        const rightOrderKey = right.finishedAt ?? right.startedAt ?? right.requestedAt;
        return rightOrderKey.localeCompare(leftOrderKey);
      });

    return priorDispatches[0]?.execution ?? null;
  }
}
