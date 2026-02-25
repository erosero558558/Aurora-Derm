#!/usr/bin/env node
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { spawnSync } = require('child_process');
const { resolve } = require('path');

const REPO_ROOT = resolve(__dirname, '..');

test('php-governance-contract ejecuta validador canonico de gobernanza', (t) => {
    const phpProbe = spawnSync('php', ['-v'], {
        cwd: REPO_ROOT,
        encoding: 'utf8',
    });

    if (phpProbe.error || phpProbe.status !== 0) {
        t.skip('php no disponible en PATH para ejecutar contrato PHP local');
        return;
    }

    const result = spawnSync('php', ['bin/validate-agent-governance.php'], {
        cwd: REPO_ROOT,
        encoding: 'utf8',
    });

    assert.equal(
        result.status,
        0,
        `php bin/validate-agent-governance.php fallo\nSTDOUT:\n${result.stdout || ''}\nSTDERR:\n${result.stderr || ''}`
    );
    assert.match(
        String(result.stdout || ''),
        /OK:\s+gobernanza de agentes valida/i
    );
});
