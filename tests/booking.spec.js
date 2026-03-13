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

test.describe('Reserva online en mantenimiento', () => {
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

    test('inicio conserva la orientacion del primer paso mientras la agenda web sigue pausada', async ({
        page,
    }) => {
        await openPublicRoute(page, '/es/');

        const newsStrip = page.locator('[data-v6-news-strip]');
        await expect(newsStrip).toContainText(
            'Aunque la agenda web siga en pausa, su primer paso no tiene por que esperar.'
        );

        await page.locator('[data-v6-news-toggle]').click();
        const newsPanel = page.locator('[data-v6-news-panel]');
        await expect(newsPanel).toBeVisible();
        await expect(newsPanel).toContainText('telemedicina');
        await expect(
            newsPanel.getByRole('link', { name: 'Ver servicios' })
        ).toHaveAttribute('href', '/es/servicios/');

        await expectLegacyBookingShellAbsent(page);

        const bookingStatus = page.locator('[data-v6-booking-status]');
        await expect(bookingStatus).toContainText(
            'Reserva online en mantenimiento'
        );

        const telemedicineCta = bookingStatus.getByRole('link', {
            name: 'Abrir telemedicina',
        });
        await expect(telemedicineCta).toHaveAttribute(
            'href',
            '/es/telemedicina/'
        );

        await page.locator('[data-v6-search-open]').first().click();
        await expect(page.locator('[data-v6-search]')).toBeVisible();

        const searchInput = page.locator('[data-v6-search-input]');
        await searchInput.fill('tele');

        const telemedicineResult = page.locator(
            '[data-v6-search-results] a[href="/es/telemedicina/"]'
        );
        await expect(telemedicineResult).toBeVisible();
        await expect(telemedicineResult).toContainText('Telemedicina');

        await Promise.all([
            page.waitForURL(/\/es\/telemedicina\/$/),
            telemedicineResult.click(),
        ]);

        await expect(page).toHaveURL(/\/es\/telemedicina\/$/);
        await expect(page.locator('h1')).toContainText(
            'Telemedicina dermatologica en Quito'
        );
    });

    test('detalle de servicio muestra fallback a telemedicina en lugar del formulario legacy', async ({
        page,
    }) => {
        await openPublicRoute(page, '/es/servicios/acne-rosacea/');

        await expect(page.locator('h1')).toContainText('Acne y rosacea');
        await expectLegacyBookingShellAbsent(page);

        await page.locator('[data-v6-page-menu]').click();
        const pageMenuPanel = page.locator('[data-v6-page-menu-panel]');
        await expect(pageMenuPanel).toBeVisible();

        await pageMenuPanel
            .getByRole('link', { name: 'Reserva online' })
            .click();
        await expect(page).toHaveURL(/#v6-booking-status$/);

        const bookingStatus = page.locator('[data-v6-booking-status]');
        await expect(bookingStatus).toContainText(
            'Reserva online en mantenimiento'
        );
        await expect(bookingStatus).toContainText('empiece por telemedicina');

        const telemedicineLink = bookingStatus.getByRole('link', {
            name: 'Abrir telemedicina',
        });
        await expect(telemedicineLink).toHaveAttribute(
            'href',
            '/es/telemedicina/'
        );
    });

    test('telemedicina devuelve a servicios cuando la reserva online sigue pausada', async ({
        page,
    }) => {
        await openPublicRoute(page, '/es/telemedicina/');

        await expect(page.locator('h1')).toContainText(
            'Telemedicina dermatologica en Quito'
        );
        await expectLegacyBookingShellAbsent(page);

        await page.locator('[data-v6-page-menu]').click();
        const pageMenuPanel = page.locator('[data-v6-page-menu-panel]');
        await expect(pageMenuPanel).toBeVisible();
        await expect(
            pageMenuPanel.getByRole('link', { name: 'Reserva online' })
        ).toHaveAttribute('href', '#v6-booking-status');

        const bookingStatus = page.locator('[data-v6-booking-status]');
        await expect(bookingStatus).toContainText(
            'Reserva online en mantenimiento'
        );

        const servicesLink = bookingStatus.getByRole('link', {
            name: 'Ver servicios',
        });
        await expect(servicesLink).toHaveAttribute('href', '/es/servicios/');

        await Promise.all([
            page.waitForURL(/\/es\/servicios\/$/),
            servicesLink.click(),
        ]);

        await expect(page).toHaveURL(/\/es\/servicios\/$/);
        await expect(page.locator('h1')).toContainText(
            'Servicios dermatologicos'
        );
        await expect(
            page.locator('[data-v6-hub-featured-card]').first()
        ).toBeVisible();
        await expect(
            page.locator('[data-v6-catalog-card]').first()
        ).toBeVisible();
    });
});
