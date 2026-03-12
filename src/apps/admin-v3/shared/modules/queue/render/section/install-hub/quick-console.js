import { buildQueueQuickConsoleModel } from './quick-console/model.js';
import { renderQueueQuickConsoleView } from './quick-console/render.js';

export function buildQueueQuickConsole(manifest, detectedPlatform, deps) {
    return buildQueueQuickConsoleModel(manifest, detectedPlatform, deps);
}

export function renderQueueQuickConsole(manifest, detectedPlatform, deps) {
    return renderQueueQuickConsoleView(manifest, detectedPlatform, deps);
}
