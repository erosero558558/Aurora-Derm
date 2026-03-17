#!/usr/bin/env node
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { resolve } = require('node:path');
const { spawnSync } = require('node:child_process');

const REPO_ROOT = resolve(__dirname, '..');
const COMMON_HTTP_PATH = resolve(
    REPO_ROOT,
    'bin',
    'powershell',
    'Common.Http.ps1'
);

function load(filePath) {
    return readFileSync(filePath, 'utf8');
}

const POWERSHELL_CANDIDATES =
    process.platform === 'win32'
        ? ['powershell', 'powershell.exe', 'pwsh']
        : ['pwsh', 'powershell'];

function resolvePowerShellBinary() {
    for (const candidate of POWERSHELL_CANDIDATES) {
        const probe = spawnSync(
            candidate,
            ['-NoProfile', '-Command', '$PSVersionTable.PSVersion.ToString()'],
            {
                cwd: REPO_ROOT,
                encoding: 'utf8',
            }
        );
        if (!probe.error && probe.status === 0) {
            return candidate;
        }
    }

    return null;
}

function runPowerShell(binary, script) {
    const args =
        process.platform === 'win32'
            ? ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-Command', script]
            : ['-NoProfile', '-Command', script];

    return spawnSync(binary, args, {
        cwd: REPO_ROOT,
        encoding: 'utf8',
    });
}

test('Get-GitHubProductionAlertSummary distingue advisory git-sync de bloqueos efectivos', (t) => {
    const raw = load(COMMON_HTTP_PATH);
    const helperStart = raw.indexOf(
        'function Get-GitHubProductionAlertSummary {'
    );
    const helperEnd = raw.indexOf(
        'function Invoke-EndpointCheck {',
        helperStart
    );

    assert.notEqual(
        helperStart,
        -1,
        'Common.Http.ps1 debe definir Get-GitHubProductionAlertSummary'
    );
    assert.notEqual(
        helperEnd,
        -1,
        'Common.Http.ps1 debe mantener Get-GitHubProductionAlertSummary antes de Invoke-EndpointCheck'
    );

    const powerShellBinary = resolvePowerShellBinary();
    if (!powerShellBinary) {
        t.skip(
            'PowerShell no disponible para validar la matriz advisory/blocking de GitHub deploy alerts'
        );
        return;
    }

    const helperSource = raw.slice(helperStart, helperEnd).trim();
    const script = [
        'function Invoke-GitHubIssuesGet {',
        '    param(',
        '        [string]$Repo,',
        "        [string]$State = 'open',",
        "        [string]$Labels = 'production-alert',",
        '        [int]$PerPage = 30,',
        '        [int]$TimeoutSec = 20,',
        "        [string]$ApiBase = 'https://api.github.com',",
        "        [string]$UserAgent = 'PielArmoniaHttp/1.0',",
        '        [int]$JsonDepth = 20',
        '    )',
        '',
        '    $issues = @(',
        '        [pscustomobject]@{',
        '            number = 443',
        "            title = 'transport blocked'",
        "            html_url = 'https://example.test/issues/443'",
        '            pull_request = $null',
        '            labels = @(',
        "                [pscustomobject]@{ name = 'production-alert' }",
        "                [pscustomobject]@{ name = 'deploy-hosting' }",
        "                [pscustomobject]@{ name = 'transport-preflight' }",
        "                [pscustomobject]@{ name = 'severity:warning' }",
        '            )',
        '        }',
        '        [pscustomobject]@{',
        '            number = 442',
        "            title = 'connectivity blocked'",
        "            html_url = 'https://example.test/issues/442'",
        '            pull_request = $null',
        '            labels = @(',
        "                [pscustomobject]@{ name = 'production-alert' }",
        "                [pscustomobject]@{ name = 'diagnose-host-connectivity' }",
        "                [pscustomobject]@{ name = 'deploy-connectivity' }",
        "                [pscustomobject]@{ name = 'severity:warning' }",
        '            )',
        '        }',
        '        [pscustomobject]@{',
        '            number = 501',
        "            title = 'repair remains blocking'",
        "            html_url = 'https://example.test/issues/501'",
        '            pull_request = $null',
        '            labels = @(',
        "                [pscustomobject]@{ name = 'production-alert' }",
        "                [pscustomobject]@{ name = 'repair-git-sync' }",
        "                [pscustomobject]@{ name = 'severity:warning' }",
        '            )',
        '        }',
        '        [pscustomobject]@{',
        '            number = 502',
        "            title = 'self-hosted deploy remains blocking'",
        "            html_url = 'https://example.test/issues/502'",
        '            pull_request = $null',
        '            labels = @(',
        "                [pscustomobject]@{ name = 'production-alert' }",
        "                [pscustomobject]@{ name = 'self-hosted-route' }",
        "                [pscustomobject]@{ name = 'severity:warning' }",
        '            )',
        '        }',
        '        [pscustomobject]@{',
        '            number = 503',
        "            title = 'turnero pilot remains blocking'",
        "            html_url = 'https://example.test/issues/503'",
        '            pull_request = $null',
        '            labels = @(',
        "                [pscustomobject]@{ name = 'production-alert' }",
        "                [pscustomobject]@{ name = 'turnero-pilot' }",
        "                [pscustomobject]@{ name = 'severity:warning' }",
        '            )',
        '        }',
        '    )',
        '',
        '    return [pscustomobject]@{',
        "        Name = 'github-issues'",
        '        Ok = $true',
        '        StatusCode = 200',
        "        Error = ''",
        '        Json = $issues',
        "        Body = '[]'",
        "        Url = 'https://api.github.com/repos/mock/repo/issues?state=open&per_page=100'",
        '    }',
        '}',
        '',
        helperSource,
        '',
        "$advisory = Get-GitHubProductionAlertSummary -Repo 'mock/repo' -CanonicalDeployMethod 'git-sync'",
        "$blocking = Get-GitHubProductionAlertSummary -Repo 'mock/repo' -CanonicalDeployMethod 'git-sync' -ForceTransportDeploy",
        '',
        'if (-not $advisory.fetchOk) { throw "summary advisory no pudo consultar issues" }',
        'if ($advisory.relevantCount -ne 3) { throw "git-sync canónico debe dejar 3 blockers efectivos (repair/self-hosted/turnero) y obtuvo $($advisory.relevantCount)" }',
        'if ($advisory.advisoryRelevantCount -ne 2) { throw "git-sync canónico debe desescalar 2 advisory y obtuvo $($advisory.advisoryRelevantCount)" }',
        'if ($advisory.transportCount -ne 0 -or $advisory.connectivityCount -ne 0) { throw "transport/connectivity no deben bloquear bajo git-sync canónico" }',
        'if (-not $advisory.hasTransportAdvisory -or -not $advisory.hasConnectivityAdvisory) { throw "git-sync canónico debe marcar advisory transport/connectivity" }',
        'if (-not $advisory.hasRepairGitSyncBlock -or -not $advisory.hasSelfHostedDeployBlock -or -not $advisory.hasTurneroPilotBlock) { throw "repair/self-hosted/turnero deben seguir bloqueando" }',
        'if ($blocking.relevantCount -ne 5) { throw "force_transport_deploy debe volver efectivos los 5 incidentes y obtuvo $($blocking.relevantCount)" }',
        'if ($blocking.advisoryRelevantCount -ne 0) { throw "force_transport_deploy no debe dejar advisories efectivos" }',
        'if (-not $blocking.hasTransportBlock -or -not $blocking.hasConnectivityBlock) { throw "force_transport_deploy debe bloquear transport/connectivity" }',
        'if (-not $blocking.transportBlockingEnabled) { throw "force_transport_deploy debe activar transportBlockingEnabled" }',
        '$payload = [ordered]@{ advisory = $advisory; blocking = $blocking }',
        '$payload | ConvertTo-Json -Depth 8',
    ].join('\n');

    const result = runPowerShell(powerShellBinary, script);
    assert.equal(result.status, 0, result.stderr || result.stdout);

    const payload = JSON.parse(result.stdout);
    assert.equal(payload.advisory.fetchOk, true);
    assert.equal(payload.advisory.relevantCount, 3);
    assert.equal(payload.advisory.advisoryRelevantCount, 2);
    assert.equal(payload.advisory.transportCount, 0);
    assert.equal(payload.advisory.connectivityCount, 0);
    assert.equal(payload.advisory.hasTransportAdvisory, true);
    assert.equal(payload.advisory.hasConnectivityAdvisory, true);
    assert.equal(payload.advisory.hasRepairGitSyncBlock, true);
    assert.equal(payload.advisory.hasSelfHostedDeployBlock, true);
    assert.equal(payload.advisory.hasTurneroPilotBlock, true);
    assert.equal(payload.blocking.relevantCount, 5);
    assert.equal(payload.blocking.advisoryRelevantCount, 0);
    assert.equal(payload.blocking.hasTransportBlock, true);
    assert.equal(payload.blocking.hasConnectivityBlock, true);
    assert.equal(payload.blocking.transportBlockingEnabled, true);
});
