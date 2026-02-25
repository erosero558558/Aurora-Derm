#!/usr/bin/env node
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const coreIo = require('../../tools/agent-orchestrator/core/io');

test('core-io writeBoardFile actualiza policy.updated_at y escribe serialized board', () => {
    const writes = [];
    const board = {
        version: 1,
        policy: { canonical: 'AGENTS.md' },
        tasks: [],
    };

    const result = coreIo.writeBoardFile(board, {
        currentDate: () => '2026-02-25',
        boardPath: 'AGENT_BOARD.yaml',
        serializeBoard: (b) => {
            assert.equal(b.policy.updated_at, '2026-02-25');
            return 'serialized-board\n';
        },
        writeFile: (...args) => writes.push(args),
    });

    assert.equal(result.policy.updated_at, '2026-02-25');
    assert.equal(writes.length, 1);
    assert.deepEqual(writes[0], [
        'AGENT_BOARD.yaml',
        'serialized-board\n',
        'utf8',
    ]);
});

test('core-io resolveTaskEvidencePath respeta --evidence y fallback a evidenceDir', () => {
    const custom = coreIo.resolveTaskEvidencePath(
        'AG-001',
        { evidence: 'verification/agent-runs/custom.md' },
        {
            rootPath: 'C:\\repo',
            evidenceDirPath: 'C:\\repo\\verification\\agent-runs',
            resolvePath: (...parts) => parts.join('|'),
        }
    );
    assert.equal(custom, 'C:\\repo|verification/agent-runs/custom.md');

    const fallback = coreIo.resolveTaskEvidencePath(
        'AG-001',
        {},
        {
            rootPath: 'C:\\repo',
            evidenceDirPath: 'C:\\repo\\verification\\agent-runs',
            resolvePath: (...parts) => parts.join('|'),
        }
    );
    assert.equal(fallback, 'C:\\repo\\verification\\agent-runs|AG-001.md');
});

test('core-io toRelativeRepoPath normaliza slashes y recorta root', () => {
    const rel = coreIo.toRelativeRepoPath(
        'C:\\repo\\verification\\agent-runs\\AG-001.md',
        { rootPath: 'C:\\repo' }
    );
    assert.equal(rel, 'verification/agent-runs/AG-001.md');

    const passthrough = coreIo.toRelativeRepoPath('/tmp/file.txt', {
        rootPath: 'C:\\repo',
    });
    assert.equal(passthrough, '/tmp/file.txt');
});

test('core-io writeCodexActiveBlockFile usa upsert y persiste contenido', () => {
    const writes = [];
    const next = coreIo.writeCodexActiveBlockFile(
        { task_id: 'CDX-001' },
        {
            codexPlanPath: 'PLAN_MAESTRO_CODEX_2026.md',
            exists: () => true,
            readFile: (path, enc) => {
                assert.equal(path, 'PLAN_MAESTRO_CODEX_2026.md');
                assert.equal(enc, 'utf8');
                return '# Plan\n';
            },
            upsertCodexActiveBlock: (raw, block) => {
                assert.equal(raw, '# Plan\n');
                assert.equal(block.task_id, 'CDX-001');
                return '# Plan\n<!-- CODEX_ACTIVE -->\n';
            },
            writeFile: (...args) => writes.push(args),
        }
    );

    assert.equal(next, '# Plan\n<!-- CODEX_ACTIVE -->\n');
    assert.deepEqual(writes[0], [
        'PLAN_MAESTRO_CODEX_2026.md',
        '# Plan\n<!-- CODEX_ACTIVE -->\n',
        'utf8',
    ]);
});

test('core-io syncDerivedQueuesFiles escribe colas derivadas y puede silenciar log', () => {
    const writes = [];
    const logs = [];

    const summary = coreIo.syncDerivedQueuesFiles(
        { silent: true },
        {
            parseBoard: () => ({
                tasks: [
                    { id: 'AG-001', executor: 'jules' },
                    { id: 'AG-002', executor: 'kimi' },
                    { id: 'AG-003', executor: 'codex' },
                ],
            }),
            parseTaskMetaMap: (path) => ({ path }),
            renderQueueFile: (kind, tasks, meta) =>
                `${kind}:${tasks.length}:${meta.path}\n`,
            julesPath: 'JULES_TASKS.md',
            kimiPath: 'KIMI_TASKS.md',
            writeFile: (...args) => writes.push(args),
            log: (msg) => logs.push(msg),
        }
    );

    assert.deepEqual(summary, { jules_tasks: 1, kimi_tasks: 1 });
    assert.equal(logs.length, 0);
    assert.equal(writes.length, 2);
    assert.deepEqual(writes[0], [
        'JULES_TASKS.md',
        'jules:1:JULES_TASKS.md\n',
        'utf8',
    ]);
    assert.deepEqual(writes[1], [
        'KIMI_TASKS.md',
        'kimi:1:KIMI_TASKS.md\n',
        'utf8',
    ]);
});

test('core-io syncDerivedQueuesFiles valida dependencias requeridas', () => {
    assert.throws(
        () =>
            coreIo.syncDerivedQueuesFiles(
                {},
                { parseBoard: () => ({ tasks: [] }) }
            ),
        /parseTaskMetaMap/i
    );
});
