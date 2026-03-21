import { formatTimestamp, toArray, toString } from './turnero-surface-helpers.js';

function normalizeTone(band) {
    const normalized = toString(band, 'degraded');
    if (normalized === 'ready') {
        return 'ready';
    }
    if (normalized === 'watch') {
        return 'warning';
    }
    return 'alert';
}

function buildSummary(gate, checklist, snapshot, templates, owners) {
    const all = Number(checklist.summary?.all || 0) || 0;
    const pass = Number(checklist.summary?.pass || 0) || 0;
    const templateSummary =
        templates.length > 0
            ? `${Number(gate.readyTemplateCount || 0)}/${templates.length} templates listos`
            : `template ${toString(snapshot.templateState, 'draft')}`;
    const ownerSummary =
        owners.length > 0
            ? `${Number(gate.activeOwnerCount || 0)}/${owners.length} owners activos`
            : `owner ${toString(snapshot.replicationOwner, 'sin owner') || 'sin owner'}`;

    if (gate.band === 'ready') {
        return `Scaleout listo. Checklist ${pass}/${all}, ${templateSummary} y ${ownerSummary}.`;
    }
    if (gate.band === 'watch') {
        return `Scaleout en observacion. Checklist ${pass}/${all}, ${templateSummary} y ${ownerSummary}.`;
    }
    if (gate.band === 'degraded') {
        return `Scaleout degradado. Checklist ${pass}/${all}, ${templateSummary} y ${ownerSummary}.`;
    }
    return `Scaleout bloqueado. Checklist ${pass}/${all}, ${templateSummary} y ${ownerSummary}.`;
}

function buildDetail(snapshot) {
    return [
        `Runtime ${toString(snapshot.runtimeState, 'unknown')}`,
        `truth ${toString(snapshot.truth, 'unknown')}`,
        `template ${toString(snapshot.templateState, 'draft')}`,
        `asset ${toString(snapshot.assetProfile, 'unknown')}`,
        `owner ${toString(snapshot.replicationOwner, 'sin owner') || 'sin owner'}`,
        `install ${toString(snapshot.installTimeBucket, 'unknown')}`,
        `docs ${toString(snapshot.documentationState, 'draft')}`,
    ].join(' · ');
}

function buildBrief(state) {
    const checks = Array.isArray(state.checklist?.checks)
        ? state.checklist.checks
        : [];
    const lines = [
        '# Surface Replication Scaleout',
        '',
        `Surface: ${toString(state.surfaceLabel, state.surfaceKey)}`,
        `Clinic: ${toString(state.clinicLabel, state.clinicId || 'n/a')}`,
        `Scope: ${toString(state.scope, 'global')}`,
        `Gate: ${toString(state.gateBand, 'unknown')} (${Number(
            state.gateScore || 0
        )})`,
        `Decision: ${toString(state.gateDecision, 'review')}`,
        '',
        '## Snapshot',
        `- Runtime: ${toString(state.runtimeState, 'unknown')}`,
        `- Truth: ${toString(state.truth, 'unknown')}`,
        `- Template state: ${toString(state.templateState, 'draft')}`,
        `- Asset profile: ${toString(state.assetProfile, 'unknown')}`,
        `- Replication owner: ${toString(
            state.replicationOwner,
            'sin owner'
        ) || 'sin owner'}`,
        `- Install time: ${toString(state.installTimeBucket, 'unknown')}`,
        `- Documentation: ${toString(state.documentationState, 'draft')}`,
        '',
        '## Checklist',
    ];

    if (checks.length === 0) {
        lines.push('- Sin checks.');
    } else {
        checks.forEach((check) => {
            lines.push(
                `- [${check.pass ? 'x' : ' '}] ${toString(check.label, check.key)}`
            );
        });
    }

    lines.push('', '## Templates');
    if (state.templates.length === 0) {
        lines.push('- Sin templates registrados.');
    } else {
        state.templates.forEach((entry) => {
            lines.push(
                `- [${toString(entry.status, 'ready')}] ${toString(entry.surfaceKey, 'surface')} · ${toString(entry.template, 'deployment-template')} · ${toString(entry.version, 'v1')} · ${toString(entry.note, '')}`
            );
        });
    }

    lines.push('', '## Owners');
    if (state.owners.length === 0) {
        lines.push('- Sin owners registrados.');
    } else {
        state.owners.forEach((entry) => {
            lines.push(
                `- [${toString(entry.status, 'active')}] ${toString(entry.surfaceKey, 'surface')} · ${toString(entry.actor, 'owner')} · ${toString(entry.role, 'replication')} · ${toString(entry.note, '')}`
            );
        });
    }

    return lines.join('\n').trim();
}

export function buildTurneroSurfaceReplicationReadout(input = {}) {
    const snapshot =
        input.snapshot && typeof input.snapshot === 'object'
            ? input.snapshot
            : {};
    const checklist =
        input.checklist && typeof input.checklist === 'object'
            ? input.checklist
            : {
                  checks: [],
                  summary: {
                      all: 0,
                      pass: 0,
                      fail: 0,
                  },
              };
    const gate =
        input.gate && typeof input.gate === 'object' ? input.gate : {};
    const templates = Array.isArray(input.templates) ? input.templates : [];
    const owners = Array.isArray(input.owners) ? input.owners : [];
    const gateBand = toString(gate.band, 'degraded');
    const gateScore = Number(gate.score || 0) || 0;

    return {
        surfaceKey: toString(snapshot.surfaceKey, 'surface'),
        surfaceLabel: toString(snapshot.surfaceLabel, snapshot.surfaceKey || 'surface'),
        clinicId: toString(snapshot.clinicId, ''),
        clinicLabel: toString(snapshot.clinicLabel, ''),
        scope: toString(snapshot.scope, 'global'),
        runtimeState: toString(snapshot.runtimeState, 'unknown'),
        truth: toString(snapshot.truth, 'unknown'),
        templateState: toString(snapshot.templateState, 'draft'),
        assetProfile: toString(snapshot.assetProfile, 'unknown'),
        replicationOwner: toString(snapshot.replicationOwner, ''),
        installTimeBucket: toString(snapshot.installTimeBucket, 'unknown'),
        documentationState: toString(snapshot.documentationState, 'draft'),
        checklistAll: Number(checklist.summary?.all || 0) || 0,
        checklistPass: Number(checklist.summary?.pass || 0) || 0,
        checklistFail: Number(checklist.summary?.fail || 0) || 0,
        templateCount: templates.length,
        readyTemplateCount: Number(gate.readyTemplateCount || 0) || 0,
        ownerCount: owners.length,
        activeOwnerCount: Number(gate.activeOwnerCount || 0) || 0,
        gateBand,
        gateScore,
        gateDecision: toString(gate.decision, 'hold-scaleout'),
        title:
            gateBand === 'ready'
                ? 'Replicación lista'
                : gateBand === 'watch'
                  ? 'Replicación en observacion'
                  : gateBand === 'degraded'
                    ? 'Replicación degradada'
                    : 'Replicación bloqueada',
        summary: buildSummary(gate, checklist, snapshot, templates, owners),
        detail: buildDetail(snapshot),
        badge: `${gateBand} · ${gateScore}`,
        tone: normalizeTone(gateBand),
        brief: buildBrief({
            ...snapshot,
            gateBand,
            gateScore,
            gateDecision: toString(gate.decision, 'hold-scaleout'),
            checklist,
            templates,
            owners,
        }),
        generatedAt: new Date().toISOString(),
    };
}
