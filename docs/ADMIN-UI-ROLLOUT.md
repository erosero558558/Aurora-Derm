# Admin UI Rollout (V3 Only)

## Estado actual

El admin opera en modo `sony_v3 only`.

- `GET /admin.html` siempre arranca en `sony_v3`
- no existe seleccion runtime por query
- no existe seleccion runtime por `localStorage.adminUiVariant`
- no existe fallback runtime a `sony_v2` o `legacy`
- el rollback se hace por `revert + deploy`

## Contrato operativo

- Shell canonico: `admin.html`
- Runtime canonico: `admin.js` generado desde `src/apps/admin/index.js`
- UI activa: `sony_v3`
- Stylesheet canonico: `admin-v3.css`
- `js/admin-runtime.js` queda solo como alias de compatibilidad hacia `admin.js`

## Inputs legacy inertes

Los siguientes inputs pueden seguir llegando como ruido heredado, pero ya no
participan del preboot ni del runtime:

- `admin_ui=legacy|sony_v2|sony_v3`
- `admin_ui_reset=1`
- `localStorage.adminUiVariant`

No cambian la UI final. El admin sigue arrancando en `sony_v3` y ya no los
reescribe ni los limpia de forma oportunista.

## Validacion recomendada

```powershell
npm run chunks:admin:check
npm run test:admin:runtime-smoke
npm run test:frontend:qa:admin
npm run gate:admin:rollout
```

## Gate operativo

`GATE-ADMIN-ROLLOUT.ps1` valida (implementacion canonica:
`scripts/ops/admin/GATE-ADMIN-ROLLOUT.ps1`):

- `admin.html` responde correctamente
- el shell referencia `admin-v3.css`
- el shell no referencia `styles.min.css`, `admin.min.css`, `admin.css` ni `admin-v2.css`
- la CSP sigue endurecida
- las suites `admin-ui-runtime-smoke` y `admin-v3-runtime` pasan

## Rollback

No existe rollback por variante.

Procedimiento:

1. Identificar el commit problemático.
2. Revertir el cambio en Git.
3. Desplegar el revert.
4. Re-ejecutar:

```powershell
npm run gate:admin:rollout
```

## Higiene de bundles

Despues de regenerar `admin.js`:

```powershell
npx rollup -c rollup.config.mjs
npm run chunks:admin:check
npm run chunks:admin:prune
```

El prune debe dejar `js/admin-chunks/**` solo con archivos alcanzables desde
`admin.js`. Si reaparecen chunks huerfanos, se trata como drift del runtime
canonico.

O usar el build canonico del repo:

```powershell
npm run build
```

## Notas

- `sony_v2` y `legacy` quedan archivados en `src/apps/archive/admin-v2/` y
  `src/apps/archive/admin-legacy/`.
- No forman parte del runtime, del gate ni de la operacion diaria.
- `admin.html` debe cargar `admin.js` directamente; el bridge heredado no forma parte del shell canonico.
- Los CSS legacy retirados del front door viven en `styles/archive/admin/`.
