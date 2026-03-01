import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
    getLocalizedServiceBySlug,
    getLocalizedServices,
    getLocalizedServicesBySlugs,
    getLocaleSwitchPath,
    getNavigation,
    getRelatedServices,
    getServiceCtaLabel,
    legalBasePath,
    localizeCategory,
    localizeDoctorProfiles,
    mapServiceHint,
    serviceHubPath,
    servicePath,
    telemedicinePath,
} from './content.js';
import { normalizeStage } from './public-v3-contract.js';

const REPO_ROOT = path.resolve(
    path.dirname(fileURLToPath(import.meta.url)),
    '..',
    '..',
    '..',
    '..',
    '..'
);

const PUBLIC_V3_SECTIONS = [
    'navigation',
    'home',
    'hub',
    'service',
    'telemedicine',
    'legal',
];

function readJsonFile(filePath) {
    const payload = fs.readFileSync(filePath, 'utf8');
    return JSON.parse(payload);
}

function readPublicV3JsonSection(locale, section) {
    const filePath = path.join(
        REPO_ROOT,
        'content',
        'public-v3',
        locale,
        `${section}.json`
    );
    return readJsonFile(filePath);
}

function readPublicV3LegalPages(locale) {
    const legalPagesDir = path.join(
        REPO_ROOT,
        'content',
        'public-v3',
        locale,
        'legal'
    );
    const files = fs
        .readdirSync(legalPagesDir, { withFileTypes: true })
        .filter((entry) => entry.isFile() && entry.name.endsWith('.json'))
        .map((entry) => entry.name)
        .sort();

    const pages = {};
    for (const fileName of files) {
        const slug = fileName.replace(/\.json$/u, '');
        pages[slug] = readJsonFile(path.join(legalPagesDir, fileName));
    }

    return pages;
}

let localeContentCache = null;

function getLocaleContent(locale) {
    if (!localeContentCache) {
        localeContentCache = {};
        for (const contentLocale of ['es', 'en']) {
            localeContentCache[contentLocale] = {};
            for (const section of PUBLIC_V3_SECTIONS) {
                if (section === 'legal') {
                    const legalMeta = readPublicV3JsonSection(
                        contentLocale,
                        section
                    );
                    const legalPages = readPublicV3LegalPages(contentLocale);
                    const orderedSlugs = [];
                    const addSlug = (slug) => {
                        if (
                            typeof slug !== 'string' ||
                            !slug ||
                            orderedSlugs.includes(slug) ||
                            !legalPages[slug]
                        ) {
                            return;
                        }
                        orderedSlugs.push(slug);
                    };

                    const declaredOrder = Array.isArray(legalMeta.pageOrder)
                        ? legalMeta.pageOrder
                        : [];
                    for (const slug of declaredOrder) {
                        addSlug(slug);
                    }
                    for (const slug of Object.keys(legalPages)) {
                        addSlug(slug);
                    }

                    localeContentCache[contentLocale][section] = {
                        ...legalMeta,
                        pages: legalPages,
                        pageOrder: orderedSlugs,
                    };
                    continue;
                }

                localeContentCache[contentLocale][section] =
                    readPublicV3JsonSection(contentLocale, section);
            }
        }
    }
    return locale === 'en' ? localeContentCache.en : localeContentCache.es;
}

const FAMILY_ORDER = ['clinical', 'aesthetic', 'children'];
const SERVICE_INTENT_BY_SLUG = {
    'diagnostico-integral': 'diagnosis',
    'acne-rosacea': 'inflammation',
    verrugas: 'procedures',
    'granitos-brazos-piernas': 'inflammation',
    cicatrices: 'procedures',
    'cancer-piel': 'diagnosis',
    'peeling-quimico': 'rejuvenation',
    mesoterapia: 'rejuvenation',
    'laser-dermatologico': 'procedures',
    botox: 'rejuvenation',
    'bioestimuladores-colageno': 'rejuvenation',
    'piel-cabello-unas': 'diagnosis',
    'dermatologia-pediatrica': 'pediatric',
};

function groupServicesByFamily(locale) {
    const services = getLocalizedServices(locale);
    return {
        clinical: services.filter((service) => service.category === 'clinical'),
        aesthetic: services.filter(
            (service) => service.category === 'aesthetic'
        ),
        children: services.filter((service) => service.category === 'children'),
    };
}

function serviceMediaForFamily(family) {
    if (family === 'aesthetic')
        return '/images/optimized/service-rejuvenecimiento.webp';
    if (family === 'children') return '/images/optimized/hero-woman.webp';
    return '/images/optimized/showcase-diagnostic.webp';
}

function buildServiceCard(service, locale) {
    const family =
        service.category === 'children' ? 'children' : service.category;
    return {
        slug: service.slug,
        family,
        label: localizeCategory(service.category, locale),
        title: service.hero,
        deck: service.summary,
        media: serviceMediaForFamily(family),
        href: servicePath(locale, service.slug),
        cta: getServiceCtaLabel(service, locale),
        price: service.price_from,
        duration: service.duration,
        serviceHint: mapServiceHint(service.slug),
        doctors: localizeDoctorProfiles(service.doctor_profile, locale),
    };
}

function buildFamilyCards(locale, content) {
    const grouped = groupServicesByFamily(locale);
    return FAMILY_ORDER.map((family) => {
        const familyContent = content.navigation.mega.families[family];
        const firstService = grouped[family][0];
        return {
            id: family,
            label: localizeCategory(family, locale),
            eyebrow: familyContent.title,
            title: firstService?.hero || familyContent.title,
            deck: familyContent.deck,
            href: `${serviceHubPath(locale)}?category=${family}`,
            media: serviceMediaForFamily(family),
            featured: firstService
                ? buildServiceCard(firstService, locale)
                : null,
            services: grouped[family]
                .slice(0, 4)
                .map((service) => buildServiceCard(service, locale)),
            cards: grouped[family].map((service) =>
                buildServiceCard(service, locale)
            ),
        };
    });
}

function buildMegaGroups(locale) {
    const navigation = getNavigation();
    const servicesGroup = Array.isArray(navigation?.desktop?.[0]?.children)
        ? navigation.desktop[0].children
        : [];

    return servicesGroup.map((group) => ({
        title: locale === 'en' ? group.label_en : group.label_es,
        items: group.items.slice(0, 4).map((item) => ({
            label: locale === 'en' ? item.label_en : item.label_es,
            href: servicePath(locale, item.slug),
        })),
    }));
}

function buildFeaturedServices(locale) {
    return getLocalizedServices(locale)
        .slice(0, 3)
        .map((service) => ({
            title: service.hero,
            family: localizeCategory(service.category, locale),
            href: servicePath(locale, service.slug),
        }));
}

function buildHomeSlides(locale, slides = []) {
    return slides.map((slide, index) => {
        const normalized = normalizeStage(slide, {
            fallbackId: `stage-${index + 1}`,
        });
        return {
            ...normalized,
            locale,
            category: normalized.eyebrow,
            mediaSrc: normalized.media.src,
        };
    });
}

export function getPublicNavigationModel(locale, pathname = '/') {
    const content = getLocaleContent(locale);
    const labels = content.navigation.labels;

    return {
        locale,
        pathname,
        brand: {
            eyebrow: content.navigation.brandEyebrow,
            line1: content.navigation.brandLine1,
            line2: content.navigation.brandLine2,
        },
        switchHref: getLocaleSwitchPath(
            locale === 'en' ? 'es' : 'en',
            pathname
        ),
        switchLabel: locale === 'en' ? 'ES' : 'EN',
        bookingHref: '#citas',
        labels,
        links: [
            {
                label: labels.home,
                href: locale === 'en' ? '/en/' : '/es/',
            },
            {
                label: labels.services,
                href: serviceHubPath(locale),
                kind: 'mega',
            },
            {
                label: labels.telemedicine,
                href: telemedicinePath(locale),
            },
            {
                label: labels.legal,
                href:
                    legalBasePath(locale) +
                    (locale === 'en' ? 'terms/' : 'terminos/'),
            },
        ],
        mega: {
            intro: {
                ...content.navigation.mega.intro,
                href: serviceHubPath(locale),
            },
            families: FAMILY_ORDER.map((family) => ({
                id: family,
                ...content.navigation.mega.families[family],
                href: `${serviceHubPath(locale)}?category=${family}`,
            })),
            groups: buildMegaGroups(locale),
            featured: buildFeaturedServices(locale),
        },
        footer: content.navigation.footer,
    };
}

export function getHomeV3Data(locale) {
    const content = getLocaleContent(locale);
    const families = buildFamilyCards(locale, content);

    return {
        ...content.home,
        slides: buildHomeSlides(locale, content.home.slides),
        families,
        doctors: content.home.doctors.map((doctor) => ({
            ...doctor,
            services: getLocalizedServicesBySlugs(
                doctor.serviceSlugs,
                locale
            ).map((service) => ({
                label: service.hero,
                href: servicePath(locale, service.slug),
            })),
        })),
    };
}

export function getHubV3Data(locale) {
    const content = getLocaleContent(locale);

    return {
        title: content.hub.title,
        description: content.hub.description,
        hero: content.hub.hero,
        families: buildFamilyCards(locale, content),
        telemedicine: content.hub.telemedicine,
        booking: content.hub.booking,
    };
}

export function getServiceDetailV3Data(slug, locale) {
    const service = getLocalizedServiceBySlug(slug, locale);
    if (!service) return null;

    const content = getLocaleContent(locale).service;
    const family =
        service.category === 'children' ? 'children' : service.category;
    const serviceHint = mapServiceHint(service.slug);
    const heroMedia = serviceMediaForFamily(family);

    return {
        service,
        title: `${service.hero} | Piel en Armonia`,
        description: service.summary,
        family,
        bookingHint: serviceHint,
        hero: {
            slug: service.slug,
            category: family,
            intent: SERVICE_INTENT_BY_SLUG[service.slug] || 'diagnosis',
            serviceHint,
            eyebrow: localizeCategory(service.category, locale),
            title: service.hero,
            deck: service.summary,
            tone: content.heroTone || 'ink',
            media: heroMedia,
            mediaMeta: {
                src: heroMedia,
                alt: service.hero,
                kind: 'image',
            },
            price: service.price_from,
            duration: service.duration,
        },
        story: {
            eyebrow: content.storyEyebrow,
            summary: content.storySummary,
            tone: content.storyTone || 'porcelain',
            indications: service.indications || [],
            audience: service.audience || [],
            doctors: localizeDoctorProfiles(service.doctor_profile, locale),
            faq: service.faq || [],
        },
        evidence: {
            eyebrow: content.evidenceEyebrow,
            title: content.evidenceTitle,
            tone: content.evidenceTone || 'silver',
            bullets:
                Array.isArray(service.contraindications) &&
                service.contraindications.length > 0
                    ? service.contraindications
                    : content.evidenceFallbackBullets,
            outcomes: content.evidenceOutcomes,
        },
        timeline: {
            eyebrow: content.timelineEyebrow,
            tone: content.timelineTone || 'ink',
            steps: content.timelineSteps,
        },
        related: getRelatedServices(slug, locale, 3).map((item) =>
            buildServiceCard(item, locale)
        ),
        booking: {
            ...content.booking,
            tone: content.booking?.tone || 'silver',
            serviceHint,
        },
    };
}

export function getTelemedicineV3Data(locale) {
    return getLocaleContent(locale).telemedicine;
}

export function getLegalPageV3Data(slug, locale) {
    const content = getLocaleContent(locale).legal;
    const page = content.pages[slug];
    if (!page) return null;

    return {
        ...page,
        supportBand: content.supportBand,
        booking: content.booking,
    };
}

export function getLegalIndex(locale) {
    const legalContent = getLocaleContent(locale).legal;
    const pages = legalContent.pages;
    const orderedSlugs = Array.isArray(legalContent.pageOrder)
        ? legalContent.pageOrder
        : Object.keys(pages);
    const base = locale === 'en' ? '/en/legal/' : '/es/legal/';

    return orderedSlugs
        .filter((slug) => pages[slug])
        .map((slug) => ({
            slug,
            title: pages[slug].title,
            href: `${base}${slug}/`,
        }));
}
