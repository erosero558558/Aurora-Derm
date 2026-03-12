import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { Pool } from "pg";
import { BootstrapStateSchema } from "../../../packages/core/src/index.js";
import {
  createBootstrapState,
  createPlatformRepository,
  InMemoryPlatformRepository
} from "./state.js";
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
  CopilotExecutionReceiptRecord,
  CopilotExecutionResult,
  PersistedPreparedAction,
  ConversationMessage,
  ConversationThread,
  KPIReport,
  Location,
  Patient,
  PatientCase,
  PatientCaseAction,
  PatientCaseApproval,
  PatientCaseSnapshot,
  PatientCaseStatus,
  PatientCaseTimelineEvent,
  PreparedActionDispatchJob,
  PreparedActionDispatchStatus,
  PreparedActionDispatchTrigger,
  PreparedActionPacket,
  PreparedActionStatus,
  QueueTicket,
  TenantConfig,
  CopilotReviewDecision
} from "../../../packages/core/src/index.js";
import type { PlatformRepository } from "./state.js";

type ActorType = AuditEntry["actorType"];
type DatabaseRow = Record<string, unknown>;

const STATE_SCHEMA_SQL = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), "../../../infra/postgres/schema.sql"),
  "utf8"
);
const schemaInitializedExecutors = new WeakSet<object>();
let schemaEnsureQueue: Promise<void> = Promise.resolve();

export interface Queryable {
  query<T = unknown>(sql: string, params?: readonly unknown[]): Promise<{ rows: T[] }>;
  end?(): Promise<void>;
}

function toIsoString(value: unknown): string {
  if (value instanceof Date) {
    return value.toISOString();
  }
  return String(value);
}

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

async function queryRows(executor: Queryable, sql: string): Promise<DatabaseRow[]> {
  const result = await executor.query<DatabaseRow>(sql);
  return result.rows;
}

async function insertRows(
  executor: Queryable,
  tableName: string,
  columns: readonly string[],
  rows: ReadonlyArray<Record<string, unknown>>
): Promise<void> {
  if (rows.length === 0) {
    return;
  }

  const placeholders = columns.map((_column, index) => `$${index + 1}`).join(", ");
  const sql = `insert into ${tableName} (${columns.join(", ")}) values (${placeholders})`;

  for (const row of rows) {
    const values = columns.map((column) => {
      const value = row[column];
      if (value === null || value === undefined) {
        return value ?? null;
      }
      if (value instanceof Date) {
        return value.toISOString();
      }
      if (Array.isArray(value)) {
        return JSON.stringify(value);
      }
      if (typeof value === "object") {
        return JSON.stringify(value);
      }
      return value;
    });
    await executor.query(
      sql,
      values
    );
  }
}

async function ensureSchema(executor: Queryable): Promise<void> {
  if (typeof executor === "object" && executor !== null && schemaInitializedExecutors.has(executor)) {
    return;
  }

  const run = schemaEnsureQueue.then(async () => {
    await executor.query(STATE_SCHEMA_SQL);
    if (typeof executor === "object" && executor !== null) {
      schemaInitializedExecutors.add(executor);
    }
  });

  schemaEnsureQueue = run.catch(() => undefined);
  await run;
}

export async function ensurePostgresSchema(executor: Queryable): Promise<void> {
  await ensureSchema(executor);
}

export async function loadBootstrapStateFromPostgres(executor: Queryable): Promise<BootstrapState> {
  await ensureSchema(executor);
  return BootstrapStateSchema.parse({
    tenantConfigs: (await queryRows(executor, "select * from tenants order by created_at asc, id asc")).map((row) => ({
      id: String(row.id),
      slug: String(row.slug),
      name: String(row.name),
      timezone: String(row.timezone),
      brandColor: String(row.brand_color),
      enabledChannels: parseJsonValue<string[]>(row.enabled_channels, []),
      credentialRefs: parseJsonValue<string[]>(row.credential_refs, []),
      createdAt: toIsoString(row.created_at)
    })),
    locations: (await queryRows(executor, "select * from locations order by created_at asc, id asc")).map((row) => ({
      id: String(row.id),
      tenantId: String(row.tenant_id),
      slug: String(row.slug),
      name: String(row.name),
      waitingRoomName: String(row.waiting_room_name),
      createdAt: toIsoString(row.created_at)
    })),
    staffUsers: (await queryRows(executor, "select * from staff_users order by created_at asc, id asc")).map((row) => ({
      id: String(row.id),
      tenantId: String(row.tenant_id),
      locationId: String(row.location_id),
      name: String(row.name),
      role: String(row.role),
      email: String(row.email),
      createdAt: toIsoString(row.created_at)
    })),
    patients: (await queryRows(executor, "select * from patients order by created_at asc, id asc")).map((row) => ({
      id: String(row.id),
      tenantId: String(row.tenant_id),
      displayName: String(row.display_name),
      phone: String(row.phone),
      email: row.email === null ? null : String(row.email),
      preferredChannel: String(row.preferred_channel),
      createdAt: toIsoString(row.created_at)
    })),
    patientCases: (await queryRows(executor, "select * from patient_cases order by opened_at asc, id asc")).map((row) => ({
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
    patientCaseLinks: (await queryRows(executor, "select * from patient_case_links order by created_at asc, id asc")).map((row) => ({
      id: String(row.id),
      tenantId: String(row.tenant_id),
      patientCaseId: String(row.patient_case_id),
      entityType: String(row.entity_type),
      entityId: String(row.entity_id),
      relationship: String(row.relationship),
      createdAt: toIsoString(row.created_at)
    })),
    patientCaseTimelineEvents: (await queryRows(executor, "select * from patient_case_timeline_events order by created_at asc, id asc")).map((row) => ({
      id: String(row.id),
      tenantId: String(row.tenant_id),
      patientCaseId: String(row.patient_case_id),
      type: String(row.type),
      title: String(row.title),
      payload: parseJsonValue<Record<string, unknown>>(row.payload, {}),
      createdAt: toIsoString(row.created_at)
    })),
    patientCaseActions: (await queryRows(executor, "select * from patient_case_actions order by created_at asc, id asc")).map((row) => ({
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
    patientCaseApprovals: (await queryRows(executor, "select * from patient_case_approvals order by created_at asc, id asc")).map((row) => ({
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
    appointments: (await queryRows(executor, "select * from appointments order by created_at asc, id asc")).map((row) => ({
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
    flowEvents: (await queryRows(executor, "select * from flow_events order by created_at asc, id asc")).map((row) => ({
      id: String(row.id),
      tenantId: String(row.tenant_id),
      patientCaseId: String(row.patient_case_id),
      appointmentId: row.appointment_id === null ? null : String(row.appointment_id),
      type: String(row.type),
      payload: parseJsonValue<Record<string, unknown>>(row.payload, {}),
      createdAt: toIsoString(row.created_at)
    })),
    queueTickets: (await queryRows(executor, "select * from queue_tickets order by created_at asc, id asc")).map((row) => ({
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
    conversationThreads: (await queryRows(executor, "select * from conversation_threads order by created_at asc, id asc")).map((row) => ({
      id: String(row.id),
      tenantId: String(row.tenant_id),
      patientCaseId: String(row.patient_case_id),
      appointmentId: row.appointment_id === null ? null : String(row.appointment_id),
      channel: String(row.channel),
      status: String(row.status),
      messages: parseJsonValue<ConversationThread["messages"]>(row.messages, []),
      createdAt: toIsoString(row.created_at)
    })),
    agentTasks: (await queryRows(executor, "select * from agent_tasks order by created_at asc, id asc")).map((row) => ({
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
        providerName: "postgres_loader",
        evidenceRefs: []
      }),
      createdAt: toIsoString(row.created_at)
    })),
    preparedActions: (await queryRows(executor, "select * from prepared_actions order by created_at asc, id asc")).map((row) => ({
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
    preparedActionDispatchJobs: (await queryRows(executor, "select * from prepared_action_dispatch_jobs order by requested_at asc, id asc")).map((row) => ({
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
    copilotExecutionReceipts: (await queryRows(executor, "select * from copilot_execution_receipts order by recorded_at asc, id asc")).map((row) => ({
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
      receipt: parseJsonValue<CopilotExecutionReceiptRecord["receipt"]>(row.receipt, {
        system: "unknown_system",
        operation: "unknown_operation",
        status: "noop",
        idempotencyKey: "unknown_idempotency_key",
        externalRef: null,
        recordedAt: toIsoString(row.recorded_at),
        metadata: {}
      }),
      recordedAt: toIsoString(row.recorded_at)
    })),
    copilotExecutionReceiptEvents: (await queryRows(executor, "select * from copilot_execution_receipt_events order by occurred_at asc, id asc")).map((row) => ({
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
    callbacks: (await queryRows(executor, "select * from callbacks order by created_at asc, id asc")).map((row) => ({
      id: String(row.id),
      tenantId: String(row.tenant_id),
      patientCaseId: String(row.patient_case_id),
      patientId: String(row.patient_id),
      channel: String(row.channel),
      notes: String(row.notes),
      status: String(row.status),
      createdAt: toIsoString(row.created_at)
    })),
    playbooks: (await queryRows(executor, "select * from playbooks order by created_at asc, id asc")).map((row) => ({
      id: String(row.id),
      tenantId: String(row.tenant_id),
      name: String(row.name),
      triggerKey: String(row.trigger_key),
      isEnabled: toBoolean(row.is_enabled),
      config: parseJsonValue<Record<string, unknown>>(row.config, {}),
      createdAt: toIsoString(row.created_at)
    })),
    auditEntries: (await queryRows(executor, "select * from audit_entries order by created_at asc, id asc")).map((row) => ({
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
    copilotReviewDecisions: (await queryRows(executor, "select * from copilot_review_decisions order by timestamp asc, id asc")).map((row) => ({
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

export async function replaceBootstrapStateInPostgres(
  executor: Queryable,
  state: BootstrapState
): Promise<void> {
  await ensureSchema(executor);
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
    await executor.query(sql);
  }

  await insertRows(executor, "tenants", ["id", "slug", "name", "timezone", "brand_color", "enabled_channels", "credential_refs", "created_at"], parsedState.tenantConfigs.map((tenant) => ({
    id: tenant.id,
    slug: tenant.slug,
    name: tenant.name,
    timezone: tenant.timezone,
    brand_color: tenant.brandColor,
    enabled_channels: tenant.enabledChannels,
    credential_refs: tenant.credentialRefs,
    created_at: tenant.createdAt
  })));
  await insertRows(executor, "locations", ["id", "tenant_id", "slug", "name", "waiting_room_name", "created_at"], parsedState.locations.map((location) => ({
    id: location.id,
    tenant_id: location.tenantId,
    slug: location.slug,
    name: location.name,
    waiting_room_name: location.waitingRoomName,
    created_at: location.createdAt
  })));
  await insertRows(executor, "staff_users", ["id", "tenant_id", "location_id", "name", "role", "email", "created_at"], parsedState.staffUsers.map((staffUser) => ({
    id: staffUser.id,
    tenant_id: staffUser.tenantId,
    location_id: staffUser.locationId,
    name: staffUser.name,
    role: staffUser.role,
    email: staffUser.email,
    created_at: staffUser.createdAt
  })));
  await insertRows(executor, "patients", ["id", "tenant_id", "display_name", "phone", "email", "preferred_channel", "created_at"], parsedState.patients.map((patient) => ({
    id: patient.id,
    tenant_id: patient.tenantId,
    display_name: patient.displayName,
    phone: patient.phone,
    email: patient.email,
    preferred_channel: patient.preferredChannel,
    created_at: patient.createdAt
  })));
  await insertRows(executor, "patient_cases", ["id", "tenant_id", "patient_id", "status", "status_source", "opened_at", "latest_activity_at", "closed_at", "last_inbound_at", "last_outbound_at", "summary"], parsedState.patientCases.map((patientCase) => ({
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
  })));
  await insertRows(executor, "patient_case_links", ["id", "tenant_id", "patient_case_id", "entity_type", "entity_id", "relationship", "created_at"], parsedState.patientCaseLinks.map((link) => ({
    id: link.id,
    tenant_id: link.tenantId,
    patient_case_id: link.patientCaseId,
    entity_type: link.entityType,
    entity_id: link.entityId,
    relationship: link.relationship,
    created_at: link.createdAt
  })));
  await insertRows(executor, "patient_case_timeline_events", ["id", "tenant_id", "patient_case_id", "type", "title", "payload", "created_at"], parsedState.patientCaseTimelineEvents.map((event) => ({
    id: event.id,
    tenant_id: event.tenantId,
    patient_case_id: event.patientCaseId,
    type: event.type,
    title: event.title,
    payload: event.payload,
    created_at: event.createdAt
  })));
  await insertRows(executor, "patient_case_actions", ["id", "tenant_id", "patient_case_id", "action", "title", "status", "channel", "rationale", "requires_human_approval", "source", "created_at", "updated_at", "completed_at"], parsedState.patientCaseActions.map((action) => ({
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
  })));
  await insertRows(executor, "patient_case_approvals", ["id", "tenant_id", "patient_case_id", "type", "status", "reason", "requested_by", "resolved_by", "resolution_notes", "created_at", "updated_at", "resolved_at"], parsedState.patientCaseApprovals.map((approval) => ({
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
  })));
  await insertRows(executor, "callbacks", ["id", "tenant_id", "patient_case_id", "patient_id", "channel", "notes", "status", "created_at"], parsedState.callbacks.map((callback) => ({
    id: callback.id,
    tenant_id: callback.tenantId,
    patient_case_id: callback.patientCaseId,
    patient_id: callback.patientId,
    channel: callback.channel,
    notes: callback.notes,
    status: callback.status,
    created_at: callback.createdAt
  })));
  await insertRows(executor, "appointments", ["id", "tenant_id", "patient_case_id", "location_id", "patient_id", "provider_name", "service_line", "status", "scheduled_start", "scheduled_end", "created_at"], parsedState.appointments.map((appointment) => ({
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
  })));
  await insertRows(executor, "flow_events", ["id", "tenant_id", "patient_case_id", "appointment_id", "type", "payload", "created_at"], parsedState.flowEvents.map((event) => ({
    id: event.id,
    tenant_id: event.tenantId,
    patient_case_id: event.patientCaseId,
    appointment_id: event.appointmentId,
    type: event.type,
    payload: event.payload,
    created_at: event.createdAt
  })));
  await insertRows(executor, "queue_tickets", ["id", "tenant_id", "patient_case_id", "location_id", "appointment_id", "patient_label", "ticket_number", "status", "created_at"], parsedState.queueTickets.map((ticket) => ({
    id: ticket.id,
    tenant_id: ticket.tenantId,
    patient_case_id: ticket.patientCaseId,
    location_id: ticket.locationId,
    appointment_id: ticket.appointmentId,
    patient_label: ticket.patientLabel,
    ticket_number: ticket.ticketNumber,
    status: ticket.status,
    created_at: ticket.createdAt
  })));
  await insertRows(executor, "conversation_threads", ["id", "tenant_id", "patient_case_id", "appointment_id", "channel", "status", "messages", "created_at"], parsedState.conversationThreads.map((thread) => ({
    id: thread.id,
    tenant_id: thread.tenantId,
    patient_case_id: thread.patientCaseId,
    appointment_id: thread.appointmentId,
    channel: thread.channel,
    status: thread.status,
    messages: thread.messages,
    created_at: thread.createdAt
  })));
  await insertRows(executor, "agent_tasks", ["id", "tenant_id", "patient_case_id", "appointment_id", "type", "status", "recommendation", "created_at"], parsedState.agentTasks.map((task) => ({
    id: task.id,
    tenant_id: task.tenantId,
    patient_case_id: task.patientCaseId,
    appointment_id: task.appointmentId,
    type: task.type,
    status: task.status,
    recommendation: task.recommendation,
    created_at: task.createdAt
  })));
  await insertRows(executor, "prepared_actions", ["id", "tenant_id", "patient_case_id", "version", "status", "recommendation_action", "type", "title", "payload_draft", "message_draft", "destination_system", "preconditions", "requires_human_approval", "fingerprint", "basis_latest_activity_at", "execution_count", "stale_reason", "generated_at", "created_at", "updated_at", "executed_at"], parsedState.preparedActions.map((preparedAction) => ({
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
  })));
  await insertRows(executor, "prepared_action_dispatch_jobs", ["id", "tenant_id", "patient_case_id", "prepared_action_id", "trigger", "status", "actor_id", "attempt", "message_override", "last_error", "execution", "requested_at", "available_at", "lease_owner", "lease_expires_at", "started_at", "finished_at"], parsedState.preparedActionDispatchJobs.map((dispatchJob) => ({
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
  })));
  await insertRows(executor, "copilot_execution_receipts", ["id", "tenant_id", "patient_case_id", "prepared_action_id", "dispatch_job_id", "attempt", "actor_id", "recommended_action", "destination_system", "adapter_key", "deduped", "provider_status", "provider_confirmed_at", "last_provider_event_at", "last_provider_error", "receipt", "recorded_at"], parsedState.copilotExecutionReceipts.map((receiptRecord) => ({
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
  })));
  await insertRows(executor, "copilot_execution_receipt_events", ["id", "tenant_id", "patient_case_id", "prepared_action_id", "dispatch_job_id", "receipt_record_id", "system", "event_type", "provider_status", "idempotency_key", "external_ref", "payload", "occurred_at", "recorded_at"], parsedState.copilotExecutionReceiptEvents.map((event) => ({
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
  })));
  await insertRows(executor, "copilot_review_decisions", ["id", "tenant_id", "patient_case_id", "recommendation_action", "decision", "actor", "timestamp", "note", "prepared_action_id"], parsedState.copilotReviewDecisions.map((review) => ({
    id: review.id,
    tenant_id: review.tenantId,
    patient_case_id: review.patientCaseId,
    recommendation_action: review.recommendationAction,
    decision: review.decision,
    actor: review.actor,
    timestamp: review.timestamp,
    note: review.note,
    prepared_action_id: review.preparedActionId
  })));
  await insertRows(executor, "playbooks", ["id", "tenant_id", "name", "trigger_key", "is_enabled", "config", "created_at"], parsedState.playbooks.map((playbook) => ({
    id: playbook.id,
    tenant_id: playbook.tenantId,
    name: playbook.name,
    trigger_key: playbook.triggerKey,
    is_enabled: playbook.isEnabled,
    config: playbook.config,
    created_at: playbook.createdAt
  })));
  await insertRows(executor, "audit_entries", ["id", "tenant_id", "actor_type", "actor_id", "action", "entity_type", "entity_id", "metadata", "created_at"], parsedState.auditEntries.map((entry) => ({
    id: entry.id,
    tenant_id: entry.tenantId,
    actor_type: entry.actorType,
    actor_id: entry.actorId,
    action: entry.action,
    entity_type: entry.entityType,
    entity_id: entry.entityId,
    metadata: entry.metadata,
    created_at: entry.createdAt
  })));
}

export class MirroredPostgresPlatformRepository
  extends InMemoryPlatformRepository
  implements PlatformRepository
{
  readonly persistenceMode = "postgres";
  private pendingPersistence: Promise<void> = Promise.resolve();
  private lastPersistenceError: Error | null = null;

  constructor(
    seedState: BootstrapState,
    private readonly persistSnapshot: (state: BootstrapState) => Promise<void>,
    private readonly closePersistence: () => Promise<void>
  ) {
    super(seedState);
  }

  getLastPersistenceError(): Error | null {
    return this.lastPersistenceError;
  }

  async flush(): Promise<void> {
    await this.pendingPersistence.catch(() => undefined);
    if (this.lastPersistenceError) {
      throw this.lastPersistenceError;
    }
  }

  async close(): Promise<void> {
    await this.flush();
    await this.closePersistence();
  }

  private schedulePersistence(): void {
    const snapshot = this.exportState();
    this.pendingPersistence = this.pendingPersistence
      .catch(() => undefined)
      .then(async () => {
        try {
          await this.persistSnapshot(snapshot);
          this.lastPersistenceError = null;
        } catch (error) {
          this.lastPersistenceError =
            error instanceof Error ? error : new Error(String(error));
          throw this.lastPersistenceError;
        }
      });
    void this.pendingPersistence.catch(() => undefined);
  }

  override confirmAppointment(tenantId: string, appointmentId: string, actorType: ActorType, actorId: string): Appointment {
    const result = super.confirmAppointment(tenantId, appointmentId, actorType, actorId);
    this.schedulePersistence();
    return result;
  }

  override requestReschedule(tenantId: string, appointmentId: string, actorType: ActorType, actorId: string): Appointment {
    const result = super.requestReschedule(tenantId, appointmentId, actorType, actorId);
    this.schedulePersistence();
    return result;
  }

  override checkInAppointment(tenantId: string, appointmentId: string, actorType: ActorType, actorId: string): Appointment {
    const result = super.checkInAppointment(tenantId, appointmentId, actorType, actorId);
    this.schedulePersistence();
    return result;
  }

  override markNoShow(tenantId: string, appointmentId: string, actorType: ActorType, actorId: string): Appointment {
    const result = super.markNoShow(tenantId, appointmentId, actorType, actorId);
    this.schedulePersistence();
    return result;
  }

  override callQueueTicket(tenantId: string, ticketId: string, actorType: ActorType, actorId: string): QueueTicket {
    const result = super.callQueueTicket(tenantId, ticketId, actorType, actorId);
    this.schedulePersistence();
    return result;
  }

  override completeQueueTicket(tenantId: string, ticketId: string, actorType: ActorType, actorId: string): QueueTicket {
    const result = super.completeQueueTicket(tenantId, ticketId, actorType, actorId);
    this.schedulePersistence();
    return result;
  }

  override appendConversationMessage(
    tenantId: string,
    caseId: string,
    role: ConversationMessage["role"],
    body: string
  ): ConversationThread {
    const result = super.appendConversationMessage(tenantId, caseId, role, body);
    this.schedulePersistence();
    return result;
  }

  override createCaseAction(
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
    const result = super.createCaseAction(tenantId, caseId, payload);
    this.schedulePersistence();
    return result;
  }

  override resolveApproval(
    tenantId: string,
    caseId: string,
    approvalId: string,
    resolution: { decision: "approved" | "rejected"; notes?: string; actorId: string }
  ): PatientCaseApproval {
    const result = super.resolveApproval(tenantId, caseId, approvalId, resolution);
    this.schedulePersistence();
    return result;
  }

  override updateCaseStatus(tenantId: string, caseId: string, status: PatientCaseStatus, actorId: string): PatientCase {
    const result = super.updateCaseStatus(tenantId, caseId, status, actorId);
    this.schedulePersistence();
    return result;
  }

  override createCallback(
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
    const result = super.createCallback(tenantId, payload);
    this.schedulePersistence();
    return result;
  }

  override createAgentTask(
    tenantId: string,
    caseId: string,
    type: AgentTask["type"],
    recommendation: AgentRecommendation,
    appointmentId?: string | null
  ): AgentTask {
    const result = super.createAgentTask(tenantId, caseId, type, recommendation, appointmentId);
    this.schedulePersistence();
    return result;
  }

  override savePreparedAction(
    tenantId: string,
    caseId: string,
    packet: PreparedActionPacket,
    basisLatestActivityAt: string,
    fingerprint: string
  ): PersistedPreparedAction {
    const result = super.savePreparedAction(tenantId, caseId, packet, basisLatestActivityAt, fingerprint);
    this.schedulePersistence();
    return result;
  }

  override updatePreparedActionStatus(
    tenantId: string,
    preparedActionId: string,
    payload: {
      status: PreparedActionStatus;
      actorId: string;
      staleReason?: string | null;
      executed?: boolean;
    }
  ): PersistedPreparedAction {
    const result = super.updatePreparedActionStatus(tenantId, preparedActionId, payload);
    this.schedulePersistence();
    return result;
  }

  override createPreparedActionDispatchJob(
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
    const result = super.createPreparedActionDispatchJob(tenantId, caseId, preparedActionId, payload);
    this.schedulePersistence();
    return result;
  }

  override claimPreparedActionDispatchJobs(payload: {
    tenantId?: string;
    workerId: string;
    limit: number;
    leaseTtlMs?: number;
    now?: string;
  }): PreparedActionDispatchJob[] {
    const result = super.claimPreparedActionDispatchJobs(payload);
    this.schedulePersistence();
    return result;
  }

  override updatePreparedActionDispatchJob(
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
    const result = super.updatePreparedActionDispatchJob(tenantId, dispatchJobId, payload);
    this.schedulePersistence();
    return result;
  }

  override updateAgentTaskStatus(
    tenantId: string,
    taskId: string,
    status: AgentTask["status"],
    actorId: string
  ): AgentTask {
    const result = super.updateAgentTaskStatus(tenantId, taskId, status, actorId);
    this.schedulePersistence();
    return result;
  }

  override updateCaseActionStatus(
    tenantId: string,
    caseId: string,
    actionId: string,
    status: PatientCaseAction["status"],
    actorId: string
  ): PatientCaseAction {
    const result = super.updateCaseActionStatus(tenantId, caseId, actionId, status, actorId);
    this.schedulePersistence();
    return result;
  }

  override recordCopilotReviewDecision(
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
    const result = super.recordCopilotReviewDecision(tenantId, caseId, payload);
    this.schedulePersistence();
    return result;
  }

  override recordCopilotExecutionReceiptEvent(
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
    const result = super.recordCopilotExecutionReceiptEvent(tenantId, payload);
    this.schedulePersistence();
    return result;
  }
}

export interface CreateMirroredPostgresRepositoryOptions {
  connectionString?: string;
  pool?: Queryable;
  seedState?: BootstrapState;
  seedIfEmpty?: boolean;
}

export async function createMirroredPostgresRepository(
  options: CreateMirroredPostgresRepositoryOptions = {}
): Promise<MirroredPostgresPlatformRepository> {
  const pool =
    options.pool ??
    new Pool({
      connectionString: options.connectionString ?? process.env.DATABASE_URL
    });

  await ensureSchema(pool);
  let state = await loadBootstrapStateFromPostgres(pool);

  if (state.tenantConfigs.length === 0 && options.seedIfEmpty !== false) {
    state = options.seedState ?? createBootstrapState();
    await replaceBootstrapStateInPostgres(pool, state);
  }

  return new MirroredPostgresPlatformRepository(
    state,
    async (nextState) => {
      await replaceBootstrapStateInPostgres(pool, nextState);
    },
    async () => {
      if (typeof pool.end === "function") {
        await pool.end();
      }
    }
  );
}

export async function createDefaultRuntimeRepository(): Promise<PlatformRepository> {
  if (process.env.DATABASE_URL) {
    return createMirroredPostgresRepository({
      connectionString: process.env.DATABASE_URL,
      seedState: createBootstrapState()
    });
  }

  return createPlatformRepository();
}
