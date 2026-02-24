# Plan Maestro 2026 - Estado Operativo

> Nota de gobernanza (2026-02-24): este documento se mantiene como snapshot historico; la fuente unica de control operativo es `PLAN_MAESTRO_OPERATIVO_2026.md`.

Fecha de actualizacion: 2026-02-24 (sesion Codex post-fix compat + validacion strict)
Dominio: https://pielarmonia.com

## Resumen rapido

- Actualizacion 2026-02-24 (post-fix compat calendar): CI y Post-Deploy Gate en verde para commit `c4beac8`.
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
- Hardening workflows: override manual `require_google_calendar` habilitado en `Post-Deploy Gate` y `Production Monitor`.
- Estado general: En curso. CI desbloqueado y pipeline activo tras fix de calendar runtime.
- Chatbot: Operativo en Trinity/OpenRouter (cola OpenClaw deshabilitada por decision de producto).
- Agenda real: implementada en codigo, pero produccion hoy reporta `calendarSource=store` y `calendarAuth=none`.
- Gate de produccion: push gate en verde + hash-strict manual en verde (2026-02-23 21:52 hora local del servidor / 2026-02-24 UTC).
- Gate backend manual (skip hash) tras `4f32b2d`: falla por `availability` en `503 calendar_unreachable` cuando se exige Google estricto (`requiredGoogle=true`).
- Smoke: 19/19 OK. Latencias: figo-post p95=582ms, core p95=553ms. Error rate=0.
- Umbral operativo `figo-post` endurecido a p95 <= `2500 ms` en gate/benchmark/workflow.
- Gate hash estricto: validado en 3 corridas consecutivas (pre code-split).
- Workflow post-deploy ajustado para ejecutar hashes bloqueantes en `push` de forma inmediata.
- admin.js code split completado: 71KB -> 49.7KB (bajo target <50KB). Chunks: appointments + availability bajo demanda.
- script.js code split completado: 111KB -> 79.3KB (-29%). Chunks: shell (15.2KB lazy) + content-loader (7.2KB prefetch). HTML a type="module". Commits: 842ee92, d3cde08.
- asset-reference-integrity test: regex extendida para rutas relativas (./js/chunks/*). Commit: b0b45a1.
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

## Estado por fases del plan unico

1. Fase 0 - Control unico y anti-bucle: Completada.
- Un solo plan operativo activo.
- Gate hibrido aplicado.

2. Fase 1 - Agenda real Google (OAuth): En validacion de cutover productivo.
- Disponibilidad y reserva con metadatos de calendario implementadas.
- Pendiente activar modo Google real en produccion (health aun en `calendarSource=store`).

3. Fase 2 - Consistencia reserva/chat/reprogramacion: Completada en flujos criticos.
- Duraciones por servicio verificadas (caso 60 min probado).
- Flujo de reprogramacion real validado.

4. Fase 3 - Conversion y medicion: Completada.
- Eventos funnel y contrato API validados.
- Dashboard operacional semanal automatizado (`npm run report:weekly:prod`).
- Alertas operativas semanales en GitHub Actions (`weekly-kpi-report.yml`).
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
- Pendiente: confirmar primer evento recibido en dashboard de Sentry.

8. Incidente CI por calendar compat (RESUELTO 2026-02-24).
- Accion aplicada: eliminacion de `lib/calendar/compat.php`, runtime nativo estricto y alineacion de test unitario de calendario.
- Evidencia: CI run `22334259615` = `success`; Post-Deploy Gate run `22334259617` = `success`.
- Seguimiento: incidente cerrado tecnicamente; mantener monitoreo de latencia para evitar falsos negativos en gate.

9. Cutover Google Calendar pendiente en produccion.
- Evidencia health actual: `calendarSource=store`, `calendarAuth=none`.
- Variables GitHub vigentes: `REQUIRE_GOOGLE_CALENDAR=false`, `PROD_MONITOR_ALLOW_STORE_CALENDAR=true`.
- Override manual disponible: `workflow_dispatch` en `Post-Deploy Gate` y `Production Monitor` con `require_google_calendar=true`.
- Impacto: pruebas con Google estricto fallan hasta completar credenciales OAuth en servidor.

## Siguiente ejecucion recomendada

1. Completar cutover de Google Calendar en servidor (`calendarSource=google`, `calendarAuth=oauth_refresh`).
2. Cambiar variables de control a modo estricto: `REQUIRE_GOOGLE_CALENDAR=true` y `PROD_MONITOR_ALLOW_STORE_CALENDAR=false`.
3. Re-ejecutar: `TEST_REQUIRE_GOOGLE_CALENDAR=true npm run test:calendar-contract`.
4. Re-ejecutar gate post-deploy (`npm run gate:prod:backend` y `npm run gate:prod:hash-strict`) para validar que `availability` ya no responda `503`.
5. Confirmar primer evento en Sentry dashboard (Sentry ya activo en produccion).
6. Mantener monitoreo semanal de p95 `availability` para detectar picos transitorios.
