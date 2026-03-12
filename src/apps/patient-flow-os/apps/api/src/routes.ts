import type { FastifyInstance, FastifyReply } from "fastify";
import { z, ZodError } from "zod";
import type { AgentRuntime } from "../../../packages/agent-runtime/src/index.js";
import type {
  AgentAction,
  AgentRecommendation,
  AuditEntry,
  PatientCaseAction,
  PatientCaseSnapshot,
  TenantConfig
} from "../../../packages/core/src/index.js";
import { CaseChannelSchema, ChannelSchema, PatientCaseStatusSchema, SurfaceSchema } from "../../../packages/core/src/index.js";
import { PatientCaseCopilotService } from "./copilot.js";
import { renderClinicDashboard, renderHomePage, renderOpsConsole, renderPatientFlowLink, renderWaitRoomDisplay } from "./html.js";
import { OpenClawImportBundleSchema, importOpenClawProjectedCases } from "./openclaw-import.js";
import {
  buildClinicDashboardProjection,
  buildPatientFlowLinkProjection,
  buildWaitRoomDisplayProjection
} from "./surfaces.js";
import type { PlatformRepository } from "./state.js";

const TenantReferenceSchema = z
  .object({
    tenantId: z.string().min(1).optional(),
    tenantSlug: z.string().min(1).optional()
  })
  .refine((value) => Boolean(value.tenantId || value.tenantSlug), {
    message: "tenantId or tenantSlug is required"
  });

const ActorTypeSchema = z.enum(["system", "agent", "staff", "patient"]);

const ActorContextSchema = TenantReferenceSchema.extend({
  actorId: z.string().min(1),
  actorType: ActorTypeSchema.default("staff")
});

const PatientMessageSchema = TenantReferenceSchema.extend({
  caseId: z.string().min(1),
  message: z.string().min(1),
  actorId: z.string().min(1).default("patient_link"),
  surface: SurfaceSchema.optional()
});

const CreateCaseActionSchema = TenantReferenceSchema.extend({
  action: z.enum([
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
  ]),
  title: z.string().min(1),
  rationale: z.string().min(1),
  channel: CaseChannelSchema.optional(),
  requiresHumanApproval: z.boolean().optional(),
  source: z.enum(["patient", "agent", "ops", "system"]).optional(),
  status: z.enum(["pending", "approved", "completed", "blocked", "cancelled"]).optional()
});

const ResolveApprovalSchema = TenantReferenceSchema.extend({
  actorId: z.string().min(1),
  decision: z.enum(["approved", "rejected"]),
  notes: z.string().optional()
});

const UpdateCaseStatusSchema = TenantReferenceSchema.extend({
  actorId: z.string().min(1),
  status: PatientCaseStatusSchema
});

const CreateCallbackSchema = TenantReferenceSchema.extend({
  patientId: z.string().min(1).optional(),
  patient: z
    .object({
      displayName: z.string().min(1),
      phone: z.string().min(1),
      email: z.string().nullable().optional(),
      preferredChannel: ChannelSchema
    })
    .optional(),
  notes: z.string().min(1),
  channel: ChannelSchema
}).refine((value) => Boolean(value.patientId || value.patient), {
  message: "patientId or patient payload is required"
});

const ListThreadsSchema = TenantReferenceSchema.extend({
  caseId: z.string().min(1).optional()
});

const ListAuditSchema = TenantReferenceSchema.extend({
  caseId: z.string().min(1).optional(),
  entityType: z.string().min(1).optional()
});

const ListPreparedActionDispatchesSchema = TenantReferenceSchema.extend({
  preparedActionId: z.string().min(1).optional()
});

const ListCopilotReceiptsSchema = TenantReferenceSchema.extend({
  preparedActionId: z.string().min(1).optional(),
  dispatchJobId: z.string().min(1).optional(),
  system: z.string().min(1).optional()
});

const ListCopilotReceiptEventsSchema = TenantReferenceSchema.extend({
  receiptRecordId: z.string().min(1).optional(),
  preparedActionId: z.string().min(1).optional(),
  dispatchJobId: z.string().min(1).optional(),
  system: z.string().min(1).optional()
});

const ListProviderExceptionsSchema = TenantReferenceSchema.extend({
  system: z.string().min(1).optional()
});

const RemediateProviderExceptionSchema = TenantReferenceSchema.extend({
  actor: z.string().min(1),
  decision: z.enum(["retry_dispatch", "fallback_channel_retry", "escalate_handoff"]),
  fallbackChannel: ChannelSchema.nullable().optional(),
  messageOverride: z.string().nullable().optional(),
  note: z.string().nullable().optional()
}).superRefine((value, context) => {
  if (value.decision === "fallback_channel_retry" && !value.fallbackChannel) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["fallbackChannel"],
      message: "fallbackChannel is required for fallback_channel_retry"
    });
  }
});

const CopilotReceiptWebhookSchema = TenantReferenceSchema.extend({
  receiptRecordId: z.string().min(1).optional(),
  preparedActionId: z.string().min(1).optional(),
  dispatchJobId: z.string().min(1).optional(),
  system: z.string().min(1),
  eventType: z.enum(["acknowledged", "delivered", "failed"]),
  idempotencyKey: z.string().min(1).optional(),
  externalRef: z.string().nullable().optional(),
  payload: z.record(z.string(), z.unknown()).optional(),
  occurredAt: z.string().min(1).nullable().optional(),
  error: z.string().nullable().optional()
}).refine((value) => Boolean(value.receiptRecordId || value.idempotencyKey || value.externalRef), {
  message: "receiptRecordId, idempotencyKey or externalRef is required"
});

const OpsNextBestActionSchema = TenantReferenceSchema.extend({
  caseId: z.string().min(1).optional(),
  input: z.string().min(1).default("What is the next operational action?"),
  persistTask: z.boolean().default(true)
});

const RetryPreparedActionSchema = z.object({
  actor: z.string().min(1),
  messageOverride: z.string().nullable().optional()
});

const DispatchWorkerDrainSchema = z.object({
  tenantId: z.string().min(1).optional(),
  tenantSlug: z.string().min(1).optional(),
  workerId: z.string().min(1).optional(),
  limit: z.number().int().positive().max(50).optional(),
  leaseTtlMs: z.number().int().positive().max(300_000).optional()
});

const PatientFlowSurfaceQuerySchema = TenantReferenceSchema.extend({
  caseId: z.string().min(1)
});

const WaitRoomSurfaceQuerySchema = TenantReferenceSchema.extend({
  locationId: z.string().min(1).optional(),
  locationSlug: z.string().min(1).optional()
}).refine((value) => Boolean(value.locationId || value.locationSlug), {
  message: "locationId or locationSlug is required"
});

function toHttpError(reply: FastifyReply, error: unknown): FastifyReply {
  if (error instanceof ZodError) {
    return reply.code(400).send({
      error: "invalid_request",
      issues: error.flatten()
    });
  }

  const message = error instanceof Error ? error.message : "unexpected error";
  const statusCode = message.includes("not found") ? 404 : 400;
  return reply.code(statusCode).send({
    error: statusCode === 404 ? "not_found" : "bad_request",
    message
  });
}

function withErrors(
  handler: (request: { params?: unknown; query?: unknown; body?: unknown }, reply: FastifyReply) => Promise<unknown> | unknown
) {
  return async (request: { params?: unknown; query?: unknown; body?: unknown }, reply: FastifyReply) => {
    try {
      return await handler(request, reply);
    } catch (error) {
      return toHttpError(reply, error);
    }
  };
}

function resolveTenant(repository: PlatformRepository, reference: { tenantId?: string; tenantSlug?: string }): TenantConfig {
  const tenant =
    (reference.tenantId ? repository.getTenantById(reference.tenantId) : undefined) ??
    (reference.tenantSlug ? repository.getTenantBySlug(reference.tenantSlug) : undefined);
  if (!tenant) {
    throw new Error("tenant not found");
  }
  return tenant;
}

function resolveLocation(
  repository: PlatformRepository,
  tenantId: string,
  reference: { locationId?: string; locationSlug?: string }
) {
  const location =
    (reference.locationId ? repository.getLocationById(tenantId, reference.locationId) : undefined) ??
    (reference.locationSlug ? repository.getLocationBySlug(tenantId, reference.locationSlug) : undefined);

  if (!location) {
    throw new Error("location not found");
  }

  return location;
}

function getRepositoryPersistenceMode(repository: PlatformRepository): string {
  if ("persistenceMode" in repository && typeof repository.persistenceMode === "string") {
    return repository.persistenceMode;
  }
  return "pg-mem";
}

function getRepositoryPersistenceError(repository: PlatformRepository): string | null {
  if (
    "getLastPersistenceError" in repository &&
    typeof repository.getLastPersistenceError === "function"
  ) {
    const error = repository.getLastPersistenceError();
    return error instanceof Error ? error.message : null;
  }
  return null;
}

function requireSnapshot(repository: PlatformRepository, tenantId: string, caseId: string): PatientCaseSnapshot {
  const snapshot = repository.getPatientCaseSnapshot(tenantId, caseId);
  if (!snapshot) {
    throw new Error("patient case not found");
  }
  return snapshot;
}

function selectLatestAppointment(snapshot: PatientCaseSnapshot) {
  return snapshot.appointments
    .slice()
    .sort((left, right) => right.scheduledStart.localeCompare(left.scheduledStart))[0];
}

function auditMatchesCase(entry: AuditEntry, caseId: string): boolean {
  const metadataCaseId =
    typeof entry.metadata.patientCaseId === "string" ? entry.metadata.patientCaseId : null;
  return metadataCaseId === caseId || (entry.entityType === "patient_case" && entry.entityId === caseId);
}

function createHumanReview(
  repository: PlatformRepository,
  tenantId: string,
  caseId: string,
  recommendation: AgentRecommendation
): { action: PatientCaseAction; taskId: string } {
  const action = repository.createCaseAction(tenantId, caseId, {
    action: "handoff_to_staff",
    title: "Human review required",
    rationale: recommendation.whyNow,
    channel: "ops",
    requiresHumanApproval: true,
    source: "patient"
  });

  const task = repository.createAgentTask(tenantId, caseId, "handoff", {
    ...recommendation,
    recommendedAction: "handoff_to_staff",
    requiresHumanApproval: true
  });

  return { action, taskId: task.id };
}

function materializePatientAction(
  repository: PlatformRepository,
  tenantId: string,
  caseId: string,
  actorId: string,
  recommendation: AgentRecommendation
): Record<string, unknown> | null {
  const currentSnapshot = requireSnapshot(repository, tenantId, caseId);
  const appointment = selectLatestAppointment(currentSnapshot);

  switch (recommendation.recommendedAction) {
    case "confirm_appointment":
      if (!appointment) {
        return createHumanReview(repository, tenantId, caseId, recommendation);
      }
      return {
        appointment: repository.confirmAppointment(tenantId, appointment.id, "patient", actorId)
      };
    case "request_reschedule":
      if (!appointment) {
        return createHumanReview(repository, tenantId, caseId, recommendation);
      }
      return {
        appointment: repository.requestReschedule(tenantId, appointment.id, "patient", actorId)
      };
    case "start_check_in":
      if (!appointment) {
        return createHumanReview(repository, tenantId, caseId, recommendation);
      }
      return {
        appointment: repository.checkInAppointment(tenantId, appointment.id, "patient", actorId)
      };
    case "show_queue_status":
    case "answer_operational_faq":
      return null;
    default:
      return createHumanReview(repository, tenantId, caseId, recommendation);
  }
}

export async function registerRoutes(
  app: FastifyInstance,
  repository: PlatformRepository,
  runtime: AgentRuntime,
  copilotService?: PatientCaseCopilotService
): Promise<void> {
  const copilot = copilotService ?? new PatientCaseCopilotService(repository, runtime);
  const opsNextBestActionHandler = withErrors(async (request) => {
    const body = OpsNextBestActionSchema.parse(request.body);
    const tenant = resolveTenant(repository, body);

    const result = body.persistTask
      ? await copilot.materializeOpsNextBestAction({
          tenantId: tenant.id,
          caseId: body.caseId,
          input: body.input
        })
      : {
          ...(await copilot.inspectOpsFocusCase({
            tenantId: tenant.id,
            caseId: body.caseId,
            input: body.input
          })),
          task: null
        };

    return {
      tenantId: tenant.id,
      patientCaseId: result.snapshot.case.id,
      recommendation: result.recommendation,
      preparedAction: result.preparedAction,
      task: result.task,
      snapshot: result.snapshot,
      card: result.card
    };
  });

  app.get(
    "/",
    withErrors((_request, reply) => reply.type("text/html").send(renderHomePage(repository.listTenants())))
  );

  app.get(
    "/health",
    withErrors(() => ({
      ok: true,
      tenants: repository.listTenants().length,
      persistence: getRepositoryPersistenceMode(repository),
      persistenceError: getRepositoryPersistenceError(repository)
    }))
  );

  app.get(
    "/ops/:tenantSlug",
    withErrors((request, reply) => {
      const params = z.object({ tenantSlug: z.string().min(1) }).parse(request.params);
      const tenant = resolveTenant(repository, { tenantSlug: params.tenantSlug });
      return reply.type("text/html").send(renderOpsConsole(tenant));
    })
  );

  const patientFlowHandler = withErrors((request, reply) => {
    const params = z.object({ tenantSlug: z.string().min(1), caseId: z.string().min(1) }).parse(request.params);
    const tenant = resolveTenant(repository, { tenantSlug: params.tenantSlug });
    const snapshot = requireSnapshot(repository, tenant.id, params.caseId);
    return reply.type("text/html").send(renderPatientFlowLink(tenant, buildPatientFlowLinkProjection(snapshot)));
  });

  app.get("/patient-flow/:tenantSlug/:caseId", patientFlowHandler);
  app.get("/patient/:tenantSlug/:caseId", patientFlowHandler);

  app.get(
    "/wait-room/:tenantSlug/:locationSlug",
    withErrors((request, reply) => {
      const params = z.object({ tenantSlug: z.string().min(1), locationSlug: z.string().min(1) }).parse(request.params);
      const tenant = resolveTenant(repository, { tenantSlug: params.tenantSlug });
      const location = resolveLocation(repository, tenant.id, { locationSlug: params.locationSlug });
      return reply
        .type("text/html")
        .send(
          renderWaitRoomDisplay(
            tenant,
            buildWaitRoomDisplayProjection(tenant.id, location, repository.listPatientCaseSnapshots(tenant.id))
          )
        );
    })
  );

  app.get(
    "/dashboard/:tenantSlug",
    withErrors((request, reply) => {
      const params = z.object({ tenantSlug: z.string().min(1) }).parse(request.params);
      const tenant = resolveTenant(repository, { tenantSlug: params.tenantSlug });
      const projection = buildClinicDashboardProjection(
        repository.getKpiReport(tenant.id),
        repository.listPatientCaseSnapshots(tenant.id)
      );
      return reply
        .type("text/html")
        .send(renderClinicDashboard(tenant, projection));
    })
  );

  app.get(
    "/v1/surfaces/patient-flow",
    withErrors((request) => {
      const query = PatientFlowSurfaceQuerySchema.parse(request.query);
      const tenant = resolveTenant(repository, query);
      const projection = buildPatientFlowLinkProjection(requireSnapshot(repository, tenant.id, query.caseId));
      return {
        tenantId: tenant.id,
        caseId: query.caseId,
        item: projection
      };
    })
  );

  app.get(
    "/v1/surfaces/wait-room",
    withErrors((request) => {
      const query = WaitRoomSurfaceQuerySchema.parse(request.query);
      const tenant = resolveTenant(repository, query);
      const location = resolveLocation(repository, tenant.id, query);
      return {
        tenantId: tenant.id,
        locationId: location.id,
        item: buildWaitRoomDisplayProjection(
          tenant.id,
          location,
          repository.listPatientCaseSnapshots(tenant.id)
        )
      };
    })
  );

  app.get(
    "/v1/surfaces/dashboard",
    withErrors((request) => {
      const query = TenantReferenceSchema.parse(request.query);
      const tenant = resolveTenant(repository, query);
      return {
        tenantId: tenant.id,
        item: buildClinicDashboardProjection(
          repository.getKpiReport(tenant.id),
          repository.listPatientCaseSnapshots(tenant.id)
        )
      };
    })
  );

  app.get("/v1/tenants", withErrors(() => ({ items: repository.listTenants() })));

  app.get(
    "/v1/patient-cases",
    withErrors((request) => {
      const query = TenantReferenceSchema.parse(request.query);
      const tenant = resolveTenant(repository, query);
      return {
        tenantId: tenant.id,
        items: repository.listPatientCaseSnapshots(tenant.id)
      };
    })
  );

  app.get(
    "/v1/patient-cases/:caseId",
    withErrors((request) => {
      const params = z.object({ caseId: z.string().min(1) }).parse(request.params);
      const query = TenantReferenceSchema.parse(request.query);
      const tenant = resolveTenant(repository, query);
      return {
        tenantId: tenant.id,
        item: requireSnapshot(repository, tenant.id, params.caseId)
      };
    })
  );

  app.get(
    "/v1/patient-cases/:caseId/timeline",
    withErrors((request) => {
      const params = z.object({ caseId: z.string().min(1) }).parse(request.params);
      const query = TenantReferenceSchema.parse(request.query);
      const tenant = resolveTenant(repository, query);
      requireSnapshot(repository, tenant.id, params.caseId);
      return {
        tenantId: tenant.id,
        caseId: params.caseId,
        items: repository.listPatientCaseTimeline(tenant.id, params.caseId)
      };
    })
  );

  app.get(
    "/v1/patient-cases/:caseId/prepared-actions",
    withErrors((request) => {
      const params = z.object({ caseId: z.string().min(1) }).parse(request.params);
      const query = TenantReferenceSchema.parse(request.query);
      const tenant = resolveTenant(repository, query);
      requireSnapshot(repository, tenant.id, params.caseId);
      return {
        tenantId: tenant.id,
        patientCaseId: params.caseId,
        items: repository.listPreparedActions(tenant.id, params.caseId)
      };
    })
  );

  app.get(
    "/v1/patient-cases/:caseId/prepared-action-dispatches",
    withErrors((request) => {
      const params = z.object({ caseId: z.string().min(1) }).parse(request.params);
      const query = ListPreparedActionDispatchesSchema.parse(request.query);
      const tenant = resolveTenant(repository, query);
      requireSnapshot(repository, tenant.id, params.caseId);
      return {
        tenantId: tenant.id,
        patientCaseId: params.caseId,
        items: repository.listPreparedActionDispatchJobs(
          tenant.id,
          params.caseId,
          query.preparedActionId
        )
      };
    })
  );

  app.get(
    "/v1/patient-cases/:caseId/copilot-receipts",
    withErrors((request) => {
      const params = z.object({ caseId: z.string().min(1) }).parse(request.params);
      const query = ListCopilotReceiptsSchema.parse(request.query);
      const tenant = resolveTenant(repository, query);
      requireSnapshot(repository, tenant.id, params.caseId);
      return {
        tenantId: tenant.id,
        patientCaseId: params.caseId,
        items: repository.listCopilotExecutionReceipts(tenant.id, params.caseId, {
          preparedActionId: query.preparedActionId,
          dispatchJobId: query.dispatchJobId,
          system: query.system
        })
      };
    })
  );

  app.get(
    "/v1/patient-cases/:caseId/copilot-receipt-events",
    withErrors((request) => {
      const params = z.object({ caseId: z.string().min(1) }).parse(request.params);
      const query = ListCopilotReceiptEventsSchema.parse(request.query);
      const tenant = resolveTenant(repository, query);
      requireSnapshot(repository, tenant.id, params.caseId);
      return {
        tenantId: tenant.id,
        patientCaseId: params.caseId,
        items: repository.listCopilotExecutionReceiptEvents(tenant.id, params.caseId, {
          receiptRecordId: query.receiptRecordId,
          preparedActionId: query.preparedActionId,
          dispatchJobId: query.dispatchJobId,
          system: query.system
        })
      };
    })
  );

  app.get(
    "/v1/copilot/provider-exceptions",
    withErrors((request) => {
      const query = ListProviderExceptionsSchema.parse(request.query);
      const tenant = resolveTenant(repository, query);
      return {
        tenantId: tenant.id,
        items: copilot.listProviderExceptions({
          tenantId: tenant.id,
          system: query.system
        })
      };
    })
  );

  app.post(
    "/v1/copilot/provider-exceptions/:receiptRecordId/remediate",
    withErrors((request) => {
      const params = z.object({ receiptRecordId: z.string().min(1) }).parse(request.params);
      const body = RemediateProviderExceptionSchema.parse(request.body);
      const tenant = resolveTenant(repository, body);
      return {
        ok: true,
        data: copilot.remediateProviderException(tenant.id, params.receiptRecordId, {
          actor: body.actor,
          decision: body.decision,
          fallbackChannel: body.fallbackChannel ?? null,
          messageOverride: body.messageOverride ?? null,
          note: body.note ?? null
        })
      };
    })
  );

  app.post(
    "/v1/patient-cases/:caseId/actions",
    withErrors((request) => {
      const params = z.object({ caseId: z.string().min(1) }).parse(request.params);
      const body = CreateCaseActionSchema.parse(request.body);
      const tenant = resolveTenant(repository, body);
      const action = repository.createCaseAction(tenant.id, params.caseId, {
        action: body.action as AgentAction,
        title: body.title,
        rationale: body.rationale,
        channel: body.channel,
        requiresHumanApproval: body.requiresHumanApproval,
        source: body.source,
        status: body.status
      });
      return {
        tenantId: tenant.id,
        patientCaseId: params.caseId,
        item: action,
        snapshot: requireSnapshot(repository, tenant.id, params.caseId)
      };
    })
  );

  app.post(
    "/v1/patient-cases/:caseId/approvals/:approvalId/resolve",
    withErrors((request) => {
      const params = z.object({ caseId: z.string().min(1), approvalId: z.string().min(1) }).parse(request.params);
      const body = ResolveApprovalSchema.parse(request.body);
      const tenant = resolveTenant(repository, body);
      const approval = repository.resolveApproval(tenant.id, params.caseId, params.approvalId, {
        decision: body.decision,
        notes: body.notes,
        actorId: body.actorId
      });
      return {
        tenantId: tenant.id,
        patientCaseId: params.caseId,
        item: approval,
        snapshot: requireSnapshot(repository, tenant.id, params.caseId)
      };
    })
  );

  app.patch(
    "/v1/patient-cases/:caseId/status",
    withErrors((request) => {
      const params = z.object({ caseId: z.string().min(1) }).parse(request.params);
      const body = UpdateCaseStatusSchema.parse(request.body);
      const tenant = resolveTenant(repository, body);
      const patientCase = repository.updateCaseStatus(tenant.id, params.caseId, body.status, body.actorId);
      return {
        tenantId: tenant.id,
        patientCaseId: params.caseId,
        item: patientCase,
        snapshot: requireSnapshot(repository, tenant.id, params.caseId)
      };
    })
  );

  app.post(
    "/v1/callbacks",
    withErrors((request) => {
      const body = CreateCallbackSchema.parse(request.body);
      const tenant = resolveTenant(repository, body);
      const callback = repository.createCallback(tenant.id, {
        patientId: body.patientId,
        patient: body.patient,
        notes: body.notes,
        channel: body.channel
      });
      return {
        tenantId: tenant.id,
        patientCaseId: callback.patientCaseId,
        item: callback,
        snapshot: requireSnapshot(repository, tenant.id, callback.patientCaseId)
      };
    })
  );

  app.get(
    "/v1/messages/threads",
    withErrors((request) => {
      const query = ListThreadsSchema.parse(request.query);
      const tenant = resolveTenant(repository, query);
      if (query.caseId) {
        requireSnapshot(repository, tenant.id, query.caseId);
      }
      const items = repository
        .listThreads(tenant.id)
        .filter((thread) => !query.caseId || thread.patientCaseId === query.caseId)
        .sort((left, right) => right.createdAt.localeCompare(left.createdAt));
      return {
        tenantId: tenant.id,
        items
      };
    })
  );

  app.post(
    "/v1/messages/patient-flow",
    withErrors(async (request) => {
      const body = PatientMessageSchema.parse(request.body);
      const tenant = resolveTenant(repository, body);

      requireSnapshot(repository, tenant.id, body.caseId);
      repository.appendConversationMessage(tenant.id, body.caseId, "patient", body.message);

      const snapshotBeforeReply = requireSnapshot(repository, tenant.id, body.caseId);
      const recommendation = await runtime.plan({
        mode: "patient",
        tenant,
        input: body.message,
        patientCase: snapshotBeforeReply
      });

      const applied = materializePatientAction(repository, tenant.id, body.caseId, body.actorId, recommendation);
      const thread = repository.appendConversationMessage(tenant.id, body.caseId, "agent", recommendation.summary);
      const snapshot = requireSnapshot(repository, tenant.id, body.caseId);

      return {
        tenantId: tenant.id,
        patientCaseId: body.caseId,
        recommendation,
        applied,
        thread,
        snapshot
      };
    })
  );

  const rescheduleAppointmentHandler = withErrors((request) => {
    const params = z.object({ appointmentId: z.string().min(1) }).parse(request.params);
    const body = ActorContextSchema.parse(request.body);
    const tenant = resolveTenant(repository, body);
    const appointment = repository.requestReschedule(tenant.id, params.appointmentId, body.actorType, body.actorId);
    return {
      tenantId: tenant.id,
      patientCaseId: appointment.patientCaseId,
      item: appointment,
      snapshot: requireSnapshot(repository, tenant.id, appointment.patientCaseId)
    };
  });

  app.get(
    "/v1/appointments",
    withErrors((request) => {
      const query = TenantReferenceSchema.parse(request.query);
      const tenant = resolveTenant(repository, query);
      return {
        tenantId: tenant.id,
        items: repository.listAppointments(tenant.id)
      };
    })
  );

  app.post(
    "/v1/appointments/:appointmentId/confirm",
    withErrors((request) => {
      const params = z.object({ appointmentId: z.string().min(1) }).parse(request.params);
      const body = ActorContextSchema.parse(request.body);
      const tenant = resolveTenant(repository, body);
      const appointment = repository.confirmAppointment(tenant.id, params.appointmentId, body.actorType, body.actorId);
      return {
        tenantId: tenant.id,
        patientCaseId: appointment.patientCaseId,
        item: appointment,
        snapshot: requireSnapshot(repository, tenant.id, appointment.patientCaseId)
      };
    })
  );

  app.post(
    "/v1/appointments/:appointmentId/reschedule",
    rescheduleAppointmentHandler
  );

  app.post(
    "/v1/appointments/:appointmentId/reschedule-request",
    rescheduleAppointmentHandler
  );

  app.post(
    "/v1/appointments/:appointmentId/check-in",
    withErrors((request) => {
      const params = z.object({ appointmentId: z.string().min(1) }).parse(request.params);
      const body = ActorContextSchema.parse(request.body);
      const tenant = resolveTenant(repository, body);
      const appointment = repository.checkInAppointment(tenant.id, params.appointmentId, body.actorType, body.actorId);
      return {
        tenantId: tenant.id,
        patientCaseId: appointment.patientCaseId,
        item: appointment,
        snapshot: requireSnapshot(repository, tenant.id, appointment.patientCaseId)
      };
    })
  );

  app.post(
    "/v1/appointments/:appointmentId/no-show",
    withErrors((request) => {
      const params = z.object({ appointmentId: z.string().min(1) }).parse(request.params);
      const body = ActorContextSchema.parse(request.body);
      const tenant = resolveTenant(repository, body);
      const appointment = repository.markNoShow(tenant.id, params.appointmentId, body.actorType, body.actorId);
      return {
        tenantId: tenant.id,
        patientCaseId: appointment.patientCaseId,
        item: appointment,
        snapshot: requireSnapshot(repository, tenant.id, appointment.patientCaseId)
      };
    })
  );

  app.get(
    "/v1/queue",
    withErrors((request) => {
      const query = TenantReferenceSchema.parse(request.query);
      const tenant = resolveTenant(repository, query);
      return {
        tenantId: tenant.id,
        items: repository.listQueue(tenant.id)
      };
    })
  );

  app.post(
    "/v1/queue/:ticketId/call",
    withErrors((request) => {
      const params = z.object({ ticketId: z.string().min(1) }).parse(request.params);
      const body = ActorContextSchema.parse(request.body);
      const tenant = resolveTenant(repository, body);
      const ticket = repository.callQueueTicket(tenant.id, params.ticketId, body.actorType, body.actorId);
      return {
        tenantId: tenant.id,
        patientCaseId: ticket.patientCaseId,
        item: ticket,
        snapshot: requireSnapshot(repository, tenant.id, ticket.patientCaseId)
      };
    })
  );

  app.post(
    "/v1/queue/:ticketId/complete",
    withErrors((request) => {
      const params = z.object({ ticketId: z.string().min(1) }).parse(request.params);
      const body = ActorContextSchema.parse(request.body);
      const tenant = resolveTenant(repository, body);
      const ticket = repository.completeQueueTicket(tenant.id, params.ticketId, body.actorType, body.actorId);
      return {
        tenantId: tenant.id,
        patientCaseId: ticket.patientCaseId,
        item: ticket,
        snapshot: requireSnapshot(repository, tenant.id, ticket.patientCaseId)
      };
    })
  );

  app.get(
    "/v1/audit",
    withErrors((request) => {
      const query = ListAuditSchema.parse(request.query);
      const tenant = resolveTenant(repository, query);
      if (query.caseId) {
        requireSnapshot(repository, tenant.id, query.caseId);
      }

      const items = repository
        .listAudit(tenant.id)
        .filter((entry) => !query.entityType || entry.entityType === query.entityType)
        .filter((entry) => !query.caseId || auditMatchesCase(entry, query.caseId))
        .sort((left, right) => right.createdAt.localeCompare(left.createdAt));

      return {
        tenantId: tenant.id,
        items
      };
    })
  );

  app.get(
    "/v1/agent-tasks",
    withErrors((request) => {
      const query = TenantReferenceSchema.parse(request.query);
      const tenant = resolveTenant(repository, query);
      return {
        tenantId: tenant.id,
        items: repository.listAgentTasks(tenant.id)
      };
    })
  );

  app.post(
    "/v1/agent-tasks/ops-next-best-action",
    opsNextBestActionHandler
  );

  const kpiHandler = withErrors((request) => {
    const query = TenantReferenceSchema.parse(request.query);
    const tenant = resolveTenant(repository, query);
    return repository.getKpiReport(tenant.id);
  });

  app.get(
    "/v1/reports/kpi",
    kpiHandler
  );

  app.get(
    "/v1/kpi",
    kpiHandler
  );

  app.post(
    "/v1/ops/next-best-action",
    opsNextBestActionHandler
  );

  app.get(
    "/v1/patient-cases/:tenantId/:caseId/copilot",
    withErrors(async (request) => {
      const params = z.object({ tenantId: z.string().min(1), caseId: z.string().min(1) }).parse(request.params);
      const query = z.object({ input: z.string().optional() }).parse(request.query ?? {});
      const inspection = await copilot.inspectCase({
        tenantId: params.tenantId,
        caseId: params.caseId,
        input: query.input
      });
      return { ok: true, data: inspection };
    })
  );

  app.post(
    "/v1/patient-cases/:tenantId/:caseId/copilot/review",
    withErrors(async (request) => {
      const params = z.object({ tenantId: z.string().min(1), caseId: z.string().min(1) }).parse(request.params);
      const body = z.object({
        recommendationAction: z.enum([
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
        ]),
        decision: z.enum(["approve", "edit_and_run", "reject", "snooze"]),
        actor: z.string().min(1),
        note: z.string().nullable().optional(),
        preparedActionId: z.string().nullable().optional(),
        executeNow: z.boolean().optional(),
        messageOverride: z.string().nullable().optional()
      }).parse(request.body);

      const result = await copilot.reviewCase(params.tenantId, params.caseId, body);
      return {
        ok: true,
        data: {
          ...result.review,
          review: result.review,
          execution: result.execution,
          dispatchJob: result.dispatchJob,
          snapshot: result.snapshot,
          recommendation: result.recommendation,
          preparedAction: result.preparedAction,
          card: result.card
        }
      };
    })
  );

  app.post(
    "/v1/patient-cases/:tenantId/:caseId/prepared-actions/:preparedActionId/retry",
    withErrors(async (request) => {
      const params = z.object({
        tenantId: z.string().min(1),
        caseId: z.string().min(1),
        preparedActionId: z.string().min(1)
      }).parse(request.params);
      const body = RetryPreparedActionSchema.parse(request.body);
      const result = await copilot.retryPreparedActionExecution(params.tenantId, params.caseId, {
        preparedActionId: params.preparedActionId,
        actor: body.actor,
        messageOverride: body.messageOverride ?? null
      });
      return {
        ok: true,
        data: {
          execution: result.execution,
          dispatchJob: result.dispatchJob,
          snapshot: result.snapshot,
          recommendation: result.recommendation,
          preparedAction: result.preparedAction,
          card: result.card
        }
      };
    })
  );

  app.post(
    "/v1/copilot/dispatch-worker/drain",
    withErrors(async (request) => {
      const body = DispatchWorkerDrainSchema.parse(request.body ?? {});
      const tenant =
        body.tenantId || body.tenantSlug
          ? resolveTenant(repository, {
              tenantId: body.tenantId,
              tenantSlug: body.tenantSlug
            })
          : null;

      return {
        ok: true,
        data: await copilot.drainDispatchQueue({
          tenantId: tenant?.id,
          workerId: body.workerId,
          limit: body.limit,
          leaseTtlMs: body.leaseTtlMs
        })
      };
    })
  );

  app.post(
    "/v1/copilot/receipts/webhook",
    withErrors((request) => {
      const body = CopilotReceiptWebhookSchema.parse(request.body);
      const tenant = resolveTenant(repository, body);
      const result = copilot.recordReceiptWebhook(tenant.id, {
        receiptRecordId: body.receiptRecordId,
        preparedActionId: body.preparedActionId,
        dispatchJobId: body.dispatchJobId,
        system: body.system,
        eventType: body.eventType,
        idempotencyKey: body.idempotencyKey,
        externalRef: body.externalRef,
        payload: body.payload,
        occurredAt: body.occurredAt ?? null,
        error: body.error ?? null
      });
      return {
        ok: true,
        data: {
          receipt: result.receipt,
          event: result.event,
          snapshot: result.snapshot
        }
      };
    })
  );

  app.post(
    "/v1/import/openclaw",
    withErrors((request) => {
      const bundle = OpenClawImportBundleSchema.parse(request.body);
      const result = importOpenClawProjectedCases(bundle);
      return {
        stats: result.stats,
        state: result.state
      };
    })
  );
}
