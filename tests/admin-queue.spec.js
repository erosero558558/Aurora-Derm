// @ts-check
const { test, expect } = require('@playwright/test');

function json(route, payload, status = 200) {
    return route.fulfill({
        status,
        contentType: 'application/json; charset=utf-8',
        body: JSON.stringify(payload),
    });
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
        counts: state.counts || {},
        callingNowByConsultorio: byConsultorio,
        nextTickets: state.nextTickets || [],
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

test.describe('Admin turnero sala', () => {
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

        await page.route(/\/admin-auth\.php(\?.*)?$/i, async (route) => {
            const url = new URL(route.request().url());
            const action = url.searchParams.get('action') || '';
            if (action === 'status') {
                return json(route, {
                    ok: true,
                    authenticated: true,
                    csrfToken: 'csrf_queue_admin',
                });
            }
            return json(route, {
                ok: true,
                authenticated: true,
                csrfToken: 'csrf_queue_admin',
            });
        });

        await page.route(/\/api\.php(\?.*)?$/i, async (route) => {
            const request = route.request();
            const url = new URL(request.url());
            const resource = url.searchParams.get('resource') || '';

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

            if (resource === 'queue-state') {
                return json(route, {
                    ok: true,
                    data: queueState,
                });
            }

            if (resource === 'funnel-metrics') {
                return json(route, { ok: true, data: {} });
            }

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
                return json(route, {
                    ok: true,
                    data: {
                        ticket: calledTicket,
                        queueState,
                    },
                });
            }

            if (resource === 'queue-ticket') {
                return json(route, {
                    ok: true,
                    data: {
                        ticket: queueTickets[0],
                        queueState,
                    },
                });
            }

            if (resource === 'queue-reprint') {
                return json(route, {
                    ok: true,
                    printed: false,
                    print: {
                        ok: true,
                        errorCode: 'printer_disabled',
                        message: 'disabled',
                    },
                });
            }

            return json(route, { ok: true, data: {} });
        });

        await page.goto('/admin.html');
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
        await expect(
            page
                .locator(
                    '#queue .queue-admin-header-actions [data-action="queue-call-next"][data-queue-consultorio="1"]'
                )
                .first()
        ).toBeDisabled();
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

        await page.route(/\/admin-auth\.php(\?.*)?$/i, async (route) =>
            json(route, {
                ok: true,
                authenticated: true,
                csrfToken: 'csrf_queue_triage',
            })
        );

        await page.route(/\/api\.php(\?.*)?$/i, async (route) => {
            const url = new URL(route.request().url());
            const resource = url.searchParams.get('resource') || '';

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

        await page.goto('/admin.html');
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

        await page.route(/\/admin-auth\.php(\?.*)?$/i, async (route) =>
            json(route, {
                ok: true,
                authenticated: true,
                csrfToken: 'csrf_queue_watchdog',
            })
        );

        await page.route(/\/api\.php(\?.*)?$/i, async (route) => {
            const url = new URL(route.request().url());
            const resource = url.searchParams.get('resource') || '';

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

        await page.goto('/admin.html');
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

        await page.route(/\/admin-auth\.php(\?.*)?$/i, async (route) =>
            json(route, {
                ok: true,
                authenticated: true,
                csrfToken: 'csrf_queue_shortcuts',
            })
        );

        await page.route(/\/api\.php(\?.*)?$/i, async (route) => {
            const request = route.request();
            const url = new URL(request.url());
            const resource = url.searchParams.get('resource') || '';

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

        await page.goto('/admin.html');
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

        await page.route(/\/admin-auth\.php(\?.*)?$/i, async (route) =>
            json(route, {
                ok: true,
                authenticated: true,
                csrfToken: 'csrf_queue_state_fallback',
            })
        );

        await page.route(/\/api\.php(\?.*)?$/i, async (route) => {
            const request = route.request();
            const url = new URL(request.url());
            const resource = url.searchParams.get('resource') || '';

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
                    },
                });
            }

            if (resource === 'queue-state') {
                queueStateRequests += 1;
                return json(route, {
                    ok: true,
                    data: queueState,
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

        await page.goto('/admin.html');
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

        await page.route(/\/admin-auth\.php(\?.*)?$/i, async (route) =>
            json(route, {
                ok: true,
                authenticated: true,
                csrfToken: 'csrf_queue_meta_fallback',
            })
        );

        await page.route(/\/api\.php(\?.*)?$/i, async (route) => {
            const request = route.request();
            const url = new URL(request.url());
            const resource = url.searchParams.get('resource') || '';

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
                        queueMeta: queueMetaPayload,
                    },
                });
            }

            if (resource === 'queue-state') {
                queueStateRequests += 1;
                return json(
                    route,
                    {
                        ok: false,
                        error: 'queue-state should not be needed in this case',
                    },
                    500
                );
            }

            if (resource === 'health') {
                return json(route, { ok: true, status: 'ok' });
            }

            if (resource === 'funnel-metrics') {
                return json(route, { ok: true, data: {} });
            }

            return json(route, { ok: true, data: {} });
        });

        await page.goto('/admin.html');
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

        await page.route(/\/admin-auth\.php(\?.*)?$/i, async (route) =>
            json(route, {
                ok: true,
                authenticated: true,
                csrfToken: 'csrf_queue_state_data_fallback',
            })
        );

        await page.route(/\/api\.php(\?.*)?$/i, async (route) => {
            const request = route.request();
            const url = new URL(request.url());
            const resource = url.searchParams.get('resource') || '';

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
                        queue_state: queueStatePayload,
                    },
                });
            }

            if (resource === 'queue-state') {
                queueStateRequests += 1;
                return json(
                    route,
                    {
                        ok: false,
                        error: 'queue-state should not be needed for queue_state fallback',
                    },
                    500
                );
            }

            if (resource === 'health') {
                return json(route, { ok: true, status: 'ok' });
            }

            if (resource === 'funnel-metrics') {
                return json(route, { ok: true, data: {} });
            }

            return json(route, { ok: true, data: {} });
        });

        await page.goto('/admin.html');
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

        await page.route(/\/admin-auth\.php(\?.*)?$/i, async (route) =>
            json(route, {
                ok: true,
                authenticated: true,
                csrfToken: 'csrf_queue_burst',
            })
        );

        await page.route(/\/api\.php(\?.*)?$/i, async (route) => {
            const request = route.request();
            const url = new URL(request.url());
            const resource = url.searchParams.get('resource') || '';

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

        await page.goto('/admin.html');
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

        await page.route(/\/admin-auth\.php(\?.*)?$/i, async (route) =>
            json(route, {
                ok: true,
                authenticated: true,
                csrfToken: 'csrf_queue_retry',
            })
        );

        await page.route(/\/api\.php(\?.*)?$/i, async (route) => {
            const request = route.request();
            const url = new URL(request.url());
            const resource = url.searchParams.get('resource') || '';

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

        await page.goto('/admin.html');
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

        await page.route(/\/admin-auth\.php(\?.*)?$/i, async (route) =>
            json(route, {
                ok: true,
                authenticated: true,
                csrfToken: 'csrf_queue_parallel_rooms',
            })
        );

        await page.route(/\/api\.php(\?.*)?$/i, async (route) => {
            const request = route.request();
            const url = new URL(request.url());
            const resource = url.searchParams.get('resource') || '';

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

        await page.goto('/admin.html');
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

        await page.route(/\/admin-auth\.php(\?.*)?$/i, async (route) =>
            json(route, {
                ok: true,
                authenticated: true,
                csrfToken: 'csrf_queue_lifecycle',
            })
        );

        await page.route(/\/api\.php(\?.*)?$/i, async (route) => {
            const request = route.request();
            const url = new URL(request.url());
            const resource = url.searchParams.get('resource') || '';

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

        await page.goto('/admin.html');
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

        await page.route(/\/admin-auth\.php(\?.*)?$/i, async (route) =>
            json(route, {
                ok: true,
                authenticated: true,
                csrfToken: 'csrf_queue_station_c2',
            })
        );

        await page.route(/\/api\.php(\?.*)?$/i, async (route) => {
            const request = route.request();
            const url = new URL(request.url());
            const resource = url.searchParams.get('resource') || '';

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

        await page.goto('/admin.html?station=c2&lock=1');
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

        await page.route(/\/admin-auth\.php(\?.*)?$/i, async (route) =>
            json(route, {
                ok: true,
                authenticated: true,
                csrfToken: 'csrf_queue_station_c1',
            })
        );

        await page.route(/\/api\.php(\?.*)?$/i, async (route) => {
            const request = route.request();
            const url = new URL(request.url());
            const resource = url.searchParams.get('resource') || '';

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

        await page.goto('/admin.html?station=c1&lock=1');
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

        await page.route(/\/admin-auth\.php(\?.*)?$/i, async (route) =>
            json(route, {
                ok: true,
                authenticated: true,
                csrfToken: 'csrf_queue_one_tap_c2',
            })
        );

        await page.route(/\/api\.php(\?.*)?$/i, async (route) => {
            const request = route.request();
            const url = new URL(request.url());
            const resource = url.searchParams.get('resource') || '';

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

        await page.goto('/admin.html?station=c2&lock=1&one_tap=1');
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

        await page.route(/\/admin-auth\.php(\?.*)?$/i, async (route) =>
            json(route, {
                ok: true,
                authenticated: true,
                csrfToken: 'csrf_queue_one_tap_only_call',
            })
        );

        await page.route(/\/api\.php(\?.*)?$/i, async (route) => {
            const request = route.request();
            const url = new URL(request.url());
            const resource = url.searchParams.get('resource') || '';

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

        await page.goto('/admin.html?station=c1&lock=1&one_tap=1');
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

    test('modo bloqueado permite override manual con boton del consultorio opuesto', async ({
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

        await page.route(/\/admin-auth\.php(\?.*)?$/i, async (route) =>
            json(route, {
                ok: true,
                authenticated: true,
                csrfToken: 'csrf_queue_station_override',
            })
        );

        await page.route(/\/api\.php(\?.*)?$/i, async (route) => {
            const request = route.request();
            const url = new URL(request.url());
            const resource = url.searchParams.get('resource') || '';

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

        await page.goto('/admin.html?station=c2&lock=1');
        await expect(page.locator('#adminDashboard')).toBeVisible();
        await page.locator('.nav-item[data-section="queue"]').click();
        await expect(page.locator('#queue')).toHaveClass(/active/);
        await expect(page.locator('#queueStationBadge')).toContainText(
            'Estación C2'
        );
        await expect(page.locator('#queueStationModeBadge')).toContainText(
            'Bloqueado'
        );

        await page
            .locator(
                '#queue .queue-admin-header-actions [data-action="queue-call-next"][data-queue-consultorio="1"]'
            )
            .first()
            .click();

        await expect.poll(() => queueCallNextRequests.length).toBe(1);
        await expect.poll(() => queueCallNextRequests[0]).toBe(1);
        await expect(page.locator('#toastContainer')).toContainText(
            'Llamando manualmente C1'
        );
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

        await page.route(/\/admin-auth\.php(\?.*)?$/i, async (route) =>
            json(route, {
                ok: true,
                authenticated: true,
                csrfToken: 'csrf_queue_numpad_star_help',
            })
        );

        await page.route(/\/api\.php(\?.*)?$/i, async (route) => {
            const request = route.request();
            const url = new URL(request.url());
            const resource = url.searchParams.get('resource') || '';

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

        await page.goto('/admin.html?station=c1&lock=1');
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

    test('numpad . y - exigen confirmacion doble y respetan cancelacion', async ({
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

        await page.route(/\/admin-auth\.php(\?.*)?$/i, async (route) =>
            json(route, {
                ok: true,
                authenticated: true,
                csrfToken: 'csrf_queue_numpad_star_confirm',
            })
        );

        await page.route(/\/api\.php(\?.*)?$/i, async (route) => {
            const request = route.request();
            const url = new URL(request.url());
            const resource = url.searchParams.get('resource') || '';

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

        await page.goto('/admin.html?station=c1&lock=1');
        await expect(page.locator('#adminDashboard')).toBeVisible();
        await page.locator('.nav-item[data-section="queue"]').click();
        await expect(page.locator('#queue')).toHaveClass(/active/);

        const dismissDialogs = async (dialog) => {
            await dialog.dismiss();
        };
        page.on('dialog', dismissDialogs);
        await page.keyboard.press('NumpadDecimal');
        await expect.poll(() => queueTicketActions.length).toBe(0);
        page.off('dialog', dismissDialogs);

        const acceptDialogs = async (dialog) => {
            await dialog.accept();
        };
        page.on('dialog', acceptDialogs);
        await page.keyboard.press('NumpadSubtract');
        await expect.poll(() => queueTicketActions.length).toBe(1);
        await expect.poll(() => queueTicketActions[0]?.action).toBe('no_show');
        await expect.poll(() => queueTicketActions[0]?.ticketId).toBe(1293);
        page.off('dialog', acceptDialogs);
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

        await page.route(/\/admin-auth\.php(\?.*)?$/i, async (route) =>
            json(route, {
                ok: true,
                authenticated: true,
                csrfToken: 'csrf_queue_numpad_location_fallback',
            })
        );

        await page.route(/\/api\.php(\?.*)?$/i, async (route) => {
            const request = route.request();
            const url = new URL(request.url());
            const resource = url.searchParams.get('resource') || '';

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

        await page.goto('/admin.html?station=c1&lock=1');
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

        const acceptDialogs = async (dialog) => {
            await dialog.accept();
        };
        page.on('dialog', acceptDialogs);

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
        await expect.poll(() => queueTicketActions.length).toBe(1);
        await expect
            .poll(() => queueTicketActions[0]?.action)
            .toBe('completar');

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
        await expect.poll(() => queueTicketActions.length).toBe(2);
        await expect
            .poll(() => queueTicketActions[1]?.action)
            .toBe('completar');

        page.off('dialog', acceptDialogs);
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

        await page.route(/\/admin-auth\.php(\?.*)?$/i, async (route) =>
            json(route, {
                ok: true,
                authenticated: true,
                csrfToken: 'csrf_queue_custom_call_key',
            })
        );

        await page.route(/\/api\.php(\?.*)?$/i, async (route) => {
            const request = route.request();
            const url = new URL(request.url());
            const resource = url.searchParams.get('resource') || '';

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

        await page.goto('/admin.html?station=c1&lock=1');
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

        await page.route(/\/admin-auth\.php(\?.*)?$/i, async (route) =>
            json(route, {
                ok: true,
                authenticated: true,
                csrfToken: 'csrf_queue_practice_mode',
            })
        );

        await page.route(/\/api\.php(\?.*)?$/i, async (route) => {
            const request = route.request();
            const url = new URL(request.url());
            const resource = url.searchParams.get('resource') || '';

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

        await page.goto('/admin.html?station=c1&lock=1');
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

        await page.route(/\/admin-auth\.php(\?.*)?$/i, async (route) =>
            json(route, {
                ok: true,
                authenticated: true,
                csrfToken: 'csrf_queue_filter_empty',
            })
        );

        await page.route(/\/api\.php(\?.*)?$/i, async (route) => {
            const request = route.request();
            const url = new URL(request.url());
            const resource = url.searchParams.get('resource') || '';

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

        await page.goto('/admin.html');
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

        await page.route(/\/admin-auth\.php(\?.*)?$/i, async (route) =>
            json(route, {
                ok: true,
                authenticated: true,
                csrfToken: 'csrf_queue_reprint_bulk',
            })
        );

        await page.route(/\/api\.php(\?.*)?$/i, async (route) => {
            const request = route.request();
            const url = new URL(request.url());
            const resource = url.searchParams.get('resource') || '';

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

        await page.goto('/admin.html');
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
});
