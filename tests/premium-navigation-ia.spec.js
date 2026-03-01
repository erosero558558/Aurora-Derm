// @ts-check
const { test, expect } = require('@playwright/test');
const { gotoPublicRoute } = require('./helpers/public-v3');

function normalizeText(value) {
    return String(value || '')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .replace(/\s+/g, ' ')
        .trim();
}

test.describe('Public navigation IA V3', () => {
    test('desktop nav keeps the reduced Sony-like order and mega panel taxonomy', async ({
        page,
    }) => {
        await page.setViewportSize({ width: 1366, height: 900 });
        await gotoPublicRoute(page, '/es/');

        const navLabels = await page
            .locator(
                '.public-nav__links > * > a, .public-nav__links > a, .public-nav__links > details > summary'
            )
            .allTextContents();
        const normalizedLabels = navLabels.map(normalizeText);
        expect(normalizedLabels).toEqual([
            'inicio',
            'servicios',
            'telemedicina',
            'legal',
        ]);

        const serviciosTrigger = page
            .locator('.public-nav__mega-shell > summary')
            .first();
        await serviciosTrigger.click();

        const megaMenu = page.locator('[data-public-mega]');
        await expect(megaMenu).toBeVisible();
        await expect(
            megaMenu.locator('.public-mega-panel__family')
        ).toHaveCount(3);
        await expect(
            megaMenu.locator('.public-mega-panel__feature-card')
        ).toHaveCount(3);
        await expect(
            megaMenu.getByRole('link', { name: /Abrir catalogo/i })
        ).toHaveAttribute('href', '/es/servicios/');
        await expect(
            megaMenu.locator('a[href="/es/servicios/?category=aesthetic"]')
        ).toBeVisible();
    });

    test('mobile keeps the same clean shell without the old app-style panel', async ({
        page,
    }) => {
        await page.setViewportSize({ width: 390, height: 844 });
        await gotoPublicRoute(page, '/es/');

        await expect(page.locator('[data-public-nav]')).toBeVisible();
        await expect(page.locator('.public-nav__actions')).toBeVisible();
        await expect(page.locator('.public-nav__cta')).toHaveAttribute(
            'href',
            '#citas'
        );
        await expect(page.locator('.sony-mobile-nav')).toHaveCount(0);
    });
});
