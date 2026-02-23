// @ts-check
const { test, expect } = require('@playwright/test');
const { skipIfPhpRuntimeMissing } = require('./helpers/php-backend');

function normalizeLabel(value) {
    const raw = String(value || '').trim().toLowerCase();
    if (!raw) {
        return 'unknown';
    }
    const normalized = raw.replace(/[^a-z0-9_]+/g, '_').replace(/^_+|_+$/g, '');
    if (!normalized) {
        return 'unknown';
    }
    return normalized.slice(0, 48);
}

test.describe('Funnel API contract', () => {
    test('POST funnel-event registra evento publico y metrica derivada de abandono', async ({
        request,
    }) => {
        await skipIfPhpRuntimeMissing(test, request);

        const stamp = Date.now();
        const checkoutStep = 'payment_method_selected';
        const reason = `modal_close_${stamp}`;

        const response = await request.post('/api.php?resource=funnel-event', {
            data: {
                event: 'checkout_abandon',
                params: {
                    source: 'booking_form',
                    checkout_step: checkoutStep,
                    reason,
                },
            },
        });

        expect(response.status()).toBe(202);
        const body = await response.json();
        expect(body.ok).toBe(true);
        expect(body.recorded).toBe(true);

        const metricsResponse = await request.get('/api.php?resource=metrics');
        expect(metricsResponse.ok()).toBeTruthy();
        const metricsText = await metricsResponse.text();

        const normalizedStep = normalizeLabel(checkoutStep);
        const normalizedReason = normalizeLabel(reason);
        const dropoffLine = metricsText
            .split('\n')
            .find(
                (line) =>
                    line.startsWith('booking_funnel_dropoff_total{') &&
                    line.includes(`step="${normalizedStep}"`) &&
                    line.includes(`reason="${normalizedReason}"`)
            );

        expect(dropoffLine, 'Metrica booking_funnel_dropoff_total no encontrada').toBeTruthy();
    });

    test('GET funnel-metrics mantiene proteccion admin (401)', async ({
        request,
    }) => {
        await skipIfPhpRuntimeMissing(test, request);
        const response = await request.get('/api.php?resource=funnel-metrics');
        expect(response.status()).toBe(401);
    });
});
