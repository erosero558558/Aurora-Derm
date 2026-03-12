import { buildQueueOpsAlertsModel } from './alerts/model.js';
import { renderQueueOpsAlertsView } from './alerts/render.js';

export function buildQueueOpsAlerts(manifest, detectedPlatform, deps) {
    return buildQueueOpsAlertsModel(manifest, detectedPlatform, deps);
}

export function renderQueueOpsAlerts(manifest, detectedPlatform, deps) {
    return renderQueueOpsAlertsView(manifest, detectedPlatform, deps);
}
