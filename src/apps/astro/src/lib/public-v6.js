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

const SOFTWARE_ROUTE_MAP = {
    es: {
        landing: '/es/software/turnero-clinicas/',
        demo: '/es/software/turnero-clinicas/demo/',
        status: '/es/software/turnero-clinicas/estado-turno/',
        dashboard: '/es/software/turnero-clinicas/dashboard/',
    },
    en: {
        landing: '/en/software/clinic-flow-suite/',
        demo: '/en/software/clinic-flow-suite/demo/',
        status: '/en/software/clinic-flow-suite/queue-status/',
        dashboard: '/en/software/clinic-flow-suite/dashboard/',
    },
};

function hasText(value) {
    return typeof value === 'string' && value.trim().length > 0;
}

function normalizeText(value) {
    return hasText(value) ? value.trim() : '';
}

function normalizeHref(value) {
    const raw = normalizeText(value);
    return raw && raw !== '#' ? raw : '';
}

function isObject(value) {
    return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

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

function sanitizeBreadcrumb(items) {
    return Array.isArray(items)
        ? items
              .map((item) => {
                  const label = normalizeText(item?.label);
                  const href = normalizeHref(item?.href);
                  return label && href ? { label, href } : null;
              })
              .filter(Boolean)
        : [];
}

function sanitizeImageAsset(asset, fallbackAlt = '') {
    const source = isObject(asset) ? asset : {};
    const src = normalizeText(source.src || source.image);
    const srcset = normalizeText(source.srcset);
    const alt = normalizeText(source.alt) || normalizeText(fallbackAlt);
    return {
        src,
        srcset,
        alt,
    };
}

function sanitizeBookingStatus(status) {
    if (!isObject(status)) {
        return {};
    }
    return {
        eyebrow: normalizeText(status.eyebrow),
        title: normalizeText(status.title),
        description: normalizeText(status.description),
        ctaLabel: normalizeText(status.ctaLabel),
        ctaHref: normalizeHref(status.ctaHref),
    };
}

function sanitizeHomeHero(hero) {
    const source = isObject(hero) ? hero : {};
    const rawAutoplay = Number(source.autoplayMs || 7000);
    const labels = isObject(source.labels) ? source.labels : {};
    const slides = Array.isArray(source.slides)
        ? source.slides
              .map((slide, index) => {
                  const title = normalizeText(slide?.title);
                  const description = normalizeText(slide?.description);
                  const image = normalizeText(slide?.image);
                  const href = normalizeHref(slide?.href);
                  if (!title || !description || !image || !href) {
                      return null;
                  }
                  return {
                      id: normalizeText(slide?.id) || `v6-hero-slide-${index + 1}`,
                      category: normalizeText(slide?.category),
                      title,
                      description,
                      image,
                      srcset: normalizeText(slide?.srcset),
                      alt: normalizeText(slide?.alt) || title,
                      href,
                  };
              })
              .filter(Boolean)
        : [];

    return {
        autoplayMs:
            Number.isFinite(rawAutoplay) && rawAutoplay > 1000 ? rawAutoplay : 7000,
        labels: {
            prev: normalizeText(labels.prev),
            next: normalizeText(labels.next),
            pause: normalizeText(labels.pause),
            play: normalizeText(labels.play),
            openRoute: normalizeText(labels.openRoute),
            indicators: normalizeText(labels.indicators),
            indicatorItemPrefix: normalizeText(labels.indicatorItemPrefix),
        },
        slides,
    };
}

function buildPreloadImage(image, fallbackAlt = '') {
    const safeImage = sanitizeImageAsset(image, fallbackAlt);
    return {
        src: safeImage.src,
        srcset: safeImage.srcset,
        alt: safeImage.alt,
    };
}

function buildPreloadImageFromHero(hero) {
    const firstSlide = Array.isArray(hero?.slides) ? hero.slides[0] : null;
    if (!firstSlide) {
        return { src: '', srcset: '', alt: '' };
    }
    return {
        src: normalizeText(firstSlide.image),
        srcset: normalizeText(firstSlide.srcset),
        alt: normalizeText(firstSlide.alt) || normalizeText(firstSlide.title),
    };
}

function sanitizeNewsStrip(item) {
    if (!isObject(item)) {
        return {};
    }
    return {
        label: normalizeText(item.label),
        headline: normalizeText(item.headline),
        href: normalizeHref(item.href),
        expandLabel: normalizeText(item.expandLabel),
        collapseLabel: normalizeText(item.collapseLabel),
        detail: normalizeText(item.detail),
        ctaLabel: normalizeText(item.ctaLabel),
        localeAria: normalizeText(item.localeAria),
    };
}

function sanitizeEditorialCard(card, index) {
    const title = normalizeText(card?.title);
    const href = normalizeHref(card?.href);
    const image = normalizeText(card?.image);
    if (!title || !href || !image) {
        return null;
    }
    return {
        id: normalizeText(card?.id) || `editorial-card-${index + 1}`,
        type: normalizeText(card?.type),
        size: normalizeText(card?.size),
        category: normalizeText(card?.category),
        title,
        copy: normalizeText(card?.copy),
        href,
        image,
        alt: normalizeText(card?.alt) || title,
    };
}

function sanitizeHomeSection(section) {
    if (!isObject(section)) {
        return {};
    }
    return {
        eyebrow: normalizeText(section.eyebrow),
        title: normalizeText(section.title),
        deck: normalizeText(section.deck),
        ctaLabel: normalizeText(section.ctaLabel),
        cards: Array.isArray(section.cards)
            ? section.cards.map(sanitizeEditorialCard).filter(Boolean)
            : [],
    };
}

function sanitizeHubCard(item) {
    const title = normalizeText(item?.title);
    const href = normalizeHref(item?.href);
    const image = normalizeText(item?.image);
    if (!title || !href || !image) {
        return null;
    }
    return {
        slug: normalizeText(item?.slug),
        category: normalizeText(item?.category),
        title,
        copy: normalizeText(item?.copy),
        image,
        href,
    };
}

function sanitizeHubUi(ui) {
    const source = isObject(ui) ? ui : {};
    const menu = isObject(source.menu) ? source.menu : {};
    const featured = isObject(source.featured) ? source.featured : {};
    const initiatives = isObject(source.initiatives) ? source.initiatives : {};
    return {
        menu: {
            featured: normalizeText(menu.featured),
            initiatives: normalizeText(menu.initiatives),
        },
        featured: {
            eyebrow: normalizeText(featured.eyebrow),
            title: normalizeText(featured.title),
        },
        sectionLabelPrefix: normalizeText(source.sectionLabelPrefix),
        routeLabel: normalizeText(source.routeLabel),
        ctaLabel: normalizeText(source.ctaLabel),
        railAria: normalizeText(source.railAria),
        initiatives: {
            eyebrow: normalizeText(initiatives.eyebrow),
            title: normalizeText(initiatives.title),
        },
    };
}

function sanitizeHubSection(section, index) {
    const title = normalizeText(section?.title);
    const cards = Array.isArray(section?.cards)
        ? section.cards.map(sanitizeHubCard).filter(Boolean)
        : [];
    if (!title || !cards.length) {
        return null;
    }
    return {
        id: normalizeText(section?.id) || `section-${index + 1}`,
        title,
        deck: normalizeText(section?.deck),
        cards,
    };
}

function sanitizeHomeData(payload) {
    const source = isObject(payload) ? payload : {};
    const hero = sanitizeHomeHero(source.hero);
    return {
        ...source,
        title: normalizeText(source.title),
        description: normalizeText(source.description),
        hero,
        preloadImage: buildPreloadImageFromHero(hero),
        newsStrip: sanitizeNewsStrip(source.newsStrip),
        editorial: sanitizeHomeSection(source.editorial),
        corporateMatrix: sanitizeHomeSection(source.corporateMatrix),
        bookingStatus: sanitizeBookingStatus(source.bookingStatus),
    };
}

function sanitizeHubData(payload) {
    const source = isObject(payload) ? payload : {};
    const heroImage = sanitizeImageAsset(source.heroImage, source.heading);
    return {
        ...source,
        title: normalizeText(source.title),
        description: normalizeText(source.description),
        breadcrumb: sanitizeBreadcrumb(source.breadcrumb),
        heading: normalizeText(source.heading),
        heroImage,
        preloadImage: buildPreloadImage(heroImage, source.heading),
        introTitle: normalizeText(source.introTitle),
        introDeck: normalizeText(source.introDeck),
        ui: sanitizeHubUi(source.ui),
        featured: Array.isArray(source.featured)
            ? source.featured.map(sanitizeHubCard).filter(Boolean)
            : [],
        sections: Array.isArray(source.sections)
            ? source.sections.map(sanitizeHubSection).filter(Boolean)
            : [],
        initiatives: Array.isArray(source.initiatives)
            ? source.initiatives.map(sanitizeHubCard).filter(Boolean)
            : [],
        bookingStatus: sanitizeBookingStatus(source.bookingStatus),
    };
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

function mapSoftwareSwitch(pathname, locale) {
    const safePath = normalizePath(pathname);
    const safeLocale = normalizeLocale(locale);
    const sourceMap = SOFTWARE_ROUTE_MAP[safeLocale];
    const targetMap = SOFTWARE_ROUTE_MAP[safeLocale === 'es' ? 'en' : 'es'];
    const entry = Object.entries(sourceMap).find(([, route]) => route === safePath);
    if (!entry) {
        return null;
    }
    return targetMap[entry[0]] || null;
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

    const softwareSwitch = mapSoftwareSwitch(safePath, safeLocale);
    if (softwareSwitch) {
        return softwareSwitch;
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
    return sanitizeHomeData(readLocaleJson(normalizeLocale(locale), 'home.json'));
}

export function getV6HubData(locale) {
    return sanitizeHubData(readLocaleJson(normalizeLocale(locale), 'hub.json'));
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

export function getV6SoftwareData(locale) {
    return readLocaleJson(normalizeLocale(locale), 'software.json');
}

export function getV6SoftwarePage(locale, pageKey = 'landing') {
    const payload = getV6SoftwareData(locale);
    const pages = payload && typeof payload.pages === 'object' ? payload.pages : {};
    return pages[pageKey] || null;
}

export function getV6SoftwareNavOverrides(locale) {
    const payload = getV6SoftwareData(locale);
    return payload && typeof payload.nav === 'object' ? payload.nav : {};
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

export function v6SoftwarePath(locale, pageKey = 'landing') {
    const safeLocale = normalizeLocale(locale);
    return SOFTWARE_ROUTE_MAP[safeLocale]?.[pageKey] || SOFTWARE_ROUTE_MAP[safeLocale].landing;
}

export function mergeV6NavModel(baseNavModel = {}, overrides = {}) {
    const baseUi =
        baseNavModel && typeof baseNavModel.ui === 'object' ? baseNavModel.ui : {};
    const overrideUi =
        overrides && typeof overrides.ui === 'object' ? overrides.ui : {};
    const baseHeaderUi =
        baseUi.header && typeof baseUi.header === 'object' ? baseUi.header : {};
    const overrideHeaderUi =
        overrideUi.header && typeof overrideUi.header === 'object'
            ? overrideUi.header
            : {};
    const baseFooterUi =
        baseUi.footer && typeof baseUi.footer === 'object' ? baseUi.footer : {};
    const overrideFooterUi =
        overrideUi.footer && typeof overrideUi.footer === 'object'
            ? overrideUi.footer
            : {};
    const basePageHeadUi =
        baseUi.pageHead && typeof baseUi.pageHead === 'object'
            ? baseUi.pageHead
            : {};
    const overridePageHeadUi =
        overrideUi.pageHead && typeof overrideUi.pageHead === 'object'
            ? overrideUi.pageHead
            : {};
    const overrideHeader =
        overrides && typeof overrides.header === 'object' ? overrides.header : {};
    const overrideFooter =
        overrides && typeof overrides.footer === 'object' ? overrides.footer : {};
    const baseHeader =
        baseNavModel && typeof baseNavModel.header === 'object'
            ? baseNavModel.header
            : {};
    const baseFooter =
        baseNavModel && typeof baseNavModel.footer === 'object'
            ? baseNavModel.footer
            : {};

    return {
        ...baseNavModel,
        ...overrides,
        brand: {
            ...(baseNavModel?.brand && typeof baseNavModel.brand === 'object'
                ? baseNavModel.brand
                : {}),
            ...(overrides?.brand && typeof overrides.brand === 'object'
                ? overrides.brand
                : {}),
        },
        ui: {
            ...baseUi,
            ...overrideUi,
            shell: {
                ...(baseUi.shell && typeof baseUi.shell === 'object'
                    ? baseUi.shell
                    : {}),
                ...(overrideUi.shell && typeof overrideUi.shell === 'object'
                    ? overrideUi.shell
                    : {}),
            },
            header: {
                ...baseHeaderUi,
                ...overrideHeaderUi,
                search: {
                    ...(baseHeaderUi.search && typeof baseHeaderUi.search === 'object'
                        ? baseHeaderUi.search
                        : {}),
                    ...(overrideHeaderUi.search &&
                    typeof overrideHeaderUi.search === 'object'
                        ? overrideHeaderUi.search
                        : {}),
                },
            },
            footer: {
                ...baseFooterUi,
                ...overrideFooterUi,
            },
            pageHead: {
                ...basePageHeadUi,
                ...overridePageHeadUi,
            },
        },
        header: {
            ...baseHeader,
            ...overrideHeader,
            links: Array.isArray(overrideHeader.links)
                ? overrideHeader.links
                : baseHeader.links,
            searchEntries: Array.isArray(overrideHeader.searchEntries)
                ? overrideHeader.searchEntries
                : baseHeader.searchEntries,
        },
        footer: {
            ...baseFooter,
            ...overrideFooter,
            columns: Array.isArray(overrideFooter.columns)
                ? overrideFooter.columns
                : baseFooter.columns,
            policies: Array.isArray(overrideFooter.policies)
                ? overrideFooter.policies
                : baseFooter.policies,
        },
    };
}
