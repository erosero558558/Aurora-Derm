// @ts-check
const { test, expect } = require('@playwright/test');
const { gotoPublicRoute } = require('./helpers/public-v3');

const FORBIDDEN_PHRASES = [
    'garantizado',
    '100%',
    'cura definitiva',
    'sin riesgos',
    'guaranteed',
    'definitive cure',
    'risk-free',
];

const TECHNICAL_TOKENS = [' bridge ', ' runtime ', ' shell ', ' v3 ', ' v4 '];

const ES_TUTEO_TOKENS = [
    ' tu ',
    ' tus ',
    ' puedes ',
    ' elige ',
    ' haz ',
    ' agenda tu ',
    ' dependas ',
];
const ES_MIXED_TOKENS = [' adults ', ' seniors ', ' children ', ' teenagers '];
const EN_MIXED_TOKENS = [
    ' adultos ',
    ' ninos ',
    ' niños ',
    ' adolescentes ',
    ' adultos mayores ',
];

function normalizeText(input) {
    return ` ${String(input || '')
        .toLowerCase()
        .replace(/\s+/g, ' ')
        .trim()} `;
}

test.describe('Public V5 copy regression', () => {
    test('ES surface keeps formal clinical copy without forbidden claims', async ({
        page,
    }) => {
        const routes = [
            '/es/',
            '/es/servicios/',
            '/es/servicios/diagnostico-integral/',
            '/es/telemedicina/',
            '/es/legal/terminos/',
        ];

        for (const route of routes) {
            await gotoPublicRoute(page, route);
            const bodyText = normalizeText(
                await page.locator('main').innerText()
            );

            for (const phrase of FORBIDDEN_PHRASES) {
                expect(bodyText.includes(phrase)).toBeFalsy();
            }
            for (const token of TECHNICAL_TOKENS) {
                expect(bodyText.includes(token)).toBeFalsy();
            }
            for (const token of ES_TUTEO_TOKENS) {
                expect(bodyText.includes(token)).toBeFalsy();
            }
            for (const token of ES_MIXED_TOKENS) {
                expect(bodyText.includes(token)).toBeFalsy();
            }
        }
    });

    test('EN surface keeps transcreated medical copy without mixed ES spill', async ({
        page,
    }) => {
        const routes = [
            '/en/',
            '/en/services/',
            '/en/services/diagnostico-integral/',
            '/en/telemedicine/',
            '/en/legal/terms/',
        ];

        for (const route of routes) {
            await gotoPublicRoute(page, route);
            const bodyText = normalizeText(
                await page.locator('main').innerText()
            );

            for (const phrase of FORBIDDEN_PHRASES) {
                expect(bodyText.includes(phrase)).toBeFalsy();
            }
            for (const token of TECHNICAL_TOKENS) {
                expect(bodyText.includes(token)).toBeFalsy();
            }
            for (const token of EN_MIXED_TOKENS) {
                expect(bodyText.includes(token)).toBeFalsy();
            }
        }
    });
});
