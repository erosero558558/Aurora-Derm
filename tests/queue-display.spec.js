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
                        { id: 3, ticketCode: 'A-053', patientInitials: 'EP', position: 1 },
                        { id: 4, ticketCode: 'A-054', patientInitials: 'LR', position: 2 },
                    ],
                },
            });
        });

        await page.goto('/sala-turnos.html');

        await expect(page.locator('#displayConsultorio1')).toContainText('A-051');
        await expect(page.locator('#displayConsultorio2')).toContainText('A-052');
        await expect(page.locator('#displayNextList li')).toHaveCount(2);
        await expect(page.locator('#displayNextList')).toContainText('A-053');
    });
});

