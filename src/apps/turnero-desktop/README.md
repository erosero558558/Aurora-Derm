# Turnero Desktop

Shells de escritorio para separar el uso operativo del turnero sin duplicar el backend PHP actual.

## Superficies

- `Turnero Operador` carga `https://pielarmonia.com/operador-turnos.html`
- `Turnero Kiosco` carga `https://pielarmonia.com/kiosco-turnos.html`

Ambas aplicaciones se conectan al mismo backend central por `api.php`.
En `Turnero Operador`, el shell agrega `station`, `lock` y `one_tap` al abrir la superficie para que cada equipo quede provisionado desde la propia app.

## Requisitos

- Node.js 20+
- npm 10+

## Instalacion local

```bash
cd src/apps/turnero-desktop
npm install
```

Desde la raiz del repo tambien puedes usar comandos portables sin cambiar de carpeta:

```bash
npm --prefix src/apps/turnero-desktop install
npm --prefix src/apps/turnero-desktop run dev:operator
npm --prefix src/apps/turnero-desktop run build:operator:win
```

## Desarrollo

```bash
npm run dev:surface -- --surface operator
npm run dev:operator
npm run dev:kiosk
```

Overrides utiles:

```bash
TURNERO_BASE_URL=http://localhost:8000 npm run dev:operator
TURNERO_LAUNCH_MODE=windowed npm run dev:kiosk
```

Las variables `TURNERO_*` tienen prioridad sobre `package.json`, para poder probar `operator` y `kiosk` desde la misma base sin duplicar proyecto.

## Builds

```bash
npm --prefix src/apps/turnero-desktop install
npm run build:surface -- --surface operator --platform win
npm run build:operator:win
npm run build:operator:mac
npm run build:kiosk:win
npm run build:kiosk:mac
```

Artefactos esperados:

- `dist/operator/win/TurneroOperadorSetup.exe`
- `dist/operator/mac/TurneroOperador.dmg`
- `dist/operator/mac/TurneroOperador.zip`
- `dist/kiosk/win/TurneroKioscoSetup.exe`
- `dist/kiosk/mac/TurneroKiosco.dmg`
- `dist/kiosk/mac/TurneroKiosco.zip`

Metadatos de auto-update esperados:

- `dist/operator/win/latest.yml`
- `dist/operator/mac/latest-mac.yml`
- `dist/kiosk/win/latest.yml`
- `dist/kiosk/mac/latest-mac.yml`

Si `electron` o `electron-builder` no estan instalados localmente, los scripts
de `dev` y `build` fallan con una instruccion explicita para ejecutar:

```bash
npm --prefix src/apps/turnero-desktop install
```

## Configuracion local

En el primer arranque la app escribe `turnero-desktop.json` en `userData`.

Campos soportados:

```json
{
    "surface": "operator",
    "baseUrl": "https://pielarmonia.com",
    "launchMode": "fullscreen",
    "stationMode": "locked",
    "stationConsultorio": 1,
    "oneTap": false,
    "autoStart": true,
    "updateChannel": "stable",
    "updateBaseUrl": "https://pielarmonia.com/desktop-updates/"
}
```

`surface` viene fijado por el build. Si el archivo se edita manualmente, la app conserva el `surface` empaquetado.
En `Turnero Operador`, el primer arranque abre una configuración guiada para dejar el equipo como `C1 fijo`, `C2 fijo` o `modo libre`.

## Windows Operador v1

Para el piloto de Windows, el mismo `TurneroOperadorSetup.exe` se instala en
las dos PCs operador. La diferencia entre `C1 fijo` y `C2 fijo` se resuelve en
el primer arranque desde la configuracion local del shell.

Guardrails de esta etapa:

- no se guardan credenciales ni 2FA en la capa nativa
- el checklist remoto completo se ejecuta solo en `Desktop instalada`; en desarrollo queda en modo informativo
- en `Desktop instalada`, `Guardar y abrir` queda bloqueado hasta que el checklist vigente deje de estar en rojo
- la validacion del numpad sigue viviendo en `operador-turnos.html` y exige las cuatro teclas operativas: `llamar`, `+`, `.`, `-`
- `F10` y `Ctrl/Cmd + ,` reabren la configuracion del equipo

En builds empaquetados se desactivan DevTools para endurecer el shell operativo.

## Configuracion guiada

- Primer arranque: la app abre una tarjeta de configuración antes de conectarse.
- Operador: permite definir `servidor`, `perfil operador`, `1 tecla`, `pantalla completa/ventana` y `autostart`.
- Checklist de arranque: antes de abrir en `Desktop instalada`, la app comprueba `perfil`, `superficie remota`, `api.php?resource=health` y el modo del shell.
- Reconfiguración: presiona `F10` o `Ctrl/Cmd + ,` para volver a la pantalla de configuración.

## Auto-update

La app consulta updates en:

```text
<updateBaseUrl>/<updateChannel>/<surface>/<platform>/
```

Estructura esperada:

```text
desktop-updates/
  stable/
    operator/
      win/
      mac/
    kiosk/
      win/
      mac/
```

## Release centralizado

El workflow [.github/workflows/release-turnero-apps.yml](../../../.github/workflows/release-turnero-apps.yml) compila Windows, macOS y Android TV, arma el bundle final y puede publicarlo al hosting.

La metadata canonica de superficies desktop ahora vive en:

- [data/turnero-surfaces.json](../../../data/turnero-surfaces.json)

Runbook:

- [docs/RUNBOOK_TURNERO_APPS_RELEASE.md](../../../docs/RUNBOOK_TURNERO_APPS_RELEASE.md)
- [docs/TURNERO_NATIVE_SURFACES.md](../../../docs/TURNERO_NATIVE_SURFACES.md)

Gate recomendado desde la raiz del repo:

```bash
npm run gate:turnero
```

## QA manual minima

- Operador abre la URL correcta y deja visible el flujo del numpad.
- Operador puede quedar como `C1 fijo`, `C2 fijo` o `modo libre` desde la configuración del shell.
- Operador Windows muestra `Desktop instalada` y el botón `Configurar Windows app (F10)` dentro de `operador-turnos.html`.
- El mismo instalador Windows sirve para `C1` y `C2`; la diferencia queda persistida solo en la configuración local del shell.
- Kiosco abre la URL correcta y queda en fullscreen.
- Navegacion externa bloqueada.
- Reconexion tras caida de red.
- Numpad Genius 1000 llama/repite/completa sin interferir con `Enter` del teclado principal.
- Impresion termica en kiosco.
