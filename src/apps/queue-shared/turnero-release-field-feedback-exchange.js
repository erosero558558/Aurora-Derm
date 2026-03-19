const STORAGE_KEY = 'turnero-release-field-feedback-exchange:v1';

function readAll() {
    try {
        return JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
    } catch (_error) {
        return {};
    }
}

function writeAll(data) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

export function createTurneroReleaseFieldFeedbackExchange(scope = 'global') {
    return {
        list() {
            const data = readAll();
            return Array.isArray(data[scope]) ? data[scope] : [];
        },
        add(entry = {}) {
            const data = readAll();
            const rows = Array.isArray(data[scope]) ? data[scope] : [];
            const next = {
                id: entry.id || `feedback-${Date.now()}`,
                clinicId: entry.clinicId || 'regional',
                owner: entry.owner || 'field',
                channel: entry.channel || 'onsite',
                sentiment: entry.sentiment || 'neutral',
                note: entry.note || '',
                at: entry.at || new Date().toISOString(),
            };
            data[scope] = [next, ...rows].slice(0, 300);
            writeAll(data);
            return next;
        },
        clear() {
            const data = readAll();
            delete data[scope];
            writeAll(data);
        },
    };
}
