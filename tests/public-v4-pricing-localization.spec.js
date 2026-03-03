// @ts-check
const { test, expect } = require('@playwright/test');
const fs = require('node:fs');
const path = require('node:path');
const { gotoPublicRoute, waitForBookingHooks } = require('./helpers/public-v3');

const catalogPath = path.resolve(
    __dirname,
    '..',
    'content',
    'public-v4',
    'catalog.json'
);
const catalog = JSON.parse(fs.readFileSync(catalogPath, 'utf8'));

const serviceBySlug = new Map(
    (Array.isArray(catalog.services) ? catalog.services : []).map((service) => [
        String(service.slug || ''),
        service,
    ])
);
const bookingById = new Map(
    (Array.isArray(catalog.booking_options) ? catalog.booking_options : []).map(
        (option) => [String(option.id || ''), option]
    )
);

const CASES = [
    {
        locale: 'es',
        route: '/es/servicios/acne-rosacea/',
        slug: 'acne-rosacea',
        mustIncludePriceToken: 'IVA',
        mustExcludePriceToken: 'Tax',
        forbiddenStoryPattern:
            /\badults?\b|\bseniors?\b|\bchildren\b|\bteenagers?\b/i,
    },
    {
        locale: 'es',
        route: '/es/servicios/laser-dermatologico/',
        slug: 'laser-dermatologico',
        mustIncludePriceToken: 'IVA',
        mustExcludePriceToken: 'Tax',
        forbiddenStoryPattern:
            /\badults?\b|\bseniors?\b|\bchildren\b|\bteenagers?\b/i,
    },
    {
        locale: 'en',
        route: '/en/services/acne-rosacea/',
        slug: 'acne-rosacea',
        mustIncludePriceToken: 'Tax',
        mustExcludePriceToken: 'IVA',
        forbiddenStoryPattern:
            /\badultos\b|\bninos\b|\badolescentes\b|\badultos mayores\b/i,
    },
    {
        locale: 'en',
        route: '/en/services/botox/',
        slug: 'botox',
        mustIncludePriceToken: 'Tax',
        mustExcludePriceToken: 'IVA',
        forbiddenStoryPattern:
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

function expectedHeroAlt(service, locale) {
    if (locale === 'en') {
        return String(service?.media?.alt_en || '').trim();
    }
    return String(service?.media?.alt_es || '').trim();
}

function expectedPolicyPath(locale) {
    if (locale === 'en') {
        return '/en/legal/terms/#cancellations';
    }
    return '/es/legal/terminos/#cancelaciones';
}

test.describe('Public V4 pricing + localization parity', () => {
    for (const item of CASES) {
        test(`${item.locale.toUpperCase()} ${item.slug} keeps pricing and localized labels aligned`, async ({
            page,
        }) => {
            const service = serviceBySlug.get(item.slug);
            expect(
                service,
                `service not found in catalog for ${item.slug}`
            ).toBeTruthy();
            const serviceHint = String(service?.cta?.service_hint || '').trim();
            const bookingOption = bookingById.get(serviceHint);
            expect(
                bookingOption,
                `booking option not found for hint ${serviceHint} (${item.slug})`
            ).toBeTruthy();

            const expectedLabel = expectedShortLabel(
                bookingOption,
                item.locale
            );
            const expectedNote = expectedDisclaimer(bookingOption, item.locale);
            const expectedTax = Number(bookingOption.tax_rate || 0);
            const expectedBase = Number(bookingOption.base_price_usd || 0);
            const expectedGrandTotal = expectedTotal(bookingOption);
            const expectedHeroMediaSrc = String(
                service?.media?.src || ''
            ).trim();
            const expectedHeroMediaAlt = expectedHeroAlt(service, item.locale);
            const expectedPolicyHref = expectedPolicyPath(item.locale);

            await gotoPublicRoute(page, item.route);
            await waitForBookingHooks(page, serviceHint);

            const snapshot = await page.evaluate(() => {
                const select = document.getElementById('serviceSelect');
                const selected =
                    select instanceof HTMLSelectElement
                        ? select.options[select.selectedIndex]
                        : null;
                const heroPrice = document
                    .querySelector('.sony-service-hero__meta span:last-child')
                    ?.textContent?.trim();
                const storyText =
                    document.querySelector('.sony-service-fit')?.textContent ||
                    '';
                const heroMediaImage = document.querySelector(
                    '.sony-service-hero__media img'
                );
                const companionWhatsApp = document.querySelector(
                    '[data-entry-surface="booking_companion_whatsapp"]'
                );
                const pricingPolicy = document.querySelector(
                    '[data-entry-surface="booking_pricing_policy"]'
                );
                const assurance = document.querySelector(
                    '[data-booking-assurance]'
                );

                return {
                    value: selected ? String(selected.value || '').trim() : '',
                    base: selected ? Number(selected.dataset.price || 0) : -1,
                    tax: selected
                        ? Number(selected.dataset.serviceTax || 0)
                        : -1,
                    total: selected
                        ? Number(selected.dataset.priceTotal || 0)
                        : -1,
                    optionLabelShort: selected
                        ? String(selected.dataset.priceLabelShort || '').trim()
                        : '',
                    optionDisclaimer: selected
                        ? String(selected.dataset.priceDisclaimer || '').trim()
                        : '',
                    modelLabel:
                        document
                            .getElementById('selectedPriceLabel')
                            ?.textContent?.trim() || '',
                    modelDisclaimer:
                        document
                            .getElementById('selectedPriceDisclaimer')
                            ?.textContent?.trim() || '',
                    heroPrice: String(heroPrice || '').trim(),
                    storyText: String(storyText || ''),
                    heroMediaSrc: heroMediaImage
                        ? String(
                              heroMediaImage.getAttribute('src') || ''
                          ).trim()
                        : '',
                    heroMediaAlt: heroMediaImage
                        ? String(
                              heroMediaImage.getAttribute('alt') || ''
                          ).trim()
                        : '',
                    companionWhatsAppIntent: companionWhatsApp
                        ? String(
                              companionWhatsApp.getAttribute(
                                  'data-service-intent'
                              ) || ''
                          ).trim()
                        : '',
                    companionWhatsAppHint: companionWhatsApp
                        ? String(
                              companionWhatsApp.getAttribute(
                                  'data-booking-hint'
                              ) || ''
                          ).trim()
                        : '',
                    pricingPolicyHref: pricingPolicy
                        ? String(
                              pricingPolicy.getAttribute('href') || ''
                          ).trim()
                        : '',
                    hasBookingAssurance: Boolean(assurance),
                };
            });

            expect(snapshot.value).toBe(serviceHint);
            expect(snapshot.base).toBeCloseTo(expectedBase, 6);
            expect(snapshot.tax).toBeCloseTo(expectedTax, 6);
            expect(snapshot.total).toBeCloseTo(expectedGrandTotal, 6);
            expect(snapshot.optionLabelShort).toBe(expectedLabel);
            expect(snapshot.optionDisclaimer).toBe(expectedNote);
            expect(snapshot.modelLabel).toBe(expectedLabel);
            expect(snapshot.modelDisclaimer).toBe(expectedNote);
            expect(snapshot.heroPrice).toBe(expectedLabel);

            expect(
                snapshot.heroPrice.includes(item.mustIncludePriceToken)
            ).toBeTruthy();
            expect(
                snapshot.heroPrice.includes(item.mustExcludePriceToken)
            ).toBeFalsy();
            expect(
                item.forbiddenStoryPattern.test(snapshot.storyText)
            ).toBeFalsy();
            expect(snapshot.heroMediaSrc).toBe(expectedHeroMediaSrc);
            expect(snapshot.heroMediaAlt).toBe(expectedHeroMediaAlt);
            expect(snapshot.companionWhatsAppIntent).toBe('remote');
            expect(snapshot.companionWhatsAppHint).toBe(serviceHint);
            expect(snapshot.pricingPolicyHref).toBe(expectedPolicyHref);
            expect(snapshot.hasBookingAssurance).toBeTruthy();
        });
    }
});
