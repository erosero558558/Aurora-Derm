# Runbook de Release de Apps Turnero

## Objetivo

Publicar `Turnero Operador`, `Turnero Kiosco` y `Turnero Sala TV` con un solo workflow, dejando listas estas rutas en produccion:

- `/app-downloads/stable/operator/win/TurneroOperadorSetup.exe`
- `/app-downloads/stable/operator/mac/TurneroOperador.dmg`
- `/app-downloads/stable/kiosk/win/TurneroKioscoSetup.exe`
- `/app-downloads/stable/kiosk/mac/TurneroKiosco.dmg`
- `/app-downloads/stable/sala-tv/android/TurneroSalaTV.apk`
- `/desktop-updates/stable/operator/win/latest.yml`
- `/desktop-updates/stable/operator/mac/latest-mac.yml`
- `/desktop-updates/stable/kiosk/win/latest.yml`
- `/desktop-updates/stable/kiosk/mac/latest-mac.yml`

## Workflow canonico

Archivo:

- `.github/workflows/release-turnero-apps.yml`
- `data/turnero-surfaces.json`
- `docs/TURNERO_NATIVE_SURFACES.md`

Trigger:

- `workflow_dispatch`

Inputs clave:

- `release_version`: version semver comun para desktop y Android TV
- `base_url`: URL publica de `operador-turnos.html`, `kiosco-turnos.html` y `sala-turnos.html`
- `update_base_url`: base publica de `desktop-updates/`
- `publish_to_hosting`: publica el bundle final al hosting usando `FTP_*`
- `publish_github_release`: adjunta el bundle a un GitHub Release
- `dry_run`: valida el bundle y el upload sin subir archivos reales al hosting

## Flujo

0. `resolve-release-plan`
    - deriva matrices desktop/android desde `data/turnero-surfaces.json`
1. `build-desktop`
    - compila `Operador` y `Kiosco` en Windows y macOS
    - genera instaladores y metadatos de auto-update
2. `build-android`
    - compila la APK release de Android TV
3. `package-release`
    - arma un bundle publicable con `app-downloads/` y `desktop-updates/`
    - genera `app-downloads/stable/release-manifest.json`
    - genera `app-downloads/stable/SHA256SUMS.txt`
4. `publish-to-hosting` opcional
    - sube el bundle a `server_dir`
5. `publish-github-release` opcional
    - adjunta el bundle al release/tag seleccionado

## Manifest y catalogo

El bundle incluye:

- `app-downloads/stable/release-manifest.json`

`lib/AppDownloadsCatalog.php` intenta leer ese archivo en tiempo de ejecucion.
Si existe en el servidor, el admin y el centro de instalacion muestran version y URLs reales sin editar `content/app-downloads/catalog.php`.

## Secrets requeridos para hosting

- `FTP_SERVER`
- `FTP_USERNAME`
- `FTP_PASSWORD`

Variables operativas opcionales via input manual:

- `protocol`: `ftps | ftp | sftp`
- `server_port`
- `security`
- `server_dir`

## Checklist minimo

- `release_version` usa `major.minor.patch`
- el registry canonico esta actualizado antes de correr release
- el workflow genera `turnero-apps-release-bundle`
- `release-manifest.json` contiene `operator`, `kiosk` y `sala_tv`
- `publish_to_hosting=true` solo despues de revisar el bundle o correr `dry_run`
- si se publica a hosting, verificar descargas desde `admin.html#queue`
- si se publica desktop, verificar auto-update contra `desktop-updates/stable/...`

## Validacion local antes del workflow

Minimo recomendado antes de publicar:

- `npm run gate:turnero`
- `npm run turnero:release:plan`
- `npm run test:turnero:php-contract`
- `node --test tests-node/turnero-surface-registry.test.js tests-node/resolve-turnero-release-plan.test.js tests-node/stage-turnero-app-release-script.test.js tests-node/release-turnero-apps-workflow-contract.test.js`
- `node --test tests-node/app-downloads-catalog-registry-contract.test.js tests-node/admin-data-app-downloads-contract.test.js tests-node/public-v6-software-native-apps-contract.test.js`
- `npx playwright test tests/queue-display.spec.js tests/admin-queue.spec.js tests/queue-kiosk.spec.js tests/queue-integrated-flow.spec.js --workers=1`

Nota operativa:

- `npm run gate:turnero` es el gate rapido canonico del frente; si falla, no avanzar al workflow.
- La ruta PHP oficial del contrato `/data` + `appDownloads` es `npm run test:turnero:php-contract`.
- `bin/run-phpunit.js` repara automaticamente drift de Composer autoload con `composer dump-autoload --no-scripts` antes de delegar a `vendor/bin/phpunit`, y fuerza `--no-coverage` salvo que la corrida ya pida reportes de cobertura.
- La corrida integrada de las cuatro superficies del turnero debe ejecutarse en `--workers=1` para evitar flake por estado compartido del servidor local y del store de pruebas.

## Dry run local del bundle

Cuando ya existan artefactos reales locales o descargados desde GitHub Actions:

```bash
node bin/stage-turnero-app-release.js \
  --version 0.1.0 \
  --desktopRoot artifacts/desktop \
  --androidRoot artifacts/android \
  --outputRoot release/turnero-apps
```

Validar siempre:

- `release/turnero-apps/app-downloads/stable/release-manifest.json`
- `release/turnero-apps/app-downloads/stable/SHA256SUMS.txt`
- `release/turnero-apps/desktop-updates/stable/**`
- que `admin.html#queue` y `/app-downloads/` muestren version y URLs reales a partir del manifest, no solo defaults del registry

## Smoke recomendado post-release

- `Operador` instala y abre `operador-turnos.html`
- `Kiosco` instala y abre `kiosco-turnos.html`
- `Sala TV` instala la APK y abre `sala-turnos.html`
- `admin.html#queue` muestra la version de release correcta
- `app-downloads/` entrega el instalador correcto por plataforma
- `app-downloads/` marca `Listo para instalación` solo si la descarga y la ruta preparada responden
- `desktop-updates/` responde `latest.yml` y `latest-mac.yml`
- el shell desktop muestra `Equipo listo` al pasar el checklist de arranque

## Smoke operativo obligatorio

Antes de publicar `stable`, completar y registrar esta matriz minima:

- `Operador` Win/mac: perfil `C1`, `C2` y libre; numpad; llamado; re-llamado; completar ticket
- `Kiosco` Win/mac: impresion de ticket; reconexion; fullscreen; solicitud offline y recuperacion
- `Sala TV` Android TV: `audio primed -> bell test -> listo`; reconexion; fallback local; campanilla audible
- `admin.html#queue`: version visible del release; surfaces listas; links resueltos desde `release-manifest.json`
- `/app-downloads/`: URLs reales; manifest visible; descargas correctas por plataforma
- `desktop-updates/stable/...`: feeds `latest.yml` y `latest-mac.yml` accesibles con payloads correctos

## Cierre del primer release estable

No marcar el frente como cerrado hasta completar todo esto:

- bundle local o de workflow validado con manifest y checksums
- smoke real en `Operador` Win/mac, `Kiosco` Win/mac y `Sala TV` Android TV
- verificacion visual en `admin.html#queue` y `/app-downloads/`
- evidencia escrita en `verification/agent-runs/`

## Nueva superficie

Para alta canonica de una nueva app nativa del turnero:

- revisar `docs/TURNERO_NATIVE_SURFACES.md`
- usar `node bin/scaffold-turnero-surface.js`
