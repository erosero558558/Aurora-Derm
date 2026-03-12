export const DESKTOP_HEARTBEAT_INTERVAL_MS = 15000;

const HEARTBEAT_WARNING_PHASES = new Set([
    'boot',
    'loading',
    'settings',
    'update',
]);
const HEARTBEAT_ALERT_PHASES = new Set(['retry', 'blocked']);

function normalizeSurface(surface) {
    const normalized = String(surface || 'operator')
        .trim()
        .toLowerCase();
    return normalized === 'kiosk' ? 'kiosk' : 'operator';
}

function getHeartbeatPhase(snapshot) {
    return String(snapshot?.status?.phase || snapshot?.phase || 'boot')
        .trim()
        .toLowerCase();
}

function getOperatorStation(config) {
    return Number(config?.stationConsultorio || 1) === 2 ? 'c2' : 'c1';
}

function getOperatorInstance(config) {
    return String(config?.stationMode || 'free')
        .trim()
        .toLowerCase() === 'locked'
        ? getOperatorStation(config)
        : 'free';
}

function getOperatorDeviceLabel(config) {
    const station = getOperatorStation(config);
    const locked =
        String(config?.stationMode || 'free')
            .trim()
            .toLowerCase() === 'locked';
    return locked
        ? `Operador ${station.toUpperCase()} fijo`
        : 'Operador modo libre';
}

function getSurfaceDeviceLabel(surface, config) {
    if (surface === 'kiosk') {
        return 'Kiosco local';
    }
    return getOperatorDeviceLabel(config);
}

function getHeartbeatInstance(surface, config) {
    if (surface === 'kiosk') {
        return 'main';
    }
    return getOperatorInstance(config);
}

function buildDefaultSummary(surface, snapshot, phase) {
    const config = snapshot?.config || {};
    if (surface === 'kiosk') {
        if (snapshot?.firstRun) {
            return 'Kiosco en primer arranque; confirma la configuración local antes de abrir la superficie.';
        }
        if (snapshot?.settingsMode || phase === 'settings') {
            return 'Configuración local del kiosco abierta desde la desktop.';
        }
        if (phase === 'retry') {
            return 'Kiosco reintentando conexión desde el shell local.';
        }
        if (phase === 'loading') {
            return 'Kiosco conectando la superficie remota desde la desktop.';
        }
        if (phase === 'blocked') {
            return 'El shell del kiosco bloqueó una navegación no permitida.';
        }
        return 'Kiosco reportando desde el boot local de la desktop.';
    }

    const station = getOperatorStation(config).toUpperCase();
    const locked =
        String(config?.stationMode || 'free')
            .trim()
            .toLowerCase() === 'locked';
    const profileLabel = locked ? `${station} fijo` : 'modo libre';
    if (snapshot?.firstRun) {
        return `Primer arranque de ${profileLabel}; confirma la configuración local antes de abrir Operador.`;
    }
    if (snapshot?.settingsMode || phase === 'settings') {
        return `Configuración local abierta en ${profileLabel}.`;
    }
    if (phase === 'retry') {
        return `Operador reintentando conexión en ${profileLabel}.`;
    }
    if (phase === 'loading') {
        return `Operador conectando la superficie remota en ${profileLabel}.`;
    }
    if (phase === 'blocked') {
        return `El shell desktop bloqueó una navegación no permitida mientras ${profileLabel} seguía abierto.`;
    }
    return `Desktop local reportando ${profileLabel} mientras la superficie remota no está visible.`;
}

function buildNetworkOnline(phase) {
    return !HEARTBEAT_ALERT_PHASES.has(phase);
}

export function shouldRunDesktopHeartbeat(snapshot) {
    const surface = normalizeSurface(snapshot?.config?.surface);
    if (surface !== 'operator') {
        return false;
    }

    if (!snapshot || typeof snapshot !== 'object') {
        return false;
    }

    const phase = getHeartbeatPhase(snapshot);
    return (
        snapshot.firstRun === true ||
        snapshot.settingsMode === true ||
        HEARTBEAT_WARNING_PHASES.has(phase) ||
        HEARTBEAT_ALERT_PHASES.has(phase)
    );
}

export function buildDesktopHeartbeatEndpoint(snapshot) {
    try {
        return new URL(
            '/api.php?resource=queue-surface-heartbeat',
            String(snapshot?.config?.baseUrl || '')
        ).toString();
    } catch (_error) {
        return '';
    }
}

export function buildDesktopHeartbeatPayload(
    snapshot,
    { reason = 'desktop_boot', now = new Date().toISOString() } = {}
) {
    if (!shouldRunDesktopHeartbeat(snapshot)) {
        return null;
    }

    const config = snapshot?.config || {};
    const surface = normalizeSurface(config.surface);
    const phase = getHeartbeatPhase(snapshot);
    const summary =
        String(snapshot?.status?.message || snapshot?.message || '').trim() ||
        buildDefaultSummary(surface, snapshot, phase);
    const updateChannel = String(config.updateChannel || 'stable').trim();
    const station = surface === 'operator' ? getOperatorStation(config) : 'c1';
    const locked =
        String(config.stationMode || 'free')
            .trim()
            .toLowerCase() === 'locked';

    return {
        surface,
        deviceId: `${surface}-desktop-shell`,
        instance: getHeartbeatInstance(surface, config),
        deviceLabel: getSurfaceDeviceLabel(surface, config),
        appMode: 'desktop',
        route: String(snapshot?.surfaceUrl || '').trim(),
        status: HEARTBEAT_ALERT_PHASES.has(phase) ? 'alert' : 'warning',
        summary,
        networkOnline: buildNetworkOnline(phase),
        lastEvent: String(reason || 'desktop_boot'),
        lastEventAt: String(now || new Date().toISOString()),
        details: {
            station,
            stationMode: locked ? 'locked' : 'free',
            oneTap: Boolean(config.oneTap),
            callKeyLabel: 'Numpad Enter',
            numpadSeen: false,
            numpadReady: false,
            numpadProgress: 0,
            numpadRequired: 4,
            numpadLabel: 'Validar en operador',
            numpadSummary:
                'La matriz del numpad se valida dentro de operador-turnos.html',
            shellContext: 'boot',
            shellPhase: phase,
            shellSettingsMode: Boolean(snapshot?.settingsMode),
            shellFirstRun: Boolean(snapshot?.firstRun),
            shellStatusLevel: String(snapshot?.status?.level || ''),
            shellMessage: summary,
            shellPackaged: Boolean(snapshot?.packaged),
            shellPlatform: String(snapshot?.platform || ''),
            shellUpdateChannel: updateChannel,
            shellUpdateFeedUrl: String(snapshot?.updateFeedUrl || ''),
            shellVersion: String(snapshot?.version || ''),
            shellName: String(snapshot?.name || ''),
        },
    };
}
