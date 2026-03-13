'use strict';

const fs = require('node:fs');
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
        enabled:
            typeof source.enabled === 'boolean' ? source.enabled : true,
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

module.exports = {
    PROFILE_SCHEMA,
    getTurneroClinicProfilesDir,
    getTurneroActiveClinicProfilePath,
    normalizeTurneroClinicProfile,
    validateTurneroClinicProfile,
    listTurneroClinicProfiles,
    getTurneroClinicProfileEntry,
    getActiveTurneroClinicProfileStatus,
    stageTurneroClinicProfile,
};
