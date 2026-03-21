'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const focusDomain = require('../../tools/agent-orchestrator/domain/focus');

test('focus evaluateRequiredChecks marca public_main_sync health_http_502 como red y accionable', () => {
    const checks = focusDomain.evaluateRequiredChecks(
        {
            required_checks: ['job:public_main_sync'],
        },
        {
            jobsSnapshot: [
                {
                    key: 'public_main_sync',
                    configured: true,
                    verified: false,
                    healthy: false,
                    state: 'failed',
                    verification_source: 'health_url',
                    failure_reason: 'health_http_502',
                    last_error_message: 'health_http_502',
                },
            ],
        }
    );

    assert.equal(checks.length, 1);
    assert.deepEqual(checks[0], {
        id: 'job:public_main_sync',
        type: 'job',
        target: 'public_main_sync',
        state: 'red',
        ok: false,
        reason: 'health_http_502',
        next_action:
            'revisar /api.php?resource=health y recuperar backend/origen del host publico',
        message: 'job public_main_sync unhealthy: health_http_502',
    });
});

test('focus evaluateRequiredChecks trata public_main_sync registry_only/unverified como bloqueo rojo del corte', () => {
    const checks = focusDomain.evaluateRequiredChecks(
        {
            required_checks: ['job:public_main_sync'],
        },
        {
            jobsSnapshot: [
                {
                    key: 'public_main_sync',
                    configured: true,
                    verified: false,
                    healthy: false,
                    state: 'failed',
                    verification_source: 'registry_only',
                    failure_reason: 'unverified',
                    last_error_message: 'unverified',
                },
            ],
        }
    );

    assert.equal(checks.length, 1);
    assert.equal(checks[0].state, 'red');
    assert.equal(checks[0].reason, 'unverified');
    assert.match(checks[0].next_action, /health_url/i);
});
