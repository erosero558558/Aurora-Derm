import { createToast } from '../../../../../shared/ui/render.js';

async function copyInstallLink(url) {
    const resolved = String(url || '').trim();
    if (!resolved) {
        createToast('No hay enlace de instalación disponible', 'warning');
        return;
    }

    try {
        await navigator.clipboard.writeText(resolved);
        createToast('Enlace copiado', 'success');
    } catch (_error) {
        createToast('No se pudo copiar el enlace', 'error');
    }
}

export async function handleQueueInstallAction(action, element) {
    if (action !== 'queue-copy-install-link') {
        return false;
    }

    await copyInstallLink(String(element.dataset.queueInstallUrl || ''));
    return true;
}
