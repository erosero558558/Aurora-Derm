#!/usr/bin/env node
'use strict';

const { existsSync, lstatSync, rmSync } = require('node:fs');
const { relative, resolve } = require('node:path');

const LOCAL_ARTIFACT_TARGETS = [
    { path: 'cookies.txt', label: 'cookies.txt' },
    { path: '.lighthouseci', label: '.lighthouseci/' },
    { path: 'lhci_reports', label: 'lhci_reports/' },
    { path: '_deploy_bundle', label: '_deploy_bundle/' },
    { path: 'playwright-report', label: 'playwright-report/' },
    { path: 'test-results', label: 'test-results/' },
    { path: 'php_server.log', label: 'php_server.log' },
    { path: '.php-cs-fixer.cache', label: '.php-cs-fixer.cache' },
    { path: '.phpunit.cache', label: '.phpunit.cache/' },
    { path: 'coverage.xml', label: 'coverage.xml' },
];

function parseCliArgs(argv) {
    const options = {
        dryRun: false,
        quiet: false,
        root: '',
    };

    for (let index = 0; index < argv.length; index += 1) {
        const value = String(argv[index] || '').trim();
        if (!value) continue;

        if (value === '--dry-run') {
            options.dryRun = true;
            continue;
        }

        if (value === '--quiet') {
            options.quiet = true;
            continue;
        }

        if (value === '--root') {
            const nextValue = String(argv[index + 1] || '').trim();
            if (nextValue) {
                options.root = nextValue;
                index += 1;
            }
            continue;
        }

        if (value.startsWith('--root=')) {
            options.root = value.slice('--root='.length).trim();
        }
    }

    return options;
}

function toRepoRelativePath(rootPath, absolutePath) {
    return relative(rootPath, absolutePath).replace(/\\/g, '/');
}

function collectExistingArtifacts(rootPath) {
    return LOCAL_ARTIFACT_TARGETS.map((target) => {
        const absolutePath = resolve(rootPath, target.path);
        if (!existsSync(absolutePath)) {
            return null;
        }

        const stats = lstatSync(absolutePath);
        return {
            ...target,
            absolutePath,
            relativePath: toRepoRelativePath(rootPath, absolutePath),
            type: stats.isDirectory() ? 'directory' : 'file',
        };
    }).filter(Boolean);
}

function cleanArtifacts(artifacts, options = {}) {
    const dryRun = Boolean(options.dryRun);
    const removed = [];
    const failures = [];

    for (const artifact of artifacts) {
        try {
            if (!dryRun) {
                rmSync(artifact.absolutePath, {
                    recursive: true,
                    force: true,
                });
            }
            removed.push(artifact);
        } catch (error) {
            failures.push({
                artifact,
                error,
            });
        }
    }

    return {
        removed,
        failures,
    };
}

function main() {
    const cli = parseCliArgs(process.argv.slice(2));
    const rootPath = cli.root
        ? resolve(process.cwd(), cli.root)
        : resolve(__dirname, '..');

    const log = (message) => {
        if (!cli.quiet) {
            process.stdout.write(`${message}\n`);
        }
    };
    const warn = (message) => {
        process.stderr.write(`${message}\n`);
    };

    const artifacts = collectExistingArtifacts(rootPath);
    if (artifacts.length === 0) {
        log('[local-artifacts] No hay artefactos locales para limpiar.');
        process.exit(0);
    }

    const result = cleanArtifacts(artifacts, { dryRun: cli.dryRun });
    if (result.failures.length > 0) {
        for (const failure of result.failures) {
            warn(
                `[local-artifacts] No se pudo limpiar ${failure.artifact.label}: ${failure.error.message}`
            );
        }
        process.exit(1);
    }

    const labels = result.removed.map((artifact) => artifact.label).join(', ');
    if (cli.dryRun) {
        log(
            `[local-artifacts] DRY RUN. Se eliminarian ${result.removed.length} artefacto(s): ${labels}`
        );
        process.exit(0);
    }

    for (const artifact of result.removed) {
        log(`[local-artifacts] Eliminado: ${artifact.label}`);
    }

    log(
        `[local-artifacts] Limpieza completada. Eliminados ${result.removed.length} artefacto(s).`
    );
}

if (require.main === module) {
    main();
}

module.exports = {
    LOCAL_ARTIFACT_TARGETS,
    cleanArtifacts,
    collectExistingArtifacts,
    parseCliArgs,
};
