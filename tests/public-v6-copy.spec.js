// @ts-check
const { test, expect } = require('@playwright/test');
const { gotoPublicRoute } = require('./helpers/public-v3');

const prohibited = [
    /garantizado/i,
    /100%/i,
    /cura definitiva/i,
    /sin riesgos/i,
    /guaranteed/i,
    /definitive cure/i,
    /risk[- ]free/i,
];

test.describe('Public V6 copy integrity', () => {
    test('ES routes keep usted register and avoid prohibited claims', async ({
        page,
    }) => {
        for (const route of ['/es/', '/es/servicios/', '/es/telemedicina/']) {
            await gotoPublicRoute(page, route);
            const text = await page.locator('body').innerText();
            expect(text.toLowerCase()).toContain('usted');
            prohibited.forEach((pattern) => {
                expect(text).not.toMatch(pattern);
            });
        }
    });

    test('EN routes avoid Spanish leakage and prohibited claims', async ({
        page,
    }) => {
        for (const route of ['/en/', '/en/services/', '/en/telemedicine/']) {
            await gotoPublicRoute(page, route);
            const text = await page.locator('body').innerText();
            expect(text.toLowerCase()).not.toContain(' usted ');
            prohibited.forEach((pattern) => {
                expect(text).not.toMatch(pattern);
            });
        }
    });
});
