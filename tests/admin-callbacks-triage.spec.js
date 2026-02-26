// @ts-check
const { test, expect } = require('@playwright/test');

test.use({
    serviceWorkers: 'block',
    viewport: { width: 1280, height: 920 },
});

function jsonResponse(route, payload, status = 200) {
    return route.fulfill({
        status,
        contentType: 'application/json; charset=utf-8',
        body: JSON.stringify(payload),
    });
}

function buildCallbacksPayload() {
    const now = new Date();
    const todayIso = new Date(
        now.getFullYear(),
        now.getMonth(),
        now.getDate(),
        10,
        30
    ).toISOString();
    const tomorrowIso = new Date(
        now.getFullYear(),
        now.getMonth(),
        now.getDate() + 1,
        14,
        45
    ).toISOString();
    const yesterdayIso = new Date(
        now.getFullYear(),
        now.getMonth(),
        now.getDate() - 1,
        9,
        15
    ).toISOString();

    return [
        {
            id: 201,
            telefono: '+593 98 111 2222',
            preferencia: 'ahora',
            fecha: todayIso,
            status: 'pending',
        },
        {
            id: 202,
            telefono: '+593 97 333 4444',
            preferencia: '30min',
            fecha: tomorrowIso,
            status: 'pending',
        },
        {
            id: 203,
            telefono: '+593 96 555 6666',
            preferencia: '1hora',
            fecha: todayIso,
            status: 'contactado',
        },
        {
            id: 204,
            telefono: '+593 95 777 8888',
            preferencia: '15min',
            fecha: yesterdayIso,
            status: 'contacted',
        },
    ];
}

function buildDataPayload() {
    return {
        ok: true,
        data: {
            appointments: [],
            callbacks: buildCallbacksPayload(),
            reviews: [],
            availability: {},
            availabilityMeta: {
                source: 'store',
                mode: 'live',
                timezone: 'America/Guayaquil',
                calendarConfigured: true,
                calendarReachable: true,
                generatedAt: new Date().toISOString(),
            },
        },
    };
}

function buildFunnelPayload() {
    return {
        ok: true,
        data: {
            summary: {
                viewBooking: 0,
                startCheckout: 0,
                bookingConfirmed: 0,
                checkoutAbandon: 0,
                startRatePct: 0,
                confirmedRatePct: 0,
                abandonRatePct: 0,
            },
            checkoutAbandonByStep: [],
            checkoutEntryBreakdown: [],
            paymentMethodBreakdown: [],
            bookingStepBreakdown: [],
            sourceBreakdown: [],
            abandonReasonBreakdown: [],
            errorCodeBreakdown: [],
        },
    };
}

async function setupAdminApiMocks(page) {
    await page.route(/\/admin-auth\.php(\?.*)?$/i, async (route) =>
        jsonResponse(route, {
            ok: true,
            authenticated: true,
            csrfToken: 'csrf_test_token',
        })
    );

    await page.route(/\/api\.php(\?.*)?$/i, async (route) => {
        const url = new URL(route.request().url());
        const resource = url.searchParams.get('resource') || '';

        if (resource === 'data') {
            return jsonResponse(route, buildDataPayload());
        }

        if (resource === 'funnel-metrics') {
            return jsonResponse(route, buildFunnelPayload());
        }

        if (resource === 'availability') {
            return jsonResponse(route, {
                ok: true,
                data: {},
                meta: buildDataPayload().data.availabilityMeta,
            });
        }

        return jsonResponse(route, { ok: true, data: {} });
    });
}

async function openCallbacksSection(page) {
    await setupAdminApiMocks(page);
    await page.goto('/admin.html');
    await expect(page.locator('#adminDashboard')).toBeVisible();
    await page.keyboard.press('Alt+Shift+Digit3');
    await expect(page.locator('#callbacks')).toHaveClass(/active/);
    await expect(page.locator('#callbacksGrid .callback-card')).toHaveCount(4);
}

test.describe('Admin callbacks triage', () => {
    test('quick filters, busqueda y reset funcionan en conjunto', async ({
        page,
    }) => {
        await openCallbacksSection(page);

        const pendingBtn = page.locator(
            '[data-action="callback-quick-filter"][data-filter-value="pending"]'
        );
        const allBtn = page.locator(
            '[data-action="callback-quick-filter"][data-filter-value="all"]'
        );

        await pendingBtn.click();
        await expect(page.locator('#callbackFilter')).toHaveValue('pending');
        await expect(pendingBtn).toHaveClass(/is-active/);
        await expect(page.locator('#callbacksGrid .callback-card')).toHaveCount(
            2
        );
        await expect(page.locator('#callbacksToolbarState')).toContainText(
            'Pendientes'
        );

        await page.locator('#searchCallbacks').fill('97 333');
        await expect(page.locator('#callbacksGrid .callback-card')).toHaveCount(
            1
        );
        await expect(page.locator('#callbacksToolbarState')).toContainText(
            'Busqueda: 97 333'
        );
        await expect(page.locator('#callbacksToolbarMeta')).toContainText(
            'Mostrando 1 de 4'
        );

        await page.locator('#clearCallbacksFiltersBtn').click();
        await expect(page.locator('#callbackFilter')).toHaveValue('all');
        await expect(page.locator('#searchCallbacks')).toHaveValue('');
        await expect(allBtn).toHaveClass(/is-active/);
        await expect(page.locator('#callbacksGrid .callback-card')).toHaveCount(
            4
        );
        await expect(page.locator('#callbacksToolbarState')).toContainText(
            'Sin filtros activos'
        );
    });

    test('atajos globales aplican filtros y slash enfoca busqueda', async ({
        page,
    }) => {
        await openCallbacksSection(page);

        await page.keyboard.press('Alt+Shift+P');
        await expect(page.locator('#callbackFilter')).toHaveValue('pending');
        await expect(page.locator('#callbacksGrid .callback-card')).toHaveCount(
            2
        );

        await page.keyboard.press('/');
        await expect(page.locator('#searchCallbacks')).toBeFocused();

        await page.locator('#pageTitle').click();
        await page.keyboard.press('Alt+Shift+C');
        await expect(page.locator('#callbackFilter')).toHaveValue('contacted');
        await expect(page.locator('#callbacksGrid .callback-card')).toHaveCount(
            2
        );
    });
});
