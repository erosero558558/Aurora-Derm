import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { newDb } from "pg-mem";
import { BootstrapStateSchema } from "../../../packages/core/src/index.js";
import type {
  AgentAction,
  AgentRecommendation,
  AgentTask,
  Appointment,
  AuditEntry,
  BootstrapState,
  CallbackLead,
  CopilotExecutionReceiptEvent,
  CopilotExecutionReceiptEventType,
  CopilotExecutionReceiptProviderStatus,
  CopilotExecutionReceiptRecord,
  CopilotExecutionResult,
  CopilotReviewDecision,
  ConversationMessage,
  ConversationThread,
  FlowEvent,
  KPIReport,
  Location,
  Patient,
  PatientCase,
  PatientCaseAction,
  PatientCaseApproval,
  PatientCaseSnapshot,
  PatientCaseStatus,
  PatientCaseTimelineEvent,
  PersistedPreparedAction,
  PreparedActionDispatchJob,
  PreparedActionDispatchStatus,
  PreparedActionDispatchTrigger,
  PreparedActionPacket,
  PreparedActionStatus,
  QueueTicket,
  TenantConfig
} from "../../../packages/core/src/index.js";

function nowIso(): string {
  return new Date().toISOString();
}

function addMilliseconds(isoTimestamp: string, milliseconds: number): string {
  return new Date(new Date(isoTimestamp).getTime() + milliseconds).toISOString();
}

function makeId(prefix: string): string {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}`;
}

function normalizePhone(value: string | undefined | null): string {
  return (value ?? "").replace(/\D+/g, "");
}

function normalizeEmail(value: string | undefined | null): string {
  return (value ?? "").trim().toLowerCase();
}

function toPatientLabel(displayName: string): string {
  const parts = displayName.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "NA";
  return parts.slice(0, 2).map((part) => part[0]?.toUpperCase() ?? "").join("");
}

type ActorType = AuditEntry["actorType"];

const STATE_SCHEMA_SQL = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), "../../../infra/postgres/schema.sql"),
  "utf8"
);

function toIsoString(value: unknown): string {
  if (value instanceof Date) {
    return value.toISOString();
  }
  if (typeof value === "string") {
    return value;
  }
  return new Date(String(value)).toISOString();
}

function escapeSqlString(value: string): string {
  return value.replace(/'/g, "''");
}

function sqlLiteral(value: unknown): string {
  if (value === null || value === undefined) {
    return "null";
  }
  if (value instanceof Date) {
    return `'${value.toISOString()}'`;
  }
  if (typeof value === "number" || typeof value === "bigint") {
    return String(value);
  }
  if (typeof value === "boolean") {
    return value ? "true" : "false";
  }
  if (typeof value === "object") {
    return `'${escapeSqlString(JSON.stringify(value))}'::jsonb`;
  }
  return `'${escapeSqlString(String(value))}'`;
}

function interpolateSql(sql: string, params: readonly unknown[] = []): string {
  return sql.replace(/\$(\d+)/g, (_match, rawIndex) => {
    const index = Number(rawIndex) - 1;
    return sqlLiteral(params[index]);
  });
}

export interface PlatformRepository {
  listTenants(): TenantConfig[];
  getTenantById(tenantId: string): TenantConfig | undefined;
  getTenantBySlug(slug: string): TenantConfig | undefined;
  getLocationById(tenantId: string, locationId: string): Location | undefined;
  getLocationBySlug(tenantId: string, slug: string): Location | undefined;
  listAppointments(tenantId: string): Appointment[];
  getAppointment(tenantId: string, appointmentId: string): Appointment | undefined;
  listQueue(tenantId: string): QueueTicket[];
  getQueueTicket(tenantId: string, ticketId: string): QueueTicket | undefined;
  listThreads(tenantId: string): ConversationThread[];
  listAgentTasks(tenantId: string): AgentTask[];
  listPreparedActions(tenantId: string, caseId?: string): PersistedPreparedAction[];
  getPreparedAction(tenantId: string, preparedActionId: string): PersistedPreparedAction | undefined;
  listPreparedActionDispatchJobs(
    tenantId: string,
    caseId?: string,
    preparedActionId?: string
  ): PreparedActionDispatchJob[];
  listCopilotExecutionReceipts(
    tenantId: string,
    caseId?: string,
    filters?: {
      preparedActionId?: string;
      dispatchJobId?: string;
      system?: string;
    }
  ): CopilotExecutionReceiptRecord[];
  listCopilotExecutionReceiptEvents(
    tenantId: string,
    caseId?: string,
    filters?: {
      receiptRecordId?: string;
      preparedActionId?: string;
      dispatchJobId?: string;
      system?: string;
    }
  ): CopilotExecutionReceiptEvent[];
  getPreparedActionDispatchJob(
    tenantId: string,
    dispatchJobId: string
  ): PreparedActionDispatchJob | undefined;
  listAudit(tenantId: string): AuditEntry[];
  listPatientCases(tenantId: string): PatientCase[];
  listPatientCaseSnapshots(tenantId: string): PatientCaseSnapshot[];
  getPatientCaseSnapshot(tenantId: string, caseId: string): PatientCaseSnapshot | undefined;
  listPatientCaseTimeline(tenantId: string, caseId: string): PatientCaseTimelineEvent[];
  confirmAppointment(tenantId: string, appointmentId: string, actorType: ActorType, actorId: string): Appointment;
  requestReschedule(tenantId: string, appointmentId: string, actorType: ActorType, actorId: string): Appointment;
  checkInAppointment(tenantId: string, appointmentId: string, actorType: ActorType, actorId: string): Appointment;
  markNoShow(tenantId: string, appointmentId: string, actorType: ActorType, actorId: string): Appointment;
  callQueueTicket(tenantId: string, ticketId: string, actorType: ActorType, actorId: string): QueueTicket;
  completeQueueTicket(tenantId: string, ticketId: string, actorType: ActorType, actorId: string): QueueTicket;
  appendConversationMessage(
    tenantId: string,
    caseId: string,
    role: ConversationMessage["role"],
    body: string,
    channelOverride?: Patient["preferredChannel"]
  ): ConversationThread;
  createCaseAction(
    tenantId: string,
    caseId: string,
    payload: {
      action: AgentAction;
      title: string;
      rationale: string;
      channel?: PatientCaseAction["channel"];
      requiresHumanApproval?: boolean;
      source?: PatientCaseAction["source"];
      status?: PatientCaseAction["status"];
    }
  ): PatientCaseAction;
  resolveApproval(
    tenantId: string,
    caseId: string,
    approvalId: string,
    resolution: { decision: "approved" | "rejected"; notes?: string; actorId: string }
  ): PatientCaseApproval;
  updateCaseStatus(tenantId: string, caseId: string, status: PatientCaseStatus, actorId: string): PatientCase;
  createCallback(
    tenantId: string,
    payload: {
      patientId?: string;
      patient?: { displayName: string; phone: string; email?: string | null; preferredChannel: Patient["preferredChannel"] };
      notes: string;
      channel: CallbackLead["channel"];
    }
  ): CallbackLead;
  createAgentTask(
    tenantId: string,
    caseId: string,
    type: AgentTask["type"],
    recommendation: AgentRecommendation,
    appointmentId?: string | null
  ): AgentTask;
  savePreparedAction(
    tenantId: string,
    caseId: string,
    packet: PreparedActionPacket,
    basisLatestActivityAt: string,
    fingerprint: string
  ): PersistedPreparedAction;
  updatePreparedActionStatus(
    tenantId: string,
    preparedActionId: string,
    payload: {
      status: PreparedActionStatus;
      actorId: string;
      staleReason?: string | null;
      executed?: boolean;
    }
  ): PersistedPreparedAction;
  createPreparedActionDispatchJob(
    tenantId: string,
    caseId: string,
    preparedActionId: string,
    payload: {
      trigger: PreparedActionDispatchTrigger;
      actorId: string;
      messageOverride?: string | null;
      availableAt?: string | null;
    }
  ): PreparedActionDispatchJob;
  claimPreparedActionDispatchJobs(payload: {
    tenantId?: string;
    workerId: string;
    limit: number;
    leaseTtlMs?: number;
    now?: string;
  }): PreparedActionDispatchJob[];
  updatePreparedActionDispatchJob(
    tenantId: string,
    dispatchJobId: string,
    payload: {
      status: PreparedActionDispatchStatus;
      actorId: string;
      availableAt?: string | null;
      leaseOwner?: string | null;
      leaseExpiresAt?: string | null;
      startedAt?: string | null;
      finishedAt?: string | null;
      lastError?: string | null;
      execution?: CopilotExecutionResult | null;
    }
  ): PreparedActionDispatchJob;
  updateAgentTaskStatus(
    tenantId: string,
    taskId: string,
    status: AgentTask["status"],
    actorId: string
  ): AgentTask;
  updateCaseActionStatus(
    tenantId: string,
    caseId: string,
    actionId: string,
    status: PatientCaseAction["status"],
    actorId: string
  ): PatientCaseAction;
  recordCopilotReviewDecision(
    tenantId: string,
    caseId: string,
    payload: {
      recommendationAction: AgentAction;
      decision: CopilotReviewDecision["decision"];
      actor: string;
      note?: string | null;
      preparedActionId?: string | null;
    }
  ): CopilotReviewDecision;
  recordCopilotExecutionReceiptEvent(
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
  ): {
    receipt: CopilotExecutionReceiptRecord;
    event: CopilotExecutionReceiptEvent;
  };
  getKpiReport(tenantId: string): KPIReport;
}

export interface SqlExecutor {
  query<T = unknown>(sql: string, params?: readonly unknown[]): { rows: T[] };
}

class PgMemSqlExecutor implements SqlExecutor {
  private readonly db = newDb();

  constructor(seedState: BootstrapState) {
    this.db.public.none(STATE_SCHEMA_SQL);
    replaceBootstrapState(this, seedState);
  }

  query<T = unknown>(sql: string, params: readonly unknown[] = []): { rows: T[] } {
    const result = this.db.public.query(interpolateSql(sql, params));
    return { rows: result.rows as T[] };
  }
}

export function createPgMemSqlExecutor(seedState: BootstrapState = createBootstrapState()): SqlExecutor {
  return new PgMemSqlExecutor(seedState);
}

type DatabaseRow = Record<string, unknown>;

function nullableIsoString(value: unknown): string | null {
  return value === null || value === undefined ? null : toIsoString(value);
}

function parseJsonValue<T>(value: unknown, fallback: T): T {
  if (value === null || value === undefined) {
    return fallback;
  }
  if (typeof value === "string") {
    return JSON.parse(value) as T;
  }
  return value as T;
}

function providerStatusForReceiptEvent(
  eventType: CopilotExecutionReceiptEventType
): CopilotExecutionReceiptProviderStatus {
  switch (eventType) {
    case "acknowledged":
      return "acknowledged";
    case "delivered":
      return "delivered";
    case "failed":
      return "failed";
  }
}

function toBoolean(value: unknown): boolean {
  if (typeof value === "boolean") {
    return value;
  }
  if (typeof value === "string") {
    return value === "true" || value === "t" || value === "1";
  }
  if (typeof value === "number") {
    return value !== 0;
  }
  return false;
}

function queryRows(executor: SqlExecutor, sql: string): DatabaseRow[] {
  return executor.query<DatabaseRow>(sql).rows;
}

function insertRows(
  executor: SqlExecutor,
  tableName: string,
  columns: readonly string[],
  rows: ReadonlyArray<Record<string, unknown>>
): void {
  if (rows.length === 0) {
    return;
  }

  const placeholders = columns.map((_column, index) => `$${index + 1}`).join(", ");
  const sql = `insert into ${tableName} (${columns.join(", ")}) values (${placeholders})`;

  for (const row of rows) {
    executor.query(
      sql,
      columns.map((column) => row[column])
    );
  }
}

export function loadBootstrapState(executor: SqlExecutor): BootstrapState {
  return BootstrapStateSchema.parse({
    tenantConfigs: queryRows(
      executor,
      "select * from tenants order by created_at asc, id asc"
    ).map((row) => ({
      id: String(row.id),
      slug: String(row.slug),
      name: String(row.name),
      timezone: String(row.timezone),
      brandColor: String(row.brand_color),
      enabledChannels: parseJsonValue<string[]>(row.enabled_channels, []),
      credentialRefs: parseJsonValue<string[]>(row.credential_refs, []),
      createdAt: toIsoString(row.created_at)
    })),
    locations: queryRows(
      executor,
      "select * from locations order by created_at asc, id asc"
    ).map((row) => ({
      id: String(row.id),
      tenantId: String(row.tenant_id),
      slug: String(row.slug),
      name: String(row.name),
      waitingRoomName: String(row.waiting_room_name),
      createdAt: toIsoString(row.created_at)
    })),
    staffUsers: queryRows(
      executor,
      "select * from staff_users order by created_at asc, id asc"
    ).map((row) => ({
      id: String(row.id),
      tenantId: String(row.tenant_id),
      locationId: String(row.location_id),
      name: String(row.name),
      role: String(row.role),
      email: String(row.email),
      createdAt: toIsoString(row.created_at)
    })),
    patients: queryRows(
      executor,
      "select * from patients order by created_at asc, id asc"
    ).map((row) => ({
      id: String(row.id),
      tenantId: String(row.tenant_id),
      displayName: String(row.display_name),
      phone: String(row.phone),
      email: row.email === null ? null : String(row.email),
      preferredChannel: String(row.preferred_channel),
      createdAt: toIsoString(row.created_at)
    })),
    patientCases: queryRows(
      executor,
      "select * from patient_cases order by opened_at asc, id asc"
    ).map((row) => ({
      id: String(row.id),
      tenantId: String(row.tenant_id),
      patientId: String(row.patient_id),
      status: String(row.status),
      statusSource: String(row.status_source),
      openedAt: toIsoString(row.opened_at),
      latestActivityAt: toIsoString(row.latest_activity_at),
      closedAt: nullableIsoString(row.closed_at),
      lastInboundAt: nullableIsoString(row.last_inbound_at),
      lastOutboundAt: nullableIsoString(row.last_outbound_at),
      summary: parseJsonValue<PatientCase["summary"]>(row.summary, {
        primaryAppointmentId: null,
        latestAppointmentId: null,
        latestThreadId: null,
        latestCallbackId: null,
        serviceLine: null,
        providerName: null,
        scheduledStart: null,
        scheduledEnd: null,
        queueStatus: null,
        lastChannel: null,
        openActionCount: 0,
        pendingApprovalCount: 0
      })
    })),
    patientCaseLinks: queryRows(
      executor,
      "select * from patient_case_links order by created_at asc, id asc"
    ).map((row) => ({
      id: String(row.id),
      tenantId: String(row.tenant_id),
      patientCaseId: String(row.patient_case_id),
      entityType: String(row.entity_type),
      entityId: String(row.entity_id),
      relationship: String(row.relationship),
      createdAt: toIsoString(row.created_at)
    })),
    patientCaseTimelineEvents: queryRows(
      executor,
      "select * from patient_case_timeline_events order by created_at asc, id asc"
    ).map((row) => ({
      id: String(row.id),
      tenantId: String(row.tenant_id),
      patientCaseId: String(row.patient_case_id),
      type: String(row.type),
      title: String(row.title),
      payload: parseJsonValue<Record<string, unknown>>(row.payload, {}),
      createdAt: toIsoString(row.created_at)
    })),
    patientCaseActions: queryRows(
      executor,
      "select * from patient_case_actions order by created_at asc, id asc"
    ).map((row) => ({
      id: String(row.id),
      tenantId: String(row.tenant_id),
      patientCaseId: String(row.patient_case_id),
      action: String(row.action),
      title: String(row.title),
      status: String(row.status),
      channel: String(row.channel),
      rationale: String(row.rationale),
      requiresHumanApproval: toBoolean(row.requires_human_approval),
      source: String(row.source),
      createdAt: toIsoString(row.created_at),
      updatedAt: toIsoString(row.updated_at),
      completedAt: nullableIsoString(row.completed_at)
    })),
    patientCaseApprovals: queryRows(
      executor,
      "select * from patient_case_approvals order by created_at asc, id asc"
    ).map((row) => ({
      id: String(row.id),
      tenantId: String(row.tenant_id),
      patientCaseId: String(row.patient_case_id),
      type: String(row.type),
      status: String(row.status),
      reason: String(row.reason),
      requestedBy: String(row.requested_by),
      resolvedBy: row.resolved_by === null ? null : String(row.resolved_by),
      resolutionNotes: row.resolution_notes === null ? null : String(row.resolution_notes),
      createdAt: toIsoString(row.created_at),
      updatedAt: toIsoString(row.updated_at),
      resolvedAt: nullableIsoString(row.resolved_at)
    })),
    appointments: queryRows(
      executor,
      "select * from appointments order by created_at asc, id asc"
    ).map((row) => ({
      id: String(row.id),
      tenantId: String(row.tenant_id),
      patientCaseId: String(row.patient_case_id),
      locationId: String(row.location_id),
      patientId: String(row.patient_id),
      providerName: String(row.provider_name),
      serviceLine: String(row.service_line),
      status: String(row.status),
      scheduledStart: toIsoString(row.scheduled_start),
      scheduledEnd: toIsoString(row.scheduled_end),
      createdAt: toIsoString(row.created_at)
    })),
    flowEvents: queryRows(
      executor,
      "select * from flow_events order by created_at asc, id asc"
    ).map((row) => ({
      id: String(row.id),
      tenantId: String(row.tenant_id),
      patientCaseId: String(row.patient_case_id),
      appointmentId: row.appointment_id === null ? null : String(row.appointment_id),
      type: String(row.type),
      payload: parseJsonValue<Record<string, unknown>>(row.payload, {}),
      createdAt: toIsoString(row.created_at)
    })),
    queueTickets: queryRows(
      executor,
      "select * from queue_tickets order by created_at asc, id asc"
    ).map((row) => ({
      id: String(row.id),
      tenantId: String(row.tenant_id),
      patientCaseId: String(row.patient_case_id),
      locationId: String(row.location_id),
      appointmentId: row.appointment_id === null ? null : String(row.appointment_id),
      patientLabel: String(row.patient_label),
      ticketNumber: String(row.ticket_number),
      status: String(row.status),
      createdAt: toIsoString(row.created_at)
    })),
    conversationThreads: queryRows(
      executor,
      "select * from conversation_threads order by created_at asc, id asc"
    ).map((row) => ({
      id: String(row.id),
      tenantId: String(row.tenant_id),
      patientCaseId: String(row.patient_case_id),
      appointmentId: row.appointment_id === null ? null : String(row.appointment_id),
      channel: String(row.channel),
      status: String(row.status),
      messages: parseJsonValue<ConversationThread["messages"]>(row.messages, []),
      createdAt: toIsoString(row.created_at)
    })),
    agentTasks: queryRows(
      executor,
      "select * from agent_tasks order by created_at asc, id asc"
    ).map((row) => ({
      id: String(row.id),
      tenantId: String(row.tenant_id),
      patientCaseId: String(row.patient_case_id),
      appointmentId: row.appointment_id === null ? null : String(row.appointment_id),
      type: String(row.type),
      status: String(row.status),
      recommendation: parseJsonValue<AgentTask["recommendation"]>(row.recommendation, {
        recommendedAction: "answer_operational_faq",
        intent: "unknown",
        summary: "",
        whyNow: "",
        riskIfIgnored: "",
        confidence: 0,
        blockedBy: [],
        requiresHumanApproval: false,
        degraded: false,
        providerName: "sql_loader",
        evidenceRefs: []
      }),
      createdAt: toIsoString(row.created_at)
    })),
    preparedActions: queryRows(
      executor,
      "select * from prepared_actions order by created_at asc, id asc"
    ).map((row) => ({
      id: String(row.id),
      tenantId: String(row.tenant_id),
      patientCaseId: String(row.patient_case_id),
      version: Number(row.version),
      status: String(row.status),
      recommendedAction: String(row.recommendation_action),
      type: String(row.type),
      title: String(row.title),
      payloadDraft: parseJsonValue<Record<string, unknown>>(row.payload_draft, {}),
      messageDraft: row.message_draft === null ? null : String(row.message_draft),
      destinationSystem: String(row.destination_system),
      preconditions: parseJsonValue<string[]>(row.preconditions, []),
      requiresHumanApproval: toBoolean(row.requires_human_approval),
      fingerprint: String(row.fingerprint),
      basisLatestActivityAt: toIsoString(row.basis_latest_activity_at),
      executionCount: Number(row.execution_count ?? 0),
      staleReason: row.stale_reason === null ? null : String(row.stale_reason),
      generatedAt: toIsoString(row.generated_at),
      createdAt: toIsoString(row.created_at),
      updatedAt: toIsoString(row.updated_at),
      executedAt: nullableIsoString(row.executed_at)
    })),
    preparedActionDispatchJobs: queryRows(
      executor,
      "select * from prepared_action_dispatch_jobs order by requested_at asc, id asc"
    ).map((row) => ({
      id: String(row.id),
      tenantId: String(row.tenant_id),
      patientCaseId: String(row.patient_case_id),
      preparedActionId: String(row.prepared_action_id),
      trigger: String(row.trigger),
      status: String(row.status),
      actorId: String(row.actor_id),
      attempt: Number(row.attempt),
      messageOverride: row.message_override === null ? null : String(row.message_override),
      lastError: row.last_error === null ? null : String(row.last_error),
      execution: parseJsonValue<CopilotExecutionResult | null>(row.execution, null),
      requestedAt: toIsoString(row.requested_at),
      availableAt: toIsoString(row.available_at ?? row.requested_at),
      leaseOwner: row.lease_owner === null || row.lease_owner === undefined ? null : String(row.lease_owner),
      leaseExpiresAt: nullableIsoString(row.lease_expires_at),
      startedAt: nullableIsoString(row.started_at),
      finishedAt: nullableIsoString(row.finished_at)
    })),
    copilotExecutionReceipts: queryRows(
      executor,
      "select * from copilot_execution_receipts order by recorded_at asc, id asc"
    ).map((row) => ({
      id: String(row.id),
      tenantId: String(row.tenant_id),
      patientCaseId: String(row.patient_case_id),
      preparedActionId: String(row.prepared_action_id),
      dispatchJobId: String(row.dispatch_job_id),
      attempt: Number(row.attempt),
      actorId: String(row.actor_id),
      recommendedAction: String(row.recommended_action),
      destinationSystem: String(row.destination_system),
      adapterKey: String(row.adapter_key),
      deduped: toBoolean(row.deduped),
      providerStatus: String(row.provider_status),
      providerConfirmedAt: nullableIsoString(row.provider_confirmed_at),
      lastProviderEventAt: nullableIsoString(row.last_provider_event_at),
      lastProviderError: row.last_provider_error === null ? null : String(row.last_provider_error),
      receipt: parseJsonValue(row.receipt, {}),
      recordedAt: toIsoString(row.recorded_at)
    })),
    copilotExecutionReceiptEvents: queryRows(
      executor,
      "select * from copilot_execution_receipt_events order by occurred_at asc, id asc"
    ).map((row) => ({
      id: String(row.id),
      tenantId: String(row.tenant_id),
      patientCaseId: String(row.patient_case_id),
      preparedActionId: String(row.prepared_action_id),
      dispatchJobId: String(row.dispatch_job_id),
      receiptRecordId: String(row.receipt_record_id),
      system: String(row.system),
      eventType: String(row.event_type),
      providerStatus: String(row.provider_status),
      idempotencyKey: String(row.idempotency_key),
      externalRef: row.external_ref === null ? null : String(row.external_ref),
      payload: parseJsonValue<Record<string, unknown>>(row.payload, {}),
      occurredAt: toIsoString(row.occurred_at),
      recordedAt: toIsoString(row.recorded_at)
    })),
    callbacks: queryRows(
      executor,
      "select * from callbacks order by created_at asc, id asc"
    ).map((row) => ({
      id: String(row.id),
      tenantId: String(row.tenant_id),
      patientCaseId: String(row.patient_case_id),
      patientId: String(row.patient_id),
      channel: String(row.channel),
      notes: String(row.notes),
      status: String(row.status),
      createdAt: toIsoString(row.created_at)
    })),
    playbooks: queryRows(
      executor,
      "select * from playbooks order by created_at asc, id asc"
    ).map((row) => ({
      id: String(row.id),
      tenantId: String(row.tenant_id),
      name: String(row.name),
      triggerKey: String(row.trigger_key),
      isEnabled: toBoolean(row.is_enabled),
      config: parseJsonValue<Record<string, unknown>>(row.config, {}),
      createdAt: toIsoString(row.created_at)
    })),
    auditEntries: queryRows(
      executor,
      "select * from audit_entries order by created_at asc, id asc"
    ).map((row) => ({
      id: String(row.id),
      tenantId: String(row.tenant_id),
      actorType: String(row.actor_type),
      actorId: String(row.actor_id),
      action: String(row.action),
      entityType: String(row.entity_type),
      entityId: String(row.entity_id),
      metadata: parseJsonValue<Record<string, unknown>>(row.metadata, {}),
      createdAt: toIsoString(row.created_at)
    })),
    copilotReviewDecisions: queryRows(
      executor,
      "select * from copilot_review_decisions order by timestamp asc, id asc"
    ).map((row) => ({
      id: String(row.id),
      tenantId: String(row.tenant_id),
      patientCaseId: String(row.patient_case_id),
      recommendationAction: String(row.recommendation_action),
      decision: String(row.decision),
      actor: String(row.actor),
      timestamp: toIsoString(row.timestamp),
      note: row.note === null ? null : String(row.note),
      preparedActionId: row.prepared_action_id === null ? null : String(row.prepared_action_id)
    }))
  });
}

export function replaceBootstrapState(executor: SqlExecutor, state: BootstrapState): void {
  const parsedState = BootstrapStateSchema.parse(state);
  const deleteStatements = [
    "delete from audit_entries",
    "delete from playbooks",
    "delete from copilot_review_decisions",
    "delete from copilot_execution_receipt_events",
    "delete from copilot_execution_receipts",
    "delete from prepared_action_dispatch_jobs",
    "delete from prepared_actions",
    "delete from agent_tasks",
    "delete from conversation_threads",
    "delete from queue_tickets",
    "delete from flow_events",
    "delete from appointments",
    "delete from callbacks",
    "delete from patient_case_approvals",
    "delete from patient_case_actions",
    "delete from patient_case_timeline_events",
    "delete from patient_case_links",
    "delete from patient_cases",
    "delete from patients",
    "delete from staff_users",
    "delete from locations",
    "delete from tenants"
  ];

  for (const sql of deleteStatements) {
    executor.query(sql);
  }

  insertRows(
    executor,
    "tenants",
    ["id", "slug", "name", "timezone", "brand_color", "enabled_channels", "credential_refs", "created_at"],
    parsedState.tenantConfigs.map((tenant) => ({
      id: tenant.id,
      slug: tenant.slug,
      name: tenant.name,
      timezone: tenant.timezone,
      brand_color: tenant.brandColor,
      enabled_channels: tenant.enabledChannels,
      credential_refs: tenant.credentialRefs,
      created_at: tenant.createdAt
    }))
  );
  insertRows(
    executor,
    "locations",
    ["id", "tenant_id", "slug", "name", "waiting_room_name", "created_at"],
    parsedState.locations.map((location) => ({
      id: location.id,
      tenant_id: location.tenantId,
      slug: location.slug,
      name: location.name,
      waiting_room_name: location.waitingRoomName,
      created_at: location.createdAt
    }))
  );
  insertRows(
    executor,
    "staff_users",
    ["id", "tenant_id", "location_id", "name", "role", "email", "created_at"],
    parsedState.staffUsers.map((staffUser) => ({
      id: staffUser.id,
      tenant_id: staffUser.tenantId,
      location_id: staffUser.locationId,
      name: staffUser.name,
      role: staffUser.role,
      email: staffUser.email,
      created_at: staffUser.createdAt
    }))
  );
  insertRows(
    executor,
    "patients",
    ["id", "tenant_id", "display_name", "phone", "email", "preferred_channel", "created_at"],
    parsedState.patients.map((patient) => ({
      id: patient.id,
      tenant_id: patient.tenantId,
      display_name: patient.displayName,
      phone: patient.phone,
      email: patient.email,
      preferred_channel: patient.preferredChannel,
      created_at: patient.createdAt
    }))
  );
  insertRows(
    executor,
    "patient_cases",
    [
      "id",
      "tenant_id",
      "patient_id",
      "status",
      "status_source",
      "opened_at",
      "latest_activity_at",
      "closed_at",
      "last_inbound_at",
      "last_outbound_at",
      "summary"
    ],
    parsedState.patientCases.map((patientCase) => ({
      id: patientCase.id,
      tenant_id: patientCase.tenantId,
      patient_id: patientCase.patientId,
      status: patientCase.status,
      status_source: patientCase.statusSource,
      opened_at: patientCase.openedAt,
      latest_activity_at: patientCase.latestActivityAt,
      closed_at: patientCase.closedAt,
      last_inbound_at: patientCase.lastInboundAt,
      last_outbound_at: patientCase.lastOutboundAt,
      summary: patientCase.summary
    }))
  );
  insertRows(
    executor,
    "patient_case_links",
    ["id", "tenant_id", "patient_case_id", "entity_type", "entity_id", "relationship", "created_at"],
    parsedState.patientCaseLinks.map((link) => ({
      id: link.id,
      tenant_id: link.tenantId,
      patient_case_id: link.patientCaseId,
      entity_type: link.entityType,
      entity_id: link.entityId,
      relationship: link.relationship,
      created_at: link.createdAt
    }))
  );
  insertRows(
    executor,
    "patient_case_timeline_events",
    ["id", "tenant_id", "patient_case_id", "type", "title", "payload", "created_at"],
    parsedState.patientCaseTimelineEvents.map((event) => ({
      id: event.id,
      tenant_id: event.tenantId,
      patient_case_id: event.patientCaseId,
      type: event.type,
      title: event.title,
      payload: event.payload,
      created_at: event.createdAt
    }))
  );
  insertRows(
    executor,
    "patient_case_actions",
    [
      "id",
      "tenant_id",
      "patient_case_id",
      "action",
      "title",
      "status",
      "channel",
      "rationale",
      "requires_human_approval",
      "source",
      "created_at",
      "updated_at",
      "completed_at"
    ],
    parsedState.patientCaseActions.map((action) => ({
      id: action.id,
      tenant_id: action.tenantId,
      patient_case_id: action.patientCaseId,
      action: action.action,
      title: action.title,
      status: action.status,
      channel: action.channel,
      rationale: action.rationale,
      requires_human_approval: action.requiresHumanApproval,
      source: action.source,
      created_at: action.createdAt,
      updated_at: action.updatedAt,
      completed_at: action.completedAt
    }))
  );
  insertRows(
    executor,
    "patient_case_approvals",
    [
      "id",
      "tenant_id",
      "patient_case_id",
      "type",
      "status",
      "reason",
      "requested_by",
      "resolved_by",
      "resolution_notes",
      "created_at",
      "updated_at",
      "resolved_at"
    ],
    parsedState.patientCaseApprovals.map((approval) => ({
      id: approval.id,
      tenant_id: approval.tenantId,
      patient_case_id: approval.patientCaseId,
      type: approval.type,
      status: approval.status,
      reason: approval.reason,
      requested_by: approval.requestedBy,
      resolved_by: approval.resolvedBy,
      resolution_notes: approval.resolutionNotes,
      created_at: approval.createdAt,
      updated_at: approval.updatedAt,
      resolved_at: approval.resolvedAt
    }))
  );
  insertRows(
    executor,
    "callbacks",
    ["id", "tenant_id", "patient_case_id", "patient_id", "channel", "notes", "status", "created_at"],
    parsedState.callbacks.map((callback) => ({
      id: callback.id,
      tenant_id: callback.tenantId,
      patient_case_id: callback.patientCaseId,
      patient_id: callback.patientId,
      channel: callback.channel,
      notes: callback.notes,
      status: callback.status,
      created_at: callback.createdAt
    }))
  );
  insertRows(
    executor,
    "appointments",
    [
      "id",
      "tenant_id",
      "patient_case_id",
      "location_id",
      "patient_id",
      "provider_name",
      "service_line",
      "status",
      "scheduled_start",
      "scheduled_end",
      "created_at"
    ],
    parsedState.appointments.map((appointment) => ({
      id: appointment.id,
      tenant_id: appointment.tenantId,
      patient_case_id: appointment.patientCaseId,
      location_id: appointment.locationId,
      patient_id: appointment.patientId,
      provider_name: appointment.providerName,
      service_line: appointment.serviceLine,
      status: appointment.status,
      scheduled_start: appointment.scheduledStart,
      scheduled_end: appointment.scheduledEnd,
      created_at: appointment.createdAt
    }))
  );
  insertRows(
    executor,
    "flow_events",
    ["id", "tenant_id", "patient_case_id", "appointment_id", "type", "payload", "created_at"],
    parsedState.flowEvents.map((event) => ({
      id: event.id,
      tenant_id: event.tenantId,
      patient_case_id: event.patientCaseId,
      appointment_id: event.appointmentId,
      type: event.type,
      payload: event.payload,
      created_at: event.createdAt
    }))
  );
  insertRows(
    executor,
    "queue_tickets",
    [
      "id",
      "tenant_id",
      "patient_case_id",
      "location_id",
      "appointment_id",
      "patient_label",
      "ticket_number",
      "status",
      "created_at"
    ],
    parsedState.queueTickets.map((ticket) => ({
      id: ticket.id,
      tenant_id: ticket.tenantId,
      patient_case_id: ticket.patientCaseId,
      location_id: ticket.locationId,
      appointment_id: ticket.appointmentId,
      patient_label: ticket.patientLabel,
      ticket_number: ticket.ticketNumber,
      status: ticket.status,
      created_at: ticket.createdAt
    }))
  );
  insertRows(
    executor,
    "conversation_threads",
    [
      "id",
      "tenant_id",
      "patient_case_id",
      "appointment_id",
      "channel",
      "status",
      "messages",
      "created_at"
    ],
    parsedState.conversationThreads.map((thread) => ({
      id: thread.id,
      tenant_id: thread.tenantId,
      patient_case_id: thread.patientCaseId,
      appointment_id: thread.appointmentId,
      channel: thread.channel,
      status: thread.status,
      messages: thread.messages,
      created_at: thread.createdAt
    }))
  );
  insertRows(
    executor,
    "agent_tasks",
    [
      "id",
      "tenant_id",
      "patient_case_id",
      "appointment_id",
      "type",
      "status",
      "recommendation",
      "created_at"
    ],
    parsedState.agentTasks.map((task) => ({
      id: task.id,
      tenant_id: task.tenantId,
      patient_case_id: task.patientCaseId,
      appointment_id: task.appointmentId,
      type: task.type,
      status: task.status,
      recommendation: task.recommendation,
      created_at: task.createdAt
    }))
  );
  insertRows(
    executor,
    "prepared_actions",
    [
      "id",
      "tenant_id",
      "patient_case_id",
      "version",
      "status",
      "recommendation_action",
      "type",
      "title",
      "payload_draft",
      "message_draft",
      "destination_system",
      "preconditions",
      "requires_human_approval",
      "fingerprint",
      "basis_latest_activity_at",
      "execution_count",
      "stale_reason",
      "generated_at",
      "created_at",
      "updated_at",
      "executed_at"
    ],
    parsedState.preparedActions.map((preparedAction) => ({
      id: preparedAction.id,
      tenant_id: preparedAction.tenantId,
      patient_case_id: preparedAction.patientCaseId,
      version: preparedAction.version,
      status: preparedAction.status,
      recommendation_action: preparedAction.recommendedAction,
      type: preparedAction.type,
      title: preparedAction.title,
      payload_draft: preparedAction.payloadDraft,
      message_draft: preparedAction.messageDraft,
      destination_system: preparedAction.destinationSystem,
      preconditions: preparedAction.preconditions,
      requires_human_approval: preparedAction.requiresHumanApproval,
      fingerprint: preparedAction.fingerprint,
      basis_latest_activity_at: preparedAction.basisLatestActivityAt,
      execution_count: preparedAction.executionCount,
      stale_reason: preparedAction.staleReason,
      generated_at: preparedAction.generatedAt,
      created_at: preparedAction.createdAt,
      updated_at: preparedAction.updatedAt,
      executed_at: preparedAction.executedAt
    }))
  );
  insertRows(
    executor,
    "prepared_action_dispatch_jobs",
    [
      "id",
      "tenant_id",
      "patient_case_id",
      "prepared_action_id",
      "trigger",
      "status",
      "actor_id",
      "attempt",
      "message_override",
      "last_error",
      "execution",
      "requested_at",
      "available_at",
      "lease_owner",
      "lease_expires_at",
      "started_at",
      "finished_at"
    ],
    parsedState.preparedActionDispatchJobs.map((dispatchJob) => ({
      id: dispatchJob.id,
      tenant_id: dispatchJob.tenantId,
      patient_case_id: dispatchJob.patientCaseId,
      prepared_action_id: dispatchJob.preparedActionId,
      trigger: dispatchJob.trigger,
      status: dispatchJob.status,
      actor_id: dispatchJob.actorId,
      attempt: dispatchJob.attempt,
      message_override: dispatchJob.messageOverride,
      last_error: dispatchJob.lastError,
      execution: dispatchJob.execution,
      requested_at: dispatchJob.requestedAt,
      available_at: dispatchJob.availableAt,
      lease_owner: dispatchJob.leaseOwner,
      lease_expires_at: dispatchJob.leaseExpiresAt,
      started_at: dispatchJob.startedAt,
      finished_at: dispatchJob.finishedAt
    }))
  );
  insertRows(
    executor,
    "copilot_execution_receipts",
    [
      "id",
      "tenant_id",
      "patient_case_id",
      "prepared_action_id",
      "dispatch_job_id",
      "attempt",
      "actor_id",
      "recommended_action",
      "destination_system",
      "adapter_key",
      "deduped",
      "provider_status",
      "provider_confirmed_at",
      "last_provider_event_at",
      "last_provider_error",
      "receipt",
      "recorded_at"
    ],
    parsedState.copilotExecutionReceipts.map((receiptRecord) => ({
      id: receiptRecord.id,
      tenant_id: receiptRecord.tenantId,
      patient_case_id: receiptRecord.patientCaseId,
      prepared_action_id: receiptRecord.preparedActionId,
      dispatch_job_id: receiptRecord.dispatchJobId,
      attempt: receiptRecord.attempt,
      actor_id: receiptRecord.actorId,
      recommended_action: receiptRecord.recommendedAction,
      destination_system: receiptRecord.destinationSystem,
      adapter_key: receiptRecord.adapterKey,
      deduped: receiptRecord.deduped,
      provider_status: receiptRecord.providerStatus,
      provider_confirmed_at: receiptRecord.providerConfirmedAt,
      last_provider_event_at: receiptRecord.lastProviderEventAt,
      last_provider_error: receiptRecord.lastProviderError,
      receipt: receiptRecord.receipt,
      recorded_at: receiptRecord.recordedAt
    }))
  );
  insertRows(
    executor,
    "copilot_execution_receipt_events",
    [
      "id",
      "tenant_id",
      "patient_case_id",
      "prepared_action_id",
      "dispatch_job_id",
      "receipt_record_id",
      "system",
      "event_type",
      "provider_status",
      "idempotency_key",
      "external_ref",
      "payload",
      "occurred_at",
      "recorded_at"
    ],
    parsedState.copilotExecutionReceiptEvents.map((event) => ({
      id: event.id,
      tenant_id: event.tenantId,
      patient_case_id: event.patientCaseId,
      prepared_action_id: event.preparedActionId,
      dispatch_job_id: event.dispatchJobId,
      receipt_record_id: event.receiptRecordId,
      system: event.system,
      event_type: event.eventType,
      provider_status: event.providerStatus,
      idempotency_key: event.idempotencyKey,
      external_ref: event.externalRef,
      payload: event.payload,
      occurred_at: event.occurredAt,
      recorded_at: event.recordedAt
    }))
  );
  insertRows(
    executor,
    "copilot_review_decisions",
    [
      "id",
      "tenant_id",
      "patient_case_id",
      "recommendation_action",
      "decision",
      "actor",
      "timestamp",
      "note",
      "prepared_action_id"
    ],
    parsedState.copilotReviewDecisions.map((review) => ({
      id: review.id,
      tenant_id: review.tenantId,
      patient_case_id: review.patientCaseId,
      recommendation_action: review.recommendationAction,
      decision: review.decision,
      actor: review.actor,
      timestamp: review.timestamp,
      note: review.note,
      prepared_action_id: review.preparedActionId
    }))
  );
  insertRows(
    executor,
    "playbooks",
    ["id", "tenant_id", "name", "trigger_key", "is_enabled", "config", "created_at"],
    parsedState.playbooks.map((playbook) => ({
      id: playbook.id,
      tenant_id: playbook.tenantId,
      name: playbook.name,
      trigger_key: playbook.triggerKey,
      is_enabled: playbook.isEnabled,
      config: playbook.config,
      created_at: playbook.createdAt
    }))
  );
  insertRows(
    executor,
    "audit_entries",
    ["id", "tenant_id", "actor_type", "actor_id", "action", "entity_type", "entity_id", "metadata", "created_at"],
    parsedState.auditEntries.map((entry) => ({
      id: entry.id,
      tenant_id: entry.tenantId,
      actor_type: entry.actorType,
      actor_id: entry.actorId,
      action: entry.action,
      entity_type: entry.entityType,
      entity_id: entry.entityId,
      metadata: entry.metadata,
      created_at: entry.createdAt
    }))
  );
}

export class PostgresPlatformRepository implements PlatformRepository {
  constructor(private readonly executor: SqlExecutor) {}

  private loadRepository(): InMemoryPlatformRepository {
    return new InMemoryPlatformRepository(loadBootstrapState(this.executor));
  }

  private withReadonly<T>(reader: (repository: InMemoryPlatformRepository) => T): T {
    const repository = this.loadRepository();
    return reader(repository);
  }

  private withMutation<T>(writer: (repository: InMemoryPlatformRepository) => T): T {
    const repository = this.loadRepository();
    const result = writer(repository);
    replaceBootstrapState(this.executor, repository.exportState());
    return result;
  }

  listTenants(): TenantConfig[] {
    return this.withReadonly((repository) => repository.listTenants());
  }

  getTenantById(tenantId: string): TenantConfig | undefined {
    return this.withReadonly((repository) => repository.getTenantById(tenantId));
  }

  getTenantBySlug(slug: string): TenantConfig | undefined {
    return this.withReadonly((repository) => repository.getTenantBySlug(slug));
  }

  getLocationById(tenantId: string, locationId: string): Location | undefined {
    return this.withReadonly((repository) => repository.getLocationById(tenantId, locationId));
  }

  getLocationBySlug(tenantId: string, slug: string): Location | undefined {
    return this.withReadonly((repository) => repository.getLocationBySlug(tenantId, slug));
  }

  listAppointments(tenantId: string): Appointment[] {
    return this.withReadonly((repository) => repository.listAppointments(tenantId));
  }

  getAppointment(tenantId: string, appointmentId: string): Appointment | undefined {
    return this.withReadonly((repository) => repository.getAppointment(tenantId, appointmentId));
  }

  listQueue(tenantId: string): QueueTicket[] {
    return this.withReadonly((repository) => repository.listQueue(tenantId));
  }

  getQueueTicket(tenantId: string, ticketId: string): QueueTicket | undefined {
    return this.withReadonly((repository) => repository.getQueueTicket(tenantId, ticketId));
  }

  listThreads(tenantId: string): ConversationThread[] {
    return this.withReadonly((repository) => repository.listThreads(tenantId));
  }

  listAgentTasks(tenantId: string): AgentTask[] {
    return this.withReadonly((repository) => repository.listAgentTasks(tenantId));
  }

  listPreparedActions(tenantId: string, caseId?: string): PersistedPreparedAction[] {
    return this.withReadonly((repository) => repository.listPreparedActions(tenantId, caseId));
  }

  getPreparedAction(tenantId: string, preparedActionId: string): PersistedPreparedAction | undefined {
    return this.withReadonly((repository) => repository.getPreparedAction(tenantId, preparedActionId));
  }

  listPreparedActionDispatchJobs(
    tenantId: string,
    caseId?: string,
    preparedActionId?: string
  ): PreparedActionDispatchJob[] {
    return this.withReadonly((repository) =>
      repository.listPreparedActionDispatchJobs(tenantId, caseId, preparedActionId)
    );
  }

  listCopilotExecutionReceipts(
    tenantId: string,
    caseId?: string,
    filters?: {
      preparedActionId?: string;
      dispatchJobId?: string;
      system?: string;
    }
  ): CopilotExecutionReceiptRecord[] {
    return this.withReadonly((repository) =>
      repository.listCopilotExecutionReceipts(tenantId, caseId, filters)
    );
  }

  listCopilotExecutionReceiptEvents(
    tenantId: string,
    caseId?: string,
    filters?: {
      receiptRecordId?: string;
      preparedActionId?: string;
      dispatchJobId?: string;
      system?: string;
    }
  ): CopilotExecutionReceiptEvent[] {
    return this.withReadonly((repository) =>
      repository.listCopilotExecutionReceiptEvents(tenantId, caseId, filters)
    );
  }

  getPreparedActionDispatchJob(
    tenantId: string,
    dispatchJobId: string
  ): PreparedActionDispatchJob | undefined {
    return this.withReadonly((repository) => repository.getPreparedActionDispatchJob(tenantId, dispatchJobId));
  }

  listAudit(tenantId: string): AuditEntry[] {
    return this.withReadonly((repository) => repository.listAudit(tenantId));
  }

  listPatientCases(tenantId: string): PatientCase[] {
    return this.withReadonly((repository) => repository.listPatientCases(tenantId));
  }

  listPatientCaseSnapshots(tenantId: string): PatientCaseSnapshot[] {
    return this.withReadonly((repository) => repository.listPatientCaseSnapshots(tenantId));
  }

  getPatientCaseSnapshot(tenantId: string, caseId: string): PatientCaseSnapshot | undefined {
    return this.withReadonly((repository) => repository.getPatientCaseSnapshot(tenantId, caseId));
  }

  listPatientCaseTimeline(tenantId: string, caseId: string): PatientCaseTimelineEvent[] {
    return this.withReadonly((repository) => repository.listPatientCaseTimeline(tenantId, caseId));
  }

  confirmAppointment(
    tenantId: string,
    appointmentId: string,
    actorType: ActorType,
    actorId: string
  ): Appointment {
    return this.withMutation((repository) =>
      repository.confirmAppointment(tenantId, appointmentId, actorType, actorId)
    );
  }

  requestReschedule(
    tenantId: string,
    appointmentId: string,
    actorType: ActorType,
    actorId: string
  ): Appointment {
    return this.withMutation((repository) =>
      repository.requestReschedule(tenantId, appointmentId, actorType, actorId)
    );
  }

  checkInAppointment(
    tenantId: string,
    appointmentId: string,
    actorType: ActorType,
    actorId: string
  ): Appointment {
    return this.withMutation((repository) =>
      repository.checkInAppointment(tenantId, appointmentId, actorType, actorId)
    );
  }

  markNoShow(
    tenantId: string,
    appointmentId: string,
    actorType: ActorType,
    actorId: string
  ): Appointment {
    return this.withMutation((repository) =>
      repository.markNoShow(tenantId, appointmentId, actorType, actorId)
    );
  }

  callQueueTicket(tenantId: string, ticketId: string, actorType: ActorType, actorId: string): QueueTicket {
    return this.withMutation((repository) =>
      repository.callQueueTicket(tenantId, ticketId, actorType, actorId)
    );
  }

  completeQueueTicket(
    tenantId: string,
    ticketId: string,
    actorType: ActorType,
    actorId: string
  ): QueueTicket {
    return this.withMutation((repository) =>
      repository.completeQueueTicket(tenantId, ticketId, actorType, actorId)
    );
  }

  appendConversationMessage(
    tenantId: string,
    caseId: string,
    role: ConversationMessage["role"],
    body: string,
    channelOverride?: Patient["preferredChannel"]
  ): ConversationThread {
    return this.withMutation((repository) =>
      repository.appendConversationMessage(tenantId, caseId, role, body, channelOverride)
    );
  }

  createCaseAction(
    tenantId: string,
    caseId: string,
    payload: {
      action: AgentAction;
      title: string;
      rationale: string;
      channel?: PatientCaseAction["channel"];
      requiresHumanApproval?: boolean;
      source?: PatientCaseAction["source"];
      status?: PatientCaseAction["status"];
    }
  ): PatientCaseAction {
    return this.withMutation((repository) => repository.createCaseAction(tenantId, caseId, payload));
  }

  resolveApproval(
    tenantId: string,
    caseId: string,
    approvalId: string,
    resolution: { decision: "approved" | "rejected"; notes?: string; actorId: string }
  ): PatientCaseApproval {
    return this.withMutation((repository) =>
      repository.resolveApproval(tenantId, caseId, approvalId, resolution)
    );
  }

  updateCaseStatus(
    tenantId: string,
    caseId: string,
    status: PatientCaseStatus,
    actorId: string
  ): PatientCase {
    return this.withMutation((repository) =>
      repository.updateCaseStatus(tenantId, caseId, status, actorId)
    );
  }

  createCallback(
    tenantId: string,
    payload: {
      patientId?: string;
      patient?: {
        displayName: string;
        phone: string;
        email?: string | null;
        preferredChannel: Patient["preferredChannel"];
      };
      notes: string;
      channel: CallbackLead["channel"];
    }
  ): CallbackLead {
    return this.withMutation((repository) => repository.createCallback(tenantId, payload));
  }

  createAgentTask(
    tenantId: string,
    caseId: string,
    type: AgentTask["type"],
    recommendation: AgentRecommendation,
    appointmentId?: string | null
  ): AgentTask {
    return this.withMutation((repository) =>
      repository.createAgentTask(tenantId, caseId, type, recommendation, appointmentId)
    );
  }

  savePreparedAction(
    tenantId: string,
    caseId: string,
    packet: PreparedActionPacket,
    basisLatestActivityAt: string,
    fingerprint: string
  ): PersistedPreparedAction {
    return this.withMutation((repository) =>
      repository.savePreparedAction(tenantId, caseId, packet, basisLatestActivityAt, fingerprint)
    );
  }

  updatePreparedActionStatus(
    tenantId: string,
    preparedActionId: string,
    payload: {
      status: PreparedActionStatus;
      actorId: string;
      staleReason?: string | null;
      executed?: boolean;
    }
  ): PersistedPreparedAction {
    return this.withMutation((repository) =>
      repository.updatePreparedActionStatus(tenantId, preparedActionId, payload)
    );
  }

  createPreparedActionDispatchJob(
    tenantId: string,
    caseId: string,
    preparedActionId: string,
    payload: {
      trigger: PreparedActionDispatchTrigger;
      actorId: string;
      messageOverride?: string | null;
      availableAt?: string | null;
    }
  ): PreparedActionDispatchJob {
    return this.withMutation((repository) =>
      repository.createPreparedActionDispatchJob(tenantId, caseId, preparedActionId, payload)
    );
  }

  claimPreparedActionDispatchJobs(payload: {
    tenantId?: string;
    workerId: string;
    limit: number;
    leaseTtlMs?: number;
    now?: string;
  }): PreparedActionDispatchJob[] {
    return this.withMutation((repository) => repository.claimPreparedActionDispatchJobs(payload));
  }

  updatePreparedActionDispatchJob(
    tenantId: string,
    dispatchJobId: string,
    payload: {
      status: PreparedActionDispatchStatus;
      actorId: string;
      availableAt?: string | null;
      leaseOwner?: string | null;
      leaseExpiresAt?: string | null;
      startedAt?: string | null;
      finishedAt?: string | null;
      lastError?: string | null;
      execution?: CopilotExecutionResult | null;
    }
  ): PreparedActionDispatchJob {
    return this.withMutation((repository) =>
      repository.updatePreparedActionDispatchJob(tenantId, dispatchJobId, payload)
    );
  }

  updateAgentTaskStatus(
    tenantId: string,
    taskId: string,
    status: AgentTask["status"],
    actorId: string
  ): AgentTask {
    return this.withMutation((repository) =>
      repository.updateAgentTaskStatus(tenantId, taskId, status, actorId)
    );
  }

  updateCaseActionStatus(
    tenantId: string,
    caseId: string,
    actionId: string,
    status: PatientCaseAction["status"],
    actorId: string
  ): PatientCaseAction {
    return this.withMutation((repository) =>
      repository.updateCaseActionStatus(tenantId, caseId, actionId, status, actorId)
    );
  }

  recordCopilotReviewDecision(
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
    return this.withMutation((repository) =>
      repository.recordCopilotReviewDecision(tenantId, caseId, payload)
    );
  }

  recordCopilotExecutionReceiptEvent(
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
  ): {
    receipt: CopilotExecutionReceiptRecord;
    event: CopilotExecutionReceiptEvent;
  } {
    return this.withMutation((repository) =>
      repository.recordCopilotExecutionReceiptEvent(tenantId, payload)
    );
  }

  getKpiReport(tenantId: string): KPIReport {
    return this.withReadonly((repository) => repository.getKpiReport(tenantId));
  }
}

export function createBootstrapState(): BootstrapState {
  const createdAt = "2026-03-11T12:00:00.000Z";
  return BootstrapStateSchema.parse({
    tenantConfigs: [
      { id: "tnt_green", slug: "green-valley", name: "Green Valley Clinic", timezone: "America/Guayaquil", brandColor: "#0f766e", enabledChannels: ["web", "whatsapp", "sms"], credentialRefs: ["whatsapp.primary", "sms.primary"], createdAt },
      { id: "tnt_river", slug: "river-point", name: "River Point Practice", timezone: "America/Guayaquil", brandColor: "#1d4ed8", enabledChannels: ["web", "email"], credentialRefs: ["email.primary"], createdAt }
    ],
    locations: [
      { id: "loc_green_main", tenantId: "tnt_green", slug: "green-main", name: "Green Main Office", waitingRoomName: "Sala Principal", createdAt },
      { id: "loc_river_main", tenantId: "tnt_river", slug: "river-main", name: "River Main Office", waitingRoomName: "Lobby Principal", createdAt }
    ],
    staffUsers: [
      { id: "staff_green_front", tenantId: "tnt_green", locationId: "loc_green_main", name: "Sara Front Desk", role: "front_desk", email: "sara@green.example", createdAt },
      { id: "staff_river_manager", tenantId: "tnt_river", locationId: "loc_river_main", name: "Leo Manager", role: "manager", email: "leo@river.example", createdAt }
    ],
    patients: [
      { id: "pat_green_001", tenantId: "tnt_green", displayName: "Eva Perez", phone: "+593999000001", email: "eva@green.example", preferredChannel: "whatsapp", createdAt },
      { id: "pat_green_002", tenantId: "tnt_green", displayName: "Luis Mejia", phone: "+593999000002", email: "luis@green.example", preferredChannel: "sms", createdAt },
      { id: "pat_river_001", tenantId: "tnt_river", displayName: "Mia Flores", phone: "+593999000003", email: "mia@river.example", preferredChannel: "email", createdAt }
    ],
    patientCases: [
      { id: "case_green_001", tenantId: "tnt_green", patientId: "pat_green_001", status: "booked", statusSource: "derived", openedAt: createdAt, latestActivityAt: "2026-03-11T13:00:00.000Z", closedAt: null, lastInboundAt: "2026-03-11T12:59:00.000Z", lastOutboundAt: null, summary: { primaryAppointmentId: "appt_green_001", latestAppointmentId: "appt_green_001", latestThreadId: "thread_green_001", latestCallbackId: null, serviceLine: "General Medicine", providerName: "Dra. Vega", scheduledStart: "2026-03-11T14:00:00.000Z", scheduledEnd: "2026-03-11T14:30:00.000Z", queueStatus: null, lastChannel: "whatsapp", openActionCount: 0, pendingApprovalCount: 1 } },
      { id: "case_green_002", tenantId: "tnt_green", patientId: "pat_green_002", status: "follow_up_pending", statusSource: "derived", openedAt: createdAt, latestActivityAt: "2026-03-11T13:10:00.000Z", closedAt: null, lastInboundAt: null, lastOutboundAt: "2026-03-11T13:10:00.000Z", summary: { primaryAppointmentId: "appt_green_002", latestAppointmentId: "appt_green_002", latestThreadId: null, latestCallbackId: "callback_green_001", serviceLine: "Family Medicine", providerName: "Dr. Ramos", scheduledStart: "2026-03-11T13:00:00.000Z", scheduledEnd: "2026-03-11T13:30:00.000Z", queueStatus: null, lastChannel: "whatsapp", openActionCount: 1, pendingApprovalCount: 0 } },
      { id: "case_river_001", tenantId: "tnt_river", patientId: "pat_river_001", status: "queued", statusSource: "derived", openedAt: createdAt, latestActivityAt: "2026-03-11T13:20:00.000Z", closedAt: null, lastInboundAt: null, lastOutboundAt: null, summary: { primaryAppointmentId: "appt_river_001", latestAppointmentId: "appt_river_001", latestThreadId: null, latestCallbackId: null, serviceLine: "Internal Medicine", providerName: "Dr. Chen", scheduledStart: "2026-03-11T15:00:00.000Z", scheduledEnd: "2026-03-11T15:20:00.000Z", queueStatus: "waiting", lastChannel: "email", openActionCount: 0, pendingApprovalCount: 0 } }
    ],
    patientCaseLinks: [
      { id: "link_case_green_001_appt", tenantId: "tnt_green", patientCaseId: "case_green_001", entityType: "appointment", entityId: "appt_green_001", relationship: "primary", createdAt },
      { id: "link_case_green_001_thread", tenantId: "tnt_green", patientCaseId: "case_green_001", entityType: "conversation_thread", entityId: "thread_green_001", relationship: "primary", createdAt },
      { id: "link_case_green_002_appt", tenantId: "tnt_green", patientCaseId: "case_green_002", entityType: "appointment", entityId: "appt_green_002", relationship: "primary", createdAt },
      { id: "link_case_green_002_callback", tenantId: "tnt_green", patientCaseId: "case_green_002", entityType: "callback", entityId: "callback_green_001", relationship: "secondary", createdAt },
      { id: "link_case_river_001_appt", tenantId: "tnt_river", patientCaseId: "case_river_001", entityType: "appointment", entityId: "appt_river_001", relationship: "primary", createdAt },
      { id: "link_case_river_001_ticket", tenantId: "tnt_river", patientCaseId: "case_river_001", entityType: "queue_ticket", entityId: "ticket_river_001", relationship: "primary", createdAt }
    ],
    patientCaseTimelineEvents: [
      { id: "evt_case_green_001_open", tenantId: "tnt_green", patientCaseId: "case_green_001", type: "case_opened", title: "Case opened from booking intent", payload: { source: "bootstrap" }, createdAt },
      { id: "evt_case_green_001_appt", tenantId: "tnt_green", patientCaseId: "case_green_001", type: "appointment_created", title: "Appointment created", payload: { appointmentId: "appt_green_001" }, createdAt: "2026-03-11T12:30:00.000Z" },
      { id: "evt_case_green_002_noshow", tenantId: "tnt_green", patientCaseId: "case_green_002", type: "no_show", title: "Patient marked as no-show", payload: { appointmentId: "appt_green_002" }, createdAt: "2026-03-11T13:00:00.000Z" },
      { id: "evt_case_green_002_callback", tenantId: "tnt_green", patientCaseId: "case_green_002", type: "callback_created", title: "Recovery callback opened", payload: { callbackId: "callback_green_001" }, createdAt: "2026-03-11T13:10:00.000Z" },
      { id: "evt_case_river_001_checkin", tenantId: "tnt_river", patientCaseId: "case_river_001", type: "check_in_completed", title: "Patient checked in", payload: { appointmentId: "appt_river_001" }, createdAt: "2026-03-11T13:20:00.000Z" }
    ],
    patientCaseActions: [
      { id: "action_green_001_followup", tenantId: "tnt_green", patientCaseId: "case_green_002", action: "send_follow_up", title: "Send follow-up after no-show", status: "pending", channel: "whatsapp", rationale: "The patient missed the visit and the case remains open until follow-up is completed.", requiresHumanApproval: false, source: "system", createdAt: "2026-03-11T13:10:00.000Z", updatedAt: "2026-03-11T13:10:00.000Z", completedAt: null }
    ],
    patientCaseApprovals: [
      { id: "approval_green_001", tenantId: "tnt_green", patientCaseId: "case_green_001", type: "payment_review", status: "pending", reason: "Transfer proof must be reviewed before visit confirmation is fully cleared.", requestedBy: "system", resolvedBy: null, resolutionNotes: null, createdAt: "2026-03-11T12:45:00.000Z", updatedAt: "2026-03-11T12:45:00.000Z", resolvedAt: null }
    ],
    appointments: [
      { id: "appt_green_001", tenantId: "tnt_green", patientCaseId: "case_green_001", locationId: "loc_green_main", patientId: "pat_green_001", providerName: "Dra. Vega", serviceLine: "General Medicine", status: "scheduled", scheduledStart: "2026-03-11T14:00:00.000Z", scheduledEnd: "2026-03-11T14:30:00.000Z", createdAt },
      { id: "appt_green_002", tenantId: "tnt_green", patientCaseId: "case_green_002", locationId: "loc_green_main", patientId: "pat_green_002", providerName: "Dr. Ramos", serviceLine: "Family Medicine", status: "no_show", scheduledStart: "2026-03-11T13:00:00.000Z", scheduledEnd: "2026-03-11T13:30:00.000Z", createdAt },
      { id: "appt_river_001", tenantId: "tnt_river", patientCaseId: "case_river_001", locationId: "loc_river_main", patientId: "pat_river_001", providerName: "Dr. Chen", serviceLine: "Internal Medicine", status: "checked_in", scheduledStart: "2026-03-11T15:00:00.000Z", scheduledEnd: "2026-03-11T15:20:00.000Z", createdAt }
    ],
    flowEvents: [
      { id: "flow_green_001", tenantId: "tnt_green", patientCaseId: "case_green_001", appointmentId: "appt_green_001", type: "appointment_created", payload: { channel: "web" }, createdAt },
      { id: "flow_green_002", tenantId: "tnt_green", patientCaseId: "case_green_002", appointmentId: "appt_green_002", type: "no_show", payload: { reason: "seed_state" }, createdAt },
      { id: "flow_river_001", tenantId: "tnt_river", patientCaseId: "case_river_001", appointmentId: "appt_river_001", type: "check_in_completed", payload: { source: "patient_link" }, createdAt }
    ],
    queueTickets: [
      { id: "ticket_river_001", tenantId: "tnt_river", patientCaseId: "case_river_001", locationId: "loc_river_main", appointmentId: "appt_river_001", patientLabel: "MF", ticketNumber: "R-014", status: "waiting", createdAt }
    ],
    conversationThreads: [
      { id: "thread_green_001", tenantId: "tnt_green", patientCaseId: "case_green_001", appointmentId: "appt_green_001", channel: "whatsapp", status: "open", messages: [{ id: "msg_green_001", role: "patient", body: "Quiero confirmar mi cita.", createdAt }], createdAt }
    ],
    agentTasks: [
      {
        id: "task_green_001",
        tenantId: "tnt_green",
        patientCaseId: "case_green_002",
        appointmentId: "appt_green_002",
        type: "no_show_recovery",
        status: "pending",
        recommendation: {
          recommendedAction: "recover_no_show",
          intent: "unknown",
          summary: "Enviar un follow-up operativo para rescatar el no-show.",
          whyNow: "La cita quedó marcada como no-show y aún no hay evidencia de cierre del caso.",
          riskIfIgnored: "El case puede perderse y quedar sin continuidad operativa.",
          confidence: 0.8,
          blockedBy: [],
          requiresHumanApproval: true,
          degraded: true,
          providerName: "bootstrap_seed",
          evidenceRefs: [
            { kind: "patient_case", entityId: "case_green_002", label: "case:follow_up_pending" },
            { kind: "appointment", entityId: "appt_green_002", label: "appointment:no_show" }
          ]
        },
        createdAt
      }
    ],
    preparedActions: [],
    preparedActionDispatchJobs: [],
    copilotExecutionReceipts: [],
    copilotExecutionReceiptEvents: [],
    callbacks: [
      { id: "callback_green_001", tenantId: "tnt_green", patientCaseId: "case_green_002", patientId: "pat_green_002", channel: "whatsapp", notes: "Recordatorio de rescate tras no-show.", status: "qualified", createdAt: "2026-03-11T13:10:00.000Z" }
    ],
    playbooks: [
      { id: "playbook_green_001", tenantId: "tnt_green", name: "No-show Recovery", triggerKey: "no_show", isEnabled: true, config: { contactWindowMinutes: 15, channel: "whatsapp" }, createdAt }
    ],
    auditEntries: [
      { id: "audit_green_001", tenantId: "tnt_green", actorType: "system", actorId: "bootstrap", action: "seeded_bootstrap_state", entityType: "tenant", entityId: "tnt_green", metadata: { surface: "ops_console" }, createdAt }
    ],
    copilotReviewDecisions: []
  });
}

export class InMemoryPlatformRepository implements PlatformRepository {
  private readonly state: BootstrapState;

  constructor(seedState: BootstrapState = createBootstrapState()) {
    this.state = structuredClone(seedState);
  }

  exportState(): BootstrapState {
    return BootstrapStateSchema.parse(structuredClone(this.state));
  }

  listTenants(): TenantConfig[] {
    return [...this.state.tenantConfigs];
  }

  getTenantById(tenantId: string): TenantConfig | undefined {
    return this.state.tenantConfigs.find((tenant) => tenant.id === tenantId);
  }

  getTenantBySlug(slug: string): TenantConfig | undefined {
    return this.state.tenantConfigs.find((tenant) => tenant.slug === slug);
  }

  getLocationById(tenantId: string, locationId: string): Location | undefined {
    return this.state.locations.find(
      (location) => location.tenantId === tenantId && location.id === locationId
    );
  }

  getLocationBySlug(tenantId: string, slug: string): Location | undefined {
    return this.state.locations.find((location) => location.tenantId === tenantId && location.slug === slug);
  }

  listAppointments(tenantId: string): Appointment[] {
    return this.state.appointments.filter((appointment) => appointment.tenantId === tenantId);
  }

  getAppointment(tenantId: string, appointmentId: string): Appointment | undefined {
    return this.state.appointments.find(
      (appointment) => appointment.tenantId === tenantId && appointment.id === appointmentId
    );
  }

  listQueue(tenantId: string): QueueTicket[] {
    return this.state.queueTickets.filter((ticket) => ticket.tenantId === tenantId);
  }

  getQueueTicket(tenantId: string, ticketId: string): QueueTicket | undefined {
    return this.state.queueTickets.find((ticket) => ticket.tenantId === tenantId && ticket.id === ticketId);
  }

  listThreads(tenantId: string): ConversationThread[] {
    return this.state.conversationThreads.filter((thread) => thread.tenantId === tenantId);
  }

  listAgentTasks(tenantId: string): AgentTask[] {
    return this.state.agentTasks.filter((task) => task.tenantId === tenantId);
  }

  listPreparedActions(tenantId: string, caseId?: string): PersistedPreparedAction[] {
    return this.state.preparedActions
      .filter((preparedAction) => preparedAction.tenantId === tenantId)
      .filter((preparedAction) => !caseId || preparedAction.patientCaseId === caseId)
      .slice()
      .sort((left, right) => {
        const caseDelta = left.patientCaseId.localeCompare(right.patientCaseId);
        if (caseDelta !== 0) {
          return caseDelta;
        }
        return right.version - left.version;
      });
  }

  getPreparedAction(tenantId: string, preparedActionId: string): PersistedPreparedAction | undefined {
    return this.state.preparedActions.find(
      (preparedAction) => preparedAction.tenantId === tenantId && preparedAction.id === preparedActionId
    );
  }

  listPreparedActionDispatchJobs(
    tenantId: string,
    caseId?: string,
    preparedActionId?: string
  ): PreparedActionDispatchJob[] {
    return this.state.preparedActionDispatchJobs
      .filter((dispatchJob) => dispatchJob.tenantId === tenantId)
      .filter((dispatchJob) => !caseId || dispatchJob.patientCaseId === caseId)
      .filter((dispatchJob) => !preparedActionId || dispatchJob.preparedActionId === preparedActionId)
      .slice()
      .sort((left, right) => {
        const requestedDelta = right.requestedAt.localeCompare(left.requestedAt);
        if (requestedDelta !== 0) {
          return requestedDelta;
        }
        return right.attempt - left.attempt;
      });
  }

  listCopilotExecutionReceipts(
    tenantId: string,
    caseId?: string,
    filters?: {
      preparedActionId?: string;
      dispatchJobId?: string;
      system?: string;
    }
  ): CopilotExecutionReceiptRecord[] {
    return this.state.copilotExecutionReceipts
      .filter((receiptRecord) => receiptRecord.tenantId === tenantId)
      .filter((receiptRecord) => !caseId || receiptRecord.patientCaseId === caseId)
      .filter(
        (receiptRecord) =>
          !filters?.preparedActionId || receiptRecord.preparedActionId === filters.preparedActionId
      )
      .filter(
        (receiptRecord) =>
          !filters?.dispatchJobId || receiptRecord.dispatchJobId === filters.dispatchJobId
      )
      .filter(
        (receiptRecord) =>
          !filters?.system ||
          receiptRecord.receipt.system === filters.system ||
          receiptRecord.destinationSystem === filters.system
      )
      .slice()
      .sort((left, right) => {
        const recordedDelta = right.recordedAt.localeCompare(left.recordedAt);
        if (recordedDelta !== 0) {
          return recordedDelta;
        }
        return right.id.localeCompare(left.id);
      });
  }

  listCopilotExecutionReceiptEvents(
    tenantId: string,
    caseId?: string,
    filters?: {
      receiptRecordId?: string;
      preparedActionId?: string;
      dispatchJobId?: string;
      system?: string;
    }
  ): CopilotExecutionReceiptEvent[] {
    return this.state.copilotExecutionReceiptEvents
      .filter((event) => event.tenantId === tenantId)
      .filter((event) => !caseId || event.patientCaseId === caseId)
      .filter((event) => !filters?.receiptRecordId || event.receiptRecordId === filters.receiptRecordId)
      .filter(
        (event) => !filters?.preparedActionId || event.preparedActionId === filters.preparedActionId
      )
      .filter((event) => !filters?.dispatchJobId || event.dispatchJobId === filters.dispatchJobId)
      .filter((event) => !filters?.system || event.system === filters.system)
      .slice()
      .sort((left, right) => {
        const occurredDelta = right.occurredAt.localeCompare(left.occurredAt);
        if (occurredDelta !== 0) {
          return occurredDelta;
        }
        return right.id.localeCompare(left.id);
      });
  }

  getPreparedActionDispatchJob(tenantId: string, dispatchJobId: string): PreparedActionDispatchJob | undefined {
    return this.state.preparedActionDispatchJobs.find(
      (dispatchJob) => dispatchJob.tenantId === tenantId && dispatchJob.id === dispatchJobId
    );
  }

  listAudit(tenantId: string): AuditEntry[] {
    return this.state.auditEntries.filter((entry) => entry.tenantId === tenantId);
  }

  listPatientCases(tenantId: string): PatientCase[] {
    return this.state.patientCases
      .filter((patientCase) => patientCase.tenantId === tenantId)
      .sort((left, right) => right.latestActivityAt.localeCompare(left.latestActivityAt));
  }

  listPatientCaseSnapshots(tenantId: string): PatientCaseSnapshot[] {
    return this.listPatientCases(tenantId)
      .map((patientCase) => this.getPatientCaseSnapshot(tenantId, patientCase.id))
      .filter((snapshot): snapshot is PatientCaseSnapshot => Boolean(snapshot));
  }

  getPatientCaseSnapshot(tenantId: string, caseId: string): PatientCaseSnapshot | undefined {
    const patientCase = this.getCase(tenantId, caseId);
    if (!patientCase) {
      return undefined;
    }
    this.refreshCase(tenantId, caseId);
    const refreshedCase = this.getCase(tenantId, caseId);
    if (!refreshedCase) {
      return undefined;
    }
    const patient = this.getPatient(refreshedCase.patientId);
    if (!patient) {
      return undefined;
    }
    return {
      case: structuredClone(refreshedCase),
      patient: structuredClone(patient),
      appointments: this.state.appointments.filter((appointment) => appointment.tenantId === tenantId && appointment.patientCaseId === caseId),
      queueTickets: this.state.queueTickets.filter((ticket) => ticket.tenantId === tenantId && ticket.patientCaseId === caseId),
      conversationThreads: this.state.conversationThreads.filter((thread) => thread.tenantId === tenantId && thread.patientCaseId === caseId),
      callbacks: this.state.callbacks.filter((callback) => callback.tenantId === tenantId && callback.patientCaseId === caseId),
      agentTasks: this.state.agentTasks.filter((task) => task.tenantId === tenantId && task.patientCaseId === caseId),
      preparedActions: this.state.preparedActions.filter((preparedAction) => preparedAction.tenantId === tenantId && preparedAction.patientCaseId === caseId),
      preparedActionDispatchJobs: this.state.preparedActionDispatchJobs.filter(
        (dispatchJob) => dispatchJob.tenantId === tenantId && dispatchJob.patientCaseId === caseId
      ),
      copilotExecutionReceipts: this.listCopilotExecutionReceipts(tenantId, caseId),
      copilotExecutionReceiptEvents: this.listCopilotExecutionReceiptEvents(tenantId, caseId),
      timeline: this.listPatientCaseTimeline(tenantId, caseId),
      actions: this.state.patientCaseActions.filter((action) => action.tenantId === tenantId && action.patientCaseId === caseId),
      approvals: this.state.patientCaseApprovals.filter((approval) => approval.tenantId === tenantId && approval.patientCaseId === caseId),
      links: this.state.patientCaseLinks.filter((link) => link.tenantId === tenantId && link.patientCaseId === caseId),
      copilotReviewDecisions: this.state.copilotReviewDecisions.filter((review) => review.tenantId === tenantId && review.patientCaseId === caseId)
    };
  }

  listPatientCaseTimeline(tenantId: string, caseId: string): PatientCaseTimelineEvent[] {
    return this.state.patientCaseTimelineEvents
      .filter((event) => event.tenantId === tenantId && event.patientCaseId === caseId)
      .sort((left, right) => left.createdAt.localeCompare(right.createdAt));
  }

  confirmAppointment(tenantId: string, appointmentId: string, actorType: ActorType, actorId: string): Appointment {
    const appointment = this.requireAppointment(tenantId, appointmentId);
    appointment.status = "confirmed";
    this.recordFlowEvent(tenantId, appointment.patientCaseId, appointment.id, "patient_confirmed", { source: actorId });
    this.recordTimeline(tenantId, appointment.patientCaseId, "appointment_confirmed", "Appointment confirmed", { appointmentId: appointment.id });
    this.recordAudit(tenantId, actorType, actorId, "appointment_confirmed", "appointment", appointment.id, { patientCaseId: appointment.patientCaseId });
    this.refreshCase(tenantId, appointment.patientCaseId);
    return structuredClone(appointment);
  }

  requestReschedule(tenantId: string, appointmentId: string, actorType: ActorType, actorId: string): Appointment {
    const appointment = this.requireAppointment(tenantId, appointmentId);
    appointment.status = "reschedule_requested";
    this.recordFlowEvent(tenantId, appointment.patientCaseId, appointment.id, "reschedule_requested", { source: actorId });
    this.recordTimeline(tenantId, appointment.patientCaseId, "reschedule_requested", "Reschedule requested", { appointmentId: appointment.id });
    this.createCaseAction(tenantId, appointment.patientCaseId, { action: "request_reschedule", title: "Review reschedule request", rationale: "The patient asked to reschedule and Ops must confirm the new slot.", channel: "ops", source: actorType === "patient" ? "patient" : "system" });
    this.createAgentTask(tenantId, appointment.patientCaseId, "reschedule_suggestion", {
      recommendedAction: "propose_reschedule",
      intent: "request_reschedule",
      summary: "Revisar solicitud de reprogramación del caso.",
      whyNow: "La cita pasó a reschedule_requested y requiere seguimiento operativo.",
      riskIfIgnored: "El case puede enfriarse mientras la agenda sigue en un estado ambiguo.",
      confidence: 0.8,
      blockedBy: [],
      requiresHumanApproval: true,
      degraded: true,
      providerName: actorId,
      evidenceRefs: [
        { kind: "patient_case", entityId: appointment.patientCaseId, label: "case:awaiting_booking" },
        { kind: "appointment", entityId: appointment.id, label: "appointment:reschedule_requested" }
      ]
    }, appointment.id);
    this.recordAudit(tenantId, actorType, actorId, "appointment_reschedule_requested", "appointment", appointment.id, { patientCaseId: appointment.patientCaseId });
    this.refreshCase(tenantId, appointment.patientCaseId);
    return structuredClone(appointment);
  }

  checkInAppointment(tenantId: string, appointmentId: string, actorType: ActorType, actorId: string): Appointment {
    const appointment = this.requireAppointment(tenantId, appointmentId);
    appointment.status = "checked_in";
    const existing = this.state.queueTickets.find((ticket) => ticket.tenantId === tenantId && ticket.appointmentId === appointmentId);
    if (existing) {
      existing.status = "waiting";
    } else {
      const patient = this.requirePatient(appointment.patientId);
      const ticket: QueueTicket = { id: makeId("ticket"), tenantId, patientCaseId: appointment.patientCaseId, locationId: appointment.locationId, appointmentId, patientLabel: toPatientLabel(patient.displayName), ticketNumber: `${tenantId === "tnt_green" ? "G" : "R"}-${String(this.state.queueTickets.length + 1).padStart(3, "0")}`, status: "waiting", createdAt: nowIso() };
      this.state.queueTickets.push(ticket);
      this.addCaseLink(tenantId, appointment.patientCaseId, "queue_ticket", ticket.id, "primary");
    }
    this.recordFlowEvent(tenantId, appointment.patientCaseId, appointment.id, "check_in_completed", { source: actorId });
    this.recordTimeline(tenantId, appointment.patientCaseId, "check_in_completed", "Patient checked in", { appointmentId: appointment.id });
    this.recordAudit(tenantId, actorType, actorId, "appointment_checked_in", "appointment", appointment.id, { patientCaseId: appointment.patientCaseId });
    this.refreshCase(tenantId, appointment.patientCaseId);
    return structuredClone(appointment);
  }

  markNoShow(tenantId: string, appointmentId: string, actorType: ActorType, actorId: string): Appointment {
    const appointment = this.requireAppointment(tenantId, appointmentId);
    appointment.status = "no_show";
    this.recordFlowEvent(tenantId, appointment.patientCaseId, appointment.id, "no_show", { source: actorId });
    this.recordTimeline(tenantId, appointment.patientCaseId, "no_show", "Patient marked as no-show", { appointmentId: appointment.id });
    this.ensureFollowUpAction(tenantId, appointment.patientCaseId);
    this.recordAudit(tenantId, actorType, actorId, "appointment_no_show", "appointment", appointment.id, { patientCaseId: appointment.patientCaseId });
    this.refreshCase(tenantId, appointment.patientCaseId);
    return structuredClone(appointment);
  }

  callQueueTicket(tenantId: string, ticketId: string, actorType: ActorType, actorId: string): QueueTicket {
    const ticket = this.requireQueueTicket(tenantId, ticketId);
    ticket.status = "called";
    const appointment = ticket.appointmentId ? this.getAppointment(tenantId, ticket.appointmentId) : undefined;
    if (appointment) {
      appointment.status = "called";
    }
    this.recordFlowEvent(tenantId, ticket.patientCaseId, appointment?.id ?? null, "queue_called", { ticketId: ticket.id });
    this.recordTimeline(tenantId, ticket.patientCaseId, "queue_called", "Queue ticket called", { ticketId: ticket.id });
    this.recordAudit(tenantId, actorType, actorId, "queue_ticket_called", "queue_ticket", ticket.id, { patientCaseId: ticket.patientCaseId });
    this.refreshCase(tenantId, ticket.patientCaseId);
    return structuredClone(ticket);
  }

  completeQueueTicket(tenantId: string, ticketId: string, actorType: ActorType, actorId: string): QueueTicket {
    const ticket = this.requireQueueTicket(tenantId, ticketId);
    ticket.status = "completed";
    const appointment = ticket.appointmentId ? this.getAppointment(tenantId, ticket.appointmentId) : undefined;
    if (appointment) {
      appointment.status = "completed";
    }
    this.recordFlowEvent(tenantId, ticket.patientCaseId, appointment?.id ?? null, "visit_completed", { ticketId: ticket.id });
    this.recordTimeline(tenantId, ticket.patientCaseId, "visit_completed", "Visit completed", { ticketId: ticket.id });
    this.ensureFollowUpAction(tenantId, ticket.patientCaseId);
    this.recordAudit(tenantId, actorType, actorId, "queue_ticket_completed", "queue_ticket", ticket.id, { patientCaseId: ticket.patientCaseId });
    this.refreshCase(tenantId, ticket.patientCaseId);
    return structuredClone(ticket);
  }

  appendConversationMessage(
    tenantId: string,
    caseId: string,
    role: ConversationMessage["role"],
    body: string,
    channelOverride?: Patient["preferredChannel"]
  ): ConversationThread {
    const patientCase = this.requireCase(tenantId, caseId);
    const thread = this.ensureThread(tenantId, caseId, channelOverride);
    thread.messages.push({ id: makeId("msg"), role, body, createdAt: nowIso() });
    this.recordTimeline(tenantId, caseId, role === "patient" ? "message_received" : "message_sent", role === "patient" ? "Patient sent a message" : "Agent or staff sent a message", { threadId: thread.id, role });
    if (role === "patient") {
      patientCase.lastInboundAt = nowIso();
    } else {
      patientCase.lastOutboundAt = nowIso();
    }
    this.refreshCase(tenantId, caseId);
    return structuredClone(thread);
  }

  createCaseAction(tenantId: string, caseId: string, payload: { action: AgentAction; title: string; rationale: string; channel?: PatientCaseAction["channel"]; requiresHumanApproval?: boolean; source?: PatientCaseAction["source"]; status?: PatientCaseAction["status"]; }): PatientCaseAction {
    this.requireCase(tenantId, caseId);
    const status = payload.status ?? "pending";
    const action: PatientCaseAction = { id: makeId("case_action"), tenantId, patientCaseId: caseId, action: payload.action, title: payload.title, status, channel: payload.channel ?? "ops", rationale: payload.rationale, requiresHumanApproval: payload.requiresHumanApproval ?? false, source: payload.source ?? "system", createdAt: nowIso(), updatedAt: nowIso(), completedAt: status === "completed" ? nowIso() : null };
    this.state.patientCaseActions.push(action);
    this.recordTimeline(tenantId, caseId, "follow_up_requested", action.title, { action: action.action, actionId: action.id });
    this.refreshCase(tenantId, caseId);
    return structuredClone(action);
  }

  resolveApproval(tenantId: string, caseId: string, approvalId: string, resolution: { decision: "approved" | "rejected"; notes?: string; actorId: string }): PatientCaseApproval {
    const approval = this.state.patientCaseApprovals.find((candidate) => candidate.tenantId === tenantId && candidate.patientCaseId === caseId && candidate.id === approvalId);
    if (!approval) {
      throw new Error("approval not found for case");
    }
    approval.status = resolution.decision;
    approval.updatedAt = nowIso();
    approval.resolvedAt = nowIso();
    approval.resolvedBy = resolution.actorId;
    approval.resolutionNotes = resolution.notes ?? null;
    this.recordFlowEvent(tenantId, caseId, null, "approval_resolved", { approvalId: approval.id, decision: approval.status });
    this.recordTimeline(tenantId, caseId, "approval_resolved", "Approval resolved", { approvalId: approval.id, decision: approval.status });
    this.recordAudit(tenantId, "staff", resolution.actorId, "case_approval_resolved", "patient_case_approval", approval.id, { patientCaseId: caseId });
    this.refreshCase(tenantId, caseId);
    return structuredClone(approval);
  }

  updateCaseStatus(tenantId: string, caseId: string, status: PatientCaseStatus, actorId: string): PatientCase {
    const patientCase = this.requireCase(tenantId, caseId);
    patientCase.status = status;
    patientCase.statusSource = "manual";
    patientCase.latestActivityAt = nowIso();
    patientCase.closedAt = status === "closed" ? nowIso() : null;
    this.recordTimeline(tenantId, caseId, "status_changed", "Case status changed", { status });
    this.recordAudit(tenantId, "staff", actorId, "patient_case_status_changed", "patient_case", caseId, { status });
    this.refreshCase(tenantId, caseId);
    return structuredClone(patientCase);
  }

  createCallback(tenantId: string, payload: { patientId?: string; patient?: { displayName: string; phone: string; email?: string | null; preferredChannel: Patient["preferredChannel"] }; notes: string; channel: CallbackLead["channel"]; }): CallbackLead {
    const patient = this.resolvePatient(tenantId, payload.patientId, payload.patient);
    const activeCase = this.resolveOrCreateActiveCase(tenantId, patient.id, { lastChannel: payload.channel });
    const callback: CallbackLead = { id: makeId("callback"), tenantId, patientCaseId: activeCase.id, patientId: patient.id, channel: payload.channel, notes: payload.notes, status: "new", createdAt: nowIso() };
    this.state.callbacks.push(callback);
    this.addCaseLink(tenantId, activeCase.id, "callback", callback.id, "secondary");
    this.recordFlowEvent(tenantId, activeCase.id, null, "callback_created", { callbackId: callback.id });
    this.recordTimeline(tenantId, activeCase.id, "callback_created", "Callback created", { callbackId: callback.id });
    this.recordAudit(tenantId, "staff", "ops_console", "callback_created", "callback", callback.id, { patientCaseId: activeCase.id });
    this.refreshCase(tenantId, activeCase.id);
    return structuredClone(callback);
  }

  createAgentTask(tenantId: string, caseId: string, type: AgentTask["type"], recommendation: AgentRecommendation, appointmentId?: string | null): AgentTask {
    this.requireCase(tenantId, caseId);
    const task: AgentTask = { id: makeId("task"), tenantId, patientCaseId: caseId, appointmentId: appointmentId ?? null, type, status: "pending", recommendation, createdAt: nowIso() };
    this.state.agentTasks.push(task);
    this.addCaseLink(tenantId, caseId, "agent_task", task.id, "secondary");
    this.refreshCase(tenantId, caseId);
    return structuredClone(task);
  }

  savePreparedAction(
    tenantId: string,
    caseId: string,
    packet: PreparedActionPacket,
    basisLatestActivityAt: string,
    fingerprint: string
  ): PersistedPreparedAction {
    this.requireCase(tenantId, caseId);
    const current = this.state.preparedActions
      .filter((preparedAction) => preparedAction.tenantId === tenantId && preparedAction.patientCaseId === caseId)
      .slice()
      .sort((left, right) => right.version - left.version);
    const reusable = current.find(
      (preparedAction) =>
        preparedAction.status === "pending" && preparedAction.fingerprint === fingerprint
    );
    if (reusable) {
      return structuredClone(reusable);
    }

    const now = nowIso();
    for (const preparedAction of current.filter((candidate) => candidate.status === "pending")) {
      preparedAction.status = "superseded";
      preparedAction.staleReason = "superseded_by_newer_prepared_action";
      preparedAction.updatedAt = now;
    }

    const persisted: PersistedPreparedAction = {
      ...packet,
      tenantId,
      patientCaseId: caseId,
      version: (current[0]?.version ?? 0) + 1,
      status: "pending",
      fingerprint,
      basisLatestActivityAt,
      executionCount: 0,
      staleReason: null,
      createdAt: now,
      updatedAt: now,
      executedAt: null
    };
    this.state.preparedActions.push(persisted);
    this.addCaseLink(tenantId, caseId, "prepared_action", persisted.id, "secondary");
    this.recordAudit(tenantId, "agent", "patient_case_copilot", "prepared_action_saved", "prepared_action", persisted.id, {
      patientCaseId: caseId,
      version: persisted.version,
      status: persisted.status
    });
    this.refreshCase(tenantId, caseId);
    return structuredClone(persisted);
  }

  updatePreparedActionStatus(
    tenantId: string,
    preparedActionId: string,
    payload: {
      status: PreparedActionStatus;
      actorId: string;
      staleReason?: string | null;
      executed?: boolean;
    }
  ): PersistedPreparedAction {
    const preparedAction = this.requirePreparedAction(tenantId, preparedActionId);
    preparedAction.status = payload.status;
    preparedAction.staleReason = payload.staleReason ?? null;
    preparedAction.updatedAt = nowIso();
    if (payload.executed || payload.status === "executed") {
      preparedAction.executionCount += 1;
      preparedAction.executedAt = nowIso();
      this.recordTimeline(tenantId, preparedAction.patientCaseId, "copilot_executed", `Prepared action executed`, {
        preparedActionId: preparedAction.id,
        recommendationAction: preparedAction.recommendedAction
      });
    }
    this.recordAudit(tenantId, "staff", payload.actorId, "prepared_action_status_changed", "prepared_action", preparedAction.id, {
      patientCaseId: preparedAction.patientCaseId,
      status: preparedAction.status,
      staleReason: preparedAction.staleReason
    });
    this.refreshCase(tenantId, preparedAction.patientCaseId);
    return structuredClone(preparedAction);
  }

  createPreparedActionDispatchJob(
    tenantId: string,
    caseId: string,
    preparedActionId: string,
    payload: {
      trigger: PreparedActionDispatchTrigger;
      actorId: string;
      messageOverride?: string | null;
      availableAt?: string | null;
    }
  ): PreparedActionDispatchJob {
    this.requireCase(tenantId, caseId);
    const preparedAction = this.requirePreparedAction(tenantId, preparedActionId);
    if (preparedAction.patientCaseId !== caseId) {
      throw new Error("prepared action does not belong to patient case");
    }
    if (preparedAction.status !== "pending") {
      throw new Error("prepared action is no longer pending");
    }

    const attempt =
      this.state.preparedActionDispatchJobs.filter(
        (dispatchJob) =>
          dispatchJob.tenantId === tenantId && dispatchJob.preparedActionId === preparedActionId
      ).length + 1;
    const requestedAt = nowIso();
    const dispatchJob: PreparedActionDispatchJob = {
      id: makeId("prepared_dispatch"),
      tenantId,
      patientCaseId: caseId,
      preparedActionId,
      trigger: payload.trigger,
      status: "queued",
      actorId: payload.actorId,
      attempt,
      messageOverride: payload.messageOverride ?? null,
      lastError: null,
      execution: null,
      requestedAt,
      availableAt: payload.availableAt ?? requestedAt,
      leaseOwner: null,
      leaseExpiresAt: null,
      startedAt: null,
      finishedAt: null
    };

    this.state.preparedActionDispatchJobs.push(dispatchJob);
    this.addCaseLink(tenantId, caseId, "prepared_action_dispatch", dispatchJob.id, "secondary");
    this.recordTimeline(tenantId, caseId, "copilot_dispatch_queued", "Prepared action queued for execution", {
      preparedActionId,
      dispatchJobId: dispatchJob.id,
      trigger: dispatchJob.trigger,
      attempt: dispatchJob.attempt
    });
    this.recordAudit(
      tenantId,
      "staff",
      payload.actorId,
      "prepared_action_dispatch_created",
      "prepared_action_dispatch",
      dispatchJob.id,
      {
        patientCaseId: caseId,
        preparedActionId,
        trigger: dispatchJob.trigger,
        attempt: dispatchJob.attempt
      }
    );
    this.refreshCase(tenantId, caseId);
    return structuredClone(dispatchJob);
  }

  claimPreparedActionDispatchJobs(payload: {
    tenantId?: string;
    workerId: string;
    limit: number;
    leaseTtlMs?: number;
    now?: string;
  }): PreparedActionDispatchJob[] {
    const now = payload.now ?? nowIso();
    const leaseExpiresAt = addMilliseconds(now, payload.leaseTtlMs ?? 60_000);
    const candidates = this.state.preparedActionDispatchJobs
      .filter((dispatchJob) => !payload.tenantId || dispatchJob.tenantId === payload.tenantId)
      .filter((dispatchJob) => dispatchJob.status === "queued")
      .filter((dispatchJob) => dispatchJob.availableAt.localeCompare(now) <= 0)
      .slice()
      .sort((left, right) => {
        const requestedDelta = left.requestedAt.localeCompare(right.requestedAt);
        if (requestedDelta !== 0) {
          return requestedDelta;
        }
        return left.attempt - right.attempt;
      })
      .slice(0, payload.limit);

    return candidates.map((dispatchJob) =>
      this.updatePreparedActionDispatchJob(dispatchJob.tenantId, dispatchJob.id, {
        status: "running",
        actorId: payload.workerId,
        startedAt: dispatchJob.startedAt ?? now,
        finishedAt: null,
        lastError: null,
        leaseOwner: payload.workerId,
        leaseExpiresAt
      })
    );
  }

  updatePreparedActionDispatchJob(
    tenantId: string,
    dispatchJobId: string,
    payload: {
      status: PreparedActionDispatchStatus;
      actorId: string;
      availableAt?: string | null;
      leaseOwner?: string | null;
      leaseExpiresAt?: string | null;
      startedAt?: string | null;
      finishedAt?: string | null;
      lastError?: string | null;
      execution?: CopilotExecutionResult | null;
    }
  ): PreparedActionDispatchJob {
    const dispatchJob = this.requirePreparedActionDispatchJob(tenantId, dispatchJobId);
    dispatchJob.status = payload.status;
    if (payload.availableAt !== undefined && payload.availableAt !== null) {
      dispatchJob.availableAt = payload.availableAt;
    }
    dispatchJob.startedAt =
      payload.startedAt !== undefined
        ? payload.startedAt
        : payload.status === "running" && !dispatchJob.startedAt
          ? nowIso()
          : dispatchJob.startedAt;
    dispatchJob.finishedAt =
      payload.finishedAt !== undefined
        ? payload.finishedAt
        : payload.status === "running"
          ? null
        : payload.status === "succeeded" || payload.status === "failed"
          ? nowIso()
          : dispatchJob.finishedAt;
    dispatchJob.leaseOwner =
      payload.leaseOwner !== undefined
        ? payload.leaseOwner
        : payload.status === "succeeded" || payload.status === "failed"
          ? null
          : dispatchJob.leaseOwner;
    dispatchJob.leaseExpiresAt =
      payload.leaseExpiresAt !== undefined
        ? payload.leaseExpiresAt
        : payload.status === "succeeded" || payload.status === "failed"
          ? null
          : dispatchJob.leaseExpiresAt;
    if (payload.lastError !== undefined) {
      dispatchJob.lastError = payload.lastError;
    } else if (payload.status === "running" || payload.status === "succeeded") {
      dispatchJob.lastError = null;
    }
    if (payload.execution !== undefined) {
      dispatchJob.execution = payload.execution;
    }

    this.replaceCopilotExecutionReceiptsForDispatchJob(dispatchJob);

    if (dispatchJob.status === "failed") {
      this.recordTimeline(
        tenantId,
        dispatchJob.patientCaseId,
        "copilot_dispatch_failed",
        "Prepared action execution failed",
        {
          dispatchJobId: dispatchJob.id,
          preparedActionId: dispatchJob.preparedActionId,
          lastError: dispatchJob.lastError
        }
      );
    }

    this.recordAudit(
      tenantId,
      "staff",
      payload.actorId,
      "prepared_action_dispatch_status_changed",
      "prepared_action_dispatch",
      dispatchJob.id,
      {
        patientCaseId: dispatchJob.patientCaseId,
        preparedActionId: dispatchJob.preparedActionId,
        status: dispatchJob.status,
        lastError: dispatchJob.lastError
      }
    );
    this.refreshCase(tenantId, dispatchJob.patientCaseId);
    return structuredClone(dispatchJob);
  }

  updateAgentTaskStatus(tenantId: string, taskId: string, status: AgentTask["status"], actorId: string): AgentTask {
    const task = this.requireAgentTask(tenantId, taskId);
    task.status = status;
    this.recordAudit(tenantId, "staff", actorId, "agent_task_status_changed", "agent_task", task.id, {
      patientCaseId: task.patientCaseId,
      status
    });
    this.refreshCase(tenantId, task.patientCaseId);
    return structuredClone(task);
  }

  updateCaseActionStatus(
    tenantId: string,
    caseId: string,
    actionId: string,
    status: PatientCaseAction["status"],
    actorId: string
  ): PatientCaseAction {
    const action = this.requireCaseAction(tenantId, caseId, actionId);
    action.status = status;
    action.updatedAt = nowIso();
    action.completedAt = status === "completed" ? nowIso() : null;
    this.recordTimeline(tenantId, caseId, "status_changed", "Case action status changed", {
      actionId: action.id,
      action: action.action,
      status
    });
    this.recordAudit(tenantId, "staff", actorId, "patient_case_action_status_changed", "patient_case_action", action.id, {
      patientCaseId: caseId,
      status
    });
    this.refreshCase(tenantId, caseId);
    return structuredClone(action);
  }

  recordCopilotReviewDecision(
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
    this.requireCase(tenantId, caseId);
    const review: CopilotReviewDecision = {
      id: makeId("copilot_review"),
      tenantId,
      patientCaseId: caseId,
      recommendationAction: payload.recommendationAction,
      decision: payload.decision,
      actor: payload.actor,
      timestamp: nowIso(),
      note: payload.note ?? null,
      preparedActionId: payload.preparedActionId ?? null
    };
    this.state.copilotReviewDecisions.push(review);
    this.addCaseLink(tenantId, caseId, "copilot_review", review.id, "secondary");
    this.recordTimeline(tenantId, caseId, "copilot_reviewed", `Copilot review: ${payload.decision}`, {
      recommendationAction: payload.recommendationAction,
      decision: payload.decision,
      preparedActionId: payload.preparedActionId ?? null
    });
    this.recordAudit(tenantId, "staff", payload.actor, "copilot_review_recorded", "copilot_review", review.id, {
      patientCaseId: caseId,
      recommendationAction: payload.recommendationAction,
      decision: payload.decision
    });
    this.refreshCase(tenantId, caseId);
    return structuredClone(review);
  }

  recordCopilotExecutionReceiptEvent(
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
  ): {
    receipt: CopilotExecutionReceiptRecord;
    event: CopilotExecutionReceiptEvent;
  } {
    const receiptRecord = this.resolveCopilotExecutionReceiptRecordForEvent(tenantId, payload);
    const occurredAt = payload.occurredAt ?? nowIso();
    const duplicateEvent = this.state.copilotExecutionReceiptEvents.find(
      (event) =>
        event.tenantId === tenantId &&
        event.receiptRecordId === receiptRecord.id &&
        event.eventType === payload.eventType &&
        event.occurredAt === occurredAt &&
        event.idempotencyKey === receiptRecord.receipt.idempotencyKey &&
        event.externalRef === (payload.externalRef ?? receiptRecord.receipt.externalRef)
    );

    if (duplicateEvent) {
      return {
        receipt: structuredClone(receiptRecord),
        event: structuredClone(duplicateEvent)
      };
    }

    const providerStatus = providerStatusForReceiptEvent(payload.eventType);
    receiptRecord.providerStatus = providerStatus;
    receiptRecord.providerConfirmedAt = providerStatus === "failed" ? null : occurredAt;
    receiptRecord.lastProviderEventAt = occurredAt;
    receiptRecord.lastProviderError =
      providerStatus === "failed"
        ? payload.error ??
          (typeof payload.payload?.message === "string" ? payload.payload.message : "provider delivery failed")
        : null;

    const event: CopilotExecutionReceiptEvent = {
      id: makeId("copilot_receipt_evt"),
      tenantId,
      patientCaseId: receiptRecord.patientCaseId,
      preparedActionId: receiptRecord.preparedActionId,
      dispatchJobId: receiptRecord.dispatchJobId,
      receiptRecordId: receiptRecord.id,
      system: payload.system,
      eventType: payload.eventType,
      providerStatus,
      idempotencyKey: receiptRecord.receipt.idempotencyKey,
      externalRef: payload.externalRef ?? receiptRecord.receipt.externalRef,
      payload: payload.payload ?? {},
      occurredAt,
      recordedAt: nowIso()
    };

    this.state.copilotExecutionReceiptEvents.push(event);
    this.recordTimeline(
      tenantId,
      receiptRecord.patientCaseId,
      "copilot_receipt_updated",
      `Provider ${providerStatus} receipt`,
      {
        receiptRecordId: receiptRecord.id,
        dispatchJobId: receiptRecord.dispatchJobId,
        system: receiptRecord.receipt.system,
        eventType: payload.eventType,
        providerStatus
      }
    );
    this.recordAudit(
      tenantId,
      "system",
      `${payload.system}_webhook`,
      "copilot_execution_receipt_event_recorded",
      "copilot_execution_receipt",
      receiptRecord.id,
      {
        patientCaseId: receiptRecord.patientCaseId,
        dispatchJobId: receiptRecord.dispatchJobId,
        eventType: payload.eventType,
        providerStatus
      }
    );
    this.refreshCase(tenantId, receiptRecord.patientCaseId);

    return {
      receipt: structuredClone(receiptRecord),
      event: structuredClone(event)
    };
  }

  getKpiReport(tenantId: string): KPIReport {
    const cases = this.listPatientCases(tenantId);
    const appointments = this.listAppointments(tenantId);
    const queue = this.listQueue(tenantId);
    const tasks = this.listAgentTasks(tenantId);
    return { tenantId, generatedAt: nowIso(), activeCases: cases.filter((patientCase) => patientCase.status !== "closed").length, appointmentsScheduled: appointments.length, appointmentsConfirmed: appointments.filter((appointment) => appointment.status === "confirmed").length, checkedIn: appointments.filter((appointment) => appointment.status === "checked_in").length, completed: appointments.filter((appointment) => appointment.status === "completed").length, noShow: appointments.filter((appointment) => appointment.status === "no_show").length, waiting: queue.filter((ticket) => ticket.status === "waiting").length, called: queue.filter((ticket) => ticket.status === "called").length, handoffOpen: tasks.filter((task) => task.type === "handoff" && task.status === "pending").length, casesRequiringApproval: cases.filter((patientCase) => patientCase.summary.pendingApprovalCount > 0).length, followUpPending: cases.filter((patientCase) => patientCase.status === "follow_up_pending").length };
  }

  private getCase(tenantId: string, caseId: string): PatientCase | undefined {
    return this.state.patientCases.find((patientCase) => patientCase.tenantId === tenantId && patientCase.id === caseId);
  }

  private requireCase(tenantId: string, caseId: string): PatientCase {
    const patientCase = this.getCase(tenantId, caseId);
    if (!patientCase) {
      throw new Error("patient case not found");
    }
    return patientCase;
  }

  private getPatient(patientId: string): Patient | undefined {
    return this.state.patients.find((patient) => patient.id === patientId);
  }

  private requirePatient(patientId: string): Patient {
    const patient = this.getPatient(patientId);
    if (!patient) {
      throw new Error("patient not found");
    }
    return patient;
  }

  private requireAppointment(tenantId: string, appointmentId: string): Appointment {
    const appointment = this.getAppointment(tenantId, appointmentId);
    if (!appointment) {
      throw new Error("appointment not found for tenant");
    }
    return appointment;
  }

  private requireQueueTicket(tenantId: string, ticketId: string): QueueTicket {
    const ticket = this.getQueueTicket(tenantId, ticketId);
    if (!ticket) {
      throw new Error("queue ticket not found for tenant");
    }
    return ticket;
  }

  private requirePreparedAction(tenantId: string, preparedActionId: string): PersistedPreparedAction {
    const preparedAction = this.state.preparedActions.find(
      (candidate) => candidate.tenantId === tenantId && candidate.id === preparedActionId
    );
    if (!preparedAction) {
      throw new Error("prepared action not found for tenant");
    }
    return preparedAction;
  }

  private requirePreparedActionDispatchJob(tenantId: string, dispatchJobId: string): PreparedActionDispatchJob {
    const dispatchJob = this.state.preparedActionDispatchJobs.find(
      (candidate) => candidate.tenantId === tenantId && candidate.id === dispatchJobId
    );
    if (!dispatchJob) {
      throw new Error("prepared action dispatch job not found for tenant");
    }
    return dispatchJob;
  }

  private replaceCopilotExecutionReceiptsForDispatchJob(dispatchJob: PreparedActionDispatchJob): void {
    const removedReceiptIds = this.state.copilotExecutionReceipts
      .filter(
        (receiptRecord) =>
          receiptRecord.tenantId === dispatchJob.tenantId &&
          receiptRecord.dispatchJobId === dispatchJob.id
      )
      .map((receiptRecord) => receiptRecord.id);

    this.state.copilotExecutionReceipts = this.state.copilotExecutionReceipts.filter(
      (receiptRecord) =>
        !(
          receiptRecord.tenantId === dispatchJob.tenantId &&
          receiptRecord.dispatchJobId === dispatchJob.id
        )
    );
    this.state.copilotExecutionReceiptEvents = this.state.copilotExecutionReceiptEvents.filter(
      (event) => !removedReceiptIds.includes(event.receiptRecordId)
    );

    if (dispatchJob.status !== "succeeded" || !dispatchJob.execution) {
      return;
    }

    const receiptRecords: CopilotExecutionReceiptRecord[] = dispatchJob.execution.receipts.map((receipt) => {
      const providerStatus: CopilotExecutionReceiptRecord["providerStatus"] = "pending";
      return {
        id: makeId("copilot_receipt"),
        tenantId: dispatchJob.tenantId,
        patientCaseId: dispatchJob.patientCaseId,
        preparedActionId: dispatchJob.preparedActionId,
        dispatchJobId: dispatchJob.id,
        attempt: dispatchJob.attempt,
        actorId: dispatchJob.actorId,
        recommendedAction: dispatchJob.execution?.recommendationAction ?? "answer_operational_faq",
        destinationSystem: dispatchJob.execution?.destinationSystem ?? "unknown_destination",
        adapterKey: dispatchJob.execution?.adapterKey ?? "legacy_executor",
        deduped: dispatchJob.execution?.deduped ?? false,
        providerStatus,
        providerConfirmedAt: null,
        lastProviderEventAt: null,
        lastProviderError: null,
        receipt: structuredClone(receipt),
        recordedAt: receipt.recordedAt
      };
    });

    this.state.copilotExecutionReceipts.push(...receiptRecords);
  }

  private resolveCopilotExecutionReceiptRecordForEvent(
    tenantId: string,
    payload: {
      receiptRecordId?: string;
      preparedActionId?: string;
      dispatchJobId?: string;
      system: string;
      eventType: CopilotExecutionReceiptEventType;
      idempotencyKey?: string;
      externalRef?: string | null;
    }
  ): CopilotExecutionReceiptRecord {
    let candidates = this.state.copilotExecutionReceipts.filter(
      (receiptRecord) =>
        receiptRecord.tenantId === tenantId &&
        receiptRecord.receipt.system === payload.system
    );

    if (payload.receiptRecordId) {
      candidates = candidates.filter((receiptRecord) => receiptRecord.id === payload.receiptRecordId);
    }
    if (payload.preparedActionId) {
      candidates = candidates.filter(
        (receiptRecord) => receiptRecord.preparedActionId === payload.preparedActionId
      );
    }
    if (payload.dispatchJobId) {
      candidates = candidates.filter((receiptRecord) => receiptRecord.dispatchJobId === payload.dispatchJobId);
    }
    if (payload.idempotencyKey) {
      candidates = candidates.filter(
        (receiptRecord) => receiptRecord.receipt.idempotencyKey === payload.idempotencyKey
      );
    }
    if (payload.externalRef !== undefined) {
      candidates = candidates.filter(
        (receiptRecord) => receiptRecord.receipt.externalRef === payload.externalRef
      );
    }

    const receiptRecord = candidates
      .slice()
      .sort((left, right) => right.recordedAt.localeCompare(left.recordedAt))[0];

    if (!receiptRecord) {
      throw new Error("copilot execution receipt not found");
    }

    return receiptRecord;
  }

  private requireAgentTask(tenantId: string, taskId: string): AgentTask {
    const task = this.state.agentTasks.find((candidate) => candidate.tenantId === tenantId && candidate.id === taskId);
    if (!task) {
      throw new Error("agent task not found for tenant");
    }
    return task;
  }

  private requireCaseAction(tenantId: string, caseId: string, actionId: string): PatientCaseAction {
    const action = this.state.patientCaseActions.find(
      (candidate) =>
        candidate.tenantId === tenantId &&
        candidate.patientCaseId === caseId &&
        candidate.id === actionId
    );
    if (!action) {
      throw new Error("patient case action not found");
    }
    return action;
  }

  private resolvePatient(tenantId: string, patientId?: string, patientInput?: { displayName: string; phone: string; email?: string | null; preferredChannel: Patient["preferredChannel"] }): Patient {
    if (patientId) {
      return this.requirePatient(patientId);
    }
    const normalizedPhone = normalizePhone(patientInput?.phone);
    const normalizedEmail = normalizeEmail(patientInput?.email);
    const existing = this.state.patients.find((patient) => patient.tenantId === tenantId && (normalizePhone(patient.phone) === normalizedPhone || normalizeEmail(patient.email) === normalizedEmail));
    if (existing) {
      return existing;
    }
    if (!patientInput) {
      throw new Error("patient reference is required");
    }
    const patient: Patient = { id: makeId("patient"), tenantId, displayName: patientInput.displayName, phone: patientInput.phone, email: patientInput.email ?? null, preferredChannel: patientInput.preferredChannel, createdAt: nowIso() };
    this.state.patients.push(patient);
    return patient;
  }

  private resolveOrCreateActiveCase(tenantId: string, patientId: string, defaults: { lastChannel?: string | null } = {}): PatientCase {
    const active = this.state.patientCases.filter((patientCase) => patientCase.tenantId === tenantId && patientCase.patientId === patientId && patientCase.status !== "closed").sort((left, right) => right.latestActivityAt.localeCompare(left.latestActivityAt))[0];
    if (active) {
      return active;
    }
    const patientCase: PatientCase = { id: makeId("case"), tenantId, patientId, status: "intake", statusSource: "derived", openedAt: nowIso(), latestActivityAt: nowIso(), closedAt: null, lastInboundAt: null, lastOutboundAt: null, summary: { primaryAppointmentId: null, latestAppointmentId: null, latestThreadId: null, latestCallbackId: null, serviceLine: null, providerName: null, scheduledStart: null, scheduledEnd: null, queueStatus: null, lastChannel: defaults.lastChannel ?? null, openActionCount: 0, pendingApprovalCount: 0 } };
    this.state.patientCases.push(patientCase);
    this.recordTimeline(tenantId, patientCase.id, "case_opened", "Case opened", { patientId });
    this.recordAudit(tenantId, "system", "patient_case_resolver", "patient_case_opened", "patient_case", patientCase.id, { patientId });
    return patientCase;
  }

  private ensureThread(
    tenantId: string,
    caseId: string,
    channelOverride?: Patient["preferredChannel"]
  ): ConversationThread {
    const patientCase = this.requireCase(tenantId, caseId);
    const patient = this.requirePatient(patientCase.patientId);
    const preferredChannel = channelOverride ?? patient.preferredChannel;
    if (channelOverride) {
      patient.preferredChannel = channelOverride;
    }

    const existing = this.state.conversationThreads.find(
      (thread) =>
        thread.tenantId === tenantId &&
        thread.patientCaseId === caseId &&
        (!channelOverride || thread.channel === channelOverride)
    );
    if (existing) {
      return existing;
    }

    const thread: ConversationThread = {
      id: makeId("thread"),
      tenantId,
      patientCaseId: caseId,
      appointmentId: patientCase.summary.primaryAppointmentId,
      channel: preferredChannel,
      status: "open",
      messages: [],
      createdAt: nowIso()
    };
    this.state.conversationThreads.push(thread);
    this.addCaseLink(tenantId, caseId, "conversation_thread", thread.id, "primary");
    return thread;
  }

  private ensureFollowUpAction(tenantId: string, caseId: string): void {
    const existing = this.state.patientCaseActions.find((action) => action.tenantId === tenantId && action.patientCaseId === caseId && action.action === "send_follow_up" && action.status === "pending");
    if (!existing) {
      this.createCaseAction(tenantId, caseId, { action: "send_follow_up", title: "Send follow-up", rationale: "The case needs follow-up before it can be closed.", channel: "ops", source: "system" });
    }
  }

  private addCaseLink(tenantId: string, caseId: string, entityType: "appointment" | "queue_ticket" | "conversation_thread" | "agent_task" | "prepared_action" | "prepared_action_dispatch" | "flow_event" | "callback" | "telemedicine_intake" | "copilot_review", entityId: string, relationship: "primary" | "secondary" | "derived"): void {
    const exists = this.state.patientCaseLinks.some((link) => link.tenantId === tenantId && link.patientCaseId === caseId && link.entityType === entityType && link.entityId === entityId);
    if (!exists) {
      this.state.patientCaseLinks.push({ id: makeId("link"), tenantId, patientCaseId: caseId, entityType, entityId, relationship, createdAt: nowIso() });
    }
  }

  private recordTimeline(tenantId: string, caseId: string, type: PatientCaseTimelineEvent["type"], title: string, payload: Record<string, unknown>): void {
    this.state.patientCaseTimelineEvents.push({ id: makeId("case_evt"), tenantId, patientCaseId: caseId, type, title, payload, createdAt: nowIso() });
  }

  private recordFlowEvent(tenantId: string, caseId: string, appointmentId: string | null, type: FlowEvent["type"], payload: Record<string, unknown>): void {
    const event: FlowEvent = { id: makeId("flow"), tenantId, patientCaseId: caseId, appointmentId, type, payload, createdAt: nowIso() };
    this.state.flowEvents.push(event);
    this.addCaseLink(tenantId, caseId, "flow_event", event.id, "derived");
  }

  private recordAudit(tenantId: string, actorType: ActorType, actorId: string, action: string, entityType: string, entityId: string, metadata: Record<string, unknown>): void {
    this.state.auditEntries.push({ id: makeId("audit"), tenantId, actorType, actorId, action, entityType, entityId, metadata, createdAt: nowIso() });
  }

  private deriveCaseStatus(tenantId: string, caseId: string, currentStatus: PatientCaseStatus): PatientCaseStatus {
    if (currentStatus === "closed") return "closed";
    const failedReceipts = this.state.copilotExecutionReceipts.filter(
      (receipt) =>
        receipt.tenantId === tenantId &&
        receipt.patientCaseId === caseId &&
        receipt.providerStatus === "failed"
    );
    if (failedReceipts.length > 0) return "exception";
    const approvals = this.state.patientCaseApprovals.filter((approval) => approval.tenantId === tenantId && approval.patientCaseId === caseId && approval.status === "pending");
    if (approvals.length > 0) return "exception";
    const queue = this.state.queueTickets.filter((ticket) => ticket.tenantId === tenantId && ticket.patientCaseId === caseId);
    if (queue.some((ticket) => ticket.status === "called")) return "queued";
    if (queue.some((ticket) => ticket.status === "waiting")) return "arrived";
    const appointments = this.state.appointments.filter((appointment) => appointment.tenantId === tenantId && appointment.patientCaseId === caseId);
    if (appointments.some((appointment) => appointment.status === "completed")) {
      return this.state.patientCaseActions.some((action) => action.tenantId === tenantId && action.patientCaseId === caseId && action.status === "pending") ? "follow_up_pending" : "closed";
    }
    if (appointments.some((appointment) => appointment.status === "no_show")) return "follow_up_pending";
    if (appointments.some((appointment) => appointment.status === "called" || appointment.status === "in_queue")) return "queued";
    if (appointments.some((appointment) => appointment.status === "checked_in")) return "arrived";
    if (appointments.some((appointment) => appointment.status === "reschedule_requested")) return "awaiting_booking";
    if (appointments.some((appointment) => appointment.status === "confirmed" || appointment.status === "scheduled")) return "booked";
    if (this.state.callbacks.some((callback) => callback.tenantId === tenantId && callback.patientCaseId === caseId)) return "qualified";
    if (this.state.conversationThreads.some((thread) => thread.tenantId === tenantId && thread.patientCaseId === caseId)) return "awaiting_booking";
    return "intake";
  }

  private refreshCase(tenantId: string, caseId: string): void {
    const patientCase = this.requireCase(tenantId, caseId);
    const appointments = this.state.appointments.filter((appointment) => appointment.tenantId === tenantId && appointment.patientCaseId === caseId);
    const callbacks = this.state.callbacks.filter((callback) => callback.tenantId === tenantId && callback.patientCaseId === caseId);
    const queue = this.state.queueTickets.filter((ticket) => ticket.tenantId === tenantId && ticket.patientCaseId === caseId);
    const threads = this.state.conversationThreads.filter((thread) => thread.tenantId === tenantId && thread.patientCaseId === caseId);
    const actions = this.state.patientCaseActions.filter((action) => action.tenantId === tenantId && action.patientCaseId === caseId);
    const approvals = this.state.patientCaseApprovals.filter((approval) => approval.tenantId === tenantId && approval.patientCaseId === caseId);
    const timeline = this.state.patientCaseTimelineEvents.filter((event) => event.tenantId === tenantId && event.patientCaseId === caseId);
    const businessTimeline = timeline.filter((event) => !event.type.startsWith("copilot_"));
    const latestActivityAt = [patientCase.openedAt, ...appointments.map((appointment) => appointment.createdAt), ...callbacks.map((callback) => callback.createdAt), ...queue.map((ticket) => ticket.createdAt), ...threads.flatMap((thread) => [thread.createdAt, ...thread.messages.map((message) => message.createdAt)]), ...actions.map((action) => action.updatedAt), ...approvals.map((approval) => approval.updatedAt), ...businessTimeline.map((event) => event.createdAt)].sort().at(-1) ?? patientCase.openedAt;
    const primaryAppointment = appointments.slice().sort((left, right) => left.createdAt.localeCompare(right.createdAt))[0] ?? null;
    const latestAppointment = appointments.slice().sort((left, right) => right.createdAt.localeCompare(left.createdAt))[0] ?? null;
    const latestThread = threads.slice().sort((left, right) => right.createdAt.localeCompare(left.createdAt))[0] ?? null;
    const latestCallback = callbacks.slice().sort((left, right) => right.createdAt.localeCompare(left.createdAt))[0] ?? null;
    const latestQueue = queue.slice().sort((left, right) => right.createdAt.localeCompare(left.createdAt))[0] ?? null;
    const latestPatientMessage = threads.flatMap((thread) => thread.messages.filter((message) => message.role === "patient")).sort((left, right) => right.createdAt.localeCompare(left.createdAt))[0] ?? null;
    const latestOutbound = threads.flatMap((thread) => thread.messages.filter((message) => message.role !== "patient")).sort((left, right) => right.createdAt.localeCompare(left.createdAt))[0] ?? null;
    patientCase.summary = { primaryAppointmentId: primaryAppointment?.id ?? null, latestAppointmentId: latestAppointment?.id ?? null, latestThreadId: latestThread?.id ?? null, latestCallbackId: latestCallback?.id ?? null, serviceLine: latestAppointment?.serviceLine ?? patientCase.summary.serviceLine, providerName: latestAppointment?.providerName ?? patientCase.summary.providerName, scheduledStart: latestAppointment?.scheduledStart ?? patientCase.summary.scheduledStart, scheduledEnd: latestAppointment?.scheduledEnd ?? patientCase.summary.scheduledEnd, queueStatus: latestQueue?.status ?? null, lastChannel: latestThread?.channel ?? latestCallback?.channel ?? patientCase.summary.lastChannel, openActionCount: actions.filter((action) => action.status === "pending" || action.status === "blocked").length, pendingApprovalCount: approvals.filter((approval) => approval.status === "pending").length };
    patientCase.latestActivityAt = latestActivityAt;
    patientCase.lastInboundAt = latestPatientMessage?.createdAt ?? patientCase.lastInboundAt;
    patientCase.lastOutboundAt = latestOutbound?.createdAt ?? patientCase.lastOutboundAt;
    if (patientCase.statusSource === "derived") {
      patientCase.status = this.deriveCaseStatus(tenantId, caseId, patientCase.status);
      patientCase.closedAt = patientCase.status === "closed" ? patientCase.closedAt ?? latestActivityAt : null;
    }
  }
}

export interface CreatePlatformRepositoryOptions {
  mode?: "memory" | "postgres";
  executor?: SqlExecutor;
  seedState?: BootstrapState;
}

export function createPlatformRepository(options: CreatePlatformRepositoryOptions = {}): PlatformRepository {
  const mode = options.mode ?? "postgres";
  if (mode === "postgres") {
    return new PostgresPlatformRepository(
      options.executor ?? createPgMemSqlExecutor(options.seedState ?? createBootstrapState())
    );
  }

  return new InMemoryPlatformRepository(options.seedState ?? createBootstrapState());
}
