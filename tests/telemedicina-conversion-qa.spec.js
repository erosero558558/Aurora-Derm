// @ts-check
const { test, expect } = require('@playwright/test');

async function prepareStablePublicState(page) {
    await page.addInitScript(() => {
        try {
            localStorage.setItem(
                'pa_cookie_consent_v1',
                JSON.stringify({
                    status: 'accepted',
                    at: '2026-01-01T00:00:00.000Z',
                })
            );
        } catch (_error) {
            // no-op
        }
    });
}

async function stabilizeDynamicUi(page) {
    await page.evaluate(() => {
        [
            '#cookieBanner',
            '#chatbotWidget',
            '#chatbotContainer',
            '.chatbot-toggle',
            '.quick-dock',
        ].forEach((selector) => {
            document.querySelectorAll(selector).forEach((node) => {
                if (node instanceof HTMLElement) {
                    node.style.display = 'none';
                }
            });
        });
    });
}

async function gotoTelemedicina(page) {
    await prepareStablePublicState(page);
    await page.goto('/telemedicina.html', { waitUntil: 'domcontentloaded' });
    await page.waitForLoadState('load').catch(() => null);
    await page.waitForTimeout(900);
    await stabilizeDynamicUi(page);
    await page.locator('#telemedicina').scrollIntoViewIfNeeded();
}

async function collectSectionOverflow(page, sectionSelector) {
    return page.evaluate((selector) => {
        const section = document.querySelector(selector);
        if (!(section instanceof HTMLElement)) {
            return { missing: true, offenders: [] };
        }

        const viewportWidth = window.innerWidth;
        const offenders = [];
        const candidates = [
            section,
            ...Array.from(section.querySelectorAll('*')),
        ];
        for (const element of candidates) {
            if (!(element instanceof HTMLElement)) continue;
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
            if (rect.width <= 0 || rect.height <= 0) continue;
            if (rect.left >= -1 && rect.right <= viewportWidth + 1) continue;
            offenders.push({
                tag: element.tagName.toLowerCase(),
                id: element.id || '',
                className: String(element.className || '').slice(0, 120),
                left: Math.round(rect.left),
                right: Math.round(rect.right),
                width: Math.round(rect.width),
            });
            if (offenders.length >= 12) break;
        }

        return { missing: false, viewportWidth, offenders };
    }, sectionSelector);
}

test.describe('Telemedicina conversion QA', () => {
    test('desktop mantiene jerarquia de conversion y CTAs accionables', async ({
        page,
    }) => {
        await page.setViewportSize({ width: 1280, height: 900 });
        await gotoTelemedicina(page);

        const teleSection = page.locator('#telemedicina');
        const conversionGrid = teleSection.locator(
            '.telemedicine-conversion-grid'
        );
        const decisionPanel = teleSection.locator('.tele-decision-panel');
        const optionsGrid = teleSection.locator('.telemedicine-options');
        const ctaRow = teleSection.locator('.tele-cta-row');

        await expect(teleSection).toBeVisible();
        await expect(conversionGrid).toBeVisible();
        await expect(teleSection.locator('.tele-quick-card')).toHaveCount(3);
        await expect(decisionPanel).toContainText(
            /(Consulta online|Online consultation)/i
        );
        await expect(decisionPanel.locator('.tele-prep-steps li')).toHaveCount(
            3
        );
        await expect(ctaRow.locator('a.btn')).toHaveCount(2);
        await expect(ctaRow.locator('a[href="#citas"]')).toBeVisible();
        await expect(
            ctaRow.locator('a.tele-cta-whatsapp[href*="wa.me/593982453672"]')
        ).toBeVisible();

        const conversionColumns = await conversionGrid.evaluate(
            (el) => getComputedStyle(el).gridTemplateColumns
        );
        expect(
            conversionColumns.trim().split(/\s+/).filter(Boolean).length
        ).toBeGreaterThan(1);

        const panelBox = await decisionPanel.boundingBox();
        const optionsBox = await optionsGrid.boundingBox();
        expect(panelBox).not.toBeNull();
        expect(optionsBox).not.toBeNull();
        expect(panelBox.y).toBeLessThan(optionsBox.y);
    });

    test('mobile mantiene bloque de conversion sin overflow y CTAs en una columna', async ({
        page,
    }) => {
        await page.setViewportSize({ width: 390, height: 844 });
        await gotoTelemedicina(page);

        const teleSection = page.locator('#telemedicina');
        const conversionGrid = teleSection.locator(
            '.telemedicine-conversion-grid'
        );
        const ctaRow = teleSection.locator('.tele-cta-row');
        const ctaButtons = ctaRow.locator('a.btn');

        const conversionColumns = await conversionGrid.evaluate(
            (el) => getComputedStyle(el).gridTemplateColumns
        );
        expect(
            conversionColumns.trim().split(/\s+/).filter(Boolean).length
        ).toBe(1);

        const ctaDisplay = await ctaRow.evaluate(
            (el) => getComputedStyle(el).display
        );
        const ctaColumns = await ctaRow.evaluate(
            (el) => getComputedStyle(el).gridTemplateColumns
        );
        expect(ctaDisplay).toBe('grid');
        expect(ctaColumns.trim().split(/\s+/).filter(Boolean).length).toBe(1);

        await expect(ctaButtons).toHaveCount(2);
        const [firstBtn, secondBtn] = await Promise.all([
            ctaButtons.nth(0).boundingBox(),
            ctaButtons.nth(1).boundingBox(),
        ]);
        expect(firstBtn).not.toBeNull();
        expect(secondBtn).not.toBeNull();
        expect(Math.abs(firstBtn.width - secondBtn.width)).toBeLessThanOrEqual(
            2
        );

        const overflowMetrics = await collectSectionOverflow(
            page,
            '#telemedicina'
        );
        expect(overflowMetrics.missing).toBeFalsy();
        expect(
            overflowMetrics.offenders,
            `Overflow en #telemedicina (${JSON.stringify(overflowMetrics.offenders)})`
        ).toEqual([]);
    });
});
