// @ts-check
const { test, expect } = require('@playwright/test');
const { gotoPublicRoute, waitForBookingHooks } = require('./helpers/public-v3');

test.describe('Public home V3', () => {
    test('renders the new shell and editorial macro sections on ES home', async ({
        page,
    }) => {
        await gotoPublicRoute(page, '/es/');

        await expect(page).toHaveTitle(/Piel en Armonia/i);
        await expect(page.locator('[data-public-nav]')).toBeVisible();
        await expect(page.locator('[data-stage-carousel]')).toBeVisible();
        await expect(page.locator('[data-stage-slide]')).toHaveCount(3);
        await expect(
            page.locator('[data-stage-slide][data-stage-tone]')
        ).toHaveCount(3);
        await expect(page.locator('[data-stage-trigger]')).toHaveCount(3);
        await expect(
            page.locator('[data-stage-slide].is-active .hero-stage__stats li')
        ).toHaveCount(3);
        const stageTones = await page
            .locator('[data-stage-slide][data-stage-tone]')
            .evaluateAll((nodes) =>
                nodes.map((node) => node.getAttribute('data-stage-tone') || '')
            );
        expect(
            stageTones.every((tone) =>
                ['ink', 'porcelain', 'silver'].includes(tone)
            )
        ).toBeTruthy();
        await expect(page.locator('[data-latest-news]')).toBeVisible();
        await expect(
            page.locator('[data-featured-story] .featured-story')
        ).toHaveCount(3);
        await expect(
            page.locator('[data-program-grid] .program-grid__card')
        ).toHaveCount(3);
        await expect(page.locator('[data-telemedicine-band]')).toBeVisible();
        await expect(
            page.locator('[data-doctor-band] .doctor-band__card')
        ).toHaveCount(2);
        await expect(page.locator('[data-booking-bridge-band]')).toBeVisible();
        const sectionTones = await page
            .locator('[data-telemedicine-band], [data-booking-bridge-band]')
            .evaluateAll((nodes) =>
                nodes.map(
                    (node) => node.getAttribute('data-section-tone') || ''
                )
            );
        expect(
            sectionTones.every((tone) =>
                ['ink', 'porcelain', 'silver'].includes(tone)
            )
        ).toBeTruthy();
        await expect(page.locator('[data-public-footer]')).toBeVisible();
        await expect(page.locator('.sony-hero')).toHaveCount(0);
    });

    test('stage trigger switches the active editorial story', async ({
        page,
    }) => {
        await gotoPublicRoute(page, '/es/');

        const firstTrigger = page.locator('[data-stage-trigger]').nth(0);
        const secondTrigger = page.locator('[data-stage-trigger]').nth(1);
        await expect(firstTrigger).toHaveClass(/is-active/);
        await secondTrigger.click();
        await expect(secondTrigger).toHaveClass(/is-active/);
        await expect(page.locator('[data-stage-slide].is-active')).toHaveCount(
            1
        );
    });

    test('booking bridge hydrates the legacy hooks without restoring the old shell', async ({
        page,
    }) => {
        await gotoPublicRoute(page, '/es/');
        await waitForBookingHooks(page);
        await expect(page.locator('#chatbotWidget')).toHaveCount(1);
        await expect(page.locator('#chatbotContainer')).toHaveCount(1);
    });

    test('booking and cookie surfaces are rendered natively before the legacy runtime boots on home', async ({
        page,
    }) => {
        await gotoPublicRoute(page, '/es/');

        await expect(page.locator('[data-public-booking-shell]')).toBeVisible();
        await expect(page.locator('#appointmentForm')).toBeVisible();
        await expect(page.locator('#cookieBanner')).toContainText(/cookies/i);
        await expect(page.locator('#videoModal')).toBeAttached();
        await expect(page.locator('#paymentModal')).toBeAttached();
        await expect(page.locator('#successModal')).toBeAttached();
        await expect(page.locator('#rescheduleModal')).toBeAttached();
        await expect(page.locator('#reviewModal')).toBeAttached();
        await expect(page.locator('.booking-bridge__placeholder')).toHaveCount(
            0
        );
        await expect
            .poll(
                async () =>
                    page.evaluate(
                        () =>
                            document.documentElement.dataset
                                .publicV3RuntimeBooted || ''
                    ),
                { timeout: 1000 }
            )
            .toBe('');
    });

    test('english home keeps the same V3 structure and locale switch', async ({
        page,
    }) => {
        await gotoPublicRoute(page, '/en/');

        await expect(page.locator('html')).toHaveAttribute('lang', 'en');
        await expect(page.locator('.public-nav__lang')).toHaveAttribute(
            'href',
            '/es/'
        );
        await expect(page.locator('[data-stage-carousel]')).toBeVisible();
        await expect(page.locator('[data-latest-news]')).toContainText(
            /Latest/i
        );
        await expect(
            page.locator('[data-program-grid] .program-grid__card')
        ).toHaveCount(3);
        await expect(page.locator('[data-booking-bridge-band]')).toBeVisible();
        await expect(page.locator('[data-telemedicine-band]')).toHaveAttribute(
            'data-section-tone',
            /^(ink|porcelain|silver)$/
        );
        await expect(
            page.locator('[data-booking-bridge-band]')
        ).toHaveAttribute('data-section-tone', /^(ink|porcelain|silver)$/);
        await expect(page.locator('.sony-hero')).toHaveCount(0);
    });
});
