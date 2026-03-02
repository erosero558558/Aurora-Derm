# Runbook Admin UI Sony v2/v3

## Objetivo

Operar rollout/cutover/rollback del admin `sony_v2` y `sony_v3` con fallback inmediato a `legacy` y sin romper contratos operativos.

## Contrato operativo

1. Entrada unica: `admin.html`.
2. Precedencia de variante:
    - query `admin_ui=sony_v3|sony_v2|legacy`
    - `localStorage.adminUiVariant`
    - flag backend `admin_sony_ui_v3 === true` (`/api.php?resource=features`)
    - flag backend `admin_sony_ui === true` (`/api.php?resource=features`)
    - fallback `legacy`
3. Kill-switch:
    - si `admin_sony_ui=false`, cualquier `sony_v2` se degrada a `legacy`.
    - si `admin_sony_ui_v3=false`, cualquier `sony_v3` se degrada a `sony_v2` si `admin_sony_ui=true`; si no, a `legacy`.
4. Contrato de flags:
    - `/api.php?resource=features` debe exponer `admin_sony_ui` y `admin_sony_ui_v3` como boolean.
    - `admin_sony_ui_v3=false` es el default conservador del repo; el cutover a v3 exige flip explicito por env o storage de flags.
5. Contingencia local:
    - `admin_ui_reset=1` limpia `localStorage.adminUiVariant` antes de resolver variante.
6. Hardening de assets:
    - `sony_v3` carga `admin-v3.css` y su propio entrypoint JS.
    - `sony_v3` deshabilita `styles.min.css`, `admin.min.css` y `admin.css` para evitar contaminacion de cascada.

## URLs de operacion

- Forzar v3 para QA interna: `/admin.html?admin_ui=sony_v3`
- Forzar v2 para rollback rapido: `/admin.html?admin_ui=sony_v2`
- Forzar legacy para QA/rollback: `/admin.html?admin_ui=legacy`
- Limpiar variante local: `/admin.html?admin_ui_reset=1`
- Legacy session-only + limpiar storage: `/admin.html?admin_ui=legacy&admin_ui_reset=1`

## Etapas de rollout

1. Etapa interna
    - habilitar `admin_sony_ui_v3=true` solo en staging/QA o en storage de flags controlado.
    - validar con `admin_ui=sony_v3` antes de volverlo la ruta por defecto.
2. Canary
    - mantener `admin_sony_ui=true`.
    - exponer `admin_sony_ui_v3=true` o rollout porcentual solo para QA/controlado.
    - `sony_v2` permanece como rollback inmediato.
3. Produccion general
    - `admin_sony_ui=true` y `admin_sony_ui_v3=true` al 100%.
    - `sony_v2` queda disponible como rollback rapido.
4. Archivo posterior
    - solo despues de estabilidad sostenida se evalua retirar `sony_v2`.

## Rollback inmediato

1. Apagar flag global de v3:
    - `FEATURE_ADMIN_SONY_UI_V3=false` o `admin_sony_ui_v3=false` en storage de flags.
2. Si tambien se necesita rollback completo:
    - `FEATURE_ADMIN_SONY_UI=false` o `admin_sony_ui=false`.
3. Ejecutar script de contingencia:
    - `npm run admin:ui:contingency`
4. En cada estacion abierta de admin:
    - abrir `/admin.html?admin_ui_reset=1`
    - si se necesita forzar legacy en esa sesion, abrir `/admin.html?admin_ui=legacy&admin_ui_reset=1`
5. Confirmar en navegador:
    - `html[data-admin-ui="legacy"]` o `html[data-admin-ui="sony_v2"]` segun rollback buscado.

## Validacion recomendada por cambio

```bash
npx playwright test tests/admin-ui-variant.spec.js
npx playwright test tests/admin-ui-runtime-smoke.spec.js --workers=1
npx playwright test tests/admin-v3-canary-runtime.spec.js --workers=1
npx playwright test tests/admin-v3-shell.spec.js tests/admin-v3-visual.spec.js --workers=1
npm run lint
npm run test:php
```

Para gate por etapa:

- `GATE-ADMIN-ROLLOUT.ps1 -Stage internal` corre `admin-ui-runtime-smoke` y agrega `admin-v3-canary-runtime` si `admin_sony_ui_v3=true`.
- `GATE-ADMIN-ROLLOUT.ps1 -Stage canary` y `-Stage general` corren `admin-ui-runtime-smoke` + `admin-v3-canary-runtime`.
- `GATE-ADMIN-ROLLOUT.ps1 -Stage rollback` se queda en el smoke base de variantes/CSP.

## Higiene de bundles admin

- `admin.js` ahora carga `legacy`, `sony_v2` y `sony_v3` por import dinamico.
- El build ejecuta limpieza automatica de chunks huerfanos:
    - `npm run chunks:admin:prune`
    - incluido automaticamente dentro de `npm run build`

## Notas operativas

- El canary real de `sony_v3` depende del flag backend `admin_sony_ui_v3`; no se activa solo por query si el flag esta en `false`.
- `GATE-ADMIN-ROLLOUT.ps1` valida ambas flags (`admin_sony_ui` y `admin_sony_ui_v3`) segun la etapa seleccionada y ejecuta smoke stage-aware de `sony_v3`.
- `sony_v3` preserva IDs y `data-action` criticos del admin actual.
- `Turnero Sala` se mantiene compatible en `sony_v3`, pero su replanteamiento visual completo queda para fase 2.
- La paleta `Ctrl+K` reemplaza el input visible permanente de comando rapido en `sony_v3`.
