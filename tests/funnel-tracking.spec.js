// @ts-check
const { test, expect } = require('@playwright/test');

test.use({ serviceWorkers: 'block' });

function jsonResponse(route, payload) {
    return route.fulfill({
        status: 200,
        contentType: 'application/json; charset=utf-8',
        body: JSON.stringify(payload),
    });
}

async function mockApi(page) {
    await page.route(/\/api\.php(\?.*)?$/i, async (route) => {
        const request = route.request();
        const url = new URL(request.url());
        const resource = url.searchParams.get('resource') || '';

        if (resource === 'availability') {
            const target = new Date();
            target.setDate(target.getDate() + 7);
            const dateValue = target.toISOString().split('T')[0];
            return jsonResponse(route, {
                ok: true,
                data: {
                    [dateValue]: ['10:00', '11:00', '15:00']
                }
            });
        }

        if (resource === 'booked-slots') {
            return jsonResponse(route, { ok: true, data: [] });
        }

        if (resource === 'reviews') {
            return jsonResponse(route, { ok: true, data: [] });
        }

        if (resource === 'payment-config') {
            return jsonResponse(route, {
                ok: true,
                data: {
                    enabled: false,
                    provider: 'stripe',
                    publishableKey: '',
                    currency: 'USD',
                },
            });
        }

        if (resource === 'payment-intent') {
            return jsonResponse(route, {
                ok: true,
                data: {
                    clientSecret: 'pi_test_secret',
                    paymentIntentId: 'pi_test_id',
                },
            });
        }

        if (resource === 'payment-verify') {
            return jsonResponse(route, { ok: true, paid: true });
        }

        if (url.hostname === 'js.stripe.com') {
            return route.fulfill({
                status: 200,
                contentType: 'application/javascript',
                body: 'window.Stripe = () => ({ elements: () => ({ create: () => ({ mount: () => {}, on: () => {} }) }) });',
            });
        }

        if (resource === 'transfer-proof') {
            return jsonResponse(route, {
                ok: true,
                data: {
                    transferProofPath: '/uploads/test-proof.png',
                    transferProofUrl: '/uploads/test-proof.png',
                    transferProofName: 'test-proof.png',
                    transferProofMime: 'image/png',
                },
            });
        }

        if (resource === 'appointments' && request.method() === 'POST') {
            let body;
            try {
                body = request.postDataJSON() || {};
            } catch {
                body = {};
            }

            return jsonResponse(route, {
                ok: true,
                data: {
                    id: Date.now(),
                    status: body.status || 'confirmed',
                    ...body,
                },
                emailSent: false,
            });
        }

        return jsonResponse(route, { ok: true, data: {} });
    });
}

async function dismissCookieBannerIfVisible(page) {
    const banner = page.locator('#cookieBanner');
    if (await banner.isVisible().catch(() => false)) {
        const rejectButton = page.locator('#cookieRejectBtn');
        if (await rejectButton.isVisible().catch(() => false)) {
            await rejectButton.click();
            await expect(banner).toBeHidden();
        }
    }
}

async function getTrackedEvents(page) {
    return page.evaluate(() => {
        const dl = Array.isArray(window.dataLayer) ? window.dataLayer : [];
        return dl
            .filter(
                (item) =>
                    item &&
                    typeof item === 'object' &&
                    typeof item.event === 'string'
            )
            .map((item) => ({ ...item }));
    });
}

async function getFunnelEvents(page) {
    return page.evaluate(() => {
        const events = Array.isArray(window.__funnelEventsCaptured)
            ? window.__funnelEventsCaptured
            : [];
        return events.map((item) => ({
            ...item,
            params:
                item && item.params && typeof item.params === 'object'
                    ? { ...item.params }
                    : item && item.params,
        }));
    });
}

async function fillBookingFormAndOpenPayment(page) {
    await page.waitForSelector('script[data-data-bundle="true"]', {
        timeout: 10000,
        state: 'attached',
    });

    // Scroll to trigger lazy loading if needed
    const bookingSection = page.locator('#citas');
    await bookingSection.scrollIntoViewIfNeeded();

    // Trigger focusin to force-start warmup if observer is slow
    await page.evaluate(() => {
        const form = document.getElementById('appointmentForm');
        if (form) form.dispatchEvent(new Event('focusin', { bubbles: true }));

        // Force load explicitly if warmup is delayed
        if (window.PielBookingEngine && typeof window.PielBookingEngine.loadBookingUi === 'function') {
             window.PielBookingEngine.loadBookingUi();
        } else if (window.loadDeferredModule) {
             // Fallback if main bundle not fully exposed globally
             const event = new Event('pointerdown');
             window.dispatchEvent(event);
        }
    });

    await page.waitForSelector('script[data-booking-ui="true"]', {
        timeout: 10000,
        state: 'attached',
    });

    const serviceSelect = page.locator('select[name="service"]');
    await serviceSelect.selectOption('consulta');

    const doctorSelect = page.locator('select[name="doctor"]');
    await doctorSelect.selectOption('rosero');

    const dateInput = page.locator('input[name="date"]');
    const target = new Date();
    target.setDate(target.getDate() + 7);
    const dateValue = target.toISOString().split('T')[0];

    // Fill triggers change event, which triggers updateAvailableTimes
    // We capture the request to ensure we wait for it
    await Promise.all([
        // eslint-disable-next-line playwright/missing-playwright-await
        page.waitForResponse(
            resp => resp.url().includes('booked-slots') && resp.status() === 200,
            { timeout: 5000 }
        ).catch(() => null),
        dateInput.fill(dateValue)
    ]);

    // Select the first available option
    const timeSelect = page.locator('select[name="time"]');
    await timeSelect.selectOption({ index: 1 });

    const nameInput = page.locator('input[name="name"]');
    await nameInput.fill('Paciente Test Tracking');
    await nameInput.blur();

    const emailInput = page.locator('input[name="email"]');
    await emailInput.fill('tracking-test@example.com');
    await emailInput.blur();

    const phoneInput = page.locator('input[name="phone"]');
    await phoneInput.fill('+593999999999');
    await phoneInput.blur();

    await page
        .locator('textarea[name="reason"]')
        .fill('Control dermatologico de prueba');
    await page.locator('textarea[name="reason"]').blur();

    await page.locator('input[name="privacyConsent"]').check();

    // Ensure button is clickable and visible before interaction
    const submitBtn = page.locator('#appointmentForm button[type="submit"]');
    await submitBtn.scrollIntoViewIfNeeded();
    await expect(submitBtn).toBeVisible();
    await submitBtn.click();

    // Wait for animation/modal open with more leniency for CI
    await page.waitForTimeout(1500);

    // Wait for modal to become active
    await page.waitForSelector('#paymentModal.active', { timeout: 45000 });
    await page.waitForTimeout(250);
}

test.describe('Tracking del embudo de conversion', () => {
    test.beforeEach(async ({ page }) => {
        page.on('console', msg => {
            if (msg.type() === 'error') {
                console.log(`[Browser Console Error] ${msg.text()}`);
            }
        });
        page.on('pageerror', err => {
            console.log(`[Browser Page Error] ${err.message}`);
        });

        await page.addInitScript(() => {
            localStorage.setItem(
                'pa_cookie_consent_v1',
                JSON.stringify({
                    status: 'rejected',
                    at: new Date().toISOString(),
                })
            );
        });
        await page.addInitScript(() => {
            window.__funnelEventsCaptured = [];
            const funnelEndpointMarker = '/api.php?resource=funnel-event';
            const capturePayload = (rawPayload) => {
                if (typeof rawPayload !== 'string' || rawPayload.trim() === '')
                    return;
                try {
                    const parsed = JSON.parse(rawPayload);
                    if (parsed && typeof parsed === 'object') {
                        window.__funnelEventsCaptured.push(parsed);
                    }
                } catch {
                    // ignore malformed payloads
                }
            };

            const originalFetch = window.fetch.bind(window);
            window.fetch = function patchedFetch(input, init) {
                const url =
                    typeof input === 'string'
                        ? input
                        : input && typeof input.url === 'string'
                          ? input.url
                          : '';

                if (url.includes(funnelEndpointMarker)) {
                    if (init && typeof init.body === 'string') {
                        capturePayload(init.body);
                    }
                    return Promise.resolve(
                        new Response(
                            JSON.stringify({ ok: true, recorded: true }),
                            {
                                status: 202,
                                headers: {
                                    'Content-Type':
                                        'application/json; charset=utf-8',
                                },
                            }
                        )
                    );
                }

                return originalFetch(input, init);
            };

            const originalSendBeacon =
                typeof navigator.sendBeacon === 'function'
                    ? navigator.sendBeacon.bind(navigator)
                    : null;
            navigator.sendBeacon = function patchedSendBeacon(url, data) {
                const targetUrl = String(url || '');
                if (targetUrl.includes(funnelEndpointMarker)) {
                    try {
                        if (typeof data === 'string') {
                            capturePayload(data);
                        } else if (data && typeof data.text === 'function') {
                            data.text()
                                .then(capturePayload)
                                .catch(() => undefined);
                        }
                    } catch {
                        // ignore capture failures
                    }
                    return true;
                }

                if (originalSendBeacon) {
                    return originalSendBeacon(url, data);
                }
                return false;
            };
        });
        await mockApi(page);
        await page.goto('/');
        await dismissCookieBannerIfVisible(page);
    });

    test('emite eventos de pasos y start_checkout en reserva web', async ({
        page,
    }) => {
        await fillBookingFormAndOpenPayment(page);
        const events = await getTrackedEvents(page);
        const funnelEvents = await getFunnelEvents(page);

        expect(events).toEqual(
            expect.arrayContaining([
                expect.objectContaining({
                    event: 'booking_step_completed',
                    step: 'service_selected',
                    source: 'booking_form',
                }),
                expect.objectContaining({
                    event: 'booking_step_completed',
                    step: 'form_submitted',
                    source: 'booking_form',
                }),
                expect.objectContaining({
                    event: 'start_checkout',
                    checkout_entry: 'booking_form',
                }),
            ])
        );

        expect(funnelEvents).toEqual(
            expect.arrayContaining([
                expect.objectContaining({
                    event: 'booking_step_completed',
                    params: expect.objectContaining({
                        step: 'service_selected',
                        source: 'booking_form',
                    }),
                }),
                expect.objectContaining({
                    event: 'booking_step_completed',
                    params: expect.objectContaining({
                        step: 'form_submitted',
                        source: 'booking_form',
                    }),
                }),
                expect.objectContaining({
                    event: 'start_checkout',
                    params: expect.objectContaining({
                        checkout_entry: 'booking_form',
                    }),
                }),
            ])
        );
    });

    test('emite checkout_abandon con paso y origen al cerrar modal', async ({
        page,
    }) => {
        await fillBookingFormAndOpenPayment(page);
        await page
            .locator('#paymentModal [data-action="close-payment-modal"]')
            .click();
        await expect
            .poll(
                async () =>
                    page.evaluate(() => {
                        const modal = document.getElementById('paymentModal');
                        return !!(modal && modal.classList.contains('active'));
                    }),
                {
                    timeout: 10000,
                }
            )
            .toBe(false);
        await page.waitForTimeout(250);

        const events = await getTrackedEvents(page);
        const funnelEvents = await getFunnelEvents(page);
        const abandonEvent = events.find(
            (item) => item.event === 'checkout_abandon'
        );
        const abandonFunnelEvent = funnelEvents.find(
            (item) => item && item.event === 'checkout_abandon'
        );

        expect(abandonEvent).toBeTruthy();
        expect(abandonEvent.checkout_step).toBe('payment_modal_closed');
        expect(abandonEvent.checkout_entry).toBe('booking_form');
        expect(abandonEvent.reason).toBe('modal_close');
        expect(abandonFunnelEvent).toBeTruthy();
        expect(
            abandonFunnelEvent.params.checkout_step ||
                abandonFunnelEvent.params.step
        ).toBe('payment_modal_closed');
        expect(abandonFunnelEvent.params.checkout_entry).toBe('booking_form');
        expect(abandonFunnelEvent.params.reason).toBe('modal_close');
    });

    test('emite chat_started y paso inicial al iniciar reserva desde chatbot', async ({
        page,
    }) => {
        await page.waitForSelector('script[data-data-bundle="true"]', {
            timeout: 10000,
            state: 'attached',
        });
        await page.locator('#chatbotWidget .chatbot-toggle').click();
        await expect
            .poll(
                async () =>
                    page.evaluate(() => {
                        const container =
                            document.getElementById('chatbotContainer');
                        return !!(
                            container && container.classList.contains('active')
                        );
                    }),
                {
                    timeout: 10000,
                }
            )
            .toBe(true);
        await page
            .locator(
                '#quickOptions [data-action="quick-message"][data-value="appointment"]'
            )
            .click();
        await page.waitForTimeout(600);

        const events = await getTrackedEvents(page);
        const funnelEvents = await getFunnelEvents(page);

        expect(events).toEqual(
            expect.arrayContaining([
                expect.objectContaining({
                    event: 'chat_started',
                }),
                expect.objectContaining({
                    event: 'booking_step_completed',
                    step: 'chat_booking_started',
                    source: 'chatbot',
                }),
            ])
        );

        expect(funnelEvents).toEqual(
            expect.arrayContaining([
                expect.objectContaining({
                    event: 'chat_started',
                }),
                expect.objectContaining({
                    event: 'booking_step_completed',
                    params: expect.objectContaining({
                        step: 'chat_booking_started',
                        source: 'chatbot',
                    }),
                }),
            ])
        );
    });
});
