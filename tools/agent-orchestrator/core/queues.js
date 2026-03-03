'use strict';

const { existsSync, readFileSync } = require('fs');
const { normalizeEol } = require('./parsers');

function parseTaskMetaMap(path, deps = {}) {
    const {
        exists = existsSync,
        readFile = readFileSync,
        normalize = normalizeEol,
    } = deps;
    if (!exists(path)) return new Map();
    const raw = normalize(readFile(path, 'utf8'));
    const regex = /<!-- TASK\n([\s\S]*?)-->([\s\S]*?)<!-- \/TASK -->/g;
    const map = new Map();
    let match;

    while ((match = regex.exec(raw)) !== null) {
        const meta = {};
        for (const line of match[1].split('\n')) {
            const m = line.match(/^([\w-]+):\s*(.*)$/);
            if (m) meta[m[1]] = m[2].trim();
        }

        const id = meta.task_id;
        if (id) map.set(id, meta);
    }

    return map;
}

function boardToQueueStatus(taskStatus, executor) {
    if (taskStatus === 'done') return 'done';
    if (taskStatus === 'failed' || taskStatus === 'blocked') return 'failed';
    if (taskStatus === 'in_progress' || taskStatus === 'review') {
        return executor === 'jules' ? 'dispatched' : 'running';
    }
    return 'pending';
}

function formatOptionalMetaLine(key, rawValue) {
    const value = String(rawValue || '').trim();
    return value ? `${key}: ${value}` : `${key}:`;
}

function renderRetiredQueueTombstone() {
    return [
        '# Retired Derived Queue',
        '',
        'Este archivo queda preservado solo por compatibilidad historica.',
        'Desde 2026-03-03 el orquestador opera en modo codex-only y ya no genera ni sincroniza esta cola.',
        '',
    ].join('\n');
}

function renderQueueFile(executor, tasks, existingMeta) {
    void executor;
    void tasks;
    void existingMeta;
    return renderRetiredQueueTombstone();
}

module.exports = {
    parseTaskMetaMap,
    boardToQueueStatus,
    renderRetiredQueueTombstone,
    renderQueueFile,
};
