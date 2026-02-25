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

function safeJsonParse(text, fallback = null) {
    try {
        return JSON.parse(String(text || ''));
    } catch (_error) {
        return fallback;
    }
}

function runGh(args, { allowFailure = true } = {}) {
    const result = spawnSync('gh', args, {
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
        command: `gh ${args.join(' ')}`,
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

function formatAgeMinutes(ageMinutes) {
    if (!Number.isFinite(ageMinutes)) return 'n/a';
    if (ageMinutes < 60) return `${ageMinutes}m`;
    const h = Math.floor(ageMinutes / 60);
    const m = ageMinutes % 60;
    return `${h}h${m}m`;
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
            '1',
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
    return {
        workflowName: label,
        workflowRef,
        available: true,
        error: null,
        latest: mapRun(list[0] || null),
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
            let mtimeMs;
            try {
                mtimeMs = statSync(fullPath).mtimeMs;
            } catch (_error) {
                mtimeMs = 0;
            }
            return { name, fullPath, mtimeMs };
        })
        .sort((a, b) => b.mtimeMs - a.mtimeMs);
    return candidates[0] || null;
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

function findWeeklyReportJsonRecursive(rootDir) {
    const stack = [rootDir];
    const matches = [];
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
            if (/^weekly-report-\d{8}\.json$/i.test(entry.name)) {
                let mtimeMs;
                try {
                    mtimeMs = statSync(fullPath).mtimeMs;
                } catch (_error) {
                    mtimeMs = 0;
                }
                matches.push({ fullPath, name: entry.name, mtimeMs });
            }
        }
    }
    matches.sort((a, b) => b.mtimeMs - a.mtimeMs);
    return matches[0] || null;
}

function downloadWeeklyReportArtifact(runId) {
    const tempBase = mkdtempSync(join(tmpdir(), 'prod-readiness-weekly-'));
    const res = runGh(
        [
            'run',
            'download',
            String(runId),
            '-n',
            'weekly-kpi-report',
            '-D',
            tempBase,
        ],
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

    const file = findWeeklyReportJsonRecursive(tempBase);
    if (!file) {
        try {
            rmSync(tempBase, { recursive: true, force: true });
        } catch (_error) {
            // best effort
        }
        return {
            ok: false,
            error: 'Artifact weekly-kpi-report no contiene weekly-report-*.json',
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

function readWeeklyReportFromRemoteArtifact(
    weeklyRunWrapper,
    fallbackOutputDir
) {
    if (
        !weeklyRunWrapper ||
        !weeklyRunWrapper.available ||
        !weeklyRunWrapper.latest ||
        !weeklyRunWrapper.latest.id
    ) {
        return {
            found: false,
            source: 'remote_artifact',
            outputDir: fallbackOutputDir || null,
            path: null,
            error: 'No hay run de Weekly KPI disponible para descargar artifact',
        };
    }

    const run = weeklyRunWrapper.latest;
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

function coerceRunHealth(runWrapper) {
    if (!runWrapper || !runWrapper.available) {
        return { signal: 'YELLOW', reason: 'unavailable' };
    }
    if (!runWrapper.latest) {
        return { signal: 'YELLOW', reason: 'missing' };
    }
    if (runWrapper.latest.status !== 'completed') {
        return {
            signal: 'YELLOW',
            reason: `status:${runWrapper.latest.status}`,
        };
    }
    if (runWrapper.latest.conclusion === 'success') {
        return { signal: 'GREEN', reason: 'success' };
    }
    return {
        signal: 'RED',
        reason: `conclusion:${runWrapper.latest.conclusion || 'unknown'}`,
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

    return {
        available: true,
        error: null,
        recentLimit: recentRuns.length,
        totalRecentRuns: recentRuns.length,
        anyEventSuccessStreak,
        scheduleRunsCount: scheduleRuns.length,
        scheduleSuccessStreak,
        scheduleCyclesTarget,
        scheduleCyclesRemaining: Math.max(
            0,
            scheduleCyclesTarget - scheduleSuccessStreak
        ),
        latestScheduleRun: scheduleRuns[0] || null,
        recentRuns: recentRuns.slice(0, 8),
    };
}

function computeProductionStability({
    workflows,
    openProdAlerts,
    weeklyLocalReport,
}) {
    const criticalWorkflowKeys = ['ci', 'postDeployGate', 'deployHosting'];
    const reasons = [];
    let signal = 'GREEN';

    for (const key of criticalWorkflowKeys) {
        const health = coerceRunHealth(workflows[key]);
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

    return {
        signal,
        reasons,
        criticalWorkflowKeys,
    };
}

function computePlanMasterProgress({
    workflows,
    openProdAlerts,
    weeklyLocalReport,
    weeklyKpiHistory,
}) {
    const pending = [];
    pending.push({
        id: 'PM-SENTRY-001',
        title: 'Confirmar primer evento de Sentry (backend + frontend)',
        status: 'pending_external',
        owner: 'manual/external',
        notes: 'Pendiente por acceso/token Sentry para evidencia de dashboard/API.',
    });

    const weeklyRun = workflows.weeklyKpi?.latest || null;
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
            `any_event_success_streak=${anyEventStreak}.`;
        if (latestScheduleRun) {
            f6Notes += ` Latest schedule run ${latestScheduleRun.id} => ${latestScheduleRun.conclusion || latestScheduleRun.status}.`;
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

function markdownWorkflowLine(label, wrapper) {
    if (!wrapper || !wrapper.available) {
        return `- ${label}: unavailable`;
    }
    if (!wrapper.latest) {
        return `- ${label}: no runs found`;
    }
    const run = wrapper.latest;
    return `- ${label}: ${run.conclusion || run.status || 'unknown'} (run ${run.id}, ${run.ageLabel}, ${run.durationLabel}) ${run.url || ''}`.trim();
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
    lines.push(
        `- plan_master_pending_count: ${summary.planMasterProgress.pendingCount}`
    );
    lines.push(
        `- plan_master_blocking_count: ${summary.planMasterProgress.blockingCount}`
    );
    lines.push('');

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
        if (weeklyKpiHistory.latestScheduleRun) {
            lines.push(
                `- latest_schedule_run: ${weeklyKpiHistory.latestScheduleRun.id} (${weeklyKpiHistory.latestScheduleRun.conclusion || weeklyKpiHistory.latestScheduleRun.status}) ${weeklyKpiHistory.latestScheduleRun.url || ''}`.trim()
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

    lines.push('## Pending Real (Plan Maestro)');
    lines.push('');
    for (const item of summary.planMasterProgress.pending) {
        lines.push(`- ${item.id} [${item.status}] ${item.title}`);
        lines.push(`  notes: ${item.notes}`);
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
    const productionStability = computeProductionStability({
        workflows,
        openProdAlerts,
        weeklyLocalReport,
    });
    const planMasterProgress = computePlanMasterProgress({
        workflows,
        openProdAlerts,
        weeklyLocalReport,
        weeklyKpiHistory,
    });

    const summary = {
        generatedAt: new Date().toISOString(),
        repo: {
            root: ROOT,
            branch,
        },
        branch,
        weeklySourceMode: weeklySource,
        weeklyHistoryLimit,
        productionStability,
        planMasterProgress,
        workflows,
        weeklyKpiHistory,
        openProdAlerts,
        weeklyLocalReport,
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
