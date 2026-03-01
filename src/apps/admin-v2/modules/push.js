import { setText } from '../ui/render.js';

export async function initPushModule() {
    const statusEl = document.getElementById('pushStatusIndicator');
    if (statusEl) {
        setText('#pushStatusIndicator', 'Push no configurado');
    }
}
