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
        await expect(page.locator('#adminDashboard')).toBeVisible();

        await page.locator('.nav-item[data-section="queue"]').click();
        await expect(page.locator('#queue')).toHaveClass(/active/);
        await expect(page.locator('#queueWaitingCountAdmin')).toHaveText('2');
        await expect(page.locator('#queueSyncStatus')).toContainText('vivo');

        await page
            .locator(
                '[data-action="queue-call-next"][data-queue-consultorio="1"]'
            )
            .first()
            .click();

        await expect(page.locator('#queueWaitingCountAdmin')).toHaveText('1');
        await expect(page.locator('#queueC1Now')).toContainText('A-501');
        await expect(page.locator('#queueTableBody')).toContainText('A-501');
        await expect(
            page
                .locator(
                    '[data-action="queue-call-next"][data-queue-consultorio="1"]'
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
            'Sin tickets en cola'
        );
        await expect(page.locator('#queueWaitingCountAdmin')).toHaveText('1');

        await page.keyboard.press('Alt+Shift+O');
        await expect(page.locator('#queueTableBody')).toContainText('A-910');
        await expect(page.locator('#queueTableBody')).toContainText(
            'No asistio'
        );
        await expect(page.locator('#queueTableBody')).toContainText('A-911');
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
                '[data-action="queue-call-next"][data-queue-consultorio="1"]'
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
            '[data-action="queue-call-next"][data-queue-consultorio="1"]'
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
                '[data-action="queue-call-next"][data-queue-consultorio="1"]'
            )
            .first();
        const callC2Button = page
            .locator(
                '[data-action="queue-call-next"][data-queue-consultorio="2"]'
            )
            .first();

        await expect(callC1Button).toBeVisible();
        await expect(callC2Button).toBeVisible();
        await page.evaluate(() => {
            const c1 = document.querySelector(
                '[data-action="queue-call-next"][data-queue-consultorio="1"]'
            );
            const c2 = document.querySelector(
                '[data-action="queue-call-next"][data-queue-consultorio="2"]'
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
});
