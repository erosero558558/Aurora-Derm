// @ts-check
const { test, expect } = require('@playwright/test');
const { skipIfPhpRuntimeMissing } = require('./helpers/php-backend');

function requireGoogleCalendar() {
    return (
        String(process.env.TEST_REQUIRE_GOOGLE_CALENDAR || 'false')
            .toLowerCase()
            .trim() === 'true'
    );
}

function assertCalendarMeta(meta, expectedService, expectedDoctor, expectedDuration) {
    expect(meta).toBeTruthy();
    expect(typeof meta).toBe('object');

    expect(meta).toHaveProperty('source');
    expect(meta).toHaveProperty('mode');
    expect(meta).toHaveProperty('timezone');
    expect(meta).toHaveProperty('doctor');
    expect(meta).toHaveProperty('service');
    expect(meta).toHaveProperty('durationMin');
    expect(meta).toHaveProperty('generatedAt');

    expect(meta.source).toBe('google');
    expect(['live', 'blocked']).toContain(String(meta.mode));
    expect(typeof meta.timezone).toBe('string');
    expect(meta.timezone.length).toBeGreaterThan(0);
    expect(meta.doctor).toBe(expectedDoctor);
    expect(meta.service).toBe(expectedService);
    expect(Number(meta.durationMin)).toBe(expectedDuration);
    expect(typeof meta.generatedAt).toBe('string');
    expect(meta.generatedAt.length).toBeGreaterThan(0);
}

async function getHealthPayload(request) {
    const response = await request.get('/api.php?resource=health');
    expect(response.ok()).toBeTruthy();
    const body = await response.json();
    expect(body.ok).toBe(true);
    return body;
}

function enforceOrSkipGoogleMode(testInfo, health) {
    const googleActive = String(health.calendarSource) === 'google';
    if (requireGoogleCalendar()) {
        expect(
            googleActive,
            'TEST_REQUIRE_GOOGLE_CALENDAR=true pero health.calendarSource != google'
        ).toBe(true);
        return;
    }

    testInfo.skip(!googleActive, 'La fuente de agenda no es Google en este entorno.');
}

test.describe('Google Calendar contract', () => {
    test('health exposes extended calendar state', async ({ request }) => {
        await skipIfPhpRuntimeMissing(test, request);
        const body = await getHealthPayload(request);

        expect(body).toHaveProperty('calendarConfigured');
        expect(body).toHaveProperty('calendarReachable');
        expect(body).toHaveProperty('calendarMode');
        expect(body).toHaveProperty('calendarSource');
        expect(body).toHaveProperty('calendarAuth');
        expect(body).toHaveProperty('calendarTokenHealthy');
        expect(body).toHaveProperty('calendarLastSuccessAt');
        expect(body).toHaveProperty('calendarLastErrorAt');
        expect(body).toHaveProperty('calendarLastErrorReason');

        expect(['store', 'google']).toContain(String(body.calendarSource));
        expect(['live', 'blocked']).toContain(String(body.calendarMode));
        expect(['none', 'service_account', 'oauth_refresh']).toContain(
            String(body.calendarAuth)
        );
        expect(typeof body.calendarTokenHealthy).toBe('boolean');
    });

    test('availability keeps calendar contract with service and doctor', async (
        { request },
        testInfo
    ) => {
        await skipIfPhpRuntimeMissing(test, request);
        const health = await getHealthPayload(request);
        enforceOrSkipGoogleMode(testInfo, health);

        const consultaResponse = await request.get(
            '/api.php?resource=availability&doctor=indiferente&service=consulta&days=7'
        );
        const consultaStatus = consultaResponse.status();
        const consultaBody = await consultaResponse.json();

        expect([200, 503]).toContain(consultaStatus);
        assertCalendarMeta(consultaBody.meta, 'consulta', 'indiferente', 30);

        if (consultaStatus === 503) {
            expect(consultaBody.ok).toBe(false);
            expect(consultaBody.code).toBe('calendar_unreachable');
        } else {
            expect(consultaBody.ok).toBe(true);
            expect(typeof consultaBody.data).toBe('object');
            expect(consultaBody.data).not.toBeNull();
        }

        const laserResponse = await request.get(
            '/api.php?resource=availability&doctor=indiferente&service=laser&days=7'
        );
        const laserStatus = laserResponse.status();
        const laserBody = await laserResponse.json();

        expect([200, 503]).toContain(laserStatus);
        assertCalendarMeta(laserBody.meta, 'laser', 'indiferente', 60);

        if (laserStatus === 503) {
            expect(laserBody.ok).toBe(false);
            expect(laserBody.code).toBe('calendar_unreachable');
        } else {
            expect(laserBody.ok).toBe(true);
            expect(typeof laserBody.data).toBe('object');
            expect(laserBody.data).not.toBeNull();
        }
    });

    test('booked-slots includes calendar metadata by service and doctor', async (
        { request },
        testInfo
    ) => {
        await skipIfPhpRuntimeMissing(test, request);
        const health = await getHealthPayload(request);
        enforceOrSkipGoogleMode(testInfo, health);

        const today = new Date().toISOString().split('T')[0];
        const response = await request.get(
            `/api.php?resource=booked-slots&date=${today}&doctor=indiferente&service=consulta`
        );
        const status = response.status();
        const body = await response.json();

        expect([200, 503]).toContain(status);
        assertCalendarMeta(body.meta, 'consulta', 'indiferente', 30);

        if (status === 503) {
            expect(body.ok).toBe(false);
            expect(body.code).toBe('calendar_unreachable');
            return;
        }

        expect(body.ok).toBe(true);
        expect(Array.isArray(body.data)).toBe(true);
    });
});
