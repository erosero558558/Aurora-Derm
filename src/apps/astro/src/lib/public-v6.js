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

const SOFTWARE_PAGE_KEYS = ['landing', 'demo', 'status', 'dashboard'];

const SOFTWARE_NAV_ID_BY_PAGE_KEY = {
    landing: 'software',
    demo: 'demo',
    status: 'status',
    dashboard: 'dashboard',
};

const SOFTWARE_PAGE_KEY_BY_NAV_ID = {
    software: 'landing',
    demo: 'demo',
    status: 'status',
    dashboard: 'dashboard',
};

const SOFTWARE_STORY_LABELS = {
    es: {
        progress: 'Recorrido de la suite',
        previous: 'Paso anterior',
        next: 'Siguiente paso',
    },
    en: {
        progress: 'Suite progression',
        previous: 'Previous step',
        next: 'Next step',
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

function normalizeSoftwarePageKey(pageKey) {
    return SOFTWARE_PAGE_KEYS.includes(pageKey) ? pageKey : 'landing';
}

function getSoftwareNavId(pageKey) {
    const safePageKey = normalizeSoftwarePageKey(pageKey);
    return SOFTWARE_NAV_ID_BY_PAGE_KEY[safePageKey] || 'software';
}

function resolveSoftwarePageKey(locale, candidateId = '', candidateHref = '') {
    const safeLocale = normalizeLocale(locale);
    const safeId = normalizeText(candidateId);
    if (SOFTWARE_PAGE_KEY_BY_NAV_ID[safeId]) {
        return SOFTWARE_PAGE_KEY_BY_NAV_ID[safeId];
    }

    const safeHref = normalizePath(candidateHref);
    const routeEntry = Object.entries(SOFTWARE_ROUTE_MAP[safeLocale]).find(
        ([, route]) => normalizePath(route) === safeHref
    );
    return routeEntry ? routeEntry[0] : '';
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

function sanitizeTextList(items) {
    return Array.isArray(items) ? items.map(normalizeText).filter(Boolean) : [];
}

function sanitizeSoftwareAction(action) {
    const label = normalizeText(action?.label);
    const href = normalizeHref(action?.href);
    if (!label || !href) {
        return null;
    }
    return {
        label,
        href,
        variant: normalizeText(action?.variant),
    };
}

function sanitizeSoftwareMetric(metric) {
    const value = normalizeText(metric?.value);
    const label = normalizeText(metric?.label);
    if (!value || !label) {
        return null;
    }
    return {
        value,
        label,
        detail: normalizeText(metric?.detail),
    };
}

function sanitizeSoftwarePanel(panel) {
    const title = normalizeText(panel?.title);
    if (!title) {
        return null;
    }
    return {
        eyebrow: normalizeText(panel?.eyebrow),
        title,
        copy: normalizeText(panel?.copy),
    };
}

function sanitizeSoftwareMockupRow(row) {
    const label = normalizeText(row?.label);
    const value = normalizeText(row?.value);
    if (!label || !value) {
        return null;
    }
    return {
        label,
        value,
        meta: normalizeText(row?.meta),
    };
}

function sanitizeSoftwareMockup(mockup, fallbackTitle = '') {
    const source = isObject(mockup) ? mockup : {};
    const allowedKinds = new Set(['phone', 'status', 'dashboard']);
    const kind = allowedKinds.has(source.kind) ? source.kind : 'status';
    const title = normalizeText(source.title) || normalizeText(fallbackTitle);
    const rows = Array.isArray(source.rows)
        ? source.rows.map(sanitizeSoftwareMockupRow).filter(Boolean)
        : [];
    return {
        kind,
        eyebrow: normalizeText(source.eyebrow),
        title,
        chips: sanitizeTextList(source.chips),
        rows,
        footer: normalizeText(source.footer),
    };
}

function sanitizeSoftwareModuleCard(card) {
    const title = normalizeText(card?.title);
    if (!title) {
        return null;
    }
    return {
        eyebrow: normalizeText(card?.eyebrow),
        title,
        copy: normalizeText(card?.copy),
        bullets: sanitizeTextList(card?.bullets),
    };
}

function sanitizeSoftwareJourneyLane(lane) {
    const title = normalizeText(lane?.title);
    const steps = sanitizeTextList(lane?.steps);
    if (!title || !steps.length) {
        return null;
    }
    return {
        eyebrow: normalizeText(lane?.eyebrow),
        title,
        steps,
    };
}

function sanitizeSoftwareSurfaceCard(card) {
    const title = normalizeText(card?.title);
    const href = normalizeHref(card?.href);
    const ctaLabel = normalizeText(card?.ctaLabel);
    const mockup = sanitizeSoftwareMockup(card?.mockup, title);
    const hasMockup = Boolean(mockup.title || mockup.rows.length || mockup.chips.length);
    if (!title || !href || !ctaLabel || !hasMockup) {
        return null;
    }
    return {
        eyebrow: normalizeText(card?.eyebrow),
        title,
        copy: normalizeText(card?.copy),
        href,
        ctaLabel,
        mockup,
    };
}

function sanitizeSoftwareIntegrationGroup(group) {
    const title = normalizeText(group?.title);
    const items = sanitizeTextList(group?.items);
    if (!title || !items.length) {
        return null;
    }
    return {
        title,
        items,
    };
}

function sanitizeSoftwarePlan(plan) {
    const name = normalizeText(plan?.name);
    const price = normalizeText(plan?.price);
    const ctaLabel = normalizeText(plan?.ctaLabel);
    const ctaHref = normalizeHref(plan?.ctaHref);
    if (!name || !price || !ctaLabel || !ctaHref) {
        return null;
    }
    return {
        name,
        price,
        note: normalizeText(plan?.note),
        fit: normalizeText(plan?.fit),
        features: sanitizeTextList(plan?.features),
        ctaLabel,
        ctaHref,
        highlight: Boolean(plan?.highlight),
    };
}

function sanitizeSoftwareSecurityCard(card) {
    const title = normalizeText(card?.title);
    const items = sanitizeTextList(card?.items);
    if (!title || !items.length) {
        return null;
    }
    return {
        title,
        items,
    };
}

function sanitizeSoftwareFaqItem(item) {
    const question = normalizeText(item?.question);
    const answer = normalizeText(item?.answer);
    if (!question || !answer) {
        return null;
    }
    return {
        question,
        answer,
    };
}

function sanitizeSoftwareSearchEntry(entry) {
    const label = normalizeText(entry?.label);
    const href = normalizeHref(entry?.href);
    if (!label || !href) {
        return null;
    }
    return {
        label,
        href,
        eyebrow: normalizeText(entry?.eyebrow),
        deck: normalizeText(entry?.deck),
    };
}

function sanitizeSoftwareHeaderLink(link) {
    const label = normalizeText(link?.label);
    const href = normalizeHref(link?.href);
    if (!label || !href) {
        return null;
    }
    return {
        id: normalizeText(link?.id),
        label,
        href,
        kind: normalizeText(link?.kind) || 'standard',
    };
}

function sanitizeSoftwareFooterColumn(column) {
    const title = normalizeText(column?.title);
    const links = Array.isArray(column?.links)
        ? column.links
              .map((link) => {
                  const label = normalizeText(link?.label);
                  const href = normalizeHref(link?.href);
                  return label && href ? { label, href } : null;
              })
              .filter(Boolean)
        : [];
    const lines = sanitizeTextList(column?.lines);
    if (!title || (!links.length && !lines.length)) {
        return null;
    }
    return {
        title,
        links,
        lines,
    };
}

function sanitizeSoftwareNav(nav) {
    const source = isObject(nav) ? nav : {};
    const header = isObject(source.header) ? source.header : {};
    const footer = isObject(source.footer) ? source.footer : {};
    const ui = isObject(source.ui) ? source.ui : {};
    const headerUi = isObject(ui.header) ? ui.header : {};
    const searchUi = isObject(headerUi.search) ? headerUi.search : {};
    const rawLimit = Number(searchUi.resultsLimit || 8);
    return {
        brand: {
            tag: normalizeText(source?.brand?.tag),
        },
        ui: {
            header: {
                search: {
                    dialogAria: normalizeText(searchUi.dialogAria),
                    eyebrow: normalizeText(searchUi.eyebrow),
                    inputLabel: normalizeText(searchUi.inputLabel),
                    placeholder: normalizeText(searchUi.placeholder),
                    hint: normalizeText(searchUi.hint),
                    resultsAria: normalizeText(searchUi.resultsAria),
                    emptyTitle: normalizeText(searchUi.emptyTitle),
                    emptyBody: normalizeText(searchUi.emptyBody),
                    closeLabel: normalizeText(searchUi.closeLabel),
                    resultsLimit:
                        Number.isFinite(rawLimit) && rawLimit > 0 ? rawLimit : 8,
                },
            },
        },
        header: {
            contactLabel: normalizeText(header.contactLabel),
            contactHref: normalizeHref(header.contactHref),
            searchLabel: normalizeText(header.searchLabel),
            links: Array.isArray(header.links)
                ? header.links.map(sanitizeSoftwareHeaderLink).filter(Boolean)
                : [],
            searchEntries: Array.isArray(header.searchEntries)
                ? header.searchEntries.map(sanitizeSoftwareSearchEntry).filter(Boolean)
                : [],
        },
        footer: {
            headline: normalizeText(footer.headline),
            deck: normalizeText(footer.deck),
            columns: Array.isArray(footer.columns)
                ? footer.columns.map(sanitizeSoftwareFooterColumn).filter(Boolean)
                : [],
        },
    };
}

function buildSoftwareSuiteRoutes(locale, nav = {}, pages = {}) {
    const safeLocale = normalizeLocale(locale);
    const header = isObject(nav.header) ? nav.header : {};
    const links = Array.isArray(header.links) ? header.links : [];
    const searchEntries = Array.isArray(header.searchEntries)
        ? header.searchEntries
        : [];

    const linkByPageKey = new Map();
    for (const link of links) {
        const pageKey = resolveSoftwarePageKey(safeLocale, link?.id, link?.href);
        if (!pageKey || linkByPageKey.has(pageKey)) {
            continue;
        }
        linkByPageKey.set(pageKey, link);
    }

    const searchByPageKey = new Map();
    for (const entry of searchEntries) {
        const pageKey = resolveSoftwarePageKey(safeLocale, '', entry?.href);
        if (!pageKey || searchByPageKey.has(pageKey)) {
            continue;
        }
        searchByPageKey.set(pageKey, entry);
    }

    return SOFTWARE_PAGE_KEYS.map((pageKey, index) => {
        const route = SOFTWARE_ROUTE_MAP[safeLocale]?.[pageKey];
        const page = isObject(pages[pageKey]) ? pages[pageKey] : {};
        const link = linkByPageKey.get(pageKey);
        const searchEntry = searchByPageKey.get(pageKey);
        const href = normalizePath(link?.href || route);
        const label = normalizeText(link?.label);
        const heading = normalizeText(page.heading || page.title);
        if (!href || !label || !heading) {
            return null;
        }
        return {
            pageKey,
            navId: getSoftwareNavId(pageKey),
            href,
            label,
            eyebrow: normalizeText(searchEntry?.eyebrow),
            deck: normalizeText(searchEntry?.deck),
            index: String(index + 1).padStart(2, '0'),
        };
    }).filter(Boolean);
}

function buildSoftwareSuiteStory(locale, pageKey = 'landing', suiteRoutes = []) {
    const safeLocale = normalizeLocale(locale);
    const safePageKey = normalizeSoftwarePageKey(pageKey);
    const labels = SOFTWARE_STORY_LABELS[safeLocale];
    const currentIndex = suiteRoutes.findIndex(
        (route) => route.pageKey === safePageKey
    );
    const current = currentIndex >= 0 ? suiteRoutes[currentIndex] : null;
    const previous = currentIndex > 0 ? suiteRoutes[currentIndex - 1] : null;
    const next =
        currentIndex >= 0 && currentIndex < suiteRoutes.length - 1
            ? suiteRoutes[currentIndex + 1]
            : null;

    return {
        labels,
        total: suiteRoutes.length,
        currentIndex: currentIndex >= 0 ? currentIndex + 1 : 0,
        current,
        previous,
        next,
    };
}

function sanitizeSoftwareHero(hero) {
    const source = isObject(hero) ? hero : {};
    return {
        eyebrow: normalizeText(source.eyebrow),
        title: normalizeText(source.title),
        deck: normalizeText(source.deck),
        pills: sanitizeTextList(source.pills),
        actions: Array.isArray(source.actions)
            ? source.actions.map(sanitizeSoftwareAction).filter(Boolean)
            : [],
        metrics: Array.isArray(source.metrics)
            ? source.metrics.map(sanitizeSoftwareMetric).filter(Boolean)
            : [],
        panels: Array.isArray(source.panels)
            ? source.panels.map(sanitizeSoftwarePanel).filter(Boolean)
            : [],
    };
}

function sanitizeSoftwareFinalCta(finalCta) {
    const source = isObject(finalCta) ? finalCta : {};
    return {
        title: normalizeText(source.title),
        deck: normalizeText(source.deck),
        actions: Array.isArray(source.actions)
            ? source.actions.map(sanitizeSoftwareAction).filter(Boolean)
            : [],
    };
}

function sanitizeSoftwareLandingPage(page) {
    const source = isObject(page) ? page : {};
    const modules = isObject(source.modules) ? source.modules : {};
    const journeys = isObject(source.journeys) ? source.journeys : {};
    const surfaces = isObject(source.surfaces) ? source.surfaces : {};
    const integrations = isObject(source.integrations) ? source.integrations : {};
    const pricing = isObject(source.pricing) ? source.pricing : {};
    const security = isObject(source.security) ? source.security : {};
    const faq = isObject(source.faq) ? source.faq : {};
    return {
        title: normalizeText(source.title),
        description: normalizeText(source.description),
        breadcrumb: sanitizeBreadcrumb(source.breadcrumb),
        heading: normalizeText(source.heading),
        hero: sanitizeSoftwareHero(source.hero),
        modules: {
            eyebrow: normalizeText(modules.eyebrow),
            title: normalizeText(modules.title),
            deck: normalizeText(modules.deck),
            cards: Array.isArray(modules.cards)
                ? modules.cards.map(sanitizeSoftwareModuleCard).filter(Boolean)
                : [],
        },
        journeys: {
            eyebrow: normalizeText(journeys.eyebrow),
            title: normalizeText(journeys.title),
            deck: normalizeText(journeys.deck),
            lanes: Array.isArray(journeys.lanes)
                ? journeys.lanes.map(sanitizeSoftwareJourneyLane).filter(Boolean)
                : [],
        },
        surfaces: {
            eyebrow: normalizeText(surfaces.eyebrow),
            title: normalizeText(surfaces.title),
            deck: normalizeText(surfaces.deck),
            cards: Array.isArray(surfaces.cards)
                ? surfaces.cards.map(sanitizeSoftwareSurfaceCard).filter(Boolean)
                : [],
        },
        integrations: {
            eyebrow: normalizeText(integrations.eyebrow),
            title: normalizeText(integrations.title),
            deck: normalizeText(integrations.deck),
            groups: Array.isArray(integrations.groups)
                ? integrations.groups
                      .map(sanitizeSoftwareIntegrationGroup)
                      .filter(Boolean)
                : [],
        },
        pricing: {
            eyebrow: normalizeText(pricing.eyebrow),
            title: normalizeText(pricing.title),
            deck: normalizeText(pricing.deck),
            plans: Array.isArray(pricing.plans)
                ? pricing.plans.map(sanitizeSoftwarePlan).filter(Boolean)
                : [],
        },
        security: {
            eyebrow: normalizeText(security.eyebrow),
            title: normalizeText(security.title),
            deck: normalizeText(security.deck),
            cards: Array.isArray(security.cards)
                ? security.cards.map(sanitizeSoftwareSecurityCard).filter(Boolean)
                : [],
        },
        faq: {
            eyebrow: normalizeText(faq.eyebrow),
            title: normalizeText(faq.title),
            items: Array.isArray(faq.items)
                ? faq.items.map(sanitizeSoftwareFaqItem).filter(Boolean)
                : [],
        },
        finalCta: sanitizeSoftwareFinalCta(source.finalCta),
    };
}

function sanitizeSoftwareSurfacePage(page) {
    const source = isObject(page) ? page : {};
    const steps = isObject(source.steps) ? source.steps : {};
    const advantages = isObject(source.advantages) ? source.advantages : {};
    const connections = isObject(source.connections) ? source.connections : {};
    return {
        title: normalizeText(source.title),
        description: normalizeText(source.description),
        breadcrumb: sanitizeBreadcrumb(source.breadcrumb),
        heading: normalizeText(source.heading),
        hero: sanitizeSoftwareHero(source.hero),
        mockup: sanitizeSoftwareMockup(source.mockup, source.heading),
        steps: {
            eyebrow: normalizeText(steps.eyebrow),
            title: normalizeText(steps.title),
            items: sanitizeTextList(steps.items),
        },
        advantages: {
            eyebrow: normalizeText(advantages.eyebrow),
            title: normalizeText(advantages.title),
            cards: Array.isArray(advantages.cards)
                ? advantages.cards.map(sanitizeSoftwareModuleCard).filter(Boolean)
                : [],
        },
        connections: {
            eyebrow: normalizeText(connections.eyebrow),
            title: normalizeText(connections.title),
            items: sanitizeTextList(connections.items),
        },
        finalCta: sanitizeSoftwareFinalCta(source.finalCta),
    };
}

function finalizeSoftwareLandingPage(locale, page = {}, suiteRoutes = []) {
    const safeLocale = normalizeLocale(locale);
    const surfaceCards = Array.isArray(page?.surfaces?.cards)
        ? page.surfaces.cards
              .map((card) => {
                  const pageKey = resolveSoftwarePageKey(safeLocale, '', card?.href);
                  const suiteRoute = suiteRoutes.find(
                      (route) => route.pageKey === pageKey
                  );
                  if (!pageKey || pageKey === 'landing' || !suiteRoute) {
                      return null;
                  }
                  return {
                      ...card,
                      pageKey,
                      navId: suiteRoute.navId,
                  };
              })
              .filter(Boolean)
        : [];

    return {
        ...page,
        pageKey: 'landing',
        suiteRoute:
            suiteRoutes.find((route) => route.pageKey === 'landing') || null,
        suiteMap: suiteRoutes,
        suiteStory: buildSoftwareSuiteStory(locale, 'landing', suiteRoutes),
        surfaces: {
            ...(isObject(page?.surfaces) ? page.surfaces : {}),
            cards: surfaceCards,
        },
    };
}

function finalizeSoftwareSurfacePage(
    locale,
    page = {},
    pageKey = 'landing',
    suiteRoutes = []
) {
    const safePageKey = normalizeSoftwarePageKey(pageKey);
    return {
        ...page,
        pageKey: safePageKey,
        suiteRoute:
            suiteRoutes.find((route) => route.pageKey === safePageKey) || null,
        suiteMap: suiteRoutes,
        suiteStory: buildSoftwareSuiteStory(locale, safePageKey, suiteRoutes),
    };
}

function sanitizeSoftwareData(locale, payload) {
    const source = isObject(payload) ? payload : {};
    const pages = isObject(source.pages) ? source.pages : {};
    const sanitizedNav = sanitizeSoftwareNav(source.nav);
    const sanitizedPages = {
        landing: sanitizeSoftwareLandingPage(pages.landing),
        demo: sanitizeSoftwareSurfacePage(pages.demo),
        status: sanitizeSoftwareSurfacePage(pages.status),
        dashboard: sanitizeSoftwareSurfacePage(pages.dashboard),
    };
    const suiteRoutes = buildSoftwareSuiteRoutes(locale, sanitizedNav, sanitizedPages);

    return {
        nav: {
            ...sanitizedNav,
            softwareSuite: {
                routes: suiteRoutes,
            },
        },
        pages: {
            landing: finalizeSoftwareLandingPage(
                locale,
                sanitizedPages.landing,
                suiteRoutes
            ),
            demo: finalizeSoftwareSurfacePage(
                locale,
                sanitizedPages.demo,
                'demo',
                suiteRoutes
            ),
            status: finalizeSoftwareSurfacePage(
                locale,
                sanitizedPages.status,
                'status',
                suiteRoutes
            ),
            dashboard: finalizeSoftwareSurfacePage(
                locale,
                sanitizedPages.dashboard,
                'dashboard',
                suiteRoutes
            ),
        },
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
    return sanitizeSoftwareData(
        normalizeLocale(locale),
        readLocaleJson(normalizeLocale(locale), 'software.json')
    );
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
