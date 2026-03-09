import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO_ROOT = path.resolve(
    path.dirname(fileURLToPath(import.meta.url)),
    '..',
    '..',
    '..',
    '..',
    '..'
);

const cache = new Map();

const LEGAL_SLUG_MAP_ES_TO_EN = {
    terminos: 'terms',
    privacidad: 'privacy',
    cookies: 'cookies',
    'aviso-medico': 'medical-disclaimer',
};

const LEGAL_SLUG_MAP_EN_TO_ES = {
    terms: 'terminos',
    privacy: 'privacidad',
    cookies: 'cookies',
    'medical-disclaimer': 'aviso-medico',
};

function normalizeLocale(locale) {
    return locale === 'en' ? 'en' : 'es';
}

function readJson(relativePath) {
    const filePath = path.join(REPO_ROOT, relativePath);
    const key = filePath;
    if (cache.has(key)) {
        return cache.get(key);
    }
    const raw = fs.readFileSync(filePath, 'utf8');
    const parsed = JSON.parse(raw);
    cache.set(key, parsed);
    return parsed;
}

function readLocaleJson(locale, fileName) {
    const safeLocale = normalizeLocale(locale);
    return readJson(path.join('content', 'public-v6', safeLocale, fileName));
}

function normalizePath(pathname) {
    const raw = String(pathname || '/').trim();
    if (!raw) {
        return '/';
    }
    const withLeading = raw.startsWith('/') ? raw : `/${raw}`;
    return withLeading.endsWith('/') ? withLeading : `${withLeading}/`;
}

function mapLegalSwitch(pathname, locale) {
    const safePath = normalizePath(pathname);
    const parts = safePath.split('/').filter(Boolean);
    if (parts.length < 3 || parts[1] !== 'legal') {
        return null;
    }

    const slug = parts[2];
    if (locale === 'es') {
        const mapped = LEGAL_SLUG_MAP_ES_TO_EN[slug];
        if (!mapped) {
            return null;
        }
        return `/en/legal/${mapped}/`;
    }

    const mapped = LEGAL_SLUG_MAP_EN_TO_ES[slug];
    if (!mapped) {
        return null;
    }
    return `/es/legal/${mapped}/`;
}

function mapPublicSectionSwitch(pathname, locale) {
    const safePath = normalizePath(pathname);

    if (locale === 'es') {
        if (safePath === '/es/servicios/') {
            return '/en/services/';
        }
        if (safePath.startsWith('/es/servicios/')) {
            return `/en/services/${safePath.slice('/es/servicios/'.length)}`;
        }
        if (safePath === '/es/telemedicina/') {
            return '/en/telemedicine/';
        }
        if (safePath.startsWith('/es/telemedicina/')) {
            return `/en/telemedicine/${safePath.slice('/es/telemedicina/'.length)}`;
        }
        return null;
    }

    if (safePath === '/en/services/') {
        return '/es/servicios/';
    }
    if (safePath.startsWith('/en/services/')) {
        return `/es/servicios/${safePath.slice('/en/services/'.length)}`;
    }
    if (safePath === '/en/telemedicine/') {
        return '/es/telemedicina/';
    }
    if (safePath.startsWith('/en/telemedicine/')) {
        return `/es/telemedicina/${safePath.slice('/en/telemedicine/'.length)}`;
    }
    return null;
}

function buildLocaleSwitchHref(locale, pathname) {
    const safeLocale = normalizeLocale(locale);
    const safePath = normalizePath(pathname);

    const legalSwitch = mapLegalSwitch(safePath, safeLocale);
    if (legalSwitch) {
        return legalSwitch;
    }

    const sectionSwitch = mapPublicSectionSwitch(safePath, safeLocale);
    if (sectionSwitch) {
        return sectionSwitch;
    }

    if (safeLocale === 'es') {
        if (safePath.startsWith('/es/')) {
            return `/en/${safePath.slice(4)}`;
        }
        return '/en/';
    }

    if (safePath.startsWith('/en/')) {
        return `/es/${safePath.slice(4)}`;
    }
    return '/es/';
}

export function getV6NavigationModel(locale, pathname = '/') {
    const safeLocale = normalizeLocale(locale);
    const payload = readLocaleJson(safeLocale, 'navigation.json');
    const switchHref = buildLocaleSwitchHref(safeLocale, pathname);
    return {
        ...payload,
        locale: safeLocale,
        pathname: normalizePath(pathname),
        header: {
            ...(payload.header || {}),
            switchLabel: safeLocale === 'es' ? 'EN' : 'ES',
            switchHref,
        },
    };
}

export function getV6HomeData(locale) {
    return readLocaleJson(normalizeLocale(locale), 'home.json');
}

export function getV6HubData(locale) {
    return readLocaleJson(normalizeLocale(locale), 'hub.json');
}

export function getV6TelemedicineData(locale) {
    return readLocaleJson(normalizeLocale(locale), 'telemedicine.json');
}

export function getV6LegalData(locale) {
    return readLocaleJson(normalizeLocale(locale), 'legal.json');
}

export function getV6LegalIndex(locale) {
    const legal = getV6LegalData(locale);
    return Array.isArray(legal.index) ? legal.index : [];
}

export function getV6LegalPage(locale, slug) {
    const legal = getV6LegalData(locale);
    const pages = legal && typeof legal.pages === 'object' ? legal.pages : {};
    return pages[slug] || null;
}

export function getV6LegalAltSlug(locale, slug) {
    if (normalizeLocale(locale) === 'es') {
        return LEGAL_SLUG_MAP_ES_TO_EN[slug] || slug;
    }
    return LEGAL_SLUG_MAP_EN_TO_ES[slug] || slug;
}

export function getV6ServiceData(locale) {
    return readLocaleJson(normalizeLocale(locale), 'service.json');
}

export function getV6Services(locale) {
    const payload = getV6ServiceData(locale);
    return Array.isArray(payload.services) ? payload.services : [];
}

export function getV6ServiceBySlug(locale, slug) {
    return (
        getV6Services(locale).find((service) => service.slug === slug) || null
    );
}

export function getV6ServiceSlugs() {
    return getV6Services('es').map((service) => service.slug);
}

export function v6ServicePath(locale, slug) {
    const safeLocale = normalizeLocale(locale);
    if (safeLocale === 'en') {
        return `/en/services/${slug}/`;
    }
    return `/es/servicios/${slug}/`;
}

export function v6LegalPath(locale, slug) {
    const safeLocale = normalizeLocale(locale);
    if (safeLocale === 'en') {
        return `/en/legal/${slug}/`;
    }
    return `/es/legal/${slug}/`;
}

export function getV6AssetsManifest() {
    return readJson(path.join('content', 'public-v6', 'assets-manifest.json'));
}

export function getV6AssetById(assetId) {
    const manifest = getV6AssetsManifest();
    const assets = Array.isArray(manifest.assets) ? manifest.assets : [];
    return assets.find((asset) => asset.id === assetId) || null;
}
