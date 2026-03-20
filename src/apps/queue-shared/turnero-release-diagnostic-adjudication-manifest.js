import { asObject, toText } from './turnero-release-control-center.js';

const DEFAULT_ITEMS = Object.freeze([
    {
        key: 'mainline-evidence',
        label: 'Mainline Evidence',
        owner: 'program',
        criticality: 'critical',
    },
    {
        key: 'runtime-alignment',
        label: 'Runtime Alignment',
        owner: 'infra',
        criticality: 'critical',
    },
    {
        key: 'surface-readiness',
        label: 'Surface Readiness',
        owner: 'ops',
        criticality: 'high',
    },
    {
        key: 'integration-trust',
        label: 'Integration Trust',
        owner: 'infra',
        criticality: 'critical',
    },
    {
        key: 'closure-completeness',
        label: 'Closure Completeness',
        owner: 'program',
        criticality: 'critical',
    },
    {
        key: 'human-review',
        label: 'Human Review',
        owner: 'program',
        criticality: 'critical',
    },
]);

function normalizeCriticality(value, fallback = 'high') {
    const normalized = toText(value, fallback).toLowerCase();
    if (['critical', 'high', 'medium', 'low'].includes(normalized)) {
        return normalized;
    }

    return fallback;
}

function normalizeItem(item, index) {
    const entry = asObject(item);
    const key = toText(entry.key || entry.id, `adj-item-${index + 1}`);

    return {
        id: toText(entry.id, key),
        key,
        label: toText(entry.label, `Adjudication Item ${index + 1}`),
        owner: toText(entry.owner, 'program'),
        criticality: normalizeCriticality(entry.criticality, 'high'),
    };
}

function collectItems(value) {
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

export function buildTurneroReleaseDiagnosticAdjudicationManifest(input = {}) {
    const hasExplicitItems = Array.isArray(input.items);
    const candidateItems = hasExplicitItems
        ? input.items
        : collectItems(input.items);
    const rows = (
        hasExplicitItems || candidateItems.length > 0
            ? candidateItems
            : DEFAULT_ITEMS
    ).map(normalizeItem);

    return {
        rows,
        summary: {
            all: rows.length,
            critical: rows.filter((row) => row.criticality === 'critical')
                .length,
            high: rows.filter((row) => row.criticality === 'high').length,
            medium: rows.filter((row) => row.criticality === 'medium').length,
            low: rows.filter((row) => row.criticality === 'low').length,
        },
        generatedAt: new Date().toISOString(),
    };
}

export default buildTurneroReleaseDiagnosticAdjudicationManifest;
