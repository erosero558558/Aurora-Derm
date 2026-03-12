// @ts-check
const { test, expect } = require('@playwright/test');
const {
    gotoPublicRoute,
    waitForHomeV6Runtime,
    waitForShellV6Runtime,
} = require('./helpers/public-v6');

test.describe('Public V6 header and mega menu', () => {
    test('desktop header mounts sony-like hierarchy and mega panel', async ({
        page,
    }) => {
        await gotoPublicRoute(page, '/es/');

        const header = page.locator('[data-v6-header]').first();
        await expect(header).toBeVisible();
        await expect(
            header.locator('.v6-header__nav .v6-header__link')
        ).toHaveCount(7);

        const trigger = header.locator('[data-v6-mega-trigger]').first();
        const mega = header.locator('[data-v6-mega]').first();
        const backdrop = header.locator('[data-v6-mega-backdrop]').first();
        const tabs = mega.locator('[data-v6-mega-tab]');
        const sections = mega.locator('[data-v6-mega-section]');
        const focusables = mega.locator('[data-v6-mega-focusable]');

        await expect(mega).toBeHidden();
        await expect(backdrop).toBeHidden();
        await trigger.click();
        await expect(mega).toBeVisible();
        await expect(backdrop).toBeVisible();
        await expect(backdrop).toHaveClass(/is-visible/);
        await expect(tabs).toHaveCount(3);
        await expect(sections).toHaveCount(3);
        await expect(header).toHaveClass(/is-mega-open/);
        const megaCols = await mega
            .locator('[data-v6-mega-layout]')
            .evaluate(
                (node) => window.getComputedStyle(node).gridTemplateColumns
            );
        expect(
            String(megaCols).trim().split(/\s+/).filter(Boolean)
        ).toHaveLength(2);
        await expect.poll(() => focusables.count()).toBeGreaterThan(20);

        await expect(tabs.nth(0)).toHaveAttribute('aria-selected', 'true');
        await tabs.nth(1).hover();
        await expect(tabs.nth(1)).toHaveAttribute('aria-selected', 'true');
        const activeDetail = mega
            .locator('[data-v6-mega-detail]:not([hidden])')
            .first();
        await expect(activeDetail).toHaveAttribute(
            'data-v6-column-id',
            'procedures'
        );

        await trigger.press('ArrowDown');
        await expect(tabs.nth(0)).toBeFocused();
        await page.keyboard.press('ArrowDown');
        await expect(tabs.nth(1)).toBeFocused();

        await page.keyboard.press('Escape');
        await expect(mega).toBeHidden();
        await expect(backdrop).toBeHidden();
        await expect(header).not.toHaveClass(/is-mega-open/);

        await trigger.click();
        await expect(mega).toBeVisible();
        const outsidePoint = await page.evaluate(() => {
            const panel = document.querySelector('[data-v6-mega]');
            if (!panel) {
                return { x: 8, y: 120 };
            }
            const rect = panel.getBoundingClientRect();
            const x = Math.min(window.innerWidth - 8, rect.right + 12);
            const y = Math.min(
                window.innerHeight - 8,
                Math.max(rect.top + 20, 120)
            );
            return { x, y };
        });
        await page.mouse.click(outsidePoint.x, outsidePoint.y);
        await expect(mega).toBeHidden();
        await expect(backdrop).toBeHidden();
    });

    test('desktop search opens, filters routes, and closes with Escape', async ({
        page,
    }) => {
        await gotoPublicRoute(page, '/es/');
        await waitForHomeV6Runtime(page);

        const header = page.locator('[data-v6-header]').first();
        const openButton = header.locator('[data-v6-search-open]').first();
        const overlay = header.locator('[data-v6-search]').first();
        const input = overlay.locator('[data-v6-search-input]').first();

        await openButton.click();
        await expect(overlay).toBeVisible();
        await expect(input).toBeFocused();
        await expect
            .poll(() => page.evaluate(() => document.body.style.overflow))
            .toBe('hidden');

        await input.fill('telemedicina');
        const result = overlay
            .locator('[data-v6-search-result] a[href="/es/telemedicina/"]')
            .first();
        await expect(result).toBeVisible();
        await expect(result).toContainText('Telemedicina');

        await page.keyboard.press('Escape');
        await expect(overlay).toBeHidden();
        await expect(openButton).toHaveAttribute('aria-expanded', 'false');
    });

    test('mobile drawer opens and closes with scroll lock', async ({
        page,
    }) => {
        await page.setViewportSize({ width: 390, height: 844 });
        await gotoPublicRoute(page, '/es/');
        await waitForHomeV6Runtime(page);

        const header = page.locator('[data-v6-header]').first();
        const openButton = header.locator('[data-v6-drawer-open]').first();
        const drawer = header.locator('[data-v6-drawer]').first();

        await openButton.click();
        await expect(drawer).toBeVisible();
        await expect(openButton).toHaveAttribute('aria-expanded', 'true');
        await expect
            .poll(() => page.evaluate(() => document.body.style.overflow))
            .toBe('hidden');
        await expect(
            drawer.locator('[data-v6-drawer-group-toggle]')
        ).toHaveCount(3);
        await expect(drawer.locator('.v6-drawer__intro')).toBeVisible();

        const toggles = drawer.locator('[data-v6-drawer-group-toggle]');
        await toggles.nth(1).click();
        await expect(toggles.nth(1)).toHaveAttribute('aria-expanded', 'true');
        await expect(toggles.nth(0)).toHaveAttribute('aria-expanded', 'false');
        await expect(drawer.locator('#v6-drawer-group-2')).toBeVisible();

        await drawer.locator('.v6-drawer__panel header button').first().click();
        await expect(drawer).toBeHidden();
        await expect(openButton).toHaveAttribute('aria-expanded', 'false');
    });

    test('mobile drawer exposes active context and hands off to shared search', async ({
        page,
    }) => {
        await page.setViewportSize({ width: 390, height: 844 });
        await gotoPublicRoute(page, '/es/telemedicina/');
        await waitForShellV6Runtime(page);

        const header = page.locator('[data-v6-header]').first();
        const openButton = header.locator('[data-v6-drawer-open]').first();
        const drawer = header.locator('[data-v6-drawer]').first();
        const searchOverlay = header.locator('[data-v6-search]').first();

        await openButton.click();
        await expect(drawer).toBeVisible();
        await expect(
            drawer.locator('.v6-drawer__primary-link.is-active').first()
        ).toContainText('Telemedicina');
        const expandedGroup = drawer
            .locator('[data-v6-drawer-group-toggle][aria-expanded="true"]')
            .first();
        await expect(expandedGroup).toBeVisible();
        await expect(expandedGroup).toHaveAttribute('data-v6-target', /.+/);
        const expandedPanelId = await expandedGroup.evaluate(
            (node) => node.dataset.v6Target ?? ''
        );
        expect(expandedPanelId).toBeTruthy();
        await expect(
            drawer.locator(`#${expandedPanelId} .v6-drawer__context`)
        ).toHaveCount(1);

        await drawer.locator('[data-v6-drawer-search-open]').click();
        await expect(drawer).toBeHidden();
        await expect(searchOverlay).toBeVisible();
    });
});
