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

function readJson(relativePath) {
    const filePath = path.join(REPO_ROOT, relativePath);
    const payload = fs.readFileSync(filePath, 'utf8');
    return JSON.parse(payload);
}

function readJsonOptional(relativePath) {
    try {
        return readJson(relativePath);
    } catch (_error) {
        return null;
    }
}

let cache = null;

const EN_SERVICE_COPY = {
    'diagnostico-integral': {
        hero: 'Comprehensive skin, hair, and nail diagnosis',
        summary:
            'Specialized consultation to identify the root cause and define a complete dermatology plan.',
        indications: [
            'recurring breakouts',
            'new skin lesions',
            'hair loss',
            'nail fragility',
        ],
        contraindications: [],
        faq: [
            'What is included in the first consultation?',
            'Do I need tests beforehand?',
        ],
    },
    'acne-rosacea': {
        hero: 'Medical treatment for acne and rosacea',
        summary:
            'Inflammation, breakouts, and post-acne marks managed with progressive protocols.',
        indications: [
            'inflammatory acne',
            'rosacea',
            'post-inflammatory marks',
        ],
        contraindications: [],
        faq: [
            'When do results usually become visible?',
            'Can it be combined with peels or laser?',
        ],
    },
    verrugas: {
        hero: 'Safe wart removal',
        summary:
            'Treatment options based on wart type, location, and patient age.',
        indications: ['common warts', 'plantar warts', 'periungual warts'],
        contraindications: [],
        faq: [
            'Does the procedure hurt?',
            'How many sessions are usually needed?',
        ],
    },
    'granitos-brazos-piernas': {
        hero: 'Reduce bumps on arms and legs',
        summary:
            'Comprehensive management of rough skin texture consistent with keratosis pilaris.',
        indications: [
            'keratosis pilaris',
            'rough skin texture',
            'follicular redness',
        ],
        contraindications: [],
        faq: [
            'Can it be resolved permanently?',
            'What daily skincare routine do you recommend?',
        ],
    },
    cicatrices: {
        hero: 'Scar reduction',
        summary:
            'Combined strategies to improve depth, color, and texture safely.',
        indications: [
            'acne scars',
            'surgical scars',
            'post-inflammatory marks',
        ],
        contraindications: [],
        faq: [
            'Which technique is best for my case?',
            'How many sessions will I need?',
        ],
    },
    'cancer-piel': {
        hero: 'Early skin cancer screening',
        summary:
            'Dermatoscopy focused on detecting suspicious lesions at an early stage.',
        indications: ['new moles', 'changing lesions', 'family history'],
        contraindications: [],
        faq: [
            'How often should I schedule screening?',
            'Which warning signs require prompt evaluation?',
        ],
    },
    'peeling-quimico': {
        hero: 'Medical chemical peels',
        summary:
            'Skin renewal to improve tone, dark spots, and texture with physician-guided protocols.',
        indications: ['photoaging', 'spots', 'mild active acne'],
        contraindications: [
            'pregnancy depending on formula',
            'acutely irritated skin',
        ],
        faq: [
            'How many recovery days should I expect?',
            'Can it be combined with other treatments?',
        ],
    },
    mesoterapia: {
        hero: 'Dermatology mesotherapy',
        summary:
            'Microinjections designed to improve hydration, luminosity, and skin quality.',
        indications: ['dull skin', 'dehydration', 'early signs of aging'],
        contraindications: ['pregnancy', 'allergy to components'],
        faq: [
            'Is there downtime after the session?',
            'Who is the ideal candidate for mesotherapy?',
        ],
    },
    'laser-dermatologico': {
        hero: 'Medical dermatology laser',
        summary:
            'Laser-based treatments for spots, scars, and skin rejuvenation.',
        indications: ['spots', 'scars', 'skin aging'],
        contraindications: ['recent tanning', 'acute photosensitivity'],
        faq: [
            'How long does each session take?',
            'What aftercare should I follow?',
        ],
    },
    botox: {
        hero: 'Medical botox',
        summary:
            'Expression line management with natural-looking, safe outcomes.',
        indications: ['forehead lines', 'frown lines', "crow's feet"],
        contraindications: [
            'pregnancy',
            'breastfeeding depending on medical evaluation',
        ],
        faq: [
            'When do results become visible?',
            'How often should it be repeated?',
        ],
    },
    'bioestimuladores-colageno': {
        hero: 'Collagen biostimulators',
        summary:
            'Progressive collagen stimulation for facial support and firmness.',
        indications: [
            'mild to moderate laxity',
            'loss of support',
            'skin quality concerns',
        ],
        contraindications: ['active local infection', 'pregnancy'],
        faq: [
            'How long does it take to notice results?',
            'How many sessions are usually recommended?',
        ],
    },
    'piel-cabello-unas': {
        hero: 'Diagnosis and treatment for skin, hair, and nails',
        summary:
            'Comprehensive dermatology care for children, adults, and seniors.',
        indications: [
            'dermatitis',
            'alopecia',
            'nail disorders',
            'chronic itching',
        ],
        contraindications: [],
        faq: [
            'Do you treat children and older adults?',
            'Can treatment begin through telemedicine?',
        ],
    },
    'dermatologia-pediatrica': {
        hero: 'Pediatric dermatology',
        summary:
            'Diagnosis and follow-up for children and adolescents with skin concerns.',
        indications: [
            'atopic dermatitis',
            'teen acne',
            'warts',
            'scalp changes',
        ],
        contraindications: [],
        faq: [
            'What should I bring to a pediatric visit?',
            'Can follow-up happen through telemedicine?',
        ],
    },
};

const AUDIENCE_LABELS = {
    children: {
        es: 'Ninos y adolescentes',
        en: 'Children and teenagers',
    },
    adults: {
        es: 'Adultos',
        en: 'Adults',
    },
    seniors: {
        es: 'Adultos mayores',
        en: 'Seniors',
    },
};

const DOCTOR_LABELS = {
    rosero: {
        es: 'Dr. Javier Rosero',
        en: 'Dr. Javier Rosero',
    },
    narvaez: {
        es: 'Dra. Carolina Narvaez',
        en: 'Dr. Carolina Narvaez',
    },
};

const SERVICE_INTENT_DEFINITIONS = {
    en: [
        {
            id: 'all',
            label: 'All routes',
            description:
                'Browse the full public service catalogue and jump to the service or booking step directly.',
        },
        {
            id: 'diagnosis',
            label: 'Diagnosis first',
            description:
                'For broad assessment, suspicious lesions, skin-hair-nail review, or cases that need a clinical map before treatment.',
        },
        {
            id: 'inflammation',
            label: 'Inflammation',
            description:
                'For acne, rosacea, rough texture, and inflammatory skin changes that need medical control.',
        },
        {
            id: 'procedures',
            label: 'Procedures',
            description:
                'For wart removal, scar pathways, laser-adjacent procedural decisions, and intervention-led routes.',
        },
        {
            id: 'rejuvenation',
            label: 'Rejuvenation',
            description:
                'For injectables, peels, collagen stimulation, and medical aesthetics with visible progression.',
        },
        {
            id: 'pediatric',
            label: 'Pediatric',
            description:
                'For children and adolescent cases, including family-first routes that can later expand to broader assessment.',
        },
        {
            id: 'remote',
            label: 'Remote first',
            description:
                'For routes that can often start with telemedicine before deciding whether in-person review is needed.',
        },
    ],
    es: [
        {
            id: 'all',
            label: 'Todas las rutas',
            description:
                'Recorre el catalogo publico completo y salta directo a la ficha o al paso de reserva.',
        },
        {
            id: 'diagnosis',
            label: 'Diagnostico primero',
            description:
                'Para valoracion amplia, lesiones sospechosas, revision de piel-cabello-unas o casos que necesitan mapa clinico antes de tratar.',
        },
        {
            id: 'inflammation',
            label: 'Inflamacion',
            description:
                'Para acne, rosacea, textura aspera y cambios inflamatorios que requieren control medico.',
        },
        {
            id: 'procedures',
            label: 'Procedimientos',
            description:
                'Para verrugas, rutas de cicatrices, decisiones ligadas a laser e intervenciones orientadas a procedimiento.',
        },
        {
            id: 'rejuvenation',
            label: 'Rejuvenecimiento',
            description:
                'Para inyectables, peelings, bioestimulacion y estetica medica con progresion visible.',
        },
        {
            id: 'pediatric',
            label: 'Pediatria',
            description:
                'Para casos de ninos y adolescentes, incluyendo rutas familiares que luego pueden abrir una valoracion mas amplia.',
        },
        {
            id: 'remote',
            label: 'Remoto primero',
            description:
                'Para rutas que suelen empezar por telemedicina antes de decidir si hace falta revision presencial.',
        },
    ],
};

const SERVICE_INTENT_SLUG_MAP = {
    diagnosis: ['diagnostico-integral', 'piel-cabello-unas', 'cancer-piel'],
    inflammation: ['acne-rosacea', 'granitos-brazos-piernas'],
    procedures: ['verrugas', 'cicatrices', 'laser-dermatologico'],
    rejuvenation: [
        'peeling-quimico',
        'mesoterapia',
        'laser-dermatologico',
        'botox',
        'bioestimuladores-colageno',
    ],
    pediatric: [
        'diagnostico-integral',
        'acne-rosacea',
        'verrugas',
        'granitos-brazos-piernas',
        'piel-cabello-unas',
        'dermatologia-pediatrica',
    ],
    remote: [
        'diagnostico-integral',
        'acne-rosacea',
        'granitos-brazos-piernas',
        'piel-cabello-unas',
        'dermatologia-pediatrica',
    ],
};

function loadCache() {
    if (cache) {
        return cache;
    }

    const v5Catalog = readJsonOptional(
        path.join('content', 'public-v5', 'catalog.json')
    );
    const v5UiTokens = readJsonOptional(
        path.join('content', 'public-v5', 'ui-tokens.json')
    );
    const v5AssetsManifest = readJsonOptional(
        path.join('content', 'public-v5', 'assets-manifest.json')
    );
    const v4Catalog = readJsonOptional(
        path.join('content', 'public-v4', 'catalog.json')
    );
    const v4AssetsManifest = readJsonOptional(
        path.join('content', 'public-v4', 'assets-manifest.json')
    );
    cache = {
        es: readJson(path.join('content', 'es.json')),
        en: readJson(path.join('content', 'en.json')),
        nav: readJson(path.join('content', 'navigation.json')),
        services: readJson(path.join('content', 'services.json')),
        deferred: readJson(path.join('content', 'index.json')),
        v5Catalog,
        v5UiTokens,
        v5AssetsManifest,
        v4Catalog,
        v4AssetsManifest,
    };
    return cache;
}

export function getV5Catalog() {
    const data = loadCache();
    const catalog = data.v5Catalog;
    if (!catalog || typeof catalog !== 'object' || Array.isArray(catalog)) {
        return null;
    }
    return catalog;
}

export function getV5UiTokens() {
    const data = loadCache();
    const tokens = data.v5UiTokens;
    if (!tokens || typeof tokens !== 'object' || Array.isArray(tokens)) {
        return null;
    }
    return tokens;
}

export function getV5AssetsManifest() {
    const data = loadCache();
    const manifest = data.v5AssetsManifest;
    if (!manifest || typeof manifest !== 'object' || Array.isArray(manifest)) {
        return null;
    }
    return manifest;
}

export function getV4Catalog() {
    const data = loadCache();
    const catalog = data.v4Catalog;
    if (!catalog || typeof catalog !== 'object' || Array.isArray(catalog)) {
        return null;
    }
    return catalog;
}

export function getV4AssetsManifest() {
    const data = loadCache();
    const manifest = data.v4AssetsManifest;
    if (!manifest || typeof manifest !== 'object' || Array.isArray(manifest)) {
        return null;
    }
    return manifest;
}

function normalizeAssetPath(value) {
    const normalized = String(value || '').trim();
    if (!normalized) return '';
    return normalized.replace(/\\/g, '/');
}

function inferMimeType(assetPath) {
    const ext = normalizeAssetPath(assetPath).split('.').pop()?.toLowerCase();
    if (!ext) return '';
    if (ext === 'avif') return 'image/avif';
    if (ext === 'webp') return 'image/webp';
    if (ext === 'jpg' || ext === 'jpeg') return 'image/jpeg';
    if (ext === 'png') return 'image/png';
    return '';
}

function inferAssetWidth(assetPath) {
    const normalized = normalizeAssetPath(assetPath);
    const match = normalized.match(/-(\d+)\.(avif|webp|jpe?g|png)$/i);
    if (!match) {
        return null;
    }
    const width = Number(match[1]);
    return Number.isFinite(width) && width > 0 ? width : null;
}

function buildSrcSet(entries) {
    const withWidth = entries
        .map((item) => ({
            src: normalizeAssetPath(item),
            width: inferAssetWidth(item),
        }))
        .filter((item) => item.src);

    const byWidth = withWidth.filter((item) => Number.isFinite(item.width));
    if (byWidth.length > 0) {
        return byWidth
            .sort((left, right) => left.width - right.width)
            .map((item) => `${item.src} ${item.width}w`)
            .join(', ');
    }

    return withWidth.map((item) => item.src).join(', ');
}

export function getPublicAssetById(assetId) {
    const normalized = String(assetId || '')
        .trim()
        .toLowerCase();
    if (!normalized) {
        return null;
    }
    const manifest = getV5AssetsManifest();
    const assets = Array.isArray(manifest?.assets) ? manifest.assets : [];
    return (
        assets.find(
            (asset) =>
                String(asset?.id || '')
                    .trim()
                    .toLowerCase() === normalized
        ) || null
    );
}

export function getPublicAssetBySrc(assetSrc) {
    const normalized = normalizeAssetPath(assetSrc);
    if (!normalized) {
        return null;
    }
    const manifest = getV5AssetsManifest();
    const assets = Array.isArray(manifest?.assets) ? manifest.assets : [];
    return (
        assets.find((asset) => normalizeAssetPath(asset?.src) === normalized) ||
        null
    );
}

function localizeAssetAlt(
    asset,
    locale,
    fallbackAlt = '',
    preferFallbackAlt = false
) {
    const fallback = String(fallbackAlt || '').trim();
    if (preferFallbackAlt && fallback) {
        return fallback;
    }
    const lang = locale === 'en' ? 'en' : 'es';
    const localized = String(
        lang === 'en' ? asset?.alt_en || '' : asset?.alt_es || ''
    ).trim();
    if (localized) {
        return localized;
    }
    return fallback;
}

export function resolvePublicMedia({
    assetId = '',
    src = '',
    alt = '',
    locale = 'es',
    sizes = '',
    kind = 'image',
    preferProvidedAlt = false,
} = {}) {
    const asset =
        getPublicAssetById(assetId) || getPublicAssetBySrc(src) || null;
    const fallbackSrc = normalizeAssetPath(src);
    const fallbackAlt = String(alt || '').trim();
    const mediaSizes = String(sizes || '').trim();

    if (!asset) {
        return {
            src: fallbackSrc,
            alt: fallbackAlt,
            kind,
            sizes: mediaSizes || undefined,
            sources: [],
        };
    }

    const candidates = [
        normalizeAssetPath(asset.src),
        ...(Array.isArray(asset.derivatives) ? asset.derivatives : []).map(
            (item) => normalizeAssetPath(item)
        ),
    ].filter(Boolean);
    const uniqueCandidates = Array.from(new Set(candidates));

    const sourceGroups = new Map();
    for (const candidate of uniqueCandidates) {
        const mime = inferMimeType(candidate);
        if (!mime) continue;
        if (!sourceGroups.has(mime)) {
            sourceGroups.set(mime, []);
        }
        sourceGroups.get(mime).push(candidate);
    }

    const sourceOrder = ['image/avif', 'image/webp', 'image/jpeg', 'image/png'];
    const sources = sourceOrder
        .filter((mime) => sourceGroups.has(mime))
        .map((mime) => ({
            type: mime,
            srcset: buildSrcSet(sourceGroups.get(mime)),
        }))
        .filter((item) => item.srcset);

    const srcValue = normalizeAssetPath(asset.src) || fallbackSrc;
    const srcMime = inferMimeType(srcValue);
    const fallbackCandidates = srcMime
        ? sourceGroups.get(srcMime) || [srcValue]
        : [srcValue];

    return {
        assetId: String(asset.id || '').trim(),
        src: srcValue,
        srcset: buildSrcSet(fallbackCandidates),
        alt: localizeAssetAlt(asset, locale, fallbackAlt, preferProvidedAlt),
        kind,
        license: String(asset.license || '').trim(),
        usageScope: Array.isArray(asset.usage_scope) ? asset.usage_scope : [],
        sizes: mediaSizes || undefined,
        sources,
    };
}

export function getDictionary(locale) {
    const data = loadCache();
    return locale === 'en' ? data.en : data.es;
}

export function getNavigation() {
    return loadCache().nav;
}

export function getServices() {
    const data = loadCache();
    const v5Services = Array.isArray(data.v5Catalog?.services)
        ? data.v5Catalog.services
        : [];
    if (v5Services.length > 0) {
        return v5Services;
    }
    return Array.isArray(data.services?.services) ? data.services.services : [];
}

export function getBookingOptions() {
    const catalog = getV5Catalog();
    if (catalog && Array.isArray(catalog.booking_options)) {
        return catalog.booking_options;
    }
    return [
        {
            id: 'consulta',
            label_es: 'Consulta Dermatológica',
            label_en: 'Dermatology Consultation',
            base_price_usd: 40,
            tax_rate: 0,
            duration_min: 30,
            service_type: 'clinical',
            final_price_rule: 'base_plus_tax',
            price_label_short: 'USD 40.00 + IVA 0%',
            price_disclaimer_es:
                'El valor final se confirma antes de autorizar el pago.',
            price_disclaimer_en:
                'Final amount is confirmed before payment authorization.',
        },
        {
            id: 'telefono',
            label_es: 'Consulta Telefónica',
            label_en: 'Phone Consultation',
            base_price_usd: 25,
            tax_rate: 0,
            duration_min: 30,
            service_type: 'telemedicine',
            final_price_rule: 'base_plus_tax',
            price_label_short: 'USD 25.00 + IVA 0%',
            price_disclaimer_es:
                'El valor final se confirma antes de autorizar el pago.',
            price_disclaimer_en:
                'Final amount is confirmed before payment authorization.',
        },
        {
            id: 'video',
            label_es: 'Video Consulta',
            label_en: 'Video Consultation',
            base_price_usd: 30,
            tax_rate: 0,
            duration_min: 30,
            service_type: 'telemedicine',
            final_price_rule: 'base_plus_tax',
            price_label_short: 'USD 30.00 + IVA 0%',
            price_disclaimer_es:
                'El valor final se confirma antes de autorizar el pago.',
            price_disclaimer_en:
                'Final amount is confirmed before payment authorization.',
        },
        {
            id: 'laser',
            label_es: 'Láser Dermatológico',
            label_en: 'Dermatology Laser',
            base_price_usd: 150,
            tax_rate: 0.15,
            duration_min: 60,
            service_type: 'procedure',
            final_price_rule: 'base_plus_tax',
            price_label_short: 'USD 150.00 + IVA 15%',
            price_disclaimer_es:
                'El valor final se calcula con precio base e impuesto aplicable.',
            price_disclaimer_en:
                'Final amount is calculated from base price and applicable tax.',
        },
        {
            id: 'rejuvenecimiento',
            label_es: 'Rejuvenecimiento Facial',
            label_en: 'Facial Rejuvenation',
            base_price_usd: 120,
            tax_rate: 0.15,
            duration_min: 60,
            service_type: 'aesthetic',
            final_price_rule: 'base_plus_tax',
            price_label_short: 'USD 120.00 + IVA 15%',
            price_disclaimer_es:
                'El valor final se calcula con precio base e impuesto aplicable.',
            price_disclaimer_en:
                'Final amount is calculated from base price and applicable tax.',
        },
        {
            id: 'acne',
            label_es: 'Tratamiento de Acné',
            label_en: 'Acne Treatment',
            base_price_usd: 80,
            tax_rate: 0,
            duration_min: 30,
            service_type: 'clinical',
            final_price_rule: 'base_plus_tax',
            price_label_short: 'USD 80.00 + IVA 0%',
            price_disclaimer_es:
                'El valor final se confirma antes de autorizar el pago.',
            price_disclaimer_en:
                'Final amount is confirmed before payment authorization.',
        },
        {
            id: 'cancer',
            label_es: 'Detección de Cáncer de Piel',
            label_en: 'Skin Cancer Screening',
            base_price_usd: 70,
            tax_rate: 0,
            duration_min: 30,
            service_type: 'clinical',
            final_price_rule: 'base_plus_tax',
            price_label_short: 'USD 70.00 + IVA 0%',
            price_disclaimer_es:
                'El valor final se confirma antes de autorizar el pago.',
            price_disclaimer_en:
                'Final amount is confirmed before payment authorization.',
        },
    ];
}

export function getBookingOptionById(serviceId) {
    const normalized = String(serviceId || '')
        .trim()
        .toLowerCase();
    if (!normalized) {
        return null;
    }
    return (
        getBookingOptions().find(
            (option) =>
                String(option.id || '')
                    .trim()
                    .toLowerCase() === normalized
        ) || null
    );
}

export function getLocalizedBookingOptions(locale) {
    const isEnglish = locale === 'en';
    return getBookingOptions().map((option) => {
        const base = Number(option.base_price_usd || 0);
        const taxRate = Number(option.tax_rate || 0);
        const taxPct = Math.round(taxRate * 100);
        const total = Number((base * (1 + taxRate)).toFixed(2));
        const label = isEnglish
            ? option.label_en || option.label_es || option.id
            : option.label_es || option.label_en || option.id;
        const shortLabel =
            (isEnglish
                ? option.price_label_short_en
                : option.price_label_short_es) ||
            option.price_label_short ||
            (isEnglish
                ? `USD ${base.toFixed(2)} + Tax ${taxPct}%`
                : `USD ${base.toFixed(2)} + IVA ${taxPct}%`);
        const disclaimer =
            (isEnglish
                ? option.price_disclaimer_en
                : option.price_disclaimer_es) ||
            (isEnglish
                ? 'Final amount is confirmed before payment authorization.'
                : 'El valor final se confirma antes de autorizar el pago.');
        const priceLabel = isEnglish
            ? `${label} - USD ${base.toFixed(2)} + Tax ${taxPct}%`
            : `${label} - USD ${base.toFixed(2)} + IVA ${taxPct}%`;
        return {
            id: option.id,
            label,
            price: base,
            total,
            taxRate,
            taxPercent: taxPct,
            finalPriceRule: String(option.final_price_rule || 'base_plus_tax'),
            priceLabelShort: shortLabel,
            priceDisclaimer: disclaimer,
            serviceType: String(option.service_type || 'clinical'),
            durationMin: Number(option.duration_min || 0),
            optionLabel: priceLabel,
        };
    });
}

export function localizeService(service, locale) {
    if (!service || locale !== 'en') {
        return service;
    }

    const override = EN_SERVICE_COPY[service.slug];
    if (!override) {
        return service;
    }

    return {
        ...service,
        hero: override.hero || service.hero,
        summary: override.summary || service.summary,
        indications: override.indications || service.indications,
        contraindications:
            override.contraindications || service.contraindications,
        faq: override.faq || service.faq,
    };
}

export function getLocalizedServices(locale) {
    return getServices().map((service) => localizeService(service, locale));
}

export function getServiceIntentDefinitions(locale) {
    return locale === 'en'
        ? SERVICE_INTENT_DEFINITIONS.en
        : SERVICE_INTENT_DEFINITIONS.es;
}

export function resolveServiceIntents(service) {
    const tokens = ['all'];
    const slug = String(service?.slug || '');

    if (!slug) {
        return tokens;
    }

    for (const [intentId, slugs] of Object.entries(SERVICE_INTENT_SLUG_MAP)) {
        if (slugs.includes(slug)) {
            tokens.push(intentId);
        }
    }

    return tokens;
}

export function getServiceBySlug(slug) {
    return getServices().find((item) => item?.slug === slug) || null;
}

export function getLocalizedServiceBySlug(slug, locale) {
    return localizeService(getServiceBySlug(slug), locale);
}

export function getLocalizedServicesBySlugs(slugs, locale) {
    return (Array.isArray(slugs) ? slugs : [])
        .map((slug) => getLocalizedServiceBySlug(slug, locale))
        .filter(Boolean);
}

export function getDeferredSection(sectionId) {
    const deferred = loadCache().deferred;
    return typeof deferred?.[sectionId] === 'string' ? deferred[sectionId] : '';
}

export function localePrefix(locale) {
    return locale === 'en' ? '/en' : '/es';
}

export function homePath(locale) {
    return locale === 'en' ? '/en/' : '/es/';
}

export function serviceHubPath(locale) {
    return locale === 'en' ? '/en/services/' : '/es/servicios/';
}

export function telemedicinePath(locale) {
    return locale === 'en' ? '/en/telemedicine/' : '/es/telemedicina/';
}

export function legalBasePath(locale) {
    return locale === 'en' ? '/en/legal/' : '/es/legal/';
}

export function servicePath(locale, slug) {
    if (locale === 'en') {
        return `/en/services/${slug}/`;
    }
    return `/es/servicios/${slug}/`;
}

export function localizeCategory(label, locale) {
    const normalized = String(label || '')
        .trim()
        .toLowerCase();
    if (locale === 'en') {
        if (normalized === 'clinical') return 'Clinical Dermatology';
        if (normalized === 'aesthetic') return 'Medical Aesthetics';
        if (normalized === 'children') return 'Pediatric Dermatology';
        return 'Specialized Dermatology';
    }

    if (normalized === 'clinical') return 'Dermatologia clinica';
    if (normalized === 'aesthetic') return 'Estetica medica';
    if (normalized === 'children') return 'Dermatologia pediatrica';
    return 'Dermatologia especializada';
}

export function localizeAudience(audience, locale) {
    return (Array.isArray(audience) ? audience : [])
        .map((item) => AUDIENCE_LABELS[item]?.[locale === 'en' ? 'en' : 'es'])
        .filter(Boolean);
}

export function localizeDoctorProfiles(doctors, locale) {
    return (Array.isArray(doctors) ? doctors : [])
        .map((item) => DOCTOR_LABELS[item]?.[locale === 'en' ? 'en' : 'es'])
        .filter(Boolean);
}

export function mapServiceHint(slug) {
    const service = getServiceBySlug(slug);
    const runtimeServiceId = String(
        service?.runtime_service_id || service?.booking_service_id || ''
    ).trim();
    if (runtimeServiceId) {
        return runtimeServiceId;
    }
    const contentHint = String(service?.cta?.service_hint || '').trim();
    if (contentHint) {
        return contentHint;
    }

    const legacyMap = {
        'acne-rosacea': 'acne',
        'laser-dermatologico': 'laser',
        'diagnostico-integral': 'consulta',
    };

    return legacyMap[slug] || 'consulta';
}

export function getServiceCtaLabel(service, locale) {
    const localized =
        locale === 'en' ? service?.cta?.label_en : service?.cta?.label_es;
    if (typeof localized === 'string' && localized.trim()) {
        return localized.trim();
    }

    return locale === 'en' ? 'Explore service' : 'Explorar servicio';
}

export function inferRoutePlannerProfile(service) {
    const slug = String(service?.slug || '');
    const category = String(service?.category || '');

    if (!slug) {
        return 'diagnosis';
    }

    if (slug === 'dermatologia-pediatrica' || category === 'children') {
        return 'pediatric';
    }

    if (
        category === 'aesthetic' ||
        [
            'verrugas',
            'cicatrices',
            'peeling-quimico',
            'mesoterapia',
            'laser-dermatologico',
            'botox',
            'bioestimuladores-colageno',
        ].includes(slug)
    ) {
        return 'procedure';
    }

    if (
        [
            'diagnostico-integral',
            'acne-rosacea',
            'granitos-brazos-piernas',
            'piel-cabello-unas',
        ].includes(slug)
    ) {
        return 'remote';
    }

    return 'diagnosis';
}

function overlapScore(left, right) {
    const leftItems = new Set(Array.isArray(left) ? left : []);
    const rightItems = Array.isArray(right) ? right : [];
    let score = 0;

    for (const item of rightItems) {
        if (leftItems.has(item)) {
            score += 1;
        }
    }

    return score;
}

export function getRelatedServices(slug, locale, limit = 3) {
    const current = getServiceBySlug(slug);
    const all = getServices();
    if (!current) {
        return getLocalizedServices(locale).slice(0, limit);
    }

    return all
        .filter((candidate) => candidate?.slug && candidate.slug !== slug)
        .map((candidate) => {
            let score = 0;

            if (candidate.category === current.category) {
                score += 8;
            }
            if (candidate.subcategory === current.subcategory) {
                score += 4;
            }

            score += overlapScore(current.audience, candidate.audience) * 2;
            score +=
                overlapScore(current.doctor_profile, candidate.doctor_profile) *
                2;

            if (
                candidate.category === 'children' &&
                current.category !== 'children'
            ) {
                score -= 1;
            }

            return {
                candidate,
                score,
            };
        })
        .sort((left, right) => {
            if (right.score !== left.score) {
                return right.score - left.score;
            }

            return String(
                left.candidate.hero || left.candidate.slug
            ).localeCompare(
                String(right.candidate.hero || right.candidate.slug),
                locale === 'en' ? 'en' : 'es'
            );
        })
        .slice(0, limit)
        .map(({ candidate }) => localizeService(candidate, locale));
}

export function getLocaleSwitchPath(locale, pathname) {
    const current = String(pathname || '/');
    if (locale === 'es') {
        if (current.startsWith('/en/services/')) {
            return current.replace('/en/services/', '/es/servicios/');
        }
        if (current.startsWith('/en/telemedicine/')) {
            return '/es/telemedicina/';
        }
        if (current.startsWith('/en/legal/terms/'))
            return '/es/legal/terminos/';
        if (current.startsWith('/en/legal/privacy/'))
            return '/es/legal/privacidad/';
        if (current.startsWith('/en/legal/cookies/'))
            return '/es/legal/cookies/';
        if (current.startsWith('/en/legal/medical-disclaimer/')) {
            return '/es/legal/aviso-medico/';
        }
        return '/es/';
    }

    if (current.startsWith('/es/servicios/')) {
        return current.replace('/es/servicios/', '/en/services/');
    }
    if (current.startsWith('/es/telemedicina/')) {
        return '/en/telemedicine/';
    }
    if (current.startsWith('/es/legal/terminos/')) return '/en/legal/terms/';
    if (current.startsWith('/es/legal/privacidad/'))
        return '/en/legal/privacy/';
    if (current.startsWith('/es/legal/cookies/')) return '/en/legal/cookies/';
    if (current.startsWith('/es/legal/aviso-medico/'))
        return '/en/legal/medical-disclaimer/';
    return '/en/';
}
