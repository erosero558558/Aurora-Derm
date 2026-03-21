'use strict';

const { existsSync, readFileSync } = require('fs');
const { relative, resolve } = require('path');

const TERMINAL_STATUSES = new Set(['done', 'failed']);
const DEFAULT_EVIDENCE_REL_DIR = 'verification/agent-runs';

function normalizeRelativePath(value) {
    return String(value || '')
        .replace(/\\/g, '/')
        .replace(/\/+/g, '/')
        .replace(/^\.\//, '')
        .replace(/\/$/, '')
        .trim();
}

function normalizeTaskStatus(taskOrStatus) {
    if (taskOrStatus && typeof taskOrStatus === 'object') {
        return String(taskOrStatus.status || '')
            .trim()
            .toLowerCase();
    }
    return String(taskOrStatus || '')
        .trim()
        .toLowerCase();
}

function isTerminalTaskStatus(taskOrStatus) {
    return TERMINAL_STATUSES.has(normalizeTaskStatus(taskOrStatus));
}

function expectedEvidenceRef(taskId, options = {}) {
    const normalizedTaskId = String(taskId || '').trim();
    if (!normalizedTaskId) {
        throw new Error('expectedEvidenceRef requiere taskId');
    }

    const evidenceDirRef = normalizeRelativePath(
        options.evidenceDirRef || options.evidence_dir || ''
    );
    if (evidenceDirRef) {
        return `${evidenceDirRef}/${normalizedTaskId}.md`;
    }

    const rootDir = resolve(String(options.rootDir || process.cwd()));
    const evidenceDir = options.evidenceDir
        ? resolve(String(options.evidenceDir))
        : resolve(rootDir, DEFAULT_EVIDENCE_REL_DIR);
    const relDir =
        normalizeRelativePath(relative(rootDir, evidenceDir)) ||
        DEFAULT_EVIDENCE_REL_DIR;
    return `${relDir}/${normalizedTaskId}.md`;
}

function analyzeTerminalTaskEvidence(task, options = {}, deps = {}) {
    const fileExists = deps.existsSync || existsSync;
    const fileRead = deps.readFileSync || readFileSync;
    const rootDir = resolve(String(options.rootDir || process.cwd()));
    const status = normalizeTaskStatus(task);
    const taskId = String(task?.id || '').trim();
    const expectedRef = expectedEvidenceRef(taskId, options);
    const expectedPath = resolve(rootDir, expectedRef);
    const expectedExists = fileExists(expectedPath);

    const evidenceRef = normalizeRelativePath(task?.evidence_ref || '');
    const acceptanceRef = normalizeRelativePath(task?.acceptance_ref || '');
    const evidenceRefExists = evidenceRef
        ? fileExists(resolve(rootDir, evidenceRef))
        : false;
    const acceptanceRefExists = acceptanceRef
        ? fileExists(resolve(rootDir, acceptanceRef))
        : false;
    const refsAligned =
        evidenceRef === expectedRef && acceptanceRef === expectedRef;

    let reason = 'aligned';
    if (!evidenceRef && !acceptanceRef) {
        reason = 'missing_refs';
    } else if (!expectedExists) {
        reason = 'missing_expected_file';
    } else if (!refsAligned) {
        reason = 'noncanonical_ref';
    } else if (isReconstructedEvidencePath(expectedPath, { fileExists, fileRead })) {
        reason = 'reconstructed_evidence';
    }

    return {
        id: taskId,
        status,
        terminal: isTerminalTaskStatus(status),
        expected_ref: expectedRef,
        expected_path: expectedPath,
        expected_exists: expectedExists,
        refs_aligned: refsAligned,
        reason,
        debt: reason !== 'aligned',
        evidence_ref: evidenceRef,
        evidence_ref_exists: evidenceRefExists,
        acceptance_ref: acceptanceRef,
        acceptance_ref_exists: acceptanceRefExists,
        has_refs: Boolean(evidenceRef || acceptanceRef),
    };
}

function isReconstructedEvidencePath(filePath, deps = {}) {
    const fileExists = deps.existsSync || existsSync;
    const fileRead = deps.readFileSync || readFileSync;
    if (!filePath || !fileExists(filePath)) {
        return false;
    }
    try {
        const source = String(fileRead(filePath, 'utf8') || '');
        return (
            source.includes('Reconstructed Evidence') ||
            source.includes('Reconstructed on ')
        );
    } catch {
        return false;
    }
}

function buildTerminalEvidenceReport(tasks = [], options = {}, deps = {}) {
    const rows = (Array.isArray(tasks) ? tasks : [])
        .filter((task) => isTerminalTaskStatus(task))
        .map((task) => analyzeTerminalTaskEvidence(task, options, deps))
        .sort((left, right) =>
            String(left.id || '').localeCompare(
                String(right.id || ''),
                undefined,
                {
                    numeric: true,
                }
            )
        );

    const debtRows = rows.filter((row) => row.debt);
    return {
        rows,
        summary: {
            terminal_tasks: rows.length,
            aligned_count: rows.filter((row) => !row.debt).length,
            missing_expected_count: rows.filter(
                (row) => row.reason === 'missing_expected_file'
            ).length,
            missing_refs_count: rows.filter(
                (row) => row.reason === 'missing_refs'
            ).length,
            noncanonical_count: rows.filter(
                (row) => row.reason === 'noncanonical_ref'
            ).length,
            reconstructed_count: rows.filter(
                (row) => row.reason === 'reconstructed_evidence'
            ).length,
            debt_count: debtRows.length,
            sample_task_ids: debtRows
                .slice(
                    0,
                    Number(options.sampleLimit) > 0 ? options.sampleLimit : 5
                )
                .map((row) => row.id),
        },
    };
}

function buildTerminalEvidenceMeta(row) {
    return {
        expected_ref: row.expected_ref,
        expected_exists: Boolean(row.expected_exists),
        refs_aligned: Boolean(row.refs_aligned),
        reason: row.reason,
        evidence_ref: row.evidence_ref,
        acceptance_ref: row.acceptance_ref,
        reconstructed_evidence: row.reason === 'reconstructed_evidence',
    };
}

function buildTerminalEvidenceMessage(row, options = {}) {
    const taskLabel = `Task ${row.id} ${row.status || 'terminal'}`;
    const expectedLabel =
        row.expected_ref || `${DEFAULT_EVIDENCE_REL_DIR}/${row.id}.md`;
    let message = `${taskLabel} con evidencia canónica (${expectedLabel})`;

    if (row.reason === 'missing_refs') {
        message = `${taskLabel} sin refs de evidencia canónica (expected ${expectedLabel})`;
    } else if (row.reason === 'missing_expected_file') {
        message = `${taskLabel} sin archivo de evidencia canónico (${expectedLabel})`;
    } else if (row.reason === 'noncanonical_ref') {
        message = `${taskLabel} con refs no canónicos (expected ${expectedLabel})`;
    } else if (row.reason === 'reconstructed_evidence') {
        message = `${taskLabel} con evidencia reconstruida y no definitiva (${expectedLabel})`;
    }

    if (options.includeRefs === true && row.reason !== 'aligned') {
        message += `; evidence_ref=${row.evidence_ref || '(empty)'}; acceptance_ref=${row.acceptance_ref || '(empty)'}`;
    }

    return message;
}

function applyCanonicalEvidenceRefs(task, evidenceRef) {
    const canonicalRef = normalizeRelativePath(evidenceRef);
    task.acceptance_ref = canonicalRef;
    task.evidence_ref = canonicalRef;
    return task;
}

module.exports = {
    DEFAULT_EVIDENCE_REL_DIR,
    normalizeRelativePath,
    normalizeTaskStatus,
    isTerminalTaskStatus,
    expectedEvidenceRef,
    analyzeTerminalTaskEvidence,
    isReconstructedEvidencePath,
    buildTerminalEvidenceReport,
    buildTerminalEvidenceMeta,
    buildTerminalEvidenceMessage,
    applyCanonicalEvidenceRefs,
};
