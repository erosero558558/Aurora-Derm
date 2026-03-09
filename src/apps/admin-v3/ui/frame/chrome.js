import { SECTION_CONTEXT } from './config.js';
import { qs, setHtml, setText } from '../../shared/ui/render.js';
import { contextActionItem } from './templates.js';

function countPendingTransfers(appointments) {
    return appointments.filter((item) => {
        const status = String(
            item.paymentStatus || item.payment_status || ''
        ).toLowerCase();
        return (
            status === 'pending_transfer_review' ||
            status === 'pending_transfer'
        );
    }).length;
}

function countPendingCallbacks(callbacks) {
    return callbacks.filter((item) => {
        const status = String(item.status || '')
            .toLowerCase()
            .trim();
        return status === 'pending' || status === 'pendiente';
    }).length;
}

function countAvailabilityDays(availability) {
    return Object.values(availability || {}).filter(
        (slots) => Array.isArray(slots) && slots.length > 0
    ).length;
}

function countWaitingTickets(queueTickets, queueMeta) {
    if (queueMeta && Number.isFinite(Number(queueMeta.waitingCount))) {
        return Math.max(0, Number(queueMeta.waitingCount));
    }

    return (Array.isArray(queueTickets) ? queueTickets : []).filter(
        (ticket) => String(ticket.status || '').toLowerCase() === 'waiting'
    ).length;
}

function formatSyncMeta(lastRefreshAt) {
    const ts = Number(lastRefreshAt || 0);
    if (!ts) return 'Listo para primera sincronizacion';

    return `Ultima carga ${new Date(ts).toLocaleTimeString('es-EC', {
        hour: '2-digit',
        minute: '2-digit',
    })}`;
}

function formatAuthMeta(auth) {
    const authState = auth && typeof auth === 'object' ? auth : {};

    if (authState.authenticated) {
        const methodMap = {
            session: 'sesion restaurada',
            password: 'clave validada',
            '2fa': '2FA validado',
        };
        const authMethod =
            methodMap[String(authState.authMethod || '')] || 'acceso validado';
        const validatedAt = Number(authState.lastAuthAt || 0);

        if (!validatedAt) {
            return `Protegida por ${authMethod}.`;
        }

        return `Protegida por ${authMethod}. ${new Date(
            validatedAt
        ).toLocaleTimeString('es-EC', {
            hour: '2-digit',
            minute: '2-digit',
        })}`;
    }

    if (authState.requires2FA) {
        return 'Esperando codigo de seis digitos para completar el acceso.';
    }

    return 'Autenticate para operar el panel.';
}

export function renderAdminChrome(state) {
    const section = state?.ui?.activeSection || 'dashboard';
    const config = SECTION_CONTEXT[section] || SECTION_CONTEXT.dashboard;
    const auth =
        state?.auth && typeof state.auth === 'object' ? state.auth : {};
    const appointments = Array.isArray(state?.data?.appointments)
        ? state.data.appointments
        : [];
    const callbacks = Array.isArray(state?.data?.callbacks)
        ? state.data.callbacks
        : [];
    const reviews = Array.isArray(state?.data?.reviews)
        ? state.data.reviews
        : [];
    const availability =
        state?.data?.availability && typeof state.data.availability === 'object'
            ? state.data.availability
            : {};
    const queueTickets = Array.isArray(state?.data?.queueTickets)
        ? state.data.queueTickets
        : [];
    const queueMeta =
        state?.data?.queueMeta && typeof state.data.queueMeta === 'object'
            ? state.data.queueMeta
            : null;

    setText('#adminSectionEyebrow', config.eyebrow);
    setText('#adminContextTitle', config.title);
    setText('#adminContextSummary', config.summary);
    setHtml(
        '#adminContextActions',
        config.actions.map((action) => contextActionItem(action)).join('')
    );
    setText('#adminSyncState', formatSyncMeta(state?.ui?.lastRefreshAt || 0));

    const pendingTransfers = countPendingTransfers(appointments);
    const pendingCallbacks = countPendingCallbacks(callbacks);
    const availabilityDays = countAvailabilityDays(availability);
    const waitingTickets = countWaitingTickets(queueTickets, queueMeta);
    const dashboardAlerts = pendingTransfers + pendingCallbacks;

    setText('#dashboardBadge', dashboardAlerts);
    setText('#appointmentsBadge', appointments.length);
    setText('#callbacksBadge', pendingCallbacks);
    setText('#reviewsBadge', reviews.length);
    setText('#availabilityBadge', availabilityDays);
    setText('#queueBadge', waitingTickets);

    const sessionTile = qs('#adminSessionTile');
    const sessionLabel = auth.authenticated
        ? 'Sesion activa'
        : auth.requires2FA
          ? 'Verificacion 2FA'
          : 'No autenticada';
    const sessionTone = auth.authenticated
        ? 'success'
        : auth.requires2FA
          ? 'warning'
          : 'neutral';

    sessionTile?.setAttribute('data-state', sessionTone);
    setText('#adminSessionState', sessionLabel);
    setText('#adminSessionMeta', formatAuthMeta(auth));
}
