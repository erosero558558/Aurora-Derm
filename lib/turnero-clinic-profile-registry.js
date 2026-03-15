'use strict';

const fs = require('node:fs');
const http = require('node:http');
const https = require('node:https');
const path = require('node:path');

const PROFILE_SCHEMA = 'turnero-clinic-profile/v1';
const SURFACE_KEYS = ['admin', 'operator', 'kiosk', 'display'];

function getProjectRoot(customRoot) {
    return customRoot
        ? path.resolve(customRoot)
        : path.resolve(__dirname, '..');
}

function getTurneroClinicProfilesDir(customRoot) {
    return path.join(
        getProjectRoot(customRoot),
        'content',
        'turnero',
        'clinic-profiles'
    );
}

function getTurneroActiveClinicProfilePath(customRoot) {
    return path.join(
        getProjectRoot(customRoot),
        'content',
        'turnero',
        'clinic-profile.json'
    );
}

function normalizeString(value, fallback = '') {
    const normalized = String(value ?? '').trim();
    return normalized || fallback;
}

function normalizeRoute(value, fallback) {
    const normalized = normalizeString(value, fallback);
    if (!normalized.startsWith('/')) {
        return `/${normalized}`;
    }
    return normalized;
}

function normalizeSurface(input, fallbackLabel, fallbackRoute) {
    const source = input && typeof input === 'object' ? input : {};
    return {
        enabled: typeof source.enabled === 'boolean' ? source.enabled : true,
        label: normalizeString(source.label, fallbackLabel),
        route: normalizeRoute(source.route, fallbackRoute),
    };
}

function normalizeTurneroClinicProfile(rawProfile) {
    const source =
        rawProfile && typeof rawProfile === 'object' ? rawProfile : {};
    const branding =
        source.branding && typeof source.branding === 'object'
            ? source.branding
            : {};
    const consultorios =
        source.consultorios && typeof source.consultorios === 'object'
            ? source.consultorios
            : {};
    const release =
        source.release && typeof source.release === 'object'
            ? source.release
            : {};
    const surfaces =
        source.surfaces && typeof source.surfaces === 'object'
            ? source.surfaces
            : {};

    return {
        schema: normalizeString(source.schema, PROFILE_SCHEMA),
        clinic_id: normalizeString(source.clinic_id, 'default-clinic'),
        branding: {
            name: normalizeString(branding.name, 'Piel en Armonia'),
            short_name: normalizeString(
                branding.short_name,
                normalizeString(branding.name, 'Piel en Armonia')
            ),
            city: normalizeString(branding.city, 'Quito'),
            base_url: normalizeString(branding.base_url),
        },
        consultorios: {
            c1: {
                label: normalizeString(
                    consultorios?.c1?.label,
                    'Consultorio 1'
                ),
                short_label: normalizeString(
                    consultorios?.c1?.short_label,
                    'C1'
                ),
            },
            c2: {
                label: normalizeString(
                    consultorios?.c2?.label,
                    'Consultorio 2'
                ),
                short_label: normalizeString(
                    consultorios?.c2?.short_label,
                    'C2'
                ),
            },
        },
        surfaces: {
            admin: normalizeSurface(
                surfaces.admin,
                'Admin web',
                '/admin.html#queue'
            ),
            operator: normalizeSurface(
                surfaces.operator,
                'Operador web',
                '/operador-turnos.html'
            ),
            kiosk: normalizeSurface(
                surfaces.kiosk,
                'Kiosco web',
                '/kiosco-turnos.html'
            ),
            display: normalizeSurface(
                surfaces.display,
                'Sala web',
                '/sala-turnos.html'
            ),
        },
        release: {
            mode: normalizeString(release.mode, 'web_pilot'),
            admin_mode_default:
                normalizeString(release.admin_mode_default, 'basic') ===
                'expert'
                    ? 'expert'
                    : 'basic',
            separate_deploy:
                typeof release.separate_deploy === 'boolean'
                    ? release.separate_deploy
                    : true,
            native_apps_blocking:
                typeof release.native_apps_blocking === 'boolean'
                    ? release.native_apps_blocking
                    : false,
            notes: Array.isArray(release.notes)
                ? release.notes
                      .map((note) => normalizeString(note))
                      .filter(Boolean)
                : [],
        },
    };
}

function getTurneroClinicProfileFingerprint(profile) {
    const normalized = normalizeTurneroClinicProfile(profile);
    const source = [
        normalized.clinic_id,
        normalized.branding.base_url,
        normalized.consultorios.c1.label,
        normalized.consultorios.c1.short_label,
        normalized.consultorios.c2.label,
        normalized.consultorios.c2.short_label,
        normalized.surfaces.admin.enabled ? '1' : '0',
        normalized.surfaces.admin.route,
        normalized.surfaces.operator.enabled ? '1' : '0',
        normalized.surfaces.operator.route,
        normalized.surfaces.kiosk.enabled ? '1' : '0',
        normalized.surfaces.kiosk.route,
        normalized.surfaces.display.enabled ? '1' : '0',
        normalized.surfaces.display.route,
        normalized.release.mode,
        normalized.release.admin_mode_default,
        normalized.release.separate_deploy ? '1' : '0',
        normalized.release.native_apps_blocking ? '1' : '0',
    ].join('|');

    let hash = 2166136261;
    for (let index = 0; index < source.length; index += 1) {
        hash ^= source.charCodeAt(index);
        hash = Math.imul(hash, 16777619);
    }

    return (hash >>> 0).toString(16).padStart(8, '0');
}

function validateTurneroClinicProfile(profile, options = {}) {
    const normalized = normalizeTurneroClinicProfile(profile);
    const errors = [];
    const warnings = [];
    const sourceLabel = normalizeString(options.sourceLabel, 'profile');

    if (normalized.schema !== PROFILE_SCHEMA) {
        errors.push(`${sourceLabel}: schema invalido (${normalized.schema})`);
    }
    if (!/^[a-z0-9][a-z0-9-]*$/.test(normalized.clinic_id)) {
        errors.push(
            `${sourceLabel}: clinic_id debe usar kebab-case ASCII (${normalized.clinic_id})`
        );
    }
    if (!normalized.branding.name) {
        errors.push(`${sourceLabel}: branding.name es obligatorio`);
    }
    if (!normalized.branding.short_name) {
        errors.push(`${sourceLabel}: branding.short_name es obligatorio`);
    }
    if (!normalized.branding.city) {
        errors.push(`${sourceLabel}: branding.city es obligatorio`);
    }
    if (!normalized.branding.base_url) {
        warnings.push(`${sourceLabel}: branding.base_url vacio`);
    } else if (!/^https?:\/\//.test(normalized.branding.base_url)) {
        errors.push(
            `${sourceLabel}: branding.base_url debe ser URL absoluta (${normalized.branding.base_url})`
        );
    }

    if (!normalized.release.separate_deploy) {
        errors.push(
            `${sourceLabel}: release.separate_deploy debe quedar en true para el piloto`
        );
    }
    if (normalized.release.mode !== 'web_pilot') {
        warnings.push(
            `${sourceLabel}: release.mode distinto a web_pilot (${normalized.release.mode})`
        );
    }

    for (const consultorioKey of ['c1', 'c2']) {
        if (!normalized.consultorios[consultorioKey].label) {
            errors.push(
                `${sourceLabel}: consultorios.${consultorioKey}.label es obligatorio`
            );
        }
        if (!normalized.consultorios[consultorioKey].short_label) {
            errors.push(
                `${sourceLabel}: consultorios.${consultorioKey}.short_label es obligatorio`
            );
        }
    }

    for (const surfaceKey of SURFACE_KEYS) {
        const surface = normalized.surfaces[surfaceKey];
        if (!surface.label) {
            errors.push(
                `${sourceLabel}: surfaces.${surfaceKey}.label es obligatorio`
            );
        }
        if (!surface.route || !surface.route.startsWith('/')) {
            errors.push(
                `${sourceLabel}: surfaces.${surfaceKey}.route debe iniciar con /`
            );
        }
        if (!surface.enabled) {
            warnings.push(
                `${sourceLabel}: surfaces.${surfaceKey} esta deshabilitada`
            );
        }
    }

    return {
        ok: errors.length === 0,
        errors,
        warnings,
        profile: normalized,
    };
}

function readJsonFile(filePath) {
    const raw = fs.readFileSync(filePath, 'utf8');
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : {};
}

function writeJsonFile(filePath, value) {
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.writeFileSync(filePath, `${JSON.stringify(value, null, 4)}\n`);
}

function requestJson(urlString, options = {}) {
    const target = new URL(urlString);
    const transport = target.protocol === 'https:' ? https : http;
    const timeoutMs = Number.isFinite(options.timeoutMs)
        ? Math.max(1, options.timeoutMs)
        : 10000;
    const extraHeaders =
        options.headers && typeof options.headers === 'object'
            ? options.headers
            : {};

    return new Promise((resolve, reject) => {
        const request = transport.request(
            target,
            {
                method: 'GET',
                headers: {
                    Accept: 'application/json',
                    Connection: 'close',
                    'User-Agent': 'TurneroClinicProfileCLI/1.0',
                    ...extraHeaders,
                },
            },
            (response) => {
                const chunks = [];

                response.on('data', (chunk) => {
                    chunks.push(chunk);
                });
                response.on('end', () => {
                    const rawBody = Buffer.concat(chunks).toString('utf8');
                    let payload;
                    try {
                        payload = rawBody ? JSON.parse(rawBody) : null;
                    } catch (_error) {
                        payload = null;
                    }
                    resolve({
                        ok:
                            response.statusCode >= 200 &&
                            response.statusCode < 300,
                        status: response.statusCode || 0,
                        payload,
                    });
                });
            }
        );

        request.setTimeout(timeoutMs, () => {
            request.destroy(new Error(`Timeout al consultar ${urlString}`));
        });
        request.on('error', (error) => {
            reject(error);
        });
        request.end();
    });
}

function resolveDiagnosticsAccess(options = {}) {
    const token = normalizeString(
        options.diagnosticsToken ||
            process.env.PIELARMONIA_DIAGNOSTICS_ACCESS_TOKEN ||
            process.env.PIELARMONIA_CRON_SECRET
    );
    if (!token) {
        return {
            enabled: false,
            resource: 'health',
            headers: {},
        };
    }

    const headerName = normalizeString(
        options.diagnosticsHeader ||
            process.env.PIELARMONIA_DIAGNOSTICS_ACCESS_TOKEN_HEADER,
        'Authorization'
    );
    const prefix = normalizeString(
        options.diagnosticsPrefix ||
            process.env.PIELARMONIA_DIAGNOSTICS_ACCESS_TOKEN_PREFIX,
        'Bearer'
    );
    const headerValue = prefix ? `${prefix} ${token}` : token;

    return {
        enabled: true,
        resource: 'health-diagnostics',
        headers: {
            [headerName]: headerValue,
        },
    };
}

function listTurneroClinicProfiles(options = {}) {
    const profilesDir = path.resolve(
        options.profilesDir || getTurneroClinicProfilesDir(options.root)
    );
    if (!fs.existsSync(profilesDir)) {
        return [];
    }

    return fs
        .readdirSync(profilesDir, { withFileTypes: true })
        .filter((entry) => entry.isFile() && entry.name.endsWith('.json'))
        .map((entry) => {
            const filePath = path.join(profilesDir, entry.name);
            const rawProfile = readJsonFile(filePath);
            const validation = validateTurneroClinicProfile(rawProfile, {
                sourceLabel: entry.name,
            });
            return {
                id: path.basename(entry.name, '.json'),
                filePath,
                ...validation,
            };
        })
        .sort((left, right) => left.id.localeCompare(right.id));
}

function getTurneroClinicProfileEntry(profileId, options = {}) {
    const normalizedId = normalizeString(profileId);
    if (!normalizedId) {
        throw new Error('Debes indicar --id para resolver el perfil clinico.');
    }

    const profilesDir = path.resolve(
        options.profilesDir || getTurneroClinicProfilesDir(options.root)
    );
    const filePath = path.join(profilesDir, `${normalizedId}.json`);
    if (!fs.existsSync(filePath)) {
        throw new Error(`No existe el perfil clinico ${normalizedId}`);
    }

    const rawProfile = readJsonFile(filePath);
    const validation = validateTurneroClinicProfile(rawProfile, {
        sourceLabel: `${normalizedId}.json`,
    });

    return {
        id: normalizedId,
        filePath,
        ...validation,
    };
}

function getActiveTurneroClinicProfileStatus(options = {}) {
    const activePath = path.resolve(
        options.outputPath || getTurneroActiveClinicProfilePath(options.root)
    );
    if (!fs.existsSync(activePath)) {
        return {
            ok: false,
            exists: false,
            activePath,
            matchingProfileId: '',
            profile: null,
            errors: [`No existe el perfil activo en ${activePath}`],
            warnings: [],
        };
    }

    const rawProfile = readJsonFile(activePath);
    const validation = validateTurneroClinicProfile(rawProfile, {
        sourceLabel: path.basename(activePath),
    });
    const normalizedProfile = validation.profile;
    const catalog = listTurneroClinicProfiles(options);
    const matchingEntry =
        catalog.find((entry) => entry.id === normalizedProfile.clinic_id) ||
        null;
    const matchesCatalog =
        matchingEntry !== null &&
        JSON.stringify(matchingEntry.profile) ===
            JSON.stringify(normalizedProfile);

    return {
        ok: validation.ok,
        exists: true,
        activePath,
        matchingProfileId: matchingEntry ? matchingEntry.id : '',
        matchesCatalog,
        catalogReady: validation.ok && matchesCatalog,
        profileFingerprint:
            getTurneroClinicProfileFingerprint(normalizedProfile),
        profile: normalizedProfile,
        errors: validation.errors,
        warnings: [
            ...validation.warnings,
            ...(matchingEntry
                ? matchesCatalog
                    ? []
                    : [
                          `El perfil activo no coincide exactamente con ${matchingEntry.id}.json`,
                      ]
                : [
                      `No existe entrada catalogada para clinic_id=${normalizedProfile.clinic_id}`,
                  ]),
        ],
    };
}

function stageTurneroClinicProfile(profileId, options = {}) {
    const entry = getTurneroClinicProfileEntry(profileId, options);
    if (!entry.ok) {
        const error = new Error(
            `El perfil ${profileId} no paso validacion:\n- ${entry.errors.join('\n- ')}`
        );
        error.validation = entry;
        throw error;
    }

    const outputPath = path.resolve(
        options.outputPath || getTurneroActiveClinicProfilePath(options.root)
    );
    if (!options.dryRun) {
        writeJsonFile(outputPath, entry.profile);
    }

    return {
        ok: true,
        id: entry.id,
        sourcePath: entry.filePath,
        outputPath,
        dryRun: Boolean(options.dryRun),
        profile: entry.profile,
        warnings: entry.warnings,
    };
}

async function verifyRemoteTurneroClinicProfile(baseUrl, options = {}) {
    const normalizedBaseUrl = normalizeString(baseUrl);
    if (!/^https?:\/\//.test(normalizedBaseUrl)) {
        throw new Error(`Base URL inválida para verify-remote: ${baseUrl}`);
    }

    const active = getActiveTurneroClinicProfileStatus(options);
    const localProfile = active.profile || null;
    const localFingerprint = localProfile
        ? getTurneroClinicProfileFingerprint(localProfile)
        : '';
    const diagnosticsAccess = resolveDiagnosticsAccess(options);
    const remoteUrl = new URL(
        `/api.php?resource=${diagnosticsAccess.resource}`,
        normalizedBaseUrl
    ).toString();

    let response;
    try {
        response = await requestJson(remoteUrl, {
            timeoutMs: Number.parseInt(options.timeoutMs, 10) || 10000,
            headers: diagnosticsAccess.headers,
        });
    } catch (error) {
        return {
            command: 'verify-remote',
            ok: false,
            baseUrl: normalizedBaseUrl,
            remoteUrl,
            activePath:
                active.activePath ||
                getTurneroActiveClinicProfilePath(options.root),
            profile: localProfile,
            localFingerprint,
            errors: [
                `No se pudo consultar /health en ${normalizedBaseUrl}: ${error && error.message ? error.message : 'error desconocido'}`,
            ],
            warnings: active.warnings || [],
            publicSync: null,
            turneroPilot: null,
            diagnosticsAuthorized: diagnosticsAccess.enabled,
            remoteResource: diagnosticsAccess.resource,
        };
    }

    const payload = response.payload;

    const checks =
        payload && payload.checks && typeof payload.checks === 'object'
            ? payload.checks
            : {};
    const turneroPilot =
        checks.turneroPilot && typeof checks.turneroPilot === 'object'
            ? checks.turneroPilot
            : null;
    const publicSync =
        checks.publicSync && typeof checks.publicSync === 'object'
            ? checks.publicSync
            : null;
    const errors = [...(active.ok ? [] : active.errors || [])];
    const warnings = [...(active.warnings || [])];
    const healthLooksOk =
        Boolean(payload) && payload.ok === true && payload.status === 'ok';
    const publicHealthRedacted =
        !diagnosticsAccess.enabled &&
        healthLooksOk &&
        turneroPilot === null &&
        publicSync === null;

    if (!response.ok) {
        errors.push(`Health remoto respondió HTTP ${response.status}`);
    }
    if (!healthLooksOk) {
        errors.push('Health remoto no devolvió un payload ok/status=ok.');
    }
    if (!turneroPilot && !publicHealthRedacted) {
        errors.push('Health remoto no expone checks.turneroPilot.');
    }

    if (turneroPilot) {
        if (turneroPilot.configured !== true) {
            errors.push('checks.turneroPilot.configured debe ser true.');
        }
        if (String(turneroPilot.profileSource || '').trim() !== 'file') {
            errors.push(
                `checks.turneroPilot.profileSource debe ser file y llegó ${String(
                    turneroPilot.profileSource || 'desconocido'
                )}.`
            );
        }
        if (
            localProfile &&
            String(turneroPilot.clinicId || '').trim() !==
                String(localProfile.clinic_id || '').trim()
        ) {
            errors.push(
                `checks.turneroPilot.clinicId=${String(
                    turneroPilot.clinicId || ''
                )} no coincide con ${String(localProfile.clinic_id || '')}.`
            );
        }
        if (
            localFingerprint &&
            String(turneroPilot.profileFingerprint || '').trim() !==
                localFingerprint
        ) {
            errors.push(
                `checks.turneroPilot.profileFingerprint=${String(
                    turneroPilot.profileFingerprint || ''
                )} no coincide con ${localFingerprint}.`
            );
        }
        if (turneroPilot.catalogReady !== true) {
            errors.push('checks.turneroPilot.catalogReady debe ser true.');
        }
        if (String(turneroPilot.releaseMode || '').trim() !== 'web_pilot') {
            errors.push('checks.turneroPilot.releaseMode debe ser web_pilot.');
        }
        if (String(turneroPilot.adminModeDefault || '').trim() !== 'basic') {
            errors.push('checks.turneroPilot.adminModeDefault debe ser basic.');
        }
        if (turneroPilot.separateDeploy !== true) {
            errors.push('checks.turneroPilot.separateDeploy debe ser true.');
        }

        for (const surfaceKey of SURFACE_KEYS) {
            const localRoute = String(
                localProfile?.surfaces?.[surfaceKey]?.route || ''
            ).trim();
            const remoteRoute = String(
                turneroPilot?.surfaces?.[surfaceKey]?.route || ''
            ).trim();
            if (localRoute && remoteRoute && localRoute !== remoteRoute) {
                errors.push(
                    `checks.turneroPilot.surfaces.${surfaceKey}.route=${remoteRoute} no coincide con ${localRoute}.`
                );
            }
        }
    }

    if (!publicSync) {
        if (!publicHealthRedacted) {
            errors.push('Health remoto no expone checks.publicSync.');
        }
    } else {
        if (publicSync.configured !== true) {
            errors.push('checks.publicSync.configured debe ser true.');
        }
        if (publicSync.healthy !== true) {
            errors.push(
                `checks.publicSync.healthy debe ser true (${String(publicSync.state || 'unknown')}).`
            );
        }
        if (publicSync.headDrift === true) {
            errors.push('checks.publicSync.headDrift debe ser false.');
        }
        if (!String(publicSync.deployedCommit || '').trim()) {
            errors.push(
                'checks.publicSync.deployedCommit no puede estar vacío.'
            );
        }
    }

    if (publicHealthRedacted) {
        warnings.push(
            'Health remoto redactado sin diagnostics token; se omite validacion profunda de turneroPilot/publicSync.'
        );
    }

    return {
        command: 'verify-remote',
        ok: errors.length === 0,
        baseUrl: normalizedBaseUrl,
        remoteUrl,
        diagnosticsAuthorized: diagnosticsAccess.enabled,
        remoteResource: diagnosticsAccess.resource,
        publicHealthRedacted,
        activePath:
            active.activePath ||
            getTurneroActiveClinicProfilePath(options.root),
        profile: localProfile,
        localFingerprint,
        publicSync,
        turneroPilot,
        errors,
        warnings,
    };
}

module.exports = {
    PROFILE_SCHEMA,
    getTurneroClinicProfilesDir,
    getTurneroActiveClinicProfilePath,
    getTurneroClinicProfileFingerprint,
    normalizeTurneroClinicProfile,
    validateTurneroClinicProfile,
    listTurneroClinicProfiles,
    getTurneroClinicProfileEntry,
    getActiveTurneroClinicProfileStatus,
    stageTurneroClinicProfile,
    verifyRemoteTurneroClinicProfile,
};
