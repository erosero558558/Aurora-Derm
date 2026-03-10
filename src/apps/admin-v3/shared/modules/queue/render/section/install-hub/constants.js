export const DEFAULT_APP_DOWNLOADS = Object.freeze({
    operator: {
        version: '0.1.0',
        updatedAt: '2026-03-10T00:00:00Z',
        webFallbackUrl: '/operador-turnos.html',
        targets: {
            win: {
                url: '/app-downloads/stable/operator/win/TurneroOperadorSetup.exe',
                label: 'Windows',
            },
            mac: {
                url: '/app-downloads/stable/operator/mac/TurneroOperador.dmg',
                label: 'macOS',
            },
        },
    },
    kiosk: {
        version: '0.1.0',
        updatedAt: '2026-03-10T00:00:00Z',
        webFallbackUrl: '/kiosco-turnos.html',
        targets: {
            win: {
                url: '/app-downloads/stable/kiosk/win/TurneroKioscoSetup.exe',
                label: 'Windows',
            },
            mac: {
                url: '/app-downloads/stable/kiosk/mac/TurneroKiosco.dmg',
                label: 'macOS',
            },
        },
    },
    sala_tv: {
        version: '0.1.0',
        updatedAt: '2026-03-10T00:00:00Z',
        webFallbackUrl: '/sala-turnos.html',
        targets: {
            android_tv: {
                url: '/app-downloads/stable/sala-tv/android/TurneroSalaTV.apk',
                label: 'Android TV APK',
            },
        },
    },
});

export const APP_COPY = Object.freeze({
    operator: {
        eyebrow: 'Recepción + consultorio',
        title: 'Operador',
        description:
            'Superficie diaria para llamar, re-llamar, completar y operar con el Genius Numpad 1000.',
        recommendedFor: 'PC operador',
        notes: [
            'Conecta aquí el receptor USB 2.4 GHz del numpad.',
            'Usa station=c1|c2, lock=1 y one_tap si el equipo queda fijo por consultorio.',
        ],
    },
    kiosk: {
        eyebrow: 'Recepción de pacientes',
        title: 'Kiosco',
        description:
            'Instalador dedicado para check-in, generación de ticket y operación simple en mostrador.',
        recommendedFor: 'PC o mini PC de kiosco',
        notes: [
            'Mantén el equipo en fullscreen y con impresora térmica conectada.',
            'La versión web sigue disponible como respaldo inmediato.',
        ],
    },
    sala_tv: {
        eyebrow: 'Pantalla de sala',
        title: 'Sala TV',
        description:
            'APK para Android TV en la TCL C655 con WebView controlado, reconexión y campanilla.',
        recommendedFor: 'TCL C655 / Google TV',
        notes: [
            'Instala en la TV y prioriza Ethernet sobre Wi-Fi.',
            'Usa el QR desde otra pantalla para simplificar la instalación del APK.',
        ],
    },
});
