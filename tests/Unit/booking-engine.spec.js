const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');

test.describe('Booking Engine Unit Tests', () => {
    test.beforeEach(async ({ page }) => {
        // Navigate to a blank page
        await page.goto('about:blank');

        // Read the engine script content
        const enginePath = path.resolve(__dirname, '../../src/apps/booking/engine.js');
        let content = fs.readFileSync(enginePath, 'utf8');

        // Expose api to window for testing purposes since it was removed from source
        content = content.replace('export default api;', 'window.PielBookingEngine = api; export default api;');

        // Inject the engine script
        await page.addScriptTag({
            content: content,
            type: 'module'
        });

        // Wait for the module to execute and expose the global
        await page.waitForFunction(() => window.PielBookingEngine);
    });

    test('initializes correctly with dependencies', async ({ page }) => {
        const result = await page.evaluate(() => {
            const deps = {
                loadPaymentConfig: () => Promise.resolve({ enabled: true }),
                getCurrentLang: () => 'es'
            };
            return window.PielBookingEngine.init(deps);
        });
        expect(result).toBeTruthy();
    });

    test('sanitizeBookingSubmissionError returns friendly message for technical errors', async ({ page }) => {
        const result = await page.evaluate(async () => {
            let lastToast = null;
            const deps = {
                showToast: (msg, type) => { lastToast = { msg, type }; },
                getCurrentAppointment: () => ({ service: 'test' }),
                trackEvent: () => {},
                loadPaymentConfig: () => Promise.resolve({ enabled: true, provider: 'stripe', publishableKey: 'pk_test' }),
                getCheckoutSession: () => ({ active: true }),
                setCheckoutStep: () => {},
                normalizeAnalyticsLabel: (val) => val,
                loadStripeSdk: () => Promise.resolve(),
                // Mock createPaymentIntent to throw a technical error
                createPaymentIntent: () => { throw new Error('Fatal error: Call to undefined function on line 20'); },
                buildAppointmentPayload: () => ({}),
                stripTransientAppointmentFields: () => ({})
            };

            // Mock Stripe global
            window.Stripe = () => ({
                elements: () => ({
                    create: () => ({ mount: () => {}, clear: () => {} })
                })
            });

            window.PielBookingEngine.init(deps);

            // We need a payment button to avoid "btn not found" error
            document.body.innerHTML = '<div id="paymentModal" class="active"><button class="btn-primary">Pay</button></div><input id="cardholderName" value="Juan Perez">';

            // Fake a payment method active
            const method = document.createElement('div');
            method.className = 'payment-method active';
            method.dataset.method = 'card';
            document.body.appendChild(method);

            // We need to trigger the processPayment logic.
            // Since processPayment is async, we await it.
            await window.PielBookingEngine.processPayment();
            return lastToast;
        });

        expect(result).not.toBeNull();
        expect(result.msg).toContain('Hubo un problema tecnico temporal');
        expect(result.type).toBe('error');
    });

    test('getActivePaymentMethod returns correct method', async ({ page }) => {
        const method = await page.evaluate(() => {
            document.body.innerHTML = `
                <div class="payment-method" data-method="card"></div>
                <div class="payment-method active" data-method="transfer"></div>
            `;
            return window.PielBookingEngine.getActivePaymentMethod();
        });
        expect(method).toBe('transfer');
    });

    test('getActivePaymentMethod defaults to cash if none active', async ({ page }) => {
        const method = await page.evaluate(() => {
            document.body.innerHTML = `
                <div class="payment-method" data-method="card"></div>
            `;
            return window.PielBookingEngine.getActivePaymentMethod();
        });
        expect(method).toBe('cash');
    });
});
