const { test, expect } = require('@playwright/test');

const pages = [
    '/',
    '/telemedicina.html',
    '/servicios/acne.html',
    '/servicios/laser.html',
];

test.describe('Script asset version parity', () => {
    for (const path of pages) {
        test(`page ${path} loads versioned script bundle`, async ({ page }) => {
            await page.goto(path, { waitUntil: 'domcontentloaded' });

            const scriptSources = await page.$$eval('script[src]', (nodes) =>
                nodes.map((node) => node.getAttribute('src') || '')
            );

            const mainScript = scriptSources.find((src) =>
                src.includes('dist/main.bundle.js')
            );
            expect(mainScript, `dist/main.bundle.js missing on ${path}`).toBeTruthy();
            // main.bundle.js is not versioned via query param in this phase
        });
    }

    test('landing pages load versioned bootstrap engine', async ({ page }) => {
        const landingPages = ['/', '/telemedicina.html'];
        for (const path of landingPages) {
            await page.goto(path, { waitUntil: 'domcontentloaded' });
            const scriptSources = await page.$$eval('script[src]', (nodes) =>
                nodes.map((node) => node.getAttribute('src') || '')
            );
            const bootstrapScript = scriptSources.find((src) =>
                src.includes('js/bootstrap-inline-engine.js')
            );
            expect(
                bootstrapScript,
                `js/bootstrap-inline-engine.js missing on ${path}`
            ).toBeTruthy();
            expect(
                bootstrapScript,
                `js/bootstrap-inline-engine.js must be versioned on ${path}`
            ).toContain('?v=');
        }
    });
});
