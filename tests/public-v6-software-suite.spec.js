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
            page.locator('.v6-suite-hero .v6-suite-actions a')
        ).toHaveCount(4);
        await expect(
            page.locator('[data-v6-section-nav="software"] [data-v6-section-link]')
        ).toHaveCount(7);
        await expect(
            page.locator('.v6-suite-surface-grid .v6-suite-surface-card')
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
            page.locator('[data-v6-section-nav="software-surface"] [data-v6-section-link]')
        ).toHaveCount(5);
        await expect(page.locator('.v6-suite-surface-hero .v6-suite-actions a')).toHaveCount(2);
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
});
