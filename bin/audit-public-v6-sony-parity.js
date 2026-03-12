#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const ROOT = path.resolve(__dirname, '..');
const OUT_DIR = path.join(ROOT, 'verification', 'public-v6-audit');
const SHOT_DIR = path.join(ROOT, 'verification', 'public-v6-screenshots');
const CONTRACT_JSON = path.join(OUT_DIR, 'visual-contract.json');

function parseArg(flag, fallback) {
    const index = process.argv.indexOf(flag);
    if (index === -1) return fallback;
    const value = process.argv[index + 1];
    if (typeof value === 'undefined') return fallback;
    return value;
}

function pad(num, size) {
    return String(num).padStart(size, '0');
}

function toPosix(value) {
    return String(value || '').replace(/\\/g, '/');
}

function runContractAudit() {
    const run = spawnSync(
        process.execPath,
        [
            path.join(ROOT, 'bin', 'audit-public-v6-visual-contract.js'),
            '--min-checkpoints',
            '62',
            '--strict',
        ],
        { cwd: ROOT, stdio: 'inherit' }
    );
    if (run.status !== 0) {
        throw new Error('fallo audit-public-v6-visual-contract');
    }
}

function readContract() {
    if (!fs.existsSync(CONTRACT_JSON)) {
        runContractAudit();
    }
    const payload = JSON.parse(fs.readFileSync(CONTRACT_JSON, 'utf8'));
    const checks = Array.isArray(payload.checks) ? payload.checks : [];
    if (checks.length < 50) {
        throw new Error('visual-contract.json no contiene al menos 50 checks');
    }
    return payload;
}

function rangeIncludes(value, from, to) {
    return value >= from && value <= to;
}

function getBlockMeta(vcNumber) {
    if (rangeIncludes(vcNumber, 1, 15)) {
        return {
            block: 'Header',
            captures: 'A,D,E',
            artifact: 'verification/public-v6-screenshots/home-es-desktop.png',
            note: 'Header Aurora claro, jerarquia superior y mega menu.',
        };
    }
    if (rangeIncludes(vcNumber, 16, 30)) {
        return {
            block: 'Hero',
            captures: 'A,C,E',
            artifact: 'verification/public-v6-screenshots/home-es-desktop.png',
            note: 'Carrusel 3 paneles, banda blur, controles e indicadores.',
        };
    }
    if (rangeIncludes(vcNumber, 31, 35)) {
        return {
            block: 'News Strip',
            captures: 'A,B',
            artifact: 'verification/public-v6-screenshots/home-es-desktop.png',
            note: 'Franja editorial clara inmediatamente bajo el hero.',
        };
    }
    if (rangeIncludes(vcNumber, 36, 44)) {
        return {
            block: 'Editorial Grid',
            captures: 'B,C',
            artifact:
                vcNumber === 39
                    ? 'verification/public-v6-screenshots/home-es-mobile.png'
                    : 'verification/public-v6-screenshots/home-es-desktop.png',
            note: 'Fondo atmosferico Aurora y ritmo editorial tipo masonry.',
        };
    }
    if (rangeIncludes(vcNumber, 45, 50)) {
        const artifact =
            vcNumber === 50
                ? 'verification/public-v6-screenshots/legal-es-desktop.png'
                : 'verification/public-v6-screenshots/service-es-desktop.png';
        return {
            block: 'Internal Surfaces',
            captures: 'F,G',
            artifact,
            note: 'Plantillas internas con breadcrumb, hero y grillas densas.',
        };
    }

    return {
        block: 'General',
        captures: 'A-G',
        artifact: 'verification/public-v6-screenshots/home-es-desktop.png',
        note: 'Paridad estructural V6.',
    };
}

function buildParityLedger(contract, minPoints) {
    const checks = Array.isArray(contract.checks) ? contract.checks : [];
    const checkMap = new Map(checks.map((check) => [check.id, check]));
    const points = [];
    const missingSourceIds = [];
    const missingEvidence = [];

    for (let vcNumber = 1; vcNumber <= 50; vcNumber += 1) {
        const sourceId = `VC-${pad(vcNumber, 2)}`;
        const pointId = `SP-${pad(vcNumber, 3)}`;
        const sourceCheck = checkMap.get(sourceId);
        const meta = getBlockMeta(vcNumber);
        const artifactAbsPath = path.join(ROOT, ...meta.artifact.split('/'));
        const evidenceExists = fs.existsSync(artifactAbsPath);
        if (!sourceCheck) {
            missingSourceIds.push(sourceId);
        }
        if (!evidenceExists) {
            missingEvidence.push(meta.artifact);
        }

        const pass = Boolean(sourceCheck && sourceCheck.pass && evidenceExists);
        points.push({
            point_id: pointId,
            source_id: sourceId,
            desc: sourceCheck ? sourceCheck.desc : 'source check missing',
            pass,
            block: meta.block,
            captures: meta.captures,
            artifact: meta.artifact,
            note: meta.note,
            source_meta:
                sourceCheck && sourceCheck.meta ? sourceCheck.meta : {},
            evidence_exists: evidenceExists,
        });
    }

    const total = points.length;
    const passed = points.filter((point) => point.pass).length;
    const ok =
        passed >= minPoints &&
        missingSourceIds.length === 0 &&
        missingEvidence.length === 0;

    return {
        generatedAt: new Date().toISOString(),
        ok,
        summary: {
            passed,
            total,
            min_points: minPoints,
            missing_source_ids: missingSourceIds.length,
            missing_evidence_files: Array.from(new Set(missingEvidence)).length,
            contract_passed: Number(contract.passed || 0),
            contract_total: Number(contract.total || 0),
        },
        missing_source_ids: missingSourceIds,
        missing_evidence_files: Array.from(new Set(missingEvidence)),
        points,
    };
}

function fmt(value) {
    if (typeof value === 'number')
        return Number.isInteger(value) ? String(value) : value.toFixed(3);
    if (typeof value === 'boolean') return value ? 'yes' : 'no';
    if (value && typeof value === 'object') return JSON.stringify(value);
    return String(value || '');
}

function writeArtifacts(payload) {
    fs.mkdirSync(OUT_DIR, { recursive: true });
    fs.mkdirSync(SHOT_DIR, { recursive: true });

    const jsonPath = path.join(OUT_DIR, 'sony-parity-50.json');
    const mdPath = path.join(OUT_DIR, 'sony-parity-50.md');
    fs.writeFileSync(jsonPath, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');

    const mdLines = [
        '# Public V6 Aurora Baseline 50 (legacy sony alias)',
        '',
        `- Status: **${payload.ok ? 'PASS' : 'FAIL'}**`,
        `- Points: **${payload.summary.passed}/${payload.summary.total}** (required: ${payload.summary.min_points})`,
        `- Source contract: **${payload.summary.contract_passed}/${payload.summary.contract_total}**`,
        `- Missing source IDs: **${payload.summary.missing_source_ids}**`,
        `- Missing evidence files: **${payload.summary.missing_evidence_files}**`,
        '',
        '| Point | Result | VC Source | Block | Legacy Ref | Evidence | Metric |',
        '|---|---|---|---|---|---|---|',
        ...payload.points.map((point) => {
            const metric = Object.keys(point.source_meta || {}).length
                ? fmt(point.source_meta)
                : '-';
            return `| ${point.point_id} | ${point.pass ? 'PASS' : 'FAIL'} | ${point.source_id} | ${point.block} | ${point.captures} | ${toPosix(point.artifact)} | ${metric} |`;
        }),
        '',
    ];

    fs.writeFileSync(mdPath, `${mdLines.join('\n')}\n`, 'utf8');
    return { jsonPath, mdPath };
}

function main() {
    const minPoints = Number(parseArg('--min-points', 50));
    const strict = process.argv.includes('--strict');
    if (!Number.isFinite(minPoints) || minPoints <= 0) {
        throw new Error('valor invalido para --min-points');
    }

    const contract = readContract();
    const payload = buildParityLedger(contract, minPoints);
    const artifacts = writeArtifacts(payload);

    process.stdout.write(
        [
            `Public V6 Aurora baseline ledger (legacy sony alias): ${payload.ok ? 'PASS' : 'FAIL'}`,
            `Points: ${payload.summary.passed}/${payload.summary.total} (required ${payload.summary.min_points})`,
            'Artifacts:',
            `- ${toPosix(path.relative(ROOT, artifacts.jsonPath))}`,
            `- ${toPosix(path.relative(ROOT, artifacts.mdPath))}`,
            '',
        ].join('\n')
    );

    if (strict && !payload.ok) {
        process.exitCode = 1;
    }
}

try {
    main();
} catch (error) {
    process.stderr.write(
        `audit-public-v6-sony-parity failed: ${error.message}\n`
    );
    process.exitCode = 1;
}
