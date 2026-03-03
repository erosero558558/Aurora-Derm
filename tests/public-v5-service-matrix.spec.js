// @ts-check
const { test, expect } = require('@playwright/test');
const fs = require('node:fs');
const path = require('node:path');
const { gotoPublicRoute, waitForBookingHooks } = require('./helpers/public-v3');

function parseCurrency(value) {
    const numeric = Number(
        String(value || '')
            .replace(/[^0-9.]/g, '')
            .trim()
    );
    return Number.isFinite(numeric) ? numeric : 0;
}

function collectServiceCases() {
    const repoRoot = path.resolve(__dirname, '..');
    const locales = [
        {
            locale: 'es',
            dir: path.join(repoRoot, 'es', 'servicios'),
            routePrefix: '/es/servicios',
            includesToken: 'IVA',
            excludesToken: 'Tax',
            totalLabel: 'Total a pagar:',
            forbiddenPattern:
                /\badults?\b|\bseniors?\b|\bchildren\b|\bteenagers?\b/i,
        },
        {
            locale: 'en',
            dir: path.join(repoRoot, 'en', 'services'),
            routePrefix: '/en/services',
            includesToken: 'Tax',
            excludesToken: 'IVA',
            totalLabel: 'Total to pay:',
            forbiddenPattern:
                /\badultos\b|\bninos\b|\bniños\b|\badolescentes\b|\badultos mayores\b/i,
        },
    ];

    const out = [];
    for (const entry of locales) {
        if (!fs.existsSync(entry.dir)) continue;
        const slugs = fs
            .readdirSync(entry.dir, { withFileTypes: true })
            .filter((item) => item.isDirectory())
            .map((item) => item.name)
            .sort((left, right) => left.localeCompare(right));

        for (const slug of slugs) {
            const staticFile = path.join(entry.dir, slug, 'index.html');
            if (!fs.existsSync(staticFile)) continue;
            out.push({
                ...entry,
                slug,
                route: `${entry.routePrefix}/${slug}/`,
            });
        }
    }

    return out;
}

const SERVICE_CASES = collectServiceCases();

test.describe('Public V5 service matrix parity (all service routes)', () => {
    test('service matrix fixtures are available', async () => {
        expect(SERVICE_CASES.length).toBeGreaterThanOrEqual(20);
    });

    for (const item of SERVICE_CASES) {
        test(`${item.locale.toUpperCase()} ${item.slug} keeps pricing, booking hint and localization parity`, async ({
            page,
        }) => {
            await gotoPublicRoute(page, item.route);

            const bookingCta = page
                .locator('a[data-analytics-event="start_booking_from_service"]')
                .first();
            await expect(bookingCta).toBeVisible();

            const expectedHint = String(
                (await bookingCta.getAttribute('data-booking-hint')) || ''
            ).trim();
            expect(
                expectedHint,
                `missing service hint for ${item.route}`
            ).not.toBe('');

            await waitForBookingHooks(page, expectedHint);

            const snapshot = await page.evaluate(() => {
                const text = (selector) =>
                    String(
                        document.querySelector(selector)?.textContent || ''
                    ).trim();

                const select = document.getElementById('v5-service-select');
                const selected =
                    select instanceof HTMLSelectElement
                        ? select.options[select.selectedIndex]
                        : null;

                return {
                    selectedValue: selected
                        ? String(selected.value || '').trim()
                        : '',
                    selectedPriceLabel: selected
                        ? String(selected.dataset.priceLabelShort || '').trim()
                        : '',
                    selectedDisclaimer: selected
                        ? String(selected.dataset.priceDisclaimer || '').trim()
                        : '',
                    heroPrice: text('.sony-service-hero__meta span:last-child'),
                    fitText: text('.sony-service-fit'),
                    modelPriceLabel: text('#selectedPriceLabel'),
                    modelPriceDisclaimer: text('#selectedPriceDisclaimer'),
                    subtotal: text('#subtotalPrice'),
                    tax: text('#ivaPrice'),
                    total: text('#totalPrice'),
                    modalTotalLabel: text(
                        '#v5-payment-modal .payment-total span:first-child'
                    ),
                    paymentMethods: Array.from(
                        document.querySelectorAll(
                            '#v5-payment-modal .payment-method[data-method]'
                        )
                    )
                        .map((node) =>
                            String(
                                node.getAttribute('data-method') || ''
                            ).trim()
                        )
                        .filter(Boolean),
                };
            });

            expect(snapshot.selectedValue).toBe(expectedHint);
            expect(snapshot.heroPrice).toBe(snapshot.selectedPriceLabel);
            expect(snapshot.modelPriceLabel).toBe(snapshot.selectedPriceLabel);
            expect(snapshot.modelPriceDisclaimer).toBe(
                snapshot.selectedDisclaimer
            );

            expect(
                snapshot.heroPrice.includes(item.includesToken)
            ).toBeTruthy();
            expect(snapshot.heroPrice.includes(item.excludesToken)).toBeFalsy();
            expect(item.forbiddenPattern.test(snapshot.fitText)).toBeFalsy();

            expect(snapshot.subtotal.startsWith('$$')).toBeFalsy();
            expect(snapshot.tax.startsWith('$$')).toBeFalsy();
            expect(snapshot.total.startsWith('$$')).toBeFalsy();
            expect(parseCurrency(snapshot.total)).toBeGreaterThan(0);

            expect(snapshot.modalTotalLabel).toContain(item.totalLabel);
            expect(snapshot.paymentMethods.sort()).toEqual([
                'card',
                'cash',
                'transfer',
            ]);
        });
    }
});
