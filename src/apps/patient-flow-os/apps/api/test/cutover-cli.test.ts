import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { newDb } from "pg-mem";
import { runCutoverCli } from "../src/cutover-cli.js";
import {
  loadBootstrapStateFromPostgres,
  replaceBootstrapStateInPostgres
} from "../src/postgres-runtime.js";
import { createBootstrapState } from "../src/state.js";

function createPgPool() {
  const db = newDb();
  const { Pool } = db.adapters.createPg();
  return new Pool();
}

function createIoCapture() {
  let stdout = "";
  let stderr = "";
  return {
    io: {
      stdout(message: string) {
        stdout += message;
      },
      stderr(message: string) {
        stderr += message;
      }
    },
    stdout: () => stdout,
    stderr: () => stderr
  };
}

async function withTempDir(run: (dir: string) => Promise<void>): Promise<void> {
  const dir = await mkdtemp(join(tmpdir(), "patient-flow-os-cutover-"));
  try {
    await run(dir);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

test("cutover inspect returns tenant and case summary as json", async () => {
  const pool = createPgPool();
  await replaceBootstrapStateInPostgres(pool, createBootstrapState());
  const capture = createIoCapture();

  try {
    const exitCode = await runCutoverCli(["inspect", "--json"], {
      pool,
      io: capture.io
    });

    assert.equal(exitCode, 0);
    const payload = JSON.parse(capture.stdout()) as {
      command: string;
      summary: {
        totals: {
          tenants: number;
          cases: number;
          preparedActionDispatchJobs: number;
        };
      };
    };
    assert.equal(payload.command, "inspect");
    assert.equal(payload.summary.totals.tenants, 2);
    assert.equal(payload.summary.totals.cases, 3);
    assert.equal(payload.summary.totals.preparedActionDispatchJobs, 0);
    assert.equal(capture.stderr(), "");
  } finally {
    await pool.end();
  }
});

test("cutover smoke returns a green report for a healthy canonical state", async () => {
  const pool = createPgPool();
  await replaceBootstrapStateInPostgres(pool, createBootstrapState());
  const capture = createIoCapture();

  try {
    const exitCode = await runCutoverCli(["smoke", "--json"], {
      pool,
      io: capture.io
    });

    assert.equal(exitCode, 0);
    const payload = JSON.parse(capture.stdout()) as {
      command: string;
      smoke: { ok: boolean; errors: unknown[]; warnings: unknown[] };
    };
    assert.equal(payload.command, "smoke");
    assert.equal(payload.smoke.ok, true);
    assert.equal(payload.smoke.errors.length, 0);
  } finally {
    await pool.end();
  }
});

test("cutover smoke fails when a tenant has duplicate active cases for the same patient", async () => {
  const pool = createPgPool();
  const invalidState = createBootstrapState();
  invalidState.patientCases.push({
    id: "case_green_duplicate_001",
    tenantId: "tnt_green",
    patientId: "pat_green_001",
    status: "qualified",
    statusSource: "manual",
    openedAt: "2026-03-11T18:00:00.000Z",
    latestActivityAt: "2026-03-11T18:05:00.000Z",
    closedAt: null,
    lastInboundAt: null,
    lastOutboundAt: null,
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
      lastChannel: "whatsapp",
      openActionCount: 0,
      pendingApprovalCount: 0
    }
  });
  await replaceBootstrapStateInPostgres(pool, invalidState);
  const capture = createIoCapture();

  try {
    const exitCode = await runCutoverCli(["smoke", "--json"], {
      pool,
      io: capture.io
    });

    assert.equal(exitCode, 1);
    const payload = JSON.parse(capture.stdout()) as {
      ok: boolean;
      command: string;
      smoke: { ok: boolean; errors: Array<{ code: string }> };
    };
    assert.equal(payload.ok, false);
    assert.equal(payload.command, "smoke");
    assert.equal(payload.smoke.ok, false);
    assert.ok(payload.smoke.errors.some((finding) => finding.code === "case.duplicate_active"));
  } finally {
    await pool.end();
  }
});

test("cutover export-state writes the canonical bootstrap snapshot to disk", async () => {
  const pool = createPgPool();
  await replaceBootstrapStateInPostgres(pool, createBootstrapState());

  try {
    await withTempDir(async (dir) => {
      const outputPath = join(dir, "bootstrap-state.json");
      const capture = createIoCapture();
      const exitCode = await runCutoverCli(["export-state", "--output", outputPath, "--json"], {
        pool,
        io: capture.io,
        cwd: dir
      });

      assert.equal(exitCode, 0);
      const payload = JSON.parse(capture.stdout()) as {
        command: string;
        outputPath: string;
      };
      assert.equal(payload.command, "export-state");
      assert.equal(payload.outputPath, outputPath);

      const exported = JSON.parse(await readFile(outputPath, "utf8")) as {
        tenantConfigs: Array<{ id: string }>;
        patientCases: Array<{ id: string }>;
      };
      assert.equal(exported.tenantConfigs.length, 2);
      assert.ok(exported.patientCases.some((patientCase) => patientCase.id === "case_green_001"));
    });
  } finally {
    await pool.end();
  }
});

test("cutover replace-state enforces the destructive guardrail before mutating postgres", async () => {
  const pool = createPgPool();

  try {
    await withTempDir(async (dir) => {
      const inputPath = join(dir, "replacement-state.json");
      await writeFile(inputPath, `${JSON.stringify(createBootstrapState(), null, 2)}\n`, "utf8");

      const denied = createIoCapture();
      const deniedExit = await runCutoverCli(["replace-state", "--input", inputPath], {
        pool,
        io: denied.io,
        cwd: dir
      });

      assert.equal(deniedExit, 1);
      assert.match(denied.stderr(), /--allow-destructive/);
      assert.equal((await loadBootstrapStateFromPostgres(pool)).tenantConfigs.length, 0);

      const allowed = createIoCapture();
      const allowedExit = await runCutoverCli(
        ["replace-state", "--input", inputPath, "--allow-destructive", "--json"],
        {
          pool,
          io: allowed.io,
          cwd: dir
        }
      );

      assert.equal(allowedExit, 0);
      const persisted = await loadBootstrapStateFromPostgres(pool);
      assert.equal(persisted.tenantConfigs.length, 2);
      assert.equal(persisted.patientCases.length, 3);
    });
  } finally {
    await pool.end();
  }
});

test("cutover import-openclaw merges projected cases into the canonical postgres state", async () => {
  const pool = createPgPool();
  await replaceBootstrapStateInPostgres(pool, createBootstrapState());

  try {
    await withTempDir(async (dir) => {
      const bundlePath = join(dir, "openclaw-bundle.json");
      await writeFile(
        bundlePath,
        `${JSON.stringify(
          {
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
                tenantId: "tnt_import",
                patient: {
                  id: "oc_patient_001",
                  displayName: "Ana Ruiz",
                  phone: "+593 999 000 111",
                  email: "ana@example.com",
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
          },
          null,
          2
        )}\n`,
        "utf8"
      );

      const capture = createIoCapture();
      const exitCode = await runCutoverCli(["import-openclaw", "--input", bundlePath, "--mode", "merge", "--json"], {
        pool,
        io: capture.io,
        cwd: dir
      });

      assert.equal(exitCode, 0);
      const payload = JSON.parse(capture.stdout()) as {
        command: string;
        mode: string;
        importStats: { cases: number; callbacks: number };
        summary: { totals: { tenants: number; cases: number } };
      };
      assert.equal(payload.command, "import-openclaw");
      assert.equal(payload.mode, "merge");
      assert.equal(payload.importStats.cases, 4);
      assert.equal(payload.importStats.callbacks, 2);
      assert.equal(payload.summary.totals.tenants, 3);

      const persisted = await loadBootstrapStateFromPostgres(pool);
      assert.ok(persisted.tenantConfigs.some((tenant) => tenant.id === "tnt_import"));
      assert.ok(
        persisted.patientCases.some(
          (patientCase) => patientCase.tenantId === "tnt_import" && patientCase.status === "qualified"
        )
      );
      assert.ok(persisted.callbacks.some((callback) => callback.id === "oc_callback_001"));
    });
  } finally {
    await pool.end();
  }
});

test("cutover-openclaw writes before and after artifacts plus a smoke-gated report", async () => {
  const pool = createPgPool();
  await replaceBootstrapStateInPostgres(pool, createBootstrapState());

  try {
    await withTempDir(async (dir) => {
      const bundlePath = join(dir, "openclaw-bundle.json");
      const artifactsDir = join(dir, "artifacts");
      await writeFile(
        bundlePath,
        `${JSON.stringify(
          {
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
                tenantId: "tnt_import",
                patient: {
                  id: "oc_patient_002",
                  displayName: "Carlos Mora",
                  phone: "+593 999 888 777",
                  email: "carlos@example.com",
                  preferredChannel: "whatsapp"
                },
                status: "awaiting_booking",
                openedAt: "2026-03-11T15:00:00.000Z",
                latestActivityAt: "2026-03-11T15:05:00.000Z",
                callbacks: [
                  {
                    id: "oc_callback_002",
                    channel: "whatsapp",
                    notes: "Imported through cutover command.",
                    status: "qualified",
                    createdAt: "2026-03-11T15:02:00.000Z"
                  }
                ]
              }
            ]
          },
          null,
          2
        )}\n`,
        "utf8"
      );

      const capture = createIoCapture();
      const exitCode = await runCutoverCli(
        [
          "cutover-openclaw",
          "--input",
          bundlePath,
          "--artifacts-dir",
          artifactsDir,
          "--mode",
          "merge",
          "--json"
        ],
        {
          pool,
          io: capture.io,
          cwd: dir
        }
      );

      assert.equal(exitCode, 0);
      const payload = JSON.parse(capture.stdout()) as {
        command: string;
        summary: { totals: { tenants: number } };
        beforeSummary: { totals: { tenants: number } };
        beforeSmoke: { ok: boolean };
        afterSmoke: { ok: boolean };
        smokeGate: { passed: boolean; newErrors: Array<unknown> };
        artifacts: {
          directory: string;
          beforeStatePath: string;
          afterStatePath: string;
          reportPath: string;
          inputBundlePath: string;
        };
      };
      assert.equal(payload.command, "cutover-openclaw");
      assert.equal(payload.beforeSummary.totals.tenants, 2);
      assert.equal(payload.summary.totals.tenants, 3);
      assert.equal(payload.beforeSmoke.ok, true);
      assert.equal(payload.afterSmoke.ok, true);
      assert.equal(payload.smokeGate.passed, true);
      assert.equal(payload.smokeGate.newErrors.length, 0);

      const beforeState = JSON.parse(await readFile(payload.artifacts.beforeStatePath, "utf8")) as {
        tenantConfigs: Array<{ id: string }>;
      };
      const afterState = JSON.parse(await readFile(payload.artifacts.afterStatePath, "utf8")) as {
        tenantConfigs: Array<{ id: string }>;
      };
      const report = JSON.parse(await readFile(payload.artifacts.reportPath, "utf8")) as {
        command: string;
        smokeGate: { passed: boolean };
      };
      const copiedBundle = JSON.parse(await readFile(payload.artifacts.inputBundlePath, "utf8")) as {
        projectedCases: Array<{ patient: { displayName: string } }>;
      };

      assert.equal(beforeState.tenantConfigs.length, 2);
      assert.equal(afterState.tenantConfigs.length, 3);
      assert.equal(report.command, "cutover-openclaw");
      assert.equal(report.smokeGate.passed, true);
      assert.equal(copiedBundle.projectedCases[0]?.patient.displayName, "Carlos Mora");
    });
  } finally {
    await pool.end();
  }
});

test("verify-report passes for a valid cutover report artifact", async () => {
  const pool = createPgPool();
  await replaceBootstrapStateInPostgres(pool, createBootstrapState());

  try {
    await withTempDir(async (dir) => {
      const bundlePath = join(dir, "openclaw-bundle.json");
      const artifactsDir = join(dir, "artifacts");
      await writeFile(
        bundlePath,
        `${JSON.stringify(
          {
            importedAt: "2026-03-11T18:00:00.000Z",
            tenantConfigs: [
              {
                id: "tnt_import_verify",
                slug: "openclaw-verify",
                name: "OpenClaw Verify Clinic",
                timezone: "America/Guayaquil",
                brandColor: "#0f766e",
                enabledChannels: ["whatsapp"],
                credentialRefs: [],
                createdAt: "2026-03-11T18:00:00.000Z"
              }
            ],
            locations: [
              {
                id: "loc_import_verify_main",
                tenantId: "tnt_import_verify",
                slug: "main",
                name: "Main Verify Office",
                waitingRoomName: "Verify Lobby",
                createdAt: "2026-03-11T18:00:00.000Z"
              }
            ],
            projectedCases: [
              {
                tenantId: "tnt_import_verify",
                patient: {
                  id: "oc_patient_verify_001",
                  displayName: "Lucia Paredes",
                  phone: "+593 999 777 111",
                  email: "lucia@example.com",
                  preferredChannel: "whatsapp"
                },
                status: "qualified",
                openedAt: "2026-03-11T18:01:00.000Z",
                latestActivityAt: "2026-03-11T18:03:00.000Z"
              }
            ]
          },
          null,
          2
        )}\n`,
        "utf8"
      );

      const cutoverCapture = createIoCapture();
      const cutoverExitCode = await runCutoverCli(
        [
          "cutover-openclaw",
          "--input",
          bundlePath,
          "--artifacts-dir",
          artifactsDir,
          "--mode",
          "merge",
          "--json"
        ],
        {
          pool,
          io: cutoverCapture.io,
          cwd: dir
        }
      );

      assert.equal(cutoverExitCode, 0);
      const cutoverPayload = JSON.parse(cutoverCapture.stdout()) as {
        artifacts: { reportPath: string };
      };

      const verifyCapture = createIoCapture();
      const verifyExitCode = await runCutoverCli(
        ["verify-report", "--input", cutoverPayload.artifacts.reportPath, "--json"],
        {
          io: verifyCapture.io,
          cwd: dir
        }
      );

      assert.equal(verifyExitCode, 0);
      const verifyPayload = JSON.parse(verifyCapture.stdout()) as {
        command: string;
        approvalContract: {
          ok: boolean;
          checks: Array<{ id: string; ok: boolean }>;
        };
      };
      assert.equal(verifyPayload.command, "verify-report");
      assert.equal(verifyPayload.approvalContract.ok, true);
      assert.ok(verifyPayload.approvalContract.checks.some((check) => check.id === "report.smoke_gate_passed"));
      assert.ok(verifyPayload.approvalContract.checks.every((check) => check.ok));
    });
  } finally {
    await pool.end();
  }
});

test("verify-report fails when the report does not satisfy the approval contract", async () => {
  const pool = createPgPool();

  try {
    await withTempDir(async (dir) => {
      const reportPath = join(dir, "invalid-report.json");
      const copiedBundlePath = join(dir, "input-openclaw-bundle.json");
      const beforeStatePath = join(dir, "before-state.json");
      await writeFile(copiedBundlePath, "{}\n", "utf8");
      await writeFile(beforeStatePath, "{}\n", "utf8");

      await writeFile(
        reportPath,
        `${JSON.stringify(
          {
            command: "cutover-openclaw",
            mode: "merge",
            summary: {
              tenants: [],
              totals: {
                tenants: 0,
                locations: 0,
                staffUsers: 0,
                patients: 0,
                cases: 0,
                activeCases: 0,
                appointments: 0,
                callbacks: 0,
                queueTickets: 0,
                threads: 0,
                actions: 0,
                approvals: 0,
                agentTasks: 0,
                preparedActions: 0,
                preparedActionDispatchJobs: 0,
                flowEvents: 0,
                auditEntries: 0,
                copilotReviewDecisions: 0
              }
            },
            beforeSummary: {
              tenants: [],
              totals: {
                tenants: 0,
                locations: 0,
                staffUsers: 0,
                patients: 0,
                cases: 0,
                activeCases: 0,
                appointments: 0,
                callbacks: 0,
                queueTickets: 0,
                threads: 0,
                actions: 0,
                approvals: 0,
                agentTasks: 0,
                preparedActions: 0,
                preparedActionDispatchJobs: 0,
                flowEvents: 0,
                auditEntries: 0,
                copilotReviewDecisions: 0
              }
            },
            beforeSmoke: {
              ok: true,
              checkedAt: "2026-03-11T18:10:00.000Z",
              counts: {
                tenants: 0,
                patients: 0,
                cases: 0,
                appointments: 0,
                callbacks: 0,
                queueTickets: 0,
                threads: 0,
                actions: 0,
                approvals: 0,
                agentTasks: 0,
                preparedActions: 0,
                preparedActionDispatchJobs: 0,
                flowEvents: 0,
                links: 0,
                reviews: 0
              },
              errors: [],
              warnings: []
            },
            afterSmoke: {
              ok: false,
              checkedAt: "2026-03-11T18:11:00.000Z",
              counts: {
                tenants: 0,
                patients: 0,
                cases: 0,
                appointments: 0,
                callbacks: 0,
                queueTickets: 0,
                threads: 0,
                actions: 0,
                approvals: 0,
                agentTasks: 0,
                preparedActions: 0,
                preparedActionDispatchJobs: 0,
                flowEvents: 0,
                links: 0,
                reviews: 0
              },
              errors: [
                {
                  severity: "error",
                  code: "case.duplicate_active",
                  message: "Duplicate active case"
                }
              ],
              warnings: []
            },
            smokeGate: {
              passed: false,
              newErrors: [
                {
                  severity: "error",
                  code: "case.duplicate_active",
                  message: "Duplicate active case"
                }
              ],
              carriedErrors: []
            },
            artifacts: {
              directory: dir,
              inputBundlePath: copiedBundlePath,
              beforeStatePath,
              afterStatePath: join(dir, "missing-after-state.json"),
              reportPath
            },
            bundleFingerprint: "fingerprint-001",
            startedAt: "2026-03-11T18:09:00.000Z",
            finishedAt: "2026-03-11T18:12:00.000Z"
          },
          null,
          2
        )}\n`,
        "utf8"
      );

      const capture = createIoCapture();
      const exitCode = await runCutoverCli(["verify-report", "--input", reportPath, "--json"], {
        pool,
        io: capture.io,
        cwd: dir
      });

      assert.equal(exitCode, 1);
      const payload = JSON.parse(capture.stdout()) as {
        ok: boolean;
        error: string;
        approvalContract: {
          ok: boolean;
          checks: Array<{ id: string; ok: boolean }>;
        };
      };
      assert.equal(payload.ok, false);
      assert.match(payload.error, /approval contract/);
      assert.equal(payload.approvalContract.ok, false);
      assert.ok(
        payload.approvalContract.checks.some(
          (check) => check.id === "report.smoke_gate_passed" && check.ok === false
        )
      );
      assert.ok(
        payload.approvalContract.checks.some(
          (check) => check.id === "artifacts.after_state_exists" && check.ok === false
        )
      );
    });
  } finally {
    await pool.end();
  }
});

test("promotion-packet writes promotion evidence without requiring DATABASE_URL", async () => {
  const pool = createPgPool();
  await replaceBootstrapStateInPostgres(pool, createBootstrapState());

  try {
    await withTempDir(async (dir) => {
      const bundlePath = join(dir, "openclaw-bundle.json");
      const cutoverArtifactsDir = join(dir, "cutover-artifacts");
      const promotionArtifactsDir = join(dir, "promotion-artifacts");
      const preflightPath = join(dir, "preflight-smoke.json");
      const approvalPath = join(dir, "approval-contract.json");
      const postSmokePath = join(dir, "post-cutover-smoke.json");
      const postInspectPath = join(dir, "post-cutover-inspect.json");
      const manifestPath = join(dir, "workflow-manifest.json");

      await writeFile(
        bundlePath,
        `${JSON.stringify(
          {
            importedAt: "2026-03-11T19:00:00.000Z",
            tenantConfigs: [
              {
                id: "tnt_promote_001",
                slug: "promote-001",
                name: "Promotion Ready Clinic",
                timezone: "America/Guayaquil",
                brandColor: "#0f766e",
                enabledChannels: ["whatsapp"],
                credentialRefs: [],
                createdAt: "2026-03-11T19:00:00.000Z"
              }
            ],
            locations: [
              {
                id: "loc_promote_main",
                tenantId: "tnt_promote_001",
                slug: "main",
                name: "Promotion Main Office",
                waitingRoomName: "Promotion Lobby",
                createdAt: "2026-03-11T19:00:00.000Z"
              }
            ],
            projectedCases: [
              {
                tenantId: "tnt_promote_001",
                patient: {
                  id: "oc_patient_promote_001",
                  displayName: "Maria Torres",
                  phone: "+593 999 444 111",
                  email: "maria@example.com",
                  preferredChannel: "whatsapp"
                },
                status: "awaiting_booking",
                openedAt: "2026-03-11T19:01:00.000Z",
                latestActivityAt: "2026-03-11T19:04:00.000Z"
              }
            ]
          },
          null,
          2
        )}\n`,
        "utf8"
      );

      const preflightCapture = createIoCapture();
      assert.equal(
        await runCutoverCli(["smoke", "--json"], {
          pool,
          io: preflightCapture.io,
          cwd: dir
        }),
        0
      );
      await writeFile(preflightPath, preflightCapture.stdout(), "utf8");

      const cutoverCapture = createIoCapture();
      assert.equal(
        await runCutoverCli(
          [
            "cutover-openclaw",
            "--input",
            bundlePath,
            "--artifacts-dir",
            cutoverArtifactsDir,
            "--mode",
            "merge",
            "--json"
          ],
          {
            pool,
            io: cutoverCapture.io,
            cwd: dir
          }
        ),
        0
      );
      const cutoverPayload = JSON.parse(cutoverCapture.stdout()) as {
        artifacts: { reportPath: string };
      };

      const approvalCapture = createIoCapture();
      assert.equal(
        await runCutoverCli(
          ["verify-report", "--input", cutoverPayload.artifacts.reportPath, "--json"],
          {
            io: approvalCapture.io,
            cwd: dir
          }
        ),
        0
      );
      await writeFile(approvalPath, approvalCapture.stdout(), "utf8");

      const postSmokeCapture = createIoCapture();
      assert.equal(
        await runCutoverCli(["smoke", "--json"], {
          pool,
          io: postSmokeCapture.io,
          cwd: dir
        }),
        0
      );
      await writeFile(postSmokePath, postSmokeCapture.stdout(), "utf8");

      const postInspectCapture = createIoCapture();
      assert.equal(
        await runCutoverCli(["inspect", "--json"], {
          pool,
          io: postInspectCapture.io,
          cwd: dir
        }),
        0
      );
      await writeFile(postInspectPath, postInspectCapture.stdout(), "utf8");

      await writeFile(
        manifestPath,
        `${JSON.stringify(
          {
            generatedAt: "2026-03-11T19:10:00.000Z",
            targetEnvironment: "staging",
            cutoverMode: "merge",
            runPostCutoverSmoke: "true",
            preflightSmokePath: preflightPath,
            cutoverResultPath: join(dir, "cutover-result.json"),
            cutoverStderrPath: join(dir, "cutover-stderr.log"),
            approvalContractPath: approvalPath,
            reportPath: cutoverPayload.artifacts.reportPath
          },
          null,
          2
        )}\n`,
        "utf8"
      );

      const capture = createIoCapture();
      const exitCode = await runCutoverCli(
        [
          "promotion-packet",
          "--input",
          manifestPath,
          "--artifacts-dir",
          promotionArtifactsDir,
          "--post-smoke",
          postSmokePath,
          "--post-inspect",
          postInspectPath,
          "--target-environment",
          "staging",
          "--label",
          "staging-cutover",
          "--json"
        ],
        {
          io: capture.io,
          cwd: dir
        }
      );

      assert.equal(exitCode, 0, capture.stderr());
      const payload = JSON.parse(capture.stdout()) as {
        command: string;
        outputPath: string;
        promotionPacket: {
          ok: boolean;
          recommendedNextEnvironment: string;
          automatedChecks: Array<{ status: string }>;
        };
      };
      assert.equal(payload.command, "promotion-packet");
      assert.equal(payload.promotionPacket.ok, true);
      assert.equal(payload.promotionPacket.recommendedNextEnvironment, "production");
      assert.ok(payload.promotionPacket.automatedChecks.every((check) => check.status === "passed"));

      const packet = JSON.parse(await readFile(join(promotionArtifactsDir, "promotion-packet.json"), "utf8")) as {
        ok: boolean;
        label: string;
        sourceEnvironment: string;
      };
      const checklist = JSON.parse(
        await readFile(join(promotionArtifactsDir, "promotion-checklist.json"), "utf8")
      ) as {
        manualChecks: Array<{ status: string }>;
      };
      assert.equal(packet.ok, true);
      assert.equal(packet.label, "staging-cutover");
      assert.equal(packet.sourceEnvironment, "staging");
      assert.ok(checklist.manualChecks.every((check) => check.status === "pending"));
    });
  } finally {
    await pool.end();
  }
});

test("promotion-packet fails when automated promotion evidence is incomplete", async () => {
  await withTempDir(async (dir) => {
    const reportPath = join(dir, "report.json");
    const manifestPath = join(dir, "workflow-manifest.json");
    const outputDir = join(dir, "promotion-artifacts");

    await writeFile(
      reportPath,
      `${JSON.stringify(
        {
          command: "cutover-openclaw",
          mode: "merge",
          summary: {
            tenants: [],
            totals: {
              tenants: 0,
              locations: 0,
              staffUsers: 0,
              patients: 0,
              cases: 0,
              activeCases: 0,
              appointments: 0,
              callbacks: 0,
              queueTickets: 0,
              threads: 0,
              actions: 0,
              approvals: 0,
              agentTasks: 0,
              preparedActions: 0,
              preparedActionDispatchJobs: 0,
              flowEvents: 0,
              auditEntries: 0,
              copilotReviewDecisions: 0
            }
          },
          smokeGate: {
            passed: false,
            newErrors: [{ code: "case.duplicate_active" }],
            carriedErrors: []
          }
        },
        null,
        2
      )}\n`,
      "utf8"
    );

    await writeFile(
      manifestPath,
      `${JSON.stringify(
        {
          generatedAt: "2026-03-11T19:20:00.000Z",
          targetEnvironment: "staging",
          cutoverMode: "merge",
          runPostCutoverSmoke: "true",
          preflightSmokePath: join(dir, "missing-preflight.json"),
          cutoverResultPath: join(dir, "missing-cutover-result.json"),
          cutoverStderrPath: join(dir, "missing-cutover-stderr.log"),
          approvalContractPath: join(dir, "missing-approval.json"),
          reportPath
        },
        null,
        2
      )}\n`,
      "utf8"
    );

    const capture = createIoCapture();
    const exitCode = await runCutoverCli(
      [
        "promotion-packet",
        "--input",
        manifestPath,
        "--artifacts-dir",
        outputDir,
        "--target-environment",
        "staging",
        "--json"
      ],
      {
        io: capture.io,
        cwd: dir
      }
    );

    assert.equal(exitCode, 1);
    const payload = JSON.parse(capture.stdout()) as {
      error: string;
      promotionPacket: {
        ok: boolean;
        automatedChecks: Array<{ id: string; status: string }>;
      };
    };
    assert.match(payload.error, /promotion packet/);
    assert.equal(payload.promotionPacket.ok, false);
    assert.ok(
      payload.promotionPacket.automatedChecks.some(
        (check) => check.id === "approval_contract" && check.status === "failed"
      )
    );
  });
});

test("verify-promotion-packet passes for a staging packet ready to promote into production", async () => {
  await withTempDir(async (dir) => {
    const packetPath = join(dir, "promotion-packet.json");
    await writeFile(
      packetPath,
      `${JSON.stringify(
        {
          ok: true,
          generatedAt: "2026-03-11T20:00:00.000Z",
          label: "staging-cutover",
          sourceEnvironment: "staging",
          recommendedNextEnvironment: "production",
          cutoverMode: "merge",
          approvalContract: "preflight_smoke + cutover_openclaw + verify_report + post_cutover_smoke",
          summary: {
            preflightSmokeOk: true,
            cutoverSmokeGatePassed: true,
            approvalContractPassed: true,
            postCutoverSmokeOk: true,
            beforeTotals: null,
            afterTotals: {
              tenants: 3,
              locations: 3,
              staffUsers: 2,
              patients: 4,
              cases: 4,
              activeCases: 4,
              appointments: 2,
              callbacks: 2,
              queueTickets: 1,
              threads: 2,
              actions: 3,
              approvals: 1,
              agentTasks: 2,
              preparedActions: 1,
              preparedActionDispatchJobs: 0,
              flowEvents: 7,
              auditEntries: 6,
              copilotReviewDecisions: 1
            },
            postCutoverTotals: {
              tenants: 3,
              locations: 3,
              staffUsers: 2,
              patients: 4,
              cases: 4,
              activeCases: 4,
              appointments: 2,
              callbacks: 2,
              queueTickets: 1,
              threads: 2,
              actions: 3,
              approvals: 1,
              agentTasks: 2,
              preparedActions: 1,
              preparedActionDispatchJobs: 0,
              flowEvents: 7,
              auditEntries: 6,
              copilotReviewDecisions: 1
            }
          },
          evidence: {
            workflowManifestPath: "workflow-manifest.json",
            preflightSmokePath: "preflight-smoke.json",
            cutoverResultPath: "cutover-result.json",
            reportPath: "report.json",
            approvalContractPath: "approval-contract.json",
            postCutoverSmokePath: "post-cutover-smoke.json",
            postCutoverInspectPath: "post-cutover-inspect.json"
          },
          automatedChecks: [
            {
              id: "preflight_smoke",
              title: "Preflight smoke was green before the cutover",
              status: "passed",
              message: "Canonical state started clean before import."
            },
            {
              id: "cutover_smoke_gate",
              title: "Cutover report did not introduce new canonical errors",
              status: "passed",
              message: "Smoke gate passed without new errors."
            },
            {
              id: "approval_contract",
              title: "Approval contract validated the report and artifact set",
              status: "passed",
              message: "Approval contract passed."
            },
            {
              id: "post_cutover_smoke",
              title: "Post-cutover smoke stayed green on the external database",
              status: "passed",
              message: "Post-cutover smoke passed."
            }
          ],
          manualChecks: []
        },
        null,
        2
      )}\n`,
      "utf8"
    );

    const capture = createIoCapture();
    const exitCode = await runCutoverCli(
      [
        "verify-promotion-packet",
        "--input",
        packetPath,
        "--source-environment",
        "staging",
        "--target-environment",
        "production",
        "--json"
      ],
      {
        io: capture.io,
        cwd: dir
      }
    );

    assert.equal(exitCode, 0);
    const payload = JSON.parse(capture.stdout()) as {
      command: string;
      promotionVerification: {
        ok: boolean;
        targetEnvironment: string;
        checks: Array<{ id: string; ok: boolean }>;
      };
    };
    assert.equal(payload.command, "verify-promotion-packet");
    assert.equal(payload.promotionVerification.ok, true);
    assert.equal(payload.promotionVerification.targetEnvironment, "production");
    assert.ok(payload.promotionVerification.checks.every((check) => check.ok));
  });
});

test("verify-promotion-packet fails when the packet is not ready for the requested target environment", async () => {
  await withTempDir(async (dir) => {
    const packetPath = join(dir, "promotion-packet.json");
    await writeFile(
      packetPath,
      `${JSON.stringify(
        {
          ok: false,
          generatedAt: "2026-03-11T20:10:00.000Z",
          label: "staging-cutover",
          sourceEnvironment: "staging",
          recommendedNextEnvironment: "production",
          cutoverMode: "merge",
          approvalContract: "preflight_smoke + cutover_openclaw + verify_report + post_cutover_smoke",
          summary: {
            preflightSmokeOk: true,
            cutoverSmokeGatePassed: false,
            approvalContractPassed: false,
            postCutoverSmokeOk: false,
            beforeTotals: null,
            afterTotals: null,
            postCutoverTotals: null
          },
          evidence: {
            workflowManifestPath: "workflow-manifest.json",
            preflightSmokePath: "preflight-smoke.json",
            cutoverResultPath: "cutover-result.json",
            reportPath: "report.json",
            approvalContractPath: "approval-contract.json",
            postCutoverSmokePath: "post-cutover-smoke.json",
            postCutoverInspectPath: "post-cutover-inspect.json"
          },
          automatedChecks: [
            {
              id: "cutover_smoke_gate",
              title: "Cutover report did not introduce new canonical errors",
              status: "failed",
              message: "Smoke gate failed."
            }
          ],
          manualChecks: []
        },
        null,
        2
      )}\n`,
      "utf8"
    );

    const capture = createIoCapture();
    const exitCode = await runCutoverCli(
      [
        "verify-promotion-packet",
        "--input",
        packetPath,
        "--source-environment",
        "staging",
        "--target-environment",
        "production",
        "--json"
      ],
      {
        io: capture.io,
        cwd: dir
      }
    );

    assert.equal(exitCode, 1);
    const payload = JSON.parse(capture.stdout()) as {
      error: string;
      promotionVerification: {
        ok: boolean;
        checks: Array<{ id: string; ok: boolean }>;
      };
    };
    assert.match(payload.error, /promotion packet failed verification/);
    assert.equal(payload.promotionVerification.ok, false);
    assert.ok(
      payload.promotionVerification.checks.some(
        (check) => check.id === "packet.ok" && check.ok === false
      )
    );
    assert.ok(
      payload.promotionVerification.checks.some(
        (check) => check.id === "packet.automated_checks_passed" && check.ok === false
      )
    );
  });
});

test("rollback-packet writes rollback evidence from a verified cutover report", async () => {
  const pool = createPgPool();
  await replaceBootstrapStateInPostgres(pool, createBootstrapState());

  try {
    await withTempDir(async (dir) => {
      const bundlePath = join(dir, "openclaw-bundle.json");
      const cutoverArtifactsDir = join(dir, "cutover-artifacts");
      const rollbackArtifactsDir = join(dir, "rollback-artifacts");
      const approvalPath = join(dir, "approval-contract.json");
      const manifestPath = join(dir, "workflow-manifest.json");

      await writeFile(
        bundlePath,
        `${JSON.stringify(
          {
            importedAt: "2026-03-11T22:00:00.000Z",
            tenantConfigs: [
              {
                id: "tnt_rollback_001",
                slug: "rollback-001",
                name: "Rollback Ready Clinic",
                timezone: "America/Guayaquil",
                brandColor: "#1d4ed8",
                enabledChannels: ["whatsapp"],
                credentialRefs: [],
                createdAt: "2026-03-11T22:00:00.000Z"
              }
            ],
            locations: [
              {
                id: "loc_rollback_main",
                tenantId: "tnt_rollback_001",
                slug: "main",
                name: "Rollback Main Office",
                waitingRoomName: "Rollback Lobby",
                createdAt: "2026-03-11T22:00:00.000Z"
              }
            ],
            projectedCases: [
              {
                tenantId: "tnt_rollback_001",
                patient: {
                  id: "oc_patient_rollback_001",
                  displayName: "Paola Vega",
                  phone: "+593 999 111 777",
                  email: "paola@example.com",
                  preferredChannel: "whatsapp"
                },
                status: "qualified",
                openedAt: "2026-03-11T22:01:00.000Z",
                latestActivityAt: "2026-03-11T22:03:00.000Z"
              }
            ]
          },
          null,
          2
        )}\n`,
        "utf8"
      );

      const cutoverCapture = createIoCapture();
      assert.equal(
        await runCutoverCli(
          [
            "cutover-openclaw",
            "--input",
            bundlePath,
            "--artifacts-dir",
            cutoverArtifactsDir,
            "--mode",
            "merge",
            "--json"
          ],
          {
            pool,
            io: cutoverCapture.io,
            cwd: dir
          }
        ),
        0
      );
      const cutoverPayload = JSON.parse(cutoverCapture.stdout()) as {
        artifacts: { reportPath: string };
      };

      const approvalCapture = createIoCapture();
      assert.equal(
        await runCutoverCli(
          ["verify-report", "--input", cutoverPayload.artifacts.reportPath, "--json"],
          {
            io: approvalCapture.io,
            cwd: dir
          }
        ),
        0
      );
      await writeFile(approvalPath, approvalCapture.stdout(), "utf8");

      await writeFile(
        manifestPath,
        `${JSON.stringify(
          {
            generatedAt: "2026-03-11T22:10:00.000Z",
            targetEnvironment: "production",
            cutoverMode: "merge",
            runPostCutoverSmoke: "true",
            preflightSmokePath: join(dir, "preflight-smoke.json"),
            cutoverResultPath: join(dir, "cutover-result.json"),
            cutoverStderrPath: join(dir, "cutover-stderr.log"),
            approvalContractPath: approvalPath,
            reportPath: cutoverPayload.artifacts.reportPath
          },
          null,
          2
        )}\n`,
        "utf8"
      );

      const capture = createIoCapture();
      const exitCode = await runCutoverCli(
        [
          "rollback-packet",
          "--input",
          manifestPath,
          "--artifacts-dir",
          rollbackArtifactsDir,
          "--source-environment",
          "production",
          "--label",
          "patient-flow-os-production-rollback",
          "--json"
        ],
        {
          io: capture.io,
          cwd: dir
        }
      );

      assert.equal(exitCode, 0);
      const payload = JSON.parse(capture.stdout()) as {
        command: string;
        outputPath: string;
        rollbackPacket: {
          ok: boolean;
          sourceEnvironment: string;
          rollbackCommand: string;
          summary: {
            sourceApprovalContractPassed: boolean;
            sourceSmokeGatePassed: boolean;
            sourceAfterSmokeOk: boolean;
          };
        };
      };
      assert.equal(payload.command, "rollback-packet");
      assert.equal(payload.rollbackPacket.ok, true);
      assert.equal(payload.rollbackPacket.sourceEnvironment, "production");
      assert.match(payload.rollbackPacket.rollbackCommand, /replace-state/);
      assert.equal(payload.rollbackPacket.summary.sourceApprovalContractPassed, true);
      assert.equal(payload.rollbackPacket.summary.sourceSmokeGatePassed, true);
      assert.equal(payload.rollbackPacket.summary.sourceAfterSmokeOk, true);

      const packet = JSON.parse(await readFile(join(rollbackArtifactsDir, "rollback-packet.json"), "utf8")) as {
        evidence: { beforeStatePath: string | null };
      };
      assert.ok(packet.evidence.beforeStatePath);
      assert.ok((await readFile(join(rollbackArtifactsDir, "rollback-checklist.json"), "utf8")).includes("confirm_destructive_restore"));
      assert.equal(payload.outputPath, join(rollbackArtifactsDir, "rollback-packet.json"));
    });
  } finally {
    await pool.end();
  }
});

test("verify-rollback-packet passes for a production rollback packet ready to restore", async () => {
  const pool = createPgPool();
  await replaceBootstrapStateInPostgres(pool, createBootstrapState());

  try {
    await withTempDir(async (dir) => {
      const statePath = join(dir, "before-state.json");
      const reportPath = join(dir, "report.json");
      await writeFile(statePath, `${JSON.stringify(createBootstrapState(), null, 2)}\n`, "utf8");
      await writeFile(reportPath, `{}\n`, "utf8");

      const packetPath = join(dir, "rollback-packet.json");
      await writeFile(
        packetPath,
        `${JSON.stringify(
          {
            ok: true,
            generatedAt: "2026-03-11T22:20:00.000Z",
            label: "patient-flow-os-production-rollback",
            sourceEnvironment: "production",
            rollbackCommand: `npm run cutover -- replace-state --input "${statePath}" --allow-destructive --json`,
            summary: {
              sourceApprovalContractPassed: true,
              sourceSmokeGatePassed: true,
              sourceAfterSmokeOk: true,
              beforeTotals: null,
              afterTotals: null
            },
            evidence: {
              workflowManifestPath: join(dir, "workflow-manifest.json"),
              reportPath,
              approvalContractPath: join(dir, "approval-contract.json"),
              beforeStatePath: statePath,
              afterStatePath: join(dir, "after-state.json")
            },
            automatedChecks: [
              {
                id: "before_state_exists",
                title: "Rollback before-state artifact exists",
                status: "passed",
                message: "before-state.json exists.",
                evidencePath: statePath
              }
            ],
            manualChecks: []
          },
          null,
          2
        )}\n`,
        "utf8"
      );

      const capture = createIoCapture();
      const exitCode = await runCutoverCli(
        [
          "verify-rollback-packet",
          "--input",
          packetPath,
          "--source-environment",
          "production",
          "--json"
        ],
        {
          io: capture.io,
          cwd: dir
        }
      );

      assert.equal(exitCode, 0);
      const payload = JSON.parse(capture.stdout()) as {
        command: string;
        rollbackVerification: { ok: boolean; checks: Array<{ id: string; ok: boolean }> };
      };
      assert.equal(payload.command, "verify-rollback-packet");
      assert.equal(payload.rollbackVerification.ok, true);
      assert.ok(
        payload.rollbackVerification.checks.some(
          (check) => check.id === "packet.evidence.before_state_exists" && check.ok === true
        )
      );
    });
  } finally {
    await pool.end();
  }
});

test("verify-rollback-packet fails when rollback evidence is incomplete", async () => {
  await withTempDir(async (dir) => {
    const packetPath = join(dir, "rollback-packet.json");
    await writeFile(
      packetPath,
      `${JSON.stringify(
        {
          ok: false,
          generatedAt: "2026-03-11T22:25:00.000Z",
          label: "broken-rollback",
          sourceEnvironment: "production",
          rollbackCommand: 'npm run cutover -- replace-state --input "<missing>" --allow-destructive --json',
          summary: {
            sourceApprovalContractPassed: false,
            sourceSmokeGatePassed: false,
            sourceAfterSmokeOk: false,
            beforeTotals: null,
            afterTotals: null
          },
          evidence: {
            workflowManifestPath: "workflow-manifest.json",
            reportPath: join(dir, "missing-report.json"),
            approvalContractPath: join(dir, "missing-approval.json"),
            beforeStatePath: join(dir, "missing-before-state.json"),
            afterStatePath: join(dir, "missing-after-state.json")
          },
          automatedChecks: [
            {
              id: "before_state_exists",
              title: "Rollback before-state artifact exists",
              status: "failed",
              message: "before-state.json is missing."
            }
          ],
          manualChecks: []
        },
        null,
        2
      )}\n`,
      "utf8"
    );

    const capture = createIoCapture();
    const exitCode = await runCutoverCli(
      [
        "verify-rollback-packet",
        "--input",
        packetPath,
        "--source-environment",
        "production",
        "--json"
      ],
      {
        io: capture.io,
        cwd: dir
      }
    );

    assert.equal(exitCode, 1);
    const payload = JSON.parse(capture.stdout()) as {
      error: string;
      rollbackVerification: {
        ok: boolean;
        checks: Array<{ id: string; ok: boolean }>;
      };
    };
    assert.match(payload.error, /rollback packet failed verification/);
    assert.equal(payload.rollbackVerification.ok, false);
    assert.ok(
      payload.rollbackVerification.checks.some((check) => check.id === "packet.ok" && check.ok === false)
    );
    assert.ok(
      payload.rollbackVerification.checks.some(
        (check) => check.id === "packet.evidence.before_state_exists" && check.ok === false
      )
    );
  });
});

test("backup-drill-packet writes backup drill evidence without requiring DATABASE_URL", async () => {
  const pool = createPgPool();
  await replaceBootstrapStateInPostgres(pool, createBootstrapState());

  try {
    await withTempDir(async (dir) => {
      const sourceSmokePath = join(dir, "source-smoke.json");
      const sourceInspectPath = join(dir, "source-inspect.json");
      const restoreSmokePath = join(dir, "restore-smoke.json");
      const restoreInspectPath = join(dir, "restore-inspect.json");
      const manifestPath = join(dir, "backup-drill-manifest.json");
      const dumpPath = join(dir, "patient-flow-os.dump");
      const dumpShaPath = join(dir, "patient-flow-os.dump.sha256");
      const encryptedDumpPath = join(dir, "patient-flow-os.dump.gpg");
      const encryptedDumpShaPath = join(dir, "patient-flow-os.dump.gpg.sha256");
      const outputDir = join(dir, "backup-drill-artifacts");

      await writeFile(dumpPath, "backup drill bytes", "utf8");
      await writeFile(dumpShaPath, `${"a".repeat(64)}  patient-flow-os.dump\n`, "utf8");
      await writeFile(encryptedDumpPath, "encrypted backup drill bytes", "utf8");
      await writeFile(encryptedDumpShaPath, `${"b".repeat(64)}  patient-flow-os.dump.gpg\n`, "utf8");

      const sourceSmokeCapture = createIoCapture();
      assert.equal(
        await runCutoverCli(["smoke", "--json"], {
          pool,
          io: sourceSmokeCapture.io,
          cwd: dir
        }),
        0
      );
      await writeFile(sourceSmokePath, sourceSmokeCapture.stdout(), "utf8");

      const sourceInspectCapture = createIoCapture();
      assert.equal(
        await runCutoverCli(["inspect", "--json"], {
          pool,
          io: sourceInspectCapture.io,
          cwd: dir
        }),
        0
      );
      await writeFile(sourceInspectPath, sourceInspectCapture.stdout(), "utf8");

      await writeFile(restoreSmokePath, sourceSmokeCapture.stdout(), "utf8");
      await writeFile(restoreInspectPath, sourceInspectCapture.stdout(), "utf8");

      await writeFile(
        manifestPath,
        `${JSON.stringify(
          {
            generatedAt: "2026-03-11T23:00:00.000Z",
            sourceEnvironment: "production",
            restoreTarget: "drill",
            backupMode: "logical_pg_dump",
            archiveDestination: "github_artifact_encrypted",
            dumpPath,
            dumpSha256Path: dumpShaPath,
            encryptedDumpPath,
            encryptedDumpSha256Path: encryptedDumpShaPath,
            encryptionMode: "gpg_symmetric",
            encryptionKeyRef: "github_secret:PATIENT_FLOW_OS_BACKUP_ENCRYPTION_PASSPHRASE",
            encryptedDumpBytes: 4096,
            retentionDays: 30,
            expiresAt: "2026-04-10T23:02:00.000Z",
            sourceSmokePath,
            sourceInspectPath,
            restoreSmokePath,
            restoreInspectPath,
            backupStartedAt: "2026-03-11T23:00:00.000Z",
            backupFinishedAt: "2026-03-11T23:02:00.000Z",
            restoreStartedAt: "2026-03-11T23:04:00.000Z",
            restoreFinishedAt: "2026-03-11T23:10:00.000Z"
          },
          null,
          2
        )}\n`,
        "utf8"
      );

      const capture = createIoCapture();
      const exitCode = await runCutoverCli(
        [
          "backup-drill-packet",
          "--input",
          manifestPath,
          "--artifacts-dir",
          outputDir,
          "--source-environment",
          "production",
          "--max-rto-seconds",
          "900",
          "--max-rpo-seconds",
          "600",
          "--label",
          "patient-flow-os-production-backup-drill",
          "--json"
        ],
        {
          io: capture.io,
          cwd: dir
        }
      );

      assert.equal(exitCode, 0);
      const payload = JSON.parse(capture.stdout()) as {
        command: string;
        outputPath: string;
        backupDrillPacket: {
          ok: boolean;
          sourceEnvironment: string;
          backupMode: string;
          restoreTarget: string;
          archiveDestination: string;
          summary: {
            measuredRtoSeconds: number;
            estimatedRpoSeconds: number;
            maxRtoSeconds: number;
            maxRpoSeconds: number;
            dumpBytes: number;
            encryptedDumpReady: boolean;
            encryptedDumpBytes: number;
            retentionDays: number;
            expiresAt: string;
          };
          evidence: {
            dumpSha256: string | null;
            encryptedDumpSha256: string | null;
            encryptionMode: string;
            encryptionKeyRef: string;
          };
        };
      };
      assert.equal(payload.command, "backup-drill-packet");
      assert.equal(payload.backupDrillPacket.ok, true);
      assert.equal(payload.backupDrillPacket.sourceEnvironment, "production");
      assert.equal(payload.backupDrillPacket.backupMode, "logical_pg_dump");
      assert.equal(payload.backupDrillPacket.restoreTarget, "drill");
      assert.equal(payload.backupDrillPacket.archiveDestination, "github_artifact_encrypted");
      assert.equal(payload.backupDrillPacket.summary.measuredRtoSeconds, 360);
      assert.equal(payload.backupDrillPacket.summary.estimatedRpoSeconds, 120);
      assert.equal(payload.backupDrillPacket.summary.maxRtoSeconds, 900);
      assert.equal(payload.backupDrillPacket.summary.maxRpoSeconds, 600);
      assert.ok(payload.backupDrillPacket.summary.dumpBytes > 0);
      assert.equal(payload.backupDrillPacket.summary.encryptedDumpReady, true);
      assert.ok(payload.backupDrillPacket.summary.encryptedDumpBytes > 0);
      assert.equal(payload.backupDrillPacket.summary.retentionDays, 30);
      assert.equal(payload.backupDrillPacket.summary.expiresAt, "2026-04-10T23:02:00.000Z");
      assert.equal(payload.backupDrillPacket.evidence.dumpSha256, "a".repeat(64));
      assert.equal(payload.backupDrillPacket.evidence.encryptedDumpSha256, "b".repeat(64));
      assert.equal(payload.backupDrillPacket.evidence.encryptionMode, "gpg_symmetric");
      assert.equal(
        payload.backupDrillPacket.evidence.encryptionKeyRef,
        "github_secret:PATIENT_FLOW_OS_BACKUP_ENCRYPTION_PASSPHRASE"
      );
      assert.equal(payload.outputPath, join(outputDir, "backup-drill-packet.json"));
      assert.ok((await readFile(join(outputDir, "backup-drill-checklist.json"), "utf8")).includes("review_backup_retention"));
    });
  } finally {
    await pool.end();
  }
});

test("verify-backup-drill passes for a production packet within RTO and RPO budgets", async () => {
  await withTempDir(async (dir) => {
    const packetPath = join(dir, "backup-drill-packet.json");
    const manifestPath = join(dir, "backup-drill-manifest.json");
    const dumpShaPath = join(dir, "patient-flow-os.dump.sha256");
    const encryptedDumpPath = join(dir, "patient-flow-os.dump.gpg");
    const encryptedDumpShaPath = join(dir, "patient-flow-os.dump.gpg.sha256");

    await writeFile(manifestPath, "{}\n", "utf8");
    await writeFile(dumpShaPath, `${"b".repeat(64)}  patient-flow-os.dump\n`, "utf8");
    await writeFile(encryptedDumpPath, "encrypted backup bytes", "utf8");
    await writeFile(encryptedDumpShaPath, `${"c".repeat(64)}  patient-flow-os.dump.gpg\n`, "utf8");

    await writeFile(
      packetPath,
      `${JSON.stringify(
        {
          ok: true,
          generatedAt: "2026-03-11T23:15:00.000Z",
          label: "patient-flow-os-production-backup-drill",
          sourceEnvironment: "production",
          backupMode: "logical_pg_dump",
          restoreTarget: "drill",
          archiveDestination: "github_artifact_encrypted",
          summary: {
            sourceSmokeOk: true,
            restoreSmokeOk: true,
            totalsMatch: true,
            measuredRtoSeconds: 240,
            estimatedRpoSeconds: 120,
            maxRtoSeconds: 900,
            maxRpoSeconds: 600,
            dumpBytes: 2048,
            encryptedDumpReady: true,
            encryptedDumpBytes: 1024,
            retentionDays: 30,
            expiresAt: "2026-04-10T23:15:00.000Z",
            sourceTotals: null,
            restoredTotals: null
          },
          evidence: {
            backupManifestPath: manifestPath,
            dumpPath: "patient-flow-os.dump",
            dumpSha256Path: dumpShaPath,
            dumpSha256: "b".repeat(64),
            encryptedDumpPath,
            encryptedDumpSha256Path: encryptedDumpShaPath,
            encryptedDumpSha256: "c".repeat(64),
            encryptionMode: "gpg_symmetric",
            encryptionKeyRef: "github_secret:PATIENT_FLOW_OS_BACKUP_ENCRYPTION_PASSPHRASE",
            sourceSmokePath: "source-smoke.json",
            sourceInspectPath: "source-inspect.json",
            restoreSmokePath: "restore-smoke.json",
            restoreInspectPath: "restore-inspect.json"
          },
          automatedChecks: [
            {
              id: "dump_present",
              title: "pg_dump backup artifact existed during the drill",
              status: "passed",
              message: "Logical backup was created with non-zero size."
            }
          ],
          manualChecks: []
        },
        null,
        2
      )}\n`,
      "utf8"
    );

    const capture = createIoCapture();
    const exitCode = await runCutoverCli(
      [
        "verify-backup-drill",
        "--input",
        packetPath,
        "--source-environment",
        "production",
        "--max-rto-seconds",
        "300",
        "--max-rpo-seconds",
        "300",
        "--json"
      ],
      {
        io: capture.io,
        cwd: dir
      }
    );

    assert.equal(exitCode, 0);
    const payload = JSON.parse(capture.stdout()) as {
      command: string;
      backupDrillVerification: { ok: boolean; checks: Array<{ id: string; ok: boolean }> };
    };
    assert.equal(payload.command, "verify-backup-drill");
    assert.equal(payload.backupDrillVerification.ok, true);
    assert.ok(payload.backupDrillVerification.checks.every((check) => check.ok));
  });
});

test("verify-backup-drill fails when RTO exceeds the configured budget", async () => {
  await withTempDir(async (dir) => {
    const packetPath = join(dir, "backup-drill-packet.json");
    const manifestPath = join(dir, "backup-drill-manifest.json");
    const dumpShaPath = join(dir, "patient-flow-os.dump.sha256");
    const encryptedDumpPath = join(dir, "patient-flow-os.dump.gpg");
    const encryptedDumpShaPath = join(dir, "patient-flow-os.dump.gpg.sha256");

    await writeFile(manifestPath, "{}\n", "utf8");
    await writeFile(dumpShaPath, `${"c".repeat(64)}  patient-flow-os.dump\n`, "utf8");
    await writeFile(encryptedDumpPath, "encrypted backup bytes", "utf8");
    await writeFile(encryptedDumpShaPath, `${"d".repeat(64)}  patient-flow-os.dump.gpg\n`, "utf8");

    await writeFile(
      packetPath,
      `${JSON.stringify(
        {
          ok: true,
          generatedAt: "2026-03-11T23:20:00.000Z",
          label: "patient-flow-os-production-backup-drill",
          sourceEnvironment: "production",
          backupMode: "logical_pg_dump",
          restoreTarget: "drill",
          archiveDestination: "github_artifact_encrypted",
          summary: {
            sourceSmokeOk: true,
            restoreSmokeOk: true,
            totalsMatch: true,
            measuredRtoSeconds: 1800,
            estimatedRpoSeconds: 60,
            maxRtoSeconds: 900,
            maxRpoSeconds: 600,
            dumpBytes: 1024,
            encryptedDumpReady: true,
            encryptedDumpBytes: 512,
            retentionDays: 30,
            expiresAt: "2026-04-10T23:20:00.000Z",
            sourceTotals: null,
            restoredTotals: null
          },
          evidence: {
            backupManifestPath: manifestPath,
            dumpPath: "patient-flow-os.dump",
            dumpSha256Path: dumpShaPath,
            dumpSha256: "c".repeat(64),
            encryptedDumpPath,
            encryptedDumpSha256Path: encryptedDumpShaPath,
            encryptedDumpSha256: "d".repeat(64),
            encryptionMode: "gpg_symmetric",
            encryptionKeyRef: "github_secret:PATIENT_FLOW_OS_BACKUP_ENCRYPTION_PASSPHRASE",
            sourceSmokePath: "source-smoke.json",
            sourceInspectPath: "source-inspect.json",
            restoreSmokePath: "restore-smoke.json",
            restoreInspectPath: "restore-inspect.json"
          },
          automatedChecks: [
            {
              id: "dump_present",
              title: "pg_dump backup artifact existed during the drill",
              status: "passed",
              message: "Logical backup was created with non-zero size."
            }
          ],
          manualChecks: []
        },
        null,
        2
      )}\n`,
      "utf8"
    );

    const capture = createIoCapture();
    const exitCode = await runCutoverCli(
      [
        "verify-backup-drill",
        "--input",
        packetPath,
        "--source-environment",
        "production",
        "--max-rto-seconds",
        "300",
        "--max-rpo-seconds",
        "300",
        "--json"
      ],
      {
        io: capture.io,
        cwd: dir
      }
    );

    assert.equal(exitCode, 1);
    const payload = JSON.parse(capture.stdout()) as {
      error: string;
      backupDrillVerification: {
        ok: boolean;
        checks: Array<{ id: string; ok: boolean }>;
      };
    };
    assert.match(payload.error, /backup drill packet failed verification/);
    assert.equal(payload.backupDrillVerification.ok, false);
    assert.ok(
      payload.backupDrillVerification.checks.some(
        (check) => check.id === "packet.summary.rto_within_budget" && check.ok === false
      )
    );
  });
});

test("verify-backup-drill fails when the encrypted dump artifact is missing", async () => {
  await withTempDir(async (dir) => {
    const packetPath = join(dir, "backup-drill-packet.json");
    const manifestPath = join(dir, "backup-drill-manifest.json");
    const dumpShaPath = join(dir, "patient-flow-os.dump.sha256");
    const encryptedDumpPath = join(dir, "patient-flow-os.dump.gpg");
    const encryptedDumpShaPath = join(dir, "patient-flow-os.dump.gpg.sha256");

    await writeFile(manifestPath, "{}\n", "utf8");
    await writeFile(dumpShaPath, `${"d".repeat(64)}  patient-flow-os.dump\n`, "utf8");
    await writeFile(encryptedDumpShaPath, `${"e".repeat(64)}  patient-flow-os.dump.gpg\n`, "utf8");

    await writeFile(
      packetPath,
      `${JSON.stringify(
        {
          ok: true,
          generatedAt: "2026-03-11T23:25:00.000Z",
          label: "patient-flow-os-production-backup-drill",
          sourceEnvironment: "production",
          backupMode: "logical_pg_dump",
          restoreTarget: "drill",
          archiveDestination: "github_artifact_encrypted",
          summary: {
            sourceSmokeOk: true,
            restoreSmokeOk: true,
            totalsMatch: true,
            measuredRtoSeconds: 120,
            estimatedRpoSeconds: 60,
            maxRtoSeconds: 900,
            maxRpoSeconds: 600,
            dumpBytes: 1024,
            encryptedDumpReady: true,
            encryptedDumpBytes: 512,
            retentionDays: 30,
            expiresAt: "2026-04-10T23:25:00.000Z",
            sourceTotals: null,
            restoredTotals: null
          },
          evidence: {
            backupManifestPath: manifestPath,
            dumpPath: "patient-flow-os.dump",
            dumpSha256Path: dumpShaPath,
            dumpSha256: "d".repeat(64),
            encryptedDumpPath,
            encryptedDumpSha256Path: encryptedDumpShaPath,
            encryptedDumpSha256: "e".repeat(64),
            encryptionMode: "gpg_symmetric",
            encryptionKeyRef: "github_secret:PATIENT_FLOW_OS_BACKUP_ENCRYPTION_PASSPHRASE",
            sourceSmokePath: "source-smoke.json",
            sourceInspectPath: "source-inspect.json",
            restoreSmokePath: "restore-smoke.json",
            restoreInspectPath: "restore-inspect.json"
          },
          automatedChecks: [
            {
              id: "encrypted_dump_present",
              title: "Encrypted backup artifact was produced for escrow",
              status: "passed",
              message: "Encrypted backup artifact was created with non-zero size."
            }
          ],
          manualChecks: []
        },
        null,
        2
      )}\n`,
      "utf8"
    );

    const capture = createIoCapture();
    const exitCode = await runCutoverCli(
      [
        "verify-backup-drill",
        "--input",
        packetPath,
        "--source-environment",
        "production",
        "--max-rto-seconds",
        "300",
        "--max-rpo-seconds",
        "300",
        "--json"
      ],
      {
        io: capture.io,
        cwd: dir
      }
    );

    assert.equal(exitCode, 1);
    const payload = JSON.parse(capture.stdout()) as {
      error: string;
      backupDrillVerification: {
        ok: boolean;
        checks: Array<{ id: string; ok: boolean }>;
      };
    };
    assert.match(payload.error, /backup drill packet failed verification/);
    assert.equal(payload.backupDrillVerification.ok, false);
    assert.ok(
      payload.backupDrillVerification.checks.some(
        (check) => check.id === "packet.evidence.encrypted_dump_exists" && check.ok === false
      )
    );
  });
});
