const { test, expect } = require('@playwright/test');

async function expectLegacyShellAbsent(page) {
    await expect(page.locator('[data-public-nav]')).toHaveCount(0);
    await expect(page.locator('[data-stage-carousel]')).toHaveCount(0);
    await expect(page.locator('[data-program-grid]')).toHaveCount(0);
    await expect(page.locator('[data-booking-bridge-band]')).toHaveCount(0);
    await expect(page.locator('#appointmentForm')).toHaveCount(0);
}

test.describe('Deferred shell static fallback', () => {
    test('home keeps the public V6 static shell usable when the V6 runtime script fails to load', async ({
        page,
    }) => {
        await page.route('**/js/public-v6-shell.js**', (route) =>
            route.abort()
        );

        await page.goto('/es/', { waitUntil: 'domcontentloaded' });
        await page
            .waitForLoadState('load', { timeout: 20000 })
            .catch(() => null);

        await expect(page.locator('[data-v6-header]')).toBeVisible();
        await expect(page.locator('[data-v6-hero]')).toBeVisible();
        await expect(page.locator('[data-v6-news-strip]')).toContainText(
            'Aunque la agenda web siga en pausa, su primer paso no tiene por que esperar.'
        );

        const editorial = page.locator('[data-v6-editorial]');
        await expect(editorial).toBeVisible();
        await expect(
            editorial.getByRole('link', { name: /Telemedicina/i })
        ).toBeVisible();

        const matrix = page.locator('[data-v6-corporate-matrix]');
        await expect(matrix).toBeVisible();
        await expect(
            matrix.getByRole('link', { name: /Acne y rosacea/i })
        ).toBeVisible();

        const bookingStatus = page.locator('[data-v6-booking-status]');
        await expect(bookingStatus).toBeVisible();
        await expect(bookingStatus).toContainText(
            'Reserva online en mantenimiento'
        );
        await expect(
            bookingStatus.getByRole('link', { name: 'Abrir telemedicina' })
        ).toHaveAttribute('href', '/es/telemedicina/');

        await expectLegacyShellAbsent(page);
    });
});
