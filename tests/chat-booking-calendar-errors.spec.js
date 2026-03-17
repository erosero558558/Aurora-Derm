// @ts-check
const { test, expect } = require('@playwright/test');

async function expectLegacyChatBookingShellAbsent(page) {
    await expect(page.locator('#chatbotWidget')).toHaveCount(0);
    await expect(page.locator('#chatbotContainer')).toHaveCount(0);
    await expect(page.locator('#quickOptions')).toHaveCount(0);
    await expect(
        page.locator('button[data-action="quick-message"]')
    ).toHaveCount(0);
}

async function expectHeaderAssistanceSurfaces(page) {
    await expect(page.locator('[data-v6-header]')).toBeVisible();
    await expect(page.locator('[data-v6-search-open]')).toBeVisible();
    await expect(page.locator('[data-v6-drawer-open]')).toHaveCount(1);
    await expect(
        page.locator('[data-v6-header] a[href*="wa.me/"]').first()
    ).toHaveAttribute('href', /wa\.me\/593/);
}

test.describe('Public V6 assistance fallback replaces legacy chat booking shell', () => {
    test('root redirects to english home without live chat booking widget', async ({
        page,
    }) => {
        await page.goto('/');

        await page.waitForURL(/\/en\/$/);
        await expect(page).toHaveURL(/\/en\/$/);
        await expectHeaderAssistanceSurfaces(page);
        await expect(page.locator('[data-v6-news-strip]')).toContainText(
            'Message us on WhatsApp and we will help you place whether today calls for clinic, treatment, or teledermatology.'
        );

        const bookingStatus = page.locator('[data-v6-booking-status]');
        await expect(bookingStatus).toContainText(
            'Online booking under maintenance'
        );
        await expect(
            bookingStatus.getByRole('link', { name: 'Message on WhatsApp' })
        ).toHaveAttribute('href', /wa\.me\/593982453672/);
        await expectLegacyChatBookingShellAbsent(page);
    });

    test('english home keeps search, drawer, whatsapp, and booking fallback available', async ({
        page,
    }) => {
        await page.goto('/en/');

        await expectHeaderAssistanceSurfaces(page);
        await expect(page.locator('[data-v6-hero]')).toBeVisible();
        await expect(page.locator('[data-v6-booking-status]')).toContainText(
            'Online booking under maintenance'
        );
        await expect(
            page
                .locator('[data-v6-booking-status]')
                .getByRole('link', { name: 'Message on WhatsApp' })
        ).toHaveAttribute('href', /wa\.me\/593982453672/);
        await expectLegacyChatBookingShellAbsent(page);
    });

    test('spanish service detail hands booking off to WhatsApp instead of live chat', async ({
        page,
    }) => {
        await page.goto('/es/servicios/acne-rosacea/');

        await expect(page.locator('h1')).toContainText('Acne y rosacea');
        await expect(page.locator('[data-v6-booking-status]')).toContainText(
            'Reserva online en mantenimiento'
        );

        const whatsappLink = page
            .locator('[data-v6-booking-status]')
            .getByRole('link');
        await expect(whatsappLink).toHaveAttribute(
            'href',
            /wa\.me\/593982453672/
        );
        await expectLegacyChatBookingShellAbsent(page);
    });

    test('telemedicine keeps service and whatsapp handoff without chat shell', async ({
        page,
    }) => {
        await page.goto('/es/telemedicina/');

        await expectHeaderAssistanceSurfaces(page);
        await expect(page.locator('h1')).toContainText(
            'Teledermatologia en Quito'
        );
        await expect(page.locator('[data-v6-booking-status]')).toContainText(
            'Reserva online en mantenimiento'
        );
        await expect(
            page
                .locator('[data-v6-booking-status]')
                .getByRole('link', { name: 'Escribir por WhatsApp' })
        ).toHaveAttribute('href', /wa\.me\/593982453672/);
        await expectLegacyChatBookingShellAbsent(page);
    });
});
