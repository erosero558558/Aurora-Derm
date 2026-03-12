# Turnero Sala TV Android

App nativa para Android TV pensada para la `TCL C655` con Google TV. La app abre `sala-turnos.html` en un `WebView` controlado, mantiene la pantalla activa y reintenta conexión de forma automática.

## Objetivo

- Evitar depender del navegador general de la TV.
- Mantener un tile visible en el home de Google TV.
- Simplificar reinstalación y relanzamiento desde una sola APK.

## Requisitos

- Android Studio o Gradle con Android SDK
- JDK 17
- TV Android / Google TV con instalación por `adb` o APK local

## Build

```bash
cd src/apps/turnero-sala-tv-android
./gradlew assembleDebug
```

En Windows usa:

```powershell
cd src/apps/turnero-sala-tv-android
.\gradlew.bat assembleDebug
```

APK esperada:

- `app/build/outputs/apk/debug/app-debug.apk`

Para release real:

1. Configura firma de Android.
2. Genera `assembleRelease`.
3. Renombra la APK final como `TurneroSalaTV.apk`.
4. Publica la APK bajo `/app-downloads/stable/sala-tv/android/`.

Ejemplo portable de release con propiedades inyectadas:

```bash
./gradlew assembleRelease -PturneroVersionName=0.1.0 -PturneroVersionCode=100 -PturneroBaseUrl=https://pielarmonia.com -PturneroSurfacePath=/sala-turnos.html
```

En Windows:

```powershell
.\gradlew.bat assembleRelease -PturneroVersionName=0.1.0 -PturneroVersionCode=100 -PturneroBaseUrl=https://pielarmonia.com -PturneroSurfacePath=/sala-turnos.html
```

Tambien puedes usar el workflow central:

- [.github/workflows/release-turnero-apps.yml](../../../.github/workflows/release-turnero-apps.yml)
- [docs/RUNBOOK_TURNERO_APPS_RELEASE.md](../../../docs/RUNBOOK_TURNERO_APPS_RELEASE.md)
- [docs/TURNERO_NATIVE_SURFACES.md](../../../docs/TURNERO_NATIVE_SURFACES.md)

Gate recomendado desde la raiz del repo:

```bash
npm run gate:turnero
```

## Instalación en TCL C655

1. Conecta la TV preferiblemente por `Ethernet`.
2. Habilita modo desarrollador si vas a usar `adb`.
3. Instala la APK:

```bash
adb install -r app/build/outputs/apk/debug/app-debug.apk
```

4. Abre `Turnero Sala TV` desde el home de Google TV.
5. Verifica:
    - conexión al panel de sala
    - campanilla/audio
    - recuperación tras corte de red

## Configuración

La URL base vive en [TurneroConfig.kt](app/src/main/java/com/pielarmonia/turnerosalatv/TurneroConfig.kt).

- `BASE_URL`
- `SURFACE_PATH`
- `RECONNECT_DELAY_MS`

La version de release ahora puede inyectarse con Gradle:

- `-PturneroVersionName=0.1.0`
- `-PturneroVersionCode=100`
- `-PturneroBaseUrl=https://pielarmonia.com`
- `-PturneroSurfacePath=/sala-turnos.html`

## Notas operativas

- La app restringe navegación fuera de `sala-turnos.html`.
- Mantiene la pantalla activa.
- Si la red cae, deja visible un estado offline y reintenta sola.
- En esta primera versión no usa `device owner` ni lock-task enterprise.
