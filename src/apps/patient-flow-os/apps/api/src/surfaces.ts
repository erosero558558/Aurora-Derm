import {
  ClinicDashboardProjectionSchema,
  PatientFlowLinkProjectionSchema,
  WaitRoomDisplayProjectionSchema
} from "../../../packages/core/src/index.js";
import type {
  ClinicDashboardAttentionCase,
  ClinicDashboardProjection,
  KPIReport,
  Location,
  PatientCaseSnapshot,
  PatientFlowLinkProjection,
  WaitRoomDisplayProjection,
  WaitRoomQueueItem
} from "../../../packages/core/src/index.js";

function latestQueueTicket(snapshot: PatientCaseSnapshot, locationId?: string) {
  return snapshot.queueTickets
    .filter((ticket) => !locationId || ticket.locationId === locationId)
    .slice()
    .sort((left, right) => right.createdAt.localeCompare(left.createdAt))[0];
}

function derivePatientNextStep(snapshot: PatientCaseSnapshot): string {
  const pendingApprovals = snapshot.approvals.filter((approval) => approval.status === "pending");
  const liveQueue =
    snapshot.queueTickets.find((ticket) => ticket.status === "called") ??
    snapshot.queueTickets.find((ticket) => ticket.status === "waiting") ??
    null;

  if (pendingApprovals.length > 0) {
    return "An approval is still pending before the case can advance.";
  }
  if (liveQueue?.status === "called") {
    return "Your ticket has been called. Proceed with staff instructions.";
  }
  if (liveQueue?.status === "waiting") {
    return "Stay nearby. The queue is waiting to call your ticket.";
  }

  switch (snapshot.case.status) {
    case "awaiting_booking":
      return "Choose a booking slot to keep the case moving.";
    case "booked":
      return "Arrive on time and complete check-in before the visit.";
    case "arrived":
      return "Front desk check-in is complete. Queue assignment is next.";
    case "queued":
      return "The visit is in queue. Watch for the next call.";
    case "follow_up_pending":
      return "A follow-up action is still open for this case.";
    case "closed":
      return "This case is closed.";
    case "exception":
      return "Operations needs to resolve a blocker on this case.";
    default:
      return "Operations is still progressing this case.";
  }
}

export function buildPatientFlowLinkProjection(
  snapshot: PatientCaseSnapshot
): PatientFlowLinkProjection {
  const liveQueue =
    snapshot.queueTickets.find((ticket) => ticket.status === "called") ??
    snapshot.queueTickets.find((ticket) => ticket.status === "waiting") ??
    null;

  return PatientFlowLinkProjectionSchema.parse({
    tenantId: snapshot.case.tenantId,
    caseId: snapshot.case.id,
    patientName: snapshot.patient.displayName,
    caseStatus: snapshot.case.status,
    serviceLine: snapshot.case.summary.serviceLine,
    providerName: snapshot.case.summary.providerName,
    nextStep: derivePatientNextStep(snapshot),
    lastUpdatedAt: snapshot.case.latestActivityAt,
    liveQueue: liveQueue
      ? {
          locationId: liveQueue.locationId,
          ticketNumber: liveQueue.ticketNumber,
          status: liveQueue.status
        }
      : null,
    pendingApprovals: snapshot.approvals
      .filter((approval) => approval.status === "pending")
      .slice()
      .sort((left, right) => right.createdAt.localeCompare(left.createdAt))
      .map((approval) => ({
        id: approval.id,
        type: approval.type,
        status: approval.status,
        reason: approval.reason,
        createdAt: approval.createdAt
      })),
    openActions: snapshot.actions
      .filter((action) => action.status === "pending" || action.status === "blocked")
      .slice()
      .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))
      .map((action) => ({
        id: action.id,
        action: action.action,
        title: action.title,
        status: action.status,
        channel: action.channel
      })),
    recentTimeline: snapshot.timeline
      .slice()
      .sort((left, right) => right.createdAt.localeCompare(left.createdAt))
      .slice(0, 6)
      .map((event) => ({
        id: event.id,
        type: event.type,
        title: event.title,
        createdAt: event.createdAt
      }))
  });
}

function toWaitRoomQueueItem(snapshot: PatientCaseSnapshot, locationId: string): WaitRoomQueueItem | null {
  const ticket = latestQueueTicket(snapshot, locationId);
  if (!ticket || (ticket.status !== "waiting" && ticket.status !== "called")) {
    return null;
  }

  return {
    caseId: snapshot.case.id,
    patientName: snapshot.patient.displayName,
    ticketNumber: ticket.ticketNumber,
    status: ticket.status,
    serviceLine: snapshot.case.summary.serviceLine,
    providerName: snapshot.case.summary.providerName,
    updatedAt: snapshot.case.latestActivityAt
  };
}

export function buildWaitRoomDisplayProjection(
  tenantId: string,
  location: Location,
  snapshots: PatientCaseSnapshot[]
): WaitRoomDisplayProjection {
  const queueItems = snapshots
    .map((snapshot) => toWaitRoomQueueItem(snapshot, location.id))
    .filter((item): item is WaitRoomQueueItem => Boolean(item));

  const nowCalling =
    queueItems
      .filter((item) => item.status === "called")
      .slice()
      .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))[0] ?? null;
  const waiting = queueItems
    .filter((item) => item.status === "waiting")
    .slice()
    .sort((left, right) => left.ticketNumber.localeCompare(right.ticketNumber));

  return WaitRoomDisplayProjectionSchema.parse({
    tenantId,
    locationId: location.id,
    locationName: location.name,
    waitingRoomName: location.waitingRoomName,
    lastUpdatedAt:
      [nowCalling?.updatedAt ?? null, ...waiting.map((item) => item.updatedAt)]
        .filter((value): value is string => Boolean(value))
        .sort()
        .at(-1) ?? new Date().toISOString(),
    queueDepth: waiting.length + (nowCalling ? 1 : 0),
    nowCalling,
    waiting
  });
}

function toDashboardCaseSummary(snapshot: PatientCaseSnapshot) {
  return {
    caseId: snapshot.case.id,
    patientName: snapshot.patient.displayName,
    status: snapshot.case.status,
    serviceLine: snapshot.case.summary.serviceLine,
    providerName: snapshot.case.summary.providerName,
    latestActivityAt: snapshot.case.latestActivityAt,
    openActionCount: snapshot.case.summary.openActionCount,
    pendingApprovalCount: snapshot.case.summary.pendingApprovalCount
  };
}

function deriveAttentionReason(snapshot: PatientCaseSnapshot): string | null {
  if (snapshot.case.summary.pendingApprovalCount > 0) {
    return "Pending approval is blocking case progression.";
  }
  if (snapshot.case.status === "exception") {
    return "The case is in exception status and needs operations review.";
  }
  if (snapshot.case.status === "follow_up_pending") {
    return "A follow-up is still pending after the visit outcome.";
  }
  if (snapshot.case.status === "awaiting_booking") {
    return "The patient still needs a booking slot.";
  }
  if (snapshot.case.summary.openActionCount > 0) {
    return "There are open actions on the case backlog.";
  }
  return null;
}

export function buildClinicDashboardProjection(
  report: KPIReport,
  snapshots: PatientCaseSnapshot[]
): ClinicDashboardProjection {
  const recentCases = snapshots
    .slice()
    .sort((left, right) => right.case.latestActivityAt.localeCompare(left.case.latestActivityAt))
    .slice(0, 6)
    .map((snapshot) => toDashboardCaseSummary(snapshot));

  const attentionCases: ClinicDashboardAttentionCase[] = snapshots
    .map((snapshot) => {
      const reason = deriveAttentionReason(snapshot);
      return reason ? { ...toDashboardCaseSummary(snapshot), reason } : null;
    })
    .filter((item): item is ClinicDashboardAttentionCase => Boolean(item))
    .slice(0, 6);

  return ClinicDashboardProjectionSchema.parse({
    tenantId: report.tenantId,
    generatedAt: report.generatedAt,
    kpi: report,
    recentCases,
    attentionCases
  });
}
