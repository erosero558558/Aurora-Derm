#!/usr/bin/env node

const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');

const V6_TARGETS = [
    'src/apps/astro/src/layouts/PublicShellV6.astro',
    'src/apps/astro/src/lib/public-v6.js',
    'src/apps/astro/src/components/public-v6',
    'src/apps/astro/src/styles/public-v6',
    'src/apps/astro/src/pages/es/index.astro',
    'src/apps/astro/src/pages/en/index.astro',
    'src/apps/astro/src/pages/es/servicios/index.astro',
    'src/apps/astro/src/pages/en/services/index.astro',
    'src/apps/astro/src/pages/es/servicios/[slug].astro',
    'src/apps/astro/src/pages/en/services/[slug].astro',
    'src/apps/astro/src/pages/es/telemedicina/index.astro',
    'src/apps/astro/src/pages/en/telemedicine/index.astro',
    'src/apps/astro/src/pages/es/legal/[slug].astro',
    'src/apps/astro/src/pages/en/legal/[slug].astro',
    'js/public-v6-shell.js',
    'content/public-v6',
];

const LEGACY_SOURCES = [
    'src/apps/astro/src/layouts/PublicShellV3.astro',
    'src/apps/astro/src/layouts/PublicShellV5.astro',
    'src/apps/astro/src/components/public-v3',
    'src/apps/astro/src/components/public-v5',
    'src/apps/astro/src/styles/public-v5',
    'js/public-v3-shell.js',
    'js/public-v5-shell.js',
];

const bannedPatterns = [
    {
        id: 'import_legacy_surface',
        test: /public-v3|public-v5/,
        message: 'V6 cannot import or reference public-v3/public-v5.',
    },
    {
        id: 'legacy_class_or_contract',
        test: /hero-stage__|\bv5-|data-stage-/,
        message: 'V6 cannot use legacy class names or stage contracts.',
    },
];

function walkFiles(entryPath) {
    if (!fs.existsSync(entryPath)) {
        return [];
    }

    const stats = fs.statSync(entryPath);
    if (stats.isFile()) {
        return [entryPath];
    }

    const files = [];
    const queue = [entryPath];
    while (queue.length) {
        const current = queue.pop();
        const items = fs.readdirSync(current, { withFileTypes: true });
        for (const item of items) {
            const next = path.join(current, item.name);
            if (item.isDirectory()) {
                queue.push(next);
            } else {
                files.push(next);
            }
        }
    }
    return files;
}

function rel(filePath) {
    return path.relative(ROOT, filePath).replace(/\\/g, '/');
}

function readText(filePath) {
    return fs.readFileSync(filePath, 'utf8');
}

function shouldTrackLine(line) {
    const trimmed = line.trim();
    if (!trimmed) return false;
    if (trimmed.length < 40) return false;
    if (!/[a-zA-Z]/.test(trimmed)) return false;
    if (/^const\s+\{/.test(trimmed)) return false;
    if (/^import\s+/.test(trimmed)) return false;
    if (
        !/(public|hero|booking|tele|legal|sony|data-|route|clinical)/i.test(
            trimmed
        )
    ) {
        return false;
    }
    if (
        /^(<\/?(div|span|p|section|article|li|ul|ol|a|img)\b|\{|\}|\);?|return;?)$/i.test(
            trimmed
        )
    ) {
        return false;
    }
    return true;
}

function buildLegacyLineSet(legacyFiles) {
    const map = new Map();
    for (const filePath of legacyFiles) {
        const lines = readText(filePath).split(/\r?\n/);
        lines.forEach((line, index) => {
            const trimmed = line.trim();
            if (!shouldTrackLine(trimmed)) return;
            if (!map.has(trimmed)) {
                map.set(trimmed, `${rel(filePath)}:${index + 1}`);
            }
        });
    }
    return map;
}

function run() {
    const v6Files = V6_TARGETS.flatMap((target) =>
        walkFiles(path.join(ROOT, target))
    );
    const legacyFiles = LEGACY_SOURCES.flatMap((target) =>
        walkFiles(path.join(ROOT, target))
    );

    const violations = [];

    for (const filePath of v6Files) {
        const text = readText(filePath);
        const lines = text.split(/\r?\n/);

        for (const pattern of bannedPatterns) {
            if (pattern.test.test(text)) {
                violations.push({
                    type: pattern.id,
                    file: rel(filePath),
                    message: pattern.message,
                });
            }
        }

        lines.forEach((line, index) => {
            if (
                /public-v3|public-v5|hero-stage__|\bv5-|data-stage-/.test(line)
            ) {
                violations.push({
                    type: 'line_legacy_token',
                    file: rel(filePath),
                    line: index + 1,
                    message: 'Legacy token detected in V6 line.',
                    excerpt: line.trim().slice(0, 180),
                });
            }
        });
    }

    const legacyLines = buildLegacyLineSet(legacyFiles);

    for (const filePath of v6Files) {
        const lines = readText(filePath).split(/\r?\n/);
        lines.forEach((line, index) => {
            const trimmed = line.trim();
            if (!shouldTrackLine(trimmed)) return;
            if (legacyLines.has(trimmed)) {
                violations.push({
                    type: 'exact_line_reuse',
                    file: rel(filePath),
                    line: index + 1,
                    message: 'Exact non-empty line reused from legacy surface.',
                    excerpt: trimmed.slice(0, 180),
                    legacy_source: legacyLines.get(trimmed),
                });
            }
        });
    }

    const result = {
        ok: violations.length === 0,
        checked_files: v6Files.map(rel),
        legacy_files_scanned: legacyFiles.map(rel),
        violations,
    };

    const outDir = path.join(ROOT, 'verification', 'public-v6-audit');
    fs.mkdirSync(outDir, { recursive: true });
    fs.writeFileSync(
        path.join(outDir, 'zero-reuse.json'),
        `${JSON.stringify(result, null, 2)}\n`,
        'utf8'
    );

    if (!result.ok) {
        console.error(JSON.stringify(result, null, 2));
        process.exit(1);
    }

    console.log(
        JSON.stringify(
            {
                ok: true,
                checked_files: result.checked_files.length,
                legacy_files_scanned: result.legacy_files_scanned.length,
            },
            null,
            2
        )
    );
}

run();
