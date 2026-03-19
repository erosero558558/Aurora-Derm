import {
    copyToClipboardSafe,
    downloadJsonSnapshot,
    toReleaseControlCenterSnapshot,
    toText,
} from './turnero-release-control-center.js';
import { buildTurneroReleaseConsolePlaybook } from './turnero-remediation-playbook.js';
import {
    createTurneroRemoteReleaseReadinessModel,
    loadTurneroRemoteReleaseHealth,
} from './turnero-remote-release-readiness.js';
import {
    createTurneroPublicShellDriftModel,
    loadTurneroPublicShellHtml,
} from './turnero-public-shell-drift.js';

function isPlainObject(value) {
    return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function normalizeObject(value) {
    return isPlainObject(value) ? value : {};
}

function unwrapResult(value) {
    const source = normalizeObject(value);
    return normalizeObject(
        source.payload ||
            source.data ||
            source.result ||
            source.snapshot ||
            source.pilotReadiness ||
            source.remoteReleaseReadiness ||
            source.publicShellDrift ||
            source.releaseEvidenceBundle ||
            source.playbook ||
            source
    );
}

function nowIso() {
    return new Date().toISOString();
}

function normalizeError(error, action = 'unknown') {
    if (!error) {
        return { action, code: 'unknown_error', message: 'unknown_error' };
    }

    if (typeof error === 'string') {
        return { action, code: 'request_failed', message: error };
    }

    if (error instanceof Error) {
        return {
            action,
            code: toText(error.code || 'request_failed'),
            message: error.message || 'request_failed',
            stack: toText(error.stack || ''),
        };
    }

    const source = normalizeObject(error);
    return {
        action,
        code: toText(source.code || 'request_failed'),
        message: toText(source.message || source.error || 'request_failed'),
        detail: toText(source.detail || ''),
    };
}

function buildApiUrl(resource, params = {}, apiBase = '/api.php') {
    const searchParams = new URLSearchParams();
    searchParams.set('resource', resource);
    Object.entries(params).forEach(([key, rawValue]) => {
        const value = toText(rawValue);
        if (value) {
            searchParams.set(key, value);
        }
    });
    return `${toText(apiBase, '/api.php')}?${searchParams.toString()}`;
}

async function fetchJsonResource(fetchImpl, url, requestInit = {}) {
    const request = {
        credentials: 'same-origin',
        ...requestInit,
        headers: {
            Accept: 'application/json',
            ...(isPlainObject(requestInit.headers) ? requestInit.headers : {}),
        },
    };

    if (typeof fetchImpl !== 'function') {
        return {
            ok: false,
            kind: 'unavailable',
            status: 0,
            payload: {},
            error: 'fetch_unavailable',
            code: 'fetch_unavailable',
        };
    }

    try {
        const response = await fetchImpl(url, request);
        const status = Number(response?.status || 0);
        let payload = {};

        if (response && typeof response.text === 'function') {
            const text = await response.text();
            if (text) {
                try {
                    payload = JSON.parse(text);
                } catch (_error) {
                    return {
                        ok: false,
                        kind: 'unavailable',
                        status,
                        payload: {},
                        error: 'invalid_json',
                        code: 'invalid_json',
                    };
                }
            }
        }

        if (response?.ok === true && payload?.ok !== false) {
            return {
                ok: true,
                kind: 'ok',
                status,
                payload: isPlainObject(payload) ? payload : {},
                error: '',
                code: '',
            };
        }

        if (status === 401 || status === 403) {
            return {
                ok: false,
                kind: 'denied',
                status,
                payload: isPlainObject(payload) ? payload : {},
                error: toText(payload?.error, `HTTP ${status}`),
                code: toText(payload?.code, 'access_denied'),
            };
        }

        return {
            ok: false,
            kind: 'unavailable',
            status,
            payload: isPlainObject(payload) ? payload : {},
            error: toText(payload?.error, `HTTP ${status}`),
            code: toText(payload?.code, 'request_failed'),
        };
    } catch (error) {
        return {
            ok: false,
            kind: 'unavailable',
            status: 0,
            payload: {},
            error: error instanceof Error ? error.message : toText(error),
            code: 'request_failed',
        };
    }
}

function getProviders(options = {}) {
    return isPlainObject(options.providers)
        ? options.providers
        : isPlainObject(options)
          ? options
          : {};
}

function getProvider(providers, names = []) {
    for (const name of names) {
        if (typeof providers?.[name] === 'function') {
            return providers[name];
        }
    }
    return null;
}

function normalizeProviderResponse(raw, action) {
    const source = unwrapResult(raw);
    const ok = !raw || raw.ok !== false;

    return {
        ok,
        error: ok ? null : normalizeError(raw.error || raw, action),
        source,
    };
}

function buildPilotReadinessFromResult(value, fallback = {}) {
    const source = {
        ...normalizeObject(fallback),
        ...unwrapResult(value),
    };
    if (!source.clinicProfile && source.turneroClinicProfile) {
        source.clinicProfile = source.turneroClinicProfile;
    }
    if (!source.turneroClinicProfile && source.clinicProfile) {
        source.turneroClinicProfile = source.clinicProfile;
    }
    return source;
}

function normalizeRemoteReleaseReadiness(raw, fallback = {}) {
    const source = unwrapResult(raw);
    if (
        source.health ||
        source.diagnostics ||
        source.availability ||
        source.bookedSlots
    ) {
        return createTurneroRemoteReleaseReadinessModel({
            ...source,
            clinicId: toText(source.clinicId || fallback.clinicId),
            profileFingerprint: toText(
                source.profileFingerprint || fallback.profileFingerprint
            ),
        });
    }

    if (source.state || source.tone || source.items || source.summary) {
        return {
            ...normalizeObject(fallback),
            ...source,
            clinicId: toText(source.clinicId || fallback.clinicId),
            profileFingerprint: toText(
                source.profileFingerprint || fallback.profileFingerprint
            ),
            items: Array.isArray(source.items)
                ? source.items.filter(Boolean)
                : [],
            loadedAt: toText(source.loadedAt || fallback.loadedAt || nowIso()),
        };
    }

    return normalizeObject(fallback);
}

function normalizePublicShellDrift(raw, options = {}, fallback = {}) {
    const source = unwrapResult(raw);
    if (
        source.pageOk !== undefined ||
        source.pageStatus !== undefined ||
        source.html !== undefined
    ) {
        return createTurneroPublicShellDriftModel(
            {
                pageOk: source.pageOk,
                pageStatus: source.pageStatus,
                html: source.html,
            },
            options.publicShellOptions || {}
        );
    }

    if (source.driftStatus || source.blockers) {
        return {
            ...normalizeObject(fallback),
            ...source,
            blockers: Array.isArray(source.blockers)
                ? source.blockers.filter(Boolean)
                : [],
        };
    }

    return normalizeObject(fallback);
}

function buildLocalReadinessModel(pilot = {}, clinicProfile = null) {
    const source = buildPilotReadinessFromResult(pilot, {});
    const profile = normalizeObject(clinicProfile || source.clinicProfile);
    const blockers = Array.isArray(source.goLiveIssues)
        ? source.goLiveIssues
              .filter((issue) => issue && issue.state === 'alert')
              .map((issue, index) => ({
                  key: String(issue.id || `pilot_blocker_${index + 1}`),
                  title: toText(issue.label || issue.title || 'Bloqueo'),
                  detail: toText(issue.detail || ''),
              }))
        : [];
    const openingPackageState = toText(
        source.readinessState || source.state || 'warning',
        'warning'
    );

    return {
        readySurfaceCount: Number(source.confirmedCount || 0),
        totalSurfaceCount: Number(source.totalSteps || 0),
        openingPackageState,
        openingPackageStatus: openingPackageState,
        state: openingPackageState,
        clinicName: toText(
            source.clinicName ||
                source.brandName ||
                profile.branding?.name ||
                profile.branding?.short_name ||
                'Piel en Armonía'
        ),
        brandName: toText(
            source.brandName ||
                source.clinicName ||
                profile.branding?.name ||
                profile.branding?.short_name ||
                'Piel en Armonía'
        ),
        clinicId: toText(
            source.clinicId || profile.clinic_id || profile.clinicId
        ),
        profileFingerprint: toText(
            source.profileFingerprint ||
                profile.runtime_meta?.profileFingerprint ||
                profile.profileFingerprint
        ),
        releaseMode: toText(
            source.releaseMode || profile.release?.mode || 'unknown'
        ),
        runtimeSource: toText(
            source.runtimeSource || profile.runtime_meta?.source || ''
        ),
        blockers,
    };
}

function buildRemoteReleaseModel(
    remoteReleaseState = {},
    remoteReleaseReadiness = {},
    fallback = {}
) {
    const readiness = normalizeObject(remoteReleaseReadiness);
    const source = normalizeObject(remoteReleaseState);
    const rawHealth = source.health || readiness.health || {};
    const publicSync =
        rawHealth?.payload?.checks?.publicSync ||
        source.checks?.publicSync ||
        readiness.checks?.publicSync ||
        {};
    const items = Array.isArray(readiness.items)
        ? readiness.items.filter(Boolean)
        : [];
    const itemMap = Object.fromEntries(items.map((item) => [item.id, item]));

    return {
        releaseStatus: toText(
            readiness.tone || readiness.state || source.state || 'warning',
            'warning'
        ),
        status: toText(
            readiness.state || readiness.tone || source.state || 'warning',
            'warning'
        ),
        finalState: toText(
            readiness.tone || readiness.state || source.state || 'warning',
            'warning'
        ),
        expectedClinicId: toText(
            source.clinicId || readiness.clinicId || fallback.clinicId || ''
        ),
        expectedProfileFingerprint: toText(
            source.profileFingerprint ||
                readiness.profileFingerprint ||
                fallback.profileFingerprint ||
                ''
        ),
        deployedCommit: toText(
            publicSync.deployedCommit || readiness.deployedCommit || ''
        ),
        publicSyncLabel: toText(
            itemMap.public_sync?.detail ||
                itemMap.public_sync?.label ||
                readiness.publicSyncLabel ||
                ''
        ),
        diagnosticsLabel: toText(
            itemMap.diagnostics?.detail ||
                itemMap.diagnostics?.label ||
                readiness.diagnosticsLabel ||
                ''
        ),
        figoLabel: toText(
            itemMap.figo?.detail ||
                itemMap.figo?.label ||
                readiness.figoLabel ||
                ''
        ),
        sourceHealthLabel: toText(
            [
                itemMap.availability?.detail,
                itemMap.booked_slots?.detail,
                readiness.sourceHealthLabel,
            ]
                .filter(Boolean)
                .join(' · ')
        ),
        blockers: items
            .filter((item) => item.state === 'alert')
            .map((item, index) => ({
                key: String(item.id || `remote_blocker_${index + 1}`),
                title: toText(item.label || item.title || 'Bloqueo'),
                detail: toText(item.detail || ''),
            })),
    };
}

function buildReleaseEvidenceBundleSnapshot(results = {}, options = {}) {
    const clinicProfile = normalizeObject(
        results.clinicProfile || results.turneroClinicProfile || {}
    );
    const pilotReadiness = buildPilotReadinessFromResult(
        results.pilotReadiness,
        {}
    );
    const remoteReleaseState = normalizeObject(results.remoteReleaseState);
    const remoteReleaseReadiness = normalizeRemoteReleaseReadiness(
        remoteReleaseState,
        {
            clinicId: toText(
                pilotReadiness.clinicId ||
                    results.remoteReleaseReadiness?.clinicId ||
                    ''
            ),
            profileFingerprint: toText(
                pilotReadiness.profileFingerprint ||
                    results.remoteReleaseReadiness?.profileFingerprint ||
                    ''
            ),
        }
    );
    const publicShellDrift = normalizePublicShellDrift(
        results.publicShellScan || results.publicShellDrift,
        options,
        {}
    );
    const localReadinessModel = buildLocalReadinessModel(
        pilotReadiness,
        clinicProfile
    );
    const remoteReleaseModel = buildRemoteReleaseModel(
        remoteReleaseState,
        remoteReleaseReadiness,
        {
            clinicId: localReadinessModel.clinicId,
            profileFingerprint: localReadinessModel.profileFingerprint,
        }
    );
    const generatedAt = toText(options.timestamp || nowIso(), nowIso());

    return {
        generatedAt,
        turneroClinicProfile: clinicProfile,
        pilotReadiness,
        remoteReleaseReadiness,
        publicShellDrift,
        localReadinessModel,
        remoteReleaseModel,
        publicShellDriftModel: publicShellDrift,
        releaseEvidenceBundle: {
            generatedAt,
            turneroClinicProfile: clinicProfile,
            pilotReadiness,
            remoteReleaseReadiness,
            publicShellDrift,
            localReadinessModel,
            remoteReleaseModel,
            publicShellDriftModel: publicShellDrift,
        },
    };
}

function composeControlCenterSnapshot(results = {}) {
    const clinicProfile = normalizeObject(
        results.clinicProfile || results.turneroClinicProfile || {}
    );
    const pilotReadiness = buildPilotReadinessFromResult(
        results.pilotReadiness,
        {}
    );
    const remoteReleaseReadiness = normalizeRemoteReleaseReadiness(
        results.remoteReleaseState || results.remoteReleaseReadiness,
        {
            clinicId: toText(pilotReadiness.clinicId || ''),
            profileFingerprint: toText(pilotReadiness.profileFingerprint || ''),
        }
    );
    const publicShellDrift = normalizePublicShellDrift(
        results.publicShellScan || results.publicShellDrift,
        {},
        {}
    );
    const releaseEvidenceBundle = normalizeObject(
        results.releaseEvidenceBundle?.releaseEvidenceBundle ||
            results.releaseEvidenceBundle ||
            {}
    );

    return toReleaseControlCenterSnapshot({
        clinicProfile,
        turneroClinicProfile: clinicProfile,
        pilotReadiness,
        remoteReleaseReadiness,
        publicShellDrift,
        releaseEvidenceBundle,
        clinicId: pilotReadiness.clinicId || remoteReleaseReadiness.clinicId,
        profileFingerprint:
            pilotReadiness.profileFingerprint ||
            remoteReleaseReadiness.profileFingerprint,
        releaseMode: pilotReadiness.releaseMode || clinicProfile.release?.mode,
    });
}

function buildDefaultHandoff(playbook, snapshot) {
    const summary = playbook.summary || {};
    const ownerRows = Array.isArray(playbook.ownerBreakdown)
        ? playbook.ownerBreakdown
        : [];
    const incidents = Array.isArray(playbook.incidents)
        ? playbook.incidents
        : [];

    return [
        '# Turnero Release Ops Handoff',
        '',
        `- Decision: ${toText(playbook.decision, 'review')}`,
        `- Summary: ${toText(playbook.summaryText || playbook.evidenceSummary || '')}`,
        `- Counts: blocker=${Number(summary.blocker || 0)}, warning=${Number(
            summary.warning || 0
        )}, info=${Number(summary.info || 0)}`,
        `- Clinic: ${toText(playbook.clinicName || snapshot.clinicName)} (${toText(
            playbook.clinicId || snapshot.clinicId || 'unknown'
        )})`,
        `- Fingerprint: ${toText(
            playbook.profileFingerprint || snapshot.profileFingerprint || ''
        )}`,
        '',
        '## Owner Breakdown',
        ...(ownerRows.length
            ? ownerRows.map(
                  (row) =>
                      `- ${toText(row.label || row.owner)}: blocker=${Number(
                          row.blocker || 0
                      )}, warning=${Number(row.warning || 0)}, info=${Number(
                          row.info || 0
                      )}`
              )
            : ['- Sin owners pendientes.']),
        '',
        '## Incidents',
        ...(incidents.length
            ? incidents.map(
                  (incident) =>
                      `- [${toText(incident.severity, 'info')}] ${toText(
                          incident.title || 'Incidente'
                      )}: ${toText(incident.detail || '')}`
              )
            : ['- Sin incidentes.']),
        '',
        '## Next Step',
        playbook.decision === 'ready'
            ? '- Liberate la release.'
            : playbook.decision === 'review'
              ? '- Revisa las señales warning antes de liberar.'
              : '- Corrige los bloqueos hold antes de liberar.',
    ].join('\n');
}

function buildDefaultPack(
    snapshot,
    playbook,
    journalEntries = [],
    runnerState = {}
) {
    return {
        surface: 'admin_queue',
        generatedAt: nowIso(),
        clinicProfile:
            snapshot.parts?.clinicProfile ||
            snapshot.turneroClinicProfile ||
            {},
        turneroClinicProfile:
            snapshot.parts?.clinicProfile ||
            snapshot.turneroClinicProfile ||
            {},
        clinicId: toText(playbook.clinicId || snapshot.clinicId || ''),
        profileFingerprint: toText(
            playbook.profileFingerprint || snapshot.profileFingerprint || ''
        ),
        pilotReadiness:
            snapshot.parts?.pilotReadiness || snapshot.pilotReadiness || {},
        remoteReleaseReadiness:
            snapshot.parts?.remoteReleaseReadiness ||
            snapshot.remoteReleaseReadiness ||
            {},
        publicShellDrift:
            snapshot.parts?.publicShellDrift || snapshot.publicShellDrift || {},
        releaseEvidenceBundle:
            snapshot.parts?.releaseEvidenceBundle ||
            snapshot.releaseEvidenceBundle ||
            {},
        playbook,
        incidentJournal: journalEntries,
        runnerState: {
            inFlight: Boolean(runnerState.inFlight),
            lastRunAt: toText(runnerState.lastRunAt || ''),
            lastAction: toText(runnerState.lastAction || ''),
            lastError: normalizeObject(runnerState.lastError),
        },
        decision: toText(playbook.decision || 'review'),
        decisionReason: toText(playbook.decisionReason || ''),
        summary: normalizeObject(playbook.summary),
        summaryText: toText(playbook.summaryText || ''),
    };
}

function runAction(state, action, handler) {
    state.inFlight = true;
    state.lastAction = action;
    state.lastError = null;

    return Promise.resolve()
        .then(handler)
        .then((result) => {
            if (result && result.ok === false) {
                state.lastError = normalizeError(
                    result.error || result,
                    action
                );
            }
            state.lastRunAt = nowIso();
            state.inFlight = false;
            return result;
        })
        .catch((error) => {
            state.lastError = normalizeError(error, action);
            state.lastRunAt = nowIso();
            state.inFlight = false;
            return {
                ok: false,
                error: state.lastError,
            };
        });
}

function normalizeInitialResults(options = {}) {
    const snapshot = normalizeObject(
        options.snapshot || options.initialSnapshot
    );
    const clinicProfile = normalizeObject(
        options.clinicProfile ||
            snapshot.parts?.clinicProfile ||
            snapshot.turneroClinicProfile ||
            snapshot.clinicProfile ||
            {}
    );
    const pilotReadiness = buildPilotReadinessFromResult(
        options.pilotReadiness ||
            snapshot.parts?.pilotReadiness ||
            snapshot.pilotReadiness ||
            {},
        { clinicProfile }
    );
    const remoteReleaseState = normalizeObject(
        options.remoteReleaseState ||
            snapshot.parts?.remoteReleaseReadiness ||
            snapshot.remoteReleaseState ||
            {}
    );
    const remoteReleaseReadiness = normalizeRemoteReleaseReadiness(
        options.remoteReleaseReadiness ||
            snapshot.parts?.remoteReleaseReadiness ||
            snapshot.remoteReleaseReadiness ||
            remoteReleaseState,
        {
            clinicId: toText(pilotReadiness.clinicId || ''),
            profileFingerprint: toText(pilotReadiness.profileFingerprint || ''),
        }
    );
    const publicShellScan = normalizeObject(
        options.publicShellScan ||
            snapshot.parts?.publicShellDrift ||
            snapshot.publicShellScan ||
            {}
    );
    const publicShellDrift = normalizePublicShellDrift(
        options.publicShellDrift ||
            snapshot.parts?.publicShellDrift ||
            snapshot.publicShellDrift ||
            publicShellScan,
        options,
        {}
    );
    const releaseEvidenceBundle = normalizeObject(
        options.releaseEvidenceBundle ||
            snapshot.parts?.releaseEvidenceBundle ||
            snapshot.releaseEvidenceBundle ||
            {}
    );
    const playbook = normalizeObject(
        options.playbook || snapshot.playbook || snapshot.parts?.playbook || {}
    );
    const pack = normalizeObject(options.pack || snapshot.pack || {});
    const incidentJournal = Array.isArray(
        options.incidentJournal || snapshot.incidentJournal
    )
        ? (options.incidentJournal || snapshot.incidentJournal).filter(Boolean)
        : [];

    return {
        clinicProfile,
        pilotReadiness,
        remoteReleaseState,
        remoteReleaseReadiness,
        publicShellScan,
        publicShellDrift,
        releaseEvidenceBundle,
        playbook,
        pack,
        incidentJournal,
    };
}

async function loadPilotReadiness(options, state, providers) {
    const provider = getProvider(providers, [
        'refreshPilotReadiness',
        'loadPilotReadiness',
        'getPilotReadiness',
        'buildPilotReadiness',
    ]);

    if (provider) {
        const raw = await provider({
            state: { ...state },
            snapshot: composeControlCenterSnapshot(state.results),
            options,
        });
        const response = normalizeProviderResponse(
            raw,
            'refreshPilotReadiness'
        );
        const pilotReadiness = buildPilotReadinessFromResult(
            response.source,
            state.results.pilotReadiness
        );
        return {
            ok: response.ok,
            error: response.error,
            pilotReadiness,
        };
    }

    const apiBase = toText(options.apiBase, '/api.php');
    const fetchImpl =
        typeof options.fetchImpl === 'function'
            ? options.fetchImpl
            : typeof globalThis !== 'undefined' &&
                typeof globalThis.fetch === 'function'
              ? globalThis.fetch.bind(globalThis)
              : null;
    const endpoint =
        toText(options.pilotReadinessUrl, '') ||
        buildApiUrl(
            toText(options.pilotReadinessResource, 'turnero-pilot-readiness'),
            {
                clinicId: state.results.pilotReadiness?.clinicId || '',
                profileFingerprint:
                    state.results.pilotReadiness?.profileFingerprint || '',
            },
            apiBase
        );
    const response = await fetchJsonResource(fetchImpl, endpoint, {
        method: 'GET',
        headers: { Accept: 'application/json' },
    });
    const pilotReadiness = buildPilotReadinessFromResult(
        response.payload,
        state.results.pilotReadiness
    );

    return {
        ok: response.ok,
        error: response.ok
            ? null
            : normalizeError(response, 'refreshPilotReadiness'),
        pilotReadiness,
    };
}

async function loadRemoteRelease(options, state, providers) {
    const provider = getProvider(providers, [
        'refreshRemoteRelease',
        'loadRemoteRelease',
        'getRemoteRelease',
        'loadTurneroRemoteReleaseHealth',
    ]);

    if (provider) {
        const raw = await provider({
            state: { ...state },
            snapshot: composeControlCenterSnapshot(state.results),
            options,
        });
        const response = normalizeProviderResponse(raw, 'refreshRemoteRelease');
        const remoteReleaseReadiness = normalizeRemoteReleaseReadiness(
            response.source,
            {
                clinicId: state.results.pilotReadiness?.clinicId || '',
                profileFingerprint:
                    state.results.pilotReadiness?.profileFingerprint || '',
            }
        );
        return {
            ok: response.ok,
            error: response.error,
            remoteReleaseState: response.source,
            remoteReleaseReadiness,
        };
    }

    const remoteState = await loadTurneroRemoteReleaseHealth({
        clinicId: state.results.pilotReadiness?.clinicId || '',
        profileFingerprint:
            state.results.pilotReadiness?.profileFingerprint || '',
        apiBase: options.apiBase,
        doctor: options.doctor,
        service: options.service,
        days: options.days,
        timeZone: options.timeZone,
        fetchImpl: options.fetchImpl,
    });
    const remoteReleaseReadiness =
        createTurneroRemoteReleaseReadinessModel(remoteState);

    return {
        ok: true,
        remoteReleaseState: remoteState,
        remoteReleaseReadiness,
    };
}

async function loadPublicShellDrift(options, state, providers) {
    const provider = getProvider(providers, [
        'refreshPublicShellDrift',
        'loadPublicShellDrift',
        'getPublicShellDrift',
    ]);

    if (provider) {
        const raw = await provider({
            state: { ...state },
            snapshot: composeControlCenterSnapshot(state.results),
            options,
        });
        const response = normalizeProviderResponse(
            raw,
            'refreshPublicShellDrift'
        );
        const publicShellDrift = normalizePublicShellDrift(
            response.source,
            options,
            state.results.publicShellDrift
        );
        const publicShellScan = normalizeObject(
            response.source.pageOk !== undefined ? response.source : {}
        );
        return {
            ok: response.ok,
            error: response.error,
            publicShellScan,
            publicShellDrift,
        };
    }

    const publicShellScan = await loadTurneroPublicShellHtml(
        options.publicShellOptions || {}
    );
    const publicShellDrift = createTurneroPublicShellDriftModel(
        {
            pageOk: publicShellScan.ok,
            pageStatus: publicShellScan.pageStatus,
            html: publicShellScan.html,
        },
        options.publicShellOptions || {}
    );

    return {
        ok: true,
        publicShellScan,
        publicShellDrift,
    };
}

async function loadEvidenceBundle(options, state, providers) {
    const provider = getProvider(providers, [
        'refreshEvidenceBundle',
        'loadEvidenceBundle',
        'buildEvidenceBundle',
    ]);

    if (provider) {
        const raw = await provider({
            state: { ...state, results: { ...state.results } },
            snapshot: composeControlCenterSnapshot(state.results),
            options,
        });
        const response = normalizeProviderResponse(
            raw,
            'refreshEvidenceBundle'
        );
        const releaseEvidenceBundle = normalizeObject(
            response.source.releaseEvidenceBundle || response.source
        );
        return {
            ok: response.ok,
            error: response.error,
            releaseEvidenceBundle,
            snapshot: normalizeObject(
                response.source.snapshot || response.source
            ),
        };
    }

    const snapshot = buildReleaseEvidenceBundleSnapshot(state.results, options);
    return {
        ok: true,
        releaseEvidenceBundle: snapshot.releaseEvidenceBundle,
        snapshot,
    };
}

async function loadPlaybook(options, state, providers) {
    const provider = getProvider(providers, [
        'recalculateDecision',
        'buildPlaybook',
        'loadPlaybook',
    ]);

    if (provider) {
        const raw = await provider({
            state: { ...state, results: { ...state.results } },
            snapshot: composeControlCenterSnapshot(state.results),
            options,
        });
        const response = normalizeProviderResponse(raw, 'recalculateDecision');
        const playbook = normalizeObject(
            response.source.playbook || response.source
        );
        return {
            ok: response.ok,
            error: response.error,
            playbook,
        };
    }

    const playbook = buildTurneroReleaseConsolePlaybook(
        composeControlCenterSnapshot(state.results)
    );
    return {
        ok: true,
        playbook,
    };
}

function buildDefaultFileName(playbook) {
    const clinicId = toText(playbook.clinicId || 'default-clinic')
        .replace(/[^a-z0-9._-]+/gi, '-')
        .replace(/-+/g, '-')
        .replace(/^-|-$/g, '')
        .toLowerCase();
    const datePart = nowIso().slice(0, 10).replaceAll('-', '');
    return `turnero-release-ops-pack-${clinicId || 'default-clinic'}-${datePart}.json`;
}

export function createTurneroReleaseActionsRunner(options = {}) {
    const providers = getProviders(options);
    const state = {
        inFlight: false,
        lastRunAt: toText(options.lastRunAt || ''),
        lastAction: '',
        lastError: null,
        results: normalizeInitialResults(options),
    };

    async function refreshPilotReadiness() {
        return runAction(state, 'refreshPilotReadiness', async () => {
            const result = await loadPilotReadiness(options, state, providers);
            if (result.pilotReadiness) {
                state.results.pilotReadiness = result.pilotReadiness;
                if (result.pilotReadiness.clinicProfile) {
                    state.results.clinicProfile =
                        result.pilotReadiness.clinicProfile;
                }
            }
            return result;
        });
    }

    async function refreshRemoteRelease() {
        return runAction(state, 'refreshRemoteRelease', async () => {
            const result = await loadRemoteRelease(options, state, providers);
            if (result.remoteReleaseState) {
                state.results.remoteReleaseState = result.remoteReleaseState;
            }
            if (result.remoteReleaseReadiness) {
                state.results.remoteReleaseReadiness =
                    result.remoteReleaseReadiness;
            }
            return result;
        });
    }

    async function refreshPublicShellDrift() {
        return runAction(state, 'refreshPublicShellDrift', async () => {
            const result = await loadPublicShellDrift(
                options,
                state,
                providers
            );
            if (result.publicShellScan) {
                state.results.publicShellScan = result.publicShellScan;
            }
            if (result.publicShellDrift) {
                state.results.publicShellDrift = result.publicShellDrift;
            }
            return result;
        });
    }

    async function refreshEvidenceBundle() {
        return runAction(state, 'refreshEvidenceBundle', async () => {
            const result = await loadEvidenceBundle(options, state, providers);
            if (result.releaseEvidenceBundle) {
                state.results.releaseEvidenceBundle =
                    result.releaseEvidenceBundle;
            }
            if (result.snapshot) {
                state.results.evidenceSnapshot = result.snapshot;
            }
            return result;
        });
    }

    async function recalculateDecision() {
        return runAction(state, 'recalculateDecision', async () => {
            const result = await loadPlaybook(options, state, providers);
            if (result.playbook) {
                state.results.playbook = result.playbook;
            }
            return result;
        });
    }

    async function refreshAll() {
        return runAction(state, 'refreshAll', async () => {
            const safeLoad = async (action, loader) => {
                try {
                    return await loader();
                } catch (error) {
                    return {
                        ok: false,
                        error: normalizeError(error, action),
                    };
                }
            };

            const [pilotResult, remoteResult, shellResult] = await Promise.all([
                safeLoad('refreshPilotReadiness', () =>
                    loadPilotReadiness(options, state, providers)
                ),
                safeLoad('refreshRemoteRelease', () =>
                    loadRemoteRelease(options, state, providers)
                ),
                safeLoad('refreshPublicShellDrift', () =>
                    loadPublicShellDrift(options, state, providers)
                ),
            ]);

            if (pilotResult.pilotReadiness) {
                state.results.pilotReadiness = pilotResult.pilotReadiness;
                if (pilotResult.pilotReadiness.clinicProfile) {
                    state.results.clinicProfile =
                        pilotResult.pilotReadiness.clinicProfile;
                }
            }
            if (remoteResult.remoteReleaseState) {
                state.results.remoteReleaseState =
                    remoteResult.remoteReleaseState;
            }
            if (remoteResult.remoteReleaseReadiness) {
                state.results.remoteReleaseReadiness =
                    remoteResult.remoteReleaseReadiness;
            }
            if (shellResult.publicShellScan) {
                state.results.publicShellScan = shellResult.publicShellScan;
            }
            if (shellResult.publicShellDrift) {
                state.results.publicShellDrift = shellResult.publicShellDrift;
            }

            const evidenceResult = await safeLoad('refreshEvidenceBundle', () =>
                loadEvidenceBundle(options, state, providers)
            );
            if (evidenceResult.releaseEvidenceBundle) {
                state.results.releaseEvidenceBundle =
                    evidenceResult.releaseEvidenceBundle;
            }
            const playbookResult = await safeLoad('recalculateDecision', () =>
                loadPlaybook(options, state, providers)
            );
            if (playbookResult.playbook) {
                state.results.playbook = playbookResult.playbook;
            }

            const failures = [
                pilotResult,
                remoteResult,
                shellResult,
                evidenceResult,
                playbookResult,
            ].filter((result) => result && result.ok === false);
            const firstFailure = failures[0] || null;

            return {
                ok:
                    Boolean(pilotResult.ok) &&
                    Boolean(remoteResult.ok) &&
                    Boolean(shellResult.ok) &&
                    Boolean(evidenceResult.ok) &&
                    Boolean(playbookResult.ok),
                error: firstFailure ? firstFailure.error || firstFailure : null,
                pilotReadiness: pilotResult.pilotReadiness,
                remoteReleaseState: remoteResult.remoteReleaseState,
                remoteReleaseReadiness: remoteResult.remoteReleaseReadiness,
                publicShellScan: shellResult.publicShellScan,
                publicShellDrift: shellResult.publicShellDrift,
                releaseEvidenceBundle: evidenceResult.releaseEvidenceBundle,
                playbook: playbookResult.playbook,
            };
        });
    }

    async function copyHandoff() {
        return runAction(state, 'copyHandoff', async () => {
            const playbookResult = state.results.playbook
                ? { ok: true, playbook: state.results.playbook }
                : await loadPlaybook(options, state, providers);
            const playbook =
                playbookResult.playbook || state.results.playbook || {};
            const snapshot = composeControlCenterSnapshot(state.results);
            const provider = getProvider(providers, [
                'buildHandoff',
                'copyHandoffText',
            ]);
            const text = provider
                ? await provider({
                      state: { ...state, results: { ...state.results } },
                      snapshot,
                      playbook,
                      options,
                  })
                : buildDefaultHandoff(playbook, snapshot);
            const copyProvider = getProvider(providers, [
                'copyToClipboard',
                'copyText',
            ]);
            const copied = copyProvider
                ? await copyProvider(text, {
                      state: { ...state, results: { ...state.results } },
                      snapshot,
                      playbook,
                      options,
                  })
                : await copyToClipboardSafe(text);

            return {
                ok: copied !== false,
                copied: copied !== false,
                text,
            };
        });
    }

    async function downloadPack() {
        return runAction(state, 'downloadPack', async () => {
            const playbookResult = state.results.playbook
                ? { ok: true, playbook: state.results.playbook }
                : await loadPlaybook(options, state, providers);
            const playbook =
                playbookResult.playbook || state.results.playbook || {};
            const snapshot = composeControlCenterSnapshot(state.results);
            const journalEntries = Array.isArray(state.results.incidentJournal)
                ? state.results.incidentJournal
                : [];
            const provider = getProvider(providers, [
                'buildPack',
                'downloadPackPayload',
            ]);
            const pack = provider
                ? await provider({
                      state: { ...state, results: { ...state.results } },
                      snapshot,
                      playbook,
                      journalEntries,
                      options,
                  })
                : buildDefaultPack(snapshot, playbook, journalEntries, state);
            const downloadProvider = getProvider(providers, [
                'downloadJsonSnapshot',
                'downloadSnapshot',
            ]);
            const filename = toText(
                pack.filename || pack.fileName,
                buildDefaultFileName(playbook)
            );
            const payload = pack.pack || pack.payload || pack;
            const downloaded = downloadProvider
                ? await downloadProvider(filename, payload)
                : downloadJsonSnapshot(filename, payload);

            state.results.pack = payload;

            return {
                ok: downloaded !== false,
                downloaded: downloaded !== false,
                filename,
                pack: payload,
            };
        });
    }

    return {
        state,
        getState: () => state,
        refreshPilotReadiness,
        refreshRemoteRelease,
        refreshPublicShellDrift,
        refreshEvidenceBundle,
        refreshAll,
        recalculateDecision,
        copyHandoff,
        downloadPack,
    };
}

export default createTurneroReleaseActionsRunner;
