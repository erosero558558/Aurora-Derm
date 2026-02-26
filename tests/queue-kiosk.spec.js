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
});
