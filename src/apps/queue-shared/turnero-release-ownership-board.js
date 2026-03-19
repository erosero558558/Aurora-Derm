import {
    buildTurneroRemediationPlaybook,
    toReleaseControlCenterSnapshot,
} from './turnero-remediation-playbook.js';

const OWNER_META = {
    deploy: {
        label: 'Deploy',
        slaBlocker: 'Ahora',
        slaWarning: 'Hoy',
        focus: 'shell público, publish y health visible',
    },
    backend: {
        label: 'Backend',
        slaBlocker: 'Ahora',
        slaWarning: 'Hoy',
        focus: 'health, figo, checks y contratos JSON',
    },
    frontend: {
        label: 'Frontend',
        slaBlocker: 'Ahora',
        slaWarning: 'Hoy',
        focus: 'admin basic, queue surfaces, wiring y UI',
    },
    ops: {
        label: 'Ops',
        slaBlocker: 'Ahora',
        slaWarning: 'Siguiente ventana',
        focus: 'runbook, validación manual y operación por clínica',
    },
    unknown: {
        label: 'Pendiente',
        slaBlocker: 'Ahora',
        slaWarning: 'Hoy',
        focus: 'clasificar owner antes de abrir corte',
    },
};

function asObject(value) {
    return value && typeof value === 'object' ? value : {};
}

function toArray(value) {
    return Array.isArray(value) ? value.filter(Boolean) : [];
}

function uniqueStrings(values) {
    return Array.from(
        new Set(
            toArray(values)
                .map((item) => String(item ?? '').trim())
                .filter(Boolean)
        )
    );
}

function normalizeOwner(value) {
    const owner = String(value || 'unknown')
        .trim()
        .toLowerCase();
    return Object.prototype.hasOwnProperty.call(OWNER_META, owner)
        ? owner
        : 'unknown';
}

function normalizeStateMap(value) {
    const source = asObject(value);
    const next = {};

    Object.keys(OWNER_META).forEach((owner) => {
        const lane = asObject(source[owner]);
        next[owner] = {
            owner,
            acknowledged: Boolean(lane.acknowledged),
            status: ['pending', 'working', 'blocked', 'done'].includes(
                String(lane.status || 'pending')
                    .trim()
                    .toLowerCase()
            )
                ? String(lane.status).trim().toLowerCase()
                : 'pending',
            note: String(lane.note || '').trim(),
            updatedAt: String(
                lane.updatedAt || new Date().toISOString()
            ).trim(),
            updatedBy: String(lane.updatedBy || 'local').trim(),
        };
    });

    return next;
}

function buildLaneBase(owner) {
    const meta = OWNER_META[owner] || OWNER_META.unknown;
    return {
        owner,
        label: meta.label,
        focus: meta.focus,
        incidents: [],
        commands: [],
        docs: [],
        nextChecks: [],
        summary: { blocker: 0, warning: 0, info: 0, score: 0 },
        priority: 'low',
        sla: 'Siguiente ventana',
        acknowledged: false,
        status: 'pending',
        note: '',
        updatedAt: '',
        updatedBy: '',
    };
}

function updateLaneSummary(lane, incident) {
    const severity = incident?.severity || 'info';
    if (severity === 'blocker') {
        lane.summary.blocker += 1;
    } else if (severity === 'warning') {
        lane.summary.warning += 1;
    } else {
        lane.summary.info += 1;
    }

    lane.summary.score +=
        severity === 'blocker' ? 3 : severity === 'warning' ? 2 : 1;
}

function inferPriority(summary, state) {
    if (state?.status === 'blocked' || (summary?.blocker || 0) > 0) {
        return 'high';
    }

    if (state?.status === 'working' || (summary?.warning || 0) > 0) {
        return 'medium';
    }

    return 'low';
}

function inferSla(owner, summary, state) {
    const meta = OWNER_META[owner] || OWNER_META.unknown;
    if (state?.status === 'blocked' || (summary?.blocker || 0) > 0) {
        return meta.slaBlocker;
    }

    if (state?.status === 'working' || (summary?.warning || 0) > 0) {
        return meta.slaWarning;
    }

    return 'Monitor';
}

function applyLaneState(lane, state) {
    const normalizedState = normalizeStateMap({ [lane.owner]: state })[
        lane.owner
    ];
    return {
        ...lane,
        acknowledged: normalizedState.acknowledged,
        status: normalizedState.status,
        note: normalizedState.note,
        updatedAt: normalizedState.updatedAt,
        updatedBy: normalizedState.updatedBy,
    };
}

function sortLanes(left, right) {
    if (right.summary.score !== left.summary.score) {
        return right.summary.score - left.summary.score;
    }

    return String(left.label || left.owner).localeCompare(
        String(right.label || right.owner)
    );
}

export function buildTurneroReleaseOwnershipBoard(snapshot, options = {}) {
    const normalized =
        snapshot && snapshot.parts && snapshot.signals
            ? snapshot
            : toReleaseControlCenterSnapshot(snapshot);
    const playbook = buildTurneroRemediationPlaybook(normalized);
    const ownerState = normalizeStateMap(options.ownerState);
    const lanes = {
        deploy: buildLaneBase('deploy'),
        backend: buildLaneBase('backend'),
        frontend: buildLaneBase('frontend'),
        ops: buildLaneBase('ops'),
        unknown: buildLaneBase('unknown'),
    };

    toArray(playbook?.incidents).forEach((incident) => {
        const owner = normalizeOwner(incident?.owner);
        const lane = lanes[owner] || lanes.unknown;
        lane.incidents.push({
            id: incident?.id || `${owner}-${lane.incidents.length + 1}`,
            title: incident?.title || 'Incidente sin título',
            detail: incident?.detail || '',
            severity: incident?.severity || 'info',
            state: incident?.state || incident?.severity || 'info',
            source: String(incident?.source || '').trim(),
            signalKey: String(incident?.signalKey || '').trim(),
            signalState: String(incident?.signalState || '').trim(),
            why: String(incident?.why || '').trim(),
            note: String(incident?.note || '').trim(),
            nextCheck: String(incident?.nextCheck || '').trim(),
            recommendedCommands: uniqueStrings(incident?.recommendedCommands),
            recommendedDocs: uniqueStrings(incident?.recommendedDocs),
            evidence: asObject(incident?.evidence),
            topIncidentTitles: uniqueStrings(
                incident?.topIncidentTitles || [incident?.title]
            ),
            updatedAt: String(
                incident?.updatedAt ||
                    normalized.generatedAt ||
                    new Date().toISOString()
            ).trim(),
        });
        lane.commands.push(...uniqueStrings(incident?.recommendedCommands));
        lane.docs.push(...uniqueStrings(incident?.recommendedDocs));
        if (incident?.nextCheck) {
            lane.nextChecks.push(String(incident.nextCheck).trim());
        }
        updateLaneSummary(lane, incident);
    });

    const laneList = Object.values(lanes)
        .map((lane) => {
            const state = ownerState[lane.owner];
            const merged = applyLaneState(lane, state);
            return {
                ...merged,
                commands: uniqueStrings(merged.commands),
                docs: uniqueStrings(merged.docs),
                nextChecks: uniqueStrings(merged.nextChecks),
                priority: inferPriority(merged.summary, state),
                sla: inferSla(merged.owner, merged.summary, state),
            };
        })
        .sort(sortLanes);

    const localBlockingCount = laneList.filter(
        (lane) => lane.status === 'blocked'
    ).length;
    const localWorkingCount = laneList.filter(
        (lane) => lane.status === 'working'
    ).length;
    let decision = playbook?.decision || 'review';
    if (
        decision === 'ready' &&
        (localBlockingCount > 0 || localWorkingCount > 0)
    ) {
        decision = 'review';
    }

    const localReason = [];
    if (localBlockingCount > 0) {
        localReason.push(`${localBlockingCount} owner(es) bloqueado(s)`);
    }
    if (localWorkingCount > 0) {
        localReason.push(`${localWorkingCount} owner(es) trabajando`);
    }

    const decisionReason = localReason.length
        ? playbook?.decisionReason
            ? `${playbook.decisionReason} · ${localReason.join(' · ')}`
            : localReason.join(' · ')
        : playbook?.decisionReason || '';

    const clinicProfile = asObject(normalized?.parts?.clinicProfile);
    return {
        clinicId:
            clinicProfile.clinicId ||
            clinicProfile.clinic_id ||
            normalized.clinicId ||
            'default-clinic',
        profileFingerprint:
            clinicProfile.profileFingerprint ||
            clinicProfile.runtime_meta?.profileFingerprint ||
            normalized.profileFingerprint ||
            null,
        clinicName:
            clinicProfile.branding?.name ||
            clinicProfile.branding?.short_name ||
            normalized.clinicName ||
            'Piel en Armonia',
        clinicShortName:
            clinicProfile.branding?.short_name ||
            clinicProfile.branding?.name ||
            normalized.clinicShortName ||
            'Piel en Armonia',
        generatedAt: new Date().toISOString(),
        decision,
        decisionReason,
        laneCount: laneList.length,
        incidentCount:
            playbook?.incidentCount || toArray(playbook?.incidents).length,
        ownerBreakdown: playbook?.ownerBreakdown || {},
        ownerState,
        lanes: laneList,
    };
}

export function buildTurneroOwnerBrief(board, owner, ownerState = null) {
    const normalizedOwner = normalizeOwner(owner);
    const lane =
        toArray(board?.lanes).find((item) => item?.owner === normalizedOwner) ||
        buildLaneBase(normalizedOwner);
    const state = normalizeStateMap({
        [normalizedOwner]: ownerState?.[normalizedOwner],
    })[normalizedOwner];
    const effectiveStatus = lane.status || state.status;
    const effectiveNote = lane.note || state.note;

    return [
        `OWNER BRIEF — ${lane.label}`,
        `Prioridad: ${lane.priority}`,
        `SLA: ${lane.sla}`,
        `Foco: ${lane.focus}`,
        `Estado local: ${effectiveStatus}`,
        `Ack: ${lane.acknowledged || state.acknowledged ? 'sí' : 'no'}`,
        `Nota local: ${effectiveNote || 'sin nota local'}`,
        `Resumen: blocker=${lane.summary.blocker}, warning=${lane.summary.warning}, info=${lane.summary.info}`,
        lane.incidents.length
            ? `Incidentes: ${lane.incidents
                  .map((incident) => `${incident.severity}:${incident.title}`)
                  .join(' | ')}`
            : 'Incidentes: sin incidentes asignados',
        lane.commands.length
            ? `Comandos: ${lane.commands.join(' || ')}`
            : 'Comandos: sin comandos sugeridos',
        lane.nextChecks.length
            ? `Próximo chequeo: ${lane.nextChecks.join(' | ')}`
            : 'Próximo chequeo: monitor',
    ].join('\n');
}

export function buildTurneroOwnershipMarkdown(board) {
    const lanes = toArray(board?.lanes);
    const header = [
        `# Turnero Release War Room — ${String(board?.clinicId || 'default-clinic')}`,
        '',
        `- Fingerprint: ${board?.profileFingerprint || 'sin fingerprint'}`,
        `- Generado: ${board?.generatedAt || new Date().toISOString()}`,
        `- Decisión actual: ${board?.decision || 'review'} — ${
            board?.decisionReason || 'sin motivo'
        }`,
        '',
    ];

    const body = lanes.flatMap((lane, index) => {
        const lines = [
            `## ${index + 1}. ${lane.label}`,
            `- Owner: ${lane.owner}`,
            `- Prioridad: ${lane.priority}`,
            `- SLA: ${lane.sla}`,
            `- Foco: ${lane.focus}`,
            `- Estado local: ${lane.status}`,
            `- Ack: ${lane.acknowledged ? 'sí' : 'no'}`,
            `- Nota local: ${lane.note || 'sin nota local'}`,
            `- Resumen: blocker=${lane.summary.blocker}, warning=${lane.summary.warning}, info=${lane.summary.info}`,
        ];

        if (lane.incidents.length) {
            lines.push('- Incidentes:');
            lane.incidents.forEach((incident) => {
                lines.push(`  - [${incident.severity}] ${incident.title}`);
                if (incident.why) {
                    lines.push(`    - Por qué: ${incident.why}`);
                }
                if (incident.nextCheck) {
                    lines.push(
                        `    - Siguiente chequeo: ${incident.nextCheck}`
                    );
                }
            });
        } else {
            lines.push('- Incidentes: sin incidentes.');
        }

        lines.push(
            lane.commands.length
                ? `- Comandos: ${lane.commands.join(' | ')}`
                : '- Comandos: sin comandos.'
        );
        lines.push(
            lane.docs.length
                ? `- Docs: ${lane.docs.join(' | ')}`
                : '- Docs: sin docs.'
        );
        lines.push('');
        return lines;
    });

    return [...header, ...body].join('\n').trim();
}
