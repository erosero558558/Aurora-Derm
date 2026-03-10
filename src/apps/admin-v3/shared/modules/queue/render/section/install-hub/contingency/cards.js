import { DEFAULT_APP_DOWNLOADS } from '../constants.js';
import { buildGuideUrl, buildPreparedSurfaceUrl } from '../manifest.js';
import { ensureInstallPreset } from '../state.js';
import { getQueueSyncHealth } from '../telemetry.js';

export function buildContingencyCards(manifest, detectedPlatform) {
    const preset = ensureInstallPreset(detectedPlatform);
    const operatorConfig = manifest.operator || DEFAULT_APP_DOWNLOADS.operator;
    const kioskConfig = manifest.kiosk || DEFAULT_APP_DOWNLOADS.kiosk;
    const salaConfig = manifest.sala_tv || DEFAULT_APP_DOWNLOADS.sala_tv;
    const syncHealth = getQueueSyncHealth();
    const stationLabel = preset.station === 'c2' ? 'C2' : 'C1';
    const operatorModeLabel = preset.lock
        ? `${stationLabel} fijo`
        : 'modo libre';
    const operatorUrl = buildPreparedSurfaceUrl('operator', operatorConfig, {
        ...preset,
        surface: 'operator',
    });
    const kioskUrl = buildPreparedSurfaceUrl('kiosk', kioskConfig, {
        ...preset,
        surface: 'kiosk',
    });
    const salaUrl = buildPreparedSurfaceUrl('sala_tv', salaConfig, {
        ...preset,
        surface: 'sala_tv',
    });

    return {
        syncHealth,
        cards: [
            {
                id: 'operator_issue',
                state: 'neutral',
                badge: 'Numpad',
                title: 'Numpad no responde',
                summary: `Abre Operador en ${operatorModeLabel}${preset.oneTap ? ' con 1 tecla' : ''}, recalibra la tecla externa y confirma Enter, Decimal y Subtract del Genius Numpad 1000.`,
                steps: [
                    'Confirma que el receptor USB 2.4 GHz siga conectado en el PC operador.',
                    'Dentro de Operador usa "Calibrar tecla" si el Enter del numpad no dispara llamada.',
                    'Mientras corriges el teclado, puedes seguir operando por clics sin cambiar de equipo.',
                ],
                actions: [
                    {
                        type: 'link',
                        href: operatorUrl,
                        label: 'Abrir operador',
                        primary: true,
                    },
                    { type: 'copy', url: operatorUrl, label: 'Copiar ruta' },
                    {
                        type: 'link',
                        href: buildGuideUrl('operator', preset, operatorConfig),
                        label: 'Centro de instalación',
                        external: true,
                    },
                ],
            },
            {
                id: 'kiosk_issue',
                state: 'neutral',
                badge: 'Térmica',
                title: 'Térmica no imprime',
                summary:
                    'Abre Kiosco, genera un ticket de prueba y confirma "Impresion OK" antes de volver al autoservicio.',
                steps: [
                    'Revisa papel, energía y cable USB de la impresora térmica.',
                    'Si el equipo sigue estable, usa el kiosco web preparado mientras validas la app desktop.',
                    'No cierres el flujo de check-in hasta imprimir al menos un ticket de prueba correcto.',
                ],
                actions: [
                    {
                        type: 'link',
                        href: kioskUrl,
                        label: 'Abrir kiosco',
                        primary: true,
                    },
                    { type: 'copy', url: kioskUrl, label: 'Copiar ruta' },
                    {
                        type: 'link',
                        href: buildGuideUrl('kiosk', preset, kioskConfig),
                        label: 'Centro de instalación',
                        external: true,
                    },
                ],
            },
            {
                id: 'sala_issue',
                state: 'neutral',
                badge: 'Audio',
                title: 'Sala TV sin campanilla',
                summary:
                    'Abre la Sala TV, ejecuta la prueba de campanilla y deja la TCL C655 con volumen fijo y Ethernet activo.',
                steps: [
                    'Confirma que la TV no esté en mute y que la app siga en foreground.',
                    'Si la APK falla, usa `sala-turnos.html` como respaldo inmediato en el navegador de la TV.',
                    'Solo reinstala la APK si ya probaste campanilla, red y energía de la pantalla.',
                ],
                actions: [
                    {
                        type: 'link',
                        href: salaUrl,
                        label: 'Abrir sala TV',
                        primary: true,
                    },
                    {
                        type: 'link',
                        href: buildGuideUrl('sala_tv', preset, salaConfig),
                        label: 'Instalar APK',
                        external: true,
                    },
                    {
                        type: 'copy',
                        url: salaUrl,
                        label: 'Copiar fallback web',
                    },
                ],
            },
            {
                id: 'sync_issue',
                state: syncHealth.state,
                badge: syncHealth.badge,
                title: syncHealth.title,
                summary: syncHealth.summary,
                steps: syncHealth.steps,
                actions: [
                    {
                        type: 'button',
                        action: 'queue-refresh-state',
                        label: 'Refrescar cola',
                        primary: syncHealth.state !== 'ready',
                    },
                    {
                        type: 'link',
                        href: operatorUrl,
                        label: 'Abrir operador web',
                    },
                    { type: 'copy', url: kioskUrl, label: 'Copiar kiosco web' },
                ],
            },
        ],
    };
}
