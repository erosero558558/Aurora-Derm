// @ts-check
const { test, expect } = require('@playwright/test');
const { gotoPublicRoute } = require('./helpers/public-v6');

async function readTurneroDemoState(page, stateId) {
    const raw = await page
        .locator(`[data-v6-turnero-demo-state="${stateId}"]`)
        .first()
        .textContent();
    return JSON.parse(String(raw || '{}'));
}

async function gotoSurface(page, route) {
    await page.goto(route, { waitUntil: 'domcontentloaded' });
    await page.waitForLoadState('load', { timeout: 20000 }).catch(() => null);
    await page.waitForTimeout(300);
}

test.describe('Turnero presentation cut', () => {
    test('landing puts product, pilot proof, and Aurora Derm in the first viewport', async ({
        page,
    }) => {
        await page.setViewportSize({ width: 1440, height: 1100 });
        await gotoPublicRoute(page, '/es/software/turnero-clinicas/');

        const hero = page.locator('.v6-suite-hero').first();
        const proofBand = page.locator('[data-v6-turnero-proof="landing"]').first();

        await expect(hero).toBeVisible();
        await expect(hero).toContainText('Aurora Derm');
        await expect(
            page.locator('[data-v6-turnero-proof-links="landing"] [data-v6-turnero-presentation-link]')
        ).toHaveCount(4);

        const geometry = await page.evaluate(() => {
            const proof = document.querySelector('[data-v6-turnero-proof="landing"]');
            return {
                viewportHeight: window.innerHeight,
                proofTop: proof ? proof.getBoundingClientRect().top : null,
            };
        });

        expect(geometry.proofTop).not.toBeNull();
        expect(Number(geometry.proofTop)).toBeLessThan(geometry.viewportHeight);
        await expect(proofBand).toContainText('Prueba operativa visible para la compra');
    });

    test('public presentation pages keep the fixed storyboard and canonical proof links', async ({
        page,
    }) => {
        await gotoPublicRoute(page, '/es/software/turnero-clinicas/');

        const laneLabels = await page
            .locator('[data-v6-suite-storyboard-lane]')
            .evaluateAll((nodes) =>
                nodes.map((node) =>
                    String(node.querySelector('p')?.textContent || '').trim()
                )
            );

        expect(laneLabels).toEqual(['Llegada', 'Recepcion', 'Sala', 'Gerencia']);

        const expectedProofHrefs = [
            '/admin.html#queue',
            '/kiosco-turnos.html',
            '/operador-turnos.html',
            '/sala-turnos.html',
        ].sort();

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

            const proofLinks = await page
                .locator('[data-v6-turnero-presentation-link]')
                .evaluateAll((nodes) =>
                    nodes
                        .map((node) => String(node.getAttribute('href') || '').trim())
                        .filter(Boolean)
                        .sort()
                );

            expect(proofLinks).toEqual(expectedProofHrefs);
            states.push(await readTurneroDemoState(page, route.stateId));
        }

        expect(states).toHaveLength(4);
        for (const state of states) {
            expect(state.version).toBe('turnero-demo-state-v1');
            expect(state.site.name).toBe('North pilot site');
            expect(state.queue.currentTicket).toBe('A-041');
            expect(state.queue.nextTicket).toBe('A-042');
            expect(state.queue.averageWaitMinutes).toBe(8);
            expect(state.queue.noShowRatePct).toBe(6.2);
            expect(state.queue.servedToday).toBe(124);
        }
    });

    test('queue pilot surfaces expose stage chrome and the next suggested step', async ({
        page,
    }) => {
        const surfaces = [
            {
                href: '/kiosco-turnos.html',
                surface: 'kiosk',
                label: 'Llegada',
                nextHref: '/admin.html#queue',
            },
            {
                href: '/admin.html',
                surface: 'admin',
                label: 'Recepcion',
                nextHref: '/sala-turnos.html',
            },
            {
                href: '/operador-turnos.html',
                surface: 'operator',
                label: 'Recepcion / consultorio',
                nextHref: '/sala-turnos.html',
            },
            {
                href: '/sala-turnos.html',
                surface: 'display',
                label: 'Sala',
                nextHref: '/es/software/turnero-clinicas/dashboard/',
            },
        ];

        for (const surface of surfaces) {
            await gotoSurface(page, surface.href);

            const chrome = page
                .locator(
                    `[data-turnero-stage-chrome][data-turnero-stage-surface="${surface.surface}"]`
                )
                .first();

            await expect(chrome).toBeVisible();
            await expect(chrome).toContainText('Aurora Derm');
            await expect(chrome.locator('[data-turnero-stage-label]')).toHaveText(
                surface.label
            );
            await expect(chrome.locator('[data-turnero-stage-entry]')).toHaveAttribute(
                'href',
                '/es/software/turnero-clinicas/'
            );
            await expect(chrome.locator('[data-turnero-stage-next]')).toHaveAttribute(
                'href',
                surface.nextHref
            );
        }
    });
});
