#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

function parseArgs(argv) {
    const parsed = {
        root: path.join('verification', 'frontend-baseline'),
        previous: '',
        current: '',
        outDir: '',
    };

    for (let index = 0; index < argv.length; index += 1) {
        const token = argv[index];
        if (token === '--root') {
            parsed.root = String(argv[index + 1] || '').trim() || parsed.root;
            index += 1;
            continue;
        }
        if (token === '--previous') {
            parsed.previous = String(argv[index + 1] || '').trim();
            index += 1;
            continue;
        }
        if (token === '--current') {
            parsed.current = String(argv[index + 1] || '').trim();
            index += 1;
            continue;
        }
        if (token === '--out-dir') {
            parsed.outDir = String(argv[index + 1] || '').trim();
            index += 1;
        }
    }
    return parsed;
}

function listBaselineDirs(rootAbs) {
    if (!fs.existsSync(rootAbs)) {
        return [];
    }
    return fs
        .readdirSync(rootAbs, { withFileTypes: true })
        .filter((entry) => entry.isDirectory())
        .map((entry) => entry.name)
        .sort((left, right) => left.localeCompare(right));
}

function pickBaselines(rootAbs, requestedPrevious, requestedCurrent) {
    const dirs = listBaselineDirs(rootAbs);
    if (!dirs.length) {
        throw new Error(`No baseline directories found in ${rootAbs}`);
    }

    let previous = requestedPrevious;
    let current = requestedCurrent;

    if (!current) {
        current = dirs[dirs.length - 1];
    }

    if (!previous) {
        const currentIndex = dirs.indexOf(current);
        if (currentIndex <= 0) {
            throw new Error(
                'Unable to infer previous baseline. Provide --previous explicitly.'
            );
        }
        previous = dirs[currentIndex - 1];
    }

    return { previous, current };
}

function loadManifest(rootAbs, baselineId) {
    const dir = path.join(rootAbs, baselineId);
    const manifestPath = path.join(dir, 'manifest.json');
    if (!fs.existsSync(manifestPath)) {
        throw new Error(`Manifest not found: ${manifestPath}`);
    }
    const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
    return { dir, manifestPath, manifest };
}

function hashFile(filePath) {
    const raw = fs.readFileSync(filePath);
    return crypto.createHash('sha256').update(raw).digest('hex');
}

function routeKey(route) {
    return `${route.viewport}::${route.route}`;
}

function collectFiles(manifestData) {
    const map = new Map();
    for (const item of manifestData.manifest.routes || []) {
        if (item.status !== 'ok') continue;
        const relativePath = String(item.file || '').trim();
        if (!relativePath) continue;
        const absolutePath = path.join(manifestData.dir, relativePath);
        if (!fs.existsSync(absolutePath)) continue;
        map.set(routeKey(item), {
            viewport: item.viewport,
            route: item.route,
            file: relativePath.replace(/\\/g, '/'),
            hash: hashFile(absolutePath),
        });
    }
    return map;
}

function buildComparison(previousMap, currentMap) {
    const keys = new Set([...previousMap.keys(), ...currentMap.keys()]);
    const added = [];
    const removed = [];
    const changed = [];
    const unchanged = [];

    for (const key of [...keys].sort((a, b) => a.localeCompare(b))) {
        const prev = previousMap.get(key);
        const curr = currentMap.get(key);
        if (!prev && curr) {
            added.push(curr);
            continue;
        }
        if (prev && !curr) {
            removed.push(prev);
            continue;
        }
        if (!prev || !curr) continue;
        if (prev.hash === curr.hash) {
            unchanged.push(curr);
            continue;
        }
        changed.push({
            viewport: curr.viewport,
            route: curr.route,
            previousFile: prev.file,
            currentFile: curr.file,
            previousHash: prev.hash,
            currentHash: curr.hash,
        });
    }

    return {
        totals: {
            keys: keys.size,
            added: added.length,
            removed: removed.length,
            changed: changed.length,
            unchanged: unchanged.length,
        },
        added,
        removed,
        changed,
        unchanged,
    };
}

function toMarkdown(payload) {
    const lines = [];
    lines.push('# Public Baseline Comparison');
    lines.push('');
    lines.push(`- Previous: \`${payload.previous.id}\``);
    lines.push(`- Current: \`${payload.current.id}\``);
    lines.push(`- Generated: \`${payload.generatedAt}\``);
    lines.push('');
    lines.push('## Summary');
    lines.push('');
    lines.push(`- Keys compared: \`${payload.comparison.totals.keys}\``);
    lines.push(`- Changed: \`${payload.comparison.totals.changed}\``);
    lines.push(`- Unchanged: \`${payload.comparison.totals.unchanged}\``);
    lines.push(`- Added: \`${payload.comparison.totals.added}\``);
    lines.push(`- Removed: \`${payload.comparison.totals.removed}\``);
    lines.push('');
    lines.push('## Changed Routes');
    lines.push('');
    if (!payload.comparison.changed.length) {
        lines.push('- None');
    } else {
        for (const item of payload.comparison.changed) {
            lines.push(
                `- [${item.viewport}] ${item.route} -> \`${item.previousFile}\` => \`${item.currentFile}\``
            );
        }
    }
    lines.push('');
    lines.push('## Added Routes');
    lines.push('');
    if (!payload.comparison.added.length) {
        lines.push('- None');
    } else {
        for (const item of payload.comparison.added) {
            lines.push(
                `- [${item.viewport}] ${item.route} -> \`${item.file}\``
            );
        }
    }
    lines.push('');
    lines.push('## Removed Routes');
    lines.push('');
    if (!payload.comparison.removed.length) {
        lines.push('- None');
    } else {
        for (const item of payload.comparison.removed) {
            lines.push(
                `- [${item.viewport}] ${item.route} -> \`${item.file}\``
            );
        }
    }
    lines.push('');
    return `${lines.join('\n')}\n`;
}

function run() {
    const args = parseArgs(process.argv.slice(2));
    const repoRoot = process.cwd();
    const rootAbs = path.resolve(repoRoot, args.root);
    const selected = pickBaselines(rootAbs, args.previous, args.current);
    const previousData = loadManifest(rootAbs, selected.previous);
    const currentData = loadManifest(rootAbs, selected.current);
    const previousMap = collectFiles(previousData);
    const currentMap = collectFiles(currentData);
    const comparison = buildComparison(previousMap, currentMap);

    const output = {
        generatedAt: new Date().toISOString(),
        root: rootAbs,
        previous: {
            id: selected.previous,
            manifestPath: previousData.manifestPath,
        },
        current: {
            id: selected.current,
            manifestPath: currentData.manifestPath,
        },
        comparison,
    };

    const defaultOutDir = path.join(
        currentData.dir,
        `comparison-vs-${selected.previous}`
    );
    const outDir = path.resolve(repoRoot, args.outDir || defaultOutDir);
    fs.mkdirSync(outDir, { recursive: true });
    const jsonPath = path.join(outDir, 'baseline-compare.json');
    const mdPath = path.join(outDir, 'baseline-compare.md');
    fs.writeFileSync(jsonPath, `${JSON.stringify(output, null, 2)}\n`, 'utf8');
    fs.writeFileSync(mdPath, toMarkdown(output), 'utf8');

    console.log('Public baseline comparison: DONE');
    console.log(`Previous: ${selected.previous}`);
    console.log(`Current: ${selected.current}`);
    console.log(
        `Summary: changed=${comparison.totals.changed}, unchanged=${comparison.totals.unchanged}, added=${comparison.totals.added}, removed=${comparison.totals.removed}`
    );
    console.log(`Artifacts:\n- ${jsonPath}\n- ${mdPath}`);
}

try {
    run();
} catch (error) {
    console.error(`public-baseline-compare failed: ${error.message}`);
    process.exitCode = 1;
}
