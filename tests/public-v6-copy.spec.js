// @ts-check
const { test, expect } = require('@playwright/test');
const {
    gotoPublicRoute,
    waitForBookingStatus,
} = require('./helpers/public-v6');

const prohibited = [
    /garantizado/i,
    /100%/i,
    /cura definitiva/i,
    /sin riesgos/i,
    /guaranteed/i,
    /definitive cure/i,
    /risk[- ]free/i,
];
const roboticPhrases = [
    /protocolo,\s*evidencia\s*y\s*seguimiento/i,
    /nunca promesas vacias/i,
    /bloque corporativo/i,
    /v6 recalibration/i,
    /corporate block/i,
    /agenda transaccional en actualizacion/i,
    /transactional schedule in update/i,
    /respuesta de referencia/i,
    /reference answer/i,
];

test.describe('Public V6 copy integrity', () => {
    test('ES routes keep usted register and avoid prohibited claims', async ({
        page,
    }) => {
        for (const route of ['/es/', '/es/servicios/', '/es/telemedicina/']) {
            await gotoPublicRoute(page, route);
            await waitForBookingStatus(page, 'Reserva online en mantenimiento');
            const text = await page.locator('body').innerText();
            expect(text.toLowerCase()).toContain('usted');
            expect(text.toLowerCase()).toContain('telemedicina');
            expect(text.toLowerCase()).toContain(
                'reserva online en mantenimiento'
            );
            prohibited.forEach((pattern) => {
                expect(text).not.toMatch(pattern);
            });
            roboticPhrases.forEach((pattern) => {
                expect(text).not.toMatch(pattern);
            });
        }
    });

    test('EN routes avoid Spanish leakage and prohibited claims', async ({
        page,
    }) => {
        for (const route of ['/en/', '/en/services/', '/en/telemedicine/']) {
            await gotoPublicRoute(page, route);
            await waitForBookingStatus(
                page,
                'Online booking under maintenance'
            );
            const text = await page.locator('body').innerText();
            expect(text.toLowerCase()).toContain('telemedicine');
            expect(text.toLowerCase()).toContain(
                'online booking under maintenance'
            );
            expect(text.toLowerCase()).not.toContain(' usted ');
            prohibited.forEach((pattern) => {
                expect(text).not.toMatch(pattern);
            });
            roboticPhrases.forEach((pattern) => {
                expect(text).not.toMatch(pattern);
            });
        }
    });

    test('service FAQs expose explicit answers in ES and EN', async ({
        page,
    }) => {
        const checks = [
            {
                route: '/es/servicios/diagnostico-integral/',
                forbidden: /respuesta de referencia/i,
                required: /senal de alarma|consulta/i,
            },
            {
                route: '/en/services/diagnostico-integral/',
                forbidden: /reference answer/i,
                required: /warning signs|consultation/i,
            },
        ];

        for (const check of checks) {
            await gotoPublicRoute(page, check.route);
            const answers = page.locator('.v6-service-faq-grid article small');
            await expect(answers).toHaveCount(3);
            const firstAnswer = (await answers.first().innerText()).trim();
            expect(firstAnswer.length).toBeGreaterThan(40);
            expect(firstAnswer).not.toMatch(check.forbidden);

            const bodyText = await page.locator('body').innerText();
            expect(bodyText).toMatch(check.required);
        }
    });
});
