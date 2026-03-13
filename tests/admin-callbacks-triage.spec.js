// @ts-check
const { test, expect } = require('@playwright/test');
const { installLegacyAdminAuthMock } = require('./helpers/admin-auth-mocks');

test.use({
    serviceWorkers: 'block',
    viewport: { width: 1280, height: 920 },
});

function jsonResponse(route, payload, status = 200) {
    return route.fulfill({
        status,
        contentType: 'application/json; charset=utf-8',
        body: JSON.stringify(payload),
    });
}

function buildCallbacksPayload() {
    const now = new Date();
    const todayIso = new Date(
        now.getFullYear(),
        now.getMonth(),
        now.getDate(),
        10,
        30
    ).toISOString();
    const tomorrowIso = new Date(
        now.getFullYear(),
        now.getMonth(),
        now.getDate() + 1,
        14,
        45
    ).toISOString();
    const yesterdayIso = new Date(
        now.getFullYear(),
        now.getMonth(),
        now.getDate() - 1,
        9,
        15
    ).toISOString();

    return [
        {
            id: 201,
            telefono: '+593 98 111 2222',
            preferencia: 'ahora',
            fecha: todayIso,
            status: 'pending',
        },
        {
            id: 202,
            telefono: '+593 97 333 4444',
            preferencia: '30min',
            fecha: tomorrowIso,
            status: 'pending',
        },
        {
            id: 203,
            telefono: '+593 96 555 6666',
            preferencia: '1hora',
            fecha: todayIso,
            status: 'contactado',
        },
        {
            id: 204,
            telefono: '+593 95 777 8888',
            preferencia: '15min',
            fecha: yesterdayIso,
            status: 'contacted',
        },
    ];
}

function buildDataPayload() {
    return {
        ok: true,
        data: {
            appointments: [],
            callbacks: buildCallbacksPayload(),
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
        },
    };
}

function buildFunnelPayload() {
    return {
        ok: true,
        data: {
            summary: {
                viewBooking: 0,
                startCheckout: 0,
                bookingConfirmed: 0,
                checkoutAbandon: 0,
                startRatePct: 0,
                confirmedRatePct: 0,
                abandonRatePct: 0,
            },
            checkoutAbandonByStep: [],
            checkoutEntryBreakdown: [],
            paymentMethodBreakdown: [],
            bookingStepBreakdown: [],
            sourceBreakdown: [],
            abandonReasonBreakdown: [],
            errorCodeBreakdown: [],
        },
    };
}

async function setupLeadOpsAdminApiMocks(page) {
    const callbacks = [
        {
            id: 301,
            telefono: '+593 99 111 0001',
            preferencia: 'Botox hoy, urgente y con precio',
            fecha: new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString(),
            status: 'pending',
            leadOps: {
                heuristicScore: 88,
                priorityBand: 'hot',
                reasonCodes: ['keyword_precio', 'keyword_urgencia'],
                serviceHints: ['Botox medico'],
                nextAction:
                    'Responder precio y cerrar cita en el mismo contacto',
                aiStatus: 'idle',
                aiObjective: '',
                aiSummary: '',
                aiDraft: '',
                aiProvider: '',
                requestedAt: '',
                completedAt: '',
                contactedAt: '',
                outcome: '',
            },
        },
        {
            id: 302,
            telefono: '+593 99 111 0002',
            preferencia: 'Acne la proxima semana',
            fecha: new Date(Date.now() - 70 * 60 * 1000).toISOString(),
            status: 'pending',
            leadOps: {
                heuristicScore: 56,
                priorityBand: 'warm',
                reasonCodes: ['waiting_queue'],
                serviceHints: ['Acne y rosacea'],
                nextAction: 'Responder en esta franja y proponer horario',
                aiStatus: 'completed',
                aiObjective: 'whatsapp_draft',
                aiSummary: 'Seguimiento comercial listo',
                aiDraft: 'Hola, te propongo agendar esta semana.',
                aiProvider: 'openclaw:main',
                requestedAt: new Date().toISOString(),
                completedAt: new Date().toISOString(),
                contactedAt: '',
                outcome: '',
            },
        },
        {
            id: 303,
            telefono: '+593 99 111 0003',
            preferencia: 'Solo quiero informacion',
            fecha: new Date(Date.now() - 15 * 60 * 1000).toISOString(),
            status: 'contactado',
            leadOps: {
                heuristicScore: 24,
                priorityBand: 'cold',
                reasonCodes: [],
                serviceHints: [],
                nextAction: 'Seguimiento registrado',
                aiStatus: 'accepted',
                aiObjective: 'whatsapp_draft',
                aiSummary: 'Borrador ya usado',
                aiDraft: 'Gracias por tu confirmacion.',
                aiProvider: 'openclaw:main',
                requestedAt: new Date().toISOString(),
                completedAt: new Date().toISOString(),
                contactedAt: new Date().toISOString(),
                outcome: 'contactado',
            },
        },
    ];

    const leadOpsMeta = {
        source: 'lead_ops_v1',
        generatedAt: new Date().toISOString(),
        defaultSort: 'priority_desc',
        objectiveOptions: ['service_match', 'call_opening', 'whatsapp_draft'],
        outcomeOptions: [
            'contactado',
            'cita_cerrada',
            'sin_respuesta',
            'descartado',
        ],
        pendingCount: 2,
        contactedCount: 1,
        priorityCounts: {
            hot: 1,
            warm: 1,
            cold: 1,
        },
        aiStatusCounts: {
            idle: 1,
            requested: 0,
            completed: 1,
            accepted: 1,
            failed: 0,
        },
        outcomeCounts: {
            contactado: 1,
            cita_cerrada: 0,
            sin_respuesta: 0,
            descartado: 0,
        },
        worker: {
            configured: true,
            mode: 'offline',
            lastSeenAt: '',
            lastSuccessAt: '',
            lastErrorAt: '',
            lastErrorMessage: '',
            lastQueuePollAt: '',
            lastResultAt: '',
            statusPath: 'C:/tmp/leadops-worker-status.json',
        },
        degraded: true,
    };

    await installLegacyAdminAuthMock(page);

    await page.route(/\/api\.php(\?.*)?$/i, async (route) => {
        const url = new URL(route.request().url());
        const resource = url.searchParams.get('resource') || '';
        const method = route.request().method().toUpperCase();
        let payload = {};

        if (method !== 'GET') {
            try {
                payload = route.request().postDataJSON() || {};
            } catch (_error) {
                payload = {};
            }
        }

        if (resource === 'features') {
            return jsonResponse(route, {
                ok: true,
                data: {
                    admin_sony_ui: true,
                },
            });
        }

        if (resource === 'data') {
            return jsonResponse(route, {
                ok: true,
                data: {
                    appointments: [],
                    callbacks,
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
                    leadOpsMeta,
                },
            });
        }

        if (resource === 'lead-ai-request' && method === 'POST') {
            const callback = callbacks.find(
                (item) =>
                    Number(item.id || 0) === Number(payload.callbackId || 0)
            );
            if (callback) {
                callback.leadOps = {
                    ...(callback.leadOps || {}),
                    aiStatus: 'requested',
                    aiObjective: String(payload.objective || 'whatsapp_draft'),
                    requestedAt: new Date().toISOString(),
                };
            }

            return jsonResponse(route, { ok: true, data: callback || {} }, 202);
        }

        if (resource === 'callbacks' && method === 'PATCH') {
            const callback = callbacks.find(
                (item) => Number(item.id || 0) === Number(payload.id || 0)
            );

            if (callback) {
                callback.status = String(payload.status || callback.status);
                callback.leadOps = {
                    ...(callback.leadOps || {}),
                    ...(payload.leadOps && typeof payload.leadOps === 'object'
                        ? payload.leadOps
                        : {}),
                };
            }

            return jsonResponse(route, { ok: true, data: callback || {} });
        }

        if (resource === 'funnel-metrics') {
            return jsonResponse(route, buildFunnelPayload());
        }

        if (resource === 'availability') {
            return jsonResponse(route, {
                ok: true,
                data: {},
                meta: {
                    source: 'store',
                    mode: 'live',
                    timezone: 'America/Guayaquil',
                    calendarConfigured: true,
                    calendarReachable: true,
                    generatedAt: new Date().toISOString(),
                },
            });
        }

        return jsonResponse(route, { ok: true, data: {} });
    });
}

async function setupAdminApiMocks(page) {
    await installLegacyAdminAuthMock(page);

    await page.route(/\/api\.php(\?.*)?$/i, async (route) => {
        const url = new URL(route.request().url());
        const resource = url.searchParams.get('resource') || '';

        if (resource === 'features') {
            return jsonResponse(route, {
                ok: true,
                data: {
                    admin_sony_ui: true,
                },
            });
        }

        if (resource === 'data') {
            return jsonResponse(route, buildDataPayload());
        }

        if (resource === 'funnel-metrics') {
            return jsonResponse(route, buildFunnelPayload());
        }

        if (resource === 'availability') {
            return jsonResponse(route, {
                ok: true,
                data: {},
                meta: buildDataPayload().data.availabilityMeta,
            });
        }

        return jsonResponse(route, { ok: true, data: {} });
    });
}

async function openCallbacksSection(page) {
    await setupAdminApiMocks(page);
    await page.goto('/admin.html');
    await expect(page.locator('#adminDashboard')).toBeVisible();
    await page.keyboard.press('Alt+Shift+Digit3');
    await expect(page.locator('#callbacks')).toHaveClass(/active/);
    await expect(page.locator('#callbacksGrid .callback-card')).toHaveCount(4);
}

test.describe('Admin callbacks triage', () => {
    test('quick filters, busqueda y reset funcionan en conjunto', async ({
        page,
    }) => {
        await openCallbacksSection(page);

        const pendingBtn = page.locator(
            '[data-action="callback-quick-filter"][data-filter-value="pending"]'
        );
        const allBtn = page.locator(
            '[data-action="callback-quick-filter"][data-filter-value="all"]'
        );

        await pendingBtn.click();
        await expect(page.locator('#callbackFilter')).toHaveValue('pending');
        await expect(pendingBtn).toHaveClass(/is-active/);
        await expect(page.locator('#callbacksGrid .callback-card')).toHaveCount(
            2
        );
        await expect(page.locator('#callbacksToolbarState')).toContainText(
            'Pendientes'
        );

        await page.locator('#searchCallbacks').fill('97 333');
        await expect(page.locator('#callbacksGrid .callback-card')).toHaveCount(
            1
        );
        await expect(page.locator('#callbacksToolbarState')).toContainText(
            'Busqueda: 97 333'
        );
        await expect(page.locator('#callbacksToolbarMeta')).toContainText(
            'Mostrando 1 de 4'
        );

        await page.locator('#clearCallbacksFiltersBtn').click();
        await expect(page.locator('#callbackFilter')).toHaveValue('all');
        await expect(page.locator('#searchCallbacks')).toHaveValue('');
        await expect(allBtn).toHaveClass(/is-active/);
        await expect(page.locator('#callbacksGrid .callback-card')).toHaveCount(
            4
        );
        await expect(page.locator('#callbacksToolbarState')).toContainText(
            'Orden: Prioridad comercial'
        );
    });

    test('atajos globales aplican filtros y slash enfoca busqueda', async ({
        page,
    }) => {
        await openCallbacksSection(page);

        await page.keyboard.press('Alt+Shift+P');
        await expect(page.locator('#callbackFilter')).toHaveValue('pending');
        await expect(page.locator('#callbacksGrid .callback-card')).toHaveCount(
            2
        );

        await page.keyboard.press('/');
        await expect(page.locator('#searchCallbacks')).toBeFocused();

        await page.locator('#pageTitle').click();
        await page.keyboard.press('Alt+Shift+C');
        await expect(page.locator('#callbackFilter')).toHaveValue('contacted');
        await expect(page.locator('#callbacksGrid .callback-card')).toHaveCount(
            2
        );
    });

    test('lead ops prioriza la cola comercial y permite pedir IA y cerrar outcome', async ({
        page,
    }) => {
        await setupLeadOpsAdminApiMocks(page);
        await page.addInitScript(() => {
            localStorage.setItem(
                'admin-callbacks-sort',
                JSON.stringify('priority_desc')
            );
            localStorage.setItem(
                'admin-callbacks-filter',
                JSON.stringify('all')
            );
        });
        await page.goto('/admin.html');
        await expect(page.locator('#adminDashboard')).toBeVisible();
        await page.keyboard.press('Alt+Shift+Digit3');
        await expect(page.locator('#callbacks')).toHaveClass(/active/);

        const firstCard = page.locator('#callbacksGrid .callback-card').first();
        await expect(page.locator('#callbacksGrid .callback-card')).toHaveCount(
            3
        );
        await expect(firstCard).toContainText('+593 99 111 0001');
        await expect(firstCard).toContainText('Hot');
        await expect(firstCard).toContainText('Sin IA');
        await expect(page.locator('#callbacksOpsQueueHealth')).toHaveText(
            'Cola estable, IA degradada'
        );

        await firstCard
            .locator('button[data-action="lead-ai-request"]')
            .click();
        await expect(firstCard).toContainText('IA no disponible');

        await firstCard
            .locator(
                'button[data-action="callback-outcome"][data-outcome="cita_cerrada"]'
            )
            .click();
        await expect(firstCard).toContainText('Cita cerrada');
    });
});
