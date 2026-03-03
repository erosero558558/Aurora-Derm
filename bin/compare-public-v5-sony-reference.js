#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const path = require('node:path');

const DEFAULT_REFERENCE_ROOT = path.join('verification', 'sony-reference');
const DEFAULT_PUBLIC_ROOT = path.join('verification', 'frontend-baseline');
const DEFAULT_OUT_DIR = path.join('verification', 'sony-reference-diff');

function parseArgs(argv) {
    const parsed = {
        referenceRoot: DEFAULT_REFERENCE_ROOT,
        publicRoot: DEFAULT_PUBLIC_ROOT,
        outDir: DEFAULT_OUT_DIR,
        label: 'sony-reference-diff',
    };

    for (let index = 0; index < argv.length; index += 1) {
        const token = String(argv[index] || '').trim();
        if (token === '--reference-root') {
            parsed.referenceRoot = String(
                argv[index + 1] || parsed.referenceRoot
            ).trim();
            index += 1;
            continue;
        }
        if (token === '--public-root') {
            parsed.publicRoot = String(
                argv[index + 1] || parsed.publicRoot
            ).trim();
            index += 1;
            continue;
        }
        if (token === '--out-dir') {
            parsed.outDir = String(argv[index + 1] || parsed.outDir).trim();
            index += 1;
            continue;
        }
        if (token === '--label') {
            parsed.label = String(argv[index + 1] || parsed.label).trim();
            index += 1;
        }
    }

    return parsed;
}

function nowStamp() {
    const date = new Date();
    return [
        String(date.getUTCFullYear()).padStart(4, '0'),
        String(date.getUTCMonth() + 1).padStart(2, '0'),
        String(date.getUTCDate()).padStart(2, '0'),
        '-',
        String(date.getUTCHours()).padStart(2, '0'),
        String(date.getUTCMinutes()).padStart(2, '0'),
        String(date.getUTCSeconds()).padStart(2, '0'),
    ].join('');
}

function listRunDirs(rootDir) {
    if (!fs.existsSync(rootDir)) return [];
    return fs
        .readdirSync(rootDir, { withFileTypes: true })
        .filter((entry) => entry.isDirectory())
        .map((entry) => entry.name)
        .sort((left, right) => left.localeCompare(right));
}

function latestRun(rootDir) {
    const runs = listRunDirs(rootDir);
    if (runs.length === 0) return '';
    return runs[runs.length - 1];
}

function readPngSize(filePath) {
    const raw = fs.readFileSync(filePath);
    if (raw.length < 24) {
        throw new Error(`Invalid PNG header in ${filePath}`);
    }
    return {
        width: raw.readUInt32BE(16),
        height: raw.readUInt32BE(20),
    };
}

function compareFiles(referenceFile, targetFile) {
    if (!fs.existsSync(referenceFile) || !fs.existsSync(targetFile)) {
        return {
            pass: false,
            reason: 'missing_file',
            referenceExists: fs.existsSync(referenceFile),
            targetExists: fs.existsSync(targetFile),
        };
    }

    const referenceStats = fs.statSync(referenceFile);
    const targetStats = fs.statSync(targetFile);
    const referenceSize = Number(referenceStats.size || 0);
    const targetSize = Number(targetStats.size || 0);
    const sizeRatio =
        referenceSize > 0 && targetSize > 0
            ? Math.min(referenceSize, targetSize) /
              Math.max(referenceSize, targetSize)
            : 0;

    const referencePng = readPngSize(referenceFile);
    const targetPng = readPngSize(targetFile);
    const widthRatio =
        Math.max(referencePng.width, targetPng.width) /
        Math.max(1, Math.min(referencePng.width, targetPng.width));
    const heightRatio =
        Math.max(referencePng.height, targetPng.height) /
        Math.max(1, Math.min(referencePng.height, targetPng.height));
    const widthPass = widthRatio <= 3.0;
    const sizePass = sizeRatio >= 0.005;
    const pass = widthPass && sizePass;
    let reason = 'ok';
    if (!widthPass) {
        reason = 'width_ratio_out_of_range';
    } else if (!sizePass) {
        reason = 'size_ratio_too_low';
    }

    return {
        pass,
        reason,
        referenceSize,
        targetSize,
        sizeRatio,
        widthRatio,
        heightRatio,
        referencePng,
        targetPng,
    };
}

function toMarkdown(payload) {
    const lines = [
        '# Public V5 vs Sony Reference Diff',
        '',
        `- Generated: ${payload.generatedAt}`,
        `- Result: ${payload.passed ? 'PASS' : 'FAIL'}`,
        `- Sony reference run: ${payload.referenceRun}`,
        `- Public baseline run: ${payload.publicRun}`,
        '',
        '## Comparisons',
        '',
        '| Viewport | Target | Result | Detail |',
        '| --- | --- | --- | --- |',
    ];

    payload.comparisons.forEach((item) => {
        lines.push(
            `| ${item.viewport} | ${item.target} | ${item.pass ? 'PASS' : 'FAIL'} | ${item.reason} |`
        );
    });

    lines.push('');
    return `${lines.join('\n')}\n`;
}

function main() {
    const args = parseArgs(process.argv.slice(2));
    const repoRoot = process.cwd();
    const referenceRoot = path.resolve(repoRoot, args.referenceRoot);
    const publicRoot = path.resolve(repoRoot, args.publicRoot);
    const referenceRun = latestRun(referenceRoot);
    const publicRun = latestRun(publicRoot);

    if (!referenceRun) {
        throw new Error(`No sony-reference runs found in ${referenceRoot}`);
    }
    if (!publicRun) {
        throw new Error(`No public baseline runs found in ${publicRoot}`);
    }

    const referenceRunDir = path.join(referenceRoot, referenceRun);
    const publicRunDir = path.join(publicRoot, publicRun);
    const outputDir = path.resolve(
        repoRoot,
        args.outDir,
        `${nowStamp()}-${String(args.label || 'sony-reference-diff').replace(
            /[^a-zA-Z0-9_-]+/g,
            '-'
        )}`
    );
    fs.mkdirSync(outputDir, { recursive: true });

    const specs = [
        {
            viewport: 'desktop',
            target: 'home-es',
            referenceFile: path.join(
                referenceRunDir,
                'desktop',
                'sony-home.png'
            ),
            targetFile: path.join(publicRunDir, 'desktop', 'home-es.png'),
        },
        {
            viewport: 'desktop',
            target: 'home-en',
            referenceFile: path.join(
                referenceRunDir,
                'desktop',
                'sony-home.png'
            ),
            targetFile: path.join(publicRunDir, 'desktop', 'home-en.png'),
        },
        {
            viewport: 'mobile',
            target: 'home-es',
            referenceFile: path.join(
                referenceRunDir,
                'mobile',
                'sony-home.png'
            ),
            targetFile: path.join(publicRunDir, 'mobile', 'home-es.png'),
        },
        {
            viewport: 'mobile',
            target: 'home-en',
            referenceFile: path.join(
                referenceRunDir,
                'mobile',
                'sony-home.png'
            ),
            targetFile: path.join(publicRunDir, 'mobile', 'home-en.png'),
        },
    ];

    const comparisons = specs.map((spec) => {
        const result = compareFiles(spec.referenceFile, spec.targetFile);
        return {
            viewport: spec.viewport,
            target: spec.target,
            ...result,
            referenceFile: path
                .relative(repoRoot, spec.referenceFile)
                .replace(/\\/g, '/'),
            targetFile: path
                .relative(repoRoot, spec.targetFile)
                .replace(/\\/g, '/'),
        };
    });

    const passed = comparisons.every((item) => item.pass === true);
    const payload = {
        generatedAt: new Date().toISOString(),
        referenceRun,
        publicRun,
        passed,
        comparisons,
    };

    const jsonPath = path.join(outputDir, 'sony-reference-diff.json');
    const mdPath = path.join(outputDir, 'sony-reference-diff.md');
    fs.writeFileSync(jsonPath, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
    fs.writeFileSync(mdPath, toMarkdown(payload), 'utf8');

    process.stdout.write(
        [
            `Public V5 vs Sony reference: ${passed ? 'PASS' : 'FAIL'}`,
            `Reference run: ${referenceRun}`,
            `Public run: ${publicRun}`,
            'Artifacts:',
            `- ${path.relative(repoRoot, jsonPath).replace(/\\/g, '/')}`,
            `- ${path.relative(repoRoot, mdPath).replace(/\\/g, '/')}`,
            '',
        ].join('\n')
    );

    if (!passed) {
        process.exitCode = 1;
    }
}

try {
    main();
} catch (error) {
    process.stderr.write(
        `compare-public-v5-sony-reference failed: ${error.message}\n`
    );
    process.exitCode = 1;
}
