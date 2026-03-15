// @ts-check
const { test, expect } = require('@playwright/test');
const {
    buildAdminDataPayload,
    installBasicAdminApiMocks,
} = require('./helpers/admin-api-mocks');
const { installLegacyAdminAuthMock } = require('./helpers/admin-auth-mocks');

function json(route, payload, status = 200) {
    return route.fulfill({
        status,
        contentType: 'application/json; charset=utf-8',
        body: JSON.stringify(payload),
    });
}

const ADMIN_UI_VARIANT = 'sony_v3';

function adminUrl(query = '') {
    const params = new URLSearchParams(String(query || ''));
    const search = params.toString();
    return `/admin.html${search ? `?${search}` : ''}`;
}

function installQueueAdminAuthMock(page, csrfToken) {
    return installLegacyAdminAuthMock(page, { csrfToken });
}

function buildQueueMetaFromState(state) {
    const byConsultorio = { 1: null, 2: null };
    for (const ticket of state.callingNow || []) {
        const room = String(ticket.assignedConsultorio || '');
        if (room === '1' || room === '2') {
            byConsultorio[room] = ticket;
        }
    }
    return {
        updatedAt: state.updatedAt,
        waitingCount: state.waitingCount,
        calledCount: state.calledCount,
        estimatedWaitMin: state.estimatedWaitMin || 0,
        delayReason: state.delayReason || '',
        assistancePendingCount: state.assistancePendingCount || 0,
        activeHelpRequests: state.activeHelpRequests || [],
        recentResolvedHelpRequests: state.recentResolvedHelpRequests || [],
        counts: state.counts || {},
        callingNowByConsultorio: byConsultorio,
        nextTickets: state.nextTickets || [],
    };
}

function buildTurneroClinicProfileCatalogStatus(options = {}) {
    const clinicId = String(options.clinicId || '').trim();
    const matchingProfileId =
        options.matchingProfileId === undefined
            ? clinicId
            : String(options.matchingProfileId || '').trim();
    const catalogAvailable = options.catalogAvailable !== false;
    const catalogCount = Number(
        options.catalogCount === undefined ? 2 : options.catalogCount
    );
    const matchesCatalog = options.matchesCatalog !== false;

    return {
        catalogAvailable,
        catalogCount,
        activePath: '/content/turnero/clinic-profile.json',
        clinicId,
        matchingProfileId,
        matchingCatalogPath: matchingProfileId
            ? `/content/turnero/clinic-profiles/${matchingProfileId}.json`
            : '',
        matchesCatalog,
        ready: Boolean(catalogAvailable && matchingProfileId && matchesCatalog),
    };
}

function buildQueueIdleState(updatedAt, overrides = {}) {
    return {
        updatedAt: updatedAt || new Date().toISOString(),
        waitingCount: 0,
        calledCount: 0,
        counts: {
            waiting: 0,
            called: 0,
            completed: 0,
            no_show: 0,
            cancelled: 0,
        },
        callingNow: [],
        nextTickets: [],
        ...overrides,
    };
}

function buildQueuePilotClinicProfile(options = {}) {
    const clinicId = String(options.clinicId || 'clinica-demo').trim();
    const surfacesOverride =
        options.surfaces && typeof options.surfaces === 'object'
            ? options.surfaces
            : {};
    const releaseOverride =
        options.release && typeof options.release === 'object'
            ? options.release
            : {};
    const brandingOverride =
        options.branding && typeof options.branding === 'object'
            ? options.branding
            : {};

    return {
        schema: 'turnero-clinic-profile/v1',
        clinic_id: clinicId,
        branding: {
            name: clinicId,
            short_name: clinicId,
            base_url: `https://${clinicId}.example`,
            ...brandingOverride,
        },
        consultorios: options.consultorios || {
            c1: {
                label: 'Consultorio 1',
                short_label: 'C1',
            },
            c2: {
                label: 'Consultorio 2',
                short_label: 'C2',
            },
        },
        surfaces: {
            admin: {
                enabled: true,
                label: 'Admin web',
                route: '/admin.html#queue',
                ...(surfacesOverride.admin || {}),
            },
            operator: {
                enabled: true,
                label: 'Operador web',
                route: '/operador-turnos.html',
                ...(surfacesOverride.operator || {}),
            },
            kiosk: {
                enabled: true,
                label: 'Kiosco web',
                route: '/kiosco-turnos.html',
                ...(surfacesOverride.kiosk || {}),
            },
            display: {
                enabled: true,
                label: 'Sala web',
                route: '/sala-turnos.html',
                ...(surfacesOverride.display || {}),
            },
        },
        release: {
            mode: 'web_pilot',
            admin_mode_default: 'basic',
            separate_deploy: true,
            native_apps_blocking: false,
            ...releaseOverride,
        },
    };
}

function buildQueuePilotSurfaceStatusEntry(surface, options = {}) {
    const defaultsBySurface = {
        operator: {
            label: 'Operador',
            summary: 'Operador listo.',
            route: '/operador-turnos.html',
            deviceLabel: 'Operador principal',
        },
        kiosk: {
            label: 'Kiosco',
            summary: 'Kiosco listo.',
            route: '/kiosco-turnos.html',
            deviceLabel: 'Kiosco principal',
        },
        display: {
            label: 'Sala',
            summary: 'Sala lista.',
            route: '/sala-turnos.html',
            deviceLabel: 'Sala principal',
        },
    };

    const defaults = defaultsBySurface[surface];
    const {
        clinicId = '',
        ageSec = surface === 'operator' ? 6 : surface === 'kiosk' ? 7 : 8,
        latest: latestOverride = {},
        details: detailsOverride = {},
        instances = [],
        ...rest
    } = options;
    const latestDetailsOverride =
        latestOverride.details && typeof latestOverride.details === 'object'
            ? latestOverride.details
            : {};

    return {
        surface,
        label: defaults.label,
        status: 'ready',
        updatedAt: options.updatedAt || new Date().toISOString(),
        ageSec,
        stale: false,
        summary: defaults.summary,
        latest: {
            deviceLabel: defaults.deviceLabel,
            appMode: 'browser',
            ageSec,
            ...latestOverride,
            details: {
                clinicId,
                surfaceContractState: 'ready',
                surfaceRouteExpected: defaults.route,
                surfaceRouteCurrent: defaults.route,
                ...detailsOverride,
                ...latestDetailsOverride,
            },
        },
        instances,
        ...rest,
    };
}

function buildQueuePilotSurfaceStatus(options = {}) {
    const updatedAt = options.updatedAt || new Date().toISOString();
    return {
        operator: buildQueuePilotSurfaceStatusEntry('operator', {
            updatedAt,
            clinicId: options.clinicId || '',
            ...(options.operator || {}),
        }),
        kiosk: buildQueuePilotSurfaceStatusEntry('kiosk', {
            updatedAt,
            clinicId: options.clinicId || '',
            ...(options.kiosk || {}),
        }),
        display: buildQueuePilotSurfaceStatusEntry('display', {
            updatedAt,
            clinicId: options.clinicId || '',
            ...(options.display || {}),
        }),
    };
}

function buildQueuePilotHealthPayload(options = {}) {
    const checksOverride =
        options.checks && typeof options.checks === 'object'
            ? options.checks
            : {};
    const publicSyncOverride =
        options.publicSync && typeof options.publicSync === 'object'
            ? options.publicSync
            : {};

    return {
        ok: true,
        status: 'ok',
        checks: {
            publicSync: {
                configured: true,
                healthy: true,
                state: 'ok',
                deployedCommit: '8c4ee5cb7f2f5034f6f471234567890abcdef12',
                headDrift: false,
                ageSeconds: 18,
                failureReason: '',
                ...publicSyncOverride,
            },
            ...checksOverride,
        },
    };
}

function buildQueueStateFromTickets(queueTickets) {
    const waiting = queueTickets.filter(
        (ticket) => ticket.status === 'waiting'
    );
    const called = queueTickets.filter((ticket) => ticket.status === 'called');

    const callingNowByConsultorio = new Map();
    for (const ticket of called) {
        const room = Number(ticket.assignedConsultorio || 0);
        if ((room === 1 || room === 2) && !callingNowByConsultorio.has(room)) {
            callingNowByConsultorio.set(room, {
                id: ticket.id,
                ticketCode: ticket.ticketCode,
                patientInitials: ticket.patientInitials,
                assignedConsultorio: room,
                calledAt: ticket.calledAt || new Date().toISOString(),
            });
        }
    }

    return {
        updatedAt: new Date().toISOString(),
        waitingCount: waiting.length,
        calledCount: called.length,
        counts: {
            waiting: waiting.length,
            called: called.length,
            completed: queueTickets.filter(
                (ticket) => ticket.status === 'completed'
            ).length,
            no_show: queueTickets.filter(
                (ticket) => ticket.status === 'no_show'
            ).length,
            cancelled: queueTickets.filter(
                (ticket) => ticket.status === 'cancelled'
            ).length,
        },
        callingNow: Array.from(callingNowByConsultorio.values()),
        nextTickets: waiting.map((ticket, index) => ({
            id: ticket.id,
            ticketCode: ticket.ticketCode,
            patientInitials: ticket.patientInitials,
            position: index + 1,
        })),
    };
}

function buildQueueOperationalSurfaceStatusEntry(surface, options = {}) {
    const labels = {
        operator: 'Operador',
        kiosk: 'Kiosco',
        display: 'Sala TV',
    };

    return {
        surface,
        label: labels[surface] || surface,
        status: 'unknown',
        updatedAt: '',
        ageSec: 0,
        stale: true,
        summary: 'Sin heartbeat',
        latest: null,
        instances: [],
        ...options,
    };
}

function buildQueueUnknownOperationalSurfaceStatus(surface, options = {}) {
    return buildQueueOperationalSurfaceStatusEntry(surface, {
        status: 'unknown',
        updatedAt: '',
        ageSec: 0,
        stale: true,
        summary: 'Sin heartbeat',
        latest: null,
        instances: [],
        ...options,
    });
}

function buildQueueDesktopOperatorInstance(options = {}) {
    const detailsOverride =
        options.details && typeof options.details === 'object'
            ? options.details
            : {};
    const station = String(
        detailsOverride.station || options.station || 'c1'
    ).toLowerCase();
    const ageSec = Number(options.ageSec === undefined ? 4 : options.ageSec);
    const stationLabel = station.toUpperCase();
    const oneTap =
        detailsOverride.oneTap !== undefined
            ? Boolean(detailsOverride.oneTap)
            : Boolean(options.oneTap);

    return {
        deviceLabel: options.deviceLabel || `Operador ${stationLabel} fijo`,
        appMode: 'desktop',
        ageSec,
        stale: false,
        effectiveStatus: options.effectiveStatus || 'ready',
        summary:
            options.summary ||
            `Equipo listo para operar en ${stationLabel} fijo.`,
        details: {
            station,
            stationMode: 'locked',
            oneTap,
            numpadSeen: true,
            numpadReady: true,
            numpadProgress: 4,
            numpadRequired: 4,
            numpadLabel: 'Numpad listo',
            numpadSummary: 'Numpad listo · Numpad Enter, +, ., -',
            shellPackaged: true,
            shellPlatform: 'win32',
            shellUpdateChannel: 'stable',
            ...detailsOverride,
        },
    };
}

function buildQueueDesktopOperatorSurfaceStatus(options = {}) {
    const instances = Array.isArray(options.instances) ? options.instances : [];
    const latest =
        options.latest === undefined
            ? instances[0] || null
            : options.latest || null;
    const updatedAt =
        String(options.updatedAt || latest?.updatedAt || '').trim() ||
        new Date().toISOString();

    return buildQueueOperationalSurfaceStatusEntry('operator', {
        status: latest ? 'ready' : 'unknown',
        updatedAt,
        ageSec: latest ? latest.ageSec || 0 : 0,
        stale: false,
        summary: latest ? latest.summary || '' : 'Sin heartbeat',
        latest,
        instances,
        ...options,
    });
}

function buildQueueOperationalAppsSurfaceStatus(options = {}) {
    return {
        operator:
            options.operator ||
            buildQueueUnknownOperationalSurfaceStatus('operator'),
        kiosk:
            options.kiosk || buildQueueUnknownOperationalSurfaceStatus('kiosk'),
        display:
            options.display ||
            buildQueueUnknownOperationalSurfaceStatus('display'),
    };
}

function resolveAdminQueueFixture(value) {
    return typeof value === 'function' ? value() : value;
}

async function installAdminQueueApiMocks(page, options = {}) {
    const {
        appointments = [],
        callbacks = [],
        reviews = [],
        availability = {},
        availabilityMeta = {},
        dataOverrides = {},
        queueTickets = [],
        queueState = {},
        featuresPayload = {
            data: { admin_sony_ui: ADMIN_UI_VARIANT === 'sony_v2' },
        },
        healthPayload = { ok: true, status: 'ok' },
        funnelMetrics = {},
        defaultPayload = {},
        handleRoute = null,
    } = options;

    const getQueueState = () => resolveAdminQueueFixture(queueState);
    const getQueueTickets = () => resolveAdminQueueFixture(queueTickets);
    const getDataOverrides = () => resolveAdminQueueFixture(dataOverrides);

    return installBasicAdminApiMocks(page, {
        featuresPayload,
        healthPayload,
        funnelMetrics,
        defaultPayload,
        handleRoute: async (context) => {
            if (typeof handleRoute === 'function') {
                const handled = await handleRoute({
                    ...context,
                    getQueueState,
                    getQueueTickets,
                });
                if (handled) {
                    return true;
                }
            }

            if (context.resource === 'data') {
                await context.fulfillJson(context.route, {
                    ok: true,
                    data: buildAdminDataPayload({
                        appointments: resolveAdminQueueFixture(appointments),
                        callbacks: resolveAdminQueueFixture(callbacks),
                        reviews: resolveAdminQueueFixture(reviews),
                        availability: resolveAdminQueueFixture(availability),
                        availabilityMeta: {
                            generatedAt:
                                String(
                                    getQueueState()?.updatedAt || ''
                                ).trim() || new Date().toISOString(),
                            ...availabilityMeta,
                        },
                        queue_tickets: getQueueTickets(),
                        queueMeta: buildQueueMetaFromState(getQueueState()),
                        ...((getDataOverrides() &&
                            typeof getDataOverrides() === 'object' &&
                            getDataOverrides()) ||
                            {}),
                    }),
                });
                return true;
            }

            if (context.resource === 'queue-state') {
                await context.fulfillJson(context.route, {
                    ok: true,
                    data: getQueueState(),
                });
                return true;
            }

            return false;
        },
    });
}

async function installQueuePilotApiMocks(page, options = {}) {
    const clinicProfile = options.clinicProfile || null;
    const updatedAt =
        String(
            options.queueState?.updatedAt ||
                options.clinicProfileMeta?.fetchedAt ||
                ''
        ).trim() || new Date().toISOString();
    const queueState = options.queueState || buildQueueIdleState(updatedAt);
    const queueTickets = options.queueTickets || [];
    const clinicId =
        String(
            options.clinicId ||
                clinicProfile?.clinic_id ||
                options.clinicProfileMeta?.clinicId ||
                ''
        ).trim() || '';
    const clinicProfileCatalogStatus =
        options.clinicProfileCatalogStatus === undefined
            ? clinicId
                ? buildTurneroClinicProfileCatalogStatus({ clinicId })
                : null
            : options.clinicProfileCatalogStatus;

    return installAdminQueueApiMocks(page, {
        queueTickets,
        queueState,
        healthPayload: options.healthPayload || buildQueuePilotHealthPayload(),
        dataOverrides: {
            ...(clinicProfile ? { turneroClinicProfile: clinicProfile } : {}),
            ...(options.clinicProfileMeta
                ? { turneroClinicProfileMeta: options.clinicProfileMeta }
                : {}),
            ...(clinicProfileCatalogStatus
                ? {
                      turneroClinicProfileCatalogStatus:
                          clinicProfileCatalogStatus,
                  }
                : {}),
            ...(options.queueSurfaceStatus
                ? { queueSurfaceStatus: options.queueSurfaceStatus }
                : {}),
        },
        handleRoute: options.handleRoute || null,
    });
}

async function installQueueOperationalAppsApiMocks(page, options = {}) {
    const updatedAt =
        String(options.updatedAt || '').trim() || new Date().toISOString();
    const queueStateFixture =
        options.queueState || buildQueueIdleState(updatedAt);

    return installAdminQueueApiMocks(page, {
        queueState: queueStateFixture,
        healthPayload: options.healthPayload || { ok: true, status: 'ok' },
        funnelMetrics: options.funnelMetrics || {},
        dataOverrides: () => {
            const extraDataOverrides = resolveAdminQueueFixture(
                options.dataOverrides
            );
            const queueSurfaceStatus =
                resolveAdminQueueFixture(options.queueSurfaceStatus) ||
                buildQueueOperationalAppsSurfaceStatus();

            return {
                queueSurfaceStatus,
                ...((extraDataOverrides &&
                    typeof extraDataOverrides === 'object' &&
                    extraDataOverrides) ||
                    {}),
            };
        },
        handleRoute: options.handleRoute || null,
    });
}

function getTodayLocalIsoDateForTest() {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

test.describe('Admin turnero sala', () => {
    test.beforeEach(async ({ page }) => {
        await page.addInitScript(() => {
            window.localStorage.setItem('queueAdminViewModeV1', 'expert');
        });
    });

    test('cola muestra guia accionable para apoyos activos y enfoca el ticket correcto', async ({
        page,
    }) => {
        const nowIso = new Date().toISOString();
        const queueTickets = [
            {
                id: 1501,
                ticketCode: 'A-1501',
                queueType: 'appointment',
                patientInitials: 'EP',
                priorityClass: 'appt_current',
                status: 'waiting',
                assignedConsultorio: null,
                createdAt: nowIso,
                needsAssistance: true,
                assistanceRequestStatus: 'pending',
                activeHelpRequestId: 901,
                assistanceReason: 'no_phone',
                assistanceReasonLabel: 'Sin celular',
            },
        ];

        const queueState = {
            updatedAt: nowIso,
            waitingCount: 1,
            calledCount: 0,
            estimatedWaitMin: 8,
            delayReason: 'Recepcion atendiendo solicitudes de apoyo.',
            assistancePendingCount: 1,
            activeHelpRequests: [
                {
                    id: 901,
                    ticketId: 1501,
                    ticketCode: 'A-1501',
                    patientInitials: 'EP',
                    reason: 'no_phone',
                    reasonLabel: 'Sin celular',
                    status: 'pending',
                    source: 'assistant',
                    createdAt: nowIso,
                    updatedAt: nowIso,
                },
            ],
            counts: {
                waiting: 1,
                called: 0,
                completed: 0,
                no_show: 0,
                cancelled: 0,
            },
            callingNow: [],
            nextTickets: [
                {
                    id: 1501,
                    ticketCode: 'A-1501',
                    patientInitials: 'EP',
                    position: 1,
                    queueType: 'appointment',
                    priorityClass: 'appt_current',
                    needsAssistance: true,
                    assistanceRequestStatus: 'pending',
                    activeHelpRequestId: 901,
                    assistanceReason: 'no_phone',
                    assistanceReasonLabel: 'Sin celular',
                },
            ],
        };

        await installLegacyAdminAuthMock(page, {
            csrfToken: 'csrf_queue_guidance',
        });

        await installAdminQueueApiMocks(page, {
            queueTickets,
            queueState,
        });

        await page.goto(adminUrl());
        await page.locator('.nav-item[data-section="queue"]').click();
        await expect(page.locator('#queue')).toHaveClass(/active/);
        await expect(
            page.locator('#queueReceptionGuidancePanel')
        ).toBeVisible();
        await expect(page.locator('#queueReceptionGuidanceList')).toContainText(
            'Sin celular'
        );
        await expect(page.locator('#queueReceptionGuidanceList')).toContainText(
            'Valida identidad y datos basicos presencialmente'
        );

        await page.locator('[data-queue-filter="called"]').first().click();
        await expect(page.locator('#queueTableBody')).toContainText(
            'No hay tickets para filtro'
        );

        await page
            .locator('[data-action="queue-focus-ticket"][data-queue-id="1501"]')
            .click();

        await expect(
            page.locator('#queueTableBody tr[data-queue-id="1501"]')
        ).toHaveClass(/queue-row-focus/);
        await expect(page.locator('#queueTableBody')).toContainText('A-1501');
    });

    test('guia de recepcion ofrece atajos contextuales por motivo y los ejecuta', async ({
        page,
    }) => {
        const nowIso = new Date().toISOString();
        let reprintRequests = 0;
        const appointments = [
            {
                id: 4201,
                name: 'Carla Torres',
                email: 'carla@example.com',
                phone: '0991234567',
                date: '2026-03-13',
                time: '10:30',
                service: 'Consulta de control',
                doctor: 'Dra. Vega',
                paymentStatus: 'paid',
                status: 'confirmed',
            },
        ];
        const availability = {
            '2026-03-13': ['10:30', '11:00'],
            '2026-03-14': ['09:00', '09:30'],
        };
        let queueTickets = [
            {
                id: 1601,
                ticketCode: 'A-1601',
                queueType: 'walk_in',
                patientInitials: 'PR',
                priorityClass: 'walk_in',
                status: 'waiting',
                assignedConsultorio: null,
                createdAt: nowIso,
            },
            {
                id: 1602,
                ticketCode: 'A-1602',
                queueType: 'appointment',
                patientInitials: 'CT',
                priorityClass: 'appt_current',
                status: 'waiting',
                assignedConsultorio: null,
                createdAt: nowIso,
                appointmentId: 4201,
                phoneLast4: '4567',
            },
            {
                id: 1603,
                ticketCode: 'A-1603',
                queueType: 'appointment',
                patientInitials: 'MD',
                priorityClass: 'appt_current',
                status: 'waiting',
                assignedConsultorio: null,
                createdAt: nowIso,
            },
        ];
        let queueHelpRequests = [
            {
                id: 911,
                ticketId: 1601,
                ticketCode: 'A-1601',
                patientInitials: 'PR',
                reason: 'printer_issue',
                reasonLabel: 'Problema de impresion',
                status: 'pending',
                source: 'assistant',
                createdAt: nowIso,
                updatedAt: nowIso,
            },
            {
                id: 912,
                ticketId: 1602,
                ticketCode: 'A-1602',
                patientInitials: 'CT',
                reason: 'appointment_not_found',
                reasonLabel: 'Cita no encontrada',
                status: 'pending',
                source: 'assistant',
                createdAt: nowIso,
                updatedAt: nowIso,
                context: {
                    appointmentId: 4201,
                    phoneLast4: '4567',
                    requestedDate: '2026-03-13',
                    requestedTime: '10:30',
                },
            },
            {
                id: 913,
                ticketId: 1603,
                ticketCode: 'A-1603',
                patientInitials: 'MD',
                reason: 'clinical_redirect',
                reasonLabel: 'Derivacion clinica',
                status: 'pending',
                source: 'assistant',
                createdAt: nowIso,
                updatedAt: nowIso,
            },
        ];
        let queueState = {
            updatedAt: nowIso,
            waitingCount: 0,
            calledCount: 0,
            estimatedWaitMin: 0,
            delayReason: '',
            assistancePendingCount: 0,
            activeHelpRequests: [],
            recentResolvedHelpRequests: [],
            counts: {
                waiting: 0,
                called: 0,
                completed: 0,
                no_show: 0,
                cancelled: 0,
            },
            callingNow: [],
            nextTickets: [],
        };

        function syncQueueHelpState() {
            const updatedAt = new Date().toISOString();
            const activeHelpRequests = queueHelpRequests.filter((request) =>
                ['pending', 'attending'].includes(String(request.status || ''))
            );
            const recentResolvedHelpRequests = queueHelpRequests
                .filter(
                    (request) => String(request.status || '') === 'resolved'
                )
                .sort(
                    (left, right) =>
                        Date.parse(
                            String(right.resolvedAt || right.updatedAt || '')
                        ) -
                        Date.parse(
                            String(left.resolvedAt || left.updatedAt || '')
                        )
                )
                .slice(0, 5);
            queueTickets = queueTickets.map((ticket) => {
                const activeHelpRequest =
                    activeHelpRequests.find(
                        (request) =>
                            Number(request.ticketId || 0) ===
                            Number(ticket.id || 0)
                    ) || null;
                if (!activeHelpRequest) {
                    return {
                        ...ticket,
                        needsAssistance: false,
                        assistanceRequestStatus: '',
                        activeHelpRequestId: null,
                    };
                }

                return {
                    ...ticket,
                    needsAssistance: true,
                    assistanceRequestStatus: String(
                        activeHelpRequest.status || 'pending'
                    ),
                    activeHelpRequestId:
                        Number(activeHelpRequest.id || 0) || null,
                    assistanceReason: String(
                        activeHelpRequest.reason || ''
                    ).trim(),
                    assistanceReasonLabel: String(
                        activeHelpRequest.reasonLabel || ''
                    ).trim(),
                };
            });

            const waitingTickets = queueTickets.filter(
                (ticket) => ticket.status === 'waiting'
            );
            queueState = {
                updatedAt,
                waitingCount: waitingTickets.length,
                calledCount: queueTickets.filter(
                    (ticket) => ticket.status === 'called'
                ).length,
                estimatedWaitMin: waitingTickets.length * 8,
                delayReason: activeHelpRequests.length
                    ? 'Recepcion atendiendo solicitudes de apoyo.'
                    : '',
                assistancePendingCount: activeHelpRequests.filter(
                    (request) => String(request.status || '') === 'pending'
                ).length,
                activeHelpRequests,
                recentResolvedHelpRequests,
                counts: {
                    waiting: waitingTickets.length,
                    called: queueTickets.filter(
                        (ticket) => ticket.status === 'called'
                    ).length,
                    completed: queueTickets.filter(
                        (ticket) => ticket.status === 'completed'
                    ).length,
                    no_show: queueTickets.filter(
                        (ticket) => ticket.status === 'no_show'
                    ).length,
                    cancelled: queueTickets.filter(
                        (ticket) => ticket.status === 'cancelled'
                    ).length,
                },
                callingNow: [],
                nextTickets: waitingTickets.map((ticket, index) => ({
                    id: ticket.id,
                    ticketCode: ticket.ticketCode,
                    patientInitials: ticket.patientInitials,
                    position: index + 1,
                    queueType: ticket.queueType,
                    priorityClass: ticket.priorityClass,
                    needsAssistance: Boolean(ticket.needsAssistance),
                    assistanceRequestStatus:
                        ticket.assistanceRequestStatus || '',
                    activeHelpRequestId: ticket.activeHelpRequestId || null,
                    assistanceReason: ticket.assistanceReason || '',
                    assistanceReasonLabel: ticket.assistanceReasonLabel || '',
                })),
            };
        }

        syncQueueHelpState();

        await installLegacyAdminAuthMock(page, {
            csrfToken: 'csrf_queue_guidance_shortcuts',
        });

        await installAdminQueueApiMocks(page, {
            appointments,
            availability,
            queueTickets: () => queueTickets,
            queueState: () => queueState,
            handleRoute: async ({
                route,
                resource,
                intendedMethod,
                payload,
                fulfillJson,
            }) => {
                if (
                    resource === 'queue-help-request' &&
                    intendedMethod === 'PATCH'
                ) {
                    const helpRequestId = Number(payload.id || 0);
                    const status = String(
                        payload.status || 'pending'
                    ).toLowerCase();
                    const ticketId = Number(
                        payload.ticketId || payload.ticket_id || 0
                    );
                    let updatedRequest = null;

                    queueHelpRequests = queueHelpRequests.map((requestItem) => {
                        const matchesById =
                            helpRequestId > 0 &&
                            Number(requestItem.id || 0) === helpRequestId;
                        const matchesByTicket =
                            helpRequestId <= 0 &&
                            ticketId > 0 &&
                            Number(requestItem.ticketId || 0) === ticketId &&
                            ['pending', 'attending'].includes(
                                String(requestItem.status || '')
                            );
                        if (!matchesById && !matchesByTicket) {
                            return requestItem;
                        }

                        updatedRequest = {
                            ...requestItem,
                            status,
                            updatedAt: new Date().toISOString(),
                            context:
                                payload.context &&
                                typeof payload.context === 'object'
                                    ? {
                                          ...(requestItem.context || {}),
                                          ...payload.context,
                                      }
                                    : requestItem.context || {},
                            ...(status === 'resolved'
                                ? { resolvedAt: new Date().toISOString() }
                                : {}),
                        };
                        return updatedRequest;
                    });

                    syncQueueHelpState();
                    await fulfillJson(route, {
                        ok: true,
                        data: {
                            helpRequest: updatedRequest,
                            queueState,
                        },
                    });
                    return true;
                }

                if (resource === 'queue-reprint' && intendedMethod === 'POST') {
                    reprintRequests += 1;
                    await fulfillJson(route, {
                        ok: true,
                        printed: true,
                        data: {
                            ticket: queueTickets.find(
                                (ticket) =>
                                    Number(ticket.id || 0) ===
                                    Number(payload.id || 0)
                            ),
                        },
                        print: {
                            ok: true,
                            errorCode: '',
                            message: 'ok',
                        },
                    });
                    return true;
                }

                return false;
            },
        });

        await page.goto(adminUrl());
        await page.locator('.nav-item[data-section="queue"]').click();
        await expect(page.locator('#queue')).toHaveClass(/active/);
        await expect(page.locator('#queueReceptionGuidanceList')).toContainText(
            'Problema de impresion'
        );
        await expect(
            page.locator(
                '[data-action="queue-help-request-status"][data-queue-help-request-id="911"][data-queue-help-request-status="attending"]'
            )
        ).toContainText('Marcar en atencion');
        await expect(
            page.locator(
                '[data-action="queue-reprint-ticket"][data-queue-help-request-id="911"][data-queue-guidance-shortcut="reprint"]'
            )
        ).toContainText('Reimprimir ticket');
        await expect(
            page.locator(
                '[data-action="queue-open-appointments"][data-queue-help-request-id="912"][data-queue-guidance-shortcut="appointments"]'
            )
        ).toContainText('Validar cita');
        await expect(page.locator('#queueReceptionGuidanceList')).toContainText(
            'Contexto operativo'
        );
        await expect(page.locator('#queueReceptionGuidanceList')).toContainText(
            'tel. *4567'
        );
        await expect(
            page.locator(
                '[data-action="queue-help-request-status"][data-queue-help-request-id="913"][data-queue-help-request-status="attending"]'
            )
        ).toContainText('Derivar a doctor');

        await page
            .locator(
                '[data-action="queue-help-request-status"][data-queue-help-request-id="913"][data-queue-help-request-status="attending"]'
            )
            .click();
        await expect(page.locator('#queueReceptionGuidanceList')).toContainText(
            'Cerrar derivacion'
        );

        await page
            .locator(
                '[data-action="queue-help-request-status"][data-queue-help-request-id="911"][data-queue-help-request-status="attending"]'
            )
            .click();
        await expect(page.locator('#queueReceptionGuidanceList')).toContainText(
            'En atencion'
        );

        await page
            .locator(
                '[data-action="queue-reprint-ticket"][data-queue-help-request-id="911"][data-queue-guidance-shortcut="reprint"]'
            )
            .click();
        await expect.poll(() => reprintRequests).toBe(1);

        await page
            .locator(
                '[data-action="queue-help-request-status"][data-queue-help-request-id="911"][data-queue-help-request-status="resolved"]'
            )
            .click();
        await expect(
            page.locator('#queueReceptionGuidanceList')
        ).not.toContainText('A-1601');
        await expect(page.locator('#queueReceptionGuidanceList')).toContainText(
            'A-1602'
        );
        await expect(page.locator('#queueReceptionGuidanceList')).toContainText(
            'A-1603'
        );

        await page
            .locator(
                '[data-action="queue-open-appointments"][data-queue-help-request-id="912"][data-queue-guidance-shortcut="appointments"]'
            )
            .click();
        await expect(page.locator('#appointments')).toHaveClass(/active/);
        await expect(page.locator('#searchAppointments')).toHaveValue('4567');
        await expect(
            page.locator(
                '#appointmentsTableBody tr[data-appointment-id="4201"]'
            )
        ).toHaveClass(/appointment-row-focus/);
        await expect(page.locator('#appointmentsFocusLabel')).toContainText(
            'Revision desde sala'
        );
        await expect(page.locator('#appointmentsFocusPatient')).toContainText(
            'Carla Torres'
        );
        await expect(page.locator('#appointmentsQueueReview')).toContainText(
            'A-1602'
        );
        await expect(page.locator('#appointmentsQueueReview')).toContainText(
            'Cita no encontrada'
        );
        await expect(page.locator('#appointmentsQueueReview')).toContainText(
            'Cita vigente'
        );
        await expect(page.locator('#appointmentsQueueReview')).toContainText(
            'tel. *4567'
        );
        await expect(
            page.locator(
                '[data-action="appointment-review-confirm-appointment"][data-review-ticket-id="1602"]'
            )
        ).toContainText('Confirmar cita vigente');
        await expect(
            page.locator(
                '[data-action="appointment-review-help-request-status"][data-review-ticket-id="1602"][data-review-help-request-status="attending"]'
            )
        ).toContainText('Marcar apoyo en atencion');

        await page
            .locator(
                '[data-action="appointment-review-help-request-status"][data-review-ticket-id="1602"][data-review-help-request-status="attending"]'
            )
            .click();
        await expect(page.locator('#appointmentsQueueReview')).toContainText(
            'En atencion'
        );
        await expect(page.locator('#appointmentsQueueReview')).toContainText(
            'Cita vigente'
        );

        await page
            .locator(
                '[data-action="appointment-review-open-queue"][data-review-ticket-id="1602"]'
            )
            .click();
        await expect(page.locator('#queue')).toHaveClass(/active/);
        await expect(
            page.locator('#queueTableBody tr[data-queue-id="1602"]')
        ).toContainText('A-1602');
        await expect(page.locator('#queueReceptionGuidanceList')).toContainText(
            'Validacion actual: Cita vigente'
        );
        await expect(page.locator('#queueReceptionGuidanceList')).toContainText(
            'Cierre recomendado ahora: Cita vigente confirmada'
        );
        await expect(
            page.locator(
                '[data-action="queue-help-request-status"][data-queue-help-request-id="912"][data-queue-help-request-status="resolved"]'
            )
        ).toContainText('Confirmar cita vigente');

        await page
            .locator(
                '[data-action="queue-help-request-status"][data-queue-help-request-id="912"][data-queue-help-request-status="resolved"]'
            )
            .click();
        await expect(page.locator('#queueActivityList')).toContainText(
            'Apoyo resuelto 1602 · Cita vigente confirmada'
        );
        await expect(
            page.locator('#queueReceptionGuidanceList')
        ).not.toContainText('A-1602');
        await expect(page.locator('#queueRecentResolutionsList')).toContainText(
            'A-1602'
        );
        await expect(page.locator('#queueRecentResolutionsList')).toContainText(
            'Cita vigente confirmada'
        );
    });

    test('agenda lee disponibilidad real y abre el dia pedido para conflicto horario', async ({
        page,
    }) => {
        const nowIso = new Date().toISOString();
        const availability = {
            '2026-03-14': ['09:00', '09:30'],
        };
        const queueTickets = [
            {
                id: 1701,
                ticketCode: 'A-1701',
                queueType: 'appointment',
                patientInitials: 'LS',
                priorityClass: 'appt_current',
                status: 'waiting',
                assignedConsultorio: null,
                createdAt: nowIso,
                phoneLast4: '8899',
            },
        ];
        const queueState = {
            updatedAt: nowIso,
            waitingCount: 1,
            calledCount: 0,
            estimatedWaitMin: 8,
            delayReason: 'Recepcion validando agenda.',
            assistancePendingCount: 1,
            activeHelpRequests: [
                {
                    id: 971,
                    ticketId: 1701,
                    ticketCode: 'A-1701',
                    patientInitials: 'LS',
                    reason: 'schedule_taken',
                    reasonLabel: 'Horario ocupado',
                    status: 'pending',
                    source: 'assistant',
                    createdAt: nowIso,
                    updatedAt: nowIso,
                    context: {
                        phoneLast4: '8899',
                        requestedDate: '2026-03-14',
                        requestedTime: '11:00',
                    },
                },
            ],
            recentResolvedHelpRequests: [],
            counts: {
                waiting: 1,
                called: 0,
                completed: 0,
                no_show: 0,
                cancelled: 0,
            },
            callingNow: [],
            nextTickets: [
                {
                    id: 1701,
                    ticketCode: 'A-1701',
                    patientInitials: 'LS',
                    position: 1,
                    queueType: 'appointment',
                    priorityClass: 'appt_current',
                    needsAssistance: true,
                    assistanceRequestStatus: 'pending',
                    activeHelpRequestId: 971,
                    assistanceReason: 'schedule_taken',
                    assistanceReasonLabel: 'Horario ocupado',
                },
            ],
        };

        await installLegacyAdminAuthMock(page, {
            csrfToken: 'csrf_queue_schedule_conflict',
        });

        await installAdminQueueApiMocks(page, {
            availability,
            queueTickets,
            queueState,
            handleRoute: async ({
                route,
                resource,
                intendedMethod,
                payload,
                fulfillJson,
            }) => {
                if (
                    resource === 'queue-help-request' &&
                    intendedMethod === 'PATCH'
                ) {
                    const nextStatus = String(payload.status || 'pending')
                        .trim()
                        .toLowerCase();
                    const updatedAt = new Date().toISOString();
                    const requestItem = queueState.activeHelpRequests[0];
                    const updatedRequest = {
                        ...requestItem,
                        status: nextStatus,
                        updatedAt,
                        context:
                            payload.context &&
                            typeof payload.context === 'object'
                                ? {
                                      ...(requestItem.context || {}),
                                      ...payload.context,
                                  }
                                : requestItem.context || {},
                        ...(nextStatus === 'attending'
                            ? { attendedAt: updatedAt }
                            : {}),
                        ...(nextStatus === 'resolved'
                            ? { resolvedAt: updatedAt }
                            : {}),
                    };

                    queueState.activeHelpRequests =
                        nextStatus === 'resolved' ? [] : [updatedRequest];
                    queueState.assistancePendingCount =
                        nextStatus === 'pending' ? 1 : 0;
                    queueState.recentResolvedHelpRequests =
                        nextStatus === 'resolved' ? [updatedRequest] : [];
                    queueState.updatedAt = updatedAt;

                    await fulfillJson(route, {
                        ok: true,
                        data: {
                            helpRequest: updatedRequest,
                            queueState,
                        },
                    });
                    return true;
                }

                return false;
            },
        });

        await page.goto(adminUrl());
        await page.locator('.nav-item[data-section="queue"]').click();
        await page
            .locator(
                '[data-action="queue-open-appointments"][data-queue-help-request-id="971"]'
            )
            .click();

        await expect(page.locator('#appointments')).toHaveClass(/active/);
        await expect(page.locator('#appointmentsQueueReview')).toContainText(
            'Slot no publicado'
        );
        await expect(page.locator('#appointmentsQueueReview')).toContainText(
            '11:00 no aparece'
        );
        await expect(
            page.locator(
                '[data-action="appointment-review-open-availability"][data-review-requested-date="2026-03-14"]'
            )
        ).toContainText('Revisar disponibilidad');
        await expect(
            page.locator(
                '[data-action="appointment-review-help-request-status"][data-review-ticket-id="1701"][data-review-help-request-status="attending"]'
            )
        ).toContainText('Marcar apoyo en atencion');

        await page
            .locator(
                '[data-action="appointment-review-help-request-status"][data-review-ticket-id="1701"][data-review-help-request-status="attending"]'
            )
            .click();
        await expect(page.locator('#appointmentsQueueReview')).toContainText(
            'En atencion'
        );

        await page
            .locator(
                '[data-action="appointment-review-open-availability"][data-review-requested-date="2026-03-14"]'
            )
            .click();

        await expect(page.locator('#availability')).toHaveClass(/active/);
        await expect(page.locator('#selectedDate')).toHaveText('2026-03-14');
        await expect(page.locator('#timeSlotsList')).toContainText('09:00');
        await expect(page.locator('#timeSlotsList')).toContainText('09:30');
        await expect(page.locator('#timeSlotsList')).not.toContainText('11:00');
        await expect(page.locator('#availabilityReviewContext')).toContainText(
            'Disponibilidad abierta desde sala'
        );
        await expect(page.locator('#availabilityReviewContext')).toContainText(
            'Slot no publicado'
        );
        await expect(
            page.locator(
                '#availabilityReviewContext [data-action="appointment-review-open-queue"][data-review-ticket-id="1701"]'
            )
        ).toContainText('Volver a cola con conflicto horario');

        await page
            .locator(
                '#availabilityReviewContext [data-action="appointment-review-open-queue"][data-review-ticket-id="1701"]'
            )
            .click();
        await expect(page.locator('#queue')).toHaveClass(/active/);
        await expect(page.locator('#queueReceptionGuidanceList')).toContainText(
            'Validacion actual: Slot no publicado'
        );
        await expect(page.locator('#queueReceptionGuidanceList')).toContainText(
            'Cierre recomendado ahora: Horario ya no publicado'
        );
        await expect(
            page.locator(
                '[data-action="queue-help-request-status"][data-queue-help-request-id="971"][data-queue-help-request-status="resolved"]'
            )
        ).toContainText('Confirmar horario no publicado');

        await page
            .locator(
                '[data-action="queue-help-request-status"][data-queue-help-request-id="971"][data-queue-help-request-status="resolved"]'
            )
            .click();
        await expect(page.locator('#queueRecentResolutionsList')).toContainText(
            'Horario ya no publicado'
        );
    });

    test('permite llamar siguiente ticket en consultorio 1', async ({
        page,
    }) => {
        let queueTickets = [
            {
                id: 501,
                ticketCode: 'A-501',
                queueType: 'appointment',
                patientInitials: 'EP',
                priorityClass: 'appt_overdue',
                status: 'waiting',
                assignedConsultorio: null,
                createdAt: new Date(Date.now() - 120000).toISOString(),
            },
            {
                id: 502,
                ticketCode: 'A-502',
                queueType: 'walk_in',
                patientInitials: 'JP',
                priorityClass: 'walk_in',
                status: 'waiting',
                assignedConsultorio: null,
                createdAt: new Date().toISOString(),
            },
        ];

        let queueState = {
            updatedAt: new Date().toISOString(),
            waitingCount: 2,
            calledCount: 0,
            counts: {
                waiting: 2,
                called: 0,
                completed: 0,
                no_show: 0,
                cancelled: 0,
            },
            callingNow: [],
            nextTickets: [
                {
                    id: 501,
                    ticketCode: 'A-501',
                    patientInitials: 'EP',
                    position: 1,
                },
                {
                    id: 502,
                    ticketCode: 'A-502',
                    patientInitials: 'JP',
                    position: 2,
                },
            ],
        };

        await installLegacyAdminAuthMock(page, {
            csrfToken: 'csrf_queue_admin',
        });

        await installAdminQueueApiMocks(page, {
            queueTickets: () => queueTickets,
            queueState: () => queueState,
            healthPayload: {
                ok: true,
                status: 'ok',
                checks: {
                    publicSync: {
                        configured: true,
                        healthy: true,
                        state: 'ok',
                        deployedCommit:
                            '3de287e27f2f5034f6f471234567890abcdef12',
                        headDrift: false,
                        ageSeconds: 32,
                        failureReason: '',
                    },
                },
            },
            handleRoute: async ({ route, resource, fulfillJson }) => {
                if (resource === 'queue-call-next') {
                    const calledTicket = {
                        ...queueTickets[0],
                        status: 'called',
                        assignedConsultorio: 1,
                        calledAt: new Date().toISOString(),
                    };
                    queueTickets = [calledTicket, queueTickets[1]];
                    queueState = {
                        ...queueState,
                        updatedAt: new Date().toISOString(),
                        waitingCount: 1,
                        calledCount: 1,
                        counts: {
                            waiting: 1,
                            called: 1,
                            completed: 0,
                            no_show: 0,
                            cancelled: 0,
                        },
                        callingNow: [calledTicket],
                        nextTickets: [
                            {
                                id: 502,
                                ticketCode: 'A-502',
                                patientInitials: 'JP',
                                position: 1,
                            },
                        ],
                    };
                    await fulfillJson(route, {
                        ok: true,
                        data: {
                            ticket: calledTicket,
                            queueState,
                        },
                    });
                    return true;
                }

                if (resource === 'queue-ticket') {
                    await fulfillJson(route, {
                        ok: true,
                        data: {
                            ticket: queueTickets[0],
                            queueState,
                        },
                    });
                    return true;
                }

                if (resource === 'queue-reprint') {
                    await fulfillJson(route, {
                        ok: true,
                        printed: false,
                        print: {
                            ok: true,
                            errorCode: 'printer_disabled',
                            message: 'disabled',
                        },
                    });
                    return true;
                }

                return false;
            },
        });

        await page.goto(adminUrl());
        await expect(page.locator('#adminDashboard')).toBeVisible({
            timeout: 15000,
        });

        await page.locator('.nav-item[data-section="queue"]').click();
        await expect(page.locator('#queue')).toHaveClass(/active/);
        await expect(page.locator('#queueWaitingCountAdmin')).toHaveText('2');
        await expect(page.locator('#queueSyncStatus')).toContainText('vivo');

        await page
            .locator(
                '#queue .queue-admin-header-actions [data-action="queue-call-next"][data-queue-consultorio="1"]'
            )
            .first()
            .click();

        await expect(page.locator('#queueWaitingCountAdmin')).toHaveText('1');
        await expect(page.locator('#queueC1Now')).toContainText('A-501');
        await expect(page.locator('#queueTableBody')).toContainText('A-501');
        await expect(page.locator('#queueReleaseC1')).toContainText('A-501');
    });

    test('triage de cola aplica filtros SLA y busqueda por ticket', async ({
        page,
    }) => {
        const queueTickets = [
            {
                id: 900,
                ticketCode: 'A-900',
                queueType: 'appointment',
                patientInitials: 'ER',
                priorityClass: 'appt_overdue',
                status: 'waiting',
                assignedConsultorio: null,
                createdAt: new Date(Date.now() - 45 * 60 * 1000).toISOString(),
            },
            {
                id: 901,
                ticketCode: 'A-901',
                queueType: 'walk_in',
                patientInitials: 'JP',
                priorityClass: 'walk_in',
                status: 'waiting',
                assignedConsultorio: null,
                createdAt: new Date(Date.now() - 3 * 60 * 1000).toISOString(),
            },
            {
                id: 902,
                ticketCode: 'A-902',
                queueType: 'appointment',
                patientInitials: 'MC',
                priorityClass: 'appt_current',
                status: 'called',
                assignedConsultorio: 1,
                createdAt: new Date(Date.now() - 20 * 60 * 1000).toISOString(),
                calledAt: new Date(Date.now() - 5 * 60 * 1000).toISOString(),
            },
        ];

        const queueState = {
            updatedAt: new Date().toISOString(),
            waitingCount: 2,
            calledCount: 1,
            counts: {
                waiting: 2,
                called: 1,
                completed: 0,
                no_show: 0,
                cancelled: 0,
            },
            callingNow: [queueTickets[2]],
            nextTickets: [
                {
                    id: 900,
                    ticketCode: 'A-900',
                    patientInitials: 'ER',
                    position: 1,
                },
                {
                    id: 901,
                    ticketCode: 'A-901',
                    patientInitials: 'JP',
                    position: 2,
                },
            ],
        };

        await installLegacyAdminAuthMock(page, {
            csrfToken: 'csrf_queue_triage',
        });

        await page.route(/\/api\.php(\?.*)?$/i, async (route) => {
            const url = new URL(route.request().url());
            const resource = url.searchParams.get('resource') || '';
            if (resource === 'features') {
                return json(route, {
                    ok: true,
                    data: { admin_sony_ui: ADMIN_UI_VARIANT === 'sony_v2' },
                });
            }

            if (resource === 'data') {
                return json(route, {
                    ok: true,
                    data: {
                        appointments: [],
                        callbacks: [],
                        reviews: [],
                        availability: {},
                        availabilityMeta: {
                            source: 'store',
                            mode: 'live',
                            timezone: 'America/Guayaquil',
                            calendarConfigured: true,
                            calendarReachable: true,
                            generatedAt: new Date().toISOString(),
                        },
                        queue_tickets: queueTickets,
                        queueMeta: buildQueueMetaFromState(queueState),
                    },
                });
            }

            if (resource === 'health') {
                return json(route, {
                    ok: true,
                    status: 'ok',
                    checks: {
                        publicSync: {
                            configured: true,
                            healthy: true,
                            state: 'ok',
                            deployedCommit:
                                '3de287e27f2f5034f6f471234567890abcdef12',
                            headDrift: false,
                            ageSeconds: 32,
                            failureReason: '',
                        },
                    },
                });
            }

            if (resource === 'funnel-metrics') {
                return json(route, { ok: true, data: {} });
            }

            return json(route, { ok: true, data: {} });
        });

        await page.goto(adminUrl());
        await expect(page.locator('#adminDashboard')).toBeVisible();

        await page.locator('.nav-item[data-section="queue"]').click();
        await expect(page.locator('#queue')).toHaveClass(/active/);
        await expect(page.locator('#queueTriageToolbar')).toBeVisible();
        await expect(page.locator('#queueTriageSummary')).toContainText(
            'riesgo'
        );

        await page.locator('[data-queue-filter="sla_risk"]').click();
        await expect(page.locator('#queueTableBody tr')).toHaveCount(1);
        await expect(page.locator('#queueTableBody')).toContainText('A-900');
        await expect(page.locator('#queueTableBody')).not.toContainText(
            'A-901'
        );

        await page.locator('[data-queue-filter="all"]').click();
        await page.fill('#queueSearchInput', 'A-901');
        await expect(page.locator('#queueTableBody')).toContainText('A-901');
        await expect(page.locator('#queueTableBody')).not.toContainText(
            'A-900'
        );

        await page.locator('[data-action="queue-clear-search"]').click();
        await expect(page.locator('#queueSearchInput')).toHaveValue('');
        await expect(page.locator('#queueTableBody')).toContainText('A-900');
    });

    test('watchdog realtime marca cola estancada y deja traza operativa', async ({
        page,
    }) => {
        const staleUpdatedAt = new Date(Date.now() - 75 * 1000).toISOString();
        const queueTickets = [
            {
                id: 930,
                ticketCode: 'A-930',
                queueType: 'appointment',
                patientInitials: 'LR',
                priorityClass: 'appt_current',
                status: 'waiting',
                assignedConsultorio: null,
                createdAt: new Date(Date.now() - 10 * 60 * 1000).toISOString(),
            },
        ];
        const queueState = {
            updatedAt: staleUpdatedAt,
            waitingCount: 1,
            calledCount: 0,
            counts: {
                waiting: 1,
                called: 0,
                completed: 0,
                no_show: 0,
                cancelled: 0,
            },
            callingNow: [],
            nextTickets: [
                {
                    id: 930,
                    ticketCode: 'A-930',
                    patientInitials: 'LR',
                    position: 1,
                },
            ],
        };

        await installLegacyAdminAuthMock(page, {
            csrfToken: 'csrf_queue_watchdog',
        });

        await page.route(/\/api\.php(\?.*)?$/i, async (route) => {
            const url = new URL(route.request().url());
            const resource = url.searchParams.get('resource') || '';
            if (resource === 'features') {
                return json(route, {
                    ok: true,
                    data: { admin_sony_ui: ADMIN_UI_VARIANT === 'sony_v2' },
                });
            }

            if (resource === 'data') {
                return json(route, {
                    ok: true,
                    data: {
                        appointments: [],
                        callbacks: [],
                        reviews: [],
                        availability: {},
                        availabilityMeta: {
                            source: 'store',
                            mode: 'live',
                            timezone: 'America/Guayaquil',
                            calendarConfigured: true,
                            calendarReachable: true,
                            generatedAt: new Date().toISOString(),
                        },
                        queue_tickets: queueTickets,
                        queueMeta: buildQueueMetaFromState(queueState),
                    },
                });
            }

            if (resource === 'health') {
                return json(route, {
                    ok: true,
                    status: 'ok',
                    checks: {
                        publicSync: {
                            configured: true,
                            healthy: true,
                            state: 'ok',
                            deployedCommit:
                                '3de287e27f2f5034f6f471234567890abcdef12',
                            headDrift: false,
                            ageSeconds: 32,
                            failureReason: '',
                        },
                    },
                });
            }

            if (resource === 'funnel-metrics') {
                return json(route, { ok: true, data: {} });
            }

            return json(route, { ok: true, data: {} });
        });

        await page.goto(adminUrl());
        await expect(page.locator('#adminDashboard')).toBeVisible();
        await page.locator('.nav-item[data-section="queue"]').click();

        await expect(page.locator('#queueActivityPanel')).toBeVisible();
        await expect
            .poll(async () => {
                const text = await page
                    .locator('#queueSyncStatus')
                    .textContent();
                return text || '';
            })
            .toContain('Watchdog');
        await expect
            .poll(async () => {
                const state = await page
                    .locator('#queueSyncStatus')
                    .getAttribute('data-state');
                return state || '';
            })
            .toContain('reconnecting');
        await expect(page.locator('#queueActivityList')).toContainText(
            'Watchdog de cola'
        );
    });

    test('atajos de teclado en turnero aplican filtro SLA y accion masiva', async ({
        page,
    }) => {
        let queueTickets = [
            {
                id: 910,
                ticketCode: 'A-910',
                queueType: 'appointment',
                patientInitials: 'ER',
                priorityClass: 'appt_overdue',
                status: 'waiting',
                assignedConsultorio: null,
                createdAt: new Date(Date.now() - 50 * 60 * 1000).toISOString(),
            },
            {
                id: 911,
                ticketCode: 'A-911',
                queueType: 'walk_in',
                patientInitials: 'JP',
                priorityClass: 'walk_in',
                status: 'waiting',
                assignedConsultorio: null,
                createdAt: new Date(Date.now() - 8 * 60 * 1000).toISOString(),
            },
            {
                id: 912,
                ticketCode: 'A-912',
                queueType: 'appointment',
                patientInitials: 'MC',
                priorityClass: 'appt_current',
                status: 'called',
                assignedConsultorio: 2,
                calledAt: new Date(Date.now() - 2 * 60 * 1000).toISOString(),
                createdAt: new Date(Date.now() - 15 * 60 * 1000).toISOString(),
            },
        ];

        let queueState = buildQueueStateFromTickets(queueTickets);

        await page.addInitScript(() => {
            window.localStorage.setItem('queueOpsFocusModeV1', 'operations');
        });

        await installLegacyAdminAuthMock(page, {
            csrfToken: 'csrf_queue_shortcuts',
        });

        await page.route(/\/api\.php(\?.*)?$/i, async (route) => {
            const request = route.request();
            const url = new URL(request.url());
            const resource = url.searchParams.get('resource') || '';
            if (resource === 'features') {
                return json(route, {
                    ok: true,
                    data: { admin_sony_ui: ADMIN_UI_VARIANT === 'sony_v2' },
                });
            }

            if (resource === 'data') {
                return json(route, {
                    ok: true,
                    data: {
                        appointments: [],
                        callbacks: [],
                        reviews: [],
                        availability: {},
                        availabilityMeta: {
                            source: 'store',
                            mode: 'live',
                            timezone: 'America/Guayaquil',
                            calendarConfigured: true,
                            calendarReachable: true,
                            generatedAt: new Date().toISOString(),
                        },
                        queue_tickets: queueTickets,
                        queueMeta: buildQueueMetaFromState(queueState),
                    },
                });
            }

            if (resource === 'queue-ticket') {
                const body = JSON.parse(request.postData() || '{}');
                const ticketId = Number(body.id || 0);
                const action = String(body.action || '').toLowerCase();
                const idx = queueTickets.findIndex(
                    (ticket) => Number(ticket.id) === ticketId
                );
                if (idx >= 0) {
                    if (action === 'no_show') {
                        queueTickets[idx] = {
                            ...queueTickets[idx],
                            status: 'no_show',
                            assignedConsultorio: null,
                            completedAt: new Date().toISOString(),
                        };
                    } else if (action === 'cancelar') {
                        queueTickets[idx] = {
                            ...queueTickets[idx],
                            status: 'cancelled',
                            assignedConsultorio: null,
                            completedAt: new Date().toISOString(),
                        };
                    } else if (action === 'completar') {
                        queueTickets[idx] = {
                            ...queueTickets[idx],
                            status: 'completed',
                            completedAt: new Date().toISOString(),
                        };
                    }
                }
                queueState = buildQueueStateFromTickets(queueTickets);
                return json(route, {
                    ok: true,
                    data: {
                        ticket: queueTickets[idx],
                        queueState,
                    },
                });
            }

            if (resource === 'health') {
                return json(route, { ok: true, status: 'ok' });
            }

            if (resource === 'funnel-metrics') {
                return json(route, { ok: true, data: {} });
            }

            return json(route, { ok: true, data: {} });
        });

        await page.goto(adminUrl());
        await expect(page.locator('#adminDashboard')).toBeVisible();

        await page.locator('.nav-item[data-section="queue"]').click();
        await expect(page.locator('#queue')).toHaveClass(/active/);

        await page.keyboard.press('Alt+Shift+W');
        await expect(page.locator('#queueTableBody tr')).toHaveCount(2);
        await expect(page.locator('#queueTableBody')).toContainText('A-910');
        await expect(page.locator('#queueTableBody')).toContainText('A-911');

        await page.keyboard.press('Alt+Shift+C');
        await expect(page.locator('#queueTableBody tr')).toHaveCount(1);
        await expect(page.locator('#queueTableBody')).toContainText('A-912');

        await page.keyboard.press('Alt+Shift+A');
        await expect(page.locator('#queueTableBody')).toContainText('A-910');
        await expect(page.locator('#queueTableBody')).toContainText('A-912');

        await page.keyboard.press('Alt+Shift+L');
        await expect(page.locator('#queueTableBody tr')).toHaveCount(1);
        await expect(page.locator('#queueTableBody')).toContainText('A-910');

        let dialogMessage = '';
        page.once('dialog', async (dialog) => {
            dialogMessage = dialog.message();
            await dialog.accept();
        });
        await page
            .locator(
                '[data-action="queue-bulk-action"][data-queue-action="no_show"]'
            )
            .evaluate((element) => {
                element.dispatchEvent(
                    new MouseEvent('click', {
                        bubbles: true,
                        cancelable: true,
                    })
                );
            });
        await expect.poll(() => dialogMessage).toContain('No show');

        await expect(page.locator('#queueTableBody')).toContainText(
            /Sin tickets en cola|No hay tickets para/
        );
        await expect(page.locator('#queueWaitingCountAdmin')).toHaveText('1');

        await page.keyboard.press('Alt+Shift+O');
        await expect(page.locator('#queueTableBody')).toContainText('A-910');
        await expect(page.locator('#queueTableBody')).toContainText(
            'No asistio'
        );
        await expect(page.locator('#queueTableBody')).toContainText('A-911');
    });

    test('usa fallback queue-state cuando /data no incluye queue_tickets', async ({
        page,
    }) => {
        const nowIso = new Date().toISOString();
        const queueState = {
            updatedAt: nowIso,
            waitingCount: 14,
            calledCount: 1,
            counts: {
                waiting: 14,
                called: 1,
                completed: 0,
                no_show: 0,
                cancelled: 0,
            },
            callingNow: [
                {
                    id: 1599,
                    ticketCode: 'A-1599',
                    patientInitials: 'CC',
                    assignedConsultorio: 1,
                    calledAt: nowIso,
                    status: 'called',
                },
            ],
            nextTickets: Array.from({ length: 10 }, (_item, index) => ({
                id: 1501 + index,
                ticketCode: `A-${1501 + index}`,
                patientInitials: `Q${index}`,
                queueType: 'walk_in',
                priorityClass: 'walk_in',
                position: index + 1,
                createdAt: nowIso,
            })),
        };
        let queueStateRequests = 0;

        await installQueueAdminAuthMock(page, 'csrf_queue_state_fallback');
        await installAdminQueueApiMocks(page, {
            handleRoute: async ({ resource, route, fulfillJson }) => {
                if (resource === 'data') {
                    await fulfillJson(route, {
                        ok: true,
                        data: buildAdminDataPayload(),
                    });
                    return true;
                }

                if (resource === 'queue-state') {
                    queueStateRequests += 1;
                    await fulfillJson(route, {
                        ok: true,
                        data: queueState,
                    });
                    return true;
                }

                return false;
            },
        });

        await page.goto(adminUrl());
        await expect(page.locator('#adminDashboard')).toBeVisible();
        await page.locator('.nav-item[data-section="queue"]').click();
        await expect(page.locator('#queue')).toHaveClass(/active/);
        await expect(page.locator('#queueTableBody')).toContainText('A-1501');
        await expect(page.locator('#queueTableBody')).toContainText('A-1510');
        await expect(page.locator('#queueWaitingCountAdmin')).toHaveText('14');
        await expect(page.locator('#queueTriageSummary')).toContainText(
            'fallback parcial'
        );
        await expect(page.locator('#queueNextAdminList')).toContainText(
            'Mostrando primeros 10 de 14 en espera'
        );
        await expect.poll(() => queueStateRequests).toBeGreaterThan(0);
    });

    test('usa queueMeta como fallback local cuando /data no trae queue_tickets', async ({
        page,
    }) => {
        const nowIso = new Date().toISOString();
        let queueStateRequests = 0;
        const queueMetaPayload = {
            updatedAt: nowIso,
            waitingCount: 6,
            calledCount: 1,
            counts: {
                waiting: 6,
                called: 1,
                completed: 0,
                no_show: 0,
                cancelled: 0,
            },
            callingNowByConsultorio: {
                1: {
                    id: 2601,
                    ticketCode: 'A-2601',
                    patientInitials: 'CV',
                    assignedConsultorio: 1,
                    calledAt: nowIso,
                    status: 'called',
                },
                2: null,
            },
            nextTickets: [
                {
                    id: 2602,
                    ticketCode: 'A-2602',
                    patientInitials: 'JP',
                    queueType: 'appointment',
                    priorityClass: 'appt_overdue',
                    position: 1,
                    createdAt: nowIso,
                },
                {
                    id: 2603,
                    ticketCode: 'A-2603',
                    patientInitials: 'LM',
                    queueType: 'walk_in',
                    priorityClass: 'walk_in',
                    position: 2,
                    createdAt: nowIso,
                },
            ],
        };

        await installQueueAdminAuthMock(page, 'csrf_queue_meta_fallback');
        await installAdminQueueApiMocks(page, {
            handleRoute: async ({ resource, route, fulfillJson }) => {
                if (resource === 'data') {
                    await fulfillJson(route, {
                        ok: true,
                        data: buildAdminDataPayload({
                            queueMeta: queueMetaPayload,
                        }),
                    });
                    return true;
                }

                if (resource === 'queue-state') {
                    queueStateRequests += 1;
                    await fulfillJson(
                        route,
                        {
                            ok: false,
                            error: 'queue-state should not be needed in this case',
                        },
                        500
                    );
                    return true;
                }

                return false;
            },
        });

        await page.goto(adminUrl());
        await expect(page.locator('#adminDashboard')).toBeVisible();
        await page.locator('.nav-item[data-section="queue"]').click();
        await expect(page.locator('#queue')).toHaveClass(/active/);
        await expect(page.locator('#queueWaitingCountAdmin')).toHaveText('6');
        await expect(page.locator('#queueTableBody')).toContainText('A-2602');
        await expect(page.locator('#queueTableBody')).toContainText('A-2603');
        await expect(page.locator('#queueC1Now')).toContainText('A-2601');
        await expect(page.locator('#queueTriageSummary')).toContainText(
            'fallback parcial'
        );
        await expect(page.locator('#queueSyncStatus')).toContainText(
            'fallback'
        );
        await expect.poll(() => queueStateRequests).toBe(0);
    });

    test('usa queue_state de /data como fallback local sin llamar /queue-state', async ({
        page,
    }) => {
        const nowIso = new Date().toISOString();
        let queueStateRequests = 0;
        const queueStatePayload = {
            updated_at: nowIso,
            waiting_count: 4,
            called_count: 1,
            counts: {
                waiting: 4,
                called: 1,
                completed: 0,
                no_show: 0,
                cancelled: 0,
            },
            calling_now_by_consultorio: {
                1: {
                    id: 3601,
                    ticket_code: 'A-3601',
                    patient_initials: 'CV',
                    assigned_consultorio: 1,
                    called_at: nowIso,
                    status: 'called',
                },
                2: null,
            },
            next_tickets: [
                {
                    id: 3602,
                    ticket_code: 'A-3602',
                    patient_initials: 'JP',
                    queue_type: 'appointment',
                    priority_class: 'appt_overdue',
                    position: 1,
                    created_at: nowIso,
                },
                {
                    id: 3603,
                    ticket_code: 'A-3603',
                    patient_initials: 'LM',
                    queue_type: 'walk_in',
                    priority_class: 'walk_in',
                    position: 2,
                    created_at: nowIso,
                },
            ],
        };

        await installQueueAdminAuthMock(page, 'csrf_queue_state_data_fallback');
        await installAdminQueueApiMocks(page, {
            handleRoute: async ({ resource, route, fulfillJson }) => {
                if (resource === 'data') {
                    await fulfillJson(route, {
                        ok: true,
                        data: buildAdminDataPayload({
                            queue_state: queueStatePayload,
                        }),
                    });
                    return true;
                }

                if (resource === 'queue-state') {
                    queueStateRequests += 1;
                    await fulfillJson(
                        route,
                        {
                            ok: false,
                            error: 'queue-state should not be needed for queue_state fallback',
                        },
                        500
                    );
                    return true;
                }

                return false;
            },
        });

        await page.goto(adminUrl());
        await expect(page.locator('#adminDashboard')).toBeVisible();
        await page.locator('.nav-item[data-section="queue"]').click();
        await expect(page.locator('#queue')).toHaveClass(/active/);
        await expect(page.locator('#queueWaitingCountAdmin')).toHaveText('4');
        await expect(page.locator('#queueTableBody')).toContainText('A-3602');
        await expect(page.locator('#queueTableBody')).toContainText('A-3603');
        await expect(page.locator('#queueC1Now')).toContainText('A-3601');
        await expect(page.locator('#queueTriageSummary')).toContainText(
            'fallback parcial'
        );
        await expect(page.locator('#queueSyncStatus')).toContainText(
            'fallback'
        );
        await expect.poll(() => queueStateRequests).toBe(0);
    });

    test('evita duplicar llamado cuando hay doble clic en rafaga para el mismo consultorio', async ({
        page,
    }) => {
        let queueCallNextRequests = 0;
        let queueTickets = [
            {
                id: 951,
                ticketCode: 'A-951',
                queueType: 'appointment',
                patientInitials: 'EP',
                priorityClass: 'appt_overdue',
                status: 'waiting',
                assignedConsultorio: null,
                createdAt: new Date(Date.now() - 2 * 60 * 1000).toISOString(),
            },
        ];
        let queueState = buildQueueStateFromTickets(queueTickets);

        await installLegacyAdminAuthMock(page, {
            csrfToken: 'csrf_queue_burst',
        });

        await page.route(/\/api\.php(\?.*)?$/i, async (route) => {
            const request = route.request();
            const url = new URL(request.url());
            const resource = url.searchParams.get('resource') || '';
            if (resource === 'features') {
                return json(route, {
                    ok: true,
                    data: { admin_sony_ui: ADMIN_UI_VARIANT === 'sony_v2' },
                });
            }

            if (resource === 'data') {
                return json(route, {
                    ok: true,
                    data: {
                        appointments: [],
                        callbacks: [],
                        reviews: [],
                        availability: {},
                        availabilityMeta: {
                            source: 'store',
                            mode: 'live',
                            timezone: 'America/Guayaquil',
                            calendarConfigured: true,
                            calendarReachable: true,
                            generatedAt: new Date().toISOString(),
                        },
                        queue_tickets: queueTickets,
                        queueMeta: buildQueueMetaFromState(queueState),
                    },
                });
            }

            if (resource === 'queue-call-next') {
                queueCallNextRequests += 1;
                await new Promise((resolve) => setTimeout(resolve, 250));
                queueTickets = [
                    {
                        ...queueTickets[0],
                        status: 'called',
                        assignedConsultorio: 1,
                        calledAt: new Date().toISOString(),
                    },
                ];
                queueState = buildQueueStateFromTickets(queueTickets);
                return json(route, {
                    ok: true,
                    data: {
                        ticket: queueTickets[0],
                        queueState,
                    },
                });
            }

            if (resource === 'health') {
                return json(route, { ok: true, status: 'ok' });
            }

            if (resource === 'funnel-metrics') {
                return json(route, { ok: true, data: {} });
            }

            return json(route, { ok: true, data: {} });
        });

        await page.goto(adminUrl());
        await expect(page.locator('#adminDashboard')).toBeVisible();
        await page.locator('.nav-item[data-section="queue"]').click();
        await expect(page.locator('#queue')).toHaveClass(/active/);
        await expect(page.locator('#queueWaitingCountAdmin')).toHaveText('1');

        await page
            .locator(
                '#queue .queue-admin-header-actions [data-action="queue-call-next"][data-queue-consultorio="1"]'
            )
            .first()
            .evaluate((button) => {
                const firstClick = new MouseEvent('click', {
                    bubbles: true,
                    cancelable: true,
                });
                const secondClick = new MouseEvent('click', {
                    bubbles: true,
                    cancelable: true,
                });
                button.dispatchEvent(firstClick);
                button.dispatchEvent(secondClick);
            });

        await expect(page.locator('#queueC1Now')).toContainText('A-951');
        await expect(page.locator('#queueWaitingCountAdmin')).toHaveText('0');
        await expect.poll(() => queueCallNextRequests).toBe(1);
    });

    test('permite reintento despues de error transitorio en llamado de consultorio', async ({
        page,
    }) => {
        let queueCallNextRequests = 0;
        let queueTickets = [
            {
                id: 961,
                ticketCode: 'A-961',
                queueType: 'walk_in',
                patientInitials: 'JP',
                priorityClass: 'walk_in',
                status: 'waiting',
                assignedConsultorio: null,
                createdAt: new Date(Date.now() - 60 * 1000).toISOString(),
            },
        ];
        let queueState = buildQueueStateFromTickets(queueTickets);

        await installLegacyAdminAuthMock(page, {
            csrfToken: 'csrf_queue_retry',
        });

        await page.route(/\/api\.php(\?.*)?$/i, async (route) => {
            const request = route.request();
            const url = new URL(request.url());
            const resource = url.searchParams.get('resource') || '';
            if (resource === 'features') {
                return json(route, {
                    ok: true,
                    data: { admin_sony_ui: ADMIN_UI_VARIANT === 'sony_v2' },
                });
            }

            if (resource === 'data') {
                return json(route, {
                    ok: true,
                    data: {
                        appointments: [],
                        callbacks: [],
                        reviews: [],
                        availability: {},
                        availabilityMeta: {
                            source: 'store',
                            mode: 'live',
                            timezone: 'America/Guayaquil',
                            calendarConfigured: true,
                            calendarReachable: true,
                            generatedAt: new Date().toISOString(),
                        },
                        queue_tickets: queueTickets,
                        queueMeta: buildQueueMetaFromState(queueState),
                    },
                });
            }

            if (resource === 'queue-call-next') {
                queueCallNextRequests += 1;
                if (queueCallNextRequests === 1) {
                    return json(
                        route,
                        { ok: false, error: 'Fallo temporal de backend' },
                        503
                    );
                }
                queueTickets = [
                    {
                        ...queueTickets[0],
                        status: 'called',
                        assignedConsultorio: 1,
                        calledAt: new Date().toISOString(),
                    },
                ];
                queueState = buildQueueStateFromTickets(queueTickets);
                return json(route, {
                    ok: true,
                    data: {
                        ticket: queueTickets[0],
                        queueState,
                    },
                });
            }

            if (resource === 'health') {
                return json(route, { ok: true, status: 'ok' });
            }

            if (resource === 'funnel-metrics') {
                return json(route, { ok: true, data: {} });
            }

            return json(route, { ok: true, data: {} });
        });

        await page.goto(adminUrl());
        await expect(page.locator('#adminDashboard')).toBeVisible();
        await page.locator('.nav-item[data-section="queue"]').click();
        await expect(page.locator('#queue')).toHaveClass(/active/);

        const callC1Button = page.locator(
            '#queue .queue-admin-header-actions [data-action="queue-call-next"][data-queue-consultorio="1"]'
        );

        await callC1Button.first().click();
        await expect(page.locator('#queueWaitingCountAdmin')).toHaveText('1');
        await expect(page.locator('#queueActivityList')).toContainText(
            'Error llamando siguiente en C1'
        );

        await callC1Button.first().click();
        await expect(page.locator('#queueC1Now')).toContainText('A-961');
        await expect(page.locator('#queueWaitingCountAdmin')).toHaveText('0');
        await expect.poll(() => queueCallNextRequests).toBe(2);
    });

    test('llamados en paralelo para C1 y C2 asignan tickets distintos y conservan cola', async ({
        page,
    }) => {
        let queueCallNextRequests = 0;
        let queueTickets = [
            {
                id: 971,
                ticketCode: 'A-971',
                queueType: 'appointment',
                patientInitials: 'AA',
                priorityClass: 'appt_overdue',
                status: 'waiting',
                assignedConsultorio: null,
                createdAt: new Date(Date.now() - 5 * 60 * 1000).toISOString(),
            },
            {
                id: 972,
                ticketCode: 'A-972',
                queueType: 'appointment',
                patientInitials: 'BB',
                priorityClass: 'appt_current',
                status: 'waiting',
                assignedConsultorio: null,
                createdAt: new Date(Date.now() - 3 * 60 * 1000).toISOString(),
            },
            {
                id: 973,
                ticketCode: 'A-973',
                queueType: 'walk_in',
                patientInitials: 'CC',
                priorityClass: 'walk_in',
                status: 'waiting',
                assignedConsultorio: null,
                createdAt: new Date(Date.now() - 60 * 1000).toISOString(),
            },
        ];
        let queueState = buildQueueStateFromTickets(queueTickets);

        await installLegacyAdminAuthMock(page, {
            csrfToken: 'csrf_queue_parallel_rooms',
        });

        await page.route(/\/api\.php(\?.*)?$/i, async (route) => {
            const request = route.request();
            const url = new URL(request.url());
            const resource = url.searchParams.get('resource') || '';
            if (resource === 'features') {
                return json(route, {
                    ok: true,
                    data: { admin_sony_ui: ADMIN_UI_VARIANT === 'sony_v2' },
                });
            }

            if (resource === 'data') {
                return json(route, {
                    ok: true,
                    data: {
                        appointments: [],
                        callbacks: [],
                        reviews: [],
                        availability: {},
                        availabilityMeta: {
                            source: 'store',
                            mode: 'live',
                            timezone: 'America/Guayaquil',
                            calendarConfigured: true,
                            calendarReachable: true,
                            generatedAt: new Date().toISOString(),
                        },
                        queue_tickets: queueTickets,
                        queueMeta: buildQueueMetaFromState(queueState),
                    },
                });
            }

            if (resource === 'queue-call-next') {
                queueCallNextRequests += 1;
                const body = JSON.parse(request.postData() || '{}');
                const consultorio = Number(body.consultorio || 0);
                const nextWaiting = queueTickets.find(
                    (ticket) => ticket.status === 'waiting'
                );
                if (!nextWaiting) {
                    return json(
                        route,
                        { ok: false, error: 'Sin turnos en espera' },
                        409
                    );
                }

                queueTickets = queueTickets.map((ticket) =>
                    ticket.id === nextWaiting.id
                        ? {
                              ...ticket,
                              status: 'called',
                              assignedConsultorio: consultorio,
                              calledAt: new Date().toISOString(),
                          }
                        : ticket
                );
                queueState = buildQueueStateFromTickets(queueTickets);
                const calledTicket = queueTickets.find(
                    (ticket) => ticket.id === nextWaiting.id
                );
                return json(route, {
                    ok: true,
                    data: {
                        ticket: calledTicket,
                        queueState,
                    },
                });
            }

            if (resource === 'health') {
                return json(route, { ok: true, status: 'ok' });
            }

            if (resource === 'funnel-metrics') {
                return json(route, { ok: true, data: {} });
            }

            return json(route, { ok: true, data: {} });
        });

        await page.goto(adminUrl());
        await expect(page.locator('#adminDashboard')).toBeVisible();
        await page.locator('.nav-item[data-section="queue"]').click();
        await expect(page.locator('#queue')).toHaveClass(/active/);
        await expect(page.locator('#queueWaitingCountAdmin')).toHaveText('3');

        const callC1Button = page
            .locator(
                '#queue .queue-admin-header-actions [data-action="queue-call-next"][data-queue-consultorio="1"]'
            )
            .first();
        const callC2Button = page
            .locator(
                '#queue .queue-admin-header-actions [data-action="queue-call-next"][data-queue-consultorio="2"]'
            )
            .first();

        await expect(callC1Button).toBeVisible();
        await expect(callC2Button).toBeVisible();
        await page.evaluate(() => {
            const c1 = document.querySelector(
                '#queue .queue-admin-header-actions [data-action="queue-call-next"][data-queue-consultorio="1"]'
            );
            const c2 = document.querySelector(
                '#queue .queue-admin-header-actions [data-action="queue-call-next"][data-queue-consultorio="2"]'
            );
            if (!c1 || !c2) return;
            const clickC1 = new MouseEvent('click', {
                bubbles: true,
                cancelable: true,
            });
            const clickC2 = new MouseEvent('click', {
                bubbles: true,
                cancelable: true,
            });
            c1.dispatchEvent(clickC1);
            c2.dispatchEvent(clickC2);
        });

        await expect(page.locator('#queueWaitingCountAdmin')).toHaveText('1');
        await expect(page.locator('#queueTableBody')).toContainText('A-973');
        await expect.poll(() => queueCallNextRequests).toBe(2);

        const c1NowText =
            (await page.locator('#queueC1Now').textContent()) || '';
        const c2NowText =
            (await page.locator('#queueC2Now').textContent()) || '';
        const c1Code = (c1NowText.match(/A-\d+/) || [])[0] || '';
        const c2Code = (c2NowText.match(/A-\d+/) || [])[0] || '';

        expect(c1Code).toBeTruthy();
        expect(c2Code).toBeTruthy();
        expect(c1Code).not.toEqual(c2Code);
        expect([c1Code, c2Code]).toEqual(
            expect.arrayContaining(['A-971', 'A-972'])
        );
    });

    test('acciones de ticket (reasignar y completar) mantienen consistencia por consultorio', async ({
        page,
    }) => {
        let queueTickets = [
            {
                id: 981,
                ticketCode: 'A-981',
                queueType: 'appointment',
                patientInitials: 'RR',
                priorityClass: 'appt_current',
                status: 'called',
                assignedConsultorio: 1,
                createdAt: new Date(Date.now() - 12 * 60 * 1000).toISOString(),
                calledAt: new Date(Date.now() - 2 * 60 * 1000).toISOString(),
            },
            {
                id: 982,
                ticketCode: 'A-982',
                queueType: 'walk_in',
                patientInitials: 'WW',
                priorityClass: 'walk_in',
                status: 'waiting',
                assignedConsultorio: null,
                createdAt: new Date(Date.now() - 4 * 60 * 1000).toISOString(),
            },
        ];
        let queueState = buildQueueStateFromTickets(queueTickets);

        await installLegacyAdminAuthMock(page, {
            csrfToken: 'csrf_queue_lifecycle',
        });

        await page.route(/\/api\.php(\?.*)?$/i, async (route) => {
            const request = route.request();
            const url = new URL(request.url());
            const resource = url.searchParams.get('resource') || '';
            if (resource === 'features') {
                return json(route, {
                    ok: true,
                    data: { admin_sony_ui: ADMIN_UI_VARIANT === 'sony_v2' },
                });
            }

            if (resource === 'data') {
                return json(route, {
                    ok: true,
                    data: {
                        appointments: [],
                        callbacks: [],
                        reviews: [],
                        availability: {},
                        availabilityMeta: {
                            source: 'store',
                            mode: 'live',
                            timezone: 'America/Guayaquil',
                            calendarConfigured: true,
                            calendarReachable: true,
                            generatedAt: new Date().toISOString(),
                        },
                        queue_tickets: queueTickets,
                        queueMeta: buildQueueMetaFromState(queueState),
                    },
                });
            }

            if (resource === 'queue-ticket' && request.method() === 'PATCH') {
                const body = JSON.parse(request.postData() || '{}');
                const ticketId = Number(body.id || 0);
                const action = String(body.action || '').toLowerCase();
                const consultorio = Number(body.consultorio || 0);
                const ticketIndex = queueTickets.findIndex(
                    (ticket) => Number(ticket.id || 0) === ticketId
                );

                if (ticketIndex < 0) {
                    return json(
                        route,
                        { ok: false, error: 'Ticket no encontrado' },
                        404
                    );
                }

                const currentTicket = queueTickets[ticketIndex];
                if (
                    (action === 'reasignar' || action === 'reassign') &&
                    ![1, 2].includes(consultorio)
                ) {
                    return json(
                        route,
                        { ok: false, error: 'Consultorio invalido' },
                        400
                    );
                }

                const nowIso = new Date().toISOString();
                let updatedTicket = { ...currentTicket };

                if (action === 'reasignar' || action === 'reassign') {
                    updatedTicket = {
                        ...currentTicket,
                        assignedConsultorio: consultorio,
                    };
                } else if (
                    action === 'completar' ||
                    action === 'complete' ||
                    action === 'completed'
                ) {
                    updatedTicket = {
                        ...currentTicket,
                        status: 'completed',
                        assignedConsultorio: null,
                        completedAt: nowIso,
                    };
                } else {
                    return json(
                        route,
                        { ok: false, error: 'Accion no soportada' },
                        400
                    );
                }

                queueTickets = queueTickets.map((ticket, index) =>
                    index === ticketIndex ? updatedTicket : ticket
                );
                queueState = buildQueueStateFromTickets(queueTickets);

                return json(route, {
                    ok: true,
                    data: {
                        ticket: updatedTicket,
                        queueState,
                    },
                });
            }

            if (resource === 'queue-call-next') {
                const body = JSON.parse(request.postData() || '{}');
                const consultorio = Number(body.consultorio || 0);
                const candidate = queueTickets.find(
                    (ticket) => ticket.status === 'waiting'
                );
                if (!candidate) {
                    return json(
                        route,
                        { ok: false, error: 'Sin turnos en espera' },
                        409
                    );
                }
                queueTickets = queueTickets.map((ticket) =>
                    ticket.id === candidate.id
                        ? {
                              ...ticket,
                              status: 'called',
                              assignedConsultorio: consultorio,
                              calledAt: new Date().toISOString(),
                          }
                        : ticket
                );
                queueState = buildQueueStateFromTickets(queueTickets);
                return json(route, {
                    ok: true,
                    data: {
                        ticket: queueTickets.find(
                            (ticket) => ticket.id === candidate.id
                        ),
                        queueState,
                    },
                });
            }

            if (resource === 'health') {
                return json(route, { ok: true, status: 'ok' });
            }

            if (resource === 'funnel-metrics') {
                return json(route, { ok: true, data: {} });
            }

            return json(route, { ok: true, data: {} });
        });

        await page.goto(adminUrl());
        await expect(page.locator('#adminDashboard')).toBeVisible();
        await page.locator('.nav-item[data-section="queue"]').click();
        await expect(page.locator('#queue')).toHaveClass(/active/);

        await expect(page.locator('#queueC1Now')).toContainText('A-981');
        await expect(page.locator('#queueC2Now')).toContainText('Sin llamado');
        await expect(page.locator('#queueWaitingCountAdmin')).toHaveText('1');

        const rowA981 = page
            .locator('#queueTableBody tr')
            .filter({ hasText: 'A-981' })
            .first();

        await rowA981
            .locator(
                '[data-action="queue-ticket-action"][data-queue-action="reasignar"][data-queue-consultorio="2"]'
            )
            .click();

        await expect(page.locator('#queueC2Now')).toContainText('A-981');
        await expect(page.locator('#queueC1Now')).toContainText('Sin llamado');

        await rowA981
            .locator(
                '[data-action="queue-ticket-action"][data-queue-action="completar"]'
            )
            .click();

        await expect(page.locator('#queueC2Now')).toContainText('Sin llamado');
        await expect(page.locator('#queueWaitingCountAdmin')).toHaveText('1');
        await expect(rowA981).toContainText('Completado');

        await page
            .locator(
                '#queue .queue-admin-header-actions [data-action="queue-call-next"][data-queue-consultorio="1"]'
            )
            .first()
            .click();

        await expect(page.locator('#queueC1Now')).toContainText('A-982');
        await expect(page.locator('#queueWaitingCountAdmin')).toHaveText('0');
    });

    test('despacho sugerido reasigna ticket general y luego permite llamarlo', async ({
        page,
    }) => {
        let queueTickets = [
            {
                id: 1202,
                ticketCode: 'A-1202',
                queueType: 'walk_in',
                patientInitials: 'LM',
                priorityClass: 'walk_in',
                status: 'waiting',
                assignedConsultorio: null,
                createdAt: new Date(Date.now() - 11 * 60 * 1000).toISOString(),
            },
        ];
        let queueState = buildQueueStateFromTickets(queueTickets);

        await installLegacyAdminAuthMock(page, {
            csrfToken: 'csrf_queue_dispatch',
        });

        await page.route(/\/api\.php(\?.*)?$/i, async (route) => {
            const request = route.request();
            const url = new URL(request.url());
            const resource = url.searchParams.get('resource') || '';
            if (resource === 'features') {
                return json(route, {
                    ok: true,
                    data: { admin_sony_ui: ADMIN_UI_VARIANT === 'sony_v2' },
                });
            }

            if (resource === 'data') {
                return json(route, {
                    ok: true,
                    data: {
                        appointments: [],
                        callbacks: [],
                        reviews: [],
                        availability: {},
                        availabilityMeta: {
                            source: 'store',
                            mode: 'live',
                            timezone: 'America/Guayaquil',
                            calendarConfigured: true,
                            calendarReachable: true,
                            generatedAt: new Date().toISOString(),
                        },
                        queue_tickets: queueTickets,
                        queueMeta: buildQueueMetaFromState(queueState),
                        queueSurfaceStatus: {
                            operator: {
                                surface: 'operator',
                                label: 'Operador',
                                status: 'ready',
                                updatedAt: new Date().toISOString(),
                                ageSec: 4,
                                stale: false,
                                summary: 'Equipo listo para operar en C1 fijo.',
                                latest: {
                                    deviceLabel: 'Operador C1 fijo',
                                    appMode: 'desktop',
                                    ageSec: 4,
                                    details: {
                                        station: 'c1',
                                        stationMode: 'locked',
                                        oneTap: false,
                                        numpadSeen: true,
                                        clinicId: 'clinica-norte-demo',
                                        profileSource: 'remote',
                                        surfaceContractState: 'ready',
                                        surfaceRouteExpected:
                                            '/operador-turnos.html',
                                        surfaceRouteCurrent:
                                            '/operador-turnos.html',
                                    },
                                },
                                instances: [],
                            },
                            kiosk: {
                                surface: 'kiosk',
                                label: 'Kiosco',
                                status: 'unknown',
                                updatedAt: '',
                                ageSec: 0,
                                stale: true,
                                summary: 'Sin heartbeat',
                                latest: null,
                                instances: [],
                            },
                            display: {
                                surface: 'display',
                                label: 'Sala TV',
                                status: 'unknown',
                                updatedAt: '',
                                ageSec: 0,
                                stale: true,
                                summary: 'Sin heartbeat',
                                latest: null,
                                instances: [],
                            },
                        },
                    },
                });
            }

            if (resource === 'queue-ticket' && request.method() === 'PATCH') {
                const body = JSON.parse(request.postData() || '{}');
                const ticketId = Number(body.id || 0);
                const consultorio = Number(body.consultorio || 0);
                queueTickets = queueTickets.map((ticket) =>
                    Number(ticket.id || 0) === ticketId
                        ? {
                              ...ticket,
                              assignedConsultorio: consultorio,
                          }
                        : ticket
                );
                queueState = buildQueueStateFromTickets(queueTickets);
                return json(route, {
                    ok: true,
                    data: {
                        ticket: queueTickets.find(
                            (ticket) => Number(ticket.id || 0) === ticketId
                        ),
                        queueState,
                    },
                });
            }

            if (resource === 'queue-call-next' && request.method() === 'POST') {
                const body = JSON.parse(request.postData() || '{}');
                const consultorio = Number(body.consultorio || 0);
                const candidate = queueTickets.find(
                    (ticket) =>
                        ticket.status === 'waiting' &&
                        Number(ticket.assignedConsultorio || 0) === consultorio
                );
                if (!candidate) {
                    return json(
                        route,
                        { ok: false, error: 'Sin turnos asignados' },
                        409
                    );
                }
                queueTickets = queueTickets.map((ticket) =>
                    ticket.id === candidate.id
                        ? {
                              ...ticket,
                              status: 'called',
                              assignedConsultorio: consultorio,
                              calledAt: new Date().toISOString(),
                          }
                        : ticket
                );
                queueState = buildQueueStateFromTickets(queueTickets);
                return json(route, {
                    ok: true,
                    data: {
                        ticket: queueTickets.find(
                            (ticket) => ticket.id === candidate.id
                        ),
                        queueState,
                    },
                });
            }

            if (resource === 'health') {
                return json(route, { ok: true, status: 'ok' });
            }

            if (resource === 'funnel-metrics') {
                return json(route, { ok: true, data: {} });
            }

            return json(route, { ok: true, data: {} });
        });

        await page.goto(adminUrl());
        await expect(page.locator('#adminDashboard')).toBeVisible();
        await page.locator('.nav-item[data-section="queue"]').click();
        await page.locator('#queueDomainOperations').dispatchEvent('click');
        await expect(page.locator('#queueAppsHub')).toHaveAttribute(
            'data-queue-domain',
            'operations'
        );
        await expect(page.locator('#queueDispatchDeck')).toBeVisible();
        await expect(page.locator('#queueDispatchDeckStatus')).toContainText(
            '1 acción'
        );
        await expect(page.locator('#queueDispatchHeadline_c1')).toContainText(
            'puede absorber A-1202'
        );
        await expect(page.locator('#queueDispatchPrimary_c1')).toContainText(
            'Asignar A-1202'
        );

        await page.locator('#queueDispatchPrimary_c1').click();

        await expect(page.locator('#queueDispatchPrimary_c1')).toContainText(
            'Llamar A-1202'
        );
        await expect(page.locator('#queueDispatchTarget_c1')).toContainText(
            'A-1202'
        );

        await page.locator('#queueDispatchPrimary_c1').click();

        await expect(page.locator('#queueC1Now')).toContainText('A-1202');
        await expect(page.locator('#queueDispatchCard_c1')).toContainText(
            'En atención'
        );
    });

    test('seguimiento de atencion re-llama y prepara el siguiente ticket del consultorio', async ({
        page,
    }) => {
        let queueTickets = [
            {
                id: 1211,
                ticketCode: 'A-1211',
                queueType: 'appointment',
                patientInitials: 'AT',
                priorityClass: 'appt_overdue',
                status: 'called',
                assignedConsultorio: 1,
                createdAt: new Date(Date.now() - 18 * 60 * 1000).toISOString(),
                calledAt: new Date(Date.now() - 9 * 60 * 1000).toISOString(),
            },
            {
                id: 1212,
                ticketCode: 'A-1212',
                queueType: 'walk_in',
                patientInitials: 'NX',
                priorityClass: 'walk_in',
                status: 'waiting',
                assignedConsultorio: 1,
                createdAt: new Date(Date.now() - 5 * 60 * 1000).toISOString(),
            },
        ];
        let queueState = buildQueueStateFromTickets(queueTickets);

        await installLegacyAdminAuthMock(page, {
            csrfToken: 'csrf_queue_attention_deck',
        });

        await page.route(/\/api\.php(\?.*)?$/i, async (route) => {
            const request = route.request();
            const url = new URL(request.url());
            const resource = url.searchParams.get('resource') || '';
            if (resource === 'features') {
                return json(route, {
                    ok: true,
                    data: { admin_sony_ui: ADMIN_UI_VARIANT === 'sony_v2' },
                });
            }

            if (resource === 'data') {
                return json(route, {
                    ok: true,
                    data: {
                        appointments: [],
                        callbacks: [],
                        reviews: [],
                        availability: {},
                        availabilityMeta: {
                            source: 'store',
                            mode: 'live',
                            timezone: 'America/Guayaquil',
                            calendarConfigured: true,
                            calendarReachable: true,
                            generatedAt: new Date().toISOString(),
                        },
                        queue_tickets: queueTickets,
                        queueMeta: buildQueueMetaFromState(queueState),
                        queueSurfaceStatus: {
                            operator: {
                                surface: 'operator',
                                label: 'Operador',
                                status: 'ready',
                                updatedAt: new Date().toISOString(),
                                ageSec: 4,
                                stale: false,
                                summary: 'Equipo listo para operar en C1 fijo.',
                                latest: {
                                    deviceLabel: 'Operador C1 fijo',
                                    appMode: 'desktop',
                                    ageSec: 4,
                                    details: {
                                        station: 'c1',
                                        stationMode: 'locked',
                                        oneTap: false,
                                        numpadSeen: true,
                                    },
                                },
                                instances: [],
                            },
                            kiosk: {
                                surface: 'kiosk',
                                label: 'Kiosco',
                                status: 'unknown',
                                updatedAt: '',
                                ageSec: 0,
                                stale: true,
                                summary: 'Sin heartbeat',
                                latest: null,
                                instances: [],
                            },
                            display: {
                                surface: 'display',
                                label: 'Sala TV',
                                status: 'unknown',
                                updatedAt: '',
                                ageSec: 0,
                                stale: true,
                                summary: 'Sin heartbeat',
                                latest: null,
                                instances: [],
                            },
                        },
                    },
                });
            }

            if (resource === 'queue-ticket' && request.method() === 'PATCH') {
                const body = JSON.parse(request.postData() || '{}');
                const ticketId = Number(body.id || 0);
                const action = String(body.action || '').toLowerCase();
                const consultorio = Number(body.consultorio || 0);
                const ticketIndex = queueTickets.findIndex(
                    (ticket) => Number(ticket.id || 0) === ticketId
                );
                if (ticketIndex < 0) {
                    return json(
                        route,
                        { ok: false, error: 'Ticket no encontrado' },
                        404
                    );
                }

                const currentTicket = queueTickets[ticketIndex];
                const nowIso = new Date().toISOString();
                let updatedTicket = { ...currentTicket };

                if (action === 're-llamar' || action === 'rellamar') {
                    updatedTicket = {
                        ...currentTicket,
                        status: 'called',
                        assignedConsultorio:
                            Number(currentTicket.assignedConsultorio || 1) || 1,
                        calledAt: nowIso,
                    };
                } else if (action === 'completar') {
                    updatedTicket = {
                        ...currentTicket,
                        status: 'completed',
                        assignedConsultorio: null,
                        completedAt: nowIso,
                    };
                } else if (action === 'liberar') {
                    updatedTicket = {
                        ...currentTicket,
                        status: 'waiting',
                        assignedConsultorio: null,
                        calledAt: '',
                    };
                }

                queueTickets = queueTickets.map((ticket, index) =>
                    index === ticketIndex ? updatedTicket : ticket
                );
                queueState = buildQueueStateFromTickets(queueTickets);
                return json(route, {
                    ok: true,
                    data: {
                        ticket: updatedTicket,
                        queueState,
                    },
                });
            }

            if (resource === 'queue-call-next' && request.method() === 'POST') {
                const body = JSON.parse(request.postData() || '{}');
                const consultorio = Number(body.consultorio || 0);
                const candidate = queueTickets.find(
                    (ticket) =>
                        ticket.status === 'waiting' &&
                        Number(ticket.assignedConsultorio || 0) === consultorio
                );
                if (!candidate) {
                    return json(
                        route,
                        { ok: false, error: 'Sin turnos asignados' },
                        409
                    );
                }
                queueTickets = queueTickets.map((ticket) =>
                    Number(ticket.id || 0) === Number(candidate.id || 0)
                        ? {
                              ...ticket,
                              status: 'called',
                              assignedConsultorio: consultorio,
                              calledAt: new Date().toISOString(),
                          }
                        : ticket
                );
                queueState = buildQueueStateFromTickets(queueTickets);
                return json(route, {
                    ok: true,
                    data: {
                        ticket: queueTickets.find(
                            (ticket) =>
                                Number(ticket.id || 0) ===
                                Number(candidate.id || 0)
                        ),
                        queueState,
                    },
                });
            }

            if (resource === 'health') {
                return json(route, { ok: true, status: 'ok' });
            }

            if (resource === 'funnel-metrics') {
                return json(route, { ok: true, data: {} });
            }

            return json(route, { ok: true, data: {} });
        });

        await page.goto(adminUrl());
        await expect(page.locator('#adminDashboard')).toBeVisible();
        await page.locator('.nav-item[data-section="queue"]').click();

        await expect(page.locator('#queueAttentionDeck')).toBeVisible();
        await expect(page.locator('#queueAttentionDeckTitle')).toContainText(
            'Seguimiento de atención'
        );
        await expect(page.locator('#queueAttentionDeckStatus')).toContainText(
            '1 llamado'
        );
        await expect(page.locator('#queueAttentionHeadline_c1')).toContainText(
            'A-1211'
        );
        await expect(
            page.locator('#queueAttentionRecommendation_c1')
        ).toContainText('Re-llamar A-1211');
        await expect(page.locator('#queueAttentionPrimary_c1')).toContainText(
            'Re-llamar A-1211'
        );

        await page.locator('#queueAttentionPrimary_c1').click();

        await expect(page.locator('#queueAttentionPrimary_c1')).toContainText(
            'Abrir Operador C1'
        );
        await expect(
            page.locator('#queueAttentionRecommendation_c1')
        ).toContainText('Completa A-1211');

        await page.locator('#queueAttentionComplete_c1').click();

        await expect(page.locator('#queueAttentionCurrent_c1')).toContainText(
            'Sin llamado activo'
        );
        await expect(page.locator('#queueAttentionPrimary_c1')).toContainText(
            'Llamar A-1212'
        );
        await expect(page.locator('#queueAttentionNext_c1')).toContainText(
            'A-1212'
        );
    });

    test('resolucion rapida prepara no show y confirma el cierre desde el hub', async ({
        page,
    }) => {
        let queueTickets = [
            {
                id: 1221,
                ticketCode: 'A-1221',
                queueType: 'appointment',
                patientInitials: 'RS',
                priorityClass: 'appt_overdue',
                status: 'called',
                assignedConsultorio: 1,
                createdAt: new Date(Date.now() - 21 * 60 * 1000).toISOString(),
                calledAt: new Date(Date.now() - 8 * 60 * 1000).toISOString(),
            },
            {
                id: 1222,
                ticketCode: 'A-1222',
                queueType: 'walk_in',
                patientInitials: 'YL',
                priorityClass: 'walk_in',
                status: 'waiting',
                assignedConsultorio: 1,
                createdAt: new Date(Date.now() - 4 * 60 * 1000).toISOString(),
            },
        ];
        let queueState = buildQueueStateFromTickets(queueTickets);

        await installLegacyAdminAuthMock(page, {
            csrfToken: 'csrf_queue_resolution_deck',
        });

        await page.route(/\/api\.php(\?.*)?$/i, async (route) => {
            const request = route.request();
            const url = new URL(request.url());
            const resource = url.searchParams.get('resource') || '';
            if (resource === 'features') {
                return json(route, {
                    ok: true,
                    data: { admin_sony_ui: ADMIN_UI_VARIANT === 'sony_v2' },
                });
            }

            if (resource === 'data') {
                return json(route, {
                    ok: true,
                    data: {
                        appointments: [],
                        callbacks: [],
                        reviews: [],
                        availability: {},
                        availabilityMeta: {
                            source: 'store',
                            mode: 'live',
                            timezone: 'America/Guayaquil',
                            calendarConfigured: true,
                            calendarReachable: true,
                            generatedAt: new Date().toISOString(),
                        },
                        queue_tickets: queueTickets,
                        queueMeta: buildQueueMetaFromState(queueState),
                        queueSurfaceStatus: {
                            operator: {
                                surface: 'operator',
                                label: 'Operador',
                                status: 'ready',
                                updatedAt: new Date().toISOString(),
                                ageSec: 4,
                                stale: false,
                                summary: 'Equipo listo para operar en C1 fijo.',
                                latest: {
                                    deviceLabel: 'Operador C1 fijo',
                                    appMode: 'desktop',
                                    ageSec: 4,
                                    details: {
                                        station: 'c1',
                                        stationMode: 'locked',
                                        oneTap: false,
                                        numpadSeen: true,
                                    },
                                },
                                instances: [],
                            },
                            kiosk: {
                                surface: 'kiosk',
                                label: 'Kiosco',
                                status: 'unknown',
                                updatedAt: '',
                                ageSec: 0,
                                stale: true,
                                summary: 'Sin heartbeat',
                                latest: null,
                                instances: [],
                            },
                            display: {
                                surface: 'display',
                                label: 'Sala TV',
                                status: 'unknown',
                                updatedAt: '',
                                ageSec: 0,
                                stale: true,
                                summary: 'Sin heartbeat',
                                latest: null,
                                instances: [],
                            },
                        },
                    },
                });
            }

            if (resource === 'queue-ticket' && request.method() === 'PATCH') {
                const body = JSON.parse(request.postData() || '{}');
                const ticketId = Number(body.id || 0);
                const action = String(body.action || '').toLowerCase();
                const ticketIndex = queueTickets.findIndex(
                    (ticket) => Number(ticket.id || 0) === ticketId
                );
                if (ticketIndex < 0) {
                    return json(
                        route,
                        { ok: false, error: 'Ticket no encontrado' },
                        404
                    );
                }

                const currentTicket = queueTickets[ticketIndex];
                const nowIso = new Date().toISOString();
                let updatedTicket = { ...currentTicket };
                if (action === 'no_show') {
                    updatedTicket = {
                        ...currentTicket,
                        status: 'no_show',
                        assignedConsultorio: null,
                        completedAt: nowIso,
                    };
                } else if (action === 'completar') {
                    updatedTicket = {
                        ...currentTicket,
                        status: 'completed',
                        assignedConsultorio: null,
                        completedAt: nowIso,
                    };
                } else if (action === 'liberar') {
                    updatedTicket = {
                        ...currentTicket,
                        status: 'waiting',
                        assignedConsultorio: null,
                        calledAt: '',
                    };
                }

                queueTickets = queueTickets.map((ticket, index) =>
                    index === ticketIndex ? updatedTicket : ticket
                );
                queueState = buildQueueStateFromTickets(queueTickets);
                return json(route, {
                    ok: true,
                    data: {
                        ticket: updatedTicket,
                        queueState,
                    },
                });
            }

            if (resource === 'queue-call-next' && request.method() === 'POST') {
                const body = JSON.parse(request.postData() || '{}');
                const consultorio = Number(body.consultorio || 0);
                const candidate = queueTickets.find(
                    (ticket) =>
                        ticket.status === 'waiting' &&
                        Number(ticket.assignedConsultorio || 0) === consultorio
                );
                if (!candidate) {
                    return json(
                        route,
                        { ok: false, error: 'Sin turnos asignados' },
                        409
                    );
                }
                queueTickets = queueTickets.map((ticket) =>
                    Number(ticket.id || 0) === Number(candidate.id || 0)
                        ? {
                              ...ticket,
                              status: 'called',
                              assignedConsultorio: consultorio,
                              calledAt: new Date().toISOString(),
                          }
                        : ticket
                );
                queueState = buildQueueStateFromTickets(queueTickets);
                return json(route, {
                    ok: true,
                    data: {
                        ticket: queueTickets.find(
                            (ticket) =>
                                Number(ticket.id || 0) ===
                                Number(candidate.id || 0)
                        ),
                        queueState,
                    },
                });
            }

            if (resource === 'health') {
                return json(route, { ok: true, status: 'ok' });
            }

            if (resource === 'funnel-metrics') {
                return json(route, { ok: true, data: {} });
            }

            return json(route, { ok: true, data: {} });
        });

        await page.goto(adminUrl());
        await expect(page.locator('#adminDashboard')).toBeVisible();
        await page.locator('.nav-item[data-section="queue"]').click();

        await expect(page.locator('#queueResolutionDeck')).toBeVisible();
        await expect(page.locator('#queueResolutionDeckTitle')).toContainText(
            'Resolución rápida'
        );
        await expect(page.locator('#queueResolutionPrimary_c1')).toContainText(
            'Completar A-1221'
        );
        await expect(
            page.locator('#queueResolutionNoShowPreview_c1')
        ).toContainText('A-1222');

        await page.locator('#queueResolutionNoShow_c1').click();

        await expect(page.locator('#queueSensitiveConfirmDialog')).toBeHidden();
        await expect(page.locator('#queueResolutionPending')).toContainText(
            'marcar no show A-1221 en C1'
        );

        await page.locator('#queueResolutionPendingConfirm').click();

        await expect(page.locator('#queueSensitiveConfirmDialog')).toBeHidden();
        await expect(page.locator('#queueResolutionCurrent_c1')).toContainText(
            'Sin ticket en cierre'
        );
        await expect(page.locator('#queueResolutionPrimary_c1')).toContainText(
            'Llamar A-1222'
        );
    });

    test('atajo por ticket localiza un turno general y lo reasigna sin bajar a la tabla', async ({
        page,
    }) => {
        let queueTickets = [
            {
                id: 1228,
                ticketCode: 'A-1228',
                queueType: 'walk_in',
                patientInitials: 'MN',
                priorityClass: 'walk_in',
                status: 'waiting',
                assignedConsultorio: null,
                createdAt: new Date(Date.now() - 7 * 60 * 1000).toISOString(),
            },
            {
                id: 1229,
                ticketCode: 'A-1229',
                queueType: 'appointment',
                patientInitials: 'QP',
                priorityClass: 'appt_overdue',
                status: 'waiting',
                assignedConsultorio: 1,
                createdAt: new Date(Date.now() - 4 * 60 * 1000).toISOString(),
            },
        ];
        let queueState = buildQueueStateFromTickets(queueTickets);

        await installLegacyAdminAuthMock(page, {
            csrfToken: 'csrf_queue_ticket_lookup',
        });

        await page.route(/\/api\.php(\?.*)?$/i, async (route) => {
            const request = route.request();
            const url = new URL(request.url());
            const resource = url.searchParams.get('resource') || '';
            if (resource === 'features') {
                return json(route, {
                    ok: true,
                    data: { admin_sony_ui: ADMIN_UI_VARIANT === 'sony_v2' },
                });
            }

            if (resource === 'data') {
                return json(route, {
                    ok: true,
                    data: {
                        appointments: [],
                        callbacks: [],
                        reviews: [],
                        availability: {},
                        availabilityMeta: {
                            source: 'store',
                            mode: 'live',
                            timezone: 'America/Guayaquil',
                            calendarConfigured: true,
                            calendarReachable: true,
                            generatedAt: new Date().toISOString(),
                        },
                        queue_tickets: queueTickets,
                        queueMeta: buildQueueMetaFromState(queueState),
                        queueSurfaceStatus: {
                            operator: {
                                surface: 'operator',
                                label: 'Operador',
                                status: 'ready',
                                updatedAt: new Date().toISOString(),
                                ageSec: 4,
                                stale: false,
                                summary: 'Equipo listo para operar en C2 fijo.',
                                latest: {
                                    deviceLabel: 'Operador C2 fijo',
                                    appMode: 'desktop',
                                    ageSec: 4,
                                    details: {
                                        station: 'c2',
                                        stationMode: 'locked',
                                        oneTap: false,
                                        numpadSeen: true,
                                    },
                                },
                                instances: [],
                            },
                            kiosk: {
                                surface: 'kiosk',
                                label: 'Kiosco',
                                status: 'unknown',
                                updatedAt: '',
                                ageSec: 0,
                                stale: true,
                                summary: 'Sin heartbeat',
                                latest: null,
                                instances: [],
                            },
                            display: {
                                surface: 'display',
                                label: 'Sala TV',
                                status: 'unknown',
                                updatedAt: '',
                                ageSec: 0,
                                stale: true,
                                summary: 'Sin heartbeat',
                                latest: null,
                                instances: [],
                            },
                        },
                    },
                });
            }

            if (resource === 'queue-ticket' && request.method() === 'PATCH') {
                const body = JSON.parse(request.postData() || '{}');
                const ticketId = Number(body.id || 0);
                const consultorio = Number(body.consultorio || 0);
                const action = String(body.action || '')
                    .trim()
                    .toLowerCase();
                queueTickets = queueTickets.map((ticket) => {
                    if (Number(ticket.id || 0) !== ticketId) {
                        return ticket;
                    }
                    if (action === 'reasignar' || action === 'reassign') {
                        return {
                            ...ticket,
                            assignedConsultorio: consultorio,
                        };
                    }
                    if (action === 'completar' || action === 'complete') {
                        return {
                            ...ticket,
                            status: 'completed',
                            completedAt: new Date().toISOString(),
                        };
                    }
                    return ticket;
                });
                queueState = buildQueueStateFromTickets(queueTickets);
                return json(route, {
                    ok: true,
                    data: {
                        ticket: queueTickets.find(
                            (ticket) => Number(ticket.id || 0) === ticketId
                        ),
                        queueState,
                    },
                });
            }

            if (resource === 'queue-call-next' && request.method() === 'POST') {
                const body = JSON.parse(request.postData() || '{}');
                const consultorio = Number(body.consultorio || 0);
                const candidate = queueTickets.find(
                    (ticket) =>
                        ticket.status === 'waiting' &&
                        Number(ticket.assignedConsultorio || 0) === consultorio
                );
                if (!candidate) {
                    return json(
                        route,
                        { ok: false, error: 'Sin turnos asignados' },
                        409
                    );
                }
                queueTickets = queueTickets.map((ticket) =>
                    ticket.id === candidate.id
                        ? {
                              ...ticket,
                              status: 'called',
                              assignedConsultorio: consultorio,
                              calledAt: new Date().toISOString(),
                          }
                        : ticket
                );
                queueState = buildQueueStateFromTickets(queueTickets);
                return json(route, {
                    ok: true,
                    data: {
                        ticket: queueTickets.find(
                            (ticket) => Number(ticket.id || 0) === candidate.id
                        ),
                        queueState,
                    },
                });
            }

            return json(route, { ok: true, data: {} });
        });

        await page.goto('/admin.html#queue');
        await page.locator('a[href="#queue"]').last().click();
        await expect(page.locator('#queueAppsHub')).toBeVisible();

        await expect(page.locator('#queueTicketLookup')).toBeVisible();
        await page.fill('#queueTicketLookupInput', 'A-1228');
        await page.locator('#queueTicketLookupSearchBtn').click();

        await expect(page.locator('#queueTicketLookupMatchCode')).toContainText(
            'A-1228'
        );
        await expect(page.locator('#queueTicketLookupHeadline')).toContainText(
            'cola general'
        );
        await expect(page.locator('#queueTicketLookupPrimary')).toContainText(
            'Asignar a C2'
        );

        await page.locator('#queueTicketLookupPrimary').click();

        await expect
            .poll(
                () =>
                    queueTickets.find((ticket) => ticket.id === 1228)
                        ?.assignedConsultorio
            )
            .toBe(2);
        await expect(page.locator('#queueTicketLookupBadge')).toContainText(
            'Siguiente en C2'
        );
        await expect(page.locator('#queueTicketLookupPrimary')).toContainText(
            'Llamar A-1228'
        );

        await page.locator('#queueTicketLookupPrimary').click();

        await expect
            .poll(
                () => queueTickets.find((ticket) => ticket.id === 1228)?.status
            )
            .toBe('called');
        await expect(page.locator('#queueTicketLookupBadge')).toContainText(
            'En atención C2'
        );
        await expect(page.locator('#queueTicketLookupPrimary')).toContainText(
            'Completar A-1228'
        );
    });

    test('ruta del ticket explica bloqueo y pivota al ticket activo del mismo consultorio', async ({
        page,
    }) => {
        let queueTickets = [
            {
                id: 1231,
                ticketCode: 'A-1231',
                queueType: 'appointment',
                patientInitials: 'RS',
                priorityClass: 'appt_overdue',
                status: 'called',
                assignedConsultorio: 1,
                createdAt: new Date(Date.now() - 18 * 60 * 1000).toISOString(),
                calledAt: new Date(Date.now() - 6 * 60 * 1000).toISOString(),
            },
            {
                id: 1232,
                ticketCode: 'A-1232',
                queueType: 'walk_in',
                patientInitials: 'LM',
                priorityClass: 'walk_in',
                status: 'waiting',
                assignedConsultorio: 1,
                createdAt: new Date(Date.now() - 8 * 60 * 1000).toISOString(),
            },
            {
                id: 1233,
                ticketCode: 'A-1233',
                queueType: 'walk_in',
                patientInitials: 'QP',
                priorityClass: 'walk_in',
                status: 'waiting',
                assignedConsultorio: 1,
                createdAt: new Date(Date.now() - 5 * 60 * 1000).toISOString(),
            },
        ];
        let queueState = buildQueueStateFromTickets(queueTickets);

        await page.addInitScript(() => {
            window.localStorage.setItem('queueOpsFocusModeV1', 'operations');
        });

        await installLegacyAdminAuthMock(page, {
            csrfToken: 'csrf_queue_ticket_route',
        });

        await page.route(/\/api\.php(\?.*)?$/i, async (route) => {
            const request = route.request();
            const url = new URL(request.url());
            const resource = url.searchParams.get('resource') || '';
            if (resource === 'features') {
                return json(route, {
                    ok: true,
                    data: { admin_sony_ui: ADMIN_UI_VARIANT === 'sony_v2' },
                });
            }

            if (resource === 'data') {
                return json(route, {
                    ok: true,
                    data: {
                        appointments: [],
                        callbacks: [],
                        reviews: [],
                        availability: {},
                        availabilityMeta: {
                            source: 'store',
                            mode: 'live',
                            timezone: 'America/Guayaquil',
                            calendarConfigured: true,
                            calendarReachable: true,
                            generatedAt: new Date().toISOString(),
                        },
                        queue_tickets: queueTickets,
                        queueMeta: buildQueueMetaFromState(queueState),
                        queueSurfaceStatus: {
                            operator: {
                                surface: 'operator',
                                label: 'Operador',
                                status: 'ready',
                                updatedAt: new Date().toISOString(),
                                ageSec: 4,
                                stale: false,
                                summary: 'Equipo listo para operar en C1 fijo.',
                                latest: {
                                    deviceLabel: 'Operador C1 fijo',
                                    appMode: 'desktop',
                                    ageSec: 4,
                                    details: {
                                        station: 'c1',
                                        stationMode: 'locked',
                                        oneTap: false,
                                        numpadSeen: true,
                                    },
                                },
                                instances: [],
                            },
                            kiosk: {
                                surface: 'kiosk',
                                label: 'Kiosco',
                                status: 'unknown',
                                updatedAt: '',
                                ageSec: 0,
                                stale: true,
                                summary: 'Sin heartbeat',
                                latest: null,
                                instances: [],
                            },
                            display: {
                                surface: 'display',
                                label: 'Sala TV',
                                status: 'unknown',
                                updatedAt: '',
                                ageSec: 0,
                                stale: true,
                                summary: 'Sin heartbeat',
                                latest: null,
                                instances: [],
                            },
                        },
                    },
                });
            }

            return json(route, { ok: true, data: {} });
        });

        await page.goto('/admin.html#queue');
        await page.locator('a[href="#queue"]').last().click();

        await page.fill('#queueTicketLookupInput', 'A-1232');
        await page.locator('#queueTicketLookupSearchBtn').click();

        await expect(page.locator('#queueTicketRoute')).toBeVisible();
        await expect(page.locator('#queueTicketRouteTitle')).toContainText(
            'Ruta de A-1232'
        );
        await expect(page.locator('#queueTicketRouteLane')).toContainText('C1');
        await expect(page.locator('#queueTicketRoutePosition')).toContainText(
            '1 paso'
        );
        await expect(page.locator('#queueTicketRouteImpact')).toContainText(
            'A-1231'
        );
        await expect(
            page.locator('#queueTicketRoutePivotPrimary')
        ).toContainText('Ver ticket activo A-1231');

        await page.locator('#queueTicketRoutePivotPrimary').click();

        await expect(page.locator('#queueTicketLookupMatchCode')).toContainText(
            'A-1231'
        );
        await expect(page.locator('#queueTicketRouteTitle')).toContainText(
            'Ruta de A-1231'
        );
        await expect(page.locator('#queueTicketRoutePosition')).toContainText(
            'Paciente en atención'
        );
    });

    test('simulacion operativa proyecta el cierre y carga el siguiente ticket listo', async ({
        page,
    }) => {
        let queueTickets = [
            {
                id: 1241,
                ticketCode: 'A-1241',
                queueType: 'appointment',
                patientInitials: 'RS',
                priorityClass: 'appt_overdue',
                status: 'called',
                assignedConsultorio: 1,
                createdAt: new Date(Date.now() - 17 * 60 * 1000).toISOString(),
                calledAt: new Date(Date.now() - 5 * 60 * 1000).toISOString(),
            },
            {
                id: 1242,
                ticketCode: 'A-1242',
                queueType: 'walk_in',
                patientInitials: 'LM',
                priorityClass: 'walk_in',
                status: 'waiting',
                assignedConsultorio: 1,
                createdAt: new Date(Date.now() - 6 * 60 * 1000).toISOString(),
            },
            {
                id: 1243,
                ticketCode: 'A-1243',
                queueType: 'walk_in',
                patientInitials: 'QP',
                priorityClass: 'walk_in',
                status: 'waiting',
                assignedConsultorio: null,
                createdAt: new Date(Date.now() - 4 * 60 * 1000).toISOString(),
            },
        ];
        let queueState = buildQueueStateFromTickets(queueTickets);

        await page.addInitScript(() => {
            window.localStorage.setItem('queueOpsFocusModeV1', 'operations');
        });

        await installLegacyAdminAuthMock(page, {
            csrfToken: 'csrf_queue_ticket_simulation',
        });

        await page.route(/\/api\.php(\?.*)?$/i, async (route) => {
            const request = route.request();
            const url = new URL(request.url());
            const resource = url.searchParams.get('resource') || '';
            if (resource === 'features') {
                return json(route, {
                    ok: true,
                    data: { admin_sony_ui: ADMIN_UI_VARIANT === 'sony_v2' },
                });
            }

            if (resource === 'data') {
                return json(route, {
                    ok: true,
                    data: {
                        appointments: [],
                        callbacks: [],
                        reviews: [],
                        availability: {},
                        availabilityMeta: {
                            source: 'store',
                            mode: 'live',
                            timezone: 'America/Guayaquil',
                            calendarConfigured: true,
                            calendarReachable: true,
                            generatedAt: new Date().toISOString(),
                        },
                        queue_tickets: queueTickets,
                        queueMeta: buildQueueMetaFromState(queueState),
                        queueSurfaceStatus: {
                            operator: {
                                surface: 'operator',
                                label: 'Operador',
                                status: 'ready',
                                updatedAt: new Date().toISOString(),
                                ageSec: 4,
                                stale: false,
                                summary: 'Equipo listo para operar en C1 fijo.',
                                latest: {
                                    deviceLabel: 'Operador C1 fijo',
                                    appMode: 'desktop',
                                    ageSec: 4,
                                    details: {
                                        station: 'c1',
                                        stationMode: 'locked',
                                        oneTap: false,
                                        numpadSeen: true,
                                    },
                                },
                                instances: [],
                            },
                            kiosk: {
                                surface: 'kiosk',
                                label: 'Kiosco',
                                status: 'unknown',
                                updatedAt: '',
                                ageSec: 0,
                                stale: true,
                                summary: 'Sin heartbeat',
                                latest: null,
                                instances: [],
                            },
                            display: {
                                surface: 'display',
                                label: 'Sala TV',
                                status: 'unknown',
                                updatedAt: '',
                                ageSec: 0,
                                stale: true,
                                summary: 'Sin heartbeat',
                                latest: null,
                                instances: [],
                            },
                        },
                    },
                });
            }

            return json(route, { ok: true, data: {} });
        });

        await page.goto('/admin.html#queue');
        await page.locator('a[href="#queue"]').last().click();

        await page.fill('#queueTicketLookupInput', 'A-1241');
        await page.locator('#queueTicketLookupSearchBtn').click();

        await expect(page.locator('#queueTicketSimulation')).toBeVisible();
        await expect(page.locator('#queueTicketSimulationTitle')).toContainText(
            'A-1241'
        );
        await expect(
            page.locator('#queueTicketSimulationAction')
        ).toContainText('Completar A-1241');
        await expect(page.locator('#queueTicketSimulationAfter')).toContainText(
            'A-1242'
        );
        await expect(
            page.locator('#queueTicketSimulationFocusBtn')
        ).toContainText('A-1242');

        await page.locator('#queueTicketSimulationFocusBtn').click();

        await expect(page.locator('#queueTicketLookupMatchCode')).toContainText(
            'A-1242'
        );
        await expect(page.locator('#queueTicketSimulationTitle')).toContainText(
            'A-1242'
        );
        await expect(
            page.locator('#queueTicketSimulationAction')
        ).toContainText('Llamar A-1242');
    });

    test('proximos turnos arma la ronda inmediata y carga tickets al lookup', async ({
        page,
    }) => {
        let queueTickets = [
            {
                id: 1251,
                ticketCode: 'A-1251',
                queueType: 'appointment',
                patientInitials: 'RS',
                priorityClass: 'appt_overdue',
                status: 'called',
                assignedConsultorio: 1,
                createdAt: new Date(Date.now() - 19 * 60 * 1000).toISOString(),
                calledAt: new Date(Date.now() - 6 * 60 * 1000).toISOString(),
            },
            {
                id: 1252,
                ticketCode: 'A-1252',
                queueType: 'walk_in',
                patientInitials: 'LM',
                priorityClass: 'walk_in',
                status: 'waiting',
                assignedConsultorio: 1,
                createdAt: new Date(Date.now() - 7 * 60 * 1000).toISOString(),
            },
            {
                id: 1253,
                ticketCode: 'A-1253',
                queueType: 'walk_in',
                patientInitials: 'QP',
                priorityClass: 'walk_in',
                status: 'waiting',
                assignedConsultorio: 2,
                createdAt: new Date(Date.now() - 5 * 60 * 1000).toISOString(),
            },
            {
                id: 1254,
                ticketCode: 'A-1254',
                queueType: 'walk_in',
                patientInitials: 'AD',
                priorityClass: 'walk_in',
                status: 'waiting',
                assignedConsultorio: null,
                createdAt: new Date(Date.now() - 4 * 60 * 1000).toISOString(),
            },
            {
                id: 1255,
                ticketCode: 'A-1255',
                queueType: 'walk_in',
                patientInitials: 'BT',
                priorityClass: 'walk_in',
                status: 'waiting',
                assignedConsultorio: null,
                createdAt: new Date(Date.now() - 2 * 60 * 1000).toISOString(),
            },
        ];
        let queueState = buildQueueStateFromTickets(queueTickets);

        await page.addInitScript(() => {
            window.localStorage.setItem('queueOpsFocusModeV1', 'operations');
        });

        await installLegacyAdminAuthMock(page, {
            csrfToken: 'csrf_queue_next_turns',
        });

        await page.route(/\/api\.php(\?.*)?$/i, async (route) => {
            const request = route.request();
            const url = new URL(request.url());
            const resource = url.searchParams.get('resource') || '';
            if (resource === 'features') {
                return json(route, {
                    ok: true,
                    data: { admin_sony_ui: ADMIN_UI_VARIANT === 'sony_v2' },
                });
            }

            if (resource === 'data') {
                return json(route, {
                    ok: true,
                    data: {
                        appointments: [],
                        callbacks: [],
                        reviews: [],
                        availability: {},
                        availabilityMeta: {
                            source: 'store',
                            mode: 'live',
                            timezone: 'America/Guayaquil',
                            calendarConfigured: true,
                            calendarReachable: true,
                            generatedAt: new Date().toISOString(),
                        },
                        queue_tickets: queueTickets,
                        queueMeta: buildQueueMetaFromState(queueState),
                        queueSurfaceStatus: {
                            operator: {
                                surface: 'operator',
                                label: 'Operador',
                                status: 'ready',
                                updatedAt: new Date().toISOString(),
                                ageSec: 4,
                                stale: false,
                                summary: 'Equipo listo para operar en C1 fijo.',
                                latest: {
                                    deviceLabel: 'Operador C1 fijo',
                                    appMode: 'desktop',
                                    ageSec: 4,
                                    details: {
                                        station: 'c1',
                                        stationMode: 'locked',
                                        oneTap: false,
                                        numpadSeen: true,
                                    },
                                },
                                instances: [],
                            },
                            kiosk: {
                                surface: 'kiosk',
                                label: 'Kiosco',
                                status: 'unknown',
                                updatedAt: '',
                                ageSec: 0,
                                stale: true,
                                summary: 'Sin heartbeat',
                                latest: null,
                                instances: [],
                            },
                            display: {
                                surface: 'display',
                                label: 'Sala TV',
                                status: 'unknown',
                                updatedAt: '',
                                ageSec: 0,
                                stale: true,
                                summary: 'Sin heartbeat',
                                latest: null,
                                instances: [],
                            },
                        },
                    },
                });
            }

            return json(route, { ok: true, data: {} });
        });

        await page.goto('/admin.html#queue');
        await page.locator('a[href="#queue"]').last().click();

        await expect(page.locator('#queueNextTurns')).toBeVisible();
        await expect(page.locator('#queueNextTurnsTitle')).toContainText(
            'Próximos turnos'
        );
        await expect(page.locator('#queueNextTurnsStep_c1_0')).toContainText(
            'Completar A-1251'
        );
        await expect(page.locator('#queueNextTurnsStep_c1_1')).toContainText(
            'Llamar A-1252'
        );
        await expect(
            page.locator('#queueNextTurnsStep_general_0')
        ).toContainText('Asignar A-1254 a C1');

        await page.locator('#queueNextTurnsLoad_c1_1').click();

        await expect(page.locator('#queueTicketLookupMatchCode')).toContainText(
            'A-1252'
        );
        await expect(page.locator('#queueTicketLookupHeadline')).toContainText(
            'C1'
        );
    });

    test('ronda maestra prioriza la secuencia global y carga el ticket elegido', async ({
        page,
    }) => {
        let queueTickets = [
            {
                id: 1261,
                ticketCode: 'A-1261',
                queueType: 'appointment',
                patientInitials: 'RS',
                priorityClass: 'appt_overdue',
                status: 'called',
                assignedConsultorio: 1,
                createdAt: new Date(Date.now() - 22 * 60 * 1000).toISOString(),
                calledAt: new Date(Date.now() - 7 * 60 * 1000).toISOString(),
            },
            {
                id: 1262,
                ticketCode: 'A-1262',
                queueType: 'walk_in',
                patientInitials: 'LM',
                priorityClass: 'walk_in',
                status: 'waiting',
                assignedConsultorio: 1,
                createdAt: new Date(Date.now() - 8 * 60 * 1000).toISOString(),
            },
            {
                id: 1263,
                ticketCode: 'A-1263',
                queueType: 'walk_in',
                patientInitials: 'QP',
                priorityClass: 'walk_in',
                status: 'waiting',
                assignedConsultorio: 2,
                createdAt: new Date(Date.now() - 6 * 60 * 1000).toISOString(),
            },
            {
                id: 1264,
                ticketCode: 'A-1264',
                queueType: 'walk_in',
                patientInitials: 'AD',
                priorityClass: 'walk_in',
                status: 'waiting',
                assignedConsultorio: null,
                createdAt: new Date(Date.now() - 5 * 60 * 1000).toISOString(),
            },
        ];
        let queueState = buildQueueStateFromTickets(queueTickets);

        await page.addInitScript(() => {
            window.localStorage.setItem('queueOpsFocusModeV1', 'operations');
        });

        await installLegacyAdminAuthMock(page, {
            csrfToken: 'csrf_queue_master_sequence',
        });

        await page.route(/\/api\.php(\?.*)?$/i, async (route) => {
            const request = route.request();
            const url = new URL(request.url());
            const resource = url.searchParams.get('resource') || '';
            if (resource === 'features') {
                return json(route, {
                    ok: true,
                    data: { admin_sony_ui: ADMIN_UI_VARIANT === 'sony_v2' },
                });
            }

            if (resource === 'data') {
                return json(route, {
                    ok: true,
                    data: {
                        appointments: [],
                        callbacks: [],
                        reviews: [],
                        availability: {},
                        availabilityMeta: {
                            source: 'store',
                            mode: 'live',
                            timezone: 'America/Guayaquil',
                            calendarConfigured: true,
                            calendarReachable: true,
                            generatedAt: new Date().toISOString(),
                        },
                        queue_tickets: queueTickets,
                        queueMeta: buildQueueMetaFromState(queueState),
                        queueSurfaceStatus: {
                            operator: {
                                surface: 'operator',
                                label: 'Operador',
                                status: 'ready',
                                updatedAt: new Date().toISOString(),
                                ageSec: 4,
                                stale: false,
                                summary: 'Equipo listo para operar en C1 fijo.',
                                latest: {
                                    deviceLabel: 'Operador C1 fijo',
                                    appMode: 'desktop',
                                    ageSec: 4,
                                    details: {
                                        station: 'c1',
                                        stationMode: 'locked',
                                        oneTap: false,
                                        numpadSeen: true,
                                    },
                                },
                                instances: [],
                            },
                            kiosk: {
                                surface: 'kiosk',
                                label: 'Kiosco',
                                status: 'unknown',
                                updatedAt: '',
                                ageSec: 0,
                                stale: true,
                                summary: 'Sin heartbeat',
                                latest: null,
                                instances: [],
                            },
                            display: {
                                surface: 'display',
                                label: 'Sala TV',
                                status: 'unknown',
                                updatedAt: '',
                                ageSec: 0,
                                stale: true,
                                summary: 'Sin heartbeat',
                                latest: null,
                                instances: [],
                            },
                        },
                    },
                });
            }

            return json(route, { ok: true, data: {} });
        });

        await page.goto('/admin.html#queue');
        await page.locator('a[href="#queue"]').last().click();

        await expect(page.locator('#queueMasterSequence')).toBeVisible();
        await expect(page.locator('#queueMasterSequenceTitle')).toContainText(
            'Ronda maestra'
        );
        await expect(
            page.locator('#queueMasterSequenceAction_0')
        ).toContainText('Completar A-1261');
        await expect(
            page.locator('#queueMasterSequenceAction_1')
        ).toContainText('Llamar A-1262');
        await expect(
            page.locator('#queueMasterSequenceAction_2')
        ).toContainText('Asignar A-1264 a C1');

        await page.locator('#queueMasterSequenceLoad_2').click();

        await expect(page.locator('#queueTicketLookupMatchCode')).toContainText(
            'A-1264'
        );
        await expect(page.locator('#queueTicketLookupHeadline')).toContainText(
            'cola general'
        );
    });

    test('bloqueos vivos prioriza cierres y operadores faltantes', async ({
        page,
    }) => {
        let queueTickets = [
            {
                id: 1271,
                ticketCode: 'A-1271',
                queueType: 'appointment',
                patientInitials: 'RS',
                priorityClass: 'appt_overdue',
                status: 'called',
                assignedConsultorio: 1,
                createdAt: new Date(Date.now() - 24 * 60 * 1000).toISOString(),
                calledAt: new Date(Date.now() - 8 * 60 * 1000).toISOString(),
            },
            {
                id: 1272,
                ticketCode: 'A-1272',
                queueType: 'walk_in',
                patientInitials: 'LM',
                priorityClass: 'walk_in',
                status: 'waiting',
                assignedConsultorio: 1,
                createdAt: new Date(Date.now() - 9 * 60 * 1000).toISOString(),
            },
            {
                id: 1273,
                ticketCode: 'A-1273',
                queueType: 'walk_in',
                patientInitials: 'QP',
                priorityClass: 'walk_in',
                status: 'waiting',
                assignedConsultorio: 2,
                createdAt: new Date(Date.now() - 6 * 60 * 1000).toISOString(),
            },
            {
                id: 1274,
                ticketCode: 'A-1274',
                queueType: 'walk_in',
                patientInitials: 'AD',
                priorityClass: 'walk_in',
                status: 'waiting',
                assignedConsultorio: null,
                createdAt: new Date(Date.now() - 4 * 60 * 1000).toISOString(),
            },
        ];
        let queueState = buildQueueStateFromTickets(queueTickets);

        await page.addInitScript(() => {
            window.localStorage.setItem('queueOpsFocusModeV1', 'operations');
        });

        await installLegacyAdminAuthMock(page, {
            csrfToken: 'csrf_queue_blockers',
        });

        await page.route(/\/api\.php(\?.*)?$/i, async (route) => {
            const request = route.request();
            const url = new URL(request.url());
            const resource = url.searchParams.get('resource') || '';
            if (resource === 'features') {
                return json(route, {
                    ok: true,
                    data: { admin_sony_ui: ADMIN_UI_VARIANT === 'sony_v2' },
                });
            }

            if (resource === 'data') {
                return json(route, {
                    ok: true,
                    data: {
                        appointments: [],
                        callbacks: [],
                        reviews: [],
                        availability: {},
                        availabilityMeta: {
                            source: 'store',
                            mode: 'live',
                            timezone: 'America/Guayaquil',
                            calendarConfigured: true,
                            calendarReachable: true,
                            generatedAt: new Date().toISOString(),
                        },
                        queue_tickets: queueTickets,
                        queueMeta: buildQueueMetaFromState(queueState),
                        queueSurfaceStatus: {
                            operator: {
                                surface: 'operator',
                                label: 'Operador',
                                status: 'ready',
                                updatedAt: new Date().toISOString(),
                                ageSec: 4,
                                stale: false,
                                summary: 'Equipo listo para operar en C1 fijo.',
                                latest: {
                                    deviceLabel: 'Operador C1 fijo',
                                    appMode: 'desktop',
                                    ageSec: 4,
                                    details: {
                                        station: 'c1',
                                        stationMode: 'locked',
                                        oneTap: false,
                                        numpadSeen: true,
                                    },
                                },
                                instances: [],
                            },
                            kiosk: {
                                surface: 'kiosk',
                                label: 'Kiosco',
                                status: 'unknown',
                                updatedAt: '',
                                ageSec: 0,
                                stale: true,
                                summary: 'Sin heartbeat',
                                latest: null,
                                instances: [],
                            },
                            display: {
                                surface: 'display',
                                label: 'Sala TV',
                                status: 'unknown',
                                updatedAt: '',
                                ageSec: 0,
                                stale: true,
                                summary: 'Sin heartbeat',
                                latest: null,
                                instances: [],
                            },
                        },
                    },
                });
            }

            return json(route, { ok: true, data: {} });
        });

        await page.goto('/admin.html#queue');
        await page.locator('a[href="#queue"]').last().click();

        await expect(page.locator('#queueBlockers')).toBeVisible();
        await expect(page.locator('#queueBlockersTitle')).toContainText(
            'Bloqueos vivos'
        );
        await expect(page.locator('#queueBlockersAction_0')).toContainText(
            'Completar A-1271'
        );
        await expect(page.locator('#queueBlockersAction_1')).toContainText(
            'Abrir Operador C2'
        );

        await page.locator('#queueBlockersLoad_1').click();

        await expect(page.locator('#queueTicketLookupMatchCode')).toContainText(
            'A-1273'
        );
        await expect(page.locator('#queueTicketLookupHeadline')).toContainText(
            'C2'
        );
    });

    test('sla vivo prioriza tickets vencidos o por vencer y los carga al lookup', async ({
        page,
    }) => {
        let queueTickets = [
            {
                id: 1281,
                ticketCode: 'A-1281',
                queueType: 'walk_in',
                patientInitials: 'RS',
                priorityClass: 'walk_in',
                status: 'waiting',
                assignedConsultorio: null,
                createdAt: new Date(Date.now() - 19 * 60 * 1000).toISOString(),
            },
            {
                id: 1282,
                ticketCode: 'A-1282',
                queueType: 'appointment',
                patientInitials: 'LM',
                priorityClass: 'appt_overdue',
                status: 'waiting',
                assignedConsultorio: null,
                createdAt: new Date(Date.now() - 4 * 60 * 1000).toISOString(),
            },
            {
                id: 1283,
                ticketCode: 'A-1283',
                queueType: 'walk_in',
                patientInitials: 'QP',
                priorityClass: 'walk_in',
                status: 'waiting',
                assignedConsultorio: 1,
                createdAt: new Date(Date.now() - 21 * 60 * 1000).toISOString(),
            },
            {
                id: 1284,
                ticketCode: 'A-1284',
                queueType: 'walk_in',
                patientInitials: 'AD',
                priorityClass: 'walk_in',
                status: 'waiting',
                assignedConsultorio: 2,
                createdAt: new Date(Date.now() - 8 * 60 * 1000).toISOString(),
            },
        ];
        let queueState = buildQueueStateFromTickets(queueTickets);

        await page.addInitScript(() => {
            window.localStorage.setItem('queueOpsFocusModeV1', 'operations');
        });

        await installLegacyAdminAuthMock(page, {
            csrfToken: 'csrf_queue_sla_deck',
        });

        await page.route(/\/api\.php(\?.*)?$/i, async (route) => {
            const request = route.request();
            const url = new URL(request.url());
            const resource = url.searchParams.get('resource') || '';
            if (resource === 'features') {
                return json(route, {
                    ok: true,
                    data: { admin_sony_ui: ADMIN_UI_VARIANT === 'sony_v2' },
                });
            }

            if (resource === 'data') {
                return json(route, {
                    ok: true,
                    data: {
                        appointments: [],
                        callbacks: [],
                        reviews: [],
                        availability: {},
                        availabilityMeta: {
                            source: 'store',
                            mode: 'live',
                            timezone: 'America/Guayaquil',
                            calendarConfigured: true,
                            calendarReachable: true,
                            generatedAt: new Date().toISOString(),
                        },
                        queue_tickets: queueTickets,
                        queueMeta: buildQueueMetaFromState(queueState),
                        queueSurfaceStatus: {
                            operator: {
                                surface: 'operator',
                                label: 'Operador',
                                status: 'ready',
                                updatedAt: new Date().toISOString(),
                                ageSec: 4,
                                stale: false,
                                summary: 'Equipo listo para operar en C1 fijo.',
                                latest: {
                                    deviceLabel: 'Operador C1 fijo',
                                    appMode: 'desktop',
                                    ageSec: 4,
                                    details: {
                                        station: 'c1',
                                        stationMode: 'locked',
                                        oneTap: false,
                                        numpadSeen: true,
                                    },
                                },
                                instances: [],
                            },
                            kiosk: {
                                surface: 'kiosk',
                                label: 'Kiosco',
                                status: 'unknown',
                                updatedAt: '',
                                ageSec: 0,
                                stale: true,
                                summary: 'Sin heartbeat',
                                latest: null,
                                instances: [],
                            },
                            display: {
                                surface: 'display',
                                label: 'Sala TV',
                                status: 'unknown',
                                updatedAt: '',
                                ageSec: 0,
                                stale: true,
                                summary: 'Sin heartbeat',
                                latest: null,
                                instances: [],
                            },
                        },
                    },
                });
            }

            return json(route, { ok: true, data: {} });
        });

        await page.goto('/admin.html#queue');
        await page.locator('a[href="#queue"]').last().click();

        await expect(page.locator('#queueSlaDeck')).toBeVisible();
        await expect(page.locator('#queueSlaDeckTitle')).toContainText(
            'SLA vivo'
        );
        await expect(page.locator('#queueSlaDeckHeadline_0')).toContainText(
            'A-1282'
        );
        await expect(page.locator('#queueSlaDeckDue_0')).toContainText(
            'cita ya vencida'
        );
        await expect(page.locator('#queueSlaDeckHeadline_1')).toContainText(
            'A-1283'
        );

        await page.locator('#queueSlaDeckLoad_0').click();

        await expect(page.locator('#queueTicketLookupMatchCode')).toContainText(
            'A-1282'
        );
        await expect(page.locator('#queueTicketLookupHeadline')).toContainText(
            'cola general'
        );
    });

    test('cobertura siguiente marca consultorios cubiertos y huecos proximos', async ({
        page,
    }) => {
        const queueTickets = [
            {
                id: 1291,
                ticketCode: 'A-1291',
                queueType: 'appointment',
                patientInitials: 'RS',
                priorityClass: 'appt_overdue',
                status: 'called',
                assignedConsultorio: 1,
                createdAt: new Date(Date.now() - 20 * 60 * 1000).toISOString(),
                calledAt: new Date(Date.now() - 7 * 60 * 1000).toISOString(),
            },
            {
                id: 1292,
                ticketCode: 'A-1292',
                queueType: 'walk_in',
                patientInitials: 'LM',
                priorityClass: 'walk_in',
                status: 'waiting',
                assignedConsultorio: 1,
                createdAt: new Date(Date.now() - 8 * 60 * 1000).toISOString(),
            },
            {
                id: 1293,
                ticketCode: 'A-1293',
                queueType: 'appointment',
                patientInitials: 'QP',
                priorityClass: 'appt_overdue',
                status: 'called',
                assignedConsultorio: 2,
                createdAt: new Date(Date.now() - 17 * 60 * 1000).toISOString(),
                calledAt: new Date(Date.now() - 5 * 60 * 1000).toISOString(),
            },
            {
                id: 1294,
                ticketCode: 'A-1294',
                queueType: 'walk_in',
                patientInitials: 'AD',
                priorityClass: 'walk_in',
                status: 'waiting',
                assignedConsultorio: null,
                createdAt: new Date(Date.now() - 4 * 60 * 1000).toISOString(),
            },
        ];
        const queueState = buildQueueStateFromTickets(queueTickets);

        await page.addInitScript(() => {
            window.localStorage.setItem('queueOpsFocusModeV1', 'operations');
        });

        await installLegacyAdminAuthMock(page, {
            csrfToken: 'csrf_queue_coverage_deck',
        });

        await page.route(/\/api\.php(\?.*)?$/i, async (route) => {
            const request = route.request();
            const url = new URL(request.url());
            const resource = url.searchParams.get('resource') || '';
            if (resource === 'features') {
                return json(route, {
                    ok: true,
                    data: { admin_sony_ui: ADMIN_UI_VARIANT === 'sony_v2' },
                });
            }

            if (resource === 'data') {
                return json(route, {
                    ok: true,
                    data: {
                        appointments: [],
                        callbacks: [],
                        reviews: [],
                        availability: {},
                        availabilityMeta: {
                            source: 'store',
                            mode: 'live',
                            timezone: 'America/Guayaquil',
                            calendarConfigured: true,
                            calendarReachable: true,
                            generatedAt: new Date().toISOString(),
                        },
                        queue_tickets: queueTickets,
                        queueMeta: buildQueueMetaFromState(queueState),
                        queueSurfaceStatus: {
                            operator: {
                                surface: 'operator',
                                label: 'Operador',
                                status: 'ready',
                                updatedAt: new Date().toISOString(),
                                ageSec: 4,
                                stale: false,
                                summary: 'Equipo listo para operar en C1 fijo.',
                                latest: {
                                    deviceLabel: 'Operador C1 fijo',
                                    appMode: 'desktop',
                                    ageSec: 4,
                                    details: {
                                        station: 'c1',
                                        stationMode: 'locked',
                                        oneTap: false,
                                        numpadSeen: true,
                                    },
                                },
                                instances: [],
                            },
                            kiosk: {
                                surface: 'kiosk',
                                label: 'Kiosco',
                                status: 'unknown',
                                updatedAt: '',
                                ageSec: 0,
                                stale: true,
                                summary: 'Sin heartbeat',
                                latest: null,
                                instances: [],
                            },
                            display: {
                                surface: 'display',
                                label: 'Sala TV',
                                status: 'unknown',
                                updatedAt: '',
                                ageSec: 0,
                                stale: true,
                                summary: 'Sin heartbeat',
                                latest: null,
                                instances: [],
                            },
                        },
                    },
                });
            }

            return json(route, { ok: true, data: {} });
        });

        await page.goto('/admin.html#queue');
        await page.locator('a[href="#queue"]').last().click();

        await expect(page.locator('#queueCoverageDeck')).toBeVisible();
        await expect(page.locator('#queueCoverageDeckTitle')).toContainText(
            'Cobertura siguiente'
        );
        await expect(page.locator('#queueCoverageHeadline_c1')).toContainText(
            'C1 ya tiene cubierto el siguiente paso'
        );
        await expect(page.locator('#queueCoverageGap_c1')).toContainText(
            'A-1292 entra cuando cierres A-1291'
        );
        await expect(page.locator('#queueCoverageHeadline_c2')).toContainText(
            'C2 quedará sin cobertura tras A-1293'
        );
        await expect(page.locator('#queueCoverageGap_c2')).toContainText(
            'A-1294 podría cubrir el hueco'
        );
        await expect(page.locator('#queueCoveragePrimary_c2')).toContainText(
            'Cargar A-1294'
        );

        await page.locator('#queueCoveragePrimary_c2').click();

        await expect(page.locator('#queueTicketLookupMatchCode')).toContainText(
            'A-1294'
        );
        await expect(page.locator('#queueTicketLookupHeadline')).toContainText(
            'cola general'
        );
    });

    test('reserva inmediata marca segundo paso cubierto y dependencia de cola general', async ({
        page,
    }) => {
        const queueTickets = [
            {
                id: 1295,
                ticketCode: 'A-1295',
                queueType: 'appointment',
                patientInitials: 'RS',
                priorityClass: 'appt_overdue',
                status: 'called',
                assignedConsultorio: 1,
                createdAt: new Date(Date.now() - 20 * 60 * 1000).toISOString(),
                calledAt: new Date(Date.now() - 7 * 60 * 1000).toISOString(),
            },
            {
                id: 1296,
                ticketCode: 'A-1296',
                queueType: 'walk_in',
                patientInitials: 'LM',
                priorityClass: 'walk_in',
                status: 'waiting',
                assignedConsultorio: 1,
                createdAt: new Date(Date.now() - 8 * 60 * 1000).toISOString(),
            },
            {
                id: 1297,
                ticketCode: 'A-1297',
                queueType: 'walk_in',
                patientInitials: 'QP',
                priorityClass: 'walk_in',
                status: 'waiting',
                assignedConsultorio: 1,
                createdAt: new Date(Date.now() - 6 * 60 * 1000).toISOString(),
            },
            {
                id: 1298,
                ticketCode: 'A-1298',
                queueType: 'appointment',
                patientInitials: 'AD',
                priorityClass: 'appt_overdue',
                status: 'called',
                assignedConsultorio: 2,
                createdAt: new Date(Date.now() - 17 * 60 * 1000).toISOString(),
                calledAt: new Date(Date.now() - 5 * 60 * 1000).toISOString(),
            },
            {
                id: 1299,
                ticketCode: 'A-1299',
                queueType: 'walk_in',
                patientInitials: 'BT',
                priorityClass: 'walk_in',
                status: 'waiting',
                assignedConsultorio: 2,
                createdAt: new Date(Date.now() - 4 * 60 * 1000).toISOString(),
            },
            {
                id: 1300,
                ticketCode: 'A-1300',
                queueType: 'walk_in',
                patientInitials: 'NV',
                priorityClass: 'walk_in',
                status: 'waiting',
                assignedConsultorio: null,
                createdAt: new Date(Date.now() - 3 * 60 * 1000).toISOString(),
            },
        ];
        const queueState = buildQueueStateFromTickets(queueTickets);

        await page.addInitScript(() => {
            window.localStorage.setItem('queueOpsFocusModeV1', 'operations');
        });

        await installLegacyAdminAuthMock(page, {
            csrfToken: 'csrf_queue_reserve_deck',
        });

        await page.route(/\/api\.php(\?.*)?$/i, async (route) => {
            const request = route.request();
            const url = new URL(request.url());
            const resource = url.searchParams.get('resource') || '';
            if (resource === 'features') {
                return json(route, {
                    ok: true,
                    data: { admin_sony_ui: ADMIN_UI_VARIANT === 'sony_v2' },
                });
            }

            if (resource === 'data') {
                return json(route, {
                    ok: true,
                    data: {
                        appointments: [],
                        callbacks: [],
                        reviews: [],
                        availability: {},
                        availabilityMeta: {
                            source: 'store',
                            mode: 'live',
                            timezone: 'America/Guayaquil',
                            calendarConfigured: true,
                            calendarReachable: true,
                            generatedAt: new Date().toISOString(),
                        },
                        queue_tickets: queueTickets,
                        queueMeta: buildQueueMetaFromState(queueState),
                        queueSurfaceStatus: {
                            operator: {
                                surface: 'operator',
                                label: 'Operador',
                                status: 'ready',
                                updatedAt: new Date().toISOString(),
                                ageSec: 4,
                                stale: false,
                                summary: 'Equipo listo para operar en C1 fijo.',
                                latest: {
                                    deviceLabel: 'Operador C1 fijo',
                                    appMode: 'desktop',
                                    ageSec: 4,
                                    details: {
                                        station: 'c1',
                                        stationMode: 'locked',
                                        oneTap: false,
                                        numpadSeen: true,
                                    },
                                },
                                instances: [],
                            },
                            kiosk: {
                                surface: 'kiosk',
                                label: 'Kiosco',
                                status: 'unknown',
                                updatedAt: '',
                                ageSec: 0,
                                stale: true,
                                summary: 'Sin heartbeat',
                                latest: null,
                                instances: [],
                            },
                            display: {
                                surface: 'display',
                                label: 'Sala TV',
                                status: 'unknown',
                                updatedAt: '',
                                ageSec: 0,
                                stale: true,
                                summary: 'Sin heartbeat',
                                latest: null,
                                instances: [],
                            },
                        },
                    },
                });
            }

            return json(route, { ok: true, data: {} });
        });

        await page.goto('/admin.html#queue');
        await page.locator('a[href="#queue"]').last().click();

        await expect(page.locator('#queueReserveDeck')).toBeVisible();
        await expect(page.locator('#queueReserveDeckTitle')).toContainText(
            'Reserva inmediata'
        );
        await expect(page.locator('#queueReserveHeadline_c1')).toContainText(
            'C1 ya tiene reserva después del siguiente turno'
        );
        await expect(page.locator('#queueReserveBuffer_c1')).toContainText(
            'A-1297'
        );
        await expect(page.locator('#queueReserveHeadline_c2')).toContainText(
            'C2 depende de cola general después de A-1299'
        );
        await expect(page.locator('#queueReserveBuffer_c2')).toContainText(
            'A-1300 en cola general'
        );
        await expect(page.locator('#queueReserveSupport_c2')).toContainText(
            'A-1300 puede ser la reserva'
        );
        await expect(page.locator('#queueReservePrimary_c2')).toContainText(
            'Cargar A-1300'
        );

        await page.locator('#queueReservePrimary_c2').click();

        await expect(page.locator('#queueTicketLookupMatchCode')).toContainText(
            'A-1300'
        );
        await expect(page.locator('#queueTicketLookupHeadline')).toContainText(
            'cola general'
        );
    });

    test('cola general guiada reparte los siguientes tickets por hueco y reserva', async ({
        page,
    }) => {
        const queueTickets = [
            {
                id: 1301,
                ticketCode: 'A-1301',
                queueType: 'appointment',
                patientInitials: 'RS',
                priorityClass: 'appt_overdue',
                status: 'called',
                assignedConsultorio: 1,
                createdAt: new Date(Date.now() - 20 * 60 * 1000).toISOString(),
                calledAt: new Date(Date.now() - 7 * 60 * 1000).toISOString(),
            },
            {
                id: 1302,
                ticketCode: 'A-1302',
                queueType: 'walk_in',
                patientInitials: 'LM',
                priorityClass: 'walk_in',
                status: 'waiting',
                assignedConsultorio: 1,
                createdAt: new Date(Date.now() - 8 * 60 * 1000).toISOString(),
            },
            {
                id: 1303,
                ticketCode: 'A-1303',
                queueType: 'appointment',
                patientInitials: 'QP',
                priorityClass: 'appt_overdue',
                status: 'called',
                assignedConsultorio: 2,
                createdAt: new Date(Date.now() - 17 * 60 * 1000).toISOString(),
                calledAt: new Date(Date.now() - 5 * 60 * 1000).toISOString(),
            },
            {
                id: 1304,
                ticketCode: 'A-1304',
                queueType: 'walk_in',
                patientInitials: 'AD',
                priorityClass: 'walk_in',
                status: 'waiting',
                assignedConsultorio: null,
                createdAt: new Date(Date.now() - 6 * 60 * 1000).toISOString(),
            },
            {
                id: 1305,
                ticketCode: 'A-1305',
                queueType: 'walk_in',
                patientInitials: 'BT',
                priorityClass: 'walk_in',
                status: 'waiting',
                assignedConsultorio: null,
                createdAt: new Date(Date.now() - 3 * 60 * 1000).toISOString(),
            },
        ];
        const queueState = buildQueueStateFromTickets(queueTickets);

        await page.addInitScript(() => {
            window.localStorage.setItem('queueOpsFocusModeV1', 'operations');
        });

        await installLegacyAdminAuthMock(page, {
            csrfToken: 'csrf_queue_general_guidance',
        });

        await page.route(/\/api\.php(\?.*)?$/i, async (route) => {
            const request = route.request();
            const url = new URL(request.url());
            const resource = url.searchParams.get('resource') || '';
            if (resource === 'features') {
                return json(route, {
                    ok: true,
                    data: { admin_sony_ui: ADMIN_UI_VARIANT === 'sony_v2' },
                });
            }

            if (resource === 'data') {
                return json(route, {
                    ok: true,
                    data: {
                        appointments: [],
                        callbacks: [],
                        reviews: [],
                        availability: {},
                        availabilityMeta: {
                            source: 'store',
                            mode: 'live',
                            timezone: 'America/Guayaquil',
                            calendarConfigured: true,
                            calendarReachable: true,
                            generatedAt: new Date().toISOString(),
                        },
                        queue_tickets: queueTickets,
                        queueMeta: buildQueueMetaFromState(queueState),
                        queueSurfaceStatus: {
                            operator: {
                                surface: 'operator',
                                label: 'Operador',
                                status: 'ready',
                                updatedAt: new Date().toISOString(),
                                ageSec: 4,
                                stale: false,
                                summary: 'Equipo listo para operar en C1 fijo.',
                                latest: {
                                    deviceLabel: 'Operador C1 fijo',
                                    appMode: 'desktop',
                                    ageSec: 4,
                                    details: {
                                        station: 'c1',
                                        stationMode: 'locked',
                                        oneTap: false,
                                        numpadSeen: true,
                                    },
                                },
                                instances: [],
                            },
                            kiosk: {
                                surface: 'kiosk',
                                label: 'Kiosco',
                                status: 'unknown',
                                updatedAt: '',
                                ageSec: 0,
                                stale: true,
                                summary: 'Sin heartbeat',
                                latest: null,
                                instances: [],
                            },
                            display: {
                                surface: 'display',
                                label: 'Sala TV',
                                status: 'unknown',
                                updatedAt: '',
                                ageSec: 0,
                                stale: true,
                                summary: 'Sin heartbeat',
                                latest: null,
                                instances: [],
                            },
                        },
                    },
                });
            }

            return json(route, { ok: true, data: {} });
        });

        await page.goto('/admin.html#queue');
        await page.locator('a[href="#queue"]').last().click();

        await expect(page.locator('#queueGeneralGuidance')).toBeVisible();
        await expect(page.locator('#queueGeneralGuidanceTitle')).toContainText(
            'Cola general guiada'
        );
        await expect(
            page.locator('#queueGeneralGuidanceHeadline_0')
        ).toContainText('A-1304');
        await expect(
            page.locator('#queueGeneralGuidanceReason_0')
        ).toContainText('Cubre el hueco');
        await expect(
            page.locator('#queueGeneralGuidanceTarget_0')
        ).toContainText('C2');
        await expect(
            page.locator('#queueGeneralGuidanceHeadline_1')
        ).toContainText('A-1305');
        await expect(
            page.locator('#queueGeneralGuidanceReason_1')
        ).toContainText('Deja una reserva');
        await expect(
            page.locator('#queueGeneralGuidanceTarget_1')
        ).toContainText('C1');

        await page.locator('#queueGeneralGuidanceLoad_0').click();

        await expect(page.locator('#queueTicketLookupMatchCode')).toContainText(
            'A-1304'
        );
        await expect(page.locator('#queueTicketLookupHeadline')).toContainText(
            'cola general'
        );
    });

    test('proyeccion de cola resume los carriles despues de aplicar la guia general', async ({
        page,
    }) => {
        const queueTickets = [
            {
                id: 1306,
                ticketCode: 'A-1306',
                queueType: 'appointment',
                patientInitials: 'RS',
                priorityClass: 'appt_overdue',
                status: 'called',
                assignedConsultorio: 1,
                createdAt: new Date(Date.now() - 20 * 60 * 1000).toISOString(),
                calledAt: new Date(Date.now() - 7 * 60 * 1000).toISOString(),
            },
            {
                id: 1307,
                ticketCode: 'A-1307',
                queueType: 'walk_in',
                patientInitials: 'LM',
                priorityClass: 'walk_in',
                status: 'waiting',
                assignedConsultorio: 1,
                createdAt: new Date(Date.now() - 8 * 60 * 1000).toISOString(),
            },
            {
                id: 1308,
                ticketCode: 'A-1308',
                queueType: 'appointment',
                patientInitials: 'QP',
                priorityClass: 'appt_overdue',
                status: 'called',
                assignedConsultorio: 2,
                createdAt: new Date(Date.now() - 17 * 60 * 1000).toISOString(),
                calledAt: new Date(Date.now() - 5 * 60 * 1000).toISOString(),
            },
            {
                id: 1309,
                ticketCode: 'A-1309',
                queueType: 'walk_in',
                patientInitials: 'AD',
                priorityClass: 'walk_in',
                status: 'waiting',
                assignedConsultorio: null,
                createdAt: new Date(Date.now() - 6 * 60 * 1000).toISOString(),
            },
            {
                id: 1310,
                ticketCode: 'A-1310',
                queueType: 'walk_in',
                patientInitials: 'BT',
                priorityClass: 'walk_in',
                status: 'waiting',
                assignedConsultorio: null,
                createdAt: new Date(Date.now() - 3 * 60 * 1000).toISOString(),
            },
        ];
        const queueState = buildQueueStateFromTickets(queueTickets);

        await page.addInitScript(() => {
            window.localStorage.setItem('queueOpsFocusModeV1', 'operations');
        });

        await installLegacyAdminAuthMock(page, {
            csrfToken: 'csrf_queue_projected_deck',
        });

        await page.route(/\/api\.php(\?.*)?$/i, async (route) => {
            const request = route.request();
            const url = new URL(request.url());
            const resource = url.searchParams.get('resource') || '';
            if (resource === 'features') {
                return json(route, {
                    ok: true,
                    data: { admin_sony_ui: ADMIN_UI_VARIANT === 'sony_v2' },
                });
            }

            if (resource === 'data') {
                return json(route, {
                    ok: true,
                    data: {
                        appointments: [],
                        callbacks: [],
                        reviews: [],
                        availability: {},
                        availabilityMeta: {
                            source: 'store',
                            mode: 'live',
                            timezone: 'America/Guayaquil',
                            calendarConfigured: true,
                            calendarReachable: true,
                            generatedAt: new Date().toISOString(),
                        },
                        queue_tickets: queueTickets,
                        queueMeta: buildQueueMetaFromState(queueState),
                        queueSurfaceStatus: {
                            operator: {
                                surface: 'operator',
                                label: 'Operador',
                                status: 'ready',
                                updatedAt: new Date().toISOString(),
                                ageSec: 4,
                                stale: false,
                                summary: 'Equipo listo para operar en C1 fijo.',
                                latest: {
                                    deviceLabel: 'Operador C1 fijo',
                                    appMode: 'desktop',
                                    ageSec: 4,
                                    details: {
                                        station: 'c1',
                                        stationMode: 'locked',
                                        oneTap: false,
                                        numpadSeen: true,
                                    },
                                },
                                instances: [],
                            },
                            kiosk: {
                                surface: 'kiosk',
                                label: 'Kiosco',
                                status: 'unknown',
                                updatedAt: '',
                                ageSec: 0,
                                stale: true,
                                summary: 'Sin heartbeat',
                                latest: null,
                                instances: [],
                            },
                            display: {
                                surface: 'display',
                                label: 'Sala TV',
                                status: 'unknown',
                                updatedAt: '',
                                ageSec: 0,
                                stale: true,
                                summary: 'Sin heartbeat',
                                latest: null,
                                instances: [],
                            },
                        },
                    },
                });
            }

            return json(route, { ok: true, data: {} });
        });

        await page.goto('/admin.html#queue');
        await page.locator('a[href="#queue"]').last().click();

        await expect(page.locator('#queueProjectedDeck')).toBeVisible();
        await expect(page.locator('#queueProjectedDeckTitle')).toContainText(
            'Proyección de cola'
        );
        await expect(page.locator('#queueProjectedHeadline_c1')).toContainText(
            'C1 quedaría con reserva real'
        );
        await expect(page.locator('#queueProjectedSequence_c1')).toContainText(
            'A-1307 -> A-1310'
        );
        await expect(page.locator('#queueProjectedHeadline_c2')).toContainText(
            'C2 queda cubierto, pero sin reserva'
        );
        await expect(page.locator('#queueProjectedSequence_c2')).toContainText(
            'A-1309'
        );
        await page.locator('#queueProjectedPrimary_c2').click();
        await expect(page.locator('#queueTicketLookupMatchCode')).toContainText(
            'A-1309'
        );
    });

    test('ingresos nuevos reparte los dos siguientes ingresos sobre la proyeccion actual', async ({
        page,
    }) => {
        const queueTickets = [
            {
                id: 1321,
                ticketCode: 'A-1321',
                queueType: 'appointment',
                patientInitials: 'RS',
                priorityClass: 'appt_overdue',
                status: 'called',
                assignedConsultorio: 1,
                createdAt: new Date(Date.now() - 20 * 60 * 1000).toISOString(),
                calledAt: new Date(Date.now() - 7 * 60 * 1000).toISOString(),
            },
            {
                id: 1322,
                ticketCode: 'A-1322',
                queueType: 'walk_in',
                patientInitials: 'LM',
                priorityClass: 'walk_in',
                status: 'waiting',
                assignedConsultorio: 1,
                createdAt: new Date(Date.now() - 8 * 60 * 1000).toISOString(),
            },
            {
                id: 1323,
                ticketCode: 'A-1323',
                queueType: 'appointment',
                patientInitials: 'QP',
                priorityClass: 'appt_overdue',
                status: 'called',
                assignedConsultorio: 2,
                createdAt: new Date(Date.now() - 17 * 60 * 1000).toISOString(),
                calledAt: new Date(Date.now() - 5 * 60 * 1000).toISOString(),
            },
            {
                id: 1324,
                ticketCode: 'A-1324',
                queueType: 'walk_in',
                patientInitials: 'AD',
                priorityClass: 'walk_in',
                status: 'waiting',
                assignedConsultorio: null,
                createdAt: new Date(Date.now() - 6 * 60 * 1000).toISOString(),
            },
            {
                id: 1325,
                ticketCode: 'A-1325',
                queueType: 'walk_in',
                patientInitials: 'BT',
                priorityClass: 'walk_in',
                status: 'waiting',
                assignedConsultorio: null,
                createdAt: new Date(Date.now() - 3 * 60 * 1000).toISOString(),
            },
        ];
        const queueState = buildQueueStateFromTickets(queueTickets);

        await page.addInitScript(() => {
            window.localStorage.setItem('queueOpsFocusModeV1', 'operations');
        });

        await installLegacyAdminAuthMock(page, {
            csrfToken: 'csrf_queue_incoming_deck',
        });

        await page.route(/\/api\.php(\?.*)?$/i, async (route) => {
            const request = route.request();
            const url = new URL(request.url());
            const resource = url.searchParams.get('resource') || '';
            if (resource === 'features') {
                return json(route, {
                    ok: true,
                    data: { admin_sony_ui: ADMIN_UI_VARIANT === 'sony_v2' },
                });
            }

            if (resource === 'data') {
                return json(route, {
                    ok: true,
                    data: {
                        appointments: [],
                        callbacks: [],
                        reviews: [],
                        availability: {},
                        availabilityMeta: {
                            source: 'store',
                            mode: 'live',
                            timezone: 'America/Guayaquil',
                            calendarConfigured: true,
                            calendarReachable: true,
                            generatedAt: new Date().toISOString(),
                        },
                        queue_tickets: queueTickets,
                        queueMeta: buildQueueMetaFromState(queueState),
                        queueSurfaceStatus: {
                            operator: {
                                surface: 'operator',
                                label: 'Operador',
                                status: 'ready',
                                updatedAt: new Date().toISOString(),
                                ageSec: 4,
                                stale: false,
                                summary: 'Equipo listo para operar en C1 fijo.',
                                latest: {
                                    deviceLabel: 'Operador C1 fijo',
                                    appMode: 'desktop',
                                    ageSec: 4,
                                    details: {
                                        station: 'c1',
                                        stationMode: 'locked',
                                        oneTap: false,
                                        numpadSeen: true,
                                    },
                                },
                                instances: [],
                            },
                            kiosk: {
                                surface: 'kiosk',
                                label: 'Kiosco',
                                status: 'unknown',
                                updatedAt: '',
                                ageSec: 0,
                                stale: true,
                                summary: 'Sin heartbeat',
                                latest: null,
                                instances: [],
                            },
                            display: {
                                surface: 'display',
                                label: 'Sala TV',
                                status: 'unknown',
                                updatedAt: '',
                                ageSec: 0,
                                stale: true,
                                summary: 'Sin heartbeat',
                                latest: null,
                                instances: [],
                            },
                        },
                    },
                });
            }

            return json(route, { ok: true, data: {} });
        });

        await page.goto('/admin.html#queue');
        await page.locator('a[href="#queue"]').last().click();

        await expect(page.locator('#queueIncomingDeck')).toBeVisible();
        await expect(page.locator('#queueIncomingDeckTitle')).toContainText(
            'Ingresos nuevos'
        );
        await expect(page.locator('#queueIncomingDeckSummary')).toContainText(
            'Ingreso 1 conviene a C2'
        );
        await expect(page.locator('#queueIncomingHeadline_c1')).toContainText(
            'C1 absorbería 1 ingreso nuevo'
        );
        await expect(page.locator('#queueIncomingSequence_c1')).toContainText(
            'Ingreso 2'
        );
        await expect(page.locator('#queueIncomingHeadline_c2')).toContainText(
            'C2 absorbería 1 ingreso nuevo'
        );
        await expect(page.locator('#queueIncomingSequence_c2')).toContainText(
            'Ingreso 1'
        );
        await expect(page.locator('#queueIncomingOpen_c2')).toHaveAttribute(
            'href',
            /operador-turnos\.html\?station=c2&lock=1/
        );
    });

    test('escenarios de ingreso separan con cita y sin cita sobre la proyeccion actual', async ({
        page,
    }) => {
        const queueTickets = [
            {
                id: 1331,
                ticketCode: 'A-1331',
                queueType: 'appointment',
                patientInitials: 'RS',
                priorityClass: 'appt_overdue',
                status: 'called',
                assignedConsultorio: 1,
                createdAt: new Date(Date.now() - 20 * 60 * 1000).toISOString(),
                calledAt: new Date(Date.now() - 7 * 60 * 1000).toISOString(),
            },
            {
                id: 1332,
                ticketCode: 'A-1332',
                queueType: 'walk_in',
                patientInitials: 'LM',
                priorityClass: 'walk_in',
                status: 'waiting',
                assignedConsultorio: 1,
                createdAt: new Date(Date.now() - 8 * 60 * 1000).toISOString(),
            },
            {
                id: 1333,
                ticketCode: 'A-1333',
                queueType: 'appointment',
                patientInitials: 'QP',
                priorityClass: 'appt_overdue',
                status: 'called',
                assignedConsultorio: 2,
                createdAt: new Date(Date.now() - 17 * 60 * 1000).toISOString(),
                calledAt: new Date(Date.now() - 5 * 60 * 1000).toISOString(),
            },
            {
                id: 1334,
                ticketCode: 'A-1334',
                queueType: 'walk_in',
                patientInitials: 'AD',
                priorityClass: 'walk_in',
                status: 'waiting',
                assignedConsultorio: null,
                createdAt: new Date(Date.now() - 6 * 60 * 1000).toISOString(),
            },
            {
                id: 1335,
                ticketCode: 'A-1335',
                queueType: 'walk_in',
                patientInitials: 'BT',
                priorityClass: 'walk_in',
                status: 'waiting',
                assignedConsultorio: null,
                createdAt: new Date(Date.now() - 3 * 60 * 1000).toISOString(),
            },
        ];
        const queueState = buildQueueStateFromTickets(queueTickets);

        await page.addInitScript(() => {
            window.localStorage.setItem('queueOpsFocusModeV1', 'operations');
        });

        await installLegacyAdminAuthMock(page, {
            csrfToken: 'csrf_queue_scenarios',
        });

        await page.route(/\/api\.php(\?.*)?$/i, async (route) => {
            const request = route.request();
            const url = new URL(request.url());
            const resource = url.searchParams.get('resource') || '';
            if (resource === 'features') {
                return json(route, {
                    ok: true,
                    data: { admin_sony_ui: ADMIN_UI_VARIANT === 'sony_v2' },
                });
            }

            if (resource === 'data') {
                return json(route, {
                    ok: true,
                    data: {
                        appointments: [],
                        callbacks: [],
                        reviews: [],
                        availability: {},
                        availabilityMeta: {
                            source: 'store',
                            mode: 'live',
                            timezone: 'America/Guayaquil',
                            calendarConfigured: true,
                            calendarReachable: true,
                            generatedAt: new Date().toISOString(),
                        },
                        queue_tickets: queueTickets,
                        queueMeta: buildQueueMetaFromState(queueState),
                        queueSurfaceStatus: {
                            operator: {
                                surface: 'operator',
                                label: 'Operador',
                                status: 'ready',
                                updatedAt: new Date().toISOString(),
                                ageSec: 4,
                                stale: false,
                                summary: 'Equipo listo para operar en C1 fijo.',
                                latest: {
                                    deviceLabel: 'Operador C1 fijo',
                                    appMode: 'desktop',
                                    ageSec: 4,
                                    details: {
                                        station: 'c1',
                                        stationMode: 'locked',
                                        oneTap: false,
                                        numpadSeen: true,
                                    },
                                },
                                instances: [],
                            },
                            kiosk: {
                                surface: 'kiosk',
                                label: 'Kiosco',
                                status: 'unknown',
                                updatedAt: '',
                                ageSec: 0,
                                stale: true,
                                summary: 'Sin heartbeat',
                                latest: null,
                                instances: [],
                            },
                            display: {
                                surface: 'display',
                                label: 'Sala TV',
                                status: 'unknown',
                                updatedAt: '',
                                ageSec: 0,
                                stale: true,
                                summary: 'Sin heartbeat',
                                latest: null,
                                instances: [],
                            },
                        },
                    },
                });
            }

            return json(route, { ok: true, data: {} });
        });

        await page.goto('/admin.html#queue');
        await page.locator('a[href="#queue"]').last().click();

        await expect(page.locator('#queueScenarioDeck')).toBeVisible();
        await expect(page.locator('#queueScenarioDeckTitle')).toContainText(
            'Escenarios de ingreso'
        );
        await expect(page.locator('#queueScenarioDeckSummary')).toContainText(
            'Si llega con cita conviene C2'
        );
        await expect(
            page.locator('#queueScenarioHeadline_appointment')
        ).toContainText('Con cita: C2');
        await expect(
            page.locator('#queueScenarioHeadline_walkin')
        ).toContainText('Sin cita: C1');
        await expect(
            page.locator('#queueScenarioOpen_appointment')
        ).toHaveAttribute('href', /operador-turnos\.html\?station=c2&lock=1/);
        await expect(page.locator('#queueScenarioOpen_walkin')).toHaveAttribute(
            'href',
            /operador-turnos\.html\?station=c1&lock=1/
        );
    });

    test('guion de recepcion compacta general con cita sin cita y siguiente ingreso', async ({
        page,
    }) => {
        const queueTickets = [
            {
                id: 1341,
                ticketCode: 'A-1341',
                queueType: 'appointment',
                patientInitials: 'RS',
                priorityClass: 'appt_overdue',
                status: 'called',
                assignedConsultorio: 1,
                createdAt: new Date(Date.now() - 20 * 60 * 1000).toISOString(),
                calledAt: new Date(Date.now() - 7 * 60 * 1000).toISOString(),
            },
            {
                id: 1342,
                ticketCode: 'A-1342',
                queueType: 'walk_in',
                patientInitials: 'LM',
                priorityClass: 'walk_in',
                status: 'waiting',
                assignedConsultorio: 1,
                createdAt: new Date(Date.now() - 8 * 60 * 1000).toISOString(),
            },
            {
                id: 1343,
                ticketCode: 'A-1343',
                queueType: 'appointment',
                patientInitials: 'QP',
                priorityClass: 'appt_overdue',
                status: 'called',
                assignedConsultorio: 2,
                createdAt: new Date(Date.now() - 17 * 60 * 1000).toISOString(),
                calledAt: new Date(Date.now() - 5 * 60 * 1000).toISOString(),
            },
            {
                id: 1344,
                ticketCode: 'A-1344',
                queueType: 'walk_in',
                patientInitials: 'AD',
                priorityClass: 'walk_in',
                status: 'waiting',
                assignedConsultorio: null,
                createdAt: new Date(Date.now() - 6 * 60 * 1000).toISOString(),
            },
            {
                id: 1345,
                ticketCode: 'A-1345',
                queueType: 'walk_in',
                patientInitials: 'BT',
                priorityClass: 'walk_in',
                status: 'waiting',
                assignedConsultorio: null,
                createdAt: new Date(Date.now() - 3 * 60 * 1000).toISOString(),
            },
        ];
        const queueState = buildQueueStateFromTickets(queueTickets);

        await page.addInitScript(() => {
            window.localStorage.setItem('queueOpsFocusModeV1', 'operations');
        });

        await installLegacyAdminAuthMock(page, {
            csrfToken: 'csrf_queue_reception_script',
        });

        await page.route(/\/api\.php(\?.*)?$/i, async (route) => {
            const request = route.request();
            const url = new URL(request.url());
            const resource = url.searchParams.get('resource') || '';
            if (resource === 'features') {
                return json(route, {
                    ok: true,
                    data: { admin_sony_ui: ADMIN_UI_VARIANT === 'sony_v2' },
                });
            }

            if (resource === 'data') {
                return json(route, {
                    ok: true,
                    data: {
                        appointments: [],
                        callbacks: [],
                        reviews: [],
                        availability: {},
                        availabilityMeta: {
                            source: 'store',
                            mode: 'live',
                            timezone: 'America/Guayaquil',
                            calendarConfigured: true,
                            calendarReachable: true,
                            generatedAt: new Date().toISOString(),
                        },
                        queue_tickets: queueTickets,
                        queueMeta: buildQueueMetaFromState(queueState),
                        queueSurfaceStatus: {
                            operator: {
                                surface: 'operator',
                                label: 'Operador',
                                status: 'ready',
                                updatedAt: new Date().toISOString(),
                                ageSec: 4,
                                stale: false,
                                summary: 'Equipo listo para operar en C1 fijo.',
                                latest: {
                                    deviceLabel: 'Operador C1 fijo',
                                    appMode: 'desktop',
                                    ageSec: 4,
                                    details: {
                                        station: 'c1',
                                        stationMode: 'locked',
                                        oneTap: false,
                                        numpadSeen: true,
                                    },
                                },
                                instances: [],
                            },
                            kiosk: {
                                surface: 'kiosk',
                                label: 'Kiosco',
                                status: 'unknown',
                                updatedAt: '',
                                ageSec: 0,
                                stale: true,
                                summary: 'Sin heartbeat',
                                latest: null,
                                instances: [],
                            },
                            display: {
                                surface: 'display',
                                label: 'Sala TV',
                                status: 'unknown',
                                updatedAt: '',
                                ageSec: 0,
                                stale: true,
                                summary: 'Sin heartbeat',
                                latest: null,
                                instances: [],
                            },
                        },
                    },
                });
            }

            return json(route, { ok: true, data: {} });
        });

        await page.goto('/admin.html#queue');
        await page.locator('a[href="#queue"]').last().click();

        await expect(page.locator('#queueReceptionScript')).toBeVisible();
        await expect(page.locator('#queueReceptionScriptTitle')).toContainText(
            'Guion de recepción'
        );
        await expect(
            page.locator('#queueReceptionScriptHeadline_0')
        ).toContainText('A-1344 -> C2');
        await expect(
            page.locator('#queueReceptionScriptHeadline_1')
        ).toContainText('Enviar a C2');
        await expect(
            page.locator('#queueReceptionScriptHeadline_2')
        ).toContainText('Enviar a C1');
        await expect(
            page.locator('#queueReceptionScriptHeadline_3')
        ).toContainText('Ingreso 1 -> C2');
        await expect(
            page.locator('#queueReceptionScriptOpen_0')
        ).toHaveAttribute('href', /operador-turnos\.html\?station=c2&lock=1/);
    });

    test('recepcion simultanea divide con cita y sin cita cuando ambos chocan en el mismo carril', async ({
        page,
    }) => {
        const queueTickets = [
            {
                id: 1361,
                ticketCode: 'A-1361',
                queueType: 'walk_in',
                patientInitials: 'MV',
                priorityClass: 'walk_in',
                status: 'called',
                assignedConsultorio: 1,
                createdAt: new Date(Date.now() - 24 * 60 * 1000).toISOString(),
                calledAt: new Date(Date.now() - 9 * 60 * 1000).toISOString(),
            },
            {
                id: 1362,
                ticketCode: 'A-1362',
                queueType: 'appointment',
                patientInitials: 'CP',
                priorityClass: 'appt_overdue',
                status: 'waiting',
                assignedConsultorio: 1,
                createdAt: new Date(Date.now() - 11 * 60 * 1000).toISOString(),
            },
            {
                id: 1363,
                ticketCode: 'A-1363',
                queueType: 'appointment',
                patientInitials: 'LT',
                priorityClass: 'appt_overdue',
                status: 'called',
                assignedConsultorio: 2,
                createdAt: new Date(Date.now() - 19 * 60 * 1000).toISOString(),
                calledAt: new Date(Date.now() - 6 * 60 * 1000).toISOString(),
            },
            {
                id: 1364,
                ticketCode: 'A-1364',
                queueType: 'walk_in',
                patientInitials: 'AR',
                priorityClass: 'walk_in',
                status: 'waiting',
                assignedConsultorio: 2,
                createdAt: new Date(Date.now() - 7 * 60 * 1000).toISOString(),
            },
        ];
        const queueState = buildQueueStateFromTickets(queueTickets);

        await page.addInitScript(() => {
            window.localStorage.setItem('queueOpsFocusModeV1', 'operations');
        });

        await installLegacyAdminAuthMock(page, {
            csrfToken: 'csrf_queue_reception_collision',
        });

        await page.route(/\/api\.php(\?.*)?$/i, async (route) => {
            const request = route.request();
            const url = new URL(request.url());
            const resource = url.searchParams.get('resource') || '';
            if (resource === 'features') {
                return json(route, {
                    ok: true,
                    data: { admin_sony_ui: ADMIN_UI_VARIANT === 'sony_v2' },
                });
            }

            if (resource === 'data') {
                return json(route, {
                    ok: true,
                    data: {
                        appointments: [],
                        callbacks: [],
                        reviews: [],
                        availability: {},
                        availabilityMeta: {
                            source: 'store',
                            mode: 'live',
                            timezone: 'America/Guayaquil',
                            calendarConfigured: true,
                            calendarReachable: true,
                            generatedAt: new Date().toISOString(),
                        },
                        queue_tickets: queueTickets,
                        queueMeta: buildQueueMetaFromState(queueState),
                        queueSurfaceStatus: {
                            operator: {
                                surface: 'operator',
                                label: 'Operador',
                                status: 'ready',
                                updatedAt: new Date().toISOString(),
                                ageSec: 4,
                                stale: false,
                                summary: 'Equipo listo para operar en C2 fijo.',
                                latest: {
                                    deviceLabel: 'Operador C2 fijo',
                                    appMode: 'desktop',
                                    ageSec: 4,
                                    details: {
                                        station: 'c2',
                                        stationMode: 'locked',
                                        oneTap: false,
                                        numpadSeen: true,
                                    },
                                },
                                instances: [],
                            },
                            kiosk: {
                                surface: 'kiosk',
                                label: 'Kiosco',
                                status: 'unknown',
                                updatedAt: '',
                                ageSec: 0,
                                stale: true,
                                summary: 'Sin heartbeat',
                                latest: null,
                                instances: [],
                            },
                            display: {
                                surface: 'display',
                                label: 'Sala TV',
                                status: 'unknown',
                                updatedAt: '',
                                ageSec: 0,
                                stale: true,
                                summary: 'Sin heartbeat',
                                latest: null,
                                instances: [],
                            },
                        },
                    },
                });
            }

            return json(route, { ok: true, data: {} });
        });

        await page.goto('/admin.html#queue');
        await page.locator('a[href="#queue"]').last().click();

        await expect(page.locator('#queueReceptionCollision')).toBeVisible();
        await expect(
            page.locator('#queueReceptionCollisionTitle')
        ).toContainText('Recepción simultánea');
        await expect(
            page.locator('#queueReceptionCollisionSummary')
        ).toContainText('con cita entra por C2 y sin cita se desvía a C1');
        await expect(
            page.locator('#queueReceptionCollisionStatus')
        ).toContainText('Cruce resuelto con preparación');
        await expect(
            page.locator('#queueReceptionCollisionHeadline_appointment')
        ).toContainText('1. Con cita -> C2');
        await expect(
            page.locator('#queueReceptionCollisionHeadline_walkin')
        ).toContainText('2. Sin cita -> C1');
        await expect(
            page.locator('#queueReceptionCollisionDetail_walkin')
        ).toContainText('Desvía el sin cita a C1');
        await expect(
            page.locator('#queueReceptionCollisionOpen_appointment')
        ).toHaveAttribute('href', /operador-turnos\.html\?station=c2&lock=1/);
        await expect(
            page.locator('#queueReceptionCollisionOpen_walkin')
        ).toHaveAttribute('href', /operador-turnos\.html\?station=c1&lock=1/);
    });

    test('semaforo de recepcion marca carril abierto y carril solo citas', async ({
        page,
    }) => {
        const queueTickets = [
            {
                id: 1381,
                ticketCode: 'A-1381',
                queueType: 'appointment',
                patientInitials: 'NR',
                priorityClass: 'appt_overdue',
                status: 'called',
                assignedConsultorio: 1,
                createdAt: new Date(Date.now() - 23 * 60 * 1000).toISOString(),
                calledAt: new Date(Date.now() - 8 * 60 * 1000).toISOString(),
            },
            {
                id: 1382,
                ticketCode: 'A-1382',
                queueType: 'walk_in',
                patientInitials: 'SP',
                priorityClass: 'walk_in',
                status: 'called',
                assignedConsultorio: 2,
                createdAt: new Date(Date.now() - 20 * 60 * 1000).toISOString(),
                calledAt: new Date(Date.now() - 6 * 60 * 1000).toISOString(),
            },
            {
                id: 1383,
                ticketCode: 'A-1383',
                queueType: 'walk_in',
                patientInitials: 'GM',
                priorityClass: 'walk_in',
                status: 'waiting',
                assignedConsultorio: 2,
                createdAt: new Date(Date.now() - 9 * 60 * 1000).toISOString(),
            },
            {
                id: 1384,
                ticketCode: 'A-1384',
                queueType: 'walk_in',
                patientInitials: 'TR',
                priorityClass: 'walk_in',
                status: 'waiting',
                assignedConsultorio: 2,
                createdAt: new Date(Date.now() - 5 * 60 * 1000).toISOString(),
            },
        ];
        const queueState = buildQueueStateFromTickets(queueTickets);

        await page.addInitScript(() => {
            window.localStorage.setItem('queueOpsFocusModeV1', 'operations');
        });

        await installLegacyAdminAuthMock(page, {
            csrfToken: 'csrf_queue_reception_lights',
        });

        await page.route(/\/api\.php(\?.*)?$/i, async (route) => {
            const request = route.request();
            const url = new URL(request.url());
            const resource = url.searchParams.get('resource') || '';
            if (resource === 'features') {
                return json(route, {
                    ok: true,
                    data: { admin_sony_ui: ADMIN_UI_VARIANT === 'sony_v2' },
                });
            }

            if (resource === 'data') {
                return json(route, {
                    ok: true,
                    data: {
                        appointments: [],
                        callbacks: [],
                        reviews: [],
                        availability: {},
                        availabilityMeta: {
                            source: 'store',
                            mode: 'live',
                            timezone: 'America/Guayaquil',
                            calendarConfigured: true,
                            calendarReachable: true,
                            generatedAt: new Date().toISOString(),
                        },
                        queue_tickets: queueTickets,
                        queueMeta: buildQueueMetaFromState(queueState),
                        queueSurfaceStatus: {
                            operator: {
                                surface: 'operator',
                                label: 'Operador',
                                status: 'ready',
                                updatedAt: new Date().toISOString(),
                                ageSec: 4,
                                stale: false,
                                summary: 'Equipo listo para operar en C1 fijo.',
                                latest: {
                                    deviceLabel: 'Operador C1 fijo',
                                    appMode: 'desktop',
                                    ageSec: 4,
                                    details: {
                                        station: 'c1',
                                        stationMode: 'locked',
                                        oneTap: false,
                                        numpadSeen: true,
                                    },
                                },
                                instances: [],
                            },
                            kiosk: {
                                surface: 'kiosk',
                                label: 'Kiosco',
                                status: 'unknown',
                                updatedAt: '',
                                ageSec: 0,
                                stale: true,
                                summary: 'Sin heartbeat',
                                latest: null,
                                instances: [],
                            },
                            display: {
                                surface: 'display',
                                label: 'Sala TV',
                                status: 'unknown',
                                updatedAt: '',
                                ageSec: 0,
                                stale: true,
                                summary: 'Sin heartbeat',
                                latest: null,
                                instances: [],
                            },
                        },
                    },
                });
            }

            return json(route, { ok: true, data: {} });
        });

        await page.goto('/admin.html#queue');
        await page.locator('a[href="#queue"]').last().click();

        await expect(page.locator('#queueReceptionLights')).toBeVisible();
        await expect(page.locator('#queueReceptionLightsTitle')).toContainText(
            'Semáforo de recepción'
        );
        await expect(
            page.locator('#queueReceptionLightsSummary')
        ).toContainText('C2 queda abierto para sin cita');
        await expect(
            page.locator('#queueReceptionLightsHeadline_c1')
        ).toContainText('C1 reservar para citas');
        await expect(
            page.locator('#queueReceptionLightsBadge_c1')
        ).toContainText('Solo citas');
        await expect(
            page.locator('#queueReceptionLightsRules_c1')
        ).toContainText('Con cita: preferido');
        await expect(
            page.locator('#queueReceptionLightsHeadline_c2')
        ).toContainText('C2 abierto para recepción');
        await expect(
            page.locator('#queueReceptionLightsBadge_c2')
        ).toContainText('Abierto');
        await expect(
            page.locator('#queueReceptionLightsRules_c2')
        ).toContainText('Sin cita: preferido');
        await expect(
            page.locator('#queueReceptionLightsOpen_c2')
        ).toHaveAttribute('href', /operador-turnos\.html\?station=c2&lock=1/);
    });

    test('ventana estimada resume la proxima apertura util por consultorio', async ({
        page,
    }) => {
        const queueTickets = [
            {
                id: 1401,
                ticketCode: 'A-1401',
                queueType: 'appointment',
                patientInitials: 'DA',
                priorityClass: 'appt_overdue',
                status: 'called',
                assignedConsultorio: 1,
                createdAt: new Date(Date.now() - 25 * 60 * 1000).toISOString(),
                calledAt: new Date(Date.now() - 7 * 60 * 1000).toISOString(),
            },
            {
                id: 1402,
                ticketCode: 'A-1402',
                queueType: 'walk_in',
                patientInitials: 'FB',
                priorityClass: 'walk_in',
                status: 'called',
                assignedConsultorio: 2,
                createdAt: new Date(Date.now() - 14 * 60 * 1000).toISOString(),
                calledAt: new Date(Date.now() - 2 * 60 * 1000).toISOString(),
            },
            {
                id: 1403,
                ticketCode: 'A-1403',
                queueType: 'walk_in',
                patientInitials: 'GC',
                priorityClass: 'walk_in',
                status: 'waiting',
                assignedConsultorio: 2,
                createdAt: new Date(Date.now() - 8 * 60 * 1000).toISOString(),
            },
            {
                id: 1404,
                ticketCode: 'A-1404',
                queueType: 'walk_in',
                patientInitials: 'HD',
                priorityClass: 'walk_in',
                status: 'waiting',
                assignedConsultorio: 2,
                createdAt: new Date(Date.now() - 3 * 60 * 1000).toISOString(),
            },
        ];
        const queueState = buildQueueStateFromTickets(queueTickets);

        await page.addInitScript(() => {
            window.localStorage.setItem('queueOpsFocusModeV1', 'operations');
        });

        await installLegacyAdminAuthMock(page, {
            csrfToken: 'csrf_queue_window_deck',
        });

        await page.route(/\/api\.php(\?.*)?$/i, async (route) => {
            const request = route.request();
            const url = new URL(request.url());
            const resource = url.searchParams.get('resource') || '';
            if (resource === 'features') {
                return json(route, {
                    ok: true,
                    data: { admin_sony_ui: ADMIN_UI_VARIANT === 'sony_v2' },
                });
            }

            if (resource === 'data') {
                return json(route, {
                    ok: true,
                    data: {
                        appointments: [],
                        callbacks: [],
                        reviews: [],
                        availability: {},
                        availabilityMeta: {
                            source: 'store',
                            mode: 'live',
                            timezone: 'America/Guayaquil',
                            calendarConfigured: true,
                            calendarReachable: true,
                            generatedAt: new Date().toISOString(),
                        },
                        queue_tickets: queueTickets,
                        queueMeta: buildQueueMetaFromState(queueState),
                        queueSurfaceStatus: {
                            operator: {
                                surface: 'operator',
                                label: 'Operador',
                                status: 'ready',
                                updatedAt: new Date().toISOString(),
                                ageSec: 4,
                                stale: false,
                                summary: 'Equipo listo para operar en C1 fijo.',
                                latest: {
                                    deviceLabel: 'Operador C1 fijo',
                                    appMode: 'desktop',
                                    ageSec: 4,
                                    details: {
                                        station: 'c1',
                                        stationMode: 'locked',
                                        oneTap: false,
                                        numpadSeen: true,
                                    },
                                },
                                instances: [],
                            },
                            kiosk: {
                                surface: 'kiosk',
                                label: 'Kiosco',
                                status: 'unknown',
                                updatedAt: '',
                                ageSec: 0,
                                stale: true,
                                summary: 'Sin heartbeat',
                                latest: null,
                                instances: [],
                            },
                            display: {
                                surface: 'display',
                                label: 'Sala TV',
                                status: 'unknown',
                                updatedAt: '',
                                ageSec: 0,
                                stale: true,
                                summary: 'Sin heartbeat',
                                latest: null,
                                instances: [],
                            },
                        },
                    },
                });
            }

            return json(route, { ok: true, data: {} });
        });

        await page.goto('/admin.html#queue');
        await page.locator('a[href="#queue"]').last().click();

        await expect(page.locator('#queueWindowDeck')).toBeVisible();
        await expect(page.locator('#queueWindowDeckTitle')).toContainText(
            'Ventana estimada'
        );
        await expect(page.locator('#queueWindowDeckSummary')).toContainText(
            'cita -> C1 (~1m), sin cita -> C2 (~22m)'
        );
        await expect(page.locator('#queueWindowHeadline_c1')).toContainText(
            'C1 abre ventana en ~1m'
        );
        await expect(page.locator('#queueWindowBadge_c1')).toContainText('~1m');
        await expect(page.locator('#queueWindowRules_c1')).toContainText(
            'Cita: ~1m · preferido'
        );
        await expect(page.locator('#queueWindowHeadline_c2')).toContainText(
            'C2 abre ventana en ~22m'
        );
        await expect(page.locator('#queueWindowBadge_c2')).toContainText(
            '~22m'
        );
        await expect(page.locator('#queueWindowRules_c2')).toContainText(
            'Sin cita: ~22m · preferido'
        );
        await expect(page.locator('#queueWindowOpen_c1')).toHaveAttribute(
            'href',
            /operador-turnos\.html\?station=c1&lock=1/
        );
    });

    test('respuesta de mostrador entrega frases listas para cita sin cita y llegada doble', async ({
        page,
    }) => {
        const queueTickets = [
            {
                id: 1411,
                ticketCode: 'A-1411',
                queueType: 'appointment',
                patientInitials: 'JA',
                priorityClass: 'appt_overdue',
                status: 'called',
                assignedConsultorio: 1,
                createdAt: new Date(Date.now() - 25 * 60 * 1000).toISOString(),
                calledAt: new Date(Date.now() - 7 * 60 * 1000).toISOString(),
            },
            {
                id: 1412,
                ticketCode: 'A-1412',
                queueType: 'walk_in',
                patientInitials: 'KB',
                priorityClass: 'walk_in',
                status: 'called',
                assignedConsultorio: 2,
                createdAt: new Date(Date.now() - 14 * 60 * 1000).toISOString(),
                calledAt: new Date(Date.now() - 2 * 60 * 1000).toISOString(),
            },
            {
                id: 1413,
                ticketCode: 'A-1413',
                queueType: 'walk_in',
                patientInitials: 'LC',
                priorityClass: 'walk_in',
                status: 'waiting',
                assignedConsultorio: 2,
                createdAt: new Date(Date.now() - 8 * 60 * 1000).toISOString(),
            },
            {
                id: 1414,
                ticketCode: 'A-1414',
                queueType: 'walk_in',
                patientInitials: 'MD',
                priorityClass: 'walk_in',
                status: 'waiting',
                assignedConsultorio: 2,
                createdAt: new Date(Date.now() - 3 * 60 * 1000).toISOString(),
            },
        ];
        const queueState = buildQueueStateFromTickets(queueTickets);

        await page.addInitScript(() => {
            window.localStorage.setItem('queueOpsFocusModeV1', 'operations');
        });

        await installLegacyAdminAuthMock(page, {
            csrfToken: 'csrf_queue_desk_reply',
        });

        await page.route(/\/api\.php(\?.*)?$/i, async (route) => {
            const request = route.request();
            const url = new URL(request.url());
            const resource = url.searchParams.get('resource') || '';
            if (resource === 'features') {
                return json(route, {
                    ok: true,
                    data: { admin_sony_ui: ADMIN_UI_VARIANT === 'sony_v2' },
                });
            }

            if (resource === 'data') {
                return json(route, {
                    ok: true,
                    data: {
                        appointments: [],
                        callbacks: [],
                        reviews: [],
                        availability: {},
                        availabilityMeta: {
                            source: 'store',
                            mode: 'live',
                            timezone: 'America/Guayaquil',
                            calendarConfigured: true,
                            calendarReachable: true,
                            generatedAt: new Date().toISOString(),
                        },
                        queue_tickets: queueTickets,
                        queueMeta: buildQueueMetaFromState(queueState),
                        queueSurfaceStatus: {
                            operator: {
                                surface: 'operator',
                                label: 'Operador',
                                status: 'ready',
                                updatedAt: new Date().toISOString(),
                                ageSec: 4,
                                stale: false,
                                summary: 'Equipo listo para operar en C1 fijo.',
                                latest: {
                                    deviceLabel: 'Operador C1 fijo',
                                    appMode: 'desktop',
                                    ageSec: 4,
                                    details: {
                                        station: 'c1',
                                        stationMode: 'locked',
                                        oneTap: false,
                                        numpadSeen: true,
                                    },
                                },
                                instances: [],
                            },
                            kiosk: {
                                surface: 'kiosk',
                                label: 'Kiosco',
                                status: 'unknown',
                                updatedAt: '',
                                ageSec: 0,
                                stale: true,
                                summary: 'Sin heartbeat',
                                latest: null,
                                instances: [],
                            },
                            display: {
                                surface: 'display',
                                label: 'Sala TV',
                                status: 'unknown',
                                updatedAt: '',
                                ageSec: 0,
                                stale: true,
                                summary: 'Sin heartbeat',
                                latest: null,
                                instances: [],
                            },
                        },
                    },
                });
            }

            return json(route, { ok: true, data: {} });
        });

        await page.goto('/admin.html#queue');
        await page.locator('a[href="#queue"]').last().click();

        await expect(page.locator('#queueDeskReply')).toBeVisible();
        await expect(page.locator('#queueDeskReplyTitle')).toContainText(
            'Respuesta de mostrador'
        );
        await expect(
            page.locator('#queueDeskReplyPhrase_appointment')
        ).toContainText('Le paso por C1; la ventana visible está en ~1m.');
        await expect(
            page.locator('#queueDeskReplyPhrase_walkin')
        ).toContainText(
            'Le ubico por C2; la siguiente ventana visible está en ~22m.'
        );
        await expect(
            page.locator('#queueDeskReplyPhrase_collision')
        ).toContainText(
            'Si llegan dos juntas: con cita por C1 y sin cita por C2.'
        );
        await expect(
            page.locator('#queueDeskReplyOpen_walkin')
        ).toHaveAttribute('href', /operador-turnos\.html\?station=c2&lock=1/);
    });

    test('plan b de recepcion deja una alternativa visible para cita y sin cita', async ({
        page,
    }) => {
        const queueTickets = [
            {
                id: 1511,
                ticketCode: 'A-1511',
                queueType: 'appointment',
                patientInitials: 'JA',
                priorityClass: 'appt_overdue',
                status: 'called',
                assignedConsultorio: 1,
                createdAt: new Date(Date.now() - 25 * 60 * 1000).toISOString(),
                calledAt: new Date(Date.now() - 7 * 60 * 1000).toISOString(),
            },
            {
                id: 1512,
                ticketCode: 'A-1512',
                queueType: 'walk_in',
                patientInitials: 'KB',
                priorityClass: 'walk_in',
                status: 'called',
                assignedConsultorio: 2,
                createdAt: new Date(Date.now() - 14 * 60 * 1000).toISOString(),
                calledAt: new Date(Date.now() - 2 * 60 * 1000).toISOString(),
            },
            {
                id: 1513,
                ticketCode: 'A-1513',
                queueType: 'walk_in',
                patientInitials: 'LC',
                priorityClass: 'walk_in',
                status: 'waiting',
                assignedConsultorio: 2,
                createdAt: new Date(Date.now() - 8 * 60 * 1000).toISOString(),
            },
            {
                id: 1514,
                ticketCode: 'A-1514',
                queueType: 'walk_in',
                patientInitials: 'MD',
                priorityClass: 'walk_in',
                status: 'waiting',
                assignedConsultorio: 2,
                createdAt: new Date(Date.now() - 3 * 60 * 1000).toISOString(),
            },
        ];
        const queueState = buildQueueStateFromTickets(queueTickets);

        await page.addInitScript(() => {
            window.localStorage.setItem('queueOpsFocusModeV1', 'operations');
        });

        await installLegacyAdminAuthMock(page, {
            csrfToken: 'csrf_queue_desk_fallback',
        });

        await page.route(/\/api\.php(\?.*)?$/i, async (route) => {
            const request = route.request();
            const url = new URL(request.url());
            const resource = url.searchParams.get('resource') || '';
            if (resource === 'features') {
                return json(route, {
                    ok: true,
                    data: { admin_sony_ui: ADMIN_UI_VARIANT === 'sony_v2' },
                });
            }

            if (resource === 'data') {
                return json(route, {
                    ok: true,
                    data: {
                        appointments: [],
                        callbacks: [],
                        reviews: [],
                        availability: {},
                        availabilityMeta: {
                            source: 'store',
                            mode: 'live',
                            timezone: 'America/Guayaquil',
                            calendarConfigured: true,
                            calendarReachable: true,
                            generatedAt: new Date().toISOString(),
                        },
                        queue_tickets: queueTickets,
                        queueMeta: buildQueueMetaFromState(queueState),
                        queueSurfaceStatus: {
                            operator: {
                                surface: 'operator',
                                label: 'Operador',
                                status: 'ready',
                                updatedAt: new Date().toISOString(),
                                ageSec: 4,
                                stale: false,
                                summary: 'Equipo listo para operar en C1 fijo.',
                                latest: {
                                    deviceLabel: 'Operador C1 fijo',
                                    appMode: 'desktop',
                                    ageSec: 4,
                                    details: {
                                        station: 'c1',
                                        stationMode: 'locked',
                                        oneTap: false,
                                        numpadSeen: true,
                                    },
                                },
                                instances: [],
                            },
                            kiosk: {
                                surface: 'kiosk',
                                label: 'Kiosco',
                                status: 'unknown',
                                updatedAt: '',
                                ageSec: 0,
                                stale: true,
                                summary: 'Sin heartbeat',
                                latest: null,
                                instances: [],
                            },
                            display: {
                                surface: 'display',
                                label: 'Sala TV',
                                status: 'unknown',
                                updatedAt: '',
                                ageSec: 0,
                                stale: true,
                                summary: 'Sin heartbeat',
                                latest: null,
                                instances: [],
                            },
                        },
                    },
                });
            }

            return json(route, { ok: true, data: {} });
        });

        await page.goto('/admin.html#queue');
        await page.locator('a[href="#queue"]').last().click();

        await expect(page.locator('#queueDeskFallback')).toBeVisible();
        await expect(page.locator('#queueDeskFallbackTitle')).toContainText(
            'Plan B de recepción'
        );
        await expect(
            page.locator('#queueDeskFallbackPhrase_appointment')
        ).toContainText(
            'Primero le ofrecería C1 (~1m). Si no le sirve, la alternativa visible es C2 (~22m).'
        );
        await expect(
            page.locator('#queueDeskFallbackPhrase_walkin')
        ).toContainText(
            'Primero le ofrecería C2 (~22m). Si no le sirve, la alternativa visible es C1 (~1m).'
        );
        await expect(
            page.locator('#queueDeskFallbackOpen_appointment')
        ).toHaveAttribute('href', /operador-turnos\.html\?station=c1&lock=1/);
    });

    test('objeciones rápidas responde a lo más rápido espera corta y la otra opción', async ({
        page,
    }) => {
        const queueTickets = [
            {
                id: 1611,
                ticketCode: 'A-1611',
                queueType: 'appointment',
                patientInitials: 'JA',
                priorityClass: 'appt_overdue',
                status: 'called',
                assignedConsultorio: 1,
                createdAt: new Date(Date.now() - 25 * 60 * 1000).toISOString(),
                calledAt: new Date(Date.now() - 7 * 60 * 1000).toISOString(),
            },
            {
                id: 1612,
                ticketCode: 'A-1612',
                queueType: 'walk_in',
                patientInitials: 'KB',
                priorityClass: 'walk_in',
                status: 'called',
                assignedConsultorio: 2,
                createdAt: new Date(Date.now() - 14 * 60 * 1000).toISOString(),
                calledAt: new Date(Date.now() - 2 * 60 * 1000).toISOString(),
            },
            {
                id: 1613,
                ticketCode: 'A-1613',
                queueType: 'walk_in',
                patientInitials: 'LC',
                priorityClass: 'walk_in',
                status: 'waiting',
                assignedConsultorio: 2,
                createdAt: new Date(Date.now() - 8 * 60 * 1000).toISOString(),
            },
            {
                id: 1614,
                ticketCode: 'A-1614',
                queueType: 'walk_in',
                patientInitials: 'MD',
                priorityClass: 'walk_in',
                status: 'waiting',
                assignedConsultorio: 2,
                createdAt: new Date(Date.now() - 3 * 60 * 1000).toISOString(),
            },
        ];
        const queueState = buildQueueStateFromTickets(queueTickets);

        await page.addInitScript(() => {
            window.localStorage.setItem('queueOpsFocusModeV1', 'operations');
        });

        await installLegacyAdminAuthMock(page, {
            csrfToken: 'csrf_queue_desk_objections',
        });

        await page.route(/\/api\.php(\?.*)?$/i, async (route) => {
            const request = route.request();
            const url = new URL(request.url());
            const resource = url.searchParams.get('resource') || '';
            if (resource === 'features') {
                return json(route, {
                    ok: true,
                    data: { admin_sony_ui: ADMIN_UI_VARIANT === 'sony_v2' },
                });
            }

            if (resource === 'data') {
                return json(route, {
                    ok: true,
                    data: {
                        appointments: [],
                        callbacks: [],
                        reviews: [],
                        availability: {},
                        availabilityMeta: {
                            source: 'store',
                            mode: 'live',
                            timezone: 'America/Guayaquil',
                            calendarConfigured: true,
                            calendarReachable: true,
                            generatedAt: new Date().toISOString(),
                        },
                        queue_tickets: queueTickets,
                        queueMeta: buildQueueMetaFromState(queueState),
                        queueSurfaceStatus: {
                            operator: {
                                surface: 'operator',
                                label: 'Operador',
                                status: 'ready',
                                updatedAt: new Date().toISOString(),
                                ageSec: 4,
                                stale: false,
                                summary: 'Equipo listo para operar en C1 fijo.',
                                latest: {
                                    deviceLabel: 'Operador C1 fijo',
                                    appMode: 'desktop',
                                    ageSec: 4,
                                    details: {
                                        station: 'c1',
                                        stationMode: 'locked',
                                        oneTap: false,
                                        numpadSeen: true,
                                    },
                                },
                                instances: [],
                            },
                            kiosk: {
                                surface: 'kiosk',
                                label: 'Kiosco',
                                status: 'unknown',
                                updatedAt: '',
                                ageSec: 0,
                                stale: true,
                                summary: 'Sin heartbeat',
                                latest: null,
                                instances: [],
                            },
                            display: {
                                surface: 'display',
                                label: 'Sala TV',
                                status: 'unknown',
                                updatedAt: '',
                                ageSec: 0,
                                stale: true,
                                summary: 'Sin heartbeat',
                                latest: null,
                                instances: [],
                            },
                        },
                    },
                });
            }

            return json(route, { ok: true, data: {} });
        });

        await page.goto('/admin.html#queue');
        await page.locator('a[href="#queue"]').last().click();

        await expect(page.locator('#queueDeskObjections')).toBeVisible();
        await expect(page.locator('#queueDeskObjectionsTitle')).toContainText(
            'Objeciones rápidas'
        );
        await expect(
            page.locator('#queueDeskObjectionsPhrase_first_available')
        ).toContainText('Lo más rápido visible ahora es C1 (~1m).');
        await expect(
            page.locator('#queueDeskObjectionsPhrase_short_wait')
        ).toContainText('Sí le puedo ofrecer una espera corta por C1 (~1m).');
        await expect(
            page.locator('#queueDeskObjectionsPhrase_other_lane')
        ).toContainText(
            'Si quiere la otra opción, hoy el carril alterno visible es C2 (~22m).'
        );
        await expect(
            page.locator('#queueDeskObjectionsOpen_other_lane')
        ).toHaveAttribute('href', /operador-turnos\.html\?station=c2&lock=1/);
    });

    test('cierre de mostrador deja la frase final y la regla de revalidación', async ({
        page,
    }) => {
        const queueTickets = [
            {
                id: 1711,
                ticketCode: 'A-1711',
                queueType: 'appointment',
                patientInitials: 'JA',
                priorityClass: 'appt_overdue',
                status: 'called',
                assignedConsultorio: 1,
                createdAt: new Date(Date.now() - 25 * 60 * 1000).toISOString(),
                calledAt: new Date(Date.now() - 7 * 60 * 1000).toISOString(),
            },
            {
                id: 1712,
                ticketCode: 'A-1712',
                queueType: 'walk_in',
                patientInitials: 'KB',
                priorityClass: 'walk_in',
                status: 'called',
                assignedConsultorio: 2,
                createdAt: new Date(Date.now() - 14 * 60 * 1000).toISOString(),
                calledAt: new Date(Date.now() - 2 * 60 * 1000).toISOString(),
            },
            {
                id: 1713,
                ticketCode: 'A-1713',
                queueType: 'walk_in',
                patientInitials: 'LC',
                priorityClass: 'walk_in',
                status: 'waiting',
                assignedConsultorio: 2,
                createdAt: new Date(Date.now() - 8 * 60 * 1000).toISOString(),
            },
            {
                id: 1714,
                ticketCode: 'A-1714',
                queueType: 'walk_in',
                patientInitials: 'MD',
                priorityClass: 'walk_in',
                status: 'waiting',
                assignedConsultorio: 2,
                createdAt: new Date(Date.now() - 3 * 60 * 1000).toISOString(),
            },
        ];
        const queueState = buildQueueStateFromTickets(queueTickets);

        await page.addInitScript(() => {
            window.localStorage.setItem('queueOpsFocusModeV1', 'operations');
        });

        await installLegacyAdminAuthMock(page, {
            csrfToken: 'csrf_queue_desk_closeout',
        });

        await page.route(/\/api\.php(\?.*)?$/i, async (route) => {
            const request = route.request();
            const url = new URL(request.url());
            const resource = url.searchParams.get('resource') || '';
            if (resource === 'features') {
                return json(route, {
                    ok: true,
                    data: { admin_sony_ui: ADMIN_UI_VARIANT === 'sony_v2' },
                });
            }

            if (resource === 'data') {
                return json(route, {
                    ok: true,
                    data: {
                        appointments: [],
                        callbacks: [],
                        reviews: [],
                        availability: {},
                        availabilityMeta: {
                            source: 'store',
                            mode: 'live',
                            timezone: 'America/Guayaquil',
                            calendarConfigured: true,
                            calendarReachable: true,
                            generatedAt: new Date().toISOString(),
                        },
                        queue_tickets: queueTickets,
                        queueMeta: buildQueueMetaFromState(queueState),
                        queueSurfaceStatus: {
                            operator: {
                                surface: 'operator',
                                label: 'Operador',
                                status: 'ready',
                                updatedAt: new Date().toISOString(),
                                ageSec: 4,
                                stale: false,
                                summary: 'Equipo listo para operar en C1 fijo.',
                                latest: {
                                    deviceLabel: 'Operador C1 fijo',
                                    appMode: 'desktop',
                                    ageSec: 4,
                                    details: {
                                        station: 'c1',
                                        stationMode: 'locked',
                                        oneTap: false,
                                        numpadSeen: true,
                                    },
                                },
                                instances: [],
                            },
                            kiosk: {
                                surface: 'kiosk',
                                label: 'Kiosco',
                                status: 'unknown',
                                updatedAt: '',
                                ageSec: 0,
                                stale: true,
                                summary: 'Sin heartbeat',
                                latest: null,
                                instances: [],
                            },
                            display: {
                                surface: 'display',
                                label: 'Sala TV',
                                status: 'unknown',
                                updatedAt: '',
                                ageSec: 0,
                                stale: true,
                                summary: 'Sin heartbeat',
                                latest: null,
                                instances: [],
                            },
                        },
                    },
                });
            }

            return json(route, { ok: true, data: {} });
        });

        await page.goto('/admin.html#queue');
        await page.locator('a[href="#queue"]').last().click();

        await expect(page.locator('#queueDeskCloseout')).toBeVisible();
        await expect(page.locator('#queueDeskCloseoutTitle')).toContainText(
            'Cierre de mostrador'
        );
        await expect(
            page.locator('#queueDeskCloseoutPhrase_appointment')
        ).toContainText(
            'Le dejo por C1; conserve su ticket y esté atento a la TV o campanilla. Si pasa más de ~1m sin llamado, me avisa.'
        );
        await expect(
            page.locator('#queueDeskCloseoutPhrase_walkin')
        ).toContainText(
            'Le dejo por C2; conserve su ticket y esté atento a la TV o campanilla. Si pasa más de ~22m sin llamado, me avisa.'
        );
        await expect(
            page.locator('#queueDeskCloseoutPhrase_if_not_called')
        ).toContainText(
            'Si no lo llaman dentro de ~1m, vuelva a mostrador y revalidamos el carril sin perder el turno.'
        );
        await expect(
            page.locator('#queueDeskCloseoutOpen_if_not_called')
        ).toHaveAttribute('href', /operador-turnos\.html\?station=c1&lock=1/);
    });

    test('revalidación de espera guía qué hacer si el paciente vuelve a preguntar', async ({
        page,
    }) => {
        const queueTickets = [
            {
                id: 1811,
                ticketCode: 'A-1811',
                queueType: 'appointment',
                patientInitials: 'JA',
                priorityClass: 'appt_overdue',
                status: 'called',
                assignedConsultorio: 1,
                createdAt: new Date(Date.now() - 25 * 60 * 1000).toISOString(),
                calledAt: new Date(Date.now() - 7 * 60 * 1000).toISOString(),
            },
            {
                id: 1812,
                ticketCode: 'A-1812',
                queueType: 'walk_in',
                patientInitials: 'KB',
                priorityClass: 'walk_in',
                status: 'called',
                assignedConsultorio: 2,
                createdAt: new Date(Date.now() - 14 * 60 * 1000).toISOString(),
                calledAt: new Date(Date.now() - 2 * 60 * 1000).toISOString(),
            },
            {
                id: 1813,
                ticketCode: 'A-1813',
                queueType: 'walk_in',
                patientInitials: 'LC',
                priorityClass: 'walk_in',
                status: 'waiting',
                assignedConsultorio: 2,
                createdAt: new Date(Date.now() - 8 * 60 * 1000).toISOString(),
            },
            {
                id: 1814,
                ticketCode: 'A-1814',
                queueType: 'walk_in',
                patientInitials: 'MD',
                priorityClass: 'walk_in',
                status: 'waiting',
                assignedConsultorio: 2,
                createdAt: new Date(Date.now() - 3 * 60 * 1000).toISOString(),
            },
        ];
        const queueState = buildQueueStateFromTickets(queueTickets);

        await page.addInitScript(() => {
            window.localStorage.setItem('queueOpsFocusModeV1', 'operations');
        });

        await installQueueAdminAuthMock(page, 'csrf_queue_desk_recheck');

        await page.route(/\/api\.php(\?.*)?$/i, async (route) => {
            const request = route.request();
            const url = new URL(request.url());
            const resource = url.searchParams.get('resource') || '';
            if (resource === 'features') {
                return json(route, {
                    ok: true,
                    data: { admin_sony_ui: ADMIN_UI_VARIANT === 'sony_v2' },
                });
            }

            if (resource === 'data') {
                return json(route, {
                    ok: true,
                    data: {
                        appointments: [],
                        callbacks: [],
                        reviews: [],
                        availability: {},
                        availabilityMeta: {
                            source: 'store',
                            mode: 'live',
                            timezone: 'America/Guayaquil',
                            calendarConfigured: true,
                            calendarReachable: true,
                            generatedAt: new Date().toISOString(),
                        },
                        queue_tickets: queueTickets,
                        queueMeta: buildQueueMetaFromState(queueState),
                        queueSurfaceStatus: {
                            operator: {
                                surface: 'operator',
                                label: 'Operador',
                                status: 'ready',
                                updatedAt: new Date().toISOString(),
                                ageSec: 4,
                                stale: false,
                                summary: 'Equipo listo para operar en C1 fijo.',
                                latest: {
                                    deviceLabel: 'Operador C1 fijo',
                                    appMode: 'desktop',
                                    ageSec: 4,
                                    details: {
                                        station: 'c1',
                                        stationMode: 'locked',
                                        oneTap: false,
                                        numpadSeen: true,
                                    },
                                },
                                instances: [],
                            },
                            kiosk: {
                                surface: 'kiosk',
                                label: 'Kiosco',
                                status: 'unknown',
                                updatedAt: '',
                                ageSec: 0,
                                stale: true,
                                summary: 'Sin heartbeat',
                                latest: null,
                                instances: [],
                            },
                            display: {
                                surface: 'display',
                                label: 'Sala TV',
                                status: 'unknown',
                                updatedAt: '',
                                ageSec: 0,
                                stale: true,
                                summary: 'Sin heartbeat',
                                latest: null,
                                instances: [],
                            },
                        },
                    },
                });
            }

            return json(route, { ok: true, data: {} });
        });

        await page.goto('/admin.html#queue');
        await page.locator('a[href="#queue"]').last().click();

        await expect(page.locator('#queueDeskRecheck')).toBeVisible();
        await expect(page.locator('#queueDeskRecheckTitle')).toContainText(
            'Revalidación de espera'
        );
        await expect(
            page.locator('#queueDeskRecheckPhrase_appointment')
        ).toContainText(
            'Si vuelve antes de ~1m, sigue por C1. Si ya pasó esa ventana, revalídelo aquí y confirme si mantiene C1.'
        );
        await expect(
            page.locator('#queueDeskRecheckPhrase_walkin')
        ).toContainText(
            'Si vuelve y ya pasó ~22m, revalídelo aquí: hoy conviene moverlo a C1 (~1m) sin perder el turno.'
        );
        await expect(
            page.locator('#queueDeskRecheckPhrase_timing')
        ).toContainText(
            'Si vuelve antes de ~1m, mantenga el carril actual y pídale seguir atento. Si ya pasó, revalide aquí y compare C1 (~1m) contra C2 (~22m) antes de moverlo.'
        );
        await expect(
            page.locator('#queueDeskRecheckOpen_walkin')
        ).toHaveAttribute('href', /operador-turnos\.html\?station=c1&lock=1/);
    });

    test('cambio de carril sugerido explica cuándo mover o sostener el carril', async ({
        page,
    }) => {
        const queueTickets = [
            {
                id: 1911,
                ticketCode: 'A-1911',
                queueType: 'appointment',
                patientInitials: 'JA',
                priorityClass: 'appt_overdue',
                status: 'called',
                assignedConsultorio: 1,
                createdAt: new Date(Date.now() - 25 * 60 * 1000).toISOString(),
                calledAt: new Date(Date.now() - 7 * 60 * 1000).toISOString(),
            },
            {
                id: 1912,
                ticketCode: 'A-1912',
                queueType: 'walk_in',
                patientInitials: 'KB',
                priorityClass: 'walk_in',
                status: 'called',
                assignedConsultorio: 2,
                createdAt: new Date(Date.now() - 14 * 60 * 1000).toISOString(),
                calledAt: new Date(Date.now() - 2 * 60 * 1000).toISOString(),
            },
            {
                id: 1913,
                ticketCode: 'A-1913',
                queueType: 'walk_in',
                patientInitials: 'LC',
                priorityClass: 'walk_in',
                status: 'waiting',
                assignedConsultorio: 2,
                createdAt: new Date(Date.now() - 8 * 60 * 1000).toISOString(),
            },
            {
                id: 1914,
                ticketCode: 'A-1914',
                queueType: 'walk_in',
                patientInitials: 'MD',
                priorityClass: 'walk_in',
                status: 'waiting',
                assignedConsultorio: 2,
                createdAt: new Date(Date.now() - 3 * 60 * 1000).toISOString(),
            },
        ];
        const queueState = buildQueueStateFromTickets(queueTickets);

        await page.addInitScript(() => {
            window.localStorage.setItem('queueOpsFocusModeV1', 'operations');
        });

        await installQueueAdminAuthMock(page, 'csrf_queue_desk_shift');

        await page.route(/\/api\.php(\?.*)?$/i, async (route) => {
            const request = route.request();
            const url = new URL(request.url());
            const resource = url.searchParams.get('resource') || '';
            if (resource === 'features') {
                return json(route, {
                    ok: true,
                    data: { admin_sony_ui: ADMIN_UI_VARIANT === 'sony_v2' },
                });
            }

            if (resource === 'data') {
                return json(route, {
                    ok: true,
                    data: {
                        appointments: [],
                        callbacks: [],
                        reviews: [],
                        availability: {},
                        availabilityMeta: {
                            source: 'store',
                            mode: 'live',
                            timezone: 'America/Guayaquil',
                            calendarConfigured: true,
                            calendarReachable: true,
                            generatedAt: new Date().toISOString(),
                        },
                        queue_tickets: queueTickets,
                        queueMeta: buildQueueMetaFromState(queueState),
                        queueSurfaceStatus: {
                            operator: {
                                surface: 'operator',
                                label: 'Operador',
                                status: 'ready',
                                updatedAt: new Date().toISOString(),
                                ageSec: 4,
                                stale: false,
                                summary: 'Equipo listo para operar en C1 fijo.',
                                latest: {
                                    deviceLabel: 'Operador C1 fijo',
                                    appMode: 'desktop',
                                    ageSec: 4,
                                    details: {
                                        station: 'c1',
                                        stationMode: 'locked',
                                        oneTap: false,
                                        numpadSeen: true,
                                    },
                                },
                                instances: [],
                            },
                            kiosk: {
                                surface: 'kiosk',
                                label: 'Kiosco',
                                status: 'unknown',
                                updatedAt: '',
                                ageSec: 0,
                                stale: true,
                                summary: 'Sin heartbeat',
                                latest: null,
                                instances: [],
                            },
                            display: {
                                surface: 'display',
                                label: 'Sala TV',
                                status: 'unknown',
                                updatedAt: '',
                                ageSec: 0,
                                stale: true,
                                summary: 'Sin heartbeat',
                                latest: null,
                                instances: [],
                            },
                        },
                    },
                });
            }

            return json(route, { ok: true, data: {} });
        });

        await page.goto('/admin.html#queue');
        await page.locator('a[href="#queue"]').last().click();

        await expect(page.locator('#queueDeskShift')).toBeVisible();
        await expect(page.locator('#queueDeskShiftTitle')).toContainText(
            'Cambio de carril sugerido'
        );
        await expect(
            page.locator('#queueDeskShiftPhrase_appointment')
        ).toContainText(
            'No conviene moverlo de C1 a C2 ahora: el carril actual sigue mejor (~1m vs ~22m).'
        );
        await expect(
            page.locator('#queueDeskShiftPhrase_walkin')
        ).toContainText(
            'Si acepta moverse de C2 a C1, hoy baja la espera visible de ~22m a ~1m.'
        );
        await expect(page.locator('#queueDeskShiftPhrase_rule')).toContainText(
            'Solo cambie de carril si gana al menos ~8m o si ya venció la ventana prometida; hoy C1 le saca ~21m a C2.'
        );
        await expect(
            page.locator('#queueDeskShiftOpen_walkin')
        ).toHaveAttribute('href', /operador-turnos\.html\?station=c1&lock=1/);
    });

    test('promesa segura resume lo que recepción sí puede comprometer', async ({
        page,
    }) => {
        const queueTickets = [
            {
                id: 2011,
                ticketCode: 'A-2011',
                queueType: 'appointment',
                patientInitials: 'JA',
                priorityClass: 'appt_overdue',
                status: 'called',
                assignedConsultorio: 1,
                createdAt: new Date(Date.now() - 25 * 60 * 1000).toISOString(),
                calledAt: new Date(Date.now() - 7 * 60 * 1000).toISOString(),
            },
            {
                id: 2012,
                ticketCode: 'A-2012',
                queueType: 'walk_in',
                patientInitials: 'KB',
                priorityClass: 'walk_in',
                status: 'called',
                assignedConsultorio: 2,
                createdAt: new Date(Date.now() - 14 * 60 * 1000).toISOString(),
                calledAt: new Date(Date.now() - 2 * 60 * 1000).toISOString(),
            },
            {
                id: 2013,
                ticketCode: 'A-2013',
                queueType: 'walk_in',
                patientInitials: 'LC',
                priorityClass: 'walk_in',
                status: 'waiting',
                assignedConsultorio: 2,
                createdAt: new Date(Date.now() - 8 * 60 * 1000).toISOString(),
            },
            {
                id: 2014,
                ticketCode: 'A-2014',
                queueType: 'walk_in',
                patientInitials: 'MD',
                priorityClass: 'walk_in',
                status: 'waiting',
                assignedConsultorio: 2,
                createdAt: new Date(Date.now() - 3 * 60 * 1000).toISOString(),
            },
        ];
        const queueState = buildQueueStateFromTickets(queueTickets);

        await page.addInitScript(() => {
            window.localStorage.setItem('queueOpsFocusModeV1', 'operations');
        });

        await installQueueAdminAuthMock(page, 'csrf_queue_desk_promise');

        await page.route(/\/api\.php(\?.*)?$/i, async (route) => {
            const request = route.request();
            const url = new URL(request.url());
            const resource = url.searchParams.get('resource') || '';
            if (resource === 'features') {
                return json(route, {
                    ok: true,
                    data: { admin_sony_ui: ADMIN_UI_VARIANT === 'sony_v2' },
                });
            }

            if (resource === 'data') {
                return json(route, {
                    ok: true,
                    data: {
                        appointments: [],
                        callbacks: [],
                        reviews: [],
                        availability: {},
                        availabilityMeta: {
                            source: 'store',
                            mode: 'live',
                            timezone: 'America/Guayaquil',
                            calendarConfigured: true,
                            calendarReachable: true,
                            generatedAt: new Date().toISOString(),
                        },
                        queue_tickets: queueTickets,
                        queueMeta: buildQueueMetaFromState(queueState),
                        queueSurfaceStatus: {
                            operator: {
                                surface: 'operator',
                                label: 'Operador',
                                status: 'ready',
                                updatedAt: new Date().toISOString(),
                                ageSec: 4,
                                stale: false,
                                summary: 'Equipo listo para operar en C1 fijo.',
                                latest: {
                                    deviceLabel: 'Operador C1 fijo',
                                    appMode: 'desktop',
                                    ageSec: 4,
                                    details: {
                                        station: 'c1',
                                        stationMode: 'locked',
                                        oneTap: false,
                                        numpadSeen: true,
                                    },
                                },
                                instances: [],
                            },
                            kiosk: {
                                surface: 'kiosk',
                                label: 'Kiosco',
                                status: 'unknown',
                                updatedAt: '',
                                ageSec: 0,
                                stale: true,
                                summary: 'Sin heartbeat',
                                latest: null,
                                instances: [],
                            },
                            display: {
                                surface: 'display',
                                label: 'Sala TV',
                                status: 'unknown',
                                updatedAt: '',
                                ageSec: 0,
                                stale: true,
                                summary: 'Sin heartbeat',
                                latest: null,
                                instances: [],
                            },
                        },
                    },
                });
            }

            return json(route, { ok: true, data: {} });
        });

        await page.goto('/admin.html#queue');
        await page.locator('a[href="#queue"]').last().click();

        await expect(page.locator('#queueDeskPromise')).toBeVisible();
        await expect(page.locator('#queueDeskPromiseTitle')).toContainText(
            'Promesa segura'
        );
        await expect(
            page.locator('#queueDeskPromisePhrase_appointment')
        ).toContainText(
            'Lo seguro es prometer C1 con una ventana visible de ~1m y pedirle que siga atento a la TV o campanilla.'
        );
        await expect(
            page.locator('#queueDeskPromisePhrase_walkin')
        ).toContainText(
            'Lo seguro es confirmar primero si acepta moverse de C2 a C1; si sí, promete ~1m. Si no, mantén C2 sin prometer un recorte extra.'
        );
        await expect(
            page.locator('#queueDeskPromisePhrase_rule')
        ).toContainText(
            'Promete solo la ventana visible y el paso siguiente; hoy la promesa más segura es C1 (~1m) y revalidar si pasa esa ventana o si el otro carril gana al menos ~8m.'
        );
        await expect(
            page.locator('#queueDeskPromiseOpen_walkin')
        ).toHaveAttribute('href', /operador-turnos\.html\?station=c1&lock=1/);
    });

    test('escalación sugerida marca cuándo recepción debe abrir operador y cuándo sostener', async ({
        page,
    }) => {
        const queueTickets = [
            {
                id: 3012,
                ticketCode: 'A-3012',
                queueType: 'walk_in',
                patientInitials: 'KB',
                priorityClass: 'walk_in',
                status: 'waiting',
                assignedConsultorio: 2,
                createdAt: new Date(Date.now() - 4 * 60 * 1000).toISOString(),
            },
            {
                id: 3013,
                ticketCode: 'A-3013',
                queueType: 'walk_in',
                patientInitials: 'LC',
                priorityClass: 'walk_in',
                status: 'waiting',
                assignedConsultorio: 2,
                createdAt: new Date(Date.now() - 3 * 60 * 1000).toISOString(),
            },
        ];
        const queueState = buildQueueStateFromTickets(queueTickets);

        await page.addInitScript(() => {
            window.localStorage.setItem('queueOpsFocusModeV1', 'operations');
        });

        await installQueueAdminAuthMock(page, 'csrf_queue_desk_escalation');

        await page.route(/\/api\.php(\?.*)?$/i, async (route) => {
            const request = route.request();
            const url = new URL(request.url());
            const resource = url.searchParams.get('resource') || '';
            if (resource === 'features') {
                return json(route, {
                    ok: true,
                    data: { admin_sony_ui: ADMIN_UI_VARIANT === 'sony_v2' },
                });
            }

            if (resource === 'data') {
                return json(route, {
                    ok: true,
                    data: {
                        appointments: [],
                        callbacks: [],
                        reviews: [],
                        availability: {},
                        availabilityMeta: {
                            source: 'store',
                            mode: 'live',
                            timezone: 'America/Guayaquil',
                            calendarConfigured: true,
                            calendarReachable: true,
                            generatedAt: new Date().toISOString(),
                        },
                        queue_tickets: queueTickets,
                        queueMeta: buildQueueMetaFromState(queueState),
                        queueSurfaceStatus: {
                            operator: {
                                surface: 'operator',
                                label: 'Operador',
                                status: 'ready',
                                updatedAt: new Date().toISOString(),
                                ageSec: 4,
                                stale: false,
                                summary: 'Equipo listo para operar en C1 fijo.',
                                latest: {
                                    deviceLabel: 'Operador C1 fijo',
                                    appMode: 'desktop',
                                    ageSec: 4,
                                    details: {
                                        station: 'c1',
                                        stationMode: 'locked',
                                        oneTap: false,
                                        numpadSeen: true,
                                    },
                                },
                                instances: [],
                            },
                            kiosk: {
                                surface: 'kiosk',
                                label: 'Kiosco',
                                status: 'unknown',
                                updatedAt: '',
                                ageSec: 0,
                                stale: true,
                                summary: 'Sin heartbeat',
                                latest: null,
                                instances: [],
                            },
                            display: {
                                surface: 'display',
                                label: 'Sala TV',
                                status: 'unknown',
                                updatedAt: '',
                                ageSec: 0,
                                stale: true,
                                summary: 'Sin heartbeat',
                                latest: null,
                                instances: [],
                            },
                        },
                    },
                });
            }

            return json(route, { ok: true, data: {} });
        });

        await page.goto('/admin.html#queue');
        await page.locator('a[href="#queue"]').last().click();

        await expect(page.locator('#queueDeskEscalation')).toBeVisible();
        await expect(page.locator('#queueDeskEscalationTitle')).toContainText(
            'Escalación sugerida'
        );
        await expect(
            page.locator('#queueDeskEscalationPhrase_appointment')
        ).toContainText(
            'Todavía no hace falta escalar: sostén C1, conserva la promesa visible de ahora y revalida solo si rebasa esa ventana o aparece un bloqueo vivo.'
        );
        await expect(
            page.locator('#queueDeskEscalationPhrase_walkin')
        ).toContainText(
            'Si el paciente ya no acepta C2, sí conviene escalar a C1: hoy el recorte visible justifica moverlo antes de seguir prometiendo sobre C2.'
        );
        await expect(
            page.locator('#queueDeskEscalationPhrase_rule')
        ).toContainText(
            'Escala solo cuando la promesa segura ya no aguanta: ventana vencida, bloqueo vivo o ticket en SLA crítico.'
        );
        await expect(
            page.locator('#queueDeskEscalationOpen_walkin')
        ).toHaveAttribute('href', /operador-turnos\.html\?station=c1&lock=1/);
    });

    test('escala verbal baja la escalación a una frase operativa de mostrador', async ({
        page,
    }) => {
        const queueTickets = [
            {
                id: 3112,
                ticketCode: 'A-3112',
                queueType: 'walk_in',
                patientInitials: 'KB',
                priorityClass: 'walk_in',
                status: 'waiting',
                assignedConsultorio: 2,
                createdAt: new Date(Date.now() - 4 * 60 * 1000).toISOString(),
            },
            {
                id: 3113,
                ticketCode: 'A-3113',
                queueType: 'walk_in',
                patientInitials: 'LC',
                priorityClass: 'walk_in',
                status: 'waiting',
                assignedConsultorio: 2,
                createdAt: new Date(Date.now() - 3 * 60 * 1000).toISOString(),
            },
        ];
        const queueState = buildQueueStateFromTickets(queueTickets);

        await page.addInitScript(() => {
            window.localStorage.setItem('queueOpsFocusModeV1', 'operations');
        });

        await installQueueAdminAuthMock(
            page,
            'csrf_queue_desk_escalation_talk'
        );

        await page.route(/\/api\.php(\?.*)?$/i, async (route) => {
            const request = route.request();
            const url = new URL(request.url());
            const resource = url.searchParams.get('resource') || '';
            if (resource === 'features') {
                return json(route, {
                    ok: true,
                    data: { admin_sony_ui: ADMIN_UI_VARIANT === 'sony_v2' },
                });
            }

            if (resource === 'data') {
                return json(route, {
                    ok: true,
                    data: {
                        appointments: [],
                        callbacks: [],
                        reviews: [],
                        availability: {},
                        availabilityMeta: {
                            source: 'store',
                            mode: 'live',
                            timezone: 'America/Guayaquil',
                            calendarConfigured: true,
                            calendarReachable: true,
                            generatedAt: new Date().toISOString(),
                        },
                        queue_tickets: queueTickets,
                        queueMeta: buildQueueMetaFromState(queueState),
                        queueSurfaceStatus: {
                            operator: {
                                surface: 'operator',
                                label: 'Operador',
                                status: 'ready',
                                updatedAt: new Date().toISOString(),
                                ageSec: 4,
                                stale: false,
                                summary: 'Equipo listo para operar en C1 fijo.',
                                latest: {
                                    deviceLabel: 'Operador C1 fijo',
                                    appMode: 'desktop',
                                    ageSec: 4,
                                    details: {
                                        station: 'c1',
                                        stationMode: 'locked',
                                        oneTap: false,
                                        numpadSeen: true,
                                    },
                                },
                                instances: [],
                            },
                            kiosk: {
                                surface: 'kiosk',
                                label: 'Kiosco',
                                status: 'unknown',
                                updatedAt: '',
                                ageSec: 0,
                                stale: true,
                                summary: 'Sin heartbeat',
                                latest: null,
                                instances: [],
                            },
                            display: {
                                surface: 'display',
                                label: 'Sala TV',
                                status: 'unknown',
                                updatedAt: '',
                                ageSec: 0,
                                stale: true,
                                summary: 'Sin heartbeat',
                                latest: null,
                                instances: [],
                            },
                        },
                    },
                });
            }

            return json(route, { ok: true, data: {} });
        });

        await page.goto('/admin.html#queue');
        await page.locator('a[href="#queue"]').last().click();

        await expect(page.locator('#queueDeskEscalationTalk')).toBeVisible();
        await expect(
            page.locator('#queueDeskEscalationTalkTitle')
        ).toContainText('Escala verbal');
        await expect(
            page.locator('#queueDeskEscalationTalkPhrase_appointment')
        ).toContainText(
            'Por ahora lo mantengo por C1 con una ventana visible de ahora; si esa referencia se corre o cambia la carga, le confirmo otra opción sin quitarle este carril.'
        );
        await expect(
            page.locator('#queueDeskEscalationTalkPhrase_walkin')
        ).toContainText(
            'Le voy a revisar una opción mejor por C1; si queda abierta, le confirmo el cambio sin perder la referencia actual por C2.'
        );
        await expect(
            page.locator('#queueDeskEscalationTalkPhrase_rule')
        ).toContainText(
            'Si ya toca escalar, primero diga que va a revisar la opción y confirme el cambio solo después de abrir el operador.'
        );
        await expect(
            page.locator('#queueDeskEscalationTalkOpen_walkin')
        ).toHaveAttribute('href', /operador-turnos\.html\?station=c1&lock=1/);
    });

    test('confirmación de escala cierra la conversación cuando el carril ya quedó resuelto', async ({
        page,
    }) => {
        const queueTickets = [
            {
                id: 3212,
                ticketCode: 'A-3212',
                queueType: 'walk_in',
                patientInitials: 'KB',
                priorityClass: 'walk_in',
                status: 'waiting',
                assignedConsultorio: 2,
                createdAt: new Date(Date.now() - 4 * 60 * 1000).toISOString(),
            },
            {
                id: 3213,
                ticketCode: 'A-3213',
                queueType: 'walk_in',
                patientInitials: 'LC',
                priorityClass: 'walk_in',
                status: 'waiting',
                assignedConsultorio: 2,
                createdAt: new Date(Date.now() - 3 * 60 * 1000).toISOString(),
            },
        ];
        const queueState = buildQueueStateFromTickets(queueTickets);

        await page.addInitScript(() => {
            window.localStorage.setItem('queueOpsFocusModeV1', 'operations');
        });

        await installQueueAdminAuthMock(
            page,
            'csrf_queue_desk_escalation_confirm'
        );

        await page.route(/\/api\.php(\?.*)?$/i, async (route) => {
            const request = route.request();
            const url = new URL(request.url());
            const resource = url.searchParams.get('resource') || '';
            if (resource === 'features') {
                return json(route, {
                    ok: true,
                    data: { admin_sony_ui: ADMIN_UI_VARIANT === 'sony_v2' },
                });
            }

            if (resource === 'data') {
                return json(route, {
                    ok: true,
                    data: {
                        appointments: [],
                        callbacks: [],
                        reviews: [],
                        availability: {},
                        availabilityMeta: {
                            source: 'store',
                            mode: 'live',
                            timezone: 'America/Guayaquil',
                            calendarConfigured: true,
                            calendarReachable: true,
                            generatedAt: new Date().toISOString(),
                        },
                        queue_tickets: queueTickets,
                        queueMeta: buildQueueMetaFromState(queueState),
                        queueSurfaceStatus: {
                            operator: {
                                surface: 'operator',
                                label: 'Operador',
                                status: 'ready',
                                updatedAt: new Date().toISOString(),
                                ageSec: 4,
                                stale: false,
                                summary: 'Equipo listo para operar en C1 fijo.',
                                latest: {
                                    deviceLabel: 'Operador C1 fijo',
                                    appMode: 'desktop',
                                    ageSec: 4,
                                    details: {
                                        station: 'c1',
                                        stationMode: 'locked',
                                        oneTap: false,
                                        numpadSeen: true,
                                    },
                                },
                                instances: [],
                            },
                            kiosk: {
                                surface: 'kiosk',
                                label: 'Kiosco',
                                status: 'unknown',
                                updatedAt: '',
                                ageSec: 0,
                                stale: true,
                                summary: 'Sin heartbeat',
                                latest: null,
                                instances: [],
                            },
                            display: {
                                surface: 'display',
                                label: 'Sala TV',
                                status: 'unknown',
                                updatedAt: '',
                                ageSec: 0,
                                stale: true,
                                summary: 'Sin heartbeat',
                                latest: null,
                                instances: [],
                            },
                        },
                    },
                });
            }

            return json(route, { ok: true, data: {} });
        });

        await page.goto('/admin.html#queue');
        await page.locator('a[href="#queue"]').last().click();

        await expect(page.locator('#queueDeskEscalationConfirm')).toBeVisible();
        await expect(
            page.locator('#queueDeskEscalationConfirmTitle')
        ).toContainText('Confirmación de escala');
        await expect(
            page.locator('#queueDeskEscalationConfirmPhrase_appointment')
        ).toContainText(
            'Por ahora sigue por C1 con una ventana visible de ahora; si hay un cambio real de carril, se lo confirmamos antes de moverlo.'
        );
        await expect(
            page.locator('#queueDeskEscalationConfirmPhrase_walkin')
        ).toContainText(
            'Ya quedó por C1; desde aquí mantenga el ticket a mano y siga la TV o campanilla. Si la referencia vuelve a cambiar, se lo confirmamos sin devolverlo a C2.'
        );
        await expect(
            page.locator('#queueDeskEscalationConfirmPhrase_rule')
        ).toContainText(
            'Cierre la conversación confirmando únicamente el carril que ya quedó operativo; si todavía está en revisión, mantenga la referencia actual y diga que le avisará el ajuste.'
        );
        await expect(
            page.locator('#queueDeskEscalationConfirmOpen_walkin')
        ).toHaveAttribute('href', /operador-turnos\.html\?station=c1&lock=1/);
    });

    test('seguimiento de escala explica qué hacer si el paciente vuelve a preguntar tras el cambio', async ({
        page,
    }) => {
        const queueTickets = [
            {
                id: 3312,
                ticketCode: 'A-3312',
                queueType: 'walk_in',
                patientInitials: 'KB',
                priorityClass: 'walk_in',
                status: 'waiting',
                assignedConsultorio: 2,
                createdAt: new Date(Date.now() - 4 * 60 * 1000).toISOString(),
            },
            {
                id: 3313,
                ticketCode: 'A-3313',
                queueType: 'walk_in',
                patientInitials: 'LC',
                priorityClass: 'walk_in',
                status: 'waiting',
                assignedConsultorio: 2,
                createdAt: new Date(Date.now() - 3 * 60 * 1000).toISOString(),
            },
        ];
        const queueState = buildQueueStateFromTickets(queueTickets);

        await page.addInitScript(() => {
            window.localStorage.setItem('queueOpsFocusModeV1', 'operations');
        });

        await installQueueAdminAuthMock(
            page,
            'csrf_queue_desk_escalation_followup'
        );

        await page.route(/\/api\.php(\?.*)?$/i, async (route) => {
            const request = route.request();
            const url = new URL(request.url());
            const resource = url.searchParams.get('resource') || '';
            if (resource === 'features') {
                return json(route, {
                    ok: true,
                    data: { admin_sony_ui: ADMIN_UI_VARIANT === 'sony_v2' },
                });
            }

            if (resource === 'data') {
                return json(route, {
                    ok: true,
                    data: {
                        appointments: [],
                        callbacks: [],
                        reviews: [],
                        availability: {},
                        availabilityMeta: {
                            source: 'store',
                            mode: 'live',
                            timezone: 'America/Guayaquil',
                            calendarConfigured: true,
                            calendarReachable: true,
                            generatedAt: new Date().toISOString(),
                        },
                        queue_tickets: queueTickets,
                        queueMeta: buildQueueMetaFromState(queueState),
                        queueSurfaceStatus: {
                            operator: {
                                surface: 'operator',
                                label: 'Operador',
                                status: 'ready',
                                updatedAt: new Date().toISOString(),
                                ageSec: 4,
                                stale: false,
                                summary: 'Equipo listo para operar en C1 fijo.',
                                latest: {
                                    deviceLabel: 'Operador C1 fijo',
                                    appMode: 'desktop',
                                    ageSec: 4,
                                    details: {
                                        station: 'c1',
                                        stationMode: 'locked',
                                        oneTap: false,
                                        numpadSeen: true,
                                    },
                                },
                                instances: [],
                            },
                            kiosk: {
                                surface: 'kiosk',
                                label: 'Kiosco',
                                status: 'unknown',
                                updatedAt: '',
                                ageSec: 0,
                                stale: true,
                                summary: 'Sin heartbeat',
                                latest: null,
                                instances: [],
                            },
                            display: {
                                surface: 'display',
                                label: 'Sala TV',
                                status: 'unknown',
                                updatedAt: '',
                                ageSec: 0,
                                stale: true,
                                summary: 'Sin heartbeat',
                                latest: null,
                                instances: [],
                            },
                        },
                    },
                });
            }

            return json(route, { ok: true, data: {} });
        });

        await page.goto('/admin.html#queue');
        await page.locator('a[href="#queue"]').last().click();

        await expect(
            page.locator('#queueDeskEscalationFollowup')
        ).toBeVisible();
        await expect(
            page.locator('#queueDeskEscalationFollowupTitle')
        ).toContainText('Seguimiento de escala');
        await expect(
            page.locator('#queueDeskEscalationFollowupPhrase_appointment')
        ).toContainText(
            'Si vuelve a preguntar, manténgalo por C1 y recuérdele que la referencia visible actual es ahora; solo revalide aquí si esa ventana ya pasó o cambia el carril.'
        );
        await expect(
            page.locator('#queueDeskEscalationFollowupPhrase_walkin')
        ).toContainText(
            'Si vuelve a preguntar, manténgalo por C1 y recuérdele que la referencia visible actual es ahora; solo revalide aquí si esa ventana ya pasó o cambia el carril.'
        );
        await expect(
            page.locator('#queueDeskEscalationFollowupPhrase_rule')
        ).toContainText(
            'Después de confirmar la escala, el seguimiento es simple: sostenga el carril ya resuelto y reabra la conversación solo si se vence la ventana visible o si el hub vuelve a marcar otro cambio real.'
        );
        await expect(
            page.locator('#queueDeskEscalationFollowupOpen_walkin')
        ).toHaveAttribute('href', /operador-turnos\.html\?station=c1&lock=1/);
    });

    test('reapertura de escala indica cómo reabrir si la nueva referencia ya se venció', async ({
        page,
    }) => {
        const queueTickets = [
            {
                id: 3412,
                ticketCode: 'A-3412',
                queueType: 'walk_in',
                patientInitials: 'KB',
                priorityClass: 'walk_in',
                status: 'waiting',
                assignedConsultorio: 2,
                createdAt: new Date(Date.now() - 4 * 60 * 1000).toISOString(),
            },
            {
                id: 3413,
                ticketCode: 'A-3413',
                queueType: 'walk_in',
                patientInitials: 'LC',
                priorityClass: 'walk_in',
                status: 'waiting',
                assignedConsultorio: 2,
                createdAt: new Date(Date.now() - 3 * 60 * 1000).toISOString(),
            },
        ];
        const queueState = buildQueueStateFromTickets(queueTickets);

        await page.addInitScript(() => {
            window.localStorage.setItem('queueOpsFocusModeV1', 'operations');
        });

        await installQueueAdminAuthMock(
            page,
            'csrf_queue_desk_escalation_reopen'
        );

        await page.route(/\/api\.php(\?.*)?$/i, async (route) => {
            const request = route.request();
            const url = new URL(request.url());
            const resource = url.searchParams.get('resource') || '';
            if (resource === 'features') {
                return json(route, {
                    ok: true,
                    data: { admin_sony_ui: ADMIN_UI_VARIANT === 'sony_v2' },
                });
            }

            if (resource === 'data') {
                return json(route, {
                    ok: true,
                    data: {
                        appointments: [],
                        callbacks: [],
                        reviews: [],
                        availability: {},
                        availabilityMeta: {
                            source: 'store',
                            mode: 'live',
                            timezone: 'America/Guayaquil',
                            calendarConfigured: true,
                            calendarReachable: true,
                            generatedAt: new Date().toISOString(),
                        },
                        queue_tickets: queueTickets,
                        queueMeta: buildQueueMetaFromState(queueState),
                        queueSurfaceStatus: {
                            operator: {
                                surface: 'operator',
                                label: 'Operador',
                                status: 'ready',
                                updatedAt: new Date().toISOString(),
                                ageSec: 4,
                                stale: false,
                                summary: 'Equipo listo para operar en C1 fijo.',
                                latest: {
                                    deviceLabel: 'Operador C1 fijo',
                                    appMode: 'desktop',
                                    ageSec: 4,
                                    details: {
                                        station: 'c1',
                                        stationMode: 'locked',
                                        oneTap: false,
                                        numpadSeen: true,
                                    },
                                },
                                instances: [],
                            },
                            kiosk: {
                                surface: 'kiosk',
                                label: 'Kiosco',
                                status: 'unknown',
                                updatedAt: '',
                                ageSec: 0,
                                stale: true,
                                summary: 'Sin heartbeat',
                                latest: null,
                                instances: [],
                            },
                            display: {
                                surface: 'display',
                                label: 'Sala TV',
                                status: 'unknown',
                                updatedAt: '',
                                ageSec: 0,
                                stale: true,
                                summary: 'Sin heartbeat',
                                latest: null,
                                instances: [],
                            },
                        },
                    },
                });
            }

            return json(route, { ok: true, data: {} });
        });

        await page.goto('/admin.html#queue');
        await page.locator('a[href="#queue"]').last().click();

        await expect(page.locator('#queueDeskEscalationReopen')).toBeVisible();
        await expect(
            page.locator('#queueDeskEscalationReopenTitle')
        ).toContainText('Reapertura de escala');
        await expect(
            page.locator('#queueDeskEscalationReopenPhrase_appointment')
        ).toContainText(
            'Si la referencia por C1 ya se venció, reabra solo para actualizar la nueva ventana visible (ahora) y confirmar que sigue por el mismo carril.'
        );
        await expect(
            page.locator('#queueDeskEscalationReopenPhrase_walkin')
        ).toContainText(
            'Si ya se venció la referencia por C2, reabra la conversación y ofrezca moverlo a C1: hoy la nueva ventana visible baja a ahora.'
        );
        await expect(
            page.locator('#queueDeskEscalationReopenPhrase_rule')
        ).toContainText(
            'Si la escala confirmada vuelve a vencerse, primero actualice la ventana visible del carril resuelto y solo ofrezca otro cambio si el otro carril gana al menos ~8m.'
        );
        await expect(
            page.locator('#queueDeskEscalationReopenOpen_walkin')
        ).toHaveAttribute('href', /operador-turnos\.html\?station=c1&lock=1/);
    });

    test('límite de reapertura marca cuándo dejar de ajustar verbalmente y abrir operador', async ({
        page,
    }) => {
        const queueTickets = [
            {
                id: 3512,
                ticketCode: 'A-3512',
                queueType: 'walk_in',
                patientInitials: 'KB',
                priorityClass: 'walk_in',
                status: 'waiting',
                assignedConsultorio: 2,
                createdAt: new Date(Date.now() - 4 * 60 * 1000).toISOString(),
            },
            {
                id: 3513,
                ticketCode: 'A-3513',
                queueType: 'walk_in',
                patientInitials: 'LC',
                priorityClass: 'walk_in',
                status: 'waiting',
                assignedConsultorio: 2,
                createdAt: new Date(Date.now() - 3 * 60 * 1000).toISOString(),
            },
        ];
        const queueState = buildQueueStateFromTickets(queueTickets);

        await page.addInitScript(() => {
            window.localStorage.setItem('queueOpsFocusModeV1', 'operations');
        });

        await installQueueAdminAuthMock(
            page,
            'csrf_queue_desk_escalation_limit'
        );

        await page.route(/\/api\.php(\?.*)?$/i, async (route) => {
            const request = route.request();
            const url = new URL(request.url());
            const resource = url.searchParams.get('resource') || '';
            if (resource === 'features') {
                return json(route, {
                    ok: true,
                    data: { admin_sony_ui: ADMIN_UI_VARIANT === 'sony_v2' },
                });
            }

            if (resource === 'data') {
                return json(route, {
                    ok: true,
                    data: {
                        appointments: [],
                        callbacks: [],
                        reviews: [],
                        availability: {},
                        availabilityMeta: {
                            source: 'store',
                            mode: 'live',
                            timezone: 'America/Guayaquil',
                            calendarConfigured: true,
                            calendarReachable: true,
                            generatedAt: new Date().toISOString(),
                        },
                        queue_tickets: queueTickets,
                        queueMeta: buildQueueMetaFromState(queueState),
                        queueSurfaceStatus: {
                            operator: {
                                surface: 'operator',
                                label: 'Operador',
                                status: 'ready',
                                updatedAt: new Date().toISOString(),
                                ageSec: 4,
                                stale: false,
                                summary: 'Equipo listo para operar en C1 fijo.',
                                latest: {
                                    deviceLabel: 'Operador C1 fijo',
                                    appMode: 'desktop',
                                    ageSec: 4,
                                    details: {
                                        station: 'c1',
                                        stationMode: 'locked',
                                        oneTap: false,
                                        numpadSeen: true,
                                    },
                                },
                                instances: [],
                            },
                            kiosk: {
                                surface: 'kiosk',
                                label: 'Kiosco',
                                status: 'unknown',
                                updatedAt: '',
                                ageSec: 0,
                                stale: true,
                                summary: 'Sin heartbeat',
                                latest: null,
                                instances: [],
                            },
                            display: {
                                surface: 'display',
                                label: 'Sala TV',
                                status: 'unknown',
                                updatedAt: '',
                                ageSec: 0,
                                stale: true,
                                summary: 'Sin heartbeat',
                                latest: null,
                                instances: [],
                            },
                        },
                    },
                });
            }

            return json(route, { ok: true, data: {} });
        });

        await page.goto('/admin.html#queue');
        await page.locator('a[href="#queue"]').last().click();

        await expect(page.locator('#queueDeskEscalationLimit')).toBeVisible();
        await expect(
            page.locator('#queueDeskEscalationLimitTitle')
        ).toContainText('Límite de reapertura');
        await expect(
            page.locator('#queueDeskEscalationLimitPhrase_appointment')
        ).toContainText(
            'Si vuelve a correrse otra vez, no prometa una tercera ventana verbal; abra C1 y confirme ahí si se sostiene el mismo carril o si se mueve de verdad.'
        );
        await expect(
            page.locator('#queueDeskEscalationLimitPhrase_walkin')
        ).toContainText(
            'Si vuelve a correrse otra vez, no prometa una tercera ventana verbal; abra C1 y confirme ahí si se sostiene el mismo carril o si se mueve de verdad.'
        );
        await expect(
            page.locator('#queueDeskEscalationLimitPhrase_rule')
        ).toContainText(
            'Después de una reapertura, la siguiente conversación ya no va por guion: o actualiza una sola ventana o abre operador; evita prometer un tercer ajuste desde mostrador.'
        );
        await expect(
            page.locator('#queueDeskEscalationLimitOpen_walkin')
        ).toHaveAttribute('href', /operador-turnos\.html\?station=c1&lock=1/);
    });

    test('puente a operación deja la frase breve para pasar el caso al operador', async ({
        page,
    }) => {
        const queueTickets = [
            {
                id: 3612,
                ticketCode: 'A-3612',
                queueType: 'walk_in',
                patientInitials: 'KB',
                priorityClass: 'walk_in',
                status: 'waiting',
                assignedConsultorio: 2,
                createdAt: new Date(Date.now() - 4 * 60 * 1000).toISOString(),
            },
            {
                id: 3613,
                ticketCode: 'A-3613',
                queueType: 'walk_in',
                patientInitials: 'LC',
                priorityClass: 'walk_in',
                status: 'waiting',
                assignedConsultorio: 2,
                createdAt: new Date(Date.now() - 3 * 60 * 1000).toISOString(),
            },
        ];
        const queueState = buildQueueStateFromTickets(queueTickets);

        await page.addInitScript(() => {
            window.localStorage.setItem('queueOpsFocusModeV1', 'operations');
        });

        await installQueueAdminAuthMock(
            page,
            'csrf_queue_desk_escalation_bridge'
        );

        await page.route(/\/api\.php(\?.*)?$/i, async (route) => {
            const request = route.request();
            const url = new URL(request.url());
            const resource = url.searchParams.get('resource') || '';
            if (resource === 'features') {
                return json(route, {
                    ok: true,
                    data: { admin_sony_ui: ADMIN_UI_VARIANT === 'sony_v2' },
                });
            }

            if (resource === 'data') {
                return json(route, {
                    ok: true,
                    data: {
                        appointments: [],
                        callbacks: [],
                        reviews: [],
                        availability: {},
                        availabilityMeta: {
                            source: 'store',
                            mode: 'live',
                            timezone: 'America/Guayaquil',
                            calendarConfigured: true,
                            calendarReachable: true,
                            generatedAt: new Date().toISOString(),
                        },
                        queue_tickets: queueTickets,
                        queueMeta: buildQueueMetaFromState(queueState),
                        queueSurfaceStatus: {
                            operator: {
                                surface: 'operator',
                                label: 'Operador',
                                status: 'ready',
                                updatedAt: new Date().toISOString(),
                                ageSec: 4,
                                stale: false,
                                summary: 'Equipo listo para operar en C1 fijo.',
                                latest: {
                                    deviceLabel: 'Operador C1 fijo',
                                    appMode: 'desktop',
                                    ageSec: 4,
                                    details: {
                                        station: 'c1',
                                        stationMode: 'locked',
                                        oneTap: false,
                                        numpadSeen: true,
                                    },
                                },
                                instances: [],
                            },
                            kiosk: {
                                surface: 'kiosk',
                                label: 'Kiosco',
                                status: 'unknown',
                                updatedAt: '',
                                ageSec: 0,
                                stale: true,
                                summary: 'Sin heartbeat',
                                latest: null,
                                instances: [],
                            },
                            display: {
                                surface: 'display',
                                label: 'Sala TV',
                                status: 'unknown',
                                updatedAt: '',
                                ageSec: 0,
                                stale: true,
                                summary: 'Sin heartbeat',
                                latest: null,
                                instances: [],
                            },
                        },
                    },
                });
            }

            return json(route, { ok: true, data: {} });
        });

        await page.goto('/admin.html#queue');
        await page.locator('a[href="#queue"]').last().click();

        await expect(page.locator('#queueDeskEscalationBridge')).toBeVisible();
        await expect(
            page.locator('#queueDeskEscalationBridgeTitle')
        ).toContainText('Puente a operación');
        await expect(
            page.locator('#queueDeskEscalationBridgePhrase_appointment')
        ).toContainText(
            'Ya no le voy a prometer otra ventana aquí: lo validamos con C1 y en cuanto quede resuelto le confirmamos si sigue igual o cambia de carril.'
        );
        await expect(
            page.locator('#queueDeskEscalationBridgePhrase_walkin')
        ).toContainText(
            'Ya no le voy a prometer otra ventana aquí: lo validamos con C1 y en cuanto quede resuelto le confirmamos si sigue igual o cambia de carril.'
        );
        await expect(
            page.locator('#queueDeskEscalationBridgePhrase_rule')
        ).toContainText(
            'Cuando el caso ya llegó a límite, cierre el mostrador con un puente corto a operación: abra el operador, evite discutir otra ventana y confirme una sola salida.'
        );
        await expect(
            page.locator('#queueDeskEscalationBridgeOpen_walkin')
        ).toHaveAttribute('href', /operador-turnos\.html\?station=c1&lock=1/);
    });

    test('brief para operador resume el contexto minimo para la escalacion', async ({
        page,
    }) => {
        const queueTickets = [
            {
                id: 1201,
                ticketCode: 'A-1201',
                queueType: 'appointment',
                patientInitials: 'LM',
                priorityClass: 'appointment',
                status: 'waiting',
                assignedConsultorio: 'c1',
                createdAt: new Date(Date.now() - 18 * 60 * 1000).toISOString(),
                scheduledAt: new Date(Date.now() - 6 * 60 * 1000).toISOString(),
            },
            {
                id: 1202,
                ticketCode: 'A-1202',
                queueType: 'walk_in',
                patientInitials: 'RS',
                priorityClass: 'walk_in',
                status: 'waiting',
                assignedConsultorio: null,
                createdAt: new Date(Date.now() - 15 * 60 * 1000).toISOString(),
            },
        ];
        const queueState = buildQueueStateFromTickets(queueTickets);

        await page.addInitScript(() => {
            window.localStorage.setItem('queueOpsFocusModeV1', 'operations');
        });

        await installQueueAdminAuthMock(
            page,
            'csrf_queue_desk_escalation_brief'
        );

        await page.route(/\/api\.php(\?.*)?$/i, async (route) => {
            const request = route.request();
            const url = new URL(request.url());
            const resource = url.searchParams.get('resource') || '';
            if (resource === 'features') {
                return json(route, {
                    ok: true,
                    data: { admin_sony_ui: ADMIN_UI_VARIANT === 'sony_v2' },
                });
            }

            if (resource === 'data') {
                return json(route, {
                    ok: true,
                    data: {
                        appointments: [],
                        callbacks: [],
                        reviews: [],
                        availability: {},
                        availabilityMeta: {
                            source: 'store',
                            mode: 'live',
                            timezone: 'America/Guayaquil',
                            calendarConfigured: true,
                            calendarReachable: true,
                            generatedAt: new Date().toISOString(),
                        },
                        queue_tickets: queueTickets,
                        queueMeta: buildQueueMetaFromState(queueState),
                        queueSurfaceStatus: {
                            operator: {
                                surface: 'operator',
                                label: 'Operador',
                                status: 'ready',
                                updatedAt: new Date().toISOString(),
                                ageSec: 4,
                                stale: false,
                                summary: 'Equipo listo para operar en C1 fijo.',
                                latest: {
                                    deviceLabel: 'Operador C1 fijo',
                                    appMode: 'desktop',
                                    ageSec: 4,
                                    details: {
                                        station: 'c1',
                                        stationMode: 'locked',
                                        oneTap: false,
                                        numpadSeen: true,
                                    },
                                },
                                instances: [],
                            },
                            kiosk: {
                                surface: 'kiosk',
                                label: 'Kiosco',
                                status: 'unknown',
                                updatedAt: '',
                                ageSec: 0,
                                stale: true,
                                summary: 'Sin heartbeat',
                                latest: null,
                                instances: [],
                            },
                            display: {
                                surface: 'display',
                                label: 'Sala TV',
                                status: 'unknown',
                                updatedAt: '',
                                ageSec: 0,
                                stale: true,
                                summary: 'Sin heartbeat',
                                latest: null,
                                instances: [],
                            },
                        },
                    },
                });
            }

            return json(route, { ok: true, data: {} });
        });

        await page.goto('/admin.html#queue');
        await page.locator('a[href="#queue"]').last().click();

        await expect(page.locator('#queueDeskEscalationBrief')).toBeVisible();
        await expect(
            page.locator('#queueDeskEscalationBriefTitle')
        ).toContainText('Brief para operador');
        await expect(
            page.locator('#queueDeskEscalationBriefPhrase_appointment')
        ).toContainText(
            'La cita ya fue revalidada en mostrador; valide con C1 si sostiene el carril actual o si conviene moverla ahora mismo.'
        );
        await expect(
            page.locator('#queueDeskEscalationBriefPhrase_walkin')
        ).toContainText(
            'El ingreso sin cita ya agotó el margen verbal en mostrador; revise con C1 si entra por hueco inmediato o si sigue en cola general sin otra promesa.'
        );
        await expect(
            page.locator('#queueDeskEscalationBriefPhrase_rule')
        ).toContainText(
            'Al pasar el caso, resuma qué se agotó en mostrador y cuál es la única decisión pendiente: sostener, mover o recalcular. Nada más.'
        );
        await expect(
            page.locator('#queueDeskEscalationBriefOpen_walkin')
        ).toHaveAttribute('href', /operador-turnos\.html\?station=c1&lock=1/);
    });

    test('retorno a mostrador deja lista la respuesta cerrada desde operacion', async ({
        page,
    }) => {
        const queueTickets = [
            {
                id: 1211,
                ticketCode: 'A-1211',
                queueType: 'appointment',
                patientInitials: 'PM',
                priorityClass: 'appointment',
                status: 'waiting',
                assignedConsultorio: 'c1',
                createdAt: new Date(Date.now() - 20 * 60 * 1000).toISOString(),
                scheduledAt: new Date(Date.now() - 7 * 60 * 1000).toISOString(),
            },
            {
                id: 1212,
                ticketCode: 'A-1212',
                queueType: 'walk_in',
                patientInitials: 'DG',
                priorityClass: 'walk_in',
                status: 'waiting',
                assignedConsultorio: null,
                createdAt: new Date(Date.now() - 17 * 60 * 1000).toISOString(),
            },
        ];
        const queueState = buildQueueStateFromTickets(queueTickets);

        await page.addInitScript(() => {
            window.localStorage.setItem('queueOpsFocusModeV1', 'operations');
        });

        await installQueueAdminAuthMock(
            page,
            'csrf_queue_desk_escalation_return'
        );

        await page.route(/\/api\.php(\?.*)?$/i, async (route) => {
            const request = route.request();
            const url = new URL(request.url());
            const resource = url.searchParams.get('resource') || '';
            if (resource === 'features') {
                return json(route, {
                    ok: true,
                    data: { admin_sony_ui: ADMIN_UI_VARIANT === 'sony_v2' },
                });
            }

            if (resource === 'data') {
                return json(route, {
                    ok: true,
                    data: {
                        appointments: [],
                        callbacks: [],
                        reviews: [],
                        availability: {},
                        availabilityMeta: {
                            source: 'store',
                            mode: 'live',
                            timezone: 'America/Guayaquil',
                            calendarConfigured: true,
                            calendarReachable: true,
                            generatedAt: new Date().toISOString(),
                        },
                        queue_tickets: queueTickets,
                        queueMeta: buildQueueMetaFromState(queueState),
                        queueSurfaceStatus: {
                            operator: {
                                surface: 'operator',
                                label: 'Operador',
                                status: 'ready',
                                updatedAt: new Date().toISOString(),
                                ageSec: 3,
                                stale: false,
                                summary: 'Equipo listo para operar en C1 fijo.',
                                latest: {
                                    deviceLabel: 'Operador C1 fijo',
                                    appMode: 'desktop',
                                    ageSec: 3,
                                    details: {
                                        station: 'c1',
                                        stationMode: 'locked',
                                        oneTap: false,
                                        numpadSeen: true,
                                    },
                                },
                                instances: [],
                            },
                            kiosk: {
                                surface: 'kiosk',
                                label: 'Kiosco',
                                status: 'unknown',
                                updatedAt: '',
                                ageSec: 0,
                                stale: true,
                                summary: 'Sin heartbeat',
                                latest: null,
                                instances: [],
                            },
                            display: {
                                surface: 'display',
                                label: 'Sala TV',
                                status: 'unknown',
                                updatedAt: '',
                                ageSec: 0,
                                stale: true,
                                summary: 'Sin heartbeat',
                                latest: null,
                                instances: [],
                            },
                        },
                    },
                });
            }

            return json(route, { ok: true, data: {} });
        });

        await page.goto('/admin.html#queue');
        await page.locator('a[href="#queue"]').last().click();

        await expect(page.locator('#queueDeskEscalationReturn')).toBeVisible();
        await expect(
            page.locator('#queueDeskEscalationReturnTitle')
        ).toContainText('Retorno a mostrador');
        await expect(
            page.locator('#queueDeskEscalationReturnPhrase_appointment')
        ).toContainText(
            'Operación ya lo está validando con C1; en cuanto cierre, le confirmamos si sigue por ese carril o si pasa directo al ajuste que sí le convenga.'
        );
        await expect(
            page.locator('#queueDeskEscalationReturnPhrase_walkin')
        ).toContainText(
            'Operación ya lo está validando con C1; en cuanto cierre, le confirmamos si entra por hueco inmediato o si sigue en cola general con la ventana actualizada.'
        );
        await expect(
            page.locator('#queueDeskEscalationReturnPhrase_rule')
        ).toContainText(
            'Cuando operación responda, mostrador comunica una sola salida cerrada: sostener, mover o recalcular. No vuelve a abrir la negociación desde cero.'
        );
        await expect(
            page.locator('#queueDeskEscalationReturnOpen_walkin')
        ).toHaveAttribute('href', /operador-turnos\.html\?station=c1&lock=1/);
    });

    test('resolucion devuelta deja la frase final cuando operacion ya cerro la decision', async ({
        page,
    }) => {
        const queueTickets = [
            {
                id: 1221,
                ticketCode: 'A-1221',
                queueType: 'appointment',
                patientInitials: 'SV',
                priorityClass: 'appointment',
                status: 'waiting',
                assignedConsultorio: 'c1',
                createdAt: new Date(Date.now() - 21 * 60 * 1000).toISOString(),
                scheduledAt: new Date(Date.now() - 8 * 60 * 1000).toISOString(),
            },
            {
                id: 1222,
                ticketCode: 'A-1222',
                queueType: 'walk_in',
                patientInitials: 'TN',
                priorityClass: 'walk_in',
                status: 'waiting',
                assignedConsultorio: null,
                createdAt: new Date(Date.now() - 18 * 60 * 1000).toISOString(),
            },
        ];
        const queueState = buildQueueStateFromTickets(queueTickets);

        await page.addInitScript(() => {
            window.localStorage.setItem('queueOpsFocusModeV1', 'operations');
        });

        await installQueueAdminAuthMock(
            page,
            'csrf_queue_desk_escalation_resolution'
        );

        await page.route(/\/api\.php(\?.*)?$/i, async (route) => {
            const request = route.request();
            const url = new URL(request.url());
            const resource = url.searchParams.get('resource') || '';
            if (resource === 'features') {
                return json(route, {
                    ok: true,
                    data: { admin_sony_ui: ADMIN_UI_VARIANT === 'sony_v2' },
                });
            }

            if (resource === 'data') {
                return json(route, {
                    ok: true,
                    data: {
                        appointments: [],
                        callbacks: [],
                        reviews: [],
                        availability: {},
                        availabilityMeta: {
                            source: 'store',
                            mode: 'live',
                            timezone: 'America/Guayaquil',
                            calendarConfigured: true,
                            calendarReachable: true,
                            generatedAt: new Date().toISOString(),
                        },
                        queue_tickets: queueTickets,
                        queueMeta: buildQueueMetaFromState(queueState),
                        queueSurfaceStatus: {
                            operator: {
                                surface: 'operator',
                                label: 'Operador',
                                status: 'ready',
                                updatedAt: new Date().toISOString(),
                                ageSec: 3,
                                stale: false,
                                summary: 'Equipo listo para operar en C1 fijo.',
                                latest: {
                                    deviceLabel: 'Operador C1 fijo',
                                    appMode: 'desktop',
                                    ageSec: 3,
                                    details: {
                                        station: 'c1',
                                        stationMode: 'locked',
                                        oneTap: false,
                                        numpadSeen: true,
                                    },
                                },
                                instances: [],
                            },
                            kiosk: {
                                surface: 'kiosk',
                                label: 'Kiosco',
                                status: 'unknown',
                                updatedAt: '',
                                ageSec: 0,
                                stale: true,
                                summary: 'Sin heartbeat',
                                latest: null,
                                instances: [],
                            },
                            display: {
                                surface: 'display',
                                label: 'Sala TV',
                                status: 'unknown',
                                updatedAt: '',
                                ageSec: 0,
                                stale: true,
                                summary: 'Sin heartbeat',
                                latest: null,
                                instances: [],
                            },
                        },
                    },
                });
            }

            return json(route, { ok: true, data: {} });
        });

        await page.goto('/admin.html#queue');
        await page.locator('a[href="#queue"]').last().click();

        await expect(
            page.locator('#queueDeskEscalationResolution')
        ).toBeVisible();
        await expect(
            page.locator('#queueDeskEscalationResolutionTitle')
        ).toContainText('Resolución devuelta');
        await expect(
            page.locator('#queueDeskEscalationResolutionPhrase_appointment')
        ).toContainText(
            'Operación ya cerró la validación con C1; seguimos con la salida confirmada y, si aparece un ajuste real, se lo avisamos aquí sin volver a prometer otra ventana.'
        );
        await expect(
            page.locator('#queueDeskEscalationResolutionPhrase_walkin')
        ).toContainText(
            'Operación ya cerró la validación con C1; seguimos con la salida confirmada y, si cambia algo real, se lo avisamos aquí sin reabrir la fila desde cero.'
        );
        await expect(
            page.locator('#queueDeskEscalationResolutionPhrase_rule')
        ).toContainText(
            'Cuando operación ya respondió, mostrador comunica la salida confirmada y cierra el caso. Solo se reabre si aparece una señal nueva, no por presión verbal.'
        );
        await expect(
            page.locator('#queueDeskEscalationResolutionOpen_walkin')
        ).toHaveAttribute('href', /operador-turnos\.html\?station=c1&lock=1/);
    });

    test('radar de espera prioriza cola general antigua y mueve el siguiente foco', async ({
        page,
    }) => {
        let queueTickets = [
            {
                id: 1301,
                ticketCode: 'A-1301',
                queueType: 'walk_in',
                patientInitials: 'MR',
                priorityClass: 'walk_in',
                status: 'waiting',
                assignedConsultorio: null,
                createdAt: new Date(Date.now() - 16 * 60 * 1000).toISOString(),
            },
            {
                id: 1302,
                ticketCode: 'A-1302',
                queueType: 'walk_in',
                patientInitials: 'QL',
                priorityClass: 'walk_in',
                status: 'waiting',
                assignedConsultorio: null,
                createdAt: new Date(Date.now() - 6 * 60 * 1000).toISOString(),
            },
        ];
        let queueState = buildQueueStateFromTickets(queueTickets);

        await installLegacyAdminAuthMock(page, {
            csrfToken: 'csrf_queue_wait_radar',
        });

        await page.route(/\/api\.php(\?.*)?$/i, async (route) => {
            const request = route.request();
            const url = new URL(request.url());
            const resource = url.searchParams.get('resource') || '';
            if (resource === 'features') {
                return json(route, {
                    ok: true,
                    data: { admin_sony_ui: ADMIN_UI_VARIANT === 'sony_v2' },
                });
            }

            if (resource === 'data') {
                return json(route, {
                    ok: true,
                    data: {
                        appointments: [],
                        callbacks: [],
                        reviews: [],
                        availability: {},
                        availabilityMeta: {
                            source: 'store',
                            mode: 'live',
                            timezone: 'America/Guayaquil',
                            calendarConfigured: true,
                            calendarReachable: true,
                            generatedAt: new Date().toISOString(),
                        },
                        queue_tickets: queueTickets,
                        queueMeta: buildQueueMetaFromState(queueState),
                        queueSurfaceStatus: {
                            operator: {
                                surface: 'operator',
                                label: 'Operador',
                                status: 'ready',
                                updatedAt: new Date().toISOString(),
                                ageSec: 5,
                                stale: false,
                                summary: 'Equipo listo para operar en C1 fijo.',
                                latest: {
                                    deviceLabel: 'Operador C1 fijo',
                                    appMode: 'desktop',
                                    ageSec: 5,
                                    details: {
                                        station: 'c1',
                                        stationMode: 'locked',
                                        oneTap: false,
                                        numpadSeen: true,
                                    },
                                },
                                instances: [],
                            },
                            kiosk: {
                                surface: 'kiosk',
                                label: 'Kiosco',
                                status: 'unknown',
                                updatedAt: '',
                                ageSec: 0,
                                stale: true,
                                summary: 'Sin heartbeat',
                                latest: null,
                                instances: [],
                            },
                            display: {
                                surface: 'display',
                                label: 'Sala TV',
                                status: 'unknown',
                                updatedAt: '',
                                ageSec: 0,
                                stale: true,
                                summary: 'Sin heartbeat',
                                latest: null,
                                instances: [],
                            },
                        },
                    },
                });
            }

            if (resource === 'queue-ticket' && request.method() === 'PATCH') {
                const body = JSON.parse(request.postData() || '{}');
                const ticketId = Number(body.id || 0);
                const consultorio = Number(body.consultorio || 0);
                queueTickets = queueTickets.map((ticket) =>
                    Number(ticket.id || 0) === ticketId
                        ? {
                              ...ticket,
                              assignedConsultorio: consultorio,
                          }
                        : ticket
                );
                queueState = buildQueueStateFromTickets(queueTickets);
                return json(route, {
                    ok: true,
                    data: {
                        ticket: queueTickets.find(
                            (ticket) => Number(ticket.id || 0) === ticketId
                        ),
                        queueState,
                    },
                });
            }

            if (resource === 'health') {
                return json(route, { ok: true, status: 'ok' });
            }

            if (resource === 'funnel-metrics') {
                return json(route, { ok: true, data: {} });
            }

            return json(route, { ok: true, data: {} });
        });

        await page.goto(adminUrl());
        await expect(page.locator('#adminDashboard')).toBeVisible();
        await page.locator('.nav-item[data-section="queue"]').click();
        await page.locator('#queueDomainOperations').dispatchEvent('click');
        await expect(page.locator('#queueAppsHub')).toHaveAttribute(
            'data-queue-domain',
            'operations'
        );

        await expect(page.locator('#queueWaitRadar')).toBeVisible();
        await expect(page.locator('#queueWaitRadarStatus')).toContainText(
            'en rojo'
        );
        await expect(
            page.locator('#queueWaitRadarHeadline_general')
        ).toContainText('A-1301');
        await expect(
            page.locator('#queueWaitRadarOldest_general')
        ).toContainText('A-1301');
        await expect(
            page.locator('#queueWaitRadarPrimary_general')
        ).toContainText('Asignar A-1301 a C1');

        await page.locator('#queueWaitRadarPrimary_general').click();

        await expect(
            page.locator('#queueWaitRadarOldest_general')
        ).toContainText('A-1302');
        await expect(page.locator('#queueWaitRadarPrimary_c1')).toContainText(
            'Llamar A-1301'
        );
        await expect(page.locator('#queueWaitRadarPressure_c1')).toContainText(
            'Propios 1'
        );
    });

    test('balance de carga detecta desvio y rebalancea entre consultorios', async ({
        page,
    }) => {
        let queueTickets = [
            {
                id: 1401,
                ticketCode: 'A-1401',
                queueType: 'walk_in',
                patientInitials: 'MR',
                priorityClass: 'walk_in',
                status: 'waiting',
                assignedConsultorio: 1,
                createdAt: new Date(Date.now() - 18 * 60 * 1000).toISOString(),
            },
            {
                id: 1402,
                ticketCode: 'A-1402',
                queueType: 'walk_in',
                patientInitials: 'QV',
                priorityClass: 'walk_in',
                status: 'waiting',
                assignedConsultorio: 1,
                createdAt: new Date(Date.now() - 11 * 60 * 1000).toISOString(),
            },
            {
                id: 1403,
                ticketCode: 'A-1403',
                queueType: 'appointment',
                patientInitials: 'LT',
                priorityClass: 'appt_overdue',
                status: 'waiting',
                assignedConsultorio: 1,
                createdAt: new Date(Date.now() - 5 * 60 * 1000).toISOString(),
            },
        ];
        let queueState = buildQueueStateFromTickets(queueTickets);

        await installLegacyAdminAuthMock(page, {
            csrfToken: 'csrf_queue_load_balance',
        });

        await page.route(/\/api\.php(\?.*)?$/i, async (route) => {
            const request = route.request();
            const url = new URL(request.url());
            const resource = url.searchParams.get('resource') || '';
            if (resource === 'features') {
                return json(route, {
                    ok: true,
                    data: { admin_sony_ui: ADMIN_UI_VARIANT === 'sony_v2' },
                });
            }

            if (resource === 'data') {
                return json(route, {
                    ok: true,
                    data: {
                        appointments: [],
                        callbacks: [],
                        reviews: [],
                        availability: {},
                        availabilityMeta: {
                            source: 'store',
                            mode: 'live',
                            timezone: 'America/Guayaquil',
                            calendarConfigured: true,
                            calendarReachable: true,
                            generatedAt: new Date().toISOString(),
                        },
                        queue_tickets: queueTickets,
                        queueMeta: buildQueueMetaFromState(queueState),
                        queueSurfaceStatus: {
                            operator: {
                                surface: 'operator',
                                label: 'Operador',
                                status: 'ready',
                                updatedAt: new Date().toISOString(),
                                ageSec: 4,
                                stale: false,
                                summary: 'Equipo listo para operar en C2 fijo.',
                                latest: {
                                    deviceLabel: 'Operador C2 fijo',
                                    appMode: 'desktop',
                                    ageSec: 4,
                                    details: {
                                        station: 'c2',
                                        stationMode: 'locked',
                                        oneTap: false,
                                        numpadSeen: true,
                                    },
                                },
                                instances: [],
                            },
                            kiosk: {
                                surface: 'kiosk',
                                label: 'Kiosco',
                                status: 'unknown',
                                updatedAt: '',
                                ageSec: 0,
                                stale: true,
                                summary: 'Sin heartbeat',
                                latest: null,
                                instances: [],
                            },
                            display: {
                                surface: 'display',
                                label: 'Sala TV',
                                status: 'unknown',
                                updatedAt: '',
                                ageSec: 0,
                                stale: true,
                                summary: 'Sin heartbeat',
                                latest: null,
                                instances: [],
                            },
                        },
                    },
                });
            }

            if (resource === 'queue-ticket' && request.method() === 'PATCH') {
                const body = JSON.parse(request.postData() || '{}');
                const ticketId = Number(body.id || 0);
                const consultorio = Number(body.consultorio || 0);
                queueTickets = queueTickets.map((ticket) =>
                    Number(ticket.id || 0) === ticketId
                        ? {
                              ...ticket,
                              assignedConsultorio: consultorio,
                          }
                        : ticket
                );
                queueState = buildQueueStateFromTickets(queueTickets);
                return json(route, {
                    ok: true,
                    data: {
                        ticket: queueTickets.find(
                            (ticket) => Number(ticket.id || 0) === ticketId
                        ),
                        queueState,
                    },
                });
            }

            if (resource === 'health') {
                return json(route, { ok: true, status: 'ok' });
            }

            if (resource === 'funnel-metrics') {
                return json(route, { ok: true, data: {} });
            }

            return json(route, { ok: true, data: {} });
        });

        await page.goto(adminUrl());
        await expect(page.locator('#adminDashboard')).toBeVisible();
        await page.locator('.nav-item[data-section="queue"]').click();

        await expect(page.locator('#queueLoadBalance')).toBeVisible();
        await expect(page.locator('#queueLoadBalanceStatus')).toContainText(
            'Gap 3'
        );
        await expect(
            page.locator('#queueLoadBalanceHeadline_c1')
        ).toContainText('absorbiendo de más');
        await expect(
            page.locator('#queueLoadBalanceCapacity_c1')
        ).toContainText('Ceder A-1402 a C2');
        await expect(page.locator('#queueLoadBalancePrimary_c1')).toContainText(
            'Mover A-1402 a C2'
        );

        await page.locator('#queueLoadBalancePrimary_c1').click();

        await expect(page.locator('#queueLoadBalanceStatus')).not.toContainText(
            'Gap 3'
        );
        await expect(page.locator('#queueLoadBalanceLoad_c2')).toContainText(
            'En cola 1'
        );
        await expect(page.locator('#queueLoadBalancePrimary_c2')).toContainText(
            'Llamar A-1402'
        );
    });

    test('fila priorizada convierte cola general en secuencia accionable', async ({
        page,
    }) => {
        let queueTickets = [
            {
                id: 1501,
                ticketCode: 'A-1501',
                queueType: 'appointment',
                patientInitials: 'NV',
                priorityClass: 'appt_overdue',
                status: 'waiting',
                assignedConsultorio: null,
                createdAt: new Date(Date.now() - 15 * 60 * 1000).toISOString(),
            },
            {
                id: 1502,
                ticketCode: 'A-1502',
                queueType: 'walk_in',
                patientInitials: 'QP',
                priorityClass: 'walk_in',
                status: 'waiting',
                assignedConsultorio: 2,
                createdAt: new Date(Date.now() - 9 * 60 * 1000).toISOString(),
            },
            {
                id: 1503,
                ticketCode: 'A-1503',
                queueType: 'walk_in',
                patientInitials: 'CR',
                priorityClass: 'walk_in',
                status: 'waiting',
                assignedConsultorio: null,
                createdAt: new Date(Date.now() - 3 * 60 * 1000).toISOString(),
            },
        ];
        let queueState = buildQueueStateFromTickets(queueTickets);

        await installLegacyAdminAuthMock(page, {
            csrfToken: 'csrf_queue_priority_lane',
        });

        await page.route(/\/api\.php(\?.*)?$/i, async (route) => {
            const request = route.request();
            const url = new URL(request.url());
            const resource = url.searchParams.get('resource') || '';
            if (resource === 'features') {
                return json(route, {
                    ok: true,
                    data: { admin_sony_ui: ADMIN_UI_VARIANT === 'sony_v2' },
                });
            }

            if (resource === 'data') {
                return json(route, {
                    ok: true,
                    data: {
                        appointments: [],
                        callbacks: [],
                        reviews: [],
                        availability: {},
                        availabilityMeta: {
                            source: 'store',
                            mode: 'live',
                            timezone: 'America/Guayaquil',
                            calendarConfigured: true,
                            calendarReachable: true,
                            generatedAt: new Date().toISOString(),
                        },
                        queue_tickets: queueTickets,
                        queueMeta: buildQueueMetaFromState(queueState),
                        queueSurfaceStatus: {
                            operator: {
                                surface: 'operator',
                                label: 'Operador',
                                status: 'ready',
                                updatedAt: new Date().toISOString(),
                                ageSec: 3,
                                stale: false,
                                summary: 'Equipo listo para operar en C1 fijo.',
                                latest: {
                                    deviceLabel: 'Operador C1 fijo',
                                    appMode: 'desktop',
                                    ageSec: 3,
                                    details: {
                                        station: 'c1',
                                        stationMode: 'locked',
                                        oneTap: false,
                                        numpadSeen: true,
                                    },
                                },
                                instances: [],
                            },
                            kiosk: {
                                surface: 'kiosk',
                                label: 'Kiosco',
                                status: 'unknown',
                                updatedAt: '',
                                ageSec: 0,
                                stale: true,
                                summary: 'Sin heartbeat',
                                latest: null,
                                instances: [],
                            },
                            display: {
                                surface: 'display',
                                label: 'Sala TV',
                                status: 'unknown',
                                updatedAt: '',
                                ageSec: 0,
                                stale: true,
                                summary: 'Sin heartbeat',
                                latest: null,
                                instances: [],
                            },
                        },
                    },
                });
            }

            if (resource === 'queue-ticket' && request.method() === 'PATCH') {
                const body = JSON.parse(request.postData() || '{}');
                const ticketId = Number(body.id || 0);
                const consultorio = Number(body.consultorio || 0);
                queueTickets = queueTickets.map((ticket) =>
                    Number(ticket.id || 0) === ticketId
                        ? {
                              ...ticket,
                              assignedConsultorio: consultorio,
                          }
                        : ticket
                );
                queueState = buildQueueStateFromTickets(queueTickets);
                return json(route, {
                    ok: true,
                    data: {
                        ticket: queueTickets.find(
                            (ticket) => Number(ticket.id || 0) === ticketId
                        ),
                        queueState,
                    },
                });
            }

            if (resource === 'health') {
                return json(route, { ok: true, status: 'ok' });
            }

            if (resource === 'funnel-metrics') {
                return json(route, { ok: true, data: {} });
            }

            return json(route, { ok: true, data: {} });
        });

        await page.goto(adminUrl());
        await expect(page.locator('#adminDashboard')).toBeVisible();
        await page.locator('.nav-item[data-section="queue"]').click();

        await expect(page.locator('#queuePriorityLane')).toBeVisible();
        await expect(page.locator('#queuePriorityLaneTitle')).toContainText(
            'Fila priorizada'
        );
        await expect(
            page.locator('#queuePriorityLaneHeadline_0')
        ).toContainText('A-1501');
        await expect(page.locator('#queuePriorityLaneMeta_0')).toContainText(
            'General'
        );
        await expect(
            page.locator('#queuePriorityLaneRecommendation_0')
        ).toContainText('Asignar A-1501 a C1');
        await expect(page.locator('#queuePriorityLanePrimary_0')).toContainText(
            'Asignar A-1501 a C1'
        );

        await page.locator('#queuePriorityLanePrimary_0').click();

        await expect(page.locator('#queuePriorityLaneMeta_0')).toContainText(
            'C1'
        );
        await expect(
            page.locator('#queuePriorityLaneRecommendation_0')
        ).toContainText('Llamar A-1501');
        await expect(page.locator('#queuePriorityLanePrimary_0')).toContainText(
            'Llamar A-1501'
        );
    });

    test('bandejas rápidas filtran la tabla desde el hub', async ({ page }) => {
        let queueTickets = [
            {
                id: 1601,
                ticketCode: 'A-1601',
                queueType: 'appointment',
                patientInitials: 'UR',
                priorityClass: 'appt_overdue',
                status: 'waiting',
                assignedConsultorio: null,
                createdAt: new Date(Date.now() - 25 * 60 * 1000).toISOString(),
            },
            {
                id: 1602,
                ticketCode: 'A-1602',
                queueType: 'walk_in',
                patientInitials: 'C1',
                priorityClass: 'walk_in',
                status: 'waiting',
                assignedConsultorio: 1,
                createdAt: new Date(Date.now() - 8 * 60 * 1000).toISOString(),
            },
            {
                id: 1603,
                ticketCode: 'A-1603',
                queueType: 'walk_in',
                patientInitials: 'C2',
                priorityClass: 'walk_in',
                status: 'waiting',
                assignedConsultorio: 2,
                createdAt: new Date(Date.now() - 6 * 60 * 1000).toISOString(),
            },
            {
                id: 1604,
                ticketCode: 'A-1604',
                queueType: 'appointment',
                patientInitials: 'LL',
                priorityClass: 'appointment',
                status: 'called',
                assignedConsultorio: 2,
                createdAt: new Date(Date.now() - 10 * 60 * 1000).toISOString(),
                calledAt: new Date(Date.now() - 2 * 60 * 1000).toISOString(),
            },
        ];
        let queueState = buildQueueStateFromTickets(queueTickets);

        await installLegacyAdminAuthMock(page, {
            csrfToken: 'csrf_queue_quick_trays',
        });

        await page.route(/\/api\.php(\?.*)?$/i, async (route) => {
            const request = route.request();
            const url = new URL(request.url());
            const resource = url.searchParams.get('resource') || '';
            if (resource === 'features') {
                return json(route, {
                    ok: true,
                    data: { admin_sony_ui: ADMIN_UI_VARIANT === 'sony_v2' },
                });
            }

            if (resource === 'data') {
                return json(route, {
                    ok: true,
                    data: {
                        appointments: [],
                        callbacks: [],
                        reviews: [],
                        availability: {},
                        availabilityMeta: {
                            source: 'store',
                            mode: 'live',
                            timezone: 'America/Guayaquil',
                            calendarConfigured: true,
                            calendarReachable: true,
                            generatedAt: new Date().toISOString(),
                        },
                        queue_tickets: queueTickets,
                        queueMeta: buildQueueMetaFromState(queueState),
                        queueSurfaceStatus: {
                            operator: {
                                surface: 'operator',
                                label: 'Operador',
                                status: 'ready',
                                updatedAt: new Date().toISOString(),
                                ageSec: 4,
                                stale: false,
                                summary: 'Equipo listo para operar en C1 fijo.',
                                latest: {
                                    deviceLabel: 'Operador C1 fijo',
                                    appMode: 'desktop',
                                    ageSec: 4,
                                    details: {
                                        station: 'c1',
                                        stationMode: 'locked',
                                        oneTap: false,
                                        numpadSeen: true,
                                    },
                                },
                                instances: [],
                            },
                            kiosk: {
                                surface: 'kiosk',
                                label: 'Kiosco',
                                status: 'unknown',
                                updatedAt: '',
                                ageSec: 0,
                                stale: true,
                                summary: 'Sin heartbeat',
                                latest: null,
                                instances: [],
                            },
                            display: {
                                surface: 'display',
                                label: 'Sala TV',
                                status: 'unknown',
                                updatedAt: '',
                                ageSec: 0,
                                stale: true,
                                summary: 'Sin heartbeat',
                                latest: null,
                                instances: [],
                            },
                        },
                    },
                });
            }

            if (resource === 'health') {
                return json(route, { ok: true, status: 'ok' });
            }

            if (resource === 'funnel-metrics') {
                return json(route, { ok: true, data: {} });
            }

            return json(route, { ok: true, data: {} });
        });

        await page.goto(adminUrl());
        await expect(page.locator('#adminDashboard')).toBeVisible();
        await page.locator('.nav-item[data-section="queue"]').click();

        await expect(page.locator('#queueQuickTrays')).toBeVisible();
        await expect(
            page.locator('#queueQuickTrayCount_waiting_unassigned')
        ).toContainText('1 ticket');
        await expect(page.locator('#queueQuickTrayCount_called')).toContainText(
            '1 ticket'
        );

        await page.locator('#queueQuickTrayAction_waiting_unassigned').click();

        await expect(
            page.locator('#queueQuickTray_waiting_unassigned')
        ).toHaveAttribute('data-active', 'true');
        await expect(page.locator('#queueTableBody')).toContainText('A-1601');
        await expect(page.locator('#queueTableBody')).not.toContainText(
            'A-1602'
        );
        await expect(page.locator('#queueTableBody')).not.toContainText(
            'A-1604'
        );

        await page.locator('#queueQuickTrayAction_called').click();

        await expect(page.locator('#queueQuickTray_called')).toHaveAttribute(
            'data-active',
            'true'
        );
        await expect(page.locator('#queueTableBody')).toContainText('A-1604');
        await expect(page.locator('#queueTableBody')).not.toContainText(
            'A-1601'
        );
    });

    test('bandeja activa propone siguiente paso y permite limpiar contexto', async ({
        page,
    }) => {
        let queueTickets = [
            {
                id: 1701,
                ticketCode: 'A-1701',
                queueType: 'appointment',
                patientInitials: 'SC',
                priorityClass: 'appt_overdue',
                status: 'waiting',
                assignedConsultorio: null,
                createdAt: new Date(Date.now() - 22 * 60 * 1000).toISOString(),
            },
        ];
        let queueState = buildQueueStateFromTickets(queueTickets);

        await installLegacyAdminAuthMock(page, {
            csrfToken: 'csrf_queue_active_tray',
        });

        await page.route(/\/api\.php(\?.*)?$/i, async (route) => {
            const request = route.request();
            const url = new URL(request.url());
            const resource = url.searchParams.get('resource') || '';
            if (resource === 'features') {
                return json(route, {
                    ok: true,
                    data: { admin_sony_ui: ADMIN_UI_VARIANT === 'sony_v2' },
                });
            }

            if (resource === 'data') {
                return json(route, {
                    ok: true,
                    data: {
                        appointments: [],
                        callbacks: [],
                        reviews: [],
                        availability: {},
                        availabilityMeta: {
                            source: 'store',
                            mode: 'live',
                            timezone: 'America/Guayaquil',
                            calendarConfigured: true,
                            calendarReachable: true,
                            generatedAt: new Date().toISOString(),
                        },
                        queue_tickets: queueTickets,
                        queueMeta: buildQueueMetaFromState(queueState),
                        queueSurfaceStatus: {
                            operator: {
                                surface: 'operator',
                                label: 'Operador',
                                status: 'ready',
                                updatedAt: new Date().toISOString(),
                                ageSec: 4,
                                stale: false,
                                summary: 'Equipo listo para operar en C1 fijo.',
                                latest: {
                                    deviceLabel: 'Operador C1 fijo',
                                    appMode: 'desktop',
                                    ageSec: 4,
                                    details: {
                                        station: 'c1',
                                        stationMode: 'locked',
                                        oneTap: false,
                                        numpadSeen: true,
                                    },
                                },
                                instances: [],
                            },
                            kiosk: {
                                surface: 'kiosk',
                                label: 'Kiosco',
                                status: 'unknown',
                                updatedAt: '',
                                ageSec: 0,
                                stale: true,
                                summary: 'Sin heartbeat',
                                latest: null,
                                instances: [],
                            },
                            display: {
                                surface: 'display',
                                label: 'Sala TV',
                                status: 'unknown',
                                updatedAt: '',
                                ageSec: 0,
                                stale: true,
                                summary: 'Sin heartbeat',
                                latest: null,
                                instances: [],
                            },
                        },
                    },
                });
            }

            if (resource === 'queue-ticket' && request.method() === 'PATCH') {
                const body = JSON.parse(request.postData() || '{}');
                const ticketId = Number(body.id || 0);
                const consultorio = Number(body.consultorio || 0);
                queueTickets = queueTickets.map((ticket) =>
                    Number(ticket.id || 0) === ticketId
                        ? {
                              ...ticket,
                              assignedConsultorio: consultorio,
                          }
                        : ticket
                );
                queueState = buildQueueStateFromTickets(queueTickets);
                return json(route, {
                    ok: true,
                    data: {
                        ticket: queueTickets.find(
                            (ticket) => Number(ticket.id || 0) === ticketId
                        ),
                        queueState,
                    },
                });
            }

            if (resource === 'health') {
                return json(route, { ok: true, status: 'ok' });
            }

            if (resource === 'funnel-metrics') {
                return json(route, { ok: true, data: {} });
            }

            return json(route, { ok: true, data: {} });
        });

        await page.goto(adminUrl());
        await expect(page.locator('#adminDashboard')).toBeVisible();
        await page.locator('.nav-item[data-section="queue"]').click();

        await page.locator('#queueQuickTrayAction_waiting_unassigned').click();

        await expect(page.locator('#queueActiveTray')).toBeVisible();
        await expect(page.locator('#queueActiveTrayTitle')).toContainText(
            'Sin consultorio'
        );
        await expect(page.locator('#queueActiveTrayStatus')).toContainText(
            '1 visible'
        );
        await expect(page.locator('#queueActiveTrayHeadline_0')).toContainText(
            'A-1701'
        );
        await expect(
            page.locator('#queueActiveTrayRecommendation_0')
        ).toContainText('Asignar A-1701 a C1');

        await page.locator('#queueActiveTrayPrimary_0').click();

        await expect(page.locator('#queueActiveTrayStatus')).toContainText(
            '0 visible'
        );
        await expect(page.locator('#queueActiveTrayEmpty')).toContainText(
            'Sin tickets visibles'
        );

        await page.locator('#queueActiveTrayResetBtn').click();

        await expect(page.locator('#queueActiveTrayTitle')).toContainText(
            'tabla completa'
        );
        await expect(page.locator('#queueActiveTrayStatus')).toContainText(
            'Sin filtro activo'
        );
    });

    test('rafaga operativa encadena asignar y llamar desde sin consultorio', async ({
        page,
    }) => {
        let queueCallNextRequests = [];
        let queueTickets = [
            {
                id: 1751,
                ticketCode: 'A-1751',
                queueType: 'appointment',
                patientInitials: 'RF',
                priorityClass: 'appt_overdue',
                status: 'waiting',
                assignedConsultorio: null,
                createdAt: new Date(Date.now() - 19 * 60 * 1000).toISOString(),
            },
        ];
        let queueState = buildQueueStateFromTickets(queueTickets);

        await installLegacyAdminAuthMock(page, {
            csrfToken: 'csrf_queue_tray_burst',
        });

        await page.route(/\/api\.php(\?.*)?$/i, async (route) => {
            const request = route.request();
            const url = new URL(request.url());
            const resource = url.searchParams.get('resource') || '';
            if (resource === 'features') {
                return json(route, {
                    ok: true,
                    data: { admin_sony_ui: ADMIN_UI_VARIANT === 'sony_v2' },
                });
            }

            if (resource === 'data') {
                return json(route, {
                    ok: true,
                    data: {
                        appointments: [],
                        callbacks: [],
                        reviews: [],
                        availability: {},
                        availabilityMeta: {
                            source: 'store',
                            mode: 'live',
                            timezone: 'America/Guayaquil',
                            calendarConfigured: true,
                            calendarReachable: true,
                            generatedAt: new Date().toISOString(),
                        },
                        queue_tickets: queueTickets,
                        queueMeta: buildQueueMetaFromState(queueState),
                        queueSurfaceStatus: {
                            operator: {
                                surface: 'operator',
                                label: 'Operador',
                                status: 'ready',
                                updatedAt: new Date().toISOString(),
                                ageSec: 4,
                                stale: false,
                                summary: 'Equipo listo para operar en C1 fijo.',
                                latest: {
                                    deviceLabel: 'Operador C1 fijo',
                                    appMode: 'desktop',
                                    ageSec: 4,
                                    details: {
                                        station: 'c1',
                                        stationMode: 'locked',
                                        oneTap: false,
                                        numpadSeen: true,
                                    },
                                },
                                instances: [],
                            },
                            kiosk: {
                                surface: 'kiosk',
                                label: 'Kiosco',
                                status: 'unknown',
                                updatedAt: '',
                                ageSec: 0,
                                stale: true,
                                summary: 'Sin heartbeat',
                                latest: null,
                                instances: [],
                            },
                            display: {
                                surface: 'display',
                                label: 'Sala TV',
                                status: 'unknown',
                                updatedAt: '',
                                ageSec: 0,
                                stale: true,
                                summary: 'Sin heartbeat',
                                latest: null,
                                instances: [],
                            },
                        },
                    },
                });
            }

            if (resource === 'queue-ticket' && request.method() === 'PATCH') {
                const body = JSON.parse(request.postData() || '{}');
                const ticketId = Number(body.id || 0);
                const consultorio = Number(body.consultorio || 0);
                queueTickets = queueTickets.map((ticket) =>
                    Number(ticket.id || 0) === ticketId
                        ? {
                              ...ticket,
                              assignedConsultorio: consultorio,
                          }
                        : ticket
                );
                queueState = buildQueueStateFromTickets(queueTickets);
                return json(route, {
                    ok: true,
                    data: {
                        ticket: queueTickets.find(
                            (ticket) => Number(ticket.id || 0) === ticketId
                        ),
                        queueState,
                    },
                });
            }

            if (resource === 'queue-call-next' && request.method() === 'POST') {
                const body = JSON.parse(request.postData() || '{}');
                const consultorio = Number(body.consultorio || 0);
                queueCallNextRequests.push(consultorio);
                const candidate = queueTickets.find(
                    (ticket) =>
                        ticket.status === 'waiting' &&
                        Number(ticket.assignedConsultorio || 0) === consultorio
                );
                if (!candidate) {
                    return json(
                        route,
                        { ok: false, error: 'Sin turnos en espera' },
                        409
                    );
                }
                queueTickets = queueTickets.map((ticket) =>
                    Number(ticket.id || 0) === Number(candidate.id || 0)
                        ? {
                              ...ticket,
                              status: 'called',
                              assignedConsultorio: consultorio,
                              calledAt: new Date().toISOString(),
                          }
                        : ticket
                );
                queueState = buildQueueStateFromTickets(queueTickets);
                return json(route, {
                    ok: true,
                    data: {
                        ticket: queueTickets.find(
                            (ticket) =>
                                Number(ticket.id || 0) ===
                                Number(candidate.id || 0)
                        ),
                        queueState,
                    },
                });
            }

            if (resource === 'health') {
                return json(route, { ok: true, status: 'ok' });
            }

            if (resource === 'funnel-metrics') {
                return json(route, { ok: true, data: {} });
            }

            return json(route, { ok: true, data: {} });
        });

        await page.goto(adminUrl());
        await expect(page.locator('#adminDashboard')).toBeVisible();
        await page.locator('.nav-item[data-section="queue"]').click();

        await page.locator('#queueQuickTrayAction_waiting_unassigned').click();

        await expect(page.locator('#queueTrayBurst')).toBeVisible();
        await expect(page.locator('#queueTrayBurstTitle')).toContainText(
            'Sin consultorio'
        );
        await expect(page.locator('#queueTrayBurstStatus')).toContainText(
            '2 paso'
        );
        await expect(page.locator('#queueTrayBurstStepTitle_0')).toContainText(
            'Asignar A-1751 a C1'
        );
        await expect(page.locator('#queueTrayBurstStepTitle_1')).toContainText(
            'Llamar A-1751 en C1'
        );

        await page.locator('#queueTrayBurstRunBtn').click();

        await expect.poll(() => queueCallNextRequests).toEqual([1]);
        await expect(page.locator('#queueActiveTrayStatus')).toContainText(
            '0 visible'
        );
        await expect(page.locator('#queueTrayBurstStatus')).toContainText(
            'Bandeja vacía'
        );
        await expect.poll(() => queueTickets[0]?.status).toBe('called');
        await expect.poll(() => queueTickets[0]?.assignedConsultorio).toBe(1);

        await page.locator('#queueQuickTrayAction_called').click();
        await expect(page.locator('#queueTableBody')).toContainText('A-1751');
        await expect(page.locator('#queueTableBody')).toContainText('C1');
        await expect(page.locator('#queueTableBody')).toContainText('Llamado');
    });

    test('numpad por estacion provisionada mantiene lock y persiste tras recarga', async ({
        page,
    }) => {
        let queueCallNextRequests = [];
        let queueTickets = [
            {
                id: 1101,
                ticketCode: 'A-1101',
                queueType: 'appointment',
                patientInitials: 'ES',
                priorityClass: 'appt_overdue',
                status: 'waiting',
                assignedConsultorio: null,
                createdAt: new Date(Date.now() - 9 * 60 * 1000).toISOString(),
            },
            {
                id: 1102,
                ticketCode: 'A-1102',
                queueType: 'walk_in',
                patientInitials: 'PL',
                priorityClass: 'walk_in',
                status: 'waiting',
                assignedConsultorio: null,
                createdAt: new Date(Date.now() - 4 * 60 * 1000).toISOString(),
            },
        ];
        let queueState = buildQueueStateFromTickets(queueTickets);

        await installLegacyAdminAuthMock(page, {
            csrfToken: 'csrf_queue_station_c2',
        });

        await page.route(/\/api\.php(\?.*)?$/i, async (route) => {
            const request = route.request();
            const url = new URL(request.url());
            const resource = url.searchParams.get('resource') || '';
            if (resource === 'features') {
                return json(route, {
                    ok: true,
                    data: { admin_sony_ui: ADMIN_UI_VARIANT === 'sony_v2' },
                });
            }

            if (resource === 'data') {
                return json(route, {
                    ok: true,
                    data: {
                        appointments: [],
                        callbacks: [],
                        reviews: [],
                        availability: {},
                        availabilityMeta: {
                            source: 'store',
                            mode: 'live',
                            timezone: 'America/Guayaquil',
                            calendarConfigured: true,
                            calendarReachable: true,
                            generatedAt: new Date().toISOString(),
                        },
                        queue_tickets: queueTickets,
                        queueMeta: buildQueueMetaFromState(queueState),
                    },
                });
            }

            if (resource === 'queue-call-next' && request.method() === 'POST') {
                const body = JSON.parse(request.postData() || '{}');
                const consultorio = Number(body.consultorio || 0);
                queueCallNextRequests.push(consultorio);
                const candidate = queueTickets.find(
                    (ticket) => ticket.status === 'waiting'
                );
                if (!candidate) {
                    return json(
                        route,
                        { ok: false, error: 'Sin turnos en espera' },
                        409
                    );
                }

                queueTickets = queueTickets.map((ticket) =>
                    ticket.id === candidate.id
                        ? {
                              ...ticket,
                              status: 'called',
                              assignedConsultorio: consultorio,
                              calledAt: new Date().toISOString(),
                          }
                        : ticket
                );
                queueState = buildQueueStateFromTickets(queueTickets);

                return json(route, {
                    ok: true,
                    data: {
                        ticket: queueTickets.find(
                            (ticket) => ticket.id === candidate.id
                        ),
                        queueState,
                    },
                });
            }

            if (resource === 'health') {
                return json(route, { ok: true, status: 'ok' });
            }

            if (resource === 'funnel-metrics') {
                return json(route, { ok: true, data: {} });
            }

            return json(route, { ok: true, data: {} });
        });

        await page.goto(adminUrl('station=c2&lock=1'));
        await expect(page.locator('#adminDashboard')).toBeVisible();
        await page.locator('.nav-item[data-section="queue"]').click();
        await expect(page.locator('#queue')).toHaveClass(/active/);
        await expect(page.locator('#queueStationBadge')).toContainText(
            'Estación C2'
        );
        await expect(page.locator('#queueStationModeBadge')).toContainText(
            'Bloqueado'
        );

        await page.keyboard.press('Enter');
        await expect.poll(() => queueCallNextRequests.length).toBe(0);

        await page.keyboard.press('NumpadEnter');
        await expect.poll(() => queueCallNextRequests.length).toBe(1);
        await expect.poll(() => queueCallNextRequests[0]).toBe(2);

        await page.reload();
        await expect(page.locator('#adminDashboard')).toBeVisible();
        await page.locator('.nav-item[data-section="queue"]').click();
        await expect(page.locator('#queue')).toHaveClass(/active/);
        await expect(page.locator('#queueStationBadge')).toContainText(
            'Estación C2'
        );
        await expect(page.locator('#queueStationModeBadge')).toContainText(
            'Bloqueado'
        );

        await page.keyboard.press('NumpadEnter');
        await expect.poll(() => queueCallNextRequests.length).toBe(2);
        await expect.poll(() => queueCallNextRequests[1]).toBe(2);
    });

    test('lock de estacion bloquea cambio por numpad y evita llamado con foco en input', async ({
        page,
    }) => {
        let queueCallNextRequests = [];
        let queueTickets = [
            {
                id: 1111,
                ticketCode: 'A-1111',
                queueType: 'appointment',
                patientInitials: 'NM',
                priorityClass: 'appt_current',
                status: 'waiting',
                assignedConsultorio: null,
                createdAt: new Date(Date.now() - 5 * 60 * 1000).toISOString(),
            },
        ];
        let queueState = buildQueueStateFromTickets(queueTickets);

        await installLegacyAdminAuthMock(page, {
            csrfToken: 'csrf_queue_station_c1',
        });

        await page.route(/\/api\.php(\?.*)?$/i, async (route) => {
            const request = route.request();
            const url = new URL(request.url());
            const resource = url.searchParams.get('resource') || '';
            if (resource === 'features') {
                return json(route, {
                    ok: true,
                    data: { admin_sony_ui: ADMIN_UI_VARIANT === 'sony_v2' },
                });
            }

            if (resource === 'data') {
                return json(route, {
                    ok: true,
                    data: {
                        appointments: [],
                        callbacks: [],
                        reviews: [],
                        availability: {},
                        availabilityMeta: {
                            source: 'store',
                            mode: 'live',
                            timezone: 'America/Guayaquil',
                            calendarConfigured: true,
                            calendarReachable: true,
                            generatedAt: new Date().toISOString(),
                        },
                        queue_tickets: queueTickets,
                        queueMeta: buildQueueMetaFromState(queueState),
                    },
                });
            }

            if (resource === 'queue-call-next' && request.method() === 'POST') {
                const body = JSON.parse(request.postData() || '{}');
                const consultorio = Number(body.consultorio || 0);
                queueCallNextRequests.push(consultorio);
                queueTickets = queueTickets.map((ticket) => ({
                    ...ticket,
                    status: 'called',
                    assignedConsultorio: consultorio,
                    calledAt: new Date().toISOString(),
                }));
                queueState = buildQueueStateFromTickets(queueTickets);
                return json(route, {
                    ok: true,
                    data: {
                        ticket: queueTickets[0],
                        queueState,
                    },
                });
            }

            if (resource === 'health') {
                return json(route, { ok: true, status: 'ok' });
            }

            if (resource === 'funnel-metrics') {
                return json(route, { ok: true, data: {} });
            }

            return json(route, { ok: true, data: {} });
        });

        await page.goto(adminUrl('station=c1&lock=1'));
        await expect(page.locator('#adminDashboard')).toBeVisible();
        await page.locator('.nav-item[data-section="queue"]').click();
        await expect(page.locator('#queue')).toHaveClass(/active/);
        await expect(page.locator('#queueStationBadge')).toContainText(
            'Estación C1'
        );
        await expect(page.locator('#queueStationModeBadge')).toContainText(
            'Bloqueado'
        );

        await page.keyboard.press('Numpad2');
        await expect(page.locator('#queueStationBadge')).toContainText(
            'Estación C1'
        );
        await expect(page.locator('#toastContainer')).toContainText(
            'Cambio bloqueado por modo estación'
        );

        await page.keyboard.press('NumpadEnter');
        await expect.poll(() => queueCallNextRequests.length).toBe(1);
        await expect.poll(() => queueCallNextRequests[0]).toBe(1);

        await page.locator('#queueSearchInput').focus();
        await page.keyboard.press('NumpadEnter');
        await expect.poll(() => queueCallNextRequests.length).toBe(1);
    });

    test('modo 1 tecla provisionado completa ticket activo y llama siguiente en consultorio bloqueado', async ({
        page,
    }) => {
        const queueCallNextRequests = [];
        const queueTicketActions = [];
        let queueTickets = [
            {
                id: 1501,
                ticketCode: 'A-1501',
                queueType: 'appointment',
                patientInitials: 'AA',
                priorityClass: 'appt_current',
                status: 'called',
                assignedConsultorio: 2,
                calledAt: new Date(Date.now() - 2 * 60 * 1000).toISOString(),
                createdAt: new Date(Date.now() - 8 * 60 * 1000).toISOString(),
            },
            {
                id: 1502,
                ticketCode: 'A-1502',
                queueType: 'walk_in',
                patientInitials: 'BB',
                priorityClass: 'walk_in',
                status: 'waiting',
                assignedConsultorio: null,
                createdAt: new Date(Date.now() - 4 * 60 * 1000).toISOString(),
            },
        ];
        let queueState = buildQueueStateFromTickets(queueTickets);

        await installLegacyAdminAuthMock(page, {
            csrfToken: 'csrf_queue_one_tap_c2',
        });

        await page.route(/\/api\.php(\?.*)?$/i, async (route) => {
            const request = route.request();
            const url = new URL(request.url());
            const resource = url.searchParams.get('resource') || '';
            if (resource === 'features') {
                return json(route, {
                    ok: true,
                    data: { admin_sony_ui: ADMIN_UI_VARIANT === 'sony_v2' },
                });
            }

            if (resource === 'data') {
                return json(route, {
                    ok: true,
                    data: {
                        appointments: [],
                        callbacks: [],
                        reviews: [],
                        availability: {},
                        availabilityMeta: {
                            source: 'store',
                            mode: 'live',
                            timezone: 'America/Guayaquil',
                            calendarConfigured: true,
                            calendarReachable: true,
                            generatedAt: new Date().toISOString(),
                        },
                        queue_tickets: queueTickets,
                        queueMeta: buildQueueMetaFromState(queueState),
                    },
                });
            }

            if (resource === 'queue-ticket' && request.method() === 'PATCH') {
                const body = JSON.parse(request.postData() || '{}');
                const ticketId = Number(body.id || 0);
                const action = String(body.action || '').toLowerCase();
                const consultorio = Number(body.consultorio || 0);
                queueTicketActions.push({ ticketId, action, consultorio });

                const ticketIndex = queueTickets.findIndex(
                    (ticket) => Number(ticket.id || 0) === ticketId
                );
                if (ticketIndex < 0) {
                    return json(
                        route,
                        { ok: false, error: 'Ticket no encontrado' },
                        404
                    );
                }

                const nowIso = new Date().toISOString();
                const updatedTicket = {
                    ...queueTickets[ticketIndex],
                    status: 'completed',
                    assignedConsultorio: null,
                    completedAt: nowIso,
                };
                queueTickets = queueTickets.map((ticket, index) =>
                    index === ticketIndex ? updatedTicket : ticket
                );
                queueState = buildQueueStateFromTickets(queueTickets);

                return json(route, {
                    ok: true,
                    data: {
                        ticket: updatedTicket,
                        queueState,
                    },
                });
            }

            if (resource === 'queue-call-next' && request.method() === 'POST') {
                const body = JSON.parse(request.postData() || '{}');
                const consultorio = Number(body.consultorio || 0);
                queueCallNextRequests.push(consultorio);

                const candidate = queueTickets.find(
                    (ticket) => ticket.status === 'waiting'
                );
                if (!candidate) {
                    return json(route, {
                        ok: true,
                        data: {
                            ticket: null,
                            queueState,
                        },
                    });
                }

                const nowIso = new Date().toISOString();
                queueTickets = queueTickets.map((ticket) =>
                    ticket.id === candidate.id
                        ? {
                              ...ticket,
                              status: 'called',
                              assignedConsultorio: consultorio,
                              calledAt: nowIso,
                          }
                        : ticket
                );
                queueState = buildQueueStateFromTickets(queueTickets);
                return json(route, {
                    ok: true,
                    data: {
                        ticket: queueTickets.find(
                            (ticket) => ticket.id === candidate.id
                        ),
                        queueState,
                    },
                });
            }

            if (resource === 'health') {
                return json(route, { ok: true, status: 'ok' });
            }

            if (resource === 'funnel-metrics') {
                return json(route, { ok: true, data: {} });
            }

            return json(route, { ok: true, data: {} });
        });

        await page.goto(adminUrl('station=c2&lock=1&one_tap=1'));
        await expect(page.locator('#adminDashboard')).toBeVisible();
        await page.locator('.nav-item[data-section="queue"]').click();
        await expect(page.locator('#queue')).toHaveClass(/active/);
        await expect(page.locator('#queueStationBadge')).toContainText(
            'Estación C2'
        );
        await expect(page.locator('#queueStationModeBadge')).toContainText(
            'Bloqueado'
        );
        await expect(
            page.locator('[data-action="queue-toggle-one-tap"]')
        ).toContainText('ON');

        await page.keyboard.press('NumpadEnter');
        await expect.poll(() => queueTicketActions.length).toBe(1);
        await expect.poll(() => queueTicketActions[0]?.ticketId).toBe(1501);
        await expect
            .poll(() => queueTicketActions[0]?.action)
            .toBe('completar');
        await expect.poll(() => queueTicketActions[0]?.consultorio).toBe(2);
        await expect.poll(() => queueCallNextRequests.length).toBe(1);
        await expect.poll(() => queueCallNextRequests[0]).toBe(2);
        await page.waitForTimeout(50);
        await expect(page.locator('#queueC2Now')).toContainText('A-1502');

        await page.reload();
        await expect(page.locator('#adminDashboard')).toBeVisible();
        await page.locator('.nav-item[data-section="queue"]').click();
        await expect(page.locator('#queue')).toHaveClass(/active/);
        await expect(
            page.locator('[data-action="queue-toggle-one-tap"]')
        ).toContainText('ON');
    });

    test('modo 1 tecla sin ticket activo solo llama siguiente (sin completar)', async ({
        page,
    }) => {
        const queueCallNextRequests = [];
        const queueTicketActions = [];
        let queueTickets = [
            {
                id: 1511,
                ticketCode: 'A-1511',
                queueType: 'walk_in',
                patientInitials: 'ZX',
                priorityClass: 'walk_in',
                status: 'waiting',
                assignedConsultorio: null,
                createdAt: new Date(Date.now() - 3 * 60 * 1000).toISOString(),
            },
        ];
        let queueState = buildQueueStateFromTickets(queueTickets);

        await installLegacyAdminAuthMock(page, {
            csrfToken: 'csrf_queue_one_tap_only_call',
        });

        await page.route(/\/api\.php(\?.*)?$/i, async (route) => {
            const request = route.request();
            const url = new URL(request.url());
            const resource = url.searchParams.get('resource') || '';
            if (resource === 'features') {
                return json(route, {
                    ok: true,
                    data: { admin_sony_ui: ADMIN_UI_VARIANT === 'sony_v2' },
                });
            }

            if (resource === 'data') {
                return json(route, {
                    ok: true,
                    data: {
                        appointments: [],
                        callbacks: [],
                        reviews: [],
                        availability: {},
                        availabilityMeta: {
                            source: 'store',
                            mode: 'live',
                            timezone: 'America/Guayaquil',
                            calendarConfigured: true,
                            calendarReachable: true,
                            generatedAt: new Date().toISOString(),
                        },
                        queue_tickets: queueTickets,
                        queueMeta: buildQueueMetaFromState(queueState),
                    },
                });
            }

            if (resource === 'queue-ticket' && request.method() === 'PATCH') {
                queueTicketActions.push(JSON.parse(request.postData() || '{}'));
                return json(route, { ok: false, error: 'No esperado' }, 500);
            }

            if (resource === 'queue-call-next' && request.method() === 'POST') {
                const body = JSON.parse(request.postData() || '{}');
                const consultorio = Number(body.consultorio || 0);
                queueCallNextRequests.push(consultorio);

                const candidate = queueTickets.find(
                    (ticket) => ticket.status === 'waiting'
                );
                if (!candidate) {
                    return json(
                        route,
                        { ok: false, error: 'Sin turnos en espera' },
                        409
                    );
                }

                const nowIso = new Date().toISOString();
                queueTickets = queueTickets.map((ticket) =>
                    ticket.id === candidate.id
                        ? {
                              ...ticket,
                              status: 'called',
                              assignedConsultorio: consultorio,
                              calledAt: nowIso,
                          }
                        : ticket
                );
                queueState = buildQueueStateFromTickets(queueTickets);
                return json(route, {
                    ok: true,
                    data: {
                        ticket: queueTickets.find(
                            (ticket) => ticket.id === candidate.id
                        ),
                        queueState,
                    },
                });
            }

            if (resource === 'health') {
                return json(route, { ok: true, status: 'ok' });
            }

            if (resource === 'funnel-metrics') {
                return json(route, { ok: true, data: {} });
            }

            return json(route, { ok: true, data: {} });
        });

        await page.goto(adminUrl('station=c1&lock=1&one_tap=1'));
        await expect(page.locator('#adminDashboard')).toBeVisible();
        await page.locator('.nav-item[data-section="queue"]').click();
        await expect(page.locator('#queue')).toHaveClass(/active/);
        await expect(
            page.locator('[data-action="queue-toggle-one-tap"]')
        ).toContainText('ON');

        await page.keyboard.press('NumpadEnter');
        await expect.poll(() => queueTicketActions.length).toBe(0);
        await expect.poll(() => queueCallNextRequests.length).toBe(1);
        await expect.poll(() => queueCallNextRequests[0]).toBe(1);
        await expect(page.locator('#queueC1Now')).toContainText('A-1511');
    });

    test('modo bloqueado impide llamado del consultorio opuesto', async ({
        page,
    }) => {
        const queueCallNextRequests = [];
        let queueTickets = [
            {
                id: 1191,
                ticketCode: 'A-1191',
                queueType: 'walk_in',
                patientInitials: 'OV',
                priorityClass: 'walk_in',
                status: 'waiting',
                assignedConsultorio: null,
                createdAt: new Date(Date.now() - 6 * 60 * 1000).toISOString(),
            },
        ];
        let queueState = buildQueueStateFromTickets(queueTickets);

        await installLegacyAdminAuthMock(page, {
            csrfToken: 'csrf_queue_station_override',
        });

        await page.route(/\/api\.php(\?.*)?$/i, async (route) => {
            const request = route.request();
            const url = new URL(request.url());
            const resource = url.searchParams.get('resource') || '';
            if (resource === 'features') {
                return json(route, {
                    ok: true,
                    data: { admin_sony_ui: ADMIN_UI_VARIANT === 'sony_v2' },
                });
            }

            if (resource === 'data') {
                return json(route, {
                    ok: true,
                    data: {
                        appointments: [],
                        callbacks: [],
                        reviews: [],
                        availability: {},
                        availabilityMeta: {
                            source: 'store',
                            mode: 'live',
                            timezone: 'America/Guayaquil',
                            calendarConfigured: true,
                            calendarReachable: true,
                            generatedAt: new Date().toISOString(),
                        },
                        queue_tickets: queueTickets,
                        queueMeta: buildQueueMetaFromState(queueState),
                    },
                });
            }

            if (resource === 'queue-call-next' && request.method() === 'POST') {
                const body = JSON.parse(request.postData() || '{}');
                const consultorio = Number(body.consultorio || 0);
                queueCallNextRequests.push(consultorio);
                queueTickets = queueTickets.map((ticket) => ({
                    ...ticket,
                    status: 'called',
                    assignedConsultorio: consultorio,
                    calledAt: new Date().toISOString(),
                }));
                queueState = buildQueueStateFromTickets(queueTickets);
                return json(route, {
                    ok: true,
                    data: {
                        ticket: queueTickets[0],
                        queueState,
                    },
                });
            }

            if (resource === 'health') {
                return json(route, { ok: true, status: 'ok' });
            }

            if (resource === 'funnel-metrics') {
                return json(route, { ok: true, data: {} });
            }

            return json(route, { ok: true, data: {} });
        });

        await page.goto(adminUrl('station=c2&lock=1'));
        await expect(page.locator('#adminDashboard')).toBeVisible();
        await page.locator('.nav-item[data-section="queue"]').click();
        await expect(page.locator('#queue')).toHaveClass(/active/);
        await expect(page.locator('#queueStationBadge')).toContainText(
            'Estación C2'
        );
        await expect(page.locator('#queueStationModeBadge')).toContainText(
            'Bloqueado'
        );

        await expect(
            page
                .locator(
                    '#queue .queue-admin-header-actions [data-action="queue-call-next"][data-queue-consultorio="1"]'
                )
                .first()
        ).toBeDisabled();
        await expect.poll(() => queueCallNextRequests.length).toBe(0);
    });

    test('panel de ayuda se abre/cierra con atajo 0 y numpad + re-llama ticket activo en la estacion', async ({
        page,
    }) => {
        const queueTicketActions = [];
        let queueTickets = [
            {
                id: 1291,
                ticketCode: 'A-1291',
                queueType: 'appointment',
                patientInitials: 'RT',
                priorityClass: 'appt_current',
                status: 'called',
                assignedConsultorio: 1,
                calledAt: new Date(Date.now() - 90 * 1000).toISOString(),
                createdAt: new Date(Date.now() - 9 * 60 * 1000).toISOString(),
            },
            {
                id: 1292,
                ticketCode: 'A-1292',
                queueType: 'walk_in',
                patientInitials: 'PQ',
                priorityClass: 'walk_in',
                status: 'waiting',
                assignedConsultorio: null,
                createdAt: new Date(Date.now() - 4 * 60 * 1000).toISOString(),
            },
        ];
        let queueState = buildQueueStateFromTickets(queueTickets);

        await installLegacyAdminAuthMock(page, {
            csrfToken: 'csrf_queue_numpad_star_help',
        });

        await page.route(/\/api\.php(\?.*)?$/i, async (route) => {
            const request = route.request();
            const url = new URL(request.url());
            const resource = url.searchParams.get('resource') || '';
            if (resource === 'features') {
                return json(route, {
                    ok: true,
                    data: { admin_sony_ui: ADMIN_UI_VARIANT === 'sony_v2' },
                });
            }

            if (resource === 'data') {
                return json(route, {
                    ok: true,
                    data: {
                        appointments: [],
                        callbacks: [],
                        reviews: [],
                        availability: {},
                        availabilityMeta: {
                            source: 'store',
                            mode: 'live',
                            timezone: 'America/Guayaquil',
                            calendarConfigured: true,
                            calendarReachable: true,
                            generatedAt: new Date().toISOString(),
                        },
                        queue_tickets: queueTickets,
                        queueMeta: buildQueueMetaFromState(queueState),
                    },
                });
            }

            if (resource === 'queue-ticket' && request.method() === 'PATCH') {
                const body = JSON.parse(request.postData() || '{}');
                const ticketId = Number(body.id || 0);
                const action = String(body.action || '').toLowerCase();
                queueTicketActions.push({ ticketId, action });

                const ticketIndex = queueTickets.findIndex(
                    (ticket) => Number(ticket.id || 0) === ticketId
                );
                if (ticketIndex < 0) {
                    return json(
                        route,
                        { ok: false, error: 'Ticket no encontrado' },
                        404
                    );
                }

                const currentTicket = queueTickets[ticketIndex];
                const updatedTicket =
                    action === 're-llamar' || action === 'rellamar'
                        ? {
                              ...currentTicket,
                              status: 'called',
                              assignedConsultorio:
                                  Number(
                                      currentTicket.assignedConsultorio || 1
                                  ) || 1,
                              calledAt: new Date().toISOString(),
                          }
                        : currentTicket;

                queueTickets = queueTickets.map((ticket, index) =>
                    index === ticketIndex ? updatedTicket : ticket
                );
                queueState = buildQueueStateFromTickets(queueTickets);

                return json(route, {
                    ok: true,
                    data: {
                        ticket: updatedTicket,
                        queueState,
                    },
                });
            }

            if (resource === 'health') {
                return json(route, { ok: true, status: 'ok' });
            }

            if (resource === 'funnel-metrics') {
                return json(route, { ok: true, data: {} });
            }

            return json(route, { ok: true, data: {} });
        });

        await page.goto(adminUrl('station=c1&lock=1'));
        await expect(page.locator('#adminDashboard')).toBeVisible();
        await page.locator('.nav-item[data-section="queue"]').click();
        await expect(page.locator('#queue')).toHaveClass(/active/);
        await expect(page.locator('#queueShortcutPanel')).toBeHidden();
        await page.locator('[data-action="queue-toggle-shortcuts"]').click();
        await expect(page.locator('#queueShortcutPanel')).toBeVisible();
        await page.keyboard.press('Alt+Shift+0');
        await expect(page.locator('#queueShortcutPanel')).toBeHidden();
        await page.keyboard.press('Alt+Shift+0');
        await expect(page.locator('#queueShortcutPanel')).toBeVisible();

        await page.evaluate(() => {
            document.dispatchEvent(
                new KeyboardEvent('keydown', {
                    key: '+',
                    code: 'NumpadAdd',
                    location: 3,
                    bubbles: true,
                    cancelable: true,
                })
            );
        });
        await expect.poll(() => queueTicketActions.length).toBe(1);
        await expect
            .poll(() => queueTicketActions[0]?.action)
            .toBe('re-llamar');
    });

    test('numpad . y - preparan accion sensible y permiten confirmar/cancelar', async ({
        page,
    }) => {
        const queueTicketActions = [];
        let queueTickets = [
            {
                id: 1293,
                ticketCode: 'A-1293',
                queueType: 'appointment',
                patientInitials: 'LM',
                priorityClass: 'appt_overdue',
                status: 'called',
                assignedConsultorio: 1,
                calledAt: new Date(Date.now() - 2 * 60 * 1000).toISOString(),
                createdAt: new Date(Date.now() - 12 * 60 * 1000).toISOString(),
            },
            {
                id: 1294,
                ticketCode: 'A-1294',
                queueType: 'walk_in',
                patientInitials: 'OP',
                priorityClass: 'walk_in',
                status: 'waiting',
                assignedConsultorio: null,
                createdAt: new Date(Date.now() - 5 * 60 * 1000).toISOString(),
            },
        ];
        let queueState = buildQueueStateFromTickets(queueTickets);

        await installLegacyAdminAuthMock(page, {
            csrfToken: 'csrf_queue_numpad_star_confirm',
        });

        await page.route(/\/api\.php(\?.*)?$/i, async (route) => {
            const request = route.request();
            const url = new URL(request.url());
            const resource = url.searchParams.get('resource') || '';
            if (resource === 'features') {
                return json(route, {
                    ok: true,
                    data: { admin_sony_ui: ADMIN_UI_VARIANT === 'sony_v2' },
                });
            }

            if (resource === 'data') {
                return json(route, {
                    ok: true,
                    data: {
                        appointments: [],
                        callbacks: [],
                        reviews: [],
                        availability: {},
                        availabilityMeta: {
                            source: 'store',
                            mode: 'live',
                            timezone: 'America/Guayaquil',
                            calendarConfigured: true,
                            calendarReachable: true,
                            generatedAt: new Date().toISOString(),
                        },
                        queue_tickets: queueTickets,
                        queueMeta: buildQueueMetaFromState(queueState),
                    },
                });
            }

            if (resource === 'queue-ticket' && request.method() === 'PATCH') {
                const body = JSON.parse(request.postData() || '{}');
                const ticketId = Number(body.id || 0);
                const action = String(body.action || '').toLowerCase();
                queueTicketActions.push({ ticketId, action });

                const ticketIndex = queueTickets.findIndex(
                    (ticket) => Number(ticket.id || 0) === ticketId
                );
                if (ticketIndex < 0) {
                    return json(
                        route,
                        { ok: false, error: 'Ticket no encontrado' },
                        404
                    );
                }

                const currentTicket = queueTickets[ticketIndex];
                const nowIso = new Date().toISOString();
                let updatedTicket = { ...currentTicket };
                if (action === 'completar') {
                    updatedTicket = {
                        ...currentTicket,
                        status: 'completed',
                        assignedConsultorio: null,
                        completedAt: nowIso,
                    };
                } else if (action === 'no_show') {
                    updatedTicket = {
                        ...currentTicket,
                        status: 'no_show',
                        assignedConsultorio: null,
                    };
                }

                queueTickets = queueTickets.map((ticket, index) =>
                    index === ticketIndex ? updatedTicket : ticket
                );
                queueState = buildQueueStateFromTickets(queueTickets);

                return json(route, {
                    ok: true,
                    data: {
                        ticket: updatedTicket,
                        queueState,
                    },
                });
            }

            if (resource === 'health') {
                return json(route, { ok: true, status: 'ok' });
            }

            if (resource === 'funnel-metrics') {
                return json(route, { ok: true, data: {} });
            }

            return json(route, { ok: true, data: {} });
        });

        await page.goto(adminUrl('station=c1&lock=1'));
        await expect(page.locator('#adminDashboard')).toBeVisible();
        await page.locator('.nav-item[data-section="queue"]').click();
        await expect(page.locator('#queue')).toHaveClass(/active/);

        await page.keyboard.press('NumpadDecimal');
        await expect.poll(() => queueTicketActions.length).toBe(0);
        await expect(
            page.locator('#queueSensitiveConfirmDialog')
        ).toBeVisible();
        await page.keyboard.press('Escape');
        await expect(page.locator('#queueSensitiveConfirmDialog')).toBeHidden();
        await expect.poll(() => queueTicketActions.length).toBe(0);

        await page.keyboard.press('NumpadSubtract');
        await expect(
            page.locator('#queueSensitiveConfirmDialog')
        ).toBeVisible();
        await page.keyboard.press('NumpadEnter');
        await expect.poll(() => queueTicketActions.length).toBe(1);
        await expect.poll(() => queueTicketActions[0]?.action).toBe('no_show');
        await expect.poll(() => queueTicketActions[0]?.ticketId).toBe(1293);
        await expect(page.locator('#queueSensitiveConfirmDialog')).toBeHidden();
    });

    test('numpad cross-platform soporta Enter por location=3 y decimal regional', async ({
        page,
    }) => {
        const queueCallNextRequests = [];
        const queueTicketActions = [];
        let queueTickets = [
            {
                id: 1401,
                ticketCode: 'A-1401',
                queueType: 'walk_in',
                patientInitials: 'BB',
                priorityClass: 'walk_in',
                status: 'waiting',
                assignedConsultorio: null,
                createdAt: new Date(Date.now() - 6 * 60 * 1000).toISOString(),
            },
            {
                id: 1402,
                ticketCode: 'A-1402',
                queueType: 'appointment',
                patientInitials: 'CC',
                priorityClass: 'appt_current',
                status: 'waiting',
                assignedConsultorio: null,
                createdAt: new Date(Date.now() - 5 * 60 * 1000).toISOString(),
            },
        ];
        let queueState = buildQueueStateFromTickets(queueTickets);

        await installLegacyAdminAuthMock(page, {
            csrfToken: 'csrf_queue_numpad_location_fallback',
        });

        await page.route(/\/api\.php(\?.*)?$/i, async (route) => {
            const request = route.request();
            const url = new URL(request.url());
            const resource = url.searchParams.get('resource') || '';
            if (resource === 'features') {
                return json(route, {
                    ok: true,
                    data: { admin_sony_ui: ADMIN_UI_VARIANT === 'sony_v2' },
                });
            }

            if (resource === 'data') {
                return json(route, {
                    ok: true,
                    data: {
                        appointments: [],
                        callbacks: [],
                        reviews: [],
                        availability: {},
                        availabilityMeta: {
                            source: 'store',
                            mode: 'live',
                            timezone: 'America/Guayaquil',
                            calendarConfigured: true,
                            calendarReachable: true,
                            generatedAt: new Date().toISOString(),
                        },
                        queue_tickets: queueTickets,
                        queueMeta: buildQueueMetaFromState(queueState),
                    },
                });
            }

            if (resource === 'queue-call-next' && request.method() === 'POST') {
                const body = JSON.parse(request.postData() || '{}');
                const consultorio = Number(body.consultorio || 0);
                queueCallNextRequests.push(consultorio);
                const waitingTicket = queueTickets.find(
                    (ticket) => ticket.status === 'waiting'
                );
                if (!waitingTicket) {
                    return json(
                        route,
                        { ok: false, error: 'Sin turnos en espera' },
                        409
                    );
                }
                const nowIso = new Date().toISOString();
                queueTickets = queueTickets.map((ticket) =>
                    ticket.id === waitingTicket.id
                        ? {
                              ...ticket,
                              status: 'called',
                              assignedConsultorio: consultorio,
                              calledAt: nowIso,
                          }
                        : ticket
                );
                queueState = buildQueueStateFromTickets(queueTickets);
                return json(route, {
                    ok: true,
                    data: {
                        ticket: queueTickets.find(
                            (ticket) => ticket.id === waitingTicket.id
                        ),
                        queueState,
                    },
                });
            }

            if (resource === 'queue-ticket' && request.method() === 'PATCH') {
                const body = JSON.parse(request.postData() || '{}');
                const ticketId = Number(body.id || 0);
                const action = String(body.action || '').toLowerCase();
                queueTicketActions.push({ ticketId, action });

                const ticketIndex = queueTickets.findIndex(
                    (ticket) => Number(ticket.id || 0) === ticketId
                );
                if (ticketIndex < 0) {
                    return json(
                        route,
                        { ok: false, error: 'Ticket no encontrado' },
                        404
                    );
                }

                const currentTicket = queueTickets[ticketIndex];
                const nowIso = new Date().toISOString();
                const updatedTicket =
                    action === 'completar'
                        ? {
                              ...currentTicket,
                              status: 'completed',
                              assignedConsultorio: null,
                              completedAt: nowIso,
                          }
                        : currentTicket;
                queueTickets = queueTickets.map((ticket, index) =>
                    index === ticketIndex ? updatedTicket : ticket
                );
                queueState = buildQueueStateFromTickets(queueTickets);

                return json(route, {
                    ok: true,
                    data: {
                        ticket: updatedTicket,
                        queueState,
                    },
                });
            }

            if (resource === 'health') {
                return json(route, { ok: true, status: 'ok' });
            }

            if (resource === 'funnel-metrics') {
                return json(route, { ok: true, data: {} });
            }

            return json(route, { ok: true, data: {} });
        });

        await page.goto(adminUrl('station=c1&lock=1'));
        await expect(page.locator('#adminDashboard')).toBeVisible();
        await page.locator('.nav-item[data-section="queue"]').click();
        await expect(page.locator('#queue')).toHaveClass(/active/);
        await page.locator('#queue').click({ position: { x: 18, y: 16 } });

        await page.evaluate(() => {
            document.dispatchEvent(
                new KeyboardEvent('keydown', {
                    key: 'Enter',
                    code: 'Enter',
                    location: 1,
                    bubbles: true,
                    cancelable: true,
                })
            );
        });
        await expect.poll(() => queueCallNextRequests.length).toBe(0);

        await page.evaluate(() => {
            document.dispatchEvent(
                new KeyboardEvent('keydown', {
                    key: 'Enter',
                    code: '',
                    location: 3,
                    bubbles: true,
                    cancelable: true,
                })
            );
        });
        await expect.poll(() => queueCallNextRequests.length).toBe(1);
        await expect.poll(() => queueCallNextRequests[0]).toBe(1);

        await page.evaluate(() => {
            document.dispatchEvent(
                new KeyboardEvent('keydown', {
                    key: ',',
                    code: 'NumpadDecimal',
                    location: 0,
                    bubbles: true,
                    cancelable: true,
                })
            );
        });
        await expect.poll(() => queueTicketActions.length).toBe(0);
        await expect(
            page.locator('#queueSensitiveConfirmDialog')
        ).toBeVisible();
        await page.keyboard.press('NumpadEnter');
        await expect.poll(() => queueTicketActions.length).toBe(1);
        await expect
            .poll(() => queueTicketActions[0]?.action)
            .toBe('completar');
        await expect.poll(() => queueCallNextRequests.length).toBe(1);
        await expect(page.locator('#queueSensitiveConfirmDialog')).toBeHidden();

        await page.evaluate(() => {
            document.dispatchEvent(
                new KeyboardEvent('keydown', {
                    key: 'Enter',
                    code: '',
                    location: 3,
                    bubbles: true,
                    cancelable: true,
                })
            );
        });
        await expect.poll(() => queueCallNextRequests.length).toBe(2);
        await expect.poll(() => queueCallNextRequests[1]).toBe(1);
        await expect(page.locator('#queueC1Now')).toContainText('A-1402');

        await page.evaluate(() => {
            document.dispatchEvent(
                new KeyboardEvent('keydown', {
                    key: 'Delete',
                    code: 'NumpadDecimal',
                    location: 0,
                    bubbles: true,
                    cancelable: true,
                })
            );
        });
        await expect.poll(() => queueTicketActions.length).toBe(1);
        await expect(
            page.locator('#queueSensitiveConfirmDialog')
        ).toBeVisible();
        await page.keyboard.press('NumpadEnter');
        await expect.poll(() => queueTicketActions.length).toBe(2);
        await expect
            .poll(() => queueTicketActions[1]?.action)
            .toBe('completar');
        await expect(page.locator('#queueSensitiveConfirmDialog')).toBeHidden();
    });

    test('calibra tecla externa para llamado y persiste por estacion hasta limpiar binding', async ({
        page,
    }) => {
        const queueCallNextRequests = [];
        let queueTickets = [
            {
                id: 1501,
                ticketCode: 'A-1501',
                queueType: 'walk_in',
                patientInitials: 'KE',
                priorityClass: 'walk_in',
                status: 'waiting',
                assignedConsultorio: null,
                createdAt: new Date(Date.now() - 7 * 60 * 1000).toISOString(),
            },
            {
                id: 1502,
                ticketCode: 'A-1502',
                queueType: 'appointment',
                patientInitials: 'LA',
                priorityClass: 'appt_current',
                status: 'waiting',
                assignedConsultorio: null,
                createdAt: new Date(Date.now() - 6 * 60 * 1000).toISOString(),
            },
            {
                id: 1503,
                ticketCode: 'A-1503',
                queueType: 'walk_in',
                patientInitials: 'MI',
                priorityClass: 'walk_in',
                status: 'waiting',
                assignedConsultorio: null,
                createdAt: new Date(Date.now() - 4 * 60 * 1000).toISOString(),
            },
        ];
        let queueState = buildQueueStateFromTickets(queueTickets);

        await installLegacyAdminAuthMock(page, {
            csrfToken: 'csrf_queue_custom_call_key',
        });

        await page.route(/\/api\.php(\?.*)?$/i, async (route) => {
            const request = route.request();
            const url = new URL(request.url());
            const resource = url.searchParams.get('resource') || '';
            if (resource === 'features') {
                return json(route, {
                    ok: true,
                    data: { admin_sony_ui: ADMIN_UI_VARIANT === 'sony_v2' },
                });
            }

            if (resource === 'data') {
                return json(route, {
                    ok: true,
                    data: {
                        appointments: [],
                        callbacks: [],
                        reviews: [],
                        availability: {},
                        availabilityMeta: {
                            source: 'store',
                            mode: 'live',
                            timezone: 'America/Guayaquil',
                            calendarConfigured: true,
                            calendarReachable: true,
                            generatedAt: new Date().toISOString(),
                        },
                        queue_tickets: queueTickets,
                        queueMeta: buildQueueMetaFromState(queueState),
                    },
                });
            }

            if (resource === 'queue-call-next' && request.method() === 'POST') {
                const body = JSON.parse(request.postData() || '{}');
                const consultorio = Number(body.consultorio || 0);
                queueCallNextRequests.push(consultorio);
                const waitingTicket = queueTickets.find(
                    (ticket) => ticket.status === 'waiting'
                );
                if (!waitingTicket) {
                    return json(
                        route,
                        { ok: false, error: 'Sin turnos en espera' },
                        409
                    );
                }
                const nowIso = new Date().toISOString();
                queueTickets = queueTickets.map((ticket) =>
                    ticket.id === waitingTicket.id
                        ? {
                              ...ticket,
                              status: 'called',
                              assignedConsultorio: consultorio,
                              calledAt: nowIso,
                          }
                        : ticket
                );
                queueState = buildQueueStateFromTickets(queueTickets);
                return json(route, {
                    ok: true,
                    data: {
                        ticket: queueTickets.find(
                            (ticket) => ticket.id === waitingTicket.id
                        ),
                        queueState,
                    },
                });
            }

            if (resource === 'health') {
                return json(route, { ok: true, status: 'ok' });
            }

            if (resource === 'funnel-metrics') {
                return json(route, { ok: true, data: {} });
            }

            return json(route, { ok: true, data: {} });
        });

        await page.goto(adminUrl('station=c1&lock=1'));
        await expect(page.locator('#adminDashboard')).toBeVisible();
        await page.locator('.nav-item[data-section="queue"]').click();
        await expect(page.locator('#queue')).toHaveClass(/active/);

        await page.evaluate(() => {
            document.dispatchEvent(
                new KeyboardEvent('keydown', {
                    key: 'Enter',
                    code: 'Enter',
                    location: 1,
                    bubbles: true,
                    cancelable: true,
                })
            );
        });
        await expect.poll(() => queueCallNextRequests.length).toBe(0);

        await page.locator('[data-action="queue-capture-call-key"]').click();
        await expect(page.locator('#toastContainer')).toContainText(
            'Calibración activa'
        );

        await page.evaluate(() => {
            document.dispatchEvent(
                new KeyboardEvent('keydown', {
                    key: 'Enter',
                    code: 'Enter',
                    location: 1,
                    bubbles: true,
                    cancelable: true,
                })
            );
        });
        await expect(page.locator('#toastContainer')).toContainText(
            'Tecla externa guardada'
        );

        await page.evaluate(() => {
            document.dispatchEvent(
                new KeyboardEvent('keydown', {
                    key: 'Enter',
                    code: 'Enter',
                    location: 1,
                    bubbles: true,
                    cancelable: true,
                })
            );
        });
        await expect.poll(() => queueCallNextRequests.length).toBe(1);
        await expect.poll(() => queueCallNextRequests[0]).toBe(1);

        await page.reload();
        await expect(page.locator('#adminDashboard')).toBeVisible();
        await page.locator('.nav-item[data-section="queue"]').click();
        await expect(page.locator('#queue')).toHaveClass(/active/);
        await expect(
            page.locator('[data-action="queue-clear-call-key"]')
        ).toBeVisible();

        await page.evaluate(() => {
            document.dispatchEvent(
                new KeyboardEvent('keydown', {
                    key: 'Enter',
                    code: 'Enter',
                    location: 1,
                    bubbles: true,
                    cancelable: true,
                })
            );
        });
        await expect.poll(() => queueCallNextRequests.length).toBe(2);
        await expect.poll(() => queueCallNextRequests[1]).toBe(1);

        page.once('dialog', async (dialog) => {
            await dialog.accept();
        });
        await page.locator('[data-action="queue-clear-call-key"]').click();
        await expect(page.locator('#toastContainer')).toContainText(
            'Tecla externa eliminada'
        );

        await page.evaluate(() => {
            document.dispatchEvent(
                new KeyboardEvent('keydown', {
                    key: 'Enter',
                    code: 'Enter',
                    location: 1,
                    bubbles: true,
                    cancelable: true,
                })
            );
        });
        await expect.poll(() => queueCallNextRequests.length).toBe(2);
    });

    test('modo práctica simula acciones y no altera cola real hasta salir de práctica', async ({
        page,
    }) => {
        const queueCallNextRequests = [];
        const queueTicketPatchRequests = [];
        let queueTickets = [
            {
                id: 1301,
                ticketCode: 'A-1301',
                queueType: 'appointment',
                patientInitials: 'PR',
                priorityClass: 'appt_current',
                status: 'waiting',
                assignedConsultorio: null,
                createdAt: new Date(Date.now() - 8 * 60 * 1000).toISOString(),
            },
        ];
        let queueState = buildQueueStateFromTickets(queueTickets);

        await installLegacyAdminAuthMock(page, {
            csrfToken: 'csrf_queue_practice_mode',
        });

        await page.route(/\/api\.php(\?.*)?$/i, async (route) => {
            const request = route.request();
            const url = new URL(request.url());
            const resource = url.searchParams.get('resource') || '';
            if (resource === 'features') {
                return json(route, {
                    ok: true,
                    data: { admin_sony_ui: ADMIN_UI_VARIANT === 'sony_v2' },
                });
            }

            if (resource === 'data') {
                return json(route, {
                    ok: true,
                    data: {
                        appointments: [],
                        callbacks: [],
                        reviews: [],
                        availability: {},
                        availabilityMeta: {
                            source: 'store',
                            mode: 'live',
                            timezone: 'America/Guayaquil',
                            calendarConfigured: true,
                            calendarReachable: true,
                            generatedAt: new Date().toISOString(),
                        },
                        queue_tickets: queueTickets,
                        queueMeta: buildQueueMetaFromState(queueState),
                    },
                });
            }

            if (resource === 'queue-call-next' && request.method() === 'POST') {
                const body = JSON.parse(request.postData() || '{}');
                queueCallNextRequests.push(Number(body.consultorio || 0));
                const candidate = queueTickets.find(
                    (ticket) => ticket.status === 'waiting'
                );
                if (!candidate) {
                    return json(
                        route,
                        { ok: false, error: 'Sin turnos en espera' },
                        409
                    );
                }
                queueTickets = queueTickets.map((ticket) =>
                    ticket.id === candidate.id
                        ? {
                              ...ticket,
                              status: 'called',
                              assignedConsultorio: Number(
                                  body.consultorio || 1
                              ),
                              calledAt: new Date().toISOString(),
                          }
                        : ticket
                );
                queueState = buildQueueStateFromTickets(queueTickets);
                return json(route, {
                    ok: true,
                    data: {
                        ticket: queueTickets.find(
                            (ticket) => ticket.id === candidate.id
                        ),
                        queueState,
                    },
                });
            }

            if (resource === 'queue-ticket' && request.method() === 'PATCH') {
                queueTicketPatchRequests.push(1);
                return json(route, { ok: true, data: { ticket: null } });
            }

            if (resource === 'health') {
                return json(route, { ok: true, status: 'ok' });
            }

            if (resource === 'funnel-metrics') {
                return json(route, { ok: true, data: {} });
            }

            return json(route, { ok: true, data: {} });
        });

        await page.goto(adminUrl('station=c1&lock=1'));
        await expect(page.locator('#adminDashboard')).toBeVisible();
        await page.locator('.nav-item[data-section="queue"]').click();
        await expect(page.locator('#queue')).toHaveClass(/active/);

        await page.locator('[data-action="queue-start-practice"]').click();
        await expect(page.locator('#queuePracticeModeBadge')).toBeVisible();

        await page.keyboard.press('NumpadEnter');
        await expect.poll(() => queueCallNextRequests.length).toBe(0);

        await page
            .locator(
                '#queueTableBody [data-action="queue-ticket-action"][data-queue-action="completar"]'
            )
            .first()
            .click();
        await expect.poll(() => queueTicketPatchRequests.length).toBe(0);

        await page.locator('[data-action="queue-stop-practice"]').click();
        await expect(page.locator('#queuePracticeModeBadge')).toBeHidden();

        await page.keyboard.press('NumpadEnter');
        await expect.poll(() => queueCallNextRequests.length).toBe(1);
        await expect.poll(() => queueCallNextRequests[0]).toBe(1);
    });

    test('tabla muestra mensaje de filtro activo cuando hay tickets pero no matchean', async ({
        page,
    }) => {
        const queueTickets = [
            {
                id: 1192,
                ticketCode: 'A-1192',
                queueType: 'walk_in',
                patientInitials: 'FI',
                priorityClass: 'walk_in',
                status: 'waiting',
                assignedConsultorio: null,
                createdAt: new Date(Date.now() - 4 * 60 * 1000).toISOString(),
            },
        ];
        const queueState = buildQueueStateFromTickets(queueTickets);

        await installLegacyAdminAuthMock(page, {
            csrfToken: 'csrf_queue_filter_empty',
        });

        await page.route(/\/api\.php(\?.*)?$/i, async (route) => {
            const request = route.request();
            const url = new URL(request.url());
            const resource = url.searchParams.get('resource') || '';
            if (resource === 'features') {
                return json(route, {
                    ok: true,
                    data: { admin_sony_ui: ADMIN_UI_VARIANT === 'sony_v2' },
                });
            }

            if (resource === 'data') {
                return json(route, {
                    ok: true,
                    data: {
                        appointments: [],
                        callbacks: [],
                        reviews: [],
                        availability: {},
                        availabilityMeta: {
                            source: 'store',
                            mode: 'live',
                            timezone: 'America/Guayaquil',
                            calendarConfigured: true,
                            calendarReachable: true,
                            generatedAt: new Date().toISOString(),
                        },
                        queue_tickets: queueTickets,
                        queueMeta: buildQueueMetaFromState(queueState),
                    },
                });
            }

            if (resource === 'health') {
                return json(route, { ok: true, status: 'ok' });
            }

            if (resource === 'funnel-metrics') {
                return json(route, { ok: true, data: {} });
            }

            return json(route, { ok: true, data: {} });
        });

        await page.goto(adminUrl());
        await expect(page.locator('#adminDashboard')).toBeVisible();
        await page.locator('.nav-item[data-section="queue"]').click();
        await expect(page.locator('#queue')).toHaveClass(/active/);
        await expect(
            page.locator('#queueTableBody tr').filter({ hasText: 'A-1192' })
        ).toHaveCount(1);

        await page.locator('[data-queue-filter="called"]').first().click();
        await expect(page.locator('#queueTableBody')).toContainText(
            'No hay tickets para filtro'
        );
    });

    test('reimprime tickets visibles en bloque y deja traza operativa', async ({
        page,
    }) => {
        const queueTickets = [
            {
                id: 991,
                ticketCode: 'A-991',
                queueType: 'appointment',
                patientInitials: 'AA',
                priorityClass: 'appt_overdue',
                status: 'waiting',
                assignedConsultorio: null,
                createdAt: new Date(Date.now() - 9 * 60 * 1000).toISOString(),
            },
            {
                id: 992,
                ticketCode: 'A-992',
                queueType: 'appointment',
                patientInitials: 'BB',
                priorityClass: 'appt_current',
                status: 'waiting',
                assignedConsultorio: null,
                createdAt: new Date(Date.now() - 7 * 60 * 1000).toISOString(),
            },
            {
                id: 993,
                ticketCode: 'A-993',
                queueType: 'walk_in',
                patientInitials: 'CC',
                priorityClass: 'walk_in',
                status: 'waiting',
                assignedConsultorio: null,
                createdAt: new Date(Date.now() - 3 * 60 * 1000).toISOString(),
            },
        ];
        const queueState = buildQueueStateFromTickets(queueTickets);
        let reprintRequests = 0;

        await installLegacyAdminAuthMock(page, {
            csrfToken: 'csrf_queue_reprint_bulk',
        });

        await page.route(/\/api\.php(\?.*)?$/i, async (route) => {
            const request = route.request();
            const url = new URL(request.url());
            const resource = url.searchParams.get('resource') || '';
            if (resource === 'features') {
                return json(route, {
                    ok: true,
                    data: { admin_sony_ui: ADMIN_UI_VARIANT === 'sony_v2' },
                });
            }

            if (resource === 'data') {
                return json(route, {
                    ok: true,
                    data: {
                        appointments: [],
                        callbacks: [],
                        reviews: [],
                        availability: {},
                        availabilityMeta: {
                            source: 'store',
                            mode: 'live',
                            timezone: 'America/Guayaquil',
                            calendarConfigured: true,
                            calendarReachable: true,
                            generatedAt: new Date().toISOString(),
                        },
                        queue_tickets: queueTickets,
                        queueMeta: buildQueueMetaFromState(queueState),
                    },
                });
            }

            if (resource === 'queue-reprint' && request.method() === 'POST') {
                reprintRequests += 1;
                const body = JSON.parse(request.postData() || '{}');
                const id = Number(body.id || 0);
                if (id === 992) {
                    return json(
                        route,
                        {
                            ok: false,
                            data: {
                                ticket: queueTickets.find(
                                    (ticket) => Number(ticket.id || 0) === id
                                ),
                            },
                            printed: false,
                            print: {
                                ok: false,
                                errorCode: 'printer_connect_failed',
                                message: 'connect_failed',
                            },
                        },
                        503
                    );
                }
                return json(route, {
                    ok: true,
                    data: {
                        ticket: queueTickets.find(
                            (ticket) => Number(ticket.id || 0) === id
                        ),
                    },
                    printed: true,
                    print: {
                        ok: true,
                        errorCode: '',
                        message: 'ok',
                    },
                });
            }

            if (resource === 'health') {
                return json(route, { ok: true, status: 'ok' });
            }

            if (resource === 'funnel-metrics') {
                return json(route, { ok: true, data: {} });
            }

            return json(route, { ok: true, data: {} });
        });

        page.on('dialog', (dialog) => dialog.accept());

        await page.goto(adminUrl());
        await expect(page.locator('#adminDashboard')).toBeVisible();
        await page.locator('.nav-item[data-section="queue"]').click();
        await expect(page.locator('#queue')).toHaveClass(/active/);
        await expect(page.locator('#queueTableBody tr')).toHaveCount(3);

        await page.locator('[data-action="queue-bulk-reprint"]').click();

        await expect.poll(() => reprintRequests).toBe(3);
        await expect(page.locator('#queueActivityList')).toContainText(
            'Bulk reimpresion'
        );
    });

    test('queue arranca en basic para el piloto web y solo reabre expert bajo demanda', async ({
        page,
    }) => {
        const nowIso = new Date().toISOString();

        await page.addInitScript(() => {
            window.localStorage.removeItem('queueAdminViewModeV1');
            window.__QUEUE_AUTO_REFRESH_INTERVAL_MS__ = 120;
        });

        await installQueueAdminAuthMock(page, 'csrf_queue_admin_mode');

        await page.route(/\/api\.php(\?.*)?$/i, async (route) => {
            const url = new URL(route.request().url());
            const resource = url.searchParams.get('resource') || '';

            if (resource === 'features') {
                return json(route, {
                    ok: true,
                    data: { admin_sony_ui: ADMIN_UI_VARIANT === 'sony_v2' },
                });
            }

            if (resource === 'data') {
                return json(route, {
                    ok: true,
                    data: {
                        appointments: [],
                        callbacks: [],
                        reviews: [],
                        availability: {},
                        availabilityMeta: {
                            source: 'store',
                            mode: 'live',
                            timezone: 'America/Guayaquil',
                            calendarConfigured: true,
                            calendarReachable: true,
                            generatedAt: nowIso,
                        },
                        turneroClinicProfile: {
                            schema: 'turnero-clinic-profile/v1',
                            clinic_id: 'clinica-norte-demo',
                            branding: {
                                name: 'Clinica Norte',
                                short_name: 'Norte',
                                base_url: 'https://clinica-norte.example',
                            },
                            consultorios: {
                                c1: {
                                    label: 'Dermatología 1',
                                    short_label: 'D1',
                                },
                                c2: {
                                    label: 'Dermatología 2',
                                    short_label: 'D2',
                                },
                            },
                            surfaces: {
                                admin: {
                                    enabled: true,
                                    label: 'Admin web',
                                    route: '/admin.html#queue',
                                },
                                operator: {
                                    enabled: true,
                                    label: 'Operador web',
                                    route: '/operador-turnos.html',
                                },
                                kiosk: {
                                    enabled: true,
                                    label: 'Kiosco web',
                                    route: '/kiosco-turnos.html',
                                },
                                display: {
                                    enabled: true,
                                    label: 'Sala web',
                                    route: '/sala-turnos.html',
                                },
                            },
                            release: {
                                mode: 'web_pilot',
                                admin_mode_default: 'basic',
                                separate_deploy: true,
                                native_apps_blocking: false,
                                notes: [
                                    'Canon web piloto por clínica.',
                                    'Instaladores quedan para el siguiente release.',
                                ],
                            },
                        },
                        turneroClinicProfileMeta: {
                            source: 'remote',
                            cached: false,
                            clinicId: 'clinica-norte-demo',
                            fetchedAt: nowIso,
                        },
                        turneroClinicProfileCatalogStatus:
                            buildTurneroClinicProfileCatalogStatus({
                                clinicId: 'clinica-norte-demo',
                            }),
                        queue_tickets: [],
                        queueMeta: buildQueueMetaFromState({
                            updatedAt: nowIso,
                            waitingCount: 0,
                            calledCount: 0,
                            counts: {
                                waiting: 0,
                                called: 0,
                                completed: 0,
                                no_show: 0,
                                cancelled: 0,
                            },
                            callingNow: [],
                            nextTickets: [],
                        }),
                        queueSurfaceStatus: {
                            operator: {
                                surface: 'operator',
                                label: 'Operador',
                                status: 'ready',
                                updatedAt: new Date().toISOString(),
                                ageSec: 8,
                                stale: false,
                                summary: 'Operador listo para D1.',
                                latest: {
                                    deviceLabel: 'Operador D1',
                                    appMode: 'desktop',
                                    ageSec: 8,
                                    details: {
                                        station: 'c1',
                                        stationMode: 'locked',
                                        oneTap: false,
                                        numpadSeen: true,
                                    },
                                },
                                instances: [],
                            },
                            kiosk: {
                                surface: 'kiosk',
                                label: 'Kiosco',
                                status: 'warning',
                                updatedAt: new Date().toISOString(),
                                ageSec: 12,
                                stale: false,
                                summary: 'Falta validar una impresión.',
                                latest: {
                                    deviceLabel: 'Kiosco principal',
                                    appMode: 'browser',
                                    ageSec: 12,
                                    details: {
                                        connection: 'live',
                                        pendingOffline: 0,
                                        printerPrinted: false,
                                        clinicId: 'clinica-norte-demo',
                                        profileSource: 'remote',
                                        surfaceContractState: 'ready',
                                        surfaceRouteExpected:
                                            '/kiosco-turnos.html',
                                        surfaceRouteCurrent:
                                            '/kiosco-turnos.html',
                                    },
                                },
                                instances: [],
                            },
                            display: {
                                surface: 'display',
                                label: 'Sala',
                                status: 'ready',
                                updatedAt: new Date().toISOString(),
                                ageSec: 10,
                                stale: false,
                                summary: 'Sala lista con audio activo.',
                                latest: {
                                    deviceLabel: 'Sala principal',
                                    appMode: 'browser',
                                    ageSec: 10,
                                    details: {
                                        connection: 'live',
                                        bellMuted: false,
                                        bellPrimed: true,
                                        clinicId: 'clinica-norte-demo',
                                        profileSource: 'remote',
                                        surfaceContractState: 'ready',
                                        surfaceRouteExpected:
                                            '/sala-turnos.html',
                                        surfaceRouteCurrent:
                                            '/sala-turnos.html',
                                    },
                                },
                                instances: [],
                            },
                        },
                    },
                });
            }

            if (resource === 'health') {
                return json(route, {
                    ok: true,
                    status: 'ok',
                    checks: {
                        publicSync: {
                            configured: true,
                            healthy: true,
                            state: 'ok',
                            deployedCommit:
                                '3de287e27f2f5034f6f471234567890abcdef12',
                            headDrift: false,
                            ageSeconds: 32,
                            failureReason: '',
                        },
                    },
                });
            }

            if (resource === 'funnel-metrics') {
                return json(route, { ok: true, data: {} });
            }

            return json(route, { ok: true, data: {} });
        });

        await page.goto(adminUrl());
        await expect(page.locator('#adminDashboard')).toBeVisible();
        await page.locator('.nav-item[data-section="queue"]').click();

        await expect(page.locator('#queueAppsHub')).toHaveAttribute(
            'data-queue-admin-mode',
            'basic'
        );
        await expect(page.locator('#queueAdminViewMode')).toBeVisible();
        await expect(page.locator('#queueAdminViewModeTitle')).toContainText(
            'Norte · piloto web por clinica'
        );
        await expect(page.locator('#queueAdminViewModeChip')).toContainText(
            'Basic por defecto'
        );
        await expect(page.locator('#queueAdminViewModeClinic')).toContainText(
            'Clinica Norte · clinica-norte-demo'
        );
        await expect(page.locator('#queueDomainTitle')).toContainText(
            'Experiencia: Despliegue'
        );
        await expect(page.locator('#queueDomainSummary')).toContainText(
            'Checklist de apertura'
        );
        await expect(page.locator('#queueDomainPrimary')).toHaveAttribute(
            'href',
            '#queueOpeningChecklist'
        );
        await expect(page.locator('#queueOpsPilot')).toBeVisible();
        await expect(
            page.locator('#queueOpsPilotReadinessTitle')
        ).toContainText('Piloto web casi listo');
        await expect(
            page.locator('#queueOpsPilotReadinessStatus')
        ).toContainText('2 bloqueo');
        await expect(
            page.locator('#queueOpsPilotReadinessItem_profile')
        ).toContainText('Listo');
        await expect(
            page.locator('#queueOpsPilotReadinessItem_catalog')
        ).toContainText('clinica-norte-demo.json');
        await expect(
            page.locator('#queueOpsPilotReadinessItem_surfaces')
        ).toContainText('Admin, operador, kiosco y sala web');
        await expect(
            page.locator('#queueOpsPilotReadinessItem_publish')
        ).toContainText('public_main_sync sano');
        await expect(
            page.locator('#queueOpsPilotReadinessItem_health')
        ).toContainText('Pendiente');
        await expect(
            page.locator('#queueOpsPilotReadinessItem_smoke')
        ).toContainText('Todavía falta un llamado real o de prueba');
        await expect(page.locator('#queueOpsPilotIssuesTitle')).toContainText(
            'Bloqueos de salida'
        );
        await expect(page.locator('#queueOpsPilotIssuesStatus')).toContainText(
            '2 pendiente'
        );
        await expect(
            page.locator('#queueOpsPilotIssuesItem_health')
        ).toContainText('heartbeats');
        await expect(
            page.locator('#queueOpsPilotIssuesItem_smoke')
        ).toContainText('Todavía falta un llamado real o de prueba');
        await expect(page.locator('#queueOpsPilotCanonTitle')).toContainText(
            'Rutas por clínica'
        );
        await expect(page.locator('#queueOpsPilotCanonStatus')).toContainText(
            '4/4 activas'
        );
        await expect(
            page.locator('#queueOpsPilotCanonItem_admin')
        ).toContainText('Verificada');
        await expect(
            page.locator('#queueOpsPilotCanonItem_operator')
        ).toContainText('/operador-turnos.html');
        await expect(page.locator('#queueOpsPilotCanonSupport')).toContainText(
            '3/4 superficies ya verificaron su ruta'
        );
        await expect(page.locator('#queueOpsPilotSmokeTitle')).toContainText(
            'Secuencia repetible'
        );
        await expect(page.locator('#queueOpsPilotSmokeStatus')).toContainText(
            '3/5 listos'
        );
        await expect(
            page.locator('#queueOpsPilotSmokeItem_admin')
        ).toContainText('Verifica que la cola abra en `basic`');
        await expect(
            page.locator('#queueOpsPilotSmokeAction_admin')
        ).toHaveAttribute(
            'href',
            'https://clinica-norte.example/admin.html#queue'
        );
        await expect(
            page.locator('#queueOpsPilotSmokeItem_kiosk')
        ).toContainText('Pendiente');
        await expect(
            page.locator('#queueOpsPilotSmokeItem_end_to_end')
        ).toContainText('Cerrar smoke');
        await expect(page.locator('#queueOpsPilotHandoffTitle')).toContainText(
            'Paquete de apertura'
        );
        await expect(
            page.locator('#queueOpsPilotHandoffItem_clinic')
        ).toContainText('Clinica Norte · clinica-norte-demo');
        await expect(
            page.locator('#queueOpsPilotHandoffItem_profile_source')
        ).toContainText('remoto verificado');
        await expect(
            page.locator('#queueOpsPilotHandoffItem_catalog')
        ).toContainText('clinica-norte-demo.json verificado');
        await expect(
            page.locator('#queueOpsPilotHandoffItem_publish')
        ).toContainText('commit 3de287e2');
        await expect(
            page.locator('#queueOpsPilotHandoffItem_canon')
        ).toContainText('3/4 rutas verificadas');
        await expect(
            page.locator('#queueOpsPilotHandoffItem_blockers')
        ).toContainText('Señal viva / heartbeats');
        await expect(
            page.locator('#queueOpsPilotHandoffCopyBtn')
        ).toContainText('Copiar paquete');
        await expect(page.locator('#queueOpeningChecklist')).toBeVisible();
        await expect(page.locator('#queueAppDownloadsCards')).toBeHidden();
        await expect(page.locator('#queuePlaybook')).toBeHidden();
        await expect(page.locator('#queueDeskReply')).toBeHidden();
        await expect(page.locator('#queueInstallConfigurator')).toBeHidden();

        await page.locator('#queueDomainOperations').dispatchEvent('click');
        await expect(page.locator('#queueConsultorioBoard')).toBeVisible();
        await expect(page.locator('#queueAttentionDeck')).toBeVisible();
        await expect(page.locator('#queueResolutionDeck')).toBeVisible();
        await expect(page.locator('#queueTicketLookup')).toBeVisible();
        await expect(
            page.locator('#queueConsultorioCard_c1 strong').first()
        ).toContainText('D1');
        await expect(
            page.locator('#queueConsultorioCard_c2 strong').first()
        ).toContainText('D2');
        await expect(page.locator('#queueConsultorioPrimary_c1')).toContainText(
            'Abrir Operador D1'
        );
        await expect(page.locator('#queueConsultorioPrimary_c2')).toContainText(
            'Abrir Operador D2'
        );
        await expect(page.locator('#queueTicketRoute')).toBeHidden();
        await expect(page.locator('#queueNextTurns')).toBeHidden();

        await page.locator('#queueDomainIncidents').dispatchEvent('click');
        await expect(page.locator('#queueSurfaceTelemetry')).toBeVisible();
        await expect(page.locator('#queueOpsAlerts')).toBeVisible();
        await expect(page.locator('#queueContingencyDeck')).toBeVisible();
        await expect(page.locator('#queueOpsLog')).toBeHidden();

        await page.locator('#queueAdminViewModeExpert').click();
        await expect(page.locator('#queueAppsHub')).toHaveAttribute(
            'data-queue-admin-mode',
            'expert'
        );
        await expect(page.locator('#queueAdminViewModeChip')).toContainText(
            'Expert activo'
        );
        await page.locator('#queueDomainDeployment').dispatchEvent('click');
        await expect(page.locator('#queueAppDownloadsCards')).toBeVisible();
        await expect(page.locator('#queuePlaybook')).toBeVisible();
        await expect(page.locator('#queueOpsPilot')).toBeVisible();
        await expect(page.locator('#queueInstallConfigurator')).toBeVisible();
    });

    test('queue reinicia el estado local del piloto cuando cambia de clínica', async ({
        page,
    }) => {
        const nowIso = new Date().toISOString();
        const todayLocal = getTodayLocalIsoDateForTest();

        await page.addInitScript(
            ({ today, now }) => {
                window.localStorage.removeItem('queueAdminViewModeV1');
                window.__QUEUE_AUTO_REFRESH_INTERVAL_MS__ = 120;
                window.localStorage.setItem('queueAdminViewModeV1', 'expert');
                window.localStorage.setItem(
                    'queueAdminViewModeClinicV1',
                    'clinica-sur-demo'
                );
                window.localStorage.setItem(
                    'queueInstallPresetV1',
                    JSON.stringify({
                        clinicId: 'clinica-sur-demo',
                        surface: 'sala_tv',
                        station: 'c2',
                        lock: true,
                        oneTap: true,
                        platform: 'win',
                    })
                );
                window.localStorage.setItem(
                    'queueOpeningChecklistV1',
                    JSON.stringify({
                        date: today,
                        clinicId: 'clinica-sur-demo',
                        steps: {
                            operator_ready: true,
                            kiosk_ready: true,
                            sala_ready: true,
                            smoke_ready: true,
                        },
                    })
                );
                window.localStorage.setItem(
                    'queueShiftHandoffV1',
                    JSON.stringify({
                        date: today,
                        clinicId: 'clinica-sur-demo',
                        steps: {
                            queue_clear: true,
                            operator_handoff: true,
                            kiosk_handoff: true,
                            sala_handoff: true,
                        },
                    })
                );
                window.localStorage.setItem(
                    'queueOpsLogV1',
                    JSON.stringify({
                        date: today,
                        clinicId: 'clinica-sur-demo',
                        items: [
                            {
                                id: 'old-clinic-entry',
                                createdAt: now,
                                tone: 'warning',
                                title: 'Clínica Sur',
                                summary:
                                    'No debe sobrevivir al cambio de clínica.',
                                source: 'manual',
                            },
                        ],
                    })
                );
                window.localStorage.setItem(
                    'queueOpsLogFilterV1',
                    JSON.stringify({
                        clinicId: 'clinica-sur-demo',
                        filter: 'incidents',
                    })
                );
                window.localStorage.setItem(
                    'queueOpsAlertsV1',
                    JSON.stringify({
                        date: today,
                        clinicId: 'clinica-sur-demo',
                        reviewed: {
                            operator_warning: {
                                reviewedAt: now,
                            },
                        },
                    })
                );
                window.localStorage.setItem(
                    'queueOpsFocusModeV1',
                    JSON.stringify({
                        clinicId: 'clinica-sur-demo',
                        mode: 'incidents',
                    })
                );
                window.localStorage.setItem(
                    'queueOpsPlaybookV1',
                    JSON.stringify({
                        date: today,
                        clinicId: 'clinica-sur-demo',
                        modes: {
                            opening: {
                                check_sur: true,
                            },
                            operations: {
                                queue_sur: true,
                            },
                            incidents: {},
                            closing: {},
                        },
                    })
                );
                window.localStorage.setItem(
                    'queueHubDomainViewV1',
                    JSON.stringify({
                        clinicId: 'clinica-sur-demo',
                        selection: 'incidents',
                    })
                );
                window.localStorage.setItem(
                    'queueTicketLookupV1',
                    JSON.stringify({
                        clinicId: 'clinica-sur-demo',
                        term: 'A-1999',
                    })
                );
                window.localStorage.setItem(
                    'queueStationMode',
                    JSON.stringify({
                        values: {
                            'clinica-sur-demo': 'locked',
                        },
                    })
                );
                window.localStorage.setItem(
                    'queueStationConsultorio',
                    JSON.stringify({
                        values: {
                            'clinica-sur-demo': 2,
                        },
                    })
                );
                window.localStorage.setItem(
                    'queueOneTapAdvance',
                    JSON.stringify({
                        values: {
                            'clinica-sur-demo': true,
                        },
                    })
                );
                window.localStorage.setItem(
                    'queueNumpadHelpOpen',
                    JSON.stringify({
                        values: {
                            'clinica-sur-demo': true,
                        },
                    })
                );
                window.localStorage.setItem(
                    'queueCallKeyBindingV1',
                    JSON.stringify({
                        values: {
                            'clinica-sur-demo': {
                                key: 'Enter',
                                code: 'NumpadEnter',
                                location: 3,
                            },
                        },
                    })
                );
                window.localStorage.setItem(
                    'queueAdminLastSnapshot',
                    JSON.stringify({
                        values: {
                            'clinica-sur-demo': {
                                queueMeta: {
                                    updatedAt: now,
                                    waitingCount: 1,
                                    calledCount: 0,
                                },
                                queueTickets: [
                                    {
                                        id: 1999,
                                        ticketCode: 'A-1999',
                                        queueType: 'walk_in',
                                        patientInitials: 'ZZ',
                                        priorityClass: 'walk_in',
                                        status: 'waiting',
                                        assignedConsultorio: 2,
                                        createdAt: now,
                                    },
                                ],
                                updatedAt: now,
                            },
                        },
                    })
                );
            },
            { today: todayLocal, now: nowIso }
        );

        const clinicProfile = buildQueuePilotClinicProfile({
            clinicId: 'clinica-norte-demo',
            branding: {
                name: 'Clinica Norte',
                short_name: 'Norte',
                base_url: 'https://clinica-norte.example',
            },
            consultorios: {
                c1: {
                    label: 'Dermatología 1',
                    short_label: 'D1',
                },
                c2: {
                    label: 'Dermatología 2',
                    short_label: 'D2',
                },
            },
            release: {
                notes: ['Canon web piloto por clínica.'],
            },
        });

        await installQueueAdminAuthMock(page, 'csrf_queue_clinic_scope_reset');
        await installQueuePilotApiMocks(page, {
            queueState: buildQueueIdleState(nowIso),
            clinicProfile,
            clinicProfileMeta: {
                source: 'remote',
                cached: false,
                clinicId: clinicProfile.clinic_id,
                fetchedAt: nowIso,
            },
            queueSurfaceStatus: buildQueuePilotSurfaceStatus({
                updatedAt: nowIso,
                clinicId: clinicProfile.clinic_id,
                operator: {
                    ageSec: 8,
                    summary: 'Operador listo para D1.',
                    latest: {
                        deviceLabel: 'Operador D1',
                        appMode: 'desktop',
                    },
                    details: {
                        station: 'c1',
                        stationMode: 'locked',
                        oneTap: false,
                        numpadSeen: true,
                        profileSource: 'remote',
                    },
                },
                kiosk: {
                    status: 'warning',
                    ageSec: 12,
                    summary: 'Falta validar una impresión.',
                    latest: {
                        deviceLabel: 'Kiosco principal',
                    },
                    details: {
                        connection: 'live',
                        pendingOffline: 0,
                        printerPrinted: false,
                        profileSource: 'remote',
                    },
                },
                display: {
                    ageSec: 10,
                    summary: 'Sala lista con audio activo.',
                    latest: {
                        deviceLabel: 'Sala principal',
                    },
                    details: {
                        connection: 'live',
                        bellMuted: false,
                        bellPrimed: true,
                        profileSource: 'remote',
                    },
                },
            }),
            healthPayload: buildQueuePilotHealthPayload({
                publicSync: {
                    deployedCommit: '3de287e27f2f5034f6f471234567890abcdef12',
                    ageSeconds: 32,
                },
            }),
        });

        await page.goto(adminUrl());
        await expect(page.locator('#adminDashboard')).toBeVisible();
        await page.locator('.nav-item[data-section="queue"]').click();

        await expect(page.locator('#queueAppsHub')).toHaveAttribute(
            'data-queue-admin-mode',
            'basic'
        );
        await expect(page.locator('#queueOpsPilotProgressValue')).toContainText(
            '0/4'
        );

        const scopedState = await page.evaluate(() => {
            const readStorageValue = (key) => {
                const raw = window.localStorage.getItem(key);
                if (!raw) {
                    return null;
                }
                try {
                    return JSON.parse(raw);
                } catch (_error) {
                    return raw;
                }
            };

            return {
                opening: JSON.parse(
                    window.localStorage.getItem('queueOpeningChecklistV1') ||
                        'null'
                ),
                handoff: JSON.parse(
                    window.localStorage.getItem('queueShiftHandoffV1') || 'null'
                ),
                log: JSON.parse(
                    window.localStorage.getItem('queueOpsLogV1') || 'null'
                ),
                logFilter: readStorageValue('queueOpsLogFilterV1'),
                opsAlerts: readStorageValue('queueOpsAlertsV1'),
                opsFocusMode: readStorageValue('queueOpsFocusModeV1'),
                opsPlaybook: readStorageValue('queueOpsPlaybookV1'),
                domainView: readStorageValue('queueHubDomainViewV1'),
                ticketLookup: readStorageValue('queueTicketLookupV1'),
                queueStationMode: readStorageValue('queueStationMode'),
                queueStationConsultorio: readStorageValue(
                    'queueStationConsultorio'
                ),
                queueOneTapAdvance: readStorageValue('queueOneTapAdvance'),
                queueNumpadHelpOpen: readStorageValue('queueNumpadHelpOpen'),
                queueCallKeyBinding: readStorageValue('queueCallKeyBindingV1'),
                queueAdminLastSnapshot: readStorageValue(
                    'queueAdminLastSnapshot'
                ),
                adminViewMode: window.localStorage.getItem(
                    'queueAdminViewModeV1'
                ),
                adminViewModeClinic: window.localStorage.getItem(
                    'queueAdminViewModeClinicV1'
                ),
                installPreset: JSON.parse(
                    window.localStorage.getItem('queueInstallPresetV1') ||
                        'null'
                ),
            };
        });

        expect(scopedState.opening?.clinicId).toBe('clinica-norte-demo');
        expect(
            Object.values(scopedState.opening?.steps || {}).some(Boolean)
        ).toBe(false);
        expect(scopedState.handoff?.clinicId).toBe('clinica-norte-demo');
        expect(
            Object.values(scopedState.handoff?.steps || {}).some(Boolean)
        ).toBe(false);
        expect(scopedState.log?.clinicId).toBe('clinica-norte-demo');
        expect(Array.isArray(scopedState.log?.items)).toBe(true);
        expect(scopedState.log.items).toHaveLength(0);
        expect(scopedState.logFilter?.clinicId).toBe('clinica-norte-demo');
        expect(scopedState.logFilter?.filter).toBe('all');
        expect(scopedState.opsAlerts?.clinicId).toBe('clinica-norte-demo');
        expect(Object.keys(scopedState.opsAlerts?.reviewed || {})).toHaveLength(
            0
        );
        expect(scopedState.opsFocusMode?.clinicId).toBe('clinica-norte-demo');
        expect(scopedState.opsFocusMode?.mode).toBe('auto');
        expect(scopedState.opsPlaybook?.clinicId).toBe('clinica-norte-demo');
        expect(
            Object.values(scopedState.opsPlaybook?.modes || {}).every(
                (mode) => !mode || Object.keys(mode).length === 0
            )
        ).toBe(true);
        expect(scopedState.domainView?.clinicId).toBe('clinica-norte-demo');
        expect(scopedState.domainView?.selection).toBe('auto');
        expect(scopedState.ticketLookup).toBeNull();
        expect(
            scopedState.queueStationMode?.values?.['clinica-norte-demo']
        ).toBe('free');
        expect(
            scopedState.queueStationConsultorio?.values?.['clinica-norte-demo']
        ).toBe(1);
        expect(
            scopedState.queueOneTapAdvance?.values?.['clinica-norte-demo']
        ).toBe(false);
        expect(
            scopedState.queueNumpadHelpOpen?.values?.['clinica-norte-demo']
        ).toBe(false);
        expect(
            scopedState.queueCallKeyBinding?.values?.['clinica-norte-demo'] ||
                null
        ).toBeNull();
        expect(
            scopedState.queueAdminLastSnapshot?.values?.['clinica-sur-demo']
                ?.queueTickets?.[0]?.ticketCode
        ).toBe('A-1999');
        expect(scopedState.adminViewMode).toBe('basic');
        expect(scopedState.adminViewModeClinic).toBe('clinica-norte-demo');
        expect(scopedState.installPreset?.clinicId).toBe('clinica-norte-demo');
        expect(scopedState.installPreset?.surface).toBe('operator');
        expect(scopedState.installPreset?.station).toBe('c1');
        expect(scopedState.installPreset?.lock).toBe(true);
        expect(scopedState.installPreset?.oneTap).toBe(false);
        await expect(page.locator('#queueStationModeBadge')).toContainText(
            'Libre'
        );
        await expect(page.locator('#queueStationBadge')).toContainText(
            'Estación C1'
        );
        await expect(
            page.locator('[data-action="queue-toggle-one-tap"]')
        ).toContainText('1 tecla OFF');
        await expect(page.locator('#queueShortcutPanel')).toBeHidden();
        await expect(
            page.locator('[data-action="queue-clear-call-key"]')
        ).toBeHidden();
        await expect(page.locator('#queueTicketLookupInput')).toHaveValue('');
        await expect(page.locator('#queueTableBody')).not.toContainText(
            'A-1999'
        );
    });

    test('queue bloquea el piloto web si una superficie reporta otra ruta canónica', async ({
        page,
    }) => {
        const nowIso = new Date().toISOString();
        const clinicProfile = buildQueuePilotClinicProfile({
            clinicId: 'clinica-sur-alerta',
            branding: {
                name: 'Clínica Sur',
                legal_name: 'Clínica Sur Piloto',
                short_name: 'Sur',
                base_url: 'https://clinica-sur.example',
            },
            consultorios: {
                c1: {
                    label: 'Consultorio 1',
                    short_label: 'S1',
                },
                c2: {
                    label: 'Consultorio 2',
                    short_label: 'S2',
                },
            },
        });

        await installQueueAdminAuthMock(page, 'csrf_queue_pilot_route_alert');
        await installQueuePilotApiMocks(page, {
            queueState: buildQueueIdleState(nowIso),
            clinicProfile,
            clinicProfileMeta: {
                source: 'remote',
                cached: false,
                clinicId: clinicProfile.clinic_id,
                fetchedAt: nowIso,
            },
            queueSurfaceStatus: buildQueuePilotSurfaceStatus({
                updatedAt: nowIso,
                clinicId: clinicProfile.clinic_id,
                operator: {
                    status: 'alert',
                    ageSec: 7,
                    summary:
                        'Operador abrió una ruta distinta al canon del piloto.',
                    latest: {
                        deviceLabel: 'Operador Sur',
                    },
                    details: {
                        station: 'c1',
                        surfaceContractState: 'alert',
                        surfaceRouteCurrent: '/operador-alt.html',
                    },
                },
                kiosk: {
                    ageSec: 10,
                    latest: {
                        deviceLabel: 'Kiosco Sur',
                    },
                },
                display: {
                    ageSec: 9,
                    latest: {
                        deviceLabel: 'Sala Sur',
                    },
                },
            }),
            healthPayload: buildQueuePilotHealthPayload({
                publicSync: {
                    ageSeconds: 12,
                },
            }),
        });

        await page.goto(adminUrl());
        await expect(page.locator('#adminDashboard')).toBeVisible();
        await page.locator('.nav-item[data-section="queue"]').click();

        await expect(
            page.locator('#queueOpsPilotReadinessTitle')
        ).toContainText('Piloto web bloqueado');
        await expect(
            page.locator('#queueOpsPilotReadinessItem_surfaces')
        ).toContainText('1 superficie');
        await expect(
            page.locator('#queueOpsPilotCanonItem_operator')
        ).toContainText('Bloquea');
        await expect(
            page.locator('#queueOpsPilotCanonItem_operator')
        ).toContainText('/operador-alt.html');
        await expect(
            page.locator('#queueOpsPilotCanonItem_operator')
        ).toContainText('/operador-turnos.html');
        await expect(page.locator('#queueOpsPilotCanonSupport')).toContainText(
            '1 superficie'
        );
        await expect(
            page.locator('#queueOpsPilotSmokeItem_operator')
        ).toContainText('Bloquea');
    });

    test('queue bloquea el piloto web si el perfil clínico solo existe en fallback local', async ({
        page,
    }) => {
        const nowIso = new Date().toISOString();
        const fallbackProfile = {
            schema: 'turnero-clinic-profile/v1',
            clinic_id: 'clinica-cache-demo',
            branding: {
                name: 'Clínica Cache',
                short_name: 'Cache',
                base_url: 'https://clinica-cache.example',
            },
            consultorios: {
                c1: {
                    label: 'Consultorio Cache 1',
                    short_label: 'K1',
                },
                c2: {
                    label: 'Consultorio Cache 2',
                    short_label: 'K2',
                },
            },
            surfaces: {
                admin: {
                    enabled: true,
                    label: 'Admin web',
                    route: '/admin.html#queue',
                },
                operator: {
                    enabled: true,
                    label: 'Operador web',
                    route: '/operador-turnos.html',
                },
                kiosk: {
                    enabled: true,
                    label: 'Kiosco web',
                    route: '/kiosco-turnos.html',
                },
                display: {
                    enabled: true,
                    label: 'Sala web',
                    route: '/sala-turnos.html',
                },
            },
            release: {
                mode: 'web_pilot',
                admin_mode_default: 'basic',
                separate_deploy: true,
                native_apps_blocking: false,
            },
        };

        await page.addInitScript(
            ({ profile, fetchedAt }) => {
                window.localStorage.setItem(
                    'turnero-clinic-profile',
                    JSON.stringify(profile)
                );
                window.localStorage.setItem(
                    'turnero-clinic-profile-meta',
                    JSON.stringify({
                        source: 'fallback_local',
                        cached: true,
                        clinicId: profile.clinic_id,
                        fetchedAt,
                    })
                );
            },
            {
                profile: fallbackProfile,
                fetchedAt: nowIso,
            }
        );

        await installQueueAdminAuthMock(page, 'csrf_queue_pilot_local_profile');
        await installQueuePilotApiMocks(page, {
            queueState: buildQueueIdleState(nowIso),
            clinicId: 'clinica-cache-demo',
            clinicProfileCatalogStatus: buildTurneroClinicProfileCatalogStatus({
                clinicId: 'clinica-cache-demo',
            }),
            queueSurfaceStatus: buildQueuePilotSurfaceStatus({
                updatedAt: nowIso,
                clinicId: 'clinica-cache-demo',
                operator: {
                    ageSec: 6,
                    latest: {
                        deviceLabel: 'Operador Cache',
                    },
                },
                kiosk: {
                    ageSec: 7,
                    latest: {
                        deviceLabel: 'Kiosco Cache',
                    },
                },
                display: {
                    ageSec: 8,
                    latest: {
                        deviceLabel: 'Sala Cache',
                    },
                },
            }),
            healthPayload: buildQueuePilotHealthPayload({
                publicSync: {
                    ageSeconds: 18,
                },
            }),
        });

        await page.goto(adminUrl());
        await expect(page.locator('#adminDashboard')).toBeVisible();
        await page.locator('.nav-item[data-section="queue"]').click();

        await expect(
            page.locator('#queueOpsPilotReadinessTitle')
        ).toContainText('Piloto web bloqueado');
        await expect(
            page.locator('#queueOpsPilotReadinessItem_profile')
        ).toContainText('cacheado localmente');
        await expect(
            page.locator('#queueOpsPilotHandoffItem_profile_source')
        ).toContainText('fallback local');
        await expect(
            page.locator('#queueOpsPilotReadinessItem_publish')
        ).toContainText('public_main_sync sano');
        await expect(
            page.locator('#queueOpsPilotCanonItem_operator')
        ).toContainText('Verificada');
    });

    test('queue bloquea el piloto web si una superficie reporta clinic_id de otra clínica', async ({
        page,
    }) => {
        const nowIso = new Date().toISOString();
        const clinicProfile = buildQueuePilotClinicProfile({
            clinicId: 'clinica-centro-demo',
            branding: {
                name: 'Clínica Centro',
                short_name: 'Centro',
                base_url: 'https://clinica-centro.example',
            },
            consultorios: {
                c1: {
                    label: 'Consultorio Centro 1',
                    short_label: 'C1',
                },
                c2: {
                    label: 'Consultorio Centro 2',
                    short_label: 'C2',
                },
            },
        });

        await installQueueAdminAuthMock(page, 'csrf_queue_pilot_clinic_drift');
        await installQueuePilotApiMocks(page, {
            queueState: buildQueueIdleState(nowIso),
            clinicProfile,
            clinicProfileMeta: {
                source: 'remote',
                cached: false,
                clinicId: clinicProfile.clinic_id,
                fetchedAt: nowIso,
            },
            queueSurfaceStatus: buildQueuePilotSurfaceStatus({
                updatedAt: nowIso,
                clinicId: clinicProfile.clinic_id,
                operator: {
                    ageSec: 5,
                    summary: 'Operador reporta otra clínica.',
                    latest: {
                        deviceLabel: 'Operador Centro',
                    },
                    details: {
                        clinicId: 'clinica-sur-demo',
                    },
                },
                kiosk: {
                    ageSec: 7,
                    latest: {
                        deviceLabel: 'Kiosco Centro',
                    },
                },
                display: {
                    ageSec: 8,
                    latest: {
                        deviceLabel: 'Sala Centro',
                    },
                },
            }),
            healthPayload: buildQueuePilotHealthPayload({
                publicSync: {
                    ageSeconds: 14,
                },
            }),
        });

        await page.goto(adminUrl());
        await expect(page.locator('#adminDashboard')).toBeVisible();
        await page.locator('.nav-item[data-section="queue"]').click();

        await expect(
            page.locator('#queueOpsPilotReadinessTitle')
        ).toContainText('Piloto web bloqueado');
        await expect(
            page.locator('#queueOpsPilotReadinessItem_surfaces')
        ).toContainText('vivas fuera');
        await expect(
            page.locator('#queueOpsPilotCanonItem_operator')
        ).toContainText('Bloquea');
        await expect(
            page.locator('#queueOpsPilotCanonItem_operator')
        ).toContainText('clinica-sur-demo');
        await expect(
            page.locator('#queueOpsPilotSmokeItem_operator')
        ).toContainText('Bloquea');
        await expect(
            page.locator('#queueOpsPilotHandoffItem_canon')
        ).toContainText('1 bloqueo');
    });

    test('queue bloquea el piloto web si una superficie trae una firma de perfil desactualizada', async ({
        page,
    }) => {
        const nowIso = new Date().toISOString();
        const clinicProfile = buildQueuePilotClinicProfile({
            clinicId: 'clinica-aurora-demo',
            branding: {
                name: 'Clínica Aurora',
                short_name: 'Aurora',
                base_url: 'https://clinica-aurora.example',
            },
            consultorios: {
                c1: {
                    label: 'Consultorio Aurora 1',
                    short_label: 'A1',
                },
                c2: {
                    label: 'Consultorio Aurora 2',
                    short_label: 'A2',
                },
            },
        });

        await installQueueAdminAuthMock(
            page,
            'csrf_queue_pilot_profile_fingerprint'
        );
        await installQueuePilotApiMocks(page, {
            queueState: buildQueueIdleState(nowIso),
            clinicProfile,
            queueSurfaceStatus: buildQueuePilotSurfaceStatus({
                updatedAt: nowIso,
                clinicId: clinicProfile.clinic_id,
                operator: {
                    ageSec: 5,
                    summary: 'Operador con perfil anterior.',
                    latest: {
                        deviceLabel: 'Operador Aurora',
                    },
                    details: {
                        profileFingerprint: 'legacy001',
                    },
                },
                kiosk: {
                    ageSec: 7,
                    latest: {
                        deviceLabel: 'Kiosco Aurora',
                    },
                    details: {
                        profileFingerprint: 'legacy001',
                    },
                },
                display: {
                    ageSec: 8,
                    latest: {
                        deviceLabel: 'Sala Aurora',
                    },
                    details: {
                        profileFingerprint: 'legacy001',
                    },
                },
            }),
            healthPayload: buildQueuePilotHealthPayload({
                publicSync: {
                    ageSeconds: 15,
                },
            }),
        });

        await page.goto(adminUrl());
        await expect(page.locator('#adminDashboard')).toBeVisible();
        await page.locator('.nav-item[data-section="queue"]').click();

        await expect(
            page.locator('#queueOpsPilotReadinessTitle')
        ).toContainText('Piloto web bloqueado');
        await expect(
            page.locator('#queueOpsPilotCanonItem_operator')
        ).toContainText('legacy001');
        await expect(
            page.locator('#queueOpsPilotCanonItem_operator')
        ).toContainText('Bloquea');
        await expect(
            page.locator('#queueOpsPilotSmokeItem_operator')
        ).toContainText('firma');
    });

    test('queue advierte en readiness si /health reporta otra clínica activa para el piloto', async ({
        page,
    }) => {
        const nowIso = new Date().toISOString();
        const clinicProfile = buildQueuePilotClinicProfile({
            clinicId: 'clinica-lago-demo',
            branding: {
                name: 'Clínica Lago',
                short_name: 'Lago',
                base_url: 'https://clinica-lago.example',
            },
            consultorios: {
                c1: {
                    label: 'Lago 1',
                    short_label: 'L1',
                },
                c2: {
                    label: 'Lago 2',
                    short_label: 'L2',
                },
            },
        });

        await installQueueAdminAuthMock(page, 'csrf_queue_pilot_health_clinic');
        await installQueuePilotApiMocks(page, {
            queueState: buildQueueIdleState(nowIso),
            clinicProfile,
            clinicProfileMeta: {
                source: 'remote',
                cached: false,
                clinicId: clinicProfile.clinic_id,
                fetchedAt: nowIso,
                profileFingerprint: 'lago0001',
            },
            queueSurfaceStatus: buildQueuePilotSurfaceStatus({
                updatedAt: nowIso,
                clinicId: clinicProfile.clinic_id,
                operator: {
                    ageSec: 4,
                    latest: {
                        deviceLabel: 'Operador Lago',
                    },
                    details: {
                        profileFingerprint: 'lago0001',
                    },
                },
                kiosk: {
                    ageSec: 5,
                    latest: {
                        deviceLabel: 'Kiosco Lago',
                    },
                    details: {
                        profileFingerprint: 'lago0001',
                    },
                },
                display: {
                    ageSec: 6,
                    latest: {
                        deviceLabel: 'Sala Lago',
                    },
                    details: {
                        profileFingerprint: 'lago0001',
                    },
                },
            }),
            healthPayload: buildQueuePilotHealthPayload({
                publicSync: {
                    deployedCommit: '4cb7bf723aa88f53f52b6bcfddf7004bb83faa19',
                    ageSeconds: 11,
                },
                checks: {
                    turneroPilot: {
                        configured: true,
                        ready: true,
                        profileSource: 'file',
                        clinicId: 'clinica-sur-real',
                        profileFingerprint: 'sur00001',
                        catalogAvailable: true,
                        catalogMatched: true,
                        catalogReady: true,
                        catalogEntryId: 'clinica-sur-real',
                        releaseMode: 'web_pilot',
                        adminModeDefault: 'basic',
                        separateDeploy: true,
                        nativeAppsBlocking: false,
                        surfaces: clinicProfile.surfaces,
                    },
                },
            }),
        });

        await page.goto(adminUrl());
        await expect(page.locator('#adminDashboard')).toBeVisible();
        await page.locator('.nav-item[data-section="queue"]').click();

        await expect(
            page.locator('#queueOpsPilotReadinessTitle')
        ).toContainText('Piloto web casi listo');
        await expect(
            page.locator('#queueOpsPilotReadinessItem_health')
        ).toContainText('clinica-sur-real');
        await expect(
            page.locator('#queueOpsPilotIssuesItem_health')
        ).toContainText('clinica-sur-real');
    });

    test('queue bloquea el piloto web si una superficie usa perfil de respaldo por clinic-profile faltante', async ({
        page,
    }) => {
        const nowIso = new Date().toISOString();
        const clinicProfile = buildQueuePilotClinicProfile({
            clinicId: 'clinica-bosque-demo',
            branding: {
                name: 'Clínica Bosque',
                short_name: 'Bosque',
                base_url: 'https://clinica-bosque.example',
            },
            consultorios: {
                c1: {
                    label: 'Consultorio Bosque 1',
                    short_label: 'B1',
                },
                c2: {
                    label: 'Consultorio Bosque 2',
                    short_label: 'B2',
                },
            },
        });

        await installQueueAdminAuthMock(
            page,
            'csrf_queue_pilot_profile_missing'
        );
        await installQueuePilotApiMocks(page, {
            queueState: buildQueueIdleState(nowIso),
            clinicProfile,
            clinicProfileMeta: {
                source: 'remote',
                cached: false,
                clinicId: clinicProfile.clinic_id,
                profileFingerprint: 'bosque123',
                fetchedAt: nowIso,
            },
            queueSurfaceStatus: buildQueuePilotSurfaceStatus({
                updatedAt: nowIso,
                clinicId: clinicProfile.clinic_id,
                operator: {
                    status: 'alert',
                    ageSec: 5,
                    summary:
                        'No se pudo cargar clinic-profile.json; la superficie quedó con perfil de respaldo y no puede operar como piloto.',
                    latest: {
                        deviceLabel: 'Operador Bosque',
                    },
                    details: {
                        clinicId: 'default-clinic',
                        profileSource: 'fallback_default',
                        profileFingerprint: 'fallback01',
                        surfaceContractState: 'alert',
                    },
                },
                kiosk: {
                    ageSec: 7,
                    latest: {
                        deviceLabel: 'Kiosco Bosque',
                    },
                    details: {
                        profileSource: 'remote',
                        profileFingerprint: 'bosque123',
                    },
                },
                display: {
                    ageSec: 8,
                    latest: {
                        deviceLabel: 'Sala Bosque',
                    },
                    details: {
                        profileSource: 'remote',
                        profileFingerprint: 'bosque123',
                    },
                },
            }),
            healthPayload: buildQueuePilotHealthPayload({
                publicSync: {
                    ageSeconds: 18,
                },
            }),
        });

        await page.goto(adminUrl());
        await expect(page.locator('#adminDashboard')).toBeVisible();
        await page.locator('.nav-item[data-section="queue"]').click();

        await expect(
            page.locator('#queueOpsPilotReadinessTitle')
        ).toContainText('Piloto web bloqueado');
        await expect(
            page.locator('#queueOpsPilotIssuesItem_surface_operator')
        ).toContainText('clinic-profile.json');
        await expect(
            page.locator('#queueOpsPilotCanonItem_operator')
        ).toContainText('perfil de respaldo');
        await expect(
            page.locator('#queueOpsPilotSmokeItem_operator')
        ).toContainText('clinic-profile.json');
        await expect(
            page.locator('#queueOpsPilotHandoffItem_blockers')
        ).toContainText('clinic-profile.json');
    });

    test('queue bloquea acciones operativas del admin si admin.html#queue queda fuera del canon del piloto', async ({
        page,
    }) => {
        const nowIso = new Date().toISOString();
        const queueCallNextRequests = [];
        const queueTickets = [
            {
                id: 9101,
                ticketCode: 'A-9101',
                queueType: 'appointment',
                patientInitials: 'QP',
                priorityClass: 'appt_current',
                status: 'waiting',
                assignedConsultorio: 1,
                createdAt: new Date(Date.now() - 5 * 60 * 1000).toISOString(),
            },
        ];
        const queueState = buildQueueStateFromTickets(queueTickets);
        const clinicProfile = buildQueuePilotClinicProfile({
            clinicId: 'clinica-admin-bloqueada',
            branding: {
                name: 'Clínica Admin Bloqueada',
                short_name: 'Admin Bloq',
                base_url: 'https://clinica-admin-bloqueada.example',
            },
            consultorios: {
                c1: {
                    label: 'Consultorio 1',
                    short_label: 'AB1',
                },
                c2: {
                    label: 'Consultorio 2',
                    short_label: 'AB2',
                },
            },
            surfaces: {
                admin: {
                    route: '/admin-alt.html#queue',
                },
            },
        });

        await installQueueAdminAuthMock(page, 'csrf_queue_admin_pilot_block');
        await installQueuePilotApiMocks(page, {
            queueTickets,
            queueState,
            clinicProfile,
            clinicProfileMeta: {
                source: 'remote',
                cached: false,
                clinicId: clinicProfile.clinic_id,
                fetchedAt: nowIso,
            },
            queueSurfaceStatus: buildQueuePilotSurfaceStatus({
                updatedAt: nowIso,
                clinicId: clinicProfile.clinic_id,
                operator: {
                    ageSec: 6,
                    latest: {
                        deviceLabel: 'Operador Bloq',
                    },
                },
                kiosk: {
                    ageSec: 7,
                    latest: {
                        deviceLabel: 'Kiosco Bloq',
                    },
                },
                display: {
                    ageSec: 8,
                    latest: {
                        deviceLabel: 'Sala Bloq',
                    },
                },
            }),
            healthPayload: buildQueuePilotHealthPayload({
                publicSync: {
                    deployedCommit: '03729fced585d79a66e6dd40e026cdb9fef3fdc7',
                    ageSeconds: 20,
                },
            }),
            handleRoute: async ({
                route,
                resource,
                intendedMethod,
                fulfillJson,
            }) => {
                if (
                    resource === 'queue-call-next' &&
                    intendedMethod === 'POST'
                ) {
                    queueCallNextRequests.push(
                        route.request().postData() || ''
                    );
                    await fulfillJson(route, {
                        ok: true,
                        data: {
                            queueState,
                        },
                    });
                    return true;
                }

                return false;
            },
        });

        await page.goto(adminUrl());
        await expect(page.locator('#adminDashboard')).toBeVisible();
        await page.locator('.nav-item[data-section="queue"]').click();

        await expect(
            page.locator('#queueOpsPilotReadinessTitle')
        ).toContainText('Piloto web bloqueado');
        await page
            .locator(
                '#queue .queue-admin-header-actions [data-action="queue-call-next"][data-queue-consultorio="1"]'
            )
            .click();
        await expect(page.locator('#toastContainer')).toContainText(
            'No se puede operar esta clínica desde admin'
        );
        await expect.poll(() => queueCallNextRequests.length).toBe(0);

        await page.evaluate(() => {
            if (document.activeElement instanceof HTMLElement) {
                document.activeElement.blur();
            }
        });
        await page.keyboard.press('NumpadEnter');
        await expect(page.locator('#toastContainer')).toContainText(
            'No se puede operar esta clínica desde admin'
        );
        await expect.poll(() => queueCallNextRequests.length).toBe(0);

        await page.locator('#queueConsultorioPrimary_c1').click();
        await expect(page.locator('#toastContainer')).toContainText(
            'No se puede operar esta clínica desde admin'
        );
        await expect.poll(() => queueCallNextRequests.length).toBe(0);
    });

    test('queue muestra hub de apps operativas con desktop y Android TV', async ({
        page,
    }) => {
        test.setTimeout(45000);
        let dataRequestCount = 0;

        await page.addInitScript(() => {
            window.__QUEUE_AUTO_REFRESH_INTERVAL_MS__ = 120;
        });

        await installQueueAdminAuthMock(page, 'csrf_queue_apps_hub');

        await installQueueOperationalAppsApiMocks(page, {
            queueSurfaceStatus: () => {
                dataRequestCount += 1;
                const updatedAt = new Date().toISOString();
                const operatorAge = dataRequestCount > 1 ? 3 : 8;
                return buildQueueOperationalAppsSurfaceStatus({
                    operator: buildQueueDesktopOperatorSurfaceStatus({
                        updatedAt,
                        status: 'ready',
                        ageSec: operatorAge,
                        summary:
                            dataRequestCount > 1
                                ? 'Equipo listo para operar en C1 fijo. Pulso renovado.'
                                : 'Equipo listo para operar en C1 fijo.',
                        latest: buildQueueDesktopOperatorInstance({
                            deviceLabel: 'Operador C1 fijo',
                            ageSec: operatorAge,
                            details: {
                                station: 'c1',
                                stationMode: 'locked',
                                oneTap: false,
                                numpadSeen: true,
                            },
                        }),
                        instances: [],
                    }),
                    kiosk: buildQueueOperationalSurfaceStatusEntry('kiosk', {
                        status: 'warning',
                        updatedAt,
                        ageSec: 18,
                        stale: false,
                        summary:
                            'Falta probar ticket térmico antes de abrir autoservicio.',
                        latest: {
                            deviceLabel: 'Kiosco principal',
                            appMode: 'desktop',
                            ageSec: 18,
                            details: {
                                connection: 'live',
                                pendingOffline: 0,
                                printerPrinted: false,
                            },
                        },
                        instances: [],
                    }),
                    display: buildQueueOperationalSurfaceStatusEntry(
                        'display',
                        {
                            status: 'ready',
                            updatedAt,
                            ageSec: 12,
                            stale: false,
                            summary:
                                'Sala TV lista: cola en vivo, audio activo y respaldo local disponible.',
                            latest: {
                                deviceLabel: 'Sala TV TCL C655',
                                appMode: 'android_tv',
                                ageSec: 12,
                                details: {
                                    connection: 'live',
                                    bellMuted: false,
                                    bellPrimed: true,
                                },
                            },
                            instances: [],
                        }
                    ),
                });
            },
        });

        await page.goto(adminUrl());
        await expect(page.locator('#adminDashboard')).toBeVisible();

        await page.locator('.nav-item[data-section="queue"]').click();
        await expect(page.locator('#queueAppsHub')).toBeVisible();
        await expect(page.locator('#queueAppsHub')).toHaveAttribute(
            'data-queue-admin-mode',
            'expert'
        );
        await expect(page.locator('#queueAdminViewMode')).toBeVisible();
        await expect(page.locator('#queueAdminViewModeChip')).toContainText(
            'Expert activo'
        );
        await expect(page.locator('#queueFocusMode')).toBeVisible();
        await expect(page.locator('#queueFocusModeTitle')).toContainText(
            'Modo foco: Apertura'
        );
        await expect(page.locator('#queueFocusModeChip')).toContainText(
            'Auto -> opening'
        );
        await expect(page.locator('#queueAppsHub')).toHaveAttribute(
            'data-queue-focus',
            'opening'
        );
        await expect(page.locator('#queueAppsRefreshShieldChip')).toContainText(
            'Refresh sin bloqueo'
        );
        await page.locator('#queueInstallSurfaceSelect').focus();
        await expect
            .poll(async () => {
                const state = await page
                    .locator('#queueAppsRefreshShieldChip')
                    .getAttribute('data-state');
                return state || '';
            })
            .toMatch(/active|deferred/);
        await expect
            .poll(async () => {
                const text = await page
                    .locator('#queueAppsRefreshShieldChip')
                    .textContent();
                return text || '';
            })
            .toMatch(/Protegiendo interacción|Refresh en espera/);
        await page.locator('#refreshAdminDataBtn').click();
        await expect(
            page.locator('#queueAppsRefreshShieldChip')
        ).toHaveAttribute('data-state', 'deferred');
        await expect(page.locator('#queueAppsRefreshShieldChip')).toContainText(
            'Refresh en espera'
        );
        await expect(
            page.locator('#queueAppsRefreshShieldChip')
        ).toHaveAttribute('data-state', 'idle', {
            timeout: 2500,
        });
        await expect(page.locator('#queueDomainSwitcher')).toBeVisible();
        await expect(page.locator('#queueDomainTitle')).toContainText(
            'Experiencia: Despliegue'
        );
        await expect(page.locator('#queueDomainSummary')).toContainText(
            'Instaladores, checklist, configuracion'
        );
        await expect(page.locator('#queueDomainChip')).toContainText(
            'Auto -> deployment'
        );
        await expect(page.locator('#queueDomainPrimary')).toHaveAttribute(
            'href',
            '#queueAppDownloadsCards'
        );
        await expect(page.locator('#queueAppsHub')).toHaveAttribute(
            'data-queue-domain',
            'deployment'
        );
        await expect(page.locator('#queueNumpadGuide')).toBeHidden();
        await expect(page.locator('#queueSurfaceTelemetry')).toBeHidden();
        await expect(page.locator('#queueContingencyDeck')).toBeHidden();

        await expect(page.locator('#queuePlaybook')).toBeVisible();
        await expect(page.locator('#queuePlaybookTitle')).toContainText(
            'Playbook activo: Apertura'
        );
        await expect(page.locator('#queuePlaybookChip')).toContainText(
            'Paso 1/3'
        );
        await expect(page.locator('#queuePlaybookAssistChip')).toContainText(
            'Sugeridos 2'
        );
        await expect(page.locator('#queuePlaybookSteps')).toContainText(
            'Abrir Operador'
        );
        await expect(page.locator('#queueOpsPilot')).toBeVisible();
        await expect(page.locator('#queueOpsPilotTitle')).toContainText(
            'Confirma 2 paso(s) ya validados'
        );
        await expect(page.locator('#queueOpsPilotChipSuggested')).toContainText(
            'Sugeridos 2'
        );
        await expect(page.locator('#queueOpsPilotChipEquipment')).toContainText(
            'Equipos listos 2/3'
        );
        await expect(page.locator('#queueOpeningChecklist')).toBeVisible();
        await expect(page.locator('#queueOpeningChecklistTitle')).toContainText(
            'Apertura diaria asistida'
        );
        await expect(
            page.locator('#queueOpeningChecklistAssistChip')
        ).toContainText('Sugeridos 2');
        await expect(
            page.locator('#queueOpeningChecklistApplyBtn')
        ).toContainText('Confirmar sugeridos (2)');
        await expect(page.locator('#queueOpsLog')).toBeVisible();
        await expect(page.locator('#queueOpsLogTitle')).toContainText(
            'Bitácora operativa del día'
        );
        await expect(page.locator('#queueOpsLogChip')).toContainText(
            'Sin eventos'
        );

        await page.locator('#queueDomainOperations').dispatchEvent('click');
        await expect(page.locator('#queueAppsHub')).toHaveAttribute(
            'data-queue-domain',
            'operations'
        );
        await expect(page.locator('#queueDomainTitle')).toContainText(
            'Experiencia: Operacion'
        );
        await expect(page.locator('#queueDomainChip')).toContainText(
            'Manual -> operations'
        );
        await expect(page.locator('#queueDomainPrimary')).toHaveAttribute(
            'href',
            '#queueConsultorioBoard'
        );
        await expect(page.locator('#queueDomainAuto')).toBeVisible();
        await expect(page.locator('#queueOpsPilot')).toBeHidden();
        await expect(page.locator('#queueNumpadGuide')).toBeVisible();
        await expect(page.locator('#queueNumpadGuideTitle')).toContainText(
            'Numpad en vivo'
        );
        await expect(page.locator('#queueNumpadGuideSummary')).toContainText(
            'Admin en C1 libre, pero Operador reporta C1 fijo'
        );
        await expect(
            page.locator('#queueNumpadGuideChipStation')
        ).toContainText('Admin C1 libre');
        await expect(
            page.locator('#queueNumpadGuideChipOperator')
        ).toContainText('Operador C1 fijo');
        await expect(page.locator('#queueNumpadGuideChipOneTap')).toContainText(
            '1 tecla OFF'
        );
        await expect(
            page.locator('#queueNumpadGuideChipBinding')
        ).toContainText('Enter integrado');
        await expect(page.locator('#queueNumpadGuideKey_enter')).toContainText(
            'Sin ticket en espera para C1'
        );
        await expect(
            page.locator('#queueNumpadGuideKey_station')
        ).toContainText('1/2 cambian la estación activa');
        await expect(page.locator('#queueConsultorioBoard')).toBeVisible();
        await expect(page.locator('#queueConsultorioBoardTitle')).toContainText(
            'Mesa por consultorio'
        );
        await expect(
            page.locator('#queueConsultorioBoardStatus')
        ).toContainText('1 pendiente');
        await expect(page.locator('#queueConsultorioCard_c1')).toContainText(
            'Operador C1 fijo'
        );
        await expect(page.locator('#queueConsultorioCurrent_c1')).toContainText(
            'Sin llamado'
        );
        await expect(page.locator('#queueConsultorioNext_c1')).toContainText(
            'Sin ticket en espera'
        );
        await expect(page.locator('#queueConsultorioCard_c2')).toContainText(
            'Sin operador dedicado'
        );
        await expect(page.locator('#queueConsultorioPrimary_c2')).toContainText(
            'Abrir Operador C2'
        );
        await expect(
            page.locator('#queueConsultorioOpenOperator_c2')
        ).toHaveAttribute('href', /operador-turnos\.html\?station=c2&lock=1/);
        await expect(page.locator('#queueAttentionDeck')).toBeVisible();
        await expect(page.locator('#queueAttentionDeckTitle')).toContainText(
            'Seguimiento de atención'
        );
        await expect(page.locator('#queueAttentionDeckCards')).toBeVisible();
        await expect(page.locator('#queueResolutionDeck')).toBeVisible();
        await expect(page.locator('#queueResolutionDeckTitle')).toContainText(
            'Resolución rápida'
        );
        await expect(page.locator('#queueResolutionDeckCards')).toBeVisible();
        await expect(page.locator('#queueTicketLookup')).toBeVisible();
        await expect(page.locator('#queueTicketLookupTitle')).toContainText(
            'Atajo por ticket'
        );
        await expect(page.locator('#queueTicketRoute')).toBeVisible();
        await expect(page.locator('#queueTicketRouteTitle')).toContainText(
            'Ruta del ticket'
        );
        await expect(page.locator('#queueTicketSimulation')).toBeVisible();
        await expect(page.locator('#queueTicketSimulationTitle')).toContainText(
            'Simulación operativa'
        );
        await expect(page.locator('#queueNextTurns')).toBeVisible();
        await expect(page.locator('#queueNextTurnsTitle')).toContainText(
            'Próximos turnos'
        );
        await expect(page.locator('#queueNextTurnsCards')).toBeVisible();
        await expect(page.locator('#queueMasterSequence')).toBeVisible();
        await expect(page.locator('#queueMasterSequenceTitle')).toContainText(
            'Ronda maestra'
        );
        await expect(page.locator('#queueCoverageDeck')).toBeVisible();
        await expect(page.locator('#queueCoverageDeckTitle')).toContainText(
            'Cobertura siguiente'
        );
        await expect(page.locator('#queueReserveDeck')).toBeVisible();
        await expect(page.locator('#queueReserveDeckTitle')).toContainText(
            'Reserva inmediata'
        );
        await expect(page.locator('#queueGeneralGuidance')).toBeVisible();
        await expect(page.locator('#queueGeneralGuidanceTitle')).toContainText(
            'Cola general guiada'
        );
        await expect(page.locator('#queueProjectedDeck')).toBeVisible();
        await expect(page.locator('#queueProjectedDeckTitle')).toContainText(
            'Proyección de cola'
        );
        await expect(page.locator('#queueIncomingDeck')).toBeVisible();
        await expect(page.locator('#queueIncomingDeckTitle')).toContainText(
            'Ingresos nuevos'
        );
        await expect(page.locator('#queueScenarioDeck')).toBeVisible();
        await expect(page.locator('#queueScenarioDeckTitle')).toContainText(
            'Escenarios de ingreso'
        );
        await expect(page.locator('#queueReceptionScript')).toBeVisible();
        await expect(page.locator('#queueReceptionScriptTitle')).toContainText(
            'Guion de recepción'
        );
        await expect(page.locator('#queueReceptionCollision')).toBeVisible();
        await expect(
            page.locator('#queueReceptionCollisionTitle')
        ).toContainText('Recepción simultánea');
        await expect(page.locator('#queueReceptionLights')).toBeVisible();
        await expect(page.locator('#queueReceptionLightsTitle')).toContainText(
            'Semáforo de recepción'
        );
        await expect(page.locator('#queueWindowDeck')).toBeVisible();
        await expect(page.locator('#queueWindowDeckTitle')).toContainText(
            'Ventana estimada'
        );
        await expect(page.locator('#queueDeskReply')).toBeVisible();
        await expect(page.locator('#queueDeskReplyTitle')).toContainText(
            'Respuesta de mostrador'
        );
        await expect(page.locator('#queueDeskFallback')).toBeVisible();
        await expect(page.locator('#queueDeskFallbackTitle')).toContainText(
            'Plan B de recepción'
        );
        await expect(page.locator('#queueDeskObjections')).toBeVisible();
        await expect(page.locator('#queueDeskObjectionsTitle')).toContainText(
            'Objeciones rápidas'
        );
        await expect(page.locator('#queueDeskCloseout')).toBeVisible();
        await expect(page.locator('#queueDeskCloseoutTitle')).toContainText(
            'Cierre de mostrador'
        );
        await expect(page.locator('#queueDeskRecheck')).toBeVisible();
        await expect(page.locator('#queueDeskRecheckTitle')).toContainText(
            'Revalidación de espera'
        );
        await expect(page.locator('#queueDeskShift')).toBeVisible();
        await expect(page.locator('#queueDeskShiftTitle')).toContainText(
            'Cambio de carril sugerido'
        );
        await expect(page.locator('#queueDeskPromise')).toBeVisible();
        await expect(page.locator('#queueDeskPromiseTitle')).toContainText(
            'Promesa segura'
        );
        await expect(page.locator('#queueDeskEscalation')).toBeVisible();
        await expect(page.locator('#queueDeskEscalationTitle')).toContainText(
            'Escalación sugerida'
        );
        await expect(page.locator('#queueDeskEscalationTalk')).toBeVisible();
        await expect(
            page.locator('#queueDeskEscalationTalkTitle')
        ).toContainText('Escala verbal');
        await expect(page.locator('#queueDeskEscalationConfirm')).toBeVisible();
        await expect(
            page.locator('#queueDeskEscalationConfirmTitle')
        ).toContainText('Confirmación de escala');
        await expect(
            page.locator('#queueDeskEscalationFollowup')
        ).toBeVisible();
        await expect(
            page.locator('#queueDeskEscalationFollowupTitle')
        ).toContainText('Seguimiento de escala');
        await expect(page.locator('#queueDeskEscalationReopen')).toBeVisible();
        await expect(
            page.locator('#queueDeskEscalationReopenTitle')
        ).toContainText('Reapertura de escala');
        await expect(page.locator('#queueDeskEscalationLimit')).toBeVisible();
        await expect(
            page.locator('#queueDeskEscalationLimitTitle')
        ).toContainText('Límite de reapertura');
        await expect(page.locator('#queueDeskEscalationBridge')).toBeVisible();
        await expect(
            page.locator('#queueDeskEscalationBridgeTitle')
        ).toContainText('Puente a operación');
        await expect(page.locator('#queueDeskEscalationBrief')).toBeVisible();
        await expect(
            page.locator('#queueDeskEscalationBriefTitle')
        ).toContainText('Brief para operador');
        await expect(page.locator('#queueDeskEscalationReturn')).toBeVisible();
        await expect(
            page.locator('#queueDeskEscalationReturnTitle')
        ).toContainText('Retorno a mostrador');
        await expect(
            page.locator('#queueDeskEscalationResolution')
        ).toBeVisible();
        await expect(
            page.locator('#queueDeskEscalationResolutionTitle')
        ).toContainText('Resolución devuelta');
        await expect(page.locator('#queueBlockers')).toBeVisible();
        await expect(page.locator('#queueBlockersTitle')).toContainText(
            'Bloqueos vivos'
        );
        await expect(page.locator('#queueSlaDeck')).toBeVisible();
        await expect(page.locator('#queueSlaDeckTitle')).toContainText(
            'SLA vivo'
        );
        await expect(page.locator('#queueWaitRadar')).toBeVisible();
        await expect(page.locator('#queueWaitRadarTitle')).toContainText(
            'Radar de espera'
        );
        await expect(page.locator('#queueWaitRadarCards')).toBeVisible();
        await expect(page.locator('#queueLoadBalance')).toBeVisible();
        await expect(page.locator('#queueLoadBalanceTitle')).toContainText(
            'Balance de carga'
        );
        await expect(page.locator('#queueLoadBalanceCards')).toBeVisible();
        await expect(page.locator('#queuePriorityLane')).toBeVisible();
        await expect(page.locator('#queuePriorityLaneTitle')).toContainText(
            'Fila priorizada'
        );
        await expect(page.locator('#queuePriorityLaneItems')).toBeVisible();
        await expect(page.locator('#queueQuickTrays')).toBeVisible();
        await expect(page.locator('#queueQuickTraysTitle')).toContainText(
            'Bandejas rápidas'
        );
        await expect(page.locator('#queueQuickTraysCards')).toBeVisible();
        await expect(page.locator('#queueActiveTray')).toBeVisible();
        await expect(page.locator('#queueActiveTrayTitle')).toContainText(
            'Bandeja activa'
        );
        await expect(page.locator('#queueActiveTrayItems')).toBeVisible();
        await expect(page.locator('#queueTrayBurst')).toBeVisible();
        await expect(page.locator('#queueTrayBurstTitle')).toContainText(
            'Ráfaga operativa'
        );
        await expect(page.locator('#queueTrayBurstSteps')).toBeVisible();
        await expect(page.locator('#queueDispatchDeck')).toBeVisible();
        await expect(page.locator('#queueDispatchDeckTitle')).toContainText(
            'Despacho sugerido'
        );
        await expect(page.locator('#queueDispatchDeckStatus')).toContainText(
            '1 bloqueo'
        );
        await expect(page.locator('#queueDispatchCard_c1')).toContainText(
            'preparado para el próximo ticket'
        );
        await expect(page.locator('#queueDispatchHeadline_c2')).toContainText(
            'sin operador dedicado'
        );
        await expect(page.locator('#queueDispatchPrimary_c2')).toContainText(
            'Abrir Operador C2'
        );
        await expect(
            page.locator('#queueDispatchOpenOperator_c2')
        ).toHaveAttribute('href', /operador-turnos\.html\?station=c2&lock=1/);
        await page
            .locator('#queueNumpadGuideToggleOneTap')
            .dispatchEvent('click');
        await expect(page.locator('#queueNumpadGuideChipOneTap')).toContainText(
            '1 tecla ON'
        );
        await expect(
            page.locator('[data-action="queue-toggle-one-tap"]').first()
        ).toContainText('1 tecla ON');
        await expect(page.locator('#queueQuickConsole')).toBeVisible();
        await expect(page.locator('#queueQuickConsoleTitle')).toContainText(
            'Consola rápida: Apertura'
        );
        await expect(page.locator('#queueQuickConsoleActions')).toContainText(
            'Confirmar sugeridos (2)'
        );
        await expect(page.locator('#queueShiftHandoff')).toBeVisible();
        await expect(page.locator('#queueShiftHandoffTitle')).toContainText(
            'Cierre y relevo asistido'
        );
        await expect(
            page.locator('#queueShiftHandoffAssistChip')
        ).toContainText('Sugeridos 4');
        await expect(page.locator('#queueShiftHandoffApplyBtn')).toContainText(
            'Confirmar sugeridos (4)'
        );
        await expect(page.locator('#queueShiftHandoffPreview')).toContainText(
            'Perfil actual operador: C1 fijo.'
        );
        await expect(page.locator('#queueOpsLog')).toBeHidden();

        await page.locator('#queueDomainIncidents').dispatchEvent('click');
        await expect(page.locator('#queueAppsHub')).toHaveAttribute(
            'data-queue-domain',
            'incidents'
        );
        await expect(page.locator('#queueDomainTitle')).toContainText(
            'Experiencia: Incidentes'
        );
        await expect(page.locator('#queueDomainChip')).toContainText(
            'Manual -> incidents'
        );
        await expect(page.locator('#queueDomainPrimary')).toHaveAttribute(
            'href',
            '#queueSurfaceTelemetry'
        );
        await expect(page.locator('#queueNumpadGuide')).toBeVisible();
        await expect(page.locator('#queuePlaybook')).toBeVisible();
        await expect(page.locator('#queueSurfaceTelemetry')).toBeVisible();
        await expect(
            page.locator('#queueSurfaceTelemetryAutoState')
        ).toContainText('Auto-refresh activo');
        await expect(
            page.locator('#queueSurfaceTelemetryAutoMeta')
        ).toContainText('ultimo ciclo');
        await expect(page.locator('#queueSurfaceTelemetryTitle')).toContainText(
            'Equipos con señal parcial'
        );
        await expect(page.locator('#queueSurfaceTelemetry')).toContainText(
            'Operador C1 fijo'
        );
        await expect(page.locator('#queueSurfaceTelemetry')).toContainText(
            'Android TV'
        );
        await expect(page.locator('#queueSurfaceTelemetry')).toContainText(
            'Térmica pendiente'
        );
        await expect(page.locator('#queueOpsAlerts')).toBeVisible();
        await expect(page.locator('#queueOpsAlertsTitle')).toContainText(
            'Observaciones activas del turno'
        );
        await expect(page.locator('#queueOpsAlertsChipTotal')).toContainText(
            'Alertas 1'
        );
        await expect(page.locator('#queueOpsAlertsChipPending')).toContainText(
            'Pendientes 1'
        );
        await expect(page.locator('#queueOpsAlertsItems')).toContainText(
            'Térmica pendiente en kiosco'
        );
        await expect(page.locator('#queueContingencyDeck')).toBeVisible();
        await expect(page.locator('#queueContingencyTitle')).toContainText(
            'Contingencia rápida lista'
        );
        await expect(page.locator('#queueContingencyDeck')).toContainText(
            'Numpad no responde'
        );
        await expect(page.locator('#queueContingencyDeck')).toContainText(
            'Térmica no imprime'
        );
        await expect(page.locator('#queueContingencyDeck')).toContainText(
            'Sala TV sin campanilla'
        );
        await expect(page.locator('#queueContingencySyncCard')).toContainText(
            'Cola sincronizada'
        );
        await expect(page.locator('#queueOpsLog')).toBeVisible();
        await expect(page.locator('#queueOpsLogTitle')).toContainText(
            'Bitácora operativa del día'
        );
        await expect(page.locator('#queueOpsLogChip')).toContainText(
            'Sin eventos'
        );
        await page.locator('#queueOpsLogStatusBtn').dispatchEvent('click');
        await expect(page.locator('#queueOpsLogChip')).toContainText(
            '1 evento(s) hoy'
        );
        await expect(page.locator('#queueOpsLogItems')).toContainText(
            'Estado actual registrado'
        );
        await page.locator('#queueOpsLogIncidentBtn').dispatchEvent('click');
        await expect(page.locator('#queueOpsLogChip')).toContainText(
            '2 evento(s) hoy'
        );
        await expect(page.locator('#queueOpsLogItems')).toContainText(
            'Incidencia: Kiosco'
        );
        await page
            .locator('#queueOpsAlertReview_kiosk_printer_pending')
            .dispatchEvent('click');
        await expect(page.locator('#queueOpsAlertsChipPending')).toContainText(
            'Pendientes 0'
        );
        await expect(page.locator('#queueOpsAlertsChipReviewed')).toContainText(
            'Revisadas 1'
        );
        await expect(
            page.locator('#queueOpsAlert_kiosk_printer_pending')
        ).toContainText('Revisada');
        await expect(page.locator('#queueOpsLogItems')).toContainText(
            'Alerta revisada: Kiosco'
        );
        await page.locator('#queueFocusModeIncidents').dispatchEvent('click');
        await expect(page.locator('#queueFocusModeChip')).toContainText(
            'Manual -> incidents'
        );
        await expect(page.locator('#queueFocusModeSummary')).toContainText(
            'contingencias'
        );
        await expect(page.locator('#queueAppsHub')).toHaveAttribute(
            'data-queue-focus',
            'incidents'
        );
        await expect(page.locator('#queueQuickConsoleTitle')).toContainText(
            'Consola rápida: Incidencias'
        );
        await expect(page.locator('#queueQuickConsoleActions')).toContainText(
            'Registrar incidencia'
        );
        await expect(page.locator('#queuePlaybookTitle')).toContainText(
            'Playbook activo: Incidencias'
        );
        await expect(page.locator('#queuePlaybookAssistChip')).toContainText(
            'Sugeridos 3'
        );
        await expect(page.locator('#queuePlaybookSteps')).toContainText(
            'Refrescar y confirmar sync'
        );
        await page.locator('#queueFocusModeAuto').dispatchEvent('click');
        await expect(page.locator('#queueFocusModeChip')).toContainText(
            'Auto -> opening'
        );
        await page.locator('#queueDomainAuto').dispatchEvent('click');
        await expect(page.locator('#queueAppsHub')).toHaveAttribute(
            'data-queue-domain',
            'deployment'
        );
        await expect(page.locator('#queueDomainChip')).toContainText(
            'Auto -> deployment'
        );
        await expect(page.locator('#queueAppDownloadsCards')).toBeVisible();
        await expect(
            page.locator('#queueAppDownloadsCards .queue-app-card')
        ).toHaveCount(3);
        await expect(page.locator('#queueAppDownloadsCards')).toContainText(
            'Operador'
        );
        await expect(page.locator('#queueAppDownloadsCards')).toContainText(
            'Kiosco'
        );
        await expect(page.locator('#queueAppDownloadsCards')).toContainText(
            'Sala TV'
        );
        await expect(page.locator('#queueAppDownloadsCards')).toContainText(
            'Mostrar QR de instalación'
        );
        await expect(page.locator('#queueAppDownloadsCards')).toContainText(
            'Descargar APK'
        );
        await expect(page.locator('#queueInstallConfigurator')).toContainText(
            'Asistente de instalación'
        );
        await page.locator('#queueOpsPilotApplyBtn').dispatchEvent('click');
        await expect(page.locator('#queueOpsPilotTitle')).toContainText(
            'Siguiente paso: Kiosco + ticket térmico'
        );
        await expect(page.locator('#queueOpeningChecklistTitle')).toContainText(
            'faltan 2 paso(s)'
        );
        await page.locator('#queueDomainOperations').dispatchEvent('click');
        await expect(page.locator('#queueQuickConsoleTitle')).toContainText(
            'Consola rápida: Apertura'
        );
        await page.locator('#queueDomainDeployment').dispatchEvent('click');
        await expect(page.locator('#queuePlaybook')).toBeVisible();
        await page.locator('#queuePlaybookAssistBtn').dispatchEvent('click');
        await expect(page.locator('#queuePlaybookAssistChip')).toContainText(
            'Sin sugeridos'
        );
        await expect(page.locator('#queueOpsLogItems')).toContainText(
            'Playbook opening: sugeridos confirmados'
        );
        await page.locator('#queuePlaybookApplyBtn').dispatchEvent('click');
        await expect(page.locator('#queuePlaybookChip')).toContainText(
            'Secuencia completa'
        );
        await expect(page.locator('#queueOpsLogItems')).toContainText(
            'Playbook opening: paso confirmado'
        );
        await expect(page.locator('#queueOpsLogItems')).toContainText(
            'Apertura: 2 sugerido(s) confirmados'
        );
        await page.locator('#queueDomainOperations').dispatchEvent('click');
        await page.locator('#queueShiftHandoffApplyBtn').dispatchEvent('click');
        await expect(page.locator('#queueShiftHandoffTitle')).toContainText(
            'Relevo listo'
        );
        await page.locator('#queueDomainIncidents').dispatchEvent('click');
        await expect(page.locator('#queueOpsLogItems')).toContainText(
            'Relevo: 4 sugerido(s) confirmados'
        );
        const openingChecklist = await page.evaluate(() =>
            JSON.parse(localStorage.getItem('queueOpeningChecklistV1') || '{}')
        );
        expect(openingChecklist.steps.operator_ready).toBe(true);
        expect(openingChecklist.steps.sala_ready).toBe(true);
        const shiftHandoffChecklist = await page.evaluate(() =>
            JSON.parse(localStorage.getItem('queueShiftHandoffV1') || '{}')
        );
        expect(shiftHandoffChecklist.steps.queue_clear).toBe(true);
        expect(shiftHandoffChecklist.steps.operator_handoff).toBe(true);
        expect(shiftHandoffChecklist.steps.kiosk_handoff).toBe(true);
        expect(shiftHandoffChecklist.steps.sala_handoff).toBe(true);
        const opsLogState = await page.evaluate(() =>
            JSON.parse(localStorage.getItem('queueOpsLogV1') || '{}')
        );
        expect(Array.isArray(opsLogState.items)).toBe(true);
        expect(opsLogState.items.length).toBeGreaterThanOrEqual(3);
        const opsAlertsState = await page.evaluate(() =>
            JSON.parse(localStorage.getItem('queueOpsAlertsV1') || '{}')
        );
        expect(opsAlertsState.reviewed.kiosk_printer_pending).toBeTruthy();
        const playbookState = await page.evaluate(() =>
            JSON.parse(localStorage.getItem('queueOpsPlaybookV1') || '{}')
        );
        expect(playbookState.modes.opening.opening_operator).toBe(true);
        expect(playbookState.modes.opening.opening_kiosk).toBe(true);
        expect(playbookState.modes.opening.opening_sala).toBe(true);
        await page.locator('#queueDomainAuto').dispatchEvent('click');
        await expect(page.locator('#queueAppsHub')).toHaveAttribute(
            'data-queue-domain',
            'deployment'
        );
        await page
            .locator('#queueOpeningChecklistResetBtn')
            .dispatchEvent('click');
        await expect(page.locator('#queueOpeningChecklistTitle')).toContainText(
            'Apertura diaria asistida'
        );
        await page.locator('#queueDomainOperations').dispatchEvent('click');
        await page.locator('#queueShiftHandoffResetBtn').dispatchEvent('click');
        await expect(page.locator('#queueShiftHandoffTitle')).toContainText(
            'Cierre y relevo asistido'
        );
        await page.locator('#queueDomainDeployment').dispatchEvent('click');
        await expect(page.locator('#queueInstallConfigurator')).toContainText(
            'Operador'
        );
        await expect(page.locator('#queueInstallConfigurator')).toContainText(
            'station=c1'
        );
        await expect(page.locator('#queueInstallConfigurator')).toContainText(
            'latest.yml'
        );
        await expect(page.locator('#queueInstallConfigurator')).toContainText(
            'PC 1 · C1 fijo'
        );
        await expect(page.locator('#queueInstallConfigurator')).toContainText(
            'PC 2 · C2 fijo'
        );
        await expect(
            page.locator('#queueInstallPreset_operator_c1_locked')
        ).toBeVisible();
        await expect(
            page.locator('#queueInstallPreset_operator_c2_locked')
        ).toBeVisible();
        await expect(page.locator('#queueInstallPreset_kiosk')).toBeVisible();
        await expect(page.locator('#queueInstallPreset_sala_tv')).toBeVisible();

        await page.locator('#queueInstallPreset_kiosk').dispatchEvent('click');
        await expect(page.locator('#queueInstallSurfaceSelect')).toHaveValue(
            'kiosk'
        );
        await expect(page.locator('#queueInstallConfigurator')).toContainText(
            'Kiosco listo para mostrador'
        );
        await expect(page.locator('#queueOpsLogItems')).toContainText(
            'Preset rápido: Kiosco'
        );

        await page
            .locator('#queueInstallPreset_operator_c2_locked')
            .dispatchEvent('click');
        await expect(page.locator('#queueInstallSurfaceSelect')).toHaveValue(
            'operator'
        );
        await expect(page.locator('#queueInstallProfileSelect')).toHaveValue(
            'c2_locked'
        );
        await expect(page.locator('#queueOpsLogItems')).toContainText(
            'Preset rápido: Operador C2'
        );

        await page
            .locator('#queueInstallProfileSelect')
            .selectOption('c2_locked');
        await page.locator('#queueInstallOneTapInput').check();

        await expect(page.locator('#queueInstallConfigurator')).toContainText(
            'Operador C2 fijo'
        );
        await expect(page.locator('#queueOpsLogItems')).toContainText(
            'Perfil operativo ajustado'
        );
        await expect(page.locator('#queueInstallConfigurator')).toContainText(
            'station=c2'
        );
        await expect(page.locator('#queueInstallConfigurator')).toContainText(
            'one_tap=1'
        );
        await expect(page.locator('#queueInstallConfigurator')).toContainText(
            'TurneroOperadorSetup.exe'
        );
        await expect(page.locator('#queueOpsLogItems')).toContainText(
            'Modo 1 tecla activado'
        );
        await page.locator('#queueOpsLogFilterChanges').dispatchEvent('click');
        await expect(page.locator('#queueOpsLogItems')).toContainText(
            'Modo 1 tecla activado'
        );
        await expect(page.locator('#queueOpsLogItems')).not.toContainText(
            'Estado actual registrado'
        );
        await page
            .locator('#queueOpsLogFilterIncidents')
            .dispatchEvent('click');
        await expect(page.locator('#queueOpsLogItems')).toContainText(
            'Incidencia: Kiosco'
        );
        await page.locator('#queueOpsLogFilterAll').dispatchEvent('click');
        await page.locator('#queueDomainIncidents').dispatchEvent('click');
        await expect(page.locator('#queueSurfaceTelemetry')).toContainText(
            'Abrir operador'
        );
        await expect(page.locator('#queueContingencyDeck')).toContainText(
            'C2 fijo'
        );
        await page.locator('#queueDomainDeployment').dispatchEvent('click');

        await page
            .locator('#queueInstallPreset_sala_tv')
            .dispatchEvent('click');
        await expect(page.locator('#queueInstallSurfaceSelect')).toHaveValue(
            'sala_tv'
        );
        await expect(page.locator('#queueInstallConfigurator')).toContainText(
            'Sala TV lista para TCL C655'
        );
        await expect(page.locator('#queueInstallConfigurator')).toContainText(
            'Android TV APK'
        );
        await expect(page.locator('#queueInstallConfigurator')).toContainText(
            'Abrir centro público'
        );
        const installPreset = await page.evaluate(() =>
            JSON.parse(localStorage.getItem('queueInstallPresetV1') || '{}')
        );
        expect(installPreset.surface).toBe('sala_tv');
        expect(installPreset.station).toBe('c2');
        expect(installPreset.lock).toBe(true);
        expect(installPreset.oneTap).toBe(true);

        const dataCountAtQueueOpen = dataRequestCount;
        await expect
            .poll(() => dataRequestCount)
            .toBeGreaterThan(dataCountAtQueueOpen);
        await page.locator('#queueDomainIncidents').dispatchEvent('click');
        await expect(page.locator('#queueSurfaceTelemetry')).toContainText(
            'Pulso renovado'
        );
    });

    test('admin muestra dos operadores Windows por estacion en operaciones e incidentes', async ({
        page,
    }) => {
        const nowIso = new Date().toISOString();
        const operatorInstances = [
            buildQueueDesktopOperatorInstance({
                station: 'c1',
                ageSec: 4,
                summary: 'Equipo listo para operar en C1 fijo.',
                details: {
                    station: 'c1',
                    stationMode: 'locked',
                    oneTap: false,
                    numpadSeen: true,
                    numpadReady: true,
                    numpadProgress: 4,
                    numpadRequired: 4,
                    numpadLabel: 'Numpad listo',
                    numpadSummary: 'Numpad listo · Numpad Enter, +, ., -',
                    shellUpdateMetadataUrl:
                        'https://pielarmonia.com/desktop-updates/pilot/operator/win/latest.yml',
                    shellInstallGuideUrl:
                        'https://pielarmonia.com/app-downloads/?surface=operator&platform=win&station=c1&lock=1&one_tap=0',
                    shellConfigPath:
                        'C:\\Users\\OperadorC1\\AppData\\Roaming\\TurneroOperador\\turnero-desktop.json',
                },
            }),
            buildQueueDesktopOperatorInstance({
                station: 'c2',
                ageSec: 6,
                effectiveStatus: 'warning',
                summary:
                    'Numpad 2/4 · faltan + y - antes de operar en C2 fijo.',
                details: {
                    station: 'c2',
                    stationMode: 'locked',
                    oneTap: true,
                    numpadSeen: true,
                    numpadReady: false,
                    numpadProgress: 2,
                    numpadRequired: 4,
                    numpadLabel: 'Numpad 2/4',
                    numpadSummary: 'Numpad 2/4 · faltan + y -',
                    shellUpdateMetadataUrl:
                        'https://pielarmonia.com/desktop-updates/pilot/operator/win/latest.yml',
                    shellInstallGuideUrl:
                        'https://pielarmonia.com/app-downloads/?surface=operator&platform=win&station=c2&lock=1&one_tap=1',
                    shellConfigPath:
                        'C:\\Users\\OperadorC2\\AppData\\Roaming\\TurneroOperador\\turnero-desktop.json',
                },
            }),
        ];

        await installQueueAdminAuthMock(page, 'csrf_queue_admin_dual_operator');
        await installQueueOperationalAppsApiMocks(page, {
            updatedAt: nowIso,
            queueState: buildQueueIdleState(nowIso),
            queueSurfaceStatus: buildQueueOperationalAppsSurfaceStatus({
                operator: buildQueueDesktopOperatorSurfaceStatus({
                    updatedAt: nowIso,
                    status: 'warning',
                    ageSec: 4,
                    summary:
                        'Un equipo operador listo y otro con numpad pendiente.',
                    latest: operatorInstances[0],
                    instances: operatorInstances,
                }),
            }),
        });

        await page.goto(adminUrl());
        await expect(page.locator('#adminDashboard')).toBeVisible();

        await page.locator('.nav-item[data-section="queue"]').click();
        await page.locator('#queueDomainOperations').dispatchEvent('click');
        await expect(page.locator('#queueAppsHub')).toHaveAttribute(
            'data-queue-domain',
            'operations'
        );
        await expect(page.locator('#queueConsultorioCard_c1')).toContainText(
            'Operador C1 fijo'
        );
        await expect(page.locator('#queueConsultorioCard_c1')).toContainText(
            'Desktop instalada'
        );
        await expect(page.locator('#queueConsultorioCard_c1')).toContainText(
            'Numpad listo'
        );
        await expect(page.locator('#queueConsultorioCard_c1')).toContainText(
            'Windows'
        );
        await expect(page.locator('#queueConsultorioCard_c2')).toContainText(
            'Operador C2 fijo'
        );
        await expect(page.locator('#queueConsultorioCard_c2')).toContainText(
            '1 tecla ON'
        );
        await expect(page.locator('#queueConsultorioCard_c2')).toContainText(
            'Numpad 2/4'
        );
        await expect(page.locator('#queueDispatchCard_c2')).toContainText(
            'Desktop instalada'
        );

        await page.locator('#queueDomainIncidents').click();
        await expect(page.locator('#queueAppsHub')).toHaveAttribute(
            'data-queue-domain',
            'incidents'
        );
        await expect(page.locator('#queueSurfaceTelemetry')).toContainText(
            '2 PCs operador reportando'
        );
        await expect(page.locator('#queueSurfaceTelemetry')).toContainText(
            'Operador C1 fijo'
        );
        await expect(page.locator('#queueSurfaceTelemetry')).toContainText(
            'Operador C2 fijo'
        );
        await expect(page.locator('#queueSurfaceTelemetry')).toContainText(
            'Desktop instalada'
        );
        await expect(page.locator('#queueSurfaceTelemetry')).toContainText(
            'Numpad listo'
        );
        await expect(page.locator('#queueSurfaceTelemetry')).toContainText(
            'Numpad 2/4'
        );
        await expect(page.locator('#queueSurfaceTelemetry')).toContainText(
            'Windows'
        );
        await expect(page.locator('#queueSurfaceTelemetry')).toContainText(
            'canal stable'
        );
        await expect(page.locator('#queueSurfaceTelemetry')).toContainText(
            'Feed'
        );
        await expect(page.locator('#queueSurfaceTelemetry')).toContainText(
            'latest.yml'
        );
        await expect(page.locator('#queueSurfaceTelemetry')).toContainText(
            'Guía'
        );
        await expect(page.locator('#queueSurfaceTelemetry')).toContainText(
            'station=c2'
        );
        await expect(page.locator('#queueSurfaceTelemetry')).toContainText(
            'Config local'
        );
        await expect(page.locator('#queueSurfaceTelemetry')).toContainText(
            'turnero-desktop.json'
        );
    });

    test('admin mantiene visible una desktop operador en configuracion local sin contarla como lista', async ({
        page,
    }) => {
        const nowIso = new Date().toISOString();
        const operatorInstance = buildQueueDesktopOperatorInstance({
            station: 'c1',
            ageSec: 5,
            effectiveStatus: 'warning',
            summary: 'Configuración local abierta en C1 fijo.',
            details: {
                station: 'c1',
                stationMode: 'locked',
                oneTap: false,
                numpadSeen: false,
                numpadReady: false,
                numpadProgress: 0,
                numpadRequired: 4,
                numpadLabel: 'Validar en operador',
                numpadSummary:
                    'La matriz del numpad se valida dentro de operador-turnos.html',
                shellContext: 'boot',
                shellPhase: 'settings',
                shellSettingsMode: true,
                shellFirstRun: false,
            },
        });

        await installQueueAdminAuthMock(page, 'csrf_queue_admin_boot_operator');
        await installQueueOperationalAppsApiMocks(page, {
            updatedAt: nowIso,
            queueState: buildQueueIdleState(nowIso),
            queueSurfaceStatus: buildQueueOperationalAppsSurfaceStatus({
                operator: buildQueueDesktopOperatorSurfaceStatus({
                    updatedAt: nowIso,
                    status: 'warning',
                    ageSec: 5,
                    summary:
                        'Una desktop operador quedó en configuración local.',
                    latest: operatorInstance,
                    instances: [operatorInstance],
                }),
            }),
        });

        await page.goto(adminUrl());
        await expect(page.locator('#adminDashboard')).toBeVisible();

        await page.locator('.nav-item[data-section="queue"]').click();
        await page.locator('#queueDomainOperations').dispatchEvent('click');
        await expect(page.locator('#queueConsultorioCard_c1')).toContainText(
            'Configuración local'
        );
        await expect(page.locator('#queueConsultorioCard_c1')).toContainText(
            'Pendiente de validar'
        );
        await expect(page.locator('#queueDispatchCard_c1')).toContainText(
            'Validar en operador'
        );
        await expect(page.locator('#queueDispatchCard_c1')).toContainText(
            'Configuración local'
        );

        await page.locator('#queueDomainIncidents').click();
        await expect(page.locator('#queueSurfaceTelemetry')).toContainText(
            'Operador C1 fijo'
        );
        await expect(page.locator('#queueSurfaceTelemetry')).toContainText(
            'Configuración local'
        );
        await expect(page.locator('#queueSurfaceTelemetry')).toContainText(
            'Validar en operador'
        );
    });

    test('admin expone intento y causa cuando una desktop operador queda reintentando apertura', async ({
        page,
    }) => {
        const nowIso = new Date().toISOString();
        const operatorInstance = buildQueueDesktopOperatorInstance({
            station: 'c1',
            ageSec: 4,
            effectiveStatus: 'warning',
            summary:
                'No se pudo abrir la superficie operator. Reintentando en 18s.',
            details: {
                station: 'c1',
                stationMode: 'locked',
                oneTap: true,
                numpadSeen: false,
                numpadReady: false,
                numpadProgress: 0,
                numpadRequired: 4,
                numpadLabel: 'Validar en operador',
                numpadSummary:
                    'La matriz del numpad se valida dentro de operador-turnos.html',
                shellContext: 'boot',
                shellPhase: 'retry',
                shellSettingsMode: false,
                shellFirstRun: false,
                shellRetryActive: true,
                shellRetryAttempt: 2,
                shellRetryDelayMs: 18000,
                shellRetryRemainingMs: 18000,
                shellRetryReason: 'No se pudo abrir la superficie operator',
            },
        });

        await installQueueAdminAuthMock(
            page,
            'csrf_queue_admin_operator_retry'
        );
        await installQueueOperationalAppsApiMocks(page, {
            updatedAt: nowIso,
            queueState: buildQueueIdleState(nowIso),
            queueSurfaceStatus: buildQueueOperationalAppsSurfaceStatus({
                operator: buildQueueDesktopOperatorSurfaceStatus({
                    updatedAt: nowIso,
                    status: 'warning',
                    ageSec: 4,
                    summary:
                        'Una desktop operador quedó reintentando apertura.',
                    latest: operatorInstance,
                    instances: [operatorInstance],
                }),
            }),
        });

        await page.goto(adminUrl());
        await expect(page.locator('#adminDashboard')).toBeVisible();

        await page.locator('.nav-item[data-section="queue"]').click();
        await page.locator('#queueDomainOperations').click();
        await expect(page.locator('#queueConsultorioCard_c1')).toContainText(
            'Pendiente de validar'
        );
        await expect(page.locator('#queueConsultorioCard_c1')).toContainText(
            'Reintentando #2'
        );
        await expect(page.locator('#queueConsultorioCard_c1')).toContainText(
            '18s'
        );
        await expect(page.locator('#queueDispatchCard_c1')).toContainText(
            'Reintentando #2'
        );

        await page.locator('#queueDomainIncidents').click();
        await expect(page.locator('#queueSurfaceTelemetry')).toContainText(
            'Reintentando #2'
        );
        await expect(page.locator('#queueSurfaceTelemetry')).toContainText(
            '18s'
        );
        await expect(page.locator('#queueSurfaceTelemetry')).toContainText(
            'No se pudo abrir la superficie operator'
        );
        await expect(page.locator('#queueOpsAlertsItems')).toContainText(
            'Operador reintentando apertura'
        );
        await expect(page.locator('#queueOpsAlertsItems')).toContainText(
            'Reintentando #2'
        );
        await expect(page.locator('#queueOpsAlertsItems')).toContainText(
            'No se pudo abrir la superficie operator'
        );
    });

    test('admin mantiene visible launchMode y alerta autoarranque apagado en desktop operador', async ({
        page,
    }) => {
        const nowIso = new Date().toISOString();
        const operatorInstance = buildQueueDesktopOperatorInstance({
            station: 'c2',
            ageSec: 3,
            summary: 'Equipo listo para operar en C2 fijo.',
            details: {
                station: 'c2',
                stationMode: 'locked',
                oneTap: true,
                numpadSeen: true,
                numpadReady: true,
                numpadProgress: 4,
                numpadRequired: 4,
                numpadLabel: 'Numpad listo',
                numpadSummary: 'Matriz completa validada: llamar, +, . y -',
                shellLaunchMode: 'windowed',
                shellAutoStart: false,
            },
        });

        await installQueueAdminAuthMock(
            page,
            'csrf_queue_admin_operator_autostart'
        );
        await installQueueOperationalAppsApiMocks(page, {
            updatedAt: nowIso,
            queueState: buildQueueIdleState(nowIso),
            queueSurfaceStatus: buildQueueOperationalAppsSurfaceStatus({
                operator: buildQueueDesktopOperatorSurfaceStatus({
                    updatedAt: nowIso,
                    status: 'ready',
                    ageSec: 3,
                    summary:
                        'Operador Windows listo, pero con autoarranque apagado.',
                    latest: operatorInstance,
                    instances: [operatorInstance],
                }),
            }),
        });

        await page.goto(adminUrl());
        await expect(page.locator('#adminDashboard')).toBeVisible();

        await page.locator('.nav-item[data-section="queue"]').click();
        await page.locator('#queueDomainOperations').click();
        await expect(page.locator('#queueConsultorioCard_c2')).toContainText(
            'Ventana'
        );
        await expect(page.locator('#queueConsultorioCard_c2')).toContainText(
            'Autoarranque OFF'
        );
        await expect(page.locator('#queueDispatchCard_c2')).toContainText(
            'Ventana'
        );
        await expect(page.locator('#queueDispatchCard_c2')).toContainText(
            'Autoarranque OFF'
        );

        await page.locator('#queueDomainIncidents').click();
        await expect(page.locator('#queueSurfaceTelemetry')).toContainText(
            'Ventana'
        );
        await expect(page.locator('#queueSurfaceTelemetry')).toContainText(
            'Autoarranque OFF'
        );
        await expect(page.locator('#queueOpsAlertsItems')).toContainText(
            'Operador con autoarranque apagado'
        );
        await expect(page.locator('#queueOpsAlertsItems')).toContainText(
            'Autoarranque OFF'
        );
    });

    test('admin muestra progreso de auto-update del operador sin perder el contexto operativo', async ({
        page,
    }) => {
        const nowIso = new Date().toISOString();
        const operatorInstance = buildQueueDesktopOperatorInstance({
            station: 'c1',
            ageSec: 3,
            summary: 'Equipo listo para operar en C1 fijo.',
            details: {
                station: 'c1',
                stationMode: 'locked',
                oneTap: false,
                numpadSeen: true,
                numpadReady: true,
                numpadProgress: 4,
                numpadRequired: 4,
                numpadLabel: 'Numpad listo',
                numpadSummary: 'Matriz completa validada: llamar, +, . y -',
                shellLaunchMode: 'fullscreen',
                shellAutoStart: true,
                shellStatusPhase: 'download',
                shellStatusLevel: 'info',
                shellStatusPercent: 42,
                shellStatusVersion: '0.2.0',
                shellMessage: 'Descargando update 42%',
            },
        });

        await installQueueAdminAuthMock(
            page,
            'csrf_queue_admin_operator_update'
        );
        await installQueueOperationalAppsApiMocks(page, {
            updatedAt: nowIso,
            queueState: buildQueueIdleState(nowIso),
            queueSurfaceStatus: buildQueueOperationalAppsSurfaceStatus({
                operator: buildQueueDesktopOperatorSurfaceStatus({
                    updatedAt: nowIso,
                    status: 'ready',
                    ageSec: 3,
                    summary: 'Operador Windows listo mientras descarga update.',
                    latest: operatorInstance,
                    instances: [operatorInstance],
                }),
            }),
        });

        await page.goto(adminUrl());
        await expect(page.locator('#adminDashboard')).toBeVisible();

        await page.locator('.nav-item[data-section="queue"]').click();
        await page.locator('#queueDomainOperations').click();
        await expect(page.locator('#queueConsultorioCard_c1')).toContainText(
            'Update 42%'
        );
        await expect(page.locator('#queueDispatchCard_c1')).toContainText(
            'Update 42%'
        );

        await page.locator('#queueDomainIncidents').click();
        await expect(page.locator('#queueSurfaceTelemetry')).toContainText(
            'Update 42%'
        );
        await expect(page.locator('#queueSurfaceTelemetry')).toContainText(
            'Descargando update 42%'
        );
        await expect(page.locator('#queueOpsAlertsItems')).toContainText(
            'Operador descargando actualización'
        );
        await expect(page.locator('#queueOpsAlertsItems')).toContainText(
            'Descargando update 42%'
        );
    });
});
