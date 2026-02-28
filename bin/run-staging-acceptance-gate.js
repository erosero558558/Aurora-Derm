#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

function parseArgs(argv) {
    const parsed = {
        baseUrl: '',
        label: 'staging-acceptance',
        outDir: path.join('verification', 'staging-acceptance'),
        skipVisual: false,
        skipFunctional: false,
        skipPerformance: false,
    };

    for (let index = 0; index < argv.length; index += 1) {
        const token = argv[index];
        if (token === '--base-url') {
            parsed.baseUrl = String(argv[index + 1] || '').trim();
            index += 1;
            continue;
        }
        if (token === '--label') {
            parsed.label = String(argv[index + 1] || '').trim() || parsed.label;
            index += 1;
            continue;
        }
        if (token === '--out-dir') {
            parsed.outDir = String(argv[index + 1] || '').trim() || parsed.outDir;
            index += 1;
            continue;
        }
        if (token === '--skip-visual') {
            parsed.skipVisual = true;
            continue;
        }
        if (token === '--skip-functional') {
            parsed.skipFunctional = true;
            continue;
        }
        if (token === '--skip-performance') {
            parsed.skipPerformance = true;
            continue;
        }
    }

    return parsed;
}

function safeUrl(input) {
    if (!input) {
        return null;
    }
    try {
        return new URL(input);
    } catch (_error) {
        return null;
    }
}

function nowStamp() {
    const date = new Date();
    return [
        String(date.getUTCFullYear()).padStart(4, '0'),
        String(date.getUTCMonth() + 1).padStart(2, '0'),
        String(date.getUTCDate()).padStart(2, '0'),
        '-',
        String(date.getUTCHours()).padStart(2, '0'),
        String(date.getUTCMinutes()).padStart(2, '0'),
        String(date.getUTCSeconds()).padStart(2, '0'),
    ].join('');
}

function slugify(value) {
    return String(value || '')
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9_-]+/g, '-')
        .replace(/^-+|-+$/g, '');
}

function runCommand(step, command, args, options = {}) {
    const startedAt = Date.now();
    const result = spawnSync(command, args, {
        encoding: 'utf8',
        shell: options.shell || false,
        env: options.env || process.env,
    });
    const durationSec = Number(((Date.now() - startedAt) / 1000).toFixed(2));
    return {
        id: step.id,
        name: step.name,
        command: [command, ...args].join(' '),
        durationSec,
        exitCode: typeof result.status === 'number' ? result.status : 1,
        stdout: result.stdout || '',
        stderr: result.stderr || '',
    };
}

function writeSummary(runDir, summary) {
    const jsonPath = path.join(runDir, 'staging-acceptance-summary.json');
    const mdPath = path.join(runDir, 'staging-acceptance-summary.md');
    fs.writeFileSync(jsonPath, `${JSON.stringify(summary, null, 2)}\n`, 'utf8');

    const lines = [
        '# Staging Acceptance Gate',
        '',
        `- Label: ${summary.label}`,
        `- Base URL: ${summary.baseUrl}`,
        `- Generated At: ${summary.generatedAt}`,
        `- Passed: ${summary.passed ? 'yes' : 'no'}`,
        '',
        '## Checklist',
        '',
    ];

    for (const check of summary.checks) {
        const marker = check.status === 'passed' ? '[x]' : '[ ]';
        lines.push(`${marker} ${check.name}`);
        lines.push(`- command: \`${check.command}\``);
        lines.push(`- status: ${check.status}`);
        lines.push(`- duration: ${check.durationSec}s`);
        lines.push(`- log: ${check.logFile}`);
        lines.push('');
    }

    fs.writeFileSync(mdPath, `${lines.join('\n')}\n`, 'utf8');
    return { jsonPath, mdPath };
}

function writeManualChecklist(runDir, context) {
    const mdPath = path.join(runDir, 'staging-manual-checklist.md');
    const jsonPath = path.join(runDir, 'staging-manual-checklist.json');
    const routes = [
        '/es/',
        '/en/',
        '/es/telemedicina/',
        '/en/telemedicine/',
        '/es/servicios/acne-rosacea/',
        '/en/services/acne-rosacea/',
        '/es/legal/privacidad/',
        '/en/legal/privacy/',
    ];
    const legacyRedirects = [
        '/',
        '/index.html',
        '/telemedicina.html',
        '/servicios/acne-rosacea.html',
        '/ninos/dermatologia-pediatrica.html',
        '/terminos.html',
    ];

    const checklist = {
        label: context.label,
        baseUrl: context.baseUrl,
        generatedAt: context.generatedAt,
        routes,
        legacyRedirects,
        sections: [
            {
                id: 'visual',
                title: 'Visual sign-off',
                items: [
                    'Home /es/ y /en/ revisadas en desktop y mobile.',
                    'Hero, editorial cards y footer sin overflow horizontal.',
                    'Telemedicina y legal mantienen layout consistente Sony-style.',
                ],
            },
            {
                id: 'functional',
                title: 'Functional sign-off',
                items: [
                    'Booking hooks criticos presentes: #citas, #appointmentForm, #serviceSelect.',
                    'Chat hooks visibles/inyectables: #chatbotWidget, #chatbotContainer.',
                    'Cambio de idioma conserva ruta equivalente ES/EN.',
                ],
            },
            {
                id: 'routing',
                title: 'Routing and redirect sign-off',
                items: [
                    'Rutas canonicas ES/EN cargan con 200.',
                    'Rutas legacy devuelven 301 unico en Apache/Nginx.',
                    'UTM y query params se preservan en redirects legacy.',
                ],
            },
            {
                id: 'release',
                title: 'Release readiness',
                items: [
                    'Evidencia automatica adjunta: smoke routing, smoke conversion, Playwright, visual baseline, performance gate.',
                    'Validacion manual final realizada sobre staging real, no php -S local.',
                ],
            },
        ],
    };

    const lines = [
        '# Staging Manual Checklist',
        '',
        `- Label: ${context.label}`,
        `- Base URL: ${context.baseUrl}`,
        `- Generated At: ${context.generatedAt}`,
        '',
        '## Canonical Routes',
        '',
        ...routes.map((route) => `- [ ] ${route}`),
        '',
        '## Legacy Redirects',
        '',
        ...legacyRedirects.map((route) => `- [ ] ${route}`),
        '',
    ];

    for (const section of checklist.sections) {
        lines.push(`## ${section.title}`);
        lines.push('');
        for (const item of section.items) {
            lines.push(`- [ ] ${item}`);
        }
        lines.push('');
    }

    fs.writeFileSync(mdPath, `${lines.join('\n')}\n`, 'utf8');
    fs.writeFileSync(jsonPath, `${JSON.stringify(checklist, null, 2)}\n`, 'utf8');
    return { mdPath, jsonPath };
}

function main() {
    const args = parseArgs(process.argv.slice(2));
    const baseUrl = safeUrl(args.baseUrl || process.env.TEST_BASE_URL || '');
    if (!baseUrl) {
        console.error(
            '[staging-acceptance] Missing or invalid --base-url (example: https://staging.pielarmonia.com)'
        );
        process.exitCode = 2;
        return;
    }

    const stamp = nowStamp();
    const labelSafe = slugify(args.label || 'staging-acceptance') || 'staging-acceptance';
    const runDir = path.resolve(args.outDir, `${stamp}-${labelSafe}`);
    fs.mkdirSync(runDir, { recursive: true });

    const steps = [
        {
            id: 'routing_smoke',
            name: 'Routing smoke ES/EN + redirects',
            command: process.execPath,
            args: [
                path.join('bin', 'check-public-routing-smoke.js'),
                '--base-url',
                baseUrl.toString(),
                '--label',
                `${args.label}-routing`,
                '--output',
                path.join(runDir, 'routing-smoke.json'),
            ],
        },
        {
            id: 'conversion_smoke',
            name: 'Conversion smoke ES/EN',
            command: process.execPath,
            args: [
                path.join('bin', 'check-public-conversion-smoke.js'),
                '--base-url',
                baseUrl.toString(),
                '--label',
                `${args.label}-conversion`,
                '--output',
                path.join(runDir, 'conversion-smoke.json'),
            ],
        },
    ];

    if (!args.skipFunctional) {
        steps.push({
            id: 'functional_playwright',
            name: 'Functional acceptance (Playwright)',
            command: 'npx',
            args: [
                'playwright',
                'test',
                'tests/staging-acceptance-gate.spec.js',
                '--project=chromium',
                '--reporter=line,json',
                '--output',
                path.join(runDir, 'playwright-output'),
            ],
            shell: process.platform === 'win32',
            env: {
                ...process.env,
                TEST_BASE_URL: baseUrl.toString(),
                PLAYWRIGHT_JSON_OUTPUT_NAME: path.join(
                    runDir,
                    'playwright-results.json'
                ),
            },
        });
    }

    if (!args.skipVisual) {
        steps.push({
            id: 'visual_baseline',
            name: 'Visual baseline capture (desktop + mobile)',
            command: process.execPath,
            args: [
                path.join('bin', 'capture-public-baseline.js'),
                '--base-url',
                baseUrl.toString(),
                '--out-dir',
                path.join(runDir, 'visual-baseline'),
                '--label',
                args.label,
            ],
        });
    }

    if (!args.skipPerformance) {
        steps.push({
            id: 'performance_gate',
            name: 'Performance gate (Lighthouse + CWV)',
            command: process.execPath,
            args: [
                path.join('bin', 'run-public-performance-gate.js'),
                '--base-url',
                baseUrl.toString(),
                '--out-dir',
                path.join(runDir, 'performance-gate'),
                '--label',
                args.label,
                '--routes',
                '/es/,/en/',
            ],
        });
    }

    const checks = [];
    let passed = true;
    for (const step of steps) {
        console.log(`[staging-acceptance] Running: ${step.name}`);
        const run = runCommand(step, step.command, step.args, {
            shell: step.shell,
            env: step.env,
        });

        const logFile = `${String(checks.length + 1).padStart(2, '0')}-${slugify(
            step.id
        )}.log`;
        const logPath = path.join(runDir, logFile);
        fs.writeFileSync(
            logPath,
            `${run.command}\n\n[stdout]\n${run.stdout}\n\n[stderr]\n${run.stderr}\n`,
            'utf8'
        );

        const status = run.exitCode === 0 ? 'passed' : 'failed';
        checks.push({
            id: run.id,
            name: run.name,
            command: run.command,
            status,
            durationSec: run.durationSec,
            exitCode: run.exitCode,
            logFile,
        });

        if (status === 'failed') {
            passed = false;
            console.error(
                `[staging-acceptance] Step failed: ${step.name} (exit ${run.exitCode})`
            );
            break;
        }
    }

    const summary = {
        label: args.label,
        baseUrl: baseUrl.toString(),
        generatedAt: new Date().toISOString(),
        passed,
        checks,
        artifactsDir: runDir,
    };
    const output = writeSummary(runDir, summary);
    const checklist = writeManualChecklist(runDir, summary);
    console.log(`[staging-acceptance] Summary JSON: ${output.jsonPath}`);
    console.log(`[staging-acceptance] Summary MD: ${output.mdPath}`);
    console.log(`[staging-acceptance] Manual checklist MD: ${checklist.mdPath}`);
    console.log(`[staging-acceptance] Manual checklist JSON: ${checklist.jsonPath}`);

    if (!passed) {
        process.exitCode = 1;
        return;
    }

    console.log('[staging-acceptance] All checks passed.');
}

main();
