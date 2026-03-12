#!/usr/bin/env node
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');

const {
    buildConfig,
    createBridgeServer,
    operatorAuthSignaturePayload,
    parsePhpEnvFile,
    resolveChallenge,
    resolveIdentityFromModelsStatus,
} = require('../bin/lib/operator-auth-bridge');

function listen(server) {
    return new Promise((resolve, reject) => {
        server.on('error', reject);
        server.listen(0, '127.0.0.1', () => resolve(server.address()));
    });
}

function closeServer(server) {
    return new Promise((resolve, reject) => {
        server.close((error) => (error ? reject(error) : resolve()));
    });
}

function getJson(url) {
    return new Promise((resolve, reject) => {
        http.get(url, (response) => {
            let raw = '';
            response.setEncoding('utf8');
            response.on('data', (chunk) => {
                raw += chunk;
            });
            response.on('end', () => {
                resolve({
                    status: Number(response.statusCode || 0),
                    body: JSON.parse(raw),
                });
            });
        }).on('error', reject);
    });
}

function getText(url) {
    return new Promise((resolve, reject) => {
        http.get(url, (response) => {
            let raw = '';
            response.setEncoding('utf8');
            response.on('data', (chunk) => {
                raw += chunk;
            });
            response.on('end', () => {
                resolve({
                    status: Number(response.statusCode || 0),
                    body: raw,
                });
            });
        }).on('error', reject);
    });
}

test('parsePhpEnvFile extrae operator auth vars desde env.php', () => {
    const parsed = parsePhpEnvFile(`
<?php
putenv('PIELARMONIA_OPERATOR_AUTH_BRIDGE_TOKEN=test-token');
putenv('PIELARMONIA_OPERATOR_AUTH_HELPER_BASE_URL=http://127.0.0.1:4173');
`);

    assert.equal(parsed.PIELARMONIA_OPERATOR_AUTH_BRIDGE_TOKEN, 'test-token');
    assert.equal(
        parsed.PIELARMONIA_OPERATOR_AUTH_HELPER_BASE_URL,
        'http://127.0.0.1:4173'
    );
});

test('resolveIdentityFromModelsStatus usa el perfil OAuth openai-codex vigente', () => {
    const result = resolveIdentityFromModelsStatus({
        auth: {
            oauth: {
                providers: [
                    {
                        provider: 'openai-codex',
                        status: 'ok',
                        profiles: [
                            {
                                profileId: 'openai-codex:javier.rosero94@gmail.com',
                                provider: 'openai-codex',
                                type: 'oauth',
                                status: 'ok',
                                label: 'openai-codex:javier.rosero94@gmail.com (javier.rosero94@gmail.com)',
                            },
                        ],
                    },
                ],
            },
        },
    });

    assert.equal(result.ok, true);
    assert.equal(result.identity.email, 'javier.rosero94@gmail.com');
    assert.equal(
        result.identity.profileId,
        'openai-codex:javier.rosero94@gmail.com'
    );
});

test('resolveChallenge firma y publica completion payload al backend PHP', async () => {
    let capturedHeaders = null;
    let capturedBody = null;

    const backend = http.createServer((request, response) => {
        let raw = '';
        request.setEncoding('utf8');
        request.on('data', (chunk) => {
            raw += chunk;
        });
        request.on('end', () => {
            capturedHeaders = request.headers;
            capturedBody = JSON.parse(raw);
            response.writeHead(202, {
                'Content-Type': 'application/json; charset=utf-8',
            });
            response.end(
                JSON.stringify({
                    ok: true,
                    accepted: true,
                    status: 'completed',
                })
            );
        });
    });

    const address = await listen(backend);
    const serverBaseUrl = `http://${address.address}:${address.port}`;

    try {
        const config = {
            ...buildConfig({
                PIELARMONIA_OPERATOR_AUTH_BRIDGE_TOKEN: 'bridge-token',
                PIELARMONIA_OPERATOR_AUTH_BRIDGE_SECRET: 'bridge-secret',
                PIELARMONIA_OPERATOR_AUTH_BRIDGE_TOKEN_HEADER: 'Authorization',
                PIELARMONIA_OPERATOR_AUTH_BRIDGE_TOKEN_PREFIX: 'Bearer',
                PIELARMONIA_OPERATOR_AUTH_SERVER_BASE_URL: serverBaseUrl,
                PIELARMONIA_OPERATOR_AUTH_HELPER_BASE_URL:
                    'http://127.0.0.1:4173',
            }),
            serverBaseUrl,
            deviceId: 'device-test-bridge',
        };

        const result = await resolveChallenge(
            {
                challengeId: 'a'.repeat(32),
                nonce: 'b'.repeat(32),
                serverBaseUrl,
            },
            {
                config,
                detectIdentityImpl: () => ({
                    ok: true,
                    identity: {
                        email: 'operator@example.com',
                        profileId: 'openai-codex:operator@example.com',
                        accountId: 'acct-test-operator',
                    },
                }),
            }
        );

        assert.equal(result.ok, true);
        assert.equal(result.status, 'completed');
        assert.equal(capturedHeaders.authorization, 'Bearer bridge-token');
        assert.equal(capturedBody.challengeId, 'a'.repeat(32));
        assert.equal(capturedBody.email, 'operator@example.com');
        assert.equal(
            capturedBody.signature,
            require('node:crypto')
                .createHmac('sha256', 'bridge-secret')
                .update(operatorAuthSignaturePayload(capturedBody))
                .digest('hex')
        );
    } finally {
        await closeServer(backend);
    }
});

test('createBridgeServer expone health y resolve HTML', async () => {
    const backend = http.createServer((request, response) => {
        response.writeHead(202, {
            'Content-Type': 'application/json; charset=utf-8',
        });
        response.end(
            JSON.stringify({
                ok: true,
                accepted: true,
                status: 'completed',
            })
        );
    });
    const backendAddress = await listen(backend);
    const serverBaseUrl = `http://${backendAddress.address}:${backendAddress.port}`;

    const config = {
        ...buildConfig({
            PIELARMONIA_OPERATOR_AUTH_BRIDGE_TOKEN: 'bridge-token',
            PIELARMONIA_OPERATOR_AUTH_BRIDGE_SECRET: 'bridge-secret',
            PIELARMONIA_OPERATOR_AUTH_SERVER_BASE_URL: serverBaseUrl,
            PIELARMONIA_OPERATOR_AUTH_HELPER_BASE_URL:
                'http://127.0.0.1:4173',
        }),
        serverBaseUrl,
        deviceId: 'device-test-bridge',
    };

    const helper = createBridgeServer(config, {
        detectIdentityImpl: () => ({
            ok: true,
            identity: {
                email: 'operator@example.com',
                profileId: 'openai-codex:operator@example.com',
                accountId: 'acct-test-operator',
            },
        }),
    });

    const helperAddress = await listen(helper);
    const helperBaseUrl = `http://${helperAddress.address}:${helperAddress.port}`;

    try {
        const health = await getJson(`${helperBaseUrl}/health`);
        assert.equal(health.status, 200);
        assert.equal(health.body.ok, true);
        assert.equal(health.body.service, 'operator-auth-bridge');

        const resolve = await getText(
            `${helperBaseUrl}/resolve?challengeId=${'c'.repeat(32)}&nonce=${'d'.repeat(
                32
            )}&serverBaseUrl=${encodeURIComponent(serverBaseUrl)}`
        );

        assert.equal(resolve.status, 200);
        assert.match(resolve.body, /Autenticacion enviada/i);
        assert.match(resolve.body, /operator@example.com/i);
    } finally {
        await closeServer(helper);
        await closeServer(backend);
    }
});
