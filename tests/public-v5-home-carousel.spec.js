// @ts-check
const { test, expect } = require('@playwright/test');
const { gotoPublicRoute } = require('./helpers/public-v3');

async function getActiveSlideIndex(page) {
    return page.evaluate(() => {
        const slides = Array.from(
            document.querySelectorAll(
                '[data-stage-carousel] [data-stage-slide]'
            )
        );
        return slides.findIndex((slide) =>
            slide.classList.contains('is-active')
        );
    });
}

test.describe('Public V5 home carousel', () => {
    test('renders 3 slides with rail and full controls in ES/EN', async ({
        page,
    }) => {
        for (const route of ['/es/', '/en/']) {
            await gotoPublicRoute(page, route);

            const stage = page.locator('[data-stage-carousel]').first();
            await expect(stage).toBeVisible();
            await expect(stage.locator('[data-stage-slide]')).toHaveCount(3);
            await expect(stage.locator('[data-stage-trigger]')).toHaveCount(3);
            await expect(stage.locator('[data-stage-prev]')).toBeVisible();
            await expect(stage.locator('[data-stage-next]')).toBeVisible();
            await expect(stage.locator('[data-stage-toggle]')).toBeVisible();
            await expect(stage).toHaveAttribute('data-stage-state', 'playing');
            await expect(
                stage.locator('.hero-stage__cta--secondary')
            ).toHaveCount(0);
            await expect(stage.locator('.sony-quiet-link')).toHaveCount(3);
        }
    });

    test('next/prev/pause-play controls update the active slide and autoplay state', async ({
        page,
    }) => {
        await gotoPublicRoute(page, '/es/');

        const stage = page.locator('[data-stage-carousel]').first();
        const prev = stage.locator('[data-stage-prev]');
        const next = stage.locator('[data-stage-next]');
        const toggle = stage.locator('[data-stage-toggle]');
        await expect(stage).toBeVisible();

        const initialIndex = await getActiveSlideIndex(page);
        expect(initialIndex).toBeGreaterThanOrEqual(0);

        await next.click();
        await expect
            .poll(async () => getActiveSlideIndex(page))
            .toBe((initialIndex + 1) % 3);

        await prev.click();
        await expect
            .poll(async () => getActiveSlideIndex(page))
            .toBe(initialIndex);

        await toggle.click();
        await expect(stage).toHaveAttribute('data-stage-state', 'paused');
        await expect(toggle).toHaveAttribute('aria-pressed', 'true');

        const pausedIndex = await getActiveSlideIndex(page);
        await page.waitForTimeout(7300);
        await expect
            .poll(async () => getActiveSlideIndex(page))
            .toBe(pausedIndex);

        await toggle.click();
        await expect(stage).toHaveAttribute('data-stage-state', 'playing');
        await expect(toggle).toHaveAttribute('aria-pressed', 'false');

        await page.waitForTimeout(7300);
        await expect
            .poll(async () => getActiveSlideIndex(page))
            .not.toBe(pausedIndex);
    });
});
