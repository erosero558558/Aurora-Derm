#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const path = require('node:path');

function parseArgs(argv) {
    const args = {
        baseUrl: '',
        label: 'public-cutover',
        outDir: path.join('verification', 'public-cutover'),
        windowHours: 72,
        startedAt: '',
        routingReport: '',
        conversionReport: '',
    };

    for (let index = 0; index < argv.length; index += 1) {
        const token = argv[index];
        if (token === '--base-url') {
            args.baseUrl = String(argv[index + 1] || '').trim();
            index += 1;
            continue;
        }
        if (token === '--label') {
            args.label = String(argv[index + 1] || '').trim() || args.label;
            index += 1;
            continue;
        }
        if (token === '--out-dir') {
            args.outDir = String(argv[index + 1] || '').trim() || args.outDir;
            index += 1;
            continue;
        }
        if (token === '--window-hours') {
            const parsed = Number(argv[index + 1]);
            if (Number.isFinite(parsed) && parsed > 0) {
                args.windowHours = parsed;
            }
            index += 1;
            continue;
        }
        if (token === '--started-at') {
            args.startedAt = String(argv[index + 1] || '').trim();
            index += 1;
            continue;
        }
        if (token === '--routing-report') {
            args.routingReport = String(argv[index + 1] || '').trim();
            index += 1;
            continue;
        }
        if (token === '--conversion-report') {
            args.conversionReport = String(argv[index + 1] || '').trim();
            index += 1;
            continue;
        }
    }

    return args;
}

function ensureUrl(value) {
    if (!value) {
        return null;
    }
    try {
        return new URL(value);
    } catch (_error) {
        return null;
    }
}

function readJson(filePath) {
    if (!filePath || !fs.existsSync(filePath)) {
        return null;
    }
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function reportPassed(report) {
    if (!report || typeof report !== 'object') {
        return false;
    }
    if (report.skipped === true) {
        return true;
    }
    return Boolean(report.passed);
}

function reportFailures(report) {
    return Array.isArray(report?.failures) ? report.failures : [];
}

function toIso(value) {
    if (!value) {
        return null;
    }
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
        return null;
    }
    return date.toISOString();
}

function addHours(isoString, hours) {
    const date = new Date(isoString);
    if (Number.isNaN(date.getTime())) {
        return null;
    }
    return new Date(date.getTime() + hours * 60 * 60 * 1000).toISOString();
}

function main() {
    const args = parseArgs(process.argv.slice(2));
    const baseUrl = ensureUrl(args.baseUrl || process.env.PROD_URL || '');
    if (!baseUrl) {
        console.error(
            '[public-cutover] Missing or invalid --base-url (example: https://pielarmonia.com)'
        );
        process.exitCode = 2;
        return;
    }

    const startedAt = toIso(args.startedAt) || new Date().toISOString();
    const monitorUntil = addHours(startedAt, args.windowHours);
    const routingReport = readJson(args.routingReport);
    const conversionReport = readJson(args.conversionReport);
    const routingPassed = reportPassed(routingReport);
    const conversionPassed = reportPassed(conversionReport);
    const passed = routingPassed && conversionPassed;

    fs.mkdirSync(args.outDir, { recursive: true });
    const manifest = {
        label: args.label,
        baseUrl: baseUrl.toString(),
        startedAt,
        monitorWindowHours: args.windowHours,
        monitorUntil,
        passed,
        rolloutPhase: 'post-deploy-monitoring',
        reports: {
            routing: args.routingReport || '',
            conversion: args.conversionReport || '',
        },
        summary: {
            routingPassed,
            conversionPassed,
            conversionSkipped: Boolean(conversionReport?.skipped),
            routingFailures: reportFailures(routingReport),
            conversionFailures: reportFailures(conversionReport),
        },
        monitorBootstrap: {
            workflow: 'prod-monitor.yml',
            inputs: {
                domain: baseUrl.toString(),
                enable_public_cutover_monitor: 'true',
                public_cutover_started_at: startedAt,
                public_cutover_window_hours: String(args.windowHours),
            },
        },
    };

    const jsonPath = path.join(args.outDir, 'public-cutover-manifest.json');
    const mdPath = path.join(args.outDir, 'public-cutover-manifest.md');
    fs.writeFileSync(
        jsonPath,
        `${JSON.stringify(manifest, null, 2)}\n`,
        'utf8'
    );

    const lines = [
        '# Public Cutover Manifest',
        '',
        `- Label: ${manifest.label}`,
        `- Base URL: ${manifest.baseUrl}`,
        `- Started At: ${manifest.startedAt}`,
        `- Monitor Window Hours: ${manifest.monitorWindowHours}`,
        `- Monitor Until: ${manifest.monitorUntil}`,
        `- Passed: ${manifest.passed ? 'yes' : 'no'}`,
        '',
        '## Automated Evidence',
        '',
        `- Routing report: \`${manifest.reports.routing || 'n/a'}\``,
        `- Conversion report: \`${manifest.reports.conversion || 'n/a'}\``,
        `- Conversion skipped: \`${manifest.summary.conversionSkipped ? 'true' : 'false'}\``,
        '',
        '## Production Monitor Bootstrap',
        '',
        `- workflow: \`${manifest.monitorBootstrap.workflow}\``,
        `- enable_public_cutover_monitor: \`${manifest.monitorBootstrap.inputs.enable_public_cutover_monitor}\``,
        `- public_cutover_started_at: \`${manifest.monitorBootstrap.inputs.public_cutover_started_at}\``,
        `- public_cutover_window_hours: \`${manifest.monitorBootstrap.inputs.public_cutover_window_hours}\``,
    ];

    if (manifest.summary.routingFailures.length > 0) {
        lines.push('');
        lines.push('## Routing Failures');
        lines.push('');
        for (const failure of manifest.summary.routingFailures) {
            lines.push(`- ${failure}`);
        }
    }

    if (manifest.summary.conversionFailures.length > 0) {
        lines.push('');
        lines.push('## Conversion Failures');
        lines.push('');
        for (const failure of manifest.summary.conversionFailures) {
            lines.push(`- ${failure}`);
        }
    }

    fs.writeFileSync(mdPath, `${lines.join('\n')}\n`, 'utf8');

    console.log(`[public-cutover] Manifest JSON: ${jsonPath}`);
    console.log(`[public-cutover] Manifest MD: ${mdPath}`);
    if (!manifest.passed) {
        process.exitCode = 1;
        return;
    }
    console.log('[public-cutover] Cutover manifest generated successfully.');
}

main();
