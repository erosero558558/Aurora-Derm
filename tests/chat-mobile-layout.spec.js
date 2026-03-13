// @ts-check
const { test, expect } = require('@playwright/test');

const MOBILE_VIEWPORTS = [
    { width: 390, height: 844, label: '390x844' },
    { width: 412, height: 915, label: '412x915' },
];

const PUBLIC_HOME_PATH = '/en/';

async function bootstrapPublicHome(page, path = PUBLIC_HOME_PATH) {
    await page.addInitScript(() => {
        localStorage.setItem(
            'pa_cookie_consent_v1',
            JSON.stringify({
                status: 'rejected',
                at: new Date().toISOString(),
            })
        );
    });

    await page.goto(path);
    await expect(page.locator('[data-v6-header]')).toBeVisible();
    await expect(page.locator('#chatbotWidget')).toHaveCount(0);
}

async function openDrawer(page) {
    await bootstrapPublicHome(page);
    await page.locator('[data-v6-drawer-open]').click();

    const drawerPanel = page.locator('[data-v6-drawer-panel]');
    await expect(drawerPanel).toBeVisible();
    await expect(
        drawerPanel.locator('a[href*="wa.me/"]').first()
    ).toBeVisible();
    return drawerPanel;
}

async function openSearch(page) {
    await bootstrapPublicHome(page);

    const headerSearchButton = page.locator('[data-v6-search-open]');
    if (await headerSearchButton.isVisible()) {
        await headerSearchButton.click();
    } else {
        const drawerPanel = await openDrawer(page);
        await drawerPanel.locator('[data-v6-drawer-search-open]').click();
    }

    const searchRoot = page.locator('[data-v6-search]');
    const searchDialog = searchRoot.locator('.v6-search__dialog');
    await expect(searchRoot).toBeVisible();
    await expect(searchDialog).toBeVisible();
    await expect(searchDialog.locator('[data-v6-search-input]')).toBeVisible();
    return searchRoot;
}

async function expectElementFitsViewport(locator) {
    const metrics = await locator.evaluate((node) => {
        const rect = node.getBoundingClientRect();
        return {
            viewportWidth: window.innerWidth,
            viewportHeight: window.innerHeight,
            left: rect.left,
            right: rect.right,
            top: rect.top,
            bottom: rect.bottom,
            width: rect.width,
            height: rect.height,
        };
    });

    expect(metrics.left).toBeGreaterThanOrEqual(0);
    expect(metrics.right).toBeLessThanOrEqual(metrics.viewportWidth);
    expect(metrics.top).toBeGreaterThanOrEqual(0);
    expect(metrics.bottom).toBeLessThanOrEqual(metrics.viewportHeight);
    expect(metrics.width).toBeGreaterThan(220);
    expect(metrics.height).toBeGreaterThan(180);
}

async function expectNoHorizontalOverflow(page) {
    const metrics = await page.evaluate(() => ({
        viewportWidth: window.innerWidth,
        documentWidth: document.documentElement.scrollWidth,
        bodyWidth: document.body ? document.body.scrollWidth : 0,
    }));

    expect(metrics.documentWidth).toBeLessThanOrEqual(
        metrics.viewportWidth + 1
    );
    expect(metrics.bodyWidth).toBeLessThanOrEqual(metrics.viewportWidth + 1);
}

test.describe('Public V6 responsive shell layout', () => {
    test('drawer stays within viewport on narrow desktop window', async ({
        page,
    }) => {
        await page.setViewportSize({ width: 665, height: 1242 });
        const drawerPanel = await openDrawer(page);
        await expectElementFitsViewport(drawerPanel);
        await expectNoHorizontalOverflow(page);
    });

    test('search dialog stays within viewport on narrow desktop window', async ({
        page,
    }) => {
        await page.setViewportSize({ width: 665, height: 1242 });
        const searchRoot = await openSearch(page);
        await expectElementFitsViewport(searchRoot);
        await expectNoHorizontalOverflow(page);
    });

    for (const viewport of MOBILE_VIEWPORTS) {
        test(`drawer stays within viewport on mobile width ${viewport.label}`, async ({
            page,
        }) => {
            await page.setViewportSize({
                width: viewport.width,
                height: viewport.height,
            });
            const drawerPanel = await openDrawer(page);
            await expectElementFitsViewport(drawerPanel);
            await expectNoHorizontalOverflow(page);
        });

        test(`search dialog stays within viewport on mobile width ${viewport.label}`, async ({
            page,
        }) => {
            await page.setViewportSize({
                width: viewport.width,
                height: viewport.height,
            });
            const searchRoot = await openSearch(page);
            await expectElementFitsViewport(searchRoot);
            await expectNoHorizontalOverflow(page);
        });
    }
});
