const SURFACE_DEFAULTS = Object.freeze({
    'operator-turnos': {
        surfaceLabel: 'Turnero Operador',
        runtimeState: 'ready',
        truth: 'watch',
        primaryOwner: 'ops-lead',
        backupOwner: 'backup-ops',
        playbookState: 'ready',
        supportChannel: 'whatsapp',
        handoverMode: 'guided',
    },
    'kiosco-turnos': {
        surfaceLabel: 'Turnero Kiosco',
        runtimeState: 'ready',
        truth: 'watch',
        primaryOwner: '',
        backupOwner: '',
        playbookState: 'missing',
        supportChannel: '',
        handoverMode: 'manual',
    },
    'sala-turnos': {
        surfaceLabel: 'Turnero Sala TV',
        runtimeState: 'ready',
        truth: 'aligned',
        primaryOwner: 'ops-display',
        backupOwner: 'backup-display',
        playbookState: 'ready',
        supportChannel: 'chat',
        handoverMode: 'broadcast',
    },
});

function normalizeText(value, fallback = '') {
    const normalized = String(value ?? '').trim();
    return normalized || fallback;
}

function normalizeState(value, fallback = 'unknown') {
    const normalized = String(value ?? '')
        .trim()
        .toLowerCase();
    return normalized || fallback;
}

function normalizeSurfaceKey(value) {
    const normalized = normalizeText(value, 'surface')
        .toLowerCase()
        .replace(/\s+/g, '-');

    if (!normalized) {
        return 'surface';
    }
    if (normalized.includes('operator')) {
        return 'operator-turnos';
    }
    if (normalized.includes('kiosk') || normalized.includes('kiosco')) {
        return 'kiosco-turnos';
    }
    if (normalized.includes('display') || normalized.includes('sala')) {
        return 'sala-turnos';
    }
    return normalized;
}

function getClinicLabel(clinicProfile = {}) {
    return normalizeText(
        clinicProfile?.branding?.name ||
            clinicProfile?.branding?.short_name ||
            clinicProfile?.label ||
            clinicProfile?.name ||
            '',
        ''
    );
}

function getClinicSurfaceLabel(surfaceKey, clinicProfile = {}) {
    if (surfaceKey === 'operator-turnos') {
        return normalizeText(
            clinicProfile?.surfaces?.operator?.label ||
                clinicProfile?.surfaces?.operator?.name ||
                SURFACE_DEFAULTS[surfaceKey]?.surfaceLabel,
            surfaceKey
        );
    }
    if (surfaceKey === 'kiosco-turnos') {
        return normalizeText(
            clinicProfile?.surfaces?.kiosk?.label ||
                clinicProfile?.surfaces?.kiosk?.name ||
                SURFACE_DEFAULTS[surfaceKey]?.surfaceLabel,
            surfaceKey
        );
    }
    if (surfaceKey === 'sala-turnos') {
        return normalizeText(
            clinicProfile?.surfaces?.display?.label ||
                clinicProfile?.surfaces?.display?.name ||
                SURFACE_DEFAULTS[surfaceKey]?.surfaceLabel,
            surfaceKey
        );
    }

    return normalizeText(
        clinicProfile?.surfaces?.[surfaceKey]?.label ||
            clinicProfile?.surfaces?.[surfaceKey]?.name ||
            surfaceKey,
        surfaceKey
    );
}

export function resolveTurneroSurfaceServiceHandoverDefaults(
    surfaceKey,
    clinicProfile = {}
) {
    const normalizedSurfaceKey = normalizeSurfaceKey(surfaceKey);
    const defaults = SURFACE_DEFAULTS[normalizedSurfaceKey] || {};
    const regionScope = normalizeText(
        clinicProfile?.region ||
            clinicProfile?.branding?.city ||
            clinicProfile?.scope ||
            '',
        ''
    );

    return {
        surfaceKey: normalizedSurfaceKey,
        surfaceLabel: getClinicSurfaceLabel(normalizedSurfaceKey, clinicProfile),
        scope: regionScope || 'regional',
        runtimeState: defaults.runtimeState || 'unknown',
        truth: defaults.truth || 'unknown',
        primaryOwner: defaults.primaryOwner || '',
        backupOwner: defaults.backupOwner || '',
        playbookState: defaults.playbookState || 'missing',
        supportChannel: defaults.supportChannel || '',
        handoverMode: defaults.handoverMode || 'manual',
    };
}

export function buildTurneroSurfaceServiceHandoverSnapshot(input = {}) {
    const clinicProfile =
        input.clinicProfile && typeof input.clinicProfile === 'object'
            ? input.clinicProfile
            : {};
    const surfaceKey = normalizeSurfaceKey(input.surfaceKey);
    const defaults = resolveTurneroSurfaceServiceHandoverDefaults(
        surfaceKey,
        clinicProfile
    );
    const clinicId = normalizeText(
        input.clinicId ||
            clinicProfile?.clinic_id ||
            clinicProfile?.clinicId ||
            clinicProfile?.id,
        ''
    );

    return {
        scope: normalizeText(
            input.scope,
            defaults.scope || clinicId || surfaceKey || 'global'
        ),
        surfaceKey,
        surfaceLabel: normalizeText(
            input.surfaceLabel,
            defaults.surfaceLabel || surfaceKey
        ),
        clinicId,
        clinicLabel: normalizeText(
            input.clinicLabel || getClinicLabel(clinicProfile) || clinicId,
            ''
        ),
        runtimeState: normalizeState(
            input.runtimeState,
            defaults.runtimeState || 'unknown'
        ),
        truth: normalizeState(input.truth, defaults.truth || 'unknown'),
        primaryOwner: normalizeText(
            input.primaryOwner,
            defaults.primaryOwner || ''
        ),
        backupOwner: normalizeText(
            input.backupOwner,
            defaults.backupOwner || ''
        ),
        playbookState: normalizeState(
            input.playbookState,
            defaults.playbookState || 'missing'
        ),
        supportChannel: normalizeText(
            input.supportChannel,
            defaults.supportChannel || ''
        ),
        handoverMode: normalizeState(
            input.handoverMode,
            defaults.handoverMode || 'manual'
        ),
        updatedAt: normalizeText(
            input.updatedAt,
            new Date().toISOString()
        ),
    };
}
