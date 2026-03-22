'use strict';

const { mkdirSync, writeFileSync } = require('fs');
const { dirname } = require('path');

const CANONICAL_OPERATOR_AUTH_MODE = 'google_oauth';
const LEGACY_OPERATOR_AUTH_MODE = 'openclaw_chatgpt';

function trimTrailingSlash(value) {
    return String(value || '').replace(/\/+$/, '');
}

function stringValue(value) {
    return String(value || '').trim();
}

function booleanValue(value, fallback = false) {
    return typeof value === 'boolean' ? value : fallback;
}

function safeJsonParse(raw) {
    const text = String(raw || '').trim();
    if (!text) {
        return null;
    }

    try {
        return JSON.parse(text);
    } catch (_error) {
        return null;
    }
}

function ensureArray(values) {
    if (!Array.isArray(values)) {
        return [];
    }

    return values.map((value) => String(value || '').trim()).filter(Boolean);
}

async function fetchText(url, options = {}) {
    const timeoutMs = Math.max(1, Number(options.timeoutMs || 20000));
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    try {
        const response = await fetch(url, {
            method: String(options.method || 'GET').toUpperCase(),
            headers: {
                Accept:
                    String(options.accept || '').trim() ||
                    'application/json,text/html;q=0.8,*/*;q=0.5',
                'User-Agent':
                    String(options.userAgent || '').trim() ||
                    'OperatorAuthRolloutNode/1.0',
                'Cache-Control': 'no-cache',
                ...(options.headers || {}),
            },
            signal: controller.signal,
        });

        return {
            ok: response.ok,
            status: response.status,
            text: await response.text(),
            error: '',
            headers: response.headers,
        };
    } catch (error) {
        return {
            ok: false,
            status: 0,
            text: '',
            error: error instanceof Error ? error.message : String(error),
            headers: null,
        };
    } finally {
        clearTimeout(timer);
    }
}

function testOperatorAuthContractPayload(payload) {
    if (!payload || typeof payload !== 'object') {
        return false;
    }

    return (
        Object.prototype.hasOwnProperty.call(payload, 'mode') &&
        Object.prototype.hasOwnProperty.call(payload, 'status') &&
        Object.prototype.hasOwnProperty.call(payload, 'transport')
    );
}

function looksLikeOpenClawTransportDrift(snapshot) {
    if (!snapshot || typeof snapshot !== 'object') {
        return false;
    }

    return (
        snapshot.reachable === true &&
        snapshot.json_valid === true &&
        [CANONICAL_OPERATOR_AUTH_MODE, LEGACY_OPERATOR_AUTH_MODE].includes(
            stringValue(snapshot.mode)
        ) &&
        stringValue(snapshot.transport) === '' &&
        stringValue(snapshot.status) !== ''
    );
}

function normalizeOperatorAuthSnapshot(url, name, response) {
    const payload = safeJsonParse(response.text);
    const configuration =
        payload && typeof payload.configuration === 'object'
            ? payload.configuration
            : null;

    return {
        url,
        name,
        reachable: response.ok === true,
        json_valid: payload !== null,
        contract_valid: testOperatorAuthContractPayload(payload),
        http_status: Number(response.status || 0),
        error: stringValue(response.error),
        raw_body: String(response.text || ''),
        payload_error: payload ? stringValue(payload.error) : '',
        ok: payload ? payload.ok !== false : false,
        authenticated: payload ? payload.authenticated === true : false,
        mode: payload ? stringValue(payload.mode) : '',
        transport: payload ? stringValue(payload.transport) : '',
        status: payload ? stringValue(payload.status) : '',
        configured: payload ? payload.configured !== false : false,
        recommended_mode: payload ? stringValue(payload.recommendedMode) : '',
        helper_base_url: configuration
            ? stringValue(configuration.helperBaseUrl)
            : '',
        bridge_token_configured: configuration
            ? booleanValue(configuration.bridgeTokenConfigured)
            : false,
        bridge_secret_configured: configuration
            ? booleanValue(configuration.bridgeSecretConfigured)
            : false,
        allowlist_configured: configuration
            ? booleanValue(configuration.allowlistConfigured)
            : false,
        broker_authorize_url_configured: configuration
            ? booleanValue(configuration.brokerAuthorizeUrlConfigured)
            : false,
        broker_token_url_configured: configuration
            ? booleanValue(configuration.brokerTokenUrlConfigured)
            : false,
        broker_userinfo_url_configured: configuration
            ? booleanValue(configuration.brokerUserinfoUrlConfigured)
            : false,
        broker_client_id_configured: configuration
            ? booleanValue(configuration.brokerClientIdConfigured)
            : false,
        broker_trust_configured: configuration
            ? booleanValue(configuration.brokerTrustConfigured)
            : false,
        broker_issuer_pinned: configuration
            ? booleanValue(configuration.brokerIssuerPinned)
            : false,
        broker_audience_pinned: configuration
            ? booleanValue(configuration.brokerAudiencePinned)
            : false,
        broker_jwks_configured: configuration
            ? booleanValue(configuration.brokerJwksConfigured)
            : false,
        broker_email_verified_required: configuration
            ? booleanValue(configuration.brokerEmailVerifiedRequired, true)
            : true,
        missing: configuration ? ensureArray(configuration.missing) : [],
    };
}

function mergeResolvedSnapshot(resolved, snapshot, source) {
    resolved.source = source;
    resolved.contract_valid = snapshot.contract_valid === true;
    resolved.ok = snapshot.ok === true;
    resolved.authenticated = snapshot.authenticated === true;
    resolved.mode = stringValue(snapshot.mode);
    resolved.transport = stringValue(snapshot.transport);
    resolved.status = stringValue(snapshot.status);
    resolved.configured = snapshot.configured === true;
    resolved.recommended_mode = stringValue(snapshot.recommended_mode);
    resolved.helper_base_url = stringValue(snapshot.helper_base_url);
    resolved.missing = ensureArray(snapshot.missing);
    resolved.broker_trust_configured =
        snapshot.broker_trust_configured === true;
    resolved.broker_issuer_pinned = snapshot.broker_issuer_pinned === true;
    resolved.broker_audience_pinned =
        snapshot.broker_audience_pinned === true;
    resolved.broker_jwks_configured = snapshot.broker_jwks_configured === true;
    resolved.broker_email_verified_required =
        snapshot.broker_email_verified_required !== false;
}

function addDiagnosticWarning(report, message) {
    const normalized = stringValue(message);
    if (!normalized) {
        return;
    }

    report.warnings = ensureArray(report.warnings).concat([normalized]);
}

function formatMissingOperatorAuthEnv(missing) {
    const labels = {
        mode: 'AURORADERM_OPERATOR_AUTH_MODE=google_oauth',
        bridge_token: 'AURORADERM_OPERATOR_AUTH_BRIDGE_TOKEN',
        bridge_secret: 'AURORADERM_OPERATOR_AUTH_BRIDGE_SECRET',
        allowlist: 'AURORADERM_OPERATOR_AUTH_ALLOWLIST',
        broker_authorize_url: 'OPENCLAW_AUTH_BROKER_AUTHORIZE_URL',
        broker_token_url: 'OPENCLAW_AUTH_BROKER_TOKEN_URL',
        broker_userinfo_url: 'OPENCLAW_AUTH_BROKER_USERINFO_URL',
        broker_client_id: 'OPENCLAW_AUTH_BROKER_CLIENT_ID',
        broker_jwks_url: 'OPENCLAW_AUTH_BROKER_JWKS_URL',
        broker_expected_issuer: 'OPENCLAW_AUTH_BROKER_EXPECTED_ISSUER',
        broker_expected_audience: 'OPENCLAW_AUTH_BROKER_EXPECTED_AUDIENCE',
        broker_require_email_verified:
            'OPENCLAW_AUTH_BROKER_REQUIRE_EMAIL_VERIFIED=true',
    };

    return ensureArray(missing).map((item) => labels[item] || item);
}

function resolveOpenClawRolloutState(report) {
    const primary = report.operator_auth_status;
    const facade = report.admin_auth_facade;
    const resolved = report.resolved;
    const primaryValid = primary.contract_valid === true;
    const facadeValid = facade.contract_valid === true;

    if (primaryValid) {
        mergeResolvedSnapshot(resolved, primary, 'operator-auth-status');
    } else if (facadeValid) {
        mergeResolvedSnapshot(resolved, facade, 'admin-auth-facade');
    }

    if (primaryValid && facadeValid) {
        const surfaceMismatch =
            stringValue(primary.mode) !== stringValue(facade.mode) ||
            stringValue(primary.transport) !== stringValue(facade.transport) ||
            stringValue(primary.status) !== stringValue(facade.status) ||
            Boolean(primary.configured) !== Boolean(facade.configured);
        if (surfaceMismatch) {
            addDiagnosticWarning(
                report,
                'operator-auth-status y admin-auth.php?action=status no coinciden en mode/transport/status/configured.'
            );
        }
    }

    if (resolved.contract_valid === true) {
        if (!primaryValid && facadeValid) {
            report.diagnosis = 'facade_only_rollout';
            report.next_action =
                'Desplegar y estabilizar api.php?resource=operator-auth-status; la fachada admin-auth ya expone contrato auth, pero el surface canonico aun no.';
            return report;
        }

        if (resolved.mode !== CANONICAL_OPERATOR_AUTH_MODE) {
            report.diagnosis = 'operator_auth_mode_mismatch';
            report.next_action =
                'Activar AURORADERM_OPERATOR_AUTH_MODE=google_oauth en el entorno remoto.';
            return report;
        }

        if (resolved.transport !== 'web_broker') {
            report.diagnosis = 'transport_misconfigured';
            report.next_action =
                'Corregir el contrato auth para que admin-auth.php?action=status y operator-auth-status publiquen transport=web_broker en produccion.';
            return report;
        }

        if (resolved.configured !== true) {
            const missingEnv = formatMissingOperatorAuthEnv(resolved.missing);
            report.diagnosis = 'operator_auth_not_configured';
            report.next_action =
                missingEnv.length > 0
                    ? `Completar configuracion remota: ${missingEnv.join(', ')}.`
                    : 'Completar broker OAuth/OpenID y callback remoto del rollout Google en el entorno remoto.';
            return report;
        }

        if (
            resolved.transport === 'web_broker' &&
            (resolved.broker_trust_configured !== true ||
                resolved.broker_issuer_pinned !== true ||
                resolved.broker_audience_pinned !== true ||
                resolved.broker_jwks_configured !== true ||
                resolved.broker_email_verified_required !== true)
        ) {
            report.diagnosis = 'operator_auth_not_configured';
            report.next_action =
                'Completar trust OIDC del broker: JWKS, issuer, audience y email verificado obligatorio antes de pasar a operator_auth_ready.';
            return report;
        }

        if (ensureArray(report.warnings).length > 0) {
            report.diagnosis = 'surface_mismatch';
            report.next_action =
                'Alinear operator-auth-status y admin-auth.php?action=status para que publiquen el mismo contrato auth.';
            report.ok = false;
            return report;
        }

        report.diagnosis = 'operator_auth_ready';
        report.next_action =
            'El rollout Google web_broker ya esta listo; continuar con smoke web y gate admin.';
        report.ok = true;
        return report;
    }

    if (
        looksLikeOpenClawTransportDrift(primary) ||
        looksLikeOpenClawTransportDrift(facade)
    ) {
        report.diagnosis = 'transport_misconfigured';
        report.next_action =
            'Corregir el contrato auth para que admin-auth.php?action=status y operator-auth-status publiquen transport=web_broker.';
        return report;
    }

    if (
        facade.reachable === true &&
        facade.json_valid === true &&
        facade.contract_valid !== true
    ) {
        report.diagnosis = 'admin_auth_legacy_facade';
        report.next_action =
            'Desplegar la fachada admin-auth.php con contrato auth (mode/status/configured) y alinear operator-auth-status.';
        return report;
    }

    const primaryEdgeFailure = Number(primary.http_status || 0) >= 520;
    const facadeEdgeFailure = Number(facade.http_status || 0) >= 520;
    if (primaryEdgeFailure || facadeEdgeFailure) {
        const affectedSurfaces = [];
        if (primaryEdgeFailure) {
            affectedSurfaces.push('api.php?resource=operator-auth-status');
        }
        if (facadeEdgeFailure) {
            affectedSurfaces.push('admin-auth.php?action=status');
        }

        const statusLabel = Array.from(
            new Set(
                [primary.http_status, facade.http_status]
                    .map((value) => Number(value || 0))
                    .filter((value) => value > 0)
            )
        ).join(',');
        const hasCloudflare1033 =
            String(primary.raw_body || '').includes('1033') ||
            String(facade.raw_body || '').includes('1033');

        report.diagnosis = 'operator_auth_edge_failure';
        report.next_action = hasCloudflare1033
            ? `Revisar Cloudflare/origen para ${affectedSurfaces.join(' y ')}; el edge esta devolviendo HTTP ${statusLabel} con error code 1033 en lugar del JSON canonico.`
            : `Revisar Cloudflare/origen y el routing de ${affectedSurfaces.join(' y ')}; el edge esta devolviendo HTTP ${statusLabel} antes de llegar al contrato auth canonico.`;
        return report;
    }

    if (primary.reachable !== true) {
        if (Number(primary.http_status || 0) === 503) {
            report.diagnosis = 'operator_auth_status_unavailable';
            report.next_action =
                'Configurar y desplegar api.php?resource=operator-auth-status para este entorno remoto.';
            return report;
        }

        report.diagnosis = 'operator_auth_surface_unreachable';
        report.next_action =
            'Revisar conectividad o routing de api.php?resource=operator-auth-status en el dominio remoto.';
        return report;
    }

    if (primary.json_valid !== true) {
        report.diagnosis = 'operator_auth_status_invalid_json';
        report.next_action =
            'Corregir la respuesta JSON de api.php?resource=operator-auth-status.';
        return report;
    }

    report.diagnosis = 'unknown';
    report.next_action =
        'Revisar el payload remoto de operator_auth y volver a correr el diagnostico.';
    return report;
}

function writeJsonReport(reportPath, report) {
    const target = stringValue(reportPath);
    if (!target) {
        return;
    }

    mkdirSync(dirname(target), { recursive: true });
    writeFileSync(target, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
}

module.exports = {
    addDiagnosticWarning,
    fetchText,
    formatMissingOperatorAuthEnv,
    normalizeOperatorAuthSnapshot,
    resolveOpenClawRolloutState,
    safeJsonParse,
    stringValue,
    testOperatorAuthContractPayload,
    trimTrailingSlash,
    writeJsonReport,
};
