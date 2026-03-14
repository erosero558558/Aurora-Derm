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

        const markdown = readFileSync(mdOut, 'utf8');
        assert.match(markdown, /## Production Monitor Evidence/);
        assert.match(markdown, /- status: ok/);
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
