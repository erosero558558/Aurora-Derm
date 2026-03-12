// @ts-check
const { test, expect } = require('@playwright/test');
const {
    expectNoLegacyPublicShell,
    findLocaleSwitch,
    gotoPublicRoute,
    waitForBookingStatus,
    waitForHomeV6Runtime,
} = require('./helpers/public-v6');

test.describe('Public home V6', () => {
    test('renders the V6 shell and core editorial surfaces on ES home', async ({
        page,
    }) => {
        await gotoPublicRoute(page, '/es/');

        await expect(page).toHaveTitle(/Aurora Derm/i);
        await expect(page.locator('[data-v6-header]')).toBeVisible();
        await expect(page.locator('[data-v6-hero]')).toBeVisible();
        expect(
            await page.locator('[data-v6-slide]').count()
        ).toBeGreaterThanOrEqual(3);
        expect(
            await page.locator('[data-v6-indicator]').count()
        ).toBeGreaterThanOrEqual(3);
        await expect(page.locator('[data-v6-news-strip]')).toBeVisible();
        await expect(page.locator('[data-v6-editorial]')).toBeVisible();
        await expect(page.locator('[data-v6-corporate-matrix]')).toBeVisible();
        expect(
            await page
                .locator('[data-v6-editorial] .v6-editorial__card')
                .count()
        ).toBeGreaterThanOrEqual(4);
        expect(
            await page.locator('[data-v6-corporate-matrix] a').count()
        ).toBeGreaterThanOrEqual(3);
        await waitForBookingStatus(page, 'Reserva online en mantenimiento');
        await expect(page.locator('[data-v6-footer]')).toBeVisible();
        await expectNoLegacyPublicShell(page);
    });

    test('hero controls switch the active V6 slide', async ({ page }) => {
        await gotoPublicRoute(page, '/es/');

        const title = page.locator('[data-v6-band-title]').first();
        const previousTitle = (await title.innerText()).trim();

        await page.locator('[data-v6-next]').click();

        await expect(title).not.toHaveText(previousTitle);
        await expect(page.locator('[data-v6-slide].is-active')).toHaveCount(1);
    });

    test('home boots V6 runtime without legacy runtime markers', async ({
        page,
    }) => {
        await gotoPublicRoute(page, '/es/');

        await waitForHomeV6Runtime(page);
        await expect(page.locator('[data-v6-hero]')).toHaveAttribute(
            'data-v6-state',
            /^(playing|paused)$/
        );
        await expect
            .poll(
                () =>
                    page.evaluate(
                        () =>
                            document.documentElement.dataset
                                .publicV3RuntimeBooted || ''
                    ),
                { timeout: 1000 }
            )
            .toBe('');
    });

    test('english home keeps the V6 locale switch in the news strip', async ({
        page,
    }) => {
        await gotoPublicRoute(page, '/en/');

        await expect(page.locator('html')).toHaveAttribute('lang', 'en');
        const switcher = await findLocaleSwitch(page);
        await expect(switcher).toHaveAttribute('href', '/es/');
        await waitForBookingStatus(page, 'Online booking under maintenance');
        await expectNoLegacyPublicShell(page);
    });
});
