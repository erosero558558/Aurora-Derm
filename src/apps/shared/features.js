import { API_ENDPOINT } from '../../../js/config.js';
import { debugLog } from './utils.js';

let featureFlags = {};
let initialized = false;

const CACHE_KEY = 'piel_features_v1';
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

export async function fetchFeatureFlags() {
    try {
        // Check cache first
        const cached = sessionStorage.getItem(CACHE_KEY);
        if (cached) {
            const parsed = JSON.parse(cached);
            if (Date.now() - parsed.timestamp < CACHE_TTL) {
                featureFlags = parsed.data;
                initialized = true;
                return featureFlags;
            }
        }

        const response = await fetch(`${API_ENDPOINT}?resource=features`);
        if (!response.ok) throw new Error('Failed to fetch features');

        const json = await response.json();
        if (json.ok && json.data) {
            featureFlags = json.data;
            initialized = true;

            // Cache it
            try {
                sessionStorage.setItem(CACHE_KEY, JSON.stringify({
                    timestamp: Date.now(),
                    data: featureFlags
                }));
            } catch (e) {
                // Ignore storage errors
            }
            return featureFlags;
        }
    } catch (error) {
        debugLog('Feature flags fetch error:', error);
    }
    return {};
}

export function isFeatureEnabled(flag) {
    if (!initialized && Object.keys(featureFlags).length === 0) {
        // If not initialized, try to load from cache synchronously if possible?
        // No, fetch is async.
        // We can try to load from sessionStorage here for immediate access.
        try {
            const cached = sessionStorage.getItem(CACHE_KEY);
            if (cached) {
                const parsed = JSON.parse(cached);
                featureFlags = parsed.data;
                initialized = true;
            }
        } catch (e) {}
    }

    return !!featureFlags[flag];
}

export function initFeatureFlags() {
    // Fire and forget, or return promise
    return fetchFeatureFlags();
}
