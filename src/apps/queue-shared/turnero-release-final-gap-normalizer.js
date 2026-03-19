import { asObject, toArray, toText } from './turnero-release-control-center.js';

const SEVERITY_RANK = Object.freeze({
    high: 0,
    medium: 1,
    low: 2,
});

function normalizeRows(value, fallbackPrefix = 'row') {
    if (Array.isArray(value)) {
        return value.filter(Boolean).map((item, index) => {
            const row = asObject(item);
            const fallbackId = `${fallbackPrefix}-${index + 1}`;
            const id = toText(row.id || row.key, fallbackId);

            return {
                ...row,
                id,
                key: toText(row.key, id),
            };
        });
    }

    if (value && typeof value === 'object') {
        return Object.entries(value)
            .filter(([, entry]) => Boolean(entry))
            .map(([key, entry], index) => {
                const row = asObject(entry);
                const fallbackId = `${fallbackPrefix}-${index + 1}`;
                const id = toText(row.id || row.key || key, fallbackId);

                return {
                    ...row,
                    id,
                    key: toText(row.key, id),
                };
            });
    }

    return [];
}

function normalizeSeverity(value, fallback = 'medium') {
    const severity = toText(value, fallback).trim().toLowerCase();
    if (['critical', 'high', 'alert', 'blocked', 'error'].includes(severity)) {
        return 'high';
    }
    if (['medium', 'warning', 'watch', 'review'].includes(severity)) {
        return 'medium';
    }
    return 'low';
}

function dedupeRows(rows) {
    const dedupe = new Map();
    rows.forEach((row) => {
        const key = `${row.title}::${row.domain}::${row.surface}`;
        if (!dedupe.has(key)) {
            dedupe.set(key, row);
        }
    });

    return [...dedupe.values()];
}

export function buildTurneroReleaseFinalGapNormalizer(input = {}) {
    const gaps = normalizeRows(input.gaps, 'gap');
    const wiringRows = normalizeRows(input.wiringRows, 'wiring');
    const convergenceRows = normalizeRows(input.convergenceRows, 'convergence');

    const inferredGaps = [
        ...wiringRows
            .filter((row) => row.state !== 'pass')
            .map((row, index) => ({
                id: `wiring-gap-${index + 1}`,
                title: `Wiring gap: ${row.label}`,
                domain: row.domain,
                owner: row.owner,
                surface:
                    row.coverage?.find((item) => !item.present)?.surfaceId ||
                    'admin',
                severity: row.state === 'missing' ? 'high' : 'medium',
                status: 'open',
                source: 'wiring-audit',
            })),
        ...convergenceRows
            .filter((row) => row.state !== 'converged')
            .map((row, index) => ({
                id: `convergence-gap-${index + 1}`,
                title: `Convergence gap: ${row.label}`,
                domain: row.domain,
                owner: row.owner,
                surface: 'admin',
                severity: row.state === 'fragmented' ? 'high' : 'medium',
                status: 'open',
                source: 'convergence-audit',
            })),
    ];

    const rows = dedupeRows(
        [...gaps, ...inferredGaps].map((gap, index) => {
            const item = asObject(gap);
            return {
                id: toText(item.id, `final-gap-${index + 1}`),
                title: toText(item.title, `Gap ${index + 1}`),
                domain: toText(item.domain, 'general'),
                owner: toText(item.owner, 'ops'),
                surface: toText(item.surface, 'admin'),
                severity: normalizeSeverity(item.severity || item.priority),
                status: toText(item.status, 'open'),
                source: toText(item.source, 'manual'),
                note: toText(item.note, ''),
            };
        })
    ).sort((a, b) => {
        const severityDelta =
            (SEVERITY_RANK[a.severity] ?? 2) - (SEVERITY_RANK[b.severity] ?? 2);
        if (severityDelta !== 0) {
            return severityDelta;
        }

        return a.title.localeCompare(b.title, 'en');
    });

    return {
        rows,
        summary: {
            all: rows.length,
            high: rows.filter(
                (row) => row.severity === 'high' && row.status !== 'closed'
            ).length,
            open: rows.filter((row) => row.status !== 'closed').length,
            closed: rows.filter((row) => row.status === 'closed').length,
        },
        generatedAt: new Date().toISOString(),
    };
}

export default buildTurneroReleaseFinalGapNormalizer;
