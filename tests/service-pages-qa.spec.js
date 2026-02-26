// @ts-check
const { test, expect } = require('@playwright/test');

const SERVICE_PAGES = [
    {
        path: '/servicios/acne.html',
        name: 'acne',
        intentBadge: /acne/i,
        ctaHref: '#citas',
        bookingValue: 'acne',
    },
    {
        path: '/servicios/laser.html',
        name: 'laser',
        intentBadge: /laser/i,
        ctaHref: '#citas',
        bookingValue: 'laser',
    },
];

const MOBILE_VIEWPORTS = [
    { width: 390, height: 844, label: '390x844' },
    { width: 412, height: 915, label: '412x915' },
];

async function waitForStablePage(page, path) {
    await page.goto(path, { waitUntil: 'domcontentloaded', timeout: 45000 });
    await page.waitForLoadState('load', { timeout: 20000 }).catch(() => null);
    await page.waitForTimeout(1200);
}

async function expectElementInsideViewport(locator, page, label) {
    await expect(locator).toBeVisible();
    const box = await locator.boundingBox();
    expect(box, `${label} bounding box missing`).not.toBeNull();
    const viewport = page.viewportSize();
    expect(viewport, `${label} viewport missing`).not.toBeNull();
    expect(box.x, `${label} overflows left`).toBeGreaterThanOrEqual(-1);
    expect(
        box.x + box.width,
        `${label} overflows right (${viewport.width}px)`
    ).toBeLessThanOrEqual(viewport.width + 1);
}

test.describe('Service pages conversion QA', () => {
    test('desktop hero panel shows service-specific conversion cues', async ({
        page,
    }) => {
        for (const service of SERVICE_PAGES) {
            await page.setViewportSize({ width: 1366, height: 900 });
            await waitForStablePage(page, service.path);

            await expect(page.locator('.hero').first()).toBeVisible();
            const panel = page
                .locator('[data-qa="service-intent-panel"]')
                .first();
            await expect(panel).toBeVisible();
            await expect(panel).toContainText(service.intentBadge);

            const heroCta = page
                .locator('.hero-actions a[href="#citas"]')
                .first();
            await expect(heroCta).toBeVisible();

            const panelCta = panel
                .locator(`a[href="${service.ctaHref}"]`)
                .first();
            await expect(panelCta).toBeVisible();
        }
    });

    test('service pages theme toggle switches to dark and persists', async ({
        page,
    }) => {
        for (const service of SERVICE_PAGES) {
            await page.setViewportSize({ width: 1280, height: 800 });
            await waitForStablePage(page, service.path);

            const darkBtn = page
                .locator('.theme-btn[data-theme-mode="dark"]')
                .first();
            await expect(darkBtn).toBeVisible();
            await darkBtn.click();

            await expect
                .poll(async () =>
                    page.evaluate(() => ({
                        mode: document.documentElement.getAttribute(
                            'data-theme-mode'
                        ),
                        theme: document.documentElement.getAttribute(
                            'data-theme'
                        ),
                        stored: localStorage.getItem('themeMode'),
                    }))
                )
                .toEqual({
                    mode: 'dark',
                    theme: 'dark',
                    stored: 'dark',
                });

            await page.reload();

            await expect
                .poll(async () =>
                    page.evaluate(() => ({
                        mode: document.documentElement.getAttribute(
                            'data-theme-mode'
                        ),
                        theme: document.documentElement.getAttribute(
                            'data-theme'
                        ),
                    }))
                )
                .toEqual({
                    mode: 'dark',
                    theme: 'dark',
                });
        }
    });

    test('mobile layout keeps quick-dock and service intent panel inside viewport', async ({
        page,
    }) => {
        for (const service of SERVICE_PAGES) {
            for (const viewport of MOBILE_VIEWPORTS) {
                await page.setViewportSize({
                    width: viewport.width,
                    height: viewport.height,
                });
                await waitForStablePage(page, service.path);

                const panel = page
                    .locator('[data-qa="service-intent-panel"]')
                    .first();
                await panel.scrollIntoViewIfNeeded();
                await page.waitForTimeout(100);
                await expectElementInsideViewport(
                    panel,
                    page,
                    `${service.name}:${viewport.label}:panel`
                );

                const quickDock = page.locator('.quick-dock').first();
                await expectElementInsideViewport(
                    quickDock,
                    page,
                    `${service.name}:${viewport.label}:quick-dock`
                );
            }
        }
    });

    test('service CTA advances toward citas section and quick-dock reserve action stays available on mobile', async ({
        page,
    }) => {
        for (const service of SERVICE_PAGES) {
            await page.setViewportSize({ width: 390, height: 844 });
            await waitForStablePage(page, service.path);

            const quickDockReserve = page
                .locator(
                    '.quick-dock a[href="#citas"], .quick-dock-item[href="#citas"]'
                )
                .first();
            await expect(quickDockReserve).toBeVisible();
            await expect(quickDockReserve).toHaveAttribute('href', '#citas');

            const reserveLink = page
                .locator('[data-qa="service-intent-panel"] a[href="#citas"]')
                .first();
            await expect(reserveLink).toBeVisible();
            const beforeTop = await page.evaluate(() => {
                const citas = document.getElementById('citas');
                return citas
                    ? Math.round(citas.getBoundingClientRect().top)
                    : null;
            });
            expect(beforeTop).not.toBeNull();

            await reserveLink.click({ force: true });

            const viewportHeight = await page.evaluate(
                () => window.innerHeight
            );
            const maxTop = Math.round(viewportHeight * 0.35);
            const meaningfulAdvanceTop = Math.max(
                maxTop,
                Math.round(beforeTop - Math.max(700, viewportHeight))
            );

            await expect
                .poll(
                    async () =>
                        page.evaluate(() => {
                            const citas = document.getElementById('citas');
                            return citas
                                ? Math.round(citas.getBoundingClientRect().top)
                                : null;
                        }),
                    { timeout: 4000 }
                )
                .toBeLessThanOrEqual(meaningfulAdvanceTop);

            const after = await page.evaluate(() => {
                const citas = document.getElementById('citas');
                if (!citas) return null;
                const rect = citas.getBoundingClientRect();
                return {
                    top: Math.round(rect.top),
                    bottom: Math.round(rect.bottom),
                    viewportHeight: window.innerHeight,
                };
            });
            expect(after).not.toBeNull();
            expect(after.top).toBeLessThan(beforeTop);

            await expect(quickDockReserve).toBeVisible();
        }
    });

    test('service booking CTAs preselect matching service even when citas is deferred', async ({
        page,
    }) => {
        for (const service of SERVICE_PAGES) {
            await page.setViewportSize({ width: 390, height: 844 });
            await waitForStablePage(page, service.path);

            const heroBookingCta = page
                .locator('[data-qa="service-hero-booking-cta"]')
                .first();
            await expect(heroBookingCta).toBeVisible();
            await heroBookingCta.click({ force: true });

            await expect
                .poll(
                    async () =>
                        page.evaluate(() => {
                            const select =
                                document.getElementById('serviceSelect');
                            return select ? select.value : null;
                        }),
                    { timeout: 12000 }
                )
                .toBe(service.bookingValue);

            await page.evaluate(() => {
                const select = document.getElementById('serviceSelect');
                if (!select) return;
                select.value = 'consulta';
                select.dispatchEvent(new Event('change', { bubbles: true }));
            });

            const quickDockBookingCta = page
                .locator('[data-qa="service-quickdock-booking-cta"]')
                .first();
            await expect(quickDockBookingCta).toBeVisible();
            await quickDockBookingCta.click({ force: true });

            await expect
                .poll(
                    async () =>
                        page.evaluate(() => {
                            const select =
                                document.getElementById('serviceSelect');
                            return select ? select.value : null;
                        }),
                    { timeout: 6000 }
                )
                .toBe(service.bookingValue);
        }
    });
});
