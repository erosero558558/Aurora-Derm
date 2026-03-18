const DEFAULT_API_BASE = '/api.php';
const DEFAULT_DOCTOR = 'indiferente';
const DEFAULT_SERVICE = 'consulta';
const DEFAULT_DAYS = 1;
const DEFAULT_TIME_ZONE = 'America/Guayaquil';

function toText(value, fallback = '') {
    const normalized = String(value ?? '').trim();
    return normalized || fallback;
}

function isPlainObject(value) {
    return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function normalizeObject(value) {
    return isPlainObject(value) ? value : {};
}

function escapeHtml(value) {
    return String(value ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function shortCommit(value) {
    const normalized = toText(value);
    return normalized ? normalized.slice(0, 8) : '';
}

function lowerText(value) {
    return toText(value).toLowerCase();
}

function isDomElement(value) {
    return typeof HTMLElement !== 'undefined' && value instanceof HTMLElement;
}

function joinDetails(parts) {
    return parts.filter(Boolean).join(' · ');
}

function formatAge(value, expectedMaxLagSeconds) {
    const age = Number(value);
    const maxLag = Number(expectedMaxLagSeconds);
    const ageText = Number.isFinite(age) ? `${age}s` : '';
    const maxText = Number.isFinite(maxLag) ? `${maxLag}s` : '';

    if (ageText && maxText) {
        return `${ageText}/${maxText}`;
    }

    return ageText || maxText;
}

function countAvailabilitySlots(data) {
    if (Array.isArray(data)) {
        return {
            days: data.length,
            slots: data.reduce((count, value) => {
                return count + (Array.isArray(value) ? value.length : 0);
            }, 0),
        };
    }

    const normalized = normalizeObject(data);
    let days = 0;
    let slots = 0;

    for (const value of Object.values(normalized)) {
        if (!Array.isArray(value)) {
            continue;
        }

        days += 1;
        slots += value.length;
    }

    return { days, slots };
}

function countBookedSlots(data) {
    return Array.isArray(data) ? data.length : 0;
}

function buildApiUrl(resource, params = {}, apiBase = DEFAULT_API_BASE) {
    const searchParams = new URLSearchParams();
    searchParams.set('resource', resource);

    for (const [key, rawValue] of Object.entries(params)) {
        const value = toText(rawValue);
        if (value !== '') {
            searchParams.set(key, value);
        }
    }

    return `${toText(apiBase, DEFAULT_API_BASE)}?${searchParams.toString()}`;
}

function normalizeDateValue(value, timeZone = DEFAULT_TIME_ZONE) {
    if (value && /^\d{4}-\d{2}-\d{2}$/.test(String(value).trim())) {
        return String(value).trim();
    }

    const date = value instanceof Date ? value : new Date();
    try {
        const formatter = new Intl.DateTimeFormat('en-CA', {
            timeZone,
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
        });
        const parts = formatter.formatToParts(date);
        const year = parts.find((part) => part.type === 'year')?.value || '';
        const month = parts.find((part) => part.type === 'month')?.value || '';
        const day = parts.find((part) => part.type === 'day')?.value || '';
        if (year && month && day) {
            return `${year}-${month}-${day}`;
        }
        return formatter.format(date);
    } catch (_error) {
        return date.toISOString().slice(0, 10);
    }
}

function normalizeLoadedEndpoint(resource, input) {
    if (!isPlainObject(input)) {
        return {
            resource,
            kind: 'unavailable',
            ok: false,
            status: 0,
            payload: {},
            meta: {},
            error: '',
            code: '',
        };
    }

    const looksLikeLoadedResult =
        Object.prototype.hasOwnProperty.call(input, 'kind') ||
        Object.prototype.hasOwnProperty.call(input, 'payload') ||
        Object.prototype.hasOwnProperty.call(input, 'status') ||
        Object.prototype.hasOwnProperty.call(input, 'ok');

    if (!looksLikeLoadedResult) {
        return {
            resource,
            kind: 'ok',
            ok: true,
            status: 200,
            payload: input,
            meta: normalizeObject(input.meta),
            error: '',
            code: '',
        };
    }

    const payload = normalizeObject(input.payload);
    const meta = normalizeObject(input.meta || payload.meta);
    const status = Number(input.status || 0);
    const ok = input.ok === true || input.kind === 'ok';

    return {
        resource,
        kind: toText(input.kind, ok ? 'ok' : 'unavailable'),
        ok,
        status,
        payload,
        meta,
        error: toText(input.error || payload.error),
        code: toText(input.code || payload.code),
    };
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
            kind: 'unavailable',
            ok: false,
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
                        kind: 'unavailable',
                        ok: false,
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
                kind: 'ok',
                ok: true,
                status,
                payload: isPlainObject(payload) ? payload : {},
                error: '',
                code: '',
            };
        }

        if (status === 401 || status === 403) {
            return {
                kind: 'denied',
                ok: false,
                status,
                payload: isPlainObject(payload) ? payload : {},
                error: toText(payload?.error, `HTTP ${status}`),
                code: toText(payload?.code, 'access_denied'),
            };
        }

        return {
            kind: 'unavailable',
            ok: false,
            status,
            payload: isPlainObject(payload) ? payload : {},
            error: toText(payload?.error, `HTTP ${status}`),
            code: toText(payload?.code, 'request_failed'),
        };
    } catch (error) {
        return {
            kind: 'unavailable',
            ok: false,
            status: 0,
            payload: {},
            error: error instanceof Error ? error.message : toText(error),
            code: 'request_failed',
        };
    }
}

function buildSignal(id, label, state, detail) {
    return {
        id,
        label,
        state,
        detail: toText(detail),
    };
}

function buildDiagnosticsSignal(diagnostics) {
    if (diagnostics.kind === 'denied') {
        return buildSignal(
            'diagnostics',
            'Diagnóstico remoto',
            'alert',
            'health-diagnostics quedó denegado (403) y no permite validar el release remoto.'
        );
    }

    if (diagnostics.kind !== 'ok') {
        return buildSignal(
            'diagnostics',
            'Diagnóstico remoto',
            'alert',
            joinDetails([
                'health-diagnostics no disponible.',
                diagnostics.error ? `Detalle: ${diagnostics.error}` : '',
            ])
        );
    }

    const checks = normalizeObject(diagnostics.payload.checks);
    const turneroPilot = normalizeObject(checks.turneroPilot);
    const publicSync = normalizeObject(checks.publicSync);

    if (
        Object.keys(turneroPilot).length === 0 ||
        Object.keys(publicSync).length === 0
    ) {
        return buildSignal(
            'diagnostics',
            'Diagnóstico remoto',
            'alert',
            'health-diagnostics respondió, pero faltan checks.turneroPilot o checks.publicSync.'
        );
    }

    return buildSignal(
        'diagnostics',
        'Diagnóstico remoto',
        'ready',
        'health-diagnostics autorizado con turneroPilot y publicSync completos.'
    );
}

function buildIdentitySignal(
    diagnostics,
    expectedClinicId,
    expectedProfileFingerprint
) {
    if (diagnostics.kind !== 'ok') {
        return buildSignal(
            'identity',
            'Identidad remota',
            'warning',
            'Pendiente de health-diagnostics para comparar clinicId y profileFingerprint.'
        );
    }

    const checks = normalizeObject(diagnostics.payload.checks);
    const turneroPilot = normalizeObject(checks.turneroPilot);
    const issues = [];

    if (turneroPilot.available === false) {
        issues.push('turneroPilot.available=false');
    }

    if (turneroPilot.configured === false) {
        issues.push('turneroPilot.configured=false');
    }

    if (turneroPilot.ready === false) {
        issues.push('turneroPilot.ready=false');
    }

    if (turneroPilot.catalogReady === false) {
        issues.push('turneroPilot.catalogReady=false');
    }

    if (
        turneroPilot.profileSource &&
        toText(turneroPilot.profileSource) !== 'file'
    ) {
        issues.push(`profileSource=${toText(turneroPilot.profileSource)}`);
    }

    if (
        expectedClinicId &&
        lowerText(turneroPilot.clinicId) !== lowerText(expectedClinicId)
    ) {
        issues.push(
            `clinicId ${toText(turneroPilot.clinicId)} != ${toText(
                expectedClinicId
            )}`
        );
    }

    if (
        expectedProfileFingerprint &&
        toText(turneroPilot.profileFingerprint) !==
            toText(expectedProfileFingerprint)
    ) {
        issues.push(
            `profileFingerprint ${toText(
                turneroPilot.profileFingerprint
            )} != ${toText(expectedProfileFingerprint)}`
        );
    }

    if (issues.length > 0) {
        return buildSignal(
            'identity',
            'Identidad clínica',
            'alert',
            joinDetails(issues)
        );
    }

    return buildSignal(
        'identity',
        'Identidad clínica',
        'ready',
        joinDetails([
            turneroPilot.clinicId ? `clinicId ${turneroPilot.clinicId}` : '',
            turneroPilot.profileFingerprint
                ? `profileFingerprint ${turneroPilot.profileFingerprint}`
                : '',
            turneroPilot.ready === true ? 'turneroPilot listo' : '',
        ])
    );
}

function buildPublicSyncSignal(health) {
    if (health.kind !== 'ok') {
        return buildSignal(
            'public_sync',
            'Publicación remota',
            'alert',
            joinDetails([
                'No se pudo leer `/health`.',
                health.error ? `Detalle: ${health.error}` : '',
            ])
        );
    }

    const checks = normalizeObject(health.payload.checks);
    const publicSync = normalizeObject(checks.publicSync);

    if (Object.keys(publicSync).length === 0) {
        return buildSignal(
            'public_sync',
            'Publicación remota',
            'alert',
            'El host no expone checks.publicSync en `/health`.'
        );
    }

    const issues = [];

    if (publicSync.configured !== true) {
        issues.push('configured=false');
    }

    if (publicSync.healthy !== true) {
        issues.push(
            `healthy=false${publicSync.state ? ` (${publicSync.state})` : ''}`
        );
    }

    if (publicSync.operationallyHealthy === false) {
        issues.push('operationallyHealthy=false');
    }

    if (publicSync.repoHygieneIssue === true) {
        issues.push('repoHygieneIssue=true');
    }

    if (publicSync.headDrift === true) {
        issues.push('headDrift=true');
    }

    if (!toText(publicSync.deployedCommit)) {
        issues.push('deployedCommit ausente');
    }

    if (issues.length > 0) {
        return buildSignal(
            'public_sync',
            'Publicación remota',
            'alert',
            joinDetails(issues)
        );
    }

    return buildSignal(
        'public_sync',
        'Publicación remota',
        'ready',
        joinDetails([
            `commit ${shortCommit(publicSync.deployedCommit)}`,
            formatAge(publicSync.ageSeconds, publicSync.expectedMaxLagSeconds),
            publicSync.state ? `state=${publicSync.state}` : '',
        ])
    );
}

function buildFigoSignal(diagnostics) {
    if (diagnostics.kind !== 'ok') {
        return buildSignal(
            'figo',
            'Figo',
            'warning',
            'Pendiente de health-diagnostics para validar figoConfigured y figoRecursiveConfig.'
        );
    }

    const issues = [];
    const payload = normalizeObject(diagnostics.payload);

    if (payload.figoConfigured === false) {
        issues.push('figoConfigured=false');
    }

    if (payload.figoRecursiveConfig === true) {
        issues.push('figoRecursiveConfig=true');
    }

    if (issues.length > 0) {
        return buildSignal('figo', 'Figo', 'alert', joinDetails(issues));
    }

    return buildSignal(
        'figo',
        'Figo',
        'ready',
        'figoConfigured y figoRecursiveConfig no reportan degradación.'
    );
}

function buildAvailabilitySignal(availability) {
    if (availability.kind !== 'ok') {
        return buildSignal(
            'availability',
            'Disponibilidad',
            'alert',
            joinDetails([
                'No se pudo leer `/availability`.',
                availability.error ? `Detalle: ${availability.error}` : '',
            ])
        );
    }

    const meta = normalizeObject(availability.payload.meta);
    const source = toText(meta.source, 'store');
    const slots = countAvailabilitySlots(availability.payload.data);

    if (source === 'fallback' || meta.degraded === true) {
        return buildSignal(
            'availability',
            'Disponibilidad',
            'alert',
            joinDetails([
                `source=${source}`,
                meta.mode ? `mode=${meta.mode}` : '',
                meta.degraded === true ? 'degraded=true' : '',
            ])
        );
    }

    return buildSignal(
        'availability',
        'Disponibilidad',
        'ready',
        joinDetails([
            `source=${source}`,
            `${slots.days} día(s)`,
            `${slots.slots} slot(s)`,
        ])
    );
}

function buildBookedSlotsSignal(bookedSlots) {
    if (bookedSlots.kind !== 'ok') {
        return buildSignal(
            'booked_slots',
            'Horarios ocupados',
            'alert',
            joinDetails([
                'No se pudo leer `/booked-slots`.',
                bookedSlots.error ? `Detalle: ${bookedSlots.error}` : '',
            ])
        );
    }

    const meta = normalizeObject(bookedSlots.payload.meta);
    const source = toText(meta.source, 'store');
    const bookedCount = countBookedSlots(bookedSlots.payload.data);

    if (source === 'fallback' || meta.degraded === true) {
        return buildSignal(
            'booked_slots',
            'Horarios ocupados',
            'alert',
            joinDetails([
                `source=${source}`,
                meta.mode ? `mode=${meta.mode}` : '',
                meta.degraded === true ? 'degraded=true' : '',
            ])
        );
    }

    return buildSignal(
        'booked_slots',
        'Horarios ocupados',
        'ready',
        joinDetails([
            `source=${source}`,
            `${bookedCount} horario(s) ocupado(s)`,
        ])
    );
}

function buildFallbackModel(input, message) {
    const clinicId = toText(input.clinicId);
    const profileFingerprint = toText(input.profileFingerprint);

    return createTurneroRemoteReleaseReadinessModel({
        clinicId,
        profileFingerprint,
        health: {
            kind: 'unavailable',
            status: 0,
            error: message,
        },
        diagnostics: {
            kind: 'unavailable',
            status: 0,
            error: message,
        },
        availability: {
            kind: 'unavailable',
            status: 0,
            error: message,
        },
        bookedSlots: {
            kind: 'unavailable',
            status: 0,
            error: message,
        },
        loadedAt: new Date().toISOString(),
    });
}

export function createTurneroRemoteReleaseReadinessModel(input = {}) {
    const clinicId = toText(
        input.clinicId || input.expectedClinicId || input.identity?.clinicId
    );
    const profileFingerprint = toText(
        input.profileFingerprint ||
            input.expectedProfileFingerprint ||
            input.identity?.profileFingerprint
    );
    const health = normalizeLoadedEndpoint('health', input.health);
    const diagnostics = normalizeLoadedEndpoint(
        'health-diagnostics',
        input.diagnostics
    );
    const availability = normalizeLoadedEndpoint(
        'availability',
        input.availability
    );
    const bookedSlots = normalizeLoadedEndpoint(
        'booked-slots',
        input.bookedSlots
    );

    const diagnosticsSignal = buildDiagnosticsSignal(diagnostics);
    const identitySignal = buildIdentitySignal(
        diagnostics,
        clinicId,
        profileFingerprint
    );
    const publicSyncSignal = buildPublicSyncSignal(health);
    const figoSignal = buildFigoSignal(diagnostics);
    const availabilitySignal = buildAvailabilitySignal(availability);
    const bookedSlotsSignal = buildBookedSlotsSignal(bookedSlots);

    const items = [
        diagnosticsSignal,
        identitySignal,
        publicSyncSignal,
        figoSignal,
        availabilitySignal,
        bookedSlotsSignal,
    ];
    const alertCount = items.filter((item) => item.state === 'alert').length;
    const warningCount = items.filter(
        (item) => item.state === 'warning'
    ).length;
    const tone =
        alertCount > 0 ? 'alert' : warningCount > 0 ? 'warning' : 'ready';
    const state = tone === 'ready' ? 'ready' : 'blocked';
    const ready = state === 'ready';
    const primaryIssue =
        items.find((item) => item.state === 'alert') ||
        items.find((item) => item.state === 'warning') ||
        items[0] ||
        null;

    let statusLabel = 'Listo';
    if (alertCount > 0) {
        statusLabel = `${alertCount} bloqueo(s)`;
    } else if (warningCount > 0) {
        statusLabel = 'Pendiente';
    }

    const summary = ready
        ? 'Health-diagnostics, publicSync, identidad, figo y agenda quedaron alineados para salida remota.'
        : primaryIssue
          ? `${primaryIssue.label}: ${primaryIssue.detail}`
          : 'La salida remota todavía no está lista.';
    const supportCopy = ready
        ? 'Puedes liberar Turnero remoto sin tocar workflows, deploy ni artefactos generados.'
        : primaryIssue
          ? `Primero resuelve ${primaryIssue.label.toLowerCase()} y vuelve a revisar el card.`
          : 'Revisa el estado remoto antes de liberar Turnero.';

    return {
        state,
        tone,
        ready,
        title: ready ? 'Salida remota lista' : 'Salida remota bloqueada',
        eyebrow: 'Salida remota',
        statusLabel,
        summary,
        supportCopy,
        blockerCount: alertCount,
        warningCount,
        clinicId,
        profileFingerprint,
        items,
        health,
        diagnostics,
        availability,
        bookedSlots,
        loadedAt: toText(input.loadedAt, new Date().toISOString()),
    };
}

export function renderTurneroRemoteReleaseReadinessCard(model = {}, deps = {}) {
    const escapeHtmlImpl =
        typeof deps.escapeHtml === 'function' ? deps.escapeHtml : escapeHtml;
    const items = Array.isArray(model.items) ? model.items : [];

    return `
        <section
            id="queueOpsPilotRemoteReleaseReadiness"
            class="queue-ops-pilot__readiness queue-ops-pilot__remote-release"
            data-state="${escapeHtmlImpl(toText(model.tone, 'warning'))}"
            data-clinic-id="${escapeHtmlImpl(toText(model.clinicId))}"
            data-profile-fingerprint="${escapeHtmlImpl(
                toText(model.profileFingerprint)
            )}"
            aria-labelledby="queueOpsPilotRemoteReleaseTitle"
        >
            <div class="queue-ops-pilot__readiness-head">
                <div>
                    <p class="queue-app-card__eyebrow">Salida remota</p>
                    <h6 id="queueOpsPilotRemoteReleaseTitle">
                        ${escapeHtmlImpl(toText(model.title, 'Salida remota'))}
                    </h6>
                </div>
                <span
                    id="queueOpsPilotRemoteReleaseStatus"
                    class="queue-ops-pilot__readiness-status"
                    data-state="${escapeHtmlImpl(toText(model.tone, 'warning'))}"
                >
                    ${escapeHtmlImpl(toText(model.statusLabel, 'Pendiente'))}
                </span>
            </div>
            <p
                id="queueOpsPilotRemoteReleaseSummary"
                class="queue-ops-pilot__readiness-summary"
            >
                ${escapeHtmlImpl(toText(model.summary))}
            </p>
            <div
                id="queueOpsPilotRemoteReleaseItems"
                class="queue-ops-pilot__readiness-items"
                role="list"
                aria-label="Checklist de salida remota de Turnero"
            >
                ${items
                    .map((item) => {
                        const badgeLabel =
                            item.state === 'ready'
                                ? 'Listo'
                                : item.state === 'alert'
                                  ? 'Bloquea'
                                  : 'Pendiente';
                        return `
                            <article
                                id="queueOpsPilotRemoteReleaseItem_${escapeHtmlImpl(
                                    toText(item.id)
                                )}"
                                class="queue-ops-pilot__readiness-item"
                                data-state="${escapeHtmlImpl(
                                    toText(item.state, 'warning')
                                )}"
                                role="listitem"
                            >
                                <strong>${escapeHtmlImpl(
                                    toText(item.label)
                                )}</strong>
                                <span class="queue-ops-pilot__readiness-item-badge">
                                    ${escapeHtmlImpl(badgeLabel)}
                                </span>
                                <p>${escapeHtmlImpl(toText(item.detail))}</p>
                            </article>
                        `;
                    })
                    .join('')}
            </div>
            <p
                id="queueOpsPilotRemoteReleaseSupport"
                class="queue-ops-pilot__readiness-support"
            >
                ${escapeHtmlImpl(toText(model.supportCopy))}
            </p>
        </section>
    `;
}

export async function loadTurneroRemoteReleaseHealth(options = {}) {
    const fetchImpl =
        typeof options.fetchImpl === 'function'
            ? options.fetchImpl
            : typeof globalThis !== 'undefined' &&
                typeof globalThis.fetch === 'function'
              ? globalThis.fetch.bind(globalThis)
              : null;
    const apiBase = toText(options.apiBase, DEFAULT_API_BASE);
    const doctor = toText(options.doctor, DEFAULT_DOCTOR);
    const service = toText(options.service, DEFAULT_SERVICE);
    const date = normalizeDateValue(options.date, options.timeZone);
    const days = Number.isFinite(Number(options.days))
        ? Math.max(1, Number(options.days))
        : DEFAULT_DAYS;
    const requestInit = isPlainObject(options.requestInit)
        ? options.requestInit
        : {};
    const signal = requestInit.signal || options.signal || undefined;
    const sharedInit = {
        ...requestInit,
        signal,
    };

    const [health, diagnostics, availability, bookedSlots] = await Promise.all([
        fetchJsonResource(
            fetchImpl,
            buildApiUrl('health', {}, apiBase),
            sharedInit
        ),
        fetchJsonResource(
            fetchImpl,
            buildApiUrl('health-diagnostics', {}, apiBase),
            sharedInit
        ),
        fetchJsonResource(
            fetchImpl,
            buildApiUrl(
                'availability',
                {
                    doctor,
                    service,
                    dateFrom: date,
                    days: String(days),
                },
                apiBase
            ),
            sharedInit
        ),
        fetchJsonResource(
            fetchImpl,
            buildApiUrl(
                'booked-slots',
                {
                    date,
                    doctor,
                    service,
                },
                apiBase
            ),
            sharedInit
        ),
    ]);

    return {
        clinicId: toText(options.clinicId),
        profileFingerprint: toText(options.profileFingerprint),
        date,
        doctor,
        service,
        loadedAt: new Date().toISOString(),
        health,
        diagnostics,
        availability,
        bookedSlots,
    };
}

function resolveHost(target) {
    if (typeof document === 'undefined') {
        return null;
    }

    if (typeof target === 'string') {
        return document.querySelector(target);
    }

    if (isDomElement(target)) {
        return target;
    }

    return null;
}

export async function mountTurneroRemoteReleaseReadinessCard(
    target,
    options = {}
) {
    const host = resolveHost(target);
    if (!isDomElement(host)) {
        return null;
    }

    const requestId = `${Date.now().toString(36)}-${Math.random()
        .toString(36)
        .slice(2)}`;
    host.dataset.turneroRemoteReleaseRequestId = requestId;
    host.setAttribute('aria-busy', 'true');

    try {
        const remoteState = await loadTurneroRemoteReleaseHealth(options);
        if (host.dataset.turneroRemoteReleaseRequestId !== requestId) {
            return null;
        }

        const model = createTurneroRemoteReleaseReadinessModel(remoteState);
        host.innerHTML = renderTurneroRemoteReleaseReadinessCard(
            model,
            options
        );
        return model;
    } catch (error) {
        if (host.dataset.turneroRemoteReleaseRequestId !== requestId) {
            return null;
        }

        const model = buildFallbackModel(
            {
                clinicId: options.clinicId,
                profileFingerprint: options.profileFingerprint,
            },
            error instanceof Error
                ? error.message
                : toText(error, 'request_failed')
        );
        host.innerHTML = renderTurneroRemoteReleaseReadinessCard(
            model,
            options
        );
        return model;
    } finally {
        if (host.dataset.turneroRemoteReleaseRequestId === requestId) {
            host.removeAttribute('aria-busy');
        }
    }
}
