function buildAppModeChip(latest) {
    const appMode = String(latest.appMode || '').trim();
    if (appMode === 'desktop') return 'Desktop';
    if (appMode === 'android_tv') return 'Android TV';
    return 'Web';
}

function buildOperatorChips(details) {
    const chips = [];
    const station = String(details.station || '').toUpperCase();
    const stationMode = String(details.stationMode || '');

    if (station) {
        chips.push(
            stationMode === 'locked' ? `${station} fijo` : `${station} libre`
        );
    }
    chips.push(details.oneTap ? '1 tecla ON' : '1 tecla OFF');
    chips.push(details.numpadSeen ? 'Numpad listo' : 'Numpad pendiente');
    return chips;
}

function buildKioskChips(details) {
    return [
        details.printerPrinted ? 'Térmica OK' : 'Térmica pendiente',
        `Offline ${Number(details.pendingOffline || 0)}`,
        String(details.connection || '').toLowerCase() === 'live'
            ? 'Cola en vivo'
            : 'Cola degradada',
    ];
}

function buildDisplayChips(details) {
    return [
        details.bellPrimed ? 'Audio listo' : 'Audio pendiente',
        details.bellMuted ? 'Campanilla Off' : 'Campanilla On',
        String(details.connection || '').toLowerCase() === 'live'
            ? 'Sala en vivo'
            : 'Sala degradada',
    ];
}

export function buildSurfaceTelemetryChips(surfaceKey, latest) {
    if (!latest || typeof latest !== 'object') return ['Sin señal'];

    const details =
        latest.details && typeof latest.details === 'object'
            ? latest.details
            : {};
    const chips = [buildAppModeChip(latest)];

    if (surfaceKey === 'operator') {
        chips.push(...buildOperatorChips(details));
    } else if (surfaceKey === 'kiosk') {
        chips.push(...buildKioskChips(details));
    } else if (surfaceKey === 'display') {
        chips.push(...buildDisplayChips(details));
    }

    return chips.slice(0, 4);
}
