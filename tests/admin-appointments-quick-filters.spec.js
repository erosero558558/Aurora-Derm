// @ts-check
const { test, expect } = require('@playwright/test');

test.use({
    serviceWorkers: 'block',
    viewport: { width: 1366, height: 900 },
});

function jsonResponse(route, payload, status = 200) {
    return route.fulfill({
        status,
        contentType: 'application/json; charset=utf-8',
        body: JSON.stringify(payload),
    });
}

function toLocalDateKey(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

function toDateTimePartsFromNow(hoursFromNow) {
    const target = new Date(Date.now() + hoursFromNow * 60 * 60 * 1000);
    return {
        date: toLocalDateKey(target),
        time: `${String(target.getHours()).padStart(2, '0')}:${String(
            target.getMinutes()
        ).padStart(2, '0')}`,
    };
}

function buildAppointmentsPayload() {
    const slotNear = toDateTimePartsFromNow(2);
    const slotTomorrow = toDateTimePartsFromNow(26);
    const slotNoShow = toDateTimePartsFromNow(30);
    const slotLater = toDateTimePartsFromNow(84);

    return [
        {
            id: 201,
            name: 'Ana Transfer',
            email: 'ana@example.com',
            phone: '+593 99 111 2222',
            service: 'limpieza_facial',
            doctor: 'rosero',
            date: slotNear.date,
            time: slotNear.time,
            price: '$45.00',
            status: 'confirmed',
            paymentMethod: 'transfer',
            paymentStatus: 'pending_transfer_review',
        },
        {
            id: 202,
            name: 'Bruno Confirmado',
            email: 'bruno@example.com',
            phone: '+593 98 222 3333',
            service: 'consulta_dermatologica',
            doctor: 'narvaez',
            date: slotTomorrow.date,
            time: slotTomorrow.time,
            price: '$35.00',
            status: 'confirmed',
            paymentMethod: 'cash',
            paymentStatus: 'paid',
        },
        {
            id: 203,
            name: 'Carla NoShow',
            email: 'carla@example.com',
            phone: '+593 97 333 4444',
            service: 'telemedicina',
            doctor: 'rosero',
            date: slotNoShow.date,
            time: slotNoShow.time,
            price: '$30.00',
            status: 'no_show',
            paymentMethod: 'transfer',
            paymentStatus: 'failed',
        },
        {
            id: 204,
            name: 'Dario Futuro',
            email: 'dario@example.com',
            phone: '+593 96 444 5555',
            service: 'laser',
            doctor: 'rosero',
            date: slotLater.date,
            time: slotLater.time,
            price: '$60.00',
            status: 'confirmed',
            paymentMethod: 'cash',
            paymentStatus: 'pending_cash',
        },
    ];
}

function buildDataPayload() {
    return {
        ok: true,
        data: {
            appointments: buildAppointmentsPayload(),
            callbacks: [],
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

        if (resource === 'availability') {
            return jsonResponse(route, {
                ok: true,
                data: {},
                meta: buildDataPayload().data.availabilityMeta,
            });
        }

        if (resource === 'funnel-metrics') {
            return jsonResponse(route, buildFunnelPayload());
        }

        return jsonResponse(route, { ok: true, data: {} });
    });
}

async function gotoAppointments(page) {
    await setupAdminApiMocks(page);
    await page.goto('/admin.html');
    await expect(page.locator('#adminDashboard')).toBeVisible();
    await page.locator('.nav-item[data-section="appointments"]').click();
    await expect(page.locator('#appointments')).toHaveClass(/active/);
    await expect(
        page.locator('#appointmentsTableBody tr.appointment-row')
    ).toHaveCount(4);
}

test.describe('Admin appointments quick filters + shortcuts', () => {
    test('quick filters sincronizan select y conteos', async ({ page }) => {
        await gotoAppointments(page);

        const pendingFilterBtn = page.locator(
            '[data-action="appointment-quick-filter"][data-filter-value="pending_transfer"]'
        );
        const upcomingFilterBtn = page.locator(
            '[data-action="appointment-quick-filter"][data-filter-value="upcoming_48h"]'
        );
        const allFilterBtn = page.locator(
            '[data-action="appointment-quick-filter"][data-filter-value="all"]'
        );

        await pendingFilterBtn.click();
        await expect(page.locator('#appointmentFilter')).toHaveValue(
            'pending_transfer'
        );
        await expect(pendingFilterBtn).toHaveClass(/is-active/);
        await expect(
            page.locator('#appointmentsTableBody tr.appointment-row')
        ).toHaveCount(1);
        await expect(page.locator('#appointmentsTableBody')).toContainText(
            'Ana Transfer'
        );

        await upcomingFilterBtn.click();
        await expect(page.locator('#appointmentFilter')).toHaveValue(
            'upcoming_48h'
        );
        await expect(upcomingFilterBtn).toHaveClass(/is-active/);
        await expect(
            page.locator('#appointmentsTableBody tr.appointment-row')
        ).toHaveCount(3);
        await expect(page.locator('#appointmentsTableBody')).not.toContainText(
            'Dario Futuro'
        );

        await allFilterBtn.click();
        await expect(page.locator('#appointmentFilter')).toHaveValue('all');
        await expect(allFilterBtn).toHaveClass(/is-active/);
        await expect(
            page.locator('#appointmentsTableBody tr.appointment-row')
        ).toHaveCount(4);
    });

    test('atajos globales aplican filtros y slash enfoca busqueda', async ({
        page,
    }) => {
        await setupAdminApiMocks(page);
        await page.goto('/admin.html');
        await expect(page.locator('#adminDashboard')).toBeVisible();

        await page.keyboard.press('Alt+Shift+T');
        await expect(page.locator('#appointments')).toHaveClass(/active/);
        await expect(page).toHaveURL(/#appointments$/);
        await expect(page.locator('#appointmentFilter')).toHaveValue(
            'pending_transfer'
        );
        await expect(
            page.locator('#appointmentsTableBody tr.appointment-row')
        ).toHaveCount(1);

        await page.keyboard.press('Alt+Shift+A');
        await expect(page.locator('#appointmentFilter')).toHaveValue('all');
        await expect(
            page.locator('#appointmentsTableBody tr.appointment-row')
        ).toHaveCount(4);

        await page.keyboard.press('/');
        await expect(page.locator('#searchAppointments')).toBeFocused();
        await page.keyboard.type('Bruno');
        await expect(
            page.locator('#appointmentsTableBody tr.appointment-row')
        ).toHaveCount(1);
        await expect(page.locator('#appointmentsTableBody')).toContainText(
            'Bruno Confirmado'
        );

        await page.locator('#pageTitle').click();
        await page.keyboard.press('Alt+Shift+N');
        await expect(page.locator('#searchAppointments')).toHaveValue('');
        await expect(page.locator('#appointmentFilter')).toHaveValue('no_show');
        await expect(
            page.locator('#appointmentsTableBody tr.appointment-row')
        ).toHaveCount(1);
        await expect(page.locator('#appointmentsTableBody')).toContainText(
            'Carla NoShow'
        );
    });
});
