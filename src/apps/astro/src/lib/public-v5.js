import {
    getHomeV3Data,
    getHubV3Data,
    getLegalIndex,
    getLegalPageV3Data,
    getPublicNavigationModel as getPublicNavigationModelV3,
    getServiceDetailV3Data,
    getTelemedicineV3Data,
} from './public-v3.js';

const TECHNICAL_COPY_PATTERN = /\b(bridge|runtime|shell|v3|v4)\b/giu;

function sanitizeString(value, locale) {
    const raw = String(value ?? '');
    const replacements =
        locale === 'en'
            ? {
                  bridge: 'booking',
                  runtime: 'flow',
                  shell: 'experience',
                  v3: '',
                  v4: '',
              }
            : {
                  bridge: 'reserva',
                  runtime: 'flujo',
                  shell: 'experiencia',
                  v3: '',
                  v4: '',
              };

    return raw
        .replace(TECHNICAL_COPY_PATTERN, (match) => {
            const key = String(match || '').toLowerCase();
            return replacements[key] ?? '';
        })
        .replace(/\s{2,}/gu, ' ')
        .trim();
}

function sanitizeObjectValues(payload, locale) {
    if (Array.isArray(payload)) {
        return payload.map((item) => sanitizeObjectValues(item, locale));
    }

    if (!payload || typeof payload !== 'object') {
        if (typeof payload === 'string') {
            return sanitizeString(payload, locale);
        }
        return payload;
    }

    const next = {};
    for (const [key, value] of Object.entries(payload)) {
        if (typeof value === 'string') {
            next[key] = sanitizeString(value, locale);
            continue;
        }
        next[key] = sanitizeObjectValues(value, locale);
    }
    return next;
}

export function getPublicNavigationModel(locale, pathname = '/') {
    return sanitizeObjectValues(
        getPublicNavigationModelV3(locale, pathname),
        locale
    );
}

export function getHomeV5Data(locale) {
    return sanitizeObjectValues(getHomeV3Data(locale), locale);
}

export function getHubV5Data(locale) {
    return sanitizeObjectValues(getHubV3Data(locale), locale);
}

export function getServiceDetailV5Data(slug, locale) {
    return sanitizeObjectValues(getServiceDetailV3Data(slug, locale), locale);
}

export function getTelemedicineV5Data(locale) {
    return sanitizeObjectValues(getTelemedicineV3Data(locale), locale);
}

export function getLegalPageV5Data(slug, locale) {
    return sanitizeObjectValues(getLegalPageV3Data(slug, locale), locale);
}

export function getLegalIndexV5(locale) {
    return sanitizeObjectValues(getLegalIndex(locale), locale);
}
