/**
 * Feature flags client — reads from /api.php?action=features.
 * Fetches once and caches. Falls back to all-false on error.
 */

let _cache = null;
let _promise = null;

export async function loadFeatureFlags() {
    if (_cache !== null) return _cache;
    if (_promise) return _promise;

    _promise = fetch('/api.php?action=features', {
        method: 'GET',
        headers: { 'Cache-Control': 'no-cache' },
    })
        .then((r) => (r.ok ? r.json() : null))
        .then((json) => {
            _cache = json && json.ok && json.data ? json.data : {};
            return _cache;
        })
        .catch(() => {
            _cache = {};
            return _cache;
        });

    return _promise;
}

export function isFeatureEnabled(flag) {
    return _cache ? Boolean(_cache[flag]) : false;
}
