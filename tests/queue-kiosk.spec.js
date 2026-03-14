// @ts-check
const { test, expect } = require('@playwright/test');
const {
    installTurneroClinicProfileFailure,
    installTurneroClinicProfileMock,
    installTurneroQueueStateMock,
} = require('./helpers/turnero-surface-mocks');

function json(route, payload, status = 200) {
    return route.fulfill({
        status,
        contentType: 'application/json; charset=utf-8',
        body: JSON.stringify(payload),
    });
}

function supportReasonLabel(reason) {
    return (
        {
            human_help: 'Ayuda humana',
            lost_ticket: 'Perdio su ticket',
            printer_issue: 'Problema de impresion',
            appointment_not_found: 'Cita no encontrada',
            ticket_duplicate: 'Ticket duplicado',
            special_priority: 'Prioridad especial',
            accessibility: 'Accesibilidad',
            clinical_redirect: 'Derivacion clinica',
            late_arrival: 'Llegada tarde',
            offline_pending: 'Pendiente offline',
            no_phone: 'Sin celular',
            schedule_taken: 'Horario ocupado',
            reprint_requested: 'Reimpresion solicitada',
            general: 'Apoyo general',
        }[String(reason || 'general')] || 'Apoyo general'
    );
}

test.describe('Kiosco turnos', () => {
    test('aplica branding del perfil clinico en cabecera y contexto del kiosco', async ({
        page,
    }) => {
        await installTurneroClinicProfileMock(page, {
            clinic_id: 'clinica-norte-demo',
            branding: {
                name: 'Clinica Norte',
                short_name: 'Norte',
                city: 'Quito',
            },
            consultorios: {
                c1: { label: 'Dermatología 1', short_label: 'D1' },
                c2: { label: 'Dermatología 2', short_label: 'D2' },
            },
            surfaces: {
                kiosk: {
                    enabled: true,
                    route: '/kiosco-turnos.html',
                },
            },
        });

        await installTurneroQueueStateMock(page);

        await page.goto('/kiosco-turnos.html');

        await expect(page).toHaveTitle(/Clinica Norte/i);
        await expect(page.locator('.kiosk-brand strong')).toContainText(
            'Clinica Norte'
        );
        await expect(page.locator('#kioskClinicMeta')).toContainText(
            'clinica-norte-demo · Quito'
        );
        await expect(page.locator('#kioskClinicContext')).toContainText(
            'Norte · /kiosco-turnos.html · Dermatología 1 · Dermatología 2'
        );
        await expect(page.locator('#kioskProfileStatus')).toContainText(
            'Perfil remoto verificado'
        );
    });

    test('degrada kiosco si la ruta del perfil no coincide con la superficie activa', async ({
        page,
    }) => {
        let ticketRequests = 0;
        await installTurneroClinicProfileMock(page, {
            clinic_id: 'clinica-norte-demo',
            branding: {
                name: 'Clinica Norte',
                short_name: 'Norte',
            },
            surfaces: {
                kiosk: {
                    enabled: true,
                    route: '/kiosco-alt.html',
                },
            },
        });

        await installTurneroQueueStateMock(page, {
            handleApiRoute({ resource }) {
                if (resource === 'queue-ticket') {
                    ticketRequests += 1;
                }
                return false;
            },
        });

        await page.goto('/kiosco-turnos.html');

        await expect(page.locator('#kioskSetupTitle')).toContainText(
            'Ruta del piloto incorrecta'
        );
        await expect(page.locator('#kioskProfileStatus')).toContainText(
            'Bloqueado · ruta fuera de canon'
        );
        await expect(page.locator('#kioskSetupChecks')).toContainText(
            '/kiosco-alt.html'
        );
        await page.fill('#walkinInitials', 'EP');
        await page.click('#walkinSubmit');
        await expect(page.locator('#kioskStatus')).toContainText(
            'No se puede operar este kiosco'
        );
        await expect(page.locator('#ticketResult')).toContainText(
            'Todavia no se ha generado ningun ticket.'
        );
        await expect(page.locator('#queueOutboxHint')).toContainText(
            'Pendientes offline: 0'
        );
        expect(ticketRequests).toBe(0);
    });

    test('degrada kiosco si clinic-profile.json no carga y queda en perfil de respaldo', async ({
        page,
    }) => {
        let checkinRequests = 0;
        await installTurneroClinicProfileFailure(page);

        await installTurneroQueueStateMock(page, {
            handleApiRoute({ resource }) {
                if (resource === 'queue-checkin') {
                    checkinRequests += 1;
                }
                return false;
            },
        });

        await page.goto('/kiosco-turnos.html');

        await expect(page.locator('#kioskSetupTitle')).toContainText(
            'Perfil de clínica no cargado'
        );
        await expect(page.locator('#kioskProfileStatus')).toContainText(
            'Bloqueado · perfil de respaldo'
        );
        await expect(page.locator('#kioskSetupChecks')).toContainText(
            'perfil de respaldo'
        );
        await page.fill('#checkinPhone', '0999999999');
        await page.fill('#checkinDate', '2026-03-13');
        await page.fill('#checkinTime', '09:30');
        await page.click('#checkinSubmit');
        await expect(page.locator('#kioskStatus')).toContainText(
            'No se puede operar este kiosco'
        );
        await expect(page.locator('#ticketResult')).toContainText(
            'Todavia no se ha generado ningun ticket.'
        );
        await expect(page.locator('#queueOutboxHint')).toContainText(
            'Pendientes offline: 0'
        );
        expect(checkinRequests).toBe(0);
    });

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
        await expect(page.locator('#kioskSetupTitle')).toContainText(
            'Revisa la impresora termica'
        );
        await expect(page.locator('#kioskSetupChecks')).toContainText(
            'printer_disabled'
        );
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

    test('enruta No tengo cita sin usar chat libre', async ({ page }) => {
        let chatCalls = 0;

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
                        nextTickets: [],
                        estimatedWaitMin: 8,
                        assistancePendingCount: 0,
                        activeHelpRequests: [],
                    },
                });
            }

            return json(route, { ok: true, data: {} });
        });

        await page.route(/\/figo-chat\.php(\?.*)?$/i, async (route) => {
            chatCalls += 1;
            return json(route, {
                choices: [
                    {
                        message: {
                            role: 'assistant',
                            content: 'respuesta libre',
                        },
                    },
                ],
            });
        });

        await page.goto('/kiosco-turnos.html');

        await page.fill('#assistantInput', 'No tengo cita');
        await page.click('#assistantSend');

        await expect(page.locator('#assistantMessages')).toContainText(
            'Te llevo a No tengo cita'
        );
        await expect(page.locator('#walkinInitials')).toBeFocused();
        expect(chatCalls).toBe(0);
    });

    test('bloquea consulta clinica y deriva a recepcion sin usar chat libre', async ({
        page,
    }) => {
        let chatCalls = 0;
        let helpRequestBody = null;

        await page.route(/\/api\.php(\?.*)?$/i, async (route) => {
            const request = route.request();
            const url = new URL(request.url());
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
                        assistancePendingCount: 0,
                        activeHelpRequests: [],
                    },
                });
            }

            if (resource === 'queue-help-request') {
                helpRequestBody = request.postDataJSON();
                return json(
                    route,
                    {
                        ok: true,
                        data: {
                            helpRequest: {
                                id: 801,
                                source: 'assistant',
                                reason: 'clinical_redirect',
                                reasonLabel: 'Derivacion clinica',
                                status: 'pending',
                                patientInitials: '--',
                                createdAt: new Date().toISOString(),
                                updatedAt: new Date().toISOString(),
                            },
                            queueState: {
                                updatedAt: new Date().toISOString(),
                                waitingCount: 0,
                                calledCount: 0,
                                callingNow: [],
                                nextTickets: [],
                                assistancePendingCount: 1,
                                activeHelpRequests: [
                                    {
                                        id: 801,
                                        source: 'assistant',
                                        reason: 'clinical_redirect',
                                        reasonLabel: 'Derivacion clinica',
                                        status: 'pending',
                                        patientInitials: '--',
                                        createdAt: new Date().toISOString(),
                                        updatedAt: new Date().toISOString(),
                                    },
                                ],
                            },
                        },
                    },
                    201
                );
            }

            return json(route, { ok: true, data: {} });
        });

        await page.route(/\/figo-chat\.php(\?.*)?$/i, async (route) => {
            chatCalls += 1;
            return json(route, {
                choices: [
                    {
                        message: {
                            role: 'assistant',
                            content: 'respuesta libre',
                        },
                    },
                ],
            });
        });

        await page.goto('/kiosco-turnos.html');

        await page.fill(
            '#assistantInput',
            'Que crema me pongo para el sarpullido'
        );
        await page.click('#assistantSend');

        await expect(page.locator('#assistantMessages')).toContainText(
            'no doy orientacion medica'
        );
        expect(chatCalls).toBe(0);
        expect(helpRequestBody?.reason).toBe('clinical_redirect');
        await expect(page.locator('#queueOutboxHint')).toContainText(
            'Pendientes offline: 0'
        );
    });

    test('envia contexto operativo al escalar cita no encontrada', async ({
        page,
    }) => {
        let chatCalls = 0;
        let helpRequestBody = null;

        await page.route(/\/api\.php(\?.*)?$/i, async (route) => {
            const request = route.request();
            const url = new URL(request.url());
            const resource = url.searchParams.get('resource') || '';

            if (resource === 'queue-state') {
                return json(route, {
                    ok: true,
                    data: {
                        updatedAt: new Date().toISOString(),
                        waitingCount: 1,
                        calledCount: 0,
                        callingNow: [],
                        nextTickets: [],
                        estimatedWaitMin: 8,
                        assistancePendingCount: 0,
                        activeHelpRequests: [],
                    },
                });
            }

            if (resource === 'queue-help-request') {
                helpRequestBody = request.postDataJSON();
                return json(
                    route,
                    {
                        ok: true,
                        data: {
                            helpRequest: {
                                id: 811,
                                source: 'assistant',
                                reason: 'appointment_not_found',
                                reasonLabel: 'Cita no encontrada',
                                status: 'pending',
                                patientInitials: 'EP',
                                createdAt: new Date().toISOString(),
                                updatedAt: new Date().toISOString(),
                            },
                            queueState: {
                                updatedAt: new Date().toISOString(),
                                waitingCount: 1,
                                calledCount: 0,
                                callingNow: [],
                                nextTickets: [],
                                estimatedWaitMin: 8,
                                assistancePendingCount: 1,
                                activeHelpRequests: [
                                    {
                                        id: 811,
                                        source: 'assistant',
                                        reason: 'appointment_not_found',
                                        reasonLabel: 'Cita no encontrada',
                                        status: 'pending',
                                        patientInitials: 'EP',
                                        createdAt: new Date().toISOString(),
                                        updatedAt: new Date().toISOString(),
                                    },
                                ],
                            },
                        },
                    },
                    201
                );
            }

            return json(route, { ok: true, data: {} });
        });

        await page.route(/\/figo-chat\.php(\?.*)?$/i, async (route) => {
            chatCalls += 1;
            return json(route, {
                choices: [
                    {
                        message: {
                            role: 'assistant',
                            content: 'respuesta libre',
                        },
                    },
                ],
            });
        });

        await page.goto('/kiosco-turnos.html');

        await page.fill('#checkinInitials', 'EP');
        await page.fill('#checkinPhone', '0991234567');
        await page.fill('#checkinDate', '2026-03-13');
        await page.fill('#checkinTime', '10:30');
        await page.fill('#assistantInput', 'No encuentro mi cita');
        await page.click('#assistantSend');

        await expect(page.locator('#assistantMessages')).toContainText(
            'revisa telefono, fecha y hora en Tengo cita'
        );
        expect(chatCalls).toBe(0);
        expect(helpRequestBody?.reason).toBe('appointment_not_found');
        expect(helpRequestBody?.context?.selectedFlow).toBe('checkin');
        expect(helpRequestBody?.context?.phoneLast4).toBe('4567');
        expect(helpRequestBody?.context?.requestedDate).toBe('2026-03-13');
        expect(helpRequestBody?.context?.requestedTime).toBe('10:30');
    });

    test('enruta excepciones operativas restantes sin usar chat libre', async ({
        page,
    }) => {
        let chatCalls = 0;
        const helpReasons = [];

        await page.route(/\/api\.php(\?.*)?$/i, async (route) => {
            const request = route.request();
            const url = new URL(request.url());
            const resource = url.searchParams.get('resource') || '';

            if (resource === 'queue-state') {
                return json(route, {
                    ok: true,
                    data: {
                        updatedAt: new Date().toISOString(),
                        waitingCount: 1,
                        calledCount: 0,
                        callingNow: [],
                        nextTickets: [],
                        assistancePendingCount: 0,
                        activeHelpRequests: [],
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
                            errorCode: '',
                            message: 'ok',
                        },
                    },
                    201
                );
            }

            if (resource === 'queue-help-request') {
                const body = request.postDataJSON();
                const reason = String(body.reason || 'general');
                helpReasons.push(reason);
                const helpRequest = {
                    id: 900 + helpReasons.length,
                    source: 'assistant',
                    reason,
                    reasonLabel: supportReasonLabel(reason),
                    status: 'pending',
                    patientInitials: 'EP',
                    createdAt: new Date().toISOString(),
                    updatedAt: new Date().toISOString(),
                };
                return json(
                    route,
                    {
                        ok: true,
                        data: {
                            helpRequest,
                            queueState: {
                                updatedAt: new Date().toISOString(),
                                waitingCount: 1,
                                calledCount: 0,
                                callingNow: [],
                                nextTickets: [],
                                assistancePendingCount: 1,
                                activeHelpRequests: [helpRequest],
                            },
                        },
                    },
                    201
                );
            }

            return json(route, { ok: true, data: {} });
        });

        await page.route(/\/figo-chat\.php(\?.*)?$/i, async (route) => {
            chatCalls += 1;
            return json(route, {
                choices: [
                    {
                        message: {
                            role: 'assistant',
                            content: 'respuesta libre',
                        },
                    },
                ],
            });
        });

        await page.goto('/kiosco-turnos.html');

        await page.fill('#walkinInitials', 'EP');
        await page.click('#walkinSubmit');
        await expect(page.locator('#ticketResult')).toContainText('A-101');

        await page.fill('#assistantInput', 'Me salieron dos tickets');
        await page.click('#assistantSend');
        await expect(page.locator('#assistantMessages')).toContainText(
            'ticket duplicado'
        );

        await page.fill('#assistantInput', 'Llegue tarde a mi cita');
        await page.click('#assistantSend');
        await expect(page.locator('#assistantMessages')).toContainText(
            'llegada tarde'
        );

        await page.fill('#assistantInput', 'No traje mi celular');
        await page.click('#assistantSend');
        await expect(page.locator('#assistantMessages')).toContainText(
            'sin celular'
        );

        await page.fill('#assistantInput', 'Ese horario ya esta ocupado');
        await page.click('#assistantSend');
        await expect(page.locator('#assistantMessages')).toContainText(
            'reprogramacion o cambio de horario'
        );

        await page.fill('#assistantInput', 'Mi turno quedo pendiente offline');
        await page.click('#assistantSend');
        await expect(page.locator('#assistantMessages')).toContainText(
            'pendiente offline'
        );

        expect(helpReasons).toEqual([
            'ticket_duplicate',
            'late_arrival',
            'no_phone',
            'schedule_taken',
            'offline_pending',
        ]);
        expect(chatCalls).toBe(0);
    });

    test('publica metricas acumuladas del asistente en heartbeat del kiosco', async ({
        page,
    }) => {
        const heartbeatBodies = [];

        await page.route(/\/api\.php(\?.*)?$/i, async (route) => {
            const request = route.request();
            const url = new URL(request.url());
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
                        assistancePendingCount: 0,
                        activeHelpRequests: [],
                    },
                });
            }

            if (resource === 'queue-help-request') {
                return json(
                    route,
                    {
                        ok: true,
                        data: {
                            helpRequest: {
                                id: 910,
                                source: 'assistant',
                                reason: 'clinical_redirect',
                                reasonLabel: 'Derivacion clinica',
                                status: 'pending',
                                patientInitials: '--',
                                createdAt: new Date().toISOString(),
                                updatedAt: new Date().toISOString(),
                            },
                            queueState: {
                                updatedAt: new Date().toISOString(),
                                waitingCount: 0,
                                calledCount: 0,
                                callingNow: [],
                                nextTickets: [],
                                assistancePendingCount: 1,
                                activeHelpRequests: [
                                    {
                                        id: 910,
                                        source: 'assistant',
                                        reason: 'clinical_redirect',
                                        reasonLabel: 'Derivacion clinica',
                                        status: 'pending',
                                        patientInitials: '--',
                                        createdAt: new Date().toISOString(),
                                        updatedAt: new Date().toISOString(),
                                    },
                                ],
                            },
                        },
                    },
                    201
                );
            }

            if (resource === 'queue-surface-heartbeat') {
                heartbeatBodies.push(request.postDataJSON());
                return json(route, {
                    ok: true,
                    data: {
                        status: 'ready',
                    },
                });
            }

            return json(route, { ok: true, data: {} });
        });

        await page.goto('/kiosco-turnos.html');
        await expect.poll(() => heartbeatBodies.length).toBeGreaterThan(0);

        await page.fill('#assistantInput', 'No tengo cita');
        await page.click('#assistantSend');
        await expect(page.locator('#assistantMessages')).toContainText(
            'Te llevo a No tengo cita'
        );

        await page.fill(
            '#assistantInput',
            'Que crema me pongo para el sarpullido'
        );
        await page.click('#assistantSend');
        await expect(page.locator('#assistantMessages')).toContainText(
            'no doy orientacion medica'
        );

        await expect
            .poll(
                () =>
                    heartbeatBodies.find((body) => {
                        const details = body?.details || {};
                        return (
                            Number(details.assistantActioned || 0) >= 2 &&
                            Number(
                                details.assistantResolvedWithoutHuman || 0
                            ) >= 1 &&
                            Number(details.assistantClinicalBlocked || 0) >=
                                1 &&
                            Number(details.assistantLatencySamples || 0) >= 2
                        );
                    }) || null
            )
            .not.toBeNull();

        const telemetry = heartbeatBodies.find((body) => {
            const details = body?.details || {};
            return (
                Number(details.assistantActioned || 0) >= 2 &&
                Number(details.assistantResolvedWithoutHuman || 0) >= 1 &&
                Number(details.assistantClinicalBlocked || 0) >= 1
            );
        });

        expect(telemetry?.surface).toBe('kiosk');
        expect(telemetry?.details?.assistantLastIntent).toBe(
            'clinical_blocked'
        );
        expect(telemetry?.details?.assistantIntents?.walk_in).toBe(1);
        expect(
            telemetry?.details?.assistantHelpReasons?.clinical_redirect
        ).toBe(1);
    });

    test('guarda apoyo offline y lo sincroniza al reconectar', async ({
        page,
    }) => {
        let supportOffline = true;

        await page.route(/\/api\.php(\?.*)?$/i, async (route) => {
            const request = route.request();
            const url = new URL(request.url());
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
                        assistancePendingCount: supportOffline ? 0 : 1,
                        activeHelpRequests: supportOffline
                            ? []
                            : [
                                  {
                                      id: 901,
                                      source: 'assistant',
                                      reason: 'human_help',
                                      reasonLabel: 'Ayuda humana',
                                      status: 'pending',
                                      patientInitials: '--',
                                      createdAt: new Date().toISOString(),
                                      updatedAt: new Date().toISOString(),
                                  },
                              ],
                    },
                });
            }

            if (resource === 'queue-help-request') {
                if (supportOffline) {
                    return route.abort('failed');
                }
                return json(
                    route,
                    {
                        ok: true,
                        data: {
                            helpRequest: {
                                id: 901,
                                source: 'assistant',
                                reason: 'human_help',
                                reasonLabel: 'Ayuda humana',
                                status: 'pending',
                                patientInitials: '--',
                                createdAt: new Date().toISOString(),
                                updatedAt: new Date().toISOString(),
                            },
                            queueState: {
                                updatedAt: new Date().toISOString(),
                                waitingCount: 0,
                                calledCount: 0,
                                callingNow: [],
                                nextTickets: [],
                                assistancePendingCount: 1,
                                activeHelpRequests: [
                                    {
                                        id: 901,
                                        source: 'assistant',
                                        reason: 'human_help',
                                        reasonLabel: 'Ayuda humana',
                                        status: 'pending',
                                        patientInitials: '--',
                                        createdAt: new Date().toISOString(),
                                        updatedAt: new Date().toISOString(),
                                    },
                                ],
                            },
                        },
                    },
                    201
                );
            }

            return json(route, { ok: true, data: {} });
        });

        await page.goto('/kiosco-turnos.html');

        await page.fill('#assistantInput', 'Necesito ayuda humana');
        await page.click('#assistantSend');

        await expect(page.locator('#assistantMessages')).toContainText(
            'Apoyo guardado offline'
        );
        await expect(page.locator('#queueOutboxHint')).toContainText(
            'Pendientes offline: 1'
        );

        supportOffline = false;
        await page.locator('#queueOutboxRetryBtn').click();

        await expect
            .poll(
                async () =>
                    (await page.locator('#queueOutboxHint').textContent()) ||
                    '',
                { timeout: 12000 }
            )
            .toContain('Pendientes offline: 0');
        await expect(page.locator('#kioskStatus')).toContainText(
            'Apoyo sincronizado'
        );
    });

    test('muestra kiosco listo cuando hay impresion valida y backend sano', async ({
        page,
    }) => {
        await page.addInitScript(() => {
            localStorage.setItem(
                'queueKioskPrinterState',
                JSON.stringify({
                    schema: 'turnero-clinic-storage/v1',
                    values: {
                        'clinica-norte-demo': {
                            ok: true,
                            printed: true,
                            errorCode: '',
                            message: 'ok',
                            at: new Date().toISOString(),
                        },
                    },
                })
            );
        });

        await installTurneroClinicProfileMock(page, {
            clinic_id: 'clinica-norte-demo',
            branding: {
                name: 'Clinica Norte',
                short_name: 'Norte',
            },
            surfaces: {
                kiosk: {
                    enabled: true,
                    route: '/kiosco-turnos.html',
                },
            },
        });

        await installTurneroQueueStateMock(page);

        await page.goto('/kiosco-turnos.html');

        await expect(page.locator('#kioskSetupTitle')).toContainText(
            'Kiosco listo para operar'
        );
        await expect(page.locator('#kioskSetupChecks')).toContainText(
            'Impresion OK'
        );
        await expect(page.locator('#kioskSetupChecks')).toContainText(
            'Sin pendientes locales'
        );
    });

    test('ignora senior mode, impresora y outbox heredados de otra clinica', async ({
        page,
    }) => {
        await page.addInitScript(() => {
            localStorage.setItem(
                'queueKioskSeniorMode',
                JSON.stringify({
                    schema: 'turnero-clinic-storage/v1',
                    values: {
                        'clinica-sur-demo': '1',
                    },
                })
            );
            localStorage.setItem(
                'queueKioskPrinterState',
                JSON.stringify({
                    schema: 'turnero-clinic-storage/v1',
                    values: {
                        'clinica-sur-demo': {
                            ok: true,
                            printed: true,
                            errorCode: '',
                            message: 'ok',
                            at: new Date().toISOString(),
                        },
                    },
                })
            );
            localStorage.setItem(
                'queueKioskOfflineOutbox',
                JSON.stringify({
                    schema: 'turnero-clinic-storage/v1',
                    values: {
                        'clinica-sur-demo': [
                            {
                                id: 'offline-sur-1',
                                resource: 'queue-ticket',
                                body: { patientInitials: 'SR' },
                                originLabel: 'Ticket offline',
                                patientInitials: 'SR',
                                queueType: 'walk_in',
                                renderMode: 'ticket',
                                queuedAt: new Date().toISOString(),
                                attempts: 0,
                                lastError: '',
                                fingerprint: 'sur-fingerprint',
                            },
                        ],
                    },
                })
            );
        });

        await installTurneroClinicProfileMock(page, {
            clinic_id: 'clinica-norte-demo',
            branding: {
                name: 'Clinica Norte',
                short_name: 'Norte',
            },
            surfaces: {
                kiosk: {
                    enabled: true,
                    route: '/kiosco-turnos.html',
                },
            },
        });

        await installTurneroQueueStateMock(page);

        await page.goto('/kiosco-turnos.html');

        await expect(page.locator('#kioskSeniorToggle')).toContainText('Off');
        await expect(page.locator('#queueOutboxHint')).toContainText(
            'Pendientes offline: 0'
        );
        await expect(page.locator('#queuePrinterHint')).toContainText(
            'estado pendiente'
        );
        await expect(page.locator('#kioskSetupChecks')).not.toContainText(
            'Impresion OK'
        );
    });

    test('acepta payload queue-state con snake_case sin dejar cola vacia', async ({
        page,
    }) => {
        await installTurneroQueueStateMock(page, {
            queueState: () => ({
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
            }),
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
        await installTurneroQueueStateMock(page, {
            queueState: ({ callCount }) => ({
                updatedAt: new Date(
                    Date.now() - (callCount === 1 ? 90 * 1000 : 0)
                ).toISOString(),
                waitingCount: 1,
                calledCount: 0,
                callingNow: [],
                nextTickets: [],
            }),
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
