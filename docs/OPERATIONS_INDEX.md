# Operations Index

Guia corta para encontrar el flujo correcto sin navegar todo `package.json`.

Marco canonico:

- `Flow OS` = plataforma
- `Aurora Derm` = marca/operacion actual
- `AURORADERM_*` = configuracion canonica
- `PIELARMONIA_*` = compatibilidad transitoria con fallback explicito
- `https://pielarmonia.com` = host publico vivo en esta ola

El material historico y los one-offs desplazados desde la raiz viven en
`docs/archive/root-history/` y `scripts/archive/`.
Los scripts operativos activos viven en `scripts/ops/**`; los `.ps1` de raiz
se conservan como wrappers compatibles.
La frontera de markdowns, runtime, archivos de control, dotfiles,
singletones especiales y directorios que todavia permanecen en raiz se
documenta en `docs/ROOT_SURFACES.md`.

Host local canonico para validaciones con backend: `http://127.0.0.1:8011`.
La shell publica vive bajo `/`, `/es/` y `/en/`; no usar `/index.html` como
entrypoint local con `php -S`.
Overrides:

- `TEST_LOCAL_SERVER_PORT` para mover el puerto local de Playwright.
- `TEST_BASE_URL` para apuntar tests, audits o pentests a otro host.
- `LIGHTHOUSE_LOCAL_SERVER_PORT` para fijar el puerto del servidor local de Lighthouse.
- `LIGHTHOUSE_BASE_URL` para auditar un host ya levantado sin arrancar un servidor local extra.

## Fuentes de verdad

- Publico V6: `docs/public-v6-canonical-source.md`
- Recovery cycle: `docs/FLOW_OS_RECOVERY_PLAN.md`
- Source vs output de runtime versionado: `docs/RUNTIME_ARTIFACT_POLICY.md`
- Branch slicing para trabajo mixto: `docs/BRANCH_SLICING_GUARDRAILS.md`
- Admin sony_v3: `docs/ADMIN-UI-ROLLOUT.md`
- Desarrollo local con backend: `docs/LOCAL_SERVER.md`
- Contribucion y PR flow: `docs/CONTRIBUTING.md`
- LeadOps/OpenClaw: `docs/LEADOPS_OPENCLAW.md`
- Runtime transversal OpenClaw/Codex: `TRI_LANE_RUNTIME_RUNBOOK.md`
- Deploy y post-deploy: `docs/DEPLOYMENT.md`
- Deploy hosting detallado: `docs/DEPLOY_HOSTING_PLAYBOOK.md`
- Deploy por GitHub Actions: `docs/GITHUB_ACTIONS_DEPLOY.md`
- Public main update runbook: `docs/PUBLIC_MAIN_UPDATE_RUNBOOK.md`
- Public V3 cron install: `docs/PUBLIC_V3_CRON_INSTALL.md`
- Checklist operativa de produccion: `docs/PRODUCTION_TEST_CHECKLIST.md`
- Cutover de agenda Google: `docs/CALENDAR_CUTOVER.md`
- Turnero web production cut: `docs/TURNERO_WEB_PRODUCTION_CUT.md`
- Turnero native surfaces: `docs/TURNERO_NATIVE_SURFACES.md`
- Turnero apps release runbook: `docs/RUNBOOK_TURNERO_APPS_RELEASE.md`
- Estado operativo: `docs/PRODUCT_OPERATIONAL_STATUS.md`
- Plan de estabilidad: `docs/STABILITY_14_DAYS_PLAN.md`
- Seguridad viva: `docs/SECURITY.md`
- Auditoria de seguridad: `docs/SECURITY_AUDIT.md`
- Runbooks operativos: `docs/RUNBOOKS.md`
- Frontera de superficies permitidas en raiz: `docs/ROOT_SURFACES.md`
- Gobernanza de agentes: `AGENTS.md`

## Higiene local

Comandos:

- `npm run check:local:artifacts`
- `npm run clean:local:artifacts`
- `npm run workspace:hygiene:doctor`
- `npm run workspace:hygiene:status`
- `npm run workspace:hygiene:fix`
- `npm run legacy:generated-root:status`
- `npm run legacy:generated-root:check`
- `npm run legacy:generated-root:apply`

Notas:

- Limpia solo artefactos locales efimeros: `cookies.txt`, `.lighthouseci/`, `lhci_reports/`, `_deploy_bundle/`, `playwright-report/`, `test-results/`, `php_server.log`, `.php-cs-fixer.cache`, `.phpunit.cache/`, `coverage.xml`, `.tmp-calendar-write-report.json`, `.codex-public-paths.txt`, `build_analysis.txt`, `conflict_branches.txt`, `stats.html`, `styles.min.css`, `styles.optimized.css`, `styles-critical.min.css` y `styles-deferred.min.css`.
- `workspace:hygiene:doctor` es la vista canonica V5: recorre todos los worktrees, ordena por severidad usando `overall_state`, agrega `scope_context`, `strategy_context`, `lane_context`, `scope_counts`, `issues[]`, `candidate_tasks[]`, `split_plan[]` y expone `remediation_plan[]` por fases.
- `attention` significa que hay warnings reales pero no blockers globales del doctor; el caso tipico es `authored/in_scope` o `authored/unknown_scope` dentro de una sola lane/subfrente.
- `authored/in_scope` no bloquea publish ni sync; `authored/out_of_scope` bloquea publish/sync/CI; `authored/unknown_scope` pide aclarar contexto y sigue bloqueando `sync-main-safe`.
- `mixed_lane`, `blocked_scope` y `outside_strategy` ya no quedan escondidos como `unknown_scope`: el doctor los expone como issues separados y puede devolver `split_plan[]` cuando el worktree mezcla lanes o subfrentes.
- `workspace:hygiene:status` y `workspace:hygiene:fix` son aliases de compatibilidad del doctor.
- `workspace:hygiene:doctor --json` entrega el schema compacto para tooling; usa `--include-entries` solo cuando necesites los `dirty_entries[]` completos para debugging.
- `workspace:hygiene:doctor -- --task-id <ID>` fija la tarea de referencia; `--scope-pattern <glob>` repite patrones manuales y `--show-candidates` muestra candidatos historicos/activos en la vista humana.
- `workspace:hygiene:fix` limpia solo ruido efimero/staged como `.generated/site-root/` y `_deploy_bundle/`; no borra source authored.
- `legacy_generated_root` recomienda `npm run legacy:generated-root:apply`.
- `legacy_generated_root_deindexed` significa deindexado staged pendiente de commit o stash; sigue bloqueando publish/sync.
- No toca `verification/agent-runs/` ni otros artefactos canonicos de evidencia.
- Los snapshots historicos equivalentes viven bajo `docs/archive/root-history/**`.

## Que quieres hacer

### 1. Cambiar la web publica

Fuente canonica:

- `src/apps/astro/src/pages/**`
- `src/apps/astro/src/components/public-v6/**`
- `content/public-v6/**`

Comandos:

- `npm run build:public:v6`
- `npm run check:public:v6:artifacts`
- `npm run check:public:runtime:artifacts`
- `npm run check:runtime:compat:versions`
- `npm run check:runtime:artifacts`
- `npm run check:deploy:artifacts`
- `npm run chunks:public:check`
- `npm run chunks:public:prune`
- `npm run benchmark:local`
- `npm run test:frontend:performance:gate`
- `npm run test:frontend:qa:v6`
- `npm run audit:public:v6:copy`
- `npm run audit:public:v6:visual-contract`
- `npm run audit:public:v6:sony-evidence`
- `npm run baseline:public:screenshots`
- `npm run baseline:public:compare`
- `npm run gate:public:v6:canonical-publish`

Notas:

- Los audits y baselines V6 aceptan `TEST_BASE_URL` o `--base-url`.
- `check:public:runtime:artifacts` valida el runtime versionado del gateway publico (`styles.css`, `styles-deferred.css`, `script.js`, `js/chunks/**`, `js/engines/**`) y escribe `verification/public-v6-canonical/runtime-artifacts-report.json`.
- `check:runtime:compat:versions` valida solo los puentes de compatibilidad que todavia fijan versiones runtime, incluido `sw.js`.
- `check:runtime:artifacts` agrupa el chequeo del runtime publico, chunks admin y el validador de compatibilidad de versiones para revisar outputs sin tratar bundles generados como source.
- `check:deploy:artifacts` suma a lo anterior la verificacion de `es/**`, `en/**` y `_astro/**`.
- `chunks:public:prune` elimina chunks huerfanos en `js/chunks/**` que ya no son alcanzables desde `script.js`.
- `npm run test:frontend:lighthouse:premium` usa `LIGHTHOUSE_BASE_URL` o el host local canonico; `LIGHTHOUSE_LOCAL_SERVER_PORT` manda sobre `TEST_LOCAL_SERVER_PORT` si necesitas separarlo.
- `npm run benchmark:local` reutiliza `TEST_BASE_URL` o levanta `127.0.0.1:8011`.
- `npm run test:frontend:performance:gate` usa `TEST_BASE_URL` o el host local canonico si no se pasa uno.
- Si no se pasa un host, los scripts canonicos levantan el helper local V6 automaticamente.

### 2. Cambiar el admin

Runtime canonico:

- `admin.html`
- `admin.js`
- `src/apps/admin-v3/**`

Comandos:

- `npm run gate:admin:rollout`
- `npm run gate:admin:rollout:auth`
- `npm run checklist:admin:auth:local`
- `npm run diagnose:admin:auth:rollout`
- `npm run smoke:admin:auth:local`
- `npm run openclaw:auth:start`
- `npm run smoke:admin:auth:live:node`
- `npm run test:admin:auth`
- `npm run test:admin:runtime-smoke`
- `npm run test:frontend:qa:admin`
- `npm run chunks:admin:check`
- `npm run chunks:admin:prune`
- `npm run check:runtime:artifacts`

Notas:

- `js/admin-runtime.js` existe solo como alias de compatibilidad.
- `legacy` y `sony_v2` no forman parte del runtime operativo.
- Implementacion operativa canonica: `scripts/ops/admin/**`
- Si `AURORADERM_OPERATOR_AUTH_TRANSPORT=local_helper`, levantar el helper del operador con `npm run openclaw:auth:start`. En produccion, el modo canonico es `AURORADERM_OPERATOR_AUTH_MODE=google_oauth`.
- `npm run gate:admin:rollout` ya cubre `tests/admin-openclaw-login.spec.js` para no dejar el login Operator Auth fuera del gate.
- `npm run gate:admin:rollout:auth` endurece el gate para exigir `operator-auth-status` en modo Google configurado.
- `npm run diagnose:admin:auth:rollout` inspecciona `operator-auth-status` y la fachada `admin-auth.php?action=status` para devolver `diagnosis` + `nextAction` del rollout remoto.
- `npm run test:frontend:qa:admin` tambien cubre `tests/admin-openclaw-login.spec.js` dentro del QA canonico del admin.
- `npm run checklist:admin:auth:local` imprime el smoke manual canonico del laptop operador.
- Implementacion operativa del checklist local: `scripts/ops/admin/CHECKLIST-OPENCLAW-AUTH-LOCAL.ps1`
- `npm run smoke:admin:auth:local` ejecuta el smoke no interactivo del facade `admin-auth.php`.
- Implementacion operativa del smoke local: `scripts/ops/admin/SMOKE-OPENCLAW-AUTH-LOCAL.ps1`
- `docs/RUNTIME_ARTIFACT_POLICY.md` fija que `src/apps/admin/index.js` y `src/apps/admin-v3/**` son la fuente primaria; `admin.js` y `js/admin-chunks/**` se revisan como outputs validados.
- Playwright local usa `127.0.0.1:8011` por defecto; para reutilizar otro servidor usar `TEST_BASE_URL=...` y `TEST_REUSE_EXISTING_SERVER=1` solo si es intencional.

### 3. Operar Turnero web pilot

Comandos:

- `npm run gate:turnero:web-pilot`
- `npm run verify:prod:turnero:web-pilot`
- `npm run smoke:prod:turnero:web-pilot`
- `npm run gate:prod:turnero:web-pilot`
- `npm run turnero:clinic-profile:verify-remote -- --base-url https://pielarmonia.com --json`

Runbook canonico:

- `docs/TURNERO_WEB_PRODUCTION_CUT.md`

Notas:

- Este es el carril canonico del piloto web por clínica; valida `clinic-profile`, `verify-remote`, `publicSync` y las superficies `admin/operator/kiosk/display`.
- No arrastra `desktop-updates`, `app-downloads` ni instaladores como blocker de salida.
- Si el host remoto sigue `unverified` en `public_main_sync` o ya responde `health_http_*`, tratarlo como blocker unico del corte y no reabrir scope lateral.
- Si `operator-auth-status`, `admin-auth.php?action=status` o el `health` publico devuelven `5xx`, congelar scope y recuperar backend/auth antes de tocar mas UI.

### 4. Operar Turnero nativo

Comandos:

- `npm run turnero:stage:pilot:local`
- `npm run turnero:verify:pilot:local`
- `npm run checklist:turnero:operator:pilot`
- `npm run publish:turnero:operator:pilot -- -DryRun`
- `npm run verify:prod:turnero:operator:pilot`
- `npm run smoke:prod:turnero:operator:pilot`
- `npm run gate:turnero`

Runbooks canonicos:

- `docs/TURNERO_NATIVE_SURFACES.md`
- `docs/RUNBOOK_TURNERO_APPS_RELEASE.md`

Notas:

- `gate:turnero` queda como gate ampliado del release que tambien incluye el carril nativo.
- Para validar tambien el hosting publicado del piloto, usa `npm run checklist:turnero:operator:pilot -- -ServerBaseUrl https://pielarmonia.com`.
- Para convertir esa validacion en gate operativo del hosting, usa `npm run verify:prod:turnero:operator:pilot` y luego `npm run smoke:prod:turnero:operator:pilot`.
- Implementacion operativa canonica: `scripts/ops/turnero/**`
- Entry point local del checklist: `scripts/ops/turnero/CHECKLIST-OPERADOR-WINDOWS-PILOTO.ps1`
- Entry point local de publicacion: `scripts/ops/turnero/PUBLICAR-OPERADOR-WINDOWS-PILOTO.ps1`
- El checklist de piloto Windows valida bundle local, feed `pilot`, centro de descargas y deja el smoke manual listo para recepcion o consultorio.
- `publish:turnero:operator:pilot` sube solo `app-downloads/pilot` y `desktop-updates/pilot` del operador. Usa `FTP_SERVER`, `FTP_USERNAME`, `FTP_PASSWORD`, `FTP_SERVER_DIR`, `FTP_PROTOCOL`, `FTP_SERVER_PORT` y `FTP_SECURITY`.
- Si el equipo entra en contingencia, el cierre real sigue siendo `live/offline/safe` + prueba del Genius Numpad 1000.

### 5. Validar dominios criticos

Comandos:

- `npm run test:critical:agenda`
- `npm run test:critical:funnel`
- `npm run test:critical:payments`

Usalos antes de tocar despliegue o si cambias comportamiento en agenda, funnel o pagos.

### 6. Validar produccion

Comandos:

- `npm run flow-os:recovery:daily`
- `npm run verify:prod`
- `npm run verify:prod:fast`
- `npm run smoke:prod`
- `npm run gate:prod`
- `npm run gate:prod:fast`
- `npm run gate:prod:strict`
- `npm run nightly:stability`
- `npm run monitor:prod`
- `npm run checklist:prod:public-sync:host`
- `npm run report:weekly:prod`

Implementacion canonica:

- `scripts/ops/prod/**`
- `scripts/ops/setup/**`
- `bin/powershell/**`
- Los `.ps1` de raiz siguen existiendo como wrappers compatibles.

Notas:

- `npm run flow-os:recovery:daily` es el corte diario canonico del ciclo `2026-03-21 -> 2026-04-20`: actualiza `prod-readiness-summary`, refresca el diagnostico Operator Auth y deja `verification/runtime/flow-os-recovery-daily.json`.
- Mientras ese corte siga en `RED`, mantener freeze duro en `admin v3 + queue/turnero + auth Google + readiness + deploy` y no reabrir `expansion`, `renewal`, `executive review` ni trabajo multi-sede.
- `npm run checklist:prod:public-sync:host` no ejecuta cambios remotos; imprime el checklist host-side canonico para revisar wrapper, `public-sync-status.json`, `health-diagnostics`, auth y cifrado en reposo antes de intervenir el VPS.
- Entry point canonico: `scripts/ops/prod/CHECKLIST-HOST-PUBLIC-SYNC.ps1`
- El weekly report de produccion vive en `verification/weekly/weekly-report-YYYYMMDD.{md,json}`.
- El cierre semanal orientado a release manager puede vivir junto a ese reporte en `verification/weekly/release-close-YYYYMMDD.{md,json}` usando las secciones `releasable now`, `not releasable yet`, `integration conflicts`, `stability risks`, `recommended release scope` y `parked for next cycle`.

### 7. Operar LeadOps interno con OpenClaw

Comandos:

- `npm run leadops:worker`
- `node agent-orchestrator.js task create --title "..." --template runtime --files bin/lead-ai-worker.js --json`
- `node agent-orchestrator.js runtime verify pilot_runtime --json`
- `node agent-orchestrator.js runtime invoke <AG-ID> --expect-rev <n> --json`
- `php vendor/bin/phpunit tests/Integration/LeadOpsEndpointsTest.php`
- `node --test tests-node/lead-ai-worker.test.js`
- `npx playwright test tests/admin-callbacks-triage.spec.js`

Notas:

- `lead-ai-queue` y `lead-ai-result` usan token de maquina, no sesion admin.
- El worker es pull-based desde el laptop del operador.
- Si el worker cae, el panel sigue operando con scoring heuristico local.
- El runtime canonico del piloto es `pilot_runtime`; OpenClaw sigue siendo el provider interno de `figo_queue` y `leadops_worker` en el lane `transversal_runtime`.
- `task create --template runtime` crea la tarea ya alineada a `codex_transversal` e infiere `runtime_surface` desde `files`.
- `runtime verify` comprueba `figo_queue`, `leadops_worker` y `operator_auth`; `runtime invoke` solo ejecuta `figo_queue` y `leadops_worker`.
- Para crear o mover tareas de runtime, seguir `TRI_LANE_RUNTIME_RUNBOOK.md` y mantener `codex_instance=codex_transversal`.

### 8. Trabajar con gobernanza y board

Comandos de lectura:

- `npm run agent:status`
- `npm run agent:board:sync:check`
- `npm run agent:board:doctor`
- `npm run agent:summary:local`
- `npm run agent:leases`
- `npm run agent:jobs:status`

Comandos de validacion:

- `npm run agent:test`
- `npm run agent:policy:lint`
- `npm run agent:gate`
- `npm run agent:board:sync:apply`
- `node agent-orchestrator.js runtime verify pilot_runtime --json`

Para mutaciones del board, seguir `AGENTS.md` y usar `--expect-rev`.
Si una iniciativa empieza a mezclar ops/deploy, queue runtime, desktop,
tests o governance evidence, cortar la rama con
`docs/BRANCH_SLICING_GUARDRAILS.md` antes de seguir agregando superficies.

## Atajos por perfil

### Daily local

- `npm run check:local:artifacts`
- `npm run build:public:v6`
- `npm run benchmark:local`
- `npm run test:frontend:qa:v6`
- `npm run gate:admin:rollout`
- `npm run leadops:worker`
- `npm run agent:summary:local`

### Pre-release

- `npm run gate:public:v6:canonical-publish`
- `npm run test:critical:agenda`
- `npm run test:critical:funnel`
- `npm run test:critical:payments`
- `npm run gate:prod:fast`
- `npm run report:weekly:prod`

### Troubleshooting admin bundles

- `npm run chunks:admin:check`
- `npm run chunks:admin:prune`

`chunks:admin:check` valida residuos y tambien corta si `admin.js` o los
chunks activos contienen marcadores de merge.

Si `admin.html` y `admin.js` quedan desalineados, revisar `docs/ADMIN-UI-ROLLOUT.md`.
Si Playwright apunta al host equivocado, revisar `TEST_BASE_URL`, `TEST_LOCAL_SERVER_PORT` y `TEST_REUSE_EXISTING_SERVER`.
