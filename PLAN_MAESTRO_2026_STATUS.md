# Plan Maestro 2026 - Estado Operativo

> Nota de gobernanza (2026-02-24): este documento se mantiene como snapshot historico; la fuente unica de control operativo es `PLAN_MAESTRO_OPERATIVO_2026.md`.

Fecha de actualizacion: 2026-02-25 (sesion Codex hardening KPI semanal: conversion + funnel)
Dominio: https://pielarmonia.com

## Resumen rapido

- Actualizacion 2026-02-24 (post-fix compat calendar): CI y Post-Deploy Gate en verde para commit `c4beac8`.
- Actualizacion 2026-02-25 (weekly KPI hardening): guardrails de conversion y funnel temprano en `main`, con validaciones remotas `Weekly KPI Report` runs `22408343562` y `22408612570`.
- CI run `22334259615` (push a main): `success`.
- Post-Deploy Gate run `22334259617` (push a main): `success`.
- CI run `22334594766` (commit `916adde`): `success`.
- Post-Deploy Gate run `22334594761` (commit `916adde`): `cancelled` por concurrencia del workflow.
- CI run `22334952338` (commit `e1a243d`): `success`.
- Post-Deploy Gate run `22334952341` (commit `e1a243d`): `success`.
- CI run `22335119857` (commit `4f32b2d`): `success`.
- Post-Deploy Gate run `22335119858` (commit `4f32b2d`): `cancelled` por concurrencia del workflow.
- CI run `22335524920` (commit `5b7c036`): `success`.
- Post-Deploy Gate run `22335524921` (commit `5b7c036`): `success`.
- CI run `22335616088` (commit `7858f76`): `success`.
- Post-Deploy Gate run `22335616092` (commit `7858f76`): `success`.
- Deploy Hosting (Canary) run `22335659553` (commit `7858f76`): `success`.
- CI run `22335963604` (commit `e7298ac`): `success`.
- Post-Deploy Gate run `22335963619` (commit `e7298ac`): `success`.
- Deploy Hosting (Canary) run `22336009664` (commit `e7298ac`): `success`.
- CI run `22336253347` (commit `4d89d31`): `success`.
- Post-Deploy Gate run `22336253349` (commit `4d89d31`): `success`.
- Deploy Hosting (Canary) run `22336303456` (commit `4d89d31`): `success`.
- CI run `22336382191` (commit `6486dc3`): `success`.
- Post-Deploy Gate run `22336382185` (commit `6486dc3`): `success`.
- Deploy Hosting (Canary) run `22336431703` (commit `6486dc3`): `success`.
- CI run `22336491656` (commit `e565fe5`): `success`.
- Post-Deploy Gate run `22336491643` (commit `e565fe5`): `success`.
- Deploy Hosting (Canary) run `22336540658` (commit `e565fe5`): `success`.
- CI run `22337042402` (commit `03c9ace`): `success`.
- Post-Deploy Gate run `22337042395` (commit `03c9ace`): `success`.
- Deploy Hosting (Canary) run `22337088362` (commit `03c9ace`): `success`.
- CI run `22337574855` (commit `fe06cbc`): `success`.
- Post-Deploy Gate run `22337574884` (commit `fe06cbc`): `success`.
- Deploy Hosting (Canary) run `22337629002` (commit `fe06cbc`): `success`.
- CI run `22337745655` (commit `e22dcda`): `success`.
- Post-Deploy Gate run `22337745649` (commit `e22dcda`): `success`.
- Deploy Hosting (Canary) run `22337800854` (commit `e22dcda`): `success`.
- Convencion anti-bucle: este snapshot registra evidencia de cambios operativos/codigo; no se agregan corridas originadas solo por commits `docs(status)` para evitar recursividad documental.
- Hardening workflows: override manual `require_google_calendar` habilitado en `Post-Deploy Gate` y `Production Monitor`.
- Fase 2: suite `test:phase2` incorporada (paridad web/chat + concurrencia real opcional segun `TEST_ENABLE_CALENDAR_WRITE`).
- Plan complementario Codex 2026 creado (`PLAN_MAESTRO_CODEX_2026.md`) con foco tecnico en confiabilidad/tests y retencion no-show.
- Estado general: En curso. CI desbloqueado y pipeline activo tras fix de calendar runtime.
- Chatbot: Operativo en Trinity/OpenRouter (cola OpenClaw deshabilitada por decision de producto).
- Agenda real: activa en produccion (`calendarSource=google`, `calendarAuth=oauth_refresh`, `calendarMode=live`).
- Gate de produccion: push gate en verde + hash-strict manual en verde (2026-02-23 21:52 hora local del servidor / 2026-02-24 UTC).
- Gate backend manual (skip hash) tras `4f32b2d`: falla por `availability` en `503 calendar_unreachable` cuando se exige Google estricto (`requiredGoogle=true`).
- Validacion live 2026-02-23 23:34 (-05:00): `health.calendarRequired=true` y `health.calendarRequirementMet=true`; `availability`/`booked-slots` responden con `meta.source=google` y `meta.mode=live`.
- Smoke: 19/19 OK. Latencias: figo-post p95=582ms, core p95=553ms. Error rate=0.
- Umbral operativo `figo-post` endurecido a p95 <= `2500 ms` en gate/benchmark/workflow.
- Gate hash estricto: validado en 3 corridas consecutivas (pre code-split).
- Workflow post-deploy ajustado para ejecutar hashes bloqueantes en `push` de forma inmediata.
- admin.js code split completado: 71KB -> 49.7KB (bajo target <50KB). Chunks: appointments + availability bajo demanda.
- script.js code split completado: 111KB -> 79.3KB (-29%). Chunks: shell (15.2KB lazy) + content-loader (7.2KB prefetch). HTML a type="module". Commits: 842ee92, d3cde08.
- asset-reference-integrity test: regex extendida para rutas relativas (./js/chunks/\*). Commit: b0b45a1.
- PIELARMONIA_DEBUG_EXCEPTIONS: default explicitamente `false` en env.example.php.
- Dependencias circulares JS: investigadas y confirmadas como inexistentes en codigo actual (state.js no tiene imports del proyecto).

## Evidencia ejecutada hoy

1. Reserva y reprogramacion reales (Google write)

- Comando: `npm run test:calendar-write`
- Resultado: `1 passed`
- Cobertura: crea cita 60 min, reprograma, cancela cleanup.

2. E2E UI reserva + reprogramacion

- Comando: `npx playwright test tests/booking.spec.js tests/reschedule.spec.js --project=chromium`
- Resultado: `10 passed`

3. Regresion movil (overflow/chat layout)

- Comando: `npx playwright test tests/mobile-overflow-regression.spec.js tests/chat-mobile-layout.spec.js --project=chromium`
- Resultado: `4 passed`

4. Embudo de conversion (tracking + API)

- Comando: `npx playwright test tests/funnel-tracking.spec.js tests/funnel-event-api.spec.js --project=chromium`
- Resultado: `5 passed`

5. Contrato de calendario

- Comando: `npm run test:calendar-contract`
- Resultado: `3 passed`

6. Smoke + Gate backend produccion

- Comando: `npm run smoke:prod` y `npm run gate:prod:backend`
- Resultado: OK
- Bench API (25 runs):
    - `health` p95: `333.32 ms`
    - `reviews` p95: `537.64 ms`
    - `availability` p95: `536.3 ms`
    - `figo-get` p95: `570.33 ms`
    - `figo-post` p95: `582.74 ms`

7. Hash gate estricto (forzado)

- Comando: `npm run gate:prod:hash-strict`
- Resultado: OK (`Gate OK: despliegue validado`).
- Bench API (25 runs):
    - `health` p95: `349.54 ms`
    - `reviews` p95: `528.65 ms`
    - `availability` p95: `537.78 ms`
    - `figo-get` p95: `568.26 ms`
    - `figo-post` p95: `815.7 ms`
- Nota: el warning de `deploy freshness` se mantiene en modo advisory porque este commit no cambia frontend.

8. Hash gate estricto manual post-fix compat

- Comando: `powershell -NoProfile -ExecutionPolicy Bypass -File .\GATE-POSTDEPLOY.ps1 -Domain https://pielarmonia.com -ForceAssetHashChecks`
- Resultado: OK (`Gate OK: despliegue validado`).
- Smoke: `19/19` checks OK.
- Bench API (25 runs):
    - `health` p95: `367.42 ms`
    - `reviews` p95: `352.08 ms`
    - `availability` p95: `715.56 ms` (max puntual: `3350.09 ms`, sin incumplir p95)
    - `figo-get` p95: `397.69 ms`
    - `figo-post` p95: `396.83 ms`

9. Hash gate estricto manual (corrida con pico transitorio)

- Comando: `powershell -NoProfile -ExecutionPolicy Bypass -File .\GATE-POSTDEPLOY.ps1 -Domain https://pielarmonia.com -ForceAssetHashChecks`
- Resultado: FAIL puntual por benchmark (`availability` p95 `3397.23 ms` > `800 ms`), con hash/smoke en verde.

10. Hash gate estricto manual (recuperacion y cierre consecutivo)

- Comando: `powershell -NoProfile -ExecutionPolicy Bypass -File .\GATE-POSTDEPLOY.ps1 -Domain https://pielarmonia.com -ForceAssetHashChecks`
- Corrida A (21:59 local servidor): OK. `availability` p95 `467.49 ms`.
- Corrida B (22:00 local servidor): OK. `availability` p95 `377.60 ms`.
- Corrida C (22:02 local servidor): OK. `availability` p95 `361.13 ms`.
- Conclusion: 3 corridas strict consecutivas en verde post-incidente transitorio.

11. Gate operativo completo (manual)

- Comando: `npm run gate:prod`
- Resultado: OK (`Gate OK: despliegue validado`).
- Bench API (25 runs):
    - `health` p95: `541.12 ms`
    - `reviews` p95: `529.15 ms`
    - `availability` p95: `553.77 ms`
    - `figo-get` p95: `577.22 ms`
    - `figo-post` p95: `890.71 ms`

12. Hash strict actual (manual)

- Comando: `npm run gate:prod:hash-strict`
- Resultado: OK (`Gate OK: despliegue validado`).
- Bench API (25 runs):
    - `health` p95: `541.12 ms`
    - `reviews` p95: `538.41 ms`
    - `availability` p95: `553.77 ms`
    - `figo-get` p95: `580.81 ms`
    - `figo-post` p95: `589.88 ms`

13. Contrato Google forzado en produccion

- Comando: `TEST_BASE_URL=https://pielarmonia.com TEST_REQUIRE_GOOGLE_CALENDAR=true npm run test:calendar-contract`
- Resultado: `2 failed, 1 passed`
- Causa: `health.calendarSource != google`.

14. Gate backend manual con Google estricto (skip hash)

- Comando: `powershell -NoProfile -ExecutionPolicy Bypass -File .\GATE-POSTDEPLOY.ps1 -Domain https://pielarmonia.com -SkipAssetHashChecks`
- Resultado: FAIL.
- Hallazgo principal: `Availability API` devuelve `503` con `code=calendar_unreachable` y meta `requiredGoogle=true`.
- Contexto health en el mismo periodo: `calendarSource=store`, `calendarAuth=none`.

15. Verificacion live de cutover Google en produccion

- Comando: `Invoke-WebRequest` a `health`, `availability` y `booked-slots` (2026-02-23 23:34 -05:00).
- Resultado: OK.
- Evidencia:
    - `health.calendarSource=google`
    - `health.calendarAuth=oauth_refresh`
    - `health.calendarMode=live`
    - `health.calendarRequired=true`
    - `health.calendarRequirementMet=true`
    - `availability.meta.source=google`, `availability.meta.mode=live`
    - `booked-slots.meta.source=google`, `booked-slots.meta.mode=live`

16. Gate estricto con contrato Google efectivo

- Workflow: `Post-Deploy Gate (Git Sync)` run `22337042395` (commit `03c9ace`).
- Resultado: OK.
- Evidencia de pasos:
    - `Resolver modo estricto de calendario desde health`: `success`
    - `Validar contrato Google Calendar (no destructivo)`: `success`
- Interpretacion operativa: se valida cierre del criterio estricto de calendario para Fase 1.

17. Suite automatizada para criterios de Fase 2

- Commit: `fe06cbc`.
- Cobertura:
    - Concurrencia real en mismo slot (esperado `201 + 409 slot_conflict`) con cleanup admin.
    - Paridad de oferta de slots entre web y chat para misma fecha/servicio.
- Ejecucion CI:
    - `npm run test:phase2` en job `e2e-tests` (con `TEST_ENABLE_CALENDAR_WRITE=false`, valida paridad y deja concurrencia real para corrida controlada).
- Evidencia adicional:
    - CI run `22337745655` (commit `e22dcda`) en verde con `test:phase2` integrado en pipeline.

18. Workflow manual para concurrencia real de Fase 2

- Archivo: `.github/workflows/phase2-concurrency-write.yml`.
- Modo de uso: `workflow_dispatch` con `enable_write=true`.
- Guardrails:
    - Falla explicita si `enable_write` no esta activo.
    - Requiere secret `PIELARMONIA_ADMIN_PASSWORD`.
- Objetivo: ejecutar la evidencia de cierre pendiente (`201 + 409 slot_conflict`) en entorno real controlado.

## Estado por fases del plan unico

1. Fase 0 - Control unico y anti-bucle: Completada.

- Un solo plan operativo activo.
- Gate hibrido aplicado.

2. Fase 1 - Agenda real Google (OAuth): Completada.

- Disponibilidad y reserva con metadatos de calendario implementadas.
- Cutover productivo activo y saludable (`calendarSource=google`, `calendarAuth=oauth_refresh`, `calendarMode=live`).
- Contrato estricto validado en pipeline (`Post-Deploy Gate` run `22337042395`).

3. Fase 2 - Consistencia reserva/chat/reprogramacion: Completada.

- Duraciones por servicio verificadas (caso 60 min probado).
- Flujo de reprogramacion real validado.
- Criterio cerrado:
    - Paridad de oferta de slots entre web y chat para misma fecha/servicio (automatizada en CI con `test:phase2`, run `22337745655`).
    - Concurrencia real en produccion: workflow `Phase 2 Concurrency Write (Manual)` run `22386308512` (`enable_write=true`) -> `success`.
    - Evidencia funcional: el test `concurrencia en mismo slot produce 201 + 409 slot_conflict` (en `tests/phase2-calendar-consistency.spec.js`) exige ese patron para pasar.

4. Fase 3 - Conversion y medicion: Completada.

- Eventos funnel y contrato API validados.
- Dashboard operacional semanal automatizado (`npm run report:weekly:prod`).
- Alertas operativas semanales en GitHub Actions (`weekly-kpi-report.yml`).
- Reporte semanal endurecido en `main` (2026-02-25): guardrails configurables de conversion final (`startCheckout -> bookingConfirmed`) y funnel temprano (`viewBooking -> startCheckout`) con deltas semanales y sample minimo.
- `weekly-kpi-report.yml` resume en `GITHUB_STEP_SUMMARY` metricas de conversion/funnel (`view_booking`, `start_checkout_rate_pct`, `booking_confirmed_rate_pct`) y sus deltas.
- Evidencia remota en `main`: `Weekly KPI Report` run `22408343562` (conversion) y run `22408612570` (funnel temprano) en verde; artifact semanal con campos `conversion` y `conversionTrend`.
- Abandon reason analysis: backend agrega por step y por reason, dashboard renderiza funnelAbandonReasonList y funnelAbandonList.
- Tests funnel confirmados: 3 passed (2026-02-23).

5. Fase 4 - UX movil y rendimiento critico: Completada.

- Regresiones moviles: 4 passed (2026-02-23).
- admin.js code split: 71KB -> 49.7KB (bajo target <50KB). Chunks bajo demanda: appointments + availability.
- script.js: 111KB -> 79.3KB (-29%). TARGET <80KB ALCANZADO. Commits: 842ee92, d3cde08.

6. Fase 5 - Hardening final y hash gate estricto: Completada.

- 3 corridas hash estrictas consecutivas en verde (post-incidente transitorio).
- Workflow principal (`post-deploy-gate.yml`) con hashes bloqueantes en eventos `push`.
- Playbook de incidentes actualizado (`docs/RUNBOOKS.md`, secciones 1.4 y 2.5).

## Nudos reales pendientes (sin ruido)

1. Entorno local sin PHP en PATH.

- Impacto: `npm run test:php` no corre en esta maquina.
- Mitigacion: tests backend criticos ya validados en produccion con Playwright/Smoke/Gate.

2. Deploy freshness en modo advisory.

- Estado: informativo para commits sin cambios frontend.
- Accion: mantener vigilancia operativa, sin impacto de bloqueo cuando hashes ya validan en modo estricto.

3. Repair git sync remoto bloqueado por red.

- Workflow ejecutado: `Repair Git Sync (Self-Heal)` run `22312282946`.
- Falla: `dial tcp ...:22: i/o timeout`.
- Implicacion: no se puede forzar `git reset` remoto desde GitHub Actions con la red actual.

4. Host de deploy no accesible desde runner/local por puertos de administracion.

- Pruebas: `101.47.4.223` en puertos `22`, `21`, `990` -> `TcpTestSucceeded=False`.
- Implicacion: no hay canal remoto util para sincronizar artefactos (SSH/FTP/FTPS).

5. script.js: 111KB -> 79.3KB (-29%). TARGET <80KB ALCANZADO. Commits: 842ee92, d3cde08.

- Chunks lazy: shell (15.2KB al primer uso del chat) + content-loader (7.2KB prefetch paralelo).
- HTML actualizado a type="module". Pipeline Rollup en formato ES con code splitting.
- asset-reference-integrity test cubre chunks via regex extendida (b0b45a1).
- DEPLOY VALIDADO: CI/Gate verdes + corridas strict manuales en verde; mantener vigilancia de picos transitorios de latencia.

6. Cobertura de tests: ~5-35% actual vs 80% objetivo.

- Jules (Google AI) trabajando en scaffolding de tests (BookingServiceTest, RateLimiterTest, AuthSessionTest).
- Nota: el bloqueo CI por `compat.php` quedo resuelto en commit `c4beac8`; mantener seguimiento de cobertura y calidad de tests nuevos.

7. Monitoring/observabilidad: Sentry ACTIVO en produccion.

- DSN backend (PHP) y DSN frontend (JS) configurados en env del servidor.
- Proyectos separados en sentry.io: pielarmonia-backend y pielarmonia-frontend.
- SDK carga lazy via monitoring-loader.js (async, no bloquea render).
- Pendiente: confirmar primer evento recibido en dashboard/API de Sentry.
- Soporte local listo: `npm run verify:sentry:events` (requiere `SENTRY_AUTH_TOKEN`, `SENTRY_ORG` y projects).
- Soporte remoto listo: workflow manual `Sentry Events Verify (Manual)` (`.github/workflows/sentry-events-verify.yml`) con artifact `sentry-events-report`.

8. Incidente CI por calendar compat (RESUELTO 2026-02-24).

- Accion aplicada: eliminacion de `lib/calendar/compat.php`, runtime nativo estricto y alineacion de test unitario de calendario.
- Evidencia: CI run `22334259615` = `success`; Post-Deploy Gate run `22334259617` = `success`.
- Seguimiento: incidente cerrado tecnicamente; mantener monitoreo de latencia para evitar falsos negativos en gate.

9. Cutover Google Calendar activado en produccion (cerrado en Fase 1).

- Evidencia health actual (2026-02-23 23:34 -05:00): `calendarSource=google`, `calendarAuth=oauth_refresh`, `calendarMode=live`.
- Evidencia adicional: `calendarRequired=true`, `calendarRequirementMet=true`.
- Variables GitHub de control: validar y alinear a modo estricto si aun no estan aplicadas (`REQUIRE_GOOGLE_CALENDAR=true`, `PROD_MONITOR_ALLOW_STORE_CALENDAR=false`).
- Override manual disponible: `workflow_dispatch` en `Post-Deploy Gate` y `Production Monitor` con `require_google_calendar=true`.
- Cierre automatizado: contrato Google estricto validado en run `22337042395`.

## Siguiente ejecucion recomendada

1. Confirmar primer evento en Sentry dashboard/API (backend + frontend) usando `npm run verify:sentry:events` o workflow `Sentry Events Verify (Manual)`.
2. Registrar evidencia de Sentry (timestamp/eventID por proyecto) en este status y/o `verification/agent-runs/`.
3. Mantener monitoreo semanal de p95 `availability` y revisar warnings no bloqueantes en `Weekly KPI Report` (ej. `core_p95_alto_*`) para separar ruido de latencia vs regresion de conversion/funnel.
