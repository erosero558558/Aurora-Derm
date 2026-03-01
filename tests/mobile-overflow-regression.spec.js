// @ts-check
const { test, expect } = require('@playwright/test');
const { gotoPublicRoute } = require('./helpers/public-v3');

const ROUTES = ['/es/', '/en/', '/es/servicios/', '/es/telemedicina/'];
const MOBILE_VIEWPORTS = [
    { width: 360, height: 800, label: '360x800' },
    { width: 390, height: 844, label: '390x844' },
    { width: 412, height: 915, label: '412x915' },
];

test.describe('Mobile overflow regressions V3', () => {
    test('key public routes stay inside the viewport on mobile', async ({
        page,
    }) => {
        for (const viewport of MOBILE_VIEWPORTS) {
            await page.setViewportSize(viewport);
            for (const route of ROUTES) {
                await gotoPublicRoute(page, route);
                const dimensions = await page.evaluate(() => ({
                    scrollWidth: document.documentElement.scrollWidth,
                    clientWidth: document.documentElement.clientWidth,
                }));
                expect(
                    dimensions.scrollWidth,
                    `horizontal overflow detected on ${route} (${viewport.label})`
                ).toBeLessThanOrEqual(dimensions.clientWidth + 1);
            }
        }
    });

    test('chat container stays visible on mobile when opened', async ({
        page,
    }) => {
        for (const viewport of MOBILE_VIEWPORTS) {
            await page.setViewportSize(viewport);
            await gotoPublicRoute(page, '/es/');

            const toggle = page.locator('.chatbot-toggle');
            await expect(toggle).toBeVisible();
            await toggle.click();

            const chatContainer = page.locator('#chatbotContainer');
            await expect(chatContainer).toBeVisible();

            const chatRect = await chatContainer.boundingBox();
            const currentViewport = page.viewportSize();
            expect(chatRect).not.toBeNull();
            expect(currentViewport).not.toBeNull();
            expect(chatRect.x).toBeGreaterThanOrEqual(-1);
            expect(chatRect.x + chatRect.width).toBeLessThanOrEqual(
                currentViewport.width + 1
            );
            expect(chatRect.y + chatRect.height).toBeLessThanOrEqual(
                currentViewport.height + 1
            );
        }
    });
});
