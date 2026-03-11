// @ts-check
const { test, expect } = require('@playwright/test');

test.use({
    serviceWorkers: 'block',
});

function jsonResponse(route, payload, status = 200) {
    return route.fulfill({
        status,
        contentType: 'application/json; charset=utf-8',
        body: JSON.stringify(payload),
    });
}

function toDateKey(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

async function setupVisualMocks(page) {
    const now = new Date();
    const upcoming = new Date();
    upcoming.setDate(upcoming.getDate() + 1);

    await page.route(/\/admin-auth\.php(\?.*)?$/i, async (route) =>
        jsonResponse(route, {
            ok: true,
            authenticated: true,
            csrfToken: 'csrf_test_token',
        })
    );

    await page.route(/\/api\.php(\?.*)?$/i, async (route) => {
        const url = new URL(route.request().url());
        const resource = String(
            url.searchParams.get('resource') || ''
        ).toLowerCase();

        if (resource === 'features') {
            return jsonResponse(route, {
                ok: true,
                data: {
                    admin_sony_ui: true,
                    admin_sony_ui_v3: true,
                },
            });
        }

        if (resource === 'data') {
            return jsonResponse(route, {
                ok: true,
                data: {
                    appointments: [
                        {
                            id: 1,
                            name: 'Paciente Uno',
                            email: 'uno@example.com',
                            phone: '+593 99 000 1111',
                            service: 'consulta_dermatologica',
                            doctor: 'rosero',
                            date: toDateKey(upcoming),
                            time: '09:00',
                            status: 'confirmed',
                            paymentStatus: 'pending_transfer_review',
                            paymentMethod: 'transfer',
                            price: '$35.00',
                        },
                    ],
                    callbacks: [
                        {
                            id: 1,
                            telefono: '+593 99 222 3333',
                            preferencia: 'ahora',
                            fecha: new Date(
                                now.getTime() - 200 * 60 * 1000
                            ).toISOString(),
                            status: 'pending',
                        },
                    ],
                    reviews: [
                        {
                            id: 1,
                            name: 'Paciente Dos',
                            rating: 5,
                            comment: 'Muy buen seguimiento.',
                            createdAt: now.toISOString(),
                        },
                    ],
                    availability: {
                        [toDateKey(upcoming)]: ['09:00', '10:00'],
                    },
                    availabilityMeta: {
                        source: 'store',
                        mode: 'live',
                        timezone: 'America/Guayaquil',
                    },
                },
            });
        }

        if (resource === 'funnel-metrics') {
            return jsonResponse(route, {
                ok: true,
                data: {
                    summary: {
                        viewBooking: 48,
                        startCheckout: 16,
                        bookingConfirmed: 8,
                        abandonRatePct: 33.3,
                    },
                    checkoutAbandonByStep: [],
                    checkoutEntryBreakdown: [],
                    paymentMethodBreakdown: [],
                    bookingStepBreakdown: [],
                    sourceBreakdown: [],
                    abandonReasonBreakdown: [],
                    errorCodeBreakdown: [],
                },
            });
        }

        if (resource === 'availability') {
            return jsonResponse(route, {
                ok: true,
                data: {
                    [toDateKey(upcoming)]: ['09:00', '10:00'],
                },
                meta: {
                    source: 'store',
                    mode: 'live',
                    timezone: 'America/Guayaquil',
                },
            });
        }

        return jsonResponse(route, { ok: true, data: {} });
    });
}

async function openSonyV3(page) {
    await setupVisualMocks(page);
    await page.goto('/admin.html');
    await expect(page.locator('html')).toHaveAttribute(
        'data-admin-ui',
        'sony_v3'
    );
}

test.describe('Admin sony_v3 visual structure', () => {
    test('dashboard expone hooks canonicos y base clara', async ({ page }) => {
        await page.setViewportSize({ width: 1440, height: 960 });
        await openSonyV3(page);

        await expect(
            page.locator('[data-admin-frame="sony_v3"]')
        ).toBeVisible();
        await expect(
            page.locator('[data-admin-section-hero]').first()
        ).toBeVisible();
        await expect(
            page.locator('[data-admin-priority-rail]').first()
        ).toBeVisible();
        await expect(
            page.locator('[data-admin-workbench]').first()
        ).toBeVisible();
        await expect(page.locator('#openOperatorAppBtn')).toBeVisible();
        await expect(page.locator('#dashboardAdvancedAnalytics')).not.toHaveJSProperty(
            'open',
            true
        );
        await expect(page.locator('.admin-quick-nav-item')).toHaveCount(0);

        const bgToken = await page.evaluate(() =>
            getComputedStyle(document.documentElement)
                .getPropertyValue('--admin3-bg')
                .trim()
        );
        expect(bgToken).toBe('#f3f4f1');
    });

    test('mantiene jerarquia y navegacion usable en movil', async ({
        page,
    }) => {
        await page.setViewportSize({ width: 375, height: 812 });
        await openSonyV3(page);

        await page.locator('#adminMenuToggle').click();
        await expect(page.locator('#adminSidebar')).toHaveClass(/is-open/);

        await page.keyboard.press('Alt+Shift+Digit5');
        await expect(page.locator('#availability')).toHaveClass(/active/);
        await expect(
            page.locator('#availabilityCalendar .calendar-day')
        ).toHaveCount(42);
        await expect(page.locator('#availabilityDetailGrid')).toBeVisible();
    });
});
