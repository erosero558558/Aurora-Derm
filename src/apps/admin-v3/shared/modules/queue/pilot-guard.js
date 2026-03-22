import {
    getTurneroActiveClinicProfile,
    getTurneroSurfaceContract,
} from '../../../../queue-shared/turnero-runtime-contract.mjs';
import { getState } from '../../core/store.js';
import { createToast } from '../../ui/render.js';

const ADMIN_DEFAULT_ROUTE = '/admin.html#queue';

const ADMIN_QUEUE_READ_ONLY_ACTIONS = new Set([
    'queue-refresh-state',
    'queue-toggle-shortcuts',
    'queue-toggle-ticket-select',
    'queue-select-visible',
    'queue-clear-selection',
    'queue-clear-search',
    'queue-open-quick-tray',
    'queue-reset-tray-context',
    'queue-sensitive-cancel',
    'queue-copy-install-link',
]);

function isAdminBodyContext() {
    return Boolean(document.body?.classList?.contains('admin-body'));
}

function getCurrentAdminRoute() {
    if (typeof window === 'undefined' || !window.location) {
        return '';
    }
    return `${window.location.pathname || ''}${window.location.hash || ''}`;
}

function hasAdminPilotContext() {
    const state = getState();
    return Boolean(
        state.data.turneroClinicProfile ||
            state.data.turneroClinicProfileMeta ||
            state.data.turneroClinicProfileCatalogStatus
    );
}

export function getAdminQueuePilotSurfaceContract() {
    if (!isAdminBodyContext()) {
        return null;
    }

    if (!hasAdminPilotContext()) {
        return null;
    }

    const state = getState();
    const profile = getTurneroActiveClinicProfile(state);

    return getTurneroSurfaceContract(profile, 'admin', {
        currentRoute: getCurrentAdminRoute(),
    });
}

export function isAdminQueuePilotBlocked() {
    return getAdminQueuePilotSurfaceContract()?.state === 'alert';
}

export function shouldBlockAdminQueueAction(action) {
    const normalizedAction = String(action || '').trim();
    if (!isAdminBodyContext() || !normalizedAction.startsWith('queue-')) {
        return false;
    }
    if (ADMIN_QUEUE_READ_ONLY_ACTIONS.has(normalizedAction)) {
        return false;
    }
    return isAdminQueuePilotBlocked();
}

export function getAdminQueuePilotBlockedMessage() {
    const surfaceContract = getAdminQueuePilotSurfaceContract();
    if (!surfaceContract || surfaceContract.state !== 'alert') {
        return '';
    }

    if (surfaceContract.reason === 'route_mismatch') {
        return `No se puede operar esta clínica desde admin: la ruta no coincide con el canon del piloto (${surfaceContract.expectedRoute || ADMIN_DEFAULT_ROUTE}). Corrige el acceso antes de operar la cola.`;
    }

    if (surfaceContract.reason === 'disabled') {
        return `No se puede operar esta clínica desde admin: ${surfaceContract.detail}`;
    }

    return 'No se puede operar esta clínica desde admin: clinic-profile.json remoto ausente o inválido. Corrige el perfil y recarga admin.html#queue antes de operar la cola.';
}

export function notifyAdminQueuePilotBlocked(_action) {
    const message = getAdminQueuePilotBlockedMessage();
    if (!message) {
        return '';
    }

    createToast(message, 'error');
    return message;
}
