#!/usr/bin/env node
'use strict';

const {
    existsSync,
    readFileSync,
    readdirSync,
    unlinkSync,
} = require('node:fs');
const { relative, resolve } = require('node:path');

function parseCliArgs(argv) {
    const options = {
        dryRun: false,
        strict: false,
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
        if (value === '--strict') {
            options.strict = true;
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

const cli = parseCliArgs(process.argv.slice(2));
const ROOT = cli.root
    ? resolve(process.cwd(), cli.root)
    : resolve(__dirname, '..');
const ADMIN_ENTRY = resolve(ROOT, 'admin.js');
const ADMIN_CHUNKS_DIR = resolve(ROOT, 'js', 'admin-chunks');
const MERGE_CONFLICT_MARKER_PATTERN = /^(<{7,}.*|={7,}|>{7,}.*)$/m;

const dryRun = cli.dryRun;
const strict = cli.strict;
const quiet = cli.quiet;

function log(message) {
    if (!quiet) {
        process.stdout.write(`${message}\n`);
    }
}

function warn(message) {
    process.stderr.write(`${message}\n`);
}

function parseModuleSpecifiers(source) {
    const specifiers = [];
    const patterns = [
        /\bimport\s*\(\s*(['"`])([^'"`]+)\1\s*\)/g,
        /\bfrom\s*(['"`])([^'"`]+)\1/g,
        /\bimport\s*(['"`])([^'"`]+)\1/g,
    ];

    for (const pattern of patterns) {
        let match = pattern.exec(source);
        while (match) {
            const value = String(match[2] || '').trim();
            if (value) {
                specifiers.push(value);
            }
            match = pattern.exec(source);
        }
    }

    return specifiers;
}

function toChunkFilename(specifier) {
    const cleanValue = String(specifier || '')
        .split('?')[0]
        .split('#')[0];
    if (!cleanValue) return '';

    if (cleanValue.includes('js/admin-chunks/')) {
        return cleanValue.slice(cleanValue.lastIndexOf('/') + 1);
    }

    if (cleanValue.startsWith('./') && !cleanValue.slice(2).includes('/')) {
        return cleanValue.slice(2);
    }

    return '';
}

function collectReachableChunks() {
    const reachable = new Set();
    const pendingFiles = [ADMIN_ENTRY];
    const visited = new Set();

    while (pendingFiles.length > 0) {
        const current = pendingFiles.shift();
        if (!current || visited.has(current) || !existsSync(current)) {
            continue;
        }

        visited.add(current);

        const source = readFileSync(current, 'utf8');
        const specifiers = parseModuleSpecifiers(source);

        for (const specifier of specifiers) {
            const chunkFilename = toChunkFilename(specifier);
            if (!chunkFilename || !chunkFilename.endsWith('.js')) {
                continue;
            }

            reachable.add(chunkFilename);

            const nextChunkPath = resolve(ADMIN_CHUNKS_DIR, chunkFilename);
            if (existsSync(nextChunkPath) && !visited.has(nextChunkPath)) {
                pendingFiles.push(nextChunkPath);
            }
        }
    }

    return reachable;
}

function toRepoRelativePath(filePath) {
    return relative(ROOT, filePath).replace(/\\/g, '/');
}

function findFirstMergeConflictMarker(filePath) {
    if (!existsSync(filePath)) {
        return null;
    }

    const source = readFileSync(filePath, 'utf8');
    const match = source.match(MERGE_CONFLICT_MARKER_PATTERN);
    if (!match || typeof match.index !== 'number') {
        return null;
    }

    const linesBeforeMatch = source.slice(0, match.index).split(/\r?\n/).length;
    return {
        filePath,
        relativePath: toRepoRelativePath(filePath),
        lineNumber: linesBeforeMatch,
        marker: String(match[0] || '').trim(),
    };
}

function collectActiveAdminAssets(reachableChunks) {
    return [
        ADMIN_ENTRY,
        ...Array.from(reachableChunks, (chunkFilename) =>
            resolve(ADMIN_CHUNKS_DIR, chunkFilename)
        ),
    ].filter((filePath) => existsSync(filePath));
}

function main() {
    if (!existsSync(ADMIN_ENTRY)) {
        warn('[admin-chunks] admin.js no existe, no se ejecuta limpieza.');
        process.exit(strict ? 1 : 0);
    }

    if (!existsSync(ADMIN_CHUNKS_DIR)) {
        warn(
            '[admin-chunks] js/admin-chunks no existe, no hay archivos por limpiar.'
        );
        process.exit(0);
    }

    const reachableChunks = collectReachableChunks();
    const filesInDirectory = readdirSync(ADMIN_CHUNKS_DIR).filter((file) =>
        file.endsWith('.js')
    );

    if (filesInDirectory.length === 0) {
        log('[admin-chunks] No hay chunks para limpiar.');
        process.exit(0);
    }

    if (reachableChunks.size === 0) {
        warn(
            '[admin-chunks] No se detectaron referencias a chunks desde admin.js; se omite limpieza por seguridad.'
        );
        process.exit(strict ? 1 : 0);
    }

    const mergeConflictFindings = collectActiveAdminAssets(reachableChunks)
        .map((filePath) => findFirstMergeConflictMarker(filePath))
        .filter(Boolean);
    if (mergeConflictFindings.length > 0) {
        const locations = mergeConflictFindings.map(
            (finding) =>
                `${finding.relativePath}:${finding.lineNumber} (${finding.marker})`
        );
        warn(
            `[admin-chunks] Detectados marcadores de merge en assets admin activos: ${locations.join(', ')}`
        );
        process.exit(1);
    }

    const staleChunks = filesInDirectory.filter(
        (file) => !reachableChunks.has(file)
    );
    if (staleChunks.length === 0) {
        log(
            `[admin-chunks] Limpieza OK. Chunks vigentes: ${reachableChunks.size}.`
        );
        process.exit(0);
    }

    if (dryRun) {
        log(
            `[admin-chunks] DRY RUN. Se eliminarian ${staleChunks.length} chunk(s): ${staleChunks.join(', ')}`
        );
        process.exit(0);
    }

    let deleted = 0;
    for (const chunk of staleChunks) {
        const targetPath = resolve(ADMIN_CHUNKS_DIR, chunk);
        try {
            unlinkSync(targetPath);
            deleted += 1;
            log(`[admin-chunks] Eliminado: ${chunk}`);
        } catch (error) {
            warn(
                `[admin-chunks] No se pudo eliminar ${chunk}: ${error.message}`
            );
            if (strict) {
                process.exit(1);
            }
        }
    }

    log(
        `[admin-chunks] Limpieza completada. Eliminados ${deleted}, vigentes ${reachableChunks.size}.`
    );
}

main();
