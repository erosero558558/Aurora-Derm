#!/usr/bin/env node
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const {
    chmodSync,
    copyFileSync,
    mkdirSync,
    mkdtempSync,
    readFileSync,
    rmSync,
    writeFileSync,
} = require('fs');
const { tmpdir } = require('os');
const { join, resolve } = require('path');
const { spawnSync } = require('child_process');

const REPO_ROOT = resolve(__dirname, '..');
const SUMMARY_SOURCE = resolve(REPO_ROOT, 'bin', 'prod-readiness-summary.js');

function createFixtureDir() {
    const dir = mkdtempSync(join(tmpdir(), 'prod-readiness-prod-monitor-'));
    mkdirSync(join(dir, 'bin'), { recursive: true });
    mkdirSync(join(dir, 'verification', 'runtime'), { recursive: true });
    copyFileSync(SUMMARY_SOURCE, join(dir, 'bin', 'prod-readiness-summary.js'));
    return dir;
}

function writeProdMonitorReport(targetPath, overrides = {}) {
    const payload = {
        version: 1,
        generatedAt: '2026-03-14T00:00:00.000Z',
        domain: 'https://pielarmonia.com',
        ok: true,
        status: 'ok',
        failureCount: 0,
        warningCount: 0,
        failures: [],
        warnings: [],
        checks: {
            health: { status: 'ok' },
            publicSync: { status: 'ok' },
            telemedicine: { status: 'ok' },
            turneroPilot: { status: 'ok' },
            githubDeployAlerts: { status: 'ok' },
        },
        workflow: {
            publicSyncRecovery: { status: 'healthy' },
            publicCutover: { stepOutcome: 'success' },
            publicV4Rollout: { stepOutcome: 'success' },
        },
        summary: {
            headline: 'Sin accion inmediata; mantener corrida programada.',
        },
        ...overrides,
    };
    writeFileSync(targetPath, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
}

function installFakeGh(dir, remoteReport) {
    const ghJsPath = join(dir, 'gh.js');
    const ghCmdPath = join(dir, 'gh.cmd');
    const ghBatPath = join(dir, 'gh.bat');
    const ghShPath = join(dir, 'gh');
    const ghScript = `#!/usr/bin/env node
'use strict';
const fs = require('fs');
const path = require('path');

const args = process.argv.slice(2);
if (args[0] === 'run' && args[1] === 'list') {
  const workflowIndex = args.indexOf('--workflow');
  if (workflowIndex !== -1 && String(args[workflowIndex + 1] || '').includes('prod-monitor.yml')) {
    process.stdout.write(JSON.stringify([{
      databaseId: 987654321,
      workflowName: 'Production Monitor',
      displayTitle: 'Production Monitor',
      status: 'completed',
      conclusion: 'success',
      url: 'https://github.com/example/repo/actions/runs/987654321',
      createdAt: '2026-03-14T00:00:00.000Z',
      updatedAt: '2026-03-14T00:05:00.000Z',
      headBranch: 'main',
      headSha: 'abc123',
      event: 'schedule'
    }]));
  } else {
    process.stdout.write('[]');
  }
  process.exit(0);
}
if (args[0] === 'run' && args[1] === 'download') {
  const dirIndex = args.indexOf('-D');
  const outDir = dirIndex === -1 ? process.cwd() : args[dirIndex + 1];
  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(path.join(outDir, 'prod-monitor-last.json'), ${JSON.stringify(
      JSON.stringify(remoteReport, null, 2)
  )});
  process.exit(0);
}
if (args[0] === 'issue' && args[1] === 'list') {
  process.stdout.write('[]');
  process.exit(0);
}
if (args[0] === 'pr' && args[1] === 'list') {
  process.stdout.write('[]');
  process.exit(0);
}
process.stdout.write('[]');
`;
    writeFileSync(ghJsPath, ghScript, 'utf8');
    writeFileSync(ghCmdPath, `@echo off\r\nnode "%~dp0\\gh.js" %*\r\n`, 'utf8');
    writeFileSync(ghBatPath, `@echo off\r\nnode "%~dp0\\gh.js" %*\r\n`, 'utf8');
    writeFileSync(ghShPath, ghScript, 'utf8');
    chmodSync(ghShPath, 0o755);
}

function installFakeOrchestrator(dir, payload) {
    const scriptPath = join(dir, 'agent-orchestrator.js');
    const script = `#!/usr/bin/env node
'use strict';

const args = process.argv.slice(2);
if (
  args[0] === 'jobs' &&
  args[1] === 'verify' &&
  args[2] === 'public_main_sync' &&
  args.includes('--json')
) {
  process.stdout.write(${JSON.stringify(JSON.stringify(payload, null, 2))});
  process.exit(0);
}

process.stderr.write('Unsupported command');
process.exit(1);
`;
    writeFileSync(scriptPath, script, 'utf8');
    chmodSync(scriptPath, 0o755);
}

function installFakeOperatorAuthDiagnostic(dir, payload) {
    const scriptPath = join(dir, 'bin', 'admin-openclaw-rollout-diagnostic.js');
    const script = `#!/usr/bin/env node
'use strict';

process.stdout.write('== Diagnostico OpenClaw Auth Rollout ==\\n');
process.stdout.write('Dominio: https://pielarmonia.com\\n');
process.stdout.write(${JSON.stringify(JSON.stringify(payload, null, 2))});
process.exit(0);
`;
    writeFileSync(scriptPath, script, 'utf8');
    chmodSync(scriptPath, 0o755);
}

test('prod-readiness-summary consume evidencia local de prod-monitor', () => {
    const dir = createFixtureDir();
    const prodMonitorPath = join(
        dir,
        'verification',
        'runtime',
        'prod-monitor-last.json'
    );
    const jsonOut = join(dir, 'verification', 'runtime', 'prod-readiness.json');
    const mdOut = join(dir, 'verification', 'runtime', 'prod-readiness.md');

    try {
        writeProdMonitorReport(prodMonitorPath);

        const result = spawnSync(
            process.execPath,
            [
                join(dir, 'bin', 'prod-readiness-summary.js'),
                `--json-out=${jsonOut}`,
                `--md-out=${mdOut}`,
            ],
            {
                cwd: dir,
                encoding: 'utf8',
            }
        );

        assert.equal(result.status, 0, result.stderr || result.stdout);

        const summary = JSON.parse(readFileSync(jsonOut, 'utf8'));
        assert.equal(summary.prodMonitorEvidence.ok, true);
        assert.equal(summary.prodMonitorEvidence.status, 'ok');
        assert.equal(summary.prodMonitorEvidence.source, 'local');
        assert.equal(summary.recoveryCycle.status, 'active');
        assert.equal(
            summary.recoveryCycle.scopeFreeze.allowedSlice,
            'admin v3 + queue/turnero + auth Google + readiness + deploy'
        );

        const markdown = readFileSync(mdOut, 'utf8');
        assert.match(markdown, /## Recovery Cycle/);
        assert.match(
            markdown,
            /admin v3 \+ queue\/turnero \+ auth Google \+ readiness \+ deploy/
        );
        assert.match(markdown, /## Production Monitor Evidence/);
        assert.match(markdown, /- status: ok/);
    } finally {
        rmSync(dir, { recursive: true, force: true });
    }
});

test('prod-readiness-summary eleva public_main_sync health_http_502 como accion bloqueante', () => {
    const dir = createFixtureDir();
    const prodMonitorPath = join(
        dir,
        'verification',
        'runtime',
        'prod-monitor-last.json'
    );
    const jsonOut = join(dir, 'verification', 'runtime', 'prod-readiness.json');
    const mdOut = join(dir, 'verification', 'runtime', 'prod-readiness.md');

    try {
        writeProdMonitorReport(prodMonitorPath);
        installFakeOrchestrator(dir, {
            ok: false,
            job: {
                key: 'public_main_sync',
                configured: true,
                verified: false,
                healthy: false,
                state: 'failed',
                verification_source: 'health_url',
                failure_reason: 'health_http_502',
                last_error_message: 'health_http_502',
                details: {
                    http_status: 502,
                    response_detail: 'Bad Gateway',
                },
            },
        });

        const result = spawnSync(
            process.execPath,
            [
                join(dir, 'bin', 'prod-readiness-summary.js'),
                `--json-out=${jsonOut}`,
                `--md-out=${mdOut}`,
            ],
            {
                cwd: dir,
                encoding: 'utf8',
            }
        );

        assert.equal(result.status, 0, result.stderr || result.stdout);

        const summary = JSON.parse(readFileSync(jsonOut, 'utf8'));
        assert.equal(summary.publicMainSyncEvidence.ok, false);
        assert.equal(
            summary.publicMainSyncEvidence.failureReason,
            'health_http_502'
        );
        assert.equal(summary.publicMainSyncEvidence.httpStatus, 502);
        assert.equal(
            summary.productionStability.reasons.includes(
                'public_main_sync:health_http_502'
            ),
            true
        );
        const action = summary.suggestedActions.items.find(
            (item) => item.id === 'ACT-P0-PUBLIC-MAIN-SYNC'
        );
        assert.ok(action);
        assert.equal(action.blocking, true);
        assert.match(action.reason, /HTTP 502/);

        const markdown = readFileSync(mdOut, 'utf8');
        assert.match(markdown, /## Public Main Sync Evidence/);
        assert.match(markdown, /- failure_reason: health_http_502/);
        assert.match(markdown, /- http_status: 502/);
    } finally {
        rmSync(dir, { recursive: true, force: true });
    }
});

test('prod-readiness-summary eleva operator_auth legacy facade como accion bloqueante', () => {
    const dir = createFixtureDir();
    const prodMonitorPath = join(
        dir,
        'verification',
        'runtime',
        'prod-monitor-last.json'
    );
    const jsonOut = join(dir, 'verification', 'runtime', 'prod-readiness.json');
    const mdOut = join(dir, 'verification', 'runtime', 'prod-readiness.md');

    try {
        writeProdMonitorReport(prodMonitorPath);
        installFakeOrchestrator(dir, {
            ok: true,
            job: {
                key: 'public_main_sync',
                configured: true,
                verified: true,
                healthy: true,
                state: 'workspace_direct',
                verification_source: 'health_url',
                failure_reason: '',
                last_error_message: '',
                details: {},
            },
        });
        installFakeOperatorAuthDiagnostic(dir, {
            ok: false,
            domain: 'https://pielarmonia.com',
            diagnosis: 'admin_auth_legacy_facade',
            next_action:
                'Desplegar la fachada admin-auth.php con contrato OpenClaw (mode/status/configured) y alinear operator-auth-status.',
            operator_auth_status: {
                url: 'https://pielarmonia.com/api.php?resource=operator-auth-status',
                http_status: 200,
                contract_valid: false,
                mode: 'google_oauth',
                transport: '',
                status: 'anonymous',
                configured: true,
                recommended_mode: 'google_oauth',
            },
            admin_auth_facade: {
                url: 'https://pielarmonia.com/admin-auth.php?action=status',
                http_status: 200,
                contract_valid: false,
                mode: 'google_oauth',
                transport: '',
                status: 'anonymous',
                configured: true,
                recommended_mode: 'google_oauth',
            },
            resolved: {
                contract_valid: false,
                mode: '',
                transport: '',
                status: '',
                configured: false,
                recommended_mode: '',
            },
        });

        const result = spawnSync(
            process.execPath,
            [
                join(dir, 'bin', 'prod-readiness-summary.js'),
                `--json-out=${jsonOut}`,
                `--md-out=${mdOut}`,
            ],
            {
                cwd: dir,
                encoding: 'utf8',
            }
        );

        assert.equal(result.status, 0, result.stderr || result.stdout);

        const summary = JSON.parse(readFileSync(jsonOut, 'utf8'));
        assert.equal(summary.operatorAuthEvidence.ok, false);
        assert.equal(
            summary.operatorAuthEvidence.diagnosis,
            'admin_auth_legacy_facade'
        );
        assert.equal(summary.operatorAuthEvidence.mode, 'google_oauth');
        assert.equal(
            summary.productionStability.reasons.includes(
                'operator_auth:admin_auth_legacy_facade'
            ),
            true
        );
        const action = summary.suggestedActions.items.find(
            (item) => item.id === 'ACT-P0-OPERATOR-AUTH'
        );
        assert.ok(action);
        assert.equal(action.blocking, true);
        assert.match(action.reason, /google_oauth/);

        const markdown = readFileSync(mdOut, 'utf8');
        assert.match(markdown, /## Operator Auth Evidence/);
        assert.match(markdown, /- diagnosis: admin_auth_legacy_facade/);
        assert.match(markdown, /- mode: google_oauth/);
    } finally {
        rmSync(dir, { recursive: true, force: true });
    }
});

test('prod-readiness-summary tolera BOM en prod-monitor-last.json local', () => {
    const dir = createFixtureDir();
    const prodMonitorPath = join(
        dir,
        'verification',
        'runtime',
        'prod-monitor-last.json'
    );
    const jsonOut = join(dir, 'verification', 'runtime', 'prod-readiness.json');
    const mdOut = join(dir, 'verification', 'runtime', 'prod-readiness.md');

    try {
        const payload = {
            version: 1,
            generatedAt: '2026-03-14T00:00:00.000Z',
            domain: 'https://pielarmonia.com',
            ok: false,
            status: 'failed',
            failureCount: 1,
            warningCount: 0,
            failures: ['health-diagnostics unavailable'],
            warnings: [],
            checks: {
                health: { status: 'failed' },
                publicSync: { status: 'failed' },
            },
            workflow: {
                publicSyncRecovery: { status: 'failed' },
            },
            summary: {
                headline: 'Backend still red.',
            },
        };
        writeFileSync(
            prodMonitorPath,
            `\uFEFF${JSON.stringify(payload, null, 2)}\n`,
            'utf8'
        );

        const result = spawnSync(
            process.execPath,
            [
                join(dir, 'bin', 'prod-readiness-summary.js'),
                `--json-out=${jsonOut}`,
                `--md-out=${mdOut}`,
            ],
            {
                cwd: dir,
                encoding: 'utf8',
            }
        );

        assert.equal(result.status, 0, result.stderr || result.stdout);

        const summary = JSON.parse(readFileSync(jsonOut, 'utf8'));
        assert.equal(summary.prodMonitorEvidence.source, 'local');
        assert.equal(summary.prodMonitorEvidence.ok, false);
        assert.equal(summary.prodMonitorEvidence.status, 'failed');
        assert.equal(summary.prodMonitorEvidence.error, null);

        const markdown = readFileSync(mdOut, 'utf8');
        assert.match(markdown, /## Production Monitor Evidence/);
        assert.match(markdown, /- status: failed/);
    } finally {
        rmSync(dir, { recursive: true, force: true });
    }
});

test('prod-readiness-summary prefiere artefacto remoto de prod-monitor antes que fallback local', () => {
    const dir = createFixtureDir();
    const prodMonitorPath = join(
        dir,
        'verification',
        'runtime',
        'prod-monitor-last.json'
    );
    const jsonOut = join(dir, 'verification', 'runtime', 'prod-readiness.json');
    const mdOut = join(dir, 'verification', 'runtime', 'prod-readiness.md');

    try {
        writeProdMonitorReport(prodMonitorPath, {
            ok: false,
            status: 'failed',
            failureCount: 1,
            failures: ['local-failure'],
            summary: {
                headline:
                    'Local fallback should be ignored when remote exists.',
            },
        });
        installFakeGh(dir, {
            version: 1,
            generatedAt: '2026-03-14T01:00:00.000Z',
            domain: 'https://pielarmonia.com',
            ok: true,
            status: 'ok',
            failureCount: 0,
            warningCount: 0,
            failures: [],
            warnings: [],
            checks: {
                health: { status: 'ok' },
                publicSync: { status: 'ok' },
                telemedicine: { status: 'ok' },
                turneroPilot: { status: 'ok' },
                githubDeployAlerts: { status: 'ok' },
            },
            workflow: {
                publicSyncRecovery: { status: 'healthy' },
                publicCutover: { stepOutcome: 'success' },
                publicV4Rollout: { stepOutcome: 'success' },
            },
            artifact: { name: 'prod-monitor-report' },
            summary: { headline: 'Remote artifact preferred.' },
        });

        const result = spawnSync(
            process.execPath,
            [
                join(dir, 'bin', 'prod-readiness-summary.js'),
                `--json-out=${jsonOut}`,
                `--md-out=${mdOut}`,
            ],
            {
                cwd: dir,
                encoding: 'utf8',
                env: {
                    ...process.env,
                    GH_CLI_PATH: join(dir, 'gh.js'),
                    PATH: `${dir}${process.platform === 'win32' ? ';' : ':'}${
                        process.env.PATH || ''
                    }`,
                },
            }
        );

        assert.equal(result.status, 0, result.stderr || result.stdout);

        const summary = JSON.parse(readFileSync(jsonOut, 'utf8'));
        assert.equal(summary.prodMonitorEvidence.source, 'remote_artifact');
        assert.equal(summary.prodMonitorEvidence.status, 'ok');
        assert.equal(summary.prodMonitorEvidence.reportRun.id, 987654321);

        const markdown = readFileSync(mdOut, 'utf8');
        assert.match(markdown, /## Production Monitor Evidence/);
        assert.match(markdown, /- source: remote_artifact/);
    } finally {
        rmSync(dir, { recursive: true, force: true });
    }
});
