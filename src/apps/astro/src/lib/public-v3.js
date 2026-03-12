import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
    getBookingOptionById,
    getLocalizedServiceBySlug,
    getLocalizedServices,
    getLocalizedServicesBySlugs,
    getLocaleSwitchPath,
    getNavigation,
    getServiceIntentDefinitions,
    getRelatedServices,
    getServiceCtaLabel,
    legalBasePath,
    localizeAudience,
    localizeCategory,
    localizeDoctorProfiles,
    mapServiceHint,
    resolveServiceIntents,
    resolvePublicMedia,
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
const FAMILY_MEDIA_ASSET_ID = {
    clinical: 'clinical-showcase',
    aesthetic: 'aesthetic-showcase',
    children: 'clinic-showcase',
};
const STAGE_MEDIA_ASSET_ID = {
    'clinical-stage': 'hero-clinical-stage',
    'aesthetic-stage': 'hero-aesthetic-stage',
    'tele-stage': 'hero-telemedicine',
};
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

function resolveLocalizedPriceLabel(service, locale, basePrice, taxPct) {
    const fallback =
        locale === 'en'
            ? `USD ${basePrice.toFixed(2)} + Tax ${taxPct}%`
            : `USD ${basePrice.toFixed(2)} + IVA ${taxPct}%`;
    const short = String(service?.price_label_short || '').trim();
    const shortEs = String(service?.price_label_short_es || '').trim();
    const shortEn = String(service?.price_label_short_en || '').trim();

    if (locale === 'en') {
        if (shortEn) return shortEn;
        if (short && /tax/i.test(short) && !/iva/i.test(short)) return short;
        return fallback;
    }

    if (shortEs) return shortEs;
    if (short) return short;
    return fallback;
}

function resolveLocalizedPriceDisclaimer(service, locale) {
    const fallback =
        locale === 'en'
            ? 'Final amount is calculated from base price and applicable tax.'
            : 'El valor final se calcula con precio base e impuesto aplicable.';
    const disclaimerEs = String(service?.price_disclaimer_es || '').trim();
    const disclaimerEn = String(service?.price_disclaimer_en || '').trim();

    if (locale === 'en') {
        return disclaimerEn || fallback;
    }

    return disclaimerEs || fallback;
}

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
        return '/images/optimized/v6-clinic-bioestimuladores-colageno.webp';
    if (family === 'children') return '/images/optimized/v6-clinic-clinic-environment.webp';
    return '/images/optimized/v6-clinic-diagnostico-integral.webp';
}

function serviceMediaAltForLocale(service, locale) {
    const media = service?.media;
    if (!media || typeof media !== 'object') {
        return String(service?.hero || '').trim();
    }
    if (locale === 'en') {
        return (
            String(media.alt_en || '').trim() ||
            String(media.alt_es || '').trim() ||
            String(service?.hero || '').trim()
        );
    }
    return (
        String(media.alt_es || '').trim() ||
        String(media.alt_en || '').trim() ||
        String(service?.hero || '').trim()
    );
}

function resolveServiceMedia(service, family, locale, sizes = '') {
    const media = service?.media;
    const hasMediaObject = media && typeof media === 'object';
    return resolvePublicMedia({
        assetId:
            hasMediaObject &&
            (String(media.asset_id || '').trim() ||
                String(media.assetId || '').trim()),
        src:
            (hasMediaObject && String(media.src || '').trim()) ||
            serviceMediaForFamily(family),
        alt: serviceMediaAltForLocale(service, locale),
        kind: hasMediaObject ? String(media.kind || 'image') : 'image',
        locale,
        sizes,
        preferProvidedAlt: true,
    });
}

function resolveFamilyMedia(family, locale, fallbackAlt = '') {
    return resolvePublicMedia({
        assetId: FAMILY_MEDIA_ASSET_ID[family] || '',
        src: serviceMediaForFamily(family),
        alt: fallbackAlt,
        locale,
        sizes: '(max-width: 900px) 100vw, 44vw',
    });
}

function inferDoctorAssetId(doctorName = '') {
    const normalized = String(doctorName || '')
        .toLowerCase()
        .trim();
    if (normalized.includes('rosero')) return 'doctor-rosero';
    if (normalized.includes('narvaez')) return 'doctor-narvaez';
    return '';
}

function buildServiceCard(service, locale) {
    const family =
        service.category === 'children' ? 'children' : service.category;
    const mediaMeta = resolveServiceMedia(
        service,
        family,
        locale,
        '(max-width: 900px) 100vw, 44vw'
    );
    const serviceHint = mapServiceHint(service.slug);
    const pricing = getBookingOptionById(serviceHint);
    const basePrice = Number(
        pricing?.base_price_usd ??
            service.base_price_usd ??
            service.price_from ??
            0
    );
    const taxRate = Number(
        pricing?.tax_rate ?? service.tax_rate ?? service.iva ?? 0
    );
    const totalPrice = Number((basePrice * (1 + taxRate)).toFixed(2));
    const taxPct = Math.round(taxRate * 100);

    return {
        slug: service.slug,
        family,
        label: localizeCategory(service.category, locale),
        title: service.hero,
        deck: service.summary,
        media: mediaMeta.src,
        mediaMeta,
        href: servicePath(locale, service.slug),
        cta: getServiceCtaLabel(service, locale),
        serviceHint,
        bookingServiceId: serviceHint,
        price: basePrice,
        priceTotal: totalPrice,
        taxRate,
        taxPercent: taxPct,
        priceLabel: resolveLocalizedPriceLabel(
            service,
            locale,
            basePrice,
            taxPct
        ),
        priceDisclaimer: resolveLocalizedPriceDisclaimer(service, locale),
        duration: service.duration,
        intents: resolveServiceIntents(service),
        audiences: localizeAudience(service.audience, locale),
        audienceKeys: Array.isArray(service.audience) ? service.audience : [],
        doctors: localizeDoctorProfiles(service.doctor_profile, locale),
    };
}

function buildFamilyCards(locale, content) {
    const grouped = groupServicesByFamily(locale);
    return FAMILY_ORDER.map((family) => {
        const familyContent = content.navigation.mega.families[family];
        const firstService = grouped[family][0];
        const familyMediaMeta = resolveFamilyMedia(
            family,
            locale,
            familyContent.title
        );
        return {
            id: family,
            label: localizeCategory(family, locale),
            eyebrow: familyContent.title,
            title: firstService?.hero || familyContent.title,
            deck: familyContent.deck,
            href: `${serviceHubPath(locale)}?category=${family}`,
            media: familyMediaMeta.src,
            mediaMeta: familyMediaMeta,
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
        const stageMedia = resolvePublicMedia({
            assetId: STAGE_MEDIA_ASSET_ID[normalized.id] || '',
            src: normalized?.media?.src || slide?.media || '',
            alt: normalized?.media?.alt || normalized.title,
            locale,
            sizes: '100vw',
        });
        return {
            ...normalized,
            media: stageMedia,
            mediaMeta: stageMedia,
            locale,
            category: normalized.eyebrow,
            mediaSrc: stageMedia.src,
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
        featuredStories: (Array.isArray(content.home.featuredStories)
            ? content.home.featuredStories
            : []
        ).map((story) => {
            const mediaMeta = resolvePublicMedia({
                src: story?.media || '',
                alt: story?.title || '',
                locale,
                sizes: '(max-width: 900px) 100vw, 52vw',
            });
            return {
                ...story,
                media: mediaMeta.src,
                mediaMeta,
            };
        }),
        families,
        doctors: content.home.doctors.map((doctor) => {
            const mediaMeta = resolvePublicMedia({
                assetId: inferDoctorAssetId(doctor?.name),
                src: doctor?.media || '',
                alt: doctor?.name || '',
                locale,
                sizes: '(max-width: 720px) 100vw, 320px',
            });
            return {
                ...doctor,
                media: mediaMeta.src,
                mediaMeta,
                services: getLocalizedServicesBySlugs(
                    doctor.serviceSlugs,
                    locale
                ).map((service) => ({
                    label: service.hero,
                    href: servicePath(locale, service.slug),
                })),
            };
        }),
    };
}

export function getHubV3Data(locale) {
    const content = getLocaleContent(locale);
    const heroMedia = resolvePublicMedia({
        assetId: 'hero-clinical-stage',
        src:
            content?.hub?.hero?.mediaMeta?.src ||
            content?.hub?.hero?.media ||
            '',
        alt:
            content?.hub?.hero?.mediaMeta?.alt ||
            content?.hub?.hero?.title ||
            '',
        locale,
        sizes: '(max-width: 1024px) 100vw, 46vw',
    });
    const intentDefinitions = getServiceIntentDefinitions(locale)
        .filter((item) => item.id !== 'all')
        .slice(0, 6);
    const audienceDefinitions =
        locale === 'en'
            ? [
                  {
                      id: 'children',
                      label: 'Children & Teens',
                  },
                  {
                      id: 'adults',
                      label: 'Adults',
                  },
                  {
                      id: 'seniors',
                      label: 'Seniors',
                  },
              ]
            : [
                  {
                      id: 'children',
                      label: 'Ninos y adolescentes',
                  },
                  {
                      id: 'adults',
                      label: 'Adultos',
                  },
                  {
                      id: 'seniors',
                      label: 'Adultos mayores',
                  },
              ];

    return {
        title: content.hub.title,
        description: content.hub.description,
        hero: {
            ...content.hub.hero,
            media: heroMedia.src,
            mediaMeta: heroMedia,
        },
        families: buildFamilyCards(locale, content),
        filters: {
            intents: intentDefinitions,
            audiences: audienceDefinitions,
        },
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
    const pricing = getBookingOptionById(serviceHint);
    const basePrice = Number(
        pricing?.base_price_usd ??
            service.base_price_usd ??
            service.price_from ??
            0
    );
    const taxRate = Number(
        pricing?.tax_rate ?? service.tax_rate ?? service.iva ?? 0
    );
    const totalPrice = Number((basePrice * (1 + taxRate)).toFixed(2));
    const taxPct = Math.round(taxRate * 100);
    const heroMedia = resolveServiceMedia(
        service,
        family,
        locale,
        '(max-width: 1024px) 100vw, 46vw'
    );

    return {
        service,
        title: `${service.hero} | Aurora Derm`,
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
            media: heroMedia.src,
            mediaMeta: heroMedia,
            price: basePrice,
            priceTotal: totalPrice,
            taxRate,
            taxPercent: taxPct,
            priceLabel: resolveLocalizedPriceLabel(
                service,
                locale,
                basePrice,
                taxPct
            ),
            priceDisclaimer: resolveLocalizedPriceDisclaimer(service, locale),
            duration: service.duration,
        },
        story: {
            eyebrow: content.storyEyebrow,
            summary: content.storySummary,
            tone: content.storyTone || 'porcelain',
            indications: service.indications || [],
            audience: localizeAudience(service.audience || [], locale),
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
    const content = getLocaleContent(locale).telemedicine;
    const heroMedia = resolvePublicMedia({
        assetId: 'hero-telemedicine',
        src: content?.hero?.mediaMeta?.src || content?.hero?.media || '',
        alt: content?.hero?.mediaMeta?.alt || content?.hero?.title || '',
        locale,
        sizes: '(max-width: 1024px) 100vw, 46vw',
    });
    return {
        ...content,
        hero: {
            ...content.hero,
            media: heroMedia.src,
            mediaMeta: heroMedia,
        },
    };
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
