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
    if (!report.helper.configured) {
        return 'Configura PIELARMONIA_OPERATOR_AUTH_HELPER_BASE_URL antes de iniciar el helper local.';
    }

    if (!report.bridge.tokenConfigured || !report.bridge.secretConfigured) {
        return 'Configura PIELARMONIA_OPERATOR_AUTH_BRIDGE_TOKEN y PIELARMONIA_OPERATOR_AUTH_BRIDGE_SECRET.';
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
        helper: {
            baseUrl: config.helperBaseUrl,
            configured: config.helperBaseUrl !== '',
            deviceId: config.helperDeviceId,
        },
        bridge: {
            tokenConfigured: config.bridgeToken !== '',
            secretConfigured: config.bridgeSecret !== '',
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
        `helper_base_url: ${report.helper.baseUrl || '(missing)'}`,
        `bridge_token: ${report.bridge.tokenConfigured ? 'configured' : 'missing'}`,
        `bridge_secret: ${report.bridge.secretConfigured ? 'configured' : 'missing'}`,
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
