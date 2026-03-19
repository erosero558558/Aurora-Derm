import { readTurneroIncidentJournal } from './turnero-release-incident-journal.js';
import { readTurneroReleaseOwnerState } from './turnero-release-owner-state.js';
import {
    buildTurneroReleaseCheckpointMarkdown,
    buildTurneroReleaseCheckpointStats,
    readTurneroReleaseCheckpointScheduler,
} from './turnero-release-checkpoint-scheduler.js';
import {
    buildTurneroReleaseTimeline,
    buildTurneroReleaseTimelineMarkdown,
} from './turnero-release-timeline.js';
import { buildTurneroReleaseOwnershipBoard } from './turnero-release-ownership-board.js';
import { buildTurneroReleaseEscalationMatrix } from './turnero-release-escalation-matrix.js';

const STORAGE_PREFIX = 'turneroReleaseShiftHandoffV1';

function getStorage() {
    try {
        return typeof localStorage !== 'undefined' ? localStorage : null;
    } catch (_error) {
        return null;
    }
}

function toStorageKey(clinicId) {
    const value =
        String(clinicId || 'default-clinic').trim() || 'default-clinic';
    return `${STORAGE_PREFIX}:${value}`;
}

function toArray(value) {
    return Array.isArray(value) ? value.filter(Boolean) : [];
}

function asObject(value) {
    return value && typeof value === 'object' ? value : {};
}

function normalizeEntry(value = {}) {
    const source = asObject(value);
    return {
        author: String(source.author || 'local').trim(),
        shift: String(source.shift || 'actual').trim(),
        note: String(source.note || '').trim(),
        at: String(source.at || new Date().toISOString()).trim(),
    };
}

export function readTurneroReleaseShiftHandoffNotes(clinicId) {
    const storage = getStorage();
    if (!storage) return [];
    try {
        const raw = storage.getItem(toStorageKey(clinicId));
        const parsed = raw ? JSON.parse(raw) : [];
        const entries = Array.isArray(parsed)
            ? parsed
            : Array.isArray(parsed.notes)
              ? parsed.notes
              : Array.isArray(parsed.entries)
                ? parsed.entries
                : null;
        return entries ? entries.map(normalizeEntry) : [];
    } catch (_error) {
        return [];
    }
}

export function writeTurneroReleaseShiftHandoffNotes(clinicId, entries) {
    const storage = getStorage();
    const normalized = toArray(entries).map(normalizeEntry).slice(0, 20);
    if (!storage) return normalized;
    try {
        storage.setItem(toStorageKey(clinicId), JSON.stringify(normalized));
    } catch (_error) {
        return normalized;
    }
    return normalized;
}

export function appendTurneroReleaseShiftHandoffNote(clinicId, patch = {}) {
    const current = readTurneroReleaseShiftHandoffNotes(clinicId);
    current.unshift(
        normalizeEntry({
            ...asObject(patch),
            at: new Date().toISOString(),
        })
    );
    return writeTurneroReleaseShiftHandoffNotes(clinicId, current);
}

export function clearTurneroReleaseShiftHandoffNotes(clinicId) {
    const storage = getStorage();
    if (!storage) return false;
    try {
        storage.removeItem(toStorageKey(clinicId));
        return true;
    } catch (_error) {
        return false;
    }
}

function ownerStateSummary(ownerState) {
    return Object.entries(asObject(ownerState)).map(([owner, lane]) => {
        const status = lane?.status || 'pending';
        const ack = lane?.acknowledged ? 'ack' : 'no-ack';
        return `${owner}:${status}:${ack}`;
    });
}

export function buildTurneroReleaseShiftHandoff(snapshot, options = {}) {
    const board = buildTurneroReleaseOwnershipBoard(snapshot, options);
    const clinicId = board?.clinicId || 'default-clinic';
    const matrix = buildTurneroReleaseEscalationMatrix(snapshot, {
        ...options,
        decision: options.decision || board.decision,
    });
    const timeline = buildTurneroReleaseTimeline(snapshot, {
        ...options,
        decision: options.decision || board.decision,
    });
    const checkpoints = readTurneroReleaseCheckpointScheduler(
        clinicId,
        timeline
    );
    const checkpointStats = buildTurneroReleaseCheckpointStats(checkpoints);
    const notes = readTurneroReleaseShiftHandoffNotes(clinicId);
    const ownerState = readTurneroReleaseOwnerState(clinicId);
    const journalEntries = readTurneroIncidentJournal(clinicId);

    return {
        clinicId,
        profileFingerprint: board?.profileFingerprint || null,
        generatedAt: new Date().toISOString(),
        decision: board?.decision || 'review',
        decisionReason: board?.decisionReason || '',
        summary: {
            steps: timeline?.stepCount || 0,
            blockers: board?.ownerBreakdown?.blocker || 0,
            checkpoints: checkpointStats,
            owners: ownerStateSummary(ownerState),
            repeatedIncidents: toArray(journalEntries).length,
        },
        board,
        matrix,
        timeline,
        checkpoints,
        checkpointStats,
        ownerState,
        notes,
        journalEntries: toArray(journalEntries).slice(0, 10),
    };
}

export function buildTurneroReleaseShiftHandoffMarkdown(handoff) {
    const summary = asObject(handoff?.summary);
    const checkpoints = summary.checkpoints || {};
    const header = [
        `# Shift Handoff — ${String(handoff?.clinicId || 'default-clinic')}`,
        '',
        `- Fingerprint: ${handoff?.profileFingerprint || 'sin fingerprint'}`,
        `- Generado: ${handoff?.generatedAt || new Date().toISOString()}`,
        `- Decisión: ${handoff?.decision || 'review'} — ${
            handoff?.decisionReason || 'sin motivo'
        }`,
        `- Timeline pasos: ${summary.steps || 0}`,
        `- Checkpoints: total=${checkpoints.total || 0}, pending=${checkpoints.pending || 0}, working=${checkpoints.working || 0}, done=${checkpoints.done || 0}, skipped=${checkpoints.skipped || 0}`,
        summary.owners?.length
            ? `- Owners: ${summary.owners.join(' | ')}`
            : '- Owners: sin owners',
        '',
    ];

    const noteLines = toArray(handoff?.notes)
        .slice(0, 5)
        .flatMap((entry, index) => [
            `## Nota ${index + 1}`,
            `- Turno: ${entry.shift || 'actual'}`,
            `- Autor: ${entry.author || 'local'}`,
            `- Fecha: ${entry.at}`,
            `- Nota: ${entry.note || 'sin nota'}`,
            '',
        ]);

    const footer = [
        '---',
        '',
        buildTurneroReleaseTimelineMarkdown(handoff?.timeline || {}),
        '',
        '---',
        '',
        buildTurneroReleaseCheckpointMarkdown(
            handoff?.clinicId,
            handoff?.checkpoints || []
        ),
    ];

    return [...header, ...noteLines, ...footer].join('\n').trim();
}
