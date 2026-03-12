// @ts-check
const { test, expect } = require('@playwright/test');

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

        await page.route(/\/admin-auth\.php(\?.*)?$/i, async (route) =>
            json(route, {
                ok: true,
                authenticated: true,
                csrfToken: 'csrf_queue_dispatch',
            })
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
        await page.locator('#queueDomainOperations').click();
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

        await page.route(/\/admin-auth\.php(\?.*)?$/i, async (route) =>
            json(route, {
                ok: true,
                authenticated: true,
                csrfToken: 'csrf_queue_attention_deck',
            })
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

        await page.route(/\/admin-auth\.php(\?.*)?$/i, async (route) =>
            json(route, {
                ok: true,
                authenticated: true,
                csrfToken: 'csrf_queue_resolution_deck',
            })
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

        await page.route(/\/admin-auth\.php(\?.*)?$/i, async (route) =>
            json(route, {
                ok: true,
                authenticated: true,
                csrfToken: 'csrf_queue_ticket_lookup',
            })
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

        await page.route(/\/admin-auth\.php(\?.*)?$/i, async (route) =>
            json(route, {
                ok: true,
                authenticated: true,
                csrfToken: 'csrf_queue_ticket_route',
            })
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

        await page.route(/\/admin-auth\.php(\?.*)?$/i, async (route) =>
            json(route, {
                ok: true,
                authenticated: true,
                csrfToken: 'csrf_queue_ticket_simulation',
            })
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

        await page.route(/\/admin-auth\.php(\?.*)?$/i, async (route) =>
            json(route, {
                ok: true,
                authenticated: true,
                csrfToken: 'csrf_queue_next_turns',
            })
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

        await page.route(/\/admin-auth\.php(\?.*)?$/i, async (route) =>
            json(route, {
                ok: true,
                authenticated: true,
                csrfToken: 'csrf_queue_master_sequence',
            })
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

        await page.route(/\/admin-auth\.php(\?.*)?$/i, async (route) =>
            json(route, {
                ok: true,
                authenticated: true,
                csrfToken: 'csrf_queue_blockers',
            })
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

        await page.route(/\/admin-auth\.php(\?.*)?$/i, async (route) =>
            json(route, {
                ok: true,
                authenticated: true,
                csrfToken: 'csrf_queue_sla_deck',
            })
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

        await page.route(/\/admin-auth\.php(\?.*)?$/i, async (route) =>
            json(route, {
                ok: true,
                authenticated: true,
                csrfToken: 'csrf_queue_coverage_deck',
            })
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

        await page.route(/\/admin-auth\.php(\?.*)?$/i, async (route) =>
            json(route, {
                ok: true,
                authenticated: true,
                csrfToken: 'csrf_queue_reserve_deck',
            })
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

        await page.route(/\/admin-auth\.php(\?.*)?$/i, async (route) =>
            json(route, {
                ok: true,
                authenticated: true,
                csrfToken: 'csrf_queue_general_guidance',
            })
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

        await page.route(/\/admin-auth\.php(\?.*)?$/i, async (route) =>
            json(route, {
                ok: true,
                authenticated: true,
                csrfToken: 'csrf_queue_projected_deck',
            })
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

        await page.route(/\/admin-auth\.php(\?.*)?$/i, async (route) =>
            json(route, {
                ok: true,
                authenticated: true,
                csrfToken: 'csrf_queue_incoming_deck',
            })
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

        await page.route(/\/admin-auth\.php(\?.*)?$/i, async (route) =>
            json(route, {
                ok: true,
                authenticated: true,
                csrfToken: 'csrf_queue_scenarios',
            })
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

        await page.route(/\/admin-auth\.php(\?.*)?$/i, async (route) =>
            json(route, {
                ok: true,
                authenticated: true,
                csrfToken: 'csrf_queue_reception_script',
            })
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

        await page.route(/\/admin-auth\.php(\?.*)?$/i, async (route) =>
            json(route, {
                ok: true,
                authenticated: true,
                csrfToken: 'csrf_queue_reception_collision',
            })
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

        await page.route(/\/admin-auth\.php(\?.*)?$/i, async (route) =>
            json(route, {
                ok: true,
                authenticated: true,
                csrfToken: 'csrf_queue_reception_lights',
            })
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

        await page.route(/\/admin-auth\.php(\?.*)?$/i, async (route) =>
            json(route, {
                ok: true,
                authenticated: true,
                csrfToken: 'csrf_queue_window_deck',
            })
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

        await page.route(/\/admin-auth\.php(\?.*)?$/i, async (route) =>
            json(route, {
                ok: true,
                authenticated: true,
                csrfToken: 'csrf_queue_desk_reply',
            })
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

        await page.route(/\/admin-auth\.php(\?.*)?$/i, async (route) =>
            json(route, {
                ok: true,
                authenticated: true,
                csrfToken: 'csrf_queue_desk_fallback',
            })
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

        await page.route(/\/admin-auth\.php(\?.*)?$/i, async (route) =>
            json(route, {
                ok: true,
                authenticated: true,
                csrfToken: 'csrf_queue_desk_objections',
            })
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

        await page.route(/\/admin-auth\.php(\?.*)?$/i, async (route) =>
            json(route, {
                ok: true,
                authenticated: true,
                csrfToken: 'csrf_queue_desk_closeout',
            })
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

        await page.route(/\/admin-auth\.php(\?.*)?$/i, async (route) =>
            json(route, {
                ok: true,
                authenticated: true,
                csrfToken: 'csrf_queue_desk_recheck',
            })
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

        await page.route(/\/admin-auth\.php(\?.*)?$/i, async (route) =>
            json(route, {
                ok: true,
                authenticated: true,
                csrfToken: 'csrf_queue_wait_radar',
            })
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
        await page.locator('#queueDomainOperations').click();
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

        await page.route(/\/admin-auth\.php(\?.*)?$/i, async (route) =>
            json(route, {
                ok: true,
                authenticated: true,
                csrfToken: 'csrf_queue_load_balance',
            })
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

        await page.route(/\/admin-auth\.php(\?.*)?$/i, async (route) =>
            json(route, {
                ok: true,
                authenticated: true,
                csrfToken: 'csrf_queue_priority_lane',
            })
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

        await page.route(/\/admin-auth\.php(\?.*)?$/i, async (route) =>
            json(route, {
                ok: true,
                authenticated: true,
                csrfToken: 'csrf_queue_quick_trays',
            })
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

        await page.route(/\/admin-auth\.php(\?.*)?$/i, async (route) =>
            json(route, {
                ok: true,
                authenticated: true,
                csrfToken: 'csrf_queue_active_tray',
            })
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

        await page.route(/\/admin-auth\.php(\?.*)?$/i, async (route) =>
            json(route, {
                ok: true,
                authenticated: true,
                csrfToken: 'csrf_queue_tray_burst',
            })
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

    test('queue muestra hub de apps operativas con desktop y Android TV', async ({
        page,
    }) => {
        test.setTimeout(45000);
        let dataRequestCount = 0;

        await page.addInitScript(() => {
            window.__QUEUE_AUTO_REFRESH_INTERVAL_MS__ = 120;
        });

        await page.route(/\/admin-auth\.php(\?.*)?$/i, async (route) =>
            json(route, {
                ok: true,
                authenticated: true,
                csrfToken: 'csrf_queue_apps_hub',
            })
        );

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
                dataRequestCount += 1;
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
                        queue_tickets: [],
                        queueMeta: buildQueueMetaFromState({
                            updatedAt: new Date().toISOString(),
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
                                ageSec: dataRequestCount > 1 ? 3 : 8,
                                stale: false,
                                summary:
                                    dataRequestCount > 1
                                        ? 'Equipo listo para operar en C1 fijo. Pulso renovado.'
                                        : 'Equipo listo para operar en C1 fijo.',
                                latest: {
                                    deviceLabel: 'Operador C1 fijo',
                                    appMode: 'desktop',
                                    ageSec: dataRequestCount > 1 ? 3 : 8,
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
                            },
                            display: {
                                surface: 'display',
                                label: 'Sala TV',
                                status: 'ready',
                                updatedAt: new Date().toISOString(),
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
        await expect(page.locator('#queueAppsHub')).toBeVisible();
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

        await page.locator('#queueDomainOperations').click();
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

        await page.locator('#queueDomainIncidents').click();
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
        await page.locator('#queueOpsLogStatusBtn').click();
        await expect(page.locator('#queueOpsLogChip')).toContainText(
            '1 evento(s) hoy'
        );
        await expect(page.locator('#queueOpsLogItems')).toContainText(
            'Estado actual registrado'
        );
        await page.locator('#queueOpsLogIncidentBtn').click();
        await expect(page.locator('#queueOpsLogChip')).toContainText(
            '2 evento(s) hoy'
        );
        await expect(page.locator('#queueOpsLogItems')).toContainText(
            'Incidencia: Kiosco'
        );
        await page
            .locator('#queueOpsAlertReview_kiosk_printer_pending')
            .click();
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
        await page.locator('#queueFocusModeIncidents').click();
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
        await page.locator('#queueFocusModeAuto').click();
        await expect(page.locator('#queueFocusModeChip')).toContainText(
            'Auto -> opening'
        );
        await page.locator('#queueDomainAuto').click();
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
        await page.locator('#queueOpsPilotApplyBtn').click();
        await expect(page.locator('#queueOpsPilotTitle')).toContainText(
            'Siguiente paso: Kiosco + ticket térmico'
        );
        await expect(page.locator('#queueOpeningChecklistTitle')).toContainText(
            'faltan 2 paso(s)'
        );
        await page.locator('#queueDomainOperations').click();
        await expect(page.locator('#queueQuickConsoleTitle')).toContainText(
            'Consola rápida: Apertura'
        );
        await page.locator('#queueDomainDeployment').click();
        await expect(page.locator('#queuePlaybook')).toBeVisible();
        await page.locator('#queuePlaybookAssistBtn').click();
        await expect(page.locator('#queuePlaybookAssistChip')).toContainText(
            'Sin sugeridos'
        );
        await expect(page.locator('#queueOpsLogItems')).toContainText(
            'Playbook opening: sugeridos confirmados'
        );
        await page.locator('#queuePlaybookApplyBtn').click();
        await expect(page.locator('#queuePlaybookChip')).toContainText(
            'Secuencia completa'
        );
        await expect(page.locator('#queueOpsLogItems')).toContainText(
            'Playbook opening: paso confirmado'
        );
        await expect(page.locator('#queueOpsLogItems')).toContainText(
            'Apertura: 2 sugerido(s) confirmados'
        );
        await page.locator('#queueDomainOperations').click();
        await page.locator('#queueShiftHandoffApplyBtn').click();
        await expect(page.locator('#queueShiftHandoffTitle')).toContainText(
            'Relevo listo'
        );
        await page.locator('#queueDomainIncidents').click();
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
        await page.locator('#queueDomainAuto').click();
        await expect(page.locator('#queueAppsHub')).toHaveAttribute(
            'data-queue-domain',
            'deployment'
        );
        await page.locator('#queueOpeningChecklistResetBtn').click();
        await expect(page.locator('#queueOpeningChecklistTitle')).toContainText(
            'Apertura diaria asistida'
        );
        await page.locator('#queueDomainOperations').click();
        await page.locator('#queueShiftHandoffResetBtn').click();
        await expect(page.locator('#queueShiftHandoffTitle')).toContainText(
            'Cierre y relevo asistido'
        );
        await page.locator('#queueDomainDeployment').click();
        await expect(page.locator('#queueInstallConfigurator')).toContainText(
            'Operador'
        );
        await expect(page.locator('#queueInstallConfigurator')).toContainText(
            'station=c1'
        );
        await expect(
            page.locator('#queueInstallPreset_operator_c1_locked')
        ).toBeVisible();
        await expect(
            page.locator('#queueInstallPreset_operator_c2_locked')
        ).toBeVisible();
        await expect(page.locator('#queueInstallPreset_kiosk')).toBeVisible();
        await expect(page.locator('#queueInstallPreset_sala_tv')).toBeVisible();

        await page.locator('#queueInstallPreset_kiosk').click();
        await expect(page.locator('#queueInstallSurfaceSelect')).toHaveValue(
            'kiosk'
        );
        await expect(page.locator('#queueInstallConfigurator')).toContainText(
            'Kiosco listo para mostrador'
        );
        await expect(page.locator('#queueOpsLogItems')).toContainText(
            'Preset rápido: Kiosco'
        );

        await page.locator('#queueInstallPreset_operator_c2_locked').click();
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
        await expect(page.locator('#queueOpsLogItems')).toContainText(
            'Modo 1 tecla activado'
        );
        await page.locator('#queueOpsLogFilterChanges').click();
        await expect(page.locator('#queueOpsLogItems')).toContainText(
            'Modo 1 tecla activado'
        );
        await expect(page.locator('#queueOpsLogItems')).not.toContainText(
            'Estado actual registrado'
        );
        await page.locator('#queueOpsLogFilterIncidents').click();
        await expect(page.locator('#queueOpsLogItems')).toContainText(
            'Incidencia: Kiosco'
        );
        await page.locator('#queueOpsLogFilterAll').click();
        await page.locator('#queueDomainIncidents').click();
        await expect(page.locator('#queueSurfaceTelemetry')).toContainText(
            'Abrir operador'
        );
        await expect(page.locator('#queueContingencyDeck')).toContainText(
            'C2 fijo'
        );
        await page.locator('#queueDomainDeployment').click();

        await page.locator('#queueInstallPreset_sala_tv').click();
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
        await page.locator('#queueDomainIncidents').click();
        await expect(page.locator('#queueSurfaceTelemetry')).toContainText(
            'Pulso renovado'
        );
    });

    test('admin muestra dos operadores Windows por estacion en operaciones e incidentes', async ({
        page,
    }) => {
        const nowIso = new Date().toISOString();
        const operatorInstances = [
            {
                deviceLabel: 'Operador C1 fijo',
                appMode: 'desktop',
                ageSec: 4,
                stale: false,
                effectiveStatus: 'ready',
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
                    shellPackaged: true,
                    shellPlatform: 'win32',
                    shellUpdateChannel: 'stable',
                },
            },
            {
                deviceLabel: 'Operador C2 fijo',
                appMode: 'desktop',
                ageSec: 6,
                stale: false,
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
                    shellPackaged: true,
                    shellPlatform: 'win32',
                    shellUpdateChannel: 'stable',
                },
            },
        ];

        await page.route(/\/admin-auth\.php(\?.*)?$/i, async (route) =>
            json(route, {
                ok: true,
                authenticated: true,
                csrfToken: 'csrf_queue_admin_dual_operator',
            })
        );

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
                                status: 'warning',
                                updatedAt: nowIso,
                                ageSec: 4,
                                stale: false,
                                summary:
                                    'Un equipo operador listo y otro con numpad pendiente.',
                                latest: operatorInstances[0],
                                instances: operatorInstances,
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

            if (resource === 'queue-state') {
                return json(route, {
                    ok: true,
                    data: {
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
                    },
                });
            }

            return json(route, { ok: true, data: {} });
        });

        await page.goto(adminUrl());
        await expect(page.locator('#adminDashboard')).toBeVisible();

        await page.locator('.nav-item[data-section="queue"]').click();
        await page.locator('#queueDomainOperations').click();
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
    });

    test('admin mantiene visible una desktop operador en configuracion local sin contarla como lista', async ({
        page,
    }) => {
        const nowIso = new Date().toISOString();
        const operatorInstance = {
            deviceLabel: 'Operador C1 fijo',
            appMode: 'desktop',
            ageSec: 5,
            stale: false,
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
                shellPackaged: true,
                shellPlatform: 'win32',
                shellUpdateChannel: 'stable',
            },
        };

        await page.route(/\/admin-auth\.php(\?.*)?$/i, async (route) =>
            json(route, {
                ok: true,
                authenticated: true,
                csrfToken: 'csrf_queue_admin_boot_operator',
            })
        );

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
                                status: 'warning',
                                updatedAt: nowIso,
                                ageSec: 5,
                                stale: false,
                                summary:
                                    'Una desktop operador quedó en configuración local.',
                                latest: operatorInstance,
                                instances: [operatorInstance],
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

            if (resource === 'queue-state') {
                return json(route, {
                    ok: true,
                    data: {
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
                    },
                });
            }

            return json(route, { ok: true, data: {} });
        });

        await page.goto(adminUrl());
        await expect(page.locator('#adminDashboard')).toBeVisible();

        await page.locator('.nav-item[data-section="queue"]').click();
        await page.locator('#queueDomainOperations').click();
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
});
