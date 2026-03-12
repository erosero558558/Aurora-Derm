import {
  CopilotRecommendationSchema,
  PreparedActionPacketSchema,
  isAllowedPatientAction,
  preparedActionTypeForAction,
  requiresHumanApproval
} from "../../core/src/index.js";
import type {
  AgentAction,
  CopilotEvidenceRef,
  CopilotRecommendation,
  PatientCaseAction,
  PatientCaseApproval,
  PatientCaseSnapshot,
  PatientIntent,
  PreparedActionPacket,
  QueueTicket,
  TenantConfig
} from "../../core/src/index.js";

export type AgentRuntimeMode = "patient" | "ops";

export interface AgentRuntimeRequest {
  mode: AgentRuntimeMode;
  tenant: TenantConfig;
  input: string;
  patientCase?: PatientCaseSnapshot;
  cases?: PatientCaseSnapshot[];
}

export interface AgentRuntimeResult {
  recommendation: CopilotRecommendation;
  preparedAction: PreparedActionPacket;
}

export interface AgentProvider {
  name: string;
  decide(request: AgentRuntimeRequest): Promise<CopilotRecommendation>;
}

function nowIso(): string {
  return new Date().toISOString();
}

function makeId(prefix: string): string {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}`;
}

function normalize(text: string): string {
  return text.toLowerCase();
}

function fallbackIntentFromInput(input: string): PatientIntent {
  const text = normalize(input);
  if (text.includes("cancel") || text.includes("doctor") || text.includes("todas") || text.includes("all")) {
    return "unknown";
  }
  if (text.includes("confirm")) return "confirm_appointment";
  if (text.includes("reprogram") || text.includes("cambiar")) return "request_reschedule";
  if (text.includes("check in") || text.includes("llegu") || text.includes("ya estoy")) return "start_check_in";
  if (text.includes("turno") || text.includes("cola") || text.includes("espera") || text.includes("status")) {
    return "track_queue_status";
  }
  if (text.includes("hora") || text.includes("ubic") || text.includes("document") || text.includes("whatsapp")) {
    return "faq_operational";
  }
  return "unknown";
}

function resolvePrimaryCase(request: AgentRuntimeRequest): PatientCaseSnapshot | undefined {
  return request.patientCase ?? request.cases?.[0];
}

function latestQueueTicket(patientCase: PatientCaseSnapshot | undefined): QueueTicket | undefined {
  return patientCase?.queueTickets.find((ticket) => ticket.status === "called")
    ?? patientCase?.queueTickets.find((ticket) => ticket.status === "waiting")
    ?? patientCase?.queueTickets.at(0);
}

function pendingApproval(patientCase: PatientCaseSnapshot | undefined): PatientCaseApproval | undefined {
  return patientCase?.approvals.find((approval) => approval.status === "pending");
}

function pendingCaseAction(patientCase: PatientCaseSnapshot | undefined, action: AgentAction): PatientCaseAction | undefined {
  return patientCase?.actions.find((candidate) => candidate.action === action && candidate.status === "pending");
}

function latestAppointmentStatus(patientCase: PatientCaseSnapshot | undefined): string | null {
  return patientCase?.appointments
    .slice()
    .sort((left, right) => right.createdAt.localeCompare(left.createdAt))[0]?.status ?? null;
}

function patientQueueSummary(patientCase: PatientCaseSnapshot | undefined): string {
  const liveTicket = latestQueueTicket(patientCase);
  if (!liveTicket) {
    return "No hay ticket activo todavía.";
  }
  if (liveTicket.status === "waiting") {
    return `Tu ticket ${liveTicket.ticketNumber} sigue en espera.`;
  }
  if (liveTicket.status === "called") {
    return `Tu ticket ${liveTicket.ticketNumber} está siendo llamado.`;
  }
  return `Tu ticket ${liveTicket.ticketNumber} quedó ${liveTicket.status}.`;
}

function buildEvidenceRefs(patientCase: PatientCaseSnapshot | undefined, recommendedAction: AgentAction): CopilotEvidenceRef[] {
  if (!patientCase) {
    return [];
  }

  const refs: CopilotEvidenceRef[] = [
    {
      kind: "patient_case",
      entityId: patientCase.case.id,
      label: `case:${patientCase.case.status}`
    }
  ];

  const approval = pendingApproval(patientCase);
  if (approval) {
    refs.push({
      kind: "approval",
      entityId: approval.id,
      label: `approval:${approval.type}:${approval.status}`
    });
  }

  const ticket = latestQueueTicket(patientCase);
  if (ticket) {
    refs.push({
      kind: "queue_ticket",
      entityId: ticket.id,
      label: `queue:${ticket.status}:${ticket.ticketNumber}`
    });
  }

  const relevantAction = pendingCaseAction(patientCase, recommendedAction)
    ?? patientCase.actions.find((action) => action.status === "pending");
  if (relevantAction) {
    refs.push({
      kind: "action",
      entityId: relevantAction.id,
      label: `action:${relevantAction.action}:${relevantAction.status}`
    });
  }

  const latestEvent = patientCase.timeline.at(-1);
  if (latestEvent) {
    refs.push({
      kind: "timeline_event",
      entityId: latestEvent.id,
      label: `timeline:${latestEvent.type}`
    });
  }

  return refs;
}

function buildRecommendation(
  providerName: string,
  recommendedAction: AgentAction,
  intent: PatientIntent,
  summary: string,
  whyNow: string,
  riskIfIgnored: string,
  confidence: number,
  patientCase?: PatientCaseSnapshot,
  degraded = true,
  blockedBy: string[] = [],
  explicitHumanApproval?: boolean
): CopilotRecommendation {
  return {
    recommendedAction,
    intent,
    summary,
    whyNow,
    riskIfIgnored,
    confidence,
    blockedBy,
    requiresHumanApproval: explicitHumanApproval ?? requiresHumanApproval(recommendedAction),
    degraded,
    providerName,
    evidenceRefs: buildEvidenceRefs(patientCase, recommendedAction)
  };
}

function redactCaseForProvider(patientCase: PatientCaseSnapshot | undefined): Record<string, unknown> | null {
  if (!patientCase) {
    return null;
  }

  const approval = pendingApproval(patientCase);
  const ticket = latestQueueTicket(patientCase);
  const latestAction = patientCase.actions
    .slice()
    .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))[0];

  return {
    caseId: patientCase.case.id,
    status: patientCase.case.status,
    summary: {
      serviceLine: patientCase.case.summary.serviceLine,
      providerName: patientCase.case.summary.providerName,
      scheduledStart: patientCase.case.summary.scheduledStart,
      queueStatus: patientCase.case.summary.queueStatus,
      openActionCount: patientCase.case.summary.openActionCount,
      pendingApprovalCount: patientCase.case.summary.pendingApprovalCount
    },
    latestAppointmentStatus: latestAppointmentStatus(patientCase),
    pendingApproval: approval ? { id: approval.id, type: approval.type, reason: approval.reason } : null,
    queue: ticket ? { id: ticket.id, status: ticket.status, ticketNumber: ticket.ticketNumber } : null,
    latestAction: latestAction ? { action: latestAction.action, status: latestAction.status, channel: latestAction.channel } : null,
    threadCount: patientCase.conversationThreads.length,
    callbackCount: patientCase.callbacks.length
  };
}

function parseResponsePayload(data: unknown): string {
  if (!data || typeof data !== "object") {
    throw new Error("OpenAI provider returned no payload");
  }

  const withOutputText = data as { output_text?: string };
  if (typeof withOutputText.output_text === "string" && withOutputText.output_text.trim() !== "") {
    return withOutputText.output_text;
  }

  const withOutput = data as {
    output?: Array<{
      type?: string;
      content?: Array<{ type?: string; text?: string }>;
    }>;
  };
  const content = withOutput.output
    ?.flatMap((item) => item.content ?? [])
    .find((item) => item.type === "output_text" && typeof item.text === "string" && item.text.trim() !== "");
  if (content?.text) {
    return content.text;
  }

  throw new Error("OpenAI provider returned no JSON payload");
}

export class HeuristicFallbackProvider implements AgentProvider {
  name = "heuristic_fallback";

  async decide(request: AgentRuntimeRequest): Promise<CopilotRecommendation> {
    if (request.mode === "ops") {
      const patientCase = resolvePrimaryCase(request);
      if (patientCase) {
        const approval = pendingApproval(patientCase);
        const ticket = latestQueueTicket(patientCase);
        const rescheduleAction = pendingCaseAction(patientCase, "request_reschedule");
        const followUpAction = pendingCaseAction(patientCase, "send_follow_up");
        const appointmentStatus = latestAppointmentStatus(patientCase);

        if (approval?.type === "payment_review") {
          return buildRecommendation(
            this.name,
            "request_payment_followup",
            "unknown",
            "La siguiente jugada es destrabar el pago pendiente del case.",
            "Hay una aprobación de pago abierta y el case no debería seguir avanzando sin resolver esa evidencia.",
            "La visita puede quedarse bloqueada y el equipo pierde trazabilidad del cobro.",
            0.87,
            patientCase,
            true,
            [`approval:${approval.id}`]
          );
        }

        if (approval) {
          return buildRecommendation(
            this.name,
            "review_approval",
            "unknown",
            "Hay una aprobación pendiente que Ops debe revisar ahora.",
            "El case ya tiene un bloqueo explícito y la decisión humana es el cuello de botella principal.",
            "El caso puede quedarse detenido sin una siguiente acción clara para el staff.",
            0.84,
            patientCase,
            true,
            [`approval:${approval.id}`]
          );
        }

        if (appointmentStatus === "reschedule_requested" || Boolean(rescheduleAction)) {
          return buildRecommendation(
            this.name,
            "propose_reschedule",
            "request_reschedule",
            "Conviene preparar una reprogramación concreta y dejarla lista para revisión.",
            "El patient case ya expresó o registró necesidad de mover la agenda.",
            "Se enfría el caso y aumenta la probabilidad de pérdida o doble trabajo operativo.",
            0.83,
            patientCase,
            true,
            rescheduleAction ? [`action:${rescheduleAction.id}`] : []
          );
        }

        if (ticket?.status === "waiting" || ticket?.status === "called" || patientCase.case.status === "queued") {
          return buildRecommendation(
            this.name,
            "call_next_patient",
            "unknown",
            "La cola está viva y el siguiente paso correcto es llamar al paciente.",
            "El case ya está en sala y no necesita más preparación antes de avanzar.",
            "Se acumula espera, se erosiona la experiencia y la sala pierde ritmo.",
            0.9,
            patientCase,
            true
          );
        }

        if (appointmentStatus === "no_show" || patientCase.case.status === "follow_up_pending" || Boolean(followUpAction)) {
          return buildRecommendation(
            this.name,
            "recover_no_show",
            "unknown",
            "El case necesita recuperación activa por no-show o follow-up vencido.",
            "Ya existe evidencia de que el episodio quedó abierto sin cierre operativo.",
            "El caso puede perderse y el equipo deja ingresos o continuidad clínica sobre la mesa.",
            0.86,
            patientCase,
            true,
            followUpAction ? [`action:${followUpAction.id}`] : []
          );
        }

        if (patientCase.case.status === "awaiting_booking" || patientCase.case.status === "qualified") {
          return buildRecommendation(
            this.name,
            "send_booking_options",
            "unknown",
            "El siguiente paso es preparar opciones concretas de agenda para cerrar booking.",
            "El caso ya está listo para convertir intención en cita, pero aún falta propuesta operativa.",
            "El paciente puede enfriarse o terminar fuera del flujo por falta de respuesta accionable.",
            0.78,
            patientCase
          );
        }
      }

      const cases = request.cases ?? [];
      if (cases.some((snapshot) => pendingApproval(snapshot))) {
        return buildRecommendation(
          this.name,
          "review_approval",
          "unknown",
          "Hay bloqueos de aprobación activos en el tablero.",
          "Antes de optimizar la cola conviene liberar los cases que están explícitamente detenidos.",
          "Se multiplican los casos atascados y cae la claridad operativa del equipo.",
          0.79,
          resolvePrimaryCase(request)
        );
      }

      if (cases.some((snapshot) => latestQueueTicket(snapshot))) {
        return buildRecommendation(
          this.name,
          "call_next_patient",
          "unknown",
          "La operación tiene cases activos en cola.",
          "La sala tiene trabajo listo para avanzar de inmediato.",
          "La experiencia de espera se degrada y el equipo pierde ritmo.",
          0.82,
          resolvePrimaryCase(request)
        );
      }

      return buildRecommendation(
        this.name,
        "send_follow_up",
        "unknown",
        "No hay un bloqueo crítico, así que conviene limpiar seguimiento pendiente.",
        "Cuando la presión en sala baja, el mejor uso del tiempo es vaciar backlog operativo.",
        "Se acumulan casos tibios y se pierde continuidad en el flujo.",
        0.61,
        resolvePrimaryCase(request)
      );
    }

    const patientCase = resolvePrimaryCase(request);
    const intent = fallbackIntentFromInput(request.input);
    if (intent === "confirm_appointment") {
      return buildRecommendation(
        this.name,
        "confirm_appointment",
        intent,
        "Puedo dejar confirmada tu cita dentro del caso operativo.",
        "El mensaje expresa confirmación explícita y el case ya tiene contexto para avanzar.",
        "La cita puede quedar ambigua y provocar fricción en la preparación de visita.",
        0.92,
        patientCase
      );
    }

    if (intent === "request_reschedule") {
      return buildRecommendation(
        this.name,
        "request_reschedule",
        intent,
        "Puedo registrar tu solicitud de reprogramación y dejarla lista para revisión del equipo.",
        "El cambio pedido entra en el perímetro operativo permitido del agente paciente.",
        "Se puede perder el contexto del pedido y aumentar el retrabajo del staff.",
        0.88,
        patientCase
      );
    }

    if (intent === "start_check_in") {
      return buildRecommendation(
        this.name,
        "start_check_in",
        intent,
        "Puedo iniciar tu check-in y avisar al flujo operativo que ya llegaste.",
        "El paciente está comunicando llegada o intención clara de check-in.",
        "La recepción puede seguir tratando el caso como pendiente o ausente.",
        0.9,
        patientCase
      );
    }

    if (intent === "track_queue_status") {
      return buildRecommendation(
        this.name,
        "show_queue_status",
        intent,
        patientQueueSummary(patientCase),
        "La solicitud pide visibilidad puntual del estado de sala.",
        "El paciente puede repetir mensajes o escalar a staff sin necesitarlo.",
        0.84,
        patientCase,
        true,
        latestQueueTicket(patientCase) ? [`queue:${latestQueueTicket(patientCase)?.id}`] : []
      );
    }

    if (intent === "faq_operational") {
      return buildRecommendation(
        this.name,
        "answer_operational_faq",
        intent,
        "Puedo responder dudas operativas del caso, como horario, ubicación o canal de contacto.",
        "La pregunta está dentro del perímetro administrativo y no requiere criterio clínico.",
        "La conversación puede caer en handoff innecesario o generar demoras evitables.",
        0.78,
        patientCase
      );
    }

    return buildRecommendation(
      this.name,
      "handoff_to_staff",
      intent,
      "Voy a pasar este caso a una persona del equipo para revisarlo con seguridad.",
      "La intención no entra de forma suficientemente segura en el perímetro permitido.",
      "Responder de forma automática podría crear una acción errónea o incompleta.",
      0.52,
      patientCase,
      true,
      [],
      true
    );
  }
}

export class OpenAIResponsesProvider implements AgentProvider {
  name = "openai_responses";

  async decide(request: AgentRuntimeRequest): Promise<CopilotRecommendation> {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      throw new Error("OPENAI_API_KEY is missing");
    }

    const model = process.env.OPENAI_MODEL || "gpt-4.1-mini";
    const baseUrl = process.env.OPENAI_BASE_URL || "https://api.openai.com/v1";
    const focusCase = redactCaseForProvider(resolvePrimaryCase(request));
    const relatedCases = (request.cases ?? [])
      .slice(0, 5)
      .map((snapshot) => redactCaseForProvider(snapshot))
      .filter((snapshot): snapshot is Record<string, unknown> => Boolean(snapshot));
    const prompt = [
      "You are the PatientCase Copilot for Patient Flow OS.",
      "Return only compact JSON.",
      "Use exactly these keys:",
      "recommendedAction, intent, summary, whyNow, riskIfIgnored, confidence, blockedBy, requiresHumanApproval, degraded, evidenceRefs.",
      "recommendedAction must be one of:",
      "confirm_appointment, request_reschedule, start_check_in, show_queue_status, answer_operational_faq, call_next_patient, review_approval, propose_reschedule, request_payment_followup, send_booking_options, recover_no_show, send_follow_up, handoff_to_staff.",
      "Patient mode may only use safe operational actions or handoff_to_staff.",
      "blockedBy must be an array of short machine-friendly strings.",
      "evidenceRefs must be an array of objects with kind, entityId, label.",
      "Do not include PHI or free-form patient biography.",
      `Mode: ${request.mode}`,
      `Tenant: ${JSON.stringify({ id: request.tenant.id, name: request.tenant.name, timezone: request.tenant.timezone })}`,
      `Input: ${request.input}`,
      focusCase ? `PrimaryCase: ${JSON.stringify(focusCase)}` : "PrimaryCase: null",
      relatedCases.length > 0 ? `RelatedCases: ${JSON.stringify(relatedCases)}` : "RelatedCases: []"
    ].join("\n");

    const response = await fetch(`${baseUrl}/responses`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model,
        input: prompt
      })
    });

    if (!response.ok) {
      throw new Error(`OpenAI provider failed with status ${response.status}`);
    }

    const rawText = parseResponsePayload(await response.json());
    const jsonMatch = rawText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error("OpenAI provider returned no JSON payload");
    }

    const parsed = JSON.parse(jsonMatch[0]) as CopilotRecommendation;
    return CopilotRecommendationSchema.parse({
      ...parsed,
      providerName: this.name,
      degraded: false
    });
  }
}

export class FailingProvider implements AgentProvider {
  name = "failing_provider";

  async decide(): Promise<CopilotRecommendation> {
    throw new Error("Synthetic provider failure");
  }
}

export class AgentRuntime {
  constructor(
    private readonly primaryProvider: AgentProvider,
    private readonly fallbackProvider: AgentProvider = new HeuristicFallbackProvider()
  ) {}

  async decide(request: AgentRuntimeRequest): Promise<CopilotRecommendation> {
    let decision: CopilotRecommendation;

    try {
      decision = await this.primaryProvider.decide(request);
    } catch {
      decision = await this.fallbackProvider.decide(request);
    }

    const parsed = CopilotRecommendationSchema.parse(decision);

    if (request.mode === "patient" && !isAllowedPatientAction(parsed.recommendedAction)) {
      return buildRecommendation(
        parsed.providerName,
        "handoff_to_staff",
        parsed.intent,
        "Necesito pasar esto a una persona para revisar el siguiente paso con seguridad.",
        "La acción sugerida sale del perímetro permitido del agente paciente.",
        parsed.riskIfIgnored,
        parsed.confidence,
        resolvePrimaryCase(request),
        parsed.degraded,
        parsed.blockedBy,
        true
      );
    }

    if (request.mode === "patient" && parsed.requiresHumanApproval) {
      return buildRecommendation(
        parsed.providerName,
        "handoff_to_staff",
        parsed.intent,
        "Voy a escalar tu solicitud al equipo para que la revise una persona.",
        parsed.whyNow,
        parsed.riskIfIgnored,
        parsed.confidence,
        resolvePrimaryCase(request),
        parsed.degraded,
        parsed.blockedBy,
        true
      );
    }

    return parsed;
  }

  async prepare(request: AgentRuntimeRequest, recommendation?: CopilotRecommendation): Promise<PreparedActionPacket> {
    const resolvedRecommendation = recommendation ?? await this.decide(request);
    const patientCase = resolvePrimaryCase(request);
    const appointment = patientCase?.appointments
      .slice()
      .sort((left, right) => right.createdAt.localeCompare(left.createdAt))[0];
    const approval = pendingApproval(patientCase);
    const queueTicket = latestQueueTicket(patientCase);
    const followUpAction = pendingCaseAction(patientCase, "send_follow_up");

    const payloadDraft: Record<string, unknown> = {
      tenantId: request.tenant.id,
      patientCaseId: patientCase?.case.id ?? "unknown",
      mode: request.mode
    };
    let title = "Route to staff";
    let messageDraft: string | null = null;
    let destinationSystem = "ops_handoff_queue";
    const preconditions: string[] = [];

    switch (resolvedRecommendation.recommendedAction) {
      case "call_next_patient":
        title = "Call the next patient from queue";
        destinationSystem = "queue_console";
        if (queueTicket) {
          payloadDraft.ticketId = queueTicket.id;
          payloadDraft.locationId = queueTicket.locationId;
          payloadDraft.ticketNumber = queueTicket.ticketNumber;
          preconditions.push("Queue ticket remains in waiting or called state.");
        }
        messageDraft = `Llamar al ticket ${queueTicket?.ticketNumber ?? "activo"} y avanzar el patient case en sala.`;
        break;
      case "review_approval":
        title = "Review pending approval";
        destinationSystem = approval?.type === "payment_review" ? "payments_review_queue" : "ops_handoff_queue";
        if (approval) {
          payloadDraft.approvalId = approval.id;
          payloadDraft.approvalType = approval.type;
          preconditions.push("Approval still pending.");
        }
        messageDraft = "Revisar la aprobación pendiente y documentar la resolución antes de seguir moviendo el caso.";
        break;
      case "propose_reschedule":
        title = "Prepare reschedule proposal";
        destinationSystem = "scheduling_workbench";
        if (appointment) {
          payloadDraft.appointmentId = appointment.id;
          payloadDraft.currentStart = appointment.scheduledStart;
          payloadDraft.currentEnd = appointment.scheduledEnd;
          payloadDraft.providerName = appointment.providerName;
          preconditions.push("Appointment still requires reschedule.");
        }
        messageDraft = "Proponer dos o tres horarios alternos y dejar el mensaje listo para revisión.";
        break;
      case "request_payment_followup":
        title = "Prepare payment follow-up";
        destinationSystem = "payments_review_queue";
        if (approval) {
          payloadDraft.approvalId = approval.id;
          payloadDraft.reason = approval.reason;
          preconditions.push("Payment evidence has not been cleared yet.");
        }
        messageDraft = "Pedir o confirmar la evidencia de pago faltante con un mensaje listo para enviar tras revisión.";
        break;
      case "send_booking_options":
        title = "Prepare booking options";
        destinationSystem = "scheduling_workbench";
        if (appointment) {
          payloadDraft.appointmentId = appointment.id;
        }
        payloadDraft.serviceLine = patientCase?.case.summary.serviceLine ?? null;
        payloadDraft.providerName = patientCase?.case.summary.providerName ?? null;
        preconditions.push("Case remains ready for booking.");
        messageDraft = "Preparar opciones concretas de agenda para cerrar la cita en el siguiente contacto.";
        break;
      case "recover_no_show":
        title = "Prepare no-show recovery";
        destinationSystem = "ops_followup_queue";
        if (followUpAction) {
          payloadDraft.followUpActionId = followUpAction.id;
        }
        if (appointment) {
          payloadDraft.appointmentId = appointment.id;
        }
        preconditions.push("Case still open after a no-show or missed visit.");
        messageDraft = "Dejar listo un follow-up cálido y claro para recuperar el case sin perder contexto.";
        break;
      case "request_reschedule":
        title = "Register reschedule request";
        destinationSystem = "scheduling_workbench";
        if (appointment) {
          payloadDraft.appointmentId = appointment.id;
        }
        preconditions.push("Patient case still active.");
        messageDraft = "Registrar la solicitud y pasarla al equipo para confirmar nuevas opciones.";
        break;
      case "confirm_appointment":
        title = "Confirm appointment";
        destinationSystem = "scheduling_workbench";
        if (appointment) {
          payloadDraft.appointmentId = appointment.id;
          preconditions.push("Appointment is still scheduled or awaiting confirmation.");
        }
        messageDraft = "Marcar la cita como confirmada y reflejarlo en el case.";
        break;
      case "start_check_in":
        title = "Start patient check-in";
        destinationSystem = "queue_console";
        if (appointment) {
          payloadDraft.appointmentId = appointment.id;
        }
        preconditions.push("Patient is physically present or explicitly checking in.");
        messageDraft = "Registrar llegada del paciente y mover el case a sala.";
        break;
      case "show_queue_status":
        title = "Show queue status";
        destinationSystem = "queue_console";
        if (queueTicket) {
          payloadDraft.ticketId = queueTicket.id;
        }
        messageDraft = patientQueueSummary(patientCase);
        break;
      case "answer_operational_faq":
        title = "Answer operational FAQ";
        destinationSystem = "ops_handoff_queue";
        payloadDraft.topic = "operational_faq";
        messageDraft = "Responder con la información operativa confirmada del caso.";
        break;
      case "send_follow_up":
        title = "Prepare follow-up";
        destinationSystem = "ops_followup_queue";
        if (followUpAction) {
          payloadDraft.followUpActionId = followUpAction.id;
        }
        messageDraft = "Dejar listo el follow-up operativo del caso.";
        break;
      default:
        title = "Hand off to staff";
        destinationSystem = "ops_handoff_queue";
        messageDraft = "Escalar a una persona del equipo para revisión.";
        preconditions.push("Staff review is required before any sensitive next step.");
        break;
    }

    return PreparedActionPacketSchema.parse({
      id: makeId("prepared_action"),
      patientCaseId: patientCase?.case.id ?? "unknown",
      type: preparedActionTypeForAction(resolvedRecommendation.recommendedAction),
      recommendedAction: resolvedRecommendation.recommendedAction,
      title,
      payloadDraft,
      messageDraft,
      destinationSystem,
      preconditions,
      requiresHumanApproval: resolvedRecommendation.requiresHumanApproval,
      generatedAt: nowIso()
    });
  }

  async run(request: AgentRuntimeRequest): Promise<AgentRuntimeResult> {
    const recommendation = await this.decide(request);
    const preparedAction = await this.prepare(request, recommendation);
    return { recommendation, preparedAction };
  }

  async plan(request: AgentRuntimeRequest): Promise<CopilotRecommendation> {
    return this.decide(request);
  }
}

export function createDefaultAgentRuntime(): AgentRuntime {
  const wantsOpenAi = Boolean(process.env.OPENAI_API_KEY) || process.env.AGENT_PROVIDER === "openai";
  if (wantsOpenAi) {
    return new AgentRuntime(new OpenAIResponsesProvider());
  }
  return new AgentRuntime(new HeuristicFallbackProvider());
}
