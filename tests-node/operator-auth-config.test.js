const test = require('node:test');
const assert = require('node:assert/strict');

const {
    buildOperatorAuthBridgeHeaders,
    loadOpenClawHelperServerConfig,
    loadOpenClawOperatorAuthConfig,
} = require('../bin/lib/operator-auth-config.js');

function withEnv(overrides, callback) {
    const previous = new Map();

    Object.entries(overrides).forEach(([key, value]) => {
        previous.set(key, process.env[key]);
        if (value === undefined || value === null) {
            delete process.env[key];
            return;
        }
        process.env[key] = String(value);
    });

    return Promise.resolve()
        .then(callback)
        .finally(() => {
            previous.forEach((value, key) => {
                if (value === undefined) {
                    delete process.env[key];
                    return;
                }
                process.env[key] = value;
            });
        });
}

test('operator auth config normaliza helperBaseUrl, path y fallback del bridge secret', async () => {
    await withEnv(
        {
            PIELARMONIA_OPERATOR_AUTH_HELPER_BASE_URL:
                'http://127.0.0.1:4173/panel-auth/',
            OPENCLAW_RUNTIME_BASE_URL: 'http://127.0.0.1:4141/',
            PIELARMONIA_OPERATOR_AUTH_BRIDGE_TOKEN: 'bridge-token-test',
            PIELARMONIA_OPERATOR_AUTH_BRIDGE_SECRET: '',
            PIELARMONIA_OPERATOR_AUTH_BRIDGE_TOKEN_HEADER: '',
            PIELARMONIA_OPERATOR_AUTH_BRIDGE_TOKEN_PREFIX: '',
        },
        async () => {
            const config = loadOpenClawOperatorAuthConfig();
            const helperConfig = loadOpenClawHelperServerConfig();

            assert.equal(
                config.helperBaseUrl,
                'http://127.0.0.1:4173/panel-auth'
            );
            assert.equal(config.runtimeBaseUrl, 'http://127.0.0.1:4141');
            assert.equal(config.bridgeToken, 'bridge-token-test');
            assert.equal(config.bridgeSecret, 'bridge-token-test');
            assert.equal(config.bridgeHeader, 'Authorization');
            assert.equal(config.bridgePrefix, 'Bearer');

            assert.equal(helperConfig.helperHostname, '127.0.0.1');
            assert.equal(helperConfig.helperPort, 4173);
            assert.equal(helperConfig.helperBasePath, '/panel-auth');
        }
    );
});

test('operator auth bridge headers respetan header configurado y fallback de prefix', async () => {
    await withEnv(
        {
            PIELARMONIA_OPERATOR_AUTH_BRIDGE_TOKEN: 'bridge-token-test',
            PIELARMONIA_OPERATOR_AUTH_BRIDGE_TOKEN_HEADER: 'X-Bridge-Token',
            PIELARMONIA_OPERATOR_AUTH_BRIDGE_TOKEN_PREFIX: '',
        },
        async () => {
            const headers = buildOperatorAuthBridgeHeaders();

            assert.equal(headers.Accept, 'application/json');
            assert.equal(headers['X-Bridge-Token'], 'Bearer bridge-token-test');
        }
    );
});

test('operator auth config acepta alias legacy de deviceId pero prefiere OPENCLAW_HELPER_DEVICE_ID', async () => {
    await withEnv(
        {
            OPENCLAW_HELPER_DEVICE_ID: 'device-openclaw-primary',
            PIELARMONIA_OPERATOR_AUTH_DEVICE_ID: 'device-legacy-alias',
        },
        async () => {
            const config = loadOpenClawOperatorAuthConfig();

            assert.equal(config.helperDeviceId, 'device-openclaw-primary');
        }
    );

    await withEnv(
        {
            OPENCLAW_HELPER_DEVICE_ID: '',
            PIELARMONIA_OPERATOR_AUTH_DEVICE_ID: 'device-legacy-alias',
        },
        async () => {
            const config = loadOpenClawOperatorAuthConfig();

            assert.equal(config.helperDeviceId, 'device-legacy-alias');
        }
    );
});
