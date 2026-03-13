#!/usr/bin/env node
'use strict';

const { buildOpenClawAuthPreflight } = require('./openclaw-auth-preflight.js');
const { resolveOperatorChallenge } = require('./openclaw-auth-helper.js');
const {
    createCookieJar,
    fetchAdminAuthStatus: fetchOperatorStatus,
    logoutAdmin: logoutOperator,
    startAdminAuthChallenge: startOperatorChallenge,
    trimTrailingSlash,
} = require('./lib/admin-auth-client.js');

function env(name, fallback = '') {
    const value = process.env[name];
    return typeof value === 'string' && value.trim() ? value.trim() : fallback;
}

function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

function isTerminalStatus(status) {
    const normalized = String(status || '')
        .trim()
        .toLowerCase();
    return normalized !== '' && normalized !== 'pending';
}

function baseSmokeConfig(overrides = {}) {
    return {
        serverBaseUrl: trimTrailingSlash(
            String(
                overrides.serverBaseUrl ||
                    env('PIELARMONIA_OPERATOR_AUTH_SERVER_BASE_URL')
            ).trim()
        ),
        timeoutMs: Number(overrides.timeoutMs || 20000),
        pollIntervalMs: Number(overrides.pollIntervalMs || 1500),
        requireReadyForLogin:
            overrides.requireReadyForLogin !== undefined
                ? overrides.requireReadyForLogin === true
                : true,
    };
}

async function runOpenClawAuthLocalSmoke(overrides = {}) {
    const config = baseSmokeConfig(overrides);
    const preflight = await buildOpenClawAuthPreflight(
        overrides.preflightOverrides || {}
    );
    const report = {
        ok: false,
        stage: 'preflight',
        serverBaseUrl: config.serverBaseUrl,
        timeoutMs: config.timeoutMs,
        pollIntervalMs: config.pollIntervalMs,
        preflight,
        start: null,
        helper: null,
        finalStatus: null,
        logout: null,
        nextAction: '',
    };

    if (!config.serverBaseUrl) {
        report.nextAction =
            'Configura PIELARMONIA_OPERATOR_AUTH_SERVER_BASE_URL antes de correr el smoke local.';
        return report;
    }

    if (!preflight.ok) {
        report.nextAction = String(preflight.nextAction || '').trim();
        return report;
    }

    if (config.requireReadyForLogin && !preflight.readyForLogin) {
        report.nextAction =
            String(preflight.nextAction || '').trim() ||
            'Inicia sesion en OpenClaw antes de correr el smoke local.';
        return report;
    }

    const cookieJar = createCookieJar();
    const startResponse = await startOperatorChallenge(config.serverBaseUrl, {
        cookieJar,
    });
    const startPayload = startResponse.json || {};
    report.start = {
        ok: startResponse.ok,
        httpStatus: startResponse.status,
        status: String(startPayload.status || ''),
        mode: String(startPayload.mode || ''),
    };

    const challenge =
        startPayload &&
        typeof startPayload.challenge === 'object' &&
        startPayload.challenge
            ? startPayload.challenge
            : null;
    if (!startResponse.ok || startResponse.status !== 202 || !challenge) {
        report.stage = 'start';
        report.nextAction =
            'Revisa la respuesta de admin-auth.php?action=start.';
        return report;
    }

    report.start.challenge = {
        challengeId: String(challenge.challengeId || ''),
        manualCode: String(challenge.manualCode || ''),
        expiresAt: String(challenge.expiresAt || ''),
        helperUrl: String(challenge.helperUrl || ''),
    };

    const helperResult = await resolveOperatorChallenge({
        challengeId: String(challenge.challengeId || ''),
        nonce: String(challenge.nonce || ''),
        serverBaseUrl: config.serverBaseUrl,
        manualCode: String(challenge.manualCode || ''),
        rawQuery: {
            challengeId: String(challenge.challengeId || ''),
            nonce: String(challenge.nonce || ''),
            serverBaseUrl: config.serverBaseUrl,
            manualCode: String(challenge.manualCode || ''),
        },
    });
    report.helper = {
        ok: helperResult.ok === true,
        status: String(helperResult.status || ''),
        errorCode: String(helperResult.errorCode || ''),
        error: String(helperResult.error || ''),
        bridgeStatus: Number(helperResult.bridgeStatus || 0),
    };

    if (report.helper.status !== 'completed') {
        report.stage = 'helper';
        report.nextAction =
            report.helper.error ||
            String(preflight.nextAction || '').trim() ||
            'El helper no pudo completar el challenge.';
        return report;
    }

    const startedAt = Date.now();
    let lastStatusPayload = null;
    while (Date.now() - startedAt <= config.timeoutMs) {
        const statusResponse = await fetchOperatorStatus(config.serverBaseUrl, {
            cookieJar,
        });
        const statusPayload = statusResponse.json || {};
        lastStatusPayload = {
            ok: statusResponse.ok,
            httpStatus: statusResponse.status,
            authenticated: statusPayload.authenticated === true,
            status: String(statusPayload.status || ''),
            mode: String(statusPayload.mode || ''),
            operatorEmail: String(
                statusPayload.operator && statusPayload.operator.email
                    ? statusPayload.operator.email
                    : ''
            ),
        };

        if (
            lastStatusPayload.authenticated ||
            isTerminalStatus(lastStatusPayload.status)
        ) {
            break;
        }
        await sleep(config.pollIntervalMs);
    }

    report.finalStatus = lastStatusPayload;
    if (
        !lastStatusPayload ||
        lastStatusPayload.authenticated !== true ||
        lastStatusPayload.status !== 'autenticado'
    ) {
        report.stage = 'status';
        report.nextAction =
            'El panel no alcanzo status=autenticado dentro de la ventana del smoke local.';
        return report;
    }

    const logoutResponse = await logoutOperator(config.serverBaseUrl, {
        cookieJar,
    });
    const logoutPayload = logoutResponse.json || {};
    report.logout = {
        ok: logoutResponse.ok,
        httpStatus: logoutResponse.status,
        authenticated: logoutPayload.authenticated === true,
        status: String(logoutPayload.status || ''),
        mode: String(logoutPayload.mode || ''),
    };

    report.ok =
        report.logout.ok === true &&
        report.logout.authenticated === false &&
        report.finalStatus.authenticated === true;
    if (report.ok) {
        report.stage = 'completed';
    } else {
        report.stage = 'logout';
    }
    report.nextAction = report.ok
        ? 'Smoke local completado. El login OpenClaw y el logout admin respondieron como se esperaba.'
        : 'Revisa la respuesta de admin-auth.php?action=logout.';

    return report;
}

function formatTextReport(report) {
    const lines = [
        `ok: ${report.ok ? 'yes' : 'no'}`,
        `stage: ${report.stage || 'unknown'}`,
        `server_base_url: ${report.serverBaseUrl || '(missing)'}`,
        `preflight_ok: ${report.preflight && report.preflight.ok ? 'yes' : 'no'}`,
        `preflight_ready_for_login: ${
            report.preflight && report.preflight.readyForLogin ? 'yes' : 'no'
        }`,
    ];

    if (report.start) {
        lines.push(`start_http_status: ${report.start.httpStatus || 'n/a'}`);
        lines.push(`start_status: ${report.start.status || '(missing)'}`);
        lines.push(`start_mode: ${report.start.mode || '(missing)'}`);
    }
    if (report.helper) {
        lines.push(`helper_status: ${report.helper.status || '(missing)'}`);
        if (report.helper.errorCode) {
            lines.push(`helper_error_code: ${report.helper.errorCode}`);
        }
        if (report.helper.error) {
            lines.push(`helper_error: ${report.helper.error}`);
        }
    }
    if (report.finalStatus) {
        lines.push(`final_status: ${report.finalStatus.status || '(missing)'}`);
        lines.push(
            `final_authenticated: ${
                report.finalStatus.authenticated ? 'yes' : 'no'
            }`
        );
        if (report.finalStatus.operatorEmail) {
            lines.push(`operator_email: ${report.finalStatus.operatorEmail}`);
        }
    }
    if (report.logout) {
        lines.push(`logout_http_status: ${report.logout.httpStatus || 'n/a'}`);
        lines.push(
            `logout_authenticated: ${report.logout.authenticated ? 'yes' : 'no'}`
        );
    }
    if (report.nextAction) {
        lines.push(`next_action: ${report.nextAction}`);
    }

    return `${lines.join('\n')}\n`;
}

async function main(argv = process.argv.slice(2)) {
    const wantsJson = argv.includes('--json');
    const report = await runOpenClawAuthLocalSmoke();

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
    baseSmokeConfig,
    createCookieJar,
    formatTextReport,
    runOpenClawAuthLocalSmoke,
};
