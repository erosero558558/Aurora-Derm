// @ts-check
const { test, expect } = require('@playwright/test');
const { skipIfPhpRuntimeMissing } = require('./helpers/php-backend');

async function expectSonyV3Runtime(
    page,
    expectedPathname = '/admin.html',
    expectedSearch = '',
    expectedVariant = 'legacy'
) {
    await expect(page.locator('html')).toHaveAttribute(
        'data-admin-ui',
        'sony_v3'
    );
    await expect(page.locator('html')).toHaveAttribute(
        'data-admin-ready',
        'true'
    );
    await expect(page.locator('body')).toHaveClass(/admin-v3-mode/);
    await expect(page.locator('[data-admin-frame="sony_v3"]')).toHaveCount(1);

    await expect
        .poll(() =>
            page.evaluate(() => ({
                pathname: window.location.pathname,
                search: window.location.search,
                staleVariant: localStorage.getItem('adminUiVariant'),
            }))
        )
        .toEqual({
            pathname: expectedPathname,
            search: expectedSearch,
            staleVariant: expectedVariant,
        });
}

test.describe('Admin UI runtime smoke', () => {
    test('siempre arranca en sony_v3 y deja compatibilidad legacy como ruido inerte', async ({
        page,
        request,
    }) => {
        await skipIfPhpRuntimeMissing(test, request);

        await page.addInitScript(() => {
            localStorage.setItem('adminUiVariant', 'legacy');
        });

        const legacyUrls = [
            '/admin.html',
            '/admin.html?admin_ui=legacy',
            '/admin.html?admin_ui=sony_v2',
            '/admin.html?admin_ui=sony_v3',
            '/admin.html?admin_ui=legacy&admin_ui_reset=1',
        ];

        for (const url of legacyUrls) {
            await page.goto(url);
            const expectedSearch = new URL(url, 'https://pielarmonia.test')
                .search;
            await expectSonyV3Runtime(page, '/admin.html', expectedSearch);
        }
    });

    test('mantiene CSP admin endurecida y sin estilos legacy en el shell', async ({
        page,
        request,
    }) => {
        await skipIfPhpRuntimeMissing(test, request);
        await page.goto('/admin.html');

        const cspMeta = page.locator(
            'meta[http-equiv="Content-Security-Policy"]'
        );
        await expect(cspMeta).toHaveCount(1);

        const cspContent = (await cspMeta.getAttribute('content')) || '';
        expect(cspContent).toContain("script-src 'self'");
        expect(cspContent).toContain("style-src 'self'");
        expect(cspContent).toContain("font-src 'self'");

        await expect(page.locator('#adminV3Styles')).toHaveCount(1);
        await expect(
            page.locator(
                '#adminLegacyBaseStyles, #adminLegacyMinStyles, #adminLegacyStyles, #adminV2Styles'
            )
        ).toHaveCount(0);
    });
});
