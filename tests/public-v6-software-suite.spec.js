// @ts-check
const { test, expect } = require('@playwright/test');
const { findLocaleSwitch, gotoPublicRoute } = require('./helpers/public-v6');

async function expectNoPlaceholderLinks(page, scopeSelector) {
    const selectors = scopeSelector
        .split(',')
        .map((item) => item.trim())
        .filter(Boolean);

    const invalidHrefs = await page.evaluate((scopeSelectors) => {
        return scopeSelectors
            .flatMap((selector) =>
                Array.from(document.querySelectorAll(selector)).flatMap((scope) =>
                    Array.from(scope.querySelectorAll('a[href]')).map((node) => ({
                        href: node.getAttribute('href') || '',
                        text: (node.textContent || '').trim(),
                    }))
                )
            )
            .filter((item) => !item.href || item.href === '#');
    }, selectors);

    expect(invalidHrefs).toEqual([]);
}

async function readTurneroDemoState(page, stateId) {
    const raw = await page
        .locator(`[data-v6-turnero-demo-state="${stateId}"]`)
        .first()
        .textContent();
    return JSON.parse(String(raw || '{}'));
}

test.describe('Public V6 software suite', () => {
    test('software landing renders full section rail without placeholder links', async ({
        page,
    }) => {
        await gotoPublicRoute(page, '/es/software/turnero-clinicas/');

        await expect(page.locator('[data-v6-page-head]').first()).toBeVisible();
        await expect(
            page.locator('[data-v6-suite-map="landing"] [data-v6-suite-map-link]')
        ).toHaveCount(4);
        await expect(
            page.locator('[data-v6-suite-map="landing"] [aria-current="page"]').first()
        ).toHaveAttribute('href', '/es/software/turnero-clinicas/');
        await expect(page.locator('.v6-suite-hero__board').first()).toBeVisible();
        await expect(
            page.locator('.v6-suite-hero .v6-suite-actions a')
        ).toHaveCount(4);
        await expect(
            page.locator('[data-v6-suite-focus="landing"] [data-v6-suite-focus-card]')
        ).toHaveCount(3);
        await expect(page.locator('[data-v6-suite-module-role="lead"]').first()).toBeVisible();
        await expect(
            page.locator('[data-v6-section-nav="software"] [data-v6-section-link]')
        ).toHaveCount(8);
        await expect(
            page.locator('.v6-suite-surface-grid .v6-suite-surface-card')
        ).toHaveCount(3);
        await expect(
            page.locator('.v6-suite-surface-grid .v6-suite-surface-card__stage')
        ).toHaveCount(3);
        await expect(
            page.locator('[data-v6-turnero-proof="landing"] [data-v6-turnero-proof-card]')
        ).toHaveCount(5);
        await expect(page.locator('[data-v6-suite-native-card]')).toHaveCount(3);
        await expect(
            page.locator(
                '[data-v6-suite-native-surface="operator"] a[href="/app-downloads/?surface=operator"]'
            )
        ).toBeVisible();
        await expect(page.locator('.v6-suite-faq__item')).toHaveCount(4);

        const landingSections = await page
            .locator('[data-v6-suite-landing-section]')
            .evaluateAll((nodes) =>
                nodes.map((node) => ({
                    key: node.getAttribute('data-v6-suite-landing-section') || '',
                    order:
                        node.getAttribute('data-v6-suite-landing-section-order') || '',
                }))
            );

        expect(landingSections).toEqual([
            { key: 'operations', order: '01' },
            { key: 'audiences', order: '02' },
            { key: 'surfaces', order: '03' },
            { key: 'native', order: '04' },
        ]);

        await expectNoPlaceholderLinks(
            page,
            '.v6-suite-hero, .v6-suite-rail, .v6-suite-section, .v6-suite-final'
        );
    });

    test('software surface renders mockup, rail, and CTA contracts', async ({
        page,
    }) => {
        await gotoPublicRoute(page, '/en/software/clinic-flow-suite/queue-status/');

        await expect(page.locator('[data-v6-page-head]').first()).toBeVisible();
        await expect(
            page.locator('[data-v6-suite-surface-page="status"]').first()
        ).toBeVisible();
        await expect(page.locator('[data-v6-suite-surface-scene]').first()).toBeVisible();
        await expect(
            page.locator('[data-v6-suite-map="surface"] [data-v6-suite-map-link]')
        ).toHaveCount(4);
        await expect(
            page.locator('[data-v6-suite-map="surface"] [aria-current="page"]').first()
        ).toHaveAttribute('href', '/en/software/clinic-flow-suite/queue-status/');
        await expect(
            page.locator('[data-v6-section-nav="software-surface"] [data-v6-section-link]')
        ).toHaveCount(5);
        await expect(page.locator('[data-v6-suite-surface-section]')).toHaveCount(5);
        await expect(page.locator('[data-v6-suite-surface-section-tag]')).toHaveCount(5);
        await expect(page.locator('.v6-suite-surface-hero .v6-suite-actions a')).toHaveCount(2);
        await expect(page.locator('.v6-suite-showcase__stage').first()).toBeVisible();
        await expect(page.locator('.v6-suite-showcase .v6-suite-mockup__row')).toHaveCount(3);
        await expect(page.locator('.v6-suite-list-grid .v6-suite-list-item')).toHaveCount(4);
        await expect(
            page.locator('[data-v6-turnero-proof="status"] [data-v6-turnero-proof-card]')
        ).toHaveCount(5);

        const surfaceSections = await page.locator('[data-v6-suite-surface-section]').evaluateAll((nodes) =>
            nodes.map((node) => ({
                key: node.getAttribute('data-v6-suite-surface-section') || '',
                order:
                    node.getAttribute('data-v6-suite-surface-section-order') || '',
            }))
        );

        expect(surfaceSections).toEqual([
            { key: 'showcase', order: '01' },
            { key: 'steps', order: '02' },
            { key: 'advantages', order: '03' },
            { key: 'connections', order: '04' },
            { key: 'final', order: '05' },
        ]);

        await expectNoPlaceholderLinks(
            page,
            '.v6-suite-surface-hero, .v6-suite-surface-shell, .v6-suite-final'
        );
    });

    test('software surfaces expose distinct visual tokens by stage', async ({
        page,
    }) => {
        const surfaces = [
            {
                pageKey: 'demo',
                href: '/en/software/clinic-flow-suite/demo/',
            },
            {
                pageKey: 'status',
                href: '/en/software/clinic-flow-suite/queue-status/',
            },
            {
                pageKey: 'dashboard',
                href: '/en/software/clinic-flow-suite/dashboard/',
            },
        ];

        const tokens = [];

        for (const surface of surfaces) {
            await gotoPublicRoute(page, surface.href);

            await expect(
                page.locator(
                    `[data-v6-suite-surface-page="${surface.pageKey}"]`
                ).first()
            ).toBeVisible();
            await expect(
                page.locator('[data-v6-suite-surface-flow-current]').first()
            ).toBeVisible();

            const token = await page.evaluate(() => {
                const surfacePage = document.querySelector(
                    '[data-v6-suite-surface-page]'
                );
                if (!surfacePage) {
                    return null;
                }

                const styles = getComputedStyle(surfacePage);
                return {
                    pageKey:
                        surfacePage.getAttribute('data-v6-suite-surface-page') ||
                        '',
                    accent: styles.getPropertyValue('--v6-surface-accent').trim(),
                    panelStrong: styles
                        .getPropertyValue('--v6-surface-panel-strong')
                        .trim(),
                };
            });

            expect(token).not.toBeNull();
            tokens.push(token);
        }

        expect(tokens.map((token) => token.pageKey)).toEqual([
            'demo',
            'status',
            'dashboard',
        ]);
        expect(new Set(tokens.map((token) => token.accent)).size).toBe(3);
        expect(new Set(tokens.map((token) => token.panelStrong)).size).toBe(3);
    });

    test('software locale switch preserves the active surface', async ({ page }) => {
        await gotoPublicRoute(page, '/en/software/clinic-flow-suite/dashboard/');

        const localeSwitch = await findLocaleSwitch(page);
        await expect(localeSwitch).toHaveAttribute(
            'href',
            '/es/software/turnero-clinicas/dashboard/'
        );

        await localeSwitch.click();
        await expect(page).toHaveURL(/\/es\/software\/turnero-clinicas\/dashboard\/$/);
        await expect(page.locator('[data-v6-page-head]').first()).toBeVisible();
    });

    test('software landing page menu and rail stay in sync with section anchors', async ({
        page,
    }) => {
        await gotoPublicRoute(page, '/es/software/turnero-clinicas/');

        const menuButton = page.locator('[data-v6-page-menu]').first();
        const panel = page.locator('[data-v6-page-menu-panel]').first();
        const menuLinks = panel.locator('[data-v6-page-menu-link]');
        const railLink = page.locator('[data-v6-section-nav="software"] [href="#v6-suite-pricing"]').first();

        await menuButton.click();
        await expect(panel).toBeVisible();
        await expect(menuLinks).toHaveCount(8);

        await menuLinks.nth(5).click();
        await expect(page).toHaveURL(/#v6-suite-pricing$/);
        await expect(panel).toBeHidden();
        await expect(menuLinks.nth(5)).toHaveAttribute('aria-current', 'location');
        await expect(railLink).toHaveAttribute('aria-current', 'location');
    });

    test('software rails use sticky desktop geometry and collapse on mobile', async ({
        page,
    }) => {
        await page.setViewportSize({ width: 1440, height: 1200 });
        await gotoPublicRoute(page, '/en/software/clinic-flow-suite/');

        const landingDesktopStyles = await page.evaluate(() => {
            const landingRail = document.querySelector('[data-v6-suite-rail="landing"]');
            return {
                landingPosition: landingRail ? window.getComputedStyle(landingRail).position : '',
            };
        });

        expect(landingDesktopStyles.landingPosition).toBe('sticky');

        await gotoPublicRoute(page, '/en/software/clinic-flow-suite/dashboard/');

        const surfaceDesktopStyles = await page.evaluate(() => {
            const surfaceRail = document.querySelector('[data-v6-suite-rail="surface"]');
            const surfaceShell = document.querySelector('.v6-suite-surface-shell');
            return {
                surfacePosition: surfaceRail ? window.getComputedStyle(surfaceRail).position : '',
                surfaceColumns: surfaceShell
                    ? window.getComputedStyle(surfaceShell).gridTemplateColumns
                    : '',
            };
        });

        expect(surfaceDesktopStyles.surfacePosition).toBe('sticky');
        expect(surfaceDesktopStyles.surfaceColumns.trim().split(/\s+/).length).toBeGreaterThan(1);

        await page.setViewportSize({ width: 390, height: 844 });
        await gotoPublicRoute(page, '/en/software/clinic-flow-suite/');
        await expect(page.locator('[data-v6-page-head]').first()).toBeVisible();

        const landingMobileStyles = await page.evaluate(() => {
            const landingRail = document.querySelector('[data-v6-suite-rail="landing"]');
            return {
                landingPosition: landingRail ? window.getComputedStyle(landingRail).position : '',
            };
        });

        expect(landingMobileStyles.landingPosition).toBe('static');

        await gotoPublicRoute(page, '/en/software/clinic-flow-suite/dashboard/');

        const surfaceMobileStyles = await page.evaluate(() => {
            const surfaceRail = document.querySelector('[data-v6-suite-rail="surface"]');
            const surfaceShell = document.querySelector('.v6-suite-surface-shell');
            return {
                surfacePosition: surfaceRail ? window.getComputedStyle(surfaceRail).position : '',
                surfaceColumns: surfaceShell
                    ? window.getComputedStyle(surfaceShell).gridTemplateColumns
                    : '',
            };
        });

        expect(surfaceMobileStyles.surfacePosition).toBe('static');
        expect(surfaceMobileStyles.surfaceColumns.trim().split(/\s+/)).toHaveLength(1);
    });

    test('software header search indexes software routes on software pages', async ({
        page,
    }) => {
        await gotoPublicRoute(page, '/en/software/clinic-flow-suite/');

        const header = page.locator('[data-v6-header]').first();
        await expect
            .poll(async () => header.getAttribute('data-v6-search-ready'))
            .toBe('true');

        const openButton = header.locator('[data-v6-search-open]').first();
        const overlay = header.locator('[data-v6-search]').first();
        const input = overlay.locator('[data-v6-search-input]').first();

        await openButton.click();
        await expect(overlay).toBeVisible();
        await input.fill('dashboard');

        const result = overlay
            .locator('[data-v6-search-result] a[href="/en/software/clinic-flow-suite/dashboard/"]')
            .first();
        await expect(result).toBeVisible();
        await expect(result).toContainText(/dashboard/i);
    });

    test('software shell stays exclusive and avoids clinical navigation bleed', async ({
        page,
    }) => {
        await gotoPublicRoute(page, '/es/software/turnero-clinicas/');

        const headerLinks = await page
            .locator('[data-v6-header] a[href]')
            .evaluateAll((nodes) =>
                nodes.map((node) => ({
                    href: node.getAttribute('href') || '',
                    text: (node.textContent || '').trim(),
                }))
            );
        const pageText = await page.locator('body').innerText();

        expect(
            headerLinks.some(
                (item) =>
                    item.href.includes('/es/servicios/') ||
                    item.href.includes('/es/telemedicina/')
            )
        ).toBeFalsy();
        expect(pageText).not.toContain('Dermatologia clara');
        expect(pageText).not.toContain('Telemedicina');
        await expect(page.locator('[data-v6-header] [data-v6-mega-trigger]')).toHaveCount(0);
    });

    test('landing and software surfaces share the same canonical turnero demo state', async ({
        page,
    }) => {
        const routes = [
            {
                href: '/es/software/turnero-clinicas/',
                stateId: 'landing',
            },
            {
                href: '/es/software/turnero-clinicas/demo/',
                stateId: 'demo',
            },
            {
                href: '/es/software/turnero-clinicas/estado-turno/',
                stateId: 'status',
            },
            {
                href: '/es/software/turnero-clinicas/dashboard/',
                stateId: 'dashboard',
            },
        ];

        const states = [];

        for (const route of routes) {
            await gotoPublicRoute(page, route.href);
            states.push(await readTurneroDemoState(page, route.stateId));
        }

        expect(states).toHaveLength(4);
        for (const state of states) {
            expect(state.version).toBe('turnero-demo-state-v1');
            expect(state.queue.currentTicket).toBe('A-041');
            expect(state.queue.nextTicket).toBe('A-042');
            expect(state.queue.averageWaitMinutes).toBe(8);
            expect(state.queue.noShowRatePct).toBe(6.2);
            expect(state.queue.servedToday).toBe(124);
        }
    });

    test('software suite map navigates between sibling surfaces and updates active state', async ({
        page,
    }) => {
        await gotoPublicRoute(page, '/es/software/turnero-clinicas/demo/');

        const suiteMap = page.locator('[data-v6-suite-map="surface"]').first();
        const dashboardLink = suiteMap.locator(
            '[data-v6-suite-map-link][href="/es/software/turnero-clinicas/dashboard/"]'
        );

        await expect(
            suiteMap.locator('[data-v6-suite-map-link][aria-current="page"]').first()
        ).toHaveAttribute('href', '/es/software/turnero-clinicas/demo/');

        await dashboardLink.click();
        await expect(page).toHaveURL(/\/es\/software\/turnero-clinicas\/dashboard\/$/);
        await expect(
            suiteMap.locator('[data-v6-suite-map-link][aria-current="page"]').first()
        ).toHaveAttribute('href', '/es/software/turnero-clinicas/dashboard/');
    });
});
