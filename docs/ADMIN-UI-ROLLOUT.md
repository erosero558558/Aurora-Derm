# Admin UI Rollout (V3 Only)

La politica canonica de source-vs-output para bundles versionados vive en
`docs/RUNTIME_ARTIFACT_POLICY.md`.

## Estado actual

El admin opera en modo `sony_v3 only`.

Mientras `docs/PRODUCT_OPERATIONAL_STATUS.md` siga en `RED`, el rollout admin
queda congelado en la slice `admin v3 + queue/turnero + auth Google +
readiness + deploy`. Los paneles de `expansion`, `renewal`, `commercial` y
`executive review` no forman parte del gate operativo del piloto durante este
ciclo.

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
npm run check:runtime:artifacts
npm run test:admin:runtime-smoke
npm run test:frontend:qa:admin
npm run gate:admin:rollout
npm run gate:admin:rollout:auth
npm run diagnose:admin:auth:rollout
npm run smoke:admin:auth:live:node
```

`npm run test:frontend:qa:admin` ya incluye `tests/admin-openclaw-login.spec.js`
como parte del carril canonico del shell.

Para local QA:

- Playwright usa `127.0.0.1:8011` como servidor fresco por defecto.
- Si ya existe un servidor levantado, usar `TEST_BASE_URL=http://127.0.0.1:8011`.
- `TEST_REUSE_EXISTING_SERVER` queda como opt-in explicito.
- El perfil productivo canonico de auth es `AURORADERM_OPERATOR_AUTH_MODE=google_oauth` + `AURORADERM_OPERATOR_AUTH_TRANSPORT=web_broker`.
- En `web_broker`, el login ocurre en la misma pestana y ya no requiere helper local, codigo manual ni polling.
- Usa `npm run openclaw:auth:start` solo como alias de compatibilidad cuando quieras validar `local_helper` en el laptop del operador.
- Si hace falta contingencia legacy, habilitar `AURORADERM_INTERNAL_CONSOLE_AUTH_ALLOW_LEGACY_FALLBACK=true` (alias: `PIELARMONIA_INTERNAL_CONSOLE_AUTH_ALLOW_LEGACY_FALLBACK`) junto con `AURORADERM_ADMIN_PASSWORD` o `AURORADERM_ADMIN_PASSWORD_HASH` y `AURORADERM_ADMIN_2FA_SECRET` (alias: `PIELARMONIA_ADMIN_2FA_SECRET`).
- La UI solo debe mostrar `Clave + 2FA de contingencia` cuando el backend anuncie `fallbacks.legacy_password.available=true`.

## Gate operativo

`GATE-ADMIN-ROLLOUT.ps1` valida (implementacion canonica:
`scripts/ops/admin/GATE-ADMIN-ROLLOUT.ps1`):

- `admin.html` responde correctamente
- el shell referencia `admin-v3.css`
- el shell no referencia `styles.min.css`, `admin.min.css`, `admin.css` ni `admin-v2.css`
- la CSP sigue endurecida
- las suites `admin-ui-runtime-smoke` y `admin-v3-runtime` pasan
- la suite `admin-openclaw-login` pasa como parte del gate cuando el shell usa el contrato Operator Auth
- las suites Playwright se ejecutan contra el `-Domain` solicitado via `TEST_BASE_URL`
- `gate:admin:rollout:auth` endurece el gate para exigir `operator-auth-status` con `mode=google_oauth`, `recommendedMode=google_oauth`, `transport=web_broker` y `configured=true`
- si `operator-auth-status` falla o sigue en `503/502`, el gate consulta `admin-auth.php?action=status` para distinguir entre contrato auth valido, fachada legacy o edge roto
- `diagnose:admin:auth:rollout` devuelve `diagnosis` y `nextAction` para separar rapido si el entorno esta en `facade_only_rollout`, `admin_auth_legacy_facade`, `operator_auth_not_configured`, `operator_auth_edge_failure` u `operator_auth_ready`
- `smoke:admin:auth:live:node` valida el flujo real `start -> redirectUrl -> callback -> shared session admin/turnero -> logout`
- cualquier `5xx` en `operator-auth-status` o `admin-auth.php?action=status` bloquea el piloto operativo aunque la shell `admin.html` siga cargando

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
`npm run chunks:admin:check` tambien falla si `admin.js` o cualquier chunk
activo contiene marcadores de merge.
`npm run check:runtime:artifacts` agrega el chequeo compartido del runtime
versionado cuando el cambio toca mas de una familia de outputs frontend.

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
