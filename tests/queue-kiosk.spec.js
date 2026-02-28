// @ts-check
const { test, expect } = require('@playwright/test');

function json(route, payload, status = 200) {
    return route.fulfill({
        status,
        contentType: 'application/json; charset=utf-8',
        body: JSON.stringify(payload),
    });
}

test.describe('Kiosco turnos', () => {
    test('genera walk-in y responde asistente de sala', async ({ page }) => {
        await page.route(/\/api\.php(\?.*)?$/i, async (route) => {
            const url = new URL(route.request().url());
            const resource = url.searchParams.get('resource') || '';

            if (resource === 'queue-state') {
                return json(route, {
                    ok: true,
                    data: {
                        updatedAt: new Date().toISOString(),
                        waitingCount: 2,
                        calledCount: 1,
                        callingNow: [
                            {
                                id: 1,
                                ticketCode: 'A-001',
                                patientInitials: 'JP',
                                assignedConsultorio: 1,
                                calledAt: new Date().toISOString(),
                            },
                        ],
                        nextTickets: [
                            {
                                id: 101,
                                ticketCode: 'A-101',
                                patientInitials: 'EP',
                                position: 1,
                                queueType: 'walk_in',
                                priorityClass: 'walk_in',
                            },
                        ],
                    },
                });
            }

            if (resource === 'queue-ticket') {
                return json(
                    route,
                    {
                        ok: true,
                        data: {
                            id: 101,
                            ticketCode: 'A-101',
                            patientInitials: 'EP',
                            queueType: 'walk_in',
                            createdAt: new Date().toISOString(),
                        },
                        printed: false,
                        print: {
                            ok: true,
                            errorCode: 'printer_disabled',
                            message: 'disabled',
                        },
                    },
                    201
                );
            }

            if (resource === 'queue-checkin') {
                return json(
                    route,
                    {
                        ok: true,
                        data: {
                            id: 102,
                            ticketCode: 'A-102',
                            patientInitials: 'EP',
                            queueType: 'appointment',
                            createdAt: new Date().toISOString(),
                        },
                        printed: true,
                        print: { ok: true, errorCode: '', message: 'ok' },
                    },
                    201
                );
            }

            return json(route, { ok: true, data: {} });
        });

        await page.route(/\/figo-chat\.php(\?.*)?$/i, async (route) => {
            return json(route, {
                id: 'figo-kiosk-test',
                object: 'chat.completion',
                created: Date.now(),
                model: 'figo-assistant',
                choices: [
                    {
                        index: 0,
                        message: {
                            role: 'assistant',
                            content:
                                'Usa la opcion Tengo cita para check-in o No tengo cita para turno.',
                        },
                        finish_reason: 'stop',
                    },
                ],
                mode: 'local',
                source: 'kiosk_waiting_room',
            });
        });

        await page.goto('/kiosco-turnos.html');
        await expect(page.locator('h1')).toContainText(
            'Registro en sala de espera'
        );

        await page.fill('#walkinInitials', 'EP');
        await page.click('#walkinSubmit');

        await expect(page.locator('#ticketResult')).toContainText('A-101');
        await expect(page.locator('#queueWaitingCount')).toHaveText('2');
        await expect(page.locator('#queueConnectionState')).toContainText(
            'Cola conectada'
        );
        await expect(page.locator('#queueUpdatedAt')).not.toContainText(
            'pendiente'
        );

        await page.fill('#assistantInput', 'Como hago check-in');
        await page.click('#assistantSend');
        await expect(page.locator('#assistantMessages')).toContainText(
            'Tengo cita'
        );
    });

    test('acepta payload queue-state con snake_case sin dejar cola vacia', async ({
        page,
    }) => {
        await page.route(/\/api\.php(\?.*)?$/i, async (route) => {
            const url = new URL(route.request().url());
            const resource = url.searchParams.get('resource') || '';

            if (resource !== 'queue-state') {
                return json(route, { ok: true, data: {} });
            }

            return json(route, {
                ok: true,
                data: {
                    updated_at: new Date().toISOString(),
                    waiting_count: 2,
                    called_count: 1,
                    calling_now: [
                        {
                            id: 31,
                            ticket_code: 'A-031',
                            patient_initials: 'KR',
                            assigned_consultorio: 2,
                            called_at: new Date().toISOString(),
                        },
                    ],
                    next_tickets: [
                        {
                            id: 32,
                            ticket_code: 'A-032',
                            patient_initials: 'LP',
                            queue_type: 'walk_in',
                            priority_class: 'walk_in',
                        },
                        {
                            id: 33,
                            ticket_code: 'A-033',
                            patient_initials: 'RM',
                            queue_type: 'appointment',
                            priority_class: 'appt_current',
                        },
                    ],
                },
            });
        });

        await page.goto('/kiosco-turnos.html');

        await expect(page.locator('#queueWaitingCount')).toHaveText('2');
        await expect(page.locator('#queueCalledCount')).toHaveText('1');
        await expect(page.locator('#queueCallingNow')).toContainText('A-031');
        await expect(page.locator('#queueNextList')).toContainText('A-032');
        await expect(page.locator('#queueNextList')).toContainText('A-033');
    });

    test('activa modo degradado por watchdog y recupera con refresh manual', async ({
        page,
    }) => {
        let queueStateCalls = 0;
        await page.route(/\/api\.php(\?.*)?$/i, async (route) => {
            const url = new URL(route.request().url());
            const resource = url.searchParams.get('resource') || '';

            if (resource === 'queue-state') {
                queueStateCalls += 1;
                if (queueStateCalls === 1) {
                    return json(route, {
                        ok: true,
                        data: {
                            updatedAt: new Date(
                                Date.now() - 90 * 1000
                            ).toISOString(),
                            waitingCount: 1,
                            calledCount: 0,
                            callingNow: [],
                            nextTickets: [],
                        },
                    });
                }

                return json(route, {
                    ok: true,
                    data: {
                        updatedAt: new Date().toISOString(),
                        waitingCount: 1,
                        calledCount: 0,
                        callingNow: [],
                        nextTickets: [],
                    },
                });
            }

            return json(route, { ok: true, data: {} });
        });

        await page.goto('/kiosco-turnos.html');

        await expect(page.locator('#queueManualRefreshBtn')).toHaveCount(1, {
            timeout: 15000,
        });
        await expect
            .poll(async () => {
                const text = await page
                    .locator('#queueConnectionState')
                    .textContent();
                return text || '';
            })
            .toContain('Watchdog');
        await expect(page.locator('#queueOpsHint')).toContainText('degradada');

        await page.locator('#queueManualRefreshBtn').click();

        await expect
            .poll(async () => {
                const text = await page
                    .locator('#queueConnectionState')
                    .textContent();
                return text || '';
            })
            .toContain('Cola conectada');
        await expect
            .poll(async () => {
                const text = await page.locator('#queueOpsHint').textContent();
                return text || '';
            })
            .toMatch(/Sincronizacion manual exitosa|Operacion estable/i);
    });

    test('reinicia la sesion por privacidad manual e inactividad', async ({
        page,
    }) => {
        await page.addInitScript(() => {
            window.__PIEL_QUEUE_KIOSK_IDLE_RESET_MS = 5000;
        });

        await page.route(/\/api\.php(\?.*)?$/i, async (route) => {
            const url = new URL(route.request().url());
            const resource = url.searchParams.get('resource') || '';

            if (resource === 'queue-state') {
                return json(route, {
                    ok: true,
                    data: {
                        updatedAt: new Date().toISOString(),
                        waitingCount: 1,
                        calledCount: 0,
                        callingNow: [],
                        nextTickets: [
                            {
                                id: 210,
                                ticketCode: 'A-210',
                                patientInitials: 'EP',
                                position: 1,
                            },
                        ],
                    },
                });
            }

            if (resource === 'queue-ticket') {
                return json(
                    route,
                    {
                        ok: true,
                        data: {
                            id: 210,
                            ticketCode: 'A-210',
                            patientInitials: 'EP',
                            queueType: 'walk_in',
                            createdAt: new Date().toISOString(),
                        },
                        printed: false,
                        print: {
                            ok: true,
                            errorCode: 'printer_disabled',
                            message: 'disabled',
                        },
                    },
                    201
                );
            }

            return json(route, { ok: true, data: {} });
        });

        await page.goto('/kiosco-turnos.html');
        await expect(page.locator('#kioskSessionResetBtn')).toHaveCount(1, {
            timeout: 15000,
        });

        await page.fill('#walkinInitials', 'EP');
        await page.click('#walkinSubmit');
        await expect(page.locator('#ticketResult')).toContainText('A-210');

        await page.locator('#kioskSessionResetBtn').click();
        await expect(page.locator('#ticketResult')).toContainText(
            'Todavia no se ha generado ningun ticket.'
        );
        await expect(page.locator('#kioskStatus')).toContainText(
            'Pantalla limpiada'
        );

        await page.fill('#walkinInitials', 'EP');
        await page.click('#walkinSubmit');
        await expect(page.locator('#ticketResult')).toContainText('A-210');

        await expect
            .poll(
                async () => {
                    const text = await page
                        .locator('#kioskStatus')
                        .textContent();
                    return text || '';
                },
                { timeout: 12000 }
            )
            .toContain('inactividad');
        await expect(page.locator('#ticketResult')).toContainText(
            'Todavia no se ha generado ningun ticket.'
        );
    });

    test('guarda solicitudes en outbox offline y sincroniza al reconectar', async ({
        page,
    }) => {
        let offlineTicketMode = true;
        let ticketSeq = 0;

        await page.route(/\/api\.php(\?.*)?$/i, async (route) => {
            const url = new URL(route.request().url());
            const resource = url.searchParams.get('resource') || '';

            if (resource === 'queue-state') {
                return json(route, {
                    ok: true,
                    data: {
                        updatedAt: new Date().toISOString(),
                        waitingCount: ticketSeq ? 1 : 0,
                        calledCount: 0,
                        callingNow: [],
                        nextTickets: ticketSeq
                            ? [
                                  {
                                      id: 331,
                                      ticketCode: 'A-331',
                                      patientInitials: 'EP',
                                      position: 1,
                                  },
                              ]
                            : [],
                    },
                });
            }

            if (resource === 'queue-ticket') {
                if (offlineTicketMode) {
                    return route.abort('failed');
                }
                ticketSeq += 1;
                return json(
                    route,
                    {
                        ok: true,
                        data: {
                            id: 331,
                            ticketCode: 'A-331',
                            patientInitials: 'EP',
                            queueType: 'walk_in',
                            createdAt: new Date().toISOString(),
                        },
                        printed: false,
                        print: {
                            ok: true,
                            errorCode: 'printer_disabled',
                            message: 'disabled',
                        },
                    },
                    201
                );
            }

            return json(route, { ok: true, data: {} });
        });

        await page.goto('/kiosco-turnos.html');

        await page.fill('#walkinInitials', 'EP');
        await page.click('#walkinSubmit');

        await expect(page.locator('#ticketResult')).toContainText(
            'Solicitud guardada offline'
        );
        await expect(page.locator('#kioskStatus')).toContainText(
            'guardado offline'
        );
        await expect(page.locator('#queueOutboxHint')).toContainText(
            'Pendientes offline: 1'
        );
        await expect(page.locator('#queueOutboxList')).toContainText(
            'Turno sin cita'
        );
        await expect(page.locator('#queueOutboxRetryBtn')).toBeVisible();

        offlineTicketMode = false;
        await page.locator('#queueOutboxRetryBtn').click();

        await expect
            .poll(
                async () => {
                    const text = await page
                        .locator('#queueOutboxHint')
                        .textContent();
                    return text || '';
                },
                { timeout: 12000 }
            )
            .toContain('Pendientes offline: 0');
        await expect
            .poll(
                async () => {
                    const text = await page
                        .locator('#kioskStatus')
                        .textContent();
                    return text || '';
                },
                { timeout: 12000 }
            )
            .toContain('sincronizado');
    });

    test('permite limpiar pendientes offline desde consola', async ({
        page,
    }) => {
        await page.route(/\/api\.php(\?.*)?$/i, async (route) => {
            const url = new URL(route.request().url());
            const resource = url.searchParams.get('resource') || '';

            if (resource === 'queue-state') {
                return json(route, {
                    ok: true,
                    data: {
                        updatedAt: new Date().toISOString(),
                        waitingCount: 0,
                        calledCount: 0,
                        callingNow: [],
                        nextTickets: [],
                    },
                });
            }

            if (resource === 'queue-ticket') {
                return route.abort('failed');
            }

            return json(route, { ok: true, data: {} });
        });

        await page.goto('/kiosco-turnos.html');

        await page.fill('#walkinInitials', 'EP');
        await page.click('#walkinSubmit');
        await page.fill('#walkinInitials', 'MC');
        await page.click('#walkinSubmit');

        await expect(page.locator('#queueOutboxHint')).toContainText(
            'Pendientes offline: 2'
        );
        await expect(page.locator('#queueOutboxList')).toContainText(
            'Turno sin cita'
        );

        await page.locator('#queueOutboxClearBtn').click();

        await expect(page.locator('#queueOutboxHint')).toContainText(
            'Pendientes offline: 0'
        );
        await expect(page.locator('#queueOutboxList')).toContainText(
            'Sin pendientes offline.'
        );
    });

    test('evita duplicar pendientes offline identicos en ventana corta', async ({
        page,
    }) => {
        await page.route(/\/api\.php(\?.*)?$/i, async (route) => {
            const url = new URL(route.request().url());
            const resource = url.searchParams.get('resource') || '';

            if (resource === 'queue-state') {
                return json(route, {
                    ok: true,
                    data: {
                        updatedAt: new Date().toISOString(),
                        waitingCount: 0,
                        calledCount: 0,
                        callingNow: [],
                        nextTickets: [],
                    },
                });
            }

            if (resource === 'queue-ticket') {
                return route.abort('failed');
            }

            return json(route, { ok: true, data: {} });
        });

        await page.goto('/kiosco-turnos.html');

        await page.fill('#walkinInitials', 'EP');
        await page.fill('#walkinPhone', '0999123456');
        await page.click('#walkinSubmit');
        await expect(page.locator('#queueOutboxHint')).toContainText(
            'Pendientes offline: 1'
        );

        await page.fill('#walkinInitials', 'EP');
        await page.fill('#walkinPhone', '0999123456');
        await page.click('#walkinSubmit');

        await expect(page.locator('#queueOutboxHint')).toContainText(
            'Pendientes offline: 1'
        );
        await expect(page.locator('#kioskStatus')).toContainText(
            'ya pendiente offline'
        );
    });
});
