#!/usr/bin/env node
'use strict';

const { spawnSync } = require('child_process');
const {
    mkdirSync,
    existsSync,
    readFileSync,
    writeFileSync,
    readdirSync,
    statSync,
    mkdtempSync,
    rmSync,
} = require('fs');
const { dirname, resolve, basename, join } = require('path');
const { tmpdir } = require('os');

const ROOT = resolve(__dirname, '..');
const DEFAULT_JSON_OUT = 'verification/runtime/prod-readiness-summary.json';
const DEFAULT_MD_OUT = 'verification/runtime/prod-readiness-summary.md';
const DEFAULT_SENTRY_JSON_OUT = 'verification/runtime/sentry-events-last.json';
const DEFAULT_PROD_MONITOR_JSON_OUT =
    'verification/runtime/prod-monitor-last.json';
const PHASE6_SCHEDULE_AT_RISK_THRESHOLD_MINUTES = 24 * 60;
const CRITICAL_WORKFLOW_INPROGRESS_GRACE_MINUTES = 4;
const WEEKLY_KPI_SCHEDULE_UTC = Object.freeze({
    cron: '0 14 * * 1',
    weekday: 1, // Monday (0=Sunday)
    hour: 14,
    minute: 0,
    timezone: 'UTC',
});
const FLOW_OS_RECOVERY_CYCLE = Object.freeze({
    id: 'flow-os-recovery-2026-03-21',
    status: 'active',
    startsAt: '2026-03-21',
    endsAt: '2026-04-20',
    objective: 'stabilize_production',
    allowedSlice:
        'admin v3 + queue/turnero + auth Google + readiness + deploy',
    parkedFronts: Object.freeze([
        'superficies nativas nuevas',
        'expansion LeadOps',
        'ampliacion de estados',
        'rediseno grande de la web publica',
        'nuevas lineas comerciales',
        'cualquier trabajo multi-sede',
    ]),
    statusDoc: 'docs/PRODUCT_OPERATIONAL_STATUS.md',
    planDoc: 'docs/FLOW_OS_RECOVERY_PLAN.md',
    dailyRitualCommands: Object.freeze([
        'npm run flow-os:recovery:daily',
        'npm run gate:admin:rollout:auth:node',
        'npm run verify:prod:turnero:web-pilot',
        'npm run monitor:prod',
    ]),
});

function hasFlag(name) {
    return process.argv.includes(`--${name}`);
}

function parseStringArg(name, fallback) {
    const prefix = `--${name}=`;
    const arg = process.argv.find((value) => value.startsWith(prefix));
    if (!arg) return fallback;
    const raw = arg.slice(prefix.length).trim();
    return raw === '' ? fallback : raw;
}

function parseIntArg(name, fallback, min = 1) {
    const raw = parseStringArg(name, null);
    if (raw === null) return fallback;
    const parsed = Number.parseInt(raw, 10);
    if (!Number.isFinite(parsed) || parsed < min) {
        throw new Error(`Argumento invalido --${name}: ${raw}`);
    }
    return parsed;
}

function ensureDirForFile(filePath) {
    mkdirSync(dirname(filePath), { recursive: true });
}

function stripLeadingUtf8Bom(value) {
    return String(value || '').replace(/^\uFEFF/, '');
}

function safeJsonParse(text, fallback = null) {
    try {
        return JSON.parse(stripLeadingUtf8Bom(text));
    } catch (_error) {
        return fallback;
    }
}

function safeJsonParseOutput(text, fallback = null) {
    const normalized = stripLeadingUtf8Bom(text);
    const direct = safeJsonParse(normalized, null);
    if (direct !== null) {
        return direct;
    }

    const candidateIndexes = [];
    for (let index = 0; index < normalized.length; index += 1) {
        const current = normalized[index];
        const startsJson = current === '{' || current === '[';
        const startsLine = index === 0 || normalized[index - 1] === '\n';
        if (startsJson && startsLine) {
            candidateIndexes.push(index);
        }
    }

    for (let index = candidateIndexes.length - 1; index >= 0; index -= 1) {
        const candidate = normalized.slice(candidateIndexes[index]).trim();
        const parsed = safeJsonParse(candidate, null);
        if (parsed !== null) {
            return parsed;
        }
    }

    return fallback;
}

function getGhInvocation() {
    const override = process.env.GH_CLI_PATH;
    if (!override) {
        return {
            command: 'gh',
            argsPrefix: [],
            label: 'gh',
        };
    }

    if (/\.(c?js|mjs)$/i.test(override)) {
        return {
            command: process.execPath,
            argsPrefix: [override],
            label: override,
        };
    }

    return {
        command: override,
        argsPrefix: [],
        label: override,
    };
}

function runGh(args, { allowFailure = true } = {}) {
    const gh = getGhInvocation();
    const result = spawnSync(gh.command, [...gh.argsPrefix, ...args], {
        cwd: ROOT,
        encoding: 'utf8',
        windowsHide: true,
    });

    const stdout = String(result.stdout || '');
    const stderr = String(result.stderr || '');
    const ok = result.status === 0;
    const response = {
        ok,
        exitCode: typeof result.status === 'number' ? result.status : 1,
        command: `${gh.label} ${args.join(' ')}`,
        stdout,
        stderr,
        error:
            ok || allowFailure
                ? null
                : `gh fallo (${result.status}): ${stderr || stdout || 'sin detalle'}`,
    };

    if (!ok && !allowFailure) {
        throw new Error(response.error);
    }
    return response;
}

function runGhJson(args, { allowFailure = true } = {}) {
    const response = runGh(args, { allowFailure });
    return {
        ...response,
        json: response.ok ? safeJsonParse(response.stdout, null) : null,
    };
}

function runNodeJsonScript(
    scriptRelativePath,
    args,
    { allowFailure = true } = {}
) {
    const scriptPath = resolve(ROOT, scriptRelativePath);
    const commandLabel = `node ${scriptRelativePath} ${args.join(' ')}`.trim();
    if (!existsSync(scriptPath)) {
        return {
            available: false,
            ok: false,
            exitCode: 1,
            command: commandLabel,
            stdout: '',
            stderr: '',
            json: null,
            error: `No existe ${scriptRelativePath} en ${ROOT}`,
        };
    }

    const result = spawnSync(process.execPath, [scriptPath, ...args], {
        cwd: ROOT,
        encoding: 'utf8',
        windowsHide: true,
    });
    const stdout = String(result.stdout || '');
    const stderr = String(result.stderr || '');
    const ok = result.status === 0;
    const response = {
        available: true,
        ok,
        exitCode: typeof result.status === 'number' ? result.status : 1,
        command: commandLabel,
        stdout,
        stderr,
        json: safeJsonParseOutput(stdout, null),
        error:
            ok || allowFailure
                ? null
                : `node fallo (${result.status}): ${stderr || stdout || 'sin detalle'}`,
    };

    if (!ok && !allowFailure) {
        throw new Error(response.error);
    }
    return response;
}

function toIso(value) {
    if (!value) return null;
    const t = Date.parse(String(value));
    if (!Number.isFinite(t)) return null;
    return new Date(t).toISOString();
}

function durationSeconds(start, end) {
    const a = Date.parse(String(start || ''));
    const b = Date.parse(String(end || ''));
    if (!Number.isFinite(a) || !Number.isFinite(b) || b < a) return null;
    return Math.round((b - a) / 1000);
}

function formatDuration(seconds) {
    if (!Number.isFinite(seconds) || seconds < 0) return 'n/a';
    if (seconds < 60) return `${seconds}s`;
    const min = Math.floor(seconds / 60);
    const sec = seconds % 60;
    return `${min}m${sec}s`;
}

function ageMinutesFromIso(isoText) {
    if (!isoText) return null;
    const t = Date.parse(String(isoText));
    if (!Number.isFinite(t)) return null;
    return Math.round((Date.now() - t) / 60000);
}

function minutesUntilIso(isoText) {
    if (!isoText) return null;
    const t = Date.parse(String(isoText));
    if (!Number.isFinite(t)) return null;
    return Math.round((t - Date.now()) / 60000);
}

function formatAgeMinutes(ageMinutes) {
    if (!Number.isFinite(ageMinutes)) return 'n/a';
    if (ageMinutes < 60) return `${ageMinutes}m`;
    const h = Math.floor(ageMinutes / 60);
    const m = ageMinutes % 60;
    return `${h}h${m}m`;
}

function formatMinutesDistance(minutes) {
    if (!Number.isFinite(minutes)) return 'n/a';
    const abs = Math.abs(minutes);
    const base = formatAgeMinutes(abs);
    if (base === 'n/a') return 'n/a';
    return minutes < 0 ? `-${base}` : base;
}

function computeNextWeeklyOccurrenceUtc(schedule, now = new Date()) {
    if (!schedule) return null;
    const nowDate = now instanceof Date ? now : new Date(now);
    if (!Number.isFinite(nowDate.getTime())) return null;

    const target = new Date(nowDate.getTime());
    target.setUTCSeconds(0, 0);
    target.setUTCMinutes(schedule.minute);
    target.setUTCHours(schedule.hour);
    const deltaDays = (((schedule.weekday - nowDate.getUTCDay()) % 7) + 7) % 7;
    target.setUTCDate(nowDate.getUTCDate() + deltaDays);
    if (target.getTime() <= nowDate.getTime()) {
        target.setUTCDate(target.getUTCDate() + 7);
    }
    return target.toISOString();
}

function computePhase6SchedulePace({
    scheduleSuccessStreak,
    scheduleCyclesTarget,
    scheduleCyclesRemaining,
    nextScheduleInMinutes,
}) {
    const target = Number.isFinite(Number(scheduleCyclesTarget))
        ? Number(scheduleCyclesTarget)
        : 2;
    const remaining = Number.isFinite(Number(scheduleCyclesRemaining))
        ? Number(scheduleCyclesRemaining)
        : target;
    const streak = Number.isFinite(Number(scheduleSuccessStreak))
        ? Number(scheduleSuccessStreak)
        : 0;
    const nextIn = Number.isFinite(Number(nextScheduleInMinutes))
        ? Number(nextScheduleInMinutes)
        : null;

    if (streak >= target || remaining <= 0) {
        return {
            signal: 'done',
            reason: 'schedule_target_reached',
            atRiskThresholdMinutes: PHASE6_SCHEDULE_AT_RISK_THRESHOLD_MINUTES,
            atRiskThresholdLabel: formatMinutesDistance(
                PHASE6_SCHEDULE_AT_RISK_THRESHOLD_MINUTES
            ),
        };
    }
    if (nextIn === null) {
        return {
            signal: 'on_track',
            reason: 'next_schedule_unknown',
            atRiskThresholdMinutes: PHASE6_SCHEDULE_AT_RISK_THRESHOLD_MINUTES,
            atRiskThresholdLabel: formatMinutesDistance(
                PHASE6_SCHEDULE_AT_RISK_THRESHOLD_MINUTES
            ),
        };
    }
    if (nextIn < 0 && remaining > 0) {
        return {
            signal: 'at_risk',
            reason: 'next_schedule_overdue',
            atRiskThresholdMinutes: PHASE6_SCHEDULE_AT_RISK_THRESHOLD_MINUTES,
            atRiskThresholdLabel: formatMinutesDistance(
                PHASE6_SCHEDULE_AT_RISK_THRESHOLD_MINUTES
            ),
        };
    }
    if (
        remaining >= target &&
        nextIn <= PHASE6_SCHEDULE_AT_RISK_THRESHOLD_MINUTES
    ) {
        return {
            signal: 'at_risk',
            reason: 'zero_schedule_progress_and_next_cycle_imminent',
            atRiskThresholdMinutes: PHASE6_SCHEDULE_AT_RISK_THRESHOLD_MINUTES,
            atRiskThresholdLabel: formatMinutesDistance(
                PHASE6_SCHEDULE_AT_RISK_THRESHOLD_MINUTES
            ),
        };
    }
    return {
        signal: 'on_track',
        reason:
            streak > 0
                ? 'partial_schedule_progress'
                : 'waiting_for_next_schedule_cycle',
        atRiskThresholdMinutes: PHASE6_SCHEDULE_AT_RISK_THRESHOLD_MINUTES,
        atRiskThresholdLabel: formatMinutesDistance(
            PHASE6_SCHEDULE_AT_RISK_THRESHOLD_MINUTES
        ),
    };
}

function mapRun(raw) {
    if (!raw) return null;
    const createdAt = toIso(raw.createdAt);
    const updatedAt = toIso(raw.updatedAt);
    const seconds = durationSeconds(createdAt, updatedAt);
    return {
        id: raw.databaseId ?? null,
        workflowName: raw.workflowName || raw.name || null,
        displayTitle: raw.displayTitle || null,
        status: raw.status || null,
        conclusion: raw.conclusion || null,
        event: raw.event || null,
        headBranch: raw.headBranch || null,
        headSha: raw.headSha || null,
        url: raw.url || null,
        createdAt,
        updatedAt,
        durationSeconds: seconds,
        durationLabel: formatDuration(seconds),
        ageMinutes: ageMinutesFromIso(updatedAt || createdAt),
        ageLabel: formatAgeMinutes(ageMinutesFromIso(updatedAt || createdAt)),
    };
}

function isSkippedCompletedRun(run) {
    return Boolean(
        run &&
        run.status === 'completed' &&
        String(run.conclusion || '').toLowerCase() === 'skipped'
    );
}

function selectRepresentativeWorkflowRun(runs) {
    const list = Array.isArray(runs) ? runs.filter(Boolean) : [];
    const latest = list[0] || null;
    if (!latest) {
        return {
            latest: null,
            latestEffective: null,
            latestSkippedFallback: false,
        };
    }
    if (!isSkippedCompletedRun(latest)) {
        return {
            latest,
            latestEffective: latest,
            latestSkippedFallback: false,
        };
    }
    const latestNonSkipped =
        list.find((run) => !isSkippedCompletedRun(run)) || null;
    return {
        latest,
        latestEffective: latestNonSkipped || latest,
        latestSkippedFallback: Boolean(latestNonSkipped),
    };
}

function getWorkflowRunForHealth(wrapper) {
    if (!wrapper) return null;
    return wrapper.latestEffective || wrapper.latest || null;
}

function isInProgressWithinGrace(
    run,
    graceMinutes = CRITICAL_WORKFLOW_INPROGRESS_GRACE_MINUTES
) {
    const normalizedGrace =
        Number.isFinite(Number(graceMinutes)) && Number(graceMinutes) >= 0
            ? Number(graceMinutes)
            : CRITICAL_WORKFLOW_INPROGRESS_GRACE_MINUTES;
    return Boolean(
        run &&
        String(run.status || '').toLowerCase() !== 'completed' &&
        Number.isFinite(Number(run.ageMinutes)) &&
        Number(run.ageMinutes) <= normalizedGrace
    );
}

function fetchLatestWorkflowRun({ workflowRef, label }, branch) {
    const res = runGhJson(
        [
            'run',
            'list',
            '--workflow',
            workflowRef,
            '--branch',
            branch,
            '--limit',
            '6',
            '--json',
            'databaseId,displayTitle,workflowName,status,conclusion,url,createdAt,updatedAt,headBranch,headSha,event',
        ],
        { allowFailure: true }
    );
    if (!res.ok) {
        return {
            workflowName: label,
            workflowRef,
            available: false,
            error: res.stderr || res.stdout || `gh exit ${res.exitCode}`,
            latest: null,
        };
    }
    const list = Array.isArray(res.json) ? res.json : [];
    const mappedRuns = list.map((item) => mapRun(item)).filter(Boolean);
    const selected = selectRepresentativeWorkflowRun(mappedRuns);
    return {
        workflowName: label,
        workflowRef,
        available: true,
        error: null,
        latest: selected.latest,
        latestEffective: selected.latestEffective,
        latestSkippedFallback: selected.latestSkippedFallback,
        recentRunsSample: mappedRuns.slice(0, 6),
    };
}

function fetchRecentWorkflowRuns({ workflowRef, label }, branch, limit = 12) {
    const normalizedLimit =
        Number.isFinite(Number(limit)) && Number(limit) > 0
            ? String(Math.trunc(Number(limit)))
            : '12';
    const res = runGhJson(
        [
            'run',
            'list',
            '--workflow',
            workflowRef,
            '--branch',
            branch,
            '--limit',
            normalizedLimit,
            '--json',
            'databaseId,displayTitle,workflowName,status,conclusion,url,createdAt,updatedAt,headBranch,headSha,event',
        ],
        { allowFailure: true }
    );

    if (!res.ok) {
        return {
            workflowName: label,
            workflowRef,
            available: false,
            error: res.stderr || res.stdout || `gh exit ${res.exitCode}`,
            runs: [],
        };
    }

    const list = Array.isArray(res.json) ? res.json : [];
    return {
        workflowName: label,
        workflowRef,
        available: true,
        error: null,
        runs: list.map((item) => mapRun(item)).filter(Boolean),
    };
}

function fetchOpenProdAlerts() {
    const res = runGhJson(
        [
            'issue',
            'list',
            '--state',
            'open',
            '--search',
            '[ALERTA PROD]',
            '--json',
            'number,title,url,createdAt,updatedAt',
        ],
        { allowFailure: true }
    );
    if (!res.ok) {
        return {
            available: false,
            count: null,
            issues: [],
            error: res.stderr || res.stdout || `gh exit ${res.exitCode}`,
        };
    }
    const issues = Array.isArray(res.json) ? res.json : [];
    return {
        available: true,
        count: issues.length,
        issues: issues.map((item) => ({
            number: item.number,
            title: item.title || null,
            url: item.url || null,
            createdAt: toIso(item.createdAt),
            updatedAt: toIso(item.updatedAt),
        })),
        error: null,
    };
}

function findLatestWeeklyReportJson(outputDir) {
    const absoluteDir = resolve(ROOT, outputDir);
    if (!existsSync(absoluteDir)) return null;
    const candidates = readdirSync(absoluteDir)
        .filter((name) => /^weekly-report-\d{8}\.json$/i.test(name))
        .map((name) => {
            const fullPath = resolve(absoluteDir, name);
            return { name, fullPath, mtimeMs: getPathMtimeMs(fullPath, 0) };
        })
        .sort((a, b) => b.mtimeMs - a.mtimeMs);
    return candidates[0] || null;
}

function findFileRecursive(rootDir, matcher) {
    const stack = [rootDir];
    const matches = [];
    const matchFn = typeof matcher === 'function' ? matcher : () => false;
    while (stack.length > 0) {
        const current = stack.pop();
        let entries;
        try {
            entries = readdirSync(current, { withFileTypes: true });
        } catch (_error) {
            continue;
        }
        for (const entry of entries) {
            const fullPath = join(current, entry.name);
            if (entry.isDirectory()) {
                stack.push(fullPath);
                continue;
            }
            if (matchFn(entry.name, fullPath)) {
                matches.push({
                    fullPath,
                    name: entry.name,
                    mtimeMs: getPathMtimeMs(fullPath, 0),
                });
            }
        }
    }
    matches.sort((a, b) => b.mtimeMs - a.mtimeMs);
    return matches[0] || null;
}

function getPathMtimeMs(filePath, fallback = null) {
    try {
        return statSync(filePath).mtimeMs;
    } catch (_error) {
        return fallback;
    }
}

function parseWeeklyReportPayload(payload, meta = {}) {
    const warningCounts = payload.warningCounts || {};
    const warningsBySeverity = payload.warningsBySeverity || {};
    const latency = payload.latency || {};
    const retention = payload.retention || {};
    const conversion = payload.conversion || {};
    const conversionTrend = payload.conversionTrend || {};
    const retentionTrend = payload.retentionTrend || {};
    const availabilityBench = Array.isArray(latency.bench)
        ? latency.bench.find((item) => item && item.Name === 'availability')
        : null;

    const inferredWarnings = Array.isArray(payload.warnings)
        ? payload.warnings
        : [];
    const criticalList = Array.isArray(warningsBySeverity.critical)
        ? warningsBySeverity.critical
        : [];
    const nonCriticalList = Array.isArray(warningsBySeverity.nonCritical)
        ? warningsBySeverity.nonCritical
        : [];

    const totalCount = Number.isFinite(Number(warningCounts.total))
        ? Number(warningCounts.total)
        : inferredWarnings.length;
    const criticalCount = Number.isFinite(Number(warningCounts.critical))
        ? Number(warningCounts.critical)
        : criticalList.length;
    const nonCriticalCount = Number.isFinite(Number(warningCounts.nonCritical))
        ? Number(warningCounts.nonCritical)
        : nonCriticalList.length;

    return {
        found: true,
        source: meta.source || 'local',
        outputDir: meta.outputDir || null,
        path: meta.path || null,
        fileName: meta.fileName || (meta.path ? basename(meta.path) : null),
        mtime:
            meta.mtimeIso ||
            (Number.isFinite(meta.mtimeMs)
                ? new Date(meta.mtimeMs).toISOString()
                : null),
        generatedAt: toIso(payload.generatedAt),
        domain: payload.domain || null,
        reportRun: meta.reportRun || null,
        warningCounts: {
            total: totalCount,
            critical: criticalCount,
            nonCritical: nonCriticalCount,
        },
        warnings: inferredWarnings,
        warningsBySeverity: {
            critical: criticalList,
            nonCritical: nonCriticalList,
        },
        latency: {
            coreP95MaxMs:
                latency.coreP95MaxMs !== undefined
                    ? latency.coreP95MaxMs
                    : null,
            figoPostP95Ms:
                latency.figoPostP95Ms !== undefined
                    ? latency.figoPostP95Ms
                    : null,
            availabilityP95Ms:
                availabilityBench && availabilityBench.P95Ms !== undefined
                    ? availabilityBench.P95Ms
                    : null,
        },
        retention: {
            noShowRatePct:
                retention.noShowRatePct !== undefined
                    ? retention.noShowRatePct
                    : null,
            recurrenceRatePct:
                retention.recurrenceRatePct !== undefined
                    ? retention.recurrenceRatePct
                    : null,
            uniquePatients:
                retention.uniquePatients !== undefined
                    ? retention.uniquePatients
                    : null,
            recurrentPatients:
                retention.recurrentPatients !== undefined
                    ? retention.recurrentPatients
                    : null,
        },
        retentionTrend: {
            noShowRateDeltaPct:
                retentionTrend.noShowRateDeltaPct !== undefined
                    ? retentionTrend.noShowRateDeltaPct
                    : null,
            recurrenceRateDeltaPct:
                retentionTrend.recurrenceRateDeltaPct !== undefined
                    ? retentionTrend.recurrenceRateDeltaPct
                    : null,
        },
        conversion: {
            viewBooking:
                conversion.viewBooking !== undefined
                    ? conversion.viewBooking
                    : null,
            startCheckout:
                conversion.startCheckout !== undefined
                    ? conversion.startCheckout
                    : null,
            startCheckoutRatePct:
                conversion.startCheckoutRatePct !== undefined
                    ? conversion.startCheckoutRatePct
                    : null,
            bookingConfirmed:
                conversion.bookingConfirmed !== undefined
                    ? conversion.bookingConfirmed
                    : null,
            bookingConfirmedRatePct:
                conversion.bookingConfirmedRatePct !== undefined
                    ? conversion.bookingConfirmedRatePct
                    : null,
        },
        conversionTrend: {
            startCheckoutRateDeltaPct:
                conversionTrend.startCheckoutRateDeltaPct !== undefined
                    ? conversionTrend.startCheckoutRateDeltaPct
                    : null,
            bookingConfirmedRateDeltaPct:
                conversionTrend.bookingConfirmedRateDeltaPct !== undefined
                    ? conversionTrend.bookingConfirmedRateDeltaPct
                    : null,
        },
        error: null,
    };
}

function readWeeklyReportFromFile(filePath, meta = {}) {
    let payload;
    try {
        payload = JSON.parse(readFileSync(filePath, 'utf8'));
    } catch (error) {
        return {
            found: true,
            source: meta.source || 'local',
            outputDir: meta.outputDir || null,
            path: filePath,
            fileName: basename(filePath),
            reportRun: meta.reportRun || null,
            error: `No se pudo parsear JSON: ${error.message}`,
        };
    }

    return parseWeeklyReportPayload(payload, {
        ...meta,
        path: filePath,
    });
}

function readLatestWeeklyReport(outputDir) {
    const latest = findLatestWeeklyReportJson(outputDir);
    if (!latest) {
        return {
            found: false,
            source: 'local',
            outputDir,
            path: null,
            error: null,
        };
    }

    return readWeeklyReportFromFile(latest.fullPath, {
        source: 'local',
        outputDir,
        fileName: latest.name,
        mtimeMs: latest.mtimeMs,
    });
}

function downloadNamedArtifact(runId, artifactName, matcher, missingError) {
    const tempBase = mkdtempSync(join(tmpdir(), 'prod-readiness-artifact-'));
    const res = runGh(
        ['run', 'download', String(runId), '-n', artifactName, '-D', tempBase],
        { allowFailure: true }
    );
    if (!res.ok) {
        try {
            rmSync(tempBase, { recursive: true, force: true });
        } catch (_error) {
            // best effort
        }
        return {
            ok: false,
            error: res.stderr || res.stdout || `gh exit ${res.exitCode}`,
            tempDir: null,
            file: null,
        };
    }

    const file = findFileRecursive(tempBase, matcher);
    if (!file) {
        try {
            rmSync(tempBase, { recursive: true, force: true });
        } catch (_error) {
            // best effort
        }
        return {
            ok: false,
            error: missingError,
            tempDir: null,
            file: null,
        };
    }

    return {
        ok: true,
        error: null,
        tempDir: tempBase,
        file,
    };
}

function downloadWeeklyReportArtifact(runId) {
    return downloadNamedArtifact(
        runId,
        'weekly-kpi-report',
        (name) => /^weekly-report-\d{8}\.json$/i.test(name),
        'Artifact weekly-kpi-report no contiene weekly-report-*.json'
    );
}

function readWeeklyReportFromRemoteArtifact(
    weeklyRunWrapper,
    fallbackOutputDir
) {
    const run = getWorkflowRunForHealth(weeklyRunWrapper);
    if (!weeklyRunWrapper || !weeklyRunWrapper.available || !run || !run.id) {
        return {
            found: false,
            source: 'remote_artifact',
            outputDir: fallbackOutputDir || null,
            path: null,
            error: 'No hay run de Weekly KPI disponible para descargar artifact',
        };
    }
    const downloaded = downloadWeeklyReportArtifact(run.id);
    if (!downloaded.ok) {
        return {
            found: false,
            source: 'remote_artifact',
            outputDir: fallbackOutputDir || null,
            path: null,
            reportRun: {
                id: run.id,
                url: run.url || null,
                conclusion: run.conclusion || null,
                status: run.status || null,
                updatedAt: run.updatedAt || null,
            },
            error: downloaded.error,
        };
    }

    try {
        return readWeeklyReportFromFile(downloaded.file.fullPath, {
            source: 'remote_artifact',
            outputDir: fallbackOutputDir || null,
            fileName: downloaded.file.name,
            mtimeMs: downloaded.file.mtimeMs,
            reportRun: {
                id: run.id,
                url: run.url || null,
                conclusion: run.conclusion || null,
                status: run.status || null,
                updatedAt: run.updatedAt || null,
                headSha: run.headSha || null,
            },
        });
    } finally {
        try {
            rmSync(downloaded.tempDir, { recursive: true, force: true });
        } catch (_error) {
            // best effort
        }
    }
}

function readWeeklyReportPreferred({ mode, weeklyDir, weeklyKpiRun }) {
    const normalizedMode = String(mode || 'auto')
        .trim()
        .toLowerCase();
    if (!['auto', 'local', 'remote'].includes(normalizedMode)) {
        throw new Error(
            `Argumento invalido --weekly-source: ${mode}. Usa auto|local|remote`
        );
    }

    if (normalizedMode === 'local') {
        return readLatestWeeklyReport(weeklyDir);
    }

    const remoteReport = readWeeklyReportFromRemoteArtifact(
        weeklyKpiRun,
        weeklyDir
    );
    if (normalizedMode === 'remote') {
        return remoteReport;
    }

    if (remoteReport.found && !remoteReport.error) {
        return remoteReport;
    }

    const localReport = readLatestWeeklyReport(weeklyDir);
    if (localReport.found && !localReport.error) {
        return {
            ...localReport,
            fallbackFromRemoteError: remoteReport.error || null,
            fallbackAttempted: true,
        };
    }

    if (!remoteReport.found && !localReport.found) {
        return {
            ...localReport,
            source: 'auto',
            fallbackAttempted: true,
            fallbackFromRemoteError: remoteReport.error || null,
        };
    }

    return {
        ...(remoteReport.found ? remoteReport : localReport),
        fallbackAttempted: true,
        fallbackFromRemoteError: remoteReport.error || null,
    };
}

function parseSentryEvidencePayload(payload, meta = {}) {
    const backend = payload.backend || {};
    const frontend = payload.frontend || {};
    const failureReason = payload.failureReason || {};
    return {
        found: true,
        source: meta.source || 'local',
        path: meta.path || null,
        fileName: meta.fileName || (meta.path ? basename(meta.path) : null),
        mtime:
            meta.mtimeIso ||
            (Number.isFinite(meta.mtimeMs)
                ? new Date(meta.mtimeMs).toISOString()
                : null),
        reportRun: meta.reportRun || null,
        generatedAt: toIso(payload.generatedAt),
        ok: Boolean(payload.ok),
        status: payload.status || (payload.ok ? 'ok' : 'unknown'),
        baseUrl: payload.baseUrl || null,
        org: payload.org || null,
        lookbackHours: Number.isFinite(Number(payload.lookbackHours))
            ? Number(payload.lookbackHours)
            : null,
        allowMissing: Boolean(payload.allowMissing),
        maxAgeHours:
            payload.maxAgeHours !== null &&
            payload.maxAgeHours !== undefined &&
            Number.isFinite(Number(payload.maxAgeHours))
                ? Number(payload.maxAgeHours)
                : null,
        missingEnv: Array.isArray(payload.missingEnv) ? payload.missingEnv : [],
        missingProjects: Array.isArray(payload.missingProjects)
            ? payload.missingProjects
            : [],
        staleProjects: Array.isArray(payload.staleProjects)
            ? payload.staleProjects
            : [],
        actionRequired: payload.actionRequired || null,
        failureReason:
            failureReason.code || failureReason.message
                ? {
                      code: failureReason.code || null,
                      message: failureReason.message || null,
                  }
                : null,
        backend: {
            project: backend.project || null,
            found: Boolean(backend.found),
            latest: backend.latest || null,
        },
        frontend: {
            project: frontend.project || null,
            found: Boolean(frontend.found),
            latest: frontend.latest || null,
        },
        error: null,
    };
}

function readSentryEvidenceFromFile(filePath, meta = {}) {
    let payload;
    try {
        payload = JSON.parse(readFileSync(filePath, 'utf8'));
    } catch (error) {
        return {
            found: true,
            source: meta.source || 'local',
            path: filePath,
            fileName: basename(filePath),
            reportRun: meta.reportRun || null,
            error: `No se pudo parsear JSON: ${error.message}`,
        };
    }

    return parseSentryEvidencePayload(payload, {
        ...meta,
        path: filePath,
    });
}

function readLatestSentryEvidence(localPath) {
    const absolutePath = resolve(ROOT, localPath);
    if (!existsSync(absolutePath)) {
        return {
            found: false,
            source: 'local',
            path: absolutePath,
            error: null,
        };
    }

    return readSentryEvidenceFromFile(absolutePath, {
        source: 'local',
        fileName: basename(absolutePath),
        mtimeMs: getPathMtimeMs(absolutePath),
    });
}

function downloadSentryEvidenceArtifact(runId) {
    return downloadNamedArtifact(
        runId,
        'sentry-events-report',
        (name) => /^sentry-events-last\.json$/i.test(name),
        'Artifact sentry-events-report no contiene sentry-events-last.json'
    );
}

function readSentryEvidenceFromRemoteArtifact(sentryRunWrapper, fallbackPath) {
    const run = getWorkflowRunForHealth(sentryRunWrapper);
    if (!sentryRunWrapper || !sentryRunWrapper.available || !run || !run.id) {
        return {
            found: false,
            source: 'remote_artifact',
            path: resolve(ROOT, fallbackPath || DEFAULT_SENTRY_JSON_OUT),
            error: 'No hay run de Sentry Events Verify disponible para descargar artifact',
        };
    }
    const downloaded = downloadSentryEvidenceArtifact(run.id);
    if (!downloaded.ok) {
        return {
            found: false,
            source: 'remote_artifact',
            path: resolve(ROOT, fallbackPath || DEFAULT_SENTRY_JSON_OUT),
            reportRun: {
                id: run.id,
                url: run.url || null,
                conclusion: run.conclusion || null,
                status: run.status || null,
                updatedAt: run.updatedAt || null,
            },
            error: downloaded.error,
        };
    }

    try {
        return readSentryEvidenceFromFile(downloaded.file.fullPath, {
            source: 'remote_artifact',
            fileName: downloaded.file.name,
            mtimeMs: downloaded.file.mtimeMs,
            reportRun: {
                id: run.id,
                url: run.url || null,
                conclusion: run.conclusion || null,
                status: run.status || null,
                updatedAt: run.updatedAt || null,
                headSha: run.headSha || null,
            },
        });
    } finally {
        try {
            rmSync(downloaded.tempDir, { recursive: true, force: true });
        } catch (_error) {
            // best effort
        }
    }
}

function readSentryEvidencePreferred({ localPath, sentryRun }) {
    const remoteReport = readSentryEvidenceFromRemoteArtifact(
        sentryRun,
        localPath
    );
    if (remoteReport.found && !remoteReport.error) {
        return remoteReport;
    }

    const localReport = readLatestSentryEvidence(localPath);
    if (localReport.found && !localReport.error) {
        return {
            ...localReport,
            fallbackAttempted: true,
            fallbackFromRemoteError: remoteReport.error || null,
        };
    }

    if (!remoteReport.found && !localReport.found) {
        return {
            ...localReport,
            source: 'auto',
            fallbackAttempted: true,
            fallbackFromRemoteError: remoteReport.error || null,
        };
    }

    return {
        ...(remoteReport.found ? remoteReport : localReport),
        fallbackAttempted: true,
        fallbackFromRemoteError: remoteReport.error || null,
    };
}

function parseProdMonitorEvidencePayload(payload, meta = {}) {
    const checks =
        payload && typeof payload.checks === 'object' && payload.checks
            ? payload.checks
            : {};
    const workflow =
        payload && typeof payload.workflow === 'object' && payload.workflow
            ? payload.workflow
            : {};
    const failures = Array.isArray(payload?.failures) ? payload.failures : [];
    const warnings = Array.isArray(payload?.warnings) ? payload.warnings : [];
    const failureCount = Number.isFinite(Number(payload?.failureCount))
        ? Number(payload.failureCount)
        : failures.length;
    const warningCount = Number.isFinite(Number(payload?.warningCount))
        ? Number(payload.warningCount)
        : warnings.length;

    return {
        found: true,
        source: meta.source || 'local',
        path: meta.path || null,
        fileName: meta.fileName || (meta.path ? basename(meta.path) : null),
        mtime:
            meta.mtimeIso ||
            (Number.isFinite(meta.mtimeMs)
                ? new Date(meta.mtimeMs).toISOString()
                : null),
        reportRun: meta.reportRun || null,
        generatedAt: toIso(payload?.generatedAt),
        ok: Boolean(payload?.ok),
        status: payload?.status || (payload?.ok ? 'ok' : 'unknown'),
        domain: payload?.domain || null,
        failureCount,
        warningCount,
        failures,
        warnings,
        workflowFailures: Array.isArray(payload?.workflowFailures)
            ? payload.workflowFailures
            : [],
        summary:
            payload && typeof payload.summary === 'object'
                ? payload.summary
                : null,
        artifact:
            payload && typeof payload.artifact === 'object'
                ? payload.artifact
                : null,
        checks,
        health: checks.health || null,
        publicSync: checks.publicSync || null,
        telemedicine: checks.telemedicine || null,
        turneroPilot: checks.turneroPilot || null,
        githubDeployAlerts: checks.githubDeployAlerts || null,
        servicePriorities: checks.servicePriorities || null,
        workflow,
        publicSyncRecovery: workflow.publicSyncRecovery || null,
        turneroPilotRecovery: workflow.turneroPilotRecovery || null,
        publicCutover: workflow.publicCutover || null,
        publicV4Rollout: workflow.publicV4Rollout || null,
        staleDeployAlertAutoclose: workflow.staleDeployAlertAutoclose || null,
        error: null,
    };
}

function readProdMonitorEvidenceFromFile(filePath, meta = {}) {
    let payload;
    try {
        payload = JSON.parse(
            stripLeadingUtf8Bom(readFileSync(filePath, 'utf8'))
        );
    } catch (error) {
        return {
            found: true,
            source: meta.source || 'local',
            path: filePath,
            fileName: basename(filePath),
            reportRun: meta.reportRun || null,
            error: `No se pudo parsear JSON: ${error.message}`,
        };
    }

    return parseProdMonitorEvidencePayload(payload, {
        ...meta,
        path: filePath,
    });
}

function readLatestProdMonitorEvidence(localPath) {
    const absolutePath = resolve(ROOT, localPath);
    if (!existsSync(absolutePath)) {
        return {
            found: false,
            source: 'local',
            path: absolutePath,
            error: null,
        };
    }

    return readProdMonitorEvidenceFromFile(absolutePath, {
        source: 'local',
        fileName: basename(absolutePath),
        mtimeMs: getPathMtimeMs(absolutePath),
    });
}

function downloadProdMonitorEvidenceArtifact(runId) {
    return downloadNamedArtifact(
        runId,
        'prod-monitor-report',
        (name) => /^prod-monitor-last\.json$/i.test(name),
        'Artifact prod-monitor-report no contiene prod-monitor-last.json'
    );
}

function readProdMonitorEvidenceFromRemoteArtifact(
    prodMonitorRun,
    fallbackPath
) {
    const run = getWorkflowRunForHealth(prodMonitorRun);
    if (!prodMonitorRun || !prodMonitorRun.available || !run || !run.id) {
        return {
            found: false,
            source: 'remote_artifact',
            path: resolve(ROOT, fallbackPath || DEFAULT_PROD_MONITOR_JSON_OUT),
            error: 'No hay run de Production Monitor disponible para descargar artifact',
        };
    }
    const downloaded = downloadProdMonitorEvidenceArtifact(run.id);
    if (!downloaded.ok) {
        return {
            found: false,
            source: 'remote_artifact',
            path: resolve(ROOT, fallbackPath || DEFAULT_PROD_MONITOR_JSON_OUT),
            reportRun: {
                id: run.id,
                url: run.url || null,
                conclusion: run.conclusion || null,
                status: run.status || null,
                updatedAt: run.updatedAt || null,
            },
            error: downloaded.error,
        };
    }

    try {
        return readProdMonitorEvidenceFromFile(downloaded.file.fullPath, {
            source: 'remote_artifact',
            fileName: downloaded.file.name,
            mtimeMs: downloaded.file.mtimeMs,
            reportRun: {
                id: run.id,
                url: run.url || null,
                conclusion: run.conclusion || null,
                status: run.status || null,
                updatedAt: run.updatedAt || null,
                headSha: run.headSha || null,
            },
        });
    } finally {
        try {
            rmSync(downloaded.tempDir, { recursive: true, force: true });
        } catch (_error) {
            // best effort
        }
    }
}

function readProdMonitorEvidencePreferred({ localPath, prodMonitorRun }) {
    const remoteReport = readProdMonitorEvidenceFromRemoteArtifact(
        prodMonitorRun,
        localPath
    );
    if (remoteReport.found && !remoteReport.error) {
        return remoteReport;
    }

    const localReport = readLatestProdMonitorEvidence(localPath);
    if (localReport.found && !localReport.error) {
        return {
            ...localReport,
            fallbackAttempted: true,
            fallbackFromRemoteError: remoteReport.error || null,
        };
    }

    if (!remoteReport.found && !localReport.found) {
        return {
            ...localReport,
            source: 'auto',
            fallbackAttempted: true,
            fallbackFromRemoteError: remoteReport.error || null,
        };
    }

    return {
        ...(remoteReport.found ? remoteReport : localReport),
        fallbackAttempted: true,
        fallbackFromRemoteError: remoteReport.error || null,
    };
}

function normalizePublicMainSyncEvidence(payload, meta = {}) {
    const job =
        payload && typeof payload.job === 'object' && payload.job
            ? payload.job
            : null;
    const details =
        job && typeof job.details === 'object' && job.details
            ? job.details
            : {};
    const httpStatus = Number.parseInt(details.http_status, 10);
    return {
        available: true,
        found: Boolean(job),
        source: meta.source || 'agent_orchestrator',
        path: meta.path || null,
        command: meta.command || null,
        error: null,
        ok: payload?.ok === true,
        state: job?.state || (payload?.ok === true ? 'ok' : 'unknown'),
        verificationSource: job?.verification_source || null,
        failureReason:
            String(
                job?.failure_reason || job?.last_error_message || ''
            ).trim() || null,
        lastErrorMessage: String(job?.last_error_message || '').trim() || null,
        configured: Boolean(job?.configured),
        verified: Boolean(job?.verified),
        healthy: Boolean(job?.healthy),
        operationallyHealthy: Boolean(job?.operationally_healthy),
        repoHygieneIssue: Boolean(job?.repo_hygiene_issue),
        headDrift: Boolean(job?.head_drift),
        telemetryGap: Boolean(job?.telemetry_gap),
        httpStatus:
            Number.isFinite(httpStatus) && httpStatus > 0 ? httpStatus : null,
        responseDetail: String(details.response_detail || '').trim() || null,
        job,
    };
}

function readPublicMainSyncEvidence() {
    const path = resolve(ROOT, 'agent-orchestrator.js');
    const response = runNodeJsonScript(
        'agent-orchestrator.js',
        ['jobs', 'verify', 'public_main_sync', '--json'],
        { allowFailure: true }
    );
    if (!response.available) {
        return {
            available: false,
            found: false,
            source: 'agent_orchestrator',
            path,
            command: response.command,
            error: response.error,
        };
    }
    if (response.json && typeof response.json === 'object') {
        return normalizePublicMainSyncEvidence(response.json, {
            source: 'agent_orchestrator',
            path,
            command: response.command,
        });
    }
    if (!response.ok) {
        return {
            available: true,
            found: false,
            source: 'agent_orchestrator',
            path,
            command: response.command,
            error:
                response.stderr ||
                response.stdout ||
                `agent-orchestrator exit ${response.exitCode}`,
        };
    }
    return {
        available: true,
        found: false,
        source: 'agent_orchestrator',
        path,
        command: response.command,
        error: 'No se pudo parsear JSON de public_main_sync',
    };
}

function getPublicMainSyncFailureToken(evidence) {
    return String(
        evidence?.failureReason ||
            evidence?.lastErrorMessage ||
            evidence?.state ||
            'unknown'
    ).trim();
}

function isPublicMainSyncBlocking(evidence) {
    if (!evidence?.available || !evidence?.found || evidence?.error) {
        return false;
    }
    if (evidence.ok === true) {
        return false;
    }
    if (evidence.repoHygieneIssue && evidence.operationallyHealthy) {
        return false;
    }
    return true;
}

function describePublicMainSyncFailure(evidence) {
    const failureToken = getPublicMainSyncFailureToken(evidence);
    if (/^health_http_\d+$/i.test(failureToken)) {
        return `public_main_sync verifico host via ${
            evidence.verificationSource || 'unknown'
        } pero /api.php?resource=health devolvio HTTP ${
            evidence.httpStatus || 'error'
        }`;
    }
    if (failureToken === 'health_missing_public_sync') {
        return 'public_main_sync alcanzo el health publico pero falta checks.publicSync en la respuesta live';
    }
    if (
        failureToken === 'unverified' &&
        String(evidence?.verificationSource || '').toLowerCase() ===
            'registry_only'
    ) {
        return 'public_main_sync sigue en registry_only/unverified y todavia no deja evidencia host-side desde health_url';
    }
    return `public_main_sync sigue unhealthy (${failureToken || 'unknown'})`;
}

function normalizeOperatorAuthEvidence(payload, meta = {}) {
    const operatorAuthStatus =
        payload && typeof payload.operator_auth_status === 'object'
            ? payload.operator_auth_status
            : {};
    const adminAuthFacade =
        payload && typeof payload.admin_auth_facade === 'object'
            ? payload.admin_auth_facade
            : {};
    const resolved =
        payload && typeof payload.resolved === 'object' ? payload.resolved : {};
    const primaryHttpStatus = Number.parseInt(operatorAuthStatus.http_status, 10);
    const facadeHttpStatus = Number.parseInt(adminAuthFacade.http_status, 10);

    return {
        available: true,
        found: Boolean(payload && typeof payload === 'object'),
        source: meta.source || 'openclaw_auth_rollout',
        path: meta.path || null,
        command: meta.command || null,
        error: null,
        ok: payload?.ok === true,
        domain: String(payload?.domain || '').trim() || null,
        diagnosis: String(payload?.diagnosis || '').trim() || null,
        nextAction: String(payload?.next_action || '').trim() || null,
        mode:
            String(resolved.mode || operatorAuthStatus.mode || '').trim() ||
            null,
        transport:
            String(
                resolved.transport || operatorAuthStatus.transport || ''
            ).trim() || null,
        status:
            String(resolved.status || operatorAuthStatus.status || '').trim() ||
            null,
        configured:
            Boolean(resolved.configured) ||
            Boolean(operatorAuthStatus.configured) ||
            Boolean(adminAuthFacade.configured),
        recommendedMode:
            String(
                resolved.recommended_mode ||
                    operatorAuthStatus.recommended_mode ||
                    adminAuthFacade.recommended_mode ||
                    ''
            ).trim() || null,
        contractValid:
            Boolean(resolved.contract_valid) ||
            Boolean(operatorAuthStatus.contract_valid) ||
            Boolean(adminAuthFacade.contract_valid),
        operatorAuthStatus,
        adminAuthFacade,
        resolved,
        primaryHttpStatus:
            Number.isFinite(primaryHttpStatus) && primaryHttpStatus > 0
                ? primaryHttpStatus
                : null,
        facadeHttpStatus:
            Number.isFinite(facadeHttpStatus) && facadeHttpStatus > 0
                ? facadeHttpStatus
                : null,
    };
}

function readOperatorAuthEvidence() {
    const path = resolve(ROOT, 'bin', 'admin-openclaw-rollout-diagnostic.js');
    const response = runNodeJsonScript(
        'bin/admin-openclaw-rollout-diagnostic.js',
        ['--json', '--allow-not-ready'],
        { allowFailure: true }
    );
    if (!response.available) {
        return {
            available: false,
            found: false,
            source: 'operator_auth_rollout',
            path,
            command: response.command,
            error: response.error,
        };
    }
    if (response.json && typeof response.json === 'object') {
        return normalizeOperatorAuthEvidence(response.json, {
            source: 'openclaw_auth_rollout',
            path,
            command: response.command,
        });
    }
    if (!response.ok) {
        return {
            available: true,
            found: false,
            source: 'operator_auth_rollout',
            path,
            command: response.command,
            error:
                response.stderr ||
                response.stdout ||
                `openclaw auth diagnostic exit ${response.exitCode}`,
        };
    }
    return {
        available: true,
        found: false,
        source: 'operator_auth_rollout',
        path,
        command: response.command,
        error: 'No se pudo parsear JSON de operator_auth',
    };
}

function getOperatorAuthFailureToken(evidence) {
    return String(
        evidence?.diagnosis || evidence?.mode || evidence?.status || 'unknown'
    ).trim();
}

function isOperatorAuthBlocking(evidence) {
    return Boolean(
        evidence?.available &&
            evidence?.found &&
            !evidence?.error &&
            evidence?.ok !== true
    );
}

function describeOperatorAuthFailure(evidence) {
    const failureToken = getOperatorAuthFailureToken(evidence);
    if (failureToken === 'admin_auth_legacy_facade') {
        return `operator_auth remoto sigue publicando contrato legacy (mode=${
            evidence?.mode || 'unknown'
        }, transport=${evidence?.transport || 'none'}) en operator-auth-status/admin-auth`;
    }
    if (failureToken === 'operator_auth_mode_mismatch') {
        return 'operator_auth remoto no esta en modo google_oauth';
    }
    if (failureToken === 'operator_auth_not_configured') {
        return 'operator_auth remoto sigue sin configuracion Google/OIDC completa';
    }
    if (evidence?.nextAction) {
        return evidence.nextAction;
    }
    return `operator_auth sigue bloqueado (${failureToken || 'unknown'})`;
}

function fetchRecentRepositoryRuns(branch, limit = 100) {
    const normalizedLimit =
        Number.isFinite(Number(limit)) && Number(limit) > 0
            ? String(Math.trunc(Number(limit)))
            : '100';
    const res = runGhJson(
        [
            'run',
            'list',
            '--branch',
            branch,
            '--limit',
            normalizedLimit,
            '--json',
            'databaseId,displayTitle,workflowName,status,conclusion,url,createdAt,updatedAt,headBranch,headSha,event',
        ],
        { allowFailure: true }
    );
    if (!res.ok) {
        return {
            available: false,
            error: res.stderr || res.stdout || `gh exit ${res.exitCode}`,
            runs: [],
        };
    }
    const list = Array.isArray(res.json) ? res.json : [];
    return {
        available: true,
        error: null,
        runs: list.map((item) => mapRun(item)).filter(Boolean),
    };
}

function fetchRecentMergedPrs(baseBranch, limit = 50) {
    const normalizedLimit =
        Number.isFinite(Number(limit)) && Number(limit) > 0
            ? String(Math.trunc(Number(limit)))
            : '50';
    const res = runGhJson(
        [
            'pr',
            'list',
            '--state',
            'merged',
            '--base',
            baseBranch,
            '--limit',
            normalizedLimit,
            '--json',
            'number,title,url,mergedAt,author',
        ],
        { allowFailure: true }
    );
    if (!res.ok) {
        return {
            available: false,
            error: res.stderr || res.stdout || `gh exit ${res.exitCode}`,
            prs: [],
        };
    }
    const list = Array.isArray(res.json) ? res.json : [];
    return {
        available: true,
        error: null,
        prs: list
            .map((pr) => ({
                number: pr.number ?? null,
                title: pr.title || null,
                url: pr.url || null,
                mergedAt: toIso(pr.mergedAt),
                author:
                    pr?.author && typeof pr.author === 'object'
                        ? pr.author.login || null
                        : null,
            }))
            .filter(Boolean),
    };
}

function isIsoAfterCutoff(iso, cutoffMs) {
    const ts = Date.parse(String(iso || ''));
    return Number.isFinite(ts) && ts >= cutoffMs;
}

function computeExecutionEfficiency({ branch, workflows, windowHours }) {
    const hours =
        Number.isFinite(Number(windowHours)) && Number(windowHours) > 0
            ? Math.trunc(Number(windowHours))
            : 24;
    const cutoffMs = Date.now() - hours * 60 * 60 * 1000;
    const cutoffIso = new Date(cutoffMs).toISOString();
    const runsRes = fetchRecentRepositoryRuns(branch, 120);
    const prsRes = fetchRecentMergedPrs(branch, 80);

    const recentRuns = (runsRes.runs || []).filter((run) =>
        isIsoAfterCutoff(run.createdAt || run.updatedAt, cutoffMs)
    );
    const recentMergedPrs = (prsRes.prs || []).filter((pr) =>
        isIsoAfterCutoff(pr.mergedAt, cutoffMs)
    );

    const criticalWorkflowNames = new Set(
        ['ci', 'postDeployGate', 'deployHosting', 'weeklyKpi', 'repairGitSync']
            .map((key) => workflows?.[key])
            .flatMap((wrapper) => {
                const names = [];
                if (wrapper?.workflowName)
                    names.push(String(wrapper.workflowName));
                if (wrapper?.latest?.workflowName)
                    names.push(String(wrapper.latest.workflowName));
                if (wrapper?.latestEffective?.workflowName)
                    names.push(String(wrapper.latestEffective.workflowName));
                return names;
            })
            .filter(Boolean)
    );

    const manualRuns = recentRuns.filter(
        (run) => run.event === 'workflow_dispatch'
    );
    const scheduleRuns = recentRuns.filter((run) => run.event === 'schedule');
    const pushRuns = recentRuns.filter((run) => run.event === 'push');
    const criticalManualRuns = manualRuns.filter((run) =>
        criticalWorkflowNames.has(String(run.workflowName || ''))
    );

    const signal =
        recentMergedPrs.length >= 5 && manualRuns.length >= 5
            ? 'YELLOW'
            : 'GREEN';
    const notes = [];
    if (signal === 'YELLOW') {
        notes.push(
            `high_activity_window(merged_prs=${recentMergedPrs.length}, manual_runs=${manualRuns.length})`
        );
    }

    return {
        windowHours: hours,
        cutoffIso,
        signal,
        notes,
        mergedPrs: {
            available: prsRes.available,
            error: prsRes.error,
            count: recentMergedPrs.length,
            sampleLimit: 80,
            items: recentMergedPrs.slice(0, 10),
        },
        workflowRuns: {
            available: runsRes.available,
            error: runsRes.error,
            count: recentRuns.length,
            sampleLimit: 120,
            byEvent: {
                workflow_dispatch: manualRuns.length,
                schedule: scheduleRuns.length,
                push: pushRuns.length,
            },
            criticalWorkflowNames: Array.from(criticalWorkflowNames).sort(),
            criticalManualRunsCount: criticalManualRuns.length,
            criticalManualRunsSample: criticalManualRuns.slice(0, 10),
        },
    };
}

function coerceRunHealth(runWrapper) {
    if (!runWrapper || !runWrapper.available) {
        return { signal: 'YELLOW', reason: 'unavailable' };
    }
    const run = getWorkflowRunForHealth(runWrapper);
    if (!run) {
        return { signal: 'YELLOW', reason: 'missing' };
    }
    if (run.status !== 'completed') {
        return {
            signal: 'YELLOW',
            reason: `status:${run.status}`,
        };
    }
    if (run.conclusion === 'success') {
        return { signal: 'GREEN', reason: 'success' };
    }
    return {
        signal: 'RED',
        reason: `conclusion:${run.conclusion || 'unknown'}`,
    };
}

function countConsecutiveRunsByPredicate(runs, predicate) {
    let count = 0;
    for (const run of Array.isArray(runs) ? runs : []) {
        if (!predicate(run)) break;
        count += 1;
    }
    return count;
}

function computeWeeklyKpiHistory(weeklyRunsWrapper) {
    if (!weeklyRunsWrapper || !weeklyRunsWrapper.available) {
        const nextScheduleExpectedAt = computeNextWeeklyOccurrenceUtc(
            WEEKLY_KPI_SCHEDULE_UTC
        );
        const nextScheduleInMinutes = minutesUntilIso(nextScheduleExpectedAt);
        const phase6SchedulePace = computePhase6SchedulePace({
            scheduleSuccessStreak: 0,
            scheduleCyclesTarget: 2,
            scheduleCyclesRemaining: 2,
            nextScheduleInMinutes,
        });
        return {
            available: false,
            error: weeklyRunsWrapper?.error || 'unavailable',
            recentLimit: 0,
            totalRecentRuns: 0,
            anyEventSuccessStreak: 0,
            scheduleRunsCount: 0,
            scheduleSuccessStreak: 0,
            scheduleCyclesTarget: 2,
            scheduleCyclesRemaining: 2,
            scheduleCronUtc: WEEKLY_KPI_SCHEDULE_UTC.cron,
            scheduleTimezone: WEEKLY_KPI_SCHEDULE_UTC.timezone,
            nextScheduleExpectedAt,
            nextScheduleInMinutes,
            nextScheduleInLabel: formatMinutesDistance(nextScheduleInMinutes),
            phase6SchedulePace,
            latestScheduleRunAgeMinutes: null,
            latestScheduleRunAgeLabel: 'n/a',
            latestScheduleRun: null,
            recentRuns: [],
        };
    }

    const recentRuns = Array.isArray(weeklyRunsWrapper.runs)
        ? weeklyRunsWrapper.runs
        : [];
    const scheduleRuns = recentRuns.filter((run) => run.event === 'schedule');
    const anyEventSuccessStreak = countConsecutiveRunsByPredicate(
        recentRuns,
        (run) => run.status === 'completed' && run.conclusion === 'success'
    );
    const scheduleSuccessStreak = countConsecutiveRunsByPredicate(
        scheduleRuns,
        (run) => run.status === 'completed' && run.conclusion === 'success'
    );
    const scheduleCyclesTarget = 2;
    const latestScheduleRun = scheduleRuns[0] || null;
    const latestScheduleRefIso =
        latestScheduleRun?.updatedAt || latestScheduleRun?.createdAt || null;
    const latestScheduleRunAgeMinutes = latestScheduleRefIso
        ? ageMinutesFromIso(latestScheduleRefIso)
        : null;
    const nextScheduleExpectedAt = computeNextWeeklyOccurrenceUtc(
        WEEKLY_KPI_SCHEDULE_UTC
    );
    const nextScheduleInMinutes = minutesUntilIso(nextScheduleExpectedAt);
    const scheduleCyclesRemaining = Math.max(
        0,
        scheduleCyclesTarget - scheduleSuccessStreak
    );
    const phase6SchedulePace = computePhase6SchedulePace({
        scheduleSuccessStreak,
        scheduleCyclesTarget,
        scheduleCyclesRemaining,
        nextScheduleInMinutes,
    });

    return {
        available: true,
        error: null,
        recentLimit: recentRuns.length,
        totalRecentRuns: recentRuns.length,
        anyEventSuccessStreak,
        scheduleRunsCount: scheduleRuns.length,
        scheduleSuccessStreak,
        scheduleCyclesTarget,
        scheduleCyclesRemaining,
        scheduleCronUtc: WEEKLY_KPI_SCHEDULE_UTC.cron,
        scheduleTimezone: WEEKLY_KPI_SCHEDULE_UTC.timezone,
        nextScheduleExpectedAt,
        nextScheduleInMinutes,
        nextScheduleInLabel: formatMinutesDistance(nextScheduleInMinutes),
        phase6SchedulePace,
        latestScheduleRunAgeMinutes,
        latestScheduleRunAgeLabel: formatAgeMinutes(
            latestScheduleRunAgeMinutes
        ),
        latestScheduleRun,
        recentRuns: recentRuns.slice(0, 8),
    };
}

function computeProductionStability({
    workflows,
    openProdAlerts,
    weeklyLocalReport,
    weeklyKpiHistory,
    sentryEvidence,
    prodMonitorEvidence,
    publicMainSyncEvidence,
    operatorAuthEvidence,
}) {
    const criticalWorkflowKeys = ['ci', 'postDeployGate', 'deployHosting'];
    const reasons = [];
    const advisories = [];
    let signal = 'GREEN';

    for (const key of criticalWorkflowKeys) {
        const wrapper = workflows[key];
        const run = getWorkflowRunForHealth(wrapper);
        const health = coerceRunHealth(wrapper);
        if (
            run &&
            health.signal === 'YELLOW' &&
            health.reason === `status:${run.status}` &&
            isInProgressWithinGrace(run)
        ) {
            advisories.push(
                `${key}:in_progress_grace(age=${run.ageLabel};grace=${CRITICAL_WORKFLOW_INPROGRESS_GRACE_MINUTES}m;run=${run.id})`
            );
            continue;
        }
        if (health.signal === 'RED') {
            signal = 'RED';
            reasons.push(`${key}:${health.reason}`);
        } else if (health.signal === 'YELLOW' && signal !== 'RED') {
            signal = 'YELLOW';
            reasons.push(`${key}:${health.reason}`);
        }
    }

    if (openProdAlerts.available && Number(openProdAlerts.count) > 0) {
        signal = 'RED';
        reasons.push(`open_prod_alerts:${openProdAlerts.count}`);
    } else if (!openProdAlerts.available && signal !== 'RED') {
        signal = 'YELLOW';
        reasons.push('open_prod_alerts:unavailable');
    }

    if (
        weeklyLocalReport &&
        weeklyLocalReport.found &&
        !weeklyLocalReport.error
    ) {
        const critical = Number(weeklyLocalReport.warningCounts?.critical || 0);
        const nonCritical = Number(
            weeklyLocalReport.warningCounts?.nonCritical || 0
        );
        if (critical > 0) {
            signal = 'RED';
            reasons.push(`weekly_local_critical_warnings:${critical}`);
        } else if (nonCritical > 0 && signal === 'GREEN') {
            signal = 'YELLOW';
            reasons.push(`weekly_local_non_critical_warnings:${nonCritical}`);
        }
    }

    if (
        weeklyKpiHistory &&
        weeklyKpiHistory.available &&
        weeklyKpiHistory.phase6SchedulePace
    ) {
        const pace = weeklyKpiHistory.phase6SchedulePace;
        advisories.push(
            `phase6_schedule_pace:${pace.signal}(${pace.reason || 'n/a'})`
        );
    }
    if (sentryEvidence?.found && !sentryEvidence.error) {
        advisories.push(
            `sentry_evidence:${sentryEvidence.ok ? 'ok' : sentryEvidence.status || 'unknown'}`
        );
    } else if (sentryEvidence?.error) {
        advisories.push(`sentry_evidence:error(${sentryEvidence.error})`);
    }
    if (prodMonitorEvidence?.found && !prodMonitorEvidence.error) {
        advisories.push(
            `prod_monitor:${prodMonitorEvidence.ok ? 'ok' : prodMonitorEvidence.status || 'unknown'}`
        );
        if (
            ['failed', 'error'].includes(
                String(prodMonitorEvidence.status || '').toLowerCase()
            ) ||
            prodMonitorEvidence.ok === false
        ) {
            signal = 'RED';
            reasons.push(
                `prod_monitor:${prodMonitorEvidence.status || 'failed'}`
            );
        } else if (
            String(prodMonitorEvidence.status || '').toLowerCase() ===
                'warning' &&
            signal === 'GREEN'
        ) {
            signal = 'YELLOW';
            reasons.push('prod_monitor:warning');
        }
    } else if (prodMonitorEvidence?.error) {
        advisories.push(`prod_monitor:error(${prodMonitorEvidence.error})`);
    }

    if (publicMainSyncEvidence?.found && !publicMainSyncEvidence.error) {
        advisories.push(
            `public_main_sync:${
                publicMainSyncEvidence.ok
                    ? 'ok'
                    : getPublicMainSyncFailureToken(publicMainSyncEvidence)
            }`
        );
        if (isPublicMainSyncBlocking(publicMainSyncEvidence)) {
            signal = 'RED';
            reasons.push(
                `public_main_sync:${getPublicMainSyncFailureToken(publicMainSyncEvidence)}`
            );
        }
    } else if (publicMainSyncEvidence?.error) {
        advisories.push(
            `public_main_sync:error(${publicMainSyncEvidence.error})`
        );
    }

    if (operatorAuthEvidence?.found && !operatorAuthEvidence.error) {
        advisories.push(
            `operator_auth:${
                operatorAuthEvidence.ok
                    ? 'ok'
                    : getOperatorAuthFailureToken(operatorAuthEvidence)
            }`
        );
        if (isOperatorAuthBlocking(operatorAuthEvidence)) {
            signal = 'RED';
            reasons.push(
                `operator_auth:${getOperatorAuthFailureToken(operatorAuthEvidence)}`
            );
        }
    } else if (operatorAuthEvidence?.error) {
        advisories.push(`operator_auth:error(${operatorAuthEvidence.error})`);
    }

    return {
        signal,
        reasons,
        advisories,
        operationalSignals: {
            phase6_schedule_pace: weeklyKpiHistory?.phase6SchedulePace || null,
        },
        criticalWorkflowKeys,
    };
}

function computeReleaseReadiness({
    productionStability,
    planMasterProgress,
    suggestedActions,
}) {
    const blockingReasons = [];
    const followups = [];
    const blockingPlanItems = Array.isArray(planMasterProgress?.pending)
        ? planMasterProgress.pending.filter(
              (item) => item.status === 'blocking'
          )
        : [];
    const allPlanItems = Array.isArray(planMasterProgress?.pending)
        ? planMasterProgress.pending
        : [];
    const blockingActions = Array.isArray(suggestedActions?.items)
        ? suggestedActions.items.filter((item) => item.blocking)
        : [];
    const nonBlockingActions = Array.isArray(suggestedActions?.items)
        ? suggestedActions.items.filter((item) => !item.blocking)
        : [];

    let signal = 'GREEN';
    if (productionStability?.signal === 'RED') {
        signal = 'RED';
        blockingReasons.push('production_stability:red');
    }
    if (blockingPlanItems.length > 0) {
        signal = 'RED';
        blockingReasons.push(
            `plan_master_blocking:${blockingPlanItems.length}`
        );
    }
    if (blockingActions.length > 0) {
        signal = 'RED';
        blockingReasons.push(
            `suggested_actions_blocking:${blockingActions.length}`
        );
    }

    if (signal === 'GREEN') {
        if (productionStability?.signal === 'YELLOW') {
            followups.push('production_stability:non_blocking_attention');
        }
        for (const item of allPlanItems) {
            if (item.status !== 'blocking') {
                followups.push(`pending:${item.id}`);
            }
        }
        for (const action of nonBlockingActions) {
            followups.push(`action:${action.id}`);
        }
    }

    return {
        signal,
        summary:
            signal === 'RED'
                ? 'blocked'
                : followups.length > 0
                  ? 'ready_with_followups'
                  : 'ready',
        blockingCount: blockingReasons.length,
        blockingReasons,
        followupCount: followups.length,
        followups: followups.slice(0, 20),
    };
}

function computePlanMasterProgress({
    workflows,
    openProdAlerts,
    weeklyLocalReport,
    weeklyKpiHistory,
    sentryEvidence,
}) {
    const pending = [];
    const sentryNotesBase = [];
    if (!sentryEvidence || !sentryEvidence.found) {
        sentryNotesBase.push(
            'No existe evidencia Sentry descargable ni artefacto local normalizado.'
        );
    } else if (sentryEvidence.error) {
        sentryNotesBase.push(
            `La evidencia Sentry existe pero no se pudo parsear/leer: ${sentryEvidence.error}.`
        );
    } else {
        sentryNotesBase.push(
            `source=${sentryEvidence.source || 'n/a'} generatedAt=${sentryEvidence.generatedAt || 'n/a'} status=${sentryEvidence.status || 'n/a'} ok=${sentryEvidence.ok ? 'true' : 'false'}.`
        );
        if (sentryEvidence.reportRun?.id) {
            sentryNotesBase.push(
                `run=${sentryEvidence.reportRun.id} conclusion=${sentryEvidence.reportRun.conclusion || sentryEvidence.reportRun.status || 'n/a'}.`
            );
        }
        if (sentryEvidence.missingEnv?.length) {
            sentryNotesBase.push(
                `missing_env=${sentryEvidence.missingEnv.join(', ')}.`
            );
        }
        if (sentryEvidence.missingProjects?.length) {
            sentryNotesBase.push(
                `missing_projects=${sentryEvidence.missingProjects.join(', ')}.`
            );
        }
        if (sentryEvidence.staleProjects?.length) {
            sentryNotesBase.push(
                `stale_projects=${sentryEvidence.staleProjects
                    .map((row) => `${row.project}:${row.ageHours}h`)
                    .join(', ')}.`
            );
        }
        if (sentryEvidence.actionRequired) {
            sentryNotesBase.push(`action=${sentryEvidence.actionRequired}`);
        }
    }
    let sentryStatus = 'pending_external';
    let sentryOwner = 'manual/external';
    if (sentryEvidence?.found && !sentryEvidence.error && sentryEvidence.ok) {
        sentryStatus = 'done';
        sentryOwner = 'ops';
    } else if (
        sentryEvidence?.found &&
        !sentryEvidence.error &&
        ['missing_events', 'stale_events'].includes(
            String(sentryEvidence.status || '')
        )
    ) {
        sentryStatus = 'in_progress_timebox';
        sentryOwner = 'ops';
    }
    pending.push({
        id: 'PM-SENTRY-001',
        title: 'Confirmar primer evento de Sentry (backend + frontend)',
        status: sentryStatus,
        owner: sentryOwner,
        notes: sentryNotesBase.join(' '),
    });

    const weeklyRun = getWorkflowRunForHealth(workflows.weeklyKpi) || null;
    const weeklyCriticalWarnings =
        weeklyLocalReport && weeklyLocalReport.found && !weeklyLocalReport.error
            ? Number(weeklyLocalReport.warningCounts?.critical || 0)
            : null;
    const weeklyNonCriticalWarnings =
        weeklyLocalReport && weeklyLocalReport.found && !weeklyLocalReport.error
            ? Number(weeklyLocalReport.warningCounts?.nonCritical || 0)
            : null;
    const scheduleStreak = Number(weeklyKpiHistory?.scheduleSuccessStreak || 0);
    const anyEventStreak = Number(weeklyKpiHistory?.anyEventSuccessStreak || 0);
    const scheduleTarget = Number(weeklyKpiHistory?.scheduleCyclesTarget || 2);
    const scheduleRemaining = Number(
        weeklyKpiHistory?.scheduleCyclesRemaining ?? scheduleTarget
    );
    const latestScheduleRun = weeklyKpiHistory?.latestScheduleRun || null;
    const phase6SchedulePaceSignal =
        weeklyKpiHistory?.phase6SchedulePace?.signal || 'unknown';
    const phase6SchedulePaceReason =
        weeklyKpiHistory?.phase6SchedulePace?.reason || 'n/a';
    const f6Status =
        scheduleStreak >= scheduleTarget
            ? 'done'
            : scheduleStreak >= 1 || anyEventStreak >= 1
              ? 'in_progress_timebox'
              : 'pending';
    let f6Notes =
        'Requiere corridas semanales programadas en main y evidencia de estabilidad.';
    if (weeklyKpiHistory?.available) {
        f6Notes =
            `schedule_success_streak=${scheduleStreak}/${scheduleTarget}; ` +
            `schedule_cycles_remaining=${scheduleRemaining}; ` +
            `any_event_success_streak=${anyEventStreak}; ` +
            `phase6_schedule_pace=${phase6SchedulePaceSignal} (${phase6SchedulePaceReason}).`;
        if (weeklyKpiHistory.nextScheduleExpectedAt) {
            f6Notes += ` Next schedule esperado (${weeklyKpiHistory.scheduleCronUtc} ${weeklyKpiHistory.scheduleTimezone}) en ${weeklyKpiHistory.nextScheduleInLabel} (${weeklyKpiHistory.nextScheduleExpectedAt}).`;
        }
        if (latestScheduleRun) {
            f6Notes +=
                ` Latest schedule run ${latestScheduleRun.id} => ${latestScheduleRun.conclusion || latestScheduleRun.status}` +
                ` (age=${weeklyKpiHistory.latestScheduleRunAgeLabel}).`;
        } else {
            f6Notes +=
                ' Aun no hay runs `schedule` recientes del Weekly KPI en main (solo validaciones manuales).';
        }
    }
    if (weeklyRun && weeklyRun.conclusion === 'success') {
        f6Notes +=
            ` Ultimo run observado: ${weeklyRun.id} (event=${weeklyRun.event || 'n/a'}); ` +
            `warnings_critical_report=${weeklyCriticalWarnings ?? 'n/a'} warnings_non_critical_report=${weeklyNonCriticalWarnings ?? 'n/a'}.`;
    }
    pending.push({
        id: 'PM-F6-001',
        title: 'Fase 6: completar 2 ciclos semanales sin warnings criticos',
        status: f6Status,
        owner: 'ops',
        notes: f6Notes,
    });

    if (openProdAlerts.available && openProdAlerts.count > 0) {
        pending.push({
            id: 'PM-ALERTS-001',
            title: 'Cerrar alertas PROD abiertas',
            status: 'blocking',
            owner: 'ops',
            notes: `Hay ${openProdAlerts.count} issue(s) abiertos con [ALERTA PROD].`,
        });
    }

    return {
        pending,
        pendingCount: pending.filter((item) => item.status !== 'done').length,
        blockingCount: pending.filter((item) => item.status === 'blocking')
            .length,
    };
}

function computeSuggestedActions({
    workflows,
    openProdAlerts,
    weeklyLocalReport,
    weeklyKpiHistory,
    planMasterProgress,
    productionStability,
    executionEfficiency,
    sentryEvidence,
    prodMonitorEvidence,
    publicMainSyncEvidence,
    operatorAuthEvidence,
}) {
    const actions = [];
    const workflowLabels = {
        ci: 'CI',
        postDeployGate: 'Post-Deploy Gate',
        deployHosting: 'Deploy Hosting',
    };
    const workflowCommands = {
        ci: null,
        postDeployGate:
            "gh workflow run '.github/workflows/post-deploy-gate.yml' --ref main",
        deployHosting:
            "gh workflow run '.github/workflows/deploy-hosting.yml' --ref main",
    };

    const pushAction = (action) => {
        if (!action || !action.id) return;
        if (actions.some((item) => item.id === action.id)) return;
        actions.push(action);
    };

    if (openProdAlerts?.available && Number(openProdAlerts.count) > 0) {
        pushAction({
            id: 'ACT-P0-PROD-ALERTS',
            priority: 'P0',
            blocking: true,
            title: 'Atender alertas PROD abiertas',
            reason: `${openProdAlerts.count} issue(s) [ALERTA PROD] siguen abiertos`,
            command: "gh issue list --state open --search '[ALERTA PROD]'",
            url: openProdAlerts.issues[0]?.url || null,
        });
    }

    if (isPublicMainSyncBlocking(publicMainSyncEvidence)) {
        pushAction({
            id: 'ACT-P0-PUBLIC-MAIN-SYNC',
            priority: 'P0',
            blocking: true,
            title: 'Recuperar verificacion host-side de public_main_sync',
            reason: describePublicMainSyncFailure(publicMainSyncEvidence),
            command:
                'node agent-orchestrator.js jobs verify public_main_sync --json',
            url: null,
        });
    }

    if (isOperatorAuthBlocking(operatorAuthEvidence)) {
        pushAction({
            id: 'ACT-P0-OPERATOR-AUTH',
            priority: 'P0',
            blocking: true,
            title: 'Alinear operator_auth remoto al contrato Google OAuth',
            reason: describeOperatorAuthFailure(operatorAuthEvidence),
            command:
                operatorAuthEvidence.command ||
                'node bin/admin-openclaw-rollout-diagnostic.js --json --allow-not-ready',
            url:
                operatorAuthEvidence.operatorAuthStatus?.url ||
                operatorAuthEvidence.adminAuthFacade?.url ||
                null,
        });
    }

    for (const key of ['ci', 'postDeployGate', 'deployHosting']) {
        const wrapper = workflows?.[key];
        const label = workflowLabels[key] || key;
        if (!wrapper?.available) {
            pushAction({
                id: `ACT-P1-WF-${key.toUpperCase()}-UNAVAILABLE`,
                priority: 'P1',
                blocking: false,
                title: `Recuperar lectura de workflow (${label})`,
                reason:
                    wrapper?.error || 'No se pudo consultar el workflow via gh',
                command: 'gh auth status',
                url: null,
            });
            continue;
        }
        const run = getWorkflowRunForHealth(wrapper);
        if (!run) {
            pushAction({
                id: `ACT-P1-WF-${key.toUpperCase()}-MISSING`,
                priority: 'P1',
                blocking: false,
                title: `Verificar ausencia de runs (${label})`,
                reason: 'No hay runs recientes en main para este workflow',
                command: null,
                url: null,
            });
            continue;
        }
        if (run.status !== 'completed') {
            if (isInProgressWithinGrace(run)) {
                continue;
            }
            pushAction({
                id: `ACT-P1-WF-${key.toUpperCase()}-INPROGRESS`,
                priority: 'P1',
                blocking: false,
                title: `Monitorear workflow en progreso (${label})`,
                reason: `Run ${run.id} sigue en estado ${run.status}`,
                command: `gh run watch ${run.id}`,
                url: run.url || null,
            });
            continue;
        }
        if (run.conclusion !== 'success') {
            pushAction({
                id: `ACT-P0-WF-${key.toUpperCase()}-FAILED`,
                priority: 'P0',
                blocking: true,
                title: `Recuperar workflow fallido (${label})`,
                reason: `Run ${run.id} termino en ${run.conclusion || 'unknown'}`,
                command:
                    workflowCommands[key] ||
                    `gh run view ${run.id} --log-failed`,
                url: run.url || null,
            });
        }
    }

    if (weeklyLocalReport?.found && !weeklyLocalReport.error) {
        const weeklyCritical = Number(
            weeklyLocalReport.warningCounts?.critical || 0
        );
        const weeklyNonCritical = Number(
            weeklyLocalReport.warningCounts?.nonCritical || 0
        );
        if (weeklyCritical > 0) {
            pushAction({
                id: 'ACT-P0-WEEKLY-KPI-CRITICAL',
                priority: 'P0',
                blocking: true,
                title: 'Revisar warnings criticos del Weekly KPI',
                reason: `${weeklyCritical} warning(s) criticos en reporte semanal (${weeklyLocalReport.source || 'n/a'})`,
                command: 'npm run prod:readiness:summary',
                url: weeklyLocalReport.reportRun?.url || null,
            });
        } else if (weeklyNonCritical > 0) {
            pushAction({
                id: 'ACT-P2-WEEKLY-KPI-NONCRITICAL',
                priority: 'P2',
                blocking: false,
                title: 'Monitorear warnings no criticos del Weekly KPI',
                reason: `${weeklyNonCritical} warning(s) no criticos (latencia/guardrails)`,
                command: 'npm run prod:readiness:summary',
                url: weeklyLocalReport.reportRun?.url || null,
            });
        }
    }

    const pace = weeklyKpiHistory?.phase6SchedulePace || null;
    if (pace?.signal === 'at_risk') {
        pushAction({
            id: 'ACT-P1-F6-AT-RISK',
            priority: 'P1',
            blocking: false,
            title: 'Preparar seguimiento del proximo ciclo semanal (Fase 6)',
            reason: `phase6_schedule_pace=at_risk (${pace.reason || 'n/a'})`,
            command: 'npm run prod:readiness:summary',
            url: getWorkflowRunForHealth(workflows?.weeklyKpi)?.url || null,
        });
    } else if (
        pace?.signal === 'on_track' &&
        Number(weeklyKpiHistory?.scheduleCyclesRemaining || 0) > 0
    ) {
        pushAction({
            id: 'ACT-P2-F6-WAIT-NEXT-SCHEDULE',
            priority: 'P2',
            blocking: false,
            title: 'Esperar y capturar proximo schedule del Weekly KPI',
            reason: `Faltan ${weeklyKpiHistory.scheduleCyclesRemaining} ciclo(s) schedule para cerrar Fase 6`,
            command: 'npm run prod:readiness:summary',
            url: null,
        });
    }

    const sentryPending = Array.isArray(planMasterProgress?.pending)
        ? planMasterProgress.pending.find((item) => item.id === 'PM-SENTRY-001')
        : null;
    if (sentryPending && sentryPending.status !== 'done') {
        pushAction({
            id: 'ACT-P3-SENTRY-EVIDENCE',
            priority: 'P3',
            blocking: false,
            title: 'Cerrar evidencia Sentry (backend/frontend)',
            reason:
                sentryEvidence?.failureReason?.message ||
                sentryEvidence?.actionRequired ||
                sentryPending.notes ||
                'Pendiente externo/manual de confirmacion de eventos',
            command: 'npm run verify:sentry:events',
            url:
                sentryEvidence?.reportRun?.url ||
                getWorkflowRunForHealth(workflows?.sentryVerify)?.url ||
                null,
        });
    }
    if (
        prodMonitorEvidence?.found &&
        !prodMonitorEvidence.error &&
        String(prodMonitorEvidence.status || '').toLowerCase() !== 'ok'
    ) {
        pushAction({
            id: 'ACT-P0-PROD-MONITOR',
            priority:
                String(prodMonitorEvidence.status || '').toLowerCase() ===
                'warning'
                    ? 'P2'
                    : 'P0',
            blocking:
                String(prodMonitorEvidence.status || '').toLowerCase() !==
                'warning',
            title: 'Revisar evidencia canonica de Production Monitor',
            reason:
                prodMonitorEvidence.summary?.headline ||
                prodMonitorEvidence.failures?.[0] ||
                prodMonitorEvidence.warnings?.[0] ||
                `prod-monitor status=${prodMonitorEvidence.status || 'unknown'}`,
            command:
                'gh run download --name prod-monitor-report || npm run monitor:prod',
            url:
                prodMonitorEvidence.reportRun?.url ||
                getWorkflowRunForHealth(workflows?.prodMonitor)?.url ||
                null,
        });
    } else if (prodMonitorEvidence?.error) {
        pushAction({
            id: 'ACT-P2-PROD-MONITOR-EVIDENCE',
            priority: 'P2',
            blocking: false,
            title: 'Recuperar lectura de evidencia canonica del monitor',
            reason: prodMonitorEvidence.error,
            command: 'npm run monitor:prod',
            url: getWorkflowRunForHealth(workflows?.prodMonitor)?.url || null,
        });
    }

    if (executionEfficiency?.signal === 'YELLOW') {
        const mergedPrsCount = Number(
            executionEfficiency?.mergedPrs?.count || 0
        );
        const manualRunsCount = Number(
            executionEfficiency?.workflowRuns?.byEvent?.workflow_dispatch || 0
        );
        pushAction({
            id: 'ACT-P2-EFFICIENCY-BATCHING',
            priority: 'P2',
            blocking: false,
            title: 'Reducir fragmentacion en el siguiente bloque (batching)',
            reason: `Ventana ${executionEfficiency.windowHours || 24}h con merged_prs=${mergedPrsCount} y manual_runs=${manualRunsCount}`,
            command: 'npm run prod:readiness:summary -- --efficiency-hours=24',
            url: null,
        });
    }

    if (
        actions.length === 0 &&
        productionStability &&
        productionStability.signal === 'GREEN'
    ) {
        pushAction({
            id: 'ACT-P2-MONITOR',
            priority: 'P2',
            blocking: false,
            title: 'Mantener monitoreo y capturar evidencia semanal',
            reason: 'Estado estable; continuar con operacion semanal y cierre de pendientes no criticos',
            command: 'npm run prod:readiness:summary',
            url: null,
        });
    }

    const priorityOrder = { P0: 0, P1: 1, P2: 2, P3: 3 };
    actions.sort((a, b) => {
        const pa = priorityOrder[a.priority] ?? 99;
        const pb = priorityOrder[b.priority] ?? 99;
        if (pa !== pb) return pa - pb;
        return String(a.id).localeCompare(String(b.id));
    });

    return {
        count: actions.length,
        blockingCount: actions.filter((item) => item.blocking).length,
        items: actions,
    };
}

function markdownWorkflowLine(label, wrapper) {
    if (!wrapper || !wrapper.available) {
        return `- ${label}: unavailable`;
    }
    const run = getWorkflowRunForHealth(wrapper);
    if (!run) {
        return `- ${label}: no runs found`;
    }
    const fallbackNote =
        wrapper.latest &&
        wrapper.latestEffective &&
        wrapper.latest.id !== wrapper.latestEffective.id
            ? ` [latest actual skipped: ${wrapper.latest.id}]`
            : '';
    return `- ${label}: ${run.conclusion || run.status || 'unknown'} (run ${run.id}, ${run.ageLabel}, ${run.durationLabel})${fallbackNote} ${run.url || ''}`.trim();
}

function buildRecoveryCycleSnapshot() {
    return {
        ...FLOW_OS_RECOVERY_CYCLE,
        scopeFreeze: {
            active: FLOW_OS_RECOVERY_CYCLE.status === 'active',
            allowedSlice: FLOW_OS_RECOVERY_CYCLE.allowedSlice,
            parkedFronts: [...FLOW_OS_RECOVERY_CYCLE.parkedFronts],
        },
        dailyRitual: {
            command: FLOW_OS_RECOVERY_CYCLE.dailyRitualCommands[0] || '',
            commands: [...FLOW_OS_RECOVERY_CYCLE.dailyRitualCommands],
            summary:
                'Usar un unico corte diario para readiness, auth rollout y piloto web antes de reabrir scope.',
        },
    };
}

function toMarkdown(summary) {
    const lines = [];
    const {
        generatedAt,
        branch,
        workflows,
        openProdAlerts,
        weeklyLocalReport,
        weeklyKpiHistory,
    } = summary;
    lines.push('# Prod Readiness Summary');
    lines.push('');
    lines.push(`- generatedAt: ${generatedAt}`);
    lines.push(`- branch: ${branch}`);
    lines.push(`- production_stability: ${summary.productionStability.signal}`);
    if (summary.releaseReadiness) {
        lines.push(`- release_readiness: ${summary.releaseReadiness.signal}`);
    }
    lines.push(
        `- plan_master_pending_count: ${summary.planMasterProgress.pendingCount}`
    );
    lines.push(
        `- plan_master_blocking_count: ${summary.planMasterProgress.blockingCount}`
    );
    lines.push('');

    if (summary.recoveryCycle) {
        lines.push('## Recovery Cycle');
        lines.push('');
        lines.push(`- id: ${summary.recoveryCycle.id}`);
        lines.push(`- status: ${summary.recoveryCycle.status}`);
        lines.push(
            `- window: ${summary.recoveryCycle.startsAt} -> ${summary.recoveryCycle.endsAt}`
        );
        lines.push(`- objective: ${summary.recoveryCycle.objective}`);
        lines.push(
            `- allowed_slice: ${summary.recoveryCycle.scopeFreeze?.allowedSlice || 'n/a'}`
        );
        lines.push(
            `- parked_fronts: ${
                summary.recoveryCycle.scopeFreeze?.parkedFronts?.length
                    ? summary.recoveryCycle.scopeFreeze.parkedFronts.join(', ')
                    : 'none'
            }`
        );
        lines.push(
            `- status_doc: ${summary.recoveryCycle.statusDoc || 'n/a'}`
        );
        lines.push(`- plan_doc: ${summary.recoveryCycle.planDoc || 'n/a'}`);
        lines.push(
            `- daily_ritual_command: ${summary.recoveryCycle.dailyRitual?.command || 'n/a'}`
        );
        lines.push(
            `- daily_ritual_commands: ${
                summary.recoveryCycle.dailyRitual?.commands?.length
                    ? summary.recoveryCycle.dailyRitual.commands.join(', ')
                    : 'none'
            }`
        );
        lines.push(
            `- daily_ritual_summary: ${summary.recoveryCycle.dailyRitual?.summary || 'n/a'}`
        );
        lines.push('');
    }

    if (summary.releaseReadiness) {
        lines.push('## Release Readiness');
        lines.push('');
        lines.push(`- signal: ${summary.releaseReadiness.signal}`);
        lines.push(`- summary: ${summary.releaseReadiness.summary}`);
        lines.push(
            `- blocking_count: ${summary.releaseReadiness.blockingCount}`
        );
        if (
            Array.isArray(summary.releaseReadiness.blockingReasons) &&
            summary.releaseReadiness.blockingReasons.length > 0
        ) {
            lines.push(
                `- blocking_reasons: ${summary.releaseReadiness.blockingReasons.join(', ')}`
            );
        } else {
            lines.push('- blocking_reasons: none');
        }
        lines.push(
            `- followup_count: ${summary.releaseReadiness.followupCount}`
        );
        if (
            Array.isArray(summary.releaseReadiness.followups) &&
            summary.releaseReadiness.followups.length > 0
        ) {
            lines.push(
                `- followups: ${summary.releaseReadiness.followups.join(', ')}`
            );
        } else {
            lines.push('- followups: none');
        }
        lines.push('');
    }

    lines.push('## Production Stability');
    lines.push('');
    lines.push(`- signal: ${summary.productionStability.signal}`);
    if (summary.productionStability.reasons.length > 0) {
        lines.push(
            `- reasons: ${summary.productionStability.reasons.join(', ')}`
        );
    } else {
        lines.push('- reasons: none');
    }
    if (
        Array.isArray(summary.productionStability.advisories) &&
        summary.productionStability.advisories.length > 0
    ) {
        lines.push(
            `- advisories: ${summary.productionStability.advisories.join(', ')}`
        );
    } else {
        lines.push('- advisories: none');
    }
    lines.push('');

    lines.push('## Critical Workflows (main)');
    lines.push('');
    lines.push(markdownWorkflowLine('CI', workflows.ci));
    lines.push(
        markdownWorkflowLine(
            'Post-Deploy Gate (Git Sync)',
            workflows.postDeployGate
        )
    );
    lines.push(
        markdownWorkflowLine(
            'Deploy Hosting (Canary Pipeline)',
            workflows.deployHosting
        )
    );
    lines.push(markdownWorkflowLine('Weekly KPI Report', workflows.weeklyKpi));
    lines.push(
        markdownWorkflowLine('Sentry Events Verify', workflows.sentryVerify)
    );
    lines.push(
        markdownWorkflowLine('Production Monitor', workflows.prodMonitor)
    );
    lines.push(
        markdownWorkflowLine(
            'Repair Git Sync (Self-Heal)',
            workflows.repairGitSync
        )
    );
    lines.push('');

    lines.push('## Weekly KPI Streak (main)');
    lines.push('');
    if (!weeklyKpiHistory || !weeklyKpiHistory.available) {
        lines.push(`- unavailable: ${weeklyKpiHistory?.error || 'n/a'}`);
    } else {
        lines.push(
            `- schedule_cron_utc: ${weeklyKpiHistory.scheduleCronUtc} (${weeklyKpiHistory.scheduleTimezone})`
        );
        lines.push(
            `- next_schedule_expected_at: ${weeklyKpiHistory.nextScheduleExpectedAt || 'n/a'}`
        );
        lines.push(
            `- next_schedule_in: ${weeklyKpiHistory.nextScheduleInLabel || 'n/a'}`
        );
        lines.push(
            `- recent_runs_evaluated: ${weeklyKpiHistory.totalRecentRuns}`
        );
        lines.push(
            `- any_event_success_streak: ${weeklyKpiHistory.anyEventSuccessStreak}`
        );
        lines.push(
            `- schedule_runs_seen: ${weeklyKpiHistory.scheduleRunsCount}`
        );
        lines.push(
            `- schedule_success_streak: ${weeklyKpiHistory.scheduleSuccessStreak}/${weeklyKpiHistory.scheduleCyclesTarget}`
        );
        lines.push(
            `- schedule_cycles_remaining: ${weeklyKpiHistory.scheduleCyclesRemaining}`
        );
        lines.push(
            `- phase6_schedule_pace: ${weeklyKpiHistory.phase6SchedulePace?.signal || 'n/a'} (${weeklyKpiHistory.phase6SchedulePace?.reason || 'n/a'})`
        );
        if (weeklyKpiHistory.latestScheduleRun) {
            lines.push(
                `- latest_schedule_run: ${weeklyKpiHistory.latestScheduleRun.id} (${weeklyKpiHistory.latestScheduleRun.conclusion || weeklyKpiHistory.latestScheduleRun.status}) ${weeklyKpiHistory.latestScheduleRun.url || ''}`.trim()
            );
            lines.push(
                `- latest_schedule_age: ${weeklyKpiHistory.latestScheduleRunAgeLabel || 'n/a'}`
            );
        } else {
            lines.push(
                '- latest_schedule_run: none (solo manual/workflow_dispatch recientes)'
            );
        }
    }
    lines.push('');

    lines.push('## Prod Alerts');
    lines.push('');
    if (!openProdAlerts.available) {
        lines.push(
            `- unavailable: ${openProdAlerts.error || 'gh issue list failed'}`
        );
    } else {
        lines.push(`- open_count: ${openProdAlerts.count}`);
        for (const issue of openProdAlerts.issues) {
            lines.push(
                `- #${issue.number}: ${issue.title} ${issue.url || ''}`.trim()
            );
        }
    }
    lines.push('');

    lines.push('## Weekly KPI (latest report; remote artifact preferred)');
    lines.push('');
    if (!weeklyLocalReport || !weeklyLocalReport.found) {
        lines.push('- status: not_found');
        lines.push(`- source: ${weeklyLocalReport?.source || 'n/a'}`);
        if (weeklyLocalReport?.error) {
            lines.push(`- error: ${weeklyLocalReport.error}`);
        }
    } else if (weeklyLocalReport.error) {
        lines.push(`- status: error`);
        lines.push(`- source: ${weeklyLocalReport.source || 'n/a'}`);
        lines.push(`- error: ${weeklyLocalReport.error}`);
        if (weeklyLocalReport.path) {
            lines.push(`- path: ${weeklyLocalReport.path}`);
        }
    } else {
        lines.push(`- source: ${weeklyLocalReport.source || 'n/a'}`);
        if (weeklyLocalReport.reportRun?.id) {
            lines.push(`- source_run_id: ${weeklyLocalReport.reportRun.id}`);
        }
        if (weeklyLocalReport.reportRun?.url) {
            lines.push(`- source_run_url: ${weeklyLocalReport.reportRun.url}`);
        }
        if (weeklyLocalReport.fallbackAttempted) {
            lines.push('- source_fallback_attempted: true');
        }
        if (weeklyLocalReport.fallbackFromRemoteError) {
            lines.push(
                `- source_fallback_remote_error: ${weeklyLocalReport.fallbackFromRemoteError}`
            );
        }
        lines.push(`- path: ${weeklyLocalReport.path}`);
        lines.push(`- generatedAt: ${weeklyLocalReport.generatedAt || 'n/a'}`);
        lines.push(`- mtime: ${weeklyLocalReport.mtime || 'n/a'}`);
        lines.push(
            `- warnings_total: ${weeklyLocalReport.warningCounts.total}`
        );
        lines.push(
            `- warnings_critical: ${weeklyLocalReport.warningCounts.critical}`
        );
        lines.push(
            `- warnings_non_critical: ${weeklyLocalReport.warningCounts.nonCritical}`
        );
        lines.push(
            `- warnings_critical_list: ${
                weeklyLocalReport.warningsBySeverity.critical.length
                    ? weeklyLocalReport.warningsBySeverity.critical.join(', ')
                    : 'none'
            }`
        );
        lines.push(
            `- warnings_non_critical_list: ${
                weeklyLocalReport.warningsBySeverity.nonCritical.length
                    ? weeklyLocalReport.warningsBySeverity.nonCritical.join(
                          ', '
                      )
                    : 'none'
            }`
        );
        lines.push(
            `- latency_core_p95_max_ms: ${
                weeklyLocalReport.latency.coreP95MaxMs ?? 'n/a'
            }`
        );
        lines.push(
            `- latency_availability_p95_ms: ${
                weeklyLocalReport.latency.availabilityP95Ms ?? 'n/a'
            }`
        );
        lines.push(
            `- latency_figo_post_p95_ms: ${
                weeklyLocalReport.latency.figoPostP95Ms ?? 'n/a'
            }`
        );
        lines.push(
            `- retention_recurrence_rate_pct: ${
                weeklyLocalReport.retention.recurrenceRatePct ?? 'n/a'
            }`
        );
        lines.push(
            `- conversion_start_checkout_rate_pct: ${
                weeklyLocalReport.conversion.startCheckoutRatePct ?? 'n/a'
            }`
        );
        lines.push(
            `- conversion_booking_confirmed_rate_pct: ${
                weeklyLocalReport.conversion.bookingConfirmedRatePct ?? 'n/a'
            }`
        );
    }
    lines.push('');

    lines.push('## Sentry Evidence');
    lines.push('');
    if (!summary.sentryEvidence || !summary.sentryEvidence.found) {
        lines.push('- status: not_found');
        lines.push(`- source: ${summary.sentryEvidence?.source || 'n/a'}`);
        if (summary.sentryEvidence?.error) {
            lines.push(`- error: ${summary.sentryEvidence.error}`);
        }
    } else if (summary.sentryEvidence.error) {
        lines.push('- status: error');
        lines.push(`- source: ${summary.sentryEvidence.source || 'n/a'}`);
        lines.push(`- error: ${summary.sentryEvidence.error}`);
        if (summary.sentryEvidence.path) {
            lines.push(`- path: ${summary.sentryEvidence.path}`);
        }
    } else {
        lines.push(`- source: ${summary.sentryEvidence.source || 'n/a'}`);
        lines.push(`- ok: ${summary.sentryEvidence.ok ? 'true' : 'false'}`);
        lines.push(`- status: ${summary.sentryEvidence.status || 'n/a'}`);
        if (summary.sentryEvidence.reportRun?.id) {
            lines.push(
                `- source_run_id: ${summary.sentryEvidence.reportRun.id}`
            );
        }
        if (summary.sentryEvidence.reportRun?.url) {
            lines.push(
                `- source_run_url: ${summary.sentryEvidence.reportRun.url}`
            );
        }
        if (summary.sentryEvidence.fallbackAttempted) {
            lines.push('- source_fallback_attempted: true');
        }
        if (summary.sentryEvidence.fallbackFromRemoteError) {
            lines.push(
                `- source_fallback_remote_error: ${summary.sentryEvidence.fallbackFromRemoteError}`
            );
        }
        lines.push(`- path: ${summary.sentryEvidence.path || 'n/a'}`);
        lines.push(
            `- generatedAt: ${summary.sentryEvidence.generatedAt || 'n/a'}`
        );
        lines.push(`- mtime: ${summary.sentryEvidence.mtime || 'n/a'}`);
        lines.push(
            `- backend_found: ${summary.sentryEvidence.backend?.found ? 'true' : 'false'}`
        );
        lines.push(
            `- frontend_found: ${summary.sentryEvidence.frontend?.found ? 'true' : 'false'}`
        );
        lines.push(
            `- missing_env: ${
                summary.sentryEvidence.missingEnv?.length
                    ? summary.sentryEvidence.missingEnv.join(', ')
                    : 'none'
            }`
        );
        lines.push(
            `- missing_projects: ${
                summary.sentryEvidence.missingProjects?.length
                    ? summary.sentryEvidence.missingProjects.join(', ')
                    : 'none'
            }`
        );
        lines.push(
            `- stale_projects: ${
                summary.sentryEvidence.staleProjects?.length
                    ? summary.sentryEvidence.staleProjects
                          .map(
                              (row) =>
                                  `${row.project} (${row.ageHours}h > ${row.maxAgeHours}h)`
                          )
                          .join(', ')
                    : 'none'
            }`
        );
        if (summary.sentryEvidence.failureReason?.code) {
            lines.push(
                `- failure_code: ${summary.sentryEvidence.failureReason.code}`
            );
        }
        if (summary.sentryEvidence.failureReason?.message) {
            lines.push(
                `- failure_message: ${summary.sentryEvidence.failureReason.message}`
            );
        }
        if (summary.sentryEvidence.actionRequired) {
            lines.push(
                `- action_required: ${summary.sentryEvidence.actionRequired}`
            );
        }
    }
    lines.push('');

    lines.push('## Production Monitor Evidence');
    lines.push('');
    if (!summary.prodMonitorEvidence || !summary.prodMonitorEvidence.found) {
        lines.push('- status: not_found');
        lines.push(`- source: ${summary.prodMonitorEvidence?.source || 'n/a'}`);
        if (summary.prodMonitorEvidence?.error) {
            lines.push(`- error: ${summary.prodMonitorEvidence.error}`);
        }
    } else if (summary.prodMonitorEvidence.error) {
        lines.push('- status: error');
        lines.push(`- source: ${summary.prodMonitorEvidence.source || 'n/a'}`);
        lines.push(`- error: ${summary.prodMonitorEvidence.error}`);
        if (summary.prodMonitorEvidence.path) {
            lines.push(`- path: ${summary.prodMonitorEvidence.path}`);
        }
    } else {
        lines.push(`- source: ${summary.prodMonitorEvidence.source || 'n/a'}`);
        lines.push(
            `- ok: ${summary.prodMonitorEvidence.ok ? 'true' : 'false'}`
        );
        lines.push(`- status: ${summary.prodMonitorEvidence.status || 'n/a'}`);
        if (summary.prodMonitorEvidence.reportRun?.id) {
            lines.push(
                `- source_run_id: ${summary.prodMonitorEvidence.reportRun.id}`
            );
        }
        if (summary.prodMonitorEvidence.reportRun?.url) {
            lines.push(
                `- source_run_url: ${summary.prodMonitorEvidence.reportRun.url}`
            );
        }
        if (summary.prodMonitorEvidence.fallbackAttempted) {
            lines.push('- source_fallback_attempted: true');
        }
        if (summary.prodMonitorEvidence.fallbackFromRemoteError) {
            lines.push(
                `- source_fallback_remote_error: ${summary.prodMonitorEvidence.fallbackFromRemoteError}`
            );
        }
        lines.push(`- path: ${summary.prodMonitorEvidence.path || 'n/a'}`);
        lines.push(
            `- generatedAt: ${summary.prodMonitorEvidence.generatedAt || 'n/a'}`
        );
        lines.push(`- mtime: ${summary.prodMonitorEvidence.mtime || 'n/a'}`);
        lines.push(
            `- failure_count: ${summary.prodMonitorEvidence.failureCount ?? 'n/a'}`
        );
        lines.push(
            `- warning_count: ${summary.prodMonitorEvidence.warningCount ?? 'n/a'}`
        );
        lines.push(
            `- health_status: ${summary.prodMonitorEvidence.health?.status || 'n/a'}`
        );
        lines.push(
            `- public_sync_status: ${summary.prodMonitorEvidence.publicSync?.status || 'n/a'}`
        );
        lines.push(
            `- telemedicine_status: ${summary.prodMonitorEvidence.telemedicine?.status || 'n/a'}`
        );
        lines.push(
            `- turnero_pilot_status: ${summary.prodMonitorEvidence.turneroPilot?.status || 'n/a'}`
        );
        lines.push(
            `- github_deploy_alerts_status: ${summary.prodMonitorEvidence.githubDeployAlerts?.status || 'n/a'}`
        );
        lines.push(
            `- public_sync_recovery_status: ${summary.prodMonitorEvidence.publicSyncRecovery?.status || 'n/a'}`
        );
        lines.push(
            `- public_cutover_status: ${summary.prodMonitorEvidence.publicCutover?.stepOutcome || 'n/a'}`
        );
        lines.push(
            `- public_v4_rollout_status: ${summary.prodMonitorEvidence.publicV4Rollout?.stepOutcome || 'n/a'}`
        );
        if (summary.prodMonitorEvidence.summary?.headline) {
            lines.push(
                `- summary_headline: ${summary.prodMonitorEvidence.summary.headline}`
            );
        }
        lines.push(
            `- failures: ${
                summary.prodMonitorEvidence.failures?.length
                    ? summary.prodMonitorEvidence.failures.join(' | ')
                    : 'none'
            }`
        );
        lines.push(
            `- warnings: ${
                summary.prodMonitorEvidence.warnings?.length
                    ? summary.prodMonitorEvidence.warnings.join(' | ')
                    : 'none'
            }`
        );
    }
    lines.push('');

    lines.push('## Operator Auth Evidence');
    lines.push('');
    if (!summary.operatorAuthEvidence || !summary.operatorAuthEvidence.available) {
        lines.push('- status: unavailable');
        lines.push(
            `- source: ${summary.operatorAuthEvidence?.source || 'openclaw_auth_rollout'}`
        );
        if (summary.operatorAuthEvidence?.error) {
            lines.push(`- error: ${summary.operatorAuthEvidence.error}`);
        }
    } else if (!summary.operatorAuthEvidence.found) {
        lines.push('- status: not_found');
        lines.push(
            `- source: ${summary.operatorAuthEvidence.source || 'openclaw_auth_rollout'}`
        );
        if (summary.operatorAuthEvidence.error) {
            lines.push(`- error: ${summary.operatorAuthEvidence.error}`);
        }
    } else {
        lines.push(
            `- source: ${summary.operatorAuthEvidence.source || 'openclaw_auth_rollout'}`
        );
        lines.push(`- ok: ${summary.operatorAuthEvidence.ok ? 'true' : 'false'}`);
        lines.push(
            `- diagnosis: ${summary.operatorAuthEvidence.diagnosis || 'n/a'}`
        );
        lines.push(`- mode: ${summary.operatorAuthEvidence.mode || 'n/a'}`);
        lines.push(
            `- transport: ${summary.operatorAuthEvidence.transport || 'n/a'}`
        );
        lines.push(`- status: ${summary.operatorAuthEvidence.status || 'n/a'}`);
        lines.push(
            `- configured: ${summary.operatorAuthEvidence.configured ? 'true' : 'false'}`
        );
        lines.push(
            `- recommended_mode: ${summary.operatorAuthEvidence.recommendedMode || 'n/a'}`
        );
        lines.push(
            `- contract_valid: ${summary.operatorAuthEvidence.contractValid ? 'true' : 'false'}`
        );
        if (summary.operatorAuthEvidence.primaryHttpStatus) {
            lines.push(
                `- operator_auth_http_status: ${summary.operatorAuthEvidence.primaryHttpStatus}`
            );
        }
        if (summary.operatorAuthEvidence.facadeHttpStatus) {
            lines.push(
                `- admin_auth_http_status: ${summary.operatorAuthEvidence.facadeHttpStatus}`
            );
        }
        if (summary.operatorAuthEvidence.nextAction) {
            lines.push(
                `- next_action: ${summary.operatorAuthEvidence.nextAction}`
            );
        }
        if (summary.operatorAuthEvidence.command) {
            lines.push(`- command: ${summary.operatorAuthEvidence.command}`);
        }
    }
    lines.push('');

    lines.push('## Public Main Sync Evidence');
    lines.push('');
    if (
        !summary.publicMainSyncEvidence ||
        !summary.publicMainSyncEvidence.available
    ) {
        lines.push('- status: unavailable');
        lines.push(
            `- source: ${summary.publicMainSyncEvidence?.source || 'agent_orchestrator'}`
        );
        if (summary.publicMainSyncEvidence?.error) {
            lines.push(`- error: ${summary.publicMainSyncEvidence.error}`);
        }
    } else if (!summary.publicMainSyncEvidence.found) {
        lines.push('- status: not_found');
        lines.push(
            `- source: ${summary.publicMainSyncEvidence.source || 'agent_orchestrator'}`
        );
        if (summary.publicMainSyncEvidence.error) {
            lines.push(`- error: ${summary.publicMainSyncEvidence.error}`);
        }
    } else {
        lines.push(
            `- source: ${summary.publicMainSyncEvidence.source || 'agent_orchestrator'}`
        );
        lines.push(
            `- ok: ${summary.publicMainSyncEvidence.ok ? 'true' : 'false'}`
        );
        lines.push(`- state: ${summary.publicMainSyncEvidence.state || 'n/a'}`);
        lines.push(
            `- verification_source: ${
                summary.publicMainSyncEvidence.verificationSource || 'n/a'
            }`
        );
        lines.push(
            `- failure_reason: ${
                summary.publicMainSyncEvidence.failureReason || 'none'
            }`
        );
        lines.push(
            `- operationally_healthy: ${
                summary.publicMainSyncEvidence.operationallyHealthy
                    ? 'true'
                    : 'false'
            }`
        );
        lines.push(
            `- repo_hygiene_issue: ${
                summary.publicMainSyncEvidence.repoHygieneIssue
                    ? 'true'
                    : 'false'
            }`
        );
        lines.push(
            `- head_drift: ${
                summary.publicMainSyncEvidence.headDrift ? 'true' : 'false'
            }`
        );
        lines.push(
            `- telemetry_gap: ${
                summary.publicMainSyncEvidence.telemetryGap ? 'true' : 'false'
            }`
        );
        if (summary.publicMainSyncEvidence.httpStatus) {
            lines.push(
                `- http_status: ${summary.publicMainSyncEvidence.httpStatus}`
            );
        }
        if (summary.publicMainSyncEvidence.responseDetail) {
            lines.push(
                `- response_detail: ${summary.publicMainSyncEvidence.responseDetail}`
            );
        }
        if (summary.publicMainSyncEvidence.command) {
            lines.push(`- command: ${summary.publicMainSyncEvidence.command}`);
        }
    }
    lines.push('');

    lines.push('## Pending Real (Plan Maestro)');
    lines.push('');
    for (const item of summary.planMasterProgress.pending) {
        lines.push(`- ${item.id} [${item.status}] ${item.title}`);
        lines.push(`  notes: ${item.notes}`);
    }
    lines.push('');

    lines.push('## Suggested Actions');
    lines.push('');
    if (
        !summary.suggestedActions ||
        !Array.isArray(summary.suggestedActions.items) ||
        summary.suggestedActions.items.length === 0
    ) {
        lines.push('- none');
    } else {
        lines.push(
            `- count: ${summary.suggestedActions.count} (blocking: ${summary.suggestedActions.blockingCount})`
        );
        for (const action of summary.suggestedActions.items) {
            lines.push(
                `- [${action.priority}] ${action.id}: ${action.title}${action.blocking ? ' [blocking]' : ''}`
            );
            lines.push(`  reason: ${action.reason}`);
            if (action.command) {
                lines.push(`  command: ${action.command}`);
            }
            if (action.url) {
                lines.push(`  url: ${action.url}`);
            }
        }
    }
    lines.push('');

    lines.push('## Execution Efficiency (recent)');
    lines.push('');
    if (!summary.executionEfficiency) {
        lines.push('- unavailable');
    } else {
        const eff = summary.executionEfficiency;
        lines.push(`- window_hours: ${eff.windowHours}`);
        lines.push(`- cutoff_utc: ${eff.cutoffIso}`);
        lines.push(`- signal: ${eff.signal}`);
        lines.push(
            `- merged_prs_count: ${
                eff.mergedPrs?.available ? eff.mergedPrs.count : 'n/a'
            }`
        );
        lines.push(
            `- workflow_runs_count: ${
                eff.workflowRuns?.available ? eff.workflowRuns.count : 'n/a'
            }`
        );
        lines.push(
            `- manual_workflow_dispatch_runs: ${
                eff.workflowRuns?.available
                    ? eff.workflowRuns.byEvent.workflow_dispatch
                    : 'n/a'
            }`
        );
        lines.push(
            `- critical_manual_workflow_dispatch_runs: ${
                eff.workflowRuns?.available
                    ? eff.workflowRuns.criticalManualRunsCount
                    : 'n/a'
            }`
        );
        lines.push(
            `- schedule_runs: ${
                eff.workflowRuns?.available
                    ? eff.workflowRuns.byEvent.schedule
                    : 'n/a'
            }`
        );
        lines.push(
            `- push_runs: ${
                eff.workflowRuns?.available
                    ? eff.workflowRuns.byEvent.push
                    : 'n/a'
            }`
        );
        if (Array.isArray(eff.notes) && eff.notes.length > 0) {
            lines.push(`- notes: ${eff.notes.join(', ')}`);
        } else {
            lines.push('- notes: none');
        }
    }
    lines.push('');

    lines.push('## Usage');
    lines.push('');
    lines.push('- Command: `npm run prod:readiness:summary`');
    lines.push(`- JSON: \`${summary.paths.jsonOutRelative}\``);
    lines.push(`- Markdown: \`${summary.paths.mdOutRelative}\``);
    return lines.join('\n');
}

function relativePath(path) {
    return path.replace(`${ROOT}\\`, '').replaceAll('\\', '/');
}

function usage() {
    return [
        'Uso: node bin/prod-readiness-summary.js [--branch=main] [--weekly-source=auto] [--weekly-history-limit=12] [--weekly-dir=verification/weekly]',
        '',
        'Opcionales:',
        `  --json-out=PATH     Reporte JSON (default ${DEFAULT_JSON_OUT})`,
        `  --md-out=PATH       Reporte Markdown (default ${DEFAULT_MD_OUT})`,
        '  --branch=BRANCH     Rama para consultar workflows via gh (default main)',
        '  --weekly-source=MODE  Fuente del Weekly KPI: auto|remote|local (default auto)',
        '  --weekly-history-limit=N  Runs recientes de Weekly KPI para streak (default 12)',
        '  --efficiency-hours=N  Ventana para metricas de ejecucion/fragmentacion (default 24)',
        '  --weekly-dir=PATH   Directorio de reportes semanales locales (default verification/weekly)',
        '  --runs-limit=N      Reservado para versiones futuras (default 1)',
        '  --print-json        Imprime JSON en stdout',
        '  --help              Muestra esta ayuda',
        '',
        'Requiere `gh auth login` para consultar workflows/issues remotos.',
    ].join('\n');
}

function main() {
    if (hasFlag('help')) {
        process.stdout.write(`${usage()}\n`);
        return;
    }

    const branch = parseStringArg('branch', 'main');
    const weeklySource = parseStringArg('weekly-source', 'auto');
    const weeklyHistoryLimit = parseIntArg('weekly-history-limit', 12, 1);
    const efficiencyHours = parseIntArg('efficiency-hours', 24, 1);
    const weeklyDir = parseStringArg('weekly-dir', 'verification/weekly');
    parseIntArg('runs-limit', 1, 1); // reservado; valida formato y deja contrato listo
    const jsonOut = resolve(ROOT, parseStringArg('json-out', DEFAULT_JSON_OUT));
    const mdOut = resolve(ROOT, parseStringArg('md-out', DEFAULT_MD_OUT));

    const workflows = {
        ci: fetchLatestWorkflowRun(
            { workflowRef: '.github/workflows/ci.yml', label: 'CI' },
            branch
        ),
        postDeployGate: fetchLatestWorkflowRun(
            {
                workflowRef: '.github/workflows/post-deploy-gate.yml',
                label: 'Post-Deploy Gate',
            },
            branch
        ),
        deployHosting: fetchLatestWorkflowRun(
            {
                workflowRef: '.github/workflows/deploy-hosting.yml',
                label: 'Deploy Hosting (Canary Pipeline)',
            },
            branch
        ),
        weeklyKpi: fetchLatestWorkflowRun(
            {
                workflowRef: '.github/workflows/weekly-kpi-report.yml',
                label: 'Weekly KPI Report',
            },
            branch
        ),
        sentryVerify: fetchLatestWorkflowRun(
            {
                workflowRef: '.github/workflows/sentry-events-verify.yml',
                label: 'Sentry Events Verify',
            },
            branch
        ),
        prodMonitor: fetchLatestWorkflowRun(
            {
                workflowRef: '.github/workflows/prod-monitor.yml',
                label: 'Production Monitor',
            },
            branch
        ),
        repairGitSync: fetchLatestWorkflowRun(
            {
                workflowRef: '.github/workflows/repair-git-sync.yml',
                label: 'Repair Git Sync (Self-Heal)',
            },
            branch
        ),
    };
    const weeklyKpiRunsRecent = fetchRecentWorkflowRuns(
        {
            workflowRef: '.github/workflows/weekly-kpi-report.yml',
            label: 'Weekly KPI Report',
        },
        branch,
        weeklyHistoryLimit
    );
    const weeklyKpiHistory = computeWeeklyKpiHistory(weeklyKpiRunsRecent);
    const openProdAlerts = fetchOpenProdAlerts();
    const weeklyLocalReport = readWeeklyReportPreferred({
        mode: weeklySource,
        weeklyDir,
        weeklyKpiRun: workflows.weeklyKpi,
    });
    const sentryEvidence = readSentryEvidencePreferred({
        localPath: DEFAULT_SENTRY_JSON_OUT,
        sentryRun: workflows.sentryVerify,
    });
    const prodMonitorEvidence = readProdMonitorEvidencePreferred({
        localPath: DEFAULT_PROD_MONITOR_JSON_OUT,
        prodMonitorRun: workflows.prodMonitor,
    });
    const publicMainSyncEvidence = readPublicMainSyncEvidence();
    const operatorAuthEvidence = readOperatorAuthEvidence();
    const productionStability = computeProductionStability({
        workflows,
        openProdAlerts,
        weeklyLocalReport,
        weeklyKpiHistory,
        sentryEvidence,
        prodMonitorEvidence,
        publicMainSyncEvidence,
        operatorAuthEvidence,
    });
    const planMasterProgress = computePlanMasterProgress({
        workflows,
        openProdAlerts,
        weeklyLocalReport,
        weeklyKpiHistory,
        sentryEvidence,
    });
    const executionEfficiency = computeExecutionEfficiency({
        branch,
        workflows,
        windowHours: efficiencyHours,
    });
    const suggestedActions = computeSuggestedActions({
        workflows,
        openProdAlerts,
        weeklyLocalReport,
        weeklyKpiHistory,
        planMasterProgress,
        productionStability,
        executionEfficiency,
        sentryEvidence,
        prodMonitorEvidence,
        publicMainSyncEvidence,
        operatorAuthEvidence,
    });
    const releaseReadiness = computeReleaseReadiness({
        productionStability,
        planMasterProgress,
        suggestedActions,
    });
    const recoveryCycle = buildRecoveryCycleSnapshot();

    const summary = {
        generatedAt: new Date().toISOString(),
        repo: {
            root: ROOT,
            branch,
        },
        branch,
        weeklySourceMode: weeklySource,
        weeklyHistoryLimit,
        efficiencyHours,
        recoveryCycle,
        productionStability,
        releaseReadiness,
        planMasterProgress,
        suggestedActions,
        executionEfficiency,
        workflows,
        weeklyKpiHistory,
        openProdAlerts,
        weeklyLocalReport,
        sentryEvidence,
        prodMonitorEvidence,
        publicMainSyncEvidence,
        operatorAuthEvidence,
        paths: {
            jsonOut,
            mdOut,
            jsonOutRelative: relativePath(jsonOut),
            mdOutRelative: relativePath(mdOut),
        },
    };

    const markdown = toMarkdown(summary);
    ensureDirForFile(jsonOut);
    ensureDirForFile(mdOut);
    writeFileSync(jsonOut, `${JSON.stringify(summary, null, 2)}\n`, 'utf8');
    writeFileSync(mdOut, `${markdown}\n`, 'utf8');

    if (hasFlag('print-json')) {
        process.stdout.write(`${JSON.stringify(summary, null, 2)}\n`);
        return;
    }

    process.stdout.write(`${markdown}\n`);
}

try {
    main();
} catch (error) {
    process.stderr.write(`prod-readiness-summary error: ${error.message}\n`);
    process.exit(1);
}
