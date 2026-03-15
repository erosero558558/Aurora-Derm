'use strict';

function env(name, fallback = '') {
    const value = process.env[name];
    return typeof value === 'string' && value.trim() ? value.trim() : fallback;
}

function firstNonEmpty(...values) {
    for (const value of values) {
        const normalized = String(value || '').trim();
        if (normalized) {
            return normalized;
        }
    }

    return '';
}

function trimTrailingSlash(value) {
    return String(value || '').replace(/\/+$/, '');
}

function normalizeHelperBasePath(pathname) {
    const raw = String(pathname || '').trim();
    if (!raw || raw === '/') {
        return '';
    }

    return `/${raw.replace(/^\/+|\/+$/g, '')}`;
}

function loadOpenClawOperatorAuthConfig(overrides = {}) {
    const bridgeToken = firstNonEmpty(
        overrides.bridgeToken,
        env('PIELARMONIA_OPERATOR_AUTH_BRIDGE_TOKEN')
    );
    const transport = firstNonEmpty(
        overrides.transport,
        env('PIELARMONIA_OPERATOR_AUTH_TRANSPORT', 'local_helper')
    );

    return {
        transport: transport === 'web_broker' ? 'web_broker' : 'local_helper',
        helperBaseUrl: trimTrailingSlash(
            firstNonEmpty(
                overrides.helperBaseUrl,
                env(
                    'PIELARMONIA_OPERATOR_AUTH_HELPER_BASE_URL',
                    'http://127.0.0.1:4173'
                )
            )
        ),
        runtimeBaseUrl: trimTrailingSlash(
            firstNonEmpty(
                overrides.runtimeBaseUrl,
                env('OPENCLAW_RUNTIME_BASE_URL', 'http://127.0.0.1:4141')
            )
        ),
        bridgeToken,
        bridgeSecret: firstNonEmpty(
            overrides.bridgeSecret,
            env('PIELARMONIA_OPERATOR_AUTH_BRIDGE_SECRET'),
            bridgeToken
        ),
        bridgeHeader: firstNonEmpty(
            overrides.bridgeHeader,
            env(
                'PIELARMONIA_OPERATOR_AUTH_BRIDGE_TOKEN_HEADER',
                'Authorization'
            )
        ),
        bridgePrefix: firstNonEmpty(
            overrides.bridgePrefix,
            env('PIELARMONIA_OPERATOR_AUTH_BRIDGE_TOKEN_PREFIX', 'Bearer')
        ),
        helperDeviceId: firstNonEmpty(
            overrides.helperDeviceId,
            env('OPENCLAW_HELPER_DEVICE_ID'),
            env('PIELARMONIA_OPERATOR_AUTH_DEVICE_ID')
        ),
        brokerAuthorizeUrl: trimTrailingSlash(
            firstNonEmpty(
                overrides.brokerAuthorizeUrl,
                env('OPENCLAW_AUTH_BROKER_AUTHORIZE_URL')
            )
        ),
        brokerTokenUrl: trimTrailingSlash(
            firstNonEmpty(
                overrides.brokerTokenUrl,
                env('OPENCLAW_AUTH_BROKER_TOKEN_URL')
            )
        ),
        brokerUserinfoUrl: trimTrailingSlash(
            firstNonEmpty(
                overrides.brokerUserinfoUrl,
                env('OPENCLAW_AUTH_BROKER_USERINFO_URL')
            )
        ),
        brokerClientId: firstNonEmpty(
            overrides.brokerClientId,
            env('OPENCLAW_AUTH_BROKER_CLIENT_ID')
        ),
        brokerClientSecret: firstNonEmpty(
            overrides.brokerClientSecret,
            env('OPENCLAW_AUTH_BROKER_CLIENT_SECRET')
        ),
        brokerJwksUrl: trimTrailingSlash(
            firstNonEmpty(
                overrides.brokerJwksUrl,
                env('OPENCLAW_AUTH_BROKER_JWKS_URL')
            )
        ),
        brokerExpectedIssuer: firstNonEmpty(
            overrides.brokerExpectedIssuer,
            env('OPENCLAW_AUTH_BROKER_EXPECTED_ISSUER')
        ),
        brokerExpectedAudience: firstNonEmpty(
            overrides.brokerExpectedAudience,
            env('OPENCLAW_AUTH_BROKER_EXPECTED_AUDIENCE')
        ),
        brokerRequireEmailVerified:
            firstNonEmpty(
                overrides.brokerRequireEmailVerified,
                env('OPENCLAW_AUTH_BROKER_REQUIRE_EMAIL_VERIFIED', 'true')
            ).toLowerCase() !== 'false',
        allowAnyAuthenticatedEmail:
            firstNonEmpty(
                overrides.allowAnyAuthenticatedEmail,
                env('PIELARMONIA_OPERATOR_AUTH_ALLOW_ANY_AUTHENTICATED_EMAIL')
            ).toLowerCase() === 'true',
    };
}

function loadOpenClawHelperServerConfig(overrides = {}) {
    const config = loadOpenClawOperatorAuthConfig(overrides);
    const parsed = new URL(config.helperBaseUrl);

    if (parsed.protocol !== 'http:') {
        throw new Error('El helper local solo soporta HTTP.');
    }

    return {
        ...config,
        helperHostname: overrides.hostname || parsed.hostname || '127.0.0.1',
        helperPort:
            overrides.port !== undefined
                ? Number(overrides.port)
                : Number(parsed.port || 80),
        helperBasePath: normalizeHelperBasePath(parsed.pathname),
    };
}

function buildOpenClawGatewayHeaders() {
    const headers = {
        Accept: 'application/json',
    };
    const apiKey = env('OPENCLAW_GATEWAY_API_KEY');
    if (!apiKey) {
        return headers;
    }

    const headerName = env('OPENCLAW_GATEWAY_KEY_HEADER', 'Authorization');
    const prefix = env('OPENCLAW_GATEWAY_KEY_PREFIX', 'Bearer');
    headers[headerName] = prefix ? `${prefix} ${apiKey}` : apiKey;
    return headers;
}

function buildOperatorAuthBridgeHeaders(overrides = {}) {
    const config = loadOpenClawOperatorAuthConfig(overrides);
    if (!config.bridgeToken) {
        throw new Error('Falta PIELARMONIA_OPERATOR_AUTH_BRIDGE_TOKEN');
    }

    return {
        [config.bridgeHeader]: config.bridgePrefix
            ? `${config.bridgePrefix} ${config.bridgeToken}`
            : config.bridgeToken,
        Accept: 'application/json',
    };
}

module.exports = {
    buildOpenClawGatewayHeaders,
    buildOperatorAuthBridgeHeaders,
    env,
    firstNonEmpty,
    loadOpenClawHelperServerConfig,
    loadOpenClawOperatorAuthConfig,
    normalizeHelperBasePath,
    trimTrailingSlash,
};
