const test = require('node:test');
const assert = require('node:assert/strict');

const sharedSignature = require('../bin/lib/operator-auth-signature.js');
const helperSignature = require('../bin/openclaw-auth-helper.js');

test('operator auth signature normaliza email y preserva el orden del payload completed', () => {
    const payload = {
        challengeId: 'challenge-1',
        nonce: 'nonce-1',
        status: 'completed',
        email: '  Operator@Example.COM ',
        profileId: 'profile-1',
        accountId: 'acct-1',
        deviceId: 'device-1',
        timestamp: '2026-03-13T00:00:00.000Z',
    };

    assert.equal(
        sharedSignature.operatorAuthSignaturePayload(payload),
        [
            'challenge-1',
            'nonce-1',
            'completed',
            'operator@example.com',
            'profile-1',
            'acct-1',
            'device-1',
            '2026-03-13T00:00:00.000Z',
        ].join('\n')
    );

    assert.equal(
        sharedSignature.operatorAuthSignaturePayload(payload),
        helperSignature.operatorAuthSignaturePayload(payload)
    );
});

test('operator auth signature usa la rama error y la misma firma HMAC en shared/helper', () => {
    const payload = {
        challengeId: 'challenge-2',
        nonce: 'nonce-2',
        status: 'error',
        errorCode: 'openclaw_login_required',
        error: 'Debes iniciar sesion en OpenClaw antes de continuar.',
        deviceId: 'device-2',
        timestamp: '2026-03-13T01:00:00.000Z',
    };
    const secret = 'bridge-secret-test';

    assert.equal(
        sharedSignature.operatorAuthSignaturePayload(payload),
        [
            'challenge-2',
            'nonce-2',
            'error',
            'openclaw_login_required',
            'Debes iniciar sesion en OpenClaw antes de continuar.',
            'device-2',
            '2026-03-13T01:00:00.000Z',
        ].join('\n')
    );

    assert.equal(
        sharedSignature.signOperatorAuthPayload(payload, secret),
        helperSignature.signBridgePayload(payload, secret)
    );
});
