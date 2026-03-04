// @ts-check
const { test, expect } = require('@playwright/test');
const { gotoPublicRoute } = require('./helpers/public-v3');

async function activeSlide(page) {
    return page.evaluate(() => {
        const slides = Array.from(
            document.querySelectorAll('[data-v6-hero] [data-v6-slide]')
        );
        return slides.findIndex((slide) =>
            slide.classList.contains('is-active')
        );
    });
}

async function activeIndicatorState(page) {
    return page.evaluate(() => {
        const active = document.querySelector('[data-v6-indicator].is-active');
        const fill = active
            ? active.querySelector('[data-v6-indicator-fill]')
            : null;
        const track = active
            ? active.querySelector('.v6-hero__indicator-track')
            : null;
        const fillStyle = fill ? getComputedStyle(fill) : null;
        return {
            hasActive: Boolean(active),
            progressing: Boolean(
                active && active.classList.contains('is-progressing')
            ),
            fillTransform: fillStyle ? fillStyle.transform : '',
            trackWidth: track
                ? Math.round(track.getBoundingClientRect().width)
                : 0,
        };
    });
}

test.describe('Public V6 hero stage', () => {
    test('renders three-panel stage with controls and indicators', async ({
        page,
    }) => {
        await gotoPublicRoute(page, '/es/');

        const hero = page.locator('[data-v6-hero]').first();
        await expect(hero).toBeVisible();
        await expect(hero.locator('[data-v6-slide]')).toHaveCount(5);
        await expect(hero.locator('[data-v6-indicator]')).toHaveCount(5);
        await expect(hero.locator('[data-v6-prev]')).toBeVisible();
        await expect(hero.locator('[data-v6-next]')).toBeVisible();
        await expect(hero.locator('[data-v6-toggle]')).toBeVisible();
    });

    test('next prev and pause update active state', async ({ page }) => {
        await gotoPublicRoute(page, '/en/');

        const hero = page.locator('[data-v6-hero]').first();
        const next = hero.locator('[data-v6-next]');
        const prev = hero.locator('[data-v6-prev]');
        const toggle = hero.locator('[data-v6-toggle]');

        const initial = await activeSlide(page);
        await next.click();
        await expect.poll(() => activeSlide(page)).toBe((initial + 1) % 5);

        await prev.click();
        await expect.poll(() => activeSlide(page)).toBe(initial);

        await toggle.click();
        await expect(hero).toHaveAttribute('data-v6-state', 'paused');

        const paused = await activeSlide(page);
        await page.waitForTimeout(7300);
        await expect.poll(() => activeSlide(page)).toBe(paused);

        await toggle.click();
        await expect(hero).toHaveAttribute('data-v6-state', 'playing');
    });

    test('active indicator uses timed progress and reacts to pause/resume', async ({
        page,
    }) => {
        await gotoPublicRoute(page, '/es/');

        const hero = page.locator('[data-v6-hero]').first();
        const toggle = hero.locator('[data-v6-toggle]');

        await expect
            .poll(() => activeIndicatorState(page))
            .toMatchObject({
                hasActive: true,
                progressing: true,
            });

        const playingBefore = await activeIndicatorState(page);
        expect(playingBefore.trackWidth).toBeGreaterThanOrEqual(50);
        await page.waitForTimeout(900);
        const playingAfter = await activeIndicatorState(page);
        expect(playingAfter.fillTransform).not.toBe(
            playingBefore.fillTransform
        );

        await toggle.click();
        await expect(hero).toHaveAttribute('data-v6-state', 'paused');
        await expect
            .poll(() => activeIndicatorState(page))
            .toMatchObject({
                hasActive: true,
                progressing: false,
            });
        const pausedBefore = await activeIndicatorState(page);
        await page.waitForTimeout(900);
        const pausedAfter = await activeIndicatorState(page);
        expect(pausedAfter.fillTransform).toBe(pausedBefore.fillTransform);

        await toggle.click();
        await expect(hero).toHaveAttribute('data-v6-state', 'playing');
        await expect
            .poll(() => activeIndicatorState(page))
            .toMatchObject({
                hasActive: true,
                progressing: true,
            });
        const resumedBefore = await activeIndicatorState(page);
        await page.waitForTimeout(900);
        const resumedAfter = await activeIndicatorState(page);
        expect(resumedAfter.fillTransform).not.toBe(
            resumedBefore.fillTransform
        );
    });
});
