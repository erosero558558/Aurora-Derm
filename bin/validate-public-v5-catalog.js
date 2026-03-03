#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const path = require('node:path');

const repoRoot = process.cwd();
const catalogPath = path.join(repoRoot, 'content', 'public-v5', 'catalog.json');
const tokensPath = path.join(
    repoRoot,
    'content',
    'public-v5',
    'ui-tokens.json'
);
const assetsPath = path.join(
    repoRoot,
    'content',
    'public-v5',
    'assets-manifest.json'
);

function fail(message) {
    console.error(`[public-v5] ${message}`);
    process.exitCode = 1;
}

function readJson(filePath) {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function isNonEmptyString(value) {
    return typeof value === 'string' && value.trim() !== '';
}

function normalizeAssetPath(value) {
    return String(value || '')
        .trim()
        .replace(/\\/g, '/');
}

function toRepoPath(assetPath) {
    const normalized = normalizeAssetPath(assetPath).replace(/^\/+/, '');
    return path.join(repoRoot, normalized);
}

function normalizeComparableLocalizedText(value) {
    return String(value || '')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, ' ')
        .trim();
}

function buildAssetIndexes(manifest) {
    const byId = new Map();
    const byPath = new Map();

    const assets = Array.isArray(manifest?.assets) ? manifest.assets : [];
    assets.forEach((asset) => {
        const normalizedId = String(asset?.id || '')
            .trim()
            .toLowerCase();
        if (normalizedId) {
            byId.set(normalizedId, asset);
        }

        const paths = [
            normalizeAssetPath(asset?.src),
            ...(Array.isArray(asset?.derivatives) ? asset.derivatives : []).map(
                (entry) => normalizeAssetPath(entry)
            ),
        ].filter(Boolean);

        paths.forEach((entry) => byPath.set(entry, asset));
    });

    return { byId, byPath };
}

function validateCatalog(catalog, manifest) {
    if (!catalog || typeof catalog !== 'object' || Array.isArray(catalog)) {
        fail('catalog must be an object.');
        return;
    }

    ['version', 'updated_at', 'currency'].forEach((key) => {
        if (!isNonEmptyString(catalog[key])) {
            fail(`catalog.${key} must be a non-empty string.`);
        }
    });

    const flags = catalog.feature_flags_defaults;
    if (!flags || typeof flags !== 'object' || Array.isArray(flags)) {
        fail('catalog.feature_flags_defaults must be an object.');
    } else {
        if (typeof flags.public_v5_enabled !== 'boolean') {
            fail(
                'catalog.feature_flags_defaults.public_v5_enabled must be boolean.'
            );
        }
        if (typeof flags.public_v5_kill_switch !== 'boolean') {
            fail(
                'catalog.feature_flags_defaults.public_v5_kill_switch must be boolean.'
            );
        }
        const ratio = Number(flags.public_v5_ratio);
        if (!Number.isFinite(ratio) || ratio < 0 || ratio > 1) {
            fail(
                'catalog.feature_flags_defaults.public_v5_ratio must be between 0 and 1.'
            );
        }
        const forcedLocale = String(flags.public_v5_force_locale || '')
            .trim()
            .toLowerCase();
        if (!['', 'es', 'en'].includes(forcedLocale)) {
            fail(
                'catalog.feature_flags_defaults.public_v5_force_locale must be "", "es", or "en".'
            );
        }
    }

    const booking = Array.isArray(catalog.booking_options)
        ? catalog.booking_options
        : [];
    if (booking.length === 0) {
        fail('catalog.booking_options must be a non-empty array.');
    }

    const bookingMap = new Map();
    booking.forEach((option, index) => {
        const prefix = `catalog.booking_options[${index}]`;
        [
            'id',
            'label_es',
            'label_en',
            'final_price_rule',
            'price_label_short',
            'price_disclaimer_es',
            'price_disclaimer_en',
        ].forEach((key) => {
            if (!isNonEmptyString(option && option[key])) {
                fail(`${prefix}.${key} must be a non-empty string.`);
            }
        });
        const base = Number(option && option.base_price_usd);
        const tax = Number(option && option.tax_rate);
        if (!Number.isFinite(base) || base < 0) {
            fail(`${prefix}.base_price_usd must be a non-negative number.`);
        }
        if (!Number.isFinite(tax) || tax < 0 || tax > 1) {
            fail(`${prefix}.tax_rate must be between 0 and 1.`);
        }

        const id = String(option?.id || '')
            .trim()
            .toLowerCase();
        if (id) {
            if (bookingMap.has(id)) {
                fail(`${prefix}.id is duplicated (${option.id}).`);
            } else {
                bookingMap.set(id, option);
            }
        }
    });

    const services = Array.isArray(catalog.services) ? catalog.services : [];
    if (services.length === 0) {
        fail('catalog.services must be a non-empty array.');
        return;
    }

    const assetIndexes = buildAssetIndexes(manifest);
    const seenSlugs = new Set();

    services.forEach((service, index) => {
        const prefix = `catalog.services[${index}]`;
        [
            'slug',
            'category',
            'subcategory',
            'hero',
            'summary',
            'duration',
            'runtime_service_id',
            'final_price_rule',
        ].forEach((key) => {
            if (!isNonEmptyString(service && service[key])) {
                fail(`${prefix}.${key} must be a non-empty string.`);
            }
        });

        const slug = String(service?.slug || '').trim();
        if (slug) {
            const normalizedSlug = slug.toLowerCase();
            if (seenSlugs.has(normalizedSlug)) {
                fail(`${prefix}.slug is duplicated (${slug}).`);
            } else {
                seenSlugs.add(normalizedSlug);
            }
        }

        [
            'audience',
            'doctor_profile',
            'indications',
            'contraindications',
            'faq',
        ].forEach((key) => {
            if (!Array.isArray(service?.[key])) {
                fail(`${prefix}.${key} must be an array.`);
            }
        });

        const basePrice = Number(service?.base_price_usd);
        const taxRate = Number(service?.tax_rate);
        const finalPrice = Number(service?.final_price_usd);
        if (!Number.isFinite(basePrice) || basePrice < 0) {
            fail(`${prefix}.base_price_usd must be a non-negative number.`);
        }
        if (!Number.isFinite(taxRate) || taxRate < 0 || taxRate > 1) {
            fail(`${prefix}.tax_rate must be between 0 and 1.`);
        }
        if (!Number.isFinite(finalPrice) || finalPrice < 0) {
            fail(`${prefix}.final_price_usd must be a non-negative number.`);
        }

        if (!isNonEmptyString(service?.price_label_short)) {
            fail(`${prefix}.price_label_short must be a non-empty string.`);
        }
        if (!isNonEmptyString(service?.price_disclaimer_es)) {
            fail(`${prefix}.price_disclaimer_es must be a non-empty string.`);
        }
        if (!isNonEmptyString(service?.price_disclaimer_en)) {
            fail(`${prefix}.price_disclaimer_en must be a non-empty string.`);
        }

        const cta = service?.cta;
        if (!cta || typeof cta !== 'object' || Array.isArray(cta)) {
            fail(`${prefix}.cta must be an object.`);
        } else {
            ['type', 'service_hint', 'label_es', 'label_en'].forEach((key) => {
                if (!isNonEmptyString(cta[key])) {
                    fail(`${prefix}.cta.${key} must be a non-empty string.`);
                }
            });
        }

        const runtimeServiceId = String(service?.runtime_service_id || '')
            .trim()
            .toLowerCase();
        const serviceHint = String(service?.cta?.service_hint || '')
            .trim()
            .toLowerCase();
        const bookingOption = bookingMap.get(runtimeServiceId);

        if (!bookingOption) {
            fail(
                `${prefix}.runtime_service_id references unknown booking option (${service?.runtime_service_id}).`
            );
        }

        if (
            serviceHint &&
            runtimeServiceId &&
            serviceHint !== runtimeServiceId
        ) {
            fail(
                `${prefix}.cta.service_hint must match runtime_service_id (${serviceHint} != ${runtimeServiceId}).`
            );
        }

        if (bookingOption) {
            const bookingBase = Number(bookingOption.base_price_usd || 0);
            const bookingTax = Number(bookingOption.tax_rate || 0);
            const bookingRule = String(bookingOption.final_price_rule || '')
                .trim()
                .toLowerCase();
            const expectedTotal = Number(
                (bookingBase * (1 + bookingTax)).toFixed(2)
            );

            if (Number.isFinite(basePrice) && basePrice !== bookingBase) {
                fail(
                    `${prefix}.base_price_usd must match booking option ${runtimeServiceId}.`
                );
            }
            if (Number.isFinite(taxRate) && taxRate !== bookingTax) {
                fail(
                    `${prefix}.tax_rate must match booking option ${runtimeServiceId}.`
                );
            }
            if (
                isNonEmptyString(service?.final_price_rule) &&
                String(service.final_price_rule).trim().toLowerCase() !==
                    bookingRule
            ) {
                fail(
                    `${prefix}.final_price_rule must match booking option ${runtimeServiceId}.`
                );
            }
            if (
                Number.isFinite(finalPrice) &&
                Math.abs(finalPrice - expectedTotal) > 0.000001
            ) {
                fail(
                    `${prefix}.final_price_usd must equal base*(1+tax) from booking option ${runtimeServiceId}.`
                );
            }
        }

        if (
            Number.isFinite(Number(service?.price_from)) &&
            Number(service.price_from) !== Number(basePrice)
        ) {
            fail(`${prefix}.price_from must match base_price_usd.`);
        }
        if (
            Number.isFinite(Number(service?.iva)) &&
            Number(service.iva) !== Number(taxRate)
        ) {
            fail(`${prefix}.iva must match tax_rate.`);
        }

        const media = service?.media;
        if (!media || typeof media !== 'object' || Array.isArray(media)) {
            fail(`${prefix}.media must be an object.`);
            return;
        }

        const mediaSrc = normalizeAssetPath(media?.src);
        const mediaAssetId = String(media?.asset_id || media?.assetId || '')
            .trim()
            .toLowerCase();

        if (!mediaSrc) {
            fail(`${prefix}.media.src must be a non-empty string.`);
            return;
        }
        if (!mediaAssetId) {
            fail(`${prefix}.media.asset_id must be a non-empty string.`);
            return;
        }
        if (!isNonEmptyString(media?.alt_es)) {
            fail(`${prefix}.media.alt_es must be a non-empty string.`);
        }
        if (!isNonEmptyString(media?.alt_en)) {
            fail(`${prefix}.media.alt_en must be a non-empty string.`);
        }
        if (
            isNonEmptyString(media?.alt_es) &&
            isNonEmptyString(media?.alt_en)
        ) {
            const comparableEs = normalizeComparableLocalizedText(media.alt_es);
            const comparableEn = normalizeComparableLocalizedText(media.alt_en);
            if (comparableEs && comparableEs === comparableEn) {
                fail(
                    `${prefix}.media.alt_en appears untranslated (matches alt_es).`
                );
            }
        }

        const assetById = assetIndexes.byId.get(mediaAssetId);
        const assetByPath = assetIndexes.byPath.get(mediaSrc);

        if (!assetById) {
            fail(
                `${prefix}.media.asset_id not found in assets-manifest (${mediaAssetId}).`
            );
            return;
        }
        if (!assetByPath) {
            fail(
                `${prefix}.media.src not found in assets-manifest (${mediaSrc}).`
            );
            return;
        }

        const byPathId = String(assetByPath?.id || '')
            .trim()
            .toLowerCase();
        if (byPathId !== mediaAssetId) {
            fail(
                `${prefix}.media.asset_id/src mismatch (${mediaAssetId} != ${byPathId}).`
            );
        }

        const usageScope = Array.isArray(assetById?.usage_scope)
            ? assetById.usage_scope.map((entry) =>
                  String(entry || '')
                      .trim()
                      .toLowerCase()
              )
            : [];
        if (
            !usageScope.includes('services') &&
            !usageScope.includes('service-detail')
        ) {
            fail(
                `${prefix}.media.asset_id must include services or service-detail usage_scope.`
            );
        }
    });
}

function validateTokens(tokens) {
    if (!tokens || typeof tokens !== 'object' || Array.isArray(tokens)) {
        fail('ui-tokens must be an object.');
        return;
    }
    ['version', 'updated_at', 'theme'].forEach((key) => {
        if (!isNonEmptyString(tokens[key])) {
            fail(`ui-tokens.${key} must be a non-empty string.`);
        }
    });
    [
        'color',
        'typography',
        'spacing',
        'radius',
        'shadow',
        'motion',
        'density',
    ].forEach((key) => {
        const value = tokens[key];
        if (!value || typeof value !== 'object' || Array.isArray(value)) {
            fail(`ui-tokens.${key} must be an object.`);
        }
    });
}

function validateAssets(manifest) {
    if (!manifest || typeof manifest !== 'object' || Array.isArray(manifest)) {
        fail('assets-manifest must be an object.');
        return;
    }
    ['version', 'updated_at', 'source_policy', 'default_license'].forEach(
        (key) => {
            if (!isNonEmptyString(manifest[key])) {
                fail(`assets-manifest.${key} must be a non-empty string.`);
            }
        }
    );

    const assets = Array.isArray(manifest.assets) ? manifest.assets : [];
    if (assets.length === 0) {
        fail('assets-manifest.assets must be a non-empty array.');
        return;
    }

    const ids = new Set();
    let hasAvifVariant = false;
    assets.forEach((asset, index) => {
        const prefix = `assets-manifest.assets[${index}]`;
        ['id', 'src', 'license', 'focal_point', 'alt_es', 'alt_en'].forEach(
            (key) => {
                if (!isNonEmptyString(asset && asset[key])) {
                    fail(`${prefix}.${key} must be a non-empty string.`);
                }
            }
        );
        if (ids.has(asset.id)) {
            fail(`${prefix}.id is duplicated (${asset.id}).`);
        }
        ids.add(asset.id);
        if (
            !Array.isArray(asset.derivatives) ||
            asset.derivatives.length === 0
        ) {
            fail(`${prefix}.derivatives must be a non-empty array.`);
        }
        if (
            !Array.isArray(asset.usage_scope) ||
            asset.usage_scope.length === 0
        ) {
            fail(`${prefix}.usage_scope must be a non-empty array.`);
        }

        const allPaths = [
            normalizeAssetPath(asset.src),
            ...(Array.isArray(asset.derivatives) ? asset.derivatives : []).map(
                (entry) => normalizeAssetPath(entry)
            ),
        ].filter(Boolean);

        allPaths.forEach((entry) => {
            if (!fs.existsSync(toRepoPath(entry))) {
                fail(`${prefix} file does not exist in repo: ${entry}`);
            }
            if (entry.toLowerCase().endsWith('.avif')) {
                hasAvifVariant = true;
            }
        });
    });

    if (!hasAvifVariant) {
        fail('assets-manifest must include at least one AVIF variant.');
    }
}

function run() {
    if (!fs.existsSync(catalogPath)) {
        fail(`Missing file: ${catalogPath}`);
        return;
    }
    if (!fs.existsSync(tokensPath)) {
        fail(`Missing file: ${tokensPath}`);
        return;
    }
    if (!fs.existsSync(assetsPath)) {
        fail(`Missing file: ${assetsPath}`);
        return;
    }

    const catalog = readJson(catalogPath);
    const tokens = readJson(tokensPath);
    const assets = readJson(assetsPath);

    validateCatalog(catalog, assets);
    validateTokens(tokens);
    validateAssets(assets);

    if (process.exitCode && process.exitCode !== 0) {
        return;
    }
    console.log('[public-v5] catalog/tokens/assets contract OK.');
}

run();
