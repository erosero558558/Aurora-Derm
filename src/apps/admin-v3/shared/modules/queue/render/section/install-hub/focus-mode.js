import { buildQueueFocusModeModel } from './focus-mode/model.js';
import { renderQueueFocusModeView } from './focus-mode/render.js';

export function buildQueueFocusMode(manifest, detectedPlatform, deps) {
    return buildQueueFocusModeModel(manifest, detectedPlatform, deps);
}

export function renderQueueFocusMode(manifest, detectedPlatform, deps) {
    return renderQueueFocusModeView(manifest, detectedPlatform, deps);
}
