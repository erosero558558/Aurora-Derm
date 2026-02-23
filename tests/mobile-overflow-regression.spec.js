// @ts-check
const { test, expect } = require('@playwright/test');

const SECTION_IDS = [
    'inicio',
    'servicios',
    'tarifario',
    'telemedicina',
    'equipo',
    'galeria',
    'consultorio',
    'resenas',
    'citas',
];

async function collectOverflowForSection(page, sectionId) {
    return page.evaluate((id) => {
        const section = document.getElementById(id);
        if (!section) {
            return { missing: true, offenders: [] };
        }

        const viewportWidth = window.innerWidth;
        const candidates = [
            section,
            ...Array.from(section.querySelectorAll('*')),
        ];
        const offenders = [];

        for (const element of candidates) {
            const style = window.getComputedStyle(element);
            if (
                style.display === 'none' ||
                style.visibility === 'hidden' ||
                style.position === 'fixed' ||
                style.position === 'sticky'
            ) {
                continue;
            }

            const rect = element.getBoundingClientRect();
            if (rect.width <= 0 || rect.height <= 0) {
                continue;
            }

            const overflowsLeft = rect.left < -1;
            const overflowsRight = rect.right > viewportWidth + 1;
            if (!overflowsLeft && !overflowsRight) {
                continue;
            }

            offenders.push({
                tag: element.tagName.toLowerCase(),
                id: element.id || '',
                className: String(element.className || '').slice(0, 100),
                left: Math.round(rect.left),
                right: Math.round(rect.right),
                width: Math.round(rect.width),
            });

            if (offenders.length >= 15) {
                break;
            }
        }

        return {
            missing: false,
            sectionId: id,
            viewportWidth,
            offenders,
        };
    }, sectionId);
}

test.describe('Mobile overflow regressions', () => {
    test('critical sections stay inside viewport on mobile width', async ({
        page,
    }) => {
        await page.setViewportSize({ width: 360, height: 800 });
        await page.goto('/', { timeout: 45000, waitUntil: 'domcontentloaded' });
        // eslint-disable-next-line playwright/no-networkidle
        await page.waitForLoadState('networkidle', { timeout: 20000 }).catch(() => null);
        await page.waitForTimeout(1500);

        for (const sectionId of SECTION_IDS) {
            await page.evaluate((id) => {
                const section = document.getElementById(id);
                if (section) {
                    section.scrollIntoView({ block: 'start' });
                }
            }, sectionId);
            await page.waitForTimeout(80);

            const metrics = await collectOverflowForSection(page, sectionId);
            expect(metrics.missing).toBeFalsy();
            expect(
                metrics.offenders,
                `Overflow in section #${sectionId}`
            ).toEqual([]);
        }
    });

    test('chat container stays fully visible when opened on mobile', async ({
        page,
    }) => {
        await page.setViewportSize({ width: 360, height: 800 });
        await page.goto('/');
        await page.waitForTimeout(600);

        const toggle = page.locator('.chatbot-toggle');
        await expect(toggle).toBeVisible();
        await toggle.click();

        const chatContainer = page.locator('#chatbotContainer');
        await expect(chatContainer).toBeVisible();

        const chatRect = await chatContainer.boundingBox();
        expect(chatRect).not.toBeNull();

        const viewport = page.viewportSize();
        expect(viewport).not.toBeNull();

        expect(chatRect.x).toBeGreaterThanOrEqual(-1);
        expect(chatRect.x + chatRect.width).toBeLessThanOrEqual(
            viewport.width + 1
        );
        expect(chatRect.y + chatRect.height).toBeLessThanOrEqual(
            viewport.height + 1
        );
    });
});
