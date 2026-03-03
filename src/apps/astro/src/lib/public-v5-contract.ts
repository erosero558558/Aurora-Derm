export type PublicV5FeatureFlags = {
    public_v5_enabled: boolean;
    public_v5_ratio: number;
    public_v5_force_locale: '' | 'es' | 'en';
    public_v5_kill_switch: boolean;
};

export type PublicV5BookingOption = {
    id: string;
    label_es: string;
    label_en: string;
    base_price_usd: number;
    tax_rate: number;
    duration_min: number;
    service_type: string;
    final_price_rule: 'base_plus_tax';
    price_label_short: string;
    price_label_short_en: string;
    price_disclaimer_es: string;
    price_disclaimer_en: string;
};

export type PublicV5ServiceMedia = {
    src: string;
    asset_id: string;
    alt_es: string;
    alt_en: string;
    kind: string;
};

export type PublicV5ServiceCta = {
    type: string;
    service_hint: string;
    label_es: string;
    label_en: string;
};

export type PublicV5Service = {
    slug: string;
    category: string;
    subcategory: string;
    audience: string[];
    doctor_profile: string[];
    hero: string;
    summary: string;
    indications: string[];
    contraindications: string[];
    duration: string;
    faq: string[];
    media: PublicV5ServiceMedia;
    cta: PublicV5ServiceCta;
    runtime_service_id: string;
    base_price_usd: number;
    tax_rate: number;
    final_price_rule: 'base_plus_tax';
    final_price_usd: number;
    is_from_price: boolean;
    price_label_short: string;
    price_disclaimer_es: string;
    price_disclaimer_en: string;
    price_from: number;
    iva: number;
};

export type PublicV5Catalog = {
    version: string;
    updated_at: string;
    currency: string;
    locale_defaults: {
        primary: 'es' | 'en';
        secondary: 'es' | 'en';
    };
    feature_flags_defaults: PublicV5FeatureFlags;
    booking_options: PublicV5BookingOption[];
    services: PublicV5Service[];
};

export type PublicV5UiTokens = {
    version: string;
    updated_at: string;
    theme: string;
    color: Record<string, string>;
    typography: Record<string, string>;
    spacing: Record<string, string>;
    radius: Record<string, string>;
    shadow: Record<string, string>;
    motion: Record<string, string | number>;
    density: Record<string, string | number>;
};

export type PublicV5Asset = {
    id: string;
    src: string;
    derivatives: string[];
    license: string;
    usage_scope: string[];
    focal_point: string;
    alt_es: string;
    alt_en: string;
};

export type PublicV5AssetsManifest = {
    version: string;
    updated_at: string;
    source_policy: string;
    default_license: string;
    assets: PublicV5Asset[];
};

const isNonEmptyString = (value: unknown): value is string =>
    typeof value === 'string' && value.trim().length > 0;

export function validatePublicV5Catalog(candidate: unknown): candidate is PublicV5Catalog {
    if (!candidate || typeof candidate !== 'object' || Array.isArray(candidate)) {
        return false;
    }

    const catalog = candidate as Partial<PublicV5Catalog>;
    if (
        !isNonEmptyString(catalog.version) ||
        !isNonEmptyString(catalog.updated_at) ||
        !isNonEmptyString(catalog.currency)
    ) {
        return false;
    }

    const flags = catalog.feature_flags_defaults as Partial<PublicV5FeatureFlags> | undefined;
    if (!flags || typeof flags !== 'object') {
        return false;
    }

    const ratio = Number(flags.public_v5_ratio);
    if (
        typeof flags.public_v5_enabled !== 'boolean' ||
        typeof flags.public_v5_kill_switch !== 'boolean' ||
        !Number.isFinite(ratio) ||
        ratio < 0 ||
        ratio > 1
    ) {
        return false;
    }

    if (
        flags.public_v5_force_locale !== '' &&
        flags.public_v5_force_locale !== 'es' &&
        flags.public_v5_force_locale !== 'en'
    ) {
        return false;
    }

    if (!Array.isArray(catalog.booking_options) || catalog.booking_options.length === 0) {
        return false;
    }

    if (!Array.isArray(catalog.services) || catalog.services.length === 0) {
        return false;
    }

    return catalog.services.every((service) => {
        if (!service || typeof service !== 'object' || Array.isArray(service)) {
            return false;
        }

        const candidateService = service as Partial<PublicV5Service>;
        const media = candidateService.media as Partial<PublicV5ServiceMedia> | undefined;
        const cta = candidateService.cta as Partial<PublicV5ServiceCta> | undefined;

        return (
            isNonEmptyString(candidateService.slug) &&
            isNonEmptyString(candidateService.category) &&
            isNonEmptyString(candidateService.subcategory) &&
            Array.isArray(candidateService.audience) &&
            candidateService.audience.every(isNonEmptyString) &&
            Array.isArray(candidateService.doctor_profile) &&
            candidateService.doctor_profile.every(isNonEmptyString) &&
            isNonEmptyString(candidateService.hero) &&
            isNonEmptyString(candidateService.summary) &&
            Array.isArray(candidateService.indications) &&
            candidateService.indications.every(isNonEmptyString) &&
            Array.isArray(candidateService.contraindications) &&
            candidateService.contraindications.every(isNonEmptyString) &&
            isNonEmptyString(candidateService.duration) &&
            Array.isArray(candidateService.faq) &&
            candidateService.faq.every(isNonEmptyString) &&
            !!media &&
            isNonEmptyString(media.src) &&
            isNonEmptyString(media.asset_id) &&
            isNonEmptyString(media.alt_es) &&
            isNonEmptyString(media.alt_en) &&
            isNonEmptyString(media.kind) &&
            !!cta &&
            isNonEmptyString(cta.type) &&
            isNonEmptyString(cta.service_hint) &&
            isNonEmptyString(cta.label_es) &&
            isNonEmptyString(cta.label_en) &&
            isNonEmptyString(candidateService.runtime_service_id) &&
            Number.isFinite(Number(candidateService.base_price_usd)) &&
            Number.isFinite(Number(candidateService.tax_rate)) &&
            Number.isFinite(Number(candidateService.final_price_usd)) &&
            isNonEmptyString(candidateService.final_price_rule) &&
            isNonEmptyString(candidateService.price_label_short) &&
            isNonEmptyString(candidateService.price_disclaimer_es) &&
            isNonEmptyString(candidateService.price_disclaimer_en) &&
            Number.isFinite(Number(candidateService.price_from)) &&
            Number.isFinite(Number(candidateService.iva))
        );
    });
}

export function validatePublicV5UiTokens(candidate: unknown): candidate is PublicV5UiTokens {
    if (!candidate || typeof candidate !== 'object' || Array.isArray(candidate)) {
        return false;
    }

    const tokens = candidate as Partial<PublicV5UiTokens>;
    return (
        isNonEmptyString(tokens.version) &&
        isNonEmptyString(tokens.updated_at) &&
        isNonEmptyString(tokens.theme) &&
        !!tokens.color &&
        !!tokens.typography &&
        !!tokens.spacing &&
        !!tokens.radius &&
        !!tokens.shadow &&
        !!tokens.motion &&
        !!tokens.density
    );
}

export function validatePublicV5AssetsManifest(
    candidate: unknown
): candidate is PublicV5AssetsManifest {
    if (!candidate || typeof candidate !== 'object' || Array.isArray(candidate)) {
        return false;
    }

    const manifest = candidate as Partial<PublicV5AssetsManifest>;
    if (
        !isNonEmptyString(manifest.version) ||
        !isNonEmptyString(manifest.updated_at) ||
        !isNonEmptyString(manifest.source_policy) ||
        !isNonEmptyString(manifest.default_license) ||
        !Array.isArray(manifest.assets)
    ) {
        return false;
    }

    return manifest.assets.every((asset) => {
        if (!asset || typeof asset !== 'object' || Array.isArray(asset)) {
            return false;
        }
        const candidateAsset = asset as Partial<PublicV5Asset>;
        return (
            isNonEmptyString(candidateAsset.id) &&
            isNonEmptyString(candidateAsset.src) &&
            Array.isArray(candidateAsset.derivatives) &&
            candidateAsset.derivatives.every(isNonEmptyString) &&
            isNonEmptyString(candidateAsset.license) &&
            Array.isArray(candidateAsset.usage_scope) &&
            candidateAsset.usage_scope.every(isNonEmptyString) &&
            isNonEmptyString(candidateAsset.focal_point) &&
            isNonEmptyString(candidateAsset.alt_es) &&
            isNonEmptyString(candidateAsset.alt_en)
        );
    });
}
