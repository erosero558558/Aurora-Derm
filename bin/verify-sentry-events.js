#!/usr/bin/env node
'use strict';

const { mkdirSync, writeFileSync } = require('fs');
const { dirname, resolve } = require('path');
const DEFAULT_JSON_OUT = 'verification/runtime/sentry-events-last.json';

function parseStringArg(name, fallback) {
    const prefix = `--${name}=`;
    const arg = process.argv.find((item) => item.startsWith(prefix));
    if (!arg) return fallback;
    const raw = arg.slice(prefix.length).trim();
    return raw === '' ? fallback : raw;
}

function parseIntArg(name, fallback, minValue = 1) {
    const raw = parseStringArg(name, null);
    if (raw === null) return fallback;
    const parsed = Number.parseInt(raw, 10);
    if (!Number.isFinite(parsed) || parsed < minValue) {
        throw new Error(`Argumento invalido --${name}: ${raw}`);
    }
    return parsed;
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

function appendGithubOutputMultiline(key, value) {
    const outputPath = process.env.GITHUB_OUTPUT;
    if (!outputPath) return;
    writeFileSync(outputPath, `${key}<<EOF\n${value}\nEOF\n`, {
        encoding: 'utf8',
        flag: 'a',
    });
}

function usage() {
    return [
        'Uso: node bin/verify-sentry-events.js [--lookback-hours=168] [--json-out=path]',
        '',
        'Variables requeridas:',
        '  SENTRY_AUTH_TOKEN',
        '  SENTRY_ORG',
        '  SENTRY_BACKEND_PROJECT (default: pielarmonia-backend)',
        '  SENTRY_FRONTEND_PROJECT (default: pielarmonia-frontend)',
        '',
        'Opcionales:',
        '  SENTRY_BASE_URL (default: https://sentry.io)',
        '  SENTRY_MAX_EVENT_AGE_HOURS (si se define, falla si el evento mas reciente excede este limite)',
        '',
        'Flags:',
        '  --lookback-hours=N       Ventana de busqueda (default 168h)',
        '  --json-out=PATH          Reporte JSON (default verification/runtime/sentry-events-last.json)',
        '  --allow-missing          No falla si falta backend o frontend',
        '  --help                   Muestra esta ayuda',
    ].join('\n');
}

function readEnv(name, fallback = '') {
    return String(process.env[name] || fallback).trim();
}

function normalizeBaseUrl(value) {
    return String(value || 'https://sentry.io').replace(/\/+$/, '');
}

function toIsoAgeHours(dateText) {
    if (!dateText) return null;
    const t = Date.parse(String(dateText));
    if (!Number.isFinite(t)) return null;
    return (Date.now() - t) / (1000 * 60 * 60);
}

function pickEventTime(event) {
    return (
        event.dateCreated ||
        event.dateReceived ||
        event.date ||
        event.timestamp ||
        null
    );
}

async function sentryGetJson({ baseUrl, token, path, params }) {
    const url = new URL(`${baseUrl}${path}`);
    for (const [key, value] of Object.entries(params || {})) {
        if (value === undefined || value === null || value === '') continue;
        url.searchParams.set(key, String(value));
    }

    const response = await fetch(url, {
        headers: {
            Authorization: `Bearer ${token}`,
            Accept: 'application/json',
        },
    });

    const text = await response.text();
    let json;
    try {
        json = text ? JSON.parse(text) : null;
    } catch (_error) {
        json = null;
    }

    if (!response.ok) {
        const detail =
            (json && (json.detail || json.error || json.message)) || text;
        throw new Error(
            `Sentry API ${response.status} ${response.statusText} en ${path}: ${String(detail).slice(0, 300)}`
        );
    }

    return json;
}

async function fetchLatestProjectEvent({
    baseUrl,
    token,
    org,
    project,
    lookbackHours,
}) {
    const events = await sentryGetJson({
        baseUrl,
        token,
        path: `/api/0/projects/${encodeURIComponent(org)}/${encodeURIComponent(project)}/events/`,
        params: {
            per_page: 1,
            statsPeriod: `${lookbackHours}h`,
        },
    });

    const list = Array.isArray(events) ? events : [];
    const event = list[0] || null;

    if (!event) {
        return {
            project,
            found: false,
            lookbackHours,
            latest: null,
        };
    }

    const time = pickEventTime(event);
    const ageHours = toIsoAgeHours(time);

    return {
        project,
        found: true,
        lookbackHours,
        latest: {
            id: event.id || event.eventID || null,
            eventID: event.eventID || event.id || null,
            title: event.title || event.message || null,
            message: event.message || null,
            level: event.level || null,
            platform: event.platform || null,
            culprit: event.culprit || null,
            date: time,
            ageHours: Number.isFinite(ageHours)
                ? Number(ageHours.toFixed(2))
                : null,
            webUrl: event.webUrl || null,
        },
    };
}

function buildBasePayload({
    jsonOut,
    baseUrl,
    org,
    lookbackHours,
    allowMissing,
    maxAgeHours,
    backendProject,
    frontendProject,
}) {
    return {
        version: 1,
        generatedAt: new Date().toISOString(),
        artifactPath: jsonOut.replace(/\\/g, '/'),
        source: 'sentry-api',
        baseUrl,
        org: org || null,
        lookbackHours,
        allowMissing,
        maxAgeHours: Number.isFinite(maxAgeHours) ? maxAgeHours : null,
        ok: false,
        status: 'pending_external',
        failureReason: null,
        actionRequired: null,
        missingEnv: [],
        missingProjects: [],
        staleProjects: [],
        backend: {
            project: backendProject || null,
            found: false,
            lookbackHours,
            latest: null,
        },
        frontend: {
            project: frontendProject || null,
            found: false,
            lookbackHours,
            latest: null,
        },
    };
}

function writeJsonReport(jsonOut, payload) {
    mkdirSync(dirname(jsonOut), { recursive: true });
    writeFileSync(jsonOut, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
}

function describeProjectEvidence(projectCheck) {
    if (!projectCheck || !projectCheck.project) {
        return 'SIN PROYECTO';
    }
    if (!projectCheck.found) {
        return 'SIN EVENTOS';
    }
    return `event ${projectCheck.latest?.eventID || 'n/a'} @ ${projectCheck.latest?.date || 'n/a'}`;
}

function buildSummary(payload) {
    const summaryLines = [
        `Sentry verify: ${payload.ok ? 'OK' : 'FAIL'}`,
        `- status: ${payload.status || 'n/a'}`,
        `- org: ${payload.org || 'missing'}`,
        `- lookbackHours: ${payload.lookbackHours}`,
        `- backend (${payload.backend?.project || 'n/a'}): ${describeProjectEvidence(payload.backend)}`,
        `- frontend (${payload.frontend?.project || 'n/a'}): ${describeProjectEvidence(payload.frontend)}`,
    ];
    if (Array.isArray(payload.missingEnv) && payload.missingEnv.length > 0) {
        summaryLines.push(`- missing_env: ${payload.missingEnv.join(', ')}`);
    }
    if (
        Array.isArray(payload.missingProjects) &&
        payload.missingProjects.length > 0
    ) {
        summaryLines.push(`- missing_projects: ${payload.missingProjects.join(', ')}`);
    }
    if (
        Array.isArray(payload.staleProjects) &&
        payload.staleProjects.length > 0
    ) {
        summaryLines.push(
            `- stale_projects: ${payload.staleProjects
                .map(
                    (row) =>
                        `${row.project} (${row.ageHours}h > ${row.maxAgeHours}h)`
                )
                .join(', ')}`
        );
    }
    if (payload.failureReason?.code) {
        summaryLines.push(`- failure_code: ${payload.failureReason.code}`);
    }
    if (payload.failureReason?.message) {
        summaryLines.push(`- failure_message: ${payload.failureReason.message}`);
    }
    if (payload.actionRequired) {
        summaryLines.push(`- action_required: ${payload.actionRequired}`);
    }
    summaryLines.push(`- json: ${payload.artifactPath}`);
    return summaryLines.join('\n');
}

function finalizeAndExit(jsonOut, payload, exitCode = 0) {
    writeJsonReport(jsonOut, payload);
    const summary = buildSummary(payload);
    process.stdout.write(`${summary}\n`);
    appendGithubOutput('sentry_verify_ok', payload.ok ? 'true' : 'false');
    appendGithubOutput(
        'sentry_backend_found',
        payload.backend?.found ? 'true' : 'false'
    );
    appendGithubOutput(
        'sentry_frontend_found',
        payload.frontend?.found ? 'true' : 'false'
    );
    appendGithubOutput('sentry_status', String(payload.status || 'unknown'));
    appendGithubOutput(
        'sentry_failure_code',
        String(payload.failureReason?.code || '')
    );
    appendGithubOutput('sentry_report_json', payload.artifactPath);
    appendGithubOutputMultiline('sentry_summary', summary);
    if (exitCode !== 0) {
        process.exit(exitCode);
    }
}

async function main() {
    if (hasFlag('help')) {
        process.stdout.write(`${usage()}\n`);
        return;
    }

    const token = readEnv('SENTRY_AUTH_TOKEN');
    const org = readEnv('SENTRY_ORG');
    const backendProject = String(
        process.env.SENTRY_BACKEND_PROJECT || 'pielarmonia-backend'
    ).trim();
    const frontendProject = String(
        process.env.SENTRY_FRONTEND_PROJECT || 'pielarmonia-frontend'
    ).trim();
    const baseUrl = normalizeBaseUrl(process.env.SENTRY_BASE_URL);
    const lookbackHours = parseIntArg('lookback-hours', 168, 1);
    const jsonOut = resolve(
        parseStringArg(
            'json-out',
            DEFAULT_JSON_OUT
        )
    );
    const allowMissing = hasFlag('allow-missing');
    const maxAgeHoursRaw = String(process.env.SENTRY_MAX_EVENT_AGE_HOURS || '');
    const parsedMaxAgeHours = maxAgeHoursRaw
        ? Number.parseFloat(maxAgeHoursRaw)
        : null;
    const maxAgeHours =
        Number.isFinite(parsedMaxAgeHours) && parsedMaxAgeHours > 0
            ? parsedMaxAgeHours
            : null;
    const payload = buildBasePayload({
        jsonOut,
        baseUrl,
        org,
        lookbackHours,
        allowMissing,
        maxAgeHours,
        backendProject,
        frontendProject,
    });

    const missingEnv = [];
    if (!token) {
        missingEnv.push('SENTRY_AUTH_TOKEN');
    }
    if (!org) {
        missingEnv.push('SENTRY_ORG');
    }

    if (!backendProject) {
        missingEnv.push('SENTRY_BACKEND_PROJECT');
    }
    if (!frontendProject) {
        missingEnv.push('SENTRY_FRONTEND_PROJECT');
    }
    if (missingEnv.length > 0) {
        payload.missingEnv = missingEnv;
        payload.status = 'needs_configuration';
        payload.failureReason = {
            code: 'missing_env',
            message: `Faltan variables requeridas: ${missingEnv.join(', ')}`,
        };
        payload.actionRequired =
            'Configurar secrets/variables de Sentry y re-ejecutar npm run verify:sentry:events o el workflow manual Sentry Events Verify.';
        finalizeAndExit(jsonOut, payload, 1);
        return;
    }

    let backend;
    let frontend;
    try {
        [backend, frontend] = await Promise.all([
            fetchLatestProjectEvent({
                baseUrl,
                token,
                org,
                project: backendProject,
                lookbackHours,
            }),
            fetchLatestProjectEvent({
                baseUrl,
                token,
                org,
                project: frontendProject,
                lookbackHours,
            }),
        ]);
    } catch (error) {
        payload.status = 'api_error';
        payload.failureReason = {
            code: 'api_error',
            message: error instanceof Error ? error.message : String(error),
        };
        payload.actionRequired =
            'Verificar token/org/proyectos de Sentry y volver a correr la verificacion; si el problema persiste, ejecutar el workflow manual para capturar artefacto.';
        finalizeAndExit(jsonOut, payload, 1);
        return;
    }

    payload.backend = backend;
    payload.frontend = frontend;

    const checks = [backend, frontend];
    const missing = checks
        .filter((item) => !item.found)
        .map((item) => item.project);

    const stale = [];
    if (Number.isFinite(maxAgeHours)) {
        for (const item of checks) {
            const age = item.latest?.ageHours;
            if (item.found && Number.isFinite(age) && age > maxAgeHours) {
                stale.push({
                    project: item.project,
                    ageHours: age,
                    maxAgeHours,
                });
            }
        }
    }

    payload.ok = (allowMissing || missing.length === 0) && stale.length === 0;
    payload.missingProjects = missing;
    payload.staleProjects = stale;
    if (payload.ok) {
        payload.status = 'ok';
    } else if (missing.length > 0) {
        payload.status = 'missing_events';
        payload.failureReason = {
            code: 'missing_events',
            message: `Sin eventos recientes en: ${missing.join(', ')}`,
        };
        payload.actionRequired =
            'Provocar o localizar eventos recientes en los proyectos faltantes y volver a ejecutar la verificacion.';
    } else if (stale.length > 0) {
        payload.status = 'stale_events';
        payload.failureReason = {
            code: 'stale_events',
            message: `Hay proyectos con ultimo evento fuera del umbral maximo (${stale
                .map((row) => `${row.project}: ${row.ageHours}h`)
                .join(', ')})`,
        };
        payload.actionRequired =
            'Revisar ingesta Sentry o disparar eventos recientes dentro del umbral configurado y repetir la verificacion.';
    }
    finalizeAndExit(jsonOut, payload, payload.ok ? 0 : 1);
}

main().catch((error) => {
    const jsonOut = resolve(parseStringArg('json-out', DEFAULT_JSON_OUT));
    const payload = buildBasePayload({
        jsonOut,
        baseUrl: normalizeBaseUrl(process.env.SENTRY_BASE_URL),
        org: readEnv('SENTRY_ORG'),
        lookbackHours: parseIntArg('lookback-hours', 168, 1),
        allowMissing: hasFlag('allow-missing'),
        maxAgeHours: null,
        backendProject: readEnv('SENTRY_BACKEND_PROJECT', 'pielarmonia-backend'),
        frontendProject: readEnv(
            'SENTRY_FRONTEND_PROJECT',
            'pielarmonia-frontend'
        ),
    });
    payload.status = 'script_error';
    payload.failureReason = {
        code: 'script_error',
        message: error instanceof Error ? error.message : String(error),
    };
    payload.actionRequired =
        'Revisar la ejecucion local del script y corregir el error antes de reintentar.';
    writeJsonReport(jsonOut, payload);
    process.exit(1);
});
