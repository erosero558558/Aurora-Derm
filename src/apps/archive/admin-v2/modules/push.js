import { setText } from '../ui/render.js';

function resolvePushStatus() {
    const supportsNotifications = 'Notification' in window;
    const supportsServiceWorker = 'serviceWorker' in navigator;
    const supportsPushManager = 'PushManager' in window;

    if (!supportsNotifications) {
        return {
            tone: 'neutral',
            label: 'Push no disponible',
            meta: 'Este navegador no soporta notificaciones.',
        };
    }

    const permission = String(Notification.permission || 'default');

    if (permission === 'granted') {
        return {
            tone: 'success',
            label:
                supportsServiceWorker && supportsPushManager
                    ? 'Push listo'
                    : 'Push parcial',
            meta:
                supportsServiceWorker && supportsPushManager
                    ? 'Permisos concedidos y APIs disponibles.'
                    : 'Permiso otorgado, pero faltan APIs del navegador.',
        };
    }

    if (permission === 'denied') {
        return {
            tone: 'danger',
            label: 'Push bloqueado',
            meta: 'El navegador rechazo permisos de notificacion.',
        };
    }

    return {
        tone: 'warning',
        label: 'Push pendiente',
        meta: 'La sesion aun no concede permisos.',
    };
}

export async function initPushModule() {
    const status = resolvePushStatus();
    const targets = ['pushStatusIndicator', 'dashboardPushStatus'];
    const metaTargets = ['pushStatusMeta', 'dashboardPushMeta'];

    targets.forEach((id) => {
        const node = document.getElementById(id);
        if (!node) return;
        node.setAttribute('data-state', status.tone);
        setText(`#${id}`, status.label);
    });

    metaTargets.forEach((id) => {
        const node = document.getElementById(id);
        if (!node) return;
        setText(`#${id}`, status.meta);
    });
}
