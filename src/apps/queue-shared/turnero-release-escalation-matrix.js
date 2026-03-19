import {
    buildTurneroOwnerBrief,
    buildTurneroReleaseOwnershipBoard,
} from './turnero-release-ownership-board.js';

const OWNER_KEYS = ['deploy', 'backend', 'frontend', 'ops', 'unknown'];

function asObject(value) {
    return value && typeof value === 'object' ? value : {};
}

function toArray(value) {
    return Array.isArray(value) ? value.filter(Boolean) : [];
}

function normalizeDecision(value) {
    return ['hold', 'review', 'ready'].includes(value) ? value : 'review';
}

function normalizeStateMap(value) {
    const source = asObject(value);
    const next = {};

    OWNER_KEYS.forEach((owner) => {
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

function repeatedIncidentCount(entries, lane) {
    const titles = new Set(
        toArray(lane?.incidents)
            .map((incident) => incident?.title)
            .filter(Boolean)
    );

    if (!titles.size) {
        return 0;
    }

    return toArray(entries).reduce((count, entry) => {
        const matched = toArray(
            entry?.topIncidentTitles ||
                entry?.top_titles ||
                entry?.topTitles || [entry?.title]
        ).some((title) => titles.has(title));
        return matched ? count + 1 : count;
    }, 0);
}

function inferEscalationStage(lane, repeatedCount, decision, state) {
    const status = String(state?.status || lane?.status || 'pending')
        .trim()
        .toLowerCase();
    const blockers = Number(lane?.summary?.blocker || 0);
    const warnings = Number(lane?.summary?.warning || 0);

    if (status === 'blocked') {
        return 'escalate-now';
    }

    if (blockers > 0 && repeatedCount >= 3) {
        return 'escalate-now';
    }

    if (status === 'working' || (blockers > 0 && decision !== 'ready')) {
        return 'active-incident';
    }

    if (status === 'done' && blockers === 0 && warnings === 0) {
        return 'stable';
    }

    if (warnings > 0 || decision !== 'ready') {
        return 'watch';
    }

    return 'stable';
}

function inferEscalationTarget(owner) {
    if (owner === 'deploy') return 'deploy-on-call';
    if (owner === 'backend') return 'backend-owner';
    if (owner === 'frontend') return 'frontend-owner';
    if (owner === 'ops') return 'ops-lead';
    return 'coordinación';
}

function inferNextWindow(stage) {
    if (stage === 'escalate-now') return 'Inmediato';
    if (stage === 'active-incident') return 'Próximos 15 min';
    if (stage === 'watch') return 'Siguiente verificación';
    return 'Monitor';
}

export function buildTurneroReleaseEscalationMatrix(snapshot, options = {}) {
    const board = buildTurneroReleaseOwnershipBoard(snapshot, options);
    const journalEntries = toArray(options.journalEntries);
    const decision = normalizeDecision(options.decision || board.decision);
    const stateMap = normalizeStateMap(options.ownerState || board.ownerState);

    const lanes = toArray(board.lanes).map((lane) => {
        const state = asObject(stateMap[lane.owner]);
        const repeatedCount = repeatedIncidentCount(journalEntries, lane);
        const stage = inferEscalationStage(
            lane,
            repeatedCount,
            decision,
            state
        );

        return {
            owner: lane.owner,
            label: lane.label,
            priority: lane.priority,
            stage,
            escalationTarget: inferEscalationTarget(lane.owner),
            nextWindow: inferNextWindow(stage),
            repeatedCount,
            acknowledged: Boolean(state.acknowledged || lane.acknowledged),
            laneStatus: state.status || lane.status || 'pending',
            note: state.note || lane.note || '',
            updatedAt: state.updatedAt || lane.updatedAt || '',
            summary: lane.summary,
            ownerBrief: buildTurneroOwnerBrief(board, lane.owner, stateMap),
            commands: lane.commands,
            docs: lane.docs,
            incidents: lane.incidents,
        };
    });

    const summary = lanes.reduce(
        (acc, lane) => {
            acc.total += 1;
            if (lane.stage === 'escalate-now') acc.escalateNow += 1;
            if (lane.stage === 'active-incident') acc.active += 1;
            if (lane.stage === 'watch') acc.watch += 1;
            if (lane.stage === 'stable') acc.stable += 1;
            if (lane.acknowledged) acc.acknowledged += 1;
            return acc;
        },
        {
            total: 0,
            escalateNow: 0,
            active: 0,
            watch: 0,
            stable: 0,
            acknowledged: 0,
        }
    );

    return {
        clinicId: board.clinicId,
        profileFingerprint: board.profileFingerprint,
        generatedAt: new Date().toISOString(),
        decision,
        summary,
        lanes,
    };
}
