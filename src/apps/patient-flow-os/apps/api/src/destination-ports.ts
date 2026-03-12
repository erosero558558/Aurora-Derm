import type {
  AgentAction,
  Appointment,
  ConversationThread,
  CopilotExecutionReceipt,
  PatientCaseAction,
  PatientCaseApproval,
  PatientCaseSnapshot,
  PersistedPreparedAction,
  QueueTicket
} from "../../../packages/core/src/index.js";
import type { PlatformRepository } from "./state.js";

function nowIso(): string {
  return new Date().toISOString();
}

function latestAppointment(snapshot: PatientCaseSnapshot): Appointment | undefined {
  return snapshot.appointments
    .slice()
    .sort((left, right) => right.createdAt.localeCompare(left.createdAt))[0];
}

function liveQueueTicket(snapshot: PatientCaseSnapshot): QueueTicket | undefined {
  return snapshot.queueTickets.find((ticket) => ticket.status === "waiting")
    ?? snapshot.queueTickets.find((ticket) => ticket.status === "called")
    ?? snapshot.queueTickets[0];
}

function pendingApproval(snapshot: PatientCaseSnapshot): PatientCaseApproval | undefined {
  return snapshot.approvals.find((approval) => approval.status === "pending");
}

function latestPendingAction(
  snapshot: PatientCaseSnapshot,
  candidates: readonly AgentAction[]
): PatientCaseAction | undefined {
  return snapshot.actions
    .filter((action) => action.status === "pending" && candidates.includes(action.action))
    .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))[0];
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

export interface DispatchPortContext {
  tenantId: string;
  caseId: string;
  snapshot: PatientCaseSnapshot;
  preparedAction: PersistedPreparedAction;
  actorId: string;
}

export interface QueueDispatchPort {
  callNextPatient(input: DispatchPortContext): { ticket: QueueTicket; receipt: CopilotExecutionReceipt };
  startCheckIn(input: DispatchPortContext): { appointment: Appointment; receipt: CopilotExecutionReceipt };
}

export interface MessagingDispatchPort {
  sendOpsMessage(input: DispatchPortContext & {
    body: string;
    channelOverride?: ConversationThread["channel"];
  }): {
    thread: ConversationThread;
    receipt: CopilotExecutionReceipt;
  };
}

export interface SchedulingDispatchPort {
  confirmAppointment(input: DispatchPortContext): {
    appointment: Appointment;
    receipt: CopilotExecutionReceipt;
  };
  requestReschedule(input: DispatchPortContext): {
    appointment: Appointment;
    receipt: CopilotExecutionReceipt;
  };
  recordBookingOptions(input: DispatchPortContext & { rationale: string }): {
    action: PatientCaseAction;
    receipt: CopilotExecutionReceipt;
  };
}

export interface PaymentsDispatchPort {
  recordApprovalFollowUp(input: DispatchPortContext & { rationale: string; messageUsed: string | null }): {
    action: PatientCaseAction;
    approval: PatientCaseApproval;
    receipt: CopilotExecutionReceipt;
  };
}

export interface FollowUpDispatchPort {
  recordFollowUp(input: DispatchPortContext & { rationale: string; messageUsed: string | null }): {
    action: PatientCaseAction;
    receipt: CopilotExecutionReceipt;
  };
}

export interface HandoffDispatchPort {
  createHandoff(input: DispatchPortContext & { rationale: string }): {
    action: PatientCaseAction;
    receipt: CopilotExecutionReceipt;
  };
}

export interface DestinationDispatchPorts {
  queue: QueueDispatchPort;
  messaging: MessagingDispatchPort;
  scheduling: SchedulingDispatchPort;
  payments: PaymentsDispatchPort;
  followUp: FollowUpDispatchPort;
  handoff: HandoffDispatchPort;
}

export function buildPreparedActionPortIdempotencyKey(
  preparedAction: PersistedPreparedAction,
  operation: string
): string {
  return `${preparedAction.destinationSystem}:${preparedAction.id}:${operation}`;
}

function buildReceipt(input: {
  system: string;
  operation: string;
  idempotencyKey: string;
  externalRef: string | null;
  metadata?: Record<string, unknown>;
  status?: "accepted" | "noop";
}): CopilotExecutionReceipt {
  return {
    system: input.system,
    operation: input.operation,
    status: input.status ?? "accepted",
    idempotencyKey: input.idempotencyKey,
    externalRef: input.externalRef,
    recordedAt: nowIso(),
    metadata: input.metadata ?? {}
  };
}

export function createLocalDestinationDispatchPorts(repository: PlatformRepository): DestinationDispatchPorts {
  return {
    queue: {
      callNextPatient(input) {
        const ticket = liveQueueTicket(input.snapshot);
        if (!ticket) {
          throw new Error("queue ticket not found for copilot execution");
        }

        const updatedTicket =
          ticket.status === "waiting"
            ? repository.callQueueTicket(input.tenantId, ticket.id, "staff", input.actorId)
            : ticket;

        return {
          ticket: updatedTicket,
          receipt: buildReceipt({
            system: "queue_console",
            operation: "call_next_patient",
            idempotencyKey: buildPreparedActionPortIdempotencyKey(input.preparedAction, "call_next_patient"),
            externalRef: updatedTicket.id,
            metadata: {
              ticketNumber: updatedTicket.ticketNumber,
              queueStatus: updatedTicket.status
            },
            status: ticket.status === "waiting" ? "accepted" : "noop"
          })
        };
      },
      startCheckIn(input) {
        const appointment = latestAppointment(input.snapshot);
        if (!appointment) {
          throw new Error("appointment not found for copilot execution");
        }

        const updatedAppointment =
          appointment.status === "checked_in"
            ? appointment
            : repository.checkInAppointment(input.tenantId, appointment.id, "staff", input.actorId);

        return {
          appointment: updatedAppointment,
          receipt: buildReceipt({
            system: "queue_console",
            operation: "start_check_in",
            idempotencyKey: buildPreparedActionPortIdempotencyKey(input.preparedAction, "start_check_in"),
            externalRef: updatedAppointment.id,
            metadata: {
              providerName: updatedAppointment.providerName,
              appointmentStatus: updatedAppointment.status
            },
            status: appointment.status === "checked_in" ? "noop" : "accepted"
          })
        };
      }
    },
    messaging: {
      sendOpsMessage(input) {
        const thread = repository.appendConversationMessage(
          input.tenantId,
          input.caseId,
          "staff",
          input.body,
          input.channelOverride
        );
        return {
          thread,
          receipt: buildReceipt({
            system: "patient_messaging",
            operation: "send_ops_message",
            idempotencyKey: buildPreparedActionPortIdempotencyKey(input.preparedAction, "send_ops_message"),
            externalRef: thread.id,
            metadata: {
              channel: thread.channel,
              channelOverride: input.channelOverride ?? null,
              threadStatus: thread.status,
              messageLength: input.body.length
            }
          })
        };
      }
    },
    scheduling: {
      confirmAppointment(input) {
        const appointment = latestAppointment(input.snapshot);
        if (!appointment) {
          throw new Error("appointment not found for copilot execution");
        }

        const updatedAppointment =
          appointment.status === "confirmed"
            ? appointment
            : repository.confirmAppointment(input.tenantId, appointment.id, "staff", input.actorId);

        return {
          appointment: updatedAppointment,
          receipt: buildReceipt({
            system: "scheduling_workbench",
            operation: "confirm_appointment",
            idempotencyKey: buildPreparedActionPortIdempotencyKey(input.preparedAction, "confirm_appointment"),
            externalRef: updatedAppointment.id,
            metadata: {
              providerName: updatedAppointment.providerName,
              appointmentStatus: updatedAppointment.status
            },
            status: appointment.status === "confirmed" ? "noop" : "accepted"
          })
        };
      },
      requestReschedule(input) {
        const appointment = latestAppointment(input.snapshot);
        if (!appointment) {
          throw new Error("appointment not found for copilot execution");
        }

        const updatedAppointment =
          appointment.status === "reschedule_requested"
            ? appointment
            : repository.requestReschedule(input.tenantId, appointment.id, "staff", input.actorId);

        return {
          appointment: updatedAppointment,
          receipt: buildReceipt({
            system: "scheduling_workbench",
            operation: "request_reschedule",
            idempotencyKey: buildPreparedActionPortIdempotencyKey(input.preparedAction, "request_reschedule"),
            externalRef: updatedAppointment.id,
            metadata: {
              providerName: updatedAppointment.providerName,
              appointmentStatus: updatedAppointment.status
            },
            status: appointment.status === "reschedule_requested" ? "noop" : "accepted"
          })
        };
      },
      recordBookingOptions(input) {
        const action = repository.createCaseAction(input.tenantId, input.caseId, {
          action: "send_booking_options",
          title: "Booking options sent by Ops",
          rationale: input.rationale,
          channel: "ops",
          source: "ops",
          status: "completed"
        });

        return {
          action,
          receipt: buildReceipt({
            system: "scheduling_workbench",
            operation: "record_booking_options",
            idempotencyKey: buildPreparedActionPortIdempotencyKey(input.preparedAction, "record_booking_options"),
            externalRef: action.id,
            metadata: {
              actionType: action.action,
              actionStatus: action.status
            }
          })
        };
      }
    },
    payments: {
      recordApprovalFollowUp(input) {
        const approval = pendingApproval(input.snapshot);
        if (!approval) {
          throw new Error("approval not found for copilot execution");
        }

        const existingAction = latestPendingAction(input.snapshot, ["review_approval", "request_payment_followup"]);
        const action = existingAction
          ? repository.updateCaseActionStatus(input.tenantId, input.caseId, existingAction.id, "completed", input.actorId)
          : repository.createCaseAction(input.tenantId, input.caseId, {
              action: input.preparedAction.recommendedAction,
              title:
                input.preparedAction.recommendedAction === "review_approval"
                  ? "Approval reviewed by Ops"
                  : "Payment follow-up sent by Ops",
              rationale: input.messageUsed ?? input.rationale,
              channel: "ops",
              source: "ops",
              status: "completed"
            });

        return {
          action,
          approval,
          receipt: buildReceipt({
            system: "payments_review_queue",
            operation: input.preparedAction.recommendedAction,
            idempotencyKey: buildPreparedActionPortIdempotencyKey(
              input.preparedAction,
              input.preparedAction.recommendedAction
            ),
            externalRef: action.id,
            metadata: {
              approvalId: approval.id,
              approvalType: approval.type,
              actionStatus: action.status
            }
          })
        };
      }
    },
    followUp: {
      recordFollowUp(input) {
        const pendingFollowUp = latestPendingAction(input.snapshot, ["send_follow_up", "recover_no_show"]);
        const action = pendingFollowUp
          ? repository.updateCaseActionStatus(input.tenantId, input.caseId, pendingFollowUp.id, "completed", input.actorId)
          : repository.createCaseAction(input.tenantId, input.caseId, {
              action: "send_follow_up",
              title: "Follow-up sent by Ops",
              rationale: input.messageUsed ?? input.rationale,
              channel: "ops",
              source: "ops",
              status: "completed"
            });

        return {
          action,
          receipt: buildReceipt({
            system: "ops_followup_queue",
            operation: input.preparedAction.recommendedAction,
            idempotencyKey: buildPreparedActionPortIdempotencyKey(
              input.preparedAction,
              input.preparedAction.recommendedAction
            ),
            externalRef: action.id,
            metadata: {
              actionType: action.action,
              actionStatus: action.status
            }
          })
        };
      }
    },
    handoff: {
      createHandoff(input) {
        const existingAction = latestPendingAction(input.snapshot, ["handoff_to_staff"]);
        const action = existingAction
          ?? repository.createCaseAction(input.tenantId, input.caseId, {
            action: "handoff_to_staff",
            title: "Hand off to staff",
            rationale: input.rationale,
            channel: "ops",
            requiresHumanApproval: true,
            source: "ops"
          });

        return {
          action,
          receipt: buildReceipt({
            system: "ops_handoff_queue",
            operation: "handoff_to_staff",
            idempotencyKey: buildPreparedActionPortIdempotencyKey(input.preparedAction, "handoff_to_staff"),
            externalRef: action.id,
            metadata: {
              actionType: action.action,
              actionStatus: action.status
            },
            status: existingAction ? "noop" : "accepted"
          })
        };
      }
    }
  };
}
