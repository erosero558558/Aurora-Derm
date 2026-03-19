import {
    buildCommandLibrarySnapshot,
    inferCommandLibraryKey,
} from './turnero-release-command-library.js';

const PLAYBOOK_PRESETS = {
    health: {
        now: ['Confirmar payload de /health y capturar snapshot crudo.'],
        next: ['Verificar presencia de checks requeridos para el corte.'],
        verify: [
            'Comparar clinicId, fingerprint y releaseMode contra el canon local.',
        ],
        escalate: [
            'Escalar a backend/ops si /health no publica el shape esperado.',
        ],
    },
    publicSync: {
        now: ['Inspeccionar checks.publicSync y su estado de verificación.'],
        next: ['Comparar shell público y publicación efectiva del corte.'],
        verify: ['Confirmar que publicSync quede verified y sin drift.'],
        escalate: ['Escalar a deploy/front si el sync queda stale o ausente.'],
    },
    publicShell: {
        now: [
            'Leer HTML raíz y detectar shell, stylesheet e inline script activo.',
        ],
        next: ['Comparar needles del shell activo frente al corte esperado.'],
        verify: [
            'Confirmar ausencia de drift y presencia de marcadores requeridos.',
        ],
        escalate: [
            'Escalar a front/deploy si hay shell mismatch o assets inesperados.',
        ],
    },
    turneroPilot: {
        now: ['Verificar checks.turneroPilot y el clinic profile activo.'],
        next: ['Contrastar surfaces readiness y opening package por clínica.'],
        verify: ['Confirmar que operator/kiosk/display/admin estén alineados.'],
        escalate: ['Escalar a queue runtime si el piloto queda blocked.'],
    },
    figo: {
        now: ['Revisar señales de figo/queue service y degradación backend.'],
        next: [
            'Correlacionar incidentes de figo con pasos del piloto por clínica.',
        ],
        verify: [
            'Confirmar recuperación del servicio y limpiar bloqueo operativo.',
        ],
        escalate: [
            'Escalar a backend si el servicio sigue degraded o unreachable.',
        ],
    },
    clinicProfile: {
        now: ['Validar clinicId, source, releaseMode y profileFingerprint.'],
        next: ['Reforzar canon por clínica y revisar fallback/source drift.'],
        verify: [
            'Confirmar que todas las superficies consuman el mismo profile.',
        ],
        escalate: ['Escalar a queue/front si source canonico no está activo.'],
    },
    auth: {
        now: ['Comprobar helper local y preflight del runtime de auth.'],
        next: ['Verificar continuidad de sesión y rutas del admin.'],
        verify: ['Confirmar que el puente auth no bloquee la operación.'],
        escalate: [
            'Escalar a auth/internal console si hay bloqueo persistente.',
        ],
    },
};

function listify(value) {
    if (Array.isArray(value)) return value.filter(Boolean);
    if (typeof value === 'string' && value.trim()) return [value.trim()];
    return [];
}

function toSentence(value, fallback) {
    if (typeof value === 'string' && value.trim()) return value.trim();
    return fallback;
}

export function normalizeWorkbenchIncident(raw = {}, index = 0) {
    const id = raw.id || raw.code || `incident-${index + 1}`;
    const code = raw.code || raw.kind || raw.category || id;
    const severity = raw.severity || raw.level || 'warning';
    const owner = raw.owner || raw.assignee || inferOwnerFromCode(code);
    const title = raw.title || raw.summary || humanizeCode(code);
    const status = raw.status || raw.state || 'open';
    const blockers = listify(raw.blockers || raw.issues || raw.findings);
    const notes = listify(raw.notes || raw.details);

    return {
        ...raw,
        id,
        code,
        severity,
        owner,
        title,
        status,
        blockers,
        notes,
    };
}

export function inferOwnerFromCode(code = '') {
    const token = String(code).toLowerCase();
    if (token.includes('figo') || token.includes('health')) return 'backend';
    if (
        token.includes('shell') ||
        token.includes('public') ||
        token.includes('sync')
    )
        return 'front-deploy';
    if (
        token.includes('profile') ||
        token.includes('turnero') ||
        token.includes('queue')
    )
        return 'queue-runtime';
    if (token.includes('auth')) return 'auth';
    return 'ops';
}

export function humanizeCode(code = '') {
    return (
        String(code)
            .replace(/[_-]+/g, ' ')
            .replace(/\b\w/g, (letter) => letter.toUpperCase()) || 'Incident'
    );
}

export function buildIncidentPlaybook(incident, context = {}) {
    const normalized = normalizeWorkbenchIncident(incident);
    const presetKey = inferCommandLibraryKey(normalized);
    const preset = PLAYBOOK_PRESETS[presetKey] || PLAYBOOK_PRESETS.health;
    const commands = buildCommandLibrarySnapshot({
        incident: normalized,
        clinicId: context.clinicId,
        clinicName: context.clinicName,
        baseUrl: context.baseUrl,
        owner: normalized.owner,
        releaseMode: context.releaseMode,
    });

    const impact = toSentence(
        normalized.impact,
        `${normalized.title} puede bloquear o degradar la salida operativa del piloto por clínica.`
    );

    return {
        id: normalized.id,
        code: normalized.code,
        title: normalized.title,
        owner: normalized.owner,
        severity: normalized.severity,
        status: normalized.status,
        impact,
        blockers: normalized.blockers,
        notes: normalized.notes,
        steps: {
            now: listify(normalized.now).length
                ? listify(normalized.now)
                : preset.now,
            next: listify(normalized.next).length
                ? listify(normalized.next)
                : preset.next,
            verify: listify(normalized.verify).length
                ? listify(normalized.verify)
                : preset.verify,
            escalate: listify(normalized.escalate).length
                ? listify(normalized.escalate)
                : preset.escalate,
        },
        commands,
    };
}

export function buildIncidentPlaybooks({ incidents = [], context = {} } = {}) {
    return incidents.map((incident, index) =>
        buildIncidentPlaybook(
            normalizeWorkbenchIncident(incident, index),
            context
        )
    );
}

export function buildOwnerPlaybookBoard({ incidents = [], context = {} } = {}) {
    const playbooks = buildIncidentPlaybooks({ incidents, context });
    const grouped = new Map();

    for (const playbook of playbooks) {
        const bucket = grouped.get(playbook.owner) || [];
        bucket.push(playbook);
        grouped.set(playbook.owner, bucket);
    }

    return Array.from(grouped.entries()).map(([owner, ownerPlaybooks]) => ({
        owner,
        total: ownerPlaybooks.length,
        critical: ownerPlaybooks.filter(
            (item) => String(item.severity).toLowerCase() === 'critical'
        ).length,
        blocked: ownerPlaybooks.filter(
            (item) => String(item.status).toLowerCase() === 'blocked'
        ).length,
        items: ownerPlaybooks,
    }));
}
