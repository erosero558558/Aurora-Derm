const { test, expect } = require('@playwright/test');

// Updated to match the optimized minified CSS file
const EXPECTED_DEFERRED_VERSION = 'ui-20260221-deferred18-fullcssfix1';
const DEFERRED_STYLESHEET_NAME = 'styles-deferred.css';

test('Homepage has correct deferred stylesheet version', async ({ page }) => {
    await page.goto('/');
    const link = page.locator('link[rel="preload"][as="style"][href*="styles-deferred.css"]');
    await expect(link).toHaveAttribute('href', new RegExp(EXPECTED_DEFERRED_VERSION));
});

test('Subpage (Telemedicina) has correct deferred stylesheet version', async ({ page }) => {
    await page.goto('/telemedicina.html');
    const link = page.locator('link[rel="preload"][as="style"][href*="styles-deferred.css"]');
    await expect(link).toHaveAttribute('href', new RegExp(EXPECTED_DEFERRED_VERSION));
});

test('Service page (Acne) has correct deferred stylesheet version', async ({ page }) => {
    await page.goto('/servicios/acne.html');
    // Note: In subpages, the href might be relative (../styles-deferred.css...),
    // but our regex check just looks for the version string presence.
    const link = page.locator('link[rel="preload"][as="style"][href*="styles-deferred.css"]');
    await expect(link).toHaveAttribute('href', new RegExp(EXPECTED_DEFERRED_VERSION));
});

test('Service page (Laser) has correct deferred stylesheet version', async ({ page }) => {
    await page.goto('/servicios/laser.html');
    const link = page.locator('link[rel="preload"][as="style"][href*="styles-deferred.css"]');
    await expect(link).toHaveAttribute('href', new RegExp(EXPECTED_DEFERRED_VERSION));
});
