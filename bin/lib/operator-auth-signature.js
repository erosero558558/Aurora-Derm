'use strict';

const crypto = require('crypto');

function normalizeEmail(value) {
    return String(value || '')
        .trim()
        .toLowerCase();
}

function operatorAuthSignaturePayload(payload) {
    const status = String(payload.status || 'completed')
        .trim()
        .toLowerCase();
    const challengeId = String(payload.challengeId || '').trim();
    const nonce = String(payload.nonce || '').trim();
    const deviceId = String(payload.deviceId || '').trim();
    const timestamp = String(payload.timestamp || '').trim();

    if (status === 'error') {
        return [
            challengeId,
            nonce,
            status,
            String(payload.errorCode || '').trim(),
            String(payload.error || '').trim(),
            deviceId,
            timestamp,
        ].join('\n');
    }

    return [
        challengeId,
        nonce,
        status,
        normalizeEmail(payload.email),
        String(payload.profileId || '').trim(),
        String(payload.accountId || '').trim(),
        deviceId,
        timestamp,
    ].join('\n');
}

function signOperatorAuthPayload(payload, secret) {
    return crypto
        .createHmac('sha256', String(secret || ''))
        .update(operatorAuthSignaturePayload(payload))
        .digest('hex');
}

module.exports = {
    normalizeEmail,
    operatorAuthSignaturePayload,
    signOperatorAuthPayload,
};
