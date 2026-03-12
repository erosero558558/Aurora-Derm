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

test("backup-escrow-packet writes external escrow evidence without requiring DATABASE_URL", async () => {
  await withTempDir(async (dir) => {
    const now = new Date();
    const uploadStartedAt = new Date(now.getTime() - 2 * 60 * 1000).toISOString();
    const uploadFinishedAt = new Date(now.getTime() - 60 * 1000).toISOString();
    const expiresAt = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString();
    const manifestPath = join(dir, "backup-escrow-manifest.json");
    const backupDrillPacketPath = join(dir, "backup-drill-packet.json");
    const encryptedDumpPath = join(dir, "patient-flow-os.dump.gpg");
    const encryptedDumpShaPath = join(dir, "patient-flow-os.dump.gpg.sha256");
    const putObjectResponsePath = join(dir, "put-object-response.json");
    const headObjectPath = join(dir, "head-object.json");
    const objectTaggingPath = join(dir, "object-tagging.json");
    const outputDir = join(dir, "backup-escrow-artifacts");

    await writeFile(encryptedDumpPath, "encrypted backup drill bytes", "utf8");
    await writeFile(encryptedDumpShaPath, `${"f".repeat(64)}  patient-flow-os.dump.gpg\n`, "utf8");
    await writeFile(
      backupDrillPacketPath,
      `${JSON.stringify(
        {
          ok: true,
          generatedAt: now.toISOString(),
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
            expiresAt,
            sourceTotals: null,
            restoredTotals: null
          },
          evidence: {
            backupManifestPath: "backup-drill-manifest.json",
            dumpPath: "patient-flow-os.dump",
            dumpSha256Path: "patient-flow-os.dump.sha256",
            dumpSha256: "a".repeat(64),
            encryptedDumpPath,
            encryptedDumpSha256Path: encryptedDumpShaPath,
            encryptedDumpSha256: "f".repeat(64),
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
    await writeFile(
      putObjectResponsePath,
      `${JSON.stringify(
        {
          ETag: "\"etag-123\"",
          VersionId: "version-1",
          ServerSideEncryption: "AES256"
        },
        null,
        2
      )}\n`,
      "utf8"
    );
    await writeFile(
      headObjectPath,
      `${JSON.stringify(
        {
          ETag: "\"etag-123\"",
          VersionId: "version-1",
          LastModified: uploadFinishedAt,
          ServerSideEncryption: "AES256",
          Metadata: {
            source_environment: "production",
            retention_days: "30",
            expires_at: expiresAt,
            backup_mode: "logical_pg_dump",
            encryption_mode: "gpg_symmetric",
            lifecycle_policy_ref: "patient-flow-os-backup-retention"
          }
        },
        null,
        2
      )}\n`,
      "utf8"
    );
    await writeFile(
      objectTaggingPath,
      `${JSON.stringify(
        {
          TagSet: [
            { Key: "source_environment", Value: "production" },
            { Key: "retention_days", Value: "30" },
            { Key: "expires_at", Value: expiresAt },
            { Key: "backup_mode", Value: "logical_pg_dump" },
            { Key: "lifecycle_policy_ref", Value: "patient-flow-os-backup-retention" }
          ]
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
          generatedAt: now.toISOString(),
          sourceEnvironment: "production",
          escrowProvider: "aws_s3",
          archiveDestination: "aws_s3_encrypted",
          bucket: "patient-flow-os-backups",
          key: "production/backup-drill/patient-flow-os.dump.gpg",
          region: "us-east-1",
          lifecyclePolicyRef: "patient-flow-os-backup-retention",
          backupMode: "logical_pg_dump",
          encryptionMode: "gpg_symmetric",
          encryptionKeyRef: "github_secret:PATIENT_FLOW_OS_BACKUP_ENCRYPTION_PASSPHRASE",
          encryptedDumpPath,
          encryptedDumpSha256Path: encryptedDumpShaPath,
          backupDrillPacketPath,
          putObjectResponsePath,
          headObjectPath,
          objectTaggingPath,
          retentionDays: 30,
          expiresAt,
          uploadStartedAt,
          uploadFinishedAt
        },
        null,
        2
      )}\n`,
      "utf8"
    );

    const capture = createIoCapture();
    const exitCode = await runCutoverCli(
      [
        "backup-escrow-packet",
        "--input",
        manifestPath,
        "--artifacts-dir",
        outputDir,
        "--source-environment",
        "production",
        "--max-object-age-hours",
        "24",
        "--label",
        "patient-flow-os-production-backup-escrow",
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
      backupEscrowPacket: {
        ok: boolean;
        escrowProvider: string;
        archiveDestination: string;
        summary: {
          sourceBackupDrillReady: boolean;
          objectUploaded: boolean;
          metadataAligned: boolean;
          tagsAligned: boolean;
          retentionDays: number;
        };
        escrowObject: {
          bucket: string;
          key: string;
          eTag: string | null;
        };
        evidence: {
          encryptedDumpSha256: string | null;
        };
      };
    };
    assert.equal(payload.command, "backup-escrow-packet");
    assert.equal(payload.backupEscrowPacket.ok, true);
    assert.equal(payload.backupEscrowPacket.escrowProvider, "aws_s3");
    assert.equal(payload.backupEscrowPacket.archiveDestination, "aws_s3_encrypted");
    assert.equal(payload.backupEscrowPacket.summary.sourceBackupDrillReady, true);
    assert.equal(payload.backupEscrowPacket.summary.objectUploaded, true);
    assert.equal(payload.backupEscrowPacket.summary.metadataAligned, true);
    assert.equal(payload.backupEscrowPacket.summary.tagsAligned, true);
    assert.equal(payload.backupEscrowPacket.summary.retentionDays, 30);
    assert.equal(payload.backupEscrowPacket.escrowObject.bucket, "patient-flow-os-backups");
    assert.equal(
      payload.backupEscrowPacket.escrowObject.key,
      "production/backup-drill/patient-flow-os.dump.gpg"
    );
    assert.equal(payload.backupEscrowPacket.escrowObject.eTag, "etag-123");
    assert.equal(payload.backupEscrowPacket.evidence.encryptedDumpSha256, "f".repeat(64));
    assert.equal(payload.outputPath, join(outputDir, "backup-escrow-packet.json"));
    assert.ok(
      (await readFile(join(outputDir, "backup-escrow-checklist.json"), "utf8")).includes("review_bucket_lifecycle")
    );
  });
});

test("verify-backup-escrow passes for a valid external escrow packet", async () => {
  await withTempDir(async (dir) => {
    const now = new Date();
    const generatedAt = now.toISOString();
    const expiresAt = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString();
    const manifestPath = join(dir, "backup-escrow-manifest.json");
    const backupDrillPacketPath = join(dir, "backup-drill-packet.json");
    const headObjectPath = join(dir, "head-object.json");
    const objectTaggingPath = join(dir, "object-tagging.json");
    const packetPath = join(dir, "backup-escrow-packet.json");

    await writeFile(manifestPath, "{}\n", "utf8");
    await writeFile(backupDrillPacketPath, "{}\n", "utf8");
    await writeFile(headObjectPath, "{}\n", "utf8");
    await writeFile(objectTaggingPath, "{}\n", "utf8");

    await writeFile(
      packetPath,
      `${JSON.stringify(
        {
          ok: true,
          generatedAt,
          label: "patient-flow-os-production-backup-escrow",
          sourceEnvironment: "production",
          escrowProvider: "aws_s3",
          archiveDestination: "aws_s3_encrypted",
          summary: {
            sourceBackupDrillReady: true,
            objectUploaded: true,
            metadataAligned: true,
            tagsAligned: true,
            retentionDays: 30,
            expiresAt,
            uploadDurationSeconds: 60,
            objectAgeHours: 0.1,
            maxObjectAgeHours: 24
          },
          escrowObject: {
            bucket: "patient-flow-os-backups",
            key: "production/backup-drill/patient-flow-os.dump.gpg",
            region: "us-east-1",
            versionId: "version-1",
            eTag: "etag-123",
            lastModified: generatedAt,
            serverSideEncryption: "AES256",
            lifecyclePolicyRef: "patient-flow-os-backup-retention"
          },
          evidence: {
            backupEscrowManifestPath: manifestPath,
            backupDrillPacketPath,
            encryptedDumpPath: "patient-flow-os.dump.gpg",
            encryptedDumpSha256Path: "patient-flow-os.dump.gpg.sha256",
            encryptedDumpSha256: "f".repeat(64),
            putObjectResponsePath: "put-object-response.json",
            headObjectPath,
            objectTaggingPath
          },
          automatedChecks: [
            {
              id: "escrow_upload_recorded",
              title: "External escrow upload recorded bucket, key and etag",
              status: "passed",
              message: "Escrow upload recorded the external object coordinates."
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
        "verify-backup-escrow",
        "--input",
        packetPath,
        "--source-environment",
        "production",
        "--max-object-age-hours",
        "24",
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
      backupEscrowVerification: { ok: boolean; checks: Array<{ id: string; ok: boolean }> };
    };
    assert.equal(payload.command, "verify-backup-escrow");
    assert.equal(payload.backupEscrowVerification.ok, true);
    assert.ok(payload.backupEscrowVerification.checks.every((check) => check.ok));
  });
});

test("verify-backup-escrow fails when the external object age exceeds the configured budget", async () => {
  await withTempDir(async (dir) => {
    const now = new Date();
    const generatedAt = now.toISOString();
    const expiresAt = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString();
    const manifestPath = join(dir, "backup-escrow-manifest.json");
    const backupDrillPacketPath = join(dir, "backup-drill-packet.json");
    const headObjectPath = join(dir, "head-object.json");
    const objectTaggingPath = join(dir, "object-tagging.json");
    const packetPath = join(dir, "backup-escrow-packet.json");

    await writeFile(manifestPath, "{}\n", "utf8");
    await writeFile(backupDrillPacketPath, "{}\n", "utf8");
    await writeFile(headObjectPath, "{}\n", "utf8");
    await writeFile(objectTaggingPath, "{}\n", "utf8");

    await writeFile(
      packetPath,
      `${JSON.stringify(
        {
          ok: true,
          generatedAt,
          label: "patient-flow-os-production-backup-escrow",
          sourceEnvironment: "production",
          escrowProvider: "aws_s3",
          archiveDestination: "aws_s3_encrypted",
          summary: {
            sourceBackupDrillReady: true,
            objectUploaded: true,
            metadataAligned: true,
            tagsAligned: true,
            retentionDays: 30,
            expiresAt,
            uploadDurationSeconds: 60,
            objectAgeHours: 72,
            maxObjectAgeHours: 24
          },
          escrowObject: {
            bucket: "patient-flow-os-backups",
            key: "production/backup-drill/patient-flow-os.dump.gpg",
            region: "us-east-1",
            versionId: "version-1",
            eTag: "etag-123",
            lastModified: generatedAt,
            serverSideEncryption: "AES256",
            lifecyclePolicyRef: "patient-flow-os-backup-retention"
          },
          evidence: {
            backupEscrowManifestPath: manifestPath,
            backupDrillPacketPath,
            encryptedDumpPath: "patient-flow-os.dump.gpg",
            encryptedDumpSha256Path: "patient-flow-os.dump.gpg.sha256",
            encryptedDumpSha256: "f".repeat(64),
            putObjectResponsePath: "put-object-response.json",
            headObjectPath,
            objectTaggingPath
          },
          automatedChecks: [
            {
              id: "escrow_age_within_budget",
              title: "Escrow object age stays within the configured budget",
              status: "failed",
              message: "Escrow object age 72h exceeded 24h."
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
        "verify-backup-escrow",
        "--input",
        packetPath,
        "--source-environment",
        "production",
        "--max-object-age-hours",
        "24",
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
      backupEscrowVerification: {
        ok: boolean;
        checks: Array<{ id: string; ok: boolean }>;
      };
    };
    assert.match(payload.error, /backup escrow packet failed verification/);
    assert.equal(payload.backupEscrowVerification.ok, false);
    assert.ok(
      payload.backupEscrowVerification.checks.some(
        (check) => check.id === "packet.summary.object_age_within_budget" && check.ok === false
      )
    );
  });
});

test("backup-escrow-replica-packet writes replica escrow evidence without requiring DATABASE_URL", async () => {
  await withTempDir(async (dir) => {
    const now = new Date();
    const expiresAt = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString();
    const manifestPath = join(dir, "backup-escrow-replica-manifest.json");
    const sourceBackupEscrowPacketPath = join(dir, "backup-escrow-packet.json");
    const backupDrillPacketPath = join(dir, "backup-drill-packet.json");
    const headObjectPath = join(dir, "replica-head-object.json");
    const objectTaggingPath = join(dir, "replica-object-tagging.json");
    const putObjectResponsePath = join(dir, "replica-put-object-response.json");
    const encryptedDumpPath = join(dir, "patient-flow-os.dump.gpg");
    const encryptedDumpSha256Path = join(dir, "patient-flow-os.dump.gpg.sha256");
    const outputDir = join(dir, "backup-escrow-replica-artifacts");

    await writeFile(backupDrillPacketPath, `${JSON.stringify({ ok: true }, null, 2)}\n`, "utf8");
    await writeFile(encryptedDumpPath, "encrypted dump bytes", "utf8");
    await writeFile(encryptedDumpSha256Path, `${"f".repeat(64)}  patient-flow-os.dump.gpg\n`, "utf8");
    await writeFile(
      sourceBackupEscrowPacketPath,
      `${JSON.stringify(
        {
          ok: true,
          generatedAt: now.toISOString(),
          label: "patient-flow-os-production-backup-escrow",
          sourceEnvironment: "production",
          escrowProvider: "aws_s3",
          archiveDestination: "aws_s3_encrypted",
          summary: {
            sourceBackupDrillReady: true,
            objectUploaded: true,
            metadataAligned: true,
            tagsAligned: true,
            retentionDays: 30,
            expiresAt,
            uploadDurationSeconds: 60,
            objectAgeHours: 0.1,
            maxObjectAgeHours: 24
          },
          escrowObject: {
            bucket: "patient-flow-os-backups-primary",
            key: "production/backup-drill/patient-flow-os.dump.gpg",
            region: "us-east-1",
            versionId: "version-1",
            eTag: "etag-primary",
            lastModified: now.toISOString(),
            serverSideEncryption: "AES256",
            lifecyclePolicyRef: "patient-flow-os-backup-retention-primary"
          },
          evidence: {
            backupEscrowManifestPath: "backup-escrow-manifest.json",
            backupDrillPacketPath,
            encryptedDumpPath,
            encryptedDumpSha256Path,
            encryptedDumpSha256: "f".repeat(64),
            putObjectResponsePath: "escrow-put-object-response.json",
            headObjectPath: "escrow-head-object.json",
            objectTaggingPath: "escrow-object-tagging.json"
          },
          automatedChecks: [],
          manualChecks: []
        },
        null,
        2
      )}\n`,
      "utf8"
    );
    await writeFile(
      putObjectResponsePath,
      `${JSON.stringify({ ETag: "\"etag-replica\"", VersionId: "replica-version", ServerSideEncryption: "AES256" }, null, 2)}\n`,
      "utf8"
    );
    await writeFile(
      headObjectPath,
      `${JSON.stringify(
        {
          ETag: "\"etag-replica\"",
          VersionId: "replica-version",
          LastModified: now.toISOString(),
          ServerSideEncryption: "AES256",
          Metadata: {
            source_environment: "production",
            retention_days: "30",
            expires_at: expiresAt,
            backup_mode: "logical_pg_dump",
            encryption_mode: "gpg_symmetric",
            replication_mode: "escrow_replica_copy",
            lifecycle_policy_ref: "patient-flow-os-backup-retention-replica"
          }
        },
        null,
        2
      )}\n`,
      "utf8"
    );
    await writeFile(
      objectTaggingPath,
      `${JSON.stringify(
        {
          TagSet: [
            { Key: "source_environment", Value: "production" },
            { Key: "retention_days", Value: "30" },
            { Key: "expires_at", Value: expiresAt },
            { Key: "backup_mode", Value: "logical_pg_dump" },
            { Key: "replication_mode", Value: "escrow_replica_copy" },
            { Key: "lifecycle_policy_ref", Value: "patient-flow-os-backup-retention-replica" }
          ]
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
          generatedAt: now.toISOString(),
          sourceEnvironment: "production",
          replicaProvider: "aws_s3",
          archiveDestination: "aws_s3_encrypted",
          replicationMode: "escrow_replica_copy",
          sourceBackupEscrowPacketPath,
          bucket: "patient-flow-os-backups-replica",
          key: "production/backup-drill/patient-flow-os.dump.gpg",
          region: "us-west-2",
          lifecyclePolicyRef: "patient-flow-os-backup-retention-replica",
          encryptionMode: "gpg_symmetric",
          encryptionKeyRef: "github_secret:PATIENT_FLOW_OS_BACKUP_ENCRYPTION_PASSPHRASE",
          encryptedDumpPath,
          encryptedDumpSha256Path,
          putObjectResponsePath,
          headObjectPath,
          objectTaggingPath,
          retentionDays: 30,
          expiresAt,
          uploadStartedAt: new Date(now.getTime() - 60 * 1000).toISOString(),
          uploadFinishedAt: now.toISOString()
        },
        null,
        2
      )}\n`,
      "utf8"
    );

    const capture = createIoCapture();
    const exitCode = await runCutoverCli(
      [
        "backup-escrow-replica-packet",
        "--input",
        manifestPath,
        "--artifacts-dir",
        outputDir,
        "--source-environment",
        "production",
        "--max-object-age-hours",
        "24",
        "--label",
        "patient-flow-os-production-backup-escrow-replica",
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
      backupEscrowReplicaPacket: {
        ok: boolean;
        summary: {
          sourceBackupEscrowReady: boolean;
          sourceBackupDrillReady: boolean;
          replicaUploaded: boolean;
          metadataAligned: boolean;
          tagsAligned: boolean;
          encryptedDumpChecksumMatchesSource: boolean;
          replicaTargetDistinctFromPrimary: boolean;
        };
        sourceEscrowObject: { bucket: string };
        replicaEscrowObject: { bucket: string; region: string; eTag: string | null };
      };
    };
    assert.equal(payload.command, "backup-escrow-replica-packet");
    assert.equal(payload.backupEscrowReplicaPacket.ok, true);
    assert.equal(payload.backupEscrowReplicaPacket.summary.sourceBackupEscrowReady, true);
    assert.equal(payload.backupEscrowReplicaPacket.summary.sourceBackupDrillReady, true);
    assert.equal(payload.backupEscrowReplicaPacket.summary.replicaUploaded, true);
    assert.equal(payload.backupEscrowReplicaPacket.summary.metadataAligned, true);
    assert.equal(payload.backupEscrowReplicaPacket.summary.tagsAligned, true);
    assert.equal(payload.backupEscrowReplicaPacket.summary.encryptedDumpChecksumMatchesSource, true);
    assert.equal(payload.backupEscrowReplicaPacket.summary.replicaTargetDistinctFromPrimary, true);
    assert.equal(payload.backupEscrowReplicaPacket.sourceEscrowObject.bucket, "patient-flow-os-backups-primary");
    assert.equal(payload.backupEscrowReplicaPacket.replicaEscrowObject.bucket, "patient-flow-os-backups-replica");
    assert.equal(payload.backupEscrowReplicaPacket.replicaEscrowObject.region, "us-west-2");
    assert.equal(payload.backupEscrowReplicaPacket.replicaEscrowObject.eTag, "etag-replica");
    assert.equal(payload.outputPath, join(outputDir, "backup-escrow-replica-packet.json"));
    assert.ok(
      (await readFile(join(outputDir, "backup-escrow-replica-checklist.json"), "utf8")).includes(
        "review_replica_region_isolation"
      )
    );
  });
});

test("verify-backup-escrow-replica passes for a valid replica packet", async () => {
  await withTempDir(async (dir) => {
    const now = new Date();
    const generatedAt = now.toISOString();
    const expiresAt = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString();
    const manifestPath = join(dir, "backup-escrow-replica-manifest.json");
    const sourcePacketPath = join(dir, "backup-escrow-packet.json");
    const backupDrillPacketPath = join(dir, "backup-drill-packet.json");
    const headObjectPath = join(dir, "replica-head-object.json");
    const objectTaggingPath = join(dir, "replica-object-tagging.json");
    const packetPath = join(dir, "backup-escrow-replica-packet.json");

    await writeFile(manifestPath, "{}\n", "utf8");
    await writeFile(sourcePacketPath, "{}\n", "utf8");
    await writeFile(backupDrillPacketPath, "{}\n", "utf8");
    await writeFile(headObjectPath, "{}\n", "utf8");
    await writeFile(objectTaggingPath, "{}\n", "utf8");

    await writeFile(
      packetPath,
      `${JSON.stringify(
        {
          ok: true,
          generatedAt,
          label: "patient-flow-os-production-backup-escrow-replica",
          sourceEnvironment: "production",
          replicaProvider: "aws_s3",
          archiveDestination: "aws_s3_encrypted",
          replicationMode: "escrow_replica_copy",
          summary: {
            sourceBackupEscrowReady: true,
            sourceBackupDrillReady: true,
            replicaUploaded: true,
            metadataAligned: true,
            tagsAligned: true,
            encryptedDumpChecksumMatchesSource: true,
            replicaTargetDistinctFromPrimary: true,
            retentionDays: 30,
            expiresAt,
            uploadDurationSeconds: 45,
            objectAgeHours: 0.2,
            maxObjectAgeHours: 24
          },
          sourceEscrowObject: {
            bucket: "patient-flow-os-backups-primary",
            key: "production/backup-drill/patient-flow-os.dump.gpg",
            region: "us-east-1",
            versionId: "primary-version",
            eTag: "etag-primary",
            lastModified: generatedAt,
            serverSideEncryption: "AES256",
            lifecyclePolicyRef: "patient-flow-os-backup-retention-primary"
          },
          replicaEscrowObject: {
            bucket: "patient-flow-os-backups-replica",
            key: "production/backup-drill/patient-flow-os.dump.gpg",
            region: "us-west-2",
            versionId: "replica-version",
            eTag: "etag-replica",
            lastModified: generatedAt,
            serverSideEncryption: "AES256",
            lifecyclePolicyRef: "patient-flow-os-backup-retention-replica"
          },
          evidence: {
            backupEscrowReplicaManifestPath: manifestPath,
            sourceBackupEscrowPacketPath: sourcePacketPath,
            backupDrillPacketPath,
            encryptedDumpPath: "patient-flow-os.dump.gpg",
            encryptedDumpSha256Path: "patient-flow-os.dump.gpg.sha256",
            encryptedDumpSha256: "f".repeat(64),
            putObjectResponsePath: "replica-put-object-response.json",
            headObjectPath,
            objectTaggingPath
          },
          automatedChecks: [
            {
              id: "replica_target_distinct",
              title: "Replica escrow target differs from the primary escrow target",
              status: "passed",
              message: "Replica escrow target is distinct from the primary bucket/key/region."
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
        "verify-backup-escrow-replica",
        "--input",
        packetPath,
        "--source-environment",
        "production",
        "--max-object-age-hours",
        "24",
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
      backupEscrowReplicaVerification: { ok: boolean; checks: Array<{ id: string; ok: boolean }> };
    };
    assert.equal(payload.command, "verify-backup-escrow-replica");
    assert.equal(payload.backupEscrowReplicaVerification.ok, true);
    assert.ok(payload.backupEscrowReplicaVerification.checks.every((check) => check.ok));
  });
});

test("verify-backup-escrow-replica fails when the replica target is not distinct from the primary escrow", async () => {
  await withTempDir(async (dir) => {
    const now = new Date();
    const generatedAt = now.toISOString();
    const expiresAt = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString();
    const manifestPath = join(dir, "backup-escrow-replica-manifest.json");
    const sourcePacketPath = join(dir, "backup-escrow-packet.json");
    const backupDrillPacketPath = join(dir, "backup-drill-packet.json");
    const headObjectPath = join(dir, "replica-head-object.json");
    const objectTaggingPath = join(dir, "replica-object-tagging.json");
    const packetPath = join(dir, "backup-escrow-replica-packet.json");

    await writeFile(manifestPath, "{}\n", "utf8");
    await writeFile(sourcePacketPath, "{}\n", "utf8");
    await writeFile(backupDrillPacketPath, "{}\n", "utf8");
    await writeFile(headObjectPath, "{}\n", "utf8");
    await writeFile(objectTaggingPath, "{}\n", "utf8");

    await writeFile(
      packetPath,
      `${JSON.stringify(
        {
          ok: false,
          generatedAt,
          label: "patient-flow-os-production-backup-escrow-replica",
          sourceEnvironment: "production",
          replicaProvider: "aws_s3",
          archiveDestination: "aws_s3_encrypted",
          replicationMode: "escrow_replica_copy",
          summary: {
            sourceBackupEscrowReady: true,
            sourceBackupDrillReady: true,
            replicaUploaded: true,
            metadataAligned: true,
            tagsAligned: true,
            encryptedDumpChecksumMatchesSource: true,
            replicaTargetDistinctFromPrimary: false,
            retentionDays: 30,
            expiresAt,
            uploadDurationSeconds: 45,
            objectAgeHours: 0.2,
            maxObjectAgeHours: 24
          },
          sourceEscrowObject: {
            bucket: "patient-flow-os-backups-primary",
            key: "production/backup-drill/patient-flow-os.dump.gpg",
            region: "us-east-1",
            versionId: "primary-version",
            eTag: "etag-primary",
            lastModified: generatedAt,
            serverSideEncryption: "AES256",
            lifecyclePolicyRef: "patient-flow-os-backup-retention-primary"
          },
          replicaEscrowObject: {
            bucket: "patient-flow-os-backups-primary",
            key: "production/backup-drill/patient-flow-os.dump.gpg",
            region: "us-east-1",
            versionId: "replica-version",
            eTag: "etag-replica",
            lastModified: generatedAt,
            serverSideEncryption: "AES256",
            lifecyclePolicyRef: "patient-flow-os-backup-retention-primary"
          },
          evidence: {
            backupEscrowReplicaManifestPath: manifestPath,
            sourceBackupEscrowPacketPath: sourcePacketPath,
            backupDrillPacketPath,
            encryptedDumpPath: "patient-flow-os.dump.gpg",
            encryptedDumpSha256Path: "patient-flow-os.dump.gpg.sha256",
            encryptedDumpSha256: "f".repeat(64),
            putObjectResponsePath: "replica-put-object-response.json",
            headObjectPath,
            objectTaggingPath
          },
          automatedChecks: [
            {
              id: "replica_target_distinct",
              title: "Replica escrow target differs from the primary escrow target",
              status: "failed",
              message: "Replica escrow target matches the primary target and does not provide isolation."
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
        "verify-backup-escrow-replica",
        "--input",
        packetPath,
        "--source-environment",
        "production",
        "--max-object-age-hours",
        "24",
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
      backupEscrowReplicaVerification: {
        ok: boolean;
        checks: Array<{ id: string; ok: boolean }>;
      };
    };
    assert.match(payload.error, /backup escrow replica packet failed verification/);
    assert.equal(payload.backupEscrowReplicaVerification.ok, false);
    assert.ok(
      payload.backupEscrowReplicaVerification.checks.some(
        (check) => check.id === "packet.summary.replica_target_distinct" && check.ok === false
      )
    );
  });
});

test("backup-escrow-restore-packet writes restore evidence from an escrow artifact without requiring DATABASE_URL", async () => {
  const pool = createPgPool();
  await replaceBootstrapStateInPostgres(pool, createBootstrapState());

  try {
    await withTempDir(async (dir) => {
      const now = new Date();
      const expiresAt = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString();
      const sourceSmokePath = join(dir, "source-smoke.json");
      const sourceInspectPath = join(dir, "source-inspect.json");
      const restoreSmokePath = join(dir, "restore-smoke.json");
      const restoreInspectPath = join(dir, "restore-inspect.json");
      const manifestPath = join(dir, "backup-escrow-restore-manifest.json");
      const backupEscrowPacketPath = join(dir, "backup-escrow-packet.json");
      const backupDrillPacketPath = join(dir, "backup-drill-packet.json");
      const downloadedEncryptedDumpPath = join(dir, "downloaded-patient-flow-os.dump.gpg");
      const downloadedEncryptedDumpShaPath = join(dir, "downloaded-patient-flow-os.dump.gpg.sha256");
      const decryptedDumpPath = join(dir, "restored-patient-flow-os.dump");
      const decryptedDumpShaPath = join(dir, "restored-patient-flow-os.dump.sha256");
      const outputDir = join(dir, "backup-escrow-restore-artifacts");

      await writeFile(downloadedEncryptedDumpPath, "encrypted dump bytes", "utf8");
      await writeFile(downloadedEncryptedDumpShaPath, `${"f".repeat(64)}  downloaded-patient-flow-os.dump.gpg\n`, "utf8");
      await writeFile(decryptedDumpPath, "plain dump bytes", "utf8");
      await writeFile(decryptedDumpShaPath, `${"a".repeat(64)}  restored-patient-flow-os.dump\n`, "utf8");

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
      await writeFile(restoreSmokePath, sourceSmokeCapture.stdout(), "utf8");

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
      await writeFile(restoreInspectPath, sourceInspectCapture.stdout(), "utf8");

      await writeFile(
        backupDrillPacketPath,
        `${JSON.stringify(
          {
            ok: true,
            generatedAt: now.toISOString(),
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
              expiresAt,
              sourceTotals: JSON.parse(sourceInspectCapture.stdout()).summary.totals,
              restoredTotals: JSON.parse(sourceInspectCapture.stdout()).summary.totals
            },
            evidence: {
              backupManifestPath: "backup-drill-manifest.json",
              dumpPath: "patient-flow-os.dump",
              dumpSha256Path: "patient-flow-os.dump.sha256",
              dumpSha256: "a".repeat(64),
              encryptedDumpPath: downloadedEncryptedDumpPath,
              encryptedDumpSha256Path: downloadedEncryptedDumpShaPath,
              encryptedDumpSha256: "f".repeat(64),
              encryptionMode: "gpg_symmetric",
              encryptionKeyRef: "github_secret:PATIENT_FLOW_OS_BACKUP_ENCRYPTION_PASSPHRASE",
              sourceSmokePath,
              sourceInspectPath,
              restoreSmokePath,
              restoreInspectPath
            },
            automatedChecks: [],
            manualChecks: []
          },
          null,
          2
        )}\n`,
        "utf8"
      );

      await writeFile(
        backupEscrowPacketPath,
        `${JSON.stringify(
          {
            ok: true,
            generatedAt: now.toISOString(),
            label: "patient-flow-os-production-backup-escrow",
            sourceEnvironment: "production",
            escrowProvider: "aws_s3",
            archiveDestination: "aws_s3_encrypted",
            summary: {
              sourceBackupDrillReady: true,
              objectUploaded: true,
              metadataAligned: true,
              tagsAligned: true,
              retentionDays: 30,
              expiresAt,
              uploadDurationSeconds: 60,
              objectAgeHours: 0.1,
              maxObjectAgeHours: 24
            },
            escrowObject: {
              bucket: "patient-flow-os-backups",
              key: "production/backup-drill/patient-flow-os.dump.gpg",
              region: "us-east-1",
              versionId: "version-1",
              eTag: "etag-123",
              lastModified: now.toISOString(),
              serverSideEncryption: "AES256",
              lifecyclePolicyRef: "patient-flow-os-backup-retention"
            },
            evidence: {
              backupEscrowManifestPath: "backup-escrow-manifest.json",
              backupDrillPacketPath,
              encryptedDumpPath: downloadedEncryptedDumpPath,
              encryptedDumpSha256Path: downloadedEncryptedDumpShaPath,
              encryptedDumpSha256: "f".repeat(64),
              putObjectResponsePath: "escrow-put-object-response.json",
              headObjectPath: "escrow-head-object.json",
              objectTaggingPath: "escrow-object-tagging.json"
            },
            automatedChecks: [],
            manualChecks: []
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
            generatedAt: now.toISOString(),
            sourceEnvironment: "production",
            restoreTarget: "drill",
            restoreSource: "primary",
            escrowProvider: "aws_s3",
            archiveDestination: "aws_s3_encrypted",
            backupEscrowPacketPath,
            sourceSmokePath,
            sourceInspectPath,
            downloadedEncryptedDumpPath,
            downloadedEncryptedDumpSha256Path: downloadedEncryptedDumpShaPath,
            decryptedDumpPath,
            decryptedDumpSha256Path: decryptedDumpShaPath,
            restoreSmokePath,
            restoreInspectPath,
            downloadStartedAt: new Date(now.getTime() - 4 * 60 * 1000).toISOString(),
            downloadFinishedAt: new Date(now.getTime() - 3 * 60 * 1000).toISOString(),
            decryptStartedAt: new Date(now.getTime() - 2 * 60 * 1000).toISOString(),
            decryptFinishedAt: new Date(now.getTime() - 90 * 1000).toISOString(),
            restoreStartedAt: new Date(now.getTime() - 60 * 1000).toISOString(),
            restoreFinishedAt: now.toISOString()
          },
          null,
          2
        )}\n`,
        "utf8"
      );

      const capture = createIoCapture();
      const exitCode = await runCutoverCli(
        [
          "backup-escrow-restore-packet",
          "--input",
          manifestPath,
          "--artifacts-dir",
          outputDir,
          "--source-environment",
          "production",
          "--max-rto-seconds",
          "900",
          "--label",
          "patient-flow-os-production-backup-escrow-restore",
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
        backupEscrowRestorePacket: {
          ok: boolean;
          restoreTarget: string;
          restoreSource: string;
          summary: {
            sourceEscrowReady: boolean;
            sourceBackupDrillReady: boolean;
            restoreSmokeOk: boolean;
            downloadedDumpMatchesEscrowChecksum: boolean;
            decryptedDumpMatchesSourceDumpChecksum: boolean;
            totalsMatch: boolean;
          };
          escrowObject: { bucket: string; key: string };
        };
      };
      assert.equal(payload.command, "backup-escrow-restore-packet");
      assert.equal(payload.backupEscrowRestorePacket.ok, true);
      assert.equal(payload.backupEscrowRestorePacket.restoreTarget, "drill");
      assert.equal(payload.backupEscrowRestorePacket.restoreSource, "primary");
      assert.equal(payload.backupEscrowRestorePacket.summary.sourceEscrowReady, true);
      assert.equal(payload.backupEscrowRestorePacket.summary.sourceBackupDrillReady, true);
      assert.equal(payload.backupEscrowRestorePacket.summary.restoreSmokeOk, true);
      assert.equal(payload.backupEscrowRestorePacket.summary.downloadedDumpMatchesEscrowChecksum, true);
      assert.equal(payload.backupEscrowRestorePacket.summary.decryptedDumpMatchesSourceDumpChecksum, true);
      assert.equal(payload.backupEscrowRestorePacket.summary.totalsMatch, true);
      assert.equal(payload.backupEscrowRestorePacket.escrowObject.bucket, "patient-flow-os-backups");
      assert.equal(
        payload.backupEscrowRestorePacket.escrowObject.key,
        "production/backup-drill/patient-flow-os.dump.gpg"
      );
      assert.equal(payload.outputPath, join(outputDir, "backup-escrow-restore-packet.json"));
    });
  } finally {
    await pool.end();
  }
});

test("backup-escrow-restore-packet supports replica escrow artifacts as the restore source", async () => {
  const pool = createPgPool();
  await replaceBootstrapStateInPostgres(pool, createBootstrapState());

  try {
    await withTempDir(async (dir) => {
      const now = new Date();
      const expiresAt = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString();
      const sourceSmokePath = join(dir, "source-smoke.json");
      const sourceInspectPath = join(dir, "source-inspect.json");
      const restoreSmokePath = join(dir, "restore-smoke.json");
      const restoreInspectPath = join(dir, "restore-inspect.json");
      const manifestPath = join(dir, "backup-escrow-restore-manifest.json");
      const backupEscrowReplicaPacketPath = join(dir, "backup-escrow-replica-packet.json");
      const backupDrillPacketPath = join(dir, "backup-drill-packet.json");
      const downloadedEncryptedDumpPath = join(dir, "downloaded-patient-flow-os.dump.gpg");
      const downloadedEncryptedDumpShaPath = join(dir, "downloaded-patient-flow-os.dump.gpg.sha256");
      const decryptedDumpPath = join(dir, "restored-patient-flow-os.dump");
      const decryptedDumpShaPath = join(dir, "restored-patient-flow-os.dump.sha256");
      const outputDir = join(dir, "backup-escrow-replica-restore-artifacts");

      await writeFile(downloadedEncryptedDumpPath, "encrypted dump bytes", "utf8");
      await writeFile(downloadedEncryptedDumpShaPath, `${"f".repeat(64)}  downloaded-patient-flow-os.dump.gpg\n`, "utf8");
      await writeFile(decryptedDumpPath, "plain dump bytes", "utf8");
      await writeFile(decryptedDumpShaPath, `${"a".repeat(64)}  restored-patient-flow-os.dump\n`, "utf8");

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
      await writeFile(restoreSmokePath, sourceSmokeCapture.stdout(), "utf8");

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
      await writeFile(restoreInspectPath, sourceInspectCapture.stdout(), "utf8");

      await writeFile(
        backupDrillPacketPath,
        `${JSON.stringify(
          {
            ok: true,
            generatedAt: now.toISOString(),
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
              expiresAt,
              sourceTotals: JSON.parse(sourceInspectCapture.stdout()).summary.totals,
              restoredTotals: JSON.parse(sourceInspectCapture.stdout()).summary.totals
            },
            evidence: {
              backupManifestPath: "backup-drill-manifest.json",
              dumpPath: "patient-flow-os.dump",
              dumpSha256Path: "patient-flow-os.dump.sha256",
              dumpSha256: "a".repeat(64),
              encryptedDumpPath: downloadedEncryptedDumpPath,
              encryptedDumpSha256Path: downloadedEncryptedDumpShaPath,
              encryptedDumpSha256: "f".repeat(64),
              encryptionMode: "gpg_symmetric",
              encryptionKeyRef: "github_secret:PATIENT_FLOW_OS_BACKUP_ENCRYPTION_PASSPHRASE",
              sourceSmokePath,
              sourceInspectPath,
              restoreSmokePath,
              restoreInspectPath
            },
            automatedChecks: [],
            manualChecks: []
          },
          null,
          2
        )}\n`,
        "utf8"
      );

      await writeFile(
        backupEscrowReplicaPacketPath,
        `${JSON.stringify(
          {
            ok: true,
            generatedAt: now.toISOString(),
            label: "patient-flow-os-production-backup-escrow-replica",
            sourceEnvironment: "production",
            replicaProvider: "aws_s3",
            archiveDestination: "aws_s3_encrypted",
            replicationMode: "escrow_replica_copy",
            summary: {
              sourceBackupEscrowReady: true,
              sourceBackupDrillReady: true,
              replicaUploaded: true,
              metadataAligned: true,
              tagsAligned: true,
              encryptedDumpChecksumMatchesSource: true,
              replicaTargetDistinctFromPrimary: true,
              retentionDays: 30,
              expiresAt,
              uploadDurationSeconds: 60,
              objectAgeHours: 0.1,
              maxObjectAgeHours: 24
            },
            sourceEscrowObject: {
              bucket: "patient-flow-os-backups-primary",
              key: "production/backup-drill/patient-flow-os.dump.gpg",
              region: "us-east-1",
              versionId: "version-1",
              eTag: "etag-primary",
              lastModified: now.toISOString(),
              serverSideEncryption: "AES256",
              lifecyclePolicyRef: "patient-flow-os-backup-retention"
            },
            replicaEscrowObject: {
              bucket: "patient-flow-os-backups-replica",
              key: "production/backup-drill/patient-flow-os.dump.gpg",
              region: "us-west-2",
              versionId: "version-2",
              eTag: "etag-replica",
              lastModified: now.toISOString(),
              serverSideEncryption: "AES256",
              lifecyclePolicyRef: "patient-flow-os-backup-retention-replica"
            },
            evidence: {
              backupEscrowReplicaManifestPath: "backup-escrow-replica-manifest.json",
              sourceBackupEscrowPacketPath: "backup-escrow-packet.json",
              backupDrillPacketPath,
              encryptedDumpPath: downloadedEncryptedDumpPath,
              encryptedDumpSha256Path: downloadedEncryptedDumpShaPath,
              encryptedDumpSha256: "f".repeat(64),
              putObjectResponsePath: "replica-escrow-put-object-response.json",
              headObjectPath: "replica-escrow-head-object.json",
              objectTaggingPath: "replica-escrow-object-tagging.json"
            },
            automatedChecks: [],
            manualChecks: []
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
            generatedAt: now.toISOString(),
            sourceEnvironment: "production",
            restoreTarget: "drill",
            restoreSource: "replica",
            escrowProvider: "aws_s3",
            archiveDestination: "aws_s3_encrypted",
            backupEscrowPacketPath: backupEscrowReplicaPacketPath,
            sourceSmokePath,
            sourceInspectPath,
            downloadedEncryptedDumpPath,
            downloadedEncryptedDumpSha256Path: downloadedEncryptedDumpShaPath,
            decryptedDumpPath,
            decryptedDumpSha256Path: decryptedDumpShaPath,
            restoreSmokePath,
            restoreInspectPath,
            downloadStartedAt: new Date(now.getTime() - 4 * 60 * 1000).toISOString(),
            downloadFinishedAt: new Date(now.getTime() - 3 * 60 * 1000).toISOString(),
            decryptStartedAt: new Date(now.getTime() - 2 * 60 * 1000).toISOString(),
            decryptFinishedAt: new Date(now.getTime() - 90 * 1000).toISOString(),
            restoreStartedAt: new Date(now.getTime() - 60 * 1000).toISOString(),
            restoreFinishedAt: now.toISOString()
          },
          null,
          2
        )}\n`,
        "utf8"
      );

      const capture = createIoCapture();
      const exitCode = await runCutoverCli(
        [
          "backup-escrow-restore-packet",
          "--input",
          manifestPath,
          "--artifacts-dir",
          outputDir,
          "--source-environment",
          "production",
          "--max-rto-seconds",
          "900",
          "--label",
          "patient-flow-os-production-backup-escrow-replica-restore",
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
        backupEscrowRestorePacket: {
          ok: boolean;
          restoreSource: string;
          summary: {
            sourceEscrowReady: boolean;
            sourceBackupDrillReady: boolean;
            downloadedDumpMatchesEscrowChecksum: boolean;
            decryptedDumpMatchesSourceDumpChecksum: boolean;
          };
          escrowObject: { bucket: string; key: string; region: string };
        };
      };
      assert.equal(payload.command, "backup-escrow-restore-packet");
      assert.equal(payload.backupEscrowRestorePacket.ok, true);
      assert.equal(payload.backupEscrowRestorePacket.restoreSource, "replica");
      assert.equal(payload.backupEscrowRestorePacket.summary.sourceEscrowReady, true);
      assert.equal(payload.backupEscrowRestorePacket.summary.sourceBackupDrillReady, true);
      assert.equal(payload.backupEscrowRestorePacket.summary.downloadedDumpMatchesEscrowChecksum, true);
      assert.equal(payload.backupEscrowRestorePacket.summary.decryptedDumpMatchesSourceDumpChecksum, true);
      assert.equal(payload.backupEscrowRestorePacket.escrowObject.bucket, "patient-flow-os-backups-replica");
      assert.equal(
        payload.backupEscrowRestorePacket.escrowObject.key,
        "production/backup-drill/patient-flow-os.dump.gpg"
      );
      assert.equal(payload.backupEscrowRestorePacket.escrowObject.region, "us-west-2");
    });
  } finally {
    await pool.end();
  }
});

test("verify-backup-escrow-restore passes for a valid escrow restore packet", async () => {
  await withTempDir(async (dir) => {
    const now = new Date();
    const manifestPath = join(dir, "backup-escrow-restore-manifest.json");
    const sourcePacketPath = join(dir, "backup-escrow-packet.json");
    const restoreSmokePath = join(dir, "restore-smoke.json");
    const restoreInspectPath = join(dir, "restore-inspect.json");
    const packetPath = join(dir, "backup-escrow-restore-packet.json");

    await writeFile(manifestPath, "{}\n", "utf8");
    await writeFile(sourcePacketPath, "{}\n", "utf8");
    await writeFile(restoreSmokePath, "{}\n", "utf8");
    await writeFile(restoreInspectPath, "{}\n", "utf8");

    await writeFile(
      packetPath,
      `${JSON.stringify(
        {
          ok: true,
          generatedAt: now.toISOString(),
          label: "patient-flow-os-production-backup-escrow-restore",
          sourceEnvironment: "production",
          restoreTarget: "drill",
          restoreSource: "primary",
          escrowProvider: "aws_s3",
          archiveDestination: "aws_s3_encrypted",
          summary: {
            sourceEscrowReady: true,
            sourceBackupDrillReady: true,
            sourceSmokeOk: true,
            restoreSmokeOk: true,
            downloadedDumpMatchesEscrowChecksum: true,
            decryptedDumpMatchesSourceDumpChecksum: true,
            totalsMatch: true,
            downloadDurationSeconds: 30,
            decryptDurationSeconds: 30,
            restoreDurationSeconds: 120,
            measuredRtoSeconds: 120,
            maxRtoSeconds: 900,
            sourceTotals: null,
            restoredTotals: null
          },
          escrowObject: {
            bucket: "patient-flow-os-backups",
            key: "production/backup-drill/patient-flow-os.dump.gpg",
            region: "us-east-1",
            versionId: "version-1",
            eTag: "etag-123"
          },
          evidence: {
            backupEscrowRestoreManifestPath: manifestPath,
            backupEscrowPacketPath: sourcePacketPath,
            sourceBackupDrillPacketPath: sourcePacketPath,
            sourceSmokePath: "source-smoke.json",
            sourceInspectPath: "source-inspect.json",
            downloadedEncryptedDumpPath: "downloaded-patient-flow-os.dump.gpg",
            downloadedEncryptedDumpSha256Path: "downloaded-patient-flow-os.dump.gpg.sha256",
            downloadedEncryptedDumpSha256: "f".repeat(64),
            decryptedDumpPath: "restored-patient-flow-os.dump",
            decryptedDumpSha256Path: "restored-patient-flow-os.dump.sha256",
            decryptedDumpSha256: "a".repeat(64),
            restoreSmokePath,
            restoreInspectPath
          },
          automatedChecks: [],
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
        "verify-backup-escrow-restore",
        "--input",
        packetPath,
        "--source-environment",
        "production",
        "--max-rto-seconds",
        "900",
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
      backupEscrowRestoreVerification: { ok: boolean; checks: Array<{ id: string; ok: boolean }> };
    };
    assert.equal(payload.command, "verify-backup-escrow-restore");
    assert.equal(payload.backupEscrowRestoreVerification.ok, true);
    assert.ok(payload.backupEscrowRestoreVerification.checks.every((check) => check.ok));
  });
});

test("verify-backup-escrow-restore fails when the decrypted dump checksum diverges from source", async () => {
  await withTempDir(async (dir) => {
    const now = new Date();
    const manifestPath = join(dir, "backup-escrow-restore-manifest.json");
    const sourcePacketPath = join(dir, "backup-escrow-packet.json");
    const restoreSmokePath = join(dir, "restore-smoke.json");
    const restoreInspectPath = join(dir, "restore-inspect.json");
    const packetPath = join(dir, "backup-escrow-restore-packet.json");

    await writeFile(manifestPath, "{}\n", "utf8");
    await writeFile(sourcePacketPath, "{}\n", "utf8");
    await writeFile(restoreSmokePath, "{}\n", "utf8");
    await writeFile(restoreInspectPath, "{}\n", "utf8");

    await writeFile(
      packetPath,
      `${JSON.stringify(
        {
          ok: false,
          generatedAt: now.toISOString(),
          label: "patient-flow-os-production-backup-escrow-restore",
          sourceEnvironment: "production",
          restoreTarget: "drill",
          restoreSource: "primary",
          escrowProvider: "aws_s3",
          archiveDestination: "aws_s3_encrypted",
          summary: {
            sourceEscrowReady: true,
            sourceBackupDrillReady: true,
            sourceSmokeOk: true,
            restoreSmokeOk: true,
            downloadedDumpMatchesEscrowChecksum: true,
            decryptedDumpMatchesSourceDumpChecksum: false,
            totalsMatch: true,
            downloadDurationSeconds: 30,
            decryptDurationSeconds: 30,
            restoreDurationSeconds: 120,
            measuredRtoSeconds: 120,
            maxRtoSeconds: 900,
            sourceTotals: null,
            restoredTotals: null
          },
          escrowObject: {
            bucket: "patient-flow-os-backups",
            key: "production/backup-drill/patient-flow-os.dump.gpg",
            region: "us-east-1",
            versionId: "version-1",
            eTag: "etag-123"
          },
          evidence: {
            backupEscrowRestoreManifestPath: manifestPath,
            backupEscrowPacketPath: sourcePacketPath,
            sourceBackupDrillPacketPath: sourcePacketPath,
            sourceSmokePath: "source-smoke.json",
            sourceInspectPath: "source-inspect.json",
            downloadedEncryptedDumpPath: "downloaded-patient-flow-os.dump.gpg",
            downloadedEncryptedDumpSha256Path: "downloaded-patient-flow-os.dump.gpg.sha256",
            downloadedEncryptedDumpSha256: "f".repeat(64),
            decryptedDumpPath: "restored-patient-flow-os.dump",
            decryptedDumpSha256Path: "restored-patient-flow-os.dump.sha256",
            decryptedDumpSha256: "deadbeef".repeat(8),
            restoreSmokePath,
            restoreInspectPath
          },
          automatedChecks: [],
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
        "verify-backup-escrow-restore",
        "--input",
        packetPath,
        "--source-environment",
        "production",
        "--max-rto-seconds",
        "900",
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
      backupEscrowRestoreVerification: {
        ok: boolean;
        checks: Array<{ id: string; ok: boolean }>;
      };
    };
    assert.match(payload.error, /backup escrow restore packet failed verification/);
    assert.equal(payload.backupEscrowRestoreVerification.ok, false);
    assert.ok(
      payload.backupEscrowRestoreVerification.checks.some(
        (check) => check.id === "packet.summary.decrypted_dump_matches_source_dump_checksum" && check.ok === false
      )
    );
  });
});
