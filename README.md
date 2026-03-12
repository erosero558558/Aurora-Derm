# Piel en Armonia

Repositorio principal de la web publica, panel admin, backend PHP y
gobernanza operativa de Piel en Armonia.

## Estado canonico

- Web publica: Astro V6 + `content/public-v6/**`
- Admin: `admin.html` + `admin.js` generado desde `src/apps/admin/index.js`
- UI admin activa: `src/apps/admin-v3/**`
- Backend: `api.php`, `controllers/**`, `lib/**`
- Gobernanza: `AGENTS.md` + `AGENT_BOARD.yaml`

## Empieza aqui

- `docs/OPERATIONS_INDEX.md`
- `docs/LEADOPS_OPENCLAW.md`
- `docs/public-v6-canonical-source.md`
- `docs/ADMIN-UI-ROLLOUT.md`
- `docs/LOCAL_SERVER.md`
- `docs/CONTRIBUTING.md`
- `docs/DEPLOYMENT.md`
- `docs/DEPLOY_HOSTING_PLAYBOOK.md`
- `docs/GITHUB_ACTIONS_DEPLOY.md`
- `docs/PRODUCTION_TEST_CHECKLIST.md`
- `docs/CALENDAR_CUTOVER.md`
- `docs/STABILITY_14_DAYS_PLAN.md`
- `docs/TURNERO_NATIVE_SURFACES.md`
- `docs/ROOT_SURFACES.md`
- `AGENTS.md`

## Setup local rapido

1. `npm install`
2. `npx playwright install`
3. Terminal 1: `php -S 127.0.0.1:8011 -t .`
4. Terminal 2: `npm run auth:operator:bridge`
5. Abrir:
    - Publico gateway: `http://127.0.0.1:8011`
    - Publico ES: `http://127.0.0.1:8011/es/`
    - Publico EN: `http://127.0.0.1:8011/en/`
    - Admin: `http://127.0.0.1:8011/admin.html`
    - Operador: `http://127.0.0.1:8011/operador-turnos.html`
    - Health: `http://127.0.0.1:8011/api.php?resource=health`

Notas de testing local:

- `npx playwright test` levanta un servidor fresco en `127.0.0.1:8011` por defecto.
- Para apuntar las suites a un servidor ya levantado usa `TEST_BASE_URL=http://127.0.0.1:8011`.
- La reutilizacion de servidor queda en opt-in con `TEST_REUSE_EXISTING_SERVER=1`.
- `npm run benchmark:local` reutiliza `TEST_BASE_URL` o levanta `127.0.0.1:8011` si no le pasas host.
- El login OpenClaw/ChatGPT local necesita dos procesos vivos: backend PHP en `8011` y helper local en `4173`.
- Antes de abrir `admin.html`, valida el OAuth local con `openclaw models status --json`.

Variable minima recomendada:

```powershell
$env:PIELARMONIA_ADMIN_PASSWORD = "admin123"
```

Overrides utiles para tooling local:

```powershell
$env:TEST_LOCAL_SERVER_PORT = "8011"
$env:TEST_BASE_URL = "http://127.0.0.1:8011"
```

Higiene local:

- `npm run check:local:artifacts`
- `npm run clean:local:artifacts`
- Limpia `cookies.txt`, `.lighthouseci/`, `lhci_reports/`, `_deploy_bundle/`,
  `playwright-report/`, `test-results/`, `php_server.log`,
  `.php-cs-fixer.cache`, `.phpunit.cache/`, `coverage.xml`,
  `.tmp-calendar-write-report.json`, `.codex-public-paths.txt`,
  `build_analysis.txt` y
  `conflict_branches.txt`, `stats.html`, `styles.min.css`,
  `styles.optimized.css`, `styles-critical.min.css` y
  `styles-deferred.min.css`.
- No toca `verification/agent-runs/` ni evidencia canonica.

## Flujos rapidos

### Web publica V6

- `npm run build:public:v6`
- `npm run check:public:v6:artifacts`
- `npm run check:public:runtime:artifacts`
- `npm run chunks:public:check`
- `npm run chunks:public:prune`
- `npm run benchmark:local`
- `npm run test:frontend:performance:gate`
- `npm run test:frontend:qa:v6`
- `npm run gate:public:v6:canonical-publish`
- `check:public:runtime:artifacts` valida `styles.css`, `styles-deferred.css`, `script.js`, `js/chunks/**` y `js/engines/**`, exige un solo shell activo y escribe `verification/public-v6-canonical/runtime-artifacts-report.json`.
- `chunks:public:prune` limpia `js/chunks/*.js` que ya no cuelgan del grafo activo de `script.js`.
- Los snapshots legacy `booking-engine.js` y `utils.js` ya no viven en raiz activa; quedaron archivados en `js/archive/root-legacy/**`.

### Admin

- `npm run gate:admin:rollout`
- `npm run chunks:admin:check`
- `npm run chunks:admin:prune`
- Implementacion PowerShell canonica: `scripts/ops/admin/**` (wrappers compatibles en raiz)
- `chunks:admin:check` tambien falla si `admin.js` o el chunk activo contienen marcadores de merge.
- `GATE-ADMIN-ROLLOUT.ps1` propaga `-Domain` hacia Playwright con `TEST_BASE_URL` para evitar drift de servidores locales viejos.

### LeadOps IA interna

- `npm run leadops:worker`
- `php vendor/bin/phpunit tests/Integration/LeadOpsEndpointsTest.php`
- `node --test tests-node/lead-ai-worker.test.js`
- `npx playwright test tests/admin-callbacks-triage.spec.js`

### Dominios criticos

- `npm run test:critical:agenda`
- `npm run test:critical:funnel`
- `npm run test:critical:payments`

### Produccion

- `npm run verify:prod`
- `npm run gate:prod:fast`
- `npm run gate:prod:strict`
- `npm run nightly:stability`
- `npm run monitor:prod`
- Implementacion canonica ops: `scripts/ops/**` (wrappers compatibles en raiz)
- `npm run report:weekly:prod`

### Gobernanza de agentes

- `npm run agent:status`
- `npm run agent:board:doctor`
- `npm run agent:summary:local`
- `npm run agent:gate`

## Mapa corto del repo

- `src/apps/astro/src/pages/**`: rutas publicas V6
- `src/apps/astro/src/components/public-v6/**`: componentes publicos V6
- `content/public-v6/**`: copy y contenido canonico publico
- `src/apps/admin-v3/**`: UI admin activa
- `src/apps/archive/**`: codigo historico archivado fuera del runtime activo
- `admin.html`: shell admin servido
- `admin.js`: bundle admin generado
- `controllers/**`, `lib/**`: backend y servicios
- `scripts/ops/**`: scripts operativos canónicos
- `js/archive/root-legacy/**`: snapshots JS legacy fuera del runtime activo
- `verification/**`: reportes, auditorias y evidencia

## Reglas practicas

- No editar a mano `es/**`, `en/**`, `_astro/**`, `styles.css`, `styles-deferred.css`, `script.js`, `js/chunks/**` ni `js/engines/**`; son artefactos versionados de deploy/runtime.
- No reactivar `legacy` ni `sony_v2` en admin; el rollback es `revert + deploy`.
- Si tocas orquestacion o board, sigue `AGENTS.md` y valida con `npm run agent:gate`.
- Si dudas que comando usar, revisa `docs/OPERATIONS_INDEX.md`.
- Si operas el piloto comercial interno, revisa `docs/LEADOPS_OPENCLAW.md`.
- Material historico y one-offs archivados viven en `docs/archive/root-history/` y `scripts/archive/`.
- La frontera de markdowns permitidos en raiz vive en `docs/ROOT_SURFACES.md`.
- La misma guia fija tambien las allowlists de `.js`, `.html`, `.css`, `.php`, `.ps1`, `.json`, `.yaml`, `.yml`, `.txt`, `.toml`, dotfiles, singletones especiales y directorios permitidos en raiz.
- Los shims markdown de raiz existen solo para compatibilidad humana; runtime y tooling deben consumir `docs/**`.
- Los CSS minificados/optimizados legacy ya no viven en la raiz activa; quedaron en `styles/archive/public-legacy/**`.
- `hero-woman.webp` ya no vive en la raiz activa; quedo archivado en `images/archive/root-legacy/**`.
- `components/` y `servicios/` ya no forman parte del source raiz activo; sus residuos legacy quedaron en `src/archive/root-legacy/**` y `scripts/archive/`.
- `SERVIDOR-LOCAL.md`, `DESPLIEGUE-PIELARMONIA.md`, `CONTRIBUTING.md`,
  `GITHUB-ACTIONS-DEPLOY.md`, `CHECKLIST-PRUEBAS-PRODUCCION.md`,
  `CALENDAR-CUTOVER.md`, `ESTADO_PRODUCTO_OPERATIVO.md`,
  `PLAN_ESTABILIDAD_14DIAS.md` y `SECURITY_AUDIT.md` quedan como shims
  compatibles; la fuente canonica vive en `docs/**`.
