import { buildQueueOpsPilotModel } from './pilot/model.js';
import { renderQueueOpsPilotView } from './pilot/render.js';

export function buildQueueOpsPilot(manifest, detectedPlatform, deps) {
    return buildQueueOpsPilotModel(manifest, detectedPlatform, deps);
}

export function renderQueueOpsPilot(manifest, detectedPlatform, deps) {
    return renderQueueOpsPilotView(manifest, detectedPlatform, deps);
}
