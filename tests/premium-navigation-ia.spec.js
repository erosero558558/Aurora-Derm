// @ts-check
const { test, expect } = require('@playwright/test');
const {
    expectNoLegacyPublicShell,
    gotoPublicRoute,
    waitForHomeV6Runtime,
} = require('./helpers/public-v6');

function normalizeText(value) {
    return String(value || '')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .replace(/\s+/g, ' ')
        .trim();
}

test.describe('Public navigation IA V6', () => {
    test('desktop nav keeps the Sony-like order and mega panel taxonomy', async ({
        page,
    }) => {
        await page.setViewportSize({ width: 1366, height: 900 });
        await gotoPublicRoute(page, '/es/');
        await waitForHomeV6Runtime(page);

        const navLabels = await page
            .locator('.v6-header__nav > .v6-header__link')
            .allTextContents();
        const normalizedLabels = navLabels.map(normalizeText);
        expect(normalizedLabels).toEqual([
            'inicio',
            'servicios',
            'diagnostico',
            'tratamientos',
            'telemedicina',
            'equipo medico',
            'legal',
        ]);

        const serviciosTrigger = page.locator('[data-v6-mega-trigger]').first();
        await serviciosTrigger.click();

        const megaMenu = page.locator('[data-v6-mega]').first();
        await expect(megaMenu).toBeVisible();
        await expect(megaMenu.locator('[data-v6-mega-tab]')).toHaveCount(3);
        await expect(megaMenu.locator('[data-v6-mega-detail]')).toHaveCount(3);
        await expect(
            megaMenu.locator(
                '[data-v6-mega-detail]:not([hidden]) .v6-mega__context h3'
            )
        ).toContainText('Empiece por la ruta que aclara su caso');
        await expect(
            megaMenu.locator(
                '[data-v6-mega-detail]:not([hidden]) .v6-mega__items > li'
            )
        ).toHaveCount(3);
        await expect(
            megaMenu
                .locator('a[href="/es/servicios/diagnostico-integral/"]')
                .first()
        ).toBeVisible();
    });

    test('mobile keeps the same clean shell with V6 drawer navigation', async ({
        page,
    }) => {
        await page.setViewportSize({ width: 390, height: 844 });
        await gotoPublicRoute(page, '/es/');
        await expectNoLegacyPublicShell(page);

        const openButton = page.locator('[data-v6-drawer-open]').first();
        const drawer = page.locator('[data-v6-drawer]').first();
        await expect(openButton).toBeVisible();
        await openButton.click();

        await expect(drawer).toBeVisible();
        await expect(drawer.locator('nav > a')).toHaveCount(7);
        await expect(
            drawer.locator('[data-v6-drawer-group-toggle]')
        ).toHaveCount(3);
        await expect(drawer.locator('footer a')).toHaveCount(2);
    });
});
