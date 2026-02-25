#!/usr/bin/env node
'use strict';

const { mkdirSync, writeFileSync } = require('fs');
const { dirname, resolve } = require('path');

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

function requireEnv(name) {
    const value = String(process.env[name] || '').trim();
    if (!value) throw new Error(`Falta variable de entorno ${name}`);
    return value;
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

async function main() {
    if (hasFlag('help')) {
        process.stdout.write(`${usage()}\n`);
        return;
    }

    const token = requireEnv('SENTRY_AUTH_TOKEN');
    const org = requireEnv('SENTRY_ORG');
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
            'verification/runtime/sentry-events-last.json'
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

    if (!backendProject) {
        throw new Error('SENTRY_BACKEND_PROJECT vacio');
    }
    if (!frontendProject) {
        throw new Error('SENTRY_FRONTEND_PROJECT vacio');
    }

    const [backend, frontend] = await Promise.all([
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

    const ok = (allowMissing || missing.length === 0) && stale.length === 0;
    const payload = {
        generatedAt: new Date().toISOString(),
        baseUrl,
        org,
        lookbackHours,
        allowMissing,
        maxAgeHours: Number.isFinite(maxAgeHours) ? maxAgeHours : null,
        ok,
        missingProjects: missing,
        staleProjects: stale,
        backend,
        frontend,
    };

    mkdirSync(dirname(jsonOut), { recursive: true });
    writeFileSync(jsonOut, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');

    const summaryLines = [
        `Sentry verify: ${ok ? 'OK' : 'FAIL'}`,
        `- org: ${org}`,
        `- lookbackHours: ${lookbackHours}`,
        `- backend (${backend.project}): ${backend.found ? `event ${backend.latest?.eventID || 'n/a'} @ ${backend.latest?.date || 'n/a'}` : 'SIN EVENTOS'}`,
        `- frontend (${frontend.project}): ${frontend.found ? `event ${frontend.latest?.eventID || 'n/a'} @ ${frontend.latest?.date || 'n/a'}` : 'SIN EVENTOS'}`,
    ];
    if (missing.length > 0) {
        summaryLines.push(`- missing: ${missing.join(', ')}`);
    }
    if (stale.length > 0) {
        summaryLines.push(
            `- stale: ${stale.map((row) => `${row.project} (${row.ageHours}h > ${row.maxAgeHours}h)`).join(', ')}`
        );
    }
    summaryLines.push(`- json: ${jsonOut}`);

    const summary = summaryLines.join('\n');
    process.stdout.write(`${summary}\n`);

    appendGithubOutput('sentry_verify_ok', ok ? 'true' : 'false');
    appendGithubOutput(
        'sentry_backend_found',
        backend.found ? 'true' : 'false'
    );
    appendGithubOutput(
        'sentry_frontend_found',
        frontend.found ? 'true' : 'false'
    );
    appendGithubOutput('sentry_report_json', jsonOut.replace(/\\/g, '/'));
    appendGithubOutputMultiline('sentry_summary', summary);

    if (!ok) {
        process.exit(1);
    }
}

main().catch((error) => {
    console.error(
        `verify-sentry-events.js error: ${error instanceof Error ? error.message : String(error)}`
    );
    process.exit(1);
});
