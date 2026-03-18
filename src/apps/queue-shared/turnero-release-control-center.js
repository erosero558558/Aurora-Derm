const OWNER_KEYS = new Set(['deploy', 'backend', 'frontend', 'ops', 'unknown']);

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
