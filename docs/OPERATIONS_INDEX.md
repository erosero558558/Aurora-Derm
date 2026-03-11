# Operations Index

Guia corta para encontrar el flujo correcto sin navegar todo `package.json`.

El material historico y los one-offs desplazados desde la raiz viven en
`docs/archive/root-history/` y `scripts/archive/`.
Los scripts operativos activos viven en `scripts/ops/**`; los `.ps1` de raiz
se conservan como wrappers compatibles.
La frontera de markdowns que todavia permanecen en raiz se documenta en
`docs/ROOT_SURFACES.md`.

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
- Admin sony_v3: `docs/ADMIN-UI-ROLLOUT.md`
- Desarrollo local con backend: `docs/LOCAL_SERVER.md`
- Contribucion y PR flow: `docs/CONTRIBUTING.md`
- LeadOps/OpenClaw: `docs/LEADOPS_OPENCLAW.md`
- Deploy y post-deploy: `docs/DEPLOYMENT.md`
- Deploy hosting detallado: `docs/DEPLOY_HOSTING_PLAYBOOK.md`
- Deploy por GitHub Actions: `docs/GITHUB_ACTIONS_DEPLOY.md`
- Checklist operativa de produccion: `docs/PRODUCTION_TEST_CHECKLIST.md`
- Cutover de agenda Google: `docs/CALENDAR_CUTOVER.md`
- Estado operativo: `docs/PRODUCT_OPERATIONAL_STATUS.md`
- Plan de estabilidad: `docs/STABILITY_14_DAYS_PLAN.md`
- Auditoria de seguridad: `docs/SECURITY_AUDIT.md`
- Runbooks operativos: `docs/RUNBOOKS.md`
- Frontera de markdowns en raiz: `docs/ROOT_SURFACES.md`
- Gobernanza de agentes: `AGENTS.md`

## Higiene local

Comandos:

- `npm run check:local:artifacts`
- `npm run clean:local:artifacts`

Notas:

- Limpia solo artefactos locales efimeros: `cookies.txt`, `.lighthouseci/`, `lhci_reports/`, `_deploy_bundle/`, `playwright-report/`, `test-results/`, `php_server.log`, `.php-cs-fixer.cache`, `.phpunit.cache/` y `coverage.xml`.
- No toca `verification/agent-runs/` ni otros artefactos canonicos de evidencia.

## Que quieres hacer

### 1. Cambiar la web publica

Fuente canonica:

- `src/apps/astro/src/pages/**`
- `src/apps/astro/src/components/public-v6/**`
- `content/public-v6/**`

Comandos:

- `npm run build:public:v6`
- `npm run check:public:v6:artifacts`
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
- `npm run test:admin:runtime-smoke`
- `npm run test:frontend:qa:admin`
- `npm run chunks:admin:check`
- `npm run chunks:admin:prune`

Notas:

- `js/admin-runtime.js` existe solo como alias de compatibilidad.
- `legacy` y `sony_v2` no forman parte del runtime operativo.
- Implementacion operativa canonica: `scripts/ops/admin/**`
- Playwright local usa `127.0.0.1:8011` por defecto; para reutilizar otro servidor usar `TEST_BASE_URL=...` y `TEST_REUSE_EXISTING_SERVER=1` solo si es intencional.

### 3. Validar dominios criticos

Comandos:

- `npm run test:critical:agenda`
- `npm run test:critical:funnel`
- `npm run test:critical:payments`

Usalos antes de tocar despliegue o si cambias comportamiento en agenda, funnel o pagos.

### 4. Validar produccion

Comandos:

- `npm run verify:prod`
- `npm run verify:prod:fast`
- `npm run smoke:prod`
- `npm run gate:prod`
- `npm run gate:prod:fast`
- `npm run gate:prod:strict`
- `npm run nightly:stability`
- `npm run monitor:prod`
- `npm run report:weekly:prod`

Implementacion canonica:

- `scripts/ops/prod/**`
- `scripts/ops/setup/**`
- `bin/powershell/**`
- Los `.ps1` de raiz siguen existiendo como wrappers compatibles.

### 5. Operar LeadOps interno con OpenClaw

Comandos:

- `npm run leadops:worker`
- `php vendor/bin/phpunit tests/Integration/LeadOpsEndpointsTest.php`
- `node --test tests-node/lead-ai-worker.test.js`
- `npx playwright test tests/admin-callbacks-triage.spec.js`

Notas:

- `lead-ai-queue` y `lead-ai-result` usan token de maquina, no sesion admin.
- El worker es pull-based desde el laptop del operador.
- Si el worker cae, el panel sigue operando con scoring heuristico local.

### 6. Trabajar con gobernanza y board

Comandos de lectura:

- `npm run agent:status`
- `npm run agent:board:doctor`
- `npm run agent:summary:local`
- `npm run agent:leases`
- `npm run agent:jobs:status`

Comandos de validacion:

- `npm run agent:test`
- `npm run agent:policy:lint`
- `npm run agent:gate`

Para mutaciones del board, seguir `AGENTS.md` y usar `--expect-rev`.

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
