const { test, expect } = require('@playwright/test');

test.describe('Deferred content fallback', () => {
    test('shows a recovery state instead of empty sections when deferred JSON fails', async ({
        page,
    }) => {
        await page.route('**/content/index.json**', (route) => route.abort());

        await page.goto('/', { waitUntil: 'domcontentloaded' });

        const servicios = page.locator('#servicios');
        await expect(servicios).toBeVisible();
        await expect(servicios).toContainText(
            /Arquitectura de atenci.n completa en dermatolog.a|Servicios/i
        );
        await expect(servicios).not.toContainText(/Cargando contenido/i);

        const serviciosTextLength = await servicios.evaluate(
            (node) => (node.textContent || '').trim().length
        );
        expect(serviciosTextLength).toBeGreaterThan(120);

        const linksInFallback = await servicios.locator('a').count();
        expect(linksInFallback).toBeGreaterThanOrEqual(8);
    });
});
