import assert from "node:assert/strict";
import test from "node:test";
import { importOpenClawProjectedCases } from "../src/openclaw-import.js";

test("OpenClaw one-shot import dedupes patient identity and preserves active plus history", () => {
  const result = importOpenClawProjectedCases({
    importedAt: "2026-03-11T16:00:00.000Z",
    tenantConfigs: [
      {
        id: "tnt_import",
        slug: "openclaw-import",
        name: "OpenClaw Import Clinic",
        timezone: "America/Guayaquil",
        brandColor: "#0f766e",
        enabledChannels: ["whatsapp", "email"],
        credentialRefs: [],
        createdAt: "2026-03-11T16:00:00.000Z"
      }
    ],
    locations: [
      {
        id: "loc_import_main",
        tenantId: "tnt_import",
        slug: "main",
        name: "Main Import Office",
        waitingRoomName: "Main Lobby",
        createdAt: "2026-03-11T16:00:00.000Z"
      }
    ],
    projectedCases: [
      {
        id: "oc_case_closed",
        tenantId: "tnt_import",
        patient: {
          id: "oc_patient_001",
          displayName: "Ana Ruiz",
          phone: "+593 999 000 111",
          email: "ana@example.com",
          preferredChannel: "whatsapp"
        },
        status: "closed",
        openedAt: "2026-03-10T08:00:00.000Z",
        latestActivityAt: "2026-03-10T10:30:00.000Z",
        closedAt: "2026-03-10T10:30:00.000Z",
        appointments: [
          {
            id: "oc_appt_001",
            locationId: "loc_import_main",
            providerName: "Dr. Import",
            serviceLine: "General Medicine",
            status: "completed",
            scheduledStart: "2026-03-10T09:00:00.000Z",
            scheduledEnd: "2026-03-10T09:30:00.000Z",
            createdAt: "2026-03-10T08:15:00.000Z"
          }
        ],
        timeline: [
          {
            type: "visit_completed",
            title: "Imported visit completed",
            payload: { source: "openclaw" },
            createdAt: "2026-03-10T10:30:00.000Z"
          }
        ]
      },
      {
        tenantId: "tnt_import",
        patient: {
          displayName: "Ana Ruiz",
          phone: "593999000111",
          email: "ANA@example.com",
          preferredChannel: "whatsapp"
        },
        status: "qualified",
        openedAt: "2026-03-11T11:00:00.000Z",
        latestActivityAt: "2026-03-11T11:20:00.000Z",
        callbacks: [
          {
            id: "oc_callback_001",
            channel: "whatsapp",
            notes: "Patient asked for a new call back.",
            status: "qualified",
            createdAt: "2026-03-11T11:10:00.000Z"
          }
        ],
        approvals: [
          {
            id: "oc_approval_001",
            type: "payment_review",
            status: "pending",
            reason: "Need to verify transfer proof.",
            requestedBy: "openclaw_migrator",
            createdAt: "2026-03-11T11:12:00.000Z",
            updatedAt: "2026-03-11T11:12:00.000Z"
          }
        ],
        actions: [
          {
            id: "oc_action_001",
            action: "send_follow_up",
            title: "Follow up after import",
            status: "pending",
            channel: "ops",
            rationale: "The imported case still needs an operational follow-up.",
            requiresHumanApproval: false,
            source: "system",
            createdAt: "2026-03-11T11:13:00.000Z",
            updatedAt: "2026-03-11T11:13:00.000Z"
          }
        ]
      }
    ]
  });

  assert.equal(result.stats.patients, 1);
  assert.equal(result.stats.cases, 2);
  assert.equal(result.stats.callbacks, 1);
  assert.equal(result.stats.approvals, 1);
  assert.equal(result.stats.actions, 1);

  const importedPatients = result.state.patients;
  assert.equal(importedPatients[0]?.id, "oc_patient_001");

  const activeCases = result.state.patientCases.filter((patientCase) => patientCase.status !== "closed");
  assert.equal(activeCases.length, 1);
  assert.equal(activeCases[0]?.patientId, "oc_patient_001");
  assert.equal(activeCases[0]?.status, "qualified");
  assert.equal(activeCases[0]?.summary.pendingApprovalCount, 1);
  assert.equal(activeCases[0]?.summary.openActionCount, 1);

  assert.ok(
    result.state.patientCaseTimelineEvents.some((event) => event.type === "imported_from_openclaw")
  );
});
