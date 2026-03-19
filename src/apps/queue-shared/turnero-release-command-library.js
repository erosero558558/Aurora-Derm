const DEFAULT_LIBRARY = {
    health: {
        title: 'Health y checks remotos',
        commands: [
            'curl -sS "$BASE_URL/api.php?resource=health" | jq .',
            'curl -sSI "$BASE_URL/api.php?resource=health-diagnostics"',
            'npm run verify:prod',
        ],
    },
    publicSync: {
        title: 'Public sync / shell público',
        commands: [
            'curl -sS "$BASE_URL/api.php?resource=health" | jq .checks.publicSync',
            'curl -sS "$BASE_URL/" | head -c 4000',
            'npm run gate:prod:fast',
        ],
    },
    publicShell: {
        title: 'Drift shell público',
        commands: [
            'curl -sS "$BASE_URL/" | rg "public-v6-shell|gtag|styles.css" -n',
            'npm run check:runtime:artifacts',
            'npm run check:deploy:artifacts',
        ],
    },
    turneroPilot: {
        title: 'Piloto turnero por clínica',
        commands: [
            'curl -sS "$BASE_URL/api.php?resource=health" | jq .checks.turneroPilot',
            'node bin/turnero-clinic-profile.js verify-remote --base-url "$BASE_URL" --json',
            'npm run gate:turnero',
        ],
    },
    figo: {
        title: 'Figo / backend operativo',
        commands: [
            'curl -sS "$BASE_URL/api.php?resource=health" | jq .checks.figo',
            'php tests/test_figo_queue_core.php',
            'php tests/test_queue_service.php',
        ],
    },
    clinicProfile: {
        title: 'Canon por clínica',
        commands: [
            'node bin/turnero-clinic-profile.js validate --id "$CLINIC_ID" --json',
            'node bin/turnero-clinic-profile.js stage --id "$CLINIC_ID" --json',
            'node bin/turnero-clinic-profile.js verify-remote --base-url "$BASE_URL" --json',
        ],
    },
    auth: {
        title: 'Auth helper / OpenClaw',
        commands: [
            'npm run openclaw:auth-preflight -- --json',
            'npm run openclaw:auth:start',
            'scripts/ops/admin/INICIAR-OPENCLAW-AUTH-HELPER.ps1',
        ],
    },
};

function sanitizeToken(value, fallback = 'n/a') {
    if (typeof value !== 'string') return fallback;
    const trimmed = value.trim();
    return trimmed || fallback;
}

function replaceTemplate(value, replacements) {
    return Object.entries(replacements).reduce((acc, [needle, replacement]) => {
        return acc.split(needle).join(replacement);
    }, value);
}

export function inferCommandLibraryKey(incident = {}) {
    const code = String(
        incident.code || incident.kind || incident.category || ''
    ).toLowerCase();
    if (code.includes('publicsync') || code.includes('public_sync'))
        return 'publicSync';
    if (code.includes('publicshell') || code.includes('shell'))
        return 'publicShell';
    if (code.includes('turnero')) return 'turneroPilot';
    if (code.includes('figo')) return 'figo';
    if (code.includes('profile') || code.includes('clinic'))
        return 'clinicProfile';
    if (code.includes('auth')) return 'auth';
    if (code.includes('health')) return 'health';
    return 'health';
}

export function buildCommandLibrarySnapshot({
    incident,
    clinicId,
    clinicName,
    baseUrl,
    owner,
    releaseMode,
    library = DEFAULT_LIBRARY,
} = {}) {
    const libraryKey = inferCommandLibraryKey(incident);
    const preset = library[libraryKey] || library.health;
    const replacements = {
        $BASE_URL: sanitizeToken(baseUrl, 'https://pielarmonia.com'),
        $CLINIC_ID: sanitizeToken(clinicId, 'unknown-clinic'),
        $CLINIC_NAME: sanitizeToken(clinicName, 'unknown clinic'),
        $OWNER: sanitizeToken(owner || incident?.owner, 'unassigned'),
        $RELEASE_MODE: sanitizeToken(releaseMode, 'unknown'),
    };

    const commands = (preset.commands || []).map((entry) =>
        replaceTemplate(entry, replacements)
    );

    return {
        libraryKey,
        title: preset.title,
        owner: sanitizeToken(owner || incident?.owner, 'unassigned'),
        commands,
        replacements,
    };
}

export function buildCommandPack({
    incidents = [],
    clinicId,
    clinicName,
    baseUrl,
    releaseMode,
} = {}) {
    return incidents.map((incident) => ({
        incidentId: incident.id || incident.code || null,
        severity: incident.severity || 'unknown',
        owner: incident.owner || 'unassigned',
        ...buildCommandLibrarySnapshot({
            incident,
            clinicId,
            clinicName,
            baseUrl,
            owner: incident.owner,
            releaseMode,
        }),
    }));
}
