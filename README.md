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
- `docs/DEPLOYMENT.md`
- `AGENTS.md`

## Setup local rapido

1. `npm install`
2. `npx playwright install`
3. `php -S 127.0.0.1:8000 -t .`
4. Abrir:
    - Publico: `http://127.0.0.1:8000`
    - Admin: `http://127.0.0.1:8000/admin.html`
    - Health: `http://127.0.0.1:8000/api.php?resource=health`

Variable minima recomendada:

```powershell
$env:PIELARMONIA_ADMIN_PASSWORD = "admin123"
```

## Flujos rapidos

### Web publica V6

- `npm run build:public:v6`
- `npm run check:public:v6:artifacts`
- `npm run test:frontend:qa:v6`
- `npm run gate:public:v6:canonical-publish`

### Admin

- `npm run gate:admin:rollout`
- `npm run chunks:admin:prune`
- `node bin/clean-admin-chunks.js --dry-run`

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
- `admin.html`: shell admin servido
- `admin.js`: bundle admin generado
- `controllers/**`, `lib/**`: backend y servicios
- `verification/**`: reportes, auditorias y evidencia

## Reglas practicas

- No editar a mano `es/**`, `en/**` ni `_astro/**`; son artefactos de deploy.
- No reactivar `legacy` ni `sony_v2` en admin; el rollback es `revert + deploy`.
- Si tocas orquestacion o board, sigue `AGENTS.md` y valida con `npm run agent:gate`.
- Si dudas que comando usar, revisa `docs/OPERATIONS_INDEX.md`.
- Si operas el piloto comercial interno, revisa `docs/LEADOPS_OPENCLAW.md`.
- Material historico y one-offs archivados viven en `docs/archive/root-history/` y `scripts/archive/`.
