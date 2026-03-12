import { createHash } from "node:crypto";
import { access, mkdir, readFile, stat, writeFile } from "node:fs/promises";
import { dirname, isAbsolute, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";
import { Pool } from "pg";
import { BootstrapStateSchema, type BootstrapState } from "../../../packages/core/src/index.js";
import {
  OpenClawImportBundleSchema,
  importOpenClawProjectedCases
} from "./openclaw-import.js";
import {
  ensurePostgresSchema,
  loadBootstrapStateFromPostgres,
  replaceBootstrapStateInPostgres,
  type Queryable
} from "./postgres-runtime.js";
import { createBootstrapState } from "./state.js";

interface CutoverCliIo {
  stdout(message: string): void;
  stderr(message: string): void;
}

export interface RunCutoverCliOptions {
  cwd?: string;
  env?: NodeJS.ProcessEnv;
  io?: Partial<CutoverCliIo>;
  pool?: Queryable;
}

interface TenantSummary {
  tenantId: string;
  slug: string;
  name: string;
  patients: number;
  cases: number;
  activeCases: number;
  appointments: number;
  callbacks: number;
  queueTickets: number;
  threads: number;
  actions: number;
  approvals: number;
  agentTasks: number;
  preparedActions: number;
  preparedActionDispatchJobs: number;
}

interface StateSummary {
  tenants: TenantSummary[];
  totals: {
    tenants: number;
    locations: number;
    staffUsers: number;
    patients: number;
    cases: number;
    activeCases: number;
    appointments: number;
    callbacks: number;
    queueTickets: number;
    threads: number;
    actions: number;
    approvals: number;
    agentTasks: number;
    preparedActions: number;
    preparedActionDispatchJobs: number;
    copilotExecutionReceipts: number;
    copilotExecutionReceiptEvents: number;
    flowEvents: number;
    auditEntries: number;
    copilotReviewDecisions: number;
  };
}

interface CutoverWorkflowManifest {
  generatedAt: string;
  targetEnvironment: "staging" | "production";
  cutoverMode: "merge" | "replace";
  runPostCutoverSmoke: string;
  preflightSmokePath: string;
  cutoverResultPath: string;
  cutoverStderrPath: string;
  approvalContractPath: string;
  reportPath: string;
}

interface BackupDrillManifest {
  generatedAt: string;
  sourceEnvironment: "staging" | "production";
  restoreTarget: "drill" | "staging" | "production";
  backupMode: "logical_pg_dump";
  archiveDestination: "github_artifact_encrypted";
  dumpPath: string;
  dumpSha256Path: string;
  encryptedDumpPath: string;
  encryptedDumpSha256Path: string;
  encryptionMode: "gpg_symmetric";
  encryptionKeyRef: string;
  dumpBytes?: number;
  encryptedDumpBytes?: number;
  retentionDays: number;
  expiresAt: string;
  sourceSmokePath: string;
  sourceInspectPath: string;
  restoreSmokePath: string;
  restoreInspectPath: string;
  backupStartedAt: string;
  backupFinishedAt: string;
  restoreStartedAt: string;
  restoreFinishedAt: string;
}

export interface SmokeFinding {
  severity: "error" | "warning";
  code: string;
  message: string;
  tenantId?: string;
  patientCaseId?: string;
  entityType?: string;
  entityId?: string;
  relatedEntityType?: string;
  relatedEntityId?: string;
}

export interface SmokeReport {
  ok: boolean;
  checkedAt: string;
  counts: {
    tenants: number;
    patients: number;
    cases: number;
    appointments: number;
    callbacks: number;
    queueTickets: number;
    threads: number;
    actions: number;
    approvals: number;
    agentTasks: number;
    preparedActions: number;
    preparedActionDispatchJobs: number;
    copilotExecutionReceipts: number;
    copilotExecutionReceiptEvents: number;
    flowEvents: number;
    links: number;
    reviews: number;
  };
  errors: SmokeFinding[];
  warnings: SmokeFinding[];
}

export interface SmokeGateResult {
  passed: boolean;
  newErrors: SmokeFinding[];
  carriedErrors: SmokeFinding[];
}

export interface CutoverArtifacts {
  directory: string;
  inputBundlePath?: string;
  beforeStatePath?: string;
  afterStatePath?: string;
  reportPath?: string;
}

export interface CutoverApprovalCheck {
  id: string;
  ok: boolean;
  message: string;
}

export interface CutoverApprovalContract {
  ok: boolean;
  validatedAt: string;
  reportPath: string;
  checks: CutoverApprovalCheck[];
}

export interface PromotionChecklistItem {
  id: string;
  title: string;
  status: "passed" | "failed" | "pending";
  message: string;
  evidencePath?: string;
}

export interface CutoverPromotionPacket {
  ok: boolean;
  generatedAt: string;
  label: string;
  sourceEnvironment: "staging" | "production";
  recommendedNextEnvironment: "production" | "completed";
  cutoverMode: "merge" | "replace";
  approvalContract: string;
  summary: {
    preflightSmokeOk: boolean;
    cutoverSmokeGatePassed: boolean;
    approvalContractPassed: boolean;
    postCutoverSmokeOk: boolean | null;
    beforeTotals: StateSummary["totals"] | null;
    afterTotals: StateSummary["totals"] | null;
    postCutoverTotals: StateSummary["totals"] | null;
  };
  evidence: {
    workflowManifestPath: string;
    preflightSmokePath: string | null;
    cutoverResultPath: string | null;
    reportPath: string | null;
    approvalContractPath: string | null;
    postCutoverSmokePath: string | null;
    postCutoverInspectPath: string | null;
  };
  automatedChecks: PromotionChecklistItem[];
  manualChecks: PromotionChecklistItem[];
}

export interface PromotionVerificationCheck {
  id: string;
  ok: boolean;
  message: string;
}

export interface CutoverPromotionVerification {
  ok: boolean;
  validatedAt: string;
  sourceEnvironment: "staging" | "production";
  targetEnvironment: "production" | "completed";
  checks: PromotionVerificationCheck[];
}

export interface CutoverRollbackPacket {
  ok: boolean;
  generatedAt: string;
  label: string;
  sourceEnvironment: "staging" | "production";
  rollbackCommand: string;
  summary: {
    sourceApprovalContractPassed: boolean;
    sourceSmokeGatePassed: boolean;
    sourceAfterSmokeOk: boolean;
    beforeTotals: StateSummary["totals"] | null;
    afterTotals: StateSummary["totals"] | null;
  };
  evidence: {
    workflowManifestPath: string;
    reportPath: string | null;
    approvalContractPath: string | null;
    beforeStatePath: string | null;
    afterStatePath: string | null;
  };
  automatedChecks: PromotionChecklistItem[];
  manualChecks: PromotionChecklistItem[];
}

export interface RollbackVerificationCheck {
  id: string;
  ok: boolean;
  message: string;
}

export interface CutoverRollbackVerification {
  ok: boolean;
  validatedAt: string;
  sourceEnvironment: "staging" | "production";
  checks: RollbackVerificationCheck[];
}

export interface BackupDrillVerificationCheck {
  id: string;
  ok: boolean;
  message: string;
}

export interface CutoverBackupDrillPacket {
  ok: boolean;
  generatedAt: string;
  label: string;
  sourceEnvironment: "staging" | "production";
  backupMode: "logical_pg_dump";
  restoreTarget: "drill" | "staging" | "production";
  archiveDestination: "github_artifact_encrypted";
  summary: {
    sourceSmokeOk: boolean;
    restoreSmokeOk: boolean;
    totalsMatch: boolean;
    measuredRtoSeconds: number;
    estimatedRpoSeconds: number;
    maxRtoSeconds: number;
    maxRpoSeconds: number;
    dumpBytes: number;
    encryptedDumpReady: boolean;
    encryptedDumpBytes: number;
    retentionDays: number;
    expiresAt: string;
    sourceTotals: StateSummary["totals"] | null;
    restoredTotals: StateSummary["totals"] | null;
  };
  evidence: {
    backupManifestPath: string;
    dumpPath: string;
    dumpSha256Path: string;
    dumpSha256: string | null;
    encryptedDumpPath: string;
    encryptedDumpSha256Path: string;
    encryptedDumpSha256: string | null;
    encryptionMode: "gpg_symmetric";
    encryptionKeyRef: string;
    sourceSmokePath: string;
    sourceInspectPath: string;
    restoreSmokePath: string;
    restoreInspectPath: string;
  };
  automatedChecks: PromotionChecklistItem[];
  manualChecks: PromotionChecklistItem[];
}

export interface CutoverBackupDrillVerification {
  ok: boolean;
  validatedAt: string;
  sourceEnvironment: "staging" | "production";
  maxRtoSeconds: number;
  maxRpoSeconds: number;
  checks: BackupDrillVerificationCheck[];
}

export interface CutoverCommandResult {
  command: string;
  inputPath?: string;
  outputPath?: string;
  mode?: "merge" | "replace";
  summary: StateSummary;
  beforeSummary?: StateSummary;
  importStats?: {
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
  smoke?: SmokeReport;
  beforeSmoke?: SmokeReport;
  afterSmoke?: SmokeReport;
  smokeGate?: SmokeGateResult;
  artifacts?: CutoverArtifacts;
  bundleFingerprint?: string;
  startedAt?: string;
  finishedAt?: string;
  approvalContract?: CutoverApprovalContract;
  promotionPacket?: CutoverPromotionPacket;
  promotionVerification?: CutoverPromotionVerification;
  rollbackPacket?: CutoverRollbackPacket;
  rollbackVerification?: CutoverRollbackVerification;
  backupDrillPacket?: CutoverBackupDrillPacket;
  backupDrillVerification?: CutoverBackupDrillVerification;
  state?: BootstrapState;
}

class CutoverCommandError extends Error {
  constructor(
    message: string,
    readonly result?: CutoverCommandResult
  ) {
    super(message);
  }
}

function nowIso(): string {
  return new Date().toISOString();
}

function artifactStamp(): string {
  return nowIso().replace(/[:.]/g, "-");
}

function createEmptyBootstrapState(): BootstrapState {
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

function getIo(io?: Partial<CutoverCliIo>): CutoverCliIo {
  return {
    stdout: io?.stdout ?? ((message) => process.stdout.write(message)),
    stderr: io?.stderr ?? ((message) => process.stderr.write(message))
  };
}

function resolveCliPath(cwd: string, inputPath: string): string {
  return isAbsolute(inputPath) ? inputPath : resolve(cwd, inputPath);
}

function requireDestructivePermission(command: string, allowDestructive: boolean): void {
  if (!allowDestructive) {
    throw new Error(`${command} requires --allow-destructive`);
  }
}

async function ensureParentDirectory(filePath: string): Promise<void> {
  await mkdir(dirname(filePath), { recursive: true });
}

async function writeJsonFile(filePath: string, payload: unknown): Promise<void> {
  await ensureParentDirectory(filePath);
  await writeFile(filePath, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
}

function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

function summarizeState(state: BootstrapState): StateSummary {
  const tenantById = new Map(state.tenantConfigs.map((tenant) => [tenant.id, tenant]));
  const tenants = state.tenantConfigs.map((tenant) => {
    const patients = state.patients.filter((patient) => patient.tenantId === tenant.id);
    const cases = state.patientCases.filter((patientCase) => patientCase.tenantId === tenant.id);
    return {
      tenantId: tenant.id,
      slug: tenant.slug,
      name: tenant.name,
      patients: patients.length,
      cases: cases.length,
      activeCases: cases.filter((patientCase) => patientCase.status !== "closed").length,
      appointments: state.appointments.filter((appointment) => appointment.tenantId === tenant.id).length,
      callbacks: state.callbacks.filter((callback) => callback.tenantId === tenant.id).length,
      queueTickets: state.queueTickets.filter((ticket) => ticket.tenantId === tenant.id).length,
      threads: state.conversationThreads.filter((thread) => thread.tenantId === tenant.id).length,
      actions: state.patientCaseActions.filter((action) => action.tenantId === tenant.id).length,
      approvals: state.patientCaseApprovals.filter((approval) => approval.tenantId === tenant.id).length,
      agentTasks: state.agentTasks.filter((task) => task.tenantId === tenant.id).length,
      preparedActions: state.preparedActions.filter((action) => action.tenantId === tenant.id).length,
      preparedActionDispatchJobs: state.preparedActionDispatchJobs.filter((job) => job.tenantId === tenant.id).length
    };
  });

  for (const patient of state.patients) {
    if (!tenantById.has(patient.tenantId)) {
      tenants.push({
        tenantId: patient.tenantId,
        slug: patient.tenantId,
        name: patient.tenantId,
        patients: state.patients.filter((candidate) => candidate.tenantId === patient.tenantId).length,
        cases: state.patientCases.filter((candidate) => candidate.tenantId === patient.tenantId).length,
        activeCases: state.patientCases.filter(
          (candidate) => candidate.tenantId === patient.tenantId && candidate.status !== "closed"
        ).length,
        appointments: state.appointments.filter((candidate) => candidate.tenantId === patient.tenantId).length,
        callbacks: state.callbacks.filter((candidate) => candidate.tenantId === patient.tenantId).length,
        queueTickets: state.queueTickets.filter((candidate) => candidate.tenantId === patient.tenantId).length,
        threads: state.conversationThreads.filter((candidate) => candidate.tenantId === patient.tenantId).length,
        actions: state.patientCaseActions.filter((candidate) => candidate.tenantId === patient.tenantId).length,
        approvals: state.patientCaseApprovals.filter((candidate) => candidate.tenantId === patient.tenantId).length,
        agentTasks: state.agentTasks.filter((candidate) => candidate.tenantId === patient.tenantId).length,
        preparedActions: state.preparedActions.filter((candidate) => candidate.tenantId === patient.tenantId).length,
        preparedActionDispatchJobs: state.preparedActionDispatchJobs.filter(
          (candidate) => candidate.tenantId === patient.tenantId
        ).length
      });
      tenantById.set(patient.tenantId, {
        id: patient.tenantId,
        slug: patient.tenantId,
        name: patient.tenantId,
        timezone: "UTC",
        brandColor: "#000000",
        enabledChannels: [],
        credentialRefs: [],
        createdAt: patient.createdAt
      });
    }
  }

  return {
    tenants: tenants.sort((left, right) => left.tenantId.localeCompare(right.tenantId)),
    totals: {
      tenants: state.tenantConfigs.length,
      locations: state.locations.length,
      staffUsers: state.staffUsers.length,
      patients: state.patients.length,
      cases: state.patientCases.length,
      activeCases: state.patientCases.filter((patientCase) => patientCase.status !== "closed").length,
      appointments: state.appointments.length,
      callbacks: state.callbacks.length,
      queueTickets: state.queueTickets.length,
      threads: state.conversationThreads.length,
      actions: state.patientCaseActions.length,
      approvals: state.patientCaseApprovals.length,
      agentTasks: state.agentTasks.length,
      preparedActions: state.preparedActions.length,
      preparedActionDispatchJobs: state.preparedActionDispatchJobs.length,
      copilotExecutionReceipts: state.copilotExecutionReceipts.length,
      copilotExecutionReceiptEvents: state.copilotExecutionReceiptEvents.length,
      flowEvents: state.flowEvents.length,
      auditEntries: state.auditEntries.length,
      copilotReviewDecisions: state.copilotReviewDecisions.length
    }
  };
}

function groupByCase<T extends { patientCaseId: string }>(items: T[]): Map<string, T[]> {
  const grouped = new Map<string, T[]>();
  for (const item of items) {
    const bucket = grouped.get(item.patientCaseId);
    if (bucket) {
      bucket.push(item);
    } else {
      grouped.set(item.patientCaseId, [item]);
    }
  }
  return grouped;
}

function findingKey(finding: SmokeFinding): string {
  return [
    finding.code,
    finding.tenantId ?? "",
    finding.patientCaseId ?? "",
    finding.entityType ?? "",
    finding.entityId ?? "",
    finding.relatedEntityType ?? "",
    finding.relatedEntityId ?? ""
  ].join("|");
}

function smokeState(state: BootstrapState): SmokeReport {
  const errors: SmokeFinding[] = [];
  const warnings: SmokeFinding[] = [];

  const pushFinding = (
    severity: SmokeFinding["severity"],
    code: string,
    message: string,
    context: Omit<SmokeFinding, "severity" | "code" | "message"> = {}
  ): void => {
    const finding: SmokeFinding = {
      severity,
      code,
      message,
      ...context
    };
    if (severity === "error") {
      errors.push(finding);
    } else {
      warnings.push(finding);
    }
  };

  const tenantIds = new Set(state.tenantConfigs.map((tenant) => tenant.id));
  const patientById = new Map(state.patients.map((patient) => [patient.id, patient]));
  const caseById = new Map(state.patientCases.map((patientCase) => [patientCase.id, patientCase]));
  const appointmentById = new Map(state.appointments.map((appointment) => [appointment.id, appointment]));
  const callbackById = new Map(state.callbacks.map((callback) => [callback.id, callback]));
  const queueTicketById = new Map(state.queueTickets.map((ticket) => [ticket.id, ticket]));
  const threadById = new Map(state.conversationThreads.map((thread) => [thread.id, thread]));
  const agentTaskById = new Map(state.agentTasks.map((task) => [task.id, task]));
  const preparedActionById = new Map(state.preparedActions.map((preparedAction) => [preparedAction.id, preparedAction]));
  const flowEventById = new Map(state.flowEvents.map((event) => [event.id, event]));
  const reviewById = new Map(state.copilotReviewDecisions.map((review) => [review.id, review]));

  const appointmentsByCase = groupByCase(state.appointments);
  const callbacksByCase = groupByCase(state.callbacks);
  const threadsByCase = groupByCase(state.conversationThreads);
  const actionsByCase = groupByCase(state.patientCaseActions);
  const approvalsByCase = groupByCase(state.patientCaseApprovals);

  const activeCasesByPatient = new Map<string, string[]>();
  for (const patientCase of state.patientCases) {
    const key = `${patientCase.tenantId}:${patientCase.patientId}`;
    if (patientCase.status !== "closed") {
      const bucket = activeCasesByPatient.get(key);
      if (bucket) {
        bucket.push(patientCase.id);
      } else {
        activeCasesByPatient.set(key, [patientCase.id]);
      }
    }
  }

  for (const patient of state.patients) {
    if (!tenantIds.has(patient.tenantId)) {
      pushFinding("error", "tenant.missing", "Patient references a missing tenant.", {
        tenantId: patient.tenantId,
        entityType: "patient",
        entityId: patient.id
      });
    }
  }

  for (const patientCase of state.patientCases) {
    if (!tenantIds.has(patientCase.tenantId)) {
      pushFinding("error", "tenant.missing", "Patient case references a missing tenant.", {
        tenantId: patientCase.tenantId,
        patientCaseId: patientCase.id,
        entityType: "patient_case",
        entityId: patientCase.id
      });
    }

    const patient = patientById.get(patientCase.patientId);
    if (!patient) {
      pushFinding("error", "case.patient_missing", "Patient case references a missing patient.", {
        tenantId: patientCase.tenantId,
        patientCaseId: patientCase.id,
        entityType: "patient_case",
        entityId: patientCase.id,
        relatedEntityType: "patient",
        relatedEntityId: patientCase.patientId
      });
    } else if (patient.tenantId !== patientCase.tenantId) {
      pushFinding("error", "case.patient_tenant_mismatch", "Patient case tenant does not match patient tenant.", {
        tenantId: patientCase.tenantId,
        patientCaseId: patientCase.id,
        entityType: "patient_case",
        entityId: patientCase.id,
        relatedEntityType: "patient",
        relatedEntityId: patient.id
      });
    }

    const openActions = (actionsByCase.get(patientCase.id) ?? []).filter(
      (action) => action.status === "pending" || action.status === "blocked"
    ).length;
    if (patientCase.summary.openActionCount !== openActions) {
      pushFinding("error", "case.summary.open_actions_mismatch", "Case summary openActionCount does not match canonical actions.", {
        tenantId: patientCase.tenantId,
        patientCaseId: patientCase.id,
        entityType: "patient_case",
        entityId: patientCase.id
      });
    }

    const pendingApprovals = (approvalsByCase.get(patientCase.id) ?? []).filter(
      (approval) => approval.status === "pending"
    ).length;
    if (patientCase.summary.pendingApprovalCount !== pendingApprovals) {
      pushFinding("error", "case.summary.pending_approvals_mismatch", "Case summary pendingApprovalCount does not match canonical approvals.", {
        tenantId: patientCase.tenantId,
        patientCaseId: patientCase.id,
        entityType: "patient_case",
        entityId: patientCase.id
      });
    }

    const caseAppointments = appointmentsByCase.get(patientCase.id) ?? [];
    const caseThreads = threadsByCase.get(patientCase.id) ?? [];
    const caseCallbacks = callbacksByCase.get(patientCase.id) ?? [];

    if (patientCase.summary.primaryAppointmentId) {
      const primaryAppointment = appointmentById.get(patientCase.summary.primaryAppointmentId);
      if (!primaryAppointment || primaryAppointment.patientCaseId !== patientCase.id) {
        pushFinding("error", "case.summary.primary_appointment_missing", "Case summary primaryAppointmentId does not resolve inside the same case.", {
          tenantId: patientCase.tenantId,
          patientCaseId: patientCase.id,
          entityType: "patient_case",
          entityId: patientCase.id,
          relatedEntityType: "appointment",
          relatedEntityId: patientCase.summary.primaryAppointmentId
        });
      }
    } else if (caseAppointments.length > 0) {
      pushFinding("warning", "case.summary.primary_appointment_empty", "Case has appointments but summary.primaryAppointmentId is empty.", {
        tenantId: patientCase.tenantId,
        patientCaseId: patientCase.id,
        entityType: "patient_case",
        entityId: patientCase.id
      });
    }

    if (patientCase.summary.latestAppointmentId) {
      const latestAppointment = appointmentById.get(patientCase.summary.latestAppointmentId);
      if (!latestAppointment || latestAppointment.patientCaseId !== patientCase.id) {
        pushFinding("error", "case.summary.latest_appointment_missing", "Case summary latestAppointmentId does not resolve inside the same case.", {
          tenantId: patientCase.tenantId,
          patientCaseId: patientCase.id,
          entityType: "patient_case",
          entityId: patientCase.id,
          relatedEntityType: "appointment",
          relatedEntityId: patientCase.summary.latestAppointmentId
        });
      }
    }

    if (patientCase.summary.latestThreadId) {
      const latestThread = threadById.get(patientCase.summary.latestThreadId);
      if (!latestThread || latestThread.patientCaseId !== patientCase.id) {
        pushFinding("error", "case.summary.latest_thread_missing", "Case summary latestThreadId does not resolve inside the same case.", {
          tenantId: patientCase.tenantId,
          patientCaseId: patientCase.id,
          entityType: "patient_case",
          entityId: patientCase.id,
          relatedEntityType: "conversation_thread",
          relatedEntityId: patientCase.summary.latestThreadId
        });
      }
    } else if (caseThreads.length > 0) {
      pushFinding("warning", "case.summary.latest_thread_empty", "Case has threads but summary.latestThreadId is empty.", {
        tenantId: patientCase.tenantId,
        patientCaseId: patientCase.id,
        entityType: "patient_case",
        entityId: patientCase.id
      });
    }

    if (patientCase.summary.latestCallbackId) {
      const latestCallback = callbackById.get(patientCase.summary.latestCallbackId);
      if (!latestCallback || latestCallback.patientCaseId !== patientCase.id) {
        pushFinding("error", "case.summary.latest_callback_missing", "Case summary latestCallbackId does not resolve inside the same case.", {
          tenantId: patientCase.tenantId,
          patientCaseId: patientCase.id,
          entityType: "patient_case",
          entityId: patientCase.id,
          relatedEntityType: "callback",
          relatedEntityId: patientCase.summary.latestCallbackId
        });
      }
    } else if (caseCallbacks.length > 0) {
      pushFinding("warning", "case.summary.latest_callback_empty", "Case has callbacks but summary.latestCallbackId is empty.", {
        tenantId: patientCase.tenantId,
        patientCaseId: patientCase.id,
        entityType: "patient_case",
        entityId: patientCase.id
      });
    }

    if (patientCase.status === "closed" && !patientCase.closedAt) {
      pushFinding("warning", "case.closed_missing_timestamp", "Closed case does not have closedAt.", {
        tenantId: patientCase.tenantId,
        patientCaseId: patientCase.id,
        entityType: "patient_case",
        entityId: patientCase.id
      });
    }

    if (patientCase.status !== "closed" && patientCase.closedAt) {
      pushFinding("warning", "case.open_has_closed_timestamp", "Open case still carries closedAt.", {
        tenantId: patientCase.tenantId,
        patientCaseId: patientCase.id,
        entityType: "patient_case",
        entityId: patientCase.id
      });
    }
  }

  for (const [key, caseIds] of activeCasesByPatient.entries()) {
    if (caseIds.length > 1) {
      const tenantId = key.split(":")[0] ?? "";
      pushFinding("error", "case.duplicate_active", "More than one active patient case exists for the same tenant and patient.", {
        tenantId,
        entityType: "patient_case",
        entityId: caseIds.join(",")
      });
    }
  }

  for (const appointment of state.appointments) {
    const patientCase = caseById.get(appointment.patientCaseId);
    const patient = patientById.get(appointment.patientId);
    if (!tenantIds.has(appointment.tenantId)) {
      pushFinding("error", "tenant.missing", "Appointment references a missing tenant.", {
        tenantId: appointment.tenantId,
        entityType: "appointment",
        entityId: appointment.id
      });
    }
    if (!patientCase) {
      pushFinding("error", "appointment.case_missing", "Appointment references a missing patient case.", {
        tenantId: appointment.tenantId,
        entityType: "appointment",
        entityId: appointment.id,
        relatedEntityType: "patient_case",
        relatedEntityId: appointment.patientCaseId
      });
    } else if (patientCase.tenantId !== appointment.tenantId) {
      pushFinding("error", "appointment.case_tenant_mismatch", "Appointment tenant does not match patient case tenant.", {
        tenantId: appointment.tenantId,
        patientCaseId: patientCase.id,
        entityType: "appointment",
        entityId: appointment.id
      });
    }
    if (!patient) {
      pushFinding("error", "appointment.patient_missing", "Appointment references a missing patient.", {
        tenantId: appointment.tenantId,
        entityType: "appointment",
        entityId: appointment.id,
        relatedEntityType: "patient",
        relatedEntityId: appointment.patientId
      });
    } else if (patient.tenantId !== appointment.tenantId) {
      pushFinding("error", "appointment.patient_tenant_mismatch", "Appointment tenant does not match patient tenant.", {
        tenantId: appointment.tenantId,
        entityType: "appointment",
        entityId: appointment.id,
        relatedEntityType: "patient",
        relatedEntityId: appointment.patientId
      });
    }
    if (patientCase && patientCase.patientId !== appointment.patientId) {
      pushFinding("error", "appointment.patient_case_patient_mismatch", "Appointment patientId does not match the patient case patientId.", {
        tenantId: appointment.tenantId,
        patientCaseId: appointment.patientCaseId,
        entityType: "appointment",
        entityId: appointment.id,
        relatedEntityType: "patient",
        relatedEntityId: appointment.patientId
      });
    }
  }

  for (const callback of state.callbacks) {
    const patientCase = caseById.get(callback.patientCaseId);
    const patient = patientById.get(callback.patientId);
    if (!patientCase) {
      pushFinding("error", "callback.case_missing", "Callback references a missing patient case.", {
        tenantId: callback.tenantId,
        entityType: "callback",
        entityId: callback.id,
        relatedEntityType: "patient_case",
        relatedEntityId: callback.patientCaseId
      });
    }
    if (!patient) {
      pushFinding("error", "callback.patient_missing", "Callback references a missing patient.", {
        tenantId: callback.tenantId,
        entityType: "callback",
        entityId: callback.id,
        relatedEntityType: "patient",
        relatedEntityId: callback.patientId
      });
    }
    if (patientCase && patientCase.patientId !== callback.patientId) {
      pushFinding("error", "callback.patient_case_patient_mismatch", "Callback patientId does not match the patient case patientId.", {
        tenantId: callback.tenantId,
        patientCaseId: callback.patientCaseId,
        entityType: "callback",
        entityId: callback.id,
        relatedEntityType: "patient",
        relatedEntityId: callback.patientId
      });
    }
  }

  for (const ticket of state.queueTickets) {
    const patientCase = caseById.get(ticket.patientCaseId);
    if (!patientCase) {
      pushFinding("error", "queue_ticket.case_missing", "Queue ticket references a missing patient case.", {
        tenantId: ticket.tenantId,
        entityType: "queue_ticket",
        entityId: ticket.id,
        relatedEntityType: "patient_case",
        relatedEntityId: ticket.patientCaseId
      });
    }
    if (ticket.appointmentId) {
      const appointment = appointmentById.get(ticket.appointmentId);
      if (!appointment) {
        pushFinding("error", "queue_ticket.appointment_missing", "Queue ticket references a missing appointment.", {
          tenantId: ticket.tenantId,
          patientCaseId: ticket.patientCaseId,
          entityType: "queue_ticket",
          entityId: ticket.id,
          relatedEntityType: "appointment",
          relatedEntityId: ticket.appointmentId
        });
      } else if (appointment.patientCaseId !== ticket.patientCaseId) {
        pushFinding("error", "queue_ticket.appointment_case_mismatch", "Queue ticket appointment belongs to a different patient case.", {
          tenantId: ticket.tenantId,
          patientCaseId: ticket.patientCaseId,
          entityType: "queue_ticket",
          entityId: ticket.id,
          relatedEntityType: "appointment",
          relatedEntityId: ticket.appointmentId
        });
      }
    }
  }

  for (const thread of state.conversationThreads) {
    const patientCase = caseById.get(thread.patientCaseId);
    if (!patientCase) {
      pushFinding("error", "thread.case_missing", "Conversation thread references a missing patient case.", {
        tenantId: thread.tenantId,
        entityType: "conversation_thread",
        entityId: thread.id,
        relatedEntityType: "patient_case",
        relatedEntityId: thread.patientCaseId
      });
    }
    if (thread.appointmentId) {
      const appointment = appointmentById.get(thread.appointmentId);
      if (!appointment) {
        pushFinding("error", "thread.appointment_missing", "Conversation thread references a missing appointment.", {
          tenantId: thread.tenantId,
          patientCaseId: thread.patientCaseId,
          entityType: "conversation_thread",
          entityId: thread.id,
          relatedEntityType: "appointment",
          relatedEntityId: thread.appointmentId
        });
      } else if (appointment.patientCaseId !== thread.patientCaseId) {
        pushFinding("error", "thread.appointment_case_mismatch", "Conversation thread appointment belongs to a different patient case.", {
          tenantId: thread.tenantId,
          patientCaseId: thread.patientCaseId,
          entityType: "conversation_thread",
          entityId: thread.id,
          relatedEntityType: "appointment",
          relatedEntityId: thread.appointmentId
        });
      }
    }
  }

  for (const task of state.agentTasks) {
    const patientCase = caseById.get(task.patientCaseId);
    if (!patientCase) {
      pushFinding("error", "agent_task.case_missing", "Agent task references a missing patient case.", {
        tenantId: task.tenantId,
        entityType: "agent_task",
        entityId: task.id,
        relatedEntityType: "patient_case",
        relatedEntityId: task.patientCaseId
      });
    }
    if (task.appointmentId) {
      const appointment = appointmentById.get(task.appointmentId);
      if (!appointment) {
        pushFinding("error", "agent_task.appointment_missing", "Agent task references a missing appointment.", {
          tenantId: task.tenantId,
          patientCaseId: task.patientCaseId,
          entityType: "agent_task",
          entityId: task.id,
          relatedEntityType: "appointment",
          relatedEntityId: task.appointmentId
        });
      } else if (appointment.patientCaseId !== task.patientCaseId) {
        pushFinding("error", "agent_task.appointment_case_mismatch", "Agent task appointment belongs to a different patient case.", {
          tenantId: task.tenantId,
          patientCaseId: task.patientCaseId,
          entityType: "agent_task",
          entityId: task.id,
          relatedEntityType: "appointment",
          relatedEntityId: task.appointmentId
        });
      }
    }
  }

  for (const action of state.patientCaseActions) {
    if (!caseById.has(action.patientCaseId)) {
      pushFinding("error", "case_action.case_missing", "Patient case action references a missing patient case.", {
        tenantId: action.tenantId,
        patientCaseId: action.patientCaseId,
        entityType: "patient_case_action",
        entityId: action.id
      });
    }
  }

  for (const approval of state.patientCaseApprovals) {
    if (!caseById.has(approval.patientCaseId)) {
      pushFinding("error", "approval.case_missing", "Patient case approval references a missing patient case.", {
        tenantId: approval.tenantId,
        patientCaseId: approval.patientCaseId,
        entityType: "patient_case_approval",
        entityId: approval.id
      });
    }
  }

  for (const event of state.patientCaseTimelineEvents) {
    if (!caseById.has(event.patientCaseId)) {
      pushFinding("error", "timeline.case_missing", "Timeline event references a missing patient case.", {
        tenantId: event.tenantId,
        patientCaseId: event.patientCaseId,
        entityType: "patient_case_timeline_event",
        entityId: event.id
      });
    }
  }

  for (const event of state.flowEvents) {
    if (!caseById.has(event.patientCaseId)) {
      pushFinding("error", "flow_event.case_missing", "Flow event references a missing patient case.", {
        tenantId: event.tenantId,
        patientCaseId: event.patientCaseId,
        entityType: "flow_event",
        entityId: event.id
      });
    }
    if (event.appointmentId) {
      const appointment = appointmentById.get(event.appointmentId);
      if (!appointment) {
        pushFinding("error", "flow_event.appointment_missing", "Flow event references a missing appointment.", {
          tenantId: event.tenantId,
          patientCaseId: event.patientCaseId,
          entityType: "flow_event",
          entityId: event.id,
          relatedEntityType: "appointment",
          relatedEntityId: event.appointmentId
        });
      } else if (appointment.patientCaseId !== event.patientCaseId) {
        pushFinding("error", "flow_event.appointment_case_mismatch", "Flow event appointment belongs to a different patient case.", {
          tenantId: event.tenantId,
          patientCaseId: event.patientCaseId,
          entityType: "flow_event",
          entityId: event.id,
          relatedEntityType: "appointment",
          relatedEntityId: event.appointmentId
        });
      }
    }
  }

  for (const preparedAction of state.preparedActions) {
    if (!caseById.has(preparedAction.patientCaseId)) {
      pushFinding("error", "prepared_action.case_missing", "Prepared action references a missing patient case.", {
        tenantId: preparedAction.tenantId,
        patientCaseId: preparedAction.patientCaseId,
        entityType: "prepared_action",
        entityId: preparedAction.id
      });
    }
  }

  for (const dispatchJob of state.preparedActionDispatchJobs) {
    const patientCase = caseById.get(dispatchJob.patientCaseId);
    const preparedAction = preparedActionById.get(dispatchJob.preparedActionId);
    if (!patientCase) {
      pushFinding("error", "prepared_dispatch.case_missing", "Prepared action dispatch job references a missing patient case.", {
        tenantId: dispatchJob.tenantId,
        patientCaseId: dispatchJob.patientCaseId,
        entityType: "prepared_action_dispatch",
        entityId: dispatchJob.id
      });
    }
    if (!preparedAction) {
      pushFinding("error", "prepared_dispatch.prepared_action_missing", "Prepared action dispatch job references a missing prepared action.", {
        tenantId: dispatchJob.tenantId,
        patientCaseId: dispatchJob.patientCaseId,
        entityType: "prepared_action_dispatch",
        entityId: dispatchJob.id,
        relatedEntityType: "prepared_action",
        relatedEntityId: dispatchJob.preparedActionId
      });
    } else if (preparedAction.patientCaseId !== dispatchJob.patientCaseId) {
      pushFinding("error", "prepared_dispatch.case_mismatch", "Prepared action dispatch job points to a prepared action from another patient case.", {
        tenantId: dispatchJob.tenantId,
        patientCaseId: dispatchJob.patientCaseId,
        entityType: "prepared_action_dispatch",
        entityId: dispatchJob.id,
        relatedEntityType: "prepared_action",
        relatedEntityId: dispatchJob.preparedActionId
      });
    }
    if (dispatchJob.attempt < 1) {
      pushFinding("error", "prepared_dispatch.invalid_attempt", "Prepared action dispatch attempt must be >= 1.", {
        tenantId: dispatchJob.tenantId,
        patientCaseId: dispatchJob.patientCaseId,
        entityType: "prepared_action_dispatch",
        entityId: dispatchJob.id
      });
    }
  }

  for (const review of state.copilotReviewDecisions) {
    if (!caseById.has(review.patientCaseId)) {
      pushFinding("error", "copilot_review.case_missing", "Copilot review references a missing patient case.", {
        tenantId: review.tenantId,
        patientCaseId: review.patientCaseId,
        entityType: "copilot_review",
        entityId: review.id
      });
    }
    if (review.preparedActionId && !preparedActionById.has(review.preparedActionId)) {
      pushFinding("warning", "copilot_review.prepared_action_missing", "Copilot review points to a prepared action that no longer exists.", {
        tenantId: review.tenantId,
        patientCaseId: review.patientCaseId,
        entityType: "copilot_review",
        entityId: review.id,
        relatedEntityType: "prepared_action",
        relatedEntityId: review.preparedActionId
      });
    }
  }

  for (const link of state.patientCaseLinks) {
    if (!caseById.has(link.patientCaseId)) {
      pushFinding("error", "case_link.case_missing", "Patient case link references a missing patient case.", {
        tenantId: link.tenantId,
        patientCaseId: link.patientCaseId,
        entityType: "patient_case_link",
        entityId: link.id
      });
      continue;
    }

    const exists =
      (link.entityType === "appointment" && appointmentById.has(link.entityId)) ||
      (link.entityType === "queue_ticket" && queueTicketById.has(link.entityId)) ||
      (link.entityType === "conversation_thread" && threadById.has(link.entityId)) ||
      (link.entityType === "agent_task" && agentTaskById.has(link.entityId)) ||
      (link.entityType === "prepared_action" && preparedActionById.has(link.entityId)) ||
      (link.entityType === "prepared_action_dispatch" &&
        state.preparedActionDispatchJobs.some((job) => job.id === link.entityId)) ||
      (link.entityType === "flow_event" && flowEventById.has(link.entityId)) ||
      (link.entityType === "callback" && callbackById.has(link.entityId)) ||
      (link.entityType === "copilot_review" && reviewById.has(link.entityId));

    if (!exists && link.entityType !== "telemedicine_intake") {
      pushFinding("warning", "case_link.entity_missing", "Patient case link points to an entity that is not present in canonical storage.", {
        tenantId: link.tenantId,
        patientCaseId: link.patientCaseId,
        entityType: "patient_case_link",
        entityId: link.id,
        relatedEntityType: link.entityType,
        relatedEntityId: link.entityId
      });
    }
  }

  return {
    ok: errors.length === 0,
    checkedAt: nowIso(),
    counts: {
      tenants: state.tenantConfigs.length,
      patients: state.patients.length,
      cases: state.patientCases.length,
      appointments: state.appointments.length,
      callbacks: state.callbacks.length,
      queueTickets: state.queueTickets.length,
      threads: state.conversationThreads.length,
      actions: state.patientCaseActions.length,
      approvals: state.patientCaseApprovals.length,
      agentTasks: state.agentTasks.length,
      preparedActions: state.preparedActions.length,
      preparedActionDispatchJobs: state.preparedActionDispatchJobs.length,
      copilotExecutionReceipts: state.copilotExecutionReceipts.length,
      copilotExecutionReceiptEvents: state.copilotExecutionReceiptEvents.length,
      flowEvents: state.flowEvents.length,
      links: state.patientCaseLinks.length,
      reviews: state.copilotReviewDecisions.length
    },
    errors,
    warnings
  };
}

function compareSmoke(before: SmokeReport, after: SmokeReport): SmokeGateResult {
  const beforeKeys = new Set(before.errors.map(findingKey));
  const newErrors = after.errors.filter((finding) => !beforeKeys.has(findingKey(finding)));
  const carriedErrors = after.errors.filter((finding) => beforeKeys.has(findingKey(finding)));
  return {
    passed: newErrors.length === 0,
    newErrors,
    carriedErrors
  };
}

function renderSmokeLine(label: string, smoke: SmokeReport | undefined): string | null {
  if (!smoke) {
    return null;
  }
  return `${label}: ${smoke.ok ? "ok" : `errors=${smoke.errors.length}, warnings=${smoke.warnings.length}`}`;
}

async function pathExists(filePath: string | null | undefined): Promise<boolean> {
  if (!filePath) {
    return false;
  }
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function buildApprovalContract(
  reportPath: string,
  report: Partial<CutoverCommandResult>
): Promise<CutoverApprovalContract> {
  const checks: CutoverApprovalCheck[] = [];
  const pushCheck = (id: string, ok: boolean, message: string): void => {
    checks.push({ id, ok, message });
  };

  pushCheck(
    "report.command_cutover_openclaw",
    report.command === "cutover-openclaw",
    "Report must come from the cutover-openclaw command."
  );
  pushCheck(
    "report.mode_present",
    report.mode === "merge" || report.mode === "replace",
    "Report must include the cutover mode."
  );
  pushCheck(
    "report.timestamps_present",
    typeof report.startedAt === "string" && typeof report.finishedAt === "string",
    "Report must include startedAt and finishedAt timestamps."
  );
  pushCheck(
    "report.bundle_fingerprint_present",
    typeof report.bundleFingerprint === "string" && report.bundleFingerprint.length > 0,
    "Report must include the imported bundle fingerprint."
  );
  pushCheck(
    "report.before_smoke_present",
    typeof report.beforeSmoke === "object" && report.beforeSmoke !== null,
    "Report must include the pre-cutover smoke result."
  );
  pushCheck(
    "report.after_smoke_present",
    typeof report.afterSmoke === "object" && report.afterSmoke !== null,
    "Report must include the post-cutover smoke result."
  );
  pushCheck(
    "report.after_smoke_ok",
    report.afterSmoke?.ok === true,
    "Post-cutover smoke must be green."
  );
  pushCheck(
    "report.smoke_gate_present",
    typeof report.smokeGate === "object" && report.smokeGate !== null,
    "Report must include the smoke gate comparison."
  );
  pushCheck(
    "report.smoke_gate_passed",
    report.smokeGate?.passed === true,
    "Smoke gate must pass without introducing new canonical errors."
  );
  pushCheck(
    "report.summary_present",
    typeof report.summary === "object" && report.summary !== null,
    "Report must include the canonical after-cutover summary."
  );
  pushCheck(
    "report.before_summary_present",
    typeof report.beforeSummary === "object" && report.beforeSummary !== null,
    "Report must include the canonical before-cutover summary."
  );

  const artifacts = report.artifacts;
  pushCheck(
    "artifacts.directory_present",
    typeof artifacts?.directory === "string" && artifacts.directory.length > 0,
    "Artifacts directory must be recorded."
  );
  pushCheck(
    "artifacts.input_bundle_exists",
    await pathExists(artifacts?.inputBundlePath),
    "Copied input bundle artifact must exist on disk."
  );
  pushCheck(
    "artifacts.before_state_exists",
    await pathExists(artifacts?.beforeStatePath),
    "Before-state artifact must exist on disk."
  );
  pushCheck(
    "artifacts.after_state_exists",
    await pathExists(artifacts?.afterStatePath),
    "After-state artifact must exist on disk."
  );
  pushCheck(
    "artifacts.report_exists",
    await pathExists(artifacts?.reportPath ?? reportPath),
    "Report artifact must exist on disk."
  );

  return {
    ok: checks.every((check) => check.ok),
    validatedAt: nowIso(),
    reportPath,
    checks
  };
}

async function readJsonIfExists<T>(filePath: string | undefined): Promise<T | null> {
  if (!(await pathExists(filePath))) {
    return null;
  }
  return JSON.parse(await readFile(filePath!, "utf8")) as T;
}

async function writeMarkdownFile(filePath: string, content: string): Promise<void> {
  await ensureParentDirectory(filePath);
  await writeFile(filePath, `${content.trimEnd()}\n`, "utf8");
}

function secondsBetween(startedAt: string, finishedAt: string): number {
  const delta = new Date(finishedAt).getTime() - new Date(startedAt).getTime();
  return Number.isFinite(delta) ? Math.max(0, Math.round(delta / 1000)) : 0;
}

function parsePositiveIntegerFlag(
  rawValue: string | undefined,
  flagName: string,
  defaultValue: number
): number {
  if (!rawValue) {
    return defaultValue;
  }
  const parsed = Number.parseInt(rawValue, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new Error(`${flagName} must be a positive integer`);
  }
  return parsed;
}

async function readSha256File(filePath: string | null | undefined): Promise<string | null> {
  if (!(await pathExists(filePath))) {
    return null;
  }
  const content = (await readFile(filePath!, "utf8")).trim();
  const checksum = content.split(/\s+/)[0] ?? "";
  return checksum.length > 0 ? checksum : null;
}

function renderPromotionChecklist(items: PromotionChecklistItem[]): string[] {
  return items.map((item) => {
    const marker = item.status === "passed" ? "[x]" : "[ ]";
    const evidenceLine = item.evidencePath ? `\n- evidence: \`${item.evidencePath}\`` : "";
    return `${marker} ${item.title}\n- status: ${item.status}\n- message: ${item.message}${evidenceLine}`;
  });
}

async function buildPromotionPacket(params: {
  manifestPath: string;
  postCutoverSmokePath?: string;
  postCutoverInspectPath?: string;
  label: string;
  sourceEnvironment: "staging" | "production";
}): Promise<CutoverPromotionPacket> {
  const manifest = JSON.parse(await readFile(params.manifestPath, "utf8")) as CutoverWorkflowManifest;
  const report = await readJsonIfExists<CutoverCommandResult>(manifest.reportPath);
  const approval = await readJsonIfExists<CutoverCommandResult>(manifest.approvalContractPath);
  const preflight = await readJsonIfExists<CutoverCommandResult>(manifest.preflightSmokePath);
  const postSmoke = await readJsonIfExists<CutoverCommandResult>(params.postCutoverSmokePath);
  const postInspect = await readJsonIfExists<CutoverCommandResult>(params.postCutoverInspectPath);

  const automatedChecks: PromotionChecklistItem[] = [
    {
      id: "preflight_smoke",
      title: "Preflight smoke was green before the cutover",
      status: preflight?.smoke?.ok === true ? "passed" : "failed",
      message: preflight?.smoke?.ok === true
        ? "Canonical state started clean before import."
        : "Preflight smoke is missing or reported invariant errors.",
      evidencePath: manifest.preflightSmokePath
    },
    {
      id: "cutover_smoke_gate",
      title: "Cutover report did not introduce new canonical errors",
      status: report?.smokeGate?.passed === true ? "passed" : "failed",
      message: report?.smokeGate?.passed === true
        ? "Smoke gate passed without new errors."
        : "Smoke gate failed or cutover report is missing.",
      evidencePath: manifest.reportPath || manifest.cutoverResultPath
    },
    {
      id: "approval_contract",
      title: "Approval contract validated the report and artifact set",
      status: approval?.approvalContract?.ok === true ? "passed" : "failed",
      message: approval?.approvalContract?.ok === true
        ? "Approval contract passed."
        : "Approval contract failed or is missing.",
      evidencePath: manifest.approvalContractPath
    },
    {
      id: "post_cutover_smoke",
      title: "Post-cutover smoke stayed green on the external database",
      status:
        typeof params.postCutoverSmokePath === "string"
          ? postSmoke?.smoke?.ok === true
            ? "passed"
            : "failed"
          : "pending",
      message:
        typeof params.postCutoverSmokePath === "string"
          ? postSmoke?.smoke?.ok === true
            ? "Post-cutover smoke passed."
            : "Post-cutover smoke failed or is missing."
          : "No post-cutover smoke artifact was supplied.",
      evidencePath: params.postCutoverSmokePath
    }
  ];

  const manualChecks: PromotionChecklistItem[] = [
    {
      id: "review_diff",
      title: "Review before-state vs after-state delta",
      status: "pending",
      message: "Confirm the tenant/case delta matches the approved OpenClaw bundle scope.",
      evidencePath: report?.artifacts?.beforeStatePath && report?.artifacts?.afterStatePath
        ? `${report.artifacts.beforeStatePath} -> ${report.artifacts.afterStatePath}`
        : undefined
    },
    {
      id: "review_approvals",
      title: "Review pending approvals and actions introduced by the cutover",
      status: "pending",
      message: "Confirm pending approvals/actions are operationally expected before promotion.",
      evidencePath: manifest.reportPath || manifest.cutoverResultPath
    },
    {
      id: "confirm_environment_secret",
      title: "Confirm PATIENT_FLOW_OS_DATABASE_URL is configured in the next environment",
      status: "pending",
      message: "Next environment must point to the intended Postgres target before running promotion."
    },
    {
      id: "confirm_replace_policy",
      title: "Confirm destructive replace policy if production will use replace mode",
      status: "pending",
      message: manifest.cutoverMode === "replace"
        ? "Current packet used replace mode; production reviewers must explicitly re-approve destructive import."
        : "Current packet used merge mode; confirm production should not switch to replace without a new approval."
    }
  ];

  return {
    ok: automatedChecks.every((check) => check.status === "passed"),
    generatedAt: nowIso(),
    label: params.label,
    sourceEnvironment: params.sourceEnvironment,
    recommendedNextEnvironment:
      params.sourceEnvironment === "staging" ? "production" : "completed",
    cutoverMode: manifest.cutoverMode,
    approvalContract: "preflight_smoke + cutover_openclaw + verify_report + post_cutover_smoke",
    summary: {
      preflightSmokeOk: preflight?.smoke?.ok === true,
      cutoverSmokeGatePassed: report?.smokeGate?.passed === true,
      approvalContractPassed: approval?.approvalContract?.ok === true,
      postCutoverSmokeOk:
        typeof params.postCutoverSmokePath === "string"
          ? postSmoke?.smoke?.ok === true
          : null,
      beforeTotals: report?.beforeSummary?.totals ?? null,
      afterTotals: report?.summary?.totals ?? null,
      postCutoverTotals: postInspect?.summary?.totals ?? null
    },
    evidence: {
      workflowManifestPath: params.manifestPath,
      preflightSmokePath: manifest.preflightSmokePath ?? null,
      cutoverResultPath: manifest.cutoverResultPath ?? null,
      reportPath: manifest.reportPath ?? null,
      approvalContractPath: manifest.approvalContractPath ?? null,
      postCutoverSmokePath: params.postCutoverSmokePath ?? null,
      postCutoverInspectPath: params.postCutoverInspectPath ?? null
    },
    automatedChecks,
    manualChecks
  };
}

async function writePromotionPacketArtifacts(
  outputDir: string,
  packet: CutoverPromotionPacket
): Promise<{
  packetJsonPath: string;
  packetMdPath: string;
  checklistJsonPath: string;
  checklistMdPath: string;
}> {
  const packetJsonPath = join(outputDir, "promotion-packet.json");
  const packetMdPath = join(outputDir, "promotion-packet.md");
  const checklistJsonPath = join(outputDir, "promotion-checklist.json");
  const checklistMdPath = join(outputDir, "promotion-checklist.md");

  await writeJsonFile(packetJsonPath, packet);
  await writeJsonFile(checklistJsonPath, {
    generatedAt: packet.generatedAt,
    sourceEnvironment: packet.sourceEnvironment,
    recommendedNextEnvironment: packet.recommendedNextEnvironment,
    automatedChecks: packet.automatedChecks,
    manualChecks: packet.manualChecks
  });

  const packetMd = [
    "# Patient Flow OS Promotion Packet",
    "",
    `- Label: ${packet.label}`,
    `- Source environment: ${packet.sourceEnvironment}`,
    `- Recommended next environment: ${packet.recommendedNextEnvironment}`,
    `- Cutover mode: ${packet.cutoverMode}`,
    `- Generated at: ${packet.generatedAt}`,
    `- Promotion ready: ${packet.ok ? "yes" : "no"}`,
    `- Approval contract: \`${packet.approvalContract}\``,
    "",
    "## Automated Checks",
    "",
    ...renderPromotionChecklist(packet.automatedChecks),
    "",
    "## Evidence",
    "",
    `- workflow-manifest.json: \`${packet.evidence.workflowManifestPath}\``,
    `- preflight-smoke.json: \`${packet.evidence.preflightSmokePath || "n/a"}\``,
    `- report.json: \`${packet.evidence.reportPath || "n/a"}\``,
    `- approval-contract.json: \`${packet.evidence.approvalContractPath || "n/a"}\``,
    `- post-cutover-smoke.json: \`${packet.evidence.postCutoverSmokePath || "n/a"}\``,
    `- post-cutover-inspect.json: \`${packet.evidence.postCutoverInspectPath || "n/a"}\``
  ].join("\n");
  await writeMarkdownFile(packetMdPath, packetMd);

  const checklistMd = [
    "# Patient Flow OS Promotion Checklist",
    "",
    `- Source environment: ${packet.sourceEnvironment}`,
    `- Recommended next environment: ${packet.recommendedNextEnvironment}`,
    "",
    "## Automated Checks",
    "",
    ...renderPromotionChecklist(packet.automatedChecks),
    "",
    "## Manual Review",
    "",
    ...renderPromotionChecklist(packet.manualChecks)
  ].join("\n");
  await writeMarkdownFile(checklistMdPath, checklistMd);

  return {
    packetJsonPath,
    packetMdPath,
    checklistJsonPath,
    checklistMdPath
  };
}

function buildPromotionVerification(
  packet: Partial<CutoverPromotionPacket>,
  sourceEnvironment: "staging" | "production",
  targetEnvironment: "production" | "completed"
): CutoverPromotionVerification {
  const checks: PromotionVerificationCheck[] = [];
  const pushCheck = (id: string, ok: boolean, message: string): void => {
    checks.push({ id, ok, message });
  };

  pushCheck(
    "packet.ok",
    packet.ok === true,
    "Promotion packet must already be marked as ready."
  );
  pushCheck(
    "packet.source_environment",
    packet.sourceEnvironment === sourceEnvironment,
    "Promotion packet must match the expected source environment."
  );
  pushCheck(
    "packet.recommended_next_environment",
    packet.recommendedNextEnvironment === targetEnvironment,
    "Promotion packet must recommend the expected next environment."
  );
  pushCheck(
    "packet.automated_checks_present",
    Array.isArray(packet.automatedChecks) && packet.automatedChecks.length > 0,
    "Promotion packet must include automated checks."
  );
  pushCheck(
    "packet.automated_checks_passed",
    Array.isArray(packet.automatedChecks) &&
      packet.automatedChecks.every((check) => check.status === "passed"),
    "All automated promotion checks must be passed."
  );
  pushCheck(
    "packet.summary.preflight_smoke_ok",
    packet.summary?.preflightSmokeOk === true,
    "Preflight smoke must be green in the packet summary."
  );
  pushCheck(
    "packet.summary.cutover_smoke_gate_passed",
    packet.summary?.cutoverSmokeGatePassed === true,
    "Cutover smoke gate must be green in the packet summary."
  );
  pushCheck(
    "packet.summary.approval_contract_passed",
    packet.summary?.approvalContractPassed === true,
    "Approval contract must be green in the packet summary."
  );
  pushCheck(
    "packet.summary.post_cutover_smoke_ok",
    targetEnvironment === "completed"
      ? packet.summary?.postCutoverSmokeOk !== false
      : packet.summary?.postCutoverSmokeOk === true,
    targetEnvironment === "completed"
      ? "Production completion packet cannot report a failing post-cutover smoke."
      : "Staging promotion packet must include a passing post-cutover smoke."
  );

  return {
    ok: checks.every((check) => check.ok),
    validatedAt: nowIso(),
    sourceEnvironment,
    targetEnvironment,
    checks
  };
}

async function buildRollbackPacket(params: {
  manifestPath: string;
  label: string;
  sourceEnvironment: "staging" | "production";
}): Promise<CutoverRollbackPacket> {
  const manifest = JSON.parse(await readFile(params.manifestPath, "utf8")) as CutoverWorkflowManifest;
  const report = await readJsonIfExists<CutoverCommandResult>(manifest.reportPath);
  const approval = await readJsonIfExists<CutoverCommandResult>(manifest.approvalContractPath);
  const beforeStatePath = report?.artifacts?.beforeStatePath ?? null;
  const afterStatePath = report?.artifacts?.afterStatePath ?? null;

  const automatedChecks: PromotionChecklistItem[] = [
    {
      id: "source_approval_contract",
      title: "Source cutover report passed the approval contract",
      status: approval?.approvalContract?.ok === true ? "passed" : "failed",
      message:
        approval?.approvalContract?.ok === true
          ? "Approval contract confirms the source cutover artifacts are complete."
          : "Approval contract is missing or failed for the source cutover.",
      evidencePath: manifest.approvalContractPath
    },
    {
      id: "source_smoke_gate",
      title: "Source cutover smoke gate passed",
      status: report?.smokeGate?.passed === true ? "passed" : "failed",
      message:
        report?.smokeGate?.passed === true
          ? "Source cutover did not introduce canonical errors."
          : "Source cutover smoke gate failed or the report is missing.",
      evidencePath: manifest.reportPath
    },
    {
      id: "source_after_smoke",
      title: "Source cutover after-smoke remained green",
      status: report?.afterSmoke?.ok === true ? "passed" : "failed",
      message:
        report?.afterSmoke?.ok === true
          ? "Source cutover ended in a green canonical state."
          : "Source cutover after-smoke failed or the report is missing.",
      evidencePath: manifest.reportPath
    },
    {
      id: "before_state_exists",
      title: "Rollback before-state artifact exists",
      status: (await pathExists(beforeStatePath)) ? "passed" : "failed",
      message:
        (await pathExists(beforeStatePath))
          ? "Rollback can restore the captured before-state snapshot."
          : "before-state.json is missing; rollback restore cannot be executed safely.",
      evidencePath: beforeStatePath ?? undefined
    },
    {
      id: "after_state_exists",
      title: "Cutover after-state artifact exists for diff review",
      status: (await pathExists(afterStatePath)) ? "passed" : "failed",
      message:
        (await pathExists(afterStatePath))
          ? "after-state.json is available for rollback review."
          : "after-state.json is missing; rollback review would be incomplete.",
      evidencePath: afterStatePath ?? undefined
    }
  ];

  const manualChecks: PromotionChecklistItem[] = [
    {
      id: "review_incident_scope",
      title: "Review rollback scope against the incident or failed release",
      status: "pending",
      message: "Confirm that restoring before-state is the intended response and no newer approved cutover should be preserved.",
      evidencePath:
        beforeStatePath && afterStatePath ? `${beforeStatePath} -> ${afterStatePath}` : undefined
    },
    {
      id: "confirm_target_database",
      title: "Confirm PATIENT_FLOW_OS_DATABASE_URL points to the rollback target",
      status: "pending",
      message: "The restore must target the intended database before replace-state is executed."
    },
    {
      id: "confirm_destructive_restore",
      title: "Confirm destructive restore approval",
      status: "pending",
      message: "replace-state is destructive and should only run after human approval."
    }
  ];

  const restoreCommand = beforeStatePath
    ? `npm run cutover -- replace-state --input "${beforeStatePath}" --allow-destructive --json`
    : 'npm run cutover -- replace-state --input "<before-state.json>" --allow-destructive --json';

  return {
    ok: automatedChecks.every((check) => check.status === "passed"),
    generatedAt: nowIso(),
    label: params.label,
    sourceEnvironment: params.sourceEnvironment,
    rollbackCommand: restoreCommand,
    summary: {
      sourceApprovalContractPassed: approval?.approvalContract?.ok === true,
      sourceSmokeGatePassed: report?.smokeGate?.passed === true,
      sourceAfterSmokeOk: report?.afterSmoke?.ok === true,
      beforeTotals: report?.beforeSummary?.totals ?? null,
      afterTotals: report?.summary?.totals ?? null
    },
    evidence: {
      workflowManifestPath: params.manifestPath,
      reportPath: manifest.reportPath ?? null,
      approvalContractPath: manifest.approvalContractPath ?? null,
      beforeStatePath,
      afterStatePath
    },
    automatedChecks,
    manualChecks
  };
}

async function writeRollbackPacketArtifacts(
  outputDir: string,
  packet: CutoverRollbackPacket
): Promise<{
  packetJsonPath: string;
  packetMdPath: string;
  checklistJsonPath: string;
  checklistMdPath: string;
}> {
  const packetJsonPath = join(outputDir, "rollback-packet.json");
  const packetMdPath = join(outputDir, "rollback-packet.md");
  const checklistJsonPath = join(outputDir, "rollback-checklist.json");
  const checklistMdPath = join(outputDir, "rollback-checklist.md");

  await writeJsonFile(packetJsonPath, packet);
  await writeJsonFile(checklistJsonPath, {
    generatedAt: packet.generatedAt,
    sourceEnvironment: packet.sourceEnvironment,
    rollbackCommand: packet.rollbackCommand,
    automatedChecks: packet.automatedChecks,
    manualChecks: packet.manualChecks
  });

  const packetMd = [
    "# Patient Flow OS Rollback Packet",
    "",
    `- Label: ${packet.label}`,
    `- Source environment: ${packet.sourceEnvironment}`,
    `- Generated at: ${packet.generatedAt}`,
    `- Rollback ready: ${packet.ok ? "yes" : "no"}`,
    `- Restore command: \`${packet.rollbackCommand}\``,
    "",
    "## Automated Checks",
    "",
    ...renderPromotionChecklist(packet.automatedChecks),
    "",
    "## Evidence",
    "",
    `- workflow-manifest.json: \`${packet.evidence.workflowManifestPath}\``,
    `- report.json: \`${packet.evidence.reportPath || "n/a"}\``,
    `- approval-contract.json: \`${packet.evidence.approvalContractPath || "n/a"}\``,
    `- before-state.json: \`${packet.evidence.beforeStatePath || "n/a"}\``,
    `- after-state.json: \`${packet.evidence.afterStatePath || "n/a"}\``
  ].join("\n");
  await writeMarkdownFile(packetMdPath, packetMd);

  const checklistMd = [
    "# Patient Flow OS Rollback Checklist",
    "",
    `- Source environment: ${packet.sourceEnvironment}`,
    `- Restore command: \`${packet.rollbackCommand}\``,
    "",
    "## Automated Checks",
    "",
    ...renderPromotionChecklist(packet.automatedChecks),
    "",
    "## Manual Review",
    "",
    ...renderPromotionChecklist(packet.manualChecks)
  ].join("\n");
  await writeMarkdownFile(checklistMdPath, checklistMd);

  return {
    packetJsonPath,
    packetMdPath,
    checklistJsonPath,
    checklistMdPath
  };
}

async function buildRollbackVerification(
  packet: Partial<CutoverRollbackPacket>,
  sourceEnvironment: "staging" | "production"
): Promise<CutoverRollbackVerification> {
  const checks: RollbackVerificationCheck[] = [];
  const pushCheck = (id: string, ok: boolean, message: string): void => {
    checks.push({ id, ok, message });
  };

  pushCheck("packet.ok", packet.ok === true, "Rollback packet must already be marked as ready.");
  pushCheck(
    "packet.source_environment",
    packet.sourceEnvironment === sourceEnvironment,
    "Rollback packet must match the expected source environment."
  );
  pushCheck(
    "packet.automated_checks_present",
    Array.isArray(packet.automatedChecks) && packet.automatedChecks.length > 0,
    "Rollback packet must include automated checks."
  );
  pushCheck(
    "packet.automated_checks_passed",
    Array.isArray(packet.automatedChecks) &&
      packet.automatedChecks.every((check) => check.status === "passed"),
    "All automated rollback checks must be passed."
  );
  pushCheck(
    "packet.summary.source_approval_contract_passed",
    packet.summary?.sourceApprovalContractPassed === true,
    "Rollback packet must carry a passing approval contract."
  );
  pushCheck(
    "packet.summary.source_smoke_gate_passed",
    packet.summary?.sourceSmokeGatePassed === true,
    "Rollback packet must carry a passing source smoke gate."
  );
  pushCheck(
    "packet.summary.source_after_smoke_ok",
    packet.summary?.sourceAfterSmokeOk === true,
    "Rollback packet must carry a green source after-smoke."
  );
  pushCheck(
    "packet.evidence.before_state_exists",
    await pathExists(packet.evidence?.beforeStatePath),
    "Rollback packet must reference an existing before-state artifact."
  );
  pushCheck(
    "packet.evidence.report_exists",
    await pathExists(packet.evidence?.reportPath),
    "Rollback packet must reference an existing report artifact."
  );

  return {
    ok: checks.every((check) => check.ok),
    validatedAt: nowIso(),
    sourceEnvironment,
    checks
  };
}

async function buildBackupDrillPacket(params: {
  manifestPath: string;
  label: string;
  sourceEnvironment: "staging" | "production";
  maxRtoSeconds: number;
  maxRpoSeconds: number;
}): Promise<CutoverBackupDrillPacket> {
  const manifest = JSON.parse(await readFile(params.manifestPath, "utf8")) as BackupDrillManifest;
  const sourceSmoke = await readJsonIfExists<CutoverCommandResult>(manifest.sourceSmokePath);
  const sourceInspect = await readJsonIfExists<CutoverCommandResult>(manifest.sourceInspectPath);
  const restoreSmoke = await readJsonIfExists<CutoverCommandResult>(manifest.restoreSmokePath);
  const restoreInspect = await readJsonIfExists<CutoverCommandResult>(manifest.restoreInspectPath);
  const dumpSha256 = await readSha256File(manifest.dumpSha256Path);
  const encryptedDumpSha256 = await readSha256File(manifest.encryptedDumpSha256Path);
  const dumpBytes =
    typeof manifest.dumpBytes === "number" && Number.isFinite(manifest.dumpBytes) && manifest.dumpBytes > 0
      ? manifest.dumpBytes
      : (await pathExists(manifest.dumpPath))
        ? (await stat(manifest.dumpPath)).size
        : 0;
  const encryptedDumpBytes =
    typeof manifest.encryptedDumpBytes === "number" &&
      Number.isFinite(manifest.encryptedDumpBytes) &&
      manifest.encryptedDumpBytes > 0
      ? manifest.encryptedDumpBytes
      : (await pathExists(manifest.encryptedDumpPath))
        ? (await stat(manifest.encryptedDumpPath)).size
        : 0;
  const sourceTotals = sourceInspect?.summary?.totals ?? null;
  const restoredTotals = restoreInspect?.summary?.totals ?? null;
  const totalsMatch =
    sourceTotals !== null &&
    restoredTotals !== null &&
    JSON.stringify(sourceTotals) === JSON.stringify(restoredTotals);
  const measuredRtoSeconds = secondsBetween(manifest.restoreStartedAt, manifest.restoreFinishedAt);
  const estimatedRpoSeconds = secondsBetween(manifest.backupFinishedAt, manifest.restoreStartedAt);
  const encryptedDumpReady =
    encryptedDumpBytes > 0 &&
    typeof encryptedDumpSha256 === "string" &&
    /^[a-f0-9]{64}$/i.test(encryptedDumpSha256);
  const retentionDays =
    typeof manifest.retentionDays === "number" && Number.isFinite(manifest.retentionDays) ? manifest.retentionDays : 0;
  const expiresAtMs = Date.parse(manifest.expiresAt);
  const backupFinishedAtMs = Date.parse(manifest.backupFinishedAt);
  const retentionRecorded =
    retentionDays > 0 &&
    Number.isFinite(expiresAtMs) &&
    Number.isFinite(backupFinishedAtMs) &&
    expiresAtMs > backupFinishedAtMs;

  const automatedChecks: PromotionChecklistItem[] = [
    {
      id: "dump_present",
      title: "pg_dump backup artifact existed during the drill",
      status: dumpBytes > 0 ? "passed" : "failed",
      message:
        dumpBytes > 0
          ? "Logical backup was created with non-zero size."
          : "Backup dump is missing or empty.",
      evidencePath: manifest.dumpPath
    },
    {
      id: "dump_checksum_present",
      title: "Backup checksum was recorded",
      status: typeof dumpSha256 === "string" && /^[a-f0-9]{64}$/i.test(dumpSha256) ? "passed" : "failed",
      message:
        typeof dumpSha256 === "string" && /^[a-f0-9]{64}$/i.test(dumpSha256)
          ? "SHA256 checksum was captured for the backup."
          : "Checksum file is missing or invalid.",
      evidencePath: manifest.dumpSha256Path
    },
    {
      id: "encrypted_dump_present",
      title: "Encrypted backup artifact was produced for escrow",
      status: encryptedDumpBytes > 0 ? "passed" : "failed",
      message:
        encryptedDumpBytes > 0
          ? "Encrypted backup artifact was created with non-zero size."
          : "Encrypted backup artifact is missing or empty.",
      evidencePath: manifest.encryptedDumpPath
    },
    {
      id: "encrypted_dump_checksum_present",
      title: "Encrypted backup checksum was recorded",
      status:
        typeof encryptedDumpSha256 === "string" && /^[a-f0-9]{64}$/i.test(encryptedDumpSha256)
          ? "passed"
          : "failed",
      message:
        typeof encryptedDumpSha256 === "string" && /^[a-f0-9]{64}$/i.test(encryptedDumpSha256)
          ? "SHA256 checksum was captured for the encrypted backup."
          : "Encrypted backup checksum file is missing or invalid.",
      evidencePath: manifest.encryptedDumpSha256Path
    },
    {
      id: "encrypted_archive_declared",
      title: "Encrypted archive destination and key reference were recorded",
      status:
        manifest.archiveDestination === "github_artifact_encrypted" &&
          manifest.encryptionMode === "gpg_symmetric" &&
          manifest.encryptionKeyRef.trim().length > 0
          ? "passed"
          : "failed",
      message:
        manifest.archiveDestination === "github_artifact_encrypted" &&
          manifest.encryptionMode === "gpg_symmetric" &&
          manifest.encryptionKeyRef.trim().length > 0
          ? "Encrypted backup records its storage destination and key reference."
          : "Encrypted backup is missing archive destination, encryption mode or key reference.",
      evidencePath: params.manifestPath
    },
    {
      id: "retention_policy_recorded",
      title: "Retention window and expiry were recorded",
      status: retentionRecorded ? "passed" : "failed",
      message:
        retentionRecorded
          ? `Encrypted backup expires at ${manifest.expiresAt} after ${retentionDays} retention day(s).`
          : "Retention days or expiresAt metadata is missing or invalid.",
      evidencePath: params.manifestPath
    },
    {
      id: "source_smoke_ok",
      title: "Source database passed canonical smoke before backup",
      status: sourceSmoke?.smoke?.ok === true ? "passed" : "failed",
      message:
        sourceSmoke?.smoke?.ok === true
          ? "Source database started healthy."
          : "Source smoke failed or is missing.",
      evidencePath: manifest.sourceSmokePath
    },
    {
      id: "restore_smoke_ok",
      title: "Restored drill database passed canonical smoke",
      status: restoreSmoke?.smoke?.ok === true ? "passed" : "failed",
      message:
        restoreSmoke?.smoke?.ok === true
          ? "Restored drill database is healthy."
          : "Restore smoke failed or is missing.",
      evidencePath: manifest.restoreSmokePath
    },
    {
      id: "totals_match",
      title: "Source and restored canonical totals match",
      status: totalsMatch ? "passed" : "failed",
      message:
        totalsMatch
          ? "Canonical totals match after restore."
          : "Source and restored totals differ or inspect artifacts are missing.",
      evidencePath: `${manifest.sourceInspectPath} -> ${manifest.restoreInspectPath}`
    },
    {
      id: "rto_within_budget",
      title: "Measured RTO stayed within budget",
      status: measuredRtoSeconds <= params.maxRtoSeconds ? "passed" : "failed",
      message:
        measuredRtoSeconds <= params.maxRtoSeconds
          ? `RTO ${measuredRtoSeconds}s is within ${params.maxRtoSeconds}s.`
          : `RTO ${measuredRtoSeconds}s exceeded ${params.maxRtoSeconds}s.`,
      evidencePath: params.manifestPath
    },
    {
      id: "rpo_within_budget",
      title: "Estimated RPO stayed within budget",
      status: estimatedRpoSeconds <= params.maxRpoSeconds ? "passed" : "failed",
      message:
        estimatedRpoSeconds <= params.maxRpoSeconds
          ? `RPO ${estimatedRpoSeconds}s is within ${params.maxRpoSeconds}s.`
          : `RPO ${estimatedRpoSeconds}s exceeded ${params.maxRpoSeconds}s.`,
      evidencePath: params.manifestPath
    }
  ];

  const manualChecks: PromotionChecklistItem[] = [
    {
      id: "review_backup_retention",
      title: "Review retention and storage policy for the encrypted backup artifact",
      status: "pending",
      message:
        "Confirm the encrypted backup will be rotated or removed before expiresAt and retained only in approved storage."
    },
    {
      id: "review_encryption_key_rotation",
      title: "Review encryption secret rotation and operator access",
      status: "pending",
      message:
        "Confirm PATIENT_FLOW_OS_BACKUP_ENCRYPTION_PASSPHRASE follows the expected rotation policy and access controls."
    },
    {
      id: "review_restore_target",
      title: "Review that restore ran against the intended drill target",
      status: "pending",
      message: "Confirm PATIENT_FLOW_OS_DRILL_DATABASE_URL points to an isolated drill database."
    }
  ];

  return {
    ok: automatedChecks.every((check) => check.status === "passed"),
    generatedAt: nowIso(),
    label: params.label,
    sourceEnvironment: params.sourceEnvironment,
    backupMode: manifest.backupMode,
    restoreTarget: manifest.restoreTarget,
    archiveDestination: manifest.archiveDestination,
    summary: {
      sourceSmokeOk: sourceSmoke?.smoke?.ok === true,
      restoreSmokeOk: restoreSmoke?.smoke?.ok === true,
      totalsMatch,
      measuredRtoSeconds,
      estimatedRpoSeconds,
      maxRtoSeconds: params.maxRtoSeconds,
      maxRpoSeconds: params.maxRpoSeconds,
      dumpBytes,
      encryptedDumpReady,
      encryptedDumpBytes,
      retentionDays,
      expiresAt: manifest.expiresAt,
      sourceTotals,
      restoredTotals
    },
    evidence: {
      backupManifestPath: params.manifestPath,
      dumpPath: manifest.dumpPath,
      dumpSha256Path: manifest.dumpSha256Path,
      dumpSha256,
      encryptedDumpPath: manifest.encryptedDumpPath,
      encryptedDumpSha256Path: manifest.encryptedDumpSha256Path,
      encryptedDumpSha256,
      encryptionMode: manifest.encryptionMode,
      encryptionKeyRef: manifest.encryptionKeyRef,
      sourceSmokePath: manifest.sourceSmokePath,
      sourceInspectPath: manifest.sourceInspectPath,
      restoreSmokePath: manifest.restoreSmokePath,
      restoreInspectPath: manifest.restoreInspectPath
    },
    automatedChecks,
    manualChecks
  };
}

async function writeBackupDrillPacketArtifacts(
  outputDir: string,
  packet: CutoverBackupDrillPacket
): Promise<{
  packetJsonPath: string;
  packetMdPath: string;
  checklistJsonPath: string;
  checklistMdPath: string;
}> {
  const packetJsonPath = join(outputDir, "backup-drill-packet.json");
  const packetMdPath = join(outputDir, "backup-drill-packet.md");
  const checklistJsonPath = join(outputDir, "backup-drill-checklist.json");
  const checklistMdPath = join(outputDir, "backup-drill-checklist.md");

  await writeJsonFile(packetJsonPath, packet);
  await writeJsonFile(checklistJsonPath, {
    generatedAt: packet.generatedAt,
    sourceEnvironment: packet.sourceEnvironment,
    backupMode: packet.backupMode,
    restoreTarget: packet.restoreTarget,
    archiveDestination: packet.archiveDestination,
    automatedChecks: packet.automatedChecks,
    manualChecks: packet.manualChecks
  });

  const packetMd = [
    "# Patient Flow OS Backup Drill Packet",
    "",
    `- Label: ${packet.label}`,
    `- Source environment: ${packet.sourceEnvironment}`,
    `- Backup mode: ${packet.backupMode}`,
    `- Restore target: ${packet.restoreTarget}`,
    `- Archive destination: ${packet.archiveDestination}`,
    `- Generated at: ${packet.generatedAt}`,
    `- Drill ready: ${packet.ok ? "yes" : "no"}`,
    `- Measured RTO: ${packet.summary.measuredRtoSeconds}s`,
    `- Estimated RPO: ${packet.summary.estimatedRpoSeconds}s`,
    `- RTO budget: ${packet.summary.maxRtoSeconds}s`,
    `- RPO budget: ${packet.summary.maxRpoSeconds}s`,
    `- Dump bytes: ${packet.summary.dumpBytes}`,
    `- Encrypted dump ready: ${packet.summary.encryptedDumpReady ? "yes" : "no"}`,
    `- Encrypted dump bytes: ${packet.summary.encryptedDumpBytes}`,
    `- Retention days: ${packet.summary.retentionDays}`,
    `- Expires at: ${packet.summary.expiresAt}`,
    "",
    "## Automated Checks",
    "",
    ...renderPromotionChecklist(packet.automatedChecks),
    "",
    "## Evidence",
    "",
    `- backup-drill-manifest.json: \`${packet.evidence.backupManifestPath}\``,
    `- backup dump path: \`${packet.evidence.dumpPath}\``,
    `- backup sha256 path: \`${packet.evidence.dumpSha256Path}\``,
    `- backup sha256: \`${packet.evidence.dumpSha256 || "n/a"}\``,
    `- encrypted backup path: \`${packet.evidence.encryptedDumpPath}\``,
    `- encrypted backup sha256 path: \`${packet.evidence.encryptedDumpSha256Path}\``,
    `- encrypted backup sha256: \`${packet.evidence.encryptedDumpSha256 || "n/a"}\``,
    `- encryption mode: \`${packet.evidence.encryptionMode}\``,
    `- encryption key ref: \`${packet.evidence.encryptionKeyRef}\``,
    `- source-smoke.json: \`${packet.evidence.sourceSmokePath}\``,
    `- source-inspect.json: \`${packet.evidence.sourceInspectPath}\``,
    `- restore-smoke.json: \`${packet.evidence.restoreSmokePath}\``,
    `- restore-inspect.json: \`${packet.evidence.restoreInspectPath}\``
  ].join("\n");
  await writeMarkdownFile(packetMdPath, packetMd);

  const checklistMd = [
    "# Patient Flow OS Backup Drill Checklist",
    "",
    `- Source environment: ${packet.sourceEnvironment}`,
    `- Backup mode: ${packet.backupMode}`,
    `- Restore target: ${packet.restoreTarget}`,
    `- Archive destination: ${packet.archiveDestination}`,
    "",
    "## Automated Checks",
    "",
    ...renderPromotionChecklist(packet.automatedChecks),
    "",
    "## Manual Review",
    "",
    ...renderPromotionChecklist(packet.manualChecks)
  ].join("\n");
  await writeMarkdownFile(checklistMdPath, checklistMd);

  return {
    packetJsonPath,
    packetMdPath,
    checklistJsonPath,
    checklistMdPath
  };
}

async function buildBackupDrillVerification(
  packet: Partial<CutoverBackupDrillPacket>,
  sourceEnvironment: "staging" | "production",
  maxRtoSeconds: number,
  maxRpoSeconds: number
): Promise<CutoverBackupDrillVerification> {
  const checks: BackupDrillVerificationCheck[] = [];
  const pushCheck = (id: string, ok: boolean, message: string): void => {
    checks.push({ id, ok, message });
  };

  pushCheck("packet.ok", packet.ok === true, "Backup drill packet must already be marked as ready.");
  pushCheck(
    "packet.source_environment",
    packet.sourceEnvironment === sourceEnvironment,
    "Backup drill packet must match the expected source environment."
  );
  pushCheck(
    "packet.archive_destination",
    packet.archiveDestination === "github_artifact_encrypted",
    "Backup drill packet must declare an encrypted archive destination."
  );
  pushCheck(
    "packet.automated_checks_present",
    Array.isArray(packet.automatedChecks) && packet.automatedChecks.length > 0,
    "Backup drill packet must include automated checks."
  );
  pushCheck(
    "packet.automated_checks_passed",
    Array.isArray(packet.automatedChecks) &&
      packet.automatedChecks.every((check) => check.status === "passed"),
    "All automated backup drill checks must be passed."
  );
  pushCheck(
    "packet.summary.source_smoke_ok",
    packet.summary?.sourceSmokeOk === true,
    "Source smoke must be green."
  );
  pushCheck(
    "packet.summary.restore_smoke_ok",
    packet.summary?.restoreSmokeOk === true,
    "Restore smoke must be green."
  );
  pushCheck(
    "packet.summary.totals_match",
    packet.summary?.totalsMatch === true,
    "Source and restored totals must match."
  );
  pushCheck(
    "packet.summary.dump_bytes_positive",
    typeof packet.summary?.dumpBytes === "number" && packet.summary.dumpBytes > 0,
    "Backup dump size must be greater than zero."
  );
  pushCheck(
    "packet.summary.encrypted_dump_ready",
    packet.summary?.encryptedDumpReady === true,
    "Encrypted backup artifact must be marked as ready."
  );
  pushCheck(
    "packet.summary.encrypted_dump_bytes_positive",
    typeof packet.summary?.encryptedDumpBytes === "number" && packet.summary.encryptedDumpBytes > 0,
    "Encrypted backup dump size must be greater than zero."
  );
  pushCheck(
    "packet.summary.retention_days_positive",
    typeof packet.summary?.retentionDays === "number" && packet.summary.retentionDays > 0,
    "Retention window must be recorded with a positive number of days."
  );
  pushCheck(
    "packet.summary.expires_at_valid",
    typeof packet.summary?.expiresAt === "string" &&
      Number.isFinite(Date.parse(packet.summary.expiresAt)) &&
      Number.isFinite(Date.parse(packet.generatedAt ?? "")) &&
      Date.parse(packet.summary.expiresAt) > Date.parse(packet.generatedAt ?? ""),
    "Backup drill packet must include a valid expiresAt after the packet generation time."
  );
  pushCheck(
    "packet.evidence.dump_sha256_present",
    typeof packet.evidence?.dumpSha256 === "string" && /^[a-f0-9]{64}$/i.test(packet.evidence.dumpSha256),
    "Backup drill packet must carry a valid SHA256 checksum."
  );
  pushCheck(
    "packet.evidence.encrypted_dump_exists",
    await pathExists(packet.evidence?.encryptedDumpPath),
    "Encrypted backup artifact must exist on disk."
  );
  pushCheck(
    "packet.evidence.encrypted_dump_sha256_exists",
    await pathExists(packet.evidence?.encryptedDumpSha256Path),
    "Encrypted backup checksum artifact must exist on disk."
  );
  pushCheck(
    "packet.evidence.encrypted_dump_sha256_present",
    typeof packet.evidence?.encryptedDumpSha256 === "string" &&
      /^[a-f0-9]{64}$/i.test(packet.evidence.encryptedDumpSha256),
    "Backup drill packet must carry a valid SHA256 checksum for the encrypted backup."
  );
  pushCheck(
    "packet.evidence.encryption_mode",
    packet.evidence?.encryptionMode === "gpg_symmetric",
    "Backup drill packet must declare gpg_symmetric encryption mode."
  );
  pushCheck(
    "packet.evidence.encryption_key_ref_present",
    typeof packet.evidence?.encryptionKeyRef === "string" && packet.evidence.encryptionKeyRef.trim().length > 0,
    "Backup drill packet must include a non-empty encryption key reference."
  );
  pushCheck(
    "packet.summary.rto_within_budget",
    typeof packet.summary?.measuredRtoSeconds === "number" &&
      packet.summary.measuredRtoSeconds <= maxRtoSeconds,
    "Measured RTO must stay within the configured budget."
  );
  pushCheck(
    "packet.summary.rpo_within_budget",
    typeof packet.summary?.estimatedRpoSeconds === "number" &&
      packet.summary.estimatedRpoSeconds <= maxRpoSeconds,
    "Estimated RPO must stay within the configured budget."
  );

  return {
    ok: checks.every((check) => check.ok),
    validatedAt: nowIso(),
    sourceEnvironment,
    maxRtoSeconds,
    maxRpoSeconds,
    checks
  };
}

function renderHumanResult(result: CutoverCommandResult): string {
  const lines = [
    `command: ${result.command}`,
    `tenants: ${result.summary.totals.tenants}`,
    `patients: ${result.summary.totals.patients}`,
    `cases: ${result.summary.totals.cases} (${result.summary.totals.activeCases} active)`,
    `appointments: ${result.summary.totals.appointments}`,
    `callbacks: ${result.summary.totals.callbacks}`,
    `queueTickets: ${result.summary.totals.queueTickets}`,
    `threads: ${result.summary.totals.threads}`,
    `actions: ${result.summary.totals.actions}`,
    `approvals: ${result.summary.totals.approvals}`,
    `agentTasks: ${result.summary.totals.agentTasks}`,
    `preparedActions: ${result.summary.totals.preparedActions}`,
    `preparedActionDispatchJobs: ${result.summary.totals.preparedActionDispatchJobs}`
  ];

  if (result.mode) {
    lines.push(`mode: ${result.mode}`);
  }
  if (result.inputPath) {
    lines.push(`input: ${result.inputPath}`);
  }
  if (result.outputPath) {
    lines.push(`output: ${result.outputPath}`);
  }
  if (result.beforeSummary) {
    lines.push(
      `before: tenants=${result.beforeSummary.totals.tenants}, cases=${result.beforeSummary.totals.cases}, callbacks=${result.beforeSummary.totals.callbacks}`
    );
  }
  if (result.importStats) {
    lines.push(
      `importStats: cases=${result.importStats.cases}, appointments=${result.importStats.appointments}, callbacks=${result.importStats.callbacks}, approvals=${result.importStats.approvals}`
    );
  }

  const smokeLine = renderSmokeLine("smoke", result.smoke);
  if (smokeLine) {
    lines.push(smokeLine);
  }
  const beforeSmokeLine = renderSmokeLine("beforeSmoke", result.beforeSmoke);
  if (beforeSmokeLine) {
    lines.push(beforeSmokeLine);
  }
  const afterSmokeLine = renderSmokeLine("afterSmoke", result.afterSmoke);
  if (afterSmokeLine) {
    lines.push(afterSmokeLine);
  }
  if (result.smokeGate) {
    lines.push(
      `smokeGate: ${result.smokeGate.passed ? "passed" : "failed"} (newErrors=${result.smokeGate.newErrors.length}, carriedErrors=${result.smokeGate.carriedErrors.length})`
    );
  }
  if (result.artifacts) {
    lines.push(`artifacts: ${result.artifacts.directory}`);
    if (result.artifacts.reportPath) {
      lines.push(`report: ${result.artifacts.reportPath}`);
    }
  }
  if (result.bundleFingerprint) {
    lines.push(`bundleFingerprint: ${result.bundleFingerprint}`);
  }
  if (result.approvalContract) {
    const failedChecks = result.approvalContract.checks.filter((check) => !check.ok).length;
    lines.push(`approvalContract: ${result.approvalContract.ok ? "passed" : `failed (${failedChecks} checks)`}`);
  }
  if (result.promotionPacket) {
    const failedAutomatedChecks = result.promotionPacket.automatedChecks.filter(
      (check) => check.status !== "passed"
    ).length;
    lines.push(`promotionPacket: ${result.promotionPacket.ok ? "ready" : `blocked (${failedAutomatedChecks} automated checks)`}`);
  }
  if (result.promotionVerification) {
    const failedChecks = result.promotionVerification.checks.filter((check) => !check.ok).length;
    lines.push(`promotionVerification: ${result.promotionVerification.ok ? "passed" : `failed (${failedChecks} checks)`}`);
  }
  if (result.rollbackPacket) {
    const failedAutomatedChecks = result.rollbackPacket.automatedChecks.filter(
      (check) => check.status !== "passed"
    ).length;
    lines.push(`rollbackPacket: ${result.rollbackPacket.ok ? "ready" : `blocked (${failedAutomatedChecks} automated checks)`}`);
  }
  if (result.rollbackVerification) {
    const failedChecks = result.rollbackVerification.checks.filter((check) => !check.ok).length;
    lines.push(`rollbackVerification: ${result.rollbackVerification.ok ? "passed" : `failed (${failedChecks} checks)`}`);
  }
  if (result.backupDrillPacket) {
    const failedAutomatedChecks = result.backupDrillPacket.automatedChecks.filter(
      (check) => check.status !== "passed"
    ).length;
    lines.push(`backupDrillPacket: ${result.backupDrillPacket.ok ? "ready" : `blocked (${failedAutomatedChecks} automated checks)`}`);
    lines.push(
      `backupDrillArchive: ${result.backupDrillPacket.archiveDestination}, encrypted=${result.backupDrillPacket.summary.encryptedDumpReady ? "yes" : "no"}, retentionDays=${result.backupDrillPacket.summary.retentionDays}, expiresAt=${result.backupDrillPacket.summary.expiresAt}`
    );
  }
  if (result.backupDrillVerification) {
    const failedChecks = result.backupDrillVerification.checks.filter((check) => !check.ok).length;
    lines.push(`backupDrillVerification: ${result.backupDrillVerification.ok ? "passed" : `failed (${failedChecks} checks)`}`);
  }

  for (const tenant of result.summary.tenants) {
    lines.push(
      `tenant ${tenant.tenantId}: cases=${tenant.cases}, active=${tenant.activeCases}, appointments=${tenant.appointments}, callbacks=${tenant.callbacks}`
    );
  }

  return `${lines.join("\n")}\n`;
}

function helpText(): string {
  return [
    "Patient Flow OS cutover CLI",
    "",
    "Usage:",
    "  npm run cutover -- <command> [options]",
    "",
    "Commands:",
    "  inspect",
    "  smoke",
    "  export-state --output <file>",
    "  replace-state --input <file> --allow-destructive",
    "  seed-demo --allow-destructive",
    "  import-openclaw --input <file> [--mode merge|replace] [--allow-destructive]",
    "  cutover-openclaw --input <file> --artifacts-dir <dir> [--mode merge|replace] [--allow-destructive]",
    "  verify-report --input <file>",
    "  verify-promotion-packet --input <promotion-packet.json> [--source-environment staging|production] [--target-environment production|completed]",
    "  promotion-packet --input <workflow-manifest.json> --artifacts-dir <dir> [--post-smoke <file>] [--post-inspect <file>] [--target-environment staging|production] [--label <value>]",
    "  verify-rollback-packet --input <rollback-packet.json> [--source-environment staging|production]",
    "  rollback-packet --input <workflow-manifest.json> --artifacts-dir <dir> [--source-environment staging|production] [--label <value>]",
    "  verify-backup-drill --input <backup-drill-packet.json> [--source-environment staging|production] [--max-rto-seconds <n>] [--max-rpo-seconds <n>]",
    "  backup-drill-packet --input <backup-drill-manifest.json> --artifacts-dir <dir> [--source-environment staging|production] [--max-rto-seconds <n>] [--max-rpo-seconds <n>] [--label <value>]",
    "",
    "Options:",
    "  --json                 Print machine-readable JSON",
    "  --input <file>         Input JSON file",
    "  --output <file>        Output JSON file",
    "  --artifacts-dir <dir>  Directory where backup/report artifacts are written",
    "  --mode <mode>          Import mode for OpenClaw commands (default: merge)",
    "  --target-environment   Source environment for promotion packet commands (default: staging)",
    "  --post-smoke <file>    Post-cutover smoke JSON artifact",
    "  --post-inspect <file>  Post-cutover inspect JSON artifact",
    "  --label <value>        Label used in generated promotion packets",
    "  --max-rto-seconds <n>  Maximum allowed restore time objective in seconds",
    "  --max-rpo-seconds <n>  Maximum allowed recovery point objective in seconds",
    "  --allow-destructive    Required for replace-state, seed-demo and replace cutovers",
    "  --help                 Show help"
  ].join("\n");
}

async function getExecutor(options: RunCutoverCliOptions): Promise<{ executor: Queryable; close: () => Promise<void> }> {
  if (options.pool) {
    return {
      executor: options.pool,
      close: async () => undefined
    };
  }

  const connectionString = options.env?.DATABASE_URL ?? process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL is required when no pool is provided");
  }

  const pool = new Pool({ connectionString });
  return {
    executor: pool,
    close: async () => {
      await pool.end();
    }
  };
}

function commandRequiresExecutor(command: string): boolean {
  return [
    "inspect",
    "smoke",
    "export-state",
    "replace-state",
    "seed-demo",
    "import-openclaw",
    "cutover-openclaw"
  ].includes(command);
}

export async function executeCutoverCommand(
  argv: readonly string[],
  options: RunCutoverCliOptions = {}
): Promise<CutoverCommandResult> {
  const cwd = options.cwd ?? process.cwd();
  const parsed = parseArgs({
    args: [...argv],
    allowPositionals: true,
    options: {
      input: { type: "string" },
      output: { type: "string" },
      mode: { type: "string" },
      json: { type: "boolean" },
      help: { type: "boolean" },
      "allow-destructive": { type: "boolean" },
      "artifacts-dir": { type: "string" },
      "target-environment": { type: "string" },
      "source-environment": { type: "string" },
      "post-smoke": { type: "string" },
      "post-inspect": { type: "string" },
      "max-rto-seconds": { type: "string" },
      "max-rpo-seconds": { type: "string" },
      label: { type: "string" }
    }
  });

  const command = parsed.positionals[0] ?? "help";
  const inputPath = parsed.values.input ? resolveCliPath(cwd, parsed.values.input) : undefined;
  const outputPath = parsed.values.output ? resolveCliPath(cwd, parsed.values.output) : undefined;
  const artifactsDir = parsed.values["artifacts-dir"]
    ? resolveCliPath(cwd, parsed.values["artifacts-dir"])
    : undefined;
  const promotionPacketSourceEnvironment =
    parsed.values["target-environment"] === "production" ? "production" : "staging";
  const promotionVerificationTargetEnvironment =
    parsed.values["target-environment"] === "completed" ? "completed" : "production";
  const sourceEnvironment =
    parsed.values["source-environment"] === "production" ? "production" : "staging";
  const postSmokePath = parsed.values["post-smoke"]
    ? resolveCliPath(cwd, parsed.values["post-smoke"])
    : undefined;
  const postInspectPath = parsed.values["post-inspect"]
    ? resolveCliPath(cwd, parsed.values["post-inspect"])
    : undefined;
  const label = parsed.values.label?.trim() || "patient-flow-os-cutover";
  const maxRtoSeconds = parsePositiveIntegerFlag(
    parsed.values["max-rto-seconds"],
    "--max-rto-seconds",
    900
  );
  const maxRpoSeconds = parsePositiveIntegerFlag(
    parsed.values["max-rpo-seconds"],
    "--max-rpo-seconds",
    3600
  );
  const allowDestructive = parsed.values["allow-destructive"] ?? false;
  const mode = parsed.values.mode ?? "merge";

  if (parsed.values.help || command === "help") {
    return {
      command: "help",
      summary: summarizeState(createEmptyBootstrapState())
    };
  }

  const runWithExecutor = async <T>(
    handler: (executor: Queryable) => Promise<T>
  ): Promise<T> => {
    const { executor, close } = await getExecutor(options);
    try {
      await ensurePostgresSchema(executor);
      return await handler(executor);
    } finally {
      await close();
    }
  };

  if (command === "inspect") {
    return await runWithExecutor(async (executor) => {
      const state = await loadBootstrapStateFromPostgres(executor);
      return {
        command,
        summary: summarizeState(state)
      };
    });
  }

  if (command === "smoke") {
    return await runWithExecutor(async (executor) => {
      const state = await loadBootstrapStateFromPostgres(executor);
      const smoke = smokeState(state);
      const result: CutoverCommandResult = {
        command,
        summary: summarizeState(state),
        smoke
      };
      if (!smoke.ok) {
        throw new CutoverCommandError("canonical smoke detected invariant errors", result);
      }
      return result;
    });
  }

  if (command === "export-state") {
    if (!outputPath) {
      throw new Error("export-state requires --output");
    }
    return await runWithExecutor(async (executor) => {
      const state = await loadBootstrapStateFromPostgres(executor);
      await writeJsonFile(outputPath, state);
      return {
        command,
        outputPath,
        summary: summarizeState(state)
      };
    });
  }

  if (command === "replace-state") {
    requireDestructivePermission(command, allowDestructive);
    if (!inputPath) {
      throw new Error("replace-state requires --input");
    }
    return await runWithExecutor(async (executor) => {
      const nextState = BootstrapStateSchema.parse(JSON.parse(await readFile(inputPath, "utf8")));
      await replaceBootstrapStateInPostgres(executor, nextState);
      return {
        command,
        inputPath,
        summary: summarizeState(nextState)
      };
    });
  }

  if (command === "seed-demo") {
    requireDestructivePermission(command, allowDestructive);
    return await runWithExecutor(async (executor) => {
      const nextState = createBootstrapState();
      await replaceBootstrapStateInPostgres(executor, nextState);
      return {
        command,
        summary: summarizeState(nextState)
      };
    });
  }

  if (command === "import-openclaw") {
    if (!inputPath) {
      throw new Error("import-openclaw requires --input");
    }
    if (mode !== "merge" && mode !== "replace") {
      throw new Error(`invalid import mode: ${mode}`);
    }
    if (mode === "replace") {
      requireDestructivePermission("import-openclaw --mode replace", allowDestructive);
    }

    return await runWithExecutor(async (executor) => {
      const bundle = OpenClawImportBundleSchema.parse(JSON.parse(await readFile(inputPath, "utf8")));
      const baseState =
        mode === "replace" ? createEmptyBootstrapState() : await loadBootstrapStateFromPostgres(executor);
      const result = importOpenClawProjectedCases(bundle, baseState);
      await replaceBootstrapStateInPostgres(executor, result.state);
      return {
        command,
        inputPath,
        mode,
        importStats: result.stats,
        summary: summarizeState(result.state)
      };
    });
  }

  if (command === "verify-report") {
    if (!inputPath) {
      throw new Error("verify-report requires --input");
    }

    const report = JSON.parse(await readFile(inputPath, "utf8")) as Partial<CutoverCommandResult>;
    const approvalContract = await buildApprovalContract(inputPath, report);
    const result: CutoverCommandResult = {
      command,
      inputPath,
      mode: report.mode,
      summary:
        typeof report.summary === "object" && report.summary !== null
          ? (report.summary as StateSummary)
          : summarizeState(createEmptyBootstrapState()),
      beforeSummary:
        typeof report.beforeSummary === "object" && report.beforeSummary !== null
          ? (report.beforeSummary as StateSummary)
          : undefined,
      beforeSmoke:
        typeof report.beforeSmoke === "object" && report.beforeSmoke !== null
          ? (report.beforeSmoke as SmokeReport)
          : undefined,
      afterSmoke:
        typeof report.afterSmoke === "object" && report.afterSmoke !== null
          ? (report.afterSmoke as SmokeReport)
          : undefined,
      smokeGate:
        typeof report.smokeGate === "object" && report.smokeGate !== null
          ? (report.smokeGate as SmokeGateResult)
          : undefined,
      artifacts:
        typeof report.artifacts === "object" && report.artifacts !== null
          ? (report.artifacts as CutoverArtifacts)
          : undefined,
      bundleFingerprint: report.bundleFingerprint,
      startedAt: report.startedAt,
      finishedAt: report.finishedAt,
      approvalContract
    };

    if (!approvalContract.ok) {
      throw new CutoverCommandError("cutover report failed approval contract", result);
    }

    return result;
  }

  if (command === "verify-promotion-packet") {
    if (!inputPath) {
      throw new Error("verify-promotion-packet requires --input");
    }

    const packet = JSON.parse(await readFile(inputPath, "utf8")) as Partial<CutoverPromotionPacket>;
    const promotionVerification = buildPromotionVerification(
      packet,
      sourceEnvironment,
      promotionVerificationTargetEnvironment
    );
    const result: CutoverCommandResult = {
      command,
      inputPath,
      summary:
        packet.summary?.afterTotals !== null && packet.summary?.afterTotals
          ? {
              tenants: [],
              totals: packet.summary.afterTotals
            }
          : summarizeState(createEmptyBootstrapState()),
      promotionPacket:
        typeof packet === "object" && packet !== null
          ? (packet as CutoverPromotionPacket)
          : undefined,
      promotionVerification
    };

    if (!promotionVerification.ok) {
      throw new CutoverCommandError("promotion packet failed verification", result);
    }

    return result;
  }

  if (command === "verify-rollback-packet") {
    if (!inputPath) {
      throw new Error("verify-rollback-packet requires --input");
    }

    const packet = JSON.parse(await readFile(inputPath, "utf8")) as Partial<CutoverRollbackPacket>;
    const rollbackVerification = await buildRollbackVerification(packet, sourceEnvironment);
    const result: CutoverCommandResult = {
      command,
      inputPath,
      summary:
        packet.summary?.afterTotals !== null && packet.summary?.afterTotals
          ? {
              tenants: [],
              totals: packet.summary.afterTotals
            }
          : summarizeState(createEmptyBootstrapState()),
      rollbackPacket:
        typeof packet === "object" && packet !== null
          ? (packet as CutoverRollbackPacket)
          : undefined,
      rollbackVerification
    };

    if (!rollbackVerification.ok) {
      throw new CutoverCommandError("rollback packet failed verification", result);
    }

    return result;
  }

  if (command === "promotion-packet") {
    if (!inputPath) {
      throw new Error("promotion-packet requires --input <workflow-manifest.json>");
    }
    if (!artifactsDir) {
      throw new Error("promotion-packet requires --artifacts-dir");
    }

    const packet = await buildPromotionPacket({
      manifestPath: inputPath,
      postCutoverSmokePath: postSmokePath,
      postCutoverInspectPath: postInspectPath,
      label,
      sourceEnvironment: promotionPacketSourceEnvironment
    });
    const outputFiles = await writePromotionPacketArtifacts(artifactsDir, packet);
    const result: CutoverCommandResult = {
      command,
      inputPath,
      summary:
        packet.summary.afterTotals !== null
          ? {
              tenants: [],
              totals: packet.summary.afterTotals
            }
          : summarizeState(createEmptyBootstrapState()),
      outputPath: outputFiles.packetJsonPath,
      promotionPacket: packet
    };

    if (!packet.ok) {
      throw new CutoverCommandError("promotion packet is not ready for the next environment", result);
    }

    return result;
  }

  if (command === "rollback-packet") {
    if (!inputPath) {
      throw new Error("rollback-packet requires --input <workflow-manifest.json>");
    }
    if (!artifactsDir) {
      throw new Error("rollback-packet requires --artifacts-dir");
    }

    const packet = await buildRollbackPacket({
      manifestPath: inputPath,
      label,
      sourceEnvironment
    });
    const outputFiles = await writeRollbackPacketArtifacts(artifactsDir, packet);
    const result: CutoverCommandResult = {
      command,
      inputPath,
      summary:
        packet.summary.afterTotals !== null
          ? {
              tenants: [],
              totals: packet.summary.afterTotals
            }
          : summarizeState(createEmptyBootstrapState()),
      outputPath: outputFiles.packetJsonPath,
      rollbackPacket: packet
    };

    if (!packet.ok) {
      throw new CutoverCommandError("rollback packet is not ready for restore", result);
    }

    return result;
  }

  if (command === "verify-backup-drill") {
    if (!inputPath) {
      throw new Error("verify-backup-drill requires --input");
    }

    const packet = JSON.parse(await readFile(inputPath, "utf8")) as Partial<CutoverBackupDrillPacket>;
    const backupDrillVerification = await buildBackupDrillVerification(
      packet,
      sourceEnvironment,
      maxRtoSeconds,
      maxRpoSeconds
    );
    const result: CutoverCommandResult = {
      command,
      inputPath,
      summary:
        packet.summary?.restoredTotals !== null && packet.summary?.restoredTotals
          ? {
              tenants: [],
              totals: packet.summary.restoredTotals
            }
          : summarizeState(createEmptyBootstrapState()),
      backupDrillPacket:
        typeof packet === "object" && packet !== null
          ? (packet as CutoverBackupDrillPacket)
          : undefined,
      backupDrillVerification
    };

    if (!backupDrillVerification.ok) {
      throw new CutoverCommandError("backup drill packet failed verification", result);
    }

    return result;
  }

  if (command === "backup-drill-packet") {
    if (!inputPath) {
      throw new Error("backup-drill-packet requires --input <backup-drill-manifest.json>");
    }
    if (!artifactsDir) {
      throw new Error("backup-drill-packet requires --artifacts-dir");
    }

    const packet = await buildBackupDrillPacket({
      manifestPath: inputPath,
      label,
      sourceEnvironment,
      maxRtoSeconds,
      maxRpoSeconds
    });
    const outputFiles = await writeBackupDrillPacketArtifacts(artifactsDir, packet);
    const result: CutoverCommandResult = {
      command,
      inputPath,
      summary:
        packet.summary.restoredTotals !== null
          ? {
              tenants: [],
              totals: packet.summary.restoredTotals
            }
          : summarizeState(createEmptyBootstrapState()),
      outputPath: outputFiles.packetJsonPath,
      backupDrillPacket: packet
    };

    if (!packet.ok) {
      throw new CutoverCommandError("backup drill packet is not ready", result);
    }

    return result;
  }

  if (command === "cutover-openclaw") {
    if (!inputPath) {
      throw new Error("cutover-openclaw requires --input");
    }
    if (!artifactsDir) {
      throw new Error("cutover-openclaw requires --artifacts-dir");
    }
    if (mode !== "merge" && mode !== "replace") {
      throw new Error(`invalid import mode: ${mode}`);
    }
    if (mode === "replace") {
      requireDestructivePermission("cutover-openclaw --mode replace", allowDestructive);
    }

    return await runWithExecutor(async (executor) => {
      const startedAt = nowIso();
      const artifactDirectory = join(artifactsDir, `${artifactStamp()}-openclaw-${mode}`);
      await mkdir(artifactDirectory, { recursive: true });

      const rawBundle = await readFile(inputPath, "utf8");
      const parsedBundle = OpenClawImportBundleSchema.parse(JSON.parse(rawBundle));

      const beforeState = await loadBootstrapStateFromPostgres(executor);
      const beforeSummary = summarizeState(beforeState);
      const beforeSmoke = smokeState(beforeState);

      const beforeStatePath = join(artifactDirectory, "before-state.json");
      const afterStatePath = join(artifactDirectory, "after-state.json");
      const reportPath = join(artifactDirectory, "report.json");
      const copiedBundlePath = join(artifactDirectory, "input-openclaw-bundle.json");

      await writeJsonFile(beforeStatePath, beforeState);
      await writeJsonFile(copiedBundlePath, JSON.parse(rawBundle));

      const baseState = mode === "replace" ? createEmptyBootstrapState() : beforeState;
      const imported = importOpenClawProjectedCases(parsedBundle, baseState);
      await replaceBootstrapStateInPostgres(executor, imported.state);

      const afterState = await loadBootstrapStateFromPostgres(executor);
      const afterSummary = summarizeState(afterState);
      const afterSmoke = smokeState(afterState);
      const smokeGate = compareSmoke(beforeSmoke, afterSmoke);
      const finishedAt = nowIso();

      await writeJsonFile(afterStatePath, afterState);

      const result: CutoverCommandResult = {
        command,
        inputPath,
        mode,
        summary: afterSummary,
        beforeSummary,
        importStats: imported.stats,
        beforeSmoke,
        afterSmoke,
        smokeGate,
        artifacts: {
          directory: artifactDirectory,
          inputBundlePath: copiedBundlePath,
          beforeStatePath,
          afterStatePath,
          reportPath
        },
        bundleFingerprint: sha256(rawBundle),
        startedAt,
        finishedAt
      };

      await writeJsonFile(reportPath, result);

      if (!smokeGate.passed) {
        throw new CutoverCommandError("cutover-openclaw introduced new canonical smoke errors", result);
      }

      return result;
    });
  }

  if (commandRequiresExecutor(command)) {
    throw new Error(`command ${command} was not implemented`);
  }

  throw new Error(`unknown command: ${command}`);
}

export async function runCutoverCli(
  argv: readonly string[],
  options: RunCutoverCliOptions = {}
): Promise<number> {
  const io = getIo(options.io);
  const parsed = parseArgs({
    args: [...argv],
    allowPositionals: true,
    options: {
      json: { type: "boolean" },
      help: { type: "boolean" }
    },
    strict: false
  });
  const wantsJson = parsed.values.json ?? false;

  try {
    const result = await executeCutoverCommand(argv, options);

    if (result.command === "help") {
      io.stdout(`${helpText()}\n`);
      return 0;
    }

    if (wantsJson) {
      io.stdout(`${JSON.stringify(result, null, 2)}\n`);
      return 0;
    }

    io.stdout(renderHumanResult(result));
    return 0;
  } catch (error) {
    if (error instanceof CutoverCommandError && error.result) {
      if (wantsJson) {
        io.stdout(
          `${JSON.stringify(
            {
              ok: false,
              error: error.message,
              ...error.result
            },
            null,
            2
          )}\n`
        );
      } else {
        io.stdout(renderHumanResult(error.result));
      }
      io.stderr(`${error.message}\n`);
      return 1;
    }

    const message = error instanceof Error ? error.message : String(error);
    io.stderr(`${message}\n`);
    return 1;
  }
}

function isMainModule(): boolean {
  if (!process.argv[1]) {
    return false;
  }
  return resolve(process.argv[1]) === fileURLToPath(import.meta.url);
}

if (isMainModule()) {
  const exitCode = await runCutoverCli(process.argv.slice(2));
  process.exitCode = exitCode;
}
