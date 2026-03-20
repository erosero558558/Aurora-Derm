import { asObject, toText } from './turnero-release-control-center.js';

const DEFAULT_BUNDLES = Object.freeze([
    {
        key: 'mainline-evidence',
        label: 'Mainline Evidence',
        owner: 'program',
        status: 'ready',
        artifactCount: 4,
    },
    {
        key: 'runtime-alignment',
        label: 'Runtime Alignment',
        owner: 'infra',
        status: 'pending',
        artifactCount: 2,
    },
    {
        key: 'surface-readiness',
        label: 'Surface Readiness',
        owner: 'ops',
        status: 'ready',
        artifactCount: 3,
    },
    {
        key: 'closure-completeness',
        label: 'Closure Completeness',
        owner: 'program',
        status: 'ready',
        artifactCount: 2,
    },
]);

function normalizeStatus(value, fallback = 'ready') {
    const normalized = toText(value, fallback).toLowerCase();
    if (
        [
            'ready',
            'pending',
            'blocked',
            'review',
            'partial',
            'missing',
        ].includes(normalized)
    ) {
        return normalized;
    }

    if (['pass', 'ok', 'active', 'available'].includes(normalized)) {
        return 'ready';
    }

    if (['hold', 'fail', 'error', 'off'].includes(normalized)) {
        return 'blocked';
    }

    return fallback;
}

function normalizeBundle(bundle, index) {
    const entry = asObject(bundle);
    const key = toText(entry.key || entry.id, `bundle-${index + 1}`);

    return {
        id: toText(entry.id, key),
        key,
        label: toText(entry.label, `Evidence Bundle ${index + 1}`),
        owner: toText(entry.owner, 'program'),
        status: normalizeStatus(entry.status, 'ready'),
        artifactCount: Number(
            entry.artifactCount || entry.artifacts || entry.evidenceCount || 0
        ),
    };
}

function collectBundles(value) {
    if (Array.isArray(value)) {
        return value.filter(Boolean);
    }

    if (value && typeof value === 'object') {
        return Object.entries(value)
            .filter(([, entry]) => Boolean(entry))
            .map(([key, entry]) => ({
                key,
                ...asObject(entry),
            }));
    }

    return [];
}

export function buildTurneroReleaseEvidenceBundleRegistry(input = {}) {
    const hasExplicitBundles = Array.isArray(input.bundles);
    const candidateBundles = hasExplicitBundles
        ? input.bundles
        : collectBundles(input.bundles);
    const rows = (
        hasExplicitBundles || candidateBundles.length > 0
            ? candidateBundles
            : DEFAULT_BUNDLES
    ).map(normalizeBundle);

    return {
        rows,
        summary: {
            all: rows.length,
            ready: rows.filter((row) => row.status === 'ready').length,
            pending: rows.filter((row) => row.status !== 'ready').length,
        },
        generatedAt: new Date().toISOString(),
    };
}

export default buildTurneroReleaseEvidenceBundleRegistry;
