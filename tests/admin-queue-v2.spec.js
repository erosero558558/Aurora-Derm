// @ts-check
const { test, expect } = require('@playwright/test');

function json(route, payload, status = 200) {
    return route.fulfill({
        status,
        contentType: 'application/json; charset=utf-8',
        body: JSON.stringify(payload),
    });
}

function parseBody(request) {
    try {
        return request.postDataJSON() || {};
    } catch (_error) {
        const raw = request.postData() || '';
        try {
            return raw ? JSON.parse(raw) : {};
        } catch (_jsonError) {
            const params = new URLSearchParams(raw);
            return Object.fromEntries(params.entries());
        }
    }
}

function normalizeTicket(raw, fallbackIndex = 0) {
    const id = Number(raw?.id || fallbackIndex + 1);
    const assignedConsultorio = Number(raw?.assignedConsultorio || 0);
    return {
        id,
        ticketCode: String(raw?.ticketCode || `A-${id}`),
        queueType: String(raw?.queueType || 'walk_in'),
        patientInitials: String(raw?.patientInitials || '--'),
        priorityClass: String(raw?.priorityClass || 'walk_in'),
        status: String(raw?.status || 'waiting'),
        assignedConsultorio:
            assignedConsultorio === 1 || assignedConsultorio === 2
                ? assignedConsultorio
                : null,
        createdAt: String(raw?.createdAt || new Date().toISOString()),
        calledAt: String(raw?.calledAt || ''),
        completedAt: String(raw?.completedAt || ''),
    };
}

function buildQueueState(tickets, updatedAt = null) {
    const list = (Array.isArray(tickets) ? tickets : []).map((ticket, index) =>
        normalizeTicket(ticket, index)
    );
    const waiting = list.filter((ticket) => ticket.status === 'waiting');
    const called = list.filter((ticket) => ticket.status === 'called');

    const c1 =
        called.find((ticket) => ticket.assignedConsultorio === 1) || null;
    const c2 =
        called.find((ticket) => ticket.assignedConsultorio === 2) || null;

    return {
        updatedAt: String(updatedAt || new Date().toISOString()),
        waitingCount: waiting.length,
        calledCount: called.length,
        counts: {
            waiting: waiting.length,
            called: called.length,
            completed: list.filter((ticket) => ticket.status === 'completed')
                .length,
            no_show: list.filter((ticket) => ticket.status === 'no_show')
                .length,
            cancelled: list.filter((ticket) => ticket.status === 'cancelled')
                .length,
        },
        callingNowByConsultorio: {
            1: c1
                ? {
                      id: c1.id,
                      ticketCode: c1.ticketCode,
                      patientInitials: c1.patientInitials,
                      assignedConsultorio: 1,
                      calledAt: c1.calledAt || new Date().toISOString(),
                  }
                : null,
            2: c2
                ? {
                      id: c2.id,
                      ticketCode: c2.ticketCode,
                      patientInitials: c2.patientInitials,
                      assignedConsultorio: 2,
                      calledAt: c2.calledAt || new Date().toISOString(),
                  }
                : null,
        },
        nextTickets: waiting.slice(0, 5).map((ticket, index) => ({
            id: ticket.id,
            ticketCode: ticket.ticketCode,
            patientInitials: ticket.patientInitials,
            position: index + 1,
        })),
    };
}

async function installAdminV2QueueMocks(page, initialTickets, options = {}) {
    let queueTickets = (
        Array.isArray(initialTickets) ? initialTickets : []
    ).map((ticket, index) => normalizeTicket(ticket, index));

    await page.route(/\/admin-auth\.php(\?.*)?$/i, async (route) =>
        json(route, {
            ok: true,
            authenticated: true,
            csrfToken: 'csrf_queue_v2',
        })
    );

    await page.route(/\/api\.php(\?.*)?$/i, async (route) => {
        const request = route.request();
        const method = request.method().toUpperCase();
        const url = new URL(request.url());
        const resource = url.searchParams.get('resource') || '';

        if (resource === 'features') {
            return json(route, {
                ok: true,
                data: {
                    admin_sony_ui: true,
                },
            });
        }

        if (resource === 'data') {
            const queueMeta = buildQueueState(
                queueTickets,
                options.staleUpdatedAt || null
            );
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
                    queueMeta,
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
                data: buildQueueState(
                    queueTickets,
                    options.staleUpdatedAt || null
                ),
            });
        }

        if (resource === 'queue-call-next' && method === 'POST') {
            const body = parseBody(request);
            const consultorio = Number(body.consultorio || 1) === 2 ? 2 : 1;
            const target = queueTickets.find(
                (ticket) =>
                    ticket.status === 'waiting' &&
                    (!ticket.assignedConsultorio ||
                        ticket.assignedConsultorio === consultorio)
            );
            if (target) {
                const calledAt = new Date().toISOString();
                queueTickets = queueTickets.map((ticket) =>
                    ticket.id === target.id
                        ? {
                              ...ticket,
                              status: 'called',
                              assignedConsultorio: consultorio,
                              calledAt,
                          }
                        : ticket
                );
            }
            return json(route, {
                ok: true,
                data: {
                    queueState: {
                        ...buildQueueState(queueTickets),
                        queue_tickets: queueTickets,
                    },
                },
            });
        }

        if (resource === 'queue-ticket' && method === 'PATCH') {
            const body = parseBody(request);
            const id = Number(body.id || 0);
            const action = String(body.action || '').toLowerCase();
            const consultorio = Number(body.consultorio || 0);

            queueTickets = queueTickets.map((ticket) => {
                if (ticket.id !== id) return ticket;
                if (action === 'reasignar') {
                    return {
                        ...ticket,
                        status: 'called',
                        assignedConsultorio: consultorio === 2 ? 2 : 1,
                        calledAt: ticket.calledAt || new Date().toISOString(),
                    };
                }
                if (action === 'completar') {
                    return {
                        ...ticket,
                        status: 'completed',
                        assignedConsultorio: null,
                        completedAt: new Date().toISOString(),
                    };
                }
                if (action === 'no_show') {
                    return {
                        ...ticket,
                        status: 'no_show',
                        assignedConsultorio: null,
                        completedAt: new Date().toISOString(),
                    };
                }
                if (action === 'cancelar') {
                    return {
                        ...ticket,
                        status: 'cancelled',
                        assignedConsultorio: null,
                        completedAt: new Date().toISOString(),
                    };
                }
                return ticket;
            });

            return json(route, {
                ok: true,
                data: {
                    queueState: {
                        ...buildQueueState(queueTickets),
                        queue_tickets: queueTickets,
                    },
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
}

test.describe('Admin queue sony_v2', () => {
    test('carga variante sony_v2 y renderiza cola base', async ({ page }) => {
        await installAdminV2QueueMocks(page, [
            {
                id: 501,
                ticketCode: 'A-501',
                queueType: 'appointment',
                patientInitials: 'EP',
                priorityClass: 'appt_overdue',
                status: 'waiting',
                createdAt: new Date(Date.now() - 45 * 60 * 1000).toISOString(),
            },
            {
                id: 502,
                ticketCode: 'A-502',
                queueType: 'walk_in',
                patientInitials: 'JP',
                priorityClass: 'walk_in',
                status: 'called',
                assignedConsultorio: 2,
                calledAt: new Date().toISOString(),
            },
        ]);

        await page.goto('/admin.html?admin_ui=sony_v2&admin_ui_reset=1');
        await expect(page.locator('html')).toHaveAttribute(
            'data-admin-ui',
            'sony_v2'
        );
        await expect(page.locator('body')).toHaveClass(/admin-v2-mode/);

        await page.locator('.nav-item[data-section="queue"]').click();
        await expect(page.locator('#queue')).toHaveClass(/active/);
        await expect(page.locator('#queueWaitingCountAdmin')).toHaveText('1');
        await expect(page.locator('#queueCalledCountAdmin')).toHaveText('1');
        await expect(page.locator('#queueC2Now')).toContainText('A-502');
    });

    test('llamado siguiente en C1 actualiza estado y tabla', async ({
        page,
    }) => {
        await installAdminV2QueueMocks(page, [
            {
                id: 601,
                ticketCode: 'A-601',
                queueType: 'appointment',
                patientInitials: 'MA',
                priorityClass: 'appt_overdue',
                status: 'waiting',
                createdAt: new Date(Date.now() - 30 * 60 * 1000).toISOString(),
            },
            {
                id: 602,
                ticketCode: 'A-602',
                queueType: 'walk_in',
                patientInitials: 'LO',
                priorityClass: 'walk_in',
                status: 'waiting',
                createdAt: new Date().toISOString(),
            },
        ]);

        await page.goto('/admin.html?admin_ui=sony_v2&admin_ui_reset=1');
        await page.locator('.nav-item[data-section="queue"]').click();
        await page
            .locator(
                '[data-action="queue-call-next"][data-queue-consultorio="1"]'
            )
            .first()
            .click();

        await expect(page.locator('#queueWaitingCountAdmin')).toHaveText('1');
        await expect(page.locator('#queueC1Now')).toContainText('A-601');
        await expect(page.locator('#queueTableBody')).toContainText('A-601');
    });

    test('filtros de queue y busqueda funcionan en v2', async ({ page }) => {
        await installAdminV2QueueMocks(page, [
            {
                id: 701,
                ticketCode: 'A-701',
                queueType: 'appointment',
                patientInitials: 'AA',
                priorityClass: 'appt_overdue',
                status: 'waiting',
                createdAt: new Date(Date.now() - 50 * 60 * 1000).toISOString(),
            },
            {
                id: 702,
                ticketCode: 'A-702',
                queueType: 'walk_in',
                patientInitials: 'BB',
                priorityClass: 'walk_in',
                status: 'waiting',
                createdAt: new Date().toISOString(),
            },
            {
                id: 703,
                ticketCode: 'A-703',
                queueType: 'appointment',
                patientInitials: 'CC',
                priorityClass: 'appt_current',
                status: 'called',
                assignedConsultorio: 2,
                calledAt: new Date().toISOString(),
                createdAt: new Date(Date.now() - 20 * 60 * 1000).toISOString(),
            },
        ]);

        await page.goto('/admin.html?admin_ui=sony_v2&admin_ui_reset=1');
        await page.locator('.nav-item[data-section="queue"]').click();

        await page.locator('[data-queue-filter="called"]').click();
        await expect(page.locator('#queueTableBody tr')).toHaveCount(1);
        await expect(page.locator('#queueTableBody')).toContainText('A-703');

        await page.locator('[data-queue-filter="sla_risk"]').click();
        await expect(page.locator('#queueTableBody tr')).toHaveCount(1);
        await expect(page.locator('#queueTableBody')).toContainText('A-701');

        await page.locator('[data-queue-filter="all"]').click();
        await page.fill('#queueSearchInput', 'A-702');
        await expect(page.locator('#queueTableBody tr')).toHaveCount(1);
        await expect(page.locator('#queueTableBody')).toContainText('A-702');
    });

    test('watchdog marca estado reconnecting cuando cola esta stale', async ({
        page,
    }) => {
        await installAdminV2QueueMocks(
            page,
            [
                {
                    id: 801,
                    ticketCode: 'A-801',
                    queueType: 'walk_in',
                    patientInitials: 'DD',
                    priorityClass: 'walk_in',
                    status: 'waiting',
                    createdAt: new Date(
                        Date.now() - 3 * 60 * 1000
                    ).toISOString(),
                },
            ],
            {
                staleUpdatedAt: new Date(Date.now() - 90 * 1000).toISOString(),
            }
        );

        await page.goto('/admin.html?admin_ui=sony_v2&admin_ui_reset=1');
        await page.locator('.nav-item[data-section="queue"]').click();

        await expect(page.locator('#queueSyncStatus')).toContainText(
            'Watchdog'
        );
        await expect(page.locator('#queueSyncStatus')).toHaveAttribute(
            'data-state',
            'reconnecting'
        );
    });

    test('acciones sensibles abren dialogo de confirmacion', async ({
        page,
    }) => {
        await installAdminV2QueueMocks(page, [
            {
                id: 901,
                ticketCode: 'A-901',
                queueType: 'appointment',
                patientInitials: 'ZZ',
                priorityClass: 'appt_current',
                status: 'called',
                assignedConsultorio: 1,
                calledAt: new Date().toISOString(),
                createdAt: new Date(Date.now() - 10 * 60 * 1000).toISOString(),
            },
        ]);

        await page.goto('/admin.html?admin_ui=sony_v2&admin_ui_reset=1');
        await page.locator('.nav-item[data-section="queue"]').click();

        await page
            .locator(
                '#queueTableBody [data-action="queue-ticket-action"][data-queue-action="no_show"]'
            )
            .first()
            .click();
        await expect(
            page.locator('#queueSensitiveConfirmDialog')
        ).toHaveAttribute('open', '');
        await expect(
            page.locator('#queueSensitiveConfirmMessage')
        ).toContainText('no_show');

        await page.locator('[data-action="queue-sensitive-cancel"]').click();
        await expect(
            page.locator('#queueSensitiveConfirmDialog')
        ).not.toHaveAttribute('open', '');
    });
});
