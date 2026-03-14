# Turnero web pilot - release slice 2026-03-14

Estado del workspace al momento de este corte:

- El workspace local ya no reproduce los rojos que frenaron el candidato remoto `b248421`.
- El host remoto sigue degradado con `502`, sin un deploy sano de este estado.
- El worktree esta mezclado; este manifiesto separa el slice minimo publicable del piloto de cambios accesorios o de bajo retorno para un corte urgente.

## Slice recomendado: publish-core

Este es el corte recomendado si el objetivo es publicar un estado limpio del piloto web y volver a correr `verify/smoke/gate` remoto sin arrastrar ruido innecesario.

### 1. Admin queue guiado por focus en `basic`

Archivos fuente:

- `src/apps/admin-v3/core/boot.js`
- `src/apps/admin-v3/core/boot/auth.js`
- `src/apps/admin-v3/core/boot/navigation/commands.js`
- `src/apps/admin-v3/core/boot/navigation/sections.js`
- `src/apps/admin-v3/core/boot/rendering.js`
- `src/apps/admin-v3/core/boot/ui-prefs/storage.js`
- `src/apps/admin-v3/sections/appointments/render/deck.js`
- `src/apps/admin-v3/sections/availability/render/review-context.js`
- `src/apps/admin-v3/shared/core/keyboard/constants.js`
- `src/apps/admin-v3/shared/core/keyboard/global.js`
- `src/apps/admin-v3/shared/core/router.js`
- `src/apps/admin-v3/shared/modules/queue/render/section/controls.js`
- `src/apps/admin-v3/shared/modules/queue/render/section/install-hub.js`
- `src/apps/admin-v3/shared/modules/queue/render/section/install-hub/domain-view.js`
- `src/apps/admin-v3/shared/modules/queue/render/section/install-hub/focus-mode/render.js`
- `src/apps/admin-v3/shared/modules/queue/render/section/install-hub/playbook/model.js`
- `src/apps/admin-v3/shared/modules/queue/render/section/install-hub/quick-console/model.js`
- `src/apps/admin-v3/shared/modules/queue/runtime/mode.js`
- `src/apps/admin-v3/ui/frame/config/titles.js`
- `src/apps/admin-v3/ui/frame/templates/nav.js`
- `src/apps/admin-v3/ui/frame/templates/sections/index.js`
- `src/apps/admin-v3/ui/frame/templates/sections/queue/header.js`
- `src/apps/admin-v3/ui/frame/templates/sections/queue/station.js`
- `src/apps/admin-v3/ui/frame/templates/sections/queue/table.js`
- `src/apps/admin-v3/ui/frame/templates/sections/queue/triage.js`
- `src/apps/admin/index.js`

Assets y contrato publico asociados:

- `admin.html`
- `admin-v3.css`
- `queue-ops.css`
- `admin.js`
- `js/admin-chunks/index-MyvPG610.js`
- `js/admin-chunks/index-DbENpOI8.js` (delete en el mismo corte)
- `docs/admin-dom-contract.md`
- `sw.js`

### 2. Superficies web alineadas al mismo clinic-profile

HTML y CSS:

- `operador-turnos.html`
- `kiosco-turnos.html`
- `sala-turnos.html`
- `queue-kiosk.css`
- `queue-display.css`

Fuentes y bundles:

- `src/apps/queue-operator/index.js`
- `src/apps/queue-kiosk/index.js`
- `src/apps/queue-display/index.js`
- `js/queue-kiosk.js`
- `js/queue-display.js`
- `lib/turnero-clinic-profile-registry.js`

### 3. Identidad publica del piloto y readiness remoto

- `controllers/HealthController.php`
- `bin/prod-readiness-summary.js`
- `scripts/ops/prod/MONITOR-PRODUCCION.ps1`
- `scripts/ops/prod/SMOKE-PRODUCCION.ps1`
- `scripts/ops/prod/VERIFICAR-DESPLIEGUE.ps1`
- `.github/workflows/prod-monitor.yml`

### 4. Validacion minima que conviene llevar con el corte

Node y PHP:

- `tests-node/health-turnero-pilot-contract.test.js`
- `tests-node/prod-monitor-public-sync-contract.test.js`
- `tests-node/prod-monitor-workflow-contract.test.js`
- `tests-node/prod-ops-public-sync-contract.test.js`
- `tests-node/queue-pilot-smoke-signal-contract.test.js`
- `tests-node/turnero-clinic-profile-cli.test.js`
- `tests-node/turnero-clinic-profile-registry.test.js`
- `tests-node/prod-monitor-script-report.test.js`
- `tests-node/prod-readiness-summary-prod-monitor.test.js`
- `tests-node/turnero-web-pilot-gate-contract.test.js`
- `tests/Integration/HealthVisibilityTest.php`

UI:

- `tests/admin-queue.spec.js`
- `tests/admin-quick-nav.spec.js`
- `tests/admin-v3-shell.spec.js`
- `tests/funnel-tracking.spec.js`
- `tests/turnero-sony-premium-contract.spec.js`
- `playwright.config.js`

## Slice recomendado: governance-enabler

Este slice no cambia producto del piloto, pero si el corte se va a abrir en PR o pasar por `agent:gate`, conviene arrastrarlo junto para no reintroducir drift del board/plan ni warnings evitables.

- `AGENTS.md`
- `AGENT_BOARD.yaml`
- `PLAN_MAESTRO_CODEX_2026.md`
- `tools/agent-orchestrator/commands/codex.js`
- `tools/agent-orchestrator/core/serializers.js`
- `bin/validate-agent-governance.php`
- `tests-node/agent-orchestrator-cli.test.js`
- `tests-node/orchestrator/core-serializers.test.js`

## Holdback recomendado para un corte urgente

Estos cambios existen en el worktree, pero no los pondria en el primer corte publicable del piloto sin separarlos o revalidarlos por fuera:

- `.gitignore`
- `docs/ARCHITECTURE.md`
- `docs/MONITORING_SETUP.md`
- `docs/OPERATIONS_INDEX.md`
- `docs/RUNBOOK_TURNERO_APPS_RELEASE.md`
- `docs/DECISION_LOG.md`
- `ops-design-system.css`
- `verification/public-v6-canonical/artifact-drift.json`
- `verification/weekly/**`

Observacion especial sobre tooling:

- `package.json` y `package-lock.json` mezclan scripts utiles del carril `turnero:web-pilot` con upgrades de toolchain (`astro`, `rollup`, `eslint`, overrides de dependencias). Para un corte urgente, mi recomendacion es no arrastrarlos completos sin separar primero los hunks de scripts de los upgrades de version.

## Riesgos y chequeos antes de publicar

### 1. Chunk requerido por `admin.js`

- `admin.js` ya apunta a `js/admin-chunks/index-MyvPG610.js`.
- Ese archivo esta untracked en el workspace actual. Si falta en el corte, `admin.html#queue` queda roto.
- El delete de `js/admin-chunks/index-DbENpOI8.js` debe viajar junto al nuevo chunk para evitar drift de assets.

### 2. Salida generada desigual entre superficies

- Hay cambios en `src/apps/queue-operator/index.js`, `src/apps/queue-kiosk/index.js` y `src/apps/queue-display/index.js`.
- En el worktree actual solo aparecen bundles modificados para `kiosk` y `display` (`js/queue-kiosk.js`, `js/queue-display.js`); `queue-operator` no muestra bundle regenerado.
- Antes de publicar, conviene regenerar o confirmar explicitamente que `operador-turnos.html` no depende de una salida pendiente.

### 3. El bloqueo actual no es local

- Localmente ya pasaron `lint`, `funnel`, `agent:test`, `HealthVisibility`, `LeadOpsEndpoints` y `TelemedicineLegacyBridge`.
- El siguiente riesgo real esta del lado del host/deploy: mientras el remoto siga en `502`, este slice solo prepara un candidato sano; no demuestra publicacion efectiva.

## Checklist sugerido despues de aislar el corte

1. `npx rollup -c rollup.config.mjs`
2. `npm run chunks:admin:prune`
3. `npm run chunks:admin:check`
4. `npx playwright test tests/admin-queue.spec.js tests/queue-kiosk.spec.js tests/queue-operator.spec.js tests/queue-display.spec.js tests/queue-integrated-flow.spec.js tests/turnero-sony-premium-contract.spec.js --workers=1`
5. `node --test tests-node/health-turnero-pilot-contract.test.js tests-node/prod-monitor-public-sync-contract.test.js tests-node/prod-monitor-workflow-contract.test.js tests-node/prod-ops-public-sync-contract.test.js tests-node/queue-pilot-smoke-signal-contract.test.js tests-node/turnero-clinic-profile-cli.test.js tests-node/turnero-clinic-profile-registry.test.js tests-node/prod-monitor-script-report.test.js tests-node/prod-readiness-summary-prod-monitor.test.js tests-node/turnero-web-pilot-gate-contract.test.js`
6. `php vendor/bin/phpunit --no-coverage tests/Integration/HealthVisibilityTest.php tests/Integration/LeadOpsEndpointsTest.php tests/Integration/TelemedicineLegacyBridgeTest.php`
7. `npm run lint:js`
8. `npm run test:critical:funnel`
9. `npm run agent:gate`
10. `npm run verify:prod:turnero:web-pilot`
11. `npm run smoke:prod:turnero:web-pilot`
12. `npm run gate:prod:turnero:web-pilot`

## Decision actual

- No recomiendo promover el worktree completo tal como esta.
- Si se necesita un corte publicable ya, usaria `publish-core` como base y sumaria `governance-enabler` solo si el camino de salida va por PR/CI completo.
- El cierre de `CDX-043` y `CDX-044` sigue bloqueado hasta ver un deploy sano en host y reruns remotos en verde.

## Artefactos listos para staging

Para no rehacer el slicing a mano:

- `verification/agent-runs/turnero-web-pilot-release-slice-20260314.publish-core.pathspec.txt`
- `verification/agent-runs/turnero-web-pilot-release-slice-20260314.governance-enabler.pathspec.txt`

Estos archivos quedan pensados para usarse con `git add --pathspec-from-file <archivo>` cuando toque preparar un corte limpio.
