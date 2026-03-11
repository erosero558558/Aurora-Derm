// @ts-check
const { test, expect } = require('@playwright/test');
const { skipIfPhpRuntimeMissing } = require('./helpers/php-backend');

test.use({
    serviceWorkers: 'block',
    viewport: { width: 1366, height: 960 },
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

function toDateTimePartsFromNow(hoursFromNow) {
    const target = new Date(Date.now() + hoursFromNow * 60 * 60 * 1000);
    return {
        date: toDateKey(target),
        time: `${String(target.getHours()).padStart(2, '0')}:${String(
            target.getMinutes()
        ).padStart(2, '0')}`,
    };
}

function isoMinutesAgo(minutesAgo) {
    return new Date(Date.now() - minutesAgo * 60 * 1000).toISOString();
}

function buildAvailabilitySeed() {
    const dayOne = new Date();
    dayOne.setDate(dayOne.getDate() + 1);
    const dayTwo = new Date();
    dayTwo.setDate(dayTwo.getDate() + 5);
    return {
        [toDateKey(dayOne)]: ['09:00', '10:30'],
        [toDateKey(dayTwo)]: ['15:00', '16:30'],
    };
}

function buildFixtureState() {
    const near = toDateTimePartsFromNow(2);
    const tomorrow = toDateTimePartsFromNow(26);

    return {
        appointments: [
            {
                id: 801,
                name: 'Ana Transfer',
                email: 'ana@example.com',
                phone: '+593 99 111 2222',
                service: 'consulta_dermatologica',
                doctor: 'rosero',
                date: near.date,
                time: near.time,
                price: '$45.00',
                status: 'confirmed',
                paymentMethod: 'transfer',
                paymentStatus: 'pending_transfer_review',
            },
            {
                id: 802,
                name: 'Bruno Agenda',
                email: 'bruno@example.com',
                phone: '+593 98 222 3333',
                service: 'limpieza_facial',
                doctor: 'narvaez',
                date: tomorrow.date,
                time: tomorrow.time,
                price: '$35.00',
                status: 'confirmed',
                paymentMethod: 'cash',
                paymentStatus: 'paid',
            },
        ],
        callbacks: [
            {
                id: 501,
                telefono: '+593 98 111 2222',
                preferencia: 'ahora',
                fecha: isoMinutesAgo(220),
                status: 'pending',
            },
            {
                id: 502,
                telefono: '+593 97 333 4444',
                preferencia: '30min',
                fecha: isoMinutesAgo(35),
                status: 'pending',
            },
        ],
        reviews: [
            {
                id: 11,
                name: 'Maria Torres',
                rating: 5,
                comment: 'Excelente atencion y seguimiento.',
                createdAt: new Date().toISOString(),
            },
            {
                id: 12,
                name: 'Luis Paredes',
                rating: 3,
                comment: 'Buen criterio medico, pero la espera fue larga.',
                createdAt: new Date(
                    Date.now() - 4 * 24 * 60 * 60 * 1000
                ).toISOString(),
            },
        ],
        availability: buildAvailabilitySeed(),
        availabilityMeta: {
            source: 'store',
            mode: 'live',
            timezone: 'America/Guayaquil',
            calendarConfigured: true,
            calendarReachable: true,
            generatedAt: new Date().toISOString(),
        },
        funnel: {
            summary: {
                viewBooking: 120,
                startCheckout: 54,
                bookingConfirmed: 31,
                abandonRatePct: 42.5,
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

async function setupOperationalMocks(page) {
    const state = buildFixtureState();

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

        if (resource === 'data') {
            return jsonResponse(route, {
                ok: true,
                data: {
                    appointments: state.appointments,
                    callbacks: state.callbacks,
                    reviews: state.reviews,
                    availability: state.availability,
                    availabilityMeta: state.availabilityMeta,
                },
            });
        }

        if (resource === 'funnel-metrics') {
            return jsonResponse(route, {
                ok: true,
                data: state.funnel,
            });
        }

        if (resource === 'availability') {
            return jsonResponse(route, {
                ok: true,
                data: state.availability,
                meta: state.availabilityMeta,
            });
        }

        return jsonResponse(route, { ok: true, data: {} });
    });
}

async function openAdminSonyV3(page, request) {
    await skipIfPhpRuntimeMissing(test, request);
    await setupOperationalMocks(page);
    await page.goto('/admin.html');

    await expect(page.locator('html')).toHaveAttribute(
        'data-admin-ui',
        'sony_v3'
    );
    await expect(page.locator('body')).toHaveClass(/admin-v3-mode/);
    await expect(page.locator('[data-admin-frame="sony_v3"]')).toBeVisible();
}

test.describe('Admin sony_v3 runtime', () => {
    test('arranca por defecto con shell editorial y assets v3 unicos', async ({
        page,
        request,
    }) => {
        await openAdminSonyV3(page, request);

        await expect(page.locator('#adminV3Styles')).toHaveCount(1);
        await expect(
            page.locator(
                '#adminLegacyBaseStyles, #adminLegacyMinStyles, #adminLegacyStyles, #adminV2Styles'
            )
        ).toHaveCount(0);

        await expect(page.locator('#adminProductivityStrip')).toBeVisible();
        await expect(
            page.locator('[data-admin-section-hero]').first()
        ).toBeVisible();
        await expect(
            page.locator('[data-admin-priority-rail]').first()
        ).toBeVisible();
        await expect(
            page.locator('[data-admin-workbench]').first()
        ).toBeVisible();
        await expect(page.locator('#pageTitle')).toHaveText('Inicio');
        await expect(page.locator('#openOperatorAppBtn')).toBeVisible();
        await expect(page.locator('#dashboardAdvancedAnalytics')).not.toHaveJSProperty(
            'open',
            true
        );

        await page.keyboard.press('Control+K');
        await expect(page.locator('#adminCommandPalette')).not.toHaveClass(
            /is-hidden/
        );
        await page.locator('#adminQuickCommand').fill('callbacks sla');
        await page.keyboard.press('Enter');

        await expect(page.locator('#callbacks')).toHaveClass(/active/);
        await expect(page.locator('#callbackFilter')).toHaveValue('sla_urgent');
    });

    test('mantiene navegacion operativa entre citas, callbacks, resenas y disponibilidad', async ({
        page,
        request,
    }) => {
        await openAdminSonyV3(page, request);

        await page.keyboard.press('Alt+Shift+Digit2');
        await expect(page.locator('#appointments')).toHaveClass(/active/);
        await expect(page.locator('#pageTitle')).toHaveText('Agenda');
        await expect(
            page.locator('#appointmentsTableBody tr.appointment-row')
        ).toHaveCount(2);

        await page.keyboard.press('Alt+Shift+Digit3');
        await expect(page.locator('#callbacks')).toHaveClass(/active/);

        await page.keyboard.press('Alt+Shift+Digit4');
        await expect(page.locator('#reviews')).toHaveClass(/active/);

        await page.keyboard.press('Alt+Shift+Digit5');
        await expect(page.locator('#availability')).toHaveClass(/active/);
    });
});
