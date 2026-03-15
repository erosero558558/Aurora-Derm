#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const ROOT = path.resolve(__dirname, '..');
const OUT_DIR = path.join(ROOT, 'verification', 'public-v6-audit');
const OUTPUT_JSON = path.join(OUT_DIR, 'quality150.json');
const OUTPUT_MD = path.join(OUT_DIR, 'quality150.md');
const VISUAL_JSON = path.join(OUT_DIR, 'visual-contract.json');
const SONY_JSON = path.join(OUT_DIR, 'sony-parity-50.json');
const SONY_LIVE_JSON = path.join(OUT_DIR, 'sony-live-evidence.json');
const PERFORMANCE_JSON = path.join(
    ROOT,
    'verification',
    'performance-gate',
    'performance-gate.json'
);

const HARD_GATES = [
    {
        id: 'build_public_v6',
        label: 'Build public V6',
        command: 'npm run build:public:v6',
    },
    {
        id: 'artifacts_v6',
        label: 'Check public V6 artifacts',
        command: 'npm run check:public:v6:artifacts',
    },
    {
        id: 'runtime_artifacts',
        label: 'Check public runtime artifacts',
        command: 'npm run check:public:runtime:artifacts',
    },
    {
        id: 'qa_v6',
        label: 'Frontend QA V6',
        command: 'npm run test:frontend:qa:v6',
    },
    {
        id: 'copy_v6',
        label: 'Copy audit V6',
        command: 'npm run audit:public:v6:copy',
    },
    {
        id: 'visual_contract',
        label: 'Visual contract V6',
        command: 'npm run audit:public:v6:visual-contract',
    },
    {
        id: 'sony_parity',
        label: 'Sony parity V6',
        command: 'npm run audit:public:v6:sony-parity',
    },
    {
        id: 'sony_live_evidence',
        label: 'Sony live evidence V6',
        command: 'npm run audit:public:v6:sony-evidence',
    },
    {
        id: 'performance_gate',
        label: 'Performance gate',
        command: 'npm run test:frontend:performance:gate',
    },
    {
        id: 'routing_smoke',
        label: 'Public routing smoke',
        command: 'npm run smoke:public:routing',
    },
    {
        id: 'conversion_smoke',
        label: 'Public conversion smoke',
        command: 'npm run smoke:public:conversion',
    },
    {
        id: 'single_source',
        label: 'Public V6 single-source',
        command: 'node bin/assert-public-v6-single-source.js',
    },
];

function toPosix(value) {
    return String(value || '').replace(/\\/g, '/');
}

function tailLines(text, maxLines = 20) {
    return String(text || '')
        .replace(/\r\n/g, '\n')
        .split('\n')
        .filter(Boolean)
        .slice(-maxLines)
        .join('\n');
}

function runCommand(command) {
    const startedAt = new Date();
    const result = spawnSync(command, {
        cwd: ROOT,
        encoding: 'utf8',
        shell: true,
        maxBuffer: 1024 * 1024 * 40,
    });
    const endedAt = new Date();
    const exitCode =
        typeof result.status === 'number'
            ? result.status
            : result.error
              ? 1
              : 0;

    return {
        command,
        startedAt: startedAt.toISOString(),
        endedAt: endedAt.toISOString(),
        durationMs: endedAt.getTime() - startedAt.getTime(),
        exitCode,
        success: exitCode === 0,
        stdoutTail: tailLines(result.stdout),
        stderrTail: tailLines(result.stderr),
        error: result.error ? String(result.error.message || result.error) : '',
    };
}

function readJsonIfExists(filePath) {
    if (!fs.existsSync(filePath)) return null;
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function buildMarkdown(report) {
    const lines = [
        '# Public V6 Quality 150 Gate',
        '',
        `- Generated At: ${report.generatedAt}`,
        `- Status: ${report.ok ? 'PASS' : 'FAIL'}`,
        `- Quality Score: ${report.formula.quality_score}/${report.formula.max_score}`,
        `- Threshold: ${report.formula.threshold}`,
        `- Hard Gates: ${report.hard_gates.passed ? 'PASS' : 'FAIL'}`,
        '',
        '## Formula',
        '',
        `- visual_contract.passed: ${report.visual_contract.passed}/${report.visual_contract.total}`,
        `- sony_parity.summary.passed: ${report.sony_parity.passed}/${report.sony_parity.total}`,
        `- sony_live_evidence.summary.live_parity_passed: ${report.sony_live_evidence.live_parity_passed}/${report.sony_live_evidence.live_parity_total}`,
        `- quality_score = ${report.formula.quality_score}`,
        '',
        '## Hard Gates',
        '',
        '| Gate | Status | Command | Exit |',
        '| --- | --- | --- | --- |',
        ...report.hard_gates.results.map(
            (gate) =>
                `| ${gate.label} | ${gate.status.toUpperCase()} | \`${gate.command}\` | ${gate.exitCode} |`
        ),
        '',
        '## Artifacts',
        '',
        `- visual_contract: ${report.visual_contract.path || 'missing'}`,
        `- sony_parity: ${report.sony_parity.path || 'missing'}`,
        `- sony_live_evidence: ${report.sony_live_evidence.path || 'missing'}`,
        `- performance_gate: ${report.performance_gate.path || 'missing'}`,
        '',
    ];

    if (report.failures.length) {
        lines.push('## Failures');
        lines.push('');
        report.failures.forEach((failure) => {
            lines.push(`- ${failure}`);
        });
        lines.push('');
    }

    return `${lines.join('\n')}\n`;
}

function main() {
    fs.mkdirSync(OUT_DIR, { recursive: true });

    const gateResults = [];
    let canContinue = true;

    for (const gate of HARD_GATES) {
        if (!canContinue) {
            gateResults.push({
                id: gate.id,
                label: gate.label,
                command: gate.command,
                status: 'skipped',
                exitCode: -1,
                success: false,
                durationMs: 0,
                stdoutTail: '',
                stderrTail: '',
                error: '',
            });
            continue;
        }

        const result = runCommand(gate.command);
        gateResults.push({
            id: gate.id,
            label: gate.label,
            command: gate.command,
            status: result.success ? 'passed' : 'failed',
            exitCode: result.exitCode,
            success: result.success,
            durationMs: result.durationMs,
            startedAt: result.startedAt,
            endedAt: result.endedAt,
            stdoutTail: result.stdoutTail,
            stderrTail: result.stderrTail,
            error: result.error,
        });

        if (!result.success) {
            canContinue = false;
        }
    }

    const visualContract = readJsonIfExists(VISUAL_JSON);
    const sonyParity = readJsonIfExists(SONY_JSON);
    const sonyLiveEvidence = readJsonIfExists(SONY_LIVE_JSON);
    const performanceGate = readJsonIfExists(PERFORMANCE_JSON);

    const visualPassed = Number(visualContract?.passed || 0);
    const visualTotal = Number(visualContract?.total || 104);
    const sonyPassed = Number(sonyParity?.summary?.passed || 0);
    const sonyTotal = Number(sonyParity?.summary?.total || 50);
    const sonyLivePassed = Number(
        sonyLiveEvidence?.summary?.live_parity_passed || 0
    );
    const sonyLiveTotal = Number(
        sonyLiveEvidence?.summary?.live_parity_total || 10
    );
    const qualityScore = visualPassed + sonyPassed;
    const hardGatePassed = gateResults.every(
        (gate) => gate.status === 'passed'
    );

    const failures = [];
    const failedGate = gateResults.find((gate) => gate.status === 'failed');
    if (failedGate) {
        failures.push(`Hard gate failed: ${failedGate.label}`);
    }
    if (!fs.existsSync(VISUAL_JSON)) {
        failures.push(
            'Missing artifact: verification/public-v6-audit/visual-contract.json'
        );
    }
    if (!fs.existsSync(SONY_JSON)) {
        failures.push(
            'Missing artifact: verification/public-v6-audit/sony-parity-50.json'
        );
    }
    if (!fs.existsSync(SONY_LIVE_JSON)) {
        failures.push(
            'Missing artifact: verification/public-v6-audit/sony-live-evidence.json'
        );
    }
    if (sonyLivePassed < sonyLiveTotal) {
        failures.push(
            `Sony live evidence ${sonyLivePassed}/${sonyLiveTotal} must pass 10/10`
        );
    }
    if (qualityScore < 150) {
        failures.push(
            `Quality score ${qualityScore}/154 is below the 150 threshold`
        );
    }

    const report = {
        generatedAt: new Date().toISOString(),
        ok:
            hardGatePassed &&
            qualityScore >= 150 &&
            sonyLivePassed === sonyLiveTotal,
        formula: {
            visual_contract_passed: visualPassed,
            visual_contract_total: visualTotal,
            sony_parity_passed: sonyPassed,
            sony_parity_total: sonyTotal,
            quality_score: qualityScore,
            max_score: 154,
            threshold: 150,
        },
        hard_gates: {
            passed: hardGatePassed,
            total: HARD_GATES.length,
            results: gateResults,
        },
        visual_contract: {
            path: fs.existsSync(VISUAL_JSON)
                ? toPosix(path.relative(ROOT, VISUAL_JSON))
                : '',
            passed: visualPassed,
            total: visualTotal,
            ok: Boolean(visualContract?.ok),
        },
        sony_parity: {
            path: fs.existsSync(SONY_JSON)
                ? toPosix(path.relative(ROOT, SONY_JSON))
                : '',
            passed: sonyPassed,
            total: sonyTotal,
            ok: Boolean(sonyParity?.ok),
        },
        sony_live_evidence: {
            path: fs.existsSync(SONY_LIVE_JSON)
                ? toPosix(path.relative(ROOT, SONY_LIVE_JSON))
                : '',
            live_parity_passed: sonyLivePassed,
            live_parity_total: sonyLiveTotal,
            ok: Boolean(sonyLiveEvidence?.ok),
        },
        performance_gate: {
            path: fs.existsSync(PERFORMANCE_JSON)
                ? toPosix(path.relative(ROOT, PERFORMANCE_JSON))
                : '',
            passed: Boolean(performanceGate?.passed),
        },
        failures,
    };

    fs.writeFileSync(
        OUTPUT_JSON,
        `${JSON.stringify(report, null, 2)}\n`,
        'utf8'
    );
    fs.writeFileSync(OUTPUT_MD, buildMarkdown(report), 'utf8');

    process.stdout.write(
        [
            `Public V6 quality150 gate: ${report.ok ? 'PASS' : 'FAIL'}`,
            `Quality score: ${qualityScore}/154`,
            `Artifacts:`,
            `- ${toPosix(path.relative(ROOT, OUTPUT_JSON))}`,
            `- ${toPosix(path.relative(ROOT, OUTPUT_MD))}`,
            '',
        ].join('\n')
    );

    if (!report.ok) {
        process.exitCode = 1;
    }
}

main();
