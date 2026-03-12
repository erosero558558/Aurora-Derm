import {
    getInstallHubFallbackSnapshot,
    getInstallHubSurfaceOrder,
} from './registry.js';

const fallbackSnapshot = getInstallHubFallbackSnapshot();

export const DEFAULT_APP_DOWNLOADS = Object.freeze(
    fallbackSnapshot.appDownloads
);
export const APP_COPY = Object.freeze(
    Object.fromEntries(
        fallbackSnapshot.surfaceOrder.map((surfaceId) => [
            surfaceId,
            fallbackSnapshot.surfaces[surfaceId]?.cardCopy || {
                eyebrow: surfaceId,
                title: surfaceId,
                description: '',
                recommendedFor: 'Equipo dedicado',
                notes: [],
            },
        ])
    )
);
export const SURFACE_TELEMETRY_COPY = Object.freeze(
    Object.fromEntries(
        fallbackSnapshot.surfaceOrder
            .map((surfaceId) => fallbackSnapshot.surfaces[surfaceId] || null)
            .filter(Boolean)
            .map((surface) => [surface.telemetryKey, surface.telemetryCopy])
    )
);
export const INSTALL_HUB_SURFACE_ORDER = Object.freeze(
    getInstallHubSurfaceOrder()
);
export const QUEUE_OPENING_CHECKLIST_STORAGE_KEY = 'queueOpeningChecklistV1';
export const OPENING_CHECKLIST_STEP_IDS = Object.freeze([
    'operator_ready',
    'kiosk_ready',
    'sala_ready',
    'smoke_ready',
]);
