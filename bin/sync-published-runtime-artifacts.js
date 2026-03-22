#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const {
    GENERATED_SITE_ROOT,
    PUBLISHED_ROOT_RUNTIME_DIRECTORIES,
    PUBLISHED_ROOT_RUNTIME_FILES,
    REPO_ROOT,
    normalizeRelativePath,
} = require('./lib/generated-site-root.js');

function parseArgs(argv) {
    const options = {
        root: GENERATED_SITE_ROOT,
        publishedRoot: REPO_ROOT,
        check: false,
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
                options.root = path.resolve(REPO_ROOT, nextValue);
                index += 1;
            }
            continue;
        }

        if (token.startsWith('--root=')) {
            options.root = path.resolve(
                REPO_ROOT,
                token.slice('--root='.length).trim()
            );
            continue;
        }

        if (token === '--published-root') {
            const nextValue = String(argv[index + 1] || '').trim();
            if (nextValue) {
                options.publishedRoot = path.resolve(REPO_ROOT, nextValue);
                index += 1;
            }
            continue;
        }

        if (token.startsWith('--published-root=')) {
            options.publishedRoot = path.resolve(
                REPO_ROOT,
                token.slice('--published-root='.length).trim()
            );
            continue;
        }

        if (token === '--check') {
            options.check = true;
            continue;
        }

        if (token === '--json') {
            options.json = true;
            continue;
        }

        if (token === '--quiet') {
            options.quiet = true;
        }
    }

    return options;
}

function readFileOrEmpty(filePath) {
    try {
        return fs.readFileSync(filePath);
    } catch (_error) {
        return null;
    }
}

function inspectFile(relativePath, root, publishedRoot) {
    const normalized = normalizeRelativePath(relativePath);
    const sourcePath = path.resolve(root, normalized);
    const targetPath = path.resolve(publishedRoot, normalized);
    const sourceContent = readFileOrEmpty(sourcePath);
    const targetContent = readFileOrEmpty(targetPath);

    return {
        type: 'file',
        relativePath: normalized,
        sourcePath,
        targetPath,
        sourceExists: sourceContent !== null,
        targetExists: targetContent !== null,
        inSync:
            sourceContent !== null &&
            targetContent !== null &&
            Buffer.compare(sourceContent, targetContent) === 0,
    };
}

function inspectDirectory(relativePath, root, publishedRoot) {
    const normalized = normalizeRelativePath(relativePath);
    const sourcePath = path.resolve(root, normalized);
    const targetPath = path.resolve(publishedRoot, normalized);

    return {
        type: 'directory',
        relativePath: normalized,
        sourcePath,
        targetPath,
        sourceExists: fs.existsSync(sourcePath),
        targetExists: fs.existsSync(targetPath),
        inSync: false,
    };
}

function syncFile(entry) {
    fs.mkdirSync(path.dirname(entry.targetPath), { recursive: true });
    fs.cpSync(entry.sourcePath, entry.targetPath, { force: true });
}

function syncDirectory(entry) {
    fs.rmSync(entry.targetPath, { recursive: true, force: true });
    fs.mkdirSync(path.dirname(entry.targetPath), { recursive: true });
    fs.cpSync(entry.sourcePath, entry.targetPath, {
        recursive: true,
        force: true,
    });
}

function buildReport(options) {
    const fileEntries = PUBLISHED_ROOT_RUNTIME_FILES.map((relativePath) =>
        inspectFile(relativePath, options.root, options.publishedRoot)
    );
    const directoryEntries = PUBLISHED_ROOT_RUNTIME_DIRECTORIES.map(
        (relativePath) =>
            inspectDirectory(relativePath, options.root, options.publishedRoot)
    );
    const diagnostics = [];

    for (const entry of [...fileEntries, ...directoryEntries]) {
        if (!entry.sourceExists) {
            diagnostics.push({
                code: 'published_runtime_source_missing',
                type: entry.type,
                relativePath: entry.relativePath,
            });
            continue;
        }

        if (entry.type === 'file' && !entry.inSync) {
            diagnostics.push({
                code: entry.targetExists
                    ? 'published_runtime_file_drift'
                    : 'published_runtime_file_missing',
                type: entry.type,
                relativePath: entry.relativePath,
            });
            continue;
        }

        if (entry.type === 'directory' && !entry.targetExists) {
            diagnostics.push({
                code: 'published_runtime_directory_missing',
                type: entry.type,
                relativePath: entry.relativePath,
            });
        }
    }

    return {
        generatedAt: new Date().toISOString(),
        rootPath: options.root,
        publishedRootPath: options.publishedRoot,
        files: fileEntries,
        directories: directoryEntries,
        diagnostics,
        passed: diagnostics.length === 0,
    };
}

function printReport(report, options) {
    if (options.json) {
        process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
        return;
    }

    if (options.quiet) {
        return;
    }

    if (report.passed) {
        process.stdout.write(
            `[published-runtime] OK: ${report.files.length} archivo(s) y ${report.directories.length} directorio(s) sincronizados.\n`
        );
        return;
    }

    process.stderr.write(
        [
            '[published-runtime] Drift detectado en artefactos publicados:',
            ...report.diagnostics.map(
                (entry) => `- ${entry.code}: ${entry.relativePath}`
            ),
        ].join('\n') + '\n'
    );
}

function main() {
    const options = parseArgs(process.argv.slice(2));
    const reportBefore = buildReport(options);

    if (options.check) {
        printReport(reportBefore, options);
        if (!reportBefore.passed) {
            process.exitCode = 1;
        }
        return;
    }

    for (const entry of reportBefore.files) {
        if (!entry.sourceExists) {
            continue;
        }
        syncFile(entry);
    }

    for (const entry of reportBefore.directories) {
        if (!entry.sourceExists) {
            continue;
        }
        syncDirectory(entry);
    }

    const reportAfter = buildReport(options);
    printReport(reportAfter, options);
    if (!reportAfter.passed) {
        process.exitCode = 1;
    }
}

main();
