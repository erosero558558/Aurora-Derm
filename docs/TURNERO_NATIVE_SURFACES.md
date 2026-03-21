# Superficies Nativas del Turnero

Nota operativa del ciclo `2026-03-21 -> 2026-04-20`:

- mientras `docs/PRODUCT_OPERATIONAL_STATUS.md` siga en `RED`, no abrir nuevas
  superficies nativas ni nuevas olas de packaging/release salvo que desbloqueen
  directamente `verify/smoke/gate` del piloto web por clinica
- el freeze activo vive en `docs/FLOW_OS_RECOVERY_PLAN.md`

## Objetivo

Centralizar alta, packaging, distribucion y release de futuras apps nativas del
turnero desde un registry canonico:

- `data/turnero-surfaces.json`

Ese archivo define identidad tecnica y comercial, targets publicos, packaging y
metadatos de release para `operator`, `kiosk` y `sala_tv`.

## Alta de una nueva superficie

Usa el scaffold:

```bash
node bin/scaffold-turnero-surface.js \
  --id recepcion_movil \
  --family desktop \
  --route /recepcion-movil.html \
  --productName "Turnero Recepcion Movil" \
  --artifactBase TurneroRecepcionMovil
```

Salida esperada:

- agrega la superficie al registry canonico
- crea `docs/turnero-surfaces/<id>.md`
- crea `verification/turnero-surface-stubs/<id>.json`

Nota:

- `docs/turnero-surfaces/` aparece recien cuando se hace el primer scaffold; su ausencia previa es normal.

## Que completar despues del scaffold

1. Shell y runtime
    - `desktop`: reusar `src/apps/turnero-desktop` o documentar por que no
    - `android`: crear modulo real y alinear Gradle con la superficie
2. Packaging
    - confirmar nombres de artefactos
    - confirmar feed/payload de auto-update si aplica
3. Distribucion
    - revisar `app-downloads/` y `release-manifest.json`
    - confirmar rutas publicas generadas para `app-downloads/` y `desktop-updates/`
4. Smoke
    - abrir la superficie remota correcta
    - validar reconexion, restricciones de navegacion y checklist operativo

## Definition of done canónica de una superficie nativa

Esta seccion es la fuente de verdad de aceptacion para cualquier superficie
nativa. Si otro runbook, checklist o nota operativa contradice este bloque,
prevalece este bloque.

Una superficie nueva no se considera lista solo por existir en el registry.
Debe cumplir ademas:

- build real que produzca los artefactos esperados
- dry run exitoso con `stage-turnero-app-release.js`
- rutas reales visibles en `release-manifest.json`
- `admin.html#queue` y `/app-downloads/` resolviendo version/links reales
- smoke manual en hardware o plataforma objetivo, con evidencia real adjunta
- runbook y evidencia actualizados en `verification/agent-runs/`

## Release canonico

1. Resolver plan de release desde el registry:

```bash
node bin/resolve-turnero-release-plan.js
```

2. Empaquetar bundle publicable:

```bash
node bin/stage-turnero-app-release.js --version 0.1.0
```

3. Ejecutar workflow:

- `.github/workflows/release-turnero-apps.yml`

## Validacion local recomendada

- `npm run gate:turnero`
- `npm run turnero:release:plan`
- `npm run checklist:turnero:operator:pilot`
- `node --test tests-node/turnero-surface-registry.test.js tests-node/resolve-turnero-release-plan.test.js tests-node/stage-turnero-app-release-script.test.js`
- `node --test tests-node/app-downloads-catalog-registry-contract.test.js tests-node/admin-data-app-downloads-contract.test.js`

Para el piloto Windows del operador, usar tambien:

- `npm run turnero:stage:pilot:local`
- `npm run turnero:verify:pilot:local`
- `npm run publish:turnero:operator:pilot -- -DryRun`
- `npm run checklist:turnero:operator:pilot -- -ServerBaseUrl https://pielarmonia.com`

## Rollback

Si la superficie aun no tiene release valido:

1. revertir la entrada agregada al registry
2. eliminar stubs/documentacion si quedaron obsoletos
3. confirmar que `release-manifest.json` ya no la expone

Si ya hubo publicacion:

1. retirar artefactos de `app-downloads/`
2. retirar feeds/payloads de `desktop-updates/`
3. repetir smoke del centro de descargas
