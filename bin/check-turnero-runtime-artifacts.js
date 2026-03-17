#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const {
    REPO_ROOT,
    GENERATED_SITE_ROOT,
} = require('./lib/generated-site-root.js');
const {
    inspectTurneroRuntimeArtifacts,
    buildRuntimeReferencePattern,
} = require('./lib/turnero-runtime-artifacts.js');
const {
    startLocalPublicServer,
    stopLocalPublicServer,
} = require('./lib/public-v6-local-server.js');

const DEFAULT_OUTPUT = path.join(
    REPO_ROOT,
    'verification',
    'turnero',
    'runtime-artifacts-report.json'
);

function parseArgs(argv) {
    const args = {
        root: REPO_ROOT,
        runtimeRoot: GENERATED_SITE_ROOT,
        output: DEFAULT_OUTPUT,
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
                args.root = path.resolve(nextValue);
                index += 1;
            }
            continue;
        }

        if (token.startsWith('--root=')) {
            args.root = path.resolve(token.slice('--root='.length).trim());
            continue;
        }

        if (token === '--runtime-root') {
            const nextValue = String(argv[index + 1] || '').trim();
            if (nextValue) {
                args.runtimeRoot = path.resolve(nextValue);
                index += 1;
            }
            continue;
        }

        if (token.startsWith('--runtime-root=')) {
            args.runtimeRoot = path.resolve(
                token.slice('--runtime-root='.length).trim()
            );
            continue;
        }

        if (token === '--output') {
            const nextValue = String(argv[index + 1] || '').trim();
            if (nextValue) {
                args.output = path.resolve(nextValue);
                index += 1;
            }
            continue;
        }

        if (token.startsWith('--output=')) {
            args.output = path.resolve(token.slice('--output='.length).trim());
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
    fs.writeFileSync(
        outputPath,
        `${JSON.stringify(report, null, 2)}\n`,
        'utf8'
    );
}

async function fetchWithRetry(url, retries = 1) {
    let lastError = null;

    for (let attempt = 0; attempt <= retries; attempt += 1) {
        try {
            return await fetch(url, {
                redirect: 'manual',
                signal: AbortSignal.timeout(10000),
            });
        } catch (error) {
            lastError = error;
        }
    }

    throw lastError || new Error(`No se pudo consultar ${url}`);
}

async function collectServedChecks(baseUrl, inspection) {
    const diagnostics = [];
    const checks = [];

    for (const surface of inspection.surfaces) {
        const pageUrl = new URL(`/${surface.htmlPath}`, baseUrl).toString();
        const assetUrl = new URL(`/${surface.assetPath}`, baseUrl).toString();
        let shellHttpStatus = 0;
        let runtimeHttpStatus = 0;
        let shellContainsReference = false;
        let runtimeLooksLikeHtml = false;
        let runtimeContentType = '';
        let runtimeBodyLength = 0;

        try {
            const shellResponse = await fetchWithRetry(pageUrl);
            shellHttpStatus = shellResponse.status;
            const shellBody = await shellResponse.text();
            shellContainsReference = buildRuntimeReferencePattern(
                surface.assetPath
            ).test(shellBody);

            if (!(shellHttpStatus >= 200 && shellHttpStatus < 300)) {
                diagnostics.push({
                    code: 'served_shell_unreachable',
                    surface: surface.key,
                    message: `${surface.htmlPath} respondio HTTP ${shellHttpStatus}.`,
                });
            }

            if (!shellContainsReference) {
                diagnostics.push({
                    code: 'served_shell_missing_runtime_reference',
                    surface: surface.key,
                    message: `${surface.htmlPath} servida no referencia ${surface.assetPath}.`,
                });
            }
        } catch (error) {
            diagnostics.push({
                code: 'served_shell_fetch_failed',
                surface: surface.key,
                message: `${surface.htmlPath} no se pudo consultar: ${error instanceof Error ? error.message : String(error)}`,
            });
        }

        try {
            const runtimeResponse = await fetchWithRetry(assetUrl);
            runtimeHttpStatus = runtimeResponse.status;
            runtimeContentType = String(
                runtimeResponse.headers.get('content-type') || ''
            );
            const runtimeBody = await runtimeResponse.text();
            runtimeBodyLength = Buffer.byteLength(runtimeBody, 'utf8');
            runtimeLooksLikeHtml =
                /^\s*<!doctype html/i.test(runtimeBody) ||
                /^\s*<html/i.test(runtimeBody);

            if (!(runtimeHttpStatus >= 200 && runtimeHttpStatus < 300)) {
                diagnostics.push({
                    code: 'served_runtime_asset_unreachable',
                    surface: surface.key,
                    message: `${surface.assetPath} respondio HTTP ${runtimeHttpStatus}.`,
                });
            }

            if (
                runtimeHttpStatus >= 200 &&
                runtimeHttpStatus < 300 &&
                !/javascript|ecmascript/i.test(runtimeContentType)
            ) {
                diagnostics.push({
                    code: 'served_runtime_asset_wrong_content_type',
                    surface: surface.key,
                    message: `${surface.assetPath} respondio content-type no JS (${runtimeContentType || 'vacio'}).`,
                });
            }

            if (runtimeLooksLikeHtml) {
                diagnostics.push({
                    code: 'served_runtime_asset_looks_like_html',
                    surface: surface.key,
                    message: `${surface.assetPath} fue servido como HTML en lugar de JS.`,
                });
            }

            if (runtimeBodyLength <= 0) {
                diagnostics.push({
                    code: 'served_runtime_asset_empty',
                    surface: surface.key,
                    message: `${surface.assetPath} se sirvio vacio.`,
                });
            }
        } catch (error) {
            diagnostics.push({
                code: 'served_runtime_asset_fetch_failed',
                surface: surface.key,
                message: `${surface.assetPath} no se pudo consultar: ${error instanceof Error ? error.message : String(error)}`,
            });
        }

        checks.push({
            surface: surface.key,
            pageUrl,
            assetUrl,
            shellHttpStatus,
            shellContainsReference,
            runtimeHttpStatus,
            runtimeContentType,
            runtimeBodyLength,
            runtimeLooksLikeHtml,
            passed:
                shellHttpStatus >= 200 &&
                shellHttpStatus < 300 &&
                shellContainsReference &&
                runtimeHttpStatus >= 200 &&
                runtimeHttpStatus < 300 &&
                /javascript|ecmascript/i.test(runtimeContentType) &&
                runtimeLooksLikeHtml === false &&
                runtimeBodyLength > 0,
        });
    }

    return {
        diagnostics,
        checks,
        passed: diagnostics.length === 0,
    };
}

async function main() {
    const args = parseArgs(process.argv.slice(2));
    const inspection = inspectTurneroRuntimeArtifacts({
        root: args.root,
        runtimeRoot: args.runtimeRoot,
    });
    let serverInfo = null;
    let served = {
        baseUrl: '',
        diagnostics: [],
        checks: [],
        passed: false,
    };

    if (inspection.passed) {
        serverInfo = await startLocalPublicServer(args.root, {
            runtimeRoot: args.runtimeRoot,
        });
        try {
            served = await collectServedChecks(serverInfo.baseUrl, inspection);
            served.baseUrl = serverInfo.baseUrl.toString();
        } finally {
            await stopLocalPublicServer(serverInfo.server);
        }
    }

    const report = {
        generatedAt: new Date().toISOString(),
        rootPath: inspection.rootPath,
        runtimeRootPath: inspection.runtimeRootPath,
        outputPath: args.output,
        passed: inspection.passed && served.passed,
        diagnostics: [...inspection.diagnostics, ...served.diagnostics],
        surfaces: inspection.surfaces.map((surface) => ({
            key: surface.key,
            label: surface.label,
            htmlPath: surface.htmlPath,
            assetPath: surface.assetPath,
            htmlExists: surface.htmlExists,
            runtimeAssetExists: surface.runtimeAssetExists,
            htmlReferencesRuntimeAsset: surface.htmlReferencesRuntimeAsset,
            runtimeReferenceVersion: surface.runtimeReferenceVersion,
            runtimeAssetSizeBytes: surface.runtimeAssetSizeBytes,
        })),
        served,
    };

    writeReport(args.output, report);

    if (args.json) {
        process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
    } else if (!args.quiet) {
        if (report.passed) {
            process.stdout.write(
                `[turnero-runtime] OK: shells y runtime canónicos servidos correctamente. Report: ${path.relative(
                    REPO_ROOT,
                    args.output
                )}\n`
            );
        } else {
            const codes = report.diagnostics
                .map((entry) => entry.code)
                .join(', ');
            process.stderr.write(
                `[turnero-runtime] Hallazgos en runtime Turnero (${codes}). Report: ${path.relative(
                    REPO_ROOT,
                    args.output
                )}\n`
            );
        }
    }

    if (!report.passed) {
        process.exitCode = 1;
    }
}

main().catch((error) => {
    process.stderr.write(
        `[turnero-runtime] Fatal: ${
            error instanceof Error ? error.message : String(error)
        }\n`
    );
    process.exitCode = 1;
});
