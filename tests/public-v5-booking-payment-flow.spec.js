// @ts-check
const { test, expect } = require('@playwright/test');
const { gotoPublicRoute, waitForBookingHooks } = require('./helpers/public-v3');

const CASES = [
    {
        locale: 'es',
        route: '/es/servicios/acne-rosacea/#citas',
        serviceHint: 'acne',
        totalLabel: 'Total a pagar:',
    },
    {
        locale: 'en',
        route: '/en/services/acne-rosacea/#citas',
        serviceHint: 'acne',
        totalLabel: 'Total to pay:',
    },
];

function parseCurrency(value) {
    const numeric = Number(String(value || '').replace(/[^0-9.]/g, ''));
    return Number.isFinite(numeric) ? numeric : 0;
}

async function waitForRuntimeBridgeScript(page) {
    await expect
        .poll(
            () =>
                page.evaluate(() =>
                    Boolean(
                        document.querySelector(
                            'script[data-public-v5-src="/script.js?v=public-v5-bridge"],script[src*="/script.js?v=public-v5-bridge"]'
                        )
                    )
                ),
            { timeout: 20000 }
        )
        .toBeTruthy();
}

test.describe('Public V5 booking/payment contract shell', () => {
    test.beforeEach(async ({ page }) => {
        await page.addInitScript(() => {
            localStorage.setItem(
                'pa_cookie_consent_v1',
                JSON.stringify({
                    status: 'rejected',
                    at: new Date().toISOString(),
                })
            );
        });
    });

    for (const item of CASES) {
        test(`${item.locale.toUpperCase()} keeps booking/payment contract localized and clean`, async ({
            page,
        }) => {
            await gotoPublicRoute(page, item.route);
            await waitForBookingHooks(page, item.serviceHint);
            await waitForRuntimeBridgeScript(page);

            const snapshot = await page.evaluate(() => {
                const text = (selector) =>
                    String(
                        document.querySelector(selector)?.textContent || ''
                    ).trim();
                const totalPrice = text('#totalPrice');
                const modalText = text('#paymentModal');
                const methodValues = Array.from(
                    document.querySelectorAll(
                        '#paymentModal .payment-method[data-method]'
                    )
                )
                    .map((node) =>
                        String(node.getAttribute('data-method') || '')
                    )
                    .filter(Boolean);

                return {
                    totalPrice,
                    modalText,
                    methodValues,
                    modalTotalLabel: text(
                        '#paymentModal .payment-total span:first-child'
                    ),
                    trustItems: document.querySelectorAll(
                        '#paymentModal .payment-trust__list li'
                    ).length,
                    faqItems: document.querySelectorAll(
                        '#paymentModal .payment-faq details'
                    ).length,
                    hasCardForm: Boolean(
                        document.querySelector('#paymentModal .card-form')
                    ),
                    hasTransferForm: Boolean(
                        document.querySelector('#paymentModal .transfer-form')
                    ),
                    hasCashForm: Boolean(
                        document.querySelector('#paymentModal .cash-form')
                    ),
                    hasCloseButton: Boolean(
                        document.querySelector(
                            '#paymentModal [data-action="close-payment-modal"]'
                        )
                    ),
                };
            });

            expect(parseCurrency(snapshot.totalPrice)).toBeGreaterThan(0);
            expect(snapshot.modalTotalLabel).toContain(item.totalLabel);
            expect(snapshot.methodValues.sort()).toEqual([
                'card',
                'cash',
                'transfer',
            ]);
            expect(snapshot.trustItems).toBeGreaterThanOrEqual(3);
            expect(snapshot.faqItems).toBeGreaterThanOrEqual(3);
            expect(snapshot.hasCardForm).toBeTruthy();
            expect(snapshot.hasTransferForm).toBeTruthy();
            expect(snapshot.hasCashForm).toBeTruthy();
            expect(snapshot.hasCloseButton).toBeTruthy();
            expect(snapshot.modalText).not.toMatch(
                /\b(bridge|runtime|shell|v3|v4)\b/i
            );
        });
    }
});
