#!/usr/bin/env node
'use strict';

const { existsSync, readFileSync, writeFileSync } = require('fs');
const { resolve } = require('path');

const DEFAULT_BOARD_PATH = resolve(__dirname, '..', 'AGENT_BOARD.yaml');

function parseArgs(argv = []) {
    let file = DEFAULT_BOARD_PATH;
    let json = false;
    let checkOnly = false;

    for (let i = 0; i < argv.length; i += 1) {
        const arg = String(argv[i] || '').trim();
        if (arg === '--json') {
            json = true;
            continue;
        }
        if (arg === '--check') {
            checkOnly = true;
            continue;
        }
        if (arg === '--file') {
            const next = String(argv[i + 1] || '').trim();
            if (!next) {
                throw new Error('--file requiere una ruta');
            }
            file = resolve(process.cwd(), next);
            i += 1;
        }
    }

    return { file, json, checkOnly };
}

function parseRevisionLine(segment) {
    const lines = String(segment || '')
        .split('\n')
        .map((line) => line.replace(/\r$/, ''))
        .filter((line) => line.trim() !== '');

    if (lines.length !== 1) return null;
    const match = lines[0].match(/^(\s*)revision:\s*(\d+)\s*$/);
    if (!match) return null;
    return {
        indent: match[1] || '',
        revision: Number(match[2]),
    };
}

function parseTaskIdLine(segment) {
    const matches = String(segment || '')
        .split('\n')
        .map((line) => line.replace(/\r$/, ''))
        .join('\n')
        .match(/^(\s*-\s*id:\s*)(AG-(\d+))\s*$/m);
    if (!matches) return null;
    return {
        prefix: matches[1] || '',
        id: matches[2],
        numericId: Number(matches[3]),
    };
}

function buildTaskId(idNumber) {
    return `AG-${String(Math.max(0, Number(idNumber) || 0)).padStart(3, '0')}`;
}

function collectMaxTaskId(raw) {
    const pattern = /^\s*-\s*id:\s*AG-(\d+)\s*$/gm;
    let max = 0;
    let match = pattern.exec(String(raw || ''));
    while (match) {
        const value = Number(match[1]);
        if (Number.isFinite(value) && value > max) {
            max = value;
        }
        match = pattern.exec(String(raw || ''));
    }
    return max;
}

function rewriteFirstTaskId(segment, replacementId) {
    let replaced = false;
    const content = String(segment || '');
    return content.replace(/^(\s*-\s*id:\s*)(AG-\d+)\s*$/m, (full, prefix) => {
        if (replaced) return full;
        replaced = true;
        return `${prefix}${replacementId}`;
    });
}

function trimOuterNewlines(value) {
    return String(value || '').replace(/^\n+|\n+$/g, '');
}

function parseTaskConflictVariants(taskBlock) {
    const lines = String(taskBlock || '')
        .split('\n')
        .map((line) => line.replace(/\r$/, ''));

    const left = [];
    const right = [];
    let mode = 'normal';
    let conflicts = 0;

    for (const line of lines) {
        if (/^<<<<<<<[^\n]*$/.test(line)) {
            if (mode !== 'normal') {
                return { ok: false, left: [], right: [], conflicts: 0 };
            }
            mode = 'left';
            conflicts += 1;
            continue;
        }
        if (/^=======$/.test(line)) {
            if (mode !== 'left') {
                return { ok: false, left: [], right: [], conflicts: 0 };
            }
            mode = 'right';
            continue;
        }
        if (/^>>>>>>>[^\n]*$/.test(line)) {
            if (mode !== 'right') {
                return { ok: false, left: [], right: [], conflicts: 0 };
            }
            mode = 'normal';
            continue;
        }

        if (mode === 'normal') {
            left.push(line);
            right.push(line);
        } else if (mode === 'left') {
            left.push(line);
        } else if (mode === 'right') {
            right.push(line);
        }
    }

    if (mode !== 'normal' || conflicts === 0) {
        return { ok: false, left: [], right: [], conflicts: 0 };
    }

    return { ok: true, left, right, conflicts };
}

function mergeTaskBlocks(left, right, options) {
    const leftTask = parseTaskIdLine(left);
    const rightTask = parseTaskIdLine(right);
    if (!leftTask || !rightTask) return null;

    const leftContent = trimOuterNewlines(left);
    const rightContent = trimOuterNewlines(right);
    if (!leftContent || !rightContent) return null;

    if (leftTask.id === rightTask.id) {
        const nextValue = options.nextTaskNumericId;
        const remappedId = buildTaskId(nextValue);
        options.nextTaskNumericId += 1;
        const rightRemapped = rewriteFirstTaskId(rightContent, remappedId);
        return {
            content: `${leftContent}\n\n${rightRemapped}\n`,
            diagnostics: {
                kind: 'task_id_conflict_resolved',
                left_id: leftTask.id,
                right_id: rightTask.id,
                remapped_to: remappedId,
            },
        };
    }

    return {
        content: `${leftContent}\n\n${rightContent}\n`,
        diagnostics: {
            kind: 'task_blocks_merged',
            left_id: leftTask.id,
            right_id: rightTask.id,
        },
    };
}

function resolveTaskScopedConflicts(raw, options) {
    const lines = String(raw || '')
        .split('\n')
        .map((line) => line.replace(/\r$/, ''));
    const taskLinePattern = /^\s*-\s*id:\s*AG-\d+\s*$/;

    const resolved = [];
    const diagnostics = [];
    let replaced = 0;

    let index = 0;
    while (index < lines.length) {
        const line = lines[index];
        if (!taskLinePattern.test(line)) {
            resolved.push(line);
            index += 1;
            continue;
        }

        const start = index;
        let end = index + 1;
        while (end < lines.length && !taskLinePattern.test(lines[end])) {
            end += 1;
        }

        const taskBlock = lines.slice(start, end).join('\n');
        if (
            !taskBlock.includes('<<<<<<<') ||
            !taskBlock.includes('=======') ||
            !taskBlock.includes('>>>>>>>')
        ) {
            resolved.push(...lines.slice(start, end));
            index = end;
            continue;
        }

        const variants = parseTaskConflictVariants(taskBlock);
        if (!variants.ok) {
            resolved.push(...lines.slice(start, end));
            index = end;
            continue;
        }

        const leftContent = trimOuterNewlines(variants.left.join('\n'));
        const rightContent = trimOuterNewlines(variants.right.join('\n'));
        const leftTask = parseTaskIdLine(leftContent);
        const rightTask = parseTaskIdLine(rightContent);
        if (!leftTask || !rightTask) {
            resolved.push(...lines.slice(start, end));
            index = end;
            continue;
        }

        if (leftContent === rightContent) {
            resolved.push(...leftContent.split('\n'));
            replaced += 1;
            diagnostics.push({
                kind: 'task_conflict_identical_variants',
                task_id: leftTask.id,
                conflicts: variants.conflicts,
            });
            index = end;
            continue;
        }

        if (leftTask.id === rightTask.id) {
            const remappedId = buildTaskId(options.nextTaskNumericId);
            options.nextTaskNumericId += 1;
            const rightRemapped = rewriteFirstTaskId(rightContent, remappedId);

            resolved.push(...leftContent.split('\n'));
            resolved.push('');
            resolved.push(...rightRemapped.split('\n'));
            replaced += 1;
            diagnostics.push({
                kind: 'task_semantic_conflict_resolved',
                left_id: leftTask.id,
                right_id: rightTask.id,
                remapped_to: remappedId,
                conflicts: variants.conflicts,
            });
            index = end;
            continue;
        }

        resolved.push(...leftContent.split('\n'));
        resolved.push('');
        resolved.push(...rightContent.split('\n'));
        replaced += 1;
        diagnostics.push({
            kind: 'task_blocks_merged',
            left_id: leftTask.id,
            right_id: rightTask.id,
            conflicts: variants.conflicts,
        });
        index = end;
    }

    return {
        replaced,
        diagnostics,
        resolvedContent: resolved.join('\n'),
    };
}

function resolveRevisionConflicts(raw) {
    const input = String(raw || '');
    const conflictPattern =
        /^<<<<<<<[^\n]*\n([\s\S]*?)^=======\n([\s\S]*?)^>>>>>>>[^\n]*\n?/gm;
    let resolved = input;
    let replaced = 0;
    let remaining = 0;
    const diagnostics = [];
    const mergeOptions = {
        nextTaskNumericId: collectMaxTaskId(input) + 1,
    };

    resolved = resolved.replace(
        conflictPattern,
        (fullMatch, left, right, offset) => {
            const leftRevision = parseRevisionLine(left);
            const rightRevision = parseRevisionLine(right);
            if (leftRevision && rightRevision) {
                replaced += 1;
                const revision = Math.max(
                    leftRevision.revision,
                    rightRevision.revision
                );
                const indent =
                    leftRevision.indent || rightRevision.indent || '  ';
                diagnostics.push({
                    kind: 'revision_conflict_resolved',
                    offset,
                    left_revision: leftRevision.revision,
                    right_revision: rightRevision.revision,
                    resolved_revision: revision,
                });
                return `${indent}revision: ${revision}\n`;
            }

            const mergedTask = mergeTaskBlocks(left, right, mergeOptions);
            if (mergedTask) {
                replaced += 1;
                diagnostics.push({
                    offset,
                    ...mergedTask.diagnostics,
                });
                return mergedTask.content;
            }

            remaining += 1;
            diagnostics.push({
                kind: 'non_revision_conflict',
                offset,
            });
            return fullMatch;
        }
    );

    const taskScoped = resolveTaskScopedConflicts(resolved, mergeOptions);
    if (taskScoped.replaced > 0) {
        replaced += taskScoped.replaced;
        diagnostics.push(...taskScoped.diagnostics);
        resolved = taskScoped.resolvedContent;
    }

    const unresolvedMarkers = (resolved.match(/^<<<<<<<[^\n]*$/gm) || [])
        .length;
    if (unresolvedMarkers === 0) {
        for (let i = diagnostics.length - 1; i >= 0; i -= 1) {
            if (
                diagnostics[i] &&
                diagnostics[i].kind === 'non_revision_conflict'
            ) {
                diagnostics.splice(i, 1);
            }
        }
    }
    remaining = unresolvedMarkers;

    const hasUnresolvedMarkers = unresolvedMarkers > 0;

    return {
        replaced,
        remaining,
        diagnostics,
        hasUnresolvedMarkers,
        changed: replaced > 0 && resolved !== input,
        resolvedContent: resolved,
    };
}

function print(payload, asJson) {
    if (asJson) {
        console.log(JSON.stringify(payload, null, 2));
        return;
    }

    const status = payload.ok ? 'OK' : 'FAIL';
    console.log(
        `${status}: replaced=${payload.replaced}, remaining=${payload.remaining}, file=${payload.file}`
    );
    if (payload.diagnostics.length > 0) {
        for (const item of payload.diagnostics) {
            if (item.kind === 'revision_conflict_resolved') {
                console.log(
                    `- resolved revision conflict at ${item.offset}: ${item.left_revision} vs ${item.right_revision} -> ${item.resolved_revision}`
                );
            } else if (item.kind === 'task_id_conflict_resolved') {
                console.log(
                    `- resolved task id conflict at ${item.offset}: ${item.left_id} + ${item.right_id} -> ${item.remapped_to}`
                );
            } else if (item.kind === 'task_blocks_merged') {
                console.log(
                    `- merged task blocks at ${item.offset}: ${item.left_id} + ${item.right_id}`
                );
            } else if (item.kind === 'task_semantic_conflict_resolved') {
                console.log(
                    `- resolved semantic task conflict: ${item.left_id} + ${item.right_id} -> ${item.remapped_to}`
                );
            } else if (item.kind === 'task_conflict_identical_variants') {
                console.log(
                    `- resolved identical task conflict variants: ${item.task_id}`
                );
            } else {
                console.log(
                    `- unresolved non-revision conflict at ${item.offset}`
                );
            }
        }
    }
}

function run(argv = process.argv.slice(2)) {
    const opts = parseArgs(argv);
    if (!existsSync(opts.file)) {
        const payload = {
            version: 1,
            ok: false,
            error_code: 'board_not_found',
            error: `No existe archivo: ${opts.file}`,
            file: opts.file,
        };
        print(payload, opts.json);
        return 1;
    }

    const raw = readFileSync(opts.file, 'utf8');
    const result = resolveRevisionConflicts(raw);

    if (!opts.checkOnly && result.changed && !result.hasUnresolvedMarkers) {
        writeFileSync(opts.file, result.resolvedContent, 'utf8');
    }

    const payload = {
        version: 1,
        ok: result.remaining === 0,
        file: opts.file,
        mode: opts.checkOnly ? 'check' : 'write',
        replaced: result.replaced,
        remaining: result.remaining,
        changed: result.changed,
        diagnostics: result.diagnostics,
        error_code:
            result.remaining > 0 ? 'non_revision_conflict_detected' : '',
    };

    print(payload, opts.json);
    return payload.ok ? 0 : 2;
}

if (require.main === module) {
    process.exit(run());
}

module.exports = {
    parseArgs,
    parseRevisionLine,
    parseTaskIdLine,
    collectMaxTaskId,
    parseTaskConflictVariants,
    mergeTaskBlocks,
    resolveTaskScopedConflicts,
    resolveRevisionConflicts,
    run,
};
