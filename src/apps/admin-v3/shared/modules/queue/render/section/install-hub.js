import { getState } from '../../../../core/store.js';
import { escapeHtml, formatDateTime, setHtml, setText } from '../../../../ui/render.js';
import { getQueueSource } from '../../selectors.js';

const DEFAULT_APP_DOWNLOADS = Object.freeze({
    operator: {
        version: '0.1.0',
        updatedAt: '2026-03-10T00:00:00Z',
        webFallbackUrl: '/operador-turnos.html',
        guideUrl: '/app-downloads/?surface=operator',
        targets: {
            win: {
                url: '/app-downloads/stable/operator/win/TurneroOperadorSetup.exe',
                label: 'Windows',
            },
            mac: {
                url: '/app-downloads/stable/operator/mac/TurneroOperador.dmg',
                label: 'macOS',
            },
        },
    },
    kiosk: {
        version: '0.1.0',
        updatedAt: '2026-03-10T00:00:00Z',
        webFallbackUrl: '/kiosco-turnos.html',
        guideUrl: '/app-downloads/?surface=kiosk',
        targets: {
            win: {
                url: '/app-downloads/stable/kiosk/win/TurneroKioscoSetup.exe',
                label: 'Windows',
            },
            mac: {
                url: '/app-downloads/stable/kiosk/mac/TurneroKiosco.dmg',
                label: 'macOS',
            },
        },
    },
    sala_tv: {
        version: '0.1.0',
        updatedAt: '2026-03-10T00:00:00Z',
        webFallbackUrl: '/sala-turnos.html',
        guideUrl: '/app-downloads/?surface=sala_tv',
        targets: {
            android_tv: {
                url: '/app-downloads/stable/sala-tv/android/TurneroSalaTV.apk',
                label: 'Android TV APK',
            },
        },
    },
});

const APP_COPY = Object.freeze({
    operator: {
        eyebrow: 'Recepción + consultorio',
        title: 'Operador',
        description:
            'Superficie diaria para llamar, re-llamar, completar y operar con el Genius Numpad 1000.',
        recommendedFor: 'PC operador',
        notes: [
            'Conecta aquí el receptor USB 2.4 GHz del numpad.',
            'La app desktop ahora puede quedar configurada como C1, C2 o modo libre desde el primer arranque.',
        ],
    },
    kiosk: {
        eyebrow: 'Recepción de pacientes',
        title: 'Kiosco',
        description:
            'Instalador dedicado para check-in, generación de ticket y operación simple en mostrador.',
        recommendedFor: 'PC o mini PC de kiosco',
        notes: [
            'Mantén el equipo en fullscreen y con impresora térmica conectada.',
            'La versión web sigue disponible como respaldo inmediato.',
        ],
    },
    sala_tv: {
        eyebrow: 'Pantalla de sala',
        title: 'Sala TV',
        description:
            'APK para Android TV en la TCL C655 con WebView controlado, reconexión y campanilla.',
        recommendedFor: 'TCL C655 / Google TV',
        notes: [
            'Instala en la TV y prioriza Ethernet sobre Wi-Fi.',
            'Usa el QR desde otra pantalla para simplificar la instalación del APK.',
        ],
    },
});

const SURFACE_TELEMETRY_COPY = Object.freeze({
    operator: {
        title: 'Operador',
        emptySummary:
            'Todavía no hay señal del equipo operador. Abre la app o el fallback web para registrar heartbeat.',
    },
    kiosk: {
        title: 'Kiosco',
        emptySummary:
            'Todavía no hay señal del kiosco. Abre el equipo o el fallback web antes de dejar autoservicio.',
    },
    display: {
        title: 'Sala TV',
        emptySummary:
            'Todavía no hay señal de la TV de sala. Abre la app Android TV o el fallback web para registrar estado.',
    },
});

const QUEUE_OPENING_CHECKLIST_STORAGE_KEY = 'queueOpeningChecklistV1';
const OPENING_CHECKLIST_STEP_IDS = Object.freeze([
    'operator_ready',
    'kiosk_ready',
    'sala_ready',
    'smoke_ready',
]);

let installPreset = null;
let openingChecklistState = null;

function detectPlatform() {
    const platform = `${navigator.userAgent} ${navigator.platform}`.toLowerCase();
    if (platform.includes('mac')) return 'mac';
    if (platform.includes('win')) return 'win';
    return 'other';
}

function absoluteUrl(url) {
    try {
        return new URL(String(url || ''), window.location.origin).toString();
    } catch (_error) {
        return String(url || '');
    }
}

function buildQrUrl(url) {
    const encoded = encodeURIComponent(absoluteUrl(url));
    return `https://api.qrserver.com/v1/create-qr-code/?size=360x360&data=${encoded}`;
}

function buildGuideUrl(surfaceKey, preset, appConfig) {
    const base = new URL(
        String(appConfig.guideUrl || `/app-downloads/?surface=${surfaceKey}`),
        `${window.location.origin}/`
    );
    base.searchParams.set('surface', surfaceKey);
    if (surfaceKey === 'sala_tv') {
        base.searchParams.set('platform', 'android_tv');
    } else {
        base.searchParams.set('platform', preset.platform === 'mac' ? 'mac' : 'win');
    }
    if (surfaceKey === 'operator') {
        base.searchParams.set('station', preset.station === 'c2' ? 'c2' : 'c1');
        base.searchParams.set('lock', preset.lock ? '1' : '0');
        base.searchParams.set('one_tap', preset.oneTap ? '1' : '0');
    } else {
        base.searchParams.delete('station');
        base.searchParams.delete('lock');
        base.searchParams.delete('one_tap');
    }
    return `${base.pathname}${base.search}`;
}

function mergeManifest() {
    const appDownloads = getState().data.appDownloads;
    if (!appDownloads || typeof appDownloads !== 'object') {
        return DEFAULT_APP_DOWNLOADS;
    }
    return {
        operator: {
            ...DEFAULT_APP_DOWNLOADS.operator,
            ...(appDownloads.operator || {}),
            targets: {
                ...DEFAULT_APP_DOWNLOADS.operator.targets,
                ...((appDownloads.operator && appDownloads.operator.targets) || {}),
            },
        },
        kiosk: {
            ...DEFAULT_APP_DOWNLOADS.kiosk,
            ...(appDownloads.kiosk || {}),
            targets: {
                ...DEFAULT_APP_DOWNLOADS.kiosk.targets,
                ...((appDownloads.kiosk && appDownloads.kiosk.targets) || {}),
            },
        },
        sala_tv: {
            ...DEFAULT_APP_DOWNLOADS.sala_tv,
            ...(appDownloads.sala_tv || {}),
            targets: {
                ...DEFAULT_APP_DOWNLOADS.sala_tv.targets,
                ...((appDownloads.sala_tv && appDownloads.sala_tv.targets) || {}),
            },
        },
    };
}

function ensureInstallPreset(detectedPlatform) {
    if (installPreset) {
        return installPreset;
    }

    const state = getState();
    installPreset = {
        surface: 'operator',
        station:
            Number(state.queue && state.queue.stationConsultorio) === 2
                ? 'c2'
                : 'c1',
        lock:
            Boolean(state.queue && state.queue.stationMode === 'locked'),
        oneTap: Boolean(state.queue && state.queue.oneTap),
        platform:
            detectedPlatform === 'win' || detectedPlatform === 'mac'
                ? detectedPlatform
                : 'win',
    };
    return installPreset;
}

function getTodayLocalIsoDate() {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

function formatOpeningChecklistDate(isoDate) {
    const value = String(isoDate || '').trim();
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
    if (!match) {
        return value || '--';
    }
    return `${match[3]}/${match[2]}/${match[1]}`;
}

function createOpeningChecklistState(date = getTodayLocalIsoDate()) {
    return {
        date,
        steps: OPENING_CHECKLIST_STEP_IDS.reduce((acc, key) => {
            acc[key] = false;
            return acc;
        }, {}),
    };
}

function normalizeOpeningChecklistState(rawState) {
    const today = getTodayLocalIsoDate();
    const source = rawState && typeof rawState === 'object' ? rawState : {};
    const date =
        String(source.date || '').trim() === today
            ? today
            : today;
    return {
        date,
        steps: OPENING_CHECKLIST_STEP_IDS.reduce((acc, key) => {
            acc[key] = Boolean(source.steps && source.steps[key]);
            return acc;
        }, {}),
    };
}

function loadOpeningChecklistState() {
    const today = getTodayLocalIsoDate();
    try {
        const raw = localStorage.getItem(QUEUE_OPENING_CHECKLIST_STORAGE_KEY);
        if (!raw) {
            return createOpeningChecklistState(today);
        }
        const parsed = JSON.parse(raw);
        if (String(parsed?.date || '') !== today) {
            return createOpeningChecklistState(today);
        }
        return normalizeOpeningChecklistState(parsed);
    } catch (_error) {
        return createOpeningChecklistState(today);
    }
}

function persistOpeningChecklistState(nextState) {
    openingChecklistState = normalizeOpeningChecklistState(nextState);
    try {
        localStorage.setItem(
            QUEUE_OPENING_CHECKLIST_STORAGE_KEY,
            JSON.stringify(openingChecklistState)
        );
    } catch (_error) {
        // ignore storage write failures
    }
    return openingChecklistState;
}

function ensureOpeningChecklistState() {
    const today = getTodayLocalIsoDate();
    if (!openingChecklistState || openingChecklistState.date !== today) {
        openingChecklistState = loadOpeningChecklistState();
    }
    return openingChecklistState;
}

function setOpeningChecklistStep(stepId, complete) {
    const current = ensureOpeningChecklistState();
    if (!OPENING_CHECKLIST_STEP_IDS.includes(stepId)) {
        return current;
    }
    return persistOpeningChecklistState({
        ...current,
        steps: {
            ...current.steps,
            [stepId]: Boolean(complete),
        },
    });
}

function resetOpeningChecklistState() {
    return persistOpeningChecklistState(
        createOpeningChecklistState(getTodayLocalIsoDate())
    );
}

function applyOpeningChecklistSuggestions(stepIds) {
    const current = ensureOpeningChecklistState();
    const validIds = (Array.isArray(stepIds) ? stepIds : []).filter((stepId) =>
        OPENING_CHECKLIST_STEP_IDS.includes(stepId)
    );
    if (!validIds.length) {
        return current;
    }

    const nextSteps = { ...current.steps };
    validIds.forEach((stepId) => {
        nextSteps[stepId] = true;
    });

    return persistOpeningChecklistState({
        ...current,
        steps: nextSteps,
    });
}

function getDesktopTarget(appConfig, platform) {
    if (platform === 'mac' && appConfig.targets.mac) {
        return appConfig.targets.mac;
    }
    if (platform === 'win' && appConfig.targets.win) {
        return appConfig.targets.win;
    }
    return appConfig.targets.win || appConfig.targets.mac || null;
}

function buildPreparedSurfaceUrl(surfaceKey, appConfig, preset) {
    const url = new URL(
        String(appConfig.webFallbackUrl || '/'),
        `${window.location.origin}/`
    );

    if (surfaceKey === 'operator') {
        url.searchParams.set('station', preset.station === 'c2' ? 'c2' : 'c1');
        url.searchParams.set('lock', preset.lock ? '1' : '0');
        url.searchParams.set('one_tap', preset.oneTap ? '1' : '0');
    }

    return url.toString();
}

function renderDesktopCard(key, appConfig, platform) {
    const copy = APP_COPY[key];
    const preset = ensureInstallPreset(platform);
    const detectedTarget = getDesktopTarget(appConfig, platform);
    const detectedLabel =
        platform === 'mac'
            ? 'macOS'
            : platform === 'win'
              ? 'Windows'
              : (detectedTarget && detectedTarget.label) || 'este equipo';
    const alternateTargets = Object.entries(appConfig.targets || {})
        .filter(([_targetKey, value]) => value && value.url)
        .map(
            ([targetKey, value]) => `
                <a
                    href="${escapeHtml(value.url)}"
                    class="${targetKey === platform ? 'queue-app-card__recommended' : ''}"
                    download
                >
                    ${escapeHtml(value.label || targetKey)}
                </a>
            `
        )
        .join('');

    return `
        <article class="queue-app-card">
            <div>
                <p class="queue-app-card__eyebrow">${escapeHtml(copy.eyebrow)}</p>
                <h5 class="queue-app-card__title">${escapeHtml(copy.title)}</h5>
                <p class="queue-app-card__description">${escapeHtml(copy.description)}</p>
            </div>
            <p class="queue-app-card__meta">
                v${escapeHtml(appConfig.version || '0.1.0')} · ${escapeHtml(
                    formatDateTime(appConfig.updatedAt || '')
                )}
            </p>
            <span class="queue-app-card__tag">Ideal para ${escapeHtml(copy.recommendedFor)}</span>
            <div class="queue-app-card__actions">
                ${
                    detectedTarget && detectedTarget.url
                        ? `<a href="${escapeHtml(
                              detectedTarget.url
                          )}" class="queue-app-card__cta-primary" download>Descargar para ${escapeHtml(
                              detectedLabel
                          )}</a>`
                        : ''
                }
            </div>
            <div class="queue-app-card__targets">${alternateTargets}</div>
            <div class="queue-app-card__links">
                <a href="${escapeHtml(appConfig.webFallbackUrl || '/')}">Abrir versión web</a>
                <a href="${escapeHtml(buildGuideUrl(key, preset, appConfig))}">Centro de instalación</a>
                <button
                    type="button"
                    data-action="queue-copy-install-link"
                    data-queue-install-url="${escapeHtml(
                        absoluteUrl((detectedTarget && detectedTarget.url) || '')
                    )}"
                >
                    Copiar enlace
                </button>
            </div>
            <ul class="queue-app-card__notes">
                ${copy.notes
                    .map((note) => `<li>${escapeHtml(note)}</li>`)
                    .join('')}
            </ul>
        </article>
    `;
}

function renderTvCard(appConfig) {
    const copy = APP_COPY.sala_tv;
    const preset = ensureInstallPreset(detectPlatform());
    const target = appConfig.targets.android_tv || {};
    const apkUrl = String(target.url || '');
    const qrUrl = buildQrUrl(apkUrl);

    return `
        <article class="queue-app-card">
            <div>
                <p class="queue-app-card__eyebrow">${escapeHtml(copy.eyebrow)}</p>
                <h5 class="queue-app-card__title">${escapeHtml(copy.title)}</h5>
                <p class="queue-app-card__description">${escapeHtml(copy.description)}</p>
            </div>
            <p class="queue-app-card__meta">
                v${escapeHtml(appConfig.version || '0.1.0')} · ${escapeHtml(
                    formatDateTime(appConfig.updatedAt || '')
                )}
            </p>
            <span class="queue-app-card__tag">Ideal para ${escapeHtml(copy.recommendedFor)}</span>
            <div class="queue-app-card__actions">
                <a
                    href="${escapeHtml(qrUrl)}"
                    class="queue-app-card__cta-primary"
                    target="_blank"
                    rel="noopener"
                >
                    Mostrar QR de instalación
                </a>
                <a href="${escapeHtml(apkUrl)}" download>Descargar APK</a>
            </div>
            <div class="queue-app-card__links">
                <a href="${escapeHtml(appConfig.webFallbackUrl || '/sala-turnos.html')}">
                    Abrir fallback web
                </a>
                <a href="${escapeHtml(buildGuideUrl('sala_tv', preset, appConfig))}">
                    Centro de instalación
                </a>
                <button
                    type="button"
                    data-action="queue-copy-install-link"
                    data-queue-install-url="${escapeHtml(absoluteUrl(apkUrl))}"
                >
                    Copiar enlace
                </button>
            </div>
            <ul class="queue-app-card__notes">
                ${copy.notes
                    .map((note) => `<li>${escapeHtml(note)}</li>`)
                    .join('')}
            </ul>
        </article>
    `;
}

function buildPresetSummaryTitle(preset) {
    if (preset.surface === 'sala_tv') {
        return 'Sala TV lista para TCL C655';
    }
    if (preset.surface === 'kiosk') {
        return 'Kiosco listo para mostrador';
    }

    if (!preset.lock) {
        return 'Operador en modo libre';
    }

    return `Operador ${preset.station === 'c2' ? 'C2' : 'C1'} fijo`;
}

function buildPresetSteps(preset) {
    if (preset.surface === 'sala_tv') {
        return [
            'Abre el QR desde otra pantalla o descarga la APK directamente.',
            'Instala la app en la TCL C655 y prioriza Ethernet sobre Wi-Fi.',
            'Valida audio, reconexión y que la sala refleje llamados reales.',
        ];
    }

    if (preset.surface === 'kiosk') {
        return [
            'Instala la app en el mini PC o PC del kiosco.',
            'Deja la impresora térmica conectada y la app en fullscreen.',
            'Usa la versión web como respaldo inmediato si el equipo se reinicia.',
        ];
    }

    const stationLabel = preset.station === 'c2' ? 'C2' : 'C1';
    return [
        `Instala Turnero Operador en el PC de ${stationLabel} y conecta el receptor USB del Genius Numpad 1000.`,
        `En el primer arranque deja el equipo como ${preset.lock ? `${stationLabel} fijo` : 'modo libre'}${preset.oneTap ? ' con 1 tecla' : ''}.`,
        'Si el numpad no reporta Enter como se espera, calibra la tecla externa dentro de la app.',
    ];
}

function buildOpeningChecklistSteps(manifest, detectedPlatform) {
    const preset = ensureInstallPreset(detectedPlatform);
    const operatorConfig = manifest.operator || DEFAULT_APP_DOWNLOADS.operator;
    const kioskConfig = manifest.kiosk || DEFAULT_APP_DOWNLOADS.kiosk;
    const salaConfig = manifest.sala_tv || DEFAULT_APP_DOWNLOADS.sala_tv;
    const operatorUrl = buildPreparedSurfaceUrl('operator', operatorConfig, {
        ...preset,
        surface: 'operator',
    });
    const kioskUrl = buildPreparedSurfaceUrl('kiosk', kioskConfig, {
        ...preset,
        surface: 'kiosk',
    });
    const salaUrl = buildPreparedSurfaceUrl('sala_tv', salaConfig, {
        ...preset,
        surface: 'sala_tv',
    });
    const stationLabel = preset.station === 'c2' ? 'C2' : 'C1';
    const operatorModeLabel = preset.lock ? `${stationLabel} fijo` : 'modo libre';

    return [
        {
            id: 'operator_ready',
            title: 'Operador + Genius Numpad 1000',
            detail: `Abre Operador en ${operatorModeLabel}${preset.oneTap ? ' con 1 tecla' : ''} y confirma Numpad Enter, Decimal y Subtract.`,
            hint: 'El receptor USB 2.4 GHz del numpad debe quedar conectado en el PC operador.',
            href: operatorUrl,
            actionLabel: 'Abrir operador',
        },
        {
            id: 'kiosk_ready',
            title: 'Kiosco + ticket térmico',
            detail: 'Abre el kiosco, genera un ticket de prueba y confirma que el panel muestre "Impresion OK".',
            hint: 'Revisa papel, energía y USB de la térmica antes de dejar autoservicio abierto.',
            href: kioskUrl,
            actionLabel: 'Abrir kiosco',
        },
        {
            id: 'sala_ready',
            title: 'Sala TV + audio en TCL C655',
            detail: 'Abre la sala, ejecuta "Probar campanilla" y confirma audio activo con la TV conectada por Ethernet.',
            hint: 'La TCL C655 debe quedar con volumen fijo y sin mute antes del primer llamado real.',
            href: salaUrl,
            actionLabel: 'Abrir sala TV',
        },
        {
            id: 'smoke_ready',
            title: 'Smoke final de apertura',
            detail: 'Haz un llamado real o de prueba desde Operador y verifica que recepción, kiosco y sala entiendan el flujo completo.',
            hint: 'Marca este paso solo cuando el llamado salga end-to-end y sea visible en la TV.',
            href: '/admin.html#queue',
            actionLabel: 'Abrir cola admin',
        },
    ];
}

function getLatestSurfaceDetails(surfaceKey) {
    const group = getSurfaceTelemetryState(surfaceKey);
    const latest =
        group.latest && typeof group.latest === 'object' ? group.latest : null;
    const details =
        latest?.details && typeof latest.details === 'object'
            ? latest.details
            : {};
    return { group, latest, details };
}

function hasRecentQueueSmokeSignal(maxAgeSec = 21600) {
    const queueMeta = getQueueSource().queueMeta;
    if (Number(queueMeta?.calledCount || 0) > 0) {
        return true;
    }

    const queueTickets = Array.isArray(getState().data?.queueTickets)
        ? getState().data.queueTickets
        : [];
    if (queueTickets.some((ticket) => String(ticket.status || '') === 'called')) {
        return true;
    }

    return (getState().queue?.activity || []).some((entry) => {
        const message = String(entry?.message || '');
        if (!/(Llamado C\d ejecutado|Re-llamar)/i.test(message)) {
            return false;
        }
        const entryMs = Date.parse(String(entry?.at || ''));
        if (!Number.isFinite(entryMs)) {
            return true;
        }
        return Date.now() - entryMs <= maxAgeSec * 1000;
    });
}

function buildOpeningChecklistAssist(detectedPlatform) {
    const preset = ensureInstallPreset(detectedPlatform);
    const expectedStation = preset.station === 'c2' ? 'c2' : 'c1';
    const operator = getLatestSurfaceDetails('operator');
    const kiosk = getLatestSurfaceDetails('kiosk');
    const display = getLatestSurfaceDetails('display');

    const operatorStation = String(operator.details.station || '').toLowerCase();
    const operatorConnection = String(operator.details.connection || 'live').toLowerCase();
    const operatorStationMatches =
        !preset.lock || !operatorStation || operatorStation === expectedStation;
    const operatorSuggested =
        operator.group.status === 'ready' &&
        !operator.group.stale &&
        Boolean(operator.details.numpadSeen) &&
        operatorStationMatches &&
        operatorConnection !== 'fallback';

    const kioskConnection = String(kiosk.details.connection || '').toLowerCase();
    const kioskSuggested =
        kiosk.group.status === 'ready' &&
        !kiosk.group.stale &&
        Boolean(kiosk.details.printerPrinted) &&
        kioskConnection === 'live';

    const displayConnection = String(display.details.connection || '').toLowerCase();
    const displaySuggested =
        display.group.status === 'ready' &&
        !display.group.stale &&
        Boolean(display.details.bellPrimed) &&
        !Boolean(display.details.bellMuted) &&
        displayConnection === 'live';

    const smokeSuggested =
        operatorSuggested && displaySuggested && hasRecentQueueSmokeSignal();

    const suggestions = {
        operator_ready: {
            suggested: operatorSuggested,
            reason: operatorSuggested
                ? `Heartbeat operador listo${preset.lock ? ` en ${expectedStation.toUpperCase()} fijo` : ''} con numpad detectado.`
                : operator.group.status === 'unknown'
                  ? 'Todavía no hay heartbeat reciente del operador.'
                  : !operatorStationMatches
                    ? `El operador reporta ${operatorStation.toUpperCase() || 'otra estación'}. Ajusta el perfil antes de confirmar.`
                    : !operator.details.numpadSeen
                      ? 'Falta una pulsación real del Genius Numpad 1000 para validar el equipo.'
                      : 'Confirma el operador manualmente antes de abrir consulta.',
        },
        kiosk_ready: {
            suggested: kioskSuggested,
            reason: kioskSuggested
                ? 'El kiosco ya reportó impresión OK y conexión en vivo.'
                : kiosk.group.status === 'unknown'
                  ? 'Todavía no hay heartbeat reciente del kiosco.'
                  : !Boolean(kiosk.details.printerPrinted)
                    ? 'Falta imprimir un ticket real o de prueba para validar la térmica.'
                    : kioskConnection !== 'live'
                      ? 'El kiosco no está reportando cola en vivo todavía.'
                      : 'Confirma el kiosco manualmente antes de abrir autoservicio.',
        },
        sala_ready: {
            suggested: displaySuggested,
            reason: displaySuggested
                ? 'La Sala TV reporta audio listo, campanilla activa y conexión estable.'
                : display.group.status === 'unknown'
                  ? 'Todavía no hay heartbeat reciente de la Sala TV.'
                  : Boolean(display.details.bellMuted)
                    ? 'La TV sigue en mute o con campanilla apagada.'
                    : !Boolean(display.details.bellPrimed)
                      ? 'Falta ejecutar la prueba de campanilla en la TV.'
                      : displayConnection !== 'live'
                        ? 'La Sala TV no está reportando conexión en vivo todavía.'
                        : 'Confirma la Sala TV manualmente antes del primer llamado.',
        },
        smoke_ready: {
            suggested: smokeSuggested,
            reason: smokeSuggested
                ? 'Ya hubo un llamado reciente con Operador y Sala TV listos.'
                : 'Haz un llamado real o de prueba para validar el flujo end-to-end antes de abrir completamente.',
        },
    };

    const suggestedIds = Object.entries(suggestions)
        .filter(([_stepId, signal]) => Boolean(signal?.suggested))
        .map(([stepId]) => stepId);

    return {
        suggestedIds,
        suggestions,
        suggestedCount: suggestedIds.length,
    };
}

function buildQueueOpsPilot(manifest, detectedPlatform) {
    const checklist = ensureOpeningChecklistState();
    const steps = buildOpeningChecklistSteps(manifest, detectedPlatform);
    const assist = buildOpeningChecklistAssist(detectedPlatform);
    const syncHealth = getQueueSyncHealth();
    const telemetry = [
        getSurfaceTelemetryState('operator'),
        getSurfaceTelemetryState('kiosk'),
        getSurfaceTelemetryState('display'),
    ];
    const confirmedCount = steps.filter((step) => checklist.steps[step.id]).length;
    const suggestedCount = assist.suggestedCount;
    const pendingSteps = steps.filter((step) => !checklist.steps[step.id]);
    const pendingAfterSuggestions = pendingSteps.filter(
        (step) => !assist.suggestions[step.id]?.suggested
    );
    const readyEquipmentCount = telemetry.filter(
        (entry) => entry.status === 'ready' && !entry.stale
    ).length;
    const issueCount =
        telemetry.filter((entry) => entry.status !== 'ready' || entry.stale).length +
        (syncHealth.state === 'ready' ? 0 : 1);
    const progressPct =
        steps.length > 0
            ? Math.max(
                  0,
                  Math.min(
                      100,
                      Math.round((confirmedCount / steps.length) * 100)
                  )
              )
            : 0;

    let tone = 'idle';
    let eyebrow = 'Siguiente paso';
    let title = 'Centro de apertura listo';
    let summary =
        'Sigue la siguiente acción sugerida para terminar la apertura sin revisar cada tarjeta por separado.';
    let primaryAction = null;
    let secondaryAction = null;
    let supportCopy = '';

    if (syncHealth.state === 'alert') {
        tone = 'alert';
        title = 'Resuelve la cola antes de abrir';
        summary =
            'Hay fallback o sincronización degradada. Prioriza el refresh de cola antes de validar hardware o instalación.';
        primaryAction = {
            kind: 'button',
            id: 'queueOpsPilotRefreshBtn',
            action: 'queue-refresh-state',
            label: 'Refrescar cola ahora',
        };
        secondaryAction = {
            kind: 'anchor',
            href: '/admin.html#queue',
            label: 'Abrir cola admin',
        };
        supportCopy = 'Cuando el sync vuelva a vivo, el panel te devolverá el siguiente paso operativo.';
    } else if (suggestedCount > 0) {
        tone = 'suggested';
        title = `Confirma ${suggestedCount} paso(s) ya validados`;
        summary =
            pendingAfterSuggestions.length > 0
                ? `${suggestedCount} paso(s) ya aparecen listos por heartbeat. Después te quedará ${pendingAfterSuggestions[0].title}.`
                : 'El sistema ya detectó los pasos pendientes como listos. Confírmalos para cerrar la apertura.';
        primaryAction = {
            kind: 'button',
            id: 'queueOpsPilotApplyBtn',
            label: `Confirmar sugeridos (${suggestedCount})`,
        };
        secondaryAction = pendingAfterSuggestions.length
            ? {
                  kind: 'anchor',
                  href: pendingAfterSuggestions[0].href,
                  label: pendingAfterSuggestions[0].actionLabel,
              }
            : {
                  kind: 'anchor',
                  href: '/admin.html#queue',
                  label: 'Volver a la cola',
              };
        supportCopy =
            'Usa este botón cuando ya confías en la telemetría y solo quieres avanzar sin recorrer el checklist uno por uno.';
    } else if (pendingAfterSuggestions.length > 0) {
        tone = syncHealth.state === 'warning' ? 'warning' : 'active';
        title = `Siguiente paso: ${pendingAfterSuggestions[0].title}`;
        summary =
            pendingAfterSuggestions.length > 1
                ? `Quedan ${pendingAfterSuggestions.length} validaciones manuales. Empieza por esta para mantener el flujo simple.`
                : 'Solo queda una validación manual para dejar la apertura lista.';
        primaryAction = {
            kind: 'anchor',
            href: pendingAfterSuggestions[0].href,
            label: pendingAfterSuggestions[0].actionLabel,
        };
        secondaryAction =
            syncHealth.state === 'warning'
                ? {
                      kind: 'button',
                      id: 'queueOpsPilotRefreshBtn',
                      action: 'queue-refresh-state',
                      label: 'Refrescar cola',
                  }
                : {
                      kind: 'anchor',
                      href: '/admin.html#queue',
                      label: 'Abrir cola admin',
                  };
        supportCopy = String(
            assist.suggestions[pendingAfterSuggestions[0].id]?.reason ||
                pendingAfterSuggestions[0].hint ||
                ''
        );
    } else {
        tone = 'ready';
        eyebrow = 'Operación lista';
        title = 'Apertura completada';
        summary =
            'Operador, kiosco y sala ya están confirmados. Puedes seguir atendiendo o hacer un llamado de prueba final desde la cola.';
        primaryAction = {
            kind: 'anchor',
            href: '/admin.html#queue',
            label: 'Abrir cola admin',
        };
        secondaryAction = {
            kind: 'anchor',
            href: buildPreparedSurfaceUrl(
                'operator',
                manifest.operator || DEFAULT_APP_DOWNLOADS.operator,
                {
                    ...ensureInstallPreset(detectedPlatform),
                    surface: 'operator',
                }
            ),
            label: 'Abrir operador',
        };
        supportCopy = 'Si cambia un equipo a warning o alert, este panel volverá a priorizar la acción correcta.';
    }

    return {
        tone,
        eyebrow,
        title,
        summary,
        supportCopy,
        progressPct,
        confirmedCount,
        suggestedCount,
        totalSteps: steps.length,
        readyEquipmentCount,
        issueCount,
        primaryAction,
        secondaryAction,
    };
}

function renderQueueOpsPilotAction(action, variant = 'secondary') {
    if (!action) {
        return '';
    }

    const className =
        variant === 'primary'
            ? 'queue-ops-pilot__action queue-ops-pilot__action--primary'
            : 'queue-ops-pilot__action';

    if (action.kind === 'button') {
        return `
            <button
                ${action.id ? `id="${escapeHtml(action.id)}"` : ''}
                type="button"
                class="${className}"
                ${action.action ? `data-action="${escapeHtml(action.action)}"` : ''}
            >
                ${escapeHtml(action.label || 'Continuar')}
            </button>
        `;
    }

    return `
        <a
            ${action.id ? `id="${escapeHtml(action.id)}"` : ''}
            href="${escapeHtml(action.href || '/')}"
            class="${className}"
            target="_blank"
            rel="noopener"
        >
            ${escapeHtml(action.label || 'Continuar')}
        </a>
    `;
}

function renderQueueOpsPilot(manifest, detectedPlatform) {
    const root = document.getElementById('queueOpsPilot');
    if (!(root instanceof HTMLElement)) {
        return;
    }

    const pilot = buildQueueOpsPilot(manifest, detectedPlatform);
    setHtml(
        '#queueOpsPilot',
        `
            <section class="queue-ops-pilot__shell" data-state="${escapeHtml(pilot.tone)}">
                <div class="queue-ops-pilot__layout">
                    <div class="queue-ops-pilot__copy">
                        <p class="queue-app-card__eyebrow">${escapeHtml(pilot.eyebrow)}</p>
                        <h5 id="queueOpsPilotTitle" class="queue-app-card__title">${escapeHtml(
                            pilot.title
                        )}</h5>
                        <p id="queueOpsPilotSummary" class="queue-ops-pilot__summary">${escapeHtml(
                            pilot.summary
                        )}</p>
                        <p class="queue-ops-pilot__support">${escapeHtml(
                            pilot.supportCopy
                        )}</p>
                        <div class="queue-ops-pilot__actions">
                            ${renderQueueOpsPilotAction(pilot.primaryAction, 'primary')}
                            ${renderQueueOpsPilotAction(pilot.secondaryAction, 'secondary')}
                        </div>
                    </div>
                    <div class="queue-ops-pilot__status">
                        <div class="queue-ops-pilot__progress">
                            <div class="queue-ops-pilot__progress-head">
                                <span>Apertura confirmada</span>
                                <strong id="queueOpsPilotProgressValue">${escapeHtml(
                                    `${pilot.confirmedCount}/${pilot.totalSteps}`
                                )}</strong>
                            </div>
                            <div class="queue-ops-pilot__bar" aria-hidden="true">
                                <span style="width:${escapeHtml(String(pilot.progressPct))}%"></span>
                            </div>
                        </div>
                        <div class="queue-ops-pilot__chips">
                            <span id="queueOpsPilotChipConfirmed" class="queue-ops-pilot__chip">
                                Confirmados ${escapeHtml(String(pilot.confirmedCount))}
                            </span>
                            <span id="queueOpsPilotChipSuggested" class="queue-ops-pilot__chip">
                                Sugeridos ${escapeHtml(String(pilot.suggestedCount))}
                            </span>
                            <span id="queueOpsPilotChipEquipment" class="queue-ops-pilot__chip">
                                Equipos listos ${escapeHtml(String(pilot.readyEquipmentCount))}/3
                            </span>
                            <span id="queueOpsPilotChipIssues" class="queue-ops-pilot__chip">
                                Incidencias ${escapeHtml(String(pilot.issueCount))}
                            </span>
                        </div>
                    </div>
                </div>
            </section>
        `
    );

    const applyButton = document.getElementById('queueOpsPilotApplyBtn');
    if (applyButton instanceof HTMLButtonElement) {
        applyButton.onclick = () => {
            const assist = buildOpeningChecklistAssist(detectedPlatform);
            if (!assist.suggestedIds.length) {
                return;
            }
            applyOpeningChecklistSuggestions(assist.suggestedIds);
            renderQueueOpsPilot(manifest, detectedPlatform);
            renderOpeningChecklist(manifest, detectedPlatform);
        };
    }
}

function formatHeartbeatAge(ageSec) {
    const safeAge = Number(ageSec);
    if (!Number.isFinite(safeAge) || safeAge < 0) {
        return 'sin señal';
    }
    if (safeAge < 60) {
        return `${safeAge}s`;
    }
    const minutes = Math.floor(safeAge / 60);
    const seconds = safeAge % 60;
    if (minutes >= 60) {
        const hours = Math.floor(minutes / 60);
        const remMinutes = minutes % 60;
        return remMinutes > 0 ? `${hours}h ${remMinutes}m` : `${hours}h`;
    }
    return seconds > 0 ? `${minutes}m ${seconds}s` : `${minutes}m`;
}

function formatIntervalAge(intervalMs) {
    const safeInterval = Number(intervalMs);
    if (!Number.isFinite(safeInterval) || safeInterval <= 0) {
        return 'cada --';
    }
    const seconds = Math.max(1, Math.round(safeInterval / 1000));
    if (seconds < 60) {
        return `cada ${seconds}s`;
    }
    const minutes = Math.round(seconds / 60);
    return `cada ${minutes}m`;
}

function getSurfaceTelemetryAutoRefreshState() {
    const runtime = getState().ui?.queueAutoRefresh;
    return runtime && typeof runtime === 'object'
        ? runtime
        : {
              state: 'idle',
              reason: 'Abre Turnero Sala para activar el monitoreo continuo.',
              intervalMs: 45000,
              lastAttemptAt: 0,
              lastSuccessAt: 0,
              lastError: '',
              inFlight: false,
          };
}

function buildSurfaceTelemetryAutoRefreshMeta() {
    const runtime = getSurfaceTelemetryAutoRefreshState();
    const state = String(runtime.state || 'idle').trim().toLowerCase();
    const intervalLabel = formatIntervalAge(runtime.intervalMs);
    const lastSuccessLabel = runtime.lastSuccessAt
        ? `ultimo ciclo hace ${formatHeartbeatAge(
              Math.max(0, Math.round((Date.now() - Number(runtime.lastSuccessAt || 0)) / 1000))
          )}`
        : 'sin ciclo exitoso todavía';

    if (state === 'refreshing' || Boolean(runtime.inFlight)) {
        return {
            state: 'active',
            label: 'Actualizando ahora',
            meta: `${intervalLabel} · sincronizando equipos en vivo`,
        };
    }

    if (state === 'paused') {
        return {
            state: 'paused',
            label: 'Auto-refresh en pausa',
            meta: String(runtime.reason || 'Reanuda esta sección para continuar.'),
        };
    }

    if (state === 'warning') {
        return {
            state: 'warning',
            label: 'Auto-refresh degradado',
            meta: String(runtime.reason || `Modo degradado · ${lastSuccessLabel}`),
        };
    }

    if (state === 'active') {
        return {
            state: 'active',
            label: 'Auto-refresh activo',
            meta: `${intervalLabel} · ${lastSuccessLabel}`,
        };
    }

    return {
        state: 'idle',
        label: 'Auto-refresh listo',
        meta: String(runtime.reason || 'Abre Turnero Sala para empezar el monitoreo.'),
    };
}

function getQueueSurfaceTelemetry() {
    const telemetry = getState().data.queueSurfaceStatus;
    return telemetry && typeof telemetry === 'object' ? telemetry : {};
}

function getSurfaceTelemetryState(surfaceKey) {
    const telemetry = getQueueSurfaceTelemetry();
    const raw = telemetry[surfaceKey];
    return raw && typeof raw === 'object'
        ? raw
        : {
              surface: surfaceKey,
              status: 'unknown',
              stale: true,
              summary: '',
              latest: null,
              instances: [],
          };
}

function buildSurfaceTelemetryChips(surfaceKey, latest) {
    if (!latest || typeof latest !== 'object') {
        return ['Sin señal'];
    }

    const details = latest.details && typeof latest.details === 'object' ? latest.details : {};
    const chips = [];
    const appMode = String(latest.appMode || '').trim();
    if (appMode === 'desktop') {
        chips.push('Desktop');
    } else if (appMode === 'android_tv') {
        chips.push('Android TV');
    } else {
        chips.push('Web');
    }

    if (surfaceKey === 'operator') {
        const station = String(details.station || '').toUpperCase();
        const stationMode = String(details.stationMode || '');
        const oneTap = Boolean(details.oneTap);
        const numpadSeen = Boolean(details.numpadSeen);
        if (station) {
            chips.push(stationMode === 'locked' ? `${station} fijo` : `${station} libre`);
        }
        chips.push(oneTap ? '1 tecla ON' : '1 tecla OFF');
        chips.push(numpadSeen ? 'Numpad listo' : 'Numpad pendiente');
    } else if (surfaceKey === 'kiosk') {
        chips.push(Boolean(details.printerPrinted) ? 'Térmica OK' : 'Térmica pendiente');
        chips.push(`Offline ${Number(details.pendingOffline || 0)}`);
        chips.push(
            String(details.connection || '').toLowerCase() === 'live'
                ? 'Cola en vivo'
                : 'Cola degradada'
        );
    } else if (surfaceKey === 'display') {
        chips.push(Boolean(details.bellPrimed) ? 'Audio listo' : 'Audio pendiente');
        chips.push(Boolean(details.bellMuted) ? 'Campanilla Off' : 'Campanilla On');
        chips.push(
            String(details.connection || '').toLowerCase() === 'live'
                ? 'Sala en vivo'
                : 'Sala degradada'
        );
    }

    return chips.slice(0, 4);
}

function buildSurfaceTelemetryCards(manifest, detectedPlatform) {
    const preset = ensureInstallPreset(detectedPlatform);
    const cards = [
        {
            key: 'operator',
            appConfig: manifest.operator || DEFAULT_APP_DOWNLOADS.operator,
            fallbackSurface: 'operator',
            actionLabel: 'Abrir operador',
        },
        {
            key: 'kiosk',
            appConfig: manifest.kiosk || DEFAULT_APP_DOWNLOADS.kiosk,
            fallbackSurface: 'kiosk',
            actionLabel: 'Abrir kiosco',
        },
        {
            key: 'display',
            appConfig: manifest.sala_tv || DEFAULT_APP_DOWNLOADS.sala_tv,
            fallbackSurface: 'sala_tv',
            actionLabel: 'Abrir sala TV',
        },
    ];

    return cards.map((entry) => {
        const group = getSurfaceTelemetryState(entry.key);
        const latest =
            group.latest && typeof group.latest === 'object' ? group.latest : null;
        const effectiveState = String(group.status || 'unknown');
        const summary =
            String(group.summary || '').trim() ||
            SURFACE_TELEMETRY_COPY[entry.key]?.emptySummary ||
            'Sin señal todavía.';
        const route = buildPreparedSurfaceUrl(
            entry.fallbackSurface,
            entry.appConfig,
            {
                ...preset,
                surface: entry.fallbackSurface,
            }
        );

        return {
            key: entry.key,
            title: SURFACE_TELEMETRY_COPY[entry.key]?.title || entry.key,
            state:
                effectiveState === 'ready' || effectiveState === 'warning' || effectiveState === 'alert'
                    ? effectiveState
                    : 'unknown',
            badge:
                effectiveState === 'ready'
                    ? 'En vivo'
                    : effectiveState === 'alert'
                      ? 'Atender'
                      : effectiveState === 'warning'
                        ? 'Revisar'
                        : 'Sin señal',
            deviceLabel: String(latest?.deviceLabel || 'Sin equipo reportando'),
            summary,
            ageLabel:
                latest && latest.ageSec !== undefined && latest.ageSec !== null
                    ? `Heartbeat hace ${formatHeartbeatAge(latest.ageSec)}`
                    : 'Sin heartbeat todavía',
            chips: buildSurfaceTelemetryChips(entry.key, latest),
            route,
            actionLabel: entry.actionLabel,
        };
    });
}

function renderSurfaceTelemetry(manifest, detectedPlatform) {
    const root = document.getElementById('queueSurfaceTelemetry');
    if (!(root instanceof HTMLElement)) {
        return;
    }

    const cards = buildSurfaceTelemetryCards(manifest, detectedPlatform);
    const autoRefresh = buildSurfaceTelemetryAutoRefreshMeta();
    const hasAlert = cards.some((card) => card.state === 'alert');
    const hasWarning = cards.some(
        (card) => card.state === 'warning' || card.state === 'unknown'
    );
    const title = hasAlert
        ? 'Equipos con atención urgente'
        : hasWarning
          ? 'Equipos con señal parcial'
          : 'Equipos en vivo';
    const summary = hasAlert
        ? 'Al menos un equipo reporta una condición crítica. Atiende primero esa tarjeta antes de tocar instalación o configuración.'
        : hasWarning
          ? 'Hay equipos sin heartbeat reciente o con validación pendiente. Usa estas tarjetas para abrir el equipo correcto sin buscar rutas manualmente.'
          : 'Operador, kiosco y sala están enviando heartbeat al admin. Esta vista ya sirve como tablero operativo por equipo.';
    const statusLabel = hasAlert
        ? 'Atender ahora'
        : hasWarning
          ? 'Revisar hoy'
          : 'Todo al día';
    const statusState = hasAlert ? 'alert' : hasWarning ? 'warning' : 'ready';

    setHtml(
        '#queueSurfaceTelemetry',
        `
            <section class="queue-surface-telemetry__shell">
                <div class="queue-surface-telemetry__header">
                    <div>
                        <p class="queue-app-card__eyebrow">Equipos en vivo</p>
                        <h5 id="queueSurfaceTelemetryTitle" class="queue-app-card__title">${escapeHtml(
                            title
                        )}</h5>
                        <p id="queueSurfaceTelemetrySummary" class="queue-surface-telemetry__summary">${escapeHtml(
                            summary
                        )}</p>
                        <div id="queueSurfaceTelemetryAutoMeta" class="queue-surface-telemetry__auto-meta">
                            <span
                                id="queueSurfaceTelemetryAutoState"
                                class="queue-surface-telemetry__auto-state"
                                data-state="${escapeHtml(autoRefresh.state)}"
                            >
                                ${escapeHtml(autoRefresh.label)}
                            </span>
                            <span class="queue-surface-telemetry__auto-copy">${escapeHtml(
                                autoRefresh.meta
                            )}</span>
                        </div>
                    </div>
                    <span
                        id="queueSurfaceTelemetryStatus"
                        class="queue-surface-telemetry__status"
                        data-state="${escapeHtml(statusState)}"
                    >
                        ${escapeHtml(statusLabel)}
                    </span>
                </div>
                <div id="queueSurfaceTelemetryCards" class="queue-surface-telemetry__grid" role="list" aria-label="Estado vivo por equipo">
                    ${cards
                        .map(
                            (card) => `
                                <article
                                    class="queue-surface-card"
                                    data-state="${escapeHtml(card.state)}"
                                    role="listitem"
                                >
                                    <div class="queue-surface-card__header">
                                        <div>
                                            <strong>${escapeHtml(card.title)}</strong>
                                            <p class="queue-surface-card__meta">${escapeHtml(
                                                card.deviceLabel
                                            )}</p>
                                        </div>
                                        <span class="queue-surface-card__badge">${escapeHtml(
                                            card.badge
                                        )}</span>
                                    </div>
                                    <p class="queue-surface-card__summary">${escapeHtml(
                                        card.summary
                                    )}</p>
                                    <p class="queue-surface-card__age">${escapeHtml(
                                        card.ageLabel
                                    )}</p>
                                    <div class="queue-surface-card__chips">
                                        ${card.chips
                                            .map(
                                                (chip) =>
                                                    `<span class="queue-surface-card__chip">${escapeHtml(
                                                        chip
                                                    )}</span>`
                                            )
                                            .join('')}
                                    </div>
                                    <div class="queue-surface-card__actions">
                                        <a
                                            href="${escapeHtml(card.route)}"
                                            target="_blank"
                                            rel="noopener"
                                            class="queue-surface-card__action queue-surface-card__action--primary"
                                        >
                                            ${escapeHtml(card.actionLabel)}
                                        </a>
                                        <button
                                            type="button"
                                            class="queue-surface-card__action"
                                            data-action="queue-copy-install-link"
                                            data-queue-install-url="${escapeHtml(card.route)}"
                                        >
                                            Copiar ruta
                                        </button>
                                        <button
                                            type="button"
                                            class="queue-surface-card__action"
                                            data-action="refresh-admin-data"
                                        >
                                            Actualizar estado
                                        </button>
                                    </div>
                                </article>
                            `
                        )
                        .join('')}
                </div>
            </section>
        `
    );
}

function getQueueSyncHealth() {
    const state = getState();
    const { queueMeta } = getQueueSource();
    const syncMode = String(state.queue?.syncMode || 'live').trim().toLowerCase();
    const fallbackPartial = Boolean(state.queue?.fallbackPartial);
    const updatedAt = String(queueMeta?.updatedAt || '').trim();
    const updatedAtMs = updatedAt ? Date.parse(updatedAt) : NaN;
    const ageSec = Number.isFinite(updatedAtMs)
        ? Math.max(0, Math.round((Date.now() - updatedAtMs) / 1000))
        : null;

    if (syncMode === 'fallback' || fallbackPartial) {
        return {
            state: 'alert',
            badge: 'Atender ahora',
            title: 'Cola en fallback',
            summary:
                'El admin ya está usando respaldo parcial. Refresca la cola y mantén Operador, Kiosco y Sala TV en sus rutas web preparadas hasta que vuelva el realtime.',
            steps: [
                'Presiona Refrescar y confirma que el sync vuelva a vivo antes de cerrar la apertura.',
                'Mantén un solo operador activo por estación para evitar confusión mientras dura el respaldo.',
                'Si la TV sigue mostrando llamados, no la cierres; prioriza estabilidad sobre reinstalar.',
            ],
        };
    }

    if (Number.isFinite(ageSec) && ageSec >= 60) {
        return {
            state: 'warning',
            badge: `Watchdog ${ageSec}s`,
            title: 'Realtime lento o en reconexión',
            summary:
                'La cola no parece caída, pero el watchdog ya detecta retraso. Conviene refrescar desde admin antes de que el equipo operador se quede desfasado.',
            steps: [
                'Refresca la cola y confirma que Sync vuelva a "vivo".',
                'Si Operador ya estaba abierto, valida un llamado de prueba antes de seguir atendiendo.',
                'Si el retraso persiste, opera desde las rutas web preparadas mientras revisas red local.',
            ],
        };
    }

    return {
        state: 'ready',
        badge: 'Sin incidentes',
        title: 'Cola sincronizada',
        summary:
            'No hay incidentes visibles de realtime. Usa esta sección como ruta rápida si falla numpad, térmica o audio durante el día.',
        steps: [
            'Mantén este panel abierto como tablero de rescate para operador, kiosco y sala.',
            'Si notas un retraso mayor a un minuto, refresca antes de tocar instalación o hardware.',
            'En una caída puntual, prioriza abrir la ruta preparada del equipo antes de reiniciar dispositivos.',
        ],
    };
}

function buildContingencyCards(manifest, detectedPlatform) {
    const preset = ensureInstallPreset(detectedPlatform);
    const operatorConfig = manifest.operator || DEFAULT_APP_DOWNLOADS.operator;
    const kioskConfig = manifest.kiosk || DEFAULT_APP_DOWNLOADS.kiosk;
    const salaConfig = manifest.sala_tv || DEFAULT_APP_DOWNLOADS.sala_tv;
    const syncHealth = getQueueSyncHealth();
    const stationLabel = preset.station === 'c2' ? 'C2' : 'C1';
    const operatorModeLabel = preset.lock ? `${stationLabel} fijo` : 'modo libre';
    const operatorUrl = buildPreparedSurfaceUrl('operator', operatorConfig, {
        ...preset,
        surface: 'operator',
    });
    const kioskUrl = buildPreparedSurfaceUrl('kiosk', kioskConfig, {
        ...preset,
        surface: 'kiosk',
    });
    const salaUrl = buildPreparedSurfaceUrl('sala_tv', salaConfig, {
        ...preset,
        surface: 'sala_tv',
    });

    return {
        syncHealth,
        cards: [
            {
                id: 'operator_issue',
                state: 'neutral',
                badge: 'Numpad',
                title: 'Numpad no responde',
                summary: `Abre Operador en ${operatorModeLabel}${preset.oneTap ? ' con 1 tecla' : ''}, recalibra la tecla externa y confirma Enter, Decimal y Subtract del Genius Numpad 1000.`,
                steps: [
                    'Confirma que el receptor USB 2.4 GHz siga conectado en el PC operador.',
                    'Dentro de Operador usa "Calibrar tecla" si el Enter del numpad no dispara llamada.',
                    'Mientras corriges el teclado, puedes seguir operando por clics sin cambiar de equipo.',
                ],
                actions: [
                    {
                        type: 'link',
                        href: operatorUrl,
                        label: 'Abrir operador',
                        primary: true,
                    },
                    {
                        type: 'copy',
                        url: operatorUrl,
                        label: 'Copiar ruta',
                    },
                    {
                        type: 'link',
                        href: buildGuideUrl('operator', preset, operatorConfig),
                        label: 'Centro de instalación',
                        external: true,
                    },
                ],
            },
            {
                id: 'kiosk_issue',
                state: 'neutral',
                badge: 'Térmica',
                title: 'Térmica no imprime',
                summary:
                    'Abre Kiosco, genera un ticket de prueba y confirma "Impresion OK" antes de volver al autoservicio.',
                steps: [
                    'Revisa papel, energía y cable USB de la impresora térmica.',
                    'Si el equipo sigue estable, usa el kiosco web preparado mientras validas la app desktop.',
                    'No cierres el flujo de check-in hasta imprimir al menos un ticket de prueba correcto.',
                ],
                actions: [
                    {
                        type: 'link',
                        href: kioskUrl,
                        label: 'Abrir kiosco',
                        primary: true,
                    },
                    {
                        type: 'copy',
                        url: kioskUrl,
                        label: 'Copiar ruta',
                    },
                    {
                        type: 'link',
                        href: buildGuideUrl('kiosk', preset, kioskConfig),
                        label: 'Centro de instalación',
                        external: true,
                    },
                ],
            },
            {
                id: 'sala_issue',
                state: 'neutral',
                badge: 'Audio',
                title: 'Sala TV sin campanilla',
                summary:
                    'Abre la Sala TV, ejecuta la prueba de campanilla y deja la TCL C655 con volumen fijo y Ethernet activo.',
                steps: [
                    'Confirma que la TV no esté en mute y que la app siga en foreground.',
                    'Si la APK falla, usa `sala-turnos.html` como respaldo inmediato en el navegador de la TV.',
                    'Solo reinstala la APK si ya probaste campanilla, red y energía de la pantalla.',
                ],
                actions: [
                    {
                        type: 'link',
                        href: salaUrl,
                        label: 'Abrir sala TV',
                        primary: true,
                    },
                    {
                        type: 'link',
                        href: buildGuideUrl('sala_tv', preset, salaConfig),
                        label: 'Instalar APK',
                        external: true,
                    },
                    {
                        type: 'copy',
                        url: salaUrl,
                        label: 'Copiar fallback web',
                    },
                ],
            },
            {
                id: 'sync_issue',
                state: syncHealth.state,
                badge: syncHealth.badge,
                title: syncHealth.title,
                summary: syncHealth.summary,
                steps: syncHealth.steps,
                actions: [
                    {
                        type: 'button',
                        action: 'queue-refresh-state',
                        label: 'Refrescar cola',
                        primary: syncHealth.state !== 'ready',
                    },
                    {
                        type: 'link',
                        href: operatorUrl,
                        label: 'Abrir operador web',
                    },
                    {
                        type: 'copy',
                        url: kioskUrl,
                        label: 'Copiar kiosco web',
                    },
                ],
            },
        ],
    };
}

function renderContingencyAction(cardId, action, index) {
    const label = escapeHtml(action.label || 'Abrir');
    const className = action.primary
        ? 'queue-contingency-card__action queue-contingency-card__action--primary'
        : 'queue-contingency-card__action';

    if (action.type === 'button') {
        return `
            <button
                type="button"
                class="${className}"
                data-action="${escapeHtml(action.action || '')}"
                data-queue-contingency-card="${escapeHtml(cardId)}"
                data-queue-contingency-action-index="${escapeHtml(String(index))}"
            >
                ${label}
            </button>
        `;
    }

    if (action.type === 'copy') {
        return `
            <button
                type="button"
                class="${className}"
                data-action="queue-copy-install-link"
                data-queue-install-url="${escapeHtml(action.url || '')}"
                data-queue-contingency-card="${escapeHtml(cardId)}"
                data-queue-contingency-action-index="${escapeHtml(String(index))}"
            >
                ${label}
            </button>
        `;
    }

    return `
        <a
            href="${escapeHtml(action.href || '/')}"
            class="${className}"
            ${action.external ? 'target="_blank" rel="noopener"' : ''}
        >
            ${label}
        </a>
    `;
}

function renderContingencyDeck(manifest, detectedPlatform) {
    const root = document.getElementById('queueContingencyDeck');
    if (!(root instanceof HTMLElement)) {
        return;
    }

    const { syncHealth, cards } = buildContingencyCards(manifest, detectedPlatform);
    const title =
        syncHealth.state === 'alert'
            ? 'Contingencia activa'
            : syncHealth.state === 'warning'
              ? 'Contingencia preventiva'
              : 'Contingencia rápida lista';
    const summary =
        syncHealth.state === 'alert'
            ? 'Resuelve primero la sincronización y luego ataca hardware puntual. Las rutas de abajo ya quedan preparadas para operar sin perder tiempo.'
            : syncHealth.state === 'warning'
              ? 'Hay señal de retraso en la cola. Usa estas rutas directas antes de que el operador quede fuera de contexto.'
              : 'Las tarjetas de abajo sirven como ruta corta cuando algo falla en medio de la jornada, sin mezclar instalación con operación.';

    setHtml(
        '#queueContingencyDeck',
        `
            <section class="queue-contingency-deck__shell">
                <div class="queue-contingency-deck__header">
                    <div>
                        <p class="queue-app-card__eyebrow">Contingencia rápida</p>
                        <h5 id="queueContingencyTitle" class="queue-app-card__title">${escapeHtml(
                            title
                        )}</h5>
                        <p id="queueContingencySummary" class="queue-contingency-deck__summary">${escapeHtml(
                            summary
                        )}</p>
                    </div>
                    <span
                        id="queueContingencyStatus"
                        class="queue-contingency-deck__status"
                        data-state="${escapeHtml(syncHealth.state)}"
                    >
                        ${escapeHtml(syncHealth.badge)}
                    </span>
                </div>
                <div id="queueContingencyCards" class="queue-contingency-deck__grid" role="list" aria-label="Tarjetas de contingencia rápida">
                    ${cards
                        .map(
                            (card) => `
                                <article
                                    class="queue-contingency-card"
                                    ${card.id === 'sync_issue' ? 'id="queueContingencySyncCard"' : ''}
                                    data-state="${escapeHtml(card.state)}"
                                    role="listitem"
                                >
                                    <div class="queue-contingency-card__header">
                                        <div>
                                            <strong>${escapeHtml(card.title)}</strong>
                                            <p class="queue-contingency-card__summary">${escapeHtml(
                                                card.summary
                                            )}</p>
                                        </div>
                                        <span class="queue-contingency-card__badge">${escapeHtml(
                                            card.badge
                                        )}</span>
                                    </div>
                                    <ul class="queue-contingency-card__steps">
                                        ${card.steps
                                            .map(
                                                (step) =>
                                                    `<li>${escapeHtml(step)}</li>`
                                            )
                                            .join('')}
                                    </ul>
                                    <div class="queue-contingency-card__actions">
                                        ${card.actions
                                            .map((action, index) =>
                                                renderContingencyAction(card.id, action, index)
                                            )
                                            .join('')}
                                    </div>
                                </article>
                            `
                        )
                        .join('')}
                </div>
            </section>
        `
    );
}

function renderOpeningChecklist(manifest, detectedPlatform) {
    const root = document.getElementById('queueOpeningChecklist');
    if (!(root instanceof HTMLElement)) {
        return;
    }

    const checklist = ensureOpeningChecklistState();
    const steps = buildOpeningChecklistSteps(manifest, detectedPlatform);
    const assist = buildOpeningChecklistAssist(detectedPlatform);
    const confirmedCount = steps.filter((step) => checklist.steps[step.id]).length;
    const suggestedCount = steps.filter(
        (step) => !checklist.steps[step.id] && Boolean(assist.suggestions[step.id]?.suggested)
    ).length;
    const pendingCount = steps.length - confirmedCount;
    const title =
        pendingCount <= 0
            ? 'Apertura diaria lista'
            : suggestedCount > 0
              ? 'Apertura diaria asistida'
              : confirmedCount <= 0
              ? 'Apertura diaria pendiente'
              : `Apertura diaria: faltan ${pendingCount} paso(s)`;
    const summary =
        pendingCount <= 0
            ? 'Operador, kiosco y sala TV ya quedaron probados en este navegador admin para hoy.'
            : suggestedCount > 0
              ? `${suggestedCount} paso(s) ya aparecen listos por telemetría o actividad reciente. Confírmalos en bloque y deja solo las validaciones pendientes.`
            : 'Sigue cada paso desde esta vista y marca listo solo después de validar el equipo real. El avance se guarda en este navegador.';

    setHtml(
        '#queueOpeningChecklist',
        `
            <section class="queue-opening-checklist__shell">
                <div class="queue-opening-checklist__header">
                    <div>
                        <p class="queue-app-card__eyebrow">Apertura diaria</p>
                        <h5 id="queueOpeningChecklistTitle" class="queue-app-card__title">${escapeHtml(
                            title
                        )}</h5>
                        <p id="queueOpeningChecklistSummary" class="queue-opening-checklist__summary">${escapeHtml(
                            summary
                        )}</p>
                    </div>
                    <div class="queue-opening-checklist__meta">
                        <span
                            id="queueOpeningChecklistAssistChip"
                            class="queue-opening-checklist__assist"
                            data-state="${suggestedCount > 0 ? 'suggested' : pendingCount <= 0 ? 'ready' : 'idle'}"
                        >
                            ${escapeHtml(
                                suggestedCount > 0
                                    ? `Sugeridos ${suggestedCount}`
                                    : pendingCount <= 0
                                      ? 'Checklist completo'
                                      : `Confirmados ${confirmedCount}/${steps.length}`
                            )}
                        </span>
                        <button
                            id="queueOpeningChecklistApplyBtn"
                            type="button"
                            class="queue-opening-checklist__apply"
                            ${suggestedCount > 0 ? '' : 'disabled'}
                        >
                            ${
                                suggestedCount > 0
                                    ? `Confirmar sugeridos (${suggestedCount})`
                                    : 'Sin sugeridos todavía'
                            }
                        </button>
                        <button
                            id="queueOpeningChecklistResetBtn"
                            type="button"
                            class="queue-opening-checklist__reset"
                        >
                            Reiniciar apertura de hoy
                        </button>
                        <span id="queueOpeningChecklistDate" class="queue-opening-checklist__date">
                            ${escapeHtml(formatOpeningChecklistDate(checklist.date))}
                        </span>
                    </div>
                </div>
                <div id="queueOpeningChecklistSteps" class="queue-opening-checklist__steps" role="list" aria-label="Checklist de apertura diaria">
                    ${steps
                        .map((step) => {
                            const isReady = Boolean(checklist.steps[step.id]);
                            const isSuggested = !isReady && Boolean(assist.suggestions[step.id]?.suggested);
                            const stepState = isReady
                                ? 'ready'
                                : isSuggested
                                  ? 'suggested'
                                  : 'pending';
                            const stateLabel = isReady
                                ? 'Confirmado'
                                : isSuggested
                                  ? 'Sugerido'
                                  : 'Pendiente';
                            const evidence = String(
                                assist.suggestions[step.id]?.reason || step.hint
                            );
                            return `
                                <article
                                    class="queue-opening-step"
                                    data-state="${stepState}"
                                    role="listitem"
                                >
                                    <div class="queue-opening-step__header">
                                        <div>
                                            <strong>${escapeHtml(step.title)}</strong>
                                            <p class="queue-opening-step__detail">${escapeHtml(step.detail)}</p>
                                        </div>
                                        <span class="queue-opening-step__state">
                                            ${escapeHtml(stateLabel)}
                                        </span>
                                    </div>
                                    <p class="queue-opening-step__hint">${escapeHtml(step.hint)}</p>
                                    <p class="queue-opening-step__evidence">${escapeHtml(evidence)}</p>
                                    <div class="queue-opening-step__actions">
                                        <a
                                            href="${escapeHtml(step.href)}"
                                            target="_blank"
                                            rel="noopener"
                                            class="queue-opening-step__primary"
                                        >
                                            ${escapeHtml(step.actionLabel)}
                                        </a>
                                        <button
                                            id="queueOpeningToggle_${escapeHtml(step.id)}"
                                            type="button"
                                            class="queue-opening-step__toggle"
                                            data-queue-opening-step="${escapeHtml(step.id)}"
                                            data-state="${stepState}"
                                        >
                                            ${
                                                isReady
                                                    ? 'Marcar pendiente'
                                                    : isSuggested
                                                      ? 'Confirmar sugerido'
                                                      : 'Marcar listo'
                                            }
                                        </button>
                                    </div>
                                </article>
                            `;
                        })
                        .join('')}
                </div>
            </section>
        `
    );

    root.querySelectorAll('[data-queue-opening-step]').forEach((button) => {
        if (!(button instanceof HTMLButtonElement)) {
            return;
        }
        button.onclick = () => {
            const stepId = String(button.dataset.queueOpeningStep || '');
            const current = ensureOpeningChecklistState();
            const nextValue = !Boolean(current.steps[stepId]);
            setOpeningChecklistStep(stepId, nextValue);
            renderQueueOpsPilot(manifest, detectedPlatform);
            renderOpeningChecklist(manifest, detectedPlatform);
        };
    });

    const applyButton = document.getElementById('queueOpeningChecklistApplyBtn');
    if (applyButton instanceof HTMLButtonElement) {
        applyButton.onclick = () => {
            if (!assist.suggestedIds.length) {
                return;
            }
            applyOpeningChecklistSuggestions(assist.suggestedIds);
            renderQueueOpsPilot(manifest, detectedPlatform);
            renderOpeningChecklist(manifest, detectedPlatform);
        };
    }

    const resetButton = document.getElementById('queueOpeningChecklistResetBtn');
    if (resetButton instanceof HTMLButtonElement) {
        resetButton.onclick = () => {
            resetOpeningChecklistState();
            renderQueueOpsPilot(manifest, detectedPlatform);
            renderOpeningChecklist(manifest, detectedPlatform);
        };
    }
}

function renderInstallConfigurator(manifest, detectedPlatform) {
    const root = document.getElementById('queueInstallConfigurator');
    if (!(root instanceof HTMLElement)) {
        return;
    }

    const preset = ensureInstallPreset(detectedPlatform);
    const surfaceKey =
        preset.surface === 'kiosk' || preset.surface === 'sala_tv'
            ? preset.surface
            : 'operator';
    const appConfig = manifest[surfaceKey];
    if (!appConfig) {
        root.innerHTML = '';
        return;
    }

    const targetKey =
        surfaceKey === 'sala_tv'
            ? 'android_tv'
            : preset.platform === 'mac'
              ? 'mac'
              : 'win';
    const downloadTarget =
        (appConfig.targets && appConfig.targets[targetKey]) ||
        getDesktopTarget(appConfig, detectedPlatform) ||
        null;
    const preparedWebUrl = buildPreparedSurfaceUrl(surfaceKey, appConfig, preset);
    const qrUrl =
        surfaceKey === 'sala_tv'
            ? buildQrUrl((downloadTarget && downloadTarget.url) || preparedWebUrl)
            : buildQrUrl(preparedWebUrl);
    const guideUrl = buildGuideUrl(surfaceKey, preset, appConfig);
    const setupSteps = buildPresetSteps(preset)
        .map((step) => `<li>${escapeHtml(step)}</li>`)
        .join('');

    setHtml(
        '#queueInstallConfigurator',
        `
            <div class="queue-install-configurator__grid">
                <section class="queue-install-configurator__panel">
                    <div>
                        <p class="queue-app-card__eyebrow">Preparar equipo</p>
                        <h5 class="queue-app-card__title">Asistente de instalación</h5>
                        <p class="queue-app-card__description">
                            Genera el perfil recomendado para cada equipo y copia la ruta exacta antes de instalar.
                        </p>
                    </div>
                    <div class="queue-install-configurator__fields">
                        <label class="queue-install-field" for="queueInstallSurfaceSelect">
                            <span>Equipo</span>
                            <select id="queueInstallSurfaceSelect">
                                <option value="operator"${surfaceKey === 'operator' ? ' selected' : ''}>Operador</option>
                                <option value="kiosk"${surfaceKey === 'kiosk' ? ' selected' : ''}>Kiosco</option>
                                <option value="sala_tv"${surfaceKey === 'sala_tv' ? ' selected' : ''}>Sala TV</option>
                            </select>
                        </label>
                        ${
                            surfaceKey === 'operator'
                                ? `
                                    <label class="queue-install-field" for="queueInstallProfileSelect">
                                        <span>Perfil operador</span>
                                        <select id="queueInstallProfileSelect">
                                            <option value="c1_locked"${
                                                preset.lock && preset.station === 'c1'
                                                    ? ' selected'
                                                    : ''
                                            }>C1 fijo</option>
                                            <option value="c2_locked"${
                                                preset.lock && preset.station === 'c2'
                                                    ? ' selected'
                                                    : ''
                                            }>C2 fijo</option>
                                            <option value="free"${
                                                !preset.lock ? ' selected' : ''
                                            }>Modo libre</option>
                                        </select>
                                    </label>
                                `
                                : ''
                        }
                        ${
                            surfaceKey !== 'sala_tv'
                                ? `
                                    <label class="queue-install-field" for="queueInstallPlatformSelect">
                                        <span>Plataforma</span>
                                        <select id="queueInstallPlatformSelect">
                                            <option value="win"${
                                                preset.platform === 'win' ? ' selected' : ''
                                            }>Windows</option>
                                            <option value="mac"${
                                                preset.platform === 'mac' ? ' selected' : ''
                                            }>macOS</option>
                                        </select>
                                    </label>
                                `
                                : ''
                        }
                        ${
                            surfaceKey === 'operator'
                                ? `
                                    <label class="queue-install-toggle">
                                        <input id="queueInstallOneTapInput" type="checkbox"${
                                            preset.oneTap ? ' checked' : ''
                                        } />
                                        <span>Activar 1 tecla para este operador</span>
                                    </label>
                                `
                                : ''
                        }
                    </div>
                </section>
                <section class="queue-install-configurator__panel queue-install-configurator__result">
                    <div>
                        <p class="queue-app-card__eyebrow">Resultado listo</p>
                        <h5 class="queue-app-card__title">${escapeHtml(
                            buildPresetSummaryTitle(preset)
                        )}</h5>
                        <p class="queue-app-card__description">
                            ${
                                surfaceKey === 'sala_tv'
                                    ? 'Usa el APK para la TV y mantén el fallback web como respaldo.'
                                    : 'Descarga la app correcta y usa la ruta preparada como validación o respaldo.'
                            }
                        </p>
                    </div>
                    <div class="queue-install-result__chips">
                        <span class="queue-app-card__tag">
                            ${escapeHtml(
                                downloadTarget && downloadTarget.label
                                    ? downloadTarget.label
                                    : 'Perfil listo'
                            )}
                        </span>
                        ${
                            surfaceKey === 'operator'
                                ? `<span class="queue-app-card__tag">${
                                      preset.lock
                                          ? preset.station === 'c2'
                                              ? 'C2 bloqueado'
                                              : 'C1 bloqueado'
                                          : 'Modo libre'
                                  }</span>`
                                : ''
                        }
                    </div>
                    <div class="queue-install-result__meta">
                        <span>Descarga recomendada</span>
                        <strong>${escapeHtml(
                            (downloadTarget && downloadTarget.url) || 'Sin artefacto'
                        )}</strong>
                    </div>
                    <div class="queue-install-result__meta">
                        <span>Ruta web preparada</span>
                        <strong>${escapeHtml(preparedWebUrl)}</strong>
                    </div>
                    <div class="queue-install-configurator__actions">
                        ${
                            downloadTarget && downloadTarget.url
                                ? `<a href="${escapeHtml(
                                      downloadTarget.url
                                  )}" class="queue-app-card__cta-primary" download>Descargar artefacto</a>`
                                : ''
                        }
                        <button
                            type="button"
                            data-action="queue-copy-install-link"
                            data-queue-install-url="${escapeHtml(
                                absoluteUrl((downloadTarget && downloadTarget.url) || '')
                            )}"
                        >
                            Copiar descarga
                        </button>
                        <a href="${escapeHtml(preparedWebUrl)}" target="_blank" rel="noopener">
                            Abrir ruta preparada
                        </a>
                        <button
                            type="button"
                            data-action="queue-copy-install-link"
                            data-queue-install-url="${escapeHtml(preparedWebUrl)}"
                        >
                            Copiar ruta preparada
                        </button>
                        <a href="${escapeHtml(qrUrl)}" target="_blank" rel="noopener">
                            Mostrar QR
                        </a>
                        <a href="${escapeHtml(guideUrl)}" target="_blank" rel="noopener">
                            Abrir centro público
                        </a>
                    </div>
                    <ul class="queue-app-card__notes">${setupSteps}</ul>
                </section>
            </div>
        `
    );

    const surfaceSelect = document.getElementById('queueInstallSurfaceSelect');
    if (surfaceSelect instanceof HTMLSelectElement) {
        surfaceSelect.onchange = () => {
            installPreset = {
                ...preset,
                surface: surfaceSelect.value,
            };
            renderQueueOpsPilot(manifest, detectedPlatform);
            renderSurfaceTelemetry(manifest, detectedPlatform);
            renderContingencyDeck(manifest, detectedPlatform);
            renderOpeningChecklist(manifest, detectedPlatform);
            renderInstallConfigurator(manifest, detectedPlatform);
        };
    }

    const profileSelect = document.getElementById('queueInstallProfileSelect');
    if (profileSelect instanceof HTMLSelectElement) {
        profileSelect.onchange = () => {
            installPreset = {
                ...preset,
                station: profileSelect.value === 'c2_locked' ? 'c2' : 'c1',
                lock: profileSelect.value !== 'free',
            };
            renderQueueOpsPilot(manifest, detectedPlatform);
            renderSurfaceTelemetry(manifest, detectedPlatform);
            renderContingencyDeck(manifest, detectedPlatform);
            renderOpeningChecklist(manifest, detectedPlatform);
            renderInstallConfigurator(manifest, detectedPlatform);
        };
    }

    const platformSelect = document.getElementById('queueInstallPlatformSelect');
    if (platformSelect instanceof HTMLSelectElement) {
        platformSelect.onchange = () => {
            installPreset = {
                ...preset,
                platform: platformSelect.value === 'mac' ? 'mac' : 'win',
            };
            renderQueueOpsPilot(manifest, detectedPlatform);
            renderSurfaceTelemetry(manifest, detectedPlatform);
            renderContingencyDeck(manifest, detectedPlatform);
            renderOpeningChecklist(manifest, detectedPlatform);
            renderInstallConfigurator(manifest, detectedPlatform);
        };
    }

    const oneTapInput = document.getElementById('queueInstallOneTapInput');
    if (oneTapInput instanceof HTMLInputElement) {
        oneTapInput.onchange = () => {
            installPreset = {
                ...preset,
                oneTap: oneTapInput.checked,
            };
            renderQueueOpsPilot(manifest, detectedPlatform);
            renderSurfaceTelemetry(manifest, detectedPlatform);
            renderContingencyDeck(manifest, detectedPlatform);
            renderOpeningChecklist(manifest, detectedPlatform);
            renderInstallConfigurator(manifest, detectedPlatform);
        };
    }
}

export function renderQueueInstallHub() {
    const cardsRoot = document.getElementById('queueAppDownloadsCards');
    if (!(cardsRoot instanceof HTMLElement)) {
        return;
    }

    const platform = detectPlatform();
    const platformChip = document.getElementById('queueAppsPlatformChip');
    const platformLabel =
        platform === 'mac'
            ? 'macOS detectado'
            : platform === 'win'
              ? 'Windows detectado'
              : 'Selecciona la plataforma del equipo';
    setText('#queueAppsPlatformChip', platformLabel);
    if (platformChip instanceof HTMLElement) {
        platformChip.setAttribute('data-platform', platform);
    }

    const manifest = mergeManifest();
    setHtml(
        '#queueAppDownloadsCards',
        [
            renderDesktopCard('operator', manifest.operator, platform),
            renderDesktopCard('kiosk', manifest.kiosk, platform),
            renderTvCard(manifest.sala_tv),
        ].join('')
    );
    renderQueueOpsPilot(manifest, platform);
    renderSurfaceTelemetry(manifest, platform);
    renderContingencyDeck(manifest, platform);
    renderOpeningChecklist(manifest, platform);
    renderInstallConfigurator(manifest, platform);
}
