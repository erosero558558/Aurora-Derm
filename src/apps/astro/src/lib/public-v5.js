import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
    getHomeV3Data,
    getHubV3Data,
    getLegalIndex,
    getLegalPageV3Data,
    getServiceDetailV3Data,
    getTelemedicineV3Data,
} from './public-v3.js';
import { getLocaleSwitchPath } from './content.js';

const REPO_ROOT = path.resolve(
    path.dirname(fileURLToPath(import.meta.url)),
    '..',
    '..',
    '..',
    '..',
    '..'
);
const V5_NAVIGATION_PATH = path.join(
    REPO_ROOT,
    'content',
    'public-v5',
    'navigation.json'
);
let v5NavigationConfigCache = null;

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

function readV5NavigationConfig() {
    if (v5NavigationConfigCache) {
        return v5NavigationConfigCache;
    }

    try {
        const raw = fs.readFileSync(V5_NAVIGATION_PATH, 'utf8');
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed === 'object') {
            v5NavigationConfigCache = parsed;
            return v5NavigationConfigCache;
        }
    } catch (_error) {
        // Fall through to minimal safe defaults.
    }

    v5NavigationConfigCache = {
        es: {
            brand: {
                eyebrow: 'Dermatologia de precision',
                line1: 'Piel en',
                line2: 'Armonia',
            },
            labels: {
                primaryNav: 'Principal',
                home: 'Inicio',
                services: 'Servicios',
                telemedicine: 'Telemedicina',
                legal: 'Legal',
                book: 'Reservar',
            },
            links: [
                { id: 'home', href: '/es/', label: 'Inicio' },
                {
                    id: 'services',
                    href: '/es/servicios/',
                    label: 'Servicios',
                    kind: 'mega',
                },
                {
                    id: 'telemedicine',
                    href: '/es/telemedicina/',
                    label: 'Telemedicina',
                },
                { id: 'legal', href: '/es/legal/terminos/', label: 'Legal' },
            ],
            mega: { intro: {}, families: [], groups: [], featured: [] },
            footer: {},
            bookingHref: '/es/servicios/#v5-booking',
        },
        en: {
            brand: {
                eyebrow: 'Precision dermatology',
                line1: 'Piel en',
                line2: 'Armonia',
            },
            labels: {
                primaryNav: 'Primary',
                home: 'Home',
                services: 'Services',
                telemedicine: 'Telemedicine',
                legal: 'Legal',
                book: 'Book',
            },
            links: [
                { id: 'home', href: '/en/', label: 'Home' },
                {
                    id: 'services',
                    href: '/en/services/',
                    label: 'Services',
                    kind: 'mega',
                },
                {
                    id: 'telemedicine',
                    href: '/en/telemedicine/',
                    label: 'Telemedicine',
                },
                { id: 'legal', href: '/en/legal/terms/', label: 'Legal' },
            ],
            mega: { intro: {}, families: [], groups: [], featured: [] },
            footer: {},
            bookingHref: '/en/services/#v5-booking',
        },
    };
    return v5NavigationConfigCache;
}

export function getPublicNavigationModel(locale, pathname = '/') {
    const normalizedLocale = locale === 'en' ? 'en' : 'es';
    const config = readV5NavigationConfig();
    const raw = config[normalizedLocale] ||
        config.es || {
            brand: {},
            labels: {},
            links: [],
            mega: {},
            footer: {},
            bookingHref:
                normalizedLocale === 'en'
                    ? '/en/services/#v5-booking'
                    : '/es/servicios/#v5-booking',
        };
    const safe = sanitizeObjectValues(raw, normalizedLocale);

    return {
        locale: normalizedLocale,
        pathname,
        brand: {
            eyebrow: safe?.brand?.eyebrow || '',
            line1: safe?.brand?.line1 || '',
            line2: safe?.brand?.line2 || '',
        },
        switchHref: getLocaleSwitchPath(
            normalizedLocale === 'en' ? 'es' : 'en',
            pathname
        ),
        switchLabel: normalizedLocale === 'en' ? 'ES' : 'EN',
        bookingHref:
            String(safe?.bookingHref || '').trim() ||
            (normalizedLocale === 'en'
                ? '/en/services/#v5-booking'
                : '/es/servicios/#v5-booking'),
        labels: safe?.labels || {},
        links: Array.isArray(safe?.links) ? safe.links : [],
        mega:
            safe?.mega && typeof safe.mega === 'object'
                ? safe.mega
                : { intro: {}, families: [], groups: [], featured: [] },
        footer:
            safe?.footer && typeof safe.footer === 'object' ? safe.footer : {},
    };
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
