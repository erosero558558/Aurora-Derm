import { buildPlaybookDefinitions as buildPlaybookDefinitionsModel } from './playbook/definitions.js';
import {
    ensureOpsPlaybookState as ensureOpsPlaybookStateStore,
    resetOpsPlaybookMode as resetOpsPlaybookModeStore,
    setOpsPlaybookStep as setOpsPlaybookStepStore,
} from './playbook/state.js';
import {
    buildQueuePlaybookAssistModel,
    buildQueuePlaybookModel,
} from './playbook/model.js';
import {
    buildQueuePlaybookReport as buildQueuePlaybookReportModel,
    copyQueuePlaybookReport as copyQueuePlaybookReportModel,
} from './playbook/report.js';
import { renderQueuePlaybookView } from './playbook/render.js';

export function buildPlaybookDefinitions(manifest, detectedPlatform, deps) {
    return buildPlaybookDefinitionsModel(manifest, detectedPlatform, deps);
}

export function ensureOpsPlaybookState(deps) {
    return ensureOpsPlaybookStateStore(deps);
}

export function setOpsPlaybookStep(mode, stepId, complete, deps) {
    return setOpsPlaybookStepStore(mode, stepId, complete, deps);
}

export function resetOpsPlaybookMode(mode, deps) {
    return resetOpsPlaybookModeStore(mode, deps);
}

export function buildQueuePlaybook(manifest, detectedPlatform, deps) {
    return buildQueuePlaybookModel(manifest, detectedPlatform, deps);
}

export function buildQueuePlaybookAssist(manifest, detectedPlatform, deps) {
    return buildQueuePlaybookAssistModel(manifest, detectedPlatform, deps);
}

export function buildQueuePlaybookReport(manifest, detectedPlatform, deps) {
    return buildQueuePlaybookReportModel(manifest, detectedPlatform, deps);
}

export function copyQueuePlaybookReport(manifest, detectedPlatform, deps) {
    return copyQueuePlaybookReportModel(manifest, detectedPlatform, deps);
}

export function renderQueuePlaybook(manifest, detectedPlatform, deps) {
    return renderQueuePlaybookView(manifest, detectedPlatform, deps);
}
