import {
    asObject,
    buildTurneroReleaseControlCenterModel,
    inferOwnerFromText,
    normalizeOwner,
    toArray,
    toReleaseControlCenterSnapshot,
    toText,
} from './turnero-release-control-center.js';

const OWNER_RECIPES = {
    deploy: {
        label: 'Deploy',
        focus: 'shell público, publish y drift visible',
        commands: [
            'Revisar shell público',
            'Validar publish activo',
            'Comparar rutas del shell',
        ],
        docs: ['Runbook deploy', 'Checklist de publicación'],
    },
    backend: {
        label: 'Backend',
        focus: 'health, figo, contratos y catálogos',
        commands: [
            'Revisar /health',
            'Validar figo y contratos',
            'Corroborar identidad y catálogo',
        ],
        docs: ['Runbook backend', 'Checklist de health'],
    },
    frontend: {
        label: 'Frontend',
        focus: 'admin, queue surfaces y wiring',
        commands: [
            'Revisar render del admin',
            'Validar wiring de la cola',
            'Pasar smoke UI',
        ],
        docs: ['Checklist de UI', 'Guía de handoff frontend'],
    },
    ops: {
        label: 'Ops',
        focus: 'runbook, evidencias y operación por clínica',
        commands: ['Abrir runbook', 'Coordinar handoff', 'Registrar evidencia'],
        docs: ['Playbook operativo', 'Bitácora de incidentes'],
    },
    unknown: {
        label: 'Pendiente',
        focus: 'clasificar owner antes de abrir corte',
        commands: [
            'Clasificar owner',
            'Asignar responsable',
            'Releer brief del corte',
        ],
        docs: ['Matriz de ownership', 'Guía de triage'],
    },
};

function isControlCenterSnapshot(value) {
    return Boolean(
        value && typeof value === 'object' && value.parts && value.signals
    );
}

function normalizeControlCenterSnapshot(value) {
    return isControlCenterSnapshot(value)
        ? value
        : toReleaseControlCenterSnapshot(value);
}

function uniqueStrings(values) {
    return Array.from(
        new Set(
            toArray(values)
                .map((item) => toText(item))
                .filter(Boolean)
        )
    );
}

function escapeMd(value) {
    return String(value ?? '')
        .replace(/\\/g, '\\\\')
        .replace(/`/g, '\\`')
        .replace(/\r?\n/g, ' ')
        .trim();
}

function slugify(value) {
    return (
        toText(value)
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, '_')
            .replace(/^_+|_+$/g, '') || 'incident'
    );
}

function incidentSeverityFromSignal(signalState, itemSeverity) {
    const source = toText(
        itemSeverity || signalState || 'info',
        'info'
    ).toLowerCase();

    if (['alert', 'blocker', 'blocked', 'critical', 'error'].includes(source)) {
        return 'blocker';
    }

    if (['warning', 'watch', 'pending', 'pending_review'].includes(source)) {
        return 'warning';
    }

    return 'info';
}

function recipeForOwner(owner) {
    return OWNER_RECIPES[normalizeOwner(owner)] || OWNER_RECIPES.unknown;
}

function recommendationsForOwner(owner, signalKey, item = {}) {
    const recipe = recipeForOwner(owner);
    const commands = uniqueStrings([
        ...recipe.commands,
        ...toArray(item.recommendedCommands),
    ]);
    const docs = uniqueStrings([
        ...recipe.docs,
        ...toArray(item.recommendedDocs),
    ]);

    return {
        commands,
        docs,
        focus: recipe.focus,
        label: recipe.label,
        nextCheck: toText(
            item.nextCheck ||
                item.followUp ||
                recipe.focus ||
                signalKey ||
                'monitor'
        ),
    };
}

function buildIncidentFromSignal(snapshot, signalKey, signal, item, index) {
    const signalState = toText(signal?.state || 'info', 'info');
    const fallbackOwner =
        signalKey === 'publicShellDrift'
            ? 'deploy'
            : signalKey === 'releaseEvidenceBundle'
              ? 'ops'
              : 'unknown';
    const owner = normalizeOwner(
        item.owner ||
            item.recommendedOwner ||
            item.assignee ||
            inferOwnerFromText(
                `${signalKey} ${item.title || item.label || ''} ${
                    item.detail || item.summary || ''
                }`,
                fallbackOwner
            )
    );
    const severity = incidentSeverityFromSignal(
        signalState,
        item.severity || item.state || item.tone || item.status
    );
    const title = toText(
        item.title ||
            item.label ||
            item.name ||
            signal?.label ||
            `${signalKey} ${index + 1}`
    );
    const detail = toText(
        item.detail ||
            item.summary ||
            item.reason ||
            item.note ||
            signal?.summary ||
            signal?.support ||
            title
    );
    const recommendations = recommendationsForOwner(owner, signalKey, item);
    const source = toText(item.source || signalKey, signalKey);
    const updatedAt = toText(
        item.updatedAt || snapshot.generatedAt || new Date().toISOString()
    );

    return {
        id: toText(
            item.id,
            `${signalKey}-${owner}-${slugify(title)}-${index + 1}`
        ),
        owner,
        title,
        detail,
        severity,
        state: severity,
        source,
        signalKey,
        signalState,
        signalLabel: toText(signal?.label || signalKey, signalKey),
        why: toText(item.why || item.note || item.reason || detail),
        note: toText(item.note || ''),
        nextCheck: recommendations.nextCheck,
        recommendedCommands: recommendations.commands,
        recommendedDocs: recommendations.docs,
        evidence: asObject({
            ...(asObject(item.evidence) || {}),
            signalKey,
            signalState,
            signalLabel: toText(signal?.label || signalKey, signalKey),
            clinicId: snapshot.clinicId,
            profileFingerprint: snapshot.profileFingerprint,
        }),
        topIncidentTitles: uniqueStrings(
            item.topIncidentTitles ||
                item.top_titles ||
                item.topTitles || [title]
        ),
        updatedAt,
    };
}

function buildIncidentFromReleaseEvidence(snapshot, signal, index, blocker) {
    const owner = normalizeOwner(
        blocker.owner ||
            blocker.lane ||
            inferOwnerFromText(
                `${blocker.title || ''} ${blocker.detail || ''} ${signal?.label || ''}`,
                'ops'
            )
    );
    const title = toText(
        blocker.title || blocker.label || `Bloqueo de evidencia ${index + 1}`
    );
    const detail = toText(
        blocker.detail || blocker.reason || signal?.summary || title
    );
    const recipe = recommendationsForOwner(
        owner,
        'releaseEvidenceBundle',
        blocker
    );
    const severity = incidentSeverityFromSignal(
        'alert',
        blocker.severity || 'alert'
    );

    return {
        id: toText(
            blocker.id,
            `releaseEvidenceBundle-${owner}-${slugify(title)}-${index + 1}`
        ),
        owner,
        title,
        detail,
        severity,
        state: severity,
        source: 'releaseEvidenceBundle.blocker',
        signalKey: 'releaseEvidenceBundle',
        signalState: 'alert',
        signalLabel: toText(signal?.label || 'Evidencia', 'Evidencia'),
        why: toText(blocker.reason || blocker.note || detail),
        note: toText(blocker.note || ''),
        nextCheck: recipe.nextCheck,
        recommendedCommands: uniqueStrings([
            ...recipe.commands,
            ...toArray(blocker.recommendedCommands),
        ]),
        recommendedDocs: uniqueStrings([
            ...recipe.docs,
            ...toArray(blocker.recommendedDocs),
        ]),
        evidence: asObject({
            ...asObject(blocker.evidence),
            signalKey: 'releaseEvidenceBundle',
            clinicId: snapshot.clinicId,
            profileFingerprint: snapshot.profileFingerprint,
        }),
        topIncidentTitles: uniqueStrings([title]),
        updatedAt: toText(
            blocker.updatedAt ||
                snapshot.generatedAt ||
                new Date().toISOString()
        ),
    };
}

function buildOwnerBreakdown(incidents) {
    const breakdown = {};

    Object.entries(OWNER_RECIPES).forEach(([owner, recipe]) => {
        breakdown[owner] = {
            owner,
            label: recipe.label,
            focus: recipe.focus,
            total: 0,
            blocker: 0,
            warning: 0,
            info: 0,
            score: 0,
            sources: [],
            topTitles: [],
        };
    });

    breakdown.totals = {
        owner: 'totals',
        label: 'Total',
        focus: '',
        total: 0,
        blocker: 0,
        warning: 0,
        info: 0,
        score: 0,
        sources: [],
        topTitles: [],
    };

    incidents.forEach((incident) => {
        const bucket =
            breakdown[incident.owner] || breakdown.unknown || breakdown.totals;

        bucket.total += 1;
        bucket[incident.severity] += 1;
        bucket.score +=
            incident.severity === 'blocker'
                ? 3
                : incident.severity === 'warning'
                  ? 2
                  : 1;
        if (incident.source) {
            bucket.sources = uniqueStrings([
                ...bucket.sources,
                incident.source,
            ]);
        }
        bucket.topTitles = uniqueStrings([...bucket.topTitles, incident.title]);

        breakdown.totals.total += 1;
        breakdown.totals[incident.severity] += 1;
        breakdown.totals.score +=
            incident.severity === 'blocker'
                ? 3
                : incident.severity === 'warning'
                  ? 2
                  : 1;
        if (incident.source) {
            breakdown.totals.sources = uniqueStrings([
                ...breakdown.totals.sources,
                incident.source,
            ]);
        }
        breakdown.totals.topTitles = uniqueStrings([
            ...breakdown.totals.topTitles,
            incident.title,
        ]);
    });

    return breakdown;
}

function decisionFromBreakdown(breakdown) {
    if ((breakdown?.totals?.blocker || 0) > 0) {
        return 'hold';
    }

    if ((breakdown?.totals?.warning || 0) > 0) {
        return 'review';
    }

    return 'ready';
}

function decisionReasonFromBreakdown(snapshot, breakdown) {
    const totals = breakdown?.totals || {};
    const orderedOwners = Object.values(breakdown || {})
        .filter((entry) => entry && entry.owner && entry.owner !== 'totals')
        .sort((left, right) => {
            if (right.score !== left.score) {
                return right.score - left.score;
            }

            return String(left.label || left.owner).localeCompare(
                String(right.label || right.owner)
            );
        })
        .slice(0, 3)
        .map((entry) => entry.label || entry.owner);

    const ownerText = orderedOwners.length
        ? ` en ${orderedOwners.join(', ')}`
        : '';

    if ((totals.blocker || 0) > 0) {
        return `Se detectaron ${totals.blocker} bloqueo(s)${ownerText}.`;
    }

    if ((totals.warning || 0) > 0) {
        return `Sin bloqueos duros; quedan ${totals.warning} advertencia(s)${ownerText}.`;
    }

    return snapshot?.clinicName
        ? `Sin bloqueos visibles; ${snapshot.clinicName} queda lista para corte.`
        : 'Sin bloqueos visibles; la clínica queda lista para corte.';
}

function buildSummaryCountsFromBreakdown(breakdown) {
    const totals = asObject(breakdown?.totals);
    const blocker = Number(totals.blocker || 0);
    const warning = Number(totals.warning || 0);
    const info = Number(totals.info || 0);

    return {
        blocker,
        warning,
        info,
        total: Number(totals.total || blocker + warning + info),
        score: Number(totals.score || blocker * 3 + warning * 2 + info),
    };
}

function buildOwnerBreakdownRows(ownerBreakdown) {
    return Object.values(asObject(ownerBreakdown))
        .filter(
            (entry) =>
                entry &&
                typeof entry === 'object' &&
                entry.owner &&
                entry.owner !== 'totals'
        )
        .map((entry) => ({
            owner: toText(entry.owner, 'unknown'),
            label: toText(entry.label || entry.owner || 'Pendiente'),
            focus: toText(entry.focus || ''),
            total: Number(entry.total || 0),
            blocker: Number(entry.blocker || 0),
            warning: Number(entry.warning || 0),
            info: Number(entry.info || 0),
            score: Number(entry.score || 0),
            sources: uniqueStrings(entry.sources),
            topTitles: uniqueStrings(entry.topTitles),
        }))
        .sort((left, right) => {
            if (right.score !== left.score) {
                return right.score - left.score;
            }

            if (right.total !== left.total) {
                return right.total - left.total;
            }

            return String(left.label || left.owner).localeCompare(
                String(right.label || right.owner)
            );
        });
}

function addSignalIncidents(snapshot, signalKey, signal, incidents) {
    const items = toArray(signal?.items);

    items.forEach((item, index) => {
        incidents.push(
            buildIncidentFromSignal(snapshot, signalKey, signal, item, index)
        );
    });

    if (signalKey !== 'releaseEvidenceBundle') {
        return;
    }

    const rawBundle = asObject(signal?.raw);
    toArray(rawBundle.blockers).forEach((blocker, index) => {
        incidents.push(
            buildIncidentFromReleaseEvidence(snapshot, signal, index, blocker)
        );
    });

    if (
        (rawBundle.finalState === 'blocked' ||
            rawBundle.finalState === 'warning') &&
        toArray(rawBundle.blockers).length === 0
    ) {
        incidents.push(
            buildIncidentFromReleaseEvidence(snapshot, signal, 0, {
                id: `${signalKey}-summary`,
                title: rawBundle.finalLabel || 'Evidencia de salida',
                detail:
                    rawBundle.summary ||
                    rawBundle.finalLabel ||
                    'La evidencia todavía no cierra.',
                severity:
                    rawBundle.finalState === 'blocked' ? 'alert' : 'warning',
                owner: inferOwnerFromText(
                    `${rawBundle.finalLabel || ''} ${rawBundle.summary || ''}`,
                    'ops'
                ),
                note: toText(rawBundle.note || ''),
            })
        );
    }
}

export function buildTurneroRemediationPlaybook(input = {}) {
    const snapshot = normalizeControlCenterSnapshot(input);
    const incidents = [];

    [
        'pilotReadiness',
        'remoteReleaseReadiness',
        'publicShellDrift',
        'releaseEvidenceBundle',
    ].forEach((signalKey) => {
        const signal = snapshot.signals?.[signalKey] || {};
        addSignalIncidents(snapshot, signalKey, signal, incidents);
    });

    const ownerBreakdown = buildOwnerBreakdown(incidents);
    const controlCenter = buildTurneroReleaseControlCenterModel(snapshot);
    const summary = buildSummaryCountsFromBreakdown(ownerBreakdown);
    const summaryText = toText(
        controlCenter.summary,
        decisionReasonFromBreakdown(snapshot, ownerBreakdown)
    );
    const clipboardSummary = toText(
        controlCenter.clipboardSummary,
        [
            'Turnero release control center',
            `Decision: ${controlCenter.decision || 'review'}`,
            `Clinic: ${snapshot.clinicName || 'Sin perfil'} (${snapshot.clinicId || 'sin clinic_id'})`,
            `Profile source: ${snapshot.turneroClinicProfile?.runtime_meta?.source || 'missing'}`,
            `Summary: ${summaryText}`,
            `Incidents: ${incidents.map((item) => item.code).join(', ') || 'none'}`,
        ].join('\n')
    );
    const runbookMarkdown = toText(
        controlCenter.runbookMarkdown,
        [
            '# Turnero Release Control Center',
            '',
            `- Decision: ${controlCenter.decision || 'review'}`,
            `- Clinic: ${escapeMd(snapshot.clinicName)} (${escapeMd(
                snapshot.clinicId || 'sin clinic_id'
            )})`,
        ].join('\n')
    );
    const ownerBreakdownRows = buildOwnerBreakdownRows(ownerBreakdown);
    const decision =
        controlCenter.decision || decisionFromBreakdown(ownerBreakdown);
    const decisionReason =
        controlCenter.decisionReason ||
        decisionReasonFromBreakdown(snapshot, ownerBreakdown);

    return {
        clinicId: snapshot.clinicId,
        clinicName: snapshot.clinicName,
        clinicShortName: snapshot.clinicShortName,
        profileFingerprint: snapshot.profileFingerprint,
        releaseMode: snapshot.releaseMode,
        generatedAt: snapshot.generatedAt,
        decision,
        decisionReason,
        tone:
            controlCenter.tone ||
            (decision === 'hold'
                ? 'alert'
                : decision === 'review'
                  ? 'warning'
                  : 'ready'),
        incidentCount: incidents.length,
        ownerBreakdown,
        ownerBreakdownRows,
        summary,
        summaryText,
        clipboardSummary,
        runbookMarkdown,
        incidents,
        journalEntries: incidents.map((incident) => ({ ...incident })),
        signals: snapshot.signals,
        evidenceSummary: snapshot.evidenceSummary,
        snapshot,
    };
}

export function buildTurneroReleaseConsolePlaybook(input = {}) {
    const playbook = buildTurneroRemediationPlaybook(input);
    return {
        ...playbook,
        ownerBreakdownMap: playbook.ownerBreakdown,
        ownerBreakdown: playbook.ownerBreakdownRows,
        summary: {
            blocker: Number(playbook.summary?.blocker || 0),
            warning: Number(playbook.summary?.warning || 0),
            info: Number(playbook.summary?.info || 0),
            total: Number(
                playbook.summary?.total || playbook.incidentCount || 0
            ),
            score: Number(playbook.summary?.score || 0),
        },
        summaryText: playbook.summaryText || playbook.evidenceSummary || '',
        clipboardSummary: playbook.clipboardSummary || '',
        runbookMarkdown: playbook.runbookMarkdown || '',
        ownerBreakdownRows: playbook.ownerBreakdownRows,
    };
}

export { toReleaseControlCenterSnapshot };
