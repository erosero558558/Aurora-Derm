#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const INDEX_FILE = path.join(ROOT, 'index.html');
const SERVICE_FILES = [
    path.join(ROOT, 'servicios', 'acne.html'),
    path.join(ROOT, 'servicios', 'laser.html'),
];
const SERVICE_WORKER_FILE = path.join(ROOT, 'sw.js');

function readUtf8(filePath) {
    return fs.readFileSync(filePath, 'utf8');
}

function writeUtf8(filePath, content) {
    fs.writeFileSync(filePath, content, 'utf8');
}

function extractVersion(content, assetPattern) {
    const regex = new RegExp(`${assetPattern}\\?v=([^"'\\s]+)`, 'i');
    const match = content.match(regex);
    return match ? match[1] : null;
}

function ensureExtracted(name, value) {
    if (!value) {
        throw new Error(
            `No se pudo extraer version para ${name} desde index.html`
        );
    }
}

function replaceOrThrow(content, regex, replacer, label) {
    if (!regex.test(content)) {
        throw new Error(`No se encontro patron esperado para ${label}`);
    }
    return content.replace(regex, replacer);
}

function syncServicePages(versions, checkOnly) {
    const changed = [];
    for (const filePath of SERVICE_FILES) {
        const original = readUtf8(filePath);
        const synced = replaceOrThrow(
            original,
            /(src\s*=\s*"\.\.\/script\.js\?v=)([^"]+)(")/i,
            `$1${versions.script}$3`,
            `${path.basename(filePath)} script.js`
        );

        if (synced !== original) {
            changed.push(path.relative(ROOT, filePath));
            if (!checkOnly) {
                writeUtf8(filePath, synced);
            }
        }
    }
    return changed;
}

function syncServiceWorker(versions, checkOnly) {
    const relative = path.relative(ROOT, SERVICE_WORKER_FILE);
    const original = readUtf8(SERVICE_WORKER_FILE);
    let synced = original;

    synced = replaceOrThrow(
        synced,
        /(const CACHE_NAME = 'pielarmonia-v\d+-)([^']+)(';\s*)/i,
        `$1${versions.script}$3`,
        'sw.js CACHE_NAME'
    );
    synced = replaceOrThrow(
        synced,
        /('\/styles-deferred\.css\?v=)([^']+)(',)/i,
        `$1${versions.deferredStyles}$3`,
        'sw.js styles-deferred'
    );
    synced = replaceOrThrow(
        synced,
        /('\/js\/bootstrap-inline-engine\.js\?v=)([^']+)(',)/i,
        `$1${versions.bootstrap}$3`,
        'sw.js bootstrap-inline-engine'
    );
    synced = replaceOrThrow(
        synced,
        /('\/script\.js\?v=)([^']+)(',)/i,
        `$1${versions.script}$3`,
        'sw.js script.js'
    );

    if (synced !== original) {
        if (!checkOnly) {
            writeUtf8(SERVICE_WORKER_FILE, synced);
        }
        return [relative];
    }
    return [];
}

function parseArgs() {
    const args = new Set(process.argv.slice(2));
    return {
        checkOnly: args.has('--check'),
    };
}

function run() {
    const { checkOnly } = parseArgs();
    const indexContent = readUtf8(INDEX_FILE);

    const versions = {
        script: extractVersion(indexContent, 'script\\.js'),
        bootstrap: extractVersion(
            indexContent,
            'js/bootstrap-inline-engine\\.js'
        ),
        deferredStyles: extractVersion(indexContent, 'styles-deferred\\.css'),
    };

    ensureExtracted('script.js', versions.script);
    ensureExtracted('bootstrap-inline-engine.js', versions.bootstrap);
    ensureExtracted('styles-deferred.css', versions.deferredStyles);

    const changedFiles = [
        ...syncServicePages(versions, checkOnly),
        ...syncServiceWorker(versions, checkOnly),
    ];

    if (checkOnly) {
        if (changedFiles.length > 0) {
            console.error(
                [
                    'Frontend asset versions fuera de sync.',
                    ...changedFiles.map((file) => `- ${file}`),
                ].join('\n')
            );
            process.exit(1);
        }

        console.log(
            `OK: contrato de versiones sincronizado (script=${versions.script}, bootstrap=${versions.bootstrap}, styles-deferred=${versions.deferredStyles})`
        );
        return;
    }

    if (changedFiles.length === 0) {
        console.log(
            `Sin cambios: contrato ya estaba sincronizado (script=${versions.script}).`
        );
        return;
    }

    console.log(
        [
            `Versiones frontend sincronizadas desde index.html (script=${versions.script}, bootstrap=${versions.bootstrap}, styles-deferred=${versions.deferredStyles}):`,
            ...changedFiles.map((file) => `- ${file}`),
        ].join('\n')
    );
}

try {
    run();
} catch (error) {
    console.error(
        error && error.message
            ? error.message
            : 'Error inesperado al sincronizar versiones frontend'
    );
    process.exit(1);
}
