#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const {
    GENERATED_SITE_ROOT,
    REPO_ROOT,
} = require('./lib/generated-site-root.js');

const ROOT = REPO_ROOT;
const DEFAULT_OUTPUT = path.join(
    ROOT,
    'verification',
    'turnero-runtime',
    'runtime-artifacts-report.json'
);

const SOURCE_CHECKS = [
    {
        file: 'src/apps/queue-shared/turnero-runtime-contract.mjs',
        requiredTokens: [
            'buildTurneroSurfaceRuntimeStatus',
            'getTurneroActiveClinicId',
            'getTurneroActiveClinicProfile',
            'getTurneroActiveClinicProfileMeta',
            'hasRecentQueueSmokeSignalForState',
        ],
    },
    {
        file: 'src/apps/queue-operator/index.js',
        requiredTokens: [
            'turnero-runtime-contract.mjs',
            'buildTurneroSurfaceRuntimeStatus',
        ],
        forbiddenImportPattern: /from\s+['"][^'"]*clinic-profile\.js['"]/,
    },
    {
        file: 'src/apps/queue-kiosk/index.js',
        requiredTokens: [
            'turnero-runtime-contract.mjs',
            'buildTurneroSurfaceRuntimeStatus',
        ],
        forbiddenImportPattern: /from\s+['"][^'"]*clinic-profile\.js['"]/,
    },
    {
        file: 'src/apps/queue-display/index.js',
        requiredTokens: [
            'turnero-runtime-contract.mjs',
            'buildTurneroSurfaceRuntimeStatus',
        ],
        forbiddenImportPattern: /from\s+['"][^'"]*clinic-profile\.js['"]/,
    },
    {
        file: 'src/apps/admin-v3/shared/modules/queue/pilot-guard.js',
        requiredTokens: ['turnero-runtime-contract.mjs'],
        forbiddenImportPattern: /from\s+['"][^'"]*clinic-profile\.js['"]/,
    },
    {
        file: 'src/apps/admin-v3/shared/modules/queue/persistence.js',
        requiredTokens: ['turnero-runtime-contract.mjs'],
        forbiddenImportPattern: /from\s+['"][^'"]*clinic-profile\.js['"]/,
    },
    {
        file: 'src/apps/admin-v3/shared/modules/queue/render/section/install-hub.js',
        requiredTokens: ['turnero-runtime-contract.mjs'],
    },
    {
        file: 'src/apps/admin-v3/shared/modules/queue/render/section/install-hub/smoke-signal.js',
        requiredTokens: ['turnero-runtime-contract.mjs'],
        forbiddenImportPattern: /from\s+['"][^'"]*clinic-profile\.js['"]/,
    },
    {
        file: 'src/apps/queue-shared/admin-queue-pilot-readiness.js',
        requiredTokens: ['turnero-runtime-contract.mjs'],
        forbiddenImportPattern: /from\s+['"][^'"]*clinic-profile\.js['"]/,
    },
    {
        file: 'src/apps/queue-shared/turnero-surface-contract-snapshot.js',
        requiredTokens: ['turnero-runtime-contract.mjs'],
        forbiddenImportPattern: /from\s+['"][^'"]*clinic-profile\.js['"]/,
    },
    {
        file: 'src/apps/queue-shared/turnero-surface-runtime-watch.js',
        requiredTokens: ['turnero-runtime-contract.mjs'],
        forbiddenImportPattern: /from\s+['"][^'"]*clinic-profile\.js['"]/,
    },
];

const BUNDLE_SIGNATURES = [
    {
        file: 'js/queue-operator.js',
        requiredTokens: [
            '/content/turnero/clinic-profile.json',
            '/operador-turnos.html',
            'turnero-clinic-profile/v1',
        ],
    },
    {
        file: 'js/queue-kiosk.js',
        requiredTokens: [
            '/content/turnero/clinic-profile.json',
            '/kiosco-turnos.html',
            'turnero-clinic-profile/v1',
        ],
    },
    {
        file: 'js/queue-display.js',
        requiredTokens: [
            '/content/turnero/clinic-profile.json',
            '/sala-turnos.html',
            'turnero-clinic-profile/v1',
        ],
    },
];

const PUBLIC_RUNTIME_CHECKER_NAME = ['check-public-runtime-artifacts', 'js'].join(
    '.'
);

function parseArgs(argv) {
    const args = {
        root: GENERATED_SITE_ROOT,
        sourceRoot: ROOT,
        output: DEFAULT_OUTPUT,
        scriptPath: __filename,
        json: false,
        quiet: false,
    };

    for (let index = 0; index < argv.length; index += 1) {
        const token = String(argv[index] || '').trim();
        if (!token) {
            continue;
        }

        if (token === '--root') {
            const nextValue = String(argv[index + 1] || '').trim();
            if (nextValue) {
                args.root = path.resolve(ROOT, nextValue);
                index += 1;
            }
            continue;
        }

        if (token.startsWith('--root=')) {
            args.root = path.resolve(ROOT, token.slice('--root='.length).trim());
            continue;
        }

        if (token === '--source-root') {
            const nextValue = String(argv[index + 1] || '').trim();
            if (nextValue) {
                args.sourceRoot = path.resolve(ROOT, nextValue);
                index += 1;
            }
            continue;
        }

        if (token.startsWith('--source-root=')) {
            args.sourceRoot = path.resolve(
                ROOT,
                token.slice('--source-root='.length).trim()
            );
            continue;
        }

        if (token === '--output') {
            const nextValue = String(argv[index + 1] || '').trim();
            if (nextValue) {
                args.output = path.resolve(ROOT, nextValue);
                index += 1;
            }
            continue;
        }

        if (token.startsWith('--output=')) {
            args.output = path.resolve(
                ROOT,
                token.slice('--output='.length).trim()
            );
            continue;
        }

        if (token === '--script-path') {
            const nextValue = String(argv[index + 1] || '').trim();
            if (nextValue) {
                args.scriptPath = path.resolve(ROOT, nextValue);
                index += 1;
            }
            continue;
        }

        if (token.startsWith('--script-path=')) {
            args.scriptPath = path.resolve(
                ROOT,
                token.slice('--script-path='.length).trim()
            );
            continue;
        }

        if (token === '--json') {
            args.json = true;
            continue;
        }

        if (token === '--quiet') {
            args.quiet = true;
        }
    }

    return args;
}

function writeReport(outputPath, report) {
    fs.mkdirSync(path.dirname(outputPath), { recursive: true });
    fs.writeFileSync(outputPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
}

function readText(filePath) {
    try {
        return fs.readFileSync(filePath, 'utf8');
    } catch (_error) {
        return null;
    }
}

function inspectSelfProxy(scriptPath) {
    const source = readText(scriptPath) || '';
    return {
        proxyDetected:
            source.includes(`require('./${PUBLIC_RUNTIME_CHECKER_NAME}')`) ||
            source.includes(`require("./${PUBLIC_RUNTIME_CHECKER_NAME}")`),
    };
}

function inspectSourceWiring(sourceRoot) {
    const diagnostics = [];
    const sourceChecks = SOURCE_CHECKS.map((check) => {
        const absolutePath = path.resolve(sourceRoot, check.file);
        const source = readText(absolutePath);
        const exists = source !== null;
        const missingTokens = [];
        let forbiddenMatch = '';

        if (!exists) {
            diagnostics.push({
                code: 'turnero_source_file_missing',
                file: check.file,
            });
            return {
                file: check.file,
                exists: false,
                requiredTokens: check.requiredTokens || [],
                missingTokens: check.requiredTokens || [],
                forbiddenMatch: '',
            };
        }

        for (const token of check.requiredTokens || []) {
            if (!source.includes(token)) {
                missingTokens.push(token);
            }
        }

        if (
            check.forbiddenImportPattern &&
            check.forbiddenImportPattern.test(source)
        ) {
            forbiddenMatch = String(check.forbiddenImportPattern);
        }

        if (missingTokens.length > 0) {
            diagnostics.push({
                code: 'turnero_source_wiring_missing',
                file: check.file,
                missingTokens,
            });
        }

        if (forbiddenMatch) {
            diagnostics.push({
                code: 'turnero_legacy_clinic_profile_import',
                file: check.file,
                pattern: forbiddenMatch,
            });
        }

        return {
            file: check.file,
            exists: true,
            requiredTokens: check.requiredTokens || [],
            missingTokens,
            forbiddenMatch,
        };
    });

    return {
        sourceChecks,
        diagnostics,
    };
}

function inspectBundles(root) {
    const diagnostics = [];
    const bundleChecks = BUNDLE_SIGNATURES.map((bundle) => {
        const absolutePath = path.resolve(root, bundle.file);
        const text = readText(absolutePath);
        const exists = text !== null;
        const missingTokens = [];

        if (!exists) {
            diagnostics.push({
                code: 'turnero_runtime_bundle_missing',
                file: bundle.file,
            });
            return {
                file: bundle.file,
                exists: false,
                requiredTokens: bundle.requiredTokens || [],
                missingTokens: bundle.requiredTokens || [],
            };
        }

        for (const token of bundle.requiredTokens || []) {
            if (!text.includes(token)) {
                missingTokens.push(token);
            }
        }

        if (missingTokens.length > 0) {
            diagnostics.push({
                code: 'turnero_runtime_bundle_signature_missing',
                file: bundle.file,
                missingTokens,
            });
        }

        return {
            file: bundle.file,
            exists: true,
            requiredTokens: bundle.requiredTokens || [],
            missingTokens,
        };
    });

    return {
        bundleChecks,
        diagnostics,
    };
}

function inspectTurneroRuntimeArtifacts({ root, sourceRoot, scriptPath }) {
    const sourceChecks = inspectSourceWiring(sourceRoot);
    const bundleChecks = inspectBundles(root);
    const selfCheck = inspectSelfProxy(scriptPath);
    const diagnostics = [
        ...sourceChecks.diagnostics,
        ...bundleChecks.diagnostics,
    ];

    if (selfCheck.proxyDetected) {
        diagnostics.push({
            code: 'turnero_runtime_proxy_public_checker_detected',
            file: path.relative(ROOT, scriptPath) || path.basename(scriptPath),
        });
    }

    return {
        generatedAt: new Date().toISOString(),
        rootPath: root,
        sourceRootPath: sourceRoot,
        passed: diagnostics.length === 0,
        selfCheck,
        sourceChecks: sourceChecks.sourceChecks,
        bundleChecks: bundleChecks.bundleChecks,
        diagnostics,
    };
}

function main() {
    const args = parseArgs(process.argv.slice(2));
    const inspectionRoot = args.root
        ? path.resolve(args.root)
        : GENERATED_SITE_ROOT;
    const sourceRoot = args.sourceRoot
        ? path.resolve(args.sourceRoot)
        : ROOT;
    const report = inspectTurneroRuntimeArtifacts({
        root: inspectionRoot,
        sourceRoot,
        scriptPath: args.scriptPath || __filename,
    });
    const outputPath = args.output
        ? path.resolve(args.output)
        : DEFAULT_OUTPUT;

    const serializableReport = {
        generatedAt: report.generatedAt,
        reportPath: outputPath,
        passed: report.passed,
        rootPath: report.rootPath,
        sourceRootPath: report.sourceRootPath,
        selfCheck: report.selfCheck,
        sourceChecks: report.sourceChecks,
        bundleChecks: report.bundleChecks,
        diagnostics: report.diagnostics,
    };

    writeReport(outputPath, serializableReport);

    if (args.json) {
        process.stdout.write(`${JSON.stringify(serializableReport, null, 2)}\n`);
    } else if (!args.quiet) {
        if (serializableReport.passed) {
            process.stdout.write(
                `[turnero-runtime] OK: ${serializableReport.bundleChecks.length} bundle(s) con firma shared runtime. Report: ${path.relative(
                    ROOT,
                    outputPath
                )}\n`
            );
        } else {
            const codes = serializableReport.diagnostics
                .map((entry) => entry.code)
                .join(', ');
            process.stderr.write(
                `[turnero-runtime] Hallazgos en el runtime del turnero (${codes}). Report: ${path.relative(
                    ROOT,
                    outputPath
                )}\n`
            );
        }
    }

    if (!serializableReport.passed) {
        process.exitCode = 1;
    }
}

main();
