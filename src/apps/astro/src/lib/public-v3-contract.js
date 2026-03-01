/**
 * @typedef {'ink' | 'porcelain' | 'silver'} PublicV3Tone
 */

/**
 * @typedef {'image' | 'video'} PublicV3MediaKind
 */

/**
 * @typedef {{
 *   src: string;
 *   alt: string;
 *   kind: PublicV3MediaKind;
 *   poster?: string;
 * }} PublicV3Media
 */

/**
 * @typedef {'booking' | 'service_hub' | 'service_detail' | 'telemedicine' | 'legal' | 'whatsapp'} PublicV3CtaTarget
 */

/**
 * @typedef {{
 *   label: string;
 *   href: string;
 *   target: PublicV3CtaTarget;
 * }} PublicV3Cta
 */

/**
 * @typedef {{
 *   id: string;
 *   eyebrow: string;
 *   title: string;
 *   deck: string;
 *   tone: PublicV3Tone;
 *   media: PublicV3Media;
 *   stats: string[];
 *   primary: PublicV3Cta;
 *   secondary?: PublicV3Cta;
 * }} PublicV3Stage
 */

const VALID_TONES = new Set(['ink', 'porcelain', 'silver']);
const VALID_CTA_TARGETS = new Set([
    'booking',
    'service_hub',
    'service_detail',
    'telemedicine',
    'legal',
    'whatsapp',
]);
const VALID_MEDIA_KINDS = new Set(['image', 'video']);

function asTrimmedString(value, fallback = '') {
    const normalized = String(value || '').trim();
    return normalized || fallback;
}

function normalizeTone(value, fallback = 'ink') {
    const tone = asTrimmedString(value, fallback).toLowerCase();
    return VALID_TONES.has(tone) ? tone : fallback;
}

function normalizeCta(rawCta, fallbackTarget) {
    const input =
        rawCta && typeof rawCta === 'object' && !Array.isArray(rawCta)
            ? rawCta
            : {};
    const target = asTrimmedString(input.target, fallbackTarget).toLowerCase();

    return {
        label: asTrimmedString(input.label, ''),
        href: asTrimmedString(input.href, '#'),
        target: VALID_CTA_TARGETS.has(target) ? target : fallbackTarget,
    };
}

function normalizeMedia(rawMedia, fallbackAlt) {
    if (typeof rawMedia === 'string') {
        return {
            src: asTrimmedString(rawMedia, ''),
            alt: asTrimmedString(fallbackAlt, ''),
            kind: 'image',
        };
    }

    const input =
        rawMedia && typeof rawMedia === 'object' && !Array.isArray(rawMedia)
            ? rawMedia
            : {};
    const kind = asTrimmedString(input.kind, 'image').toLowerCase();
    const media = {
        src: asTrimmedString(input.src, ''),
        alt: asTrimmedString(input.alt, fallbackAlt),
        kind: VALID_MEDIA_KINDS.has(kind) ? kind : 'image',
    };
    const poster = asTrimmedString(input.poster, '');
    if (poster) {
        media.poster = poster;
    }
    return media;
}

function normalizeStats(rawStats) {
    if (!Array.isArray(rawStats)) {
        return [];
    }
    return rawStats
        .map((value) => asTrimmedString(value, ''))
        .filter(Boolean)
        .slice(0, 4);
}

export function normalizeStage(rawStage, options = {}) {
    const input =
        rawStage && typeof rawStage === 'object' && !Array.isArray(rawStage)
            ? rawStage
            : {};
    const fallbackId = asTrimmedString(options.fallbackId, 'stage');
    const stageId = asTrimmedString(input.id, fallbackId);
    const eyebrow = asTrimmedString(
        input.eyebrow,
        asTrimmedString(input.category, '')
    );
    const title = asTrimmedString(input.title, '');
    const deck = asTrimmedString(input.deck, '');
    const tone = normalizeTone(input.tone, 'ink');
    const media = normalizeMedia(input.mediaMeta || input.media, title);
    const primary = normalizeCta(input.primary, 'booking');
    const secondary =
        input.secondary && typeof input.secondary === 'object'
            ? normalizeCta(input.secondary, 'service_hub')
            : undefined;

    /** @type {PublicV3Stage} */
    const stage = {
        id: stageId,
        eyebrow,
        title,
        deck,
        tone,
        media,
        stats: normalizeStats(input.stats),
        primary,
    };

    if (secondary && secondary.label && secondary.href && secondary.target) {
        stage.secondary = secondary;
    }

    return stage;
}

export const PUBLIC_V3_CONTRACT = {
    tones: Array.from(VALID_TONES.values()),
    ctaTargets: Array.from(VALID_CTA_TARGETS.values()),
    mediaKinds: Array.from(VALID_MEDIA_KINDS.values()),
};
