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
            'Escribanos por WhatsApp y le ayudamos a ubicar si hoy conviene consulta, tratamiento o teledermatologia.'
        );

        await page.locator('[data-v6-news-toggle]').click();
        const newsPanel = page.locator('[data-v6-news-panel]');
        await expect(newsPanel).toBeVisible();
        await expect(newsPanel).toContainText(
            'La agenda online sigue en mantenimiento'
        );
        await expect(
            newsPanel.getByRole('link', { name: 'Escribir por WhatsApp' })
        ).toHaveAttribute('href', /wa\.me\/593982453672/);

        await expectLegacyBookingShellAbsent(page);

        const bookingStatus = page.locator('[data-v6-booking-status]');
        await expect(bookingStatus).toContainText(
            'Reserva online en mantenimiento'
        );

        const whatsappCta = bookingStatus.getByRole('link', {
            name: 'Escribir por WhatsApp',
        });
        await expect(whatsappCta).toHaveAttribute(
            'href',
            /wa\.me\/593982453672/
        );

        await page.locator('[data-v6-search-open]').first().click();
        await expect(page.locator('[data-v6-search]')).toBeVisible();

        const searchInput = page.locator('[data-v6-search-input]');
        await searchInput.fill('tele');

        const telemedicineResult = page.locator(
            '[data-v6-search-results] a[href="/es/telemedicina/"]'
        );
        await expect(telemedicineResult).toBeVisible();
        await expect(telemedicineResult).toContainText('Teledermatologia');

        await Promise.all([
            page.waitForURL(/\/es\/telemedicina\/$/),
            telemedicineResult.click(),
        ]);

        await expect(page).toHaveURL(/\/es\/telemedicina\/$/);
        await expect(page.locator('h1')).toContainText(
            'Teledermatologia en Quito'
        );
    });

    test('detalle de servicio muestra fallback a WhatsApp en lugar del formulario legacy', async ({
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
        await expect(bookingStatus).toContainText('escribanos por WhatsApp');

        const whatsappLink = bookingStatus.getByRole('link', {
            name: 'Escribir por WhatsApp',
        });
        await expect(whatsappLink).toHaveAttribute(
            'href',
            /wa\.me\/593982453672/
        );
    });

    test('telemedicina mantiene WhatsApp como siguiente paso cuando la reserva online sigue pausada', async ({
        page,
    }) => {
        await openPublicRoute(page, '/es/telemedicina/');

        await expect(page.locator('h1')).toContainText(
            'Teledermatologia en Quito'
        );
        await expectLegacyBookingShellAbsent(page);

        await page.locator('[data-v6-page-menu]').click();
        const pageMenuPanel = page.locator('[data-v6-page-menu-panel]');
        await expect(pageMenuPanel).toBeVisible();
        await expect(
            pageMenuPanel.getByRole('link', { name: 'Siguiente paso' })
        ).toHaveAttribute('href', '#v6-booking-status');

        const bookingStatus = page.locator('[data-v6-booking-status]');
        await expect(bookingStatus).toContainText(
            'Reserva online en mantenimiento'
        );

        const whatsappLink = bookingStatus.getByRole('link', {
            name: 'Escribir por WhatsApp',
        });
        await expect(whatsappLink).toHaveAttribute(
            'href',
            /wa\.me\/593982453672/
        );
    });
});
