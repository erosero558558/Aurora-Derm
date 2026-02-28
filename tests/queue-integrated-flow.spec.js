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

function toIso(value) {
    const ts = Date.parse(String(value || ''));
    if (Number.isFinite(ts)) return new Date(ts).toISOString();
    return new Date().toISOString();
}

function queuePriorityRank(priorityClass) {
    const rankByPriority = {
        appt_overdue: 0,
        appt_current: 1,
        walk_in: 2,
    };
    return rankByPriority[String(priorityClass || '').toLowerCase()] ?? 9;
}

function sortWaitingTickets(a, b) {
    const priorityDiff =
        queuePriorityRank(a?.priorityClass) -
        queuePriorityRank(b?.priorityClass);
    if (priorityDiff !== 0) return priorityDiff;

    const aTs = Date.parse(String(a?.createdAt || ''));
    const bTs = Date.parse(String(b?.createdAt || ''));
    if (Number.isFinite(aTs) && Number.isFinite(bTs) && aTs !== bTs) {
        return aTs - bTs;
    }

    return Number(a?.id || 0) - Number(b?.id || 0);
}

function buildQueueState(queueTickets) {
    const tickets = Array.isArray(queueTickets) ? queueTickets : [];
    const waiting = tickets
        .filter((ticket) => String(ticket.status || '') === 'waiting')
        .sort(sortWaitingTickets);
    const called = tickets.filter(
        (ticket) => String(ticket.status || '') === 'called'
    );

    const callingNowByConsultorio = new Map();
    for (const ticket of called) {
        const room = Number(ticket.assignedConsultorio || 0);
        if ((room === 1 || room === 2) && !callingNowByConsultorio.has(room)) {
            callingNowByConsultorio.set(room, {
                id: ticket.id,
                ticketCode: ticket.ticketCode,
                patientInitials: ticket.patientInitials,
                assignedConsultorio: room,
                calledAt: toIso(ticket.calledAt),
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
            completed: tickets.filter((ticket) => ticket.status === 'completed')
                .length,
            no_show: tickets.filter((ticket) => ticket.status === 'no_show')
                .length,
            cancelled: tickets.filter((ticket) => ticket.status === 'cancelled')
                .length,
        },
        callingNow: Array.from(callingNowByConsultorio.values()),
        nextTickets: waiting.map((ticket, index) => ({
            id: ticket.id,
            ticketCode: ticket.ticketCode,
            patientInitials: ticket.patientInitials,
            position: index + 1,
            queueType: ticket.queueType,
            priorityClass: ticket.priorityClass,
        })),
    };
}

function buildQueueMetaFromState(queueState) {
    const byConsultorio = { 1: null, 2: null };
    for (const ticket of queueState.callingNow || []) {
        const room = String(ticket.assignedConsultorio || '');
        if (room === '1' || room === '2') {
            byConsultorio[room] = ticket;
        }
    }

    return {
        updatedAt: queueState.updatedAt,
        waitingCount: queueState.waitingCount,
        calledCount: queueState.calledCount,
        counts: queueState.counts || {},
        callingNowByConsultorio: byConsultorio,
        nextTickets: queueState.nextTickets || [],
    };
}

async function clickQueueTicketActionByCode(
    page,
    { ticketCode, action, consultorio = null }
) {
    const code = String(ticketCode || '').trim();
    const queueAction = String(action || '').trim();
    const room =
        consultorio === 1 || consultorio === 2 ? Number(consultorio) : null;
    if (!code || !queueAction) {
        throw new Error(
            'ticketCode/action requeridos para clickQueueTicketActionByCode'
        );
    }

    await expect(page.locator('#queueTableBody')).toContainText(code);
    await page.evaluate(
        ({
            ticketCode: targetCode,
            action: targetAction,
            consultorio: targetRoom,
        }) => {
            const rows = Array.from(
                document.querySelectorAll('#queueTableBody tr')
            );
            const row = rows.find((candidate) =>
                String(candidate?.textContent || '').includes(targetCode)
            );
            if (!row) {
                throw new Error(
                    `No se encontro fila para ticket ${targetCode}`
                );
            }

            let selector = `[data-action="queue-ticket-action"][data-queue-action="${targetAction}"]`;
            if (targetRoom === 1 || targetRoom === 2) {
                selector += `[data-queue-consultorio="${targetRoom}"]`;
            }
            const button = row.querySelector(selector);
            if (!(button instanceof HTMLButtonElement)) {
                throw new Error(
                    `No se encontro boton ${targetAction} para ticket ${targetCode}`
                );
            }
            button.click();
        },
        { ticketCode: code, action: queueAction, consultorio: room }
    );
}

async function installSharedQueueMocks(context, options = {}) {
    let nextId = 1000;
    let nextDailySeq = 1;
    let remainingCallNextFailures = Math.max(
        0,
        Number(options.callNextFailCount || 0)
    );
    /** @type {Array<Record<string, any>>} */
    let queueTickets = [];

    function nextTicketCode() {
        const code = `A-${String(nextDailySeq).padStart(3, '0')}`;
        nextDailySeq += 1;
        return code;
    }

    function createTicket({
        queueType,
        patientInitials,
        phone,
        phoneLast4,
        priorityClass,
    }) {
        const safeInitials = String(patientInitials || '--')
            .trim()
            .slice(0, 4)
            .toUpperCase();
        const safePhone = String(phone || '')
            .replace(/\D/g, '')
            .trim();
        const safePhoneLast4 =
            String(phoneLast4 || '').trim() || safePhone.slice(-4);

        const ticket = {
            id: nextId,
            ticketCode: nextTicketCode(),
            dailySeq: nextDailySeq - 1,
            queueType: String(queueType || 'walk_in'),
            appointmentId: null,
            patientInitials: safeInitials || '--',
            phoneLast4: safePhoneLast4 || '',
            priorityClass: String(priorityClass || 'walk_in'),
            status: 'waiting',
            assignedConsultorio: null,
            createdAt: new Date().toISOString(),
            calledAt: null,
            completedAt: null,
            createdSource: 'kiosk',
        };
        nextId += 1;
        queueTickets = [...queueTickets, ticket];
        return ticket;
    }

    function currentQueueState() {
        return buildQueueState(queueTickets);
    }

    await context.route(/\/admin-auth\.php(\?.*)?$/i, async (route) => {
        return json(route, {
            ok: true,
            authenticated: true,
            csrfToken: 'csrf_queue_integrated',
        });
    });

    await context.route(/\/figo-chat\.php(\?.*)?$/i, async (route) => {
        return json(route, {
            id: 'figo-kiosk-integrated',
            object: 'chat.completion',
            created: Date.now(),
            model: 'figo-assistant',
            choices: [
                {
                    index: 0,
                    message: {
                        role: 'assistant',
                        content:
                            'Modo sala: puedo ayudarte con turnos, check-in y ubicacion de consultorios.',
                    },
                    finish_reason: 'stop',
                },
            ],
            mode: 'local',
            source: 'kiosk_waiting_room',
        });
    });

    await context.route(/\/api\.php(\?.*)?$/i, async (route) => {
        const request = route.request();
        const method = request.method().toUpperCase();
        const url = new URL(request.url());
        const resource = url.searchParams.get('resource') || '';

        if (resource === 'queue-state') {
            return json(route, { ok: true, data: currentQueueState() });
        }

        if (resource === 'queue-ticket' && method === 'POST') {
            const body = parseBody(request);
            const ticket = createTicket({
                queueType: 'walk_in',
                patientInitials: body.patientInitials,
                phone: body.phone,
                priorityClass: 'walk_in',
            });
            return json(
                route,
                {
                    ok: true,
                    data: ticket,
                    printed: false,
                    print: {
                        ok: false,
                        errorCode: 'printer_disabled',
                        message: 'disabled',
                    },
                },
                201
            );
        }

        if (resource === 'queue-checkin' && method === 'POST') {
            const body = parseBody(request);
            const fallbackInitials = String(body.telefono || '').slice(-2);
            const ticket = createTicket({
                queueType: 'appointment',
                patientInitials: body.patientInitials || fallbackInitials,
                phone: body.telefono,
                priorityClass: 'appt_current',
            });
            return json(
                route,
                {
                    ok: true,
                    data: ticket,
                    printed: true,
                    print: {
                        ok: true,
                        errorCode: '',
                        message: 'ok',
                    },
                },
                201
            );
        }

        if (resource === 'queue-call-next' && method === 'POST') {
            if (remainingCallNextFailures > 0) {
                remainingCallNextFailures -= 1;
                return json(
                    route,
                    {
                        ok: false,
                        error: 'Servicio de cola temporalmente no disponible',
                    },
                    503
                );
            }

            const body = parseBody(request);
            const consultorio = Number(body.consultorio || 0);
            if (![1, 2].includes(consultorio)) {
                return json(
                    route,
                    { ok: false, error: 'Consultorio invalido' },
                    400
                );
            }

            const consultorioBusy = queueTickets.some(
                (ticket) =>
                    String(ticket.status || '') === 'called' &&
                    Number(ticket.assignedConsultorio || 0) === consultorio
            );
            if (consultorioBusy) {
                return json(
                    route,
                    {
                        ok: false,
                        error: 'Consultorio ocupado',
                        errorCode: 'queue_consultorio_busy',
                    },
                    409
                );
            }

            const waiting = queueTickets
                .filter((ticket) => String(ticket.status || '') === 'waiting')
                .sort(sortWaitingTickets);
            const candidate = waiting[0] || null;
            if (candidate) {
                const calledAt = new Date().toISOString();
                queueTickets = queueTickets.map((ticket) =>
                    Number(ticket.id || 0) === Number(candidate.id || 0)
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
                    ticket: queueTickets.find(
                        (ticket) =>
                            candidate &&
                            Number(ticket.id || 0) === Number(candidate.id || 0)
                    ),
                    queueState: currentQueueState(),
                },
            });
        }

        if (resource === 'queue-ticket' && method === 'PATCH') {
            const body = parseBody(request);
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
            /** @type {Record<string, any> | null} */
            let updatedTicket = null;

            if (
                action === 're-llamar' ||
                action === 'rellamar' ||
                action === 'recall' ||
                action === 'llamar'
            ) {
                updatedTicket = {
                    ...currentTicket,
                    status: 'called',
                    assignedConsultorio: [1, 2].includes(consultorio)
                        ? consultorio
                        : Number(currentTicket.assignedConsultorio || 0) || 1,
                    calledAt: nowIso,
                };
            } else if (action === 'liberar' || action === 'release') {
                updatedTicket = {
                    ...currentTicket,
                    status: 'waiting',
                    assignedConsultorio: null,
                    calledAt: null,
                    completedAt: null,
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
            } else if (action === 'no_show' || action === 'noshow') {
                updatedTicket = {
                    ...currentTicket,
                    status: 'no_show',
                    assignedConsultorio: null,
                    completedAt: nowIso,
                };
            } else if (
                action === 'cancelar' ||
                action === 'cancel' ||
                action === 'cancelled'
            ) {
                updatedTicket = {
                    ...currentTicket,
                    status: 'cancelled',
                    assignedConsultorio: null,
                    completedAt: nowIso,
                };
            } else if (action === 'reasignar' || action === 'reassign') {
                if (![1, 2].includes(consultorio)) {
                    return json(
                        route,
                        { ok: false, error: 'Consultorio invalido' },
                        400
                    );
                }
                const consultorioBusy = queueTickets.some(
                    (ticket) =>
                        Number(ticket.id || 0) !== ticketId &&
                        String(ticket.status || '') === 'called' &&
                        Number(ticket.assignedConsultorio || 0) === consultorio
                );
                if (consultorioBusy) {
                    return json(
                        route,
                        {
                            ok: false,
                            error: 'Consultorio ocupado',
                            errorCode: 'queue_consultorio_busy',
                        },
                        409
                    );
                }
                updatedTicket = {
                    ...currentTicket,
                    assignedConsultorio: consultorio,
                    calledAt:
                        String(currentTicket.status || '') === 'called'
                            ? currentTicket.calledAt || nowIso
                            : currentTicket.calledAt || null,
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

            return json(route, {
                ok: true,
                data: {
                    ticket: updatedTicket,
                    queueState: currentQueueState(),
                },
            });
        }

        if (resource === 'data') {
            const queueState = currentQueueState();
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

        if (resource === 'queue-reprint') {
            return json(route, {
                ok: true,
                printed: false,
                print: {
                    ok: false,
                    errorCode: 'printer_disabled',
                    message: 'disabled',
                },
            });
        }

        if (resource === 'health') {
            return json(route, { ok: true, status: 'ok' });
        }

        if (resource === 'funnel-metrics') {
            return json(route, { ok: true, data: {} });
        }

        if (resource === 'availability') {
            return json(route, {
                ok: true,
                data: {},
                meta: {
                    source: 'store',
                    mode: 'live',
                    timezone: 'America/Guayaquil',
                    generatedAt: new Date().toISOString(),
                },
            });
        }

        return json(route, { ok: true, data: {} });
    });
}

test.describe('Turnero integrado kiosco-admin-tv', () => {
    test('sincroniza llamado desde admin en tv y mantiene privacidad', async ({
        page,
    }) => {
        const context = page.context();
        await installSharedQueueMocks(context);

        const adminPage = page;
        const kioskPage = await context.newPage();
        const displayPage = await context.newPage();

        await Promise.all([
            adminPage.goto('/admin.html'),
            kioskPage.goto('/kiosco-turnos.html'),
            displayPage.goto('/sala-turnos.html'),
        ]);

        await kioskPage.fill('#walkinInitials', 'EP');
        await kioskPage.fill('#walkinPhone', '0999123456');
        await kioskPage.click('#walkinSubmit');
        await expect(kioskPage.locator('#ticketResult')).toContainText('A-001');

        await adminPage.locator('.nav-item[data-section="queue"]').click();
        await expect(adminPage.locator('#queue')).toHaveClass(/active/);
        await expect(adminPage.locator('#queueWaitingCountAdmin')).toHaveText(
            '1'
        );
        await expect(adminPage.locator('#queueTableBody')).toContainText(
            'A-001'
        );

        await adminPage
            .locator(
                '[data-action="queue-call-next"][data-queue-consultorio="2"]'
            )
            .first()
            .click();

        await expect(adminPage.locator('#queueC2Now')).toContainText('A-001');

        await expect
            .poll(
                async () =>
                    (
                        await displayPage
                            .locator('#displayConsultorio2')
                            .innerText()
                    ).trim(),
                { timeout: 10000 }
            )
            .toContain('A-001');
        await expect(displayPage.locator('#displayConsultorio2')).toContainText(
            'EP'
        );
        await expect(displayPage.locator('body')).not.toContainText(
            '0999123456'
        );
        await expect(displayPage.locator('body')).not.toContainText('3456');
    });

    test('respeta prioridad cita sobre walk-in al llamar siguiente', async ({
        page,
    }) => {
        const context = page.context();
        await installSharedQueueMocks(context);

        const adminPage = page;
        const kioskPage = await context.newPage();
        const displayPage = await context.newPage();

        await Promise.all([
            adminPage.goto('/admin.html'),
            kioskPage.goto('/kiosco-turnos.html'),
            displayPage.goto('/sala-turnos.html'),
        ]);

        await kioskPage.fill('#walkinInitials', 'WA');
        await kioskPage.click('#walkinSubmit');
        await expect(kioskPage.locator('#ticketResult')).toContainText('A-001');

        const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000)
            .toISOString()
            .slice(0, 10);
        await kioskPage.fill('#checkinPhone', '0999000111');
        await kioskPage.fill('#checkinDate', tomorrow);
        await kioskPage.fill('#checkinTime', '11:30');
        await kioskPage.fill('#checkinInitials', 'CT');
        await kioskPage.click('#checkinSubmit');
        await expect(kioskPage.locator('#ticketResult')).toContainText('A-002');

        await adminPage.locator('.nav-item[data-section="queue"]').click();
        await expect(adminPage.locator('#queue')).toHaveClass(/active/);
        await expect(adminPage.locator('#queueWaitingCountAdmin')).toHaveText(
            '2'
        );

        await adminPage
            .locator(
                '[data-action="queue-call-next"][data-queue-consultorio="1"]'
            )
            .first()
            .click();

        await expect(adminPage.locator('#queueC1Now')).toContainText('A-002');
        await expect(adminPage.locator('#queueNextAdminList')).toContainText(
            'A-001'
        );

        await expect
            .poll(
                async () =>
                    (
                        await displayPage
                            .locator('#displayConsultorio1')
                            .innerText()
                    ).trim(),
                { timeout: 10000 }
            )
            .toContain('A-002');
        await expect(displayPage.locator('#displayNextList')).toContainText(
            'A-001'
        );
    });

    test('recupera llamado tras falla transitoria y mantiene estado final consistente en TV', async ({
        page,
    }) => {
        const context = page.context();
        await installSharedQueueMocks(context, { callNextFailCount: 1 });

        const adminPage = page;
        const kioskPage = await context.newPage();
        const displayPage = await context.newPage();

        await Promise.all([
            adminPage.goto('/admin.html'),
            kioskPage.goto('/kiosco-turnos.html'),
            displayPage.goto('/sala-turnos.html'),
        ]);

        await kioskPage.fill('#walkinInitials', 'RT');
        await kioskPage.click('#walkinSubmit');
        await expect(kioskPage.locator('#ticketResult')).toContainText('A-001');

        await adminPage.locator('.nav-item[data-section="queue"]').click();
        await expect(adminPage.locator('#queue')).toHaveClass(/active/);
        await expect(adminPage.locator('#queueWaitingCountAdmin')).toHaveText(
            '1'
        );

        const callC1Button = adminPage
            .locator(
                '[data-action="queue-call-next"][data-queue-consultorio="1"]'
            )
            .first();

        await callC1Button.click();
        await expect(adminPage.locator('#queueWaitingCountAdmin')).toHaveText(
            '1'
        );
        await expect(adminPage.locator('#queueC1Now')).toContainText(
            'Sin llamado'
        );
        await expect(
            displayPage.locator('#displayConsultorio1')
        ).not.toContainText('A-001');

        await callC1Button.click();

        await expect(adminPage.locator('#queueC1Now')).toContainText('A-001');
        await expect(adminPage.locator('#queueWaitingCountAdmin')).toHaveText(
            '0'
        );
        await expect
            .poll(
                async () =>
                    (
                        await displayPage
                            .locator('#displayConsultorio1')
                            .innerText()
                    ).trim(),
                { timeout: 10000 }
            )
            .toContain('A-001');
        await expect(
            displayPage.locator('#displayConnectionState')
        ).toContainText('Conectado');
    });

    test('llamados paralelos C1/C2 mantienen tickets unicos y TV consistente con siguiente cola', async ({
        page,
    }) => {
        const context = page.context();
        await installSharedQueueMocks(context);

        const adminPage = page;
        const kioskPage = await context.newPage();
        const displayPage = await context.newPage();

        await Promise.all([
            adminPage.goto('/admin.html'),
            kioskPage.goto('/kiosco-turnos.html'),
            displayPage.goto('/sala-turnos.html'),
        ]);

        const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000)
            .toISOString()
            .slice(0, 10);

        await kioskPage.fill('#walkinInitials', 'W1');
        await kioskPage.click('#walkinSubmit');
        await expect(kioskPage.locator('#ticketResult')).toContainText('A-001');

        await kioskPage.fill('#checkinPhone', '0999888777');
        await kioskPage.fill('#checkinDate', tomorrow);
        await kioskPage.fill('#checkinTime', '10:00');
        await kioskPage.fill('#checkinInitials', 'AP');
        await kioskPage.click('#checkinSubmit');
        await expect(kioskPage.locator('#ticketResult')).toContainText('A-002');

        await kioskPage.fill('#walkinInitials', 'W2');
        await kioskPage.click('#walkinSubmit');
        await expect(kioskPage.locator('#ticketResult')).toContainText('A-003');

        await adminPage.locator('.nav-item[data-section="queue"]').click();
        await expect(adminPage.locator('#queue')).toHaveClass(/active/);
        await expect(adminPage.locator('#queueWaitingCountAdmin')).toHaveText(
            '3'
        );

        const callC1Button = adminPage
            .locator(
                '[data-action="queue-call-next"][data-queue-consultorio="1"]'
            )
            .first();
        const callC2Button = adminPage
            .locator(
                '[data-action="queue-call-next"][data-queue-consultorio="2"]'
            )
            .first();

        await expect(callC1Button).toBeVisible();
        await expect(callC2Button).toBeVisible();
        await adminPage.evaluate(() => {
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

        await expect(adminPage.locator('#queueWaitingCountAdmin')).toHaveText(
            '1'
        );
        await expect(adminPage.locator('#queueNextAdminList')).toContainText(
            'A-003'
        );

        const c1NowText =
            (await adminPage.locator('#queueC1Now').textContent()) || '';
        const c2NowText =
            (await adminPage.locator('#queueC2Now').textContent()) || '';
        const c1Code = (c1NowText.match(/A-\d+/) || [])[0] || '';
        const c2Code = (c2NowText.match(/A-\d+/) || [])[0] || '';

        expect(c1Code).toBeTruthy();
        expect(c2Code).toBeTruthy();
        expect(c1Code).not.toEqual(c2Code);
        expect([c1Code, c2Code]).toEqual(
            expect.arrayContaining(['A-001', 'A-002'])
        );

        await expect(displayPage.locator('#displayNextList')).toContainText(
            'A-003'
        );
        await expect
            .poll(
                async () => {
                    const c1 = (
                        await displayPage
                            .locator('#displayConsultorio1')
                            .innerText()
                    ).trim();
                    const c2 = (
                        await displayPage
                            .locator('#displayConsultorio2')
                            .innerText()
                    ).trim();
                    return `${c1}\n${c2}`;
                },
                { timeout: 10000 }
            )
            .toMatch(/A-00[12]/);
    });

    test('acciones de ticket en admin (reasignar, completar, no_show) sincronizan estado con TV', async ({
        page,
    }) => {
        const context = page.context();
        await installSharedQueueMocks(context);

        const adminPage = page;
        const kioskPage = await context.newPage();
        const displayPage = await context.newPage();

        await Promise.all([
            adminPage.goto('/admin.html'),
            kioskPage.goto('/kiosco-turnos.html'),
            displayPage.goto('/sala-turnos.html'),
        ]);

        const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000)
            .toISOString()
            .slice(0, 10);

        await kioskPage.fill('#walkinInitials', 'W1');
        await kioskPage.click('#walkinSubmit');
        await expect(kioskPage.locator('#ticketResult')).toContainText('A-001');

        await kioskPage.fill('#checkinPhone', '0999888777');
        await kioskPage.fill('#checkinDate', tomorrow);
        await kioskPage.fill('#checkinTime', '10:00');
        await kioskPage.fill('#checkinInitials', 'AP');
        await kioskPage.click('#checkinSubmit');
        await expect(kioskPage.locator('#ticketResult')).toContainText('A-002');

        await kioskPage.fill('#walkinInitials', 'W3');
        await kioskPage.click('#walkinSubmit');
        await expect(kioskPage.locator('#ticketResult')).toContainText('A-003');

        await adminPage.locator('.nav-item[data-section="queue"]').click();
        await expect(adminPage.locator('#queue')).toHaveClass(/active/);
        await expect(adminPage.locator('#queueWaitingCountAdmin')).toHaveText(
            '3'
        );

        await adminPage
            .locator(
                '[data-action="queue-call-next"][data-queue-consultorio="1"]'
            )
            .first()
            .click();
        await expect(adminPage.locator('#queueC1Now')).toContainText('A-002');
        await expect(adminPage.locator('#queueWaitingCountAdmin')).toHaveText(
            '2'
        );

        await expect
            .poll(
                async () =>
                    (
                        await displayPage
                            .locator('#displayConsultorio1')
                            .innerText()
                    ).trim(),
                { timeout: 10000 }
            )
            .toContain('A-002');

        await clickQueueTicketActionByCode(adminPage, {
            ticketCode: 'A-002',
            action: 'reasignar',
            consultorio: 2,
        });

        await expect(adminPage.locator('#queueC2Now')).toContainText('A-002');
        await expect(adminPage.locator('#queueC1Now')).toContainText(
            'Sin llamado'
        );

        await expect
            .poll(
                async () =>
                    (
                        await displayPage
                            .locator('#displayConsultorio2')
                            .innerText()
                    ).trim(),
                { timeout: 10000 }
            )
            .toContain('A-002');

        await clickQueueTicketActionByCode(adminPage, {
            ticketCode: 'A-002',
            action: 'completar',
        });

        await expect(adminPage.locator('#queueC2Now')).toContainText(
            'Sin llamado'
        );
        await expect(adminPage.locator('#queueWaitingCountAdmin')).toHaveText(
            '2'
        );
        await expect
            .poll(
                async () =>
                    (
                        await displayPage
                            .locator('#displayConsultorio2')
                            .innerText()
                    ).trim(),
                { timeout: 10000 }
            )
            .not.toContain('A-002');

        await adminPage
            .locator(
                '[data-action="queue-call-next"][data-queue-consultorio="1"]'
            )
            .first()
            .click();
        await expect(adminPage.locator('#queueC1Now')).toContainText('A-001');
        await expect(adminPage.locator('#queueWaitingCountAdmin')).toHaveText(
            '1'
        );

        await clickQueueTicketActionByCode(adminPage, {
            ticketCode: 'A-003',
            action: 'no_show',
        });

        await expect(adminPage.locator('#queueWaitingCountAdmin')).toHaveText(
            '0'
        );
        await expect(adminPage.locator('#queueTableBody')).toContainText(
            'No asistio'
        );
        await expect(displayPage.locator('#displayNextList')).not.toContainText(
            'A-003'
        );
    });

    test('stress operativo: lote de turnos + llamados C1/C2 + cierre masivo estable', async ({
        page,
    }) => {
        const context = page.context();
        await installSharedQueueMocks(context);

        const adminPage = page;
        const kioskPage = await context.newPage();
        const displayPage = await context.newPage();

        await Promise.all([
            adminPage.goto('/admin.html'),
            kioskPage.goto('/kiosco-turnos.html'),
            displayPage.goto('/sala-turnos.html'),
        ]);

        for (const initials of ['S1', 'S2', 'S3', 'S4', 'S5', 'S6']) {
            await kioskPage.fill('#walkinInitials', initials);
            await kioskPage.click('#walkinSubmit');
        }
        await expect(kioskPage.locator('#ticketResult')).toContainText('A-006');

        await adminPage.locator('.nav-item[data-section="queue"]').click();
        await expect(adminPage.locator('#queue')).toHaveClass(/active/);
        await expect(adminPage.locator('#queueWaitingCountAdmin')).toHaveText(
            '6'
        );

        await adminPage
            .locator(
                '[data-action="queue-call-next"][data-queue-consultorio="1"]'
            )
            .first()
            .click();
        await adminPage
            .locator(
                '[data-action="queue-call-next"][data-queue-consultorio="2"]'
            )
            .first()
            .click();

        await expect(adminPage.locator('#queueWaitingCountAdmin')).toHaveText(
            '4'
        );
        await expect(adminPage.locator('#queueC1Now')).not.toContainText(
            'Sin llamado'
        );
        await expect(adminPage.locator('#queueC2Now')).not.toContainText(
            'Sin llamado'
        );

        adminPage.on('dialog', (dialog) => dialog.accept());
        await adminPage
            .locator(
                '[data-action="queue-bulk-action"][data-queue-action="completar"]'
            )
            .click();

        await expect(adminPage.locator('#queueWaitingCountAdmin')).toHaveText(
            '0'
        );
        await expect(adminPage.locator('#queueC1Now')).toContainText(
            'Sin llamado'
        );
        await expect(adminPage.locator('#queueC2Now')).toContainText(
            'Sin llamado'
        );
        await expect(displayPage.locator('#displayNextList')).toContainText(
            'No hay turnos pendientes.'
        );
    });
});
