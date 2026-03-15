#!/usr/bin/env node
'use strict';

const {
    fetchText,
    normalizeOperatorAuthSnapshot,
    resolveOpenClawRolloutState,
    stringValue,
    trimTrailingSlash,
    writeJsonReport,
} = require('./lib/openclaw-auth-rollout.js');

const DEFAULT_DOMAIN = 'https://pielarmonia.com';
const DEFAULT_REPORT_PATH =
    'verification/last-admin-openclaw-auth-diagnostic.json';

function readFlagValue(argv, index) {
    if (index + 1 >= argv.length) {
        throw new Error(`Falta valor para ${argv[index]}`);
    }

    return String(argv[index + 1] || '').trim();
}

function parseCliArgs(argv = process.argv.slice(2)) {
    const options = {
        domain: DEFAULT_DOMAIN,
        json: false,
        allowNotReady: false,
        reportPath: DEFAULT_REPORT_PATH,
    };

    for (let index = 0; index < argv.length; index += 1) {
        const raw = String(argv[index] || '').trim();
        if (!raw) {
            continue;
        }

        if (raw === '--json' || raw === '-Json') {
            options.json = true;
            continue;
        }

        if (
            raw === '--allow-not-ready' ||
            raw === '--allowNotReady' ||
            raw === '-AllowNotReady'
        ) {
            options.allowNotReady = true;
            continue;
        }

        if (raw.startsWith('--domain=')) {
            options.domain =
                raw.slice('--domain='.length).trim() || DEFAULT_DOMAIN;
            continue;
        }

        if (raw.startsWith('-Domain:')) {
            options.domain =
                raw.slice('-Domain:'.length).trim() || DEFAULT_DOMAIN;
            continue;
        }

        if (raw === '--domain' || raw === '-Domain') {
            options.domain = readFlagValue(argv, index) || DEFAULT_DOMAIN;
            index += 1;
            continue;
        }

        if (raw.startsWith('--report-path=')) {
            options.reportPath =
                raw.slice('--report-path='.length).trim() ||
                DEFAULT_REPORT_PATH;
            continue;
        }

        if (raw.startsWith('--reportPath=')) {
            options.reportPath =
                raw.slice('--reportPath='.length).trim() || DEFAULT_REPORT_PATH;
            continue;
        }

        if (raw.startsWith('-ReportPath:')) {
            options.reportPath =
                raw.slice('-ReportPath:'.length).trim() || DEFAULT_REPORT_PATH;
            continue;
        }

        if (
            raw === '--report-path' ||
            raw === '--reportPath' ||
            raw === '-ReportPath'
        ) {
            options.reportPath =
                readFlagValue(argv, index) || DEFAULT_REPORT_PATH;
            index += 1;
            continue;
        }

        throw new Error(`Argumento no soportado: ${raw}`);
    }

    options.domain = trimTrailingSlash(options.domain || DEFAULT_DOMAIN);
    options.reportPath = stringValue(options.reportPath || DEFAULT_REPORT_PATH);
    return options;
}

async function buildDiagnosticReport(options = {}) {
    const base = trimTrailingSlash(options.domain || DEFAULT_DOMAIN);
    const report = {
        ok: false,
        checked_at_utc: new Date().toISOString(),
        domain: base,
        operator_auth_status: {
            url: `${base}/api.php?resource=operator-auth-status`,
            reachable: false,
            json_valid: false,
            contract_valid: false,
            http_status: 0,
            error: '',
            raw_body: '',
            payload_error: '',
            ok: false,
            authenticated: false,
            mode: '',
            transport: '',
            status: '',
            configured: false,
            recommended_mode: '',
            helper_base_url: '',
            bridge_token_configured: false,
            bridge_secret_configured: false,
            allowlist_configured: false,
            broker_authorize_url_configured: false,
            broker_token_url_configured: false,
            broker_userinfo_url_configured: false,
            broker_client_id_configured: false,
            missing: [],
        },
        admin_auth_facade: {
            url: `${base}/admin-auth.php?action=status`,
            reachable: false,
            json_valid: false,
            contract_valid: false,
            http_status: 0,
            error: '',
            raw_body: '',
            payload_error: '',
            ok: false,
            authenticated: false,
            mode: '',
            transport: '',
            status: '',
            configured: false,
            recommended_mode: '',
            helper_base_url: '',
            bridge_token_configured: false,
            bridge_secret_configured: false,
            allowlist_configured: false,
            broker_authorize_url_configured: false,
            broker_token_url_configured: false,
            broker_userinfo_url_configured: false,
            broker_client_id_configured: false,
            missing: [],
        },
        resolved: {
            source: '',
            contract_valid: false,
            ok: false,
            authenticated: false,
            mode: '',
            transport: '',
            status: '',
            configured: false,
            recommended_mode: '',
            helper_base_url: '',
            missing: [],
        },
        diagnosis: '',
        next_action: '',
        warnings: [],
    };

    const [primaryResponse, facadeResponse] = await Promise.all([
        fetchText(report.operator_auth_status.url),
        fetchText(report.admin_auth_facade.url),
    ]);

    report.operator_auth_status = normalizeOperatorAuthSnapshot(
        report.operator_auth_status.url,
        'operator-auth-status',
        primaryResponse
    );
    report.admin_auth_facade = normalizeOperatorAuthSnapshot(
        report.admin_auth_facade.url,
        'admin-auth-facade',
        facadeResponse
    );

    return resolveOpenClawRolloutState(report);
}

function renderSummary(report) {
    process.stdout.write('== Diagnostico OpenClaw Auth Rollout ==\n');
    process.stdout.write(`Dominio: ${report.domain}\n`);
    process.stdout.write(
        `[INFO] operator-auth-status http=${report.operator_auth_status.http_status} reachable=${report.operator_auth_status.reachable} contract=${report.operator_auth_status.contract_valid} mode=${report.operator_auth_status.mode} transport=${report.operator_auth_status.transport} status=${report.operator_auth_status.status} configured=${report.operator_auth_status.configured}\n`
    );
    if (stringValue(report.operator_auth_status.error)) {
        process.stdout.write(
            `[WARN] operator-auth-status error: ${report.operator_auth_status.error}\n`
        );
    }
    if (stringValue(report.operator_auth_status.payload_error)) {
        process.stdout.write(
            `[WARN] operator-auth-status payload_error: ${report.operator_auth_status.payload_error}\n`
        );
    }

    process.stdout.write(
        `[INFO] admin-auth facade http=${report.admin_auth_facade.http_status} reachable=${report.admin_auth_facade.reachable} contract=${report.admin_auth_facade.contract_valid} mode=${report.admin_auth_facade.mode} transport=${report.admin_auth_facade.transport} status=${report.admin_auth_facade.status} configured=${report.admin_auth_facade.configured}\n`
    );
    if (stringValue(report.admin_auth_facade.error)) {
        process.stdout.write(
            `[WARN] admin-auth facade error: ${report.admin_auth_facade.error}\n`
        );
    }
    if (stringValue(report.admin_auth_facade.payload_error)) {
        process.stdout.write(
            `[WARN] admin-auth facade payload_error: ${report.admin_auth_facade.payload_error}\n`
        );
    }

    for (const warning of report.warnings || []) {
        if (stringValue(warning)) {
            process.stdout.write(`[WARN] ${warning}\n`);
        }
    }

    if (report.ok) {
        process.stdout.write(
            `[OK]  rollout OpenClaw listo (source=${report.resolved.source}, helper=${report.resolved.helper_base_url})\n`
        );
    } else {
        process.stdout.write(`[FAIL] diagnostico=${report.diagnosis}\n`);
    }
    process.stdout.write(`[INFO] nextAction=${report.next_action}\n`);
}

async function main(argv = process.argv.slice(2)) {
    const options = parseCliArgs(argv);
    const report = await buildDiagnosticReport(options);

    renderSummary(report);

    try {
        writeJsonReport(options.reportPath, report);
    } catch (error) {
        process.stdout.write(
            `[WARN] No se pudo escribir reporte: ${error instanceof Error ? error.message : String(error)}\n`
        );
    }

    if (options.json) {
        process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
    }

    process.exitCode = report.ok || options.allowNotReady ? 0 : 1;
}

if (require.main === module) {
    main().catch((error) => {
        console.error(error instanceof Error ? error.message : String(error));
        process.exitCode = 1;
    });
}

module.exports = {
    buildDiagnosticReport,
    parseCliArgs,
};
