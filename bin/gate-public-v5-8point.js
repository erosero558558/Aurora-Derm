#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const DEFAULT_OUT_DIR = path.join('verification', 'public-v5-8point');
const DEFAULT_LABEL = 'public-v5-8point';

function parseArgs(argv) {
    const parsed = {
        outDir: DEFAULT_OUT_DIR,
        label: DEFAULT_LABEL,
    };

    for (let index = 0; index < argv.length; index += 1) {
        const token = String(argv[index] || '').trim();
        if (token === '--out-dir') {
            parsed.outDir = String(argv[index + 1] || parsed.outDir).trim();
            index += 1;
            continue;
        }
        if (token === '--label') {
            parsed.label = String(argv[index + 1] || parsed.label).trim();
            index += 1;
        }
    }

    return parsed;
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

function tailLines(text, maxLines = 22) {
    const lines = String(text || '')
        .replace(/\r\n/g, '\n')
        .split('\n')
        .filter(Boolean);
    return lines.slice(-maxLines).join('\n');
}

function runCommand(command, cwd) {
    const startedAt = new Date();
    const result = spawnSync(command, {
        cwd,
        encoding: 'utf8',
        shell: true,
        maxBuffer: 1024 * 1024 * 40,
    });
    const endedAt = new Date();
    const exitCode =
        typeof result.status === 'number'
            ? result.status
            : result.error
              ? 1
              : 0;

    return {
        command,
        startedAt: startedAt.toISOString(),
        endedAt: endedAt.toISOString(),
        durationMs: endedAt.getTime() - startedAt.getTime(),
        exitCode,
        success: exitCode === 0,
        stdoutTail: tailLines(result.stdout),
        stderrTail: tailLines(result.stderr),
        error: result.error ? String(result.error.message || result.error) : '',
    };
}

function listRunDirs(rootDir) {
    if (!fs.existsSync(rootDir)) {
        return [];
    }
    return fs
        .readdirSync(rootDir, { withFileTypes: true })
        .filter((entry) => entry.isDirectory())
        .map((entry) => entry.name)
        .sort((left, right) => left.localeCompare(right));
}

function latestArtifactJson(repoRoot, artifactRoot, jsonFileName) {
    const rootAbs = path.resolve(repoRoot, artifactRoot);
    const runDirs = listRunDirs(rootAbs);
    if (!runDirs.length) {
        return { path: '', data: null };
    }
    const latestId = runDirs[runDirs.length - 1];
    const jsonPath = path.join(rootAbs, latestId, jsonFileName);
    if (!fs.existsSync(jsonPath)) {
        return { path: '', data: null };
    }
    return {
        path: jsonPath,
        data: JSON.parse(fs.readFileSync(jsonPath, 'utf8')),
    };
}

function hasFailureReason(surfaceAudit, reason) {
    const failures = Array.isArray(surfaceAudit?.failures)
        ? surfaceAudit.failures
        : [];
    return failures.some((item) => String(item?.reason || '') === reason);
}

function collectRoleRoutes(surfaceAudit, role) {
    const routes = Array.isArray(surfaceAudit?.routes)
        ? surfaceAudit.routes
        : [];
    return routes.filter((route) => String(route?.role || '') === role);
}

function formatPointStatus(pass) {
    return pass ? 'PASS' : 'FAIL';
}

function toMarkdown(report) {
    const lines = [
        '# Public V5 - Gate de 8 Puntos',
        '',
        `- Generated At: ${report.generatedAt}`,
        `- Result: ${report.passed ? 'PASS' : 'FAIL'}`,
        `- Passed Points: ${report.summary.passed}/${report.summary.total}`,
        '',
        '## Scorecard',
        '',
        '| Punto | Estado | Detalle |',
        '| --- | --- | --- |',
    ];

    report.points.forEach((point) => {
        lines.push(
            `| ${point.id}. ${point.label} | ${formatPointStatus(point.pass)} | ${point.evidence} |`
        );
    });

    lines.push('');
    lines.push('## Commands');
    lines.push('');
    report.commands.forEach((entry) => {
        lines.push(
            `- \`${entry.command}\` => ${entry.success ? 'PASS' : 'FAIL'} (exit=${entry.exitCode}, duration_ms=${entry.durationMs})`
        );
    });

    lines.push('');
    lines.push('## Artifacts');
    lines.push('');
    lines.push(
        `- surface_audit: ${report.artifacts.surfaceAuditPath || 'missing'}`
    );
    lines.push(
        `- performance_gate: ${report.artifacts.performancePath || 'missing'}`
    );
    lines.push(`- sony_score: ${report.artifacts.sonyScorePath || 'missing'}`);
    lines.push('');

    return `${lines.join('\n')}\n`;
}

function main() {
    const args = parseArgs(process.argv.slice(2));
    const repoRoot = process.cwd();

    const runLabel = String(args.label || DEFAULT_LABEL).replace(
        /[^a-zA-Z0-9_-]+/g,
        '-'
    );
    const runDir = path.resolve(args.outDir, `${nowStamp()}-${runLabel}`);
    fs.mkdirSync(runDir, { recursive: true });

    const commands = [];

    commands.push(runCommand('npm run content:public-v5:validate', repoRoot));
    commands.push(runCommand('npm run audit:public:v5:surface', repoRoot));
    commands.push(
        runCommand(
            'npx playwright test tests/public-v5-pricing-localization.spec.js tests/public-v5-booking-payment-flow.spec.js tests/public-v5-service-matrix.spec.js',
            repoRoot
        )
    );
    commands.push(
        runCommand(
            'node --test tests-node/public-v5-gateway-flags.test.js',
            repoRoot
        )
    );
    commands.push(
        runCommand('npm run test:frontend:performance:gate', repoRoot)
    );
    commands.push(runCommand('npm run score:public:v5:sony', repoRoot));

    const surfaceAuditArtifact = latestArtifactJson(
        repoRoot,
        path.join('verification', 'public-v5-audit'),
        'surface-audit.json'
    );
    const performanceArtifact = latestArtifactJson(
        repoRoot,
        path.join('verification', 'performance-gate'),
        'performance-gate.json'
    );
    const sonyScoreArtifact = latestArtifactJson(
        repoRoot,
        path.join('verification', 'sony-score'),
        'sony-score.json'
    );

    const surfaceAudit = surfaceAuditArtifact.data;
    const performanceGate = performanceArtifact.data;
    const sonyScore = sonyScoreArtifact.data;

    const pricingSuiteCommand = commands[2];
    const gatewayCommand = commands[3];
    const performanceCommand = commands[4];
    const sonyScoreCommand = commands[5];

    const homeRoutes = collectRoleRoutes(surfaceAudit, 'home');
    const hubRoutes = collectRoleRoutes(surfaceAudit, 'hub');
    const serviceRoutes = collectRoleRoutes(surfaceAudit, 'service');

    const homeHierarchyPass =
        homeRoutes.length > 0 &&
        homeRoutes.every(
            (route) =>
                Number(route?.sections || 0) <=
                    Number(surfaceAudit?.limits?.homeMaxBlocks || 6) &&
                Number(route?.links || 0) <=
                    Number(surfaceAudit?.limits?.homeMaxLinks || 30)
        ) &&
        !hasFailureReason(surfaceAudit, 'home_sections_exceed_limit') &&
        !hasFailureReason(surfaceAudit, 'home_links_exceed_limit');

    const hubHierarchyPass =
        hubRoutes.length > 0 &&
        hubRoutes.every(
            (route) =>
                Number(route?.sections || 0) <=
                    Number(surfaceAudit?.limits?.hubMaxBlocks || 7) &&
                Number(route?.links || 0) <=
                    Number(surfaceAudit?.limits?.hubMaxLinks || 30)
        ) &&
        !hasFailureReason(surfaceAudit, 'hub_sections_exceed_limit') &&
        !hasFailureReason(surfaceAudit, 'hub_links_exceed_limit');

    const serviceBookingParity =
        serviceRoutes.length > 0 &&
        serviceRoutes.every(
            (route) =>
                Boolean(route?.hasBookingMount) &&
                Boolean(route?.hasPaymentModal) &&
                Boolean(route?.hasServiceSelect)
        );

    const gatewaySpecPath = path.join(
        repoRoot,
        'tests-node',
        'public-v5-gateway-flags.test.js'
    );
    const gatewaySpec = fs.existsSync(gatewaySpecPath)
        ? fs.readFileSync(gatewaySpecPath, 'utf8')
        : '';
    const killSwitchCoveragePatterns = [
        'kill-switch sends traffic to legacy immediately',
        'force locale takes precedence',
        'surface=v5 override',
    ];
    const hasKillSwitchCoverage = killSwitchCoveragePatterns.every((pattern) =>
        gatewaySpec.includes(pattern)
    );

    const sonyThreshold = Number(sonyScore?.threshold || 82);
    const sonyTotal = Number(sonyScore?.score?.total || 0);

    const points = [
        {
            id: '1',
            label: 'No texto tecnico interno visible',
            pass:
                Boolean(surfaceAudit) &&
                Number(surfaceAudit?.summary?.technicalTextMatches || 0) ===
                    0 &&
                !hasFailureReason(surfaceAudit, 'technical_text_visible'),
            evidence: `technical_text_matches=${surfaceAudit?.summary?.technicalTextMatches ?? 'n/a'}`,
        },
        {
            id: '2',
            label: 'Home/hub canonicos con jerarquia limpia',
            pass:
                Boolean(surfaceAudit) && homeHierarchyPass && hubHierarchyPass,
            evidence: `home=${
                homeRoutes
                    .map(
                        (route) =>
                            `${route.route}:${route.sections}/${route.links}`
                    )
                    .join(', ') || 'n/a'
            } | hub=${
                hubRoutes
                    .map(
                        (route) =>
                            `${route.route}:${route.sections}/${route.links}`
                    )
                    .join(', ') || 'n/a'
            }`,
        },
        {
            id: '3',
            label: 'Pricing consistente en servicio, booking y pago',
            pass: pricingSuiteCommand.success,
            evidence: `command_exit=${pricingSuiteCommand.exitCode}`,
        },
        {
            id: '4',
            label: 'ES/EN sin mezcla linguistica ni labels crudos',
            pass:
                Boolean(surfaceAudit) &&
                Number(surfaceAudit?.summary?.mixedLocaleMatches || 0) === 0 &&
                !hasFailureReason(
                    surfaceAudit,
                    'mixed_locale_tokens_visible'
                ) &&
                !hasFailureReason(
                    surfaceAudit,
                    'missing_localized_price_token'
                ),
            evidence: `mixed_locale_matches=${surfaceAudit?.summary?.mixedLocaleMatches ?? 'n/a'}`,
        },
        {
            id: '5',
            label: 'Booking/pago integrado y estable en V5',
            pass:
                pricingSuiteCommand.success &&
                gatewayCommand.success &&
                serviceBookingParity,
            evidence: `gateway_exit=${gatewayCommand.exitCode}, service_shell_parity=${serviceBookingParity ? 'ok' : 'fail'}`,
        },
        {
            id: '6',
            label: 'Score Sony >= 82 y checkpoint gate estricto',
            pass:
                sonyScoreCommand.success &&
                sonyTotal >= sonyThreshold &&
                Boolean(sonyScore?.checkpoints?.passesThreshold),
            evidence: `score=${sonyTotal}/${sonyThreshold}, checkpoints=${sonyScore?.checkpoints?.passed ?? 'n/a'}/${sonyScore?.checkpoints?.total ?? 'n/a'}`,
        },
        {
            id: '7',
            label: 'Performance/accesibilidad en threshold',
            pass:
                performanceCommand.success &&
                Boolean(performanceGate?.passed) &&
                Array.isArray(performanceGate?.routes) &&
                performanceGate.routes.every(
                    (route) =>
                        String(route?.status || '') === 'passed' &&
                        Number(route?.scores?.accessibility || 0) >=
                            Number(
                                performanceGate?.thresholds?.accessibility ||
                                    0.95
                            )
                ),
            evidence: `performance_passed=${performanceGate?.passed ?? 'n/a'}`,
        },
        {
            id: '8',
            label: 'Rollback operativo por flags/kill-switch validado',
            pass: gatewayCommand.success && hasKillSwitchCoverage,
            evidence: `gateway_exit=${gatewayCommand.exitCode}, kill_switch_coverage=${hasKillSwitchCoverage ? 'ok' : 'missing'}`,
        },
    ];

    const passedPoints = points.filter((point) => point.pass).length;
    const passed = passedPoints === points.length;

    const report = {
        generatedAt: new Date().toISOString(),
        passed,
        summary: {
            total: points.length,
            passed: passedPoints,
            failed: points.length - passedPoints,
        },
        points,
        commands,
        artifacts: {
            surfaceAuditPath: surfaceAuditArtifact.path,
            performancePath: performanceArtifact.path,
            sonyScorePath: sonyScoreArtifact.path,
        },
    };

    const jsonPath = path.join(runDir, 'public-v5-8point-gate.json');
    const mdPath = path.join(runDir, 'public-v5-8point-gate.md');
    fs.writeFileSync(jsonPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
    fs.writeFileSync(mdPath, toMarkdown(report), 'utf8');

    process.stdout.write(
        [
            `Public V5 8-point gate: ${passed ? 'PASS' : 'FAIL'}`,
            `Scorecard: ${passedPoints}/${points.length}`,
            `Artifacts:`,
            `- ${path.relative(repoRoot, jsonPath).replace(/\\/g, '/')}`,
            `- ${path.relative(repoRoot, mdPath).replace(/\\/g, '/')}`,
            '',
        ].join('\n')
    );

    if (!passed) {
        process.exitCode = 1;
    }
}

main();
