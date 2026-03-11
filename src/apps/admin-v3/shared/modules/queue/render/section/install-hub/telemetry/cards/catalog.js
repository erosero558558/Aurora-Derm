import {
    DEFAULT_APP_DOWNLOADS,
    SURFACE_TELEMETRY_COPY,
} from '../../constants.js';

export function getSurfaceTelemetryCatalog(manifest) {
    return [
        {
            key: 'operator',
            title: SURFACE_TELEMETRY_COPY.operator?.title || 'operator',
            appConfig: manifest.operator || DEFAULT_APP_DOWNLOADS.operator,
            fallbackSurface: 'operator',
            actionLabel: 'Abrir operador',
        },
        {
            key: 'kiosk',
            title: SURFACE_TELEMETRY_COPY.kiosk?.title || 'kiosk',
            appConfig: manifest.kiosk || DEFAULT_APP_DOWNLOADS.kiosk,
            fallbackSurface: 'kiosk',
            actionLabel: 'Abrir kiosco',
        },
        {
            key: 'display',
            title: SURFACE_TELEMETRY_COPY.display?.title || 'display',
            appConfig: manifest.sala_tv || DEFAULT_APP_DOWNLOADS.sala_tv,
            fallbackSurface: 'sala_tv',
            actionLabel: 'Abrir sala TV',
        },
    ];
}
