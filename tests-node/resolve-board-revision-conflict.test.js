#!/usr/bin/env node
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { mkdtempSync, readFileSync, writeFileSync, existsSync } = require('fs');
const { join } = require('path');
const { tmpdir } = require('os');

const resolver = require('../bin/resolve-board-revision-conflict.js');

test('resolveRevisionConflicts resuelve conflicto de revision usando maximo', () => {
    const raw = `version: 1
policy:
<<<<<<< HEAD
  revision: 89
=======
  revision: 93
>>>>>>> incoming
  updated_at: 2026-02-25
`;
    const result = resolver.resolveRevisionConflicts(raw);
    assert.equal(result.replaced, 1);
    assert.equal(result.remaining, 0);
    assert.equal(result.hasUnresolvedMarkers, false);
    assert.match(result.resolvedContent, /\n {2}revision: 93\n/);
    assert.doesNotMatch(result.resolvedContent, /<<<<<<<|=======|>>>>>>>/);
});

test('resolveRevisionConflicts no toca conflictos no relacionados a revision', () => {
    const raw = `version: 1
policy:
<<<<<<< HEAD
  revision: 89
  updated_at: 2026-02-24
=======
  revision: 90
  updated_at: 2026-02-25
>>>>>>> incoming
`;
    const result = resolver.resolveRevisionConflicts(raw);
    assert.equal(result.replaced, 0);
    assert.equal(result.remaining, 1);
    assert.equal(result.hasUnresolvedMarkers, true);
    assert.match(result.resolvedContent, /<<<<<<< HEAD/);
});

test('run escribe archivo en modo write cuando conflicto es solo revision', () => {
    const dir = mkdtempSync(join(tmpdir(), 'board-revision-fix-'));
    const boardPath = join(dir, 'AGENT_BOARD.yaml');
    writeFileSync(
        boardPath,
        `version: 1
policy:
<<<<<<< ours
  revision: 100
=======
  revision: 102
>>>>>>> theirs
  updated_at: 2026-02-25
`,
        'utf8'
    );

    const code = resolver.run(['--file', boardPath]);
    assert.equal(code, 0);
    assert.equal(existsSync(boardPath), true);
    const updated = readFileSync(boardPath, 'utf8');
    assert.match(updated, /\n {2}revision: 102\n/);
    assert.doesNotMatch(updated, /<<<<<<<|=======|>>>>>>>/);
});

test('resolveRevisionConflicts remapea task id duplicado y conserva ambos bloques', () => {
    const raw = `version: 1
tasks:
  - id: AG-070
    title: "previo"
<<<<<<< HEAD
  - id: AG-071
    title: "frontend"
=======
  - id: AG-071
    title: "backend"
>>>>>>> incoming
`;
    const result = resolver.resolveRevisionConflicts(raw);
    assert.equal(result.remaining, 0);
    assert.equal(result.hasUnresolvedMarkers, false);
    assert.match(
        result.resolvedContent,
        /- id: AG-071\s*\n\s*title: "frontend"/
    );
    assert.match(
        result.resolvedContent,
        /- id: AG-072\s*\n\s*title: "backend"/
    );
    assert.equal(
        result.diagnostics.some(
            (item) => item.kind === 'task_id_conflict_resolved'
        ),
        true
    );
});

test('resolveRevisionConflicts mergea bloques de task con ids distintos', () => {
    const raw = `version: 1
tasks:
<<<<<<< HEAD
  - id: AG-071
    title: "frontend"
=======
  - id: AG-072
    title: "backend"
>>>>>>> incoming
`;
    const result = resolver.resolveRevisionConflicts(raw);
    assert.equal(result.remaining, 0);
    assert.equal(result.hasUnresolvedMarkers, false);
    assert.match(result.resolvedContent, /- id: AG-071/);
    assert.match(result.resolvedContent, /- id: AG-072/);
    assert.equal(
        result.diagnostics.some((item) => item.kind === 'task_blocks_merged'),
        true
    );
});

test('resolveRevisionConflicts resuelve colision semantica dentro de un mismo task id', () => {
    const raw = `version: 1
tasks:
  - id: AG-076
<<<<<<< HEAD
    title: "frontend"
    scope: frontend-qa
=======
    title: "backend"
    scope: tooling
>>>>>>> incoming
    source_signal: manual
<<<<<<< HEAD
    acceptance: "frontend"
=======
    acceptance: "backend"
>>>>>>> incoming
    updated_at: 2026-02-26
`;
    const result = resolver.resolveRevisionConflicts(raw);
    assert.equal(result.remaining, 0);
    assert.equal(result.hasUnresolvedMarkers, false);
    assert.match(
        result.resolvedContent,
        /- id: AG-076\s*\n\s*title: "frontend"\s*\n\s*scope: frontend-qa/
    );
    assert.match(
        result.resolvedContent,
        /- id: AG-077\s*\n\s*title: "backend"\s*\n\s*scope: tooling/
    );
    assert.equal(
        result.diagnostics.some(
            (item) => item.kind === 'task_semantic_conflict_resolved'
        ),
        true
    );
    assert.doesNotMatch(result.resolvedContent, /<<<<<<<|=======|>>>>>>>/);
});
