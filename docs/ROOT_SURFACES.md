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
- `DUAL_CODEX_RUNBOOK.md`: runbook operativo diario para lanes Codex.
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

## Guardrails

- Si aparece un markdown nuevo en la raiz, debe existir una razon explicita de
  politica, CI o compatibilidad.
- Si una guia activa deja de necesitar ruta en raiz, debe converger a `docs/**`
  y la raiz debe quedar como shim temporal o vaciarse por completo.
- El contrato que protege esta frontera vive en
  `tests-node/workspace-hygiene-contract.test.js`.
