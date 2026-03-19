const STORAGE_PREFIX = 'turneroReleaseCheckpointSchedulerV1';

function getStorage() {
    try {
        return typeof localStorage !== 'undefined' ? localStorage : null;
    } catch (_error) {
        return null;
    }
}

function normalizeClinicId(value) {
    return String(value || 'default-clinic').trim() || 'default-clinic';
}

function toStorageKey(clinicId) {
    return `${STORAGE_PREFIX}:${normalizeClinicId(clinicId)}`;
}

function toArray(value) {
    return Array.isArray(value) ? value.filter(Boolean) : [];
}

function asObject(value) {
    return value && typeof value === 'object' ? value : {};
}

function normalizeStatus(value) {
    return ['pending', 'working', 'done', 'skipped'].includes(value)
        ? value
        : 'pending';
}

function normalizeCheckpoint(value = {}) {
    const source = asObject(value);
    return {
        id: String(source.id || '').trim(),
        window: String(source.window || '30m').trim(),
        title: String(source.title || 'Checkpoint').trim(),
        owner: String(source.owner || 'unknown').trim(),
        status: normalizeStatus(source.status),
        dueLabel: String(source.dueLabel || '').trim(),
        notes: String(source.notes || '').trim(),
        updatedAt: String(source.updatedAt || new Date().toISOString()).trim(),
    };
}

function buildDefaultCheckpoints(timeline) {
    const windows = ['ahora', '15m', '30m', 'siguiente-turno'];
    const steps = toArray(timeline?.steps);
    const next = [];

    windows.forEach((windowKey) => {
        const selected = steps
            .filter((step) => step.window === windowKey)
            .slice(0, 3);
        if (!selected.length) {
            next.push(
                normalizeCheckpoint({
                    id: `checkpoint-${windowKey}`,
                    window: windowKey,
                    title: `Checkpoint ${windowKey}`,
                    owner: 'ops',
                    dueLabel: windowKey,
                    notes: 'Sin pasos urgentes en esta ventana.',
                })
            );
            return;
        }

        selected.forEach((step, index) => {
            next.push(
                normalizeCheckpoint({
                    id: `${windowKey}-${step.owner}-${index + 1}`,
                    window: windowKey,
                    title: step.title,
                    owner: step.owner,
                    dueLabel: step.nextWindow || windowKey,
                    notes: step.nextCheck || '',
                })
            );
        });
    });

    return next;
}

export function readTurneroReleaseCheckpointScheduler(
    clinicId,
    timeline = null
) {
    const storage = getStorage();
    if (!storage) return buildDefaultCheckpoints(timeline);

    try {
        const raw = storage.getItem(toStorageKey(clinicId));
        const parsed = raw ? JSON.parse(raw) : null;
        if (!parsed) return buildDefaultCheckpoints(timeline);

        const checkpoints = Array.isArray(parsed)
            ? parsed
            : Array.isArray(parsed.checkpoints)
              ? parsed.checkpoints
              : Array.isArray(parsed.items)
                ? parsed.items
                : null;

        if (!checkpoints) return buildDefaultCheckpoints(timeline);
        return checkpoints.map(normalizeCheckpoint);
    } catch (_error) {
        return buildDefaultCheckpoints(timeline);
    }
}

export function writeTurneroReleaseCheckpointScheduler(clinicId, checkpoints) {
    const storage = getStorage();
    const normalized = toArray(checkpoints).map(normalizeCheckpoint);
    if (!storage) return normalized;

    try {
        storage.setItem(toStorageKey(clinicId), JSON.stringify(normalized));
    } catch (_error) {
        return normalized;
    }

    return normalized;
}

export function resetTurneroReleaseCheckpointScheduler(
    clinicId,
    timeline = null
) {
    const next = buildDefaultCheckpoints(timeline);
    return writeTurneroReleaseCheckpointScheduler(clinicId, next);
}

export function clearTurneroReleaseCheckpointScheduler(clinicId) {
    const storage = getStorage();
    if (!storage) return false;
    try {
        storage.removeItem(toStorageKey(clinicId));
        return true;
    } catch (_error) {
        return false;
    }
}

export function updateTurneroReleaseCheckpoint(
    clinicId,
    checkpointId,
    patch = {},
    timeline = null
) {
    const current = readTurneroReleaseCheckpointScheduler(clinicId, timeline);
    const next = current.map((checkpoint) => {
        if (checkpoint.id !== checkpointId) return checkpoint;
        return normalizeCheckpoint({
            ...checkpoint,
            ...asObject(patch),
            id: checkpoint.id,
            updatedAt: new Date().toISOString(),
        });
    });
    return writeTurneroReleaseCheckpointScheduler(clinicId, next);
}

export function buildTurneroReleaseCheckpointStats(checkpoints) {
    return toArray(checkpoints).reduce(
        (acc, checkpoint) => {
            acc.total += 1;
            acc[checkpoint.status] += 1;
            return acc;
        },
        { total: 0, pending: 0, working: 0, done: 0, skipped: 0 }
    );
}

export function buildTurneroReleaseCheckpointMarkdown(clinicId, checkpoints) {
    const list = toArray(checkpoints).map(normalizeCheckpoint);
    const stats = buildTurneroReleaseCheckpointStats(list);
    const header = [
        `# Checkpoint Scheduler — ${normalizeClinicId(clinicId)}`,
        '',
        `- Total: ${stats.total}`,
        `- Pending: ${stats.pending}`,
        `- Working: ${stats.working}`,
        `- Done: ${stats.done}`,
        `- Skipped: ${stats.skipped}`,
        '',
    ];

    const body = list.flatMap((checkpoint, index) => [
        `## ${index + 1}. [${checkpoint.window}] ${checkpoint.title}`,
        `- Owner: ${checkpoint.owner}`,
        `- Estado: ${checkpoint.status}`,
        `- Ventana: ${checkpoint.dueLabel || checkpoint.window}`,
        checkpoint.notes ? `- Nota: ${checkpoint.notes}` : '- Nota: sin nota',
        `- Actualizado: ${checkpoint.updatedAt}`,
        '',
    ]);

    return [...header, ...body].join('\n').trim();
}
