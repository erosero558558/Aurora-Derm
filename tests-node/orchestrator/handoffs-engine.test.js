#!/usr/bin/env node
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const {
    getHandoffLintErrors,
} = require('../../tools/agent-orchestrator/domain/handoffs');
const {
    analyzeFileOverlap,
    normalizePathToken,
} = require('../../tools/agent-orchestrator/domain/conflicts');

const ACTIVE_STATUSES = new Set(['ready', 'in_progress', 'review', 'blocked']);

test('handoffs-engine valida subset de solape real y estado activo', () => {
    const errors = getHandoffLintErrors(
        {
            board: {
                tasks: [
                    {
                        id: 'AG-001',
                        status: 'in_progress',
                        files: ['docs/a.md', 'docs/b.md'],
                    },
                    {
                        id: 'CDX-001',
                        status: 'review',
                        files: ['docs/a.md'],
                    },
                ],
            },
            handoffData: {
                version: 1,
                handoffs: [
                    {
                        id: 'HO-001',
                        status: 'active',
                        from_task: 'AG-001',
                        to_task: 'CDX-001',
                        files: ['docs/b.md'],
                        created_at: '2026-02-25T00:00:00.000Z',
                        expires_at: '2026-02-25T04:00:00.000Z',
                    },
                ],
            },
        },
        {
            analyzeFileOverlap,
            normalizePathToken,
            isExpired: () => false,
            activeStatuses: ACTIVE_STATUSES,
        }
    );

    assert.equal(errors.length >= 1, true);
    assert.equal(
        errors.some((e) => /no pertenece al solape concreto/i.test(String(e))),
        true
    );
});

test('handoffs-engine acepta handoff activo valido', () => {
    const errors = getHandoffLintErrors(
        {
            board: {
                tasks: [
                    {
                        id: 'AG-001',
                        status: 'in_progress',
                        files: ['docs/a.md'],
                    },
                    {
                        id: 'CDX-001',
                        status: 'review',
                        files: ['docs/a.md'],
                    },
                ],
            },
            handoffData: {
                version: 1,
                handoffs: [
                    {
                        id: 'HO-001',
                        status: 'active',
                        from_task: 'AG-001',
                        to_task: 'CDX-001',
                        files: ['docs/a.md'],
                        created_at: '2026-02-25T00:00:00.000Z',
                        expires_at: '2026-02-25T04:00:00.000Z',
                    },
                ],
            },
        },
        {
            analyzeFileOverlap,
            normalizePathToken,
            isExpired: () => false,
            activeStatuses: ACTIVE_STATUSES,
        }
    );

    assert.deepEqual(errors, []);
});
