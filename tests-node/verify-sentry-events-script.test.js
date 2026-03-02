#!/usr/bin/env node
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { mkdtempSync, readFileSync, rmSync } = require('fs');
const { tmpdir } = require('os');
const { join, resolve } = require('path');
const { spawnSync } = require('child_process');

const REPO_ROOT = resolve(__dirname, '..');
const SCRIPT_PATH = resolve(REPO_ROOT, 'bin', 'verify-sentry-events.js');

test('verify-sentry-events escribe artefacto accionable cuando faltan credenciales', () => {
    const dir = mkdtempSync(join(tmpdir(), 'sentry-verify-script-'));
    const jsonOut = join(dir, 'sentry-events-last.json');

    try {
        const result = spawnSync(process.execPath, [SCRIPT_PATH, `--json-out=${jsonOut}`], {
            cwd: REPO_ROOT,
            encoding: 'utf8',
            env: {
                ...process.env,
                SENTRY_AUTH_TOKEN: '',
                SENTRY_ORG: '',
                SENTRY_BACKEND_PROJECT: 'pielarmonia-backend',
                SENTRY_FRONTEND_PROJECT: 'pielarmonia-frontend',
            },
        });

        assert.equal(result.status, 1, 'sin credenciales debe fallar');

        const payload = JSON.parse(readFileSync(jsonOut, 'utf8'));
        assert.equal(payload.version, 1);
        assert.equal(payload.ok, false);
        assert.equal(payload.status, 'needs_configuration');
        assert.deepEqual(payload.missingEnv, [
            'SENTRY_AUTH_TOKEN',
            'SENTRY_ORG',
        ]);
        assert.equal(payload.failureReason.code, 'missing_env');
        assert.match(
            payload.actionRequired,
            /Configurar secrets\/variables de Sentry/
        );
    } finally {
        rmSync(dir, { recursive: true, force: true });
    }
});
