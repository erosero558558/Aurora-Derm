'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { GENERATED_SITE_ROOT, REPO_ROOT } = require('./generated-site-root.js');

const TURNERO_RUNTIME_SURFACES = [
    {
        key: 'admin',
        label: 'Admin',
        htmlPath: 'admin.html',
        assetPath: 'admin.js',
    },
    {
        key: 'kiosk',
        label: 'Kiosco',
        htmlPath: 'kiosco-turnos.html',
        assetPath: 'js/queue-kiosk.js',
    },
    {
        key: 'display',
        label: 'Sala',
        htmlPath: 'sala-turnos.html',
        assetPath: 'js/queue-display.js',
    },
];

function escapeRegExp(value) {
    return String(value || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function toRepoRelativePath(rootPath, filePath) {
    return path.relative(rootPath, filePath).replace(/\\/g, '/');
}

function buildRuntimeReferencePattern(assetPath) {
    return new RegExp(
        `src=(['"])${escapeRegExp(assetPath)}\\?v=([^"'\\s>]+)\\1`,
        'i'
    );
}

function inspectTurneroRuntimeArtifacts(options = {}) {
    const rootPath = options.root ? path.resolve(options.root) : REPO_ROOT;
    const runtimeRootPath = options.runtimeRoot
        ? path.resolve(options.runtimeRoot)
        : GENERATED_SITE_ROOT;
    const diagnostics = [];
    const surfaces = TURNERO_RUNTIME_SURFACES.map((surface) => {
        const htmlAbsolutePath = path.resolve(rootPath, surface.htmlPath);
        const runtimeAssetAbsolutePath = path.resolve(
            runtimeRootPath,
            surface.assetPath
        );
        const htmlExists = fs.existsSync(htmlAbsolutePath);
        const runtimeAssetExists = fs.existsSync(runtimeAssetAbsolutePath);
        const htmlSource = htmlExists
            ? fs.readFileSync(htmlAbsolutePath, 'utf8')
            : '';
        const runtimeReferencePattern = buildRuntimeReferencePattern(
            surface.assetPath
        );
        const runtimeReferenceMatch = htmlSource.match(runtimeReferencePattern);
        const runtimeReferenceVersion = runtimeReferenceMatch
            ? String(runtimeReferenceMatch[2] || '').trim()
            : '';
        const runtimeAssetSizeBytes = runtimeAssetExists
            ? fs.statSync(runtimeAssetAbsolutePath).size
            : 0;

        if (!htmlExists) {
            diagnostics.push({
                code: 'missing_shell_html',
                surface: surface.key,
                message: `${surface.htmlPath} no existe.`,
            });
        }

        if (!runtimeReferenceMatch) {
            diagnostics.push({
                code: 'missing_runtime_reference',
                surface: surface.key,
                message: `${surface.htmlPath} no referencia ${surface.assetPath} con version canonica.`,
            });
        }

        if (!runtimeAssetExists) {
            diagnostics.push({
                code: 'missing_runtime_asset',
                surface: surface.key,
                message: `${surface.assetPath} no existe en el runtime generado.`,
            });
        } else if (runtimeAssetSizeBytes <= 0) {
            diagnostics.push({
                code: 'empty_runtime_asset',
                surface: surface.key,
                message: `${surface.assetPath} existe pero esta vacio.`,
            });
        }

        return {
            key: surface.key,
            label: surface.label,
            htmlPath: surface.htmlPath,
            assetPath: surface.assetPath,
            htmlAbsolutePath,
            runtimeAssetAbsolutePath,
            htmlExists,
            runtimeAssetExists,
            runtimeReferenceVersion,
            htmlReferencesRuntimeAsset: Boolean(runtimeReferenceMatch),
            runtimeAssetSizeBytes,
        };
    });

    return {
        rootPath,
        runtimeRootPath,
        surfaces,
        diagnostics,
        passed: diagnostics.length === 0,
        toRepoRelativePath(filePath) {
            return toRepoRelativePath(rootPath, filePath);
        },
    };
}

module.exports = {
    TURNERO_RUNTIME_SURFACES,
    buildRuntimeReferencePattern,
    inspectTurneroRuntimeArtifacts,
    toRepoRelativePath,
};
