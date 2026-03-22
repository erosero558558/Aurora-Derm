#!/usr/bin/env node
'use strict';

const { spawnSync } = require('child_process');
const { mkdirSync, writeFileSync } = require('fs');
const { dirname, resolve, relative } = require('path');

const ROOT = resolve(__dirname, '..');
const DEFAULT_DOMAIN = 'https://pielarmonia.com';
const DEFAULT_REPORT_PATH = 'verification/runtime/flow-os-recovery-daily.json';
const DEFAULT_SUMMARY_JSON_OUT =
    'verification/runtime/prod-readiness-summary.json';
const DEFAULT_SUMMARY_MD_OUT = 'verification/runtime/prod-readiness-summary.md';
const DEFAULT_AUTH_REPORT_PATH =
    'verification/last-admin-openclaw-auth-diagnostic.json';

const FLOW_OS_RECOVERY_CYCLE = Object.freeze({
    id: 'flow-os-recovery-2026-03-21',
    startsAt: '2026-03-21',
    endsAt: '2026-04-20',
    allowedSlice:
        'admin v3 + queue/turnero + auth Google + readiness + deploy',
    statusDoc: 'docs/PRODUCT_OPERATIONAL_STATUS.md',
    planDoc: 'docs/FLOW_OS_RECOVERY_PLAN.md',
});

function readFlagValue(argv, index) {
    if (index + 1 >= argv.length) {
        throw new Error(`Falta valor para ${argv[index]}`);
    }

    return String(argv[index + 1] || '').trim();
}

function parseArgs(argv = process.argv.slice(2)) {
    const options = {
        domain: DEFAULT_DOMAIN,
        reportPath: DEFAULT_REPORT_PATH,
        summaryJsonOut: DEFAULT_SUMMARY_JSON_OUT,
        summaryMdOut: DEFAULT_SUMMARY_MD_OUT,
        authReportPath: DEFAULT_AUTH_REPORT_PATH,
    };

    for (let index = 0; index < argv.length; index += 1) {
        const raw = String(argv[index] || '').trim();
        if (!raw) {
            continue;
        }

        if (raw.startsWith('--domain=')) {
            options.domain =
                raw.slice('--domain='.length).trim() || options.domain;
            continue;
        }
        if (raw === '--domain') {
            options.domain = readFlagValue(argv, index) || options.domain;
            index += 1;
            continue;
        }

        if (raw.startsWith('--report-path=')) {
            options.reportPath =
                raw.slice('--report-path='.length).trim() || options.reportPath;
            continue;
        }
        if (raw === '--report-path') {
            options.reportPath =
                readFlagValue(argv, index) || options.reportPath;
            index += 1;
            continue;
        }

        if (raw.startsWith('--summary-json-out=')) {
            options.summaryJsonOut =
                raw.slice('--summary-json-out='.length).trim() ||
                options.summaryJsonOut;
            continue;
        }
        if (raw === '--summary-json-out') {
            options.summaryJsonOut =
                readFlagValue(argv, index) || options.summaryJsonOut;
            index += 1;
            continue;
        }

        if (raw.startsWith('--summary-md-out=')) {
            options.summaryMdOut =
                raw.slice('--summary-md-out='.length).trim() ||
                options.summaryMdOut;
            continue;
        }
        if (raw === '--summary-md-out') {
            options.summaryMdOut =
                readFlagValue(argv, index) || options.summaryMdOut;
            index += 1;
            continue;
        }

        if (raw.startsWith('--auth-report-path=')) {
            options.authReportPath =
                raw.slice('--auth-report-path='.length).trim() ||
                options.authReportPath;
            continue;
        }
        if (raw === '--auth-report-path') {
            options.authReportPath =
                readFlagValue(argv, index) || options.authReportPath;
            index += 1;
            continue;
        }

        throw new Error(`Argumento no soportado: ${raw}`);
    }

    return options;
}

function ensureDirForFile(filePath) {
    mkdirSync(dirname(filePath), { recursive: true });
}

function parseJsonOutput(text) {
    const normalized = String(text || '')
        .replace(/^\uFEFF/, '')
        .trim();
    if (!normalized) {
        throw new Error('La salida JSON esta vacia.');
    }

    try {
        return JSON.parse(normalized);
    } catch (_error) {
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
            try {
                return JSON.parse(candidate);
            } catch (_candidateError) {
                // Keep looking for the last valid JSON payload in mixed stdout.
            }
        }
    }

    throw new Error('No se pudo extraer un payload JSON valido.');
}

function runNodeScript(scriptRelativePath, args) {
    const scriptPath = resolve(ROOT, scriptRelativePath);
    const result = spawnSync(process.execPath, [scriptPath, ...args], {
        cwd: ROOT,
        encoding: 'utf8',
    });

    if (result.status !== 0) {
        throw new Error(
            result.stderr || result.stdout || `Fallo ${scriptRelativePath}`
        );
    }

    return result.stdout;
}

function buildBlockingActions(summary = {}) {
    const items = Array.isArray(summary?.suggestedActions?.items)
        ? summary.suggestedActions.items
        : [];
    return items.filter((item) => item && item.blocking);
}

function buildOpenAlertSummary(summary = {}) {
    const alerts = summary?.openProdAlerts || {};
    return {
        available: alerts.available === true,
        count: Number(alerts.count || 0),
        items: Array.isArray(alerts.items) ? alerts.items : [],
    };
}

function main() {
    const options = parseArgs();
    const reportPath = resolve(ROOT, options.reportPath);
    const summaryJsonOut = resolve(ROOT, options.summaryJsonOut);
    const summaryMdOut = resolve(ROOT, options.summaryMdOut);
    const authReportPath = resolve(ROOT, options.authReportPath);

    const summaryStdout = runNodeScript('bin/prod-readiness-summary.js', [
        `--json-out=${summaryJsonOut}`,
        `--md-out=${summaryMdOut}`,
        '--print-json',
    ]);
    const summary = parseJsonOutput(summaryStdout);

    const authStdout = runNodeScript(
        'bin/admin-openclaw-rollout-diagnostic.js',
        [
            `--domain=${options.domain}`,
            '--json',
            '--allow-not-ready',
            `--report-path=${authReportPath}`,
        ]
    );
    const auth = parseJsonOutput(authStdout);

    const blockingActions = buildBlockingActions(summary);
    const openAlerts = buildOpenAlertSummary(summary);
    const report = {
        ok:
            summary?.productionStability?.signal === 'GREEN' &&
            summary?.releaseReadiness?.signal === 'GREEN' &&
            auth?.ok === true,
        generatedAt: new Date().toISOString(),
        domain: options.domain,
        cycle: FLOW_OS_RECOVERY_CYCLE,
        productionStability: summary?.productionStability || null,
        releaseReadiness: summary?.releaseReadiness || null,
        operatorAuth: {
            ok: auth?.ok === true,
            diagnosis: auth?.diagnosis || '',
            nextAction: auth?.next_action || '',
            mode: auth?.resolved?.mode || '',
            transport: auth?.resolved?.transport || '',
            status: auth?.resolved?.status || '',
        },
        openProdAlerts: openAlerts,
        blockingActions,
        refs: {
            summaryJsonOut: relative(ROOT, summaryJsonOut).replace(/\\/g, '/'),
            summaryMdOut: relative(ROOT, summaryMdOut).replace(/\\/g, '/'),
            authReportPath: relative(ROOT, authReportPath).replace(/\\/g, '/'),
            reportPath: relative(ROOT, reportPath).replace(/\\/g, '/'),
            statusDoc: FLOW_OS_RECOVERY_CYCLE.statusDoc,
            planDoc: FLOW_OS_RECOVERY_CYCLE.planDoc,
        },
    };

    ensureDirForFile(reportPath);
    writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');

    process.stdout.write('== Flow OS Recovery Daily ==\n');
    process.stdout.write(
        `Ventana: ${FLOW_OS_RECOVERY_CYCLE.startsAt} -> ${FLOW_OS_RECOVERY_CYCLE.endsAt}\n`
    );
    process.stdout.write(`Scope: ${FLOW_OS_RECOVERY_CYCLE.allowedSlice}\n`);
    process.stdout.write(
        `Signals: production_stability=${summary?.productionStability?.signal || 'n/a'} release_readiness=${summary?.releaseReadiness?.signal || 'n/a'} operator_auth=${auth?.diagnosis || 'n/a'}\n`
    );
    process.stdout.write(`Open alerts: ${openAlerts.count}\n`);
    if (blockingActions.length > 0) {
        process.stdout.write(
            `Blocking actions: ${blockingActions
                .map((item) => item.id || item.title || 'action')
                .join(', ')}\n`
        );
    } else {
        process.stdout.write('Blocking actions: none\n');
    }
    process.stdout.write(`Status doc: ${FLOW_OS_RECOVERY_CYCLE.statusDoc}\n`);
    process.stdout.write(`Plan doc: ${FLOW_OS_RECOVERY_CYCLE.planDoc}\n`);
    process.stdout.write(
        `Report: ${relative(ROOT, reportPath).replace(/\\/g, '/')}\n`
    );
}

try {
    main();
} catch (error) {
    process.stderr.write(`${error.message}\n`);
    process.exitCode = 1;
}
