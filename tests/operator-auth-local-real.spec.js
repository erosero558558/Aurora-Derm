// @ts-check
const { test, expect } = require('@playwright/test');

function isEnabled(value) {
    return ['1', 'true', 'yes', 'on'].includes(
        String(value || '')
            .trim()
            .toLowerCase()
    );
}

test.describe('OpenClaw local real smoke', () => {
    test.skip(
        !isEnabled(process.env.TEST_REAL_OPERATOR_AUTH),
        'requires live backend + operator auth helper + OpenClaw OAuth session'
    );

    test('admin autentica con helper real y operador reutiliza la misma sesion', async ({
        page,
        context,
    }) => {
        await page.goto('/admin.html');

        await expect(page.locator('html')).toHaveAttribute(
            'data-admin-ready',
            'true'
        );
        await expect(page.locator('#loginForm')).toBeVisible();
        await expect(page.locator('#openclawLoginStage')).toBeVisible();
        await expect(page.locator('#legacyLoginStage')).toHaveClass(
            /is-hidden/
        );

        const popupPromise = page.waitForEvent('popup');
        await page.locator('#loginBtn').click();
        const popup = await popupPromise;

        await popup.waitForLoadState('domcontentloaded');
        await expect(popup.locator('body')).toContainText(
            /Autenticacion enviada|No se pudo completar el login/
        );

        await expect(page.locator('#adminDashboard')).toBeVisible({
            timeout: 20000,
        });
        await expect(page.locator('#adminSessionState')).toHaveText(
            /Sesion activa/,
            { timeout: 20000 }
        );
        await expect(page.locator('#adminSessionMeta')).toContainText(
            'OpenClaw / ChatGPT',
            { timeout: 20000 }
        );

        const operatorPage = await context.newPage();
        await operatorPage.goto(
            '/operador-turnos.html?station=c2&lock=1&one_tap=1'
        );

        await expect(operatorPage.locator('#operatorApp')).toBeVisible({
            timeout: 20000,
        });
        await expect(operatorPage.locator('#operatorLoginView')).toHaveClass(
            /is-hidden/
        );
        await expect(operatorPage.locator('#operatorLogoutBtn')).toBeVisible();

        await operatorPage.locator('#operatorLogoutBtn').click();

        await expect(operatorPage.locator('#operatorLoginView')).toBeVisible({
            timeout: 20000,
        });
        await page.reload();
        await expect(page.locator('#loginForm')).toBeVisible({
            timeout: 20000,
        });
        await expect(page.locator('#openclawLoginStage')).toBeVisible({
            timeout: 20000,
        });
        await expect(page.locator('#adminDashboard')).toHaveClass(/is-hidden/);
        await expect(page.locator('#adminSessionState')).toHaveText(
            /No autenticada/,
            { timeout: 20000 }
        );
    });
});
