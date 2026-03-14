// @ts-check
const { test, expect } = require('@playwright/test');
const { installLegacyAdminAuthMock } = require('./helpers/admin-auth-mocks');

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
    dayTwo.setDate(dayTwo.getDate() + 3);
    return {
        [toDateKey(dayOne)]: ['09:00', '10:30'],
        [toDateKey(dayTwo)]: ['16:00'],
    };
}

function buildFixtureState() {
    const near = toDateTimePartsFromNow(2);
    const tomorrow = toDateTimePartsFromNow(26);

    return {
        appointments: [
            {
                id: 701,
                name: 'Ana Transfer',
                email: 'ana@example.com',
                phone: '+593 99 111 2222',
                service: 'limpieza_facial',
                doctor: 'rosero',
                date: near.date,
                time: near.time,
                price: '$45.00',
                status: 'confirmed',
                paymentMethod: 'transfer',
                paymentStatus: 'pending_transfer_review',
                transferProofUrl: 'https://example.com/proof-701.jpg',
            },
            {
                id: 702,
                name: 'Bruno Confirmado',
                email: 'bruno@example.com',
                phone: '+593 98 222 3333',
                service: 'consulta_dermatologica',
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
                id: 401,
                telefono: '+593 98 111 2222',
                preferencia: 'ahora',
                fecha: isoMinutesAgo(220),
                status: 'pending',
            },
            {
                id: 402,
                telefono: '+593 97 333 4444',
                preferencia: '30min',
                fecha: isoMinutesAgo(40),
                status: 'pendiente',
            },
        ],
        reviews: [
            {
                id: 1,
                name: 'Maria Torres',
                rating: 5,
                comment: 'Excelente atencion y seguimiento.',
                createdAt: new Date().toISOString(),
            },
            {
                id: 2,
                name: 'Luis Paredes',
                rating: 4,
                comment: 'Proceso claro y consulta puntual.',
                createdAt: new Date(
                    Date.now() - 6 * 24 * 60 * 60 * 1000
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

async function setupSonyV3Mocks(page) {
    const state = buildFixtureState();

    await installLegacyAdminAuthMock(page);

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

async function openAdminSonyV3(page) {
    await setupSonyV3Mocks(page);
    await page.goto('/admin.html');
    await expect(page.locator('html')).toHaveAttribute(
        'data-admin-ui',
        'sony_v3'
    );
    await expect(page.locator('body')).toHaveClass(/admin-v3-mode/);
    await expect(page.locator('#adminDashboard')).toBeVisible();
}

test.describe('Admin sony_v3 shell', () => {
    test('renderiza shell editorial y abre command palette sin estilos legacy', async ({
        page,
    }) => {
        await openAdminSonyV3(page);

        await expect(page.locator('#adminProductivityStrip')).toBeVisible();
        await expect(page.locator('#pageTitle')).toHaveText('Inicio');
        await expect(page.locator('#adminPrimaryNav')).toContainText('Inicio');
        await expect(page.locator('#adminPrimaryNav')).toContainText('Agenda');
        await expect(page.locator('#adminPrimaryNav')).toContainText(
            'Pendientes'
        );
        await expect(page.locator('#adminPrimaryNav')).toContainText(
            'Horarios'
        );
        await expect(page.locator('#adminSecondaryNav')).toContainText(
            'Mas herramientas'
        );
        await expect(page.locator('#adminSecondaryNav')).toContainText(
            'Historia clinica'
        );
        await expect(
            page.locator('.nav-item[data-section="reviews"]')
        ).toHaveCount(0);
        await expect(
            page.locator('.nav-item[data-section="queue"]')
        ).toHaveCount(0);
        await expect(page.locator('#reviews')).toHaveCount(0);
        await expect(page.locator('#queue')).toHaveCount(0);
        await expect(page.locator('#openOperatorAppBtn')).toBeVisible();
        await expect(page.locator('#opsTodaySummaryCard')).toBeVisible();
        await expect(page.locator('#opsPendingSummaryCard')).toBeVisible();
        await expect(page.locator('#opsAvailabilitySummaryCard')).toBeVisible();
        await expect(
            page.locator('#dashboardAdvancedAnalytics')
        ).not.toHaveJSProperty('open', true);
        await expect(page.locator('#adminCommandPalette')).toHaveClass(
            /is-hidden/
        );

        const styles = await page.evaluate(() => ({
            legacyCount: document.querySelectorAll(
                '#adminLegacyBaseStyles, #adminLegacyMinStyles, #adminLegacyStyles, #adminV2Styles'
            ).length,
            v3Count: document.querySelectorAll('#adminV3Styles').length,
        }));

        expect(styles.legacyCount).toBe(0);
        expect(styles.v3Count).toBe(1);

        await page.keyboard.press('Control+K');
        await expect(page.locator('#adminCommandPalette')).not.toHaveClass(
            /is-hidden/
        );
        await page.locator('#adminQuickCommand').fill('callbacks sla');
        await page.keyboard.press('Enter');
        await expect(page.locator('#callbacks')).toHaveClass(/active/);
        await expect(page.locator('#callbackFilter')).toHaveValue('sla_urgent');

        await page.keyboard.press('Control+K');
        await page.locator('#adminQuickCommand').fill('turnero');
        await page.keyboard.press('Enter');
        await expect(page.locator('#callbacks')).toHaveClass(/active/);
        await expect(page).not.toHaveURL(/#queue$/);
    });

    test('conserva navegacion por atajos y workbench de citas', async ({
        page,
    }) => {
        await openAdminSonyV3(page);

        await page.keyboard.press('Alt+Shift+Digit2');
        await expect(page.locator('#appointments')).toHaveClass(/active/);
        await expect(page.locator('#pageTitle')).toHaveText('Agenda');
        await expect(
            page.locator('#appointmentsTableBody tr.appointment-row')
        ).toHaveCount(2);
        await expect(page.locator('#appointmentsFocusPatient')).toContainText(
            'Ana Transfer'
        );
    });
});
