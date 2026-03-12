import { z } from "zod";

export const TimestampSchema = z.string().min(1);
export const ChannelSchema = z.enum(["sms", "whatsapp", "email", "web"]);
export const SurfaceSchema = z.enum([
  "ops_console",
  "patient_flow_link",
  "wait_room_display",
  "clinic_dashboard"
]);
export const CaseChannelSchema = z.enum(["sms", "whatsapp", "email", "web", "internal", "ops"]);
export const TenantProviderDispatchModeSchema = z.enum(["stub", "relay"]);
export const TenantProviderWebhookAuthModeSchema = z.enum(["none", "hmac_sha256"]);
export const TenantProviderBindingStatusSchema = z.enum(["active", "disabled"]);
export const TenantProviderDispatchHealthStateSchema = z.enum(["ready", "degraded", "blocked"]);
export const TenantProviderSecretSourceSchema = z.enum([
  "disabled",
  "tenant_system_env",
  "binding_env_var",
  "binding_secret_ref",
  "derived_local_fallback"
]);

export const TenantProviderBindingSchema = z.object({
  system: z.string().min(1),
  providerKey: z.string().min(1),
  label: z.string().min(1),
  credentialRef: z.string().nullable().default(null),
  dispatchMode: TenantProviderDispatchModeSchema.default("stub"),
  senderProfile: z.string().nullable().default(null),
  webhookAuthMode: TenantProviderWebhookAuthModeSchema.default("hmac_sha256"),
  webhookSecretRef: z.string().nullable().default(null),
  webhookSecretEnvVar: z.string().nullable().default(null),
  webhookPath: z.string().nullable().default(null),
  endpointBaseUrl: z.string().nullable().default(null),
  status: TenantProviderBindingStatusSchema.default("active")
});

export const TenantProviderRuntimeBindingSchema = TenantProviderBindingSchema.extend({
  usesFallbackBinding: z.boolean(),
  usesFallbackSecret: z.boolean(),
  resolvedSecretSource: TenantProviderSecretSourceSchema,
  isWebhookEnabled: z.boolean(),
  dispatchHealthState: TenantProviderDispatchHealthStateSchema,
  dispatchIssues: z.array(z.string()),
  dispatchReady: z.boolean()
});

export const TenantConfigSchema = z.object({
  id: z.string().min(1),
  slug: z.string().min(1),
  name: z.string().min(1),
  timezone: z.string().min(1),
  brandColor: z.string().min(1),
  enabledChannels: z.array(ChannelSchema),
  credentialRefs: z.array(z.string()),
  providerBindings: z.array(TenantProviderBindingSchema).default([]),
  createdAt: TimestampSchema
});

export const LocationSchema = z.object({
  id: z.string().min(1),
  tenantId: z.string().min(1),
  slug: z.string().min(1),
  name: z.string().min(1),
  waitingRoomName: z.string().min(1),
  createdAt: TimestampSchema
});

export const StaffRoleSchema = z.enum(["admin", "front_desk", "manager"]);
export const StaffUserSchema = z.object({
  id: z.string().min(1),
  tenantId: z.string().min(1),
  locationId: z.string().min(1),
  name: z.string().min(1),
  role: StaffRoleSchema,
  email: z.string().min(1),
  createdAt: TimestampSchema
});

export const PatientSchema = z.object({
  id: z.string().min(1),
  tenantId: z.string().min(1),
  displayName: z.string().min(1),
  phone: z.string().min(1),
  email: z.string().nullable(),
  preferredChannel: ChannelSchema,
  createdAt: TimestampSchema
});

export const PatientCaseStatusSchema = z.enum([
  "intake",
  "qualified",
  "awaiting_booking",
  "booked",
  "pre_visit_ready",
  "arrived",
  "queued",
  "in_consult",
  "follow_up_pending",
  "closed",
  "exception"
]);

export const PatientCaseStatusSourceSchema = z.enum(["derived", "manual"]);

export const PatientCaseSummarySchema = z.object({
  primaryAppointmentId: z.string().nullable(),
  latestAppointmentId: z.string().nullable(),
  latestThreadId: z.string().nullable(),
  latestCallbackId: z.string().nullable(),
  serviceLine: z.string().nullable(),
  providerName: z.string().nullable(),
  scheduledStart: z.string().nullable(),
  scheduledEnd: z.string().nullable(),
  queueStatus: z.string().nullable(),
  lastChannel: z.string().nullable(),
  openActionCount: z.number().int().nonnegative(),
  pendingApprovalCount: z.number().int().nonnegative()
});

export const PatientCaseSchema = z.object({
  id: z.string().min(1),
  tenantId: z.string().min(1),
  patientId: z.string().min(1),
  status: PatientCaseStatusSchema,
  statusSource: PatientCaseStatusSourceSchema,
  openedAt: TimestampSchema,
  latestActivityAt: TimestampSchema,
  closedAt: z.string().nullable(),
  lastInboundAt: z.string().nullable(),
  lastOutboundAt: z.string().nullable(),
  summary: PatientCaseSummarySchema
});

export const PatientCaseLinkEntitySchema = z.enum([
  "appointment",
  "queue_ticket",
  "conversation_thread",
  "agent_task",
  "prepared_action",
  "prepared_action_dispatch",
  "flow_event",
  "callback",
  "telemedicine_intake",
  "copilot_review"
]);

export const PatientCaseLinkRelationshipSchema = z.enum(["primary", "secondary", "derived"]);

export const PatientCaseLinkSchema = z.object({
  id: z.string().min(1),
  tenantId: z.string().min(1),
  patientCaseId: z.string().min(1),
  entityType: PatientCaseLinkEntitySchema,
  entityId: z.string().min(1),
  relationship: PatientCaseLinkRelationshipSchema,
  createdAt: TimestampSchema
});

export const PatientCaseTimelineEventTypeSchema = z.enum([
  "case_opened",
  "callback_created",
  "appointment_created",
  "appointment_confirmed",
  "reschedule_requested",
  "check_in_completed",
  "queue_called",
  "visit_completed",
  "no_show",
  "follow_up_requested",
  "message_received",
  "message_sent",
  "approval_requested",
  "approval_resolved",
  "status_changed",
  "copilot_recommended",
  "copilot_prepared",
  "copilot_dispatch_queued",
  "copilot_dispatch_failed",
  "copilot_executed",
  "copilot_reviewed",
  "copilot_receipt_updated",
  "imported_from_openclaw"
]);

export const PatientCaseTimelineEventSchema = z.object({
  id: z.string().min(1),
  tenantId: z.string().min(1),
  patientCaseId: z.string().min(1),
  type: PatientCaseTimelineEventTypeSchema,
  title: z.string().min(1),
  payload: z.record(z.string(), z.unknown()),
  createdAt: TimestampSchema
});

export const PatientIntentSchema = z.enum([
  "confirm_appointment",
  "request_reschedule",
  "start_check_in",
  "track_queue_status",
  "faq_operational",
  "unknown"
]);

export const AgentActionSchema = z.enum([
  "confirm_appointment",
  "request_reschedule",
  "start_check_in",
  "show_queue_status",
  "answer_operational_faq",
  "call_next_patient",
  "review_approval",
  "propose_reschedule",
  "request_payment_followup",
  "send_booking_options",
  "recover_no_show",
  "review_reschedule_queue",
  "send_follow_up",
  "handoff_to_staff",
  "cancel_appointment",
  "reassign_provider",
  "mass_reschedule"
]);

export const PatientCaseActionStatusSchema = z.enum(["pending", "approved", "completed", "blocked", "cancelled"]);
export const PatientCaseActionSourceSchema = z.enum(["patient", "agent", "ops", "system"]);

export const PatientCaseActionSchema = z.object({
  id: z.string().min(1),
  tenantId: z.string().min(1),
  patientCaseId: z.string().min(1),
  action: AgentActionSchema,
  title: z.string().min(1),
  status: PatientCaseActionStatusSchema,
  channel: CaseChannelSchema,
  rationale: z.string().min(1),
  requiresHumanApproval: z.boolean(),
  source: PatientCaseActionSourceSchema,
  createdAt: TimestampSchema,
  updatedAt: TimestampSchema,
  completedAt: z.string().nullable()
});

export const PatientCaseApprovalTypeSchema = z.enum(["payment_review", "clinical_review", "ops_exception"]);
export const PatientCaseApprovalStatusSchema = z.enum(["pending", "approved", "rejected"]);

export const PatientCaseApprovalSchema = z.object({
  id: z.string().min(1),
  tenantId: z.string().min(1),
  patientCaseId: z.string().min(1),
  type: PatientCaseApprovalTypeSchema,
  status: PatientCaseApprovalStatusSchema,
  reason: z.string().min(1),
  requestedBy: z.string().min(1),
  resolvedBy: z.string().nullable(),
  resolutionNotes: z.string().nullable(),
  createdAt: TimestampSchema,
  updatedAt: TimestampSchema,
  resolvedAt: z.string().nullable()
});

export const AppointmentStatusSchema = z.enum([
  "scheduled",
  "confirmed",
  "reschedule_requested",
  "checked_in",
  "in_queue",
  "called",
  "completed",
  "no_show",
  "cancelled"
]);

export const AppointmentSchema = z.object({
  id: z.string().min(1),
  tenantId: z.string().min(1),
  patientCaseId: z.string().min(1),
  locationId: z.string().min(1),
  patientId: z.string().min(1),
  providerName: z.string().min(1),
  serviceLine: z.string().min(1),
  status: AppointmentStatusSchema,
  scheduledStart: TimestampSchema,
  scheduledEnd: TimestampSchema,
  createdAt: TimestampSchema
});

export const FlowEventTypeSchema = z.enum([
  "appointment_created",
  "reminder_sent",
  "patient_confirmed",
  "reschedule_requested",
  "check_in_completed",
  "queue_called",
  "visit_completed",
  "no_show",
  "followup_triggered",
  "callback_created",
  "approval_requested",
  "approval_resolved"
]);

export const FlowEventSchema = z.object({
  id: z.string().min(1),
  tenantId: z.string().min(1),
  patientCaseId: z.string().min(1),
  appointmentId: z.string().nullable(),
  type: FlowEventTypeSchema,
  payload: z.record(z.string(), z.unknown()),
  createdAt: TimestampSchema
});

export const QueueTicketStatusSchema = z.enum(["waiting", "called", "completed", "no_show"]);

export const QueueTicketSchema = z.object({
  id: z.string().min(1),
  tenantId: z.string().min(1),
  patientCaseId: z.string().min(1),
  locationId: z.string().min(1),
  appointmentId: z.string().nullable(),
  patientLabel: z.string().min(1),
  ticketNumber: z.string().min(1),
  status: QueueTicketStatusSchema,
  createdAt: TimestampSchema
});

export const ConversationMessageRoleSchema = z.enum(["patient", "agent", "staff"]);
export const ConversationMessageSchema = z.object({
  id: z.string().min(1),
  role: ConversationMessageRoleSchema,
  body: z.string().min(1),
  createdAt: TimestampSchema
});

export const ConversationThreadStatusSchema = z.enum(["open", "handoff", "resolved"]);
export const ConversationThreadSchema = z.object({
  id: z.string().min(1),
  tenantId: z.string().min(1),
  patientCaseId: z.string().min(1),
  appointmentId: z.string().nullable(),
  channel: ChannelSchema,
  status: ConversationThreadStatusSchema,
  messages: z.array(ConversationMessageSchema),
  createdAt: TimestampSchema
});

export const CopilotEvidenceRefKindSchema = z.enum([
  "patient_case",
  "appointment",
  "approval",
  "action",
  "queue_ticket",
  "thread",
  "timeline_event",
  "policy"
]);

export const CopilotEvidenceRefSchema = z.object({
  kind: CopilotEvidenceRefKindSchema,
  entityId: z.string().min(1),
  label: z.string().min(1)
});

export const CopilotRecommendationSchema = z.object({
  recommendedAction: AgentActionSchema,
  intent: PatientIntentSchema,
  summary: z.string().min(1),
  whyNow: z.string().min(1),
  riskIfIgnored: z.string().min(1),
  confidence: z.number().min(0).max(1),
  blockedBy: z.array(z.string()),
  requiresHumanApproval: z.boolean(),
  degraded: z.boolean(),
  providerName: z.string().min(1),
  evidenceRefs: z.array(CopilotEvidenceRefSchema)
});

export const AgentRecommendationSchema = CopilotRecommendationSchema;

export const PreparedActionTypeSchema = z.enum([
  "queue",
  "schedule",
  "payment",
  "follow_up",
  "handoff"
]);

export const PreparedActionPacketSchema = z.object({
  id: z.string().min(1),
  patientCaseId: z.string().min(1),
  type: PreparedActionTypeSchema,
  recommendedAction: AgentActionSchema,
  title: z.string().min(1),
  payloadDraft: z.record(z.string(), z.unknown()),
  messageDraft: z.string().nullable(),
  destinationSystem: z.string().min(1),
  preconditions: z.array(z.string()),
  requiresHumanApproval: z.boolean(),
  generatedAt: TimestampSchema
});

export const PreparedActionStatusSchema = z.enum([
  "pending",
  "executed",
  "superseded",
  "stale",
  "cancelled"
]);

export const PersistedPreparedActionSchema = PreparedActionPacketSchema.extend({
  tenantId: z.string().min(1),
  version: z.number().int().positive(),
  status: PreparedActionStatusSchema,
  fingerprint: z.string().min(1),
  basisLatestActivityAt: TimestampSchema,
  executionCount: z.number().int().nonnegative(),
  staleReason: z.string().nullable(),
  createdAt: TimestampSchema,
  updatedAt: TimestampSchema,
  executedAt: z.string().nullable()
});

export const PreparedActionDispatchTriggerSchema = z.enum(["approve", "edit_and_run", "retry"]);

export const PreparedActionDispatchStatusSchema = z.enum([
  "queued",
  "running",
  "succeeded",
  "failed"
]);

export const PreparedActionDispatchJobSchema = z.object({
  id: z.string().min(1),
  tenantId: z.string().min(1),
  patientCaseId: z.string().min(1),
  preparedActionId: z.string().min(1),
  trigger: PreparedActionDispatchTriggerSchema,
  status: PreparedActionDispatchStatusSchema,
  actorId: z.string().min(1),
  attempt: z.number().int().positive(),
  messageOverride: z.string().nullable(),
  lastError: z.string().nullable(),
  execution: z.lazy(() => CopilotExecutionResultSchema).nullable(),
  requestedAt: TimestampSchema,
  availableAt: TimestampSchema,
  leaseOwner: z.string().nullable(),
  leaseExpiresAt: z.string().nullable(),
  startedAt: z.string().nullable(),
  finishedAt: z.string().nullable()
});

export const CopilotReviewDecisionKindSchema = z.enum(["approve", "edit_and_run", "reject", "snooze"]);

export const CopilotReviewDecisionSchema = z.object({
  id: z.string().min(1),
  tenantId: z.string().min(1),
  patientCaseId: z.string().min(1),
  recommendationAction: AgentActionSchema,
  decision: CopilotReviewDecisionKindSchema,
  actor: z.string().min(1),
  timestamp: TimestampSchema,
  note: z.string().nullable(),
  preparedActionId: z.string().nullable()
});

export const CopilotExecutionMutationKindSchema = z.enum([
  "appointment",
  "queue_ticket",
  "conversation_thread",
  "agent_task",
  "prepared_action",
  "patient_case_action",
  "patient_case_approval",
  "patient_case"
]);

export const CopilotExecutionMutationSchema = z.object({
  kind: CopilotExecutionMutationKindSchema,
  entityId: z.string().min(1),
  label: z.string().min(1),
  status: z.string().nullable().optional()
});

export const CopilotExecutionReceiptStatusSchema = z.enum(["accepted", "noop"]);
export const CopilotExecutionReceiptProviderStatusSchema = z.enum([
  "pending",
  "acknowledged",
  "delivered",
  "failed"
]);
export const CopilotExecutionReceiptEventTypeSchema = z.enum([
  "acknowledged",
  "delivered",
  "failed"
]);

export const CopilotExecutionReceiptSchema = z.object({
  system: z.string().min(1),
  operation: z.string().min(1),
  status: CopilotExecutionReceiptStatusSchema,
  idempotencyKey: z.string().min(1),
  externalRef: z.string().nullable(),
  recordedAt: TimestampSchema,
  metadata: z.record(z.string(), z.unknown())
});

export const CopilotExecutionResultSchema = z.object({
  executed: z.boolean(),
  recommendationAction: AgentActionSchema,
  destinationSystem: z.string().min(1).default("unknown_destination"),
  adapterKey: z.string().min(1).default("legacy_executor"),
  dedupeKey: z.string().min(1).default("legacy_execution"),
  deduped: z.boolean().default(false),
  messageUsed: z.string().nullable(),
  applied: z.array(CopilotExecutionMutationSchema),
  receipts: z.array(CopilotExecutionReceiptSchema).default([]),
  executedAt: TimestampSchema
});

export const CopilotExecutionReceiptRecordSchema = z.object({
  id: z.string().min(1),
  tenantId: z.string().min(1),
  patientCaseId: z.string().min(1),
  preparedActionId: z.string().min(1),
  dispatchJobId: z.string().min(1),
  attempt: z.number().int().positive(),
  actorId: z.string().min(1),
  recommendedAction: AgentActionSchema,
  destinationSystem: z.string().min(1),
  adapterKey: z.string().min(1),
  deduped: z.boolean(),
  providerStatus: CopilotExecutionReceiptProviderStatusSchema,
  providerConfirmedAt: TimestampSchema.nullable(),
  lastProviderEventAt: TimestampSchema.nullable(),
  lastProviderError: z.string().nullable(),
  receipt: CopilotExecutionReceiptSchema,
  recordedAt: TimestampSchema
});

export const CopilotExecutionReceiptEventSchema = z.object({
  id: z.string().min(1),
  tenantId: z.string().min(1),
  patientCaseId: z.string().min(1),
  preparedActionId: z.string().min(1),
  dispatchJobId: z.string().min(1),
  receiptRecordId: z.string().min(1),
  system: z.string().min(1),
  eventType: CopilotExecutionReceiptEventTypeSchema,
  providerStatus: CopilotExecutionReceiptProviderStatusSchema,
  idempotencyKey: z.string().min(1),
  externalRef: z.string().nullable(),
  payload: z.record(z.string(), z.unknown()),
  occurredAt: TimestampSchema,
  recordedAt: TimestampSchema
});

export const AgentTaskTypeSchema = z.enum([
  "ops_next_best_action",
  "patient_message_draft",
  "handoff",
  "no_show_recovery",
  "reschedule_suggestion",
  "approval_follow_up"
]);

export const AgentTaskStatusSchema = z.enum(["pending", "approved", "completed", "blocked"]);

export const AgentTaskSchema = z.object({
  id: z.string().min(1),
  tenantId: z.string().min(1),
  patientCaseId: z.string().min(1),
  appointmentId: z.string().nullable(),
  type: AgentTaskTypeSchema,
  status: AgentTaskStatusSchema,
  recommendation: CopilotRecommendationSchema,
  createdAt: TimestampSchema
});

export const CallbackStatusSchema = z.enum(["new", "qualified", "contacted", "closed"]);
export const CallbackLeadSchema = z.object({
  id: z.string().min(1),
  tenantId: z.string().min(1),
  patientCaseId: z.string().min(1),
  patientId: z.string().min(1),
  channel: ChannelSchema,
  notes: z.string().min(1),
  status: CallbackStatusSchema,
  createdAt: TimestampSchema
});

export const PlaybookSchema = z.object({
  id: z.string().min(1),
  tenantId: z.string().min(1),
  name: z.string().min(1),
  triggerKey: z.string().min(1),
  isEnabled: z.boolean(),
  config: z.record(z.string(), z.unknown()),
  createdAt: TimestampSchema
});

export const AuditEntrySchema = z.object({
  id: z.string().min(1),
  tenantId: z.string().min(1),
  actorType: z.enum(["system", "agent", "staff", "patient"]),
  actorId: z.string().min(1),
  action: z.string().min(1),
  entityType: z.string().min(1),
  entityId: z.string().min(1),
  metadata: z.record(z.string(), z.unknown()),
  createdAt: TimestampSchema
});

export const KPIReportSchema = z.object({
  tenantId: z.string().min(1),
  generatedAt: TimestampSchema,
  activeCases: z.number().int().nonnegative(),
  appointmentsScheduled: z.number().int().nonnegative(),
  appointmentsConfirmed: z.number().int().nonnegative(),
  checkedIn: z.number().int().nonnegative(),
  completed: z.number().int().nonnegative(),
  noShow: z.number().int().nonnegative(),
  waiting: z.number().int().nonnegative(),
  called: z.number().int().nonnegative(),
  handoffOpen: z.number().int().nonnegative(),
  casesRequiringApproval: z.number().int().nonnegative(),
  followUpPending: z.number().int().nonnegative()
});

export const PatientFlowLinkApprovalSchema = PatientCaseApprovalSchema.pick({
  id: true,
  type: true,
  status: true,
  reason: true,
  createdAt: true
});

export const PatientFlowLinkActionSchema = PatientCaseActionSchema.pick({
  id: true,
  action: true,
  title: true,
  status: true,
  channel: true
});

export const PatientFlowLinkTimelineItemSchema = PatientCaseTimelineEventSchema.pick({
  id: true,
  type: true,
  title: true,
  createdAt: true
});

export const PatientFlowLinkQueueSchema = z.object({
  locationId: z.string().min(1),
  ticketNumber: z.string().min(1),
  status: QueueTicketStatusSchema
});

export const PatientFlowLinkProjectionSchema = z.object({
  tenantId: z.string().min(1),
  caseId: z.string().min(1),
  patientName: z.string().min(1),
  caseStatus: PatientCaseStatusSchema,
  serviceLine: z.string().nullable(),
  providerName: z.string().nullable(),
  nextStep: z.string().min(1),
  lastUpdatedAt: TimestampSchema,
  liveQueue: PatientFlowLinkQueueSchema.nullable(),
  pendingApprovals: z.array(PatientFlowLinkApprovalSchema),
  openActions: z.array(PatientFlowLinkActionSchema),
  recentTimeline: z.array(PatientFlowLinkTimelineItemSchema)
});

export const WaitRoomQueueItemSchema = z.object({
  caseId: z.string().min(1),
  patientName: z.string().min(1),
  ticketNumber: z.string().min(1),
  status: QueueTicketStatusSchema,
  serviceLine: z.string().nullable(),
  providerName: z.string().nullable(),
  updatedAt: TimestampSchema
});

export const WaitRoomDisplayProjectionSchema = z.object({
  tenantId: z.string().min(1),
  locationId: z.string().min(1),
  locationName: z.string().min(1),
  waitingRoomName: z.string().min(1),
  lastUpdatedAt: TimestampSchema,
  queueDepth: z.number().int().nonnegative(),
  nowCalling: WaitRoomQueueItemSchema.nullable(),
  waiting: z.array(WaitRoomQueueItemSchema)
});

export const ClinicDashboardCaseSummarySchema = z.object({
  caseId: z.string().min(1),
  patientName: z.string().min(1),
  status: PatientCaseStatusSchema,
  serviceLine: z.string().nullable(),
  providerName: z.string().nullable(),
  latestActivityAt: TimestampSchema,
  openActionCount: z.number().int().nonnegative(),
  pendingApprovalCount: z.number().int().nonnegative()
});

export const ClinicDashboardAttentionCaseSchema = ClinicDashboardCaseSummarySchema.extend({
  reason: z.string().min(1)
});

export const ClinicDashboardProjectionSchema = z.object({
  tenantId: z.string().min(1),
  generatedAt: TimestampSchema,
  kpi: KPIReportSchema,
  recentCases: z.array(ClinicDashboardCaseSummarySchema),
  attentionCases: z.array(ClinicDashboardAttentionCaseSchema)
});

export const PatientCaseSnapshotSchema = z.object({
  case: PatientCaseSchema,
  patient: PatientSchema,
  appointments: z.array(AppointmentSchema),
  queueTickets: z.array(QueueTicketSchema),
  conversationThreads: z.array(ConversationThreadSchema),
  callbacks: z.array(CallbackLeadSchema),
  agentTasks: z.array(AgentTaskSchema),
  preparedActions: z.array(PersistedPreparedActionSchema),
  preparedActionDispatchJobs: z.array(PreparedActionDispatchJobSchema),
  copilotExecutionReceipts: z.array(CopilotExecutionReceiptRecordSchema),
  copilotExecutionReceiptEvents: z.array(CopilotExecutionReceiptEventSchema),
  timeline: z.array(PatientCaseTimelineEventSchema),
  actions: z.array(PatientCaseActionSchema),
  approvals: z.array(PatientCaseApprovalSchema),
  links: z.array(PatientCaseLinkSchema),
  copilotReviewDecisions: z.array(CopilotReviewDecisionSchema)
});

export const BootstrapStateSchema = z.object({
  tenantConfigs: z.array(TenantConfigSchema),
  locations: z.array(LocationSchema),
  staffUsers: z.array(StaffUserSchema),
  patients: z.array(PatientSchema),
  patientCases: z.array(PatientCaseSchema),
  patientCaseLinks: z.array(PatientCaseLinkSchema),
  patientCaseTimelineEvents: z.array(PatientCaseTimelineEventSchema),
  patientCaseActions: z.array(PatientCaseActionSchema),
  patientCaseApprovals: z.array(PatientCaseApprovalSchema),
  appointments: z.array(AppointmentSchema),
  flowEvents: z.array(FlowEventSchema),
  queueTickets: z.array(QueueTicketSchema),
  conversationThreads: z.array(ConversationThreadSchema),
  agentTasks: z.array(AgentTaskSchema),
  preparedActions: z.array(PersistedPreparedActionSchema),
  preparedActionDispatchJobs: z.array(PreparedActionDispatchJobSchema),
  copilotExecutionReceipts: z.array(CopilotExecutionReceiptRecordSchema),
  copilotExecutionReceiptEvents: z.array(CopilotExecutionReceiptEventSchema),
  callbacks: z.array(CallbackLeadSchema),
  playbooks: z.array(PlaybookSchema),
  auditEntries: z.array(AuditEntrySchema),
  copilotReviewDecisions: z.array(CopilotReviewDecisionSchema)
});

export type TenantConfig = z.infer<typeof TenantConfigSchema>;
export type Location = z.infer<typeof LocationSchema>;
export type StaffUser = z.infer<typeof StaffUserSchema>;
export type Patient = z.infer<typeof PatientSchema>;
export type PatientCaseStatus = z.infer<typeof PatientCaseStatusSchema>;
export type PatientCase = z.infer<typeof PatientCaseSchema>;
export type PatientCaseLink = z.infer<typeof PatientCaseLinkSchema>;
export type PatientCaseTimelineEvent = z.infer<typeof PatientCaseTimelineEventSchema>;
export type PatientCaseAction = z.infer<typeof PatientCaseActionSchema>;
export type PatientCaseApproval = z.infer<typeof PatientCaseApprovalSchema>;
export type PatientCaseSnapshot = z.infer<typeof PatientCaseSnapshotSchema>;
export type Appointment = z.infer<typeof AppointmentSchema>;
export type FlowEvent = z.infer<typeof FlowEventSchema>;
export type QueueTicket = z.infer<typeof QueueTicketSchema>;
export type ConversationThread = z.infer<typeof ConversationThreadSchema>;
export type ConversationMessage = z.infer<typeof ConversationMessageSchema>;
export type PatientIntent = z.infer<typeof PatientIntentSchema>;
export type AgentAction = z.infer<typeof AgentActionSchema>;
export type CopilotEvidenceRef = z.infer<typeof CopilotEvidenceRefSchema>;
export type CopilotRecommendation = z.infer<typeof CopilotRecommendationSchema>;
export type AgentRecommendation = CopilotRecommendation;
export type PreparedActionType = z.infer<typeof PreparedActionTypeSchema>;
export type PreparedActionPacket = z.infer<typeof PreparedActionPacketSchema>;
export type PreparedActionStatus = z.infer<typeof PreparedActionStatusSchema>;
export type PersistedPreparedAction = z.infer<typeof PersistedPreparedActionSchema>;
export type PreparedActionDispatchTrigger = z.infer<typeof PreparedActionDispatchTriggerSchema>;
export type PreparedActionDispatchStatus = z.infer<typeof PreparedActionDispatchStatusSchema>;
export type PreparedActionDispatchJob = z.infer<typeof PreparedActionDispatchJobSchema>;
export type CopilotReviewDecision = z.infer<typeof CopilotReviewDecisionSchema>;
export type CopilotExecutionMutation = z.infer<typeof CopilotExecutionMutationSchema>;
export type CopilotExecutionReceiptStatus = z.infer<typeof CopilotExecutionReceiptStatusSchema>;
export type CopilotExecutionReceiptProviderStatus = z.infer<typeof CopilotExecutionReceiptProviderStatusSchema>;
export type CopilotExecutionReceiptEventType = z.infer<typeof CopilotExecutionReceiptEventTypeSchema>;
export type CopilotExecutionReceipt = z.infer<typeof CopilotExecutionReceiptSchema>;
export type CopilotExecutionResult = z.infer<typeof CopilotExecutionResultSchema>;
export type CopilotExecutionReceiptRecord = z.infer<typeof CopilotExecutionReceiptRecordSchema>;
export type CopilotExecutionReceiptEvent = z.infer<typeof CopilotExecutionReceiptEventSchema>;
export type AgentTask = z.infer<typeof AgentTaskSchema>;
export type CallbackLead = z.infer<typeof CallbackLeadSchema>;
export type Playbook = z.infer<typeof PlaybookSchema>;
export type AuditEntry = z.infer<typeof AuditEntrySchema>;
export type KPIReport = z.infer<typeof KPIReportSchema>;
export type PatientFlowLinkProjection = z.infer<typeof PatientFlowLinkProjectionSchema>;
export type WaitRoomQueueItem = z.infer<typeof WaitRoomQueueItemSchema>;
export type WaitRoomDisplayProjection = z.infer<typeof WaitRoomDisplayProjectionSchema>;
export type ClinicDashboardCaseSummary = z.infer<typeof ClinicDashboardCaseSummarySchema>;
export type ClinicDashboardAttentionCase = z.infer<typeof ClinicDashboardAttentionCaseSchema>;
export type ClinicDashboardProjection = z.infer<typeof ClinicDashboardProjectionSchema>;
export type TenantProviderDispatchMode = z.infer<typeof TenantProviderDispatchModeSchema>;
export type TenantProviderWebhookAuthMode = z.infer<typeof TenantProviderWebhookAuthModeSchema>;
export type TenantProviderBindingStatus = z.infer<typeof TenantProviderBindingStatusSchema>;
export type TenantProviderDispatchHealthState = z.infer<typeof TenantProviderDispatchHealthStateSchema>;
export type TenantProviderSecretSource = z.infer<typeof TenantProviderSecretSourceSchema>;
export type TenantProviderBinding = z.infer<typeof TenantProviderBindingSchema>;
export type TenantProviderRuntimeBinding = z.infer<typeof TenantProviderRuntimeBindingSchema>;
export type BootstrapState = z.infer<typeof BootstrapStateSchema>;
