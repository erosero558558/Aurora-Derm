// @ts-check
const { test, expect } = require('@playwright/test');

test.use({ serviceWorkers: 'block' });

async function dismissCookieBannerIfVisible(page) {
    const banner = page.locator('#cookieBanner');
    if (await banner.isVisible().catch(() => false)) {
        const rejectButton = page.locator('#cookieRejectBtn');
        if (await rejectButton.isVisible().catch(() => false)) {
            await rejectButton.click();
            await expect(banner).toBeHidden();
        }
    }
}

async function openPublicRoute(page, pathname) {
    await page.goto(pathname);
    await dismissCookieBannerIfVisible(page);
}

async function expectLegacyBookingShellAbsent(page) {
    await expect(page.locator('script[data-data-bundle="true"]')).toHaveCount(
        0
    );
    await expect(page.locator('#appointmentForm')).toHaveCount(0);
    await expect(page.locator('#paymentModal')).toHaveCount(0);
    await expect(page.locator('#chatbotWidget')).toHaveCount(0);
}

test.describe('Public funnel routing on public-v6 maintenance flow', () => {
    test.beforeEach(async ({ page }) => {
        await page.addInitScript(() => {
            localStorage.setItem(
                'pa_cookie_consent_v1',
                JSON.stringify({
                    status: 'rejected',
                    at: new Date().toISOString(),
                })
            );
        });
    });

    test('home keeps search and first-step routing available while online booking stays paused', async ({
        page,
    }) => {
        await openPublicRoute(page, '/en/');

        const newsStrip = page.locator('[data-v6-news-strip]');
        await expect(newsStrip).toContainText(
            'Even with online booking paused, your first step does not have to wait.'
        );

        await page.locator('[data-v6-news-toggle]').click();
        await expect(page.locator('[data-v6-news-panel]')).toBeVisible();
        await expect(page.locator('[data-v6-news-panel]')).toContainText(
            'telemedicine'
        );

        await page.locator('[data-v6-search-open]').first().click();
        await expect(page.locator('[data-v6-search]')).toBeVisible();

        const searchInput = page.locator('[data-v6-search-input]');
        await searchInput.fill('tele');

        const telemedicineResult = page.locator(
            '[data-v6-search-results] a[href="/en/telemedicine/"]'
        );
        await expect(telemedicineResult).toBeVisible();
        await expect(telemedicineResult).toContainText('Telemedicine');

        await Promise.all([
            page.waitForURL(/\/en\/telemedicine\/$/),
            telemedicineResult.click(),
        ]);

        await expect(page).toHaveURL(/\/en\/telemedicine\/$/);
        await expect(page.locator('h1')).toContainText(
            'Dermatology telemedicine in Quito'
        );
    });

    test('service detail exposes the telemedicine fallback instead of the legacy booking shell', async ({
        page,
    }) => {
        await openPublicRoute(page, '/en/services/acne-rosacea/');

        await expect(page.locator('h1')).toContainText('Acne and rosacea');
        await expectLegacyBookingShellAbsent(page);

        await page.locator('[data-v6-page-menu]').click();
        const pageMenuPanel = page.locator('[data-v6-page-menu-panel]');
        await expect(pageMenuPanel).toBeVisible();

        await pageMenuPanel
            .getByRole('link', { name: 'Online booking' })
            .click();
        await expect(page).toHaveURL(/#v6-booking-status$/);

        const bookingStatus = page.locator('[data-v6-booking-status]');
        await expect(bookingStatus).toContainText(
            'Online booking under maintenance'
        );

        const telemedicineLink = bookingStatus.getByRole('link', {
            name: 'Open telemedicine',
        });
        await expect(telemedicineLink).toHaveAttribute(
            'href',
            '/en/telemedicine/'
        );
    });

    test('telemedicine closes the public funnel loop back to services while booking is paused', async ({
        page,
    }) => {
        await openPublicRoute(page, '/en/telemedicine/');

        await expect(page.locator('h1')).toContainText(
            'Dermatology telemedicine in Quito'
        );
        await expectLegacyBookingShellAbsent(page);

        const bookingStatus = page.locator('[data-v6-booking-status]');
        await expect(bookingStatus).toContainText(
            'Online booking under maintenance'
        );

        const servicesLink = bookingStatus.getByRole('link', {
            name: 'View services',
        });
        await expect(servicesLink).toHaveAttribute('href', '/en/services/');

        await Promise.all([
            page.waitForURL(/\/en\/services\/$/),
            servicesLink.click(),
        ]);

        await expect(page).toHaveURL(/\/en\/services\/$/);
        await expect(page.locator('h1')).toContainText('Dermatology services');
        await expect(
            page.locator('[data-v6-hub-featured-card]').first()
        ).toBeVisible();
        await expect(
            page.locator('[data-v6-catalog-card]').first()
        ).toBeVisible();
    });
});
