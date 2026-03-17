// @ts-check
const { test, expect } = require('@playwright/test');
const { gotoPublicRoute } = require('./helpers/public-v6');

test.describe('Public V6 case stories', () => {
    test('hydrates editorial case stories from runtime feed', async ({
        page,
    }) => {
        await page.route(
            /\/api\.php\?resource=public-case-media-file&name=/i,
            async (route) => {
                await route.fulfill({
                    status: 200,
                    contentType: 'image/svg+xml; charset=utf-8',
                    body: `<svg xmlns="http://www.w3.org/2000/svg" width="640" height="420"><rect width="640" height="420" fill="#efe8dc"/><text x="40" y="210" font-size="32" fill="#30445a">Case Story</text></svg>`,
                });
            }
        );
        await page.route(
            /\/api\.php\?resource=public-case-stories&locale=es/i,
            async (route) => {
                await route.fulfill({
                    status: 200,
                    contentType: 'application/json; charset=utf-8',
                    body: JSON.stringify({
                        ok: true,
                        data: {
                            locale: 'es',
                            items: [
                                {
                                    storyId: 'story_001',
                                    slug: 'caso-acne-editorial',
                                    title: 'Caso acne editorial',
                                    summary:
                                        'Seguimiento preparado desde el flujo clinico y aprobado por staff.',
                                    category: 'Acne controlado',
                                    tags: ['Acne', 'Seguimiento'],
                                    cover: {
                                        url: '/api.php?resource=public-case-media-file&name=story-cover.jpg',
                                        alt: 'Caso publicado desde media flow',
                                    },
                                    comparePairs: [
                                        {
                                            before: {
                                                url: '/api.php?resource=public-case-media-file&name=before.jpg',
                                                alt: 'Antes del tratamiento',
                                            },
                                            after: {
                                                url: '/api.php?resource=public-case-media-file&name=after.jpg',
                                                alt: 'Despues del tratamiento',
                                            },
                                        },
                                    ],
                                    disclaimer:
                                        'Contenido editorial con fines informativos.',
                                },
                            ],
                        },
                    }),
                });
            }
        );

        await gotoPublicRoute(page, '/es/');

        const section = page.locator('[data-v6-case-stories]').first();
        await expect
            .poll(async () =>
                section.getAttribute('data-v6-case-stories-ready')
            )
            .toBe('true');
        await expect(section).toBeVisible();
        await expect(section.locator('[data-v6-case-story]')).toHaveCount(1);
        await expect(section).toContainText('Caso acne editorial');
        await expect(
            section.locator('.v6-case-stories__compare img')
        ).toHaveCount(2);
    });

    test('keeps case stories hidden and trust signals visible when runtime feed is empty', async ({
        page,
    }) => {
        await page.route(
            /\/api\.php\?resource=public-case-stories&locale=en/i,
            async (route) => {
                await route.fulfill({
                    status: 200,
                    contentType: 'application/json; charset=utf-8',
                    body: JSON.stringify({
                        ok: true,
                        data: {
                            locale: 'en',
                            items: [],
                        },
                    }),
                });
            }
        );

        await gotoPublicRoute(page, '/en/');

        const section = page.locator('[data-v6-case-stories]').first();
        await expect
            .poll(async () =>
                section.getAttribute('data-v6-case-stories-ready')
            )
            .toBe('empty');
        await expect(section).toBeHidden();
        await expect(section.locator('[data-v6-case-story]')).toHaveCount(0);
        await expect(page.locator('[data-v6-trust-signals]')).toBeVisible();
        await expect(page.locator('[data-v6-trust-signals]')).toContainText(
            'Start with a clear conversation'
        );
    });
});
