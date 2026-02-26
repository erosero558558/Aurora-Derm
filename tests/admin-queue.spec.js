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
});
