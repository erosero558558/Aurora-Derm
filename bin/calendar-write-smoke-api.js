#!/usr/bin/env node
'use strict';

const { mkdirSync, writeFileSync } = require('fs');
const { dirname, resolve } = require('path');
const {
    loginAdmin,
    logoutAdmin,
    requestJson,
} = require('./lib/admin-auth-client.js');

function parseStringArg(name, fallback) {
    const prefix = `--${name}=`;
    const arg = process.argv.find((item) => item.startsWith(prefix));
    if (!arg) return fallback;
    const raw = arg.slice(prefix.length).trim();
    return raw === '' ? fallback : raw;
}

function parseIntArg(name, fallback, minValue = 0) {
    const raw = parseStringArg(name, null);
    if (raw === null || raw === undefined) return fallback;
    const parsed = Number.parseInt(raw, 10);
    if (!Number.isFinite(parsed) || parsed < minValue) {
        throw new Error(`Argumento invalido --${name}: ${raw}`);
    }
    return parsed;
}

function parseBoolArg(name, fallback) {
    const raw = parseStringArg(name, null);
    if (raw === null) return fallback;
    const normalized = String(raw).toLowerCase().trim();
    if (['1', 'true', 'yes', 'y', 'on'].includes(normalized)) return true;
    if (['0', 'false', 'no', 'n', 'off'].includes(normalized)) return false;
    throw new Error(`Argumento booleano invalido --${name}: ${raw}`);
}

function hasFlag(name) {
    return process.argv.includes(`--${name}`);
}

function appendGithubOutput(key, value) {
    const outputPath = process.env.GITHUB_OUTPUT;
    if (!outputPath) return;
    writeFileSync(outputPath, `${key}=${value}\n`, {
        encoding: 'utf8',
        flag: 'a',
    });
}

function normalizeBaseUrl(baseUrl) {
    return String(baseUrl || '').replace(/\/+$/, '');
}

function usage() {
    return [
        'Uso: node bin/calendar-write-smoke-api.js [opciones]',
        '',
        'Opciones:',
        '  --base-url=URL                Base URL (default TEST_BASE_URL o https://pielarmonia.com)',
        '  --service=SERVICE             Servicio de prueba (default laser)',
        '  --days=N                      Ventana de disponibilidad (default 21)',
        '  --min-lead-minutes=N          Anticipacion minima para slot (default 70)',
        '  --require-google=true|false   Exigir calendarSource=google (default TEST_REQUIRE_GOOGLE_CALENDAR=true)',
        '  --admin-password=VALUE        Password admin solo para cleanup legacy (default TEST_ADMIN_PASSWORD o PIELARMONIA_ADMIN_PASSWORD)',
        '  --json-out=PATH               Reporte JSON (default verification/calendar-write-smoke/api-write-smoke-last.json)',
        '  --help                        Muestra esta ayuda',
    ].join('\n');
}

function parseSlotToUtcMs(date, time) {
    if (
        typeof date !== 'string' ||
        typeof time !== 'string' ||
        !/^\d{4}-\d{2}-\d{2}$/.test(date) ||
        !/^\d{2}:\d{2}$/.test(time)
    ) {
        return Number.NaN;
    }
    return Date.parse(`${date}T${time}:00-05:00`);
}

function pickFirstSlot(data, options = {}) {
    const excludeDate = options.excludeDate || '';
    const excludeTime = options.excludeTime || '';
    const minLeadMinutes = Number(options.minLeadMinutes || 0);
    if (!data || typeof data !== 'object') {
        return null;
    }

    const minLeadMs = Math.max(0, minLeadMinutes) * 60 * 1000;
    const minAllowedUtcMs = Date.now() + minLeadMs;
    const days = Object.keys(data).sort();
    for (const day of days) {
        const slots = Array.isArray(data[day]) ? [...data[day]].sort() : [];
        for (const slot of slots) {
            if (day === excludeDate && slot === excludeTime) continue;
            const slotUtcMs = parseSlotToUtcMs(day, slot);
            if (Number.isFinite(slotUtcMs) && slotUtcMs < minAllowedUtcMs) {
                continue;
            }
            return { date: day, time: slot };
        }
    }

    return null;
}

function truncate(value, max = 300) {
    const text = String(value || '');
    if (text.length <= max) return text;
    return `${text.slice(0, max)}...`;
}

function assertOrThrow(condition, message) {
    if (!condition) {
        const error = new Error(message);
        error.code = 'assertion_failed';
        throw error;
    }
}

async function main() {
    if (hasFlag('help')) {
        process.stdout.write(`${usage()}\n`);
        return;
    }

    const baseUrl = normalizeBaseUrl(
        parseStringArg(
            'base-url',
            process.env.TEST_BASE_URL || 'https://pielarmonia.com'
        )
    );
    const service = parseStringArg('service', 'laser');
    const days = parseIntArg('days', 21, 1);
    const minLeadMinutes = parseIntArg('min-lead-minutes', 70, 0);
    const requireGoogle = parseBoolArg(
        'require-google',
        String(process.env.TEST_REQUIRE_GOOGLE_CALENDAR || 'true')
            .toLowerCase()
            .trim() === 'true'
    );
    const adminPassword = parseStringArg(
        'admin-password',
        process.env.TEST_ADMIN_PASSWORD ||
            process.env.PIELARMONIA_ADMIN_PASSWORD ||
            ''
    );
    const jsonOut = resolve(
        parseStringArg(
            'json-out',
            'verification/calendar-write-smoke/api-write-smoke-last.json'
        )
    );

    const report = {
        generatedAt: new Date().toISOString(),
        baseUrl,
        service,
        days,
        minLeadMinutes,
        requireGoogle,
        status: 'running',
        appointment: {
            id: null,
            assignedDoctor: null,
            createSlot: null,
            rescheduleSlot: null,
        },
        cleanup: {
            attempted: false,
            status: 'not_required',
            details: '',
        },
        steps: [],
        error: null,
    };

    let appointmentId = null;
    let rescheduleToken = '';
    let assignedDoctor = '';

    const runStep = async (name, fn) => {
        const startedAt = Date.now();
        try {
            const details = await fn();
            report.steps.push({
                name,
                status: 'ok',
                durationMs: Date.now() - startedAt,
                details: details || {},
            });
            return details;
        } catch (error) {
            report.steps.push({
                name,
                status: 'error',
                durationMs: Date.now() - startedAt,
                details: {
                    message:
                        error instanceof Error ? error.message : String(error),
                    code:
                        error && typeof error === 'object' && error.code
                            ? String(error.code)
                            : 'error',
                },
            });
            throw error;
        }
    };

    try {
        assertOrThrow(baseUrl.startsWith('http'), 'base-url invalida');
        assertOrThrow(service.length > 0, 'service vacio');

        await runStep('health', async () => {
            const response = await requestJson(
                baseUrl,
                'GET',
                '/api.php?resource=health'
            );
            assertOrThrow(
                response.ok,
                `health http ${response.status}: ${truncate(response.text)}`
            );
            assertOrThrow(
                response.json && response.json.ok === true,
                'health payload invalido'
            );

            const body = response.json;
            if (requireGoogle) {
                assertOrThrow(
                    String(body.calendarSource) === 'google',
                    `calendarSource esperado google, recibido ${body.calendarSource}`
                );
                assertOrThrow(
                    body.calendarConfigured === true,
                    'calendarConfigured != true'
                );
                assertOrThrow(
                    body.calendarReachable === true,
                    'calendarReachable != true'
                );
                assertOrThrow(
                    String(body.calendarMode) === 'live',
                    `calendarMode esperado live, recibido ${body.calendarMode}`
                );
            }

            return {
                calendarSource: body.calendarSource,
                calendarMode: body.calendarMode,
                calendarConfigured: body.calendarConfigured,
                calendarReachable: body.calendarReachable,
                calendarAuth: body.calendarAuth,
            };
        });

        const availabilityResponse = await runStep(
            'availability_laser',
            async () => {
                const query = new URLSearchParams({
                    resource: 'availability',
                    doctor: 'indiferente',
                    service,
                    days: String(days),
                });
                const response = await requestJson(
                    baseUrl,
                    'GET',
                    `/api.php?${query.toString()}`
                );
                assertOrThrow(
                    response.ok,
                    `availability http ${response.status}: ${truncate(response.text)}`
                );
                assertOrThrow(
                    response.json && response.json.ok === true,
                    'availability payload invalido'
                );
                const meta = response.json.meta || {};
                assertOrThrow(
                    String(meta.source) === 'google',
                    `availability meta.source esperado google, recibido ${meta.source}`
                );
                return {
                    meta: {
                        source: meta.source,
                        mode: meta.mode,
                        doctor: meta.doctor,
                        service: meta.service,
                        durationMin: meta.durationMin,
                    },
                    daysReturned: Object.keys(response.json.data || {}).length,
                    data: response.json.data || {},
                };
            }
        );

        const createSlot = pickFirstSlot(availabilityResponse.data, {
            minLeadMinutes,
        });
        assertOrThrow(
            Boolean(createSlot),
            'No se encontro slot disponible para crear cita'
        );
        report.appointment.createSlot = createSlot;

        await runStep('create_appointment', async () => {
            const stamp = Date.now();
            const payload = {
                service,
                doctor: 'indiferente',
                date: createSlot.date,
                time: createSlot.time,
                name: `Calendar API Smoke ${stamp}`,
                email: `calendar-api-smoke-${stamp}@example.com`,
                phone: '+593987654321',
                reason: 'Prueba API-only de agenda real',
                privacyConsent: true,
                paymentMethod: 'cash',
            };

            const response = await requestJson(
                baseUrl,
                'POST',
                '/api.php?resource=appointments',
                {
                    body: payload,
                }
            );
            assertOrThrow(
                response.status === 201,
                `appointments create http ${response.status}: ${truncate(response.text)}`
            );
            assertOrThrow(
                response.json && response.json.ok === true,
                'appointments create payload invalido'
            );
            const data = response.json.data || {};
            appointmentId = Number(data.id);
            assignedDoctor = String(data.doctor || '');
            rescheduleToken = String(data.rescheduleToken || '');

            assertOrThrow(
                Number.isFinite(appointmentId) && appointmentId > 0,
                'id de cita invalido'
            );
            assertOrThrow(
                ['rosero', 'narvaez'].includes(assignedDoctor),
                `doctor asignado invalido: ${assignedDoctor}`
            );
            assertOrThrow(
                String(data.calendarProvider) === 'google',
                'calendarProvider distinto de google'
            );
            assertOrThrow(
                String(data.calendarEventId || '').length > 0,
                'calendarEventId vacio'
            );
            assertOrThrow(
                String(data.calendarId || '').length > 0,
                'calendarId vacio'
            );
            assertOrThrow(
                Number(data.slotDurationMin) === 60,
                `slotDurationMin esperado 60, recibido ${data.slotDurationMin}`
            );
            assertOrThrow(
                rescheduleToken.length >= 16,
                'rescheduleToken invalido'
            );

            report.appointment.id = appointmentId;
            report.appointment.assignedDoctor = assignedDoctor;
            return {
                id: appointmentId,
                doctor: assignedDoctor,
                slotDurationMin: Number(data.slotDurationMin),
            };
        });

        await runStep('verify_booked_after_create', async () => {
            const query = new URLSearchParams({
                resource: 'booked-slots',
                date: createSlot.date,
                doctor: assignedDoctor,
                service,
            });
            const response = await requestJson(
                baseUrl,
                'GET',
                `/api.php?${query.toString()}`
            );
            assertOrThrow(
                response.ok,
                `booked-slots after create http ${response.status}: ${truncate(response.text)}`
            );
            assertOrThrow(
                response.json && response.json.ok === true,
                'booked-slots after create payload invalido'
            );
            assertOrThrow(
                Array.isArray(response.json.data),
                'booked-slots after create data no es array'
            );
            assertOrThrow(
                response.json.data.includes(createSlot.time),
                'slot creado no figura en booked-slots'
            );
            return { bookedCount: response.json.data.length };
        });

        const doctorAvailability = await runStep(
            'availability_assigned_doctor',
            async () => {
                const query = new URLSearchParams({
                    resource: 'availability',
                    doctor: assignedDoctor,
                    service,
                    days: '21',
                });
                const response = await requestJson(
                    baseUrl,
                    'GET',
                    `/api.php?${query.toString()}`
                );
                assertOrThrow(
                    response.ok,
                    `availability doctor http ${response.status}: ${truncate(response.text)}`
                );
                assertOrThrow(
                    response.json && response.json.ok === true,
                    'availability doctor payload invalido'
                );
                return { data: response.json.data || {} };
            }
        );

        const rescheduleSlot = pickFirstSlot(doctorAvailability.data, {
            excludeDate: createSlot.date,
            excludeTime: createSlot.time,
            minLeadMinutes,
        });
        assertOrThrow(
            Boolean(rescheduleSlot),
            'No se encontro slot para reprogramar cita'
        );
        report.appointment.rescheduleSlot = rescheduleSlot;

        await runStep('reschedule_appointment', async () => {
            const response = await requestJson(
                baseUrl,
                'PATCH',
                '/api.php?resource=reschedule',
                {
                    body: {
                        token: rescheduleToken,
                        date: rescheduleSlot.date,
                        time: rescheduleSlot.time,
                    },
                }
            );
            assertOrThrow(
                response.status === 200,
                `reschedule http ${response.status}: ${truncate(response.text)}`
            );
            assertOrThrow(
                response.json && response.json.ok === true,
                'reschedule payload invalido'
            );
            const data = response.json.data || {};
            assertOrThrow(
                String(data.date) === rescheduleSlot.date,
                'reschedule date no coincide'
            );
            assertOrThrow(
                String(data.time) === rescheduleSlot.time,
                'reschedule time no coincide'
            );
            assertOrThrow(
                String(data.doctor) === assignedDoctor,
                'reschedule doctor no coincide'
            );
            assertOrThrow(
                String(data.calendarProvider) === 'google',
                'reschedule calendarProvider != google'
            );
            assertOrThrow(
                String(data.calendarEventId || '').length > 0,
                'reschedule calendarEventId vacio'
            );
            return {
                date: data.date,
                time: data.time,
                doctor: data.doctor,
            };
        });

        await runStep('verify_booked_after_reschedule', async () => {
            const query = new URLSearchParams({
                resource: 'booked-slots',
                date: rescheduleSlot.date,
                doctor: assignedDoctor,
                service,
            });
            const response = await requestJson(
                baseUrl,
                'GET',
                `/api.php?${query.toString()}`
            );
            assertOrThrow(
                response.ok,
                `booked-slots after reschedule http ${response.status}: ${truncate(response.text)}`
            );
            assertOrThrow(
                response.json && response.json.ok === true,
                'booked-slots after reschedule payload invalido'
            );
            assertOrThrow(
                Array.isArray(response.json.data),
                'booked-slots after reschedule data no es array'
            );
            assertOrThrow(
                response.json.data.includes(rescheduleSlot.time),
                'slot reprogramado no figura en booked-slots'
            );
            return { bookedCount: response.json.data.length };
        });

        report.status = 'success';
        report.error = null;
        appendGithubOutput('api_write_status', 'success');
    } catch (error) {
        report.status = 'failed';
        report.error = {
            message: error instanceof Error ? error.message : String(error),
            code:
                error && typeof error === 'object' && error.code
                    ? String(error.code)
                    : 'error',
        };
        appendGithubOutput('api_write_status', 'failed');
    } finally {
        if (appointmentId && Number.isFinite(appointmentId)) {
            report.cleanup.attempted = true;
            try {
                const login = await loginAdmin(baseUrl, {
                    password: adminPassword,
                });

                const cancelResponse = await requestJson(
                    baseUrl,
                    'PATCH',
                    '/api.php?resource=appointments',
                    {
                        headers: {
                            Cookie: login.cookie,
                            'X-CSRF-Token': login.csrfToken,
                        },
                        body: {
                            id: appointmentId,
                            status: 'cancelled',
                        },
                    }
                );
                assertOrThrow(
                    cancelResponse.ok && cancelResponse.json?.ok === true,
                    `cancel appointment failed http ${cancelResponse.status}`
                );

                await logoutAdmin(baseUrl, {
                    headers: { Cookie: login.cookie },
                }).catch(() => {});

                report.cleanup.status = 'success';
                report.cleanup.details = `appointment ${appointmentId} cancelled`;
            } catch (cleanupError) {
                report.cleanup.status = 'failed';
                report.cleanup.details =
                    cleanupError instanceof Error
                        ? cleanupError.message
                        : String(cleanupError);
            }
        }

        mkdirSync(dirname(jsonOut), { recursive: true });
        writeFileSync(jsonOut, `${JSON.stringify(report, null, 2)}\n`, 'utf8');

        appendGithubOutput(
            'api_write_report_path',
            jsonOut.replace(/\\/g, '/')
        );
        appendGithubOutput(
            'api_write_cleanup_status',
            String(report.cleanup.status || 'n/a')
        );
        appendGithubOutput(
            'api_write_appointment_id',
            report.appointment.id ? String(report.appointment.id) : 'n/a'
        );
        appendGithubOutput(
            'api_write_assigned_doctor',
            report.appointment.assignedDoctor || 'n/a'
        );
        appendGithubOutput(
            'api_write_create_slot',
            report.appointment.createSlot
                ? `${report.appointment.createSlot.date} ${report.appointment.createSlot.time}`
                : 'n/a'
        );
        appendGithubOutput(
            'api_write_reschedule_slot',
            report.appointment.rescheduleSlot
                ? `${report.appointment.rescheduleSlot.date} ${report.appointment.rescheduleSlot.time}`
                : 'n/a'
        );
    }

    if (report.status !== 'success') {
        process.stderr.write(
            `calendar-write-smoke-api fallo: ${report.error?.message || 'unknown error'}\n`
        );
        process.exit(1);
    }

    process.stdout.write(
        `calendar-write-smoke-api ok (appointment=${report.appointment.id}, doctor=${report.appointment.assignedDoctor})\n`
    );
}

main().catch((error) => {
    process.stderr.write(
        `calendar-write-smoke-api fatal: ${error instanceof Error ? error.message : String(error)}\n`
    );
    process.exit(1);
});
