// @ts-check
const { test, expect } = require('@playwright/test');
const fs = require('node:fs');
const path = require('node:path');
const { gotoPublicRoute, waitForBookingHooks } = require('./helpers/public-v3');

const catalogPath = path.resolve(
    __dirname,
    '..',
    'content',
    'public-v5',
    'catalog.json'
);
const catalog = JSON.parse(fs.readFileSync(catalogPath, 'utf8'));

const bookingById = new Map(
    (Array.isArray(catalog.booking_options) ? catalog.booking_options : []).map(
        (option) => [String(option.id || '').trim(), option]
    )
);

const CASES = [
    {
        locale: 'es',
        route: '/es/servicios/acne-rosacea/',
        serviceHint: 'acne',
        mustIncludePriceToken: 'IVA',
        mustExcludePriceToken: 'Tax',
        forbiddenPattern:
            /\badults?\b|\bseniors?\b|\bchildren\b|\bteenagers?\b/i,
    },
    {
        locale: 'es',
        route: '/es/servicios/laser-dermatologico/',
        serviceHint: 'laser',
        mustIncludePriceToken: 'IVA',
        mustExcludePriceToken: 'Tax',
        forbiddenPattern:
            /\badults?\b|\bseniors?\b|\bchildren\b|\bteenagers?\b/i,
    },
    {
        locale: 'en',
        route: '/en/services/acne-rosacea/',
        serviceHint: 'acne',
        mustIncludePriceToken: 'Tax',
        mustExcludePriceToken: 'IVA',
        forbiddenPattern:
            /\badultos\b|\bninos\b|\badolescentes\b|\badultos mayores\b/i,
    },
    {
        locale: 'en',
        route: '/en/services/botox/',
        serviceHint: 'rejuvenecimiento',
        mustIncludePriceToken: 'Tax',
        mustExcludePriceToken: 'IVA',
        forbiddenPattern:
            /\badultos\b|\bninos\b|\badolescentes\b|\badultos mayores\b/i,
    },
];

function expectedShortLabel(option, locale) {
    const base = Number(option.base_price_usd || 0);
    const taxRate = Number(option.tax_rate || 0);
    const taxPercent = Math.round(taxRate * 100);
    if (locale === 'en') {
        return (
            String(option.price_label_short_en || '').trim() ||
            `USD ${base.toFixed(2)} + Tax ${taxPercent}%`
        );
    }
    return (
        String(option.price_label_short_es || '').trim() ||
        String(option.price_label_short || '').trim() ||
        `USD ${base.toFixed(2)} + IVA ${taxPercent}%`
    );
}

function expectedDisclaimer(option, locale) {
    if (locale === 'en') {
        return (
            String(option.price_disclaimer_en || '').trim() ||
            'Final amount is confirmed before payment authorization.'
        );
    }
    return (
        String(option.price_disclaimer_es || '').trim() ||
        'El valor final se confirma antes de autorizar el pago.'
    );
}

function expectedTotal(option) {
    const base = Number(option.base_price_usd || 0);
    const taxRate = Number(option.tax_rate || 0);
    return Number((base * (1 + taxRate)).toFixed(2));
}

function parseCurrency(value) {
    const numeric = Number(
        String(value || '')
            .replace(/[^0-9.]/g, '')
            .trim()
    );
    return Number.isFinite(numeric) ? numeric : 0;
}

test.describe('Public V5 pricing + localization parity', () => {
    for (const item of CASES) {
        test(`${item.locale.toUpperCase()} ${item.route} keeps pricing parity and localized labels`, async ({
            page,
        }) => {
            const bookingOption = bookingById.get(item.serviceHint);
            expect(
                bookingOption,
                `booking option not found for hint ${item.serviceHint}`
            ).toBeTruthy();

            const expectedLabel = expectedShortLabel(
                bookingOption,
                item.locale
            );
            const expectedNote = expectedDisclaimer(bookingOption, item.locale);
            const expectedBase = Number(bookingOption.base_price_usd || 0);
            const expectedTaxRate = Number(bookingOption.tax_rate || 0);
            const expectedTaxAmount = Number(
                (expectedBase * expectedTaxRate).toFixed(2)
            );
            const expectedGrandTotal = expectedTotal(bookingOption);

            await gotoPublicRoute(page, item.route);
            await waitForBookingHooks(page, item.serviceHint);

            const snapshot = await page.evaluate(() => {
                const select = document.getElementById('v5-service-select');
                const selected =
                    select instanceof HTMLSelectElement
                        ? select.options[select.selectedIndex]
                        : null;
                const fitText =
                    document.querySelector('.sony-service-fit')?.textContent ||
                    '';
                const heroPrice =
                    document
                        .querySelector(
                            '.sony-service-hero__meta span:last-child'
                        )
                        ?.textContent?.trim() || '';

                const toText = (id) =>
                    String(
                        document.getElementById(id)?.textContent || ''
                    ).trim();

                return {
                    selectedValue: selected
                        ? String(selected.value || '').trim()
                        : '',
                    selectedBase: selected
                        ? Number(selected.dataset.price || 0)
                        : -1,
                    selectedTax: selected
                        ? Number(selected.dataset.serviceTax || 0)
                        : -1,
                    selectedTotal: selected
                        ? Number(selected.dataset.priceTotal || 0)
                        : -1,
                    selectedLabel: selected
                        ? String(selected.dataset.priceLabelShort || '').trim()
                        : '',
                    selectedDisclaimer: selected
                        ? String(selected.dataset.priceDisclaimer || '').trim()
                        : '',
                    modelLabel: toText('selectedPriceLabel'),
                    modelDisclaimer: toText('selectedPriceDisclaimer'),
                    subtotalLabel: toText('subtotalPrice'),
                    ivaLabel: toText('ivaPrice'),
                    totalLabel: toText('totalPrice'),
                    heroPrice,
                    fitText: String(fitText || ''),
                };
            });

            expect(snapshot.selectedValue).toBe(item.serviceHint);
            expect(snapshot.selectedBase).toBeCloseTo(expectedBase, 6);
            expect(snapshot.selectedTax).toBeCloseTo(expectedTaxRate, 6);
            expect(snapshot.selectedTotal).toBeCloseTo(expectedGrandTotal, 6);
            expect(snapshot.selectedLabel).toBe(expectedLabel);
            expect(snapshot.selectedDisclaimer).toBe(expectedNote);
            expect(snapshot.modelLabel).toBe(expectedLabel);
            expect(snapshot.modelDisclaimer).toBe(expectedNote);
            expect(snapshot.heroPrice).toBe(expectedLabel);

            expect(
                snapshot.heroPrice.includes(item.mustIncludePriceToken)
            ).toBeTruthy();
            expect(
                snapshot.heroPrice.includes(item.mustExcludePriceToken)
            ).toBeFalsy();
            expect(item.forbiddenPattern.test(snapshot.fitText)).toBeFalsy();

            expect(parseCurrency(snapshot.subtotalLabel)).toBeCloseTo(
                expectedBase,
                2
            );
            expect(parseCurrency(snapshot.ivaLabel)).toBeCloseTo(
                expectedTaxAmount,
                2
            );
            expect(parseCurrency(snapshot.totalLabel)).toBeCloseTo(
                expectedGrandTotal,
                2
            );

            expect(snapshot.subtotalLabel.startsWith('$$')).toBeFalsy();
            expect(snapshot.ivaLabel.startsWith('$$')).toBeFalsy();
            expect(snapshot.totalLabel.startsWith('$$')).toBeFalsy();
        });
    }
});
