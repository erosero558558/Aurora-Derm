import {
    inferOwnerFromText,
    normalizeOwner,
    normalizeSeverity,
    toArray,
    toText,
} from './turnero-release-control-center.js';

const STORAGE_PREFIX = 'turneroReleaseRecheckQueueV1';
const VALID_STATUSES = new Set([
    'queued',
    'running',
    'done',
    'failed',
    'skipped',
]);
const VALID_WINDOWS = ['now', '15m', '30m', 'next-shift'];

function nowIso() {
    return new Date().toISOString();
}

function getStorage(storage = globalThis?.localStorage) {
    try {
        return storage || null;
    } catch (_error) {
        return null;
    }
}

function clinicKey(clinicId) {
    return String(clinicId || 'default-clinic').trim() || 'default-clinic';
}

function storageKey(clinicId) {
    return `${STORAGE_PREFIX}:${clinicKey(clinicId)}`;
}

function asObject(value) {
    return value && typeof value === 'object' && !Array.isArray(value)
        ? value
        : {};
}

function slugify(value, fallback = 'task') {
    const normalized = String(value || '')
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/-+/g, '-')
        .replace(/^-|-$/g, '');
    return normalized || fallback;
}

function normalizeWindow(value, fallback = 'next-shift') {
    const token = String(value || fallback)
        .trim()
        .toLowerCase()
        .replace(/_/g, '-');
    if (['now', 'immediate', 'inmediato'].includes(token)) return 'now';
    if (['15m', '15'].includes(token)) return '15m';
    if (['30m', '30'].includes(token)) return '30m';
    if (['next-shift', 'nextshift', 'siguiente-turno'].includes(token)) {
        return 'next-shift';
    }
    return VALID_WINDOWS.includes(token) ? token : fallback;
}

function normalizeStatus(value, fallback = 'queued') {
    const token = String(value || fallback)
        .trim()
        .toLowerCase();
    return VALID_STATUSES.has(token) ? token : fallback;
}

function normalizeKind(value, fallback = 'manual-verify') {
    const token = String(value || '')
        .trim()
        .toLowerCase()
        .replace(/_/g, '-');
    if (
        token.includes('health') ||
        token.includes('figo') ||
        token.includes('diagnostic')
    ) {
        return 'remote-health';
    }
    if (
        token.includes('shell') ||
        token.includes('drift') ||
        token.includes('publish')
    ) {
        return 'public-shell';
    }
    if (
        token.includes('heartbeat') ||
        token.includes('telemetry') ||
        token.includes('sync')
    ) {
        return 'surface-heartbeat';
    }
    if (
        token.includes('evidence') ||
        token.includes('journal') ||
        token.includes('handoff') ||
        token.includes('refresh')
    ) {
        return 'evidence-refresh';
    }
    return [
        'remote-health',
        'public-shell',
        'surface-heartbeat',
        'manual-verify',
        'evidence-refresh',
    ].includes(token)
        ? token
        : fallback;
}

function normalizeCommands(value) {
    return toArray(value)
        .map((entry) => toText(entry))
        .filter(Boolean);
}

function normalizeNotes(value) {
    return toArray(value)
        .map((entry, index) => {
            if (typeof entry === 'string') {
                const text = toText(entry);
                return text
                    ? {
                          id: `note-${index + 1}`,
                          text,
                          author: 'local',
                          createdAt: nowIso(),
                      }
                    : null;
            }

            const source = asObject(entry);
            const text = toText(source.text || source.note || source.body);
            return text
                ? {
                      id: toText(source.id, `note-${index + 1}`),
                      text,
                      author: toText(source.author || 'local'),
                      createdAt: toText(source.createdAt || nowIso()),
                  }
                : null;
        })
        .filter(Boolean);
}

function noteKey(note) {
    return [note?.text, note?.author, note?.createdAt]
        .map((value) => toText(value).toLowerCase())
        .join('|');
}

function normalizeTask(raw = {}, defaults = {}) {
    const source = asObject(raw);
    const base = asObject(defaults);
    const title = toText(
        source.title || source.label || base.title || 'Recheck'
    );
    const owner = normalizeOwner(
        source.owner ||
            base.owner ||
            inferOwnerFromText(
                `${title} ${source.detail || source.reason || ''}`,
                'unknown'
            )
    );
    const severity = normalizeSeverity(
        source.severity || base.severity || 'warning'
    );
    const kind = normalizeKind(source.kind || base.kind || `${owner} ${title}`);
    const recommendedWindow = normalizeWindow(
        source.recommendedWindow ||
            base.recommendedWindow ||
            (severity === 'alert'
                ? 'now'
                : severity === 'warning'
                  ? '15m'
                  : '30m')
    );
    const status = normalizeStatus(source.status || base.status || 'queued');
    const commands = normalizeCommands(source.commands || base.commands);
    const notes = normalizeNotes(source.notes || base.notes);
    const createdAt = toText(source.createdAt || base.createdAt || nowIso());
    const updatedAt = toText(source.updatedAt || base.updatedAt || createdAt);

    return {
        id: toText(
            source.id ||
                base.id ||
                `${owner}-${kind}-${slugify(title)}-${slugify(source.incidentId || base.incidentId || '')}`
        ),
        owner,
        title,
        kind,
        severity,
        recommendedWindow,
        commands,
        notes,
        status,
        createdAt,
        updatedAt,
        incidentId: toText(source.incidentId || base.incidentId || ''),
        source: toText(source.source || base.source || ''),
        profileFingerprint: toText(
            source.profileFingerprint || base.profileFingerprint || ''
        ),
        releaseMode: toText(source.releaseMode || base.releaseMode || ''),
        baseUrl: toText(source.baseUrl || base.baseUrl || ''),
        attempts: Number(source.attempts || base.attempts || 0),
        lastRunAt: toText(source.lastRunAt || base.lastRunAt || ''),
        lastError: toText(source.lastError || base.lastError || ''),
    };
}

function mergeTask(current, incoming) {
    const next = normalizeTask(incoming, current);
    const commands = Array.from(
        new Set([...(current.commands || []), ...next.commands])
    );
    const notes = Array.from(
        new Map(
            [...(current.notes || []), ...next.notes].map((note) => [
                noteKey(note),
                note,
            ])
        ).values()
    );

    return {
        ...current,
        ...next,
        commands,
        notes,
        status:
            next.status !== 'queued'
                ? next.status
                : normalizeStatus(current.status || 'queued'),
        attempts: Math.max(
            Number(current.attempts || 0),
            Number(next.attempts || 0)
        ),
        updatedAt: next.updatedAt || current.updatedAt || nowIso(),
    };
}

function normalizeSnapshot(value, clinicId) {
    const source = asObject(value);
    const normalizedClinicId = clinicKey(source.clinicId || clinicId);
    const tasks = toArray(source.tasks || source.items)
        .map((entry) => normalizeTask(entry, { clinicId: normalizedClinicId }))
        .reduce((map, task) => {
            const current = map.get(task.id);
            map.set(task.id, current ? mergeTask(current, task) : task);
            return map;
        }, new Map());

    return {
        clinicId: normalizedClinicId,
        generatedAt: toText(source.generatedAt || nowIso()),
        updatedAt: toText(source.updatedAt || nowIso()),
        tasks: Array.from(tasks.values()),
    };
}

function normalizeOwners(values) {
    return Array.from(
        new Map(
            toArray(values)
                .map((entry) => {
                    if (typeof entry === 'string') {
                        return {
                            owner: normalizeOwner(entry),
                            label: toText(entry),
                        };
                    }
                    const source = asObject(entry);
                    return {
                        owner: normalizeOwner(
                            source.owner || source.id || 'unknown'
                        ),
                        label: toText(
                            source.label || source.owner || source.id || 'Owner'
                        ),
                    };
                })
                .map((entry) => [entry.owner, entry])
        ).values()
    );
}

function taskFromIncident(incident = {}, context = {}, index = 0) {
    const source = asObject(incident);
    const owner = normalizeOwner(
        source.owner ||
            source.recommendedOwner ||
            source.assignee ||
            inferOwnerFromText(
                `${source.title || source.label || ''} ${source.detail || source.summary || ''}`,
                'unknown'
            )
    );
    const title = toText(
        source.title || source.label || source.summary || `Recheck ${index + 1}`
    );
    const kind = normalizeKind(
        source.kind || source.source || source.signalKey || title
    );
    const severity = normalizeSeverity(
        source.severity || source.state || source.tone || 'warning'
    );
    const window = normalizeWindow(
        source.recommendedWindow ||
            (severity === 'alert'
                ? 'now'
                : severity === 'warning'
                  ? '15m'
                  : '30m')
    );
    const commands = normalizeCommands(
        source.commands || source.recommendedCommands || []
    );
    const notes = normalizeNotes([
        ...(source.notes || []),
        source.detail,
        source.reason,
        source.why,
    ]);

    return normalizeTask(
        {
            id: source.id || `${owner}-${kind}-${slugify(title)}-${index + 1}`,
            owner,
            title,
            kind,
            severity,
            recommendedWindow: window,
            commands,
            notes,
            status: 'queued',
            incidentId: toText(source.id || source.incidentId || ''),
            source: toText(source.source || 'incident'),
            profileFingerprint: toText(context.profileFingerprint || ''),
            releaseMode: toText(context.releaseMode || ''),
            baseUrl: toText(context.baseUrl || ''),
            createdAt: toText(context.generatedAt || nowIso()),
            updatedAt: toText(context.generatedAt || nowIso()),
        },
        context
    );
}

function ownerFollowUpTask(ownerEntry = {}, context = {}, index = 0) {
    const source = asObject(ownerEntry);
    const owner = normalizeOwner(source.owner || source.id || 'unknown');
    const label = toText(source.label || source.name || owner);
    const blockerCount = Number(source.blockerCount || source.blocker || 0);
    const warningCount = Number(source.warningCount || source.warning || 0);
    const title =
        blockerCount > 0
            ? `Revisar bloqueos de ${label}`
            : warningCount > 0
              ? `Revalidar señales de ${label}`
              : `Verificar owner ${label}`;

    return normalizeTask(
        {
            id: `owner-${owner}-${slugify(label)}-${index + 1}`,
            owner,
            title,
            kind: 'manual-verify',
            severity:
                blockerCount > 0
                    ? 'alert'
                    : warningCount > 0
                      ? 'warning'
                      : 'info',
            recommendedWindow: blockerCount > 0 ? 'now' : 'next-shift',
            commands: source.commands || [],
            notes: [
                {
                    text:
                        blockerCount > 0
                            ? `${blockerCount} bloqueo(s) abierto(s) para ${label}`
                            : warningCount > 0
                              ? `${warningCount} warning(s) abiertos para ${label}`
                              : `Sin incidentes abiertos para ${label}`,
                    author: 'mesh',
                    createdAt: nowIso(),
                },
            ],
            status: 'queued',
            source: 'owner-automation',
            profileFingerprint: toText(context.profileFingerprint || ''),
            releaseMode: toText(context.releaseMode || ''),
            baseUrl: toText(context.baseUrl || ''),
        },
        context
    );
}

function sortTasks(left, right) {
    const windowRank = { now: 0, '15m': 1, '30m': 2, 'next-shift': 3 };
    const severityRank = { alert: 0, warning: 1, ready: 2, info: 3 };
    const statusRank = {
        running: 0,
        queued: 1,
        failed: 2,
        skipped: 3,
        done: 4,
    };

    const windowDiff =
        windowRank[left.recommendedWindow] -
        windowRank[right.recommendedWindow];
    if (windowDiff !== 0) return windowDiff;
    const severityDiff =
        severityRank[left.severity] - severityRank[right.severity];
    if (severityDiff !== 0) return severityDiff;
    const statusDiff = statusRank[left.status] - statusRank[right.status];
    if (statusDiff !== 0) return statusDiff;
    return String(left.title || '').localeCompare(String(right.title || ''));
}

function tasksByWindow(tasks, windowKey) {
    return tasks.filter((task) => task.recommendedWindow === windowKey);
}

function statsFromTasks(tasks = []) {
    return tasks.reduce(
        (acc, task) => {
            const item = normalizeTask(task);
            acc.total += 1;
            acc[item.status] += 1;
            acc.byOwner[item.owner] = (acc.byOwner[item.owner] || 0) + 1;
            acc.byKind[item.kind] = (acc.byKind[item.kind] || 0) + 1;
            acc.bySeverity[item.severity] =
                (acc.bySeverity[item.severity] || 0) + 1;
            acc.byWindow[item.recommendedWindow] =
                (acc.byWindow[item.recommendedWindow] || 0) + 1;
            acc.notes += item.notes.length;
            if (item.status === 'queued' || item.status === 'running') {
                acc.needsAttention += 1;
            }
            return acc;
        },
        {
            total: 0,
            queued: 0,
            running: 0,
            done: 0,
            failed: 0,
            skipped: 0,
            needsAttention: 0,
            notes: 0,
            byOwner: {},
            byKind: {},
            bySeverity: {},
            byWindow: {},
        }
    );
}

export function buildTurneroReleaseRecheckPlan({
    clinicId = 'default-clinic',
    incidents = [],
    owners = [],
    decision = 'review',
    profileFingerprint = '',
    releaseMode = '',
    baseUrl = '',
    generatedAt = nowIso(),
    queueSnapshot = null,
    source = 'mesh',
} = {}) {
    const context = {
        clinicId: clinicKey(clinicId),
        profileFingerprint,
        releaseMode,
        baseUrl,
        generatedAt,
    };
    const incidentTasks = toArray(incidents).map((incident, index) =>
        taskFromIncident(incident, { ...context, source }, index)
    );
    const ownerTasks = normalizeOwners(owners).map((ownerEntry, index) =>
        ownerFollowUpTask(ownerEntry, { ...context, source }, index)
    );
    const merged = normalizeSnapshot(
        {
            clinicId: context.clinicId,
            tasks: [
                ...toArray(queueSnapshot?.tasks),
                ...incidentTasks,
                ...ownerTasks,
            ],
            generatedAt,
            updatedAt: generatedAt,
        },
        context.clinicId
    );
    const tasks = merged.tasks.length
        ? merged.tasks.sort(sortTasks)
        : [
              normalizeTask(
                  {
                      id: `${context.clinicId}-manual-verify`,
                      owner: 'ops',
                      title: 'Verificar release manualmente',
                      kind: 'manual-verify',
                      severity: decision === 'ready' ? 'info' : 'warning',
                      recommendedWindow:
                          decision === 'ready' ? 'next-shift' : 'now',
                      commands: [],
                      notes: [
                          {
                              text: 'No hay incidentes suficientes para construir una cola de rechecks detallada.',
                              author: 'mesh',
                              createdAt: generatedAt,
                          },
                      ],
                      status: 'queued',
                      source,
                      profileFingerprint,
                      releaseMode,
                      baseUrl,
                  },
                  context
              ),
          ];
    const stats = statsFromTasks(tasks);

    return {
        clinicId: context.clinicId,
        generatedAt,
        updatedAt: generatedAt,
        decision,
        profileFingerprint,
        releaseMode,
        baseUrl,
        tasks,
        stats,
        ownerIndex: tasks.reduce((acc, task) => {
            acc[task.owner] = (acc[task.owner] || 0) + 1;
            return acc;
        }, {}),
        kindIndex: tasks.reduce((acc, task) => {
            acc[task.kind] = (acc[task.kind] || 0) + 1;
            return acc;
        }, {}),
    };
}

export function buildTurneroReleaseRecheckStats(snapshot = {}) {
    return statsFromTasks(
        Array.isArray(snapshot)
            ? snapshot
            : snapshot.tasks || snapshot.items || []
    );
}

export function buildTurneroReleaseRecheckQueueMarkdown(snapshot = {}) {
    const clinicId = clinicKey(snapshot.clinicId);
    const tasks = Array.isArray(snapshot.tasks)
        ? snapshot.tasks.map((task) => normalizeTask(task))
        : [];
    const stats = snapshot.stats || statsFromTasks(tasks);
    const lines = [
        `# Recheck Queue — ${clinicId}`,
        '',
        `- generatedAt: ${toText(snapshot.generatedAt || nowIso())}`,
        `- decision: ${toText(snapshot.decision || 'review')}`,
        `- profileFingerprint: ${toText(snapshot.profileFingerprint || 'unknown')}`,
        `- releaseMode: ${toText(snapshot.releaseMode || 'unknown')}`,
        `- baseUrl: ${toText(snapshot.baseUrl || 'unknown')}`,
        '',
        '## Summary',
        `- total: ${stats.total}`,
        `- queued: ${stats.queued}`,
        `- running: ${stats.running}`,
        `- done: ${stats.done}`,
        `- failed: ${stats.failed}`,
        `- skipped: ${stats.skipped}`,
        `- needsAttention: ${stats.needsAttention}`,
        '',
    ];

    VALID_WINDOWS.forEach((windowKey) => {
        const windowTasks = tasksByWindow(tasks, windowKey);
        if (!windowTasks.length) {
            return;
        }

        lines.push(`## ${windowKey}`);
        windowTasks.forEach((task, index) => {
            lines.push(
                [
                    `### ${index + 1}. ${task.title}`,
                    `- id: ${task.id}`,
                    `- owner: ${task.owner}`,
                    `- kind: ${task.kind}`,
                    `- severity: ${task.severity}`,
                    `- status: ${task.status}`,
                    `- updatedAt: ${task.updatedAt}`,
                ].join('\n')
            );
            lines.push('- commands:');
            lines.push(
                ...(task.commands.length
                    ? task.commands.map((command) => `  - ${command}`)
                    : ['  - sin comandos'])
            );
            lines.push('- notes:');
            lines.push(
                ...(task.notes.length
                    ? task.notes.map((note) => `  - ${toText(note.text)}`)
                    : ['  - sin notas'])
            );
        });
        lines.push('');
    });

    return lines.join('\n').trim();
}

function writeSnapshot(storage, key, snapshot) {
    if (!storage) {
        return snapshot;
    }

    try {
        storage.setItem(key, JSON.stringify(snapshot, null, 2));
    } catch (_error) {
        return snapshot;
    }

    return snapshot;
}

function readSnapshot(storage, key, clinicId) {
    if (!storage) {
        return normalizeSnapshot({ clinicId }, clinicId);
    }

    try {
        const raw = storage.getItem(key);
        return normalizeSnapshot(
            raw ? JSON.parse(raw) : { clinicId },
            clinicId
        );
    } catch (_error) {
        return normalizeSnapshot({ clinicId }, clinicId);
    }
}

export function createTurneroReleaseRecheckQueueStore({
    clinicId,
    storage = globalThis?.localStorage,
} = {}) {
    const normalizedClinicId = clinicKey(clinicId);
    const key = storageKey(normalizedClinicId);
    const storageRef = getStorage(storage);

    return {
        key,
        clinicId: normalizedClinicId,
        read() {
            return readSnapshot(storageRef, key, normalizedClinicId);
        },
        write(value) {
            return writeSnapshot(
                storageRef,
                key,
                normalizeSnapshot(value, normalizedClinicId)
            );
        },
        enqueue(value, defaults = {}) {
            const snapshot = readSnapshot(storageRef, key, normalizedClinicId);
            const incoming = toArray(value)
                .filter(Boolean)
                .map((entry) =>
                    normalizeTask(entry, {
                        ...defaults,
                        status: 'queued',
                    })
                );
            const map = new Map(snapshot.tasks.map((task) => [task.id, task]));

            incoming.forEach((task) => {
                const current = map.get(task.id);
                map.set(task.id, current ? mergeTask(current, task) : task);
            });

            return writeSnapshot(storageRef, key, {
                ...snapshot,
                tasks: Array.from(map.values()).sort(sortTasks),
                updatedAt: nowIso(),
            });
        },
        markRunning(taskId, patch = {}) {
            return this._update(taskId, patch, 'running');
        },
        markDone(taskId, patch = {}) {
            return this._update(taskId, patch, 'done');
        },
        markFailed(taskId, patch = {}) {
            return this._update(taskId, patch, 'failed');
        },
        markSkipped(taskId, patch = {}) {
            return this._update(taskId, patch, 'skipped');
        },
        appendNote(taskId, note, patch = {}) {
            const text = toText(note);
            if (!text) {
                return this.read();
            }

            const snapshot = readSnapshot(storageRef, key, normalizedClinicId);
            const tasks = snapshot.tasks.map((task) => {
                if (task.id !== taskId) {
                    return task;
                }

                return mergeTask(task, {
                    ...patch,
                    notes: [
                        ...(task.notes || []),
                        {
                            id: `note-${(task.notes || []).length + 1}`,
                            text,
                            author: toText(patch.author || 'local'),
                            createdAt: nowIso(),
                        },
                    ],
                });
            });

            return writeSnapshot(storageRef, key, {
                ...snapshot,
                tasks,
                updatedAt: nowIso(),
            });
        },
        clear() {
            if (storageRef) {
                try {
                    storageRef.removeItem(key);
                } catch (_error) {
                    // Ignore storage errors.
                }
            }
            return normalizeSnapshot(
                { clinicId: normalizedClinicId },
                normalizedClinicId
            );
        },
        exportPack({
            metadata = {},
            title = 'Turnero release recheck queue',
        } = {}) {
            const snapshot = this.read();
            const stats = statsFromTasks(snapshot.tasks);
            return {
                clinicId: normalizedClinicId,
                title,
                metadata: asObject(metadata),
                generatedAt: snapshot.generatedAt,
                updatedAt: snapshot.updatedAt,
                stats,
                tasks: snapshot.tasks,
                markdown: buildTurneroReleaseRecheckQueueMarkdown({
                    ...snapshot,
                    stats,
                }),
            };
        },
        _update(taskId, patch, status) {
            const snapshot = readSnapshot(storageRef, key, normalizedClinicId);
            const tasks = snapshot.tasks.map((task) => {
                if (task.id !== taskId) {
                    return task;
                }

                const next = normalizeTask(
                    {
                        ...task,
                        ...asObject(patch),
                        status,
                        updatedAt: nowIso(),
                        lastRunAt: nowIso(),
                        attempts:
                            status === 'running'
                                ? Number(task.attempts || 0) + 1
                                : Number(task.attempts || 0),
                    },
                    task
                );

                if (status === 'failed') {
                    next.lastError = toText(
                        patch.lastError ||
                            patch.error ||
                            task.lastError ||
                            'failed'
                    );
                }

                return next;
            });

            return writeSnapshot(storageRef, key, {
                ...snapshot,
                tasks,
                updatedAt: nowIso(),
            });
        },
    };
}

export default buildTurneroReleaseRecheckPlan;
