#!/usr/bin/env node
'use strict';

const {
    buildOpenClawGatewayHeaders,
    loadOpenClawOperatorAuthConfig,
} = require('./lib/operator-auth-config.js');

function gatewayHeaders() {
    return buildOpenClawGatewayHeaders();
}

async function requestJson(url, options = {}) {
    const response = await fetch(url, {
        method: String(options.method || 'GET').toUpperCase(),
        headers: {
            Accept: 'application/json',
            ...(options.headers || {}),
        },
    });
    const rawText = await response.text();
    let payload;
    try {
        payload = rawText ? JSON.parse(rawText) : null;
    } catch (_error) {
        payload = null;
    }

    return {
        ok: response.ok,
        status: response.status,
        payload,
        rawText,
    };
}

function baseConfig(overrides = {}) {
    return loadOpenClawOperatorAuthConfig(overrides);
}

function deriveNextAction(report) {
    if (report.transport === 'web_broker') {
        if (!report.broker.authorizeUrlConfigured) {
            return 'Configura OPENCLAW_AUTH_BROKER_AUTHORIZE_URL para habilitar el login web.';
        }
        if (!report.broker.tokenUrlConfigured) {
            return 'Configura OPENCLAW_AUTH_BROKER_TOKEN_URL para habilitar el intercambio del codigo.';
        }
        if (!report.broker.userinfoUrlConfigured) {
            return 'Configura OPENCLAW_AUTH_BROKER_USERINFO_URL para resolver la identidad autenticada.';
        }
        if (!report.broker.clientIdConfigured) {
            return 'Configura OPENCLAW_AUTH_BROKER_CLIENT_ID antes de habilitar web_broker.';
        }
        if (!report.broker.jwksUrlConfigured) {
            return 'Configura OPENCLAW_AUTH_BROKER_JWKS_URL para validar firmas del id_token.';
        }
        if (!report.broker.expectedIssuerConfigured) {
            return 'Configura OPENCLAW_AUTH_BROKER_EXPECTED_ISSUER para fijar el issuer del broker.';
        }
        if (!report.broker.expectedAudienceConfigured) {
            return 'Configura OPENCLAW_AUTH_BROKER_EXPECTED_AUDIENCE para fijar la audiencia esperada.';
        }
        if (!report.broker.emailVerifiedRequired) {
            return 'Activa OPENCLAW_AUTH_BROKER_REQUIRE_EMAIL_VERIFIED=true antes de habilitar produccion.';
        }

        return 'Listo para abrir admin.html u operador-turnos.html y continuar con OpenClaw web.';
    }

    if (!report.helper.configured) {
        return 'Configura AURORADERM_OPERATOR_AUTH_HELPER_BASE_URL antes de iniciar el helper local. El alias PIELARMONIA_* sigue disponible temporalmente.';
    }

    if (!report.bridge.tokenConfigured || !report.bridge.secretConfigured) {
        return 'Configura AURORADERM_OPERATOR_AUTH_BRIDGE_TOKEN y AURORADERM_OPERATOR_AUTH_BRIDGE_SECRET. Los aliases PIELARMONIA_OPERATOR_AUTH_BRIDGE_TOKEN y PIELARMONIA_OPERATOR_AUTH_BRIDGE_SECRET siguen disponibles temporalmente.';
    }

    if (!report.runtime.reachable) {
        return `Inicia el runtime local OpenClaw en ${report.runtime.baseUrl}.`;
    }

    if (!report.runtime.loggedIn) {
        return 'Inicia sesion en OpenClaw y vuelve a ejecutar el preflight.';
    }

    return 'Listo para abrir admin.html y continuar con OpenClaw.';
}

async function buildOpenClawAuthPreflight(overrides = {}) {
    const config = baseConfig(overrides);
    const report = {
        ok: false,
        readyForLogin: false,
        transport: config.transport,
        helper: {
            baseUrl: config.helperBaseUrl,
            configured: config.helperBaseUrl !== '',
            deviceId: config.helperDeviceId,
        },
        bridge: {
            tokenConfigured: config.bridgeToken !== '',
            secretConfigured: config.bridgeSecret !== '',
        },
        broker: {
            authorizeUrl: config.brokerAuthorizeUrl,
            tokenUrl: config.brokerTokenUrl,
            userinfoUrl: config.brokerUserinfoUrl,
            clientIdConfigured: config.brokerClientId !== '',
            clientSecretConfigured: config.brokerClientSecret !== '',
            jwksUrl: config.brokerJwksUrl,
            expectedIssuer: config.brokerExpectedIssuer,
            expectedAudience: config.brokerExpectedAudience,
            jwksUrlConfigured: config.brokerJwksUrl !== '',
            expectedIssuerConfigured: config.brokerExpectedIssuer !== '',
            expectedAudienceConfigured: config.brokerExpectedAudience !== '',
            emailVerifiedRequired:
                config.brokerRequireEmailVerified === true,
            allowAnyAuthenticatedEmail:
                config.allowAnyAuthenticatedEmail === true,
            authorizeUrlConfigured: config.brokerAuthorizeUrl !== '',
            tokenUrlConfigured: config.brokerTokenUrl !== '',
            userinfoUrlConfigured: config.brokerUserinfoUrl !== '',
        },
        runtime: {
            baseUrl: config.runtimeBaseUrl,
            reachable: false,
            status: 0,
            loggedIn: false,
            provider: '',
            email: '',
            errorCode: '',
            error: '',
        },
        nextAction: '',
    };

    if (config.transport === 'web_broker') {
        report.ok =
            report.broker.authorizeUrlConfigured &&
            report.broker.tokenUrlConfigured &&
            report.broker.userinfoUrlConfigured &&
            report.broker.clientIdConfigured &&
            report.broker.jwksUrlConfigured &&
            report.broker.expectedIssuerConfigured &&
            report.broker.expectedAudienceConfigured &&
            report.broker.emailVerifiedRequired;
        report.readyForLogin = report.ok;
        report.nextAction = deriveNextAction(report);
        return report;
    }

    try {
        const runtimeResponse = await requestJson(
            `${config.runtimeBaseUrl}/v1/session`,
            {
                headers: gatewayHeaders(),
            }
        );
        const payload = runtimeResponse.payload || {};
        report.runtime.reachable = runtimeResponse.ok;
        report.runtime.status = runtimeResponse.status;
        report.runtime.loggedIn = payload.loggedIn === true;
        report.runtime.provider = String(payload.provider || '').trim();
        report.runtime.email = String(payload.email || '')
            .trim()
            .toLowerCase();
        report.runtime.errorCode = String(
            payload.errorCode || payload.code || ''
        ).trim();
        report.runtime.error = String(payload.error || '').trim();
    } catch (error) {
        report.runtime.reachable = false;
        report.runtime.error =
            error instanceof Error ? error.message : String(error);
    }

    report.ok =
        report.helper.configured &&
        report.bridge.tokenConfigured &&
        report.bridge.secretConfigured &&
        report.runtime.reachable;
    report.readyForLogin = report.ok && report.runtime.loggedIn;
    report.nextAction = deriveNextAction(report);

    return report;
}

function formatTextReport(report) {
    const lines = [
        `transport: ${report.transport || 'local_helper'}`,
        `helper_base_url: ${report.helper.baseUrl || '(missing)'}`,
        `bridge_token: ${report.bridge.tokenConfigured ? 'configured' : 'missing'}`,
        `bridge_secret: ${report.bridge.secretConfigured ? 'configured' : 'missing'}`,
        `broker_authorize_url: ${report.broker.authorizeUrl || '(missing)'}`,
        `broker_token_url: ${report.broker.tokenUrl || '(missing)'}`,
        `broker_userinfo_url: ${report.broker.userinfoUrl || '(missing)'}`,
        `broker_client_id: ${report.broker.clientIdConfigured ? 'configured' : 'missing'}`,
        `broker_jwks_url: ${report.broker.jwksUrl || '(missing)'}`,
        `broker_expected_issuer: ${report.broker.expectedIssuer || '(missing)'}`,
        `broker_expected_audience: ${report.broker.expectedAudience || '(missing)'}`,
        `broker_email_verified_required: ${report.broker.emailVerifiedRequired ? 'yes' : 'no'}`,
        `runtime_base_url: ${report.runtime.baseUrl || '(missing)'}`,
        `runtime_reachable: ${report.runtime.reachable ? 'yes' : 'no'}`,
        `runtime_status: ${report.runtime.status || 'n/a'}`,
        `logged_in: ${report.runtime.loggedIn ? 'yes' : 'no'}`,
    ];

    if (report.helper.deviceId) {
        lines.push(`device_id: ${report.helper.deviceId}`);
    }
    if (report.runtime.email) {
        lines.push(`email: ${report.runtime.email}`);
    }
    if (report.runtime.provider) {
        lines.push(`provider: ${report.runtime.provider}`);
    }
    if (report.runtime.errorCode) {
        lines.push(`error_code: ${report.runtime.errorCode}`);
    }
    if (report.runtime.error) {
        lines.push(`error: ${report.runtime.error}`);
    }

    lines.push(`ok: ${report.ok ? 'yes' : 'no'}`);
    lines.push(`ready_for_login: ${report.readyForLogin ? 'yes' : 'no'}`);
    if (report.nextAction) {
        lines.push(`next_action: ${report.nextAction}`);
    }

    return `${lines.join('\n')}\n`;
}

async function main(argv = process.argv.slice(2)) {
    const wantsJson = argv.includes('--json');
    const report = await buildOpenClawAuthPreflight();

    if (wantsJson) {
        process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
    } else {
        process.stdout.write(formatTextReport(report));
    }

    process.exitCode = report.ok ? 0 : 1;
}

if (require.main === module) {
    main().catch((error) => {
        console.error(
            error instanceof Error
                ? error.stack || error.message
                : String(error)
        );
        process.exitCode = 1;
    });
}

module.exports = {
    baseConfig,
    buildOpenClawAuthPreflight,
    deriveNextAction,
    formatTextReport,
};
