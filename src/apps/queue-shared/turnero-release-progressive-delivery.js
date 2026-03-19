import {
    buildTurneroReleaseControlCenterModel,
    toArray,
    toText,
} from './turnero-release-control-center.js';
import { buildTurneroReleaseWarRoomModel } from './turnero-release-war-room.js';

const DEFAULT_CLINIC_ID = 'default-clinic';
const FREEZE_STORAGE_PREFIX = 'turnero.release.freeze-windows.v1';
const WAVE_ORDER = ['wave-0', 'wave-1', 'wave-2', 'global'];
const MEMORY_FREEZE_REGISTRIES = new Map();

function nowIso() {
    return new Date().toISOString();
}

function isPlainObject(value) {
    return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function cloneValue(value) {
    if (typeof structuredClone === 'function') {
        try {
            return structuredClone(value);
        } catch (_error) {
            // Fall through to JSON cloning below.
        }
    }

    try {
        return JSON.parse(JSON.stringify(value));
    } catch (_error) {
        return isPlainObject(value) ? { ...value } : value;
    }
}

function escapeMd(value) {
    return String(value ?? '')
        .replace(/\r?\n/g, ' ')
        .trim();
}

function safeFilePart(
    value,
    fallback = 'turnero-release-progressive-delivery'
) {
    const normalized = String(value ?? '')
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9._-]+/g, '-')
        .replace(/-+/g, '-')
        .replace(/^-+|-+$/g, '');

    return normalized || fallback;
}

function clamp(value, min, max) {
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) {
        return min;
    }

    return Math.max(min, Math.min(max, parsed));
}

function stateRank(state) {
    const normalized = String(state || 'ready').toLowerCase();
    if (normalized === 'alert') {
        return 2;
    }
    if (normalized === 'warning') {
        return 1;
    }

    return 0;
}

function combineStates(...states) {
    return states.reduce(
        (worst, next) => (stateRank(next) > stateRank(worst) ? next : worst),
        'ready'
    );
}

function normalizeState(value, fallback = 'ready') {
    const normalized = String(value ?? fallback)
        .trim()
        .toLowerCase();
    if (
        normalized === 'alert' ||
        normalized === 'warning' ||
        normalized === 'ready'
    ) {
        return normalized;
    }

    return fallback;
}

function isStorageLike(storage) {
    return Boolean(
        storage &&
        typeof storage.getItem === 'function' &&
        typeof storage.setItem === 'function' &&
        typeof storage.removeItem === 'function'
    );
}

function getStorage(storageOverride = null) {
    if (isStorageLike(storageOverride)) {
        return storageOverride;
    }

    try {
        return isStorageLike(globalThis?.localStorage)
            ? globalThis.localStorage
            : null;
    } catch (_error) {
        return null;
    }
}

function sanitizeClinicKey(value) {
    return (
        toText(value, DEFAULT_CLINIC_ID)
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/^-+|-+$/g, '') || DEFAULT_CLINIC_ID
    );
}

function freezeRegistryKey(clinicId) {
    return `${FREEZE_STORAGE_PREFIX}.${sanitizeClinicKey(clinicId)}`;
}

function readJson(storage, key, fallbackValue) {
    if (!storage) {
        return cloneValue(fallbackValue);
    }

    try {
        const rawValue = storage.getItem(key);
        if (!rawValue) {
            return cloneValue(fallbackValue);
        }

        return JSON.parse(rawValue);
    } catch (_error) {
        return cloneValue(fallbackValue);
    }
}

function writeJson(storage, key, value) {
    if (!storage) {
        return false;
    }

    try {
        storage.setItem(key, JSON.stringify(value));
        return true;
    } catch (_error) {
        return false;
    }
}

function removeJson(storage, key) {
    if (!storage) {
        return false;
    }

    try {
        storage.removeItem(key);
        return true;
    } catch (_error) {
        return false;
    }
}

function normalizeClinicId(value) {
    return toText(value, DEFAULT_CLINIC_ID);
}

function normalizeFreezeWindowStatus(value) {
    const normalized = String(value ?? 'planned')
        .trim()
        .toLowerCase();

    if (['active', 'frozen', 'open', 'freeze'].includes(normalized)) {
        return 'active';
    }

    if (['paused', 'hold', 'pending'].includes(normalized)) {
        return 'paused';
    }

    if (
        ['closed', 'done', 'complete', 'completed', 'thawed'].includes(
            normalized
        )
    ) {
        return 'closed';
    }

    return 'planned';
}

function freezeWindowTone(status) {
    if (status === 'active' || status === 'paused') {
        return 'warning';
    }

    return 'ready';
}

function normalizeWaveBucketId(value) {
    const normalized = String(value ?? 'global')
        .trim()
        .toLowerCase();
    if (WAVE_ORDER.includes(normalized)) {
        return normalized;
    }

    return 'global';
}

function normalizeWaveState(value) {
    return normalizeState(value, 'ready');
}

function normalizeFreezeWindowRecord(record, clinicId, index = 0) {
    const source = isPlainObject(record) ? record : {};
    const normalizedClinicId = normalizeClinicId(
        source.clinicId || clinicId || DEFAULT_CLINIC_ID
    );
    const waveId = normalizeWaveBucketId(
        source.waveId || source.wave || source.bucket || 'global'
    );
    const status = normalizeFreezeWindowStatus(source.status || source.state);
    const id =
        toText(
            source.id ||
                source.freezeWindowId ||
                source.windowId ||
                source.key ||
                '',
            ''
        ) ||
        `${normalizedClinicId}-${waveId}-${index + 1}`.replace(
            /[^a-z0-9_-]+/gi,
            '-'
        );

    return {
        id,
        clinicId: normalizedClinicId,
        waveId,
        label: toText(
            source.label ||
                source.title ||
                source.name ||
                `${normalizedClinicId} freeze window ${index + 1}`,
            `${normalizedClinicId} freeze window ${index + 1}`
        ),
        startAt: toText(source.startAt || source.start || source.from || ''),
        endAt: toText(source.endAt || source.end || source.to || ''),
        owner: toText(source.owner || source.assignee || 'deploy', 'deploy'),
        reason: toText(source.reason || source.summary || ''),
        status,
        state: freezeWindowTone(status),
        notes: toText(source.notes || source.detail || ''),
        updatedAt: toText(source.updatedAt || nowIso()),
    };
}

function normalizeFreezeWindowRegistryState(value, clinicId) {
    const source = isPlainObject(value) ? value : {};
    const normalizedClinicId = normalizeClinicId(
        source.clinicId || clinicId || DEFAULT_CLINIC_ID
    );
    const items = toArray(source.items)
        .map((entry, index) =>
            normalizeFreezeWindowRecord(entry, normalizedClinicId, index)
        )
        .filter(Boolean)
        .sort(compareFreezeWindows);

    return {
        clinicId: normalizedClinicId,
        updatedAt: toText(source.updatedAt || nowIso()),
        items,
    };
}

function compareFreezeWindows(left, right) {
    const leftStart = Date.parse(left?.startAt || left?.updatedAt || '');
    const rightStart = Date.parse(right?.startAt || right?.updatedAt || '');

    if (
        !Number.isNaN(leftStart) &&
        !Number.isNaN(rightStart) &&
        leftStart !== rightStart
    ) {
        return leftStart - rightStart;
    }

    const leftWave = WAVE_ORDER.indexOf(normalizeWaveBucketId(left?.waveId));
    const rightWave = WAVE_ORDER.indexOf(normalizeWaveBucketId(right?.waveId));
    if (leftWave !== rightWave) {
        return leftWave - rightWave;
    }

    return toText(left?.label).localeCompare(toText(right?.label));
}

function buildFreezeWindowSummary(registry) {
    const items = toArray(registry?.items);
    const counts = {
        total: items.length,
        active: 0,
        planned: 0,
        paused: 0,
        closed: 0,
    };
    const waveBreakdown = Object.fromEntries(
        WAVE_ORDER.map((waveId) => [
            waveId,
            {
                waveId,
                total: 0,
                active: 0,
                planned: 0,
                paused: 0,
                closed: 0,
            },
        ])
    );

    items.forEach((item) => {
        const status = normalizeFreezeWindowStatus(item.status || item.state);
        const bucket =
            waveBreakdown[normalizeWaveBucketId(item.waveId)] ||
            waveBreakdown.global;
        bucket.total += 1;
        bucket[status] += 1;
        counts[status] += 1;
    });

    const state = counts.active > 0 || counts.paused > 0 ? 'warning' : 'ready';
    const summary =
        counts.total === 0
            ? 'Sin freeze windows registradas.'
            : `${counts.total} freeze window(s) · ${counts.active} activa(s) · ${counts.planned} planificada(s)`;
    const supportCopy =
        counts.total === 0
            ? 'Puedes crear la primera ventana en la tarjeta.'
            : counts.active > 0
              ? 'Hay ventanas activas; valida los horarios antes de liberar.'
              : 'No hay ventanas activas; la registry está lista.';

    return {
        state,
        summary,
        supportCopy,
        counts,
        waveBreakdown,
    };
}

function buildTurneroReleaseFreezeWindowRegistryMarkdown(
    registry,
    options = {}
) {
    const normalized = normalizeFreezeWindowRegistryState(
        registry,
        options.clinicId
    );
    const summary = buildFreezeWindowSummary(normalized);

    const lines = [
        '# Freeze Window Registry',
        '',
        `- Clinic: ${escapeMd(normalized.clinicId)}`,
        `- Updated: ${escapeMd(normalized.updatedAt)}`,
        `- Total: ${summary.counts.total}`,
        `- Active: ${summary.counts.active}`,
        `- Planned: ${summary.counts.planned}`,
        `- Paused: ${summary.counts.paused}`,
        `- Closed: ${summary.counts.closed}`,
    ];

    for (const waveId of WAVE_ORDER) {
        const bucket = summary.waveBreakdown[waveId];
        lines.push('');
        lines.push(`## ${waveId}`);
        if (!bucket.total) {
            lines.push('- Sin ventanas registradas.');
            continue;
        }

        normalized.items
            .filter((item) => normalizeWaveBucketId(item.waveId) === waveId)
            .forEach((item) => {
                const timeSpan = [item.startAt, item.endAt]
                    .filter(Boolean)
                    .join(' → ');
                lines.push(
                    `- [${escapeMd(item.state)}] ${escapeMd(item.label)} · ${escapeMd(
                        timeSpan || 'sin horario'
                    )} · ${escapeMd(item.owner)} · ${escapeMd(item.reason || item.notes || '')}`
                );
            });
    }

    return lines.join('\n');
}

function buildTurneroReleaseFreezeWindowRegistryView(state, clinicId) {
    const normalized = normalizeFreezeWindowRegistryState(state, clinicId);
    const summary = buildFreezeWindowSummary(normalized);
    const markdown = buildTurneroReleaseFreezeWindowRegistryMarkdown(
        normalized,
        {
            clinicId: normalized.clinicId,
        }
    );
    const pack = {
        ...normalized,
        state: summary.state,
        summary: summary.summary,
        supportCopy: summary.supportCopy,
        counts: summary.counts,
        waveBreakdown: summary.waveBreakdown,
        markdown,
    };

    return {
        ...pack,
        pack,
    };
}

function readFreezeRegistryState(clinicId, storageOverride = null) {
    const storage = getStorage(storageOverride);
    const key = freezeRegistryKey(clinicId);
    if (storage) {
        return readJson(storage, key, {
            clinicId: normalizeClinicId(clinicId),
            updatedAt: nowIso(),
            items: [],
        });
    }

    return cloneValue(
        MEMORY_FREEZE_REGISTRIES.get(key) || {
            clinicId: normalizeClinicId(clinicId),
            updatedAt: nowIso(),
            items: [],
        }
    );
}

function writeFreezeRegistryState(clinicId, state, storageOverride = null) {
    const storage = getStorage(storageOverride);
    const key = freezeRegistryKey(clinicId);
    const normalized = normalizeFreezeWindowRegistryState(state, clinicId);

    if (storage) {
        writeJson(storage, key, normalized);
    } else {
        MEMORY_FREEZE_REGISTRIES.set(key, cloneValue(normalized));
    }

    return normalized;
}

function resolveControlCenterModel(input = {}, options = {}) {
    const existing = options.controlCenter || input.controlCenter;
    if (
        existing &&
        existing.snapshot &&
        existing.decision &&
        existing.summary
    ) {
        return existing;
    }

    if (input && input.snapshot && input.decision && input.summary) {
        return input;
    }

    const source =
        input.snapshot || input.currentSnapshot || input.controlCenter || input;
    return buildTurneroReleaseControlCenterModel(source);
}

function resolveFreezeRegistryView(
    input = {},
    options = {},
    controlCenter = null
) {
    const clinicId =
        controlCenter?.clinicId ||
        input.clinicId ||
        options.clinicId ||
        DEFAULT_CLINIC_ID;

    if (options.freezeRegistry) {
        return buildTurneroReleaseFreezeWindowRegistryView(
            options.freezeRegistry,
            clinicId
        );
    }

    if (input.freezeRegistry) {
        return buildTurneroReleaseFreezeWindowRegistryView(
            input.freezeRegistry,
            clinicId
        );
    }

    return buildTurneroReleaseFreezeWindowRegistryView(
        readFreezeRegistryState(clinicId, options.storage),
        clinicId
    );
}

function summarizeWaveItems(items) {
    const counts = {
        total: items.length,
        ready: 0,
        warning: 0,
        alert: 0,
    };

    items.forEach((item) => {
        const state = normalizeWaveState(
            item.state || item.tone || item.status
        );
        counts[state] += 1;
    });

    const state =
        counts.alert > 0 ? 'alert' : counts.warning > 0 ? 'warning' : 'ready';

    return {
        state,
        counts,
    };
}

function buildWaveBucket(id, label, detail = '') {
    return {
        id,
        label,
        detail,
        state: 'ready',
        items: [],
        summary: '',
    };
}

function addWaveItem(waves, waveId, item) {
    const bucket = waves[normalizeWaveBucketId(waveId)] || waves.global;
    bucket.items.push(item);
}

function finalizeWaveBucket(bucket) {
    const summary = summarizeWaveItems(bucket.items);
    bucket.state = summary.state;
    bucket.summary =
        bucket.items.length === 0
            ? 'Sin elementos.'
            : `${bucket.items.length} item(s) · ${summary.counts.alert} alert(s) · ${summary.counts.warning} warning(s)`;
    bucket.counts = summary.counts;
    return bucket;
}

function buildWavePlannerMarkdown(model) {
    const lines = [
        '# Wave Plan',
        '',
        `- Clinic: ${escapeMd(model.clinicName || model.clinicId || DEFAULT_CLINIC_ID)}`,
        `- Decision: ${escapeMd(model.decision)}`,
        `- State: ${escapeMd(model.state)}`,
        `- Summary: ${escapeMd(model.summary)}`,
    ];

    for (const waveId of WAVE_ORDER) {
        const bucket = model.waves[waveId];
        lines.push('');
        lines.push(`## ${waveId}`);
        lines.push(`- State: ${escapeMd(bucket.state)}`);
        lines.push(`- Summary: ${escapeMd(bucket.summary)}`);
        if (!bucket.items.length) {
            lines.push('- Sin elementos.');
            continue;
        }

        bucket.items.forEach((item) => {
            lines.push(
                `- [${escapeMd(item.state)}] ${escapeMd(item.title)} · ${escapeMd(
                    item.detail || item.notes || ''
                )}`
            );
        });
    }

    return lines.join('\n');
}

function releaseWarRoomSummary(controlCenter, releaseWarRoomSnapshot) {
    const snapshot = releaseWarRoomSnapshot || {};
    return (
        snapshot.boardMarkdown ||
        snapshot.escalationMarkdown ||
        snapshot.summary ||
        controlCenter.runbookMarkdown ||
        controlCenter.summary ||
        ''
    );
}

function gateToneFromSource(value) {
    return normalizeState(value, 'ready');
}

function buildBlastRadiusMarkdown(model) {
    const lines = [
        '# Blast Radius',
        '',
        `- Clinic: ${escapeMd(model.clinicName || model.clinicId || DEFAULT_CLINIC_ID)}`,
        `- Risk score: ${model.riskScore}/100`,
        `- State: ${escapeMd(model.state)}`,
        `- Summary: ${escapeMd(model.summary)}`,
        '',
        '## Scenarios',
    ];

    model.scenarios.forEach((scenario) => {
        lines.push(
            `- [${escapeMd(scenario.state)}] ${escapeMd(scenario.label)} · ${escapeMd(
                scenario.detail
            )}`
        );
    });

    return lines.join('\n');
}

function buildDependencyGatesMarkdown(model) {
    const lines = [
        '# Dependency Gates',
        '',
        `- Clinic: ${escapeMd(model.clinicName || model.clinicId || DEFAULT_CLINIC_ID)}`,
        `- State: ${escapeMd(model.state)}`,
        `- Summary: ${escapeMd(model.summary)}`,
        '',
        '## Gates',
    ];

    model.gates.forEach((gate) => {
        lines.push(
            `- [${escapeMd(gate.state)}] ${escapeMd(gate.label)} · ${escapeMd(gate.detail)}`
        );
    });

    return lines.join('\n');
}

function buildRollbackRehearsalMarkdown(model) {
    const lines = [
        '# Rollback Rehearsal',
        '',
        `- Clinic: ${escapeMd(model.clinicName || model.clinicId || DEFAULT_CLINIC_ID)}`,
        `- State: ${escapeMd(model.state)}`,
        `- Confidence: ${model.confidencePct}%`,
        `- Summary: ${escapeMd(model.summary)}`,
        '',
        '## Steps',
    ];

    model.steps.forEach((step) => {
        lines.push(
            `- [${escapeMd(step.state)}] ${escapeMd(step.label)} · ${escapeMd(step.detail)}`
        );
    });

    return lines.join('\n');
}

function buildMaintenanceWindowMarkdown(model) {
    const lines = [
        '# Maintenance Window Planner',
        '',
        `- Clinic: ${escapeMd(model.clinicName || model.clinicId || DEFAULT_CLINIC_ID)}`,
        `- State: ${escapeMd(model.state)}`,
        `- Summary: ${escapeMd(model.summary)}`,
        '',
        '## Windows',
    ];

    model.windows.forEach((window) => {
        lines.push(
            `- [${escapeMd(window.state)}] ${escapeMd(window.label)} · ${escapeMd(window.startAt)} → ${escapeMd(window.endAt)} · ${escapeMd(window.detail)}`
        );
    });

    return lines.join('\n');
}

export function buildTurneroReleaseWavePlanner(input = {}, options = {}) {
    const controlCenter = resolveControlCenterModel(input, options);
    const freezeRegistry = resolveFreezeRegistryView(
        input,
        options,
        controlCenter
    );
    const releaseWarRoomSnapshot =
        options.releaseWarRoomSnapshot ||
        input.releaseWarRoomSnapshot ||
        buildTurneroReleaseWarRoomModel(controlCenter.snapshot);

    const waves = Object.fromEntries(
        WAVE_ORDER.map((waveId) => [
            waveId,
            buildWaveBucket(waveId, waveId.replace('-', ' ').toUpperCase()),
        ])
    );

    addWaveItem(waves, 'wave-0', {
        id: 'control-center-decision',
        waveId: 'wave-0',
        title: 'Decisión de liberación',
        detail: controlCenter.summary || controlCenter.supportCopy || '',
        state: controlCenter.tone || 'ready',
        owner: 'ops',
        source: 'control-center',
    });

    toArray(controlCenter.incidents).forEach((incident, index) => {
        const incidentState = normalizeWaveState(
            incident.state || incident.severity
        );
        const bucketId =
            incidentState === 'alert'
                ? 'wave-0'
                : incidentState === 'warning'
                  ? 'wave-1'
                  : 'wave-2';
        addWaveItem(waves, bucketId, {
            id: incident.code || incident.id || `incident-${index + 1}`,
            waveId: bucketId,
            title: incident.title || incident.code || `Incidente ${index + 1}`,
            detail: incident.detail || incident.summary || '',
            state: incidentState,
            owner: incident.owner || 'ops',
            source: 'control-center',
        });
    });

    addWaveItem(waves, 'wave-1', {
        id: 'release-evidence',
        waveId: 'wave-1',
        title: 'Evidencia consolidada',
        detail:
            controlCenter.evidenceSummary ||
            controlCenter.runbookMarkdown ||
            controlCenter.clipboardSummary ||
            '',
        state: controlCenter.tone || 'ready',
        owner: 'ops',
        source: 'release-evidence',
    });

    addWaveItem(waves, 'wave-2', {
        id: 'release-war-room',
        waveId: 'wave-2',
        title: 'Release war room',
        detail:
            releaseWarRoomSnapshot.boardMarkdown ||
            releaseWarRoomSnapshot.escalationMarkdown ||
            releaseWarRoomSnapshot.summary ||
            controlCenter.runbookMarkdown ||
            '',
        state:
            releaseWarRoomSnapshot.decision === 'hold'
                ? 'alert'
                : releaseWarRoomSnapshot.decision === 'review'
                  ? 'warning'
                  : 'ready',
        owner: 'ops',
        source: 'release-war-room',
    });

    addWaveItem(waves, 'global', {
        id: 'clinic-profile',
        waveId: 'global',
        title: 'Perfil clínico',
        detail: [
            controlCenter.clinicName,
            controlCenter.clinicId,
            controlCenter.profileFingerprint,
            controlCenter.releaseMode,
        ]
            .filter(Boolean)
            .join(' · '),
        state: 'ready',
        owner: 'ops',
        source: 'control-center',
    });

    addWaveItem(waves, 'global', {
        id: 'freeze-registry',
        waveId: 'global',
        title: 'Freeze registry',
        detail: freezeRegistry.summary,
        state: freezeRegistry.state,
        owner: 'deploy',
        source: 'freeze-registry',
    });

    freezeRegistry.items.forEach((item, index) => {
        const waveId = normalizeWaveBucketId(item.waveId);
        addWaveItem(waves, waveId, {
            id: item.id || `${waveId}-freeze-${index + 1}`,
            waveId,
            title: `Freeze window: ${item.label}`,
            detail:
                [item.startAt, item.endAt].filter(Boolean).join(' → ') ||
                item.reason ||
                item.notes ||
                '',
            state: item.state,
            owner: item.owner || 'deploy',
            source: 'freeze-registry',
            notes: item.notes,
        });
    });

    Object.values(waves).forEach((bucket) => finalizeWaveBucket(bucket));

    const waveCounts = Object.fromEntries(
        WAVE_ORDER.map((waveId) => [waveId, waves[waveId].items.length])
    );
    const state = combineStates(
        controlCenter.tone || 'ready',
        freezeRegistry.state || 'ready',
        ...Object.values(waves).map((bucket) => bucket.state)
    );
    const summary =
        `Wave plan ${state} · ` +
        `wave-0 ${waveCounts['wave-0']} · wave-1 ${waveCounts['wave-1']} · wave-2 ${waveCounts['wave-2']} · global ${waveCounts.global}`;
    const supportCopy = freezeRegistry.summary;
    const markdown = buildWavePlannerMarkdown({
        clinicId: controlCenter.clinicId,
        clinicName: controlCenter.clinicName,
        decision: controlCenter.decision,
        state,
        summary,
        waves,
    });
    const pack = {
        clinicId: controlCenter.clinicId,
        clinicName: controlCenter.clinicName,
        profileFingerprint: controlCenter.profileFingerprint,
        releaseMode: controlCenter.releaseMode,
        decision: controlCenter.decision,
        state,
        summary,
        supportCopy,
        waveCounts,
        waves,
        freezeRegistry: freezeRegistry.pack,
        releaseWarRoomSnapshot,
        markdown,
    };

    return {
        ...pack,
        pack,
    };
}

export function buildTurneroReleaseBlastRadius(input = {}, options = {}) {
    const controlCenter = resolveControlCenterModel(input, options);
    const freezeRegistry = resolveFreezeRegistryView(
        input,
        options,
        controlCenter
    );
    const wavePlanner =
        options.wavePlanner ||
        input.wavePlanner ||
        buildTurneroReleaseWavePlanner(
            {
                controlCenter,
                freezeRegistry,
                releaseWarRoomSnapshot:
                    options.releaseWarRoomSnapshot ||
                    input.releaseWarRoomSnapshot,
            },
            options
        );

    const incidentPenalty = toArray(controlCenter.incidents).reduce(
        (sum, incident) =>
            sum +
            (normalizeWaveState(incident.state) === 'alert'
                ? 18
                : normalizeWaveState(incident.state) === 'warning'
                  ? 7
                  : 2),
        0
    );
    const freezePenalty =
        freezeRegistry.counts.active * 12 + freezeRegistry.counts.paused * 6;
    const decisionPenalty =
        controlCenter.decision === 'hold'
            ? 30
            : controlCenter.decision === 'review'
              ? 14
              : 0;
    const wavePenalty =
        wavePlanner.state === 'alert'
            ? 20
            : wavePlanner.state === 'warning'
              ? 9
              : 0;
    const fingerprintPenalty = controlCenter.profileFingerprint ? 0 : 8;
    const riskScore = clamp(
        10 +
            incidentPenalty +
            freezePenalty +
            decisionPenalty +
            wavePenalty +
            fingerprintPenalty,
        0,
        100
    );
    const state =
        riskScore >= 70 ? 'alert' : riskScore >= 35 ? 'warning' : 'ready';
    const scenarios = [
        {
            id: 'deploy-now',
            label: 'Desplegar ahora',
            state,
            detail: `${riskScore}/100 · ${freezeRegistry.counts.active} freeze activa(s)`,
        },
        {
            id: 'freeze-hold',
            label: 'Mantener freeze',
            state: freezeRegistry.state,
            detail: freezeRegistry.summary,
        },
        {
            id: 'wave-plan',
            label: 'Seguir el wave plan',
            state: wavePlanner.state,
            detail: wavePlanner.summary,
        },
        {
            id: 'rollback-path',
            label: 'Ruta de rollback',
            state: combineStates(controlCenter.tone, wavePlanner.state),
            detail:
                controlCenter.supportCopy ||
                releaseWarRoomSummary(
                    controlCenter,
                    options.releaseWarRoomSnapshot ||
                        input.releaseWarRoomSnapshot
                ),
        },
    ];
    const summary =
        `Blast radius ${state} · risk ${riskScore}/100 · ` +
        `${freezeRegistry.counts.active} freeze activa(s) · ${toArray(controlCenter.incidents).length} incidente(s)`;
    const supportCopy =
        state === 'ready'
            ? 'La liberación puede seguir con el wave plan y la registry actual.'
            : 'Asegura los gates y rehearse rollback antes de seguir.';
    const markdown = buildBlastRadiusMarkdown({
        clinicId: controlCenter.clinicId,
        clinicName: controlCenter.clinicName,
        riskScore,
        state,
        summary,
        scenarios,
    });
    const pack = {
        clinicId: controlCenter.clinicId,
        clinicName: controlCenter.clinicName,
        profileFingerprint: controlCenter.profileFingerprint,
        decision: controlCenter.decision,
        state,
        riskScore,
        summary,
        supportCopy,
        scenarios,
        wavePlanner: wavePlanner.pack,
        freezeRegistry: freezeRegistry.pack,
        markdown,
    };

    return {
        ...pack,
        pack,
    };
}

export function buildTurneroReleaseDependencyGates(input = {}, options = {}) {
    const controlCenter = resolveControlCenterModel(input, options);
    const freezeRegistry = resolveFreezeRegistryView(
        input,
        options,
        controlCenter
    );
    const wavePlanner =
        options.wavePlanner ||
        input.wavePlanner ||
        buildTurneroReleaseWavePlanner(
            {
                controlCenter,
                freezeRegistry,
                releaseWarRoomSnapshot:
                    options.releaseWarRoomSnapshot ||
                    input.releaseWarRoomSnapshot,
            },
            options
        );
    const blastRadius =
        options.blastRadius ||
        input.blastRadius ||
        buildTurneroReleaseBlastRadius(
            {
                controlCenter,
                freezeRegistry,
                wavePlanner,
                releaseWarRoomSnapshot:
                    options.releaseWarRoomSnapshot ||
                    input.releaseWarRoomSnapshot,
            },
            options
        );
    const releaseWarRoomSnapshot =
        options.releaseWarRoomSnapshot ||
        input.releaseWarRoomSnapshot ||
        buildTurneroReleaseWarRoomModel(controlCenter.snapshot);

    const gates = [
        {
            id: 'clinic-profile',
            label: 'Clinic profile gate',
            state:
                controlCenter.clinicId && controlCenter.profileFingerprint
                    ? 'ready'
                    : 'warning',
            detail: [
                controlCenter.clinicId || 'sin clinic_id',
                controlCenter.profileFingerprint || 'sin fingerprint',
                controlCenter.releaseMode || 'sin release mode',
            ]
                .filter(Boolean)
                .join(' · '),
        },
        {
            id: 'control-center',
            label: 'Control center gate',
            state: gateToneFromSource(controlCenter.tone),
            detail: controlCenter.summary || controlCenter.supportCopy || '',
        },
        {
            id: 'freeze-registry',
            label: 'Freeze registry gate',
            state: freezeRegistry.state,
            detail: freezeRegistry.summary,
        },
        {
            id: 'wave-plan',
            label: 'Wave planner gate',
            state: wavePlanner.state,
            detail: wavePlanner.summary,
        },
        {
            id: 'blast-radius',
            label: 'Blast radius gate',
            state: blastRadius.state,
            detail: `Risk ${blastRadius.riskScore}/100`,
        },
        {
            id: 'war-room',
            label: 'War room gate',
            state:
                releaseWarRoomSnapshot.board?.decision === 'hold'
                    ? 'alert'
                    : releaseWarRoomSnapshot.board?.decision === 'review'
                      ? 'warning'
                      : 'ready',
            detail:
                releaseWarRoomSnapshot.boardMarkdown ||
                releaseWarRoomSnapshot.escalationMarkdown ||
                releaseWarRoomSnapshot.summary ||
                controlCenter.runbookMarkdown ||
                '',
        },
    ];

    const counts = gates.reduce(
        (accumulator, gate) => {
            accumulator[gate.state] += 1;
            return accumulator;
        },
        { ready: 0, warning: 0, alert: 0 }
    );
    const state =
        counts.alert > 0 ? 'alert' : counts.warning > 0 ? 'warning' : 'ready';
    const summary = `Dependency gates ${state} · ${counts.ready} ready · ${counts.warning} warning · ${counts.alert} alert`;
    const supportCopy =
        state === 'ready'
            ? 'Todos los gates principales están listos.'
            : 'Revisa los gates warning/alert antes de seguir.';
    const markdown = buildDependencyGatesMarkdown({
        clinicId: controlCenter.clinicId,
        clinicName: controlCenter.clinicName,
        state,
        summary,
        gates,
    });
    const pack = {
        clinicId: controlCenter.clinicId,
        clinicName: controlCenter.clinicName,
        profileFingerprint: controlCenter.profileFingerprint,
        decision: controlCenter.decision,
        state,
        summary,
        supportCopy,
        gates,
        counts,
        wavePlanner: wavePlanner.pack,
        blastRadius: blastRadius.pack,
        freezeRegistry: freezeRegistry.pack,
        releaseWarRoomSnapshot,
        markdown,
    };

    return {
        ...pack,
        pack,
    };
}

export function buildTurneroReleaseRollbackRehearsal(input = {}, options = {}) {
    const controlCenter = resolveControlCenterModel(input, options);
    const freezeRegistry = resolveFreezeRegistryView(
        input,
        options,
        controlCenter
    );
    const wavePlanner =
        options.wavePlanner ||
        input.wavePlanner ||
        buildTurneroReleaseWavePlanner(
            {
                controlCenter,
                freezeRegistry,
                releaseWarRoomSnapshot:
                    options.releaseWarRoomSnapshot ||
                    input.releaseWarRoomSnapshot,
            },
            options
        );
    const blastRadius =
        options.blastRadius ||
        input.blastRadius ||
        buildTurneroReleaseBlastRadius(
            {
                controlCenter,
                freezeRegistry,
                wavePlanner,
                releaseWarRoomSnapshot:
                    options.releaseWarRoomSnapshot ||
                    input.releaseWarRoomSnapshot,
            },
            options
        );
    const dependencyGates =
        options.dependencyGates ||
        input.dependencyGates ||
        buildTurneroReleaseDependencyGates(
            {
                controlCenter,
                freezeRegistry,
                wavePlanner,
                blastRadius,
                releaseWarRoomSnapshot:
                    options.releaseWarRoomSnapshot ||
                    input.releaseWarRoomSnapshot,
            },
            options
        );

    const state = combineStates(
        controlCenter.tone,
        freezeRegistry.state,
        wavePlanner.state,
        blastRadius.state,
        dependencyGates.state
    );
    const confidencePct = clamp(
        100 -
            blastRadius.riskScore -
            dependencyGates.counts.alert * 15 -
            freezeRegistry.counts.active * 5,
        0,
        100
    );
    const steps = [
        {
            id: 'freeze',
            label: 'Congelar la registry actual',
            detail: freezeRegistry.summary,
            state: freezeRegistry.state,
        },
        {
            id: 'capture',
            label: 'Capturar control center',
            detail: controlCenter.summary || controlCenter.supportCopy || '',
            state: controlCenter.tone,
        },
        {
            id: 'wave',
            label: 'Simular rollback por wave',
            detail: wavePlanner.summary,
            state: wavePlanner.state,
        },
        {
            id: 'blast',
            label: 'Verificar blast radius',
            detail: blastRadius.summary,
            state: blastRadius.state,
        },
        {
            id: 'gate',
            label: 'Validar dependency gates',
            detail: dependencyGates.summary,
            state: dependencyGates.state,
        },
    ];
    const summary =
        `Rollback rehearsal ${state} · confidence ${confidencePct}% · ` +
        `${dependencyGates.counts.alert} alert gate(s)`;
    const supportCopy =
        state === 'ready'
            ? 'Puedes ensayar el rollback antes de promover.'
            : 'Primero normaliza los gates warning/alert.';
    const markdown = buildRollbackRehearsalMarkdown({
        clinicId: controlCenter.clinicId,
        clinicName: controlCenter.clinicName,
        state,
        confidencePct,
        summary,
        steps,
    });
    const pack = {
        clinicId: controlCenter.clinicId,
        clinicName: controlCenter.clinicName,
        profileFingerprint: controlCenter.profileFingerprint,
        decision: controlCenter.decision,
        state,
        confidencePct,
        summary,
        supportCopy,
        steps,
        wavePlanner: wavePlanner.pack,
        blastRadius: blastRadius.pack,
        dependencyGates: dependencyGates.pack,
        freezeRegistry: freezeRegistry.pack,
        markdown,
    };

    return {
        ...pack,
        pack,
    };
}

function parseWindowDate(value) {
    const parsed = Date.parse(value || '');
    return Number.isNaN(parsed) ? null : parsed;
}

export function buildTurneroReleaseMaintenanceWindow(input = {}, options = {}) {
    const controlCenter = resolveControlCenterModel(input, options);
    const freezeRegistry = resolveFreezeRegistryView(
        input,
        options,
        controlCenter
    );
    const wavePlanner =
        options.wavePlanner ||
        input.wavePlanner ||
        buildTurneroReleaseWavePlanner(
            {
                controlCenter,
                freezeRegistry,
                releaseWarRoomSnapshot:
                    options.releaseWarRoomSnapshot ||
                    input.releaseWarRoomSnapshot,
            },
            options
        );
    const dependencyGates =
        options.dependencyGates ||
        input.dependencyGates ||
        buildTurneroReleaseDependencyGates(
            {
                controlCenter,
                freezeRegistry,
                wavePlanner,
                releaseWarRoomSnapshot:
                    options.releaseWarRoomSnapshot ||
                    input.releaseWarRoomSnapshot,
            },
            options
        );

    const baseTime = new Date(
        parseWindowDate(
            controlCenter.generatedAt || controlCenter.snapshot?.generatedAt
        ) || Date.now()
    );
    const activeFreezeEnds = freezeRegistry.items
        .map((item) => parseWindowDate(item.endAt))
        .filter((value) => value !== null);
    const earliestStart = activeFreezeEnds.length
        ? new Date(
              Math.max(
                  baseTime.getTime(),
                  Math.max(...activeFreezeEnds) + 30 * 60 * 1000
              )
          )
        : new Date(baseTime.getTime() + 45 * 60 * 1000);
    const durations = [30, 45, 60, 30];
    let cursor = earliestStart.getTime();

    const windows = WAVE_ORDER.map((waveId, index) => {
        const startAt = new Date(cursor);
        const duration = durations[index] || 30;
        const endAt = new Date(cursor + duration * 60 * 1000);
        cursor = endAt.getTime() + 15 * 60 * 1000;

        return {
            id: `${waveId}-maintenance`,
            waveId,
            label:
                waveId === 'global'
                    ? 'Global maintenance window'
                    : `${waveId} maintenance window`,
            startAt: startAt.toISOString(),
            endAt: endAt.toISOString(),
            durationMinutes: duration,
            state:
                dependencyGates.state === 'alert'
                    ? 'alert'
                    : freezeRegistry.state === 'warning'
                      ? 'warning'
                      : 'ready',
            detail:
                wavePlanner.waves[waveId]?.summary ||
                freezeRegistry.summary ||
                controlCenter.summary ||
                '',
        };
    });

    const state = combineStates(
        dependencyGates.state,
        freezeRegistry.state,
        wavePlanner.state
    );
    const summary =
        `Maintenance window ${state} · ${windows.length} window(s) · ` +
        `${freezeRegistry.counts.active} freeze activa(s)`;
    const supportCopy =
        state === 'ready'
            ? 'Las ventanas sugeridas ya evitan la freeze registry activa.'
            : 'Las ventanas sugieren espera adicional por los gates activos.';
    const markdown = buildMaintenanceWindowMarkdown({
        clinicId: controlCenter.clinicId,
        clinicName: controlCenter.clinicName,
        state,
        summary,
        windows,
    });
    const pack = {
        clinicId: controlCenter.clinicId,
        clinicName: controlCenter.clinicName,
        profileFingerprint: controlCenter.profileFingerprint,
        decision: controlCenter.decision,
        state,
        summary,
        supportCopy,
        windows,
        wavePlanner: wavePlanner.pack,
        freezeRegistry: freezeRegistry.pack,
        dependencyGates: dependencyGates.pack,
        markdown,
    };

    return {
        ...pack,
        pack,
    };
}

function buildExecutiveBriefMarkdown(model) {
    const nextStep =
        model.state === 'ready'
            ? '- Mantén el wave plan actual y procede cuando corresponda.'
            : model.dependencyGates.state === 'alert'
              ? '- Corrige los gates alert y rehace el rehearsal.'
              : '- Revisa la freeze registry y el blast radius antes de seguir.';

    return [
        '# Progressive Delivery Mission Control',
        '',
        `- Clinic: ${escapeMd(model.clinicName || model.clinicId || DEFAULT_CLINIC_ID)}`,
        `- Decision: ${escapeMd(model.decision)}`,
        `- State: ${escapeMd(model.state)}`,
        `- Wave plan: ${escapeMd(model.wavePlanner.summary)}`,
        `- Freeze registry: ${escapeMd(model.freezeWindowRegistry.summary)}`,
        `- Blast radius: ${escapeMd(model.blastRadius.summary)}`,
        `- Dependency gates: ${escapeMd(model.dependencyGates.summary)}`,
        `- Rollback rehearsal: ${escapeMd(model.rollbackRehearsal.summary)}`,
        `- Maintenance window: ${escapeMd(model.maintenanceWindow.summary)}`,
        '',
        '## Next step',
        nextStep,
    ].join('\n');
}

function isProgressiveDeliveryModel(input) {
    return Boolean(
        input &&
        input.pack &&
        input.wavePlanner &&
        input.freezeWindowRegistry &&
        input.blastRadius &&
        input.dependencyGates &&
        input.rollbackRehearsal &&
        input.maintenanceWindow
    );
}

export function readTurneroReleaseFreezeWindowRegistry(clinicId, options = {}) {
    const normalizedClinicId = normalizeClinicId(clinicId);
    const state = options.registry
        ? normalizeFreezeWindowRegistryState(
              options.registry,
              normalizedClinicId
          )
        : normalizeFreezeWindowRegistryState(
              readFreezeRegistryState(normalizedClinicId, options.storage),
              normalizedClinicId
          );

    return buildTurneroReleaseFreezeWindowRegistryView(
        state,
        normalizedClinicId
    );
}

export function writeTurneroReleaseFreezeWindowRegistry(
    clinicId,
    nextState,
    options = {}
) {
    const normalizedClinicId = normalizeClinicId(clinicId);
    const persisted = writeFreezeRegistryState(
        normalizedClinicId,
        nextState,
        options.storage
    );

    return buildTurneroReleaseFreezeWindowRegistryView(
        persisted,
        normalizedClinicId
    );
}

export function upsertTurneroReleaseFreezeWindow(
    clinicId,
    record,
    options = {}
) {
    const registry = readTurneroReleaseFreezeWindowRegistry(clinicId, options);
    const normalizedClinicId = normalizeClinicId(clinicId);
    const normalizedRecord = normalizeFreezeWindowRecord(
        record,
        normalizedClinicId,
        registry.items.length
    );
    const nextItems = registry.items.filter(
        (item) => item.id !== normalizedRecord.id
    );
    nextItems.push(normalizedRecord);
    nextItems.sort(compareFreezeWindows);

    return writeTurneroReleaseFreezeWindowRegistry(
        normalizedClinicId,
        {
            clinicId: normalizedClinicId,
            updatedAt: nowIso(),
            items: nextItems,
        },
        options
    );
}

export function removeTurneroReleaseFreezeWindow(
    clinicId,
    freezeWindowId,
    options = {}
) {
    const registry = readTurneroReleaseFreezeWindowRegistry(clinicId, options);
    const normalizedClinicId = normalizeClinicId(clinicId);
    const nextItems = registry.items.filter(
        (item) => item.id !== freezeWindowId
    );

    return writeTurneroReleaseFreezeWindowRegistry(
        normalizedClinicId,
        {
            clinicId: normalizedClinicId,
            updatedAt: nowIso(),
            items: nextItems,
        },
        options
    );
}

export function clearTurneroReleaseFreezeWindowRegistry(
    clinicId,
    options = {}
) {
    const normalizedClinicId = normalizeClinicId(clinicId);
    const storage = getStorage(options.storage);
    const key = freezeRegistryKey(normalizedClinicId);

    if (storage) {
        removeJson(storage, key);
    } else {
        MEMORY_FREEZE_REGISTRIES.delete(key);
    }

    return buildTurneroReleaseFreezeWindowRegistryView(
        {
            clinicId: normalizedClinicId,
            updatedAt: nowIso(),
            items: [],
        },
        normalizedClinicId
    );
}

export function createTurneroReleaseFreezeWindowTemplate(
    clinicId,
    waveId = 'global',
    overrides = {}
) {
    const normalizedClinicId = normalizeClinicId(clinicId);
    const normalizedWaveId = normalizeWaveBucketId(waveId);
    const now = nowIso();

    return normalizeFreezeWindowRecord(
        {
            id:
                overrides.id ||
                `${normalizedClinicId}-${normalizedWaveId}-${Date.now().toString(36)}`,
            clinicId: normalizedClinicId,
            waveId: normalizedWaveId,
            label: overrides.label || '',
            startAt: overrides.startAt || '',
            endAt: overrides.endAt || '',
            owner: overrides.owner || 'deploy',
            reason: overrides.reason || '',
            status: overrides.status || 'planned',
            notes: overrides.notes || '',
            updatedAt: overrides.updatedAt || now,
        },
        normalizedClinicId
    );
}

export function summarizeTurneroReleaseFreezeWindowRegistry(
    registry,
    options = {}
) {
    const normalized = normalizeFreezeWindowRegistryState(
        registry,
        options.clinicId
    );

    return buildFreezeWindowSummary(normalized);
}

export function buildTurneroReleaseFreezeWindowRegistryMarkdownExport(
    registry,
    options = {}
) {
    return buildTurneroReleaseFreezeWindowRegistryMarkdown(registry, options);
}

export function buildTurneroReleaseProgressiveDelivery(
    input = {},
    options = {}
) {
    if (isProgressiveDeliveryModel(input)) {
        return input;
    }

    const controlCenter = resolveControlCenterModel(input, options);
    const releaseWarRoomSnapshot =
        options.releaseWarRoomSnapshot ||
        input.releaseWarRoomSnapshot ||
        buildTurneroReleaseWarRoomModel(controlCenter.snapshot);
    const freezeRegistry = resolveFreezeRegistryView(
        input,
        options,
        controlCenter
    );
    const wavePlanner = buildTurneroReleaseWavePlanner(
        {
            controlCenter,
            releaseWarRoomSnapshot,
            freezeRegistry,
        },
        options
    );
    const blastRadius = buildTurneroReleaseBlastRadius(
        {
            controlCenter,
            releaseWarRoomSnapshot,
            freezeRegistry,
            wavePlanner,
        },
        options
    );
    const dependencyGates = buildTurneroReleaseDependencyGates(
        {
            controlCenter,
            releaseWarRoomSnapshot,
            freezeRegistry,
            wavePlanner,
            blastRadius,
        },
        options
    );
    const rollbackRehearsal = buildTurneroReleaseRollbackRehearsal(
        {
            controlCenter,
            releaseWarRoomSnapshot,
            freezeRegistry,
            wavePlanner,
            blastRadius,
            dependencyGates,
        },
        options
    );
    const maintenanceWindow = buildTurneroReleaseMaintenanceWindow(
        {
            controlCenter,
            releaseWarRoomSnapshot,
            freezeRegistry,
            wavePlanner,
            blastRadius,
            dependencyGates,
            rollbackRehearsal,
        },
        options
    );
    const state = combineStates(
        controlCenter.tone || 'ready',
        freezeRegistry.state,
        wavePlanner.state,
        blastRadius.state,
        dependencyGates.state,
        rollbackRehearsal.state,
        maintenanceWindow.state
    );
    const executiveBriefMarkdown = buildExecutiveBriefMarkdown({
        clinicId: controlCenter.clinicId,
        clinicName: controlCenter.clinicName,
        decision: controlCenter.decision,
        state,
        wavePlanner,
        freezeWindowRegistry: freezeRegistry,
        blastRadius,
        dependencyGates,
        rollbackRehearsal,
        maintenanceWindow,
    });
    const supportCopy = [
        wavePlanner.summary,
        dependencyGates.summary,
        blastRadius.summary,
    ]
        .filter(Boolean)
        .join(' · ');
    const summary =
        controlCenter.summary || executiveBriefMarkdown.split('\n')[5] || '';
    const chips = [
        {
            id: 'decision',
            label: 'Decision',
            value: controlCenter.decision,
            state: controlCenter.tone || 'ready',
        },
        {
            id: 'wave-plan',
            label: 'Wave plan',
            value: wavePlanner.state,
            state: wavePlanner.state,
        },
        {
            id: 'freeze-windows',
            label: 'Freeze windows',
            value: `${freezeRegistry.counts.active}/${freezeRegistry.counts.total}`,
            state: freezeRegistry.state,
        },
        {
            id: 'blast-radius',
            label: 'Blast radius',
            value: `${blastRadius.riskScore}/100`,
            state: blastRadius.state,
        },
        {
            id: 'gates',
            label: 'Gates',
            value: dependencyGates.state,
            state: dependencyGates.state,
        },
    ];
    const freezeWindowRegistryMarkdown = freezeRegistry.markdown;
    const generatedAt = nowIso();
    const snapshotFileName = `${safeFilePart(
        controlCenter.clinicId ||
            controlCenter.clinicShortName ||
            controlCenter.clinicName
    )}-${generatedAt.slice(0, 10).replaceAll('-', '')}.json`;
    const pack = {
        generatedAt,
        clinicId: controlCenter.clinicId,
        clinicName: controlCenter.clinicName,
        clinicShortName: controlCenter.clinicShortName,
        profileFingerprint: controlCenter.profileFingerprint,
        releaseMode: controlCenter.releaseMode,
        decision: controlCenter.decision,
        state,
        summary,
        supportCopy,
        chips,
        controlCenterSnapshot: controlCenter.snapshot,
        releaseWarRoomSnapshot,
        freezeWindowRegistry: freezeRegistry.pack,
        wavePlanner: wavePlanner.pack,
        blastRadius: blastRadius.pack,
        dependencyGates: dependencyGates.pack,
        rollbackRehearsal: rollbackRehearsal.pack,
        maintenanceWindow: maintenanceWindow.pack,
        executiveBriefMarkdown,
        wavePlanMarkdown: wavePlanner.markdown,
        freezeWindowRegistryMarkdown,
        blastRadiusMarkdown: blastRadius.markdown,
        dependencyGatesMarkdown: dependencyGates.markdown,
        rollbackRehearsalMarkdown: rollbackRehearsal.markdown,
        maintenanceWindowMarkdown: maintenanceWindow.markdown,
        snapshotFileName,
    };

    const model = {
        clinicId: controlCenter.clinicId,
        clinicName: controlCenter.clinicName,
        clinicShortName: controlCenter.clinicShortName,
        profileFingerprint: controlCenter.profileFingerprint,
        releaseMode: controlCenter.releaseMode,
        generatedAt,
        decision: controlCenter.decision,
        state,
        tone: state,
        summary,
        supportCopy,
        chips,
        controlCenter,
        releaseWarRoomSnapshot,
        freezeWindowRegistry: freezeRegistry,
        wavePlanner,
        blastRadius,
        dependencyGates,
        rollbackRehearsal,
        maintenanceWindow,
        executiveBriefMarkdown,
        wavePlanMarkdown: wavePlanner.markdown,
        freezeWindowRegistryMarkdown,
        blastRadiusMarkdown: blastRadius.markdown,
        dependencyGatesMarkdown: dependencyGates.markdown,
        rollbackRehearsalMarkdown: rollbackRehearsal.markdown,
        maintenanceWindowMarkdown: maintenanceWindow.markdown,
        clipboardSummary: executiveBriefMarkdown,
        snapshotFileName,
        pack,
        snapshot: pack,
        json: pack,
        exports: {
            executiveBrief: executiveBriefMarkdown,
            wavePlan: wavePlanner.markdown,
            freezeWindowRegistry: freezeWindowRegistryMarkdown,
            blastRadius: blastRadius.markdown,
            dependencyGates: dependencyGates.markdown,
            rollbackRehearsal: rollbackRehearsal.markdown,
            maintenanceWindow: maintenanceWindow.markdown,
            json: pack,
        },
    };

    return model;
}

export const buildReleaseMissionControl =
    buildTurneroReleaseProgressiveDelivery;
export { buildTurneroReleaseFreezeWindowRegistryMarkdownExport as buildTurneroReleaseFreezeWindowRegistryMarkdown };
export const buildTurneroReleaseWavePlannerMarkdown = buildWavePlannerMarkdown;
export const buildTurneroReleaseBlastRadiusMarkdown = buildBlastRadiusMarkdown;
export const buildTurneroReleaseDependencyGatesMarkdown =
    buildDependencyGatesMarkdown;
export const buildTurneroReleaseRollbackRehearsalMarkdown =
    buildRollbackRehearsalMarkdown;
export const buildTurneroReleaseMaintenanceWindowMarkdown =
    buildMaintenanceWindowMarkdown;

export {
    cloneValue,
    isPlainObject,
    normalizeState,
    combineStates,
    safeFilePart,
};

export default buildTurneroReleaseProgressiveDelivery;
