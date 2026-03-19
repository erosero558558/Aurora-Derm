import {
    normalizeOwner,
    toArray,
    toText,
} from './turnero-release-control-center.js';

const STORAGE_PREFIX = 'turneroReleaseIncidentJournalV1';
const MAX_JOURNAL_ENTRIES = 30;

function getStorage() {
    try {
        return typeof localStorage !== 'undefined' ? localStorage : null;
    } catch (_error) {
        return null;
    }
}

function normalizeClinicId(value) {
    return String(value || 'default-clinic').trim() || 'default-clinic';
}

function toStorageKey(clinicId) {
    return `${STORAGE_PREFIX}:${normalizeClinicId(clinicId)}`;
}

function asObject(value) {
    return value && typeof value === 'object' ? value : {};
}

function normalizeSeverity(value, fallback = 'info') {
    const severity = toText(value, fallback).toLowerCase();

    if (
        ['alert', 'blocked', 'blocker', 'error', 'critical'].includes(severity)
    ) {
        return 'blocker';
    }

    if (['warning', 'watch', 'pending', 'pending_review'].includes(severity)) {
        return 'warning';
    }

    if (['ready', 'done', 'success', 'clear', 'ok'].includes(severity)) {
        return 'info';
    }

    return fallback === 'warning' ? 'warning' : 'info';
}

function escapeMd(value) {
    return String(value ?? '')
        .replace(/\\/g, '\\\\')
        .replace(/`/g, '\\`')
        .replace(/\r?\n/g, ' ')
        .trim();
}

function uniqueStrings(values) {
    return Array.from(
        new Set(
            toArray(values)
                .map((item) => toText(item))
                .filter(Boolean)
        )
    );
}

function normalizeJournalEntry(input = {}, source = 'journal', index = 0) {
    const item = asObject(input);
    const title = toText(
        item.title ||
            item.label ||
            item.name ||
            item.id ||
            `${source} ${index + 1}`
    );
    const detail = toText(
        item.detail ||
            item.summary ||
            item.reason ||
            item.note ||
            item.description ||
            title
    );
    const owner = normalizeOwner(
        item.owner || item.recommendedOwner || item.assignee || item.lane
    );
    const severity = normalizeSeverity(
        item.severity || item.state || item.tone || item.status
    );
    const recommendedCommands = uniqueStrings(
        item.recommendedCommands || item.commands || item.actions
    );
    const recommendedDocs = uniqueStrings(
        item.recommendedDocs || item.docs || item.references
    );
    const topIncidentTitles = uniqueStrings(
        item.topIncidentTitles || item.top_titles || item.topTitles || [title]
    );

    return {
        id: toText(item.id, `${source}-${owner}-${index + 1}`),
        owner,
        title,
        detail,
        summary: toText(item.summary || detail || title),
        severity,
        source: toText(item.source || source, source),
        state: toText(item.state || severity, severity),
        note: toText(item.note || ''),
        why: toText(item.why || item.reason || item.rationale || detail),
        nextCheck: toText(item.nextCheck || item.followUp || ''),
        recommendedCommands,
        recommendedDocs,
        evidence: asObject(item.evidence || item.meta || {}),
        topIncidentTitles,
        updatedAt: toText(
            item.updatedAt || item.createdAt || new Date().toISOString()
        ),
    };
}

function normalizeJournalEntries(value, source = 'journal') {
    if (Array.isArray(value)) {
        return value
            .map((entry, index) => normalizeJournalEntry(entry, source, index))
            .filter((entry) => Boolean(entry.title));
    }

    if (value && typeof value === 'object') {
        const objectValue = asObject(value);
        const preferredArrays = [
            objectValue.items,
            objectValue.incidents,
            objectValue.entries,
            objectValue.journal,
            objectValue.records,
            objectValue.notes,
            objectValue.signals,
            objectValue.blockers,
        ].filter(Array.isArray);

        if (preferredArrays.length > 0) {
            return preferredArrays
                .flatMap((entry) => normalizeJournalEntries(entry, source))
                .filter((entry, index, list) => {
                    const key = `${entry.owner}:${entry.title}:${entry.severity}:${entry.source}`;
                    return (
                        list.findIndex(
                            (candidate) =>
                                `${candidate.owner}:${candidate.title}:${candidate.severity}:${candidate.source}` ===
                                key
                        ) === index
                    );
                });
        }

        if (
            objectValue.title ||
            objectValue.label ||
            objectValue.summary ||
            objectValue.detail ||
            objectValue.reason ||
            objectValue.id
        ) {
            return [normalizeJournalEntry(objectValue, source, 0)];
        }
    }

    return [];
}

function makeJournalKey(entry) {
    return [
        entry.owner,
        entry.title,
        entry.detail,
        entry.severity,
        entry.source,
        entry.state,
    ]
        .map((part) => toText(part).toLowerCase())
        .join('|');
}

function mergeJournalEntries(entries) {
    const map = new Map();

    toArray(entries)
        .flatMap((entry) => normalizeJournalEntries(entry, 'journal'))
        .forEach((entry) => {
            map.set(makeJournalKey(entry), entry);
        });

    return Array.from(map.values())
        .sort((left, right) =>
            String(right.updatedAt || '').localeCompare(
                String(left.updatedAt || '')
            )
        )
        .slice(0, MAX_JOURNAL_ENTRIES);
}

export function readTurneroIncidentJournal(clinicId) {
    const storage = getStorage();
    if (!storage) {
        return [];
    }

    try {
        const raw = storage.getItem(toStorageKey(clinicId));
        return mergeJournalEntries(raw ? JSON.parse(raw) : []);
    } catch (_error) {
        return [];
    }
}

export function writeTurneroIncidentJournal(clinicId, entries) {
    const storage = getStorage();
    const normalized = mergeJournalEntries(entries);

    if (!storage) {
        return normalized;
    }

    try {
        storage.setItem(toStorageKey(clinicId), JSON.stringify(normalized));
    } catch (_error) {
        return normalized;
    }

    return normalized;
}

export function appendTurneroIncidentJournalEntry(clinicId, entry) {
    return appendTurneroIncidentJournalEntries(clinicId, [entry]);
}

export function appendTurneroIncidentJournalEntries(clinicId, entries) {
    const current = readTurneroIncidentJournal(clinicId);
    const nextEntries = Array.isArray(entries)
        ? entries
        : entries
          ? [entries]
          : [];
    return writeTurneroIncidentJournal(clinicId, [...current, ...nextEntries]);
}

export function clearTurneroIncidentJournal(clinicId) {
    const storage = getStorage();
    if (!storage) {
        return false;
    }

    try {
        storage.removeItem(toStorageKey(clinicId));
        return true;
    } catch (_error) {
        return false;
    }
}

function resolveJournalEntries(input, maybeEntries) {
    if (Array.isArray(input)) {
        return mergeJournalEntries(input);
    }

    if (Array.isArray(maybeEntries)) {
        return mergeJournalEntries(maybeEntries);
    }

    if (input && typeof input === 'object') {
        const objectValue = asObject(input);
        const preferredArrays = [
            objectValue.entries,
            objectValue.journal,
            objectValue.records,
            objectValue.items,
            objectValue.signals,
            objectValue.incidents,
            objectValue.blockers,
            objectValue.notes,
        ].filter(Array.isArray);

        if (preferredArrays.length > 0) {
            return mergeJournalEntries(preferredArrays.flat());
        }

        if (objectValue.clinicId || objectValue.clinic_id) {
            return readTurneroIncidentJournal(
                objectValue.clinicId || objectValue.clinic_id
            );
        }
    }

    if (typeof input === 'string' && input.trim()) {
        return readTurneroIncidentJournal(input);
    }

    return [];
}

export function buildTurneroIncidentJournalStats(input = [], maybeEntries) {
    const entries = resolveJournalEntries(input, maybeEntries);
    const totals = entries.reduce(
        (acc, entry) => {
            acc.total += 1;
            if (entry.severity === 'blocker') {
                acc.blocker += 1;
            } else if (entry.severity === 'warning') {
                acc.warning += 1;
            } else {
                acc.info += 1;
            }

            if (!acc.latestUpdatedAt && entry.updatedAt) {
                acc.latestUpdatedAt = String(entry.updatedAt);
            }

            const ownerKey = normalizeOwner(entry.owner);
            acc.owners[ownerKey] = (acc.owners[ownerKey] || 0) + 1;
            return acc;
        },
        {
            total: 0,
            blocker: 0,
            warning: 0,
            info: 0,
            owners: {},
            latestUpdatedAt: '',
        }
    );

    const highlights = entries
        .slice()
        .sort((left, right) => {
            const severityWeight = (entry) =>
                entry.severity === 'blocker'
                    ? 0
                    : entry.severity === 'warning'
                      ? 1
                      : 2;
            return (
                severityWeight(left) - severityWeight(right) ||
                String(right.updatedAt || '').localeCompare(
                    String(left.updatedAt || '')
                )
            );
        })
        .slice(0, 5);

    return {
        clinicId:
            typeof input === 'string'
                ? normalizeClinicId(input)
                : toText(asObject(input).clinicId || asObject(input).clinic_id),
        ...totals,
        highlights,
        highlightedTitles: highlights.map((entry) => entry.title),
    };
}

export function buildTurneroIncidentJournalMarkdown(input = [], maybeEntries) {
    const entries = resolveJournalEntries(input, maybeEntries);
    const stats = buildTurneroIncidentJournalStats(entries);
    const clinicLabel =
        typeof input === 'string'
            ? normalizeClinicId(input)
            : toText(
                  asObject(input).clinicId || asObject(input).clinic_id,
                  'default-clinic'
              );
    const highlightLines = stats.highlights.length
        ? stats.highlights.map(
              (entry) =>
                  `- [${escapeMd(entry.severity)}] ${escapeMd(entry.title)} — ${escapeMd(
                      entry.detail || entry.summary || ''
                  )} (${escapeMd(entry.owner || 'unknown')})`
          )
        : ['- Sin incidentes destacados.'];
    const recentLines = entries.length
        ? entries.slice(0, 10).map((entry) => {
              const timestamp = escapeMd(entry.updatedAt || '');
              const owner = escapeMd(entry.owner || 'unknown');
              const detail = escapeMd(entry.detail || entry.summary || '');
              return `- ${timestamp} [${owner}] ${escapeMd(entry.title)} — ${detail}`;
          })
        : ['- Sin entradas registradas.'];

    return [
        '# Turnero Incident Journal',
        '',
        `- Clinic: ${escapeMd(clinicLabel)}`,
        `- Total entries: ${stats.total}`,
        `- Blockers: ${stats.blocker}`,
        `- Warnings: ${stats.warning}`,
        `- Info: ${stats.info}`,
        `- Owners: ${Object.keys(stats.owners).length || 0}`,
        stats.latestUpdatedAt
            ? `- Last updated: ${escapeMd(stats.latestUpdatedAt)}`
            : '',
        '',
        '## Highlights',
        ...highlightLines,
        '',
        '## Recent entries',
        ...recentLines,
    ]
        .filter(Boolean)
        .join('\n');
}
