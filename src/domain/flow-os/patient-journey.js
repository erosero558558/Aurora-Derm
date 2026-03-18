'use strict';

const { loadFlowOsManifest } = require('./load-manifest.js');

const manifest = loadFlowOsManifest();
const stageMap = new Map(
    manifest.journeyStages.map((stage) => [stage.id, stage])
);

function getJourneyStage(stageId) {
    const normalized = String(stageId || '').trim();
    return stageMap.get(normalized) || null;
}

function listJourneyStages() {
    return manifest.journeyStages.slice();
}

function resolveNextActions(stageId, context = {}) {
    const stage = getJourneyStage(stageId);
    if (!stage) {
        return [];
    }

    const baseActions = Array.isArray(manifest.defaultActions?.[stage.id])
        ? manifest.defaultActions[stage.id]
        : [];

    const actions = baseActions.map((actionId) => ({
        id: actionId,
        actor: stage.owner,
        stage: stage.id,
    }));

    if (context.redFlagDetected === true) {
        return [
            {
                id: 'manual_review_required',
                actor: 'clinician',
                stage: stage.id,
                priority: 'critical',
            },
        ];
    }

    if (context.missingIdentity === true) {
        return [
            {
                id: 'request_identity_completion',
                actor: 'frontdesk',
                stage: stage.id,
                priority: 'high',
            },
        ];
    }

    return actions;
}

function canTransition(fromStageId, toStageId) {
    const fromStage = getJourneyStage(fromStageId);
    if (!fromStage) return false;
    return Array.isArray(fromStage.next) && fromStage.next.includes(toStageId);
}

function buildDelegationPlan(stageId, context = {}) {
    const stage = getJourneyStage(stageId);
    if (!stage) {
        return [];
    }

    switch (stage.id) {
        case 'intake_completed':
            return [
                {
                    worker: 'intake-triage-worker',
                    goal: 'summarize_intake_and_priority',
                    model: 'gpt-5.4-mini',
                },
            ];
        case 'scheduled':
            return [
                {
                    worker: 'appointment-worker',
                    goal: 'confirm_appointment_and_prepare_chart',
                    model: 'gpt-5.4-mini',
                },
            ];
        case 'care_plan_ready':
            return [
                {
                    worker: 'followup-worker',
                    goal: 'open_followup_loop',
                    model: 'gpt-5.4-mini',
                },
                {
                    worker: 'documentation-worker',
                    goal: 'package_care_plan_summary',
                    model: 'gpt-5.4-mini',
                },
            ];
        case 'follow_up_active':
            return [
                {
                    worker: 'followup-worker',
                    goal: context.missedFollowup
                        ? 'recover_lost_followup'
                        : 'request_progress_update',
                    model: 'gpt-5.4-mini',
                },
            ];
        default:
            return [];
    }
}

function summarizeJourney(stageId, context = {}) {
    const stage = getJourneyStage(stageId);
    if (!stage) {
        throw new Error(`Stage desconocido: ${stageId}`);
    }

    return {
        stage: stage.id,
        label: stage.label,
        owner: stage.owner,
        next: Array.isArray(stage.next) ? stage.next.slice() : [],
        actions: resolveNextActions(stageId, context),
        delegation: buildDelegationPlan(stageId, context),
    };
}

module.exports = {
    buildDelegationPlan,
    canTransition,
    getJourneyStage,
    listJourneyStages,
    resolveNextActions,
    summarizeJourney,
};
