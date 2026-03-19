const OWNER_KEYS = new Set([
    'deploy',
    'backend',
    'frontend',
    'ops',
    'config',
    'unknown',
]);

function toText(value, fallback = '') {
    const normalized = String(value ?? '').trim();
    return normalized || fallback;
}

function asObject(value) {
    return value && typeof value === 'object' && !Array.isArray(value)
        ? value
        : {};
}

function toArray(value) {
    return Array.isArray(value) ? value.filter(Boolean) : [];
}

function normalizeClinicId(value) {
    return toText(value, 'default-clinic');
}

function normalizeOwner(value) {
    const owner = toText(value, 'unknown').toLowerCase();
    return OWNER_KEYS.has(owner) ? owner : 'unknown';
}

function normalizeSeverity(value, fallback = 'info') {
    const severity = toText(value, fallback).toLowerCase();
    if (['alert', 'blocked', 'error', 'critical'].includes(severity)) {
        return 'alert';
    }
    if (['warning', 'watch', 'pending', 'pending_review'].includes(severity)) {
        return 'warning';
    }
    if (['ready', 'done', 'success', 'clear', 'ok'].includes(severity)) {
        return 'ready';
    }
    return 'info';
}

function isDomElement(value) {
    return typeof HTMLElement !== 'undefined' && value instanceof HTMLElement;
}

function getStorage() {
    try {
        return typeof localStorage !== 'undefined' ? localStorage : null;
    } catch (_error) {
        return null;
    }
}

function safeJsonStringify(value) {
    const seen = new WeakSet();
    try {
        return JSON.stringify(
            value,
            (_key, entry) => {
                if (typeof entry === 'function') {
                    return undefined;
                }

                if (entry && typeof entry === 'object') {
                    if (seen.has(entry)) {
                        return '[Circular]';
                    }
                    seen.add(entry);
                }

                return entry;
            },
            2
        );
    } catch (_error) {
        return JSON.stringify({ error: 'json_stringify_failed' }, null, 2);
    }
}

function inferOwnerFromText(value, fallback = 'unknown') {
    const body = toText(value).toLowerCase();
    if (!body) {
        return normalizeOwner(fallback);
    }

    const keywordSets = [
        [
            'deploy',
            [
                'deploy',
                'publish',
                'release',
                'drift',
                'shell',
                'public',
                'cdn',
                'route',
            ],
        ],
        [
            'backend',
            [
                'backend',
                'health',
                'diagnostics',
                'figo',
                'api',
                'contract',
                'profile',
                'identity',
            ],
        ],
        [
            'frontend',
            [
                'frontend',
                'ui',
                'admin',
                'queue',
                'kiosk',
                'display',
                'html',
                'css',
                'render',
            ],
        ],
        [
            'ops',
            [
                'ops',
                'smoke',
                'checklist',
                'runbook',
                'journal',
                'incident',
                'evidence',
                'handoff',
                'monitor',
            ],
        ],
    ];

    for (const [owner, needles] of keywordSets) {
        if (needles.some((needle) => body.includes(needle))) {
            return owner;
        }
    }

    return normalizeOwner(fallback);
}

function normalizeSignalItem(input, source = 'signal', index = 0) {
    const item = asObject(input);
    const title = toText(
        item.title ||
            item.label ||
            item.name ||
            item.id ||
            `${source} ${index + 1}`
    );
    const detail = toText(
        item.detail ||
            item.summary ||
            item.reason ||
            item.note ||
            item.description ||
            title
    );
    const owner = normalizeOwner(
        item.owner ||
            item.recommendedOwner ||
            item.assignee ||
            inferOwnerFromText(`${title} ${detail}`)
    );
    const severity = normalizeSeverity(
        item.severity || item.state || item.tone || item.status
    );
    const tags = toArray(item.tags || item.labels).map((entry) =>
        toText(entry)
    );
    const recommendedCommands = toArray(
        item.recommendedCommands || item.commands || item.actions
    ).map((entry) => toText(entry));
    const recommendedDocs = toArray(
        item.recommendedDocs || item.docs || item.references
    ).map((entry) => toText(entry));
    const topIncidentTitles = toArray(
        item.topIncidentTitles || item.top_titles || item.topTitles
    ).map((entry) => toText(entry));

    return {
        id: toText(item.id, `${source}-${index + 1}`),
        owner,
        title,
        detail,
        summary: toText(item.summary || detail || title),
        severity,
        source: toText(item.source || source, source),
        state: toText(item.state || item.status || severity, severity),
        tags,
        note: toText(item.note || item.why || ''),
        why: toText(item.why || item.rationale || item.note || ''),
        nextCheck: toText(item.nextCheck || item.followUp || ''),
        recommendedCommands: recommendedCommands.filter(Boolean),
        recommendedDocs: recommendedDocs.filter(Boolean),
        evidence: asObject(item.evidence || item.meta || {}),
        topIncidentTitles: topIncidentTitles.length
            ? topIncidentTitles.filter(Boolean)
            : [title].filter(Boolean),
        updatedAt: toText(
            item.updatedAt || item.createdAt || new Date().toISOString()
        ),
    };
}

function normalizeSignalItems(value, source = 'signal') {
    if (Array.isArray(value)) {
        return value
            .map((entry, index) => normalizeSignalItem(entry, source, index))
            .filter((entry) => Boolean(entry.title));
    }

    if (value && typeof value === 'object') {
        const objectValue = asObject(value);
        const preferredArrays = [
            objectValue.items,
            objectValue.incidents,
            objectValue.entries,
            objectValue.journal,
            objectValue.records,
            objectValue.notes,
            objectValue.signals,
        ].filter(Array.isArray);

        if (preferredArrays.length > 0) {
            return preferredArrays
                .flatMap((entry) => normalizeSignalItems(entry, source))
                .filter((entry, index, list) => {
                    const key = `${entry.owner}:${entry.title}:${entry.severity}`;
                    return (
                        list.findIndex(
                            (candidate) =>
                                `${candidate.owner}:${candidate.title}:${candidate.severity}` ===
                                key
                        ) === index
                    );
                });
        }

        if (
            objectValue.title ||
            objectValue.label ||
            objectValue.summary ||
            objectValue.detail ||
            objectValue.reason ||
            objectValue.id
        ) {
            return [normalizeSignalItem(objectValue, source, 0)];
        }
    }

    return [];
}

function deriveClinicName(clinicProfile, fallback = 'Piel en Armonia') {
    const profile = asObject(clinicProfile);
    return toText(
        profile?.branding?.name ||
            profile?.branding?.short_name ||
            profile?.clinic_name ||
            profile?.clinicName ||
            fallback,
        fallback
    );
}

function deriveClinicShortName(clinicProfile, fallback = 'Piel en Armonia') {
    const profile = asObject(clinicProfile);
    return toText(
        profile?.branding?.short_name ||
            profile?.branding?.name ||
            profile?.clinic_short_name ||
            profile?.clinicName ||
            fallback,
        fallback
    );
}

function extractReleaseEvidenceItems(bundle, clinicId) {
    const source = asObject(bundle);
    if (Array.isArray(bundle)) {
        return normalizeSignalItems(bundle, 'releaseEvidenceBundle');
    }

    const arrays = [
        source.items,
        source.incidents,
        source.entries,
        source.journal,
        source.notes,
        source.records,
        source.signals,
        source.briefs,
    ].filter(Array.isArray);

    const items = arrays.flatMap((entry) =>
        normalizeSignalItems(entry, 'releaseEvidenceBundle')
    );

    if (items.length > 0) {
        return items;
    }

    if (
        source.title ||
        source.label ||
        source.summary ||
        source.detail ||
        source.reason ||
        source.status
    ) {
        return [
            normalizeSignalItem(
                {
                    ...source,
                    id: toText(source.id, `${clinicId}-release-evidence`),
                    source: 'releaseEvidenceBundle',
                },
                'releaseEvidenceBundle'
            ),
        ];
    }

    return [];
}

function buildSignalSummary(label, state, summary, support) {
    const pieces = [
        toText(label),
        toText(state, 'info'),
        toText(summary),
        toText(support),
    ].filter(Boolean);

    return pieces.join(' · ');
}

export function toReleaseControlCenterSnapshot(parts = {}) {
    const clinicProfile = asObject(
        parts.clinicProfile || parts.turneroClinicProfile || parts.profile || {}
    );
    const pilotReadiness = asObject(
        parts.pilotReadiness ||
            parts.turneroPilotReadiness ||
            parts.openingReadiness ||
            {}
    );
    const remoteReleaseReadiness = asObject(
        parts.remoteReleaseReadiness ||
            parts.turneroRemoteReleaseReadiness ||
            parts.releaseReadiness ||
            {}
    );
    const publicShellDrift = asObject(
        parts.publicShellDrift ||
            parts.turneroPublicShellDrift ||
            parts.shellDrift ||
            {}
    );
    const releaseEvidenceBundle = asObject(
        parts.releaseEvidenceBundle ||
            parts.turneroReleaseEvidenceBundle ||
            parts.evidenceBundle ||
            {}
    );
    const clinicId = normalizeClinicId(
        parts.clinicId ||
            clinicProfile.clinic_id ||
            clinicProfile.clinicId ||
            pilotReadiness.clinicId ||
            remoteReleaseReadiness.clinicId ||
            publicShellDrift.clinicId ||
            releaseEvidenceBundle.clinicId
    );
    const profileFingerprint = toText(
        parts.profileFingerprint ||
            clinicProfile.runtime_meta?.profileFingerprint ||
            clinicProfile.profileFingerprint ||
            pilotReadiness.profileFingerprint ||
            remoteReleaseReadiness.profileFingerprint ||
            publicShellDrift.profileFingerprint ||
            releaseEvidenceBundle.profileFingerprint
    );
    const clinicName = deriveClinicName(clinicProfile);
    const clinicShortName = deriveClinicShortName(clinicProfile, clinicName);
    const releaseMode = toText(
        parts.releaseMode ||
            clinicProfile.release?.mode ||
            clinicProfile.releaseMode ||
            pilotReadiness.releaseMode ||
            releaseEvidenceBundle.releaseMode ||
            'suite_v2'
    );
    const generatedAt = new Date().toISOString();

    const signals = {
        pilotReadiness: {
            key: 'pilotReadiness',
            label: toText(
                pilotReadiness.title ||
                    pilotReadiness.eyebrow ||
                    'Pilot readiness'
            ),
            state: normalizeSeverity(
                pilotReadiness.finalStatus ||
                    pilotReadiness.readinessState ||
                    pilotReadiness.state ||
                    pilotReadiness.tone ||
                    'info'
            ),
            summary: toText(
                pilotReadiness.summary ||
                    pilotReadiness.readinessSummary ||
                    pilotReadiness.supportCopy ||
                    pilotReadiness.metaLine
            ),
            support: toText(
                pilotReadiness.supportCopy ||
                    pilotReadiness.readinessSupport ||
                    ''
            ),
            items: normalizeSignalItems(
                [
                    ...toArray(pilotReadiness.blockers),
                    ...toArray(pilotReadiness.warnings),
                ].map((entry) =>
                    typeof entry === 'string'
                        ? {
                              title: entry,
                              detail: entry,
                              severity: 'warning',
                              owner: inferOwnerFromText(entry, 'backend'),
                              source: 'pilotReadiness',
                          }
                        : {
                              ...asObject(entry),
                              source: 'pilotReadiness',
                          }
                ),
                'pilotReadiness'
            ),
            raw: pilotReadiness,
        },
        remoteReleaseReadiness: {
            key: 'remoteReleaseReadiness',
            label: toText(
                remoteReleaseReadiness.title ||
                    remoteReleaseReadiness.eyebrow ||
                    'Salida remota'
            ),
            state: normalizeSeverity(
                remoteReleaseReadiness.state ||
                    remoteReleaseReadiness.tone ||
                    remoteReleaseReadiness.status ||
                    'info'
            ),
            summary: toText(
                remoteReleaseReadiness.summary ||
                    remoteReleaseReadiness.supportCopy ||
                    remoteReleaseReadiness.statusLabel
            ),
            support: toText(remoteReleaseReadiness.supportCopy || ''),
            items: normalizeSignalItems(
                toArray(remoteReleaseReadiness.items).map((entry) => ({
                    ...asObject(entry),
                    source: 'remoteReleaseReadiness',
                })),
                'remoteReleaseReadiness'
            ),
            raw: remoteReleaseReadiness,
        },
        publicShellDrift: {
            key: 'publicShellDrift',
            label: toText(
                publicShellDrift.title ||
                    publicShellDrift.eyebrow ||
                    'Deploy drift'
            ),
            state: publicShellDrift.driftStatus
                ? normalizeSeverity(publicShellDrift.driftStatus)
                : publicShellDrift.blockers &&
                    publicShellDrift.blockers.length > 0
                  ? 'alert'
                  : 'ready',
            summary: toText(
                publicShellDrift.signalSummary ||
                    publicShellDrift.summary ||
                    publicShellDrift.supportCopy
            ),
            support: toText(publicShellDrift.supportCopy || ''),
            items: normalizeSignalItems(
                toArray(publicShellDrift.blockers).map((entry) => ({
                    ...asObject(entry),
                    severity: 'alert',
                    owner: 'deploy',
                    source: 'publicShellDrift',
                })),
                'publicShellDrift'
            ),
            raw: publicShellDrift,
        },
        releaseEvidenceBundle: {
            key: 'releaseEvidenceBundle',
            label: toText(
                releaseEvidenceBundle.title ||
                    releaseEvidenceBundle.eyebrow ||
                    'Evidencia'
            ),
            state: normalizeSeverity(
                releaseEvidenceBundle.state ||
                    releaseEvidenceBundle.status ||
                    releaseEvidenceBundle.tone ||
                    'info'
            ),
            summary: toText(
                releaseEvidenceBundle.summary ||
                    releaseEvidenceBundle.supportCopy ||
                    releaseEvidenceBundle.note
            ),
            support: toText(releaseEvidenceBundle.supportCopy || ''),
            items: extractReleaseEvidenceItems(releaseEvidenceBundle, clinicId),
            raw: releaseEvidenceBundle,
        },
    };

    const journalEntries = normalizeSignalItems(
        [
            ...signals.pilotReadiness.items,
            ...signals.remoteReleaseReadiness.items,
            ...signals.publicShellDrift.items,
            ...signals.releaseEvidenceBundle.items,
        ],
        'releaseJournal'
    );

    return {
        clinicId,
        clinicName,
        clinicShortName,
        profileFingerprint,
        releaseMode,
        generatedAt,
        turneroClinicProfile: clinicProfile,
        clinicProfile,
        parts: {
            clinicProfile,
            pilotReadiness,
            remoteReleaseReadiness,
            publicShellDrift,
            releaseEvidenceBundle,
        },
        signals,
        journalEntries,
        evidenceSummary: buildSignalSummary(
            signals.releaseEvidenceBundle.label,
            signals.releaseEvidenceBundle.state,
            signals.releaseEvidenceBundle.summary,
            signals.releaseEvidenceBundle.support
        ),
    };
}

function escapeHtml(value) {
    return String(value ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function escapeMd(value) {
    return String(value ?? '')
        .replace(/\\/g, '\\\\')
        .replace(/`/g, '\\`')
        .replace(/\r?\n/g, ' ')
        .trim();
}

function safeFilePart(value, fallback = 'turnero-release-control-center') {
    const normalized = String(value ?? '')
        .trim()
        .replace(/[^a-z0-9._-]+/gi, '-')
        .replace(/-+/g, '-')
        .replace(/^-|-$/g, '');

    return normalized || fallback;
}

function makeIncident({ code, severity, title, detail, source, owner }) {
    const normalizedSeverity =
        severity === 'hold'
            ? 'hold'
            : severity === 'review'
              ? 'review'
              : 'ready';

    return {
        code: toText(code),
        severity: normalizedSeverity,
        state:
            normalizedSeverity === 'hold'
                ? 'alert'
                : normalizedSeverity === 'review'
                  ? 'warning'
                  : 'ready',
        title: toText(title),
        detail: toText(detail),
        source: toText(source, 'runtime'),
        owner: normalizeOwner(owner),
    };
}

function issueBadge(severity) {
    return severity === 'hold'
        ? 'hold'
        : severity === 'review'
          ? 'review'
          : 'ready';
}

function incidentPriority(severity) {
    return severity === 'hold' ? 0 : severity === 'review' ? 1 : 2;
}

function getControlCenterClinicProfile(parts = {}) {
    return asObject(
        parts.clinicProfile || parts.turneroClinicProfile || parts.profile || {}
    );
}

function getControlCenterPilotReadiness(parts = {}, snapshot = {}) {
    return asObject(
        parts.pilotReadiness ||
            parts.turneroPilotReadiness ||
            parts.openingReadiness ||
            snapshot.parts?.pilotReadiness ||
            {}
    );
}

function getControlCenterRemoteReleaseReadiness(parts = {}, snapshot = {}) {
    return asObject(
        parts.remoteReleaseReadiness ||
            parts.turneroRemoteReleaseReadiness ||
            parts.releaseReadiness ||
            snapshot.parts?.remoteReleaseReadiness ||
            {}
    );
}

function getControlCenterPublicShellDrift(parts = {}, snapshot = {}) {
    return asObject(
        parts.publicShellDrift ||
            parts.turneroPublicShellDrift ||
            parts.shellDrift ||
            snapshot.parts?.publicShellDrift ||
            {}
    );
}

function collectControlCenterIncidents(parts, snapshot) {
    const incidents = [];
    const clinicProfileInput = getControlCenterClinicProfile(parts);
    const clinicProfilePresent =
        Boolean(
            parts.clinicProfile || parts.turneroClinicProfile || parts.profile
        ) && Object.keys(clinicProfileInput).length > 0;
    const clinicRuntimeSource = clinicProfilePresent
        ? String(clinicProfileInput.runtime_meta?.source || 'remote')
              .trim()
              .toLowerCase()
        : 'missing';
    const pilot = getControlCenterPilotReadiness(parts, snapshot);
    const remote = getControlCenterRemoteReleaseReadiness(parts, snapshot);
    const shell = getControlCenterPublicShellDrift(parts, snapshot);
    const turneroPilot = asObject(remote.checks?.turneroPilot);
    const publicSync = asObject(remote.checks?.publicSync);
    const diagnosticsPayload = asObject(
        remote.diagnosticsPayload || remote.diagnostics?.payload
    );

    if (!clinicProfilePresent) {
        incidents.push(
            makeIncident({
                code: 'clinic_profile_missing',
                severity: 'hold',
                title: 'Perfil clínico ausente',
                detail: 'No existe un clinic-profile activo en runtime; la release no puede validarse con evidencia confiable.',
                source: 'clinic_profile',
                owner: 'config',
            })
        );
    } else if (clinicRuntimeSource === 'fallback_default') {
        incidents.push(
            makeIncident({
                code: 'clinic_profile_fallback',
                severity: 'hold',
                title: 'Perfil clínico en fallback',
                detail: 'El perfil activo sigue viniendo del fallback_default y no del canon remoto por clínica.',
                source: 'clinic_profile',
                owner: 'config',
            })
        );
    }

    if (
        String(
            pilot.readinessState ||
                snapshot.signals?.pilotReadiness?.state ||
                ''
        ).trim() !== 'ready' ||
        String(pilot.goLiveIssueState || '').trim() !== 'ready'
    ) {
        incidents.push(
            makeIncident({
                code: 'surface_not_ready',
                severity:
                    pilot.readinessState === 'alert' ||
                    pilot.goLiveIssueState === 'alert' ||
                    snapshot.signals?.pilotReadiness?.state === 'alert'
                        ? 'hold'
                        : 'review',
                title: 'Superficies no listas',
                detail:
                    [pilot.readinessSummary, pilot.goLiveSummary]
                        .filter(Boolean)
                        .join(' · ') || 'La superficie todavía no quedó lista.',
                source: 'pilot.readiness',
                owner: 'frontend',
            })
        );
    }

    if (remote.diagnostics?.kind === 'denied') {
        incidents.push(
            makeIncident({
                code: 'remote_health_diagnostics_denied',
                severity: 'hold',
                title: 'Diagnóstico remoto denegado',
                detail: 'health-diagnostics respondió 401/403 y no deja validar la señal remota de Turnero.',
                source: 'remote.diagnostics',
                owner: 'ops',
            })
        );
    }

    if (
        !Object.keys(turneroPilot).length ||
        turneroPilot.available !== true ||
        turneroPilot.configured !== true ||
        turneroPilot.ready !== true
    ) {
        incidents.push(
            makeIncident({
                code: 'remote_turnero_pilot_missing',
                severity: 'hold',
                title: 'Turnero remoto no confirmado',
                detail: !Object.keys(turneroPilot).length
                    ? 'health-diagnostics no expone checks.turneroPilot.'
                    : turneroPilot.available !== true
                      ? 'turneroPilot.available=false en health-diagnostics.'
                      : turneroPilot.configured !== true
                        ? 'turneroPilot.configured=false en health-diagnostics.'
                        : 'turneroPilot.ready=false en health-diagnostics.',
                source: 'remote.checks.turneroPilot',
                owner: 'ops',
            })
        );
    }

    if (
        !Object.keys(publicSync).length ||
        publicSync.available !== true ||
        publicSync.configured !== true
    ) {
        incidents.push(
            makeIncident({
                code: 'remote_public_sync_missing',
                severity: 'hold',
                title: 'Public sync no expuesto',
                detail: !Object.keys(publicSync).length
                    ? 'health-diagnostics no expone checks.publicSync.'
                    : publicSync.available !== true
                      ? 'publicSync no respondió como señal disponible.'
                      : 'publicSync configured=false en health-diagnostics.',
                source: 'remote.checks.publicSync',
                owner: 'ops',
            })
        );
    } else if (
        publicSync.healthy !== true ||
        publicSync.operationallyHealthy === false ||
        publicSync.headDrift === true
    ) {
        incidents.push(
            makeIncident({
                code: 'remote_public_sync_unverified',
                severity: 'hold',
                title: 'Public sync no verificado',
                detail:
                    publicSync.headDrift === true
                        ? 'publicSync sigue con headDrift=true y no coincide con el remoto.'
                        : publicSync.healthy === false
                          ? `publicSync sigue ${toText(publicSync.state, 'desconocido')}.`
                          : 'publicSync no quedó operacionalmente sano.',
                source: 'remote.checks.publicSync',
                owner: 'ops',
            })
        );
    } else if (!toText(publicSync.deployedCommit)) {
        incidents.push(
            makeIncident({
                code: 'remote_public_sync_unverified',
                severity: 'review',
                title: 'Public sync aún no verificado del todo',
                detail: 'publicSync no reporta deployedCommit y todavía requiere confirmación.',
                source: 'remote.checks.publicSync',
                owner: 'ops',
            })
        );
    }

    if (
        remote.diagnostics?.kind === 'ok' &&
        (diagnosticsPayload.figoConfigured === false ||
            diagnosticsPayload.figoRecursiveConfig === true)
    ) {
        incidents.push(
            makeIncident({
                code: 'remote_figo_degraded',
                severity: 'hold',
                title: 'Figo degradado',
                detail:
                    diagnosticsPayload.figoConfigured === false
                        ? 'figoConfigured=false en health-diagnostics.'
                        : 'figoRecursiveConfig=true en health-diagnostics.',
                source: 'remote.diagnostics',
                owner: 'ops',
            })
        );
    }

    if (
        (snapshot.clinicId &&
            remote.clinicId &&
            remote.clinicId.toLowerCase() !==
                snapshot.clinicId.toLowerCase()) ||
        (snapshot.profileFingerprint &&
            remote.profileFingerprint &&
            remote.profileFingerprint !== snapshot.profileFingerprint)
    ) {
        incidents.push(
            makeIncident({
                code: 'remote_profile_mismatch',
                severity: 'hold',
                title: 'Perfil remoto no coincide',
                detail: [
                    snapshot.clinicId && remote.clinicId
                        ? `clinicId remoto ${remote.clinicId} != ${snapshot.clinicId}`
                        : '',
                    snapshot.profileFingerprint && remote.profileFingerprint
                        ? `profileFingerprint remoto ${remote.profileFingerprint} != ${snapshot.profileFingerprint}`
                        : '',
                ]
                    .filter(Boolean)
                    .join(' · '),
                source: 'remote.identity',
                owner: 'ops',
            })
        );
    }

    const mappedRemoteIds = new Set([
        'diagnostics',
        'identity',
        'public_sync',
        'figo',
    ]);
    const remoteResiduals = toArray(remote.items).filter(
        (item) => item.state !== 'ready' && !mappedRemoteIds.has(item.id)
    );
    if (remoteResiduals.length > 0) {
        incidents.push(
            makeIncident({
                code: 'surface_not_ready',
                severity: remoteResiduals.some((item) => item.state === 'alert')
                    ? 'hold'
                    : 'review',
                title: 'Superficies remotas todavía no listas',
                detail: remoteResiduals
                    .map((item) => `${item.label}: ${item.detail}`)
                    .join(' · '),
                source: 'remote.items',
                owner: 'ops',
            })
        );
    }

    const structuralKeys = new Set([
        'public_shell_unavailable',
        'public_shell_fetch_failed',
        'stylesheet_missing',
        'stylesheet_drift',
        'shell_script_missing',
        'shell_script_drift',
    ]);
    const shellBlockers = toArray(shell.blockers).map((item) => asObject(item));
    const structuralBlockers = shellBlockers.filter((item) =>
        structuralKeys.has(toText(item.key))
    );
    if (shell.pageOk === false || shell.pageStatus === 0) {
        incidents.push(
            makeIncident({
                code: 'public_shell_unreachable',
                severity: 'hold',
                title: 'Shell público no alcanzable',
                detail: `GET / respondió ${shell.pageStatus || 'n/a'} y no deja validar el corte público.`,
                source: 'public_shell.page',
                owner: 'frontend',
            })
        );
    }
    if (structuralBlockers.length > 0) {
        incidents.push(
            makeIncident({
                code: 'public_shell_drift',
                severity: 'hold',
                title: 'Drift del shell público',
                detail: structuralBlockers
                    .map((item) => `${item.title}: ${item.detail}`)
                    .join(' · '),
                source: 'public_shell.blockers',
                owner: 'frontend',
            })
        );
    }
    if (Number(shell.inlineExecutableScripts || 0) > 0) {
        incidents.push(
            makeIncident({
                code: 'inline_script_detected',
                severity: 'hold',
                title: 'Script inline detectado',
                detail: `Se detectaron ${shell.inlineExecutableScripts} script(s) inline ejecutable(s) en el shell público.`,
                source: 'public_shell.inline',
                owner: 'frontend',
            })
        );
    }
    if (
        shellBlockers.some((item) => item.key === 'ga4_markers_missing') ||
        (toArray(shell.ga4Required).length > 0 &&
            toArray(shell.ga4Found).length < toArray(shell.ga4Required).length)
    ) {
        incidents.push(
            makeIncident({
                code: 'ga4_markers_missing',
                severity: 'review',
                title: 'Marcadores GA4 incompletos',
                detail: toArray(shell.ga4Required).length
                    ? `Presentes ${toArray(shell.ga4Found).length}/${toArray(shell.ga4Required).length}: ${
                          toArray(shell.ga4Found).join(', ') || 'ninguno'
                      }.`
                    : 'No se detectaron marcadores GA4 requeridos.',
                source: 'public_shell.analytics',
                owner: 'frontend',
            })
        );
    }

    return incidents.sort(
        (left, right) =>
            incidentPriority(left.severity) -
                incidentPriority(right.severity) ||
            left.code.localeCompare(right.code)
    );
}

function buildReleaseControlCenterSummary(
    snapshot,
    decision,
    alertCount,
    warningCount,
    incidents
) {
    if (decision === 'ready') {
        return `Ready: ${snapshot.clinicShortName || snapshot.clinicName || snapshot.clinicId || 'Sin perfil'} quedó alineada con la evidencia local, remota y pública.`;
    }

    const top = incidents.find((item) =>
        decision === 'hold' ? item.state === 'alert' : item.state === 'warning'
    );

    return decision === 'hold'
        ? `Hold: ${alertCount} bloqueo(s) impiden la liberación. ${top?.title || ''}: ${top?.detail || ''}`.trim()
        : `Review: ${warningCount} señal(es) requieren validación manual. ${top?.title || ''}: ${top?.detail || ''}`.trim();
}

function buildReleaseControlCenterRunbook(snapshot, decision, incidents) {
    const signalLines = [
        `- Pilot readiness: ${escapeMd(snapshot.pilotReadiness?.readinessState || snapshot.signals?.pilotReadiness?.state || 'n/a')} · ${escapeMd(
            snapshot.pilotReadiness?.readinessSummary ||
                snapshot.pilotReadiness?.readinessSupport ||
                'n/a'
        )}`,
        `- Go-live issues: ${escapeMd(snapshot.pilotReadiness?.goLiveIssueState || 'n/a')} · ${escapeMd(
            snapshot.pilotReadiness?.goLiveSummary ||
                snapshot.pilotReadiness?.goLiveSupport ||
                'n/a'
        )}`,
        `- Remote readiness: ${escapeMd(snapshot.remoteReleaseReadiness?.tone || snapshot.remoteReleaseReadiness?.state || 'n/a')} · ${escapeMd(
            snapshot.remoteReleaseReadiness?.summary ||
                snapshot.remoteReleaseReadiness?.supportCopy ||
                'n/a'
        )}`,
        `- Public shell: ${escapeMd(snapshot.publicShellDrift?.driftStatus || snapshot.publicShellDrift?.state || 'n/a')} · ${escapeMd(
            snapshot.publicShellDrift?.signalSummary ||
                snapshot.publicShellDrift?.supportCopy ||
                'n/a'
        )}`,
    ];
    const incidentLines = incidents.length
        ? incidents.map(
              (incident) =>
                  `- \`${escapeMd(incident.code)}\` [${escapeMd(
                      incident.severity
                  )}] ${escapeMd(incident.title)}: ${escapeMd(incident.detail)}`
          )
        : ['- Sin incidentes.'];

    return [
        '# Turnero Release Control Center',
        '',
        `- Decision: ${decision}`,
        `- Clinic: ${escapeMd(snapshot.clinicName)} (${escapeMd(
            snapshot.clinicId || 'sin clinic_id'
        )})`,
        `- Profile source: ${escapeMd(
            snapshot.turneroClinicProfile?.runtime_meta?.source || 'missing'
        )}`,
        `- Generated at: ${escapeMd(snapshot.generatedAt)}`,
        '',
        '## Decision Summary',
        escapeMd(snapshot.evidenceSummary || snapshot.summary || ''),
        '',
        '## Incidents',
        ...incidentLines,
        '',
        '## Signals',
        ...signalLines,
        '',
        '## Next Action',
        decision === 'ready'
            ? '- Liberate la release.'
            : decision === 'review'
              ? '- Revisa las señales warning antes de liberar.'
              : '- Corrige los bloqueos hold antes de liberar.',
    ].join('\n');
}

export function buildTurneroReleaseControlCenterModel(parts = {}) {
    const snapshot = toReleaseControlCenterSnapshot(parts);
    const incidents = collectControlCenterIncidents(parts, snapshot);
    const alertCount = incidents.filter(
        (item) => item.state === 'alert'
    ).length;
    const warningCount = incidents.filter(
        (item) => item.state === 'warning'
    ).length;
    const decision =
        alertCount > 0 ? 'hold' : warningCount > 0 ? 'review' : 'ready';
    const releaseEvidenceBundle = asObject(
        snapshot.parts.releaseEvidenceBundle
    );
    const summary = buildReleaseControlCenterSummary(
        snapshot,
        decision,
        alertCount,
        warningCount,
        incidents
    );
    const supportCopy =
        decision === 'ready'
            ? `Puedes seguir con la liberación de ${snapshot.clinicName}.`
            : decision === 'review'
              ? 'No hay bloqueos duros, pero todavía quedan señales de revisión antes de liberar.'
              : 'No liberes esta salida hasta cerrar los incidentes hold listados arriba.';
    const decisionReason =
        decision === 'ready'
            ? 'Sin incidentes hold ni review en la evidencia cargada.'
            : incidents[0]
              ? `${incidents[0].code}: ${incidents[0].detail}`
              : 'Hay señales pendientes.';
    const clipboardSummary = [
        'Turnero release control center',
        `Decision: ${decision}`,
        `Clinic: ${snapshot.clinicName || 'Sin perfil'} (${snapshot.clinicId || 'sin clinic_id'})`,
        `Profile source: ${snapshot.turneroClinicProfile?.runtime_meta?.source || 'missing'}`,
        `Summary: ${summary}`,
        `Incidents: ${incidents.map((item) => item.code).join(', ') || 'none'}`,
    ].join('\n');
    const runbookMarkdown = buildReleaseControlCenterRunbook(
        {
            ...snapshot,
            turneroClinicProfile: snapshot.parts.clinicProfile,
            pilotReadiness: snapshot.parts.pilotReadiness,
            remoteReleaseReadiness: snapshot.parts.remoteReleaseReadiness,
            publicShellDrift: snapshot.parts.publicShellDrift,
            releaseEvidenceBundle,
        },
        decision,
        incidents
    );

    return {
        ...snapshot,
        turneroClinicProfile: snapshot.parts.clinicProfile,
        pilotReadiness: snapshot.parts.pilotReadiness,
        remoteReleaseReadiness: snapshot.parts.remoteReleaseReadiness,
        publicShellDrift: snapshot.parts.publicShellDrift,
        releaseEvidenceBundle,
        incidents,
        alertCount,
        warningCount,
        decision,
        tone:
            decision === 'hold'
                ? 'alert'
                : decision === 'review'
                  ? 'warning'
                  : 'ready',
        summary,
        supportCopy,
        decisionReason,
        clipboardSummary,
        runbookMarkdown,
        snapshotFileName: `${safeFilePart(
            snapshot.clinicId || snapshot.clinicShortName || snapshot.clinicName
        )}-${snapshot.generatedAt.slice(0, 10).replaceAll('-', '')}.json`,
        snapshot: {
            ...snapshot,
            turneroClinicProfile: snapshot.parts.clinicProfile,
            pilotReadiness: snapshot.parts.pilotReadiness,
            remoteReleaseReadiness: snapshot.parts.remoteReleaseReadiness,
            publicShellDrift: snapshot.parts.publicShellDrift,
            releaseEvidenceBundle,
            incidents: incidents.map((incident) => ({ ...incident })),
            alertCount,
            warningCount,
            decision,
            tone:
                decision === 'hold'
                    ? 'alert'
                    : decision === 'review'
                      ? 'warning'
                      : 'ready',
            summary,
            supportCopy,
            decisionReason,
            clipboardSummary,
            runbookMarkdown,
        },
    };
}

function renderIncident(incident, escapeHtmlImpl) {
    return `
        <article
            id="queueReleaseControlCenterIncident_${escapeHtmlImpl(incident.code)}"
            class="queue-ops-pilot__issues-item"
            data-state="${escapeHtmlImpl(incident.state)}"
            data-incident-code="${escapeHtmlImpl(incident.code)}"
            role="listitem"
        >
            <div class="queue-ops-pilot__issues-item-head">
                <strong>${escapeHtmlImpl(incident.title)}</strong>
                <span class="queue-ops-pilot__issues-item-badge">${escapeHtmlImpl(
                    issueBadge(incident.severity)
                )}</span>
            </div>
            <p>${escapeHtmlImpl(incident.detail)}</p>
            <code>${escapeHtmlImpl(incident.code)}</code>
        </article>
    `.trim();
}

export function renderTurneroReleaseControlCenterCard(
    input = {},
    options = {}
) {
    const model =
        input && Array.isArray(input.incidents)
            ? input
            : buildTurneroReleaseControlCenterModel(input);
    const escapeHtmlImpl =
        typeof options.escapeHtml === 'function'
            ? options.escapeHtml
            : escapeHtml;

    return `
        <section
            id="queueReleaseControlCenter"
            class="queue-ops-pilot__issues queue-ops-pilot__release-control-center"
            data-state="${escapeHtmlImpl(model.tone)}"
            data-decision="${escapeHtmlImpl(model.decision)}"
            aria-labelledby="queueReleaseControlCenterTitle"
            aria-live="polite"
        >
            <div class="queue-ops-pilot__issues-head">
                <div>
                    <p class="queue-app-card__eyebrow">Release control center</p>
                    <h6 id="queueReleaseControlCenterTitle">Playbook de liberación</h6>
                </div>
                <span
                    id="queueReleaseControlCenterStatus"
                    class="queue-ops-pilot__issues-status"
                    data-state="${escapeHtmlImpl(model.tone)}"
                >
                    ${escapeHtmlImpl(model.decision)}
                </span>
            </div>
            <p id="queueReleaseControlCenterSummary" class="queue-ops-pilot__issues-summary">${escapeHtmlImpl(
                model.summary
            )}</p>
            <p id="queueReleaseControlCenterEvidence" class="queue-ops-pilot__issues-support">${escapeHtmlImpl(
                model.evidenceSummary || model.snapshot.evidenceSummary || ''
            )}</p>
            <div id="queueReleaseControlCenterIncidents" class="queue-ops-pilot__issues-items" role="list" aria-label="Incidentes normalizados de Turnero">
                ${
                    model.incidents.length
                        ? model.incidents
                              .map((incident) =>
                                  renderIncident(incident, escapeHtmlImpl)
                              )
                              .join('')
                        : renderIncident(
                              {
                                  code: 'ready',
                                  severity: 'ready',
                                  state: 'ready',
                                  title: 'Sin incidentes',
                                  detail: 'La evidencia quedó alineada y no hay tareas abiertas para el release.',
                              },
                              escapeHtmlImpl
                          )
                }
            </div>
            <div class="queue-ops-pilot__actions" aria-label="Acciones del control center">
                <button id="queueReleaseControlCopySummaryBtn" type="button" class="queue-ops-pilot__action">Copiar resumen</button>
                <button id="queueReleaseControlCopyRunbookBtn" type="button" class="queue-ops-pilot__action">Copiar runbook</button>
                <button id="queueReleaseControlDownloadBtn" type="button" class="queue-ops-pilot__action">Descargar JSON</button>
            </div>
            <p id="queueReleaseControlCenterSupport" class="queue-ops-pilot__issues-support">${escapeHtmlImpl(
                model.supportCopy
            )}</p>
            <details id="queueReleaseControlRunbookDetails">
                <summary>Runbook Markdown</summary>
                <pre id="queueReleaseControlRunbookMarkdown">${escapeHtmlImpl(
                    model.runbookMarkdown
                )}</pre>
            </details>
        </section>
    `.trim();
}

function bindReleaseControlCenterActions(section, model) {
    const summaryBtn = section.querySelector(
        '#queueReleaseControlCopySummaryBtn'
    );
    const runbookBtn = section.querySelector(
        '#queueReleaseControlCopyRunbookBtn'
    );
    const downloadBtn = section.querySelector(
        '#queueReleaseControlDownloadBtn'
    );

    if (
        typeof HTMLButtonElement !== 'undefined' &&
        summaryBtn instanceof HTMLButtonElement
    ) {
        summaryBtn.onclick = async () => {
            await copyToClipboardSafe(model.clipboardSummary);
        };
    }

    if (
        typeof HTMLButtonElement !== 'undefined' &&
        runbookBtn instanceof HTMLButtonElement
    ) {
        runbookBtn.onclick = async () => {
            await copyToClipboardSafe(model.runbookMarkdown);
        };
    }

    if (
        typeof HTMLButtonElement !== 'undefined' &&
        downloadBtn instanceof HTMLButtonElement
    ) {
        downloadBtn.onclick = () => {
            downloadJsonSnapshot(model.snapshotFileName, model.snapshot);
        };
    }
}

export function mountTurneroReleaseControlCenterCard(
    target,
    parts = {},
    options = {}
) {
    if (!isDomElement(target)) {
        return null;
    }

    const model = buildTurneroReleaseControlCenterModel(parts);
    target.innerHTML = renderTurneroReleaseControlCenterCard(model, options);

    const section = target.querySelector('#queueReleaseControlCenter');
    if (section instanceof HTMLElement) {
        section.__turneroReleaseControlCenterModel = model;
        bindReleaseControlCenterActions(section, model);
        return section;
    }

    return null;
}

export const buildTurneroReleaseControlCenterSnapshot =
    toReleaseControlCenterSnapshot;

export async function copyToClipboardSafe(text) {
    const value = toText(text);
    if (!value) {
        return false;
    }

    if (
        typeof navigator !== 'undefined' &&
        navigator.clipboard &&
        typeof navigator.clipboard.writeText === 'function'
    ) {
        try {
            await navigator.clipboard.writeText(value);
            return true;
        } catch (_error) {
            // Fall through to the legacy path.
        }
    }

    if (
        typeof document === 'undefined' ||
        !(document.body instanceof HTMLElement)
    ) {
        return false;
    }

    const textarea = document.createElement('textarea');
    textarea.value = value;
    textarea.setAttribute('readonly', 'true');
    textarea.style.position = 'fixed';
    textarea.style.top = '-1000px';
    textarea.style.left = '-1000px';
    textarea.style.opacity = '0';

    document.body.appendChild(textarea);
    textarea.focus();
    textarea.select();

    let copied = false;
    try {
        copied = Boolean(document.execCommand && document.execCommand('copy'));
    } catch (_error) {
        copied = false;
    } finally {
        textarea.remove();
    }

    return copied;
}

export function downloadJsonSnapshot(filename, payload) {
    if (
        typeof document === 'undefined' ||
        typeof Blob === 'undefined' ||
        typeof URL === 'undefined' ||
        typeof URL.createObjectURL !== 'function'
    ) {
        return false;
    }

    const safeName = toText(filename, 'turnero-release-war-room.json');
    const body = safeJsonStringify(payload);
    const blob = new Blob([body], {
        type: 'application/json;charset=utf-8',
    });
    const href = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = href;
    anchor.download = safeName;
    anchor.rel = 'noopener';
    anchor.style.display = 'none';

    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();

    if (typeof setTimeout === 'function') {
        setTimeout(() => URL.revokeObjectURL(href), 0);
    } else {
        URL.revokeObjectURL(href);
    }

    return true;
}

export {
    asObject,
    inferOwnerFromText,
    normalizeOwner,
    normalizeSeverity,
    toArray,
    toText,
};

export default buildTurneroReleaseControlCenterModel;
