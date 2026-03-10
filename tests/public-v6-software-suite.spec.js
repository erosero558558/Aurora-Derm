// @ts-check
const { test, expect } = require('@playwright/test');
const { findLocaleSwitch, gotoPublicRoute } = require('./helpers/public-v6');

async function expectNoPlaceholderLinks(page, scopeSelector) {
    const selectors = scopeSelector
        .split(',')
        .map((item) => item.trim())
        .filter(Boolean);

    const invalidHrefs = await page.evaluate((scopeSelectors) => {
        return scopeSelectors
            .flatMap((selector) =>
                Array.from(document.querySelectorAll(selector)).flatMap((scope) =>
                    Array.from(scope.querySelectorAll('a[href]')).map((node) => ({
                        href: node.getAttribute('href') || '',
                        text: (node.textContent || '').trim(),
                    }))
                )
            )
            .filter((item) => !item.href || item.href === '#');
    }, selectors);

    expect(invalidHrefs).toEqual([]);
}

test.describe('Public V6 software suite', () => {
    test('software landing renders full section rail without placeholder links', async ({
        page,
    }) => {
        await gotoPublicRoute(page, '/es/software/turnero-clinicas/');

        await expect(page.locator('[data-v6-page-head]').first()).toBeVisible();
        await expect(
            page.locator('[data-v6-suite-map="landing"] [data-v6-suite-map-link]')
        ).toHaveCount(4);
        await expect(
            page.locator('[data-v6-suite-map="landing"] [aria-current="page"]').first()
        ).toHaveAttribute('href', '/es/software/turnero-clinicas/');
        await expect(page.locator('.v6-suite-hero__board').first()).toBeVisible();
        await expect(
            page.locator('.v6-suite-hero .v6-suite-actions a')
        ).toHaveCount(4);
        await expect(
            page.locator('[data-v6-section-nav="software"] [data-v6-section-link]')
        ).toHaveCount(7);
        await expect(
            page.locator('.v6-suite-surface-grid .v6-suite-surface-card')
        ).toHaveCount(3);
        await expect(
            page.locator('.v6-suite-surface-grid .v6-suite-surface-card__stage')
        ).toHaveCount(3);
        await expect(page.locator('.v6-suite-faq__item')).toHaveCount(4);

        await expectNoPlaceholderLinks(
            page,
            '.v6-suite-hero, .v6-suite-rail, .v6-suite-section, .v6-suite-final'
        );
    });

    test('software surface renders mockup, rail, and CTA contracts', async ({
        page,
    }) => {
        await gotoPublicRoute(page, '/en/software/clinic-flow-suite/queue-status/');

        await expect(page.locator('[data-v6-page-head]').first()).toBeVisible();
        await expect(
            page.locator('[data-v6-suite-map="surface"] [data-v6-suite-map-link]')
        ).toHaveCount(4);
        await expect(
            page.locator('[data-v6-suite-map="surface"] [aria-current="page"]').first()
        ).toHaveAttribute('href', '/en/software/clinic-flow-suite/queue-status/');
        await expect(
            page.locator('[data-v6-section-nav="software-surface"] [data-v6-section-link]')
        ).toHaveCount(5);
        await expect(page.locator('.v6-suite-surface-hero .v6-suite-actions a')).toHaveCount(2);
        await expect(page.locator('.v6-suite-showcase__stage').first()).toBeVisible();
        await expect(page.locator('.v6-suite-showcase .v6-suite-mockup__row')).toHaveCount(3);
        await expect(page.locator('.v6-suite-list-grid .v6-suite-list-item')).toHaveCount(4);

        await expectNoPlaceholderLinks(
            page,
            '.v6-suite-surface-hero, .v6-suite-surface-shell, .v6-suite-final'
        );
    });

    test('software locale switch preserves the active surface', async ({ page }) => {
        await gotoPublicRoute(page, '/en/software/clinic-flow-suite/dashboard/');

        const localeSwitch = await findLocaleSwitch(page);
        await expect(localeSwitch).toHaveAttribute(
            'href',
            '/es/software/turnero-clinicas/dashboard/'
        );

        await localeSwitch.click();
        await expect(page).toHaveURL(/\/es\/software\/turnero-clinicas\/dashboard\/$/);
        await expect(page.locator('[data-v6-page-head]').first()).toBeVisible();
    });

    test('software landing page menu and rail stay in sync with section anchors', async ({
        page,
    }) => {
        await gotoPublicRoute(page, '/es/software/turnero-clinicas/');

        const menuButton = page.locator('[data-v6-page-menu]').first();
        const panel = page.locator('[data-v6-page-menu-panel]').first();
        const menuLinks = panel.locator('[data-v6-page-menu-link]');
        const railLink = page.locator('[data-v6-section-nav="software"] [href="#v6-suite-pricing"]').first();

        await menuButton.click();
        await expect(panel).toBeVisible();
        await expect(menuLinks).toHaveCount(7);

        await menuLinks.nth(4).click();
        await expect(page).toHaveURL(/#v6-suite-pricing$/);
        await expect(panel).toBeHidden();
        await expect(menuLinks.nth(4)).toHaveAttribute('aria-current', 'location');
        await expect(railLink).toHaveAttribute('aria-current', 'location');
    });

    test('software rails use sticky desktop geometry and collapse on mobile', async ({
        page,
    }) => {
        await page.setViewportSize({ width: 1440, height: 1200 });
        await gotoPublicRoute(page, '/en/software/clinic-flow-suite/');

        const landingDesktopStyles = await page.evaluate(() => {
            const landingRail = document.querySelector('[data-v6-suite-rail="landing"]');
            return {
                landingPosition: landingRail ? window.getComputedStyle(landingRail).position : '',
            };
        });

        expect(landingDesktopStyles.landingPosition).toBe('sticky');

        await gotoPublicRoute(page, '/en/software/clinic-flow-suite/dashboard/');

        const surfaceDesktopStyles = await page.evaluate(() => {
            const surfaceRail = document.querySelector('[data-v6-suite-rail="surface"]');
            const surfaceShell = document.querySelector('.v6-suite-surface-shell');
            return {
                surfacePosition: surfaceRail ? window.getComputedStyle(surfaceRail).position : '',
                surfaceColumns: surfaceShell
                    ? window.getComputedStyle(surfaceShell).gridTemplateColumns
                    : '',
            };
        });

        expect(surfaceDesktopStyles.surfacePosition).toBe('sticky');
        expect(surfaceDesktopStyles.surfaceColumns.trim().split(/\s+/).length).toBeGreaterThan(1);

        await page.setViewportSize({ width: 390, height: 844 });
        await gotoPublicRoute(page, '/en/software/clinic-flow-suite/');
        await expect(page.locator('[data-v6-page-head]').first()).toBeVisible();

        const landingMobileStyles = await page.evaluate(() => {
            const landingRail = document.querySelector('[data-v6-suite-rail="landing"]');
            return {
                landingPosition: landingRail ? window.getComputedStyle(landingRail).position : '',
            };
        });

        expect(landingMobileStyles.landingPosition).toBe('static');

        await gotoPublicRoute(page, '/en/software/clinic-flow-suite/dashboard/');

        const surfaceMobileStyles = await page.evaluate(() => {
            const surfaceRail = document.querySelector('[data-v6-suite-rail="surface"]');
            const surfaceShell = document.querySelector('.v6-suite-surface-shell');
            return {
                surfacePosition: surfaceRail ? window.getComputedStyle(surfaceRail).position : '',
                surfaceColumns: surfaceShell
                    ? window.getComputedStyle(surfaceShell).gridTemplateColumns
                    : '',
            };
        });

        expect(surfaceMobileStyles.surfacePosition).toBe('static');
        expect(surfaceMobileStyles.surfaceColumns.trim().split(/\s+/).length).toBe(1);
    });

    test('software header search indexes software routes on software pages', async ({
        page,
    }) => {
        await gotoPublicRoute(page, '/en/software/clinic-flow-suite/');

        const header = page.locator('[data-v6-header]').first();
        await expect
            .poll(async () => header.getAttribute('data-v6-search-ready'))
            .toBe('true');

        const openButton = header.locator('[data-v6-search-open]').first();
        const overlay = header.locator('[data-v6-search]').first();
        const input = overlay.locator('[data-v6-search-input]').first();

        await openButton.click();
        await expect(overlay).toBeVisible();
        await input.fill('dashboard');

        const result = overlay
            .locator('[data-v6-search-result] a[href="/en/software/clinic-flow-suite/dashboard/"]')
            .first();
        await expect(result).toBeVisible();
        await expect(result).toContainText(/dashboard/i);
    });

    test('software suite map navigates between sibling surfaces and updates active state', async ({
        page,
    }) => {
        await gotoPublicRoute(page, '/es/software/turnero-clinicas/demo/');

        const suiteMap = page.locator('[data-v6-suite-map="surface"]').first();
        const dashboardLink = suiteMap.locator(
            '[data-v6-suite-map-link][href="/es/software/turnero-clinicas/dashboard/"]'
        );

        await expect(
            suiteMap.locator('[data-v6-suite-map-link][aria-current="page"]').first()
        ).toHaveAttribute('href', '/es/software/turnero-clinicas/demo/');

        await dashboardLink.click();
        await expect(page).toHaveURL(/\/es\/software\/turnero-clinicas\/dashboard\/$/);
        await expect(
            suiteMap.locator('[data-v6-suite-map-link][aria-current="page"]').first()
        ).toHaveAttribute('href', '/es/software/turnero-clinicas/dashboard/');
    });
});
