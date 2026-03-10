# Operations Index

Guia corta para encontrar el flujo correcto sin navegar todo `package.json`.

El material historico y los one-offs desplazados desde la raiz viven en
`docs/archive/root-history/` y `scripts/archive/`.

## Fuentes de verdad

- Publico V6: `docs/public-v6-canonical-source.md`
- Admin sony_v3: `docs/ADMIN-UI-ROLLOUT.md`
- LeadOps/OpenClaw: `docs/LEADOPS_OPENCLAW.md`
- Deploy y post-deploy: `docs/DEPLOYMENT.md`
- Runbooks operativos: `docs/RUNBOOKS.md`
- Gobernanza de agentes: `AGENTS.md`

## Que quieres hacer

### 1. Cambiar la web publica

Fuente canonica:

- `src/apps/astro/src/pages/**`
- `src/apps/astro/src/components/public-v6/**`
- `content/public-v6/**`

Comandos:

- `npm run build:public:v6`
- `npm run check:public:v6:artifacts`
- `npm run test:frontend:qa:v6`
- `npm run audit:public:v6:copy`
- `npm run audit:public:v6:visual-contract`
- `npm run gate:public:v6:canonical-publish`

### 2. Cambiar el admin

Runtime canonico:

- `admin.html`
- `admin.js`
- `src/apps/admin-v3/**`

Comandos:

- `npm run gate:admin:rollout`
- `npm run test:admin:runtime-smoke`
- `npm run test:frontend:qa:admin`
- `npm run chunks:admin:prune`
- `node bin/clean-admin-chunks.js --dry-run`

Notas:

- `js/admin-runtime.js` existe solo como alias de compatibilidad.
- `legacy` y `sony_v2` no forman parte del runtime operativo.

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

- `npm run build:public:v6`
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

- `npm run chunks:admin:prune`
- `node bin/clean-admin-chunks.js --dry-run`

Si `admin.html` y `admin.js` quedan desalineados, revisar `docs/ADMIN-UI-ROLLOUT.md`.
