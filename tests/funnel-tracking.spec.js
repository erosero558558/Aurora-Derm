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

test.describe('Public funnel routing on current public-v6 entry flow', () => {
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

    test('home keeps route selection, search, and WhatsApp fallback available while booking stays paused', async ({
        page,
    }) => {
        await openPublicRoute(page, '/en/');

        const newsStrip = page.locator('[data-v6-news-strip]');
        await expect(newsStrip).toContainText(
            'Message us on WhatsApp and we will help you place whether today calls for clinic, treatment, or teledermatology.'
        );
        await expect(newsStrip).toContainText('teledermatology');

        await page.locator('[data-v6-news-toggle]').click();
        await expect(page.locator('[data-v6-news-panel]')).toBeVisible();
        await expect(page.locator('[data-v6-news-panel]')).toContainText(
            'Online booking is still under maintenance'
        );
        const specialtiesLink = page
            .locator('[data-v6-news-panel]')
            .getByRole('link', { name: 'Message on WhatsApp' });
        await expect(specialtiesLink).toHaveAttribute(
            'href',
            /wa\.me\/593982453672/
        );

        const bookingStatus = page.locator('[data-v6-booking-status]');
        await expect(bookingStatus).toContainText(
            'Online booking under maintenance'
        );
        const whatsappLink = bookingStatus.getByRole('link', {
            name: 'Message on WhatsApp',
        });
        await expect(whatsappLink).toHaveAttribute(
            'href',
            /wa\.me\/593982453672/
        );

        await page.locator('[data-v6-search-open]').first().click();
        await expect(page.locator('[data-v6-search]')).toBeVisible();

        const searchInput = page.locator('[data-v6-search-input]');
        await searchInput.fill('tele');

        const telemedicineResult = page.locator(
            '[data-v6-search-results] a[href="/en/telemedicine/"]'
        );
        await expect(telemedicineResult).toBeVisible();
        await expect(telemedicineResult).toContainText('Teledermatology');

        await Promise.all([
            page.waitForURL(/\/en\/telemedicine\/$/),
            telemedicineResult.click(),
        ]);

        await expect(page).toHaveURL(/\/en\/telemedicine\/$/);
        await expect(page.locator('h1')).toContainText(
            'Dermatology telemedicine in Quito'
        );
    });

    test('service detail exposes the WhatsApp fallback instead of the legacy booking shell', async ({
        page,
    }) => {
        await openPublicRoute(page, '/en/services/acne-rosacea/');

        await expect(page.locator('h1')).toContainText('Acne and rosacea');
        await expectLegacyBookingShellAbsent(page);

        await page.locator('[data-v6-page-menu]').click();
        const pageMenuPanel = page.locator('[data-v6-page-menu-panel]');
        await expect(pageMenuPanel).toBeVisible();

        await pageMenuPanel.getByRole('link', { name: 'Next step' }).click();
        await expect(page).toHaveURL(/#v6-booking-status$/);

        const bookingStatus = page.locator('[data-v6-booking-status]');
        await expect(bookingStatus).toContainText(
            'Online booking under maintenance'
        );

        const whatsappLink = bookingStatus.getByRole('link', {
            name: 'Message on WhatsApp',
        });
        await expect(whatsappLink).toHaveAttribute(
            'href',
            /wa\.me\/593982453672/
        );
    });

    test('telemedicine keeps WhatsApp as the public funnel handoff when direct examination is needed', async ({
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

        const whatsappLink = bookingStatus.getByRole('link', {
            name: 'Message on WhatsApp',
        });
        await expect(whatsappLink).toHaveAttribute(
            'href',
            /wa\.me\/593982453672/
        );
    });
});
