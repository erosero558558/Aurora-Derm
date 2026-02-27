// @ts-check
const { test, expect } = require('@playwright/test');

function normalizeText(value) {
    return String(value || '')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .replace(/\s+/g, ' ')
        .trim();
}

test.describe('Premium IA navigation', () => {
    test('desktop keeps business-first top navigation order and mega menu taxonomy', async ({
        page,
    }) => {
        await page.goto('/', { waitUntil: 'domcontentloaded' });

        const navLabels = await page
            .locator('.nav-links-premium > li > a')
            .allTextContents();
        const normalizedLabels = navLabels.map(normalizeText);
        const expectedOrder = [
            'servicios',
            'ninos',
            'telemedicina',
            'resultados',
            'equipo medico',
            'consultorio',
            'tarifas y pagos',
        ];

        expect(normalizedLabels.slice(0, expectedOrder.length)).toEqual(
            expectedOrder
        );

        const serviciosTrigger = page.locator('.nav-item--mega > a').first();
        await serviciosTrigger.hover();

        const megaMenu = page.locator('.nav-item--mega .mega-menu');
        await expect(megaMenu).toBeVisible();
        await expect(
            megaMenu.getByRole('heading', { name: /Dermatolog/i })
        ).toBeVisible();
        await expect(
            megaMenu.getByRole('heading', { name: /Est.*tica m.*dica/i })
        ).toBeVisible();
        await expect(
            megaMenu.getByRole('link', { name: /Botox/i })
        ).toBeVisible();
        await expect(
            megaMenu.getByRole('link', { name: /Bioestimuladores/i })
        ).toBeVisible();
        await expect(
            megaMenu.getByRole('link', { name: /C.ncer de piel/i })
        ).toBeVisible();
    });

    test('mobile menu keeps pediatric path and injectables visible in one panel flow', async ({
        page,
    }) => {
        await page.setViewportSize({ width: 390, height: 844 });
        await page.goto('/', { waitUntil: 'domcontentloaded' });
        await page.addStyleTag({
            content:
                '.quick-dock, #chatbotWidget, #cookieBanner { display: none !important; }',
        });

        const openMenuButton = page.locator('.nav-mobile-toggle');
        await expect(openMenuButton).toBeVisible();
        await openMenuButton.click();

        const mobileMenu = page.locator('#mobileMenu');
        await expect(mobileMenu).toBeVisible();

        await expect(
            mobileMenu.getByRole('link', { name: /Botox/i })
        ).toBeVisible();
        await expect(
            mobileMenu.getByRole('link', { name: /Bioestimuladores/i })
        ).toBeVisible();
        await expect(
            mobileMenu.locator('summary', { hasText: /Ni.nos|Niños/i })
        ).toHaveCount(1);
        await expect(
            mobileMenu.locator('a[href="/ninos/dermatologia-pediatrica"]')
        ).toHaveCount(1);
    });

    test('home no longer shows empty loading placeholders to users', async ({
        page,
    }) => {
        await page.goto('/', { waitUntil: 'domcontentloaded' });
        await expect(page.getByText('Cargando contenido...')).toHaveCount(0);
        await expect(
            page.getByText('Estamos preparando esta seccion para ti.')
        ).toHaveCount(0);
    });
});
