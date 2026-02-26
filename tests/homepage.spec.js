// @ts-check
const { test, expect } = require('@playwright/test');

test.describe('Homepage', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto('/');
    });

    test('carga correctamente con título', async ({ page }) => {
        await expect(page).toHaveTitle(/Piel en Armonía/);
    });

    test('muestra la sección hero', async ({ page }) => {
        const hero = page.locator('.hero, #hero, [class*="hero"]').first();
        await expect(hero).toBeVisible();
    });

    test('muestra la sección de servicios', async ({ page }) => {
        const servicios = page
            .locator('#servicios, #services, [id*="servicio"]')
            .first();
        await expect(servicios).toBeVisible();
    });

    test('muestra el formulario de citas', async ({ page }) => {
        const form = page.locator('#appointmentForm');
        await expect(form).toBeVisible();
    });

    test('renderiza reseñas en la sección pública', async ({ page }) => {
        const reviewsSection = page
            .locator('#resenas, #reviews, .reviews-section')
            .first();
        await expect(reviewsSection).toBeVisible();
        await reviewsSection.scrollIntoViewIfNeeded();
        await page.waitForTimeout(1800);
        await expect(
            page.locator('.reviews-grid .review-card').first()
        ).toBeVisible();
    });

    test('navegación principal funciona', async ({ page }) => {
        const nav = page.locator('nav, .nav, .navbar').first();
        await expect(nav).toBeVisible();
    });

    test('selector de idioma existe en el DOM', async ({ page }) => {
        const langBtn = page.locator(
            '[onclick*="changeLanguage"], [data-lang="en"], .lang-btn, .language-selector button'
        );
        expect(await langBtn.count()).toBeGreaterThanOrEqual(1);
    });

    test('sistema de temas existe en el DOM', async ({ page }) => {
        const themeBtn = page.locator(
            '[data-theme-mode], .theme-btn, .theme-toggle'
        );
        expect(await themeBtn.count()).toBeGreaterThanOrEqual(1);
        const hasValidThemeState = await page.evaluate(() => {
            const root = document.documentElement;
            const dataTheme = root.getAttribute('data-theme');
            if (dataTheme && /^(light|dark)$/.test(dataTheme)) {
                return true;
            }
            return !!document.querySelector(
                '[data-theme-mode].active, .theme-btn.active, .theme-toggle .active'
            );
        });
        expect(hasValidThemeState).toBeTruthy();
    });

    test('sistema de temas cambia a oscuro y persiste tras recarga', async ({
        page,
    }) => {
        const darkBtn = page
            .locator('.theme-btn[data-theme-mode="dark"]')
            .first();
        const lightBtn = page
            .locator('.theme-btn[data-theme-mode="light"]')
            .first();

        await expect(darkBtn).toBeVisible();
        await darkBtn.click();

        await expect
            .poll(async () => {
                return page.evaluate(() => ({
                    mode: document.documentElement.getAttribute(
                        'data-theme-mode'
                    ),
                    theme: document.documentElement.getAttribute('data-theme'),
                    stored: localStorage.getItem('themeMode'),
                }));
            })
            .toEqual({
                mode: 'dark',
                theme: 'dark',
                stored: 'dark',
            });

        await page.reload();

        await expect
            .poll(async () => {
                return page.evaluate(() => ({
                    mode: document.documentElement.getAttribute(
                        'data-theme-mode'
                    ),
                    theme: document.documentElement.getAttribute('data-theme'),
                }));
            })
            .toEqual({
                mode: 'dark',
                theme: 'dark',
            });

        if (await lightBtn.isVisible()) {
            await lightBtn.click();
            await expect
                .poll(async () =>
                    page.evaluate(() =>
                        document.documentElement.getAttribute('data-theme')
                    )
                )
                .toBe('light');
        }
    });

    test('footer visible con enlaces legales', async ({ page }) => {
        const footer = page.locator('footer').first();
        await expect(footer).toBeVisible();
        const links = footer.locator(
            'a[href*="terminos"], a[href*="privacidad"]'
        );
        expect(await links.count()).toBeGreaterThanOrEqual(1);
    });
});
