// @ts-check
const { test, expect } = require('@playwright/test');

test.use({
    serviceWorkers: 'block',
    viewport: { width: 900, height: 900 },
});

function jsonResponse(route, payload, status = 200) {
    return route.fulfill({
        status,
        contentType: 'application/json; charset=utf-8',
        body: JSON.stringify(payload),
    });
}

function buildAppointmentsPayload() {
    const today = new Date();
    const todayKey = today.toISOString().split('T')[0];
    const tomorrow = new Date(today);
    tomorrow.setDate(today.getDate() + 1);
    const tomorrowKey = tomorrow.toISOString().split('T')[0];

    return [
        {
            id: 101,
            name: 'Ana Transfer',
            email: 'ana@example.com',
            phone: '+593 99 111 2222',
            service: 'limpieza_facial',
            doctor: 'rosero',
            date: todayKey,
            time: '10:00',
            price: '$45.00',
            status: 'confirmed',
            paymentMethod: 'transfer',
            paymentStatus: 'pending_transfer_review',
            transferReference: 'TRX-001',
            transferProofUrl: 'https://example.com/proof-1.jpg',
        },
        {
            id: 102,
            name: 'Bruno Confirmado',
            email: 'bruno@example.com',
            phone: '+593 98 222 3333',
            service: 'consulta_dermatologica',
            doctor: 'narvaez',
            date: tomorrowKey,
            time: '11:30',
            price: '$35.00',
            status: 'confirmed',
            paymentMethod: 'cash',
            paymentStatus: 'paid',
        },
        {
            id: 103,
            name: 'Carla NoShow',
            email: 'carla@example.com',
            phone: '+593 97 333 4444',
            service: 'telemedicina',
            doctor: 'rosero',
            date: tomorrowKey,
            time: '15:00',
            price: '$30.00',
            status: 'no_show',
            paymentMethod: 'transfer',
            paymentStatus: 'failed',
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
    await page.route(/\/admin-auth\.php(\?.*)?$/i, async (route) => {
        const url = new URL(route.request().url());
        const action = url.searchParams.get('action') || '';

        if (action === 'status') {
            return jsonResponse(route, {
                ok: true,
                authenticated: true,
                csrfToken: 'csrf_test_token',
            });
        }

        return jsonResponse(route, {
            ok: true,
            authenticated: true,
            csrfToken: 'csrf_test_token',
        });
    });

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

async function openAppointmentsSection(page) {
    await setupAdminApiMocks(page);
    await page.goto('/admin.html');
    await expect(page.locator('#adminDashboard')).toBeVisible();
    const menuToggle = page.locator('#adminMenuToggle');
    if (await menuToggle.isVisible()) {
        await menuToggle.click();
        await expect(page.locator('#adminSidebar')).toHaveClass(/is-open/);
    }
    await page.locator('.nav-item[data-section="appointments"]').click();
    await expect(page.locator('#appointments')).toHaveClass(/active/);
    await expect(
        page.locator('#appointmentsTableBody tr.appointment-row')
    ).toHaveCount(3);
}

test.describe('Admin appointments responsive triage', () => {
    test('compone filtro y busqueda con resumen y reset en tablet', async ({
        page,
    }) => {
        await openAppointmentsSection(page);

        await expect(page.locator('#appointmentsToolbarMeta')).toContainText(
            'Mostrando 3'
        );
        await expect(page.locator('#appointmentsToolbarState')).toContainText(
            'Sin filtros activos'
        );
        await expect(page.locator('#clearAppointmentsFiltersBtn')).toHaveClass(
            /is-hidden/
        );

        await page
            .locator('#appointmentFilter')
            .selectOption('pending_transfer');
        await expect(
            page.locator('#appointmentsTableBody tr.appointment-row')
        ).toHaveCount(1);
        await expect(page.locator('#appointmentsToolbarState')).toContainText(
            'Transferencias por validar'
        );
        await expect(
            page.locator('#clearAppointmentsFiltersBtn')
        ).not.toHaveClass(/is-hidden/);

        await page.locator('#searchAppointments').fill('Ana');
        await expect(
            page.locator('#appointmentsTableBody tr.appointment-row')
        ).toHaveCount(1);
        await expect(page.locator('#appointmentsToolbarState')).toContainText(
            'Busqueda: Ana'
        );
        await expect(page.locator('#appointmentsTableBody')).toContainText(
            'Ana Transfer'
        );

        await page.locator('#searchAppointments').fill('Bruno');
        await expect(
            page.locator('#appointmentsTableBody tr.table-empty-row')
        ).toHaveCount(1);
        await expect(page.locator('#appointmentsToolbarState')).toContainText(
            'Resultados: 0'
        );

        await page.locator('#clearAppointmentsFiltersBtn').click();
        await expect(page.locator('#appointmentFilter')).toHaveValue('all');
        await expect(page.locator('#searchAppointments')).toHaveValue('');
        await expect(
            page.locator('#appointmentsTableBody tr.appointment-row')
        ).toHaveCount(3);
        await expect(page.locator('#appointmentsToolbarState')).toContainText(
            'Sin filtros activos'
        );
        await expect(page.locator('#clearAppointmentsFiltersBtn')).toHaveClass(
            /is-hidden/
        );
    });

    test('mantiene filas responsive con labels y acciones visibles', async ({
        page,
    }) => {
        await openAppointmentsSection(page);

        const targetRow = page
            .locator('#appointmentsTableBody tr.appointment-row')
            .filter({ hasText: 'Ana Transfer' })
            .first();
        await expect(targetRow).toBeVisible();
        await expect(
            targetRow.locator('td[data-label="Paciente"]')
        ).toContainText('Ana Transfer');
        await expect(targetRow.locator('td[data-label="Pago"]')).toContainText(
            'Ver comprobante'
        );
        await expect(
            targetRow.locator(
                'td[data-label="Acciones"] .table-actions button, td[data-label="Acciones"] .table-actions a'
            )
        ).toHaveCount(6);
    });
});
