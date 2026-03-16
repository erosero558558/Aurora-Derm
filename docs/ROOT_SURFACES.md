# Root Surfaces

Esta guia fija que markdowns pueden permanecer en la raiz del repositorio y
por que.

## Regla general

- La documentacion activa nueva vive en `docs/**`.
- Los snapshots y planes retirados viven en `docs/archive/root-history/**`.
- Un markdown solo puede quedarse en la raiz si cumple al menos una de estas
  condiciones:
    - es superficie de control canonica del repo;
    - existe por compatibilidad hacia `docs/**`;
    - es un tombstone historico preservado por politica;
    - CI o una politica canonica exige expresamente esa ruta.

## Superficies canonicas en raiz

- `README.md`: front door del repositorio.
- `AGENTS.md`: politica canonica de orquestacion y gobernanza.
- `TRI_LANE_RUNTIME_RUNBOOK.md`: runbook operativo canonico para el modelo
  `tri_lane_runtime`.
- `DUAL_CODEX_RUNBOOK.md`: nota de migracion historica preservada por
  compatibilidad.
- `PLAN_MAESTRO_CODEX_2026.md`: fuente de estrategia y evidencia de la linea
  Codex, requerida por `AGENTS.md`.
- `PLAN_MAESTRO_OPERATIVO_2026.md`: fuente unica de control operativo y ruta
  vigilada por CI.

## Excepciones historicas o de compatibilidad

- `PLAN_MAESTRO_2026_STATUS.md`: snapshot historico; sigue visible en raiz
  porque runbooks activos lo citan como evidencia y contexto.
- `CLAUDE.md`: guia de rol para Claude; `AGENTS.md` manda si hay conflicto.
- `JULES_TASKS.md` y `KIMI_TASKS.md`: tombstones historicos preservados por
  politica y excluidos del carril activo.

## Shims compatibles hacia docs canonicos

Los siguientes markdowns de raiz se mantienen solo como puertas de entrada
compatibles; la fuente de verdad real vive en `docs/**`:

- `SERVIDOR-LOCAL.md` -> `docs/LOCAL_SERVER.md`
- `DESPLIEGUE-PIELARMONIA.md` -> `docs/DEPLOYMENT.md` y `docs/DEPLOY_HOSTING_PLAYBOOK.md`
- `CONTRIBUTING.md` -> `docs/CONTRIBUTING.md`
- `GITHUB-ACTIONS-DEPLOY.md` -> `docs/GITHUB_ACTIONS_DEPLOY.md`
- `CHECKLIST-PRUEBAS-PRODUCCION.md` -> `docs/PRODUCTION_TEST_CHECKLIST.md`
- `CALENDAR-CUTOVER.md` -> `docs/CALENDAR_CUTOVER.md`
- `ESTADO_PRODUCTO_OPERATIVO.md` -> `docs/PRODUCT_OPERATIONAL_STATUS.md`
- `PLAN_ESTABILIDAD_14DIAS.md` -> `docs/STABILITY_14_DAYS_PLAN.md`
- `SECURITY_AUDIT.md` -> `docs/SECURITY_AUDIT.md`

## Superficies JS permitidas en raiz

Los `.js` que siguen en raiz deben caer en una de estas categorias:

- runtime publico servido desde raiz;
- runtime/admin servido desde raiz;
- CLI o config que el tooling descubre por nombre convencional en raiz.

Lista aprobada actual:

- `sw.js`: service worker con scope de raiz.
- `agent-orchestrator.js`: CLI canonica de gobernanza y board.
- `eslint.config.js`: config de ESLint descubierta por el tooling.
- `playwright.config.js`: config de Playwright descubierta por el tooling.

Los bundles generados del runtime publicado ya no forman parte de la frontera
activa de JS en raiz. El contrato stageado vive en:

- `.generated/site-root/script.js`
- `.generated/site-root/admin.js`
- `.generated/site-root/js/chunks/**`
- `.generated/site-root/js/admin-chunks/**`

Los shims de raiz existen solo para compatibilidad humana; runtime, tooling y
deploy consumen docs canonicos y el stage root `.generated/site-root/`, no
copias root legacy como fuente primaria de autoria. La frontera source-vs-output
vive en `docs/RUNTIME_ARTIFACT_POLICY.md`, y la salida segura para sacar las
copias legacy del indice es
`npm run legacy:generated-root:status|check|apply`.

## Superficies HTML permitidas en raiz

Los `.html` que siguen en raiz deben ser shells servidos directamente por el
hosting:

- `admin.html`: shell admin canonico.
- `operador-turnos.html`: shell web del operador de turnero.
- `kiosco-turnos.html`: shell web del kiosco de turnero.
- `sala-turnos.html`: shell web de la pantalla de sala.

## Superficies CSS permitidas en raiz

Los `.css` que siguen en raiz deben caer en una de estas categorias:

- runtime publico versionado;
- shell admin/turnero servido desde raiz;
- stylesheet compartido de una superficie operativa activa.

Lista aprobada actual:

- `styles.css`
- `styles-deferred.css`
- `styles-critical.css`
- `styles-astro.css`
- `styles-telemedicina.css`
- `admin-v3.css`
- `queue-ops.css`
- `queue-kiosk.css`
- `queue-display.css`
- `ops-design-system.css`
- `legal.css`

`styles.css` y `styles-deferred.css` permanecen en raiz como runtime
versionado. Su validacion va por checks de artifacts, no por inferencia
manual de ownership en review.

## Superficies PHP permitidas en raiz

Los `.php` que siguen en raiz deben ser entrypoints runtime, bridges o helpers
de backend descubiertos por el hosting/tooling:

- `index.php`
- `legacy.php`
- `api.php`
- `api-router.php`
- `api-lib.php`
- `payment-lib.php`
- `admin-auth.php`
- `figo-chat.php`
- `figo-backend.php`
- `figo-brain.php`
- `figo-ai-bridge.php`
- `backup-receiver.php`
- `verify-backup.php`
- `check-ai-response.php`
- `cron.php`
- `env.example.php`
- `.php-cs-fixer.dist.php`

## Superficies PS1 permitidas en raiz

Los `.ps1` de raiz se mantienen solo como wrappers compatibles o runbooks de
contingencia hacia `scripts/ops/**`.

Lista aprobada actual:

- `ADMIN-UI-CONTINGENCIA.ps1`
- `BENCH-API-PRODUCCION.ps1`
- `CONFIGURAR-BACKUP-OFFSITE.ps1`
- `CONFIGURAR-TELEGRAM-WEBHOOK.ps1`
- `GATE-ADMIN-ROLLOUT.ps1`
- `GATE-POSTDEPLOY.ps1`
- `MONITOR-PRODUCCION.ps1`
- `PREPARAR-PAQUETE-DESPLIEGUE.ps1`
- `REPORTE-SEMANAL-PRODUCCION.ps1`
- `SMOKE-PRODUCCION.ps1`
- `VERIFICAR-DESPLIEGUE.ps1`

## Dotfiles permitidos en raiz

Los archivos con prefijo `.` solo pueden permanecer en raiz si cumplen una
funcion de editor, git, hosting o tooling descubierto por nombre convencional.

Lista aprobada actual:

- `.editorconfig`
- `.gitattributes`
- `.gitignore`
- `.htaccess`
- `.lighthouserc.json`
- `.php-cs-fixer.dist.php`
- `.prettierignore`
- `.prettierrc`

## Superficies JSON permitidas en raiz

Los `.json` de raiz deben caer en una de estas categorias:

- manifest/config descubierta por tooling o runtime;
- policy/config canonica de gobernanza;
- config QA/audit local usada por scripts y workflows.

Lista aprobada actual:

- `package.json`
- `package-lock.json`
- `composer.json`
- `governance-policy.json`
- `manifest.json`
- `.lighthouserc.json`
- `lighthouserc.premium.json`

## Superficies YAML/YML permitidas en raiz

Los `.yaml` y `.yml` de raiz deben ser tableros canonicos, colas derivadas
vigiladas por gobernanza o configuracion de infraestructura/monitoreo usada
por Docker, Prometheus o CI.

Lista aprobada actual:

- `AGENT_BOARD.yaml`
- `AGENT_HANDOFFS.yaml`
- `AGENT_JOBS.yaml`
- `AGENT_SIGNALS.yaml`
- `docker-compose.yml`
- `docker-compose.monitoring.yml`
- `prometheus.yml`
- `prometheus.docker.yml`
- `prometheus.rules.yml`

## Superficies TXT permitidas en raiz

Los `.txt` de raiz no deben usarse como dump o nota suelta. La unica
superficie aprobada hoy es:

- `robots.txt`

## Superficies TOML permitidas en raiz

No hay `.toml` aprobados hoy en la raiz. Si aparece uno nuevo, debe existir
una razon explicita de tooling/CI y quedar documentado en esta guia.

## Superficies XML permitidas en raiz

Los `.xml` de raiz deben ser config de testing/tooling o artefactos publicos
intencionales servidos desde hosting.

Lista aprobada actual:

- `phpunit.xml`
- `psalm.xml`
- `sitemap.xml`

## Singletones especiales permitidos en raiz

Los archivos de raiz que no entran por extension operativa comun solo pueden
quedarse si son descubribles por tooling o parte del contrato publico/infra.

Lista aprobada actual:

- `Dockerfile`
- `composer.lock`
- `rollup.config.mjs`
- `nginx-pielarmonia.conf`
- `favicon.ico`

## Directorios permitidos en raiz

Los directorios trackeados de raiz solo pueden permanecer si son parte del
runtime publicado, del arbol fuente activo, de la operacion/infra o del
tooling del repo.

Lista aprobada actual:

- `_astro`
- `.claude`
- `.github`
- `.husky`
- `.vscode`
- `app-downloads`
- `bin`
- `components`
- `content`
- `controllers`
- `data`
- `desktop-updates`
- `docs`
- `en`
- `es`
- `fonts`
- `grafana`
- `images`
- `js`
- `k8s`
- `lib`
- `ops`
- `release`
- `scripts`
- `servicios`
- `src`
- `styles`
- `templates`
- `tests`
- `tests-node`
- `tools`
- `uploads`
- `vendor`
- `verification`

`_astro`, `en` y `es` siguen apareciendo en la allowlist solo como deuda de
migracion mientras existan copias trackeadas legacy en raiz. El contrato
canonico ya vive en `.generated/site-root/`, y el cleanup de indice debe
hacerse con `npm run legacy:generated-root:status|check|apply`.

## Directorios locales o fuera del front door

Estos directorios no forman parte de la superficie activa del repo y deben
permanecer ignorados o claramente fuera del carril versionado:

- `.git/`
- `node_modules/`
- `.phpunit.cache/`
- `data/` fuera de `data/turnero-surfaces.json`
- `test-results/`
- `%TEMP%/`

## JS retirado o no permitido en raiz

- `jules-dispatch.js` y `kimi-run.js`: tombstones ejecutables retirados; viven
  en `scripts/archive/jules-dispatch.js` y `scripts/archive/kimi-run.js`.
- `booking-engine.js`, `utils.js` y cualquier root `*-engine.js`: residuos
  legacy del runtime; viven en `js/archive/root-legacy/**`.

## HTML/CSS retirado o no permitido en raiz

- `stats.html`: reporte generado de Rollup; vive en
  `docs/archive/root-history/stats.html`.
- `styles.min.css`, `styles.optimized.css`, `styles-critical.min.css` y
  `styles-deferred.min.css`: snapshots/minificados legacy; viven en
  `styles/archive/public-legacy/**`.

## Media root retirada o no permitida en raiz

- `hero-woman.webp`: asset legacy fuera del runtime V6; vive en
  `images/archive/root-legacy/**`.

## Source root retirado o no permitido en raiz

- `components/ComponentLoader.js`: helper legacy fuera del source activo; vive
  en `src/archive/root-legacy/**`.
- `servicios/generate-premium-pages.js`: generador legacy de
  `/servicios/*.html`; vive en `scripts/archive/generate-premium-pages.js`.

## Residuos generados no permitidos en raiz

- `.tmp-calendar-write-report.json`, `.codex-public-paths.txt`,
  `build_analysis.txt` y `conflict_branches.txt`: reportes/snapshots
  generados. Si se conservan por referencia historica, viven en
  `docs/archive/root-history/**`.
- Si reaparecen como salidas locales, deben quedar ignorados y salir con
  `npm run clean:local:artifacts`.

## Guardrails

- Si aparece un markdown nuevo en la raiz, debe existir una razon explicita de
  politica, CI o compatibilidad.
- Los shims de raiz existen solo para compatibilidad humana; runtime, tooling
  y bundles operativos deben consumir `docs/**`.
- Si una guia activa deja de necesitar ruta en raiz, debe converger a `docs/**`
  y la raiz debe quedar como shim temporal o vaciarse por completo.
- Los residuos JS legacy de raiz (`*-engine.js`, `utils.js`) no son superficies
  activas; deben archivarse bajo `js/archive/root-legacy/**`.
- Los `.html`, `.css`, `.php` y `.ps1` de raiz deben caer en las allowlists
  anteriores o salir del front door.
- Los `.json`, `.yaml`, `.yml`, `.txt` y `.toml` de raiz deben caer en las
  allowlists anteriores o salir del front door.
- Los dotfiles, `.xml`, binary assets singleton y config especiales de raiz
  tambien deben caer en las allowlists anteriores o salir del front door.
- Los directorios trackeados de raiz deben caer en la allowlist anterior; los
  directorios locales/scratch deben quedar ignorados o fuera del carril activo.
- Los reportes y snapshots generados no son superficies activas; no deben
  permanecer versionados en raiz.
- Si `workspace:hygiene:status` reporta `legacy_generated_root`, esa suciedad
  no es authored source ni stage efimero: es deuda de migracion del root y se
  limpia con `npm run legacy:generated-root:apply`, no con edicion manual.
- Si aparece un `.js` nuevo en raiz fuera de la allowlist anterior, debe
  justificarse por contrato de runtime/tooling o salir del front door.
- El contrato que protege esta frontera vive en
  `tests-node/workspace-hygiene-contract.test.js`.
