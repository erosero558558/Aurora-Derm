import { toArray, toText } from './turnero-release-control-center.js';

function workflowStepsForRoute(route) {
    if (route === 'war-room') {
        return [
            'Acknowledge',
            'Assemble owners',
            'Capture evidence',
            'Execute remediation',
            'Update handoff',
        ];
    }

    if (route === 'owner-workbench') {
        return [
            'Assign owner',
            'Plan action',
            'Run validation',
            'Publish status',
        ];
    }

    if (route === 'backlog') {
        return ['Create item', 'Size effort', 'Prioritize sprint', 'Recheck'];
    }

    return ['Monitor signal', 'Keep evidence fresh'];
}

export function buildTurneroReleaseWorkflowOrchestrator(input = {}) {
    const routes = toArray(input.routes).filter(
        (route) => route && typeof route === 'object'
    );

    const rows = routes.map((route, index) => ({
        id: `workflow-${index + 1}`,
        signalId: toText(route.signalId, ''),
        owner: toText(route.owner, 'ops'),
        lane: toText(route.lane, 'observe'),
        route: toText(route.route, 'monitor'),
        steps: workflowStepsForRoute(toText(route.route, 'monitor')),
    }));

    return {
        rows,
        generatedAt: input.generatedAt || new Date().toISOString(),
    };
}
