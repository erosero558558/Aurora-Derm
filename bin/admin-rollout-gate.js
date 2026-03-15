#!/usr/bin/env node
'use strict';

const { spawn } = require('child_process');
const {
    fetchText,
    normalizeOperatorAuthSnapshot,
    stringValue,
    trimTrailingSlash,
    writeJsonReport,
} = require('./lib/openclaw-auth-rollout.js');

const DEFAULT_DOMAIN = 'https://pielarmonia.com';
const DEFAULT_STAGE = 'stable';
const DEFAULT_REPORT_PATH = 'verification/last-admin-ui-rollout-gate.json';
const VALID_STAGES = new Set([
    'stable',
    'internal',
    'canary',
    'general',
    'rollback',
]);

function readFlagValue(argv, index) {
    if (index + 1 >= argv.length) {
        throw new Error(`Falta valor para ${argv[index]}`);
    }

    return String(argv[index + 1] || '').trim();
}

function parseCliArgs(argv = process.argv.slice(2)) {
    const options = {
        domain: DEFAULT_DOMAIN,
        stage: DEFAULT_STAGE,
        requireOpenClawAuth: false,
        allowFeatureApiFailure: false,
        allowMissingAdminFlag: false,
        skipRuntimeSmoke: false,
        reportPath: DEFAULT_REPORT_PATH,
    };

    for (let index = 0; index < argv.length; index += 1) {
        const raw = String(argv[index] || '').trim();
        if (!raw) {
            continue;
        }

        if (
            raw === '--require-openclaw-auth' ||
            raw === '--requireOpenClawAuth' ||
            raw === '-RequireOpenClawAuth'
        ) {
            options.requireOpenClawAuth = true;
            continue;
        }

        if (
            raw === '--allow-feature-api-failure' ||
            raw === '--allowFeatureApiFailure' ||
            raw === '-AllowFeatureApiFailure'
        ) {
            options.allowFeatureApiFailure = true;
            continue;
        }

        if (
            raw === '--allow-missing-admin-flag' ||
            raw === '--allowMissingAdminFlag' ||
            raw === '-AllowMissingAdminFlag'
        ) {
            options.allowMissingAdminFlag = true;
            continue;
        }

        if (
            raw === '--skip-runtime-smoke' ||
            raw === '--skipRuntimeSmoke' ||
            raw === '-SkipRuntimeSmoke'
        ) {
            options.skipRuntimeSmoke = true;
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

        if (raw.startsWith('--stage=')) {
            options.stage =
                raw.slice('--stage='.length).trim() || DEFAULT_STAGE;
            continue;
        }

        if (raw.startsWith('-Stage:')) {
            options.stage = raw.slice('-Stage:'.length).trim() || DEFAULT_STAGE;
            continue;
        }

        if (raw === '--stage' || raw === '-Stage') {
            options.stage = readFlagValue(argv, index) || DEFAULT_STAGE;
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
    options.stage = stringValue(options.stage || DEFAULT_STAGE).toLowerCase();
    options.reportPath = stringValue(options.reportPath || DEFAULT_REPORT_PATH);

    if (!VALID_STAGES.has(options.stage)) {
        throw new Error(`Stage invalido: ${options.stage}`);
    }

    return options;
}

function createOperatorAuthReport(base) {
    return {
        checked: false,
        url: `${base}/api.php?resource=operator-auth-status`,
        facade_url: `${base}/admin-auth.php?action=status`,
        source: '',
        ok: null,
        contract_valid: false,
        authenticated: false,
        http_status: 0,
        error: '',
        facade_http_status: 0,
        facade_error: '',
        mode: '',
        transport: '',
        status: '',
        configured: false,
        helper_base_url: '',
        bridge_token_configured: false,
        bridge_secret_configured: false,
        allowlist_configured: false,
        broker_authorize_url_configured: false,
        broker_token_url_configured: false,
        broker_userinfo_url_configured: false,
        broker_client_id_configured: false,
        missing: [],
    };
}

function applySnapshotToOperatorAuth(target, snapshot, source) {
    target.source = source;
    target.ok = snapshot.ok === true;
    target.contract_valid = snapshot.contract_valid === true;
    target.authenticated = snapshot.authenticated === true;
    target.mode = stringValue(snapshot.mode);
    target.transport = stringValue(snapshot.transport);
    target.status = stringValue(snapshot.status);
    target.configured = snapshot.configured === true;
    target.helper_base_url = stringValue(snapshot.helper_base_url);
    target.bridge_token_configured = snapshot.bridge_token_configured === true;
    target.bridge_secret_configured =
        snapshot.bridge_secret_configured === true;
    target.allowlist_configured = snapshot.allowlist_configured === true;
    target.broker_authorize_url_configured =
        snapshot.broker_authorize_url_configured === true;
    target.broker_token_url_configured =
        snapshot.broker_token_url_configured === true;
    target.broker_userinfo_url_configured =
        snapshot.broker_userinfo_url_configured === true;
    target.broker_client_id_configured =
        snapshot.broker_client_id_configured === true;
    target.missing = Array.isArray(snapshot.missing)
        ? [...snapshot.missing]
        : [];
}

async function runPlaywrightSmokeSuite(name, specs, baseUrl) {
    const specList = (Array.isArray(specs) ? specs : [])
        .map((spec) => stringValue(spec))
        .filter(Boolean);

    if (specList.length === 0) {
        return {
            name,
            ok: true,
            exit_code: 0,
            specs: [],
        };
    }

    process.stdout.write(
        `[SMOKE] ${name} -> ${specList.join(', ')} @ ${baseUrl}\n`
    );

    const env = {
        ...process.env,
        TEST_BASE_URL: baseUrl,
        TEST_REUSE_EXISTING_SERVER: '0',
    };

    return new Promise((resolvePromise, rejectPromise) => {
        const child = spawn(
            process.platform === 'win32' ? 'npx.cmd' : 'npx',
            ['playwright', 'test', ...specList, '--workers=1'],
            {
                cwd: process.cwd(),
                env,
                stdio: 'inherit',
            }
        );

        child.on('error', rejectPromise);
        child.on('close', (code) => {
            const ok = Number(code || 0) === 0;
            process.stdout.write(
                ok ? `[OK]  ${name} en verde.\n` : `[FAIL] ${name} fallo.\n`
            );
            resolvePromise({
                name,
                ok,
                exit_code: Number(code || 0),
                specs: specList,
            });
        });
    });
}

async function buildGateReport(options = {}) {
    const base = trimTrailingSlash(options.domain || DEFAULT_DOMAIN);
    const report = {
        ok: false,
        timestamp_utc: new Date().toISOString(),
        domain: base,
        stage: options.stage || DEFAULT_STAGE,
        page: {
            url: `${base}/admin.html`,
            ok: false,
            http_status: 0,
            error: '',
        },
        assets: {
            has_admin_v3_css: false,
            uses_canonical_runtime: false,
            references_runtime_bridge: false,
            references_legacy_styles: false,
        },
        csp: {
            checked: false,
            meta_present: false,
            self_only_script: false,
            self_only_style: false,
            self_only_font: false,
        },
        operator_auth: createOperatorAuthReport(base),
        runtime_smoke: {
            executed: false,
            ok: null,
            base_url: '',
            suites: [],
        },
        failures: 0,
    };

    let failures = 0;

    process.stdout.write('== Gate Admin UI Rollout ==\n');
    process.stdout.write(`Dominio: ${base}\n`);
    process.stdout.write(`Stage: ${report.stage}\n`);

    const pageResult = await fetchText(report.page.url, {
        accept: 'text/html,application/json;q=0.9,*/*;q=0.8',
        userAgent: 'AdminUiRolloutGate/2.0',
    });
    report.page.ok = pageResult.ok === true;
    report.page.http_status = Number(pageResult.status || 0);
    report.page.error = stringValue(pageResult.error);

    if (!report.page.ok) {
        process.stdout.write(
            `[FAIL] admin.html -> HTTP ${report.page.http_status} (${report.page.error})\n`
        );
        failures += 1;
    } else {
        process.stdout.write(
            `[OK]  admin.html -> HTTP ${report.page.http_status}\n`
        );
    }

    const rawHtml = String(pageResult.text || '');
    report.assets.has_admin_v3_css = rawHtml.includes('admin-v3.css');
    report.assets.uses_canonical_runtime = rawHtml.includes('src="admin.js');
    report.assets.references_runtime_bridge = rawHtml.includes(
        'js/admin-runtime.js'
    );
    report.assets.references_legacy_styles =
        rawHtml.includes('styles.min.css') ||
        rawHtml.includes('admin.min.css') ||
        rawHtml.includes('admin.css') ||
        rawHtml.includes('admin-v2.css');

    if (report.assets.has_admin_v3_css) {
        process.stdout.write('[OK]  shell referencia admin-v3.css\n');
    } else {
        process.stdout.write('[FAIL] shell no referencia admin-v3.css\n');
        failures += 1;
    }

    if (report.assets.uses_canonical_runtime) {
        process.stdout.write('[OK]  shell referencia admin.js canonico\n');
    } else {
        process.stdout.write('[FAIL] shell no referencia admin.js canonico\n');
        failures += 1;
    }

    if (!report.assets.references_runtime_bridge) {
        process.stdout.write(
            '[OK]  shell no referencia runtime bridge heredado\n'
        );
    } else {
        process.stdout.write(
            '[FAIL] shell mantiene referencia a js/admin-runtime.js\n'
        );
        failures += 1;
    }

    if (!report.assets.references_legacy_styles) {
        process.stdout.write('[OK]  shell sin referencias CSS legacy\n');
    } else {
        process.stdout.write('[FAIL] shell mantiene referencias CSS legacy\n');
        failures += 1;
    }

    report.csp.checked = true;
    report.csp.meta_present = rawHtml.includes('Content-Security-Policy');
    report.csp.self_only_script = rawHtml.includes("script-src 'self'");
    report.csp.self_only_style = rawHtml.includes("style-src 'self'");
    report.csp.self_only_font = rawHtml.includes("font-src 'self'");

    if (
        report.csp.meta_present &&
        report.csp.self_only_script &&
        report.csp.self_only_style &&
        report.csp.self_only_font
    ) {
        process.stdout.write('[OK]  CSP admin endurecida\n');
    } else {
        process.stdout.write('[FAIL] CSP admin incompleta\n');
        failures += 1;
    }

    report.operator_auth.checked = true;
    const primaryResponse = await fetchText(report.operator_auth.url);
    const primarySnapshot = normalizeOperatorAuthSnapshot(
        report.operator_auth.url,
        'operator-auth-status',
        primaryResponse
    );
    report.operator_auth.http_status = Number(primarySnapshot.http_status || 0);
    report.operator_auth.error = stringValue(primarySnapshot.error);

    let operatorAuthResolved = false;
    if (primaryResponse.ok) {
        if (primarySnapshot.json_valid) {
            applySnapshotToOperatorAuth(
                report.operator_auth,
                primarySnapshot,
                'operator-auth-status'
            );
            operatorAuthResolved = report.operator_auth.contract_valid === true;

            if (operatorAuthResolved) {
                process.stdout.write(
                    `[INFO] operator_auth source=${report.operator_auth.source} mode=${report.operator_auth.mode} transport=${report.operator_auth.transport} status=${report.operator_auth.status} configured=${report.operator_auth.configured}\n`
                );
            } else {
                process.stdout.write(
                    '[WARN] operator_auth-status respondio, pero no expone el contrato OpenClaw esperado.\n'
                );
            }
        } else {
            report.operator_auth.ok = false;
            process.stdout.write(
                '[WARN] operator_auth-status no devolvio JSON interpretable.\n'
            );
        }
    } else {
        report.operator_auth.ok = false;
        process.stdout.write(
            `[WARN] operator_auth-status no respondio correctamente (HTTP ${report.operator_auth.http_status}): ${report.operator_auth.error}\n`
        );
    }

    if (!operatorAuthResolved) {
        const facadeResponse = await fetchText(report.operator_auth.facade_url);
        const facadeSnapshot = normalizeOperatorAuthSnapshot(
            report.operator_auth.facade_url,
            'admin-auth-facade',
            facadeResponse
        );
        report.operator_auth.facade_http_status = Number(
            facadeSnapshot.http_status || 0
        );
        report.operator_auth.facade_error = stringValue(facadeSnapshot.error);

        if (facadeResponse.ok) {
            if (facadeSnapshot.json_valid) {
                if (facadeSnapshot.contract_valid) {
                    applySnapshotToOperatorAuth(
                        report.operator_auth,
                        facadeSnapshot,
                        'admin-auth-facade'
                    );
                    process.stdout.write(
                        `[INFO] operator_auth source=${report.operator_auth.source} mode=${report.operator_auth.mode} transport=${report.operator_auth.transport} status=${report.operator_auth.status} configured=${report.operator_auth.configured}\n`
                    );
                } else {
                    applySnapshotToOperatorAuth(
                        report.operator_auth,
                        facadeSnapshot,
                        'admin-auth-facade-legacy'
                    );
                    process.stdout.write(
                        '[WARN] admin-auth facade respondio, pero sigue en contrato legacy sin mode/status OpenClaw.\n'
                    );
                }
            } else {
                process.stdout.write(
                    '[WARN] admin-auth facade no devolvio JSON interpretable.\n'
                );
            }
        } else {
            process.stdout.write(
                `[WARN] admin-auth facade no respondio correctamente (HTTP ${report.operator_auth.facade_http_status}): ${report.operator_auth.facade_error}\n`
            );
        }
    }

    if (options.requireOpenClawAuth) {
        if (
            report.operator_auth.contract_valid &&
            report.operator_auth.mode === 'openclaw_chatgpt' &&
            report.operator_auth.configured
        ) {
            process.stdout.write('[OK]  operator auth OpenClaw configurado\n');
        } else {
            if (!report.operator_auth.contract_valid) {
                process.stdout.write(
                    `[WARN] operator auth sin contrato OpenClaw valido. source=${report.operator_auth.source}\n`
                );
            }
            process.stdout.write(
                '[FAIL] operator auth OpenClaw no esta configurado para este rollout\n'
            );
            failures += 1;
        }
    }

    if (!options.skipRuntimeSmoke) {
        report.runtime_smoke.executed = true;
        report.runtime_smoke.base_url = base;

        const runtimeSuites = [
            {
                name: 'admin-ui-runtime',
                specs: ['tests/admin-ui-runtime-smoke.spec.js'],
            },
            {
                name: 'admin-v3-runtime',
                specs: ['tests/admin-v3-canary-runtime.spec.js'],
            },
            {
                name: 'admin-openclaw-auth',
                specs: ['tests/admin-openclaw-login.spec.js'],
            },
        ];

        let runtimeOk = true;
        for (const suite of runtimeSuites) {
            const suiteResult = await runPlaywrightSmokeSuite(
                suite.name,
                suite.specs,
                base
            );
            report.runtime_smoke.suites.push({
                name: suiteResult.name,
                ok: suiteResult.ok === true,
                exit_code: Number(suiteResult.exit_code || 0),
                specs: [...suiteResult.specs],
            });
            if (!suiteResult.ok) {
                runtimeOk = false;
                failures += 1;
            }
        }

        report.runtime_smoke.ok = runtimeOk;
    } else {
        process.stdout.write('[INFO] Runtime smoke omitido por flag.\n');
    }

    report.failures = failures;
    report.ok = failures === 0;
    return report;
}

async function main(argv = process.argv.slice(2)) {
    const options = parseCliArgs(argv);
    const report = await buildGateReport(options);

    try {
        writeJsonReport(options.reportPath, report);
        process.stdout.write(
            `[INFO] Reporte escrito en ${options.reportPath}\n`
        );
    } catch (error) {
        process.stdout.write(
            `[WARN] No se pudo escribir reporte: ${error instanceof Error ? error.message : String(error)}\n`
        );
    }

    if (report.ok) {
        process.stdout.write('[OK]  Gate admin rollout en verde.\n');
        process.exitCode = 0;
        return;
    }

    process.stdout.write(
        `[FAIL] Gate admin rollout fallo con ${report.failures} incidencia(s).\n`
    );
    process.exitCode = 1;
}

if (require.main === module) {
    main().catch((error) => {
        console.error(error instanceof Error ? error.message : String(error));
        process.exitCode = 1;
    });
}

module.exports = {
    buildGateReport,
    parseCliArgs,
    runPlaywrightSmokeSuite,
};
