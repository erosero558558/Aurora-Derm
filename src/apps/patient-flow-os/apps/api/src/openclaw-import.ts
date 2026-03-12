import { z } from "zod";
import {
  AgentRecommendationSchema,
  AgentTaskSchema,
  AgentTaskTypeSchema,
  AppointmentSchema,
  AppointmentStatusSchema,
  BootstrapState,
  BootstrapStateSchema,
  CallbackLeadSchema,
  CallbackStatusSchema,
  ChannelSchema,
  ConversationMessageSchema,
  ConversationThreadSchema,
  ConversationThreadStatusSchema,
  Patient,
  PatientCase,
  PatientCaseActionSchema,
  PatientCaseApprovalSchema,
  PatientCaseLink,
  PatientCaseSchema,
  PatientCaseStatus,
  PatientCaseStatusSchema,
  PatientCaseTimelineEventSchema,
  PlaybookSchema,
  QueueTicketSchema,
  QueueTicketStatusSchema,
  StaffUserSchema,
  TenantConfigSchema,
  TimestampSchema,
  LocationSchema
} from "../../../packages/core/src/index.js";

function normalizePhone(value: string | null | undefined): string {
  return (value ?? "").replace(/\D+/g, "");
}

function normalizeEmail(value: string | null | undefined): string {
  return (value ?? "").trim().toLowerCase();
}

function latestTimestamp(values: Array<string | null | undefined>, fallback: string): string {
  return values.filter((value): value is string => Boolean(value)).sort().at(-1) ?? fallback;
}

function emptyBootstrapState(): BootstrapState {
  return BootstrapStateSchema.parse({
    tenantConfigs: [],
    locations: [],
    staffUsers: [],
    patients: [],
    patientCases: [],
    patientCaseLinks: [],
    patientCaseTimelineEvents: [],
    patientCaseActions: [],
    patientCaseApprovals: [],
    appointments: [],
    flowEvents: [],
    queueTickets: [],
    conversationThreads: [],
    agentTasks: [],
    preparedActions: [],
    preparedActionDispatchJobs: [],
    copilotExecutionReceipts: [],
    copilotExecutionReceiptEvents: [],
    callbacks: [],
    playbooks: [],
    auditEntries: [],
    copilotReviewDecisions: []
  });
}

function deriveCaseStatus(state: BootstrapState, patientCase: PatientCase): PatientCaseStatus {
  if (patientCase.closedAt) {
    return "closed";
  }

  const approvals = state.patientCaseApprovals.filter(
    (approval) =>
      approval.tenantId === patientCase.tenantId &&
      approval.patientCaseId === patientCase.id &&
      approval.status === "pending"
  );
  if (approvals.length > 0) {
    return "exception";
  }

  const queueTickets = state.queueTickets.filter(
    (ticket) => ticket.tenantId === patientCase.tenantId && ticket.patientCaseId === patientCase.id
  );
  if (queueTickets.some((ticket) => ticket.status === "called")) {
    return "queued";
  }
  if (queueTickets.some((ticket) => ticket.status === "waiting")) {
    return "arrived";
  }

  const appointments = state.appointments.filter(
    (appointment) => appointment.tenantId === patientCase.tenantId && appointment.patientCaseId === patientCase.id
  );
  if (appointments.some((appointment) => appointment.status === "completed")) {
    const hasPendingActions = state.patientCaseActions.some(
      (action) =>
        action.tenantId === patientCase.tenantId &&
        action.patientCaseId === patientCase.id &&
        (action.status === "pending" || action.status === "blocked")
    );
    return hasPendingActions ? "follow_up_pending" : "closed";
  }
  if (appointments.some((appointment) => appointment.status === "no_show")) {
    return "follow_up_pending";
  }
  if (appointments.some((appointment) => appointment.status === "called" || appointment.status === "in_queue")) {
    return "queued";
  }
  if (appointments.some((appointment) => appointment.status === "checked_in")) {
    return "arrived";
  }
  if (appointments.some((appointment) => appointment.status === "reschedule_requested")) {
    return "awaiting_booking";
  }
  if (appointments.some((appointment) => appointment.status === "confirmed" || appointment.status === "scheduled")) {
    return "booked";
  }
  if (state.callbacks.some((callback) => callback.tenantId === patientCase.tenantId && callback.patientCaseId === patientCase.id)) {
    return "qualified";
  }
  if (
    state.conversationThreads.some(
      (thread) => thread.tenantId === patientCase.tenantId && thread.patientCaseId === patientCase.id
    )
  ) {
    return "awaiting_booking";
  }
  return "intake";
}

function upsertById<T extends { id: string }>(items: T[], value: T): void {
  const index = items.findIndex((item) => item.id === value.id);
  if (index >= 0) {
    items[index] = value;
    return;
  }
  items.push(value);
}

function ensureCaseLink(
  state: BootstrapState,
  factory: (prefix: string) => string,
  tenantId: string,
  patientCaseId: string,
  entityType: PatientCaseLink["entityType"],
  entityId: string,
  relationship: PatientCaseLink["relationship"]
): void {
  const exists = state.patientCaseLinks.some(
    (link) =>
      link.tenantId === tenantId &&
      link.patientCaseId === patientCaseId &&
      link.entityType === entityType &&
      link.entityId === entityId
  );
  if (!exists) {
    state.patientCaseLinks.push({
      id: factory("case_link"),
      tenantId,
      patientCaseId,
      entityType,
      entityId,
      relationship,
      createdAt: new Date().toISOString()
    });
  }
}

const ImportedPatientSchema = z
  .object({
    id: z.string().min(1).optional(),
    displayName: z.string().min(1),
    phone: z.string().optional().nullable(),
    email: z.string().optional().nullable(),
    preferredChannel: ChannelSchema.optional()
  })
  .superRefine((value, ctx) => {
    if (!value.id && !normalizePhone(value.phone) && !normalizeEmail(value.email)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "openclaw patient needs patient id or normalized contact"
      });
    }
  });

const ImportedAppointmentSchema = z.object({
  id: z.string().min(1).optional(),
  locationId: z.string().min(1),
  providerName: z.string().min(1),
  serviceLine: z.string().min(1),
  status: AppointmentStatusSchema.default("scheduled"),
  scheduledStart: TimestampSchema,
  scheduledEnd: TimestampSchema,
  createdAt: TimestampSchema.optional()
});

const ImportedCallbackSchema = z.object({
  id: z.string().min(1).optional(),
  channel: ChannelSchema,
  notes: z.string().min(1),
  status: CallbackStatusSchema.default("new"),
  createdAt: TimestampSchema.optional()
});

const ImportedQueueTicketSchema = z.object({
  id: z.string().min(1).optional(),
  locationId: z.string().min(1),
  appointmentId: z.string().min(1).optional().nullable(),
  patientLabel: z.string().min(1).optional(),
  ticketNumber: z.string().min(1),
  status: QueueTicketStatusSchema.default("waiting"),
  createdAt: TimestampSchema.optional()
});

const ImportedConversationThreadSchema = z.object({
  id: z.string().min(1).optional(),
  appointmentId: z.string().min(1).optional().nullable(),
  channel: ChannelSchema.optional(),
  status: ConversationThreadStatusSchema.default("open"),
  messages: z.array(ConversationMessageSchema).default([]),
  createdAt: TimestampSchema.optional()
});

const ImportedAgentTaskSchema = z.object({
  id: z.string().min(1).optional(),
  appointmentId: z.string().min(1).optional().nullable(),
  type: AgentTaskTypeSchema.default("ops_next_best_action"),
  status: z.enum(["pending", "approved", "completed", "blocked"]).default("pending"),
  recommendation: AgentRecommendationSchema,
  createdAt: TimestampSchema.optional()
});

const ImportedTimelineEventSchema = z.object({
  id: z.string().min(1).optional(),
  type: PatientCaseTimelineEventSchema.shape.type,
  title: z.string().min(1),
  payload: z.record(z.string(), z.unknown()).default({}),
  createdAt: TimestampSchema.optional()
});

const ImportedActionSchema = z.object({
  id: z.string().min(1).optional(),
  action: PatientCaseActionSchema.shape.action,
  title: z.string().min(1),
  status: PatientCaseActionSchema.shape.status.default("pending"),
  channel: PatientCaseActionSchema.shape.channel.default("ops"),
  rationale: z.string().min(1),
  requiresHumanApproval: z.boolean().default(false),
  source: PatientCaseActionSchema.shape.source.default("system"),
  createdAt: TimestampSchema.optional(),
  updatedAt: TimestampSchema.optional(),
  completedAt: TimestampSchema.optional().nullable()
});

const ImportedApprovalSchema = z.object({
  id: z.string().min(1).optional(),
  type: PatientCaseApprovalSchema.shape.type,
  status: PatientCaseApprovalSchema.shape.status.default("pending"),
  reason: z.string().min(1),
  requestedBy: z.string().min(1),
  resolvedBy: z.string().optional().nullable(),
  resolutionNotes: z.string().optional().nullable(),
  createdAt: TimestampSchema.optional(),
  updatedAt: TimestampSchema.optional(),
  resolvedAt: TimestampSchema.optional().nullable()
});

const ImportedSummarySchema = PatientCaseSchema.shape.summary.partial();

export const OpenClawProjectedCaseSchema = z.object({
  id: z.string().min(1).optional(),
  tenantId: z.string().min(1),
  patient: ImportedPatientSchema,
  status: PatientCaseStatusSchema.optional(),
  openedAt: TimestampSchema.optional(),
  latestActivityAt: TimestampSchema.optional(),
  closedAt: TimestampSchema.optional().nullable(),
  lastInboundAt: TimestampSchema.optional().nullable(),
  lastOutboundAt: TimestampSchema.optional().nullable(),
  summary: ImportedSummarySchema.optional(),
  appointments: z.array(ImportedAppointmentSchema).default([]),
  callbacks: z.array(ImportedCallbackSchema).default([]),
  queueTickets: z.array(ImportedQueueTicketSchema).default([]),
  conversationThreads: z.array(ImportedConversationThreadSchema).default([]),
  agentTasks: z.array(ImportedAgentTaskSchema).default([]),
  timeline: z.array(ImportedTimelineEventSchema).default([]),
  actions: z.array(ImportedActionSchema).default([]),
  approvals: z.array(ImportedApprovalSchema).default([])
});

export const OpenClawImportBundleSchema = z.object({
  importedAt: TimestampSchema.optional(),
  tenantConfigs: z.array(TenantConfigSchema).default([]),
  locations: z.array(LocationSchema).default([]),
  staffUsers: z.array(StaffUserSchema).default([]),
  playbooks: z.array(PlaybookSchema).default([]),
  projectedCases: z.array(OpenClawProjectedCaseSchema)
});

export type OpenClawImportBundle = z.input<typeof OpenClawImportBundleSchema>;
export type OpenClawProjectedCase = z.input<typeof OpenClawProjectedCaseSchema>;

export interface OpenClawImportResult {
  state: BootstrapState;
  stats: {
    patients: number;
    cases: number;
    actions: number;
    approvals: number;
    appointments: number;
    callbacks: number;
    queueTickets: number;
    threads: number;
    agentTasks: number;
    timelineEvents: number;
  };
}

export function importOpenClawProjectedCases(
  input: OpenClawImportBundle,
  baseState: BootstrapState = emptyBootstrapState()
): OpenClawImportResult {
  const parsed = OpenClawImportBundleSchema.parse(input);
  const state = structuredClone(baseState);
  const now = parsed.importedAt ?? new Date().toISOString();
  const usedIds = new Set<string>();

  const rememberIds = <T extends { id: string }>(items: T[]): void => {
    for (const item of items) {
      usedIds.add(item.id);
    }
  };

  rememberIds(state.tenantConfigs);
  rememberIds(state.locations);
  rememberIds(state.staffUsers);
  rememberIds(state.patients);
  rememberIds(state.patientCases);
  rememberIds(state.patientCaseLinks);
  rememberIds(state.patientCaseTimelineEvents);
  rememberIds(state.patientCaseActions);
  rememberIds(state.patientCaseApprovals);
  rememberIds(state.appointments);
  rememberIds(state.flowEvents);
  rememberIds(state.queueTickets);
  rememberIds(state.conversationThreads);
  rememberIds(state.agentTasks);
  rememberIds(state.preparedActions);
  rememberIds(state.preparedActionDispatchJobs);
  rememberIds(state.copilotExecutionReceipts);
  rememberIds(state.copilotExecutionReceiptEvents);
  rememberIds(state.callbacks);
  rememberIds(state.playbooks);
  rememberIds(state.auditEntries);
  rememberIds(state.copilotReviewDecisions);

  let nextId = 1;
  const makeId = (prefix: string): string => {
    let candidate = "";
    do {
      candidate = `${prefix}_${String(nextId).padStart(5, "0")}`;
      nextId += 1;
    } while (usedIds.has(candidate));
    usedIds.add(candidate);
    return candidate;
  };

  const patientByIdentity = new Map<string, Patient>();
  for (const patient of state.patients) {
    patientByIdentity.set(`${patient.tenantId}:id:${patient.id}`, patient);
    const phone = normalizePhone(patient.phone);
    const email = normalizeEmail(patient.email);
    if (phone) {
      patientByIdentity.set(`${patient.tenantId}:phone:${phone}`, patient);
    }
    if (email) {
      patientByIdentity.set(`${patient.tenantId}:email:${email}`, patient);
    }
  }

  const resolvePatient = (tenantId: string, inputPatient: OpenClawProjectedCase["patient"]): Patient => {
    const identityKeys = [
      inputPatient.id ? `${tenantId}:id:${inputPatient.id}` : null,
      normalizePhone(inputPatient.phone) ? `${tenantId}:phone:${normalizePhone(inputPatient.phone)}` : null,
      normalizeEmail(inputPatient.email) ? `${tenantId}:email:${normalizeEmail(inputPatient.email)}` : null
    ].filter((value): value is string => Boolean(value));

    for (const key of identityKeys) {
      const existing = patientByIdentity.get(key);
      if (existing) {
        return existing;
      }
    }

    const patient: Patient = {
      id: inputPatient.id ?? makeId("patient"),
      tenantId,
      displayName: inputPatient.displayName,
      phone: inputPatient.phone ?? `unknown-${makeId("phone")}`,
      email: inputPatient.email ?? null,
      preferredChannel: inputPatient.preferredChannel ?? "whatsapp",
      createdAt: now
    };

    state.patients.push(patient);
    patientByIdentity.set(`${tenantId}:id:${patient.id}`, patient);
    const normalizedPhone = normalizePhone(patient.phone);
    const normalizedEmail = normalizeEmail(patient.email);
    if (normalizedPhone) {
      patientByIdentity.set(`${tenantId}:phone:${normalizedPhone}`, patient);
    }
    if (normalizedEmail) {
      patientByIdentity.set(`${tenantId}:email:${normalizedEmail}`, patient);
    }
    return patient;
  };

  for (const tenant of parsed.tenantConfigs) {
    upsertById(state.tenantConfigs, tenant);
  }
  for (const location of parsed.locations) {
    upsertById(state.locations, location);
  }
  for (const staffUser of parsed.staffUsers) {
    upsertById(state.staffUsers, staffUser);
  }
  for (const playbook of parsed.playbooks) {
    upsertById(state.playbooks, playbook);
  }

  for (const projectedCase of parsed.projectedCases) {
    const patient = resolvePatient(projectedCase.tenantId, projectedCase.patient);
    const activeExisting = state.patientCases
      .filter(
        (candidate) =>
          candidate.tenantId === projectedCase.tenantId &&
          candidate.patientId === patient.id &&
          candidate.status !== "closed"
      )
      .sort((left, right) => right.latestActivityAt.localeCompare(left.latestActivityAt))[0];

    const patientCaseId =
      projectedCase.id ??
      (projectedCase.status !== "closed" ? activeExisting?.id : undefined) ??
      makeId("case");

    const patientCase: PatientCase =
      state.patientCases.find((candidate) => candidate.id === patientCaseId) ??
      {
        id: patientCaseId,
        tenantId: projectedCase.tenantId,
        patientId: patient.id,
        status: projectedCase.status ?? "intake",
        statusSource: projectedCase.status ? "manual" : "derived",
        openedAt: projectedCase.openedAt ?? now,
        latestActivityAt: projectedCase.latestActivityAt ?? projectedCase.openedAt ?? now,
        closedAt: projectedCase.closedAt ?? null,
        lastInboundAt: projectedCase.lastInboundAt ?? null,
        lastOutboundAt: projectedCase.lastOutboundAt ?? null,
        summary: {
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
        }
      };

    patientCase.tenantId = projectedCase.tenantId;
    patientCase.patientId = patient.id;
    patientCase.statusSource = projectedCase.status ? "manual" : patientCase.statusSource;
    patientCase.openedAt = projectedCase.openedAt ?? patientCase.openedAt;
    patientCase.lastInboundAt = projectedCase.lastInboundAt ?? patientCase.lastInboundAt;
    patientCase.lastOutboundAt = projectedCase.lastOutboundAt ?? patientCase.lastOutboundAt;
    patientCase.closedAt = projectedCase.closedAt ?? patientCase.closedAt;
    patientCase.summary = {
      ...patientCase.summary,
      ...projectedCase.summary
    };
    upsertById(state.patientCases, patientCase);

    for (const appointment of projectedCase.appointments) {
      const importedAppointment = AppointmentSchema.parse({
        id: appointment.id ?? makeId("appointment"),
        tenantId: projectedCase.tenantId,
        patientCaseId,
        locationId: appointment.locationId,
        patientId: patient.id,
        providerName: appointment.providerName,
        serviceLine: appointment.serviceLine,
        status: appointment.status,
        scheduledStart: appointment.scheduledStart,
        scheduledEnd: appointment.scheduledEnd,
        createdAt: appointment.createdAt ?? now
      });
      upsertById(state.appointments, importedAppointment);
      ensureCaseLink(state, makeId, projectedCase.tenantId, patientCaseId, "appointment", importedAppointment.id, "primary");
    }

    for (const callback of projectedCase.callbacks) {
      const importedCallback = CallbackLeadSchema.parse({
        id: callback.id ?? makeId("callback"),
        tenantId: projectedCase.tenantId,
        patientCaseId,
        patientId: patient.id,
        channel: callback.channel,
        notes: callback.notes,
        status: callback.status,
        createdAt: callback.createdAt ?? now
      });
      upsertById(state.callbacks, importedCallback);
      ensureCaseLink(state, makeId, projectedCase.tenantId, patientCaseId, "callback", importedCallback.id, "secondary");
    }

    for (const ticket of projectedCase.queueTickets) {
      const importedTicket = QueueTicketSchema.parse({
        id: ticket.id ?? makeId("queue_ticket"),
        tenantId: projectedCase.tenantId,
        patientCaseId,
        locationId: ticket.locationId,
        appointmentId: ticket.appointmentId ?? null,
        patientLabel: ticket.patientLabel ?? patient.displayName.slice(0, 2).toUpperCase(),
        ticketNumber: ticket.ticketNumber,
        status: ticket.status,
        createdAt: ticket.createdAt ?? now
      });
      upsertById(state.queueTickets, importedTicket);
      ensureCaseLink(state, makeId, projectedCase.tenantId, patientCaseId, "queue_ticket", importedTicket.id, "primary");
    }

    for (const thread of projectedCase.conversationThreads) {
      const importedThread = ConversationThreadSchema.parse({
        id: thread.id ?? makeId("thread"),
        tenantId: projectedCase.tenantId,
        patientCaseId,
        appointmentId: thread.appointmentId ?? null,
        channel: thread.channel ?? patient.preferredChannel,
        status: thread.status,
        messages: thread.messages,
        createdAt: thread.createdAt ?? now
      });
      upsertById(state.conversationThreads, importedThread);
      ensureCaseLink(
        state,
        makeId,
        projectedCase.tenantId,
        patientCaseId,
        "conversation_thread",
        importedThread.id,
        "primary"
      );
    }

    for (const task of projectedCase.agentTasks) {
      const importedTask = AgentTaskSchema.parse({
        id: task.id ?? makeId("agent_task"),
        tenantId: projectedCase.tenantId,
        patientCaseId,
        appointmentId: task.appointmentId ?? null,
        type: task.type,
        status: task.status,
        recommendation: task.recommendation,
        createdAt: task.createdAt ?? now
      });
      upsertById(state.agentTasks, importedTask);
      ensureCaseLink(state, makeId, projectedCase.tenantId, patientCaseId, "agent_task", importedTask.id, "secondary");
    }

    for (const action of projectedCase.actions) {
      const importedAction = PatientCaseActionSchema.parse({
        id: action.id ?? makeId("case_action"),
        tenantId: projectedCase.tenantId,
        patientCaseId,
        action: action.action,
        title: action.title,
        status: action.status,
        channel: action.channel,
        rationale: action.rationale,
        requiresHumanApproval: action.requiresHumanApproval,
        source: action.source,
        createdAt: action.createdAt ?? now,
        updatedAt: action.updatedAt ?? action.createdAt ?? now,
        completedAt: action.completedAt ?? null
      });
      upsertById(state.patientCaseActions, importedAction);
    }

    for (const approval of projectedCase.approvals) {
      const importedApproval = PatientCaseApprovalSchema.parse({
        id: approval.id ?? makeId("case_approval"),
        tenantId: projectedCase.tenantId,
        patientCaseId,
        type: approval.type,
        status: approval.status,
        reason: approval.reason,
        requestedBy: approval.requestedBy,
        resolvedBy: approval.resolvedBy ?? null,
        resolutionNotes: approval.resolutionNotes ?? null,
        createdAt: approval.createdAt ?? now,
        updatedAt: approval.updatedAt ?? approval.createdAt ?? now,
        resolvedAt: approval.resolvedAt ?? null
      });
      upsertById(state.patientCaseApprovals, importedApproval);
    }

    const timeline =
      projectedCase.timeline.length > 0
        ? projectedCase.timeline
        : [
            {
              type: "imported_from_openclaw" as const,
              title: "Imported from OpenClaw",
              payload: { source: "openclaw_one_shot" },
              createdAt: now
            }
          ];

    for (const event of timeline) {
      const importedEvent = PatientCaseTimelineEventSchema.parse({
        id: event.id ?? makeId("timeline_event"),
        tenantId: projectedCase.tenantId,
        patientCaseId,
        type: event.type,
        title: event.title,
        payload: event.payload,
        createdAt: event.createdAt ?? now
      });
      upsertById(state.patientCaseTimelineEvents, importedEvent);
    }
  }

  for (const patientCase of state.patientCases) {
    const appointments = state.appointments
      .filter((appointment) => appointment.tenantId === patientCase.tenantId && appointment.patientCaseId === patientCase.id)
      .sort((left, right) => left.createdAt.localeCompare(right.createdAt));
    const latestAppointment = appointments.at(-1) ?? null;
    const primaryAppointment = appointments[0] ?? null;
    const callbacks = state.callbacks
      .filter((callback) => callback.tenantId === patientCase.tenantId && callback.patientCaseId === patientCase.id)
      .sort((left, right) => left.createdAt.localeCompare(right.createdAt));
    const threads = state.conversationThreads
      .filter((thread) => thread.tenantId === patientCase.tenantId && thread.patientCaseId === patientCase.id)
      .sort((left, right) => left.createdAt.localeCompare(right.createdAt));
    const queueTickets = state.queueTickets
      .filter((ticket) => ticket.tenantId === patientCase.tenantId && ticket.patientCaseId === patientCase.id)
      .sort((left, right) => left.createdAt.localeCompare(right.createdAt));
    const actions = state.patientCaseActions.filter(
      (action) => action.tenantId === patientCase.tenantId && action.patientCaseId === patientCase.id
    );
    const approvals = state.patientCaseApprovals.filter(
      (approval) => approval.tenantId === patientCase.tenantId && approval.patientCaseId === patientCase.id
    );
    const timeline = state.patientCaseTimelineEvents.filter(
      (event) => event.tenantId === patientCase.tenantId && event.patientCaseId === patientCase.id
    );

    patientCase.summary = {
      primaryAppointmentId: primaryAppointment?.id ?? patientCase.summary.primaryAppointmentId ?? null,
      latestAppointmentId: latestAppointment?.id ?? patientCase.summary.latestAppointmentId ?? null,
      latestThreadId: threads.at(-1)?.id ?? patientCase.summary.latestThreadId ?? null,
      latestCallbackId: callbacks.at(-1)?.id ?? patientCase.summary.latestCallbackId ?? null,
      serviceLine: latestAppointment?.serviceLine ?? patientCase.summary.serviceLine ?? null,
      providerName: latestAppointment?.providerName ?? patientCase.summary.providerName ?? null,
      scheduledStart: latestAppointment?.scheduledStart ?? patientCase.summary.scheduledStart ?? null,
      scheduledEnd: latestAppointment?.scheduledEnd ?? patientCase.summary.scheduledEnd ?? null,
      queueStatus: queueTickets.at(-1)?.status ?? patientCase.summary.queueStatus ?? null,
      lastChannel:
        threads.at(-1)?.channel ??
        callbacks.at(-1)?.channel ??
        patientCase.summary.lastChannel ??
        state.patients.find((patient) => patient.id === patientCase.patientId)?.preferredChannel ??
        null,
      openActionCount: actions.filter((action) => action.status === "pending" || action.status === "blocked").length,
      pendingApprovalCount: approvals.filter((approval) => approval.status === "pending").length
    };

    patientCase.latestActivityAt = latestTimestamp(
      [
        patientCase.openedAt,
        patientCase.latestActivityAt,
        patientCase.lastInboundAt,
        patientCase.lastOutboundAt,
        ...appointments.map((appointment) => appointment.createdAt),
        ...callbacks.map((callback) => callback.createdAt),
        ...queueTickets.map((ticket) => ticket.createdAt),
        ...threads.flatMap((thread) => [thread.createdAt, ...thread.messages.map((message) => message.createdAt)]),
        ...actions.map((action) => action.updatedAt),
        ...approvals.map((approval) => approval.updatedAt),
        ...timeline.map((event) => event.createdAt)
      ],
      patientCase.openedAt
    );

    if (patientCase.statusSource === "derived" && patientCase.status !== "closed" && !patientCase.closedAt) {
      patientCase.status = deriveCaseStatus(state, patientCase);
    } else if (patientCase.status === "closed" && !patientCase.closedAt) {
      patientCase.closedAt = patientCase.latestActivityAt;
    }
  }

  const finalState = BootstrapStateSchema.parse(state);
  return {
    state: finalState,
    stats: {
      patients: finalState.patients.length,
      cases: finalState.patientCases.length,
      actions: finalState.patientCaseActions.length,
      approvals: finalState.patientCaseApprovals.length,
      appointments: finalState.appointments.length,
      callbacks: finalState.callbacks.length,
      queueTickets: finalState.queueTickets.length,
      threads: finalState.conversationThreads.length,
      agentTasks: finalState.agentTasks.length,
      timelineEvents: finalState.patientCaseTimelineEvents.length
    }
  };
}
