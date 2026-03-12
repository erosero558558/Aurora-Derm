import type { AgentAction, PatientIntent, PreparedActionType } from "./contracts.js";

const allowedPatientActions = new Set<AgentAction>([
  "confirm_appointment",
  "request_reschedule",
  "start_check_in",
  "show_queue_status",
  "answer_operational_faq",
  "handoff_to_staff"
]);

const sensitiveActions = new Set<AgentAction>([
  "review_approval",
  "propose_reschedule",
  "request_payment_followup",
  "send_booking_options",
  "recover_no_show",
  "cancel_appointment",
  "reassign_provider",
  "mass_reschedule"
]);

const operationalPatientIntents = new Set<PatientIntent>([
  "confirm_appointment",
  "request_reschedule",
  "start_check_in",
  "track_queue_status",
  "faq_operational"
]);

const preparedActionTypeByAction: Record<AgentAction, PreparedActionType> = {
  confirm_appointment: "schedule",
  request_reschedule: "schedule",
  start_check_in: "queue",
  show_queue_status: "queue",
  answer_operational_faq: "handoff",
  call_next_patient: "queue",
  review_approval: "handoff",
  propose_reschedule: "schedule",
  request_payment_followup: "payment",
  send_booking_options: "schedule",
  recover_no_show: "follow_up",
  review_reschedule_queue: "schedule",
  send_follow_up: "follow_up",
  handoff_to_staff: "handoff",
  cancel_appointment: "schedule",
  reassign_provider: "schedule",
  mass_reschedule: "schedule"
};

export function isAllowedPatientAction(action: AgentAction): boolean {
  return allowedPatientActions.has(action);
}

export function requiresHumanApproval(action: AgentAction): boolean {
  return sensitiveActions.has(action);
}

export function isOperationalPatientIntent(intent: PatientIntent): boolean {
  return operationalPatientIntents.has(intent);
}

export function preparedActionTypeForAction(action: AgentAction): PreparedActionType {
  return preparedActionTypeByAction[action];
}
