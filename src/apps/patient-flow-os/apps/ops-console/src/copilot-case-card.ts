import { z } from "zod";

import {
  CopilotReviewDecisionKindSchema,
  PreparedActionTypeSchema
} from "../../../packages/core/src/index.js";
import type {
  CopilotRecommendation,
  PatientCaseSnapshot,
  PreparedActionPacket
} from "../../../packages/core/src/index.js";

const ReviewOptionSchema = z.object({
  id: CopilotReviewDecisionKindSchema,
  label: z.string().min(1),
  description: z.string().min(1),
  requiresNote: z.boolean()
});

export const OpsCopilotCaseCardSchema = z.object({
  caseId: z.string().min(1),
  patientLabel: z.string().min(1),
  statusLabel: z.string().min(1),
  recommendedAction: z.string().min(1),
  preparedActionType: PreparedActionTypeSchema,
  blockedBy: z.array(z.string()),
  evidenceLabels: z.array(z.string()),
  blocks: z.object({
    now: z.object({
      title: z.literal("Ahora"),
      body: z.string().min(1)
    }),
    whyNow: z.object({
      title: z.literal("Por qué"),
      body: z.string().min(1)
    }),
    riskIfIgnored: z.object({
      title: z.literal("Riesgo si no"),
      body: z.string().min(1)
    }),
    preparedAction: z.object({
      title: z.literal("Qué te dejo listo"),
      body: z.string().min(1)
    }),
    humanApproval: z.object({
      title: z.literal("Aprobación humana"),
      body: z.string().min(1)
    })
  }),
  reviewOptions: z.array(ReviewOptionSchema).length(4)
});

export type OpsCopilotCaseCard = z.infer<typeof OpsCopilotCaseCardSchema>;

function preparedActionSummary(preparedAction: PreparedActionPacket): string {
  const conditions = preparedAction.preconditions.length > 0
    ? ` Preconditions: ${preparedAction.preconditions.join(" ")}`
    : "";
  const draft = preparedAction.messageDraft ? ` Draft: ${preparedAction.messageDraft}` : "";
  return `${preparedAction.title} via ${preparedAction.destinationSystem}.${draft}${conditions}`.trim();
}

function patientLabel(snapshot: PatientCaseSnapshot): string {
  return `${snapshot.patient.displayName} · ${snapshot.case.summary.serviceLine ?? "Case"} · ${snapshot.case.id}`;
}

export function buildOpsCopilotCaseCard(
  snapshot: PatientCaseSnapshot,
  recommendation: CopilotRecommendation,
  preparedAction: PreparedActionPacket
): OpsCopilotCaseCard {
  return OpsCopilotCaseCardSchema.parse({
    caseId: snapshot.case.id,
    patientLabel: patientLabel(snapshot),
    statusLabel: snapshot.case.status,
    recommendedAction: recommendation.recommendedAction,
    preparedActionType: preparedAction.type,
    blockedBy: recommendation.blockedBy,
    evidenceLabels: recommendation.evidenceRefs.map((ref) => ref.label),
    blocks: {
      now: {
        title: "Ahora",
        body: recommendation.summary
      },
      whyNow: {
        title: "Por qué",
        body: recommendation.whyNow
      },
      riskIfIgnored: {
        title: "Riesgo si no",
        body: recommendation.riskIfIgnored
      },
      preparedAction: {
        title: "Qué te dejo listo",
        body: preparedActionSummary(preparedAction)
      },
      humanApproval: {
        title: "Aprobación humana",
        body: recommendation.requiresHumanApproval
          ? "Este siguiente paso requiere revisión humana antes de ejecutarse o salir al paciente."
          : "No requiere gate humano estricto, pero la operación puede editarlo antes de correrlo."
      }
    },
    reviewOptions: [
      {
        id: "approve",
        label: "Approve",
        description: "Aprueba la recomendación y permite ejecutar el paquete preparado.",
        requiresNote: false
      },
      {
        id: "edit_and_run",
        label: "Edit & Run",
        description: "Permite ajustar copy o payload y luego ejecutarlo desde Ops.",
        requiresNote: false
      },
      {
        id: "reject",
        label: "Reject",
        description: "Rechaza la recomendación y deja trazabilidad explícita de por qué no aplica.",
        requiresNote: true
      },
      {
        id: "snooze",
        label: "Snooze",
        description: "Pospone el case sin perder contexto y lo devuelve luego con la misma explicación.",
        requiresNote: true
      }
    ]
  });
}
