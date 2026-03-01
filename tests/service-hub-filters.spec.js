// @ts-check
const { test, expect } = require('@playwright/test');
const { gotoPublicRoute } = require('./helpers/public-v3');

test.describe('Service hub category state', () => {
    test('query category activates the matching family tab and section', async ({
        page,
    }) => {
        await gotoPublicRoute(page, '/es/servicios/?category=aesthetic');

        const activeTab = page.locator(
            '[data-family-tabs] [data-family-active="true"]'
        );
        const activeSection = page.locator(
            '[data-services-grid] [data-family-active="true"]'
        );
        await expect(activeTab).toHaveCount(1);
        await expect(activeTab).toHaveAttribute('data-family-tab', 'aesthetic');
        await expect(activeTab).toHaveAttribute('aria-current', 'page');
        await expect(activeSection).toHaveCount(1);
        await expect(activeSection).toHaveAttribute(
            'data-family-section',
            'aesthetic'
        );
    });

    test('family tabs still work as editorial anchors on english hub', async ({
        page,
    }) => {
        await gotoPublicRoute(page, '/en/services/');

        const pediatricTab = page.locator(
            '[data-family-tabs] [data-family-tab="children"]'
        );
        await pediatricTab.click();
        await expect(page).toHaveURL(/#family-children$/);
        await expect(page.locator('#family-children')).toBeVisible();
    });
});
