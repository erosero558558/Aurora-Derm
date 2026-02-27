// @ts-check
const { test, expect } = require('@playwright/test');

function json(route, payload, status = 200) {
    return route.fulfill({
        status,
        contentType: 'application/json; charset=utf-8',
        body: JSON.stringify(payload),
    });
}

test.describe('Sala turnos display', () => {
    test('renderiza llamados activos y siguientes turnos', async ({ page }) => {
        await page.route(/\/api\.php(\?.*)?$/i, async (route) => {
            const url = new URL(route.request().url());
            const resource = url.searchParams.get('resource') || '';
            if (resource !== 'queue-state') {
                return json(route, { ok: true, data: {} });
            }

            return json(route, {
                ok: true,
                data: {
                    updatedAt: new Date().toISOString(),
                    callingNow: [
                        {
                            id: 1,
                            ticketCode: 'A-051',
                            patientInitials: 'JP',
                            assignedConsultorio: 1,
                            calledAt: new Date().toISOString(),
                        },
                        {
                            id: 2,
                            ticketCode: 'A-052',
                            patientInitials: 'MC',
                            assignedConsultorio: 2,
                            calledAt: new Date().toISOString(),
                        },
                    ],
                    nextTickets: [
                        {
                            id: 3,
                            ticketCode: 'A-053',
                            patientInitials: 'EP',
                            position: 1,
                        },
                        {
                            id: 4,
                            ticketCode: 'A-054',
                            patientInitials: 'LR',
                            position: 2,
                        },
                    ],
                },
            });
        });

        await page.goto('/sala-turnos.html');

        await expect(page.locator('#displayConsultorio1')).toContainText(
            'A-051'
        );
        await expect(page.locator('#displayConsultorio2')).toContainText(
            'A-052'
        );
        await expect(page.locator('#displayNextList li')).toHaveCount(2);
        await expect(page.locator('#displayNextList')).toContainText('A-053');
        await expect(page.locator('#displayConnectionState')).toContainText(
            'Conectado'
        );
    });

    test('muestra watchdog degradado y recupera con refresh manual', async ({
        page,
    }) => {
        let queueStateCalls = 0;
        await page.route(/\/api\.php(\?.*)?$/i, async (route) => {
            const url = new URL(route.request().url());
            const resource = url.searchParams.get('resource') || '';
            if (resource !== 'queue-state') {
                return json(route, { ok: true, data: {} });
            }

            queueStateCalls += 1;
            if (queueStateCalls === 1) {
                return json(route, {
                    ok: true,
                    data: {
                        updatedAt: new Date(
                            Date.now() - 95 * 1000
                        ).toISOString(),
                        callingNow: [],
                        nextTickets: [],
                    },
                });
            }

            return json(route, {
                ok: true,
                data: {
                    updatedAt: new Date().toISOString(),
                    callingNow: [],
                    nextTickets: [],
                },
            });
        });

        await page.goto('/sala-turnos.html');

        await expect(page.locator('#displayManualRefreshBtn')).toHaveCount(1, {
            timeout: 15000,
        });
        await expect
            .poll(async () => {
                const text = await page
                    .locator('#displayConnectionState')
                    .textContent();
                return text || '';
            })
            .toContain('Watchdog');
        await expect(page.locator('#displayOpsHint')).toContainText(
            'estancados'
        );

        await page.locator('#displayManualRefreshBtn').click();

        await expect
            .poll(async () => {
                const text = await page
                    .locator('#displayConnectionState')
                    .textContent();
                return text || '';
            })
            .toContain('Conectado');
        await expect
            .poll(async () => {
                const text = await page
                    .locator('#displayOpsHint')
                    .textContent();
                return text || '';
            })
            .toMatch(/Sincronizacion manual exitosa|Panel estable/i);
    });

    test('permite silenciar campanilla y mantiene preferencia local', async ({
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
                    updatedAt: new Date().toISOString(),
                    callingNow: [
                        {
                            id: 1,
                            ticketCode: 'A-301',
                            patientInitials: 'EP',
                            assignedConsultorio: 1,
                            calledAt: new Date().toISOString(),
                        },
                    ],
                    nextTickets: [],
                },
            });
        });

        await page.goto('/sala-turnos.html');

        await expect(page.locator('#displayBellToggleBtn')).toHaveCount(1, {
            timeout: 15000,
        });
        await expect(page.locator('#displayBellToggleBtn')).toContainText('On');

        await page.locator('#displayBellToggleBtn').click();
        await expect(page.locator('#displayBellToggleBtn')).toContainText(
            'Off'
        );

        const storedMuted = await page.evaluate(() =>
            localStorage.getItem('queueDisplayBellMuted')
        );
        expect(storedMuted).toBe('1');

        await page.reload();
        await expect(page.locator('#displayBellToggleBtn')).toContainText(
            'Off'
        );

        await page.keyboard.press('Alt+Shift+KeyM');
        await expect(page.locator('#displayBellToggleBtn')).toContainText('On');
    });
});
