#!/usr/bin/env node
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const {
    buildCodexActiveComment,
    upsertCodexActiveBlock,
    buildCodexCheckReport,
} = require('../../tools/agent-orchestrator/domain/codex-mirror');
const {
    normalizePathToken,
} = require('../../tools/agent-orchestrator/domain/conflicts');

const ACTIVE_STATUSES = new Set(['ready', 'in_progress', 'review', 'blocked']);

test('codex-mirror helpers construyen y upsertan bloque CODEX_ACTIVE', () => {
    const comment = buildCodexActiveComment(
        {
            block: 'C1',
            task_id: 'CDX-001',
            status: 'in_progress',
            files: ['AGENTS.md', 'agent-orchestrator.js'],
        },
        {
            serializeArrayInline: (values) => `["${values.join('", "')}"]`,
            currentDate: () => '2026-02-25',
        }
    );

    assert.match(comment, /<!-- CODEX_ACTIVE/);
    assert.match(comment, /task_id: CDX-001/);
    assert.match(comment, /updated_at: 2026-02-25/);

    const raw = `# Plan\n\nRelacion con Operativo 2026:\n- x\n`;
    const next = upsertCodexActiveBlock(
        raw,
        {
            block: 'C1',
            task_id: 'CDX-001',
            status: 'in_progress',
            files: ['AGENTS.md'],
            updated_at: '2026-02-25',
        },
        {
            buildComment: (block) =>
                buildCodexActiveComment(block, {
                    serializeArrayInline: (values) =>
                        `["${values.join('", "')}"]`,
                    currentDate: () => '2026-02-25',
                }),
        }
    );

    assert.match(next, /CODEX_ACTIVE/);
    assert.match(next, /Relacion con Operativo 2026:/);

    const removed = upsertCodexActiveBlock(next, null);
    assert.equal(/CODEX_ACTIVE/.test(removed), false);
});

test('codex-mirror engine valida espejo alineado', () => {
    const report = buildCodexCheckReport(
        {
            board: {
                tasks: [
                    {
                        id: 'CDX-001',
                        executor: 'codex',
                        status: 'in_progress',
                        files: ['AGENTS.md', 'agent-orchestrator.js'],
                    },
                ],
            },
            blocks: [
                {
                    block: 'C1',
                    task_id: 'CDX-001',
                    status: 'in_progress',
                    files: ['AGENTS.md', 'agent-orchestrator.js'],
                    updated_at: '2026-02-25',
                },
            ],
            codexPlanPath: 'PLAN_MAESTRO_CODEX_2026.md',
        },
        {
            normalizePathToken,
            activeStatuses: ACTIVE_STATUSES,
        }
    );

    assert.equal(report.ok, true);
    assert.equal(report.error_count, 0);
    assert.equal(report.summary.codex_in_progress, 1);
});

test('codex-mirror engine detecta drift de status y file no reservado', () => {
    const report = buildCodexCheckReport(
        {
            board: {
                tasks: [
                    {
                        id: 'CDX-001',
                        executor: 'codex',
                        status: 'review',
                        files: ['AGENTS.md'],
                    },
                ],
            },
            blocks: [
                {
                    block: 'C1',
                    task_id: 'CDX-001',
                    status: 'in_progress',
                    files: ['AGENTS.md', 'agent-orchestrator.js'],
                    updated_at: '2026-02-25',
                },
            ],
            codexPlanPath: 'PLAN_MAESTRO_CODEX_2026.md',
        },
        {
            normalizePathToken,
            activeStatuses: ACTIVE_STATUSES,
        }
    );

    assert.equal(report.ok, false);
    assert.equal(report.error_count >= 2, true);
    assert.equal(
        report.errors.some((e) => /status desalineado/i.test(String(e))),
        true
    );
    assert.equal(
        report.errors.some((e) => /no reservado en board/i.test(String(e))),
        true
    );
});
