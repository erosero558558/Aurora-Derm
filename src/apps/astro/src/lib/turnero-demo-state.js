const DEMO_STATE_VERSION = 'turnero-demo-state-v1';

const BASE_STATE = Object.freeze({
    generatedAt: '2026-03-11T09:32:00-05:00',
    site: {
        name: 'North pilot site',
        sites: 1,
        rooms: 3,
        timezone: 'America/Guayaquil',
    },
    queue: {
        currentTicket: 'A-041',
        currentInitials: 'EP',
        currentRoom: 'Consultorio 2',
        nextTicket: 'A-042',
        estimatedWaitMinutes: 6,
        averageWaitMinutes: 8,
        noShowRatePct: 6.2,
        servedToday: 124,
        topRoomLoadPct: 41,
        lastUpdateSeconds: 12,
    },
    kiosk: {
        channels: ['QR', 'WhatsApp', 'SMS'],
        offlineOutboxPending: 2,
        heartbeatSeconds: 11,
        thermalFallback: 'web-ticket-ready',
    },
    operator: {
        heartbeatSeconds: 9,
        syncState: 'live',
        reprintFallback: true,
    },
    display: {
        heartbeatSeconds: 14,
        snapshotAgeSeconds: 52,
        bellState: 'primed',
    },
    releases: {
        operator: 'stable-2026.03.1',
        kiosk: 'stable-2026.03.1',
        salaTv: 'stable-2026.03.1',
    },
});

const COPY = {
    es: {
        cta: {
            bookDemo: 'Agendar demo',
            requestPilot: 'Solicitar piloto',
            viewDemo: 'Ver demo',
            viewDashboard: 'Ver dashboard de sede',
        },
        pilotHref:
            'https://wa.me/593982453672?text=Hola%2C%20quiero%20solicitar%20un%20piloto%20del%20turnero%20para%20clinicas',
        proof: {
            eyebrow: 'Sandbox canonico',
            title: 'Prueba operativa visible para la compra',
            deck: 'La misma base sandbox alimenta landing, check-in, estado del turno y dashboard. No son mockups aislados.',
            items: {
                kioskOutbox: {
                    label: 'Kiosco offline',
                    detail: 'Outbox listo para seguir capturando llegadas aunque la red se degrade.',
                },
                printFallback: {
                    label: 'Fallback de impresion',
                    detail: 'Recepcion puede reimprimir desde la web sin cortar la cola.',
                },
                displaySnapshot: {
                    label: 'Snapshot de Sala TV',
                    detail: 'La sala conserva el ultimo estado visible mientras la pantalla reconecta.',
                },
                heartbeats: {
                    label: 'Heartbeats por superficie',
                    detail: 'Pulso separado para operador, kiosco y TV de sala.',
                },
                releases: {
                    label: 'Releases nativos',
                    detail: 'Operador, kiosco y Sala TV siguen el mismo canal estable.',
                },
            },
        },
        demo: {
            heroMetrics: [
                {
                    value: '3',
                    label: 'canales de llegada',
                    detail: 'QR, WhatsApp y SMS activan el mismo check-in sandbox.',
                },
                {
                    value: '06 min',
                    label: 'espera estimada',
                    detail: 'La cifra coincide con estado del turno y dashboard.',
                },
                {
                    value: 'Outbox 2',
                    label: 'tickets offline en cola',
                    detail: 'El kiosco puede seguir capturando y sincronizar despues.',
                },
            ],
            mockupFooter:
                'El ticket, la espera y el outbox salen del mismo sandbox canonico.',
        },
        status: {
            heroMetrics: [
                {
                    value: 'A-041',
                    label: 'llamando ahora',
                    detail: 'El mismo ticket visible en sala, recepcion y celular.',
                },
                {
                    value: 'A-042',
                    label: 'siguiente ticket',
                    detail: 'La siguiente posicion se comparte con el display y la cola admin.',
                },
                {
                    value: '12 s',
                    label: 'ultima actualizacion',
                    detail: 'El estado publico y el heartbeat usan la misma base sandbox.',
                },
            ],
            mockupFooter:
                'La vista privada lee el mismo llamado actual y el mismo snapshot que Sala TV.',
        },
        dashboard: {
            heroMetrics: [
                {
                    value: '08 min',
                    label: 'espera media',
                    detail: 'Comparada contra la semana previa y el objetivo diario.',
                },
                {
                    value: '6.2%',
                    label: 'no-show',
                    detail: 'La reduccion ya conversa con recordatorios y check-in previo.',
                },
                {
                    value: '124',
                    label: 'tickets atendidos hoy',
                    detail: 'La lectura por sede y consultorio sale del mismo sandbox.',
                },
            ],
            mockupFooter:
                'Gerencia ve los mismos numeros que la landing promete.',
        },
    },
    en: {
        cta: {
            bookDemo: 'Book demo',
            requestPilot: 'Request pilot',
            viewDemo: 'See demo',
            viewDashboard: 'See site dashboard',
        },
        pilotHref:
            'https://wa.me/593982453672?text=Hello%2C%20I%20want%20to%20request%20a%20pilot%20for%20the%20clinic%20flow%20suite',
        proof: {
            eyebrow: 'Canonical sandbox',
            title: 'Visible operating proof for the buyer',
            deck: 'The same sandbox powers landing, check-in, queue status, and dashboard. These are not isolated mockups.',
            items: {
                kioskOutbox: {
                    label: 'Offline kiosk',
                    detail: 'The outbox keeps capturing arrivals even when the network degrades.',
                },
                printFallback: {
                    label: 'Print fallback',
                    detail: 'Reception can reprint from the web without stopping the queue.',
                },
                displaySnapshot: {
                    label: 'Waiting-room snapshot',
                    detail: 'The room keeps the last known state visible while the display reconnects.',
                },
                heartbeats: {
                    label: 'Surface heartbeats',
                    detail: 'Operator, kiosk, and room display each expose their own pulse.',
                },
                releases: {
                    label: 'Native releases',
                    detail: 'Operator, kiosk, and Sala TV follow the same stable release lane.',
                },
            },
        },
        demo: {
            heroMetrics: [
                {
                    value: '3',
                    label: 'arrival channels',
                    detail: 'QR, WhatsApp, and SMS activate the same sandbox check-in.',
                },
                {
                    value: '06 min',
                    label: 'estimated wait',
                    detail: 'The value matches queue status and dashboard.',
                },
                {
                    value: 'Outbox 2',
                    label: 'offline tickets pending',
                    detail: 'The kiosk keeps capturing and syncs later.',
                },
            ],
            mockupFooter:
                'Ticket, wait time, and offline queue all come from the same canonical sandbox.',
        },
        status: {
            heroMetrics: [
                {
                    value: 'A-041',
                    label: 'calling now',
                    detail: 'The same live ticket appears on phone, reception, and room display.',
                },
                {
                    value: 'A-042',
                    label: 'next ticket',
                    detail: 'The next position is shared across the public and admin views.',
                },
                {
                    value: '12 s',
                    label: 'last update',
                    detail: 'The public surface and heartbeat read from the same sandbox.',
                },
            ],
            mockupFooter:
                'The private phone view reads the same live call and the same display snapshot.',
        },
        dashboard: {
            heroMetrics: [
                {
                    value: '08 min',
                    label: 'average wait',
                    detail: 'Compared against the previous week and the daily target.',
                },
                {
                    value: '6.2%',
                    label: 'no-show',
                    detail: 'Already tied to reminders and pre-arrival confirmation.',
                },
                {
                    value: '124',
                    label: 'served tickets today',
                    detail: 'Site and room reporting comes from the same sandbox.',
                },
            ],
            mockupFooter:
                'Management sees the same numbers the landing is selling.',
        },
    },
};

function normalizeLocale(locale) {
    return locale === 'en' ? 'en' : 'es';
}

function cloneAction(action) {
    if (!action || typeof action !== 'object') {
        return null;
    }
    return {
        label: String(action.label || '').trim(),
        href: String(action.href || '').trim(),
        variant: String(action.variant || '').trim() || 'secondary',
    };
}

function withPaddedMinutes(value) {
    return `${String(Math.max(0, Number(value || 0))).padStart(2, '0')} min`;
}

function withSeconds(value) {
    return `${Math.max(0, Number(value || 0))} s`;
}

function withPercent(value) {
    const safeValue = Number(value || 0);
    return `${safeValue.toFixed(1)}%`;
}

function withInteger(value) {
    return String(Math.max(0, Number(value || 0)));
}

function routeHref(suiteRoutes, pageKey) {
    return (
        (Array.isArray(suiteRoutes)
            ? suiteRoutes.find((route) => route?.pageKey === pageKey)
            : null
        )?.href || ''
    );
}

function proofItems(locale, state) {
    const copy = COPY[locale].proof.items;
    return [
        {
            id: 'kiosk-outbox',
            label: copy.kioskOutbox.label,
            value: `Outbox ${withInteger(state.kiosk.offlineOutboxPending)}`,
            detail: copy.kioskOutbox.detail,
        },
        {
            id: 'print-fallback',
            label: copy.printFallback.label,
            value: locale === 'en' ? 'Web ticket ready' : 'Web ticket listo',
            detail: copy.printFallback.detail,
        },
        {
            id: 'display-snapshot',
            label: copy.displaySnapshot.label,
            value: `Snapshot ${withSeconds(state.display.snapshotAgeSeconds)}`,
            detail: copy.displaySnapshot.detail,
        },
        {
            id: 'surface-heartbeats',
            label: copy.heartbeats.label,
            value:
                locale === 'en'
                    ? `Op ${state.operator.heartbeatSeconds}s | Kiosk ${state.kiosk.heartbeatSeconds}s | TV ${state.display.heartbeatSeconds}s`
                    : `Op ${state.operator.heartbeatSeconds}s | Kiosco ${state.kiosk.heartbeatSeconds}s | TV ${state.display.heartbeatSeconds}s`,
            detail: copy.heartbeats.detail,
        },
        {
            id: 'native-releases',
            label: copy.releases.label,
            value: state.releases.operator,
            detail: copy.releases.detail,
        },
    ];
}

function landingSurfacePresentation(locale, state) {
    return {
        demo: {
            chips: state.kiosk.channels.slice(),
            rows: [
                {
                    label: locale === 'en' ? 'Scheduled' : 'Tengo cita',
                    value:
                        locale === 'en'
                            ? 'Confirm arrival'
                            : 'Confirmar llegada',
                    meta:
                        locale === 'en'
                            ? `${state.queue.currentTicket} already linked to the live queue`
                            : `${state.queue.currentTicket} ya vinculado a la cola en vivo`,
                },
                {
                    label:
                        locale === 'en' ? 'Estimated wait' : 'Espera estimada',
                    value: withPaddedMinutes(state.queue.estimatedWaitMinutes),
                    meta:
                        locale === 'en'
                            ? `Offline outbox: ${state.kiosk.offlineOutboxPending}`
                            : `Outbox offline: ${state.kiosk.offlineOutboxPending}`,
                },
                {
                    label: locale === 'en' ? 'Fallback' : 'Fallback',
                    value:
                        locale === 'en'
                            ? 'Web ticket ready'
                            : 'Web ticket listo',
                    meta:
                        locale === 'en'
                            ? `Heartbeat ${withSeconds(state.kiosk.heartbeatSeconds)}`
                            : `Heartbeat ${withSeconds(state.kiosk.heartbeatSeconds)}`,
                },
            ],
            footer:
                locale === 'en'
                    ? 'Ideal for reminder links, QR signage, and front-desk fallback.'
                    : 'Ideal para QR en cita, lobby, WhatsApp y fallback de recepcion.',
        },
        status: {
            chips:
                locale === 'en'
                    ? ['Privacy active', 'Live queue', 'Room view']
                    : ['Privacidad activa', 'Cola live', 'Vista de sala'],
            rows: [
                {
                    label: locale === 'en' ? 'Calling now' : 'Llamando ahora',
                    value: state.queue.currentTicket,
                    meta:
                        locale === 'en'
                            ? `${state.queue.currentRoom} | ${state.queue.currentInitials}`
                            : `${state.queue.currentRoom} | Iniciales ${state.queue.currentInitials}`,
                },
                {
                    label: locale === 'en' ? 'Next ticket' : 'Siguiente ticket',
                    value: state.queue.nextTicket,
                    meta: `${withPaddedMinutes(state.queue.estimatedWaitMinutes)} ${
                        locale === 'en' ? 'estimated' : 'estimados'
                    }`,
                },
                {
                    label:
                        locale === 'en'
                            ? 'Display snapshot'
                            : 'Snapshot sala TV',
                    value: withSeconds(state.display.snapshotAgeSeconds),
                    meta:
                        locale === 'en'
                            ? `Heartbeat ${withSeconds(state.display.heartbeatSeconds)}`
                            : `Heartbeat ${withSeconds(state.display.heartbeatSeconds)}`,
                },
            ],
            footer:
                locale === 'en'
                    ? 'Patients see the same current call the waiting-room screen is showing.'
                    : 'El paciente ve el mismo llamado que la pantalla de sala esta publicando.',
        },
        dashboard: {
            chips:
                locale === 'en'
                    ? ['Pilot site', 'Today', `${state.site.rooms} rooms`]
                    : [
                          'Sede piloto',
                          'Hoy',
                          `${state.site.rooms} consultorios`,
                      ],
            rows: [
                {
                    label: locale === 'en' ? 'Average wait' : 'Espera media',
                    value: withPaddedMinutes(state.queue.averageWaitMinutes),
                    meta:
                        locale === 'en'
                            ? '-18% vs last week'
                            : '-18% vs semana pasada',
                },
                {
                    label: locale === 'en' ? 'No-show' : 'No-show',
                    value: withPercent(state.queue.noShowRatePct),
                    meta:
                        locale === 'en'
                            ? 'With reminders and pre-arrival confirmation'
                            : 'Con recordatorios y confirmacion previa',
                },
                {
                    label:
                        locale === 'en'
                            ? 'Served tickets'
                            : 'Tickets atendidos',
                    value: withInteger(state.queue.servedToday),
                    meta:
                        locale === 'en'
                            ? `Top room load ${state.queue.topRoomLoadPct}%`
                            : `Carga punta ${state.queue.topRoomLoadPct}%`,
                },
            ],
            footer:
                locale === 'en'
                    ? 'A buyer sees renewal logic, not just another operations dashboard.'
                    : 'Gerencia ve una razon de compra, no solo otro panel operativo.',
        },
    };
}

function pagePresentation(locale, state) {
    const copy = COPY[locale];
    return {
        demo: {
            heroMetrics: copy.demo.heroMetrics,
            mockup: {
                chips: state.kiosk.channels.slice(),
                rows: [
                    {
                        label: locale === 'en' ? 'Flow' : 'Flujo',
                        value: locale === 'en' ? 'Scheduled' : 'Tengo cita',
                        meta:
                            locale === 'en'
                                ? 'Reminder, QR, or direct link'
                                : 'Recordatorio, QR o enlace directo',
                    },
                    {
                        label: locale === 'en' ? 'Ticket' : 'Turno',
                        value: state.queue.currentTicket,
                        meta:
                            locale === 'en'
                                ? 'Already attached to the live waiting-room queue'
                                : 'Ya vinculado a la cola en vivo de sala',
                    },
                    {
                        label:
                            locale === 'en'
                                ? 'Estimated wait'
                                : 'Espera estimada',
                        value: withPaddedMinutes(
                            state.queue.estimatedWaitMinutes
                        ),
                        meta:
                            locale === 'en'
                                ? `Offline outbox ${withInteger(
                                      state.kiosk.offlineOutboxPending
                                  )}`
                                : `Outbox offline ${withInteger(
                                      state.kiosk.offlineOutboxPending
                                  )}`,
                    },
                ],
                footer: copy.demo.mockupFooter,
            },
        },
        status: {
            heroMetrics: copy.status.heroMetrics,
            mockup: {
                chips:
                    locale === 'en'
                        ? ['Privacy active', 'Room A', 'Live']
                        : ['Privacidad activa', 'Sala A', 'Live'],
                rows: [
                    {
                        label:
                            locale === 'en' ? 'Calling now' : 'Llamando ahora',
                        value: state.queue.currentTicket,
                        meta:
                            locale === 'en'
                                ? `${state.queue.currentRoom} | Initials ${state.queue.currentInitials}`
                                : `${state.queue.currentRoom} | Iniciales ${state.queue.currentInitials}`,
                    },
                    {
                        label:
                            locale === 'en'
                                ? 'Next ticket'
                                : 'Siguiente ticket',
                        value: state.queue.nextTicket,
                        meta:
                            locale === 'en'
                                ? `${withPaddedMinutes(
                                      state.queue.estimatedWaitMinutes
                                  )} estimated`
                                : `${withPaddedMinutes(
                                      state.queue.estimatedWaitMinutes
                                  )} estimados`,
                    },
                    {
                        label: locale === 'en' ? 'Connection' : 'Conexion',
                        value:
                            locale === 'en'
                                ? 'Reception connected'
                                : 'Recepcion conectada',
                        meta:
                            locale === 'en'
                                ? `Snapshot ${withSeconds(
                                      state.display.snapshotAgeSeconds
                                  )}`
                                : `Snapshot ${withSeconds(
                                      state.display.snapshotAgeSeconds
                                  )}`,
                    },
                ],
                footer: copy.status.mockupFooter,
            },
        },
        dashboard: {
            heroMetrics: copy.dashboard.heroMetrics,
            mockup: {
                chips:
                    locale === 'en'
                        ? ['Today', `${state.site.rooms} rooms`, '1 pilot site']
                        : [
                              'Hoy',
                              `${state.site.rooms} consultorios`,
                              '1 sede piloto',
                          ],
                rows: [
                    {
                        label:
                            locale === 'en' ? 'Average wait' : 'Espera media',
                        value: withPaddedMinutes(
                            state.queue.averageWaitMinutes
                        ),
                        meta:
                            locale === 'en'
                                ? '-18% vs last week'
                                : '-18% vs semana pasada',
                    },
                    {
                        label: locale === 'en' ? 'No-show' : 'No-show',
                        value: withPercent(state.queue.noShowRatePct),
                        meta:
                            locale === 'en'
                                ? 'Pre-arrival confirmations active'
                                : 'Confirmaciones previas activas',
                    },
                    {
                        label:
                            locale === 'en'
                                ? 'Served tickets'
                                : 'Tickets atendidos',
                        value: withInteger(state.queue.servedToday),
                        meta:
                            locale === 'en'
                                ? `Top room load ${state.queue.topRoomLoadPct}%`
                                : `Carga punta ${state.queue.topRoomLoadPct}%`,
                    },
                    {
                        label:
                            locale === 'en'
                                ? 'Last update'
                                : 'Ultima actualizacion',
                        value: withSeconds(state.queue.lastUpdateSeconds),
                        meta:
                            locale === 'en'
                                ? 'Shared with the public queue status'
                                : 'Compartida con el estado del turno',
                    },
                ],
                footer: copy.dashboard.mockupFooter,
            },
        },
    };
}

function primaryAction(locale, actions) {
    const existing = Array.isArray(actions)
        ? actions
              .map(cloneAction)
              .find(
                  (action) =>
                      action &&
                      action.label &&
                      action.href &&
                      action.variant === 'primary'
              )
        : null;
    if (existing) {
        return existing;
    }
    return {
        label: COPY[locale].cta.bookDemo,
        href:
            locale === 'en'
                ? 'https://wa.me/593982453672?text=Hello%2C%20I%20want%20to%20book%20a%20demo%20of%20the%20clinic%20flow%20suite'
                : 'https://wa.me/593982453672?text=Hola%2C%20quiero%20agendar%20una%20demo%20del%20turnero%20para%20clinicas',
        variant: 'primary',
    };
}

function pilotAction(locale) {
    return {
        label: COPY[locale].cta.requestPilot,
        href: COPY[locale].pilotHref,
        variant: 'secondary',
    };
}

function demoAction(locale, suiteRoutes) {
    const href = routeHref(suiteRoutes, 'demo');
    return href
        ? {
              label: COPY[locale].cta.viewDemo,
              href,
              variant: 'ghost',
          }
        : null;
}

function dashboardAction(locale, suiteRoutes) {
    const href = routeHref(suiteRoutes, 'dashboard');
    return href
        ? {
              label: COPY[locale].cta.viewDashboard,
              href,
              variant: 'ghost',
          }
        : null;
}

export function buildTurneroDemoState(locale = 'es') {
    const safeLocale = normalizeLocale(locale);
    const state = {
        version: DEMO_STATE_VERSION,
        locale: safeLocale,
        generatedAt: BASE_STATE.generatedAt,
        site: { ...BASE_STATE.site },
        queue: { ...BASE_STATE.queue },
        kiosk: {
            ...BASE_STATE.kiosk,
            channels: BASE_STATE.kiosk.channels.slice(),
        },
        operator: { ...BASE_STATE.operator },
        display: { ...BASE_STATE.display },
        releases: { ...BASE_STATE.releases },
    };

    return {
        ...state,
        proof: {
            eyebrow: COPY[safeLocale].proof.eyebrow,
            title: COPY[safeLocale].proof.title,
            deck: COPY[safeLocale].proof.deck,
            items: proofItems(safeLocale, state),
        },
        presentation: {
            landing: {
                surfaceCards: landingSurfacePresentation(safeLocale, state),
            },
            pages: pagePresentation(safeLocale, state),
        },
    };
}

export function enhanceSoftwareLandingPage({
    page = {},
    locale = 'es',
    suiteRoutes = [],
    demoState = null,
} = {}) {
    const safeLocale = normalizeLocale(locale);
    const safeDemoState = demoState || buildTurneroDemoState(safeLocale);
    const landingPresentation =
        safeDemoState?.presentation?.landing &&
        typeof safeDemoState.presentation.landing === 'object'
            ? safeDemoState.presentation.landing
            : {};
    const surfaceCards = Array.isArray(page?.surfaces?.cards)
        ? page.surfaces.cards.map((card) => {
              const presentation =
                  landingPresentation?.surfaceCards?.[card?.pageKey] || null;
              if (!presentation) {
                  return card;
              }
              return {
                  ...card,
                  mockup: {
                      ...(card?.mockup && typeof card.mockup === 'object'
                          ? card.mockup
                          : {}),
                      chips: Array.isArray(presentation.chips)
                          ? presentation.chips
                          : [],
                      rows: Array.isArray(presentation.rows)
                          ? presentation.rows
                          : [],
                      footer: String(presentation.footer || '').trim(),
                  },
              };
          })
        : [];
    const leadAction = primaryAction(safeLocale, page?.hero?.actions);
    const nextHeroActions = [
        leadAction,
        pilotAction(safeLocale),
        demoAction(safeLocale, suiteRoutes),
        dashboardAction(safeLocale, suiteRoutes),
    ].filter(Boolean);
    const nextFinalActions = [
        leadAction,
        pilotAction(safeLocale),
        demoAction(safeLocale, suiteRoutes),
    ].filter(Boolean);

    return {
        ...page,
        demoState: safeDemoState,
        hero: {
            ...(page?.hero && typeof page.hero === 'object' ? page.hero : {}),
            actions: nextHeroActions,
        },
        surfaces: {
            ...(page?.surfaces && typeof page.surfaces === 'object'
                ? page.surfaces
                : {}),
            cards: surfaceCards,
        },
        finalCta: {
            ...(page?.finalCta && typeof page.finalCta === 'object'
                ? page.finalCta
                : {}),
            actions: nextFinalActions,
        },
    };
}

export function enhanceSoftwareSurfacePage({
    page = {},
    locale = 'es',
    pageKey = 'demo',
    demoState = null,
} = {}) {
    const safeLocale = normalizeLocale(locale);
    const safeDemoState = demoState || buildTurneroDemoState(safeLocale);
    const surfacePresentation =
        safeDemoState?.presentation?.pages &&
        typeof safeDemoState.presentation.pages === 'object'
            ? safeDemoState.presentation.pages[pageKey]
            : null;
    if (!surfacePresentation) {
        return {
            ...page,
            demoState: safeDemoState,
        };
    }

    return {
        ...page,
        demoState: safeDemoState,
        hero: {
            ...(page?.hero && typeof page.hero === 'object' ? page.hero : {}),
            metrics: Array.isArray(surfacePresentation.heroMetrics)
                ? surfacePresentation.heroMetrics
                : [],
        },
        mockup: {
            ...(page?.mockup && typeof page.mockup === 'object'
                ? page.mockup
                : {}),
            chips: Array.isArray(surfacePresentation?.mockup?.chips)
                ? surfacePresentation.mockup.chips
                : [],
            rows: Array.isArray(surfacePresentation?.mockup?.rows)
                ? surfacePresentation.mockup.rows
                : [],
            footer: String(surfacePresentation?.mockup?.footer || '').trim(),
        },
    };
}
